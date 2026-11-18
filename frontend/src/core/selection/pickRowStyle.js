/**
 * pickRowStyle.js —— 「未勾选的明细行置灰 + 不能填写」的单一口径(2026-11-17 客户反馈)
 *
 * 【客户原话】「没有勾选的单据明细没有做区分,还是可填。」
 *   修改方案原文:「**没有勾选为灰色而且不能有输入**。所有打印和生单都要有。关于明细勾选的」
 *
 * 【为什么要单独一份】四个打印/生单弹窗原来都把「勾选」只当成**提交时的过滤条件**:
 *   未勾选的行照样白底、照样能填数量/仓库/仓位,用户填了半天才发现这些行根本不进单据
 *   (§ 客户就是踩这个:截图里未勾选的行 50000/40000 照填,但生单只按勾选的行出)。
 *   置灰与禁填必须是同一口径,并且**四个弹窗共用一份实现** —— 本次反馈就是"漏了一处"漏出来的,
 *   四处各写一遍必然再漏。
 *
 * 【谁在用】(全部是"勾选明细行 → 出单据/出纸"的弹窗)
 *   · 分批送料            core/views/BatchSendDialog.vue            (生单;上下两层表:原行 + 已打印隔离行)
 *   · 统一生单 / 合单生单  core/views/GenerateLinesDialog.vue        (生单;每张来源单一张表)
 *   · 打印材料码          core/views/MaterialLabelDialog.vue        (打印;主表 + 补登表)
 *   · 打印采购订单        core/views/PurchaseOrderPrintDialog.vue   (打印;有金额/无金额共用)
 *
 * 【为什么样式不在这里】行是 el-table 内部渲染的 `<tr>`,组件 scoped 样式要用 `:deep` 才够得着,
 *   四个组件各抄一份 CSS 同样是"下次漏一处"的温床 ⇒ 灰行样式统一在 `styles/index.css`
 *   的 `.yj-pick-row-off`(见该处注释),本文件只给**类名**与**判定函数**。
 *
 * 【口径边界】只灰"没勾"的行,不灰"勾不了"的行(剩余为 0 / 单据未审核):
 *   `selectable` 已经把勾不上的行挡在外面,它们本来就有 element 自己的禁用样式,
 *   客户要的是"我没勾,你别让我填",别把两件事混成一种灰。
 */

/** 未勾选行的类名(el-table 的 `row-class-name` 打上去;样式见 styles/index.css) */
export const UNPICKED_ROW_CLASS = 'yj-pick-row-off'

/** 默认行键:四个弹窗里三个用 `lineKey`;材料码弹窗是 `id`、采购订单打印是 `__key`,由调用方传 keyOf */
const defaultKeyOf = (row) => (row == null ? undefined : row.lineKey)

/**
 * 勾选项 → 行键集合。调用方给的可能是 Set、数组(行键**或**行对象),也可能是空值。
 * · 装行对象时取 `keyOf(row)`(便于直接把 el-table 的 selection 数组丢进来);
 * · 一律收口成字符串(服务端 id 可能是数字,行键也可能是 `A#1@5` 这种拼串)。
 * @param {Set|Array|undefined|null} picked 勾选项
 * @param {(row:object)=>any} [keyOf] 行对象 → 行键(默认 `lineKey`)
 * @returns {Set<string>} 行键集合
 */
export function pickedKeySet(picked, keyOf = defaultKeyOf) {
  const out = new Set()
  if (!picked) return out
  const list = picked instanceof Set ? [...picked] : Array.isArray(picked) ? picked : []
  for (const item of list) {
    if (item === null || item === undefined) continue
    const key = typeof item === 'object' ? keyOf(item) : item
    if (key === null || key === undefined || key === '') continue
    out.add(String(key))
  }
  return out
}

/**
 * 这一行是否已勾选。
 * 模板里每个单元格都会调它,所以**传 Set 时走 O(1) 直查**(组件里用
 * `computed(() => new Set(picked.value.map(r => r.lineKey)))` 准备好那份)。
 * @param {Set|Array} picked 勾选项
 * @param {string|number} key 本行行键
 * @param {(row:object)=>any} [keyOf] 勾选项里装的是行对象时才需要(默认 `lineKey`)
 * @returns {boolean}
 */
export function isPicked(picked, key, keyOf = defaultKeyOf) {
  if (key === null || key === undefined || key === '') return false
  const k = String(key)
  if (picked instanceof Set) return picked.has(k) || picked.has(key)
  return pickedKeySet(picked, keyOf).has(k)
}

/**
 * el-table 的 `row-class-name` 回调工厂:未勾选 ⇒ 灰类;已勾选 ⇒ 空串(不覆盖 element 自己的行类)。
 * @param {Set|Array} picked 勾选项(见 pickedKeySet)
 * @param {(row:object)=>any} [keyOf] 行对象 → 行键(默认 `lineKey`;材料码弹窗是 `id`、采购订单打印是 `__key`)
 * @returns {(arg:{row:object}) => string} 可直接绑到 `:row-class-name`
 */
export function pickRowClass(picked, keyOf = defaultKeyOf) {
  const set = pickedKeySet(picked, keyOf)
  return ({ row } = {}) => {
    const key = keyOf(row)
    // 没有行键的行(理论上不该出现)也按"没勾"处理:宁可灰,也不给它"可填"的假象
    if (key === null || key === undefined || key === '') return UNPICKED_ROW_CLASS
    return set.has(String(key)) ? '' : UNPICKED_ROW_CLASS
  }
}

/**
 * 行内控件的 disabled 判据:**未勾选一律不可填**。
 * 调用方再与业务条件(额度为 0 / 按打印记录带入后锁定 / 先选仓库 …)用 `||` 组合,先后无关。
 * @param {Set|Array} picked 勾选项
 * @param {string|number} key 本行行键
 * @param {(row:object)=>any} [keyOf] 勾选项里装的是行对象时才需要
 * @returns {boolean} true = 该锁(未勾选)
 */
export function pickRowLocked(picked, key, keyOf = defaultKeyOf) {
  return !isPicked(picked, key, keyOf)
}
