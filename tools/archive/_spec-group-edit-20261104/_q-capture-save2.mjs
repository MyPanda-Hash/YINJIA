/**
 * _q-capture-save2.mjs —— 用 axios 拦截器抓「保存」载荷(2026-11-04)
 *
 * 上一版劫持 window.fetch 抓不到 —— 前端用的是 axios。
 * 这里直接给 axios 挂 request 拦截器(从 window 上找实例),把 callButton 的 body 记下来。
 *
 * 用法:node _q-capture-save2.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = 'ZZ-PROBE-SPEC'

async function main() {
  const s = await launch({ port: 9549 })
  await s.navigate(BASE + '/#/login'); await sleep(4500)
  await s.evaluate(`(() => {
    const setV=(el,v)=>{const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
    const ins=[...document.querySelectorAll('input')];
    const a=ins.find(i=>(i.placeholder||'').includes('登录账号'))||ins[0];
    const p=ins.find(i=>i.type==='password'); setV(a,'admin');setV(p,'123456');return true })()`)
  await sleep(800)
  await s.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('进入系统')); b&&b.click(); return true })()`)
  await sleep(7000)

  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(DOC)}`)
  await sleep(11000)
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||'')); t&&t.click(); return true })()`)
  await sleep(2500)

  // 挂 XHR 钩子(axios 在浏览器里走 XMLHttpRequest)
  await s.evaluate(`(() => {
    window.__cap = []
    if (!window.__xhrPatched) {
      window.__xhrPatched = true
      const open = XMLHttpRequest.prototype.open
      const send = XMLHttpRequest.prototype.send
      XMLHttpRequest.prototype.open = function(m, u) { this.__u = u; return open.apply(this, arguments) }
      XMLHttpRequest.prototype.send = function(b) {
        try {
          if (/callButton/.test(this.__u || '') && b) window.__cap.push({ url: this.__u, body: String(b) })
        } catch (e) {}
        return send.apply(this, arguments)
      }
    }
    return true
  })()`)

  const typed = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    const t=tas[0]
    if(!t) return {ok:false}
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(t,'CAP2_组名')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, now:t.value}
  })()`)
  console.log('改组名 = ' + JSON.stringify(typed))
  await sleep(1200)

  const saved = await s.evaluate(`(() => {
    const btns=[...document.querySelectorAll('button,[role=button],.as-side-btn,.tb-main')].filter(x=>x.offsetParent!==null)
    const b=btns.find(x=>/^保存$/.test((x.textContent||'').trim()))
    if(!b) return {ok:false, cands:btns.map(x=>(x.textContent||'').trim()).filter(Boolean).slice(0,20)}
    b.click(); return {ok:true}
  })()`)
  console.log('点保存 = ' + JSON.stringify(saved))
  await sleep(7000)

  const cap = await s.evaluate(`(() => {
    const out = window.__cap.map(c => {
      let j=null
      try { j = JSON.parse(c.body) } catch (e) { return {parseErr:true, len:c.body.length} }
      const fd = j.formData || {}
      const items = fd.detail?.items || []
      return {
        buttonName: j.buttonName,
        itemCount: items.length,
        检验要求行: items.filter(r=>r['表区']==='检验要求').map(r=>({项目:r['检验项目'], 子项:r['检验子项'], 要求:String(r['检验要求']).slice(0,18)})),
      }
    })
    return { count: window.__cap.length, calls: out }
  })()`)
  console.log('抓到的保存请求 = ' + JSON.stringify(cap, null, 1))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })