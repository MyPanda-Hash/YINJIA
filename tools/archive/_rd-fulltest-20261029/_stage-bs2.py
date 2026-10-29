"""只把 ButtonService.java 的本次改动入索引(PanelRegistry 已在索引中,不重复施加)。

并行会话同时在写索引,所以这里只处理一个文件,减少竞态面。
"""
import io
import os
import subprocess
import sys

REPO = r'C:\INCER\YINJIA-MES'
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\x1787\AppData\Local\Temp'), '_bsStage2')
os.makedirs(TMP, exist_ok=True)
REL = 'backend/src/main/java/com/yinjia/mes/service/ButtonService.java'

base = subprocess.run(['git', 'show', 'HEAD:' + REL], cwd=REPO,
                      capture_output=True).stdout.decode('utf-8')
cur = io.open(os.path.join(REPO, REL.replace('/', '\\')), encoding='utf-8', newline='').read()
ls = cur.splitlines(True)
lb = base.splitlines(True)
out = base

# ── 1) putHeadDefaults 方法(整段)+ 插到 ensureProductCodeUnique 的 javadoc 之前 ──
i_p = next(i for i, l in enumerate(ls) if 'private void putHeadDefaults(' in l)
i_pu = i_p
while i_pu > 0 and not ls[i_pu].lstrip().startswith('/**'):
    i_pu -= 1
i_pe = next(i for i in range(i_p, len(ls)) if ls[i].rstrip('\r\n') == '    }')
METHOD_PUT = ''.join(ls[i_pu:i_pe + 1])

i_mark = next(i for i, l in enumerate(lb) if '产品编号不允许重复(同面板其它未作废单据占用即拒绝' in l)
i_doc = i_mark
while i_doc > 0 and lb[i_doc].strip() != '/**':
    i_doc -= 1
out = ''.join(lb[:i_doc]) + METHOD_PUT + '\n' + ''.join(lb[i_doc:])

# ── 2) upsertHeadRow 里的调用 ──
OLD2 = """        Map<String, Object> cols = labelsToCols(fields, head);
        Integer existing = jdbc.queryForObject("""
NEW2 = """        Map<String, Object> cols = labelsToCols(fields, head);
        // 新建默认值:主保存路径也要补(2026-10-29 用户报障「两个审核人没显示出来」的真因之一)。
        // 原先 putHeadDefaults 只挂在**空白草稿分支**(directAdd),而「新增 → 填数据 → 保存」
        // 走的是本方法 ⇒ 那两格默认值从来没写进去过。这里补上,口径同款:只填空列,不覆盖已有值。
        putHeadDefaults(def, def.headTable(), cols);
        Integer existing = jdbc.queryForObject("""
if OLD2 not in out:
    print('FAIL 锚点2(upsertHeadRow)缺失')
    sys.exit(1)
out = out.replace(OLD2, NEW2, 1)

# ── 3) specAssign 尾部回填 + backfillProdOwner 方法 ──
OLD3 = """        Map<String, Object> r = result(no, "已分发");
        r.put("productCode", productCode);
        r.put("assigned", assigned);
        return r;
    }"""
i_b = next(i for i, l in enumerate(ls) if 'private void backfillProdOwner(' in l)
i_bu = i_b
while i_bu > 0 and not ls[i_bu].lstrip().startswith('/**'):
    i_bu -= 1
i_be = next(i for i in range(i_b, len(ls)) if ls[i].rstrip('\r\n') == '    }')
METHOD_BF = ''.join(ls[i_bu:i_be + 1])
i_ce = next(i for i, l in enumerate(ls) if 'backfillProdOwner(no, specOwner)' in l)
i_cs = i_ce
while not ls[i_cs].lstrip().startswith('//'):
    i_cs -= 1
CALL_BLOCK = ''.join(ls[i_cs:i_ce + 1])

NEW3 = CALL_BLOCK + "\n\n" + """        Map<String, Object> r = result(no, "已分发");
        r.put("productCode", productCode);
        r.put("assigned", assigned);
        return r;
    }

""" + METHOD_BF
if OLD3 not in out:
    print('FAIL 锚点3(specAssign 尾部)缺失')
    sys.exit(1)
out = out.replace(OLD3, NEW3, 1)

checks = [
    ('含 putHeadDefaults', 'private void putHeadDefaults(' in out),
    ('含主路径调用', 'putHeadDefaults(def, def.headTable(), cols);' in out),
    ('含回填方法', 'private void backfillProdOwner(' in out),
    ('含 specAssign 回填', 'backfillProdOwner(no, specOwner)' in out),
    # selfModify 已被并行会话提交进 HEAD(38e81926 一带),不再作为排除项;
    # 只核对「我新加的这两个方法与调用」都已就位即可。
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