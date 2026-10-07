import { Text } from "react-native-paper";

import { ScreenView } from "@/components/ui/ScreenView";
import { render, screen } from "@/test/render";

describe("ScreenView", () => {
  test("renders children", async () => {
    await render(
      <ScreenView>
        <Text>Body content</Text>
      </ScreenView>,
    );

    expect(screen.getByText("Body content")).toBeOnTheScreen();
  });

  test("renders header when provided", async () => {
    await render(
      <ScreenView header={<Text>Page header</Text>}>
        <Text>Body content</Text>
      </ScreenView>,
    );

    expect(screen.getByText("Page header")).toBeOnTheScreen();
    expect(screen.getByText("Body content")).toBeOnTheScreen();
  });

  test("renders overlay when provided", async () => {
    await render(
      <ScreenView overlay={<Text>Floating action</Text>}>
        <Text>Body content</Text>
      </ScreenView>,
    );

    expect(screen.getByText("Floating action")).toBeOnTheScreen();
    expect(screen.getByText("Body content")).toBeOnTheScreen();
  });
});
