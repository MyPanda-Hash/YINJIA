/**
 * _verify-material-inspection-api.cjs — 端到端核对:商品(INV)面板经后端 API 是否真把
 *   金蝶自定义字段「来料检验」的值带到了前端(不是只看库)。
 * INV 是档案式面板:data.list[0].detail.inv 才是商品行数组。
 * 用法:node tools/archive/_verify-material-inspection-api.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
;(async () => {
  const lj = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const H = { Authorization: `Bearer ${lj.data.token}`, 'Content-Type': 'application/json' }

  const r = await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'INV', condition: {}, pageNo: 1, pageSize: 5000 }),
  })
  const j = await r.json()
  const rows = (((j.data || {}).list || [])[0] || {}).detail?.inv || []
  console.log('HTTP', r.status, 'code', j.code, '| 商品行数 =', rows.length, '| totalSize =', j.data && j.data.totalSize)
  if (!rows.length) throw new Error('商品行数组为空,检查响应形状')

  const hasKey = rows.filter((x) => '来料检验' in x)
  const yes = hasKey.filter((x) => x.来料检验 === '是')
  // 注:空值列不出现在行 JSON 里,所以"带键的行"只有有值那几行;
  //     期望 9 = 金蝶同步来的 8 个商品 + 本地手录行 CL004(无外部数据ID,同步器不管它)。
  console.log('带 来料检验 键的行 = %d/%d ;其中「是」= %d 条', hasKey.length, rows.length, yes.length)
  for (const y of yes) console.log('   %s %s = %s', y.存货编码, y.存货名称, y.来料检验)
  console.log(yes.length === 9 ? '✓ 8 个金蝶商品 + 本地行 CL004,与金蝶接口实测一致' : `⚠ 期望 9 条,实得 ${yes.length} 条`)
})().catch((e) => { console.error(e.message); process.exit(1) })
