/**
 * 只读冒烟:校验 8090 上「生产加工单字段/生产排产面板/生单按钮」是否已生效(2026-09-21)
 * 用法: node tools/archive/_probe-manu-smoke.cjs [baseUrl]
 * 不创建任何数据,仅读 getPanelConfig。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';

async function api(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const NEW_HEAD = ['生产线', '操作员', '需求数量', '排产数量', '入库数量', '余量', '入库单号', '领料单号',
  '外包单号', '结案', '单据类型', '来料性质', '来料单号', '采购入库单号', '单价', '金额', '源工单号', '拆分序号'];
const NEW_LINE = ['批号', '需求数量', '排产数量', '入库数量', '余量', '单价', '金额'];

(async () => {
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' });
  const token = login.json?.data?.token;
  if (!token) { console.error('❌ 登录失败'); process.exit(1); }
  console.log('✅ 登录成功');

  const cfg = async (code) => (await api('GET', `/px/getPanelConfig?panelCode=${code}`, undefined, token)).json?.data || {};
  const btns = (d) => {
    const out = [];
    for (const g of d.metadata?.buttonGroups || []) for (const a of g.actions || []) out.push(a);
    return out;
  };

  // 生产加工单
  const manu = await cfg('MANU_ORDER');
  const head = manu.dataSchema?.fields || [];
  const line = manu.detail?.tabs?.[0]?.fields || [];
  console.log(`\n【生产加工单】${manu.metadata?.panelName}  头字段 ${head.length} / 行字段 ${line.length}`);
  const missH = NEW_HEAD.filter((l) => !head.some((f) => f.dataName === l));
  const missL = NEW_LINE.filter((l) => !line.some((f) => f.dataName === l));
  console.log(`  新增头字段命中 ${NEW_HEAD.length - missH.length}/${NEW_HEAD.length}` + (missH.length ? `  缺: ${missH.join(',')}` : ''));
  console.log(`  新增行字段命中 ${NEW_LINE.length - missL.length}/${NEW_LINE.length}` + (missL.length ? `  缺: ${missL.join(',')}` : ''));
  const mb = btns(manu);
  console.log(`  按钮含「拆单」: ${mb.includes('拆单') ? '是' : '否'}`);
  const pc = line.find((f) => f.dataName === '产品编码');
  console.log(`  产品编码控件: ${pc?.dataType || '-'} / 参照面板 ${pc?.refPanel || '-'}`);

  // 生产排产(flat 面板:字段在 detail.tabs[0].fields)
  const sched = await cfg('MANU_SCHEDULE');
  const sf = sched.detail?.tabs?.[0]?.fields || sched.dataSchema?.fields || [];
  console.log(`\n【生产排产】${sched.metadata?.panelName}  字段 ${sf.length}`);
  console.log(`  列: ${sf.map((f) => f.dataName).join(', ')}`);

  // 销售订单生单动作
  const so = await cfg('SO_ORDER');
  const sb = btns(so).filter((a) => a.startsWith('生成'));
  console.log(`\n【销售订单】生单动作: ${sb.join(', ')}`);
  const pass = missH.length === 0 && missL.length === 0 && mb.includes('拆单')
    && sched.metadata?.panelName === '生产排产' && sf.length >= 20 && sb.includes('生成生产加工单');
  console.log('\n' + (pass ? '✅ 冒烟全绿' : '❌ 冒烟存在缺失'));
  process.exitCode = pass ? 0 : 1;
})();
