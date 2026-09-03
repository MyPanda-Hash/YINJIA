<!-- SelectVoucherDialog.vue — T+ SelectVoucher 1:1 复刻(查询区 + 表头 + 表体 + 底部操作区);
     显示层文案全部走 tt()(AGENTS.md 多语言规范);数据键保持中文(ADR-0001) -->
<template>
  <el-dialog :model-value="modelValue" :title="config?.title || tt('选单')" width="1100px" top="4vh" append-to-body destroy-on-close @update:model-value="close" @open="openDialog">
    <div class="sv-page">
      <!-- ═══ ① 查询条件区(对齐 T+ SimpleSearchControl,3列布局 + 可折叠) ═══ -->
      <div v-if="masterDetail" class="sv-search-container">
        <div class="sv-search-header">
          <el-button size="small" type="primary" :icon="Search" @click="load(1)">{{ tt('查询') }}</el-button>
          <el-button size="small" :icon="Setting" @click="notImplemented(tt('筛选设置'))">{{ tt('筛选设置') }}</el-button>
          <span class="sv-search-slide" @click="queryExpanded = !queryExpanded">
            {{ queryExpanded ? tt('收起') : tt('展开') }}
            <el-icon><ArrowUp v-if="queryExpanded" /><ArrowDown v-else /></el-icon>
          </span>
        </div>
        <el-collapse-transition>
          <div v-show="queryExpanded" class="sv-search-body">
            <div class="sv-search-grid">
              <div v-for="field in queryFields" :key="field.dataName" class="sv-filter-item">
                <label class="sv-filter-label" :title="field.dataName">{{ tt(field.dataName) }}</label>
                <!-- 日期范围(对齐 T+ DateSelectDropDown:起-止 + 快捷下拉) -->
                <template v-if="field.dataType === '日期'">
                  <el-date-picker v-model="query[field.dataName + '_start']" type="date" size="small" value-format="YYYY-MM-DD" :placeholder="tt('开始日期')" clearable style="width:130px" @change="load(1)" />
                  <span class="sv-between">-</span>
                  <el-date-picker v-model="query[field.dataName + '_end']" type="date" size="small" value-format="YYYY-MM-DD" :placeholder="tt('结束日期')" clearable style="width:130px" @change="load(1)" />
                  <el-select v-model="dateShortcuts[field.dataName]" size="small" :placeholder="tt('自定义')" style="width:88px" @change="applyDateShortcut(field)">
                    <el-option :label="tt('自定义')" value="" />
                    <el-option v-for="s in shortcutOptions" :key="s.value" :label="tt(s.label)" :value="s.value" />
                  </el-select>
                </template>
                <!-- 参照(对齐 T+ RefComboBox:下拉模糊搜索) -->
                <el-select v-else-if="field.dataType === '参照'" v-model="query[field.dataName]" size="small" clearable filterable remote :remote-method="(val) => remoteSearch(field, val)" :loading="refLoading" style="flex:1" @focus="() => remoteSearch(field, '')" @change="load(1)">
                  <el-option v-for="opt in refOptions[field.refPanel + '.' + field.refField] || []" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
                <!-- 下拉框 -->
                <el-select v-else-if="field.dataType === '下拉框'" v-model="query[field.dataName]" size="small" clearable filterable style="flex:1" @change="load(1)">
                  <el-option v-for="opt in field.options || []" :key="opt" :label="tt(opt)" :value="opt" />
                </el-select>
                <!-- 文本(对齐 T+ TextBox:回车查询) -->
                <el-input v-else v-model="query[field.dataName]" size="small" clearable style="flex:1" @keyup.enter="load(1)" @clear="load(1)" />
              </div>
            </div>
          </div>
        </el-collapse-transition>
      </div>

      <!-- ═══ ② 表头区(对齐 T+ grid:标题 + 计数 + SmartGrid) ═══ -->
      <div v-if="masterDetail" class="sv-head-grid" :style="{ height: headGridHeight + 'px' }">
        <div class="sv-grid-header">
          <div class="sv-grid-tab">
            <span class="sv-grid-tab-left"><span class="sv-grid-tab-right">{{ config?.headerTitle || tt('表头') }}</span></span>
          </div>
          <div class="sv-grid-sum">{{ tt('共') }} <span>{{ total }}</span> {{ tt('条记录') }}</div>
          <span class="sv-grid-toggle" :title="tt('向下展开')" @click="toggleHeadGrid"><el-icon><ArrowDown /></el-icon></span>
        </div>
        <el-table ref="headerTable" :data="rows" v-loading="loading" size="small" border height="100%" highlight-current-row @selection-change="onSel" @row-click="onCurrent">
          <el-table-column type="selection" width="42" />
          <el-table-column :label="tt('序号')" width="48" align="center">
            <template #default="{ $index }">{{ (pageNo - 1) * pageSize + $index + 1 }}</template>
          </el-table-column>
          <el-table-column v-for="col in columns" :key="col" :label="tt(col)" :width="columnWidth(col)" :min-width="columnMinWidth(col)" show-overflow-tooltip>
            <template #default="{ row }">{{ cellText(col, row) }}</template>
          </el-table-column>
          <el-table-column v-if="config?.purchaseFlow" :label="tt('可生单数量')" width="100" align="right">
            <template #default="{ row }">{{ sourceItems(row).reduce((s, i) => s + Number(i['剩余数量'] || 0), 0) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 拖拽条(对齐 T+ dragbar) -->
      <div v-if="masterDetail" class="sv-dragbar" :title="tt('上下拖拽')" @mousedown="startDrag"><span></span><span></span><span></span></div>

      <!-- ═══ ③ 表体区(对齐 T+ grid2:标题 + 计数 + SmartGrid) ═══ -->
      <template v-if="masterDetail">
        <div class="sv-body-grid">
          <div class="sv-grid-header">
            <div class="sv-grid-tab">
              <span class="sv-grid-tab-left"><span class="sv-grid-tab-right">{{ config?.detailTitle || tt('表体') }}</span></span>
            </div>
            <div class="sv-grid-sum">{{ tt('共') }} <span>{{ currentItems.length }}</span> {{ tt('条记录') }}</div>
            <span class="sv-current-doc">{{ currentNo || tt('请选择一条表头记录') }}</span>
          </div>
          <el-table ref="detailTable" :data="currentItems" size="small" border height="100%" row-key="_lineKey" :empty-text="tt('请选择表头记录查看对应表体')" @selection-change="onDetailSel">
            <el-table-column type="selection" width="42" />
            <el-table-column :label="tt('序号')" width="48" align="center"><template #default="{ $index }">{{ $index + 1 }}</template></el-table-column>
            <el-table-column v-for="col in detailColumns" :key="col" :prop="col" :label="tt(col)" min-width="110" show-overflow-tooltip />
          </el-table>
        </div>
      </template>

      <!-- 单表模式(无 masterDetail 时只有一张表) -->
      <div v-if="!masterDetail" class="sv-single-grid">
        <el-table ref="headerTable" :data="rows" v-loading="loading" size="small" border height="360" highlight-current-row @selection-change="onSel" @row-click="onCurrent">
          <el-table-column type="selection" width="42" />
          <el-table-column :label="tt('序号')" width="48" align="center">
            <template #default="{ $index }">{{ (pageNo - 1) * pageSize + $index + 1 }}</template>
          </el-table-column>
          <el-table-column v-for="col in columns" :key="col" :label="tt(col)" :width="columnWidth(col)" :min-width="columnMinWidth(col)" show-overflow-tooltip>
            <template #default="{ row }">{{ cellText(col, row) }}</template>
          </el-table-column>
          <el-table-column :label="tt('明细行')" min-width="200">
            <template #default="{ row }"><span class="sv-item-text">{{ itemsText(row) }}</span></template>
          </el-table-column>
        </el-table>
      </div>

      <!-- ═══ ④ 底部操作区(对齐 T+ operation-zone:栏目设置 + 连续选择 + 分页 + 确定/取消) ═══ -->
      <div class="sv-operation-zone">
        <div class="sv-op-left">
          <el-button link size="small" @click="notImplemented(tt('栏目设置'))">{{ tt('栏目设置') }}</el-button>
          <el-checkbox v-model="continueSelect" size="small" style="margin-left:16px">{{ tt('连续选择') }}</el-checkbox>
          <span v-if="selectedCount" class="sv-selected-count">{{ tt('已选') }} {{ selectedCount }} {{ tt('行') }}</span>
        </div>
        <div class="sv-op-center">
          <el-pagination small layout="total, prev, pager, next" :total="total" :page-size="pageSize" :current-page="pageNo" @current-change="load" />
        </div>
        <div class="sv-op-right">
          <el-button @click="close">{{ tt('取消') }}</el-button>
          <el-button type="primary" :disabled="!selectedCount" :loading="generating" @click="generate">{{ generateLabel }}</el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown, ArrowUp, Search, Setting } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import { usePanelRuntime } from '../panel-runtime'
import {
  setDocumentSelection,
  sourceDocumentNo,
  sourceWithSelectedDetails,
} from '@/core/selection/masterDetailSelection'

const engine = usePanelRuntime()

const props = defineProps({ modelValue: Boolean, panelCode: String, config: Object })
const emit = defineEmits(['update:modelValue', 'generated'])
const headerTable = ref(null)
const detailTable = ref(null)
const rows = ref([])
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const selRows = ref([])
const selectedDetailRows = ref([])
const selectionByDocument = ref(new Map())
const syncingSelection = ref(false)
const currentRow = ref(null)
const generating = ref(false)
const queryExpanded = ref(true)
const query = reactive({})
const refOptions = reactive({})
const refLoading = ref(false)
const continueSelect = ref(false)
const headGridHeight = ref(200)
const dateShortcuts = reactive({})

const masterDetail = computed(() => props.config?.masterDetail === true)
const columns = computed(() => props.config?.headerColumns || props.config?.columns || [])
const detailColumns = computed(() => props.config?.detailColumns || [])
const queryFields = computed(() => props.config?.queryFields || [])
const generateLabel = computed(() => props.config?.generateLabel || (props.config?.generateButton ? tt('生单') : tt('确定')))
const currentItems = computed(() => currentRow.value ? sourceItems(currentRow.value) : [])
const currentNo = computed(() => currentRow.value ? selVal(currentRow.value, '单据编号') : '')
const selectedCount = computed(() => masterDetail.value ? selectedDetailRows.value.length : selRows.value.length)

const shortcutOptions = [
  { label: '今天', value: 'today' }, { label: '昨天', value: 'yesterday' }, { label: '近3天', value: 'lastthreedays' },
  { label: '本周', value: 'thisweek' }, { label: '上周', value: 'preweek' }, { label: '近7天', value: 'lastsevendays' },
  { label: '近14天', value: 'lastfourteendays' }, { label: '本月', value: 'thismonth' }, { label: '上月', value: 'premonth' },
  { label: '本季', value: 'thisquarter' }, { label: '上季', value: 'prequarter' }, { label: '本年', value: 'thisyear' }, { label: '上年', value: 'preyear' },
]

function close() { emit('update:modelValue', false) }
function notImplemented(action) { ElMessage.info(tt('演示环境暂未实现') + '「' + action + '」') }
function columnWidth(col) { return ['单据编号', '单据日期', '预完工日', '预计交货日期'].includes(col) ? 120 : undefined }
function columnMinWidth(col) { return ['存货名称', '产品名称', '客户'].includes(col) ? 140 : 90 }
function sourceItems(row) {
  const detail = row?.detail
  if (!detail || typeof detail !== 'object') return []
  const key = props.config?.detailKey || Object.keys(detail)[0]
  return key && Array.isArray(detail[key]) ? detail[key] : []
}
function cellText(col, row) {
  if (row[col] !== undefined && row[col] !== null && row[col] !== '') return row[col]
  if (col === '单据编号') return row['锭号'] || row['编号'] || ''
  return sourceItems(row)[0]?.[col] ?? ''
}
function selVal(row, field) {
  if (row[field] !== undefined && row[field] !== null && row[field] !== '') return row[field]
  if (field === '单据编号') return row['锭号'] || row['编号'] || ''
  return row[field] ?? ''
}
function itemsText(row) {
  const items = sourceItems(row)
  const names = items.slice(0, 2).map((item) => item['存货名称'] || item['产品名称'] || '').filter(Boolean)
  return names.join('、') + (items.length > 2 ? ` ${tt('等')} ${items.length} ${tt('行')}` : '')
}

// ── 日期快捷(对齐 T+ DateSelectDropDown 的快捷选项) ──
function applyDateShortcut(field) {
  const type = dateShortcuts[field.dataName]
  if (!type) return
  const now = new Date()
  let start = new Date(), end = new Date()
  switch (type) {
    case 'today': break
    case 'yesterday': start.setDate(now.getDate() - 1); end = new Date(start); break
    case 'lastthreedays': start.setDate(now.getDate() - 2); break
    case 'thisweek': start.setDate(now.getDate() - now.getDay() + 1); break
    case 'preweek': start.setDate(now.getDate() - now.getDay() - 6); end.setDate(now.getDate() - now.getDay()); break
    case 'lastsevendays': start.setDate(now.getDate() - 6); break
    case 'lastfourteendays': start.setDate(now.getDate() - 13); break
    case 'thismonth': start = new Date(now.getFullYear(), now.getMonth(), 1); break
    case 'premonth': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); break
    case 'thisquarter': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break
    case 'prequarter': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1); end = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0); break
    case 'thisyear': start = new Date(now.getFullYear(), 0, 1); break
    case 'preyear': start = new Date(now.getFullYear() - 1, 0, 1); end = new Date(now.getFullYear() - 1, 11, 31); break
  }
  query[field.dataName + '_start'] = start.toISOString().slice(0, 10)
  query[field.dataName + '_end'] = end.toISOString().slice(0, 10)
  load(1)
}

// ── 表头/表体拖拽调整高度(对齐 T+ dragbar) ──
let dragStartY = 0, dragStartHeight = 0
function startDrag(e) {
  dragStartY = e.clientY
  dragStartHeight = headGridHeight.value
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}
function onDrag(e) {
  const delta = e.clientY - dragStartY
  headGridHeight.value = Math.max(100, Math.min(500, dragStartHeight + delta))
}
function stopDrag() {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}
function toggleHeadGrid() {
  headGridHeight.value = headGridHeight.value > 100 ? 100 : 200
}
onBeforeUnmount(() => { document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', stopDrag) })

// ── 参照远程搜索(对齐 T+ RefComboBox) ──
const refCache = new Map()
async function remoteSearch(field, keyword) {
  const ck = (field.refPanel || '') + '.' + (field.refField || '')
  if (refCache.has(ck)) { refOptions[ck] = refCache.get(ck); return }
  refLoading.value = true
  try {
    const result = await engine.queryFormDataList({ panelCode: field.refPanel, condition: field.filter || {}, pageNo: 1, pageSize: 100 })
    const display = field.displayField || field.refField
    const list = (result.list || []).map((row) => ({ value: row[display] ?? '', label: row[display] ?? '' })).filter((item) => item.value)
    refCache.set(ck, list)
    refOptions[ck] = list
  } catch { refOptions[ck] = [] }
  finally { refLoading.value = false }
}

// ── 表头↔表体联动(对齐 T+ SmartGrid 联动) ──
async function onSel(selected) {
  if (syncingSelection.value) return
  if (!masterDetail.value) {
    selRows.value = selected
    if (selected.length && !selected.includes(currentRow.value)) currentRow.value = selected[selected.length - 1]
    return
  }
  const prev = new Set(selRows.value.map(sourceDocumentNo))
  const curr = new Set(selected.map(sourceDocumentNo))
  let ds = selectionByDocument.value
  for (const m of rows.value) {
    const no = sourceDocumentNo(m)
    if (curr.has(no) && !prev.has(no)) ds = setDocumentSelection(ds, no, sourceItems(m))
    if (!curr.has(no) && prev.has(no)) ds = setDocumentSelection(ds, no, [])
  }
  selectionByDocument.value = ds
  selRows.value = selected
  const nc = selected[selected.length - 1] || currentRow.value
  if (nc) await selectMasterRow(nc)
}
async function selectMasterRow(row) {
  if (!row) return
  currentRow.value = row
  await nextTick()
  headerTable.value?.setCurrentRow(row)
  syncingSelection.value = true
  detailTable.value?.clearSelection()
  const sel = selectionByDocument.value.get(sourceDocumentNo(row)) || []
  const keys = new Set(sel.map((item) => item._lineKey || JSON.stringify(item)))
  for (const item of currentItems.value) {
    const key = item._lineKey || JSON.stringify(item)
    if (keys.has(key)) detailTable.value?.toggleRowSelection(item, true)
  }
  selectedDetailRows.value = sel
  await nextTick()
  syncingSelection.value = false
}
function onCurrent(row) { if (masterDetail.value) selectMasterRow(row); else if (row) currentRow.value = row }
async function onDetailSel(selected) {
  if (!masterDetail.value || !currentRow.value || syncingSelection.value) return
  const no = sourceDocumentNo(currentRow.value)
  selectedDetailRows.value = selected
  selectionByDocument.value = setDocumentSelection(selectionByDocument.value, no, selected)
  syncingSelection.value = true
  if (selected.length) headerTable.value?.toggleRowSelection(currentRow.value, true)
  else headerTable.value?.toggleRowSelection(currentRow.value, false)
  await nextTick()
  syncingSelection.value = false
}
function selectedSourceRows() {
  if (!masterDetail.value) return selRows.value
  const sources = []
  for (const m of selRows.value) {
    const sel = selectionByDocument.value.get(sourceDocumentNo(m)) || []
    const source = sourceWithSelectedDetails(m, sel, props.config?.detailKey)
    if (source) sources.push(source)
  }
  return sources
}

// ── 加载(对齐 T+ SelectVoucher 的查询流程) ──
function openDialog() {
  queryExpanded.value = true
  continueSelect.value = false
  Object.keys(query).forEach((k) => delete query[k])
  for (const f of queryFields.value) query[f.dataName] = f.defaultValue ?? ''
  load(1)
}
async function load(page) {
  if (!props.modelValue || !props.config) return
  loading.value = true
  pageNo.value = page || 1
  try {
    const condition = { 单据状态: '已审核', ...(props.config.sourceCondition || {}) }
    for (const [k, v] of Object.entries(query)) if (v !== '' && v !== null && v !== undefined) condition[k] = v
    let result
    if (props.config.purchaseFlow) {
      result = await engine.purchaseFlowSources({ sourcePanel: props.config.source, targetPanel: props.panelCode, condition, pageNo: pageNo.value, pageSize: pageSize.value })
    } else if (props.config.outsourceFlow) {
      result = await engine.outsourceFlowSources({ sourcePanel: props.config.source, targetPanel: props.panelCode,
        sourceKey: props.config.detailKey || 'items', businessType: props.config.targetBusinessType || '',
        condition, pageNo: pageNo.value, pageSize: pageSize.value })
    } else {
      result = await engine.queryFormDataList({ panelCode: props.config.source, condition, pageNo: pageNo.value, pageSize: pageSize.value })
    }
    rows.value = result.list || []
    total.value = result.totalSize || 0
    selRows.value = []
    selectedDetailRows.value = []
    selectionByDocument.value = new Map()
    currentRow.value = rows.value[0] || null
    await nextTick()
    if (currentRow.value) headerTable.value?.setCurrentRow(currentRow.value)
  } catch (error) { ElMessage.error(engine.errMsg(error) || tt('来源单据加载失败')) }
  finally { loading.value = false }
}

// ── 生单(对齐 T+ SelectVoucher 的确定逻辑) ──
async function generateMergedSelection(config, sources) {
  const mergeKeys = config.mergeKeys || ['委外供应商']
  for (const key of mergeKeys) {
    const values = new Set(sources.map((row) => String(row[key] || '')).filter(Boolean))
    if (values.size > 1) throw new Error(tt('多来源合并要求') + '"' + key + '"' + tt('一致'))
  }
  const head = {}
  for (const map of config.headerMap || []) head[map.to] = selVal(sources[0], map.from)
  let targetKey = config.targetDetailKey || config.detailKey || 'items'
  let targetDefaults = {}
  const targetConfig = await engine.getPanelConfig(props.panelCode)
  const targetTab = targetConfig?.detail?.tabs?.find((tab) => tab.key === targetKey) || targetConfig?.detail?.tabs?.[0]
  targetKey = targetTab?.key || targetKey
  targetDefaults = Object.fromEntries((targetTab?.fields || []).filter((f) => f.defaultValue !== undefined).map((f) => [f.dataName, f.defaultValue]))
  const ranges = []
  const items = []
  for (const source of sources) {
    const start = items.length
    for (const item of sourceItems(source)) {
      const target = { ...targetDefaults }
      for (const map of config.detailMap || []) target[map.to] = item[map.from] ?? target[map.to] ?? ''
      items.push(target)
    }
    ranges.push({ source, start, count: items.length - start })
  }
  const result = await engine.callButton({ panelCode: props.panelCode, buttonName: '保存', formData: { ...head, detail: { [targetKey]: items } }, buttonParam: {} })
  try {
    for (const range of ranges) {
      const sourceNo = range.source['编号'] || range.source['单据编号'] || ''
      await engine.linkOutsourceSelection({ sourcePanel: config.source, sourceNo, sourceKey: config.detailKey || 'items',
        targetPanel: props.panelCode, targetNo: result['编号'], targetKey, targetOffset: range.start,
        businessType: config.targetBusinessType || head['业务类型'] || '' })
    }
  } catch (error) {
    try { await engine.deleteForms({ panelCode: props.panelCode, rowCodes: [result['编号']] }) } catch {}
    throw error
  }
  return { panel: props.panelCode, no: result['编号'], sourceNo: ranges.map((r) => r.source['编号'] || r.source['单据编号']).join('、') }
}

async function generate() {
  const config = props.config
  const sources = selectedSourceRows()
  if (!sources.length) return
  const maxSources = Number(config.maxSourceDocuments || 0)
  if (maxSources > 0 && sources.length > maxSources) return ElMessage.warning(tt('每次最多选择') + ` ${maxSources} ` + tt('张来源单据'))
  generating.value = true
  const generated = []
  try {
    if (config.outsourceFlow && config.cardinality === 'MANY_TO_ONE' && sources.length > 1) {
      generated.push(await generateMergedSelection(config, sources))
    } else for (const source of sources) {
      const no = source['编号'] || source['单据编号'] || ''
      if (!no) continue
      if (config.generateButton) {
        const result = await engine.callButton({ panelCode: config.source, buttonName: config.generateButton, formData: { 编号: no }, buttonParam: {} })
        if (result?.gotoPanel) generated.push({ panel: result.gotoPanel, no: result['编号'], sourceNo: no })
        continue
      }
      const head = {}
      for (const map of config.headerMap || []) head[map.to] = selVal(source, map.from)
      let targetKey = config.targetDetailKey || config.detailKey || 'items'
      let targetDefaults = {}
      try {
        const tc = await engine.getPanelConfig(props.panelCode)
        const targetTab = tc?.detail?.tabs?.find((tab) => tab.key === targetKey) || tc?.detail?.tabs?.[0]
        targetKey = targetTab?.key || targetKey
        targetDefaults = Object.fromEntries((targetTab?.fields || []).filter((f) => f.defaultValue !== undefined).map((f) => [f.dataName, f.defaultValue]))
      } catch {}
      const items = sourceItems(source).map((item) => {
        const target = { ...targetDefaults }
        for (const map of config.detailMap || []) target[map.to] = item[map.from] ?? target[map.to] ?? ''
        return target
      })
      const result = await engine.callButton({ panelCode: props.panelCode, buttonName: '保存', formData: { ...head, detail: { [targetKey]: items } }, buttonParam: {} })
      if (result?.['编号'] && config.outsourceFlow) {
        try {
          await engine.linkOutsourceSelection({ sourcePanel: config.source, sourceNo: no, sourceKey: config.detailKey || 'items',
            targetPanel: props.panelCode, targetNo: result['编号'], targetKey, targetOffset: 0,
            businessType: config.targetBusinessType || head['业务类型'] || '' })
        } catch (error) {
          try { await engine.deleteForms({ panelCode: props.panelCode, rowCodes: [result['编号']] }) } catch {}
          throw error
        }
      }
      if (result?.['编号']) generated.push({ panel: props.panelCode, no: result['编号'], sourceNo: no })
    }
    if (!generated.length) return ElMessage.warning(tt('未生成任何单据'))
    ElMessage.success(tt('已生成') + ` ${generated.length} ` + tt('张单据'))
    emit('generated', generated)
    if (!continueSelect.value) close()
    else { rows.value = []; total.value = 0; selRows.value = []; selectedDetailRows.value = []; selectionByDocument.value = new Map(); load(1) }
  } catch (error) { ElMessage.error(engine.errMsg(error) || tt('生单失败')) }
  finally { generating.value = false }
}
</script>

<style scoped>
/* ═══ 对齐 T+ SelectVoucher 页面布局 ═══ */
.sv-page { display: flex; flex-direction: column; gap: 0; min-height: 480px; }

/* ── ① 查询条件区 ── */
.sv-search-container { border: 1px solid #e1e5eb; margin-bottom: 8px; }
.sv-search-header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #f5f6f8; border-bottom: 1px solid #e1e5eb; }
.sv-search-slide { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font-size: 12px; color: #667085; cursor: pointer; }
.sv-search-body { padding: 10px 12px; }
.sv-search-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; }
.sv-filter-item { display: flex; align-items: center; gap: 6px; min-width: 0; }
.sv-filter-label { width: 72px; flex: none; text-align: right; font-size: 12px; color: #606266; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sv-filter-item .el-input, .sv-filter-item .el-select { flex: 1; min-width: 0; }
.sv-between { color: #909399; font-size: 12px; flex: none; }
@media (max-width: 900px) { .sv-search-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .sv-search-grid { grid-template-columns: 1fr; } }

/* ── ② 表头区 ── */
.sv-head-grid { display: flex; flex-direction: column; border: 1px solid #d9dde3; overflow: hidden; }
.sv-grid-header { display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 10px; background: #f5f6f8; border-bottom: 1px solid #d9dde3; }
.sv-grid-tab { display: inline-flex; align-items: center; height: 22px; padding: 0 14px; background: #fff; border: 1px solid #d9dde3; border-bottom: 0; font-size: 12px; font-weight: 600; color: #303642; }
.sv-grid-tab-left { display: inline-flex; }
.sv-grid-tab-right { display: inline-flex; }
.sv-grid-sum { font-size: 12px; color: #667085; }
.sv-grid-sum span { font-weight: 600; color: #303642; margin: 0 2px; }
.sv-grid-toggle { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 1px solid #cdd2d8; border-radius: 50%; background: #fff; cursor: pointer; margin-left: auto; }
.sv-grid-toggle:hover { background: #eaf5fc; border-color: #1677ff; color: #1677ff; }
.sv-grid-toggle .el-icon { font-size: 12px; color: #667085; }

/* ── 拖拽条 ── */
.sv-dragbar { display: flex; align-items: center; justify-content: center; height: 8px; cursor: ns-resize; }
.sv-dragbar span { display: inline-block; width: 30px; height: 2px; margin: 0 2px; border-radius: 1px; background: #cdd2d8; }
.sv-dragbar:hover span { background: #1677ff; }

/* ── ③ 表体区 ── */
.sv-body-grid { flex: 1; min-height: 180px; display: flex; flex-direction: column; border: 1px solid #d9dde3; overflow: hidden; }
.sv-current-doc { margin-left: auto; font-size: 12px; color: #667085; }

/* ── 单表模式 ── */
.sv-single-grid { flex: 1; min-height: 360px; }
.sv-item-text { color: #1c4f8a; font-size: 12px; }

/* ── ④ 底部操作区 ── */
.sv-operation-zone { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e1e5eb; }
.sv-op-left { display: flex; align-items: center; gap: 6px; }
.sv-op-center { flex: 1; display: flex; justify-content: center; }
.sv-op-right { display: flex; align-items: center; gap: 8px; }
.sv-selected-count { font-size: 12px; color: #1677ff; font-weight: 600; }
</style>
