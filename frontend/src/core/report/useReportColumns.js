import { computed, reactive, ref, watch } from 'vue'
import { buildReportColumnSettings, sortReportRows, visibleReportColumns } from './reportColumnSettings'
import request from '@core/request'

/**
 * 通用「列设置」composable(报表表头筛选与排序补丁;2026-10-29 起也被自建工作台页复用)。
 * 任何组件调用即可获得栏目显隐、表头筛选、升序降序、后端持久化能力。
 *
 * 显隐口径(2026-10-29 补,自建页 ORDER_CONVERT「列设置」需要):
 *   · {@link init} 在页面挂载时把后端已保存的显隐**先应用上**(此前只有打开弹窗才生效,
 *     刷新后表格仍是全部列 —— 那是"列设置"从未真正落地的一个缺口);
 *   · 未保存过 = 全部可见(回退契约不变)。
 *
 * @param {Ref<string>} panelCode - 当前面板编码
 * @param {ComputedRef<string[]>} columns - 当前报表全部字段名列表
 * @param {ComputedRef<Object[]>} rows - 当前报表原始数据行
 */
export function useReportColumns(panelCode, columns, rows) {
  // ---- 状态 ----
  const columnVisible = ref(false)     // 栏目设置弹窗显示状态
  const columnDraft = ref([])           // 栏目设置弹窗的编辑副本
  const columnCurrent = ref(null)       // 栏目弹窗当前选中行
  const sort = reactive({ prop: '', order: '' })  // 排序状态
  const headerFilters = reactive({})    // 表头筛选状态 {字段名: 已选值数组}
  const serverSaved = ref(null)         // 后端返回的已保存设置
  const settingsLoaded = ref(false)     // 是否已从后端加载
  const filterVisible = ref(false)      // 表头筛选面板显示状态
  const filterProp = ref('')            // 当前筛选的字段名

  // ---- 后端持久化 ----

  async function loadSaved() {
    if (settingsLoaded.value) return serverSaved.value
    try {
      const res = await request.get(`/px/reportColumnSettings`, {
        params: { panelCode: panelCode.value }
      })
      const data = res?.data ?? res
      serverSaved.value = data && Object.keys(data).length ? data : null
    } catch { serverSaved.value = null }
    settingsLoaded.value = true
    return serverSaved.value
  }

  function applySaved(saved) {
    if (!saved) return
    columnDraft.value = buildReportColumnSettings(columns.value, saved)
    sort.prop = saved?.sort?.prop || ''
    sort.order = saved?.sort?.order || ''
  }

  // ---- 计算属性 ----

  /** 可见列的 prop 列表(弹窗未打开过时回落到全部列) */
  const visibleProps = computed(() => {
    return columnDraft.value.length
      ? visibleReportColumns(columnDraft.value)
      : columns.value
  })

  /** 按表头筛选条件过滤后的行 */
  const filteredRows = computed(() => {
    const entries = Object.entries(headerFilters)
      .filter(([, values]) => Array.isArray(values) && values.length)
    if (!entries.length) return rows.value
    return rows.value.filter((row) =>
      entries.every(([prop, values]) => values.includes(row[prop] ?? ''))
    )
  })

  /** 筛选后再排序的最终数据 */
  const sortedRows = computed(() => sortReportRows(filteredRows.value, sort))

  /** 弹窗中勾选的可见列数量 */
  const selectedCount = computed(() =>
    columnDraft.value.filter((column) => column.visible).length
  )

  // ---- 操作函数 ----

  /** 获取某列的去重值列表(用于筛选面板) */
  function distinctValues(prop) {
    const values = new Set(rows.value.map((row) => row[prop] ?? ''))
    return [...values].sort((l, r) => String(l).localeCompare(String(r), 'zh-CN'))
  }

  /** 判断某列是否已设置筛选 */
  function isFiltered(prop) {
    return Array.isArray(headerFilters[prop]) && headerFilters[prop].length > 0
  }

  /** 清除某列筛选 */
  function clearFilter(prop) { headerFilters[prop] = [] }

  /** 设置排序(表头图标点击) */
  function setSort(prop, order) { sort.prop = prop; sort.order = order }

  /** 打开某列的筛选面板 */
  function openFilter(prop) {
    if (!Array.isArray(headerFilters[prop])) headerFilters[prop] = []
    filterProp.value = prop
    filterVisible.value = true
  }

  function applyFilter() { filterVisible.value = false }

  /** 打开栏目设置弹窗(从后端加载已保存设置) */
  async function openDialog() {
    const saved = await loadSaved()
    applySaved(saved)
    if (!columnDraft.value.length) columnDraft.value = buildReportColumnSettings(columns.value, null)
    columnCurrent.value = null
    columnVisible.value = true
  }

  /**
   * 页面挂载时应用已保存的列设置(2026-10-29 自建页复用):
   * 不打开弹窗也要按保存的显隐渲染;没保存过 / 读取失败 ⇒ 草稿=全部可见(与旧回退契约一致)。
   * 幂等:loadSaved 自身带 settingsLoaded 缓存,重复调用只命中一次后端。
   */
  async function init() {
    const saved = await loadSaved()
    applySaved(saved)
    if (!columnDraft.value.length) columnDraft.value = buildReportColumnSettings(columns.value, null)
  }

  /** 恢复默认(全部可见;只改草稿,点「保存」才落库) */
  function resetDraft() {
    columnDraft.value = buildReportColumnSettings(columns.value, null)
  }

  /**
   * 保存栏目设置到后端。
   * @returns {Promise<boolean>} true=已落库(调用方可据此提示成败;失败时草稿保持不变、serverSaved 不动,
   *   下次「取消」会回退到真正持久化的那份,不会出现"提示已保存、刷新却回退")
   */
  async function saveDialog() {
    // 深拷贝一份:别把草稿数组本身存进 serverSaved(否则两者是同一个引用,后续勾选会互相污染)
    const settings = { columns: columnDraft.value.map((c) => ({ ...c })), sort: { ...sort } }
    let ok = true
    try {
      await request.post('/px/reportColumnSettings', {
        panelCode: panelCode.value, settings
      })
    } catch {
      ok = false
    }
    // 2026-10-29:保存成功才同步本地缓存 —— 否则再次打开弹窗(或点取消)会按 init 时读到的
    // 旧 serverSaved 重建草稿,把本次保存的显隐又覆盖回去。
    if (ok) serverSaved.value = settings
    columnVisible.value = false
    columnCurrent.value = null
    return ok
  }

  /** 取消栏目设置(不保存):丢弃本次草稿,回到后端已保存的那份 */
  function cancelDialog() {
    columnVisible.value = false
    // 2026-10-29:此前是清空草稿(visibleProps 回退成"全部可见"),取消一次就把已保存的
    // 隐藏列全部放出来;改为按 serverSaved 重建,与打开弹窗时的初始状态一致。
    columnDraft.value = buildReportColumnSettings(columns.value, serverSaved.value)
    columnCurrent.value = null
  }

  // 面板切换时重置状态
  watch(panelCode, () => {
    columnDraft.value = []
    sort.prop = ''
    sort.order = ''
    serverSaved.value = null
    settingsLoaded.value = false
    Object.keys(headerFilters).forEach((key) => delete headerFilters[key])
  })

  return {
    columnVisible, columnDraft, columnCurrent,
    sort, headerFilters,
    visibleProps, sortedRows, selectedCount,
    distinctValues, isFiltered, clearFilter, setSort,
    openDialog, saveDialog, cancelDialog, init, resetDraft,
    filterVisible, filterProp, openFilter, applyFilter,
  }
}
