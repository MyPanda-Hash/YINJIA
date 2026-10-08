import { a5 as ElResult, d as ElButton } from './element-plus-W84rT0en.js';
import './index-CqmwEeWF.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import { c as createElementBlock, a0 as createVNode, W as withCtx, o as openBlock, _ as createTextVNode } from './vue-vendor-DyX2BAKf.js';
import './element-icons-DOEvq9OG.js';

/* unplugin-vue-components disabled */

const _sfc_main = {  };

const _hoisted_1 = { class: "nf" };

function _sfc_render(_ctx, _cache) {
  const _component_el_button = ElButton;
  const _component_el_result = ElResult;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    createVNode(_component_el_result, {
      icon: "warning",
      title: "404",
      "sub-title": "页面不存在"
    }, {
      extra: withCtx(() => [
        createVNode(_component_el_button, {
          type: "primary",
          onClick: _cache[0] || (_cache[0] = $event => (_ctx.$router.replace('/dashboard')))
        }, {
          default: withCtx(() => [...(_cache[1] || (_cache[1] = [
            createTextVNode("回我的桌面", -1)
          ]))]),
          _: 1
        })
      ]),
      _: 1
    })
  ]))
}
const _404 = /*#__PURE__*/_export_sfc(_sfc_main, [['render',_sfc_render],['__scopeId',"data-v-90bc9aaa"]]);

export { _404 as default };
