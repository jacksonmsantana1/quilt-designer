"""Merge the atelier-finder results (JSON files) into one list and write it as a spreadsheet.

    python3 research/ateliers/build_sheet.py [result.json ...]

With no arguments it rebuilds from research/ateliers/ateliers.json (the merged list kept in the repo).
Writes ateliers.json, ateliers.csv, ateliers.xlsx and ateliers.html (a page to browse the list, made from
page_template.html) next to this script.
"""

import csv
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

HERE = Path(__file__).resolve().parent

# (json key, column header, column width)
COLUMNS = [
    ('name', 'Name', 34),
    ('type', 'Type', 22),
    ('state', 'State', 7),
    ('city', 'City', 18),
    ('neighborhood', 'Neighborhood', 16),
    ('address', 'Address', 38),
    ('cep', 'CEP', 11),
    ('phone', 'Phone', 20),
    ('whatsapp', 'WhatsApp', 20),
    ('email', 'Email', 30),
    ('website', 'Website', 32),
    ('instagram', 'Instagram', 22),
    ('facebook', 'Facebook', 30),
    ('contact_person', 'Contact person', 20),
    ('services', 'Services', 40),
    ('online_store', 'Online store', 11),
    ('online_classes', 'Online classes', 11),
    ('hours', 'Opening hours', 22),
    ('status', 'Status', 13),
    ('notes', 'Notes', 40),
    ('source', 'Source', 40),
    ('confidence', 'Confidence', 11),
]
KEYS = [c[0] for c in COLUMNS]

REGIONS = {
    'Norte': ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
    'Nordeste': ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
    'Centro-Oeste': ['DF', 'GO', 'MS', 'MT'],
    'Sudeste': ['ES', 'MG', 'RJ', 'SP'],
    'Sul': ['PR', 'RS', 'SC'],
    'Online / nationwide': ['Online'],
    'City not found': ['Unknown'],
}

FONT = 'Arial'


def plain(text):
    """Lowercase, no accents, letters and digits only: used to spot the same business twice."""
    text = unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]', '', text.lower())


# Words that say what kind of business it is, not which one: ignored when matching names
GENERIC = re.compile(r'atelie[r]?|loja|tecidos|cursos?|escola|patchwork|quilting|quilt|artesanato|e(?=[a-z])|by|de|do|da')


def core(name):
    """The distinctive part of a name: 'Ateliê Ana Cosentino - Patchwork & Quilt' -> 'anacosentino'."""
    words = re.findall(r'[a-z0-9]+', unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower())
    return ''.join(w for w in words if not GENERIC.fullmatch(w))


def clean(row):
    out = {k: str(row.get(k, '') or '').strip() for k in KEYS}
    out['state'] = out['state'].upper() if len(out['state']) == 2 else out['state']
    out['state'] = out['state'] or 'Unknown'
    return out


def same_business(a, b):
    if plain(a['name']) == plain(b['name']) and plain(a['city']) == plain(b['city']):
        return True
    if a['instagram'] and plain(a['instagram']) == plain(b['instagram']):
        return True
    if a['phone'] and re.sub(r'\D', '', a['phone']) == re.sub(r'\D', '', b['phone']):
        return True
    # An online-only or unplaced row and a row with a city: same business when the distinctive names match
    if not a['city'] or not b['city']:
        ca, cb = core(a['name']), core(b['name'])
        return len(ca) >= 8 and len(cb) >= 8 and (ca in cb or cb in ca)
    return False


def merge(rows):
    """Drop duplicates, keeping the first record and filling its gaps from the later one.

    Pass files with cities before online-only ones, so the merged record keeps its city."""
    kept = []
    for row in rows:
        twin = next((other for other in kept if same_business(row, other)), None)
        if twin is None:
            kept.append(row)
        else:
            for k in KEYS:  # fill the gaps of the first record from the second
                if not twin[k] and row[k]:
                    twin[k] = row[k]
    return sorted(kept, key=lambda r: (r['state'] in ('Online', 'Unknown'), r['state'], plain(r['city']), plain(r['name'])))


def link(value, key):
    """The clickable address for a cell, when there is one."""
    if key in ('website', 'facebook') and value.startswith('http'):
        return value
    if key == 'instagram' and value.startswith('@'):
        return 'https://www.instagram.com/' + value[1:]
    if key == 'email' and '@' in value and ' ' not in value:
        return 'mailto:' + value
    if key == 'whatsapp':
        digits = re.sub(r'\D', '', value)
        if len(digits) >= 12:
            return 'https://wa.me/' + digits
    return None


def write_xlsx(rows, path):
    wb = Workbook()
    head_font = Font(name=FONT, bold=True, color='FFFFFF')
    head_fill = PatternFill('solid', start_color='7A3E5C')
    body_font = Font(name=FONT, size=10)
    link_font = Font(name=FONT, size=10, color='1F5FBF', underline='single')
    wrap = Alignment(vertical='top', wrap_text=True)

    # Sheet 1: the list
    ws = wb.active
    ws.title = 'Ateliers'
    for col, (_, header, width) in enumerate(COLUMNS, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font, cell.fill = head_font, head_fill
        cell.alignment = Alignment(vertical='center', wrap_text=True)
        ws.column_dimensions[get_column_letter(col)].width = width
    for r, row in enumerate(rows, 2):
        for col, key in enumerate(KEYS, 1):
            value = row[key]
            cell = ws.cell(row=r, column=col, value=value or None)
            cell.alignment = wrap
            url = link(value, key)
            if url:
                cell.hyperlink = url
                cell.font = link_font
            else:
                cell.font = body_font
    last = get_column_letter(len(COLUMNS))
    table = Table(displayName='Ateliers', ref=f'A1:{last}{max(len(rows), 1) + 1}')
    table.tableStyleInfo = TableStyleInfo(name='TableStyleLight9', showRowStripes=True)
    ws.add_table(table)
    ws.freeze_panes = 'B2'
    ws.row_dimensions[1].height = 30

    # Sheet 2: counts, as formulas over the list so they follow any edits
    n = len(rows) + 1
    sm = wb.create_sheet('Summary')
    for col, header in enumerate(['Region', 'State', 'Ateliers', 'With phone', 'With email', 'With Instagram'], 1):
        c = sm.cell(row=1, column=col, value=header)
        c.font, c.fill = head_font, head_fill
    r = 2
    for region, states in REGIONS.items():
        for st in states:
            sm.cell(row=r, column=1, value=region)
            sm.cell(row=r, column=2, value=st)
            sm.cell(row=r, column=3, value=f'=COUNTIF(Ateliers!$C$2:$C${n},B{r})')
            sm.cell(row=r, column=4, value=f'=COUNTIFS(Ateliers!$C$2:$C${n},B{r},Ateliers!$H$2:$H${n},"<>")')
            sm.cell(row=r, column=5, value=f'=COUNTIFS(Ateliers!$C$2:$C${n},B{r},Ateliers!$J$2:$J${n},"<>")')
            sm.cell(row=r, column=6, value=f'=COUNTIFS(Ateliers!$C$2:$C${n},B{r},Ateliers!$L$2:$L${n},"<>")')
            r += 1
    sm.cell(row=r, column=1, value='Total')
    for col in range(3, 7):
        letter = get_column_letter(col)
        sm.cell(row=r, column=col, value=f'=SUM({letter}2:{letter}{r - 1})')
    for row in sm.iter_rows(min_row=2, max_row=r):
        for c in row:
            c.font = Font(name=FONT, size=10, bold=(c.row == r))
    for col, width in zip('ABCDEF', (20, 9, 10, 12, 12, 14)):
        sm.column_dimensions[col].width = width
    sm.freeze_panes = 'A2'

    # Sheet 3: how the list was made
    ab = wb.create_sheet('About')
    notes = [
        ('Quilting ateliers in Brazil', True),
        (f'Collected from public web pages on {date.today().isoformat()} by the quilt-atelier-finder agent '
         '(.claude/agents/quilt-atelier-finder.md).', False),
        ('Every phone, email and address comes from the page(s) in the Source column; nothing was guessed. '
         'Empty cell = not found.', False),
        ('November 2026 run: the pages themselves could not be opened from the research environment, so details were '
         'read from search-engine excerpts of those pages. Check before relying on them.', False),
        ('Contacts change: call or message before visiting. Rows marked "possibly closed" or confidence "low" '
         'need checking first.', False),
        ('Type: Ateliê (makes quilts), Escola (classes), Loja (sells fabric/notions), Quiltagem (longarm service), '
         'Grupo (guild, association or festival).', False),
        ('Confidence: high = own site or social page, recent; medium = directory or older page; '
         'low = only a passing mention.', False),
        ('Summary sheet counts are formulas over the Ateliers sheet, so they update when you add or remove rows.',
         False),
        ('To refresh: ask Claude to run the quilt-atelier-finder agent, then python3 research/ateliers/build_sheet.py '
         '<new results.json> research/ateliers/ateliers.json', False),
    ]
    for i, (text, bold) in enumerate(notes, 1):
        c = ab.cell(row=i, column=1, value=text)
        c.font = Font(name=FONT, size=13 if bold else 10, bold=bold)
        c.alignment = Alignment(wrap_text=True, vertical='top')
    ab.column_dimensions['A'].width = 110

    wb.save(path)


def write_page(rows, path):
    data = json.dumps(rows, ensure_ascii=False).replace('</', '<\\/')  # never close the <script> early
    page = (HERE / 'page_template.html').read_text(encoding='utf-8')
    page = page.replace('/*DATA*/[]', data, 1).replace('/*BUILT*/', date.today().strftime('%B %Y'), 1)
    path.write_text(page, encoding='utf-8')


def main(paths):
    sources = [Path(p) for p in paths] or [HERE / 'ateliers.json']
    rows = []
    for p in sources:
        rows += [clean(r) for r in json.loads(p.read_text(encoding='utf-8')) if (r.get('name') or '').strip()]
    rows = merge(rows)
    (HERE / 'ateliers.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    with open(HERE / 'ateliers.csv', 'w', newline='', encoding='utf-8-sig') as f:  # BOM so Excel reads accents
        w = csv.writer(f)
        w.writerow([c[1] for c in COLUMNS])
        w.writerows([[r[k] for k in KEYS] for r in rows])
    write_xlsx(rows, HERE / 'ateliers.xlsx')
    write_page(rows, HERE / 'ateliers.html')
    print(f'{len(rows)} ateliers -> {HERE / "ateliers.xlsx"}')


if __name__ == '__main__':
    main(sys.argv[1:])
