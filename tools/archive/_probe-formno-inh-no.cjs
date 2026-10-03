/* 复现 FormNoService.exists() 的硬故障(任务 1 遗留):
   exists() 里 UNION 了 `SELECT TOP 1 inh_no FROM inh WHERE inh_no = ?`,而 inh 重建后已无 inh_no 列
   ⇒ 每次生成单号(新增/保存单据)都会抛「列名 'inh_no' 无效」。
   做法:对一张**单表式单据面板**调 callButton「新增」(空表单)建空白草稿 —— 成功即说明单号可生成;
        无论成败都在 finally 里删掉本次建出的草稿。
   用法: node tools/archive/_probe-formno-inh-no.cjs [panelCode]   (默认 SO_ORDER)
*/
const API = process.env.YINJIA_API || 'http://127.0.0.1:8090'
const DB = process.env.YINJIA_SQL_DB || 'HSDZ_MES'
const PANEL = process.argv[2] || 'SO_ORDER'

const { execFileSync } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const root = path.resolve(__dirname, '..', '..')
const JDBC = path.join(root, 'tools', 'lib', 'mssql-jdbc.jar')

function sql(body) {
  const src = [
    'import java.sql.*;',
    'public class FnSql { public static void main(String[] a) throws Exception {',
    '  Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=' + DB + ';encrypt=false;loginTimeout=10","yinjia","Yinjia@2026");',
    '  Statement s = c.createStatement();',
    body,
    '  c.close(); }}',
  ].join('\n')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fn-'))
  fs.writeFileSync(path.join(dir, 'FnSql.java'), src)
  const out = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', JDBC, path.join(dir, 'FnSql.java')],
    { cwd: root, encoding: 'utf8' })
  fs.rmSync(dir, { recursive: true, force: true })
  return out.trim()
}

async function main() {
  const lr = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const token = (await lr.json()).data.token
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // 面板元数据:行表键与单据号字段名(数据键恒为中文,ADR-0001)
  const cfg = await (await fetch(`${API}/api/px/getPanelConfig?panelCode=${PANEL}`, { headers: H })).json()
  const meta = cfg.data?.metadata || {}
  const codeField = meta.autoCodeField || '单据编号'    // 实测 SO_ORDER 的 autoCodeField = 单据编号
  console.log(`面板 ${PANEL}: autoCodeField=${codeField} panelName=${meta.panelName}`)

  let createdNo = null
  try {
    const r = await fetch(`${API}/api/px/callButton`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: PANEL, buttonName: '新增', formData: {}, buttonParam: {} }),
    })
    const j = await r.json()
    console.log(`callButton 新增 → HTTP ${r.status} body=${JSON.stringify(j).slice(0, 400)}`)
    // 注意:面板配置里该字段叫 单据编号,而「新增」响应的数据键叫 编号 —— 两者不同名,故都试
    createdNo = j.data?.[codeField] || j.data?.['编号'] || null
    console.log(createdNo ? `✓ 单号生成成功: ${createdNo}(说明 exists() 不再抛错)` : `✗ 未取得单号`)
    // 关键判据:HTTP 500 + error 207「列名 'inh_no' 无效」= 旧故障;200 且有单号 = 已修好
    const brokeWithInhNo = r.status >= 500 && /inh_no/.test(JSON.stringify(j))
    if (brokeWithInhNo) { console.log('✗ 仍是旧故障(FormNoService.exists 读 inh.inh_no)'); process.exitCode = 1 }
    else process.exitCode = createdNo ? 0 : 1
  } catch (e) {
    console.log(`✗ callButton 新增 抛错: ${e.message}`)
    process.exitCode = 1
  } finally {
    console.log(createdNo
      ? `-- 本次「新增」只在号池 s_allno 领取了 ${createdNo} 这一号(该表按设计不回收),未落任何业务行 --`
      : '-- 未建出任何单据 --')
  }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
