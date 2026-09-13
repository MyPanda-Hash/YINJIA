/**
 * _walk-shot.cjs — 产品文件 7 面板走查截图(自动种演示数据 + CDP 截图)
 * 用法: node --experimental-websocket tools/_walk-shot.cjs [panelCode...]
 * 默认 7 面板;输出 tools/_walk/shots/<PC>[-pageN].png + DOM 摘要
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9341
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, '_walk', 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 前端 recordSheetConfigs(数据表分块/预置种子在前端配置;import 的 specTestLib 需内联展开为 CJS)
const cfgSrc = fs.readFileSync(path.join(__dirname, '../frontend/src/core/views/recordSheetConfigs.js'), 'utf8')
  .replace(/^import \{ SPEC_TEST_LIB \} from '\.\/specTestLib'\r?\n/m, '')
const libSrc = fs.readFileSync(path.join(__dirname, '../frontend/src/core/views/specTestLib.js'), 'utf8').replace(/export const SPEC_TEST_LIB =/, 'const SPEC_TEST_LIB =')
const tmpRsc = path.join(__dirname, '_walk', '_rsc-shot.cjs')
fs.writeFileSync(tmpRsc, libSrc + '\n' + cfgSrc.replace(/export const recordSheetConfigs\s*=/, 'const recordSheetConfigs =') + '\nmodule.exports = { recordSheetConfigs }\n', 'utf8')
const RSC = require(tmpRsc).recordSheetConfigs

const ARGV = process.argv.slice(2)
const NO_SEED = ARGV.includes('--no-seed')
const LOCALE_FLAG = ARGV.find((a) => a.startsWith('--locale='))
const LOCALE = LOCALE_FLAG ? LOCALE_FLAG.split('=')[1] : null
const PANELS = ARGV.filter((a) => !a.startsWith('--')).length ? ARGV.filter((a) => !a.startsWith('--')) : [
  'RD_PROD_INFO', 'RD_MOLD_PROC', 'RD_MOLD_FORMULA', 'RD_ASM_BOM', 'RD_ASM_PROC', 'RD_SPEC_DOC', 'RD_INSP_PLAN',
]

async function api(method, p, body, token) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

function sampleValue(f, extra) {
  if (extra && extra[f.dataName] !== undefined) return extra[f.dataName]
  const t = f.dataType || ''
  if (t.includes('日期')) return '2026-09-05'
  if (t.includes('下拉')) return f.dictSql ? (f.dictOptions?.[0] || '选项') : '选项'
  if (t.includes('数字')) return '10'
  return '样值'
}

async function seedPanel(panelCode, token) {
  const cfgRes = await api('GET', `/px/getPanelConfig?panelCode=${panelCode}`, null, token)
  const cfg = cfgRes.json?.data || cfgRes.json
  if (!cfg) return { err: 'no config ' + JSON.stringify(cfgRes.json).slice(0, 160) }
  const headFields = (cfg.dataSchema?.fields || []).filter((f) => !f.hidden)
  let detailFields = []
  const tabs = cfg.detail?.tabs || []
  const mainTab = tabs.find((t) => t.key === cfg.detailKey) || tabs[0]
  if (mainTab) detailFields = (mainTab.fields || []).filter((f) => !f.hidden)

  // 1) 空白草稿 → 拿单据编号
  const s1 = await api('POST', '/px/callButton', { panelCode, buttonName: '保存', formData: {}, buttonParam: {} }, token)
  const no = s1.json?.data?.['编号'] || s1.json?.data?.['单据编号']
  if (!no) return { err: 'blank save fail ' + JSON.stringify(s1.json).slice(0, 200) }

  // 2) 带演示数据保存
  const head = { 编号: no, 单据编号: no }
  const seedOverride = panelCode === 'RD_SPEC_DOC' ? { 规格书种类: RSC.RD_SPEC_DOC?.specTypes?.[0] || '飞利浦沐浴阻垢滤芯' } : {}
  for (const f of headFields) {
    if (f.dataName === '单据编号' || f.dataName === '编号') continue
    head[f.dataName] = sampleValue(f, seedOverride)
  }
  const items = detailFields.length ? [
    Object.fromEntries(detailFields.map((f) => [f.dataName, sampleValue(f)])),
    Object.fromEntries(detailFields.map((f) => [f.dataName, sampleValue(f)])),
  ] : []
  // 按数据表 filterKey/filterVal 分块补行(表区/检验类别 分块表的数据必须落块)
  for (const dt of (RSC[panelCode]?.dataTables || [])) {
    if (!dt.filterKey || !dt.filterVal) continue
    const r = { [dt.filterKey]: dt.filterVal }
    for (const f of detailFields) if (f.dataName !== dt.filterKey) r[f.dataName] = sampleValue(f)
    items.push(r)
  }
  const detail = { [cfg.detailKey || 'items']: items }
  const s2 = await api('POST', '/px/callButton', { panelCode, buttonName: '保存', formData: { ...head, detail }, buttonParam: {} }, token)
  return { no, status: s2.json?.data?.['单据状态'] || s2.status, cfgFields: headFields.length, detailFields: detailFields.length }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
  const token = login.json?.data?.token
  if (!token) throw new Error('login fail')
  const user = login.json.data.user
  console.log('[login] ok')

  for (const pc of PANELS) {
    if (NO_SEED) continue
    const seed = await seedPanel(pc, token)
    console.log(`[seed] ${pc}: ` + (seed.err ? seed.err : `no=${seed.no} status=${seed.status} head=${seed.cfgFields} detail=${seed.detailFields}`))
  }

  // Edge 截图
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-walk-'))
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    }
    const send = (method, params = {}) => new Promise((res) => {
      const id = ++seq
      pending.set(id, res)
      ws.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      return r.result?.result?.value
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) {
        await sleep(300)
        const ready = await evaluate('document.readyState')
        if (ready === 'complete') { await sleep(1200); return }
      }
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      const f = path.join(OUT, name + '.png')
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false })

    await navigate(`${FRONT}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date', '2026-09-05');${LOCALE ? ` localStorage.setItem('mes_locale', ${JSON.stringify(LOCALE)});` : ''} 'ok'`)
    await navigate('about:blank')

    for (const pc of PANELS) {
      await navigate(`${FRONT}/#/panelx/list/${pc}`)
      await sleep(2600)
      await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) { s.click(); return 'closed' } return 'none' })()`)
      await sleep(800)
      await shot(pc)
      await evaluate(`(() => { const el = document.querySelector('.approval-layout, .body, .rsp-wrap'); if (el) { el.scrollTop = el.scrollHeight; return el.scrollHeight } return 0 })()`)
      await sleep(700)
      await shot(pc + '-bottom')
      const info = await evaluate(`(() => {
        const sheet = document.querySelector('.rsp-sheet') || document.querySelector('.rs-dt') || document.querySelector('.approval-layout') || document.querySelector('.body')
        const err = [...document.querySelectorAll('.el-message--error')].map(e => e.textContent.trim()).join('|')
        const pageTabs = [...document.querySelectorAll('.rsp-page-tab, .rs-page-tab, .rs-pageitem')].map(e => e.textContent.trim()).filter(Boolean)
        return { has: !!sheet, err, pageTabs: pageTabs.slice(0, 10), text: sheet ? sheet.textContent.slice(0, 200).replace(/\\s+/g, ' ') : '' }
      })()`)
      console.log(`[shot] ${pc} → ${path.join(OUT, pc + '.png')}`)
      console.log('        ' + JSON.stringify(info))
      // 多页面板:逐页点击截图
      if (info.pageTabs && info.pageTabs.length > 1) {
        for (let i = 1; i < info.pageTabs.length; i++) {
          const ok = await evaluate(`(() => {
            const tabs = [...document.querySelectorAll('.rsp-page-tab, .rs-page-tab, .rs-pageitem')]
            const t = tabs[${i}]; if (!t) return false; t.click(); return true
          })()`)
          if (ok) { await sleep(900); await shot(pc + '-p' + (i + 1)) }
        }
      }
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
