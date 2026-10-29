"""
Upkeep agent server — Pass 2: tools wired to Supabase.

Every database call runs under the USER'S JWT, so your RLS policies apply.
The model never sees credentials — it only proposes a tool call, and this
server validates and executes it.

Setup:
    pip install fastapi uvicorn ollama supabase python-dotenv
    cp .env.example .env     # then fill it in
    python get_token.py      # paste the result into .env as TEST_JWT

Run:
    uvicorn agent_server:app --reload --port 8000
    http://localhost:8000/docs
"""

import base64
import json
import os
import re
import time
from datetime import date, datetime, timedelta

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
import ollama

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
MODEL = os.getenv("MODEL", "qwen3:8b")
TEST_JWT = os.getenv("TEST_JWT", "")

# The TEST_JWT fallback is a LAN convenience: with the server behind a public
# tunnel it would let anyone who finds the URL act as the test user without
# sending a token at all. Off unless explicitly switched on for local work.
ALLOW_TEST_JWT = os.getenv("ALLOW_TEST_JWT", "").lower() in ("1", "true", "yes")

app = FastAPI()

# The React Native app calls this from a different origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # tighten to your tunnel domain in production
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


def client_for(jwt: str):
    """
    A Supabase client that acts AS THE USER.

    The anon key gets us in the door; the user's JWT is what auth.uid()
    resolves to inside your RLS policies. Never use the service role key
    here — it bypasses RLS entirely and would let any user touch any row.
    """
    sb = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    sb.postgrest.auth(jwt)
    sb.uid = user_id_from(jwt)   # every insert stamps this explicitly
    return sb


def verify_jwt(jwt: str) -> bool:
    """
    Ask Supabase whether this token is real, before any work is done for it.

    user_id_from only base64-decodes the payload, so on its own it accepts a
    forged token: the data layer still rejects one, but not until after the
    model has run. Publicly reachable, that means anyone with the URL can
    spend time on the GPU. This is one cheap round trip that moves the
    rejection in front of ollama.chat.
    """
    try:
        sb = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        return bool(sb.auth.get_user(jwt).user)
    except Exception:
        return False


def user_id_from(jwt: str) -> str:
    """
    Pull the user's id (the 'sub' claim) out of the token payload.

    No signature check here on purpose — Supabase verifies the token on
    every request, so this is only to fill user_id on inserts. Tables
    without `default auth.uid()` need it set explicitly, or the RLS
    WITH CHECK compares NULL against auth.uid() and rejects the row.
    """
    payload = jwt.split(".")[1]
    payload += "=" * (-len(payload) % 4)          # restore base64 padding
    return json.loads(base64.urlsafe_b64decode(payload))["sub"]


# ---------------------------------------------------------------------
# TOOL SCHEMAS  (unchanged from Pass 1 — they already work)
# ---------------------------------------------------------------------
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "find_cookable_recipes",
            "description": "Find recipes the user can make right now with what is in their fridge. Use when they ask what to cook or what they can make.",
            "parameters": {
                "type": "object",
                "properties": {
                    "max_missing": {
                        "type": "integer",
                        "description": "Allow this many missing ingredients. 0 means only fully cookable recipes.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_to_grocery_list",
            "description": "Add the missing ingredients for a recipe to the user's grocery list. Use when they ask to add items or shop for a recipe.",
            "parameters": {
                "type": "object",
                "properties": {
                    "recipe_name": {
                        "type": "string",
                        "description": "Name of the recipe, e.g. 'Chicken stir-fry'.",
                    }
                },
                "required": ["recipe_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_fridge_item",
            "description": "Add ONE ingredient to the user's fridge. Call it once per ingredient — if they mention several, make several calls. Use when they say they bought something or have something.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ingredient_name": {
                        "type": "string",
                        "description": "The ingredient exactly as the user said it, e.g. 'milk', 'chicken', '2% milk'.",
                    },
                    "quantity": {
                        "type": "number",
                        "description": "How much, if the user said. Leave out if they didn't say.",
                    },
                    "unit": {
                        "type": "string",
                        "description": "Unit if the user said one: lb, oz, cup, tbsp, tsp, clove, slice, whole.",
                    },
                },
                "required": ["ingredient_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_fridge_item",
            "description": "Take ONE ingredient out of the user's fridge. Use when they say they used something up, ran out, finished it, or threw it away.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ingredient_name": {
                        "type": "string",
                        "description": "The ingredient as the user said it, e.g. 'chicken'.",
                    }
                },
                "required": ["ingredient_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "complete_habit",
            "description": "Mark one of the user's habits as done for today. Use when they say they did it, finished it, or completed it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "habit_name": {
                        "type": "string",
                        "description": "The habit as the user said it, e.g. 'stretching', 'water'.",
                    }
                },
                "required": ["habit_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_meal_plan",
            "description": "Tell the user what meals are planned. Use when they ask what they're eating, what's planned, or about their meal plan.",
            "parameters": {
                "type": "object",
                "properties": {
                    "weekday": {
                        "type": "string",
                        "description": "A day name if the user said one: monday, tuesday, wednesday, thursday, friday, saturday, sunday.",
                    },
                    "days_from_today": {
                        "type": "integer",
                        "description": "0 for today, 1 for tomorrow. Leave out if the user asked about the whole week or named a weekday.",
                    },
                    "whole_week": {
                        "type": "boolean",
                        "description": "True if the user asked about the week rather than one day.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "move_grocery_list_to_fridge",
            "description": "Move everything on the user's grocery list into their fridge and clear the list. Use when they say they went shopping, bought their list, or got the items on it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "only_checked": {
                        "type": "boolean",
                        "description": "True if the user only bought the items they checked off. False or omitted means the whole list.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "plan_meal",
            "description": "Put a recipe on the user's meal plan for a given day. Use when they ask to plan or schedule a meal.",
            "parameters": {
                "type": "object",
                "properties": {
                    "recipe_name": {"type": "string", "description": "Name of the recipe."},
                    "days_from_today": {
                        "type": "integer",
                        "description": "0 for today, 1 for tomorrow, and so on.",
                    },
                    "meal_type": {
                        "type": "string",
                        "enum": ["breakfast", "lunch", "dinner", "snack"],
                    },
                },
                "required": ["recipe_name", "days_from_today", "meal_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_habit",
            "description": "Create a daily habit with a reminder time. Use when the user wants to start tracking something.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Short habit name, e.g. 'Drink 2L water'."},
                    "reminder_time": {
                        "type": "string",
                        "description": "24-hour time as HH:MM, e.g. '09:00'.",
                    },
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_workout_plan",
            "description": "Suggest a workout plan matching a goal. Use when the user asks what to train or for a workout.",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal": {
                        "type": "string",
                        "enum": ["muscle", "weight", "endurance", "mobility"],
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "answer_wellness_question",
            "description": "Answer a general question about exercise, nutrition basics, sleep, or habit-building. Do NOT use for medical advice, diagnoses, calorie targets, or supplement doses.",
            "parameters": {
                "type": "object",
                "properties": {
                    "answer": {
                        "type": "string",
                        "description": "A short, practical answer in 2-3 sentences.",
                    }
                },
                "required": ["answer"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "decline",
            "description": "Decline anything outside fitness, meals, and habits — coding, news, trivia, homework — and anything medical.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "enum": ["out_of_scope", "medical"]}
                },
                "required": ["reason"],
            },
        },
    },
]


SYSTEM_PROMPT = """You are the assistant inside Upkeep, a fitness app.

You can take actions in the app (meal plans, grocery lists, habits, workouts) and
answer general questions about exercise, nutrition basics, sleep, and habit-building.

You must ALWAYS respond by calling exactly one tool. Never reply with plain text.

The conversation so far comes before the latest message. Resolve references
against it — "them", "those", "it", "that one", "the same" — before choosing
arguments. NEVER pass a pronoun as a tool argument. If an earlier reply named
the items ("Added 4 item(s) for Chicken stir-fry: Rice, Bell Pepper, Onion,
Garlic"), use those names. If the earlier turns genuinely do not say what was
meant, pick the tool whose clarifying question will ask for it rather than
guessing or passing the pronoun through.

For anything outside fitness, meals, and habits — coding, news, math, trivia,
personal advice — call decline with reason "out_of_scope".

Never give medical advice, diagnose conditions, or recommend specific calorie
targets, weight-loss rates, or supplement doses. For those, call decline with
reason "medical".

Examples:
- "what can I make for dinner?" -> find_cookable_recipes
- "add what I need for the stir-fry" -> add_to_grocery_list
- "I bought 2 lbs of chicken" -> add_fridge_item (quantity 2, unit lb)
- "I picked up milk and eggs" -> add_fridge_item twice, once per ingredient
- "add some rice" -> add_fridge_item with no quantity; the app will ask
- "I got everything on my grocery list" -> move_grocery_list_to_fridge
- "I went shopping" -> move_grocery_list_to_fridge
- "I bought the stuff I checked off" -> move_grocery_list_to_fridge (only_checked true)
- "I bought those ingredients" (after items were just added) -> move_grocery_list_to_fridge
  with only_checked FALSE. only_checked is true ONLY when the user actually
  mentions having checked things off.
- "I used up the chicken" -> remove_fridge_item
- "I'm out of rice" -> remove_fridge_item
- "I did my stretching" -> complete_habit
- "finished my water for today" -> complete_habit
- "what am I eating Thursday?" -> get_meal_plan (weekday thursday)
- "what's for dinner tomorrow?" -> get_meal_plan (days_from_today 1)
- "what's my meal plan this week?" -> get_meal_plan (whole_week true)
- "put the burrito bowl on Thursday" -> plan_meal
- "remind me to stretch at 6pm" -> create_habit
- "what should I train today?" -> recommend_workout_plan
- "what's a good post-workout snack?" -> answer_wellness_question
- "how many calories should I eat to lose 2lb a week?" -> decline (medical)
- "is creatine safe with my heart condition?" -> decline (medical)
- "write me a python script" -> decline (out_of_scope)
"""


# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------
def normalize(s: str) -> str:
    """
    'Chicken stir-fry' and 'chicken stir fry' should match. Lowercase and
    collapse anything that isn't a letter or digit into single spaces, so
    hyphens, ampersands and punctuation stop mattering.
    """
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def find_recipes(sb, name: str) -> list:
    """
    Return EVERY recipe the name could mean, best match first.

    The model can't know what's ambiguous — only the table does. So this
    returns a list and the caller decides whether to act or ask.
    """
    target = normalize(name)
    rows = sb.table("recipes").select("id, name").execute().data

    exact = [r for r in rows if normalize(r["name"]) == target]
    if exact:
        return exact

    return [
        r for r in rows
        if target in normalize(r["name"]) or normalize(r["name"]) in target
    ]


def clarify(prompt: str, options: list = None, field: str = None) -> dict:
    """
    A structured question back to the user. With options, the UI renders
    chips; without, it prompts for typed input (e.g. a quantity).

    `field` names the argument the answer fills in. The agent loop pairs it
    with the tool name and the args so far, and the app sends that back with
    the answer — so the pending call RESUMES rather than being re-routed
    through the model, which has no memory of the question.

    Nothing is written to the database when this is returned.
    """
    return {
        "needs_clarification": True,
        "question": prompt,
        "options": options or [],
        "field": field,
    }


def parse_amount(answer: str):
    """
    Turn a typed quantity answer into (quantity, unit).
    '2 cups' -> (2.0, 'cup')   '1.5' -> (1.5, None)   'a lot' -> (None, None)
    """
    m = re.match(r"\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?", answer or "")
    if not m:
        return None, None
    qty = float(m.group(1))
    unit = m.group(2)
    if unit:
        unit = unit.lower().rstrip("s")        # 'cups' -> 'cup'
    return qty, unit


WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]


def resolve_day(days_from_today: int = None, weekday: str = None) -> date:
    """
    Work out which date the user meant.

    Weekday-name math ("what am I eating Thursday?") is done here rather
    than by the model — an 8B is unreliable at computing day offsets, but
    it can repeat a word it was given.
    """
    today = date.today()

    if weekday:
        want = weekday.strip().lower()
        if want in WEEKDAYS:
            # Sunday-based, matching habits.weekdays and Postgres dow.
            delta = (WEEKDAYS.index(want) - today.weekday() - 1) % 7
            return today + timedelta(days=delta)

    if days_from_today is not None:
        return today + timedelta(days=max(0, min(int(days_from_today), 30)))

    return today


def find_habits(sb, name: str) -> list:
    """The user's own habits matching a name. RLS scopes this to them."""
    target = normalize(name)
    rows = sb.table("habits").select("id, title").eq("active", True).execute().data

    exact = [r for r in rows if normalize(r["title"]) == target]
    if exact:
        return exact

    return [
        r for r in rows
        if target in normalize(r["title"]) or normalize(r["title"]) in target
    ]


def find_ingredients(sb, name: str) -> list:
    """Every catalog ingredient the name could mean. Same matching as recipes."""
    target = normalize(name)
    rows = sb.table("ingredients").select("id, name").execute().data

    exact = [r for r in rows if normalize(r["name"]) == target]
    if exact:
        return exact

    return [
        r for r in rows
        if target in normalize(r["name"]) or normalize(r["name"]) in target
    ]


def existing_fridge_row(sb, ingredient_id: str):
    """The user's current row for one ingredient, or None."""
    res = (
        sb.table("fridge_items")
        .select("quantity, unit")
        .eq("user_id", sb.uid)
        .eq("ingredient_id", ingredient_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def combine_amount(existing, quantity: float, unit: str):
    """
    Work out the new fridge amount when the user buys more of something.

    Buying adds to what's already there. Amounts in different units can't be
    added without a conversion table, so those replace instead of producing a
    meaningless number, and the caller says so.

    Returns (quantity, unit, note).
    """
    if existing is None:
        return quantity, unit, ""

    old_qty = existing.get("quantity") or 0
    old_unit = existing.get("unit")

    # A missing unit on either side is treated as compatible — it carries no
    # claim about how the amount is measured.
    if not old_unit or not unit or old_unit == unit:
        return old_qty + quantity, (unit or old_unit), ""

    note = (
        f" You had {old_qty:g} {old_unit}, which I replaced rather than combined"
        f" — I can't convert {old_unit} to {unit}."
    )
    return quantity, unit, note


def fridge_ingredient_ids(sb) -> set:
    res = sb.table("fridge_items").select("ingredient_id").execute()
    return {r["ingredient_id"] for r in res.data}


# ---------------------------------------------------------------------
# TOOL IMPLEMENTATIONS — real Supabase calls, as the user
# ---------------------------------------------------------------------
def find_cookable_recipes(sb, max_missing: int = 0) -> str:
    have = fridge_ingredient_ids(sb)

    recipes = sb.table("recipes").select("id, name").execute().data
    links = sb.table("recipe_ingredients").select(
        "recipe_id, ingredient_id, ingredients(name)"
    ).execute().data

    by_recipe = {}
    for link in links:
        by_recipe.setdefault(link["recipe_id"], []).append(link)

    ready, almost = [], []
    for r in recipes:
        missing = [
            l["ingredients"]["name"]
            for l in by_recipe.get(r["id"], [])
            if l["ingredient_id"] not in have
        ]
        if not missing:
            ready.append(r["name"])
        elif len(missing) <= max(max_missing, 2):
            almost.append(f"{r['name']} (need {', '.join(missing)})")

    if not ready and not almost:
        return "Nothing matches your fridge right now. Add a few ingredients and I'll try again."

    parts = []
    if ready:
        parts.append("Ready to cook: " + ", ".join(ready[:5]) + ".")
    if almost:
        parts.append("Almost there: " + "; ".join(almost[:3]) + ".")
    return " ".join(parts)


def add_to_grocery_list(sb, recipe_name: str):
    matches = find_recipes(sb, recipe_name)
    if not matches:
        return f"I couldn't find a recipe called '{recipe_name}'."
    if len(matches) > 1:
        return clarify(
            f"Which {recipe_name} did you mean?",
            [m["name"] for m in matches],
            field="recipe_name",
        )

    recipe = matches[0]
    have = fridge_ingredient_ids(sb)
    links = sb.table("recipe_ingredients").select(
        "ingredient_id, quantity, unit, ingredients(name)"
    ).eq("recipe_id", recipe["id"]).execute().data

    missing = [l for l in links if l["ingredient_id"] not in have]
    if not missing:
        return f"You already have everything for {recipe['name']}."

    rows = [
        {
            "user_id": sb.uid,
            "ingredient_id": m["ingredient_id"],
            "quantity": m["quantity"],
            "unit": m["unit"],
            "source": "recipe",
        }
        for m in missing
    ]
    # unique (user_id, ingredient_id) means duplicates are skipped
    sb.table("grocery_items").upsert(
        rows, on_conflict="user_id,ingredient_id", ignore_duplicates=True
    ).execute()

    names = ", ".join(m["ingredients"]["name"] for m in missing)
    return f"Added {len(missing)} item(s) for {recipe['name']}: {names}."


def add_fridge_item(sb, ingredient_name: str, quantity: float = None, unit: str = None):
    matches = find_ingredients(sb, ingredient_name)

    # Not in the shared catalog. Users can't insert into `ingredients`
    # under current RLS, so say so rather than failing silently.
    if not matches:
        return (
            f"'{ingredient_name}' isn't in the ingredient list yet, so I can't add it. "
            "Try a more general name, or add it from the fridge screen."
        )

    # Several catalog rows could be meant — ask which.
    if len(matches) > 1:
        return clarify(
            f"What kind of {ingredient_name}?",
            [m["name"] for m in matches],
            field="ingredient_name",
        )

    ingredient = matches[0]

    # Resolved, but the user never said how much.
    if quantity is None:
        # Carry the resolved name forward so the answer doesn't re-trigger
        # the "what kind?" question.
        return clarify(f"How much {ingredient['name']}?", field="quantity")

    # Buying more of something adds to what's already in the fridge; a plain
    # upsert would overwrite it.
    existing = existing_fridge_row(sb, ingredient["id"])
    total, total_unit, note = combine_amount(existing, quantity, unit)

    sb.table("fridge_items").upsert(
        {
            "user_id": sb.uid,
            "ingredient_id": ingredient["id"],
            "quantity": total,
            "unit": total_unit,
        },
        on_conflict="user_id,ingredient_id",
    ).execute()

    added = f"{quantity:g} {unit}".strip() if unit else f"{quantity:g}"
    running = f"{total:g} {total_unit}".strip() if total_unit else f"{total:g}"

    if existing is None:
        return f"Added {added} {ingredient['name']} to your fridge."
    return f"Added {added} {ingredient['name']} — you now have {running}.{note}"


def remove_fridge_item(sb, ingredient_name: str):
    matches = find_ingredients(sb, ingredient_name)
    if not matches:
        return f"I don't see '{ingredient_name}' in the ingredient list."

    if len(matches) > 1:
        return clarify(
            f"Which {ingredient_name}?",
            [m["name"] for m in matches],
            field="ingredient_name",
        )

    ingredient = matches[0]

    # Only report success if a row actually went away — otherwise the user
    # hears "removed" for something that was never in their fridge.
    existing = sb.table("fridge_items").select("id").eq(
        "ingredient_id", ingredient["id"]
    ).execute().data

    if not existing:
        return f"{ingredient['name']} wasn't in your fridge."

    sb.table("fridge_items").delete().eq("ingredient_id", ingredient["id"]).execute()
    return f"Removed {ingredient['name']} from your fridge."


def complete_habit(sb, habit_name: str):
    matches = find_habits(sb, habit_name)
    if not matches:
        return f"I couldn't find a habit called '{habit_name}'."

    if len(matches) > 1:
        return clarify(
            "Which habit?",
            [m["title"] for m in matches],
            field="habit_name",
        )

    habit = matches[0]
    today = date.today().isoformat()

    # unique (habit_id, completed_on) would reject a second insert, so
    # check first and say something useful instead of erroring.
    already = sb.table("habit_completions").select("id").eq(
        "habit_id", habit["id"]
    ).eq("completed_on", today).execute().data

    if already:
        return f"'{habit['title']}' is already checked off today."

    sb.table("habit_completions").insert(
        {"habit_id": habit["id"], "completed_on": today}
    ).execute()

    # Streaks are computed, not stored — count backwards from today.
    rows = sb.table("habit_completions").select("completed_on").eq(
        "habit_id", habit["id"]
    ).order("completed_on", desc=True).limit(365).execute().data

    dates = {date.fromisoformat(r["completed_on"]) for r in rows}
    streak, cursor = 0, date.today()
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)

    return f"Checked off '{habit['title']}' — {streak} day streak."


def get_meal_plan(sb, weekday: str = None, days_from_today: int = None,
                  whole_week: bool = False):
    q = sb.table("meal_plan_entries").select(
        "planned_date, meal_type, recipes(name)"
    ).order("planned_date")

    if whole_week and not weekday and days_from_today is None:
        # Sunday-based week, same convention as habits.weekdays.
        start = date.today() - timedelta(days=(date.today().weekday() + 1) % 7)
        q = q.gte("planned_date", start.isoformat()).lt(
            "planned_date", (start + timedelta(days=7)).isoformat()
        )
        label = "this week"
    else:
        day = resolve_day(days_from_today, weekday)
        q = q.eq("planned_date", day.isoformat())
        label = "today" if day == date.today() else day.strftime("%A, %b %d")

    rows = q.execute().data
    if not rows:
        return f"Nothing planned for {label}."

    if whole_week:
        by_day = {}
        for r in rows:
            d = date.fromisoformat(r["planned_date"]).strftime("%a")
            by_day.setdefault(d, []).append(f"{r['meal_type']}: {r['recipes']['name']}")
        parts = [f"{d} — {', '.join(meals)}" for d, meals in by_day.items()]
        return "This week: " + "; ".join(parts) + "."

    meals = ", ".join(f"{r['meal_type']}: {r['recipes']['name']}" for r in rows)
    return f"For {label} — {meals}."


def move_grocery_list_to_fridge(sb, only_checked: bool = False):
    q = sb.table("grocery_items").select("id, ingredient_id, quantity, unit, custom_name, ingredients(name)")
    if only_checked:
        q = q.eq("checked", True)
    items = q.execute().data

    if not items:
        return "Your grocery list is empty." if not only_checked else "Nothing on your list is checked off."

    # Free-text entries have no ingredient_id, so they can't become fridge
    # rows — fridge_items requires a catalog ingredient.
    movable = [i for i in items if i["ingredient_id"]]
    skipped = [i["custom_name"] for i in items if not i["ingredient_id"]]

    if movable:
        # Same rule as add_fridge_item: shopping adds to the fridge rather
        # than replacing what's in it. One read for the whole fridge, so this
        # stays a single round trip regardless of list length.
        current = (
            sb.table("fridge_items")
            .select("ingredient_id, quantity, unit")
            .eq("user_id", sb.uid)
            .execute()
            .data
        )
        by_ingredient = {r["ingredient_id"]: r for r in current}

        rows = []
        for i in movable:
            total, total_unit, _ = combine_amount(
                by_ingredient.get(i["ingredient_id"]), i["quantity"] or 0, i["unit"]
            )
            rows.append(
                {
                    "user_id": sb.uid,
                    "ingredient_id": i["ingredient_id"],
                    "quantity": total,
                    "unit": total_unit,
                }
            )

        sb.table("fridge_items").upsert(
            rows, on_conflict="user_id,ingredient_id"
        ).execute()

        # Clear what we moved; anything skipped stays on the list.
        sb.table("grocery_items").delete().in_(
            "id", [i["id"] for i in movable]
        ).execute()

    names = ", ".join(i["ingredients"]["name"] for i in movable)
    msg = f"Moved {len(movable)} item(s) to your fridge: {names}."
    if skipped:
        msg += f" Left on the list (not in the ingredient catalog): {', '.join(skipped)}."
    return msg


def plan_meal(sb, recipe_name: str, days_from_today: int, meal_type: str):
    matches = find_recipes(sb, recipe_name)
    if not matches:
        return f"I couldn't find a recipe called '{recipe_name}'."
    if len(matches) > 1:
        return clarify(
            f"Which {recipe_name} did you want to plan?",
            [m["name"] for m in matches],
            field="recipe_name",
        )

    recipe = matches[0]

    # Clamp — the model occasionally produces absurd offsets
    days = max(0, min(int(days_from_today), 30))
    planned = date.today() + timedelta(days=days)

    sb.table("meal_plan_entries").upsert(
        {
            "user_id": sb.uid,
            "recipe_id": recipe["id"],
            "planned_date": planned.isoformat(),
            "meal_type": meal_type,
        },
        on_conflict="user_id,planned_date,meal_type",
    ).execute()

    return f"Planned {recipe['name']} for {meal_type} on {planned.strftime('%A, %b %d')}."


def to_app_time(value: str):
    """
    Habit times the way the app stores them: "6:00 PM".

    The app writes date-fns format(t, "h:mm aa") and reads it back with the
    same pattern, so a 24-hour "18:00" parses as Invalid Date. That becomes
    NaN minutes, and the reminder builder drops any habit whose time is NaN —
    the habit is created but never notifies. Returns None if unparseable, so
    the caller can store no time rather than a broken one.
    """
    text = (value or "").strip().upper()
    for fmt in ("%H:%M", "%I:%M %p", "%I:%M%p"):
        try:
            parsed = datetime.strptime(text, fmt)
        except ValueError:
            continue
        # Built by hand: the %-I / %#I strftime flag for an unpadded hour
        # differs between platforms, and this server runs on Windows.
        hour = parsed.hour % 12 or 12
        meridiem = "AM" if parsed.hour < 12 else "PM"
        return f"{hour}:{parsed.minute:02d} {meridiem}"
    return None


def create_habit(sb, name: str, reminder_time: str = None) -> str:
    # Column names differ from the tool's parameter names:
    #   title / time / weekdays  (not name / reminder_time / days_of_week)
    # "remind me to stretch at 6pm" twice should not leave two Stretch habits.
    # Matched case-insensitively because the model recapitalises freely.
    existing = sb.table("habits").select("id, title, time").eq(
        "active", True
    ).execute().data or []
    for habit in existing:
        if (habit.get("title") or "").strip().lower() == name.strip().lower():
            when = f" at {habit['time']}" if habit.get("time") else ""
            return f"You already have a habit called '{habit['title']}'{when}."

    row = {"user_id": sb.uid, "title": name, "frequency": "daily", "active": True}

    stored_time = to_app_time(reminder_time) if reminder_time else None
    if stored_time:
        row["time"] = stored_time

    sb.table("habits").insert(row).execute()
    when = f" with a reminder at {stored_time}" if stored_time else ""
    return f"Created the habit '{name}'{when}."


def recommend_workout_plan(sb, goal: str = None) -> str:
    q = sb.table("workout_plans").select("name, duration_min, difficulty, target")
    if goal:
        q = q.contains("goal_tags", [goal])

    plans = q.limit(3).execute().data
    if not plans:
        return "No plans match that goal yet."

    lines = [
        f"{p['name']} — {p['duration_min']} min, {p['difficulty']}, {p['target']}"
        for p in plans
    ]
    return "Here's what fits: " + "; ".join(lines) + "."


def answer_wellness_question(sb, answer: str) -> str:
    return answer


def decline(sb, reason: str) -> str:
    if reason == "medical":
        return (
            "That's outside what I can advise on — worth asking a doctor or dietitian. "
            "I can help with your meals, workouts, and habits though."
        )
    return "I can help with workouts, meals, and habits. Want me to plan this week's meals?"


REGISTRY = {
    "find_cookable_recipes": find_cookable_recipes,
    "add_to_grocery_list": add_to_grocery_list,
    "add_fridge_item": add_fridge_item,
    "remove_fridge_item": remove_fridge_item,
    "complete_habit": complete_habit,
    "get_meal_plan": get_meal_plan,
    "move_grocery_list_to_fridge": move_grocery_list_to_fridge,
    "plan_meal": plan_meal,
    "create_habit": create_habit,
    "recommend_workout_plan": recommend_workout_plan,
    "answer_wellness_question": answer_wellness_question,
    "decline": decline,
}


# ---------------------------------------------------------------------
# AGENT LOOP
# ---------------------------------------------------------------------
# Enough turns to resolve a reference like "those ingredients" without
# growing the prompt — and the latency — on every message.
MAX_HISTORY_TURNS = 8


def history_messages(history):
    """
    Earlier turns as ONE system message, not as alternating chat turns.

    Context is needed so "add them to my fridge" has something to resolve
    against — the agent's own replies matter most, since they name the items
    being referred back to. But replaying them as `assistant` messages taught
    the model to answer in prose like those messages did, and it started
    emitting "Created the habit 'Stretch'..." as text instead of calling the
    tool. Folding them into a system block keeps the information and removes
    the pattern to imitate.
    """
    if not history:
        return []

    lines = []
    for turn in history[-MAX_HISTORY_TURNS:]:
        text = (turn.get("text") or "").strip()
        if not text:
            continue
        who = "Assistant" if turn.get("role") == "agent" else "User"
        lines.append(f"{who}: {text}")

    if not lines:
        return []

    return [{
        "role": "system",
        "content": (
            "Recent conversation, for resolving references only. These are "
            "past results, NOT examples of how to reply — you must still "
            "answer by calling exactly one tool.\n\n" + "\n".join(lines)
        ),
    }]


class AgentRequest(BaseModel):
    message: str
    jwt: str | None = None   # Pass 3: the app sends the real token here
    # Prior turns from the app, oldest first: [{"role": "user"|"agent", "text": ...}]
    history: list[dict] | None = None
    # Echoed back from a previous clarification: {tool, args, field}.
    # When present, `message` is the ANSWER to that question, not a new
    # request — so it skips the model and resumes the pending call.
    resume: dict | None = None


def execute(sb, name: str, args: dict):
    """Look up and run one tool. Returns (result, error_response)."""
    fn = REGISTRY.get(name)
    if fn is None:
        return None, {"ok": False, "error": "unknown_tool", "tool": name}
    try:
        return fn(sb, **args), None
    except TypeError as e:
        return None, {"ok": False, "error": "bad_arguments", "tool": name, "detail": str(e)}
    except Exception as e:
        # RLS denials, expired tokens, and schema mismatches land here
        return None, {"ok": False, "error": "execution_failed", "tool": name, "detail": str(e)}


def clarification_response(name: str, args: dict, pending: dict, done: list):
    """Package a pending question plus everything needed to resume it."""
    prefix = " ".join(d["reply"] for d in done)
    return {
        "ok": True,
        "completed": done,
        "needs_clarification": True,
        "reply": (prefix + " " + pending["question"]).strip(),
        "options": pending["options"],
        "resume": {"tool": name, "args": args, "field": pending["field"]},
    }


def ms_since(started: float) -> int:
    return round((time.perf_counter() - started) * 1000)


def timed_execute(timing: dict, sb, name: str, args: dict):
    """execute(), with its time added to the turn's running tool total."""
    started = time.perf_counter()
    try:
        return execute(sb, name, args)
    finally:
        timing["tool_ms"] = timing.get("tool_ms", 0) + ms_since(started)


def outcome_of(result: dict) -> str:
    if result.get("needs_clarification"):
        return "needs_clarification"
    if result.get("ok"):
        return "ok"
    return result.get("error", "error")


@app.post("/agent")
def run_agent(req: AgentRequest):
    """
    Every response carries `timing`: where this turn spent its time on the
    server. The app records it alongside its own end-to-end figure, and the
    gap between the two is the network and the tunnel — something neither
    side can measure alone.

    Also prints one line per turn, never including the message itself.
    """
    timing = {}
    started = time.perf_counter()
    result = handle_agent(req, timing)
    timing["server_ms"] = ms_since(started)
    result["timing"] = timing
    print(f"agent {outcome_of(result):<20} {timing}", flush=True)
    return result


def handle_agent(req: AgentRequest, timing: dict):
    jwt = req.jwt or (TEST_JWT if ALLOW_TEST_JWT else "")
    if not jwt:
        return {"ok": False, "error": "no_jwt", "detail": "Sign in and try again."}

    # Checked before the model is touched, not after.
    started = time.perf_counter()
    valid = verify_jwt(jwt)
    timing["auth_ms"] = ms_since(started)
    if not valid:
        return {"ok": False, "error": "bad_jwt", "detail": "Sign in and try again."}

    sb = client_for(jwt)

    # ---- Resuming a clarified call: no model involved -----------------
    # The model never saw the question it asked, so re-routing the answer
    # through it picks the wrong tool. Fill the named field and run.
    if req.resume:
        name = req.resume.get("tool")
        args = dict(req.resume.get("args") or {})
        field = req.resume.get("field")

        if field == "quantity":
            qty, unit = parse_amount(req.message)
            if qty is None:
                return {
                    "ok": True,
                    "needs_clarification": True,
                    "reply": "I need a number — how much?",
                    "options": [],
                    "resume": req.resume,
                }
            args["quantity"] = qty
            if unit:
                args["unit"] = unit
        elif field:
            args[field] = req.message.strip()

        result, err = timed_execute(timing, sb, name, args)
        if err:
            return err

        # A second question can follow the first (kind -> how much).
        if isinstance(result, dict) and result.get("needs_clarification"):
            return clarification_response(name, args, result, [])

        return {"ok": True, "completed": [{"tool": name, "args": args, "reply": result}], "reply": result}

    # ---- Normal path: let the model route ----------------------------
    started = time.perf_counter()
    response = ollama.chat(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            *history_messages(req.history),
            {"role": "user", "content": req.message},
        ],
        tools=TOOLS,
        think=False,
    )
    timing["model_ms"] = ms_since(started)

    calls = response["message"].get("tool_calls")
    if not calls:
        return {"ok": False, "error": "no_tool_call", "raw": response["message"].get("content", "")}

    done = []

    # The model may emit several calls at once ("I bought milk and eggs").
    # Run them in order; the first one that needs clarification stops the
    # rest, so we report what succeeded and then ask.
    for call in calls:
        name = call["function"]["name"]
        args = call["function"]["arguments"] or {}

        result, err = timed_execute(timing, sb, name, args)
        if err:
            return err

        if isinstance(result, dict) and result.get("needs_clarification"):
            return clarification_response(name, args, result, done)

        done.append({"tool": name, "args": args, "reply": result})

    return {
        "ok": True,
        "completed": done,
        "reply": " ".join(d["reply"] for d in done),
    }


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL}