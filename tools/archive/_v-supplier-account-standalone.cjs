/**
 * _v-supplier-account-standalone.cjs —— 供应商账号独立成表验证(2026-10-25)
 *
 * 用户口径:「供应商配置的账号不属于用户账号,单独一个表吧」
 *
 * 断言:
 *   ① 新建供应商账号后,**yj_user 里没有这个账号**(不再算用户账号);
 *   ② 口令落在 yj_supplier_account.password_hash,能用它登录成功;
 *   ③ 登录后会话是供应商会话(visiblePanels 只有 SUPPLIER_PU_ORDER、isAdmin=false、
 *      supplierCode 正确、canConfigSupplierAccount=false);
 *   ④ 供应商会话越权调内部接口一律 403(降权仍生效);
 *   ⑤ 改密只改本表;停用后登不进;启用(带新密码)后可再登;
 *   ⑥ 删除账号只删本表;
 *   ⑦ 与内部账号重名会被拒绝(登录入口只有一个,不制造歧义);
 *   ⑧ 账号仍然进不了「供应商权限配置」接口(不能自己开账号)。
 *
 * 用法:node tools/archive/_v-supplier-account-standalone.cjs [baseUrl]
 */
const path = require('path')
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const results = []
let skips = 0
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
const U = 'sa_standalone'
const P = 'sa@2026x'

async function api(path, { method = 'GET', token, body } = {}) {
  const r = await fetch(BASE + path.replace(/^\//, ''), {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch (e) { /* 非 JSON(如 403 空体) */ }
  return { status: r.status, body: json, raw: text }
}

async function main() {
  const adminLogin = await api('api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'YJ' } })
  const at = adminLogin.body?.data?.token
  if (!at) { console.error('[FATAL] 管理员登录失败:', adminLogin.raw.slice(0, 200)); process.exit(2) }

  // 预清理
  for (const a of ((await api('api/supplier/portal/accounts', { token: at })).body?.data || [])) {
    if (a.userName === U) await api('api/supplier/portal/accounts/' + a.id, { method: 'DELETE', token: at })
  }

  console.log('\n== ① 新建账号:只落一张表 ==')
  const created = await api('api/supplier/portal/accounts/save', {
    method: 'POST', token: at,
    body: { userName: U, supplierCode: 'YJ-SX', realName: '独立表测试', phone: '0752-0001111', password: P, enabled: '1' },
  })
  check('新建成功', created.body?.code === 200, `code=${created.body?.code} ${created.body?.message || ''}`)
  const list = (await api('api/supplier/portal/accounts', { token: at })).body?.data || []
  const row = list.find((x) => x.userName === U)
  check('账号出现在供应商账号列表', !!row, row ? `id=${row.id}` : '')
  check('列表带联系电话', !!row && row.phone === '0752-0001111', row ? String(row.phone) : '')
  check('列表带姓名(本表存)', !!row && row.realName === '独立表测试', row ? String(row.realName) : '')

  console.log('\n== ② 不再是「用户账号」:直接查库(yj_user 里必须没有它)==')
  // 用专用核查工具直连数据库核对 —— 比走某个业务接口可靠(后者可能不存在或需要别的权限)。
  // ⚠ 库口令不写进仓库:从环境变量取;没设就明确 SKIP(不算失败),并在输出里点名。
  let verifyOut = ''
  if (!process.env.YINJIA_SQL_PASS) {
    console.log('  [SKIP] 未设 YINJIA_SQL_PASS,跳过直连核查(可单独跑 archive\\_VerifySupplierStandalone.java)')
    skips += 3
  } else {
    try {
      verifyOut = require('child_process').execSync(
        'java "-Dstdout.encoding=UTF-8" -cp lib\\mssql-jdbc.jar archive\\_VerifySupplierStandalone.java HSDZ_MES',
        { cwd: path.join(__dirname, '..'), encoding: 'utf8', env: process.env },
      )
    } catch (e) {
      verifyOut = String(e.stdout || e.message)
    }
    console.log(verifyOut.split('\n').map((l) => '  ' + l).join('\n'))
    check('yj_user 里没有供应商账号镜像行', /\[PASS\] 02 /.test(verifyOut))
    check('启用中的账号都有口令', /\[PASS\] 03 /.test(verifyOut))
    check('与内部账号不重名', /\[PASS\] 04 /.test(verifyOut))
  }

  console.log('\n== ③ 用供应商表里的口令登录 ==')
  const supLogin = await api('api/auth/login', { method: 'POST', body: { userName: U, password: P, factory: 'YJ' } })
  check('供应商账号能登录', supLogin.body?.code === 200, `code=${supLogin.body?.code} ${supLogin.body?.message || ''}`)
  const st = supLogin.body?.data?.token
  const su = supLogin.body?.data?.user || {}
  check('会话是供应商身份(非管理员)', su.isAdmin === false)
  check('supplierCode = YJ-SX', su.supplierCode === 'YJ-SX', String(su.supplierCode))
  check('visiblePanels 只有供应商采购打印', JSON.stringify(su.visiblePanels) === JSON.stringify(['SUPPLIER_PU_ORDER']),
    JSON.stringify(su.visiblePanels))
  check('不能配置供应商账号', su.canConfigSupplierAccount === false)

  console.log('\n== ④ 降权仍生效(越权 403)==')
  for (const [name, path, body] of [
    ['采购订单列表', 'api/px/queryFormDataList', { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 5 }],
    ['供应商账号列表', 'api/supplier/portal/accounts', undefined],
    ['内部用户信息接口', 'api/sys/users', undefined],
  ]) {
    const r = await api(path, { method: body ? 'POST' : 'GET', token: st, body })
    const code = r.body?.code ?? r.status
    check(`越权「${name}」被拒`, code === 403, `code=${code}`)
  }

  console.log('\n== ⑤ 改密 / 停用 / 启用 ==')
  const chg = await api('api/auth/changePassword', { method: 'POST', token: st, body: { old: P, next: 'sa@2026y' } })
  check('供应商能自助改密', chg.body?.code === 200, `code=${chg.body?.code} ${chg.body?.message || ''}`)
  const relogin = await api('api/auth/login', { method: 'POST', body: { userName: U, password: 'sa@2026y', factory: 'YJ' } })
  check('新口令可登录', relogin.body?.code === 200, `code=${relogin.body?.code}`)

  // 停用(带原值,避免清掉电话/姓名)
  const cur = (await api('api/supplier/portal/accounts', { token: at })).body?.data?.find((x) => x.userName === U)
  await api('api/supplier/portal/accounts/save', {
    method: 'POST', token: at,
    body: { id: cur.id, userName: U, supplierCode: 'YJ-SX', realName: cur.realName, phone: cur.phone, password: '', enabled: '0' },
  })
  const blocked = await api('api/auth/login', { method: 'POST', body: { userName: U, password: 'sa@2026y', factory: 'YJ' } })
  check('停用后登不进', blocked.body?.code !== 200, `${blocked.body?.message || ''}`)
  const afterDisable = (await api('api/supplier/portal/accounts', { token: at })).body?.data?.find((x) => x.userName === U)
  check('停用不会清掉电话', !!afterDisable && afterDisable.phone === '0752-0001111', afterDisable ? String(afterDisable.phone) : '')

  // 停用(口令被清空)后直接启用:应拒绝并说清要重设密码
  const badEnable = await api('api/supplier/portal/accounts/save', {
    method: 'POST', token: at,
    body: { id: cur.id, userName: U, supplierCode: 'YJ-SX', realName: cur.realName, phone: cur.phone, password: '', enabled: '1' },
  })
  check('无口令时不许直接启用(提示重设密码)', badEnable.body?.code !== 200,
    `${badEnable.body?.message || ''}`)

  const reEnable = await api('api/supplier/portal/accounts/save', {
    method: 'POST', token: at,
    body: { id: cur.id, userName: U, supplierCode: 'YJ-SX', realName: cur.realName, phone: cur.phone, password: 'sa@2026z', enabled: '1' },
  })
  check('设了新密码后可启用', reEnable.body?.code === 200, `${reEnable.body?.message || ''}`)
  const relogin2 = await api('api/auth/login', { method: 'POST', body: { userName: U, password: 'sa@2026z', factory: 'YJ' } })
  check('启用后新口令可登录', relogin2.body?.code === 200, `code=${relogin2.body?.code}`)

  console.log('\n== ⑥ 与内部账号重名被拒 ==')
  const dup = await api('api/supplier/portal/accounts/save', {
    method: 'POST', token: at,
    body: { userName: 'admin', supplierCode: 'YJ-SX', realName: '', phone: '', password: 'dup@2026', enabled: '1' },
  })
  check('不能用内部账号名建供应商账号', dup.body?.code !== 200, `${dup.body?.message || ''}`)

  console.log('\n== ⑦ 删除:只删本表 ==')
  const del = await api('api/supplier/portal/accounts/' + cur.id, { method: 'DELETE', token: at })
  check('删除成功', del.body?.code === 200, `code=${del.body?.code}`)
  const gone = (await api('api/supplier/portal/accounts', { token: at })).body?.data || []
  check('列表里已消失', !gone.some((x) => x.userName === U))
  const loginAfterDel = await api('api/auth/login', { method: 'POST', body: { userName: U, password: 'sa@2026z', factory: 'YJ' } })
  check('删除后登不进', loginAfterDel.body?.code !== 200, `${loginAfterDel.body?.message || ''}`)

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过` + (skips ? `(跳过 ${skips} 项:未设 YINJIA_SQL_PASS)` : '') + ' ===')
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
