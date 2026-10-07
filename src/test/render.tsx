import { type ReactElement, type ReactNode } from "react";
import {
  render as rtlRender,
  type RenderOptions,
} from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { paperLightTheme } from "@/constants/paper-theme";

// fake phone-sized metrics to help with layout rendering
const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// ui sits under SafeAreaProvider and PaperProvider; shared helper
function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <PaperProvider theme={paperLightTheme}>{children}</PaperProvider>
    </SafeAreaProvider>
  );
}

// renders UI component(s) wrapped in Paper and SafeArea
export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export {
  screen,
  userEvent,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react-native";
