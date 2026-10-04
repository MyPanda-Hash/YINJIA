/* _v-custom-tab.cjs — 来料检验要求「自定义检验要求」页签 + 带入检验数据记录的端到端实测
 *
 * 用户口径(2026-10-04):「我想在来料检验要求加一个 tab 表这个表可以自定义字段的,
 *   这样的表能不能也实现带入到检验数据记录」
 * 本探针逐条取证:
 *   ① 来料检验要求多出第 8 个页签「自定义检验要求」,且能切过去
 *   ② 管理员可见「⚙ 自定义字段」入口,弹窗能加列(动态字段/备用列池)
 *   ③ 加完列,该页签立刻多一列(列名 = 字段名),数据行能录(物料编号 + 自定义列)
 *   ④ 保存落库:物料类别 = 自定义检验要求、该列数据进 备用N
 *   ⑤ 该列名自动进了「检验项」标准库 qc.insp_item(报告下拉能选到)
 *   ⑥ **带入检验数据记录**:填该物料编码 → 自动带入,检验项 = 自定义列名、检测标准 = 该列数据
 *   ⑦ 「⧉ 检验要求」弹窗同样能看到这个页签与这一行
 *
 * ⚠ 本探针**只打测试账套**(登录 factory=YJ_TEST → HSDZ_MES_TEST):会真的加字段、加数据行并保存,
 *   属演示/试用数据,按两账套纪律不进正式库。
 * 用法:node tools/archive/_probe-qc-insp-carry/_v-custom-tab.cjs [前端地址,默认 http://127.0.0.1:8090]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9365
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const FACTORY = 'YJ_TEST'                 // 测试账套(演示数据;正式库不写)
const TAB = '自定义检验要求'
const FIELD = '平整度'                     // 自定义列名(同时应成为"检验项")
const FIELD_EN = 'Flatness'
const CODE = 'YJ-TEST-CUSTOM-001'          // 只在这一页签用的物料编号(带入结果因此唯一)
const STD = '无毛刺、无划痕'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) { fails++; process.exitCode = 1 }
}

const HELPERS = `
  window.__ct = {
    setV(el, v) {
      if (!el) return 0
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return el.value
    },
    /** 点某页签 */
    tab(name) {
      const t = [...document.querySelectorAll('.qc-insp-sheet .rsp-page-tab')].find(e => e.innerText.trim() === name)
      t?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!t
    },
    /** 当前页签的全部列名(表头第二行的叶子列 + 第一行的独立列) */
    cols() {
      const paper = document.querySelector('.qc-insp-sheet .qc-paper')
      if (!paper) return []
      const grp1 = paper.querySelector('tr.rs-grp')
      const grp2 = paper.querySelector('tr.rs-grp2')
      const a = grp1 ? [...grp1.querySelectorAll('th.rs-th')].map(e => e.innerText.trim()).filter(Boolean) : []
      const b = grp2 ? [...grp2.querySelectorAll('th.rs-th')].map(e => e.innerText.trim()).filter(Boolean) : []
      return [...a, ...b]
    },
    rows() {
      return [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')].map((tr) => {
        const tds = [...tr.querySelectorAll('td.rs-td')]
        if (!tds.length) return null
        return tds.map(td => {
          const inp = td.querySelector('input')
          return inp ? inp.value : td.innerText.trim()
        })
      }).filter(Boolean)
    },
    msgs() { return [...document.querySelectorAll('.el-message')].map(e => e.innerText.replace(/\\s+/g, ' ').trim()) },
    clearMsgs() { document.querySelectorAll('.el-message').forEach(e => e.remove()); return 1 },
  };
`

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
  })).json()
  if (!login?.data?.token) throw new Error('测试账套登录失败:' + JSON.stringify(login).slice(0, 200))
  const token = login.data.token
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const apiGet = async (u) => (await fetch(BASE + u, { headers: auth })).json()
  const apiPost = async (u, b) => (await fetch(BASE + u, { method: 'POST', headers: auth, body: JSON.stringify(b) })).json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ctab-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let ws
  try {
    const tabInfo = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tabInfo.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const raw = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const evalY = (exp) => raw(`(() => { ${HELPERS} return (${exp}) })()`)
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(1000); return } } }
    const waitForY = async (exp, ms = 20000, step = 500) => {
      for (let i = 0; i < Math.ceil(ms / step); i++) {
        const v = await evalY(exp)
        if (v) return v
        await sleep(step)
      }
      return null
    }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate(`${APP}/#/login`)
    await raw(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)

    // ── ① 第 8 个页签 ──
    let tabs0 = null
    for (let i = 0; i < 3 && !tabs0; i++) {
      await navigate('about:blank')
      await navigate(`${APP}/#/panelx/list/QC_INSP_REQ`)
      tabs0 = await waitForY(`(() => {
        const t = [...document.querySelectorAll('.qc-insp-sheet .rsp-page-tab')].map(e => e.innerText.trim())
        return t.length >= 8 ? JSON.stringify(t) : ''
      })()`, 20000)
    }
    const tabList = tabs0 ? JSON.parse(tabs0) : []
    ok('① 来料检验要求有 8 个页签且含「自定义检验要求」', tabList.includes(TAB), JSON.stringify(tabList))
    ok('① 该页签在末位(7 张固定表之后)', tabList[tabList.length - 1] === TAB)

    // ── ② 自定义字段入口(管理员) ──
    ok('② 管理员可见「⚙ 自定义字段」入口', await evalY(`!!document.querySelector('.qc-insp-sheet .qc-bar2 .qc-bar-btn:nth-child(3)') || [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].some(e => e.innerText.includes('自定义字段'))`))
    await evalY(`(() => {
      const b = [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].find(e => e.innerText.includes('自定义字段'))
      b?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!b
    })()`)
    const dlgOpen = await waitForY(`(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理'))
      return d ? d.innerText.replace(/\\s+/g, ' ').slice(0, 120) : ''
    })()`, 15000)
    ok('② 点开「字段管理」弹窗(动态字段/备用列池)', !!dlgOpen, String(dlgOpen))

    // ③ 加列:走弹窗表单(字段名 + 英文名 → 添加)
    const added = await evalY(`(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理'))
      if (!d) return 'NO-DIALOG'
      const items = [...d.querySelectorAll('.el-form-item')]
      const byLabel = (t) => items.find(i => (i.querySelector('.el-form-item__label')?.innerText || '').trim().startsWith(t))
      const labelInp = byLabel('字段名')?.querySelector('input')
      const enInp = byLabel('英文名')?.querySelector('input')
      window.__ct.setV(labelInp, ${JSON.stringify(FIELD)})
      window.__ct.setV(enInp, ${JSON.stringify(FIELD_EN)})
      const btn = [...d.querySelectorAll('.el-dialog__footer button')].find(b => b.innerText.trim() === '添加')
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return btn ? 'CLICKED' : 'NO-BTN'
    })()`)
    ok('③ 弹窗表单已填并点「添加」', added === 'CLICKED', String(added))
    const listHasField = await waitForY(`(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理'))
      return d && d.innerText.includes(${JSON.stringify(FIELD)}) ? 'OK' : ''
    })()`, 15000)
    ok('③ 弹窗字段列表出现新列名', listHasField === 'OK')
    // 关掉弹窗(✕)
    await evalY(`(() => { const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理')); [...(d?.querySelectorAll('.el-dialog__headerbtn') || [])].forEach(b => b.dispatchEvent(new MouseEvent('click', { bubbles: true }))); return 1 })()`)
    await sleep(1500)

    // ── ④ 切到自定义页签:应出现 物料编号 + 平整度 两列 ──
    await evalY(`window.__ct.tab(${JSON.stringify(TAB)})`)
    const cols = await waitForY(`(() => { const c = window.__ct.cols(); return c.includes(${JSON.stringify(FIELD)}) ? JSON.stringify(c) : '' })()`, 20000)
    const colList = cols ? JSON.parse(cols) : []
    ok('④ 自定义页签出现「物料编号 + 平整度」两列', colList.includes('物料编号') && colList.includes(FIELD), JSON.stringify(colList))

    // ── ⑤ 录一行数据并保存 ──
    await evalY(`(() => { window.__ct.clearMsgs(); const b = [...document.querySelectorAll('.qc-insp-sheet .rs-add')].find(e => e.innerText.includes('新增数据记录行')); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    await sleep(900)
    const filled = await evalY(`(() => {
      const tr = [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')].find(t => t.getAttribute('data-edit') === '1')
      if (!tr) return 'NO-EDIT-ROW'
      const inputs = [...tr.querySelectorAll('input')]
      if (inputs.length < 2) return 'ONLY-' + inputs.length
      window.__ct.setV(inputs[0], ${JSON.stringify(CODE)})
      window.__ct.setV(inputs[1], ${JSON.stringify(STD)})
      return 'OK:' + inputs.map(i => i.value).join('|')
    })()`)
    ok('⑤ 新行可填(物料编号 + 平整度)', String(filled).startsWith('OK:'), String(filled))
    await evalY(`(() => { const tr = [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')].find(t => t.getAttribute('data-edit') === '1'); const b = [...(tr?.querySelectorAll('.rs-op-btn') || [])].find(e => e.innerText.includes('完成')); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    await sleep(600)
    await evalY(`(() => { window.__ct.clearMsgs(); const b = [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].find(e => e.innerText.trim() === '保存'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    const saved = await waitForY(`(() => { const m = window.__ct.msgs().join(' | '); return /保存/.test(m) ? m : '' })()`, 25000)
    ok('⑤ 保存提示出现', /成功|保存/.test(String(saved)), String(saved))

    // ── ⑥ 落库核对(接口,测试账套) ──
    const q = await apiPost('/px/queryFormDataList', { panelCode: 'QC_INSP_REQ', pageNo: 1, pageSize: 1, condition: {} })
    const items = q?.data?.list?.[0]?.detail?.qc_insp_req || []
    const mine = items.filter((r) => String(r['物料编号'] || '').trim() === CODE)
    ok('⑥ 落库:该物料编号有一行', mine.length === 1, JSON.stringify(mine).slice(0, 220))
    ok('⑥ 落库:物料类别 = 自定义检验要求', mine[0] && String(mine[0]['物料类别']).trim() === TAB, JSON.stringify(mine[0]?.['物料类别']))
    ok(`⑥ 落库:${FIELD} = ${STD}`, mine[0] && String(mine[0][FIELD] || '').trim() === STD, JSON.stringify(mine[0]?.[FIELD]))

    // ── ⑦ 列名进了「检验项」标准库 ──
    const sl = await apiGet('/stdlib/list?lib=qc.insp_item')
    const stdItems = (sl?.data || []).map((x) => String(x.content))
    ok('⑦ 自定义列名已登记进检验项标准库 qc.insp_item', stdItems.includes(FIELD), stdItems.slice(-6).join(' , '))

    // ── ⑧ 带入检验数据记录 ──
    let ready = null
    for (let attempt = 1; attempt <= 5 && !ready; attempt++) {
      await navigate('about:blank')
      await navigate(`${APP}/#/panelx/list/QC_INSP_REC`)
      await sleep(3000)
      await raw(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
      ready = await raw(`(() => {
        const side = [...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g, ''))
        return (document.querySelector('.qc-rec-sheet') && side.includes('新增')) ? 'READY' : ''
      })()`)
      if (!ready) await sleep(2000)
    }
    ok('⑧ 检验报告面板就绪', ready === 'READY', ready)
    await raw(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    // 新增后等空报告态稳下来(草稿对象会被替换,见 _d-carry-debug.cjs)
    await sleep(3500)
    /** 报告表体读取:检验项取 el-select 的 .el-select__placeholder(第一个 selected-item 是输入外壳,恒空) */
    const REPORT_ROWS = `(() => [...document.querySelectorAll('.qc-rec-sheet .qr-table tbody tr')].map(tr => {
      const td = [...tr.querySelectorAll('td')]
      if (td.length < 4) return null
      const ph = td[0].querySelector('.el-select__placeholder')
      return {
        item: ((ph ? ph.innerText : td[0].innerText) || '').trim(),
        std: td[1].querySelector('input') ? td[1].querySelector('input').value : td[1].innerText.trim(),
      }
    }).filter(Boolean))()`
    let repRows = []
    for (let i = 0; i < 6 && !repRows.some((r) => r.item === FIELD); i++) {
      await evalY(`(() => {
        const th = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t => t.innerText.trim() === '物料编码')
        const inp = th?.nextElementSibling?.querySelector('input')
        if (!inp) return 'NO-INPUT'
        window.__ct.clearMsgs()
        return window.__ct.setV(inp, ${JSON.stringify(CODE)})
      })()`)
      for (let k = 0; k < 12; k++) {
        await sleep(500)
        repRows = await evalY(REPORT_ROWS) || []
        if (repRows.some((r) => r.item === FIELD)) break
      }
    }
    ok('⑧ 填物料编码后自动带入(含自定义页签的列)', repRows.length >= 1, JSON.stringify(repRows))
    ok(`⑧ 检验项 = 自定义列名「${FIELD}」、检测标准 = 「${STD}」`,
      repRows.some((r) => r.item === FIELD && r.std === STD), JSON.stringify(repRows))

    // ── ⑨ 「⧉ 检验要求」弹窗也能看到该页签与这一行 ──
    await evalY(`(() => { const s = [...document.querySelectorAll('.qr-lib-btn')].find(e => e.innerText.includes('检验要求')); s?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!s })()`)
    let dlg2 = ''
    for (let k = 0; k < 20 && !dlg2; k++) {
      await sleep(700)
      const t = await evalY(`(() => { const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('来料检验要求')); return d ? d.innerText.replace(/\\s+/g, ' ') : '' })()`)
      if (t && t.includes(STD)) dlg2 = t
    }
    ok('⑨ 检验要求弹窗显示自定义页签命中行', !!dlg2 && dlg2.includes(TAB), String(dlg2).slice(0, 220))
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    edge.kill()
    await sleep(500)
  }
  console.log(fails ? `\n✖ 失败 ${fails} 项` : '\n✔ 全部通过')
}
main().catch((e) => { console.error('探针异常:', e); process.exitCode = 1 })
