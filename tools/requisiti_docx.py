"""Crea il file Word dei requisiti a partire da REQUISITI.md.

Uso: python3 tools/requisiti_docx.py REQUISITI.md uscita.docx
Serve pandoc. Le tabelle vengono poi rifinite (bordi, intestazione colorata, colonne).
"""
import subprocess, sys
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

src, out = sys.argv[1], sys.argv[2]
subprocess.run(['pandoc', src, '-f', 'markdown', '-t', 'docx', '-o', out], check=True)

doc = Document(out)
for s in doc.sections:
    s.left_margin = s.right_margin = Cm(1.8)
    s.top_margin = s.bottom_margin = Cm(1.8)
normal = doc.styles['Normal']
normal.font.name = 'Calibri'
normal.font.size = Pt(10.5)
for st in doc.styles:
    if st.name in ('Title', 'Subtitle') or st.name.lower().startswith('heading'):
        st.font.name = 'Calibri'
        st.font.color.rgb = RGBColor(0x13, 0x23, 0x3A)
names = {st.name for st in doc.styles}
if 'Title' in names: doc.styles['Title'].font.size = Pt(22)
for st in doc.styles:
    if st.name.lower().startswith('heading 1'):
        st.font.size = Pt(15)

STATE = {'Controllato': '9ED9B3', 'Fatto': 'D7F0DF', 'In corso': 'FFF1C7', 'Da fare': 'FDE2D6', 'Da confermare': 'E6EDF5', '✓': 'D7F0DF', '✓ dopo correzione': 'FFF1C7'}

def shade(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)

def borders(table):
    tblPr = table._tbl.tblPr
    b = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement('w:' + edge)
        e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), '4'); e.set(qn('w:color'), 'B8C4D2')
        b.append(e)
    tblPr.append(b)

import os
BP = os.path.basename(src).lower().startswith('business')
WIDTHS = {5: [1.9, 4.3, 3.2, 3.2, 4.8], 4: [2.3, 3.4, 7.2, 4.5], 3: [4.3, 5.4, 7.7], 2: [4.9, 12.5]} if BP else {5: [1.6, 7.4, 2.0, 2.0, 4.4], 4: [1.4, 10.6, 2.2, 3.2], 3: [1.6, 12.0, 3.8]}
for t in doc.tables:
    borders(t)
    n = len(t.columns)
    w = WIDTHS.get(n)
    if w and n == 3 and t.rows and t.rows[0].cells[0].text.strip() == 'Versione':
        w = [2.2, 2.4, 12.8]   # lo storico ha la descrizione nell'ultima colonna
    if w and n == 5 and len(t.rows) > 1 and t.rows[1].cells[0].text.strip().startswith('A-'):
        w = [1.4, 4.8, 2.0, 1.8, 7.4]   # struttura del software: spiegazioni lunghe nell'ultima colonna
    if w and n == 3 and t.rows and t.rows[0].cells[1].text.strip() == 'Esito':
        w = [3.4, 2.6, 11.4]   # la verifica: ID, esito, come è stato verificato
    if w:
        # pandoc crea colonne uguali: si fissano larghezze e griglia della tabella
        t.autofit = False
        tblPr = t._tbl.tblPr
        for old in tblPr.findall(qn('w:tblW')) + tblPr.findall(qn('w:tblLayout')):
            tblPr.remove(old)
        tw = OxmlElement('w:tblW'); tw.set(qn('w:w'), str(int(sum(w) * 567))); tw.set(qn('w:type'), 'dxa'); tblPr.append(tw)
        lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); tblPr.append(lay)
        for gc, cw in zip(t._tbl.tblGrid.findall(qn('w:gridCol')), w):
            gc.set(qn('w:w'), str(int(cw * 567)))
    for ri, row in enumerate(t.rows):
        for ci, cell in enumerate(row.cells):
            if w:
                cell.width = Cm(w[ci])
            for p in cell.paragraphs:
                p.paragraph_format.space_after = Pt(2)
                for r in p.runs:
                    r.font.size = Pt(9.5)
                    if ri == 0:
                        r.font.bold = True
                        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            if ri == 0:
                shade(cell, '13233A')
            else:
                txt = cell.text.strip()
                if txt in STATE:
                    shade(cell, STATE[txt])
doc.save(out)
print('ok', out)
