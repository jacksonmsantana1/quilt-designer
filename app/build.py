import subprocess, os
# bundle the ES modules in src/ into one script (the three.js libraries stay external: the page's import map loads them)
# run from app/; npm workspaces put the tools in the repository's node_modules
ESBUILD = os.environ.get('ESBUILD', '../node_modules/.bin/esbuild')
# COVERAGE=1: with an inline source map, so the browser tests' coverage maps back to src/ (not for publishing)
MAP = ['--sourcemap=inline', '--sources-content=true'] if os.environ.get('COVERAGE') else []
subprocess.run([ESBUILD, 'src/main.js', '--bundle', '--format=esm', '--external:three', '--external:three/*',
                '--external:three-gpu-pathtracer', '--outfile=dist/app.js', '--log-level=warning'] + MAP, check=True)
t=open('template.html').read()
t=t.replace('/*PHYSICS*/', open('physics.js').read()).replace('/*MAIN*/', open('dist/app.js').read())
t=t.replace("  @media (prefers-reduced-motion","  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }\n  @media (prefers-reduced-motion",1)
open('quilt.html','w').write(t)
print(len(t))
