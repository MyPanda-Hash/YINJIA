/**
 * recordGroup.js —— 「一张单据按下拉分组填多组数据」的行分组规则(2026-10-28)
 *
 * 【需求】用户原话:
 *   「把这三张表按测试项目、设备名称、仪器名称这些下拉来切数据表填写,就是改为一张单据,
 *    可以通过切换这些内容来给对应的项目、设备、仪器,分别填写数据,一张单据可填写的内容就多一些,
 *    而不是不同项目、仪器、设备都要新建一张单」
 *
 * 【模型】单据头保留下拉值 = **当前正在编辑哪一组**;明细行各带一个分组列
 *   (设备名称 / 仪器名称·型号 / 测试项目)标明自己属于哪一组。
 *   切换下拉只改变「显示哪些行」,其它组的行仍留在 head.detail.items 里,保存时整体提交。
 *
 * 【为什么单独抽成纯函数】渲染层(RecordSheetPanels.rowsOf/addRow)只是调用方;
 *   分组规则被单测钉住,避免以后有人在渲染层重写一套、两处口径漂移。
 *
 * 【旧数据兼容】改造前的行没有分组列值 ⇒ 视为「当前下拉那一组」——
 *   否则老单据一打开就看不到原来的行(用户会以为数据丢了)。
 */

/** 读行上的分组值:去空格、数字转字符串、缺省空串 */
export function groupOf(row, detailKey) {
  if (!detailKey || !row) return ''
  const v = row[detailKey]
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

/**
 * 这一行是否属于「当前组」。
 * @param {object} row 明细行
 * @param {string} detailKey 行上的分组列名(=字段 label)
 * @param {string} current 当前下拉值
 * @returns {boolean}
 */
export function inGroup(row, detailKey, current) {
  if (!detailKey) return true
  const cur = current === undefined || current === null ? '' : String(current).trim()
  // 没选分组(历史单/未选设备):不过滤,保持改造前的观感
  if (!cur) return true
  const v = groupOf(row, detailKey)
  // 空值行 = 改造前的旧行,归到当前组
  return !v || v === cur
}

/**
 * 过滤出当前组的行。
 * @param {object[]} rows 全部明细行
 * @param {string} detailKey 分组列名
 * @param {string} current 当前下拉值
 */
export function groupRows(rows, detailKey, current) {
  const list = Array.isArray(rows) ? rows : []
  if (!detailKey) return list
  return list.filter((r) => inGroup(r, detailKey, current))
}

/**
 * 给行写入当前分组值(仅当该行还没有分组值)。
 * 返回是否写入 —— 已有值的行**不能**改,否则切组保存会把别的设备/仪器的行抢过来。
 */
export function stampGroup(row, detailKey, current) {
  if (!row || !detailKey) return false
  const val = current === undefined || current === null ? '' : String(current).trim()
  if (!val) return false
  if (groupOf(row, detailKey)) return false
  row[detailKey] = val
  return true
}

/**
 * 这张单里**有数据的全部组**,按首次出现顺序,当前值排在最前。
 *
 * 用于「保存后要能切着看」与「打印/导出按组各出一页」(2026-10-29 用户口径:
 *   「改过的 3 个面板在保存之后没有办法进行切换去查看对应的数据,只能是在最后保存停留的那页
 *    数据看得到,到时候打印也应该是有多少个下拉切换就打印对应页面的多少张」)。
 *
 * 为什么不直接用下拉候选(标准库条目)?候选里有**没填过的**设备/仪器,照它出纸会印出一堆空白页。
 * 组的真源只有明细行上的分组列。
 *
 * @param {object[]} rows 全部明细行
 * @param {string} detailKey 分组列名
 * @param {string} [current] 当前下拉值(排第一,保证"先看到我停在哪一组")
 * @returns {string[]}
 */
export function groupValues(rows, detailKey, current) {
  // 没有分组字段 = 非分组面板(一条明细一条纸),不能凭空多出页
  if (!detailKey) return []
  const cur = current === undefined || current === null ? '' : String(current).trim()
  const out = []
  const seen = new Set()
  for (const row of Array.isArray(rows) ? rows : []) {
    // 空值行算「当前组」(与 inGroup 同一口径),组名取当前下拉值;当前也没选就跳过
    const name = groupOf(row, detailKey) || cur
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  if (cur) {
    const i = out.indexOf(cur)
    if (i > 0) { out.splice(i, 1); out.unshift(cur) }
    else if (i < 0) out.unshift(cur)
  }
  return out
}
