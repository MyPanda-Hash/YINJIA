/* _v-tcin-ui.cjs — QC_TC_IN(来料品质·特采单)UI 核查
   登录 → 打开 #/panelx/list/QC_TC_IN → 点「新增流程」→ 读文书式版式行序 + console 报错。
   用 Node 24 自带全局 WebSocket(仓库内没有 ws 包,panels-ui-smoke.cjs 因此跑不起来)。
   用法:node tools/archive/_v-tcin-ui.cjs   (需前端 :5173、后端 :8090 在跑) */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9343
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PANEL = process.argv[2] || 'QC_TC_IN'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-tcin-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errors = []; const posts = []; const callIds = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Network.requestWillBeSent' && m.params.request.method !== 'GET') {
        posts.push(m.params.request.method + ' ' + m.params.request.url.replace('http://localhost:8090', '')
          + '  body=' + (m.params.request.postData || '(无)').slice(0, 700))
      }
      // 记下 callButton 的 requestId,稍后取响应体(判断保存是成功还是报错)
      if (m.method === 'Network.responseReceived' && m.params.response.url.includes('/callButton')) {
        callIds.push({ id: m.params.requestId, status: m.params.response.status })
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
        errors.push('console: ' + (m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200))
      if (m.method === 'Runtime.exceptionThrown')
        errors.push('exception: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 200))
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(700); return } } }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await navigate('about:blank')

    errors.length = 0
    await navigate(`http://localhost:5173/#/panelx/list/${PANEL}`)
    await sleep(3500)
    const listInfo = await evaluate(`(() => ({
      title: document.title,
      hasTable: !!document.querySelector('.el-table') || !!document.querySelector('.el-empty'),
      btns: [...document.querySelectorAll('button')].map(b => ({
        txt: (b.innerText || '').replace(/\\s+/g,'').trim(),
        cls: (b.className || '').replace(/el-button[^ ]*/g,'').trim().slice(0, 40),
        title: b.getAttribute('title') || '',
      })).slice(0, 30),
      toolbarText: [...document.querySelectorAll('.el-button, .panel-head, .pc-ops, .page-head')]
        .map(e => (e.innerText || '').replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0, 12),
    }))()`)
    console.log('=== 1. 列表页 ===')
    console.log('  title :', listInfo.title)
    console.log('  渲染  :', listInfo.hasTable ? 'OK' : 'NO-RENDER')
    console.log('  按钮  :')
    listInfo.btns.forEach(b => console.log(`     [${b.cls}] "${b.txt}" title=${b.title}`))
    console.log('  工具区:', JSON.stringify(listInfo.toolbarText))

    const clicked = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(b => b.innerText.replace(/\\s/g,'').includes('新增流程'));
      if (!b) return 'NO-BUTTON'; b.click(); return 'CLICKED';
    })()`)
    console.log('=== 2. 点「新增流程」:', clicked, '===')
    await sleep(4000)
    const sheet = await evaluate(`(() => {
      const s = document.querySelector('.approval-sheet')
      const t = el => el ? (el.innerText || '').replace(/\\s*\\n\\s*/g, ' ').trim() : null
      return {
        hash: location.hash,
        hasSheet: !!s,
        title: t(document.querySelector('.as-title')),
        docno: t(document.querySelector('.as-docno')),
        rowNames: s ? [...document.querySelectorAll('.as-name')].map(e => e.innerText.trim()) : [],
        text: s ? (s.innerText || '').replace(/\\n+/g, ' ⏎ ').slice(0, 2600) : '',
      }
    })()`)
    console.log('=== 3. 文书式版式 ===')
    console.log('  hash    :', sheet.hash)
    console.log('  文书渲染:', sheet.hasSheet ? 'OK' : 'NO-SHEET')
    console.log('  标题    :', sheet.title, ' 单据号:', sheet.docno)
    console.log('  行序    :', sheet.rowNames.join(' → '))
    console.log('  正文    :', sheet.text)
    const real = errors.filter(e => !e.includes('favicon') && !e.includes('WebSocket connection') && !e.includes('vite'))
    console.log('=== 4. console 报错 ===', real.length ? '' : '无')
    real.forEach(e => console.log('   ', e))

    // 动作入口:doc 面板的保存/提交/审核等不是 <button>,而是可点元素 —— 全量列出
    const ops = await evaluate(`(() => {
      const pick = el => (el.innerText || el.getAttribute('title') || '').replace(/\\s+/g,' ').trim()
      const cand = [...document.querySelectorAll('[class*=op], [class*=act], [class*=btn], [class*=sign], [class*=flow], [role=button], a')]
      return {
        ops: [...new Set(cand.map(e => pick(e) + '  «' + (e.className||'').toString().slice(0,50) + '»').filter(s => s.trim() && !s.startsWith('«')))].slice(0, 40),
        body: (document.body.innerText || '').replace(/\\n+/g,' | ').slice(-1200),
      }
    })()`)
    console.log('=== 5. 动作入口候选 ===')
    ops.ops.forEach(s => console.log('   ', s))
    console.log('=== 6. 整页尾部文本 ===')
    console.log('   ', ops.body)

    // 可选:实测一次「保存」(会真的起单并写入 s_allno 留痕)—— 仅在传 save 参数时执行
    if (process.argv[3] === 'save') {
      // 打开面板时是只读态(无输入框、保存 disabled)→ 先点「新增」进入可编辑新单
      const newClick = await evaluate(`(() => {
        const b = [...document.querySelectorAll('.as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增');
        if (!b) return 'NO-BUTTON';
        if ((b.className||'').includes('disabled')) return 'DISABLED';
        b.click(); return 'CLICKED';
      })()`)
      console.log('=== 7. 点「新增」:', newClick, '===')
      await sleep(2500)
      // 填字段:注意 .as-cell-input 是 Element Plus 的**外层 div**,真正要打的是内层
      // input/textarea(直接给外层 div 设 value 是空操作,之前踩过)
      const filled = await evaluate(`(() => {
        const setV = (el, v) => {
          const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value');
          d && d.set ? d.set.call(el, v) : (el.value = v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const inner = [...document.querySelectorAll('.as-cell-input, .as-fill-input')]
          .map(b => b.matches('input, textarea') ? b : b.querySelector('input, textarea')).filter(Boolean);
        const out = [];
        inner.slice(0, 1).forEach((el, i) => { setV(el, 'TEXT-ONLY-' + i); out.push('TEXT-ONLY-' + i); });  // 只填文本字段(数值列塞非数字会 8114 回滚)
        const ck = [...document.querySelectorAll('.el-checkbox, .el-radio')].find(e => e.innerText.trim() === '严重');
        if (ck) ck.click();
        return { 输入框数: inner.length, 已填: out, 勾了严重: !!ck,
                 立刻回读: inner.slice(0, 3).map(el => el.value),
                 目标说明: inner.slice(0, 3).map(el => (el.getAttribute('placeholder') || el.className || '').slice(0, 30)) };
      })()`)
      await sleep(900)
      const readBack = await evaluate(`[...document.querySelectorAll('.as-cell-input, .as-fill-input')]
        .map(b => b.matches('input, textarea') ? b : b.querySelector('input, textarea')).filter(Boolean)
        .slice(0, 3).map(el => el.value)`)
      console.log('   900ms 后 DOM 回读:', JSON.stringify(readBack))
      console.log('=== 7. 填字段:', filled, '→ 点「保存」 ===')
      await sleep(800)
      const saveClick = await evaluate(`(() => {
        const b = [...document.querySelectorAll('.as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '保存');
        if (!b) return 'NO-BUTTON';
        if ((b.className||'').includes('disabled')) return 'DISABLED';
        b.click(); return 'CLICKED';
      })()`)
      console.log('   点击:', saveClick)
      await sleep(3500)
      const after = await evaluate(`(() => ({
        docno: (document.querySelector('.as-docno') || {}).innerText || '',
        msgs: [...document.querySelectorAll('.el-message, .el-notification, .el-message-box')].map(e => (e.innerText||'').replace(/\\s+/g,' ').trim()),
        errs: [...document.querySelectorAll('.el-message--error, .el-form-item__error')].map(e => (e.innerText||'').trim()),
      }))()`)
      for (const c of callIds) { const rb = await send('Network.getResponseBody', { requestId: c.id }); console.log('   响应 [' + c.status + ']:', (rb.result?.body || '').slice(0, 400)) }
      console.log('   保存请求  :')
      posts.forEach(x => console.log('     ', x))
      console.log('   单据编号:', after.docno.trim())
      console.log('   提示    :', JSON.stringify(after.msgs))
      console.log('   错误    :', JSON.stringify(after.errs))

      // 审批链:提交审批 → 审批通过 → 弃审(逐步入库,状态见库)
      if (process.argv[4] === 'flow') {
        const clickSide = (label) => evaluate(`(() => {
          const b = [...document.querySelectorAll('.as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === ${JSON.stringify(label)});
          if (!b) return 'NO-BUTTON';
          if ((b.className||'').includes('disabled')) return 'DISABLED';
          b.click(); return 'CLICKED';
        })()`)
        const confirmBox = () => evaluate(`(() => {
          const box = document.querySelector('.el-message-box');
          if (!box) return 'NO-BOX';
          const b = [...box.querySelectorAll('button')].find(e => /确认|确定|是/.test(e.innerText));
          if (!b) return 'NO-CONFIRM';
          b.click(); return 'CONFIRMED:' + b.innerText.replace(/\\s/g,'');
        })()`)
        for (const label of ['提交审批', '审批通过', '弃审']) {
          const r = await clickSide(label)
          await sleep(600)
          const c = r === 'CLICKED' ? await confirmBox() : '-'
          await sleep(2500)
          const msg = await evaluate(`[...document.querySelectorAll('.el-message, .el-notification, .el-message-box')].map(e => (e.innerText||'').replace(/\\s+/g,' ').trim()).join(' ; ')`)
          console.log(`=== 8. ${label}: ${r} / ${c} | 提示: ${msg || '(已消失)'} ===`)
        }
      }
    }

    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
