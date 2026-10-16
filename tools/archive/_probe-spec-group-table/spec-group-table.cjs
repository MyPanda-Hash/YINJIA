/**
 * 验收探针:规格书「检验项目及标准」分组表 —— 组内第 2 行起是否整行右移(空白格)
 *
 * 背景(2026-10-16 用户报障,截图指出「检验项目下面和检验要求下面有空白格」):
 *   分组设计表里,组首行的 序号/组名 两格带 rowspan 占住整组;旧代码在后续行**照样输出两个空 <td>**,
 *   浏览器于是把这行的 子项目/要求/方法/依据 依次右移两列 —— 视觉上子项目列与检验要求列空白,
 *   而「除余氯寿命」落在检验方法列、「寿命920L，全程加标」落在检验依据列。
 *
 * ⚠ 上一轮我用「按 DOM 顺序读 td」的 dump 得到 [空][空][除余氯寿命][寿命920L…] 就以为没问题 ——
 *   那是读错了:DOM 顺序不等于**渲染后的列位**。本探针按 rowspan/colspan 重建可视网格再判定。
 *
 * 用法: node probe-spec-group-table.cjs             # 建单→选标准库→按可视网格 dump+判定
 *       node probe-spec-group-table.cjs clean <单号>
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const MODE = (process.argv[2] || 'run').toLowerCase()
const DOCARG = process.argv[3] || ''
const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9380
const OUT = path.join(process.env.TEMP, 'mes-spec')
const PANEL = 'RD_SPEC_DOC'
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 240)}`)
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
  const listDocs = async () => {
    const r = await post('/px/queryFormDataList', { panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 20 })
    return (r?.data?.rows || r?.data?.list || []).map((x) => x['单据编号']).filter(Boolean)
  }
  if (MODE === 'clean') {
    console.log('删单:', JSON.stringify(await post('/px/deleteForms', { panelCode: PANEL, rowCodes: [DOCARG] })).slice(0, 120))
    console.log('剩余:', JSON.stringify(await listDocs()))
    return
  }
  const before = await listDocs()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'grp-'))
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
    let id = 0; const pend = new Map(); const errs = []
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 160))
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => {
      const r2 = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })
      const ed = r2.result?.exceptionDetails
      if (ed) return '[JS异常] ' + (ed.exception?.description || ed.text)
      return r2.result?.result?.value
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1300, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(tok)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-16'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(8000)
    await ev(`(async () => { const txt=(e)=>(e.innerText||'').trim();
      const b=[...document.querySelectorAll('.as-side-btn, .el-button')].find(x=>txt(x)==='新增'); if(b)b.click();
      await new Promise(r=>setTimeout(r,5000)); return 'ok' })()`)
    const docs = await listDocs()
    const created = docs.find((n) => !before.includes(n))
    console.log('新单号 =', created)

    await ev(`(async () => {
      const txt = (e) => (e.innerText || '').trim()
      const tab = [...document.querySelectorAll('.el-tabs__item, [class*=tab]')].find((t) => txt(t) === '检验项目及标准')
      if (tab) { tab.click(); await new Promise((r) => setTimeout(r, 1500)) }
      const b = [...document.querySelectorAll('.rs-lib-btn')].find((x) => txt(x).includes('从标准库勾选'))
      if (b) b.click(); await new Promise((r) => setTimeout(r, 2000))
      return 'ok'
    })()`)
    await ev(`(async () => {
      const txt = (e) => (e.innerText || '').trim()
      const dlg = document.querySelector('.el-dialog')
      if (!dlg) return 'no-dialog'
      for (const b of [...dlg.querySelectorAll('.el-checkbox')]) {
        const label = txt(b)
        if (!/除余氯寿命|初始去除率|^\\s*\\*?外观/.test(label)) continue
        const inp = b.querySelector('input')
        if (!inp || !inp.checked) b.click()
      }
      await new Promise((r) => setTimeout(r, 500))
      const btn = [...dlg.querySelectorAll('.el-dialog__footer .el-button')].find((x) => txt(x).includes('追加选中项'))
      if (btn) btn.click()
      await new Promise((r) => setTimeout(r, 2500))
      return 'confirmed'
    })()`)

    // ── 按 rowspan/colspan 重建可视网格,再逐行判定 ──
    const grid = await ev(`(() => {
      const T = [...document.querySelectorAll('.rs-t')].find((t) => t.innerText.includes('检验要求') && t.innerText.includes('检验依据'))
      if (!T) return { err: '没找到检验项目及标准表' }
      const heads = [...T.querySelectorAll('tr')].filter((tr) => tr.querySelector('th')).map((tr) => [...tr.querySelectorAll('th')].map((th) => (th.innerText || '').trim()))
      const body = [...T.querySelectorAll('tr')].filter((tr) => tr.querySelector('td'))
      const occ = []; const out = []
      body.forEach((tr, ri) => {
        out[ri] = out[ri] || []
        occ[ri] = occ[ri] || []
        let c = 0
        for (const cell of tr.children) {
          while (occ[ri][c]) c++
          const cs = Number(cell.getAttribute('colspan') || 1)
          const rs = Number(cell.getAttribute('rowspan') || 1)
          const inp = cell.querySelector('textarea, input')
          const t = (inp ? String(inp.value || '') : (cell.innerText || '')).trim().replace(/\\s+/g, ' ')
          for (let r = ri; r < ri + rs; r++) { occ[r] = occ[r] || []; for (let k = c; k < c + cs; k++) occ[r][k] = true }
          out[ri][c] = t ? t.slice(0, 18) : '[空]'
          if (cs > 1) for (let k = c + 1; k < c + cs; k++) out[ri][k] = '(跨列)'
          c += cs
        }
      })
      return { heads, rows: out }
    })()`)
    console.log('表头行:', JSON.stringify(grid?.heads))
    console.log('可视网格(按列位):')
    for (const [i, row] of (grid?.rows || []).entries()) {
      console.log(`   行${i + 1}: ` + JSON.stringify(row))
    }
    // 判定:每一行都必须有「子项目/要求/方法/依据」四段内容落在对的列上(空白的只能是 rowspan 覆盖位)
    const rows = (grid?.rows || []).filter((r) => !r.some((x) => String(x).includes('(跨列)')) && !/产品性能检验项目/.test(String(r[0] || '')))
    const bad = rows.filter((r) => r.filter((x) => x === '[空]').length > 0)
    chk('G1', '分组表里没有"内容跑到别列/该有值的列空白"的行', bad.length === 0,
      bad.length ? JSON.stringify(bad.slice(0, 3)) : `共 ${rows.length} 行全部列位正确`)
    // 组内第 2 行起:第 3 列(子项目)必须有值、第 4 列(检验要求)必须有值
    const multi = rows.filter((r) => r[0] === null || r[0] === undefined)
    chk('G2', '组内后继行的「子项目」「检验要求」两列不空',
      multi.length > 0 && multi.every((r) => (r[2] || '') !== '[空]' && (r[3] || '') !== '[空]'),
      `后继行 ${multi.length} 行:` + JSON.stringify(multi.slice(0, 3)))
    chk('G3', '无 JS 异常', errs.length === 0, errs.slice(0, 2).join(' | '))
    await send('Page.captureScreenshot', {}).then((r) => {
      if (r?.result?.data) fs.writeFileSync(path.join(OUT, 'spec-group-table.png'), Buffer.from(r.result.data, 'base64'))
    })
    console.log('DOCNO=' + created)
    console.log('(清场: node probe-spec-group-table.cjs clean ' + created + ')')
  } finally { edge.kill() }
  console.log(fails ? `\n${fails} 项未通过` : '\n全部通过')
}
main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
