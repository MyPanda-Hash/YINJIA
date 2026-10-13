/**
 * _probe-dev-pending.cjs —— 「待开发单据」入口活体验证(2026-10-13)
 *
 * 用户要的交互:4 类下游面板(规格书/成型工艺清单/组装工艺清单/出货检验计划表)侧边一个
 * 「待开发单据」按钮,**只有被分发给该文件的人**看得到;红点 = 未开发张数(0 不显示);
 * 点开列出对应的产品信息表编号与状态。
 *
 * 拿它验四件事(含一条对照,证明"不是所有人都看得到"):
 *   ① cp(规格书责任人)在规格书单据页 → 按钮存在
 *   ② 红点数字 = 后端 pendingCount(=3,已接口实测值)
 *   ③ 点击弹窗 → 列出 3 条,且含 CSCS 对应的产品信息表编号 PI-2026-10-0018
 *   ④ 对照:admin 打开同一张单 → **按钮不存在**(管理员不是该文件负责人)
 *
 * 只读;账套 YJ_TEST。
 * 用法:node tools/archive/_probe-dev-pending.cjs
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const PAGE = process.env.YINJIA_PAGE || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const DOC = process.argv[2] || 'SD-2026-10-0001'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9782
const SHOTS = path.join(__dirname, '_shots')

let PASS = 0, FAIL = 0
const check = (id, expect, ok, actual) => {
  if (ok) PASS++; else FAIL++
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${id}\n        期望: ${expect}\n        实际: ${actual}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(u) {
  const r = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: u, password: '123456', factory: FACTORY }),
  })).json()
  if (r?.code !== 200) throw new Error(`登录失败 ${u}: ` + JSON.stringify(r).slice(0, 120))
  return r.data
}

async function main() {
  console.log(`\n=== 「待开发单据」入口活体验证(页 ${PAGE} / 单 ${DOC}) ===`)
  const cp = await login('cp')
  const ad = await login('admin')
  console.log(`  cp=${cp.user.realName}  admin=${ad.user.realName}`)

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pending-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1300', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3600); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `pending-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1300, deviceScaleFactor: 1, mobile: false })

    // 按钮探测:在 .as-side-btn 体系里找文本含「待开发单据」的可见元素,并读其红点
    const probeBtn = `(function(){
      var els = [].slice.call(document.querySelectorAll('.as-side-btn, .as-side-btn *'));
      var btn = null;
      for (var i=0;i<els.length;i++){ var t=(els[i].textContent||'').trim();
        if (t.indexOf('待开发单据')>=0){ btn = els[i]; break } }
      if (!btn) return JSON.stringify({ found:false });
      var badge = btn.querySelector ? btn.querySelector('.pending-docs-badge') : null;
      if (!badge) { var w = btn.closest('.as-side-btn'); badge = w ? w.querySelector('.pending-docs-badge') : null }
      return JSON.stringify({ found:true, text:(btn.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40),
        badge: badge ? (badge.textContent||'').trim() : '' });
    })()`

    const openAs = async (user) => {
      await nav(`${PAGE}/#/login`)
      await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(user.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user.user))}); 'ok'`)
      await nav('about:blank')
      await nav(`${PAGE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(DOC)}`)
      await sleep(1800)
    }

    // ① ② cp:按钮 + 红点
    console.log('\n──────── ① cp(规格书责任人) ────────')
    await openAs(cp)
    const b1 = await ev(probeBtn)
    console.log(`  按钮 = ${b1}`)
    const B1 = JSON.parse(b1)
    check('1-button', '规格书单据页出现「待开发单据」按钮', B1.found, b1)
    check('2-badge', '红点数字 = 3(后端 pendingCount 实测值)', B1.badge === '3', `红点=「${B1.badge}」`)
    const f1 = await shot('cp-button')

    // ③ 点开弹窗
    console.log('\n──────── ③ 弹窗内容 ────────')
    await ev(`(function(){
      var els = [].slice.call(document.querySelectorAll('.as-side-btn'));
      for (var i=0;i<els.length;i++){ if ((els[i].textContent||'').indexOf('待开发单据')>=0){ els[i].click(); return 'CLICKED' } }
      return 'NOT_FOUND';
    })()`)
    await sleep(2200)
    const dlg = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0});
      var d=ds[ds.length-1]; if(!d) return JSON.stringify({open:false});
      var rows=[].slice.call(d.querySelectorAll('tbody tr')).filter(function(tr){return (tr.textContent||'').trim()});
      return JSON.stringify({ open:true, title:(d.querySelector('.el-dialog__title')||{}).textContent||'',
        rowCount: rows.length, first: rows.length? (rows[0].textContent||'').replace(/\\s+/g,' ').trim().slice(0,60):'',
        hasPI: (d.textContent||'').indexOf('PI-2026-10-0018')>=0 });
    })()`)
    console.log(`  弹窗 = ${dlg}`)
    const D = JSON.parse(dlg)
    check('3-dialog', '弹窗打开且标题含「待开发单据」', D.open && String(D.title).indexOf('待开发单据') >= 0, JSON.stringify(D).slice(0, 160))
    check('4-rows', '列出 3 条(后端实测 3 条未开发)', D.rowCount === 3, `行数=${D.rowCount}`)
    check('5-pi-no', '含产品信息表编号 PI-2026-10-0018(CSCS 那张)', !!D.hasPI, `hasPI=${D.hasPI}`)
    const f2 = await shot('cp-dialog')

    // ④ 对照:admin 看不到
    console.log('\n──────── ④ 对照:admin(非该文件负责人) ────────')
    await openAs(ad)
    const b2 = await ev(probeBtn)
    console.log(`  按钮 = ${b2}`)
    const B2 = JSON.parse(b2)
    check('6-admin-hidden', 'admin 打开同一张单 → 按钮不渲染("只有被分发的人能看到")', !B2.found, b2)
    const f3 = await shot('admin-no-button')

    console.log(`\n  截图:${f1}\n        ${f2}\n        ${f3}`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
  console.log(`\n════ 汇总:格子数=${PASS + FAIL} PASS=${PASS} FAIL=${FAIL} ════`)
  process.exit(FAIL ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
