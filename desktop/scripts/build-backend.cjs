const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const bundledPython = process.platform === 'win32'
  ? path.join(root, '.venv-desktop', 'Scripts', 'python.exe')
  : path.join(root, '.venv-desktop', 'bin', 'python');
const candidates = [process.env.PYTHON, existsSync(bundledPython) ? bundledPython : null, 'python3', 'python']
  .filter(Boolean);
const args = [
  '-m', 'PyInstaller', '--noconfirm', '--clean',
  '--distpath', 'backend/dist',
  '--workpath', 'backend/build/pyinstaller',
  'backend/desktop_backend.spec'
];

for (const command of candidates) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PYINSTALLER_CONFIG_DIR: process.env.PYINSTALLER_CONFIG_DIR
        || path.join(root, 'backend', 'build', 'pyinstaller-cache')
    }
  });
  if (!result.error && result.status === 0) process.exit(0);
  if (!result.error && result.status !== 127) process.exit(result.status || 1);
}

console.error('Python was not found. Set PYTHON or create .venv-desktop.');
process.exit(1);
