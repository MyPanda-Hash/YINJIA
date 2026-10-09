/* _v-qc-insp-rec-material.cjs — 检验数据记录「物料名称/物料编码 关联商品、两个一并填入」浏览器实测
 *
 * 用户口径(2026-10-09):「检验数据记录的物料名称和物料编码要关联商品,并且要两个一并填入。」
 * 本探针逐条取证(等待式,抗 HMR 与「新增草稿替换窗口」抖动,与 _v-qc-insp-carry.cjs 同款骨架):
 *   ① 报告面板就绪(纸面 + 侧栏「新增」)
 *   ② 新增一张空报告
 *   ③ 抬头 物料名称 / 物料编码 两格都是**商品参照格**(拟态输入框 + 放大镜,不再是手填输入框);
 *      物料编码格右侧的「检验要求」链接仍在
 *   ④ 点物料编码格 → 弹出「商品 · 参照选择」;按编码查到该商品
 *   ⑤ 选中确定 → **两个字段一并填入**(物料编码=存货编码、物料名称=存货名称)
 *   ⑥ 反向:点物料名称格选另一个商品 → 两格一起换成新商品的值(不会只换一半)
 *   ⑦ 联动:选完物料编码后「带入检验要求」照旧自动带入(与既有功能不打架)
 *   ⑧ 多语言(AGENTS.md 强制):切 en 后空格占位/提示显示英文而非中文
 *
 * 用法:node tools/archive/_q-qc-insp-rec-material/_v-qc-insp-rec-material.cjs [前端地址]
 *      前端地址默认 http://localhost:5173(vite 热更);传 http://127.0.0.1:8090 即测**打包版**
 *      (jar 内 BOOT-INF/classes/static —— 用户实际在看的那个实例)
 * ⚠ 全程只「新增草稿 + 选商品」,**不点保存** ⇒ 不落任何库;跑完直接关页面即可。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9364
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://localhost:5173').replace(/\/$/, '')

/** 两个商品(库实测 bs_inv:编码/名称/规格) */
const P1 = { code: 'YJ-YCYX-006', name: '折叠棉' }   // 有来料检验要求(4 项)—— 用于 ⑦
const P2 = { code: 'YJ-KBL-021', name: '气泡袋' }
/** 空格的占位文案(中文/英文)—— 判定「没填」 */
const EMPTY_TEXT = ['点击选择', 'Click to pick']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) { fails++; process.exitCode = 1 }
}

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
    cell(label) {
      const th = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t => t.innerText.trim() === label)
      return th ? th.nextElementSibling : null
    },
    /** 抬头格取值:参照格(.qr-ref-text)优先 —— 物料两列改造后**没有输入框了** */
    val(label) {
      const td = window.__yj.cell(label)
      if (!td) return ''
      const t = td.querySelector('.qr-ref-text')
      if (t) { const s = t.innerText.trim(); return ${JSON.stringify(EMPTY_TEXT)}.includes(s) ? '' : s }
      const inp = td.querySelector('input')
      return inp ? inp.value : td.innerText.trim()
    },
    /** 该格是否是商品参照格 */
    isRef(label) {
      const td = window.__yj.cell(label)
      return !!(td && td.querySelector('.qr-ref-ctl'))
    },
    refTitle(label) { const td = window.__yj.cell(label); return td?.querySelector('.qr-ref-ctl')?.getAttribute('title') || '' },
    clickRef(label) {
      const td = window.__yj.cell(label)
      const c = td?.querySelector('.qr-ref-ctl')
      c?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!c
    },
    hasReqLink() { return !!(window.__yj.cell('物料编码')?.querySelector('.qr-lib-btn')) },
    /** 参照弹窗(RefPickDialog 根节点 .rpd 所在的那个 el-dialog) */
    dlg() {
      return [...document.querySelectorAll('.el-dialog')].find(d => d.querySelector('.rpd')) || null
    },
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
    rows() { return [...document.querySelectorAll('.qc-rec-sheet .qr-table tbody tr')].filter(r => r.querySelectorAll('td').length >= 4).length },
    msgs() { return [...document.querySelectorAll('.el-message')].map(e => e.innerText.replace(/\\s+/g, ' ').trim()) },
    clearMsgs() { document.querySelectorAll('.el-message').forEach(e => e.remove()); return 1 },
  };
`

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login?.data?.token
  if (!token) throw new Error('登录失败:' + JSON.stringify(login).slice(0, 200))

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-matref-'))
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
    const evalY = (exp) => raw(`(() => { ${HELPERS} return (${exp}) })()`)
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1000); return } } }
    const waitForY = async (exp, ms = 20000, step = 400) => {
      for (let i = 0; i < Math.ceil(ms / step); i++) {
        const v = await evalY(exp)
        if (v) return v
        await sleep(step)
      }
      return null
    }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate(`${APP}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)

    /** 打开面板并新增一张空报告(draftEditable=true) */
    async function newDraft() {
      let ready = null
      for (let attempt = 1; attempt <= 5 && !ready; attempt++) {
        await navigate('about:blank')
        await navigate(`${APP}/#/panelx/list/QC_INSP_REC`)
        await sleep(2500)
        await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
        ready = await raw(`(() => {
          const sheet = document.querySelector('.qc-rec-sheet')
          const side = [...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g, ''))
          return (sheet && side.includes('新增')) ? 'READY' : ''
        })()`)
        if (!ready) await sleep(2000)
      }
      if (ready !== 'READY') return ''
      await evaluate(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
      const fresh = `(() => {
        const sheet = document.querySelector('.qc-rec-sheet')
        if (!sheet) return ''
        return (window.__yj.val('文件编码') === 'YJ-QR-96' && window.__yj.rows() === 0) ? 'FRESH' : ''
      })()`
      const got = await waitForY(fresh, 25000)
      await sleep(1800)   // 新增后还会再取一次数(草稿对象被替换),等它稳下来
      return got && (await evalY(fresh)) ? 'FRESH' : ''
    }

    /** 在参照弹窗里按编码选一条商品(返回选中行文本) */
    async function pickProduct(code) {
      const opened = await waitForY(`window.__yj.dlg() ? 'DLG' : ''`, 15000)
      if (!opened) return { ok: false, why: '弹窗没开' }
      const title = await evalY(`window.__yj.dlgTitle()`)
      await evalY(`window.__yj.setKeyword(${JSON.stringify(code)})`)
      await evalY(`window.__yj.clickQuery()`)
      const listed = await waitForY(`(() => { const n = window.__yj.dlgTotal(); return (n > 0 && window.__yj.dlgRows() > 0) ? n : 0 })()`, 20000)
      if (!listed) return { ok: false, why: '按编码查不到商品', title }
      const picked = await evalY(`JSON.stringify(window.__yj.pickFirst())`)
      await sleep(400)
      const confirmed = await waitForY(`window.__yj.confirm() ? 'OK' : ''`, 8000)
      await sleep(800)
      return { ok: !!confirmed, title, listed, row: JSON.parse(picked || '{}').row }
    }

    // ── ① 面板就绪 + 新增空报告 ──
    const fresh = await newDraft()
    ok('① 检验报告面板就绪并切到一张空报告(表体 0 行)', fresh === 'FRESH', fresh)
    if (fresh !== 'FRESH') throw new Error('面板未就绪,终止')

    // ── ③ 两格都是商品参照格(不是手填输入框) ──
    ok('③ 物料名称格是商品参照格(拟态输入框,不是 input)', await evalY(`window.__yj.isRef('物料名称')`))
    ok('③ 物料编码格是商品参照格(拟态输入框,不是 input)', await evalY(`window.__yj.isRef('物料编码')`))
    ok('③ 两格都没有可手填的输入框', await evalY(`!window.__yj.cell('物料名称').querySelector('input') && !window.__yj.cell('物料编码').querySelector('input')`))
    ok('③ 物料编码格右侧「检验要求」链接仍在', await evalY(`window.__yj.hasReqLink()`))
    ok('③ 空格占位显示「点击选择」', (await evalY(`window.__yj.cell('物料名称').innerText.trim()`)) === '点击选择', await evalY(`JSON.stringify(window.__yj.cell('物料名称').innerText.trim())`))

    // ── ④⑤ 点物料编码格选商品 → 两个一并填入 ──
    await evalY(`window.__yj.clearMsgs()`)
    ok('④ 点物料编码格能打开参照', await evalY(`window.__yj.clickRef('物料编码')`))
    const r1 = await pickProduct(P1.code)
    ok(`④ 参照弹窗标题指向商品档案`, /商品/.test(String(r1.title)) && /参照选择/.test(String(r1.title)), String(r1.title))
    ok(`④ 按编码 ${P1.code} 查到该商品`, r1.ok && String(r1.row).includes(P1.code), String(r1.row))
    const after1 = await waitForY(`(() => { const c = window.__yj.val('物料编码'), n = window.__yj.val('物料名称'); return (c && n) ? JSON.stringify([c, n]) : '' })()`, 8000)
    const [c1, n1] = JSON.parse(after1 || '["",""]')
    ok(`⑤ 选一次商品 → 物料编码 = ${P1.code}`, c1 === P1.code, c1)
    ok(`⑤ 选一次商品 → 物料名称 = ${P1.name}(**一并填入**)`, n1 === P1.name, n1)

    // ── ⑦ 联动:物料编码变了 → 来料检验要求自动带入(既有功能不打架) ──
    const carried = await waitForY(`window.__yj.rows() > 0 ? window.__yj.rows() : 0`, 15000)
    ok('⑦ 选完物料编码后自动带入检验项(与既有「带入检验要求」联动)', !!carried, `表体 ${carried} 行`)

    // ── ⑥ 反向:点物料名称格选另一个商品 → 两格一起换 ──
    ok('⑥ 点物料名称格能打开参照', await evalY(`window.__yj.clickRef('物料名称')`))
    const r2 = await pickProduct(P2.code)
    ok(`⑥ 按编码 ${P2.code} 查到商品`, r2.ok && String(r2.row).includes(P2.code), String(r2.row))
    const after2 = await waitForY(`(() => { const c = window.__yj.val('物料编码'), n = window.__yj.val('物料名称'); return (c === ${JSON.stringify(P2.code)}) ? JSON.stringify([c, n]) : '' })()`, 8000)
    const [c2, n2] = JSON.parse(after2 || '["",""]')
    ok(`⑥ 换成 ${P2.code} 后 物料编码 一起改`, c2 === P2.code, c2)
    ok(`⑥ 换成 ${P2.name} 后 物料名称 一起改(不会只换一半)`, n2 === P2.name, n2)

    // ── ⑧ 多语言:切 en 后空格的占位/提示是英文 ──
    await evaluate(`localStorage.setItem('mes_locale','en'); 'ok'`)
    const en = await newDraft()
    if (en === 'FRESH') {
      const ph = await evalY(`window.__yj.cell('物料名称').innerText.trim()`)
      const ti = await evalY(`window.__yj.refTitle('物料名称')`)
      ok('⑧ en:空商品格占位显示英文 Click to pick', ph === 'Click to pick', String(ph))
      ok('⑧ en:悬停提示为英文 Click to pick', ti === 'Click to pick', String(ti))
    } else {
      ok('⑧ en:面板就绪(用于多语言取证)', false, en)
    }
    await evaluate(`localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    edge.kill()
    await sleep(500)
  }
  console.log(fails ? `\n✖ 失败 ${fails} 项` : '\n✔ 全部通过')
}
main().catch((e) => { console.error('探针异常:', e); process.exitCode = 1 })
