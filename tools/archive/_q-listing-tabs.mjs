// 一次性探针:对比 PU_ORDER / SO_ORDER 面板配置全貌(键 + gridTabs + detail.tabs)
import { createRequire } from 'node:module';
const require = createRequire('D:/YINJIA-main/deploy/package.json');
void require;
const API = 'http://localhost:8090/api';

const lr = await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
});
const token = (await lr.json())?.data?.token;

for (const pc of ['PU_ORDER', 'SO_ORDER']) {
  const j = await (await fetch(`${API}/px/getPanelConfig?panelCode=${pc}`, { headers: { Authorization: 'Bearer ' + token } })).json();
  const cfg = j?.data || j;
  console.log(`\n########## ${pc} ##########`);
  console.log('顶层键:', Object.keys(cfg).join(', '));
  console.log('detail 键:', Object.keys(cfg.detail || {}).join(', '));
  const gt = cfg.gridTabs || [];
  console.log(`gridTabs: ${gt.length} 个`);
  for (const t of gt) {
    console.log(`   key=${t.key} label=${t.label} summary=${t.summary} 列数=${(t.columns || []).length} summaryItems=${JSON.stringify(t.summaryItems || null)}`);
  }
  const tabs = cfg.detail?.tabs || [];
  for (const t of tabs) {
    console.log(`   detail.tab key=${t.key} label=${t.label} 字段=${(t.fields || []).length} summaryItems=${(t.summaryItems || []).length}个 -> ${JSON.stringify((t.summaryItems || []).map((s) => s.label))}`);
  }
  console.log('metadata:', JSON.stringify(cfg.metadata || {}));
}
