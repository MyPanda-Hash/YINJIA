/**
 * _walk-draft-trace.cjs — 抓"点侧边栏保存为草稿"到底发了哪个 buttonName(网络层取证)
 *
 * 前一个探针(_walk-draft-novalidate)看到后端格式的拦截文案(字段用「、」连接),
 * 只有 markSaved=true 才会产生 ⇒ 要么点错了按钮,要么事件的冒泡把「保存」也触发了。
 * 本探针在页面里 hook window.fetch,记录所有 /px/callButton 请求的 buttonName 与响应,再逐个点击。
 * 用法:node tools/archive/_walk-draft-trace.cjs [面板码]
 */
'use strict'
const { execFileSync } = require('node:child_process')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = process.argv[2] || 'RD_SOAK'
const HEAD = 'rd_soak_head'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

;(async () => {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data ? login.data.token : login.token
  const user = JSON.stringify(login.data ? login.data.user : {})

  const s = await launch({ port: 9442 })
  let docNo = ''
  try {
    await s.navigate(BASE + '/#/login', 2200)
    await s.evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});'ok'`)
    await s.navigate('about:blank', 400)
    await s.navigate(`${BASE}/#/panelx/list/${PANEL}`, 1800)
    for (let i = 0; i < 30; i++) {
      const n = await s.evaluate(`document.querySelectorAll('.as-side-btn').length`)
      if (typeof n === 'number' && n > 0) break
      await sleep(600)
    }

    // hook XHR(前端走 axios/XHR,不是 fetch —— 第一版只 hook fetch,__trace 全空)
    await s.evaluate(`(() => {
      if (window.__traceHooked) return 'already'
      window.__traceHooked = true
      window.__trace = []
      const XO = XMLHttpRequest.prototype.open
      const XS = XMLHttpRequest.prototype.send
      XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return XO.apply(this, arguments) }
      XMLHttpRequest.prototype.send = function (body) {
        const rec = { url: String(this.__u || ''), body: String(body == null ? '' : body).slice(0, 300), status: 0, resp: '' }
        this.addEventListener('load', () => {
          rec.status = this.status
          try { rec.resp = String(this.responseText || '').slice(0, 200) } catch (e) { rec.resp = '(不可读)' }
        })
        if (/callButton|saveForm/.test(rec.url)) window.__trace.push(rec)
        return XS.apply(this, arguments)
      }
      return 'hooked'
    })()`)

    const clearMsgs = `document.querySelectorAll('.el-message').forEach((e) => e.remove());window.__trace.length = 0;'ok'`
    const msgs = `[...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\\s+/g, '')).join(' | ')`

    // 侧边栏按钮清单 + 每个候选(主按钮/子项)的类名与父级关系 —— 冒泡问题一看便知
    const dom = await s.evaluate(`(() => [...document.querySelectorAll('.as-side-btn')].map((b) => ({
      text: (b.textContent || '').replace(/\\s+/g, ''),
      cls: b.className,
      tag: b.tagName,
      parentCls: b.parentElement ? b.parentElement.className : '',
      grandCls: b.parentElement && b.parentElement.parentElement ? b.parentElement.parentElement.className : '',
      inSideBtn: !!b.closest('.as-side-btn:not(.' + (b.className || '').trim().replace(/\\s+/g, '.') + ')'),
    })))()`)
    console.log('侧边栏按钮 DOM:')
    for (const d of dom) {
      if (!/保存/.test(d.text)) continue
      console.log(`  text=${JSON.stringify(d.text)} tag=${d.tag} cls=${JSON.stringify(d.cls)} parent=${JSON.stringify(d.parentCls)} grand=${JSON.stringify(d.grandCls)}`)
    }

    console.log('')
    console.log('① 点击「新增」')
    await s.evaluate(clearMsgs)
    await s.evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent||'').replace(/\\s+/g,'') === '新增'); b && b.click(); return !!b })()`)
    await sleep(2000)
    docNo = sql(`SELECT TOP 1 ISNULL(单据编号,'') FROM ${HEAD} ORDER BY id DESC`)
    const t1 = await s.evaluate(`JSON.stringify(window.__trace)`)
    console.log(`   单据=${docNo}`)
    console.log(`   请求=${t1}`)

    console.log('')
    console.log('② 点击「保存为草稿」')
    await s.evaluate(clearMsgs)
    const clickedSub = await s.evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent||'').replace(/\\s+/g,'') === '保存为草稿'); if (!b) return 'notfound'; b.click(); return b.className })()`)
    await sleep(2500)
    const t2 = await s.evaluate(`JSON.stringify(window.__trace)`)
    const m2 = await s.evaluate(msgs)
    console.log(`   命中元素 class=${clickedSub}`)
    console.log(`   请求=${t2}`)
    console.log(`   提示=${JSON.stringify(m2)}`)

    console.log('')
    console.log('③ 点击「保存」')
    await s.evaluate(clearMsgs)
    const clickedMain = await s.evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent||'').replace(/\\s+/g,'') === '保存'); if (!b) return 'notfound'; b.click(); return b.className })()`)
    await sleep(2500)
    const t3 = await s.evaluate(`JSON.stringify(window.__trace)`)
    const m3 = await s.evaluate(msgs)
    console.log(`   命中元素 class=${clickedMain}`)
    console.log(`   请求=${t3}`)
    console.log(`   提示=${JSON.stringify(m3)}`)
  } finally {
    s.close()
  }

  if (docNo) {
    sql(`DELETE FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${docNo}';
         DELETE FROM ${HEAD} WHERE 单据编号='${docNo}';`)
    console.log(`已清理 ${docNo}`)
  }
})().catch((e) => { console.error('探针异常:', e.stack || e.message); process.exit(1) })
