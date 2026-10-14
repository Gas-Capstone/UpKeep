import { createContext, useContext, useEffect } from "react";
import { useObserve } from "expo-observe";

// Shared with screens so TTI is recorded after the native splash disappears.
export const StartupContext = createContext(false);

export function useScreenInteractive(ready = true) {
  const splashHidden = useContext(StartupContext);
  const { markInteractive } = useObserve();

  useEffect(() => {
    if (splashHidden && ready) markInteractive();
  }, [splashHidden, ready, markInteractive]);
}
