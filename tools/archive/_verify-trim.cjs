// 裁剪验证:被隐藏字段不再渲染 + 面板查询/建单 E2E 不受影响
const BASE = 'http://127.0.0.1:8090/api';
const TRIMMED = {
  SO_ORDER: ['部门负责人', '项目', '品牌'],
  PU_ORDER: ['项目', '到货地址', '发货状态', '合同号', '订金金额', '付款方式', '现存量说明'],
  KHDA: ['法人代表', '注册资本', '成立日期'],
  GFDA: ['供应商级别', '到货地址'],
  INV: ['参考成本', '最新成本'],
  EMP: ['业务员', '证件类型', '职务', '职称'],
  DEPT: ['部门类型', '电话'],
  WH: ['允许零库存出库', '仓库类型', '所属车间'],
  UOM: ['单位类型', '主单位', '换算率'],
};
async function api(path, body, token) {
  return fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  }).then((r) => r.json());
}
/** 深挖 config 里所有字段 spec(含嵌套),返回 label->spec */
function collectFields(node, out, depth = 0) {
  if (!node || depth > 6 || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) collectFields(n, out, depth + 1); return; }
  if (node.dataName && (node.label || node.title || node.dataName)) {
    out.set(String(node.label || node.dataName), node);
  }
  for (const v of Object.values(node)) collectFields(v, out, depth + 1);
}
async function main() {
  const lr = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = lr.data.token;
  let fail = 0;
  for (const [pc, labels] of Object.entries(TRIMMED)) {
    const cfg = await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    if (cfg.code !== 200) { console.log('[%s] config FAIL %s', pc, cfg.message); fail++; continue; }
    const m = cfg.data.metadata;
    // 列表列(应剔除 visible=0)
    const cols = m.panelPageDto.tablePages[0].gridTabs[0].columns.map(String);
    // 全部字段 spec(找 hidden 标志)
    const specs = new Map();
    collectFields(cfg.data, specs);
    for (const l of labels) {
      const inGrid = cols.includes(l);
      const spec = specs.get(l);
      const flagged = spec && (spec.hidden === true || spec.visible === false);
      const ok = !inGrid && (flagged || !spec);
      if (!ok) { console.log('[%s] ✗ %s 仍在列表=%s spec=%j', pc, l, inGrid, spec ? { hidden: spec.hidden, visible: spec.visible } : null); fail++; }
      else console.log('[%s] ✓ %s 已隐藏', pc, l);
    }
    const q = await api('/px/queryFormDataList', { panelCode: pc, pageNo: 1, pageSize: 2 }, token);
    if (q.code !== 200) { console.log('[%s] query FAIL %s', pc, q.message); fail++; }
  }
  // E2E:建删单仍通(隐藏字段非必填)
  for (const pc of ['SO_ORDER', 'PU_ORDER']) {
    const n = await api('/px/callButton', { panelCode: pc, buttonName: '提交', formData: {}, buttonParam: {} }, token);
    const d = n.code === 200 ? await api('/px/callButton', { panelCode: pc, buttonName: '删除', formData: { 编号: n.data['编号'] }, buttonParam: {} }, token) : null;
    console.log('[E2E %s] %s', pc, n.code === 200 && d.code === 200 ? 'ok' : 'FAIL ' + (n.message || d?.message));
    if (!(n.code === 200 && d?.code === 200)) fail++;
  }
  console.log(fail ? 'RESULT: FAIL' : 'RESULT: ALL PASS');
  if (fail) process.exit(1);
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
