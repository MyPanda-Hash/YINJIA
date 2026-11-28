// 只读探针 v2：金蝶「开了仓位没有」——真实账套 + 沙箱各查一遍。
// 用法：node deploy/_probe-kingdee-bin2-20261201.mjs   （纯 GET）
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from './kingdee-client.mjs';

const accounts = [
  ['真实账套', JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8')).kingdee],
  ['测试沙箱', JSON.parse(readFileSync(new URL('./push/config.json', import.meta.url), 'utf8')).kingdee],
];

const CANDIDATES = ['/jdy/v2/bd/space', '/jdy/v2/bd/store_space', '/jdy/v2/bd/stock_place',
  '/jdy/v2/bd/storeplace', '/jdy/v2/bd/sp', '/jdy/v2/bd/stock_space'];

for (const [label, kd] of accounts) {
  console.log(`\n════════ ${label}（clientId=${kd.clientId}） ════════`);
  const { token } = await fetchAppToken(kd);

  const stores = await kingdeeTryGet(kd, token, '/jdy/v2/bd/store', { page: '1', page_size: '200' });
  if (!stores.ok) { console.log('仓库列表失败:', stores.error); continue; }
  const srows = stores.data.rows || [];
  const managed = srows.filter((s) => s.is_allow_freight === true);
  console.log(`仓库 ${srows.length} 个，启用仓位管理 ${managed.length} 个`);
  for (const s of srows) console.log(`  ${s.number} | ${s.name} | 启用仓位管理=${s.is_allow_freight}`);

  for (const p of CANDIDATES) {
    const r = await kingdeeTryGet(kd, token, p, { page: '1', page_size: '5' });
    if (r.ok) console.log(`  仓位档案接口可用: ${p} count=${r.data.count} 键=${Object.keys((r.data.rows || [{}])[0] || {}).join(',')}`);
  }

  // 单据行 sp_* 实测（采购入库 / 生产领料 / 其他入库）
  for (const [nm, P] of [['采购入库', '/jdy/v2/scm/pur_inbound'], ['生产领料', '/jdy/v2/scm/inv_pick'], ['其他入库', '/jdy/v2/scm/inv_other_in']]) {
    const list = await kingdeeTryGet(kd, token, P, { page: '1', page_size: '10' });
    if (!list.ok) { console.log(`  ${nm}: 列表失败 ${list.error}`); continue; }
    let lines = 0, filled = 0, sample = '';
    for (const r of (list.data.rows || []).slice(0, 10)) {
      const d = await kingdeeTryGet(kd, token, P + '_detail', { id: r.id });
      if (!d.ok) continue;
      for (const e of (d.data.material_entity || [])) {
        lines++;
        if (String(e.sp_number || '').trim()) { filled++; sample = `${e.sp_number}→${e.sp_id}`; }
      }
    }
    console.log(`  ${nm}: ${lines} 行, sp_number 有值 ${filled} 行${sample ? '，样例 ' + sample : ''}`);
  }
}
