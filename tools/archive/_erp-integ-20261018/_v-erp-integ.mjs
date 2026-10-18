/* 一次性探针(2026-10-18):ERP系统集成 · ERP集成配置清单
 *   —— ① 接口:23 条配置(导入 11 / 转出 12)、字段映射 165 行、设备绑定 14 行;
 *      ② 写闭环:新增接口 → 存字段映射 → 存设备绑定 → 读回 → 删除(自清,不留脏数据);
 *      ③ 界面(CDP/Edge headless):左侧菜单出现「ERP系统集成」、页面三栏渲染、导入/转出页签切换、
 *         字段映射表有行,两张截图留档。
 * 用法(先确保 8090 + 5173 在跑):
 *   node tools/archive/_erp-integ-20261018/_v-erp-integ.mjs [前端地址,默认 5173]
 * 产物:_shot-erp-integ-import.png / _shot-erp-integ-export.png
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:5173').replace(/\/$/, '')
const PORT = 9392
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let fail = 0
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++ }

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

/* ═════════ ① 读:配置 / 元数据 / 面板字段 ═════════ */
const login = await json('POST', '/auth/login', { userName: 'admin', password: '123456' })
const token = login.j?.data?.token
if (!token) { console.log('登录失败:', login.t.slice(0, 200)); process.exit(1) }

const cfg = await json('GET', '/erp/integ/config', null, token)
if (cfg.status !== 200 || cfg.j?.code !== 200) { console.log('配置接口失败:', cfg.t.slice(0, 300)); process.exit(1) }
const items = cfg.j.data.items || []
const imp = items.filter((i) => i.方向 === '导入')
const exp = items.filter((i) => i.方向 === '转出')
check(items.length === 23, `接口配置共 ${items.length} 条(期望 23)`)
check(imp.length === 11, `导入方向 ${imp.length} 条(期望 11)`)
check(exp.length === 12, `转出方向 ${exp.length} 条(期望 12)`)

const mapN = items.reduce((n, i) => n + (i.fields || []).length, 0)
const devN = items.reduce((n, i) => n + (i.devices || []).length, 0)
check(mapN >= 150, `字段映射共 ${mapN} 行(期望 ≥150)`)
check(devN >= 10, `设备绑定共 ${devN} 行(期望 ≥10)`)

// 分类齐全:两个方向都要出现 基础资料/单据/设备
for (const [dir, list] of [['导入', imp], ['转出', exp]]) {
  const cats = [...new Set(list.map((i) => i.分类))]
  check(cats.length >= 2, `${dir}方向分类 = ${JSON.stringify(cats)}`)
}
check(cfg.j.data.categories?.length === 3, `分类词表 ${JSON.stringify(cfg.j.data.categories)}`)
check(cfg.j.data.transforms?.length >= 5, `转换规则词表 ${JSON.stringify(cfg.j.data.transforms)}`)

// 现役推送口径抽样:采购入库单 → pur_inbound,行字段 material_number/stock_id
const purIn = items.find((i) => i.接口编码 === 'EXP_PUR_IN')
check(purIn?.接口地址 === '/jdy/v2/scm/pur_inbound', `EXP_PUR_IN 接口地址 = ${purIn?.接口地址}`)
check((purIn?.fields || []).some((f) => f.ERP字段 === 'material_number'), 'EXP_PUR_IN 有 material_number 映射')
check((purIn?.fields || []).some((f) => f.ERP字段 === 'stock_id'), 'EXP_PUR_IN 有 stock_id 映射(金蝶只认 stock_id)')
check((purIn?.fields || []).some((f) => f.ERP字段 === 'src_seq'), 'EXP_PUR_IN 有 src_seq(来源单行号)映射')

const meta = await json('GET', '/erp/integ/meta', null, token)
check(meta.status === 200 && (meta.j.data.devices || []).length === 6,
  `设备档案下拉 ${(meta.j.data.devices || []).length} 台(期望 6,去重未停用)`)
check((meta.j.data.panels || []).length > 100, `面板下拉 ${(meta.j.data.panels || []).length} 个`)

const pf = await json('GET', '/erp/integ/panelFields?panelCode=PURCHASE_IN', null, token)
const pfNames = (pf.j?.data || []).map((f) => f.字段名)
check(pfNames.includes('存货编码') && pfNames.includes('实收数量'),
  `PURCHASE_IN 面板字段带出正常(样例 ${pfNames.slice(0, 6).join('/')})`)

/* ═════════ ② 写闭环(自清) ═════════ */
const TMP = 'TMP_PROBE_ERP_INTEG'
await json('POST', '/erp/integ/item', {
  接口编码: TMP, 接口名称: '探针临时接口', 方向: '转出', 分类: '单据', 提供方: '金蝶云星辰',
  接口地址: '/jdy/v2/scm/probe', 请求方式: 'POST', 对应面板: 'PURCHASE_IN', 目标对象: '探针单据',
  触发方式: '探针', 启用: true, 排序: 999, 说明: '由 _v-erp-integ.mjs 创建,结束即删',
}, token)
let c1 = await json('GET', '/erp/integ/config', null, token)
const tmp1 = (c1.j.data.items || []).find((i) => i.接口编码 === TMP)
check(!!tmp1 && tmp1.接口名称 === '探针临时接口', '新增接口:读回成功')

await json('POST', '/erp/integ/fields', {
  接口编码: TMP,
  rows: [
    { 映射层级: '表头', MES字段: '单据日期', ERP字段: 'bill_date', 转换规则: '日期格式化', 是否必填: true, 启用: true, 备注: '探针' },
    { 映射层级: '明细', MES字段: '存货编码', ERP字段: 'material_number', 转换规则: '直传', 是否必填: true, 启用: true, 备注: '探针' },
  ],
}, token)
await json('POST', '/erp/integ/devices', {
  接口编码: TMP, rows: [{ 设备编码: 'SB001', 设备用途: '数据来源', 备注: '探针' }],
}, token)
let c2 = await json('GET', '/erp/integ/config', null, token)
const tmp2 = (c2.j.data.items || []).find((i) => i.接口编码 === TMP)
check((tmp2?.fields || []).length === 2, `保存字段映射 2 行 → 读回 ${(tmp2?.fields || []).length} 行`)
check((tmp2?.devices || []).length === 1 && tmp2.devices[0].设备编码 === 'SB001',
  `保存设备绑定 1 台 → 读回 ${JSON.stringify((tmp2?.devices || []).map((d) => d.设备编码))}`)
check((tmp2?.devices || [])[0]?.设备名称 === '锯床-01', `设备名称按档案带出 = ${tmp2?.devices?.[0]?.设备名称}`)

await json('POST', '/erp/integ/item/delete', { 接口编码: TMP }, token)
let c3 = await json('GET', '/erp/integ/config', null, token)
check(!(c3.j.data.items || []).some((i) => i.接口编码 === TMP), '删除接口:连同映射/设备绑定一起清掉')

/* ═════════ ③ 界面(CDP) ═════════ */
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-erp-integ-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1680,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
try {
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const raw = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 80; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(2000); return } } }
  await send('Page.enable'); await send('Runtime.enable')

  await nav(`${APP}/#/login`); await sleep(1200)
  await raw(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
             localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.j.data.user))});
             localStorage.setItem('mes_collapsed', '0');
             localStorage.setItem('mes_menu_mode', 'accordion'); 'ok'`)
  await nav('about:blank')
  await nav(`${APP}/#/dashboard`); await sleep(3500)

  // 左侧菜单:「ERP系统集成」一级目录 + 二级「集成管理」
  let groups = []
  for (let i = 0; i < 30; i++) {
    await sleep(400)
    groups = (await raw(`[...document.querySelectorAll('.leftnav .nav-group')].map(e=>e.innerText.trim())`)) || []
    if (groups.includes('ERP系统集成')) break
  }
  check(groups.includes('ERP系统集成'), `左栏一级目录含 ERP系统集成(${JSON.stringify(groups)})`)

  await raw(`location.hash = '#/erp/integConfig'; 'ok'`)
  await sleep(5000)
  const title = await raw(`document.querySelector('.ei-title')?.innerText.trim()`)
  check(title === 'ERP集成配置清单', `页面标题 = ${title}`)
  const tabs = await raw(`[...document.querySelectorAll('.ei-tabs .el-tabs__item')].map(e=>e.innerText.trim())`)
  check((tabs || []).length === 2 && tabs[0].startsWith('导入') && tabs[1].startsWith('转出'), `页签 = ${JSON.stringify(tabs)}`)
  const cats = await raw(`[...document.querySelectorAll('.ei-cat .cat-name')].map(e=>e.innerText.trim())`)
  check(JSON.stringify(cats) === JSON.stringify(['基础资料', '单据', '设备']), `分类栏 = ${JSON.stringify(cats)}`)
  const cards = await raw(`document.querySelectorAll('.ei-card').length`)
  check(cards > 0, `导入页签接口卡片 ${cards} 张`)
  const mapRows = await raw(`document.querySelectorAll('.map-table .el-table__body tr.el-table__row').length`)
  check(mapRows > 0, `字段映射表渲染 ${mapRows} 行`)
  const devRows = await raw(`document.querySelectorAll('.dev-table .el-table__body tr.el-table__row').length`)
  console.log(`      当前接口已绑定设备行数 = ${devRows}`)
  const shot1 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, '_shot-erp-integ-import.png'), Buffer.from(shot1.result.data, 'base64'))

  // 切到转出页签:卡片应换成 7 张单据 + 基础资料/设备
  const clicked = await raw(`(() => {
    const t = [...document.querySelectorAll('.ei-tabs .el-tabs__item')].find(e => e.innerText.includes('转出'));
    if (!t) return false; t.click(); return true;
  })()`)
  check(clicked === true, '点击「转出」页签')
  await sleep(1800)
  const cards2 = await raw(`[...document.querySelectorAll('.ei-card .card-name')].map(e=>e.innerText.trim())`)
  check((cards2 || []).includes('采购入库单转出'), `转出页签(单据分类)卡片 = ${JSON.stringify(cards2)}`)
  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, '_shot-erp-integ-export.png'), Buffer.from(shot2.result.data, 'base64'))

  /* ═════════ ④ 多语言走查(切 en / ja,界面文案不得留中文;接口名/目标对象是业务数据,本就不翻) ═════════ */
  const CJK = /[\u4e00-\u9fa5]/
  const readChrome = async () => ({
    title: await raw(`document.querySelector('.ei-title')?.innerText.trim()`),
    tabs: (await raw(`[...document.querySelectorAll('.ei-tabs .el-tabs__item')].map(e=>e.innerText.trim())`)) || [],
    cats: (await raw(`[...document.querySelectorAll('.ei-cat .cat-name')].map(e=>e.innerText.trim())`)) || [],
    blocks: (await raw(`[...document.querySelectorAll('.block-title')].map(e=>e.childNodes[1]?.textContent?.trim() || e.innerText.split('\\n')[0].trim())`)) || [],
    labels: (await raw(`[...document.querySelectorAll('.fi-label')].map(e=>e.innerText.replace('*','').trim())`)) || [],
    buttons: (await raw(`[...document.querySelectorAll('.ei-block .block-head button, .ei-head-actions button, .ei-list-head button')].map(e=>e.innerText.trim())`)) || [],
  })
  const expectEn = {
    title: 'ERP Integration Config',
    tabs: ['Import (11)', 'Export (12)'],
    cats: ['Master data', 'Documents', 'Equipment'],
  }
  const expectJa = {
    title: 'ERP連携設定一覧',
    tabs: ['インポート (11)', 'エクスポート (12)'],
    cats: ['基本情報', '伝票', '設備'],
    // 日文本身含汉字,不能拿 CJK 区间当"残留中文"判据 ⇒ 直接比对本页应显示的日文全部文案
    blocks: ['インターフェース情報', '対応設備', '項目マッピング'],
    labels: ['インターフェース名', 'インターフェースコード', '分類', '提供元', 'メソッド', '実行契機',
      'エンドポイント', 'MESパネル', 'ERP対象', '並び順', '有効', '説明'],
    buttons: ['更新', 'インターフェース追加', 'インターフェースを保存', '設備を保存',
      'パネル項目から展開', '行を追加', 'マッピングを保存'],
  }
  for (const [loc, exp] of [['en', expectEn], ['ja', expectJa]]) {
    // ⚠ 走**真实切换器**:直接写 localStorage 再整页重载时,ja 这类非 SUPPORTED 的 locale
    //   在 detectLocale() 里会被判回 zh-CN(pack 不加载),只有 store.set() 才会 ensureLocalePack ⇒ 会误判。
    await raw(`document.querySelector('.locale-switch')?.click(); 'ok'`)
    await sleep(700)
    const picked = await raw(`(() => {
      const items = [...document.querySelectorAll('.el-dropdown-menu__item')];
      const hit = items.find(e => e.innerText.includes('(${loc})'));
      if (!hit) return false; hit.click(); return true;
    })()`)
    check(picked === true, `[${loc}] 语言切换器点开并选中 (${loc})`)
    await sleep(3000)
    const got = await readChrome()
    check(got.title === exp.title, `[${loc}] 页面标题 = ${got.title}`)
    check(JSON.stringify(got.tabs) === JSON.stringify(exp.tabs), `[${loc}] 页签 = ${JSON.stringify(got.tabs)}`)
    check(JSON.stringify(got.cats) === JSON.stringify(exp.cats), `[${loc}] 分类栏 = ${JSON.stringify(got.cats)}`)
    if (loc === 'ja') {
      for (const key of ['blocks', 'labels', 'buttons']) {
        check(JSON.stringify(got[key]) === JSON.stringify(exp[key]), `[${loc}] ${key} 全为日文(${JSON.stringify(got[key])})`)
      }
    } else {
      const cnBlocks = got.blocks.filter((t) => CJK.test(t))
      check(cnBlocks.length === 0, `[${loc}] 区块标题无中文残留(${JSON.stringify(got.blocks)})`)
      const cnLabels = got.labels.filter((t) => CJK.test(t))
      check(cnLabels.length === 0, `[${loc}] 字段标签无中文残留(${JSON.stringify(got.labels)})`)
      const cnButtons = got.buttons.filter((t) => CJK.test(t))
      check(cnButtons.length === 0, `[${loc}] 按钮文案无中文残留(${JSON.stringify(got.buttons)})`)
    }
  }
  // 切回中文(下一位用户打开就是中文界面)
  await raw(`document.querySelector('.locale-switch')?.click(); 'ok'`)
  await sleep(600)
  await raw(`(() => {
    const hit = [...document.querySelectorAll('.el-dropdown-menu__item')].find(e => e.innerText.includes('简体中文'));
    if (hit) hit.click(); return !!hit;
  })()`)
  await sleep(1500)
} finally {
  edge.kill()
}
console.log(fail ? `\n${fail} 项未通过` : '\n全部通过')
process.exit(fail ? 1 : 0)
