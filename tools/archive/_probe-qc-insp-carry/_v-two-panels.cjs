/* _v-two-panels.cjs — 两个「来料检验要求」面板端到端实测(固定表面板 + 10 张全自定义系列表面板)
 *
 * 用户口径(2026-10-04 第四轮):
 *   「现在将那个自定义的表删除,然后多增加一个来料检验要求的面版,下面有这几个切换表(而且都是自定义的),
 *    实现和之前一致,只是为了不要太多的表都集中在一个面版才拆成两个:
 *    阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料」
 * 逐条取证:
 *   A 固定表面板(QC_INSP_REQ):①只剩 7 张固定表(旧「自定义检验要求」页签已下线)
 *                              ②每表各自的自定义列仍在、父字段分组表头仍在、承载列仍在本表段内
 *   B 系列面板(QC_INSP_REQ_SERIES):③10 个页签、首列只有 物料编号(全自定义)
 *                              ④加列(带新建父分组)→ 列落本表段(备用1-20)、表头出现分组标题
 *                              ⑤录数据并保存 → 落库到 qc_insp_req_series、物料类别=该页签
 *   C 带入检验数据记录:⑥两个面板的行都能带进来 ⑦父名不当检验项 ⑧「检验要求」弹窗按面板分段显示
 *
 * ⚠ 只打测试账套(登录 factory=YJ_TEST → HSDZ_MES_TEST);字段已存在时按"已有"处理(可重复跑)。
 * 用法:node tools/archive/_probe-qc-insp-carry/_v-two-panels.cjs [前端地址,默认 http://127.0.0.1:8090]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9368
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const FACTORY = 'YJ_TEST'
const PANEL_A = 'QC_INSP_REQ'
const PANEL_B = 'QC_INSP_REQ_SERIES'
const SERIES_TABS = ['阻垢系列', 'BK材料系列', '除重金属系列', '矿化（碱性）系列', '抑菌系列', '载银系列', '炭粉', '胶粉', '矿化料', '原料来料']
const TAB_FOLD = '折叠棉'
const F_FOLD = '炭棒直径'          // 固定表(折叠棉)的自定义列(上一轮已建)
const F_CHILD = '炭棒内径'         // 带父字段(规格)的子字段
const F_NEWTAB = '平整度'          // 系列面板:阻垢系列的自定义列
const F_NEWPARENT = '理化'         // 系列面板:新建的父分组
const CODE_FOLD = 'YJ-TEST-CUSTOM-002'
const STD_FOLD = '34.2'
const CODE_SERIES = 'YJ-TEST-SERIES-001'
const STD_SERIES = '合格'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) { fails++; process.exitCode = 1 }
}

const HELPERS = `
  window.__tp = {
    setV(el, v) {
      if (!el) return 0
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return el.value
    },
    tab(name) {
      const t = [...document.querySelectorAll('.qc-insp-sheet .rsp-page-tab')].find(e => e.innerText.trim() === name)
      t?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!t
    },
    tabs() { return [...document.querySelectorAll('.qc-insp-sheet .rsp-page-tab')].map(e => e.innerText.trim()) },
    /** 表头列序:独立列看 rowspan、分组格按 colspan 展开成叶子(见 _v-custom-tab.cjs 的踩坑注释) */
    cols() {
      const paper = document.querySelector('.qc-insp-sheet .qc-paper')
      if (!paper) return []
      const r1 = [...(paper.querySelector('tr.rs-grp')?.querySelectorAll('th.rs-th') || [])]
      const r2 = [...(paper.querySelector('tr.rs-grp2')?.querySelectorAll('th.rs-th') || [])]
      if (!r2.length) return r1.map((th) => th.innerText.trim())
      const out = []
      let g = 0
      for (const th of r1) {
        const span = Number(th.getAttribute('colspan') || 1)
        if (th.hasAttribute('rowspan')) { out.push(th.innerText.trim()); continue }
        for (let i = 0; i < span; i++) out.push((r2[g++]?.innerText || '').trim())
      }
      return out
    },
    groupSpan(name) {
      const th = [...document.querySelectorAll('.qc-insp-sheet .qc-paper tr.rs-grp th.rs-th')].find(e => e.innerText.trim() === name)
      return th ? Number(th.getAttribute('colspan') || 1) : 0
    },
    msgs() { return [...document.querySelectorAll('.el-message')].map(e => e.innerText.replace(/\\s+/g, ' ').trim()) },
    clearMsgs() { document.querySelectorAll('.el-message').forEach(e => e.remove()); return 1 },
    async addField(tabName, label, labelEn, parentName) {
      const btn = [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].find(e => e.innerText.includes('自定义字段'))
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(r => setTimeout(r, 1200))
      const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理'))
      if (!d) return 'NO-DIALOG'
      if (d.innerText.includes(label)) { d.querySelector('.el-dialog__headerbtn')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'EXISTS' }
      const items = [...d.querySelectorAll('.el-form-item')]
      const byLabel = (t) => items.find(i => (i.querySelector('.el-form-item__label')?.innerText || '').trim().startsWith(t))
      const pick = async (item, text) => {
        if (!item) return false
        item.querySelector('.el-select__wrapper')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, 700))
        const opt = [...document.querySelectorAll('.el-select-dropdown__item')].filter(o => o.offsetParent !== null).find(o => o.innerText.trim() === text)
        if (opt) { opt.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 300)); return true }
        const input = item.querySelector('.el-select__input') || item.querySelector('input')
        if (!input) return false
        window.__tp.setV(input, text)
        await new Promise(r => setTimeout(r, 400))
        const created = [...document.querySelectorAll('.el-select-dropdown__item')].filter(o => o.offsetParent !== null).find(o => o.innerText.trim() === text)
        if (created) created.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
        await new Promise(r => setTimeout(r, 400))
        return true
      }
      await pick(byLabel('所属页签'), tabName)
      if (parentName) await pick(byLabel('父字段'), parentName)
      window.__tp.setV(byLabel('字段名')?.querySelector('input'), label)
      window.__tp.setV(byLabel('英文名')?.querySelector('input'), labelEn)
      const add = [...d.querySelectorAll('.el-dialog__footer button')].find(b => b.innerText.trim() === '添加')
      add?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(r => setTimeout(r, 1800))
      const d2 = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理'))
      const state = d2 && d2.innerText.includes(label) ? 'ADDED' : 'FAILED'
      d2?.querySelector('.el-dialog__headerbtn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(r => setTimeout(r, 800))
      return state
    },
    /** 在当前页签新增一行:①填值 ②**另一次调用**点「完成」
     *  ⚠ 填值与点完成必须分成两次求值(中间隔一次 CDP 往返):编辑草稿回写原行是 Vue 的
     *    deep watcher(microtask flush),同一次求值里紧接着点完成会把草稿清掉 ⇒ 行里没值
     *    (2026-10-04 实测踩过:保存报「第 N 行物料编号不能为空」,查了半天是探针自己的锅)。 */
    async fillRow(code, colName, value) {
      const tr = [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')].find(t => t.getAttribute('data-edit') === '1')
      if (!tr) return 'NO-EDIT-ROW'
      const cols = window.__tp.cols()
      const tds = [...tr.querySelectorAll('td.rs-td')]
      const iNo = tds[cols.indexOf('物料编号')]?.querySelector('input')
      const iVal = tds[cols.indexOf(colName)]?.querySelector('input')
      if (!iNo || !iVal) return 'NO-INPUT:' + cols.join(',')
      window.__tp.setV(iNo, code)
      window.__tp.setV(iVal, value)
      return 'FILLED'
    },
    async startRow() {
      const b = [...document.querySelectorAll('.qc-insp-sheet .rs-add')].find(e => e.innerText.includes('新增数据记录行'))
      b?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(r => setTimeout(r, 1000))
      return !!b
    },
    async doneEdit() {
      const tr = [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')].find(t => t.getAttribute('data-edit') === '1')
      const done = [...(tr?.querySelectorAll('.rs-op-btn') || [])].find(e => e.innerText.includes('完成'))
      done?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(r => setTimeout(r, 500))
      return !!done
    },
    async save() {
      window.__tp.clearMsgs()
      const b = [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].find(e => e.innerText.trim() === '保存')
      b?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!b
    },
    /** 报告表体读取 */
    reportRows() {
      return [...document.querySelectorAll('.qc-rec-sheet .qr-table tbody tr')].map(tr => {
        const td = [...tr.querySelectorAll('td')]
        if (td.length < 4) return null
        const ph = td[0].querySelector('.el-select__placeholder')
        return {
          item: ((ph ? ph.innerText : td[0].innerText) || '').trim(),
          std: td[1].querySelector('input') ? td[1].querySelector('input').value : td[1].innerText.trim(),
        }
      }).filter(Boolean)
    },
    setReportCode(code) {
      const th = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t => t.innerText.trim() === '物料编码')
      const inp = th?.nextElementSibling?.querySelector('input')
      return inp ? window.__tp.setV(inp, code) : 'NO-INPUT'
    },
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
  const reqRows = async (panel) => {
    const r = await apiPost('/px/queryFormDataList', { panelCode: panel, pageNo: 1, pageSize: 1, condition: {} })
    const d = r?.data?.list?.[0]?.detail || {}
    const k = Object.keys(d)[0]
    return Array.isArray(d[k]) ? d[k] : []
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-2p-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let ws
  try {
    const tabInfo = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tabInfo.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const raw = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    const evalY = (exp) => raw(`(async () => { ${HELPERS} return await (${exp}) })()`)
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 50; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(1200); return } } }
    const waitY = async (exp, ms = 20000, step = 500) => {
      for (let i = 0; i < Math.ceil(ms / step); i++) { const v = await evalY(exp); if (v) return v; await sleep(step) }
      return null
    }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${APP}/#/login`)
    await raw(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)

    /* ─────── A 固定表面板 ─────── */
    await nav('about:blank')
    await nav(`${APP}/#/panelx/list/${PANEL_A}`)
    const tabsA = await waitY(`(() => { const t = window.__tp ? window.__tp.tabs() : []; return t.length ? JSON.stringify(t) : '' })()`, 25000)
    const tabListA = tabsA ? JSON.parse(tabsA) : []
    ok('A① 固定表面板只剩 7 张固定表(旧「自定义检验要求」页签已下线)',
      tabListA.length === 7 && !tabListA.includes('自定义检验要求'), JSON.stringify(tabListA))
    const extA = await apiGet(`/px/extFields?panel=${PANEL_A}`)
    ok('A① 旧页签上的动态字段已退绑(无不属于 7 张表的 field)',
      (extA?.data?.fields || []).every((f) => tabListA.includes(f.tab)),
      JSON.stringify((extA?.data?.fields || []).map((f) => `${f.tab}/${f.label}`)))
    await evalY(`window.__tp.tab(${JSON.stringify(TAB_FOLD)})`)
    await sleep(700)
    const foldCols = await evalY(`JSON.stringify(window.__tp.cols())`)
    ok('A② 折叠棉表的自定义列与父字段分组都还在',
      String(foldCols).includes(F_FOLD) && String(foldCols).includes(F_CHILD), String(foldCols))
    ok('A② 「规格」分组仍罩住子字段(colspan=4)', (await evalY(`window.__tp.groupSpan('规格')`)) === 4)
    const foldField = (extA?.data?.fields || []).find((f) => f.label === F_FOLD) || {}
    const foldNum = Number(String(foldField.col || '').replace('备用', ''))
    ok('A② 折叠棉的列仍落在它自己的段(备用1..20)', foldNum >= 1 && foldNum <= 20, `承载列=${foldField.col}`)

    /* ─────── B 系列面板 ─────── */
    await nav('about:blank')
    await nav(`${APP}/#/panelx/list/${PANEL_B}`)
    const tabsB = await waitY(`(() => { const t = window.__tp ? window.__tp.tabs() : []; return t.length >= 10 ? JSON.stringify(t) : '' })()`, 25000)
    const tabListB = tabsB ? JSON.parse(tabsB) : []
    ok('B③ 系列面板有 10 个页签且名称与顺序一致', JSON.stringify(tabListB) === JSON.stringify(SERIES_TABS), JSON.stringify(tabListB))
    await evalY(`window.__tp.tab('阻垢系列')`)
    await sleep(800)
    const extB0 = await apiGet(`/px/extFields?panel=${PANEL_B}`)
    const seriesCols0 = await evalY(`JSON.stringify(window.__tp.cols())`)
    ok('B③ 全自定义表:列只有「物料编号」+ 本表已有的自定义列(没有固定列)', 
      JSON.parse(String(seriesCols0) || '[]')[0] === '物料编号'
      && JSON.parse(String(seriesCols0) || '[]').every((c) => c === '物料编号' || (extB0?.data?.fields || []).some((f) => f.label === c && f.tab === '阻垢系列')),
      String(seriesCols0))
    const r4 = await evalY(`window.__tp.addField('阻垢系列', ${JSON.stringify(F_NEWTAB)}, 'Flatness', ${JSON.stringify(F_NEWPARENT)})`)
    ok(`B④ 阻垢系列加列「${F_NEWTAB}」并新建父分组「${F_NEWPARENT}」`, /ADDED|EXISTS/.test(String(r4)), String(r4))
    await sleep(1500)
    const seriesCols1 = await evalY(`JSON.stringify(window.__tp.cols())`)
    ok('B④ 该表出现该列(物料编号仍在最左)', String(seriesCols1).includes('物料编号') && String(seriesCols1).includes(F_NEWTAB), String(seriesCols1))
    ok(`B④ 表头出现新建分组「${F_NEWPARENT}」`, (await evalY(`window.__tp.groupSpan(${JSON.stringify(F_NEWPARENT)})`)) >= 1)
    const extB = await apiGet(`/px/extFields?panel=${PANEL_B}`)
    const newField = (extB?.data?.fields || []).find((f) => f.label === F_NEWTAB) || {}
    const newNum = Number(String(newField.col || '').replace('备用', ''))
    ok('B④ 该列落在阻垢系列的段(备用1..20)', newNum >= 1 && newNum <= 20, `承载列=${newField.col}`)
    ok('B④ 每表 20 个扩展位、按 10 段给账(tabPools)',
      Object.keys(extB?.data?.tabPools || {}).length === 10
      && Object.values(extB.data.tabPools).every((p) => p.capacity === 20),
      JSON.stringify(Object.fromEntries(Object.entries(extB?.data?.tabPools || {}).map(([k, v]) => [k, `${v.used}/${v.capacity}`]))))

    // B⑤ 录一行并保存(幂等:已有正确行就跳过新增)
    const preRows = await reqRows(PANEL_B)
    const pre = preRows.filter((r) => String(r['物料编号'] || '').trim() === CODE_SERIES && String(r[F_NEWTAB] || '').trim() === STD_SERIES)
    if (pre.length) {
      ok('B⑤ 阻垢系列已有一行正确记录(跳过新增,探针幂等)', true, JSON.stringify(pre[0]).slice(0, 160))
    } else {
      const started = await evalY(`window.__tp.startRow()`)
      const r5 = await evalY(`window.__tp.fillRow(${JSON.stringify(CODE_SERIES)}, ${JSON.stringify(F_NEWTAB)}, ${JSON.stringify(STD_SERIES)})`)
      await sleep(400)   // 让编辑草稿回写原行(deep watcher 的 microtask flush)
      const done = await evalY(`window.__tp.doneEdit()`)
      ok('B⑤ 新行可填(物料编号 + 自定义列)', started && String(r5) === 'FILLED' && done, `${r5} / done=${done}`)
      await evalY(`window.__tp.save()`)
      const saved = await waitY(`(() => { const m = window.__tp.msgs().join(' | '); return /成功|保存/.test(m) ? m : '' })()`, 25000)
      ok('B⑤ 保存提示出现', /成功|保存/.test(String(saved)), String(saved))
    }
    const rowsB = await reqRows(PANEL_B)
    const mineB = rowsB.filter((r) => String(r['物料编号'] || '').trim() === CODE_SERIES)
    ok('B⑤ 落库到 qc_insp_req_series:物料类别=阻垢系列、列值正确',
      mineB.some((r) => String(r['物料类别']).trim() === '阻垢系列' && String(r[F_NEWTAB] || '').trim() === STD_SERIES),
      JSON.stringify(mineB).slice(0, 200))

    /* ─────── C 带入检验数据记录(两个面板都要带) ─────── */
    let ready = null
    for (let a = 1; a <= 5 && !ready; a++) {
      await nav('about:blank')
      await nav(`${APP}/#/panelx/list/QC_INSP_REC`)
      await sleep(3000)
      await raw(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
      ready = await raw(`(() => { const side = [...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g,'')); return (document.querySelector('.qc-rec-sheet') && side.includes('新增')) ? 'READY' : '' })()`)
      if (!ready) await sleep(2000)
    }
    ok('C⑥ 检验报告面板就绪', ready === 'READY', ready)
    await raw(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    await sleep(3500)
    /** 写入物料编码并等带入结果。
     *  ⚠ 自动带入只在**报告表体还空着**时触发(设计如此);第二次换物料必须点「⧉ 带入检验要求」按钮。 */
    const carryOf = async (code, want, { auto = true } = {}) => {
      let rows = []
      for (let i = 0; i < 6 && !rows.some((r) => r.item === want); i++) {
        await evalY(`window.__tp.setReportCode(${JSON.stringify(code)})`)
        if (!auto || i > 0) await evalY(`(() => { const b = document.querySelector('.qr-carry-btn'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
        for (let k = 0; k < 12; k++) {
          await sleep(500)
          rows = await evalY(`window.__tp.reportRows()`) || []
          if (rows.some((r) => r.item === want)) break
        }
      }
      return rows
    }
    const rowsFold = await carryOf(CODE_FOLD, F_FOLD, { auto: true })
    ok('C⑥ 固定表(折叠棉)的自定义列带进来了', rowsFold.some((r) => r.item === F_FOLD && r.std === STD_FOLD), JSON.stringify(rowsFold))
    ok('C⑦ 父字段名「规格」没有被当成检验项', !rowsFold.some((r) => r.item === '规格'))
    const rowsSeries = await carryOf(CODE_SERIES, F_NEWTAB, { auto: false })
    ok('C⑥ 系列面板(阻垢系列)的自定义列也带进来了', rowsSeries.some((r) => r.item === F_NEWTAB && r.std === STD_SERIES), JSON.stringify(rowsSeries))
    ok('C⑦ 系列面板的父字段名「理化」没有被当成检验项', !rowsSeries.some((r) => r.item === F_NEWPARENT))

    // C⑧ 检验要求弹窗:按面板分段
    await evalY(`window.__tp.setReportCode(${JSON.stringify(CODE_SERIES)})`)
    await sleep(1200)
    await evalY(`(() => { const s = [...document.querySelectorAll('.qr-lib-btn')].find(e => e.innerText.includes('检验要求')); s?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!s })()`)
    let dlg = ''
    for (let k = 0; k < 20 && !dlg; k++) {
      await sleep(700)
      const t = await evalY(`(() => { const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('来料检验要求')); return d ? d.innerText.replace(/\\s+/g, ' ') : '' })()`)
      if (t && t.includes(STD_SERIES)) dlg = t
    }
    ok('C⑧ 检验要求弹窗显示系列面板的命中行(含页签名与原值)',
      dlg.includes('阻垢系列') && dlg.includes(F_NEWTAB) && dlg.includes(STD_SERIES), String(dlg).slice(0, 240))
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    edge.kill()
    await sleep(500)
  }
  console.log(fails ? `\n✖ 失败 ${fails} 项` : '\n✔ 全部通过')
}
main().catch((e) => { console.error('探针异常:', e); process.exitCode = 1 })
