// 一次性验证(补充):矩阵结构探测 + 修复2/4/5/6 落库验证
const BASE = 'http://127.0.0.1:8090/api';
let TOKEN;
const H = () => ({ Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' });
const get = async (u) => fetch(BASE + u, { headers: H() }).then(r => r.json());
const post = async (u, b) => fetch(BASE + u, { method: 'POST', headers: H(), body: JSON.stringify(b) }).then(r => r.json());
async function main() {
  const login = await post('/auth/login', { userName: 'admin', password: '123456' });
  TOKEN = login.data.token;

  // PU_ORDER 矩阵:dump 含 GFDA 的完整字段对象(看键名)
  const puMatrix = await get('/px/getNewFormPermMatrix?panelCode=PU_ORDER&operationName=' + encodeURIComponent('新增流程'));
  const metas = puMatrix.data.meta || [];
  const gfdaRef = metas.find(m => m.ref && JSON.stringify(m.ref).includes('GFDA'));
  console.log('[6] PU_ORDER GFDA 参照字段完整对象:', JSON.stringify(gfdaRef));

  // getPanelConfig:SL_RECV 明细物料编码 ref(看 map 键) + PURCHASE_IN 仓库名称 required
  const slCfg = await get('/px/getPanelConfig?panelCode=SL_RECV');
  const slFields = slCfg.data.detail.tabs[0].fields || [];
  const mat = slFields.find(f => f.dataName === '物料编码');
  console.log('\n[5] SL_RECV 物料编码字段:', JSON.stringify(mat));
  const piCfg = await get('/px/getPanelConfig?panelCode=PURCHASE_IN');
  const piFields = piCfg.data.detail.tabs[0].fields || [];
  const wh = piFields.find(f => f.dataName === '仓库名称');
  console.log('\n[2] PURCHASE_IN 仓库名称字段:', JSON.stringify(wh));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
