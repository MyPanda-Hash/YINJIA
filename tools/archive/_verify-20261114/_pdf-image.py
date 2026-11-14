"""_pdf-image.py — 从 jsPDF 截图版 PDF 里解出页图(PNG predictor 反滤波),输出 PNG + 非空白统计。
用法: python _pdf-image.py <in.pdf> <out.png>
"""
import re, zlib, os, sys
import numpy as np
from PIL import Image

SRC = sys.argv[1]
DST = sys.argv[2]
data = open(SRC, 'rb').read()
print(f"[PDF] {os.path.basename(SRC)} size={len(data)} pages={len(re.findall(rb'/Type /Page[^s]', data))} mediabox={[m.group(0).decode() for m in re.finditer(rb'/MediaBox\s*\[[^\]]*\]', data)][:1]}")
done = False
for m in re.finditer(rb'(\d+)\s+0\s+obj(.*?)endobj', data, re.S):
    body = m.group(2)
    if b'/Subtype /Image' not in body:
        continue
    w = int(re.search(rb'/Width (\d+)', body).group(1))
    h = int(re.search(rb'/Height (\d+)', body).group(1))
    ch = 3
    rowlen = w * ch
    raw = zlib.decompress(re.search(rb'stream\r?\n(.*?)endstream', body, re.S).group(1))
    pred = b'/Predictor' in body
    if pred:
        prev = np.zeros(rowlen, dtype=np.int32)
        rows = np.zeros((h, rowlen), dtype=np.uint8)
        pos = 0
        for i in range(h):
            ft = raw[pos]; pos += 1
            cur = np.frombuffer(raw[pos:pos+rowlen], dtype=np.uint8).astype(np.int32); pos += rowlen
            if ft == 0:
                out = cur
            elif ft == 1:
                out = cur.copy()
                for j in range(ch, rowlen):
                    out[j] = (out[j] + out[j-ch]) & 255
            elif ft == 2:
                out = (cur + prev) & 255
            elif ft == 3:
                out = cur.copy()
                for j in range(rowlen):
                    left = out[j-ch] if j >= ch else 0
                    out[j] = (out[j] + (left + prev[j]) // 2) & 255
            elif ft == 4:
                out = cur.copy()
                for j in range(rowlen):
                    a = out[j-ch] if j >= ch else 0
                    b = prev[j]
                    c = prev[j-ch] if j >= ch else 0
                    p = a + b - c
                    pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                    pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                    out[j] = (out[j] + pr) & 255
            rows[i] = out.astype(np.uint8)
            prev = out
        raw2 = rows.tobytes()
    else:
        raw2 = raw
    img = Image.frombytes('RGB', (w, h), raw2[:w*h*ch])
    img.save(DST)
    arr = np.array(img).astype(int).reshape(-1, 3)
    white = (arr > 248).all(axis=1)
    dark = (arr < 90).all(axis=1)
    print(f"[PDF] image {w}x{h} -> {os.path.basename(DST)} size={os.path.getsize(DST)}B uniqueColors={len(np.unique(arr, axis=0))} whiteFrac={white.mean():.4f} darkFrac={dark.mean():.4f} nonBlankFrac={1-white.mean():.4f}")
    done = True
    break
if not done:
    print("[PDF] NO image")
