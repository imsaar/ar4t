# AR 4Box Tool
Four Box Assessment Tool to Visualize Team Potential & Performance

## Getting Started

### Prerequisites
- Node.js (v24 LTS recommended; see `.tool-versions`)
- pnpm (`npm install -g pnpm` or see [pnpm.io/installation](https://pnpm.io/installation))

### Installation
1. Clone the repository
2. Install dependencies:
```bash
pnpm install
```

### Available Scripts
In the project directory, you can run:

#### `pnpm start`
Runs the app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

#### `pnpm test`
Launches the test runner in interactive watch mode.

#### `pnpm run build`
Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for best performance.

### Desktop App (Electron)
The app can also be packaged as an installable desktop app via Electron (entry point: `public/electron.js`).

#### `pnpm run electron:dev`
Runs the CRA dev server and an Electron window together for local desktop development.

#### `pnpm run electron:dist`
Builds and packages an installable macOS app (`.dmg` and `.zip`) to the `dist` folder.

#### `pnpm run electron:dist:win`
Builds and packages a Windows installer (`.exe`, NSIS, x64 + arm64) to the `dist` folder. Can be built from macOS (cross-compiled), but the output is unsigned — Windows SmartScreen will warn on first run.

#### `pnpm run electron:pack`
Builds an unpacked macOS app directory (`dist/mac-arm64/`) without creating a `.dmg`/`.zip` — useful for quick local testing.

### Technologies Used
- React
- Tailwind CSS
- PostCSS
- Electron (desktop packaging)
