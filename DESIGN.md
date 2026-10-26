---
name: UpKeep
description: Rounded, supportive Android wellness UI with teal actions and subtle surface layers.
colors:
  brand-teal: "#1B9E96"
  strong-teal: "#167C76"
  aqua: "#4ACBC1"
  light-primary: "#167C76"
  light-on-primary: "#FFFFFF"
  light-primary-container: "#DFF4F1"
  light-on-primary-container: "#0A4642"
  light-secondary: "#1B9E96"
  light-secondary-container: "#E7F7F5"
  light-tertiary: "#4ACBC1"
  light-on-tertiary: "#062C29"
  light-tertiary-container: "#D6F7F3"
  light-background: "#F7FAF9"
  light-surface: "#FFFFFF"
  light-text: "#122321"
  light-text-secondary: "#607471"
  light-surface-variant: "#EAF4F2"
  light-on-surface-variant: "#536763"
  light-outline: "#82948F"
  light-border: "#D7E7E4"
  light-meals: "#B86A1B"
  light-success: "#2F7D5A"
  light-warning: "#A86117"
  light-error: "#B4232F"
  light-error-container: "#FDEBED"
  dark-primary: "#4ACBC1"
  dark-on-primary: "#062C29"
  dark-primary-container: "#0C5F59"
  dark-on-primary-container: "#D6F8F4"
  dark-secondary: "#75D9D2"
  dark-secondary-container: "#164E4A"
  dark-tertiary: "#A1E9E4"
  dark-tertiary-container: "#1C4F4A"
  dark-background: "#071A18"
  dark-surface: "#0D2421"
  dark-text: "#FAF7F2"
  dark-text-secondary: "#AEC2BE"
  dark-surface-variant: "#15332F"
  dark-outline: "#78918C"
  dark-border: "#294A45"
  dark-meals: "#F3B45A"
  dark-success: "#77C79A"
  dark-error: "#FF8A93"
  dark-error-container: "#64131D"
rounded:
  small: "10px"
  medium: "16px"
  large: "22px"
  pill: "999px"
spacing:
  half: "2px"
  one: "4px"
  two: "8px"
  three: "16px"
  four: "24px"
  five: "32px"
  six: "64px"
components:
  button-primary:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-on-primary}"
    rounded: "{rounded.pill}"
  button-tonal:
    backgroundColor: "{colors.light-secondary-container}"
    textColor: "{colors.light-on-primary-container}"
  button-outlined:
    textColor: "{colors.light-primary}"
  button-text:
    textColor: "{colors.light-primary}"
  timeline-card:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.large}"
    padding: "{spacing.three}"
  filter-chip-selected:
    backgroundColor: "{colors.strong-teal}"
    textColor: "{colors.light-on-primary}"
    rounded: "{rounded.pill}"
  navigation:
    backgroundColor: "{colors.light-surface}"
    rounded: "{rounded.large}"
---

# Design System: UpKeep

## Overview

**Creative North Star: "The Wellness Companion"**

UpKeep uses rounded components, teal actions, and subtle surface layers to organize everyday wellness. Strong headings separate sections; quieter text carries schedules and supporting details. Icons, completion marks, and progress indicators make state visible alongside labels.

Components feel rounded and supportive. Pale mint selections sit against light surfaces; dark mode uses deep green surfaces and brighter aqua accents. This captures the existing implementation, with plain, functional language chosen by the project owner.

**Key Characteristics:**

- Teal and aqua identity, with theme-specific foregrounds.
- Rounded cards, pill actions, and compact icon containers.
- Bold headings with quieter supporting text.
- Subtle layers that separate controls and content.
- Shared spacing and screen framing across feature screens.

Evidence: `src/constants/theme.ts`, `src/constants/paper-theme.ts`, `src/constants/styles.ts`, `src/components/ui/ScreenView.tsx`, `src/components/app-tabs.tsx`, and the components cited below. Captured on October 22, 2026 from the working tree. Native screenshots were not verified: ADB could not initialize its user directory. This is documentation, not a redesign or an accessibility certification. Browser component samples in `.impeccable/design.json` are illustrative translations of native patterns, not Android rendering evidence.

The frontmatter records a reusable subset of implemented tokens. Its `px` dimensions are portable representations of React Native layout numbers: use dp-equivalent numbers for layout and scalable native text roles in application code. Theme-qualified color keys distinguish modes; component frontmatter shows light-mode examples. The TypeScript constants remain the implementation authority; update this document when those sources change. Paper typography is intentionally omitted from frontmatter because the app inherits the library's MD3 font configuration rather than defining a separate font scale.

## Colors

Strong teal, brand teal, and aqua form the identity; pale mint and deep green surfaces separate selections, cards, and page backgrounds.

### Primary

- **Strong teal:** `Brand.tealStrong`; Paper's light `primary`, used for prominent actions with `onPrimary` text.
- **Aqua:** `Brand.aqua`; Paper's dark `primary`, paired with its dark green `onPrimary` foreground.
- **Selection containers:** Paper's `primaryContainer` and `onPrimaryContainer` are paired roles. `Colors.brandSoft` is the existing custom selection fill; in dark mode it differs from Paper's primary container.

### Secondary

- **Brand teal:** Paper's light `secondary`; also the logo-derived `Brand.teal` and light `Colors.brand` accent.
- **Soft aqua:** Paper's dark `secondary`, also used by dark habit accents. Tonal buttons inherit Paper's secondary container and foreground roles.

### Tertiary

- **Aqua highlights:** Paper's tertiary roles add a brighter teal family, with their own foreground/container pairings.
- **Warm amber:** `Colors.accentMeals`; a feature accent rather than a replacement for Paper's tertiary role. Workouts and habits use their named feature tokens; warning, success, and danger remain semantic status colors. Dark warning currently shares the meals accent value.

### Neutral

- **Light surfaces:** pale green-white page background, white cards, muted green-gray supporting text, and soft green borders.
- **Dark surfaces:** deep green background, a lighter deep green card surface, warm-white primary text, and pale green-gray supporting text.
- `Colors.textSecondary` and Paper's `onSurfaceVariant` are distinct in light mode. Match the API used by the component instead of assuming every near-equivalent role is interchangeable.

**The Paired Roles Rule.** Read colors from Paper's `useTheme()` or `Colors[resolvedTheme]` through `useThemeMode()`. Pair fills with the matching foreground role; never copy a light-theme foreground into dark mode.

ThemeContext persists `light`, `dark`, or `system`. `src/hooks/use-theme.ts` returns the resolved custom palette; it is a different API from Paper's `useTheme`. `src/global.css` bridges the identity into NativeWind/Gluestack; it does not replace Paper's complete semantic palette. Wallpaper-derived dynamic color is not implemented in these theme files.

## Typography

Paper `Text` variants provide the primary hierarchy. Both Paper themes spread the default MD3 theme and do not override `fonts`. No app font-loading or custom `configureFonts` setup was found. Android therefore uses Paper's platform font defaults rather than a separately chosen brand typeface.

- **Display:** `CircleTimer` defaults to `displaySmall`; callers may supply a smaller `labelVariant` for compact rings.
- **Headline:** Habits uses `headlineMedium`, with a local weight of 900 and tighter tracking. Meals also uses a heavy title treatment.
- **Title:** `titleLarge` emphasizes daily progress and section headings; `titleMedium` labels timeline items. Common local emphasis is 800–900.
- **Body:** `bodyMedium` carries descriptions; `bodySmall` carries times, schedules, and secondary details.
- **Label:** `labelSmall` through `labelLarge` carry tags, date labels, and percentages. Uppercase is used for some metadata, not all body copy.
- **Navigation exception:** the custom bottom bar sets a local label size (10), line height (13), and focused/unfocused weights (700/500).

`ThemedText` is a legacy parallel scale: default (16/24, weight 500), small (14/20, weight 500), smallBold (14/20, weight 700), subtitle (32/44, weight 600), and title (48/52, weight 600). These are font-size/line-height pairs from `src/components/themed-text.tsx`, not a replacement Paper theme. Home also has local numeric styles. Preserve existing call sites during unrelated work; use Paper variants for new UI per AGENTS.md.

## Layout

**The Screen Frame Rule.** New screens use `ScreenView`. Put fixed headers in `header` and floating UI in `overlay`; the component owns safe-area handling, vertical scrolling, and bottom clearance.

- Shared content is centered at `MaxContentWidth` (800) and fills the available narrower width. This is a width cap, not evidence of a tablet-specific navigation layout.
- Standard content side padding uses `Spacing.four`; shared vertical gaps use `Spacing.three`. Timeline rows use `Spacing.two` between cards.
- The spacing names are deliberately non-linear. Import the named constants; do not infer a multiplier from their names.
- ScreenView scroll padding at the bottom is `BottomTabInset` (76) plus the device bottom inset plus `Spacing.four`. Its top padding is `Spacing.three` with a header, otherwise `TopBadgeInset` (currently also `Spacing.three`).
- The bottom bar has horizontal outer padding of `Spacing.three`; bottom clearance is `max(deviceInset, Spacing.two) + TabBarFloatMargin` (12).
- AddHabitModal uses a bottom-aligned sheet with outer `Spacing.three`, capped at 90% height, and a scrollable form body between its header and actions.
- Expanded-width navigation rail/drawer behavior is not established in the current tab implementation. Do not describe it as shipped.

## Elevation & Depth

Most feature cards separate content with surface fill, hairline borders, and spacing. Floating navigation uses Paper `Surface` at elevation 2. Menus and dialogs inherit Paper behavior but explicitly use surface fills and subtle outline borders. Depth supports separation rather than decorative shadow stacks.

Both themes replace Paper elevation colors at levels 0–5 with teal-leaning surfaces. Level 0 is transparent; level 1 matches the card surface. Higher levels form a subtle tonal progression. Exact light/dark level values are recorded in the sidecar; native shadow rendering remains Paper's responsibility, with no app-wide custom shadow scale established here.

`CircleTimer` animates progress over 400 ms by default with cubic-out easing. This is component behavior, not a universal motion token. Reduced-motion behavior and device smoothness were not visually verified.

## Shapes

`Radius.small` shapes compact icon containers; `medium` shapes secondary containers, menu panels, and date buttons; `large` shapes prominent cards, sheets, dialogs, and the floating tab bar. `pill` shapes primary actions, badges, and filter chips. Paper's `roundness` remains 4; that is a component shape multiplier and is not equivalent to setting every corner to four layout units.

Hairline borders recur around cards, menus, and the bottom bar. They use `StyleSheet.hairlineWidth`, not an assumed fixed CSS pixel width. Some component-local geometry remains: the timeline checkbox is 30 square with radius 9; the empty-state icon sits in a circular container. These are existing local details, not additional shared radius tokens.

## Components

### Buttons

Use Paper `Button` with `contained`, `contained-tonal`, `outlined`, or `text` modes according to action hierarchy. Habits' primary add action is pill-shaped with a minimum content height of 50; confirmation actions also use pill corners. Paper supplies loading, disabled, ripple, and focus behavior. Reuse existing component APIs instead of introducing web hover semantics into native screens.

### Cards and daily timeline

`HabitCard` is a rounded, bordered row with `Spacing.three` padding and gap, a minimum height of 86, a completion control, two-line title, time/schedule metadata, optional feature tag, and `CardMenu`. Completion changes the border and checkbox fill to the brand accent, strikes through the title, and lowers its opacity to 0.68. The shared timeline renders habits, meals, and workouts through this pattern.

The progress summary and empty state share large corners and quiet borders. Empty states combine an icon, title, and short explanatory copy. `CircleTimer` uses the primary color for progress and surfaceVariant for its track.

### Inputs / Fields

Use Paper `TextInput`, typically outlined, with labels and validation appropriate to the form. AddHabitModal explicitly maps its idle outline to `Colors.border` and focused outline to `Colors.brand`. Retain Paper error/disabled semantics. Paper `Searchbar` supports ingredient and fridge lookup.

The legacy `ui/Input` wraps React Native TextInput with a bordered surface, medium corners, minimum height 48, and local font size 16. The assistant composer also has custom input geometry and keyboard handling. Neither establishes a requirement for new screens to bypass Paper or ScreenView.

### Chips and date selection

Paper ingredient chips use background/outline at rest and `backgroundSelected`/brand outline when selected, plus a check mark and stronger label weight. `WorkoutFilterChip` is a custom pill with minimum height 36, horizontal padding 14, a filled selected state, and pressed opacity 0.8. These are distinct existing patterns.

`WeekStrip` holds seven equal-width date controls inside a large rounded border. Each date control has medium corners and minimum height 58, with label, date number, and a dot for today. Selection fills the control; accessibility state records the selected date independently of the today marker.

### Navigation

`AppTabs` uses Expo Router UI with Paper Surface, TouchableRipple, Icon, and Text. The visible destinations are Home, Workouts, Meals, Habits, and Profile. Grocery list, Assistant, and My fridge are registered hidden tab triggers, not additional visible bar items.

The floating bar has large corners, a hairline outline, minimum height 64, and equal-width items with a minimum inner height of 50. Active items receive a primary-container icon pill and primary label/icon color. Supported outline icons switch to filled variants when focused. Inactive items use `onSurfaceVariant`. Keep destination labels and accessible native navigation behavior.

### Menus, sheets, and confirmations

`CardMenu` pairs a labeled Paper IconButton anchor with Menu items, medium corners, and a hairline border. It renders nothing when no actions exist; destructive actions use the error role for icon and title, and the menu closes before the action executes.

`ConfirmDialog` uses Portal/Dialog, large corners, surface/outline styling, and a bold title. Loading disables dismissal and actions; errors appear inline. Destructive confirmation uses error/onError. AddHabitModal separates its scrollable form from header and action rows with quiet dividers.

### Existing exceptions to keep visible

Hard-coded white foregrounds remain in HabitCard, WeekButton, and some custom actions; grocery errors use a local literal; ThemedText has a legacy fixed link color. The timeline checkbox is 30 square without an enlarged hit area in its own style, and filter chips are 36 high. These are not proof of contrast or 48 dp touch-target compliance. Keep new work aligned with AGENTS.md and Android touch/accessibility guidance instead of reproducing exceptions as system rules. This documentation does not change those components.

## Do's and Don'ts

### Do:

- Do use Paper components as the base for new UI.
- Do use resolved theme roles and matching foreground/background pairs.
- Do import Spacing and Radius for shared layout and shape values.
- Do use ScreenView's header and overlay slots for new screens.
- Do preserve labels, completion marks, and accessible state alongside color.
- Do check light/dark themes, larger system text, keyboard clearance, and touch targets on Android.

### Don't:

- Don't copy legacy hard-coded colors or undersized touch targets into new components.
- Don't add another outer vertical ScrollView or SafeAreaView inside ScreenView, or nest a vertical FlatList in it.
- Don't treat Paper roundness as the shared Radius scale.
- Don't present browser sample rendering as native screenshot verification.
- Don't claim tablet navigation, dynamic wallpaper color, or universal reduced-motion support is implemented without checking the relevant code.
