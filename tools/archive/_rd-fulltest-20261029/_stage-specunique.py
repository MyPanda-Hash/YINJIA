"""把本次任务(规格书一产品一规格书后端校验)的改动单独入索引。

工作树里并行会话还改了 ButtonService.java(headDefaults 默认值)。
做法:从 HEAD 出发只施加本次改动,生成补丁入索引;工作树保持不动。
"""
import io
import os
import subprocess
import sys

REPO = r'C:\INCER\YINJIA-MES'
REL = 'backend/src/main/java/com/yinjia/mes/service/ButtonService.java'
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\x1787\AppData\Local\Temp'), '_specUniqueStage')
os.makedirs(TMP, exist_ok=True)

base = subprocess.run(['git', 'show', 'HEAD:' + REL], cwd=REPO,
                      capture_output=True).stdout.decode('utf-8')
cur = io.open(os.path.join(REPO, REL.replace('/', '\\')), encoding='utf-8', newline='').read()

# ① 保存路径加调用
OLD1 = '        if (markSaved && "RD_PROD_INFO".equals(def.code())) ensureProductCodeUnique(def, head, no);\n'
if OLD1 not in base:
    print('FAIL 锚点1缺失')
    sys.exit(1)
# 新版:取工作树里从该行到其后 ensureSpecOnePerProduct 调用行(含注释块)
ls = cur.splitlines(True)
i_prod = next(i for i, l in enumerate(ls) if 'ensureProductCodeUnique(def, head, no);' in l and 'RD_PROD_INFO' in l)
i_call = next(i for i, l in enumerate(ls) if 'ensureSpecOnePerProduct(def, head, no)' in l)
NEW1 = ''.join(ls[i_prod:i_call + 1])
out = base.replace(OLD1, NEW1, 1)

# ② 新增校验方法(插在「文档编号不允许重复」注释之前)
MARK = '    /** 文档编号不允许重复:同面板其它单据占用即拒绝(空值跳过)。'
if MARK not in out:
    print('FAIL 锚点2缺失')
    sys.exit(1)
# 用**行号**截取:从方法定义行往上找它的 javadoc 起点,往下找下一个方法注释
ls2 = cur.splitlines(True)
i_def = next(i for i, l in enumerate(ls2) if 'private void ensureSpecOnePerProduct(' in l)
i_up = i_def
while i_up > 0 and not ls2[i_up].lstrip().startswith('/**'):
    i_up -= 1
i_next = next(i for i in range(i_def, len(ls2)) if '文档编号不允许重复' in ls2[i])
NEW2 = ''.join(ls2[i_up:i_next])
out = out.replace(MARK, NEW2 + MARK, 1)

checks = [
    ('含保存路径调用', 'ensureSpecOnePerProduct(def, head, no)' in out),
    ('含校验方法', 'private void ensureSpecOnePerProduct(' in out),
    ('含 rd_spec_doc_head', 'rd_spec_doc_head' in out),
    ('含作废排除', "ISNULL(asp_cancel,'N') <> 'Y'" in out),
    ('不含对方改动(headDefaults)', 'putHeadDefaults' not in out),
]
ok = True
for n, v in checks:
    print(('OK   ' if v else 'FAIL ') + n)
    ok = ok and v
if not ok:
    sys.exit(1)

p_base = os.path.join(TMP, 'base.java')
p_mine = os.path.join(TMP, 'mine.java')
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
print('apply rc =', r.returncode)
if r.stderr:
    print(r.stderr.decode('utf-8', 'replace'))
