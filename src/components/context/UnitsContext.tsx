import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

import type { WeightUnit } from "@/lib/units";

type UnitsContextValue = {
  weightUnit: WeightUnit;
  setWeightUnit: (unit: WeightUnit) => void;
};

// Per device, like the theme: it's how this phone shows weights, and the
// stored data is in kilograms either way.
const WEIGHT_UNIT_STORAGE_KEY = "wellness-app-weight-unit";

const UnitsContext = createContext<UnitsContextValue>({
  weightUnit: "kg",
  setWeightUnit: () => {},
});

function isWeightUnit(value: string | null): value is WeightUnit {
  return value === "kg" || value === "lb";
}

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>("kg");

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(WEIGHT_UNIT_STORAGE_KEY)
      .then((stored) => {
        if (mounted && isWeightUnit(stored)) setWeightUnitState(stored);
      })
      .catch(() => {
        // Stay on kilograms if storage can't be read.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setWeightUnit = (unit: WeightUnit) => {
    setWeightUnitState(unit);
    AsyncStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, unit).catch(() => {
      // Keep the choice for this run even if it can't be saved.
    });
  };

  return (
    <UnitsContext.Provider value={{ weightUnit, setWeightUnit }}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useWeightUnit() {
  return useContext(UnitsContext);
}
