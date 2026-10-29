"""把本次任务(宽表收窄)对 recordSheetConfigs.js 的改动单独入索引。

工作树里同一文件还有并行会话未提交的改动(表格编号→单据编号、汇总表列等)。
做法:从 HEAD 出发,只施加本次的列宽/网格改动,生成补丁入索引;工作树保持不动。
"""
import io
import os
import subprocess
import sys

REPO = r'C:\INCER\YINJIA-MES'
REL = 'frontend/src/core/views/recordSheetConfigs.js'
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\x1787\AppData\Local\Temp'), '_wideStage')
os.makedirs(TMP, exist_ok=True)

base = subprocess.run(['git', 'show', 'HEAD:' + REL], cwd=REPO,
                      capture_output=True).stdout.decode('utf-8')

# 本次改动 = 纯数值替换(全部可从 HEAD 文本直接映射)
EDITS = [
    # ① 关键控制清单(RD_ASM_PROC 页2)三列:合计 1040 → 780
    ("{ key: '工序控制内容', label: '工序控制内容', w: 320, area: true }",
     "{ key: '工序控制内容', label: '工序控制内容', w: 250, area: true }"),
    ("{ key: '管控要求', label: '管控要求', w: 430, area: true }",
     "{ key: '管控要求', label: '管控要求', w: 280, area: true }"),
    ("{ key: '检查比例', label: '检查比例', w: 160 }",
     "{ key: '检查比例', label: '检查比例', w: 120 }"),
    # ② 组装BOM表两列:合计 → 780
    ("{ key: '物料规格', label: '物料规格', w: 500, area: true }",
     "{ key: '物料规格', label: '物料规格', w: 280, area: true }"),
    ("{ key: '用量', label: '用量', w: 170 }",
     "{ key: '用量', label: '用量', w: 130 }"),
    # ③ 修订记录(两处逐字一致):994 → 780
    ("{ key: '序号', label: '序号', w: 60, align: 'center' }",
     "{ key: '序号', label: '序号', w: 50, align: 'center' }"),
    ("{ key: '更改内容', label: '更改内容', w: 300, area: true }",
     "{ key: '更改内容', label: '更改内容', w: 240, area: true }"),
    ("{ key: '更改原因', label: '更改原因', w: 200 }",
     "{ key: '更改原因', label: '更改原因', w: 160 }"),
    ("{ key: '更改时间', label: '更改时间', w: 130 }",
     "{ key: '更改时间', label: '更改时间', w: 110 }"),
    ("{ key: '责任人', label: '责任人', w: 120 }",
     "{ key: '责任人', label: '责任人', w: 90 }"),
    ("{ key: '备注', label: '备注', w: 184, area: true }",
     "{ key: '备注', label: '备注', w: 130, area: true }"),
    # ④ 组装工艺清单四列网格:1040 → 780(4 处)
    ("[130, 390, 130, 390]", "[130, 260, 130, 260]"),
    # ⑤ 成型工艺清单 11 列 / 13 列网格:1040 → 780
    ("[130, 90, 90, 85, 70, 78, 77, 100, 70, 125, 125]",
     "[98, 68, 68, 64, 52, 58, 58, 75, 52, 94, 93]"),
    ("[101, 60, 109, 85, 52, 52, 52, 146, 64, 64, 121, 77, 57]",
     "[76, 45, 82, 64, 39, 39, 39, 110, 48, 48, 91, 58, 41]"),
]

out = base
for old, new in EDITS:
    if old not in out:
        print('FAIL 锚点缺失:', old[:60])
        sys.exit(1)
    out = out.replace(old, new)

# 校验
checks = [
    ('网格 780 就位', '[130, 260, 130, 260]' in out and '[98, 68, 68, 64, 52, 58, 58, 75, 52, 94, 93]' in out),
    ('旧 1040 网格已无', '[130, 390, 130, 390]' not in out
        and '[130, 90, 90, 85, 70, 78, 77, 100, 70, 125, 125]' not in out),
    ('不含对方改动(表格编号)', "label: '单据编号', keys:" not in out),
]
for n, ok in checks:
    print(('OK   ' if ok else 'FAIL ') + n)
    if not ok:
        sys.exit(1)

# 校验:每张自持列宽表的可见列合计 = 780
import re
for m in re.finditer(r"const (RD_\w*DT\w*|RD_\w*_REVISION) = \{(.*?)\n\}", out, re.S):
    body = m.group(2)
    ws = re.findall(r"w: (\d+)", body)
    if 'hiddenCol' not in body or len(ws) < 3:
        continue
    vis = [int(w) for w in ws]
    # 第一处 w 是 hiddenCol(表区)
    s = sum(vis[1:])
    print(('  ' + m.group(1)).ljust(34), '可见列合计 =', s, 'OK' if s == 780 else 'BAD')
    if s != 780:
        sys.exit(1)

p_base = os.path.join(TMP, 'base.js')
p_mine = os.path.join(TMP, 'mine.js')
io.open(p_base, 'w', encoding='utf-8', newline='').write(base)
io.open(p_mine, 'w', encoding='utf-8', newline='').write(out)

diff = subprocess.run(['git', 'diff', '--no-index', '--no-color', p_base, p_mine],
                      capture_output=True).stdout.decode('utf-8')
lines = []
for ln in diff.splitlines(True):
    if ln.startswith('diff --git '):
        ln = 'diff --git a/%s b/%s\n' % (REL, REL)
    elif ln.startswith('--- '):
        ln = '--- a/%s\n' % REL
    elif ln.startswith('+++ '):
        ln = '+++ b/%s\n' % REL
    lines.append(ln)
p_patch = os.path.join(TMP, 'mine.patch')
io.open(p_patch, 'w', encoding='utf-8', newline='').write(''.join(lines))

r = subprocess.run(['git', 'apply', '--cached', '--unidiff-zero', p_patch],
                   cwd=REPO, capture_output=True)
print('git apply --cached rc =', r.returncode)
if r.stderr:
    print(r.stderr.decode('utf-8', 'replace'))
