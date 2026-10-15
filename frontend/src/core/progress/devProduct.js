/**
 * 项目管理 ↔ 产品信息表 关联的**纯逻辑**(2026-10-16 用户口径):
 *   项目进度查询每行 = 一个项目(项目编号=立项申请文档编号 = 关联键);
 *   一个立项可以开发好几个产品(产品编号各不相同);
 *   「开发产品」按项目带出产品信息表要填的数据。
 *
 * 抽成独立模块是为了能被 node --test 直接钉住 —— .vue 组件内部逻辑没法单测,
 * 而这几条正是用户明确点名的口径(带什么、怎么带、什么时候算开发完毕)。
 */

/**
 * 「滤芯/炭棒规格或结构」→ 炭棒外径/内径/长度 三格。
 * 认得出 3 个数字就返回(支持 φ33×12×110mm / 33*12*110 / 外径33 内径12 长110 等多种写法),
 * 认不出返回 null —— 调用方只填「产品整体尺寸」那一格,不瞎猜。
 * @param {string} spec 规格串(行上的「子项目/尺寸」,来源=立项申请的「滤芯/炭棒规格或结构」)
 */
export function parseCarbonSize(spec) {
  const s = String(spec == null ? '' : spec)
  const nums = s.match(/\d+(?:\.\d+)?/g) || []
  return nums.length >= 3 ? { 外径: nums[0], 内径: nums[1], 长度: nums[2] } : null
}

/**
 * 按项目键(立项文档编号)过滤出该项目下的产品。
 * @param {Array} products /px/rdDevOverview 的 products
 * @param {string} key 立项文档编号
 */
export function productsOfKey(products, key) {
  const k = String(key == null ? '' : key).trim()
  if (!k) return []
  return (products || []).filter((p) => String(p && p['立项文档编号'] || '').trim() === k)
}

/** 产品集合的整体开发情况:产品数 / 节点总数 / 已完成节点数 / 是否全部开发完毕 */
export function devSummaryOf(products) {
  const ps = products || []
  const nodes = ps.reduce((n, p) => n + ((p && p.nodes) || []).length, 0)
  const done = ps.reduce((n, p) => n + Number((p && p.doneCount) || 0), 0)
  return { count: ps.length, nodes, done, allDone: ps.length > 0 && ps.every((p) => !!(p && p.allDone)) }
}

/**
 * 新增产品的预填(用户口径):
 *   项目名称 → 客户项目名称;滤芯/炭棒规格或结构 → 产品整体尺寸(认得出就再填炭棒外/内/长);
 *   另外回填关联键「立项文档编号」与项目负责人。
 * @param {{code:string,name?:string,projectKey:string,projectName?:string,spec?:string,owner?:string}} p
 * @returns {object} 保存产品信息表用的 formData(键=字段标签,中文)
 */
export function prefillProduct(p) {
  const o = p || {}
  const spec = String(o.spec == null ? '' : o.spec).trim()
  const out = {
    立项文档编号: String(o.projectKey == null ? '' : o.projectKey).trim(),
    产品编号: String(o.code == null ? '' : o.code).trim(),
    产品名称: String(o.name == null ? '' : o.name).trim(),
    客户项目名称: String(o.projectName == null ? '' : o.projectName).trim(),
    产品整体尺寸: spec,
  }
  const owner = String(o.owner == null ? '' : o.owner).trim()
  if (owner) out['产品负责人'] = owner
  const carbon = parseCarbonSize(spec)
  if (carbon) {
    out['炭棒外径'] = carbon['外径']
    out['炭棒内径'] = carbon['内径']
    out['炭棒长度'] = carbon['长度']
    out['炭棒尺寸'] = spec
  }
  return out
}
