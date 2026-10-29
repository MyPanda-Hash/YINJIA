"""把 RecordSheetPanels.vue 里**属于本次任务**的改动单独入索引。

背景:工作树里同一文件还有另一个并行会话未提交的改动(group 面板切换等)。
直接 `git add` 会把那批改动一起写进本次提交 —— 违反单任务单提交。
做法:从 HEAD 版本出发,只施加本次的 6 处编辑,生成"HEAD + 仅本次改动"的版本,
用 `git apply --cached` 把它入索引;工作树文件原封不动(保留对方改动)。
"""
import io
import os
import subprocess
import sys

REPO = r'C:\INCER\YINJIA-MES'
REL = 'frontend/src/core/views/RecordSheetPanels.vue'
TMP = os.path.join(os.environ.get('TEMP', r'C:\Users\x1787\AppData\Local\Temp'), '_docno-stage')

os.makedirs(TMP, exist_ok=True)

base = subprocess.run(['git', 'show', 'HEAD:' + REL], cwd=REPO,
                      capture_output=True).stdout.decode('utf-8')
cur = io.open(os.path.join(REPO, REL.replace('/', '\\')), encoding='utf-8', newline='').read()

EDITS = [
    # ① 模板 4 处:写死 tt('编号：') → docnoPrefixText
    ('<span v-if="docnoPrefix" class="rs-docno-prefix">{{ tt(\'编号：\') }}</span>',
     '<span v-if="docnoPrefix" class="rs-docno-prefix">{{ tt(docnoPrefixText) }}</span>'),
    # ② import 增加两个纯函数
    ("import { docNoKeyOf } from '@/core/panel/sheetDocNo'",
     "import { docNoKeyOf, docNoKeyFor, docnoPrefixOf } from '@/core/panel/sheetDocNo'"),
    # ③ docNoKey 改走声明优先
    ('const docNoKey = computed(() => docNoKeyOf(props.head))',
     'const docNoKey = computed(() => docNoKeyFor(props.head, effHead.value))'),
]

NEW_DOCNOKEY_NOTE = """// ⚠ 2026-10-29:**面板可显式声明** head.docNoKey 覆盖自动推断。自动推断只看「head 里有没有
//   文档编号」这一条,撞上"文档编号是隐藏物理列但仍在 head 里"的面板(出货检验计划表 RD_INSP_PLAN)
//   就会把 YJ-RD001 印到右上角,而这张单自己的 IP-2026-10-00xx 一个字看不到(实测探针证实)。
//   未声明的面板仍走原推断,逐字不变。
"""

PREFIX_BLOCK = """/**
 * 纸张右上角那格的**标识文案**(已带全角冒号,直接喂 tt())—— 2026-10-29 引入,
 * 用户口径「产品文件内的面板的右上角的编号应该改为单据编号,所有的都是」。
 *
 * 三种取值(未声明的面板逐字不变,几十张面板依赖这个缺省):
 *   · `head.docnoPrefix === false` ⇒ 空串(不印标识;7 张数据记录表的设计原值就是裸编号);
 *   · `head.docnoPrefix` 是**字符串** ⇒ 文案本身,补全角冒号(如 '单据编号' → '单据编号：');
 *   · 其余(undefined / true) ⇒ 缺省「编号：」。
 *
 * ⚠ 只改文案不改绑键会印出张冠李戴的字:同一句「编号」在不同面板指向两种号
 *   (表单型绑 单据编号 PI-…、检验计划表绑 文档编号 YJ-RD001)。故配套 head.docNoKey
 *   强制绑键(见 docNoKey 计算属性),两处必须成对出现。
 */
const docnoPrefixText = computed(() => docnoPrefixOf(effHead.value.docnoPrefix))
const docnoPrefix = computed(() => !!docnoPrefixText.value)"""

OLD_PREFIX = "const docnoPrefix = computed(() => effHead.value.docnoPrefix !== false)"


def fail(msg):
    print('FAIL:', msg)
    sys.exit(1)


if cur.count(EDITS[0][0]) or base.count(EDITS[0][0]) != 4:
    fail('模板前缀行在 HEAD 里不是 4 处:cur=%d base=%d' % (cur.count(EDITS[0][0]), base.count(EDITS[0][0])))

out = base
for old, new in EDITS:
    if old not in out:
        fail('锚点缺失: ' + old[:60])
    out = out.replace(old, new)

if NEW_DOCNOKEY_NOTE in cur:
    anchor = '// 单据类面板编辑期间那格永远空白;见 @/core/panel/sheetDocNo 的说明)\n'
    if anchor not in out:
        fail('docNoKey 注释锚点缺失')
    out = out.replace(anchor, anchor + NEW_DOCNOKEY_NOTE, 1)

if OLD_PREFIX not in out:
    fail('docnoPrefix 旧实现锚点缺失')
out = out.replace(OLD_PREFIX, PREFIX_BLOCK, 1)

# 校验:该版本必须包含本次全部改动、且不含对方的改动特征
checks = [
    # 4 处模板 + 2 处定义(docnoPrefixText 本身 + docnoPrefix 引用它)= 6
    ('本次改动齐全', out.count('docnoPrefixText') == 6 and 'docNoKeyFor(props.head, effHead.value)' in out),
    ('不含对方改动(group 切换)', 'isGroupHead' not in out and 'onGroupHeadChange' not in out),
    ('不含对方改动(插行)', '在本行下方插入一行' not in out),
    ('不含旧实现', "tt('编号：')" not in out),
]
for name, ok in checks:
    print(('OK  ' if ok else 'FAIL') + ' ' + name)
    if not ok:
        if name.startswith('本次改动'):
            print('  docnoPrefixText 计数 =', out.count('docnoPrefixText'))
            print('  docNoKeyFor 出现 =', 'docNoKeyFor(props.head, effHead.value)' in out)
        sys.exit(1)

p_base = os.path.join(TMP, 'base.vue')
p_mine = os.path.join(TMP, 'mine.vue')
io.open(p_base, 'w', encoding='utf-8', newline='').write(base)
io.open(p_mine, 'w', encoding='utf-8', newline='').write(out)

diff = subprocess.run(['git', 'diff', '--no-index', '--no-color', p_base, p_mine],
                      capture_output=True).stdout.decode('utf-8')
# 修正补丁头路径 → 仓库相对路径
lines = []
for ln in diff.splitlines(True):
    if ln.startswith('diff --git '):
        ln = 'diff --git a/%s b/%s\n' % (REL, REL)
    elif ln.startswith('--- '):
        ln = '--- a/%s\n' % REL
    elif ln.startswith('+++ '):
        ln = '+++ b/%s\n' % REL
    lines.append(ln)
patch = ''.join(lines)
p_patch = os.path.join(TMP, 'mine.patch')
io.open(p_patch, 'w', encoding='utf-8', newline='').write(patch)

r = subprocess.run(['git', 'apply', '--cached', '--unidiff-zero', p_patch],
                   cwd=REPO, capture_output=True)
print('git apply --cached rc =', r.returncode)
if r.stdout:
    print(r.stdout.decode('utf-8', 'replace'))
if r.stderr:
    print(r.stderr.decode('utf-8', 'replace'))
