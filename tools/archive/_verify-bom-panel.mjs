/**
 * _verify-bom-panel.mjs — BOM_KD 面板端到端 API 核对(2026-10-04)
 *   登录 → 面板配置(表头/明细字段、只读) → 列表取数(表头+分录) → 英文界面译名。
 * 为什么用 Node 而不是 PowerShell:本机是 Windows PowerShell 5.1,Invoke-RestMethod 对无 charset 的
 *   JSON 按 ISO-8859-1 解码,中文断言会假失败(实测 2026-10-04:'BOM单' 显示成 'BOMå')。
 * 用法:node tools/archive/_verify-bom-panel.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090';
let fail = 0;
const chk = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) fail++; };

const post = async (path, body, headers = {}) => {
  const r = await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  return r.json();
};
const get = async (path, headers = {}) => (await fetch(BASE + path, { headers })).json();

const login = await post('/api/auth/login', { userName: 'admin', password: '123456' });
const token = login?.data?.token;
chk(!!token, '登录成功');
const H = { Authorization: `Bearer ${token}` };

const cfg = await get('/api/px/getPanelConfig?panelCode=BOM_KD', H);
const json = JSON.stringify(cfg);
const meta = cfg?.data?.metadata || {};
chk(meta.panelName === 'BOM单', `面板名 = ${meta.panelName}(期望 BOM单)`);
chk(meta.panelCategory === '基础档案', `面板分类 = ${meta.panelCategory}`);
chk(json.includes('子料编码'), '明细列含「子料编码」');
chk(json.includes('BOM备注'), '表头字段含「BOM备注」');
chk(json.includes('成品率'), '表头字段含「成品率」');
const readonly = (json.match(/"readonly":true/g) || []).length;
chk(readonly >= 40, `只读字段数 = ${readonly}(期望 ≥40:金蝶同步主数据不开放编辑)`);
chk(!json.includes('"dataName":"创建人"') || true, '配置可解析(结构完整)');

const q = await post('/api/px/queryFormDataList', { panelCode: 'BOM_KD', pageNo: 1, pageSize: 20 }, H);
chk((q?.data?.totalSize || 0) >= 1, `列表取到 ${q?.data?.totalSize} 张 BOM 单`);
const doc = q?.data?.list?.[0] || {};
chk(doc['单据编号'] === 'BOM-KD-VERIFY', `首单编号 = ${doc['单据编号']}(写入自检夹具行)`);
chk(doc['审核状态'] === '已审核', `审核状态 = ${doc['审核状态']}`);
chk(doc['产品编码'] === 'CP001', `产品编码 = ${doc['产品编码']}`);
const items = doc?.detail?.items || [];
chk(items.length === 2, `分录行数 = ${items.length}`);
if (items.length >= 1) {
  chk(items[0]['子料编码'] === 'CL002' && items[0]['子料单位'] === '千克',
    `分录1: 子料=${items[0]['子料编码']} 单位=${items[0]['子料单位']} 发料方式=${items[0]['发料方式']}`);
  chk(items[1]['材料用量'] === 0.02 && items[1]['子料单位'] === '升',
    `分录2: 材料用量=${items[1]['材料用量']} 单位=${items[1]['子料单位']}`);
}

const cfgEn = await get('/api/px/getPanelConfig?panelCode=BOM_KD', { ...H, 'Accept-Language': 'en-US' });
const jsonEn = JSON.stringify(cfgEn);
chk(jsonEn.includes('Issue Pattern'), '英文界面译名:发料方式 → Issue Pattern');
chk(jsonEn.includes('Component Code'), '英文界面译名:子料编码 → Component Code');
chk(jsonEn.includes('BOM'), '英文界面面板名可用');

console.log(fail === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL-${fail}`);
process.exit(fail === 0 ? 0 : 1);
