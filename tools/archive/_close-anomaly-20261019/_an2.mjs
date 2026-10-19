import fs from 'fs';
const r = JSON.parse(fs.readFileSync('tools/archive/_close-anomaly-20261019/out/list2.json', 'utf8'));
const rows = (r.data || []).filter(x => x['工单号'] === 'GD-2026-10-0018' || x['工单号'] === 'GD-2026-10-0019');
rows.sort((a, b) => (a['工单号'] + String(a['工单行号']).padStart(3, '0')).localeCompare(b['工单号'] + String(b['工单行号']).padStart(3, '0')));
for (const x of rows) {
  console.log('---');
  console.log('工单', x['工单号'], '#', x['工单行号'], '行id', x['行id'], '批次', JSON.stringify(x['批次号']),
    '| 结案', x['结案'], '异常', x['结案异常'], '| 排产', x['排产数量'], '入库', x['入库数量'],
    '| 产线', JSON.stringify(x['生产线']), '| 工序', x['当前工序'], x['当前工序完工量'] + '/' + x['当前工序计划量'],
    '| 完工', JSON.stringify(x['完工状态']), '| 转单', x['转单时间'], '| 物料', x['物料编码'], '| 客户', x['客户代码'],
    '| 源单', x['源工单号'], '拆分', x['拆分序号'], '根', x['根工单号'], '切单', x['是否切单']);
}
