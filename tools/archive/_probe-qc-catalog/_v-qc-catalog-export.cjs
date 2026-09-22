/* _v-qc-catalog-export.cjs — 检验目录导出链路核查(纸面专属 Excel 导出 + 纸张 PDF 导出)
   ① 右侧「导出」→ 弹窗出现「导出 Excel（.xlsx）」
   ② 点 Excel → 下载出 .xlsx(控制列表专属导出:标题+列头+批次行)
   ③ 点 PDF → 下载出 .pdf(纸张实际尺寸单页)
   用法:node tools/archive/_probe-qc-catalog/_v-qc-catalog-export.cjs(需 5173 + 8090 已起) */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9353
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const login = await (await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-catexp-'))
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dl-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1338,1750',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errors = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push((m.params.args || []).map((a) => a.value).join(' '))
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl })

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/panelx/list/QC_CATALOG')
    await sleep(5500)
    await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
    await sleep(1500)

    // ① 打开导出弹窗
    const opened = await evaluate(`(() => {
      const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g, '') === '导出')
      if (!b) return 'NOBTN'
      b.click(); return 'CLICKED'
    })()`)
    ok('右侧「导出」可点', opened === 'CLICKED', opened)
    await sleep(900)
    const dlg = await evaluate(`(() => { const d = [...document.querySelectorAll('.el-dialog')].find(e => e.offsetParent !== null); return d ? d.innerText : '' })()`)
    ok('导出弹窗含 Excel 选项', dlg.includes('导出 Excel'))
    ok('导出弹窗含 PDF 选项', dlg.includes('导出 PDF'))

    // ② Excel
    await evaluate(`(() => { const it = [...document.querySelectorAll('.efmt-item')].find(e => e.innerText.includes('Excel')); it?.click(); return !!it })()`)
    let xlsx = ''
    for (let i = 0; i < 30; i++) {
      await sleep(500)
      xlsx = (fs.readdirSync(dl) || []).find((f) => f.endsWith('.xlsx') && !f.endsWith('.crdownload'))
      if (xlsx) break
    }
    ok('Excel 已下载(.xlsx)', !!xlsx, xlsx || JSON.stringify(fs.readdirSync(dl)))
    if (xlsx) {
      const size = fs.statSync(path.join(dl, xlsx)).size
      ok('xlsx 非空', size > 2000, `size=${size}`)
      // 文件是 zip:校验内含 xl/worksheets 与 sharedStrings(说明是真表格而不是错误页)
      const buf = fs.readFileSync(path.join(dl, xlsx))
      ok('xlsx 为合法 zip(zip 魔数 PK)', buf[0] === 0x50 && buf[1] === 0x4b)
      const txt = buf.toString('latin1')
      ok('xlsx 内含 sheet1.xml', txt.includes('xl/worksheets/sheet1.xml'))
    }

    // ③ PDF
    await evaluate(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '导出'); b?.click(); return 1 })()`)
    await sleep(900)
    await evaluate(`(() => { const it = [...document.querySelectorAll('.efmt-item')].find(e => e.innerText.includes('PDF')); it?.click(); return !!it })()`)
    let pdf = ''
    for (let i = 0; i < 40; i++) {
      await sleep(500)
      pdf = (fs.readdirSync(dl) || []).find((f) => f.endsWith('.pdf') && !f.endsWith('.crdownload'))
      if (pdf) break
    }
    ok('PDF 已下载(.pdf)', !!pdf, pdf || JSON.stringify(fs.readdirSync(dl)))
    if (pdf) {
      const size = fs.statSync(path.join(dl, pdf)).size
      ok('pdf 非空', size > 5000, `size=${size}`)
      ok('pdf 文件头 %PDF', fs.readFileSync(path.join(dl, pdf)).subarray(0, 4).toString() === '%PDF')
    }
    ok('导出期间无 console 错误', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log('   下载目录:', dl, fs.readdirSync(dl).join(', '))
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* 清理失败无碍 */ }
  }
  console.log(process.exitCode ? '\n== 有失败项 ==' : '\n== 全部通过 ==')
  process.exit(process.exitCode || 0)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
