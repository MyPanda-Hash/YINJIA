/* _v-qc-insp-carry.cjs — 检验报告「按物料编码带入来料检验要求」浏览器实测(等待式,抗 HMR 抖动)
   用户口径(2026-10-04):「更改检验报告,需要根据物料编码能够在来料检验要求找到对应的行。
     并且在检验项和检验标准中,做到对应填入检验项就是上面的检验项目,检验标准就是下面对应的数据。」
   本探针逐条取证:
     ① 来料检验要求面板能渲染出行(detail 键 = qc_insp_req 的回归;此前 7 页签全「暂无数据」)
     ② 报告抬头「⧉ 检验要求」弹窗按物料编码**找得到对应的行**
     ③ 填好物料编码 → 自动带入:检验项=表头列名 / 检测标准=该列数据(按 Excel 原列序,空数据列不带)
     ④ 只补缺失项:已填的检测结果不被覆盖;缺的按来料检验要求顺序补进来
     ⑤ 幂等:再点「带入检验要求」一行都不加
     ⑥ 要求表里没有的物料 → 提示无法带入,表体不动
    ⚠ 2026-10-09 调整(用户口径「物料名称和物料编码要关联商品,并且要两个一并填入」):
      物料编码/物料名称 从手输框改成**商品参照格** ⇒ 原先「setV 输码」的三步(③⑥⑦)改为
      「clickRef 点格子 → 弹窗按编码查到商品 → 勾选确定」,并顺带核对**两个字段一并填入**。
      第⑥步的「无要求物料」因此换成真实存在但要求表里没有的商品(bs_inv 3-01-16-0012)。
   用法:node tools/archive/_probe-qc-insp-carry/_v-qc-insp-carry.cjs [前端地址]
        前端地址默认 http://localhost:5173(vite 热更);传 http://127.0.0.1:8090 即测**打包版**
        (jar 内 BOOT-INF/classes/static —— 用户实际在看的那个实例,改前端后必测它一遍)
   口径真值(库实测):YJ-YCYX-006 折叠棉 → 折叠棉/炭棒/折数/折高(实配炭棒后外径为空 → 不带) */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9362
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
/** 被测前端:默认 vite 热更(5173);传 http://127.0.0.1:8090 即测**打包版**(jar 内 static,用户实际在看的那个) */
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://localhost:5173').replace(/\/$/, '')
const CODE = 'YJ-YCYX-006'
const MAT_NAME = '折叠棉'            // 商品档案(bs_inv)里 YJ-YCYX-006 的存货名称 —— 选商品时应一并填入
const EXPECT = [
  ['折叠棉', '47*34*154-1'],
  ['炭棒', '34*12*154'],
  ['折数', '75±5'],
  ['折高', '6--7'],
]
// 2026-10-09 起物料编码只能**从商品档案里选**,乱码再也输不进去 ⇒ 用真实存在但**要求表里没有**的商品:
// bs_inv 有 3-01-16-0012(SP-FX2-X60-RO),qc_insp_req 里没有该物料编号(实测)。
const NO_REQ_CODE = '3-01-16-0012'
const MARK = '实测:外观无脏污'      // 已填检测结果的哨兵值(验证不被覆盖)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) { fails++; process.exitCode = 1 }
}

/** 页面内工具(每次导航后随表达式一起注入,免得被页面切换冲掉) */
const HELPERS = `
  window.__yj = {
    setV(el, v) {
      if (!el) return 0
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return el.value
    },
    headInput(label) {
      const th = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t => t.innerText.trim() === label)
      return th ? th.nextElementSibling?.querySelector('input') : null
    },
    /** ⚠ 2026-10-09 起 物料名称/物料编码 是**商品参照格**(不再有 input)⇒ 它们只能走 clickRef + 弹窗选择,
     *  headInput 现在只对**仍是文本框**的抬头字段(备注等)有用;取物料两列请用 headVal/isRefCell。 */
    /** 抬头格取值:商品参照格(.qr-ref-text)/输入框 / **只读文本**(文件编码/检验依据/物料批次 这类回填字段)。
     *  2026-10-09 起 物料名称/物料编码 是**商品参照格**(没有 input)⇒ 必须优先取 .qr-ref-text */
    headVal(label) {
      const th = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t => t.innerText.trim() === label)
      const td = th?.nextElementSibling
      if (!td) return ''
      const rt = td.querySelector('.qr-ref-text')
      if (rt) { const s = rt.innerText.trim(); return (s === '点击选择' || s === 'Click to pick') ? '' : s }
      const inp = td.querySelector('input')
      return inp ? inp.value : td.innerText.trim()
    },
    /** 抬头格是不是商品参照格(物料两列 = 参照 商品档案,不能再手输) */
    isRefCell(label) {
      const th = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t => t.innerText.trim() === label)
      return !!(th?.nextElementSibling?.querySelector('.qr-ref-ctl'))
    },
    clickRef(label) {
      const th = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t => t.innerText.trim() === label)
      const c = th?.nextElementSibling?.querySelector('.qr-ref-ctl')
      c?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!c
    },
    /** 商品参照弹窗(RefPickDialog 根 .rpd 所在的那个 el-dialog) */
    dlg() { return [...document.querySelectorAll('.el-dialog')].find(d => d.querySelector('.rpd')) || null },
    dlgTitle() { const d = window.__yj.dlg(); return d ? (d.querySelector('.el-dialog__header')?.innerText || '').trim() : '' },
    dlgTotal() {
      const d = window.__yj.dlg(); if (!d) return -1
      const m = (d.querySelector('.rpd-tip')?.innerText || '').match(/共\\s*(\\d+)\\s*条/)
      return m ? Number(m[1]) : -1
    },
    dlgRows() { const d = window.__yj.dlg(); return d ? d.querySelectorAll('.el-table__body-wrapper tbody tr').length : 0 },
    setKeyword(v) { const d = window.__yj.dlg(); return window.__yj.setV(d?.querySelector('.rpd-toolbar input'), v) },
    clickQuery() {
      const d = window.__yj.dlg()
      const b = [...(d?.querySelectorAll('.rpd-toolbar .el-button') || [])].find(x => x.innerText.includes('查询'))
      b?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!b
    },
    pickFirst() {
      const d = window.__yj.dlg()
      const tr = d?.querySelector('.el-table__body-wrapper tbody tr')
      const cb = tr?.querySelector('.el-checkbox')
      cb?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return { clicked: !!cb, row: tr ? tr.innerText.replace(/\\s+/g, ' ').trim() : '' }
    },
    confirm() {
      const d = window.__yj.dlg()
      const b = d?.querySelector('.el-dialog__footer .el-button--primary')
      if (!b || b.disabled) return false
      b.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return true
    },
    /** 检验项取值:el-select 里**第一个** .el-select__selected-item 是 filterable 的输入外壳(innerText 恒空),
     *  选中值在下一個 .el-select__placeholder 里 —— 踩过,别再用 .el-select__selected-item.innerText */
    itemOf(td) {
      const ph = td.querySelector('.el-select__placeholder')
      const t = (ph ? ph.innerText : td.innerText).trim()
      return t === '请选择' ? '' : t
    },
    rows() {
      return [...document.querySelectorAll('.qc-rec-sheet .qr-table tbody tr')].map((tr) => {
        const td = [...tr.querySelectorAll('td')]
        if (td.length < 4) return null
        return {
          item: window.__yj.itemOf(td[0]),
          std: td[1].querySelector('input') ? td[1].querySelector('input').value : td[1].innerText.trim(),
          result: td[2].querySelector('textarea') ? td[2].querySelector('textarea').value : td[2].innerText.trim(),
        }
      }).filter(Boolean)
    },
    msgs() { return [...document.querySelectorAll('.el-message')].map(e => e.innerText.replace(/\\s+/g, ' ').trim()) },
    clearMsgs() { document.querySelectorAll('.el-message').forEach(e => e.remove()); return 1 },
    clickCarry() { const b = document.querySelector('.qr-carry-btn'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b },
  };
`

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-carry-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1500,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let ws
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const raw = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const evaluate = (exp) => raw(exp)
    /** 带 __yj 工具的页面求值 */
    const evalY = (exp) => raw(`(() => { ${HELPERS} return (${exp}) })()`)
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1000); return } } }
    const waitForY = async (exp, ms = 20000, step = 500) => {
      for (let i = 0; i < Math.ceil(ms / step); i++) {
        const v = await evalY(exp)
        if (v) return v
        await sleep(step)
      }
      return null
    }
    await send('Page.enable'); await send('Runtime.enable')

    /** 商品参照弹窗里按编码选一条并确定(2026-10-09 物料两列改成参照后新增的取数路径) */
    async function pickMaterial(code) {
      const opened = await waitForY(`window.__yj.dlg() ? 'DLG' : ''`, 15000)
      if (!opened) return { ok: false, why: '参照弹窗没开' }
      await evalY(`window.__yj.setKeyword(${JSON.stringify(code)})`)
      await evalY(`window.__yj.clickQuery()`)
      const listed = await waitForY(`(() => { const n = window.__yj.dlgTotal(); return (n > 0 && window.__yj.dlgRows() > 0) ? n : 0 })()`, 20000)
      if (!listed) return { ok: false, why: '按编码查不到商品' }
      const picked = await evalY(`JSON.stringify(window.__yj.pickFirst())`)
      await sleep(400)
      const confirmed = await waitForY(`window.__yj.confirm() ? 'OK' : ''`, 8000)
      await sleep(800)
      return { ok: !!confirmed, row: JSON.parse(picked || '{}').row }
    }

    await navigate(`${APP}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)

    // ── ① 来料检验要求面板:能渲染出行(detail 键回归) ──
    let rowsShown = 0
    for (let i = 0; i < 3 && !rowsShown; i++) {
      await navigate('about:blank')
      await navigate(`${APP}/#/panelx/list/QC_INSP_REQ`)
      rowsShown = await waitForY(`(() => {
        const tabs = document.querySelectorAll('.qc-insp-sheet .rsp-page-tab').length
        const rows = [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')].filter(r => r.querySelector('.rs-td')).length
        return (tabs >= 7 && rows > 0) ? rows : 0
      })()`, 20000)
    }
    ok('① 来料检验要求面板渲染出数据行(detail 键 = qc_insp_req)', rowsShown > 0, `折叠棉页签 ${rowsShown} 行`)

    // ── ② 检验报告页 + 新增一张空报告 ──
    let ready = null
    for (let attempt = 1; attempt <= 5 && !ready; attempt++) {
      await navigate('about:blank')
      await navigate(`${APP}/#/panelx/list/QC_INSP_REC`)
      await sleep(3000)
      await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
      ready = await raw(`(() => {
        const sheet = document.querySelector('.qc-rec-sheet')
        const side = [...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g, ''))
        return (sheet && side.includes('新增')) ? 'READY' : ''
      })()`)
      if (!ready) await sleep(2500)
    }
    ok('② 检验报告面板就绪', ready === 'READY', ready)
    if (ready !== 'READY') throw new Error('面板未就绪,终止')

    await evaluate(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    const isFresh = `(() => {
      const sheet = document.querySelector('.qc-rec-sheet')
      if (!sheet) return ''
      // 文件编码 现为**只读文本**(按物料编码带入、不可修改)⇒ 取值要走 headVal(输入框或文本)
      return (window.__yj.headVal('文件编码') === 'YJ-QR-96' && window.__yj.rows().length === 0) ? 'FRESH' : ''
    })()`
    const fresh = await waitForY(isFresh, 25000)
    ok('② 纸面切到一张空报告(表体 0 行)', fresh === 'FRESH', fresh)
    // 新增后页面还会再取一次数(草稿对象被替换)——等它稳下来再写值,否则写进去会被冲掉
    await sleep(2000)
    ok('② 空报告态已稳定(1.5s 后仍为空)', (await evalY(isFresh)) === 'FRESH')
    ok('② 分区条上有「带入检验要求」按钮', await evalY(`!!document.querySelector('.qr-carry-btn')`))

    // ── ③ 选好物料编码(商品参照)→ 自动带入 ──
    // 2026-10-09 起 物料编码/物料名称 是**商品参照格**(用户口径「关联商品、两个一并填入」),
    // 不能再手输 ⇒ 本步改成「点格子弹商品参照 → 按编码查到 → 勾选确定」,其余口径不变。
    ok('③ 物料编码格已是商品参照格(不再是手输框)', await evalY(`window.__yj.isRefCell('物料编码')`))
    let autoHit = null
    for (let i = 0; i < 6 && !autoHit; i++) {
      await evalY(`window.__yj.clearMsgs()`)
      await evalY(`window.__yj.clickRef('物料编码')`)
      const picked = await pickMaterial(CODE)
      if (!picked.ok) { console.log(`   [重试 ${i + 1}/6] 商品参照未选中:${picked.why || ''}`); await sleep(1200); continue }
      autoHit = await waitForY(`(() => {
        const r = window.__yj.rows()
        return (r.length === ${EXPECT.length} && window.__yj.headVal('物料编码') === ${JSON.stringify(CODE)}) ? JSON.stringify(r) : ''
      })()`, 8000)
      if (!autoHit) { await sleep(1200); console.log(`   [重试 ${i + 1}/6] 物料编码未生效或未带入`) }
    }
    const autoRows = JSON.parse(autoHit || (await evalY(`JSON.stringify(window.__yj.rows())`)) || '[]')
    ok(`③ 选好商品后自动带入 ${EXPECT.length} 项(物料 ${CODE})`, !!autoHit, JSON.stringify(autoRows.map((r) => [r.item, r.std])))
    ok('③ 选商品同时把「物料名称」一并填入商品档案的存货名称',
      (await evalY(`window.__yj.headVal('物料名称')`)) === MAT_NAME, String(await evalY(`window.__yj.headVal('物料名称')`)))
    ok('③ 检验项=来料检验要求表头列名、检测标准=该列数据(顺序=Excel 原列序)',
      JSON.stringify(autoRows.map((r) => [r.item, r.std])) === JSON.stringify(EXPECT),
      JSON.stringify(autoRows.map((r) => [r.item, r.std])))
    ok('③ 空数据列(实配炭棒后外径)未被带成空行', !autoRows.some((r) => r.item === '实配炭棒后外径'))
    const msgs1 = await evalY(`JSON.stringify(window.__yj.msgs())`)
    ok('③ 有「已按来料检验要求带入 N 项」提示', /带入/.test(String(msgs1)), String(msgs1))

    // ── ④ 只补缺失项:已填检测结果不覆盖 ──
    await evalY(`(() => {
      window.__yj.clearMsgs()
      const ta = document.querySelector('.qc-rec-sheet .qr-table tbody tr td.c-result textarea')
      return window.__yj.setV(ta, ${JSON.stringify(MARK)})
    })()`)
    await sleep(500)
    const delOk = await evalY(`(() => {
      const trs = [...document.querySelectorAll('.qc-rec-sheet .qr-table tbody tr')]
      const tr = trs.find(t => window.__yj.itemOf(t.querySelector('td.c-item')) === '折数')
      tr?.querySelector('.qr-del')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!tr
    })()`)
    await sleep(700)
    const afterDel = await evalY(`window.__yj.rows().length`)
    ok('④ 删掉「折数」行后表体剩 3 行', delOk && afterDel === 3, String(afterDel))
    await evalY(`window.__yj.clickCarry()`)
    const backHit = await waitForY(`(() => { const r = window.__yj.rows(); return r.length === ${EXPECT.length} ? JSON.stringify(r) : '' })()`, 20000)
    const backRows = JSON.parse(backHit || '[]')
    ok('④ 再带入:缺的「折数」补回来了(4 行)', !!backHit, JSON.stringify(backRows.map((r) => [r.item, r.std])))
    ok('④ 已填的检测结果未被覆盖(哨兵值还在)', String(backRows[0]?.result || '') === MARK, JSON.stringify(backRows[0]))
    ok('④ 已存在的检验项没有被重复添加', backRows.filter((r) => r.item === '折叠棉').length === 1)

    // ── ⑤ 幂等 ──
    await evalY(`(() => { window.__yj.clearMsgs(); return window.__yj.clickCarry() })()`)
    await sleep(1800)
    const after5 = await evalY(`window.__yj.rows().length`)
    const msgs2 = await evalY(`JSON.stringify(window.__yj.msgs())`)
    ok('⑤ 再点带入:仍 4 行(幂等)', after5 === EXPECT.length, String(after5))
    ok('⑤ 提示「检验项已与来料检验要求一致，无需带入」', /无需带入/.test(String(msgs2)), String(msgs2))

    // ── ⑥ 要求表里没有的物料 ──
    await evalY(`window.__yj.clearMsgs()`)
    await evalY(`window.__yj.clickRef('物料编码')`)
    const noReq = await pickMaterial(NO_REQ_CODE)
    ok(`⑥ 换成「要求表里没有」的真实商品 ${NO_REQ_CODE}`, noReq.ok, String(noReq.row))
    await sleep(1600)
    const after6a = await evalY(`window.__yj.rows().length`)
    ok('⑥ 换成无要求物料:表体不被自动清空/重建(仍有 4 行)', after6a === EXPECT.length, String(after6a))
    await evalY(`window.__yj.clickCarry()`)
    await sleep(1800)
    const msgs3 = await evalY(`JSON.stringify(window.__yj.msgs())`)
    const after6b = await evalY(`window.__yj.rows().length`)
    ok('⑥ 提示「来料检验要求里没有该物料的检验数据，无法带入」', /无法带入/.test(String(msgs3)), String(msgs3))
    ok('⑥ 表体仍 4 行没变', after6b === EXPECT.length, String(after6b))

    // ── ⑦ 「⧉ 检验要求」弹窗按物料编码找得到对应的行 ──
    await evalY(`window.__yj.clickRef('物料编码')`)
    const back = await pickMaterial(CODE)
    ok(`⑦ 换回有要求的商品 ${CODE}`, back.ok, String(back.row))
    await sleep(1200)
    await evalY(`(() => { const s = document.querySelector('.qr-lib-btn:not(.qr-carry-btn)'); s?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!s })()`)
    const dlg = await waitForY(`(() => {
      const d = document.querySelector('.el-dialog')
      const t = d ? d.innerText.replace(/\\s+/g, ' ') : ''
      return (t.includes('来料检验要求') && t.includes('47*34*154-1')) ? t.slice(0, 220) : ''
    })()`, 20000)
    ok('⑦ 「检验要求」弹窗按物料编码列出该物料的行', !!dlg, String(dlg))

    // ── ⑧ 多语言(AGENTS.md 强制):切 en/zh-TW 后新入口显示目标语言而非中文 ──
    for (const [loc, want] of [['en', 'Load from Requirements'], ['zh-TW', '帶入檢驗要求']]) {
      await evaluate(`localStorage.setItem('mes_locale', ${JSON.stringify(loc)}); 'ok'`)
      await navigate('about:blank')
      await navigate(`${APP}/#/panelx/list/QC_INSP_REC`)
      const txt = await waitForY(`(() => {
        const b = document.querySelector('.qr-carry-btn')
        return b ? b.innerText.replace(/\\s+/g, ' ').trim() : ''
      })()`, 25000)
      ok(`⑧ ${loc}:「带入检验要求」显示为 ${want}`, String(txt).includes(want), String(txt))
    }
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    edge.kill()
    await sleep(500)
  }
  console.log(fails ? `\n✖ 失败 ${fails} 项` : '\n✔ 全部通过')
}
main().catch((e) => { console.error('探针异常:', e); process.exitCode = 1 })
