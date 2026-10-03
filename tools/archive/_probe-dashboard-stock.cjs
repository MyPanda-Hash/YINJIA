/* 首页库存卡片探针(任务 1b 验证):
   端点 = ShellController(@RequestMapping "/api" + @GetMapping "/dashboard/stats") ⇒ GET /api/dashboard/stats
   (计划里写的 /api/portal/stats 不存在;PortalController 只管角标与通知)
   断言 ① /api/dashboard/stats 的 stock 段不再退化为空结构 —— panels 必须是**两条**(入库/出库),
          且 totalIn/totalOut/totalLines/trend7/topItems 键都在;
   断言 ② 对照实验:同一张表用**重建前的旧列名**读会抛「列名无效」,证明该处确有 catch 吞错
          (即改列名之前卡片为空是真实故障,不是巧合)。
   用法: node tools/archive/_probe-dashboard-stock.cjs
         YINJIA_API / YINJIA_SQL_DB 可覆盖(默认 http://127.0.0.1:8090 + HSDZ_MES)
*/
const API = process.env.YINJIA_API || 'http://127.0.0.1:8090'
const DB = process.env.YINJIA_SQL_DB || 'HSDZ_MES'
const STATS_PATH = '/api/dashboard/stats'

let fails = 0
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++ }

async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const j = await r.json()
  if (!j.data?.token) throw new Error('登录失败: ' + JSON.stringify(j))
  return j.data.token
}

async function main() {
  const token = await login()
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const res = await fetch(`${API}${STATS_PATH}`, { headers: H })
  const body = await res.json()
  ok(res.status === 200, `GET ${STATS_PATH} → HTTP ${res.status}`)
  const stock = body.data?.stock
  ok(!!stock, '响应含 data.stock')
  if (!stock) { console.log(JSON.stringify(body).slice(0, 500)); process.exit(1) }

  console.log('   stock = ' + JSON.stringify(stock))
  ok(Array.isArray(stock.panels) && stock.panels.length === 2,
    `stock.panels 有两条(入库/出库)→ 实际 ${Array.isArray(stock.panels) ? stock.panels.length : typeof stock.panels} 条`)
  ok(stock.panels?.[0]?.panelName === '入库', `panels[0].panelName = 入库 → ${stock.panels?.[0]?.panelName}`)
  ok(stock.panels?.[1]?.panelName === '出库', `panels[1].panelName = 出库 → ${stock.panels?.[1]?.panelName}`)
  ok(Array.isArray(stock.trend7) && stock.trend7.length === 7,
    `trend7 是 7 个点 → 实际 ${Array.isArray(stock.trend7) ? stock.trend7.length : typeof stock.trend7}`)
  ok(Array.isArray(stock.topItems), `topItems 是数组 → ${Array.isArray(stock.topItems)}`)
  ok(typeof stock.totalIn === 'number', `totalIn 是数字 → ${stock.totalIn}`)
  ok(typeof stock.totalOut === 'number', `totalOut 是数字 → ${stock.totalOut}`)
  ok(typeof stock.totalLines === 'number', `totalLines 是数字 → ${stock.totalLines}`)

  // 对照实验:旧列名 vs 新列名(证明"改列名前确实报错被 catch 吞掉")
  console.log(`\n   [对照] 账套 ${DB}:旧列名应当失败、新列名应当通过`)
  const { execFileSync } = require('node:child_process')
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
  const probe = [
    'import java.sql.*;',
    'public class CmpChk { public static void main(String[] a) throws Exception {',
    '  Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=' + DB + ';encrypt=false;loginTimeout=10","yinjia","Yinjia@2026");',
    '  String[] qs = {"SELECT COUNT(DISTINCT inh_no) FROM inh", "SELECT COUNT(DISTINCT outh_no) FROM outh",',
    '    "SELECT in_date FROM inh WHERE 1=0", "SELECT out_date FROM outh WHERE 1=0",',
    '    "SELECT COUNT(DISTINCT 单据编号) FROM inh", "SELECT COUNT(DISTINCT 单据编号) FROM outh"};',
    '  for (String sql : qs) {',
    '    try (Statement s = c.createStatement()) { s.executeQuery(sql); System.out.println("  OK   " + sql); }',
    '    catch (SQLException e) { System.out.println("  FAIL " + sql + "  ==> " + e.getMessage().split("\\n")[0]); }',
    '  }',
    '  c.close(); }}',
  ].join('\n')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cmp-'))
  fs.writeFileSync(path.join(dir, 'CmpChk.java'), probe)
  const root = path.resolve(__dirname, '..', '..')
  const out = execFileSync('java',
    ['-Dstdout.encoding=UTF-8', '-cp', path.join(root, 'tools', 'lib', 'mssql-jdbc.jar'), path.join(dir, 'CmpChk.java')],
    { cwd: root, encoding: 'utf8' })
  console.log(out.trimEnd())
  fs.rmSync(dir, { recursive: true, force: true })
  ok(/FAIL .*inh_no/.test(out), '旧列名 inh_no 确实报错(改列名前卡片为空的根因)')
  ok(/FAIL .*outh_no/.test(out), '旧列名 outh_no 确实报错')
  ok(/FAIL .*in_date/.test(out), '旧列名 in_date 确实报错')
  ok(/FAIL .*out_date/.test(out), '旧列名 out_date 确实报错')
  ok((out.match(/  OK /g) || []).length === 2, `新列名「单据编号」两条 SQL 都通过 → ${(out.match(/  OK /g) || []).length}/2`)

  console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL-${fails}`)
  process.exit(fails === 0 ? 0 : 1)
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
