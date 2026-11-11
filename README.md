# Unified Health Platform — Web & Electron Desktop Frontend

Standalone React + TypeScript + Vite + Tailwind CSS + Electron Desktop client for the Unified Health Platform (Patient Portal, BMDC Doctor Portal, Multi-Role Hospital/Facility Portal, and National DGHS Central Registry).

## Tech Stack
- **UI**: React 18 + TypeScript + Vite + Tailwind CSS
- **Typography & Design**: `IBM Plex Sans` + `IBM Plex Mono`, institutional emerald healthcare palette, zero-motion clinical UI
- **PDF Engine**: Client-side A4 clinical document & DGHS registry dossier generator (`jspdf`)
- **Desktop Packaging**: Electron (`electron/main.cjs`, `electron/preload.cjs`, `electron-builder.yml`) for Linux (`AppImage`, `tar.gz`) and Windows (`NSIS`)

## Quick Start

1. Install dependencies (optionally create a local `.env` with `VITE_API_BASE_URL=http://localhost:4000/api`, excluded from Git via `.gitignore`):
   ```bash
   npm install
   ```
2. Start the web development server (`http://localhost:5173`):
   ```bash
   npm run dev
   ```
3. Typecheck and build production bundle:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
4. Run or package Electron Desktop app:
   ```bash
   npm run electron:start
   npm run electron:dist:linux
   npm run electron:dist:win
   ```

## Security Notice
Never commit `.env`, `node_modules/`, `dist/`, `release/`, or any credentials. `.gitignore` is pre-configured to exclude all environment files, build outputs, and secrets.
