# Upkeep agent server

A small FastAPI service that lets the app's assistant take real actions —
planning meals, adding to the grocery list, creating habits — by turning a
user's message into a validated tool call against Supabase.

The model runs locally through Ollama. It never sees credentials: it only
proposes a tool call, and this server validates and executes it under the
**user's own JWT**, so your RLS policies decide what it can touch.

## Setup

### 1. Ollama and the model

Install [Ollama](https://ollama.com), then pull the base model:

```
ollama pull qwen3:8b
```

The server defaults to a tuned variant named `qwen3-upkeep`. To create it,
start the model and save it with a larger context window:

```
ollama run qwen3:8b
>>> /set parameter num_ctx 8192
>>> /save qwen3-upkeep
>>> /bye
```

The tool schemas and system prompt are long, so the default context is tight.
If you skip this step, set `MODEL=qwen3:8b` in your `.env` instead.

> The server already passes `think=False` on every call, so no model-side
> thinking setting is needed.

### 2. Python dependencies

```
pip install -r requirements.txt
```

### 3. Environment

```
cp .env.example .env
```

Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the Supabase dashboard,
and the email and password of a **throwaway** test user you created there.

### 4. A token for testing

```
python get_token.py
```

Paste the printed token into `.env` as `TEST_JWT`. It expires after about an
hour — re-run this when calls start failing with an auth error.

This is only for hitting the server directly. The app sends its own token.

### 5. Run it

```
uvicorn agent_server:app --reload --port 8000 --host 0.0.0.0
```

`--host 0.0.0.0` matters: without it uvicorn binds to localhost only and your
phone can't reach it. Interactive docs are at `http://localhost:8000/docs`.

## Connecting the app

Set `EXPO_PUBLIC_AGENT_URL` in the **app's** `.env` (repo root). Normally this
is the tunnel, which works from anywhere and does not change:

```
EXPO_PUBLIC_AGENT_URL=https://agent.upkeep.day
```

See TUNNEL.md for how that is set up.

For local work against a server on your own network, use its LAN address
instead — `ipconfig` on Windows, `ifconfig` on macOS, or `http://10.0.2.2:8000`
on the Android emulator. That address changes whenever the machine reconnects,
and it only works if uvicorn is bound with `--host 0.0.0.0`; bound to
`127.0.0.1` it is reachable through the tunnel only.

Two things that commonly block the phone from reaching the server:

- **Windows Firewall** prompts the first time uvicorn binds. Allow it on
  private networks.
- **Android blocks cleartext HTTP** by default from Android 9 onward. If the
  app reports the assistant as unavailable while `curl` from the machine
  works, add `expo-build-properties` with `android.usesCleartextTraffic: true`
  and make a new development build. HTTPS through a tunnel avoids this
  entirely.

## A note on secrets

`.env` is gitignored and must stay that way — it holds a real user password
and a live token. `.env.example` is the shared template.

Deleting a committed `.env` in a later commit does **not** remove it from git
history. If one was ever committed, rotate that user's password and treat the
old one as burned.
