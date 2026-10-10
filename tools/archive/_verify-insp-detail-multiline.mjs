/*
 * _verify-insp-detail-multiline.mjs — 工序检验单三面板「明细文本列多行显示」界面实测(2026-10-15)
 *
 * 【用户口径】「还需要实现让当前明细行文字过长时可以多行显示」
 *   范围(用户选定):**只改表单明细里的文本列**,面板**只限工序检验单三个面板**
 *   (QC_MOLD_INSP 成型 / QC_CUT_INSP 切炭 / QC_ASM_INSP 组装成品)。
 *
 * 【验什么】
 *   ① 三面板的明细**文本列**渲染成多行文本控件(`.detail-multiline` 包裹的 <textarea>,
 *      此前是单行 el-input);字段类型取自 `/px/getFormDescriptor` 的 detail.tabs[].fields,
 *      逐列裁决「文本列→多行框 / 非文本列(参照·下拉框·标准库·是否·图片·小数·整数·日期)→不是多行框」;
 *   ② 塞进超长文字后:控件高度从单行(~32px)增长到多行,且**无横向溢出**
 *      —— 即"文字过长时多行显示"成立(同一测法在单行 input 上会横向滚动);
 *   ③ **阴性对照面板**(QC_INSP 来料检验单)不受影响 —— 改动限定三面板,不是全局把明细都换掉。
 *
 * 🔴 2026-10-10 晚更新:该功能**已被用户要求「先撤回」** —— 由
 *   `1697e409 Revert "chore: 前端静态产物同步(工序检验单明细多行显示)"` +
 *   `2911f6ff Revert "feat: 工序检验单三面板明细文本列改多行显示"` 两笔反向提交撤回,
 *   源码与打包产物同步回退(撤回后 8090 实测 `.detail-multiline` = 0 个,
 *   三面板明细文本列回到单行 `<input>`)。
 *   所以:**在撤回后的版本上跑本探针会 FAIL(② 段直接取不到控件,合计 10 项)**,这是预期结果。
 *   本文件保留作留痕与「将来若重新捡回该功能,重跑即验收」的现成用例。
 *
 * ⚠ 易错点(第一次跑就是栽在这):`class="detail-multiline"` 加在 `<el-input>` 上,
 *   Element Plus 把它落在**包裹 div**(`.el-textarea.detail-multiline`)而不是内部 `<textarea>`,
 *   所以选择器必须是 `.detail-multiline textarea`,不是 `textarea.detail-multiline`。
 *
 * 只读探针:表单里改的是浏览器内 v-model,不点保存,不落库。
 * 用法: node tools/archive/_verify-insp-detail-multiline.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9477
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

/** 与 PanelxForm.vue 的 DETAIL_NON_TEXT_TYPES 同口径:这些类型不该套多行文本框 */
const NON_TEXT = ['参照', '下拉框', '标准库', '是否', '图片', '小数', '整数', '日期']

/** 三面板各取一张有明细的现役单据(生产账套实测取到,2026-10-15) */
const POSITIVE = [
  ['QC_MOLD_INSP', 'CX-2026-10-0022', '成型检验单'],
  ['QC_CUT_INSP', 'QT-2026-10-0010', '切炭检验单'],
  ['QC_ASM_INSP', 'ZJ-2026-10-0008', '组装成品检验单'],
]
/** 阴性对照:不在白名单、同样有明细列的检验单 */
const NEGATIVE = ['QC_INSP', 'IJ-2026-09-0016', '来料检验单']

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const token = login.data.token

/** 从表单描述符里取「明细字段标签 → dataType」(字段标签 = 列表列名 = 元数据 dataName) */
const detailTypes = async (panel, docNo) => {
  const r = await fetch(`${BASE}/api/px/getFormDescriptor?panelCode=${encodeURIComponent(panel)}&code=${encodeURIComponent(docNo)}`,
    { headers: { Authorization: 'Bearer ' + token } }).then((x) => x.json())
  const tabs = r?.data?.detail?.tabs || []
  const map = {}
  for (const t of tabs) for (const f of (t.fields || [])) map[f.dataName] = f.dataType
  return map
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-insp-ml-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1680,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })

let tab = null
for (let i = 0; i < 40 && !tab; i++) { await sleep(1000); try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ } }
if (!tab) { edge.kill(); throw new Error('Edge CDP 未就绪') }

try {
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false })

  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2000)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)

  /** 打开面板表单(编辑态):命中明细表就返回 */
  const openForm = async (panel, docNo) => {
    await send('Page.navigate', {
      url: `${BASE}/?_v=${Date.now()}#/panelx/form/${panel}?code=${encodeURIComponent(docNo)}&operationName=${encodeURIComponent('修改')}`,
    })
    for (let i = 0; i < 90; i++) {
      await sleep(400)
      if (await ev(`!!document.querySelector('.el-table__body-wrapper tbody tr')`)) break
    }
    await sleep(1800)
    await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click();return 'skip'} const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
    await sleep(500)
  }

  /** 明细表结构:表头标签 + 第一行每格控件种类 */
  const structure = () => ev(`(() => {
    const clean = (s) => (s||'').replace(/[\\n\\r\\t]/g,'').trim()
    const tbl = [...document.querySelectorAll('.el-table')].find(t => t.querySelector('.detail-multiline'))
      || [...document.querySelectorAll('.el-table')].find(t => t.querySelector('.el-table__header-wrapper th'))
    if (!tbl) return null
    const heads = [...tbl.querySelectorAll('.el-table__header-wrapper thead th')].map(th => clean(th.innerText).split(' ')[0])
    const first = tbl.querySelector('.el-table__body-wrapper tbody tr')
    const kc = (td) => {
      if (!td) return 'gone'
      const ta = td.querySelector('textarea')
      if (ta) return ta.closest('.detail-multiline') ? 'textarea.ml' : 'textarea!ml'
      if (td.querySelector('input')) return 'input'
      if (td.querySelector('.el-select')) return 'select'
      if (td.querySelector('.ref-cell')) return 'ref'
      if (td.querySelector('.el-switch')) return 'switch'
      return 'text'
    }
    return { heads, cells: first ? [...first.querySelectorAll('td')].map(kc) : [] }
  })()`)

  // ── ① 三面板:明细文本列 = 多行框,非文本列不被误伤 ─────────────────
  for (const [panel, docNo, label] of POSITIVE) {
    console.log(`\n── ① ${label}(${panel}) 单号 ${docNo} ──`)
    const types = await detailTypes(panel, docNo)
    console.log(`    元数据明细列(标签→类型) = ${JSON.stringify(types)}`)
    await openForm(panel, docNo)
    const st = await structure()
    if (!st) { ok(`${panel} 表单明细表已渲染`, false, '未找到明细表'); continue }
    console.log(`    表头 = ${JSON.stringify(st.heads)}`)

    const n = await ev(`document.querySelectorAll('.detail-multiline textarea').length`)
    ok(`${panel} 明细存在多行文本控件(.detail-multiline textarea)`, Number(n) > 0, `n=${n}`)

    // 逐列裁决:文本列必须 textarea.ml;非文本列必须不是 textarea
    const wrong = []
    for (let i = 0; i < st.heads.length; i++) {
      const lab = st.heads[i]
      const dt = types[lab]
      const cell = st.cells[i]
      if (dt == null) continue // 序号/操作/派生列不在 detail.fields 里,跳过
      const isText = !NON_TEXT.includes(String(dt))
      if (isText && cell !== 'textarea.ml') wrong.push(`${lab}(${dt})→${cell}`)
      if (!isText && String(cell).startsWith('textarea')) wrong.push(`${lab}(${dt})→${cell} 不该是多行框`)
    }
    ok(`${panel} 逐列裁决:文本列=多行框、非文本列=原控件`, wrong.length === 0, wrong.join(' | '))
    const mlCols = st.heads.filter((_, i) => st.cells[i] === 'textarea.ml')
    console.log(`    多行列 = ${JSON.stringify(mlCols)}`)
    ok(`${panel} 覆盖全部文本列(不只一列)`, mlCols.length >= 2, `${mlCols.length} 列`)
  }

  // ── ② 长文字真的多行显示:高度增长 + 无横向溢出 ─────────────────────
  console.log('\n── ② 长文字多行显示实测(成型检验单) ──')
  await openForm(POSITIVE[0][0], POSITIVE[0][1])
  const wrap = await ev(`(async () => {
    const ta = document.querySelector('.detail-multiline textarea')
    if (!ta) return { err: 'no-textarea' }
    const h0 = ta.offsetHeight
    const disabled = !!ta.disabled || !!ta.readOnly
    const long = '表面无缩孔、无飞边、无缺料,尺寸复测全部落在图纸公差带内,抽检 30 模次结论合格,允许转序;备注:本批为试模尾批,需在下一批加严抽检。'
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, long)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 800))
    const after = document.querySelector('.detail-multiline textarea')
    return {
      tag: after.tagName, cls: after.closest('.detail-multiline') ? 'detail-multiline' : '(无)',
      disabled, h0, h1: after.offsetHeight,
      clientW: after.clientWidth, scrollW: after.scrollWidth,
      lineH: parseFloat(getComputedStyle(after).lineHeight) || 0,
      wrapCss: getComputedStyle(after).whiteSpace,
      textLen: long.length, valueLen: (after.value || '').length,
    }
  })()`)
  console.log('    ' + JSON.stringify(wrap))
  if (wrap?.err) {
    ok('取到多行文本控件', false, wrap.err)
  } else {
    ok('控件确为 <textarea>(而非单行 input)', wrap.tag === 'TEXTAREA', String(wrap.tag))
    ok('控件带 detail-multiline 包裹(改动已生效)', wrap.cls === 'detail-multiline', wrap.cls)
    ok('长文字已进入控件(model 更新成功)', wrap.valueLen === wrap.textLen, `valueLen=${wrap.valueLen}/${wrap.textLen}`)
    ok('高度由单行增长为多行(autosize 生效)', wrap.h1 > wrap.h0 + 8, `h0=${wrap.h0}px → h1=${wrap.h1}px(行高 ${wrap.lineH}px)`)
    ok('渲染行数 ≥ 3 行(文字确实折行)', wrap.h1 >= wrap.lineH * 3 - 2, `h1=${wrap.h1}px / lineH=${wrap.lineH}px`)
    ok('无横向溢出(单行 input 会横向滚动)', wrap.scrollW <= wrap.clientW + 2, `scrollW=${wrap.scrollW} clientW=${wrap.clientW}`)
  }
  {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    if (s?.result?.data) {
      const p = path.join(HERE, '_shot-insp-detail-multiline.png')
      fs.writeFileSync(p, Buffer.from(s.result.data, 'base64'))
      console.log('    [截图] ' + p)
    }
  }

  // ── ③ 阴性对照:别的面板不受影响 ─────────────────────────────────
  {
    const [panel, docNo, label] = NEGATIVE
    console.log(`\n── ③ 阴性对照 ${label}(${panel}) 单号 ${docNo} ──`)
    await openForm(panel, docNo)
    const st = await structure()
    const n = await ev(`document.querySelectorAll('.detail-multiline textarea').length`)
    console.log(`    表头 = ${JSON.stringify(st?.heads)}`)
    console.log(`    首行控件 = ${JSON.stringify(st?.cells)}`)
    ok(`${panel} 不出现 detail-multiline(改动限定三面板)`, Number(n) === 0, `n=${n}`)
    ok(`${panel} 明细列仍是原控件(观感未变)`,
      !(st?.cells || []).some((c) => String(c).startsWith('textarea')), JSON.stringify(st?.cells))
  }

  ws.close()
} finally {
  edge.kill()
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
