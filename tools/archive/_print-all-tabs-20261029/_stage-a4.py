"""把 PanelxList.vue 里**属于本次任务**的改动单独入索引(A4 竖向出纸)。

工作树里同一文件还有另一个并行会话未提交的改动(headDefaults 默认值等)。
做法:从 HEAD 版本出发,只施加本次的改动,生成"HEAD + 仅本次改动"的补丁入索引;
工作树文件原封不动,保留对方改动。
"""
import io
import os
import subprocess
import sys

REPO = r'C:\INCER\YINJIA-MES'
REL = 'frontend/src/core/views/PanelxList.vue'
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\x1787\AppData\Local\Temp'), '_a4stage')
os.makedirs(TMP, exist_ok=True)

base = subprocess.run(['git', 'show', 'HEAD:' + REL], cwd=REPO,
                      capture_output=True).stdout.decode('utf-8')
cur = io.open(os.path.join(REPO, REL.replace('/', '\\')), encoding='utf-8', newline='').read()

# ── 本次改动:旧出纸尺寸段 → 新 A4 段(两段都从工作树里精确取出) ──
OLD = """  // 页面尺寸用 mm + 自算 96dpi 换算(1px=25.4/96mm):jsPDF 的 px 单位换算因子与 CSS 不一致,
  // 会标出 598×980mm 巨页、内容只占一部分(边框缩成发丝看不见)——mm 直算保证页面=纸张真实物理尺寸
  const MM = 25.4 / 96
  const first = shots[0]
  const pdf = new jsPDF({
    orientation: first.w0 * MM > first.h0 * MM ? 'l' : 'p',
    unit: 'mm',
    format: [first.w0 * MM, first.h0 * MM],
    compress: true,
  })
  shots.forEach((s, i) => {
    const pw = s.w0 * MM
    const ph = s.h0 * MM
    if (i > 0) pdf.addPage([pw, ph], pw > ph ? 'l' : 'p')
    pdf.addImage(s.dataUrl, 'PNG', 0, 0, pw, ph)
  })"""

# 新版从工作树里按锚点截(避免手抄走样)
at = cur.find('  if (!shots.length) return null')
en = cur.find("  const no = cur.value?.['单据编号']", at)
if at < 0 or en < 0:
    print('FAIL 工作树里找不到新段边界')
    sys.exit(1)
NEW = cur[at:en].rstrip('\n')

if OLD not in base:
    print('FAIL HEAD 里找不到旧出纸段')
    sys.exit(1)

out = base.replace(OLD, NEW, 1)

def code_only(src):
    """去掉整行注释(注释里会引用旧写法当反例,不能参与判据)。"""
    out = []
    for ln in src.splitlines():
        t = ln.strip()
        if t.startswith('//') or t.startswith('*') or t.startswith('/*'):
            continue
        out.append(ln)
    return '\n'.join(out)


code = code_only(out)
checks = [
    ('含 A4 常量', 'const PAGE_W = 210' in code and 'const PAGE_H = 297' in code),
    ('含等比居中', 'Math.min(contentW / iw, contentH / ih)' in code),
    ('不含旧尺寸', 'format: [first.w0 * MM' not in code),
    ("不含旧方向判定", "pw > ph ? 'l'" not in code),
    ('不含对方改动', 'headDefaults' not in out),
]
for name, ok in checks:
    print(('OK   ' if ok else 'FAIL ') + name)
    if not ok:
        sys.exit(1)

p_base = os.path.join(TMP, 'base.vue')
p_mine = os.path.join(TMP, 'mine.vue')
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
