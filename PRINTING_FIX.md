# Printing Logic Fix - Cash & Card Receipts

## Issue
Cash and card receipts were not printing in the new Desktop app when payments were made.

## Root Cause
**Parameter Mismatch**: The Frontend code was incorrectly passing the **printer ID** (1, 2, 3...) as the second parameter to `window.printer.printReceipt()`, but the Desktop app expects the **number of copies**.

### Expected API:
```javascript
window.printer.printReceipt(html, copies)
```

### What was being passed (WRONG):
```javascript
window.printer.printReceipt(payload, parseInt(printerId) || 1) 
// This was passing printer ID, not copies!
```

## Fixed Files

### 1. `Frontend/src/main.jsx`
✅ **Added**: Global initialization of `window.printer` bridge
```javascript
import { printer } from './utils/electronPrinter.js'

// Initialize Electron printer bridge for backward compatibility
if (typeof window !== 'undefined') {
  window.printer = printer;
  console.log('[BaristaFlow] Electron printer bridge initialized:', printer.isAvailable());
}
```

### 2. `Frontend/src/utils/electronPrinter.js`
✅ **Fixed**: Removed conditional window.printer attachment (now handled in main.jsx)

### 3. `Frontend/src/services/printService.js`
✅ **Fixed**: `_printDirectly()` method to pass `copies = 1` instead of printer ID
```javascript
// BEFORE:
window.printer.printReceipt(payload, printerIdNum); // WRONG!

// AFTER:
window.printer.printReceipt(payload, 1); // 1 = number of copies ✅
```

### 4. `Frontend/src/utils/socket.js`
✅ **Fixed**: All print calls to use `copies = 1`
- `print_cash` / `print_receipt`
- `print_shift_summary`
- Default case

### 5. `Frontend/src/utils/helpers.js`
✅ **Fixed**: `sendToFlutter()` function print calls
- `print_cash` / `print_receipt`
- `print_shift_summary`
- Default case

## How Printer Selection Works

**Important**: The printer is NOT selected by the second parameter! 

The Desktop app's `printers.js` IPC handler reads printer configuration from **settings** (stored in `{userData}/settings.json`):

```javascript
const settings = settingsStore.getAll();
const mainPrinters = [
  settings.mainPrinter,
  settings.mainPrinter1,
  settings.mainPrinter2,
  // ...
].filter(p => p && p !== '--choose Printer--');
```

Users configure which physical printer to use via the **PrinterSettings UI** (`Frontend/src/components/desktop/PrinterSettings.jsx`).

## Testing
1. Launch Desktop app: `cd Desktop && npm start`
2. Navigate to Printer Settings (needs route integration)
3. Configure main printer
4. Make a cash or card payment
5. ✅ Receipt should print correctly

## API Reference

### Cash Receipts (Main Printer)
```javascript
window.printer.printReceipt(htmlContent, copies)
```
- Prints to configured `mainPrinter`, `mainPrinter1-5`
- Uses settings from `settingsStore`

### Kitchen Orders (Order Printers)
```javascript
window.printer.printOrderReceipt(jsonData, copies)
window.printer.printOrderReceiptMulti(jsonData, copies, [printerIds])
window.printer.printOrderReceiptToAll(jsonData, copies)
```

### Other Functions
```javascript
window.printer.openDrawer()
window.printer.printBarcodeLabel(jsonData)
window.printer.getPrinters()
```

## Next Steps
- [ ] Install Visual Studio Build Tools (for native printer modules)
- [ ] Test actual hardware printing
- [ ] Add PrinterSettings route to Frontend
- [ ] Test cash drawer opening
- [ ] Test thermal label printing
