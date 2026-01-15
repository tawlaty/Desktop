/**
 * Type declarations for the Electron preload API exposed on window.electronAPI.
 * Add this file to Frontend/src/types/ and include in tsconfig "include".
 */

export interface PrintOptions {
  silent?: boolean;
  deviceName?: string;
  margins?: { marginType: 'default' | 'none' | 'printableArea' | 'custom' };
  landscape?: boolean;
  scaleFactor?: number;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

export interface ElectronAPI {
  // Settings
  getSettings: () => Promise<Record<string, unknown>>;
  setSettings: (data: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;

  // Printers
  getPrinters: () => Promise<PrinterInfo[]>;
  printReceipt: (html: string, copies?: number) => Promise<{ success: boolean; error?: string; results?: unknown[] }>;
  printOrderReceipt: (jsonData: string, copies?: number) => Promise<{ success: boolean; error?: string; results?: unknown[] }>;
  printOrderReceiptMulti: (jsonData: string, copies?: number, printerIds?: number[]) => Promise<{ success: boolean; error?: string; results?: unknown[] }>;
  printOrderReceiptToAll: (jsonData: string, copies?: number) => Promise<{ success: boolean; error?: string; results?: unknown[] }>;
  printBarcodeLabel: (jsonData: string) => Promise<{ success: boolean; error?: string; results?: unknown[] }>;
  openDrawer: () => Promise<{ success: boolean; error?: string; jobID?: string }>;

  // App
  getAppVersion: () => Promise<string>;

  // Event subscription (main → renderer)
  onMainEvent: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
