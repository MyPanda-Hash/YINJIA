import { v as vLoading, o as ElOption, N as ElAlert, j as ElTable, n as ElSelect, z as ElDatePicker, g as ElTableColumn, d as ElButton, f as ElDialog, k as ElMessage, w as ElForm, t as ElSwitch, m as ElFormItem, i as ElInput, l as ElMessageBox } from './element-plus-W84rT0en.js';
import { t as tt, r as request } from './index-CqmwEeWF.js';
/* empty css                   */
/* empty css                   */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                */
/* empty css                  */
/* empty css                      */
/* empty css                   */
import { j as watch, o as openBlock, P as createBlock, W as withCtx, X as withDirectives, c as createElementBlock, a as createBaseVNode, $ as toDisplayString, A as unref, Z as createCommentVNode, _ as createTextVNode, a0 as createVNode, J as Fragment, ae as renderList, p as ref, f as computed, q as onMounted, ac as withModifiers, aq as withKeys, S as normalizeClass } from './vue-vendor-DyX2BAKf.js';
/* empty css                        */
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import './element-icons-DOEvq9OG.js';

/* unplugin-vue-components disabled */

const _hoisted_1$1 = { class: "prp-body" };
const _hoisted_2$1 = { class: "prp-head" };
const _hoisted_3$1 = { key: 0 };
const _hoisted_4$1 = { key: 1 };
const _hoisted_5$1 = { key: 2 };
const _hoisted_6$1 = {
  key: 3,
  class: "prp-route"
};
const _hoisted_7$1 = { key: 4 };
const _hoisted_8$1 = { class: "prp-team" };
const _hoisted_9$1 = {
  key: 0,
  class: "prp-lock"
};
const _hoisted_10$1 = {
  key: 2,
  class: "prp-dim"
};


const _sfc_main$1 = {
  __name: 'ProcessRoutePlanDialog',
  props: {
  modelValue: { type: Boolean, default: false },
  加工单号: { type: String, default: '' },
  行id: { type: [Number, String], default: null },
  工单行号: { type: [Number, String], default: '' },
  批次号: { type: String, default: '' },
  /** 已排产的工单 = 改线模式:首道线锁定 */
  已排产: { type: Boolean, default: false },
},
  emits: ['update:modelValue', 'changed'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) });
const loading = ref(false);
const saving = ref(false);
const head = ref({});
const rows = ref([]);
const lines = ref([]);
const teams = ref([]);
const team = ref('');
const locked = computed(() => props.已排产);
const no = computed(() => props.加工单号 || '');
const lineNo = computed(() => props.工单行号 || head.value['工单行号'] || '');
const batch = computed(() => props.批次号 || head.value['批次号'] || '');

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
/** 该道工序的候选线:启用线里车间匹配的(与顶部选线同口径) */
function optionsOf(row) {
  const shop = String(row['生产车间'] || '');
  const list = lines.value.filter((l) => !shop || String(l['生产车间'] || '') === shop);
  return list.length ? list : lines.value
}

async function load() {
  if (!no.value) return
  loading.value = true;
  try {
    const [r1, r2] = await Promise.all([
      request.post('/px/scheduleBoard/routeSteps', { 加工单号: no.value, 行id: props.行id ?? undefined }),
      request.post('/px/scheduleBoard/stats', {}),
    ]);
    lines.value = (r2.data || {})['产线'] || [];
    teams.value = (r2.data || {})['班组'] || [];
    const d = r1.data || {};
    head.value = d['表头'] || {};
    const planned = d['已排台账'] || [];
    rows.value = (d['工序步骤'] || []).map((s) => {
      const had = planned.find((p) => String(p['工序'] || '').trim() === String(s['工序'] || '').trim());
      const rate = Number(s['换算率'] || 0);
      return {
        工序: s['工序'], 生产车间: s['生产车间'], 工序序: s['工序序'],
        // 换算率(2026-10-07:此前映射里漏带该字段 ⇒ 列里恒显示 0)
        换算率: rate > 0 ? rate : 1,
        计划数量: s['计划数量'],
        计划完工日期: (had && had['计划完工日期']) || s['计划完工日期'] || '',
        生产线: (had && (had['状态'] === '已落实' ? (had['实际生产线'] || had['计划生产线']) : had['计划生产线'])) || '',
      }
    });
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('读取工艺路线失败'));
    rows.value = [];
  } finally { loading.value = false; }
}

async function submit() {
  const miss = rows.value.filter((r) => !r['生产线']);
  if (miss.length) {
    ElMessage.warning(`${tt('还有工序未选生产线')}：${miss.map((r) => r['工序']).join('、')}`);
    return
  }
  saving.value = true;
  try {
    const res = await request.post('/px/scheduleBoard/preplan', {
      加工单号: no.value,
      行id: props.行id ?? undefined,
      排产班组: team.value || undefined,
      步骤: rows.value.map((r) => ({ 工序: r.工序, 生产线: r.生产线, 计划完工日期: r['计划完工日期'] || undefined })),
    });
    const d = res.data || {};
    const plan = (d['计划线'] || []).join(' → ');
    ElMessage.success(`${tt('已排产')}${d['排产产线'] ? `「${d['排产产线']}」` : ''}；${tt('预排')}${d['预排道数'] || 0}${tt('道')}：${plan}`);
    emit('changed');
    visible.value = false;
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('排线失败'));
  } finally { saving.value = false; }
}

watch(() => props.modelValue, (v) => { if (v) load(); });

return (_ctx, _cache) => {
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_alert = ElAlert;
  const _component_el_table_column = ElTableColumn;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_table = ElTable;
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;
  const _directive_loading = vLoading;

  return (openBlock(), createBlock(_component_el_dialog, {
    modelValue: visible.value,
    "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((visible).value = $event)),
    title: unref(tt)('工序路线排线'),
    width: "900px",
    "append-to-body": "",
    "destroy-on-close": ""
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, {
        onClick: _cache[1] || (_cache[1] = $event => (visible.value = false))
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('取消')), 1)
        ]),
        _: 1
      }),
      createVNode(_component_el_button, {
        type: "primary",
        loading: saving.value,
        disabled: !rows.value.length,
        onClick: submit
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(locked.value ? unref(tt)('保存预排线') : unref(tt)('排产')), 1)
        ]),
        _: 1
      }, 8, ["loading", "disabled"])
    ]),
    default: withCtx(() => [
      withDirectives((openBlock(), createElementBlock("div", _hoisted_1$1, [
        createBaseVNode("div", _hoisted_2$1, [
          createBaseVNode("b", null, toDisplayString(unref(tt)('工单')) + "：" + toDisplayString(no.value), 1),
          (lineNo.value)
            ? (openBlock(), createElementBlock("span", _hoisted_3$1, toDisplayString(unref(tt)('工单行号')) + " " + toDisplayString(lineNo.value), 1))
            : createCommentVNode("", true),
          (batch.value)
            ? (openBlock(), createElementBlock("span", _hoisted_4$1, toDisplayString(unref(tt)('批次号')) + " " + toDisplayString(batch.value), 1))
            : createCommentVNode("", true),
          (head.value['产品编码'])
            ? (openBlock(), createElementBlock("span", _hoisted_5$1, toDisplayString(head.value['产品编码']) + " / " + toDisplayString(head.value['产品名称']) + " " + toDisplayString(head.value['规格型号']), 1))
            : createCommentVNode("", true),
          (head.value['工艺路线'])
            ? (openBlock(), createElementBlock("span", _hoisted_6$1, toDisplayString(unref(tt)('工艺路线')) + "：" + toDisplayString(head.value['工艺路线']), 1))
            : createCommentVNode("", true),
          (head.value['交期'])
            ? (openBlock(), createElementBlock("span", _hoisted_7$1, toDisplayString(unref(tt)('交期')) + "：" + toDisplayString(head.value['交期']), 1))
            : createCommentVNode("", true),
          createBaseVNode("span", _hoisted_8$1, [
            createTextVNode(toDisplayString(unref(tt)('排产班组')) + " ", 1),
            createVNode(_component_el_select, {
              modelValue: team.value,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((team).value = $event)),
              clearable: "",
              filterable: "",
              size: "small",
              style: {"width":"130px"}
            }, {
              default: withCtx(() => [
                (openBlock(true), createElementBlock(Fragment, null, renderList(teams.value, (t) => {
                  return (openBlock(), createBlock(_component_el_option, {
                    key: t,
                    label: t,
                    value: t
                  }, null, 8, ["label", "value"]))
                }), 128))
              ]),
              _: 1
            }, 8, ["modelValue"])
          ])
        ]),
        (!rows.value.length && !loading.value)
          ? (openBlock(), createBlock(_component_el_alert, {
              key: 0,
              type: "warning",
              closable: false,
              "show-icon": "",
              title: unref(tt)('该工单未绑定工艺路线(或路线无工序明细),不能排线 —— 请先在订单结转/工单上选择工艺路线')
            }, null, 8, ["title"]))
          : (openBlock(), createBlock(_component_el_table, {
              key: 1,
              data: rows.value,
              size: "small",
              border: "",
              "max-height": "380",
              "empty-text": ""
            }, {
              default: withCtx(() => [
                createVNode(_component_el_table_column, {
                  type: "index",
                  label: unref(tt)('序'),
                  width: "52"
                }, null, 8, ["label"]),
                createVNode(_component_el_table_column, {
                  label: unref(tt)('工序'),
                  prop: "工序",
                  width: "110"
                }, null, 8, ["label"]),
                createVNode(_component_el_table_column, {
                  label: unref(tt)('生产车间'),
                  prop: "生产车间",
                  width: "100"
                }, null, 8, ["label"]),
                createVNode(_component_el_table_column, {
                  label: unref(tt)('生产线'),
                  "min-width": "290"
                }, {
                  default: withCtx(({ row, $index }) => [
                    createVNode(_component_el_select, {
                      modelValue: row.生产线,
                      "onUpdate:modelValue": $event => ((row.生产线) = $event),
                      filterable: "",
                      size: "small",
                      style: {"width":"100%"},
                      disabled: locked.value && $index === 0,
                      placeholder: unref(tt)('请选择生产线')
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(optionsOf(row), (l) => {
                          return (openBlock(), createBlock(_component_el_option, {
                            key: l.生产线,
                            value: l.生产线,
                            label: `${l.生产线} · ${unref(tt)('负荷')}${num(l['今日负荷'])}/${unref(tt)('日产能')}${num(l['日产能'])}${l['提示'] === '超载' ? ' ⚠' + unref(tt)('超载') : ''}`
                          }, null, 8, ["value", "label"]))
                        }), 128))
                      ]),
                      _: 2
                    }, 1032, ["modelValue", "onUpdate:modelValue", "disabled", "placeholder"]),
                    (locked.value && $index === 0)
                      ? (openBlock(), createElementBlock("div", _hoisted_9$1, toDisplayString(unref(tt)('首道线 = 当前排产线;换线请先撤销排产')), 1))
                      : createCommentVNode("", true)
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_table_column, {
                  label: unref(tt)('换算率'),
                  width: "80",
                  align: "right"
                }, {
                  default: withCtx(({ row }) => [
                    createTextVNode(toDisplayString(num(row.换算率)), 1)
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_table_column, {
                  label: unref(tt)('计划数量'),
                  width: "110",
                  align: "right"
                }, {
                  default: withCtx(({ row }) => [
                    createTextVNode(toDisplayString(num(row.计划数量)), 1)
                  ]),
                  _: 1
                }, 8, ["label"]),
                createVNode(_component_el_table_column, {
                  label: unref(tt)('计划完工日期'),
                  width: "160"
                }, {
                  default: withCtx(({ row }) => [
                    createVNode(_component_el_date_picker, {
                      modelValue: row.计划完工日期,
                      "onUpdate:modelValue": $event => ((row.计划完工日期) = $event),
                      type: "date",
                      "value-format": "YYYY-MM-DD",
                      size: "small",
                      style: {"width":"100%"}
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  _: 1
                }, 8, ["label"])
              ]),
              _: 1
            }, 8, ["data"])),
        (rows.value.length)
          ? (openBlock(), createElementBlock("div", _hoisted_10$1, toDisplayString(unref(tt)('说明')) + "：" + toDisplayString(unref(tt)('首道工序的线 = 该工单的排产线(报工闸门按它判已排产);其余各道为预排线,前道报工完工审核后自动转序到下一道的线')) + "。 " + toDisplayString(unref(tt)('计划数量 = 本工单行排产数量 × 该工序自己的换算率(各道分开算,不累乘)')) + "。 ", 1))
          : createCommentVNode("", true)
      ])), [
        [_directive_loading, loading.value]
      ])
    ]),
    _: 1
  }, 8, ["modelValue", "title"]))
}
}

};
const ProcessRoutePlanDialog = /*#__PURE__*/_export_sfc(_sfc_main$1, [['__scopeId',"data-v-cd6ba74a"]]);

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "sb-page" };
const _hoisted_2 = { class: "sb-stats" };
const _hoisted_3 = {
  key: 0,
  class: "sb-shop"
};
const _hoisted_4 = { class: "sb-block" };
const _hoisted_5 = { class: "sb-head" };
const _hoisted_6 = { class: "sb-block-title" };
const _hoisted_7 = { class: "sb-dim" };
const _hoisted_8 = { class: "sb-block" };
const _hoisted_9 = { class: "sb-head" };
const _hoisted_10 = { class: "sb-block-title" };
const _hoisted_11 = { class: "sb-actions" };

/** 内嵌/筛选(2026-10-05 用户口径):生产工单页把"快速排产页面本身"弹出来,并只筛当前工单 */

const _sfc_main = {
  __name: 'ScheduleBoard',
  props: {
  '工单号': { type: String, default: '' },
  embedded: { type: Boolean, default: false },
},
  setup(__props) {

const props = __props;

const keyword = ref('');
const customer = ref('');
const loading = ref(false);
const pool = ref([]);
const checked = ref([]);
const poolTable = ref(null);
const todayRows = ref([]);
const checkedToday = ref([]);
const allMode = ref(false);
const s = ref({});
const mode = computed(() => (allMode.value ? 'all' : 'today'));
const customers = computed(() => [...new Set(pool.value.map((r) => r.客户).filter(Boolean))].sort());

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '' }
function urgent(v) {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || Number.isNaN(n)) return ''
  if (n < 0) return 'sb-late'
  if (n <= 7) return 'sb-near'
  return ''
}

async function loadPool() {
  loading.value = true;
  try {
    const res = await request.post('/px/scheduleBoard/pending', { keyword: keyword.value, 客户: customer.value });
    pool.value = (res.data || []).map((r) => ({
      ...r,
      rowKey: `${r.加工单号}#${r['行id']}`,
    }));
    checked.value = [];
    poolTable.value?.clearSelection?.();
  } catch (e) { err(e, '查询失败'); } finally { loading.value = false; }
}

async function loadStats() {
  try {
    const res = await request.post('/px/scheduleBoard/stats', {});
    s.value = res.data || {};
  } catch { /* 统计失败不阻断 */ }
}

async function loadToday() {
  try {
    const res = await request.post('/px/scheduleBoard/today', { mode: mode.value, keyword: keyword.value });
    // 行唯一键:同一工单可能有多行(多工单行/多批次)⇒ 用 加工单号#工单行号#批次号(否则勾一条会全勾)
    todayRows.value = (res.data || []).map((r, i) => ({
      ...r,
      rowKey: `${r['加工单号']}#${r['工单行号'] ?? ''}#${r['批次号'] ?? ''}#${i}`,
    }));
    checkedToday.value = [];
  } catch (e) { err(e, '查询失败'); }
}

function loadAll() { loadPool(); loadStats(); loadToday(); }
function onCheck(r) { checked.value = r; }
function onCheckToday(r) { checkedToday.value = r; }


// ───────── 工序路线排线(2026-10-07):排产 = 一次把整条工艺路线的线选好 ─────────
const planVisible = ref(false);
const planRow = ref({});
const planLocked = ref(false);
/** 打开排线弹窗:锁定时=改线(已排产,首道线锁定) */
function openPlan(row, locked) {
  if (!row) { ElMessage.warning(tt('请先勾选一张工单')); return }
  planRow.value = { ...row };
  planLocked.value = !!locked || !!row['生产线'];
  planVisible.value = true;
}
function planOne(row) { openPlan(row, false); }

async function unassign() {
  const list = checkedToday.value;
  if (!list.length) return
  // 撤销**按工单行**(唯一键 = 工单号 + 工单行号,2026-10-07 用户口径):勾哪一行撤销哪一行,
  //   同工单其它行不动;该行预排线同时作废
  const targets = list.map((r) => ({ 加工单号: r['加工单号'], 行id: r['行id'] })).filter((x) => x['加工单号']);
  const labels = list.map((r) => `${r['加工单号']}${r['工单行号'] != null ? ' 行' + r['工单行号'] : ''}`);
  try {
    await ElMessageBox.confirm(`${tt('确认撤销选中的')} ${targets.length} ${tt('行排产')}(${tt('撤销后回到待排产池;换线=撤销+重排;该行预排线同时作废')})？\n${labels.join('、')}`,
      tt('撤销排产'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') });
  } catch { return }
  try {
    const res = await request.post('/px/scheduleBoard/unassign', { rows: targets });
    const d = res.data || {};
    const failed = d['失败行'] || [];
    ElMessage.success(`${tt('已撤销')} ${d['撤销张数']} ${tt('行')}` + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''));
    loadAll();
  } catch (e) { err(e, '撤销失败'); }
}

function err(e, f) { ElMessage.error(e?.response?.data?.message || tt(f)); }

onMounted(() => {
  // 内嵌模式(2026-10-05 用户口径):生产工单页弹出"快速排产页面本身",用**工单号**预置单框搜索 ⇒ 只显示当前工单
  if (props['工单号']) keyword.value = props['工单号'];
  loadAll();
});

return (_ctx, _cache) => {
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_form_item = ElFormItem;
  const _component_el_input = ElInput;
  const _component_el_button = ElButton;
  const _component_el_form = ElForm;
  const _component_el_alert = ElAlert;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_switch = ElSwitch;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    createVNode(_component_el_form, {
      inline: "",
      class: "sb-bar",
      onSubmit: _cache[3] || (_cache[3] = withModifiers(() => {}, ["prevent"]))
    }, {
      default: withCtx(() => [
        createVNode(_component_el_form_item, {
          label: unref(tt)('客户')
        }, {
          default: withCtx(() => [
            createVNode(_component_el_select, {
              modelValue: customer.value,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((customer).value = $event)),
              clearable: "",
              filterable: "",
              style: {"width":"200px"},
              onChange: loadAll
            }, {
              default: withCtx(() => [
                (openBlock(true), createElementBlock(Fragment, null, renderList(customers.value, (c) => {
                  return (openBlock(), createBlock(_component_el_option, {
                    key: c,
                    label: c,
                    value: c
                  }, null, 8, ["label", "value"]))
                }), 128))
              ]),
              _: 1
            }, 8, ["modelValue"])
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_form_item, {
          label: unref(tt)('关键字')
        }, {
          default: withCtx(() => [
            createVNode(_component_el_input, {
              modelValue: keyword.value,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((keyword).value = $event)),
              placeholder: unref(tt)('订单号 / 加工单号 / 产品 / 品名'),
              clearable: "",
              style: {"width":"250px"},
              onKeyup: withKeys(loadAll, ["enter"])
            }, null, 8, ["modelValue", "placeholder"])
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: loadAll
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('查询')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          loading: loading.value,
          onClick: loadAll
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('刷新')), 1)
          ]),
          _: 1
        }, 8, ["loading"]),
        createVNode(_component_el_button, {
          type: "success",
          disabled: checked.value.length !== 1,
          onClick: _cache[2] || (_cache[2] = $event => (openPlan(checked.value[0])))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('排产')), 1)
          ]),
          _: 1
        }, 8, ["disabled"]),
        createBaseVNode("span", _hoisted_2, [
          (s.value['车间'])
            ? (openBlock(), createElementBlock("b", _hoisted_3, toDisplayString(unref(tt)('当前车间')) + "：" + toDisplayString(s.value['车间']), 1))
            : createCommentVNode("", true),
          createTextVNode(" " + toDisplayString(unref(tt)('待排产')) + "（" + toDisplayString(s.value['待排产笔数'] ?? 0) + toDisplayString(unref(tt)('笔')) + "）；" + toDisplayString(unref(tt)('今日排产')) + "（" + toDisplayString(s.value['今日排产']?.张数 ?? 0) + toDisplayString(unref(tt)('张')) + "/" + toDisplayString(num(s.value['今日排产']?.数量)) + toDisplayString(unref(tt)('件')) + "）；" + toDisplayString(unref(tt)('总未完成量')) + " " + toDisplayString(num(s.value['总未完成量'])), 1)
        ])
      ]),
      _: 1
    }),
    (s.value['待排产池受限'])
      ? (openBlock(), createBlock(_component_el_alert, {
          key: 0,
          type: "info",
          closable: false,
          "show-icon": "",
          title: unref(tt)('本账号按工序/工艺过滤：待排产池仅计划组可见，下方只显示本工序产线的已排工单')
        }, null, 8, ["title"]))
      : createCommentVNode("", true),
    createBaseVNode("div", _hoisted_4, [
      createBaseVNode("div", _hoisted_5, [
        createBaseVNode("span", _hoisted_6, "① " + toDisplayString(unref(tt)('待排产')), 1),
        createBaseVNode("span", _hoisted_7, toDisplayString(unref(tt)('勾选一张工单 → 点「排产」→ 按工艺路线逐道选线(双击行同效)')), 1)
      ]),
      createVNode(_component_el_table, {
        ref_key: "poolTable",
        ref: poolTable,
        data: pool.value,
        size: "small",
        border: "",
        height: "300",
        "empty-text": "",
        "row-key": "rowKey",
        onSelectionChange: onCheck,
        onRowDblclick: planOne
      }, {
        default: withCtx(() => [
          createVNode(_component_el_table_column, {
            type: "selection",
            width: "42",
            "reserve-selection": ""
          }),
          createVNode(_component_el_table_column, {
            label: unref(tt)('客户'),
            prop: "客户",
            "min-width": "150",
            fixed: "",
            "show-overflow-tooltip": ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('客户订单号'),
            prop: "客户订单号",
            width: "140",
            "show-overflow-tooltip": ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('加工单号'),
            prop: "加工单号",
            width: "150",
            "show-overflow-tooltip": ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('工单行号'),
            prop: "工单行号",
            width: "90",
            sortable: ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('批次号'),
            prop: "批次号",
            width: "100",
            sortable: ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('单据日期'),
            prop: "单据日期",
            width: "100"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('产品编号'),
            prop: "产品编号",
            width: "110",
            "show-overflow-tooltip": ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('品名'),
            prop: "品名",
            "min-width": "150",
            "show-overflow-tooltip": ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('型号'),
            prop: "型号",
            width: "120",
            "show-overflow-tooltip": ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('单位'),
            prop: "单位",
            width: "60"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('重点管控'),
            prop: "重点管控",
            width: "85"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('需求数量'),
            prop: "需求数量",
            width: "95",
            align: "right"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('排产数量'),
            prop: "排产数量",
            width: "95",
            align: "right"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('工序交期'),
            prop: "工序交期",
            width: "100"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('交期紧迫度'),
            width: "100",
            align: "right"
          }, {
            default: withCtx(({ row }) => [
              createBaseVNode("span", {
                class: normalizeClass(urgent(row.交期紧迫度))
              }, toDisplayString(row.交期紧迫度 ?? '-'), 3)
            ]),
            _: 1
          }, 8, ["label"])
        ]),
        _: 1
      }, 8, ["data"])
    ]),
    createBaseVNode("div", _hoisted_8, [
      createBaseVNode("div", _hoisted_9, [
        createBaseVNode("span", _hoisted_10, "② " + toDisplayString(mode.value === 'today' ? unref(tt)('今日已排产') : unref(tt)('全部已排产')), 1),
        createVNode(_component_el_switch, {
          modelValue: allMode.value,
          "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((allMode).value = $event)),
          "active-text": unref(tt)('全部'),
          onChange: loadToday
        }, null, 8, ["modelValue", "active-text"]),
        createBaseVNode("div", _hoisted_11, [
          createVNode(_component_el_button, {
            size: "small",
            type: "primary",
            plain: "",
            disabled: checkedToday.value.length !== 1,
            onClick: _cache[5] || (_cache[5] = $event => (openPlan(checkedToday.value[0], true)))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('预排线')), 1)
            ]),
            _: 1
          }, 8, ["disabled"]),
          createVNode(_component_el_button, {
            size: "small",
            type: "danger",
            plain: "",
            disabled: !checkedToday.value.length,
            onClick: unassign
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('撤销排产')) + "（" + toDisplayString(checkedToday.value.length) + "） ", 1)
            ]),
            _: 1
          }, 8, ["disabled"])
        ])
      ]),
      createVNode(_component_el_table, {
        ref: "todayTable",
        data: todayRows.value,
        size: "small",
        border: "",
        height: "240",
        "empty-text": "",
        "row-key": "rowKey",
        onSelectionChange: onCheckToday
      }, {
        default: withCtx(() => [
          createVNode(_component_el_table_column, {
            type: "selection",
            width: "42"
          }),
          createVNode(_component_el_table_column, {
            label: unref(tt)('生产线'),
            prop: "生产线",
            width: "110",
            fixed: ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('排产班组'),
            prop: "排产班组",
            width: "100",
            fixed: ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('加工单号'),
            prop: "加工单号",
            width: "150"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('工单行号'),
            prop: "工单行号",
            width: "90",
            sortable: ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('批次号'),
            prop: "批次号",
            width: "100",
            sortable: ""
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('生产状态'),
            prop: "生产状态",
            width: "90"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('排产数量'),
            prop: "排产数量",
            width: "95",
            align: "right"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('需求数量'),
            prop: "需求数量",
            width: "95",
            align: "right"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('入库数量'),
            prop: "入库数量",
            width: "95",
            align: "right"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('余量'),
            prop: "余量",
            width: "85",
            align: "right"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('预开工日'),
            prop: "预开工日",
            width: "105"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('预完工日'),
            prop: "预完工日",
            width: "105"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('计划线'),
            prop: "计划线",
            "min-width": "240",
            "show-overflow-tooltip": ""
          }, null, 8, ["label"])
        ]),
        _: 1
      }, 8, ["data"])
    ]),
    createVNode(ProcessRoutePlanDialog, {
      modelValue: planVisible.value,
      "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((planVisible).value = $event)),
      加工单号: planRow.value['加工单号'] || '',
      行id: planRow.value['行id'] ?? null,
      工单行号: planRow.value['工单行号'] || '',
      批次号: planRow.value['批次号'] || '',
      已排产: planLocked.value,
      onChanged: loadAll
    }, null, 8, ["modelValue", "加工单号", "行id", "工单行号", "批次号", "已排产"])
  ]))
}
}

};
const ScheduleBoard = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-d6dcd364"]]);

export { ScheduleBoard as default };
