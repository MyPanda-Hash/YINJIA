import { aE as useRouter, q as onMounted, D as onBeforeUnmount, o as openBlock, c as createElementBlock, J as Fragment, ae as renderList, a0 as createVNode, W as withCtx, a as createBaseVNode, $ as toDisplayString, A as unref, ac as withModifiers, Z as createCommentVNode, X as withDirectives, S as normalizeClass, P as createBlock, Y as resolveDynamicComponent, _ as createTextVNode, p as ref, z as reactive, f as computed, j as watch, aq as withKeys, u as nextTick, aj as resolveComponent, aD as useRoute, R as normalizeStyle, T as Teleport, a2 as Transition, aH as KeepAlive } from './vue-vendor-DyX2BAKf.js';
import { b as ElEmpty, v as vLoading, q as ElTooltip, O as ElBadge, A as ElIcon, F as ElPopover, c as ElTag, d as ElButton, f as ElDialog, k as ElMessage, r as ElRadioGroup, I as ElRadioButton, t as ElSwitch, G as ElCheckboxGroup, D as ElCheckbox, i as ElInput, J as ElDropdownMenu, K as ElDropdownItem, L as ElDropdown, P as ElDescriptions, Q as ElDescriptionsItem, w as ElForm, m as ElFormItem, R as ElScrollbar, N as ElAlert, S as ElCollapse, T as ElCollapseItem, U as ElDrawer } from './element-plus-W84rT0en.js';
import { c as useUserStore, t as tt, i as apiGetMessages, j as apiGetNotices, k as apiGetBadge, l as apiReadAllMessages, m as apiReadMessage, h as useLocaleStore, n as needsRelogin, o as flatMenus, p as filterMenuTree, q as menuTree, s as findMenuByPath } from './index-CqmwEeWF.js';
/* empty css                      */
/* empty css                */
/* empty css                   */
/* empty css                    */
/* empty css                  */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                          */
import './el-dropdown-menu-l0sNRNKZ.js';
import { u as useAppStore, a as availableQuickEntries } from './app-CjWjAKXa.js';
import { u as useTabsStore } from './tabs-DN15ZjeN.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
/* empty css                   */
/* empty css                  */
/* empty css                         */
import { _ as right_default } from './element-icons-DOEvq9OG.js';
/* empty css                  */
/* empty css                          */

/* unplugin-vue-components disabled */

const _hoisted_1$9 = { class: "notice-center" };
const _hoisted_2$9 = ["aria-label", "onClick"];
const _hoisted_3$9 = { class: "nc-head" };
const _hoisted_4$8 = { class: "nc-heading" };
const _hoisted_5$7 = { class: "nc-title" };
const _hoisted_6$7 = { class: "nc-scope" };
const _hoisted_7$7 = { class: "nc-head-actions" };
const _hoisted_8$7 = ["onClick"];
const _hoisted_9$6 = { class: "nc-list" };
const _hoisted_10$6 = ["onClick"];
const _hoisted_11$5 = { class: "nc-item-top" };
const _hoisted_12$4 = { class: "nc-item-title" };
const _hoisted_13$4 = {
  key: 0,
  class: "nc-dot"
};
const _hoisted_14$4 = { class: "nc-item-summary" };
const _hoisted_15$4 = { class: "nc-item-time" };
const _hoisted_16$4 = {
  key: 0,
  class: "nc-detail"
};
const _hoisted_17$4 = { class: "nc-detail-head" };
const _hoisted_18$4 = { class: "nc-detail-title" };
const _hoisted_19$4 = { class: "nc-detail-time" };
const _hoisted_20$4 = { class: "nc-detail-content" };
const _hoisted_21$4 = { class: "nc-history" };
const _hoisted_22$4 = ["onClick"];
const _hoisted_23$4 = { class: "nc-item-top" };
const _hoisted_24$3 = { class: "nc-item-title" };
const _hoisted_25$2 = {
  key: 0,
  class: "nc-dot"
};
const _hoisted_26$2 = { class: "nc-item-summary" };
const _hoisted_27$2 = { class: "nc-item-time" };


const _sfc_main$9 = {
  __name: 'NoticeCenter',
  setup(__props) {

const router = useRouter();
const user = useUserStore();

const types = [
  { type: 'todo', title: '待办', icon: 'Bell' },
  { type: 'msg', title: '消息', icon: 'ChatDotRound' },
  { type: 'dev', title: '产品开发', icon: 'Promotion' },
  { type: 'alarm', title: '预警', icon: 'Warning' },
];

const TAG_TYPE = { todo: 'warning', msg: 'primary', dev: 'primary', alarm: 'danger' };

const visible = ref(null);
const badge = ref({ todo: 0, msg: 0, dev: 0, alarm: 0 });
const listMap = reactive({ todo: [], msg: [], dev: [], alarm: [] });
const loadingMap = reactive({ todo: false, msg: false, dev: false, alarm: false });

// ── 业务事件消息(2026-09-09):消息码 + 参数 → i18n 模板渲染(键即中文模板,切语言消息跟着变) ──
const MSG_TPL = {
  APPROVAL_SUBMITTED: { title: '新的待审批单据', body: '{actor} 提交了「{panelName} {docNo}」，等待您审批。' },
  APPROVAL_APPROVED: { title: '审批通过', body: '您提交的「{panelName} {docNo}」已由 {actor} 审批通过。' },
  APPROVAL_REJECTED: { title: '审批被驳回', body: '您提交的「{panelName} {docNo}」被 {actor} 驳回。意见：{opinion}' },
  MODIFY_REQUESTED: { title: '新的修改申请', body: '{actor} 申请修改「{panelName} {docNo}」，等待您审批。' },
  DELETE_REQUESTED: { title: '新的删除申请', body: '{actor} 申请删除「{panelName} {docNo}」，等待您审批。' },
  // 规格书检验项目及标准变更 → 关联出货检验计划表核对(2026-09-11;仅变更提醒,不比对内容)
  SPEC_ITEMS_CHANGED: { title: '规格书检验项目已更新', body: '「规格书 {specNo}（{specName}）」的产品性能检验项目及检验标准已由 {actor} 修改，与本表（{panelName} {docNo}）可能不一致，请核对本表的必测项/型式检验。' },
  // 审批结果通知(2026-09-12 补齐):删除/修改申请的审批结果此前不通知,申请人全靠自查
  DELETE_APPROVED: { title: '删除申请已通过', body: '您申请删除的「{panelName} {docNo}」已由 {actor} 同意，单据已作废。意见：{opinion}' },
  DELETE_REJECTED: { title: '删除申请被驳回', body: '您申请删除的「{panelName} {docNo}」被 {actor} 驳回，单据保持原状态。意见：{opinion}' },
  MODIFY_APPROVED: { title: '修改申请已同意', body: '您申请修改的「{panelName} {docNo}」已由 {actor} 同意，现在可以编辑，保存后将重新归档。' },
  MODIFY_REJECTED: { title: '修改申请被驳回', body: '您申请修改的「{panelName} {docNo}」被 {actor} 驳回。意见：{opinion}' },
  // 终止二级审批四码(模板词条 en.js 已预置;此前缺模板渲染成通用「业务消息」)
  TERM_REQUESTED: { title: '新的终止申请（待立项人审批）', body: '{actor} 申请终止「{panelName} {docNo}」（终止于阶段 {stage}），等待您（立项人）审批。' },
  TERM_TO_ADMIN: { title: '终止申请待管理员审批', body: '「{panelName} {docNo}」的终止申请（阶段 {stage}）已经立项人同意，等待管理员审批落实。' },
  TERM_APPROVED: { title: '终止已落实', body: '「{panelName} {docNo}」的终止申请（阶段 {stage}）已经管理员同意，终止已落实，单据已锁定。' },
  TERM_REJECTED: { title: '终止申请被驳回', body: '「{panelName} {docNo}」的终止申请（阶段 {stage}）被 {actor} 驳回。意见：{opinion}' },
  // 规格书两级分发(2026-09-12):下发→总负责人,分发→责任人
  SPEC_DISPATCHED: { title: '产品开发已下发', body: '产品「{productName}（{productCode}）」已下发产品开发，请使用「规格书分发」安排规格书编写。' },
  SPEC_ASSIGNED: { title: '新的规格书任务', body: '「{productName}（{productCode}）」的{kind}规格书已分发给您，请填写并保存（单据 {docNo}）。' },
  // 产品变更申请单(2026-09-21):会签三码 + 生效一码 + 驳回一码。
  // ⚠ CHANGE_EFFECTIVE 的 单据编号 挂的是**新建的下一版草稿**(点开就是自己那份文件),
  //   变更单号在参数 changeNo 里 —— 文案里两个号都给出来。
  SIGNOFF_REQUESTED: { title: '新的会签请求', body: '{actor} 提交了「{panelName} {docNo}」会签，请审阅并签署意见。' },
  SIGNOFF_PASSED: { title: '会签已全部通过', body: '「{panelName} {docNo}」的会签已全部通过，已自动转交管理员审批。' },
  SIGNOFF_REJECTED: { title: '会签被驳回', body: '「{panelName} {docNo}」的会签被 {actor} 驳回，已退回草稿。意见：{opinion}' },
  CHANGE_EFFECTIVE: { title: '变更已生效：本文件要出新版', body: '变更单 {changeNo} 已生效，已为「{panelName} {docNo}」生成下一版草稿，请据此修改后重新走受控审核。' },
  CHANGE_REJECTED: { title: '变更单被驳回', body: '变更单「{panelName} {docNo}」被 {actor} 驳回，请按意见修改后重新提交。意见：{opinion}' },
  // 质量单据两级审批(2026-10-04,特采单 + 品质管理·质量单据 7 张):编制=提交审批的人、
  // 审核=一级审批通过的人、批准=超级管理员。一级通过 → 超级管理员待批准;
  // 批准通过/二级驳回 → 提交人(编制人)与一级审核人各收一条。
  APPROVAL_L2_PENDING: { title: '待超级管理员批准', body: '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}' },
  APPROVAL_L2_DONE: { title: '单据已批准', body: '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。' },
  APPROVAL_L2_REJECTED: { title: '二级审批被驳回', body: '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}' },
};

function fillTpl(text, params) {
  let out = tt(text);
  for (const [k, v] of Object.entries(params || {})) {
    out = out.split(`{${k}}`).join(v === null || v === undefined ? '' : String(v));
  }
  return out.replace(/\{[a-zA-Z]+\}/g, '').trim()
}

function mapMsg(r) {
  const tpl = MSG_TPL[r['消息码']] || { title: '业务消息', body: '{panelName} {docNo}' };
  const params = r.params || {};
  return {
    id: `msg:${r.id}`,
    rawId: r.id,
    type: 'msg',
    title: fillTpl(tpl.title, params),
    content: fillTpl(tpl.body, { ...params, panelName: params.panelName ? tt(params.panelName) : '' }),
    time: String(r['创建时间'] || '').replace('T', ' ').slice(0, 19),
    read: r['已读'] === 'Y',
    panelCode: r['面板编码'] || '',
    formNo: params.docNo || r['单据编号'] || '',
    targetPath: r['面板编码'] ? `/panelx/list/${r['面板编码']}` : '',
    actionLabel: '去处理',
  }
}

async function load(type) {
  if (loadingMap[type]) return
  loadingMap[type] = true;
  try {
    if (type === 'msg') {
      const rows = await apiGetMessages({ limit: 100 });
      listMap.msg = (rows || []).map(mapMsg);
      badge.value = { ...badge.value, msg: listMap.msg.filter((m) => !m.read).length };
    } else {
      listMap[type] = await apiGetNotices(type);
      badge.value = { ...badge.value, [type]: listMap[type].length };
    }
  } catch (e) {
    listMap[type] = [];
  } finally {
    loadingMap[type] = false;
  }
}

/** 全部已读(仅「消息」页签) */
async function readAllMsg() {
  try {
    const res = await apiReadAllMessages();
    badge.value = { ...badge.value, msg: res?.unread ?? 0 };
    listMap.msg = listMap.msg.map((m) => ({ ...m, read: true }));
    ElMessage.success(tt('已全部标记为已读'));
  } catch (e) {
    ElMessage.error(tt('操作失败'));
  }
}

const detailVisible = ref(false);
const historyVisible = ref(false);
const current = ref(null);
const currentCrg = ref(types[0]);
const historyCrg = ref(types[0]);
const historyList = ref([]);

async function refreshBadge() {
  try {
    badge.value = { ...badge.value, ...(await apiGetBadge()) };
  } catch (e) {}
}

function decorate(n) {
  return { ...n, typeTitle: types.find((t) => t.type === n.type)?.title || n.type, tagType: TAG_TYPE[n.type] || 'info' }
}

function handleHide(type) {
  if (visible.value === type) visible.value = null;
}

function openDetail(n, cfg) {
  // 业务消息:点开即已读(2026-09-09)
  if (n.type === 'msg' && !n.read && n.rawId) {
    n.read = true;
    apiReadMessage(n.rawId)
      .then((res) => { badge.value = { ...badge.value, msg: res?.unread ?? 0 }; })
      .catch(() => {});
  }
  current.value = decorate(n);
  currentCrg.value = cfg;
  visible.value = null;
  historyVisible.value = false;
  detailVisible.value = true;
}

function openHistory(cfg) {
  historyCrg.value = cfg;
  historyList.value = listMap[cfg.type].map(decorate);
  visible.value = null;
  detailVisible.value = false;
  historyVisible.value = true;
}

async function goCurrent() {
  if (!current.value?.targetPath) return
  const target = {
    path: current.value.targetPath,
    query: current.value.formNo ? { focus: current.value.formNo } : {},
  };
  detailVisible.value = false;
  historyVisible.value = false;
  await router.push(target);
}

const hasPrev = computed(() => {
  if (!current.value) return false
  const list = listMap[current.value.type] || [];
  return list.findIndex((n) => n.id === current.value.id) > 0
});

const hasNext = computed(() => {
  if (!current.value) return false
  const list = listMap[current.value.type] || [];
  const idx = list.findIndex((n) => n.id === current.value.id);
  return idx >= 0 && idx < list.length - 1
});

function step(dir) {
  if (!current.value) return
  const list = listMap[current.value.type] || [];
  const idx = list.findIndex((n) => n.id === current.value.id);
  const next = list[idx + dir];
  if (next) current.value = decorate(next);
}

let refreshTimer = null;

onMounted(() => {
  Promise.all(types.map((type) => load(type.type)));
  refreshTimer = window.setInterval(() => {
    refreshBadge();
    if (visible.value) load(visible.value);
  }, 60_000);
});

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer);
});

return (_ctx, _cache) => {
  const _component_el_icon = ElIcon;
  const _component_el_badge = ElBadge;
  const _component_el_tooltip = ElTooltip;
  const _component_el_empty = ElEmpty;
  const _component_el_popover = ElPopover;
  const _component_el_tag = ElTag;
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;
  const _directive_loading = vLoading;

  return (openBlock(), createElementBlock("div", _hoisted_1$9, [
    (openBlock(), createElementBlock(Fragment, null, renderList(types, (cfg) => {
      return createVNode(_component_el_popover, {
        key: cfg.type,
        visible: visible.value === cfg.type,
        placement: "bottom-end",
        width: 340,
        "popper-class": "notice-popover",
        onShow: $event => (load(cfg.type)),
        onHide: $event => (handleHide(cfg.type))
      }, {
        reference: withCtx(() => [
          createBaseVNode("button", {
            type: "button",
            class: normalizeClass(["nc-ref", [`type-${cfg.type}`, { active: visible.value === cfg.type }]]),
            "aria-label": `${cfg.title}${badge.value[cfg.type] ? `，${badge.value[cfg.type]} 条` : ''}`,
            onClick: $event => (visible.value = visible.value === cfg.type ? null : cfg.type)
          }, [
            createVNode(_component_el_tooltip, {
              content: cfg.title,
              placement: "bottom"
            }, {
              default: withCtx(() => [
                createVNode(_component_el_badge, {
                  value: badge.value[cfg.type],
                  max: 99,
                  hidden: !badge.value[cfg.type],
                  class: "nc-badge"
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_icon, null, {
                      default: withCtx(() => [
                        (openBlock(), createBlock(resolveDynamicComponent(cfg.icon)))
                      ]),
                      _: 2
                    }, 1024)
                  ]),
                  _: 2
                }, 1032, ["value", "hidden"])
              ]),
              _: 2
            }, 1032, ["content"])
          ], 10, _hoisted_2$9)
        ]),
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_3$9, [
            createBaseVNode("div", _hoisted_4$8, [
              createBaseVNode("span", _hoisted_5$7, toDisplayString(unref(tt)(cfg.title)), 1),
              createBaseVNode("span", _hoisted_6$7, toDisplayString(unref(user).account || unref(user).realName), 1)
            ]),
            createBaseVNode("div", _hoisted_7$7, [
              (cfg.type === 'msg' && badge.value.msg)
                ? (openBlock(), createElementBlock("span", {
                    key: 0,
                    class: "nc-more",
                    onClick: withModifiers(readAllMsg, ["stop"])
                  }, toDisplayString(unref(tt)('全部已读')), 1))
                : createCommentVNode("", true),
              createBaseVNode("span", {
                class: "nc-more",
                onClick: $event => (openHistory(cfg))
              }, toDisplayString(unref(tt)('全部')) + " " + toDisplayString(badge.value[cfg.type] || 0) + " " + toDisplayString(unref(tt)('项')), 9, _hoisted_8$7)
            ])
          ]),
          withDirectives((openBlock(), createElementBlock("div", _hoisted_9$6, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(listMap[cfg.type], (n) => {
              return (openBlock(), createElementBlock("div", {
                key: n.id,
                class: normalizeClass(["nc-item", { unread: !n.read }]),
                onClick: $event => (openDetail(n, cfg))
              }, [
                createBaseVNode("div", _hoisted_11$5, [
                  createBaseVNode("span", _hoisted_12$4, toDisplayString(n.title), 1),
                  (!n.read)
                    ? (openBlock(), createElementBlock("span", _hoisted_13$4))
                    : createCommentVNode("", true)
                ]),
                createBaseVNode("div", _hoisted_14$4, toDisplayString(n.content), 1),
                createBaseVNode("div", _hoisted_15$4, toDisplayString(n.time), 1)
              ], 10, _hoisted_10$6))
            }), 128)),
            (!listMap[cfg.type]?.length)
              ? (openBlock(), createBlock(_component_el_empty, {
                  key: 0,
                  description: unref(tt)('暂无数据'),
                  "image-size": 50
                }, null, 8, ["description"]))
              : createCommentVNode("", true)
          ])), [
            [_directive_loading, loadingMap[cfg.type]]
          ])
        ]),
        _: 2
      }, 1032, ["visible", "onShow", "onHide"])
    }), 64)),
    createVNode(_component_el_dialog, {
      modelValue: detailVisible.value,
      "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((detailVisible).value = $event)),
      title: unref(tt)(current.value?.typeTitle || '消息通知'),
      width: "560px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[0] || (_cache[0] = $event => (openHistory(currentCrg.value)))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('全部记录')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          disabled: !hasPrev.value,
          onClick: _cache[1] || (_cache[1] = $event => (step(-1)))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('上一条')), 1)
          ]),
          _: 1
        }, 8, ["disabled"]),
        createVNode(_component_el_button, {
          disabled: !hasNext.value,
          onClick: _cache[2] || (_cache[2] = $event => (step(1)))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('下一条')), 1)
          ]),
          _: 1
        }, 8, ["disabled"]),
        createVNode(_component_el_button, {
          onClick: _cache[3] || (_cache[3] = $event => (detailVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
          ]),
          _: 1
        }),
        (current.value?.targetPath)
          ? (openBlock(), createBlock(_component_el_button, {
              key: 0,
              type: "primary",
              onClick: goCurrent
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(current.value.actionLabel || '前往处理'), 1)
              ]),
              _: 1
            }))
          : createCommentVNode("", true)
      ]),
      default: withCtx(() => [
        (current.value)
          ? (openBlock(), createElementBlock("div", _hoisted_16$4, [
              createBaseVNode("div", _hoisted_17$4, [
                createVNode(_component_el_tag, {
                  size: "small",
                  type: current.value.tagType
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(current.value.typeTitle), 1)
                  ]),
                  _: 1
                }, 8, ["type"]),
                createBaseVNode("span", _hoisted_18$4, toDisplayString(current.value.title), 1)
              ]),
              createBaseVNode("div", _hoisted_19$4, toDisplayString(current.value.time), 1),
              createBaseVNode("div", _hoisted_20$4, toDisplayString(current.value.content), 1)
            ]))
          : createCommentVNode("", true)
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: historyVisible.value,
      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((historyVisible).value = $event)),
      title: `${historyCrg.value.title}记录`,
      width: "620px",
      "append-to-body": ""
    }, {
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_21$4, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(historyList.value, (n) => {
            return (openBlock(), createElementBlock("div", {
              key: n.id,
              class: normalizeClass(["nc-item", { unread: !n.read }]),
              onClick: $event => (openDetail(n, historyCrg.value))
            }, [
              createBaseVNode("div", _hoisted_23$4, [
                createVNode(_component_el_tag, {
                  size: "small",
                  type: n.tagType,
                  class: "nc-h-tag"
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(n.typeTitle), 1)
                  ]),
                  _: 2
                }, 1032, ["type"]),
                createBaseVNode("span", _hoisted_24$3, toDisplayString(n.title), 1),
                (!n.read)
                  ? (openBlock(), createElementBlock("span", _hoisted_25$2))
                  : createCommentVNode("", true)
              ]),
              createBaseVNode("div", _hoisted_26$2, toDisplayString(n.content), 1),
              createBaseVNode("div", _hoisted_27$2, toDisplayString(n.time), 1)
            ], 10, _hoisted_22$4))
          }), 128)),
          (!historyList.value.length)
            ? (openBlock(), createBlock(_component_el_empty, {
                key: 0,
                description: unref(tt)('暂无历史消息'),
                "image-size": 60
              }, null, 8, ["description"]))
            : createCommentVNode("", true)
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"])
  ]))
}
}

};
const NoticeCenter = /*#__PURE__*/_export_sfc(_sfc_main$9, [['__scopeId',"data-v-ee245374"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$8 = { class: "ui-setting" };
const _hoisted_2$8 = { class: "set-row" };
const _hoisted_3$8 = { class: "set-label" };
const _hoisted_4$7 = { class: "set-row" };
const _hoisted_5$6 = { class: "set-label" };
const _hoisted_6$6 = { class: "set-row" };
const _hoisted_7$6 = { class: "set-label" };
const _hoisted_8$6 = { class: "set-hint" };


const _sfc_main$8 = {
  __name: 'UiSettingsDialog',
  props: { modelValue: Boolean },
  emits: ['update:modelValue'],
  setup(__props) {




const app = useAppStore();
const mode = ref(app.menuMode);

watch(
  () => app.menuMode,
  (v) => { mode.value = v; }
);

return (_ctx, _cache) => {
  const _component_el_radio_button = ElRadioButton;
  const _component_el_radio_group = ElRadioGroup;
  const _component_el_switch = ElSwitch;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: unref(tt)('界面设置'),
    width: "460px",
    "append-to-body": "",
    "onUpdate:modelValue": _cache[4] || (_cache[4] = (v) => _ctx.$emit('update:modelValue', v))
  }, {
    default: withCtx(() => [
      createBaseVNode("div", _hoisted_1$8, [
        createBaseVNode("div", _hoisted_2$8, [
          createBaseVNode("div", _hoisted_3$8, toDisplayString(unref(tt)('菜单模式')), 1),
          createVNode(_component_el_radio_group, {
            modelValue: mode.value,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((mode).value = $event)),
            onChange: _cache[1] || (_cache[1] = (v) => unref(app).setMenuMode(v))
          }, {
            default: withCtx(() => [
              createVNode(_component_el_radio_button, { value: "accordion" }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('手风琴')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_radio_button, { value: "flat" }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('平铺')), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, ["modelValue"])
        ]),
        createBaseVNode("div", _hoisted_4$7, [
          createBaseVNode("div", _hoisted_5$6, toDisplayString(unref(tt)('侧边栏默认折叠')), 1),
          createVNode(_component_el_switch, {
            "model-value": unref(app).collapsed,
            onChange: _cache[2] || (_cache[2] = $event => (unref(app).toggleCollapse()))
          }, null, 8, ["model-value"])
        ]),
        createBaseVNode("div", _hoisted_6$6, [
          createBaseVNode("div", _hoisted_7$6, toDisplayString(unref(tt)('暗色模式')), 1),
          createVNode(_component_el_switch, {
            "model-value": unref(app).dark,
            onChange: _cache[3] || (_cache[3] = $event => (unref(app).toggleDark()))
          }, null, 8, ["model-value"])
        ]),
        createBaseVNode("div", _hoisted_8$6, toDisplayString(unref(tt)('设置实时生效并保存到本机浏览器。')), 1)
      ])
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const UiSettingsDialog = /*#__PURE__*/_export_sfc(_sfc_main$8, [['__scopeId',"data-v-eabda5b0"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$7 = { class: "desk-setting" };
const _hoisted_2$7 = { class: "set-group" };
const _hoisted_3$7 = { class: "set-group-title" };
const _hoisted_4$6 = {
  key: 0,
  class: "set-tip"
};
const _hoisted_5$5 = {
  key: 1,
  class: "set-tip"
};
const _hoisted_6$5 = { class: "set-group" };
const _hoisted_7$5 = { class: "set-group-title" };
const _hoisted_8$5 = { class: "set-row" };
const _hoisted_9$5 = { class: "set-row" };
const _hoisted_10$5 = { class: "set-row" };
const _hoisted_11$4 = { class: "set-hint" };


const _sfc_main$7 = {
  __name: 'DeskSettingsDialog',
  props: { modelValue: Boolean },
  emits: ['update:modelValue'],
  setup(__props) {




const app = useAppStore();
const user = useUserStore();

// 候选来自与桌面按钮同一份清单,并按当前用户的面板权限过滤
const quickOptions = computed(() => availableQuickEntries({ isAdmin: user.isAdmin, visiblePanels: user.visiblePanels }));

const quick = ref([...app.deskSettings.quick]);
const showKpi = ref(app.deskSettings.showKpi);
const showProgress = ref(app.deskSettings.showProgress);
const showTodo = ref(app.deskSettings.showTodo);

function save() {
  app.saveDeskSettings({
    quick: [...quick.value],
    showKpi: showKpi.value,
    showProgress: showProgress.value,
    showTodo: showTodo.value,
  });
}

watch(
  () => app.deskSettings,
  (s) => {
    quick.value = [...s.quick];
    showKpi.value = s.showKpi;
    showProgress.value = s.showProgress;
    showTodo.value = s.showTodo;
  },
  { deep: true }
);

return (_ctx, _cache) => {
  const _component_el_checkbox = ElCheckbox;
  const _component_el_checkbox_group = ElCheckboxGroup;
  const _component_el_switch = ElSwitch;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: unref(tt)('工作台设置'),
    width: "480px",
    "append-to-body": "",
    "onUpdate:modelValue": _cache[4] || (_cache[4] = (v) => _ctx.$emit('update:modelValue', v))
  }, {
    default: withCtx(() => [
      createBaseVNode("div", _hoisted_1$7, [
        createBaseVNode("div", _hoisted_2$7, [
          createBaseVNode("div", _hoisted_3$7, toDisplayString(unref(tt)('快捷入口')), 1),
          createVNode(_component_el_checkbox_group, {
            modelValue: quick.value,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((quick).value = $event)),
            onChange: save
          }, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(quickOptions.value, (e) => {
                return (openBlock(), createBlock(_component_el_checkbox, {
                  key: e.key,
                  value: e.key
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)(e.title)), 1)
                  ]),
                  _: 2
                }, 1032, ["value"]))
              }), 128))
            ]),
            _: 1
          }, 8, ["modelValue"]),
          (!quickOptions.value.length)
            ? (openBlock(), createElementBlock("div", _hoisted_4$6, toDisplayString(unref(tt)('当前账号没有可用的快捷入口。')), 1))
            : (openBlock(), createElementBlock("div", _hoisted_5$5, toDisplayString(unref(tt)('只列出你有权限的面板，勾选后显示在「我的桌面」右上角。')), 1))
        ]),
        createBaseVNode("div", _hoisted_6$5, [
          createBaseVNode("div", _hoisted_7$5, toDisplayString(unref(tt)('内容卡片')), 1),
          createBaseVNode("div", _hoisted_8$5, [
            createBaseVNode("span", null, toDisplayString(unref(tt)('KPI 指标卡')), 1),
            createVNode(_component_el_switch, {
              modelValue: showKpi.value,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((showKpi).value = $event)),
              onChange: save
            }, null, 8, ["modelValue"])
          ]),
          createBaseVNode("div", _hoisted_9$5, [
            createBaseVNode("span", null, toDisplayString(unref(tt)('生产进度')), 1),
            createVNode(_component_el_switch, {
              modelValue: showProgress.value,
              "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((showProgress).value = $event)),
              onChange: save
            }, null, 8, ["modelValue"])
          ]),
          createBaseVNode("div", _hoisted_10$5, [
            createBaseVNode("span", null, toDisplayString(unref(tt)('我的待办')), 1),
            createVNode(_component_el_switch, {
              modelValue: showTodo.value,
              "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((showTodo).value = $event)),
              onChange: save
            }, null, 8, ["modelValue"])
          ])
        ]),
        createBaseVNode("div", _hoisted_11$4, toDisplayString(unref(tt)('保存后回到「我的桌面」查看效果。')), 1)
      ])
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const DeskSettingsDialog = /*#__PURE__*/_export_sfc(_sfc_main$7, [['__scopeId',"data-v-94f8d6d4"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$6 = { class: "fs-body" };
const _hoisted_2$6 = { class: "fs-pair" };
const _hoisted_3$6 = { class: "fs-cell" };
const _hoisted_4$5 = { class: "fs-label" };
const _hoisted_5$4 = { class: "fs-name" };
const _hoisted_6$4 = { class: "fs-cell" };
const _hoisted_7$4 = { class: "fs-label" };
const _hoisted_8$4 = { class: "fs-name target" };
const _hoisted_9$4 = { class: "fs-hint" };
const _hoisted_10$4 = {
  key: 0,
  class: "fs-error"
};


const _sfc_main$6 = {
  __name: 'FactorySwitchDialog',
  props: {
  modelValue: Boolean,
  target: { type: Object, default: null },
},
  emits: ['update:modelValue'],
  setup(__props) {

const props = __props;


const user = useUserStore();
const password = ref('');
const loading = ref(false);
const error = ref('');
const pwdRef = ref(null);

const currentName = computed(() => user.factoryName || tt('未知账套'));
const targetName = computed(() => (props.target && props.target.name) || tt('未知账套'));

watch(() => props.modelValue, async (open) => {
  if (!open) return
  error.value = '';
  password.value = '';
  await nextTick();
  // 弹窗只为一件事而开:输密码。别让用户再点一次输入框
  pwdRef.value && pwdRef.value.focus && pwdRef.value.focus();
});

function reset() {
  password.value = '';
  error.value = '';
  loading.value = false;
}

async function submit() {
  if (loading.value) return
  if (!password.value) {
    error.value = tt('请输入密码');
    return
  }
  if (!props.target || !props.target.code) {
    error.value = tt('未选择账套');
    return
  }
  loading.value = true;
  error.value = '';
  try {
    await user.switchFactory(props.target, password.value);
    ElMessage.success(tt('已切换账套，正在重新加载') + ' ' + targetName.value);
    // 落地页也要随账套换:当前路由可能是目标账套里这个账号**没有权限**的面板
    // (2026-09-22 实测:切到权限更窄的账套后仍停在 #/panelx/list/INV,数据被服务端挡住但整排
    //  "新增/修改/保存"工具栏照旧渲染,点了只会全线报错)。交回桌面:
    //  路由守卫会给"无 DASHBOARD 权限"的账号落到第一个可见面板(见 router/index.js)。
    window.location.hash = '#/dashboard';
    setTimeout(() => window.location.reload(), 400);
  } catch (e) {
    // 与登录页同一套取错方式:后端把原因放在 ApiResult.message(如"用户名或密码错误"),
    // 直接用 e.message 会显示成 "Request failed with status code 409"
    error.value = (e && e.response && e.response.data && e.response.data.message)
      || (e && e.message)
      || tt('切换失败，请检查密码后重试');
    password.value = '';
  } finally {
    loading.value = false;
  }
}

return (_ctx, _cache) => {
  const _component_el_icon = ElIcon;
  const _component_el_input = ElInput;
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: unref(tt)('切换账套'),
    width: "440px",
    "append-to-body": "",
    class: "factory-switch-dialog",
    "onUpdate:modelValue": _cache[2] || (_cache[2] = (v) => _ctx.$emit('update:modelValue', v)),
    onClosed: reset
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, {
        disabled: loading.value,
        onClick: _cache[1] || (_cache[1] = $event => (_ctx.$emit('update:modelValue', false)))
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('取消')), 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      createVNode(_component_el_button, {
        type: "primary",
        loading: loading.value,
        onClick: submit
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('切换并重新登录')), 1)
        ]),
        _: 1
      }, 8, ["loading"])
    ]),
    default: withCtx(() => [
      createBaseVNode("div", _hoisted_1$6, [
        createBaseVNode("div", _hoisted_2$6, [
          createBaseVNode("div", _hoisted_3$6, [
            createBaseVNode("span", _hoisted_4$5, toDisplayString(unref(tt)('当前账套')), 1),
            createBaseVNode("b", _hoisted_5$4, toDisplayString(currentName.value), 1)
          ]),
          createVNode(_component_el_icon, { class: "fs-arrow" }, {
            default: withCtx(() => [
              createVNode(unref(right_default))
            ]),
            _: 1
          }),
          createBaseVNode("div", _hoisted_6$4, [
            createBaseVNode("span", _hoisted_7$4, toDisplayString(unref(tt)('切换到')), 1),
            createBaseVNode("b", _hoisted_8$4, toDisplayString(targetName.value), 1)
          ])
        ]),
        createVNode(_component_el_input, {
          ref_key: "pwdRef",
          ref: pwdRef,
          modelValue: password.value,
          "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((password).value = $event)),
          type: "password",
          "show-password": "",
          placeholder: unref(tt)('请输入该账套的登录密码'),
          disabled: loading.value,
          onKeyup: withKeys(submit, ["enter"])
        }, null, 8, ["modelValue", "placeholder", "disabled"]),
        createBaseVNode("div", _hoisted_9$4, toDisplayString(unref(tt)('账套绑定在登录令牌上，切换需要用目标账套的密码重新登录；成功后页面会刷新，菜单与数据全部按新账套重建。')), 1),
        (error.value)
          ? (openBlock(), createElementBlock("div", _hoisted_10$4, toDisplayString(error.value), 1))
          : createCommentVNode("", true)
      ])
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const FactorySwitchDialog = /*#__PURE__*/_export_sfc(_sfc_main$6, [['__scopeId',"data-v-4059d1aa"]]);

/* unplugin-vue-components disabled */

/* unplugin-vue-components disabled */

const _hoisted_1$5 = { class: "topbar" };
const _hoisted_2$5 = { class: "t-left" };
const _hoisted_3$5 = ["aria-label", "title"];
const _hoisted_4$4 = { class: "factory-name" };
const _hoisted_5$3 = { class: "factory-item" };
const _hoisted_6$3 = { class: "t-center" };
const _hoisted_7$3 = {
  class: "t-user-info",
  id: "useraccount"
};
const _hoisted_8$3 = { class: "attestation" };
const _hoisted_9$3 = { class: "att-box" };
const _hoisted_10$3 = { class: "att-text" };
const _hoisted_11$3 = { class: "company" };
const _hoisted_12$3 = {
  class: "t-user-info",
  id: "logindate"
};
const _hoisted_13$3 = {
  class: "t-user-info",
  id: "serviceEndTime"
};
const _hoisted_14$3 = { class: "t-right" };
const _hoisted_15$3 = ["aria-label", "title"];
const _hoisted_16$3 = { class: "factory-name" };
const _hoisted_17$3 = {
  key: 0,
  class: "search-drop"
};
const _hoisted_18$3 = ["onClick"];
const _hoisted_19$3 = { class: "s-content" };
const _hoisted_20$3 = { class: "s-title" };
const _hoisted_21$3 = { class: "s-meta" };
const _hoisted_22$3 = {
  key: 0,
  class: "s-code"
};
const _hoisted_23$3 = ["title"];
const _hoisted_24$2 = {
  key: 1,
  class: "search-empty"
};
const _hoisted_25$1 = { class: "gonggao" };
const _hoisted_26$1 = {
  key: 0,
  class: "new-icon"
};
const _hoisted_27$1 = { class: "nc-head" };
const _hoisted_28$1 = { class: "nc-title" };
const _hoisted_29$1 = { class: "nc-list" };
const _hoisted_30$1 = ["onClick"];
const _hoisted_31$1 = { class: "nc-item-top" };
const _hoisted_32$1 = { class: "nc-item-title" };
const _hoisted_33$1 = {
  key: 0,
  class: "nc-dot"
};
const _hoisted_34$1 = { class: "nc-item-time" };
const _hoisted_35$1 = { class: "bar-icon" };
const _hoisted_36$1 = { class: "bar-icon" };
const _hoisted_37$1 = { class: "user" };
const _hoisted_38$1 = { class: "show-name" };
const _hoisted_39$1 = {
  key: 0,
  class: "nc-detail"
};
const _hoisted_40$1 = { class: "nc-detail-head" };
const _hoisted_41 = { class: "nc-detail-title" };
const _hoisted_42 = { class: "nc-detail-time" };
const _hoisted_43 = { class: "nc-detail-content" };


const _sfc_main$5 = {
  __name: 'TopBar',
  setup(__props) {

const app = useAppStore();
const user = useUserStore();
const localeStore = useLocaleStore();
localeStore.loadAvailable?.();
/** 语言选项显示:本地名 (语言码);简体中文例外。 */
const localeLabel = (l) => l.locale === 'zh-CN'
  ? '简体中文'
  : `${l.nameNative || l.locale} (${l.locale})`;
const tabs = useTabsStore();
const router = useRouter();

// ---------- 内嵌搜索 ----------
const keyword = ref('');
const searchOpen = ref(false);
const searchWrapRef = ref(null);

// ---------- 账套(工厂)切换:ADR-0003 —— 账套绑在令牌里,切换必须重登 ----------
const factorySwitchVisible = ref(false);
const factorySwitchTarget = ref(null);
/** 选中另一个账套:同一个就提示一下;不同的才弹密码框(不验密换不掉库,见 FactorySwitchDialog) */
function onPickFactory(f) {
  if (!f || !f.code) return
  if (!needsRelogin(user.factory && user.factory.code, f.code)) {
    ElMessage.info(tt('已经是当前账套'));
    return
  }
  factorySwitchTarget.value = f;
  factorySwitchVisible.value = true;
}

const matched = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return []
  return flatMenus(filterMenuTree(menuTree, user.visiblePanels, user.isAdmin))
    .filter((m) => {
      if (!m.path) return false
      return [m.title, m.fullTitle, m.panelCode, m.path]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(k))
    })
    .slice(0, 10)
});

function onSearchInput() {
  searchOpen.value = !!keyword.value.trim();
}

function go(m) {
  router.push(m.path);
  tabs.open(m);
  keyword.value = '';
  searchOpen.value = false;
}

function goFirst() {
  if (matched.value.length) go(matched.value[0]);
}

function onDocClick(e) {
  if (searchWrapRef.value && !searchWrapRef.value.contains(e.target)) searchOpen.value = false;
}

onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));

// ---------- 更新公告 ----------
const noticePop = ref(false);
const notices = ref([]);
const noticeDetailVisible = ref(false);
const currentNotice = ref(null);

const hasUnread = computed(() => notices.value.some((n) => !n.read));

async function loadNotices() {
  if (notices.value.length) return
  try {
    notices.value = await apiGetNotices('notice');
  } catch (e) {}
}

function openNotice(n) {
  currentNotice.value = n;
  noticePop.value = false;
  noticeDetailVisible.value = true;
}

// ---------- 工厂 ----------
async function refreshFactories() {
  await user.fetchFactories();
  ElMessage.success('企业信息已刷新');
}

// ---------- 帮助下拉 ----------
function onHelpCommand(cmd) {
  if (cmd === 'docs') app.openHelp('help');
  else if (cmd === 'ai') app.openHelp('knowledge');
  else if (cmd === 'guide') app.openInitWizard();
  else if (cmd === 'about') aboutVisible.value = true;
}

// ---------- 用户下拉 ----------
const uiSettingVisible = ref(false);
const deskSettingVisible = ref(false);
const accountVisible = ref(false);
const pwdVisible = ref(false);
const aboutVisible = ref(false);
const pwdForm = ref({ old: '', next: '', confirm: '' });

function onUserCommand(cmd) {
  if (cmd === 'account') accountVisible.value = true;
  else if (cmd === 'org') router.push('/sys/org');
  else if (cmd === 'usage') router.push('/sys/usage');
  else if (cmd === 'pwd') pwdVisible.value = true;
  else if (cmd === 'ui') uiSettingVisible.value = true;
  else if (cmd === 'dark') app.toggleDark();
  else if (cmd === 'desk') deskSettingVisible.value = true;
  else if (cmd === 'init') app.openInitWizard();
  else if (cmd === 'logout') {
    user.logout();
    router.replace('/login');
  }
}

function changePwd() {
  const f = pwdForm.value;
  if (!f.old || !f.next || !f.confirm) return ElMessage.warning('请填写完整')
  if (f.old !== '123456') return ElMessage.error('原密码不正确（演示账号原密码 123456）')
  if (f.next.length < 6) return ElMessage.warning('新密码至少 6 位')
  if (f.next !== f.confirm) return ElMessage.warning('两次输入的新密码不一致')
  pwdVisible.value = false;
  pwdForm.value = { old: '', next: '', confirm: '' };
  ElMessage.success('密码修改成功（演示环境不落库）');
}

return (_ctx, _cache) => {
  const _component_Menu = resolveComponent("Menu");
  const _component_el_icon = ElIcon;
  const _component_OfficeBuilding = resolveComponent("OfficeBuilding");
  const _component_ArrowDown = resolveComponent("ArrowDown");
  const _component_el_dropdown_item = ElDropdownItem;
  const _component_el_dropdown_menu = ElDropdownMenu;
  const _component_el_dropdown = ElDropdown;
  const _component_Refresh = resolveComponent("Refresh");
  const _component_el_tooltip = ElTooltip;
  const _component_CircleCheckFilled = resolveComponent("CircleCheckFilled");
  const _component_Check = resolveComponent("Check");
  const _component_Search = resolveComponent("Search");
  const _component_el_input = ElInput;
  const _component_el_empty = ElEmpty;
  const _component_el_popover = ElPopover;
  const _component_Iphone = resolveComponent("Iphone");
  const _component_FullScreen = resolveComponent("FullScreen");
  const _component_QuestionFilled = resolveComponent("QuestionFilled");
  const _component_UserFilled = resolveComponent("UserFilled");
  const _component_View = resolveComponent("View");
  const _component_User = resolveComponent("User");
  const _component_Key = resolveComponent("Key");
  const _component_Setting = resolveComponent("Setting");
  const _component_Brush = resolveComponent("Brush");
  const _component_Monitor = resolveComponent("Monitor");
  const _component_MagicStick = resolveComponent("MagicStick");
  const _component_SwitchButton = resolveComponent("SwitchButton");
  const _component_el_tag = ElTag;
  const _component_el_dialog = ElDialog;
  const _component_el_descriptions_item = ElDescriptionsItem;
  const _component_el_descriptions = ElDescriptions;
  const _component_el_form_item = ElFormItem;
  const _component_el_form = ElForm;
  const _component_el_button = ElButton;

  return (openBlock(), createElementBlock("div", _hoisted_1$5, [
    createBaseVNode("div", _hoisted_2$5, [
      createVNode(_component_el_icon, {
        class: "hamburger",
        onClick: _cache[0] || (_cache[0] = $event => (unref(app).toggleMobileNav()))
      }, {
        default: withCtx(() => [
          createVNode(_component_Menu)
        ]),
        _: 1
      }),
      _cache[18] || (_cache[18] = createBaseVNode("div", { class: "logo" }, [
        createTextVNode("轻"),
        createBaseVNode("span", null, "MES")
      ], -1)),
      _cache[19] || (_cache[19] = createBaseVNode("div", { class: "t-split" }, null, -1)),
      createVNode(_component_el_dropdown, { onCommand: onPickFactory }, {
        dropdown: withCtx(() => [
          createVNode(_component_el_dropdown_menu, null, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(user).factories, (f) => {
                return (openBlock(), createBlock(_component_el_dropdown_item, {
                  key: f.code,
                  command: f
                }, {
                  default: withCtx(() => [
                    createBaseVNode("span", _hoisted_5$3, toDisplayString(f.name), 1)
                  ]),
                  _: 2
                }, 1032, ["command"]))
              }), 128))
            ]),
            _: 1
          })
        ]),
        default: withCtx(() => [
          createBaseVNode("span", {
            class: "factory",
            "aria-label": unref(user).factoryName || unref(tt)('选择工厂'),
            title: unref(user).factoryName || unref(tt)('选择工厂')
          }, [
            createVNode(_component_el_icon, null, {
              default: withCtx(() => [
                createVNode(_component_OfficeBuilding)
              ]),
              _: 1
            }),
            createBaseVNode("span", _hoisted_4$4, toDisplayString(unref(user).factoryName || unref(tt)('选择工厂')), 1),
            createVNode(_component_el_icon, { class: "caret" }, {
              default: withCtx(() => [
                createVNode(_component_ArrowDown)
              ]),
              _: 1
            })
          ], 8, _hoisted_3$5)
        ]),
        _: 1
      }),
      createVNode(_component_el_tooltip, {
        content: unref(tt)('刷新企业名字'),
        placement: "bottom"
      }, {
        default: withCtx(() => [
          createVNode(_component_el_icon, {
            class: "refresh-icon",
            onClick: refreshFactories
          }, {
            default: withCtx(() => [
              createVNode(_component_Refresh)
            ]),
            _: 1
          })
        ]),
        _: 1
      }, 8, ["content"])
    ]),
    createBaseVNode("div", _hoisted_6$3, [
      createBaseVNode("span", _hoisted_7$3, toDisplayString(unref(user).account || unref(user).realName), 1),
      createBaseVNode("span", _hoisted_8$3, [
        createBaseVNode("span", _hoisted_9$3, [
          createVNode(_component_el_icon, { class: "att-icon" }, {
            default: withCtx(() => [
              createVNode(_component_CircleCheckFilled)
            ]),
            _: 1
          }),
          createBaseVNode("span", _hoisted_10$3, toDisplayString(unref(tt)('已认证')), 1)
        ]),
        createBaseVNode("span", _hoisted_11$3, toDisplayString(unref(user).factoryName), 1)
      ]),
      createBaseVNode("span", _hoisted_12$3, toDisplayString(unref(tt)('登录日期')) + " " + toDisplayString(unref(user).loginDateText), 1),
      createBaseVNode("span", _hoisted_13$3, toDisplayString(unref(tt)('服务到期')) + " " + toDisplayString(unref(user).serviceEnd), 1)
    ]),
    createBaseVNode("div", _hoisted_14$3, [
      createVNode(_component_el_dropdown, {
        onCommand: _cache[1] || (_cache[1] = (l) => unref(localeStore).set(l)),
        "popper-class": "locale-glass-popper"
      }, {
        dropdown: withCtx(() => [
          createVNode(_component_el_dropdown_menu, null, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(localeStore).available, (l) => {
                return (openBlock(), createBlock(_component_el_dropdown_item, {
                  key: l.locale,
                  command: l.locale
                }, {
                  default: withCtx(() => [
                    createBaseVNode("span", {
                      class: normalizeClass(["locale-option", { 'locale-active': unref(localeStore).locale === l.locale }])
                    }, [
                      createTextVNode(toDisplayString(localeLabel(l)) + " ", 1),
                      (unref(localeStore).locale === l.locale)
                        ? (openBlock(), createBlock(_component_el_icon, {
                            key: 0,
                            class: "locale-check"
                          }, {
                            default: withCtx(() => [
                              createVNode(_component_Check)
                            ]),
                            _: 1
                          }))
                        : createCommentVNode("", true)
                    ], 2)
                  ]),
                  _: 2
                }, 1032, ["command"]))
              }), 128))
            ]),
            _: 1
          })
        ]),
        default: withCtx(() => [
          createBaseVNode("span", {
            class: "factory locale-switch",
            "aria-label": unref(tt)('切换语言'),
            title: unref(tt)('切换语言') + ' — ' + unref(tt)('按 Alt+L 快速切换')
          }, [
            createBaseVNode("span", _hoisted_16$3, toDisplayString(unref(localeStore).shortLabel), 1),
            createVNode(_component_el_icon, { class: "caret" }, {
              default: withCtx(() => [
                createVNode(_component_ArrowDown)
              ]),
              _: 1
            })
          ], 8, _hoisted_15$3)
        ]),
        _: 1
      }),
      createBaseVNode("div", {
        class: "search-wrap",
        ref_key: "searchWrapRef",
        ref: searchWrapRef
      }, [
        createVNode(_component_el_input, {
          modelValue: keyword.value,
          "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((keyword).value = $event)),
          class: "search-input",
          placeholder: unref(tt)('搜索-产品功能'),
          clearable: "",
          onInput: onSearchInput,
          onFocus: onSearchInput,
          onKeyup: withKeys(goFirst, ["enter"])
        }, {
          suffix: withCtx(() => [
            createVNode(_component_el_icon, {
              class: "search-icon",
              onMousedown: _cache[2] || (_cache[2] = withModifiers(() => {}, ["prevent"]))
            }, {
              default: withCtx(() => [
                createVNode(_component_Search)
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["modelValue", "placeholder"]),
        (searchOpen.value)
          ? (openBlock(), createElementBlock("div", _hoisted_17$3, [
              (matched.value.length)
                ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(matched.value, (m) => {
                    return (openBlock(), createElementBlock("div", {
                      key: m.path,
                      class: "search-item",
                      onMousedown: _cache[4] || (_cache[4] = withModifiers(() => {}, ["prevent"])),
                      onClick: $event => (go(m))
                    }, [
                      createVNode(_component_el_icon, { class: "s-icon" }, {
                        default: withCtx(() => [
                          (openBlock(), createBlock(resolveDynamicComponent(m.icon || 'Folder')))
                        ]),
                        _: 2
                      }, 1024),
                      createBaseVNode("span", _hoisted_19$3, [
                        createBaseVNode("span", _hoisted_20$3, toDisplayString(unref(tt)(m.fullTitle || m.title)), 1),
                        createBaseVNode("span", _hoisted_21$3, [
                          (m.panelCode)
                            ? (openBlock(), createElementBlock("span", _hoisted_22$3, toDisplayString(m.panelCode), 1))
                            : createCommentVNode("", true),
                          createBaseVNode("span", {
                            class: "s-path",
                            title: m.path
                          }, toDisplayString(m.path), 9, _hoisted_23$3)
                        ])
                      ])
                    ], 40, _hoisted_18$3))
                  }), 128))
                : (openBlock(), createElementBlock("div", _hoisted_24$2, toDisplayString(unref(tt)('无匹配菜单')), 1))
            ]))
          : createCommentVNode("", true)
      ], 512),
      createVNode(_component_el_popover, {
        visible: noticePop.value,
        "onUpdate:visible": _cache[5] || (_cache[5] = $event => ((noticePop).value = $event)),
        placement: "bottom-end",
        width: 340,
        trigger: "click",
        onShow: loadNotices
      }, {
        reference: withCtx(() => [
          createBaseVNode("span", _hoisted_25$1, [
            createTextVNode(toDisplayString(unref(tt)('更新公告')) + " ", 1),
            (hasUnread.value)
              ? (openBlock(), createElementBlock("span", _hoisted_26$1, "new"))
              : createCommentVNode("", true)
          ])
        ]),
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_27$1, [
            createBaseVNode("span", _hoisted_28$1, toDisplayString(unref(tt)('更新公告')), 1)
          ]),
          createBaseVNode("div", _hoisted_29$1, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(notices.value, (n) => {
              return (openBlock(), createElementBlock("div", {
                key: n.id,
                class: normalizeClass(["nc-item", { unread: !n.read }]),
                onClick: $event => (openNotice(n))
              }, [
                createBaseVNode("div", _hoisted_31$1, [
                  createBaseVNode("span", _hoisted_32$1, toDisplayString(n.title), 1),
                  (!n.read)
                    ? (openBlock(), createElementBlock("span", _hoisted_33$1))
                    : createCommentVNode("", true)
                ]),
                createBaseVNode("div", _hoisted_34$1, toDisplayString(n.time), 1)
              ], 10, _hoisted_30$1))
            }), 128)),
            (!notices.value.length)
              ? (openBlock(), createBlock(_component_el_empty, {
                  key: 0,
                  description: unref(tt)('暂无公告'),
                  "image-size": 50
                }, null, 8, ["description"]))
              : createCommentVNode("", true)
          ])
        ]),
        _: 1
      }, 8, ["visible"]),
      createVNode(_component_el_tooltip, {
        content: unref(tt)('移动端扫码报工（建设中）'),
        placement: "bottom"
      }, {
        default: withCtx(() => [
          createBaseVNode("span", _hoisted_35$1, [
            createVNode(_component_el_icon, null, {
              default: withCtx(() => [
                createVNode(_component_Iphone)
              ]),
              _: 1
            })
          ])
        ]),
        _: 1
      }, 8, ["content"]),
      createVNode(NoticeCenter),
      createVNode(_component_el_tooltip, {
        content: unref(app).fullscreen ? unref(tt)('退出全屏') : unref(tt)('全屏'),
        placement: "bottom"
      }, {
        default: withCtx(() => [
          createBaseVNode("span", {
            class: "bar-icon",
            onClick: _cache[6] || (_cache[6] = (...args) => (unref(app).toggleFullscreen && unref(app).toggleFullscreen(...args)))
          }, [
            createVNode(_component_el_icon, null, {
              default: withCtx(() => [
                createVNode(_component_FullScreen)
              ]),
              _: 1
            })
          ])
        ]),
        _: 1
      }, 8, ["content"]),
      createVNode(_component_el_dropdown, {
        onCommand: onHelpCommand,
        "popper-class": "t-dropdown-popper"
      }, {
        dropdown: withCtx(() => [
          createVNode(_component_el_dropdown_menu, null, {
            default: withCtx(() => [
              createVNode(_component_el_dropdown_item, { command: "docs" }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('帮助文档')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_dropdown_item, { command: "ai" }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('AI 智能帮助')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_dropdown_item, { command: "guide" }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('显示新手引导')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_dropdown_item, {
                command: "about",
                divided: ""
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('关于')), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ]),
        default: withCtx(() => [
          createVNode(_component_el_tooltip, {
            content: unref(tt)('帮助'),
            placement: "bottom"
          }, {
            default: withCtx(() => [
              createBaseVNode("span", _hoisted_36$1, [
                createVNode(_component_el_icon, null, {
                  default: withCtx(() => [
                    createVNode(_component_QuestionFilled)
                  ]),
                  _: 1
                })
              ])
            ]),
            _: 1
          }, 8, ["content"])
        ]),
        _: 1
      }),
      createVNode(_component_el_dropdown, {
        onCommand: onUserCommand,
        "popper-class": "t-dropdown-popper"
      }, {
        dropdown: withCtx(() => [
          createVNode(_component_el_dropdown_menu, null, {
            default: withCtx(() => [
              (unref(user).isAdmin)
                ? (openBlock(), createBlock(_component_el_dropdown_item, {
                    key: 0,
                    command: "org"
                  }, {
                    default: withCtx(() => [
                      createVNode(_component_el_icon, null, {
                        default: withCtx(() => [
                          createVNode(_component_OfficeBuilding)
                        ]),
                        _: 1
                      }),
                      createTextVNode(toDisplayString(unref(tt)('组织架构')), 1)
                    ]),
                    _: 1
                  }))
                : createCommentVNode("", true),
              (unref(user).isAdmin)
                ? (openBlock(), createBlock(_component_el_dropdown_item, {
                    key: 1,
                    command: "usage"
                  }, {
                    default: withCtx(() => [
                      createVNode(_component_el_icon, null, {
                        default: withCtx(() => [
                          createVNode(_component_View)
                        ]),
                        _: 1
                      }),
                      createTextVNode(toDisplayString(unref(tt)('使用权限查看')), 1)
                    ]),
                    _: 1
                  }))
                : createCommentVNode("", true),
              createVNode(_component_el_dropdown_item, { command: "account" }, {
                default: withCtx(() => [
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      createVNode(_component_User)
                    ]),
                    _: 1
                  }),
                  createTextVNode(toDisplayString(unref(tt)('账号管理')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_dropdown_item, { command: "pwd" }, {
                default: withCtx(() => [
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      createVNode(_component_Key)
                    ]),
                    _: 1
                  }),
                  createTextVNode(toDisplayString(unref(tt)('修改密码')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_dropdown_item, { command: "ui" }, {
                default: withCtx(() => [
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      createVNode(_component_Setting)
                    ]),
                    _: 1
                  }),
                  createTextVNode(toDisplayString(unref(tt)('界面设置')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_dropdown_item, { command: "dark" }, {
                default: withCtx(() => [
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      createVNode(_component_Brush)
                    ]),
                    _: 1
                  }),
                  createTextVNode(toDisplayString(unref(app).dark ? unref(tt)('切换亮色') : unref(tt)('换肤（暗色）')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_dropdown_item, { command: "desk" }, {
                default: withCtx(() => [
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      createVNode(_component_Monitor)
                    ]),
                    _: 1
                  }),
                  createTextVNode(toDisplayString(unref(tt)('工作台设置')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_dropdown_item, { command: "init" }, {
                default: withCtx(() => [
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      createVNode(_component_MagicStick)
                    ]),
                    _: 1
                  }),
                  createTextVNode(toDisplayString(unref(tt)('初始化向导')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_dropdown_item, {
                command: "logout",
                divided: ""
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      createVNode(_component_SwitchButton)
                    ]),
                    _: 1
                  }),
                  createTextVNode(toDisplayString(unref(tt)('退出')), 1)
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ]),
        default: withCtx(() => [
          createBaseVNode("span", _hoisted_37$1, [
            createVNode(_component_el_icon, { class: "user-img" }, {
              default: withCtx(() => [
                createVNode(_component_UserFilled)
              ]),
              _: 1
            }),
            createBaseVNode("span", _hoisted_38$1, toDisplayString(unref(user).realName), 1)
          ])
        ]),
        _: 1
      })
    ]),
    createVNode(_component_el_dialog, {
      modelValue: noticeDetailVisible.value,
      "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((noticeDetailVisible).value = $event)),
      title: unref(tt)('更新公告'),
      width: "560px",
      "append-to-body": ""
    }, {
      default: withCtx(() => [
        (currentNotice.value)
          ? (openBlock(), createElementBlock("div", _hoisted_39$1, [
              createBaseVNode("div", _hoisted_40$1, [
                createBaseVNode("span", _hoisted_41, toDisplayString(currentNotice.value.title), 1),
                (!currentNotice.value.read)
                  ? (openBlock(), createBlock(_component_el_tag, {
                      key: 0,
                      size: "small",
                      type: "danger"
                    }, {
                      default: withCtx(() => [...(_cache[20] || (_cache[20] = [
                        createTextVNode("new", -1)
                      ]))]),
                      _: 1
                    }))
                  : createCommentVNode("", true)
              ]),
              createBaseVNode("div", _hoisted_42, toDisplayString(currentNotice.value.time), 1),
              createBaseVNode("div", _hoisted_43, toDisplayString(currentNotice.value.content), 1)
            ]))
          : createCommentVNode("", true)
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: accountVisible.value,
      "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((accountVisible).value = $event)),
      title: unref(tt)('账号管理'),
      width: "440px",
      "append-to-body": ""
    }, {
      default: withCtx(() => [
        createVNode(_component_el_descriptions, {
          column: 1,
          border: "",
          size: "small"
        }, {
          default: withCtx(() => [
            createVNode(_component_el_descriptions_item, {
              label: unref(tt)('账号')
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(user).account), 1)
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_descriptions_item, {
              label: unref(tt)('姓名')
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(user).realName), 1)
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_descriptions_item, {
              label: unref(tt)('当前工厂')
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(user).factoryName), 1)
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_descriptions_item, {
              label: unref(tt)('角色')
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(tt)((unref(user).userInfo?.roles || []).join('、')) || unref(tt)('未分配')), 1)
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_descriptions_item, {
              label: unref(tt)('服务到期')
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(user).serviceEnd), 1)
              ]),
              _: 1
            }, 8, ["label"])
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: pwdVisible.value,
      "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((pwdVisible).value = $event)),
      title: unref(tt)('修改密码'),
      width: "420px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[12] || (_cache[12] = $event => (pwdVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: changePwd
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('确定')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createVNode(_component_el_form, {
          model: pwdForm.value,
          "label-width": "80px"
        }, {
          default: withCtx(() => [
            createVNode(_component_el_form_item, {
              label: unref(tt)('原密码')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: pwdForm.value.old,
                  "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((pwdForm.value.old) = $event)),
                  type: "password",
                  "show-password": "",
                  placeholder: unref(tt)('请输入原密码')
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('新密码')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: pwdForm.value.next,
                  "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((pwdForm.value.next) = $event)),
                  type: "password",
                  "show-password": "",
                  placeholder: unref(tt)('至少 6 位')
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('确认密码')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: pwdForm.value.confirm,
                  "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((pwdForm.value.confirm) = $event)),
                  type: "password",
                  "show-password": "",
                  placeholder: unref(tt)('再次输入新密码')
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"])
          ]),
          _: 1
        }, 8, ["model"])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: aboutVisible.value,
      "onUpdate:modelValue": _cache[14] || (_cache[14] = $event => ((aboutVisible).value = $event)),
      title: "关于 YINJIA-MES",
      width: "420px",
      "append-to-body": ""
    }, {
      default: withCtx(() => [...(_cache[21] || (_cache[21] = [
        createBaseVNode("div", { class: "about" }, [
          createBaseVNode("div", { class: "about-logo" }, [
            createTextVNode("YJ"),
            createBaseVNode("span", null, "MES")
          ]),
          createBaseVNode("div", { class: "about-row" }, "版本：v0.2.0(light-mes 引擎同步版)"),
          createBaseVNode("div", { class: "about-row" }, "数据源:SQL Server HSDZ_MES(宏晟电子)"),
          createBaseVNode("div", { class: "about-row" }, "技术栈:Vue3 + Element Plus / Spring Boot 3 + SQL Server"),
          createBaseVNode("div", { class: "about-row about-copy" }, "© 2026 YINJIA-MES 项目组")
        ], -1)
      ]))]),
      _: 1
    }, 8, ["modelValue"]),
    createVNode(UiSettingsDialog, {
      modelValue: uiSettingVisible.value,
      "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => ((uiSettingVisible).value = $event))
    }, null, 8, ["modelValue"]),
    createVNode(DeskSettingsDialog, {
      modelValue: deskSettingVisible.value,
      "onUpdate:modelValue": _cache[16] || (_cache[16] = $event => ((deskSettingVisible).value = $event))
    }, null, 8, ["modelValue"]),
    createVNode(FactorySwitchDialog, {
      modelValue: factorySwitchVisible.value,
      "onUpdate:modelValue": _cache[17] || (_cache[17] = $event => ((factorySwitchVisible).value = $event)),
      target: factorySwitchTarget.value
    }, null, 8, ["modelValue", "target"])
  ]))
}
}

};
const TopBar = /*#__PURE__*/_export_sfc(_sfc_main$5, [['__scopeId',"data-v-52ee2dc7"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$4 = { class: "func-zone" };
const _hoisted_2$4 = ["onClick", "onMouseenter"];
const _hoisted_3$4 = {
  key: 0,
  class: "nav-modules"
};
const _hoisted_4$3 = ["onMouseenter", "onClick"];
const _hoisted_5$2 = { class: "card-body" };
const _hoisted_6$2 = { class: "card-group-title" };
const _hoisted_7$2 = { class: "card-items" };
const _hoisted_8$2 = ["title", "onClick"];
const _hoisted_9$2 = { class: "bill-list" };
const _hoisted_10$2 = ["onClick"];
const _hoisted_11$2 = { class: "module" };
const _hoisted_12$2 = { class: "bill-list mt12" };
const _hoisted_13$2 = ["onClick"];
const _hoisted_14$2 = { class: "module" };
const _hoisted_15$2 = {
  key: 1,
  class: "mobile-nav"
};
const _hoisted_16$2 = { class: "mn-head" };
const _hoisted_17$2 = {
  key: 1,
  class: "mn-brand"
};
const _hoisted_18$2 = { class: "mn-title" };
const _hoisted_19$2 = { class: "mn-quick" };
const _hoisted_20$2 = { class: "mn-list" };
const _hoisted_21$2 = ["onClick"];
const _hoisted_22$2 = { class: "mn-label" };
const _hoisted_23$2 = {
  key: 1,
  class: "mn-empty"
};


const _sfc_main$4 = {
  __name: 'LeftNav',
  setup(__props) {

const route = useRoute();
const router = useRouter();
const tabs = useTabsStore();
const app = useAppStore();
const user = useUserStore();
const navRef = ref(null);
const cardRef = ref(null);

// 角色权限过滤后的菜单树（操作员仅见被授权面板）
const menuTree$1 = computed(() => filterMenuTree(menuTree, user.visiblePanels, user.isAdmin));

const expandedGroup = ref('');
const cardModule = ref(null);
const cardTop = ref(0);
const cardPointerTop = ref(24);
const cardMaxHeight = ref(420);
let cardAnchorEl = null;
const billSearchVisible = ref(false);
const billAddVisible = ref(false);
const billKeyword = ref('');

const bills = computed(() => {
  const out = [];
  for (const g of menuTree$1.value) {
    for (const m of g.children || []) {
      const walk = (n, parents = []) => {
        if (n.path) {
          const fullTitle = n.fullTitle || [...parents, n.title].join(' / ');
          out.push({ ...n, fullTitle, module: `${g.title} / ${m.title}` });
        }
        if (n.children) n.children.forEach((child) => walk(child, [...parents, n.title]));
      };
      m.children?.forEach((child) => walk(child));
    }
  }
  return out.filter((b) => b.path)
});

const billMatches = computed(() => {
  const k = billKeyword.value.trim().toLowerCase();
  if (!k) return bills.value
  return bills.value.filter((b) => `${b.fullTitle} ${b.module}`.toLowerCase().includes(k))
});

function isExpanded(g) {
  if (app.menuMode === 'flat') return !!g.children
  return expandedGroup.value === g.code
}

function clickGroup(g) {
  if (!g.children) {
    go(g);
    return
  }
  if (app.collapsed) {
    app.toggleCollapse();
    expandedGroup.value = g.code;
    return
  }
  if (app.menuMode === 'flat') return
  expandedGroup.value = expandedGroup.value === g.code ? '' : g.code;
}

async function openCard(m, e) {
  if (!m.children || !m.children.length) return
  cardModule.value = m;
  if (e?.currentTarget) cardAnchorEl = e.currentTarget;
  await nextTick();
  updateCardPosition();
}

function toggleCard(m, e) {
  // 叶子模块（无 children，如业务总览）：直接跳转，不弹浮层
  if (!m.children || !m.children.length) {
    go(m);
    return
  }
  if (cardModule.value === m) closeCard();
  else openCard(m, e);
}

function closeCard() {
  cardModule.value = null;
  cardAnchorEl = null;
}

// 弹层尽量从所选菜单项开始展示；空间不足时自动上移，指示箭头仍精确指向所选项。
async function updateCardPosition() {
  if (!cardModule.value || !cardAnchorEl || !navRef.value || !cardRef.value) return

  const navRect = navRef.value.getBoundingClientRect();
  const anchorRect = cardAnchorEl.getBoundingClientRect();
  const visibleBottom = Math.min(navRect.bottom, window.innerHeight);
  const availableHeight = Math.max(180, visibleBottom - navRect.top - 16);
  cardMaxHeight.value = availableHeight;

  await nextTick();
  if (!cardRef.value) return

  const cardHeight = Math.min(cardRef.value.offsetHeight, availableHeight);
  const anchorTop = anchorRect.top - navRect.top;
  const anchorCenter = anchorTop + anchorRect.height / 2;
  const minTop = 8;
  const maxTop = Math.max(minTop, visibleBottom - navRect.top - cardHeight - 8);
  const nextTop = Math.min(Math.max(anchorTop, minTop), maxTop);
  const pointerInset = 14;

  cardTop.value = nextTop;
  cardPointerTop.value = Math.min(
    Math.max(anchorCenter - nextTop, pointerInset),
    Math.max(pointerInset, cardHeight - pointerInset)
  );
}

// ===== 移动端：层级堆叠导航（下钻式） =====
// mStack 记录当前下钻路径上的分组节点；空 = 顶层（menuTree 全部分组）
const mStack = ref([]);
const mnLevel = computed(() => {
  const top = mStack.value.length ? mStack.value[mStack.value.length - 1] : null;
  if (!top) return menuTree$1.value
  return top.children || []
});
const mnTitle = computed(() => {
  if (!mStack.value.length) return '全部功能'
  return mStack.value[mStack.value.length - 1].title
});
function mnClick(n) {
  if (n.children && n.children.length) mStack.value.push(n);
  else go(n);
}
function mBack() {
  if (mStack.value.length) mStack.value.pop();
}
// 每次打开抽屉回到顶层
watch(
  () => app.mobileNav,
  (v) => {
    if (v) mStack.value = [];
  }
);

function go(leaf) {
  router.push(leaf.path);
  tabs.open(leaf);
  closeCard();
  // 移动端：跳转后关闭抽屉
  if (app.mobileNav) app.toggleMobileNav();
}

function goBill(b, isNew) {
  router.push({ path: b.path, query: isNew ? { new: 1 } : {} });
  tabs.open(b);
  billSearchVisible.value = false;
  billAddVisible.value = false;
  billKeyword.value = '';
  // 移动端：跳转后关闭抽屉
  if (app.mobileNav) app.toggleMobileNav();
}

function groupOrPath(path) {
  for (const g of menuTree$1.value) {
    const walk = (n) => {
      if (n.path === path) return true
      if (n.children) return n.children.some(walk)
      return false
    };
    if (g.path === path) return g
    if (g.children && g.children.some(walk)) return g
  }
  return null
}

const cardColumns = computed(() => {
  const m = cardModule.value;
  if (!m) return []
  if (!m.children || !m.children.length) return [{ title: m.title, items: [m] }]
  // 2026-10-14 删除 `m.code === 'mfg'` 特判:生产制造原多包一层空壳二级目录「生产管理」,
  // 只好在这里"穿"一层才展开出 生产计划/生产执行/… 的分列。该层已在 business/menus.js 拍平
  // (业务域直接挂在「生产制造」下),生产制造现与 智能供应链/品质管理/基础档案 走同一条通用分支。
  if (m.code === 'rd') {
    // 研发管理:二级目录全是分组 → 以「直接含面板的分组」为列(项目管理/数据记录表/实验室使用记录表/产品文件),
    // 不再像旧结构那样额外拼一列「研发管理」直属叶子(改版后直属叶子为空,会多出一个空列)
    return leafGroupColumns(m)
  }
  if (m.children[0]?.children) {
    // 子节点有子分类(如 单据/明细表/统计表)→ 按子分类分列
    return m.children.map((cat) => ({ title: cat.title, items: flattenCardItems(cat.children || [cat]) }))
  }
  // 子节点全是叶子 → 合并为一列竖排
  return [{ title: m.title, items: m.children.flatMap((mod) => flattenCardItems([mod])) }]
});

function flattenCardItems(nodes) {
  const out = [];
  const walk = (node, depth) => {
    if (node.path) out.push({ ...node, depth });
    if (node.children) node.children.forEach((child) => walk(child, node.path ? depth + 1 : depth));
  };
  nodes.forEach((node) => walk(node, 0));
  return out
}

/** 悬停浮层列:以「直接含面板(叶子)的分组」为列,递归穿过纯分组层——
 *  既不产生空列,也不会把不同分组的叶子混进同一列(如 数据记录表 / 实验室使用记录表 各成一列)。 */
function leafGroupColumns(node) {
  const out = [];
  const walk = (parent) => {
    const children = parent.children || [];
    const leaves = children.filter((c) => !c.children || !c.children.length);
    const groups = children.filter((c) => c.children && c.children.length);
    if (leaves.length) out.push({ title: parent.title, items: flattenCardItems(leaves) });
    groups.forEach(walk);
  };
  walk(node);
  return out
}
watch(
  () => route.path,
  (p) => {
    const g = groupOrPath(p);
    if (g && g.children) expandedGroup.value = g.code;
  },
  { immediate: true }
);

watch(
  () => [billSearchVisible.value, billAddVisible.value],
  () => { billKeyword.value = ''; }
);

onMounted(() => window.addEventListener('resize', updateCardPosition));
onBeforeUnmount(() => window.removeEventListener('resize', updateCardPosition));

return (_ctx, _cache) => {
  const _component_Expand = resolveComponent("Expand");
  const _component_el_icon = ElIcon;
  const _component_el_tooltip = ElTooltip;
  const _component_Search = resolveComponent("Search");
  const _component_Plus = resolveComponent("Plus");
  const _component_ArrowDown = resolveComponent("ArrowDown");
  const _component_ArrowRight = resolveComponent("ArrowRight");
  const _component_el_scrollbar = ElScrollbar;
  const _component_el_input = ElInput;
  const _component_el_empty = ElEmpty;
  const _component_el_dialog = ElDialog;
  const _component_el_alert = ElAlert;
  const _component_Document = resolveComponent("Document");

  return (openBlock(), createElementBlock("div", {
    ref_key: "navRef",
    ref: navRef,
    class: normalizeClass(["leftnav", { collapsed: unref(app).collapsed, 'mobile-open': unref(app).mobileNav }]),
    onMouseleave: closeCard
  }, [
    createBaseVNode("div", _hoisted_1$4, [
      createVNode(_component_el_tooltip, {
        content: unref(app).collapsed ? '展开菜单' : '折叠菜单',
        placement: "right"
      }, {
        default: withCtx(() => [
          createVNode(_component_el_icon, {
            class: "rz-icon",
            onClick: _cache[0] || (_cache[0] = $event => (unref(app).toggleCollapse()))
          }, {
            default: withCtx(() => [
              createVNode(_component_Expand)
            ]),
            _: 1
          })
        ]),
        _: 1
      }, 8, ["content"]),
      createVNode(_component_el_tooltip, {
        content: "单据查询",
        placement: "right"
      }, {
        default: withCtx(() => [
          createVNode(_component_el_icon, {
            class: "rz-icon",
            onClick: _cache[1] || (_cache[1] = $event => (billSearchVisible.value = true))
          }, {
            default: withCtx(() => [
              createVNode(_component_Search)
            ]),
            _: 1
          })
        ]),
        _: 1
      }),
      createVNode(_component_el_tooltip, {
        content: "新增单据",
        placement: "right"
      }, {
        default: withCtx(() => [
          createVNode(_component_el_icon, {
            class: "rz-icon",
            onClick: _cache[2] || (_cache[2] = $event => (billAddVisible.value = true))
          }, {
            default: withCtx(() => [
              createVNode(_component_Plus)
            ]),
            _: 1
          })
        ]),
        _: 1
      })
    ]),
    createVNode(_component_el_scrollbar, { class: "nav-scroll" }, {
      default: withCtx(() => [
        (openBlock(true), createElementBlock(Fragment, null, renderList(menuTree$1.value, (g) => {
          return (openBlock(), createElementBlock(Fragment, {
            key: g.code
          }, [
            createVNode(_component_el_tooltip, {
              content: g.title,
              placement: "right",
              disabled: !unref(app).collapsed
            }, {
              default: withCtx(() => [
                createBaseVNode("div", {
                  class: normalizeClass(["nav-group", { active: groupOrPath(unref(route).path)?.code === g.code }]),
                  onClick: $event => (clickGroup(g)),
                  onMouseenter: $event => (openCard(g, $event))
                }, [
                  createVNode(_component_el_icon, { class: "gi" }, {
                    default: withCtx(() => [
                      (openBlock(), createBlock(resolveDynamicComponent(g.icon || 'Folder')))
                    ]),
                    _: 2
                  }, 1024),
                  createBaseVNode("span", null, toDisplayString(unref(tt)(g.title)), 1),
                  (g.children)
                    ? (openBlock(), createBlock(_component_el_icon, {
                        key: 0,
                        class: normalizeClass(["arrow", { down: isExpanded(g) }])
                      }, {
                        default: withCtx(() => [
                          createVNode(_component_ArrowDown)
                        ]),
                        _: 1
                      }, 8, ["class"]))
                    : createCommentVNode("", true)
                ], 42, _hoisted_2$4)
              ]),
              _: 2
            }, 1032, ["content", "disabled"]),
            (g.children && !unref(app).collapsed && isExpanded(g))
              ? (openBlock(), createElementBlock("div", _hoisted_3$4, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(g.children, (m) => {
                    return (openBlock(), createElementBlock("div", {
                      key: m.code,
                      class: normalizeClass(["nav-module", { active: cardModule.value?.code === m.code }]),
                      onMouseenter: $event => (openCard(m, $event)),
                      onClick: $event => (toggleCard(m, $event))
                    }, [
                      createBaseVNode("span", null, toDisplayString(unref(tt)(m.title)), 1),
                      createVNode(_component_el_icon, { class: "mi" }, {
                        default: withCtx(() => [
                          createVNode(_component_ArrowRight)
                        ]),
                        _: 1
                      })
                    ], 42, _hoisted_4$3))
                  }), 128))
                ]))
              : createCommentVNode("", true)
          ], 64))
        }), 128))
      ]),
      _: 1
    }),
    (cardModule.value)
      ? (openBlock(), createElementBlock("div", {
          key: 0,
          ref_key: "cardRef",
          ref: cardRef,
          class: "fly-card",
          style: normalizeStyle({
        top: cardTop.value + 'px',
        '--fly-pointer-top': cardPointerTop.value + 'px',
        '--fly-card-max-height': cardMaxHeight.value + 'px',
      })
        }, [
          createBaseVNode("div", _hoisted_5$2, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(cardColumns.value, (cat) => {
              return (openBlock(), createElementBlock("div", {
                key: cat.title,
                class: "card-group"
              }, [
                createBaseVNode("div", _hoisted_6$2, toDisplayString(unref(tt)(cat.title)), 1),
                createBaseVNode("div", _hoisted_7$2, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(cat.items, (leaf) => {
                    return (openBlock(), createElementBlock("div", {
                      key: leaf.code,
                      class: normalizeClass(["card-item", { 'is-parent': leaf.children?.length, nested: leaf.depth > 0 }]),
                      style: normalizeStyle({ '--card-depth': leaf.depth || 0 }),
                      title: unref(tt)(leaf.fullTitle || leaf.title),
                      onClick: $event => (go(leaf))
                    }, [
                      createBaseVNode("span", null, toDisplayString(unref(tt)(leaf.title)), 1)
                    ], 14, _hoisted_8$2))
                  }), 128))
                ])
              ]))
            }), 128))
          ])
        ], 4))
      : createCommentVNode("", true),
    createVNode(_component_el_dialog, {
      modelValue: billSearchVisible.value,
      "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((billSearchVisible).value = $event)),
      title: "单据查询",
      width: "560px",
      "append-to-body": ""
    }, {
      default: withCtx(() => [
        createVNode(_component_el_input, {
          modelValue: billKeyword.value,
          "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((billKeyword).value = $event)),
          placeholder: "输入单据名称关键字",
          "prefix-icon": _ctx.Search,
          clearable: ""
        }, null, 8, ["modelValue", "prefix-icon"]),
        createBaseVNode("div", _hoisted_9$2, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(billMatches.value, (b) => {
            return (openBlock(), createElementBlock("div", {
              key: `${b.code}:${b.path}`,
              class: "bill-item",
              onClick: $event => (goBill(b))
            }, [
              createVNode(_component_el_icon, null, {
                default: withCtx(() => [
                  (openBlock(), createBlock(resolveDynamicComponent(b.icon || 'Tickets')))
                ]),
                _: 2
              }, 1024),
              createBaseVNode("span", null, toDisplayString(unref(tt)(b.fullTitle || b.title)), 1),
              createBaseVNode("span", _hoisted_11$2, toDisplayString(unref(tt)(b.module)), 1)
            ], 8, _hoisted_10$2))
          }), 128)),
          (!billMatches.value.length)
            ? (openBlock(), createBlock(_component_el_empty, {
                key: 0,
                description: "无匹配单据",
                "image-size": 60
              }))
            : createCommentVNode("", true)
        ])
      ]),
      _: 1
    }, 8, ["modelValue"]),
    createVNode(_component_el_dialog, {
      modelValue: billAddVisible.value,
      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((billAddVisible).value = $event)),
      title: "新增单据",
      width: "560px",
      "append-to-body": ""
    }, {
      default: withCtx(() => [
        createVNode(_component_el_alert, {
          type: "info",
          closable: false,
          "show-icon": "",
          title: "选择单据类型，进入新增页（当前为占位页，后续接入真实单据表单）"
        }),
        createBaseVNode("div", _hoisted_12$2, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(billMatches.value, (b) => {
            return (openBlock(), createElementBlock("div", {
              key: `${b.code}:${b.path}`,
              class: "bill-item",
              onClick: $event => (goBill(b, true))
            }, [
              createVNode(_component_el_icon, null, {
                default: withCtx(() => [
                  (openBlock(), createBlock(resolveDynamicComponent(b.icon || 'Tickets')))
                ]),
                _: 2
              }, 1024),
              createBaseVNode("span", null, toDisplayString(b.fullTitle || b.title), 1),
              createBaseVNode("span", _hoisted_14$2, toDisplayString(b.module), 1)
            ], 8, _hoisted_13$2))
          }), 128)),
          (!billMatches.value.length)
            ? (openBlock(), createBlock(_component_el_empty, {
                key: 0,
                description: "无匹配单据",
                "image-size": 60
              }))
            : createCommentVNode("", true)
        ])
      ]),
      _: 1
    }, 8, ["modelValue"]),
    (unref(app).mobileNav)
      ? (openBlock(), createElementBlock("div", _hoisted_15$2, [
          createBaseVNode("div", _hoisted_16$2, [
            (mStack.value.length)
              ? (openBlock(), createElementBlock("span", {
                  key: 0,
                  class: "mn-back",
                  onClick: mBack
                }, "‹ 返回"))
              : (openBlock(), createElementBlock("span", _hoisted_17$2, "YINJIA-MES")),
            createBaseVNode("span", _hoisted_18$2, toDisplayString(mnTitle.value), 1),
            createBaseVNode("span", {
              class: "mn-close",
              onClick: _cache[6] || (_cache[6] = $event => (unref(app).toggleMobileNav()))
            }, "✕")
          ]),
          createBaseVNode("div", _hoisted_19$2, [
            createBaseVNode("span", {
              class: "mn-q",
              onClick: _cache[7] || (_cache[7] = $event => (billSearchVisible.value = true))
            }, [
              createVNode(_component_el_icon, null, {
                default: withCtx(() => [
                  createVNode(_component_Search)
                ]),
                _: 1
              }),
              _cache[9] || (_cache[9] = createTextVNode("单据查询", -1))
            ]),
            createBaseVNode("span", {
              class: "mn-q",
              onClick: _cache[8] || (_cache[8] = $event => (billAddVisible.value = true))
            }, [
              createVNode(_component_el_icon, null, {
                default: withCtx(() => [
                  createVNode(_component_Plus)
                ]),
                _: 1
              }),
              _cache[10] || (_cache[10] = createTextVNode("新增单据", -1))
            ])
          ]),
          createBaseVNode("div", _hoisted_20$2, [
            (mnLevel.value.length)
              ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(mnLevel.value, (n) => {
                  return (openBlock(), createElementBlock("div", {
                    key: n.code,
                    class: "mn-item",
                    onClick: $event => (mnClick(n))
                  }, [
                    createVNode(_component_el_icon, { class: "mn-ic" }, {
                      default: withCtx(() => [
                        (openBlock(), createBlock(resolveDynamicComponent(n.icon || 'Folder')))
                      ]),
                      _: 2
                    }, 1024),
                    createBaseVNode("span", _hoisted_22$2, toDisplayString(n.title), 1),
                    (n.path && n.children?.length)
                      ? (openBlock(), createBlock(_component_el_icon, {
                          key: 0,
                          class: "mn-open",
                          title: `打开${n.title}`,
                          onClick: withModifiers($event => (go(n)), ["stop"])
                        }, {
                          default: withCtx(() => [
                            createVNode(_component_Document)
                          ]),
                          _: 1
                        }, 8, ["title", "onClick"]))
                      : createCommentVNode("", true),
                    (n.children && n.children.length)
                      ? (openBlock(), createBlock(_component_el_icon, {
                          key: 1,
                          class: "mn-arrow"
                        }, {
                          default: withCtx(() => [
                            createVNode(_component_ArrowRight)
                          ]),
                          _: 1
                        }))
                      : createCommentVNode("", true)
                  ], 8, _hoisted_21$2))
                }), 128))
              : (openBlock(), createElementBlock("div", _hoisted_23$2, "暂无菜单"))
          ])
        ]))
      : createCommentVNode("", true)
  ], 34))
}
}

};
const LeftNav = /*#__PURE__*/_export_sfc(_sfc_main$4, [['__scopeId',"data-v-ba51536f"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$3 = { class: "tabsbar" };
const _hoisted_2$3 = {
  class: "tabs",
  ref: "tabsWrapRef"
};
const _hoisted_3$3 = ["onClick", "onContextmenu"];
const _hoisted_4$2 = { class: "tab-actions" };


const _sfc_main$3 = {
  __name: 'TabsBar',
  setup(__props) {

const tabs = useTabsStore();
const app = useAppStore();
const router = useRouter();
const route = useRoute();

// 路由变化时同步活动页签的 query/标题（含 生单跳转 ?code= 等），保证切回页签数据不丢
watch(
  () => route.fullPath,
  () => tabs.sync(route),
  { immediate: true }
);
const ctx = ref({ tab: null, x: 0, y: 0 });

function go(t) {
  tabs.setActive(t.path);
  // 恢复页签携带的 query（如 ?code=单据号），修复切换单据回来数据丢失
  router.push({ path: t.path, query: t.query || {} });
}

function refresh() {
  router.replace({ path: route.path, query: { ...route.query, _t: Date.now() } });
}

function showCtx(tab, e) {
  ctx.value = { tab, x: e.clientX, y: e.clientY + 4 };
}

function doCtx(cmd) {
  const { tab } = ctx.value;
  ctx.value.tab = null;
  if (cmd === 'refresh') refresh();
  else if (cmd === 'close') closeAndGo(tab.path);
  else if (cmd === 'others') { tabs.closeOthers(tab.path); router.replace(tab.path); }
  else if (cmd === 'all') { tabs.closeAll(); router.replace('/dashboard'); }
}

function closeAndGo(path) {
  tabs.close(path);
  if (route.path === path) {
    const act = tabs.tabs.find((t) => t.path === tabs.active);
    router.replace(act ? { path: act.path, query: act.query || {} } : tabs.active);
  }
}

function closeAll() {
  tabs.closeAll();
  router.replace('/dashboard');
}

return (_ctx, _cache) => {
  const _component_Close = resolveComponent("Close");
  const _component_el_icon = ElIcon;
  const _component_FullScreen = resolveComponent("FullScreen");
  const _component_Crop = resolveComponent("Crop");
  const _component_el_tooltip = ElTooltip;

  return (openBlock(), createElementBlock("div", _hoisted_1$3, [
    createBaseVNode("div", _hoisted_2$3, [
      (openBlock(true), createElementBlock(Fragment, null, renderList(unref(tabs).tabs, (t) => {
        return (openBlock(), createElementBlock("div", {
          key: t.path,
          class: normalizeClass(["tab", { active: unref(tabs).active === t.path }]),
          onClick: $event => (go(t)),
          onContextmenu: withModifiers($event => (showCtx(t, $event)), ["prevent"])
        }, [
          createBaseVNode("span", null, toDisplayString(unref(tt)(t.title)), 1),
          (!t.affix)
            ? (openBlock(), createBlock(_component_el_icon, {
                key: 0,
                class: "close",
                onClick: withModifiers($event => (closeAndGo(t.path)), ["stop"])
              }, {
                default: withCtx(() => [
                  createVNode(_component_Close)
                ]),
                _: 1
              }, 8, ["onClick"]))
            : createCommentVNode("", true)
        ], 42, _hoisted_3$3))
      }), 128))
    ], 512),
    createBaseVNode("div", _hoisted_4$2, [
      createVNode(_component_el_tooltip, {
        content: unref(app).maxContent ? '恢复' : '最大化',
        placement: "bottom"
      }, {
        default: withCtx(() => [
          createVNode(_component_el_icon, {
            class: "action-icon",
            onClick: _cache[0] || (_cache[0] = $event => (unref(app).toggleMaxContent()))
          }, {
            default: withCtx(() => [
              (!unref(app).maxContent)
                ? (openBlock(), createBlock(_component_FullScreen, { key: 0 }))
                : (openBlock(), createBlock(_component_Crop, { key: 1 }))
            ]),
            _: 1
          })
        ]),
        _: 1
      }, 8, ["content"]),
      createVNode(_component_el_tooltip, {
        content: "关闭全部页签",
        placement: "bottom"
      }, {
        default: withCtx(() => [
          createVNode(_component_el_icon, {
            class: "action-icon",
            onClick: closeAll
          }, {
            default: withCtx(() => [
              createVNode(_component_Close)
            ]),
            _: 1
          })
        ]),
        _: 1
      })
    ]),
    (ctx.value.tab)
      ? (openBlock(), createElementBlock("ul", {
          key: 0,
          class: "ctx-menu",
          style: normalizeStyle({ left: ctx.value.x + 'px', top: ctx.value.y + 'px' }),
          onMouseleave: _cache[5] || (_cache[5] = $event => (ctx.value.tab = null))
        }, [
          createBaseVNode("li", {
            onClick: _cache[1] || (_cache[1] = $event => (doCtx('refresh')))
          }, "刷新"),
          (!ctx.value.tab.affix)
            ? (openBlock(), createElementBlock("li", {
                key: 0,
                onClick: _cache[2] || (_cache[2] = $event => (doCtx('close')))
              }, "关闭"))
            : createCommentVNode("", true),
          createBaseVNode("li", {
            onClick: _cache[3] || (_cache[3] = $event => (doCtx('others')))
          }, "关闭其他"),
          createBaseVNode("li", {
            onClick: _cache[4] || (_cache[4] = $event => (doCtx('all')))
          }, "关闭全部")
        ], 36))
      : createCommentVNode("", true)
  ]))
}
}

};
const TabsBar = /*#__PURE__*/_export_sfc(_sfc_main$3, [['__scopeId',"data-v-7b8aa9c4"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$2 = { class: "help-panel" };
const _hoisted_2$2 = { class: "hp-titlebar" };
const _hoisted_3$2 = { class: "hp-tabs" };
const _hoisted_4$1 = ["onClick"];
const _hoisted_5$1 = {
  key: 0,
  class: "hp-badge"
};
const _hoisted_6$1 = { class: "hp-body" };
const _hoisted_7$1 = {
  key: 0,
  class: "hp-list"
};
const _hoisted_8$1 = { class: "hp-dyn-title" };
const _hoisted_9$1 = { class: "hp-dyn-desc" };
const _hoisted_10$1 = { class: "hp-dyn-time" };
const _hoisted_11$1 = {
  key: 1,
  class: "hp-list"
};
const _hoisted_12$1 = { class: "hp-msg-top" };
const _hoisted_13$1 = { class: "hp-msg-title" };
const _hoisted_14$1 = {
  key: 0,
  class: "hp-dot"
};
const _hoisted_15$1 = { class: "hp-msg-time" };
const _hoisted_16$1 = { key: 2 };
const _hoisted_17$1 = { class: "hp-faq-q" };
const _hoisted_18$1 = { class: "hp-faq-a" };
const _hoisted_19$1 = {
  key: 3,
  class: "hp-list"
};
const _hoisted_20$1 = { class: "hp-guide-step" };
const _hoisted_21$1 = { class: "hp-guide-body" };
const _hoisted_22$1 = { class: "hp-guide-title" };
const _hoisted_23$1 = { class: "hp-guide-desc" };
const _hoisted_24$1 = ["onClick"];


const _sfc_main$2 = {
  __name: 'HelpPanel',
  setup(__props) {

const app = useAppStore();
const tabs = useTabsStore();
const router = useRouter();

const TABS = [
  { key: 'dynamic', title: '动态' },
  { key: 'message', title: '消息' },
  { key: 'knowledge', title: '知识库' },
  { key: 'help', title: '帮助教程' },
];

const unread = ref(2);
const openFaqs = ref([]);

const dynamics = [
  { id: 1, title: '生产工单面板上线', desc: '首个 PanelX 配置驱动单据：支持新增/审核/弃审/关闭全流程。', time: '2026-08-13' },
  { id: 2, title: '门户壳升级为 T+ 形态', desc: '顶栏三段式、页签快捷按钮组、帮助面板与初始化向导。', time: '2026-08-13' },
  { id: 3, title: '消息通知中心上线', desc: '待办/消息/预警角标 + 详情弹窗（上一条/下一条/历史消息）。', time: '2026-08-12' },
  { id: 4, title: '工作台支持个性化设置', desc: '快捷入口与 KPI/进度/待办卡片可显隐配置。', time: '2026-08-12' },
];

const messages = [
  { id: 1, title: '管理员：本周五 18:00 系统例行维护', read: false, time: '2026-08-13 10:00' },
  { id: 2, title: '新功能：帮助面板与初始化向导已上线', read: false, time: '2026-08-13 09:00' },
  { id: 3, title: '您的角色已开通「生产管理」模块权限', read: true, time: '2026-08-12 15:00' },
];

const faqs = [
  { q: '如何新建一张生产工单？', a: '点击左侧菜单「单据查询/新增单据」或在生产管理模块打开「生产工单」，点击工具栏「新增流程」按钮，填写合同号、批号等必填项后提交。' },
  { q: '单据状态是如何流转的？', a: '草稿 → 提交后待审核 → 审核通过进入「已审核」→ 开工后「生产中」→ 完工后「已完工」→ 归档「已关闭」。草稿状态可编辑删除，审核后可弃审回退。' },
  { q: '如何切换工厂（账套）？', a: '点击顶栏左侧工厂名称下拉，选择目标工厂即可切换，业务数据按工厂隔离。' },
  { q: '暗色模式如何开启？', a: '点击顶栏右侧用户头像下拉菜单，选择「换肤（暗色）」，或在「界面设置」中切换。' },
  { q: '找不到某个功能菜单怎么办？', a: '使用顶栏「搜索-产品功能」输入菜单关键字全局搜索，点击结果直达对应页面。' },
];

const guide = [
  { title: '完成初始化向导', desc: '选择行业细分与经营业态，自动匹配专属桌面与菜单。' },
  { title: '维护基础资料', desc: '在「基础设置」录入存货、工艺路线、仓库与工序。' },
  { title: '录入期初数据', desc: '在「初始化」录入库存期初余额与期初单据。' },
  { title: '开始日常业务', desc: '从生产工单开始，按 报工→出入库→质检 的流程运转。' },
];

const shortcuts = [
  { title: '新建加工单', icon: 'DocumentAdd', path: '/panelx/form/MANU_ORDER?new=1', tabPath: '/panelx/form/MANU_ORDER', tabTitle: '新增加工单' },
  { title: '打开加工单列表', icon: 'List', path: '/panelx/list/MANU_ORDER', tabPath: '/panelx/list/MANU_ORDER', tabTitle: '生产工单' },
  { title: '我的桌面', icon: 'HomeFilled', path: '/dashboard', tabPath: '/dashboard', tabTitle: '我的桌面' },
  { title: '初始化向导', icon: 'MagicStick', action: 'init' },
];

function doShortcut(s) {
  if (s.action === 'init') {
    app.closeHelp();
    app.openInitWizard();
    return
  }
  tabs.open({ title: s.tabTitle, path: s.tabPath });
  router.push(s.path);
  app.closeHelp();
}

return (_ctx, _cache) => {
  const _component_el_empty = ElEmpty;
  const _component_el_collapse_item = ElCollapseItem;
  const _component_el_collapse = ElCollapse;
  const _component_el_icon = ElIcon;
  const _component_el_drawer = ElDrawer;

  return (openBlock(), createBlock(_component_el_drawer, {
    "model-value": unref(app).helpVisible,
    direction: "rtl",
    size: "380px",
    "with-header": false,
    "append-to-body": "",
    onClose: _cache[1] || (_cache[1] = $event => (unref(app).closeHelp()))
  }, {
    default: withCtx(() => [
      createBaseVNode("div", _hoisted_1$2, [
        createBaseVNode("div", _hoisted_2$2, [
          createBaseVNode("ul", _hoisted_3$2, [
            (openBlock(), createElementBlock(Fragment, null, renderList(TABS, (t) => {
              return createBaseVNode("li", {
                key: t.key,
                class: normalizeClass(["hp-tab", { active: unref(app).helpTab === t.key }]),
                onClick: $event => (unref(app).helpTab = t.key)
              }, [
                createBaseVNode("span", null, toDisplayString(t.title), 1),
                (t.key === 'message' && unread.value)
                  ? (openBlock(), createElementBlock("span", _hoisted_5$1, toDisplayString(unread.value), 1))
                  : createCommentVNode("", true)
              ], 10, _hoisted_4$1)
            }), 64))
          ])
        ]),
        createBaseVNode("div", _hoisted_6$1, [
          (unref(app).helpTab === 'dynamic')
            ? (openBlock(), createElementBlock("div", _hoisted_7$1, [
                (openBlock(), createElementBlock(Fragment, null, renderList(dynamics, (d) => {
                  return createBaseVNode("div", {
                    key: d.id,
                    class: "hp-dyn"
                  }, [
                    createBaseVNode("div", _hoisted_8$1, toDisplayString(d.title), 1),
                    createBaseVNode("div", _hoisted_9$1, toDisplayString(d.desc), 1),
                    createBaseVNode("div", _hoisted_10$1, toDisplayString(d.time), 1)
                  ])
                }), 64))
              ]))
            : createCommentVNode("", true),
          (unref(app).helpTab === 'message')
            ? (openBlock(), createElementBlock("div", _hoisted_11$1, [
                (openBlock(), createElementBlock(Fragment, null, renderList(messages, (m) => {
                  return createBaseVNode("div", {
                    key: m.id,
                    class: normalizeClass(["hp-msg", { unread: !m.read }])
                  }, [
                    createBaseVNode("div", _hoisted_12$1, [
                      createBaseVNode("span", _hoisted_13$1, toDisplayString(m.title), 1),
                      (!m.read)
                        ? (openBlock(), createElementBlock("span", _hoisted_14$1))
                        : createCommentVNode("", true)
                    ]),
                    createBaseVNode("div", _hoisted_15$1, toDisplayString(m.time), 1)
                  ], 2)
                }), 64)),
                (!messages.length)
                  ? (openBlock(), createBlock(_component_el_empty, {
                      key: 0,
                      description: "暂无消息",
                      "image-size": 50
                    }))
                  : createCommentVNode("", true)
              ]))
            : createCommentVNode("", true),
          (unref(app).helpTab === 'knowledge')
            ? (openBlock(), createElementBlock("div", _hoisted_16$1, [
                createVNode(_component_el_collapse, {
                  modelValue: openFaqs.value,
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((openFaqs).value = $event))
                }, {
                  default: withCtx(() => [
                    (openBlock(), createElementBlock(Fragment, null, renderList(faqs, (f) => {
                      return createVNode(_component_el_collapse_item, {
                        key: f.q,
                        name: f.q
                      }, {
                        title: withCtx(() => [
                          createBaseVNode("span", _hoisted_17$1, toDisplayString(f.q), 1)
                        ]),
                        default: withCtx(() => [
                          createBaseVNode("div", _hoisted_18$1, toDisplayString(f.a), 1)
                        ]),
                        _: 2
                      }, 1032, ["name"])
                    }), 64))
                  ]),
                  _: 1
                }, 8, ["modelValue"])
              ]))
            : createCommentVNode("", true),
          (unref(app).helpTab === 'help')
            ? (openBlock(), createElementBlock("div", _hoisted_19$1, [
                _cache[2] || (_cache[2] = createBaseVNode("div", { class: "hp-section-title" }, "新手引导", -1)),
                (openBlock(), createElementBlock(Fragment, null, renderList(guide, (s, i) => {
                  return createBaseVNode("div", {
                    key: s.title,
                    class: "hp-guide"
                  }, [
                    createBaseVNode("span", _hoisted_20$1, toDisplayString(i + 1), 1),
                    createBaseVNode("div", _hoisted_21$1, [
                      createBaseVNode("div", _hoisted_22$1, toDisplayString(s.title), 1),
                      createBaseVNode("div", _hoisted_23$1, toDisplayString(s.desc), 1)
                    ])
                  ])
                }), 64)),
                _cache[3] || (_cache[3] = createBaseVNode("div", { class: "hp-section-title mt16" }, "常用操作", -1)),
                (openBlock(), createElementBlock(Fragment, null, renderList(shortcuts, (s) => {
                  return createBaseVNode("div", {
                    key: s.title,
                    class: "hp-shortcut",
                    onClick: $event => (doShortcut(s))
                  }, [
                    createVNode(_component_el_icon, null, {
                      default: withCtx(() => [
                        (openBlock(), createBlock(resolveDynamicComponent(s.icon)))
                      ]),
                      _: 2
                    }, 1024),
                    createBaseVNode("span", null, toDisplayString(s.title), 1)
                  ], 8, _hoisted_24$1)
                }), 64))
              ]))
            : createCommentVNode("", true)
        ])
      ])
    ]),
    _: 1
  }, 8, ["model-value"]))
}
}

};
const HelpPanel = /*#__PURE__*/_export_sfc(_sfc_main$2, [['__scopeId',"data-v-4570751c"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$1 = {
  key: 0,
  class: "wizard-mask"
};
const _hoisted_2$1 = { class: "wizard" };
const _hoisted_3$1 = { class: "wz-header" };
const _hoisted_4 = { class: "wz-title" };
const _hoisted_5 = { class: "wz-subtitle" };
const _hoisted_6 = { class: "wz-steps" };
const _hoisted_7 = { class: "wz-step-text" };
const _hoisted_8 = { class: "wz-step-desc" };
const _hoisted_9 = { class: "wz-step-arrow" };
const _hoisted_10 = { class: "wz-step-arrow" };
const _hoisted_11 = {
  key: 0,
  class: "wz-body"
};
const _hoisted_12 = { class: "wz-body-title" };
const _hoisted_13 = { class: "wz-cards" };
const _hoisted_14 = ["onClick"];
const _hoisted_15 = { class: "wz-card-name" };
const _hoisted_16 = { class: "wz-card-desc" };
const _hoisted_17 = { class: "wz-body-title" };
const _hoisted_18 = { class: "wz-cards" };
const _hoisted_19 = ["onClick"];
const _hoisted_20 = { class: "wz-card-name" };
const _hoisted_21 = { class: "wz-card-desc" };
const _hoisted_22 = {
  key: 1,
  class: "wz-body"
};
const _hoisted_23 = { class: "wz-body-title" };
const _hoisted_24 = { class: "wz-cards" };
const _hoisted_25 = ["onClick"];
const _hoisted_26 = { class: "wz-check" };
const _hoisted_27 = { class: "wz-card-name" };
const _hoisted_28 = { class: "wz-card-desc" };
const _hoisted_29 = { class: "wz-body-title" };
const _hoisted_30 = {
  key: 2,
  class: "wz-body"
};
const _hoisted_31 = { class: "wz-result" };
const _hoisted_32 = { class: "wz-result-icon" };
const _hoisted_33 = { class: "wz-summary" };
const _hoisted_34 = { class: "wz-summary-row" };
const _hoisted_35 = { class: "wz-summary-row" };
const _hoisted_36 = { class: "wz-summary-row" };
const _hoisted_37 = { class: "wz-summary-row" };
const _hoisted_38 = { class: "wz-summary-label" };
const _hoisted_39 = { class: "wz-summary-row" };
const _hoisted_40 = { class: "wz-footer" };


const _sfc_main$1 = {
  __name: 'InitWizard',
  setup(__props) {

const app = useAppStore();
const user = useUserStore();

const step = ref(1);

const industries = [
  { code: 'metal', name: '金属制品加工', desc: '铸造/锻压/热处理/机加工', icon: 'Coin' },
  { code: 'auto', name: '汽车零部件', desc: '车削件/冲压件/总成', icon: 'Van' },
  { code: 'elec', name: '电子制造', desc: 'SMT/组装/测试', icon: 'Cpu' },
  { code: 'mach', name: '机械加工', desc: 'CNC/模具/装配', icon: 'Setting' },
  { code: 'other', name: '其他行业', desc: '通用离散制造', icon: 'OfficeBuilding' },
];

const business = [
  { code: 'incoming', name: '来料加工', desc: '客户供料，赚取加工费' },
  { code: 'self', name: '自主生产', desc: '自购料生产销售' },
  { code: 'mixed', name: '混合经营', desc: '自产与代工并存' },
];

const modules = [
  { code: 'prod', name: '生产管理', desc: '加工单/工序/排产' },
  { code: 'inv', name: '库存核算', desc: '出入库/盘点/核算' },
  { code: 'qc', name: '质量管理', desc: '来料/过程/完工检验' },
  { code: 'eq', name: '设备管理', desc: '台账/点检/OEE' },
  { code: 'salary', name: '工资核算', desc: '计件工资/汇总' },
];

const form = reactive({
  industry: '',
  business: '',
  modules: ['prod', 'inv'],
  reportMode: 'scan',
});

function toggleModule(code) {
  const idx = form.modules.indexOf(code);
  if (idx >= 0) form.modules.splice(idx, 1);
  else form.modules.push(code);
}

const industryName = computed(() => industries.find((i) => i.code === form.industry)?.name || '未选择');
const businessName = computed(() => business.find((b) => b.code === form.business)?.name || '未选择');
const moduleNames = computed(() => form.modules.map((c) => modules.find((m) => m.code === c)?.name).filter(Boolean).join('、'));
const reportModeName = computed(() => ({ scan: '扫码报工', manual: '手工报工', batch: '批量报工' })[form.reportMode]);

function next() {
  if (step.value === 1) {
    if (!form.industry || !form.business) return ElMessage.warning('请先选择行业细分与经营业态')
  }
  if (step.value < 3) step.value++;
}

function prev() {
  if (step.value > 1) step.value--;
}

function finish() {
  app.finishInitWizard();
  app.closeInitWizard(false);
  ElMessage.success('初始化完成，已为您匹配专属桌面与菜单');
}

function skip() {
  app.closeInitWizard(true);
}

return (_ctx, _cache) => {
  const _component_Close = resolveComponent("Close");
  const _component_el_icon = ElIcon;
  const _component_ArrowRight = resolveComponent("ArrowRight");
  const _component_Check = resolveComponent("Check");
  const _component_el_radio_button = ElRadioButton;
  const _component_el_radio_group = ElRadioGroup;
  const _component_CircleCheckFilled = resolveComponent("CircleCheckFilled");

  return (openBlock(), createBlock(Teleport, { to: "body" }, [
    (unref(app).initWizardVisible)
      ? (openBlock(), createElementBlock("div", _hoisted_1$1, [
          createBaseVNode("div", _hoisted_2$1, [
            createBaseVNode("div", _hoisted_3$1, [
              createBaseVNode("div", {
                class: "wz-close",
                onClick: skip
              }, [
                createVNode(_component_el_icon, null, {
                  default: withCtx(() => [
                    createVNode(_component_Close)
                  ]),
                  _: 1
                })
              ]),
              createBaseVNode("div", _hoisted_4, toDisplayString(unref(tt)('MES 初始化配置')), 1),
              createBaseVNode("div", _hoisted_5, toDisplayString(unref(tt)('三步即可轻松完成行业功能初始化流程')), 1)
            ]),
            createBaseVNode("div", _hoisted_6, [
              createBaseVNode("div", {
                class: normalizeClass(["wz-step", { done: step.value > 1, active: step.value === 1 }])
              }, [
                _cache[2] || (_cache[2] = createBaseVNode("span", { class: "wz-step-no" }, "1", -1)),
                createBaseVNode("div", _hoisted_7, [
                  _cache[1] || (_cache[1] = createBaseVNode("div", { class: "wz-step-name" }, "第一步", -1)),
                  createBaseVNode("div", _hoisted_8, toDisplayString(unref(tt)('选择行业细分 & 经营业态')), 1)
                ])
              ], 2),
              createBaseVNode("div", _hoisted_9, [
                createVNode(_component_el_icon, null, {
                  default: withCtx(() => [
                    createVNode(_component_ArrowRight)
                  ]),
                  _: 1
                })
              ]),
              createBaseVNode("div", {
                class: normalizeClass(["wz-step", { done: step.value > 2, active: step.value === 2 }])
              }, [...(_cache[3] || (_cache[3] = [
                createBaseVNode("span", { class: "wz-step-no" }, "2", -1),
                createBaseVNode("div", { class: "wz-step-text" }, [
                  createBaseVNode("div", { class: "wz-step-name" }, "第二步"),
                  createBaseVNode("div", { class: "wz-step-desc" }, "行业特性选择 & 设置")
                ], -1)
              ]))], 2),
              createBaseVNode("div", _hoisted_10, [
                createVNode(_component_el_icon, null, {
                  default: withCtx(() => [
                    createVNode(_component_ArrowRight)
                  ]),
                  _: 1
                })
              ]),
              createBaseVNode("div", {
                class: normalizeClass(["wz-step", { done: step.value > 3, active: step.value === 3 }])
              }, [...(_cache[4] || (_cache[4] = [
                createBaseVNode("span", { class: "wz-step-no" }, "3", -1),
                createBaseVNode("div", { class: "wz-step-text" }, [
                  createBaseVNode("div", { class: "wz-step-name" }, "第三步"),
                  createBaseVNode("div", { class: "wz-step-desc" }, "完成初始化设置")
                ], -1)
              ]))], 2)
            ]),
            (step.value === 1)
              ? (openBlock(), createElementBlock("div", _hoisted_11, [
                  createBaseVNode("div", _hoisted_12, toDisplayString(unref(tt)('选择行业细分')), 1),
                  createBaseVNode("div", _hoisted_13, [
                    (openBlock(), createElementBlock(Fragment, null, renderList(industries, (i) => {
                      return createBaseVNode("div", {
                        key: i.code,
                        class: normalizeClass(["wz-card", { active: form.industry === i.code }]),
                        onClick: $event => (form.industry = i.code)
                      }, [
                        createVNode(_component_el_icon, { class: "wz-card-icon" }, {
                          default: withCtx(() => [
                            (openBlock(), createBlock(resolveDynamicComponent(i.icon)))
                          ]),
                          _: 2
                        }, 1024),
                        createBaseVNode("span", _hoisted_15, toDisplayString(i.name), 1),
                        createBaseVNode("span", _hoisted_16, toDisplayString(i.desc), 1)
                      ], 10, _hoisted_14)
                    }), 64))
                  ]),
                  createBaseVNode("div", _hoisted_17, toDisplayString(unref(tt)('选择经营业态')), 1),
                  createBaseVNode("div", _hoisted_18, [
                    (openBlock(), createElementBlock(Fragment, null, renderList(business, (b) => {
                      return createBaseVNode("div", {
                        key: b.code,
                        class: normalizeClass(["wz-card small", { active: form.business === b.code }]),
                        onClick: $event => (form.business = b.code)
                      }, [
                        createBaseVNode("span", _hoisted_20, toDisplayString(b.name), 1),
                        createBaseVNode("span", _hoisted_21, toDisplayString(b.desc), 1)
                      ], 10, _hoisted_19)
                    }), 64))
                  ])
                ]))
              : createCommentVNode("", true),
            (step.value === 2)
              ? (openBlock(), createElementBlock("div", _hoisted_22, [
                  createBaseVNode("div", _hoisted_23, toDisplayString(unref(tt)('选择启用模块')), 1),
                  createBaseVNode("div", _hoisted_24, [
                    (openBlock(), createElementBlock(Fragment, null, renderList(modules, (m) => {
                      return createBaseVNode("div", {
                        key: m.code,
                        class: normalizeClass(["wz-card small checkable", { active: form.modules.includes(m.code) }]),
                        onClick: $event => (toggleModule(m.code))
                      }, [
                        createBaseVNode("span", _hoisted_26, [
                          (form.modules.includes(m.code))
                            ? (openBlock(), createBlock(_component_el_icon, { key: 0 }, {
                                default: withCtx(() => [
                                  createVNode(_component_Check)
                                ]),
                                _: 1
                              }))
                            : createCommentVNode("", true)
                        ]),
                        createBaseVNode("span", _hoisted_27, toDisplayString(m.name), 1),
                        createBaseVNode("span", _hoisted_28, toDisplayString(m.desc), 1)
                      ], 10, _hoisted_25)
                    }), 64))
                  ]),
                  createBaseVNode("div", _hoisted_29, toDisplayString(unref(tt)('报工方式')), 1),
                  createVNode(_component_el_radio_group, {
                    modelValue: form.reportMode,
                    "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((form.reportMode) = $event)),
                    class: "wz-radio-group"
                  }, {
                    default: withCtx(() => [
                      createVNode(_component_el_radio_button, { value: "scan" }, {
                        default: withCtx(() => [...(_cache[5] || (_cache[5] = [
                          createTextVNode("扫码报工（推荐）", -1)
                        ]))]),
                        _: 1
                      }),
                      createVNode(_component_el_radio_button, { value: "manual" }, {
                        default: withCtx(() => [...(_cache[6] || (_cache[6] = [
                          createTextVNode("手工报工", -1)
                        ]))]),
                        _: 1
                      }),
                      createVNode(_component_el_radio_button, { value: "batch" }, {
                        default: withCtx(() => [...(_cache[7] || (_cache[7] = [
                          createTextVNode("批量报工", -1)
                        ]))]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, ["modelValue"])
                ]))
              : createCommentVNode("", true),
            (step.value === 3)
              ? (openBlock(), createElementBlock("div", _hoisted_30, [
                  createBaseVNode("div", _hoisted_31, [
                    createBaseVNode("div", _hoisted_32, [
                      createVNode(_component_el_icon, null, {
                        default: withCtx(() => [
                          createVNode(_component_CircleCheckFilled)
                        ]),
                        _: 1
                      })
                    ]),
                    _cache[8] || (_cache[8] = createBaseVNode("div", { class: "wz-result-text" }, [
                      createTextVNode(" 完成行业化设置，自动为您匹配"),
                      createBaseVNode("br"),
                      createBaseVNode("span", { class: "wz-result-hl" }, "全新的专属桌面、菜单、选项功能、关注指标及相关报表")
                    ], -1))
                  ]),
                  createBaseVNode("div", _hoisted_33, [
                    createBaseVNode("div", _hoisted_34, [
                      _cache[9] || (_cache[9] = createBaseVNode("span", { class: "wz-summary-label" }, "行业细分", -1)),
                      createBaseVNode("span", null, toDisplayString(industryName.value), 1)
                    ]),
                    createBaseVNode("div", _hoisted_35, [
                      _cache[10] || (_cache[10] = createBaseVNode("span", { class: "wz-summary-label" }, "经营业态", -1)),
                      createBaseVNode("span", null, toDisplayString(businessName.value), 1)
                    ]),
                    createBaseVNode("div", _hoisted_36, [
                      _cache[11] || (_cache[11] = createBaseVNode("span", { class: "wz-summary-label" }, "启用模块", -1)),
                      createBaseVNode("span", null, toDisplayString(moduleNames.value || '仅基础模块'), 1)
                    ]),
                    createBaseVNode("div", _hoisted_37, [
                      createBaseVNode("span", _hoisted_38, toDisplayString(unref(tt)('报工方式')), 1),
                      createBaseVNode("span", null, toDisplayString(reportModeName.value), 1)
                    ]),
                    createBaseVNode("div", _hoisted_39, [
                      _cache[12] || (_cache[12] = createBaseVNode("span", { class: "wz-summary-label" }, "当前工厂", -1)),
                      createBaseVNode("span", null, toDisplayString(unref(user).factoryName), 1)
                    ])
                  ])
                ]))
              : createCommentVNode("", true),
            createBaseVNode("div", _hoisted_40, [
              (step.value === 1)
                ? (openBlock(), createElementBlock("div", {
                    key: 0,
                    class: "wz-start",
                    onClick: next
                  }, toDisplayString(unref(tt)('开始配置')), 1))
                : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                    createBaseVNode("div", {
                      class: "wz-back",
                      onClick: prev
                    }, "上一步"),
                    (step.value === 2)
                      ? (openBlock(), createElementBlock("div", {
                          key: 0,
                          class: "wz-start",
                          onClick: next
                        }, "下一步"))
                      : (openBlock(), createElementBlock("div", {
                          key: 1,
                          class: "wz-start",
                          onClick: finish
                        }, "完成设置"))
                  ], 64)),
              createBaseVNode("div", {
                class: "wz-skip",
                onClick: skip
              }, toDisplayString(unref(tt)('下次再说')), 1)
            ])
          ])
        ]))
      : createCommentVNode("", true)
  ]))
}
}

};
const InitWizard = /*#__PURE__*/_export_sfc(_sfc_main$1, [['__scopeId',"data-v-05c55113"]]);

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "portal-body" };
const _hoisted_2 = { class: "portal-main" };
const _hoisted_3 = { class: "portal-content" };


const _sfc_main = {
  __name: 'PortalLayout',
  setup(__props) {

const app = useAppStore();
const user = useUserStore();
const tabs = useTabsStore();
const route = useRoute();

onMounted(() => {
  if (app.dark) document.documentElement.classList.add('dark');
  // 已离开登录页:清除深色底色标记(供 index.html 预置底色判断)
  try { sessionStorage.removeItem('mes_at_login'); } catch { /* ignore */ }
  document.documentElement.classList.remove('login-bg');
  // Login data is cached for fast startup; refresh it so server-side corrections
  // and permission changes replace stale localStorage values on the next load.
  Promise.allSettled([user.fetchUserInfo(), user.fetchFactories()]);
  // T+ 行业化配置向导：首次登录自动弹出
  if (!app.initDone) app.openInitWizard();
});

watch(
  () => route.path,
  (p) => {
    tabs.setActive(p);
    const menu = findMenuByPath(p);
    if (menu && !tabs.tabs.find((t) => t.path === p)) tabs.open(menu);
  },
  { immediate: true }
);

return (_ctx, _cache) => {
  const _component_router_view = resolveComponent("router-view");

  return (openBlock(), createElementBlock("div", {
    class: normalizeClass(["portal", { dark: unref(app).dark }])
  }, [
    createVNode(TopBar),
    createBaseVNode("div", _hoisted_1, [
      (!unref(app).maxContent)
        ? (openBlock(), createBlock(LeftNav, { key: 0 }))
        : createCommentVNode("", true),
      createBaseVNode("div", _hoisted_2, [
        createVNode(TabsBar),
        createBaseVNode("div", _hoisted_3, [
          createVNode(_component_router_view, null, {
            default: withCtx(({ Component }) => [
              (openBlock(), createBlock(KeepAlive, { max: 20 }, [
                (openBlock(), createBlock(resolveDynamicComponent(Component)))
              ], 1024))
            ]),
            _: 1
          })
        ])
      ])
    ]),
    createVNode(Transition, { name: "fade" }, {
      default: withCtx(() => [
        (unref(app).mobileNav)
          ? (openBlock(), createElementBlock("div", {
              key: 0,
              class: "nav-mask",
              onClick: _cache[0] || (_cache[0] = $event => (unref(app).toggleMobileNav()))
            }))
          : createCommentVNode("", true)
      ]),
      _: 1
    }),
    createVNode(HelpPanel),
    createVNode(InitWizard)
  ], 2))
}
}

};
const PortalLayout = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-a7c25287"]]);

export { PortalLayout as default };
