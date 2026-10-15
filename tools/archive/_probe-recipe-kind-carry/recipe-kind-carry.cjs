/**
 * 验收探针:成型工艺清单 页 2「配方表」物料格(2026-10-16 用户口径,两轮)
 *
 *   第一轮原话(附截图,截图里 物料种类 六行全是「请选择」、物料编号/物料名称 却有值):
 *     「手动填写物料编码应该带出对应的物料类别以及物料名称,把填写框的物料种类的下拉框改为普通文本框」
 *   第二轮原话:
 *     「物料编号可以在填写的时候模糊筛选下拉显示提供选择,比如 YJ-LL-003,
 *       可以在输入 Y 或者 003 时模糊搜索到含这些数字字母的」
 *
 *   验收点:
 *     V1 「物料种类」是普通文本框(不是下拉)
 *     V2 物料编号 是**远程筛选下拉**(el-select + remote);输入 003 → 候选里有 YJ-LL-003
 *     V3 输入 SLD → 候选里有 YJ-SLD-012;选中后 物料种类/物料名称 一并带出
 *     V4 人手填过「物料种类」⇒ 不被档案覆盖
 *     V5 档案里没有的编码照旧能手打(allow-create,下拉是候选不是白名单)
 *     V6 模糊搜索确实带 keyword 发了请求,且**空关键字一个请求都没发**(空关键字 = 拉全档案)
 *
 *   ⚠ 空白单据的配方表只能从「配方计算」弹窗填入第一行(空表那行的 .rsp-op-pad 没有点击处理),
 *     所以本探针分两段:prep 建单 → 外部往**探针自己建的那张单**里插一行配方行(仅测试账套)
 *     → verify 在界面上做验收。收尾按精确单号删(头表/明细/流转三处)。
 *
 *   用法:
 *     node recipe-kind-carry.cjs prep                      # 测试账套建一张单,打印 DOCNO=
 *     node recipe-kind-carry.cjs verify <单号>              # 界面验收(断言 + 截图)
 *     node recipe-kind-carry.cjs clean  <单号>              # 删单(按精确单号)
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
const CODE1 = 'YJ-LL-003'      // 档案实测:所属类别 胶粉 / 存货名称 胶粉
const CODE2 = 'YJ-SLD-012'     // 档案实测:所属类别 胶粉 / 存货名称 超高分子量聚乙烯
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
    let id = 0; const pend = new Map(); const errs = []
    const kwReqs = []; let kwEmpty = 0; let invReqs = 0
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
      if (m.method === 'Network.requestWillBeSent') {
        const u = String(m.params?.request?.url || '')
        const pd = String(m.params?.request?.postData || '')
        if (u.includes('queryFormDataList') && pd.includes('INV')) {
          invReqs++
          const mm = /"keyword"\s*:\s*"([^"]*)"/.exec(pd)
          if (mm) { if (mm[1]) kwReqs.push(mm[1]); else kwEmpty++ }
        }
      }
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

    // ── verify:切到目标单 → 成型配方 → 物料格验收 ──
    const docNo = DOCARG
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

    const r1 = await ev(`(async () => {
      const txt = (e) => ((e.innerText || '').trim().replace(/\\s+/g, ''))
      const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms))
      const tbl = [...document.querySelectorAll('table')].filter((t) => t.offsetParent && txt(t).includes('物料编号') && txt(t).includes('设计添加量')).pop()
      if (!tbl) return { err: '找不到配方表' }
      const ths = [...tbl.querySelectorAll('tr.rs-grp th')].map(txt)
      const idx = (n) => ths.findIndex((h) => h.includes(n))
      const rowTr = (i) => [...tbl.querySelectorAll('tr')].filter((tr) => tr.querySelector('.rs-c-in, input'))[i]
      const cellOf = (tr, n) => tr.children[idx(n)]
      const inp = (tr, n) => cellOf(tr, n) && cellOf(tr, n).querySelector('input')
      const setNative = (el, v) => {
        const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        d.set.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      /** 本格那个下拉的 popper(popper-class="rs-inv-popper",见 RecordSheetPanels):
          只认**可见**的那个 —— 页面上还有别的下拉(密级/使用范围/生产车间…)的 item 同在 document 里,
          全局 querySelectorAll('.el-select-dropdown__item') 会把它们的选项一起捞进来(实测踩过:
          003 那次候选里混进「保密」「170度」「40分钟」等字典词)。 */
      const popper = () => [...document.querySelectorAll('.rs-inv-popper')]
        .filter((p) => { const r = p.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
        .pop() || null
      const items = () => {
        const p = popper()
        return p ? [...p.querySelectorAll('li')].map((e) => e.innerText.trim()).filter(Boolean) : []
      }
      const diag = () => ({
        poppers: document.querySelectorAll('.rs-inv-popper').length,
        visible: [...document.querySelectorAll('.rs-inv-popper')].filter((p) => p.getBoundingClientRect().height > 0).length,
      })
      /** 打字 → 等远程候选回来 → 返回候选文字(autocomplete:输入框本身就是值,不需要点开) */
      const search = async (tr, n, kw) => {
        const el = inp(tr, n)
        el.focus()
        setNative(el, kw)
        await sleep2(2200)
        return { items: items(), ...diag() }
      }
      /** 点候选里含 match 的那条(真实用户路径:模糊筛选 → 选中) */
      const pickItem = async (match) => {
        const p = popper()
        const it = p && [...p.querySelectorAll('li')].find((e) => e.innerText.includes(match))
        if (it) it.click()
        await sleep2(1800)
        return !!it
      }
      const out = { ths, rows: [], searches: {} }
      let tr = rowTr(0)
      if (!tr) return { err: '配方表没有任何数据行(外部没插成?)', ths }
      const kindCell = cellOf(tr, '物料种类')
      out.kindIsSelect = !!kindCell.querySelector('.el-select')
      out.kindIsInput = !!kindCell.querySelector('input')
      const codeCell = cellOf(tr, '物料编号')
      out.codeIsAuto = !!codeCell.querySelector('.el-autocomplete')
      out.codeIsInput = !!codeCell.querySelector('input')
      out.codeNoSelect = !codeCell.querySelector('.el-select')

      // 行1:输入 003 → 模糊筛出 YJ-LL-003 → 选中 ⇒ 种类/名称带出
      out.searches['003'] = await search(tr, '物料编号', '003')
      out.picked1 = await pickItem(${JSON.stringify(CODE1)})
      out.rows.push({ tag: 'row1(003)', code: inp(tr, '物料编号').value, kind: inp(tr, '物料种类').value, name: inp(tr, '物料名称').value })

      // 再加两行(有行了才有 ＋)
      const addBtn = () => { const b = tbl.querySelector('.rs-op-add'); if (b) b.click() }
      addBtn(); await sleep2(700)
      addBtn(); await sleep2(700)
      const tr2 = rowTr(1), tr3 = rowTr(2)

      // 行2:输入 SLD → 筛出 YJ-SLD-012 → 选中
      if (tr2) {
        out.searches['SLD'] = await search(tr2, '物料编号', 'SLD')
        out.picked2 = await pickItem(${JSON.stringify(CODE2)})
        out.rows.push({ tag: 'row2(SLD)', code: inp(tr2, '物料编号').value, kind: inp(tr2, '物料种类').value, name: inp(tr2, '物料名称').value })
      }

      // 行3:种类先手填 → 不许被档案覆盖
      if (tr3) {
        setNative(inp(tr3, '物料种类'), '炭粉'); await sleep2(300)
        out.searches['Y'] = await search(tr3, '物料编号', 'Y')
        out.picked3 = await pickItem(${JSON.stringify(CODE1)})
        out.rows.push({ tag: 'row3(手填种类)', code: inp(tr3, '物料编号').value, kind: inp(tr3, '物料种类').value, name: inp(tr3, '物料名称').value })
      }

      // 行4:档案里没有的编码 —— 手打 + 失焦,必须能留下(autocomplete:输入框本身就是值)
      addBtn(); await sleep2(700)
      const tr4 = rowTr(3)
      if (tr4) {
        const el = inp(tr4, '物料编号')
        el.focus()
        setNative(el, 'ZZZ-NO-SUCH-CODE')
        await sleep2(1600)
        el.dispatchEvent(new Event('change', { bubbles: true }))   // ≈ 用户点别处(失焦)
        await sleep2(1200)
        out.rows.push({ tag: 'row4(手打新码)', code: inp(tr4, '物料编号').value, kind: inp(tr4, '物料种类').value, name: inp(tr4, '物料名称').value })
      }
      return out
    })()`)
    console.log('[配方表]', JSON.stringify(r1, null, 1).slice(0, 1800))
    if (r1?.err) { chk('V1', '取到配方表数据行', false, r1.err) }
    else {
      const row = (tag) => (r1.rows || []).find((x) => x.tag === tag) || {}
      const hasIn = (arr, s) => (arr || []).some((t) => String(t).includes(s))
      const itemsOf = (k) => r1.searches?.[k]?.items || []
      const searDetail = (k) => `${itemsOf(k).length} 项 · popper ${r1.searches?.[k]?.poppers} 个/可见 ${r1.searches?.[k]?.visible} · ${JSON.stringify(itemsOf(k).slice(0, 5))}`
      chk('V1', '「物料种类」仍是普通文本框(不是下拉)', r1.kindIsInput === true && r1.kindIsSelect === false,
        `isInput=${r1.kindIsInput} isSelect=${r1.kindIsSelect}`)
      chk('V2', '「物料编号」是输入框 + 模糊候选(autocomplete,不是死板下拉)', r1.codeIsAuto === true && r1.codeIsInput === true && r1.codeNoSelect === true,
        `auto=${r1.codeIsAuto} input=${r1.codeIsInput} 无select=${r1.codeNoSelect}`)
      chk('V3', `输入 003 ⇒ 候选含 ${CODE1}`, hasIn(itemsOf('003'), CODE1), searDetail('003'))
      chk('V4', `输入 SLD ⇒ 候选含 ${CODE2}`, hasIn(itemsOf('SLD'), CODE2), searDetail('SLD'))
      chk('V5', '输入 Y ⇒ 候选含 YJ-*', hasIn(itemsOf('Y'), 'YJ-'), searDetail('Y'))
      chk('V6', `选中 ${CODE1} ⇒ 带出 种类/名称(胶粉/胶粉)`,
        row('row1(003)').kind === '胶粉' && row('row1(003)').name === '胶粉' && row('row1(003)').code === CODE1,
        JSON.stringify(row('row1(003)')))
      chk('V7', `选中 ${CODE2} ⇒ 胶粉/超高分子量聚乙烯`,
        row('row2(SLD)').kind === '胶粉' && row('row2(SLD)').name === '超高分子量聚乙烯',
        JSON.stringify(row('row2(SLD)')))
      chk('V8', '人手填过的「物料种类」不被覆盖(仍是炭粉)', row('row3(手填种类)').kind === '炭粉', JSON.stringify(row('row3(手填种类)')))
      chk('V9', '档案里没有的编码手打后失焦仍在(不会被吞)', row('row4(手打新码)').code === 'ZZZ-NO-SUCH-CODE',
        JSON.stringify(row('row4(手打新码)')))
      chk('V10', '模糊搜索带 keyword 发了请求,且空关键字一次都没发',
        kwReqs.length >= 3 && kwEmpty === 0, `keyword 请求=${JSON.stringify(kwReqs)} 空关键字请求=${kwEmpty} 档案请求总数=${invReqs}`)
    }
    chk('V11', '无 JS 异常', errs.length === 0, errs.slice(0, 3).join(' | '))

    // 截图:把下拉打开、输入 003,留一张"候选里能看见 YJ-LL-003"的图
    await ev(`(async () => {
      const txt = (e) => ((e.innerText || '').trim().replace(/\\s+/g, ''))
      const tbl = [...document.querySelectorAll('table')].filter((t) => t.offsetParent && txt(t).includes('物料编号') && txt(t).includes('设计添加量')).pop()
      if (!tbl) return 'no-table'
      const tr = [...tbl.querySelectorAll('tr')].filter((x) => x.querySelector('.rs-c-in, input'))[0]
      if (!tr) return 'no-row'
      const cell = tr.children[[...tbl.querySelectorAll('tr.rs-grp th')].map(txt).findIndex((h) => h.includes('物料编号'))]
      const el = cell.querySelector('input')
      el.focus()
      const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
      d.set.call(el, '003')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 2400))
      tbl.scrollIntoView({ block: 'center' })
      await new Promise((r) => setTimeout(r, 500))
      return 'ok'
    })()`)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (shot?.result?.data) {
      const p = path.join(OUT, 'recipe-inv-fuzzy.png')
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
