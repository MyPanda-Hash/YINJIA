# -*- coding: utf-8 -*-
"""_q-step-color.py —— 量「工单详情·追溯」工序步骤条的真实渲染颜色(2026-11-03 取证脚本)。

背景:用户报障「图例写着『蓝=进行中』,实际显示却是黑色」。本脚本从页面截图里
取像素,证明**是图例写错了**,不是渲染坏了:
  · 工序①(进行中)的圆圈/标题 = #303133(深黑)
  · 工序②(未开始)        = #a8abb2(灰)
Element Plus 依据(frontend/node_modules/element-plus/theme-chalk/el-step.css):
    .el-step__head.is-process  { color: var(--el-text-color-primary) }   /* #303133 黑 */
    .el-step__title.is-process { color: var(--el-text-color-primary); font-weight: 700 }
    .el-step__head.is-finish   { color: var(--el-color-primary) }        /* #409eff 蓝,只给"已走过"用 */
⇒ el-step 的 process 态天生是深黑,蓝只出现在 finish 态;图例按**实际渲染**改成「黑=进行中」。

用法:
  python _q-step-color.py <截图.png> [x y w h ...]
  不给区域时用 2026-11-03 那版截图(1612x886)的默认取样框:
    ① 图标 (265,145,310,180) / ① 标题 (265,178,325,200) / ② 图标 (845,145,890,180)
  输出每块出现最多的 6 个颜色 + 中文最近色名,用于写事故台账。
  提示:Windows 控制台若显示乱码,先 chcp 65001 或设 PYTHONIOENCODING=utf-8。
"""
import sys
from collections import Counter

from PIL import Image

REGIONS = [
    ("step1-icon (进行中·圆圈)", (265, 145, 310, 180)),
    ("step1-title (进行中·标题)", (265, 178, 325, 200)),
    ("step2-icon (未开始·圆圈)", (845, 145, 890, 180)),
]


def nearest_name(rgb):
    """粗判颜色归属(只为读懂输出,不参与断言)。"""
    r, g, b = rgb
    if r > 240 and g > 240 and b > 240:
        return "白(底色)"
    if max(rgb) - min(rgb) <= 12 and max(rgb) < 90:
        return "黑(#303133 = --el-text-color-primary)"
    if max(rgb) - min(rgb) <= 16 and 120 < max(rgb) < 220:
        return "灰(--el-text-color-placeholder #a8abb2)"
    if r > 180 and g < 90:
        return "红(截图上的标注框)"
    if b > 150 and b - r > 40:
        return "蓝(#409eff 一族)"
    return "其它"


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    img = Image.open(argv[0]).convert("RGB")
    print(f"截图 = {argv[0]}  尺寸 = {img.size}")
    regions = REGIONS
    if len(argv) >= 5:
        regions = [("自定义区域", tuple(int(v) for v in argv[1:5]))]
    for name, box in regions:
        crop = img.crop(box)
        cnt = Counter({rgb: n for n, rgb in crop.getcolors(maxcolors=1 << 20)})
        print(f"\n[{name}] box={box}")
        for rgb, n in cnt.most_common(6):
            print(f"   #{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}  x{n:<5} {nearest_name(rgb)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
