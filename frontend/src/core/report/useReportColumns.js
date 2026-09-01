import { computed, reactive, ref, watch } from 'vue'
import { buildReportColumnSettings, sortReportRows, visibleReportColumns } from './reportColumnSettings'
import request from '@core/request'

/**
 * 通用报表栏目 composable(报表表头筛选与排序补丁)。
 * 任何组件调用即可获得栏目显隐、表头筛选、升序降序、后端持久化能力。
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
    columnCurrent.value = null
    columnVisible.value = true
  }

  /** 保存栏目设置到后端 */
  async function saveDialog() {
    const settings = { columns: columnDraft.value, sort: { ...sort } }
    try {
      await request.post('/px/reportColumnSettings', {
        panelCode: panelCode.value, settings
      })
    } catch { /* 保存失败不阻断本地效果 */ }
    columnVisible.value = false
    columnCurrent.value = null
  }

  /** 取消栏目设置(不保存) */
  function cancelDialog() {
    columnVisible.value = false
    columnDraft.value = []
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
    openDialog, saveDialog, cancelDialog,
    filterVisible, filterProp, openFilter, applyFilter,
  }
}
