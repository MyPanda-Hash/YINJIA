"""把本次任务(原生打印等比缩放)对两个文件的改动单独入索引。

工作树里还有并行会话未提交的改动(单据编号格 docNoStatic 停用等)。
做法:从 HEAD 出发,只施加本次改动,生成补丁入索引;工作树保持不动。
"""
import io
import os
import subprocess
import sys

REPO = r'C:\INCER\YINJIA-MES'
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\x1787\AppData\Local\Temp'), '_zoomStage')
os.makedirs(TMP, exist_ok=True)


def show(rel):
    return subprocess.run(['git', 'show', 'HEAD:' + rel], cwd=REPO,
                          capture_output=True).stdout.decode('utf-8')


def stage(rel, base, out, name):
    p_base = os.path.join(TMP, name + '-base')
    p_mine = os.path.join(TMP, name + '-mine')
    io.open(p_base, 'w', encoding='utf-8', newline='').write(base)
    io.open(p_mine, 'w', encoding='utf-8', newline='').write(out)
    diff = subprocess.run(['git', 'diff', '--no-index', '--no-color', p_base, p_mine],
                          capture_output=True).stdout.decode('utf-8')
    lines = []
    for ln in diff.splitlines(True):
        if ln.startswith('diff --git '):
            ln = 'diff --git a/%s b/%s\n' % (rel, rel)
        elif ln.startswith('--- '):
            ln = '--- a/%s\n' % rel
        elif ln.startswith('+++ '):
            ln = '+++ b/%s\n' % rel
        lines.append(ln)
    p_patch = os.path.join(TMP, name + '.patch')
    io.open(p_patch, 'w', encoding='utf-8', newline='').write(''.join(lines))
    r = subprocess.run(['git', 'apply', '--cached', '--unidiff-zero', p_patch],
                       cwd=REPO, capture_output=True)
    print(name, 'apply rc =', r.returncode)
    if r.stderr:
        print(r.stderr.decode('utf-8', 'replace'))
    return r.returncode == 0


# ── ① RecordSheetPanels.vue:只改 zoom 那一行 ──
REL1 = 'frontend/src/core/views/RecordSheetPanels.vue'
base1 = show(REL1)
OLD1 = """    /* 打印适配:宽度 100%(≈733px@8mm页边距)下固定高度封面(1123px)会溢出到第二页,整体 0.92 缩入一页 */
    zoom: 0.92 !important;"""
NEW1 = """    /* 打印适配:宽度 100%(≈733px@8mm页边距)下固定高度封面(1123px)会溢出到第二页;
       超宽表格(纸面 px 宽远大于 733px)此前只给 0.92 会被**横向裁掉**。
       2026-10-29:改读 --print-zoom —— 由 PanelxList.printApprovalSheet 按「纸宽÷A4 内容宽」算出;
       未设变量时回落到 0.92(Ctrl+P 直接打印等未经按钮的路径,行为与改造前一致)。 */
    zoom: var(--print-zoom, 0.92) !important;"""
if OLD1 not in base1:
    print('FAIL RecordSheetPanels 锚点缺失')
    sys.exit(1)
out1 = base1.replace(OLD1, NEW1, 1)
if 'docNoStatic' in NEW1:
    print('FAIL 夹带对方改动')
    sys.exit(1)

# ── ② PanelxList.vue:printApprovalSheet 里的 A4 缩放段 ──
REL2 = 'frontend/src/core/views/PanelxList.vue'
base2 = show(REL2)
cur2 = io.open(os.path.join(REPO, REL2.replace('/', '\\')), encoding='utf-8', newline='').read()

OLD2 = """  if (!approvalSheetRef.value) return
  // 打印样式(approval-printing):只打印文书纸张,隐藏侧栏/其它页面元素
  document.body.classList.add('approval-printing')
  const restore = () => {
    document.body.classList.remove('approval-printing')
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  // 等样式生效后调打印预览(用户可另存为 PDF 或打印)
  setTimeout(() => window.print(), 150)"""

# 新版按**行号**从工作树截取(文件是 CRLF,用 '\n}\n' 锚点会失配)
lines2 = cur2.splitlines(True)
start_i = next(i for i, l in enumerate(lines2) if 'if (!approvalSheetRef.value) return' in l)
end_i = next(i for i, l in enumerate(lines2)
             if i > start_i and l.strip() == '}')
NEW2 = ''.join(lines2[start_i:end_i]).rstrip('\r\n')

if OLD2 not in base2:
    print('FAIL PanelxList 锚点缺失')
    sys.exit(1)
out2 = base2.replace(OLD2, NEW2, 1)

checks = [
    ('含 --print-zoom', "'--print-zoom'" in out2),
    ('含 A4_CONTENT_PX', 'A4_CONTENT_PX' in out2),
    ('含上限 1', 'Math.min(1' in out2),
    ('含收尾清除', 'removeProperty' in out2),
    ('不含对方改动(headDefaults)', 'headDefaults' not in out2),
    ('不含对方改动(表格编号)', "label: '单据编号', keys:" not in out2),
]
ok = True
for n, v in checks:
    print(('OK   ' if v else 'FAIL ') + n)
    ok = ok and v
if not ok:
    sys.exit(1)

rc1 = stage(REL1, base1, out1, 'panels')
rc2 = stage(REL2, base2, out2, 'list')
print('ALL OK' if (rc1 and rc2) else 'SOME FAILED')
