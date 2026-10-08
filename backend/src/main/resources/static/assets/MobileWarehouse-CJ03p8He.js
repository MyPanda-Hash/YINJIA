import { c as createElementBlock, a as createBaseVNode, J as Fragment, ae as renderList, aE as useRouter, o as openBlock, $ as toDisplayString } from './vue-vendor-DyX2BAKf.js';
import { u as useTabsStore } from './tabs-DN15ZjeN.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "pda-page" };
const _hoisted_2 = { class: "pda-body" };
const _hoisted_3 = { class: "pda-flow" };
const _hoisted_4 = { class: "pda-step-no" };
const _hoisted_5 = { class: "pda-step-name" };
const _hoisted_6 = { class: "pda-step-desc" };
const _hoisted_7 = { class: "pda-sec" };
const _hoisted_8 = ["onClick"];
const _hoisted_9 = { class: "pda-sec" };
const _hoisted_10 = ["onClick"];
const _hoisted_11 = { class: "pda-sec" };
const _hoisted_12 = ["onClick"];


const _sfc_main = {
  __name: 'MobileWarehouse',
  setup(__props) {

const router = useRouter();
const tabs = useTabsStore();

const flow = [
  { name: '入库', desc: '采购入库 / 生产入库（产成品入库）/ 其他入库，扫码或录入数量' },
  { name: '上下架', desc: '货位调整、货位管理，移动货物到指定货位' },
  { name: '出库', desc: '销售出库 / 材料出库 / 其他出库，扫描或选择货物出库' },
  { name: '货位调整', desc: '库存盘点（账面/实盘/盈亏）、货位调整、库存查询' },
];

const docs = [
  { code: 'PURCHASE_IN', label: '采购入库单' },
  { code: 'FINISH_IN', label: '产成品入库单' },
  { code: 'OTHER_IN', label: '其他入库单' },
  { code: 'SALE_OUT', label: '销售出库单' },
  { code: 'MATERIAL_OUT', label: '材料出库单' },
  { code: 'OTHER_OUT', label: '其他出库单' },
  { code: 'TRANSFER', label: '调拨单' },
  { code: 'STOCK_CHECK', label: '库存盘点单' },
  { code: 'LOCATION_ADJUST', label: '货位调整单' },
];

const reports = [
  { code: 'STOCK_STATUS', label: '库存状况表' },
  { code: 'STOCK_SUMMARY', label: '收发存汇总表' },
  { code: 'STOCK_LEDGER', label: '库存台账' },
];

const archives = [
  { code: 'INV', label: '商品' },
  { code: 'UOM', label: '计量单位' },
  { code: 'DEPT', label: '部门' },
  { code: 'EMP', label: '职员' },
  { code: 'WH', label: '仓库' },
];

function go(code) {
  const path = '/panelx/list/' + code;
  router.push(path);
  tabs.open({ path, title: code });
}

return (_ctx, _cache) => {
  return (openBlock(), createElementBlock("div", _hoisted_1, [
    _cache[3] || (_cache[3] = createBaseVNode("div", { class: "pda-head" }, [
      createBaseVNode("div", { class: "pda-title" }, "移动仓管（PDA）"),
      createBaseVNode("div", { class: "pda-sub" }, "及时、精准的仓库移动作业：入库 → 上下架 → 出库 → 货位调整（点击单据直达对应面板）")
    ], -1)),
    createBaseVNode("div", _hoisted_2, [
      createBaseVNode("div", _hoisted_3, [
        (openBlock(), createElementBlock(Fragment, null, renderList(flow, (s, i) => {
          return createBaseVNode("div", {
            key: i,
            class: "pda-step"
          }, [
            createBaseVNode("div", _hoisted_4, toDisplayString(i + 1), 1),
            createBaseVNode("div", _hoisted_5, toDisplayString(s.name), 1),
            createBaseVNode("div", _hoisted_6, toDisplayString(s.desc), 1)
          ])
        }), 64))
      ]),
      createBaseVNode("div", _hoisted_7, [
        _cache[0] || (_cache[0] = createBaseVNode("span", { class: "pda-sec-title" }, "相关单据", -1)),
        (openBlock(), createElementBlock(Fragment, null, renderList(docs, (d) => {
          return createBaseVNode("span", {
            key: d.code,
            class: "pda-btn",
            onClick: $event => (go(d.code))
          }, toDisplayString(d.label), 9, _hoisted_8)
        }), 64))
      ]),
      createBaseVNode("div", _hoisted_9, [
        _cache[1] || (_cache[1] = createBaseVNode("span", { class: "pda-sec-title" }, "相关报表", -1)),
        (openBlock(), createElementBlock(Fragment, null, renderList(reports, (d) => {
          return createBaseVNode("span", {
            key: d.code,
            class: "pda-btn",
            onClick: $event => (go(d.code))
          }, toDisplayString(d.label), 9, _hoisted_10)
        }), 64))
      ]),
      createBaseVNode("div", _hoisted_11, [
        _cache[2] || (_cache[2] = createBaseVNode("span", { class: "pda-sec-title" }, "基础档案", -1)),
        (openBlock(), createElementBlock(Fragment, null, renderList(archives, (d) => {
          return createBaseVNode("span", {
            key: d.code,
            class: "pda-btn",
            onClick: $event => (go(d.code))
          }, toDisplayString(d.label), 9, _hoisted_12)
        }), 64))
      ])
    ])
  ]))
}
}

};
const MobileWarehouse = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-aa7f5c74"]]);

export { MobileWarehouse as default };
