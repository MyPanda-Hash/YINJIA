"""_a3-analyze2.py — 修正 PDF 图像提取(jsPDF 每行多 1 字节行前缀)+ xlsx 版式细看。"""
import sys, re, zlib, os
import numpy as np
from PIL import Image

def analyze_xlsx(path):
    from openpyxl import load_workbook
    wb = load_workbook(path)
    ws = wb.active
    print(f"[XLSX] size={os.path.getsize(path)}B dims={ws.dimensions}")
    rows = [[('' if c.value is None else str(c.value)) for c in r] for r in ws.iter_rows()]
    for i, r in enumerate(rows[5:18], start=6):
        print(f"[XLSX] r{i}: " + ' | '.join(v for v in r))
    # 数据区(样品行 1#..8#)与标准行的 '/' 统计
    std_row = next((r for r in rows if r and str(r[0]).strip() in ('标准',)), None)
    sample_rows = [r for r in rows if r and re.fullmatch(r'\d+#', str(r[0]).strip())]
    slash_std = sum(1 for v in (std_row or []) if str(v).strip() == '/')
    slash_samples = sum(1 for r in sample_rows for v in r if str(v).strip() == '/')
    print(f"[XLSX] stdRowSlash={slash_std} sampleRows={len(sample_rows)} sampleRowSlash={slash_samples}")
    # 列头行
    for r in rows:
        if r and '炭棒表观状态' in ' '.join(str(v) for v in r):
            print(f"[XLSX] headerRow: " + ' | '.join(str(v) for v in r))
            break
    flat = [str(v).strip() for r in rows for v in r]
    print(f"[XLSX] values12.3/50cm/31: " + str([any(v == k for v in flat) for k in ['12.3','50cm','31']]))

def pdf_streams(data):
    for m in re.finditer(rb'(\d+)\s+0\s+obj(.*?)endobj', data, re.S):
        yield int(m.group(1)), m.group(2)

def analyze_pdf(path):
    data = open(path, 'rb').read()
    print(f"[PDF] size={len(data)}B pages={len(re.findall(rb'/Type /Page[^s]', data))}")
    for num, body in pdf_streams(data):
        if b'/Subtype /Image' not in body:
            continue
        w = int(re.search(rb'/Width (\d+)', body).group(1))
        h = int(re.search(rb'/Height (\d+)', body).group(1))
        raw = re.search(rb'stream\r?\n(.*?)endstream', body, re.S).group(1)
        raw = zlib.decompress(raw)
        ch = 3
        rowlen = w * ch
        extra = len(raw) - w * h * ch
        print(f"[PDF] image {w}x{h} rawLen={len(raw)} extraPerRow={extra/h if h else 0}")
        if extra == h:
            # 每行前缀 1 字节(jsPDF/PNG predictor 包装):去掉行首字节
            raw2 = b''.join(raw[i*(rowlen+1)+1:(i+1)*(rowlen+1)] for i in range(h))
        elif extra == 0:
            raw2 = raw
        else:
            # 尝试 PNG 反滤波(predictor 12..15) — 这里先按无过滤处理
            raw2 = raw[:w*h*ch]
        img = Image.frombytes('RGB', (w, h), raw2[:w*h*ch])
        out = os.path.join(os.path.dirname(path), '_a3-pdf-page.png')
        img.save(out)
        arr = np.array(img).reshape(-1, 3).astype(int)
        yellow = (np.abs(arr - np.array([255, 243, 202])).max(axis=1) <= 10)
        white = (arr > 245).all(axis=1)
        dark = (arr < 90).all(axis=1)
        uniq = len(np.unique(arr, axis=0))
        print(f"[PDF] saved={out} uniqueColors={uniq} yellowFrac={yellow.mean():.4f} whiteFrac={white.mean():.4f} darkFrac={dark.mean():.4f}")
        return

if __name__ == '__main__':
    analyze_xlsx(sys.argv[1]); print(); analyze_pdf(sys.argv[2])
