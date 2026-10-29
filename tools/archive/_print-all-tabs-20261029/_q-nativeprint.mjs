/**
 * _q-nativeprint.mjs —— 单页/宽面板走原生 window.print() 时,**A4 纸上到底会不会被裁掉**
 * 用法: node _q-nativeprint.mjs [base] [panelCode]
 *
 * 为什么必须验:多页签面板走 buildSheetPdfBlob(已统一 A4 竖向、等比缩放);
 *   **单页面板仍走 window.print()** —— 打印样式只给了 .rsp-sheet { width:100%; zoom:0.92 },
 *   但内层 <table class="rs-t"> 的宽度是**行内 px**(secW(sec),如 1185px)。
 *   A4 竖向内容宽只有 733px ⇒ 这 18 张超宽面板极可能被横向裁掉(不是缩小,是切掉)。
 *
 * 做法:加 approval-printing 类 → Page.printToPDF(A4, 8mm 边距)→ 存 PDF → 渲染成图。
 *   这是浏览器真实的打印结果,不是我们的估算。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANEL = process.argv[3] || 'RD_DROP_PREC'
const NAME = process.argv[4] || 'native'

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const r = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: PANEL, pageNo: 1, pageSize: 1, condition: {} }),
})).json()
const row = (r?.data?.list || [])[0] || {}
const no = String(row['单据编号'] || row['编号'] || '')
console.log('目标单 =', PANEL, '/', no)

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

const s = await launch({ port: 9476 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(`${BASE}/#/panelx/list/${PANEL}${no ? '?docNo=' + encodeURIComponent(no) : ''}`)
  for (let i = 0; i < 12; i++) {
    await sleep(2000)
    if (await s.evaluate(`!!document.querySelector('.record-sheet')`)) break
  }

  const geo = await s.evaluate(`(() => {
    const el = document.querySelector('.approval-layout .record-sheet, .record-sheet')
    const t = [...document.querySelectorAll('.rs-t')].filter(x=>x.offsetParent!==null)
    return {
      paper: el ? { w: el.scrollWidth, h: el.scrollHeight } : null,
      tables: t.map(x=>x.scrollWidth),
    }
  })()`)
  console.log('纸面几何 =', JSON.stringify(geo))

  // 与 printApprovalSheet 的原生路径同口径:加打印类
  await s.evaluate(`(() => { document.body.classList.add('approval-printing'); return true })()`)
  await sleep(600)

  // A4 竖向,边距 8mm = 0.314961 inch
  const pdf = await s.send('Page.printToPDF', {
    landscape: false,
    printBackground: true,
    paperWidth: 8.27,
    paperHeight: 11.69,
    marginTop: 0.315, marginBottom: 0.315, marginLeft: 0.315, marginRight: 0.315,
    preferCSSPageSize: false,
  })
  await s.evaluate(`(() => { document.body.classList.remove('approval-printing'); return true })()`)
  await fs.writeFile(new URL(`./${NAME}-${PANEL}.pdf`, import.meta.url), Buffer.from(pdf.data, 'base64'))
  console.log('saved', `${NAME}-${PANEL}.pdf`, 'bytes =', Buffer.from(pdf.data, 'base64').length)
} finally {
  process.exit(0)
}
