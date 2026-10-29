import subprocess, os
# bundle the ES modules in src/ into one script (the three.js libraries stay external: the page's import map loads them)
ESBUILD = os.environ.get('ESBUILD', '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules/.bin/esbuild')
subprocess.run([ESBUILD, 'src/main.js', '--bundle', '--format=esm', '--external:three', '--external:three/*',
                '--external:three-gpu-pathtracer', '--outfile=dist/app.js', '--log-level=warning'], check=True)
t=open('template.html').read()
t=t.replace('/*PHYSICS*/', open('physics.js').read()).replace('/*MAIN*/', open('dist/app.js').read())
t=t.replace("  @media (prefers-reduced-motion","  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }\n  @media (prefers-reduced-motion",1)
open('quilt.html','w').write(t)
print(len(t))
