// _e2e-probe-9-4.cjs — 侦查④:P9.4(送检数量置空)失败原因定位
const BASE = 'http://127.0.0.1:8090/api';
const j = (o) => JSON.stringify(o);
async function main() {
  const loginRes = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + loginRes.data.token };
  const call = (p, b, f) => fetch(BASE + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: p, buttonName: b, formData: f }) }).then((x) => x.json());
  const view = (p, c) => fetch(BASE + '/px/getFormDescriptor?panelCode=' + p + '&code=' + encodeURIComponent(c), { headers: H }).then((x) => x.json());
  const IJ = process.argv[2];
  console.log('弃审:', j(await call('QC_INSP', '弃审', { 编号: IJ })));

  const v = await view('QC_INSP', IJ);
  console.log('检验行现值:', j(v.data.detailData.items));
  const items = v.data.detailData.items.map((x) => ({ ...x, 送检数量: null, 合格数量: 0, 不合格数量: 45 }));
  const head = { ...v.data.data };
  delete head['单据状态']; delete head['saved']; delete head['审核人']; delete head['审核时间'];
  const s = await call('QC_INSP', '保存', { ...head, 编号: IJ, detail: { items } });
  console.log('保存:', j(s));
  const v2 = await view('QC_INSP', IJ);
  console.log('保存后行:', j(v2.data.detailData.items));
  const a = await call('QC_INSP', '审核', { 编号: IJ });
  console.log('审核:', j(a));
  const v3 = await view('QC_INSP', IJ);
  console.log('审核后行:', j(v3.data.detailData.items));
  const lst = await fetch(BASE + '/px/queryFormDataList', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_RETURN', pageNo: 1, pageSize: 20, condition: {} }) }).then((x) => x.json());
  console.log('退回单列表(前3):', j((lst.data?.list ?? []).slice(0, 3)));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
