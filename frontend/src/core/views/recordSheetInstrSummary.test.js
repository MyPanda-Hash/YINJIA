/**
 * 实验室仪器使用记录表(RD_INSTR_USE)「使用记录汇总」页签 —— 配置 / 取数契约(2026-11-19)
 *
 * 用户口径:「为当前的实验室使用记录表增加一个汇总表格。汇总表需要查看的内容就这样查看吧。」
 * 表样列 = 仪器名称/型号 | 日期 | 起止时间 | 仪器状态 | 是否内校 | 项目名称/内容 | 数量 | 使用人 | 备注。
 *
 * 实现口径:
 *   · 页签 = RD_INSTR_USE 面板内第 2 页「使用记录汇总」,只读、不落库;
 *   · 行源 = rd_instr_use_head × rd_instr_use_detail(一行 = 一条使用记录,跨全部单据/仪器),
 *     后端 POST /px/instrUseSummary(QueryService.instrUseSummary),权限沿用 RD_INSTR_USE view;
 *   · 渲染复用 RecordSheetPanels 的 ledger 块(与测试申请单「委托测试汇总表」同一套),
 *     但该块默认走 /px/queryFormDataList(表头摘要)—— 因此 ledger.endpoint 必须显式声明,
 *     且 loadLedger 必须按 endpoint 分支取数,否则汇总页会列出"一张单一行"的错误内容。
 *
 * 本测试只钉源码/配置契约(组件挂载成本高),断言锚在唯一上下文上。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const cfg = recordSheetConfigs.RD_INSTR_USE
const sheet = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const pxController = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/PxController.java', import.meta.url), 'utf8')
const queryService = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/QueryService.java', import.meta.url), 'utf8')

/** 用户给的表样列（顺序即纸面顺序） */
const WANT_COLS = ['仪器名称/型号', '日期', '起止时间', '仪器状态', '是否内校', '项目名称/内容', '数量', '使用人', '备注']

test('RD_INSTR_USE 第 2 页 = 使用记录汇总,版式不继承登记表标题条', () => {
  assert.ok(cfg, 'RD_INSTR_USE 配置缺失')
  assert.deepEqual((cfg.pages || []).map((p) => p.title), ['仪器使用记录', '使用记录汇总'])
  const summary = cfg.pages[1]
  // headMode 必须 report:页 0 是 plain(标题条 + 仪器名称/型号副标题),继承过来会在汇总表上方多一条登记表头
  assert.equal(summary.headMode, 'report')
  assert.equal(summary.showHead, false)
  assert.ok(summary.ledger, '汇总页必须声明 ledger')
})

test('汇总表列 = 用户表样的 9 列且顺序一致', () => {
  const ledger = cfg.pages[1].ledger
  assert.deepEqual(ledger.cols.map((c) => c.label), WANT_COLS)
  // 每一列都按 keys 取平铺汇总行(不是表头 detail.items),否则整列空白
  for (const c of ledger.cols) {
    assert.ok(Array.isArray(c.keys) && c.keys.length, `列「${c.label}」缺 keys`)
    assert.equal(c.keys[0], c.label === '数量' ? '数量' : c.label)
  }
  // 9 列必须一屏看全(纸面内容区约 845~880px):超过就会出现横向滚动条,「备注」被挤出视野
  const width = ledger.cols.reduce((s, c) => s + (c.w || 0), 0)
  assert.ok(width <= 880, `汇总表列宽合计 ${width}px 超出纸面内容区,备注会被挤出屏幕`)
})

test('汇总页走专属只读接口,不是面板列表接口', () => {
  const ledger = cfg.pages[1].ledger
  assert.equal(ledger.endpoint, '/px/instrUseSummary')
  assert.equal(ledger.emptyText, '暂无使用记录')
  // 页 0 的数据表必须显式 page:0,否则多页签后两张表会串到同一页
  assert.equal(cfg.dataTables[0].page, 0)
})

test('RecordSheetPanels.ledger:声明 endpoint 时按专属接口取数,空态用配置文案', () => {
  const seg = sheet.slice(sheet.indexOf('async function loadLedger()'), sheet.indexOf('const ledgerCell', sheet.indexOf('async function loadLedger()')))
  assert.match(seg, /lg\.endpoint/, 'loadLedger 必须识别 ledger.endpoint')
  assert.match(seg, /request\.post\(lg\.endpoint, lg\.params \|\| \{\}\)/, 'endpoint 分支要按配置地址取数')
  assert.match(seg, /request\.post\('\/px\/queryFormDataList'/, '未声明 endpoint 的台账仍走原接口')
  assert.match(sheet, /ledgerCfg\.emptyText \|\| '暂无申请单'/, '空态文案要读配置')
})

test('后端汇总接口:RD_INSTR_USE 查看权 + 头行表关联 + 作废过滤', () => {
  assert.match(pxController, /@PostMapping\("\/instrUseSummary"\)/, '缺 /px/instrUseSummary')
  const at = pxController.indexOf('public ApiResult<Map<String, Object>> instrUseSummary')
  assert.ok(at > 0, '缺 instrUseSummary 端点')
  const seg = pxController.slice(at, at + 900)
  assert.match(seg, /requirePanelView\("RD_INSTR_USE"\)/, '权限必须沿用 RD_INSTR_USE')
  assert.match(seg, /queryService\.instrUseSummary\(/, '端点要委托 QueryService')

  const qsAt = queryService.indexOf('public List<Map<String, Object>> instrUseSummary(')
  assert.ok(qsAt > 0, '缺 QueryService.instrUseSummary')
  const qs = queryService.slice(qsAt, qsAt + 3000)
  assert.match(qs, /FROM dbo\.rd_instr_use_detail d/, '行表来源')
  assert.match(qs, /JOIN dbo\.rd_instr_use_head h/, '头表关联')
  assert.match(qs, /ISNULL\(d\.asp_cancel, N'N'\) <> N'Y'/, '行作废过滤')
  assert.match(qs, /ISNULL\(h\.asp_cancel, N'N'\) <> N'Y'/, '头作废过滤')
  // 仪器名/日期按「明细优先、表头兜底」取
  assert.match(qs, /ISNULL\(NULLIF\(LTRIM\(RTRIM\(d\.\[仪器名称\/型号\]\)\)/, '仪器名优先取明细行')
  assert.match(qs, /ISNULL\(NULLIF\(LTRIM\(RTRIM\(d\.\[使用日期\]\)\)/, '日期优先取明细使用日期')
  // 用户表样里的「数量」= 物理列 样品数量、显示名 数量
  assert.match(qs, /AS \[数量\]/, '数量列要按表样命名')
})
