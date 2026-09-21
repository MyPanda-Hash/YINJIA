// _verify-panel-merge.mjs — 面板归并回归:QC_RECV(原 SL_RECV)改名后 链路/选单/生单/数据 是否仍通
// 用法: node tools/_verify-panel-merge.mjs [base]
const base = process.argv[2] || 'http://127.0.0.1:8090';
let token = '';
let pass = 0, fail = 0;

async function api(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, json, text };
}
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

// 1. 登录
{
  const r = await api('POST', '/api/auth/login', { userName: 'admin', password: '123456' });
  token = r.json?.data?.token || '';
  check('登录 admin', !!token, `status=${r.status}`);
}

// 2. 改名后的面板配置:编码 QC_RECV 指向 sl_recv,名字仍「送料暂收单」
//    响应口径:data={metadata,selectConfig,dataSchema,detail};panelName 在 metadata,选单在 selectConfig。
let cfg = null;
{
  const r = await api('GET', '/api/px/getPanelConfig?panelCode=QC_RECV');
  cfg = r.json?.data;
  const md = cfg?.metadata || {};
  check('getPanelConfig(QC_RECV) 200', r.json?.code === 200, JSON.stringify(r.json)?.slice(0, 200));
  check('metadata.panelCode = QC_RECV', md.panelCode === 'QC_RECV', md.panelCode);
  check('面板名 = 送料暂收单', md.panelName === '送料暂收单', md.panelName);
  // 表名经 dataSchema/列表页映射验证(sl_recv 的字段集:供应商代码/采购订单号/批次号)
  const s = JSON.stringify(cfg);
  check('字段集来自 sl_recv(有 批次号/采购订单号)', s.includes('批次号') && s.includes('采购订单号'));
}

// 3. 旧编码已消失
{
  const r = await api('GET', '/api/px/getPanelConfig?panelCode=SL_RECV');
  check('SL_RECV 已不存在(非 200)', r.json?.code !== 200, `code=${r.json?.code}`);
}

// 4. 链路:选单来源 = 采购订单;生单目标 = 来料检验单(QC_INSP)
{
  check('选单来源 source = PU_ORDER', cfg?.selectConfig?.source === 'PU_ORDER', cfg?.selectConfig?.source);
  const pt = cfg?.metadata?.pushTargets || {};
  check('生单目标 生成来料检验单 → QC_INSP', pt['生成来料检验单'] === 'QC_INSP', JSON.stringify(pt));
}

// 5. 检验单 / 退回单的参照源已改指 QC_RECV
{
  const r = await api('GET', '/api/px/getPanelConfig?panelCode=QC_INSP');
  const s = JSON.stringify(r.json?.data || {});
  check('QC_INSP 暂收单号参照源 = QC_RECV', s.includes('QC_RECV'), s.slice(0, 200));
  check('QC_INSP 无 SL_RECV 残留', !s.includes('SL_RECV'));
}
{
  const r = await api('GET', '/api/px/getPanelConfig?panelCode=QC_RETURN');
  const s = JSON.stringify(r.json?.data || {});
  check('QC_RETURN 配置无 SL_RECV 残留', !s.includes('SL_RECV'), s.slice(0, 200));
}
{
  const r = await api('GET', '/api/px/getPanelConfig?panelCode=PU_ORDER');
  const s = JSON.stringify(r.json?.data || {});
  check('PU_ORDER 生单目标 QC_RECV', s.includes('QC_RECV'), s.slice(0, 200));
  check('PU_ORDER 无 SL_RECV 残留', !s.includes('SL_RECV'));
}

// 6. 数据仍在:改名后按新面板编码能查到存量暂收单(响应口径 data={totalSize,list},行键=字段标签)
{
  const r = await api('POST', '/api/px/queryFormDataList', { panelCode: 'QC_RECV', pageNo: 1, pageSize: 5 });
  const rows = r.json?.data?.list || [];
  const total = r.json?.data?.totalSize;
  check('QC_RECV 查得到存量单据', r.json?.code === 200 && total > 0, `code=${r.json?.code} total=${total}`);
  const no = rows[0]?.['单号'] || rows[0]?.['单据编号'];
  check('单据号仍 SL- 前缀(前缀未改)', String(no || '').startsWith('SL-'), no);
  check('行带批次号列(分批送料链未断)', rows[0] ? '批次号' in rows[0] : false);
}

// 7. 批号追溯面板(依赖 v_lot_trace,本次未动)仍可用
{
  const r = await api('POST', '/api/px/queryFormDataList', { panelCode: 'LOT_TRACE', pageNo: 1, pageSize: 5 });
  check('LOT_TRACE 面板可查', r.json?.code === 200, `code=${r.json?.code} msg=${r.json?.message}`);
}

console.log(`\n结果: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
