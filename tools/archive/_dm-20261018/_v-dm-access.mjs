/* 一次性探针(2026-10-18):数据建模访问控制与 ERP集成只读 —— 在真实 8090 上打接口。
 *   ① ERP集成(ERPLG/ERPLG_ROW):管理员点 新增/保存/删除 必须被拒(403);刷新/导出仍放行;
 *   ② 字段管理(FIELDMGR)/数据字典(ZDGL):非管理员**读**就被拒;管理员正常;
 *   ③ 对照组:普通用户读一个正常授权的面板(如 PURCHASE_IN)仍然通过(证明没误伤别人的权限)。
 *
 * ⚠ 需要一个**非管理员**账号。默认用 cp;可用 --user xxx --pass yyy 覆盖。
 * 用法:node tools/archive/_dm-20261018/_v-dm-access.mjs [--user cp] [--pass xxx]
 */
const API = 'http://127.0.0.1:8090/api'
const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const USER = arg('user', 'cp')
const PASS = arg('pass', arg('user', 'cp') === 'cp' ? '123456' : '')

const call = async (path, body, token) => {
  const r = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text()
  let j = null; try { j = JSON.parse(t) } catch { /* not json */ }
  return { status: r.status, code: j?.code, message: j?.message || t.slice(0, 200), data: j?.data }
}
const login = async (u, p) => {
  const r = await call('/auth/login', { userName: u, password: p })
  if (!r.data?.token) throw new Error(`登录失败 ${u}: ${r.message}`)
  return r.data.token
}

let fail = 0
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++ }
/** 业务拒绝 = HTTP 200 + body.code 403(本项目 GlobalExceptionHandler 口径)或真 403 */
const denied = (r) => r.code === 403 || r.status === 403 || (r.code !== 200 && /权限|只读|仅管理员/.test(String(r.message)))
const allowed = (r) => (r.code === 200 || r.status === 200)

const admin = await login('admin', '123456')
console.log('--- 管理员:ERP集成只读 ---')
for (const btn of ['新增', '保存', '删除', '导入']) {
  const r = await call('/px/callButton', { panelCode: 'ERPLG', buttonName: btn, formData: { 编号: 'ERP导入日志', detail: { erplg: [] } }, buttonParam: {} }, admin)
  check(denied(r), `ERPLG 「${btn}」被拒(code=${r.code} ${String(r.message).slice(0, 60)})`)
}
const df = await call('/px/deleteForms', { panelCode: 'ERPLG', rowCodes: ['IMP-20261018-001'] }, admin)
check(denied(df), `ERPLG /deleteForms 被拒(code=${df.code})`)
const rf = await call('/px/callButton', { panelCode: 'ERPLG', buttonName: '刷新', formData: {}, buttonParam: {} }, admin)
check(!/只读/.test(String(rf.message)) , `ERPLG 「刷新」放行(未被只读闸门拦;code=${rf.code})`)
const erpView = await call('/px/queryFormDataList', { panelCode: 'ERPLG', keyword: '', condition: {}, pageNo: 1, pageSize: 50 }, admin)
check(allowed(erpView) && erpView.data?.totalSize === 9, `ERPLG 管理员可查询(${erpView.data?.totalSize} 个批次)`)

console.log('--- 管理员:字段管理 / 数据字典 可访问 ---')
for (const p of ['FIELDMGR', 'ZDGL']) {
  const r = await call('/px/queryFormDataList', { panelCode: p, keyword: '', condition: {}, pageNo: 1, pageSize: 5 }, admin)
  check(allowed(r), `${p} 管理员可查询(totalSize=${r.data?.totalSize ?? '-'})`)
}

console.log(`--- 非管理员(${USER}):字段管理 / 数据字典 必须被拒 ---`)
let token = null
try { token = await login(USER, PASS) } catch (e) { console.log('SKIP  ', e.message); }
if (token) {
  for (const p of ['FIELDMGR', 'ZDGL']) {
    const r = await call('/px/queryFormDataList', { panelCode: p, keyword: '', condition: {}, pageNo: 1, pageSize: 5 }, token)
    check(denied(r), `${p} 非管理员读取被拒(${String(r.message).slice(0, 60)})`)
    const cfg = await call(`/px/getPanelConfig?panelCode=${p}`, null, token)
    check(denied(cfg), `${p} 非管理员取配置被拒(${String(cfg.message).slice(0, 50)})`)
  }
  // 对照组:该账号本来就有权看的采购入库单(证据见 README)
  const ctl = await call('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', keyword: '', condition: {}, pageNo: 1, pageSize: 5 }, token)
  check(!denied(ctl), `对照组:PURCHASE_IN 仍可读(未被误伤,code=${ctl.code})`)
}

console.log(fail ? `\n${fail} 项未通过` : '\n全部通过')
process.exit(fail ? 1 : 0)
