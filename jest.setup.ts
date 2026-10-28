/// <reference types="jest" />

// global Jest env tweaks only
// custom render test is at src/test/render.ts
// add mocks here only when a test fails without them
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
// ScreenView imports it; its native module doesn't exist under Jest.
jest.mock("react-native-keyboard-controller", () =>
  require("react-native-keyboard-controller/jest"),
);
