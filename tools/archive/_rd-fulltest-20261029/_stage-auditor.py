"""把本次任务(审核人默认值 + 产品负责人回填)的改动单独入索引。

工作树里并行会话还有未提交的「自助维护型面板 修改按钮 / selfModify」等改动。
做法:从 HEAD 出发只施加本次改动,生成补丁入索引;工作树保持不动。

⚠ 依赖说明:本次功能需要「声明式默认值」这条管道(yj_panel.config.headDefaults)。
   该管道由并行会话同批实现(PanelRegistry.headDefaults() + ButtonService.putHeadDefaults),
   本次一并纳入 —— 不含它们的提交无法编译。已刻意**排除**与本次无关的 selfModify / 修改按钮。
"""
import io
import os
import subprocess
import sys

REPO = r'C:\INCER\YINJIA-MES'
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\x1787\AppData\Local\Temp'), '_auditorStage')
os.makedirs(TMP, exist_ok=True)


def show(rel):
    return subprocess.run(['git', 'show', 'HEAD:' + rel], cwd=REPO,
                          capture_output=True).stdout.decode('utf-8')


def read(rel):
    return io.open(os.path.join(REPO, rel.replace('/', '\\')), encoding='utf-8', newline='').read()


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


# ═══ ① PanelRegistry:headDefaults() 仅此一个方法(共用管道,无 selfModify) ═══
REL1 = 'backend/src/main/java/com/yinjia/mes/service/PanelRegistry.java'
base1 = show(REL1)
cur1 = read(REL1)
ls1 = cur1.splitlines(True)
i_def = next(i for i, l in enumerate(ls1) if 'public Map<String, String> headDefaults()' in l)
# 往上找它的 javadoc 起点
i_up = i_def
while i_up > 0 and not ls1[i_up].lstrip().startswith('/**'):
    i_up -= 1
# 往下找方法体结束(该缩进级别的 "}")
i_end = next(i for i in range(i_def, len(ls1)) if ls1[i].rstrip('\r\n').strip() == '}' )
BLOCK1 = ''.join(ls1[i_up:i_end + 1])
# 锚点:headDefaults()(工作树 151 行)之后的下一个公开方法 = uniqueKeys()(252 行)
ANCHOR1 = '        public List<List<String>> uniqueKeys()'
if ANCHOR1 not in base1:
    print('FAIL PanelRegistry 锚点缺失(uniqueKeys)')
    sys.exit(1)
out1 = base1.replace(ANCHOR1, BLOCK1 + '\n' + ANCHOR1, 1)

# ═══ ② ButtonService:putHeadDefaults 方法 + 两处调用 + backfillProdOwner ═══
REL2 = 'backend/src/main/java/com/yinjia/mes/service/ButtonService.java'
base2 = show(REL2)
cur2 = read(REL2)
ls2 = cur2.splitlines(True)
out2 = base2

# 2a) putHeadDefaults 方法(整段)
i_p = next(i for i, l in enumerate(ls2) if 'private void putHeadDefaults(' in l)
i_pu = i_p
while i_pu > 0 and not ls2[i_pu].lstrip().startswith('/**'):
    i_pu -= 1
i_pe = next(i for i in range(i_p, len(ls2)) if ls2[i].rstrip('\r\n') == '    }')
METHOD_PUT = ''.join(ls2[i_pu:i_pe + 1])
# 插入点 = ensureProductCodeUnique 的 javadoc 起点(其正文含「产品编号不允许重复」)。
# ⚠ 那是多行 javadoc(首行只有 "    /**"),不能用单行锚点字符串匹配 ⇒ 按行定位。
lb = base2.splitlines(True)
i_mark = next(i for i, l in enumerate(lb) if '产品编号不允许重复(同面板其它未作废单据占用即拒绝' in l)
i_doc = i_mark
while i_doc > 0 and lb[i_doc].strip() != '/**':
    i_doc -= 1
out2 = ''.join(lb[:i_doc]) + METHOD_PUT + '\n' + ''.join(lb[i_doc:])

# 2b) upsertHeadRow 里的调用
OLD2 = """        List<PanelRegistry.FieldDef> fields = def.fieldsAt("header");
        Map<String, Object> cols = labelsToCols(fields, head);
        Integer existing = jdbc.queryForObject("""
NEW2 = """        List<PanelRegistry.FieldDef> fields = def.fieldsAt("header");
        Map<String, Object> cols = labelsToCols(fields, head);
        // 新建默认值:主保存路径也要补(2026-10-29 用户报障「两个审核人没显示出来」的真因之一)。
        // 原先 putHeadDefaults 只挂在**空白草稿分支**(directAdd),而「新增 → 填数据 → 保存」
        // 走的是本方法 ⇒ 那两格默认值从来没写进去过。这里补上,口径同款:只填空列,不覆盖已有值。
        putHeadDefaults(def, def.headTable(), cols);
        Integer existing = jdbc.queryForObject("""
if OLD2 not in out2:
    print('FAIL ButtonService 锚点2(upsertHeadRow)缺失')
    sys.exit(1)
out2 = out2.replace(OLD2, NEW2, 1)

# 2c) specAssign 末尾回填调用 + backfillProdOwner 方法
OLD3 = """        Map<String, Object> r = result(no, "已分发");
        r.put("productCode", productCode);
        r.put("assigned", assigned);
        return r;
    }"""
i_b = next(i for i, l in enumerate(ls2) if 'private void backfillProdOwner(' in l)
i_bu = i_b
while i_bu > 0 and not ls2[i_bu].lstrip().startswith('/**'):
    i_bu -= 1
i_be = next(i for i in range(i_b, len(ls2)) if ls2[i].rstrip('\r\n') == '    }')
METHOD_BF = ''.join(ls2[i_bu:i_be + 1])
# 回填调用段(从 specAssign 里取)
i_c = next(i for i, l in enumerate(ls2) if 'backfillProdOwner(no, specOwner)' in l)
i_cs = i_c
while not ls2[i_cs].lstrip().startswith('//'):
    i_cs -= 1
CALL_BLOCK = ''.join(ls2[i_cs:i_c + 2])   # 注释块 + 赋值/查找 + 调用
# 更稳:从 i_cs 到 specOwner 赋值之后那行调用(含)
i_ce = i_c
while 'backfillProdOwner(no' not in ls2[i_ce]:
    i_ce += 1
CALL_BLOCK = ''.join(ls2[i_cs:i_ce + 1])

NEW3 = CALL_BLOCK + "\n\n" + """        Map<String, Object> r = result(no, "已分发");
        r.put("productCode", productCode);
        r.put("assigned", assigned);
        return r;
    }

""" + METHOD_BF
if OLD3 not in out2:
    print('FAIL ButtonService 锚点3(specAssign 尾部)缺失')
    sys.exit(1)
out2 = out2.replace(OLD3, NEW3, 1)

# ── 校验 ──
checks = [
    ('含 headDefaults 方法(PanelRegistry)', 'public Map<String, String> headDefaults()' in out1),
    ('含 putHeadDefaults 方法', 'private void putHeadDefaults(' in out2),
    ('含主保存路径调用', 'putHeadDefaults(def, def.headTable(), cols);' in out2),
    ('含回填方法', 'private void backfillProdOwner(' in out2),
    ('含 specAssign 回填调用', 'backfillProdOwner(no, specOwner)' in out2),
    ('回填不碰状态', 'yj_doc_status' not in out2[out2.index('private void backfillProdOwner('):out2.index('private void backfillProdOwner(') + 2000]),
    ('不含对方改动 selfModify', 'selfModify' not in out2),
    ('不含对方改动 修改按钮', 'case "修改" -> SELF_MAINTAINED_PANELS' not in out2),
]
ok = True
for n, v in checks:
    print(('OK   ' if v else 'FAIL ') + n)
    ok = ok and v
if not ok:
    sys.exit(1)

r1 = stage(REL1, base1, out1, 'panelregistry')
r2 = stage(REL2, base2, out2, 'buttonservice')
print('ALL OK' if (r1 and r2) else 'SOME FAILED')