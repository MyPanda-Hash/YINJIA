"""Staging helper (2026-11-12, disposable): 把本任务新增的 3 行(空行+注释+脚本名)追加到 db-migrations.txt 的
HEAD blob 上。工作区里还有另一任务未提交的登记/空行调整,不能整文件 add。"""
import os, subprocess

ROOT = r'D:\workspace\yinjia'
REL = 'tools/db-migrations.txt'
PATH = os.path.join(ROOT, REL)

head = subprocess.run(['git', 'cat-file', 'blob', 'HEAD:' + REL], cwd=ROOT, capture_output=True, check=True).stdout
block = ('\r\n# 2026-11-12 产成品入库单关联出货检验功能单/表观单(阶段1:落两个表头参照字段+10语种译名,零业务门禁)\r\n'
         'migrate-finish-in-insp-link-20261112.sql\r\n')
clean = head
if not clean.endswith(b'\n'):
    clean += b'\r\n'
clean = clean + block.encode('utf-8')
tmp = os.path.join(ROOT, '.tmp-dbmig-finishin.txt')
open(tmp, 'wb').write(clean)
sha = subprocess.run(['git', 'hash-object', '-w', '--no-filters', tmp], cwd=ROOT, capture_output=True, check=True, text=True).stdout.strip()
subprocess.run(['git', 'update-index', '--cacheinfo', '100644,%s,%s' % (sha, REL)], cwd=ROOT, check=True)
os.remove(tmp)
print('[OK] staged clean', REL, 'sha=', sha[:10])
