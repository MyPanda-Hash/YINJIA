# decode_qr.py — 用 OpenCV 把截图里的二维码全部解出来,核对「物料编码 → 码内容」是否一致。
# 用法: py -3 decode_qr.py <目录或 png 路径> [...]
import glob
import os
import sys
import cv2
import numpy as np


def imread_unicode(path):
    # cv2.imread 在 Windows 上按 ANSI 路径打开,中文路径会失败 ⇒ 走 fromfile + imdecode
    data = np.fromfile(path, dtype=np.uint8)
    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def decode(path):
    img = imread_unicode(path)
    if img is None:
        return None
    det = cv2.QRCodeDetector()
    found = []

    def sweep(im):
        ok, texts, pts, _ = det.detectAndDecodeMulti(im)
        for t in (texts or []):
            if t and t not in found:
                found.append(t)

    sweep(img)
    # 放大一倍再扫一次(整页缩略时小码容易漏)
    sweep(cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC))
    # 兜底:重叠瓦片逐个解(每张卡都在某一块里占满)
    h, w = img.shape[:2]
    tiled = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    H, W = tiled.shape[:2]
    for gy in range(4):
        for gx in range(3):
            y0, x0 = gy * H // 6, gx * W // 4
            crop = tiled[y0:min(H, y0 + H // 3), x0:min(W, x0 + W // 2)]
            if crop.size == 0:
                continue
            t, _, _ = det.detectAndDecode(crop)
            if t and t not in found:
                found.append(t)
    return found


targets = []
for arg in sys.argv[1:]:
    if os.path.isdir(arg):
        targets += sorted(glob.glob(os.path.join(arg, 'qrsheet-*.png'))) + sorted(glob.glob(os.path.join(arg, 'pdf', 'qrshot-*.png')))
    else:
        targets.append(arg)

for p in targets:
    got = decode(p)
    if got is None:
        print(f'{p} -> 读不到图片')
        continue
    print(f'{p} -> 解出 {len(got)} 个: {got}')
