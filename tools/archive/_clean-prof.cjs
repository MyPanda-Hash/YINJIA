// _clean-prof.cjs — 清理 PanelxList 中的 TEMP-PROF 埋点
const fs = require('fs');
const p = require('path').join(__dirname, '..', '..', 'frontend', 'src', 'core', 'views', 'PanelxList.vue');
let s = fs.readFileSync(p, 'utf8');
s = s.split('\n').filter((l) => !/TEMP-PROF/.test(l)).join('\n');
s = s.replace(/  const P = \(k\) => window\.__prof\.push\(\[k, Math\.round\(performance\.now\(\)\)\]\)\n/, '');
for (const k of ['load开始', 'loadCrg后', '查询返回', '赋值list', '渲染前(refModes/快照前)', '快照后']) {
  s = s.replace(new RegExp("    P\\('" + k.replace(/[()\/]/g, '\\$&') + "'\\)\\n"), '');
}
fs.writeFileSync(p, s);
console.log('cleaned, 剩余 P(:', (s.match(/ P\('/g) || []).length);
