import subprocess, os
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
open('quilt.html','w', encoding='utf-8', newline='\n').write(t) # newline: the same file on Windows (not CRLF)
print(len(t))
