/**
 * _probe-qc-link.cjs —— 质量单据「关联单号」参照 + 带入数据 UI 取证(2026-11-01)
 *
 * 需求(用户口径):「不合格报告(制程)要关联制程检验单,不合格品处理单(制程)要关联不合格报告(制程),
 *   不合格品处理单(自制物料)先不管」「不需要自动生单,能实现关联对应的单号然后带入数据即可」。
 *
 * 本探针在**测试账套**(login factory=YJ_TEST)上跑,用 _qc-link-20261101/seed.sql 造的三张草稿:
 *   ZC-TEST-0001(制程检验单) / BHG-TEST-0001(不合格报告) / BHC-TEST-0001(不合格品处理单(制程))。
 *
 * 验什么:
 *   ① 制程检验单号参照弹窗能列出**未审核**的候选(证明 refAllStatus 跳过了「单据状态=已审核」过滤;
 *      该列对纸面单据是历史遗留列,若还过滤,测试造的草稿一条都出不来);
 *   ② 选中后带入:检验工站←工序 / 异常产品规格←规格型号 / 异常时间←单据日期 / 客户名称 / 产品名称,
 *      且本单「文档编号」仍是 YJ-QR-11(未被来源单覆盖);
 *   ③ 不合格报告单号参照 → 选 BHG-TEST-0001 后带入:产品规格←异常产品规格 / 问题描述←异常描述 /
 *      客户名称 / 产品名称 / 不合格品数量 / 原因分析,且本单「文档编号」仍是 YJ-QR-59。
 *
 * 用法(仓库根目录):
 *   node tools/archive/_qc-link-20261101/_probe-qc-link.cjs
 *   可选环境变量:PROBE_BASE(默认 http://127.0.0.1:5173)、CDP_PORT(默认 9361)
 * 截图:tools/archive/_qc-link-20261101/shot-*.png
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const WebSocket = require('ws')

const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:5173'
const OUT = __dirname
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail })
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (detail === undefined ? '' : ' → ' + JSON.stringify(detail)))
}

async function main() {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = login?.data?.token
  const user = login?.data?.user
  if (!token) throw new Error('登录失败:' + JSON.stringify(login).slice(0, 300))
  console.log('[login] factory=YJ_TEST user=' + (user?.realName || user?.userName))

  const PORT = process.env.CDP_PORT ? Number(process.env.CDP_PORT) : 9361
  let edge = null
  let profileDir = null
  if (!process.env.CDP_PORT) {
    profileDir = path.join(path.resolve(__dirname, '..', '..', '..'), '.tmp', 'yj-qclink-' + Date.now())
    fs.mkdirSync(profileDir, { recursive: true })
    edge = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
      '--disable-crash-reporter', '--window-size=1500,1000',
      `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' })
  }

  try {
    let tab = null
    for (let i = 0; i < 40; i++) {
      try {
        tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
        if (tab && tab.webSocketDebuggerUrl) break
      } catch { /* 端口未 ready */ }
      await sleep(500)
    }
    if (!tab || !tab.webSocketDebuggerUrl) throw new Error('CDP 端口未就绪')

    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      // 整页导航触发的原生 beforeunload 确认框:直接接受(本探针不保存任何数据)
      if (m.method === 'Page.javascriptDialogOpening') {
        ws.send(JSON.stringify({ id: ++seq, method: 'Page.handleJavaScriptDialog', params: { accept: true } }))
        return
      }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) throw new Error('evaluate: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
      return r.result?.result?.value
    }
    const shot = async (suffix) => {
      const r = await send('Page.captureScreenshot', { format: 'png' })
      const f = path.join(OUT, 'shot-' + suffix + '.png')
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 100; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(2500); return } }
    }
    await send('Page.enable'); await send('Runtime.enable')

    // ── 登录态注入 ──
    await navigate(BASE + '/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); localStorage.setItem('mes_locale', 'zh'); 'ok'`)
    // ⚠ 必须整页重载一次:上面的写法只改 localStorage,而 app 的 user store 在**首屏加载时**就初始化了
    //   (那时还没 token);若紧接着只做 hash 跳转(同文档),路由守卫仍按"未登录"把页面送回 /login。
    //   经 about:blank 再进 → 新文档、store 重新读 token。
    await navigate('about:blank')

    // 纸面「标签→值」读取器(值可能是 input,也可能是参照格文本)
    const READ_VALUES = `(() => {
      const out = {};
      for (const pair of document.querySelectorAll('.q-pair')) {
        const lab = (pair.querySelector('.q-label')?.textContent || '').trim();
        if (!lab) continue;
        const valBox = pair.querySelector('.q-value');
        const inp = valBox?.querySelector('input,textarea');
        out[lab] = inp ? String(inp.value ?? '') : String(valBox?.innerText || '').trim();
      }
      // 章节行(一.问题描述 / 二.原因分析 …):值在多行文本框里,标题带序号需用 includes 匹配
      for (const sec of document.querySelectorAll('.q-section')) {
        const lab = (sec.querySelector('.q-section-title')?.textContent || '').trim();
        if (!lab) continue;
        const ta = sec.querySelector('textarea');
        out[lab] = ta ? String(ta.value ?? '') : String(sec.querySelector('.as-ro-text')?.innerText || '').trim();
      }
      const top = document.querySelector('.as-docno input');
      out['__文档编号'] = top ? String(top.value || '') : String(document.querySelector('.as-docno')?.innerText || '').trim();
      return out;
    })()`
    /** 按「标签包含」取值(章节行标题带「一．」序号,不能精确匹配) */
    const pickVal = (obj, part) => {
      const hit = Object.entries(obj).find(([k]) => k.includes(part))
      return hit ? hit[1] : undefined
    }

    /** 在左栏点选指定单号 */
    const pickRail = (docNo) => evaluate(`(() => {
      const els = [...document.querySelectorAll('*')].filter(e => {
        if (e.children.length) return false;
        return (e.textContent || '').trim() === ${JSON.stringify(docNo)};
      });
      for (const e of els) {
        let tr = e.closest('tr');
        if (!tr) { let p = e; for (let i = 0; i < 6 && p; i++) { p = p.parentElement; if (p && p.tagName === 'TR') { tr = p; break } } }
        if (tr) { tr.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'clicked:' + ${JSON.stringify(docNo)}; }
      }
      return 'not-found:' + ${JSON.stringify(docNo)};
    })()`)

    /** 点开纸面某标签格的参照控件 */
    const openRefCell = (label) => evaluate(`(() => {
      const pairs = [...document.querySelectorAll('.q-pair')];
      const want = ${JSON.stringify(label)};
      for (const pair of pairs) {
        const lab = (pair.querySelector('.q-label')?.textContent || '').trim();
        if (lab !== want) continue;
        const ctl = pair.querySelector('.as-ref-ctl');
        if (!ctl) return 'no-ref-ctl:' + want;
        ctl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'clicked:' + want;
      }
      return 'label-not-found:' + want;
    })()`)

    /** 读参照弹窗:标题/列/行文本 */
    const readDialog = () => evaluate(`(() => {
      const root = document.querySelector('.rpd');
      if (!root) return { found: false };
      const box = root.closest('.el-dialog') || root;
      const title = ((box.querySelector('.el-dialog__title') || {}).textContent || '').trim();
      const cols = [...root.querySelectorAll('.el-table__header th .cell')].map(e => e.textContent.trim()).filter(Boolean);
      const rows = [...root.querySelectorAll('.el-table__body tbody tr')].map(tr => [...tr.querySelectorAll('td .cell')].map(e => e.textContent.trim()));
      return { found: true, title, cols, rowCount: rows.length, rows: rows.slice(0, 400) };
    })()`)

    /** 参照弹窗某行的勾选框中心坐标(用于 CDP 真鼠标点击:el-table 的选择框是隐藏 input,
     *  程序化 .click() 不触发 Element Plus 的 selection-change) */
    const rowCheckboxPoint = (docNo) => evaluate(`(() => {
      const root = document.querySelector('.rpd');
      if (!root) return null;
      const rows = [...root.querySelectorAll('.el-table__body tbody tr')];
      for (const tr of rows) {
        if (!(tr.textContent || '').includes(${JSON.stringify(docNo)})) continue;
        const box = tr.querySelector('.el-checkbox') || tr.querySelector('td');
        if (!box) return null;
        const r = box.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    })()`)
    /** CDP 真鼠标单击(坐标 = CSS px,相对视口) */
    const clickAt = async (pt) => {
      if (!pt) return false
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 })
      return true
    }
    /** 勾选弹窗里指定单号的行 + 读底部确定按钮状态 */
    const pickDialogRow = async (docNo) => {
      const pt = await rowCheckboxPoint(docNo)
      if (!pt) return 'row-not-found:' + docNo
      await clickAt(pt)
      await sleep(600)
      const st = await evaluate(`(() => {
        const btns = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')];
        const b = btns.find(x => (x.textContent || '').includes('确定导入'));
        return b ? { label: b.textContent.trim(), disabled: !!b.disabled } : null;
      })()`)
      return 'picked:' + docNo + ' ' + JSON.stringify(st)
    }
    /** 点弹窗底部「确定导入」(未勾中时按钮 disabled,点了不生效 ⇒ 先报出来) */
    const confirmDialog = () => evaluate(`(() => {
      const btns = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')];
      const b = btns.find(x => (x.textContent || '').includes('确定导入'));
      if (!b) return 'no-confirm-btn';
      if (b.disabled) return 'confirm-disabled';
      b.click();
      return 'confirmed';
    })()`)

    // ══════════ ① 不合格报告(制程) → 制程检验单 ══════════
    await navigate(BASE + '/#/panelx/list/QC_BHG')
    await sleep(2500)
    console.log('[BHG] rail pick =', await pickRail('BHG-TEST-0001'))
    await sleep(2500)
    console.log('[BHG] openRef =', await openRefCell('制程检验单号'))
    await sleep(3000)
    const dlg1 = await readDialog()
    console.log('[BHG] 弹窗 =', JSON.stringify({ found: dlg1.found, title: dlg1.title, cols: dlg1.cols, rowCount: dlg1.rowCount }))
    console.log('[BHG] 截图 =', await shot('bhg-1-dialog'))
    const hasDraftCandidate = dlg1.found && (dlg1.rows || []).some(r => r.some(c => c.includes('ZC-TEST-0001')))
    check('BHG 参照弹窗列出未审核候选 ZC-TEST-0001(未被「已审核」过滤掉)', hasDraftCandidate, { rowCount: dlg1.rowCount })
    check('BHG 参照弹窗有可认单的列(编号+总结论)', (dlg1.cols || []).includes('单据编号') && (dlg1.cols || []).includes('总结论') && dlg1.cols.length >= 6, dlg1.cols)
    if (!hasDraftCandidate) throw new Error('候选里没有 ZC-TEST-0001,后续带入无法验证')
    console.log('[BHG] pick =', await pickDialogRow('ZC-TEST-0001'))
    await sleep(800)
    console.log('[BHG] confirm =', await confirmDialog())
    await sleep(1500)
    console.log('[BHG] 弹窗已关 =', !(await evaluate(`!!document.querySelector('.rpd')`)))
    await sleep(1500)
    const v1 = await evaluate(READ_VALUES)
    console.log('[BHG] 纸面值 =', JSON.stringify(v1))
    console.log('[BHG] 截图 =', await shot('bhg-2-filled'))
    check('BHG 制程检验单号 = ZC-TEST-0001', v1['制程检验单号'] === 'ZC-TEST-0001', v1['制程检验单号'])
    check('BHG 检验工站←工序 = 成型', v1['检验工站'] === '成型', v1['检验工站'])
    check('BHG 异常产品规格←规格型号 = 33*12*110', v1['异常产品规格'] === '33*12*110', v1['异常产品规格'])
    check('BHG 异常时间←单据日期 = 2026-11-01', v1['异常时间'] === '2026-11-01', v1['异常时间'])
    check('BHG 客户名称←客户名称 = 测试客户甲', v1['客户'] === '测试客户甲' || v1['客户名称'] === '测试客户甲', v1['客户'] || v1['客户名称'])
    check('BHG 产品名称←产品名称 = 测试产品甲', v1['产品名称'] === '测试产品甲', v1['产品名称'])
    check('BHG 文档编号未被来源单覆盖(YJ-QR-11)', String(v1['__文档编号']).includes('YJ-QR-11'), v1['__文档编号'])

    // ══════════ ② 不合格品处理单(制程) → 不合格报告(制程) ══════════
    // 先离开当前文档(BHG 纸面有未保存改动):about:blank 触发整页卸载,原生确认框由 CDP 自动接受
    await navigate('about:blank')
    await navigate(BASE + '/#/panelx/list/QC_BHC')
    await sleep(3000)
    console.log('[BHC] rail pick =', await pickRail('BHC-TEST-0001'))
    await sleep(2500)
    console.log('[BHC] openRef =', await openRefCell('不合格报告单号'))
    await sleep(3000)
    const dlg2 = await readDialog()
    console.log('[BHC] 弹窗 =', JSON.stringify({ found: dlg2.found, title: dlg2.title, cols: dlg2.cols, rowCount: dlg2.rowCount }))
    console.log('[BHC] 截图 =', await shot('bhc-1-dialog'))
    const hasReport = dlg2.found && (dlg2.rows || []).some(r => r.some(c => c.includes('BHG-TEST-0001')))
    check('BHC 参照弹窗列出候选 BHG-TEST-0001', hasReport, { rowCount: dlg2.rowCount })
    if (!hasReport) throw new Error('候选里没有 BHG-TEST-0001,后续带入无法验证')
    console.log('[BHC] pick =', await pickDialogRow('BHG-TEST-0001'))
    await sleep(800)
    console.log('[BHC] confirm =', await confirmDialog())
    await sleep(1500)
    console.log('[BHC] 弹窗已关 =', !(await evaluate(`!!document.querySelector('.rpd')`)))
    await sleep(1500)
    const v2 = await evaluate(READ_VALUES)
    console.log('[BHC] 纸面值 =', JSON.stringify(v2))
    console.log('[BHC] 截图 =', await shot('bhc-2-filled'))
    check('BHC 不合格报告单号 = BHG-TEST-0001', v2['不合格报告单号'] === 'BHG-TEST-0001', v2['不合格报告单号'])
    check('BHC 客户名称 = 测试客户甲', v2['客户名称'] === '测试客户甲', v2['客户名称'])
    check('BHC 产品名称 = 测试产品甲', v2['产品名称'] === '测试产品甲', v2['产品名称'])
    check('BHC 不合格品数量 = 3', String(v2['不合格品数量']).startsWith('3'), v2['不合格品数量'])
    check('BHC 产品规格←异常产品规格 = 33*12*110', v2['产品规格'] === '33*12*110', v2['产品规格'])
    check('BHC 问题描述←异常描述', String(pickVal(v2, '问题描述') || '').includes('测试异常描述'), pickVal(v2, '问题描述'))
    check('BHC 原因分析←原因分析', String(pickVal(v2, '原因分析') || '').includes('测试原因分析'), pickVal(v2, '原因分析'))
    check('BHC 文档编号未被来源单覆盖(YJ-QR-59)', String(v2['__文档编号']).includes('YJ-QR-59'), v2['__文档编号'])

    ws.close()
  } finally {
    if (edge) edge.kill()
    if (profileDir) { try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch { /* ignore */ } }
  }

  const failed = results.filter(r => !r.ok)
  console.log('')
  console.log('RESULT:', failed.length ? 'FAIL' : 'PASS', `(${results.length - failed.length}/${results.length})`)
  if (failed.length) { console.log('FAILED:', JSON.stringify(failed, null, 1)); process.exit(1) }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
