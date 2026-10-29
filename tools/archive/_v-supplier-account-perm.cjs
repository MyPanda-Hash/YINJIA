/**
 * _v-supplier-account-perm.cjs — 「供应商权限配置」按组织架构授权的端到端验证(2026-10-25)
 *
 * 用户口径:「供应商权限配置面版不只是管理员可以来配置,需要能够通过组织架构添加可以配置的账号」。
 * 本脚本按用户真实的操作路径验证:
 *   ① 建一个普通账号(角色=测试角色)→ 未授权时:菜单无入口、接口 403、直连路由被送回;
 *   ② 在「组织架构 → 角色与面板权限」里给该角色勾上 SUPPLIER_ACCOUNT 的「配置供应商账号」(= supplier 词);
 *   ③ 该账号重新登录 → canConfigSupplierAccount=true、菜单出现入口、接口 200、能建供应商账号;
 *   ④ 收回权限 → 该账号(同一个旧令牌)下一次请求 403 —— 无权即失效,不必等重登;
 *   ⑤ 供应商账号自身永远进不来(即使有人误给它配了角色)。
 * 结束时清理:删测试供应商账号、测试角色、测试用户。
 *
 * 用法:node tools/archive/_v-supplier-account-perm.cjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const ROLE_CODE = 'supplier_cfg_test'
const ROLE_NAME = '供应商配置测试'
const TEST_USER = 'supcfgtest'
const TEST_PASS = 'Test@20261025'

const results = []
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch (e) { return { raw: text, http: res.status } }
}

const login = async (userName, password) => call('/api/auth/login', {
  method: 'POST', body: { userName, password, factory: 'YJ' },
})

async function main() {
  const admin = await login('admin', '123456')
  if (admin.code !== 200) throw new Error('管理员登录失败: ' + JSON.stringify(admin).slice(0, 200))
  const at = admin.data.token

  // ---------- 清理上次残留 ----------
  const roleList0 = (await call('/api/sys/role/list', { token: at })).data || []
  for (const r of roleList0.filter((x) => x.roleCode === ROLE_CODE)) {
    await call('/api/sys/role/' + r.id, { method: 'DELETE', token: at })
  }
  const users0 = (await call('/api/sys/user/list', { token: at })).data || []
  for (const u of users0.filter((x) => x.userName === TEST_USER)) {
    await call('/api/sys/user/' + u.id, { method: 'DELETE', token: at })
  }

  // ---------- ① 测试角色 + 测试账号(未授权) ----------
  console.log('\n== ① 建测试角色/账号(尚未授权) ==')
  const rs = await call('/api/sys/role/save', {
    method: 'POST', token: at, body: { roleCode: ROLE_CODE, roleName: ROLE_NAME, remark: '供应商权限配置授权 e2e' },
  })
  check('创建测试角色', rs.code === 200, JSON.stringify(rs).slice(0, 120))
  const roleList = (await call('/api/sys/role/list', { token: at })).data || []
  const role = roleList.find((x) => x.roleCode === ROLE_CODE)
  check('角色已存在', !!role, role ? `id=${role.id}` : '')

  const us = await call('/api/sys/user/save', {
    method: 'POST', token: at,
    body: { userName: TEST_USER, realName: '供应商配置测试', password: TEST_PASS, roleId: role.id, enabled: '1' },
  })
  check('创建测试账号', us.code === 200, JSON.stringify(us).slice(0, 120))

  const u0 = await login(TEST_USER, TEST_PASS)
  check('未授权账号可正常登录', u0.code === 200)
  check('未授权时 canConfigSupplierAccount=false', u0.data?.user?.canConfigSupplierAccount === false,
    String(u0.data?.user?.canConfigSupplierAccount))
  check('未授权时 visiblePanels 不含 SUPPLIER_ACCOUNT',
    !(u0.data?.user?.visiblePanels || []).includes('SUPPLIER_ACCOUNT'))
  const t0 = u0.data.token
  const denied0 = await call('/api/supplier/portal/accounts', { token: t0 })
  check('未授权时接口 403', denied0.code === 403, String(denied0.code))
  const denied0b = await call('/api/supplier/portal/accounts/save', {
    method: 'POST', token: t0,
    body: { userName: 'e2eshouldfail', supplierCode: 'YJ-KBL', password: 'x123456' },
  })
  check('未授权时不能新建供应商账号', denied0b.code === 403, String(denied0b.code))

  // ---------- ② 组织架构里给该角色勾「配置供应商账号」 ----------
  console.log('\n== ② 组织架构授权(supplier 词) ==')
  const pv = (await call('/api/sys/role/' + role.id + '/panels', { token: at })).data
  const granted = (pv.granted || []).map((g) => ({ panelCode: g.panelCode, perms: g.perms }))
  // 保留原有授权,追加 SUPPLIER_ACCOUNT(view,supplier)
  const merged = granted.filter((g) => g.panelCode !== 'SUPPLIER_ACCOUNT')
  merged.push({ panelCode: 'SUPPLIER_ACCOUNT', perms: 'view,supplier' })
  const sv = await call('/api/sys/role/' + role.id + '/panels', { method: 'POST', token: at, body: { panels: merged } })
  check('保存角色面板权限', sv.code === 200, JSON.stringify(sv).slice(0, 120))
  const pv2 = (await call('/api/sys/role/' + role.id + '/panels', { token: at })).data
  const row = (pv2.granted || []).find((g) => g.panelCode === 'SUPPLIER_ACCOUNT')
  check('权限落库(perms 含 supplier)', row && String(row.perms).includes('supplier'), row ? String(row.perms) : '(无)')

  // ---------- ③ 重新登录 → 可配置 ----------
  console.log('\n== ③ 授权后重新登录 ==')
  const u1 = await login(TEST_USER, TEST_PASS)
  check('canConfigSupplierAccount=true', u1.data?.user?.canConfigSupplierAccount === true,
    String(u1.data?.user?.canConfigSupplierAccount))
  check('visiblePanels 含 SUPPLIER_ACCOUNT', (u1.data?.user?.visiblePanels || []).includes('SUPPLIER_ACCOUNT'))
  check('pagePerms 为该面板下发 supplier 词',
    String(u1.data?.user?.pagePerms?.SUPPLIER_ACCOUNT || '').includes('supplier'),
    String(u1.data?.user?.pagePerms?.SUPPLIER_ACCOUNT))
  const t1 = u1.data.token
  check('非管理员 isAdmin=false(不是靠超管身份)', u1.data?.user?.isAdmin === false)

  const list1 = await call('/api/supplier/portal/accounts', { token: t1 })
  check('授权后可读取供应商账号列表', list1.code === 200, String(list1.code))
  const createRes = await call('/api/supplier/portal/accounts/save', {
    method: 'POST', token: t1,
    body: { userName: 'e2e_supplier', supplierCode: 'YJ-KBL', realName: '', password: 'e2e@2026', enabled: '1', remark: 'e2e' },
  })
  check('授权后非管理员可新建供应商账号', createRes.code === 200, JSON.stringify(createRes).slice(0, 140))
  const list2 = (await call('/api/supplier/portal/accounts', { token: t1 })).data || []
  const made = list2.find((x) => x.userName === 'e2e_supplier')
  check('新账号出现在列表里', !!made, made ? `id=${made.id}` : '')

  // 供应商账号登录后仍只有一页,且进不了配置页
  const supLogin = await login('e2e_supplier', 'e2e@2026')
  check('新建的供应商账号能登录', supLogin.code === 200)
  check('供应商账号 canConfigSupplierAccount=false', supLogin.data?.user?.canConfigSupplierAccount === false,
    String(supLogin.data?.user?.canConfigSupplierAccount))
  const supDenied = await call('/api/supplier/portal/accounts', { token: supLogin.data.token })
  check('供应商账号调配置接口 403', supDenied.code === 403, String(supDenied.code))

  // ---------- ④ 收回权限 → 立即失效 ----------
  console.log('\n== ④ 收回授权(同一个旧令牌) ==')
  const back = merged.filter((g) => g.panelCode !== 'SUPPLIER_ACCOUNT')
  await call('/api/sys/role/' + role.id + '/panels', { method: 'POST', token: at, body: { panels: back } })
  const afterRevoke = await call('/api/supplier/portal/accounts', { token: t1 })
  check('收回后旧令牌立即 403(无需重登)', afterRevoke.code === 403, String(afterRevoke.code))
  const u2 = await login(TEST_USER, TEST_PASS)
  check('重登后 canConfigSupplierAccount=false', u2.data?.user?.canConfigSupplierAccount === false,
    String(u2.data?.user?.canConfigSupplierAccount))
  check('重登后 visiblePanels 不再含 SUPPLIER_ACCOUNT',
    !(u2.data?.user?.visiblePanels || []).includes('SUPPLIER_ACCOUNT'))

  // ---------- ⑤ 管理员恒可 ----------
  console.log('\n== ⑤ 管理员恒可 ==')
  const adminList = await call('/api/supplier/portal/accounts', { token: at })
  check('管理员照常可读(不受角色授权影响)', adminList.code === 200, String(adminList.code))

  // ---------- 清理 ----------
  console.log('\n== 清理测试数据 ==')
  const all = (await call('/api/supplier/portal/accounts', { token: at })).data || []
  for (const a of all.filter((x) => x.userName === 'e2e_supplier')) {
    await call('/api/supplier/portal/accounts/' + a.id, { method: 'DELETE', token: at })
  }
  const users1 = (await call('/api/sys/user/list', { token: at })).data || []
  for (const u of users1.filter((x) => x.userName === TEST_USER)) {
    await call('/api/sys/user/' + u.id, { method: 'DELETE', token: at })
  }
  const r1 = (await call('/api/sys/role/list', { token: at })).data || []
  for (const r of r1.filter((x) => x.roleCode === ROLE_CODE)) {
    await call('/api/sys/role/' + r.id, { method: 'DELETE', token: at })
  }
  const left = (await call('/api/supplier/portal/accounts', { token: at })).data || []
  check('测试供应商账号已清理', !left.some((x) => x.userName === 'e2e_supplier'), `剩余 ${left.length} 个`)

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  const failed = results.filter((r) => !r.ok)
  if (failed.length) console.log('失败项:\n' + failed.map((f) => ' - ' + f.name + ' ' + f.detail).join('\n'))
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
