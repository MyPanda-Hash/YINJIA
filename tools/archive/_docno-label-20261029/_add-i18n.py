"""补齐 8 种语言的「单据编号：」词条(2026-10-29 产品文件分组统一编号标识)。

插入点 = 各语言 biz 里 '编号：' 那一行**之后**,沿用该行自己的缩进。
中文简体(zh-CN.js)没有 biz 表 —— 它是原文语言,不需要。
"""
import io
import os
import re

BASE = r'C:\INCER\YINJIA-MES\frontend\src\i18n\locales'

VALS = {
    'ja.js': ('番号:', '伝票番号:'),
    'ko.js': ('번호:', '전표번호:'),
    'es.js': ('Número:', 'N.º de documento:'),
    'fr.js': ('Numéro:', 'N° de document:'),
    'de.js': ('Nummer:', 'Belegnummer:'),
    'ru.js': ('Номер:', 'Номер документа:'),
    'vi.js': ('Số hiệu:', 'Số chứng từ:'),
    'th.js': ('หมายเลข:', 'เลขที่เอกสาร:'),
    'zh-TW.js': ('編號:', '單據編號:'),
}

for fn, (old_val, new_val) in VALS.items():
    path = os.path.join(BASE, fn)
    with io.open(path, encoding='utf-8', newline='') as f:
        src = f.read()
    if "'单据编号：'" in src:
        print(fn, 'SKIP (already present)')
        continue
    # 定位 '编号：': 'xxx', 这一整行(缩进不定)
    pat = re.compile(r"^([ \t]*)'编号：': '" + re.escape(old_val) + r"',[ \t]*\r?\n", re.M)
    m = pat.search(src)
    if not m:
        print(fn, 'FAIL anchor not found')
        continue
    indent = m.group(1)
    nl = '\r\n' if '\r\n' in m.group(0) else '\n'
    line = f"{indent}'单据编号：': '{new_val}',{nl}"
    src = src[:m.end()] + line + src[m.end():]
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(src)
    print(fn, 'OK indent=' + repr(indent))
