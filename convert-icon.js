/**
 * Convert PNG logo to ICO format for Windows
 * Run: node convert-icon.js
 */
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const inputPng = path.join(__dirname, 'assets', 'logo.png');
const outputIco = path.join(__dirname, 'assets', 'logo.ico');

console.log('Converting logo.png to logo.ico for Windows...');

const files = [inputPng];

toIco(files.map(file => fs.readFileSync(file)), { resize: true, sizes: [16, 24, 32, 48, 64, 128, 256] })
  .then(buf => {
    fs.writeFileSync(outputIco, buf);
    console.log('✓ Successfully created logo.ico with multiple sizes');
    console.log('✓ Now restart your app to see the new icon');
  })
  .catch(err => {
    console.error('Error:', err);
  });
