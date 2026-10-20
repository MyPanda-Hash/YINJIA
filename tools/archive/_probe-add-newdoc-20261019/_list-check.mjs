/**
 * 列表核对(2026-10-19):确认 QC_RECV 的 0016~0032 等行不再是"空白+已审核"的重号假象,
 * 而是 9 月那批真单(有供应商/日期);并核对列表总数 = 去重后的单号数。
 *
 * 用法:node tools/archive/_probe-add-newdoc-20261019/_list-check.mjs [QC_RECV]
 */
const API = 'http://127.0.0.1:8090/api';
const panel = process.argv[2] || 'QC_RECV';
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
const res = await (await fetch(API + '/px/queryFormDataList', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: panel, condition: {}, pageNo: 1, pageSize: 200 }),
})).json();
const list = res?.data?.list || [];
console.log(`== ${panel}: totalSize=${res?.data?.totalSize}, 本页 ${list.length} 行 ==`);
const nums = new Set();
let blank = 0;
for (const r of list) {
  const no = r['编号'];
  if (nums.has(no)) console.log('  [DUP] 同页重号', no);
  nums.add(no);
  const blankRow = !r['供应商'] && !r['采购订单号'] && !r['批次号'] && !r['备注'];
  if (blankRow) {
    blank++;
    console.log('  [空白行]', no, r['单据日期'], r['单据状态']);
  }
}
console.log(`  空白行 = ${blank}(应为 0;0016~0032 那批重号假象已清)`);
const sample = list.filter((r) => /-001[6-9]|-002[0-9]|-003[0-2]$/.test(String(r['编号'])));
console.log('  0016~0032 抽样:');
for (const r of sample.slice(0, 6)) {
  console.log('   ', r['编号'], r['单据日期'], r['单据状态'], r['供应商'] || '(无供应商)');
}
