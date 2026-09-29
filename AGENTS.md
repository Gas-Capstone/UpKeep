# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project Conventions
- The project is a React Native project built using Expo
- The project uses React Native Paper alongside other helper libraries
- Supabase backend

# UI Conventions
- ALWAYS build UI components using React Native Paper components as a base. Do not use base React Native components unless necessary.
- There exists a ScreenView component in /src/components/ui/ScreenView.tsx. This acts as a wrapper for UI pages. When building a new UI page, always wrap it in ScreenView. View the code to understand how to use it.
