# -*- coding: utf-8 -*-
"""Dump a .docx layout: paragraphs + tables (grid, spans, merges, widths, text)."""
import sys
from docx import Document
from docx.shared import Twips

path = sys.argv[1] if len(sys.argv) > 1 else 'source.docx'
doc = Document(path)

def fmt_cell(cell):
    tc = cell._tc
    tcPr = tc.tcPr
    span = None
    vm = None
    if tcPr is not None:
        gs = tcPr.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}gridSpan')
        if gs is not None:
            span = int(gs.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val'))
        vmerge = tcPr.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}vMerge')
        if vmerge is not None:
            vm = vmerge.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val') or 'cont'
    text = ' '.join(p.text.strip() for p in cell.paragraphs if p.text.strip())
    return text, span, vm

body = doc.element.body
from docx.table import Table
from docx.text.paragraph import Paragraph

tbl_i = 0
para_i = 0
for child in body.iterchildren():
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        p = Paragraph(child, doc)
        t = p.text.strip()
        if t:
            print(f'[P{para_i}] {t!r}')
        para_i += 1
    elif tag == 'tbl':
        tbl = Table(child, doc)
        print(f'\n===== TABLE {tbl_i}: rows={len(tbl.rows)} cols={len(tbl.columns)} =====')
        # grid widths
        grid = child.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tblGrid')
        if grid is not None:
            ws = [g.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w') for g in grid]
            print('  gridWidths(twips):', ws)
        tblPr = child.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tblPr')
        if tblPr is not None:
            jc = tblPr.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}jc')
            if jc is not None:
                print('  align:', jc.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val'))
        for ri, row in enumerate(tbl.rows):
            trPr = row._tr.trPr
            h = None
            if trPr is not None:
                trh = trPr.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}trHeight')
                if trh is not None:
                    h = (trh.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val'),
                         trh.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hRule'))
            cells = []
            for cell in row.cells:
                text, span, vm = fmt_cell(cell)
                marker = ''
                if span and span > 1:
                    marker += f'<span{span}>'
                if vm:
                    marker += f'<vm:{vm}>'
                cells.append(f'{marker}{text!r}')
            print(f'  R{ri} h={h}: ' + ' | '.join(cells))
        print(f'===== END TABLE {tbl_i} =====\n')
        tbl_i += 1

print('\n--- SECTIONS ---')
for s in doc.sections:
    print('page', s.page_width, s.page_height, 'margins L/R/T/B',
          s.left_margin, s.right_margin, s.top_margin, s.bottom_margin)
