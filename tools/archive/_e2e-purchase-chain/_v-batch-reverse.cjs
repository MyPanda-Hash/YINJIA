// _v-batch-reverse.cjs — 复核:按批次号反查接口(/api/px/batchFlow/batch)到底漏不漏特采入库单
// 对照口径:去向解析(resolveEndTarget)走 batch_id,linksOfBatch 走 batch_no
const BASE = 'http://127.0.0.1:8090/api';
const BATCH = process.argv[2] || '20261009';
const TARGET_PI = process.argv[3] || 'PI-2026-10-0086';
const j = (o) => JSON.stringify(o);

async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  }).then((r) => r.json());
  const H = { Authorization: 'Bearer ' + login.data.token };
  const r = await fetch(BASE + '/px/batchFlow/batch?batchNo=' + encodeURIComponent(BATCH), { headers: H }).then((x) => x.json());
  const links = r.data?.links ?? [];
  console.log('批次号 ' + BATCH + ' → links 共 ' + links.length + ' 条;台账 batch=' + j(r.data?.batch));
  const hit = links.filter((l) => l.targetFormNo === TARGET_PI || l.sourceFormNo === TARGET_PI);
  console.log('其中涉及特采入库单 ' + TARGET_PI + ' 的条目数: ' + hit.length + '  ' + j(hit));
  console.log('\n本批次链路里所有 PURCHASE_IN 目标单:');
  console.log('  ' + j([...new Set(links.filter((l) => l.targetPanel === 'PURCHASE_IN').map((l) => l.targetFormNo))].sort().slice(-12)));
  console.log('\n本批次链路里所有 QC_TC_IN 相关条目(看特采那一跳在不在):');
  console.log('  ' + j(links.filter((l) => l.sourcePanel === 'QC_TC_IN' || l.targetPanel === 'QC_TC_IN').slice(-6)));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
