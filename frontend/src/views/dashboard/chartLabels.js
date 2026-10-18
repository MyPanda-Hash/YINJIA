/**
 * chartLabels.js —— 折线图(SLine)里那些"算错也不报错、只是看着别扭"的小逻辑。
 *
 * 为什么单独抽出来:2026-10-15 用户报「近 30 天订单趋势不够清晰、分不出哪条线是什么」。
 * 这类问题全在渲染细节里,X 轴抽稀位置、末点读数这些一旦算错只会"图变难看"而不会抛错,
 * 靠肉眼看截图很难回归 ⇒ 收敛成纯函数 + 单测。
 */

/**
 * X 轴标签抽稀:点太多时只显示 maxLabels 个。
 * 规则:① 首尾必含(否则看不出区间) ② 取点位置与折线的等距点位对齐
 *      (round(k*(n-1)/(m-1)),保证标签不跟折线错位) ③ n ≤ maxLabels 时原样全显示
 *      (对既有 7/12 点的图表零影响)。
 * @returns [{ i, date }] 按 i 升序
 */
export function thinLabels(data, maxLabels = 8) {
  const n = (data || []).length
  if (n === 0) return []
  const m = Math.max(2, Math.min(maxLabels, n))
  if (n <= m) return data.map((d, i) => ({ i, date: d.date }))
  const out = []
  for (let k = 0; k < m; k++) {
    const i = Math.round((k * (n - 1)) / (m - 1))
    if (!out.some((x) => x.i === i)) out.push({ i, date: data[i].date })
  }
  return out
}

/**
 * 两条序列在整个区间的合计(图例数字)。
 *
 * 2026-10-18 改口径:原先是"最后一点的读数"(lastValues) —— 近 30 天窗口的最后一天
 * 往往就是今天,当天还没业务 ⇒ 图例恒显示 0,而图上明明有曲线,用户报「这些显示有问题」。
 * 现在取**区间合计**,与卡片标题上的区间口径一致(峰值仍取 added 的最大一天)。
 */
export function sumValues(data) {
  const out = { added: 0, done: 0 }
  for (const d of data || []) {
    out.added += Number(d.added) || 0
    out.done += Number(d.done) || 0
  }
  return out
}
