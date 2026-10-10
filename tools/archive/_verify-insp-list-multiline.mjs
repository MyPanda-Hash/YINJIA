/*
 * _verify-insp-list-multiline.mjs — 「多行文本」字段类型在**列表页内联网格**的界面实测(2026-10-15)
 *
 * 【为什么单独一个探针】用户反馈「我没看到修改」,根因是**看错了组件**:
 *   从菜单进面板落到的是 `PanelxList`(列表页,明细格是"点一下才挂编辑器"的懒激活网格),
 *   而当时只改了 `PanelxForm`(表单页)。两个组件各有一套控件分支,必须同时支持。
 *   证据:用户截图工具栏有「导出报表」——PanelxForm 里 0 处、PanelxList 里 5 处。
 *
 * 【验什么】(逐面板,直接打现役实例)
 *   ① 明细网格里点开 **长文本列**(处理方式)的格子 → 挂出来的编辑器是
 *      `.multi-text` 包裹的 <textarea>(不是单行 <input>);
 *   ② 塞超长文字 → 高度由单行(~32px)撑到多行、**无横向溢出**,且**看得出是输入框**
 *      (保留默认边框,不是无框纯文字格 —— 这是用户「没看到」的第二个原因);
 *   ③ **短列**(数量)点开后仍是单行 <input> ⇒ 证明按字段类型生效,不是把整格都换掉;
 *   ④ **阴性对照面板**(QC_INSP 来料检验单,未配该类型)点开后仍是单行 <input>。
 *
 * 只读:改的是浏览器里的行模型,**不点保存**,不落库。
 * 用法: node tools/archive/_verify-insp-list-multiline.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9478
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

/** [{账套, 面板, 单号, 说明}] —— YJ=正式账套;YJ_TEST=测试账套(用户截图所在账套) */
const SCENARIOS = [
  { factory: 'YJ', panel: 'QC_MOLD_INSP', docNo: 'CX-2026-10-0022', label: '成型检验单', capture: true },
  { factory: 'YJ_TEST', panel: 'QC_MOLD_INSP', docNo: 'CX-2026-10-0015', label: '成型检验单(测试账套,用户截图那张)', capture: true },
]
const NEGATIVE = { factory: 'YJ', panel: 'QC_INSP', docNo: 'IJ-2026-09-0016', label: '来料检验单' }

const loginAs = async (factory) => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  }).then((x) => x.json())
  if (!r.data?.token) throw new Error(`登录失败(${factory}): ${JSON.stringify(r).slice(0, 200)}`)
  return r.data
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-list-ml-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1845,1000', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })

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
  await send('Emulation.setDeviceMetricsOverride', { width: 1845, height: 1000, deviceScaleFactor: 1, mobile: false })

  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)

  /** 打开面板列表页并定位到指定单据;返回是否渲染出明细网格 */
  const openList = async (auth, panel, docNo) => {
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(auth.token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(auth.user))});
      localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
    await send('Page.navigate', {
      url: `${BASE}/?_v=${Date.now()}#/panelx/list/${panel}?docNo=${encodeURIComponent(docNo)}`,
    })
    for (let i = 0; i < 100; i++) {
      await sleep(400)
      if (await ev(`!!document.querySelector('.detail .el-table__body-wrapper tbody tr')`)) break
    }
    await sleep(1500)
    await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click();return 'skip'} const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
    await sleep(400)
  }

  /** 点开某列的格子(懒激活),返回该格挂出来的控件信息 */
  const probeCell = async (colLabel, longText) => {
    const clicked = await ev(`(() => {
      const clean = (s) => (s||'').replace(/[\\n\\r\\t]/g,'').replace(/[\u21c5\u25b2\u25bc]/g,'').trim()
      const wrap = [...document.querySelectorAll('.detail')].find(d => d.querySelector('.el-table__body-wrapper tbody tr'))
      if (!wrap) return 'no-detail'
      const tbl = wrap.querySelector('.el-table')
      if (!tbl) return 'no-table'
      const ths = [...tbl.querySelectorAll('.el-table__header-wrapper thead th')]
      const heads = ths.map(th => clean(th.innerText).split(' ')[0])
      const idx = heads.indexOf(${JSON.stringify(colLabel)})
      if (idx < 0) return 'no-col:' + JSON.stringify(heads)
      const tr = tbl.querySelector('.el-table__body-wrapper tbody tr')
      const td = tr.querySelectorAll('td')[idx]
      if (!td) return 'no-cell'
      const span = td.querySelector('.cell-lazy')
      if (span) { span.click(); return 'clicked' }
      return td.querySelector('textarea,input') ? 'already' : 'no-span'
    })()`)
    await sleep(600)
    const info = await ev(`(() => {
      const clean = (s) => (s||'').replace(/[\\n\\r\\t]/g,'').replace(/[\u21c5\u25b2\u25bc]/g,'').trim()
      const wrap = [...document.querySelectorAll('.detail')].find(d => d.querySelector('.el-table__body-wrapper tbody tr'))
      const tbl = wrap.querySelector('.el-table')
      const ths = [...tbl.querySelectorAll('.el-table__header-wrapper thead th')]
      const idx = ths.findIndex(th => clean(th.innerText).split(' ')[0] === ${JSON.stringify(colLabel)})
      const td = tbl.querySelector('.el-table__body-wrapper tbody tr').querySelectorAll('td')[idx]
      const ta = td.querySelector('textarea')
      const inp = td.querySelector('input')
      const ctl = ta || inp
      if (!ctl) return { err: 'no-control', html: (td.innerHTML||'').slice(0,120) }
      const cs = getComputedStyle(ctl)
      return {
        tag: ctl.tagName, ml: !!ta && !!ta.closest('.multi-text'),
        shadow: cs.boxShadow, h0: ctl.offsetHeight, lineH: parseFloat(cs.lineHeight) || 0,
      }
    })()`)
    if (info?.err || !longText) return { clicked, ...info }
    // 塞长文 → 看是否撑高折行
    const grown = await ev(`(async () => {
      const clean = (s) => (s||'').replace(/[\\n\\r\\t]/g,'').replace(/[\u21c5\u25b2\u25bc]/g,'').trim()
      const wrap = [...document.querySelectorAll('.detail')].find(d => d.querySelector('.el-table__body-wrapper tbody tr'))
      const tbl = wrap.querySelector('.el-table')
      const ths = [...tbl.querySelectorAll('.el-table__header-wrapper thead th')]
      const idx = ths.findIndex(th => clean(th.innerText).split(' ')[0] === ${JSON.stringify(colLabel)})
      const td = tbl.querySelector('.el-table__body-wrapper tbody tr').querySelectorAll('td')[idx]
      const ctl = td.querySelector('textarea') || td.querySelector('input')
      if (!ctl) return { err: 'no-control' }
      const proto = ctl.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(ctl, ${JSON.stringify(longText)})
      ctl.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 700))
      const c2 = td.querySelector('textarea') || td.querySelector('input')
      const cs = getComputedStyle(c2)
      return {
        h1: c2.offsetHeight, clientW: c2.clientWidth, scrollW: c2.scrollWidth,
        lineH: parseFloat(cs.lineHeight) || 0, shadow: cs.boxShadow,
        valueLen: (c2.value || '').length,
      }
    })()`)
    return { clicked, ...info, grown }
  }

  for (const sc of SCENARIOS) {
    console.log(`\n── ${sc.label}｜账套 ${sc.factory}｜${sc.panel} ${sc.docNo} ──`)
    const auth = await loginAs(sc.factory)
    await openList(auth, sc.panel, sc.docNo)
    const routed = await ev(`location.hash`)
    console.log(`    路由 = ${routed}`)
    ok('确实落在**列表页**(#/panelx/list/...)而非表单页', String(routed).includes('/panelx/list/'), String(routed))

    const long = '表面无缩孔、无飞边、无缺料,尺寸复测全部落在图纸公差带内,抽检 30 模次结论合格,允许转序;备注:本批为试模尾批,需在下一批加严抽检。'
    const ml = await probeCell('处理方式', long)
    console.log(`    [长文本列 处理方式] ${JSON.stringify(ml)}`)
    ok('长文本列点开后是 <textarea>', ml?.tag === 'TEXTAREA', JSON.stringify(ml))
    ok('且带 multi-text 包裹(字段类型在列表页同样生效)', ml?.ml === true, JSON.stringify(ml))
    ok('看得出是输入框(保留默认边框)', String(ml?.shadow) !== 'none' && !!ml?.shadow, `shadow=${ml?.shadow}`)
    ok('长文字已进入控件', (ml?.grown?.valueLen || 0) === long.length, `valueLen=${ml?.grown?.valueLen}/${long.length}`)
    ok('内容超长自动撑高为多行(≥3 行)', (ml?.grown?.h1 || 0) >= (ml?.grown?.lineH || 22) * 3 - 2,
      `h0=${ml?.h0}px → h1=${ml?.grown?.h1}px(行高 ${ml?.grown?.lineH}px)`)
    ok('无横向溢出', (ml?.grown?.scrollW || 0) <= (ml?.grown?.clientW || 0) + 2,
      `scrollW=${ml?.grown?.scrollW} clientW=${ml?.grown?.clientW}`)

    // 实拍:列表页里「处理方式」格撑着 6 行长文的样子(给用户看的证据)
    //  ⚠ 必须在**切到别的格之前**拍:活动格一换,这一格就退回 `.cell-lazy` 纯文本(带省略号)。
    if (sc.capture) {
      const s = await send('Page.captureScreenshot', { format: 'png' })
      if (s?.result?.data) {
        const p = path.join(HERE, `_shot-insp-list-multiline-${sc.factory}.png`)
        fs.writeFileSync(p, Buffer.from(s.result.data, 'base64'))
        console.log(`    [截图] ${p}`)
      }
    }

    // 短列(数量)必须还是单行 —— 别把整格都换掉
    const num = await probeCell('数量')
    console.log(`    [短列 数量] ${JSON.stringify(num)}`)
    ok('短列「数量」点开后仍是单行 <input>', num?.tag === 'INPUT', JSON.stringify(num))
  }

  // ── 阴性对照 ──
  //  ⚠ 不挑"点开某列"来判:来料检验单的明细行是**生单写入、不内联可编辑**(格子里连
  //    .cell-lazy 都没有),点不出控件来。改为直接扫明细区有没有多行框 —— 足够说明问题。
  console.log(`\n── 阴性对照 ${NEGATIVE.label}｜${NEGATIVE.panel} ${NEGATIVE.docNo} ──`)
  {
    const auth = await loginAs(NEGATIVE.factory)
    await openList(auth, NEGATIVE.panel, NEGATIVE.docNo)
    const neg = await ev(`(() => {
      const d = document.querySelector('.detail')
      return {
        multiText: document.querySelectorAll('.multi-text').length,
        ta: d ? d.querySelectorAll('textarea').length : -1,
        lazyCells: d ? d.querySelectorAll('.cell-lazy').length : -1,
      }
    })()`)
    console.log(`    ${JSON.stringify(neg)}`)
    ok('未配该类型的面板:整页没有 multi-text 多行框', neg?.multiText === 0, JSON.stringify(neg))
    ok('明细区里也没有 textarea(仍全是原控件)', neg?.ta === 0, JSON.stringify(neg))
  }

  {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    if (s?.result?.data) {
      const p = path.join(HERE, '_shot-insp-list-multiline.png')
      fs.writeFileSync(p, Buffer.from(s.result.data, 'base64'))
      console.log('\n    [截图] ' + p)
    }
  }

  ws.close()
} finally {
  edge.kill()
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
