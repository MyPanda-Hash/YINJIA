/* 端到端闭环:证实首页库存卡片**真的能显示数字**(任务 1b 步骤 4 的"不能只看编译通过")。
   做法:临时插 2 行探针流水(inh 1 行 / outh 1 行,各自今天日期)→ 调 /api/dashboard/stats
        → 断言 totalIn/totalOut/totalLines/trend7 今天那一点 = 预期值 → **finally 精确删除探针行**。
   安全性:行带 __probe_1b 前缀的单据编号,删除条件精确到 (src, rid),不碰任何真实数据;
          且全部走 finally,脚本异常也会清理。绝不提交任何数据。
   用法: node tools/archive/_probe-dashboard-stock-e2e.cjs
*/
const API = process.env.YINJIA_API || 'http://127.0.0.1:8090'
const DB = process.env.YINJIA_SQL_DB || 'HSDZ_MES'
const TAG = '__probe_1b'
const RID_IN = 990001n, RID_OUT = 990002

const { execFileSync } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const root = path.resolve(__dirname, '..', '..')
const JDBC = path.join(root, 'tools', 'lib', 'mssql-jdbc.jar')

function sql(javaBody) {
  const src = [
    'import java.sql.*;',
    'public class E2eSql { public static void main(String[] a) throws Exception {',
    '  Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=' + DB + ';encrypt=false;loginTimeout=10","yinjia","Yinjia@2026");',
    '  Statement s = c.createStatement();',
    javaBody,
    '  c.close(); }}',
  ].join('\n')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-e2e-'))
  fs.writeFileSync(path.join(dir, 'E2eSql.java'), src)
  const out = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', JDBC, path.join(dir, 'E2eSql.java')],
    { cwd: root, encoding: 'utf8' })
  fs.rmSync(dir, { recursive: true, force: true })
  return out.trim()
}

const cleanup = () => sql([
  '  s.executeUpdate("DELETE FROM inh  WHERE src=1 AND rid=' + RID_IN + '");',
  '  s.executeUpdate("DELETE FROM outh WHERE src=5 AND rid=' + RID_OUT + '");',
  '  ResultSet r = s.executeQuery("SELECT (SELECT COUNT(*) FROM inh WHERE 单据编号 LIKE N\'' + TAG + '%\' ) AS i, (SELECT COUNT(*) FROM outh WHERE 单据编号 LIKE N\'' + TAG + '%\') AS o");',
  '  r.next(); System.out.println("清理后残留探针行 inh=" + r.getInt(1) + " outh=" + r.getInt(2));',
].join('\n'))

let fails = 0
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++ }

async function main() {
  console.log('-- 清理历史残留(幂等前置) --'); console.log(cleanup())
  console.log('-- 插入 2 行探针流水 --')
  console.log(sql([
    '  s.executeUpdate("INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 数量, asp_cancel) VALUES (1, ' + RID_IN + ', N\'' + TAG + '_IN\', N\'采购入库单\', GETDATE(), N\'__probe\', 7, \'N\')");',
    '  s.executeUpdate("INSERT INTO outh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 数量, asp_cancel) VALUES (5, ' + RID_OUT + ', N\'' + TAG + '_OUT\', N\'销售出库单\', GETDATE(), N\'__probe\', 3, \'N\')");',
    '  ResultSet r = s.executeQuery("SELECT (SELECT COUNT(*) FROM inh WHERE 单据编号 LIKE N\'' + TAG + '%\') AS i, (SELECT COUNT(*) FROM outh WHERE 单据编号 LIKE N\'' + TAG + '%\') AS o");',
    '  r.next(); System.out.println("插入后探针行 inh=" + r.getInt(1) + " outh=" + r.getInt(2));',
  ].join('\n')))

  try {
    const lr = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'admin', password: '123456' }),
    })
    const token = (await lr.json()).data.token
    const res = await fetch(`${API}/api/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } })
    const stock = (await res.json()).data.stock
    console.log('   stock = ' + JSON.stringify(stock))
    ok(stock.totalIn >= 1, `totalIn(入库单数) ≥ 1 → ${stock.totalIn}  ← 卡片显示数字,不再为空`)
    ok(stock.totalOut >= 1, `totalOut(出库单数) ≥ 1 → ${stock.totalOut}`)
    ok(stock.totalLines >= 2, `totalLines(入+出行数) ≥ 2 → ${stock.totalLines}`)
    const last = stock.trend7[stock.trend7.length - 1]
    ok(last.added >= 1, `trend7 最后一天 added(入库) ≥ 1 → ${last.date} added=${last.added}`)
    ok(last.done >= 1, `trend7 最后一天 done(出库) ≥ 1 → ${last.date} done=${last.done}`)
    ok(stock.panels.some(p => p.panelName === '入库' && p.count >= 1 && p.lines >= 1),
      'panels 入库条 count/lines 均有值(卡片子项有数)')
  } finally {
    console.log('-- finally 清理探针行 --')
    console.log(cleanup())
  }

  const after = sql('  ResultSet r = s.executeQuery("SELECT (SELECT COUNT(*) FROM inh) AS i, (SELECT COUNT(*) FROM outh) AS o"); r.next(); System.out.println("清理后 inh=" + r.getInt(1) + " outh=" + r.getInt(2) + "(应回到 0/0)");')
  console.log('   ' + after)
  ok(/inh=0 outh=0/.test(after), '清理后 inh/outh 回到 0 行(未留脏数据)')

  console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL-${fails}`)
  process.exit(fails === 0 ? 0 : 1)
}
main().catch(async e => {
  console.error('FAIL:', e.message)
  try { console.log(cleanup()) } catch (x) { console.error('清理失败,需人工检查: ' + x.message) }
  process.exit(1)
})
