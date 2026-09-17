// 检查:所有面板的 yj_field 字段 vs 金蝶接口字段 对齐情况(不上传,只报告)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PARENT = join(HERE, '..', '..', 'deploy');
const { fetchAppToken, kingdeeGet } = await import(pathToFileURL(join(PARENT, 'kingdee-client.mjs')).href);
const cfg = JSON.parse(readFileSync(join(PARENT, 'config.json'), 'utf8'));
const { createRequire } = await import('node:module');
const req = createRequire(pathToFileURL(join(PARENT, 'package.json')).href);
const mssql = req('mssql');
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();
const { token } = await fetchAppToken(cfg.kingdee);

// 12 档案 + 4 单据的 API 路径
const TARGETS = [
  ['BD_SETTLE',  '结算方式',   '/jdy/v2/bd/settlement_type',  null],
  ['BD_CUSGRP',  '客户分类',   '/jdy/v2/bd/customer_group',  null],
  ['BD_SUPGRP',  '供应商分类', '/jdy/v2/bd/supplier_group',  null],
  ['BD_MATGRP',  '商品分类',   '/jdy/v2/bd/material_group',  '/jdy/v2/bd/material_group_detail'],
  ['BD_CUR',     '币别',      '/jdy/v2/bd/currency',        '/jdy/v2/bd/currency_detail'],
  ['BD_UOM',     '计量单位',   '/jdy/v2/bd/measure_unit',    '/jdy/v2/bd/measure_unit_detail'],
  ['BD_DEPT',    '部门',      '/jdy/v2/bd/department',      '/jdy/v2/bd/department_detail'],
  ['BD_EMP',     '职员',      '/jdy/v2/bd/emp',             '/jdy/v2/bd/emp_detail'],
  ['BD_STORE',   '仓库',      '/jdy/v2/bd/store',           '/jdy/v2/bd/store_detail'],
  ['BD_MATERIAL','商品',      '/jdy/v2/bd/material',        '/jdy/v2/bd/material_detail'],
  ['BD_CUSTOMER','客户',      '/jdy/v2/bd/customer',        '/jdy/v2/bd/customer_detail'],
  ['BD_SUPPLIER','供应商',    '/jdy/v2/bd/supplier',        '/jdy/v2/bd/supplier_detail'],
];
const PANEL_MAP = {
  BD_SETTLE:'SETTLE', BD_CUSGRP:'CUSGRP', BD_SUPGRP:'SUPGRP', BD_MATGRP:'MATGRP',
  BD_CUR:'CUR', BD_UOM:'UOM', BD_DEPT:'DEPT', BD_EMP:'EMP', BD_STORE:'WH',
  BD_MATERIAL:'INV', BD_CUSTOMER:'KHDA', BD_SUPPLIER:'GFDA',
};
// API 键 → MES 列 映射(EXTRA + 已知原生映射)
const KNOWN_MAP = {
  number: '编码|dm|存货编码|物料编码|员工编码|部门编码|仓库编码|计量单位编码',
  name: '名称|mc|存货名称|物料名称|员工名称|部门名称|仓库名称|计量单位名称',
  enable: '停用|状态',
  remark: '备注|bz',
  is_leaf: '是否叶子节点',
  level: '级次',
  parent_id: '上级编码|上级部门',
  create_time: '创建时间',
  modify_time: '修改时间',
};

console.log('面板              API键  MES字段  已有数据  空数据  未对齐');
console.log('─'.repeat(75));

let totalApi = 0, totalMes = 0, totalWithData = 0, totalEmpty = 0;

for (const [code, label, listPath, detailPath] of TARGETS) {
  const panelCode = PANEL_MAP[code];
  // MES 面板字段
  const mesFields = (await pool.request().query(
    `SELECT col_name, label, hidden, visible FROM yj_field WHERE panel_code='${panelCode}'`
  )).recordset;
  const mesCols = new Set(mesFields.map(f => f.col_name));

  // MES 有数据的行数
  const tableMap = { SETTLE:'bs_settle_type', CUSGRP:'bs_customer_group', SUPGRP:'bs_supplier_group',
    MATGRP:'bs_material_group', CUR:'bs_currency', UOM:'bs_uom', DEPT:'bs_dept', EMP:'bs_emp',
    WH:'bs_wh', INV:'bs_inv', KHDA:'dm_kh', GFDA:'dm_gf' };
  const tbl = tableMap[panelCode];
  const dataCount = (await pool.request().query(`SELECT COUNT(*) AS n FROM ${tbl} WHERE 外部数据ID IS NOT NULL`)).recordset[0].n;

  // MES 非空列数(有数据的字段)
  const nonEmpty = new Set();
  try {
    const cols = mesFields.map(f => f.col_name);
    for (const c of cols) {
      if (c === 'id' || c.startsWith('asp_') || c === '外部数据ID' || c === '外部单据号' || c === '外部指纹') continue;
      try {
        const r = await pool.request().query(`SELECT COUNT(*) AS n FROM ${tbl} WHERE 外部数据ID IS NOT NULL AND [${c.replace(/'/g,"''")}] IS NOT NULL AND CAST([${c.replace(/'/g,"''")}] AS nvarchar(max)) <> ''`);
        if (r.recordset[0].n > 0) nonEmpty.add(c);
      } catch {}
    }
  } catch {}

  console.log(`【${label}】 MES字段=${mesCols.size} 有数据=${nonEmpty.size} 同步行=${dataCount}`);
  totalMes += mesCols.size;
  totalWithData += nonEmpty.size;
}

// 4 个单据面板
const DOCS = [
  ['SO_ORDER', '销售订单', 'bd_so_order', 'bl_so_order'],
  ['PU_ORDER', '采购订单', 'bd_pu_order', 'bl_pu_order'],
  ['PURCHASE_IN', '采购入库', 'bd_purchase_in', 'bl_purchase_in'],
  ['SALE_OUT', '销售出库', 'bd_sale_out', 'bl_sale_out'],
];
console.log('');
for (const [pc, label, ht, lt] of DOCS) {
  const headFields = (await pool.request().query(`SELECT col_name FROM yj_field WHERE panel_code='${pc}' AND place LIKE '%header%'`)).recordset.length;
  const detailFields = (await pool.request().query(`SELECT col_name FROM yj_field WHERE panel_code='${pc}' AND place='detail'`)).recordset.length;
  const headCount = (await pool.request().query(`SELECT COUNT(*) AS n FROM ${ht}`)).recordset[0].n;
  const lineCount = (await pool.request().query(`SELECT COUNT(*) AS n FROM ${lt}`)).recordset[0].n;
  console.log(`【${label}】 头字段=${headFields} 行字段=${detailFields} 头数据=${headCount} 行数据=${lineCount}`);
  totalMes += headFields + detailFields;
}

console.log('\n══ 汇总 ══');
console.log(`MES 面板字段总数: ${totalMes}`);
console.log(`有数据的字段数: ${totalWithData}`);

await pool.close();
