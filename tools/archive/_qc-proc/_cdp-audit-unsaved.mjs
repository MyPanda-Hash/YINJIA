/**
 * _cdp-audit-unsaved.mjs — 「未保存就点审核」的**回归探针**(2026-10-17 用户报障)。
 *
 * 用户口径:「当前未保存可以直接审核,出现错误,参考其他的页面实现形式的审核模式进行处理修复」。
 * 复现到的真相(修复前):点「审核」时前端会先**静默保存**一次(审批必须基于库里数据),
 *   新单是空的 ⇒ 保存没过必填校验 ⇒ 只弹一句「请至少添加一行明细」,用户不知道自己点的是审核、
 *   也不知道要先补什么。修复:审批动作的预保存带 `reason` ⇒ 提示变成
 *   「审核前需先保存：请至少添加一行明细」,并且**只有保存成功才继续审核**。
 *
 * 断言(全在**测试账套** YJ_TEST 上真点,跑完清理探针单):
 *   ① 新增 → 什么都不填 → 点审核:提示归因到审核、且单据**没有被误审**(仍是草稿);
 *   ② 新增 → 加一行检验项并填内容(**不点保存**)→ 点审核:自动落库后审核成功(状态=已审核),
 *      接口序必须是「保存 → 审核」;
 *   ③ 弃审 → 回草稿;清理(删除)掉探针单。
 *
 * 用法:node tools/archive/_qc-proc/_cdp-audit-unsaved.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from '../../node_modules/ws/index.js'

const base = process.argv[2] || 'http://127.0.0.1:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const head = b64({ alg: 'HS256' })
const body = b64({ sub: 'admin', factory: 'YJ_TEST', iat: now, exp: now + 6 * 3600 })   // ⚠ 固定测试账套
const token = `${head}.${body}.${crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`

const fail = []
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`PASS ${name}${extra ? ' — ' + extra : ''}`)
  else { fail.push(name); console.log(`FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}

const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1800,1100',
    '--remote-debugging-port=9392', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'audit-unsaved-')), 'about:blank'],
  { stdio: 'ignore' })

const api = []
const logs = []
let ws
let ev
const created = []
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
  const reqUrl = new Map()
  ws.onmessage = async (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Network.requestWillBeSent' && /callButton/.test(m.params.request.url)) {
      reqUrl.set(m.params.requestId, m.params.request.url)
    }
    if (m.method === 'Network.responseReceived' && reqUrl.has(m.params.requestId)) {
      const rid = m.params.requestId
      reqUrl.delete(rid)
      try {
        const r = await send('Network.getResponseBody', { requestId: rid })
        api.push(String(r.result?.body || '').replace(/\s+/g, ' '))
      } catch { /* 取不到就算了 */ }
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('exception: ' + (m.params.exceptionDetails?.exception?.description || '').split('\n')[0])
    }
  }
  const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw Error(JSON.stringify(r.result.exceptionDetails))
    return r.result?.result?.value
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Page.navigate', { url: base + '/#/login' })
  await sleep(1500)
  await ev(`localStorage.setItem('mes_token',${JSON.stringify(token)});localStorage.setItem('mes_user',${JSON.stringify(JSON.stringify({ userName: 'admin', realName: '系统管理员', isAdmin: true }))});localStorage.setItem('mes_init_done','1');localStorage.setItem('mes_locale','zh-CN')`)
  await send('Page.navigate', { url: 'about:blank' })
  await sleep(200)
  await send('Page.navigate', { url: `${base}/#/panelx/list/QC_PROC_INSP` })
  await sleep(6500)
  await ev(`(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach(b => b.click()); return 1 })()`)
  await sleep(300)

  const clickSide = (text) => ev(`(() => {
    const b = [...document.querySelectorAll('.as-side-btn, .as-side-menu-item')].find(x => (x.innerText||'').trim() === ${JSON.stringify(text)})
    if (!b || b.classList.contains('disabled')) return false
    b.click(); return true
  })()`)
  const status = () => ev(`(() => { const s = document.querySelector('.as-side-status-row .doc-status'); return s ? s.innerText.trim() : '' })()`)
  // 单号:纸张表抬头里的「单据编号」是输入框(草稿态可编辑);取不到再从纸面文本里正则兜底
  const docNo = () => ev(`(() => {
    const vals = [...document.querySelectorAll('.qr-sheet input, .qr-sheet textarea')].map(i => String(i.value || ''))
    const hit = vals.find(v => /^ZC-\\d{4}-\\d{2}-\\d{4}$/.test(v))
      || ((document.querySelector('.qr-sheet') || document.body).innerText.match(/ZC-\\d{4}-\\d{2}-\\d{4}/) || [''])[0]
    return hit || ''
  })()`)
  const toasts = () => ev(`[...document.querySelectorAll('.el-message')].map(e => (e.innerText||'').replace(/\\s+/g,' ').trim()).filter(Boolean)`)
  const confirmBox = () => ev(`(() => {
    const d = document.querySelector('.el-message-box')
    if (!d) return 'no-box'
    const b = [...d.querySelectorAll('.el-button')].find(x => /确认|确定|OK|Confirm/i.test(x.innerText||''))
    if (b) { b.click(); return 'clicked' }
    return 'no-btn'
  })()`)
  const mark = () => api.length

  // ── ① 新增 → 空单直接审核:提示要归因到「审核前需先保存」,且不得误审 ──
  ok('侧栏有「审核」入口', await ev(`!![...document.querySelectorAll('.as-side-btn')].find(b => (b.innerText||'').trim() === '审核')`))
  ok('点新增', await clickSide('新增'))
  await sleep(4000)
  const noA = await docNo()
  if (noA) created.push(noA)
  ok('新增后状态 = 草稿', (await status()) === '草稿', `状态=${await status()} 单据=${noA}`)
  const a0 = mark()
  await clickSide('审核')
  await sleep(1200)
  await confirmBox()
  await sleep(3000)
  const toastA = await toasts()
  ok('空单点审核:提示归因到审核动作(「审核前需先保存」)',
    toastA.some((t) => /审核前需先保存/.test(t)), JSON.stringify(toastA))
  ok('空单点审核:没有被误审(状态仍是草稿)', (await status()) === '草稿', `状态=${await status()}`)
  ok('空单点审核:确实没有发出审核请求', api.slice(a0).every((b) => !/"已审核"/.test(b)), `api=${api.slice(a0).length} 次`)

  // ── ② 新增 → 加一行并填内容(不点保存)→ 审核:自动落库后审核成功 ──
  ok('点新增(第二张)', await clickSide('新增'))
  await sleep(4000)
  const noB = await docNo()
  if (noB) created.push(noB)
  const filled = await ev(`(() => {
    const add = [...document.querySelectorAll('.qr-band-act2')].find(x => /新增检验项/.test(x.innerText))
    if (add) add.click()
    return 1
  })()`)
  await sleep(600)
  const typed = await ev(`(() => {
    const tr = [...document.querySelectorAll('.qr-grid tbody tr')].pop()
    const el = tr && tr.querySelector('td.c-req textarea, td.c-req input')
    if (!el) return 'no-cell'
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, '探针-未保存直接审核')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return el.value
  })()`)
  ok('第二张:加了一行并填了检验要求', filled === 1 && typed === '探针-未保存直接审核', `填=${typed} 单据=${noB}`)
  const b0 = mark()
  await clickSide('审核')
  await sleep(1200)
  await confirmBox()
  await sleep(4000)
  const calls = api.slice(b0)
  ok('不点保存直接审核:先落库再审核(接口序 保存 → 审核)',
    calls.length >= 2 && /"单据状态":"草稿"/.test(calls[0]) && /"单据状态":"已审核"/.test(calls[calls.length - 1]),
    calls.map((c) => (c.match(/"单据状态":"[^"]*"/) || [''])[0]).join(' → '))
  ok('不点保存直接审核:状态变为已审核', (await status()) === '已审核', `状态=${await status()}`)

  // ── ③ 弃审 → 回草稿 ──
  ok('点弃审', await clickSide('弃审'))
  await sleep(1200)
  await confirmBox()
  await sleep(3000)
  ok('弃审后回到草稿', (await status()) === '草稿', `状态=${await status()}`)
  ok('全程无 JS 异常', logs.length === 0, logs.join(' | ').slice(0, 200))
} catch (e) {
  console.log('PROBE ERROR: ' + (e?.stack || e))
  fail.push('probe')
} finally {
  // 清理:探针单全部软删(已审核的先弃审,否则删除会被拒)
  for (const no of created) {
    try {
      await fetch(`${base.replace(/:\d+$/, ':8090')}/api/px/callButton`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ panelCode: 'QC_PROC_INSP', buttonName: '弃审', formData: { 编号: no }, buttonParam: {} }),
      })
      await fetch(`${base.replace(/:\d+$/, ':8090')}/api/px/callButton`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ panelCode: 'QC_PROC_INSP', buttonName: '删除', formData: { 编号: no }, buttonParam: {} }),
      })
      console.log(`  已清理探针单 ${no}`)
    } catch { /* 清理失败不判失败 */ }
  }
  try { ws?.close() } catch {}
  edge.kill()
  console.log(fail.length ? `\n=== 失败 ${fail.length} 项: ${fail.join(', ')} ===` : '\n=== 全部通过 ===')
  process.exit(fail.length ? 1 : 0)
}
