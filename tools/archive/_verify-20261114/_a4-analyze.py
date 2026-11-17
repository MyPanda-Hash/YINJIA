"""_a4-analyze.py — 服务端报表 PDF 取证:页数/MediaBox/颜色算子/是否图像版。"""
import re, zlib, sys, os

PATH = sys.argv[1] if len(sys.argv) > 1 else r'C:/Users/vigna/ego/verify-20261114/a4-server-report.pdf'
data = open(PATH, 'rb').read()
print(f"[A4] file={os.path.basename(PATH)} size={len(data)}B header={data[:8]}")
print(f"[A4] /Type /Page count={len(re.findall(rb'/Type\s*/Page[^s]', data))}")
print(f"[A4] MediaBox={[m.group(0).decode() for m in re.finditer(rb'/MediaBox\s*\[[^\]]*\]', data)][:3]}")
print(f"[A4] embedded images={len(re.findall(rb'/Subtype\s*/Image', data))}")
# 解压所有内容流,统计填充色算子
streams = []
for m in re.finditer(rb'stream\r?\n(.*?)\r?\nendstream', data, re.S):
    raw = m.group(1)
    try:
        streams.append(zlib.decompress(raw))
    except Exception:
        pass
print(f"[A4] decompressed streams={len(streams)} totalBytes={sum(len(s) for s in streams)}")
joined = b'\n'.join(streams)
colors = re.findall(rb'([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg', joined)
from collections import Counter
cnt = Counter(tuple(round(float(x), 3) for x in c) for c in colors)
print("[A4] rg fill colors (top 12):")
for c, n in cnt.most_common(12):
    print(f"    {c} x{n}")
yellow = cnt.get((1.0, 0.953, 0.792), 0)
gray = cnt.get((0.851, 0.851, 0.851), 0)
print(f"[A4] yellow(#FFF3CA)rg=(1,0.953,0.792) count={yellow}  gray(#D9D9D9)rg=(0.851,0.851,0.851) count={gray}")
# 文本算子统计(粗判文本层存在)
tj = len(re.findall(rb'\((?:[^()\\]|\\.)*\)\s*Tj', joined)) + len(re.findall(rb'\[[^\]]*\]\s*TJ', joined))
print(f"[A4] text show ops Tj/TJ={tj}")
print(f"[A4] font objects={len(re.findall(rb'/Type\s*/Font', data))}")
