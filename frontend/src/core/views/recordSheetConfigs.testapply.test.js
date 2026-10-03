/**
 * 「测试申请单」RD_DOM_TEST 三页签配置不变量单测(2026-09-30)
 *
 * 设计源:《产品开发\3.实验室使用记录表\测试申请单.xlsx》3 个 sheet
 *   页 0 内部委托-测试申请单     ← sheet 内部1(16 列 B..Q,受控表单编号 YJ-RIR001)
 *   页 1 销售端-测试/检测申请表  ← sheet 外部 (9 列 B..J,受控表单编号 YJ-XS002)
 *   页 2 委托测试汇总表          ← sheet 汇总表(只读派生台账,不落库)
 *
 * 【这些不变量为什么必须自动化守】多页签面板最容易坏在"页与页串味"上,而纸面串行不会报错:
 *   · 网格列数 ≠ 该页表格的列跨度之和 ⇒ 表头/空行的 colspan 与 colgroup 对不上,整块表格错位;
 *   · 两张逻辑表共用一张行表(rd_dom_test_detail)却没有各自的 filterKey/filterVal
 *     ⇒ rowsOf() 把整份明细当本表显示、confirmLib() 删掉"别的表区"的行(组装工艺清单踩过);
 *   · 单据号与受控表单编号混用 ⇒ 汇总表列出的号在纸面上找不到(两号混在一个格子里)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const cfg = recordSheetConfigs.RD_DOM_TEST
const FIXTURE = JSON.parse(readFileSync(new URL('./rdPanelLabels.fixture.json', import.meta.url), 'utf8'))

/** 一行的列跨度之和(与渲染器 totalSpan 同口径:span 缺省 1) */
const spans = (cols) => (cols || []).reduce((s, c) => s + (c.span || 1), 0)

test('测试申请单 = 一张单三个页签,标题与顺序照设计三个 sheet', () => {
  assert.ok(cfg, 'RD_DOM_TEST 配置缺失')
  assert.deepEqual((cfg.pages || []).map((p) => p.title), [
    '内部委托-测试申请单', '销售端-测试/检测申请表', '委托测试汇总表',
  ])
})

test('纸面右上角是受控表单编号(逐页常量 YJ-RIR001 / YJ-XS002),不是单据号', () => {
  assert.equal(cfg.pages[0].docNoStatic, 'YJ-RIR001')
  assert.equal(cfg.pages[1].docNoStatic, 'YJ-XS002')
  assert.equal(cfg.pages[2].docNoStatic, undefined, '汇总表页不出报告头,不该有编号格')
  assert.equal(cfg.pages[2].showHead, false)
})

test('文档编号不再登记为字段(登记回去会让第二张单保存撞唯一性)', () => {
  const labels = new Set(FIXTURE.RD_DOM_TEST?.labels || [])
  assert.ok(!labels.has('文档编号'), 'yj_field 里不应再有 RD_DOM_TEST.文档编号(见迁移脚本注释)')
})

test('每页网格列数 = 该页报告头三段跨度之和 / 该页数据表列跨度之和', () => {
  for (const [i, pg] of (cfg.pages || []).entries()) {
    const gridLen = (pg.grid || []).length
    assert.ok(gridLen > 0, `页 ${i} 必须自带 grid(两页列数不同,共用会把其中一页挤变形)`)
    const h = pg.head
    if (h) {
      const headSum = (h.title || 0) + (h.infoLabel || 0) + (h.infoValue || 0)
      assert.equal(headSum, gridLen, `页 ${i} 报告头跨度合计 ${headSum} ≠ 网格列数 ${gridLen}`)
      // 第 1 行「公司名 | 编号」按设计 merges 显式切分:两侧 + 中间空列必须铺满整行
      if (h.noSpan !== undefined) {
        const row1 = (h.noSpan === 0 ? 0 : gridLen - h.noSpan - (h.noGapSpan || 0)) + (h.noGapSpan || 0) + (h.noSpan === 0 ? 0 : h.noSpan)
        assert.equal(row1, gridLen, `页 ${i} 第 1 行(公司名/编号)跨度合计 ${row1} ≠ ${gridLen}`)
      }
    }
    for (const dt of (cfg.dataTables || []).filter((d) => (d.page ?? 0) === i)) {
      assert.equal(spans(dt.cols), gridLen, `页 ${i} 数据表列跨度 ${spans(dt.cols)} ≠ 网格列数 ${gridLen}`)
    }
  }
})

test('两张申请表共用行表 ⇒ 各自必须带 [表区] 分块键,且两值不同', () => {
  const dts = cfg.dataTables || []
  assert.equal(dts.length, 2)
  for (const dt of dts) {
    assert.equal(dt.filterKey, '表区')
    assert.ok(dt.filterVal, `页 ${dt.page} 的表缺 filterVal(会把整份明细当本表显示)`)
  }
  assert.deepEqual(dts.map((d) => d.filterVal), ['内部申请', '外部申请'])
})

test('页 0 内部委托单:样品信息三格成组 + 紧急程度/期望/预计完成日期(新设计并表)', () => {
  const cols = cfg.dataTables[0].cols
  const keys = cols.map((c) => c.key)
  assert.deepEqual(cols.filter((c) => c.group).map((c) => c.key), ['尺寸', '配方', '密度'])
  assert.deepEqual(cols.filter((c) => c.group).map((c) => c.group), new Array(3).fill('测试（检测）样品信息'))
  for (const k of ['紧急程度', '期望完成日期', '预计完成日期']) {
    assert.ok(keys.includes(k), `页 0 缺列 ${k}`)
  }
  // 旧「品质委托」变体的样品列退化为历史列:不进纸面
  for (const k of ['产品编号', '产品名称', '生产批次']) {
    assert.ok(!keys.includes(k), `${k} 是历史列,不该画在新设计的纸上`)
  }
})

test('页 1 销售端申请表:设计 9 列照排(内容/背景/目标要求/送样支数/提供报告)', () => {
  const keys = cfg.dataTables[1].cols.map((c) => c.key)
  assert.deepEqual(keys, [
    '序号', '日期', '发起人', '测试（检测）内容', '测试（检测）背景',
    '测试（检测）目标/要求', '是否要求送样/支数', '是否需要提供报告', '备注',
  ])
})

test('页 0 带设计的两处附录:测试周期须知(表尾)+ 国标可测项目 17 行(静态附表)', () => {
  assert.match(cfg.dataTables[0].footerNote || '', /^测试周期：/)
  assert.match(cfg.dataTables[0].footerNote || '', /加急样品需请示冯工批准后安排/)
  const tail = (cfg.tailTables || []).find((t) => (t.page ?? 0) === 0)
  assert.ok(tail, '页 0 缺「国标浸泡安全指标可测试列表」附表')
  assert.equal(tail.bar, '国标浸泡安全指标可测试列表')
  assert.deepEqual(tail.cols.map((c) => c.key), ['序号', '项目', '卫生要求', '测试仪器', '检出限'])
  assert.equal(tail.rows.length, 17)
  assert.deepEqual([tail.rows[0].项目, tail.rows[16].项目], ['浑浊度', '银'])
})

test('页 2 汇总表:列 = 设计 6 列,分类由 申请单类型 映射', () => {
  const lg = cfg.pages[2].ledger
  assert.ok(lg, '页 2 必须是只读台账页(pages[2].ledger)')
  assert.deepEqual(lg.cols.map((c) => c.label), ['序号', '表格编号', '发起人', '申请日期', '分类', '状态'])
  assert.equal(lg.cols[1].keys[0], '单据编号', '表格编号 = 单据编号(设计对照 §2.11 口径)')
  assert.deepEqual(lg.cols[4].map, { 内部委托: '内部', 销售端: '外部' })
})

test('页 0 / 页 1 每个列的 key 都必须是 yj_field.label —— 五列 col_name 与 label 分叉是重灾区', () => {
  // 背景/目的→测试（检测）背景/目的、方法→测试（检测）方法、标准→测试（检测）标准、
  // 目标→测试（检测）目标、样品处理→测完后样品样品处理:改造前配置写的是 col_name
  // ⇒ 那五列取不到值、保存被 labelsToCols 静默丢掉(旧配置挂在 variants 下,通用测试查不到)。
  const labels = new Set(FIXTURE.RD_DOM_TEST?.labels || [])
  const bad = (cfg.dataTables || []).flatMap((dt) => (dt.cols || [])
    .map((c) => c.key)
    .filter((k) => k && !labels.has(k)))
  assert.deepEqual(bad, [], `这些 key 不是该面板的 label(整列空白且保存丢值): ${bad.join(', ')}`)
})

test('申请单类型的两个字典值与 汇总表 分类映射表一一对应(改一处必须改另一处)', () => {
  // 字典值真源 = 迁移脚本 yj_field.dict_sql:VALUES (N'内部委托'),(N'销售端')
  const dictValues = ['内部委托', '销售端']
  assert.deepEqual(Object.keys(cfg.pages[2].ledger.cols[4].map), dictValues)
})
