/* _v-qc-insp-rec.cjs — 检验数据记录面板(QC_INSP_REC)浏览器实测(等待式,抗 HMR 抖动)
   ① 纸张式检验报告(.qc-rec-sheet,标题=检验报告),不是通用单据表单
   ② 抬头八格 + 分区「检验结果」+ 表体四列 + 表尾(检验结论/处理意见/检验人/审核人)一比一
   ③ 默认值:文件编码 YJ-QR-96 / 检验依据 YJ-Q-30 / 审核人 冯敏 / 检验人=登录人(锁定)
   ④ 检验项=标准库下拉(qc.insp_item);「新增检验项」可增行
   ⑤ 填行 → 保存 → 落库核对(头 + 行)
   用法:node tools/archive/_probe-qc-insp-rec/_v-qc-insp-rec.cjs(需 5173 + 8090 已起) */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9357
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090/api'
const ITEM = '外观'
const JUDGE = '合格'
const RESULT = '外观无脏污、无破损,符合要求'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) process.exitCode = 1
}

async function apiRows(token) {
  const r = await (await fetch(`${BASE}/px/queryFormDataList`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: 'QC_INSP_REC', pageNo: 1, pageSize: 10, condition: {} }),
  })).json()
  return r?.data?.list || r?.data?.rows || []
}
async function apiDetail(token, no) {
  const r = await (await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_INSP_REC&code=${encodeURIComponent(no)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()
  return { head: r?.data?.data || {}, items: r?.data?.detailData?.items || [] }
}

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const me = login.data.user?.realName || login.data.user?.userName || ''
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rec-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1338,1750',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const calls = []; const posts = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('/px/callButton') && m.params.request.postData) {
        try {
          const b = JSON.parse(m.params.request.postData)
          const fd = b.formData || b.form || {}
          posts.push({
            button: b.buttonName,
            head: Object.fromEntries(Object.entries(fd).filter(([k, v]) => k !== 'detail' && v !== null && v !== '' && v !== undefined)),
            rows: (fd.detail && fd.detail.items) || [],
          })
        } catch { posts.push({ raw: String(m.params.request.postData).slice(0, 200) }) }
      }
      if (m.method === 'Network.responseReceived' && m.params.response.url.includes('/px/callButton')) calls.push(m.params.response.status)
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    /** 等待条件成立(表达式返回 truthy);返回最后一次取值 */
    const waitFor = async (exp, ms = 30000, step = 800) => {
      for (let i = 0; i < Math.ceil(ms / step); i++) {
        const v = await evaluate(exp)
        if (v) return v
        await sleep(step)
      }
      return null
    }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')

    // 开面板:dev server 上并行开发会触发 HMR 整页重载,偶发落在"配置未回/单据 0/0"的瞬时态 —— 整页重开重试
    let ready = null
    for (let attempt = 1; attempt <= 5 && !ready; attempt++) {
      await navigate('about:blank')
      await navigate('http://localhost:5173/#/panelx/list/QC_INSP_REC')
      await sleep(3500)
      await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
      // 等:纸张 + 侧栏「保存/新增」(配置加载完)。
      // 注:本面板 2026-09-22 起进 DOC_ARCHIVE_PANELS(保存即归档),打开时多半落在**已归档只读单**上,
      //     故就绪只看纸张与按钮,随后统一走「新增」拿一张可编辑空单再断言。
      ready = await waitFor(`(() => {
        const sheet = document.querySelector('.qc-rec-sheet')
        const side = [...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g,''))
        return (sheet && side.includes('保存') && side.includes('新增')) ? 'READY' : ''
      })()`, 20000)
      if (!ready) console.log(`   [重试 ${attempt}/5] 面板未就绪(配置未回/列表 0/0)`)
    }
    ok('面板就绪(纸张 + 侧栏保存 + 抬头默认值)', ready === 'READY', ready)
    if (ready !== 'READY') {
      const why = await evaluate(`(() => JSON.stringify({
        url: location.hash,
        hasSheet: !!document.querySelector('.qc-rec-sheet'),
        side: [...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g, '')),
        inputs: [...document.querySelectorAll('.qc-rec-sheet input')].map(e => e.value),
        body: (document.querySelector('.panelx-list') || document.body).innerText.slice(0, 300),
      }))()`)
      console.log('   未就绪诊断:', why)
      throw new Error('面板未就绪,终止')
    }

    // ① 纸张与版式(先记下现有单据号,保存后据此判定"这是一张新报告")
    const existingNos = (await apiRows(token)).map((r) => r['单据编号'])

    // ② 新增一张检验报告:验证「检验人=账号登录人自动生成」锁定默认与固定项默认值
    //   (纸张式面板不渲染通用单据条,故不做单号对比;step 1 先用 API 确认真的新建了,step 2 等纸面切到这张空单)
    await evaluate(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    let freshNo = ''
    for (let i = 0; i < 20 && !freshNo; i++) {
      await sleep(700)
      freshNo = (await apiRows(token)).map((r) => r['单据编号']).find((n) => !existingNos.includes(n)) || ''
    }
    ok('API 确认已新建一张报告', !!freshNo, freshNo || '(未新建)')
    await waitFor(`(() => {
      const sheet = document.querySelector('.qc-rec-sheet')
      const inputs = sheet ? [...sheet.querySelectorAll('input')].map(e => e.value) : []
      return inputs.includes('YJ-QR-96') ? 'EDITABLE' : ''
    })()`, 15000)
    const fresh = await waitFor(`(() => {
      const sheet = document.querySelector('.qc-rec-sheet')
      if (!sheet) return ''
      const inputs = [...sheet.querySelectorAll('input')].map(e => e.value)
      const headVal = (label) => {
        const th = [...sheet.querySelectorAll('.qr-head-table th')].find(t => t.innerText.trim() === label)
        return th?.nextElementSibling?.querySelector('input')?.value ?? null
      }
      // 新单特征:默认值已带出(文件编码) + 业务字段还是空的(不是上一张已填好的单)
      return (inputs.includes('YJ-QR-96') && headVal('物料批次') === '' && headVal('物料名称') === '') ? 'FRESH' : ''
    })()`, 25000)
    ok('纸面已切到这张新报告(空单可填)', fresh === 'FRESH', fresh)

    const snap = JSON.parse(await evaluate(`(() => {
      const sheet = document.querySelector('.qc-rec-sheet')
      return JSON.stringify({
        text: sheet.innerText,
        inputs: [...sheet.querySelectorAll('input,textarea')].map(e => e.value),
        hasHeaderFields: !!document.querySelector('.header-fields'),
        hasAddData: [...document.querySelectorAll('button')].some(b => b.innerText.includes('新增数据')),
        addbar: [...sheet.querySelectorAll('.qr-add')].map(e => e.innerText),
      })
    })()`))
    ok('纸张 .qc-rec-sheet 已渲染', !!snap.text)
    ok('不是通用单据表单(无表头字段条/无明细新增数据按钮)', snap.hasHeaderFields === false && snap.hasAddData === false)
    for (const t of ['检验报告', '物料名称', '来料日期', '物料编码', '来料数量', '物料批次', '文件编码', '检验日期', '检验依据', '检验结果', '检验项', '检测标准', '检测结果', '单项判定', '检验结论', '处理意见', '检验人', '审核人'])
      ok(`纸面含 ${t}`, snap.text.includes(t))
    ok('默认 文件编码=YJ-QR-96', snap.inputs.includes('YJ-QR-96'), JSON.stringify(snap.inputs))
    ok('默认 检验依据=YJ-Q-30', snap.inputs.includes('YJ-Q-30'))
    ok('默认 审核人=冯敏(可编辑态为输入框值)', snap.text.includes('冯敏') || snap.inputs.includes('冯敏'), JSON.stringify(snap.inputs))
    ok(`默认 检验人=登录人(${me})`, snap.text.includes(me) || snap.inputs.includes(me), me)

    // ② 新增一行检验项
    ok('「新增检验项」在纸面上', snap.addbar.some((t) => t.includes('新增检验项')), JSON.stringify(snap.addbar))
    await evaluate(`(() => { const b = [...document.querySelectorAll('.qc-rec-sheet .qr-add')].find(e => e.innerText.includes('新增检验项')); b?.click(); return !!b })()`)
    const rowReady = await waitFor(`document.querySelectorAll('.qc-rec-sheet .qr-table tbody input').length > 0`, 10000)
    ok('表体出现可填行', !!rowReady)

    // ③ 检验项下拉=标准库(qc.insp_item):断言选项并**真正选中** 外观(el-select 必须走选项点击)
    await evaluate(`(() => {
      const sel = document.querySelector('.qc-rec-sheet .qr-table tbody td.c-item .el-select__wrapper')
      sel?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!sel
    })()`)
    await sleep(900)
    const opts = await evaluate(`[...document.querySelectorAll('.el-select-dropdown')].filter(p => p.offsetParent !== null).map(p => p.innerText).join('|')`)
    ok('检验项下拉=标准库选项(含 外观/尺寸)', /外观/.test(opts) && /尺寸/.test(opts), String(opts).slice(0, 60).replace(/\n/g, ','))
    const picked = await evaluate(`(() => {
      const pops = [...document.querySelectorAll('.el-select-dropdown')].filter(p => p.offsetParent !== null)
      const items = [...(pops.pop()?.querySelectorAll('.el-select-dropdown__item') || [])]
      const opt = items.find(o => o.innerText.trim() === ${JSON.stringify(ITEM)})
      opt?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!opt
    })()`)
    ok(`检验项可选「${ITEM}」`, picked)
    await sleep(600)

    // ④ 填抬头必填(按标签定位,避免按序号错位)+ 填行内 检测标准/检测结果
    const filled = await evaluate(`(() => {
      const setV = (el, v) => {
        if (!el) return 0
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return 1
      }
      const sheet = document.querySelector('.qc-rec-sheet')
      const headInput = (label) => {
        const th = [...sheet.querySelectorAll('.qr-head-table th')].find(t => t.innerText.trim() === label)
        return th?.nextElementSibling?.querySelector('input') || null
      }
      let n = 0
      n += setV(headInput('物料名称'), 'HP-2040')     // 必填
      n += setV(headInput('物料编码'), 'HP-2040')
      n += setV(headInput('物料批次'), '260807')      // 必填
      n += setV(headInput('来料数量'), '51Kg')
      n += setV(sheet.querySelector('.qr-table tbody td.c-std input'), '无脏污、无破损')
      n += setV(sheet.querySelector('.qr-table tbody td.c-result textarea'), ${JSON.stringify(RESULT)})
      return n
    })()`)
    ok('抬头与行内容已填入(6 格)', filled === 6, String(filled))

    // 单项判定下拉:选 合格
    await evaluate(`(() => {
      const w = document.querySelector('.qc-rec-sheet .qr-table tbody td.c-judge .el-select__wrapper')
      w?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!w
    })()`)
    await sleep(900)
    const judged = await evaluate(`(() => {
      const pops = [...document.querySelectorAll('.el-select-dropdown')].filter(p => p.offsetParent !== null)
      const items = [...(pops.pop()?.querySelectorAll('.el-select-dropdown__item') || [])]
      const opt = items.find(o => o.innerText.trim() === ${JSON.stringify(JUDGE)})
      opt?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!opt
    })()`)
    ok(`单项判定可选「${JUDGE}」`, judged)
    await sleep(700)

    // ⑤ 保存
    const before = posts.length
    await evaluate(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '保存'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    for (let i = 0; i < 24 && posts.length === before; i++) await sleep(500)
    await sleep(2500)
    ok('保存请求已发出', posts.length > before, JSON.stringify(calls))
    const payload = posts[posts.length - 1]
    console.log('   保存载荷(表头):', JSON.stringify(payload?.head))
    console.log('   保存载荷(行):', JSON.stringify(payload?.rows))
    const msg = await evaluate(`[...document.querySelectorAll('.el-message')].map(e => e.innerText).join(' | ')`)
    if (msg) console.log('   页面提示:', msg)

    // ⑥ 落库核对
    const rows = await apiRows(token)
    const hit = rows.find((r) => r['物料批次'] === '260807') || rows[0]
    const no = hit?.['单据编号'] || ''
    ok('列表可查到刚存的报告', !!no, `n=${rows.length} no=${no}`)
    ok('本次确实新建了一张报告(编号不在开工前的清单里)', !!no && !existingNos.includes(no), `新=${no} 原=[${existingNos.join(',')}]`)
    const { head, items } = await apiDetail(token, no)
    ok('头:物料名称=HP-2040', head['物料名称'] === 'HP-2040', JSON.stringify(head['物料名称']))
    ok('头:物料批次=260807', head['物料批次'] === '260807')
    ok('头:文件编码=YJ-QR-96', head['文件编码'] === 'YJ-QR-96')
    ok('头:检验依据=YJ-Q-30', head['检验依据'] === 'YJ-Q-30')
    ok('头:表单审核人=冯敏(纸面印作 审核人)', head['表单审核人'] === '冯敏', JSON.stringify(head['表单审核人']))
    ok('头:检验人=登录人', head['检验人'] === me, JSON.stringify(head['检验人']))
    ok('头:检验日期已填', !!head['检验日期'], JSON.stringify(head['检验日期']))
    ok('行:检验项=外观', items[0]?.['检验项'] === ITEM, JSON.stringify(items[0]))
    ok('行:检测结果已落库', items[0]?.['检测结果'] === RESULT)
    ok('行:单项判定=合格', items[0]?.['单项判定'] === JUDGE, JSON.stringify(items[0]?.['单项判定']))

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    fs.writeFileSync(path.join(__dirname, '_v-qc-insp-rec.png'), Buffer.from(shot.result.data, 'base64'))
    console.log('截图: tools/archive/_probe-qc-insp-rec/_v-qc-insp-rec.png  单据号:', no)
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* 清理失败无碍 */ }
  }
  console.log(process.exitCode ? '\n== 有失败项 ==' : '\n== 全部通过 ==')
  process.exit(process.exitCode || 0)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
