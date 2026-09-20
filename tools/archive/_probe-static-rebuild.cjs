/**
 * _probe-static-rebuild.cjs — 验证 8090 静态产物已刷新(新面板代码真的在包里)
 * 用法:node tools/archive/_probe-static-rebuild.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  ' + e : ''}`)) }

/** 从已部署的 static 目录列出 assets 文件名(只读本地产物目录,不走 HTTP 列表) */
async function listAssetNames() {
  const { readdirSync } = await import('node:fs')
  const dir = process.env.MES_STATIC_DIR
    || 'C:\\INCER\\YINJIA-MES\\backend\\src\\main\\resources\\static\\assets'
  try { return readdirSync(dir) } catch { return [] }
}

;(async () => {
  const r = await fetch(BASE + '/')
  const html = await r.text()
  check('GET / 200', r.status === 200)
  const m = html.match(/src="([^"]*index-[^"]*\.js)"/)
  const entry = m && m[1]
  console.log('   index.html 入口 =', entry)
  check('index.html 引用带哈希的入口包', !!entry)

  // 入口包可达
  const entryText = entry ? await (await fetch(BASE + entry)).text() : ''
  if (entry) check('入口包可下载', entryText.length > 1000)

  // ⚠ 各字符串落在哪个分包是**构建细节**,不要假设都在 PanelxList 里(踩过):
  //   菜单面板名(样品编号表)→ 入口包 index-*.js
  //   面板组件(ProdDocListSheet/RecordSheetPanels、4 变体名)→ 各自懒分包
  // 故这里按"整个 static 产物集合"来查,而不是钉死某一块。
  const assets = [
    entry || '',
    // PanelxList 懒分包名可从入口包解析
    (entryText.match(/PanelxList-([A-Za-z0-9_-]+)\.js/) || [])[0] || '',
    // RecordSheetPanels 懒分包(Phase 4 的 4 变体名与 工艺形态 在这里)
    ...(await listAssetNames()).filter((n) => /^RecordSheetPanels-/.test(n)),
  ].filter(Boolean)
  console.log('   参与检查的产物 =', assets.join(', '))

  const texts = new Map()
  for (const a of assets) {
    // ⚠ 入口包路径从 index.html 抓来时就带 `/assets/` 前缀,而已知分包名只有文件名 ⇒
    //   统一走一个 urlOf 归一化,避免 /assets//assets/... 这种双前缀(fetch 404 → 内容为空 → 假失败)
    const url = a.startsWith('/assets/') ? a : '/assets/' + a
    const r = await fetch(BASE + url)
    texts.set(a, r.status === 200 ? await r.text() : '')
  }
  const inAny = (needle) => [...texts.entries()].filter(([, t]) => t.includes(needle)).map(([f]) => f)
  for (const needle of ['产品文件列表', '样品编号表', '复合半成品', '工艺形态']) {
    const where = inAny(needle)
    check(`产物内含「${needle}」`, where.length > 0, where.length ? '' : '所有分包都没找到')
    if (where.length) console.log(`      ${needle} → ${where.join(', ')}`)
  }

  // 菜单接口:新面板应出现在可见面板里
  const lj = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const vip = (lj.data.user.visiblePanels) || []
  console.log('\n   admin visiblePanels 数 =', vip.length)
  check('admin 可见面板含 RD_PROD_DOCLIST', vip.includes('RD_PROD_DOCLIST') || vip.includes('*'))
  check('admin 可见面板含 RD_SAMPLE_NO', vip.includes('RD_SAMPLE_NO') || vip.includes('*'))

  // 普通用户:应能看见两面(刚补的授权行)
  const lj2 = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'user1', password: '123456' }),
  })).json()
  if (lj2.code === 200) {
    const vip2 = (lj2.data.user.visiblePanels) || []
    console.log('   普通用户 user1 visiblePanels 数 =', vip2.length)
    check('普通用户可见 RD_PROD_DOCLIST', vip2.includes('RD_PROD_DOCLIST'), '')
    check('普通用户可见 RD_SAMPLE_NO', vip2.includes('RD_SAMPLE_NO'), '')
  } else {
    console.log('   (无 user1 账号,跳过普通用户可见性检查:', lj2.message, ')')
  }

  console.log(`\n结果:${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
