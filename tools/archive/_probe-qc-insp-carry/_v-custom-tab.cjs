/* _v-custom-tab.cjs — 来料检验要求「每张表各自的自定义列」+ 带入检验数据记录 端到端实测
 *
 * 用户口径(2026-10-04,两轮):
 *   ①「我想在来料检验要求加一个 tab 表这个表可以自定义字段的,这样的表能不能也实现带入到检验数据记录」
 *   ②「检验数据要求的自定义字段,是单独针对每个表的」—— 每张表各有各的自定义列
 * 本探针逐条取证:
 *   ① 8 个页签(7 张固定表 + 自定义检验要求),管理员可见「⚙ 自定义字段」
 *   ② 给**固定表**加自定义列(折叠棉 + 炭棒直径):只出现在折叠棉表,别的表不串
 *   ③ 不同表可以**同名**(垫片 + 外观):两表各一列,互不影响
 *   ④ 全自定义表(自定义检验要求 + 平整度)照旧
 *   ⑤ 录数据并保存(折叠棉表:物料编号 + 炭棒直径)
 *   ⑥ 落库核对(物料类别=折叠棉、该列值进备用列)
 *   ⑦ 列名进「检验项」标准库
 *   ⑧ **带入检验数据记录**:该物料 → 检验项=炭棒直径 / 检测标准=数据;别的表的列不带进来
 *   ⑨ 「⧉ 检验要求」弹窗能看到该表与这一行
 *
 * ⚠ 只打测试账套(登录 factory=YJ_TEST → HSDZ_MES_TEST):会真加字段、加数据行并保存(演示数据);
 *   字段已存在时按"已有"处理(探针可重复跑)。
 * 用法:node tools/archive/_probe-qc-insp-carry/_v-custom-tab.cjs [前端地址,默认 http://127.0.0.1:8090]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9366
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const FACTORY = 'YJ_TEST'
const TAB_CUSTOM = '自定义检验要求'
const TAB_FOLD = '折叠棉'
const TAB_GASKET = '垫片'
const F_FOLD = '炭棒直径'          // 固定表(折叠棉)的自定义列
const F_CUSTOM = '平整度'          // 全自定义表(自定义检验要求)的自定义列
const F_DUP = '外观'               // 与别的表同名的自定义列(垫片)
const CODE_FOLD = 'YJ-TEST-CUSTOM-002'   // 折叠棉表:带自定义列的数据行
const CODE_CUSTOM = 'YJ-TEST-CUSTOM-001' // 自定义表:上一轮建的演示行
const STD_FOLD = '34.2'
const STD_CUSTOM = '无毛刺、无划痕'
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
    tab(name) {
      const t = [...document.querySelectorAll('.qc-insp-sheet .rsp-page-tab')].find(e => e.innerText.trim() === name)
      t?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!t
    },
    activeTab() { return document.querySelector('.qc-insp-sheet .rsp-page-tab.active')?.innerText.trim() || '' },
    /** 表头列序(按 DOM 真实列序):两行表头里第一行的分组格 colspan=N 要展开成下面 N 个叶子列名。
     *  ⚠ 直接 row1 文本 + row2 文本拼接会错位(分组格里是"规格",叶子在第二行)——
     *    按拼接结果取列下标就会把值填进隔壁列(实测踩过:34.2 填进了「折数」)。 */
    cols() {
      const paper = document.querySelector('.qc-insp-sheet .qc-paper')
      if (!paper) return []
      const r1 = [...(paper.querySelector('tr.rs-grp')?.querySelectorAll('th.rs-th') || [])]
      const r2 = [...(paper.querySelector('tr.rs-grp2')?.querySelectorAll('th.rs-th') || [])]
      const out = []
      let g = 0
      for (const th of r1) {
        const span = Number(th.getAttribute('colspan') || 1)
        if (span > 1) { for (let i = 0; i < span; i++) out.push((r2[g++]?.innerText || '').trim()) }
        else out.push(th.innerText.trim())
      }
      return out
    },
    rows() {
      return [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')].map((tr) => {
        const tds = [...tr.querySelectorAll('td.rs-td')]
        if (!tds.length) return null
        return tds.map(td => { const i = td.querySelector('input'); return i ? i.value : td.innerText.trim() })
      }).filter(Boolean)
    },
    msgs() { return [...document.querySelectorAll('.el-message')].map(e => e.innerText.replace(/\\s+/g, ' ').trim()) },
    clearMsgs() { document.querySelectorAll('.el-message').forEach(e => e.remove()); return 1 },
    /** 打开「自定义字段」并给指定页签加一列(走弹窗表单:所属页签 + 字段名 + 英文名 → 添加) */
    async addField(tabName, label, labelEn) {
      const btn = [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].find(e => e.innerText.includes('自定义字段'))
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(r => setTimeout(r, 1200))
      const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理'))
      if (!d) return 'NO-DIALOG'
      if (d.innerText.includes(label)) {   // 已有同名字段:关掉弹窗按"已存在"处理
        d.querySelector('.el-dialog__headerbtn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        return 'EXISTS'
      }
      const items = [...d.querySelectorAll('.el-form-item')]
      const byLabel = (t) => items.find(i => (i.querySelector('.el-form-item__label')?.innerText || '').trim().startsWith(t))
      // 所属页签(分页签面板才有这个表单项)
      const tabItem = byLabel('所属页签')
      if (tabItem) {
        tabItem.querySelector('.el-select__wrapper')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, 600))
        const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find(o => o.innerText.trim() === tabName)
        opt?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, 300))
      }
      window.__ct.setV(byLabel('字段名')?.querySelector('input'), label)
      window.__ct.setV(byLabel('英文名')?.querySelector('input'), labelEn)
      const add = [...d.querySelectorAll('.el-dialog__footer button')].find(b => b.innerText.trim() === '添加')
      add?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(r => setTimeout(r, 1800))
      const d2 = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理'))
      const state = d2 && d2.innerText.includes(label) ? 'ADDED' : 'FAILED'
      d2?.querySelector('.el-dialog__headerbtn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(r => setTimeout(r, 800))
      return state + '|tab=' + (tabItem ? '有' : '无')
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ctab2-'))
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
    const evalY = (exp) => raw(`(async () => { ${HELPERS} return await (${exp}) })()`)
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

    // ── ① 页签与入口 ──
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
    ok('① 8 个页签且含「自定义检验要求」', tabList.includes(TAB_CUSTOM), JSON.stringify(tabList))
    ok('① 管理员可见「⚙ 自定义字段」入口',
      await evalY(`[...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].some(e => e.innerText.includes('自定义字段'))`))

    // ── ② 给固定表(折叠棉)加自定义列 ──
    await evalY(`window.__ct.tab(${JSON.stringify(TAB_FOLD)})`)
    await sleep(600)
    const r2 = await evalY(`window.__ct.addField(${JSON.stringify(TAB_FOLD)}, ${JSON.stringify(F_FOLD)}, 'RodDiameter')`)
    ok(`② 弹窗给「${TAB_FOLD}」加列「${F_FOLD}」`, /ADDED|EXISTS/.test(String(r2)), String(r2))
    await sleep(1500)
    const foldCols = await waitForY(`(() => { const c = window.__ct.cols(); return c.includes(${JSON.stringify(F_FOLD)}) ? JSON.stringify(c) : '' })()`, 20000)
    const foldColList = foldCols ? JSON.parse(foldCols) : []
    ok(`② 折叠棉表出现「${F_FOLD}」(在固定列之后)`, foldColList[foldColList.length - 1] === F_FOLD, JSON.stringify(foldColList))

    // ── ③ 别的表不串 + 允许同名 ──
    await evalY(`window.__ct.tab(${JSON.stringify(TAB_GASKET)})`)
    await sleep(700)
    const gasketCols0 = await evalY(`JSON.stringify(window.__ct.cols())`)
    ok(`③ 垫片表**没有**折叠棉的自定义列「${F_FOLD}」`, !String(gasketCols0).includes(F_FOLD), String(gasketCols0))
    const r3 = await evalY(`window.__ct.addField(${JSON.stringify(TAB_GASKET)}, ${JSON.stringify(F_DUP)}, 'Appearance')`)
    ok(`③ 垫片表可加同名/自有列「${F_DUP}」`, /ADDED|EXISTS/.test(String(r3)), String(r3))
    await sleep(1500)
    const gasketCols = await evalY(`JSON.stringify(window.__ct.cols())`)
    ok(`③ 垫片表出现「${F_DUP}」且仍无「${F_FOLD}」`,
      String(gasketCols).includes(F_DUP) && !String(gasketCols).includes(F_FOLD), String(gasketCols))
    ok('③ 两表同名列各自独立(列名不冲突)',
      foldColList.includes(F_FOLD) && String(gasketCols).includes(F_DUP))

    // ── ④ 全自定义表照旧 ──
    await evalY(`window.__ct.tab(${JSON.stringify(TAB_CUSTOM)})`)
    await sleep(700)
    const customCols = await waitForY(`(() => { const c = window.__ct.cols(); return c.includes(${JSON.stringify(F_CUSTOM)}) ? JSON.stringify(c) : '' })()`, 15000)
    ok(`④ 自定义检验要求表仍有「${F_CUSTOM}」(首列=物料编号)`,
      String(customCols).includes('物料编号') && String(customCols).includes(F_CUSTOM), String(customCols))

    // ── ⑤ 折叠棉表录一行(物料编号 + 自定义列)并保存 ──
    // 幂等:该编号若已有一行"值正确"的记录(上次跑过),就不再新增(否则每跑一次多一行)
    const reqRowsAll = async () => {
      const r = await apiPost('/px/queryFormDataList', { panelCode: 'QC_INSP_REQ', pageNo: 1, pageSize: 1, condition: {} })
      return r?.data?.list?.[0]?.detail?.qc_insp_req || []
    }
    const pre = (await reqRowsAll()).filter((r) => String(r['物料编号'] || '').trim() === CODE_FOLD
      && String(r[TAB_FOLD === '折叠棉' ? F_FOLD : F_FOLD] || '').trim() === STD_FOLD)
    await evalY(`window.__ct.tab(${JSON.stringify(TAB_FOLD)})`)
    await sleep(700)
    if (pre.length) {
      ok('⑤ 折叠棉表已有一行正确记录(跳过新增,探针幂等)', true, JSON.stringify(pre[0]).slice(0, 160))
    } else {
      await evalY(`(() => { window.__ct.clearMsgs(); const b = [...document.querySelectorAll('.qc-insp-sheet .rs-add')].find(e => e.innerText.includes('新增数据记录行')); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
      await sleep(1000)
      const filled = await evalY(`(() => {
        const tr = [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')].find(t => t.getAttribute('data-edit') === '1')
        if (!tr) return 'NO-EDIT-ROW'
        const cols = window.__ct.cols()
        const tds = [...tr.querySelectorAll('td.rs-td')]
        const idx = (name) => cols.indexOf(name)
        const iNo = tds[idx('物料编号')]?.querySelector('input')
        const iRod = tds[idx(${JSON.stringify(F_FOLD)})]?.querySelector('input')
        if (!iNo || !iRod) return 'NO-INPUT:' + cols.join(',')
        window.__ct.setV(iNo, ${JSON.stringify(CODE_FOLD)})
        window.__ct.setV(iRod, ${JSON.stringify(STD_FOLD)})
        return 'OK:' + iNo.value + '|' + iRod.value + '|col=' + cols[idx(${JSON.stringify(F_FOLD)})]
      })()`)
      ok('⑤ 折叠棉表新行可填(物料编号 + 自定义列,列按表头真实列序定位)', String(filled).startsWith('OK:'), String(filled))
      await evalY(`(() => { const tr = [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')].find(t => t.getAttribute('data-edit') === '1'); const b = [...(tr?.querySelectorAll('.rs-op-btn') || [])].find(e => e.innerText.includes('完成')); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
      await sleep(600)
      await evalY(`(() => { window.__ct.clearMsgs(); const b = [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].find(e => e.innerText.trim() === '保存'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
      const saved = await waitForY(`(() => { const m = window.__ct.msgs().join(' | '); return /保存|成功/.test(m) ? m : '' })()`, 25000)
      ok('⑤ 保存提示出现', /成功|保存/.test(String(saved)), String(saved))
    }

    // ── ⑥ 落库核对(探针可重复跑:该编号可能已有历史行 ⇒ 断言"至少一行且值正确")──
    const items = await reqRowsAll()
    const mine = items.filter((r) => String(r['物料编号'] || '').trim() === CODE_FOLD)
    ok('⑥ 落库:折叠棉表该物料有行', mine.length >= 1, JSON.stringify(mine).slice(0, 220))
    ok('⑥ 落库:物料类别 = 折叠棉', mine.some((r) => String(r['物料类别']).trim() === TAB_FOLD), JSON.stringify(mine[0]?.['物料类别']))
    ok(`⑥ 落库:${F_FOLD} = ${STD_FOLD}(没串到别的列)`,
      mine.some((r) => String(r[F_FOLD] || '').trim() === STD_FOLD)
      && !mine.some((r) => String(r['折数'] || '').trim() === STD_FOLD),
      JSON.stringify(mine.map((r) => ({ 折数: r['折数'], [F_FOLD]: r[F_FOLD] }))))

    // ── ⑦ 列名进标准库 ──
    const sl = await apiGet('/stdlib/list?lib=qc.insp_item')
    const stdItems = (sl?.data || []).map((x) => String(x.content))
    ok(`⑦ 「${F_FOLD}」「${F_DUP}」都已登记进检验项标准库`,
      stdItems.includes(F_FOLD) && stdItems.includes(F_DUP), stdItems.slice(-8).join(' , '))

    // ── ⑧ 带入检验数据记录(折叠棉表:固定列 + 自定义列) ──
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
    await sleep(3500)
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
    for (let i = 0; i < 6 && !repRows.some((r) => r.item === F_FOLD); i++) {
      await evalY(`(() => {
        const th = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t => t.innerText.trim() === '物料编码')
        const inp = th?.nextElementSibling?.querySelector('input')
        if (!inp) return 'NO-INPUT'
        window.__ct.clearMsgs()
        return window.__ct.setV(inp, ${JSON.stringify(CODE_FOLD)})
      })()`)
      for (let k = 0; k < 12; k++) {
        await sleep(500)
        repRows = await evalY(REPORT_ROWS) || []
        if (repRows.some((r) => r.item === F_FOLD)) break
      }
    }
    ok('⑧ 带入:固定表的自定义列也进来了', repRows.some((r) => r.item === F_FOLD), JSON.stringify(repRows))
    ok(`⑧ 检验项「${F_FOLD}」的检测标准 = ${STD_FOLD}`,
      repRows.some((r) => r.item === F_FOLD && r.std === STD_FOLD), JSON.stringify(repRows))
    ok(`⑧ 别的表的自定义列「${F_DUP}」没被带进来`, !repRows.some((r) => r.item === F_DUP), JSON.stringify(repRows.map((r) => r.item)))

    // ── ⑨ 检验要求弹窗:该表 + 该列可见 ──
    await evalY(`(() => { const s = [...document.querySelectorAll('.qr-lib-btn')].find(e => e.innerText.includes('检验要求')); s?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!s })()`)
    let dlg2 = ''
    for (let k = 0; k < 20 && !dlg2; k++) {
      await sleep(700)
      const t = await evalY(`(() => { const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('来料检验要求')); return d ? d.innerText.replace(/\\s+/g, ' ') : '' })()`)
      if (t && t.includes(STD_FOLD)) dlg2 = t
    }
    ok(`⑨ 检验要求弹窗显示「${TAB_FOLD}」表与自定义列「${F_FOLD}」`,
      dlg2.includes(TAB_FOLD) && dlg2.includes(F_FOLD), String(dlg2).slice(0, 240))
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    edge.kill()
    await sleep(500)
  }
  console.log(fails ? `\n✖ 失败 ${fails} 项` : '\n✔ 全部通过')
}
main().catch((e) => { console.error('探针异常:', e); process.exitCode = 1 })
