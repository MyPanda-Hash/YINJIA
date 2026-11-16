"""_pdf2png.py — 把 printToPDF 出来的追溯弹窗 PDF 转成 PNG(PyMuPDF,本机已装)。
用法: python _pdf2png.py <pdf> <outdir>
产出:<outdir>/page-NN.png(逐页),以及总览拼接图 <outdir>/trace-dialog-8091.png(全部页纵向拼接)。
"""
import sys, os
import fitz  # PyMuPDF

pdf_path = sys.argv[1]
outdir = sys.argv[2]
os.makedirs(outdir, exist_ok=True)

doc = fitz.open(pdf_path)
print(f"pages={doc.page_count}")
paths = []
for i, page in enumerate(doc):
    txt = page.get_text("text")
    hit = "完工数据" in txt
    print(f"page {i+1}: {len(txt)} chars  完工数据={'YES' if hit else 'no'}")
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    p = os.path.join(outdir, f"page-{i+1:02d}.png")
    pix.save(p)
    paths.append((p, pix.width, pix.height))

# 纵向拼接
from PIL import Image
imgs = [Image.open(p) for p, _, _ in paths]
maxw = max(im.width for im in imgs)
total_h = sum(im.height for im in imgs)
canvas = Image.new("RGB", (maxw, total_h), "white")
y = 0
for im in imgs:
    canvas.paste(im, (0, y))
    y += im.height
combined = os.path.join(outdir, "trace-dialog-8091.png")
canvas.save(combined)
print("combined:", combined, canvas.size)
