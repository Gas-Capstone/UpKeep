# UpKeep

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

UpKeep serves people more broadly who want to stay consistent with everyday wellness through one low-friction place for workouts, meals, and habits.

## Product Purpose

Help users plan and follow through on everyday wellness routines with as little effort as possible. Keep habits, workouts, and meals scheduled in one place so users can see and manage their day together.

Success means users can organize their routine and keep track of what they have completed without managing separate schedules for each activity.

## Positioning

UpKeep combines wellness planning and tracking across habits, workouts, and meals. Its existing Habits page brings all three into a shared daily timeline. A planning assistant is part of the product, and expanding its capabilities to help users plan is a confirmed priority.

This describes the product's mechanism and direction; no claim of market uniqueness has been established.

## Operating Context

- Android-first app used to plan and track daily wellness routines.
- Users can select a day, review habits, planned meals, and scheduled workouts together, and track completion in the Habits page.
- Supporting workflows include creating workout plans, timing and logging workouts, creating recipes, planning meals, managing fridge ingredients and a grocery list, and following recipe steps while cooking.
- The assistant offers a conversational entry point to managing wellness data. Existing app contexts refresh after assistant actions so its changes appear elsewhere in the app.
- Notifications include opt-in daily summaries and scheduled habit and meal reminders.

## Capabilities and Constraints

- Existing implementation: Expo SDK 57, Expo Router with typed routes, React 19 with React Compiler, strict TypeScript, React Native Paper, and Supabase authentication and database.
- Android development uses an Expo development client rather than Expo Go.
- Preserve unified scheduling across habits, meals, and workouts. The Habits page is already broader than habit tracking alone; future work must account for all three activity types.
- Improve the assistant's planning capabilities. The exact additional capabilities, their order, and the assistant's autonomy remain open decisions; this priority is not a claim that those capabilities already exist.
- Follow the repository's AGENTS.md for architecture, shared data ownership, native screen structure, theming, and verification requirements.
- An iOS or web-specific product strategy has not been confirmed. Configuration for those platforms does not change the Android-first product commitment.

## Brand Commitments

- Product name: UpKeep.
- Low-friction everyday wellness is the confirmed product intent.
- Existing logo asset: `assets/images/upkeep-logo.png`.
- A teal/aqua theme is established: `src/constants/paper-theme.ts` and `src/constants/theme.ts`.

## Evidence on Hand

- Audience and product priorities confirmed by the project owner during initialization.
- `README.md`: product overview and feature descriptions. Treat feature lists as supporting documentation and check the current implementation before relying on them; some entries are outdated.
- `src/components/habits/HabitsScreen.tsx`: shared daily timeline for habits, planned meals, and scheduled workouts, including completion tracking.
- `src/components/agent/AgentScreen.tsx`: assistant conversation interface and refresh of app data after assistant actions.
- `src/components/app-tabs.tsx`: primary destinations and access to supporting workflows.
- `app.json` and `package.json`: product identity, platform configuration, and implementation stack.
- No user research results, measured outcomes, testimonials, or comparative market evidence were supplied during initialization. Do not invent them.

## Product Principles

1. Keep everyday wellness easy to plan and maintain, especially for the primary college-student audience.
2. Treat habits, meals, and workouts as parts of one schedule, with coherent planning and completion across features.
3. Expand the assistant's ability to help users plan, with specific capabilities grounded in real workflows.
4. Keep shared wellness data consistent across the assistant, feature screens, and home overview.
5. Preserve Android-native usability and the established application architecture as the product grows.
