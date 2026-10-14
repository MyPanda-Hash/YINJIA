#!/usr/bin/env node
/**
 * CDP 真实点击探针(2026-10-15)
 * 目的:制程检验单「＋新增检验项」点了没反应 —— 不再靠猜,用无头 Edge 真点一次,
 *       采:点击前的行数 / 点击后的行数 / 控制台报错 / 组件内部 detail.items 长度。
 *
 * 用法: node tools/archive/_qc-proc/_cdp-probe.mjs
 * 前提:8090 在跑;本机有 Edge。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9222
const BASE = 'http://127.0.0.1:8090'
const PANEL = 'QC_PROC_INSP'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' })

async function targets() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const list = await r.json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page
    } catch {}
    await sleep(250)
  }
  throw new Error('Edge CDP 未就绪')
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); this.logs = [] }
  static async open(url) {
    const ws = new WebSocket(url)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    const c = new CDP(ws)
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && c.waiting.has(m.id)) {
        const { res, rej } = c.waiting.get(m.id); c.waiting.delete(m.id)
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
      } else if (m.method === 'Runtime.consoleAPICalled') {
        c.logs.push('[console.' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails
        c.logs.push('[EXCEPTION] ' + (d.exception?.description || d.text))
      } else if (m.method === 'Log.entryAdded') {
        const e = m.params.entry
        if (e.level === 'error') c.logs.push('[log.error] ' + e.text)
      }
    }
    return c
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.waiting.set(id, { res, rej }))
  }
  async eval(expr, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr, awaitPromise, returnByValue: true, userGesture: true,
    })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }
}

try {
  const page = await targets()
  const c = await CDP.open(page.webSocketDebuggerUrl)
  await c.send('Runtime.enable')
  await c.send('Log.enable')
  await c.send('Page.enable')

  // ① 打开应用并注入登录态(用真实登录接口,不在脚本里存密码)
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(2500)
  const token = await c.eval(`(async()=>{
    const r = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userName:'admin',password:'123456'})});
    const j = await r.json();
    const d = j.data || j;
    localStorage.setItem('mes_token', d.token);
    if (d.user) localStorage.setItem('mes_user', JSON.stringify(d.user));
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0,10));
    if (d.factory) localStorage.setItem('mes_factory', JSON.stringify(d.factory));
    return d.token ? 'TOKEN_OK' : 'TOKEN_FAIL:'+JSON.stringify(j).slice(0,120);
  })()`)
  console.log('① 注入登录态 =', token)

  // ② 进面板
  await c.eval(`location.href = ${JSON.stringify('#/panelx/list/' + 'QC_PROC_INSP')}`).catch(()=>{})
  await c.send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` })
  await sleep(6000)

  // ③ 定位「新增检验项」按钮并点击,前后各采一次行数
  const state = await c.eval(`({url:location.href, title:document.title, body:(document.body.innerText||'').slice(0,300)})`)
  console.log('①b 页面状态 =', JSON.stringify(state))
  const probe = await c.eval(`(async()=>{
    const out = {};
    const btn = [...document.querySelectorAll('.qr-add-btn')][0];
    out.btnFound = !!btn;
    out.btnText = btn ? btn.textContent.trim() : null;
    const grid = document.querySelector('.qr-grid');
    out.gridFound = !!grid;
    const rows = () => document.querySelectorAll('.qr-grid tbody tr').length;
    const vals = () => [...document.querySelectorAll('.qr-grid tbody td .qr-cell-text')].length;
    out.rowsBefore = rows();
    out.cellsBefore = vals();
    out.emptyText = (document.querySelector('.qr-grid .c-empty')||{}).textContent || null;
    if (btn) {
      btn.click();
      await new Promise(r=>setTimeout(r,600));
      out.clicked = true;
      out.rowsAfter = rows();
      out.cellsAfter = vals();
      out.emptyTextAfter = (document.querySelector('.qr-grid .c-empty')||{}).textContent || null;
    }
    // 页面里能否读到 Vue 实例上的 detail.items
    try {
      const app = document.querySelector('#app')?.__vue_app__;
      out.hasApp = !!app;
    } catch(e) { out.appErr = String(e); }
    return out;
  })()`)

  console.log('② 探针结果:')
  for (const [k, v] of Object.entries(probe)) console.log(`   ${k} = ${JSON.stringify(v)}`)

  await sleep(500)
  if (c.logs.length) {
    console.log('③ 控制台输出:')
    for (const l of c.logs.slice(0, 25)) console.log('   ' + l)
  } else {
    console.log('③ 控制台:无输出')
  }
  console.log('\n结论: rowsBefore ->', probe.rowsBefore, ' rowsAfter ->', probe.rowsAfter,
    probe.rowsAfter > probe.rowsBefore ? '  ✅ 点得动' : '  ❌ 点击未产生新行')
} finally {
  try { edge.kill() } catch {}
}
