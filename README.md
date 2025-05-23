# Four Box Assessment Tool
Visualize Team Potential & Performance - Available as both a web app and desktop application

## Overview
This tool helps managers assess and visualize team members' potential and performance using a four-quadrant grid. Features include:
- Interactive drag-and-drop positioning
- Trend arrows for performance tracking
- CSV import/export functionality
- Manager-based filtering
- Cross-platform desktop application

## Getting Started

### Prerequisites
- Node.js (v16 or higher recommended)
- npm (comes with Node.js)

### Installation
1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Development

### Web Application
#### `npm start`
Runs the React app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

#### `npm test`
Launches the test runner in interactive watch mode.

#### `npm run build`
Builds the web app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for best performance.

### Desktop Application (Electron)

#### Development Mode
```bash
# Start the React dev server first
npm start

# In another terminal, run Electron in dev mode
npm run electron-dev
```

#### Production Testing
```bash
# Build the React app first
npm run build

# Run Electron with the built files
npm run electron
```

## Building Desktop Applications

### Build for Current Platform
```bash
npm run electron-build
```

### Build for Specific Platforms
```bash
# Windows installer (.exe)
npm run build-win

# macOS installer (.dmg)  
npm run build-mac

# Build for both platforms
npm run build-all
```

### Build Outputs
- **Windows**: Creates an NSIS installer (.exe) in `dist/`
- **macOS**: Creates a DMG file (.dmg) in `dist/` with support for both Intel (x64) and Apple Silicon (arm64)

## Usage

### Web Version
- Access via browser at localhost:3000 (development) or deploy the build folder

### Desktop Version
- Install the appropriate installer for your platform
- Launch "Four Box Assessment Tool" from your applications

## Features

### Team Member Management
- Add team members with potential/performance scores (50-150 scale)
- Set trend indicators for future trajectory
- Assign managers for filtering
- Edit or remove existing members

### Visualization
- Interactive four-quadrant grid
- Drag team members to adjust scores
- Trend arrows show projected movement
- Color-coded team members
- Hover tooltips with detailed information

### Data Management
- Export team data to CSV
- Import team data from CSV (replaces existing data)
- Automatic local storage persistence
- Manager-based filtering

### Quadrant Interpretation
- **Top Right**: High Potential, High Performance (Stars)
- **Top Left**: High Potential, Lower Performance (Emerging Talent)
- **Bottom Right**: Lower Potential, High Performance (Solid Performers)
- **Bottom Left**: Lower Potential, Lower Performance (Development Needed)

## Technologies Used
- **Frontend**: React 19, Tailwind CSS
- **Desktop**: Electron
- **Build Tools**: React Scripts, Electron Builder
- **Data**: Local Storage, CSV Import/Export
