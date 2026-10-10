// _v-post-deploy-smoke.mjs — 新构建上线后冒烟:登录 + 关键面板接口 + 合并修掉的那个 500
const BASE = 'http://127.0.0.1:8090/api';

async function main() {
  const login = await (await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
  console.log('登录: factory=' + login.data.user.factory + ' isAdmin=' + login.data.user.isAdmin);

  const get = async (p) => (await fetch(BASE + p, { headers: H })).json();
  const post = async (p, b) => (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();

  // ① 三张新检验单:面板配置可取
  for (const p of ['QC_MOLD_INSP', 'QC_CUT_INSP', 'QC_ASM_INSP']) {
    const r = await get('/px/getPanelConfig?panelCode=' + p);
    const m = r.data?.metadata ?? {};
    console.log('  ' + (r.code === 200 ? '✅' : '❌') + ' ' + p + ' getPanelConfig code=' + r.code +
      ' 表头=' + (m.formPages?.[0]?.fieldNames ?? '').split(',').length +
      ' 明细=' + (r.data?.detail?.tabs?.[0]?.fields?.length ?? 0));
  }

  // ② 合并修掉的订单结转 500(旧构建上是「无法绑定 p.linked」)
  const oc = await post('/px/orderConvert/pending', { keyword: '', dateFrom: '', dateTo: '' });
  console.log('  ' + (oc.code === 200 ? '✅' : '❌') + ' 订单结转 pending code=' + oc.code +
    ' 行数=' + (oc.data?.rows?.length ?? oc.data?.list?.length ?? '?') + (oc.code !== 200 ? '  msg=' + oc.message : ''));

  // ③ 采购链四单列表可拉
  for (const p of ['QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN', 'QC_TC_IN']) {
    const r = await post('/px/queryFormDataList', { panelCode: p, pageNo: 1, pageSize: 5, condition: {} });
    console.log('  ' + (r.code === 200 ? '✅' : '❌') + ' ' + p + ' 列表 code=' + r.code + ' 条数=' + (r.data?.list?.length ?? '?'));
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
