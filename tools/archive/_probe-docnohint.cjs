// 验收:立项申请(RD_APPROVAL)手填编号框 与 项目实施计划(RD_PLAN)参照编号格 都有背景提示词「文档编号：」
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9397
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }

async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ph-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } } }
    // 翻页直到出现目标选择器:当前单据可能是已归档的只读态,不渲染输入框
    const seekEditable = async (sel) => {
      for (let i = 0; i < 8; i++) {
        if (await ev('!!document.querySelector("' + sel + '")')) return true
        await ev('(function(){var b=document.querySelectorAll(".page-btn")[2]; if(b) b.click(); return "ok"})()')
        await sleep(2200)
      }
      return false
    }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')

    // ① 实施计划:参照形态(灰字提示)
    await nav(`${BASE}/#/panelx/list/RD_PLAN`)
    await sleep(1000)
    console.log('   RD_PLAN 找到可编辑编号格:', await seekEditable('.as-ref-ctl'))
    const plan = await ev(`(function(){
      var c=document.querySelector('.as-ref-ctl');
      var t=document.querySelector('.as-ref-text');
      return JSON.stringify({ hasCtl: !!c, text: t? String(t.innerText||'').trim():'', cls: t? String(t.className):'' })
    })()`)
    console.log('   RD_PLAN 编号格:', plan)
    const p = JSON.parse(plan)
    ok(p.hasCtl, '①RD_PLAN 右上角编号为参照形态')
    ok(p.cls.indexOf('is-empty') >= 0 ? p.text === '文档编号：' : (p.text.length > 0 && p.text !== '文档编号：'),
      `②RD_PLAN 空值显示背景提示词 / 有值显示原值(实际文本 "${p.text}" 类 "${p.cls}")`)

    // ② 立项申请:手填形态(placeholder)
    await nav(`${BASE}/#/panelx/list/RD_APPROVAL`)
    await sleep(1000)
    console.log('   RD_APPROVAL 找到可编辑编号框:', await seekEditable('.as-docno-input'))
    const appr = await ev(`(function(){
      var el=document.querySelector('.as-docno-input input') || document.querySelector('input.as-docno-input');
      if(!el) return 'NO-INPUT';
      return JSON.stringify({ placeholder: el.getAttribute('placeholder') || '', value: el.value || '' })
    })()`)
    console.log('   RD_APPROVAL 编号框:', appr)
    let a = null; try { a = JSON.parse(appr) } catch { a = null }
    ok(!!a, '③RD_APPROVAL 右上角是手填编号框')
    ok(!!a && a.placeholder.indexOf('文档编号：') >= 0, `④RD_APPROVAL 带背景提示词(实际 "${a ? a.placeholder : ''}")`)

    // ⑤ 切英文:中文下 tt('文档编号：') 命中的是原串本身,证明不了新词条进词典;英文才作数
    //    注意 store 只在切换动作/首屏初始化时 apply(),故写 localStorage 后必须真重载
    await ev(`localStorage.setItem('mes_locale','en'); 'ok'`)
    await ev(`location.reload(); 'reloading'`)
    await sleep(3200)
    console.log('   RD_APPROVAL(en) 找到可编辑编号框:', await seekEditable('.as-docno-input'))
    const apprEn = await ev(`(function(){
      var el=document.querySelector('.as-docno-input input') || document.querySelector('input.as-docno-input');
      if(!el) return 'NO-INPUT';
      return JSON.stringify({ placeholder: el.getAttribute('placeholder') || '' })
    })()`)
    console.log('   RD_APPROVAL 编号框(en):', apprEn)
    let ae = null; try { ae = JSON.parse(apprEn) } catch { ae = null }
    ok(!!ae && ae.placeholder === 'Document No.: ', `⑤英文下提示词走词典(实际 "${ae ? ae.placeholder : ''}")`)
    await ev(`localStorage.setItem('mes_locale','zh-CN'); 'ok'`)

    console.log(fails.length ? `\n结果: ${fails.length} 项失败` : '\n结果: 全部通过')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
