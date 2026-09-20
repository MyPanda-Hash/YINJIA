/**
 * _fix-close-state-H.mjs — 精确化:把金蝶「手动关闭」(bill_close_state='H')的单标为 erp_close_state='H'
 * 用法: node tools/archive/_fix-close-state-H.mjs
 * 产出: tools/archive/_fix-close-state.sql(供 SqlRunner 执行)
 * 说明:迁移 migrate-erp-close-state.sql 把"同步曾置的假中止"统一预置成 'S'(已关闭),
 *       真正是 H 的那部分需要按金蝶原值纠正 —— 关闭状态在**列表接口**就有,无需拉详情。
 *       未被纠正为 H 的保持 'S'(全部入库自动关单);未关闭的行 erp_close_state 保持 NULL。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const k = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const cfg = k.kingdee || k;
const { token } = await fetchAppToken(cfg);

const PANELS = [
  { panel: 'PU_ORDER', path: '/jdy/v2/scm/pur_order' },
  { panel: 'SO_ORDER', path: '/jdy/v2/scm/sal_order' },
];
const out = ['-- _fix-close-state.sql — 由 tools/archive/_fix-close-state-H.mjs 生成(幂等可重跑)', 'SET NOCOUNT ON;'];
for (const { panel, path } of PANELS) {
  const h = [], stat = new Map();
  let total = 0, pages = 0;
  for (let page = 1; page <= 80; page++) {
    const r = await kingdeeGet(cfg, token, path, { page: String(page), page_size: '100' });
    const rows = r.rows || [];
    pages = page;
    for (const x of rows) {
      total++;
      const c = x.bill_close_state ?? '';
      stat.set(c, (stat.get(c) || 0) + 1);
      if (c === 'H' && x.bill_no) h.push(String(x.bill_no).replace(/'/g, "''"));
    }
    if (page >= Number(r.total_page || 1)) break;
  }
  console.log(`${panel}: ${total} 张 / ${pages} 页 | 关闭状态分布 ${[...stat.entries()].map(([c, n]) => `'${c}'=${n}`).join(' ')} | H=${h.length}`);
  if (h.length) {
    out.push(`-- ${panel}:金蝶手动关闭(H)${h.length} 张 → 状态应为「已中止」`);
    // 分批 IN(每批 500 条,避免超长语句)
    for (let i = 0; i < h.length; i += 500) {
      const chunk = h.slice(i, i + 500);
      out.push(`UPDATE yj_doc_status SET erp_close_state = 'H', update_at = GETDATE() WHERE panel_code = '${panel}' AND erp_close_state = 'S' AND doc_no IN (N'${chunk.join("',N'")}');`);
    }
  }
}
out.push('GO');
out.push("SELECT panel_code, ISNULL(erp_close_state,'(未关闭)') AS 关闭状态, COUNT(*) AS 单数 FROM yj_doc_status WHERE panel_code IN ('PU_ORDER','SO_ORDER') GROUP BY panel_code, ISNULL(erp_close_state,'(未关闭)') ORDER BY panel_code, 关闭状态;");
out.push('GO');
writeFileSync(new URL('./_fix-close-state.sql', import.meta.url), out.join('\n') + '\n', 'utf8');
console.log('已写出 tools/archive/_fix-close-state.sql');
