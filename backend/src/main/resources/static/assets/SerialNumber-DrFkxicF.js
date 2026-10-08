import { c as createElementBlock, a as createBaseVNode, J as Fragment, ae as renderList, aE as useRouter, o as openBlock, $ as toDisplayString } from './vue-vendor-DyX2BAKf.js';
import { u as useTabsStore } from './tabs-DN15ZjeN.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "sn-page" };
const _hoisted_2 = { class: "sn-body" };
const _hoisted_3 = { class: "sn-flow" };
const _hoisted_4 = { class: "sn-step-no" };
const _hoisted_5 = { class: "sn-step-name" };
const _hoisted_6 = { class: "sn-step-desc" };
const _hoisted_7 = { class: "sn-sec" };
const _hoisted_8 = ["onClick"];


const _sfc_main = {
  __name: 'SerialNumber',
  setup(__props) {

const router = useRouter();
const tabs = useTabsStore();

const flow = [
  { name: '启用序列号', desc: '设置存货，启用序列号管理（存货档案中启用序列号属性）' },
  { name: '入库登记', desc: '入库时扫码、录入或导入序列号，登记到序列号登记单' },
  { name: '出库扫描', desc: '出库时直接扫描序列号或选择序列号，标记已出库' },
  { name: '查询追溯', desc: '序列号状况表查状态，序列号跟踪表做追溯查询' },
];

const entries = [
  { code: 'SERIAL_NO', label: '序列号登记单' },
  { code: 'SERIAL_STATUS', label: '序列号状况表' },
  { code: 'SERIAL_TRACE', label: '序列号跟踪表' },
  { code: 'INV', label: '存货（启用序列号）' },
];

function go(code) {
  const path = '/panelx/list/' + code;
  router.push(path);
  tabs.open({ path, title: code });
}

return (_ctx, _cache) => {
  return (openBlock(), createElementBlock("div", _hoisted_1, [
    _cache[2] || (_cache[2] = createBaseVNode("div", { class: "sn-head" }, [
      createBaseVNode("div", { class: "sn-title" }, "序列号管理"),
      createBaseVNode("div", { class: "sn-sub" }, "序列号启用 → 入库登记（扫码/录入/导入）→ 出库扫描 → 序列号状况表/跟踪表追溯")
    ], -1)),
    createBaseVNode("div", _hoisted_2, [
      createBaseVNode("div", _hoisted_3, [
        (openBlock(), createElementBlock(Fragment, null, renderList(flow, (s, i) => {
          return createBaseVNode("div", {
            key: i,
            class: "sn-step"
          }, [
            createBaseVNode("div", _hoisted_4, toDisplayString(i + 1), 1),
            createBaseVNode("div", _hoisted_5, toDisplayString(s.name), 1),
            createBaseVNode("div", _hoisted_6, toDisplayString(s.desc), 1)
          ])
        }), 64))
      ]),
      createBaseVNode("div", _hoisted_7, [
        _cache[0] || (_cache[0] = createBaseVNode("span", { class: "sn-sec-title" }, "快捷入口", -1)),
        (openBlock(), createElementBlock(Fragment, null, renderList(entries, (d) => {
          return createBaseVNode("span", {
            key: d.code,
            class: "sn-btn",
            onClick: $event => (go(d.code))
          }, toDisplayString(d.label), 9, _hoisted_8)
        }), 64))
      ]),
      _cache[1] || (_cache[1] = createBaseVNode("div", { class: "sn-note" }, " 入库时：可以扫码、录入、导入序列号；出库时：直接扫描序列号或选择序列号，简单更高效。 序列号查询：通过序列号状况表查询序列号状态，通过序列号跟踪表对序列号进行追溯查询。 ", -1))
    ])
  ]))
}
}

};
const SerialNumber = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-52c1d59e"]]);

export { SerialNumber as default };
