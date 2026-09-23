/* _v-qc-catalog-ui.cjs — 检验目录面板(QC_CATALOG)浏览器实测:呈现方式必须与「项目进度查询」一致
   (纸张式控制列表),不得是通用单据表单。断言:
   ① 打开即纸张 .catalog-sheet(标题=检验目录)
   ② 不是单据表单:无表头字段条(.header-fields)、无明细 el-table 的「新增数据」按钮
   ③ 三级表头一比一:第1类/第2类/第3类 + 检测物料类别/物料名称/检验记录目录 + 批次号/数量/检验状态/是否合格
   ④ 示例行:阻垢料/HP-12/260807/51Kg 纸面上可见
   ⑤ 分组合并:检测物料类别单元格 rowspan=2(两行同类别)
   ⑥ 原表脚注可见:输入批次号后点击批次号可查阅详细或者新增检验
   ⑦ 右侧竖排操作栏(approval-side)有「保存」,且没有「新增」
   用法:node tools/archive/_probe-qc-catalog/_v-qc-catalog-ui.cjs(需 5173 前端 + 8090 后端已起) */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9351
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const login = await (await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cat-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1338,1750',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')

    // dev server 上并行开发会触发 HMR 整页重载,偶发落在"配置未回/列表 0/0"的瞬时态 —— 整页重开重试
    let ready = null
    for (let attempt = 1; attempt <= 5 && !ready; attempt++) {
      await navigate('about:blank')
      await navigate('http://localhost:5173/#/panelx/list/QC_CATALOG')
      await sleep(3500)
      await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
      ready = await (async () => {
        for (let i = 0; i < 25; i++) {
          const v = await evaluate(`(() => {
            const sheet = document.querySelector('.catalog-sheet')
            const side = [...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g,''))
            const vals = sheet ? [...sheet.querySelectorAll('tbody input, tbody textarea')].map(e => e.value) : []
            return (sheet && side.includes('保存') && vals.includes('260807')) ? 'READY' : ''
          })()`)
          if (v) return v
          await sleep(800)
        }
        return null
      })()
      if (!ready) console.log(`   [重试 ${attempt}/5] 面板未就绪(配置未回/列表 0/0)`)
    }
    ok('面板就绪(纸面 + 侧栏保存 + 示例行)', ready === 'READY', ready)
    if (ready !== 'READY') throw new Error('面板未就绪,终止')

    // ① 纸张
    let sheet = await evaluate(`document.querySelector('.catalog-sheet')?.innerText?.slice(0, 4000) || ''`)
    ok('纸张 .catalog-sheet 已渲染', !!sheet)
    ok('纸张标题=检验目录', sheet.trim().startsWith('检验目录'), sheet.slice(0, 20).replace(/\n/g, '|'))
    ok('右侧操作栏存在(approval-side)', await evaluate(`!!document.querySelector('.approval-side')`))

    // ② 不是单据表单
    ok('无表头字段条(非单据表单)', await evaluate(`!document.querySelector('.header-fields')`))
    ok('无明细「新增数据」按钮(非单据表单)', await evaluate(`![...document.querySelectorAll('button')].some(b => b.innerText.includes('新增数据'))`))

    // ③ 三级表头
    for (const h of ['第1类', '第2类', '第3类', '检测物料类别', '物料名称', '检验记录目录', '批次号', '数量', '检验状态', '是否合格'])
      ok(`表头 ${h}`, sheet.includes(h))

    // ④ 示例行(草稿态格内是输入框,值取 value 而非 innerText)
    const cells = await evaluate(`(() => {
      const vals = [...document.querySelectorAll('.catalog-sheet tbody input, .catalog-sheet tbody textarea')].map(e => e.value)
      const texts = [...document.querySelectorAll('.catalog-sheet tbody td')].map(e => e.innerText.trim()).filter(Boolean)
      return JSON.stringify({ vals, texts })
    })()`)
    const c = JSON.parse(cells || '{}')
    const all = [...(c.vals || []), ...(c.texts || [])]
    for (const v of ['阻垢料', 'HP-12', '260807', '51Kg'])
      ok(`示例行含 ${v}`, all.includes(v), `vals=${JSON.stringify(c.vals)}`)

    // ⑤ 分组合并(rowspan)
    const spans = await evaluate(`(() => {
      const td = document.querySelector('.catalog-sheet td.c-cat')
      const td2 = document.querySelector('.catalog-sheet td.c-mat')
      return JSON.stringify({ cat: td?.getAttribute('rowspan'), mat: td2?.getAttribute('rowspan'), catRows: document.querySelectorAll('.catalog-sheet td.c-cat').length, bodyRows: document.querySelectorAll('.catalog-sheet tbody tr').length })
    })()`)
    const sp = JSON.parse(spans || '{}')
    ok('检测物料类别合并(rowspan=2)', sp.cat === '2', spans)
    ok('物料名称合并(rowspan=2)', sp.mat === '2', spans)

    // ⑥ 脚注(原表第16行)
    ok('原表脚注可见', sheet.includes('输入批次号后点击批次号可查阅详细或者新增检验'))

    // ⑦ 右侧按钮
    const side = await evaluate(`document.querySelector('.approval-side')?.innerText || ''`)
    ok('右侧有「保存」', side.includes('保存'))
    ok('右侧无「新增」(singleDoc)', !side.includes('新增'))

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    fs.writeFileSync(path.join(__dirname, '_v-qc-catalog-ui.png'), Buffer.from(shot.result.data, 'base64'))
    console.log('截图: tools/archive/_probe-qc-catalog/_v-qc-catalog-ui.png')
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* 清理失败无碍 */ }
  }
  console.log(process.exitCode ? '\n== 有失败项 ==' : '\n== 全部通过 ==')
  process.exit(process.exitCode || 0) // 关掉残留的 CDP WebSocket,避免脚本挂住
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
