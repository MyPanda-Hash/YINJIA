/**
 * 探针:订单结转·左上角日期查询 + 分页口径(2026-10-06 用户报障修复)——只读,不产生任何单据。
 *
 * 覆盖:
 *  ① pending 不带日期 = 全量(向后兼容:老调用方/老客户端不受影响)
 *  ② pending 带单日(from=to) = 只出该「下单日期」的行,条数与全量里该日的行数一致
 *  ③ pending 带近N天(含端点) = 条数 = 全量里 [from,to] 窗口内的行数(端点含当日整天)
 *  ④ stats 不带日期:未结转=全量口径 + 最新下单日期 = 全量里最大的下单日期(前端默认锚点)
 *  ⑤ stats 带日期:当前数据笔数 = 该窗口条数(与列表对得上);未结转仍是全量(口径不变)
 *  ⑥ 日期格式非法 → 400(不静默变"不限")
 *
 * 用法: node tools/archive/_probe-oc-date-query.cjs [http://127.0.0.1:8090]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090';
const API = BASE + '/api';
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { console.log('❌ ' + m); process.exitCode = 1; };

async function api(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, json, text };
}

// 与前端同一套本地日期算法(避免 UTC 偏一天)
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const plusDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const dayOf = (r) => String(r['下单日期'] || '').slice(0, 10);

(async () => {
  const token = (await api('/auth/login', { userName: 'admin', password: '123456' })).json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功 ' + BASE);

  // ① 全量(基线)
  const allRes = await api('/px/orderConvert/pending', { keyword: '' }, token);
  if (allRes.status !== 200) { bad('pending(全量) 异常: ' + allRes.text.slice(0, 200)); return; }
  const all = allRes.json?.data || [];
  if (!all.length) { bad('待结转为空,无法验证(需要库里有剩余>0 的订单行)'); return; }
  const days = [...new Set(all.map(dayOf))].sort();
  const anchor = days[days.length - 1];
  ok(`① 全量 ${all.length} 行,下单日期 ${days.length} 天:${days.join(' ')};最新=${anchor}`);

  // ② 单日
  const d1 = await api('/px/orderConvert/pending', { keyword: '', dateFrom: anchor, dateTo: anchor }, token);
  const dayRows = d1.json?.data || [];
  const expectDay = all.filter((r) => dayOf(r) === anchor);
  dayRows.length === expectDay.length && dayRows.every((r) => dayOf(r) === anchor)
    ? ok(`② 单日(${anchor}) ${dayRows.length} 行,全部落在该日,与全量同窗口一致`)
    : bad(`② 单日不符:接口 ${dayRows.length} 行 vs 期望 ${expectDay.length} 行;越界行=${dayRows.filter((r) => dayOf(r) !== anchor).length}`);

  // ③ 近N天(含端点)
  for (const n of [3, 7, 14, 30]) {
    const from = plusDays(anchor, -(n - 1));
    const w = await api('/px/orderConvert/pending', { keyword: '', dateFrom: from, dateTo: anchor }, token);
    const rows = w.json?.data || [];
    const expect = all.filter((r) => dayOf(r) >= from && dayOf(r) <= anchor);
    rows.length === expect.length
      ? ok(`③ 近${n}天 [${from} ~ ${anchor}] ${rows.length} 行(与全量同窗口一致;单日 ${expectDay.length} → 窗口增量 ${rows.length - expectDay.length})`)
      : bad(`③ 近${n}天不符:接口 ${rows.length} vs 期望 ${expect.length}`);
  }
  // 端点包含当日整天:单日查询必须能取到当天较晚时间的单(用全量里该日行的时间戳无法直查,改为断言不丢行)
  const half = await api('/px/orderConvert/pending', { keyword: '', dateFrom: anchor, dateTo: plusDays(anchor, 1) }, token);
  (half.json?.data || []).length === expectDay.length + all.filter((r) => dayOf(r) === plusDays(anchor, 1)).length
    ? ok('③ 端点口径:to=次日时恰好等于「锚点日 + 次日」两天的行数(含当日整天,无跨日泄漏)')
    : bad('③ 端点口径异常: ' + (half.json?.data || []).length);

  // ④ 汇总(全量口径 + 锚点)
  const st0 = (await api('/px/orderConvert/stats', {}, token)).json?.data || {};
  Number(st0['未结转']?.['总订单笔数']) === all.length
    ? ok(`④ stats(空条件):未结转笔数=${st0['未结转']?.['总订单笔数']} = 全量行数(口径不变)`)
    : bad(`④ stats 未结转笔数不符: ${st0['未结转']?.['总订单笔数']} vs ${all.length}`);
  String(st0['最新下单日期'] || '').slice(0, 10) === anchor
    ? ok(`④ 最新下单日期=${anchor}(前端默认锚点)`)
    : bad(`④ 最新下单日期不符: ${st0['最新下单日期']} vs ${anchor}`);

  // ⑤ 汇总(带日期口径)
  const st1 = (await api('/px/orderConvert/stats', { keyword: '', dateFrom: anchor, dateTo: anchor }, token)).json?.data || {};
  Number(st1['当前数据笔数']) === dayRows.length
    ? ok(`⑤ stats(单日):当前数据笔数=${st1['当前数据笔数']} = 列表条数(汇总与列表对得上)`)
    : bad(`⑤ 当前数据笔数不符: ${st1['当前数据笔数']} vs ${dayRows.length}`);
  Number(st1['未结转']?.['总订单笔数']) === all.length
    ? ok(`⑤ 未结转汇总仍是全量(${all.length}),不受日期条件影响`)
    : bad(`⑤ 未结转被日期条件改了口径: ${st1['未结转']?.['总订单笔数']} vs ${all.length}`);
  String(st1['最新下单日期'] || '').slice(0, 10) === anchor
    ? ok('⑤ 带条件时锚点仍返回全量最新下单日期(切档不丢锚点)')
    : bad('⑤ 带条件时锚点被过滤: ' + st1['最新下单日期']);

  // ⑥ 非法日期 → 400
  const err = await api('/px/orderConvert/pending', { keyword: '', dateFrom: '2026-13-99', dateTo: anchor }, token);
  err.status === 400 && /格式/.test(err.text)
    ? ok('⑥ 非法日期被拒(400 且提示格式): ' + (err.json?.message || '').slice(0, 40))
    : bad(`⑥ 非法日期未按 400 拒绝: status=${err.status} ${err.text.slice(0, 120)}`);

  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 订单结转日期查询探针全部通过 ===');
})();
