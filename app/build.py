import subprocess, os, json, re, base64, hashlib
# bundle the ES modules in src/ into one script (the three.js libraries stay external: the page's import map loads them)
# run from app/; npm workspaces put the tools in the repository's node_modules
# (on Windows .bin/esbuild is a shell script Windows can't run; esbuild.cmd is its launcher, and cmd.exe needs \ paths)
ESBUILD = os.environ.get('ESBUILD', os.path.join('..', 'node_modules', '.bin', 'esbuild.cmd' if os.name == 'nt' else 'esbuild'))
# COVERAGE=1: with an inline source map, so the browser tests' coverage maps back to src/ (not for publishing)
MAP = ['--sourcemap=inline', '--sources-content=true'] if os.environ.get('COVERAGE') else []
# PUBLISH_DIR (tools/publish.mjs): the page and its headers go there, with the published page's settings, and the
# ordinary build (quilt.html, dist/) is left as it is
PUBLISH = os.environ.get('PUBLISH_DIR')
BUNDLE = os.path.join(PUBLISH, 'app.js') if PUBLISH else os.path.join('dist', 'app.js')
subprocess.run([ESBUILD, 'src/main.js', '--bundle', '--format=esm', '--external:three', '--external:three/*',
                '--external:three-gpu-pathtracer', '--outfile=' + BUNDLE, '--log-level=warning'] + MAP, check=True)
# utf-8 everywhere: Windows would otherwise use its own code page and fail on the page's symbols
# (reading converts any CRLF to LF already)
t=open('template.html', encoding='utf-8').read()
t=t.replace('/*PHYSICS*/', open('physics.js', encoding='utf-8').read()).replace('/*MAIN*/', open(BUNDLE, encoding='utf-8').read())
t=t.replace("  @media (prefers-reduced-motion","  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }\n  @media (prefers-reduced-motion",1)
# the libraries' fingerprints go into the import map: the browser refuses a file on the CDN that doesn't match
libs = json.loads(subprocess.run(['node', os.path.join('tools', 'import-integrity.mjs'), BUNDLE], check=True, capture_output=True, encoding='utf-8').stdout)
t = t.replace('"imports": {', '"integrity": ' + json.dumps(libs['integrity'], indent=2) + ',\n  "imports": {', 1)
if PUBLISH:
  for name in ['API_URL', 'SENTRY_DSN', 'RELEASE']:
    if os.environ.get(name): t = t.replace('@@' + name + '@@', os.environ[name])
  os.remove(BUNDLE) # now inside the page
open(os.path.join(PUBLISH, 'index.html') if PUBLISH else 'quilt.html','w', encoding='utf-8', newline='\n').write(t) # newline: the same file on Windows (not CRLF)
# the security headers for the host (Cloudflare Pages reads a file called _headers): only the page's own scripts, by
# their fingerprints, and those libraries run. Not in the page itself, which also gets published inside claude.ai.
own = ["'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode() + "'"
       for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', t, re.S)]
# online, the page has no business with this computer; Sentry's library only where reports are on
here = '' if PUBLISH else ' http://localhost:* http://127.0.0.1:*'
sentry = [re.search(r"LIBRARY = '(.*/)[^/]*'", open(os.path.join('src', 'ui', 'error-reports.js'), encoding='utf-8').read()).group(1)]
csp = '; '.join([
  "default-src 'self'",
  'script-src ' + ' '.join(own + libs['prefixes'] + (sentry if os.environ.get('SENTRY_DSN') else [])),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:" + here,
  "media-src 'self' data: blob:",
  "connect-src 'self' https: blob: data:" + here,
  "worker-src 'self' blob:",
  'frame-src https://' + re.search(r"domain: '([^']+)'", open(os.path.join('src', 'storage', 'auth0.js'), encoding='utf-8').read()).group(1),
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
])
open(os.path.join(PUBLISH or 'dist', '_headers'), 'w', encoding='utf-8', newline='\n').write('\n'.join([
  '/*',
  '  Content-Security-Policy: ' + csp,
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Strict-Transport-Security: max-age=31536000',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
  '',
]))
print(len(t))
