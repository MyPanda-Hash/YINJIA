// _batch-sched-verify.mjs — 生产工单「批量排产」UI 验证(2026-10-30)
//
// 只读验证(全程不点「排产 3 行」提交,最后用 /pending 核对没写库):
//   场景 A 正式库:勾 3 张同工序待排产工单 → 内嵌快速排产页只出这 3 行且默认全选
//     → 批量排产弹窗:工序链 / 逐行数量 / 换算率 1·1·1 / 计划量 200·200·200 等 / 合计 → 取消
//   场景 B 测试库(GY-CB-STD 成型换算率=3):勾 2 张 → 计划量 600·200·200 / 1500·500·500
//     (证明「按各行自己的工艺路线换算」这条路径通)
//
// 前置:后端 8090 + 前端 5173 在线;两个账套的待排产数据见 tools/archive/_batch-sched-20261030/README.md。
// 运行(在 tests/e2e 下,复用该目录的 @playwright/test):
//   node scripts/_batch-sched-verify.mjs <截图输出目录>
import { chromium } from '@playwright/test'

const API = 'http://localhost:8090'
const WEB = 'http://localhost:5173'
const OUT = process.argv[2] || '.'
let failed = 0
const log = (...a) => console.log(...a)
function check(ok, msg) {
  if (ok) { log('  [PASS] ' + msg); return }
  failed++
  console.error('  [FAIL] ' + msg)
}

async function loginAs(factory) {
  const body = { userName: 'admin', password: '123456' }
  if (factory) body.factory = factory
  const res = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then((r) => r.json())
  if (res.code !== 200) throw new Error('登录失败(' + (factory || 'YJ') + '): ' + JSON.stringify(res))
  return res.data
}

/** 选行:按「工单号」列(td:nth-child(3))精确匹配 —— 源工单号列会出现同一单号,整行 hasText 会点错行 */
async function selectRows(page, targets) {
  const rows = page.locator('.el-table__body-wrapper tr')
  for (const t of targets) {
    const row = rows.filter({ has: page.locator('td:nth-child(3)', { hasText: new RegExp('^' + t + '$') }) }).first()
    await row.locator('.el-checkbox').first().click()
    await page.waitForTimeout(150)
  }
}

async function pendingCount(token, keyword) {
  const res = await fetch(API + '/api/px/scheduleBoard/pending', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ keyword }),
  }).then((r) => r.json())
  return (res.data || []).length
}

async function setDateRange(page, from, to) {
  const inputs = page.locator('.wol-query .el-date-editor input')
  await inputs.nth(0).click()
  await inputs.nth(0).fill(from)
  await inputs.nth(0).press('Enter')
  await page.waitForTimeout(200)
  await inputs.nth(1).click()
  await inputs.nth(1).fill(to)
  await inputs.nth(1).press('Enter')
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
}

async function scenario(sc) {
  log('\n── 场景 ' + sc.tag + '(' + (sc.factory || 'YJ') + ')──')
  const data = await loginAs(sc.factory)
  const token = data.token
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
  }, { token, factory: data.user?.factory })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto(WEB + '/#/prod/plan/workOrderList', { waitUntil: 'domcontentloaded' })
  const kw = page.locator('input[placeholder="输入查询条件..."]')
  await kw.waitFor({ timeout: 20000 })
  // 打开前的待排产池行数(同关键字;取消后必须不变 ⇒ 证明没写库)
  const pendBefore = await pendingCount(token, sc.keyword)
  if (sc.dates) await setDateRange(page, sc.dates[0], sc.dates[1])
  await kw.fill(sc.keyword)
  await page.locator('.wol-query').getByRole('button', { name: '查找' }).click()
  await page.waitForTimeout(1500)
  await selectRows(page, sc.targets)
  check(true, '已勾选 ' + sc.targets.join(' / '))

  await page.locator('.wol-btns').getByRole('button', { name: '排产', exact: true }).click()
  const embed = page.locator('.el-dialog', { hasText: '批量排产（快速排产）' }).first()
  await embed.waitFor({ timeout: 20000 })
  await page.waitForTimeout(2500)
  const poolBody = embed.locator('.el-table__body-wrapper').first()
  const poolRows = await poolBody.locator('tr').count()
  const poolChecked = await poolBody.locator('.el-checkbox.is-checked').count()
  check(poolRows === sc.targets.length, '内嵌①池收敛为 ' + sc.targets.length + ' 行(实际 ' + poolRows + ')')
  check(poolChecked === sc.targets.length, '内嵌①池默认全选(实际 ' + poolChecked + ')')
  await page.screenshot({ path: OUT + '/' + sc.shot1 })

  await embed.locator('.sb-bar').getByRole('button', { name: '批量排产' }).click()
  const dlg = page.locator('.el-dialog', { hasText: '本批工单行' }).first()
  await dlg.waitFor({ timeout: 20000 })
  await page.waitForTimeout(1200)
  const text = await dlg.innerText()
  check(text.includes(sc.chain), '本批工序链 ' + sc.chain)
  for (const t of sc.targets) check(text.includes(t + '#1'), '行表含 ' + t + '#1')
  for (const c of sc.planChains) check(text.includes(c), '计划量链 ' + c)
  check(text.includes('合计'), '底部合计')
  await page.screenshot({ path: OUT + '/' + sc.shot2 })

  // 取消(不写库)后核对池子行数不变
  await dlg.getByRole('button', { name: '取消' }).click()
  await page.waitForTimeout(500)
  await embed.locator('.el-dialog__headerbtn').first().click().catch(() => {})
  await page.waitForTimeout(800)
  const still = await pendingCount(token, sc.keyword)
  check(still === pendBefore, '取消后待排产池仍为 ' + pendBefore + ' 行(实际 ' + still + ',未写库)')
  check(errors.length === 0, '浏览器无 console.error(实际 ' + errors.length + ')' + (errors.length ? ': ' + errors[0] : ''))
  await browser.close()
}

const scenarios = [
  {
    tag: 'A 正式库(换算率 1/1/1)', factory: null, keyword: 'GD-2026-10-022',
    targets: ['GD-2026-10-0225', 'GD-2026-10-0226', 'GD-2026-10-0226-1'],
    chain: '成型>切炭>组装',
    planChains: ['200·200·200', '90·90·90', '10·10·10'],
    shot1: 'A1-embedded-quick-schedule.png', shot2: 'A2-batch-dialog.png',
  },
  {
    tag: 'B 测试库(成型换算率=3)', factory: 'YJ_TEST', keyword: 'GD2608',
    dates: ['2026-08-01', '2026-08-31'],
    targets: ['GD2608100001', 'GD2608100002'],
    chain: '成型>切炭>组装',
    planChains: ['600·200·200', '1500·500·500'],
    shot1: 'B1-embedded-quick-schedule.png', shot2: 'B2-batch-dialog-rate3.png',
  },
]

for (const sc of scenarios) {
  try { await scenario(sc) } catch (e) { failed++; console.error('[FAIL] 场景 ' + sc.tag + ' 异常: ' + e.message) }
}
log(failed ? '\nRESULT: FAIL(' + failed + ')' : '\nRESULT: PASS')
process.exit(failed ? 1 : 0)
