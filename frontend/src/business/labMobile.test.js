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
