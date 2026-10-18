/**
 * 验证:角色面板权限矩阵的分组是否已归并到「导航一级模块」。
 * 断言:
 *   1. 分组顺序 = 导航模块顺序(我的桌面/研发管理/智能供应链/生产制造/品质管理/财务管理/设备管理/基础档案)
 *   2. **分组名必须全是导航一级模块** —— 矩阵里冒出导航没有的分组(历史碎组/写错的值)即 FAIL
 *   3. 全部面板数 == 135(130 张 yj_panel + DASHBOARD + 4 张页面级面板)且不重不漏、无空组
 *   4. 4 张库存报表 + 库存明细 落在「智能供应链」
 *   5. 「研发管理」含 25 张
 *
 * ⚠ 本脚本 2026-10-16 修活(此前是**死闸门**,所以「基础设置/系统管理」两个野分组一直没被拦住):
 *   - 原写死 `role/3/panels`,而角色 3 早已删除(现役 1 admin / 2 user / 4 rd_review / 5 rd_file_owner,
 *     见 tools/cleanup-user-accounts-sync-20261016.sql)⇒ 改为按 roleCode 现取;
 *   - 原 LEGACY 名单缺 `基础设置`(25 张基础资料的面板 module_group 就是它)⇒ 补上;
 *   - 原面板总数写死 125(当年数)⇒ 改为 135 并保留"不重不漏"断言;
 *   - 新增断言 2:任何不在 NAV_GROUP_ORDER 里的分组名一律 FAIL(这条才是根治"多出分组"的闸门)。
 * 用法: node tools/verify/perm-groups.cjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')

const NAV_ORDER = ['我的桌面', '研发管理', '智能供应链', '生产制造', '品质管理', '财务管理', '设备管理', '基础档案', '其他']
/** 历史碎值:出现过但**不得**再作为独立分组出现(yj_panel.module_group 的原值,由 ReportService.NAV_GROUP 归并) */
const LEGACY = ['基础资料', '基础数据', '基础设置', '采购管理', '订单管理', '生产管理', '委外加工', '库存核算', '库存报表', '销售管理', '物料及价格', '通用', '系统管理']
const STOCK_REPORTS = ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_STATUS', 'STOCK_SUMMARY', 'STOCK_DETAIL']
const TOTAL_PANELS = 135

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
  const H = { Authorization: 'Bearer ' + lj.data.token }

  const roles = (await (await fetch(`${BASE}/api/sys/role/list`, { headers: H })).json()).data || []
  const role = roles.find((r) => r.roleCode === 'user') || roles.find((r) => !r.isAdmin) || roles[0]
  if (!role) throw new Error('取角色失败: ' + JSON.stringify(roles))
  console.log(`\n用角色 ${role.roleCode}(id=${role.id})读矩阵\n`)

  const rj = await (await fetch(`${BASE}/api/sys/role/${role.id}/panels`, { headers: H })).json()
  if (!rj.data) throw new Error('取角色面板失败: ' + JSON.stringify(rj))
  const modules = rj.data.modules || []

  const names = modules.map((m) => m.name)
  console.log('实际分组顺序: ' + names.join(' | '))
  modules.forEach((m) => console.log(`  ${m.name}: ${(m.panels || []).length} 个面板`))
  console.log('')

  // 1. 顺序与导航一致(允许后续未知组追加在末尾)
  const head = names.filter((n) => NAV_ORDER.includes(n))
  const expectedHead = NAV_ORDER.filter((n) => names.includes(n) && n !== '其他')
  check('分组顺序符合导航模块顺序', JSON.stringify(head) === JSON.stringify(expectedHead),
    `实际 ${head.join(',')} / 期望 ${expectedHead.join(',')}`)

  // 2. 分组名必须全是导航一级模块(核心:拦住"矩阵里多出导航没有的分组")
  const outside = names.filter((n) => !NAV_ORDER.includes(n))
  check('分组名全部是导航一级模块(无野分组)', outside.length === 0, outside.join(',') || '无')

  // 2b. 历史碎组已归并
  const leftovers = names.filter((n) => LEGACY.includes(n))
  check('历史碎组已归并(无残留)', leftovers.length === 0, leftovers.join(',') || '无')

  // 3. 不重不漏
  const all = modules.flatMap((m) => (m.panels || []).map((p) => p.panelCode))
  const uniq = new Set(all)
  check('面板无重复', uniq.size === all.length, `${all.length} 行 / ${uniq.size} 唯一`)
  check(`面板总数 == ${TOTAL_PANELS}(130 yj_panel + DASHBOARD + 4 页面级)`, uniq.size === TOTAL_PANELS, `实际 ${uniq.size}`)
  check('每个分组都有面板(无空组)', modules.every((m) => (m.panels || []).length > 0))

  // 4. 库存报表族落位(含库存明细)
  const scm = modules.find((m) => m.name === '智能供应链')
  const scmCodes = new Set((scm?.panels || []).map((p) => p.panelCode))
  const missing = STOCK_REPORTS.filter((c) => !scmCodes.has(c))
  check('库存报表族 5 张(含库存明细)归入「智能供应链」', missing.length === 0, missing.join(',') || '全部命中')

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
