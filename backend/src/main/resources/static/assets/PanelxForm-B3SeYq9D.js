import { v as vLoading, k as ElMessage, c as ElTag, i as ElInput, f as ElDialog, A as ElIcon, J as ElDropdownMenu, K as ElDropdownItem, o as ElOption, g as ElTableColumn, d as ElButton, j as ElTable, n as ElSelect, h as ElInputNumber, t as ElSwitch, y as ElImage, z as ElDatePicker, b as ElEmpty, l as ElMessageBox, L as ElDropdown } from './element-plus-W84rT0en.js';
import { u as usePanelRuntime, c as useUserStore, h as useLocaleStore, t as tt, d as applyCalcRules } from './index-CqmwEeWF.js';
/* empty css                  */
import { A as ApprovalHistoryDialog, S as SelectVoucherDialog, I as ImportDialog, a as ScanFillDialog, e as ensureScanFillAction, r as refShowsCode, c as refConfigOf, b as applyRefCarry } from './ScanFillDialog-AluwVbET.js';
/* empty css                   */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                */
/* empty css                   */
/* empty css                        */
/* empty css                   */
/* empty css                         */
/* empty css                          */
import './el-dropdown-menu-l0sNRNKZ.js';
import { j as watch, q as onMounted, O as onDeactivated, c as createElementBlock, a as createBaseVNode, J as Fragment, ae as renderList, $ as toDisplayString, A as unref, Z as createCommentVNode, aG as createStaticVNode, P as createBlock, W as withCtx, S as normalizeClass, X as withDirectives, a0 as createVNode, p as ref, f as computed, z as reactive, aD as useRoute, aE as useRouter, o as openBlock, _ as createTextVNode, ac as withModifiers } from './vue-vendor-DyX2BAKf.js';
import { u as useTabsStore } from './tabs-DN15ZjeN.js';
import { k as arrow_down_default, M as search_default, B as plus_default, P as delete_default } from './element-icons-DOEvq9OG.js';
import { s as sumKeepScale } from './sumTotals-C3PClexH.js';
import { F as FileAttachCell, R as RefPickDialog, S as StdLibManager } from './StdLibManager-Dp-r8k7m.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
/* empty css                       */
/* empty css                  */
/* empty css                         */
/* empty css                  */

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "panelx-form" };
const _hoisted_2 = { class: "card" };
const _hoisted_3 = { class: "tools" };
const _hoisted_4 = ["onClick"];
const _hoisted_5 = { class: "tb-caret" };
const _hoisted_6 = { class: "act-name" };
const _hoisted_7 = {
  key: 0,
  class: "act-sc"
};
const _hoisted_8 = { class: "tb-group" };
const _hoisted_9 = { class: "head" };
const _hoisted_10 = { class: "title" };
const _hoisted_11 = { class: "no" };
const _hoisted_12 = { class: "fields udl-fields" };
const _hoisted_13 = ["title"];
const _hoisted_14 = {
  key: 0,
  class: "req"
};
const _hoisted_15 = {
  key: 3,
  class: "ref-ctl"
};
const _hoisted_16 = {
  key: 4,
  class: "ref-ctl"
};
const _hoisted_17 = {
  key: 0,
  class: "attach-strip"
};
const _hoisted_18 = { class: "attach-strip-label" };
const _hoisted_19 = { class: "attach-slot" };
const _hoisted_20 = {
  key: 1,
  class: "detail"
};
const _hoisted_21 = { class: "dt-head" };
const _hoisted_22 = { class: "dt-tabs" };
const _hoisted_23 = ["onClick"];
const _hoisted_24 = {
  key: 0,
  class: "req"
};
const _hoisted_25 = ["onClick"];
const _hoisted_26 = { class: "dt-actions" };
const _hoisted_27 = {
  key: 1,
  class: "dt-ic"
};
const _hoisted_28 = { class: "dt-ic" };
const _hoisted_29 = { class: "dt-ic" };
const _hoisted_30 = { class: "dt-ic" };
const _hoisted_31 = { class: "dt-ic" };
const _hoisted_32 = { class: "dt-ic" };
const _hoisted_33 = {
  key: 2,
  class: "dt-ic"
};
const _hoisted_34 = { class: "dt-ic" };
const _hoisted_35 = ["onClick"];
const _hoisted_36 = { class: "dt-ic" };
const _hoisted_37 = {
  key: 4,
  class: "filter-hint"
};
const _hoisted_38 = { class: "tab-hint" };
const _hoisted_39 = { class: "sub-wrap" };
const _hoisted_40 = { class: "sub-head" };
const _hoisted_41 = { class: "sub-title" };
const _hoisted_42 = ["title", "onClick", "onDblclick"];
const _hoisted_43 = {
  key: 2,
  class: "std-lib-cell"
};
const _hoisted_44 = ["title", "onClick"];
const _hoisted_45 = {
  key: 2,
  class: "dt-splitter"
};
const _hoisted_46 = { class: "remark" };
const _hoisted_47 = { class: "audit-line" };
const _hoisted_48 = { class: "sel-tip" };
const _hoisted_49 = { class: "sel-item" };
const _hoisted_50 = { class: "dict-pick-list" };
const _hoisted_51 = ["onClick"];

const REF_DROPDOWN_THRESHOLD = 20;


const _sfc_main = {
  __name: 'PanelxForm',
  props: {
  panelCodeProp: { type: String, default: '' },
  codeProp: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
},
  emits: ['saved'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;
const engine = usePanelRuntime();
const { SHORTCUTS } = engine;

const route = useRoute();
const router = useRouter();
const tabsStore = useTabsStore();
const user = useUserStore();
const localeStore = useLocaleStore();

// 语言热切换:轻量重拉字段标签与按钮组(仅换显示定义),
// 表单输入值/明细数据/页签状态全部保留(meta.code 键不随语言变化)。
watch(() => localeStore.locale, async () => {
  if (!panelCode.value) return
  try {
    const payload = isEdit.value
      ? await engine.getFormDescriptor({ panelCode: panelCode.value, code: code.value })
      : await engine.getNewFormPermMatrix({ panelCode: panelCode.value, operationName: operationName.value });
    if (Array.isArray(payload.meta) && payload.meta.length) meta.value = payload.meta;
    const panelConfig = await engine.getPanelConfig(panelCode.value).catch(() => null);
    const panelMetadata = panelConfig?.metadata || payload.metadata || {};
    const configuredGroups = payload.buttonGroups?.length ? payload.buttonGroups : panelMetadata.buttonGroups;
    groups.value = filterGroups(ensureScanFillAction(configuredGroups, panelMetadata));
  } catch { /* 重拉失败保持现状 */ }
});

const panelCode = computed(() => props.panelCodeProp || route.params.panelCode);
const operationName = computed(() => route.query.operationName || '新增流程');
const code = computed(() => props.codeProp || route.query.code);
const isEdit = computed(() => !!code.value);

const form = reactive({});
const meta = ref([]);
const detailDef = ref(null);
const detailData = reactive({});
const activeTab = ref('');
const subActive = reactive({});
// 产成品明细选中行 → 材料明细联动过滤（材料行按自身 子件BOM 存储值归属，纯本地数据）
const selectedProduct = ref(null);
const groups = ref([]);
// ---- 参照字段双模:仅表头(≤20 弹窗,>20 下拉);明细单元格恒为弹窗(参照字段在表格内不走此逻辑) ----
const refModeMap = reactive({});
const refSelectData = reactive({});
async function checkRefMode(r) {
  if (refModeMap[r.code]) return refModeMap[r.code]
  refModeMap[r.code] = 'dialog';
  try {
    const count = await engine.refRowCount(r);
    refModeMap[r.code] = count > REF_DROPDOWN_THRESHOLD ? 'dialog' : 'select';
    if (refModeMap[r.code] === 'select') await loadRefOptions(r, '');
  } catch (e) { /* 保持弹窗 */ }
  return refModeMap[r.code]
}

async function loadRefOptions(r, keyword) {
  if (!refSelectData[r.code]) refSelectData[r.code] = reactive({ options: [], loading: false });
  refSelectData[r.code].loading = true;
  try {
    refSelectData[r.code].options = await engine.refSelectOptions(r, keyword);
  } catch (e) {
    refSelectData[r.code].options = [];
  } finally {
    refSelectData[r.code].loading = false;
  }
}

/** 下拉选中带回:与弹窗确认同口径,按 refMap 把选中项源数据行的其他字段整串回填。
 *  allow-create 自由输入/清空时无源行,静默跳过(不动已填字段,与弹窗取消一致)。 */
function onRefSelectChange(r, v) {
  const opt = (refSelectData[r.code]?.options || []).find((o) => o.value === v);
  if (!opt?.row) return
  applyRefCarry(form, opt.row, refConfigOf(r), r.code);
  applyCalc();
}

// ---- 下拉框字段双模(≤20 下拉 / >20 弹窗):options 内嵌于面板配置,按数量直接判定 ----
const dictModeMap = reactive({}); // code -> 'dialog' | 'select'

function dictModeOf(r) {
  if (!dictModeMap[r.code]) {
    dictModeMap[r.code] = (r.options || []).length > REF_DROPDOWN_THRESHOLD ? 'dialog' : 'select';
  }
  return dictModeMap[r.code]
}

function resetDictModes() {
  Object.keys(dictModeMap).forEach((k) => delete dictModeMap[k]);
}

// 字典弹窗选择(>20 条):搜索 + 列表点击回填
const dictPickVisible = ref(false);
const dictPickField = ref(null);
const dictPickKeyword = ref('');
const dictPickOptions = computed(() => {
  const r = dictPickField.value;
  if (!r) return []
  const kw = dictPickKeyword.value.trim().toLowerCase();
  const opts = (r.options || []).map((o) => ({ value: o.value ?? o, label: o.label ?? o }));
  if (!kw) return opts
  return opts.filter((o) =>
    String(o.label).toLowerCase().includes(kw) || String(o.value).toLowerCase().includes(kw))
});

function openDictPick(r) {
  if (!editable.value || fieldLocked(r)) return
  dictPickField.value = r;
  dictPickKeyword.value = '';
  dictPickVisible.value = true;
}

function onDictPick(option) {
  const r = dictPickField.value;
  if (r) form[r.code] = option.value;
  dictPickVisible.value = false;
  dictPickField.value = null;
}

function clearDictPick() {
  const r = dictPickField.value;
  if (r) form[r.code] = '';
  dictPickVisible.value = false;
  dictPickField.value = null;
}
// 审批按钮权限（提交审批/审批情况公开；审批通过/驳回需角色审批权限）
const APPROVE_ACTIONS = ['审批通过', '审批驳回'];
// 直接「审核」仅管理员（2026-09-22）：审批下拉最下的直审按钮收权——
// 有审批权的角色走 提交审批→审批通过（同效已审核），不再保留直审入口；后端 audit() 同口径拒绝
const ADMIN_ONLY_ACTIONS = ['审核'];
function filterGroups(raw) {
  const canApprove = user.isAdmin || user.approvePanels.includes(panelCode.value);
  return (raw || [])
    .map((g) => {
      let actions = (g.actions || g.items || []).filter((a) => !(!user.isAdmin && ADMIN_ONLY_ACTIONS.includes(a)));
      if (!canApprove) actions = actions.filter((a) => !APPROVE_ACTIONS.includes(a));
      return { ...g, actions }
    })
    .filter((g) => (g.actions || []).length > 0)
}

const loading = ref(false);
const saving = ref(false);
const payloadCache = ref(null);
const approvalVisible = ref(false);
const approvalNo = ref('');
const selVisible = ref(false);
const impVisible = ref(false);
const impFields = ref([]);
const impLabel = ref('明细');
const scanVisible = ref(false);
const selCfg = ref(null);

// ---------- 标准库字段(检验项等):下拉候选来自 yj_std_lib;⌄ 打开条目维护 ----------
const stdLibVisible = ref(false);
const stdLibCode = ref('');
const stdLibItem = ref('默认');
const stdLibTarget = ref(null);   // { row, field } —— 「填入」时写回哪一格

function openStdLib(field, row) {
  if (!field?.stdLib) return
  stdLibCode.value = field.stdLib;
  stdLibItem.value = field.stdLibItem || '默认';
  stdLibTarget.value = { row, field };
  stdLibVisible.value = true;
}
/** 「填入」:把选中的标准库条目写进当前单元格 */
function onStdLibPick(text) {
  const t = stdLibTarget.value;
  if (t?.row && t?.field) t.row[t.field.dataName] = text;
  stdLibVisible.value = false;
}
/** 条目增删/停用后:重拉面板配置,就地刷新同库字段的 options(不重载单据数据,避免冲掉未保存的编辑) */
async function refreshStdLibOptions() {
  const lib = stdLibCode.value;
  if (!lib) return
  try {
    const cfg = await engine.getPanelConfig(panelCode.value);
    const next = (cfg?.detail?.tabs || []).flatMap((t) => t.fields || []).filter((f) => f.stdLib === lib);
    const apply = (fields) => {
      for (const f of fields || []) {
        if (f.stdLib !== lib) continue
        const hit = next.find((n) => n.dataName === f.dataName);
        if (hit) f.options = hit.options;
      }
    };
    apply(meta.value);
    for (const t of detailDef.value?.tabs || []) apply(t.fields);
  } catch { /* 刷新失败不阻断 */ }
}

// ---------- 拉式选单（配置驱动：selectConfig 定义来源面板/列/字段映射） ----------
const selectVisible = ref(false);
const selectList = ref([]);
const selectLoading = ref(false);
const selectRows = ref([]);
const selectCrg = ref(null);
const selectCols = computed(() => selectCrg.value?.columns || []);

function selectConfigFor(action = '选单') {
  const payload = payloadCache.value || {};
  const configs = payload.selectConfigs || {};
  if (configs[action]) return configs[action]
  // 后端目前只下发单来源的 selectConfig(不发 selectConfigs),所以「选XX」下拉项此前一律返回 null、
  // 点了只弹「演示环境暂未实现」—— 与「选单」同样回落到 selectConfig(不影响已能工作的路径)。
  if (action === '选单' || action.startsWith('选')) return payload.selectConfig || Object.values(configs)[0]
  return null
}

async function openSelectDialog(cfg = selectConfigFor()) {
  if (!cfg) {
    ElMessage.info('演示环境暂未实现「选单」，界面与 T+ 保持一致');
    return
  }
  selectCrg.value = cfg;
  selectVisible.value = true;
  selectLoading.value = true;
  selectRows.value = [];
  try {
    // 对齐 T+ 选单前提：已生效（已审核）且未中止的来源单据
    const condition = { ...(cfg.condition || {}), 单据状态: '已审核' };
    const res = await engine.queryFormDataList({ panelCode: cfg.source, condition, pageNo: 1, pageSize: 100 });
    let rows = res.list || [];
    // 来源列表返回单据级行（带 detail）时展开为明细行（对齐 T+ 选单按明细行展示/带出；有 detailRows 配置则保持单据粒度）
    if (!cfg.detailRows && rows.some((r) => r.detail)) {
      const flat = [];
      for (const r of rows) {
        const d = r.detail;
        const key = cfg.detailKey || (d ? Object.keys(d)[0] : null);
        if (key && Array.isArray(d[key])) {
          d[key].forEach((it, index) => flat.push({
            ...r,
            ...it,
            _sourceFormNo: r['编号'] || r['单据编号'] || r['锭号'] || '',
            _sourceRowNo: index + 1,
          }));
        }
      }
      if (flat.length) rows = flat;
    }
    // detailRows 配置时选单粒度=单据（如工序汇报单选生产工单）：按单据编号去重，避免一张多产品单显示多行
    if (cfg.detailRows) {
      const seen = new Set();
      rows = rows.filter((r) => {
        const k = r['单据编号'] || r['编号'] || '';
        if (!k || seen.has(k)) return false
        seen.add(k);
        return true
      });
    }
    selectList.value = rows;
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '来源单据加载失败');
  } finally {
    selectLoading.value = false;
  }
}

function confirmSelect() {
  const cfg = selectCrg.value;
  if (!cfg) return
  // 表头字段映射（headerMap：from 来源字段 → to 当前表头字段；fixed 为固定值）
  const first = selectRows.value[0] || {};
  for (const m of cfg.headerMap || []) {
    if (m.fixed !== undefined) form[m.to] = m.fixed;
    else if (m.from) form[m.to] = first[m.from] ?? form[m.to];
  }
  // 来源单号回填（对齐 T+：来源单据 + 来源单号）
  const sourceNos = [...new Set(selectRows.value.map((r) => r['单据编号'] || r['编号'] || '').filter(Boolean))];
  if (sourceNos.length) {
    if (cfg.sourceNoField) form[cfg.sourceNoField] = sourceNos.join('、');
    if (form['来源单据'] === undefined && form['匹配来源单号'] === undefined) form['来源单据'] = cfg.title || '选单';
  }
  // 明细行来源：默认选中行；配置 detailRows 时（如工序汇报单选生产工单）对每个选中单据取工序明细合并（对齐 T+ 选单带出工序行）
  let srcRows = selectRows.value;
  if (cfg.detailRows) {
    const extra = [];
    for (const r of selectRows.value) {
      const part = cfg.detailRows(r);
      if (Array.isArray(part)) extra.push(...part);
    }
    if (extra.length) srcRows = extra;
  }
  // 明细行映射（detailMap：from → to）
  const rows = srcRows.map((r) => {
    const out = {};
    for (const m of cfg.detailMap || []) {
      out[m.to] = r[m.from] ?? '';
    }
    const sourceNo = r._sourceFormNo || r['编号'] || r['单据编号'] || r['锭号'] || sourceNos[0] || '';
    const sourceQtyField = cfg.sourceQuantityField || '数量';
    const targetQtyField = cfg.targetQuantityField || '';
    out['来源面板'] = cfg.source || '';
    out['来源单号'] = sourceNo;
    out['来源行号'] = r._sourceRowNo || 1;
    out['来源数量'] = targetQtyField && out[targetQtyField] !== undefined
      ? out[targetQtyField]
      : (r[sourceQtyField] ?? 0);
    return out
  });
  if (rows.length && detailDef.value?.tabs?.[0]) {
    const targetTab = detailDef.value.tabs[0];
    detailData[targetTab.key] = rows;
  }
  selectVisible.value = false;
  ElMessage.success('已带入 ' + rows.length + ' 行明细');
  applyCalc();
}
const status = computed(() => form['单据状态'] || '草稿');
// 单据=草稿可编辑；基础档案（存货/部门等）状态为 启用/停用 同样可编辑（增行/改字段/保存）
const editable = computed(() => !isEdit.value || status.value === '草稿' || status.value === '启用' || status.value === '停用');

/** 附件上传闸门(与 PanelxList 同口径 2026-09-20):**凡配了附件列位的单据,已审核/已完成也允许补附件**
 *  (佐证材料,只写附件列与 yj_attachment,不动业务字段;金蝶同步进来的订单本来就是已审核);仅「已作废」禁止 */
const ATTACH_EDIT_PANELS = new Set([
  'PU_ORDER', 'SO_ORDER', 'MANU_ORDER', 'OUTSOURCE_ORDER', 'WO_ORDER', 'KHDD',
  'QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN', 'SALE_OUT',
]);
const attachEditable = computed(() => {
  if (editable.value) return true
  if (!ATTACH_EDIT_PANELS.has(panelCode.value)) return false
  if (!(form['单据编号'] || form['编号'])) return false
  return status.value !== '已作废'
});

const STATUS_TAG = { 草稿: 'info', 已审核: 'primary', 已完成: 'success', 生产中: 'warning', 已完工: 'success', 已中止: 'danger', 已关闭: 'info' };
function statusTag(s) {
  return STATUS_TAG[s] || 'info'
}

const tabs = computed(() => {
  const d = detailDef.value;
  if (!d) return []
  if (Array.isArray(d.tabs)) return d.tabs
  return [{ key: 'detail', label: d.label || '明细', fields: d.fields || [], isRequired: true }]
});

function visibleFields(tab) {
  return (tab.fields || []).filter((r) => !r.hidden)
}

const visibleMeta = computed(() => (meta.value || []).filter((r) => !r.hidden));
/** 附件字段不进表头网格:单独「附件」区渲染,单据存在时常驻上传/查看(同 PanelxList 附件区) */
const visibleAttachMeta = computed(() => visibleMeta.value.filter((r) => isAttach(r)));
const visibleFormMeta = computed(() => visibleMeta.value.filter((r) => !isAttach(r)));
/** 头表附件列位键(附件1..附件6):页面单格聚合,上传按序占第一个空余列位 */
const attachKeys = computed(() => visibleAttachMeta.value.map((r) => r.code));
const attachValues = computed(() => Object.fromEntries(attachKeys.value.map((k) => [k, form[k] || ''])));
function applyAttachSlots(map) {
  Object.entries(map || {}).forEach(([k, v]) => { form[k] = v; });
}

function fieldLocked(r) {
  // 锭号：自动编码；仅勾选「是否手工修改单据编码」时草稿可改
  if (r.autoCode) return !(status.value === '草稿' && form['是否手工修改单据编码'])
  // 存货类别：创建后固定，不允许修改
  if (r.code === '类别' && isEdit.value) return true
  return false
}

function isDisabled(action) {
  const s = status.value;
  const map = {
    保存: !editable.value,
    保存新增: !editable.value,
    保存为草稿: !editable.value,
    删除: s !== '草稿' || !isEdit.value,
    审核: s !== '草稿' || !isEdit.value,
    弃审: s !== '已审核',
    中止执行: !['已审核', '生产中', '已完工'].includes(s) || !isEdit.value,
    整单中止: !['已审核', '生产中', '已完工'].includes(s) || !isEdit.value,
    草稿: s !== '已中止',
    取消中止: s !== '已中止',
    修改: !['已审核', '生产中', '已完工'].includes(s) || !isEdit.value,
    审批情况: false,
    提交审批: s !== '草稿' || !isEdit.value,
    审批通过: !['审批中', '待二级审批'].includes(s) || !isEdit.value,
    审批驳回: !['审批中', '待二级审批'].includes(s) || !isEdit.value,
    扫描填单: false,
  };
  // 2026-08-25：所有「生成XX」生单按钮统一仅已审核可用（对齐 T+：已审核才能选择生单）
  // 2026-09-20：去掉残留的「生产中」档(状态推导无此档,全库无此值),与后端 PushGenerateHandler 的「仅已审核」一致
  if (map[action] === undefined && action.startsWith('生成')) {
    return s !== '已审核' || !isEdit.value
  }
  return map[action] === true
}

function isText(r) {
  return !r.dataType || r.dataType === '文本' || r.dataType === 'STRING'
}
function isAttach(r) {
  return r.dataType === '附件'
}
function isNumber(r) {
  return ['小数', '整数', 'Decimal', 'Long', 'Integer', 'Double'].includes(r.dataType)
}
function isDate(r) {
  return ['日期', '时间', 'DATE', 'DateTime', 'Date'].includes(r.dataType)
}
function isBool(r) {
  return ['是否', 'Boolean', 'BOOL'].includes(r.dataType)
}
function isSelect(r) {
  return r.dataType === '下拉框' || r.dataType === '参照'
}

// ---------- 参照字段弹窗选择（开发约束十一-1：能对应基础档案的字段弹窗拉取勾选导入） ----------
const refVisible = ref(false);
const refPick = ref(null);

function isRef(r) {
  return r.dataType === '参照' && (r.ref || r.refPanel)
}

function refText(r, v) {
  if (v === undefined || v === null || v === '') return ''
  const t = engine.refLabelOf(r, v);
  return t === null || t === undefined ? String(v) : t
}

function drRefText(dr, row) {
  return refText(dr, row[dr.dataName])
}

function openRefPick(r) {
  if (!editable.value || fieldLocked(r)) return
  refPick.value = { field: r, kind: 'header', code: r.code, mode: 'header' };
  refVisible.value = true;
}

function detailRefConfig(dr) {
  return dr.ref || dr
}

function detailRefTrigger(dr) {
  const r = detailRefConfig(dr);
  return r.trigger || r.refTrigger || 'click'
}

function detailRefEnabled(dr) {
  if (!editable.value || dr.computed) return false
  const r = detailRefConfig(dr);
  const statuses = r.statuses || r.refStatuses;
  return !Array.isArray(statuses) || statuses.length === 0 || statuses.includes(status.value)
}

function openDetailRef(dr, row, tab, trigger = 'click') {
  if (!detailRefEnabled(dr) || detailRefTrigger(dr) !== trigger) return
  refPick.value = { field: dr, kind: 'detail', row, tab, mode: 'detail' };
  refVisible.value = true;
}

async function onRefConfirm(rows) {
  const p = refPick.value;
  if (!p || !rows.length) return
  const r = p.field;
  const rp = refConfigOf(r);
  const refField = rp.field || rp.refField;
  const multi = !!(rp.multi || rp.refMulti);
  const vals = rows.map((x) => x[refField]);
  if (p.kind === 'header') {
    form[p.code] = multi ? vals.join('、') : vals[0];
    applyRefCarry(form, rows[0] || {}, rp, p.code);
  } else {
    const row = p.row;
    const tab = p.tab;
    const changedRows = [];
    const applyMap = (target, srcRow) => applyRefCarry(target, srcRow, rp, r.dataName);
    const rillRow = (target, srcRow) => {
      target[r.dataName] = srcRow[refField];
      applyMap(target, srcRow);
      changedRows.push(target);
    };
    // 明细行参照：勾选 N 行一次导入 → 当前行填第一行，其余每行生成一条明细（含 refMap 带出）
    rillRow(row, rows[0] || {});
    if (rows.length > 1 && tab) {
      for (let i = 1; i < rows.length; i++) {
        const nr = addDetailRow(tab);
        rillRow(nr, rows[i]);
      }
    }
    await engine.fillCurrentStock(changedRows);
  }
  refVisible.value = false;
  applyCalc();
  ElMessage.success(`已导入 ${rows.length} 行${await engine.refPanelName(r)}数据`);
}

function rmtTime(t) {
  if (!t) return '-'
  if (typeof t === 'number') return new Date(t).toLocaleString('zh-CN', { hour12: false })
  const s = String(t);
  return s.length > 10 ? s.slice(0, 19).replace('T', ' ') : s
}

// 明细数据：材料明细在选中产成品时只显示归属于该产成品的行（按材料行自身 子件BOM=产品编码 的存储值）
function tabData(tab) {
  const rows = detailData[tab.key] || [];
  if (tab.key === 'materials' && selectedProduct.value) {
    const byBom = rows.filter((m) => m['子件BOM'] === selectedProduct.value);
    if (byBom.length) return byBom
    return rows
  }
  return rows
}

function prodRowCls({ row }) {
  return selectedProduct.value && row['产品编码'] === selectedProduct.value ? 'prod-selected' : ''
}

// 捕获阶段监听：点产成品明细行触发联动（材料明细按 子件BOM 存储值过滤）
async function onTableClickCapture(tab, e) {
  if (!e || !e.target || !e.target.closest) return
  const tr = e.target.closest('tr');
  if (!tr) return
  // 主表与固定列（序号列 fixed=left）都可能触发：两种 body 容器都支持
  const body = tr.closest('.el-table__body-wrapper') || tr.closest('.el-table__fixed-body-wrapper');
  const rows = body ? [...body.querySelectorAll('tbody tr')] : [];
  const idx = rows.indexOf(tr);
  if (tab.key !== 'products') return
  const row = (detailData['products'] || [])[idx];
  if (!row || !row['产品编码']) return
  selectProduct(row['产品编码']);
}

// row-click 兜底：普通单元格点击走此路径（控件内点击被 el-select 等吞掉时由捕获阶段补上）
function onRowClickDetail(tab, row) {
  if (tab.key === 'products' && row && row['产品编码'] && row['产品编码'] !== selectedProduct.value) {
    selectProduct(row['产品编码']);
  }
}

// 选中产成品：行高亮 + 材料明细按自身 子件BOM=产品编码 的存储值过滤（纯本地数据,无外部取数）
function selectProduct(code) {
  selectedProduct.value = code;
}

function tabHint(tab) {
  if (tab.key === 'materials') return '需用数量 = 定额需用数量 × 产品数量 ÷ 定额生产数量；计划数量 = 需用数量 + 损耗数量（损耗数量手工录入）'
  if (tab.key === 'processes') return '金额 = 计划数量 × 工价；行「手工完工」用于工序级完工；展开行维护本工序材料'
  if (tab.key === 'products') return '产品数量为工单生产数量，材料明细按此数量展开定额'
  return ''
}

function addDetailRow(tab) {
  const rows = detailData[tab.key] || (detailData[tab.key] = []);
  const row = {};
  for (const dr of tab.fields || []) {
    if (dr.dataType === '小数' || dr.dataType === '整数') row[dr.dataName] = dr.defaultValue ?? 0;
    else if (dr.dataType === '是否') row[dr.dataName] = dr.defaultValue ?? false;
    else row[dr.dataName] = dr.defaultValue ?? '';
  }
  if (tab.subTable) row['子表材料'] = [];
  // 材料明细：新增行自动归属当前选中的产成品（子件BOM=产品编码），保证联动过滤精确
  if (tab.key === 'materials' && selectedProduct.value) row['子件BOM'] = selectedProduct.value;
  rows.push(row);
  return row
}

function addSubRow(row, tab) {
  if (!row['子表材料']) row['子表材料'] = [];
  const sr = {};
  for (const sr of tab.subTable.fields || []) {
    if (sr.dataType === '小数' || sr.dataType === '整数') sr[sr.dataName] = sr.defaultValue ?? 0;
    else sr[sr.dataName] = sr.defaultValue ?? '';
  }
  row['子表材料'].push(sr);
}

// ---------- 表达式计算链 ----------

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0
}

function productQty(data = detailData) {
  const rows = data.products || [];
  return rows.reduce((s, r) => s + num(r['数量']), 0)
}

function applyCalc(data = detailData) {
  for (const tab of tabs.value) {
    const rows = data[tab.key] || [];
    // 「产品数量」= 产成品明细的合计数量,是这些公式的额外变量(不写回行)
    const extraVars = { 产品数量: productQty(data) };
    for (const row of rows) {
      if (tab.key === 'processes') {
        row['工序行码'] = `GX${String(num(row['加工顺序']) || rows.indexOf(row) + 1).padStart(3, '0')}`;
      }
      // 求值口径统一在 @core/panel/calcRules(与后端 CalcRuleService 同一份规则、同一个守卫)
      applyCalcRules(tab.calc, row, extraVars);
    }
  }
}

watch(detailData, applyCalc, { deep: true });

// ---------- 明细字段联动 ----------

async function onDetailChange(dr, row, tab) {
  if (['存货编码', '存货名称', '产品编码', '产品名称', '材料编码', '材料名称', '仓库', '预出仓库', '出库仓库'].includes(dr.dataName)) {
    try { await engine.fillCurrentStock(row); } catch (error) { ElMessage.error(engine.errMsg(error) || '现存量刷新失败'); }
  }
}

async function refreshTabCurrentStock(tab) {
  try {
    const count = await engine.fillCurrentStock(detailData[tab.key] || []);
    ElMessage.success(`已按库存状况表刷新 ${count} 行现存量`);
  } catch (error) {
    ElMessage.error(engine.errMsg(error) || '现存量提取失败');
  }
}

// ---------- 汇总 ----------

function summaryRows(tab) {
  const items = tab.summaryItems || [];
  const rows = detailData[tab.key] || [];
  return items.map((it) => {
    // 汇总值位数跟明细走(2026-10-03:原先恒 2 位,明细 decimal(18,4) 的 4 位被砍)
    const v = sumKeepScale(rows.map((r) => r[it.field])) ?? 0;
    return { label: it.label, value: v }
  })
}

// 明细网格合计行（对齐 T+ 网格底部合计）
function summarize({ columns }, tab) {
  const rows = tabData(tab);
  const sums = ['合计'];
  for (let i = 1; i < columns.length; i++) {
    const col = columns[i];
    if (!col) continue
    const label = String(col.label || '');
    if (i === columns.length - 1) {
      sums.push('');
      continue
    }
    const field = (tab.fields || []).find((r) => r.dataName === label);
    if (field && (field.dataType === '小数' || field.dataType === '整数')) {
      // 位数跟本列明细走(decimal(18,4) 的明细不再被合计砍成 2 位,见 @core/panel/sumTotals)
      sums.push(sumKeepScale(rows.map((r) => r[label])) ?? 0);
    } else {
      sums.push('');
    }
  }
  return sums
}

// ---------- 校验 / 加载 / 按钮 ----------

function validate() {
  for (const r of visibleMeta.value) {
    if (r.isNotNull && (form[r.code] === undefined || form[r.code] === null || String(form[r.code]).trim() === '')) {
      return `${r.name}不能为空`
    }
  }
  for (const tab of tabs.value) {
    if (tab.isRequired && !(detailData[tab.key] || []).length) return `请至少添加一行${tab.label}`
  }
  return ''
}

async function load() {
  loading.value = true;
  try {
    const configPromise = engine.getPanelConfig(panelCode.value).catch(() => null);
    let payload;
    if (isEdit.value) {
      payload = await engine.getFormDescriptor({ panelCode: panelCode.value, code: code.value });
    } else {
      payload = await engine.getNewFormPermMatrix({ panelCode: panelCode.value, operationName: operationName.value });
    }
    Object.keys(detailData).forEach((k) => delete detailData[k]);
    const dd = payload.detailData;
    if (Array.isArray(dd)) detailData.detail = dd;
    else if (dd && typeof dd === 'object') Object.assign(detailData, dd);
    Object.keys(form).forEach((k) => delete form[k]);
    Object.assign(form, payload.data || {});
    meta.value = payload.meta || [];
    detailDef.value = payload.detail || null;
    // 参照字段双模检查(≤20 弹窗,>20 下拉)
    const refFields = (meta.value || []).filter(isRef);
    for (const rf of refFields) checkRefMode(rf);
    const panelConfig = await configPromise;
    const panelMetadata = panelConfig?.metadata || payload.metadata || {};
    const configuredGroups = payload.buttonGroups?.length
      ? payload.buttonGroups
      : panelMetadata.buttonGroups;
    groups.value = filterGroups(ensureScanFillAction(configuredGroups, panelMetadata));
    payloadCache.value = payload;
    const firstTab = tabs.value.find((t) => t.type !== 'summary');
    if (firstTab && !activeTab.value) activeTab.value = firstTab.key;
    for (const t of tabs.value) {
      if (!subActive[t.key]) subActive[t.key] = 'detail';
    }
    applyCalc();
    // 产成品→材料联动：默认不选中（点击产成品明细行才过滤材料明细），加载后重置
    selectedProduct.value = null;
    // 页签标题 = 面板名-单据号（新单显示 面板名-新增），便于多单据区分（弹窗嵌入模式跳过）
    if (!props.embedded) {
      const no = isEdit.value ? (form['单据编号'] || form['锭号'] || form['编号'] || '') : '新增';
      // 复用顶部 tabsStore
      const cur = tabsStore.tabs.find((x) => x.path === route.path);
      if (cur) cur.title = (payload.panelName || '表单') + '-' + no;
      // 页面标题 = 真实面板名（路由 meta.title 是通用占位，配置加载后覆盖）
      document.title = (payload.panelName || '表单') + ' · YINJIA-MES';
    }
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '加载失败');
    back();
  } finally {
    loading.value = false;
  }
}

async function onButton(action) {
  // 2026-08-25：灰按钮（disabled）点击直接忽略，不执行、不弹提示（如草稿态「生成XX」生单按钮）
  if (isDisabled(action)) return
  if (APPROVE_ACTIONS.includes(action) && !user.isAdmin && !user.approvePanels.includes(panelCode.value)) {
    return ElMessage.warning('当前角色无审批权限')
  }
  if (action === '扫描填单') {
    if (!editable.value) {
      try {
        await ElMessageBox.confirm(
          tt('当前单据不可编辑，扫描结果将保存为一张新草稿。'),
          tt('扫描填单'),
          { confirmButtonText: tt('继续扫描'), cancelButtonText: tt('取消'), type: 'warning' },
        );
      } catch (error) {
        return
      }
    }
    scanVisible.value = true;
    return
  }
  if (action === '修改') {
    ElMessage.info(isEdit.value ? '当前单据已处于编辑状态' : '请先打开单据后再修改');
    return
  }
  if (action === '放弃' || action === '取消') {
    back();
    return
  }
  // Excel 导入：识别当前主明细 tab 字段，导入后追加明细行
  if (action === '导入') {
    const tab = tabs.value[0];
    if (!tab) return ElMessage.warning('该面板无明细可导入')
    impFields.value = (tab.fields || []).filter((f) => !f.hidden);
    impLabel.value = tab.label || '明细';
    impVisible.value = true;
    return
  }
  // 拉式选单（配置驱动：selectConfig.generateButton 存在 → 新弹窗直接生单；否则旧带入流程）
  if (action === '选单' || action.startsWith('选')) {
    const sc = selectConfigFor(action);
    if (sc) {
      if (sc.generateButton) {
        selCfg.value = sc;
        selVisible.value = true;
      } else {
        openSelectDialog(sc);
      }
      return
    }
    ElMessage.info('演示环境暂未实现「选单」，界面与 T+ 保持一致');
    return
  }
  if (action === '新增') {
    if (isEdit.value && status.value === '草稿') {
      try {
        await ElMessageBox.confirm(tt('当前单据尚未保存，切换新增将丢弃修改，是否继续？'), tt('提示'), { type: 'warning' });
      } catch (e) {
        return
      }
    }
    router.replace({ path: `/panelx/form/${panelCode.value}`, query: { operationName: operationName.value } });
    return
  }
  if (action === '删除') {
    try {
      await ElMessageBox.confirm(`确认删除单据 ${form['单据编号'] || form['锭号'] || form['编号']}？`, '提示', { type: 'warning' });
    } catch (e) {
      return
    }
  }
  // 人工审核：确认弹窗 + 审核意见（选填）；审核人取当前登录人（后端从 JWT 取）
  let auditOpinion = '';
  if (action === '审核') {
    // 已审核过的单据不允许再次审核，也不允许补填审批意见
    if (status.value !== '草稿') return ElMessage.warning('仅草稿状态可审核，已审核单据不允许再次审核')
    const no = form['单据编号'] || form['锭号'] || form['编号'] || '';
    try {
      const { value } = await ElMessageBox.prompt(
        tt('单据：{no}（当前状态：{st}）').replace('{no}', no).replace('{st}', status.value),
        tt('人工审核确认'),
        { confirmButtonText: tt('确认审核'), cancelButtonText: tt('取消'), inputType: 'textarea', inputPlaceholder: tt('审核意见（选填）') }
      );
      auditOpinion = value || '';
    } catch (e) {
      return
    }
  } else if (action === '弃审') {
    if (status.value !== '已审核') return ElMessage.warning(tt('仅已审核状态可弃审'))
    try {
      await ElMessageBox.confirm(tt('确认弃审该单据？弃审后需重新审核。'), tt('弃审确认'), { type: 'warning' });
    } catch (e) {
      return
    }
  }
  // 审批流：提交审批/审批通过（确认+意见）、审批驳回（意见必填）、审批情况（历史弹窗）
  let approvalOpinion = '';
  if (action === '提交审批' || action === '审批通过') {
    const need = action === '提交审批' ? '草稿' : '审批中';
    if (status.value !== need) return ElMessage.warning(tt(action === '提交审批' ? '仅草稿状态可提交审批' : '仅审批中状态可审批通过'))
    const no = form['单据编号'] || form['锭号'] || form['编号'] || '';
    try {
      const { value } = await ElMessageBox.prompt(
        tt('单据：{no}（当前状态：{st}）').replace('{no}', no).replace('{st}', status.value),
        tt('{action}确认').replace('{action}', tt(action)),
        { confirmButtonText: tt('确认{n}').replace('{n}', tt(action)), cancelButtonText: tt('取消'), inputType: 'textarea', inputPlaceholder: tt(action === '审批通过' ? '审批意见（选填）' : '提交说明（选填）') }
      );
      approvalOpinion = value || '';
    } catch (e) {
      return
    }
  } else if (action === '审批驳回') {
    if (status.value !== '审批中') return ElMessage.warning(tt('仅审批中状态可审批驳回'))
    const no = form['单据编号'] || form['锭号'] || form['编号'] || '';
    try {
      const { value } = await ElMessageBox.prompt(
        tt('单据：{no}（当前状态：审批中）\n驳回必须填写审批意见').replace('{no}', no),
        tt('审批驳回确认'),
        { confirmButtonText: tt('确认驳回'), cancelButtonText: tt('取消'), inputType: 'textarea', inputPlaceholder: tt('驳回原因（必填）'), inputValidator: (v) => (v && v.trim() ? true : tt('驳回必须填写审批意见')) }
      );
      approvalOpinion = value || '';
    } catch (e) {
      return
    }
  } else if (action === '审批情况') {
    approvalNo.value = form['编号'] || form['单据编号'] || form['锭号'] || '';
    approvalVisible.value = true;
    return
  }
  if (['保存', '保存为草稿', '保存新增'].includes(action)) {
    const msg = validate();
    if (msg) return ElMessage.warning(msg)
  }
  if (action === '刷新') {
    await load();
    return
  }
  saving.value = true;
  try {
    const rd = { ...form };
    if (tabs.value.length) rd.detail = { ...detailData };
    if (auditOpinion !== '') rd['审核意见'] = auditOpinion;
    if (approvalOpinion !== '') rd['审批意见'] = approvalOpinion;
    const res = await engine.callButton({
      panelCode: panelCode.value,
      buttonName: action,
      formData: rd,
      buttonParam: isEdit.value ? { code: form['编号'] } : {},
    });
    // 推式生单结果：直接跳转目标面板列表页（不弹窗、不新开标签页），新单按创建时间倒序显示在第一张（草稿内联可编辑）
    if (res?.gotoPanel) {
      if (props.embedded) {
        emit('saved', res);
        return
      }
      ElMessage.success(`已生成${res.gotoPanel === 'MANU_ORDER' ? '生产工单' : res.gotoPanel}：${res['编号']}，请在列表页继续填写`);
      const targetPath = `/panelx/list/${res.gotoPanel}`;
      tabsStore.close(route.path); // 关闭当前源表单页签（页签被目标面板替换）
      router.push(targetPath);
      tabsStore.open({ path: targetPath, title: res.gotoPanel });
      return
    }
    ElMessage.success(`「${action}」成功`);
    if (action === '新增流程' && !isEdit.value) {
      back();
      return
    }
    if (action === '保存新增') {
      router.replace({ path: `/panelx/form/${panelCode.value}`, query: { operationName: operationName.value } });
    } else if (['保存', '保存为草稿', '删除', '审核', '弃审', '中止执行', '整单中止', '草稿', '取消中止'].includes(action)) {
      if (action === '删除') {
        back();
      } else if (isEdit.value && res?.['编号']) {
        await load();
      } else {
        back();
      }
    }
  } catch (e) {
    const msg = engine.errMsg(e) || '按钮执行失败';
    if (msg.includes('演示环境暂未实现')) ElMessage.info(msg);
    else ElMessage.error(msg);
  } finally {
    saving.value = false;
  }
}

function normalizeScanData(payload) {
  const header = {};
  const fields = new Map(visibleMeta.value.map((field) => [field.code || field.dataName || field.name, field]));
  for (const [key, value] of Object.entries(payload?.header || {})) {
    const field = fields.get(key);
    if (!field || field.hidden || field.computed || field.autoCode || fieldLocked(field)) continue
    header[key] = value;
  }

  const detail = {};
  const tabMap = new Map(tabs.value.map((tab) => [tab.key, tab]));
  for (const [tabKey, rows] of Object.entries(payload?.detail || {})) {
    const tab = tabMap.get(tabKey);
    if (!tab || !Array.isArray(rows)) continue
    const writable = new Set((tab.fields || [])
      .filter((field) => !field.hidden && !field.computed)
      .map((field) => field.dataName || field.code || field.name));
    const recognizedRows = rows.map((row) => Object.fromEntries(
      Object.entries(row || {}).filter(([key]) => writable.has(key)),
    ));
    detail[tabKey] = recognizedRows;
  }
  return { header, detail }
}

async function onScanApply(payload) {
  const recognized = normalizeScanData(payload);
  if (!editable.value) {
    let draftNo = '';
    try {
      const created = await engine.callButton({
        panelCode: panelCode.value,
        buttonName: '保存',
        formData: {},
        buttonParam: {},
      });
      draftNo = created?.['编号'] || created?.formNo || '';
      if (!draftNo) throw new Error('未返回单据编号')

      const descriptor = await engine.getFormDescriptor({ panelCode: panelCode.value, code: draftNo });
      const detail = { ...(descriptor.detailData || {}) };
      for (const [tabKey, rows] of Object.entries(recognized.detail)) {
        detail[tabKey] = payload?.detailMode === 'append'
          ? [...(detail[tabKey] || []), ...rows]
          : rows;
      }
      applyCalc(detail);
      await engine.callButton({
        panelCode: panelCode.value,
        buttonName: '保存',
        formData: { ...(descriptor.data || {}), ...recognized.header, detail },
        buttonParam: { code: draftNo },
      });

      ElMessage.success(`识别数据已保存为新草稿 ${draftNo}`);
      if (props.embedded) {
        emit('saved', { ...created, focus: draftNo });
      } else {
        await router.replace({
          path: `/panelx/form/${panelCode.value}`,
          query: { ...route.query, code: draftNo },
        });
      }
      return
    } catch (error) {
      const prefix = draftNo ? `已创建空草稿 ${draftNo}，但` : '';
      ElMessage.error(prefix + (engine.errMsg(error) || '识别数据保存失败'));
      return
    }
  }

  Object.assign(form, recognized.header);
  for (const [tabKey, rows] of Object.entries(recognized.detail)) {
    detailData[tabKey] = payload?.detailMode === 'append'
      ? [...(detailData[tabKey] || []), ...rows]
      : rows;
  }
  applyCalc();
  ElMessage.success('识别数据已填入单据，请核对后保存');
}

function back() {
  if (props.embedded) {
    emit('saved');
    return
  }
  router.push({ path: `/panelx/list/${panelCode.value}` });
}

// Excel 导入完成：行追加到主明细，提示保存落库
function onImported(rows) {
  const tab = tabs.value[0];
  if (!tab || !Array.isArray(rows)) return
  const target = detailData[tab.key] || (detailData[tab.key] = []);
  for (const r of rows) target.push(r);
  ElMessage.success('已导入 ' + rows.length + ' 行到「' + (tab.label || tab.key) + '」，请点击保存落库');
}

// 新选单弹窗生单完成：2026-08-25 不再弹窗展示，直接跳目标面板列表页并定位新选入单据
function onSelGenerated(generated) {
  const first = generated && generated[0];
  if (!first) return
  const path = '/panelx/list/' + first.panel;
  router.push({ path, query: { focus: first.no } });
  tabsStore.open({ path, title: first.panel, query: { focus: first.no } });
}

onMounted(() => {
  load();
});

// keep-alive 切离时关闭所有弹窗（防止 append-to-body 弹窗在路由切换后残留）
onDeactivated(() => {
  selectVisible.value = false;
  selVisible.value = false;
  refVisible.value = false;
  impVisible.value = false;
  scanVisible.value = false;
});

// 从列表页「选单」入口（?select=1）跳转而来：load 完成后自动弹出选单对话框（payloadCache 异步赋值）
watch(payloadCache, (v) => {
  if (route.query.select && v && v.selectConfig && !selVisible.value) openSelectDialog();
});

watch(() => [panelCode.value, code.value], () => {
  scanVisible.value = false;
  // 2026-08-20：关闭页签/切走时 panelCode 变 undefined——不触发加载
  if (!panelCode.value || panelCode.value === 'undefined') return
  // 路由参数变化（同组件切换面板）时关闭所有弹窗，防止 append-to-body 弹窗残留
  selectVisible.value = false;
  selVisible.value = false;
  refVisible.value = false;
  impVisible.value = false;
  resetDictModes();
  load();
});

return (_ctx, _cache) => {
  const _component_el_icon = ElIcon;
  const _component_el_dropdown_item = ElDropdownItem;
  const _component_el_dropdown_menu = ElDropdownMenu;
  const _component_el_dropdown = ElDropdown;
  const _component_el_tag = ElTag;
  const _component_el_input = ElInput;
  const _component_el_input_number = ElInputNumber;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_button = ElButton;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_switch = ElSwitch;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_image = ElImage;
  const _component_el_dialog = ElDialog;
  const _component_el_empty = ElEmpty;
  const _directive_loading = vLoading;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    createBaseVNode("div", _hoisted_2, [
      createBaseVNode("div", _hoisted_3, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(groups.value, (g) => {
          return (openBlock(), createElementBlock("span", {
            key: g.name,
            class: "tb-group"
          }, [
            createBaseVNode("span", {
              class: normalizeClass(["tb-main", { disabled: isDisabled(g.actions[0]) }]),
              onClick: $event => (onButton(g.actions[0]))
            }, toDisplayString(unref(tt)(g.name)), 11, _hoisted_4),
            (g.actions.length > 1)
              ? (openBlock(), createBlock(_component_el_dropdown, {
                  key: 0,
                  onCommand: _cache[0] || (_cache[0] = (a) => onButton(a)),
                  trigger: "click"
                }, {
                  dropdown: withCtx(() => [
                    createVNode(_component_el_dropdown_menu, null, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(g.actions.slice(1), (a) => {
                          return (openBlock(), createBlock(_component_el_dropdown_item, {
                            key: a,
                            command: a,
                            disabled: isDisabled(a)
                          }, {
                            default: withCtx(() => [
                              createBaseVNode("span", _hoisted_6, toDisplayString(unref(tt)(a)), 1),
                              (unref(SHORTCUTS)[a])
                                ? (openBlock(), createElementBlock("span", _hoisted_7, toDisplayString(unref(SHORTCUTS)[a]), 1))
                                : createCommentVNode("", true)
                            ]),
                            _: 2
                          }, 1032, ["command", "disabled"]))
                        }), 128))
                      ]),
                      _: 2
                    }, 1024)
                  ]),
                  default: withCtx(() => [
                    createBaseVNode("span", _hoisted_5, [
                      createVNode(_component_el_icon, null, {
                        default: withCtx(() => [
                          createVNode(unref(arrow_down_default))
                        ]),
                        _: 1
                      })
                    ])
                  ]),
                  _: 2
                }, 1024))
              : createCommentVNode("", true)
          ]))
        }), 128)),
        createBaseVNode("span", _hoisted_8, [
          (!__props.embedded)
            ? (openBlock(), createElementBlock("span", {
                key: 0,
                class: "tb-main back",
                onClick: back
              }, toDisplayString(unref(tt)('返回')), 1))
            : createCommentVNode("", true)
        ]),
        _cache[14] || (_cache[14] = createStaticVNode("<div class=\"tools-right\" data-v-6ef9326e><span class=\"pg\" data-v-6ef9326e>◁</span><span class=\"pg\" data-v-6ef9326e>◀</span><span class=\"pg\" data-v-6ef9326e>▶</span><span class=\"pg\" data-v-6ef9326e>▷</span></div>", 1))
      ]),
      createBaseVNode("div", _hoisted_9, [
        createBaseVNode("div", _hoisted_10, [
          createBaseVNode("span", _hoisted_11, toDisplayString(isEdit.value ? (form['单据编号'] || form['锭号'] || form['编号'] || '') : unref(tt)('（新增）')), 1),
          (form['单据状态'])
            ? (openBlock(), createBlock(_component_el_tag, {
                key: 0,
                size: "small",
                type: statusTag(form['单据状态']),
                class: normalizeClass({ 'st-done': form['单据状态'] === '已完成' })
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)(form['单据状态'])), 1)
                ]),
                _: 1
              }, 8, ["type", "class"]))
            : createCommentVNode("", true)
        ])
      ]),
      withDirectives((openBlock(), createElementBlock("div", _hoisted_12, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(visibleFormMeta.value, (r) => {
          return (openBlock(), createElementBlock("div", {
            key: r.code,
            class: "field"
          }, [
            createBaseVNode("label", {
              title: unref(tt)(r.name)
            }, [
              createTextVNode(toDisplayString(unref(tt)(r.name)), 1),
              (r.isNotNull)
                ? (openBlock(), createElementBlock("span", _hoisted_14, "*"))
                : createCommentVNode("", true)
            ], 8, _hoisted_13),
            (isText(r))
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: form[r.code],
                  "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                  disabled: !editable.value || fieldLocked(r),
                  placeholder: unref(tt)(r.name)
                }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled", "placeholder"]))
              : (isNumber(r))
                ? (openBlock(), createBlock(_component_el_input_number, {
                    key: 1,
                    modelValue: form[r.code],
                    "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                    disabled: !editable.value || fieldLocked(r),
                    controls: false,
                    style: {"width":"100%"}
                  }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                : createCommentVNode("", true),
            (isRef(r) && refModeMap[r.code] === 'select')
              ? (openBlock(), createBlock(_component_el_select, {
                  key: 2,
                  modelValue: form[r.code],
                  "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                  clearable: "",
                  filterable: "",
                  remote: "",
                  "allow-create": "",
                  "default-first-option": "",
                  disabled: !editable.value || fieldLocked(r),
                  "remote-method": (kw) => loadRefOptions(r, kw),
                  loading: refSelectData[r.code]?.loading,
                  placeholder: unref(tt)('输入搜索'),
                  style: {"width":"100%"},
                  onFocus: $event => (checkRefMode(r)),
                  onChange: (v) => onRefSelectChange(r, v)
                }, {
                  default: withCtx(() => [
                    (openBlock(true), createElementBlock(Fragment, null, renderList((refSelectData[r.code]?.options || []), (o) => {
                      return (openBlock(), createBlock(_component_el_option, {
                        key: o.value,
                        label: unref(refShowsCode)(r) ? o.value : o.label,
                        value: o.value
                      }, null, 8, ["label", "value"]))
                    }), 128))
                  ]),
                  _: 2
                }, 1032, ["modelValue", "onUpdate:modelValue", "disabled", "remote-method", "loading", "placeholder", "onFocus", "onChange"]))
              : (isRef(r))
                ? (openBlock(), createElementBlock("div", _hoisted_15, [
                    createVNode(_component_el_input, {
                      "model-value": refText(r, form[r.code]),
                      readonly: "",
                      disabled: !editable.value || fieldLocked(r),
                      placeholder: isEdit.value ? '' : unref(tt)('点击选择'),
                      onClick: $event => (openRefPick(r))
                    }, null, 8, ["model-value", "disabled", "placeholder", "onClick"]),
                    (editable.value && !fieldLocked(r))
                      ? (openBlock(), createBlock(_component_el_button, {
                          key: 0,
                          class: "ref-btn",
                          size: "small",
                          icon: unref(search_default),
                          onClick: $event => (openRefPick(r))
                        }, null, 8, ["icon", "onClick"]))
                      : createCommentVNode("", true)
                  ]))
                : (isSelect(r) && dictModeOf(r) === 'dialog')
                  ? (openBlock(), createElementBlock("div", _hoisted_16, [
                      createVNode(_component_el_input, {
                        "model-value": form[r.code],
                        readonly: "",
                        disabled: !editable.value || fieldLocked(r),
                        placeholder: unref(tt)('请选择'),
                        onClick: $event => (openDictPick(r))
                      }, null, 8, ["model-value", "disabled", "placeholder", "onClick"]),
                      (editable.value && !fieldLocked(r))
                        ? (openBlock(), createBlock(_component_el_button, {
                            key: 0,
                            class: "ref-btn",
                            size: "small",
                            icon: unref(search_default),
                            onClick: $event => (openDictPick(r))
                          }, null, 8, ["icon", "onClick"]))
                        : createCommentVNode("", true)
                    ]))
                  : (isSelect(r))
                    ? (openBlock(), createBlock(_component_el_select, {
                        key: 5,
                        modelValue: form[r.code],
                        "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                        disabled: !editable.value || fieldLocked(r),
                        filterable: "",
                        clearable: "",
                        "allow-create": "",
                        style: {"width":"100%"}
                      }, {
                        default: withCtx(() => [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(r.options || [], (o) => {
                            return (openBlock(), createBlock(_component_el_option, {
                              key: o,
                              label: o.label ?? o,
                              value: o.value ?? o
                            }, null, 8, ["label", "value"]))
                          }), 128))
                        ]),
                        _: 2
                      }, 1032, ["modelValue", "onUpdate:modelValue", "disabled"]))
                    : (isDate(r))
                      ? (openBlock(), createBlock(_component_el_date_picker, {
                          key: 6,
                          modelValue: form[r.code],
                          "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                          disabled: !editable.value || fieldLocked(r),
                          type: "date",
                          "value-format": "YYYY-MM-DD",
                          style: {"width":"100%"}
                        }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                      : (isBool(r))
                        ? (openBlock(), createBlock(_component_el_switch, {
                            key: 7,
                            modelValue: form[r.code],
                            "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                            disabled: !editable.value || fieldLocked(r)
                          }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                        : (openBlock(), createBlock(_component_el_input, {
                            key: 8,
                            modelValue: form[r.code],
                            "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                            disabled: !editable.value || fieldLocked(r),
                            placeholder: r.name
                          }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled", "placeholder"]))
          ]))
        }), 128))
      ])), [
        [_directive_loading, loading.value]
      ]),
      (visibleAttachMeta.value.length && (form['单据编号'] || form['编号']))
        ? (openBlock(), createElementBlock("div", _hoisted_17, [
            createBaseVNode("span", _hoisted_18, toDisplayString(unref(tt)('附件')), 1),
            createBaseVNode("div", _hoisted_19, [
              createVNode(FileAttachCell, {
                "panel-code": panelCode.value,
                "doc-no": form['单据编号'] || form['编号'] || '',
                slots: attachKeys.value,
                values: attachValues.value,
                "can-edit": attachEditable.value,
                onChange: applyAttachSlots
              }, null, 8, ["panel-code", "doc-no", "slots", "values", "can-edit"])
            ])
          ]))
        : createCommentVNode("", true),
      (tabs.value.length)
        ? (openBlock(), createElementBlock("div", _hoisted_20, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(tabs.value, (tab, ti) => {
              return (openBlock(), createElementBlock("div", {
                key: tab.key,
                class: "detail-block"
              }, [
                createBaseVNode("div", _hoisted_21, [
                  createBaseVNode("div", _hoisted_22, [
                    createBaseVNode("span", {
                      class: normalizeClass(["dt-tab", { on: (subActive[tab.key] || 'detail') === 'detail' }]),
                      onClick: $event => (subActive[tab.key] = 'detail')
                    }, [
                      createTextVNode(toDisplayString(tab.label), 1),
                      (tab.isRequired)
                        ? (openBlock(), createElementBlock("span", _hoisted_24, "*"))
                        : createCommentVNode("", true)
                    ], 10, _hoisted_23),
                    (tab.summaryItems && tab.summaryItems.length)
                      ? (openBlock(), createElementBlock("span", {
                          key: 0,
                          class: normalizeClass(["dt-tab", { on: subActive[tab.key] === 'summary' }]),
                          onClick: $event => (subActive[tab.key] = 'summary')
                        }, toDisplayString(tab.label) + "汇总", 11, _hoisted_25))
                      : createCommentVNode("", true)
                  ]),
                  createBaseVNode("div", _hoisted_26, [
                    (editable.value)
                      ? (openBlock(), createBlock(_component_el_button, {
                          key: 0,
                          type: "primary",
                          icon: unref(plus_default),
                          onClick: $event => (addDetailRow(tab)),
                          class: "add-data-btn"
                        }, {
                          default: withCtx(() => [
                            createTextVNode(toDisplayString(unref(tt)('新增数据')), 1)
                          ]),
                          _: 1
                        }, 8, ["icon", "onClick"]))
                      : createCommentVNode("", true),
                    (ti === 0)
                      ? (openBlock(), createElementBlock("span", _hoisted_27, toDisplayString(unref(tt)('Ctrl+V列粘贴')), 1))
                      : createCommentVNode("", true),
                    createBaseVNode("span", _hoisted_28, toDisplayString(unref(tt)('定位')), 1),
                    createBaseVNode("span", _hoisted_29, toDisplayString(unref(tt)('复制到剪贴板')), 1),
                    createBaseVNode("span", _hoisted_30, toDisplayString(unref(tt)('从剪贴板粘贴')), 1),
                    createBaseVNode("span", _hoisted_31, toDisplayString(unref(tt)('另存为EXCEL模板')), 1),
                    createBaseVNode("span", _hoisted_32, toDisplayString(unref(tt)('批量修改')), 1),
                    (ti === 0)
                      ? (openBlock(), createElementBlock("span", _hoisted_33, toDisplayString(unref(tt)('销售订单查询')), 1))
                      : createCommentVNode("", true),
                    createBaseVNode("span", _hoisted_34, toDisplayString(unref(tt)('存货中心')), 1),
                    (visibleFields(tab).some((field) => field.dataName === '现存量'))
                      ? (openBlock(), createElementBlock("span", {
                          key: 3,
                          class: "dt-ic",
                          onClick: $event => (refreshTabCurrentStock(tab))
                        }, toDisplayString(unref(tt)('现存量提取')), 9, _hoisted_35))
                      : createCommentVNode("", true),
                    createBaseVNode("span", _hoisted_36, toDisplayString(unref(tt)('更多')), 1),
                    (tab.key === 'materials' && selectedProduct.value)
                      ? (openBlock(), createElementBlock("span", _hoisted_37, toDisplayString(unref(tt)('当前产品：')) + toDisplayString(selectedProduct.value) + " " + toDisplayString(unref(tt)('的 BOM 子件')), 1))
                      : createCommentVNode("", true),
                    createBaseVNode("span", _hoisted_38, toDisplayString(tabHint(tab)), 1)
                  ])
                ]),
                ((subActive[tab.key] || 'detail') === 'detail')
                  ? (openBlock(), createBlock(_component_el_table, {
                      key: 0,
                      data: tabData(tab),
                      size: "small",
                      border: "",
                      "show-summary": true,
                      "summary-method": (p) => summarize(p, tab),
                      height: "380",
                      "row-class-name": (o) => (tab.key === 'products' ? prodRowCls(o) : ''),
                      onClickCapture: (e) => onTableClickCapture(tab, e),
                      onRowClick: (row) => onRowClickDetail(tab, row)
                    }, {
                      default: withCtx(() => [
                        (tab.subTable)
                          ? (openBlock(), createBlock(_component_el_table_column, {
                              key: 0,
                              type: "expand",
                              width: "40"
                            }, {
                              default: withCtx(({ row }) => [
                                createBaseVNode("div", _hoisted_39, [
                                  createBaseVNode("div", _hoisted_40, [
                                    createBaseVNode("span", _hoisted_41, toDisplayString(tab.subTable.label), 1),
                                    (editable.value)
                                      ? (openBlock(), createBlock(_component_el_button, {
                                          key: 0,
                                          size: "small",
                                          icon: unref(plus_default),
                                          onClick: $event => (addSubRow(row, tab))
                                        }, {
                                          default: withCtx(() => [
                                            createTextVNode(toDisplayString(unref(tt)('增行')), 1)
                                          ]),
                                          _: 1
                                        }, 8, ["icon", "onClick"]))
                                      : createCommentVNode("", true)
                                  ]),
                                  createVNode(_component_el_table, {
                                    data: row['子表材料'] || [],
                                    size: "small",
                                    border: ""
                                  }, {
                                    default: withCtx(() => [
                                      createVNode(_component_el_table_column, {
                                        label: "序号",
                                        width: "50",
                                        align: "center"
                                      }, {
                                        default: withCtx(({ $index }) => [
                                          createTextVNode(toDisplayString($index + 1), 1)
                                        ]),
                                        _: 1
                                      }),
                                      (openBlock(true), createElementBlock(Fragment, null, renderList(tab.subTable.fields, (sr) => {
                                        return (openBlock(), createBlock(_component_el_table_column, {
                                          key: sr.dataName,
                                          label: sr.dataName,
                                          "min-width": "100"
                                        }, {
                                          default: withCtx(({ row: sr }) => [
                                            (sr.dataType === '下拉框' || sr.dataType === '标准库')
                                              ? (openBlock(), createBlock(_component_el_select, {
                                                  key: 0,
                                                  modelValue: sr[sr.dataName],
                                                  "onUpdate:modelValue": $event => ((sr[sr.dataName]) = $event),
                                                  disabled: !editable.value,
                                                  filterable: "",
                                                  "allow-create": "",
                                                  style: {"width":"100%"}
                                                }, {
                                                  default: withCtx(() => [
                                                    (openBlock(true), createElementBlock(Fragment, null, renderList(sr.options || [], (o) => {
                                                      return (openBlock(), createBlock(_component_el_option, {
                                                        key: o,
                                                        label: o,
                                                        value: o
                                                      }, null, 8, ["label", "value"]))
                                                    }), 128))
                                                  ]),
                                                  _: 2
                                                }, 1032, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                              : (sr.dataType === '小数' || sr.dataType === '整数')
                                                ? (openBlock(), createBlock(_component_el_input_number, {
                                                    key: 1,
                                                    modelValue: sr[sr.dataName],
                                                    "onUpdate:modelValue": $event => ((sr[sr.dataName]) = $event),
                                                    controls: false,
                                                    disabled: !editable.value,
                                                    style: {"width":"100%"}
                                                  }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                                : (openBlock(), createBlock(_component_el_input, {
                                                    key: 2,
                                                    modelValue: sr[sr.dataName],
                                                    "onUpdate:modelValue": $event => ((sr[sr.dataName]) = $event),
                                                    disabled: !editable.value
                                                  }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                          ]),
                                          _: 2
                                        }, 1032, ["label"]))
                                      }), 128)),
                                      (editable.value)
                                        ? (openBlock(), createBlock(_component_el_table_column, {
                                            key: 0,
                                            label: "操作",
                                            width: "50",
                                            align: "center"
                                          }, {
                                            default: withCtx(({ $index }) => [
                                              createVNode(_component_el_icon, {
                                                class: "del",
                                                onClick: $event => (row['子表材料'].splice($index, 1))
                                              }, {
                                                default: withCtx(() => [
                                                  createVNode(unref(delete_default))
                                                ]),
                                                _: 1
                                              }, 8, ["onClick"])
                                            ]),
                                            _: 2
                                          }, 1024))
                                        : createCommentVNode("", true)
                                    ]),
                                    _: 2
                                  }, 1032, ["data"])
                                ])
                              ]),
                              _: 2
                            }, 1024))
                          : createCommentVNode("", true),
                        createVNode(_component_el_table_column, {
                          label: "序号",
                          width: "50",
                          align: "center",
                          fixed: "left"
                        }, {
                          default: withCtx(({ $index }) => [
                            createTextVNode(toDisplayString($index + 1), 1)
                          ]),
                          _: 1
                        }),
                        (openBlock(true), createElementBlock(Fragment, null, renderList(visibleFields(tab), (dr) => {
                          return (openBlock(), createBlock(_component_el_table_column, {
                            key: dr.dataName,
                            label: dr.dataName,
                            "min-width": "110",
                            "class-name": dr.computed ? 'computed-col' : ''
                          }, {
                            default: withCtx(({ row }) => [
                              (dr.dataType === '参照')
                                ? (openBlock(), createElementBlock("span", {
                                    key: 0,
                                    class: normalizeClass(["ref-cell", { disabled: !detailRefEnabled(dr), 'dblclick-ref': detailRefTrigger(dr) === 'dblclick' }]),
                                    title: detailRefTrigger(dr) === 'dblclick' && detailRefEnabled(dr) ? '双击选择存货' : '',
                                    onClick: $event => (openDetailRef(dr, row, tab, 'click')),
                                    onDblclick: withModifiers($event => (openDetailRef(dr, row, tab, 'dblclick')), ["stop"])
                                  }, toDisplayString(drRefText(dr, row)), 43, _hoisted_42))
                                : (dr.dataType === '下拉框')
                                  ? (openBlock(), createBlock(_component_el_select, {
                                      key: 1,
                                      modelValue: row[dr.dataName],
                                      "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                      disabled: !editable.value || dr.computed,
                                      filterable: "",
                                      "allow-create": "",
                                      style: {"width":"100%"},
                                      onChange: $event => (onDetailChange(dr, row, tab))
                                    }, {
                                      default: withCtx(() => [
                                        (openBlock(true), createElementBlock(Fragment, null, renderList(dr.options || [], (o) => {
                                          return (openBlock(), createBlock(_component_el_option, {
                                            key: o,
                                            label: o.label ?? o,
                                            value: o.value ?? o
                                          }, null, 8, ["label", "value"]))
                                        }), 128))
                                      ]),
                                      _: 2
                                    }, 1032, ["modelValue", "onUpdate:modelValue", "disabled", "onChange"]))
                                  : (dr.dataType === '标准库')
                                    ? (openBlock(), createElementBlock("span", _hoisted_43, [
                                        createVNode(_component_el_select, {
                                          modelValue: row[dr.dataName],
                                          "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                          disabled: !editable.value || dr.computed,
                                          filterable: "",
                                          "allow-create": "",
                                          style: {"width":"100%"},
                                          onChange: $event => (onDetailChange(dr, row, tab))
                                        }, {
                                          default: withCtx(() => [
                                            (openBlock(true), createElementBlock(Fragment, null, renderList(dr.options || [], (o) => {
                                              return (openBlock(), createBlock(_component_el_option, {
                                                key: o,
                                                label: o,
                                                value: o
                                              }, null, 8, ["label", "value"]))
                                            }), 128))
                                          ]),
                                          _: 2
                                        }, 1032, ["modelValue", "onUpdate:modelValue", "disabled", "onChange"]),
                                        (dr.stdLib)
                                          ? (openBlock(), createElementBlock("span", {
                                              key: 0,
                                              class: "rsp-lib-pick",
                                              title: unref(tt)('标准库'),
                                              onClick: withModifiers($event => (openStdLib(dr, row)), ["stop"])
                                            }, "⌄", 8, _hoisted_44))
                                          : createCommentVNode("", true)
                                      ]))
                                    : (dr.dataType === '是否')
                                      ? (openBlock(), createBlock(_component_el_switch, {
                                          key: 3,
                                          modelValue: row[dr.dataName],
                                          "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                          disabled: !editable.value || dr.computed
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                      : (dr.dataType === '图片')
                                        ? (openBlock(), createBlock(_component_el_image, {
                                            key: 4,
                                            src: row[dr.dataName] || '',
                                            fit: "contain",
                                            style: {"width":"34px","height":"34px"}
                                          }, {
                                            error: withCtx(() => [...(_cache[15] || (_cache[15] = [
                                              createBaseVNode("span", { class: "img-ph" }, "图", -1)
                                            ]))]),
                                            _: 1
                                          }, 8, ["src"]))
                                        : (dr.dataType === '小数' || dr.dataType === '整数')
                                          ? (openBlock(), createBlock(_component_el_input_number, {
                                              key: 5,
                                              modelValue: row[dr.dataName],
                                              "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                              controls: false,
                                              disabled: !editable.value || dr.computed,
                                              style: {"width":"100%"}
                                            }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                          : (dr.dataType === '日期')
                                            ? (openBlock(), createBlock(_component_el_date_picker, {
                                                key: 6,
                                                modelValue: row[dr.dataName],
                                                "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                                type: "date",
                                                "value-format": "YYYY-MM-DD",
                                                disabled: !editable.value || dr.computed,
                                                style: {"width":"100%"}
                                              }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                            : (openBlock(), createBlock(_component_el_input, {
                                                key: 7,
                                                modelValue: row[dr.dataName],
                                                "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                                disabled: !editable.value || dr.computed
                                              }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                            ]),
                            _: 2
                          }, 1032, ["label", "class-name"]))
                        }), 128)),
                        (editable.value)
                          ? (openBlock(), createBlock(_component_el_table_column, {
                              key: 1,
                              label: "操作",
                              width: "50",
                              align: "center",
                              fixed: "right"
                            }, {
                              default: withCtx(({ $index }) => [
                                createVNode(_component_el_icon, {
                                  class: "del",
                                  onClick: $event => (detailData[tab.key].splice($index, 1))
                                }, {
                                  default: withCtx(() => [
                                    createVNode(unref(delete_default))
                                  ]),
                                  _: 1
                                }, 8, ["onClick"])
                              ]),
                              _: 2
                            }, 1024))
                          : createCommentVNode("", true)
                      ]),
                      _: 2
                    }, 1032, ["data", "summary-method", "row-class-name", "onClickCapture", "onRowClick"]))
                  : (openBlock(), createBlock(_component_el_table, {
                      key: 1,
                      data: summaryRows(tab),
                      size: "small",
                      border: ""
                    }, {
                      default: withCtx(() => [
                        createVNode(_component_el_table_column, {
                          prop: "label",
                          label: "汇总项目",
                          "min-width": "220"
                        }),
                        createVNode(_component_el_table_column, {
                          prop: "value",
                          label: "数值",
                          "min-width": "160",
                          align: "right"
                        })
                      ]),
                      _: 1
                    }, 8, ["data"])),
                (ti < tabs.value.length - 1)
                  ? (openBlock(), createElementBlock("div", _hoisted_45))
                  : createCommentVNode("", true)
              ]))
            }), 128))
          ]))
        : createCommentVNode("", true),
      createBaseVNode("div", _hoisted_46, [
        _cache[16] || (_cache[16] = createBaseVNode("label", null, "备注", -1)),
        createVNode(_component_el_input, {
          modelValue: form['备注'],
          "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((form['备注']) = $event)),
          disabled: !editable.value,
          style: {"width":"100%"}
        }, null, 8, ["modelValue", "disabled"])
      ]),
      _cache[18] || (_cache[18] = createBaseVNode("div", { class: "footer-hr" }, null, -1)),
      createBaseVNode("div", _hoisted_47, [
        createBaseVNode("span", null, "制单人：" + toDisplayString(form['发起人编号'] || '-'), 1),
        createBaseVNode("span", null, "审核人：" + toDisplayString(form['审核人'] || '-'), 1),
        createBaseVNode("span", null, "审核日期：" + toDisplayString(rmtTime(form['审核日期'])), 1),
        createBaseVNode("span", null, "审核时间：" + toDisplayString(rmtTime(form['审核时间'])), 1),
        createBaseVNode("span", null, "打印次数：" + toDisplayString(form['打印次数'] ?? 0), 1),
        createBaseVNode("span", null, "创建时间：" + toDisplayString(rmtTime(form['创建时间'])), 1),
        createBaseVNode("span", null, "修改时间：" + toDisplayString(rmtTime(form['更新时间'])), 1),
        createBaseVNode("span", null, "变更人：" + toDisplayString(form['变更人'] || '-'), 1),
        createBaseVNode("span", null, "变更日期：" + toDisplayString(rmtTime(form['变更日期'])), 1),
        createBaseVNode("span", null, "审核机器人：" + toDisplayString(form['审核机器人'] || '-'), 1),
        createBaseVNode("span", null, "审核意见：" + toDisplayString(form['审核意见'] || '-'), 1)
      ]),
      createVNode(_component_el_dialog, {
        modelValue: selectVisible.value,
        "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((selectVisible).value = $event)),
        title: selectCrg.value?.title || '选单',
        width: "920px",
        "append-to-body": ""
      }, {
        footer: withCtx(() => [
          createVNode(_component_el_button, {
            onClick: _cache[3] || (_cache[3] = $event => (selectVisible.value = false))
          }, {
            default: withCtx(() => [...(_cache[17] || (_cache[17] = [
              createTextVNode("取消", -1)
            ]))]),
            _: 1
          }),
          createVNode(_component_el_button, {
            type: "primary",
            disabled: !selectRows.value.length,
            onClick: confirmSelect
          }, {
            default: withCtx(() => [
              createTextVNode(" 确定生单（" + toDisplayString(selectRows.value.length) + " 行） ", 1)
            ]),
            _: 1
          }, 8, ["disabled"])
        ]),
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_48, toDisplayString(selectCrg.value?.tip || '选择来源单据，明细将带入当前单据'), 1),
          withDirectives((openBlock(), createBlock(_component_el_table, {
            data: selectList.value,
            size: "small",
            border: "",
            height: "360",
            onSelectionChange: _cache[2] || (_cache[2] = (r) => (selectRows.value = r))
          }, {
            default: withCtx(() => [
              createVNode(_component_el_table_column, {
                type: "selection",
                width: "45"
              }),
              (openBlock(true), createElementBlock(Fragment, null, renderList(selectCols.value, (c) => {
                return (openBlock(), createBlock(_component_el_table_column, {
                  key: c,
                  prop: c,
                  label: c,
                  width: ['单据编号', '单据日期', '客户', '预完工日', '预计交货日期'].includes(c) ? 120 : undefined,
                  "min-width": ['存货名称', '产品名称'].includes(c) ? 200 : undefined
                }, null, 8, ["prop", "label", "width", "min-width"]))
              }), 128)),
              createVNode(_component_el_table_column, {
                label: "明细行",
                "min-width": "240"
              }, {
                default: withCtx(({ row }) => [
                  createBaseVNode("span", _hoisted_49, toDisplayString(row['存货名称'] || row['产品名称'] || '') + " × " + toDisplayString(row['数量']) + toDisplayString(row['销售单位'] || row['生产单位'] || '') + "（" + toDisplayString(row['存货编码'] || row['产品编码'] || '') + "）", 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, ["data"])), [
            [_directive_loading, selectLoading.value]
          ])
        ]),
        _: 1
      }, 8, ["modelValue", "title"])
    ]),
    createVNode(RefPickDialog, {
      modelValue: refVisible.value,
      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((refVisible).value = $event)),
      field: refPick.value?.field,
      mode: refPick.value?.mode,
      onConfirm: onRefConfirm
    }, null, 8, ["modelValue", "field", "mode"]),
    createVNode(_component_el_dialog, {
      modelValue: dictPickVisible.value,
      "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((dictPickVisible).value = $event)),
      title: unref(tt)('选择') + '：' + (dictPickField.value ? unref(tt)(dictPickField.value.name) : ''),
      width: "440px",
      "append-to-body": "",
      "close-on-click-modal": false
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, { onClick: clearDictPick }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('清空')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: _cache[7] || (_cache[7] = $event => (dictPickVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createVNode(_component_el_input, {
          modelValue: dictPickKeyword.value,
          "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((dictPickKeyword).value = $event)),
          placeholder: unref(tt)('输入搜索'),
          clearable: "",
          class: "dict-pick-search"
        }, null, 8, ["modelValue", "placeholder"]),
        createBaseVNode("div", _hoisted_50, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(dictPickOptions.value, (o, i) => {
            return (openBlock(), createElementBlock("div", {
              key: i,
              class: "dict-pick-item",
              onClick: $event => (onDictPick(o))
            }, toDisplayString(o.label), 9, _hoisted_51))
          }), 128)),
          (!dictPickOptions.value.length)
            ? (openBlock(), createBlock(_component_el_empty, {
                key: 0,
                description: unref(tt)('暂无数据'),
                "image-size": 50
              }, null, 8, ["description"]))
            : createCommentVNode("", true)
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(ApprovalHistoryDialog, {
      modelValue: approvalVisible.value,
      "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((approvalVisible).value = $event)),
      panelCode: panelCode.value,
      formNo: approvalNo.value
    }, null, 8, ["modelValue", "panelCode", "formNo"]),
    createVNode(SelectVoucherDialog, {
      modelValue: selVisible.value,
      "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((selVisible).value = $event)),
      panelCode: panelCode.value,
      config: selCfg.value,
      onGenerated: onSelGenerated
    }, null, 8, ["modelValue", "panelCode", "config"]),
    createVNode(ImportDialog, {
      modelValue: impVisible.value,
      "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((impVisible).value = $event)),
      fields: impFields.value,
      "target-label": impLabel.value,
      onImported: onImported
    }, null, 8, ["modelValue", "fields", "target-label"]),
    createVNode(ScanFillDialog, {
      modelValue: scanVisible.value,
      "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => ((scanVisible).value = $event)),
      "panel-code": panelCode.value,
      "panel-name": payloadCache.value?.panelName || panelCode.value,
      "header-fields": visibleFormMeta.value,
      "detail-tabs": tabs.value,
      onApply: onScanApply
    }, null, 8, ["modelValue", "panel-code", "panel-name", "header-fields", "detail-tabs"]),
    createVNode(_component_el_dialog, {
      modelValue: stdLibVisible.value,
      "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((stdLibVisible).value = $event)),
      title: unref(tt)('标准库') + (stdLibCode.value ? '：' + stdLibCode.value : ''),
      width: "720px",
      "append-to-body": ""
    }, {
      default: withCtx(() => [
        createVNode(StdLibManager, {
          lib: stdLibCode.value,
          "add-item": stdLibItem.value,
          pickable: "",
          onPick: onStdLibPick,
          onChanged: refreshStdLibOptions
        }, null, 8, ["lib", "add-item"])
      ]),
      _: 1
    }, 8, ["modelValue", "title"])
  ]))
}
}

};
const PanelxForm = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-6ef9326e"]]);

export { PanelxForm as default };
