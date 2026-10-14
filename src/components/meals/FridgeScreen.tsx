/**
 * FridgeScreen — everything you have, and everything you could add, in one
 * searchable list.
 *
 * Replaces the old three-mode modal (list -> picker -> quantity form). There
 * are no modes here: what you already have floats to the top, the rest sits
 * below grouped by category, and one pinned search box filters both.
 *
 * Edits save as you go. A page has no "close" moment the way a modal did, so
 * holding changes behind a Save button would mean losing them to a stray back
 * gesture.
 *
 * Quantities are edited in a dialog rather than an input sitting in the row.
 * Two reasons: a row cannot fit a name, a field and a unit as long as "170g
 * container" at phone width, and a dialog floats above the keyboard, which an
 * inline field inside ScreenView's ScrollView cannot do under Android
 * edge-to-edge.
 */

import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Portal,
  Searchbar,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { useMealsData } from "@/components/context/mealsDataContext";
import { Center } from "@/components/ui/center";
import { ScreenView } from "@/components/ui/ScreenView";
import { Colors, Radius, Spacing, TopBadgeInset } from "@/constants/theme";
import {
  FridgeEntry,
  Ingredient,
  groupIngredientsByCategory,
} from "@/lib/meals/meals";

// Quantities are fractional (half a pound of beef), so the floor is one
// hundredth rather than one.
const MIN_QUANTITY = 0.01;
const DEFAULT_QUANTITY = 1;

// Long enough to batch a burst of taps into one write, short enough that
// leaving the screen straight afterwards still lands.
const SAVE_DEBOUNCE_MS = 600;

/** Digits, at most one decimal point, at most two decimal places. */
function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

/**
 * "4 lb", but "1 × 170g container".
 *
 * Some units in the catalog are themselves a measurement ("170g container",
 * "1/2 cup"), so plain juxtaposition runs two numbers together and reads as
 * one — "1 170g container". A times sign separates the count from the unit
 * wherever the unit starts with a digit.
 */
function formatAmount(entry: FridgeEntry): string {
  if (!entry.unit) return String(entry.quantity);
  const separator = /^\d/.test(entry.unit) ? " × " : " ";
  return `${entry.quantity}${separator}${entry.unit}`;
}

export default function FridgeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const {
    ingredients,
    fridgeEntries,
    catalogLoading,
    fridgeLoading,
    saveFridge,
  } = useMealsData();

  const [query, setQuery] = useState("");
  // null until the first edit. Until then the page reads straight from the
  // context, so a fridge that finishes loading after mount still shows up —
  // copying it into state on mount would either miss that or clobber edits
  // every time a save round-tripped.
  const [edits, setEdits] = useState<ReadonlyMap<string, FridgeEntry> | null>(
    null,
  );
  const draft = edits ?? fridgeEntries;

  // The row whose amount is being edited, plus the raw text of that field.
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [editText, setEditText] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The draft the pending timer is going to write. Only ever touched from
  // event handlers and effects — writing a ref during render is what React
  // Compiler forbids.
  const pendingDraft = useRef<ReadonlyMap<string, FridgeEntry> | null>(null);

  /** Apply an edit locally and queue the write behind the debounce. */
  const applyDraft = (next: ReadonlyMap<string, FridgeEntry>) => {
    setEdits(next);
    pendingDraft.current = next;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      pendingDraft.current = null;
      void saveFridge(next);
    }, SAVE_DEBOUNCE_MS);
  };

  // Walking off the screen mid-debounce would otherwise drop the edit.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!saveTimer.current) return;
        clearTimeout(saveTimer.current);
        saveTimer.current = null;

        const next = pendingDraft.current;
        pendingDraft.current = null;
        if (next) void saveFridge(next);
      };
    }, [saveFridge]),
  );

  const search = query.trim().toLowerCase();
  const matchesQuery = (ing: Ingredient) =>
    search === "" ? true : ing.name.toLowerCase().includes(search);

  // What you have, alphabetical, filtered by the same search box.
  const mine = [...draft.keys()]
    .map((id) => ingredients.find((ing) => ing.id === id))
    .filter((ing): ing is Ingredient => Boolean(ing))
    .filter(matchesQuery)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Everything else, grouped by category.
  const groups = groupIngredientsByCategory(
    ingredients.filter((ing) => !draft.has(ing.id) && matchesQuery(ing)),
  );

  const add = (ing: Ingredient) => {
    applyDraft(
      new Map(draft).set(ing.id, {
        quantity: DEFAULT_QUANTITY,
        unit: ing.unit ?? "",
      }),
    );
  };

  const remove = (id: string) => {
    const next = new Map(draft);
    next.delete(id);
    applyDraft(next);
  };

  const openEditor = (ing: Ingredient) => {
    const entry = draft.get(ing.id);
    setEditText(String(entry?.quantity ?? DEFAULT_QUANTITY));
    setEditing(ing);
  };

  const editParsed = Number(editText);
  const editValid =
    editText !== "" && Number.isFinite(editParsed) && editParsed >= MIN_QUANTITY;

  const commitEdit = () => {
    if (!editing || !editValid) return;
    const entry = draft.get(editing.id);
    if (entry) {
      applyDraft(
        new Map(draft).set(editing.id, { ...entry, quantity: editParsed }),
      );
    }
    setEditing(null);
  };

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.backgroundElement, borderColor: colors.border },
  ];

  const sectionLabelStyle = [
    styles.sectionLabel,
    { color: colors.textSecondary },
  ];

  const renderMine = (ing: Ingredient, index: number) => {
    const entry = draft.get(ing.id);
    if (!entry) return null;

    return (
      <View key={ing.id}>
        {index > 0 && <Divider />}
        <View style={styles.row}>
          <Text
            variant="bodyLarge"
            style={[styles.name, { color: colors.text }]}
          >
            {ing.name}
          </Text>

          <Button
            mode="outlined"
            compact
            icon="pencil-outline"
            onPress={() => openEditor(ing)}
            style={styles.amountButton}
            contentStyle={styles.amountButtonContent}
            accessibilityLabel={`Change amount of ${ing.name}, currently ${formatAmount(entry)}`}
          >
            {formatAmount(entry)}
          </Button>

          <IconButton
            icon="close"
            size={18}
            style={styles.trailingButton}
            iconColor={colors.textSecondary}
            onPress={() => remove(ing.id)}
            accessibilityLabel={`Remove ${ing.name} from fridge`}
          />
        </View>
      </View>
    );
  };

  const renderAvailable = (ing: Ingredient, index: number) => (
    <View key={ing.id}>
      {index > 0 && <Divider />}
      <View style={styles.row}>
        <View style={styles.availableCopy}>
          <Text variant="bodyLarge" style={{ color: colors.text }}>
            {ing.name}
          </Text>
          {ing.unit ? (
            <Text variant="labelMedium" style={{ color: colors.textSecondary }}>
              {ing.unit}
            </Text>
          ) : null}
        </View>

        <IconButton
          icon="plus"
          mode="contained-tonal"
          size={18}
          style={styles.trailingButton}
          onPress={() => add(ing)}
          accessibilityLabel={`Add ${ing.name} to fridge`}
        />
      </View>
    </View>
  );

  const showEmptySearch =
    search !== "" && mine.length === 0 && groups.length === 0;

  // fridgeLoading matters as much as the catalog: editing a half-loaded fridge
  // would build a draft that is missing rows, and the save would delete them.
  const loading =
    (catalogLoading && ingredients.length === 0) || (fridgeLoading && !edits);

  return (
    <ScreenView
      header={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <IconButton
              icon="arrow-left"
              size={24}
              style={{ margin: 0 }}
              onPress={() => router.navigate("/meals")}
              accessibilityLabel="Back to meals"
            />
            <Text
              variant="titleLarge"
              style={{ color: colors.text, marginLeft: Spacing.two, flex: 1 }}
            >
              My fridge
            </Text>
          </View>

          <Searchbar
            placeholder="Search ingredients"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ backgroundColor: colors.backgroundElement }}
          />
        </View>
      }
      overlay={
        <Portal>
          <Dialog
            visible={Boolean(editing)}
            onDismiss={() => setEditing(null)}
            style={[
              styles.dialog,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <Dialog.Title style={styles.dialogTitle}>
              {editing?.name}
            </Dialog.Title>
            <Dialog.Content>
              <TextInput
                mode="outlined"
                label="Amount"
                autoFocus
                selectTextOnFocus
                keyboardType="decimal-pad"
                value={editText}
                onChangeText={(text) => setEditText(sanitizeDecimal(text))}
                onSubmitEditing={commitEdit}
                returnKeyType="done"
                right={
                  editing?.unit ? (
                    <TextInput.Affix text={editing.unit} />
                  ) : undefined
                }
              />
              {!editValid && (
                <Text
                  variant="bodySmall"
                  style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
                >
                  Enter an amount greater than zero.
                </Text>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setEditing(null)}
                textColor={theme.colors.onSurfaceVariant}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={commitEdit}
                disabled={!editValid}
                style={styles.dialogSave}
              >
                Save
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      }
    >
      {loading ? (
        <Center style={{ paddingVertical: Spacing.five }}>
          <ActivityIndicator />
        </Center>
      ) : (
        <>
          <View>
            <Text variant="labelLarge" style={sectionLabelStyle}>
              In your fridge ({draft.size})
            </Text>

            {mine.length === 0 ? (
              <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
                {draft.size === 0
                  ? "Nothing in your fridge yet — add something from below."
                  : "Nothing in your fridge matches that search."}
              </Text>
            ) : (
              <View style={cardStyle}>{mine.map(renderMine)}</View>
            )}
          </View>

          {groups.map((group) => (
            <View key={group.category}>
              <Text variant="labelLarge" style={sectionLabelStyle}>
                {group.label}
              </Text>
              <View style={cardStyle}>{group.items.map(renderAvailable)}</View>
            </View>
          ))}

          {showEmptySearch && (
            <View style={styles.noResults}>
              <Icon
                source="magnify-close"
                size={28}
                color={colors.textSecondary}
              />
              <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
                No ingredients match &ldquo;{query.trim()}&rdquo;.
              </Text>
            </View>
          )}
        </>
      )}
    </ScreenView>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingHorizontal: Spacing.four,
    paddingTop: TopBadgeInset,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionLabel: {
    marginBottom: Spacing.two,
    textTransform: "uppercase",
  },
  card: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  // Takes the leftover width and wraps. It is the only flexible thing in the
  // row, so a long unit can push it onto a second line but never crush it
  // into the two-character column an earlier layout produced.
  name: {
    flex: 1,
  },
  // Never shrinks: the amount has to stay readable, since it is also the
  // control you tap to change it.
  amountButton: {
    flexShrink: 0,
    borderRadius: Radius.pill,
  },
  amountButtonContent: {
    paddingHorizontal: Spacing.two,
  },
  availableCopy: {
    flex: 1,
  },
  trailingButton: {
    margin: 0,
  },
  dialog: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    // The field autofocuses, so the keyboard is always up for this dialog.
    // Paper centres it in the full window, which edge-to-edge never shrinks,
    // leaving Cancel/Save behind the keyboard — these pin it near the top.
    marginTop: Spacing.six,
    marginBottom: "auto",
  },
  dialogTitle: {
    fontWeight: "800",
  },
  dialogSave: {
    borderRadius: Radius.pill,
  },
  hint: {
    marginTop: Spacing.two,
  },
  noResults: {
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
});
