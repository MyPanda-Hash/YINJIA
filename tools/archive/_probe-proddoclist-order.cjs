'use strict'
/**
 * _probe-proddoclist-order.cjs — 产品文件列表(RD_PROD_DOCLIST)列序按设计复刻的验证探针(2026-09-30)
 *
 * 设计源:《产品开发系统需求汇总.xlsx》sheet「文件汇总表」第 8/9 行:
 *   表头 B8:M8 = 产品编号 | 文件1 | 状态 | 文件2 | 状态 | 文件3 | 状态 | 文件4 | 状态 | 产品负责人 | 是否受控 | 受控日期
 *   数据 B9:M9 = C-95-33 | **规格书** | 编写/已审核 | **成型工艺清单** | … | **组装工艺清单** | … | **出货控制计划** | … | xxx | 是 | 日期
 *   ⇒ 四个文件列的顺序 = 规格书 → 成型工艺清单 → 组装工艺清单 → 出货检验计划表(=设计里的出货控制计划),
 *     表头一律叫「文件N」(文件名写在**数据格**里,不写在表头上)。
 *
 * 用法:node tools/archive/_probe-proddoclist-order.cjs [http://localhost:5173]
 *   界面层必须打 5173(前端源码改动不经 build 不进 8090 的打包产物);
 *   后端 DEV_PANELS 顺序是 Java 常量 ⇒ 改后端后**必须重新打包并重启 8090** 才会生效。
 *
 * 只读探针:不造数、不改库(prod 库已有 DEMO-A-001 / DEMO-B-001 两条已下发产品可供渲染)。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://localhost:5173'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9365
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const WANT_CODES = ['RD_SPEC_DOC', 'RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_INSP_PLAN']
const WANT_NAMES = ['规格书', '成型工艺清单', '组装工艺清单', '出货检验计划表']
const WANT_HEAD = ['产品编号', '文件1', '状态', '文件2', '状态', '文件3', '状态', '文件4', '状态', '产品负责人', '是否受控', '受控日期']

let pass = 0
let fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }

let ev = null

async function api(pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const lr = await api('/api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456' } })
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败: ' + JSON.stringify(lr).slice(0, 300))

  console.log('\n① 后端:/api/px/prodDocList 的列序(真源 = DevTaskService.DEV_PANELS 顺序)')
  const res = await api('/api/px/prodDocList', { token })
  const columns = res?.data?.columns || []
  check('列序 = 规格书 → 成型工艺清单 → 组装工艺清单 → 出货检验计划表',
    JSON.stringify(columns.map((c) => c.panelCode)) === JSON.stringify(WANT_CODES),
    JSON.stringify(columns.map((c) => c.panelCode)))
  check('列显示名与之一致', JSON.stringify(columns.map((c) => c.panelName)) === JSON.stringify(WANT_NAMES),
    JSON.stringify(columns.map((c) => c.panelName)))
  const rows = res?.data?.rows || []
  check(`矩阵有数据行可看(实得 ${rows.length} 行)`, rows.length > 0, String(rows.length))

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pdl-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res2, rej) => { ws.onopen = res2; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res2) => { const id = ++seq; pending.set(id, res2); ws.send(JSON.stringify({ id, method, params })) })
    ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result?.result?.value
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 120; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } }
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (r.result?.data) { fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64')); console.log('  📷 ' + name) }
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1200, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_PROD_DOCLIST`)
    await sleep(3000)

    console.log('\n② 界面:表头行(设计第 8 行)')
    const parse = (s) => { try { return JSON.parse(s || '[]') } catch { return [] } }
    const head = parse(await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.pds-table thead th')).map(function(t){return t.textContent.trim()}))`))
    check('表头 = 产品编号 | 文件1 | 状态 | 文件2 | 状态 | 文件3 | 状态 | 文件4 | 状态 | 产品负责人 | 是否受控 | 受控日期',
      JSON.stringify(head) === JSON.stringify(WANT_HEAD), JSON.stringify(head))

    console.log('\n③ 界面:数据行的文件格(设计第 9 行:文件名写在数据格里)')
    const body = parse(await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.pds-table tbody tr')).filter(function(tr){return tr.querySelectorAll('td').length>3}).map(function(tr){return [].slice.call(tr.querySelectorAll('td')).map(function(td){return td.textContent.replace(/\\s+/g,' ').trim()})}))`))
    if (body.length) {
      const files = body[0].filter((_, i) => i >= 1 && i <= 8 && i % 2 === 1)
      check('数据行前 4 个文件格 = 规格书 / 成型工艺清单 / 组装工艺清单 / 出货检验计划表',
        JSON.stringify(files) === JSON.stringify(WANT_NAMES), JSON.stringify(files))
      check('每对文件格后面紧跟状态格', body[0].slice(1, 9).filter((_, i) => i % 2 === 1).every((s) => /未开发|开发中|开发审核中|开发完毕|—/.test(s)), JSON.stringify(body[0].slice(1, 9)))
    } else {
      check('矩阵有数据行', false, '页面没有数据行(空态)——检查 rd_dev_task 是否还有已下发产品')
    }
    await shot('proddoclist-cols.png')
  } finally {
    try { if (ws) ws.close() } catch {}
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('探针异常: ' + (e && e.stack ? e.stack : e)); process.exit(2) })
