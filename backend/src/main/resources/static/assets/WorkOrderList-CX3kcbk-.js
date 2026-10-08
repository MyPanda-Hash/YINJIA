import { z as ElDatePicker, i as ElInput, d as ElButton, l as ElMessageBox, k as ElMessage, L as ElDropdown, n as ElSelect, r as ElRadioGroup, j as ElTable, f as ElDialog, K as ElDropdownItem, o as ElOption, I as ElRadioButton, g as ElTableColumn, a1 as ElLink, h as ElInputNumber, D as ElCheckbox } from './element-plus-W84rT0en.js';
import { t as tt, r as request, c as useUserStore } from './index-CqmwEeWF.js';
/* empty css                   */
/* empty css                         */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                */
/* empty css                  */
/* empty css                         */
/* empty css                   */
/* empty css                          */
/* empty css                        */
import { q as onMounted, c as createElementBlock, a as createBaseVNode, $ as toDisplayString, A as unref, a0 as createVNode, aq as withKeys, W as withCtx, _ as createTextVNode, p as ref, f as computed, aE as useRouter, o as openBlock, J as Fragment, ae as renderList, P as createBlock, S as normalizeClass, Z as createCommentVNode } from './vue-vendor-DyX2BAKf.js';
import { f as printWorkTaskSheet } from './print-formats-CjwOqWEr.js';
import { W as WorkOrderTraceDialog } from './WorkOrderTraceDialog-Be9njRw6.js';
import ScheduleBoard from './ScheduleBoard-B5Sz9Fz8.js';
import { u as useTabsStore } from './tabs-DN15ZjeN.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import './element-icons-DOEvq9OG.js';
import './sumTotals-C3PClexH.js';
/* empty css                   */
/* empty css                  */
/* empty css                      */

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "wol-page" };
const _hoisted_2 = { class: "wol-query" };
const _hoisted_3 = { class: "wol-lb" };
const _hoisted_4 = {
  class: "wol-lb",
  style: {"margin-left":"12px"}
};
const _hoisted_5 = { class: "wol-count" };
const _hoisted_6 = { class: "wol-btns" };
const _hoisted_7 = { class: "wol-line" };
const _hoisted_8 = { class: "wol-lb" };
const _hoisted_9 = {
  class: "wol-lb",
  style: {"margin-left":"10px"}
};
const _hoisted_10 = {
  class: "wol-lb",
  style: {"margin-left":"auto"}
};
const _hoisted_11 = { key: 0 };
const _hoisted_12 = { key: 1 };
const _hoisted_13 = { style: {"height":"76vh","overflow":"hidden"} };
const _hoisted_14 = {
  key: 0,
  class: "wol-split"
};
const _hoisted_15 = { class: "wol-split-row" };
const _hoisted_16 = { class: "wol-split-row" };
const _hoisted_17 = { class: "wol-split-row" };
const _hoisted_18 = { class: "wol-split-row" };
const _hoisted_19 = { class: "wol-split-row" };
const _hoisted_20 = { class: "wol-split-row" };
const _hoisted_21 = { class: "wol-split-row" };
const _hoisted_22 = { class: "wol-split-row hl" };
const _hoisted_23 = { class: "wol-split-row" };
const _hoisted_24 = { class: "wol-split-tip" };

const _sfc_main = {
  __name: 'WorkOrderList',
  setup(__props) {

const router = useRouter();
const tabs = useTabsStore();

const rows = ref([]);
const checked = ref([]);
const currentRow = ref(null);
/** 表格引用:刷新后清勾选用(2026-10-05 修「撤回切单后卡在请先勾选」的 bug) */
const tableRef = ref(null);
const lines = ref([]);
const lineFilter = ref('');
const lineCode = ref('');
const stateFilter = ref('');
/**
 * 默认取数窗口 = 最近 15 天(2026-10-05 用户口径:单据一多就卡,默认不拉全量)。
 * 进页面时预填「今天-14 ~ 今天」(含今天共 15 天);**清空两个日期即查全量**。
 * 注意:日期串按本机时区拼(不用 toISOString —— UTC 下东八区 00:00~08:00 会退一天)。
 */
const dateFrom = ref('');
const dateTo = ref('');
const qText = ref('');
// 切单(9.29 批次①):弹窗状态 + 预览(可切上限)
const splitVisible = ref(false);
const splitLoading = ref(false);
const splitInfo = ref(null);
const splitQty = ref(0);
const splitInherit = ref(true);
/** 工单详情·追溯(2026-10-05):与工单排产同一组件,本页原地打开 */
const traceVisible = ref(false);
const traceNo = ref('');
/** 工单排产弹窗(2026-10-05 用户口径):只带当前这一张工单的快速排产 */
const schedVisible = ref(false);
const schedNo = ref('');
function openSchedule() {
  const r = (checked.value.length === 1 ? checked.value[0] : currentRow.value) || checked.value[0];
  if (!r) { ElMessage.warning(tt('请先勾选一张工单')); return }
  if (r['生产线']) { ElMessage.warning(`${tt('该工单已排产')}(${r['生产线']})，${tt('不能重复排入;换线请先撤销排产')}`); return }
  schedNo.value = r['工单号'];
  schedVisible.value = true;
}

const filtered = computed(() => rows.value.filter((r) => {
  if (stateFilter.value === '未完工' && r.生产状态 === '完工') return false
  if (stateFilter.value === '已完工' && r.生产状态 !== '完工') return false
  return true
}));
const paged = computed(() => filtered.value);

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
function err(e, f) { ElMessage.error(e?.response?.data?.message || tt(f)); }

async function load() {  try {
    const cond = {};
    if (dateFrom.value) cond['日期从'] = dateFrom.value;
    if (dateTo.value) cond['日期到'] = dateTo.value;
    if (qText.value.trim()) cond['keyword'] = qText.value.trim();
    if (lineFilter.value) cond['生产线'] = lineFilter.value;
    const res = await request.post('/px/workOrderList', cond);
    rows.value = (res.data || []).map((r) => ({ ...r, rowKey: String(r.行id ?? (r.工单号 + '#' + r.工单行号)) }));
    // 2026-10-05 修复:刷新后清掉旧勾选 —— reserve-selection 会保留"已从列表消失的行"的勾选(且无法手动取消),
    // 造成切单/撤回切单永久提示「请先勾选一张工单」。
    checked.value = [];
    currentRow.value = null;
    tableRef.value?.clearSelection?.();
    applyLineMeta();
  } catch (e) { err(e, '查询失败'); }
}

async function loadLines() {
  try {
    const res = await request.post('/px/scheduleBoard/linesSummary', { 开工日期: new Date().toISOString().slice(0, 10) });
    lines.value = [...new Map((res.data || []).map((x) => [x['生产线'], { v: x['生产线'], t: x['生产线'] + (x['生产车间'] ? '·' + x['生产车间'] : '') }])).values()];
  } catch { /* 不阻断 */ }
}

function applyLineMeta() {
  lines.value.map((x) => x.v);
  for (const r of rows.value) if (!r.生产线) r.生产线 = '';
  lineCode.value = lineFilter.value ? (lines.value.find((x) => x.v === lineFilter.value)?.t.split('·')[1] || '') : '';
}

// 排产写入口已撤(2026-09-28 用户拍板):生产工单=纯汇总视图,数据只由订单结转产生;
// 排产/改数量/换线 → 一律走「快速排产」唯一入口(/px/scheduleBoard/assign)。

async function onClose(close) {
  const nos = [...new Set(checked.value.map((r) => r.工单号))];
  if (!nos.length) return
  try {
    await ElMessageBox.confirm(
      `${tt('确认')} ${close ? tt('结案') : tt('取消结案')} ${nos.length} ${tt('张工单')}?`,
      tt(close ? '结案' : '取消结案'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') });
  } catch { return }
  try {
    const res = await request.post('/px/workOrderList/close', {
      结案: close,
      rows: checked.value.map((r) => ({ 公司代码: r.公司代码, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号 })),
    });
    if (res.status === 200) { ElMessage.success(tt('操作成功')); load(); }
  } catch (e) { err(e, '操作失败'); }
}

/**
 * 打印工单(两模板可选,2026-09-27):勾选行直打,打印留痕回写 plang。
 *   成型生产任务单/组装生产任务单 = 行表任务单(横版,列见截图版式)。
 * ⚠ 2026-10-14 「生产投料单」模板下线:它的物料行全部来自自建 BOM
 *   (/px/workOrderBom → bs_bom),随 MES 自建 BOM 功能整体删除,前端已无替代数据源。
 */
async function doPrintTask(mode) {
  const src = checked.value.length ? checked.value : (currentRow.value ? [currentRow.value] : []);
  if (!src.length) { ElMessage.warning(tt('请先勾选要打印的工单')); return }
  try {
    // 成型任务单的数量 = **按工艺路线换算后的成型工序量**(2026-10-05 用户口径:
    // 「成型打印的任务单就是需要根据换算进行的…不需要显示换算率,显示换算后的数量即可」)。
    // 换算因子 = 该工单成型工序的计划量 ÷ 工单计划合计(即累计换算率),再按**行**的排产数量摊算;
    // 取不到(未绑路线/无换算)时退回排产数量,不影响既有打印。
    const factor = {};
    if (mode === '成型生产任务单') {
      await Promise.all([...new Set(src.map((r) => r.工单号))].map(async (no) => {
        try {
          const d = (await request.post('/px/processTask/detail', { 工单号: no })).data || {};
          const total = Number(d['计划合计'] || 0);
          const st = (d['工序步骤'] || []).find((x) => x['工序'] === '成型');
          const q = Number(st?.['计划量'] || 0);
          if (total > 0 && q > 0) factor[no] = q / total;
        } catch { /* 取不到就退回排产数量 */ }
      }));
    }
    const rowsToPrint = src.map((r) => ({
      单据编号: r.工单号,
      公司代码: r.公司代码 || '', 工单行号: r.工单行号, // 工单二维码=公司代码@工单号@1000+工单行号(2026-10-09 规则改版)
      是否重点管控产品: r.重点管控 || '',
      商品编码: r.物料编码 || '',
      商品名称: r.产品名称 || '',
      规格型号: r.规格型号 || '',
      订单数量: r.需求数量,
      // 成型任务单:换算后的数量(出货口 = 该行排产数量 × 累计换算率,如 3 倍 → 80 变 240)
      成型折算后数量: factor[r.工单号] ? Math.round(Number(r.排产数量 || 0) * factor[r.工单号] * 10000) / 10000 : r.排产数量,
      计划完工日期: r.计划完工日期 || '',
      批号: r.批号 || '', 物料编码: r.物料编码 || '',
      排产数量: r.排产数量, 生产线: r.生产线 || lineFilter.value || '',
    }));
    const okPrint = await printWorkTaskSheet(mode, rowsToPrint, { line: lineFilter.value || '', preparedBy: useUserStore().realName });
    if (okPrint) {
      await request.post('/px/workOrderList/printStamp', {
        rows: src.map((r) => ({ 公司代码: r.公司代码, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号 })),
      });
    }
    load();
  } catch (e) { err(e, '打印失败'); }
}

/**
 * 转领料单(2026-10-07 用户拍板:原「打印领料单」改为转单,打印入口不再保留)。
 * 勾选工单 → 按**工单号去重**逐张生成「材料出库单(领料单)」草稿:单据头挂 加工单号=工单号
 * (审核出库后后端 ManuWritebackService 自动回写工单「领料单号」,本页该列随之点亮)。
 * ⚠ **明细留空**:MES 自建 BOM 已下架(2026-10-04),配方/工艺清单表全空、遗留 mate 是光缆旧数据,
 *   系统内没有可自动展开的材料来源 ⇒ 材料行由仓库在材料出库单面板按实发补填。
 * 后端守卫:未排产(排产数量 0)/已结案 不给转;已有未审核领料单或占用链未释放时拒绝(见 WorkOrderPickingService)。
 */
async function toPicking() {
  // 只认**当前列表里还在的**勾选行(表格开了 reserve-selection,已消失的行会留在 checked 里,同切单口径)
  const alive = (checked.value || []).filter((x) => rows.value.some((r) => String(r.行id) === String(x.行id)));
  if (!alive.length) { ElMessage.warning(tt('请先勾选一张工单')); return }
  const nos = [...new Set(alive.map((r) => r.工单号))];
  try {
    await ElMessageBox.confirm(
      `${tt('确认为选中的')} ${nos.length} ${tt('张工单转领料')}?`,
      tt('转领料单'),
      { confirmButtonText: tt('确认'), cancelButtonText: tt('取消'), type: 'warning' });
  } catch { return }
  try {
    const res = await request.post('/px/workOrderList/toPicking', {
      rows: alive.map((r) => ({ 公司代码: r.公司代码, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号 })),
    });
    const d = res.data || {};
    const list = d['单号清单'] || [];
    ElMessage.success(`${tt('已生成领料单')} ${list.join('、')}（${tt('材料明细请在材料出库单里补填,审核后自动回写工单领料单号')}）`);
    if ((d['失败行'] || []).length) ElMessage.warning(`${tt('未转成功')}：${d['失败行'].join('; ')}`);
    load();
    // 生成后可直接去材料出库单补材料明细(不强制:也可稍后自己进面板)
    try {
      await ElMessageBox.confirm(
        tt('领料单已生成,现在去「材料出库单」补材料明细吗?'),
        tt('转领料单'),
        { confirmButtonText: tt('去补明细'), cancelButtonText: tt('稍后'), type: 'success' });
    } catch { return }
    const path = '/panelx/list/MATERIAL_OUT';
    router.push(path);
    tabs.open({ path, title: '材料出库单' });
  } catch (e) { err(e, '转领料单失败'); }
}

/** 切单(9.29 批次①):勾选/当前行必须恰为一张工单 → 后端预览可切上限 → 弹窗输入切出数量 */
function splitTarget() {
  // 2026-10-05 修复「撤回切单后一直提示请勾选一个工单」:表格开了 reserve-selection,
  // 被撤回的子单行已从列表消失、但勾选状态仍留在 checked 里(且无法取消)→ checked.length≠1 永久卡死。
  // 口径:只认**当前列表里还在的**选中行(按 行id);没有则退回当前行(currentRow)。
  const alive = (checked.value || []).filter((x) => rows.value.some((r) => String(r.行id) === String(x.行id)));
  const cur = currentRow.value && rows.value.some((r) => String(r.行id) === String(currentRow.value.行id)) ? currentRow.value : null;
  const list = alive.length ? alive : (cur ? [cur] : []);
  if (list.length !== 1) {
    ElMessage.warning(list.length === 0 ? tt('请先勾选一张工单')
      : `${tt('请只勾选一张工单')}（${tt('当前已勾选')} ${list.length} ${tt('张')}）`);
    return null
  }
  return list[0]
}

async function openSplit() {
  const r = splitTarget();
  if (!r) return
  try {
    const res = await request.post('/px/workOrderList/splitPreview', {
      行id: r.行id, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号,
    });
    splitInfo.value = res.data || {};
    splitQty.value = 0;
    splitVisible.value = true;
  } catch (e) { err(e, '切单失败'); }
}

async function doSplit() {
  if (!splitInfo.value) return
  const q = Number(splitQty.value) || 0;
  if (q <= 0) { ElMessage.warning(tt('请输入切出数量')); return }
  try {
    await ElMessageBox.confirm(
      `${tt('确认从')} ${splitInfo.value['工单号']} ${tt('切出')} ${num(q)} ${tt('生成子工单')}?`,
      tt('切单'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') });
  } catch { return }
  splitLoading.value = true;
  try {
    const res = await request.post('/px/workOrderList/split', {
      行id: splitInfo.value['行id'], 工单号: splitInfo.value['工单号'], 工单行号: splitInfo.value['工单行号'],
      批次号: splitInfo.value['批次号'], 切出数量: q, 继承排产: splitInherit.value,
    });
    const d = res.data || {};
    splitVisible.value = false;
    ElMessage.success(`${tt('已生成子工单')} ${d['子工单号']}（${tt('切出')} ${num(d['切出数量'])}）`);
    load();
  } catch (e) { err(e, '切单失败'); } finally { splitLoading.value = false; }
}

/** 撤回切单:仅「切出来的子工单」可撤回;后端再校验无报工/入库/领料/结案/再切分 */
async function onUnsplit() {
  const r = splitTarget();
  if (!r) return
  if (!r.源工单号) { ElMessage.warning(tt('该工单不是切出的子工单,无需撤回')); return }
  try {
    await ElMessageBox.confirm(
      `${tt('撤回切单')} ${r.工单号}?${tt('将还原父工单')} ${r.源工单号} ${tt('的数量')}`,
      tt('撤回切单'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消'), type: 'warning' });
  } catch { return }
  try {
    const res = await request.post('/px/workOrderList/unsplit', { 行id: r.行id, 工单号: r.工单号 });
    const d = res.data || {};
    ElMessage.success(`${tt('已撤回')} ${d['子工单号']}，${tt('父工单')} ${d['父工单号']} ${tt('还原')} ${num(d['还原数量'])}`);
    load();
  } catch (e) { err(e, '撤回切单失败'); }
}

function openTrace(row) {
  // 工单详情·追溯(2026-10-05):与工单排产**同一个弹窗组件**,本页原地打开(用户口径「不是跳转到工单排产」)。
  const no = row?.['工单号'] || currentRow.value?.工单号 || checked.value[0]?.工单号;
  if (!no) return
  traceNo.value = no;
  traceVisible.value = true;
}

function exportCsv() {
  const head = ['公司代码', '工单号', '工单行号', '批次号', '单据日期', '转单时间', '物料编码', '产品名称', '规格型号', '客户', '生产线', '需求数量', '转单数量', '入库数量', '余量', '领料单号', '打印人', '打印时间', '生产状态', '结案'];
  const csv = '\ufeff' + [head.join(',')]
    .concat(filtered.value.map((r) => head.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `工单排产列表-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

/** 本机时区的 yyyy-MM-dd(偏移 n 天;n=0 为今天) */
function dayStr(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(() => {
  // 默认只取最近 15 天(可在日期框上清空 → 全量);已填过值(如热更重挂)不覆盖用户输入
  if (!dateFrom.value && !dateTo.value) {
    dateFrom.value = dayStr(-14);
    dateTo.value = dayStr(0);
  }
  load(); loadLines();
});

return (_ctx, _cache) => {
  const _component_el_date_picker = ElDatePicker;
  const _component_el_input = ElInput;
  const _component_el_button = ElButton;
  const _component_el_dropdown_item = ElDropdownItem;
  const _component_el_dropdown = ElDropdown;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_radio_button = ElRadioButton;
  const _component_el_radio_group = ElRadioGroup;
  const _component_el_table_column = ElTableColumn;
  const _component_el_link = ElLink;
  const _component_el_table = ElTable;
  const _component_el_dialog = ElDialog;
  const _component_el_input_number = ElInputNumber;
  const _component_el_checkbox = ElCheckbox;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    createBaseVNode("div", _hoisted_2, [
      createBaseVNode("span", _hoisted_3, toDisplayString(unref(tt)('日期范围')), 1),
      createVNode(_component_el_date_picker, {
        modelValue: dateFrom.value,
        "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((dateFrom).value = $event)),
        type: "date",
        "value-format": "YYYY-MM-DD",
        size: "small",
        style: {"width":"130px"}
      }, null, 8, ["modelValue"]),
      _cache[17] || (_cache[17] = createBaseVNode("span", { class: "wol-sep" }, "-", -1)),
      createVNode(_component_el_date_picker, {
        modelValue: dateTo.value,
        "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((dateTo).value = $event)),
        type: "date",
        "value-format": "YYYY-MM-DD",
        size: "small",
        style: {"width":"130px"}
      }, null, 8, ["modelValue"]),
      createBaseVNode("span", _hoisted_4, toDisplayString(unref(tt)('模糊搜索')), 1),
      createVNode(_component_el_input, {
        modelValue: qText.value,
        "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((qText).value = $event)),
        size: "small",
        style: {"width":"220px"},
        placeholder: unref(tt)('输入查询条件...'),
        clearable: "",
        onKeyup: withKeys(load, ["enter"])
      }, null, 8, ["modelValue", "placeholder"]),
      createVNode(_component_el_button, {
        size: "small",
        type: "success",
        onClick: load
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('查找')), 1)
        ]),
        _: 1
      }),
      createBaseVNode("span", _hoisted_5, [
        createTextVNode(toDisplayString(unref(tt)('共有数据')) + ": ", 1),
        createBaseVNode("b", null, toDisplayString(rows.value.length), 1),
        createTextVNode(" " + toDisplayString(unref(tt)('条')), 1)
      ])
    ]),
    createBaseVNode("div", _hoisted_6, [
      createVNode(_component_el_button, {
        size: "small",
        type: "success",
        plain: "",
        onClick: _cache[3] || (_cache[3] = $event => (onClose(true))),
        disabled: !checked.value.length
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('结案')), 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      createVNode(_component_el_button, {
        size: "small",
        type: "success",
        plain: "",
        onClick: _cache[4] || (_cache[4] = $event => (onClose(false))),
        disabled: !checked.value.length
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('取消结案')), 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      createVNode(_component_el_button, {
        size: "small",
        type: "warning",
        plain: "",
        onClick: openSplit,
        disabled: !checked.value.length && !currentRow.value
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('切单')), 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      createVNode(_component_el_button, {
        size: "small",
        type: "success",
        plain: "",
        disabled: (!checked.value.length && !currentRow.value) || Number((checked.value[0] || currentRow.value || {})['生产线'] ? 1 : 0) === 1,
        onClick: openSchedule
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('排产')), 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      createVNode(_component_el_button, {
        size: "small",
        plain: "",
        onClick: onUnsplit,
        disabled: !checked.value.length && !currentRow.value
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('撤回切单')), 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      createVNode(_component_el_dropdown, {
        "split-button": "",
        size: "small",
        type: "primary",
        onClick: _cache[5] || (_cache[5] = $event => (doPrintTask('成型生产任务单'))),
        onCommand: doPrintTask,
        disabled: !checked.value.length && !currentRow.value
      }, {
        dropdown: withCtx(() => [
          createVNode(_component_el_dropdown_item, { command: "成型生产任务单" }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('成型生产任务单')), 1)
            ]),
            _: 1
          }),
          createVNode(_component_el_dropdown_item, { command: "组装生产任务单" }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('组装生产任务单')), 1)
            ]),
            _: 1
          })
        ]),
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('打印工单')) + " ", 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      createVNode(_component_el_button, {
        size: "small",
        onClick: toPicking,
        disabled: !checked.value.length
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('转领料单')), 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      createVNode(_component_el_button, {
        size: "small",
        type: "primary",
        onClick: exportCsv
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('导出')), 1)
        ]),
        _: 1
      }),
      createVNode(_component_el_button, {
        size: "small",
        onClick: load
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('刷新')), 1)
        ]),
        _: 1
      })
    ]),
    createBaseVNode("div", _hoisted_7, [
      createBaseVNode("span", _hoisted_8, toDisplayString(unref(tt)('生产线')) + ":", 1),
      createVNode(_component_el_select, {
        modelValue: lineFilter.value,
        "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((lineFilter).value = $event)),
        size: "small",
        clearable: "",
        filterable: "",
        style: {"width":"170px"},
        placeholder: unref(tt)('全部产线'),
        onChange: load
      }, {
        default: withCtx(() => [
          (openBlock(true), createElementBlock(Fragment, null, renderList(lines.value, (l) => {
            return (openBlock(), createBlock(_component_el_option, {
              key: l.v,
              label: l.t,
              value: l.v
            }, null, 8, ["label", "value"]))
          }), 128))
        ]),
        _: 1
      }, 8, ["modelValue", "placeholder"]),
      createBaseVNode("span", _hoisted_9, toDisplayString(unref(tt)('产线代号')) + ":", 1),
      createVNode(_component_el_input, {
        modelValue: lineCode.value,
        "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((lineCode).value = $event)),
        size: "small",
        style: {"width":"120px"},
        readonly: ""
      }, null, 8, ["modelValue"]),
      createBaseVNode("span", _hoisted_10, toDisplayString(unref(tt)('筛选')) + ":", 1),
      createVNode(_component_el_radio_group, {
        modelValue: stateFilter.value,
        "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((stateFilter).value = $event)),
        size: "small",
        onChange: _ctx.applyFilter
      }, {
        default: withCtx(() => [
          createVNode(_component_el_radio_button, { value: "" }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('全部')), 1)
            ]),
            _: 1
          }),
          createVNode(_component_el_radio_button, { value: "未完工" }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('未完工')), 1)
            ]),
            _: 1
          }),
          createVNode(_component_el_radio_button, { value: "已完工" }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('已完工')), 1)
            ]),
            _: 1
          })
        ]),
        _: 1
      }, 8, ["modelValue", "onChange"]),
      createVNode(_component_el_button, {
        size: "small",
        plain: "",
        style: {"margin-left":"10px"},
        onClick: openTrace,
        disabled: !currentRow.value
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('追溯')), 1)
        ]),
        _: 1
      }, 8, ["disabled"])
    ]),
    createVNode(_component_el_table, {
      data: paged.value,
      border: "",
      size: "small",
      class: "wol-table",
      height: "100%",
      onSelectionChange: _cache[9] || (_cache[9] = (r) => (checked.value = r)),
      onCurrentChange: _cache[10] || (_cache[10] = (r) => (currentRow.value = r)),
      ref_key: "tableRef",
      ref: tableRef,
      "highlight-current-row": "",
      "row-key": "rowKey"
    }, {
      default: withCtx(() => [
        createVNode(_component_el_table_column, {
          type: "selection",
          width: "40",
          fixed: "left",
          "reserve-selection": ""
        }),
        createVNode(_component_el_table_column, {
          label: unref(tt)('公司代码'),
          prop: "公司代码",
          width: "90",
          "show-overflow-tooltip": ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('工单号'),
          prop: "加工单号",
          width: "150",
          sortable: "",
          "show-overflow-tooltip": ""
        }, {
          default: withCtx(({ row }) => [
            createVNode(_component_el_link, {
              type: "primary",
              underline: false,
              onClick: $event => (openTrace(row))
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(row['工单号']), 1)
              ]),
              _: 2
            }, 1032, ["onClick"])
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('工单行号'),
          prop: "行号",
          width: "90",
          sortable: ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('批次号'),
          prop: "批次号",
          width: "100",
          sortable: ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('源工单号'),
          prop: "源工单号",
          width: "140",
          "show-overflow-tooltip": ""
        }, {
          default: withCtx(({ row }) => [
            createTextVNode(toDisplayString(row.源工单号 || '-'), 1)
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('拆分序号'),
          prop: "拆分序号",
          width: "85",
          align: "right"
        }, {
          default: withCtx(({ row }) => [
            createTextVNode(toDisplayString(row.拆分序号 ?? '-'), 1)
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('工单日期'),
          prop: "单据日期",
          width: "100",
          sortable: ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('转单时间'),
          prop: "转单时间",
          width: "140",
          sortable: "",
          "show-overflow-tooltip": ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('物料编码'),
          prop: "物料编码",
          width: "130",
          "show-overflow-tooltip": ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('产品名称'),
          prop: "产品名称",
          "min-width": "180",
          "show-overflow-tooltip": ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('规格型号'),
          prop: "规格型号",
          "min-width": "160",
          "show-overflow-tooltip": ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('客户'),
          prop: "客户",
          "min-width": "120",
          "show-overflow-tooltip": ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('生产线'),
          prop: "生产线",
          width: "110",
          "show-overflow-tooltip": ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('需求数量'),
          prop: "需求数量",
          width: "100",
          align: "right",
          sortable: ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('转单数量'),
          prop: "排产数量",
          width: "95",
          align: "right"
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('入库数量'),
          prop: "入库数量",
          width: "90",
          align: "right"
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('余量'),
          prop: "余量",
          width: "90",
          align: "right"
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('领料单号'),
          prop: "领料单号",
          width: "150",
          "show-overflow-tooltip": ""
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('打印人'),
          prop: "打印人",
          width: "90"
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('打印时间'),
          prop: "打印时间",
          width: "140"
        }, null, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('当前工序'),
          width: "100",
          sortable: "",
          prop: "当前工序"
        }, {
          default: withCtx(({ row }) => [
            createBaseVNode("span", {
              class: normalizeClass({ 'wol-closed': row.当前工序 === '组装' })
            }, toDisplayString(row.当前工序 ? unref(tt)(row.当前工序) : '-'), 3)
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('工序进度'),
          width: "120",
          align: "right"
        }, {
          default: withCtx(({ row }) => [
            (row.当前工序)
              ? (openBlock(), createElementBlock("span", _hoisted_11, toDisplayString(num(row.当前工序完工量)) + "/" + toDisplayString(num(row.当前工序计划量)), 1))
              : (openBlock(), createElementBlock("span", _hoisted_12, "-"))
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('生产状态'),
          prop: "生产状态",
          width: "90",
          fixed: "right"
        }, {
          default: withCtx(({ row }) => [
            createBaseVNode("span", {
              class: normalizeClass({ 'wol-closed': row.生产状态 === '完工' })
            }, toDisplayString(unref(tt)(row.生产状态)), 3)
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('结案'),
          width: "70",
          fixed: "right"
        }, {
          default: withCtx(({ row }) => [
            createBaseVNode("span", {
              class: normalizeClass({ 'wol-closed': row.结案 === 'Y' })
            }, toDisplayString(row.结案 === 'Y' ? unref(tt)('已结案') : '-'), 3)
          ]),
          _: 1
        }, 8, ["label"])
      ]),
      _: 1
    }, 8, ["data"]),
    createVNode(_component_el_dialog, {
      modelValue: schedVisible.value,
      "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((schedVisible).value = $event)),
      title: unref(tt)('工单排产（快速排产）'),
      width: "94%",
      top: "4vh",
      "append-to-body": "",
      "destroy-on-close": "",
      onClosed: load
    }, {
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_13, [
          createVNode(ScheduleBoard, {
            工单号: schedNo.value,
            embedded: ""
          }, null, 8, ["工单号"])
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(WorkOrderTraceDialog, {
      modelValue: traceVisible.value,
      "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => ((traceVisible).value = $event)),
      code: traceNo.value
    }, null, 8, ["modelValue", "code"]),
    createVNode(_component_el_dialog, {
      modelValue: splitVisible.value,
      "onUpdate:modelValue": _cache[16] || (_cache[16] = $event => ((splitVisible).value = $event)),
      title: unref(tt)('切单'),
      width: "440px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[15] || (_cache[15] = $event => (splitVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: splitLoading.value,
          onClick: doSplit
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('确认切单')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        (splitInfo.value)
          ? (openBlock(), createElementBlock("div", _hoisted_14, [
              createBaseVNode("div", _hoisted_15, [
                createBaseVNode("span", null, toDisplayString(unref(tt)('工单号')), 1),
                createBaseVNode("b", null, toDisplayString(splitInfo.value['工单号']) + "#" + toDisplayString(splitInfo.value['工单行号']), 1)
              ]),
              createBaseVNode("div", _hoisted_16, [
                createBaseVNode("span", null, toDisplayString(unref(tt)('产品名称')), 1),
                createBaseVNode("span", null, toDisplayString(splitInfo.value['产品名称']) + " " + toDisplayString(splitInfo.value['规格型号']), 1)
              ]),
              createBaseVNode("div", _hoisted_17, [
                createBaseVNode("span", null, toDisplayString(unref(tt)('生产线')), 1),
                createBaseVNode("span", null, toDisplayString(splitInfo.value['生产线'] || '-'), 1)
              ]),
              createBaseVNode("div", _hoisted_18, [
                createBaseVNode("span", null, toDisplayString(unref(tt)('排产数量')), 1),
                createBaseVNode("b", null, toDisplayString(num(splitInfo.value['排产数量'])), 1)
              ]),
              createBaseVNode("div", _hoisted_19, [
                createBaseVNode("span", null, toDisplayString(unref(tt)('入库数量')), 1),
                createBaseVNode("span", null, toDisplayString(num(splitInfo.value['入库数量'])), 1)
              ]),
              createBaseVNode("div", _hoisted_20, [
                createBaseVNode("span", null, toDisplayString(unref(tt)('已完工报工')), 1),
                createBaseVNode("span", null, toDisplayString(num(splitInfo.value['已完工报工'])), 1)
              ]),
              createBaseVNode("div", _hoisted_21, [
                createBaseVNode("span", null, toDisplayString(unref(tt)('已切出')), 1),
                createBaseVNode("span", null, toDisplayString(num(splitInfo.value['已切出数量'])), 1)
              ]),
              createBaseVNode("div", _hoisted_22, [
                createBaseVNode("span", null, toDisplayString(unref(tt)('可切上限')), 1),
                createBaseVNode("b", null, toDisplayString(num(splitInfo.value['可切上限'])), 1)
              ]),
              createBaseVNode("div", _hoisted_23, [
                createBaseVNode("span", null, toDisplayString(unref(tt)('切出数量')), 1),
                createVNode(_component_el_input_number, {
                  modelValue: splitQty.value,
                  "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((splitQty).value = $event)),
                  min: 0,
                  max: Number(splitInfo.value['可切上限']) || 0,
                  controls: false,
                  size: "small",
                  style: {"width":"140px"}
                }, null, 8, ["modelValue", "max"])
              ]),
              createVNode(_component_el_checkbox, {
                modelValue: splitInherit.value,
                "onUpdate:modelValue": _cache[14] || (_cache[14] = $event => ((splitInherit).value = $event))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('继承产线/班组/交期')), 1)
                ]),
                _: 1
              }, 8, ["modelValue"]),
              createBaseVNode("div", _hoisted_24, toDisplayString(unref(tt)('子工单取新工单号,可独立报工、打印;撤回切单可还原父单数量(子单无报工/入库/领料时)')), 1)
            ]))
          : createCommentVNode("", true)
      ]),
      _: 1
    }, 8, ["modelValue", "title"])
  ]))
}
}

};
const WorkOrderList = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-46fe28f2"]]);

export { WorkOrderList as default };
