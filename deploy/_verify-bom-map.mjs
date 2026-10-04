/**
 * _verify-bom-map.mjs — BD_BOM(BOM单)映射自检(2026-10-04)
 *
 * 为什么要单独自检:正式账套 BOM 数据为 **0 条**(实测 count=0),同步器跑通也是空转,
 * 无法用真实数据验证「接口键 → 物理列」是否一一落地。故用**官方文档《BOM单列表》响应示例**
 * 作为夹具,验证三件事:
 *   ① mapArchive/mapLines 写出的每个列名,都真实存在于 bs_bom_head / bs_bom_detail;
 *   ② 面板(BOM_KD)登记的 45 个字段,全部能被映射写出(不多不少,面板不出现空列);
 *   ③ 表头键里「只给 id 无名称孪生」的键确实被有意跳过(不落空列,也不误建 id 列)。
 * 用法:node _verify-bom-map.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOCS } from './sync-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));

// ── 夹具:官方文档响应示例(open.jdy.com《BOM单列表》id 9c2c4958712511eda0b361e90d734914)──
const SAMPLE = {
  audit_time: '2022-04-01 21:54:47', auditor_id: '1420169116878110000', auditor_name: '名称', auditor_number: 'ABC',
  billsource: 'PMBD', bom_remark: '备注', create_time: '2022-04-01 21:54:47',
  creator_id: '1420169116878110000', creator_name: '名称', creator_number: 'ABC',
  enable: '1', id: '1420169116878110000', isskip: '1',
  material_entity: [{
    aux1_id: '1420169116878110000', aux2_id: '1420169116878110000', aux3_id: '1420169116878110000',
    aux4_id: '1420169116878110000', aux5_id: '1420169116878110000', custom_entity_field: {},
    custom_txt1: '备注1', custom_txt2: '备注2', custom_txt3: '备注3',
    dosage_denominator: '1', dosage_numerator: '1', fixed_loss: 1, id: '1420169116878110000',
    iskeypieces: '1', isrepitem: '1', issue_pattern: 'D', machinepos: 'LOCx1',
    material_auxprop_id: '1420169116878110000', material_baseunit_id: '1420169116878110000',
    material_id: '1420169116878110000', material_name: '10', material_number: '142', material_remark: '备注',
    material_unit_id: '1420169116878110000', scrap: 10, seq: 1, sp_id: '1', sp_name: '仓位A', sp_number: '001',
    stock_id: '1', stock_name: '仓库A', stock_number: '001', unitqty: 1,
  }],
  modifier_id: '1420169116878110000', modifier_name: '名称', modifier_number: 'ABC', modify_time: '2022-04-01 21:54:47',
  number: 'BOM123',
  product_aux1_id: '1', product_aux1_name: '名称', product_aux1_number: 'ABC',
  product_aux2_id: '1', product_aux2_name: '名称', product_aux2_number: 'ABC',
  product_aux3_id: '1', product_aux3_name: '名称', product_aux3_number: 'ABC',
  product_aux4_id: '1', product_aux4_name: '名称', product_aux4_number: 'ABC',
  product_aux5_id: '1', product_aux5_name: '名称', product_aux5_number: 'ABC',
  product_auxprop_id: '1', product_auxprop_name: '名称', product_auxprop_number: 'ABC',
  product_baseunit_id: '1', product_baseunit_name: '名称', product_baseunit_number: 'ABC',
  product_id: '1', product_name: '名称', product_number: 'ABC',
  product_unit_id: '1', product_unit_name: '名称', product_unit_number: 'ABC',
  status: 'Z', version: 'V1.0', yield: 100,
};

const doc = DOCS.find((d) => d.code === 'BD_BOM');
if (!doc) { console.error('✗ DOCS 里没有 BD_BOM'); process.exit(2); }

// 单位内码 → 名称 由 BD_UOM.afterList 登记;夹具里给一个假映射证明解析链路可用
const ctx = { uomNameById: new Map([['1420169116878110000', '千克']]) };
const head = doc.mapArchive(SAMPLE, ctx);
const lines = doc.mapLines(SAMPLE, ctx);

const mssql = (await import('mssql')).default;
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();

const colsOf = async (t) => {
  const rs = await new mssql.Request(pool).query(
    `SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.${t}')`);
  return new Set(rs.recordset.map((r) => r.name));
};
const headCols = await colsOf(doc.table);
const lineCols = await colsOf(doc.lineTable);
const fieldRs = await new mssql.Request(pool).query(
  `SELECT col_name, RTRIM(place) AS place FROM yj_field WHERE panel_code = 'BOM_KD'`);
await pool.close();

let fail = 0;
const chk = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) fail++; };

// ① 映射写出的列必须都存在
const badHead = Object.keys(head).filter((c) => !c.startsWith('__') && !headCols.has(c));
const badLine = Object.keys(lines[0] || {}).filter((c) => !lineCols.has(c));
chk(badHead.length === 0, `表头映射列全部存在(${Object.keys(head).filter((c) => !c.startsWith('__')).length} 列)${badHead.length ? ' → 悬空: ' + badHead.join(',') : ''}`);
chk(badLine.length === 0, `分录映射列全部存在(${Object.keys(lines[0] || {}).length} 列)${badLine.length ? ' → 悬空: ' + badLine.join(',') : ''}`);

// ② 面板字段必须都能被写出(否则面板出现永远为空的列)
const mappedHead = new Set(Object.keys(head));
const mappedLine = new Set(Object.keys(lines[0] || {}));
const panelHeadMissing = fieldRs.recordset.filter((f) => f.place.includes('header') && !mappedHead.has(f.col_name)).map((f) => f.col_name);
const panelLineMissing = fieldRs.recordset.filter((f) => f.place.includes('detail') && !f.place.includes('header') && !mappedLine.has(f.col_name)).map((f) => f.col_name);
chk(panelHeadMissing.length === 0, `面板表头字段均有映射${panelHeadMissing.length ? ' → 缺: ' + panelHeadMissing.join(',') : ''}`);
chk(panelLineMissing.length === 0, `面板明细字段均有映射${panelLineMissing.length ? ' → 缺: ' + panelLineMissing.join(',') : ''}`);

// ③ 取值抽查
chk(head['单据编号'] === 'BOM123' && head['审核状态'] === '未审核' && head['是否启用'] === true,
  `表头取值: 单据编号=${head['单据编号']} 审核状态=${head['审核状态']} 是否启用=${head['是否启用']}`);
chk(lines[0]['子料单位'] === '千克' && lines[0]['子料编码'] === '142' && lines[0]['发料方式'] === '直接领料',
  `分录取值: 子料单位=${lines[0]['子料单位']}(内码解析) 子料编码=${lines[0]['子料编码']} 发料方式=${lines[0]['发料方式']}`);
chk(lines[0]['单据编号'] === head['单据编号'], '分录单据编号 == 表头单据编号(头行分组列一致)');

// ④ 有意跳过的 id 类键(登记在文档里,防止后人误加空列)
const ID_ONLY = ['product_id', 'product_unit_id', 'product_baseunit_id', 'product_auxprop_id',
  'product_aux1_id', 'product_aux2_id', 'product_aux3_id', 'product_aux4_id', 'product_aux5_id',
  'auditor_id', 'creator_id', 'modifier_id', 'material_id', 'material_unit_id', 'material_baseunit_id',
  'material_auxprop_id', 'aux1_id', 'aux2_id', 'aux3_id', 'aux4_id', 'aux5_id', 'custom_entity_field'];
const mappedKeys = new Set([...mappedHead, ...mappedLine]);
const leaked = ID_ONLY.filter((k) => mappedKeys.has(k));
chk(leaked.length === 0, `id 类无名称孪生键未被误建为空列${leaked.length ? ' → 泄漏: ' + leaked.join(',') : ''}`);

console.log(fail === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL-${fail}`);
process.exit(fail === 0 ? 0 : 1);
