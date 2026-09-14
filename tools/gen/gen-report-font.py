#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""YINJIA-MES 报表中文字体构建脚本(IT 维护;换字体/升级字体时重新生成)

把 Noto Sans SC 可变字体(VF,TrueType 轮廓)落地成后端报表用的静态 TTF:
    backend/src/main/resources/fonts/NotoSansSC-Regular.ttf
    backend/src/main/resources/fonts/NotoSansSC-Bold.ttf

为什么必须自己 instance + 子集化(而不是直接下个 otf/ttf 丢进去):
  1) **必须是 TTF(TrueType/glyf 轮廓)**:JasperReports 的 PDF 导出走 OpenPDF,
     对 CFF 轮廓的 .otf/.ttc 支持极差(实测出方框)。思源黑体/Noto CJK 官方只发 OTF,
     所以要用 Google 的 Noto Sans SC **VF TTF** 这一支。
  2) **必须 instance 成静态字重**:VF 的 wght 轴默认值是 100(Thin),而 OpenPDF 会忽略
     fvar 表 —— 不落地成静态字重的话,整份报表会渲染成极细字。
  3) **子集化**:原始 VF 17.7MB / 3.1 万字形,子集后每个字重 7.7MB,直接进 jar 太肥。

依赖:python3 + fonttools( pip install fonttools )

用法:
    python tools/gen-report-font.py                     # 从官方 CDN 下载 VF 再生成
    python tools/gen-report-font.py <NotoSansSC-VF.ttf> # 用本地已下好的 VF

生成后:mvn -DskipTests package → target/app.jar(字体在 BOOT-INF/classes/fonts/ 里),
        并核对 backend/src/main/resources/fonts/noto-sans-sc.xml 里的 4 个字形路径没变。
"""
import os
import subprocess
import sys
import urllib.request

# notofonts/noto-cjk 的 SC 子集 VF TTF(SIL OFL 1.1;jsDelivr 国内可达)
VF_URL = "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(REPO, "backend", "src", "main", "resources", "fonts")

# 子集保留范围:Latin/希腊/西里尔 + 常用符号 + CJK 符号标点 + 假名 + CJK 统一汉字
#   + 兼容汉字 + 全角半角。不含谚文音节(AC00-D7AF,1.1 万字形)——报表是中文单据,
#   不值得为此付一倍体积;真要韩文报表再加回去并重新生成。
UNICODES = ",".join([
    "U+0020-007E", "U+00A0-00FF", "U+0100-017F", "U+0180-024F",
    "U+02B0-02FF", "U+0300-036F", "U+0370-03FF", "U+0400-04FF",
    "U+2000-206F", "U+2070-209F", "U+20A0-20BF", "U+2100-214F",
    "U+2150-218F", "U+2190-21FF", "U+2200-22FF", "U+2460-24FF",
    "U+25A0-25FF", "U+2600-26FF", "U+3000-303F", "U+3040-30FF",
    "U+31C0-31EF", "U+3200-32FF", "U+3300-33FF", "U+4E00-9FFF",
    "U+F900-FAFF", "U+FE10-FE1F", "U+FE30-FE4F", "U+FF00-FFEF",
])

WEIGHTS = ((400, "Regular"), (700, "Bold"))


def main():
    if len(sys.argv) > 1:
        vf = sys.argv[1]
    else:
        vf = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_NotoSansSC-VF.ttf")
        if not os.path.exists(vf):
            print("downloading", VF_URL)
            urllib.request.urlretrieve(VF_URL, vf)
        print("source VF:", vf, os.path.getsize(vf), "bytes")

    os.makedirs(OUTDIR, exist_ok=True)
    for weight, name in WEIGHTS:
        step1 = os.path.join(OUTDIR, f"_inst-{name}.ttf")
        final = os.path.join(OUTDIR, f"NotoSansSC-{name}.ttf")
        print(f"--- {name} (wght={weight}) ---", flush=True)
        # --update-name-table:把 name 表改成实例名(NotoSansSC-Regular / -Bold)。
        # 必须做:两个字重若同名,PDF 里 /BaseFont 会撞名,字体断言与阅读都受影响。
        subprocess.run([sys.executable, "-m", "fontTools.varLib.instancer",
                        vf, f"wght={weight}", "--update-name-table", "-o", step1], check=True)
        subprocess.run([sys.executable, "-m", "fontTools.subset", step1,
                        f"--unicodes={UNICODES}",
                        "--layout-features=",           # 报表排版不需要 GSUB/GPOS,去掉省体积
                        "--name-IDs=*", "--name-legacy", "--name-languages=*",
                        "--notdef-outline", "--recommended-glyphs",
                        "--no-hinting",                 # PDF 渲染不吃 TT hinting,省体积
                        f"--output-file={final}"], check=True)
        os.remove(step1)
        print(f"{final} = {os.path.getsize(final)} bytes", flush=True)

    print("\n下一步:重启后端,然后导出 PDF 并断言 /BaseFont 里出现 NotoSansSC-Regular / -Bold。")


if __name__ == "__main__":
    main()
