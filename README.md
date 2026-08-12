
# Upkeep: An open-source, low friction wellness app for Android
Upkeep is a wellness app designed to keep track of workouts, meals, and habits app, with the intention of being as easy to use as possible. The project is currently early in development.

## Create a dev build
##### Note: This guide assumes you have an Android device with debugging enabled, or an Android emulator already set up. Guides for this can be found in the [Expo Build Docs](https://docs.expo.dev/get-started/set-up-your-environment/?mode=development-build&buildEnv=local&platform=android&device=physical). Follow the Development Build guide.
#### Prerequisites
- Nodejs (LTS)
- JDK 17+
- Android 16+ SDK

1. Clone repo, and run install:
```bash
npm install
```
2. Install the build client:
```bash
npx expo install expo-dev-client
```
3. Plug in your Android device, or start your Android emulator, and build and run the app:
```bash
npx expo run:android
```
4. You won't need to build the app again, unless more Nodejs packages are installed. To run the server without rebuilding the app:
```bash
npx expo start
```
## Features
###  Current features
- Authentication via email/password
- After first login/registration, asks for information such as display name, profile pic, and date of birth then never asks again
- If it is your birthday, displays happy birthday message as an alert.
- Home page displaying information from the various pages in the app
- Workouts page with a list of workouts, and the ability to time each workout
	- Workouts can be set as complete via the timer page
	- Completed workouts can be viewed from this page
- Meal planner page keeps track of ingredients you currently have, and suggests meals to make
- Habits page allows you to create, schedule, and keep track of habits you want to keep
	- Habits can be scheduled for separate weekdays (i.e. only M/W/F)
 - Settings page allows changing of display name, profile picture, date of birth, and switch between light and dark modes
### Planned features
- Integrate habits page with backend
- Add ability to create custom recipes and workouts


## Known Issues
- Meals page may fail to load after login 
- Meals page rendering may break when you've gathered enough ingredients for a meal

### Tools used
- Built using [React Native](https://reactnative.dev/) and [Expo](https://docs.expo.dev/)
- [React Native Paper](https://reactnativepaper.com/): main frontend components
- [GluestackUI](https://gluestack.io/): additional styling components
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/): animation components
- [Supabase](https://supabase.com/): backend and database
