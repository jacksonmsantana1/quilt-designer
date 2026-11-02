# Stand-alone copy: one HTML file with every asset inlined, for opening directly in a browser.
import base64, re, mimetypes
html = open('quilt.html').read()
def uri(path):
    mt = {'json': 'application/json', 'jpg': 'image/jpeg', 'png': 'image/png', 'mp4': 'video/mp4'}[path.rsplit('.', 1)[1]]
    return f'data:{mt};base64,' + base64.b64encode(open(path, 'rb').read()).decode()
# the welcome page's clips: only the MP4s, which every browser plays, to keep the file small
html = re.sub(r'<source src="assets/clips/[a-z_]+\.webm"[^>]*>', '', html)
paths = sorted(set(re.findall(r"assets/[a-z_/]+\.(?:json|jpg|png|mp4)", html)))
for p in paths: html = html.replace(p, uri(p))
html = html.replace('<head>', '<head><style>*,*::before,*::after{box-sizing:border-box}body{margin:0}</style>', 1)
open('/tmp/outputs/quilt_designer.html', 'w').write(html)
print(len(paths), 'assets inlined')
