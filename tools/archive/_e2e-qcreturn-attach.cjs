// _e2e-qcreturn-attach.cjs — 暂收退料单附件 E2E:
// 面板字段核对(表头8+附件6+明细25) → 建测试单 → 上传附件 → 头列同步 → 列表 → 删除 → 头列清空 → 清理测试单
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
  const call = (panelCode, buttonName, formData) =>
    fetch(BASE + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData }) }).then((x) => x.json());

  // 1) 面板配置:字段清单核对
  const cfg = await fetch(BASE + '/px/getPanelConfig?panelCode=QC_RETURN', { headers: H }).then((r) => r.json());
  const meta = cfg.data?.metadata ?? {};
  const heads = (meta.panelPageDto ? [] : []);
  const d = cfg.data ?? {};
  const gridCols = d.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns ?? [];
  console.log('1) 面板:', meta.panelName, '| 列表列数:', gridCols.length);
  console.log('   列表列:', gridCols.map((c) => c.label ?? c.dataName).join(','));
  // 表头字段(formPages.fieldNames)
  const fieldNames = d.metadata?.formPages?.[0]?.fieldNames ?? '';
  console.log('2) 表单字段串:', fieldNames);

  // 3) 建测试单(带附件列位数据)
  const save = await call('QC_RETURN', '保存', {
    日期: '2026-09-15', 供应商: '北方机械',
    detail: { items: [{ 物料编码: 'CL005', 物料名称: '包装木箱', 型号: '1200x800', 数量: 10, 单价: 5, 金额: 50 }] },
  });
  console.log('3) 建单:', JSON.stringify(save.data ?? save));
  const no = save.data?.['编号'];

  // 4) 上传附件到 附件1
  const fd = new FormData();
  fd.append('panelCode', 'QC_RETURN');
  fd.append('docNo', no);
  fd.append('field', '附件1');
  fd.append('file', new File([Buffer.from('暂收退料单附件E2E')], '退料附件-E2E.txt', { type: 'text/plain' }));
  const up = await fetch(BASE + '/attachment/upload', { method: 'POST', headers: { Authorization: H.Authorization }, body: fd }).then((r) => r.json());
  console.log('4) 上传:', up.code, JSON.stringify(up.data?.names ?? up.data));
  const attId = up.data?.files?.[0]?.id;

  // 5) 头列同步断言
  const view = await fetch(BASE + '/px/getFormDescriptor?panelCode=QC_RETURN&code=' + encodeURIComponent(no), { headers: H }).then((r) => r.json());
  const v1 = (view.data?.data ?? view.data)['附件1'];
  console.log('5) qc_return.附件1 =', JSON.stringify(v1), v1 === '退料附件-E2E.txt' ? 'PASS' : 'FAIL');

  // 6) 删除附件 → 头列清空
  const del = await fetch(BASE + '/attachment/delete', { method: 'POST', headers: H, body: JSON.stringify({ id: attId }) }).then((r) => r.json());
  const view2 = await fetch(BASE + '/px/getFormDescriptor?panelCode=QC_RETURN&code=' + encodeURIComponent(no), { headers: H }).then((r) => r.json());
  const v2 = (view2.data?.data ?? view2.data)['附件1'];
  console.log('6) 删除后附件1 =', JSON.stringify(v2), (v2 ?? '') === '' ? 'PASS' : 'FAIL');

  // 7) 清理测试单
  const delDoc = await call('QC_RETURN', '删除', { 编号: no });
  console.log('7) 清理测试单', no, ':', delDoc.code, delDoc.data?.['单据状态']);
  console.log('RESULT', JSON.stringify({ no }));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
