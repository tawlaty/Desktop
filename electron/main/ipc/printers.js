/**
 * Enhanced IPC: Printers
 * Full printing functionality with receipt, kitchen orders, labels, and cash drawer support.
 */
const { BrowserWindow } = require('electron');

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
    console.log(`\n🖨️ [IPC printers:printReceipt] Called with:`, {
      htmlLength: html?.length || 0,
      htmlPreview: html ? html.substring(0, 200) : 'NO HTML',
      copies,
      htmlType: typeof html
    });

    const settings = settingsStore.getAll();
    console.log(`⚙️ [IPC printers:printReceipt] Current settings:`, {
      mainPrinter: settings.mainPrinter,
      mainPrinter1: settings.mainPrinter1,
      mainPrinter2: settings.mainPrinter2,
      mainPrinter3: settings.mainPrinter3,
      mainPrinter4: settings.mainPrinter4,
      mainPrinter5: settings.mainPrinter5
    });

    const mainPrinters = [
      settings.mainPrinter,
      settings.mainPrinter1,
      settings.mainPrinter2,
      settings.mainPrinter3,
      settings.mainPrinter4,
      settings.mainPrinter5,
    ].filter(p => p && p !== '--choose Printer--' && p !== 'please select');

    console.log(`📋 [IPC printers:printReceipt] Filtered main printers:`, mainPrinters);

    if (mainPrinters.length === 0) {
      console.error(`❌ [IPC printers:printReceipt] No main printers configured!`);
      return { success: false, error: 'Main printer not configured' };
    }

    const results = [];
    for (const printerName of mainPrinters) {
      console.log(`📤 [IPC printers:printReceipt] Printing to: ${printerName}`);
      const result = await printHTML(html, copies, printerName);
      console.log(`📥 [IPC printers:printReceipt] Result from ${printerName}:`, result);
      results.push({ printer: printerName, ...result });
    }

    const allSuccess = results.every(r => r.success);
    console.log(`✅ [IPC printers:printReceipt] Final result:`, {
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
      console.log(`\n🖨️ [printOrderReceiptMulti] Called with:`, {
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

      console.log(`📋 [printOrderReceiptMulti] Orders to print:`, orders.length);
      console.log(`⚙️ [printOrderReceiptMulti] Available order printers:`, {
        orderPrinter1: settings.orderPrinter1 || 'not set',
        orderPrinter2: settings.orderPrinter2 || 'not set',
        orderPrinter3: settings.orderPrinter3 || 'not set',
        orderPrinter4: settings.orderPrinter4 || 'not set',
        orderPrinter5: settings.orderPrinter5 || 'not set',
        orderPrinter6: settings.orderPrinter6 || 'not set',
      });

      for (const order of orders) {
        const targetPrinters = printerIds.length > 0 ? printerIds : [order.printer_id || 2];
        console.log(`🎯 [printOrderReceiptMulti] Target printers for order:`, targetPrinters);

        for (const printerId of targetPrinters) {
          const printerKey = `orderPrinter${printerId}`;
          const orderPrinter = settings[printerKey];
          
          console.log(`🔍 [printOrderReceiptMulti] Looking up ${printerKey}:`, orderPrinter || 'not found');

          if (!orderPrinter || orderPrinter === 'please select' || orderPrinter === '--choose Printer--') {
            console.log(`❌ [printOrderReceiptMulti] Printer ${printerId} not configured`);
            results.push({
              orderId: order.orderId || 'unknown',
              printerId,
              success: false,
              error: `Order printer ${printerId} not configured`,
            });
            continue;
          }

          console.log(`📤 [printOrderReceiptMulti] Printing to: ${orderPrinter}`);
          const result = await printHTML(order.html, copies, orderPrinter);
          console.log(`📥 [printOrderReceiptMulti] Print result:`, result);
          
          results.push({
            orderId: order.orderId || 'unknown',
            printerId,
            printer: orderPrinter,
            ...result,
          });
        }
      }

      console.log(`✅ [printOrderReceiptMulti] All results:`, results);
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
            console.log(`[printers] Cash drawer opened. Job ID: ${jobID}`);
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
async function printHTML(html, copies, printerName) {
  return new Promise(async (resolve) => {
    console.log(`[printHTML] Called with:`, {
      htmlLength: html.length,
      htmlStart: html.substring(0, 300),
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
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true,
      },
    });

    const encodedHTML = html.replace(/#/g, '%23');
    console.log(`[printHTML] Encoded HTML length: ${encodedHTML.length}`);
    
    printWindow.loadURL(`data:text/html;charset=utf-8,${encodedHTML}`);

    printWindow.webContents.on('did-finish-load', async () => {
      console.log(`[printHTML] HTML loaded successfully, checking printers...`);
      
      try {
        // Get list of printers to verify the printer exists
        const printers = await printWindow.webContents.getPrintersAsync();
        console.log(`[printHTML] Available printers:`, printers.map(p => ({ name: p.name, isDefault: p.isDefault })));
        
        const targetPrinter = printers.find(p => p.name === printerName);
        const defaultPrinter = printers.find(p => p.isDefault);
        
        if (!targetPrinter) {
          console.error(`[printHTML] Printer "${printerName}" not found!`);
        } else {
          console.log(`[printHTML] Found printer:`, {
            name: targetPrinter.name,
            isDefault: targetPrinter.isDefault,
            status: targetPrinter.status
          });
        }
        
        console.log(`[printHTML] Default printer:`, defaultPrinter?.name);
        
        // Critical: For silent printing to work, the target printer MUST be the default printer
        // If it's not, we need to print to PDF and send via raw printer commands
        const useTargetPrinter = targetPrinter && targetPrinter.isDefault;
        
        if (!useTargetPrinter && targetPrinter) {
          console.error(`[printHTML] ❌ CRITICAL: Target printer "${printerName}" is NOT the default printer!`);
          console.error(`[printHTML] Silent printing will likely fail. You MUST set "${printerName}" as the default printer in Windows.`);
          console.error(`[printHTML] Instructions: Control Panel → Devices and Printers → Right-click "${printerName}" → Set as default printer`);
          console.error(`[printHTML] Current default: ${defaultPrinter?.name || 'None'}`);
        }
        
        // Warn about virtual printers
        if (printerName && (printerName.includes('PDF') || printerName.includes('XPS') || printerName.includes('Fax'))) {
          console.warn(`[printHTML] ⚠️ WARNING: "${printerName}" appears to be a virtual printer (PDF/XPS/Fax).`);
          console.warn(`[printHTML] Virtual printers may not work correctly for POS printing.`);
          console.warn(`[printHTML] Please configure a physical thermal printer instead.`);
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
        
        // Set the target printer as deviceName
        if (targetPrinter) {
          printOptions.deviceName = printerName;
          console.log(`[printHTML] Targeting printer: ${printerName}`);
        } else if (defaultPrinter) {
          printOptions.deviceName = defaultPrinter.name;
          console.log(`[printHTML] Using system default printer: ${defaultPrinter.name}`);
        }
        
        console.log(`[printHTML] Printing with options:`, printOptions);
        
        printWindow.webContents.print(
          printOptions,
          (success, failureReason) => {
            console.log(`[printHTML] Print callback:`, { success, failureReason });
            printWindow.close();
            if (success) {
              console.log(`✅ [printHTML] Print job sent successfully to "${printerName}"`);
              resolve({ success: true });
            } else {
              console.error(`❌ [printHTML] Print job FAILED for "${printerName}"`);
              console.error(`[printHTML] Failure reason: ${failureReason || 'Unknown'}`);
              console.error(`[printHTML] Troubleshooting:`);
              console.error(`  1. Ensure "${printerName}" is set as DEFAULT printer in Windows`);
              console.error(`  2. Ensure printer is turned ON and connected`);
              console.error(`  3. Check if printer name is correct (no typos)`);
              console.error(`  4. Try using a physical thermal printer instead of PDF/virtual printers`);
              
              resolve({ 
                success: false, 
                error: failureReason || 'Print failed',
                printer: printerName,
                isDefault: targetPrinter?.isDefault || false,
                troubleshooting: 'Set printer as default in Windows or check printer connection'
              });
            }
          }
        );
      } catch (error) {
        console.error(`[printHTML] Exception during print:`, error);
        printWindow.close();
        resolve({ success: false, error: error.message });
      }
    });

    printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`[printHTML] Failed to load HTML:`, errorCode, errorDescription);
      printWindow.close();
      resolve({ success: false, error: `Failed to load: ${errorDescription}` });
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

module.exports = { register };
