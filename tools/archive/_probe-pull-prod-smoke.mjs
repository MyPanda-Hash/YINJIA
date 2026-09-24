// 下拉生产域后的冒烟:①登录 ②生产域新端点可达 ③三大自有域(智能供应链/品质/研发)面板配置与查询未回归
// 用法: node tools/archive/_probe-pull-prod-smoke.mjs
const BASE = 'http://127.0.0.1:8090';
let token = '';

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, json, text };
}

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

// ① 登录
const login = await api('POST', '/api/auth/login', { userName: 'admin', password: '123456' });
token = login.json?.data?.token || '';
check('登录 admin', !!token, login.json?.message || `status=${login.status}`);

// ② 生产域新端点(只读调用,不写数据)
const pending = await api('POST', '/api/px/orderConvert/pending', {});
check('订单结转 /pending', pending.status === 200 && pending.json?.code === 200, `rows=${pending.json?.data?.rows?.length ?? pending.json?.data?.list?.length ?? '?'}`);
const pool = await api('POST', '/api/px/scheduleBoard/pending', {});
check('排产工作台 /pending', pool.status === 200 && pool.json?.code === 200, `rows=${pool.json?.data?.rows?.length ?? pool.json?.data?.list?.length ?? '?'}`);
const lines = await api('POST', '/api/px/scheduleBoard/linesSummary', {});
check('排产工作台 /linesSummary', lines.status === 200 && lines.json?.code === 200);
const today = await api('POST', '/api/px/scheduleBoard/today', {});
check('排产工作台 /today', today.status === 200 && today.json?.code === 200);

// ③ 三大自有域:面板配置 + 列表查询(有回归会 500)
const domains = {
  '智能供应链': ['PURCHASE_IN', 'SALE_OUT', 'PU_ORDER', 'SO_ORDER', 'QC_RECV'],
  '品质管理': ['QC_INSP', 'QC_CATALOG', 'QC_INSP_REC', 'QC_TC_IN', 'QC_RETURN'],
  '研发': ['RD_PROGRESS', 'RD_PLAN', 'RD_PROD_INFO', 'RD_ASM_BOM'],
};
for (const [domain, panels] of Object.entries(domains)) {
  for (const p of panels) {
    const cfg = await api('GET', `/api/px/getPanelConfig?panelCode=${p}`);
    const q = await api('POST', '/api/px/queryFormDataList', { panelCode: p, pageNo: 1, pageSize: 5 });
    const ok = cfg.status === 200 && cfg.json?.code === 200 && q.status === 200 && q.json?.code === 200;
    const cfgData = cfg.json?.data || {};
    check(`[${domain}] ${p} 配置+查询`, ok,
      ok ? `字段 ${cfgData.header?.length ?? cfgData.fields?.length ?? '?'} 行 ${q.json?.data?.rows?.length ?? q.json?.data?.list?.length ?? '?'}`
        : `cfg=${cfg.status}/${cfg.json?.code} query=${q.status}/${q.json?.code} ${q.json?.message || cfg.json?.message || ''}`);
  }
}

// ④ 生产线档案(生产域)与下拉参照字典仍可用
const pl = await api('POST', '/api/px/queryFormDataList', { panelCode: 'PROD_LINE', pageNo: 1, pageSize: 5 });
check('[生产域] PROD_LINE 查询', pl.status === 200 && pl.json?.code === 200, `行 ${pl.json?.data?.rows?.length ?? '?'}`);
const dict = await api('POST', '/api/locale/dict', { locale: 'en' });
check('翻译字典 /api/locale/dict', dict.status === 200 && dict.json?.code === 200, `status=${dict.status}${dict.status !== 200 ? '(缺 backend\\.env 时降级,与本次下拉无关)' : ''}`);

const bad = results.filter((r) => !r.ok);
console.log(`\n=== 冒烟汇总: ${results.length - bad.length}/${results.length} 通过 ===`);
if (bad.length) { console.log('失败项:'); bad.forEach((b) => console.log('  -', b.name, b.detail)); process.exit(1); }
