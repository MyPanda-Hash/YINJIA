import fs from 'fs';
const audit = JSON.parse(fs.readFileSync('tools/archive/_close-anomaly-20261019/out/audit.json', 'utf8')).data || [];
const list = JSON.parse(fs.readFileSync('tools/archive/_close-anomaly-20261019/out/list2.json', 'utf8')).data || [];
const byId = new Map(list.map(x => [x['行id'], x]));
console.log('异常行(服务器 closeAudit)=', audit.length);
console.log(['行id', '工单号', '行号', '排产', '入库', '生产线', '完工状态', 'ja', '最后修改人', '最后修改时间'].join(' | '));
for (const a of audit) {
  const l = byId.get(a['行id']) || {};
  console.log([a['行id'], a['工单号'], a['工单行号'], a['排产数量'], a['入库数量'],
    JSON.stringify(l['生产线'] ?? ''), JSON.stringify(l['完工状态'] ?? ''),
    a['ja'], JSON.stringify(a['最后修改人']), a['最后修改时间'] ?? ''].join(' | '));
}
console.log('\n有最后修改人的:');
for (const a of audit.filter(x => x['最后修改人'])) console.log(' ', a['行id'], a['工单号'] + '#' + a['工单行号'], a['最后修改人'], a['最后修改时间']);
