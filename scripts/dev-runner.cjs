const { spawn } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const nodeExe = process.execPath;
const sharedEnv = { ...process.env };

delete sharedEnv.NODE_OPTIONS;

const children = [];

function prefixOutput(label, stream, color) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      process.stdout.write(`${color}[${label}] ${line}\x1b[0m\n`);
    }
  });
}

function spawnNode(label, scriptPath, extraArgs = [], color = '\x1b[36m') {
  const child = spawn(nodeExe, [scriptPath, ...extraArgs], {
    cwd: repoRoot,
    env: sharedEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  children.push(child);
  prefixOutput(label, child.stdout, color);
  prefixOutput(label, child.stderr, '\x1b[31m');

  child.on('exit', (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    process.stdout.write(`\x1b[33m[${label}] exited with ${reason}\x1b[0m\n`);
    shutdown(code ?? 0);
  });

  child.on('error', (error) => {
    process.stdout.write(`\x1b[31m[${label}] failed to start: ${error.message}\x1b[0m\n`);
    shutdown(1);
  });
}

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 50);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

spawnNode('server', path.join('server', 'index.js'), [], '\x1b[35m');
spawnNode('vite', path.join('node_modules', 'vite', 'bin', 'vite.js'), ['--host', process.env.HOST || '::', '--port', process.env.PORT || '5173'], '\x1b[32m');
