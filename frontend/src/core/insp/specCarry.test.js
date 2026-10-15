import test from 'node:test'
import assert from 'node:assert/strict'
import {
  specCarryFailure, specDrift, specCarryRequest, specNotApprovedTip, specDriftEnabled,
  headFromSpecDetail, specCarryRows, detailRowsOf, DEFAULT_NOT_APPROVED_TIP,
} from './specCarry.js'

/**
 * 「自动填充规格书」的失败口径(2026-09-21 用户口径):
 *   出货检验计划表选产品编号时按规格书自动带入检验方法,**但必须规格书已经填写并提交审批完**。
 *   后端 /px/specByProduct 在规格书没审批完时返回 { found:false, reason:'not_approved', 规格书编号, 规格书状态 },
 *   界面据此说清"是哪一张、什么状态",而不是一句含糊的"没有规格书"。
 */

test('规格书可用(found=true) ⇒ 没有失败口径', () => {
  assert.equal(specCarryFailure({ found: true, 单据编号: 'SD-1' }), null)
})

test('规格书未审批完 ⇒ not_approved,并带上是哪一张、什么状态', () => {
  assert.deepEqual(
    specCarryFailure({ found: false, reason: 'not_approved', 规格书编号: 'SD-2026-09-0042', 规格书状态: '草稿' }),
    { kind: 'not_approved', specNo: 'SD-2026-09-0042', status: '草稿' },
  )
})

test('审批中的规格书同样算未审批完(状态原样带出)', () => {
  const r = specCarryFailure({ found: false, reason: 'not_approved', 规格书编号: 'SD-2', 规格书状态: '审批中' })
  assert.equal(r.kind, 'not_approved')
  assert.equal(r.status, '审批中')
})

test('压根没有规格书(没有 reason / 空 payload / null)⇒ no_spec', () => {
  assert.equal(specCarryFailure({ found: false }).kind, 'no_spec')
  assert.equal(specCarryFailure({}).kind, 'no_spec')
  assert.equal(specCarryFailure(null).kind, 'no_spec')
})

test('not_approved 但编号/状态缺失也不炸(给空串)', () => {
  assert.deepEqual(specCarryFailure({ found: false, reason: 'not_approved' }), { kind: 'not_approved', specNo: '', status: '' })
})

/* ── specDrift:出货检验当前内容 vs 规格书(「规格书变动就提示」的判据)──────────────
   用户口径(2026-09-21):「出货检验根据规格书进行录入,检验项根据规格书一致,能自动填入,
   规格书变动就提示当前出货检验进行提示。」
   即:单子填完之后规格书又变了 ⇒ 单子上要看得见"与规格书不一致",并能一键按规格书更新。 */

const SPEC = [
  { 检验项目: '外观', 检验要求: '无黑点、无杂质', 检验方法: '目视检查' },
  { 检验项目: '压降', 检验要求: '≤5 kPa', 检验方法: '压降试验台' },
  { 检验项目: '抗压强度', 检验要求: '≥12 kgf', 检验方法: '万能试验机' },
]
const plan = (rows) => rows.map((r) => ({ 控制项目: r.检验项目, 控制标准及要求: r.检验要求, 控制方法: r.检验方法 }))

test('完全一致 ⇒ 没有变动', () => {
  const d = specDrift(SPEC, plan(SPEC))
  assert.deepEqual(d, { added: [], removed: [], changed: [], drifted: false })
})

test('规格书新增一项 ⇒ added', () => {
  const d = specDrift([...SPEC, { 检验项目: '铅含量', 检验要求: '≤0.01 mg/L', 检验方法: 'ICP-MS' }], plan(SPEC))
  assert.deepEqual(d.added, ['铅含量'])
  assert.equal(d.drifted, true)
})

test('规格书删掉一项 ⇒ removed', () => {
  const d = specDrift(SPEC.slice(0, 2), plan(SPEC))
  assert.deepEqual(d.removed, ['抗压强度'])
  assert.equal(d.drifted, true)
})

test('同名项但要求或方法变了 ⇒ changed(报出是哪一项、哪几列变了)', () => {
  const spec2 = [{ 检验项目: '压降', 检验要求: '≤6 kPa', 检验方法: '压降试验台(新版)' }]
  const d = specDrift(spec2, plan([SPEC[1]]))
  assert.deepEqual(d.changed, [{ item: '压降', fields: ['检验要求', '检验方法'] }])
  assert.equal(d.drifted, true)
})

test('顺序不同不算变动(按项目名对齐)', () => {
  const d = specDrift([SPEC[1], SPEC[0], SPEC[2]], plan(SPEC))
  assert.equal(d.drifted, false)
})

test('空白/换行差异不算变动(比对前归一空格)', () => {
  const d = specDrift([{ 检验项目: ' 外观 ', 检验要求: '无黑点、\n无杂质 ', 检验方法: '目视 检查' }],
    plan([{ 检验项目: '外观', 检验要求: '无黑点、无杂质', 检验方法: '目视检查' }]))
  assert.equal(d.drifted, false)
})

test('本单里没有项目名的空行(模板提示行)不参与比对', () => {
  const d = specDrift(SPEC, [...plan(SPEC), { 控制项目: '', 控制标准及要求: '', 控制方法: '' }])
  assert.equal(d.drifted, false)
})

test('规格书一行都没有(或本单空)⇒ 不报变动(交给"没有可带入"那条路径)', () => {
  assert.equal(specDrift([], plan(SPEC)).drifted, false)
  assert.equal(specDrift(SPEC, []).drifted, false)
  assert.equal(specDrift(null, null).drifted, false)
})

/* ── 跨面板复用(2026-10-13):组装工艺清单「组装BOM表」← 规格书「1.关键物料列表」──────
   用户口径:「组装工艺清单的 BOM 表也是可以导入对应规格书的 1.关键物料列表,这个是需要规格书
   已经填写完并且通过审批才会导入对应的规格书的数据,否则就只是导入那些平常的数据,如果规格书
   没有通过审批归档导致数据不能导入时,可以弹窗提示…在还没有提交审批之前都是可以尝试导入。」
   ⇒ 两条链共用同一套取数 + 审批门禁,只差三处:
     ① 取规格书哪个**表区**(出货检验='检验要求' / 组装BOM='物料清单');
     ② 打哪个**端点**(权限按承载面板校验:RD_INSP_PLAN / RD_ASM_PROC);
     ③ 未审批时的**提示文案**(出货检验那条已验收通过,措辞不许改)。
   本组断言钉住:不配这三项的旧链**一个字节都不变**。 */
const INSP_AFS = { fromKey: '产品编号' }
const ASM_AFS = {
  fromKey: '产品编号',
  endpoint: '/px/specByProductForAsm',
  specSheetArea: '物料清单',
  notApprovedTip: '规格书未进行填写，请规格书通过审批之后再试，或者自行填写',
  specDrift: false,
}

test('表区/端点:没配置就沿用出货检验计划表那条链(端点不变、不带 sheetArea)', () => {
  assert.deepEqual(specCarryRequest('P-1', INSP_AFS), { url: '/px/specByProduct', params: { code: 'P-1' } })
  assert.deepEqual(specCarryRequest(' P-1 ', undefined), { url: '/px/specByProduct', params: { code: 'P-1' } })
})

test('组装BOM表:走 ASM 端点(权限按 RD_ASM_PROC)并显式带上表区', () => {
  assert.deepEqual(
    specCarryRequest('P-1', ASM_AFS),
    { url: '/px/specByProductForAsm', params: { code: 'P-1', sheetArea: '物料清单' } },
  )
})

test('未审批提示:出货检验计划表沿用已验收文案,组装BOM表用用户原话', () => {
  assert.equal(specNotApprovedTip(INSP_AFS), DEFAULT_NOT_APPROVED_TIP)
  assert.equal(specNotApprovedTip(ASM_AFS), '规格书未进行填写，请规格书通过审批之后再试，或者自行填写')
})

test('规格书变动提示:出货检验计划表照旧,组装BOM表不参与(比的是检验项目,那边比了只会误报)', () => {
  assert.equal(specDriftEnabled(INSP_AFS), true)
  assert.equal(specDriftEnabled(undefined), true)
  assert.equal(specDriftEnabled(ASM_AFS), false)
})

/* ── 表头格 ← 规格书明细,按「检验项目」名匹配(成型工艺清单 A4)──────────────────────
   用户口径(2026-10-15 实测反馈,推翻上一版):
     「规格书的检验要求数据应该是填在成型工艺清单的**表格内的要求、强度要求、压降标准**里面的」
     「如果是尺寸,应该是把对应检测的内径或者外径的公差等数据填写进成型工艺清单的对应检测要求
       里面的数据表格里面」
   即:① 落点必须是**真实数据格**(跌落要求 / 强度要求kgf / 压降标准kpa),不是块名标签格;
      ② `检验项目=尺寸` 要**解析成四格**(外径mm / 外径公差 / 内径mm / 内径公差)。

   关键口径:**只在真取到值时写** —— 某个检验项目规格书里没有(或解析不出)⇒ 那一格不出现 = 保持不动。 */
const MOLD_AFS = {
  fromKey: '产品编号',
  specDrift: false,
  headFromDetail: [
    { to: '跌落要求', matchProject: '跌落强度' },
    { to: '强度要求kgf', matchProject: '抗压强度' },
    { to: '压降标准kpa', matchProject: '压降' },
    { parse: 'dimension', matchProject: '尺寸' },
  ],
}
const SPEC_ROWS = [
  { 检验项目: '尺寸', 检验要求: '外径 20±0.5mm、内径 5±0.3mm、长度 250±2mm', 检验方法: '游标卡尺' },
  { 检验项目: '跌落强度', 检验要求: '1.2m 高度自由跌落无破损', 检验方法: '跌落试验' },
  { 检验项目: '抗压强度', 检验要求: '≥ 300N 不破裂', 检验方法: '压力试验机' },
  { 检验项目: '压降', 检验要求: '≤25kPa', 检验方法: '数显压力表' },
]

test('按检验项目名匹配,把 检验要求 写进**真实数据格**(不是块名标签格)', () => {
  assert.deepEqual(headFromSpecDetail(MOLD_AFS, SPEC_ROWS), {
    跌落要求: '1.2m 高度自由跌落无破损',
    强度要求kgf: '≥ 300N 不破裂',
    压降标准kpa: '≤25kPa',
    外径mm: '20',
    外径公差: '±0.5',
    内径mm: '5',
    内径公差: '±0.3',
  })
})

test('尺寸那一项解析成四格,且**长度不落格**(本面板没有长度数据格)', () => {
  const out = headFromSpecDetail(MOLD_AFS, [SPEC_ROWS[0]])
  assert.deepEqual(out, { 外径mm: '20', 外径公差: '±0.5', 内径mm: '5', 内径公差: '±0.3' })
  assert.equal('长度' in out, false)
})

test('尺寸句缺项 ⇒ 只写解析得出的格,不写半截值', () => {
  assert.deepEqual(headFromSpecDetail(MOLD_AFS, [{ 检验项目: '尺寸', 检验要求: '外径 20±0.5mm' }]),
    { 外径mm: '20', 外径公差: '±0.5' })
  assert.deepEqual(headFromSpecDetail(MOLD_AFS, [{ 检验项目: '尺寸', 检验要求: '符合图纸要求' }]), {},
    '尺寸句解析不出来 ⇒ 四格一个都不写')
})

test('规格书里没有该检验项目 ⇒ 该键不出现(那一格保持不动,不清空、不写空串)', () => {
  const out = headFromSpecDetail(MOLD_AFS, [SPEC_ROWS[0], SPEC_ROWS[3]])
  assert.equal('跌落要求' in out, false)
  assert.equal('强度要求kgf' in out, false)
  assert.deepEqual(Object.keys(out).sort(), ['外径公差', '外径mm', '内径公差', '内径mm', '压降标准kpa'].sort())
})

test('检验要求 为空白 ⇒ 同样不写那一格(不能拿空串覆盖纸上已有的值)', () => {
  const out = headFromSpecDetail(MOLD_AFS, [
    { 检验项目: '尺寸', 检验要求: '   ' },
    { 检验项目: '压降', 检验要求: null },
    { 检验项目: '跌落强度', 检验要求: '' },
  ])
  assert.deepEqual(out, {})
})

test('检验项目名匹配忽略空白(「跌落 强度」这类排版差不算另一个项目)', () => {
  const out = headFromSpecDetail(MOLD_AFS, [{ 检验项目: ' 跌落 强度 ', 检验要求: '高度50cm,跌3次无断裂' }])
  assert.deepEqual(out, { 跌落要求: '高度50cm,跌3次无断裂' })
})

test('没配 headFromDetail / items 不是数组 ⇒ 一格都不写(旧链一个字节不变)', () => {
  assert.deepEqual(headFromSpecDetail(INSP_AFS, SPEC_ROWS), {})
  assert.deepEqual(headFromSpecDetail(undefined, SPEC_ROWS), {})
  assert.deepEqual(headFromSpecDetail(MOLD_AFS, null), {})
  assert.deepEqual(headFromSpecDetail({ headFromDetail: [] }, SPEC_ROWS), {})
})

test('映射项缺 to / matchProject ⇒ 跳过该项,不影响其它项', () => {
  const out = headFromSpecDetail(
    { headFromDetail: [{ to: '', matchProject: '尺寸' }, { to: '压降标准kpa' }, ...MOLD_AFS.headFromDetail] },
    SPEC_ROWS,
  )
  assert.deepEqual(out, {
    跌落要求: '1.2m 高度自由跌落无破损',
    强度要求kgf: '≥ 300N 不破裂',
    压降标准kpa: '≤25kPa',
    外径mm: '20',
    外径公差: '±0.5',
    内径mm: '5',
    内径公差: '±0.3',
  })
})

test('认不出来的 parse 名字 ⇒ 跳过该项(不静默把整句塞进某个格)', () => {
  const out = headFromSpecDetail({ headFromDetail: [{ parse: 'nope', matchProject: '尺寸' }] }, SPEC_ROWS)
  assert.deepEqual(out, {})
})

/* ── 2026-10-16 修正:规格书里的项目名是「<组名>·<子项名>」+ `*`/`#` 装饰 ────────────────
   用户报障(截图):「这是规格书的数据,这是成型工艺清单的数据,数据没有对应导入下方表格,
   比如碳棒尺寸,压降,抗压强度,其他的未填写的估计也不会导入,要根据规格书的检验项目的名字来对
   成型工艺清单的数据进行一个填写,外径的 +-0.5 这个就是公差数据」。

   实测(test 账套 SD-2026-10-0010 的 检验要求 行,**逐字**):
     #*压降                    → ≤20kpa
     *炭棒尺寸                 → 长度：99±0.5mm / 内径：12.5±0.5mm / 外径：34.5±0.5mm(每行一条)
     强度·（裸棒）              → 成品强度（一切二）：高度60cm，垂直跌落3次，炭棒无断裂
     强度·*抗压强度             → ≥30kgf
     *余氯去除性能·除余氯寿命    → 去除率≥50% / 寿命920L，全程加标
     *余氯去除性能·初始去除率    → ≥98%
   ⇒ 上面那份「裸名配置」('尺寸'/'压降'/'抗压强度'/'跌落强度')**一个都没匹配上**,
     所以用户截图里 炭棒尺寸/压降/抗压强度 三块全空。容错就三件事:
       ① 去掉 `*`/`#`(全角也认)与空白;② 按 `·` 拆 组名/子项,两边都算命中;
       ③ 配置名是项目名的**子串**也算命中('抗压强度' ⊂ '强度·*抗压强度')。 */
const REAL_MOLD_AFS = {
  fromKey: '产品编号',
  specDrift: false,
  headFromDetail: [
    { parse: 'drop', matchProject: ['跌落强度', '裸棒'] },
    { to: '强度要求kgf', matchProject: ['抗压强度'] },
    { to: '压降标准kpa', matchProject: ['压降'] },
    { parse: 'dimension', matchProject: ['炭棒尺寸'] },
  ],
}
const REAL_SPEC_ROWS = [
  { 检验项目: '#*压降', 检验要求: '≤20kpa', 检验方法: '数显压力表' },
  { 检验项目: '*炭棒尺寸', 检验要求: '长度：99±0.5mm', 检验方法: '游标卡尺' },
  { 检验项目: '*炭棒尺寸', 检验要求: '内径：12.5±0.5mm', 检验方法: '游标卡尺' },
  { 检验项目: '*炭棒尺寸', 检验要求: '外径：34.5±0.5mm', 检验方法: '游标卡尺' },
  { 检验项目: '*余氯去除性能·除余氯寿命', 检验要求: '去除率≥50%', 检验方法: '……' },
  { 检验项目: '*余氯去除性能·除余氯寿命', 检验要求: '寿命920L，全程加标', 检验方法: '……' },
  { 检验项目: '*余氯去除性能·初始去除率', 检验要求: '≥98%', 检验方法: '……' },
  { 检验项目: '强度·（裸棒）', 检验要求: '成品强度（一切二）：高度60cm，垂直跌落3次，炭棒无断裂', 检验方法: '……' },
  { 检验项目: '强度·*抗压强度', 检验要求: '≥30kgf', 检验方法: '……' },
]

test('真实项目名(带 * #、「组名·子项」)能匹配上裸名配置 —— 这就是用户截图里那三块空白的原因', () => {
  assert.deepEqual(headFromSpecDetail(REAL_MOLD_AFS, REAL_SPEC_ROWS), {
    强度要求kgf: '≥30kgf',
    压降标准kpa: '≤20kpa',
    跌落要求: '成品强度（一切二）：高度60cm，垂直跌落3次，炭棒无断裂',
    跌落高度cm: '60',
    跌落次数: '3',
    外径mm: '34.5',
    外径公差: '±0.5',
    内径mm: '12.5',
    内径公差: '±0.5',
  })
})

test('尺寸在规格书里是**每行一条** ⇒ 多行合并成四格(长度不落格)', () => {
  const out = headFromSpecDetail(REAL_MOLD_AFS, REAL_SPEC_ROWS.filter((r) => r.检验项目 === '*炭棒尺寸'))
  assert.deepEqual(out, { 外径mm: '34.5', 外径公差: '±0.5', 内径mm: '12.5', 内径公差: '±0.5' })
  assert.equal('长度' in out, false)
})

test('「整体尺寸(外包无纺布)」不是炭棒尺寸 —— 候选里没有它就不许拿来填', () => {
  const out = headFromSpecDetail(REAL_MOLD_AFS, [
    { 检验项目: '*整体尺寸(外包无纺布)', 检验要求: '外径：46±0.5mm\n内径：9.5±0.5mm\n长度：23±0.5mm' },
  ])
  assert.deepEqual(out, {}, '拿外包尺寸填炭棒尺寸 = 静默错数(46 不是炭棒的 34.5)')
})

test('候选是数组:按优先级取,前一个没匹配上才用后一个', () => {
  const onlyLibRow = [{ 检验项目: '强度·跌落强度', 检验要求: '成型强度：高度50cm,跌3次无断裂' }]
  assert.equal(headFromSpecDetail(REAL_MOLD_AFS, onlyLibRow).跌落高度cm, '50')
  const bareRow = [{ 检验项目: '强度·（裸棒）', 检验要求: '成品强度（一切二）：高度60cm，垂直跌落3次，炭棒无断裂' }]
  assert.equal(headFromSpecDetail(REAL_MOLD_AFS, bareRow).跌落高度cm, '60')
})

test('旧口径一字不变:裸名对裸名、忽略空白、全角装饰也认', () => {
  assert.deepEqual(headFromSpecDetail(MOLD_AFS, SPEC_ROWS), {
    跌落要求: '1.2m 高度自由跌落无破损',
    强度要求kgf: '≥ 300N 不破裂',
    压降标准kpa: '≤25kPa',
    外径mm: '20',
    外径公差: '±0.5',
    内径mm: '5',
    内径公差: '±0.3',
  })
  assert.equal(headFromSpecDetail({ headFromDetail: [{ to: '压降标准kpa', matchProject: '压降' }] },
    [{ 检验项目: '＊＃压降', 检验要求: '≤9kpa' }]).压降标准kpa, '≤9kpa')
})

/* ── 明细落点:序号兜底(2026-10-16 用户口径)──────────────────────────────────────
   用户报障:「出货检验记录表前面缺失序号」(截图左侧那一列整列空白)。
   根因:规格书明细的 `序号` **不落库**(那张纸的序号是按组现算的,rd_spec_doc_detail.序号 实测全 NULL),
   而 detail 映射写的是 { to:'序号', from:'序号' } ⇒ 带过去的是空串。
   口径:indexWhenEmpty 的落点拿**行号**(1..N)兜底;规格书自己带了序号就用它自己的。 */
test('序号:规格书那格是空的 ⇒ 按行号 1..N 兜底(那一列不再是空白)', () => {
  const afs = { detail: [{ to: '序号', from: '序号', indexWhenEmpty: true }, { to: '控制项目', from: '检验项目' }] }
  const rows = [{ 序号: null, 检验项目: '强度·*抗压强度' }, { 序号: '', 检验项目: '*炭棒尺寸' }, { 序号: '9', 检验项目: '#*压降' }]
  assert.deepEqual(detailRowsOf(afs, rows), [
    { 序号: '1', 控制项目: '强度·*抗压强度' },
    { 序号: '2', 控制项目: '*炭棒尺寸' },
    { 序号: '9', 控制项目: '#*压降' },
  ])
})

test('没写 indexWhenEmpty 的落点照旧:空就是空(别的链一个字节不变)', () => {
  const afs = { detail: [{ to: '序号', from: '序号' }, { to: '控制项目', from: '检验项目' }] }
  assert.deepEqual(detailRowsOf(afs, [{ 序号: null, 检验项目: '压降' }]), [{ 序号: '', 控制项目: '压降' }])
})

/* ── 明细落点取哪一段行(2026-10-15:配方表那条 detailSource 分支已随口径变更撤掉)──────────
   三条链(出货检验计划表 / 组装BOM表 / 成型工艺清单的检验要求)取的都是 payload.items
   —— 规格书本表区的行,由后端按各自端点选表区。 */
const MOLD_PAYLOAD = {
  found: true,
  items: [{ 检验项目: '压降', 检验要求: '≤5 kPa' }],
}

test('明细取 payload.items;不是数组一律空数组(不猜)', () => {
  assert.deepEqual(specCarryRows(MOLD_PAYLOAD), MOLD_PAYLOAD.items)
  assert.deepEqual(specCarryRows(null), [])
  assert.deepEqual(specCarryRows(undefined), [])
  assert.deepEqual(specCarryRows({ items: 'nope' }), [])
})

