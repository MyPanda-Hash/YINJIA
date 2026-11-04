/**
 * _q-open-archived-spec.mjs —— 打开指定规格书,看页 2 检验项目是否可编辑
 * 用法:node _q-open-archived-spec.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const DOC = process.argv[3] || 'SD-2026-11-0004'

async function main() {
  const s = await launch({ port: 9503 })
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

  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC`); await sleep(11000)

  // 用「查询单据」搜单号并打开
  const found = await s.evaluate(`(async () => {
    const t = localStorage.getItem('mes_token')
    const r = await fetch('/api/px/queryFormDataList', {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+t},
      body: JSON.stringify({panelCode:'RD_SPEC_DOC', keyword:${JSON.stringify(DOC)}, pageNo:1, pageSize:20})
    })
    const j = await r.json()
    const list = j?.data?.list || j?.data?.rows || []
    return {total: j?.data?.totalSize ?? list.length, first: list[0]?.['单据编号'] || null}
  })()`)
  console.log('查询结果 = ' + JSON.stringify(found))

  // 点列表第一行打开
  const opened = await s.evaluate(`(() => {
    const rows=[...document.querySelectorAll('.el-table__row, tr')].filter(r=>r.offsetParent!==null)
    const hit=rows.find(r=>(r.textContent||'').includes(${JSON.stringify(DOC)}))
    if(!hit) return {ok:false, count:rows.length}
    const td=[...hit.querySelectorAll('td')].find(t=>(t.textContent||'').includes(${JSON.stringify(DOC)}))||hit.querySelector('td')
    td && td.click()
    return {ok:true}
  })()`)
  console.log('打开 = ' + JSON.stringify(opened))
  await sleep(8000)

  const st = await s.evaluate(`(() => {
    const body=(document.body.innerText||'').replace(/\\s+/g,' ')
    const m=body.match(/单据编号：\\s*(\\S+)/)
    return {docno: m?m[1]:null, hasDraft: body.includes('草稿'), bodyStart: body.slice(0,180)}
  })()`)
  console.log('页首 = ' + JSON.stringify(st))

  // 切页 2
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||'')); t&&t.click(); return true })()`)
  await sleep(2500)

  const d = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const inputs=[...document.querySelectorAll('.rs-t input, .rs-t textarea')].filter(vis)
    const ro=[...document.querySelectorAll('.rs-t .rsp-cell')].filter(vis)
    const lib=[...document.querySelectorAll('.rs-lib-btn')].filter(vis)
    const rows=[...document.querySelectorAll('.rs-t tr')].filter(vis)
    const cells=[...document.querySelectorAll('.rs-t td')].filter(vis)
    return {
      inputCount: inputs.length,
      readonlyCellCount: ro.length,
      libBtn: lib.map(x=>x.textContent.trim()),
      visibleRows: rows.length,
      cellCount: cells.length,
      firstCells: cells.slice(0,12).map(td=>(td.textContent||'').trim().slice(0,16)),
    }
  })()`)
  console.log('页2 = ' + JSON.stringify(d, null, 1))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })