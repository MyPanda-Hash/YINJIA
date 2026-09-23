/**
 * _probe-org-user-del.cjs — 组织架构「删除账号 + 服务端管理员校验」验收探针
 *
 * 覆盖:
 *   A) 写接口的服务端管理员校验(普通账号一律 403;读接口必须放行 —— PanelxList 的
 *      「规格书分发责任人」选人依赖 GET /sys/user/list,不能一刀切)
 *   B) 删除账号:禁删自己 / 禁删管理员账号 / 正常删除 / 重复删报不存在 / 删后无法登录
 *   C) 建号不选角色不再是管理员(is_admin 默认值修复)
 *
 * ⚠ 会创建并删除两个临时账号(zz_probe_delme 普通、zz_probe_admin 管理员)。
 *   当前后端未接工厂路由(DataSourceRouter.use 无调用者),所有请求落正式库 HSDZ_MES,
 *   故它们会短暂出现在正式库,结束时删除;若中途被打断,手删:
 *     DELETE FROM yj_user WHERE username LIKE N'zz_probe%'
 *   (tools/SqlRunner.java <url> yinjia env <SQL>)
 *
 * 用法:node tools/archive/_probe-org-user-del.cjs
 */
const API = 'http://127.0.0.1:8090/api'
const PROBE_USER = 'zz_probe_delme'
const PROBE_ADMIN = 'zz_probe_admin'
const PROBE_PWD = 'Probe@12345'
const ADMIN_ROLE_ID = 1     // yj_role.is_admin='Y' 的角色
const NORMAL_ROLE_ID = 2

let pass = 0, fail = 0
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')) }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let json = null
  try { json = await res.json() } catch { /* 非 JSON */ }
  return { http: res.status, code: json?.code, message: json?.message, data: json?.data }
}

async function login(userName, password) {
  const r = await call('POST', '/auth/login', { body: { userName, password } })
  return { token: r.data?.token, isAdmin: r.data?.user?.isAdmin, r }
}

async function findUser(token, userName) {
  const r = await call('GET', '/sys/user/list', { token })
  return (r.data || []).find((u) => u.userName === userName) || null
}

async function main() {
  console.log('== 组织架构:删除账号 + 服务端管理员校验 ==\n')

  const admin = await login('admin', '123456')
  if (!admin.token) throw new Error('admin 登录失败: ' + JSON.stringify(admin.r).slice(0, 200))
  console.log('[login] admin ok (isAdmin=' + admin.isAdmin + ')\n')

  for (const u of [PROBE_USER, PROBE_ADMIN]) {
    const stale = await findUser(admin.token, u)
    if (stale) {
      console.log('[cleanup] 清理上次残留 ' + u + '(id=' + stale.id + ')')
      await call('DELETE', '/sys/user/' + stale.id, { token: admin.token })
      if (await findUser(admin.token, u)) {
        // 若是管理员残留(受保护删不掉),先降级为普通角色再删
        await call('POST', '/sys/user/save', { token: admin.token, body: { id: stale.id, userName: u, roleId: NORMAL_ROLE_ID } })
        await call('DELETE', '/sys/user/' + stale.id, { token: admin.token })
      }
    }
  }

  let probeId = null
  let adminProbeId = null
  try {
    // ── 准备 ───────────────────────────────────────────────────
    const created = await call('POST', '/sys/user/save', {
      token: admin.token,
      body: { userName: PROBE_USER, password: PROBE_PWD, realName: '探针-待删账号', enabled: 1 },
    })
    ok('准备:管理员可建账号', created.code === 200, JSON.stringify(created).slice(0, 160))
    const probe = await findUser(admin.token, PROBE_USER)
    probeId = probe?.id
    if (!probeId) throw new Error('建号后查不到 ' + PROBE_USER + ',后续断言无法进行')

    const asProbe = await login(PROBE_USER, PROBE_PWD)
    ok('C1 不选角色新建的账号不是管理员(is_admin 默认值)', !!asProbe.token && asProbe.isAdmin === false,
      'isAdmin=' + asProbe.isAdmin)

    // ── A) 写接口管理员校验 ────────────────────────────────────
    console.log('\nA) 写接口服务端管理员校验(普通账号)')
    const a1 = await call('POST', '/sys/user/save', {
      token: asProbe.token, body: { userName: 'zz_probe_should_not_exist', password: 'Xx@12345' },
    })
    ok('A1 建账号被拒(code 403)', a1.code === 403, 'code=' + a1.code + ' msg=' + a1.message)
    ok('A1b 被拒后确实没建出账号', !(await findUser(admin.token, 'zz_probe_should_not_exist')))

    const a2 = await call('DELETE', '/sys/user/' + probeId, { token: asProbe.token })
    ok('A2 删账号被拒(code 403)', a2.code === 403, 'code=' + a2.code + ' msg=' + a2.message)

    const a3 = await call('POST', '/sys/role/save', { token: asProbe.token, body: { roleCode: 'zz_probe', roleName: '探针角色' } })
    ok('A3 建角色被拒(code 403)', a3.code === 403, 'code=' + a3.code + ' msg=' + a3.message)

    const a4 = await call('DELETE', '/sys/dept/999999', { token: asProbe.token })
    ok('A4 删部门被拒(code 403)', a4.code === 403, 'code=' + a4.code + ' msg=' + a4.message)

    const a5 = await call('GET', '/sys/user/list', { token: asProbe.token })
    ok('A5 仍可读用户清单(非管理员要用)', a5.code === 200 && Array.isArray(a5.data), 'code=' + a5.code)

    // ── B) 删除守卫与正路 ─────────────────────────────────────
    console.log('\nB) 删除账号:守卫与正路(管理员)')
    const self = await findUser(admin.token, 'admin')
    const b1 = await call('DELETE', '/sys/user/' + self.id, { token: admin.token })
    ok('B1 不能删自己', b1.code !== 200 && /自己|当前登录/.test(String(b1.message)), 'code=' + b1.code + ' msg=' + b1.message)
    ok('B1b 自己仍在', !!(await findUser(admin.token, 'admin')))

    const mkAdmin = await call('POST', '/sys/user/save', {
      token: admin.token,
      body: { userName: PROBE_ADMIN, password: PROBE_PWD, realName: '探针-管理员账号', roleId: ADMIN_ROLE_ID },
    })
    const adminProbe = await findUser(admin.token, PROBE_ADMIN)
    adminProbeId = adminProbe?.id
    ok('B2 准备:造出第二个管理员账号', mkAdmin.code === 200 && adminProbe?.isAdmin === 1,
      'code=' + mkAdmin.code + ' isAdmin=' + adminProbe?.isAdmin)

    const b2 = await call('DELETE', '/sys/user/' + adminProbeId, { token: admin.token })
    ok('B2b 管理员账号受保护,删不掉', b2.code !== 200 && /管理员/.test(String(b2.message)), 'code=' + b2.code + ' msg=' + b2.message)
    ok('B2c 仍在', !!(await findUser(admin.token, PROBE_ADMIN)))

    await call('POST', '/sys/user/save', {
      token: admin.token, body: { id: adminProbeId, userName: PROBE_ADMIN, roleId: NORMAL_ROLE_ID },
    })
    const b2d = await call('DELETE', '/sys/user/' + adminProbeId, { token: admin.token })
    ok('B2d 降级为普通角色后可删', b2d.code === 200, 'code=' + b2d.code + ' msg=' + b2d.message)
    adminProbeId = null

    const b3 = await call('DELETE', '/sys/user/' + probeId, { token: admin.token })
    ok('B3 普通账号删除成功', b3.code === 200, 'code=' + b3.code + ' msg=' + b3.message)
    ok('B3b 清单里已消失', !(await findUser(admin.token, PROBE_USER)))
    probeId = null

    const b4 = await call('DELETE', '/sys/user/' + probe.id, { token: admin.token })
    ok('B4 重复删报「账号不存在」', b4.code !== 200 && /不存在/.test(String(b4.message)), 'code=' + b4.code + ' msg=' + b4.message)

    const b5 = await login(PROBE_USER, PROBE_PWD)
    ok('B5 被删账号无法再登录', !b5.token)
  } finally {
    for (const [name, id] of [['PROBE_USER', probeId], ['PROBE_ADMIN', adminProbeId]]) {
      if (!id) continue
      const still = await findUser(admin.token, name === 'PROBE_USER' ? PROBE_USER : PROBE_ADMIN)
      if (still) {
        const c = await call('DELETE', '/sys/user/' + still.id, { token: admin.token })
        console.log('\n[cleanup] 兜底删除 ' + still.userName + ' → code=' + c.code + (c.code !== 200 ? ' (' + c.message + ')' : ''))
      }
    }
    const left = []
    for (const u of [PROBE_USER, PROBE_ADMIN, 'zz_probe_should_not_exist']) {
      if (await findUser(admin.token, u)) left.push(u)
    }
    console.log('[cleanup] 残留检查: ' + (left.length ? '⚠ ' + left.join(',') + ' 请手删' : '无残留 ✓'))
  }

  console.log('\n== 结果:' + pass + ' 通过 / ' + fail + ' 失败 ==')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(2) })
