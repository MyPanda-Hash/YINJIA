"""把本次任务(规格书引用源改回物料清单)的改动单独入索引。

工作树里还有并行会话的改动(PanelxList headDefaults、测试申请单等)。
做法:从 HEAD 出发只施加本次改动,生成补丁入索引;工作树保持不动。
"""
import io
import os
import subprocess
import sys

REPO = r'C:\INCER\YINJIA-MES'
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\x1787\AppData\Local\Temp'), '_matePickStage')
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


# ═══ ① recordSheetConfigs.js:给规格书那张表加 materialPickSource ═══
REL1 = 'frontend/src/core/views/recordSheetConfigs.js'
base1 = show(REL1)
cur1 = io.open(os.path.join(REPO, REL1.replace('/', '\\')), encoding='utf-8', newline='').read()

OLD1 = "      { page: 3, tablesAfterBar: '1.关键物料列表', filterKey: '表区', filterVal: '物料清单', materialPick: true, cols: ["
NEW1 = """      { page: 3, tablesAfterBar: '1.关键物料列表', filterKey: '表区', filterVal: '物料清单', materialPick: true,
        // 2026-10-29 用户口径「规格书的从商品引用改回去引用物料清单」:
        //   引用源 = **物料清单(WLBOM)** —— 勾整张物料清单单,该单全部子件展开落行,
        //   数量 ← 标准用量(商品档案没有这一列,这也正是当初换回物料清单的关键原因)。
        // 沿革:2026-10-13 WLBOM → 2026-10-21 改商品档案 → 2026-10-29 改回 WLBOM。
        // 产品信息表「三、产品BOM表」仍是商品档案(那边没有声明 materialPickSource)。
        materialPickSource: 'mate', cols: ["""
if OLD1 not in base1:
    print('FAIL configs 锚点缺失')
    sys.exit(1)
out1 = base1.replace(OLD1, NEW1, 1)

# ═══ ② RecordSheetPanels.vue:本次改的几段(从工作树按标记成段摘取) ═══
REL2 = 'frontend/src/core/views/RecordSheetPanels.vue'
base2 = show(REL2)
cur2 = io.open(os.path.join(REPO, REL2.replace('/', '\\')), encoding='utf-8', newline='').read()

# (a) 文案/来源计算属性:整段替换
A_OLD = """/**
 * 「从…引用」按钮的**文案** —— 由表的 `materialPickLabel` 决定,缺省仍是「从商品引用」。
 *
 * 为什么可配:同一个取数机制(商品档案 INV)在不同单据上的业务说法不一样 ——
 *   规格书第 4 页叫「从商品引用」;
 *   产品信息表新版「三、产品BOM表」设计要求写「直接导入采购物料清单」(2026-10-29 设计图右侧批注)。
 * 只改纸面上的字,不动取数源、不动落点映射。
 */
function materialPickLabelOf(sec) {
  const dt = materialPickAt(sec)
  return (dt && dt.materialPickLabel) || '从商品引用'
}
/** 弹窗标题跟随按钮文案(同一张表的按钮叫「直接导入采购物料清单」,弹窗标题却写「从商品引用」会很割裂) */
const matPickTitle = computed(() => {
  const dt = matPickTargetDt.value
  return (dt && dt.materialPickLabel) || '从商品引用'
})"""
A_NEW = """/**
 * 「从…引用」按钮的**文案** —— 由表的 `materialPickLabel` 决定。
 *
 * 两种取数源各有缺省文案(`materialPickSource`):
 *   · 'goods'(缺省)= 商品档案 INV ⇒ 「从商品引用」(产品信息表「三、产品BOM表」用这条);
 *   · 'mate'       = 物料清单 WLBOM ⇒ 「从物料清单引用」(规格书「1.关键物料列表」用这条)。
 * 各表也可以用 `materialPickLabel` 逐表覆盖文案(如「直接导入采购物料清单」)。
 */
function defaultPickLabel(dt) {
  return (dt && dt.materialPickSource === 'mate') ? '从物料清单引用' : '从商品引用'
}
function materialPickLabelOf(sec) {
  const dt = materialPickAt(sec)
  return (dt && dt.materialPickLabel) || defaultPickLabel(dt)
}
/** 弹窗标题跟随按钮文案(同一张表的按钮叫「直接导入采购物料清单」,弹窗标题却写「从商品引用」会很割裂) */
const matPickTitle = computed(() => {
  const dt = matPickTargetDt.value
  return (dt && dt.materialPickLabel) || defaultPickLabel(dt)
})
/** 本次引用走哪条源(弹窗模板按它切列)'goods' = 商品档案 / 'mate' = 物料清单(WLBOM) */
const matPickSource = computed(() => (matPickTargetDt.value?.materialPickSource === 'mate' ? 'mate' : 'goods'))"""
if A_OLD not in base2:
    print('FAIL panels 锚点A缺失')
    sys.exit(1)
out2 = base2.replace(A_OLD, A_NEW, 1)

# (b) 弹窗模板:从注释头到 matPickHint 那一行(整段替换)
B_START = '    <!-- ═══ 从商品引用(数据源 = 商品档案 INV → bs_inv,2026-10-21 用户口径)═══'
B_END = '      <div style="color:#909399;font-size:12px;margin-top:6px">{{ matPickHint }}</div>'
bi = out2.find(B_START)
if bi < 0:
    print('FAIL panels 锚点B缺失')
    sys.exit(1)
bj = out2.find(B_END, bi)
if bj < 0:
    print('FAIL panels 锚点B尾缺失')
    sys.exit(1)
OLD_B = out2[bi:bj + len(B_END)]
# 新版从工作树取同位置
ci = cur2.find('    <!-- ═══ 物料/商品引用弹窗')
cj = cur2.find(B_END, ci)
if ci < 0 or cj < 0:
    print('FAIL 工作树里找不到新弹窗段')
    sys.exit(1)
NEW_B = cur2[ci:cj + len(B_END)]
out2 = out2.replace(OLD_B, NEW_B, 1)

# (c) matPickHint
C_OLD = """const matPickHint = computed(() => {
  if (matPickLoading.value) return tt('加载中…')
  const all = matPickRows.value.length
  const hit = matPickFiltered.value.length
  if (!all) return tt('商品档案里还没有数据')"""
if C_OLD not in out2:
    print('FAIL panels 锚点C缺失')
    sys.exit(1)
cstart = cur2.find('const matPickHint = computed(() => {')
cend = cur2.find('\n})', cstart)
NEW_C = cur2[cstart:cend + 3]
# 把 out2 里对应整段换掉
o_cstart = out2.find('const matPickHint = computed(() => {')
o_cend = out2.find('\n})', o_cstart)
out2 = out2[:o_cstart] + NEW_C + out2[o_cend + 3:]

# (d) openMaterialPick / confirmMaterialPick:整函数替换
def func_span(src, name):
    at = src.find('async function ' + name)
    if at < 0:
        at = src.find('function ' + name)
    if at < 0:
        return None, None
    # 找到下一个顶层 /** 或 function 或 const x = ref/computed
    rest = src[at + 10:]
    import re as _re
    m = _re.search(r"\n(?:\/\*\*|\/\* |async function |function |const \w+ = (?:ref|computed|reactive)\()", rest)
    end = at + 10 + (m.start() if m else 6000)
    return at, end

for fname in ('openMaterialPick', 'confirmMaterialPick'):
    oa, ob = func_span(out2, fname)
    ca, cb = func_span(cur2, fname)
    if None in (oa, ob, ca, cb):
        print('FAIL 函数定位失败:', fname)
        sys.exit(1)
    out2 = out2[:oa] + cur2[ca:cb] + out2[ob:]

# 校验
checks = [
    ('含 materialPickSource mate 分支', "matPickSource.value === 'mate'" in out2),
    ('含 WLBOM', "panelCode: 'WLBOM'" in out2),
    ('保留 INV 源', 'INV_PANEL' in out2),
    ('保留 goodsToDetail', 'goodsToDetail' in out2),
    ('含 __kids', '__kids' in out2),
    ('含标准用量', '标准用量' in out2),
    ('不含对方改动(headDefaults)', 'headDefaults' not in out2),
    ('不含对方改动(docNoStatic 停用)', '2026-10-29 起停用' not in out2),
]
ok = True
for n, v in checks:
    print(('OK   ' if v else 'FAIL ') + n)
    ok = ok and v
if not ok:
    sys.exit(1)

rc1 = stage(REL1, base1, out1, 'configs')
rc2 = stage(REL2, base2, out2, 'panels')
print('ALL OK' if (rc1 and rc2) else 'SOME FAILED')
