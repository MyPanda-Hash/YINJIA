/**
 * 只读探针(2026-11-28):①采购订单**行**在某个金蝶账套的入库完成度(是否收满),②商品是否启用批号管理。
 *
 * 背景:「部分数据已经构建了关联关系,无法再构建关联关系」到底是不是"金蝶已经收满"引起的?
 * 这里按订单号拉金蝶订单明细,直接看每行 数量 / in_qty(已入库) / un_out_qty(未入库) / 行入库状态。
 *
 * 用法(在仓库根目录执行):
 *   node tools/archive/_erp-guard-20261128/_q-po-lines.mjs prod   YJ-20260915-06 YJ-20260907-03
 *   node tools/archive/_erp-guard-20261128/_q-po-lines.mjs sandbox YJ-20260909-01
 * 账套:prod   = deploy/config.json(真实账套 359797)
 *       sandbox= deploy/push/config.json(测试沙箱 359220,走 sandboxInstanceId 动态授权)
 * 只发 GET,不写金蝶、不写 MES。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const which = (process.argv[2] || 'sandbox').toLowerCase();
const raw = which === 'prod'
  ? JSON.parse(readFileSync(resolve(root, 'deploy/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee
  : JSON.parse(readFileSync(resolve(root, 'deploy/push/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
// 沙箱凭证用 sandboxInstanceId 走动态授权(与后端 KingdeePushService 同口径)
const cfg = which === 'prod' ? raw : { ...raw, outerInstanceId: raw.sandboxInstanceId };
const tk = await fetchAppToken(cfg);
if (tk.domain) cfg.domain = tk.domain;
const n = (v) => (v === undefined || v === null ? '' : String(v));
const num = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

console.log(`[账套] ${which} clientId=${raw.clientId} instance=${cfg.outerInstanceId || '(真实账套)'}`);
const mats = new Set();
for (const no of process.argv.slice(3)) {
  console.log(`\n##### 采购订单 ${no} #####`);
  let head = null;
  try {
    const d = await kingdeeGet(cfg, tk.token, '/jdy/v2/scm/pur_order', { bill_no: no, page: '1', page_size: '20' });
    const rows = d.rows || [];
    head = rows.find((r) => n(r.bill_no) === no) || null;
    console.log(`[列表] 命中 ${rows.length}; 精确命中=${head ? '是' : '否'}; 供应商=${n(head && head.supplier_name)}`);
  } catch (e) { console.log('[列表] 失败:', e.message); continue; }
  if (!head) { console.log('  该账套内没有这张订单'); continue; }
  try {
    const d = await kingdeeGet(cfg, tk.token, '/jdy/v2/scm/pur_order_detail', { id: head.id });
    const lines = d.material_entity || [];
    console.log('[明细] 数量 / 已入库 in_qty / 未入库 un_out_qty / 行入库状态 / 行关闭');
    for (const m of lines) {
      mats.add(n(m.material_number));
      const qty = num(m.qty), inq = num(m.in_qty), un = num(m.un_out_qty);
      const full = qty !== null && inq !== null && Math.abs(inq - qty) < 1e-6 ? '  ★已收满' : '';
      console.log(`  seq=${n(m.seq)} ${n(m.material_number)} 数量=${qty} 已入库=${inq} 未入库=${un}`
        + ` 行入库状态=${n(m.entry_realio_status)} 关闭=${n(m.close_state)}${full}`);
    }
  } catch (e) { console.log('[明细] 失败:', e.message); }
}

console.log('\n##### 商品是否启用批号管理(is_batch)#####');
for (const code of mats) {
  try {
    const d = await kingdeeGet(cfg, tk.token, '/jdy/v2/bd/material', { search: code, page: '1', page_size: '5' });
    const m = (d.rows || []).find((r) => n(r.number) === code);
    console.log(`  ${code}: ${m ? 'is_batch=' + m.is_batch : '商品档案未命中'}`);
  } catch (e) { console.log(`  ${code}: 查询失败 ${e.message}`); }
}
