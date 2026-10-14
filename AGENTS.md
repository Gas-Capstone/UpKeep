# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project Overview
- UpKeep: an Android-first wellness app (workouts, meals, habits).
- Expo SDK 57, Expo Router (typed routes), React 19 with React Compiler, TypeScript strict.
- UI: React Native Paper, plus small helper libraries.
- Backend: Supabase (auth + database).

# Commands
- `npx expo start`: dev server (uses the dev client, not Expo Go)
- `npx expo run:android`: rebuild the native app (only after adding native packages)
- `npm run lint` and `npx tsc --noEmit`: run both before finishing a task
- Add packages with `npx expo install <pkg>` so versions match SDK 57.
- Dev machine is Windows/PowerShell.

# Project Layout
- `src/app/`: routes only. Route files should be thin and just render a screen component
  (see `src/app/(tabs)/habits.tsx`). Groups: `(auth)`, `(tabs)`, `(subpages)`.
- `src/components/<feature>/`: screens (`*Screen.tsx`), modals (`*Modal.tsx`), and cards for each feature.
- `src/components/context/`: providers that own app data. All are mounted in `src/app/_layout.tsx`.
- `src/components/ui/`: shared UI (`ScreenView`, `CardMenu`, `CircleTimer`, etc.).
- `src/lib/`: data access and pure logic. Supabase queries go in `src/lib/supabaseFunctions.ts`
  or `src/lib/<feature>/`.
- `src/constants/theme.ts`: colors, spacing, radius, insets. `src/constants/paper-theme.ts`: Paper themes.
- Import with the `@/` alias (maps to `src/`).

# Data Conventions
- Flow: screen → context hook → `src/lib` function → Supabase. Screens shouldn't import `supabase` directly.
- New data for a feature goes in that feature's existing context, not in local screen state,
  so other screens (like the home tab) can read it.
- Don't use `any` or non-null `!` to silence type errors.
- Skip manual `useMemo`/`useCallback`. React Compiler will handle memoization.

# UI Conventions
- ALWAYS build UI with React Native Paper components as a base (`Text`, `Button`, `TextInput`,
  `Card`, `Portal`/`Modal`, `FAB`, etc.). Only use base React Native components when Paper has no equivalent.
- Get colors from the Paper theme (`useTheme()` from `react-native-paper`) or from `Colors[resolvedTheme]`
  via `useThemeMode()`. Never hard-code hex values.
- Use `Spacing`/`Radius` from `@/constants/theme` for layout values.
- Every new page MUST be wrapped in `ScreenView` (`src/components/ui/ScreenView.tsx`). Read it before using it:
  - It already provides safe-area handling, a vertical `ScrollView`, and bottom-tab padding.
    Don't add your own `SafeAreaView` or outer `ScrollView`, and don't put a vertical `FlatList` inside it.
  - Pass fixed page headers through the `header` prop.
  - Pass floating elements (FABs, modals) through the `overlay` prop.
  - Good examples: `HabitsScreen.tsx`, `MealPlanScreen.tsx`, `GroceryListScreen.tsx`.

# Don't Touch
- `_to_delete/`, `android/` (generated), `node_modules/`
- `doc-site/`, unless the task is about the docs site
- `.env`: never read, print, or commit it

# Verifying Changes
There are no automated tests. Run lint and the type-check, then list what to check manually on Android.
