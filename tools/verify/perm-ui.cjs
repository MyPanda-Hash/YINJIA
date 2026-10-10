/**
 * 验证权限矩阵视觉:分组已按导航模块归并 + 默认折叠。
 * 用法: node tools/verify/perm-ui.cjs
 * 产出: tools/verify/_perm-*.png
 */
const CDP_PORT = 9377
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function httpJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => {
      let d = ''
      r.on('data', (c) => (d += c))
      r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}

async function main() {
  // 登录拿 token(直接走 API,不模拟登录页)
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const lj = await lr.json()
  if (!lj.data?.token) throw new Error('登录失败 ' + JSON.stringify(lj))
  const token = lj.data.token
  const user = JSON.stringify(lj.data.user || {})

  const proc = spawn(EDGE, [
    `--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1440,900', '--user-data-dir=' + path.join(require('os').tmpdir(), '_perm_cdp'),
    'about:blank',
  ], { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)

  let list
  for (let i = 0; i < 20; i++) {
    try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {}
    await sleep(500)
  }
  const target = list.find((t) => t.type === 'page')
  const ws = target.webSocketDebuggerUrl

  // 零依赖 CDP 客户端(仓库无 ws 依赖,Node 20 也无全局 WebSocket)
  // 注意: connect() 返回 Promise,resolve 时握手已完成(2026-10-10 修复)
  const { connect } = require('./lib/mini-ws.cjs')
  let id = 0
  const pending = new Map()
  const sock = await connect(ws)
  sock.on('message', (data) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  })
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params }))
  })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) {
      throw new Error('EVAL: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text))
    }
    return r.result?.result?.value
  }

  await send('Page.enable')
  await send('Runtime.enable')
  // 必须先到真实 origin 才能写 localStorage
  await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
  await sleep(3500)

  // 预置会话(Pinia 只在 bootstrap 读一次 localStorage,写完必须 reload)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)})`)
  await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(user)})`)
  await send('Page.navigate', { url: 'http://localhost:5173/#/sys/org' })
  await sleep(3000)
  await send('Page.reload', {})
  await sleep(8000)

  const hash = await evaluate('location.hash')
  console.log('hash =', hash)

  // 权限矩阵只在选中角色后渲染(:89 v-if="selRole" + :102 非管理员才显示)
  // 点最后一行非管理员角色(roleCode !== ADMIN)
  const rowBox = await evaluate(`(function(){
    var rows = document.querySelectorAll('.el-table__body-wrapper tr');
    for (var i = rows.length - 1; i >= 0; i--) {
      var t = rows[i].innerText || '';
      if (t.indexOf('超级') < 0) {
        var r = rows[i].getBoundingClientRect();
        if (r.height > 0) return JSON.stringify({x: r.x + 60, y: r.y + r.height / 2, text: t.replace(/\\s+/g,' ').trim().slice(0,40)});
      }
    }
    return null
  })()`)
  if (!rowBox) throw new Error('未找到非管理员角色行')
  console.log('点击角色行:', JSON.parse(rowBox).text)
  const rb = JSON.parse(rowBox)
  // 光点行不够:Element Plus 的 current-change 需要行内 cell 上的真实 mousedown/mouseup/click
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rb.x, y: rb.y })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rb.x, y: rb.y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rb.x, y: rb.y, button: 'left', buttons: 0, clickCount: 1 })
  await sleep(2500)
  const clicked = await evaluate(`document.querySelectorAll('.perm-collapse .el-collapse-item').length`)
  if (clicked === 0) {
    // 兜底:直接在角色行内的 td 上派发完整事件序列
    const ok = await evaluate(`(function(){
      var rows = document.querySelectorAll('.el-table__body-wrapper tr');
      for (var i = rows.length - 1; i >= 0; i--) {
        var t = rows[i].innerText || '';
        if (t.indexOf('超级') < 0) {
          var td = rows[i].querySelector('td') || rows[i];
          for (var j = 0; j < 3; j++) {
            ['mousedown','mouseup','click'].forEach(function(ev){
              td.dispatchEvent(new MouseEvent(ev, {bubbles:true, cancelable:true, view:window, button:0}));
            });
          }
          return t.replace(/\\s+/g,' ').trim().slice(0,40);
        }
      }
      return null
    })()`)
    console.log('兜底派发事件于:', ok)
    await sleep(2500)
  }

  // 等待权限矩阵渲染
  let rendered = 0
  for (let i = 0; i < 25; i++) {
    rendered = await evaluate(`document.querySelectorAll('.perm-collapse .el-collapse-item').length`)
    if (rendered > 0) break
    await sleep(1000)
  }
  if (rendered === 0) {
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, '_perm-debug.png'), Buffer.from(shot.result.data, 'base64'))
    const body = await evaluate('document.body.innerText.slice(0, 600)')
    console.log('未渲染权限矩阵。body 前 600 字:\n' + body)
    throw new Error('矩阵未渲染, hash=' + hash)
  }
  console.log('分组数:', rendered)

  // 展开全部组,否则折叠态下 wrap 没有内容也读不出组名
  const titles = await evaluate(`JSON.stringify(Array.from(document.querySelectorAll('.perm-collapse .g-title')).map(function(e){return e.textContent.trim()}))`)
  console.log('折叠态可见组头:', titles)

  const groups = await evaluate(`JSON.stringify(Array.from(document.querySelectorAll('.perm-collapse .el-collapse-item')).map(function(el){return {name: el.querySelector('.g-title')?el.querySelector('.g-title').textContent.trim():'', count: el.querySelector('.g-count')?el.querySelector('.g-count').textContent.trim():'', open: el.querySelector('.el-collapse-item__wrap')?getComputedStyle(el.querySelector('.el-collapse-item__wrap')).display:'?'}}))`)
  const parsed = JSON.parse(groups)
  console.log('\n分组:')
  parsed.forEach((g) => console.log(`  ${g.name}  ${g.count}  wrap-display=${g.open}`))

  const collapsedAll = parsed.every((g) => g.open === 'none' || g.open === '')
  console.log('\n默认折叠(所有 wrap 未展开):', collapsedAll ? 'PASS' : 'FAIL')

  await send('Page.captureScreenshot', { format: 'png' }).then((r) =>
    fs.writeFileSync(path.join(OUT, '_perm-collapsed.png'), Buffer.from(r.result.data, 'base64')))

  // 点开「智能供应链」看 25 张面板
  // 探针教训:.el-collapse-item__header 整体 click 在 CDP 下不触发 EP 的 toggle,
  //           必须点在标题文字(.g-title)上,并带完整 mousedown/mouseup/click 序列
  const box = await evaluate(`(function(){var items=document.querySelectorAll('.perm-collapse .el-collapse-item');for(var i=0;i<items.length;i++){var t=items[i].querySelector('.g-title');if(t&&t.textContent.trim()==='智能供应链'){var h=t.getBoundingClientRect();return JSON.stringify({x:h.x+h.width/2,y:h.y+h.height/2})}}return null})()`)
  if (box) {
    const b = JSON.parse(box)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', buttons: 0, clickCount: 1 })
    await sleep(1500)
    let open = await evaluate(`(function(){var items=document.querySelectorAll('.perm-collapse .el-collapse-item');for(var i=0;i<items.length;i++){var t=items[i].querySelector('.g-title');if(t&&t.textContent.trim()==='智能供应链'){var w=items[i].querySelector('.el-collapse-item__wrap');return getComputedStyle(w).display}}return 'notfound'})()`)
    if (open !== 'block') {
      // 兜底:直接在 .g-title 上派发完整事件序列
      await evaluate(`(function(){var items=document.querySelectorAll('.perm-collapse .el-collapse-item');for(var i=0;i<items.length;i++){var t=items[i].querySelector('.g-title');if(t&&t.textContent.trim()==='智能供应链'){for(var j=0;j<3;j++){['mousedown','mouseup','click'].forEach(function(ev){t.dispatchEvent(new MouseEvent(ev,{bubbles:true,cancelable:true,view:window,button:0}))})}return 1}}return 0})()`)
      await sleep(1500)
      open = await evaluate(`(function(){var items=document.querySelectorAll('.perm-collapse .el-collapse-item');for(var i=0;i<items.length;i++){var t=items[i].querySelector('.g-title');if(t&&t.textContent.trim()==='智能供应链'){var w=items[i].querySelector('.el-collapse-item__wrap');return getComputedStyle(w).display}}return 'notfound'})()`)
    }
    console.log('点击「智能供应链」后 wrap-display =', open, open === 'block' ? 'PASS' : 'FAIL')
    // 展开态下数一下该组实际渲染的面板行数
    const rows = await evaluate(`(function(){var items=document.querySelectorAll('.perm-collapse .el-collapse-item');for(var i=0;i<items.length;i++){var t=items[i].querySelector('.g-title');if(t&&t.textContent.trim()==='智能供应链'){return items[i].querySelectorAll('.perm-table tbody tr').length}}return -1})()`)
    console.log('展开后该组面板行数 =', rows, rows === 25 ? 'PASS' : 'FAIL')
    await send('Page.captureScreenshot', { format: 'png' }).then((r) =>
      fs.writeFileSync(path.join(OUT, '_perm-expanded.png'), Buffer.from(r.result.data, 'base64')))
  }

  sock.close()
  try { process.kill(proc.pid) } catch (e) {}
  // 成功与否按断言判定,不能无条件 exit 0(否则 FAIL 被吞)
  process.exit(collapsedAll ? 0 : 1)
}
main().catch((e) => { console.error('ERROR: ' + e.message); process.exit(2) })
