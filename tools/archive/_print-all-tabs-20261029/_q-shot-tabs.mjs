/**
 * _q-shot-tabs.mjs —— 逐页签截图,对比「组装BOM表」与「组装工艺清单」两页的真实版式
 * 用法: node _q-shot-tabs.mjs [base] [panelCode]
 *
 * 为什么必须看图:上一轮量到三页纸张元素是 1041×(260/471/468) —— 全是 w>h 的扁条,
 * 与用户描述的「BOM 表横向、工艺清单竖向」对不上。先看图找真实差异,别再猜。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANEL = process.argv[3] || 'RD_ASM_PROC'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v) : v) }

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
log('目标单', PANEL + ' / ' + no)

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

const s = await launch({ port: 9473 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(`${BASE}/#/panelx/list/${PANEL}?docNo=${encodeURIComponent(no)}`)
  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    const ok = await s.evaluate(`[...document.querySelectorAll('.rsp-page-tab')].length > 0`)
    if (ok) break
  }

  const tabs = await s.evaluate(`[...document.querySelectorAll('.rsp-page-tab')].map(e=>(e.textContent||'').trim())`)
  log('页签', tabs)

  for (let i = 0; i < tabs.length; i++) {
    await s.evaluate(`(() => {
      const ts=[...document.querySelectorAll('.rsp-page-tab')]
      if(ts[${i}]) ts[${i}].click(); return true
    })()`)
    await sleep(1200)
    // 逐页收集:纸张盒宽高 + 各 section/表格的宽度(找"横向"的真因)
    const geo = await s.evaluate(`(() => {
      const el = document.querySelector('.approval-layout .record-sheet')
      const t = (e)=>e?(e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40):null
      const tables = [...document.querySelectorAll('.rs-t')].filter(x=>x.offsetParent!==null)
      return {
        paper: el ? { w: el.scrollWidth, h: el.scrollHeight } : null,
        tables: tables.map(x=>({ w: x.scrollWidth,
          first: t(x.querySelector('tr')),
          cols: [...x.querySelectorAll('col')].map(c=>c.style.width).join(',') })).slice(0,6),
        dtTables: [...document.querySelectorAll('.rsp-dt-table')].filter(x=>x.offsetParent!==null)
          .map(x=>({ w: x.scrollWidth, cols: [...x.querySelectorAll('col')].map(c=>c.style.width).join(',') })),
      }
    })()`)
    log('页 ' + i + ' ' + tabs[i], geo)
    // captureBeyondViewport 在本机 CDP 上会静默断开(实测进程直接退出、无 PNG)
    // ⇒ 先用 Emulation 把视口撑到纸张实际高度,再截普通视口图。
    try {
      await s.send('Emulation.setDeviceMetricsOverride', {
        width: 1600, height: Math.min(1400, Math.max(600, (geo.paper?.h || 600) + 200)),
        deviceScaleFactor: 1, mobile: false,
      })
      await sleep(400)
      const png = await s.send('Page.captureScreenshot', { format: 'png' })
      await fs.writeFile(new URL(`./shot-tab${i}.png`, import.meta.url), Buffer.from(png.data, 'base64'))
      console.log('  saved shot-tab' + i + '.png')
    } catch (e) {
      console.log('  screenshot failed: ' + (e && e.message || e))
    }
  }
} finally {
  await fs.writeFile(new URL('./out-shot-tabs.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
