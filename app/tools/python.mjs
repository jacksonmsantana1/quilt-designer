// Runs a Python script with whichever Python this computer has, so npm scripts work on Windows too.
//   node tools/python.mjs build.py
// On Windows `python3` (and often `python`) is only a stand-in that offers the Microsoft Store and fails; `py` is
// the launcher the python.org installer and the Python install manager put on the PATH.
import { spawnSync } from 'child_process';

const names = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
for (const name of names) {
  const r = spawnSync(name, process.argv.slice(2), { stdio: 'inherit' });
  if (r.error?.code === 'ENOENT') continue; // not installed: try the next name
  if (r.error) throw r.error;
  process.exit(r.status ?? 1);
}
console.error(`Python not found (tried ${names.join(', ')}). Install it from python.org.`);
process.exit(1);
