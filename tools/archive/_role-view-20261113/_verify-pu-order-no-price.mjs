/*
 * _verify-pu-order-no-price.mjs —— 采购订单「单价/仓库」可留空的**真实保存**验证(测试库)
 *
 * 做法:带 `单价: ''`、`仓库: ''` 的键(与界面清空后的载荷同形)走一次「保存为草稿」;
 * 改之前这两列 required=1 时后端会 400「明细第 1 行单价不能为空」,改之后应当通过。
 * 验完把这张草稿删掉,不留测试数据。
 *
 * 用法: node tools/archive/_role-view-20261113/_verify-pu-order-no-price.mjs [http://127.0.0.1:8090]
 */
import fs from 'node:fs'

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
let pass = 0, fail = 0
const lines = []
const ok = (c, m, extra = '') => {
  if (c) { pass++; console.log(`  ✅ ${m} ${extra}`); lines.push(`✅ ${m} ${extra}`) }
  else { fail++; console.log(`  ❌ ${m} ${extra}`); lines.push(`❌ ${m} ${extra}`) }
}
const post = async (p, body, token) => {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* ignore */ }
  return { status: r.status, json, text }
}
const get = async (p, token) => {
  const r = await fetch(BASE + p, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  return { status: r.status, json: await r.json().catch(() => null) }
}

const main = async () => {
  console.log(`== 采购订单:单价/仓库 留空能否保存 @ ${BASE}(测试库) ==`)
  const lg = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
  const token = lg.json?.data?.token
  if (!token) throw new Error('登录失败: ' + lg.text.slice(0, 160))

  // 取一个可用供应商 + 物料(测试库主数据)
  const cfg = await get('/api/px/getPanelConfig?panelCode=PU_ORDER&view=system', token)
  const head = (cfg.json?.data?.dataSchema?.fields || []).map((f) => f.dataName)
  ok(head.length > 0, '取到面板配置', `${head.length} 个表头字段`)

  const ref = await get('/api/px/queryRefRows?panelCode=PU_ORDER&refPanel=GFDA&keyword=', token)
  const sup = (ref.json?.data?.rows || ref.json?.data || [])[0]
  const invRef = await get('/api/px/queryRefRows?panelCode=PU_ORDER&refPanel=INV&keyword=', token)
  const inv = (invRef.json?.data?.rows || invRef.json?.data || [])[0]
  if (!sup || !inv) {
    console.log('  (跳过:测试库取不到供应商/物料主数据,无法造单)')
    console.log(`\n结果: PASS ${pass} / FAIL ${fail} (未执行保存用例)`)
    process.exit(0)
  }
  const supCode = sup['供应商编码'] || sup['供应商代码'] || sup.code
  const invCode = inv['存货编码'] || inv['物料编码'] || inv.code
  console.log(`  主数据: 供应商=${supCode} 物料=${invCode}`)

  const formData = {
    单据日期: new Date().toISOString().slice(0, 10),
    供应商编码: supCode,
    供应商: sup['供应商名称'] || sup.name || supCode,
    items: [{
      物料编码: invCode,
      物料名称: inv['存货名称'] || inv.name || invCode,
      数量: 1,
      单价: '',        // ← 关键:清空状态
      仓库: '',        // ← 关键:清空状态
    }],
  }
  const save = await post('/api/px/callButton', {
    panelCode: 'PU_ORDER', buttonName: '保存为草稿', formData, buttonParam: {},
  }, token)
  const msg = save.json?.message || save.text.slice(0, 200)
  ok(save.json?.code === 200 || save.status === 200, '带空「单价/仓库」的草稿保存成功', `code=${save.json?.code} msg=${msg}`)
  ok(!/不能为空/.test(msg), '没有被必填校验拦下', msg)

  // 收尾:删掉这张草稿
  const docNo = save.json?.data?.单据编号 || save.json?.data?.code || save.json?.data?.docNo
  if (docNo) {
    const del = await post('/api/px/deleteForms', { panelCode: 'PU_ORDER', rowCodes: [docNo] }, token)
    ok(del.json?.code === 200, '清理测试草稿', `${docNo}`)
  } else {
    console.log('  (未拿到单据编号,请到采购订单里手工确认是否有残留草稿)')
  }

  console.log(`\n结果: PASS ${pass} / FAIL ${fail}`)
  lines.push(`\n结果: PASS ${pass} / FAIL ${fail}`)
  fs.writeFileSync('tools/archive/_role-view-20261113/_verify-pu-order-out.txt', lines.join('\n'), 'utf8')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('中断:', e.message); process.exit(2) })
