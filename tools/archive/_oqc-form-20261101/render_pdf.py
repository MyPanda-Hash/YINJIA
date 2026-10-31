# -*- coding: utf-8 -*-
"""render_pdf.py — PDF 页 → PNG(用 pymupdf;仓库内私有依赖 pylibs)"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pylibs'))
import fitz

pdf = sys.argv[1]
prefix = sys.argv[2] if len(sys.argv) > 2 else 'page'
zoom = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0   # 2.0 ≈ 144dpi
doc = fitz.open(pdf)
print('pages =', doc.page_count, 'size =', doc[0].rect)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    out = f'{prefix}-{i + 1}.png'
    pix.save(out)
    print('[written]', out, pix.width, 'x', pix.height)
