"""按横线切band,逐band量竖线 —— 看清组标题行/表头行/数据行各自的网格。"""
import sys
import numpy as np
from PIL import Image

SRC = sys.argv[1]
TOTAL_PT = 758.0

a = np.asarray(Image.open(SRC).convert("L"), dtype=np.uint8)
h, w = a.shape
dark = a < 128
scale = TOTAL_PT / w
print(f"图像 {w}x{h}  scale={scale:.5f} pt/px")

row = dark.sum(axis=1)
# 横线:覆盖 >35% 宽度
hl = [y for y in range(h) if row[y] > w * 0.35]
bands = []
for y in hl:
    if bands and y - bands[-1][-1] <= 2:
        bands[-1].append(y)
    else:
        bands.append([y])
hy = [int(round(sum(g) / len(g))) for g in bands]
print("横线 y(px):", hy, " → pt:", [round(v * scale, 1) for v in hy])

edges = hy + [h]
for i in range(len(hy)):
    y0, y1 = hy[i] + 2, edges[i + 1] - 2
    if y1 - y0 < 6:
        continue
    seg = dark[y0:y1, :]
    col = seg.sum(axis=0)
    thr = seg.shape[0] * 0.7
    xs = [x for x in range(w) if col[x] > thr]
    grp = []
    for x in xs:
        if grp and x - grp[-1][-1] <= 3:
            grp[-1].append(x)
        else:
            grp.append([x])
    c = [int(round(sum(g) / len(g))) for g in grp]
    pt = [round(v * scale, 1) for v in c]
    wid = [round(pt[k + 1] - pt[k], 1) for k in range(len(pt) - 1)]
    print(f"\nband y={y0}..{y1} (高 {round((y1-y0)*scale,1)}pt)")
    print(f"  竖线 pt: {pt}")
    print(f"  列宽 pt: {wid}")
