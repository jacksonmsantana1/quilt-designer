import subprocess, os, json, re, base64, hashlib
# bundle the ES modules in src/ into one script (the three.js libraries stay external: the page's import map loads them)
# run from app/; npm workspaces put the tools in the repository's node_modules
# (on Windows .bin/esbuild is a shell script Windows can't run; esbuild.cmd is its launcher, and cmd.exe needs \ paths)
ESBUILD = os.environ.get('ESBUILD', os.path.join('..', 'node_modules', '.bin', 'esbuild.cmd' if os.name == 'nt' else 'esbuild'))
# COVERAGE=1: with an inline source map, so the browser tests' coverage maps back to src/ (not for publishing)
MAP = ['--sourcemap=inline', '--sources-content=true'] if os.environ.get('COVERAGE') else []
subprocess.run([ESBUILD, 'src/main.js', '--bundle', '--format=esm', '--external:three', '--external:three/*',
                '--external:three-gpu-pathtracer', '--outfile=dist/app.js', '--log-level=warning'] + MAP, check=True)
# utf-8 everywhere: Windows would otherwise use its own code page and fail on the page's symbols
# (reading converts any CRLF to LF already)
t=open('template.html', encoding='utf-8').read()
t=t.replace('/*PHYSICS*/', open('physics.js', encoding='utf-8').read()).replace('/*MAIN*/', open('dist/app.js', encoding='utf-8').read())
t=t.replace("  @media (prefers-reduced-motion","  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }\n  @media (prefers-reduced-motion",1)
# the libraries' fingerprints go into the import map: the browser refuses a file on the CDN that doesn't match
libs = json.loads(subprocess.run(['node', os.path.join('tools', 'import-integrity.mjs')], check=True, capture_output=True, encoding='utf-8').stdout)
t = t.replace('"imports": {', '"integrity": ' + json.dumps(libs['integrity'], indent=2) + ',\n  "imports": {', 1)
open('quilt.html','w', encoding='utf-8', newline='\n').write(t) # newline: the same file on Windows (not CRLF)
# the security headers for the host (Cloudflare Pages reads a file called _headers): only the page's own scripts, by
# their fingerprints, and those libraries run. Not in the page itself, which also gets published inside claude.ai.
own = ["'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode() + "'"
       for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', t, re.S)]
csp = '; '.join([
  "default-src 'self'",
  'script-src ' + ' '.join(own + libs['prefixes']),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: http://localhost:* http://127.0.0.1:*",
  "media-src 'self' data: blob:",
  "connect-src 'self' https: blob: data: http://localhost:* http://127.0.0.1:*",
  "worker-src 'self' blob:",
  'frame-src https://' + re.search(r"domain: '([^']+)'", open(os.path.join('src', 'storage', 'auth0.js'), encoding='utf-8').read()).group(1),
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
])
open(os.path.join('dist', '_headers'), 'w', encoding='utf-8', newline='\n').write('\n'.join([
  '/*',
  '  Content-Security-Policy: ' + csp,
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Strict-Transport-Security: max-age=31536000',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
  '',
]))
print(len(t))
