import { Z as ElCard, X as ElRow, Y as ElCol, c as ElTag, d as ElButton, k as ElMessage } from './element-plus-W84rT0en.js';
import './index-CqmwEeWF.js';
/* empty css                 */
/* empty css                */
/* empty css                */
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import { c as createElementBlock, a as createBaseVNode, _ as createTextVNode, a0 as createVNode, W as withCtx, o as openBlock, J as Fragment, ae as renderList, $ as toDisplayString, P as createBlock, Z as createCommentVNode, p as ref } from './vue-vendor-DyX2BAKf.js';
import './element-icons-DOEvq9OG.js';

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "solution-center" };
const _hoisted_2 = { class: "sol" };
const _hoisted_3 = { class: "sol-name" };
const _hoisted_4 = { class: "sol-desc" };
const _hoisted_5 = { class: "sol-tags" };
const _hoisted_6 = { class: "app" };
const _hoisted_7 = { class: "app-icon" };
const _hoisted_8 = { class: "app-name" };
const _hoisted_9 = { class: "app-desc" };


const _sfc_main = {
  __name: 'SolutionCenter',
  setup(__props) {

const solutions = [
  { name: '轻MES 智能制造方案', desc: '面向中小制造企业的生产执行一体化方案：工单驱动、工序报工、计件工资、库存联动。', tags: ['生产管理', '智慧车间', '库存核算'] },
  { name: '离散制造行业方案', desc: '按单生产、多品种小批量：销售订单 → 生产工单 → 工序汇报 → 成品入库全链路。', tags: ['销售', '加工单', '汇报'] },
  { name: '流程制造行业方案', desc: '熔铸/轧制/精整连续作业场景：批号追溯、班组报工、产量看板。', tags: ['批号', '班组', '看板'] },
];

const apps = [
  { icon: '📊', name: '生产看板', desc: '车间大屏：在制进度、工序状态、产量汇总。' },
  { icon: '🔧', name: '设备点检', desc: '设备台账、点检计划、OEE 分析。' },
  { icon: '🧾', name: '计件工资', desc: '按工序汇报自动核算计件工资。' },
  { icon: '📦', name: '物料追溯', desc: '批号 + 工序 + 库存全链路追溯。' },
  { icon: '🚨', name: '交期预警', desc: '加工单/销售订单交期风险预警。' },
  { icon: '🛠️', name: '智能排产', desc: '按工序产能自动排产。' },
  { icon: '📈', name: '质量追溯', desc: '不合格品登记、返修任务跟踪。' },
  { icon: '👥', name: '班组绩效', desc: '班组产量与工资对比分析。' },
];

const installed = ref(['生产看板', '计件工资']);

function apply(s) {
  ElMessage.success(`已应用方案：${s.name}（演示环境为静态展示）`);
}

function install(a) {
  installed.value.push(a.name);
  ElMessage.success(`已安装应用：${a.name}`);
}

return (_ctx, _cache) => {
  const _component_el_tag = ElTag;
  const _component_el_button = ElButton;
  const _component_el_col = ElCol;
  const _component_el_row = ElRow;
  const _component_el_card = ElCard;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    _cache[5] || (_cache[5] = createBaseVNode("div", { class: "head" }, [
      createBaseVNode("h3", null, [
        createTextVNode("方案中心 "),
        createBaseVNode("span", { class: "code" }, "（行业方案 / 应用市场 · 对齐 T+ 方案中心形态）")
      ])
    ], -1)),
    createVNode(_component_el_card, {
      shadow: "never",
      class: "sec"
    }, {
      header: withCtx(() => [...(_cache[0] || (_cache[0] = [
        createTextVNode("行业方案", -1)
      ]))]),
      default: withCtx(() => [
        createVNode(_component_el_row, { gutter: 12 }, {
          default: withCtx(() => [
            (openBlock(), createElementBlock(Fragment, null, renderList(solutions, (s) => {
              return createVNode(_component_el_col, {
                span: 8,
                key: s.name
              }, {
                default: withCtx(() => [
                  createBaseVNode("div", _hoisted_2, [
                    createBaseVNode("div", _hoisted_3, toDisplayString(s.name), 1),
                    createBaseVNode("div", _hoisted_4, toDisplayString(s.desc), 1),
                    createBaseVNode("div", _hoisted_5, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(s.tags, (t) => {
                        return (openBlock(), createBlock(_component_el_tag, {
                          key: t,
                          size: "small",
                          effect: "plain"
                        }, {
                          default: withCtx(() => [
                            createTextVNode(toDisplayString(t), 1)
                          ]),
                          _: 2
                        }, 1024))
                      }), 128))
                    ]),
                    createVNode(_component_el_button, {
                      size: "small",
                      type: "primary",
                      onClick: $event => (apply(s))
                    }, {
                      default: withCtx(() => [...(_cache[1] || (_cache[1] = [
                        createTextVNode("应用方案", -1)
                      ]))]),
                      _: 1
                    }, 8, ["onClick"])
                  ])
                ]),
                _: 2
              }, 1024)
            }), 64))
          ]),
          _: 1
        })
      ]),
      _: 1
    }),
    createVNode(_component_el_card, {
      shadow: "never",
      class: "sec"
    }, {
      header: withCtx(() => [
        _cache[2] || (_cache[2] = createTextVNode("应用市场 ", -1)),
        (installed.value.length)
          ? (openBlock(), createBlock(_component_el_tag, {
              key: 0,
              size: "small",
              type: "success"
            }, {
              default: withCtx(() => [
                createTextVNode("已安装 " + toDisplayString(installed.value.length) + " 个", 1)
              ]),
              _: 1
            }))
          : createCommentVNode("", true)
      ]),
      default: withCtx(() => [
        createVNode(_component_el_row, { gutter: 12 }, {
          default: withCtx(() => [
            (openBlock(), createElementBlock(Fragment, null, renderList(apps, (a) => {
              return createVNode(_component_el_col, {
                span: 6,
                key: a.name
              }, {
                default: withCtx(() => [
                  createBaseVNode("div", _hoisted_6, [
                    createBaseVNode("div", _hoisted_7, toDisplayString(a.icon), 1),
                    createBaseVNode("div", _hoisted_8, toDisplayString(a.name), 1),
                    createBaseVNode("div", _hoisted_9, toDisplayString(a.desc), 1),
                    (!installed.value.includes(a.name))
                      ? (openBlock(), createBlock(_component_el_button, {
                          key: 0,
                          size: "small",
                          type: "primary",
                          onClick: $event => (install(a))
                        }, {
                          default: withCtx(() => [...(_cache[3] || (_cache[3] = [
                            createTextVNode("安装", -1)
                          ]))]),
                          _: 1
                        }, 8, ["onClick"]))
                      : (openBlock(), createBlock(_component_el_tag, {
                          key: 1,
                          size: "small",
                          type: "success"
                        }, {
                          default: withCtx(() => [...(_cache[4] || (_cache[4] = [
                            createTextVNode("已安装", -1)
                          ]))]),
                          _: 1
                        }))
                  ])
                ]),
                _: 2
              }, 1024)
            }), 64))
          ]),
          _: 1
        })
      ]),
      _: 1
    })
  ]))
}
}

};
const SolutionCenter = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-03cd693a"]]);

export { SolutionCenter as default };
