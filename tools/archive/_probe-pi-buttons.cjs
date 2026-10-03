/* 临时探针(任务产物,提交归 tools/archive):验证 PURCHASE_IN 打印组按钮下发。
 * 用法:node _probe-pi-buttons.cjs */
const BASE = 'http://127.0.0.1:8090/api'
async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json())
  const cfg = await fetch(`${BASE}/px/getPanelConfig?panelCode=PURCHASE_IN`, {
    headers: { Authorization: `Bearer ${login?.data?.token}` },
  }).then((r) => r.json())
  const groups = cfg?.data?.metadata?.buttonGroups || []
  const printGroup = groups.find((g) => g.name === '打印')
  console.log('PURCHASE_IN 打印组 =', JSON.stringify(printGroup?.actions))
}
main().catch((e) => { console.error(e); process.exit(1) })
