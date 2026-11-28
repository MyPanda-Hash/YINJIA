// 只读探针：金蝶云·星辰侧现在有没有启用仓位管理 / 单据行到底吃不粒 sp(仓位) 字段。
// 用法：node deploy/_probe-kingdee-bin-20261201.mjs   （纯 GET，不写金蝶、不改库）
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from './kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const kd = cfg.kingdee;
console.log('账套 domain =', kd.domain, ' outerInstanceId =', kd.outerInstanceId, ' clientId =', kd.clientId);
const { token } = await fetchAppToken(kd);

// ① 仓库档案：is_allow_freight(启用仓位管理) —— MES bs_wh.启用仓位管理 就是从这来的
const stores = await kingdeeTryGet(kd, token, '/jdy/v2/bd/store', { page: '1', page_size: '200' });
if (!stores.ok) { console.log('仓库列表失败:', stores.error); process.exit(1); }
const srows = stores.data.rows || [];
console.log(`\n【① 仓库档案】count=${stores.data.count} 取回 ${srows.length}`);
for (const s of srows) {
  console.log(`  ${s.number} | ${s.name} | 启用仓位管理=${s.is_allow_freight} | enable=${s.enable}`);
}
console.log('  启用仓位管理的仓 =', srows.filter((s) => s.is_allow_freight === true).length);

// ② 仓位档案：仓位的接口路径未在官方提取表里，逐个试（失败即跳过，纯只读）
for (const p of ['/jdy/v2/bd/store_space', '/jdy/v2/bd/space', '/jdy/v2/bd/stock_place', '/jdy/v2/bd/storeplace']) {
  const r = await kingdeeTryGet(kd, token, p, { page: '1', page_size: '5' });
  console.log(`\n【② 仓位档案 ${p}】 ${r.ok ? 'GET 成功 count=' + r.data.count : '不可用: ' + r.error}`);
  if (r.ok && Array.isArray(r.data.rows) && r.data.rows.length) {
    console.log('  样例键:', Object.keys(r.data.rows[0]).join(', '));
    for (const x of r.data.rows.slice(0, 3)) console.log('  ', JSON.stringify(x).slice(0, 300));
  }
}

// ③ 单据行有没有 sp_* 字段 + 实际填没填（采购入库单 / 生产领料单各取 20 张）
for (const [label, P] of [['采购入库单', '/jdy/v2/scm/pur_inbound'], ['生产领料单', '/jdy/v2/scm/inv_pick']]) {
  const list = await kingdeeTryGet(kd, token, P, { page: '1', page_size: '20' });
  if (!list.ok) { console.log(`\n【③ ${label}】列表失败: ${list.error}`); continue; }
  const rows = list.data.rows || [];
  let spKeys = new Set(), filled = 0, lines = 0;
  for (const r of rows.slice(0, 20)) {
    const d = await kingdeeTryGet(kd, token, P + '_detail', { id: r.id });
    if (!d.ok) continue;
    const ents = d.data.material_entity || [];
    for (const e of ents) {
      lines++;
      Object.keys(e).filter((k) => k.startsWith('sp_')).forEach((k) => spKeys.add(k));
      if (String(e.sp_number || '').trim() !== '') filled++;
    }
  }
  console.log(`\n【③ ${label}】${rows.length} 张 / ${lines} 行；行上 sp_* 键 = [${[...spKeys].join(', ')}]；sp_number 有值 ${filled} 行`);
}
