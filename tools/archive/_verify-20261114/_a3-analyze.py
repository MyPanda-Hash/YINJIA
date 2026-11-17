"""_a3-analyze.py — 分析 A3 导出的 xlsx / PDF 产物(只读,产出证据到 stdout)。

用法(仓根):
  python tools/archive/_verify-20261114/_a3-analyze.py <xlsx> <pdf>
"""
import sys, re, zlib, io, os
from collections import Counter

def analyze_xlsx(path):
    from openpyxl import load_workbook
    wb = load_workbook(path)
    ws = wb.active
    print(f"[XLSX] {os.path.basename(path)} sheets={wb.sheetnames} size={os.path.getsize(path)}B dims={ws.dimensions}")
    rows = [[('' if c.value is None else str(c.value)) for c in r] for r in ws.iter_rows()]
    print(f"[XLSX] rowCount={len(rows)}")
    for i, r in enumerate(rows[:6]):
        nonempty = [(j, v) for j, v in enumerate(r) if v.strip()]
        print(f"[XLSX] row{i+1} nonEmptyCells={len(nonempty)} first={nonempty[:12]}")
    flat = [v.strip() for r in rows for v in r]
    slash = sum(1 for v in flat if v == '/')
    print(f"[XLSX] exactSlashCells={slash}")
    for kw in ['12.3', '50cm', '31']:
        print(f"[XLSX] contains {kw!r} = {any(v == kw for v in flat)}")
    bad_headers = [k for k in ['行类型', '检验列'] if any(v == k for v in flat)]
    print(f"[XLSX] longTableHeaders(行类型/检验列)={bad_headers}")
    head = rows[0] if rows else []
    print(f"[XLSX] firstRowFirstCells={head[:8]}")
    return {'slash': slash, 'bad': bad_headers}

def pdf_objects(data):
    objs = {}
    for m in re.finditer(rb'(\d+)\s+0\s+obj(.*?)endobj', data, re.S):
        objs[int(m.group(1))] = m.group(2)
    return objs

def analyze_pdf(path):
    from PIL import Image
    import numpy as np
    data = open(path, 'rb').read()
    print(f"[PDF] {os.path.basename(path)} size={len(data)}B pages={len(re.findall(rb'/Type /Page[^s]', data))}")
    objs = pdf_objects(data)
    print(f"[PDF] objects={len(objs)}")
    found = 0
    for num, body in objs.items():
        if b'/Subtype /Image' not in body:
            continue
        wm = re.search(rb'/Width (\d+)', body); hm = re.search(rb'/Height (\d+)', body)
        cm = re.search(rb'/ColorSpace /(\w+)', body)
        bpm = re.search(rb'/BitsPerComponent (\d+)', body)
        fm = re.search(rb'/Filter /(\w+)', body)
        sm = re.search(rb'stream\r?\n(.*?)endstream', body, re.S)
        if not (wm and hm and sm):
            continue
        w, h = int(wm.group(1)), int(hm.group(1))
        raw = sm.group(1)
        if fm and fm.group(1) == b'FlateDecode':
            try:
                raw = zlib.decompress(raw)
            except Exception as e:
                print(f"[PDF] obj{num} decompress fail: {e}")
                continue
        ch = 3 if (cm and cm.group(1) in (b'DeviceRGB', b'RGB')) else 1
        print(f"[PDF] image obj{num} {w}x{h} cs={cm.group(1) if cm else None} bpc={bpm.group(1) if bpm else None} filter={fm.group(1) if fm else None} rawLen={len(raw)} expectLen={w*h*ch}")
        if len(raw) < w * h * ch:
            print(f"[PDF] obj{num} raw too short, skip")
            continue
        img = Image.frombytes('RGB' if ch == 3 else 'L', (w, h), raw[:w*h*ch])
        out = os.path.join(os.path.dirname(path), f'_a3-pdf-image-{num}.png')
        img.save(out)
        arr = np.array(img.convert('RGB')).reshape(-1, 3)
        uniq = np.unique(arr, axis=0)
        # 黄格 #FFF3CA ±6
        yellow = np.abs(arr.astype(int) - np.array([255, 243, 202])).max(axis=1) <= 8
        white = np.all(arr > 245, axis=1)
        dark = np.all(arr < 80, axis=1)
        print(f"[PDF] image saved={out} uniqueColors={len(uniq)} yellowFrac={yellow.mean():.4f} whiteFrac={white.mean():.4f} darkFrac={dark.mean():.4f}")
        found += 1
        break
    if not found:
        print("[PDF] NO embedded image found")

if __name__ == '__main__':
    analyze_xlsx(sys.argv[1])
    print()
    analyze_pdf(sys.argv[2])
