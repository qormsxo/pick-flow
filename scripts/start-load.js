const { spawn } = require('child_process');
const path = require('path');

process.env.LOAD_TEST = 'true';
process.env.AI_PROVIDER = 'fake';

const root = path.join(__dirname, '..');
const nestBin = path.join(root, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
const child = spawn(process.execPath, [nestBin, 'start', '--watch'], {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
