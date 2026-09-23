/**
 * 探针:订单结转·发单工作台(《订单结转实现方案-V1.0》§5 验证清单)——2026-09-22
 * 用 ZXL-20260916-02 三行(T302/1916, T208/988, T305/1030)验证:
 * ① pending 只含剩余>0;已转满行(XQ-20260917-01 两行)不出现
 * ② 转工单部分转 1000→剩余 916 中间态;超剩余拒绝;转满消失
 * ③ 转采购单 300→已采购/剩余联动;PU_REQ 产品级行/来源/需求日期正确
 * ④ 汇总条勾稽(未结转=列表聚合;今日结转=当日占用)
 * 自愈(删草稿回现)由外部 SQL+二次调用验证。痕迹由外部 SQL 清理。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = 'ZXL-20260916-02';
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { console.log('❌ ' + m); process.exitCode = 1; };

async function api(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { }
  return { status: res.status, json, text };
}
const rowOf = (rows, id) => rows.find((r) => String(r['行id']) === String(id));

(async () => {
  const token = (await api('/auth/login', { userName: 'admin', password: '123456' })).json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功');

  // ① 待结转:剩余>0 的已审核行;已转满行不出现
  let r = await api('/px/orderConvert/pending', { keyword: '' }, token);
  let rows = r.json?.data || [];
  if (r.status !== 200) { bad('pending 异常: ' + r.text.slice(0, 300)); return; }
  const t302 = rowOf(rows, 7210), t208 = rowOf(rows, 7211);
  const xq = rows.filter((x) => x['订单号'] === 'XQ-20260917-01');
  rows.every((x) => Number(x['剩余数量']) > 0) ? ok('① 全部行 剩余数量>0') : bad('① 存在剩余<=0 的行');
  xq.length === 0 ? ok('① 已转满行(XQ-20260917-01 两行)不出现(占用过滤)') : bad('① 已转满行仍出现: ' + xq.length);
  if (!t302 || !t208) { bad('① 测试行缺失(7210/7211)'); return; }
  ok(`① 样例 ${SO}: T302 需求=${t302['需求数量']} 剩余=${t302['剩余数量']}; T208 剩余=${t208['剩余数量']}`);

  // ② 转工单:部分转 1000 → 剩余 916;超剩余拒绝;转满消失
  r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: SO, 行id: 7210, 生单数量: 1000 }] }, token);
  let mo1 = r.json?.data?.['编号清单']?.[0];
  mo1 ? ok(`② 部分转工单 ${mo1}(1000)`) : bad('② 部分转工单失败: ' + r.text.slice(0, 300));
  r = await api('/px/orderConvert/pending', { keyword: SO }, token);
  let row = rowOf(r.json?.data || [], 7210);
  Number(row?.['已排产数量']) === 1000 && Number(row?.['剩余数量']) === 916
    ? ok(`② 中间态正确:已排产=1000 剩余=916(需求1916,对齐参考样例口径)`)
    : bad(`② 中间态错误: 已排=${row?.['已排产数量']} 剩余=${row?.['剩余数量']}`);
  r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: SO, 行id: 7210, 生单数量: 99999 }] }, token);
  /超过剩余/.test(r.text) ? ok('② 超剩余转单被拒(后端守卫)') : bad('② 超剩余未拒绝: ' + r.text.slice(0, 200));
  r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: SO, 行id: 7210 }] }, token);
  let mo2 = r.json?.data?.['编号清单']?.[0];
  mo2 ? ok(`② 转剩余 916 → ${mo2}`) : bad('② 补转失败: ' + r.text.slice(0, 300));
  r = await api('/px/orderConvert/pending', { keyword: SO }, token);
  rowOf(r.json?.data || [], 7210) === undefined ? ok('② 转满后行自动消失') : bad('② 转满行仍在列表');
  console.log('MARK_MO ' + [mo1, mo2].filter(Boolean).join(','));

  // ③ 转采购单:300 → 已采购/剩余联动 + PU_REQ 产品级行
  r = await api('/px/orderConvert/toPurchase', { rows: [{ 订单号: SO, 行id: 7211, 生单数量: 300 }] }, token);
  let pr1 = r.json?.data?.['编号清单']?.[0];
  pr1 ? ok(`③ 转采购单 ${pr1}(外购成品 T208×300)`) : bad('③ 转采购单失败: ' + r.text.slice(0, 300));
  r = await api('/px/orderConvert/pending', { keyword: SO }, token);
  row = rowOf(r.json?.data || [], 7211);
  Number(row?.['已采购数量']) === 300 && Number(row?.['剩余数量']) === 688
    ? ok('③ 已采购=300 剩余=688(两通道并列联动)')
    : bad(`③ 联动错误: 已采购=${row?.['已采购数量']} 剩余=${row?.['剩余数量']}`);
  const pu = await api('/px/queryFormDataList', { panelCode: 'PU_REQ', page: 1, pageSize: 50, keyword: pr1 }, token);
  const puDoc = (pu.json?.data?.list || [])[0];
  const puLine = puDoc?.detail?.items?.[0];
  puLine && String(puLine['存货编码']) === 'T208' && Number(puLine['数量']) === 300
    && puDoc?.['来源单据'] === '销售订单' && puDoc?.['来源单号'] === SO && puDoc?.['需求日期'] === '2026-09-16'
    ? ok(`③ PU_REQ 正确:行=产品本身(T208×300),来源=销售订单/${SO},需求日期=行级交货 2026-09-16`)
    : bad('③ PU_REQ 字段不符: ' + JSON.stringify({ puDoc, puLine }).slice(0, 300));
  console.log('MARK_PR ' + pr1);

  // ④ 汇总条勾稽
  const st = (await api('/px/orderConvert/stats', {}, token)).json?.data || {};
  const pend = (await api('/px/orderConvert/pending', { keyword: '' }, token)).json?.data || [];
  const qtySum = pend.reduce((a, x) => a + Number(x['需求数量']), 0);
  Number(st['未结转']?.['总订单笔数']) === pend.length
    && Math.abs(Number(st['未结转']?.['总下单数量']) - qtySum) < 0.001
    ? ok(`④ 未结转汇总勾稽:笔数=${pend.length} 数量=${qtySum.toFixed(0)} 款数=${st['未结转']?.['总款数']}`)
    : bad(`④ 未结转汇总不符: ${JSON.stringify(st['未结转'])} vs 笔数${pend.length}/数量${qtySum}`);
  Number(st['今日结转']?.['总订单笔数']) >= 2 && Math.abs(Number(st['今日结转']?.['总下单数量']) - 2216) < 0.001
    ? ok(`④ 今日结转汇总(按行去重):笔数=${st['今日结转']?.['总订单笔数']} 款数=${st['今日结转']?.['总款数']} 数量=${st['今日结转']?.['总下单数量']}(=1916 工单+300 采购)`)
    : bad('④ 今日结转汇总不符: ' + JSON.stringify(st['今日结转']));

  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 订单结转探针全部通过 ===');
})();
