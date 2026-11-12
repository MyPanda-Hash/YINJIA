"""Staging helper (2026-11-12 phase2a): 把「FINISH_IN 关联门禁」单独暂存进 ButtonService.java。

工作区里还有另一个任务(切炭直销下线)对 ButtonService 的未提交删除(dualOutFinishIn/dualOutRedReverse)。
做法:取 HEAD blob,在**它上面**重新应用本任务的插入(helper + 4 处调用),再 update-index
--cacheinfo 放进暂存区;这样提交只含本任务,HEAD 里的 dualOut* 原样保留(可编译)。
"""
import os, subprocess, sys

ROOT = r'D:\workspace\yinjia'
REL = r'backend/src/main/java/com/yinjia/mes/service/ButtonService.java'
raw = subprocess.run(['git', 'cat-file', 'blob', 'HEAD:' + REL], cwd=ROOT, capture_output=True, check=True).stdout.decode('utf-8')
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')

# 与 _patch_finishin_gate.py 里的 HELPER 完全一致(从工作区文件里抠出来,避免两处漂移)
cur = open(os.path.join(ROOT, REL), encoding='utf-8', newline='').read().replace('\r\n', '\n')
# 工作区里的实际顺序是: 「状态机」段注释 → 空行 → helper(以 ═ 分隔线开头)→ audit()
anchor = cur.find('    // 产成品入库单(FINISH_IN)与两张出货检验单的**关联门禁**')
start = -1
if anchor > 0:
    prev = cur.rfind('\n    // ═══', 0, anchor)
    start = prev + 1 if prev >= 0 else -1
end = cur.find('    private Map<String, Object> audit(PanelRegistry.PanelDef def, Map<String, Object> formData) {', anchor if anchor > 0 else 0)
if start < 0 or end < 0:
    print('[FAIL] cannot locate helper block in worktree', start, end); sys.exit(1)
HELPER = cur[start:end]
GATE = '        if ("FINISH_IN".equals(def.code())) assertFinishInInspLink(no);\n'

if 'assertFinishInInspLink' in s:
    print('[SKIP] HEAD already contains gate'); sys.exit(0)

# 1) helper 插到"状态机"段注释之后(与工作区同序)
marker_state = '    // ============ 状态机(照搬 light-mes:草稿⇄已审核 + 审批流) ============\n'
i = s.find(marker_state)
if i < 0: print('[FAIL] state marker'); sys.exit(1)
pos = i + len(marker_state)
s = s[:pos] + '\n' + HELPER + s[pos:]

def insert_after(marker, start=0):
    global s
    j = s.find(marker, start)
    if j < 0: return -1
    pos = j + len(marker)
    s = s[:pos] + GATE + s[pos:]
    return pos

# 2) audit()
a = s.find('    private Map<String, Object> audit(PanelRegistry.PanelDef def, Map<String, Object> formData) {')
if insert_after('        String no = requireNo(formData);\n        ensureDocExists(def, no);\n', a) < 0:
    print('[FAIL] audit'); sys.exit(1)
# 3) submitApproval()
b = s.find('    private Map<String, Object> submitApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {')
if insert_after('        String no = requireNo(formData);\n        ensureDocExists(def, no);\n', b) < 0:
    print('[FAIL] submit'); sys.exit(1)
# 4) approveApproval()
c = s.find('    private Map<String, Object> approveApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {\n        String no = requireNo(formData);\n')
if c < 0: print('[FAIL] approve'); sys.exit(1)
pos = s.find('        String no = requireNo(formData);\n', c) + len('        String no = requireNo(formData);\n')
s = s[:pos] + GATE + s[pos:]
# 5) approveSecond()
d = s.find('    private Map<String, Object> approveSecond(PanelRegistry.PanelDef def, String no, String operator,')
if d >= 0:
    brace = s.find('{', d) + 1
    s = s[:brace] + '\n        if ("FINISH_IN".equals(def.code())) assertFinishInInspLink(no);' + s[brace:]
else:
    print('[WARN] approveSecond not found')

clean = s.replace('\n', '\r\n') if crlf else s
tmp = os.path.join(ROOT, '.tmp-ButtonService-gate.java')
open(tmp, 'w', encoding='utf-8', newline='').write(clean)
sha = subprocess.run(['git', 'hash-object', '-w', '--no-filters', tmp], cwd=ROOT, capture_output=True, check=True, text=True).stdout.strip()
subprocess.run(['git', 'update-index', '--cacheinfo', '100644,%s,%s' % (sha, REL)], cwd=ROOT, check=True)
os.remove(tmp)
print('[OK] staged clean ButtonService.java sha=', sha[:10])
print('[CHECK] dualOutFinishIn kept:', 'dualOutFinishIn' in clean, '| gate count:', clean.count('assertFinishInInspLink('))
