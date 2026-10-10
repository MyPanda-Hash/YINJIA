// _e2e-probe-chain.cjs — 侦查:真实登录 + 采购链前三跳(建PO→审核→生暂收→审核→生单)实际响应形状
// 只跑一遍、打印原始 JSON,用于确定字段标签与返回结构;不改库结构,产生的单据留在测试账套。
const BASE = 'http://127.0.0.1:8090/api';
const FACTORY = 'YJ_TEST';
const j = (o) => JSON.stringify(o);

async function main() {
  const loginRes = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
  }).then((r) => r.json());
  console.log('LOGIN:', j({ code: loginRes.code, factory: loginRes.data?.user?.factory }));
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + loginRes.data.token };
  const call = (panelCode, buttonName, formData) =>
    fetch(BASE + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData }) }).then((x) => x.json());
  const view = (panel, no) =>
    fetch(BASE + '/px/getFormDescriptor?panelCode=' + panel + '&code=' + encodeURIComponent(no), { headers: H }).then((x) => x.json());

  const today = new Date().toISOString().slice(0, 10);
  const po = await call('PU_ORDER', '保存', {
    单据日期: today, 供应商: 'GYS00002', 币种: '人民币', 汇率: 1,
    detail: { items: [
      { 物料编码: 'CL004', 物料名称: '切削液', 单位: '桶', 数量: 100, 单价: 10, 仓库: 'CK01' },
    ] },
  });
  console.log('PO保存:', j(po).slice(0, 600));
  const poNo = po.data?.['编号'];
  if (!poNo) return;

  const poAud = await call('PU_ORDER', '审核', { 编号: poNo });
  console.log('PO审核:', j(poAud).slice(0, 300));

  const sl = await call('PU_ORDER', '生成送料暂收单', { 编号: poNo });
  console.log('PO生暂收:', j(sl).slice(0, 600));
  const slNo = sl.data?.['编号'];
  if (!slNo) return;

  const slv = await view('QC_RECV', slNo);
  console.log('QC_RECV 头:', j(slv.data?.data).slice(0, 900));
  console.log('QC_RECV 明细:', j(slv.data?.detailData?.items).slice(0, 900));

  const slAud = await call('QC_RECV', '审核', { 编号: slNo });
  console.log('QC_RECV审核:', j(slAud).slice(0, 300));

  const gen = await call('QC_RECV', '生成检验或入库单', { 编号: slNo });
  console.log('QC_RECV生单:', j(gen).slice(0, 900));

  const target = gen.data?.gotoPanel;
  const newNo = gen.data?.['编号'];
  if (target && newNo) {
    const v = await view(target, newNo);
    console.log('下游 ' + target + ' 头:', j(v.data?.data).slice(0, 900));
    console.log('下游 ' + target + ' 明细:', j(v.data?.detailData?.items).slice(0, 1200));
  }
  const list = await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'QC_RECV', pageNo: 1, pageSize: 3, condition: {} }),
  }).then((x) => x.json());
  console.log('QC_RECV 列表首条:', j(list.data?.list?.[0]).slice(0, 700));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
