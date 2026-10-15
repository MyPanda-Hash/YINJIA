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

/** 两条序列在最后一点的读数(图例里直接展示"最新值",不必再追图) */
export function lastValues(data) {
  const last = (data || [])[(data || []).length - 1] || {}
  return { added: Number(last.added || 0), done: Number(last.done || 0) }
}
