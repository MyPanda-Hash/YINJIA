/**
 * 远程实例逐单体检:列出某面板今天建的单,看有没有"新单却已审核"的重号假象。
 * 判据:单据日期=今天 且 单据状态=已审核 且 审核人非空(9 月那批老单是 9 月日期,不会误报)。
 *
 * 用法:node tools/archive/_probe-add-newdoc-20261019/_remote-rows.mjs [host:port] [PANEL]
 */
const host = process.argv[2] || '36.140.66.163:8090';
const panel = process.argv[3] || 'QC_INSP';
const API = `http://${host}/api`;
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
const res = await (await fetch(API + '/px/queryFormDataList', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: panel, condition: {}, pageNo: 1, pageSize: 500 }),
})).json();
const list = res?.data?.list || [];
console.log(`== ${host} ${panel}: total=${res?.data?.totalSize} 本页=${list.length} ==`);
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
let bad = 0;
console.log('  — 今天(单据日期=' + today + ')的单 —');
for (const r of list) {
  const d = String(r['单据日期'] || '').slice(0, 10);
  if (d !== today) continue;
  const flag = r['单据状态'] === '已审核' ? '  <== 新单却是已审核' : '';
  if (r['单据状态'] === '已审核') bad++;
  console.log(`   ${r['编号']} 日期=${d} 状态=${r['单据状态']} 供应商=${r['供应商'] || '-'} 审核人=${r['审核人'] || '-'}${flag}`);
}
console.log(`   今天建的单共 ${list.filter((r) => String(r['单据日期'] || '').slice(0, 10) === today).length} 张,其中已审核 ${bad} 张`);
