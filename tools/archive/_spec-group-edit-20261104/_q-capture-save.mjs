/**
 * _q-capture-save.mjs —— 抓「保存」请求的载荷,看检验项目/子项的改动有没有进去(2026-11-04)
 *
 * 前一个探针证明打字不被回弹,但点保存后库里没变。
 * 本探针在页面里劫持 fetch,把 callButton(保存) 的 body 截下来,直接看 detail.items 里那一行。
 *
 * 用法:node _q-capture-save.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = 'ZZ-PROBE-SPEC'

async function main() {
  const s = await launch({ port: 9547 })
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

  // ① 劫持 fetch / XHR,把「保存」那次请求的 body 存到 window.__cap
  await s.evaluate(`(() => {
    window.__cap = []
    if (!window.__origFetch) window.__origFetch = window.fetch
    window.fetch = async function(...args) {
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || ''
        const opt = args[1] || {}
        if (/callButton/.test(url) && opt.body) {
          window.__cap.push({ url, body: String(opt.body) })
        }
      } catch (e) {}
      return window.__origFetch.apply(this, args)
    }
    return true
  })()`)

  // ② 改组名
  const typed = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    const t=tas[0]
    if(!t) return {ok:false}
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(t,'CAP_组名')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, now:t.value}
  })()`)
  console.log('改组名 = ' + JSON.stringify(typed))
  await sleep(1200)

  // ③ 点保存
  const saved = await s.evaluate(`(() => {
    const btns=[...document.querySelectorAll('button,[role=button],.as-side-btn,.tb-main')].filter(x=>x.offsetParent!==null)
    const b=btns.find(x=>/^保存$/.test((x.textContent||'').trim()))
    if(!b) return {ok:false}
    b.click(); return {ok:true}
  })()`)
  console.log('点保存 = ' + JSON.stringify(saved))
  await sleep(6000)

  // ④ 解析抓到的 body
  const cap = await s.evaluate(`(() => {
    const out = window.__cap.map(c => {
      let j = null
      try { j = JSON.parse(c.body) } catch (e) { return {parseErr:true, len:c.body.length} }
      const fd = j.formData || {}
      const items = fd.detail?.items || []
      return {
        buttonName: j.buttonName,
        itemCount: items.length,
        检验要求行: items.filter(r=>r['表区']==='检验要求').map(r=>({项目:r['检验项目'], 子项:r['检验子项']})),
      }
    })
    return { count: window.__cap.length, calls: out }
  })()`)
  console.log('抓到的保存请求 = ' + JSON.stringify(cap, null, 1))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })