"""Staging helper (2026-11-12 phase2b): 把「报工自动生成产成品入库单草稿」单独暂存进 ButtonService.java。
做法:HEAD blob + 本任务插入(调用 + 3 个方法);工作区里另一任务对 dualOut* 的未提交删除不进本提交。
"""
import os, subprocess, sys

ROOT = r'D:\workspace\yinjia'
REL = r'backend/src/main/java/com/yinjia/mes/service/ButtonService.java'
raw = subprocess.run(['git', 'cat-file', 'blob', 'HEAD:' + REL], cwd=ROOT, capture_output=True, check=True).stdout.decode('utf-8')
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')
if 'finishInDraftFromReport' in s:
    print('[SKIP] HEAD already contains autogen'); sys.exit(0)

cur = open(os.path.join(ROOT, REL), encoding='utf-8', newline='').read().replace('\r\n', '\n')
anchor_title = cur.find('    // 最后一道工序报工审核 → 按「一个日期批次一张」自动生成**产成品入库单草稿**')
start = cur.rfind('\n    // ═══', 0, anchor_title) + 1 if anchor_title > 0 else -1
end = cur.find('    /**\n     * 组装成品检验单 审核/弃审 → 重算其所属**工单**各行的结案状态。', anchor_title if anchor_title > 0 else 0)
if start < 0 or end < 0:
    print('[FAIL] cannot locate METHODS block', start, end); sys.exit(1)
METHODS = cur[start:end]

ANCHOR = '    /**\n     * 组装成品检验单 审核/弃审 → 重算其所属**工单**各行的结案状态。'
i = s.find(ANCHOR)
if i < 0: print('[FAIL] anchor'); sys.exit(1)
s = s[:i] + METHODS + s[i:]

CALL_ANCHOR = '        woInspGenerate(def.code(), no, user);\n'
j = s.find(CALL_ANCHOR)
if j < 0: print('[FAIL] call anchor'); sys.exit(1)
pos = j + len(CALL_ANCHOR)
s = s[:pos] + '        // 最后一道工序报工审核 → 按日期批次自动生成产成品入库单草稿(2026-11-12 phase2b)\n        finishInDraftFromReport(def.code(), no, user);\n' + s[pos:]

clean = s.replace('\n', '\r\n') if crlf else s
tmp = os.path.join(ROOT, '.tmp-ButtonService-autogen.java')
open(tmp, 'w', encoding='utf-8', newline='').write(clean)
sha = subprocess.run(['git', 'hash-object', '-w', '--no-filters', tmp], cwd=ROOT, capture_output=True, check=True, text=True).stdout.strip()
subprocess.run(['git', 'update-index', '--cacheinfo', '100644,%s,%s' % (sha, REL)], cwd=ROOT, check=True)
os.remove(tmp)
print('[OK] staged clean ButtonService.java sha=', sha[:10])
print('[CHECK] dualOut kept:', 'dualOutFinishIn' in clean, '| autogen count:', clean.count('finishInDraftFromReport'))
