/* _v-tcin-signmeasure.cjs — 特采单(QC_TC_IN)「签名 / 年月日」行的横向占位实测(只读,不改库)
   目的:用户报「编辑态 年月日 与签名 间隔巨大,提交审核后正常」。本探针把同一张单在
        **编辑态**与**只读态**下,签名行每个子元素的 x 边界 / 宽度 / 生效的 CSS 逐条量出来对比,
        直接看出是哪些元素的宽度被放大、哪条规则没生效。
   用法:node tools/archive/_v-tcin-signmeasure.cjs [PANEL=QC_TC_IN] */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9347
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PANEL = process.argv[2] || 'QC_TC_IN'
// 第 3 参:前端基址。默认走 vite dev(5173);验证**部署产物**要传 http://localhost:8090
// (后端从 fat jar 内嵌 static 提供,改前端源码必须重新 mvn package 才会生效)
const BASE = (process.argv[3] || 'http://localhost:5173').replace(/\/$/, '')
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const login = await (await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sign-'))
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
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(700); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    // 量「签名/年月日」行的通用取数:逐个直接子节点(含文本节点)量位置,并读生效样式
    const MEASURE = `(() => {
      const px = n => Math.round(n * 10) / 10
      const out = []
      for (const sel of ['.q-signline', '.q-dept-signline']) {
        [...document.querySelectorAll(sel)].forEach((row, ri) => {
          const rb = row.getBoundingClientRect()
          const kids = []
          for (const n of row.childNodes) {
            if (n.nodeType === 3) {
              const t = n.textContent.replace(/\\s+/g, '')
              if (!t) continue
              const r = document.createRange(); r.selectNodeContents(n)
              const b = r.getBoundingClientRect()
              kids.push({ kind: 'text', txt: t.slice(0, 12), w: px(b.width),
                          gapBefore: px(b.left - rb.left) })
              continue
            }
            if (n.nodeType !== 1) continue
            const b = n.getBoundingClientRect()
            const cs = getComputedStyle(n)
            kids.push({ kind: 'el', cls: (n.className || '').toString().slice(0, 60),
                        w: px(b.width), flex: cs.flex, cssWidth: cs.width, maxW: cs.maxWidth,
                        ver: cs.visibility })
          }
          // 这一行里 el-input 内部的真实输入宽度(排除 wrapper 欺骗)
          const inners = [...row.querySelectorAll('.el-input__inner')].map(e => px(e.getBoundingClientRect().width))
          out.push({ sel, ri, rowW: px(rb.width), justify: getComputedStyle(row).justifyContent,
                     gap: getComputedStyle(row).gap, kids, innerW: inners })
        })
      }
      return out
    })()`

    const dump = (label, rows) => {
      console.log('\n===== ' + label + ' =====')
      if (!rows.length) { console.log('  (没有签名行)'); return }
      for (const r of rows) {
        console.log(`  ${r.sel}[${r.ri}]  行宽=${r.rowW}  justify=${r.justify} gap=${r.gap}`)
        for (const k of r.kids) {
          const desc = k.kind === 'text'
            ? `[文本] "${k.txt}"  宽=${k.w}`
            : `[元素] ${k.cls}  宽=${k.w}  flex=${k.flex}  cssWidth=${k.cssWidth}`
          console.log('      ' + desc)
        }
        console.log('      内部 .el-input__inner 宽度: ' + JSON.stringify(r.innerW))
      }
    }

    await navigate(`${BASE}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/${PANEL}`)
    await sleep(3500)
    await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) { const c = wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'); if (c) { c.click(); return 1 } } return 0 })()`)
    await sleep(1200)

    // ── ⓪ 草稿态(打开面板即渲染的那一张,输入框已可填):用户报的「还是一样」指的就是它。
    //        先量这一态,再去翻页找已审核单对比。
    dump('草稿态(打开即渲染)', await evaluate(MEASURE))

    // ── ① 只读态:必须量到**已审核**单据那一态 —— 用户说「提交审核后分布就正常」指的就是它。
    //        特采单没有单据列表表格,翻页器是右侧 `.as-side-pager` 的 ◁ ◀ ▶ ▷ + 「第 N/M」。
    //        草稿单渲染成编辑态(输入框),已审核单才是只读 —— 所以逐页翻、看 `.doc-status` 文本,
    //        停在「已审核」那一页再量。
    const curDoc = `(() => {
      const s = document.querySelector('.doc-status')
      const no = document.querySelector('.as-docno')
      return { status: s ? s.innerText.trim() : '', no: no ? no.innerText.trim() : '',
               editable: !!document.querySelector('.approval-sheet .el-textarea__inner') }
    })()`
    console.log('  当前单: ' + JSON.stringify(await evaluate(curDoc)))
    let roRows = null
    for (let i = 0; i < 20 && !roRows; i++) {
      const st = await evaluate(curDoc)
      console.log(`   第 ${i + 1} 次看: ${st.no || '(空)'} / ${st.status || '(无状态)'} / 编辑态=${st.editable}`)
      if (!st.editable && /已审核|已审批|审核中|审批中/.test(st.status)) {
        roRows = await evaluate(MEASURE)
        break
      }
      // 点 ▶(下一个):pager 里第 3 个按钮
      const moved = await evaluate(`(() => {
        const bs = document.querySelectorAll('.as-side-pager .page-btn')
        if (bs.length < 3) return false
        bs[2].click(); return true
      })()`)
      if (!moved) { console.log('   (翻页器不存在,停止)'); break }
      await sleep(2200)
    }
    if (!roRows) console.log('  ⚠ 没翻到只读单,只读态数据缺失(下面编辑态数据仍有效)')
    dump(roRows ? '只读态(已审核单)' : '只读态:未取得', roRows || [])

    // ── ② 编辑态:点「新增」让填写区渲染成输入框(不保存,不落库)
    await evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增'); if (b) b.click(); return !!b })()`)
    for (let i = 0; i < 10; i++) { await sleep(1800); if (await evaluate(`!!document.querySelector('.el-textarea__inner')`)) break }
    await sleep(1500)
    const edRows = await evaluate(MEASURE)
    dump('编辑态(新增后)', edRows)

    // ── ③ 追根:对 .q-dm 这个元素,列出**所有**样式表里 selectorText 命中它的规则(含来源表),
    //        并打印它自己的属性(看 scoped 的 data-v-* 有没有落上去)
    const trace = await evaluate(`(() => {
      const el = document.querySelector('.q-date-in.q-dm')
      if (!el) return { err: 'NO-EL' }
      const hits = []
      for (const ss of document.styleSheets) {
        let rules; try { rules = ss.cssRules } catch (e) { continue }
        if (!rules) continue
        for (const r of rules) {
          if (!r.selectorText) continue
          let m = false
          try { m = el.matches(r.selectorText) } catch (e) { /* 复杂选择器跳过 */ }
          if (m) hits.push({ sel: r.selectorText.slice(0, 120), css: (r.style.cssText || '').slice(0, 120),
                             href: (ss.href || 'inline').split('/').pop() })
        }
      }
      return { attrs: [...el.attributes].map(a => a.name + '=' + a.value.slice(0, 60)),
               computedW: getComputedStyle(el).width,
               inlineStyle: el.getAttribute('style'), hits }
    })()`)
    console.log('\n===== 追根:谁把 .q-dm 撑到满宽 =====')
    console.log('  元素属性: ' + JSON.stringify(trace.attrs))
    console.log('  计算宽度: ' + trace.computedW + '   行内 style: ' + JSON.stringify(trace.inlineStyle))
    for (const h of trace.hits || []) console.log(`  命中 [${h.href}] ${h.sel}  {${h.css}}`)

    // ── ③ 判定:编辑态 vs 只读态 的签名行总占宽
    const sum = (rows) => (rows || []).map(r => r.kids.reduce((s, k) => s + k.w, 0).toFixed(1))
    console.log(`\n小结: 签名行内容宽 —— 只读态 ${JSON.stringify(sum(roRows))} / 编辑态 ${JSON.stringify(sum(edRows))}`)
    // 判定:编辑态每个签名行都必须"收得进"行宽(改前 月/日 各 732px → 总宽远超行宽 = 用户报的「间隔巨大」)
    let bad = 0
    for (const r of (edRows || [])) {
      const w = r.kids.reduce((s, k) => s + k.w, 0) + (r.kids.length - 1) * parseFloat(r.gap || 0)
      if (w > r.rowW + 1) { bad++; console.log(`  [FAIL] 编辑态 ${r.sel} 内容宽 ${w.toFixed(1)} > 行宽 ${r.rowW}`) }
    }
    console.log(bad ? `❌ ${bad} 个签名行溢出` : '✅ 编辑态所有签名行都收进行宽内')
  } finally {
    try { edge.kill() } catch (e) { /* ignore */ }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
