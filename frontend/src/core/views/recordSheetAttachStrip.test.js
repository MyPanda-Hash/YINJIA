/**
 * recordSheetAttachStrip.test.js —— 纸面(RecordSheetPanels)的「附件/照片条」与三张实验室记录表的
 * 「手机照片」字段基线的**源码级回归闸**(2026-11-09)
 *
 * 【为什么钉这个】用户口径当天:「研发图片上的 3 个面版也要对应的做手机端……还有原来每个面版要
 *   增加一个字段,来保存手机拍照上传的文件。」落点有两处必须同时在位,少一处用户就看不到照片:
 *     ① 数据库/元数据:三张 head 表有 [手机照片] 列 + yj_field 里 data_type='附件'(→ 电脑端才有附件入口);
 *     ② 渲染层:RecordSheetPanels 把「配置没消费的附件字段」聚合成纸面上方的附件条
 *        (这三张是 plain 登记表版式,纸面没有通用 key-value 区可挂 FileAttachCell)。
 * 单测检查的是这两处的**契约**(读源码/迁移脚本),真机效果见
 *   tools/archive/_lab-mobile-20261109/(ego 浏览器走查截图 round-48 / round-50)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const sheet = read('./RecordSheetPanels.vue')
const migration = read('../../../../tools/migrate-lab-mobile-20261109.sql')

const PANELS = ['RD_SPIKE_WATER', 'RD_EQUIP_USE', 'RD_INSTR_USE']

// ── ① 渲染层:纸面上方的附件条 ────────────────────────────────────────────

test('RecordSheetPanels 引入 FileAttachCell 并把它挂在附件条上', () => {
  assert.match(sheet, /import FileAttachCell from '\.\/FileAttachCell\.vue'/,
    '纸面附件必须是元数据驱动的通用能力,不能只有 PanelxList 有')
  assert.match(sheet, /class="rsp-attach-strip[^"]*"/, '缺少给「配置没消费的附件字段」用的附件条容器')
  assert.match(sheet, /<FileAttachCell[\s\S]{0,400}?:field-key="attachKeyOf\(f\)"/,
    '附件格的 field-key 必须跟着发现出来的字段键走(不能写死 手机照片)')
  assert.match(sheet, /<FileAttachCell[\s\S]{0,400}?:doc-no="sheetDocNo"/,
    '附件锚点的单号必须与纸面右上编号同源(附件服务按 面板+单号+字段 落库)')
  assert.match(sheet, /<FileAttachCell[\s\S]{0,400}?:can-edit="editable"/,
    '可编辑才给上传/删除;只读仍要能点开看(不能像历史事故那样整格消失)')
})

test('附件条:配置声明过的 {type:file} 字段不重复渲染,只兜元数据里有而配置没写的那类', () => {
  assert.match(sheet, /function declaredFileKeys\(/, '需要收集 recordSheetConfigs 已声明的附件键')
  assert.match(sheet, /const spareAttachList = computed\(/, 'spareAttachList 是按字段元数据算出来的')
  assert.match(sheet, /dataType \|\| ''\) === '附件'/, '发现口径必须是 data_type=附件(与 PanelxList 同款)')
  assert.match(sheet, /!declared\.has\(k\)/, '配置已声明成 type:file 的字段必须排除,否则同一附件出现两次')
})

test('附件条:没有单号(新单未保存)不渲染,且不参与打印', () => {
  assert.match(sheet, /v-if="spareAttachList\.length && sheetDocNo"/,
    '附件锚点必须有单据编号;新单还没编号时不渲染这条')
  assert.match(sheet, /rsp-attach-strip no-print/, '纸面打印仍走「手机照片」列里的文件名串,附件条不进纸')
})

// ── ② 数据库/元数据:三张表的「手机照片」字段 ──────────────────────────────

test('迁移脚本:三张 head 表各加一列 [手机照片],幂等', () => {
  for (const t of ['rd_spike_water_head', 'rd_equip_use_head', 'rd_instr_use_head']) {
    assert.match(migration, new RegExp(`ALTER TABLE ${t} ADD \\[手机照片\\] nvarchar\\(500\\) NULL`),
      `${t} 缺 [手机照片] 列(或不是 nvarchar(500) NULL)`)
    assert.match(migration, new RegExp(`IF COL_LENGTH\\('${t}', '手机照片'\\) IS NULL`),
      `${t} 的加列必须带 IF COL_LENGTH 幂等判断(脚本要能在两账套重复跑)`)
  }
})

test('迁移脚本:三个面板各登记一条 yj_field,data_type=附件、place=header', () => {
  for (const p of PANELS) {
    const re = new RegExp(`VALUES \\('${p}', N'手机照片', N'手机照片', N'附件'[^)]*N'header', 50`, 's')
    assert.match(migration, re, `${p} 必须登记 data_type=N'附件' 的 手机照片 字段(否则电脑端没有附件入口)`)
  }
  // 附件字段必须是表头字段:挂到 detail 会变成"每行一张照片",与"一单一组照片"的口径不符
  assert.equal(migration.match(/N'header', 50, 200, 1, 0, 0, 1\)/g)?.length, 3, '三条字段行都应是 header/seq=50')
})

test('迁移脚本:带 en 译名与中文列注明(多语言红线 + 部署规范)', () => {
  assert.match(migration, /INSERT INTO yj_translation[\s\S]{0,200}'field', N'手机照片', 'en', N'Mobile Photo'/,
    '新字段必须带 en 译名(AGENTS 多语言红线)')
  assert.equal(migration.match(/sp_addextendedproperty N'MS_Description'/g)?.length >= 3, true,
    '三张表的新列都要写 MS_Description 中文注明')
})
