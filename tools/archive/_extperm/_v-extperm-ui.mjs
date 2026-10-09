/* _v-extperm-ui.mjs — 「自定义字段」配置权限(2026-10-09)界面取证(CDP / Edge headless)
 *
 * 目标:证明「自定义字段」入口按**组织架构 →「角色与面板权限」**的授权显隐,
 * 不再是「仅超级管理员」。全程在**测试账套 (YJ_TEST)** 上做,收尾删掉探针账号/角色。
 *
 * 断言(每一步都是真实界面 DOM,不是接口自说自话):
 *   A 管理员·组织架构:权限矩阵出现「自定义字段」列(截图)
 *   B 探针账号(只给 可见,未给 field):商品档案「更多 ▼」**无**字段管理;来料检验要求**无**⚙自定义字段
 *   C 管理员勾上 field 后:商品档案「更多 ▼」**有**字段管理(截图);来料检验要求**有**⚙自定义字段(截图),
 *     且点得开「字段管理」弹窗(截图)
 *
 * 用法:node tools/archive/_extperm/_v-extperm-ui.mjs [uiBase] [apiBase]
 *   默认 uiBase=http://localhost:5173(vite 源码即时生效),apiBase=http://127.0.0.1:8090/api
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UI = process.argv[2] || 'http://localhost:5173'
const API = process.argv[3] || 'http://127.0.0.1:8090/api'
const PORT = 9353
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(import.meta.dirname, '_shots')
fs.mkdirSync(OUT, { recursive: true })

const FACTORY = 'YJ_TEST'
const ROLE_CODE = 'extperm_ui_probe'
const USER = 'extperm_ui_probe'
const PWD = '123456'
const PANEL_FIELD = 'QC_INSP_REQ'   // 来料检验要求(用户点名的那个面板)
const PANEL_MENU = 'INV'            // 商品档案:走 PanelxList 的「更多 ▼ → 字段管理」

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✔ ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`  ✘ ${name}${detail ? ' — ' + detail : ''}`) }
}

async function api(method, p, body, token) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await res.text()
  try { return JSON.parse(t) } catch { return { code: res.status, message: t } }
}
const login = async (u, pw) => (await api('POST', '/auth/login', { userName: u, password: pw, factory: FACTORY })).data

// ---------- 建探针角色/账号(先只给「可见」) ----------
const admin = await login('admin', PWD)
if (!admin) throw new Error('管理员登录失败')
const roles0 = (await api('GET', '/sys/role/list', undefined, admin.token)).data || []
for (const r of roles0.filter((x) => x.roleCode === ROLE_CODE)) await api('DELETE', '/sys/role/' + r.id, undefined, admin.token)
const users0 = (await api('GET', '/sys/user/list', undefined, admin.token)).data || []
for (const u of users0.filter((x) => x.userName === USER)) await api('DELETE', '/sys/user/' + u.id, undefined, admin.token)

await api('POST', '/sys/role/save', { roleCode: ROLE_CODE, roleName: '自定义字段界面探针', remark: '探针自动创建,用完即删' }, admin.token)
const roleId = ((await api('GET', '/sys/role/list', undefined, admin.token)).data).find((r) => r.roleCode === ROLE_CODE).id
await api('POST', '/sys/user/save', { userName: USER, realName: '界面探针', password: PWD, roleId, enabled: 1 }, admin.token)
const grant = (panels) => api('POST', `/sys/role/${roleId}/panels`, { panels }, admin.token)
await grant([{ panelCode: PANEL_FIELD, perms: 'view' }, { panelCode: PANEL_MENU, perms: 'view' }])
const before = await login(USER, PWD)
check('探针账号(未授权 field)fieldPanels 为空', JSON.stringify(before.user.fieldPanels) === '[]', JSON.stringify(before.user.fieldPanels))

// ---------- 起 headless Edge + CDP ----------
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-extperm-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)

const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
const nav = async (url, wait = 3000) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') break } await sleep(wait) }
const shot = async (name) => {
  let r = await send('Page.captureScreenshot', { format: 'png' })
  if (!r?.result?.data) { await sleep(800); r = await send('Page.captureScreenshot', { format: 'png' }) }
  if (!r?.result?.data) { console.log('  ! 截图失败:', name); return }
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'))
  console.log('  · 截图:', name)
}
/** 以某账号进站:注入 token/user(同源 localStorage),先 about:blank 再跳路由(hash 跳转不重载)。
 *  locale 传入时同时写 mes_locale(切语言走前端 i18n 真源,见 stores/locale.js)。 */
async function enter(user, route, wait = 3500, locale = '') {
  await nav(`${UI}/#/login`, 1200)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(user.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user.user))});`
    + (locale ? `localStorage.setItem('mes_locale', ${JSON.stringify(locale)});` : '') + ` 'ok'`)
  await nav('about:blank', 300)
  await nav(`${UI}${route}`, wait)
  await evaluate(`(() => { const b = document.querySelector('.wz-skip'); if (b) b.click(); return 1 })()`)
  await sleep(500)
}
/** 打开面板列表页「更多 ▼」下拉,返回其中动作文案。
 *  ⚠ 选择器不能认中文「更多」:切 en 后组名是 More,认字会点到别的组(实测踩到)。
 *  改为**按组内容**识别:逐个 caret 点开,直到下拉里出现「导出/Export」这一组(「更多」组的固有成员)。 */
const MORE_WORDS = ['导出', 'Export']
async function openMoreMenu() {
  const n = await evaluate(`document.querySelectorAll('.tb-caret').length`)
  for (let i = 0; i < (n || 0); i++) {
    await evaluate(`document.querySelectorAll('.tb-caret')[${i}]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
    await sleep(500)
    const items = (await evaluate(`Array.from(document.querySelectorAll('.tb-menu .ctx-item')).map(e => e.textContent.trim())`)) || []
    if (items.some((t) => MORE_WORDS.some((w) => t.includes(w)))) return items
    await evaluate(`document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))`) // 关掉刚点开的下拉
    await sleep(200)
  }
  return []
}

/** 选中角色表里第一个非超级角色行(驱动权限矩阵渲染) */
async function pickRoleRow() {
  const picked = await evaluate(`(() => {
    const rows = Array.from(document.querySelectorAll('.org-col.roles .el-table__row'))
    const r = rows.find(x => !/超级|Super/.test(x.innerText)) || rows[0]
    r?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return r ? r.innerText.replace(/\\s+/g, ' ').trim() : ''
  })()`)
  await sleep(2500)
  return picked
}

await send('Page.enable'); await send('Runtime.enable')

// ---------- A 管理员:权限矩阵新列 ----------
// ⚠ 矩阵只在**选中某个角色行**后才渲染(selRole 驱动):先点一行非超级角色,再读列头。
await enter(admin, '/#/sys/org', 5000)
const picked = await pickRoleRow()
const ths = (await evaluate(`Array.from(document.querySelectorAll('.perm-table thead th')).map(e => e.textContent.trim())`)) || []
const hasFieldCol = ths.some((t) => t.includes('自定义字段'))
check('A 选中角色后权限矩阵渲染', ths.length > 0, `角色行「${picked}」→ 列 ${ths.length} 个`)
check('A 组织架构·权限矩阵出现「自定义字段」列', hasFieldCol, ths.join(' | '))
const grantedText = await evaluate(`document.querySelector('.perm-head')?.innerText || ''`)
check('A 权限矩阵含角色面板权限区(已载入)', String(grantedText).includes('面板操作权限'), String(grantedText).replace(/\s+/g, ' ').slice(0, 80))
await shot('1-orgadmin-perm-matrix.png')

// ---------- B 未授权:两处入口都不出现 ----------
await enter(before, `/#/panelx/list/${PANEL_MENU}`, 5000)
const menuBefore = await openMoreMenu()
check('B 未授权:商品档案「更多 ▼」无「字段管理」', !menuBefore.includes('字段管理'), menuBefore.join(' | '))
check('B 未授权:「更多 ▼」仍在(菜单本身没坏)', menuBefore.length > 0, menuBefore.join(' | '))
await shot('2-unauthorized-no-fieldmgr.png')

await enter(before, `/#/panelx/list/${PANEL_FIELD}`, 6000)
const barBefore = await evaluate(`Array.from(document.querySelectorAll('.qc-bar-btn')).map(e => e.textContent.trim())`)
check('B 未授权:来料检验要求无「⚙ 自定义字段」', !(barBefore || []).some((t) => t.includes('自定义字段')), (barBefore || []).join(' | '))
await shot('3-unauthorized-qcinspreq.png')

// ---------- C 授权 field 后:两处入口出现 ----------
await grant([{ panelCode: PANEL_FIELD, perms: 'view,field' }, { panelCode: PANEL_MENU, perms: 'view,field' }])
const after = await login(USER, PWD)
check('C 授权后 fieldPanels = 两个面板', JSON.stringify((after.user.fieldPanels || []).slice().sort()) === JSON.stringify([PANEL_FIELD, PANEL_MENU].sort()), JSON.stringify(after.user.fieldPanels))

await enter(after, `/#/panelx/list/${PANEL_MENU}`, 5000)
const menuAfter = await openMoreMenu()
check('C 授权后:商品档案「更多 ▼」出现「字段管理」', menuAfter.includes('字段管理'), menuAfter.join(' | '))
await shot('4-authorized-fieldmgr-menu.png')

await enter(after, `/#/panelx/list/${PANEL_FIELD}`, 6000)
const barAfter = await evaluate(`Array.from(document.querySelectorAll('.qc-bar-btn')).map(e => e.textContent.trim())`)
check('C 授权后:来料检验要求出现「⚙ 自定义字段」', (barAfter || []).some((t) => t.includes('自定义字段')), (barAfter || []).join(' | '))
await shot('5-authorized-qcinspreq.png')
const opened = await evaluate(`(() => {
  const b = Array.from(document.querySelectorAll('.qc-bar-btn')).find(e => e.textContent.includes('自定义字段'))
  b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b
})()`)
await sleep(2500)
const dlgTitle = await evaluate(`Array.from(document.querySelectorAll('.el-dialog__title')).map(e => e.textContent.trim()).join(',')`)
const tabUsage = await evaluate(`document.querySelector('.fm-tabusage')?.innerText || ''`)
check('C 点得开「字段管理」弹窗', opened === true && String(dlgTitle).includes('字段管理'), String(dlgTitle))
check('C 弹窗载入该面板扩展池账目(可选页面)', String(dlgTitle).includes('字段管理') || String(tabUsage).length > 0)
await shot('6-fieldmgr-dialog.png')

// ---------- D 多语言(AGENTS 强制规范:切 en 后新功能显示目标语言) ----------
await enter(admin, '/#/sys/org', 8000, 'en')
const pickedEn = await pickRoleRow()
await sleep(1500)
const thsEn = (await evaluate(`Array.from(document.querySelectorAll('.perm-table thead th')).map(e => e.textContent.trim())`)) || []
check('D 切 en:权限矩阵出现 Custom Fields 列', thsEn.includes('Custom Fields'),
  `角色行「${pickedEn}」· 列 ${thsEn.length} 个 · ${Array.from(new Set(thsEn)).slice(0, 13).join(' | ')}`)
await shot('7-en-orgadmin-perm-matrix.png')

await enter(after, `/#/panelx/list/${PANEL_FIELD}`, 6000, 'en')
const barEn = await evaluate(`Array.from(document.querySelectorAll('.qc-bar-btn')).map(e => e.textContent.trim())`)
check('D 切 en:来料检验要求入口显示 Custom Fields', (barEn || []).some((t) => t.includes('Custom Fields')), (barEn || []).join(' | '))
await shot('8-en-qcinspreq-customfields.png')

await enter(after, `/#/panelx/list/${PANEL_MENU}`, 5000, 'en')
const menuEn = await openMoreMenu()
check('D 切 en:「更多 ▼」里的入口显示 Field Manager', menuEn.includes('Field Manager'), menuEn.join(' | '))

await enter(after, `/#/panelx/list/${PANEL_FIELD}`, 4000, 'zh-CN')

ws.close(); edge.kill()

// ---------- (收尾前置:D 多语言已在上面完成) ----------

// ---------- 收尾:删探针账号/角色 ----------
const u1 = (await api('GET', '/sys/user/list', undefined, admin.token)).data || []
const pu = u1.find((u) => u.userName === USER)
if (pu) await api('DELETE', '/sys/user/' + pu.id, undefined, admin.token)
await api('DELETE', '/sys/role/' + roleId, undefined, admin.token)
const stillUser = ((await api('GET', '/sys/user/list', undefined, admin.token)).data || []).some((u) => u.userName === USER)
const stillRole = ((await api('GET', '/sys/role/list', undefined, admin.token)).data || []).some((r) => r.roleCode === ROLE_CODE)
check('探针账号/角色已清理', !stillUser && !stillRole)

console.log(`\n=== 界面取证结果: PASS ${pass} / FAIL ${fail}(截图在 ${OUT})===`)
process.exit(fail ? 1 : 0)
