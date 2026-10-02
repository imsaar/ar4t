# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Four Box Assessment Tool — a React app for visualizing team members on a Potential vs. Performance 2x2 grid (classic 9-box/4-box talent matrix), with drag-to-reposition, trend arrows, manager filtering, and CSV import/export. All data persists to `localStorage` only; there is no backend (the `firebase` dependency in `package.json` is unused — do not wire it up without being asked). The app can optionally be packaged as a desktop app via Electron (see below); the Electron wrapper just loads the same CRA build in a native window and adds no backend/IPC logic.

## Commands

- `pnpm start` — run the dev server at http://localhost:3000 (sets `NODE_OPTIONS='--no-deprecation'`)
- `pnpm run build` — production build to `build/`
- `pnpm test` — run tests via `react-scripts test` (Jest, watch mode). To run a single test file non-interactively: `CI=true pnpm exec react-scripts test src/App.test.js`
- No lint script is defined; linting comes from `eslintConfig` (`react-app`, `react-app/jest`) via `react-scripts`.
- `pnpm run electron:dev` — run CRA dev server + Electron window together
- `pnpm run electron:dist` — package installable macOS app (`.dmg`/`.zip`) to `dist/`
- `pnpm run electron:dist:win` — package Windows installer (NSIS, x64+arm64) to `dist/`, cross-built from macOS
- The `typescript` devDependency exists solely to pin a version compatible with `@typescript-eslint` v5 (a transitive dep of `eslint-plugin-jest`/`eslint-config-react-app`) — this project has no TypeScript source.
- `pnpm-workspace.yaml` sets `publicHoistPattern: ['*eslint*']` (CRA's eslint-webpack-plugin integration needs hoisted eslint packages under strict pnpm linking) and `allowBuilds` (pnpm 12's install-script approval list).

## Architecture

The entire app lives in `src/App.js` (~600 lines, no sub-files, no router, no state library). It breaks down into:

- **Coordinate mapping** (`mapToSvgCoords` / `mapSvgToScores`): converts between potential/performance scores (range `MIN_VALUE`–`MAX_VALUE`, i.e. 50–150, centered on 100) and SVG pixel coordinates within a `GRID_SIZE`×`GRID_SIZE` viewBox. Any change to grid sizing, scoring range, or axis margins must update both directions consistently since dragging depends on the inverse mapping being exact.
- **CSV layer** (`CSV_HEADERS`, `escapeCsvValue`, `teamMembersToCsv`, `csvToTeamMembers`): hand-rolled CSV (not a library). Export emits only `CSV_HEADERS` (`name, potential, performance, trendPotential, trendPerformance, manager`) — `id` and `color` are intentionally excluded and auto-assigned on import (color cycles through `MEMBER_COLORS` by index, `id` is `imported_<timestamp>_<random>`). `potential`/`performance` are rounded to 2 decimal places on both import and export; trend values are not rounded. Import **replaces** all existing team data (it is not a merge). Import parsing is naive `split(',')` — it does not handle commas embedded in quoted fields.
- **Components** (all in the same file, top to bottom): `Tooltip`, `MemberVisualization` (one plotted member: dot + optional trend arrow + label), `GridDisplay` (the SVG grid: quadrant backgrounds, axes, ticks, renders all `MemberVisualization`s), `ControlsPanel` (add/edit member form, manager filter, CSV import/export buttons, member list with isolate/edit/remove), and `App` (top-level state owner).
- **State ownership**: `App` owns `teamMembers` and all selection/drag/filter state; it passes data and callbacks down as props (no context, no global store). Every mutation to `teamMembers` goes through a handler in `App` that updates state and then calls `saveDataLocally` to persist to `localStorage` under key `fourBoxTeamData`.
- **Dragging**: implemented via raw `mousedown`/`mousemove`/`mouseup` listeners on `window` (not React drag-and-drop), translating client coordinates into SVG space with `getScreenCTM().inverse()`, then into scores via `mapSvgToScores`. Position is only persisted to `localStorage` on `mouseup`, not during the drag.
- **Manager filtering**: `selectedManager` filters which members render on the grid (`filteredTeamMembersForGrid`) but does not affect the member list in `ControlsPanel`, which always shows all members.
- **Isolation (checkbox selection)**: `selectedMemberIds` dims (opacity) non-selected members on the grid rather than hiding them, so trends/positions of the full team stay visible for context.
- **User-facing error/success messages** are shown via manually created/appended `div` elements styled inline and auto-removed with `setTimeout` (no toast library, no modal component) — follow this existing pattern for consistency if adding new user-facing messages, rather than introducing a new UI primitive.

## Data files

`data/team_assessment_data.csv` and `data/empty_team_assessment_data.csv` are sample/template CSVs for manual testing of import, not consumed by the app at runtime.
