import { Z as ElCard, w as ElForm, m as ElFormItem, i as ElInput, z as ElDatePicker, d as ElButton, N as ElAlert, S as ElCollapse, T as ElCollapseItem, j as ElTable, g as ElTableColumn, c as ElTag, v as vLoading, A as ElIcon, b as ElEmpty } from './element-plus-W84rT0en.js';
import { r as request, t as tt } from './index-CqmwEeWF.js';
/* empty css                 */
/* empty css                  */
/* empty css                          */
/* empty css                   */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                */
/* empty css                  */
/* empty css                      */
/* empty css                        */
import { c as createElementBlock, a0 as createVNode, W as withCtx, p as ref, z as reactive, aj as resolveComponent, o as openBlock, ac as withModifiers, A as unref, aq as withKeys, _ as createTextVNode, $ as toDisplayString, P as createBlock, Z as createCommentVNode, J as Fragment, ae as renderList, X as withDirectives, a as createBaseVNode } from './vue-vendor-DyX2BAKf.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import './element-icons-DOEvq9OG.js';

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "usage-log-page" };
const _hoisted_2 = { class: "group-title" };
const _hoisted_3 = { class: "group-user" };
const _hoisted_4 = { class: "group-name" };


const _sfc_main = {
  __name: 'UsageLog',
  setup(__props) {

const q = reactive({ userName: '', panelName: '', actionName: '', range: null });
const groups = ref([]);
const total = ref(0);
const openGroups = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const params = {};
    if (q.userName) params.userName = q.userName;
    if (q.panelName) params.panelName = q.panelName;
    if (q.actionName) params.actionName = q.actionName;
    if (q.range && q.range.length === 2) { params.start = q.range[0]; params.end = q.range[1]; }
    const r = await request.get('/sys/usageLog/grouped', { params });
    groups.value = r?.data?.groups || [];
    total.value = r?.data?.total || 0;
    openGroups.value = groups.value.map((g) => g.userName);
  } finally {
    loading.value = false;
  }
}

function reset() {
  q.userName = '';
  q.panelName = '';
  q.actionName = '';
  q.range = null;
  load();
}

/** 具体操作时间:后端返回 UTC(带 +00:00),转本地时间显示,避免比北京时间慢 8 小时。 */
function fmt(t) {
  if (!t) return ''
  const d = new Date(t);
  if (isNaN(d.getTime())) return String(t).replace('T', ' ').slice(0, 19)
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

load();

return (_ctx, _cache) => {
  const _component_el_input = ElInput;
  const _component_el_form_item = ElFormItem;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_button = ElButton;
  const _component_el_form = ElForm;
  const _component_el_alert = ElAlert;
  const _component_UserFilled = resolveComponent("UserFilled");
  const _component_el_icon = ElIcon;
  const _component_el_tag = ElTag;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_collapse_item = ElCollapseItem;
  const _component_el_collapse = ElCollapse;
  const _component_el_empty = ElEmpty;
  const _component_el_card = ElCard;
  const _directive_loading = vLoading;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    createVNode(_component_el_card, {
      shadow: "never",
      class: "usage-card"
    }, {
      default: withCtx(() => [
        createVNode(_component_el_form, {
          inline: "",
          class: "usage-filter",
          onSubmit: _cache[4] || (_cache[4] = withModifiers(() => {}, ["prevent"]))
        }, {
          default: withCtx(() => [
            createVNode(_component_el_form_item, {
              label: unref(tt)('账号')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: q.userName,
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((q.userName) = $event)),
                  placeholder: unref(tt)('账号'),
                  clearable: "",
                  style: {"width":"140px"},
                  onKeyup: withKeys(load, ["enter"])
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('面板')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: q.panelName,
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((q.panelName) = $event)),
                  placeholder: unref(tt)('面板名'),
                  clearable: "",
                  style: {"width":"160px"},
                  onKeyup: withKeys(load, ["enter"])
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('动作')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: q.actionName,
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((q.actionName) = $event)),
                  placeholder: unref(tt)('按钮/动作'),
                  clearable: "",
                  style: {"width":"140px"},
                  onKeyup: withKeys(load, ["enter"])
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('操作时间')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_date_picker, {
                  modelValue: q.range,
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((q.range) = $event)),
                  type: "daterange",
                  "value-format": "YYYY-MM-DD",
                  "start-placeholder": unref(tt)('开始日期'),
                  "end-placeholder": unref(tt)('结束日期'),
                  style: {"width":"250px"}
                }, null, 8, ["modelValue", "start-placeholder", "end-placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, null, {
              default: withCtx(() => [
                createVNode(_component_el_button, {
                  type: "primary",
                  onClick: load
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('查询')), 1)
                  ]),
                  _: 1
                }),
                createVNode(_component_el_button, { onClick: reset }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('重置')), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            })
          ]),
          _: 1
        }),
        (total.value > 2000)
          ? (openBlock(), createBlock(_component_el_alert, {
              key: 0,
              type: "warning",
              closable: false,
              "show-icon": "",
              title: unref(tt)('记录超过 2000 条，仅展示最近部分，请用筛选缩小范围'),
              class: "usage-alert"
            }, null, 8, ["title"]))
          : createCommentVNode("", true),
        createVNode(_component_el_collapse, {
          modelValue: openGroups.value,
          "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((openGroups).value = $event)),
          class: "usage-groups"
        }, {
          default: withCtx(() => [
            (openBlock(true), createElementBlock(Fragment, null, renderList(groups.value, (g) => {
              return (openBlock(), createBlock(_component_el_collapse_item, {
                key: g.userName,
                name: g.userName
              }, {
                title: withCtx(() => [
                  createBaseVNode("span", _hoisted_2, [
                    createVNode(_component_el_icon, null, {
                      default: withCtx(() => [
                        createVNode(_component_UserFilled)
                      ]),
                      _: 1
                    }),
                    createBaseVNode("span", _hoisted_3, toDisplayString(g.userName), 1),
                    createBaseVNode("span", _hoisted_4, toDisplayString(g.realName), 1),
                    createVNode(_component_el_tag, {
                      size: "small",
                      type: "info",
                      class: "group-total"
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(g.total) + " " + toDisplayString(unref(tt)('条记录')), 1)
                      ]),
                      _: 2
                    }, 1024)
                  ])
                ]),
                default: withCtx(() => [
                  withDirectives((openBlock(), createBlock(_component_el_table, {
                    data: g.rows,
                    border: "",
                    stripe: "",
                    size: "small",
                    height: "360"
                  }, {
                    default: withCtx(() => [
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('操作时间'),
                        width: "170"
                      }, {
                        default: withCtx(({ row }) => [
                          createTextVNode(toDisplayString(fmt(row.createdAt)), 1)
                        ]),
                        _: 1
                      }, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('类型'),
                        width: "90",
                        align: "center"
                      }, {
                        default: withCtx(({ row }) => [
                          createVNode(_component_el_tag, {
                            type: row.eventType === 'login' ? 'success' : 'primary',
                            size: "small"
                          }, {
                            default: withCtx(() => [
                              createTextVNode(toDisplayString(row.eventType === 'login' ? unref(tt)('登录') : unref(tt)('操作')), 1)
                            ]),
                            _: 2
                          }, 1032, ["type"])
                        ]),
                        _: 1
                      }, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('面板'),
                        prop: "panelName",
                        "min-width": "150",
                        "show-overflow-tooltip": ""
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('动作'),
                        prop: "actionName",
                        width: "130",
                        "show-overflow-tooltip": ""
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('单据号'),
                        prop: "docNo",
                        "min-width": "170",
                        "show-overflow-tooltip": ""
                      }, null, 8, ["label"]),
                      createVNode(_component_el_table_column, {
                        label: unref(tt)('来源IP'),
                        prop: "ip",
                        width: "140",
                        "show-overflow-tooltip": ""
                      }, null, 8, ["label"])
                    ]),
                    _: 1
                  }, 8, ["data"])), [
                    [_directive_loading, loading.value]
                  ])
                ]),
                _: 2
              }, 1032, ["name"]))
            }), 128))
          ]),
          _: 1
        }, 8, ["modelValue"]),
        (!loading.value && !groups.value.length)
          ? (openBlock(), createBlock(_component_el_empty, {
              key: 1,
              description: unref(tt)('暂无记录'),
              "image-size": 70
            }, null, 8, ["description"]))
          : createCommentVNode("", true)
      ]),
      _: 1
    })
  ]))
}
}

};
const UsageLog = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-c7cbb978"]]);

export { UsageLog as default };
