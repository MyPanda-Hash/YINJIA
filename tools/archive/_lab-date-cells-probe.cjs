/**
 * _lab-date-cells-probe.cjs — 实验室记录表「日期/时间格」改选取后的端到端取证探针(2026-10-07)
 *
 * 干什么:CDP 起 Edge 无头 → 5173(dev,跑工作区源码)→ 登录取 token →
 *   ① 逐个打开 RD_* 记录表面板,翻到**有明细值的单据**;
 *   ② dump 每张表里「日期控件/时间区间控件」的位置与显示值 + 整页截图(看真实像素);
 *   ③ 传 --save 时:在 RD_INSTR_USE 上真点一次日期与区间控件,再点「保存」,把回传值坐实。
 *
 * 用法:
 *   node tools/archive/_lab-date-cells-probe.cjs                       # 11 张表全扫
 *   node tools/archive/_lab-date-cells-probe.cjs RD_INSTR_USE --save   # 单表 + 真点真存
 * 产物:tools/archive/_lab-date-cells-out/<面板码>.png、_out.txt、_interact.txt
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const PORT = 9394
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const args = process.argv.slice(2)
const SAVE = args.includes('--save')
const PANELS = args.filter((a) => !a.startsWith('--'))
const LIST = PANELS.length ? PANELS : ['RD_INSTR_USE', 'RD_EQUIP_USE', 'RD_DOM_TEST', 'RD_SPIKE_WATER', 'RD_SCALE', 'RD_MINERAL', 'RD_ANTIBACT', 'RD_RO_PROTECT', 'RD_SOAK', 'RD_DROP_PREC', 'RD_ALKALINE']
const OUT = 'C:/INCER/YINJIA-MES/tools/archive/_lab-date-cells-out'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  if (!login?.data?.token) { console.log('LOGIN-FAIL'); process.exit(1) }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-lab-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1800,1600',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2600)
  const lines = []
  const interacts = []
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      const ex = r.result && r.result.exceptionDetails
      if (ex) return '<<ERR ' + String((ex.exception || {}).description || ex.text || '').slice(0, 300) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') break } await sleep(3200) }
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); if (r.result?.data) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')) }
    const dumpCells = () => ev(`(function(){
      const out = { doc: (document.querySelector('.rs-docno-input') || {}).value || '', cells: [] };
      document.querySelectorAll('table.rs-t td.rs-td').forEach((td) => {
        const range = td.querySelector('.el-range-editor');
        const de = td.querySelector('.el-date-editor');
        const inp = td.querySelector('input');
        const span = td.querySelector('.rs-txt');
        if (!range && !de && !inp && !span) return;
        let kind = range ? 'range' : de ? 'date' : inp ? 'input' : 'text';
        let val = '';
        if (range) val = [...td.querySelectorAll('input')].map((x) => x.value).join('~');
        else if (inp) val = inp.value;
        else val = (span.textContent || '').trim();
        out.cells.push(kind + ':' + val);
      });
      return JSON.stringify(out);
    })()`)

    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date','2026-10-07'); 'ok'`)
    // ⚠ 只改 hash 的导航不会重建 document,store 里 token 仍空 → 被守卫踢回登录页;必须整页重载
    await nav('about:blank')

    for (const panel of LIST) {
      await nav(`${BASE}/#/panelx/list/${panel}`)
      await sleep(1200)
      await ev(`(function(){ document.querySelectorAll('.el-dialog__headerbtn').forEach((b)=>b.click()); return 1; })()`)
      // 翻到「有明细值」的单据:最新那张常是空单,逐张「下一张」直到日期/区间控件里出现值
      let snap = ''
      for (let hop = 0; hop < 6; hop++) {
        snap = await dumpCells()
        if (typeof snap === 'string' && /(date|range):[^",]*[0-9]/.test(snap)) break
        const moved = await ev(`(function(){
          const b = [...document.querySelectorAll('.page-btn')].find((x) => (x.getAttribute('title') || '') === '下一张');
          if (!b) return 'no-btn'; b.click(); return 'clicked';
        })()`)
        if (moved !== 'clicked') break
        await sleep(2000)
      }
      lines.push(panel + ' ' + snap)
      await shot(panel)
      console.log(panel, String(snap).slice(0, 420))

      if (SAVE && panel === 'RD_INSTR_USE') {
        // 0) 先摸清真实 DOM:工具栏「保存」按钮长什么样、区间弹层长什么样(选择器不靠猜)
        if (args.includes('--dump-ui')) {
          interacts.push('toolbar-save: ' + await ev(`(function(){
            const hits = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && (el.textContent || '').trim() === '保存');
            return JSON.stringify(hits.slice(0, 3).map((el) => {
              const chain = []; let p = el;
              while (p && p !== document.body && chain.length < 4) { chain.push(p.tagName.toLowerCase() + '.' + (p.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.')); p = p.parentElement; }
              return chain.join(' < ');
            }));
          })()`))
          interacts.push('open-range-dump: ' + await ev(`(function(){
            const td = [...document.querySelectorAll('table.rs-t td.rs-td')].find((x) => x.querySelector('.el-range-editor'));
            if (!td) return 'no-cell';
            const ed = td.querySelector('.el-range-editor');
            ed.scrollIntoView({ block: 'center' });
            const opts = { bubbles: true, cancelable: true, view: window };
            ed.dispatchEvent(new MouseEvent('mousedown', opts));
            ed.dispatchEvent(new MouseEvent('mouseup', opts));
            ed.click();
            return 'clicked';
          })()`))
          await sleep(1200)
          interacts.push('range-panel-dom: ' + await ev(`(function(){
            const hit = [...document.querySelectorAll('.el-time-range-picker, .el-picker-panel, .el-time-panel')];
            return JSON.stringify(hit.map((p) => ({
              cls: p.className, disp: getComputedStyle(p).display,
              kids: [...p.querySelectorAll('*')].map((k) => k.tagName.toLowerCase() + '.' + (k.className || '').toString().split(' ').filter(Boolean).join('.')).slice(0, 30),
            })));
          })()`))
          await shot('RD_INSTR_USE-range-open')
          fs.writeFileSync(path.join(OUT, '_interact.txt'), interacts.join('\n'), 'utf8')
          interacts.forEach((l) => console.log('  ' + l.slice(0, 1600)))
          return
        }
        // ① 真点日期控件 → 选 15 号
        interacts.push('open-date: ' + await ev(`(function(){
          const td = [...document.querySelectorAll('table.rs-t td.rs-td')].find((x) => x.querySelector('.el-date-editor'));
          if (!td) return 'no-cell';
          td.querySelector('input').click();
          return 'clicked';
        })()`))
        await sleep(900)
        interacts.push('pick-day: ' + await ev(`(function(){
          const cells = [...document.querySelectorAll('.el-picker-panel .el-date-table td.available')]
            .filter((x) => x.textContent.trim() === '15');
          if (!cells.length) return 'no-day15';
          cells[0].click();
          return 'ok';
        })()`))
        await sleep(900)
        // ② 真点区间控件 → 左起 08:00 / 右止 09:00
        interacts.push('open-range: ' + await ev(`(function(){
          const td = [...document.querySelectorAll('table.rs-t td.rs-td')].find((x) => x.querySelector('.el-range-editor'));
          if (!td) return 'no-cell';
          const ed = td.querySelector('.el-range-editor');
          ed.scrollIntoView({ block: 'center' });
          const o = { bubbles: true, cancelable: true, view: window };
          ed.dispatchEvent(new MouseEvent('mousedown', o));
          ed.dispatchEvent(new MouseEvent('mouseup', o));
          ed.click();
          return 'clicked';
        })()`))
        await sleep(1200)
        const spin = `(function(idx, hh, mm){
          const sides = [...document.querySelectorAll('.el-time-range-picker__content')];
          const side = sides[idx];
          if (!side) return 'no-side:' + sides.length;
          const lists = [...side.querySelectorAll('.el-time-spinner__list')];
          if (lists.length < 2) return 'no-lists:' + lists.length;
          const pick = (list, text) => {
            const it = [...list.querySelectorAll('.el-time-spinner__item')].find((x) => x.textContent.trim() === text);
            if (!it) return false; it.click(); return true;
          };
          return (pick(lists[0], hh) ? 'h' : '-h') + (pick(lists[1], mm) ? 'm' : '-m') + '/n=' + sides.length;
        })`
        interacts.push('pick-start: ' + await ev(`${spin}(0,'08','00')`))
        interacts.push('pick-end: ' + await ev(`${spin}(1,'09','00')`))
        await sleep(600)
        interacts.push('confirm: ' + await ev(`(function(){
          const btns = [...document.querySelectorAll('.el-time-range-picker button, .el-picker-panel__footer button')];
          const b = btns.find((x) => /确定|OK/.test(x.textContent || '')) || btns[btns.length - 1];
          if (!b) return 'no-btn';
          b.click(); return (b.textContent || '').trim();
        })()`))
        await sleep(900)
        interacts.push('after-pick: ' + await dumpCells())
        await shot('RD_INSTR_USE-after-pick')
        // ③ 保存(记录表的动作在右侧竖排 .as-side-btn)
        interacts.push('save: ' + await ev(`(function(){
          const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '保存');
          if (!b) return 'no-save-btn';
          b.click(); return 'clicked';
        })()`))
        await sleep(4000)
        interacts.push('after-save-toast: ' + await ev(`(function(){
          const m = [...document.querySelectorAll('.el-message')].map((x)=>x.textContent.trim());
          return JSON.stringify(m);
        })()`))
        await shot('RD_INSTR_USE-after-save')
        fs.writeFileSync(path.join(OUT, '_interact.txt'), interacts.join('\n'), 'utf8')
        interacts.forEach((l) => console.log('  ' + l.slice(0, 400)))
      }
    }
    fs.writeFileSync(path.join(OUT, '_out.txt'), lines.join('\n'), 'utf8')
  } finally {
    try { edge.kill() } catch { }
    await sleep(1000)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { }
  }
  console.log('DONE ->', OUT)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
