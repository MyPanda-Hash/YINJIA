/** 对比两个接口里「检验项」字段的 options:getFormDescriptor(表单用) vs getPanelConfig(配置) */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
(async () => {
  const login = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = login.data.token;
  const h = { Authorization: 'Bearer ' + token };
  // 取一张已有检验数据记录
  const q = await fetch(API + '/px/queryFormDataList', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ panelCode: 'QC_INSP_REC', condition: {}, pageNo: 1, pageSize: 1 }) }).then((r) => r.json());
  const no = q.data?.list?.[0]?.['单据编号'] || q.data?.list?.[0]?.['单号'];
  console.log('样本单据: ' + no);
  const desc = await fetch(API + '/px/getFormDescriptor?panelCode=QC_INSP_REC&code=' + encodeURIComponent(no), { headers: h }).then((r) => r.json());
  const dd = desc.data?.detailData || {};
  const keys = Object.keys(dd);
  console.log('descriptor detailData 页签: ' + keys.join(','));
  const fields = desc.data?.detail?.tabs?.[0]?.fields || [];
  const f1 = fields.find((x) => String(x.dataName).includes('检验项'));
  console.log('descriptor 明细字段里的检验项: ' + JSON.stringify(f1 || null).slice(0, 320));
  // 配置接口
  const cfg = await fetch(API + '/px/getPanelConfig?panelCode=QC_INSP_REC', { headers: h }).then((r) => r.json());
  const cf = (cfg.data?.detail?.tabs?.[0]?.fields || []).find((x) => String(x.dataName).includes('检验项'));
  console.log('panelConfig 明细字段里的检验项: ' + JSON.stringify(cf || null).slice(0, 320));
})();
