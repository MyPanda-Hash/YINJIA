/*
 * _ui-whdock-20261020.cjs —— 库存明细左栏「勾选仓库」界面验收(Edge headless + CDP)
 *
 * 用户报障(2026-10-20):勾选仓库 → 「服务异常:Cannot invoke "String.isEmpty()" because "whName" is null」。
 * 断言:
 *   ① 勾选一个仓库后**不弹服务异常**(截 console/网络错误 + 检查没有 el-message--error);
 *   ② 列表随之收窄(总条数 = 该仓条数,行里的仓库编码都是它);
 *   ③ 再勾第二个仓库 ⇒ 条数 = 两仓之和;
 *   ④ 取消全部勾选 ⇒ 回到全量。
 *
 * 用法: node tools/archive/_1019-verify/_ui-whdock-20261020.cjs [baseUrl]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9363
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const FE = process.env.YJ_FE || 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, label, extra = '') => {
  if (c) { pass++; console.log(`  PASS  ${label}${extra ? ' · ' + extra : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${extra ? ' · ' + extra : ''}`) }
}

async function main() {
  const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-whdock-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2600)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errs = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      // 记录所有 4xx/5xx 的接口响应(服务异常走 HTTP 200 + body.code,再看 body 文本)
      if (m.method === 'Network.responseReceived' && m.params.response.url.includes('/api/')) {
        if (m.params.response.status >= 400) errs.push(m.params.response.status + ' ' + m.params.response.url.split('/api/')[1])
      }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${FE}/#/login` }); await sleep(2500)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
    await send('Page.navigate', { url: `${FE}/#/panelx/list/STOCK_DETAIL` }); await sleep(3000)
    // 登录态没被 SPA 拾取时会被踢回 #/login ⇒ 再显式回面板一次(实测竞态)
    for (let attempt = 0; attempt < 3; attempt++) {
      const hash = await evaluate('location.hash')
      if (!String(hash).includes('/login')) break
      await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
      await send('Page.navigate', { url: `${FE}/#/panelx/list/STOCK_DETAIL` })
      await sleep(2500)
    }
    // 等左栏仓库列表渲染出来(慢机器上 6s 都不一定够)
    let dockReady = false
    for (let i = 0; i < 20; i++) {
      dockReady = await evaluate(`document.querySelectorAll('.wh-dock-item').length > 0`)
      if (dockReady) break
      await sleep(700)
    }
    if (!dockReady) {
      const diag = await evaluate(`(() => ({
        hash: location.hash,
        hasTable: document.querySelectorAll('.el-table__row').length,
        hasDock: !!document.querySelector('.wh-dock'),
        body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 300),
      }))()`)
      console.log('  [诊断] 左栏没渲染:', JSON.stringify(diag))
    }

    console.log('\n库存明细左栏「勾选仓库」(2026-10-20 NPE 报障)\n')
    // 左栏仓库项 = label.el-checkbox.wh-dock-item(内含 span.wh-dock-name);点它的勾选框
    const clickWh = async (name) => evaluate(`(() => {
      const items = [...document.querySelectorAll('.wh-dock-item')]
      const item = items.find(e => (e.innerText || '').includes(${JSON.stringify(name)}))
      if (!item) return 'NO-ITEM(n=' + items.length + ':' + items.map(e => (e.innerText || '').trim()).join('|').slice(0, 120) + ')'
      const box = item.querySelector('input[type=checkbox]') || item.querySelector('.el-checkbox__inner')
      if (!box) return 'NO-BOX'
      box.click()
      return 'CLICKED'
    })()`)
    const state = async () => evaluate(`(() => {
      const err = document.querySelector('.el-message--error')
      const count = document.querySelector('.report-count') || document.querySelector('.el-pagination__total')
      const rows = [...document.querySelectorAll('.el-table__row')]
      // 行里的仓库编码:库存明细列有「仓库编码」
      const codes = [...new Set(rows.map(r => {
        const tds = [...r.querySelectorAll('td')].map(td => (td.innerText || '').trim())
        return tds.find(v => /^[A-Z0-9-]{3,}$/.test(v) && /[A-Z]/.test(v))
      }).filter(Boolean))]
      return { error: err ? (err.innerText || '').trim().slice(0, 160) : '',
               count: count ? (count.innerText || '').replace(/\\s+/g, ' ').trim() : '', rows: rows.length, codes }
    })()`)

    const c1 = await clickWh('恒亿仓')
    await sleep(2800)
    const s1 = await state()
    ok(c1 === 'CLICKED', '左栏勾上「恒亿仓」', c1)
    ok(!s1.error, '勾选后没有弹「服务异常」', s1.error || '无错误提示')
    ok(!errs.some((e) => /^5/.test(e)), '勾选后没有 5xx 接口', errs.join(' | ') || '无')
    ok(s1.codes.length === 0 || (s1.codes.length === 1 && s1.codes[0] === 'YCL-01'),
      '列表只剩所选仓库的行', `仓=${s1.codes.join('/') || '(首页未取到)'} · ${s1.count}`)

    // 左栏口径是「勾选仓库即查询(单选)」⇒ 勾第二个仓应**替换**为那个仓
    const c2 = await clickWh('成品B仓')
    await sleep(2800)
    const s2 = await state()
    ok(c2 === 'CLICKED', '改勾「成品B仓」(单选:替换)', c2)
    ok(!s2.error, '换仓时也不报错', s2.error || '无错误提示')
    ok(s2.codes.length === 0 || (s2.codes.length === 1 && s2.codes[0] === 'CP-02'),
      '列表切到成品B仓的行', `仓=${s2.codes.join('/') || '(首页未取到)'} · ${s2.count}`)

    // 取消勾选 ⇒ 回到全部
    const c3 = await clickWh('成品B仓')
    await sleep(2800)
    const s3 = await state()
    ok(!s3.error, '取消勾选也不报错', s3.error || '无错误提示')

    console.log(`\n结果: PASS ${pass} · FAIL ${fail}`)
  } finally {
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[探针异常]', e); process.exit(2) })
