// 一次性端到端验证:检验单(带单价)审核 → 自动生成采购入库单行是否带单价
const BASE = 'http://127.0.0.1:8090/api';
let TOKEN;
const H = () => ({ Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' });
const post = async (u, b) => fetch(BASE + u, { method: 'POST', headers: H(), body: JSON.stringify(b) }).then(r => r.json());
const get = async (u) => fetch(BASE + u, { headers: H() }).then(r => r.json());
async function main() {
  const login = await post('/auth/login', { userName: 'admin', password: '123456' });
  TOKEN = login.data.token;
  // 1) 保存草稿检验单(明细带单价)
  const saved = await post('/px/callButton', {
    panelCode: 'QC_INSP', buttonName: '保存',
    formData: { 单据编号: '', 单据日期: '2026-09-17', 供应商: '端到端单价验证',
      detail: { items: [{ 物料编码: 'E2E-PRICE-1', 数量: 100, 合格数量: 90, 不良数量: 10, 计量单位: '件', 单价: 12.5 }] } }
  });
  if (saved.code !== 200) { console.log('保存失败:', JSON.stringify(saved).slice(0, 200)); return; }
  const no = saved.data.编号;
  console.log('检验单草稿:', no);
  // 2) 审核(触发自动生单)
  const aud = await post('/px/callButton', { panelCode: 'QC_INSP', buttonName: '审核', formData: { 编号: no } });
  console.log('审核:', JSON.stringify(aud).slice(0, 150));
  if (aud.code !== 200) { console.log('审核失败,中止'); return; }
  // 3) 查检验行回填的入库单号 + 入库行单价
  const list = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 5, keyword: no });
  const rows = (list.data && list.data.list) || [];
  console.log('按检验单号查入库单:', list.code, '命中', rows.length, '张');
  for (const r of rows) {
    const d = (r.detail && (r.detail.items || r.detail[Object.keys(r.detail)[0]])) || [];
    for (const line of d) console.log('入库行:', JSON.stringify({ 存货编码: line['存货编码'], 实收数量: line['实收数量'], 计量单位: line['计量单位'], 单价: line['单价'] }));
  }
  // 4) 清理:弃审检验单(联动作废下游入库草稿) → 删检验单
  const un = await post('/px/callButton', { panelCode: 'QC_INSP', buttonName: '弃审', formData: { 编号: no } });
  console.log('弃审:', JSON.stringify(un).slice(0, 120));
  const del = await post('/px/deleteForms', { panelCode: 'QC_INSP', nos: [no] });
  console.log('删检验单:', JSON.stringify(del).slice(0, 80));
  // 入库单草稿(作废态)一并删除
  for (const r of rows) {
    const piNo = r['编号'];
    if (piNo) { const d2 = await post('/px/deleteForms', { panelCode: 'PURCHASE_IN', nos: [piNo] }); console.log('删入库单', piNo, ':', d2.code); }
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
