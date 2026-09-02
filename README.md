# BaristaFlow Desktop

Electron Forge app that loads the **Frontend** React UI locally (no remote URL, no `<webview>`).

## Prerequisites

| Tool | Min version |
|------|-------------|
| Node.js | 18+ |
| npm / pnpm | latest |

## Quick Start

```bash
# 1. Install dependencies (Desktop)
cd Desktop
npm install

# 2. Build Frontend (production assets)
cd ../Frontend
npm install
npm run build          # outputs to Frontend/dist

# 3. Start Electron in dev mode (uses Vite dev server)
cd ../Desktop
cp .env.example .env   # adjust VITE_DEV_SERVER_URL if needed

# In one terminal – run Frontend dev server
cd ../Frontend && npm run dev

# In another terminal – run Electron
cd ../Desktop && npm start
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Launch Electron in dev mode (hot-reload via Vite) |
| `npm run package` | Create unpacked distributable |
| `npm run make` | Build installer (Squirrel for Windows, DMG/ZIP for macOS, DEB/RPM for Linux) |

## Project Structure

```
Desktop/
├─ electron/
│  ├─ main/
│  │  ├─ index.js         # Main process entry
│  │  └─ ipc/             # IPC handlers by domain (settings, printers, serial…)
│  └─ preload/
│     └─ index.js         # Context bridge exposing electronAPI
├─ assets/                # App icons & tray icon
├─ forge.config.js        # Electron Forge configuration
├─ package.json
└─ .env.example
```

## Security Highlights

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Preload exposes **whitelisted IPC only** via `contextBridge`
- Navigation restricted to local files / Vite dev server
- Electron Fuses enabled (RunAsNode disabled, cookie encryption, ASAR validation)

## Extending IPC

1. Create a new module in `electron/main/ipc/` (e.g., `serial.js`).
2. Export a `register(ipcMain, ...)` function.
3. Import and call in `electron/main/index.js` → `registerIpcHandlers()`.
4. Expose matching methods in `electron/preload/index.js`.
5. Add TypeScript types in `Frontend/src/types/electron.d.ts` for IntelliSense.

## Using electronAPI in the Renderer

```ts
// Frontend/src/someComponent.tsx
const printers = await window.electronAPI.getPrinters();
await window.electronAPI.print({ deviceName: printers[0].name, silent: true });
```

## Packaging for Production

```bash
# Build Frontend first
cd ../Frontend && npm run build

# Then make installer
cd ../Desktop && npm run make
```

Installers are output to `Desktop/out/make/`.

---

© 2024 BaristaFlow


<!-- Security scan triggered at 2026-08-31 16:22:46 -->

<!-- Security scan triggered at 2026-08-31 16:26:13 -->

<!-- Security scan triggered at 2026-08-31 18:08:27 -->

<!-- Security scan triggered at 2026-09-02 06:31:50 -->

<!-- Security scan triggered at 2026-09-02 06:38:54 -->