"""把本次任务(BOM 归档同步 + 规格书带料)的改动单独入索引。

工作树里并行会话同时改了 ButtonService.java(headDefaults)与 RecordSheetPanels.vue 等多处。
做法:从 HEAD 出发只施加本次改动,生成补丁入索引;工作树保持不动。
"""
import io
import os
import subprocess
import sys

REPO = r'C:\INCER\YINJIA-MES'
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\x1787\AppData\Local\Temp'), '_bomSyncStage')
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


# ═══ ① ButtonService.java:归档钩子 + 同步方法 ═══
REL1 = 'backend/src/main/java/com/yinjia/mes/service/ButtonService.java'
base1 = show(REL1)
cur1 = io.open(os.path.join(REPO, REL1.replace('/', '\\')), encoding='utf-8', newline='').read()

OLD1 = """        // 四个受控文件:归档即**本文件受控**(2026-09-30 用户口径「受控按文件」)。
        // 需求原文(《产品开发系统需求汇总》5.1):「保存/提交 → 提交后审批 → 审批后自动受控」。
        markFileControlled(panelCode, no, user);
    }"""
if OLD1 not in base1:
    print('FAIL ButtonService 锚点缺失')
    sys.exit(1)

# 新版:按**行号**截取(从 markFileControlled 调用行 到 safeNum 方法结束),
# 用行号是因为文件里有大量相似注释,字符串锚点容易截偏。
lines = cur1.splitlines(True)
start_i = next(i for i, l in enumerate(lines) if 'markFileControlled(panelCode, no, user);' in l)
num_i = next(i for i, l in enumerate(lines) if 'private static Double safeNum(' in l)
# safeNum 方法体结束 = 之后第一个只含 "    }" 的行
end_i = next(i for i in range(num_i, len(lines)) if lines[i].rstrip('\r\n') == '    }')
NEW1_TAIL = ''.join(lines[start_i:end_i + 1]).rstrip('\r\n')
out1 = base1.replace(OLD1, NEW1_TAIL, 1)

checks1 = [
    ('含归档钩子', 'syncProdBomToMaterialList(no, user)' in out1),
    ('含覆盖删除', 'DELETE FROM [mate] WHERE [m_no] = ?' in out1),
    ('含 safeStr', 'private static String safeStr(' in out1),
    ('不含对方改动(headDefaults)', 'putHeadDefaults' not in out1),
]
ok = True
for n, v in checks1:
    print(('OK   ' if v else 'FAIL ') + n)
    ok = ok and v
if not ok:
    sys.exit(1)

# ═══ ② RecordSheetPanels.vue:confirmProdPick async + carryBomFromProdBom ═══
REL2 = 'frontend/src/core/views/RecordSheetPanels.vue'
base2 = show(REL2)
cur2 = io.open(os.path.join(REPO, REL2.replace('/', '\\')), encoding='utf-8', newline='').read()

edits = [
    ('function confirmProdPick() {', 'async function confirmProdPick() {'),
]
out2 = base2
for o, n in edits:
    if o not in out2:
        print('FAIL panels 锚点缺失:', o[:40])
        sys.exit(1)
    out2 = out2.replace(o, n, 1)

# 在 confirmProdPick 末尾插入带料调用 + 新增 carryBomFromProdBom 整个函数
OLD2 = """  prodPickVisible.value = false
  prodPickRow.value = null
  emit('dirty')
  ElMessage.success(tt('已引用产品信息表 {no}，带入 {n} 项')
    .replace('{no}', String(row['单据编号'] ?? '')).replace('{n}', String(filled)))
}"""
if OLD2 not in out2:
    print('FAIL panels 结尾锚点缺失')
    sys.exit(1)
# 新段从工作树按**行号**取(4181 起,到 carryBomFromProdBom 函数结束)
ln = cur2.splitlines(True)
s_i = next(i for i, l in enumerate(ln) if l.startswith('  prodPickVisible.value = false'))
c_i = next(i for i, l in enumerate(ln) if l.startswith('async function carryBomFromProdBom('))
# 函数结束 = c_i 之后第一个只含 "}" 的行
e_i = next(i for i in range(c_i + 1, len(ln)) if ln[i].rstrip('\r\n') == '}')
NEW2 = ''.join(ln[s_i:e_i + 1]).rstrip('\r\n')
out2 = out2.replace(OLD2, NEW2, 1)

checks2 = [
    ('含带料函数', 'async function carryBomFromProdBom(' in out2),
    ('含清空语义', 'splice(0, cur.length)' in out2),
    ('confirmProdPick 已 async', 'async function confirmProdPick() {' in out2),
    ('不含对方改动', 'headDefaults' not in out2),
]
ok2 = True
for n, v in checks2:
    print(('OK   ' if v else 'FAIL ') + n)
    ok2 = ok2 and v
if not ok2:
    sys.exit(1)

r1 = stage(REL1, base1, out1, 'buttonservice')
r2 = stage(REL2, base2, out2, 'panels')
print('ALL OK' if (r1 and r2) else 'SOME FAILED')
