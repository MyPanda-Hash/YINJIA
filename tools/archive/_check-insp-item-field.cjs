/** 检验数据记录面板:检验项字段的下发内容核对 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
(async () => {
  const login = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = login.data.token;
  const j = await fetch(API + '/px/getPanelConfig?panelCode=QC_INSP_REC', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  const d = j.data || {};
  const tabs = d.detail?.tabs || [];
  for (const t of tabs) {
    for (const f of t.fields || []) {
      if (String(f.dataName).includes('检验项')) {
        console.log('明细字段: ' + JSON.stringify({ dataName: f.dataName, dataType: f.dataType, stdLib: f.stdLib, optionsCount: (f.options || []).length, first5: (f.options || []).slice(0, 5), readonly: f.readonly, visible: f.visible }, null, 1));
      }
    }
  }
  const sch = (d.dataSchema?.fields || []).find((f) => String(f.dataName).includes('检验项'));
  if (sch) console.log('dataSchema 里的检验项: ' + JSON.stringify(sch).slice(0, 300));
  // 标准库接口(界面维护用)
  const lib = await fetch(API + '/stdlib/list?lib=qc.insp_item', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json()).catch((e) => ({ err: String(e) }));
  console.log('stdlib/list → ' + JSON.stringify(lib).slice(0, 300));
})();
