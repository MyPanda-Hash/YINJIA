"""只把 PanelRegistry.java 的 headDefaults() 方法入索引(本次功能的共用管道)。"""
import io
import os
import subprocess
import sys

REPO = r'C:\INCER\YINJIA-MES'
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\x1787\AppData\Local\Temp'), '_prStage')
os.makedirs(TMP, exist_ok=True)
REL = 'backend/src/main/java/com/yinjia/mes/service/PanelRegistry.java'

base = subprocess.run(['git', 'show', 'HEAD:' + REL], cwd=REPO,
                      capture_output=True).stdout.decode('utf-8')
cur = io.open(os.path.join(REPO, REL.replace('/', '\\')), encoding='utf-8', newline='').read()
ls = cur.splitlines(True)
lb = base.splitlines(True)

i_def = next(i for i, l in enumerate(ls) if 'public Map<String, String> headDefaults()' in l)
i_up = i_def
while i_up > 0 and not ls[i_up].lstrip().startswith('/**'):
    i_up -= 1
i_end = next(i for i in range(i_def, len(ls)) if ls[i].rstrip('\r\n').strip() == '}')
BLOCK = ''.join(ls[i_up:i_end + 1])

ANCHOR = '        public List<List<String>> uniqueKeys()'
if ANCHOR not in base:
    print('FAIL 锚点缺失')
    sys.exit(1)
out = base.replace(ANCHOR, BLOCK + '\n' + ANCHOR, 1)

checks = [
    ('含 headDefaults', 'public Map<String, String> headDefaults()' in out),
    ('只加这一个方法', out.count('headDefaults()') == 1),
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