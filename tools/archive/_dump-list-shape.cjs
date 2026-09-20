/**
 * _dump-list-shape.cjs — 打印 queryFormDataList 的真实响应形状(定位 detail 挂在哪)
 * 用法:node tools/archive/_dump-list-shape.cjs [panelCode]
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = process.argv[2] || 'RD_SAMPLE_NO'
;(async () => {
  const lj = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const H = { Authorization: `Bearer ${lj.data.token}`, 'Content-Type': 'application/json' }
  const r = await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 50 }),
  })
  const j = await r.json()
  console.log('HTTP', r.status, 'code', j.code)
  console.log('data keys =', Object.keys(j.data || {}))
  const list = (j.data && j.data.list) || []
  console.log('list.length =', list.length, ' totalSize =', j.data && j.data.totalSize)
  if (list[0]) {
    console.log('第一张单的 keys =', Object.keys(list[0]))
    for (const k of Object.keys(list[0])) {
      const v = list[0][k]
      if (Array.isArray(v)) console.log(`  ${k}: Array(${v.length})`, v[0] ? JSON.stringify(v[0]).slice(0, 200) : '')
      else if (v && typeof v === 'object') console.log(`  ${k}: Object`, JSON.stringify(v).slice(0, 200))
      else console.log(`  ${k}: ${JSON.stringify(v)}`)
    }
  } else {
    console.log('(空列表) 原始 data =', JSON.stringify(j.data).slice(0, 400))
  }
})().catch((e) => { console.error(e.message); process.exit(1) })
