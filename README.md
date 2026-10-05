
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
	- Age is never typed in: it is worked out from your birthday everywhere it is used (profile, calorie goal), so it stays current. Older accounts that saved an age before this keep using it until a birthday is added
- If it is your birthday, displays happy birthday message as an alert.
- Home page displaying information from the various pages in the app
- Workouts page with a list of workouts, and the ability to time each workout
	- Workouts can be set as complete via the timer page
	- Completed workouts can be viewed from this page
   	- Users can create their own workout plans
- Meal planner page keeps track of ingredients you currently have, and suggests meals to make
  	- Users can create their own recipes
  	- Users can create a weekly mealplan
  	- Users can cook a recipe step by step: "Start cooking" on a recipe opens a checklist of its steps. Checked steps are saved on the device, so leaving the screen pauses cooking and the button changes to "Resume cooking". Checking every step shows a finished message, and "Done" clears the progress for next time
- Habits page allows you to create, schedule, and keep track of habits you want to keep
	- Habits can be scheduled for separate weekdays (i.e. only M/W/F)
 - Settings page allows changing of display name, profile picture, date of birth, and switch between light and dark modes
- Notifications, each turned on separately in Settings > Notifications
	- Daily summary of the day's planned habits and meals, at a time you choose
	- Habit reminders at each habit's scheduled time, skipping habits already checked off that day
	- Meal reminders for meals on your meal plan (breakfast 8:00 AM, lunch 12:00 PM, snack 3:00 PM, dinner 6:00 PM)
	- Reminders are scheduled a week ahead and refreshed whenever the app is opened or your habits/meal plan change
### Planned features
- Integrate habits page with backend
- Add more features to profile page such as name change, profile picture
- Add multiple themes

## Known Issues
- Meals page may fail to load after login 
- Meals page rendering may break when you've gathered enough ingredients for a meal

### Tools used
- Built using [React Native](https://reactnative.dev/) and [Expo](https://docs.expo.dev/)
- [React Native Paper](https://reactnativepaper.com/): main frontend components
- [GluestackUI](https://gluestack.io/): additional styling components
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/): animation components
- [Supabase](https://supabase.com/): backend and database
