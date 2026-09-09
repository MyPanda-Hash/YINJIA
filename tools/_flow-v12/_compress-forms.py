# _compress-forms.py — 表单照片压缩入库:原图→forms-images-full/(不跟踪),压缩版→forms-images/
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from PIL import Image

BASE = r"C:\INCER\YINJIA-MES\tools\_flow-v12"
SRC = os.path.join(BASE, "forms-images")
FULL = os.path.join(BASE, "forms-images-full")
os.makedirs(FULL, exist_ok=True)

total_src = total_dst = 0
for fn in sorted(os.listdir(SRC)):
    if not fn.lower().endswith(".png"):
        continue
    src_path = os.path.join(SRC, fn)
    total_src += os.path.getsize(src_path)
    im = Image.open(src_path)
    if max(im.size) > 1600:
        im.thumbnail((1600, 1600), Image.LANCZOS)
    stem = os.path.splitext(fn)[0]
    dst_path = os.path.join(SRC, stem + ".jpg")
    im.convert("RGB").save(dst_path, "JPEG", quality=82, optimize=True)
    total_dst += os.path.getsize(dst_path)
    os.replace(src_path, os.path.join(FULL, fn))  # 原图移入 full/
MB = 1024 * 1024
print(f"compressed {len(os.listdir(SRC))} jpg files")
print(f"total: {total_src/MB:.1f}MB -> {total_dst/MB:.1f}MB (originals kept in forms-images-full/)")
