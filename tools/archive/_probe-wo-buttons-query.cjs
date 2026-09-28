/**
 * 探针:生产工单按钮组 + 查询(日期范围/高级筛选 服务端过滤)(2026-09-24)
 * ①按钮组:打印组含「打印工单」;新组 排产(排产/结案/取消结案);更多组不再有 结案/取消结案
 * ②高级筛选服务端化:单据面板按 单据日期 ge/le 过滤 → totalSize 变化且行全部命中;行级字段条件被剔除不报错
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const ok = (m) => console.log('OK ' + m);
const bad = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
async function api(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
async function get(path, token) {
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
(async () => {
  const token = (await api('/auth/login', { userName: 'admin', password: '123456' })).json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功');
  const cfg = (await get('/px/getPanelConfig?panelCode=MANU_ORDER', token)).json?.data || {};
  const groups = cfg.metadata?.buttonGroups || [];
  const g = (name) => groups.find((x) => x.name === name) || { actions: [] };
  const printActs = g('打印').actions || [];
  const schActs = g('排产').actions || [];
  const moreActs = g('更多').actions || [];
  printActs.includes('打印工单') ? ok('① 打印组含「打印工单」: ' + printActs.join('/')) : bad('① 打印组缺「打印工单」: ' + printActs.join('/'));
  (schActs.includes('排产') && schActs.includes('结案') && schActs.includes('取消结案'))
    ? ok('① 排产组含 排产/结案/取消结案: ' + schActs.join('/')) : bad('① 排产组异常: ' + schActs.join('/'));
  (!moreActs.includes('结案') && !moreActs.includes('取消结案'))
    ? ok('① 结案/取消结案 已从更多组移出: ' + moreActs.join('/')) : bad('① 更多组仍含结案: ' + moreActs.join('/'));
  // ② 服务端高级筛选:全量 vs 限日期
  const all = await api('/px/queryFormDataList', { panelCode: 'MANU_ORDER', condition: {}, pageNo: 1, pageSize: 5 }, token);
  const totalAll = all.json?.data?.totalSize ?? -1;
  const ge = await api('/px/queryFormDataList', { panelCode: 'MANU_ORDER', condition: {}, pageNo: 1, pageSize: 5, advFilters: [{ field: '单据日期', op: 'ge', value: '2000-01-01' }] }, token);
  const totalGe = ge.json?.data?.totalSize ?? -1;
  totalAll >= 0 && totalGe === totalAll
    ? ok(`② 高级筛选服务端已生效(ge 2000-01-01 → ${totalGe} = 全量 ${totalAll})`)
    : bad(`② 服务端过滤异常: 全量=${totalAll} 过滤后=${totalGe}`);
  const le = await api('/px/queryFormDataList', { panelCode: 'MANU_ORDER', condition: {}, pageNo: 1, pageSize: 5, advFilters: [{ field: '单据日期', op: 'le', value: '1999-01-01' }] }, token);
  (le.json?.data?.totalSize === 0)
    ? ok('② 反向条件生效(le 1999 → 0 行)')
    : bad('② 反向条件未生效: ' + le.json?.data?.totalSize);
  const lineCol = await api('/px/queryFormDataList', { panelCode: 'MANU_ORDER', condition: {}, pageNo: 1, pageSize: 5, advFilters: [{ field: '产品名称', op: 'contains', value: 'zzz' }] }, token);
  (lineCol.status === 200 && lineCol.json?.data?.totalSize === totalAll)
    ? ok('② 行级字段条件被安全剔除(不报错、不影响结果)')
    : bad('② 行级字段条件处理异常: status=' + lineCol.status + ' total=' + lineCol.json?.data?.totalSize);
  const byNo = await api('/px/queryFormDataList', { panelCode: 'MANU_ORDER', condition: {}, pageNo: 1, pageSize: 5, advFilters: [{ field: '合同号', op: 'contains', value: 'MO-2026-09' }] }, token);
  const rows = byNo.json?.data?.list || [];
  (rows.length > 0 && rows.every((r) => String(r['合同号']).includes('MO-2026-09')))
    ? ok('② 单号 contains 过滤命中 ' + rows.length + ' 行且全部匹配')
    : bad('② 单号过滤异常: ' + JSON.stringify(rows.map((r) => r['合同号'])));
  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 按钮组+服务端查询探针全部通过 ===');
})();
