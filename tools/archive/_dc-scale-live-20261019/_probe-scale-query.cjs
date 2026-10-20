/**
 * _probe-scale-query.cjs — 找出这台计价秤的「询问指令」(2026-10-19)
 *
 * 思路:用 W111 的「心跳包」当发令枪 —— 心跳方向=UART、间隔=1s、内容=候选指令,
 * 模块每秒把指令发给秤;若秤回帧,模块的「上行字节数」会增加,并且会经 SocketA(HTTP)推到 MES。
 *
 * 逐个候选:改配置 → 重启模块 → 等 20s → 读 A_tr 增量。
 * 用法:node tools/archive/_dc-scale-live-20261019/_probe-scale-query.cjs
 */
const MODULE = 'http://192.168.23.120'
const USER = 'admin', PASS = 'admin'
const basic = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const get = async (p) => (await fetch(MODULE + p, { headers: { Authorization: basic } })).text()
const postForm = async (p, body) => (await fetch(MODULE + p, {
  method: 'POST', headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
})).text()

const readUp = async () => {
  for (let i = 0; i < 20; i++) {
    try {
      const d = JSON.parse(await get('/cgi-bin/devinfo.py?v=' + Date.now()))
      const t = d.s_status?.[0]?.A_tr || '0 / 0'
      return Number(String(t).split('/')[0].replace(/[^\d]/g, '')) || 0
    } catch (e) { await sleep(1500) }   // 模块重启期间连不上,等它回来
  }
  throw new Error('模块长时间无响应')
}

/** 等模块重启完成(能读到 devinfo 为止) */
const waitOnline = async () => {
  for (let i = 0; i < 30; i++) {
    try { await get('/cgi-bin/devinfo.py?v=' + Date.now()); return } catch (e) { await sleep(1000) }
  }
  throw new Error('重启后模块未上线')
}

const candidates = [
  { name: 'HEX 05 (ENQ)', data: '05', fmt: 'HEX' },
  { name: 'HEX 57 0D 0A ("W\\r\\n")', data: '570D0A', fmt: 'HEX' },
  { name: 'ASCII W', data: 'W', fmt: 'ASCII' },
  { name: 'HEX 52 0D 0A ("R\\r\\n")', data: '520D0A', fmt: 'HEX' },
]

;(async () => {
  const base = await readUp()
  console.log('起始上行字节:', base)
  for (const c of candidates) {
    const cfg = { heart1: { dir: 'UART', tm_val: 1, data: c.data, fmt: c.fmt } }
    const saved = await postForm('/cgi-bin/save.py', 'val=' + encodeURIComponent(JSON.stringify(cfg)))
    await get('/cgi-bin/ctrl?ops=reboot').catch(() => {})
    await sleep(3000)
    await waitOnline()
    const start = await readUp()
    await sleep(15000)                // 观察 15 秒(应发 15 次指令)
    const end = await readUp()
    console.log(`候选 ${c.name}: 保存=${saved.trim()} 观察 15s  上行 ${start} → ${end}  (增量 ${end - start} 字节)${end > start ? '  ← 秤有回帧!' : ''}`)
  }
  // 试完把心跳包关掉,避免一直往秤发未知指令
  await postForm('/cgi-bin/save.py', 'val=' + encodeURIComponent(JSON.stringify({ heart1: { dir: 'OFF' } })))
  await get('/cgi-bin/ctrl?ops=reboot')
  console.log('已关闭心跳包(dir=OFF)。若某个候选有增量,告诉我它的数字,我按它配置正式采集')
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
