/**
 * recordSheetAttachStrip.test.js —— 纸面(RecordSheetPanels)的「明细行附件列」与
 * 「plain 标题右下角单号」的**源码级回归闸**(2026-11-09 第二轮)
 *
 * 【为什么钉这个】用户当天第二轮口径:
 *   ①「附件,3 个面版都要有,而且加在明细字段内,就是表格里面,每一行都有可能要拍照保存。」
 *      ⇒ 照片从**表头**下移到**明细行**:纸面数据表末尾自动补一列(元数据驱动),
 *        每行一个附件格,锚点 `手机照片-<行 id>`;表头那条「附件/照片条」撤掉(避免两处入口)。
 *   ②「先查看原来的电脑面版是否有单据编号。如果没有加在标题的右下角。」
 *      ⇒ plain 登记表纸面原本没有单位置,标题右下角补「编号：xx」;report 版式本来印,不受影响。
 * 单测检查的是这两处的**契约**(读源码/迁移脚本);真机效果与落库取证见
 *   tools/archive/_lab-mobile-20261109/(ego 浏览器走查截图 + SQL 取证)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const sheet = read('./RecordSheetPanels.vue')
const panelxList = read('./PanelxList.vue')
const headMig = read('../../../../tools/migrate-lab-mobile-20261109.sql')
const rowMig = read('../../../../tools/migrate-lab-mobile-row-photo-20261109.sql')

const PANELS = ['RD_SPIKE_WATER', 'RD_EQUIP_USE', 'RD_INSTR_USE']
const DETAIL_TABLES = ['rd_spike_water_detail', 'rd_equip_use_detail', 'rd_instr_use_detail']
const HEAD_TABLES = ['rd_spike_water_head', 'rd_equip_use_head', 'rd_instr_use_head']

// ── ① 明细行附件列(2026-11-09 第二轮:每一行都可能拍照) ───────────────────

test('RecordSheetPanels:明细字段里的附件字段自动补一列(元数据驱动,不在配置里写死)', () => {
  assert.match(sheet, /detailFields: \{ type: Array, default: \(\) => \[\] \}/,
    '组件要接「明细字段元数据」这个 prop,才知道哪些字段是明细字段')
  assert.match(sheet, /const rowAttachCols = computed\(/, '缺少明细附件列的计算')
  assert.match(sheet, /dataType \|\| ''\) === '附件'/, '发现口径必须是 data_type=附件(与面板元数据同源)')
  assert.match(sheet, /\.map\(\(f\) => \(\{ key: attachKeyOf\(f\)[\s\S]{0,80}type: 'file' \}\)\)/,
    '补出来的列必须标成 type:file,渲染层才走附件格')
  assert.match(sheet, /const extra = rowAttachCols\.value\.filter\(/,
    'visCols 里要把附件列追加进去(加标水那种列集由标准库模版决定的表也才带得上)')
})

test('RecordSheetPanels:每行一个附件格,锚点=手机照片-<行id>,保存写回本行这一列', () => {
  assert.match(sheet, /function rowAttachKey\(c, row\) \{\s*\n\s*return `\$\{c\?\.key \|\| ''\}-\$\{row\?\.id \?\? ''\}`/,
    '行锚点必须是 `字段-行id`(后端按行只更新那一行)')
  assert.match(sheet, /<div v-if="c\.type === 'file'" class="rs-file-cell">/, '数据表格子里缺少附件格分支')
  assert.match(sheet, /<FileAttachCell[\s\S]{0,400}?:field-key="rowAttachKey\(c, row\)"/,
    '附件格的 field-key 必须按行走(不能整单一个键)')
  assert.match(sheet, /<FileAttachCell[\s\S]{0,400}?@update:model-value="\(v\) => \{ row\[c\.key\] = v; emit\('dirty'\) \}"/,
    '选/删照片后要把文件名串写回本行这一列(否则保存不带这个值)')
  assert.match(sheet, /v-if="sheetDocNo && row\.id"/,
    '新行还没有行 id ⇒ 只能提示"保存后可上传照片",不能传(锚点缺行号)')
  // 表头那条附件条已撤(用户要求附件只在明细里,避免两处入口)
  assert.ok(!sheet.includes('rsp-attach-strip'), '表头的「附件/照片条」必须撤掉(附件已下移到明细行)')
  assert.ok(!sheet.includes('spareAttachList'), 'spareAttachList(表头附件发现的实现)应已删除')
})

test('PanelxList:把明细字段元数据传给纸面组件(否则列补不出来)', () => {
  assert.match(panelxList, /const sheetDetailFields = computed\(/, '缺少明细字段 computed')
  assert.match(panelxList, /:detail-fields="sheetDetailFields"/, 'RecordSheetPanels 用法里要传 detail-fields')
})

// ── ② plain 版式标题右下角的「编号：xxx」 ──────────────────────────────────

test('RecordSheetPanels:plain 标题右下角补单据编号(没有就补,不重复印)', () => {
  assert.match(sheet, /<span v-if="sheetDocNo" class="rsp-title-docno">\{\{ tt\('编号'\) \}\}：\{\{ sheetDocNo \}\}<\/span>/,
    'plain 登记表标题右下角要印「编号：单据编号」')
  assert.match(sheet, /\.rsp-title-docno \{[\s\S]{0,200}position: absolute;/, '样式要把它贴到标题右下角')
  assert.match(sheet, /\.rsp-plain-title \{\n  position: relative;/, '标题格要 relative,绝对定位的编号才不会跑偏')
})

// ── ③ 数据库:明细列 + yj_field(place=detail);表头列/字段撤掉 ─────────────

test('第二版迁移:三张**明细表**各加一列 [手机照片](幂等)', () => {
  for (const t of DETAIL_TABLES) {
    assert.match(rowMig, new RegExp(`ALTER TABLE ${t} ADD \\[手机照片\\] nvarchar\\(500\\) NULL`),
      `${t} 缺 [手机照片] 列`)
    assert.match(rowMig, new RegExp(`IF COL_LENGTH\\('${t}', '手机照片'\\) IS NULL`),
      `${t} 的加列必须带 IF COL_LENGTH 幂等判断(两账套可重复跑)`)
  }
})

test('第二版迁移:yj_field 改登记到 detail;表头列与表头字段一并撤(先搬数再删列)', () => {
  for (const p of PANELS) {
    assert.match(rowMig, new RegExp(`VALUES \\('${p}', N'手机照片', N'手机照片', N'附件'[^)]*N'detail'`),
      `${p} 要登记 place='detail' 的 手机照片 字段(否则保存不回填、纸面也不出这列)`)
  }
  assert.match(rowMig, /DELETE FROM yj_field[\s\S]{0,200}place = N'header'/, '表头那条字段必须删掉')
  for (const t of HEAD_TABLES) {
    assert.match(rowMig, new RegExp(`ALTER TABLE ${t} DROP COLUMN \\[手机照片\\]`), `${t} 的表头列要删掉`)
  }
  // 附件已存在时不能直接删列丢资料:先把名字搬到本单第一行、把锚点改成「手机照片-行id」
  assert.match(rowMig, /UPDATE a SET a\.field_key = N'手机照片-' \+ CAST\(d\.id AS nvarchar\(20\)\)/,
    '已有附件要把锚点从整单改成第一行,否则删表头列后那些照片再也点不开')
})

test('首版迁移仍保留历史(表头列那版脚本不动,DB 只需按序执行两版)', () => {
  for (const t of HEAD_TABLES) {
    assert.match(headMig, new RegExp(`ALTER TABLE ${t} ADD \\[手机照片\\] nvarchar\\(500\\) NULL`),
      '首版脚本是历史记录,不应被改写(迁移链按内容哈希判重)')
  }
})
