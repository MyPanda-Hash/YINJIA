/**
 * _chk-wx-data-api.cjs — 确认小程序骨架能调通的只读业务接口(真实响应取证)
 *
 * 骨架需要"登录之后能显示点什么":这里确认 POST /api/px/queryFormDataList 的入参形状与返回结构,
 * 并挑一个数据量小、字段干净的面板做示例页。
 * 用法:node tools/archive/_chk-wx-data-api.cjs [panelCode]
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = process.argv[2] || 'RD_INSP_PLAN'

;(async () => {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

  const r = await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 5 }),
  })
  const j = await r.json()
  console.log(`POST /api/px/queryFormDataList {panelCode:"${PANEL}",condition:{},pageNo:1,pageSize:5}`)
  console.log(`  HTTP ${r.status}  code=${j.code} message=${j.message}`)
  const d = j.data || {}
  console.log(`  data 顶层键 = ${JSON.stringify(Object.keys(d))}`)
  console.log(`  total=${d.total} pageNo=${d.pageNo} pageSize=${d.pageSize} list条数=${(d.list || []).length}`)
  if ((d.list || []).length) {
    console.log('  首行字段名 = ' + JSON.stringify(Object.keys(d.list[0]).slice(0, 14)))
    console.log('  首行前 6 个值 = ' + JSON.stringify(Object.fromEntries(Object.entries(d.list[0]).slice(0, 6))))
  }

  // 面板配置(菜单/列头/按钮):小程序要按权限渲染菜单时可用
  const cfg = await fetch(BASE + '/api/px/getPanelConfig?panelCode=' + PANEL, { headers: H })
  const cj = await cfg.json()
  console.log('')
  console.log(`GET /api/px/getPanelConfig?panelCode=${PANEL} → HTTP ${cfg.status} code=${cj.code}`)
  const md = (cj.data && cj.data.metadata) || {}
  console.log(`  metadata 键 = ${JSON.stringify(Object.keys(md))}`)
  console.log(`  panelName=${JSON.stringify(md.panelName)} panelCategory=${JSON.stringify(md.panelCategory)}`)

  const bad = []
  if (r.status !== 200 || j.code !== 200) bad.push('queryFormDataList 非 200')
  if (!Array.isArray(d.list)) bad.push('list 不是数组')
  if (cfg.status !== 200) bad.push('getPanelConfig 非 200')
  console.log('')
  console.log(bad.length ? `✗ ${bad.join(' / ')}` : '✓ 两个只读接口可用:骨架示例页按此渲染')
  process.exit(bad.length ? 1 : 0)
})().catch((e) => { console.error('异常:', e.stack || e.message); process.exit(1) })
