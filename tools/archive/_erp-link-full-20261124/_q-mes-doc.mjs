/**
 * 只读取证:MES 服务器(36.140.66.163:8090)上一张采购入库单的头/行 + 待转ERP清单。
 * 只调 /api/auth/login 与 /api/px/getFormDescriptor、/api/px/queryFormDataList(全部只读),
 * 不点保存/审核/转ERP。账号用部署文档里的只读排查账号,可被环境变量覆盖。
 *
 * 运行: node tools/archive/_erp-link-full-20261124/_q-mes-doc.mjs PI-2026-11-0154
 */
const BASE = process.env.YJ_MES_BASE || 'http://36.140.66.163:8090';
const USER = process.env.YJ_MES_USER || 'admin';
const PASS = process.env.YJ_MES_PASS || '123456';
const FACTORY = process.env.YJ_MES_FACTORY || 'YJ';

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: USER, password: PASS, factory: FACTORY }),
})).json();
const H = { Authorization: 'Bearer ' + login.data.token, 'Content-Type': 'application/json' };

for (const doc of process.argv.slice(2)) {
  const r = await (await fetch(`${BASE}/api/px/getFormDescriptor?panelCode=PURCHASE_IN&code=${encodeURIComponent(doc)}`, { headers: H })).json();
  const d = r.data || {};
  const h = d.data || {};
  console.log(`\n########## ${doc} ##########`);
  for (const k of ['单据编号', '单据日期', '供应商', '供应商编码', '采购订单号', '批次号', '单据状态', '审核人', '审核时间', '是否已转ERP', 'ERP单号']) {
    if (h[k] !== undefined) console.log(`  ${k} = ${h[k]}`);
  }
  const items = (d.detailData && d.detailData.items) || [];
  console.log(`  明细 ${items.length} 行:`);
  for (const it of items) {
    console.log(`    ${it['存货编码']} ${it['存货名称'] || ''} 实收=${it['实收数量']} 单价=${it['单价']}`
      + ` 批号=${it['批号']} 仓库=${it['仓库']} 源单编号=${it['源单编号']} 采购订单行号=${it['采购订单行号']}`);
  }
}

// 当前「已审核但未转ERP」的采购入库单(判断会不会陆续踩同一个坑)
const q = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'PURCHASE_IN', keyword: '', pageNo: 1, pageSize: 30 }),
})).json();
console.log(`\n===== 采购入库单最近 30 张(共 ${q.data?.totalSize} 张) =====`);
for (const x of q.data?.list || []) {
  console.log(`  ${x['单据编号']} | ${String(x['单据日期']).slice(0, 10)} | ${x['供应商']} | 已转=${x['是否已转ERP'] || '(空)'} | ${x['单据状态']}`);
}
