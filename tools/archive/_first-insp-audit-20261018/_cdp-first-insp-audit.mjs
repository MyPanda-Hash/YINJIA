/**
 * _cdp-first-insp-audit.mjs — 首件检验单「审核」入口的**界面只读断言**(CDP)。
 *
 * 2026-10-18 用户口径:「为当前的首件检验单增加审核功能,审核功能实现参照当前的制程检验单」。
 * 本探针**只读**:打开面板 → 看侧栏有没有「审核 / 弃审 / 审批情况」、纸面表尾有没有「审核人」格、
 * 置灰是否随单据状态、非管理员是否**看不到**直审入口。
 *
 * ⚠ 绝不点「审核 / 弃审」(页面可能连着正式账套)—— 真正的落库往返由同目录的
 *   `_api-first-insp-audit.mjs` 在**测试账套**上跑(15 项)。
 *
 * 用法:node tools/archive/_first-insp-audit-20261018/_cdp-first-insp-audit.mjs [baseUrl] [--shot 前缀]
 *   默认 baseUrl = http://127.0.0.1:5173(vite 源码即时生效;要验 8090 那份打包前端就传 http://127.0.0.1:8090)
 * ⚠ Edge 坑:--headless=new 会塞 edge://sync-confirmation-dialog,取页要过滤 ^edge://。
 * ⚠ el-dialog 关闭后 DOM 仍在(visibility 判"开没开"),见开发与质量.md §5.5。
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from '../../node_modules/ws/index.js'

const args = process.argv.slice(2)
const base = args.find((a) => /^https?:\/\//.test(a)) || 'http://127.0.0.1:5173'
const shotIdx = args.indexOf('--shot')
const shotPrefix = shotIdx >= 0 ? (args[shotIdx + 1] || '_shot-first-insp-audit') : ''
const panel = 'QC_FIRST_INSP'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const factory = process.env.YJ_PROBE_FACTORY || 'YJ'
const now = Math.floor(Date.now() / 1000)
const mkToken = (user) => {
  const h = b64({ alg: 'HS256' })
  const b = b64({ sub: user, factory, iat: now, exp: now + 6 * 3600 })
  return `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`
}
const token = mkToken('admin')

const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1800,1100',
    '--remote-debugging-port=9392', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'fi-audit-')), 'about:blank'],
  { stdio: 'ignore' })

let ws
const fail = []
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`PASS ${name}${extra ? ' — ' + extra : ''}`)
  else { fail.push(name); console.log(`FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}

try {
  let tab
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch('http://127.0.0.1:9392/json/list').then((r) => r.json())
      tab = list.find((t) => t.type === 'page' && !/^edge:/.test(t.url)) || null
      if (!tab) tab = await fetch('http://127.0.0.1:9392/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
      break
    } catch { await sleep(250) }
  }
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let n = 0
  const pending = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw Error(JSON.stringify(r.result.exceptionDetails))
    return r.result?.result?.value
  }
  const shot = async (name) => {
    if (!shotPrefix) return
    const r = await send('Page.captureScreenshot', { format: 'png' })
    const data = r?.result?.data
    if (data) fs.writeFileSync(`${shotPrefix}-${name}.png`, Buffer.from(data, 'base64'))
  }
  await send('Page.enable')

  /** 以指定账号身份打开本面板(管理员 = isAdmin:true;非管理员用 cp) */
  async function openAs(user, isAdmin) {
    await send('Page.navigate', { url: base + '/#/login' })
    await sleep(1500)
    await ev(`localStorage.setItem('mes_token',${JSON.stringify(mkToken(user))});`
      + `localStorage.setItem('mes_user',${JSON.stringify(JSON.stringify({ userName: user, realName: user, isAdmin }))});`
      + `localStorage.setItem('mes_init_done','1');localStorage.setItem('mes_locale','zh-CN')`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(200)
    await send('Page.navigate', { url: `${base}/#/panelx/list/${panel}` })
    await sleep(6500)
    await ev(`(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach(b => b.click()); return 1 })()`)
    await sleep(400)
  }

  const sideInfo = () => ev(`(() => {
    const btns = [...document.querySelectorAll('.approval-side .as-side-btn, .approval-side .as-side-btn.sub')]
    const txt = (b) => (b.innerText || '').trim()
    const st = document.querySelector('.as-side-status-row .doc-status')
    return {
      all: btns.map(txt),
      audit: btns.filter((b) => txt(b) === '审核').length,
      unaudit: btns.filter((b) => txt(b) === '弃审').length,
      history: btns.filter((b) => txt(b) === '审批情况').length,
      auditDisabled: btns.filter((b) => txt(b) === '审核').map((b) => b.classList.contains('disabled')),
      unauditDisabled: btns.filter((b) => txt(b) === '弃审').map((b) => b.classList.contains('disabled')),
      status: st ? st.innerText.trim() : '',
      sheet: !!document.querySelector('.fi-sheet'),
    }
  })()`)

  // ── ① 管理员:直审入口在、纸面表尾有「审核人」格 ──
  await openAs('admin', true)
  const a = await sideInfo()
  console.log(JSON.stringify(a))
  ok('首件检验单纸张表渲染(.fi-sheet)', a.sheet === true)
  ok('侧栏有「审核」入口(管理员)', a.audit === 1, a.all.join(' | '))
  ok('侧栏有「弃审」入口(管理员)', a.unaudit === 1)
  ok('侧栏有「审批情况」(看审核记录)', a.history >= 1)
  ok('置灰与单据状态一致(草稿:可审核、不可弃审 / 已审核:反之)',
    a.status === '已审核' ? (a.auditDisabled[0] === true && a.unauditDisabled[0] === false)
      : (a.auditDisabled[0] === false && a.unauditDisabled[0] === true),
    `状态=${a.status} 审核置灰=${a.auditDisabled} 弃审置灰=${a.unauditDisabled}`)

  const foot = await ev(`(() => {
    const t = document.querySelector('.fi-foot')
    if (!t) return { err: 'no .fi-foot' }
    const tds = [...t.querySelectorAll('td')]
    const last = tds[tds.length - 1] || null
    return {
      labels: [...t.querySelectorAll('th')].map((th) => (th.innerText || '').trim()),
      cells: tds.map((td) => (td.innerText || '').trim()),
      // 「审核人」格 = 最后一个值格:必须只有纯文本(可编辑态下唯一该有的输入框是第 1 格「检验结果」)
      lastCellInputs: last ? last.querySelectorAll('input, textarea').length : -1,
      lastCellText: last ? (last.innerText || '').trim() : '',
      resultCellInputs: tds[0] ? tds[0].querySelectorAll('input, textarea').length : -1,
    }
  })()`)
  console.log(JSON.stringify(foot))
  ok('纸面表尾三格 = 检验结果 | 检验人 | 审核人',
    JSON.stringify(foot.labels) === JSON.stringify(['检验结果', '检验人', '审核人']), (foot.labels || []).join(' | '))
  ok('表尾「审核人」格只读纯文本(不是输入框)',
    foot.lastCellInputs === 0 && foot.resultCellInputs <= 1,
    `审核人格输入框=${foot.lastCellInputs} 检验结果格输入框=${foot.resultCellInputs}`)
  ok('表尾「审核人」格的值 = 虚拟字段 审核人(未审核 ⇒ 空)',
    a.status === '已审核' ? foot.lastCellText !== '' : foot.lastCellText === '',
    `状态=${a.status} 审核人='${foot.lastCellText}'`)
  // 截图前把表尾滚进视野(纸面很长,表尾默认在折线以下;不滚就只有断言没有画面证据)
  await ev(`(() => { const f = document.querySelector('.fi-foot'); if (f) f.scrollIntoView({ block: 'center' }); return 1 })()`)
  await sleep(500)
  await shot('admin')

  // ── ② 打开「审批情况」弹窗(只读,不点任何写动作) ──
  const opened = await ev(`(() => {
    const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find((x) => (x.innerText || '').trim() === '审批情况')
    if (!b) return false
    b.click(); return true
  })()`)
  await sleep(1200)
  const dlg = await ev(`(() => {
    const ds = [...document.querySelectorAll('.el-dialog')].filter((d) => d.getBoundingClientRect().height > 0)
    const d = ds[ds.length - 1]
    return d ? { title: (d.querySelector('.el-dialog__title') || {}).innerText || '', text: (d.innerText || '').slice(0, 200) } : null
  })()`)
  ok('「审批情况」能打开(只读弹窗)', opened === true && !!dlg, JSON.stringify(dlg))
  await shot('history')
  await ev(`(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach(b => b.click()); return 1 })()`)
  await sleep(300)

  // ── ③ 非管理员:直审入口必须**看不到**(与后端 audit() 仅管理员同口径) ──
  await openAs('cp', false)
  const b = await sideInfo()
  console.log(JSON.stringify(b))
  ok('非管理员看不到「审核」直审入口', b.audit === 0, b.all.join(' | '))
  ok('非管理员看不到「弃审」直审入口', b.unaudit === 0)
  await shot('nonadmin')

  ws.close()
} catch (e) {
  console.log('PROBE ERROR: ' + (e?.stack || e))
  fail.push('probe')
} finally {
  try { edge.kill() } catch {}
}
console.log(fail.length ? `\n=== 失败 ${fail.length} 项: ${fail.join(', ')} ===` : '\n=== 全部通过 ===')
process.exit(fail.length ? 1 : 0)
