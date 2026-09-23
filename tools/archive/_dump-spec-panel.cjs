/**
 * _dump-spec-panel.cjs — 取 RD_SPEC_DOC 的当前字段元数据(经后端 API,不经 PowerShell 以免中文乱码)
 *
 * 为什么走 API 而不是 sqlcmd:sqlcmd 的中文输出要经 PowerShell 控制台代码页,
 * 本会话已被 PS 毁过两次中文(文档 mojibake / 提交消息截断)。API + Node 写文件 = 编码可控。
 *
 * 用法:node tools/archive/_dump-spec-panel.cjs [PANEL_CODE] [OUT_JSON]
 */
'use strict'
const fs = require('node:fs')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = process.argv[2] || 'RD_SPEC_DOC'
const OUT = process.argv[3] || 'C:\\INCER\\_rd-work\\spec-panel-raw.json'

async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const j = await r.json()
  const token = j.token || (j.data && j.data.token) || j.accessToken
  if (!token) throw new Error('登录未取到 token: ' + JSON.stringify(j).slice(0, 300))
  return token
}

;(async () => {
  const token = await login()
  const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
  const get = async (u) => {
    const r = await fetch(BASE + u, { headers: H })
    const j = await r.json()
    return { status: r.status, body: j }
  }
  const post = async (u, body) => {
    const r = await fetch(BASE + u, { method: 'POST', headers: H, body: JSON.stringify(body) })
    const j = await r.json()
    return { status: r.status, body: j }
  }

  const out = {}

  // ① 面板配置(字段清单的真源)
  const cfg = await get(`/api/px/getPanelConfig?panelCode=${PANEL}`)
  out.panelConfig = cfg
  console.log('getPanelConfig  HTTP', cfg.status, ' code=', cfg.body.code, ' msg=', cfg.body.message)

  // ② 列表(拿一份真实单据的 docNo)
  const list = await post('/api/px/queryFormDataList', { panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 5 })
  out.list = list
  console.log('queryFormDataList HTTP', list.status, ' code=', list.body.code, ' msg=', list.body.message)

  const ld = list.body.data || {}
  const rows = ld.rows || ld.list || ld.records || []
  console.log('  列表行数 =', rows.length, ' 键 =', Object.keys(ld).join(','))
  if (rows.length) console.log('  首行 =', JSON.stringify(rows[0]).slice(0, 500))

  // ③ 若有单据,取表单描述符(字段规格 + 明细的真源)
  const docNo = rows.length ? (rows[0]['编号'] || rows[0]['单据编号'] || rows[0].code) : null
  if (docNo) {
    const d = await get(`/api/px/getFormDescriptor?panelCode=${PANEL}&code=${encodeURIComponent(docNo)}`)
    out.descriptor = d
    console.log('getFormDescriptor HTTP', d.status, ' code=', d.body.code, ' (docNo=' + docNo + ')')
  } else {
    console.log('  (无单据 ⇒ 跳过 getFormDescriptor)')
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8')
  console.log('\n原始 JSON 已写:', OUT, fs.statSync(OUT).size, 'B')
})().catch((e) => { console.error('异常:', e.message); process.exit(1) })
