// deploy/push/_push-one.mjs — 推送单张单据到沙箱(供 Java KingdeePushService 子进程调用)
// stdin: JSON { panelCode, docNo, operator, head: {...}, lines: [...] }
// stdout: JSON { ok, erpBillNo, error }
// 推送前自动创建缺失的基础资料(供应商/客户/商品/仓库)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const { fetchAppToken, kingdeeGet, kingdeePost } = await import(pathToFileURL(join(HERE, '..', 'kingdee-client.mjs')).href);
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));

const isPur = input.panelCode === 'PURCHASE_IN';
const apiPath = isPur ? '/jdy/v2/scm/pur_inbound' : '/jdy/v2/scm/sal_out_bound';
const h = input.head;
const lines = input.lines;

const { token } = await fetchAppToken(cfg.kingdee);

// ── 基础资料缓存(本进程内) ──
const cache = { supplier: new Set(), customer: new Set(), material: new Set(), store: new Set() };
async function loadCache() {
  for (const [key, path] of [['supplier','/jdy/v2/bd/supplier'],['customer','/jdy/v2/bd/customer'],['material','/jdy/v2/bd/material'],['store','/jdy/v2/bd/store']]) {
    try {
      let page = 1;
      for (;;) {
        const r = await kingdeeGet(cfg.kingdee, token, path, { page: String(page), page_size: '200' });
        for (const row of (r.rows || [])) cache[key].add(String(row.number));
        if (!r.rows || r.rows.length < 200 || page > 50) break;
        page++;
      }
    } catch {}
  }
}
let unitId = null;
async function getUnitId() {
  if (unitId) return unitId;
  try {
    const r = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/measure_unit', { page: '1', page_size: '5' });
    const u = (r.rows || []).find((x) => x.number === '个') || (r.rows || [])[0];
    if (u) unitId = u.id;
  } catch {}
  return unitId;
}

/** 确保基础资料存在(不存在则创建;商品名称冲突加编码消歧) */
async function ensure(type, number, name, extra = {}) {
  if (!number) return true;
  if (cache[type].has(String(number))) return true;
  const paths = { supplier: '/jdy/v2/bd/supplier', customer: '/jdy/v2/bd/customer', material: '/jdy/v2/bd/material', store: '/jdy/v2/bd/store' };
  let body = { number: String(number), name: String(name || number) };
  if (type === 'material') {
    const uid = await getUnitId();
    if (!uid) return false;
    body = { ...body, base_unit_id: uid, purchase_unit_id: uid, sale_unit_id: uid, store_unit_id: uid };
    if (extra.model) body.model = String(extra.model);
  }
  let r = await kingdeePost(cfg.kingdee, token, paths[type], {}, body);
  if (!r.ok && /已存在/.test(String(r.error || ''))) {
    // 同名不同码 → 名称加编码消歧
    r = await kingdeePost(cfg.kingdee, token, paths[type], {}, { ...body, name: `${name}(${number})` });
  }
  if (r.ok || /已存在/.test(String(r.error || ''))) { cache[type].add(String(number)); return true; }
  return false;
}

// ── 主流程 ──
try {
  await loadCache();

  // 确保基础资料
  const basics = [];
  if (isPur) basics.push({ type: 'supplier', number: h['供应商编码'], name: h['供应商'] });
  else basics.push({ type: 'customer', number: h['客户编码'], name: h['客户'] });
  for (const l of lines) {
    if (l['存货编码']) basics.push({ type: 'material', number: l['存货编码'], name: l['存货名称'], model: l['规格型号'] || '' });
    if (l['仓库编码']) basics.push({ type: 'store', number: l['仓库编码'], name: l['仓库'] });
  }
  for (const b of basics) {
    const ok = await ensure(b.type, b.number, b.name, { model: b.model });
    if (!ok) {
      console.log(JSON.stringify({ ok: false, error: `基础资料创建失败: ${b.type} ${b.number}(${b.name})` }));
      process.exit(0);
    }
  }

  // 构建推送 body
  const body = {
    bill_no: String(h['单据编号'] || ''),
    bill_date: String(h['单据日期'] || '').slice(0, 10),
    trans_type: '2',
    remark: String(h['备注'] || ''),
  };
  if (isPur) body.supplier_number = String(h['供应商编码'] || '');
  else body.customer_number = String(h['客户编码'] || '');

  body.material_entity = lines.map((l) => {
    const e = {
      material_number: String(l['存货编码'] || ''),
      qty: Number(l['实收数量'] || l['数量']) || 0,
      price: Number(l['单价'] || l['售价']) || 0,
    };
    if (l['规格型号']) e.material_model = String(l['规格型号']);
    if (l['税率%']) e.cess = Number(l['税率%']) || 0;
    if (l['仓库编码']) e.stock_number = String(l['仓库编码']);
    if (l['批号']) e.batch_no = String(l['批号']);
    return e;
  });

  // 推送(不自动换号——多次点击会产生多条金蝶记录)
  const r = await kingdeePost(cfg.kingdee, token, apiPath, {}, body);
  if (r.ok) {
    const erpBillNo = String(Object.values(r.data?.id_number_map || {})[0] || h['单据编号']);
    console.log(JSON.stringify({ ok: true, erpBillNo }));
  } else if (/组合值重复|已存在/.test(String(r.error || ''))) {
    // 金蝶已有同号单据(可能之前转过,弃审后重转)——明确提示用户去金蝶处理旧单
    console.log(JSON.stringify({ ok: false, error: 'DUPLICATE', erpBillNo: h['单据编号'],
      hint: '该单号在金蝶已存在。请先在金蝶界面删除(或弃审作废)旧单,再重新转ERP' }));
  } else {
    console.log(JSON.stringify({ ok: false, error: r.error || 'unknown' }));
  }
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e.message }));
}
