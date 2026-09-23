/**
 * 探针:生产部需求落地验证(2026-09-22)——批次链字段/首件通知/工单结转采购申请/生产异常处理单。
 * 前置(pwsh 侧):已插入测试 BOM(B-76-05→T223 定额0.5);测试痕迹由外部 SQL 清理。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8091') + '/api';
const MO = 'MO-2026-09-0036';
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { console.log('❌ ' + m); process.exitCode = 1; };

async function api(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { }
  return { status: res.status, json, text };
}

(async () => {
  const token = (await api('POST', '/auth/login', { userName: 'admin', password: '123456' })).json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功');

  // ① 生产异常处理单:面板可查 + 保存一条闭环记录(档案式:行数据走 detail.items)
  const q1 = await api('POST', '/px/queryFormDataList', { panelCode: 'PROD_ABN', page: 1, pageSize: 20 }, token);
  if (q1.status !== 200) { bad('PROD_ABN 面板取数失败: ' + q1.text.slice(0, 300)); return; }
  const rowsOf = (r) => {
    const d = r?.json?.data;
    const flat = d?.rows || d?.items || (Array.isArray(d) ? d : []);
    if (flat.length) return flat;
    const list = d?.list || [];
    return list.flatMap((doc) => doc?.detail?.items || []);
  };
  ok(`① 生产异常处理单面板取数 OK(${rowsOf(q1).length} 行)`);
  const abnFields = {
    单据编号: 'YCTEST-0001', 单据日期: new Date().toISOString().slice(0, 10), 工单号: MO,
    产品编码: 'B-76-05', 品名: '探针滤芯', 批次号: 'LOT-TEST', 混料批次号: 'HL-TEST', 工序: '成型',
    提出人: 'admin', 异常类型: '质量', 异常描述: '探针:首件尺寸超差', 影响数量: 10,
    原因分析: '模具磨损', 责任分类: '生产', 处理措施: '换模重做', 处理人: 'admin', 结案: '否',
  };
  const s1 = await api('POST', '/px/callButton', {
    panelCode: 'PROD_ABN', buttonName: '保存', buttonParam: {},
    formData: { ...abnFields, detail: { items: [abnFields] } },
  }, token);
  s1.status === 200 ? ok('① 异常单保存(提出→分析→处理 字段落库)') : bad('① 异常单保存失败: ' + s1.text.slice(0, 300));
  const q2 = await api('POST', '/px/queryFormDataList', { panelCode: 'PROD_ABN', page: 1, pageSize: 20, keyword: 'YCTEST' }, token);
  const abn = rowsOf(q2).find((r) => r['单据编号'] === 'YCTEST-0001');
  abn ? ok(`① 异常单回读命中:工单=${abn['工单号']} 批次=${abn['批次号']} 混料批次=${abn['混料批次号']} 工序=${abn['工序']}`) : bad('① 异常单回读未命中: ' + q2.text.slice(0, 200));

  // ② 首件完成通知:置标志 + 通知人数≥1
  const f1 = await api('POST', '/px/callButton', {
    panelCode: 'MANU_ORDER', buttonName: '首件完成通知', buttonParam: {}, formData: { 编号: MO },
  }, token);
  const notified = f1.json?.data?.['通知人数'];
  f1.status === 200 && Number(notified) >= 1
    ? ok(`② 首件完成通知:首件完成=是,已通知 ${notified} 人(品质取样提醒)`)
    : bad('② 首件通知失败: ' + f1.text.slice(0, 300));

  // ③ 生成采购申请:有测试 BOM → 结转缺口行;重复点击 → 幂等拒绝
  const p1 = await api('POST', '/px/callButton', {
    panelCode: 'MANU_ORDER', buttonName: '生成采购申请', buttonParam: {}, formData: { 编号: MO },
  }, token);
  if (p1.status === 200) {
    const d = p1.json?.data || {};
    ok(`③ 工单结转采购申请:${d['编号']} 缺口行=${d['缺口行数']} 缺口合计=${d['缺口合计']} 通知=${d['通知人数']}人`);
    console.log('MARK_PUREQ ' + d['编号']);
  } else if (/库存已齐套/.test(p1.text)) {
    ok('③ BOM 需求已被库存覆盖,无需采购(口径正确)');
  } else {
    bad('③ 生成采购申请失败: ' + p1.text.slice(0, 300));
  }
  const p2 = await api('POST', '/px/callButton', {
    panelCode: 'MANU_ORDER', buttonName: '生成采购申请', buttonParam: {}, formData: { 编号: MO },
  }, token);
  /已生成采购申请/.test(p2.text) ? ok('③ 重复结转被拒(占用幂等)') : bad('③ 幂等守卫未生效: ' + p2.text.slice(0, 200));

  // ④ 无 BOM 产品 → 明确指引
  const p3 = await api('POST', '/px/callButton', {
    panelCode: 'MANU_ORDER', buttonName: '生成采购申请', buttonParam: {}, formData: { 编号: 'MO-2026-09-0030' },
  }, token);
  /无默认 BOM/.test(p3.text) ? ok('④ 无 BOM 产品给出明确指引(碳棒工艺用料杂,请补 BOM 或手工建单)') : bad('④ 无 BOM 分支异常: ' + p3.text.slice(0, 200));

  console.log(process.exitCode ? '\n=== 存在失败项 ===' : '\n=== 探针全部通过 ===');
})();
