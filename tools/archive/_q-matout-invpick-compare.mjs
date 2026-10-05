// _q-matout-invpick-compare.mjs — 材料出库单字段 ↔ 金蝶「生产领料单 inv_pick」对照取证(只读)
//
// 做三件事(全部只读,不写任何单据):
//   ① 金蝶侧:真实账套(deploy/config.json,动态授权)拉 inv_pick 列表 + 详情 → 头键/行键全集;
//      顺带测 deploy/push/config.json(测试沙箱,静态密钥)的 app-token 是否可用;
//   ② MES 侧:两账套 bd_material_out / bl_material_out 的「列 ↔ 接口键」映射(取自列 MS_Description)+ yj_field 注册;
//   ③ 对照:金蝶键 → MES 是否有列承接;MES 列 → 键是否仍存在于金蝶;两侧差集与理由。
//
// 用法: node tools/archive/_q-matout-invpick-compare.mjs [--no-live]
//   --no-live: 不联网,用 tools/archive/_invpick-fields.json(2026-09-28 真实账套实测快照)当金蝶侧基线
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const require = createRequire('file:///D:/YINJIA-main/deploy/package.json');
const sql = require('mssql');

const REPO = new URL('../../', import.meta.url);
const NO_LIVE = process.argv.includes('--no-live');
const out = { at: new Date().toISOString(), kingdee: {}, mes: {}, diff: {} };

// ────────── ① 金蝶侧 ──────────
const P = '/jdy/v2/scm/inv_pick';
const realCfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const sandCfg = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8'));

let kingdeeKeys = { header: [], line: [], source: '' };
if (!NO_LIVE) {
  try {
    const { token } = await fetchAppToken(realCfg.kingdee);
    console.log('✅ 真实账套 app-token 获取成功(动态授权)');
    const list = await kingdeeTryGet(realCfg.kingdee, token, P, { page: '1', page_size: '5' });
    if (!list.ok) throw new Error(list.error);
    const rows = list.data.rows || [];
    const detail = await kingdeeTryGet(realCfg.kingdee, token, P + '_detail', { id: rows[0].id });
    if (!detail.ok) throw new Error(detail.error);
    kingdeeKeys.header = Object.keys(detail.data).filter((k) => !Array.isArray(detail.data[k]));
    for (const [k, v] of Object.entries(detail.data)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') kingdeeKeys.line = [...new Set(v.flatMap((x) => Object.keys(x)))];
    }
    kingdeeKeys.source = `live(真实账套 ${new Date().toISOString().slice(0, 10)}, count=${list.data.count})`;
    out.kingdee = { count: Number(list.data.count), headerKeys: kingdeeKeys.header, lineKeys: kingdeeKeys.line, source: kingdeeKeys.source };
    console.log(`✅ 真实账套 inv_pick 单据数 = ${list.data.count};头键 ${kingdeeKeys.header.length} / 行键 ${kingdeeKeys.line.length}`);
  } catch (e) {
    console.log('❌ 真实账套只读探针失败:', e.message);
  }
}
if (!kingdeeKeys.header.length) {
  const snap = JSON.parse(readFileSync(new URL('./_invpick-fields.json', import.meta.url), 'utf8'));
  kingdeeKeys.header = snap.detailKeys || [];
  kingdeeKeys.line = (snap.subKeys && snap.subKeys.material_entity) || [];
  kingdeeKeys.source = 'snapshot(tools/archive/_invpick-fields.json,2026-09-28 真实账套实测)';
  out.kingdee = { count: snap.count, headerKeys: kingdeeKeys.header, lineKeys: kingdeeKeys.line, source: kingdeeKeys.source };
  console.log(`ℹ️ 金蝶侧改用快照基线:头键 ${kingdeeKeys.header.length} / 行键 ${kingdeeKeys.line.length}`);
}

// 测试沙箱凭证(转ERP 实际目标)可用性
try {
  await fetchAppToken(sandCfg.kingdee);
  out.kingdee.sandboxToken = 'ok';
  console.log('✅ 测试沙箱(转ERP 目标)app-token 可用');
} catch (e) {
  out.kingdee.sandboxToken = e.message;
  console.log('❌ 测试沙箱(转ERP 目标)app-token 不可用:', e.message);
}

// ────────── ② MES 侧 ──────────
const dbCfg = sandCfg.database;
async function mesSide(database) {
  const pool = await sql.connect({
    server: dbCfg.server, port: dbCfg.port, user: dbCfg.user, password: dbCfg.password,
    database, options: { encrypt: false, trustServerCertificate: true },
  });
  const cols = (await pool.request().query(`
    SELECT t.name AS tbl, c.name AS col, ISNULL(CAST(ep.value AS nvarchar(400)), N'') AS descr
    FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
    LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name='MS_Description'
    WHERE t.name IN ('bd_material_out','bl_material_out') ORDER BY t.name, c.column_id`)).recordset;
  const fields = (await pool.request().query(`
    SELECT col_name, label, place, visible, hidden, seq FROM yj_field WHERE panel_code='MATERIAL_OUT'`)).recordset;
  const docs = (await pool.request().query('SELECT COUNT(*) AS n FROM bd_material_out')).recordset[0].n;
  await pool.close();
  const map = { header: {}, line: {}, unmappedCols: [] };
  for (const r of cols) {
    const m = /inv_pick\)\s*接口键\s*([A-Za-z0-9_]+)/.exec(r.descr);
    const key = m ? m[1] : null;
    const bucket = r.tbl === 'bd_material_out' ? map.header : map.line;
    if (key) (bucket[key] = bucket[key] || []).push(`${r.col}`);
    else map.unmappedCols.push(`${r.tbl}.${r.col}`);
  }
  return { columns: cols.length, mappedCols: cols.length - map.unmappedCols.length, map, fields: fields.length, visible: fields.filter((f) => !f.hidden && f.visible).length, docs };
}
for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) {
  try {
    out.mes[db] = await mesSide(db);
    console.log(`✅ ${db}:列映射 ${out.mes[db].mappedCols}/${out.mes[db].columns},yj_field ${out.mes[db].fields}(显示 ${out.mes[db].visible}),材料出库单 ${out.mes[db].docs} 张`);
  } catch (e) {
    out.mes[db] = { error: e.message };
    console.log(`❌ ${db} 查询失败:`, e.message);
  }
}

// ────────── ③ 对照 ──────────
const pick = out.mes.HSDZ_MES;
if (pick && pick.map) {
  const mappedKeys = new Set([...Object.keys(pick.map.header), ...Object.keys(pick.map.line)]);
  // 容器/自定义键:不是业务字段,天然无列承接
  const CONTAINER = new Set(['material_entity', 'custom_field', 'custom_entity_field']);
  const gaps = [];
  for (const k of kingdeeKeys.header) if (!mappedKeys.has(k) && !CONTAINER.has(k)) gaps.push(`头.${k}`);
  for (const k of kingdeeKeys.line) if (!mappedKeys.has(k) && !CONTAINER.has(k)) gaps.push(`行.${k}`);
  const extras = [...mappedKeys].filter((k) => !kingdeeKeys.header.includes(k) && !kingdeeKeys.line.includes(k) && !CONTAINER.has(k));
  out.diff = {
    kingdeeKeys: kingdeeKeys.header.length + kingdeeKeys.line.length,
    container: [...CONTAINER],
    gaps, extras,
    mappedHeaderKeys: Object.keys(pick.map.header).length,
    mappedLineKeys: Object.keys(pick.map.line).length,
  };
  console.log(`\n【对照】金蝶键 ${kingdeeKeys.header.length}(头)+${kingdeeKeys.line.length}(行)=${out.diff.kingdeeKeys} 个`);
  console.log(`  MES 承接:头 ${out.diff.mappedHeaderKeys} 键 / 行 ${out.diff.mappedLineKeys} 键`);
  console.log(`  金蝶有、MES 无列承接(${gaps.length}):${gaps.join(', ') || '(无)'}`);
  console.log(`  MES 有列、当前金蝶键集里没有(${extras.length}):${extras.join(', ') || '(无)'}`);
}
writeFileSync(new URL('./_q-matout-invpick-compare.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('\n已写出 tools/archive/_q-matout-invpick-compare.json');
await sql.close();
