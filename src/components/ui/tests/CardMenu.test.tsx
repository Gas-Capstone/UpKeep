import { CardMenu, type CardMenuAction } from "@/components/ui/CardMenu";
import { render, screen, userEvent } from "@/test/render";

const label = "Recipe options";

function makeActions(
  overrides: Partial<CardMenuAction>[] = [{}],
): CardMenuAction[] {
  return overrides.map((override, index) => ({
    key: override.key ?? `action-${index}`,
    label: override.label ?? `Action ${index + 1}`,
    icon: override.icon ?? "pencil",
    onPress: override.onPress ?? jest.fn(),
    destructive: override.destructive,
    disabled: override.disabled,
  }));
}

describe("CardMenu", () => {
  test("renders nothing when there are no actions", async () => {
    await render(<CardMenu actions={[]} accessibilityLabel={label} />);

    expect(screen.queryByLabelText(label)).toBeNull();
  });

  test("shows the menu trigger for non-empty actions", async () => {
    await render(
      <CardMenu actions={makeActions()} accessibilityLabel={label} />,
    );

    expect(screen.getByLabelText(label)).toBeOnTheScreen();
  });

  test("calls the action onPress when a menu item is pressed", async () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const actions = makeActions([
      { key: "edit", label: "Edit", icon: "pencil", onPress: onEdit },
      {
        key: "delete",
        label: "Delete",
        icon: "delete",
        onPress: onDelete,
        destructive: true,
      },
    ]);

    await render(<CardMenu actions={actions} accessibilityLabel={label} />);

    const user = userEvent.setup();
    await user.press(screen.getByLabelText(label));

    // Paper Menu mounts items in a Portal after visible flips.
    const editItem = await screen.findByText("Edit");
    await user.press(editItem);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
