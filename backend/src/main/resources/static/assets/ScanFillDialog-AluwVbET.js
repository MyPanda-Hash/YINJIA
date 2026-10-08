import { v as vLoading, j as ElTable, c as ElTag, g as ElTableColumn, d as ElButton, f as ElDialog, z as ElDatePicker, n as ElSelect, o as ElOption, i as ElInput, k as ElMessage, A as ElIcon, M as ElCollapseTransition, D as ElCheckbox, H as ElPagination, N as ElAlert, t as ElSwitch, h as ElInputNumber, I as ElRadioButton, b as ElEmpty, r as ElRadioGroup } from './element-plus-W84rT0en.js';
import { r as request, u as usePanelRuntime, t as tt, _ as __vitePreload } from './index-CqmwEeWF.js';
/* empty css                   */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                */
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import { j as watch, o as openBlock, P as createBlock, W as withCtx, X as withDirectives, a0 as createVNode, _ as createTextVNode, $ as toDisplayString, c as createElementBlock, Z as createCommentVNode, p as ref, D as onBeforeUnmount, a as createBaseVNode, A as unref, a1 as vShow, J as Fragment, ae as renderList, aq as withKeys, R as normalizeStyle, f as computed, u as nextTick, z as reactive } from './vue-vendor-DyX2BAKf.js';
/* empty css                   */
/* empty css                       */
/* empty css                        */
import { M as search_default, S as setting_default, j as arrow_up_default, k as arrow_down_default, T as upload_default, U as camera_default, P as delete_default, V as document_checked_default } from './element-icons-DOEvq9OG.js';
/* empty css                  */
/* empty css                  */
/* empty css                         */
/* empty css                         */
/* empty css                   */
/* empty css                  */

const SCAN_FILL_ACTION = '扫描填单';

function actionsOf(group) {
  if (Array.isArray(group?.actions)) return group.actions
  if (Array.isArray(group?.items)) return group.items
  return []
}

function enabledFlag(value) {
  return value === true || value === 1 || String(value ?? '').trim().toLowerCase() === 'true'
}

function supportsScanFill(metadata) {
  return String(metadata?.panelCategory ?? '').trim().endsWith('单据')
    && !enabledFlag(metadata?.readonly)
    && !enabledFlag(metadata?.readOnly)
}

/** Keep old toolbar configurations compatible without mutating their arrays. */
function ensureScanFillAction(rawGroups, metadata) {
  const groups = (Array.isArray(rawGroups) ? rawGroups : [])
    .filter((group) => group && typeof group === 'object')
    .map((group) => ({
      ...group,
      actions: [...new Set(actionsOf(group))],
    }));

  const categoryKnown = metadata
    && typeof metadata === 'object'
    && Object.prototype.hasOwnProperty.call(metadata, 'panelCategory');
  if (!categoryKnown) return groups

  for (const group of groups) {
    group.actions = group.actions.filter((action) => action !== SCAN_FILL_ACTION);
  }
  if (!supportsScanFill(metadata)) return groups

  const moreGroup = groups.find((group) => group.name === '更多');
  if (moreGroup) {
    if (!moreGroup.actions.length) moreGroup.actions.push('刷新');
    moreGroup.actions.push(SCAN_FILL_ACTION);
  } else {
    groups.push({ name: '更多', actions: ['刷新', SCAN_FILL_ACTION] });
  }
  return groups
}

// 参照带回映射(ref.map/refMap 契约):从引用面板选中一条源数据后,把映射字段整串回填到目标对象。
// 表头弹窗确认、表头下拉选中(≤20 下拉模式)、明细行导入三条路径共用,保证带回口径一致:
// 主字段自身跳过(其值取自 refField);源行缺 from 值不覆盖;清空/自由输入由调用方不调用本函数兜底。

/** 按 ref.map/refMap 把源行字段回填到 target(to 缺省取 from,跳过 mainKey 自身)。 */
function applyRefCarry(target, row, ref, mainKey) {
  for (const m of (ref?.map || ref?.refMap || [])) {
    if (!m || row[m.from] === undefined) continue
    const to = m.to || m.from;
    if (to !== mainKey) target[to] = row[m.from];
  }
}

/** 取字段的参照配置(兼容 meta.ref 对象与列表配置顶层 refPanel/refField 两种形态)。 */
function refConfigOf(field) {
  return field?.ref && typeof field.ref === 'object' ? field.ref : field
}

/** 编码型参照(refField≠displayField,如 供应商编码 存编码、列表按名称挑选):
 *  下拉选中态应显示存值(编码)而非选项 label(名称)——对齐弹窗模式的原始值显示,
 *  否则"编码"字段选中/被带回后显示成名称(采购入库单.供应商编码 应显示 GYS001 而非供应商名)。 */
function refShowsCode(field) {
  const ref = refConfigOf(field);
  const f = ref?.field || ref?.refField;
  const d = ref?.display || ref?.displayField;
  return !!f && !!d && f !== d
}

/* unplugin-vue-components disabled */

const _hoisted_1$3 = {
  key: 0,
  class: "empty"
};


const _sfc_main$3 = {
  __name: 'ApprovalHistoryDialog',
  props: {
  modelValue: Boolean,
  panelCode: String,
  formNo: String,
},
  emits: ['update:modelValue'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

const records = ref([]);
const loading = ref(false);

function close() {
  emit('update:modelValue', false);
}

function actionLabel(r) {
  return { SUBMIT: '提交审批', APPROVE: '审批通过', REJECT: '审批驳回', UNAUDIT: '弃审' }[r.action] || r.action || '-'
}
function resultLabel(r) {
  return { PENDING: '审批中', APPROVED: '已通过', REJECTED: '已驳回' }[r.result] || r.result || '-'
}
function tagType(r) {
  return { SUBMIT: 'info', APPROVE: 'success', REJECT: 'danger', UNAUDIT: 'warning' }[r.action] || 'info'
}

watch(
  () => props.modelValue,
  async (v) => {
    if (v && props.panelCode && props.formNo) {
      loading.value = true;
      records.value = [];
      try {
        const res = await request.get('/px/getApprovalHistory', { params: { panelCode: props.panelCode, code: props.formNo } });
        records.value = Array.isArray(res) ? res : res?.data || [];
      } catch (e) {
        records.value = [];
      } finally {
        loading.value = false;
      }
    }
  }
);

return (_ctx, _cache) => {
  const _component_el_table_column = ElTableColumn;
  const _component_el_tag = ElTag;
  const _component_el_table = ElTable;
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;
  const _directive_loading = vLoading;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: "审批情况",
    width: "760px",
    "append-to-body": "",
    "onUpdate:modelValue": close
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, { onClick: close }, {
        default: withCtx(() => [...(_cache[0] || (_cache[0] = [
          createTextVNode("关闭", -1)
        ]))]),
        _: 1
      })
    ]),
    default: withCtx(() => [
      withDirectives((openBlock(), createBlock(_component_el_table, {
        data: records.value,
        size: "small",
        border: ""
      }, {
        default: withCtx(() => [
          createVNode(_component_el_table_column, {
            label: "序号",
            width: "55",
            align: "center"
          }, {
            default: withCtx(({ $index }) => [
              createTextVNode(toDisplayString($index + 1), 1)
            ]),
            _: 1
          }),
          createVNode(_component_el_table_column, {
            label: "节点",
            prop: "nodeNo",
            width: "60",
            align: "center"
          }),
          createVNode(_component_el_table_column, {
            label: "动作",
            width: "110"
          }, {
            default: withCtx(({ row }) => [
              createVNode(_component_el_tag, {
                size: "small",
                type: tagType(row)
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(actionLabel(row)), 1)
                ]),
                _: 2
              }, 1032, ["type"])
            ]),
            _: 1
          }),
          createVNode(_component_el_table_column, {
            label: "操作人",
            prop: "operator",
            width: "110"
          }),
          createVNode(_component_el_table_column, {
            label: "结果",
            width: "90"
          }, {
            default: withCtx(({ row }) => [
              createTextVNode(toDisplayString(resultLabel(row)), 1)
            ]),
            _: 1
          }),
          createVNode(_component_el_table_column, {
            label: "意见",
            prop: "opinion",
            "show-overflow-tooltip": ""
          }),
          createVNode(_component_el_table_column, {
            label: "时间",
            prop: "createTime",
            width: "165"
          })
        ]),
        _: 1
      }, 8, ["data"])), [
        [_directive_loading, loading.value]
      ]),
      (!loading.value && !records.value.length)
        ? (openBlock(), createElementBlock("div", _hoisted_1$3, "暂无审批记录"))
        : createCommentVNode("", true)
    ]),
    _: 1
  }, 8, ["model-value"]))
}
}

};
const ApprovalHistoryDialog = /*#__PURE__*/_export_sfc(_sfc_main$3, [['__scopeId',"data-v-47513afa"]]);

function text(value) {
  return value == null ? '' : String(value).trim()
}

function sourceDocumentNo(row) {
  return text(row?.来源单号 || row?.单据编号 || row?.编号)
}

function setDocumentSelection(selectionByDocument, documentNo, rows = []) {
  const next = new Map(selectionByDocument);
  if (rows.length) next.set(documentNo, [...rows]);
  else next.delete(documentNo);
  return next
}

function sourceWithSelectedDetails(master, selectedRows = [], detailKey = '') {
  if (!master || !selectedRows.length) return null
  const detail = { ...(master.detail || {}) };
  const key = detailKey || Object.keys(detail)[0] || 'items';
  detail[key] = [...selectedRows];
  return { ...master, detail }
}

/* unplugin-vue-components disabled */

const _hoisted_1$2 = { class: "sv-page" };
const _hoisted_2$2 = {
  key: 0,
  class: "sv-search-container"
};
const _hoisted_3$2 = { class: "sv-search-header" };
const _hoisted_4$2 = { class: "sv-search-body" };
const _hoisted_5$2 = { class: "sv-search-grid" };
const _hoisted_6$2 = ["title"];
const _hoisted_7$1 = { class: "sv-grid-header" };
const _hoisted_8$1 = { class: "sv-grid-tab" };
const _hoisted_9$1 = { class: "sv-grid-tab-left" };
const _hoisted_10$1 = { class: "sv-grid-tab-right" };
const _hoisted_11$1 = { class: "sv-grid-sum" };
const _hoisted_12$1 = ["title"];
const _hoisted_13 = ["title"];
const _hoisted_14 = {
  key: 3,
  class: "sv-body-grid"
};
const _hoisted_15 = { class: "sv-grid-header" };
const _hoisted_16 = { class: "sv-grid-tab" };
const _hoisted_17 = { class: "sv-grid-tab-left" };
const _hoisted_18 = { class: "sv-grid-tab-right" };
const _hoisted_19 = { class: "sv-grid-sum" };
const _hoisted_20 = { class: "sv-current-doc" };
const _hoisted_21 = {
  key: 4,
  class: "sv-single-grid"
};
const _hoisted_22 = { class: "sv-item-text" };
const _hoisted_23 = { class: "sv-operation-zone" };
const _hoisted_24 = { class: "sv-op-left" };
const _hoisted_25 = {
  key: 0,
  class: "sv-selected-count"
};
const _hoisted_26 = { class: "sv-op-center" };
const _hoisted_27 = { class: "sv-op-right" };


const _sfc_main$2 = {
  __name: 'SelectVoucherDialog',
  props: { modelValue: Boolean, panelCode: String, config: Object },
  emits: ['update:modelValue', 'generated'],
  setup(__props, { emit: __emit }) {

const engine = usePanelRuntime();

const props = __props;
const emit = __emit;
const headerTable = ref(null);
const detailTable = ref(null);
const rows = ref([]);
const total = ref(0);
const pageNo = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const selRows = ref([]);
const selectedDetailRows = ref([]);
const selectionByDocument = ref(new Map());
const syncingSelection = ref(false);
const currentRow = ref(null);
const generating = ref(false);
const queryExpanded = ref(true);
const query = reactive({});
const refOptions = reactive({});
const refLoading = ref(false);
const continueSelect = ref(false);
const headGridHeight = ref(200);
const dateShortcuts = reactive({});

const masterDetail = computed(() => props.config?.masterDetail === true);
const columns = computed(() => props.config?.headerColumns || props.config?.columns || []);
const detailColumns = computed(() => props.config?.detailColumns || []);
const queryFields = computed(() => props.config?.queryFields || []);
const generateLabel = computed(() => props.config?.generateLabel || (props.config?.generateButton ? tt('生单') : tt('确定')));
const currentItems = computed(() => currentRow.value ? sourceItems(currentRow.value) : []);
const currentNo = computed(() => currentRow.value ? selVal(currentRow.value, '单据编号') : '');
const selectedCount = computed(() => masterDetail.value ? selectedDetailRows.value.length : selRows.value.length);

const shortcutOptions = [
  { label: '今天', value: 'today' }, { label: '昨天', value: 'yesterday' }, { label: '近3天', value: 'lastthreedays' },
  { label: '本周', value: 'thisweek' }, { label: '上周', value: 'preweek' }, { label: '近7天', value: 'lastsevendays' },
  { label: '近14天', value: 'lastfourteendays' }, { label: '本月', value: 'thismonth' }, { label: '上月', value: 'premonth' },
  { label: '本季', value: 'thisquarter' }, { label: '上季', value: 'prequarter' }, { label: '本年', value: 'thisyear' }, { label: '上年', value: 'preyear' },
];

function close() { emit('update:modelValue', false); }
function notImplemented(action) { ElMessage.info(tt('演示环境暂未实现') + '「' + action + '」'); }
function columnWidth(col) { return ['单据编号', '单据日期', '预完工日', '预计交货日期'].includes(col) ? 120 : undefined }
function columnMinWidth(col) { return ['存货名称', '产品名称', '客户'].includes(col) ? 140 : 90 }
function sourceItems(row) {
  const detail = row?.detail;
  if (!detail || typeof detail !== 'object') return []
  const key = props.config?.detailKey || Object.keys(detail)[0];
  return key && Array.isArray(detail[key]) ? detail[key] : []
}
function cellText(col, row) {
  if (row[col] !== undefined && row[col] !== null && row[col] !== '') return row[col]
  if (col === '单据编号') return row['编号'] || ''
  return sourceItems(row)[0]?.[col] ?? ''
}
function selVal(row, field) {
  if (row[field] !== undefined && row[field] !== null && row[field] !== '') return row[field]
  if (field === '单据编号') return row['编号'] || ''
  return row[field] ?? ''
}
function itemsText(row) {
  const items = sourceItems(row);
  const names = items.slice(0, 2).map((item) => item['存货名称'] || item['产品名称'] || '').filter(Boolean);
  return names.join('、') + (items.length > 2 ? ` ${tt('等')} ${items.length} ${tt('行')}` : '')
}

// ── 日期快捷(对齐 T+ DateSelectDropDown 的快捷选项) ──
function applyDateShortcut(field) {
  const type = dateShortcuts[field.dataName];
  if (!type) return
  const now = new Date();
  let start = new Date(), end = new Date();
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
  query[field.dataName + '_start'] = start.toISOString().slice(0, 10);
  query[field.dataName + '_end'] = end.toISOString().slice(0, 10);
  load(1);
}

// ── 表头/表体拖拽调整高度(对齐 T+ dragbar) ──
let dragStartY = 0, dragStartHeight = 0;
function startDrag(e) {
  dragStartY = e.clientY;
  dragStartHeight = headGridHeight.value;
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
}
function onDrag(e) {
  const delta = e.clientY - dragStartY;
  headGridHeight.value = Math.max(100, Math.min(500, dragStartHeight + delta));
}
function stopDrag() {
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}
function toggleHeadGrid() {
  headGridHeight.value = headGridHeight.value > 100 ? 100 : 200;
}
onBeforeUnmount(() => { document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', stopDrag); });

// ── 参照远程搜索(对齐 T+ RefComboBox) ──
const refCache = new Map();
async function remoteSearch(field, keyword) {
  const ck = (field.refPanel || '') + '.' + (field.refField || '');
  if (refCache.has(ck)) { refOptions[ck] = refCache.get(ck); return }
  refLoading.value = true;
  try {
    const result = await engine.queryFormDataList({ panelCode: field.refPanel, condition: field.filter || {}, pageNo: 1, pageSize: 100 });
    const display = field.displayField || field.refField;
    const list = (result.list || []).map((row) => ({ value: row[display] ?? '', label: row[display] ?? '' })).filter((item) => item.value);
    refCache.set(ck, list);
    refOptions[ck] = list;
  } catch { refOptions[ck] = []; }
  finally { refLoading.value = false; }
}

// ── 表头↔表体联动(对齐 T+ SmartGrid 联动) ──
async function onSel(selected) {
  if (syncingSelection.value) return
  if (!masterDetail.value) {
    selRows.value = selected;
    if (selected.length && !selected.includes(currentRow.value)) currentRow.value = selected[selected.length - 1];
    return
  }
  const prev = new Set(selRows.value.map(sourceDocumentNo));
  const curr = new Set(selected.map(sourceDocumentNo));
  let ds = selectionByDocument.value;
  for (const m of rows.value) {
    const no = sourceDocumentNo(m);
    if (curr.has(no) && !prev.has(no)) ds = setDocumentSelection(ds, no, sourceItems(m));
    if (!curr.has(no) && prev.has(no)) ds = setDocumentSelection(ds, no, []);
  }
  selectionByDocument.value = ds;
  selRows.value = selected;
  const nc = selected[selected.length - 1] || currentRow.value;
  if (nc) await selectMasterRow(nc);
}
async function selectMasterRow(row) {
  if (!row) return
  currentRow.value = row;
  await nextTick();
  headerTable.value?.setCurrentRow(row);
  syncingSelection.value = true;
  detailTable.value?.clearSelection();
  const sel = selectionByDocument.value.get(sourceDocumentNo(row)) || [];
  const keys = new Set(sel.map((item) => item._lineKey || JSON.stringify(item)));
  for (const item of currentItems.value) {
    const key = item._lineKey || JSON.stringify(item);
    if (keys.has(key)) detailTable.value?.toggleRowSelection(item, true);
  }
  selectedDetailRows.value = sel;
  await nextTick();
  syncingSelection.value = false;
}
function onCurrent(row) { if (masterDetail.value) selectMasterRow(row); else if (row) currentRow.value = row; }
async function onDetailSel(selected) {
  if (!masterDetail.value || !currentRow.value || syncingSelection.value) return
  const no = sourceDocumentNo(currentRow.value);
  selectedDetailRows.value = selected;
  selectionByDocument.value = setDocumentSelection(selectionByDocument.value, no, selected);
  syncingSelection.value = true;
  if (selected.length) headerTable.value?.toggleRowSelection(currentRow.value, true);
  else headerTable.value?.toggleRowSelection(currentRow.value, false);
  await nextTick();
  syncingSelection.value = false;
}
function selectedSourceRows() {
  if (!masterDetail.value) return selRows.value
  const sources = [];
  for (const m of selRows.value) {
    const sel = selectionByDocument.value.get(sourceDocumentNo(m)) || [];
    const source = sourceWithSelectedDetails(m, sel, props.config?.detailKey);
    if (source) sources.push(source);
  }
  return sources
}

// ── 加载(对齐 T+ SelectVoucher 的查询流程) ──
function openDialog() {
  queryExpanded.value = true;
  continueSelect.value = false;
  Object.keys(query).forEach((k) => delete query[k]);
  for (const f of queryFields.value) query[f.dataName] = f.defaultValue ?? '';
  load(1);
}
async function load(page) {
  if (!props.modelValue || !props.config) return
  loading.value = true;
  pageNo.value = page || 1;
  try {
    const condition = { 单据状态: '已审核', ...(props.config.sourceCondition || {}) };
    for (const [k, v] of Object.entries(query)) if (v !== '' && v !== null && v !== undefined) condition[k] = v;
    let result;
    if (props.config.purchaseFlow) {
      result = await engine.purchaseFlowSources({ sourcePanel: props.config.source, targetPanel: props.panelCode, condition, pageNo: pageNo.value, pageSize: pageSize.value });
    } else if (props.config.outsourceFlow) {
      result = await engine.outsourceFlowSources({ sourcePanel: props.config.source, targetPanel: props.panelCode,
        sourceKey: props.config.detailKey || 'items', businessType: props.config.targetBusinessType || '',
        condition, pageNo: pageNo.value, pageSize: pageSize.value });
    } else {
      result = await engine.queryFormDataList({ panelCode: props.config.source, condition, pageNo: pageNo.value, pageSize: pageSize.value });
    }
    rows.value = result.list || [];
    total.value = result.totalSize || 0;
    selRows.value = [];
    selectedDetailRows.value = [];
    selectionByDocument.value = new Map();
    currentRow.value = rows.value[0] || null;
    await nextTick();
    if (currentRow.value) headerTable.value?.setCurrentRow(currentRow.value);
  } catch (error) { ElMessage.error(engine.errMsg(error) || tt('来源单据加载失败')); }
  finally { loading.value = false; }
}

// ── 生单(对齐 T+ SelectVoucher 的确定逻辑) ──
async function generateMergedSelection(config, sources) {
  const mergeKeys = config.mergeKeys || ['委外供应商'];
  for (const key of mergeKeys) {
    const values = new Set(sources.map((row) => String(row[key] || '')).filter(Boolean));
    if (values.size > 1) throw new Error(tt('多来源合并要求') + '"' + key + '"' + tt('一致'))
  }
  const head = {};
  for (const map of config.headerMap || []) head[map.to] = selVal(sources[0], map.from);
  let targetKey = config.targetDetailKey || config.detailKey || 'items';
  let targetDefaults = {};
  const targetConfig = await engine.getPanelConfig(props.panelCode);
  const targetTab = targetConfig?.detail?.tabs?.find((tab) => tab.key === targetKey) || targetConfig?.detail?.tabs?.[0];
  targetKey = targetTab?.key || targetKey;
  targetDefaults = Object.fromEntries((targetTab?.fields || []).filter((f) => f.defaultValue !== undefined).map((f) => [f.dataName, f.defaultValue]));
  const ranges = [];
  const items = [];
  for (const source of sources) {
    const start = items.length;
    for (const item of sourceItems(source)) {
      const target = { ...targetDefaults };
      for (const map of config.detailMap || []) target[map.to] = item[map.from] ?? target[map.to] ?? '';
      items.push(target);
    }
    ranges.push({ source, start, count: items.length - start });
  }
  const result = await engine.callButton({ panelCode: props.panelCode, buttonName: '保存', formData: { ...head, detail: { [targetKey]: items } }, buttonParam: {} });
  try {
    for (const range of ranges) {
      const sourceNo = range.source['编号'] || range.source['单据编号'] || '';
      await engine.linkOutsourceSelection({ sourcePanel: config.source, sourceNo, sourceKey: config.detailKey || 'items',
        targetPanel: props.panelCode, targetNo: result['编号'], targetKey, targetOffset: range.start,
        businessType: config.targetBusinessType || head['业务类型'] || '' });
    }
  } catch (error) {
    try { await engine.deleteForms({ panelCode: props.panelCode, rowCodes: [result['编号']] }); } catch {}
    throw error
  }
  return { panel: props.panelCode, no: result['编号'], sourceNo: ranges.map((r) => r.source['编号'] || r.source['单据编号']).join('、') }
}

async function generate() {
  const config = props.config;
  const sources = selectedSourceRows();
  if (!sources.length) return
  const maxSources = Number(config.maxSourceDocuments || 0);
  if (maxSources > 0 && sources.length > maxSources) return ElMessage.warning(tt('每次最多选择') + ` ${maxSources} ` + tt('张来源单据'))
  generating.value = true;
  const generated = [];
  try {
    if (config.outsourceFlow && config.cardinality === 'MANY_TO_ONE' && sources.length > 1) {
      generated.push(await generateMergedSelection(config, sources));
    } else for (const source of sources) {
      const no = source['编号'] || source['单据编号'] || '';
      if (!no) continue
      // 分批送料(2026-09-20 P0):目标面板配了批次号 → 走分批生单接口(按量占用 + 待编号台账;
      // 批次号 = 采购入库单「单据日期」的 yyyyMMdd,同一日期同一批次,入库单填单时预设、可人工改
      // —— 2026-09-21 二次口径,故这一跳没有号可带),
      // 本次数量 = **所选明细行**的「剩余数量」(选单界面不做逐行填量;要按量分批用来源单据上的「生成XX」对话框)
      if (config.batchFlow) {
        const lines = sourceItems(source)
          .map((it) => ({ lineKey: it._lineKey || `${no}#${it.id}`, qty: Number(it['剩余数量'] ?? it['数量'] ?? 0) }))
          .filter((l) => l.qty > 0);
        if (!lines.length) { ElMessage.warning(tt('所选来源行已无剩余可送')); continue }
        const res = await engine.batchFlowGenerate({
          sourcePanel: config.source, targetPanel: props.panelCode, sourceNo: no, lines,
        });
        if (res?.['编号']) generated.push({ panel: res.gotoPanel || props.panelCode, no: res['编号'], sourceNo: no });
        continue
      }
      if (config.generateButton) {
        const result = await engine.callButton({ panelCode: config.source, buttonName: config.generateButton, formData: { 编号: no }, buttonParam: {} });
        if (result?.gotoPanel) generated.push({ panel: result.gotoPanel, no: result['编号'], sourceNo: no });
        continue
      }
      const head = {};
      for (const map of config.headerMap || []) head[map.to] = selVal(source, map.from);
      let targetKey = config.targetDetailKey || config.detailKey || 'items';
      let targetDefaults = {};
      try {
        const tc = await engine.getPanelConfig(props.panelCode);
        const targetTab = tc?.detail?.tabs?.find((tab) => tab.key === targetKey) || tc?.detail?.tabs?.[0];
        targetKey = targetTab?.key || targetKey;
        targetDefaults = Object.fromEntries((targetTab?.fields || []).filter((f) => f.defaultValue !== undefined).map((f) => [f.dataName, f.defaultValue]));
      } catch {}
      const items = sourceItems(source).map((item) => {
        const target = { ...targetDefaults };
        for (const map of config.detailMap || []) target[map.to] = item[map.from] ?? target[map.to] ?? '';
        return target
      });
      const result = await engine.callButton({ panelCode: props.panelCode, buttonName: '保存', formData: { ...head, detail: { [targetKey]: items } }, buttonParam: {} });
      if (result?.['编号'] && config.outsourceFlow) {
        try {
          await engine.linkOutsourceSelection({ sourcePanel: config.source, sourceNo: no, sourceKey: config.detailKey || 'items',
            targetPanel: props.panelCode, targetNo: result['编号'], targetKey, targetOffset: 0,
            businessType: config.targetBusinessType || head['业务类型'] || '' });
        } catch (error) {
          try { await engine.deleteForms({ panelCode: props.panelCode, rowCodes: [result['编号']] }); } catch {}
          throw error
        }
      }
      if (result?.['编号']) generated.push({ panel: props.panelCode, no: result['编号'], sourceNo: no });
    }
    if (!generated.length) return ElMessage.warning(tt('未生成任何单据'))
    ElMessage.success(tt('已生成') + ` ${generated.length} ` + tt('张单据'));
    emit('generated', generated);
    if (!continueSelect.value) close();
    else { rows.value = []; total.value = 0; selRows.value = []; selectedDetailRows.value = []; selectionByDocument.value = new Map(); load(1); }
  } catch (error) { ElMessage.error(engine.errMsg(error) || tt('生单失败')); }
  finally { generating.value = false; }
}

return (_ctx, _cache) => {
  const _component_el_button = ElButton;
  const _component_el_icon = ElIcon;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_input = ElInput;
  const _component_el_collapse_transition = ElCollapseTransition;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_checkbox = ElCheckbox;
  const _component_el_pagination = ElPagination;
  const _component_el_dialog = ElDialog;
  const _directive_loading = vLoading;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: __props.config?.title || unref(tt)('选单'),
    width: "1100px",
    top: "4vh",
    "append-to-body": "",
    "destroy-on-close": "",
    "onUpdate:modelValue": close,
    onOpen: openDialog
  }, {
    default: withCtx(() => [
      createBaseVNode("div", _hoisted_1$2, [
        (masterDetail.value)
          ? (openBlock(), createElementBlock("div", _hoisted_2$2, [
              createBaseVNode("div", _hoisted_3$2, [
                createVNode(_component_el_button, {
                  size: "small",
                  type: "primary",
                  icon: unref(search_default),
                  onClick: _cache[0] || (_cache[0] = $event => (load(1)))
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('查询')), 1)
                  ]),
                  _: 1
                }, 8, ["icon"]),
                createVNode(_component_el_button, {
                  size: "small",
                  icon: unref(setting_default),
                  onClick: _cache[1] || (_cache[1] = $event => (notImplemented(unref(tt)('筛选设置'))))
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('筛选设置')), 1)
                  ]),
                  _: 1
                }, 8, ["icon"]),
                createBaseVNode("span", {
                  class: "sv-search-slide",
                  onClick: _cache[2] || (_cache[2] = $event => (queryExpanded.value = !queryExpanded.value))
                }, [
                  createTextVNode(toDisplayString(queryExpanded.value ? unref(tt)('收起') : unref(tt)('展开')) + " ", 1),
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      (queryExpanded.value)
                        ? (openBlock(), createBlock(unref(arrow_up_default), { key: 0 }))
                        : (openBlock(), createBlock(unref(arrow_down_default), { key: 1 }))
                    ]),
                    _: 1
                  })
                ])
              ]),
              createVNode(_component_el_collapse_transition, null, {
                default: withCtx(() => [
                  withDirectives(createBaseVNode("div", _hoisted_4$2, [
                    createBaseVNode("div", _hoisted_5$2, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(queryFields.value, (field) => {
                        return (openBlock(), createElementBlock("div", {
                          key: field.dataName,
                          class: "sv-filter-item"
                        }, [
                          createBaseVNode("label", {
                            class: "sv-filter-label",
                            title: field.dataName
                          }, toDisplayString(unref(tt)(field.dataName)), 9, _hoisted_6$2),
                          (field.dataType === '日期')
                            ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                createVNode(_component_el_date_picker, {
                                  modelValue: query[field.dataName + '_start'],
                                  "onUpdate:modelValue": $event => ((query[field.dataName + '_start']) = $event),
                                  type: "date",
                                  size: "small",
                                  "value-format": "YYYY-MM-DD",
                                  placeholder: unref(tt)('开始日期'),
                                  clearable: "",
                                  style: {"width":"130px"},
                                  onChange: _cache[3] || (_cache[3] = $event => (load(1)))
                                }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]),
                                _cache[11] || (_cache[11] = createBaseVNode("span", { class: "sv-between" }, "-", -1)),
                                createVNode(_component_el_date_picker, {
                                  modelValue: query[field.dataName + '_end'],
                                  "onUpdate:modelValue": $event => ((query[field.dataName + '_end']) = $event),
                                  type: "date",
                                  size: "small",
                                  "value-format": "YYYY-MM-DD",
                                  placeholder: unref(tt)('结束日期'),
                                  clearable: "",
                                  style: {"width":"130px"},
                                  onChange: _cache[4] || (_cache[4] = $event => (load(1)))
                                }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]),
                                createVNode(_component_el_select, {
                                  modelValue: dateShortcuts[field.dataName],
                                  "onUpdate:modelValue": $event => ((dateShortcuts[field.dataName]) = $event),
                                  size: "small",
                                  placeholder: unref(tt)('自定义'),
                                  style: {"width":"88px"},
                                  onChange: $event => (applyDateShortcut(field))
                                }, {
                                  default: withCtx(() => [
                                    createVNode(_component_el_option, {
                                      label: unref(tt)('自定义'),
                                      value: ""
                                    }, null, 8, ["label"]),
                                    (openBlock(), createElementBlock(Fragment, null, renderList(shortcutOptions, (s) => {
                                      return createVNode(_component_el_option, {
                                        key: s.value,
                                        label: unref(tt)(s.label),
                                        value: s.value
                                      }, null, 8, ["label", "value"])
                                    }), 64))
                                  ]),
                                  _: 1
                                }, 8, ["modelValue", "onUpdate:modelValue", "placeholder", "onChange"])
                              ], 64))
                            : (field.dataType === '参照')
                              ? (openBlock(), createBlock(_component_el_select, {
                                  key: 1,
                                  modelValue: query[field.dataName],
                                  "onUpdate:modelValue": $event => ((query[field.dataName]) = $event),
                                  size: "small",
                                  clearable: "",
                                  filterable: "",
                                  remote: "",
                                  "remote-method": (val) => remoteSearch(field, val),
                                  loading: refLoading.value,
                                  style: {"flex":"1"},
                                  onFocus: () => remoteSearch(field, ''),
                                  onChange: _cache[5] || (_cache[5] = $event => (load(1)))
                                }, {
                                  default: withCtx(() => [
                                    (openBlock(true), createElementBlock(Fragment, null, renderList(refOptions[field.refPanel + '.' + field.refField] || [], (opt) => {
                                      return (openBlock(), createBlock(_component_el_option, {
                                        key: opt.value,
                                        label: opt.label,
                                        value: opt.value
                                      }, null, 8, ["label", "value"]))
                                    }), 128))
                                  ]),
                                  _: 2
                                }, 1032, ["modelValue", "onUpdate:modelValue", "remote-method", "loading", "onFocus"]))
                              : (field.dataType === '下拉框')
                                ? (openBlock(), createBlock(_component_el_select, {
                                    key: 2,
                                    modelValue: query[field.dataName],
                                    "onUpdate:modelValue": $event => ((query[field.dataName]) = $event),
                                    size: "small",
                                    clearable: "",
                                    filterable: "",
                                    style: {"flex":"1"},
                                    onChange: _cache[6] || (_cache[6] = $event => (load(1)))
                                  }, {
                                    default: withCtx(() => [
                                      (openBlock(true), createElementBlock(Fragment, null, renderList(field.options || [], (opt) => {
                                        return (openBlock(), createBlock(_component_el_option, {
                                          key: opt,
                                          label: unref(tt)(opt),
                                          value: opt
                                        }, null, 8, ["label", "value"]))
                                      }), 128))
                                    ]),
                                    _: 2
                                  }, 1032, ["modelValue", "onUpdate:modelValue"]))
                                : (openBlock(), createBlock(_component_el_input, {
                                    key: 3,
                                    modelValue: query[field.dataName],
                                    "onUpdate:modelValue": $event => ((query[field.dataName]) = $event),
                                    size: "small",
                                    clearable: "",
                                    style: {"flex":"1"},
                                    onKeyup: _cache[7] || (_cache[7] = withKeys($event => (load(1)), ["enter"])),
                                    onClear: _cache[8] || (_cache[8] = $event => (load(1)))
                                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        ]))
                      }), 128))
                    ])
                  ], 512), [
                    [vShow, queryExpanded.value]
                  ])
                ]),
                _: 1
              })
            ]))
          : createCommentVNode("", true),
        (masterDetail.value)
          ? (openBlock(), createElementBlock("div", {
              key: 1,
              class: "sv-head-grid",
              style: normalizeStyle({ height: headGridHeight.value + 'px' })
            }, [
              createBaseVNode("div", _hoisted_7$1, [
                createBaseVNode("div", _hoisted_8$1, [
                  createBaseVNode("span", _hoisted_9$1, [
                    createBaseVNode("span", _hoisted_10$1, toDisplayString(__props.config?.headerTitle || unref(tt)('表头')), 1)
                  ])
                ]),
                createBaseVNode("div", _hoisted_11$1, [
                  createTextVNode(toDisplayString(unref(tt)('共')) + " ", 1),
                  createBaseVNode("span", null, toDisplayString(total.value), 1),
                  createTextVNode(" " + toDisplayString(unref(tt)('条记录')), 1)
                ]),
                createBaseVNode("span", {
                  class: "sv-grid-toggle",
                  title: unref(tt)('向下展开'),
                  onClick: toggleHeadGrid
                }, [
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      createVNode(unref(arrow_down_default))
                    ]),
                    _: 1
                  })
                ], 8, _hoisted_12$1)
              ]),
              withDirectives((openBlock(), createBlock(_component_el_table, {
                ref_key: "headerTable",
                ref: headerTable,
                data: rows.value,
                size: "small",
                border: "",
                height: "100%",
                "highlight-current-row": "",
                onSelectionChange: onSel,
                onRowClick: onCurrent
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    type: "selection",
                    width: "42"
                  }),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('序号'),
                    width: "48",
                    align: "center"
                  }, {
                    default: withCtx(({ $index }) => [
                      createTextVNode(toDisplayString((pageNo.value - 1) * pageSize.value + $index + 1), 1)
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  (openBlock(true), createElementBlock(Fragment, null, renderList(columns.value, (col) => {
                    return (openBlock(), createBlock(_component_el_table_column, {
                      key: col,
                      label: unref(tt)(col),
                      width: columnWidth(col),
                      "min-width": columnMinWidth(col),
                      "show-overflow-tooltip": ""
                    }, {
                      default: withCtx(({ row }) => [
                        createTextVNode(toDisplayString(cellText(col, row)), 1)
                      ]),
                      _: 2
                    }, 1032, ["label", "width", "min-width"]))
                  }), 128)),
                  (__props.config?.purchaseFlow)
                    ? (openBlock(), createBlock(_component_el_table_column, {
                        key: 0,
                        label: unref(tt)('可生单数量'),
                        width: "100",
                        align: "right"
                      }, {
                        default: withCtx(({ row }) => [
                          createTextVNode(toDisplayString(sourceItems(row).reduce((s, i) => s + Number(i['剩余数量'] || 0), 0)), 1)
                        ]),
                        _: 1
                      }, 8, ["label"]))
                    : createCommentVNode("", true)
                ]),
                _: 1
              }, 8, ["data"])), [
                [_directive_loading, loading.value]
              ])
            ], 4))
          : createCommentVNode("", true),
        (masterDetail.value)
          ? (openBlock(), createElementBlock("div", {
              key: 2,
              class: "sv-dragbar",
              title: unref(tt)('上下拖拽'),
              onMousedown: startDrag
            }, [...(_cache[12] || (_cache[12] = [
              createBaseVNode("span", null, null, -1),
              createBaseVNode("span", null, null, -1),
              createBaseVNode("span", null, null, -1)
            ]))], 40, _hoisted_13))
          : createCommentVNode("", true),
        (masterDetail.value)
          ? (openBlock(), createElementBlock("div", _hoisted_14, [
              createBaseVNode("div", _hoisted_15, [
                createBaseVNode("div", _hoisted_16, [
                  createBaseVNode("span", _hoisted_17, [
                    createBaseVNode("span", _hoisted_18, toDisplayString(__props.config?.detailTitle || unref(tt)('表体')), 1)
                  ])
                ]),
                createBaseVNode("div", _hoisted_19, [
                  createTextVNode(toDisplayString(unref(tt)('共')) + " ", 1),
                  createBaseVNode("span", null, toDisplayString(currentItems.value.length), 1),
                  createTextVNode(" " + toDisplayString(unref(tt)('条记录')), 1)
                ]),
                createBaseVNode("span", _hoisted_20, toDisplayString(currentNo.value || unref(tt)('请选择一条表头记录')), 1)
              ]),
              createVNode(_component_el_table, {
                ref_key: "detailTable",
                ref: detailTable,
                data: currentItems.value,
                size: "small",
                border: "",
                height: "100%",
                "row-key": "_lineKey",
                "empty-text": unref(tt)('请选择表头记录查看对应表体'),
                onSelectionChange: onDetailSel
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    type: "selection",
                    width: "42"
                  }),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('序号'),
                    width: "48",
                    align: "center"
                  }, {
                    default: withCtx(({ $index }) => [
                      createTextVNode(toDisplayString($index + 1), 1)
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  (openBlock(true), createElementBlock(Fragment, null, renderList(detailColumns.value, (col) => {
                    return (openBlock(), createBlock(_component_el_table_column, {
                      key: col,
                      prop: col,
                      label: unref(tt)(col),
                      "min-width": "110",
                      "show-overflow-tooltip": ""
                    }, null, 8, ["prop", "label"]))
                  }), 128))
                ]),
                _: 1
              }, 8, ["data", "empty-text"])
            ]))
          : createCommentVNode("", true),
        (!masterDetail.value)
          ? (openBlock(), createElementBlock("div", _hoisted_21, [
              withDirectives((openBlock(), createBlock(_component_el_table, {
                ref_key: "headerTable",
                ref: headerTable,
                data: rows.value,
                size: "small",
                border: "",
                height: "360",
                "highlight-current-row": "",
                onSelectionChange: onSel,
                onRowClick: onCurrent
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    type: "selection",
                    width: "42"
                  }),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('序号'),
                    width: "48",
                    align: "center"
                  }, {
                    default: withCtx(({ $index }) => [
                      createTextVNode(toDisplayString((pageNo.value - 1) * pageSize.value + $index + 1), 1)
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  (openBlock(true), createElementBlock(Fragment, null, renderList(columns.value, (col) => {
                    return (openBlock(), createBlock(_component_el_table_column, {
                      key: col,
                      label: unref(tt)(col),
                      width: columnWidth(col),
                      "min-width": columnMinWidth(col),
                      "show-overflow-tooltip": ""
                    }, {
                      default: withCtx(({ row }) => [
                        createTextVNode(toDisplayString(cellText(col, row)), 1)
                      ]),
                      _: 2
                    }, 1032, ["label", "width", "min-width"]))
                  }), 128)),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('明细行'),
                    "min-width": "200"
                  }, {
                    default: withCtx(({ row }) => [
                      createBaseVNode("span", _hoisted_22, toDisplayString(itemsText(row)), 1)
                    ]),
                    _: 1
                  }, 8, ["label"])
                ]),
                _: 1
              }, 8, ["data"])), [
                [_directive_loading, loading.value]
              ])
            ]))
          : createCommentVNode("", true),
        createBaseVNode("div", _hoisted_23, [
          createBaseVNode("div", _hoisted_24, [
            createVNode(_component_el_button, {
              link: "",
              size: "small",
              onClick: _cache[9] || (_cache[9] = $event => (notImplemented(unref(tt)('栏目设置'))))
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(tt)('栏目设置')), 1)
              ]),
              _: 1
            }),
            createVNode(_component_el_checkbox, {
              modelValue: continueSelect.value,
              "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((continueSelect).value = $event)),
              size: "small",
              style: {"margin-left":"16px"}
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(tt)('连续选择')), 1)
              ]),
              _: 1
            }, 8, ["modelValue"]),
            (selectedCount.value)
              ? (openBlock(), createElementBlock("span", _hoisted_25, toDisplayString(unref(tt)('已选')) + " " + toDisplayString(selectedCount.value) + " " + toDisplayString(unref(tt)('行')), 1))
              : createCommentVNode("", true)
          ]),
          createBaseVNode("div", _hoisted_26, [
            createVNode(_component_el_pagination, {
              small: "",
              layout: "total, prev, pager, next",
              total: total.value,
              "page-size": pageSize.value,
              "current-page": pageNo.value,
              onCurrentChange: load
            }, null, 8, ["total", "page-size", "current-page"])
          ]),
          createBaseVNode("div", _hoisted_27, [
            createVNode(_component_el_button, { onClick: close }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(tt)('取消')), 1)
              ]),
              _: 1
            }),
            createVNode(_component_el_button, {
              type: "primary",
              disabled: !selectedCount.value,
              loading: generating.value,
              onClick: generate
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(generateLabel.value), 1)
              ]),
              _: 1
            }, 8, ["disabled", "loading"])
          ])
        ])
      ])
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const SelectVoucherDialog = /*#__PURE__*/_export_sfc(_sfc_main$2, [['__scopeId',"data-v-26be6057"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$1 = { class: "imp-tip" };
const _hoisted_2$1 = { class: "imp-actions" };
const _hoisted_3$1 = {
  key: 0,
  class: "imp-file"
};
const _hoisted_4$1 = {
  key: 1,
  class: "imp-err"
};
const _hoisted_5$1 = {
  key: 0,
  class: "imp-preview"
};
const _hoisted_6$1 = { class: "imp-match" };
// xlsx 动态引入(~430KB 只在真正导入时加载;与 PanelxList 同款)


const _sfc_main$1 = {
  __name: 'ImportDialog',
  props: {
  modelValue: Boolean,
  fields: { type: Array, default: () => [] }, // 明细字段定义 [{dataName,dataType}]
  targetLabel: { type: String, default: '明细' },
},
  emits: ['update:modelValue', 'update:visible', 'imported'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

const fileRef = ref(null);
const fileName = ref('');
const error = ref('');
const matchedCols = ref([]);
const totalCols = ref(0);
const rows = ref([]);
const previewRows = ref([]);

watch(() => props.modelValue, (v) => {
  if (v) {
    fileName.value = '';
    error.value = '';
    matchedCols.value = [];
    rows.value = [];
    previewRows.value = [];
  }
});

function close() {
  emit('update:modelValue', false); emit('update:visible', false);
}

function pick() {
  fileRef.value && fileRef.value.click();
}

function onFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return
  fileName.value = file.name;
  error.value = '';
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const XLSX = await __vitePreload(() => import('./xlsx-yBJAythd.js'),true              ?[]:void 0);
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('Excel 无工作表')
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!aoa.length) throw new Error('Excel 为空')
      // 第一行为表头：匹配明细字段 dataName
      const header = (aoa[0] || []).map((h) => String(h).trim());
      const fieldNames = (props.fields || []).map((f) => f.dataName);
      const matched = [];
      for (let ci = 0; ci < header.length; ci++) {
        if (header[ci] && fieldNames.includes(header[ci])) matched.push(ci);
      }
      totalCols.value = header.length;
      matchedCols.value = matched.map((i) => header[i]);
      const ftype = {};
      for (const f of props.fields || []) ftype[f.dataName] = f.dataType;
      const out = [];
      for (let ri = 1; ri < aoa.length; ri++) {
        const r = aoa[ri];
        if (!r || r.every((v) => v === '' || v === null || v === undefined)) continue
        const obj = {};
        matched.forEach((ci) => {
          const name = header[ci];
          let v = r[ci];
          const dt = ftype[name];
          if (dt === '小数' || dt === '整数') { const n = Number(v); obj[name] = Number.isFinite(n) ? n : 0; }
          else if (dt === '是否') obj[name] = v === true || String(v).toLowerCase() === 'true' || String(v) === '1' || String(v) === '是';
          else obj[name] = v === undefined || v === null ? '' : String(v).trim();
        });
        out.push(obj);
      }
      if (!out.length) throw new Error('没有可导入的数据行')
      if (!matched.length) throw new Error('未识别任何列：Excel 表头需与明细/档案字段名一致（如 员工编码、员工名称）')
      rows.value = out;
      previewRows.value = out.slice(0, 20);
      ElMessage.success('已解析 ' + out.length + ' 行，识别 ' + matchedCols.value.length + ' 列');
    } catch (err) {
      error.value = err.message || '文件解析失败';
      rows.value = [];
      previewRows.value = [];
    }
  };
  reader.readAsArrayBuffer(file);
}

function doImport() {
  emit('imported', rows.value);
  close();
}

return (_ctx, _cache) => {
  const _component_el_button = ElButton;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: "Excel 导入",
    width: "760px",
    "append-to-body": "",
    "onUpdate:modelValue": close
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, { onClick: close }, {
        default: withCtx(() => [...(_cache[3] || (_cache[3] = [
          createTextVNode("取消", -1)
        ]))]),
        _: 1
      }),
      createVNode(_component_el_button, {
        type: "primary",
        disabled: !rows.value.length || !matchedCols.value.length,
        onClick: doImport
      }, {
        default: withCtx(() => [
          createTextVNode("导入 " + toDisplayString(rows.value.length) + " 行", 1)
        ]),
        _: 1
      }, 8, ["disabled"])
    ]),
    default: withCtx(() => [
      createBaseVNode("div", _hoisted_1$1, " 选择 Excel 文件（.xlsx / .xls），自动识别「" + toDisplayString(__props.targetLabel) + "」字段并填入明细； Excel 第一行为字段名，需与明细字段名一致（如 产品名称、实收数量、材料编码）。 ", 1),
      createBaseVNode("div", _hoisted_2$1, [
        createBaseVNode("input", {
          ref_key: "fileRef",
          ref: fileRef,
          type: "file",
          accept: ".xlsx,.xls",
          style: {"display":"none"},
          onChange: onFile
        }, null, 544),
        createVNode(_component_el_button, {
          type: "primary",
          icon: unref(upload_default),
          onClick: pick
        }, {
          default: withCtx(() => [...(_cache[0] || (_cache[0] = [
            createTextVNode("选择 Excel 文件", -1)
          ]))]),
          _: 1
        }, 8, ["icon"]),
        (fileName.value)
          ? (openBlock(), createElementBlock("span", _hoisted_3$1, toDisplayString(fileName.value), 1))
          : createCommentVNode("", true),
        (error.value)
          ? (openBlock(), createElementBlock("span", _hoisted_4$1, toDisplayString(error.value), 1))
          : createCommentVNode("", true)
      ]),
      (rows.value.length)
        ? (openBlock(), createElementBlock("div", _hoisted_5$1, [
            createBaseVNode("div", _hoisted_6$1, [
              _cache[1] || (_cache[1] = createTextVNode(" 已识别 ", -1)),
              createBaseVNode("b", null, toDisplayString(matchedCols.value.length), 1),
              createTextVNode("/" + toDisplayString(totalCols.value) + " 列 → 明细字段，共 " + toDisplayString(rows.value.length) + " 行数据 ", 1),
              _cache[2] || (_cache[2] = createBaseVNode("span", { class: "imp-sub" }, "（未匹配列忽略；确认后追加到明细，请点击保存落库）", -1))
            ]),
            createVNode(_component_el_table, {
              data: previewRows.value,
              size: "small",
              border: "",
              "max-height": "300"
            }, {
              default: withCtx(() => [
                (openBlock(true), createElementBlock(Fragment, null, renderList(matchedCols.value, (c) => {
                  return (openBlock(), createBlock(_component_el_table_column, {
                    key: c,
                    label: c,
                    prop: c,
                    "min-width": "100",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label", "prop"]))
                }), 128))
              ]),
              _: 1
            }, 8, ["data"])
          ]))
        : createCommentVNode("", true)
    ]),
    _: 1
  }, 8, ["model-value"]))
}
}

};
const ImportDialog = /*#__PURE__*/_export_sfc(_sfc_main$1, [['__scopeId',"data-v-8a6b508c"]]);

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "scan-source-bar" };
const _hoisted_2 = ["title"];
const _hoisted_3 = {
  key: 0,
  class: "scan-preview-row"
};
const _hoisted_4 = { class: "scan-image-wrap" };
const _hoisted_5 = ["src"];
const _hoisted_6 = {
  key: 1,
  class: "scan-image-placeholder"
};
const _hoisted_7 = { class: "scan-file-meta" };
const _hoisted_8 = { key: 0 };
const _hoisted_9 = {
  key: 1,
  class: "scan-section"
};
const _hoisted_10 = { class: "scan-header-grid" };
const _hoisted_11 = { class: "scan-section-heading" };
const _hoisted_12 = { class: "scan-section-title" };


const _sfc_main = {
  __name: 'ScanFillDialog',
  props: {
  modelValue: { type: Boolean, default: false },
  panelCode: { type: String, required: true },
  panelName: { type: String, default: '' },
  headerFields: { type: Array, default: () => [] },
  detailTabs: { type: Array, default: () => [] },
},
  emits: ['update:modelValue', 'apply'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;
const engine = usePanelRuntime();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});
const cameraInput = ref(null);
const uploadInput = ref(null);
const file = ref(null);
const previewUrl = ref('');
const recognizing = ref(false);
const result = ref(null);
const errorMessage = ref('');
const header = reactive({});
const detail = reactive({});
const detailMode = ref('replace');
let requestVersion = 0;

const warnings = computed(() => {
  const value = result.value?.warnings || result.value?.unmatched || [];
  return (Array.isArray(value) ? value : [value])
    .map((item) => typeof item === 'string' ? item : (item?.message || item?.text || ''))
    .filter(Boolean)
});
const headerEntries = computed(() => Object.keys(header).map((key) => ({ key, value: header[key] })));
const detailSections = computed(() => Object.entries(detail)
  .filter(([, rows]) => Array.isArray(rows) && rows.length)
  .map(([key, rows]) => ({
    key,
    label: props.detailTabs.find((tab) => tab.key === key)?.label || key,
    rows,
    columns: [...new Set(rows.flatMap((row) => Object.keys(row || {})))],
  })));
const hasMatchedData = computed(() => headerEntries.value.length > 0 || detailSections.value.length > 0);

function normalizeType(type) {
  if (['小数', '整数', 'Decimal', 'Long', 'Integer', 'Double'].includes(type)) return 'number'
  if (['日期', '日期时间', '时间', 'DATE', 'DateTime', 'Date'].includes(type)) return 'date'
  if (['是否', 'Boolean', 'BOOL'].includes(type)) return 'boolean'
  return 'text'
}

function fieldType(name) {
  const field = props.headerFields.find((item) => (item.dataName || item.code || item.name) === name);
  return normalizeType(field?.dataType)
}

function detailFieldType(tabKey, name) {
  const tab = props.detailTabs.find((item) => item.key === tabKey);
  const field = (tab?.fields || []).find((item) => (item.dataName || item.code || item.name) === name);
  return normalizeType(field?.dataType)
}

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
}

function clearResult() {
  result.value = null;
  errorMessage.value = '';
  Object.keys(header).forEach((key) => delete header[key]);
  Object.keys(detail).forEach((key) => delete detail[key]);
}

function onFileSelected(event) {
  const selected = event.target.files?.[0];
  event.target.value = '';
  if (!selected) return
  if (selected.size > 10 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 10MB');
    return
  }
  if (!selected.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件');
    return
  }
  clearPreview();
  clearResult();
  file.value = selected;
  previewUrl.value = URL.createObjectURL(selected);
}

async function recognize() {
  if (!file.value || recognizing.value) return
  const version = ++requestVersion;
  recognizing.value = true;
  errorMessage.value = '';
  try {
    const response = await engine.recognizeFormImage({ panelCode: props.panelCode, image: file.value });
    if (version !== requestVersion) return
    result.value = response || {};
    const recognizedHeader = response?.header || response?.formData || {};
    const recognizedDetail = response?.detail || recognizedHeader.detail || {};
    Object.keys(header).forEach((key) => delete header[key]);
    Object.keys(detail).forEach((key) => delete detail[key]);
    for (const [key, value] of Object.entries(recognizedHeader)) {
      if (key !== 'detail') header[key] = value;
    }
    for (const [key, rows] of Object.entries(recognizedDetail || {})) {
      if (Array.isArray(rows) && rows.length) detail[key] = rows.map((row) => ({ ...row }));
    }
  } catch (error) {
    if (version !== requestVersion) return
    result.value = null;
    errorMessage.value = engine.errMsg(error) || 'OCR 识别失败';
  } finally {
    if (version === requestVersion) recognizing.value = false;
  }
}

function applyResult() {
  if (!hasMatchedData.value) return
  emit('apply', {
    header: { ...header },
    detail: Object.fromEntries(Object.entries(detail).map(([key, rows]) => [key, rows.map((row) => ({ ...row }))])),
    requestId: result.value?.requestId || '',
    warnings: [...warnings.value],
    detailMode: detailMode.value,
  });
  visible.value = false;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function reset() {
  requestVersion++;
  recognizing.value = false;
  clearPreview();
  clearResult();
  file.value = null;
  detailMode.value = 'replace';
}

watch(() => props.modelValue, (open) => {
  if (!open && !recognizing.value) reset();
});

onBeforeUnmount(reset);

return (_ctx, _cache) => {
  const _component_el_button = ElButton;
  const _component_el_alert = ElAlert;
  const _component_el_switch = ElSwitch;
  const _component_el_input_number = ElInputNumber;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_input = ElInput;
  const _component_el_radio_button = ElRadioButton;
  const _component_el_radio_group = ElRadioGroup;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_empty = ElEmpty;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createBlock(_component_el_dialog, {
    modelValue: visible.value,
    "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((visible).value = $event)),
    title: "扫描填单",
    width: "min(920px, 94vw)",
    "append-to-body": "",
    "destroy-on-close": "",
    class: "scan-fill-dialog",
    "close-on-click-modal": !recognizing.value,
    "close-on-press-escape": !recognizing.value,
    "show-close": !recognizing.value,
    onClosed: reset
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, {
        disabled: recognizing.value,
        onClick: _cache[3] || (_cache[3] = $event => (visible.value = false))
      }, {
        default: withCtx(() => [...(_cache[10] || (_cache[10] = [
          createTextVNode("取消", -1)
        ]))]),
        _: 1
      }, 8, ["disabled"]),
      (file.value)
        ? (openBlock(), createBlock(_component_el_button, {
            key: 0,
            type: "primary",
            icon: unref(document_checked_default),
            loading: recognizing.value,
            onClick: recognize
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(result.value ? '重新识别' : '开始识别'), 1)
            ]),
            _: 1
          }, 8, ["icon", "loading"]))
        : createCommentVNode("", true),
      (result.value)
        ? (openBlock(), createBlock(_component_el_button, {
            key: 1,
            type: "success",
            disabled: !hasMatchedData.value,
            onClick: applyResult
          }, {
            default: withCtx(() => [...(_cache[11] || (_cache[11] = [
              createTextVNode("应用到单据", -1)
            ]))]),
            _: 1
          }, 8, ["disabled"]))
        : createCommentVNode("", true)
    ]),
    default: withCtx(() => [
      createBaseVNode("input", {
        ref_key: "cameraInput",
        ref: cameraInput,
        class: "scan-file-input",
        type: "file",
        accept: "image/*",
        capture: "environment",
        onChange: onFileSelected
      }, null, 544),
      createBaseVNode("input", {
        ref_key: "uploadInput",
        ref: uploadInput,
        class: "scan-file-input",
        type: "file",
        accept: "image/jpeg,image/png,image/bmp,.jpg,.jpeg,.png,.bmp",
        onChange: onFileSelected
      }, null, 544),
      createBaseVNode("div", _hoisted_1, [
        createVNode(_component_el_button, {
          type: "primary",
          icon: unref(camera_default),
          disabled: recognizing.value,
          onClick: _cache[0] || (_cache[0] = $event => (cameraInput.value?.click()))
        }, {
          default: withCtx(() => [...(_cache[5] || (_cache[5] = [
            createTextVNode("拍照", -1)
          ]))]),
          _: 1
        }, 8, ["icon", "disabled"]),
        createVNode(_component_el_button, {
          icon: unref(upload_default),
          disabled: recognizing.value,
          onClick: _cache[1] || (_cache[1] = $event => (uploadInput.value?.click()))
        }, {
          default: withCtx(() => [...(_cache[6] || (_cache[6] = [
            createTextVNode("上传图片", -1)
          ]))]),
          _: 1
        }, 8, ["icon", "disabled"]),
        (file.value)
          ? (openBlock(), createElementBlock("span", {
              key: 0,
              class: "scan-file-name",
              title: file.value.name
            }, toDisplayString(file.value.name), 9, _hoisted_2))
          : createCommentVNode("", true)
      ]),
      (file.value)
        ? (openBlock(), createElementBlock("div", _hoisted_3, [
            createBaseVNode("div", _hoisted_4, [
              (previewUrl.value)
                ? (openBlock(), createElementBlock("img", {
                    key: 0,
                    src: previewUrl.value,
                    alt: "待识别单据"
                  }, null, 8, _hoisted_5))
                : (openBlock(), createElementBlock("div", _hoisted_6, toDisplayString(file.value.name), 1))
            ]),
            createBaseVNode("div", _hoisted_7, [
              createBaseVNode("strong", null, toDisplayString(__props.panelName || __props.panelCode), 1),
              createBaseVNode("span", null, toDisplayString(formatBytes(file.value.size)), 1),
              (result.value?.requestId)
                ? (openBlock(), createElementBlock("span", _hoisted_8, "请求编号：" + toDisplayString(result.value.requestId), 1))
                : createCommentVNode("", true)
            ])
          ]))
        : createCommentVNode("", true),
      (errorMessage.value)
        ? (openBlock(), createBlock(_component_el_alert, {
            key: 1,
            class: "scan-alert",
            type: "error",
            title: errorMessage.value,
            closable: false,
            "show-icon": ""
          }, null, 8, ["title"]))
        : createCommentVNode("", true),
      (result.value)
        ? (openBlock(), createElementBlock(Fragment, { key: 2 }, [
            (warnings.value.length)
              ? (openBlock(), createBlock(_component_el_alert, {
                  key: 0,
                  class: "scan-alert",
                  type: "warning",
                  title: warnings.value.join('；'),
                  closable: false,
                  "show-icon": ""
                }, null, 8, ["title"]))
              : createCommentVNode("", true),
            (headerEntries.value.length)
              ? (openBlock(), createElementBlock("section", _hoisted_9, [
                  _cache[7] || (_cache[7] = createBaseVNode("div", { class: "scan-section-title" }, "表头字段", -1)),
                  createBaseVNode("div", _hoisted_10, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(headerEntries.value, (entry) => {
                      return (openBlock(), createElementBlock("label", {
                        key: entry.key,
                        class: "scan-header-field"
                      }, [
                        createBaseVNode("span", null, toDisplayString(entry.key), 1),
                        (fieldType(entry.key) === 'boolean')
                          ? (openBlock(), createBlock(_component_el_switch, {
                              key: 0,
                              modelValue: header[entry.key],
                              "onUpdate:modelValue": $event => ((header[entry.key]) = $event)
                            }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                          : (fieldType(entry.key) === 'number')
                            ? (openBlock(), createBlock(_component_el_input_number, {
                                key: 1,
                                modelValue: header[entry.key],
                                "onUpdate:modelValue": $event => ((header[entry.key]) = $event),
                                controls: false
                              }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                            : (fieldType(entry.key) === 'date')
                              ? (openBlock(), createBlock(_component_el_date_picker, {
                                  key: 2,
                                  modelValue: header[entry.key],
                                  "onUpdate:modelValue": $event => ((header[entry.key]) = $event),
                                  type: "date",
                                  "value-format": "YYYY-MM-DD"
                                }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                              : (openBlock(), createBlock(_component_el_input, {
                                  key: 3,
                                  modelValue: header[entry.key],
                                  "onUpdate:modelValue": $event => ((header[entry.key]) = $event)
                                }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                      ]))
                    }), 128))
                  ])
                ]))
              : createCommentVNode("", true),
            (openBlock(true), createElementBlock(Fragment, null, renderList(detailSections.value, (tab) => {
              return (openBlock(), createElementBlock("section", {
                key: tab.key,
                class: "scan-section"
              }, [
                createBaseVNode("div", _hoisted_11, [
                  createBaseVNode("div", _hoisted_12, toDisplayString(tab.label), 1),
                  createVNode(_component_el_radio_group, {
                    modelValue: detailMode.value,
                    "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((detailMode).value = $event)),
                    size: "small"
                  }, {
                    default: withCtx(() => [
                      createVNode(_component_el_radio_button, { value: "replace" }, {
                        default: withCtx(() => [...(_cache[8] || (_cache[8] = [
                          createTextVNode("替换明细", -1)
                        ]))]),
                        _: 1
                      }),
                      createVNode(_component_el_radio_button, { value: "append" }, {
                        default: withCtx(() => [...(_cache[9] || (_cache[9] = [
                          createTextVNode("追加明细", -1)
                        ]))]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, ["modelValue"])
                ]),
                createVNode(_component_el_table, {
                  data: tab.rows,
                  border: "",
                  size: "small",
                  "max-height": "300"
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_table_column, {
                      type: "index",
                      label: "序号",
                      width: "58",
                      fixed: "left"
                    }),
                    (openBlock(true), createElementBlock(Fragment, null, renderList(tab.columns, (column) => {
                      return (openBlock(), createBlock(_component_el_table_column, {
                        key: column,
                        label: column,
                        "min-width": "130"
                      }, {
                        default: withCtx(({ row }) => [
                          (detailFieldType(tab.key, column) === 'boolean')
                            ? (openBlock(), createBlock(_component_el_switch, {
                                key: 0,
                                modelValue: row[column],
                                "onUpdate:modelValue": $event => ((row[column]) = $event)
                              }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                            : (detailFieldType(tab.key, column) === 'number')
                              ? (openBlock(), createBlock(_component_el_input_number, {
                                  key: 1,
                                  modelValue: row[column],
                                  "onUpdate:modelValue": $event => ((row[column]) = $event),
                                  controls: false
                                }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                              : (detailFieldType(tab.key, column) === 'date')
                                ? (openBlock(), createBlock(_component_el_date_picker, {
                                    key: 2,
                                    modelValue: row[column],
                                    "onUpdate:modelValue": $event => ((row[column]) = $event),
                                    type: "date",
                                    "value-format": "YYYY-MM-DD"
                                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                : (openBlock(), createBlock(_component_el_input, {
                                    key: 3,
                                    modelValue: row[column],
                                    "onUpdate:modelValue": $event => ((row[column]) = $event)
                                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        ]),
                        _: 2
                      }, 1032, ["label"]))
                    }), 128)),
                    createVNode(_component_el_table_column, {
                      label: "操作",
                      width: "54",
                      fixed: "right",
                      align: "center"
                    }, {
                      default: withCtx(({ $index }) => [
                        createVNode(_component_el_button, {
                          link: "",
                          type: "danger",
                          icon: unref(delete_default),
                          title: "删除本行",
                          onClick: $event => (tab.rows.splice($index, 1))
                        }, null, 8, ["icon", "onClick"])
                      ]),
                      _: 2
                    }, 1024)
                  ]),
                  _: 2
                }, 1032, ["data"])
              ]))
            }), 128)),
            (!headerEntries.value.length && !detailSections.value.length)
              ? (openBlock(), createBlock(_component_el_empty, {
                  key: 2,
                  description: "未匹配到当前单据字段",
                  "image-size": 64
                }))
              : createCommentVNode("", true)
          ], 64))
        : createCommentVNode("", true)
    ]),
    _: 1
  }, 8, ["modelValue", "close-on-click-modal", "close-on-press-escape", "show-close"]))
}
}

};
const ScanFillDialog = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-b92d42d9"]]);

export { ApprovalHistoryDialog as A, ImportDialog as I, SelectVoucherDialog as S, ScanFillDialog as a, applyRefCarry as b, refConfigOf as c, ensureScanFillAction as e, refShowsCode as r };
