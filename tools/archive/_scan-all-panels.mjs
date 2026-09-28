// _scan-all-panels.mjs — 全面板列表扫描:抓"字段配置引用不存在列"(单位列类缺口,2026-09-24)
import fs from 'node:fs';
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const panels = JSON.parse(fs.readFileSync('tools/archive/_panels.json', 'utf8'));
const bad = [], ok = [];
const t = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json())?.data?.token;
for (const pc of panels) {
  try {
    const r = await fetch(API + '/px/queryFormDataList', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ panelCode: pc, pageNo: 1, pageSize: 1 }) });
    const j = await r.json().catch(() => null);
    const msg = j?.message || '';
    if (r.status !== 200 || (msg && msg !== 'success')) {
      const m = msg.match(/Invalid column name '([^']+)'/);
      bad.push(pc + ' | ' + (m ? '缺列:' + m[1] : ('http' + r.status + ' ' + msg.slice(0, 90))));
    } else ok.push(pc);
  } catch (e) { bad.push(pc + ' | 网络异常 ' + e.message.slice(0, 60)); }
}
console.log(`扫描 ${panels.length} 面板: ✓${ok.length} ❌${bad.length}`);
console.log(bad.length ? '--- 异常面板 ---\n' + bad.join('\n') : '✅ 全部面板列表正常,无缺列引用');
