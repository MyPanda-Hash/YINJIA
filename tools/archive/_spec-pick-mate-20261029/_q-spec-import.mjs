/**
 * _q-spec-import.mjs —— 端到端:规格书引用物料清单 → 勾一张单 → 确认 → 行是否落表(含数量=标准用量)
 * 用法: node _q-spec-import.mjs [base]
 *
 * 只读验证:落行后**不保存**,只比较「引用前后的行数/首行内容」,不改库。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const r = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', pageNo: 1, pageSize: 1, condition: {} }),
})).json()
const no = String((r?.data?.list || [])[0]?.['单据编号'] || '')

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

/** 读目标表(1.关键物料列表)的行内容 */
const READ_ROWS = `(() => {
  // 该表紧跟「1.关键物料列表」标题 —— 用表格内表头含 物料编码 且 规格参数 的那个
  const tables=[...document.querySelectorAll('table.rs-t')].filter(t=>{
    const h=(t.querySelector('tr')?.textContent||'')
    return h.includes('物料编码') && h.includes('规格参数')
  })
  if(!tables.length) return { err:'表未找到' }
  const t=tables[tables.length-1]
  const rows=[...t.querySelectorAll('tbody tr, tr')].slice(1).map(tr=>{
    const tds=[...tr.children].map(td=>(td.querySelector('input,textarea')?.value ?? td.textContent ?? '').trim())
    return tds
  }).filter(r=>r.some(v=>v && v!=='—' && v!=='／'))
  return { n: rows.length, first: rows.slice(0,3) }
})()`

const s = await launch({ port: 9486 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC${no ? '?docNo=' + encodeURIComponent(no) : ''}`)
  for (let i = 0; i < 15; i++) {
    await sleep(2000)
    if (await s.evaluate(`[...document.querySelectorAll('.rsp-page-tab')].length>0`)) break
  }
  await s.evaluate(`(() => {
    const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').trim()==='成品及包装运输')
    if(t) t.click(); return !!t
  })()`)
  await sleep(2500)

  log('引用前', await s.evaluate(READ_ROWS))

  // 打开弹窗,勾第一张单
  await s.evaluate(`(() => {
    const el=[...document.querySelectorAll('.rs-tool')].find(x=>/引用/.test(x.textContent||''))
    if(el) el.click(); return !!el
  })()`)
  let dlgReady = false
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    dlgReady = await s.evaluate(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
      return !!(d && d.querySelectorAll('.el-table__body tr').length)
    })()`)
    if (dlgReady) break
  }
  log('弹窗就绪', dlgReady)
  log('勾选', await s.evaluate(`(() => {
    const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
    if(!d) return 'no-dialog'
    const box=d.querySelector('.el-table__body tr td .el-checkbox')
    if(!box) return 'no-checkbox'
    box.click(); return 'checked'
  })()`))
  await sleep(1200)
  log('点引用', await s.evaluate(`(() => {
    const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
    if(!d) return 'no-dialog'
    const btns=[...d.querySelectorAll('.el-dialog__footer button, button')]
    const ok=btns.find(b=>/引用|导入/.test(b.textContent||''))
    if(!ok) return 'no-ok'
    ok.click(); return 'clicked'
  })()`))
  await sleep(2500)

  const after = await s.evaluate(READ_ROWS)
  log('引用后', after)
  log('提示', await s.evaluate(`(()=>[...document.querySelectorAll('.el-message__content')].map(e=>(e.textContent||'').trim()).filter(Boolean).slice(-2))()`))
} finally {
  await fs.writeFile(new URL('./out-spec-import.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
