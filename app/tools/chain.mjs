// The load-order chain of src/ (see src/README.md): every chained module's first import is the module that runs
// before it, and src/main.js imports the last one.
//   node tools/chain.mjs list                     the chain, in run order
//   node tools/chain.mjs unchain mod1 mod2 ...     take modules out (only for modules with no load-time side effects
//                                                  that import nothing chained); their successors are re-linked
//   node tools/chain.mjs insert mod after prev     put a module into the chain right after prev
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');
const file = m => path.join(SRC, m + '.js');
const LINE = /^import '([^']+)';\s*\/\/ load order: runs after (\S+)\n/m;
const rel = (from, to) => { let r = path.relative(path.dirname(file(from)), file(to)); if (!r.startsWith('.')) r = './' + r; return r; };
const all = () => { const out = []; const w = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) w(p); else if (p.endsWith('.js') && !p.endsWith('/main.js')) out.push(path.relative(SRC, p).replace(/\.js$/, '')); } }; w(SRC); return out; };
const prevOf = m => { const s = fs.readFileSync(file(m), 'utf8'), x = s.match(LINE); return x ? x[2] : null; };
function setPrev(m, p) {
  let s = fs.readFileSync(file(m), 'utf8');
  const line = p ? `import '${rel(m, p)}'; // load order: runs after ${p}\n` : '';
  if (LINE.test(s)) s = s.replace(LINE, line);
  else s = s.replace(/^((?:\/\/[^\n]*\n)*)/, `$1${line}`);
  fs.writeFileSync(file(m), s);
}
export function chain() {
  const main = fs.readFileSync(path.join(SRC, 'main.js'), 'utf8');
  let cur = path.relative(SRC, path.resolve(SRC, main.match(/^import '([^']+)';/m)[1])).replace(/\.js$/, '');
  const out = [];
  while (cur) { out.unshift(cur); cur = prevOf(cur); }
  return out;
}
function writeMain(order) {
  fs.writeFileSync(path.join(SRC, 'main.js'),
    `// Entry point. Each module imports the one before it first, so importing the last one runs them all,\n// in order: ${order.join(' > ')}.\nimport './${order[order.length - 1]}.js';\n`);
}
const cmd = process.argv[2];
if (cmd === 'list') { const c = chain(); console.log(c.join('\n')); console.log(`${c.length} chained; not chained: ${all().filter(m => !c.includes(m)).join(', ')}`); }
if (cmd === 'unchain') {
  for (const m of process.argv.slice(3)) {
    const c = chain(), i = c.indexOf(m); if (i < 0) continue;
    const p = c[i - 1] || null, next = c[i + 1];
    setPrev(m, null);
    if (next) setPrev(next, p);
    writeMain(chain().length ? chain() : c.filter(x => x !== m));
  }
  writeMain(chain());
}
if (cmd === 'insert') {
  const [m, , p] = process.argv.slice(3);
  const c = chain(), i = c.indexOf(p), next = c[i + 1];
  setPrev(m, p);
  if (next) setPrev(next, m);
  writeMain(chain());
}
