// Moves top-level declarations between modules of src/ and fixes every import and export.
//   node tools/move.mjs <from> <to> name1 name2 ...      (module paths relative to src/, without .js)
// The destination is created if needed. Imports that become unused are removed afterwards.
import fs from 'fs';
import path from 'path';
import * as acorn from 'acorn';
import { analyze } from '../node_modules/eslint-scope/lib/index.js';

const SRC = path.resolve('src');
const file = m => path.join(SRC, m + '.js');
const read = m => (fs.existsSync(file(m)) ? fs.readFileSync(file(m), 'utf8') : '');
const parse = s => acorn.parse(s, { ecmaVersion: 2022, sourceType: 'module', ranges: true, locations: true });
const relSpec = (from, to) => { let r = path.relative(path.dirname(file(from)), file(to)); if (!r.startsWith('.')) r = './' + r; return r; };
const modOfSpec = (from, spec) => path.relative(SRC, path.resolve(path.dirname(file(from)), spec)).replace(/\.js$/, '');
const allModules = () => { const out = []; const w = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) w(p); else if (p.endsWith('.js')) out.push(path.relative(SRC, p).replace(/\.js$/, '')); } }; w(SRC); return out; };
const declNames = n => n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration' ? [n.id.name] : n.type === 'VariableDeclaration' ? n.declarations.map(d => d.id.name) : [];

/** imports of a module: [{ spec, mod, names: [{imported, local}], ns, side, node }] */
function importsOf(m, s, ast) {
  return ast.body.filter(n => n.type === 'ImportDeclaration').map(n => ({
    node: n, spec: n.source.value, mod: n.source.value.startsWith('.') ? modOfSpec(m, n.source.value) : null,
    side: n.specifiers.length === 0, ns: n.specifiers.find(x => x.type === 'ImportNamespaceSpecifier')?.local.name,
    names: n.specifiers.filter(x => x.type === 'ImportSpecifier').map(x => ({ imported: x.imported.name, local: x.local.name })),
  }));
}
function exportsOf(ast) { const e = ast.body.find(n => n.type === 'ExportNamedDeclaration' && !n.declaration && !n.source); return e ? e.specifiers.map(x => x.local.name) : []; }
// rebuild a module from: header comment + side-effect imports + named imports + body + export list
function write(m, { header, sideImports, imports, body, exports }) {
  const lines = [];
  if (header) lines.push(header);
  for (const s of sideImports) lines.push(s);
  const ext = [], int = [];
  for (const [spec, v] of imports) {
    if (v.ns) ext.push(`import * as ${v.ns} from '${spec}';`);
    const names = [...v.names].sort();
    if (names.length) (spec.startsWith('.') ? int : ext).push(`import { ${names.join(', ')} } from '${spec}';`);
  }
  lines.push(...ext, ...int);
  let text = lines.join('\n') + '\n\n' + body.trim() + '\n';
  if (exports.size) text += `\nexport { ${[...exports].sort().join(', ')} };\n`;
  fs.mkdirSync(path.dirname(file(m)), { recursive: true });
  fs.writeFileSync(file(m), text);
}
function load(m) {
  const s = read(m);
  if (!s) return { header: '', sideImports: [], imports: new Map(), body: '', exports: new Set(), names: new Set() };
  const ast = parse(s);
  const header = (s.match(/^(\/\/[^\n]*\n)+/) || [''])[0].trimEnd();
  const imps = importsOf(m, s, ast), sideImports = [], imports = new Map();
  for (const i of imps) {
    if (i.side) { sideImports.push(s.slice(i.node.start, s.indexOf('\n', i.node.end) < 0 ? s.length : s.indexOf('\n', i.node.end))); continue; }
    const v = imports.get(i.spec) || { ns: null, names: new Set() };
    if (i.ns) v.ns = i.ns; for (const n of i.names) v.names.add(n.imported === n.local ? n.local : `${n.imported} as ${n.local}`);
    imports.set(i.spec, v);
  }
  const bodyNodes = ast.body.filter(n => n.type !== 'ImportDeclaration' && !(n.type === 'ExportNamedDeclaration' && !n.declaration));
  const first = bodyNodes[0], last = bodyNodes[bodyNodes.length - 1];
  // body text: from after the last import line (keeping comments) to the end of the last statement (plus same-line comment)
  const lastImp = ast.body.filter(n => n.type === 'ImportDeclaration').pop();
  let bStart = lastImp ? s.indexOf('\n', lastImp.end) + 1 : header.length;
  let bEnd = last ? last.end : bStart; const nl = s.indexOf('\n', bEnd); if (/^\s*\/\//.test(s.slice(bEnd, nl < 0 ? s.length : nl))) bEnd = nl;
  return { s, ast, header, sideImports, imports, body: first ? s.slice(bStart, bEnd) : '', exports: new Set(exportsOf(ast)), names: new Set(bodyNodes.flatMap(declNames)) };
}

export function move(from, to, names) {
  const F = load(from), T = load(to);
  const want = new Set(names);
  // the statements to move, each with the comment lines just above it
  const nodes = F.ast.body.filter(n => declNames(n).some(x => want.has(x)));
  for (const n of nodes) if (!declNames(n).every(x => want.has(x))) throw new Error(`${declNames(n).join(',')} are declared together: move all of them`);
  const s = F.s; let moved = '', bodyText = F.body;
  for (const n of nodes) {
    let a = n.start; const before = s.slice(0, a); const m = before.match(/((?:^|\n)[ \t]*\/\/[^\n]*)+\n?$/);
    if (m) a = before.length - m[0].length + (m[0].startsWith('\n') ? 1 : 0);
    let b = n.end; const nl = s.indexOf('\n', b); if (/^\s*\/\//.test(s.slice(b, nl < 0 ? s.length : nl))) b = nl;
    const chunk = s.slice(a, b);
    moved += chunk + '\n';
    bodyText = bodyText.replace(chunk, '');
  }
  const movedNames = nodes.flatMap(declNames);
  // free names of the moved code: resolve them against the source module
  const ast2 = parse(moved);
  const sc = analyze(ast2, { ecmaVersion: 2022, sourceType: 'module' });
  const through = new Set(sc.globalScope.through.map(r => r.identifier.name).concat(sc.globalScope.childScopes.flatMap(c => c.through.map(r => r.identifier.name))));
  for (const nm of through) {
    if (movedNames.includes(nm)) continue;
    if (F.names.has(nm)) { addImport(T, relSpec(to, from), nm); F.exports.add(nm); continue; }
    for (const [spec, v] of F.imports) {
      if (v.ns === nm) { const sp = spec.startsWith('.') ? relSpec(to, modOfSpec(from, spec)) : spec; const t = T.imports.get(sp) || { ns: null, names: new Set() }; t.ns = nm; T.imports.set(sp, t); }
      if (v.names.has(nm)) addImport(T, spec.startsWith('.') ? relSpec(to, modOfSpec(from, spec)) : spec, nm);
    }
  }
  T.body = (T.body ? T.body.trimEnd() + '\n' : '') + moved;
  for (const nm of movedNames) { if (F.exports.delete(nm)) T.exports.add(nm); }
  F.body = bodyText;
  // the source still uses some moved names?
  const restAst = parse(F.body.replace(/^/, ''));
  const restUses = new Set(analyze(restAst, { ecmaVersion: 2022, sourceType: 'module' }).globalScope.through.map(r => r.identifier.name));
  for (const nm of movedNames) if (restUses.has(nm)) { addImport(F, relSpec(from, to), nm); T.exports.add(nm); }
  // a module importing itself makes no sense
  T.imports.delete(relSpec(to, to)); F.imports.delete(relSpec(from, from));
  write(from, F); write(to, T);
  // every other module: import moved names from the new place
  for (const m of allModules()) {
    if (m === from || m === to) continue;
    const M = load(m); let changed = false;
    for (const [spec, v] of [...M.imports]) {
      if (!spec.startsWith('.') || modOfSpec(m, spec) !== from) continue;
      for (const nm of [...v.names]) if (movedNames.includes(nm.split(' as ')[0])) { v.names.delete(nm); addImport(M, relSpec(m, to), nm); changed = true; T.exports.add(nm.split(' as ')[0]); }
      if (!v.names.size && !v.ns) M.imports.delete(spec);
    }
    if (changed) write(m, M);
  }
  write(to, T);
  for (const m of [from, to]) pruneImports(m);
}
function addImport(M, spec, nm) { const v = M.imports.get(spec) || { ns: null, names: new Set() }; v.names.add(nm); M.imports.set(spec, v); }
// drop imported names a module no longer uses
export function pruneImports(m) {
  const M = load(m); if (!M.ast) return;
  const sc = analyze(M.ast, { ecmaVersion: 2022, sourceType: 'module' });
  const modScope = sc.globalScope.childScopes.find(s => s.type === 'module');
  const unused = new Set(modScope.variables.filter(v => v.defs[0].type === 'ImportBinding' && v.references.length === 0 && !M.exports.has(v.name)).map(v => v.name));
  if (!unused.size) return;
  for (const [spec, v] of [...M.imports]) {
    for (const nm of [...v.names]) if (unused.has(nm.split(' as ').pop())) v.names.delete(nm);
    if (v.ns && unused.has(v.ns)) v.ns = null;
    if (!v.names.size && !v.ns) M.imports.delete(spec);
  }
  write(m, M);
}

if (process.argv[1] && process.argv[1].endsWith('move.mjs')) {
  const [from, to, ...names] = process.argv.slice(2);
  move(from, to, names);
  console.log(`moved ${names.join(', ')}: ${from} -> ${to}`);
}
