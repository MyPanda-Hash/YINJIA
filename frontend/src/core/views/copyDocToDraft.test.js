/**
 * 单据复制 → 新草稿（2026-11-23 用户口径）。
 *
 * 用户原话：「给立项申请表、产品信息表、外部开发、非开发样品申请单，这 4 个单据都需要一个单据
 *   复制功能，就是复制单据内容为一个新的草稿，因为很多单据可能是一个客户需要的产品内容，但是
 *   可能就是改了一点点，所以重新全部填写很麻烦，就需要复制单据内容到一个新草稿里面去进行一个
 *   小的改动然后提交，当然那些自动生成的单据编号这些就还是按新的单据规则来生成，而不是把这些
 *   也照搬过来」。
 *
 * 【本测试守什么】（都是"看代码在不在 + 语义对不对"，故按源码断言，同 sampleMonthArchive.test）
 *  ① 按钮**只对这 4 张**出现：后端白名单是唯一定义，PanelConfigService 按它注入，
 *     其它面板（含同样走文书侧栏的 RD_PLAN / RD_SPEC_DOC）一颗都没有；
 *  ② 动作名是「复制单据」，**不是**列表页通用的「复制」—— 后者在 APPROVAL_SIDE_EXCLUDE 里，
 *     沿用会让文书侧栏永远看不到这颗按钮；
 *  ③ 跳过规则：结构列 / 状态编号 / 签核留痕 / 唯一派生键 / 附件，且**按 label 解析成列**，
 *     不写死物理列名（AGENTS §5①：label ≠ 物理列名）；
 *  ④ 新单号走 nextDocNoFor（不照搬源单号），且新单是草稿（markDocSaved false）+ 不进审批；
 *  ⑤ 前端点完提示「已复制为新草稿：<新单号>」并定位到新单；
 *  ⑥ 多语言：新增文案在 en.js 里有译名。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const btn = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const cfg = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java', import.meta.url), 'utf8')
const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

const TARGETS = ['RD_APPROVAL', 'RD_PROD_INFO', 'RD_SAMPLE_EXT', 'RD_SAMPLE_ND']

/** 取 `public static final ... COPY_DOC_PANELS = ...;` 那段源码 */
function copyPanelsBlock() {
  const at = btn.indexOf('COPY_DOC_PANELS = ')
  assert.ok(at > 0, 'ButtonService 里找不到 COPY_DOC_PANELS')
  return btn.slice(at, btn.indexOf(';', at))
}

/* ── ① 只有这 4 张面板有这颗按钮 ─────────────────────────────── */

test('① 后端白名单恰好是这 4 张面板', () => {
  const block = copyPanelsBlock()
  const codes = [...block.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1])
  assert.deepEqual(codes.sort(), [...TARGETS].sort(),
    `白名单必须恰好是 立项/产品信息/外部开发/外部非开发 四张，实际：${codes.join(',')}`)
})

test('① 面板配置按后端白名单注入，不另写一份名单（两处同源）', () => {
  const at = cfg.indexOf('COPY_DOC_PANELS.contains(def.code())')
  assert.ok(at > 0, 'PanelConfigService 没有按 COPY_DOC_PANELS 注入')
  const seg = cfg.slice(at, at + 260)
  assert.match(seg, /group\("复制单据", List\.of\("复制单据"\)\)/, '组名与动作必须同名（单动作组 = 一颗可见按钮）')
  // 注入位置：紧挨「新增」之后（需求：位置放在「② 本单操作」段内、与「新增」相邻）
  const addAt = cfg.lastIndexOf('buttonGroups.add(group("新增", List.of("新增")));', at)
  assert.ok(addAt > 0, '找不到前面的「新增」组')
  assert.ok(at - addAt < 1200, '「复制单据」组应紧挨「新增」组注入')
})

test('① 其它文书面板不受影响：注入只认白名单，不按 RD_ 前缀或 doc 模式放开', () => {
  const at = cfg.indexOf('COPY_DOC_PANELS.contains(def.code())')
  const seg = cfg.slice(at, at + 200)
  assert.ok(!/startsWith\("RD_"\)|def\.isDoc\(\)/.test(seg), '不能按前缀/面板类型放开（会波及全部 RD 单据）')
})

/* ── ② 动作名「复制单据」而不是「复制」 ───────────────────────── */

test('② 动作名是「复制单据」，且名单里不含字面量「复制」（避免与列表页通用复制混淆）', () => {
  assert.match(btn, /case "复制单据" -> copyDocToDraft\(def, formData\)/, '后端 switch 缺 case "复制单据"')
  const block = copyPanelsBlock()
  assert.ok(!/"复制"/.test(block), '白名单里不能出现「复制」（那会被前端当通用整单复制）')
  // 前端 APPROVAL_SIDE_EXCLUDE 把「复制」排除了 ⇒ 用旧名侧栏永远看不到
  const ex = list.slice(list.indexOf('const APPROVAL_SIDE_EXCLUDE'), list.indexOf('const APPROVAL_SIDE_EXCLUDE') + 300)
  assert.match(ex, /'复制'/, 'APPROVAL_SIDE_EXCLUDE 仍应排除「复制」')
  assert.ok(!ex.includes("'复制单据'"), '「复制单据」不能被排除 —— 否则侧栏看不到这颗按钮')
})

/* ── ③ 跳过规则：按 label 解析，不写死物理列名 ─────────────────── */

test('③ 跳过集合覆盖：状态/编号、签核留痕、唯一派生键（用 label 而不是物理列名）', () => {
  const at = btn.indexOf('COPY_DOC_SKIP_LABELS = ')
  assert.ok(at > 0, '缺 COPY_DOC_SKIP_LABELS')
  const block = btn.slice(at, btn.indexOf('));', at))
  for (const label of ['单据状态', '编号', '单据编号', 'saved']) {
    assert.ok(block.includes(`"${label}"`), `状态/编号类缺「${label}」`)
  }
  // 签核/审批留痕：新单必须空白，审批后才回填（用户需求逐条点名）
  for (const label of ['申请立项人', '审核人', '确认人', '申请', '审核', '确认',
    '批准人', '批准签字', '批准日期', '审核人（一级审批人）', '审核人（二级审批人）',
    '产品负责人', '表单审核人', '编写人', '编辑人', '一级审核人', '二级审核人']) {
    assert.ok(block.includes(`"${label}"`), `签核留痕类缺「${label}」`)
  }
  // 唯一/自动派生键
  assert.ok(block.includes('"产品编号"'), 'RD_PROD_INFO 的产品编号有唯一约束，必须清空')
  assert.ok(block.includes('"文档编号"'), 'RD_APPROVAL 的文档编号=客户编码+日期自动生成，必须清空重算')
})

test('③ 结构列按列名判（id / 分组列 / pk / asp_*），业务列一律走 label', () => {
  const at = btn.indexOf('private boolean isCopyStructuralCol')
  assert.ok(at > 0, '缺 isCopyStructuralCol')
  const seg = btn.slice(at, at + 600)
  assert.match(seg, /"id"\.equalsIgnoreCase\(col\)/, '必须跳过自增 id')
  assert.match(seg, /def\.groupCol\(\)/, '必须跳过分组列（单号列）')
  assert.match(seg, /startsWith\("asp_"\)/, '必须跳过 asp_* 审计列')
  // 附件：按 yj_field.data_type='附件' 动态判，不写死附件1/附件 这类标签
  const att = btn.indexOf('private boolean isAttachField')
  assert.ok(att > 0, '缺 isAttachField')
  assert.match(btn.slice(att, att + 300), /"附件"\.equals\(f\.dataType\(\)\.trim\(\)\)/,
    '附件列必须按 data_type=附件 判（附件锚点=面板+单号+字段，旧文件不能带到新单）')
})

test('③ 「能取到列就清空，取不到跳过」：label 查不到时不报错、也不猜物理列名', () => {
  const at = btn.indexOf('private Map<String, Object> copyDocToDraft')
  assert.ok(at > 0, '缺 copyDocToDraft')
  const seg = btn.slice(at, at + 5200)
  // 业务列只通过 labelOfCol / byLabel 解析
  assert.match(seg, /labelOfCol\.get\(col\)/, '业务列的 label 必须来自 yj_field（def.fieldsAt("header")）')
  assert.match(seg, /def\.byLabel\("文档编号"\)/, '文档编号必须走 byLabel')
  assert.ok(!/headCols\.put\("附件/.test(seg), '不能写死附件物理列名')
})

/* ── ④ 新单号 + 草稿态 ───────────────────────────────────────── */

test('④ 新单号走 nextDocNoFor（不照搬源单号），且源单号只当查询条件', () => {
  const at = btn.indexOf('private Map<String, Object> copyDocToDraft')
  const seg = btn.slice(at, at + 5200)
  assert.match(seg, /nextDocNoFor\(def, user\)/, '必须复用 nextDocNoFor（内部处理 RD_SAMPLE_EXT 的账号-日期序列）')
  assert.ok(!/formNoService\.next\(/.test(seg), '不要绕过 nextDocNoFor 直接取号（会漏掉用户-日期序列口径）')
  // 源单号绝不能成为新单的号
  assert.match(seg, /String newNo = nextDocNoFor\(def, user\)/, '新单号必须来自 nextDocNoFor')
  assert.match(seg, /源单据不存在或已作废/, '源单必须存在且未作废')
})

test('④ 任何状态都可复制（不按状态拦），新单是草稿、不进审批', () => {
  const at = btn.indexOf('private Map<String, Object> copyDocToDraft')
  const seg = btn.slice(at, at + 5200)
  // 不禁「已审核/已归档」——已归档正是主要复制场景
  assert.ok(!/已归档.*不可复制|仅草稿.*可复制|仅草稿或修改中/.test(seg), '不能按状态拦复制（已归档必须能复制）')
  assert.match(seg, /markDocSaved\(def\.code\(\), newNo, false\)/, '新单必须标为草稿（saved=N）')
  assert.ok(!/submitApproval|markArchived/.test(seg), '复制不能把新单推进审批或直接归档')
})

test('④ 权限复用「新增」口径，不自造第二套判权', () => {
  const at = btn.indexOf('private Map<String, Object> copyDocToDraft')
  const seg = btn.slice(at, at + 1200)
  assert.match(seg, /panelPermissionService\.hasAnyPerm\(def\.code\(\), "add", "modify"\)/,
    '必须复用 hasAnyPerm(add, modify)，与 save() 建单同一把闸门')
})

/* ── ⑤ 前端：提示 + 刷新 + 定位新单 ─────────────────────────── */

test('⑤ 前端提示「已复制为新草稿：<新单号>」→ 刷新并定位到新单', () => {
  const at = list.indexOf("if (action === '复制单据')")
  assert.ok(at > 0, '前端 onButton 缺「复制单据」分支')
  const seg = list.slice(at, at + 1400)
  assert.match(seg, /buttonName: '复制单据'/, '必须调后端「复制单据」动作')
  assert.match(seg, /tt\('已复制为新草稿：'\)/, '提示文案必须走 tt()')
  assert.match(seg, /await openDocByNo\(newNo\)/, '复制后必须定位到新单（load + 按单号找，找不到再用 _docNo 精确取）')
})

test('⑤ 「复制单据」排在通用「复制」分支之前，且不按状态置灰', () => {
  const idxNew = list.indexOf("if (action === '复制单据')")
  const idxOld = list.indexOf("if (action === '复制' && !draftEditable")
  // 通用复制分支的判据可能在变，退一步按字面量找
  const idxOldLiteral = list.indexOf("if (action === '复制')")
  assert.ok(idxNew > 0 && idxOldLiteral > 0)
  assert.ok(idxNew < idxOldLiteral, '「复制单据」必须排在通用「复制」之前，否则会被整单复制截走')
  void idxOld
  const at = list.indexOf('复制单据: !current.value')
  assert.ok(at > 0, 'isDisabled 必须登记「复制单据」（只判有没有选中单）')
})

/* ── ⑥ 多语言 ──────────────────────────────────────────────── */

test('⑥ 新文案在 en.js 有译名（新增面板/字段无、纯 UI 文案必须有）', () => {
  for (const key of ['复制单据', '已复制为新草稿：']) {
    assert.ok(new RegExp(`'${key}':\\s*'`).test(en), `en.js 缺「${key}」的译名`)
  }
})
