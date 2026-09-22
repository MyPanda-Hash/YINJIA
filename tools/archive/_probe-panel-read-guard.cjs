/**
 * 临时探针(2026-09-22):面板元数据闸门(requirePanelRead)的越权与"不误伤"双向验证
 *   ① 越权:受限账号取不可读面板的配置/权限矩阵/写偏好 ⇒ 必须 403(body code)
 *   ② 不误伤:①可见面板 ②**参照目标**(readablePanels 第二层) 仍必须 200
 *   ③ admin 恒过
 * 前置:测试库有 switchprobe(仅测试库账号,role=仓管,密码 123456)—— 由调用方造/清。
 * 用法: node --experimental-websocket D:\DSHTemp\_probe-panel-read-guard.cjs
 */
const API = 'http://localhost:8090/api'
let fails = 0
const chk = (n, ok, ex) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (ex === undefined ? '' : '  → ' + JSON.stringify(ex))); if (!ok) fails++ }

async function login(userName, password, factory) {
  const r = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName, password, factory }),
  })
  const b = await r.json()
  if (!b.data || !b.data.token) throw new Error('登录失败 ' + userName + ': ' + JSON.stringify(b).slice(0, 160))
  return { token: b.data.token, user: b.data.user }
}

async function get(path, token) {
  const r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } })
  const text = await r.text()
  let body = null
  try { body = JSON.parse(text) } catch { /* 非 JSON */ }
  return { http: r.status, code: body && body.code, message: body && body.message, dataKeys: body && body.data ? Object.keys(body.data).slice(0, 4) : null }
}
async function post(path, token, payload) {
  const r = await fetch(API + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify(payload),
  })
  const text = await r.text()
  let body = null
  try { body = JSON.parse(text) } catch { /* 非 json */ }
  return { http: r.status, code: body && body.code, message: body && body.message }
}

async function main() {
  const admin = await login('admin', '123456', 'YJ')
  const limited = await login('switchprobe', '123456', 'YJ_TEST')
  const vis = limited.user.visiblePanels || []
  console.log('[基线] switchprobe: isAdmin=' + limited.user.isAdmin + ' 可见面板=' + vis.length)
  const NOT_READABLE = 'BOM'        // 不可见、也非参照目标、也非同模块
  const VISIBLE = vis.includes('MANU_ORDER') ? 'MANU_ORDER' : vis[0]
  const REF_TARGET = 'DEPT'         // RD_MOLD_PROC 的参照目标,对 role2 不可见但必须可读
  chk('基线:受限账号确实看不到 ' + NOT_READABLE, !vis.includes(NOT_READABLE))
  chk('基线:受限账号能看到 ' + VISIBLE, vis.includes(VISIBLE))
  chk('基线:参照目标 ' + REF_TARGET + ' 不可见(用于验证第二层放行)', !vis.includes(REF_TARGET))

  console.log('\n【1】越权:不可读面板的元数据面必须被拒')
  for (const p of ['/px/getPanelConfig?panelCode=' + NOT_READABLE, '/px/getPermMatrix?panelCode=' + NOT_READABLE, '/px/getNewFormPermMatrix?panelCode=' + NOT_READABLE]) {
    const r = await get(p, limited.token)
    chk(p.split('?')[0] + ' 被拒且说明原因', r.code === 403 && /读取权限/.test(String(r.message)), r)
  }
  const saveDenied = await post('/px/saveColumnPrefs', limited.token, { panelCode: NOT_READABLE, columns: [] })
  chk('/px/saveColumnPrefs 被拒', saveDenied.code === 403, saveDenied)
  const saveHeaderDenied = await post('/px/saveHeaderPrefs', limited.token, { panelCode: NOT_READABLE, columns: [] })
  chk('/px/saveHeaderPrefs 被拒', saveHeaderDenied.code === 403, saveHeaderDenied)

  console.log('\n【2】不误伤:可见面板与参照目标必须照常放行')
  const okVisible = await get('/px/getPanelConfig?panelCode=' + VISIBLE, limited.token)
  chk('可见面板 ' + VISIBLE + ' 取配置 200 且有内容', okVisible.code === 200 && !!okVisible.dataKeys, okVisible)
  const okRef = await get('/px/getPanelConfig?panelCode=' + REF_TARGET, limited.token)
  chk('参照目标 ' + REF_TARGET + '(第二层放行)取配置 200', okRef.code === 200, okRef)
  const okNewForm = await get('/px/getNewFormPermMatrix?panelCode=' + VISIBLE + '&operationName=' + encodeURIComponent('新增流程'), limited.token)
  chk('可见面板取新增权限矩阵 200', okNewForm.code === 200, okNewForm)
  const saveOk = await post('/px/saveColumnPrefs', limited.token, { panelCode: VISIBLE, columns: [{ field: '编号', hidden: false }] })
  chk('可见面板写表格偏好 200(不误伤)', saveOk.code === 200, saveOk)

  console.log('\n【3】admin 恒过')
  const adm = await get('/px/getPanelConfig?panelCode=' + NOT_READABLE, admin.token)
  chk('admin 取任意面板配置 200', adm.code === 200 && !!adm.dataKeys, adm)

  console.log('\n【4】取数接口(此前已有闸门)未受影响')
  const listDenied = await post('/px/queryFormDataList', limited.token, { panelCode: NOT_READABLE, condition: {}, pageNo: 1, pageSize: 5 })
  chk('不可读面板取数仍被拒', listDenied.code === 403, listDenied)
  const listOk = await post('/px/queryFormDataList', limited.token, { panelCode: VISIBLE, condition: {}, pageNo: 1, pageSize: 5 })
  chk('可见面板取数 200', listOk.code === 200, listOk)

  console.log(fails ? '\n结果:' + fails + ' 项未通过' : '\n结果:全部通过')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error('FAIL: ' + (e && e.message)); process.exit(1) })
