/**
 * 验收探针:成型工艺清单 页 2「配方表」物料格(2026-10-16 用户口径)
 *
 *   用户原话(附截图,截图里 物料种类 六行全是「请选择」、物料编号/物料名称 却有值):
 *     「在成型工艺清单填写配方表的物料信息的时候,手动填写物料编码应该带出对应的物料类别以及
 *       物料名称,把填写框的物料种类的下拉框改为普通文本框」
 *
 *   病根(已定位):页 2 的带出链路 RecordSheetPanels.onDetailTextCommit → invCarry.pickInvCarry
 *     **只写对侧那一格**(物料编号↔物料名称),从不写 物料种类 ⇒ 那格一直空着(截图里就是"请选择")。
 *     档案实测(HSDZ_MES.bs_inv):YJ-LL-003 → 存货名称 胶粉 / 所属类别 胶粉;
 *                                  YJ-SLD-012 → 超高分子量聚乙烯 / 所属类别 胶粉。
 *
 *   ⚠ 空白单据的配方表**没有「加一行」入口**(空表那行的 .rsp-op-pad 没有点击处理,见
 *     RecordSheetPanels.vue 的空表 <tr>):配方表的第一行只能从「配方计算」弹窗填入。
 *     所以本探针分两段,第一段建单、由外部往**探针自己建的那张单**里插一行配方行(测试账套),
 *     第二段再在界面上手填物料编号做验收。收尾按精确单号删。
 *
 *   用法:
 *     node recipe-kind-carry.cjs prep                      # 测试账套建一张单,打印 DOCNO=
 *     node recipe-kind-carry.cjs verify <单号>              # 界面验收(断言 + 截图)
 *     node recipe-kind-carry.cjs clean  <单号>              # 删单(界面上按精确单号删)
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const MODE = (process.argv[2] || 'verify').toLowerCase()
const DOCARG = process.argv[3] || ''
const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9391
const OUT = path.join(process.env.TEMP, 'mes-ann2')
const PANEL = 'RD_MOLD_PROC'
/** 档案实测值:编码 → [所属类别, 存货名称] */
const CODE1 = 'YJ-LL-003'
const CODE1_KIND = '胶粉'
const CODE1_NAME = '胶粉'
const CODE2 = 'YJ-SLD-012'
const CODE2_KIND = '胶粉'
const CODE2_NAME = '超高分子量聚乙烯'
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const chk = (id, name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${id}] ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 320)}`)
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
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + tok }
  const post = async (u, b) => (await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json())
  const listDocs = async () => {
    const r = await post('/px/queryFormDataList', { panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 50 })
    return (r?.data?.rows || r?.data?.list || []).map((x) => x['单据编号']).filter(Boolean)
  }

  if (MODE === 'clean') {
    console.log('删单:', JSON.stringify(await post('/px/deleteForms', { panelCode: PANEL, rowCodes: [DOCARG] })).slice(0, 160))
    console.log('剩余单号:', JSON.stringify(await listDocs()))
    return
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rck-'))
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
    let id = 0; const pend = new Map(); let net = []; const errs = []
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      const u = String(m.params?.response?.url || '')
      if (m.method === 'Network.responseReceived' && u.includes('queryFormDataList')) net.push(`${m.params.response.status} ${u.replace(BASE, '').slice(0, 90)}`)
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

    if (MODE === 'prep') {
      const before = await listDocs()
      await ev(`(async () => {
        const txt = (e) => (e.innerText || '').trim()
        const btn = [...document.querySelectorAll('.as-side-btn, .el-button')].find((b) => txt(b) === '新增')
        if (btn) btn.click(); await new Promise((r) => setTimeout(r, 6000)); return 'ok'
      })()`)
      const docs = await listDocs()
      const created = docs.find((n) => !before.includes(n))
      const served = await ev(`fetch('/index.html').then(r=>r.text()).then(t=>(t.match(/assets\\/index-[A-Za-z0-9_-]+\\.js/)||['(无)'])[0])`)
      console.log('服务前端 chunk =', served)
      console.log('DOCNO=' + created)
      chk('PREP', '测试账套建了一张空白单', !!created, `单号=${created};新增前=${before.length} 张`)
      return
    }

    // ── verify:切到目标单 → 成型配方 → 配方表物料格验收 ──
    const docNo = DOCARG
    net = []
    const opened = await ev(`(async () => {
      const txt = (e) => (e.innerText || '').trim()
      const prev = [...document.querySelectorAll('.as-side-btn, .el-button')].find((b) => txt(b).includes('单据预览'))
      if (prev) { prev.click(); await new Promise((r) => setTimeout(r, 1500)) }
      let hit = [...document.querySelectorAll('.preview-card')].find((c) => txt(c).includes(${JSON.stringify(docNo)}))
      if (hit) { hit.click(); await new Promise((r) => setTimeout(r, 3500)) }
      if (!document.querySelector('.record-sheet')) {
        const leaves = [...document.querySelectorAll('.doc-select-rail *')].filter((e) => e.children.length === 0)
        const el = leaves.find((e) => txt(e) === ${JSON.stringify(docNo)})
        if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, view: window })); await new Promise((r) => setTimeout(r, 3500)) }
      }
      const tabs = [...document.querySelectorAll('.rsp-page-tab')].map(txt)
      const tab = [...document.querySelectorAll('.rsp-page-tab')].find((t) => txt(t).includes('成型配方'))
      if (tab) { tab.click(); await new Promise((r) => setTimeout(r, 2000)) }
      return { previewCard: !!hit, tabs, hasSheet: !!document.querySelector('.record-sheet'), status: txt(document.querySelector('.doc-status') || {}) }
    })()`)
    console.log('[开单]', JSON.stringify(opened))
    chk('V0', `切到了 ${docNo} 并有配方表页签`, !!opened?.hasSheet && (opened?.tabs || []).some((t) => t.includes('成型配方')),
      `status=${opened?.status} tabs=${JSON.stringify(opened?.tabs)}`)

    // ① 物料种类 那格已从下拉改成普通文本框;② 手填物料编号带出 种类 + 名称
    const r1 = await ev(`(async () => {
      const txt = (e) => ((e.innerText || '').trim().replace(/\\s+/g, ''))
      const tbl = [...document.querySelectorAll('table')].filter((t) => t.offsetParent && txt(t).includes('物料编号') && txt(t).includes('设计添加量')).pop()
      if (!tbl) return { err: '找不到配方表' }
      const ths = [...tbl.querySelectorAll('tr.rs-grp th')].map(txt)
      const idx = (n) => ths.findIndex((h) => h.includes(n))
      const rowTr = (i) => [...tbl.querySelectorAll('tr')].filter((tr) => tr.querySelector('.rs-c-in, input'))[i]
      const cellOf = (tr, n) => tr.children[idx(n)]
      const inp = (tr, n) => cellOf(tr, n) && cellOf(tr, n).querySelector('input')
      const setVal = (el, v) => {
        const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        d.set.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const out = { ths, rows: [], }
      // ⚠ 空表那行没有「加一行」入口,故先确认已经有行(由外部插入)
      let tr = rowTr(0)
      if (!tr) return { err: '配方表没有任何数据行(外部没插成?)', ths }
      const kindCell = cellOf(tr, '物料种类')
      out.kindIsSelect = !!kindCell.querySelector('.el-select')
      out.kindIsInput = !!kindCell.querySelector('input')

      // 行1:手填物料编号 → 带出 物料种类 + 物料名称
      setVal(inp(tr, '物料编号'), ${JSON.stringify(CODE1)})
      await new Promise((r) => setTimeout(r, 2200))
      out.rows.push({ tag: 'row1(code)', kind: inp(tr, '物料种类').value, code: inp(tr, '物料编号').value, name: inp(tr, '物料名称').value })

      // 再加两行(有行了才有 ＋)
      const addBtn = () => { const b = tbl.querySelector('.rs-op-add'); if (b) b.click() }
      addBtn(); await new Promise((r) => setTimeout(r, 700))
      addBtn(); await new Promise((r) => setTimeout(r, 700))
      const tr2 = rowTr(1), tr3 = rowTr(2)
      out.rowCount = [...tbl.querySelectorAll('tr')].filter((x) => x.querySelector('.rs-c-in, input')).length

      // 行2:另一支料 → 种类/名称都按档案带
      if (tr2) { setVal(inp(tr2, '物料编号'), ${JSON.stringify(CODE2)}); await new Promise((r) => setTimeout(r, 2200)) }
      if (tr2) out.rows.push({ tag: 'row2(code)', kind: inp(tr2, '物料种类').value, code: inp(tr2, '物料编号').value, name: inp(tr2, '物料名称').value })

      // 行3:种类先手填 → 不许被档案覆盖;然后填编码,名称照带
      if (tr3) {
        setVal(inp(tr3, '物料种类'), '炭粉'); await new Promise((r) => setTimeout(r, 300))
        setVal(inp(tr3, '物料编号'), ${JSON.stringify(CODE1)}); await new Promise((r) => setTimeout(r, 2200))
        out.rows.push({ tag: 'row3(手填种类)', kind: inp(tr3, '物料种类').value, code: inp(tr3, '物料编号').value, name: inp(tr3, '物料名称').value })
      }

      // 行4:档案里没有的编码 → 什么都不动(静默)
      addBtn(); await new Promise((r) => setTimeout(r, 700))
      const tr4 = rowTr(3)
      if (tr4) {
        setVal(inp(tr4, '物料编号'), 'ZZZ-NO-SUCH-CODE'); await new Promise((r) => setTimeout(r, 2200))
        out.rows.push({ tag: 'row4(查不到)', kind: inp(tr4, '物料种类').value, code: inp(tr4, '物料编号').value, name: inp(tr4, '物料名称').value })
      }
      tbl.scrollIntoView({ block: 'center' })
      await new Promise((r) => setTimeout(r, 600))
      return out
    })()`)
    console.log('[配方表]', JSON.stringify(r1, null, 1).slice(0, 1400))
    if (r1?.err) { chk('V1', '取到配方表数据行', false, r1.err); }
    else {
      const row = (tag) => (r1.rows || []).find((x) => x.tag === tag) || {}
      chk('V1', '「物料种类」已是普通文本框(不再是下拉)', r1.kindIsInput === true && r1.kindIsSelect === false,
        `isInput=${r1.kindIsInput} isSelect=${r1.kindIsSelect}`)
      chk('V2', `手填 物料编号=${CODE1} → 带出 种类/名称`, row('row1(code)').kind === CODE1_KIND && row('row1(code)').name === CODE1_NAME,
        JSON.stringify(row('row1(code)')))
      chk('V3', `手填 物料编号=${CODE2} → 带出 ${CODE2_KIND}/${CODE2_NAME}`,
        row('row2(code)').kind === CODE2_KIND && row('row2(code)').name === CODE2_NAME, JSON.stringify(row('row2(code)')))
      chk('V4', '人手填过的「物料种类」不被档案覆盖(仍是炭粉)', row('row3(手填种类)').kind === '炭粉',
        JSON.stringify(row('row3(手填种类)')))
      chk('V5', '档案里没有的编码 ⇒ 一格都不动(仍为空)',
        row('row4(查不到)').kind === '' && row('row4(查不到)').name === '',
        JSON.stringify(row('row4(查不到)')))
      chk('V6', '带出确实走了商品档案查询(前端发过 queryFormDataList 且 2xx)',
        net.some((n) => /^2\d\d/.test(n)), net.slice(0, 3).join(' | ') || '无')
    }
    chk('V7', '无 JS 异常', errs.length === 0, errs.slice(0, 3).join(' | '))

    // ③ 截图存档
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (shot?.result?.data) {
      const p = path.join(OUT, 'recipe-kind-carry.png')
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
