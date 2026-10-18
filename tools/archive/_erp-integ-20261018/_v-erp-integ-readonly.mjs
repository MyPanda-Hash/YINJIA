/* 一次性探针(2026-10-18):「ERP集成配置清单」除管理员**只可看不可编辑**的端到端取证。
 *
 * 做法:
 *   ① 在**测试账套 HSDZ_MES_TEST** 造一个临时只读账号(role=erp_integ_probe,只授 ERP_INTEG 的 view),
 *      密码哈希直接复制 admin 的 ⇒ 口令仍是 123456;登录时 factory=YJ_TEST 走测试账套,不碰正式账。
 *   ② 接口层:GET config 应 200(能看);POST item / fields / devices / item/delete 应**全部 403**,
 *      且事后配置条数不变(证明真没写进去,而不只是界面灰显)。
 *   ③ 界面层(CDP/Edge headless):只读账号打开页面 —— 只读标签在、写按钮全不见、输入框 disabled。
 *   ④ 结束后删除临时账号/角色/授权行(测试账套自清)。
 *
 * 用法:node tools/archive/_erp-integ-20261018/_v-erp-integ-readonly.mjs [前端地址,默认 8090]
 *   前置:8090 在跑;sqlcmd 可用(本机 SQL Server)。
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9396
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DB = 'HSDZ_MES_TEST'
const USER = 'erp_probe'
const ROLE = 'erp_integ_probe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let fail = 0
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++ }

/* ── SQL 通道(sqlcmd,直接继承 stdio,便于看报错) ── */
function sql(text, label) {
  const r = spawnSync('sqlcmd', ['-S', 'localhost', '-U', 'yinjia', '-P', 'Yinjia@2026', '-d', DB, '-b', '-f', '65001', '-Q', text],
    { stdio: 'inherit', encoding: 'utf8' })
  if (r.status !== 0) { console.error(`[SQL FAIL] ${label}`); process.exit(1) }
  console.log(`[SQL OK] ${label}`)
}

const SETUP = `
SET NOCOUNT ON;
IF NOT EXISTS (SELECT 1 FROM yj_role WHERE role_code = '${ROLE}')
    INSERT INTO yj_role (role_code, role_name, remark, is_admin)
    VALUES ('${ROLE}', N'ERP集成只读探针', N'一次性:验证 ERP集成配置清单对非管理员只读(探针结束即删)', 'N');
DECLARE @rid int = (SELECT id FROM yj_role WHERE role_code = '${ROLE}');
IF NOT EXISTS (SELECT 1 FROM yj_user WHERE username = '${USER}')
    INSERT INTO yj_user (username, password_hash, real_name, is_admin, enabled, role_id)
    SELECT '${USER}', password_hash, N'ERP只读探针', 'N', '1', @rid FROM yj_user WHERE username = 'admin';
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = @rid AND panel_code = 'ERP_INTEG')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (@rid, 'ERP_INTEG', 'N', 'view');
SELECT @rid AS role_id, (SELECT COUNT(*) FROM yj_role_panel WHERE role_id = @rid AND panel_code = 'ERP_INTEG') AS granted;`

const CLEANUP = `
SET NOCOUNT ON;
DECLARE @rid int = (SELECT id FROM yj_role WHERE role_code = '${ROLE}');
IF @rid IS NOT NULL
BEGIN
    DELETE FROM yj_role_panel WHERE role_id = @rid;
    DELETE FROM yj_user WHERE username = '${USER}';
    DELETE FROM yj_role WHERE id = @rid;
END
SELECT (SELECT COUNT(*) FROM yj_user WHERE username = '${USER}') AS 残留用户,
       (SELECT COUNT(*) FROM yj_role WHERE role_code = '${ROLE}') AS 残留角色;`

const json = async (method, url, body, token) => {
  const r = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, j, t }
}

sql(SETUP, '造临时只读账号(测试账套)')

let token = ''
try {
  /* ═════════ ② 接口层 ═════════ */
  const login = await json('POST', '/auth/login', { userName: USER, password: '123456', factory: 'YJ_TEST' })
  token = login.j?.data?.token || ''
  check(!!token, `只读账号登录成功(测试账套 factory=YJ_TEST): ${login.j?.data?.user?.userName || ''} isAdmin=${login.j?.data?.user?.isAdmin}`)
  if (!token) throw new Error('登录失败: ' + login.t.slice(0, 200))

  const cfg = await json('GET', '/erp/integ/config', null, token)
  const items = cfg.j?.data?.items || []
  check(cfg.status === 200 && cfg.j?.code === 200 && items.length > 0,
    `只读账号能看配置:HTTP ${cfg.status}/code ${cfg.j?.code},接口 ${items.length} 条`)
  const before = items.length
  const beforeFieldN = items.reduce((n, i) => n + (i.fields || []).length, 0)

  const imp = items.find((i) => i.接口编码 === 'IMP_MATERIAL')
  const writes = [
    ['新建接口', 'POST', '/erp/integ/item', { 接口编码: 'PROBE_DENY', 接口名称: '只读探针', 方向: '导入', 分类: '基础资料', 启用: true }],
    ['保存字段映射', 'POST', '/erp/integ/fields', { 接口编码: 'IMP_MATERIAL', rows: [{ 映射层级: '档案', MES字段: '存货编码', ERP字段: 'material_number' }] }],
    ['保存设备绑定', 'POST', '/erp/integ/devices', { 接口编码: 'IMP_MAINT', rows: [{ 设备编码: 'SB001', 设备用途: '保养对象' }] }],
    ['删除接口', 'POST', '/erp/integ/item/delete', { 接口编码: 'EXP_CUSTOMER' }],
    ['改已存在接口', 'POST', '/erp/integ/item', { 接口编码: 'IMP_MATERIAL', 接口名称: '被只读账号改坏了', 方向: '导入', 分类: '基础资料', 启用: false }],
  ]
  for (const [label, method, url, body] of writes) {
    const r = await json(method, url, body, token)
    // ⚠ GlobalExceptionHandler 对 AccessDenied 走"HTTP 200 + body-code 403"(避免前端把 403 当登录失效踢出)
    const denied = r.j?.code === 403
    check(denied, `${label} → 期望被拒(body code 403),实际 HTTP ${r.status}/code ${r.j?.code}${denied ? '' : ' ' + r.t.slice(0, 120)}`)
  }

  const cfg2 = await json('GET', '/erp/integ/config', null, token)
  const items2 = cfg2.j?.data?.items || []
  const afterFieldN = items2.reduce((n, i) => n + (i.fields || []).length, 0)
  const imp2 = items2.find((i) => i.接口编码 === 'IMP_MATERIAL')
  check(items2.length === before, `接口条数未被改动(${before} → ${items2.length})`)
  check(afterFieldN === beforeFieldN, `字段映射行数未被改动(${beforeFieldN} → ${afterFieldN})`)
  check(imp2?.接口名称 === imp?.接口名称, `已存在接口内容未被改动(${JSON.stringify(imp2?.接口名称)})`)
  check(!items2.some((i) => i.接口编码 === 'PROBE_DENY'), '拒绝的"新建接口"没有落库')

  /* ═════════ ③ 界面层(只读账号) ═════════ */
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ro-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1680,1000',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seqId = 0; const pending = new Map()
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seqId; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const raw = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 80; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(2200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${APP}/#/login`); await sleep(1200)
    await raw(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
               localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.j.data.user))});
               localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))});
               localStorage.setItem('mes_collapsed','0'); localStorage.setItem('mes_menu_mode','accordion'); 'ok'`)
    await nav('about:blank')
    await nav(`${APP}/#/erp/integConfig`); await sleep(5000)

    const tag = await raw(`document.querySelector('.dh-left .el-tag')?.innerText.trim() || ''`)
    check(tag.includes('只读'), `界面显示只读标签: ${JSON.stringify(tag)}`)
    const btns = await raw(`[...document.querySelectorAll('.ei-detail button, .ei-list-head button')].map(e=>e.innerText.trim()).filter(Boolean)`)
    const forbidden = ['新增接口', '保存接口', '保存设备', '保存映射', '按面板字段带出', '新增一行', '删除接口', '放弃']
    const shown = (btns || []).filter((t) => forbidden.includes(t))
    check(shown.length === 0, `写操作按钮全部不出现(实际按钮 ${JSON.stringify(btns)})`)
    const inputsDisabled = await raw(`(() => {
      const ins = [...document.querySelectorAll('.form-grid input, .form-grid textarea')];
      if (!ins.length) return null;
      return ins.every(i => i.disabled);
    })()`)
    check(inputsDisabled === true, `接口信息表单元件全部 disabled(${inputsDisabled})`)
    const mapDisabled = await raw(`(() => {
      const ins = [...document.querySelectorAll('.map-table input')];
      return ins.length ? ins.every(i => i.disabled) : null;
    })()`)
    check(mapDisabled !== false, `字段映射表格单元件 disabled(${mapDisabled})`)
    const opsCol = await raw(`[...document.querySelectorAll('.map-table thead th .cell')].map(e=>e.innerText.trim()).includes('操作')`)
    check(opsCol === false, '字段映射「操作」列(上移/下移/删除)不出现')
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(__dirname, '_shot-readonly.png'), Buffer.from(shot.result.data, 'base64'))
    console.log('      只读界面截图:_shot-readonly.png')
  } finally { edge.kill() }
} finally {
  sql(CLEANUP, '清理临时只读账号')
}
console.log(fail ? `\n${fail} 项未通过` : '\n全部通过')
process.exit(fail ? 1 : 0)
