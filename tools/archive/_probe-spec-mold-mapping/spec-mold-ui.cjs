/**
 * 界面级验收:成型工艺清单「产品编号」一选,规格书的检验要求是否落进**纸面真实数据格**
 * (2026-10-16 用户报障「数据没有对应导入下方表格,比如碳棒尺寸,压降,抗压强度…外径的 +-0.5 就是公差数据」)
 *
 * 与 spec-mold-mapping.cjs 的分工:那个验的是「真 payload × 真配置」的纯函数结果;
 * 这个验的是**界面接线**(选完参照 → autoFillFromSpec → 写进 props.head → 纸上那几格真的变了)。
 *
 * 用法:node spec-mold-ui.cjs [单号] [产品编号]     # 默认 MP-2026-10-0018 / CB-YL-001(测试账套)
 * ⚠ 全程**不点保存**:只是让界面把带出的值显示出来,库里那张单一个字节都不动。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const DOCARG = process.argv[2] || 'MP-2026-10-0018'
const CODE = process.argv[3] || 'CB-YL-001'
const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9393
const OUT = path.join(process.env.TEMP, 'mes-ann2')
const PANEL = 'RD_MOLD_PROC'
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 400)}`)
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
  if (!tok) throw new Error('登录失败(测试账套)')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'smu-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1700,1300', 'about:blank'], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0; const pend = new Map(); const errs = []; const net = []
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      const u = String(m.params?.response?.url || '')
      if (m.method === 'Network.responseReceived' && u.includes('specByProduct')) net.push(`${m.params.response.status} ${u.replace(BASE, '')}`)
      if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => {
      const r2 = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })
      const ed = r2.result?.exceptionDetails
      if (ed) return '[JS异常] ' + (ed.exception?.description || ed.text)
      return r2.result?.result?.value
    }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1300, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(tok)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-16'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(9000)

    // ① 打开目标单据(左栏预览 + 搜索框)
    const opened = await ev(`(async () => {
      const txt = (e) => (e.innerText || '').trim()
      const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms))
      const prev = [...document.querySelectorAll('.as-side-btn, .el-button')].find((b) => txt(b).includes('单据预览'))
      if (prev) { prev.click(); await sleep2(1200) }
      const box = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('快速'))
      if (box) {
        const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        d.set.call(box, ${JSON.stringify(DOCARG)})
        box.dispatchEvent(new Event('input', { bubbles: true }))
        await sleep2(2000)
      }
      let card = [...document.querySelectorAll('.preview-card')].find((c) => txt(c).includes(${JSON.stringify(DOCARG)}))
      if (card) { card.click(); await sleep2(4000) }
      const tab = [...document.querySelectorAll('.rsp-page-tab')].find((t) => txt(t).includes('成型工艺清单'))
      if (tab) { tab.click(); await sleep2(1500) }
      return { card: !!card, sheet: !!document.querySelector('.record-sheet'), docNo: txt(document.querySelector('.rs-docno') || {}).slice(0, 40) }
    })()`)
    console.log('[开单]', JSON.stringify(opened))
    chk('① 打开目标单 MP-2026-10-0018', !!opened?.card && !!opened?.sheet, JSON.stringify(opened))
    if (!opened?.sheet) throw new Error('没打开文书页,后面的断言无意义')

    // ② 选「产品编号(炭棒编号)」参照 → 弹窗里挑 CB-YL-001 → 确定导入
    const picked = await ev(`(async () => {
      const txt = (e) => (e.innerText || '').trim()
      const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms))
      const cells = [...document.querySelectorAll('.rs-ref-ctl')]
      if (!cells.length) return { err: '页面上没有参照格' }
      cells[0].click()
      await sleep2(2500)
      const dlg = document.querySelector('.el-dialog')
      if (!dlg) return { err: '参照弹窗没打开', cells: cells.length }
      const box = dlg.querySelector('input')
      if (box) {
        const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        d.set.call(box, ${JSON.stringify(CODE)})
        box.dispatchEvent(new Event('input', { bubbles: true }))
        await sleep2(300)
        const q = [...dlg.querySelectorAll('button')].find((b) => txt(b).includes('查询'))
        if (q) q.click()
        else box.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }))
        await sleep2(2500)
      }
      const row = dlg.querySelector('.el-table__body tbody tr')
      let rows = 0
      if (row) {
        const cb = row.querySelector('.el-checkbox')
        if (cb) cb.click()
        await sleep2(400)
      }
      rows = dlg.querySelectorAll('.el-table__body tbody tr').length
      const btn = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => txt(b).includes('确定导入'))
      const btnText = btn ? txt(btn) : '(无)'
      if (btn && !btn.disabled) btn.click()
      await sleep2(5000)
      return { rows, btnText, dlgClosed: !document.querySelector('.el-dialog') }
    })()`)
    console.log('[选参照]', JSON.stringify(picked))
    chk('② 参照弹窗选中并确定导入', !!picked && !picked.err && !picked.dlgClosed === false, JSON.stringify(picked))

    // ③ 纸面那几格真的被写进去了(按"标签行 → 下一行同列输入框"读,与纸面版式一致)
    const read = await ev(`(() => {
      const norm = (s) => String(s || '').replace(/\\s+/g, '')
      const labelRow = (needle) => [...document.querySelectorAll('table tr')]
        .filter((t) => t.offsetParent && norm(t.innerText).includes(needle) && !t.querySelector('input'))[0]
      const vals = (needle) => {
        const tr = labelRow(needle)
        if (!tr || !tr.nextElementSibling) return null
        return [...tr.nextElementSibling.querySelectorAll('input')].map((i) => i.value)
      }
      return {
        尺寸: vals('炭棒外径mm'),
        跌落: vals('高度cm'),
        抗压: vals('强度要求kgf'),
        压降: vals('压降标准kpa'),
        hint: norm(document.body.innerText).includes('已按规格书') || norm(document.body.innerText).includes('规格书'),
      }
    })()`)
    console.log('[纸面]', JSON.stringify(read, null, 1))
    if (read?.尺寸) {
      chk('③ 炭棒尺寸四格(外径/公差/内径/公差)', JSON.stringify(read.尺寸) === JSON.stringify(['34.5', '±0.5', '12.5', '±0.5']), JSON.stringify(read.尺寸))
      chk('③ 跌落强度块(高度cm/跌落次数/要求)', read.跌落?.[0] === '60' && read.跌落?.[1] === '3' && String(read.跌落?.[2] || '').includes('垂直跌落3次'), JSON.stringify(read.跌落))
      chk('③ 抗压强度(测试间距/压头下降速度/强度要求kgf)', JSON.stringify(read.抗压) === JSON.stringify(['40', '5', '≥30kgf']),
        JSON.stringify(read.抗压) + '  ← 前两格取自规格书的**检验方法**')
      chk('③ 压降(测试管路留空/压降测试流速/压降标准kpa)', read.压降?.[1] === '0.9' && read.压降?.[2] === '≤20kpa', JSON.stringify(read.压降))
    } else {
      chk('③ 读不到纸面格', false, JSON.stringify(read))
    }
    chk('④ 取了规格书(接口 2xx)', net.some((n) => /^2\d\d/.test(n)), net.join(' | ') || '无')
    chk('⑤ 无 JS 异常', errs.length === 0, errs.slice(0, 3).join(' | '))

    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (shot?.result?.data) {
      const p = path.join(OUT, 'spec-mold-carry.png')
      fs.writeFileSync(p, Buffer.from(shot.result.data, 'base64'))
      console.log('SHOT=' + p)
    }
  } finally {
    edge.kill()
    await sleep(300)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(fails ? `\n${fails} 项未通过` : '\n全部通过')
  if (fails) process.exitCode = 1
}
main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
