/**
 * Build the multi-size Windows icon (assets/logo.ico) from PNG renders of the
 * Tawlaty app-icon mark. Run: node convert-icon.js <dir-with-size-pngs>
 * Expects app-<size>.png for 16, 24, 32, 48, 64, 128, 256 in the given dir
 * (small sizes use the thickened-stroke variant from the brand "App icons" board).
 * Falls back to resizing assets/logo.png when no directory is given.
 */
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 24, 32, 48, 64, 128, 256];
const outputIco = path.join(__dirname, 'assets', 'logo.ico');
const srcDir = process.argv[2];

const files = srcDir
  ? SIZES.map((s) => fs.readFileSync(path.join(srcDir, `app-${s}.png`)))
  : [fs.readFileSync(path.join(__dirname, 'assets', 'logo.png'))];

toIco(files, { resize: !srcDir, sizes: SIZES })
  .then((buf) => {
    fs.writeFileSync(outputIco, buf);
    console.log(`Created ${outputIco} (${SIZES.join(', ')})`);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exitCode = 1;
  });
