// Adds or prunes named imports in src modules.
//   node tools/imports.mjs add <module> <from-module> name1 name2 ...   (module paths relative to src/, no .js)
//   node tools/imports.mjs prune <module> ...                            drop imported names no longer used
import fs from 'fs';
import path from 'path';
import { pruneImports } from './move.mjs';

const SRC = path.resolve('src');
const file = m => path.join(SRC, m + '.js');
const rel = (from, to) => { let r = path.relative(path.dirname(file(from)), file(to)); if (!r.startsWith('.')) r = './' + r; return r; };
const [cmd, m, ...rest] = process.argv.slice(2);
if (cmd === 'add') {
  const [from, ...names] = rest, spec = rel(m, from);
  let s = fs.readFileSync(file(m), 'utf8');
  const re = new RegExp(`^import \\{([^}]*)\\} from '${spec.replace(/\./g, '\\.')}';$`, 'm');
  if (re.test(s)) s = s.replace(re, (_, list) => `import { ${[...new Set([...list.split(',').map(x => x.trim()).filter(Boolean), ...names])].sort().join(', ')} } from '${spec}';`);
  else {
    // after the last import line (or the header comment)
    const lines = s.split('\n'); let at = 0;
    lines.forEach((l, i) => { if (/^import /.test(l) || (i === at && /^\/\//.test(l))) at = i + 1; });
    lines.splice(at, 0, `import { ${names.sort().join(', ')} } from '${spec}';`);
    s = lines.join('\n');
  }
  fs.writeFileSync(file(m), s);
}
if (cmd === 'prune') for (const x of [m, ...rest]) pruneImports(x);
