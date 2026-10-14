const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

try {
  cp.execSync('powershell -Command "Stop-Process -Name \'grid-pos\',\'Grid POS\' -Force -ErrorAction SilentlyContinue"', { stdio: 'ignore' });
} catch (e) {}

const src = path.resolve('src-tauri/target/release/grid-pos.exe');
const desktop = path.join(os.homedir(), 'Desktop', 'Grid POS.exe');
const rootRelease = path.resolve('Grid POS.exe');

if (fs.existsSync(src)) {
  console.log('Source binary size:', fs.statSync(src).size);

  const targets = [
    desktop,
    path.join(os.homedir(), 'OneDrive', 'Desktop', 'Grid POS.exe'),
  ];
  for (const target of targets) {
    const dir = path.dirname(target);
    if (fs.existsSync(dir)) {
      try {
        fs.copyFileSync(src, target);
        console.log('Successfully updated desktop:', target);
      } catch (e) {
        console.warn('Could not copy to target:', target, e.message);
      }
    }
  }

  try {
    fs.copyFileSync(src, rootRelease);
    console.log('Successfully updated release executable in project root:', rootRelease);
  } catch (e) {
    console.warn('Could not copy to project root:', e.message);
  }
} else {
  console.log('Release binary not found yet at:', src);
}
