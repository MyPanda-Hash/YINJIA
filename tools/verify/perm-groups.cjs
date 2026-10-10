/**
 * 验证:角色面板权限矩阵的分组是否已归并到「导航一级模块」。
 * 断言:
 *   1. 分组列表 = 导航模块顺序(我的桌面/研发管理/智能供应链/生产制造/品质管理/财务管理/设备管理/基础档案)
 *   2. 历史碎组(基础资料/采购管理/订单管理/生产管理/委外加工/库存核算)不再作为独立分组出现
 *   3. 全部面板数 == 124 + DASHBOARD(虚拟) 且每张面板恰好属于一个分组(不重不漏)
 *   4. 4 张库存报表面板(STOCK_BALANCE/STOCK_LEDGER/STOCK_STATUS/STOCK_SUMMARY)落在「智能供应链」
 * 用法: node tools/verify/perm-groups.cjs
 */
const BASE = 'http://127.0.0.1:8090'

const NAV_ORDER = ['我的桌面', '研发管理', '智能供应链', '生产制造', '品质管理', '财务管理', '设备管理', '基础档案', '其他']
const LEGACY = ['基础资料', '采购管理', '订单管理', '生产管理', '委外加工', '库存核算', '通用', '系统管理']
const STOCK_REPORTS = ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_STATUS', 'STOCK_SUMMARY']

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const lj = await lr.json()
  if (!lj.data || !lj.data.token) throw new Error('登录失败: ' + JSON.stringify(lj))
  const token = lj.data.token
  const H = { Authorization: 'Bearer ' + token }

  const rr = await fetch(`${BASE}/api/sys/role/3/panels`, { headers: H })
  const rj = await rr.json()
  if (!rj.data) throw new Error('取角色面板失败: ' + JSON.stringify(rj))
  const modules = rj.data.modules || []

  const names = modules.map((m) => m.name)
  console.log('\n实际分组顺序: ' + names.join(' | '))
  modules.forEach((m) => console.log(`  ${m.name}: ${(m.panels || []).length} 个面板`))
  console.log('')

  // 1. 顺序与导航一致(允许后续未知组追加在末尾)
  const head = names.filter((n) => NAV_ORDER.includes(n))
  const expectedHead = NAV_ORDER.filter((n) => names.includes(n) && n !== '其他')
  check('分组顺序符合导航模块顺序', JSON.stringify(head) === JSON.stringify(expectedHead),
    `实际 ${head.join(',')} / 期望 ${expectedHead.join(',')}`)

  // 2. 历史碎组已消失
  const leftovers = names.filter((n) => LEGACY.includes(n))
  check('历史碎组已归并(无残留)', leftovers.length === 0, leftovers.join(',') || '无')

  // 3. 不重不漏
  const all = modules.flatMap((m) => (m.panels || []).map((p) => p.panelCode))
  const uniq = new Set(all)
  check('面板无重复', uniq.size === all.length, `${all.length} 行 / ${uniq.size} 唯一`)
  check('面板总数 == 125(124 面板 + DASHBOARD)', uniq.size === 125, `实际 ${uniq.size}`)
  check('每个分组都有面板(无空组)', modules.every((m) => (m.panels || []).length > 0))

  // 4. 库存报表落位
  const scm = modules.find((m) => m.name === '智能供应链')
  const scmCodes = new Set((scm?.panels || []).map((p) => p.panelCode))
  const missing = STOCK_REPORTS.filter((c) => !scmCodes.has(c))
  check('4 张库存报表面板归入「智能供应链」', missing.length === 0, missing.join(',') || '全部命中')

  // 5. DASHBOARD 落位
  const dash = modules.find((m) => m.name === '我的桌面')
  check('DASHBOARD 归入「我的桌面」', (dash?.panels || []).some((p) => p.panelCode === 'DASHBOARD'))

  // 6. 研发管理 25 张
  const rd = modules.find((m) => m.name === '研发管理')
  check('「研发管理」含 25 张面板', (rd?.panels || []).length === 25, `实际 ${(rd?.panels || []).length}`)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n== ${results.length - failed.length}/${results.length} 通过 ==`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error('ERROR: ' + e.message); process.exit(2) })
