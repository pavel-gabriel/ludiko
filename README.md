# Ludiko

Multiplayer math game for kids. Learn math by playing!

## Features

- Multiplayer rooms with join codes
- Romanian & English language support
- Dyslexia-friendly OpenDyslexic font toggle
- Configurable difficulty, operations, rounds & time
- Pastel kid-friendly UI with Nunito font

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS (pastel palette)
- Firebase (Firestore for rooms)
- Zustand (state management)
- i18next (internationalization)
- Vitest (testing)

## Getting Started

```bash
npm install
cp .env.example .env   # Add your Firebase config
npm run dev
```

## Testing

```bash
npm test
```

## Deployment

Push to `main` to auto-deploy to GitHub Pages via GitHub Actions.
