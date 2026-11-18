/**
 * _dump-links-20261116.mjs —— 回填前把「即将被改写的行级占用 / 材料码」原样落盘(可据此逐条回退)。
 *
 * 为什么要有:tools/migrate-erp-linekey-repair-20261116.sql 会改 form_flow_link.source_line_key 与
 * bl_pu_label.采购订单行id;幂等重跑不会复原"被改之前的值",所以先在服务器上打一份前像。
 *
 * 用法(在 deploy 目录下):
 *   $env:YINJIA_SQL_PASS='<库密码>'; $env:YINJIA_SQL_HOST='36.140.66.163'; node _dump-links-20261116.mjs
 * 输出:与脚本同目录上级的 tools/archive/_diag-batchsend-20261116/links-before-<库名>.tsv
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mssql from 'mssql';

const DB = process.env.YINJIA_SQL_DB || 'HSDZ_MES';
const CFG = {
  server: process.env.YINJIA_SQL_HOST || '127.0.0.1',
  port: Number(process.env.YINJIA_SQL_PORT || 1433),
  database: DB,
  user: process.env.YINJIA_SQL_USER || 'yinjia',
  password: process.env.YINJIA_SQL_PASS || '',
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 120000,
};
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'tools', 'archive', '_diag-batchsend-20261116', `links-before-${DB}.tsv`);

const ts = (v) => (v === null || v === undefined ? '' : String(v));

const pool = await mssql.connect(CFG);
try {
  const links = (await new mssql.Request(pool).query(`
    SELECT id, source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no,
           target_line_key, inventory_code, linked_quantity, link_status, batch_no, create_time
      FROM form_flow_link
     WHERE source_panel_code IN (N'PU_ORDER', N'SO_ORDER')
     ORDER BY id`)).recordset;

  const labels = (await new mssql.Request(pool).query(`
    SELECT id, 单据编号, 采购订单行id, 采购订单行号, 物料编码, 打印数量, asp_time1
      FROM bl_pu_label ORDER BY id`)).recordset;

  const lines = ['# form_flow_link(PU_ORDER/SO_ORDER) 共 ' + links.length + ' 行;bl_pu_label 共 ' + labels.length + ' 行'];
  lines.push('table\tid\tsource_panel_code\tsource_form_no\tsource_line_key\ttarget_panel_code\ttarget_form_no\ttarget_line_key\tinventory_code\tlinked_quantity\tlink_status\tbatch_no\tcreate_time');
  for (const r of links) {
    lines.push(['form_flow_link', r.id, r.source_panel_code, r.source_form_no, r.source_line_key,
      r.target_panel_code, r.target_form_no, r.target_line_key, r.inventory_code, r.linked_quantity,
      r.link_status, r.batch_no, ts(r.create_time)].join('\t'));
  }
  lines.push('');
  lines.push('table\tid\t单据编号\t采购订单行id\t采购订单行号\t物料编码\t打印数量\tasp_time1');
  for (const r of labels) {
    lines.push(['bl_pu_label', r.id, r.单据编号, r.采购订单行id, r.采购订单行号, r.物料编码, r.打印数量, ts(r.asp_time1)].join('\t'));
  }
  writeFileSync(OUT, lines.join('\r\n'), 'utf8');
  console.log(`[OK] ${DB}:form_flow_link ${links.length} 行 / bl_pu_label ${labels.length} 行 → ${OUT}`);
} finally {
  await pool.close();
}
