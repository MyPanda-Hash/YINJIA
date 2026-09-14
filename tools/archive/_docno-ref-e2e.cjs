// 数据记录表「文档编号」参照立项申请 E2E(诊断/验证用)
// 用法(在 tools 目录执行):node _docno-ref-e2e.cjs [panel=RD_ANTIBACT] [docNo=AB-2026-09-0001] [base=http://localhost:5173]
// 断言:①纸张表头「文档编号」渲染为参照控件 ②弹窗列出已归档立项申请 ③选中写回
//      ④保存后持久化 ⑤本单单据编号未被参照覆盖 ⑥密级仍随参照带回
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')

const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.MES_BASE || process.argv[4] || 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PANEL = process.argv[2] || 'RD_ANTIBACT'
const DOC_NO = process.argv[3] || 'AB-2026-09-0001'
const ROW_IDX = Number(process.argv[5] || 0)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg) }

async function main() {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-docno-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1500,1200',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    const errs = []
    const netCalls = []
    ws.on('message', (d) => {
      let m
      try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') {
        const x = m.params.exceptionDetails || {}
        errs.push(((x.exception && x.exception.description) || x.text || '').slice(0, 300))
      }
      if (m.method === 'Network.requestWillBeSent' && /\/px\/callButton/.test(m.params.request.url)) {
        netCalls.push({ id: m.params.requestId, req: (m.params.request.postData || '').slice(0, 1200) })
      }
      if (m.method === 'Network.responseReceived' && /\/px\/callButton/.test(m.params.response.url)) {
        const hit = netCalls.find((c) => c.id === m.params.requestId)
        if (hit) hit.status = m.params.response.status
      }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + JSON.stringify(r.result.exceptionDetails.text) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3000); return } }
    }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/${PANEL}?docNo=${DOC_NO}`)

    // ① 表头文档编号是否为参照控件
    const cell = await ev(`(function(){
      var td=document.querySelector('.rs-docno');
      return td? JSON.stringify({ html: td.innerHTML.slice(0,120), hasCtl: !!td.querySelector('.rs-ref-ctl'), text: (td.innerText||'').trim() }) : 'NO-TD';
    })()`)
    console.log('表头格:', cell)
    ok(typeof cell === 'string' && cell.includes('"hasCtl":true'), '① 文档编号渲染为参照控件')

    // ② 点开参照弹窗
    await ev(`(function(){ var c=document.querySelector('.rs-docno .rs-ref-ctl'); if(c) c.click(); return !!c })()`)
    await sleep(2000)
    const dlg = await ev(`(function(){
      var d=document.querySelector('.el-dialog');
      if(!d) return 'NO-DIALOG';
      var heads=[].slice.call(d.querySelectorAll('.el-table__header th')).map(function(t){return (t.innerText||'').replace(/\\s+/g,' ').trim()}).filter(Boolean);
      var rows=[].slice.call(d.querySelectorAll('.el-table__row')).map(function(r){return (r.innerText||'').replace(/\\s+/g,' ').trim()});
      return JSON.stringify({ title:(d.querySelector('.el-dialog__title')||{}).innerText, tip:(d.querySelector('.rpd-tip')||{}).innerText, heads:heads, rowCount:rows.length, rows:rows.slice(0,4) });
    })()`)
    console.log('参照弹窗:', dlg)
    ok(typeof dlg === 'string' && !dlg.includes('NO-DIALOG') && /YJ-XS00/.test(dlg), '② 弹窗列出已归档立项申请(右上角编号 YJ-XS00*)')

    // ③ 勾选第 N 行(默认第 1 行)-> 确定导入
    const picked = await ev(`(function(){
      var d=document.querySelector('.el-dialog'); if(!d) return 'NO-DIALOG';
      var rows=[].slice.call(d.querySelectorAll('.el-table__row'));
      var row=rows[${ROW_IDX}]; if(!row) return 'NO-ROW('+rows.length+')';
      var no=(row.innerText||'').replace(/\\s+/g,' ').trim().split(' ')[0];
      var cb=row.querySelector('.el-checkbox'); if(cb) cb.click();
      return no;
    })()`)
    console.log('选中行首列:', picked)
    // 参照写入值 = 立项申请纸张右上角编号(RD_APPROVAL.文档编号):按 文档编号/单据编号 任一命中定位源单
    const refList = await (await fetch(`${API}/px/queryFormDataList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ panelCode: 'RD_APPROVAL', condition: {}, pageNo: 1, pageSize: 50 }),
    })).json()
    const refRow = (refList?.data?.list || []).find((r) => String(r['文档编号']) === String(picked) || String(r['单据编号']) === String(picked)) || {}
    const expected = String(refRow['文档编号'] || picked)
    console.log('源立项申请:', refRow['单据编号'], '| 右上角编号:', expected, '| 密级:', refRow['密级'])
    await sleep(600)
    await ev(`(function(){
      var d=document.querySelector('.el-dialog'); if(!d) return false;
      var btns=[].slice.call(d.querySelectorAll('.el-dialog__footer button'));
      var b=btns.find(function(x){return /确定导入/.test(x.innerText)});
      if(b && !b.disabled){ b.click(); return true } return false;
    })()`)
    await sleep(1500)
    const after = await ev(`(function(){ var td=document.querySelector('.rs-docno'); return td? (td.innerText||'').trim() : 'NO-TD' })()`)
    console.log('回填后表头格:', after)
    ok(String(after).includes(expected), '③ 立项申请右上角编号回填到数据记录表右上角')

    // ④ 保存 + 重新加载校验持久化
    const saved = await ev(`(function(){
      var mains=[].slice.call(document.querySelectorAll('.tb-main, .as-side-btn'));
      var info=mains.map(function(x){return (x.innerText||'').trim()+(x.classList.contains('disabled')?'[disabled]':'')+(x.offsetParent===null?'[hidden]':'')});
      var b=mains.find(function(x){return /^保存/.test((x.innerText||'').trim()) && x.offsetParent!==null});
      if(b){ b.click(); return 'clicked:'+(b.innerText||'').trim()+' cls='+b.className }
      return 'NO-BTN ' + JSON.stringify(info);
    })()`)
    console.log('点击保存:', saved)
    await sleep(1500)
    const toasts = await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.el-message, .el-message__content, .el-notification__content')).map(function(x){return (x.innerText||'').replace(/\\s+/g,' ').trim()}).filter(Boolean))`)
    console.log('保存提示:', toasts)
    await sleep(2500)
    console.log('callButton 请求:', JSON.stringify(netCalls))
    for (const c of netCalls) {
      const body = await send('Network.getResponseBody', { requestId: c.id })
      const txt = body.result && body.result.body ? body.result.body.slice(0, 400) : ''
      console.log('callButton 响应:', c.status, txt)
    }
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/${PANEL}?docNo=${DOC_NO}`)
    const reloaded = await ev(`(function(){ var td=document.querySelector('.rs-docno'); return td? (td.innerText||'').trim() : 'NO-TD' })()`)
    const api = await (await fetch(`${API}/px/getFormDescriptor?panelCode=${PANEL}&code=${DOC_NO}`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    const head = (api && api.data && (api.data.data || api.data)) || {}
    console.log('重新加载表头格:', reloaded, '| API 文档编号:', head['文档编号'], '| API 单据编号:', head['单据编号'], '| 密级:', head['密级'], '(立项申请密级:', refRow['密级'], ')')
    ok(String(head['文档编号'] || '') === expected, '④ 文档编号已持久化到后端')
    ok(String(head['单据编号'] || '') === DOC_NO, '⑤ 本单单据编号未被参照覆盖')
    ok(String(head['密级'] || '') === String(refRow['密级'] || ''), '⑥ 密级仍随参照带回')

    if (errs.length) { console.log('--- 页面错误 ---'); errs.slice(0, 5).forEach((e) => console.log(e)) }
    console.log(fails.length ? `\n结果: ${fails.length} 项失败` : '\n结果: 全部通过')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
