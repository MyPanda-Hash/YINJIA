// _probe-po-save-207.cjs — 复现:采购订单明细行带回 数据来源 后保存 → 期望 207 Invalid column name '数据来源'
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
  const body = {
    panelCode: 'PU_ORDER', buttonName: '保存',
    formData: {
      单据日期: '2026-09-15', 供应商: '北方机械',
      detail: { items: [{ 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200×800', 数量: 5, 单价: 5, 数据来源: '采购' }] },
    },
  };
  const r = await fetch(BASE + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify(body) }).then((x) => x.json());
  console.log('保存(明细行带 数据来源) ->', r.code, r.code === 200 ? JSON.stringify(r.data) : String(r.message).slice(0, 300));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
