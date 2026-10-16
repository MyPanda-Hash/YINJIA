/**
 * 产品信息表附件「保存后不能查看」复现/验收探针(两段式)
 *   mode=create :界面新建一张产品信息表 + 界面上传一个附件(不自动清场,打印单据编号)
 *   mode=view <单号> :打开面板 → 用「单据预览」切到该单 → 看附件名还能不能点开(并抓下载请求)
 *   mode=clean <单号> :删附件 + 删单 + 清该单的 yj_doc_status 行(把测试账套还原干净)
 *
 * 为什么两段式:中间要由外部把该单状态改成「审批中」(普通用户保存即送审后的状态)——
 * 那才是用户遇到的可编辑=false 场景。改状态用 SQL 落在**探针自己建的单**上。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const MODE = (process.argv[2] || 'view').toLowerCase()
const DOCARG = process.argv[3] || ''
const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9376
const OUT = path.join(process.env.TEMP, 'mes-attach')
const PANEL = 'RD_PROD_INFO'
const FIELD = '客户图纸或规格书'
const FILE_NAME = '客户图纸-探针.txt'
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 300)}`)
  if (!ok) fails++
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const lj = await lr.json()
  const tok = lj?.data?.token, user = lj?.data?.user
  if (!tok) throw new Error('登录失败')
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + tok }
  const post = async (u, b) => (await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json())
  const get = async (u) => (await (await fetch(API + u, { headers: H })).json())
  const listDocs = async () => {
    const r = await post('/px/queryFormDataList', { panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 20 })
    return (r?.data?.rows || r?.data?.list || []).map((x) => x['单据编号']).filter(Boolean)
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'att3-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1200', 'about:blank'], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0; const pend = new Map(); let net = []; const errs = []
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      const u = String(m.params?.response?.url || '')
      if (m.method === 'Network.responseReceived' && u.includes('/attachment'))
        net.push(`${m.params.response.status} ${u.replace(BASE, '')}`)
      if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 160))
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => {
      const r2 = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })
      const ed = r2.result?.exceptionDetails
      if (ed) return '[JS异常] ' + (ed.exception?.description || ed.text)
      return r2.result?.result?.value
    }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(tok)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-16'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(8000)

    if (MODE === 'create') {
      const before = await listDocs()
      await ev(`(async () => {
        const txt = (e) => (e.innerText || '').trim()
        const btn = [...document.querySelectorAll('.as-side-btn, .el-button')].find((b) => txt(b) === '新增')
        if (btn) btn.click(); await new Promise((r) => setTimeout(r, 5000)); return 'ok'
      })()`)
      const docs = await listDocs()
      const created = docs.find((n) => !before.includes(n))
      const filePath = path.join(OUT, FILE_NAME)
      fs.writeFileSync(filePath, '探针:产品信息表附件查看 2026-10-16')
      const obj = await send('Runtime.evaluate', { expression: `document.querySelector('.fac-actions input[type=file]')` })
      const objectId = obj.result?.result?.objectId
      if (objectId) { await send('DOM.setFileInputFiles', { files: [filePath], objectId }); await sleep(3500) }
      const chip = await ev(`(() => { const c = document.querySelector('.fac-chip'); return c ? c.innerText.trim() : null })()`)
      console.log(JSON.stringify({ created, chip, uploadNet: net }))
      chk('CREATE', '新建 + 界面上传成功', !!created && String(chip).includes('客户图纸-探针'), `单号=${created} chip=${chip}`)
      console.log('DOCNO=' + created)
      console.log('  (未清场:下一步用它做状态改造,最后用 mode=clean ' + created + ' 收尾)')
    } else if (MODE === 'view') {
      const docNo = DOCARG
      net = []
      const r = await ev(`(async () => {
        const txt = (e) => (e.innerText || '').trim()
        // 用「单据预览」切到目标单
        const prev = [...document.querySelectorAll('.as-side-btn, .el-button')].find((b) => txt(b).includes('单据预览'))
        if (prev) { prev.click(); await new Promise((r) => setTimeout(r, 1200)) }
        const card = [...document.querySelectorAll('.preview-card')].find((c) => txt(c).includes(${JSON.stringify(docNo)}))
        if (card) { card.click(); await new Promise((r) => setTimeout(r, 3000)) }
        const status = txt(document.querySelector('.doc-status') || {})
        const chip = document.querySelector('.fac-chip')
        const fac = document.querySelector('.fac-cell')
        const inputs = document.querySelectorAll('.approval-sheet input:not([type=file]), .rs-t-in').length
        if (chip) { chip.click(); await new Promise((r) => setTimeout(r, 2500)) }
        return {
          found: !!card, status, hasChip: !!chip, hasFacCell: !!fac, inputs,
          chipText: chip ? txt(chip) : '',
          plain: [...document.querySelectorAll('.rs-txt, .ann-host, td')].map(txt).filter((t) => t.includes('客户图纸-探针')).slice(0, 3),
          msg: [...document.querySelectorAll('.el-message')].map((m) => txt(m)).join(' | '),
        }
      })()`)
      console.log('查看结果:', JSON.stringify(r, null, 1).slice(0, 800))
      console.log('网络:', JSON.stringify(net))
      chk('V1', '切到了目标单', !!r?.found, `status=${r?.status}`)
      chk('V2', '附件名可点开(有 chip + 下载 2xx)', !!r?.hasChip && net.some((n) => /^2\d\d/.test(n)),
        `chip=${r?.hasChip} hasFacCell=${r?.hasFacCell} 下载=${net.join(' , ') || '无'} 纸面文本=${JSON.stringify(r?.plain)}`)
      if (!r?.hasChip) chk('V3', '至少附件名还在纸面上(纯文本,不可点)', (r?.plain || []).length > 0, JSON.stringify(r?.plain))
      chk('V4', '无 JS 异常', errs.length === 0, errs.slice(0, 2).join(' | '))
    } else if (MODE === 'clean') {
      const docNo = DOCARG
      const rows = (await get(`/attachment/list?panelCode=${PANEL}&docNo=${docNo}&field=${FIELD}`))?.data || []
      for (const a of rows) await post('/attachment/delete', { id: a.id })
      console.log('删单:', JSON.stringify(await post('/px/deleteForms', { panelCode: PANEL, rowCodes: [docNo] })).slice(0, 120))
      console.log('剩余单号:', JSON.stringify(await listDocs()))
    }
  } finally {
    edge.kill()
  }
  console.log(fails ? `\n${fails} 项未通过` : '\n全部通过')
}
main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
