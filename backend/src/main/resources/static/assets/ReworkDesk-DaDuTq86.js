import { X as ElRow, Z as ElCard, Y as ElCol, b as ElEmpty, c as ElTag, d as ElButton } from './element-plus-W84rT0en.js';
import { w as getReworkTasks } from './index-CqmwEeWF.js';
/* empty css                */
/* empty css                  */
/* empty css                */
/* empty css                 */
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import { q as onMounted, c as createElementBlock, a as createBaseVNode, _ as createTextVNode, a0 as createVNode, W as withCtx, p as ref, o as openBlock, J as Fragment, ae as renderList, P as createBlock, R as normalizeStyle, $ as toDisplayString, S as normalizeClass, Z as createCommentVNode, f as computed } from './vue-vendor-DyX2BAKf.js';
import './element-icons-DOEvq9OG.js';

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "rework-desk" };
const _hoisted_2 = { class: "stat-label" };
const _hoisted_3 = {
  key: 1,
  class: "task-grid"
};
const _hoisted_4 = { class: "task-top" };
const _hoisted_5 = { class: "task-mo" };
const _hoisted_6 = { class: "task-line" };
const _hoisted_7 = { class: "task-line" };
const _hoisted_8 = { class: "task-line" };
const _hoisted_9 = { key: 0 };
const _hoisted_10 = { class: "task-qty" };
const _hoisted_11 = { class: "qty-total" };
const _hoisted_12 = { class: "task-actions" };


const _sfc_main = {
  __name: 'ReworkDesk',
  setup(__props) {

const tasks = ref([]);

function load() {
  tasks.value = getReworkTasks();
}

onMounted(load);

function stateTag(st) {
  return { 待返修: 'warning', 返修中: 'primary', 已返修: 'success' }[st] || 'info'
}

function act(t, action) {
}

const stats = computed(() => {
  const c = { 待返修: 0, 返修中: 0, 已返修: 0 };
  for (const t of tasks.value) c[t.返修状态] = (c[t.返修状态] ?? 0) + 1;
  return [
    { label: '待返修任务', value: c['待返修'], color: '#e6a23c' },
    { label: '返修中', value: c['返修中'], color: '#289be5' },
    { label: '已返修', value: c['已返修'], color: '#16a34a' },
  ]
});

return (_ctx, _cache) => {
  const _component_el_card = ElCard;
  const _component_el_col = ElCol;
  const _component_el_row = ElRow;
  const _component_el_empty = ElEmpty;
  const _component_el_tag = ElTag;
  const _component_el_button = ElButton;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    _cache[3] || (_cache[3] = createBaseVNode("div", { class: "head" }, [
      createBaseVNode("h3", null, [
        createTextVNode("返修工作台 "),
        createBaseVNode("span", { class: "code" }, "（待返修任务池 · 对齐 T+ 返修工作台）")
      ])
    ], -1)),
    createVNode(_component_el_row, {
      gutter: 12,
      class: "stat-row"
    }, {
      default: withCtx(() => [
        (openBlock(true), createElementBlock(Fragment, null, renderList(stats.value, (s) => {
          return (openBlock(), createBlock(_component_el_col, {
            span: 8,
            key: s.label
          }, {
            default: withCtx(() => [
              createVNode(_component_el_card, {
                shadow: "never",
                class: "stat"
              }, {
                default: withCtx(() => [
                  createBaseVNode("div", {
                    class: "stat-val",
                    style: normalizeStyle({ color: s.color })
                  }, toDisplayString(s.value), 5),
                  createBaseVNode("div", _hoisted_2, toDisplayString(s.label), 1)
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
    createVNode(_component_el_card, {
      shadow: "never",
      header: "返修任务"
    }, {
      default: withCtx(() => [
        (!tasks.value.length)
          ? (openBlock(), createBlock(_component_el_empty, {
              key: 0,
              description: "暂无返修任务",
              "image-size": 80
            }))
          : (openBlock(), createElementBlock("div", _hoisted_3, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(tasks.value, (t) => {
                return (openBlock(), createElementBlock("div", {
                  key: t.加工单号 + t.工序编码,
                  class: normalizeClass(["task", 'st-' + t.返修状态])
                }, [
                  createBaseVNode("div", _hoisted_4, [
                    createBaseVNode("span", _hoisted_5, toDisplayString(t.加工单号), 1),
                    createVNode(_component_el_tag, {
                      size: "small",
                      type: stateTag(t.返修状态)
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(t.返修状态), 1)
                      ]),
                      _: 2
                    }, 1032, ["type"])
                  ]),
                  createBaseVNode("div", _hoisted_6, toDisplayString(t.产品名称) + "（" + toDisplayString(t.规格型号) + "）", 1),
                  createBaseVNode("div", _hoisted_7, "工序：" + toDisplayString(t.工序名称) + "（" + toDisplayString(t.工序编码) + "）· " + toDisplayString(t.工作中心) + " · " + toDisplayString(t.设备), 1),
                  createBaseVNode("div", _hoisted_8, [
                    createTextVNode("责任：" + toDisplayString(t.班组) + " / " + toDisplayString(t.工人), 1),
                    (t['返修责任工序'])
                      ? (openBlock(), createElementBlock("span", _hoisted_9, " · 他序发现：" + toDisplayString(t['返修责任工序']), 1))
                      : createCommentVNode("", true)
                  ]),
                  createBaseVNode("div", _hoisted_10, [
                    createBaseVNode("span", null, "本序 " + toDisplayString(t['待返修数量-本序发现']), 1),
                    createBaseVNode("span", null, "他序 " + toDisplayString(t['待返修数量-他序发现']), 1),
                    createBaseVNode("span", _hoisted_11, "合计 " + toDisplayString(t['待返修合计']), 1)
                  ]),
                  createBaseVNode("div", _hoisted_12, [
                    (t.返修状态 === '待返修')
                      ? (openBlock(), createBlock(_component_el_button, {
                          key: 0,
                          size: "small",
                          type: "primary",
                          onClick: $event => (act(t, '开始返修'))
                        }, {
                          default: withCtx(() => [...(_cache[0] || (_cache[0] = [
                            createTextVNode("开始返修", -1)
                          ]))]),
                          _: 1
                        }, 8, ["onClick"]))
                      : createCommentVNode("", true),
                    (t.返修状态 === '返修中')
                      ? (openBlock(), createBlock(_component_el_button, {
                          key: 1,
                          size: "small",
                          type: "success",
                          onClick: $event => (act(t, '完成返修'))
                        }, {
                          default: withCtx(() => [...(_cache[1] || (_cache[1] = [
                            createTextVNode("完成返修", -1)
                          ]))]),
                          _: 1
                        }, 8, ["onClick"]))
                      : (t.返修状态 === '已返修')
                        ? (openBlock(), createBlock(_component_el_button, {
                            key: 2,
                            size: "small",
                            disabled: ""
                          }, {
                            default: withCtx(() => [...(_cache[2] || (_cache[2] = [
                              createTextVNode("已返修", -1)
                            ]))]),
                            _: 1
                          }))
                        : createCommentVNode("", true)
                  ])
                ], 2))
              }), 128))
            ]))
      ]),
      _: 1
    })
  ]))
}
}

};
const ReworkDesk = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-7fe43b69"]]);

export { ReworkDesk as default };
