/**
 * 探针:SysAdminService.userSave 的三条自锁守卫(①停用自己 ②降自己 ③最后一个可用管理员)
 * 只在**测试账套 YJ_TEST** 上做,自带夹具与还原(临时管理员 zzguard + admin 状态复位)。
 *
 * 关键前提(实测):requireAdmin 只查 is_admin='Y',**不查 enabled** ⇒ 可以把 admin 的 enabled
 *   置 '0' 后用旧 token 继续调接口,从而**独立**验证 ③(否则 ③ 在"只有一个管理员"时与 ① 重合,测不出来)。
 */
const { execFileSync } = require('node:child_process')
const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const DB = 'HSDZ_MES_TEST'
const TMP = 'zzguard'
const TMP_PW = 'Zz123456'
let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + detail}`)
  if (!ok) fails++
}

function sql(q) {
  const f = require('node:path').join(process.env.TEMP, 'mes-guard-probe.sql')
  require('node:fs').writeFileSync(f, q, 'utf8')
  return execFileSync('sqlcmd', ['-S', 'localhost', '-E', '-C', '-f', '65001', '-d', DB, '-i', f, '-h', '-1', '-W'],
    { encoding: 'utf8' })
}

async function login(u, p) {
  const r = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: u, password: p, factory: FACTORY }),
  })
  const j = await r.json().catch(() => ({}))
  return j?.data?.token || null
}
async function listUsers(tok) {
  return (await (await fetch(API + '/sys/user/list', { headers: { Authorization: 'Bearer ' + tok } })).json()).data
}
async function save(tok, body) {
  const r = await fetch(API + '/sys/user/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + tok },
    body: JSON.stringify(body),
  })
  let j = {}
  try { j = await r.json() } catch {}
  return { http: r.status, ok: j.code === 200, msg: String(j.message || '') }
}
const payloadOf = (u, over = {}) => ({
  id: u.id, userName: u.userName, realName: u.realName, deptId: u.deptId,
  roleId: u.roleId, workshop: u.workshop, enabled: Number(u.enabled), ...over,
})

async function main() {
  const adminTok = await login('admin', '123456')
  if (!adminTok) throw new Error('admin 登录失败')
  const admin = (await listUsers(adminTok)).find((u) => u.userName === 'admin')
  const roleAdminId = admin.roleId
  const roleUserId = (await listUsers(adminTok)).find((u) => u.userName === 'cp')?.roleId ?? 2
  console.log(`[夹具] admin.id=${admin.id} roleId=${roleAdminId};普通角色 roleId=${roleUserId}`)

  const reset = () => {
    // ⚠ is_admin 是**落库列**(不是计算列)——降权会把它写成 'N',只复位 role_id 救不回来,
    //   必须一起复位,否则测试账套的 admin 会永久失去管理权(本轮实测踩到,已手工修复)
    sql(`SET NOCOUNT ON;
UPDATE dbo.yj_user SET is_admin='Y', enabled='1', role_id=${roleAdminId} WHERE username=N'admin';
UPDATE dbo.yj_user SET is_admin='Y', enabled='1', role_id=${roleAdminId} WHERE username=N'${TMP}';
`)
  }
  try {
    // ── 夹具:临时管理员(走正规接口建,口令 BCrypt 正常) ──
    sql(`SET NOCOUNT ON; DELETE FROM dbo.yj_user WHERE username=N'${TMP}';`)
    const mk = await save(adminTok, { userName: TMP, realName: '守卫测试账号', roleId: roleAdminId, enabled: 1, password: TMP_PW })
    chk('G0', `夹具:建临时管理员 ${TMP}`, mk.ok, mk.msg)
    if (!mk.ok) throw new Error('夹具创建失败')
    const guard = (await listUsers(adminTok)).find((u) => u.userName === TMP)
    const guardTok = await login(TMP, TMP_PW)
    chk('G0b', '临时管理员能登录', !!guardTok)

    // ── ① 不能停用当前登录账号 ──
    let r = await save(guardTok, payloadOf(guard, { enabled: 0 }))
    chk('G1', '① 停用「当前登录账号」被拒', !r.ok, `ok=${r.ok} msg=${r.msg}`)
    reset()

    // ── ② 不能把当前登录账号降为非管理员 ──
    r = await save(guardTok, payloadOf(guard, { roleId: roleUserId }))
    chk('G2', '② 把「当前登录账号」降为非管理员被拒', !r.ok, `ok=${r.ok} msg=${r.msg}`)
    reset()

    // ── 反例:守卫不许过严 —— admin 改**别人**应当照常放行 ──
    r = await save(adminTok, payloadOf(guard, { enabled: 0 }))
    chk('G3', '反例:admin 停用**另一个**管理员仍允许(还有 admin 在)', r.ok, `ok=${r.ok} msg=${r.msg}`)
    reset()
    r = await save(adminTok, payloadOf(guard, { roleId: roleUserId }))
    chk('G4', '反例:admin 把**另一个**管理员降权仍允许', r.ok, `ok=${r.ok} msg=${r.msg}`)
    reset()

    // ── ③ 不能停用/降权「最后一个可用管理员」(独立于 ①② 的验证)──
    //    前提:把 admin 自己 enabled 置 '0'(requireAdmin 不查 enabled,旧 token 仍可用),
    //    此时 zzguard 就是**唯一启用中的管理员**,再停用它会变成 0 个 ⇒ 必须被拒。
    sql(`SET NOCOUNT ON; UPDATE dbo.yj_user SET enabled='0' WHERE username=N'admin';`)
    r = await save(adminTok, payloadOf(guard, { enabled: 0 }))
    chk('G5', '③ 停用「最后一个可用管理员」被拒(admin 自身已停用时)', !r.ok, `ok=${r.ok} msg=${r.msg}`)
    r = await save(adminTok, payloadOf(guard, { roleId: roleUserId }))
    chk('G6', '③ 降权「最后一个可用管理员」被拒(admin 自身已停用时)', !r.ok, `ok=${r.ok} msg=${r.msg}`)
    reset()

    // ── ①③ / ②③ 组合:admin 动自己 ──
    r = await save(adminTok, payloadOf(admin, { enabled: 0 }))
    chk('G7', '① ③ admin 停用自己(也是最后一个管理员)被拒', !r.ok, `ok=${r.ok} msg=${r.msg}`)
    reset()
    r = await save(adminTok, payloadOf(admin, { roleId: roleUserId }))
    chk('G8', '② ③ admin 把自己降为非管理员被拒', !r.ok, `ok=${r.ok} msg=${r.msg}`)
  } finally {
    reset()
    sql(`SET NOCOUNT ON; DELETE FROM dbo.yj_user WHERE username=N'${TMP}';`)
    const after = sql(`SET NOCOUNT ON; SELECT username, is_admin, enabled, role_id FROM dbo.yj_user WHERE username IN (N'admin', N'${TMP}');`)
    console.log('[还原] ' + after.trim().replace(/\s+/g, ' '))
  }
  console.log('')
  if (fails === 0) console.log('[PASS] userSave 三条自锁守卫全部生效')
  else { console.log(`[FAIL] ${fails} 项不符`); process.exit(1) }
}
main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1) })
