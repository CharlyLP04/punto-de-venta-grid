const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

try {
  cp.execSync('powershell -Command "Stop-Process -Name \'Mario POS\' -Force -ErrorAction SilentlyContinue"', { stdio: 'ignore' });
} catch (e) {}

const src = path.resolve('src-tauri/target/release/mario-pos.exe');
const desktop = path.join(os.homedir(), 'OneDrive', 'Desktop', 'Mario POS.exe');
const outputs = path.resolve('../Mario POS.exe');
const previous = path.resolve('../Mario POS anterior.exe');

console.log('Source size:', fs.statSync(src).size);

const desktops = [
  path.join(os.homedir(), 'OneDrive', 'Desktop', 'Mario POS.exe'),
  path.join(os.homedir(), 'Desktop', 'Mario POS.exe')
];

for (const dest of desktops) {
  const dir = path.dirname(dest);
  if (fs.existsSync(dir)) {
    try {
      fs.copyFileSync(src, dest);
      console.log('Successfully updated:', dest);
    } catch (e) {
      console.warn('Could not update:', dest, e.message);
    }
  }
}

fs.copyFileSync(src, outputs);
console.log('Successfully updated outputs Mario POS.exe!');
