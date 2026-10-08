import { z as ElDatePicker, r as ElRadioGroup, d as ElButton, k as ElMessage, L as ElDropdown, j as ElTable, f as ElDialog, I as ElRadioButton, K as ElDropdownItem, g as ElTableColumn, n as ElSelect, o as ElOption, i as ElInput, l as ElMessageBox } from './element-plus-W84rT0en.js';
import { t as tt, c as useUserStore, r as request, f as callButton } from './index-CqmwEeWF.js';
/* empty css                   */
/* empty css                */
/* empty css                   */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                          */
/* empty css                  */
/* empty css                         */
/* empty css                        */
import { f as printWorkTaskSheet } from './print-formats-CjwOqWEr.js';
import { W as WorkOrderTraceDialog } from './WorkOrderTraceDialog-Be9njRw6.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import { p as ref, q as onMounted, c as createElementBlock, a as createBaseVNode, $ as toDisplayString, A as unref, _ as createTextVNode, a0 as createVNode, J as Fragment, ae as renderList, Z as createCommentVNode, W as withCtx, f as computed, z as reactive, o as openBlock, S as normalizeClass, P as createBlock } from './vue-vendor-DyX2BAKf.js';
import './element-icons-DOEvq9OG.js';
import './sumTotals-C3PClexH.js';

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "wb-page" };
const _hoisted_2 = { class: "wb-top" };
const _hoisted_3 = { class: "wb-title" };
const _hoisted_4 = { class: "wb-p" };
const _hoisted_5 = { class: "wb-stats" };
const _hoisted_6 = { class: "wb-body" };
const _hoisted_7 = { class: "wb-left" };
const _hoisted_8 = { class: "wb-left-head" };
const _hoisted_9 = { class: "wb-shop-group" };
const _hoisted_10 = { class: "wb-shop-cnt" };
const _hoisted_11 = ["onClick"];
const _hoisted_12 = { class: "wb-line-name" };
const _hoisted_13 = {
  key: 0,
  class: "wb-tag off-line"
};
const _hoisted_14 = { class: "wb-line-row" };
const _hoisted_15 = { class: "wb-qty" };
const _hoisted_16 = { class: "wb-main" };
const _hoisted_17 = { class: "wb-ctx" };
const _hoisted_18 = { class: "wb-ctx-label" };
const _hoisted_19 = {
  key: 0,
  class: "wb-shop"
};
const _hoisted_20 = { class: "wb-ctx-stats" };
const _hoisted_21 = { class: "wb-block" };
const _hoisted_22 = { class: "wb-head" };
const _hoisted_23 = { class: "wb-block-title" };
const _hoisted_24 = { class: "wb-actions" };
const _hoisted_25 = { class: "wb-p" };
const _hoisted_26 = { class: "wb-p" };
const _hoisted_27 = { class: "wb-p" };
const _hoisted_28 = { class: "wb-p wb-dim" };


const _sfc_main = {
  __name: 'WorkOrderBoard',
  setup(__props) {

const day = ref(new Date().toISOString().slice(0, 10));
const lineSummary = ref([]);
const sel = reactive({ line: '' });
const scope = ref('未完工');
const schedRows = ref([]);
const checkedSched = ref([]);
const s = ref({});

const raVisible = ref(false);
const raLine = ref('');
const raShop = ref('');
const raReason = ref('');
const shops = ref([]);
// 调拨目标=启用线(停用线不可再排/调入);选了车间则只看该车间的线(车间是产线的属性)
const raLines = computed(() => lineSummary.value
  .filter((l) => !l.停用 && (!raShop.value || l.生产车间 === raShop.value))
  .map((l) => ({ 生产线: l.生产线, 生产车间: l.生产车间 })));

/** 车间下拉(启用产线的车间去重 + 该车间产线数) */
async function loadShops() {
  try {
    const res = await request.post('/px/scheduleBoard/workshops', {});
    shops.value = res.data || [];
  } catch { /* 不阻断 */ }
}

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
function err(e, f) { ElMessage.error(e?.response?.data?.message || tt(f)); }

const selQty = computed(() => schedRows.value.reduce((a, r) => a + Number(r.排产数量 || 0), 0));
/** 左侧按工序/工艺两级分组(2026-10-05):第1级=成型/切炭/组装,第2级=产线分组(成型下 烧结/X烧结) */
const lineGroups = computed(() => {
  const m = new Map();
  for (const l of lineSummary.value) {
    const k = l.产线分组 ? `${l.生产车间}·${l.产线分组}` : (l.生产车间 || '未归类');
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(l);
  }
  return [...m.entries()].map(([车间, lines]) => ({ 车间, lines }))
});
// 当前账号的车间(9.29 批次③):由 linesSummary 的产线车间反推(账号车间 = 其可见线的车间;不受限账号为多值 → 不显示)
const shop = computed(() => {
  const set = [...new Set(lineSummary.value.map((l) => l.生产车间).filter(Boolean))];
  return set.length === 1 ? set[0] : ''
});
// 未完工量=Σ未交量(**成品口径**:排产−入库,2026-10-07 起);旧数据无未交量字段时回退余量
const selOutstanding = computed(() => schedRows.value.reduce((a, r) => a + (r.未交量 !== undefined ? Number(r.未交量 || 0) : Number(r.余量 || 0)), 0));

function select(l) {
  sel.line = l.生产线;
  loadScheduled();
}

async function loadSummary() {
  try {
    const res = await request.post('/px/scheduleBoard/linesSummary', { 开工日期: day.value });
    lineSummary.value = res.data || [];
    if (sel.line && !lineSummary.value.some((x) => x.生产线 === sel.line)) {
      sel.line = ''; schedRows.value = [];
    }
  } catch (e) { err(e, '查询失败'); }
}

async function loadScheduled() {
  if (!sel.line) { schedRows.value = []; return }
  try {
    const res = await request.post('/px/scheduleBoard/scheduled', { 生产线: sel.line, scope: scope.value });
    schedRows.value = res.data || [];
  } catch (e) { err(e, '查询失败'); }
}

async function loadStats() {
  try {
    const res = await request.post('/px/scheduleBoard/stats', {});
    s.value = res.data || {};
  } catch { /* 统计失败不阻断 */ }
}

function loadAll() { loadSummary(); loadScheduled(); loadStats(); }

function openReassign() {
  if (!checkedSched.value.length) return
  raLine.value = sel.line;
  raShop.value = lineSummary.value.find((l) => l.生产线 === sel.line)?.生产车间 || '';
  raReason.value = '';
  loadShops();
  raVisible.value = true;
}

// ── 取消结案(旧系统 ProSchedList 同名按钮):回退到已审核、不锁死;走 MANU_ORDER「取消结案」按钮(ManuCloseHandler) ──
async function unclose() {
  const rows = checkedSched.value.filter((r) => r.结案 === 'Y');
  if (!rows.length) { ElMessage.warning(tt('选中工单中没有已结案的')); return }
  try {
    await ElMessageBox.confirm(`${tt('确认取消选中的')} ${rows.length} ${tt('张工单的结案')}？(${tt('取消后回到已审核,可继续排产/报工')})`,
      tt('取消结案'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') });
  } catch { return }
  const failed = [];
  let done = 0;
  for (const r of rows) {
    try {
      await callButton({ panelCode: 'MANU_ORDER', buttonName: '取消结案', formData: { 编号: r.加工单号 }, buttonParam: {} });
      done++;
    } catch (e) { failed.push(`${r.加工单号}:${e?.response?.data?.message || e?.message || tt('操作失败')}`); }
  }
  if (done) ElMessage.success(`${tt('已取消结案')} ${done} ${tt('张')}` + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''));
  if (failed.length && !done) ElMessage.error(failed[0]);
  loadScheduled();
  loadSummary();
}

// ── 追溯(= 工单详情,2026-10-05):**弹窗抽成共用组件 WorkOrderTraceDialog**(生产工单页也原地挂同一个,
//    用户口径「在生产工单也可以这样查看,不是跳转到工单排产」)。本页只负责:置单号 + 打开。
const traceVisible = ref(false);
const traceNo = ref('');

function openTrace(noParam) {
  const no = typeof noParam === 'string' ? noParam : (noParam?.['工单号'] || checkedSched.value[0]?.加工单号);
  if (!no) return
  traceNo.value = no;
  traceVisible.value = true;
}

// ── 打印工单(两模板可选,2026-09-27):成型/组装生产任务单 = 行表直打;打印留痕 printStamp ──
//    ⚠ 2026-10-14 「生产投料单」模板下线:物料行全部来自自建 BOM(/px/workOrderBom → bs_bom),
//      随 MES 自建 BOM 功能整体删除,前端已无替代数据源。
async function printTask(mode) {
  const rows = checkedSched.value;
  if (!rows.length) return
  const rowsToPrint = rows.map((r) => ({
    单据编号: r.加工单号,
    公司代码: r.公司代码 || '', 工单行号: r.工单行号, // 工单二维码=公司代码@工单号@1000+工单行号(2026-10-09 规则改版)
    是否重点管控产品: r.重点管控 || '',
    商品编码: r.物料编码 || '',
    商品名称: r.产品名称 || '',
    规格型号: r.规格型号 || '',
    订单数量: r.需求数量,
    成型折算后数量: r.排产数量,
    计划完工日期: r.计划完工日期 || '',
    批号: r.批号 || '', 物料编码: r.物料编码 || '',
    排产数量: r.排产数量, 生产线: r.生产线 || sel.line || '',
  }));
  const okPrint = await printWorkTaskSheet(mode, rowsToPrint, { line: sel.line || '', preparedBy: useUserStore().realName });
  if (!okPrint) return
  try {
    await request.post('/px/scheduleBoard/printStamp', { rows: rows.map((r) => ({ 加工单号: r.加工单号 })) });
  } catch (e) { /* 留痕失败不阻断打印 */ }
  ElMessage.success(tt('已发送打印') + ' ' + rows.length + ' ' + tt('张'));
  loadScheduled();
}

/** 调拨(9.29 批次②):勾选已排工单 → 目标产线(可按车间收敛)+ 原因 → 写 `wo_transfer_log` 轨迹 */
async function doTransfer() {
  if (!raLine.value) { ElMessage.warning(tt('请选择目标生产线')); return }
  const rows = checkedSched.value.map((r) => ({ 工单号: r.加工单号, 工单行号: r.工单行号, 批次号: r.批次号 }));
  try {
    await ElMessageBox.confirm(`${tt('确认调拨')} ${rows.length} ${tt('张工单')} → ${raLine.value}？`, tt('工单调拨'),
      { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') });
  } catch { return }
  try {
    const res = await request.post('/px/scheduleBoard/transfer', {
      rows, 目标生产线: raLine.value, 目标车间: raShop.value || undefined, 原因: raReason.value || undefined,
    });
    const d = res.data || {};
    const failed = d['失败行'] || [];
    ElMessage.success(`${tt('已调拨')} ${d['调拨张数']} ${tt('张')} → ${d['目标']}`
      + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''));
    raVisible.value = false;
    loadScheduled();
    loadSummary();
  } catch (e) { err(e, '调拨失败'); }
}

/** 撤回调拨:按工单最后一条生效轨迹把产线调回原线(轨迹标撤销,留痕不删) */
async function doTransferRevoke() {
  const rows = checkedSched.value.map((r) => ({ 工单号: r.加工单号, 工单行号: r.工单行号, 批次号: r.批次号 }));
  if (!rows.length) return
  try {
    await ElMessageBox.confirm(`${tt('撤回调拨')} ${rows.length} ${tt('张工单')}？(${tt('调回原产线,轨迹留痕')})`,
      tt('撤回调拨'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消'), type: 'warning' });
  } catch { return }
  try {
    const res = await request.post('/px/scheduleBoard/transferRevoke', { rows });
    const d = res.data || {};
    const failed = d['失败行'] || [];
    ElMessage.success(`${tt('已撤回')} ${d['撤回张数']} ${tt('张')}`
      + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''));
    loadScheduled();
    loadSummary();
  } catch (e) { err(e, '撤回调拨失败'); }
}

// ── 「转领料」已随 MES 自建 BOM 下架移除(2026-10-04) ──
//    原实现:勾选已排工单 → 按默认 BOM×排产数量 生成材料出库单草稿(后端 /px/scheduleBoard/toPicking
//    + ScheduleBoardService.toPicking + BOM 表 bs_bom,均已同期删除)。领料单改为在「材料出库单」面板手工
//    新增/选单;若日后要恢复自动带料,需先有新的用料来源(如金蝶 BOM 接口)。
//    **2026-10-07 补**:生产工单列表页新增「转领料单」(WorkOrderList.vue + /px/workOrderList/toPicking,
//    由原「打印领料单」改来)——只转单头(加工单号=工单号)、明细仍由仓库在材料出库单里补,故本页不重复造入口。

onMounted(() => {
  loadAll();
  // 外部跳入(生产加工单列表「追溯」):?trace=工单号 直开追溯弹窗
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const tno = q.get('trace');
  if (tno) setTimeout(() => openTrace(tno), 600);
});

return (_ctx, _cache) => {
  const _component_el_date_picker = ElDatePicker;
  const _component_el_radio_button = ElRadioButton;
  const _component_el_radio_group = ElRadioGroup;
  const _component_el_button = ElButton;
  const _component_el_dropdown_item = ElDropdownItem;
  const _component_el_dropdown = ElDropdown;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_input = ElInput;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    createBaseVNode("div", _hoisted_2, [
      createBaseVNode("span", _hoisted_3, toDisplayString(unref(tt)('工单排产')), 1),
      createBaseVNode("span", _hoisted_4, [
        createTextVNode(toDisplayString(unref(tt)('开工日期')) + " ", 1),
        createVNode(_component_el_date_picker, {
          modelValue: day.value,
          "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((day).value = $event)),
          type: "date",
          "value-format": "YYYY-MM-DD",
          style: {"width":"135px"},
          onChange: loadAll
        }, null, 8, ["modelValue"])
      ]),
      createBaseVNode("span", _hoisted_5, toDisplayString(unref(tt)('待排产')) + "（" + toDisplayString(s.value['待排产笔数'] ?? 0) + toDisplayString(unref(tt)('笔')) + "）；" + toDisplayString(unref(tt)('今日排产')) + "（" + toDisplayString(s.value['今日排产']?.张数 ?? 0) + toDisplayString(unref(tt)('张')) + "/" + toDisplayString(num(s.value['今日排产']?.数量)) + toDisplayString(unref(tt)('件')) + "）；" + toDisplayString(unref(tt)('总未完成量')) + " " + toDisplayString(num(s.value['总未完成量'])), 1)
    ]),
    createBaseVNode("div", _hoisted_6, [
      createBaseVNode("div", _hoisted_7, [
        createBaseVNode("div", _hoisted_8, toDisplayString(unref(tt)('工序/工艺')) + " / " + toDisplayString(unref(tt)('生产线')), 1),
        (openBlock(true), createElementBlock(Fragment, null, renderList(lineGroups.value, (g) => {
          return (openBlock(), createElementBlock(Fragment, {
            key: g.车间
          }, [
            createBaseVNode("div", _hoisted_9, [
              createTextVNode(toDisplayString(unref(tt)(g.车间)), 1),
              createBaseVNode("span", _hoisted_10, toDisplayString(g.lines.length), 1)
            ]),
            (openBlock(true), createElementBlock(Fragment, null, renderList(g.lines, (l) => {
              return (openBlock(), createElementBlock("div", {
                key: l.生产线,
                class: normalizeClass(["wb-line", { active: sel.line === l.生产线, off: l.停用 }]),
                onClick: $event => (select(l))
              }, [
                createBaseVNode("div", _hoisted_12, [
                  createTextVNode(toDisplayString(l.生产线) + " ", 1),
                  (l.停用)
                    ? (openBlock(), createElementBlock("span", _hoisted_13, toDisplayString(unref(tt)('停用')), 1))
                    : createCommentVNode("", true)
                ]),
                createBaseVNode("div", _hoisted_14, [
                  createBaseVNode("span", _hoisted_15, toDisplayString(num(l.未交量)), 1)
                ])
              ], 10, _hoisted_11))
            }), 128))
          ], 64))
        }), 128))
      ]),
      createBaseVNode("div", _hoisted_16, [
        createBaseVNode("div", _hoisted_17, [
          createBaseVNode("span", _hoisted_18, [
            createTextVNode(toDisplayString(unref(tt)('生产线')) + "：", 1),
            createBaseVNode("b", null, toDisplayString(sel.line || unref(tt)('（点击左侧选择）')), 1),
            (shop.value)
              ? (openBlock(), createElementBlock("span", _hoisted_19, toDisplayString(unref(tt)('当前车间')) + "：" + toDisplayString(shop.value), 1))
              : createCommentVNode("", true)
          ]),
          createBaseVNode("span", _hoisted_20, toDisplayString(unref(tt)('排产数量')) + " " + toDisplayString(num(selQty.value)) + "　|　" + toDisplayString(unref(tt)('未完工量')) + " " + toDisplayString(num(selOutstanding.value)), 1)
        ]),
        createBaseVNode("div", _hoisted_21, [
          createBaseVNode("div", _hoisted_22, [
            createBaseVNode("span", _hoisted_23, toDisplayString(unref(tt)('排产明细')) + "——" + toDisplayString(sel.line || '-'), 1),
            createVNode(_component_el_radio_group, {
              modelValue: scope.value,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((scope).value = $event)),
              size: "small",
              onChange: loadScheduled
            }, {
              default: withCtx(() => [
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
                }),
                createVNode(_component_el_radio_button, { value: "全部" }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('全部')), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["modelValue"]),
            createBaseVNode("div", _hoisted_24, [
              createVNode(_component_el_button, {
                size: "small",
                type: "danger",
                plain: "",
                disabled: !checkedSched.value.length,
                onClick: unclose
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('取消结案')) + "（" + toDisplayString(checkedSched.value.length) + "） ", 1)
                ]),
                _: 1
              }, 8, ["disabled"]),
              createVNode(_component_el_button, {
                size: "small",
                type: "primary",
                plain: "",
                disabled: checkedSched.value.length !== 1,
                onClick: openTrace
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('追溯')), 1)
                ]),
                _: 1
              }, 8, ["disabled"]),
              createVNode(_component_el_dropdown, {
                "split-button": "",
                size: "small",
                type: "success",
                plain: "",
                disabled: !checkedSched.value.length,
                onClick: _cache[2] || (_cache[2] = $event => (printTask('成型生产任务单'))),
                onCommand: printTask
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
                  createTextVNode(toDisplayString(unref(tt)('打印工单')) + "（" + toDisplayString(checkedSched.value.length) + "） ", 1)
                ]),
                _: 1
              }, 8, ["disabled"]),
              createVNode(_component_el_button, {
                size: "small",
                type: "warning",
                plain: "",
                disabled: !checkedSched.value.length,
                onClick: openReassign
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('调拨')) + "（" + toDisplayString(checkedSched.value.length) + "） ", 1)
                ]),
                _: 1
              }, 8, ["disabled"]),
              createVNode(_component_el_button, {
                size: "small",
                plain: "",
                disabled: !checkedSched.value.length,
                onClick: doTransferRevoke
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('撤回调拨')), 1)
                ]),
                _: 1
              }, 8, ["disabled"])
            ])
          ]),
          createVNode(_component_el_table, {
            data: schedRows.value,
            size: "small",
            border: "",
            height: "100%",
            "empty-text": "",
            onSelectionChange: _cache[3] || (_cache[3] = (r) => (checkedSched.value = r))
          }, {
            default: withCtx(() => [
              createVNode(_component_el_table_column, {
                type: "selection",
                width: "42"
              }),
              createVNode(_component_el_table_column, {
                label: unref(tt)('工单号'),
                prop: "加工单号",
                width: "150",
                fixed: ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('工单行号'),
                prop: "工单行号",
                width: "90",
                sortable: ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('客户'),
                prop: "客户",
                "min-width": "130",
                fixed: "",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('排产日期'),
                prop: "排产日期",
                width: "95"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('客户PO'),
                prop: "客户PO",
                width: "110",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('物料编码'),
                prop: "物料编码",
                width: "110",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('产品名称'),
                prop: "产品名称",
                "min-width": "140",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('规格型号'),
                prop: "规格型号",
                width: "110",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('单位'),
                prop: "单位",
                width: "55"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('批号'),
                prop: "批号",
                width: "100",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('重点管控'),
                prop: "重点管控",
                width: "80"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('开工日期'),
                prop: "开工日期",
                width: "95"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('计划完工日期'),
                prop: "计划完工日期",
                width: "105"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('实际完工日期'),
                prop: "实际完工日期",
                width: "105"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('排产数量'),
                prop: "排产数量",
                width: "90",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('需求数量'),
                prop: "需求数量",
                width: "90",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('入库数量'),
                prop: "入库数量",
                width: "90",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('当前工序'),
                prop: "当前工序",
                width: "95",
                sortable: ""
              }, {
                default: withCtx(({ row }) => [
                  createTextVNode(toDisplayString(row.当前工序 ? unref(tt)(row.当前工序) : '-'), 1)
                ]),
                _: 1
              }, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('当前工序计划量'),
                prop: "当前工序计划量",
                width: "120",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('当前工序完工量'),
                prop: "当前工序完工量",
                width: "120",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('上道工序'),
                prop: "上道工序",
                width: "95"
              }, {
                default: withCtx(({ row }) => [
                  createTextVNode(toDisplayString(row.上道工序 ? unref(tt)(row.上道工序) : '-'), 1)
                ]),
                _: 1
              }, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('上道完工量'),
                prop: "上道完工量",
                width: "110",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('未交量'),
                prop: "未交量",
                width: "85",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('余量'),
                prop: "余量",
                width: "80",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('操作员'),
                prop: "操作员",
                width: "80"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('备注'),
                prop: "备注",
                "min-width": "100",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('领料单号'),
                prop: "领料单号",
                width: "120",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('入库单号'),
                prop: "入库单号",
                width: "120",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('结案'),
                width: "70"
              }, {
                default: withCtx(({ row }) => [
                  createBaseVNode("span", {
                    class: normalizeClass(row.结案 === 'Y' ? 'wb-closed' : '')
                  }, toDisplayString(row.结案 === 'Y' ? unref(tt)('已结案') : '-'), 3)
                ]),
                _: 1
              }, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('结案人'),
                prop: "结案人",
                width: "80"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('结案时间'),
                prop: "结案时间",
                width: "130"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('打印人'),
                prop: "打印人",
                width: "80"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('打印时间'),
                prop: "打印时间",
                width: "130"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('打印次数'),
                prop: "打印次数",
                width: "80",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('生产状态'),
                prop: "生产状态",
                width: "90",
                fixed: "right"
              }, null, 8, ["label"])
            ]),
            _: 1
          }, 8, ["data"])
        ])
      ])
    ]),
    createVNode(_component_el_dialog, {
      modelValue: raVisible.value,
      "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((raVisible).value = $event)),
      title: unref(tt)('工单调拨'),
      width: "430px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[8] || (_cache[8] = $event => (raVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: doTransfer
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('确认调拨')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_25, [
          createTextVNode(toDisplayString(unref(tt)('目标车间')) + " ", 1),
          createVNode(_component_el_select, {
            modelValue: raShop.value,
            "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((raShop).value = $event)),
            filterable: "",
            clearable: "",
            style: {"width":"210px"},
            onChange: _cache[5] || (_cache[5] = $event => (raLine.value = ''))
          }, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(shops.value, (x) => {
                return (openBlock(), createBlock(_component_el_option, {
                  key: x.车间,
                  label: x.车间 + '（' + x.产线数 + '）',
                  value: x.车间
                }, null, 8, ["label", "value"]))
              }), 128))
            ]),
            _: 1
          }, 8, ["modelValue"])
        ]),
        createBaseVNode("div", _hoisted_26, [
          createTextVNode(toDisplayString(unref(tt)('目标生产线')) + " ", 1),
          createVNode(_component_el_select, {
            modelValue: raLine.value,
            "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((raLine).value = $event)),
            filterable: "",
            style: {"width":"210px"}
          }, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(raLines.value, (x) => {
                return (openBlock(), createBlock(_component_el_option, {
                  key: x.生产线,
                  label: x.生产线 + (x.生产车间 ? '·' + x.生产车间 : ''),
                  value: x.生产线
                }, null, 8, ["label", "value"]))
              }), 128))
            ]),
            _: 1
          }, 8, ["modelValue"])
        ]),
        createBaseVNode("div", _hoisted_27, [
          createTextVNode(toDisplayString(unref(tt)('调拨原因')) + " ", 1),
          createVNode(_component_el_input, {
            modelValue: raReason.value,
            "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((raReason).value = $event)),
            size: "small",
            style: {"width":"210px"},
            placeholder: unref(tt)('选填')
          }, null, 8, ["modelValue", "placeholder"])
        ]),
        createBaseVNode("div", _hoisted_28, toDisplayString(unref(tt)('调拨写入轨迹(工单追溯可见);「撤回调拨」可把产线调回原线')), 1)
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(WorkOrderTraceDialog, {
      modelValue: traceVisible.value,
      "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((traceVisible).value = $event)),
      code: traceNo.value
    }, null, 8, ["modelValue", "code"])
  ]))
}
}

};
const WorkOrderBoard = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-48d2d8ee"]]);

export { WorkOrderBoard as default };
