# -*- coding: utf-8 -*-
"""_dump-yq125.py — 把 YJ-Q-125 转出的 docx 逐段/逐表打印(含合并单元格还原),用于设计检验项目落库。
一次性分析脚本(2026-10-09),只读,不改文档。"""
import sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

SRC = sys.argv[1] if len(sys.argv) > 1 else "YJ-Q-125.docx"
OUT = sys.argv[2] if len(sys.argv) > 2 else "_dump-yq125.out.txt"
doc = Document(SRC)

_fh = open(OUT, "w", encoding="utf-8", newline="\n")


def print(*a, **kw):          # noqa: A001 — 覆写内置 print:本脚本所有输出一律 UTF-8 落文件
    kw.pop("file", None)
    _fh.write(" ".join(str(x) for x in a) + kw.get("end", "\n"))


def iter_block_items(parent):
    body = parent.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)


def cell_text(cell):
    return " / ".join(p.text.strip() for p in cell.paragraphs if p.text.strip())


print("=" * 100)
print("段落 + 表格(按文档顺序)")
print("=" * 100)
ti = 0
for block in iter_block_items(doc):
    if isinstance(block, Paragraph):
        t = block.text.strip()
        if t:
            print(f"[P] {t}")
    else:
        ti += 1
        rows, cols = len(block.rows), len(block.columns)
        print(f"\n--- TABLE #{ti}  {rows} 行 × {cols} 列 ---")
        for ri, row in enumerate(block.rows):
            cells = []
            seen = set()
            for c in row.cells:
                key = id(c._tc)
                if key in seen:                      # 合并单元格:同一 tc 只打一次,标"↑合并"
                    cells.append("↑合并")
                    continue
                seen.add(key)
                cells.append(cell_text(c))
            print(f"  R{ri:<2} | " + " | ".join(cells))
        print()

print("=" * 100)
print("节/页面设置")
print("=" * 100)
for i, s in enumerate(doc.sections):
    print(f"section {i}: page {s.page_width} x {s.page_height}, margins L{s.left_margin} R{s.right_margin}")
