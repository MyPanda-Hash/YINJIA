const p = 'http://127.0.0.1:8090/api';
const lr = await fetch(p + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then(r => r.json());
const t = lr.data.token;
const cfg = await fetch(p + '/px/getPanelConfig?panelCode=PURCHASE_IN', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json());
const s = JSON.stringify(cfg.data);
const dates = s.match(/"dataType":"日期"/g) || [];
console.log('PURCHASE_IN config 中日期类型字段数:', dates.length);
const meta = cfg.data.metadata;
if (meta?.formPages) {
  for (const pg of meta.formPages) {
    console.log('formPage:', pg.title || '?', '→', (pg.fieldNames || '').split(',').filter(Boolean).slice(0, 15).join(' · '));
  }
}
