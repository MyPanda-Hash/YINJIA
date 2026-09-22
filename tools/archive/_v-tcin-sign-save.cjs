/* _v-tcin-sign-save.cjs — 特采单「签名/年月日可填写」落库核查(会真的保存一张草稿单)
   流程:进编辑态 → 填 品质部签名+日期(年月日三段) 与 特采理由日期 → 点保存 →
        抓 /callButton 请求体(确认 head 带上了新键)与响应体(确认成功) → 打印单据号。
   随后用 sqlcmd 查 qc_tc_in 该单的新列,验证持久化。用法:node tools/archive/_v-tcin-sign-save.cjs */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9349
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const login = await (await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sign-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1338,1750',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const posts = []; const callIds = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Network.requestWillBeSent' && m.params.request.method !== 'GET')
        posts.push(m.params.request.method + ' ' + m.params.request.url.replace('http://localhost:8090', '')
          + '  body=' + (m.params.request.postData || '(无)').slice(0, 1200))
      if (m.method === 'Network.responseReceived' && m.params.response.url.includes('/callButton'))
        callIds.push({ id: m.params.requestId, status: m.params.response.status })
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(700); return } } }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/panelx/list/QC_TC_IN')
    await sleep(3500)
    // 关引导浮层(自定义 .wizard-mask,不是 el-dialog)
    await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) { (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 'WZ' } return 'NONE' })()`)
    await sleep(1200)

    // 进编辑态
    for (let i = 0; i < 8; i++) {
      await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.replace(/\\s/g,'').includes('新增流程')); if (b && !document.querySelector('.approval-sheet')) b.click(); return !!b })()`)
      await sleep(1800)
      const st = await evaluate(`(() => { if (document.querySelector('.el-textarea__inner')) return 'EDITABLE'; const b = [...document.querySelectorAll('.as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增'); if (b && !(b.className||'').includes('disabled')) { b.click(); return 'CLICKED' } return 'WAIT' })()`)
      if (st === 'EDITABLE') break
      await sleep(2200)
    }
    await sleep(2000)

    // 填:品质部(第2个 dept 块)签名+年月日;特采理由 的 年月日
    const filled = await evaluate(`(() => {
      const setV = (el, v) => {
        const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value');
        d && d.set ? d.set.call(el, v) : (el.value = v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const out = {}
      const depts = [...document.querySelectorAll('.q-dept')]
      const qc = depts.find(d => (d.querySelector('.q-dept-name')||{}).innerText?.includes('品质部'))
      if (!qc) return { err: '未找到品质部块' }
      const sl = qc.querySelector('.q-dept-signline')
      if (!sl) return { err: '品质部无签名行' }
      const nameIn = sl.querySelector('.q-sign-name input')
      if (nameIn) { setV(nameIn, '张品质'); out.签名 = '张品质' }
      const [dy, dm, dd] = [...sl.querySelectorAll('.q-date-in')].map(w => w.querySelector('input'))
      if (dy && dm && dd) { setV(dy, '2026'); setV(dm, '9'); setV(dd, '22'); out.日期三段 = '2026/9/22' }
      const sd = document.querySelector('.q-sign-date')  // 特采理由 申请人 年月日(第一个 q-sign-date)
      const [ty, tm, td] = sd ? [...sd.querySelectorAll('.q-date-in')].map(w => w.querySelector('input')) : []
      if (ty && tm && td) { setV(ty, '2026'); setV(tm, '9'); setV(td, '21'); out.特采理由日期 = '2026/9/21' }
      return out
    })()`)
    console.log('=== 填写:', JSON.stringify(filled))
    await sleep(600)
    const readBack = await evaluate(`(() => ({
      品质部签名: document.querySelectorAll('.q-dept')[1]?.querySelector('.q-sign-name input')?.value,
      品质部日期: [...(document.querySelectorAll('.q-dept')[1]?.querySelectorAll('.q-date-in') || [])].map(w => w.querySelector('input')?.value).join('|'),
      特采理由日期: [...(document.querySelector('.q-sign-date')?.querySelectorAll('.q-date-in') || [])].map(w => w.querySelector('input')?.value).join('|'),
      签名行数: document.querySelectorAll('.q-dept-signline').length,
      可填日期组数: document.querySelectorAll('.q-sign-date .q-date-in.q-dy, .q-dept-signline .q-date-in.q-dy').length,
    }))()`)
    console.log('=== DOM 回读:', JSON.stringify(readBack))

    posts.length = 0; callIds.length = 0
    const saved = await evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '保存'); if (!b) return 'NO-BUTTON'; if ((b.className||'').includes('disabled')) return 'DISABLED'; b.click(); return 'CLICKED' })()`)
    console.log('=== 点保存:', saved)
    await sleep(4000)
    for (const c of callIds) {
      const rb = await send('Network.getResponseBody', { requestId: c.id })
      console.log('   响应 [' + c.status + ']:', (rb.result?.body || '').slice(0, 300))
    }
    posts.forEach(x => console.log('   请求:', x.slice(0, 900)))
    const docno = await evaluate(`(document.querySelector('.as-docno') || { innerText: '' }).innerText.trim()`)
    const msgs = await evaluate(`[...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText||'').replace(/\\s+/g,' ').trim()).slice(0,3)`)
    console.log('=== 单据号:', docno, ' 提示:', JSON.stringify(msgs))
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch(e => { console.error(e); process.exit(1) })
