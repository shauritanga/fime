# Fime

Fime is an offline-first personal finance app built with Expo Router, React Native, and SQLite. It helps track income, expenses, budgets, goals, subscriptions, loans, recurring transactions, and CSV exports from local device data.

## Features

- Local account gate with phone/password login and profile editing
- Profile avatar support using the device image library
- Transaction entry and transaction history
- Dashboard with balance, income, savings, budget usage, charts, and recent activity
- Budget limits with progress tracking
- Savings goals, subscriptions, loans, and recurring transactions
- CSV export for locally stored transactions
- Shared draggable bottom sheets for creation/edit flows

## Tech Stack

- Expo SDK 56
- Expo Router
- React 19 and React Native 0.85
- TypeScript
- Expo SQLite for finance data
- Expo SecureStore and Crypto for local auth/session data
- Expo Image Picker for profile photos
- React Native SVG for charts

## Getting Started

Install dependencies:

```sh
npm install
```

Start the Expo dev server:

```sh
npm run start
```

Run on web:

```sh
npm run web
```

Run native builds:

```sh
npm run ios
npm run android
```

## Project Structure

- `app/` - Expo Router screens and route groups
- `app/(auth)/` - login and registration screens
- `app/(tabs)/` - main app tabs and dashboard
- `app/(tabs)/insights/` - More menu tools: budgets, goals, loans, subscriptions, recurring, analytics, export
- `components/` - shared UI, charts, transaction cards, and bottom sheet
- `lib/auth/` - local auth/profile/session provider
- `lib/finance/` - SQLite schema, finance operations, types, formatting, seed data, and hooks
- `constants/theme.ts` - shared color, spacing, and radius tokens

## Local Data Model

Fime currently stores data locally on the device:

- Finance data lives in SQLite database `fime.db`.
- Auth/profile/session data is stored through SecureStore on native platforms.
- Web falls back to `localStorage` for local auth/profile/session state.

There is no backend account sync in this version.

## Development Notes

Typecheck the app with:

```sh
npx tsc --noEmit
```

Expo SDK 56 versioned docs should be used when changing Expo APIs:

https://docs.expo.dev/versions/v56.0.0/

## Git Remote

Repository:

```sh
git@github.com:shauritanga/fime.git
```
