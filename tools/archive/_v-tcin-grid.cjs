/* _v-tcin-grid.cjs — QC_TC_IN 版式「对齐/不错位」核查(只读,不改库)
   做法:进编辑态渲染整张文书 → 逐行量出每个格子的 x 边界 → 断言「全表所有竖线都落在同一张网格上」
        (每行的边界集合必须是全局边界集合的子集;任何一行多出一条别的位置的竖线 = 错位)。
   同时报出行高、勾选框位置,并截图 tools/archive/_tc-in-render.png 供与原扫描图逐格比对。
   用法:node tools/archive/_v-tcin-grid.cjs [PANEL=QC_TC_IN] */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib')
const PORT = 9344
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PANEL = process.argv[2] || 'QC_TC_IN'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const login = await (await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-grid-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1338,1750',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errors = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
        errors.push('console: ' + (m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200))
      if (m.method === 'Runtime.exceptionThrown')
        errors.push('exception: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 200))
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(700); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`http://localhost:5173/#/panelx/list/${PANEL}`)
    await sleep(3500)

    // 关掉首次进入的「MES 初始化配置」引导(自定义 .wizard-mask,不是 el-dialog,得点它自己的关闭钮)
    await evaluate(`(() => {
      const wz = document.querySelector('.wizard-mask')
      if (wz) {
        const c = wz.querySelector('.wz-close') || wz.querySelector('.wz-skip')
        if (c) { c.click(); return 'WIZARD-DISMISSED' }
      }
      const d = [...document.querySelectorAll('.el-dialog, .el-overlay')]
        .find(e => /初始化配置|行业细分/.test(e.innerText || ''));
      if (!d) return 'NO-DIALOG';
      const b = [...d.querySelectorAll('button, .el-button, span')].find(e => /下次再说|关闭/.test(e.innerText || ''));
      if (b) { b.click(); return 'DISMISSED' }
      return 'NO-BUTTON'
    })()`)
    await sleep(1200)

    // 进可编辑态(只为让大填写区渲染成 textarea;「新增」不落库,不点保存就没有写入)
    let editClicked = ''
    for (let i = 0; i < 8; i++) {
      await evaluate(`(() => {
        const b = [...document.querySelectorAll('button')].find(b => b.innerText.replace(/\\s/g,'').includes('新增流程'));
        if (b && !document.querySelector('.approval-sheet')) b.click();
        return !!b
      })()`)
      await sleep(1800)
      editClicked = await evaluate(`(() => {
        if (document.querySelector('.el-textarea__inner')) return 'EDITABLE'
        const b = [...document.querySelectorAll('.as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增');
        if (!b) return 'NO-BUTTON'
        if ((b.className||'').includes('disabled')) return 'DISABLED'
        b.click(); return 'CLICKED'
      })()`)
      if (editClicked === 'EDITABLE') break
      await sleep(2200)
    }
    await sleep(2000)

    const geom = await evaluate(`(() => {
      const sheet = document.querySelector('.approval-sheet')
      if (!sheet) return { err: 'NO-SHEET' }
      const table = sheet.querySelector('.as-table')
      const t0 = table.getBoundingClientRect()
      const px = n => Math.round(n * 10) / 10
      const rows = [...table.children].map((el, i) => {
        const r = el.getBoundingClientRect()
        const cells = [...el.querySelectorAll('.q-vlabel, .q-label, .q-dept-name')].map(c => {
          const b = c.getBoundingClientRect()
          return { cls: (c.className || '').split(' ')[0], txt: (c.innerText || '').replace(/\\s+/g, '').slice(0, 8),
                   x0: px(b.left - t0.left), x1: px(b.right - t0.left) }
        })
        const pairs = [...el.querySelectorAll('.q-pair')].map(c => {
          const b = c.getBoundingClientRect()
          return { x0: px(b.left - t0.left), x1: px(b.right - t0.left) }
        })
        const checks = [...el.querySelectorAll('.q-check')].map(c => {
          const b = c.getBoundingClientRect()
          return { txt: (c.innerText || '').replace(/\\s+/g, ''), x0: px(b.left - t0.left), x1: px(b.right - t0.left) }
        })
        const ta = el.querySelector('.el-textarea__inner, .as-ro-text')
        return { i, cls: (el.className || '').split(' ').slice(0, 3).join('.'), h: px(r.height), y: px(r.top + scrollY),
                 vmb: el.querySelector('.q-vlabel') ? getComputedStyle(el.querySelector('.q-vlabel')).marginBottom : '',
                 cells, pairs, checks,
                 fill: ta ? { h: px(ta.getBoundingClientRect().height) } : null }
      })
      return { sheetW: px(t0.width), tableW: px(t0.width), rows,
               strip: (() => {  // 竖排列(申请单位)合并格的整块矩形(页面绝对坐标,供像素核查)
                 const vs = [...table.querySelectorAll('.q-vlabel')]
                 if (!vs.length) return null
                 const a = vs[0].getBoundingClientRect(), b = vs[vs.length - 1].getBoundingClientRect()
                 return { x0: px(a.left + scrollX), x1: px(a.right + scrollX),
                          y0: px(a.top + scrollY), y1: px(b.bottom + scrollY), dpr: devicePixelRatio }
               })(),
               vchars: [...table.querySelectorAll('.q-vchar')].map(c => {
                 const b = c.getBoundingClientRect()
                 return { ch: c.innerText, y0: px(b.top + scrollY), y1: px(b.bottom + scrollY) }
               }),
               editState: { 编辑框: sheet.querySelectorAll('.el-textarea__inner').length,
                            只读块: sheet.querySelectorAll('.as-ro-text').length } }
    })()`)
    // 截图前再清一次弹窗:进编辑态后「MES 初始化配置」等浮层可能再冒出来,把整页压暗 → 像素核查会失真
    for (let t = 0; t < 3; t++) {
      const st = await evaluate(`(() => {
        const wz = document.querySelector('.wizard-mask')
        if (wz) {
          const c = wz.querySelector('.wz-close') || wz.querySelector('.wz-skip')
          if (c) { c.click(); return 'DISMISSED:wizard' }
        }
        const ov = [...document.querySelectorAll('.el-overlay')]
          .filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 50)
        if (!ov.length) return 'CLEAR'
        const d = ov.find(e => /初始化配置|行业细分|下次再说/.test(e.innerText || ''))
        const b = [...(d || ov[0]).querySelectorAll('button, .el-button')]
          .find(e => /下次再说|关闭|取消/.test((e.innerText || '').trim()))
        if (b) { b.click(); return 'DISMISSED' }
        return 'STUCK:' + ov.map(e => (e.className || '').toString().slice(0, 40) + ' | ' +
          (e.innerText || '').replace(/\s+/g, ' ').slice(0, 60) + ' | 按钮:' +
          [...e.querySelectorAll('button')].map(x => (x.innerText || '').trim()).join('/')).join(' ## ')
      })()`)
      if (st === 'CLEAR') break
      if (st.startsWith('STUCK')) console.log('  (弹窗未关掉:', st.slice(0, 160) + ')')
      await sleep(1500)
    }
    await sleep(800)
    // 视口内直接截(窗口已加高到能装下整页)。曾用 captureBeyondViewport,某些跑法会整张黑图
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (shot.result?.data) fs.writeFileSync('tools/archive/_tc-in-render.png', Buffer.from(shot.result.data, 'base64'))

    console.log(`=== 新增(编辑态)入口: ${editClicked} ===`)
    if (geom.err) { console.log('渲染失败:', geom.err); ws.close(); return }
    console.log(`=== 表宽 ${geom.tableW}px,共 ${geom.rows.length} 行  编辑态=${JSON.stringify(geom.editState)} ===`)
    const all = new Set()
    for (const r of geom.rows) for (const c of r.cells) { all.add(c.x0); all.add(c.x1) }
    for (const r of geom.rows) for (const c of r.pairs) { all.add(c.x0); all.add(c.x1) }
    const grid = [...all].sort((a, b) => a - b)
    console.log('全局竖线(全表所有边界,应恰好是这些位置):', grid.join(' | '))

    console.log('\n=== 逐行 ===')
    let bad = 0
    for (const r of geom.rows) {
      const b = new Set()
      for (const c of r.cells) { b.add(c.x0); b.add(c.x1) }
      for (const c of r.pairs) { b.add(c.x0); b.add(c.x1) }
      const off = [...b].filter(x => !grid.some(g => Math.abs(g - x) <= 1.5))
      if (off.length) bad++
      const parts = r.cells.map(c => `${c.cls}"${c.txt}"[${c.x0}..${c.x1}]`).join(' ')
      console.log(`  #${String(r.i).padStart(2)} y=${String(r.y).padStart(4)} h=${String(r.h).padStart(5)} ${r.cls}${r.vmb ? ' vlabel.mb=' + r.vmb : ''}`)
      console.log(`       格: ${parts || '(无标签格)'}${r.fill ? `  填写区高=${r.fill.h}` : ''}`)
      console.log(`       对: ${r.pairs.map(p => `[${p.x0}..${p.x1}]`).join(' ')}`)
      if (r.checks.length) console.log(`       勾: ${r.checks.map(c => `${c.txt}@${c.x0}-${c.x1}`).join(' ')}`)
      if (off.length) console.log(`       ⚠ 错位: ${off.join(', ')}`)
    }
    const real = errors.filter(e => !/favicon|WebSocket connection|vite/.test(e))
    // 像素核查:竖排列(申请单位)是合并格,内部不得再有横线(原扫描图实测:行间横线覆盖率 78.4%,只到列右沿)
    if (geom.strip && geom.vchars?.length) {
      const gc = (geom.vchars[0].y0 + geom.vchars[geom.vchars.length - 1].y1) / 2
      const sc = (geom.strip.y0 + geom.strip.y1) / 2
      console.log(`竖列字组「${geom.vchars.map(v => v.ch).join('')}」中心=${gc.toFixed(1)}  列中心=${sc.toFixed(1)}  偏差=${(gc - sc).toFixed(1)}px(应≈0)`)
    }
    let seams = -1
    if (geom.strip && shot.result?.data) {
      // 遮挡诊断:竖列中心点上最顶层是哪个元素、什么背景
      const cover = await evaluate(`(() => {
        const cx = ${geom.strip.x0 + (geom.strip.x1 - geom.strip.x0) / 2}, cy = ${geom.strip.y0 + 20}
        const e = document.elementFromPoint(cx - scrollX, cy - scrollY)
        if (!e) return 'none'
        const cs = getComputedStyle(e)
        return e.tagName + '.' + (e.className || '').toString().slice(0, 50) + ' bg=' + cs.backgroundColor +
               ' opacity=' + cs.opacity + ' z=' + cs.zIndex + ' pos=' + cs.position
      })()`)
      console.log('竖列顶点元素:', cover)
    }
    if (geom.strip && shot.result?.data)
      seams = seamCount(Buffer.from(shot.result.data, 'base64'), geom.strip, geom.strip.dpr || 1)
    const seamTxt = seams === -2 ? 'n/a(截图被浮层遮挡)' : seams
    console.log(`竖排列合并格 x ${geom.strip ? geom.strip.x0 + '..' + geom.strip.x1 : '-'}  内部横线=${seamTxt} 条(应为 0)`)
    console.log(`\n=== 结论 === 错位行数=${bad}  竖列内横线=${seamTxt}  console 报错=${real.length}`)
    real.forEach(e => console.log('   ', e))
    console.log('截图: tools/archive/_tc-in-render.png')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch(e => { console.error(e); process.exit(1) })

/* seamCount(pngBuf, strip, dpr) — 解码截图 PNG(自带 zlib,五种 filter 反滤波),在竖排列矩形
   [x0+3..x1-3] × [y0+3..y1-3] 内数「暗像素占比 ≥80% 的 y 行」(字符笔画只占 ~20%,不会误报)。
   返回内部横线条数;列顶/底的边界线在矩形之外,不计入。PNG 不支持时返回 -1。 */
function seamCount(buf, r, dpr) {
  let pos = 8, W = 0, H = 0, bd = 0, ct = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); bd = data[8]; ct = data[9] }
    if (type === 'IDAT') idat.push(data)
    pos += 12 + len
  }
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct]
  if (!bpp || bd !== 8) return -1
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = W * bpp
  const img = Buffer.alloc(H * stride)
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1) + 1)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? img[y * stride + x - bpp] : 0
      const b = y > 0 ? img[(y - 1) * stride + x] : 0
      const c = (x >= bpp && y > 0) ? img[(y - 1) * stride + x - bpp] : 0
      let v = line[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
      } else if (f !== 0) return -1
      img[y * stride + x] = v & 0xff
    }
  }
  const X0 = Math.round((r.x0 + 3) * dpr), X1 = Math.round((r.x1 - 3) * dpr)
  const Y0 = Math.round((r.y0 + 3) * dpr), Y1 = Math.round((r.y1 - 3) * dpr)
  if (X0 < 0 || Y0 < 0 || X1 >= W || Y1 >= H || X1 - X0 < 10 || Y1 - Y0 < 10) return -1
  const gray = (x, y) => { const i = y * stride + x * bpp; return (img[i] + img[i + 1] + img[i + 2]) / 3 }
  // 整块区域近半都是暗的 = 截图被浮层压暗,量出的"横线"不可信 → 返回 -2 让上层报「被遮挡」
  let darkAll = 0
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (gray(x, y) < 170) darkAll++
  if (darkAll / ((Y1 - Y0 + 1) * (X1 - X0 + 1)) > 0.4) return -2
  let lines = 0, prev = -9, ys = []
  for (let y = Y0; y <= Y1; y++) {
    let n = 0
    for (let x = X0; x <= X1; x++) if (gray(x, y) < 170) n++
    if (n / (X1 - X0 + 1) < 0.8) continue
    if (y - prev > 2) { lines++; ys.push(y) }   // 相邻的并作一条
    prev = y
  }
  if (ys.length) console.log('  ⚠ 竖列内横线 y:', ys.join(', '))
  return lines
}
