/**
 * _q-sinter-flow2.mjs —— 第二轮实机取证:验证 2026-11-04 四处修复
 *   ① 外观要求 ← 产品形态(带出)          ② 无明显数据 → '/' 兜底
 *   ③ 生产车间(1#车间) → 型号下拉筛得到    ④ 选型号 → 四格一次填满
 *
 * 定位方式:纸面是「标签行 + 值行」两行式且标签带 colspan,
 *   所以按**累计 colspan 算起始列**,再用列号在下一行找值格(不靠 td 序号)。
 *
 * 用法: node _q-sinter-flow2.mjs [base]
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

/** 页面内公用:按标签(列号对齐)找值格 */
const HELPERS = `
  const clean=(s)=>String(s||'').replace(/\\s+/g,' ').trim();
  /* 纸面「标签行 + 值行」两行式:按**真实列号**(累计 colspan)配对。
     ⚠ 两个坑(都踩过):
       ① 标签行里的块名格带 rowspan(炭棒尺寸/密度管控/灌料…),它占一列但值行不出现
          ⇒ 标签列号要先减掉这些 rowspan 格占的列数,才和值行同列;
       ② 一个标签可以盖住多个值格(「炭棒规格」colspan=3 → 规格1/2/3 三格)
          ⇒ 取"起点落在标签范围内"的第一个值格。 */
  const span=(td)=>Number(td.getAttribute('colspan')||1)||1;
  const rowspanCols=(tr)=>[...tr.children].filter(td=>(Number(td.getAttribute('rowspan')||1)||1)>1)
                        .reduce((a,td)=>a+span(td),0);
  const starts=(tr)=>{const out=[];let c=0;for(const td of tr.children){out.push({td,c,w:span(td)});c+=span(td)}return out};
  const cellOf = (want) => {
    for(const tr of document.querySelectorAll('tr')){
      const next=tr.nextElementSibling;
      if(!next) continue;
      const off=rowspanCols(tr);
      const ls=starts(tr), vs=starts(next);
      for(const L of ls){
        if(clean(L.td.textContent)!==want) continue;
        const want0=L.c-off;
        const hit=vs.find(v=>v.c===want0) || vs.find(v=>v.c<=want0 && want0<v.c+v.w);
        if(hit) return hit.td;
      }
    }
    return null;
  };
`

const CLICK_NEW = `(() => {
  const b=[...document.querySelectorAll('button,.el-button,[class*=btn]')].find(x=>{const t=(x.textContent||'').trim(); return t==='新增'||t==='＋新增'||t==='+ 新增'})
  if(!b) return 'not-found'
  b.click(); return 'clicked'
})()`

const VALUE_BY_LABEL = (label) => `(() => { ${HELPERS}
  const td=cellOf(${JSON.stringify(label)});
  if(!td) return '(格未找到)';
  const sel=td.querySelector('.el-select');
  if(sel){
    const t=clean((sel.querySelector('.el-select__selected-item')||{}).textContent);
    if(t) return t;
    const ph=clean((sel.querySelector('.el-select__placeholder')||{}).textContent);
    return '(空)' + (ph ? ':'+ph : '');
  }
  const inp=td.querySelector('input,textarea');
  if(inp) return clean(inp.value);
  const ref=td.querySelector('.rs-ref-text');
  if(ref) return clean(ref.textContent).replace(/(已开发|未开发|开发中)$/,'');
  return clean(td.textContent);
})()`

const CLICK_REF_BY_LABEL = (label) => `(() => { ${HELPERS}
  const td=cellOf(${JSON.stringify(label)});
  if(!td) return '格未找到';
  const ctl=td.querySelector('.rs-ref-ctl');
  if(!ctl) return '该格不是参照格:'+clean(td.textContent).slice(0,30);
  ctl.click(); return 'clicked';
})()`

const OPEN_SELECT_BY_LABEL = (label) => `(() => { ${HELPERS}
  const td=cellOf(${JSON.stringify(label)});
  if(!td) return '格未找到';
  const sel=td.querySelector('.el-select');
  if(!sel) return '该格没有下拉:'+clean(td.textContent).slice(0,40);
  sel.click();
  const wrap=sel.querySelector('.el-select__wrapper')||sel;
  wrap.click();
  return 'opened';
})()`

/** 整张纸:标签 → 值(全量,便于人工核对) */
const DUMP_ALL = `(() => { ${HELPERS}
  const res=[];
  for(const tr of document.querySelectorAll('tr')){
    const next=tr.nextElementSibling;
    if(!next) continue;
    const off=rowspanCols(tr);
    const vs=starts(next);
    for(const L of starts(tr)){
      const label=clean(L.td.textContent);
      if(!label || label.length>20) continue;
      const want0=L.c-off;
      const hit=vs.find(v=>v.c===want0) || vs.find(v=>v.c<=want0 && want0<v.c+v.w);
      if(!hit) continue;
      const td=hit.td;
      const inp=td.querySelector('input,textarea');
      const ref=td.querySelector('.rs-ref-text');
      const sel=td.querySelector('.el-select__selected-item,.el-select__placeholder');
      const v=inp?clean(inp.value):(ref?clean(ref.textContent).replace(/(已开发|未开发|开发中)$/,''):(sel?clean(sel.textContent):clean(td.textContent)));
      if(!v || v==='点击选择') continue;
      res.push(label.slice(0,20)+' => '+v.slice(0,40));
    }
  }
  return res.slice(0,80);
})()`

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

const PICK_CHECK = `(() => {
  const dlgs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.offsetParent!==null)
  if(!dlgs.length) return 'no-dialog'
  const d=dlgs[dlgs.length-1]
  const rows=[...d.querySelectorAll('.el-table__body-wrapper tr')]
  if(!rows.length) return 'no-rows'
  const inp=rows[0].querySelector('input.el-checkbox__original')
  if(!inp) return 'no-checkbox'
  inp.click()
  return 'checked rows='+rows.length
})()`

const PICK_CONFIRM = `(() => {
  const dlgs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.offsetParent!==null)
  if(!dlgs.length) return 'no-dialog'
  const d=dlgs[dlgs.length-1]
  const ok=[...d.querySelectorAll('button')].find(b=>(b.textContent||'').includes('确定导入'))
  if(!ok) return 'no-confirm'
  if(ok.disabled) return 'disabled'
  ok.click()
  return 'confirmed'
})()`

const s = await launch({ port: 9498 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1500, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)

  await s.navigate(BASE + '/#/panelx/list/RD_MOLD_PROC'); await sleep(7000)
  log('新增', await s.evaluate(CLICK_NEW))
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    if (await s.evaluate(`(document.body.textContent||'').includes('检验要求')`)) break
  }
  await sleep(2500)

  // ── 选产品编号(纸面标签是「炭棒编号」) ──
  log('点产品编号格', await s.evaluate(CLICK_REF_BY_LABEL('炭棒编号')))
  await sleep(3000)
  log('过滤 YJ-CB-2026-001', await s.evaluate(FILL_KEYWORD('YJ-CB-2026-001')))
  await sleep(3000)
  log('勾选', await s.evaluate(PICK_CHECK))
  await sleep(1200)
  log('确定导入', await s.evaluate(PICK_CONFIRM))
  await sleep(6000)

  log('① 产品管控类型(应 A类)', await s.evaluate(VALUE_BY_LABEL('产品管控类型')))
  log('① 外观要求(应 圆柱形)', await s.evaluate(VALUE_BY_LABEL('产品形态')))
  log("② 跌落 要求(应 '/')", await s.evaluate(VALUE_BY_LABEL('要求')))
  log("② 强度要求kgf(应 '/')", await s.evaluate(VALUE_BY_LABEL('强度要求kgf')))
  log("② 压降标准kpa(应 '/')", await s.evaluate(VALUE_BY_LABEL('压降标准kpa')))
  log('纸面非空格(选完产品编号)', await s.evaluate(DUMP_ALL))

  // ── 选生产车间 1#车间 ──
  let shop = ''
  for (let attempt = 1; attempt <= 3 && shop !== '1#车间'; attempt++) {
    log(`③ 第 ${attempt} 次选生产车间:点格`, await s.evaluate(CLICK_REF_BY_LABEL('生产车间')))
    await sleep(3000)
    log(`③ 第 ${attempt} 次:过滤 1#车间`, await s.evaluate(FILL_KEYWORD('1#车间')))
    await sleep(3500)
    log(`③ 第 ${attempt} 次:勾选`, await s.evaluate(PICK_CHECK))
    await sleep(1500)
    log(`③ 第 ${attempt} 次:确定`, await s.evaluate(PICK_CONFIRM))
    await sleep(4000)
    shop = String(await s.evaluate(VALUE_BY_LABEL('生产车间')))
    log(`③ 第 ${attempt} 次:生产车间现值`, shop)
    if (shop === '1#车间') break
    // 失败时把可能残留的弹窗关掉再重试
    await s.evaluate(`(() => {
      const dlgs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.offsetParent!==null)
      const d=dlgs[dlgs.length-1]
      if(!d) return 'no-dialog'
      const c=[...d.querySelectorAll('button')].find(b=>(b.textContent||'').trim()==='取消')
      c&&c.click()
      return 'cancelled'
    })()`)
    await sleep(1500)
  }

  log('③ 打开型号下拉', await s.evaluate(OPEN_SELECT_BY_LABEL('炭棒外径mm')))
  await sleep(1500)
  log('③ 型号候选(应只含 1 号车间)', await s.evaluate(`(() => {
    const items=[...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent!==null)
    return items.map(e=>(e.textContent||'').replace(/\\s+/g,' ').trim()).slice(0,30)
  })()`))

  log('④ 选第一个型号', await s.evaluate(`(() => {
    const items=[...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent!==null)
    if(!items.length) return 'no-items'
    const t=(items[0].textContent||'').trim()
    items[0].click()
    return 'picked:'+t
  })()`))
  await sleep(2000)
  log('④ 外径mm', await s.evaluate(VALUE_BY_LABEL('炭棒外径mm')))
  log('④ 外径公差mm', await s.evaluate(VALUE_BY_LABEL('炭棒外径公差mm')))
  log('④ 内径mm', await s.evaluate(VALUE_BY_LABEL('炭棒内径mm')))
  log('④ 内径公差mm', await s.evaluate(VALUE_BY_LABEL('炭棒内径公差mm')))

  await fs.writeFile(new URL('./out-sinter-flow2.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('')
  console.log('WROTE out-sinter-flow2.json')
} finally {
  process.exit(0)
}