/**
 * labMobile.test.js — 「手机扫码 · 实验室记录手机登记」纯逻辑单测(2026-11-09)
 *
 * 钉住用户当天给的四条口径:
 *   ① 三个面板必须是 加标水配置记录表 / 设备使用登记表 / 仪器使用记录表(**不含测试申请单**),
 *      面板码仍是研发管理里那三张 PC 面板 ⇒ 数据天然回填到同一张单;
 *   ② 手机端"只填字段 + 拍照" ⇒ 保存走草稿(add/modify 词),不替用户送审;
 *   ③ 模糊查询交给通用查询(后端 keyword 同时匹配表头+明细),前端只传关键字;
 *   ④ 每个面版多一个「手机照片」字段存附件文件名串 —— 键名是数据键,不允许翻译/改名。
 *
 * 运行:`cd frontend && npm test`(node --test,与其它 business/*.test.js 同一套)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LAB_PANELS, PHOTO_FIELD, labPanelOf, fieldKeyOf, keyOf, today,
  emptyHeader, emptyDetailRow, headerValuesOf, detailRowsOf, rowHasValue,
  buildSavePayload, rowTitleOf, rowMetaOf, photoCountOf, isImageName, baseNameOf,
  rowPhotoKey, mergeRowIds,
  SPIKE_WATER_CODE, TEMPLATE_FIELD, TEMPLATE_LIB, stdLibOptions, stdLibContentOf,
  templateDetailFields, visibleDetailFields,
} from './labMobile.js'

/* ── ① 三个面板 ─────────────────────────────────────────────────────────── */

test('三个面板 = 加标水 / 设备使用 / 仪器使用,面板码仍是 PC 那三张', () => {
  assert.deepEqual(LAB_PANELS.map((p) => p.code), ['RD_SPIKE_WATER', 'RD_EQUIP_USE', 'RD_INSTR_USE'])
  assert.deepEqual(LAB_PANELS.map((p) => p.title), ['加标水配置记录表', '设备使用登记表', '仪器使用记录表'])
  // 测试申请单是三页签的申请单据,不在"实验室记录"范围内
  assert.ok(!LAB_PANELS.some((p) => p.code === 'RD_DOM_TEST'))
});

test('三条手机端地址互不相同,且都在 /panelx/list/ 下(路由会显式注册)', () => {
  const paths = LAB_PANELS.map((p) => p.path)
  assert.equal(new Set(paths).size, 3)
  for (const p of paths) assert.match(p, /^\/panelx\/list\/MOBILE_LAB_[A-Z_]+$/)
});

test('labPanelOf:按码取配置,未知码/空码返回 null(页面据此提示面板编号无效)', () => {
  assert.equal(labPanelOf('RD_EQUIP_USE').title, '设备使用登记表')
  assert.equal(labPanelOf('  RD_INSTR_USE ').title, '仪器使用记录表')
  assert.equal(labPanelOf('RD_DOM_TEST'), null)
  assert.equal(labPanelOf(''), null)
  assert.equal(labPanelOf(null), null)
});

/* ── ② 手机照片字段是数据键 ─────────────────────────────────────────────── */

test('手机照片是固定数据键(与 head 列 / yj_field 同名),不进多语言', () => {
  assert.equal(PHOTO_FIELD, '手机照片')
});

/* ── ③ 字段键口径 ───────────────────────────────────────────────────────── */

test('fieldKeyOf:表头字段取 code,明细字段取 dataName', () => {
  assert.equal(fieldKeyOf({ code: '测试项目', name: 'Test Item' }), '测试项目')
  assert.equal(fieldKeyOf({ dataName: '测试日期', dataType: '日期' }), '测试日期')
  assert.equal(fieldKeyOf({ label: '备注' }), '')     // 只有 label 的字段引擎不会下发,键为空
  assert.equal(fieldKeyOf(null), '')
});

test('keyOf:取不到 code/dataName 时退 label/name(显示名当键的兜底)', () => {
  assert.equal(keyOf({ code: '测试项目' }), '测试项目')
  assert.equal(keyOf({ dataName: '使用人' }), '使用人')
  assert.equal(keyOf({ name: '备注' }), '备注')
  assert.equal(keyOf(null), '')
});

/* ── ④ 新建表单 ─────────────────────────────────────────────────────────── */

const HEADER = [
  { code: '单据编号', dataType: '文本', isNotNull: true },
  { code: '单据日期', dataType: '日期', isNotNull: true },
  { code: '设备名称', dataType: '标准库', isNotNull: true, options: ['A', 'B'] },
  { code: '备注', dataType: '文本' },
  { code: '手机照片', dataType: '附件' },
]
const DETAIL = [
  { dataName: '使用日期', dataType: '日期' },
  { dataName: '测试项目', dataType: '文本' },
  { dataName: '使用人', dataType: '文本' },
]

test('emptyHeader:服务端默认值优先(单据编号/单据日期),日期字段兜底今天,其余空串', () => {
  const form = emptyHeader(HEADER, { 单据编号: 'EU-2026-11-0001', 单据日期: '2026-11-09' })
  assert.equal(form.单据编号, 'EU-2026-11-0001')
  assert.equal(form.单据日期, '2026-11-09')
  assert.equal(form.设备名称, '')
  assert.equal(form.备注, '')
  assert.equal(form.手机照片, '')
});

test('emptyHeader:服务端没给日期时,日期字段=今天', () => {
  const form = emptyHeader([{ code: '使用日期', dataType: '日期' }], {})
  assert.equal(form.使用日期, today())
});

test('today:本地时区 yyyy-MM-dd,月/日补零', () => {
  assert.equal(today(new Date(2026, 0, 5)), '2026-01-05')
  assert.equal(today(new Date(2026, 10, 9)), '2026-11-09')
});

test('emptyDetailRow:每个明细字段都给空串(键齐全,与 PC newDetailRow 同款)', () => {
  assert.deepEqual(emptyDetailRow(DETAIL), { 使用日期: '', 测试项目: '', 使用人: '' })
  assert.deepEqual(emptyDetailRow(null), {})
});

/* ── ⑤ 已有单据 → 表单 ─────────────────────────────────────────────────── */

test('headerValuesOf:只取本面板登记的表头字段,库里没有的给空串', () => {
  const form = headerValuesOf(HEADER, { 单据编号: 'SW-1', 设备名称: '折叠棉试验机', 多余键: 'x' })
  assert.equal(form.设备名称, '折叠棉试验机')
  assert.equal(form.单据编号, 'SW-1')
  assert.equal(form.单据日期, '')
  assert.ok(!('多余键' in form))
});

test('detailRowsOf:原样保留行 id(丢了 id,改单会变成追加新行)', () => {
  const rows = detailRowsOf({ items: [{ id: 7, 使用日期: '2026-11-09', 使用人: '张三' }] })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 7)
  assert.equal(rows[0].使用人, '张三')
  // 返回的是副本:改模型不影响原始响应对象
  rows[0].使用人 = '李四'
  assert.equal(detailRowsOf({ items: [] }).length, 0)
});

test('detailRowsOf:detailData 缺页签/为 null 时返回空数组', () => {
  assert.deepEqual(detailRowsOf(null), [])
  assert.deepEqual(detailRowsOf({}), [])
  assert.deepEqual(detailRowsOf({ other: [{ id: 1 }] }), [])
});

/* ── ⑥ 保存载荷 ─────────────────────────────────────────────────────────── */

test('buildSavePayload:新单不带「编号」(由后端发号),表头键是中文 label', () => {
  const { payload } = buildSavePayload({
    headerFields: HEADER,
    form: { 单据编号: 'EU-预览号', 单据日期: '2026-11-09', 设备名称: '折叠棉试验机', 备注: '手机录入', 手机照片: '旧值' },
    rows: [{ ...emptyDetailRow(DETAIL), 使用人: '张三' }],
    detailFields: DETAIL,
    editingNo: '',
  })
  assert.equal(payload.编号, undefined, '新单不能把预览单号当单据标识提交')
  assert.equal(payload.单据编号, undefined, '单据编号由后端发号,不进载荷')
  assert.equal(payload.手机照片, undefined, '照片列归附件服务维护,保存不覆盖')
  assert.equal(payload.设备名称, '折叠棉试验机')
  assert.equal(payload.单据日期, '2026-11-09')
  assert.deepEqual(payload.detail.items, [{ 使用日期: '', 测试项目: '', 使用人: '张三' }])
});

test('buildSavePayload:改单带「编号」= 原单据号(后端按它更新而不是新建)', () => {
  const { payload } = buildSavePayload({
    headerFields: HEADER,
    form: { 设备名称: 'A' },
    rows: [],
    detailFields: DETAIL,
    editingNo: ' EU-2026-11-0002 ',
  })
  assert.equal(payload.编号, 'EU-2026-11-0002')
});

test('buildSavePayload:全空的明细行被丢掉(电脑端不多出空行),并回报丢了几行', () => {
  const { payload, skippedRows } = buildSavePayload({
    headerFields: HEADER,
    form: { 设备名称: 'A' },
    rows: [
      emptyDetailRow(DETAIL),
      { ...emptyDetailRow(DETAIL), 测试项目: '联调项目' },
      { ...emptyDetailRow(DETAIL), 使用人: '   ' },
    ],
    detailFields: DETAIL,
    editingNo: '',
  })
  assert.equal(payload.detail.items.length, 1)
  assert.equal(payload.detail.items[0].测试项目, '联调项目')
  assert.equal(skippedRows, 2)
});

test('buildSavePayload:只有表头没有明细也能存(空 items,后端建带表头值的草稿)', () => {
  const { payload } = buildSavePayload({
    headerFields: HEADER, form: { 设备名称: 'A' }, rows: [], detailFields: DETAIL, editingNo: '',
  })
  assert.deepEqual(payload.detail.items, [])
});

test('rowHasValue:只要有任意一格非空就算填过(数字 0 也算填过)', () => {
  assert.equal(rowHasValue({ 使用人: '' }, DETAIL), false)
  assert.equal(rowHasValue({ 使用人: '张三' }, DETAIL), true)
  assert.equal(rowHasValue({ 样品数量: 0 }, [{ dataName: '样品数量' }]), true)
});

/* ── ⑥b 逐行照片(2026-11-09 第二轮:附件加在明细字段内) ─────────────────── */

test('rowPhotoKey:锚点 = 手机照片-<行 id>;新行(还没 id)返回空串', () => {
  assert.equal(rowPhotoKey({ id: 12 }), '手机照片-12')
  assert.equal(rowPhotoKey({ id: '7' }), '手机照片-7')
  assert.equal(rowPhotoKey({ id: null }), '', '新行没有 id ⇒ 不能上传,页面要先把照片排队')
  assert.equal(rowPhotoKey({}), '')
  assert.equal(rowPhotoKey(null), '')
});

test('mergeRowIds:改单行按 id 对齐,新行按顺序拿剩下的 id(原地改,保留 __k)', () => {
  const local = [
    { __k: 'a', id: 3, 测试项目: '老行' },
    { __k: 'b', 测试项目: '新行1' },
    { __k: 'c', 测试项目: '新行2' },
  ]
  const { rows, assigned } = mergeRowIds(local, [
    { id: 3, 测试项目: '老行' },
    { id: 10, 测试项目: '新行1' },
    { id: 11, 测试项目: '新行2' },
  ])
  assert.equal(assigned, 2)
  assert.equal(rows, local, '必须原地改同一个数组(页面按 __k 索引排队照片)')
  assert.deepEqual(rows.map((r) => r.id), [3, 10, 11])
  assert.deepEqual(rows.map((r) => r.__k), ['a', 'b', 'c'], '__k 不能被冲掉')
});

test('mergeRowIds:服务端行不够时只补能补的,不瞎填', () => {
  const local = [{ __k: 'a' }, { __k: 'b' }]
  const { assigned } = mergeRowIds(local, [{ id: 5 }])
  assert.equal(assigned, 1)
  assert.equal(local[0].id, 5)
  assert.equal(local[1].id, undefined)
});

test('mergeRowIds:上次已经拿到 id 的行不会被重复分配', () => {
  const local = [{ __k: 'a', id: 9 }, { __k: 'b' }]
  const { assigned } = mergeRowIds(local, [{ id: 9 }, { id: 12 }])
  assert.equal(assigned, 1)
  assert.deepEqual(local.map((r) => r.id), [9, 12])
});

/* ── ⑦ 列表显示 ─────────────────────────────────────────────────────────── */
test('rowTitleOf:主标题取面板指定字段,取不到退回单据编号', () => {
  const equip = labPanelOf('RD_EQUIP_USE')
  assert.equal(rowTitleOf(equip, { 设备名称: '折叠棉试验机', 单据编号: 'EU-1' }), '折叠棉试验机')
  assert.equal(rowTitleOf(equip, { 单据编号: 'EU-1' }), 'EU-1')
  assert.equal(rowTitleOf(labPanelOf('RD_INSTR_USE'), { '仪器名称/型号': 'UV-2600', 单据编号: 'IU-1' }), 'UV-2600')
});

test('rowMetaOf:编号 · 日期 · 状态,缺项不留空分隔符', () => {
  assert.equal(rowMetaOf({ 单据编号: 'EU-1', 单据日期: '2026-11-09', 单据状态: '草稿' }), 'EU-1 · 2026-11-09 · 草稿')
  assert.equal(rowMetaOf({ 单据编号: 'EU-1', 单据状态: '草稿' }), 'EU-1 · 草稿')
  assert.equal(rowMetaOf({}), '')
});

test('photoCountOf:按「、」数照片;空值 0;单个也不误算', () => {
  assert.equal(photoCountOf({ 手机照片: '' }), 0)
  assert.equal(photoCountOf({}), 0)
  assert.equal(photoCountOf({ 手机照片: 'a.jpg' }), 1)
  assert.equal(photoCountOf({ 手机照片: 'a.jpg、b.jpg、c.jpg' }), 3)
});

test('isImageName:常见图片扩展名(含手机 HEIC)才算图,其余走文件名', () => {
  for (const n of ['a.JPG', 'b.jpeg', 'c.png', 'd.webp', 'e.heic']) assert.equal(isImageName(n), true, n)
  for (const n of ['a.pdf', 'b.docx', '', 'noext']) assert.equal(isImageName(n), false, n)
});

test('baseNameOf:去掉 Android 相机给的完整路径', () => {
  assert.equal(baseNameOf('C:\\DCIM\\Camera\\IMG_001.jpg'), 'IMG_001.jpg')
  assert.equal(baseNameOf('/storage/emulated/0/DCIM/a.png'), 'a.png')
  assert.equal(baseNameOf('a.png'), 'a.png')
  assert.equal(baseNameOf(null), '')
});

/* ───────── 加标水:「测试项目」决定明细列(2026-11-09 第五轮) ─────────
   用户口径:「加标水配置记录表这个面版的字段是根据测试项目变化的,而且可以新增模板自己进行配置字段。
             所以手机端要实现能够对应测试项目,明细有所变化」 */

/** 三个正式条目(content 是列结构 JSON)+ 两条老式纯文本条目(服务器上就长这样) */
const LIB_ROWS = [
  { id: 32, item_code: 'NSF 53-除铅（PH8.5）', content: '{"cols":[{"key":"测试日期","w":90},{"key":"硫酸镁","group":"试剂用量（g）"}]}', enabled: 1, seq: 10 },
  { id: 33, item_code: 'NSF 53-除汞（PH8.5）', content: '{"cols":[{"key":"测试日期","w":90},{"key":"碳酸氢钠","group":"试剂用量（g）"}]}', enabled: 1, seq: 20 },
  { id: 34, item_code: 'NSF 53-除VOC', content: '{"cols":[{"key":"测试日期","w":90}]}', enabled: 1, seq: 30 },
  { id: 411, item_code: '默认', content: 'NSF 42-余氯', enabled: 1, seq: 40 },
  { id: 417, item_code: '默认', content: 'NSF 42 氯胺  氢氧化钠  次氯酸钠  氯化铵', enabled: 0, seq: 50 },
  { id: 418, item_code: '默认', content: 'NSF 42氯胺', enabled: 1, seq: 60 },
  { id: 419, item_code: '默认', content: 'cs', enabled: 0, seq: 70 },
]

test('模板管的是加标水那张面板,字段名/库编码与电脑端同一口径', () => {
  assert.equal(SPIKE_WATER_CODE, 'RD_SPIKE_WATER')
  assert.equal(TEMPLATE_FIELD, '测试项目')
  assert.equal(TEMPLATE_LIB, 'lab.test_item')
})

test('stdLibOptions:新式条目用 item_code,老式纯文本条目用 content(停用不进候选)', () => {
  assert.deepEqual(stdLibOptions(LIB_ROWS), [
    'NSF 53-除铅（PH8.5）', 'NSF 53-除汞（PH8.5）', 'NSF 53-除VOC', 'NSF 42-余氯', 'NSF 42氯胺',
  ])
})

test('stdLibOptions:空/脏数据不炸,同名去重', () => {
  assert.deepEqual(stdLibOptions(null), [])
  assert.deepEqual(stdLibOptions([null, {}, { item_code: '', content: '' }]), [])
  const dup = [{ item_code: 'A', content: '{"cols":[]}' }, { item_code: 'A', content: '{"cols":[]}' }]
  assert.deepEqual(stdLibOptions(dup), ['A'])
})

test('stdLibContentOf:按 item_code 命中新式条目,按 content 命中老式条目,停用/找不到返回空串', () => {
  assert.match(stdLibContentOf(LIB_ROWS, 'NSF 53-除汞（PH8.5）'), /碳酸氢钠/)
  assert.equal(stdLibContentOf(LIB_ROWS, 'NSF 42-余氯'), 'NSF 42-余氯')
  assert.equal(stdLibContentOf(LIB_ROWS, 'NSF 42 氯胺  氢氧化钠  次氯酸钠  氯化铵'), '', '停用条目不算')
  assert.equal(stdLibContentOf(LIB_ROWS, '不存在'), '')
  assert.equal(stdLibContentOf(LIB_ROWS, ''), '')
})

test('templateDetailFields:列 → 明细字段(键=列名,label 缺省用键,带分格与列宽)', () => {
  const fs = templateDetailFields([
    { key: '测试日期', w: 90 },
    { key: '配水量\\n（L）', label: '配水量\\n（L）', w: 80 },
    { key: '碳酸氢钠', label: '碳酸氢钠', w: 70, group: '试剂用量（g）' },
  ])
  assert.deepEqual(fs.map((f) => f.dataName), ['测试日期', '配水量\\n（L）', '碳酸氢钠'])
  assert.equal(fs[0].name, '测试日期')
  assert.equal(fs[1].width, 80)
  assert.equal(fs[2].group, '试剂用量（g）')
  assert.equal(fs[2].dataType, '文本')
})

test('templateDetailFields:**类型从面板元数据继承**(日期列必须是日期,否则手机上没有日期选择器)', () => {
  const meta = [
    { dataName: '测试日期', name: '测试日期', dataType: '日期' },
    { dataName: '配水量\\n（L）', name: '配水量\\n（L）', dataType: '文本', isNotNull: true },
    { dataName: '负责人', name: '负责人', dataType: '文本' },
    { dataName: '手机照片', name: '手机照片', dataType: '附件' },
  ]
  const fs = templateDetailFields([
    { key: '测试日期', w: 90 },
    // 列名去换行/空白后与元数据同名 ⇒ 也要能对上
    { key: '配水量（L）', label: '配水量（L）', w: 80 },
    { key: '碳酸氢钠', w: 70, group: '试剂用量（g）' },
  ], meta)
  assert.equal(fs[0].dataType, '日期', '测试日期必须继承「日期」——手机端据此渲染日期选择器')
  assert.equal(fs[1].dataType, '文本')
  assert.equal(fs[1].isNotNull, true, '必填标记也一起继承')
  assert.equal(fs[2].dataType, '文本', '元数据里没有的列退回文本')
})

test('visibleDetailFields:模版列继承类型(整屏字段里测试日期是日期)', () => {
  const meta = [
    { dataName: '测试日期', dataType: '日期' },
    { dataName: '手机照片', dataType: '附件' },
  ]
  const out = visibleDetailFields({
    isTemplate: true,
    layout: { cols: [{ key: '测试日期', w: 90 }, { key: '碳酸氢钠', w: 70 }], ok: true },
    metaFields: meta,
  })
  assert.deepEqual(out.map((f) => `${f.dataName}:${f.dataType}`), ['测试日期:日期', '碳酸氢钠:文本', '手机照片:附件'])
})

test('visibleDetailFields:加标水 = 模版列 + 那个附件列;其它面板/未选项目 = 原样元数据', () => {
  const meta = [
    { dataName: '测试日期', dataType: '日期' },
    { dataName: '负责人', dataType: '文本' },
    { dataName: PHOTO_FIELD, dataType: '附件' },
  ]
  const layout = { cols: [{ key: '测试日期', w: 90 }, { key: '碳酸氢钠', group: '试剂用量（g）' }], ok: true }
  const tpl = visibleDetailFields({ isTemplate: true, layout, metaFields: meta })
  assert.deepEqual(tpl.map((f) => f.dataName), ['测试日期', '碳酸氢钠', PHOTO_FIELD], '模版列在前,附件列固定在后')
  assert.deepEqual(visibleDetailFields({ isTemplate: false, layout, metaFields: meta }), meta)
  assert.deepEqual(visibleDetailFields({ isTemplate: true, layout: null, metaFields: meta }), meta, '还没选测试项目 ⇒ 先按元数据')
})

test('换「测试项目」⇒ 明细列跟着换(同一条路径:取 content → parseLayout → 字段)', async () => {
  const { parseLayout } = await import('../core/panel/spikeWaterLayout.js')
  const lead = parseLayout(stdLibContentOf(LIB_ROWS, 'NSF 53-除铅（PH8.5）'))
  const mercury = parseLayout(stdLibContentOf(LIB_ROWS, 'NSF 53-除汞（PH8.5）'))
  assert.deepEqual(templateDetailFields(lead.cols).map((f) => f.dataName), ['测试日期', '硫酸镁'])
  assert.deepEqual(templateDetailFields(mercury.cols).map((f) => f.dataName), ['测试日期', '碳酸氢钠'])
  // 老式条目没有列结构 ⇒ parseLayout 退回内置列集(不报错、不白屏)
  const legacy = parseLayout(stdLibContentOf(LIB_ROWS, 'NSF 42-余氯'))
  assert.equal(legacy.ok, false)
  assert.ok(legacy.cols.length >= 6, '退回内置列集不能是空表')
})