// _batch-sched-write-test.mjs — 批量排产「真写库」端到端验证(2026-11-01,只在测试账套)
//
// 目的:读验证只证明界面与换算预览;这条补上**一次性排产 2 张工单**的写路径——
//   ① 生产工单页勾 2 行 → 内嵌快速排产页 → 批量排产弹窗;
//   ② 批量弹窗里逐道选线(整批共用) → 点「排产 2 行」;
//   ③ 直连 HSDZ_MES_TEST 断言 wo_process_line:每行每道「计划数量 = 该行排产数量 × 该行路线该道换算率」
//      (GY-CB-STD 成型 3、切炭/组装 1),且计划生产线/计划开工·完工日期已落;plang.scx 已写;
//   ④ **收尾撤销排产**(/px/scheduleBoard/unassign)→ 断言台账作废、待排产池行数恢复。
//
// 选行口径:测试账套里**没有报工**的待排产行(GD-2026-10-001x 一批)——
//   有报工的行后端会以「已有报工进度」拒绝撤销,写验证必须选可撤销的,否则会留下已在产数据。
//
// 前置:后端 8090 + 前端 5173。
// 运行(在 tests/e2e 下): node scripts/_batch-sched-write-test.mjs
import { chromium } from '@playwright/test'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const mssql = require('mssql')

const API = 'http://localhost:8090'
const WEB = 'http://localhost:5173'
const DB = 'HSDZ_MES_TEST'
const KEYWORD = 'GD-2026-10-001'
let failed = 0
const log = (...a) => console.log(...a)
function check(ok, msg) {
  if (ok) { log('  [PASS] ' + msg); return }
  failed++
  console.error('  [FAIL] ' + msg)
}

const login = await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (login.code !== 200) throw new Error('测试账套登录失败: ' + JSON.stringify(login))
const token = login.data.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const pending = async (keyword) => (await (await fetch(API + '/api/px/scheduleBoard/pending', {
  method: 'POST', headers: H, body: JSON.stringify({ keyword }),
})).json()).data || []

const db = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await db.request().query(sql)).recordset

// 选两张**无报工**的同工序链待排产行(有报工会被撤销守卫拒 ⇒ 写验证必须可选可撤)
const poolAll = await pending(KEYWORD)
const ids = poolAll.map((r) => String(r['行id'])).join(',')
const noReport = new Set((await q(`
  SELECT p.id FROM dbo.plang p
  WHERE p.id IN (${ids || '0'})
    AND NOT EXISTS (SELECT 1 FROM dbo.scjl s WHERE s.gldh = p.pl_no AND ISNULL(s.asp_cancel,N'N') <> N'Y')`))
  .map((x) => String(x.id)))
const pick = poolAll.filter((r) => noReport.has(String(r['行id']))).slice(0, 2)
if (pick.length < 2) throw new Error('测试账套「' + KEYWORD + '」下无报工的待排产行不足 2 行: ' + pick.length)
const targets = pick.map((r) => r['加工单号'])
const pendBefore = poolAll.length
log('待排产', pendBefore, '行;本次写库对象(无报工,可撤销):', targets.join(' / '))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'zh-CN' })
await ctx.addInitScript(({ token, factory }) => {
  localStorage.setItem('mes_token', token)
  localStorage.setItem('mes_user', JSON.stringify({
    userName: 'admin', realName: '管理员', roleCode: 'admin', isAdmin: true,
    visiblePanels: ['*'], approvePanels: ['*'],
  }))
  localStorage.setItem('mes_init_done', '1')
  if (factory) localStorage.setItem('mes_factory', JSON.stringify({ code: factory }))
}, { token, factory: login.data.user?.factory })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('response', async (r) => {
  if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url() + ' ' + (await r.text().catch(() => '')))
})

let scheduled = false
try {
  // ② 生产工单页:日期窗 2026-10 → 关键字 → 勾两行 → 排产
  await page.goto(WEB + '/#/prod/plan/workOrderList', { waitUntil: 'domcontentloaded' })
  const kw = page.locator('input[placeholder="输入查询条件..."]')
  await kw.waitFor({ timeout: 20000 })
  const dateInputs = page.locator('.wol-query .el-date-editor input')
  await dateInputs.nth(0).click()
  await dateInputs.nth(0).fill('2026-10-01')
  await dateInputs.nth(0).press('Enter')
  await page.waitForTimeout(150)
  await dateInputs.nth(1).click()
  await dateInputs.nth(1).fill('2026-10-31')
  await dateInputs.nth(1).press('Enter')
  await page.waitForTimeout(150)
  await kw.fill(KEYWORD)
  await page.locator('.wol-query').getByRole('button', { name: '查找' }).click()
  await page.waitForTimeout(1500)
  const rows = page.locator('.el-table__body-wrapper tr')
  for (const t of targets) {
    await rows.filter({ has: page.locator('td:nth-child(3)', { hasText: new RegExp('^' + t + '$') }) }).first()
      .locator('.el-checkbox').first().click()
    await page.waitForTimeout(120)
  }
  await page.locator('.wol-btns').getByRole('button', { name: '排产', exact: true }).click()
  const embed = page.locator('.el-dialog', { hasText: '批量排产（快速排产）' }).first()
  await embed.waitFor({ timeout: 20000 })
  await page.waitForTimeout(2200)
  await embed.locator('.sb-bar').getByRole('button', { name: '批量排产' }).click()
  const dlg = page.locator('.el-dialog', { hasText: '本批工单行' }).first()
  await dlg.waitFor({ timeout: 20000 })
  await page.waitForTimeout(1000)

  // ③ 逐道选线(整批共用):点开每行的下拉,选第一个候选(候选已按工序车间过滤)
  const stepRows = dlg.locator('.el-table').first().locator('.el-table__body-wrapper tr')
  for (let i = 0; i < await stepRows.count(); i++) {
    await stepRows.nth(i).locator('.el-select').first().click()
    await page.waitForTimeout(250)
    const opt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').first()
    await opt.waitFor({ timeout: 5000 })
    await opt.click()
    await page.waitForTimeout(150)
  }
  const lineOk = await dlg.locator('.el-table').first().locator('.el-select').evaluateAll((els) =>
    els.every((el) => !(el.innerText || '').includes('请选择生产线') && (el.innerText || '').trim() !== ''))
  check(lineOk, '每道工序都已选好生产线')

  // ④ 提交:等「已排产 N 行」提示
  await dlg.getByRole('button', { name: new RegExp('排产 ' + targets.length + ' 行') }).click()
  scheduled = true
  await page.waitForTimeout(2500)
  const msg = (await page.locator('.el-message').allInnerTexts().catch(() => [])).join(' | ')
  log('提交回执:', msg || '(无)')
  check(msg.includes('已排产'), '提交返回成功提示')
  check(!msg.includes('已不在待排产池'), '成功提交后不再误报「已不在待排产池」')
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_batch-sched-20261030/D1-write-result.png' })

  // ⑤ 台账断言:每行每道 计划数量 = 该行排产数量 × 该行路线该道换算率(不累乘)
  const noList = targets.map((x) => `N'${x}'`).join(',')
  const led = await q(`
    SELECT w.工单号, w.工单行id, ISNULL(w.工序,N'') AS 工序, ISNULL(w.计划数量,0) AS 计划数量,
           ISNULL(w.计划生产线,N'') AS 计划生产线, CONVERT(varchar(10), w.计划开工日期,120) AS 计划开工,
           CONVERT(varchar(10), w.计划完工日期,120) AS 计划完工, ISNULL(w.状态,N'') AS 状态,
           ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.scx,N'') AS scx, ISNULL(r.换算率,1) AS 换算率
    FROM dbo.wo_process_line w
    JOIN dbo.plang p ON p.id = w.工单行id
    LEFT JOIN dbo.bs_route r ON r.工艺路线编码 = ISNULL(p.[工艺路线],N'') AND r.工序名称 = w.工序
    WHERE ISNULL(w.asp_cancel,N'N') <> N'Y' AND w.工单号 IN (${noList})
    ORDER BY w.工单号, ISNULL(w.工序序,999)`)
  log('台账行数:', led.length)
  check(led.length === targets.length * 3, '两张工单各 3 道都落了预排台账(实际 ' + led.length + ')')
  const bad = led.filter((x) => Math.abs(Number(x.计划数量) - Number(x.排产数量) * Number(x.换算率)) > 0.001)
  check(bad.length === 0, '每道计划数量 = 本行排产数量 × 本行该道换算率(不等 ' + bad.length + ' 行)')
  check(led.every((x) => x.计划生产线), '每道都写了计划生产线')
  check(led.every((x) => x.计划开工 && x.计划完工 && x.计划开工 <= x.计划完工), '每道计划开工/完工日期已落且开工不晚于完工')
  const pl = await q(`SELECT pl_no, pl_xc, ISNULL(scx,N'') AS scx FROM dbo.plang
                      WHERE pl_no IN (${noList}) AND ISNULL(asp_cancel,N'N') <> N'Y'`)
  check(pl.every((x) => x.scx), 'plang.scx 已写排产线(' + JSON.stringify(pl.map((x) => x.scx)) + ')')
  log('台账样例:', JSON.stringify(led[0]))
} catch (e) {
  failed++
  console.error('[FAIL] 写库验证异常: ' + e.message)
} finally {
  // ⑥ 收尾:撤销排产(恢复测试账套),断言台账作废、池子行数恢复
  try {
    if (scheduled) {
      const res = await fetch(API + '/api/px/scheduleBoard/unassign', {
        method: 'POST', headers: H,
        body: JSON.stringify({ rows: targets.map((no) => ({ 加工单号: no })) }),
      }).then((r) => r.json())
      log('撤销回执:', JSON.stringify(res.data || res.message))
      await new Promise((r) => setTimeout(r, 800))
      const rest = (await pending(KEYWORD)).length
      check(rest === pendBefore, '撤销后待排产池恢复为 ' + pendBefore + ' 行(实际 ' + rest + ')')
      const noList = targets.map((x) => `N'${x}'`).join(',')
      const left = await q(`SELECT COUNT(*) AS n FROM dbo.wo_process_line w
                            WHERE w.工单号 IN (${noList}) AND ISNULL(w.asp_cancel,N'N') <> N'Y'`)
      check(Number(left[0].n) === 0, '撤销后台账无未作废行(实际 ' + left[0].n + ')')
    }
  } catch (e) {
    failed++
    console.error('[FAIL] 收尾撤销失败(测试账套可能残留排产,请手工撤销): ' + e.message)
  }
  check(errors.length === 0, '浏览器无 console.error(实际 ' + errors.length + ')' + (errors.length ? ': ' + errors[0] : ''))
  await browser.close()
  await db.close()
}

log(failed ? 'RESULT: FAIL(' + failed + ')' : 'RESULT: PASS')
process.exit(failed ? 1 : 0)
