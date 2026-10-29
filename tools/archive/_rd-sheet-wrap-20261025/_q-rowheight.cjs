/**
 * _q-rowheight.cjs —— 固定行高下长文本是否被裁切(2026-10-25,只读量测不保存)
 *
 * 用户截图里「七 开发周期要求」是多行文本;纸面行高按设计磅值固定(min-height),
 * 若文本域高度锁死而行高不足,长文本会被裁掉 —— 这是「不会自动换行」的另一半真相。
 */
'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const F = process.argv[3] || 'YJ'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9433
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fail = 0
const ok = (m) => console.log('  [PASS] ' + m)
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }

const LONG =
  '外径33mm内径12mm长度110mm;三层复合结构:外层PP无纺布+中层活性炭纤维毡+内层PP熔喷;' +
  '端盖二次注塑密封,接口G1/2;耐压2kgf,压降≤0.02MPa@0.9L/min,累计处理水量≥2000L;' +
  '适用机型:RO-400G/600G/800G;特殊要求:出水TDS去除率≥90%,余氯去除率≥95%,需通过NSF42/53认证。' +
  '补充说明:滤芯需支持反冲洗,冲洗流量不低于1.2L/min,冲洗时间不少于30秒;' +
  '外壳材料需符合食品级要求,不得检出塑化剂;活性炭碘值不低于1000mg/g,四氯化碳吸附率≥60%;' +
  '出厂前需做气密性测试,测试压力0.6MPa,保压60秒无泄漏;包装采用独立PE袋+泡沫内衬,外箱标示生产批号与生产日期;' +
  '质保期不少于12个月,质保期内出现渗漏、压降超标等质量问题由供方免费更换。'

async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: F }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('login failed')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rh-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 120; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } } }

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await nav(`${BASE}/#/login`)
  await ev(`localStorage.setItem('mes_init_done','1');localStorage.setItem('mes_token',${JSON.stringify(token)});localStorage.setItem('mes_user',${JSON.stringify(JSON.stringify(lr.data.user))});'ok'`)
  await nav('about:blank')
  await nav(`${BASE}/#/panelx/list/RD_APPROVAL`)
  await sleep(2500)
  await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.as-side-btn'));
    for(var i=0;i<bs.length;i++){if(bs[i].offsetParent&&(bs[i].textContent||'').trim()==='新增'){bs[i].click();return 'OK'}}return 'NO'})()`)
  await sleep(4500)

  const res = await ev(`(function(){
    var rows=[].slice.call(document.querySelectorAll('.approval-sheet .as-row'));
    var target=null;
    for(var i=0;i<rows.length;i++){var n=rows[i].querySelector('.as-name');
      if(n&&(n.textContent||'').indexOf('滤芯')>=0){target=rows[i];break}}
    if(!target) return {err:'NO_ROW'}
    var ta=target.querySelector('textarea'); if(!ta) return {err:'NO_TA'}
    var long=${JSON.stringify(LONG)};
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(ta,long);
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    return new Promise(function(done){
      setTimeout(function(){
        var rowH=target.getBoundingClientRect().height;
        var taH=ta.getBoundingClientRect().height;
        done({len:long.length, rowH:Math.round(rowH), taH:Math.round(taH),
              taSH:ta.scrollHeight, taCH:ta.clientHeight,
              clipped: ta.scrollHeight > ta.clientHeight+2});
      },400);
    });
  })()`)
  console.log('[row]', JSON.stringify(res))

  if (!res || res.err) bad('未能量测: ' + JSON.stringify(res))
  else {
    if (!res.clipped) ok(`文本域内容未被裁切(scrollHeight=${res.taSH} / clientHeight=${res.taCH})`)
    else bad(`内容被裁切:需 ${res.taSH}px,实际可见 ${res.taCH}px`)
    if (res.rowH >= res.taH - 1) ok(`行高容纳文本域:行 ${res.rowH}px ≥ 域 ${res.taH}px`)
    else bad(`行高 ${res.rowH}px < 文本域 ${res.taH}px`)

    const grew = await ev(`(function(){
      var rows=[].slice.call(document.querySelectorAll('.approval-sheet .as-row'));
      for(var i=0;i<rows.length;i++){var n=rows[i].querySelector('.as-name');
        if(n&&(n.textContent||'').indexOf('滤芯')>=0){return Math.round(rows[i].getBoundingClientRect().height)}}
      return -1 })()`)
    ok(`该行实际渲染高度 = ${grew}px`)
  }

  const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(__dirname, 'shots', 'rowheight-1440.png'), Buffer.from(r.result.data, 'base64'))
  console.log('[shot] rowheight-1440.png')

  try { await send('Browser.close') } catch {}
  try { edge.kill() } catch {}
  console.log(fail ? `\n== FAIL ${fail} ==` : '\n== ALL PASS ==')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
