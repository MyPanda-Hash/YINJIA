import { n as ElSelect, A as ElIcon, w as ElForm, o as ElOption, m as ElFormItem, i as ElInput, D as ElCheckbox, d as ElButton } from './element-plus-W84rT0en.js';
import { c as useUserStore, h as useLocaleStore, t as tt } from './index-CqmwEeWF.js';
/* empty css                      */
/* empty css                   */
/* empty css                */
/* empty css                   */
import { q as onMounted, c as createElementBlock, a as createBaseVNode, a0 as createVNode, W as withCtx, A as unref, _ as createTextVNode, $ as toDisplayString, Z as createCommentVNode, aq as withKeys, S as normalizeClass, p as ref, z as reactive, aE as useRouter, o as openBlock, J as Fragment, ae as renderList, P as createBlock } from './vue-vendor-DyX2BAKf.js';
import { W as data_line_default, w as warning_filled_default, X as user_default, Y as lock_default, Z as office_building_default, n as arrow_right_default } from './element-icons-DOEvq9OG.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

const manufacturingImage = "/assets/login-manufacturing-eYI5rolY.webp";

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "login-page" };
const _hoisted_2 = { class: "login-locale" };
const _hoisted_3 = { class: "login-scene" };
const _hoisted_4 = ["src"];
const _hoisted_5 = { class: "scene-content" };
const _hoisted_6 = { class: "scene-subtitle" };
const _hoisted_7 = {
  class: "scene-meta",
  "aria-hidden": "true"
};
const _hoisted_8 = { class: "login-workspace" };
const _hoisted_9 = { class: "login-shell" };
const _hoisted_10 = { class: "brand" };
const _hoisted_11 = { class: "brand-mark" };
const _hoisted_12 = { class: "brand-name" };
const _hoisted_13 = { class: "brand-subtitle" };
const _hoisted_14 = { class: "login-heading" };
const _hoisted_15 = { class: "eyebrow" };
const _hoisted_16 = { class: "heading-note" };
const _hoisted_17 = {
  key: 0,
  class: "login-error",
  role: "alert"
};
const _hoisted_18 = { class: "form-options" };
const _hoisted_19 = { class: "secure-note" };
const _hoisted_20 = { class: "login-footer" };

const REMEMBERED_ACCOUNT_KEY = 'mes_login_account';

const _sfc_main = {
  __name: 'index',
  setup(__props) {

const router = useRouter();
const user = useUserStore();
const localeStore = useLocaleStore();
localeStore.loadAvailable?.();
const formRef = ref(null);
const loading = ref(false);
const factoryLoading = ref(false);
const errorMessage = ref('');
const rememberedAccount = localStorage.getItem(REMEMBERED_ACCOUNT_KEY) || '';
const rememberAccount = ref(Boolean(rememberedAccount));
const form = reactive({ userName: rememberedAccount, password: '', factory: '' });
/** 语言选项显示:本地名 (语言码)——汉字系语言(日本語/繁體中文)加码消除歧义;简体中文例外。 */
const localeLabel = (l) => l.locale === 'zh-CN'
  ? '简体中文'
  : `${l.nameNative || l.locale} (${l.locale})`;

const rules = {
  userName: [{ required: true, message: tt('请输入登录账号'), trigger: 'blur' }],
  password: [{ required: true, message: tt('请输入登录密码'), trigger: 'blur' }],
  factory: [{ required: true, message: tt('请选择登录工厂'), trigger: 'change' }],
};

function clearError() {
  errorMessage.value = '';
}

async function doLogin() {
  if (loading.value || factoryLoading.value) return
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return

  loading.value = true;
  errorMessage.value = '';
  try {
    // 所选工厂随登录请求一起发给后端(ADR-0003):它决定这次登录查哪个账套,
    // 并由后端写进令牌声明 —— 后续请求按声明路由,故换了工厂必须重新登录。
    // (账套显示名由 user.login 按登录响应里的 factory 自行落定,这里不必再补一次;
    //  switchFactory 自 2026-09-22 起是"按目标账套重登"的语义,登录流程里不能再调它。)
    await user.login({ userName: form.userName, password: form.password, factory: form.factory });
    if (rememberAccount.value) localStorage.setItem(REMEMBERED_ACCOUNT_KEY, form.userName);
    else localStorage.removeItem(REMEMBERED_ACCOUNT_KEY);
    await router.replace('/dashboard');
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || tt('登录失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  // 标记登录态供 index.html 预置深色底色(语言切换刷新无闪白)
  try { sessionStorage.setItem('mes_at_login', '1'); } catch { /* ignore */ }
  factoryLoading.value = true;
  try {
    await user.fetchFactories();
    form.factory = user.factory?.code || user.factories[0]?.code || '';
  } catch (error) {
    errorMessage.value = tt('工厂信息加载失败，请检查服务后重试');
  } finally {
    factoryLoading.value = false;
  }
});

return (_ctx, _cache) => {
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_icon = ElIcon;
  const _component_el_input = ElInput;
  const _component_el_form_item = ElFormItem;
  const _component_el_checkbox = ElCheckbox;
  const _component_el_button = ElButton;
  const _component_el_form = ElForm;

  return (openBlock(), createElementBlock("main", _hoisted_1, [
    createBaseVNode("div", _hoisted_2, [
      createVNode(_component_el_select, {
        "model-value": unref(localeStore).locale,
        size: "small",
        filterable: "",
        placeholder: unref(tt)('切换语言'),
        class: "locale-select",
        "popper-class": "locale-select-popper",
        onChange: _cache[0] || (_cache[0] = (l) => unref(localeStore).set(l))
      }, {
        default: withCtx(() => [
          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(localeStore).available, (l) => {
            return (openBlock(), createBlock(_component_el_option, {
              key: l.locale,
              value: l.locale,
              label: localeLabel(l)
            }, null, 8, ["value", "label"]))
          }), 128))
        ]),
        _: 1
      }, 8, ["model-value", "placeholder"])
    ]),
    createBaseVNode("section", _hoisted_3, [
      createBaseVNode("img", {
        src: unref(manufacturingImage),
        alt: "",
        "aria-hidden": "true"
      }, null, 8, _hoisted_4),
      _cache[7] || (_cache[7] = createBaseVNode("div", {
        class: "scene-tint",
        "aria-hidden": "true"
      }, null, -1)),
      createBaseVNode("div", _hoisted_5, [
        _cache[6] || (_cache[6] = createBaseVNode("p", { class: "scene-kicker" }, [
          createBaseVNode("span"),
          createTextVNode(" MANUFACTURING OPERATIONS ")
        ], -1)),
        createBaseVNode("h1", null, [
          createBaseVNode("strong", null, toDisplayString(unref(tt)('轻 MES')), 1),
          createTextVNode(" " + toDisplayString(unref(tt)('让生产现场')), 1),
          _cache[5] || (_cache[5] = createBaseVNode("br", null, null, -1)),
          createTextVNode(toDisplayString(unref(tt)('有序运转')), 1)
        ]),
        createBaseVNode("p", _hoisted_6, toDisplayString(unref(tt)('生产制造执行系统')), 1)
      ]),
      createBaseVNode("div", _hoisted_7, [
        createBaseVNode("span", null, toDisplayString(unref(tt)('聚焦现场')), 1),
        createBaseVNode("span", null, toDisplayString(unref(tt)('协同执行')), 1),
        createBaseVNode("span", null, toDisplayString(unref(tt)('持续改善')), 1)
      ])
    ]),
    createBaseVNode("section", _hoisted_8, [
      createBaseVNode("div", _hoisted_9, [
        createBaseVNode("header", _hoisted_10, [
          createBaseVNode("div", _hoisted_11, [
            createVNode(_component_el_icon, null, {
              default: withCtx(() => [
                createVNode(unref(data_line_default))
              ]),
              _: 1
            })
          ]),
          createBaseVNode("div", null, [
            createBaseVNode("div", _hoisted_12, toDisplayString(unref(tt)('轻 MES')), 1),
            createBaseVNode("div", _hoisted_13, toDisplayString(unref(tt)('制造协同工作台')), 1)
          ])
        ]),
        createBaseVNode("div", _hoisted_14, [
          createBaseVNode("p", _hoisted_15, toDisplayString(unref(tt)('企业账号')), 1),
          createBaseVNode("h2", null, toDisplayString(unref(tt)('登录工作台')), 1),
          createBaseVNode("p", _hoisted_16, toDisplayString(unref(tt)('进入制造协同工作台')), 1)
        ]),
        (errorMessage.value)
          ? (openBlock(), createElementBlock("div", _hoisted_17, [
              createVNode(_component_el_icon, null, {
                default: withCtx(() => [
                  createVNode(unref(warning_filled_default))
                ]),
                _: 1
              }),
              createBaseVNode("span", null, toDisplayString(errorMessage.value), 1)
            ]))
          : createCommentVNode("", true),
        createVNode(_component_el_form, {
          ref_key: "formRef",
          ref: formRef,
          model: form,
          rules: rules,
          "label-position": "top",
          size: "large",
          class: "login-form",
          onKeyup: withKeys(doLogin, ["enter"])
        }, {
          default: withCtx(() => [
            createVNode(_component_el_form_item, {
              label: unref(tt)('账号'),
              prop: "userName"
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: form.userName,
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((form.userName) = $event)),
                  modelModifiers: { trim: true },
                  "prefix-icon": unref(user_default),
                  placeholder: unref(tt)('请输入登录账号'),
                  autocomplete: "username",
                  clearable: "",
                  onInput: clearError
                }, null, 8, ["modelValue", "prefix-icon", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('密码'),
              prop: "password"
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: form.password,
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((form.password) = $event)),
                  "prefix-icon": unref(lock_default),
                  type: "password",
                  placeholder: unref(tt)('请输入登录密码'),
                  autocomplete: "current-password",
                  "show-password": "",
                  onInput: clearError
                }, null, 8, ["modelValue", "prefix-icon", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('登录工厂'),
              prop: "factory"
            }, {
              default: withCtx(() => [
                createVNode(_component_el_select, {
                  modelValue: form.factory,
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((form.factory) = $event)),
                  loading: factoryLoading.value,
                  "prefix-icon": unref(office_building_default),
                  placeholder: factoryLoading.value ? unref(tt)('正在加载工厂') : unref(tt)('请选择登录工厂'),
                  disabled: factoryLoading.value || !unref(user).factories.length,
                  onChange: clearError
                }, {
                  default: withCtx(() => [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(unref(user).factories, (factory) => {
                      return (openBlock(), createBlock(_component_el_option, {
                        key: factory.code,
                        label: factory.name,
                        value: factory.code
                      }, null, 8, ["label", "value"]))
                    }), 128))
                  ]),
                  _: 1
                }, 8, ["modelValue", "loading", "prefix-icon", "placeholder", "disabled"])
              ]),
              _: 1
            }, 8, ["label"]),
            createBaseVNode("div", _hoisted_18, [
              createVNode(_component_el_checkbox, {
                modelValue: rememberAccount.value,
                "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((rememberAccount).value = $event))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('记住账号')), 1)
                ]),
                _: 1
              }, 8, ["modelValue"]),
              createBaseVNode("span", _hoisted_19, [
                createVNode(_component_el_icon, null, {
                  default: withCtx(() => [
                    createVNode(unref(lock_default))
                  ]),
                  _: 1
                }),
                createTextVNode(" " + toDisplayString(unref(tt)('安全连接')), 1)
              ])
            ]),
            createVNode(_component_el_button, {
              type: "primary",
              class: "login-submit",
              loading: loading.value,
              disabled: factoryLoading.value,
              onClick: doLogin
            }, {
              default: withCtx(() => [
                createBaseVNode("span", null, toDisplayString(unref(tt)('进入系统')), 1),
                (!loading.value)
                  ? (openBlock(), createBlock(_component_el_icon, { key: 0 }, {
                      default: withCtx(() => [
                        createVNode(unref(arrow_right_default))
                      ]),
                      _: 1
                    }))
                  : createCommentVNode("", true)
              ]),
              _: 1
            }, 8, ["loading", "disabled"])
          ]),
          _: 1
        }, 8, ["model"]),
        createBaseVNode("footer", _hoisted_20, [
          _cache[9] || (_cache[9] = createBaseVNode("span", null, "LIGHT MES · 2026", -1)),
          createBaseVNode("span", {
            class: normalizeClass(["footer-status", { 'is-error': !factoryLoading.value && !unref(user).factories.length }])
          }, [
            _cache[8] || (_cache[8] = createBaseVNode("span", { class: "status-dot" }, null, -1)),
            createTextVNode(" " + toDisplayString(factoryLoading.value ? unref(tt)('正在连接服务') : unref(user).factories.length ? unref(tt)('服务连接正常') : unref(tt)('服务连接异常')), 1)
          ], 2)
        ])
      ])
    ])
  ]))
}
}

};
const index = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-90cb16cf"]]);

export { index as default };
