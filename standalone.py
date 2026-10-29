# Stand-alone copy: one HTML file with every asset inlined, for opening directly in a browser
# (where the webcam permission prompt works).
import base64, re, mimetypes
html = open('quilt.html').read()
def uri(path):
    mt = {'json': 'application/json', 'jpg': 'image/jpeg', 'png': 'image/png'}[path.rsplit('.', 1)[1]]
    return f'data:{mt};base64,' + base64.b64encode(open(path, 'rb').read()).decode()
paths = sorted(set(re.findall(r"assets/[a-z_/]+\.(?:json|jpg|png)", html)))
for p in paths: html = html.replace(p, uri(p))
head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>*,*::before,*::after{box-sizing:border-box}body{margin:0}</style></head><body>'
open('/tmp/outputs/quilt_designer.html', 'w').write(head + html + '</body></html>')
print(len(paths), 'assets inlined')
