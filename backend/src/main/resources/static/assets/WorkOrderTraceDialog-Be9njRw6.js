import { a2 as ElStep, g as ElTableColumn, j as ElTable, a3 as ElSteps, f as ElDialog } from './element-plus-W84rT0en.js';
import { t as tt, r as request } from './index-CqmwEeWF.js';
/* empty css                   */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                */
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import { j as watch, o as openBlock, P as createBlock, W as withCtx, c as createElementBlock, a as createBaseVNode, $ as toDisplayString, S as normalizeClass, A as unref, Z as createCommentVNode, _ as createTextVNode, a0 as createVNode, J as Fragment, ae as renderList, p as ref } from './vue-vendor-DyX2BAKf.js';

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "wb-trace-head" };
const _hoisted_2 = { class: "wb-trace-no" };
const _hoisted_3 = {
  key: 0,
  class: "wb-tag off-line"
};
const _hoisted_4 = { class: "wb-trace-desc" };
const _hoisted_5 = {
  key: 0,
  class: "wb-trace-block"
};
const _hoisted_6 = { class: "wb-block-title" };
const _hoisted_7 = {
  class: "wb-trace-sub",
  style: {"display":"inline","margin-left":"8px"}
};
const _hoisted_8 = { key: 0 };
const _hoisted_9 = { key: 1 };
const _hoisted_10 = { class: "wb-trace-sub" };
const _hoisted_11 = {
  key: 0,
  class: "wb-trace-sub"
};
const _hoisted_12 = { class: "wb-trace-block" };
const _hoisted_13 = { class: "wb-block-title" };
const _hoisted_14 = {
  key: 1,
  class: "wb-trace-block"
};
const _hoisted_15 = { class: "wb-block-title" };
const _hoisted_16 = { class: "wb-trace-block" };
const _hoisted_17 = { class: "wb-block-title" };
const _hoisted_18 = { class: "wb-trace-block" };
const _hoisted_19 = { class: "wb-block-title" };
const _hoisted_20 = { class: "wb-trace-sub" };
const _hoisted_21 = { class: "wb-trace-block" };
const _hoisted_22 = { class: "wb-block-title" };
const _hoisted_23 = {
  key: 2,
  class: "wb-trace-block"
};
const _hoisted_24 = { class: "wb-block-title" };
const _hoisted_25 = {
  key: 1,
  class: "wb-trace-sub"
};


const _sfc_main = {
  __name: 'WorkOrderTraceDialog',
  props: {
  modelValue: { type: Boolean, default: false },
  code: { type: String, default: '' },
},
  emits: ['update:modelValue'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;
const trace = ref(null);
const prog = ref(null);
const num = (v) => { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' };

async function load() {
  const no = props.code;
  if (!no) return
  trace.value = null;
  prog.value = null;
  try {
    const [t, p] = await Promise.all([
      request.post('/px/scheduleBoard/trace', { 工单号: no }),
      request.post('/px/processTask/detail', { 工单号: no }).catch(() => ({ data: null })),
    ]);
    trace.value = t.data || {};
    prog.value = p?.data || null;
  } catch { trace.value = {}; }
}
watch(() => [props.modelValue, props.code], ([v]) => { if (v) load(); });

return (_ctx, _cache) => {
  const _component_el_step = ElStep;
  const _component_el_steps = ElSteps;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: unref(tt)('工单详情 · 追溯'),
    width: "92%",
    top: "4vh",
    "append-to-body": "",
    "onUpdate:modelValue": _cache[0] || (_cache[0] = (v) => emit('update:modelValue', v))
  }, {
    default: withCtx(() => [
      (trace.value)
        ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
            createBaseVNode("div", _hoisted_1, [
              createBaseVNode("span", _hoisted_2, toDisplayString(trace.value['头']?.['加工单号'] || __props.code), 1),
              createBaseVNode("span", {
                class: normalizeClass(["wb-tag", trace.value['头']?.['单据状态'] === '已审核' ? 'open' : 'closed'])
              }, toDisplayString(trace.value['头']?.['单据状态']), 3),
              (trace.value['头']?.['结案'] === 'Y')
                ? (openBlock(), createElementBlock("span", _hoisted_3, toDisplayString(unref(tt)('已结案')), 1))
                : createCommentVNode("", true)
            ]),
            createBaseVNode("div", _hoisted_4, [
              createBaseVNode("span", null, toDisplayString(unref(tt)('产品')) + ": " + toDisplayString(trace.value['头']?.['产品编码']) + " " + toDisplayString(trace.value['头']?.['产品名称']), 1),
              createBaseVNode("span", null, toDisplayString(unref(tt)('规格型号')) + ": " + toDisplayString(trace.value['头']?.['规格型号'] || '-'), 1),
              createBaseVNode("span", null, toDisplayString(unref(tt)('客户')) + ": " + toDisplayString(trace.value['头']?.['客户'] || '-'), 1),
              createBaseVNode("span", null, toDisplayString(unref(tt)('客户订单号')) + ": " + toDisplayString(trace.value['头']?.['客户订单号'] || '-'), 1),
              createBaseVNode("span", null, toDisplayString(unref(tt)('批号')) + ": " + toDisplayString(trace.value['头']?.['批号'] || '-'), 1),
              createBaseVNode("span", null, toDisplayString(unref(tt)('生产线')) + ": " + toDisplayString(trace.value['头']?.['生产线'] || unref(tt)('未排产')), 1),
              createBaseVNode("span", null, toDisplayString(unref(tt)('排产数量')) + ": " + toDisplayString(num(trace.value['头']?.['排产数量'])), 1),
              createBaseVNode("span", null, toDisplayString(unref(tt)('入库数量')) + ": " + toDisplayString(num(trace.value['头']?.['入库数量'])), 1),
              createBaseVNode("span", null, toDisplayString(unref(tt)('余量')) + ": " + toDisplayString(num(trace.value['头']?.['余量'])), 1)
            ]),
            (prog.value)
              ? (openBlock(), createElementBlock("div", _hoisted_5, [
                  createBaseVNode("div", _hoisted_6, [
                    createTextVNode(toDisplayString(unref(tt)('工序进度')) + " ", 1),
                    createBaseVNode("span", _hoisted_7, [
                      createTextVNode(toDisplayString(unref(tt)('工艺路线')) + ": " + toDisplayString(prog.value['表头']?.['工艺路线'] || '-') + " ｜ " + toDisplayString(unref(tt)('计划数量')) + ": " + toDisplayString(num(prog.value['计划合计'])) + " ｜ " + toDisplayString(unref(tt)('产出')) + ": " + toDisplayString(num(prog.value['产出'])) + "（" + toDisplayString(num(prog.value['表头']?.['进度'])) + "%） ", 1),
                      (prog.value['当前工序'])
                        ? (openBlock(), createElementBlock("span", _hoisted_8, "｜ " + toDisplayString(unref(tt)('当前工序')) + ": " + toDisplayString(unref(tt)(prog.value['当前工序'])), 1))
                        : (openBlock(), createElementBlock("span", _hoisted_9, "｜ " + toDisplayString(unref(tt)('未开工')), 1))
                    ])
                  ]),
                  createVNode(_component_el_steps, {
                    active: Number(prog.value['已完成步骤数'] || 0),
                    "align-center": "",
                    "finish-status": "success"
                  }, {
                    default: withCtx(() => [
                      (openBlock(true), createElementBlock(Fragment, null, renderList((prog.value['工序步骤'] || []), (s) => {
                        return (openBlock(), createBlock(_component_el_step, {
                          key: s['工序'],
                          title: unref(tt)(s['工序']),
                          status: s['状态'] === '已完工' ? 'success' : (s['状态'] === '进行中' ? 'process' : 'wait'),
                          description: `${num(s['完工量'])}/${num(s['计划量'])}` + (s['报工单数'] ? `（${s['报工单数']}${unref(tt)('单')}）` : '')
                        }, null, 8, ["title", "status", "description"]))
                      }), 128))
                    ]),
                    _: 1
                  }, 8, ["active"]),
                  createBaseVNode("div", _hoisted_10, toDisplayString(unref(tt)('绿=已完工')) + " ｜ " + toDisplayString(unref(tt)('蓝=进行中')) + " ｜ " + toDisplayString(unref(tt)('灰=未开始')) + "（" + toDisplayString(unref(tt)('工序进度')) + "） ", 1),
                  (!(prog.value['工序步骤'] || []).length)
                    ? (openBlock(), createElementBlock("div", _hoisted_11, toDisplayString(unref(tt)('该工单还没有工序进度')), 1))
                    : createCommentVNode("", true)
                ]))
              : createCommentVNode("", true),
            createBaseVNode("div", _hoisted_12, [
              createBaseVNode("div", _hoisted_13, toDisplayString(unref(tt)('流转时间线')), 1),
              createVNode(_component_el_table, {
                data: trace.value['时间线'],
                size: "small",
                border: "",
                "max-height": "180"
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('步骤'),
                    prop: "步骤",
                    width: "140"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('操作人'),
                    prop: "操作人",
                    width: "140"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('时间'),
                    prop: "时间",
                    "min-width": "160"
                  }, null, 8, ["label"])
                ]),
                _: 1
              }, 8, ["data"])
            ]),
            ((trace.value['调拨轨迹'] || []).length)
              ? (openBlock(), createElementBlock("div", _hoisted_14, [
                  createBaseVNode("div", _hoisted_15, toDisplayString(unref(tt)('调拨轨迹')), 1),
                  createVNode(_component_el_table, {
                    data: trace.value['调拨轨迹'],
                    size: "small",
                    border: "",
                    "max-height": "180"
                  }, {
                    default: withCtx(() => [
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('时间'),
                        prop: "时间",
                        width: "140"
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('从生产线'),
                        prop: "从生产线",
                        width: "110"
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('从车间'),
                        prop: "从车间",
                        width: "110"
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('到生产线'),
                        prop: "到生产线",
                        width: "110"
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('到车间'),
                        prop: "到车间",
                        width: "110"
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('数量'),
                        prop: "数量",
                        width: "85",
                        align: "right"
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('原因'),
                        prop: "原因",
                        "min-width": "120",
                        "show-overflow-tooltip": ""
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('操作人'),
                        prop: "操作人",
                        width: "90"
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('状态'),
                        prop: "状态",
                        width: "80"
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('撤销人'),
                        prop: "撤销人",
                        width: "90"
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('撤销时间'),
                        prop: "撤销时间",
                        width: "140"
                      }, null, 8, ["label"])
                    ]),
                    _: 1
                  }, 8, ["data"])
                ]))
              : createCommentVNode("", true),
            createBaseVNode("div", _hoisted_16, [
              createBaseVNode("div", _hoisted_17, toDisplayString(unref(tt)('排产数据')), 1),
              createVNode(_component_el_table, {
                data: trace.value['排产数据'],
                size: "small",
                border: "",
                "max-height": "180"
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('生产线'),
                    prop: "生产线",
                    width: "110"
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
                    label: unref(tt)('余量'),
                    prop: "余量",
                    width: "80",
                    align: "right"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('计划开工日'),
                    prop: "计划开工日",
                    width: "100"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('工序交期'),
                    prop: "工序交期",
                    width: "100"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('生产状态'),
                    prop: "生产状态",
                    width: "90"
                  }, null, 8, ["label"])
                ]),
                _: 1
              }, 8, ["data"])
            ]),
            createBaseVNode("div", _hoisted_18, [
              createBaseVNode("div", _hoisted_19, toDisplayString(unref(tt)('完工数据')), 1),
              createVNode(_component_el_table, {
                data: trace.value['完工数据'],
                size: "small",
                border: "",
                "max-height": "160",
                "empty-text": unref(tt)('暂无报工')
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('工序'),
                    prop: "工序",
                    "min-width": "120"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('计划数量'),
                    prop: "计划数量",
                    width: "100",
                    align: "right"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('完成数量'),
                    prop: "完成数量",
                    width: "100",
                    align: "right"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('报工人'),
                    prop: "报工人",
                    width: "120"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('报工时间'),
                    prop: "报工时间",
                    width: "150"
                  }, null, 8, ["label"])
                ]),
                _: 1
              }, 8, ["data", "empty-text"]),
              createBaseVNode("div", _hoisted_20, toDisplayString(unref(tt)('入库单据')) + "（" + toDisplayString((trace.value['入库单据'] || []).length) + "）", 1),
              createVNode(_component_el_table, {
                data: trace.value['入库单据'],
                size: "small",
                border: "",
                "max-height": "140",
                "empty-text": unref(tt)('暂无入库')
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('入库单号'),
                    prop: "单据编号",
                    width: "170"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('单据日期'),
                    prop: "单据日期",
                    width: "100"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('入库类别'),
                    prop: "入库类别",
                    width: "110"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('经手人'),
                    prop: "经手人",
                    width: "110"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('备注'),
                    prop: "备注",
                    "min-width": "120"
                  }, null, 8, ["label"])
                ]),
                _: 1
              }, 8, ["data", "empty-text"])
            ]),
            createBaseVNode("div", _hoisted_21, [
              createBaseVNode("div", _hoisted_22, toDisplayString(unref(tt)('领料数据')), 1),
              createVNode(_component_el_table, {
                data: trace.value['领料数据'],
                size: "small",
                border: "",
                "max-height": "180",
                "empty-text": unref(tt)('暂无领料')
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('领料单号'),
                    prop: "领料单号",
                    width: "170"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('领料日期'),
                    prop: "领料日期",
                    width: "100"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('材料编码'),
                    prop: "材料编码",
                    width: "120",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('材料名称'),
                    prop: "材料名称",
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
                    label: unref(tt)('数量'),
                    prop: "数量",
                    width: "90",
                    align: "right"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('批号'),
                    prop: "批号",
                    width: "110"
                  }, null, 8, ["label"])
                ]),
                _: 1
              }, 8, ["data", "empty-text"])
            ]),
            ((trace.value['父工单'] || []).length || (trace.value['子工单'] || []).length)
              ? (openBlock(), createElementBlock("div", _hoisted_23, [
                  createBaseVNode("div", _hoisted_24, toDisplayString(unref(tt)('血缘')), 1),
                  ((trace.value['父工单'] || []).length)
                    ? (openBlock(), createBlock(_component_el_table, {
                        key: 0,
                        data: trace.value['父工单'],
                        size: "small",
                        border: ""
                      }, {
                        default: withCtx(() => [
                          createVNode(_component_el_table_column, {
                            label: unref(tt)('父工单'),
                            prop: "工单号",
                            width: "160"
                          }, null, 8, ["label"]),
                          createVNode(_component_el_table_column, {
                            label: unref(tt)('工单行号'),
                            prop: "工单行号",
                            width: "90",
                            align: "right"
                          }, null, 8, ["label"]),
                          createVNode(_component_el_table_column, {
                            label: unref(tt)('排产数量'),
                            prop: "排产数量",
                            width: "100",
                            align: "right"
                          }, null, 8, ["label"]),
                          createVNode(_component_el_table_column, {
                            label: unref(tt)('拆分序号'),
                            prop: "拆分序号",
                            width: "90",
                            align: "right"
                          }, null, 8, ["label"])
                        ]),
                        _: 1
                      }, 8, ["data"]))
                    : createCommentVNode("", true),
                  ((trace.value['子工单'] || []).length)
                    ? (openBlock(), createBlock(_component_el_table, {
                        key: 1,
                        data: trace.value['子工单'],
                        size: "small",
                        border: "",
                        style: {"margin-top":"6px"}
                      }, {
                        default: withCtx(() => [
                          createVNode(_component_el_table_column, {
                            label: unref(tt)('子工单'),
                            prop: "工单号",
                            width: "160"
                          }, null, 8, ["label"]),
                          createVNode(_component_el_table_column, {
                            label: unref(tt)('工单行号'),
                            prop: "工单行号",
                            width: "90",
                            align: "right"
                          }, null, 8, ["label"]),
                          createVNode(_component_el_table_column, {
                            label: unref(tt)('排产数量'),
                            prop: "排产数量",
                            width: "100",
                            align: "right"
                          }, null, 8, ["label"]),
                          createVNode(_component_el_table_column, {
                            label: unref(tt)('状态'),
                            prop: "状态",
                            width: "90"
                          }, null, 8, ["label"])
                        ]),
                        _: 1
                      }, 8, ["data"]))
                    : createCommentVNode("", true)
                ]))
              : createCommentVNode("", true)
          ], 64))
        : (openBlock(), createElementBlock("div", _hoisted_25, toDisplayString(unref(tt)('加载中…')), 1))
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const WorkOrderTraceDialog = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-dad9ba93"]]);

export { WorkOrderTraceDialog as W };
