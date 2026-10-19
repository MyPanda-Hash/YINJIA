import fs from 'fs';
const r = JSON.parse(fs.readFileSync('tools/archive/_close-anomaly-20261019/out/list2.json', 'utf8'));
const rows = r.data || [];
const K = {
  no: '工单号', xc: '工单行号', closed: '结案', bad: '结案异常', scx: '生产线',
  pl: '排产数量', rk: '入库数量', st: '完工状态', qty: '当前工序完工量', op: '当前工序',
  dm: '物料编码', mc: '产品名称', date: '单据日期',
};
console.log('总行', rows.length, '| 结案异常=Y', rows.filter(x => x[K.bad] === 'Y').length,
  '| 结案=Y', rows.filter(x => x[K.closed] === 'Y').length);

const by = {};
for (const x of rows) (by[x[K.no]] = by[x[K.no]] || []).push(x);
const badOrders = Object.entries(by).filter(([, v]) => v.some(x => x[K.bad] === 'Y'));
console.log('涉及工单', badOrders.length, '张');
for (const [no, v] of badOrders) {
  v.sort((a, b) => a[K.xc] - b[K.xc]);
  console.log(`\n${no}  行数=${v.length} 异常=${v.filter(x => x[K.bad] === 'Y').length} 日期=${v[0][K.date]}`);
  for (const x of v) {
    console.log(`   #${x[K.xc]} 异常=${x[K.bad]} 结案=${x[K.closed]} scx=${x[K.scx] || '-'} 排产=${x[K.pl]} 入库=${x[K.rk]} 完工=${x[K.st] || '-'} 工序=${x[K.op] || '-'}/${x[K.qty]}`);
  }
}
