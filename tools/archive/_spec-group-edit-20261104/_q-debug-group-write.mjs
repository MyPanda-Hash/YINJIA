/**
 * _q-debug-group-write.mjs —— 排查「打字保住了但保存没落库」
 *
 * 要区分两种可能:
 *   A. renameGroup/renameSub 根本没被调用(或调了但 arr 里找不到行);
 *   B. 调了也改了现役 head,但**保存载荷**取的是另一份数据。
 *
 * 做法:在页面里挂一个探针,读改动前后 props.head.detail.items 的内容。
 * 用 Vue 组件的 __vueParentComponent 拿真实状态;取不到就退回读 DOM 文本。
 *
 * 用法:node _q-debug-group-write.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = 'ZZ-PROBE-SPEC'

async function main() {
  const s = await launch({ port: 9545 })
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

  // 找到 RecordSheetPanels 组件实例,读它的 props.head.detail.items
  const before = await s.evaluate(`(() => {
    const el = document.querySelector('.record-sheet') || document.querySelector('[class*=record]')
    if(!el) return {err:'no record el'}
    // 往上找带 __vueParentComponent 的节点
    let node = el, comp = null
    while (node && !comp) {
      comp = node.__vueParentComponent || null
      node = node.parentElement
    }
    if(!comp) return {err:'no vue comp'}
    // 逐层向找到 props.head 的组件
    let c = comp, found = null, depth = 0
    while (c && depth < 12) {
      const h = c.props?.head
      if (h) { found = h; break }
      c = c.parent
      depth++
    }
    if(!found) return {err:'no props.head', depth}
    const items = found.detail?.items || []
    return {
      depth,
      itemCount: items.length,
      rows: items.filter(r=>r['表区']==='检验要求').map(r=>({项目:r['检验项目'], 子项:r['检验子项']})),
    }
  })()`)
  console.log('改动前 props.head = ' + JSON.stringify(before, null, 1))

  // 打字
  const typed = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    const t=tas[0]
    if(!t) return {ok:false}
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(t,'DBG_组名')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, now:t.value}
  })()`)
  console.log('打字 = ' + JSON.stringify(typed))
  await sleep(1500)

  const after = await s.evaluate(`(() => {
    const el = document.querySelector('.record-sheet') || document.querySelector('[class*=record]')
    let node = el, comp = null
    while (node && !comp) { comp = node.__vueParentComponent || null; node = node.parentElement }
    if(!comp) return {err:'no vue comp'}
    let c = comp, found = null, depth = 0
    while (c && depth < 12) {
      const h = c.props?.head
      if (h) { found = h; break }
      c = c.parent; depth++
    }
    if(!found) return {err:'no props.head'}
    const items = found.detail?.items || []
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(x=>x.offsetParent!==null)
    return {
      项目值: items.filter(r=>r['表区']==='检验要求').map(r=>r['检验项目']),
      domFirst: tas[0]?.value,
    }
  })()`)
  console.log('改动后 props.head = ' + JSON.stringify(after, null, 1))

  console.log('')
  const modelsChanged = JSON.stringify(before.rows) !== JSON.stringify(
    (after.项目值||[]).map(v=>({项目:v})))
  console.log((after.项目值||[]).some(v=>String(v).includes('DBG_'))
    ? '=> props.head 已更新:改的是现役数据,保存应能落库'
    : '=> props.head **没变**:renameGroup 没改到现役数组(或没被调用)')

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })