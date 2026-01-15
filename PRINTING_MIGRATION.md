# Printing System Migration Guide

## Overview

All printing functionality from `BaristaFlow-Desktop-app` has been migrated to the new `Desktop/` Electron app with enhanced security and maintainability.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      Frontend (React)                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Components:                                               │  │
│  │  - PrinterSettings.jsx (configure printers)                │  │
│  │  - ManagePrinter.jsx (category → printer mapping)         │  │
│  │                                                            │  │
│  │  Utils:                                                    │  │
│  │  - electronPrinter.js (unified printing interface)        │  │
│  │  - socket.js (print via socket events)                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          │                                        │
│                          │ window.electronAPI                     │
│                          ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Preload (electron/preload/index.js)                       │  │
│  │  - Exposes whitelisted IPC methods via contextBridge       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          │ IPC (invoke/handle)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Electron Main Process                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  electron/main/ipc/printers.js                             │  │
│  │  - printReceipt (cash receipts)                            │  │
│  │  - printOrderReceipt (kitchen orders)                      │  │
│  │  - printOrderReceiptMulti (multiple printers)              │  │
│  │  - printOrderReceiptToAll (broadcast)                      │  │
│  │  - printBarcodeLabel (thermal labels)                      │  │
│  │  - openDrawer (ESC/POS cash drawer)                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  electron/main/ipc/settings.js                             │  │
│  │  - Manages printer configuration persistence               │  │
│  │  - Provides settingsStore to other modules                 │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Printer Types

### 1. Cash Receipt Printers (Main Printers)
- **Config keys**: `mainPrinter`, `mainPrinter1`-`5`
- **Purpose**: Print customer receipts, shift summaries
- **Method**: `printReceipt(html, copies)`
- **Behavior**: Prints to **all** configured main printers

### 2. Kitchen/Order Printers
- **Config keys**: `orderPrinter1`-`6`
- **Purpose**: Print kitchen orders by category
- **Methods**:
  - `printOrderReceipt(jsonData, copies)` – single printer per order
  - `printOrderReceiptMulti(jsonData, copies, [1,2,3])` – specific printers
  - `printOrderReceiptToAll(jsonData, copies)` – all configured order printers

### 3. Label Printer
- **Config keys**: `labelPrinter`, `labelPrinterLeftSpace`
- **Purpose**: Barcode labels (product labels, inventory)
- **Method**: `printBarcodeLabel(jsonData)`
- **Library**: `electron-pos-msh-printer`

### 4. Cash Drawer
- **Config key**: `disableCashDrawer`
- **Purpose**: Open cash drawer via ESC/POS command
- **Method**: `openDrawer()`
- **Library**: `@thiagoelg/node-printer`

---

## Frontend Usage

### Option 1: Direct API (Recommended)

```javascript
import { printer } from '../../utils/electronPrinter';

// Check if Electron is available
if (printer.isAvailable()) {
  // Print cash receipt
  const result = await printer.printReceipt('<html>...</html>', 1);
  
  // Print kitchen order
  const orderData = JSON.stringify([{
    printer_id: 2,
    html: '<html>...</html>',
    table_header: 'Table 5',
    table_body: [...],
  }]);
  await printer.printOrderReceipt(orderData, 1);
  
  // Print to multiple printers
  await printer.printOrderReceiptMulti(orderData, 1, [2, 3, 4]);
  
  // Print barcode label
  const labelData = JSON.stringify([{
    barcode: '1234567890',
    name: 'Product Name',
    price: '$10.00',
    size: 'small',
  }]);
  await printer.printBarcodeLabel(labelData);
  
  // Open cash drawer
  await printer.openDrawer();
}
```

### Option 2: Backward Compatibility

Old code using `window.printer` still works:

```javascript
if (window.printer) {
  window.printer.printReceipt(payload, 1);
  window.printer.printOrderReceiptMulti(kitchenOrder, 1, [2]);
}
```

---

## Printer Settings UI

### Desktop-only Component

`Frontend/src/components/desktop/PrinterSettings.jsx`

**Features**:
- Auto-detect available printers
- Configure main, order, and label printers
- Test print functionality
- Cash drawer enable/disable
- Real-time save to Electron settings

**Usage**:

```jsx
import PrinterSettings from './components/desktop/PrinterSettings';

// In your admin/settings route
<PrinterSettings />
```

---

## Category → Printer Mapping

The existing `ManagePrinter.jsx` component handles **which categories print to which order printers**:

- Stored in `localStorage` (web + desktop)
- Keys: `printerSettings` (kitchen printers), `mainPrinterForCash` (cash printer categories)
- Independent from Electron printer configuration

**Example Flow**:
1. User maps "Coffee" category → Order Printer 2
2. When order contains coffee, print to `orderPrinter2` (configured in PrinterSettings)

---

## Migration Checklist

### ✅ Completed
- [x] Enhanced IPC handlers (`electron/main/ipc/printers.js`)
- [x] Settings store integration
- [x] Preload API exposure
- [x] TypeScript types for `window.electronAPI`
- [x] Frontend printer bridge (`electronPrinter.js`)
- [x] Printer settings UI component
- [x] Dependencies added (`@thiagoelg/node-printer`, `electron-pos-msh-printer`)

### 🔄 Next Steps
1. **Install Dependencies**:
   ```bash
   cd Desktop
   npm install
   ```

2. **Test Print Flow**:
   - Run Electron app
   - Open PrinterSettings
   - Configure printers
   - Click "Test Print"

3. **Integrate into Frontend Routes**:
   ```jsx
   // In your admin routes
   import PrinterSettings from './components/desktop/PrinterSettings';
   
   <Route path="/admin/printers" element={<PrinterSettings />} />
   ```

4. **Update Socket Print Handlers** (`Frontend/src/utils/socket.js`):
   Replace old `window.printer` calls with new `electronPrinter`:
   ```javascript
   import { printer } from './electronPrinter';
   
   // In handleFlutterPrint function
   if (printer.isAvailable()) {
     await printer.printReceipt(payload, 1);
   }
   ```

5. **Add Icons/Assets**:
   - Copy printer icons from old app to `Desktop/assets/`
   - Update tray icon path in `Desktop/electron/main/index.js`

---

## Configuration Storage

| Setting | Location | Format |
|---------|----------|--------|
| **Printer Names** | `{userData}/settings.json` | Electron settings store |
| **Category Mapping** | `localStorage` (Frontend) | `{ printerSettings: {...}, mainPrinterForCash: [...] }` |

---

## Troubleshooting

### Printers Not Detected
```javascript
const printers = await window.electronAPI.getPrinters();
console.log('Available printers:', printers);
```

### Print Fails Silently
- Check printer is online and not paused
- Verify printer name matches exactly (case-sensitive)
- Check `{userData}/logs/` for errors

### Cash Drawer Not Opening
- Ensure `disableCashDrawer` is `false`
- Verify ESC/POS compatibility (some printers use different commands)
- Test with `await printer.openDrawer()` and check console

### Label Print Quality Issues
- Adjust `labelPrinterLeftSpace` in settings
- Check `pageSize` in label data matches physical label size

---

## Security Notes

- ✅ `contextIsolation: true` – Renderer cannot access Node.js
- ✅ `nodeIntegration: false` – No direct Node APIs in renderer
- ✅ Whitelisted IPC only – Only specific print methods exposed
- ✅ No `remote` module – All operations via IPC
- ✅ Settings validated in main process

---

© 2024 BaristaFlow – Secure Desktop Printing
