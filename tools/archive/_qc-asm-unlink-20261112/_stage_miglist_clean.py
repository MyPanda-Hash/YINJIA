"""Staging helper (2026-11-12, disposable): 把本任务新增的 4 行追加到 db-migrations.txt 的 HEAD blob 上。
该文件工作区里还有另一个任务(切炭直销下线)未提交的登记行 —— 不能整文件 add。
"""
import os, subprocess

ROOT = r'D:\workspace\yinjia'
REL = 'tools/db-migrations.txt'
PATH = os.path.join(ROOT, REL)

head = subprocess.run(['git', 'cat-file', 'blob', 'HEAD:' + REL], cwd=ROOT, capture_output=True, check=True).stdout
cur = open(PATH, 'rb').read()
marker = '\n# 2026-11-12 出货检验表观(QC_ASM_INSP)与产成品入库解绑'.encode('utf-8')
i = cur.find(marker)
if i < 0:
    raise SystemExit('[FAIL] marker not found in worktree file')
block = cur[i + 1:]  # 跳过前导 \n
# 只取到脚本行为止(工作区后面可能还有别的任务的块)
lines = block.decode('utf-8').split('\n')
keep = []
for ln in lines:
    keep.append(ln)
    if ln.strip() == 'migrate-qc-asm-insp-unlink-finish-in-20261112.sql':
        break
block_txt = '\n'.join(keep)
eol = '\r\n'
base = head
if not base.endswith(b'\n'):
    base = base + eol.encode()
clean = base + eol.encode() + block_txt.replace('\n', eol).encode('utf-8')
if not clean.endswith(b'\n'):
    clean += eol.encode()
tmp = os.path.join(ROOT, '.tmp-dbmig-unlink.txt')
open(tmp, 'wb').write(clean)
sha = subprocess.run(['git', 'hash-object', '-w', '--no-filters', tmp], cwd=ROOT, capture_output=True, check=True, text=True).stdout.strip()
subprocess.run(['git', 'update-index', '--cacheinfo', '100644,%s,%s' % (sha, REL)], cwd=ROOT, check=True)
os.remove(tmp)
print('[OK] staged clean', REL, 'sha=', sha[:10])
