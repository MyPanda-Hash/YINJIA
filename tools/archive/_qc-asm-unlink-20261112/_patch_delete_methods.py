"""Disposable patcher (2026-11-12): remove asmInspToStock / asmInspUnauditCascade and their
exclusive helpers from ButtonService.java, plus delete AsmInspStockQty.java.

Why a script instead of hand edits: the two method bodies are ~160 lines of comments+SQL; deleting
by marker is safer than reconstructing a giant literal with the edit tool. Idempotent: if markers are
already gone it reports and does nothing.
"""
import io, os, re, sys

ROOT = r'D:\workspace\yinjia'
SVC = os.path.join(ROOT, 'backend', 'src', 'main', 'java', 'com', 'yinjia', 'mes', 'service', 'ButtonService.java')
QTY = os.path.join(ROOT, 'backend', 'src', 'main', 'java', 'com', 'yinjia', 'mes', 'service', 'AsmInspStockQty.java')

raw = open(SVC, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')

def cut(start_marker, end_marker, label):
    global s
    i = s.find(start_marker)
    if i < 0:
        print(f'[SKIP] {label}: start marker not found')
        return
    j = s.find(end_marker, i)
    if j < 0:
        print(f'[FAIL] {label}: end marker not found')
        sys.exit(1)
    s = s[:i] + s[j:]
    print(f'[OK] {label}: removed {j - i} chars')

# A) gdIdOfReport + resolveWoRow (both only used by asmInspToStock)
cut('    /**\n     * 报工单号 → 该单锚定的**排产行id**',
    '    // ══════════════════════════════════════════════════════════════════════════════════\n    // 工序检验单',
    'gdIdOfReport + resolveWoRow')

# B) asmInspToStock + asmInspUnauditCascade + finishWarehouse (finishWarehouse only used by asmInspToStock)
cut('    /**\n     * 组装成品检验单审核 → 数量分流',
    '    // ==================== 来料检验单审核 → 自动生成采购入库单(2026-09-15) ====================',
    'asmInspToStock + asmInspUnauditCascade + finishWarehouse')

# tidy: no 3+ consecutive blank lines
s = re.sub(r'\n{4,}', '\n\n\n', s)
out = s.replace('\n', '\r\n') if crlf else s
open(SVC, 'w', encoding='utf-8', newline='').write(out)
print('[OK] ButtonService.java written, crlf =', crlf)

if os.path.exists(QTY):
    os.remove(QTY)
    print('[OK] deleted AsmInspStockQty.java')
else:
    print('[SKIP] AsmInspStockQty.java already absent')

# residual references self-check
left = []
for name in ['asmInspToStock', 'asmInspUnauditCascade', 'AsmInspStockQty', 'gdIdOfReport', 'resolveWoRow', 'finishWarehouse']:
    if name in out:
        left.append(name)
print('[CHECK] residual refs in ButtonService.java:', left or 'none')
