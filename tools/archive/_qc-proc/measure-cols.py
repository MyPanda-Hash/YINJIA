"""量出用户截图里制程检验表的竖线位置,换算成 pt(表宽 758pt),用于精确改版。"""
import sys
import numpy as np
from PIL import Image

SRC = sys.argv[1]
TOTAL_PT = 758.0

img = Image.open(SRC).convert("L")
a = np.asarray(img, dtype=np.uint8)
h, w = a.shape
print(f"图像 {w}x{h}")

dark = a < 128
col = dark.sum(axis=0)          # 每列暗像素数
row = dark.sum(axis=1)          # 每行暗像素数

# 横线(定位表头/数据行的 y)
hline = [y for y in range(h) if row[y] > w * 0.6]
print("横线 y:", hline[:20])

# 竖线:暗像素覆盖超过 55% 高度
thr = h * 0.55
xs = [x for x in range(w) if col[x] > thr]
# 合并相邻像素成一条线
lines = []
for x in xs:
    if lines and x - lines[-1][-1] <= 2:
        lines[-1].append(x)
    else:
        lines.append([x])
centers = [int(round(sum(g) / len(g))) for g in lines]
print("竖线 x:", centers)

scale = TOTAL_PT / w
pts = [round(c * scale, 1) for c in centers]
print("竖线 pt:", pts)
print("相邻宽度 pt:", [round(pts[i + 1] - pts[i], 1) for i in range(len(pts) - 1)])

# 只在"数据行"上量(避开组标题行的合并单元格):取最下面一条横线之下的区域
if hline:
    y0 = hline[-1] + 2
    seg = dark[y0:, :]
    col2 = seg.sum(axis=0)
    thr2 = seg.shape[0] * 0.55
    xs2 = [x for x in range(w) if col2[x] > thr2]
    lines2 = []
    for x in xs2:
        if lines2 and x - lines2[-1][-1] <= 2:
            lines2[-1].append(x)
        else:
            lines2.append([x])
    c2 = [int(round(sum(g) / len(g))) for g in lines2]
    p2 = [round(c * scale, 1) for c in c2]
    print("数据行竖线 pt:", p2)
    print("数据行相邻宽度 pt:", [round(p2[i + 1] - p2[i], 1) for i in range(len(p2) - 1)])
