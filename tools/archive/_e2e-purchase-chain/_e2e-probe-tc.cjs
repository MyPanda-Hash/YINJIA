// _e2e-probe-tc.cjs — 侦查②:从已有检验单 IJ 起,走 合格/不合格 → 入库/退回 → 特采单 → 入库 全链
// 用真实登录(测试账套),打印每一步的原始响应,确定标签与返回结构。
const BASE = 'http://127.0.0.1:8090/api';
const FACTORY = 'YJ_TEST';
const IJ = process.argv[2];
const j = (o) => JSON.stringify(o);

async function main() {
  const loginRes = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + loginRes.data.token };
  const call = (panelCode, buttonName, formData) =>
    fetch(BASE + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData }) }).then((x) => x.json());
  const view = (panel, no) =>
    fetch(BASE + '/px/getFormDescriptor?panelCode=' + panel + '&code=' + encodeURIComponent(no), { headers: H }).then((x) => x.json());
  const list = (panel, pageSize = 20) =>
    fetch(BASE + '/px/queryFormDataList', {
      method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize, condition: {} }),
    }).then((x) => x.json()).then((r) => r.data?.list ?? []);

  // ① 填检验结果:合格 60 / 不合格 40 / 送检 100
  const ijv = await view('QC_INSP', IJ);
  const items = (ijv.data?.detailData?.items ?? []).map((x) => ({ ...x }));
  items[0]['送检数量'] = 100;
  items[0]['合格数量'] = 60;
  items[0]['不合格数量'] = 40;
  const head = ijv.data?.data ?? {};
  const save = await call('QC_INSP', '保存', {
    编号: IJ, 单据编号: IJ, 单据日期: head['单据日期'], 暂收单号: head['暂收单号'],
    供应商: head['供应商'], 采购订单号: head['采购订单号'], 批次号: head['批次号'], 批次键: head['批次键'],
    detail: { items },
  });
  console.log('① 检验单保存:', j(save).slice(0, 300));

  const aud = await call('QC_INSP', '审核', { 编号: IJ });
  console.log('② 检验单审核:', j(aud).slice(0, 300));

  const ijA = await view('QC_INSP', IJ);
  console.log('③ 检验行(入库单号回填?):', j(ijA.data?.detailData?.items).slice(0, 800));

  const ths = (await list('QC_RETURN')).filter((d) => d['检验单号'] === IJ || d['采购订单号'] === head['采购订单号']);
  console.log('④ 退回单候选:', j(ths.map((d) => ({ 编号: d['编号'], 状态: d['单据状态'], 检验单号: d['检验单号'] }))));
  const thNo = ths[0]?.['编号'];

  let thv = null;
  if (thNo) {
    thv = await view('QC_RETURN', thNo);
    console.log('④b 退回单头:', j(thv.data?.data).slice(0, 700));
    console.log('④c 退回单行:', j(thv.data?.detailData?.items).slice(0, 900));
  }

  // ⑤ 勾特采 → 保存 → 审核
  if (thv) {
    const thItems = (thv.data?.detailData?.items ?? []).map((x) => ({ ...x, 特采: true }));
    const thHead = thv.data?.data ?? {};
    const thSave = await call('QC_RETURN', '保存', {
      编号: thNo, 单据编号: thNo, 单据日期: thHead['单据日期'], 检验单号: thHead['检验单号'],
      供应商: thHead['供应商'], 采购订单号: thHead['采购订单号'], 批次号: thHead['批次号'],
      仓库: thHead['仓库'], 退货类型: thHead['退货类型'], 退货原因: thHead['退货原因'],
      detail: { items: thItems },
    });
    console.log('⑤ 退回单勾特采保存:', j(thSave).slice(0, 300));
    const thAud = await call('QC_RETURN', '审核', { 编号: thNo });
    console.log('⑥ 退回单审核:', j(thAud).slice(0, 300));

    const tcs = (await list('QC_TC_IN')).filter((d) => (d['暂收退料单号'] || '') === thNo);
    console.log('⑦ 特采单候选:', j(tcs.map((d) => ({ 编号: d['编号'], 状态: d['单据状态'], 总数量: d['总数量'] }))));
    const tcNo = tcs[0]?.['编号'];
    if (tcNo) {
      const tcv = await view('QC_TC_IN', tcNo);
      console.log('⑦b 特采单头:', j(tcv.data?.data).slice(0, 1200));
      // ⑧ 两级审批
      const sub = await call('QC_TC_IN', '提交审批', { 编号: tcNo });
      console.log('⑧ 提交审批:', j(sub).slice(0, 300));
      const ap1 = await call('QC_TC_IN', '审批通过', { 编号: tcNo, 审批意见: '一级通过' });
      console.log('⑨ 一级审批通过:', j(ap1).slice(0, 300));
      const ap2 = await call('QC_TC_IN', '审批通过', { 编号: tcNo, 审批意见: '二级批准' });
      console.log('⑩ 二级审批通过:', j(ap2).slice(0, 400));
      const tcA = await view('QC_TC_IN', tcNo);
      console.log('⑩b 特采单终态:', j(tcA.data?.data).slice(0, 900));
      const pis = (await list('PURCHASE_IN')).filter((d) => (d['采购订单号'] || '') === (head['采购订单号'] || ''));
      console.log('⑪ 入库单:', j(pis.map((d) => ({ 编号: d['编号'], 状态: d['单据状态'] }))));
      for (const p of pis.slice(0, 3)) {
        const pv = await view('PURCHASE_IN', p['编号']);
        console.log('⑪b ' + p['编号'] + ' 行:',
          j((pv.data?.detailData?.items ?? []).map((r) => ({ 存货: r['存货编码'], 实收: r['实收数量'], 特采: r['特采'], 检验: r['是否来料检验'] }))));
      }
    }
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
