/**
 * _configure-w111-http.cjs — 把 W111 切成「HTTP 主动推」模式(2026-10-19)
 *
 * 作用:改模块的 端口1 配置(sock1a=HTPC + http1 的 URL/Header/请求方式),保存并重启,
 *       之后秤按一次「*」→ 模块直接 POST 串口原文到 MES 的文本上报口,
 *       **不再需要任何电脑常开做中转**。
 *
 * 关键约束(模块固件 V1.0.2 实测):
 *   · URL 最长 64 字符 ⇒ 设备号走查询串(?device=DZ-001),不要再塞别的参数;
 *   · Header 最长 64 字符、多个头用 '|' 分隔 ⇒ 密钥走 X-DC-Key;
 *   · POST 时「正文 = 串口帧原文」,Content-Type 必须配 text/plain;
 *   · 保存后必须 reboot 才生效。
 *
 * 用法:
 *   node tools/archive/_dc-scale-live-20261019/_configure-w111-http.cjs 192.168.23.120 192.168.23.109 8090
 *       参数 = 模块地址 / MES 地址 / MES 端口
 *   node tools/archive/_dc-scale-live-20261019/_configure-w111-http.cjs --restore
 *       回滚成原来的 TCP 服务端模式(8010 转发给本机监听脚本)
 */
const MODULE = process.argv[2] && process.argv[2].startsWith('http') ? process.argv[2] : 'http://192.168.23.120'
const MES_HOST = process.argv[3] || '192.168.23.109'
const MES_PORT = process.argv[4] || '8090'
const RESTORE = process.argv.includes('--restore')
const USER = 'admin'
const PASS = 'admin'
const DEVICE = 'DZ-001'
const KEY = 'scale-demo-2026'

const basic = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64')
const get = async (p) => (await fetch(MODULE + p, { headers: { Authorization: basic } })).text()
const postForm = async (p, body) => (await fetch(MODULE + p, {
  method: 'POST',
  headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
})).text()

;(async () => {
  const before = await get('/cgi-bin/getcfg.py?v=' + Date.now())
  console.log('[当前] sock1a =', JSON.stringify(JSON.parse(before).sock1a))
  console.log('[当前] http1 =', JSON.stringify(JSON.parse(before).http1))

  const cfg = RESTORE
    ? { sock1a: { enable: 'ON', type: 'TCPS', addr: '192.168.10.8', port: 8010 }, http1: { url: '/index.html', request: 'GET' } }
    : {
        sock1a: { enable: 'ON', type: 'HTPC', addr: MES_HOST, port: Number(MES_PORT) },
        http1: {
          url: `/api/dc/ingest/text?device=${DEVICE}`,
          head: `X-DC-Key: ${KEY}|Content-Type: text/plain`,
          filter: 'OFF',
          request: 'POST',
          tm_out: 6,
        },
      }
  const save = await postForm('/cgi-bin/save.py', 'val=' + encodeURIComponent(JSON.stringify(cfg)))
  console.log('[保存]', save)
  const reboot = await get('/cgi-bin/ctrl?ops=reboot')
  console.log('[重启]', reboot)
  console.log('[下一步] 等 20 秒后按秤上的「*」,然后跑 _q-scale-live-shot.mjs 看 MES 实时值')
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
