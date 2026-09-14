// 项目实施计划右上角编号参照立项申请 验证(诊断用)
// 用法(在 tools 目录执行):node _plan-ref-check.cjs [base=http://localhost:5173]
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const PORT = 9375
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:5173'
const ROW_IDX = Number(process.argv[3] || 0)
const API = 'http://localhost:8090/api'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg) }

async function main() {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const call = async (panelCode, buttonName, formData) => (await (await fetch(`${API}/px/callButton`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
  })).json())
  const created = await call('RD_PLAN', '保存', { 项目名称: '右上角编号引用验证' })
  const docNo = created?.data?.['编号']
  console.log('草稿:', docNo, JSON.stringify(created?.data || created))
  if (!docNo) throw new Error('草稿创建失败')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-plan-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1200',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    const netCalls = []
    ws.on('message', (d) => {
      let m
      try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Network.requestWillBeSent' && /\/px\/callButton/.test(m.params.request.url)) {
        netCalls.push({ id: m.params.requestId, post: (m.params.request.postData || '').slice(0, 600) })
      }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3000); return } } }
    const toasts = async () => JSON.parse(await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.el-message, .el-message__content')).map(function(x){return (x.innerText||'').replace(/\\s+/g,' ').trim()}).filter(Boolean))`) || '[]')
    const clickSave = () => ev(`(function(){
      var mains=[].slice.call(document.querySelectorAll('.tb-main, .as-side-btn'));
      var b=mains.find(function(x){return /^保存/.test((x.innerText||'').trim()) && x.offsetParent!==null});
      if(b){ b.click(); return true } return false;
    })()`)

    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_PLAN?docNo=${docNo}`)

    // ① 右上角是否为参照控件
    const cell = await ev(`(function(){
      var d=document.querySelector('.as-docno');
      return d? JSON.stringify({ hasCtl: !!d.querySelector('.as-ref-ctl'), text:(d.innerText||'').trim() }) : 'NO-TD';
    })()`)
    console.log('右上角格:', cell)
    ok(typeof cell === 'string' && cell.includes('"hasCtl":true'), '① 项目实施计划右上角渲染参照控件')

    // ② 空编号保存被拦
    netCalls.length = 0
    await clickSave()
    await sleep(1600)
    const t1 = await toasts()
    console.log('空编号保存提示:', t1, '| callButton 请求数:', netCalls.length)
    ok(/文档编号不能为空/.test(String(t1)), '② 空编号保存被拦下')
    ok(netCalls.length === 0, '② 未发出保存请求')

    // ③ 点开参照:只列已归档立项申请
    await ev(`(function(){ var c=document.querySelector('.as-docno .as-ref-ctl'); if(c) c.click(); return !!c })()`)
    await sleep(2000)
    const dlg = await ev(`(function(){
      var d=document.querySelector('.el-dialog'); if(!d) return 'NO-DIALOG';
      var rows=[].slice.call(d.querySelectorAll('.el-table__row')).map(function(r){return (r.innerText||'').replace(/\\s+/g,' ').trim()});
      return JSON.stringify({ tip:(d.querySelector('.rpd-tip')||{}).innerText, rowCount:rows.length, rows:rows.slice(0,6) });
    })()`)
    console.log('参照弹窗:', dlg)
    ok(typeof dlg === 'string' && /YJ-XS00/.test(dlg), '③ 弹窗列出已归档立项申请(右上角编号)')
    ok(typeof dlg === 'string' && !/草稿/.test(dlg), '③ 弹窗不含草稿立项申请')

    // ④ 选第一行 -> 确定
    const picked = await ev(`(function(){
      var d=document.querySelector('.el-dialog'); if(!d) return 'NO-DIALOG';
      var rows=[].slice.call(d.querySelectorAll('.el-table__row'));
      var row=rows[${ROW_IDX}]; if(!row) return 'NO-ROW('+rows.length+')';
      var v=(row.innerText||'').replace(/\\s+/g,' ').trim().split(' ')[0];
      var cb=row.querySelector('.el-checkbox'); if(cb) cb.click();
      return v;
    })()`)
    console.log('选中行首列:', picked)
    const refList = await (await fetch(`${API}/px/queryFormDataList`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ panelCode: 'RD_APPROVAL', condition: {}, pageNo: 1, pageSize: 50 }),
    })).json()
    const refRow = (refList?.data?.list || []).find((r) => String(r['文档编号']) === String(picked) || String(r['单据编号']) === String(picked)) || {}
    const expected = String(refRow['文档编号'] || picked)
    console.log('源立项申请:', refRow['单据编号'], '| 右上角编号:', expected, '| 密级:', refRow['密级'])
    await sleep(500)
    await ev(`(function(){
      var d=document.querySelector('.el-dialog'); if(!d) return false;
      var b=[].slice.call(d.querySelectorAll('.el-dialog__footer button')).find(function(x){return /确定导入/.test(x.innerText)});
      if(b && !b.disabled){ b.click(); return true } return false;
    })()`)
    await sleep(1500)
    const after = await ev(`(function(){ var d=document.querySelector('.as-docno'); return d? (d.innerText||'').trim() : 'NO-TD' })()`)
    console.log('回填后右上角:', after)
    ok(String(after).includes(expected), '④ 立项申请右上角编号回填到项目实施计划右上角')

    // ⑤ 保存并校验持久化
    netCalls.length = 0
    await clickSave()
    await sleep(4000)
    console.log('保存提示:', await toasts(), '| callButton:', JSON.stringify(netCalls.map((c) => c.post).slice(0, 1)))
    for (const c of netCalls) {
      const body = await send('Network.getResponseBody', { requestId: c.id })
      console.log('  响应:', body.result && body.result.body ? body.result.body.slice(0, 200) : '')
    }
    const api = await (await fetch(`${API}/px/getFormDescriptor?panelCode=RD_PLAN&code=${docNo}`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    const head = (api && api.data && (api.data.data || api.data)) || {}
    console.log('API 文档编号:', head['文档编号'], '| 单据编号:', head['单据编号'], '| 密级:', head['密级'])
    ok(String(head['文档编号'] || '') === expected, '⑤ 文档编号已持久化')
    ok(String(head['单据编号'] || '') === docNo, '⑤ 本单单据编号未被参照覆盖')
    ok(String(head['密级'] || '') === String(refRow['密级'] || ''), '⑤ 密级随参照带回')

    // 清理:作废测试单
    const del = await call('RD_PLAN', '删除', { 编号: docNo, 单据编号: docNo })
    console.log('清理:', JSON.stringify(del?.data || del))

    console.log(fails.length ? `\n结果: ${fails.length} 项失败` : '\n结果: 全部通过')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
