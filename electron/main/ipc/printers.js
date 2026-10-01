/**
 * Enhanced IPC: Printers
 * Full printing functionality with receipt, kitchen orders, labels, and cash drawer support.
 */
const { app, BrowserWindow } = require('electron');
const PRINT_DEBUG = !app.isPackaged || process.env.TAWLATY_PRINT_DEBUG === '1';

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {Object} settingsStore - Simple key-value store for printer settings
 */
function register(ipcMain, settingsStore) {
  
  /*───────────────────────────────────────────────────────────────────────────*
   * List Available Printers
   *───────────────────────────────────────────────────────────────────────────*/
  ipcMain.handle('printers:list', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    try {
      return await win.webContents.getPrintersAsync();
    } catch (error) {
      console.error('[printers] Error listing printers:', error);
      return [];
    }
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Print Receipt (HTML) – Main cash receipt printer
   *───────────────────────────────────────────────────────────────────────────*/
  ipcMain.handle('printers:printReceipt', async (_event, html, copies = 1) => {
    // Receipt HTML contains customer data – log its size only, never its content.
    debugLog(`\n🖨️ [IPC printers:printReceipt] Called with:`, {
      htmlLength: html?.length || 0,
      copies,
      htmlType: typeof html
    });

    const settings = settingsStore.getAll();

    const mainPrinters = [
      settings.mainPrinter,
      settings.mainPrinter1,
      settings.mainPrinter2,
      settings.mainPrinter3,
      settings.mainPrinter4,
      settings.mainPrinter5,
    ].filter(p => p && p !== '--choose Printer--' && p !== 'please select');

    debugLog(`📋 [IPC printers:printReceipt] Filtered main printers:`, mainPrinters);

    if (mainPrinters.length === 0) {
      console.error(`❌ [IPC printers:printReceipt] No main printers configured!`);
      return { success: false, error: 'Main printer not configured' };
    }

    const results = [];
    for (const printerName of mainPrinters) {
      debugLog(`📤 [IPC printers:printReceipt] Printing to: ${printerName}`);
      const result = await printHTML(html, copies, printerName);
      debugLog(`📥 [IPC printers:printReceipt] Result from ${printerName}:`, result);
      results.push({ printer: printerName, ...result });
    }

    const allSuccess = results.every(r => r.success);
    debugLog(`✅ [IPC printers:printReceipt] Final result:`, {
      allSuccess,
      results
    });

    return {
      success: allSuccess,
      results,
      error: allSuccess ? null : 'Some printers failed',
    };
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Print Order Receipt (Kitchen Orders) – JSON format
   *───────────────────────────────────────────────────────────────────────────*/
  ipcMain.handle('printers:printOrderReceipt', async (_event, jsonData, copies = 1) => {
    try {
      const orders = JSON.parse(jsonData);
      const settings = settingsStore.getAll();
      const results = [];

      for (const order of orders) {
        const printerId = order.printer_id || 1;
        const orderPrinter = settings[`orderPrinter${printerId}`];

        if (!orderPrinter || orderPrinter === 'please select' || orderPrinter === '--choose Printer--') {
          results.push({
            orderId: order.orderId || 'unknown',
            printer: printerId,
            success: false,
            error: `Order printer ${printerId} not configured`,
          });
          continue;
        }

        const result = await printHTML(order.html, copies, orderPrinter);
        results.push({
          orderId: order.orderId || 'unknown',
          printer: orderPrinter,
          ...result,
        });
      }

      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Print Order to Multiple Printers
   *───────────────────────────────────────────────────────────────────────────*/
  ipcMain.handle('printers:printOrderReceiptMulti', async (_event, jsonData, copies = 1, printerIds = []) => {
    try {
      debugLog(`\n🖨️ [printOrderReceiptMulti] Called with:`, {
        jsonDataLength: jsonData?.length || 0,
        copies,
        printerIds,
      });
      
      // Validate settings
      const settings = settingsStore.getAll();
      const hasAnyOrderPrinter = [1, 2, 3, 4, 5, 6].some(i => {
        const printer = settings[`orderPrinter${i}`];
        return printer && printer !== 'please select' && printer !== '--choose Printer--';
      });
      
      if (!hasAnyOrderPrinter) {
        console.error(`❌ [printOrderReceiptMulti] CRITICAL: No order printers configured!`);
        console.error(`[printOrderReceiptMulti] Please configure printers in: Settings → Printer Settings`);
        return { 
          success: false, 
          error: 'No order printers configured. Please configure in Printer Settings.',
          results: [] 
        };
      }

      const orders = JSON.parse(jsonData);
      const results = [];

      debugLog(`📋 [printOrderReceiptMulti] Orders to print:`, orders.length);

      for (const order of orders) {
        const targetPrinters = printerIds.length > 0 ? printerIds : [order.printer_id || 2];
        debugLog(`🎯 [printOrderReceiptMulti] Target printers for order:`, targetPrinters);

        for (const printerId of targetPrinters) {
          const printerKey = `orderPrinter${printerId}`;
          const orderPrinter = settings[printerKey];
          
          debugLog(`🔍 [printOrderReceiptMulti] Looking up ${printerKey}:`, orderPrinter || 'not found');

          if (!orderPrinter || orderPrinter === 'please select' || orderPrinter === '--choose Printer--') {
            debugLog(`❌ [printOrderReceiptMulti] Printer ${printerId} not configured`);
            results.push({
              orderId: order.orderId || 'unknown',
              printerId,
              success: false,
              error: `Order printer ${printerId} not configured`,
            });
            continue;
          }

          debugLog(`📤 [printOrderReceiptMulti] Printing to: ${orderPrinter}`);
          const result = await printHTML(order.html, copies, orderPrinter);
          debugLog(`📥 [printOrderReceiptMulti] Print result:`, result);
          
          results.push({
            orderId: order.orderId || 'unknown',
            printerId,
            printer: orderPrinter,
            ...result,
          });
        }
      }

      debugLog(`✅ [printOrderReceiptMulti] All results:`, results);
      return { success: true, results };
    } catch (error) {
      console.error(`❌ [printOrderReceiptMulti] Error:`, error);
      return { success: false, error: error.message };
    }
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Print to All Configured Order Printers
   *───────────────────────────────────────────────────────────────────────────*/
  ipcMain.handle('printers:printOrderReceiptToAll', async (_event, jsonData, copies = 1) => {
    try {
      const orders = JSON.parse(jsonData);
      const settings = settingsStore.getAll();
      
      // Find all configured order printers (1-10)
      const availablePrinters = [];
      for (let i = 1; i <= 10; i++) {
        const printerName = settings[`orderPrinter${i}`];
        if (printerName && printerName !== 'please select' && printerName !== '--choose Printer--') {
          availablePrinters.push(i);
        }
      }

      if (availablePrinters.length === 0) {
        return { success: false, error: 'No order printers configured' };
      }

      const results = [];
      for (const order of orders) {
        for (const printerId of availablePrinters) {
          const orderPrinter = settings[`orderPrinter${printerId}`];
          const result = await printHTML(order.html, copies, orderPrinter);
          results.push({
            orderId: order.orderId || 'unknown',
            printerId,
            printer: orderPrinter,
            ...result,
          });
        }
      }

      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Open Cash Drawer (ESC/POS command)
   *───────────────────────────────────────────────────────────────────────────*/
  ipcMain.handle('printers:openDrawer', async () => {
    const settings = settingsStore.getAll();
    
    if (settings.disableCashDrawer) {
      return { success: false, error: 'Cash drawer is disabled in settings' };
    }

    const mainPrinter = settings.mainPrinter;
    if (!mainPrinter || mainPrinter === '--choose Printer--') {
      return { success: false, error: 'Main printer not configured' };
    }

    try {
      const printer = require('@thiagoelg/node-printer');
      const openDrawerCommand = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);

      return new Promise((resolve) => {
        printer.printDirect({
          printer: mainPrinter,
          data: openDrawerCommand,
          type: 'RAW',
          success: (jobID) => {
            debugLog(`[printers] Cash drawer opened. Job ID: ${jobID}`);
            resolve({ success: true, jobID });
          },
          error: (err) => {
            console.error(`[printers] Error opening cash drawer:`, err);
            resolve({ success: false, error: err.toString() });
          },
        });
      });
    } catch (error) {
      console.warn('[printers] Native printer module not available:', error.message);
      console.warn('[printers] Install Visual Studio Build Tools to enable cash drawer support');
      return { success: false, error: 'Native printer module not installed. Cash drawer requires @thiagoelg/node-printer.' };
    }
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Print Barcode Label
   *───────────────────────────────────────────────────────────────────────────*/
  ipcMain.handle('printers:printBarcodeLabel', async (_event, jsonData) => {
    try {
      const settings = settingsStore.getAll();
      const labelPrinter = settings.labelPrinter;
      const labelPrinterLeftSpace = settings.labelPrinterLeftSpace;

      if (!labelPrinter || labelPrinter === '--choose Printer--') {
        return { success: false, error: 'Label printer not configured' };
      }

      const labels = JSON.parse(jsonData);
      if (labels.length === 0) {
        return { success: false, error: 'No labels to print' };
      }

      let PosPrinter;
      try {
        PosPrinter = require('electron-pos-msh-printer').PosPrinter;
      } catch (requireError) {
        console.warn('[printers] Native label printer module not available:', requireError.message);
        console.warn('[printers] Install Visual Studio Build Tools to enable label printing');
        return { success: false, error: 'Native label printer module not installed. Barcode labels require electron-pos-msh-printer.' };
      }

      const results = [];

      for (const labelData of labels) {
        try {
          const pageSize = calculatePageSize(labelData);
          const options = {
            preview: false,
            copies: labelData.copies || 1,
            printerName: labelPrinter,
            timeOutPerLine: 400,
            silent: true,
            margin: labelPrinterLeftSpace ? '-1px auto' : '5px 10px',
            padding: '0',
            pageSize,
            pagesPerSheet: '1',
            leftSpace: labelPrinterLeftSpace || null,
          };

          const data = prepareLabelContent(labelData, options);
          await PosPrinter.print(data, options);
          
          results.push({ label: labelData.barcode || 'unknown', success: true });
        } catch (error) {
          results.push({
            label: labelData.barcode || 'unknown',
            success: false,
            error: error.message,
          });
        }
      }

      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

/*───────────────────────────────────────────────────────────────────────────*
 * Helper: Print HTML to Printer
 *───────────────────────────────────────────────────────────────────────────*/
/** Upper bound for load + spool of one print job; prevents a hung IPC call. */
const PRINT_TIMEOUT_MS = 60 * 1000;

function printHTML(html, copies, printerName) {
  return new Promise((resolve) => {
    if (typeof html !== 'string' || html.length === 0) {
      resolve({ success: false, error: 'Nothing to print (empty HTML)' });
      return;
    }

    // Receipt HTML contains customer data – log its size only, never its content.
    debugLog(`[printHTML] Called with:`, {
      htmlLength: html.length,
      printerName,
      copies
    });

    const printWindow = new BrowserWindow({
      autoHideMenuBar: true,
      center: true,
      closable: true,
      enableLargerThanScreen: true,
      focusable: true,
      fullscreen: false,
      fullscreenable: false,
      hasShadow: false,
      kiosk: false,
      maximizable: false,
      minimizable: false,
      modal: false,
      movable: false,
      opacity: 1.0,
      resizable: false,
      show: false,
      simpleFullscreen: false,
      frame: false,
      thickFrame: false,
      zoomToPageWidth: true,
      webPreferences: {
        // Static receipt markup only: no scripts, no <webview>, sandboxed renderer.
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        javascript: false,
        webviewTag: false,
      },
    });

    // Resolve exactly once and always dispose of the hidden window.
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!printWindow.isDestroyed()) printWindow.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => {
      console.error(`[printHTML] Timed out after ${PRINT_TIMEOUT_MS} ms (printer: ${printerName})`);
      finish({ success: false, error: 'Print timed out', printer: printerName });
    }, PRINT_TIMEOUT_MS);

    printWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[printHTML] Print renderer gone:`, details?.reason);
      finish({ success: false, error: `Print renderer exited: ${details?.reason || 'unknown'}` });
    });

    printWindow.webContents.on('did-finish-load', async () => {
      try {
        // Get list of printers to verify the printer exists
        const printers = await printWindow.webContents.getPrintersAsync();
        const targetPrinter = printers.find(p => p.name === printerName);
        const defaultPrinter = printers.find(p => p.isDefault);

        if (!targetPrinter) {
          console.error(`[printHTML] Printer "${printerName}" not found! Falling back to default: ${defaultPrinter?.name || 'None'}`);
        }

        // Warn about virtual printers
        if (printerName && (printerName.includes('PDF') || printerName.includes('XPS') || printerName.includes('Fax'))) {
          console.warn(`[printHTML] ⚠️ "${printerName}" appears to be a virtual printer (PDF/XPS/Fax); POS printing may not work.`);
        }

        const printOptions = {
          silent: true,
          printBackground: true,
          color: false,
          margins: {
            marginType: 'custom',
            top: 0,
            right: 0,
            left: 0,
            bottom: 0,
          },
          copies: copies || 1,
        };

        // Set the target printer as deviceName (silent printing does not need it to be the Windows default)
        if (targetPrinter) {
          printOptions.deviceName = printerName;
        } else if (defaultPrinter) {
          printOptions.deviceName = defaultPrinter.name;
        }

        printWindow.webContents.print(
          printOptions,
          (success, failureReason) => {
            if (success) {
              debugLog(`✅ [printHTML] Print job sent to "${printOptions.deviceName || printerName}"`);
              finish({ success: true });
            } else {
              console.error(`❌ [printHTML] Print job FAILED for "${printerName}": ${failureReason || 'Unknown'}`);
              finish({
                success: false,
                error: failureReason || 'Print failed',
                printer: printerName,
                isDefault: targetPrinter?.isDefault || false,
                troubleshooting: 'Check that the printer is on, connected and the name in Printer Settings is correct'
              });
            }
          }
        );
      } catch (error) {
        console.error(`[printHTML] Exception during print:`, error);
        finish({ success: false, error: error.message });
      }
    });

    printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`[printHTML] Failed to load HTML:`, errorCode, errorDescription);
      finish({ success: false, error: `Failed to load: ${errorDescription}` });
    });

    // base64 data URL: no manual escaping, so '#', '%' and non-ASCII text are all safe.
    const dataUrl = `data:text/html;charset=utf-8;base64,${Buffer.from(html, 'utf-8').toString('base64')}`;
    printWindow.loadURL(dataUrl).catch(() => {
      // Load failures are reported through 'did-fail-load' above.
    });
  });
}

/*───────────────────────────────────────────────────────────────────────────*
 * Helper: Calculate Label Page Size
 *───────────────────────────────────────────────────────────────────────────*/
function calculatePageSize(label) {
  const defaultSmall = { width: 38, height: 25 };
  const defaultLarge = { width: 62, height: 29 };

  return {
    width: label.labelWidth || (label.size === 'small' ? defaultSmall.width : defaultLarge.width),
    height: label.labelHeight || (label.size === 'small' ? defaultSmall.height : defaultLarge.height),
  };
}

/*───────────────────────────────────────────────────────────────────────────*
 * Helper: Prepare Label Content for Printing
 *───────────────────────────────────────────────────────────────────────────*/
function prepareLabelContent(label, options) {
  const isSmallLabel = options.pageSize.width <= 42;
  let fontSize = 10;
  let barcodeHeight = isSmallLabel ? 15 : 40;
  let barcodeFontSize = 10;
  let barcodeWidth = isSmallLabel ? 1 : 1;

  if (label.size === 'x_large') {
    fontSize = 22;
    barcodeFontSize = 16;
    barcodeHeight = 50;
    barcodeWidth = 2;
  }

  const data = [];

  if (label.branch) {
    data.push({
      type: 'text',
      value: label.branch,
      style: { fontWeight: 'bold', fontSize: `${fontSize + 1}px`, textAlign: 'left', margin: '0', padding: '0' },
    });
  }

  if (label.name) {
    data.push({
      type: 'text',
      value: label.name,
      style: { fontWeight: 'bold', fontSize: `${fontSize + 1}px`, textAlign: 'left', margin: '0', padding: '0' },
    });
  }

  if (label.price || label.expiryDate) {
    data.push({
      type: 'text',
      value: `${label.price || ''} ${label.expiryDate ? `Exp: ${label.expiryDate}` : ''}`,
      style: { fontWeight: 'bold', fontSize: `${fontSize + 2}px`, textAlign: 'left', margin: '0', padding: '0' },
    });
  }

  if (label.barcode) {
    data.push({
      type: 'barCode',
      value: label.barcode,
      height: barcodeHeight,
      width: barcodeWidth,
      displayValue: true,
      fontsize: barcodeFontSize,
      style: { textAlign: 'center', margin: '0', padding: '0' },
    });
  }

  return data;
}

/**
 * Per-print diagnostics. Silent in packaged builds unless the POS operator
 * starts the app with TAWLATY_PRINT_DEBUG=1; always on in dev (`npm start`).
 * Errors and warnings still go to console.error / console.warn.
 * (Function declaration so it is hoisted for the handlers above.)
 */
function debugLog(...args) {
  if (PRINT_DEBUG) console.log(...args);
}

module.exports = { register };
