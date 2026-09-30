'use strict'
/**
 * _probe-proddoclist-jump-search.cjs — 产品文件列表(RD_PROD_DOCLIST)两项改动的验证探针(2026-09-30)
 *
 * 用法:node tools/archive/_probe-proddoclist-jump-search.cjs [http://localhost:5173]
 *   界面层必须打 5173(源码改动不经 build 不进 8090 的打包产物);
 *   跳转目标依赖后端新增的 row.docNos ⇒ 改后端后必须重新打包并重启 8090。
 *
 * 断言:
 *   ① 后端矩阵行带 docNos(每格状态对应的单据号,与状态同一取法)
 *   ② 点状态 → 跳到该文件面板并**打开那张单**(URL ?focus= 且目标页显示该单号)
 *   ③ 无该面板查看权限 → 只提示「无查看该面板的权限」,**不跳**
 *      (用 admin 登录拿到数据,再把 localStorage 的 mes_user 换成受限账号:权限门禁是纯前端预检)
 *   ④ 查询产品:按产品编号筛矩阵行(横幅 + 行数)
 *   ⑤ 模糊搜索:字段 = 状态（任一文件）→ 筛出"还有文件没做"的产品
 *   ⑥ 产品预览:卡片 = 产品行(含 4 个文件状态)
 *   ⑦ 清除筛选:回到全表
 *
 * 只读:不造数、不改库(prod 已有 DEMO-A-001 / DEMO-B-001 两个已下发产品)。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://localhost:5173'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9367
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0
let fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }

let ev = null

async function api(pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const lr = await api('/api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456' } })
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败: ' + JSON.stringify(lr).slice(0, 300))

  console.log('\n① 后端:矩阵行带 docNos(状态对应的单据号)')
  const res = await api('/api/px/prodDocList', { token })
  const rows = res?.data?.rows || []
  const cols = res?.data?.columns || []
  const target = rows[0] || {}
  const specDocNo = target?.docNos?.RD_SPEC_DOC || ''
  check(`第一行(${target['产品编号'] || '?'})带 docNos`, !!target.docNos && Object.keys(target.docNos).length > 0, JSON.stringify(target.docNos))
  check('规格书那格的状态与单据号都在(开发完毕 → 有号)', !!specDocNo, JSON.stringify({ st: target?.cells?.RD_SPEC_DOC, no: specDocNo }))
  check('列序=设计顺序(规格书在前)', cols[0]?.panelCode === 'RD_SPEC_DOC', JSON.stringify(cols.map((c) => c.panelCode)))

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pdljs-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r2, rej) => { ws.onopen = r2; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    /** 权限门禁是纯前端预检 ⇒ 用「拦截 /api/auth/userinfo 使其失败」把注入的受限账号留住
     *  (PortalLayout 启动时会拉 userinfo 覆盖 mes_user;失败则保持 localStorage 里那个) */
    let blockUserInfo = false
    ws.on('message', (d) => {
      let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.method === 'Fetch.requestPaused') {
        const url = m.params?.request?.url || ''
        if (blockUserInfo && url.includes('/api/auth/userinfo')) {
          send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'Aborted' })
        } else {
          send('Fetch.continueRequest', { requestId: m.params.requestId })
        }
        return
      }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((r2) => { const id = ++seq; pending.set(id, r2); ws.send(JSON.stringify({ id, method, params })) })
    ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result?.result?.value
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 120; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } }
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (r.result?.data) { fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64')); console.log('  📷 ' + name) }
    }
    const setUser = async (u) => ev(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(u))}); 'ok'`)
    const msgs = async () => ev(`JSON.stringify([].slice.call(document.querySelectorAll('.el-message, .el-message__content, .el-notification')).map(function(x){return (x.textContent||'').trim()}))`)
    const clearMsgs = async () => ev(`(function(){ document.querySelectorAll('.el-message').forEach(function(x){x.remove()}); return 'ok' })()`)
    const tableRows = async () => JSON.parse(await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.pds-table tbody tr')).filter(function(tr){return tr.querySelectorAll('td').length>3}).map(function(tr){return tr.querySelector('td').textContent.trim()}))`) || '[]')
    const clickStatus = async (idx) => ev(`(function(){
      var tds=[].slice.call(document.querySelectorAll('.pds-table tbody tr td.pds-c-jump'));
      var i = ${idx};
      if (!tds[i]) return 'NO_CELL';
      tds[i].click(); return 'CLICKED';
    })()`)

    await send('Page.enable'); await send('Runtime.enable')
    await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/auth/userinfo*', requestStage: 'Request' }] })
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1200, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')

    console.log('\n② 点状态 → 跳到该文件面板并打开那张单(admin,有权限)')
    await nav(`${BASE}/#/panelx/list/RD_PROD_DOCLIST`)
    await sleep(2500)
    check('矩阵有数据行', (await tableRows()).length > 0, JSON.stringify(await tableRows()))
    const firstProduct = (await tableRows())[0]
    await clickStatus(0) // 第 1 个状态格 = 文件1 = 规格书
    // focus 参数会被目标页 load() 消费掉(router.replace 抹掉),所以点击后**立刻**读一次 URL
    const urlNow = String(await ev('location.hash'))
    await sleep(3000)
    const url1 = await ev('location.hash')
    check(`URL 跳到规格书面板(${url1})`, String(url1).includes('/panelx/list/RD_SPEC_DOC'), String(url1))
    check('跳转时带上了 ?focus=单据号(点击后即读)', String(urlNow).includes('focus='), String(urlNow))
    // 规格书纸面右上角那一格 = 该产品的 编号(纸面不印单据号),故按产品编号断言"确实打开了这张单"
    const shown = await ev(`(function(){ var t=document.body.innerText||''; return t.indexOf(${JSON.stringify(firstProduct)})>=0 })()`)
    check(`目标页打开的是「${firstProduct}」的规格书`, shown === true, String(shown))
    const pager = await ev(`(function(){ var p=document.querySelector('.page-no'); return p? p.textContent.replace(/\\s+/g,' ').trim():'' })()`)
    check('目标页定位到了具体某一张(分页器有页码)', /\d/.test(String(pager)), String(pager))
    await shot('proddoclist-jump-to-specdoc.png')

    console.log('\n③ 无该面板查看权限 → 提示且不跳')
    blockUserInfo = true
    await setUser({ ...lr.data.user, isAdmin: false, visiblePanels: ['RD_PROD_DOCLIST'] })
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_PROD_DOCLIST`)
    await sleep(2500)
    const stillMatrix = await ev(`document.querySelectorAll('.pds-table tbody tr td.pds-c-jump').length > 0`)
    check('受限账号下矩阵照常渲染(只是跳转被拦)', stillMatrix === true, String(stillMatrix))
    await clearMsgs()
    await clickStatus(0)
    await sleep(1500)
    const m3 = await msgs()
    check('提示「无查看该面板的权限」', String(m3).includes('无查看该面板的权限'), String(m3))
    check('仍停在本面板(没跳走)', String(await ev('location.hash')).includes('RD_PROD_DOCLIST'), String(await ev('location.hash')))
    await shot('proddoclist-no-perm.png')
    // 恢复 admin 身份继续后面的搜索断言
    blockUserInfo = false
    await setUser(lr.data.user)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_PROD_DOCLIST`)
    await sleep(2500)

    console.log('\n④ 查询产品:按产品编号筛矩阵行')
    const all = (await tableRows()).length
    await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.as-side-btn')); for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='查询产品'){ bs[i].click(); return 'OK' } } return 'NO_BTN' })()`)
    await sleep(1200)
    const dlgTitle = await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog__title')); return ds.map(function(x){return x.textContent.trim()}).join('|') })()`)
    check('弹窗标题是「查询产品」', String(dlgTitle).includes('查询产品'), String(dlgTitle))
    await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent}); var d=ds.pop(); var inp=d.querySelector('input');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp,'DEMO-A'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'OK' })()`)
    await sleep(600)
    await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.el-dialog button')); for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='查询'){ bs[i].click(); return 'OK' } } return 'NO' })()`)
    await sleep(1500)
    const f1 = await tableRows()
    check(`筛出 1 行(实得 ${f1.length}:${f1.join(',')})`, f1.length === 1 && f1[0] === 'DEMO-A-001', JSON.stringify(f1))
    const banner = await ev(`(function(){ var b=document.querySelector('.pds-filter'); return b? b.textContent.replace(/\\s+/g,' ').trim() : 'NONE' })()`)
    check('顶部出「筛选中」横幅', String(banner).includes('筛选中'), String(banner))
    await shot('proddoclist-filter-banner.png')

    console.log('\n⑤ 模糊搜索:字段 = 状态（任一文件）')
    await ev(`(function(){ var b=document.querySelector('.pds-filter-clear'); if(b) b.click(); return 'CLEARED' })()`)
    await sleep(800)
    check('清除筛选后回到全表', (await tableRows()).length === all, `${(await tableRows()).length} vs ${all}`)
    await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.as-side-btn')); for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='模糊搜索'){ bs[i].click(); return 'OK' } } return 'NO' })()`)
    await sleep(1200)
    // 字段下拉:必须**点候选项**(el-select 认的是 option 点击,直接改 input 的值不会进模型 —— 踩过)
    await ev(`(function(){ var s=document.querySelector('.fuzzy-field input'); if(!s) return 'NO_SELECT'; s.click(); return 'OPEN' })()`)
    await sleep(900)
    const optLabels = await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.el-select-dropdown__item')).map(function(x){return x.textContent.trim()}))`)
    check('字段下拉里有「状态（任一文件）」', String(optLabels).includes('状态（任一文件）'), String(optLabels).slice(0, 300))
    const picked = await ev(`(function(){ var os=[].slice.call(document.querySelectorAll('.el-select-dropdown__item'));
      for (var i=0;i<os.length;i++){ if ((os[i].textContent||'').trim()==='状态（任一文件）'){ os[i].click(); return 'PICKED' } }
      return 'NOT_FOUND' })()`)
    check('已选中「状态（任一文件）」', picked === 'PICKED', picked)
    await sleep(700)
    await ev(`(function(){ var val=document.querySelector('.fuzzy-value input');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(val,'开发完毕');
      val.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
    await sleep(500)
    await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.fuzzy-btns .as-side-btn')); for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='查找'){ bs[i].click(); return 'OK' } } return 'NO' })()`)
    await sleep(1500)
    const f2 = await tableRows()
    const m2 = await msgs()
    // prod 两张演示产品的 4 个文件都已完成 ⇒ 「开发完毕」应命中全部;纯函数的"任一文件"语义由单测覆盖
    check(`状态含「开发完毕」⇒ 命中全部产品(实得 ${f2.join(',')})`, f2.length === all, JSON.stringify({ rows: f2, msg: m2 }))
    const resHead = await ev(`(function(){ var h=document.querySelector('.fuzzy-result-head'); return h? h.textContent.replace(/\\s+/g,' ').trim():'NONE' })()`)
    check('结果清单按「个产品」计数', String(resHead).includes('个产品') && String(resHead).includes(String(all)), String(resHead))
    check('横幅跟着更新(仍是筛选中)', String(await ev(`(function(){ var b=document.querySelector('.pds-filter'); return b? b.textContent.replace(/\\s+/g,' ').trim():'NONE' })()`)).includes('筛选中'))

    // 反例:库里没有「未开发」的文件 ⇒ 0 命中 + 提示(证明它真的在按状态筛,不是永远全中)
    await ev(`(function(){ var val=document.querySelector('.fuzzy-value input');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(val,'未开发');
      val.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
    await sleep(500)
    await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.fuzzy-btns .as-side-btn')); for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='查找'){ bs[i].click(); return 'OK' } } return 'NO' })()`)
    await sleep(1200)
    check('状态含「未开发」⇒ 0 命中(库里确实没有未开发的文件)', (await tableRows()).length === 0, JSON.stringify(await tableRows()))
    check('0 命中时提示「未找到匹配的产品」', String(await msgs()).includes('未找到匹配的产品'), String(await msgs()))
    await shot('proddoclist-fuzzy-status.png')

    console.log('\n⑥ 产品预览:卡片 = 产品行')
    // 先退出模糊搜索面板(它占着侧栏,「产品预览」按钮此刻不在 DOM 里)
    await ev(`(function(){ var b=document.querySelector('.fuzzy-back'); if(b) b.click(); return 'BACK' })()`)
    await sleep(1200)
    await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.as-side-btn')); for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='产品预览'){ bs[i].click(); return 'OK' } } return 'NO' })()`)
    await sleep(1500)
    const cards = JSON.parse(await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.preview-card')).map(function(c){return c.textContent.replace(/\\s+/g,' ').trim()}))`) || '[]')
    // 退出模糊搜索会清掉筛选 ⇒ 卡片数应等于**当前**表行数(全表)
    const nowRows = (await tableRows()).length
    check(`卡片数 = 当前表行数(${cards.length} vs ${nowRows})`, cards.length === nowRows, JSON.stringify(cards).slice(0, 260))
    check('卡片带 4 个文件状态', cards.length ? /文件1/.test(cards[0]) && /规格书/.test(cards[0]) : false, String(cards[0] || '').slice(0, 200))
    await shot('proddoclist-preview-cards.png')

    console.log('\n⑦ 回归冒烟:非矩阵面板的侧栏搜索必须保持原样')
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_DOM_TEST`)
    await sleep(3000)
    const btns = JSON.parse(await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent}).map(function(b){return (b.textContent||'').trim()}))`) || '[]')
    check('非矩阵面板仍是 查询单据 / 模糊搜索 / 单据预览', btns.includes('查询单据') && btns.includes('模糊搜索') && btns.includes('单据预览'), JSON.stringify(btns))
    check('非矩阵面板不出现 查询产品 / 产品预览', !btns.includes('查询产品') && !btns.includes('产品预览'), JSON.stringify(btns))
    await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.as-side-btn')); for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='模糊搜索'){ bs[i].click(); return 'OK' } } return 'NO' })()`)
    await sleep(1200)
    await ev(`(function(){ var s=document.querySelector('.fuzzy-field input'); if(s) s.click(); return 'OPEN' })()`)
    await sleep(900)
    const dlg = await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.el-select-dropdown__item')).map(function(x){return x.textContent.trim()}))`)
    check('非矩阵面板字段仍是 任意字段/表头字段/明细字段', String(dlg).includes('任意字段'), String(dlg).slice(0, 200))
    check('非矩阵面板字段里没有矩阵列口径', !String(dlg).includes('状态（任一文件）'), String(dlg).slice(0, 200))
  } finally {
    try { if (ws) ws.close() } catch {}
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('探针异常: ' + (e && e.stack ? e.stack : e)); process.exit(2) })
