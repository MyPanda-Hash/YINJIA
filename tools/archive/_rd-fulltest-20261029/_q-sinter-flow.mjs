/**
 * _q-sinter-flow.mjs —— 烧结工艺清单(RD_MOLD_PROC)录单流程实机取证
 *
 * 目的(用户 2026-11-04 提出的 7 步录单流程,逐条核对现状):
 *   ① 选产品编号 → 是否带出 产品管控类型 / 外观要求(产品形态) / 炭棒规格 1-3
 *   ② 生产车间 → 检验要求「炭棒尺寸」四格是否按车间模具型号筛选(下拉)
 *   ③ 手工下拉填 内外径 + 公差
 *   ④ 跌落/抗压/压降 无数据时是否填 '/'
 *   ⑤ 配方计算 → 填入单据 → 单元格是否有数据(本脚本只取证第①②④步;⑤另案)
 *
 * 用法: node _q-sinter-flow.mjs [base]
 * 输出: out-sinter-flow.json + 控制台
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => {
  out.push({ k, v })
  console.log('')
  console.log(k + ' =')
  console.log(typeof v === 'object' ? JSON.stringify(v, null, 2) : v)
}

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

/** 纸面上所有可编辑格:标签(相邻标签格) + 当前值 */
const DUMP_CELLS = `(() => {
  const res=[]
  const clean=(s)=>String(s||'').replace(/\\s+/g,' ').trim()
  for(const el of document.querySelectorAll('input,textarea')){
    const td=el.closest('td')
    if(!td) continue
    let label=''
    const prev=td.previousElementSibling
    if(prev) label=clean(prev.textContent).slice(0,24)
    if(!label){
      const tr=el.closest('tr')
      if(tr){const tds=[...tr.children]; if(tds.length>1) label=clean(tds[0].textContent).slice(0,24)}
    }
    if(!label) label='(无标签)'
    const v=String(el.value||el.textContent||'').replace(/\\s+/g,' ').trim()
    res.push(label+' => '+v.slice(0,40))
  }
  return res.slice(0,160)
})()`

/** 只挑关键字那几格
 *  纸面是「标签行 + 值行」两行式:值格的标签在**上一行同一列**,
 *  所以先看 prevElementSibling,取不到再按「上一 tr 同列」找,最后退回本行首格。 */
const DUMP_KEYS = `(() => {
  const KW=['外径','内径','跌落','强度','压降','密度','炭棒规格','产品管控','外观','生产车间','产品编号','产品名称','管控']
  const res=[]
  const clean=(s)=>String(s||'').replace(/\\s+/g,' ').trim()
  const labelOf=(td)=>{
    const prev=td.previousElementSibling
    let l=prev?clean(prev.textContent):''
    if(l) return l
    const tr=td.closest('tr')
    if(!tr) return ''
    const idx=[...tr.children].indexOf(td)
    const up=tr.previousElementSibling
    if(up){
      const cells=[...up.children]
      if(cells[idx]) { const v=clean(cells[idx].textContent); if(v) return v }
      const first=clean(cells[0]?cells[0].textContent:'')
      if(first) return first
    }
    const tds=[...tr.children]
    return tds.length>1?clean(tds[0].textContent):''
  }
  for(const el of document.querySelectorAll('input,textarea')){
    const td=el.closest('td')
    if(!td) continue
    const label=labelOf(td)
    if(!KW.some(k=>label.includes(k))) continue
    res.push(label.slice(0,24)+' => '+String(el.value||'').slice(0,40))
  }
  return res
})()`

const CLICK_NEW = `(() => {
  const cands=[...document.querySelectorAll('button,.el-button,[class*=btn]')]
  const b=cands.find(x=>{const t=(x.textContent||'').trim(); return t==='新增'||t==='＋新增'||t==='+ 新增'})
  if(!b) return 'not-found:'+cands.map(x=>(x.textContent||'').trim()).filter(Boolean).slice(0,12).join('|')
  b.click(); return 'clicked:'+(b.textContent||'').trim()
})()`

/** 点纸面上的「产品编号」参照格 */
const CLICK_PRODCELL = `(() => {
  const cells=[...document.querySelectorAll('.rs-ref-ctl')]
  if(!cells.length) return 'no-ref-ctl'
  const hit=cells[0]
  hit.click()
  return 'clicked-ref-ctl:'+cells.length
})()`

/** 参照弹窗:填关键字 + 查询(默认列表里有空白行,盲勾第一行会勾到空单) */
const FILL_KEYWORD = (kw) => `(() => {
  const dlgs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.offsetParent!==null)
  if(!dlgs.length) return 'no-dialog'
  const d=dlgs[dlgs.length-1]
  const inp=[...d.querySelectorAll('input')].find(i=>(i.placeholder||'').includes('关键字'))
  if(!inp) return 'no-keyword-input'
  const set=(el,v)=>{el.focus();const dd=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');dd&&dd.set?dd.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}))}
  set(inp, ${JSON.stringify(kw)})
  const btn=[...d.querySelectorAll('button')].find(b=>(b.textContent||'').trim()==='查询')
  if(!btn) return 'no-query-btn'
  btn.click()
  return 'queried:'+${JSON.stringify(kw)}
})()`

/** 参照格(纸面上是 span.rs-ref-text,不是 input) */
const DUMP_REF = `(() => {
  const clean=(s)=>String(s||'').replace(/\s+/g,' ').trim()
  const res=[]
  for(const c of document.querySelectorAll('.rs-ref-ctl')){
    const td=c.closest('td'); if(!td) continue
    let label=''
    const prev=td.previousElementSibling
    if(prev) label=clean(prev.textContent)
    if(!label){
      const tr=td.closest('tr'); const idx=[...tr.children].indexOf(td)
      const up=tr.previousElementSibling
      if(up && up.children[idx]) label=clean(up.children[idx].textContent)
    }
    res.push(label.slice(0,20)+' => '+clean(c.textContent).slice(0,40))
  }
  return res
})()`

/** 参照弹窗 · 第 1 步:勾第一行(只点 checkbox,不做别的)
 *  Vue 的 disabled 是异步重渲染的,所以勾选与点"确定导入"必须分成两次 evaluate。 */
const PICK_CHECK = `(() => {
  const dlgs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.offsetParent!==null)
  if(!dlgs.length) return 'no-dialog'
  const d=dlgs[dlgs.length-1]
  const mask=d.querySelector('.el-loading-mask')
  if(mask && mask.offsetParent!==null) return 'still-loading'
  const rows=[...d.querySelectorAll('.el-table__body-wrapper tr')]
  if(!rows.length) return 'no-rows'
  const inp=rows[0].querySelector('input.el-checkbox__original')||rows[0].querySelector('input[type=checkbox]')
  if(!inp) return 'no-checkbox:'+(rows[0].textContent||'').slice(0,40)
  if(inp.disabled) return 'checkbox-disabled'
  inp.click()
  return 'checked rows='+rows.length
})()`

/** 参照弹窗 · 第 2 步:点"确定导入"(此时 selected 已因 selection-change 更新) */
const PICK_CONFIRM = `(() => {
  const dlgs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.offsetParent!==null)
  if(!dlgs.length) return 'no-dialog'
  const d=dlgs[dlgs.length-1]
  const btns=[...d.querySelectorAll('button')]
  const ok=btns.find(b=>(b.textContent||'').includes('确定导入'))
  if(!ok) return 'no-confirm-btn:'+btns.map(b=>(b.textContent||'').trim()).slice(0,8).join('|')
  const label=(ok.textContent||'').trim()
  if(ok.disabled) return 'confirm-disabled label='+label
  ok.click()
  return 'confirmed label='+label
})()`

const s = await launch({ port: 9496 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1500, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)

  await s.navigate(BASE + '/#/panelx/list/RD_MOLD_PROC')
  await sleep(7000)
  log('列表页标题/条数', await s.evaluate(`(() => {
    const t=document.querySelector('.panel-title,.el-page-header__content,h2')
    return { title: (t?t.textContent:'').trim().slice(0,40), rows: document.querySelectorAll('.el-table__body tr').length }
  })()`))

  log('点新增', await s.evaluate(CLICK_NEW))
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    if (await s.evaluate(`(document.body.textContent||'').includes('检验要求')`)) break
  }
  await sleep(2500)

  log('① 新建后 检验要求/关键格(未选产品编号)', await s.evaluate(DUMP_KEYS))
  log('①b 是否有任一格是斜杠', await s.evaluate(`(() => {
    const hit=[...document.querySelectorAll('input,textarea')].filter(e=>String(e.value||'').trim()==='/')
    return hit.length
  })()`))

  log('② 点产品编号参照格', await s.evaluate(CLICK_PRODCELL))
  await sleep(3500)
  log('②b 弹窗状态', await s.evaluate(`(() => {
    const dlgs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.offsetParent!==null)
    if(!dlgs.length) return 'no-dialog'
    const d=dlgs[dlgs.length-1]
    return { rows: d.querySelectorAll('.el-table__body tr').length, text: (d.querySelector('.el-dialog__title')||{}).textContent }
  })()`))

  log('②c 弹窗内按产品编号过滤', await s.evaluate(FILL_KEYWORD('YJ-CB-2026-001')))
  await sleep(3500)
  log('②d 过滤后行数', await s.evaluate(`(() => {
    const dlgs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.offsetParent!==null)
    const d=dlgs[dlgs.length-1]
    return [...d.querySelectorAll('.el-table__body-wrapper tr')].map(r=>(r.textContent||'').replace(/\s+/g,' ').trim().slice(0,60))
  })()`))

  log('③a 勾第一行', await s.evaluate(PICK_CHECK))
  await sleep(1200)
  log('③b 确定导入', await s.evaluate(PICK_CONFIRM))
  await sleep(6000)

  log('④ 选完产品编号后 关键格', await s.evaluate(DUMP_KEYS))
  log('④-1 参照格(span 文本)', await s.evaluate(DUMP_REF))
  log('④b 是否有任一格是斜杠', await s.evaluate(`(() => {
    const hit=[...document.querySelectorAll('input,textarea')].filter(e=>String(e.value||'').trim()==='/')
    return hit.length
  })()`))
  log('⑤ 全纸面格(截断160)', await s.evaluate(DUMP_CELLS))

  await fs.writeFile(new URL('./out-sinter-flow.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('')
  console.log('WROTE out-sinter-flow.json')
} finally {
  process.exit(0)
}