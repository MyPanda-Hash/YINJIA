/** _q-panel-fields.mjs — 重启后核对:各面板配置是否真的把新增字段下发给前端(结构化断言,不靠文本匹配) */
const API = 'http://localhost:8090/api';
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lj?.data?.token;
if (!token) throw new Error('登录失败');

/** 递归收集 JSON 里所有 dataName / label / name */
const collect = (o, out = new Set()) => {
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (['dataName', 'label'].includes(k) && typeof v === 'string') out.add(v);
      collect(v, out);
    }
  }
  return out;
};

const expect = {
  PURCHASE_IN: ['采购订单号', '采购订单行号', '是否来料检验', '实收数量'],
  SL_RECV: ['采购订单号', '采购订单行号', '计量单位'],
  QC_INSP: ['采购订单号', '采购订单行号', '送检数量'],
  PU_ORDER: ['行号', '物料编码'],
};
let fail = 0;
for (const [panel, names] of Object.entries(expect)) {
  const cfg = await (await fetch(`${API}/px/getPanelConfig?panelCode=${panel}`, { headers: { Authorization: 'Bearer ' + token } })).json();
  const all = collect(cfg);
  const miss = names.filter((n) => !all.has(n));
  console.log(`${panel}: 下发字段 ${all.size} 个 | 期望命中 ${names.length - miss.length}/${names.length}` + (miss.length ? ` | 缺: ${miss.join(',')}` : ' ✔'));
  if (miss.length) fail++;
}
console.log(fail ? `\n===== FAIL ${fail} 个面板 =====` : '\n===== ALL PASS =====');
if (fail) process.exitCode = 1;
