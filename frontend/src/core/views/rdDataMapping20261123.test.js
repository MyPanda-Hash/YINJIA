/**
 * 2026-11-23 第三批：研发管理「数据对应错位」与「复制内容不全」的根因守卫。
 *
 *  A. 项目实施计划「项目名称」被自动建单写成尺寸（来源 = 立项.机型及应用位置）
 *  B. 复制单据：文档编号空白 / 明细行序不重排 / 旧「复制」按钮仍在工具栏
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const btn = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const flow = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/RdProjectFlowService.java', import.meta.url), 'utf8')
const cfg = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java', import.meta.url), 'utf8')

const seg = (src, startMark, endMark) => {
  const a = src.indexOf(startMark)
  const b = src.indexOf(endMark, a + 1)
  assert.ok(a >= 0 && b > a, `找不到片段 ${startMark}`)
  return src.slice(a, b)
}

test('A 自动建实施计划：项目名称不再取「机型及应用位置」', () => {
  const fn = seg(btn, 'private String ensurePlanForApproval', '\n    }')
  assert.ok(!/form\.put\("项目名称",\s*blankSafe\(ap\.get\("机型"\)\)\)/.test(fn), '不得再把 机型 直接当项目名')
  assert.match(fn, /立项背景/, '应先取 立项背景（用户写项目名的那一格）')
  assert.match(fn, /String model = blankSafe\(ap\.get\("机型"\)\)/, '机型只作兜底')
  assert.match(fn, /form\.put\("项目名称", name\)/)
})

test('A2 项目流程管控的项目名称优先取实施计划，不再直接拿机型', () => {
  assert.match(flow, /SELECT TOP 1 p\.\[项目名称\] FROM rd_plan p/, '要先取计划的项目名称')
  assert.ok(!/ISNULL\(\[机型及应用位置\],N''\) AS projectName/.test(flow), '不得再裸取机型当项目名')
})

test('B1 复制单据：客户编号缺失时按客户名解析，文档编号不再永久空白', () => {
  assert.match(btn, /private String customerCodeFrom/, '要有客户名→编码的解析方法')
  const fn = seg(btn, 'private Map<String, Object> copyDocToDraft', 'private String customerCodeFrom')
  assert.match(fn, /customerCodeFrom\(custName\)/, '客户编号为空要走兜底解析')
})

test('B2 复制单据：明细行序从 1 连续重排（注释与实现一致）', () => {
  const fn = seg(btn, 'private Map<String, Object> copyDocToDraft', 'private String customerCodeFrom')
  assert.match(fn, /String seqCol = lineSeqColOf\(def\)/, '要拿到行序列')
  assert.match(fn, /cols\.put\(seqCol, seq\)/, '要写入从 1 开始的连续行号')
  assert.match(btn, /private String lineSeqColOf/, '行序列解析方法要在')
})

test('B3 四张单不再下发旧「复制」按钮（避免点到会丢内容的老路径）', () => {
  assert.match(cfg, /COPY_DOC_PANELS\.contains\(def\.code\(\)\)/, '「更多」组要按面板剔除 复制')
  assert.match(cfg, /List\.of\("表格调整", "导出", "退出"\)/, '这 4 张单的更多组里没有 复制')
})
