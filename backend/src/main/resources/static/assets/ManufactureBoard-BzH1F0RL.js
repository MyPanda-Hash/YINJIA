import { X as ElRow, Y as ElCol, Z as ElCard, j as ElTable, g as ElTableColumn, c as ElTag, _ as ElProgress } from './element-plus-W84rT0en.js';
import { v as getProdBoard } from './index-CqmwEeWF.js';
/* empty css                */
/* empty css                   */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                */
/* empty css                 */
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import { c as createElementBlock, a as createBaseVNode, _ as createTextVNode, a0 as createVNode, W as withCtx, A as unref, Z as createCommentVNode, o as openBlock, J as Fragment, ae as renderList, P as createBlock, $ as toDisplayString, S as normalizeClass, f as computed } from './vue-vendor-DyX2BAKf.js';
import './element-icons-DOEvq9OG.js';

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "board-view" };
const _hoisted_2 = { class: "kpi-val" };
const _hoisted_3 = { class: "kpi-label" };
const _hoisted_4 = {
  key: 0,
  class: "hint"
};


const _sfc_main = {
  __name: 'ManufactureBoard',
  setup(__props) {

const data = getProdBoard();

function statusTag(st) {
  return { 草稿: 'info', 已审核: 'warning', 已完成: 'success', 生产中: 'primary', 已完工: 'success', 已中止: 'danger', 已关闭: 'info' }[st] || 'info'
}

const kpis = computed(() => {
  return []
});

return (_ctx, _cache) => {
  const _component_el_card = ElCard;
  const _component_el_col = ElCol;
  const _component_el_row = ElRow;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_tag = ElTag;
  const _component_el_progress = ElProgress;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    _cache[0] || (_cache[0] = createBaseVNode("div", { class: "head" }, [
      createBaseVNode("h3", null, [
        createTextVNode("生产看板 "),
        createBaseVNode("span", { class: "code" }, "（参考 T+ 生产在制看板 / 生产库存看板 / 生产运营看板）")
      ])
    ], -1)),
    createVNode(_component_el_row, {
      gutter: 12,
      class: "kpi-row"
    }, {
      default: withCtx(() => [
        (openBlock(true), createElementBlock(Fragment, null, renderList(kpis.value, (k) => {
          return (openBlock(), createBlock(_component_el_col, {
            span: 4,
            key: k.label
          }, {
            default: withCtx(() => [
              createVNode(_component_el_card, {
                shadow: "never",
                class: "kpi"
              }, {
                default: withCtx(() => [
                  createBaseVNode("div", _hoisted_2, toDisplayString(k.value), 1),
                  createBaseVNode("div", _hoisted_3, toDisplayString(k.label), 1)
                ]),
                _: 2
              }, 1024)
            ]),
            _: 2
          }, 1024))
        }), 128))
      ]),
      _: 1
    }),
    createVNode(_component_el_row, { gutter: 12 }, {
      default: withCtx(() => [
        createVNode(_component_el_col, { span: 10 }, {
          default: withCtx(() => [
            createVNode(_component_el_card, {
              shadow: "never",
              header: "车间生产状况"
            }, {
              default: withCtx(() => [
                createVNode(_component_el_table, {
                  data: unref(data).workshops || [],
                  size: "small",
                  border: ""
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_table_column, {
                      prop: "车间",
                      label: "生产车间"
                    }),
                    createVNode(_component_el_table_column, {
                      prop: "计划数量",
                      label: "计划数量",
                      align: "right"
                    }),
                    createVNode(_component_el_table_column, {
                      prop: "已完工",
                      label: "已完工工序",
                      align: "center"
                    }),
                    createVNode(_component_el_table_column, {
                      prop: "进行中",
                      label: "进行中",
                      align: "center"
                    }),
                    createVNode(_component_el_table_column, {
                      prop: "未开工",
                      label: "未开工",
                      align: "center"
                    })
                  ]),
                  _: 1
                }, 8, ["data"])
              ]),
              _: 1
            })
          ]),
          _: 1
        }),
        createVNode(_component_el_col, { span: 14 }, {
          default: withCtx(() => [
            createVNode(_component_el_card, {
              shadow: "never",
              header: "加工单生产进度"
            }, {
              default: withCtx(() => [
                createVNode(_component_el_table, {
                  data: unref(data).orders || [],
                  size: "small",
                  border: ""
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_table_column, {
                      prop: "单据编号",
                      label: "加工单号",
                      width: "150"
                    }),
                    createVNode(_component_el_table_column, {
                      prop: "产品名称",
                      label: "产品",
                      width: "130",
                      "show-overflow-tooltip": ""
                    }),
                    createVNode(_component_el_table_column, {
                      prop: "单据状态",
                      label: "状态",
                      width: "90",
                      align: "center"
                    }, {
                      default: withCtx(({ row }) => [
                        createVNode(_component_el_tag, {
                          type: statusTag(row.单据状态),
                          size: "small",
                          class: normalizeClass({ 'st-done': row.单据状态 === '已完成' })
                        }, {
                          default: withCtx(() => [
                            createTextVNode(toDisplayString(row.单据状态), 1)
                          ]),
                          _: 2
                        }, 1032, ["type", "class"])
                      ]),
                      _: 1
                    }),
                    createVNode(_component_el_table_column, {
                      prop: "生产车间",
                      label: "车间",
                      width: "100"
                    }),
                    createVNode(_component_el_table_column, {
                      label: "生产进度",
                      "min-width": "180"
                    }, {
                      default: withCtx(({ row }) => [
                        createVNode(_component_el_progress, {
                          percentage: row.进度,
                          "stroke-width": 10
                        }, null, 8, ["percentage"])
                      ]),
                      _: 1
                    }),
                    createVNode(_component_el_table_column, {
                      prop: "预完工日",
                      label: "预完工日",
                      width: "110"
                    })
                  ]),
                  _: 1
                }, 8, ["data"])
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }),
    (!unref(data))
      ? (openBlock(), createElementBlock("div", _hoisted_4, "生产看板数据接口尚未接入 SQL 后端"))
      : createCommentVNode("", true)
  ]))
}
}

};
const ManufactureBoard = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-972c2e74"]]);

export { ManufactureBoard as default };
