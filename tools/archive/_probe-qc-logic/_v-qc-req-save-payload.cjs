/* _v-qc-req-save-payload.cjs — 校验「编辑草稿 → 原行写回 → 保存报文」这条链没断
   手法:在页面加载完成后开 Fetch 拦截,新增行并打一个唯一标记,点「保存」,
        截获请求 postData 检查标记在不在,**然后 failRequest 掉**(不落库、不动真数据)。
   用法:node tools/archive/_probe-qc-logic/_v-qc-req-save-payload.cjs [前端基址] */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9364
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090/api'
const WEB = process.argv[2] || 'http://localhost:5173'
const MARK = 'ZZQA' + String(Date.now()).slice(-6)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const T0 = Date.now()
const ok = (name, cond, detail) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); if (!cond) process.exitCode = 1 }

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-req-pay-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map(); const paused = []
  ws.addEventListener('message', async (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Fetch.requestPaused') {
      const p = m.params
      if (/\/px\/|button/i.test(p.request.url) && p.request.method === 'POST') {
        paused.push({ url: p.request.url, postData: p.request.postData || '' })
        await send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Aborted' }).catch(() => {})
      } else {
        await send('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {})
      }
    }
  })
  const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
  const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
  const waitFor = async (exp, ms = 30000, step = 800) => { for (let i = 0; i < Math.ceil(ms / step); i++) { const v = await evaluate(exp); if (v) return v; await sleep(step) } return null }
  await send('Page.enable'); await send('Runtime.enable')

  await navigate(`${WEB}/#/login`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
  for (let a = 1; a <= 2; a++) {
    await navigate('about:blank')
    await navigate(`${WEB}/#/panelx/list/QC_INSP_REQ`)
    await sleep(3000)
    await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
    await waitFor(`!document.querySelector('.wizard-mask')`, 8000, 400)
    const ready = await waitFor(`(() => {
      const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
      return (f && f.querySelector('.rs-add')) ? 'READY' : ''
    })()`, 15000)
    if (ready === 'READY') break
  }

  // 新增一行 → 往头两格打字(第二格是关键:证明是逐格回写)
  await evaluate(`(() => { const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉')); f.querySelector('.rs-add').click(); return 1 })()`)
  await sleep(1200)
  const typed = await evaluate(`(() => {
    const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
    const trs = [...f.querySelectorAll('tbody tr')].filter(t => t.querySelector('.rs-td'))
    const tr = trs[trs.length - 1]
    const ins = [...tr.querySelectorAll('.rs-td input')]
    if (ins.length < 2) return 'LESS-THAN-2-INPUTS:' + ins.length
    ins[0].focus(); document.execCommand('insertText', false, ${JSON.stringify(MARK)})
    ins[1].focus(); document.execCommand('insertText', false, 'SECOND')
    return 'typed'
  })()`)
  console.log('打字:', typed, '标记:', MARK)
  await sleep(800)
  const shown = await evaluate(`(() => {
    const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
    const trs = [...f.querySelectorAll('tbody tr')].filter(t => t.querySelector('.rs-td'))
    const tr = trs[trs.length - 1]
    return [...tr.querySelectorAll('.rs-td input')].map(i => i.value).join(' | ')
  })()`)
  console.log('屏幕上两格:', JSON.stringify(shown))

  // 开拦截 → 点保存 → 读报文(fail 掉,不落库)
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  await evaluate(`(() => { const b = [...document.querySelectorAll('.qc-bar-btn')].find(x => x.innerText.includes('保存')); b.click(); return 1 })()`)
  await sleep(4000)
  await send('Fetch.disable')

  console.log('\n截到的 POST 请求数:', paused.length)
  const save = paused.find(p => p.postData.includes(MARK))
  if (save) {
    const d = JSON.parse(save.postData)
    const items = d?.formData?.detail?.items || d?.detail?.items || d?.formData?.items || []
    const hit = items.filter(r => String(r['物料编号'] || '').includes(MARK))
    console.log('保存报文里带标记的行:', JSON.stringify(hit))
    ok('新增行打的两个字都进了保存报文', hit.length === 1 && String(hit[0][Object.keys(hit[0])[1]] || '') !== '' && JSON.stringify(hit[0]).includes('SECOND'), JSON.stringify(hit[0]).slice(0, 200))
  } else {
    console.log('未截到含标记的保存请求。报文预览:')
    paused.slice(0, 3).forEach(p => console.log('  ', p.url, p.postData.slice(0, 300)))
    ok('新增行打的字进了保存报文', false)
  }
  console.log('(请求已 Abort,未落库)')

  try { edge.kill() } catch {}
  ws.close()
  console.log(`\n总耗时 ${Math.round((Date.now() - T0) / 1000)}s`)
  process.exit(0)
}
main().catch(e => { console.error('探针异常:', e.message); process.exitCode = 1 })
