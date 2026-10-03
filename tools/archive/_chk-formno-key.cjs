/* 求证:PanelFacade 返回的单号键到底叫什么(我先前用「编号」查库报「列名无效」,须弄清是键名问题还是编码问题)。
   做法:调 getNewFormPermMatrix 取面板默认值,看数据里有哪几个键;再按返回的键名去库里查该列是否存在。
   只读,不写库。用法: node tools/archive/_chk-formno-key.cjs
*/
const API = process.env.YINJIA_API || 'http://127.0.0.1:8090'
const DB = process.env.YINJIA_SQL_DB || 'HSDZ_MES'
const { execFileSync } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const root = path.resolve(__dirname, '..', '..')

function runSql(queries) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-k-'))
  fs.writeFileSync(path.join(d, 'q.sql'), queries.join('\n@@\n'), 'utf8')
  const java = [
    'import java.sql.*; import java.nio.file.*; import java.nio.charset.StandardCharsets;',
    'public class K { public static void main(String[] a) throws Exception {',
    '  Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=' + DB + ';encrypt=false","yinjia","Yinjia@2026");',
    '  Statement s = c.createStatement();',
    '  String all = new String(Files.readAllBytes(Paths.get(a[0])), StandardCharsets.UTF_8);',
    '  for (String q : all.split("@@")) { q = q.trim(); if (q.isEmpty()) continue;',
    '    try { boolean hs = s.execute(q);',
    '      if (hs) { ResultSet r = s.getResultSet();',
    '        while (r.next()) { StringBuilder b = new StringBuilder("  ");',
    '          for (int i = 1; i <= r.getMetaData().getColumnCount(); i++) b.append(i>1?" | ":"").append(r.getString(i));',
    '          System.out.println(b); } }',
    '      else System.out.println("  (影响 " + s.getUpdateCount() + " 行)");',
    '    } catch (SQLException e) { System.out.println("  [ERR] " + q.substring(0, Math.min(50, q.length())) + " => " + e.getMessage().split("\\n")[0]); }',
    '  }',
    '  c.close(); }}',
  ].join('\n')
  const src = path.join(d, 'K.java')
  fs.writeFileSync(src, java, 'utf8')
  const out = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', path.join(root, 'tools', 'lib', 'mssql-jdbc.jar'), src, path.join(d, 'q.sql')], { cwd: root, encoding: 'utf8' })
  fs.rmSync(d, { recursive: true, force: true })
  return out.trim()
}

async function main() {
  const lr = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const token = (await lr.json()).data.token
  const r = await fetch(`${API}/api/px/getNewFormPermMatrix?panelCode=SO_ORDER`, { headers: { Authorization: `Bearer ${token}` } })
  const j = await r.json()
  const data = j.data?.data || {}
  console.log('getNewFormPermMatrix.data 的键 =', JSON.stringify(Object.keys(data)))
  const codeKey = Object.keys(data).find(k => /编号|NO|no|单号/.test(k)) || Object.keys(data)[0]
  console.log('推测的单号键 =', JSON.stringify(codeKey), '| 值 =', JSON.stringify(data[codeKey]))
  console.log('库里是否存在该列名(键名/列名一致性求证):')
  console.log(runSql([
    "SELECT COL_LENGTH('bd_so_order', N'" + codeKey + "') AS 该键作列名时的长度",
    "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('bd_so_order') AND (name LIKE N'%编号%' OR name = N'编号')",
  ]))
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
