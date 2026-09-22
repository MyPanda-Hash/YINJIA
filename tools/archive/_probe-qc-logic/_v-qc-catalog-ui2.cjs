/* _v-qc-catalog-ui2.cjs — 检验目录新呈现核验:只读纸面 + 新列 + 行上动作按钮 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9363
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cat2-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1680,1050',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')

    let snap = null
    for (let a = 1; a <= 5 && !snap; a++) {
      await navigate('about:blank')
      await navigate('http://localhost:5173/#/panelx/list/QC_CATALOG')
      await sleep(3500)
      await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
      for (let i = 0; i < 20; i++) {
        const s = await evaluate(`(() => {
          const sheet = document.querySelector('.catalog-sheet')
          if (!sheet) return ''
          const heads = [...sheet.querySelectorAll('thead th')].map(e => e.innerText.replace(/\\s/g,''))
          const rows = sheet.querySelectorAll('tbody tr').length
          return JSON.stringify({
            heads,
            rows,
            bodyInputs: sheet.querySelectorAll('tbody input, tbody textarea').length,
            acts: [...sheet.querySelectorAll('.cs-act')].map(e => e.innerText.trim()),
            links: sheet.querySelectorAll('.cs-link').length,
            text: sheet.innerText.slice(0, 600),
          })
        })()`)
        const j = s ? JSON.parse(s) : null
        // 就绪判定要认「真的有数据行」:空态占位行(暂无检验记录)也算 1 行,不能用 rows>0
        if (j && (j.acts.length > 0 || j.links > 0)) { snap = j; break }
        await sleep(800)
      }
      if (!snap) console.log(`   [重试 ${a}/5] 纸面未就绪`)
    }
    ok('纸张已渲染且有数据行', !!snap && snap.rows > 0, JSON.stringify(snap && { rows: snap.rows }))
    for (const h of ['检测物料类别', '物料名称', '物料编码', '批次号', '数量', '检验状态', '是否合格', '检验单号', '检验数据记录单号', '检验记录目录'])
      ok(`表头 ${h}`, (snap?.heads || []).some((x) => x.includes(h)))
    for (const h of ['第1类', '第2类', '第3类'])
      ok(`表头已删除 ${h}`, !(snap?.heads || []).some((x) => x.includes(h)))
    ok('纸面只读(表体无输入框)', (snap?.bodyInputs || 0) === 0, `输入框=${snap?.bodyInputs}`)
    ok('行上出现动作按钮(完成检验/修改/✕)', (snap?.acts || []).length > 0, JSON.stringify(snap?.acts))
    const actCount = (name) => (snap?.acts || []).filter((t) => t === name).length
    ok('每行都有「完成检验」「修改」「✕」三钮', actCount('完成检验') === snap.rows && actCount('修改') === snap.rows && actCount('✕') === snap.rows,
      `行=${snap.rows} 完成检验=${actCount('完成检验')} 修改=${actCount('修改')} ✕=${actCount('✕')}`)

    // 列对齐:所有数据行的 批次号/数量/检验单号 单元格 x 必须一致(空类别行曾因合并判定不自洽而整行左移)
    const align = await evaluate(`(() => {
      const table = document.querySelector('.catalog-sheet .cs-table')
      const rows = [...table.querySelectorAll('tbody tr')].filter(r => r.querySelector('td'))
      const col = (r, sel) => { const c = r.querySelector(sel); return c ? Math.round(c.getBoundingClientRect().x) : null }
      const xs = (sel) => rows.map(r => col(r, sel)).filter(v => v !== null)
      const uniq = (a) => [...new Set(a)]
      return JSON.stringify({
        rows: rows.length,
        batchX: uniq(xs('td.c-batch')), qtyX: uniq(xs('td.c-qty')),
        noX: uniq(xs('td.c-no')), opX: uniq(xs('td.c-op')),
        firstCellTags: rows.map(r => r.children[0]?.className || ''),
      })
    })()`)
    const al = JSON.parse(align || '{}')
    ok('批次号/数量列所有行 x 一致(无错列)', (al.batchX || []).length === 1 && (al.qtyX || []).length === 1, align)
    ok('检验单号/操作列所有行 x 一致', (al.noX || []).length === 1 && (al.opX || []).length === 1, align)
    // 错列检测:行首单元格只可能是 类别(c-cat, 未合并时的组首)/编码(c-code, 物料名称被上行 rowspan 覆盖)/
    // 物料名称(c-mat);若出现 c-batch/c-qty 等,说明该行整体左移(历史 bug)
    ok('无整行左移(行首格只可能是 类别/物料名称/编码)',
      (al.firstCellTags || []).every((c) => /c-cat|c-code|c-mat/.test(String(c))), JSON.stringify(al.firstCellTags))
    ok('两个单号带查看/跳转链接', (snap?.links || 0) >= 2, `链接数=${snap?.links}`)
    ok('含物料编码/类别/数量示例数据', /折叠棉|YJ-YCYX|kg/.test(snap?.text || ''), (snap?.text || '').slice(0, 120).replace(/\n/g, '|'))

    // 操作列表头不应出现「没数据的空框」(用户口径):无边框/无底色
    const opHead = await evaluate(`(() => {
      const th = document.querySelector('.catalog-sheet thead th.c-op') || document.querySelector('.catalog-sheet thead th.c-op-plain')
      if (!th) return 'NO_TH'
      const cs = getComputedStyle(th)
      return JSON.stringify({ text: th.innerText.trim(), borderTop: cs.borderTopWidth, borderRight: cs.borderRightWidth, bg: cs.backgroundColor })
    })()`)
    const op = JSON.parse(opHead === 'NO_TH' ? '{"text":"缺失"}' : opHead)
    ok('操作列表头无文字', op.text === '', opHead)
    ok('操作列表头无边框(空框已去掉)', op.borderTop === '0px' && op.borderRight === '0px', opHead)
    ok('操作列表头无底色', /rgba\(0, 0, 0, 0\)|transparent/.test(String(op.bg)), opHead)

    // 「修改记录」入口应在右侧竖排按钮栏,而不是纸面底部(用户口径)
    const rail = await evaluate(`[...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g,''))`)
    ok('右侧按钮栏有「修改记录」', (rail || []).includes('修改记录'), JSON.stringify(rail))
    const sheetLogBtn = await evaluate(`!!document.querySelector('.catalog-sheet .cs-add')`)
    ok('纸面底部已无「修改记录」按钮', sheetLogBtn === false)
    // 点开侧栏「修改记录」→ 弹出弹窗
    await evaluate(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '修改记录'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    let dlgTitle = ''
    for (let i = 0; i < 12 && !dlgTitle; i++) {
      await sleep(600)
      dlgTitle = await evaluate(`(() => { const d = [...document.querySelectorAll('.el-dialog')].find(e => e.offsetParent !== null); return d ? d.innerText.slice(0, 40) : '' })()`)
    }
    ok('点「修改记录」弹出记录弹窗', /修改记录|修改进行中|次修改|暂无修改记录/.test(String(dlgTitle)), String(dlgTitle).replace(/\n/g, '|'))
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
  console.log(process.exitCode ? '\n== 有失败项 ==' : '\n== 全部通过 ==')
  process.exit(process.exitCode || 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
