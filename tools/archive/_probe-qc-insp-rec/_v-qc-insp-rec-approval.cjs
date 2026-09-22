/* _v-qc-insp-rec-approval.cjs — 检验数据记录「审批流程与立项申请完全一致」+ 表尾铺满 核查
   ① 侧栏竖排按钮清单与立项申请(RD_APPROVAL)逐项一致(申请修改/修改记录/删除/打印/导出/保存…)
   ② 表尾「检验结论/处理意见」值格铺满表格宽度(不再右留空白)
   ③ 保存即归档(管理员):新增→填必填→保存 → 单据状态=已归档、纸张转只读、申请修改按钮可用
   用法:node tools/archive/_probe-qc-insp-rec/_v-qc-insp-rec-approval.cjs(需 5173 + 8090 已起) */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9362
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090/api'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) process.exitCode = 1
}

async function apiRows(token, panel) {
  const r = await (await fetch(`${BASE}/px/queryFormDataList`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize: 10, condition: {} }),
  })).json()
  return r?.data?.list || r?.data?.rows || []
}

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-appr-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1338,1750',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const posts = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('/px/callButton') && m.params.request.postData) {
        try { posts.push(JSON.parse(m.params.request.postData).buttonName) } catch { /* ignore */ }
      }
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')

    /** 打开面板并等就绪(sheetSel 出现 + 侧栏有按钮);dev server HMR 抖动 → 重试 */
    const openPanel = async (panel, sheetSel) => {
      for (let a = 1; a <= 5; a++) {
        await navigate('about:blank')
        await navigate(`http://localhost:5173/#/panelx/list/${panel}`)
        await sleep(3500)
        await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
        for (let i = 0; i < 20; i++) {
          const r = await evaluate(`(() => {
            const side = [...document.querySelectorAll('.approval-side .as-side-btn, .approval-side .as-side-del .as-side-btn')].map(e => e.innerText.replace(/\\s/g,''))
            // 就绪 = 纸张在 + 侧栏配置已回(有 保存/新增,否则点不动)
            return (document.querySelector(${JSON.stringify(sheetSel)}) && side.includes('保存') && side.includes('新增')) ? 'READY' : ''
          })()`)
          if (r) return true
          await sleep(800)
        }
        console.log(`   [重试 ${a}/5] ${panel} 未就绪`)
      }
      return false
    }
    const railButtons = () => evaluate(`[...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g,''))`)

    // ① 侧栏按钮:检验数据记录 vs 立项申请
    ok('检验数据记录面板就绪', await openPanel('QC_INSP_REC', '.qc-rec-sheet'))
    const recBtns = await railButtons()
    console.log('   检验数据记录侧栏:', JSON.stringify(recBtns))
    ok('检验数据记录面板就绪', await openPanel('RD_APPROVAL', '.approval-sheet'))
    const apprBtns = await railButtons()
    console.log('   立项申请侧栏  :', JSON.stringify(apprBtns))
    for (const key of ['保存', '删除', '申请修改', '修改记录', '打印', '导出报表', '导出']) {
      ok(`检验数据记录具备「${key}」`, recBtns.includes(key), key)
    }
    const onlyRec = recBtns.filter((b) => !apprBtns.includes(b))
    const onlyAppr = apprBtns.filter((b) => !recBtns.includes(b))
    ok('两侧栏按钮完全一致', onlyRec.length === 0 && onlyAppr.length === 0, `仅检验数据记录有=[${onlyRec}] 仅立项申请有=[${onlyAppr}]`)

    // ② 新建一张检验报告(空单可编辑):按钮比对后停在了立项申请面板 → 先切回本面板
    ok('切回检验数据记录面板', await openPanel('QC_INSP_REC', '.qc-rec-sheet'))
    const existingNos = (await apiRows(token, 'QC_INSP_REC')).map((r) => r['单据编号'])
    await evaluate(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    let freshNo = ''
    for (let i = 0; i < 20 && !freshNo; i++) {
      await sleep(700)
      freshNo = (await apiRows(token, 'QC_INSP_REC')).map((r) => r['单据编号']).find((n) => !existingNos.includes(n)) || ''
    }
    ok('新建一张检验报告', !!freshNo, freshNo)
    await sleep(2500)

    // ── 表尾铺满(在可编辑的新单上量:值格右缘=表格右缘) ──
    const geo = JSON.parse(await evaluate(`(() => {
      const sheet = document.querySelector('.qc-rec-sheet')
      const r = (el) => el ? { x: Math.round(el.getBoundingClientRect().x), w: Math.round(el.getBoundingClientRect().width) } : null
      const foot = sheet.querySelector('.qr-foot-table')
      const label = (t) => [...foot.querySelectorAll('th')].find(e => e.innerText.trim() === t)
      const vcell = (t) => label(t)?.nextElementSibling
      return JSON.stringify({
        table: r(sheet.querySelector('.qr-table')),
        jlCell: r(vcell('检验结论')),
        clCell: r(vcell('处理意见')),
        jlInput: r(vcell('检验结论')?.querySelector('textarea')),
        clInput: r(vcell('处理意见')?.querySelector('textarea')),
      })
    })()`))
    console.log('   几何:', JSON.stringify(geo))
    const tableRight = geo.table.x + geo.table.w
    ok('检验结论值格铺到表格右缘', Math.abs((geo.jlCell.x + geo.jlCell.w) - tableRight) <= 2, `值格右缘=${geo.jlCell.x + geo.jlCell.w} 表格右缘=${tableRight}`)
    ok('处理意见值格铺到表格右缘', Math.abs((geo.clCell.x + geo.clCell.w) - tableRight) <= 2, `值格右缘=${geo.clCell.x + geo.clCell.w}`)
    ok('检验结论输入框占表宽≥75%(不再半截)', !!geo.jlInput && geo.jlInput.w >= geo.table.w * 0.75, `输入框=${geo.jlInput?.w} 表宽=${geo.table.w}`)
    ok('处理意见输入框占表宽≥75%', !!geo.clInput && geo.clInput.w >= geo.table.w * 0.75, `输入框=${geo.clInput?.w}`)
    ok('值格起始列=表体首列宽(与原表 B|C:I 同节奏)', Math.abs(geo.jlCell.x - (geo.table.x + geo.table.w * 0.2)) <= 4, `值格 x=${geo.jlCell.x} 期望≈${Math.round(geo.table.x + geo.table.w * 0.2)}`)
    // 明细必填:至少一行(面板明细页签 isRequired)→ 先加一行检验项并从标准库选中
    await evaluate(`(() => { const b = [...document.querySelectorAll('.qc-rec-sheet .qr-add')].find(e => e.innerText.includes('新增检验项')); b?.click(); return !!b })()`)
    await sleep(900)
    await evaluate(`(() => {
      const w = document.querySelector('.qc-rec-sheet .qr-table tbody td.c-item .el-select__wrapper')
      w?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!w
    })()`)
    await sleep(900)
    const picked = await evaluate(`(() => {
      const pops = [...document.querySelectorAll('.el-select-dropdown')].filter(p => p.offsetParent !== null)
      const items = [...(pops.pop()?.querySelectorAll('.el-select-dropdown__item') || [])]
      const opt = items.find(o => o.innerText.trim() === '外观')
      opt?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!opt
    })()`)
    ok('明细检验项可选「外观」', picked)
    await sleep(600)
    await evaluate(`(() => {
      const setV = (el, v) => {
        if (!el) return 0
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return 1
      }
      const sheet = document.querySelector('.qc-rec-sheet')
      // 标签在抬头表(物料名称/物料批次)与脚表(检验结论/处理意见)两处,统一查
      const headInput = (label) => {
        for (const sel of ['.qr-head-table th', '.qr-foot-table th']) {
          const th = [...sheet.querySelectorAll(sel)].find(t => t.innerText.trim() === label)
          const el = th?.nextElementSibling?.querySelector('input, textarea')
          if (el) return el
        }
        return null
      }
      setV(headInput('物料名称'), 'HP-2040')
      setV(headInput('物料批次'), '260807')
      setV(sheet.querySelector('.qr-table tbody td.c-result textarea'), '外观无脏污、无破损')
      setV(headInput('检验结论'), '外观检验合格')
      setV(headInput('处理意见'), '同意入库')
      return 1
    })()`)
    await sleep(600)
    const nb = posts.length
    await evaluate(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '保存'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    for (let i = 0; i < 24 && posts.length === nb; i++) await sleep(500)
    await sleep(2500)
    const msg = await evaluate(`[...document.querySelectorAll('.el-message')].map(e => e.innerText).join(' | ')`)
    console.log('   保存提示:', msg || '(无)')
    const rows = await apiRows(token, 'QC_INSP_REC')
    const saved = rows.find((r) => r['单据编号'] === freshNo) || {}
    ok('保存后单据状态=已归档(管理员保存即归档,与立项申请同口径)', saved['单据状态'] === '已归档', `状态=${saved['单据状态']}`)
    const readonly = await evaluate(`!document.querySelector('.qc-rec-sheet .qr-add')`)
    ok('归档后纸张转只读(无增行按钮)', readonly === true)
    const canModify = await evaluate(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '申请修改'); return b ? !b.className.includes('disabled') : false })()`)
    ok('归档后「申请修改」可用(修改闭环入口)', canModify === true)
    const concl = ((await (await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_INSP_REC&code=${encodeURIComponent(freshNo)}`, { headers: { Authorization: `Bearer ${token}` } })).json())?.data?.data) || {}
    ok('检验结论已落库', concl['检验结论'] === '外观检验合格', JSON.stringify(concl['检验结论']))
    ok('处理意见已落库', concl['处理意见'] === '同意入库', JSON.stringify(concl['处理意见']))
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
  console.log(process.exitCode ? '\n== 有失败项 ==' : '\n== 全部通过 ==')
  process.exit(process.exitCode || 0)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
