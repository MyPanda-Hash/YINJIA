/**
 * _q-print-tabs.mjs —— 多页签面板点「打印」是否一次出全部页签
 * 用法: node _q-print-tabs.mjs [base] [panelCode]
 *
 * 判据(不靠肉眼):
 *   ① 点「打印」后是否走了 PDF 路径(ElMessage 提示「已打开打印件（共 N 张）」);
 *   ② 拦下 window.open / fetch 拿到的 blob 字节数 + PDF 里的页数(/Type /Page 计数);
 *   ③ 打印结束后当前页签是否被还原(不能把用户界面停在最后一页)。
 *
 * 拦 window.open:在 page.evaluate 里先覆盖 window.open 记录调用,再点按钮。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANEL = process.argv[3] || 'RD_SPEC_DOC'
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

const s = await launch({ port: 9470 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(`${BASE}/#/panelx/list/${PANEL}?docNo=${encodeURIComponent(no)}`)

  // 等纸面渲染出来
  for (let i = 0; i < 15; i++) {
    await sleep(2000)
    const ok = await s.evaluate(`!!document.querySelector('.rsp-pages, .rsp-page-tab')`)
    if (ok) break
  }
  log('页签', await s.evaluate(`[...document.querySelectorAll('.rsp-page-tab')].map(e=>(e.textContent||'').trim())`))
  log('当前页签', await s.evaluate(`(()=>{const e=document.querySelector('.rsp-page-tab.active');return e?(e.textContent||'').trim():null})()`))

  // 装拦截器:记录 window.open 与 blob 大小,并抓 PDF 页数
  await s.evaluate(`(() => {
    window.__printProbe = { opens: [], blobs: [] }
    const realOpen = window.open
    window.open = function (url, name, feats) {
      window.__printProbe.opens.push({ url: String(url).slice(0, 40), size: 0 })
      const idx = window.__printProbe.opens.length - 1
      // blob: URL 直接 fetch 出字节,数页数
      fetch(url).then(r => r.blob()).then(async (b) => {
        const buf = new Uint8Array(await b.arrayBuffer())
        // PDF 页数:数 "/Type /Page"(排除 /Pages)
        const text = Array.from(buf).map(c => String.fromCharCode(c)).join('')
        const pages = (text.match(/\\/Type\\s*\\/Page[^s]/g) || []).length
        window.__printProbe.opens[idx].size = b.size
        window.__printProbe.opens[idx].pages = pages
      }).catch(e => { window.__printProbe.opens[idx].err = String(e && e.message || e) })
      return { location: { href: '' }, close(){}, focus(){} }
    }
    return 'patched'
  })()`)

  // 点「打印」(侧栏竖排按钮)
  const clicked = await s.evaluate(`(() => {
    const el = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent||'').trim() === '打印')
    if (!el) return 'not-found'
    el.click(); return 'clicked'
  })()`)
  log('点打印', clicked)

  // 等 PDF 生成(截图 + jsPDF 需要几秒,4 页更长)
  let probe = null
  for (let i = 0; i < 25; i++) {
    await sleep(2000)
    probe = await s.evaluate(`JSON.parse(JSON.stringify(window.__printProbe || {}))`)
    if (probe.opens && probe.opens.length && probe.opens[0].pages) break
  }
  log('拦截结果', probe)
  log('提示语', await s.evaluate(`(()=>{const m=[...document.querySelectorAll('.el-message, .el-message__content')].map(e=>(e.textContent||'').trim()).filter(Boolean);return m.slice(-3)})()`))
  log('打印后当前页签', await s.evaluate(`(()=>{const e=document.querySelector('.rsp-page-tab.active');return e?(e.textContent||'').trim():null})()`))
} finally {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-print-tabs.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
