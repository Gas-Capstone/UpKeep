/// <reference types="jest" />

// global Jest env tweaks only
// custom render test is at src/test/render.ts
// add mocks here only when a test fails without them
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
