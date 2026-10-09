/*
 * _verify-wo-trace-qc-ui.cjs — 工单追溯「质检段」界面实测(2026-10-14,一次性探针)
 *
 * 链路:登录 → 生产工单页 → 模糊搜索 GD-2026-10-0002 → 点工单号开追溯 → 断言「质检数据」段渲染
 *       (块标题 + 7 行明细含组装成品检验单 ZJ-2026-10-0006 + 应检/已检/缺检汇总),并截图留证。
 *
 * 用法:
 *   node tools/archive/_verify-wo-trace-qc-ui.cjs                          # 默认 http://127.0.0.1:8091
 *   node tools/archive/_verify-wo-trace-qc-ui.cjs http://127.0.0.1:8091
 *
 * 只读:仅查询与截图,不点任何写操作按钮。
 * 注:与 tools/verify/*.cjs 同款 CDP 手法(Edge headless + 独立 user-data-dir);本探针为该任务的
 *     一次性产物,故放 archive/。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')

const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const LOCALE = process.argv[3] || 'zh-CN'          // en = 顺带验收多语言(AGENTS 硬规范:切英语要显示英文)
const PORT = 9452
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const WO = 'GD-2026-10-0002'
const SHOT = path.join(__dirname, '_shot-wo-trace-qc.png')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  if (!login.data?.token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200))
  const token = login.data.token, user = JSON.stringify(login.data.user)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-trace-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)

  let pass = 0, fail = 0
  const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

    // ── 会话准备(注入 token 后必须经 about:blank 再真加载)──────────────────────
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale',${JSON.stringify(LOCALE)}); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Page.navigate', { url: `${BASE}/#/prod/plan/workOrderList` }); await sleep(5000)

    const rowCount = () => evaluate(`document.querySelectorAll('.wol-table .el-table__row').length`)
    ok('生产工单列表已渲染', (await rowCount()) > 0, `${await rowCount()} 行`)

    // ── 模糊搜索定位工单(选择器保持语言无关:排除日期控件的输入框 + 查询行首个按钮)──
    const typed = await evaluate(`(()=>{const i=[...document.querySelectorAll('.wol-query input')].filter(x=>!x.closest('.el-date-editor'))[0];if(!i)return 'NO_INPUT';i.value=${JSON.stringify(WO)};i.dispatchEvent(new Event('input',{bubbles:true}));return 'OK'})()`)
    ok('填入模糊搜索条件', typed === 'OK', typed)
    const clicked = await evaluate(`(()=>{const b=document.querySelector('.wol-query button');if(!b)return 'NO_BTN';b.click();return 'OK'})()`)
    ok('点「查找」', clicked === 'OK', clicked)
    await sleep(2500)

    const hasWo = await evaluate(`(()=>{const l=[...document.querySelectorAll('.wol-table .el-link')].find(x=>(x.textContent||'').trim()===${JSON.stringify(WO)});return !!l})()`)
    ok(`列表出现工单 ${WO}`, hasWo === true)

    // ── 点工单号开追溯 ────────────────────────────────────────────────────────
    const opened = await evaluate(`(()=>{const l=[...document.querySelectorAll('.wol-table .el-link')].find(x=>(x.textContent||'').trim()===${JSON.stringify(WO)});if(!l)return 'NO_LINK';l.click();return 'OK'})()`)
    ok('点工单号打开追溯弹窗', opened === 'OK', opened)

    // 弹窗定位不靠标题文案(英文界面标题可能未收录),靠追溯弹窗自己的 .wb-trace-head
    const dlgReady = async () => evaluate(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.querySelector('.wb-trace-head'));if(!d)return false;const r=d.getBoundingClientRect();return r.height>0&&r.width>0})()`)
    let up = false
    for (let i = 0; i < 25 && !up; i++) { up = (await dlgReady()) === true; if (!up) await sleep(300) }
    ok('追溯弹窗已打开', up)

    // 等 trace 数据回来(质检段渲染出来)
    const qcReady = async () => evaluate(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.querySelector('.wb-trace-head'));return !!d && !!d.querySelector('.wb-block-title') && /${LOCALE === 'en' ? 'QC Data' : '质检数据'}/.test(d.innerText||'')})()`)
    let qcUp = false
    for (let i = 0; i < 30 && !qcUp; i++) { qcUp = (await qcReady()) === true; if (!qcUp) await sleep(300) }
    ok(`弹窗内出现「${LOCALE === 'en' ? 'QC Data' : '质检数据'}」段`, qcUp)

    const qcInfo = await evaluate(`(()=>{
      const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.querySelector('.wb-trace-head'));
      if(!d) return null;
      const blocks=[...d.querySelectorAll('.wb-trace-block')];
      const b=blocks.find(x=>/${LOCALE === 'en' ? 'QC Data' : '质检数据'}/.test((x.querySelector('.wb-block-title')||{}).innerText||''));
      if(!b) return null;
      const title=(b.querySelector('.wb-block-title')||{}).innerText||'';
      const rows=[...b.querySelectorAll('.el-table__body-wrapper tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>(td.innerText||'').trim()));
      const heads=[...b.querySelectorAll('.el-table__header-wrapper th')].map(th=>(th.innerText||'').trim()).filter(Boolean);
      const all=(d.innerText||'');
      return { title: title.replace(/\\s+/g,' ').trim(), rows, heads, all };
    })()`)
    ok('取到质检段内容', !!qcInfo, qcInfo ? '' : 'null')
    if (qcInfo) {
      console.log('    [标题] ' + qcInfo.title)
      console.log('    [列头] ' + JSON.stringify(qcInfo.heads))
      console.log('    [明细] ' + qcInfo.rows.length + ' 行;首行=' + JSON.stringify(qcInfo.rows[0] || []))
      ok('明细 7 行(与接口一致)', qcInfo.rows.length === 7, String(qcInfo.rows.length))
      ok('含组装成品检验单 ZJ-2026-10-0006', qcInfo.rows.some((r) => r.includes('ZJ-2026-10-0006')))
      if (LOCALE === 'en') {
        // 多语言硬规范验收:切英文后新功能的标题/汇总/列头必须是英文
        ok('汇总标签=英文(Required/Inspected/Missing Ops)', /Required Ops/.test(qcInfo.title) && /Inspected Ops/.test(qcInfo.title) && /Missing Ops/.test(qcInfo.title), qcInfo.title)
        ok('工序名译出英文(Molding / Carbon Cutting / Assembly)', /Molding/.test(qcInfo.title) && /Carbon Cutting/.test(qcInfo.title) && /Assembly/.test(qcInfo.title), qcInfo.title)
        ok('列头=英文', ['Inspection Sheet No.', 'Inspected Qty', 'Passed Qty', 'Failed Qty', 'Downstream Doc No.'].every((k) => qcInfo.heads.includes(k)), JSON.stringify(qcInfo.heads))
        ok('段标题=QC Data', /QC Data/.test(qcInfo.title), qcInfo.title)
      } else {
        ok('汇总显示 应检=成型/切炭/组装', /应检工序[:：]\s*成型\s*\/\s*切炭\s*\/\s*组装/.test(qcInfo.title), qcInfo.title)
        ok('汇总显示 已检 含组装', /已检工序[:：][^｜]*组装/.test(qcInfo.title), qcInfo.title)
        ok('汇总显示 缺检工序: -', /缺检工序[:：]\s*-/.test(qcInfo.title), qcInfo.title)
        ok('列头含 检验单号/送检数量/合格数量/下游单号', ['检验单号', '送检数量', '合格数量', '不合格数量', '下游单号', '批次号', '报工单号'].every((k) => qcInfo.heads.includes(k)), JSON.stringify(qcInfo.heads))
      }
    }

    // ── 截图留证(把质检段滚入视口 —— 弹窗体/页体谁在滚都能兜住)──────────────────
    await evaluate(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.querySelector('.wb-trace-head'));
      const b=[...d.querySelectorAll('.wb-trace-block')].find(x=>/${LOCALE === 'en' ? 'QC Data' : '质检数据'}/.test((x.querySelector('.wb-block-title')||{}).innerText||''));
      if(b) b.scrollIntoView({block:'end',behavior:'instant'}); return 'ok'})()`)
    await sleep(700)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const out = LOCALE === 'en' ? SHOT.replace(/\.png$/, '-en.png') : SHOT
    if (shot?.result?.data) { fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64')); console.log('    [截图] ' + out) }
  } finally {
    try { edge.kill() } catch {}
  }
  console.log(`\n[结果] pass=${pass} fail=${fail}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('探针异常: ' + e.message); process.exit(1) })
