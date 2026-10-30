import { useDeferredValue, useState } from "react";
import { FlatList, Keyboard, ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Icon, Searchbar, Text, useTheme } from "react-native-paper";

import type { PlanWorkout } from "@/components/context/workoutsDataContext";
import { Radius, Spacing } from "@/constants/theme";
import { filterExercises, exerciseFilterOptions } from "@/lib/exercisePicker";
import { ExercisePickerRow } from "@/components/workouts/ExercisePickerRow";
import { ExerciseDetailsModal } from "@/components/workouts/workouttimer/ExerciseDetailsModal";

type ExercisePickerProps = {
  exercises: PlanWorkout[];
  selectedIds: string[];
  onToggle: (id: string) => void;
};

// Caching filter calculations
function useExerciseCatalog(exercises: PlanWorkout[], query: string, muscle: string, equipment: string) {
  "use memo";

  const muscles = exerciseFilterOptions(exercises, "muscle_group");
  const equipmentOptions = exerciseFilterOptions(exercises, "equipment");
  const matchingExercises = filterExercises(exercises, { query, muscle, equipment });
  return { muscles, equipmentOptions, matchingExercises };
}

export function ExercisePicker({ exercises, selectedIds, onToggle }: ExercisePickerProps) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [detailExercise, setDetailExercise] = useState<PlanWorkout | null>(null);
  const deferredQuery = useDeferredValue(query);
  const selected = new Set(selectedIds);
  const { muscles, equipmentOptions, matchingExercises } = useExerciseCatalog(
    exercises, deferredQuery, muscle, equipment,
  );
  const results = selectedOnly
    ? matchingExercises.filter((exercise) => selected.has(exercise.id))
    : matchingExercises;
  const hasFilters = Boolean(query || muscle || equipment || selectedOnly);

  const clearFilters = () => {
    setQuery("");
    setMuscle("");
    setEquipment("");
    setSelectedOnly(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <Searchbar
          placeholder="Search exercises"
          accessibilityLabel="Search exercises by name, muscle, or equipment"
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFiltersVisible(false)}
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.search}
        />
        <View style={styles.summary}>
          <Button
            compact
            icon="filter-variant"
            onPress={() => setFiltersVisible(!filtersVisible)}
            accessibilityState={{ expanded: filtersVisible }}
          >
            Filters{muscle || equipment ? ` (${Number(Boolean(muscle)) + Number(Boolean(equipment))})` : ""}
          </Button>
          <Chip
            selected={selectedOnly}
            onPress={() => setSelectedOnly(!selectedOnly)}
            accessibilityState={{ selected: selectedOnly }}
          >
            Show selected
          </Chip>
        </View>
        {filtersVisible && ([
          { label: "Muscle group", all: "All muscles", options: muscles, value: muscle, onChange: setMuscle },
          { label: "Equipment", all: "All equipment", options: equipmentOptions, value: equipment, onChange: setEquipment },
        ]).map((filter) => (
          <View key={filter.label} style={styles.filterGroup}>
            <Text variant="labelMedium">{filter.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
              {["", ...filter.options].map((option) => (
                <Chip
                  key={option}
                  selected={filter.value === option}
                  onPress={() => filter.onChange(option)}
                  accessibilityLabel={`${filter.label}: ${option || filter.all}`}
                  accessibilityState={{ selected: filter.value === option }}
                >
                  {option ? option.charAt(0).toUpperCase() + option.slice(1) : filter.all}
                </Chip>
              ))}
            </ScrollView>
          </View>
        ))}
        <View style={styles.summary}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {results.length} {results.length === 1 ? "result" : "results"}
            {muscle ? ` · ${muscle}` : ""}{equipment ? ` · ${equipment}` : ""}
          </Text>
          {hasFilters ? <Button compact onPress={clearFilters}>Reset</Button> : null}
        </View>
      </View>
      <FlatList
        key={`${deferredQuery}:${muscle}:${equipment}:${selectedOnly}`}
        data={results}
        extraData={selectedIds}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        renderItem={({ item }) => (
          <ExercisePickerRow
            exercise={item}
            checked={selected.has(item.id)}
            onToggle={onToggle}
            onViewDetails={(exercise) => {
              Keyboard.dismiss();
              setDetailExercise(exercise);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon source="magnify" size={28} color={theme.colors.onSurfaceVariant} />
            <Text variant="titleMedium">
              {exercises.length === 0 ? "No exercises available" : "No matching exercises"}
            </Text>
            <Text variant="bodyMedium" style={styles.emptyCopy}>
              {exercises.length === 0
                ? "The exercise catalog is empty. Try again later."
                : "Try another search or reset your filters to see more exercises."}
            </Text>
            {hasFilters ? <Button onPress={clearFilters}>Reset filters</Button> : null}
          </View>
        }
      />
      <ExerciseDetailsModal
        exercise={detailExercise ? {
          name: detailExercise.name,
          muscleGroup: detailExercise.muscle_group ?? null,
          equipment: detailExercise.equipment ?? null,
          instructions: detailExercise.instructions ?? null,
        } : null}
        onDismiss={() => setDetailExercise(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  controls: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.two },
  search: { borderRadius: Radius.medium },
  filterGroup: { gap: Spacing.one },
  chips: { gap: Spacing.two, paddingVertical: Spacing.one },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.two, flexWrap: "wrap" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.one },
  empty: { alignItems: "center", padding: Spacing.three, gap: Spacing.two },
  emptyCopy: { textAlign: "center" },
});
