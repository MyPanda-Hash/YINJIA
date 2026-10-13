/*
 * _clean-scjl-rowno-probe.mjs — 清理 _verify-scjl-rowno-save.mjs 在**测试库**造的报工草稿
 *
 * 背景:WO_REPORT 的「删除」按钮只置 yj_doc_status.canceled,**不写业务表 asp_cancel** ——
 *   scjl 单表式的软删标记得自己补,否则测试库留下存活草稿(2026-10-15 实测踩到)。
 *   本脚本按**报工单号精确圈定**软删,不做任何范围删除。
 * 用法: node tools/archive/_clean-scjl-rowno-probe.mjs BG-2026-10-0012 [更多单号...]
 *   (需在 tools/ 下执行;口令取 env YINJIA_SQL_PASS)
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const nos = process.argv.slice(2)
if (!nos.length) { console.error('用法: node _clean-scjl-rowno-probe.mjs <报工单号> [...]'); process.exit(2) }
const list = nos.map((n) => `N'${n.replace(/'/g, "''")}'`).join(', ')
const sql = `UPDATE dbo.scjl SET asp_cancel='Y', asp_user2=N'probe-cleanup', asp_time2=GETDATE()
WHERE [报工单号] IN (${list}) AND ISNULL(asp_cancel,'N')<>'Y';
SELECT [报工单号], ISNULL(asp_cancel,'N') AS 作废 FROM dbo.scjl WHERE [报工单号] IN (${list});
SELECT COUNT(*) AS 测试库存活报工行数 FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y';`

const tmp = path.join(os.tmpdir(), `_clean-scjl-${Date.now()}.sql`)
fs.writeFileSync(tmp, sql, 'utf8')
const JAVA = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java.exe') : 'java'
try {
  const out = execFileSync(JAVA, ['-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
    'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true',
    'yinjia', 'env', tmp], { cwd: path.resolve('tools'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  console.log(out)
} finally { try { fs.rmSync(tmp) } catch { /* ignore */ } }
