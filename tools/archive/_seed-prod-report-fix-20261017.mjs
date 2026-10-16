/**
 * _seed-prod-report-fix-20261017.mjs — 修正造数第③步(报工单):
 *   ① 清掉上一版误建的**空草稿**(用 保存为草稿 + 完整 formData 但没带单号 ⇒ 引擎只建了空行);
 *   ② 按 app 自己的两步法重建:先「保存」(空表单)拿单号 → 再「保存」带 报工单号 + 各字段。
 *
 * 单号键 = yj_panel.code_col = **报工单号**(不是"单据编号");空行也带 报工单号,故可识别删除。
 * 用法:node tools/archive/_seed-prod-report-fix-20261017.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'http://127.0.0.1:8090';
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const mssql = createRequire(join(ROOT, 'deploy', 'package.json'))('mssql');

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json());
const H = { Authorization: 'Bearer ' + login.data.token, 'Content-Type': 'application/json' };
const post = async (p, b) => {
  const r = await fetch(`${BASE}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};

const db = await mssql.connect({
  server: cfg.database.server, port: cfg.database.port || 1433, database: 'HSDZ_MES',
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
const q = async (sql) => (await db.request().query(sql)).recordset;

// ── ① 清掉误建的空草稿 ──
const blanks = await q(`SELECT id, [报工单号] AS no FROM scjl WHERE [报工单号] IN ('BG-2026-10-0048','BG-2026-10-0049')`);
console.log(`误建空草稿 ${blanks.length} 行:`, blanks.map((b) => b.no).join(', '));
if (blanks.length) {
  const del = await post('/px/deleteForms', { panelCode: 'WO_REPORT', rowCodes: blanks.map((b) => b.no) });
  console.log(`  /px/deleteForms → HTTP ${del.status}`, JSON.stringify(del.j).slice(0, 200));
  const left = await q(`SELECT COUNT(*) AS n FROM scjl WHERE [报工单号] IN ('BG-2026-10-0048','BG-2026-10-0049') AND ISNULL(asp_cancel,'N')<>'Y'`);
  console.log(`  删除后仍有效:${left[0].n} 行(0 = 已清)`);
}

// ── ② 按两步法重建报工单(挂到刚造的工单行上) ──
const TARGETS = [
  { 工单号: 'GD-2026-10-0009', 工单行号: '1', 工序: '混料', 数量: 600, 生产线: '1号机' },
  { 工单号: 'GD-2026-10-0010', 工单行号: '1', 工序: '成型', 数量: 3000, 生产线: '2号机' },
];
console.log('\n=== 重建报工单(两步:先建单拿号 → 再填字段保存) ===');
for (const t of TARGETS) {
  const step1 = await post('/px/callButton', { panelCode: 'WO_REPORT', buttonName: '保存', formData: {}, buttonParam: {} });
  const no = step1.j?.data?.['编号'] || step1.j?.data?.formNo || '';
  console.log(`  ${t.工单号} 建单 → HTTP ${step1.status} 单号=${no || JSON.stringify(step1.j).slice(0, 150)}`);
  if (!no) continue;
  const step2 = await post('/px/callButton', {
    panelCode: 'WO_REPORT', buttonName: '保存', buttonParam: {},
    formData: {
      报工单号: no,
      单据日期: new Date().toISOString().slice(0, 10),
      工单号: t.工单号,
      工单行号: t.工单行号,
      工序: t.工序,
      报工数量: t.数量,
      生产线: t.生产线,
      报工人: 'admin',
      备注: '造数(YJ-20261017 生产链测试数据)',
    },
  });
  console.log(`     填字段保存 → HTTP ${step2.status} ${JSON.stringify(step2.j?.data ?? step2.j).slice(0, 160)}`);
  const row = (await q(`SELECT TOP 1 id, [报工单号] AS no, tm, gldh, gd_id, gxdm, sl, scx, wgzt, bz FROM scjl WHERE [报工单号]='${no}'`))[0];
  console.log(`     落库:${row ? `id=${row.id} 单号=${row.no} 工单号=${row.tm} 行号=${row.gldh} gd_id=${row.gd_id} 工序=${row.gxdm} 数量=${row.sl} 线=${row.scx} 完工状态=${row.wgzt ?? '(空=草稿)'}` : '(未找到该单号的行)'}`);
}

const cnt = await q(`SELECT COUNT(*) AS n FROM scjl WHERE ISNULL(asp_cancel,'N')<>'Y'`);
console.log(`\nscjl 有效行数 = ${cnt[0].n}`);
await db.close();
