import { v as vLoading, l as ElMessageBox, w as ElForm, j as ElTable, f as ElDialog, H as ElPagination, k as ElMessage, m as ElFormItem, n as ElSelect, o as ElOption, z as ElDatePicker, i as ElInput, d as ElButton, g as ElTableColumn, h as ElInputNumber } from './element-plus-W84rT0en.js';
import { t as tt, r as request } from './index-CqmwEeWF.js';
/* empty css                   */
/* empty css                */
/* empty css                   */
/* empty css                       */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                         */
/* empty css                      */
/* empty css                        */
import { q as onMounted, c as createElementBlock, a as createBaseVNode, $ as toDisplayString, A as unref, a0 as createVNode, W as withCtx, ac as withModifiers, X as withDirectives, P as createBlock, p as ref, f as computed, o as openBlock, J as Fragment, ae as renderList, Z as createCommentVNode, aq as withKeys, _ as createTextVNode, S as normalizeClass } from './vue-vendor-DyX2BAKf.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import './element-icons-DOEvq9OG.js';

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "oc-page" };
const _hoisted_2 = { class: "oc-summary" };
const _hoisted_3 = {
  key: 0,
  class: "oc-range"
};
const _hoisted_4 = { class: "oc-count" };
const _hoisted_5 = { class: "oc-table" };
const _hoisted_6 = { class: "oc-strong" };
const _hoisted_7 = { class: "oc-dim" };
const _hoisted_8 = { class: "oc-dim" };
const _hoisted_9 = { class: "oc-strong" };
const _hoisted_10 = ["title"];
const _hoisted_11 = { class: "oc-empty" };
const _hoisted_12 = { class: "oc-route-tip" };
const _hoisted_13 = { class: "oc-pager" };

/** 近N天档位(用户口径:默认单日,可切近几日) */

const _sfc_main = {
  __name: 'OrderConvert',
  setup(__props) {

const NEAR_DAYS = [3, 7, 14, 30];

const keyword = ref('');
const loading = ref(false);
const dateMode = ref('day');   // 'day'=单日;'3'/'7'/'14'/'30'=近N天(anchor 为截止日)
const anchor = ref('');        // 单日=查询的那一天;近N天=截止日;空=按今天兜底
const pageNo = ref(1);
const pageSize = ref(100);
/** 可选工艺路线(弹窗选择,2026-10-05):来自 bs_route,含工序序列 */
const routeOptions = ref([]);
const routeDialog = ref(false);
const routeKw = ref('');
const routePick = ref(null);
const routeFiltered = computed(() => routeOptions.value.filter((r) =>
  !routeKw.value || String(r.编码 || '').includes(routeKw.value) || String(r.名称 || '').includes(routeKw.value)));
async function loadRoutes() {
  try { routeOptions.value = (await request.post('/px/processTask/routes', {})).data || []; } catch { routeOptions.value = []; }
}
function openRouteDialog() { routePick.value = null; routeKw.value = ''; routeDialog.value = true; }
/** 把弹窗里选中的路线应用到**勾选行**(批量;未勾选则不动) */
function applyRoute() {
  const rt = routePick.value;
  if (!rt) return
  for (const r of checked.value) r.工艺路线 = rt.编码;
  ElMessage.success(`${tt('已为')} ${checked.value.length} ${tt('行设置工艺路线')} ${rt.编码}`);
  routeDialog.value = false;
}
const rows = ref([]);
const checked = ref([]);
const tableRef = ref(null);
const s = ref({});

/** 行内修改过交期(与原始值比对)的行 */
const dateChanged = computed(() => rows.value.filter((r) => r.交货日期 && r.交货日期 !== r.交货日期原始));

// ── 日期查询:单日 / 近N天(本地日期算,不走 UTC,避免时区把"今天"算偏一天) ──
const pad2 = (n) => String(n).padStart(2, '0');
const fmtDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => fmtDay(new Date());
function parseDay(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }

/** 当前查询区间(含端点):单日=锚点当天;近N天= [锚点−(N−1), 锚点] */
const range = computed(() => {
  const to = anchor.value || todayStr();
  const n = dateMode.value === 'day' ? 1 : (Number(dateMode.value) || 1);
  const end = parseDay(to);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (n - 1));
  return { from: fmtDay(start), to }
});
const rangeText = computed(() => (range.value.from === range.value.to ? range.value.from : `${range.value.from} ~ ${range.value.to}`));

/** 当前页数据(前端分页:渲染行数封顶,勾选跨页保留) */
const pagedRows = computed(() => {
  const start = (pageNo.value - 1) * pageSize.value;
  return rows.value.slice(start, start + pageSize.value)
});

function queryBody() {
  return { keyword: keyword.value, dateFrom: range.value.from, dateTo: range.value.to }
}

async function loadPending() {
  loading.value = true;
  try {
    const res = await request.post('/px/orderConvert/pending', queryBody());
    rows.value = (res.data || []).map((r) => ({
      ...r,
      交货日期: r.交货日期 || '',
      交货日期原始: r.交货日期 || '',
      生单数量: Number(r.剩余数量) || 0,
      rowKey: `${r.订单号}#${r['行id']}`,
    }));
    pageNo.value = 1;
    checked.value = [];
    tableRef.value?.clearSelection?.();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('查询失败'));
  } finally {
    loading.value = false;
  }
}

/** 汇总条:body 缺省=当前日期/关键字口径(「最新下单日期」无论带不带条件都返回 = 全体待结转行里最近的下单日) */
async function loadStats(body) {
  try {
    const res = await request.post('/px/orderConvert/stats', body || queryBody());
    s.value = res.data || {};
  } catch { /* 汇总失败不阻断列表 */ }
}

/** 最近有数据的一天(后端 stats.最新下单日期;空=一条待结转都没有) */
const latestDay = computed(() => String(s.value['最新下单日期'] || '').slice(0, 10));
/** 最近有数据的一天是否已落在当前查询区间内(在窗口里就不必再提示跳转) */
const latestInRange = computed(() => !!latestDay.value && latestDay.value >= range.value.from && latestDay.value <= range.value.to);

async function loadAll() { await Promise.all([loadPending(), loadStats()]); }
/** 日期档位/锚点/关键字变动:回第一页重查(2026-10-06 起页面默认只查一天,切档即查) */
function onQuery() { pageNo.value = 1; loadAll(); }
function quickNear(n) { dateMode.value = String(n); onQuery(); }
/** 跳到最近有数据的一天(空表近路按钮;与打开页面时的弹窗同一个动作) */
function jumpToLatest() { if (!latestDay.value) return; anchor.value = latestDay.value; onQuery(); }

/**
 * 打开页面时当天没有待结转数据 → **弹窗询问**是否跳到最近有数据的一天
 * (2026-10-06 用户口径:不要静默跳转;用户点「留在本日」就停在当天,空表里另给近路按钮)。
 * 只在首帧调用一次;用户后续自己切日期/刷新不再打扰。
 */
async function askJumpToLatest() {
  if (rows.value.length) return
  const latest = latestDay.value;
  if (!latest || latest === range.value.to) return
  try {
    await ElMessageBox.confirm(
      // 标点用半角(与仓库既有组合文案一致:`${tt('生成子工单')}?`),否则英语界面会出现全角「，？」
      `${range.value.to} ${tt('没有待结转数据')}, ${tt('跳到最近有数据的一天')} ${latest}?`,
      tt('没有数据'), { confirmButtonText: tt('跳转'), cancelButtonText: tt('留在本日'), type: 'info' },
    );
  } catch { return }   // 取消:停在所选日期(空表 + 近路按钮)
  anchor.value = latest;
  await loadAll();
}
function onCheck(r) { checked.value = r; }

/** 保存交期:把行内修正的预计交货日期回写销售订单行 */
async function saveDates() {
  const list = dateChanged.value;
  if (!list.length) return
  try {
    const res = await request.post('/px/orderConvert/saveDates', {
      rows: list.map((r) => ({ 订单号: r.订单号, 行id: r['行id'], 交货日期: r.交货日期 })),
    });
    ElMessage.success(tt('交期已保存') + '：' + (res.data?.['更新行数'] ?? 0) + tt('行'));
    loadAll();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('保存失败'));
  }
}

async function toManu() {
  await convert('toManu', '转工单');
}

async function convert(api, label) {
  const list = (checked.value || []).filter((r) => Number(r.生单数量) > 0);
  if (!list.length) { ElMessage.warning(tt('请先勾选要结转的订单行')); return }
  // 未选择工艺路线 = 不能转工单(2026-10-05 用户口径):先提示缺失行,直接拦住
  const noRoute = list.filter((r) => !r['工艺路线']);
  if (noRoute.length) {
    ElMessage.warning(tt('有') + ' ' + noRoute.length + ' ' + tt('行未选择工艺路线,不能转工单;请先点工具栏「选择工艺路线」指定') + '：' + noRoute.slice(0, 5).map((r) => r['订单号'] + '#' + r['行号']).join('、'));
    return
  }
  const qty = list.reduce((a, r) => a + Number(r.生单数量 || 0), 0);
  try {
    await ElMessageBox.confirm(
      `${tt('确认将选中的')} ${list.length} ${tt('行')}（${tt('合计')} ${qty}）${tt(label)}？`,
      tt('订单结转'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') },
    );
  } catch { return }
  try {
    const res = await request.post(`/px/orderConvert/${api}`, {
      rows: list.map((r) => ({
        订单号: r.订单号,
        行id: r['行id'],
        生单数量: Number(r.生单数量) || undefined,
        // 转单必须带工艺路线(2026-10-05:后端硬校验;此前漏传被拦「未选择工艺路线」)
        工艺路线: r['工艺路线'] || undefined,
        交货日期: r.交货日期 && r.交货日期 !== r.交货日期原始 ? r.交货日期 : undefined,
      })),
    });
    const d = res.data || {};
    const failed = d['失败行'] || [];
    // 2026-10-11 用户拍板:结转只弹首道「确认转工单」框,结果不再弹窗——轻提示带出即可;
    // 新工单即落 plang 入快速排产待排产池(该池已改新单置顶),本页刷新后转满行自动消失
    ElMessage({
      type: 'success',
      message: `${tt('已生成')} ${d['生成张数']} ${tt('张')}：${(d['编号清单'] || []).join('、')}`
        + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''),
      duration: 5000,
      showClose: true,
    });
    loadAll();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('转单失败'));
  }
}

onMounted(async () => {
  loadRoutes();
  // 首帧:默认「单日 = 今天」并直接查;今天没有待结转数据时**弹窗询问**是否跳到最近有数据的一天
  // (2026-10-06 用户口径:以前是静默跳转,现在必须先问;取消就停在今天)。
  // 之前更早的写法是"不带条件拉全量":数据一多,进页面就卡死(同日用户报障)。
  anchor.value = todayStr();
  await loadAll();
  await askJumpToLatest();
});

return (_ctx, _cache) => {
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_form_item = ElFormItem;
  const _component_el_input = ElInput;
  const _component_el_button = ElButton;
  const _component_el_form = ElForm;
  const _component_el_table_column = ElTableColumn;
  const _component_el_input_number = ElInputNumber;
  const _component_el_table = ElTable;
  const _component_el_dialog = ElDialog;
  const _component_el_pagination = ElPagination;
  const _directive_loading = vLoading;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    createBaseVNode("div", _hoisted_2, [
      createBaseVNode("span", null, toDisplayString(unref(tt)('未结转订单汇总')) + "（" + toDisplayString(unref(tt)('总订单笔数')) + ": " + toDisplayString(s.value.未结转?.总订单笔数 ?? 0) + "　" + toDisplayString(unref(tt)('总款数')) + ": " + toDisplayString(s.value.未结转?.总款数 ?? 0) + "　" + toDisplayString(unref(tt)('总下单数量')) + ": " + toDisplayString(s.value.未结转?.总下单数量 ?? 0) + "）", 1),
      _cache[11] || (_cache[11] = createBaseVNode("span", { class: "oc-sep" }, "；", -1)),
      createBaseVNode("span", null, toDisplayString(unref(tt)('今日结转订单汇总')) + "（" + toDisplayString(unref(tt)('总订单笔数')) + ": " + toDisplayString(s.value.今日结转?.总订单笔数 ?? 0) + "　" + toDisplayString(unref(tt)('总款数')) + ": " + toDisplayString(s.value.今日结转?.总款数 ?? 0) + "　" + toDisplayString(unref(tt)('总下单数量')) + ": " + toDisplayString(s.value.今日结转?.总下单数量 ?? 0) + "）", 1),
      _cache[12] || (_cache[12] = createBaseVNode("span", { class: "oc-sep" }, "；", -1)),
      createBaseVNode("span", null, toDisplayString(unref(tt)('当前数据')) + "（" + toDisplayString(s.value.当前数据笔数 ?? 0) + "）" + toDisplayString(unref(tt)('笔')), 1)
    ]),
    createVNode(_component_el_form, {
      inline: "",
      class: "oc-bar",
      onSubmit: _cache[3] || (_cache[3] = withModifiers(() => {}, ["prevent"]))
    }, {
      default: withCtx(() => [
        createVNode(_component_el_form_item, {
          label: unref(tt)(dateMode.value === 'day' ? '日期' : '截止日期')
        }, {
          default: withCtx(() => [
            createVNode(_component_el_select, {
              modelValue: dateMode.value,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((dateMode).value = $event)),
              size: "small",
              class: "oc-mode",
              onChange: onQuery,
              title: unref(tt)('单日只看一天;近几日=以所选日期为截止日往前数')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_option, {
                  label: unref(tt)('单日'),
                  value: "day"
                }, null, 8, ["label"]),
                (openBlock(), createElementBlock(Fragment, null, renderList(NEAR_DAYS, (n) => {
                  return createVNode(_component_el_option, {
                    key: n,
                    label: unref(tt)('近' + n + '天'),
                    value: String(n)
                  }, null, 8, ["label", "value"])
                }), 64))
              ]),
              _: 1
            }, 8, ["modelValue", "title"]),
            createVNode(_component_el_date_picker, {
              modelValue: anchor.value,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((anchor).value = $event)),
              type: "date",
              "value-format": "YYYY-MM-DD",
              size: "small",
              class: "oc-date",
              clearable: false,
              placeholder: unref(tt)('日期'),
              onChange: onQuery
            }, null, 8, ["modelValue", "placeholder"]),
            (dateMode.value !== 'day')
              ? (openBlock(), createElementBlock("span", _hoisted_3, toDisplayString(rangeText.value), 1))
              : createCommentVNode("", true)
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_form_item, {
          label: unref(tt)('查询条件')
        }, {
          default: withCtx(() => [
            createVNode(_component_el_input, {
              modelValue: keyword.value,
              "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((keyword).value = $event)),
              placeholder: unref(tt)('订单号 / 客户 / 物料'),
              clearable: "",
              style: {"width":"200px"},
              onKeyup: withKeys(onQuery, ["enter"])
            }, null, 8, ["modelValue", "placeholder"])
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: onQuery
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('查询')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          loading: loading.value,
          onClick: onQuery
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('刷新')), 1)
          ]),
          _: 1
        }, 8, ["loading"]),
        createVNode(_component_el_button, {
          type: "danger",
          plain: "",
          disabled: !dateChanged.value.length,
          onClick: saveDates
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('保存交期')) + "（" + toDisplayString(dateChanged.value.length) + "） ", 1)
          ]),
          _: 1
        }, 8, ["disabled"]),
        createVNode(_component_el_button, {
          disabled: !checked.value.length,
          onClick: openRouteDialog
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('选择工艺路线')) + "（" + toDisplayString(checked.value.length) + "）", 1)
          ]),
          _: 1
        }, 8, ["disabled"]),
        createVNode(_component_el_button, {
          type: "success",
          disabled: !checked.value.length,
          onClick: toManu
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('转工单')) + "（" + toDisplayString(checked.value.length) + "）", 1)
          ]),
          _: 1
        }, 8, ["disabled"]),
        createBaseVNode("span", _hoisted_4, [
          createTextVNode(toDisplayString(unref(tt)('共有数据')) + ": ", 1),
          createBaseVNode("b", null, toDisplayString(rows.value.length), 1),
          createTextVNode(" " + toDisplayString(unref(tt)('条')), 1)
        ])
      ]),
      _: 1
    }),
    createBaseVNode("div", _hoisted_5, [
      withDirectives((openBlock(), createBlock(_component_el_table, {
        ref_key: "tableRef",
        ref: tableRef,
        data: pagedRows.value,
        size: "small",
        border: "",
        height: "100%",
        "row-key": "rowKey",
        onSelectionChange: onCheck
      }, {
        empty: withCtx(() => [
          createBaseVNode("div", _hoisted_11, [
            createBaseVNode("span", null, toDisplayString(unref(tt)('该日期范围没有待结转数据')), 1),
            (latestDay.value && !latestInRange.value)
              ? (openBlock(), createBlock(_component_el_button, {
                  key: 0,
                  link: "",
                  type: "primary",
                  onClick: jumpToLatest
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('跳到最近有数据的一天')) + " " + toDisplayString(latestDay.value), 1)
                  ]),
                  _: 1
                }))
              : createCommentVNode("", true),
            (dateMode.value === 'day')
              ? (openBlock(), createBlock(_component_el_button, {
                  key: 1,
                  link: "",
                  type: "primary",
                  onClick: _cache[4] || (_cache[4] = $event => (quickNear(7)))
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('看近7天')), 1)
                  ]),
                  _: 1
                }))
              : createCommentVNode("", true)
          ])
        ]),
        default: withCtx(() => [
          createVNode(_component_el_table_column, {
            type: "selection",
            width: "42",
            "reserve-selection": ""
          }),
          createVNode(_component_el_table_column, {
            label: unref(tt)('订单资料'),
            width: "240",
            fixed: ""
          }, {
            default: withCtx(({ row }) => [
              createBaseVNode("div", _hoisted_6, toDisplayString(row.订单号), 1),
              createBaseVNode("div", _hoisted_7, toDisplayString(row.物料编码), 1),
              createBaseVNode("div", _hoisted_8, toDisplayString(row.品名), 1)
            ]),
            _: 1
          }, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('行号'),
            prop: "行号",
            width: "70"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('下单日期'),
            prop: "下单日期",
            width: "100"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('交货日期'),
            width: "150",
            fixed: "left"
          }, {
            default: withCtx(({ row }) => [
              createVNode(_component_el_date_picker, {
                modelValue: row.交货日期,
                "onUpdate:modelValue": $event => ((row.交货日期) = $event),
                type: "date",
                "value-format": "YYYY-MM-DD",
                size: "small",
                style: {"width":"130px"},
                class: normalizeClass({ 'oc-date-dirty': row.交货日期 !== row.交货日期原始 }),
                title: unref(tt)('同步交期常与创建日期雷同，可在此修正；保存交期或转单时回写订单行')
              }, null, 8, ["modelValue", "onUpdate:modelValue", "class", "title"])
            ]),
            _: 1
          }, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('客户'),
            prop: "客户",
            "min-width": "160",
            "show-overflow-tooltip": ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('客户等级'),
            prop: "客户等级",
            width: "90"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('型号'),
            prop: "型号",
            width: "120",
            "show-overflow-tooltip": ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('重点管控'),
            prop: "重点管控",
            width: "90"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('客户订单号'),
            prop: "客户订单号",
            width: "120",
            "show-overflow-tooltip": ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('需求数量'),
            prop: "需求数量",
            width: "100",
            align: "right"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('已排产数量'),
            width: "105",
            align: "right"
          }, {
            default: withCtx(({ row }) => [
              createBaseVNode("span", {
                class: normalizeClass({ 'oc-blue': Number(row.已排产数量) > 0 })
              }, toDisplayString(row.已排产数量), 3)
            ]),
            _: 1
          }, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('剩余数量'),
            width: "100",
            align: "right",
            fixed: "right"
          }, {
            default: withCtx(({ row }) => [
              createBaseVNode("span", _hoisted_9, toDisplayString(row.剩余数量), 1)
            ]),
            _: 1
          }, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('工艺路线'),
            width: "180",
            fixed: "right"
          }, {
            default: withCtx(({ row }) => [
              createBaseVNode("span", {
                class: normalizeClass({ 'oc-blue': !!row.工艺路线 }),
                title: row.工艺路线
              }, toDisplayString(row.工艺路线 || '-'), 11, _hoisted_10)
            ]),
            _: 1
          }, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('本次转单数量'),
            width: "125",
            fixed: "right"
          }, {
            default: withCtx(({ row }) => [
              createVNode(_component_el_input_number, {
                modelValue: row.生单数量,
                "onUpdate:modelValue": $event => ((row.生单数量) = $event),
                min: 0,
                max: Number(row.剩余数量),
                controls: false,
                size: "small",
                style: {"width":"100%"}
              }, null, 8, ["modelValue", "onUpdate:modelValue", "max"])
            ]),
            _: 1
          }, 8, ["label"])
        ]),
        _: 1
      }, 8, ["data"])), [
        [_directive_loading, loading.value]
      ]),
      createVNode(_component_el_dialog, {
        modelValue: routeDialog.value,
        "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((routeDialog).value = $event)),
        title: unref(tt)('选择工艺路线'),
        width: "660px",
        "append-to-body": ""
      }, {
        footer: withCtx(() => [
          createBaseVNode("span", _hoisted_12, toDisplayString(unref(tt)('将对勾选的')) + " " + toDisplayString(checked.value.length) + " " + toDisplayString(unref(tt)('行应用该路线(双击行亦可)')), 1),
          createVNode(_component_el_button, {
            onClick: _cache[7] || (_cache[7] = $event => (routeDialog.value = false))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('取消')), 1)
            ]),
            _: 1
          }),
          createVNode(_component_el_button, {
            type: "primary",
            disabled: !routePick.value,
            onClick: applyRoute
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('确定')), 1)
            ]),
            _: 1
          }, 8, ["disabled"])
        ]),
        default: withCtx(() => [
          createVNode(_component_el_input, {
            modelValue: routeKw.value,
            "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((routeKw).value = $event)),
            placeholder: unref(tt)('编码 / 名称'),
            clearable: "",
            style: {"width":"220px","margin-bottom":"8px"}
          }, null, 8, ["modelValue", "placeholder"]),
          createVNode(_component_el_table, {
            data: routeFiltered.value,
            size: "small",
            border: "",
            height: "330",
            "highlight-current-row": "",
            onCurrentChange: _cache[6] || (_cache[6] = (r) => (routePick.value = r)),
            onRowDblclick: applyRoute
          }, {
            default: withCtx(() => [
              createVNode(_component_el_table_column, {
                label: unref(tt)('编码'),
                prop: "编码",
                width: "140"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('名称'),
                prop: "名称",
                width: "170",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('工序序列'),
                prop: "工序序列",
                "min-width": "220",
                "show-overflow-tooltip": ""
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('工序数'),
                prop: "工序数",
                width: "80",
                align: "right"
              }, null, 8, ["label"])
            ]),
            _: 1
          }, 8, ["data"])
        ]),
        _: 1
      }, 8, ["modelValue", "title"])
    ]),
    createBaseVNode("div", _hoisted_13, [
      createVNode(_component_el_pagination, {
        small: "",
        background: "",
        layout: "total, sizes, prev, pager, next, jumper",
        total: rows.value.length,
        "current-page": pageNo.value,
        "onUpdate:currentPage": _cache[9] || (_cache[9] = $event => ((pageNo).value = $event)),
        "page-size": pageSize.value,
        "onUpdate:pageSize": _cache[10] || (_cache[10] = $event => ((pageSize).value = $event)),
        "page-sizes": [50, 100, 200, 500]
      }, null, 8, ["total", "current-page", "page-size"])
    ])
  ]))
}
}

};
const OrderConvert = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-e889f415"]]);

export { OrderConvert as default };
