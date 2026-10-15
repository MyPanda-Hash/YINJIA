/**
 * 文书面板「校验定位」的两条纯查表规则(RecordSheetPanels.vue 的 focusField 用它翻页;
 * 抽成独立模块是为了能被 node --test 直接钉住 —— .vue 组件内部逻辑没法单测)。
 *
 * 为什么**必须**按 key 找页(而不是按纸面文案找):
 *   本项目铁律 = 数据键就是字段 label(中文 dataName),但**配置里的纸面文案可以与键不同**:
 *     · recordSheetConfigs 封面 `{ label: '版  本', key: '版本' }`(纸面两空格,键是三字「版本」)
 *     · 组装BOM表 `{ key: '物料名', label: '物料名称' }`(键是旧的「物料名」)
 *     · 规格书封面右上角编号格 = `coverDocNoKey`(键「产品编号」),纸面上根本没有「产品编号」四个字
 *   按文案去 DOM 里逐字比对,上面三类**一个都命中不了**(旧实现即为按文案比对)。
 * 故:pageOfKeyIn 是主判据;pageOfLabelIn 只作旧调用(只拿得到 message 文案时)的兼容回退。
 *
 * 判据与配置结构一一对应,不猜字段名(页号一律来自 block.page):
 *   sections / tailSections / tailDocSections → sec.rows[].{key, label, pairs[].{key,label},
 *                                                 pairs[].cells[].key, grid[].key}
 *   dataTables / tailTables                   → cols[].key、subHeads[].key、bar
 *   cover.fields / cover.sign / coverDocNoKey → 第 0 页(报告头渲染在首页)
 */

/** 区块所属页签页码(与 RecordSheetPanels.pageOf 同一口径:未声明 page 即第 0 页) */
export function pageOfBlock(block) {
  return block?.page ?? 0
}

/** 递归收集一个区块里出现的**数据键**(中文 dataName) */
function keysOfBlock(block) {
  const keys = []
  if (!block) return keys
  if (typeof block.key === 'string') keys.push(block.key)
  if (typeof block.bar === 'string') keys.push(block.bar)
  for (const row of block.rows || []) {
    if (typeof row.key === 'string') keys.push(row.key)
    for (const pair of row.pairs || []) {
      if (typeof pair.key === 'string') keys.push(pair.key)
      for (const cell of pair.cells || []) if (typeof cell.key === 'string') keys.push(cell.key)
    }
    for (const g of row.grid || []) if (typeof g.key === 'string') keys.push(g.key)
    for (const cell of row.cells || []) if (typeof cell.key === 'string') keys.push(cell.key)
  }
  for (const col of block.cols || []) if (typeof col.key === 'string') keys.push(col.key)
  for (const sh of block.subHeads || []) if (typeof sh.key === 'string') keys.push(sh.key)
  return keys
}

/**
 * 从后端/前端提示里取**第一个**缺失字段名(「名称不能为空」「名称、版本不能为空」
 * 「明细第 2 行工序控制不能为空」)。窄匹配,避免把别的错误文案当成字段名:
 *   · 先剥掉明细行前缀「明细第 N 行」;
 *   · 整段必须形如「<字段名>不能为空」;
 *   · 字段名里含空白或标点的一律不认(「模板内容(.jrxml)不能为空」这类不是字段名)。
 * 取不到返回空串 ⇒ 调用方 no-op(定位失败绝不影响校验与保存)。
 * 真源:后端 ButtonService「String.join("、", missing) + "不能为空"」/「明细第 N 行X不能为空」。
 */
export function missingKeyFromMessage(msg) {
  const text = String(msg || '').replace(/^明细第\s*\d+\s*行/, '')
  const m = text.match(/^(.+?)不能为空/)
  if (!m) return ''
  const first = String(m[1]).split('、')[0].trim()
  return /^[^\s，。、；;：:（）()【】\[\]]{1,20}$/.test(first) ? first : ''
}

/**
 * 数据键 → 所在页签页码;找不到返回 -1。
 * @param {object} cfg recordSheetConfigs[面板编码]
 * @param {string} key 字段数据键(= yj_field.label,中文)
 */
export function pageOfKeyIn(cfg, key) {
  if (!cfg || typeof key !== 'string' || !key) return -1
  // 封面字段 / 右上角编号格 / 签字栏 —— 都渲染在报告头里,即第 0 页
  if ((cfg.cover?.fields || []).some((f) => f.key === key)) return 0
  if ((cfg.cover?.sign || []).some((s) => s.key === key)) return 0
  if (cfg.coverDocNoKey === key) return 0
  // 大标题做成字段输入框的面板(如产品信息表的「产品名称」):标题也在报告头,同属第 0 页
  // (2026-10-16:缺必填时这格要能闪,否则 focusField 直接返回 false、用户看不到高亮)
  if (cfg.titleKey === key) return 0
  const sections = [...(cfg.sections || []), ...(cfg.tailSections || []), ...(cfg.tailDocSections || [])]
  for (const sec of sections) {
    if (keysOfBlock(sec).includes(key)) return pageOfBlock(sec)
  }
  for (const dt of [...(cfg.dataTables || []), ...(cfg.tailTables || [])]) {
    if (dt.tabKey === key || keysOfBlock(dt).includes(key)) return pageOfBlock(dt)
  }
  return -1
}

/**
 * 纸面文案 → 所在页签页码;找不到返回 **null**(保持 RecordSheetPanels 旧返回值口径)。
 * 仅用于「只拿得到提示文案、拿不到数据键」的旧调用;新代码一律走 pageOfKeyIn。
 */
export function pageOfLabelIn(cfg, label) {
  if (!cfg || typeof label !== 'string' || !label) return null
  if ((cfg.cover?.fields || []).some((f) => f.label === label)) return 0
  const sections = [...(cfg.sections || []), ...(cfg.tailSections || []), ...(cfg.tailDocSections || [])]
  for (const sec of sections) {
    const hit = (sec.rows || []).some((row) =>
      (row.pairs || []).some((p) => p.label === label)
      || row.label === label
      || (row.grid || []).some((g) => g.label === label))
    if (hit) return pageOfBlock(sec)
  }
  for (const dt of cfg.dataTables || []) {
    const hit = (dt.cols || []).some((col) => col.label === label)
      || (dt.subHeads || []).some((sh) => sh.label === label)
      || dt.bar === label
    if (hit) return pageOfBlock(dt)
  }
  return null
}
