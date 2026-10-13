/**
 * _probe-insp-refcell.cjs —— 看出货检验计划表「产品编号」那格到底渲染成什么
 *
 * 前面全是接口层推理(元数据、dataSchema、fieldMap 复刻),结论矛盾 ⇒ 必须看活体 DOM。
 * 判据:参照控件 = 该值格内存在 .rs-ref-ctl(RecordSheetPanels 模板 :229 起);
 *       普通输入框 = .rs-t-in (el-input)。
 * 同时把「产品功能类别」那格作为对照一起 dump。
 *
 * 只读。用法:node tools/archive/_probe-insp-refcell.cjs
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const PAGE = process.env.YINJIA_PAGE || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const USER = process.env.PROBE_USER || 'admin'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9783
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`\n=== 出货检验计划表「产品编号」格渲染实况(身份=${USER} / 页 ${PAGE}) ===`)
  const lr = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: '123456', factory: FACTORY }),
  })).json()
  if (lr?.code !== 200) throw new Error('登录失败')

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-inspref-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3600); return } }
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1200, deviceScaleFactor: 1, mobile: false })
    await nav(`${PAGE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(lr.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${PAGE}/#/panelx/list/RD_INSP_PLAN`)
    await sleep(1500)

    // 打开第一张单:点表格首行的单号链接 / 双击行
    const opened = await ev(`(function(){
      var tr = document.querySelector('table tbody tr');
      if (!tr) return 'NO_ROW';
      var a = tr.querySelector('a, .link, [class*="link"]');
      if (a) { a.click(); return 'CLICKED_LINK' }
      tr.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return 'DBLCLICK_ROW';
    })()`)
    console.log(`  打开首行 = ${opened}`)
    await sleep(4200)

    const dump = await ev(`(function(){
      var out = {};
      var tds = [].slice.call(document.querySelectorAll('.rs-td, td'));
      function cellOf(label){
        for (var i=0;i<tds.length;i++){
          var t=(tds[i].textContent||'').trim();
          if (t===label){
            var v=tds[i].nextElementSibling;
            if (!v) return null;
            return { hasRefCtl: !!v.querySelector('.rs-ref-ctl'), hasInput: !!v.querySelector('.rs-t-in, input'),
                     text: (v.textContent||'').replace(/\\s+/g,' ').trim().slice(0,30),
                     html: (v.innerHTML||'').replace(/\\s+/g,' ').slice(0,180) };
          }
        }
        return null;
      }
      out['产品编号'] = cellOf('产品编号');
      out['产品功能类别'] = cellOf('产品功能类别');
      out['客户项目名称'] = cellOf('客户项目名称');
      out.refCtlCount = document.querySelectorAll('.rs-ref-ctl').length;
      out.editableHint = (document.querySelector('.rs-t-in') ? '有可编辑输入框' : '无可编辑输入框(可能只读/未选中单)');
      return JSON.stringify(out, null, 1);
    })()`)
    console.log('\n' + dump)
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    if (r.result?.data) {
      const f = path.join(SHOTS, 'insp-refcell.png')
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      console.log('\n  截图:' + f)
    }
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
