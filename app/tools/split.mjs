// Splits main2.js into ES modules (no behaviour change):
//  - each top-level statement goes to a module (map.mjs), with its leading comments;
//  - every top-level name used by another module is exported by its owner and imported where used;
//  - top-level variables assigned from another module (ES imports are read-only) move onto one
//    shared object: `design` becomes `shared.design` everywhere;
//  - an entry module imports all modules in the original order.
// It then simulates ES module evaluation order and reports any top-level code that would now
// read a const/let before its module has run.
import fs from 'fs';
import path from 'path';
import * as acorn from '../npm/node_modules/acorn/dist/acorn.mjs';
import * as walk from '../npm/node_modules/acorn-walk/dist/walk.mjs';
import { analyze } from '../npm/node_modules/eslint-scope/lib/index.js';
import { RANGES, MOVE, DESC } from './map.mjs';

const SRC = process.argv[2], OUT = process.argv[3];
const src = fs.readFileSync(SRC, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module', locations: true, ranges: true });
const sm = analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const modScope = sm.globalScope.childScopes.find(s => s.type === 'module');

// ---- statements -> modules
const body = ast.body;
const declNames = n => n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration' ? [n.id.name]
  : n.type === 'VariableDeclaration' ? n.declarations.map(d => d.id.name) : [];
const modOf = [];
body.forEach((n, i) => {
  if (n.type === 'ImportDeclaration') { modOf[i] = null; return; }
  const line = n.loc.start.line, r = RANGES.find(([, a, b]) => line >= a && line <= b);
  if (!r) throw new Error('no module for line ' + line);
  let m = r[0];
  for (const nm of declNames(n)) if (MOVE[nm]) m = MOVE[nm];
  modOf[i] = m;
});
const order = [];                                   // modules in original first-appearance order
for (const m of RANGES.map(r => r[0]).concat(Object.values(MOVE))) if (!order.includes(m)) order.push(m);
const stmtAt = pos => { let lo = 0, hi = body.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (body[mid].end <= pos) lo = mid + 1; else if (body[mid].start > pos) hi = mid - 1; else return mid; } return -1; };

// ---- top-level variables: owner, kind, references
const vars = new Map();      // name -> { owner, kind, isImport, refs: [{id, write, init, stmt}] , stmt }
for (const v of modScope.variables) {
  const def = v.defs[0];
  const isImport = def.type === 'ImportBinding';
  const st = stmtAt(def.name.start);
  const kind = def.type === 'FunctionName' ? 'function' : def.type === 'ClassName' ? 'class' : isImport ? 'import' : def.parent && def.parent.kind;
  vars.set(v.name, { name: v.name, owner: isImport ? null : modOf[st], stmt: st, kind, isImport, importDecl: isImport ? def.parent : null, importSpec: isImport ? def.node : null,
    refs: v.references.map(r => ({ id: r.identifier, write: r.isWrite(), init: !!r.init, stmt: stmtAt(r.identifier.start), from: r.from })) });
}
// names assigned from a module other than their owner must live on the shared object
const sharedNames = new Set();
for (const v of vars.values()) if (!v.isImport && v.refs.some(r => r.write && !r.init && modOf[r.stmt] !== v.owner)) sharedNames.add(v.name);

// parents, for shorthand properties
const parent = new Map();
walk.fullAncestor(ast, (node, st, anc) => { if (anc.length > 1) parent.set(node, anc[anc.length - 2]); });

// ---- edits
const edits = [];            // { start, end, text }
for (const name of sharedNames) {
  const v = vars.get(name);
  for (const r of v.refs) {
    if (r.init) continue;    // handled with the declaration
    const p = parent.get(r.id);
    if (p && p.type === 'Property' && p.shorthand && p.value === r.id) edits.push({ start: r.id.start, end: r.id.end, text: `${name}: shared.${name}` });
    else edits.push({ start: r.id.start, end: r.id.end, text: `shared.${name}` });
  }
}
const applyIn = (a, b, extra = []) => {
  const es = edits.concat(extra).filter(e => e.start >= a && e.end <= b).sort((x, y) => x.start - y.start);
  let out = '', pos = a;
  for (const e of es) { out += src.slice(pos, e.start) + e.text; pos = e.end; }
  return out + src.slice(pos, b);
};
// declarations holding shared names
const stmtEdits = new Map();  // stmt index -> replacement text for the statement
body.forEach((n, i) => {
  if (n.type !== 'VariableDeclaration' || !n.declarations.some(d => sharedNames.has(d.id.name))) return;
  const parts = [], keep = [];
  for (const d of n.declarations) {
    const init = d.init ? applyIn(d.init.start, d.init.end) : 'undefined';
    if (sharedNames.has(d.id.name)) parts.push(`shared.${d.id.name} = ${init};`);
    else keep.push(d.init ? `${d.id.name} = ${init}` : d.id.name);
  }
  stmtEdits.set(i, (keep.length ? `${n.kind} ${keep.join(', ')}; ` : '') + parts.join(' '));
});

// ---- module texts
const files = new Map();      // module -> { chunks: [], uses: Set(name) }
for (const m of order) files.set(m, { chunks: [], uses: new Set(), sharedUse: false, imports: new Map() });
let prevEnd = 0;
body.forEach((n, i) => {
  const lead = src.slice(prevEnd, n.start).replace(/^[ \t]*\n/, '');   // comments / blank lines before it
  prevEnd = n.end;
  if (n.type === 'ImportDeclaration') return;
  // keep a trailing comment on the same line
  let end = n.end; const nl = src.indexOf('\n', end); const tail = src.slice(end, nl < 0 ? src.length : nl);
  if (/^\s*\/\//.test(tail)) { end = nl < 0 ? src.length : nl; prevEnd = end; }
  const text = stmtEdits.has(i) ? stmtEdits.get(i) + src.slice(n.end, end) : applyIn(n.start, end);
  files.get(modOf[i]).chunks.push(lead + text);
});
// uses: every reference from a module to a top-level name owned elsewhere
const exportsOf = new Map(order.map(m => [m, new Set()]));
for (const v of vars.values()) for (const r of v.refs) {
  const m = modOf[r.stmt]; if (!m) continue;
  if (sharedNames.has(v.name)) { files.get(m).sharedUse = true; continue; }
  if (v.isImport) { files.get(m).imports.set(v.name, v); continue; }
  if (v.owner !== m) { files.get(m).uses.add(v.name); exportsOf.get(v.owner).add(v.name); }
}
// the owners of shared names write them; they need the import too
for (const n of sharedNames) files.get(vars.get(n).owner).sharedUse = true;

const rel = (from, to) => { let r = path.relative(path.dirname(from), to); if (!r.startsWith('.')) r = './' + r; return r + '.js'; };
fs.rmSync(OUT, { recursive: true, force: true });
const depsOf = new Map();
for (const m of order) {
  const f = files.get(m); const head = [];
  // external libraries
  const ext = new Map();
  for (const v of f.imports.values()) { const s = v.importDecl.source.value; if (!ext.has(s)) ext.set(s, []); ext.get(s).push(v); }
  for (const [s, vs] of ext) {
    const ns = vs.find(v => v.importSpec.type === 'ImportNamespaceSpecifier');
    if (ns) head.push(`import * as ${ns.name} from '${s}';`);
    const named = vs.filter(v => v.importSpec.type === 'ImportSpecifier').map(v => v.name);
    if (named.length) head.push(`import { ${named.join(', ')} } from '${s}';`);
  }
  if (f.sharedUse && m !== 'core/shared') head.push(`import { shared } from '${rel(m, 'core/shared')}';`);
  const byOwner = new Map();
  for (const nm of f.uses) { const o = vars.get(nm).owner; if (!byOwner.has(o)) byOwner.set(o, []); byOwner.get(o).push(nm); }
  const deps = [...byOwner.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  // load order: every module first loads the one before it, and the entry loads the last one. ES modules
  // run depth-first, skipping modules already being loaded, so this runs them in exactly the order the
  // app was written in, whatever else they import.
  const prev = order[order.indexOf(m) - 1];
  depsOf.set(m, prev ? [prev, ...deps] : deps);
  if (prev) head.unshift(`import '${rel(m, prev)}';          // load order: runs after ${prev}`);
  for (const o of deps) head.push(`import { ${byOwner.get(o).sort().join(', ')} } from '${rel(m, o)}';`);
  const exp = [...exportsOf.get(m)].sort();
  let text = (DESC[m] ? `// ${DESC[m]}\n` : '') + (head.length ? head.join('\n') + '\n\n' : '') + f.chunks.join('\n').replace(/^\n+/, '') + '\n';
  if (exp.length) text += `\nexport { ${exp.join(', ')} };\n`;
  const file = path.join(OUT, m + '.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
fs.mkdirSync(path.join(OUT, 'core'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'core/shared.js'),
  `// Top-level state that several modules assign (ES module imports are read-only, so it lives on one object).\n` +
  `// Each value is set by the module that owns it: ${[...sharedNames].sort().map(n => `${n} (${vars.get(n).owner})`).join(', ')}.\n` +
  `export const shared = {};\n`);
fs.writeFileSync(path.join(OUT, 'main.js'),
  `// Entry point. Each module imports the one before it first, so importing the last one runs them all,\n// in order: ${order.join(' > ')}.\nimport './${order[order.length - 1]}.js';\n`);

// ---- evaluation-order check
const evalOrder = [], seen = new Set();
const visit = m => { if (seen.has(m)) return; seen.add(m); for (const d of depsOf.get(m)) visit(d); evalOrder.push(m); };
visit(order[order.length - 1]);
const pos = new Map(evalOrder.map((m, i) => [m, i]));
// references made while a statement runs: not inside a nested function, plus everything inside
// top-level functions it calls (an over-approximation)
const inFn = s => { for (let x = s; x && x !== modScope; x = x.upper) if (x.type === 'function') return true; return false; };
const fnRefs = new Map();     // function name -> names it references (anywhere inside)
for (const v of vars.values()) if (v.kind === 'function' || (v.kind === 'const')) {
  const node = body[v.stmt];
  fnRefs.set(v.name, [...vars.values()].filter(w => w.refs.some(r => r.id.start >= node.start && r.id.end <= node.end && w.name !== v.name)).map(w => w.name));
}
const problems = [];
body.forEach((n, i) => {
  const m = modOf[i]; if (!m) return;
  const direct = new Set();
  for (const v of vars.values()) for (const r of v.refs) if (r.stmt === i && !inFn(r.from) && !r.init) direct.add(v.name);
  // follow calls
  const reach = new Set(direct), q = [...direct];
  while (q.length) { const nm = q.pop(); const v = vars.get(nm); if (v && v.kind === 'function') for (const w of fnRefs.get(nm) || []) if (!reach.has(w)) { reach.add(w); q.push(w); } }
  for (const nm of reach) {
    const v = vars.get(nm); if (!v || v.isImport || v.kind === 'function') continue;
    if (v.stmt > i) continue;        // declared later in the original file too: not a new problem
    if (sharedNames.has(nm)) { if (pos.get(v.owner) > pos.get(m)) problems.push(`${m}:${n.loc.start.line} reads shared ${nm} (set in ${v.owner}, which runs later)${direct.has(nm) ? ' DIRECT' : ''}`); continue; }
    if (v.owner !== m && pos.get(v.owner) > pos.get(m)) problems.push(`${m}:${n.loc.start.line} uses ${nm} from ${v.owner}, which runs later${direct.has(nm) ? ' DIRECT' : ''}`);
  }
});
const moved = evalOrder.filter((m, i) => order[i] !== m);
console.log(`${order.length} modules, ${sharedNames.size} shared names: ${[...sharedNames].join(', ')}`);
console.log('evaluation order differs from the original for', evalOrder.map((m, i) => order.indexOf(m) !== i ? m : null).filter(Boolean).length, 'modules');
console.log('eval order:', evalOrder.join(' > '));
console.log(problems.length + ' possible order problems');
for (const p of problems) console.log('  ' + p);
