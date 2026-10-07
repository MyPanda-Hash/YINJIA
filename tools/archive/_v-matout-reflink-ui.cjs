/* _v-matout-reflink-ui.cjs — 材料出库单(MATERIAL_OUT)字段关联 UI 核查
   登录(正式账套,只读:只打开「新增」表单,不保存)→ 打开面板 → 新增 →
   ① 表头 生产车间/领用人/部门编码/经手人编码:控件类型是「参照」(可点选档案)还是旧的下拉/文本
   ② 明细 计量单位:可选项是「单位档案」(个/支/张/PCS…)还是旧的硬编码 4 项(件/kg/套/升)
   用法:node tools/archive/_v-matout-reflink-ui.cjs   (需后端 :8090 在跑;它同时托管前端静态)
*/
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9355
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-matout-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  // 等调试端口就绪(实测 Edge 冷启动可能 >2.5s;不轮询会 ECONNREFUSED)
  let ready = false
  for (let i = 0; i < 40 && !ready; i++) {
    await sleep(500)
    try { const v = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (v.ok) ready = true } catch {}
  }
  if (!ready) throw new Error('Edge 调试端口未就绪(port=' + PORT + ')')
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errors = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console: ' + (m.params.args || []).map(a => a.value || '').join(' ').slice(0, 200))
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate(BASE + '/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    errors.length = 0
    await navigate(BASE + '/#/panelx/list/MATERIAL_OUT')
    await sleep(4000)

    const list = await evaluate(`(() => ({
      title: document.title, hash: location.hash,
      rendered: !!document.querySelector('.el-table') || !!document.querySelector('.el-empty'),
      btns: [...document.querySelectorAll('button')].map(b => (b.innerText||'').replace(/\\s+/g,'').trim()).filter(Boolean).slice(0, 24)
    }))()`)
    console.log('=== 1. 面板 ===')
    console.log('  hash   :', list.hash, '| 渲染:', list.rendered ? 'OK' : 'NO-RENDER')
    console.log('  按钮   :', JSON.stringify(list.btns))
    console.log('  ⚠ 工具栏是否含 转ERP:', list.btns.some(b => b.includes('转ERP')) ? '有' : '无')

    // 点「新增」进表单(客户端动作,不落库)
    const clicked = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').replace(/\\s+/g,'') === '新增')
             || [...document.querySelectorAll('button')].find(x => (x.innerText||'').includes('新增'));
      if (!b) return 'NO-BUTTON'; b.click(); return 'CLICKED:' + b.innerText.trim();
    })()`)
    console.log('=== 2. 点新增:', clicked, '===')
    await sleep(3500)

    // 表头字段:标签 + 控件类型(参照 = 有 picker 图标/只读点选;文本 = 可自由输入)
    const head = await evaluate(`(() => {
      const out = []
      const want = ['生产车间','领用人','部门编码','经手人编码','仓库','项目','出库类别','业务类型']
      for (const item of document.querySelectorAll('.el-form-item, .form-item, [class*=formItem]')) {
        const lab = (item.querySelector('label, .el-form-item__label, [class*=label]')?.innerText || '').replace(/\\s|\\*/g,'')
        if (!want.includes(lab)) continue
        const inp = item.querySelector('input')
        out.push({
          字段: lab,
          占位: inp ? (inp.placeholder || '') : '(无输入框)',
          只读: inp ? !!inp.readOnly : null,
          后缀图标: item.querySelectorAll('.el-input__suffix *, .el-select__caret, [class*=picker], [class*=suffix] i').length,
          控件: item.querySelector('.el-select') ? 'el-select' : (item.querySelector('.el-input') ? 'el-input' : '其它'),
        })
      }
      return out
    })()`)
    console.log('=== 3. 表头字段控件 ===')
    for (const f of head) console.log('  ', JSON.stringify(f))

    // 明细 计量单位:点开第一行的选择框,读候选(旧硬编码只有 件/kg/套/升;单位档案有 个/支/张/PCS…)
    const unitProbe = await evaluate(`(() => {
      // 明细表格第一行里找「计量单位」列(表头 text 定位)
      const tables = [...document.querySelectorAll('.el-table')]
      for (const t of tables) {
        const heads = [...t.querySelectorAll('thead th')].map(th => (th.innerText||'').replace(/\\s/g,''))
        const idx = heads.indexOf('计量单位')
        if (idx < 0) continue
        const row = t.querySelector('tbody tr')
        if (!row) continue
        const cell = row.children[idx]
        if (!cell) continue
        const inp = cell.querySelector('input')
        if (inp) inp.click()
        const dd = [...document.querySelectorAll('.el-select-dropdown__item, .el-dropdown-menu__item, .el-popper .el-select-dropdown__item')]
          .map(e => (e.innerText||'').trim()).filter(Boolean)
        return { 找到列: true, 单元格HTML: (cell.innerHTML||'').slice(0, 300), 候选: dd.slice(0, 40) }
      }
      return { 找到列: false }
    })()`)
    console.log('=== 4. 明细「计量单位」候选 ===')
    console.log('  ', JSON.stringify(unitProbe).slice(0, 1200))

    // 参照弹窗实测:点表头「生产车间」的参照入口,看是否弹出部门档案列表
    const refProbe = await evaluate(`(async () => {
      const item = [...document.querySelectorAll('.el-form-item, .form-item, [class*=formItem]')]
        .find(i => ((i.querySelector('label, .el-form-item__label, [class*=label]')?.innerText || '').replace(/\\s|\\*/g,'') === '生产车间'))
      if (!item) return 'NO-FIELD'
      const inp = item.querySelector('input')
      if (!inp) return 'NO-INPUT'
      inp.click(); inp.focus()
      await new Promise(r => setTimeout(r, 2500))
      const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null)
      const dd  = [...document.querySelectorAll('.el-select-dropdown__item')].map(e => (e.innerText||'').trim()).filter(Boolean)
      return { 弹窗数: dlg.length,
               弹窗标题: dlg.map(d => (d.querySelector('.el-dialog__title')?.innerText || '').trim()),
               下拉候选: dd.slice(0, 20) }
    })()`)
    console.log('=== 5. 点「生产车间」参照入口 ===')
    console.log('  ', JSON.stringify(refProbe).slice(0, 900))
    console.log('=== 6. console 报错 ===')
    console.log('  ', errors.length ? errors.slice(0, 5).join('\n   ') : '(无)')
    ws.close()
  } finally {
    try { edge.kill() } catch {}
  }
}
main().catch(e => { console.error('FAIL', e); process.exit(1) })
