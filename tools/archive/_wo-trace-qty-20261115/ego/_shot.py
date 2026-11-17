"""_shot.py — 用 PyMuPDF 按文字锚点精确裁出两幅证据图(比整页截图清爽):
   ① shot-01-dialog-top.png   弹窗头 + 工序进度 + 排产数据;
   ② shot-02-done-data.png    完工数据段(表头/两行/表尾口径说明)+ 上面工序进度块。
"""
import pymupdf

doc = pymupdf.open("trace-dialog-8091.pdf")
page = doc[0]
print("page rect:", page.rect)

def find(needle, nth=0):
    hits = page.search_for(needle)
    return hits[nth] if len(hits) > nth else None

anchors = {
    "工序进度": find("工序进度"),
    "排产数据": find("排产数据"),
    "完工数据": find("完工数据"),
    "表尾": find("计划数量 = 排产数量"),
    "入库单据": find("入库单据"),
}
for k, v in anchors.items():
    print(k, v)

W = page.rect.width

def render(clip, out, zoom=3):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip)
    pix.save(out)
    print(out, pix.width, "x", pix.height)

# ① 弹窗头 ~ 完工数据表尾(整段关键内容)
top = 20
bottom = (anchors["表尾"].y1 if anchors["表尾"] else 1200) + 40
render(pymupdf.Rect(0, top, W, bottom), "shot-01-dialog-top.png", zoom=2)

# ② 工序进度 + 完工数据(放大)
t2 = (anchors["工序进度"].y0 if anchors["工序进度"] else 400) - 20
b2 = (anchors["表尾"].y1 if anchors["表尾"] else 1200) + 30
render(pymupdf.Rect(0, t2, W, b2), "shot-02-done-data.png", zoom=3)
