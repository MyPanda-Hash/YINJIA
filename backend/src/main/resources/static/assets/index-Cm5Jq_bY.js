import { v as vLoading, V as ElNotification, A as ElIcon, n as ElSelect, q as ElTooltip, f as ElDialog, o as ElOption, d as ElButton, k as ElMessage } from './element-plus-W84rT0en.js';
import { t as tt, r as request, c as useUserStore } from './index-CqmwEeWF.js';
/* empty css                   */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                */
/* empty css                   */
import { o as openBlock, c as createElementBlock, J as Fragment, ae as renderList, S as normalizeClass, a as createBaseVNode, $ as toDisplayString, R as normalizeStyle, Z as createCommentVNode, A as unref, f as computed, _ as createTextVNode, q as onMounted, aG as createStaticVNode, p as ref, j as watch, D as onBeforeUnmount, P as createBlock, a0 as createVNode, W as withCtx, X as withDirectives, aE as useRouter, aj as resolveComponent, Y as resolveDynamicComponent, aq as withKeys } from './vue-vendor-DyX2BAKf.js';
import { u as useTabsStore } from './tabs-DN15ZjeN.js';
import { u as useAppStore, p as pickQuickEntries } from './app-CjWjAKXa.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import { r as recordSheetConfigs, R as RecordSheetPanels } from './RecordSheetPanels-qfyFO_4T.js';
import './element-icons-DOEvq9OG.js';
/* empty css                         */
/* empty css                  */
/* empty css                        */
import './sumTotals-C3PClexH.js';
import './StdLibManager-Dp-r8k7m.js';
/* empty css                       */

/* unplugin-vue-components disabled */

const _hoisted_1$4 = { class: "sbars" };
const _hoisted_2$4 = ["title"];
const _hoisted_3$4 = ["title"];
const _hoisted_4$4 = { class: "bar-track" };
const _hoisted_5$4 = { class: "bar-val" };
const _hoisted_6$4 = {
  key: 0,
  class: "bar-pct"
};
const _hoisted_7$4 = {
  key: 1,
  class: "chart-empty"
};


const _sfc_main$4 = {
  __name: 'SBars',
  props: {
  data: { type: Array, default: () => [] },
  colors: { type: Array, default: () => ['#116a5b', '#d79a2b', '#537786', '#8a9a92', '#3b8978', '#b94d3f', '#9c7650', '#708575'] },
  /** 图例显示占比百分比(分类型数据开;排名型默认关) */
  showPct: { type: Boolean, default: false },
  /** 数据已按降序传入(仅影响首行强调样式) */
  sorted: { type: Boolean, default: true },
},
  setup(__props) {

// SBars —— 横向条形(桌面图表族)。
// 2026-09-28 对照公开看板设计参考(UXPin 指南/Tulip 制造业实践)升级:
//  · 数值语境化:千分位/万位紧凑格式 + 可选占比百分比(showPct)
//  · 渐进披露:整行 title 提示(名称/值/口径 meta)
//  · 视觉层级:降序数据的首行(top)值加粗强调
//  · 可访问性:数字 tabular-nums(不随字宽跳动);空态文案走 tt()
const props = __props;

const max = computed(() => {
  const m = Math.max(...props.data.map((d) => d.value || 0), 1);
  return m || 1
});
const total = computed(() => props.data.reduce((s, d) => s + (d.value || 0), 0));

function pct(v) {
  return Math.round(((v || 0) / max.value) * 100)
}
function colorOf(i) {
  return props.colors[i % props.colors.length]
}
/** 千分位;≥1 万缩「x.x万」(KPI 同款 formatCompact 口径) */
function fmt(v) {
  const n = Number(v || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return n.toLocaleString('zh-CN')
}

return (_ctx, _cache) => {
  return (openBlock(), createElementBlock("div", _hoisted_1$4, [
    (__props.data.length)
      ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(__props.data, (d, i) => {
          return (openBlock(), createElementBlock("div", {
            key: i,
            class: normalizeClass(["bar-row", { top: i === 0 && __props.sorted }]),
            title: `${d.name}：${fmt(d.value)}${d.meta ? '（' + d.meta + '）' : ''}`
          }, [
            createBaseVNode("span", {
              class: "bar-label",
              title: d.name
            }, toDisplayString(d.name), 9, _hoisted_3$4),
            createBaseVNode("div", _hoisted_4$4, [
              createBaseVNode("div", {
                class: "bar-fill",
                style: normalizeStyle({ width: pct(d.value) + '%', background: colorOf(i) })
              }, null, 4)
            ]),
            createBaseVNode("span", _hoisted_5$4, toDisplayString(fmt(d.value)), 1),
            (__props.showPct && total.value > 0)
              ? (openBlock(), createElementBlock("span", _hoisted_6$4, toDisplayString(Math.round(((d.value || 0) / total.value) * 100)) + "%", 1))
              : createCommentVNode("", true)
          ], 10, _hoisted_2$4))
        }), 128))
      : (openBlock(), createElementBlock("div", _hoisted_7$4, toDisplayString(unref(tt)('暂无数据')), 1))
  ]))
}
}

};
const SBars = /*#__PURE__*/_export_sfc(_sfc_main$4, [['__scopeId',"data-v-69db7310"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$3 = { class: "sdonut" };
const _hoisted_2$3 = { class: "donut-wrap" };
const _hoisted_3$3 = {
  viewBox: "0 0 120 120",
  class: "donut-svg"
};
const _hoisted_4$3 = ["stroke", "stroke-dasharray", "stroke-dashoffset"];
const _hoisted_5$3 = { class: "donut-center" };
const _hoisted_6$3 = { class: "donut-total" };
const _hoisted_7$3 = { class: "donut-sub" };
const _hoisted_8$3 = { class: "donut-legend" };
const _hoisted_9$3 = ["title"];
const _hoisted_10$3 = { class: "lg-name" };
const _hoisted_11$3 = { class: "lg-val" };
const _hoisted_12$3 = { class: "lg-pct" };
const _hoisted_13$3 = {
  key: 1,
  class: "chart-empty"
};


const _sfc_main$3 = {
  __name: 'SDonut',
  props: {
  data: { type: Array, default: () => [] },
  sub: { type: String, default: '合计' },
  colors: { type: Array, default: () => ['#116a5b', '#d79a2b', '#537786', '#8a9a92', '#3b8978', '#b94d3f', '#9c7650', '#708575'] },
},
  setup(__props) {

// SDonut —— 环形占比(桌面图表族)。
// 2026-09-28 参考升级:图例带占比百分比 + 数值千分位/万位紧凑(语境化);
// 空态文案走 tt();数字 tabular-nums。
const props = __props;

const C = 2 * Math.PI * 48;
const total = computed(() => props.data.reduce((s, d) => s + (d.value || 0), 0));
const segments = computed(() => {
  let acc = 0;
  return props.data.map((d) => {
    const len = total.value ? (d.value / total.value) * C : 0;
    const seg = { name: d.name, value: d.value, len, offset: acc };
    acc += len;
    return seg
  })
});
function colorOf(i) {
  return props.colors[i % props.colors.length]
}
function pctOf(v) {
  return total.value ? Math.round(((v || 0) / total.value) * 100) : 0
}
function fmt(v) {
  const n = Number(v || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return n.toLocaleString('zh-CN')
}

return (_ctx, _cache) => {
  return (openBlock(), createElementBlock("div", _hoisted_1$3, [
    (__props.data.length)
      ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
          createBaseVNode("div", _hoisted_2$3, [
            (openBlock(), createElementBlock("svg", _hoisted_3$3, [
              _cache[0] || (_cache[0] = createBaseVNode("circle", {
                cx: "60",
                cy: "60",
                r: "48",
                fill: "none",
                stroke: "var(--t-border-light)",
                "stroke-width": "16"
              }, null, -1)),
              (openBlock(true), createElementBlock(Fragment, null, renderList(segments.value, (seg, i) => {
                return (openBlock(), createElementBlock("circle", {
                  key: i,
                  cx: "60",
                  cy: "60",
                  r: "48",
                  fill: "none",
                  stroke: colorOf(i),
                  "stroke-width": "16",
                  "stroke-dasharray": `${seg.len} ${C - seg.len}`,
                  "stroke-dashoffset": -seg.offset,
                  transform: "rotate(-90 60 60)"
                }, null, 8, _hoisted_4$3))
              }), 128))
            ])),
            createBaseVNode("div", _hoisted_5$3, [
              createBaseVNode("div", _hoisted_6$3, toDisplayString(total.value), 1),
              createBaseVNode("div", _hoisted_7$3, toDisplayString(__props.sub), 1)
            ])
          ]),
          createBaseVNode("div", _hoisted_8$3, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(segments.value, (seg, i) => {
              return (openBlock(), createElementBlock("div", {
                key: i,
                class: "lg-item",
                title: `${seg.name}：${fmt(seg.value)}（${pctOf(seg.value)}%）`
              }, [
                createBaseVNode("span", {
                  class: "lg-dot",
                  style: normalizeStyle({ background: colorOf(i) })
                }, null, 4),
                createBaseVNode("span", _hoisted_10$3, toDisplayString(seg.name), 1),
                createBaseVNode("span", _hoisted_11$3, toDisplayString(fmt(seg.value)), 1),
                createBaseVNode("span", _hoisted_12$3, toDisplayString(pctOf(seg.value)) + "%", 1)
              ], 8, _hoisted_9$3))
            }), 128))
          ])
        ], 64))
      : (openBlock(), createElementBlock("div", _hoisted_13$3, toDisplayString(unref(tt)('暂无数据')), 1))
  ]))
}
}

};
const SDonut = /*#__PURE__*/_export_sfc(_sfc_main$3, [['__scopeId',"data-v-fc9b2d66"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$2 = {
  key: 0,
  class: "line-context"
};
const _hoisted_2$2 = { class: "ctx-max" };
const _hoisted_3$2 = ["viewBox"];
const _hoisted_4$2 = ["y1", "y2"];
const _hoisted_5$2 = ["points"];
const _hoisted_6$2 = ["points"];
const _hoisted_7$2 = ["points"];
const _hoisted_8$2 = ["cx", "cy"];
const _hoisted_9$2 = ["cx", "cy"];
const _hoisted_10$2 = ["x", "y"];
const _hoisted_11$2 = { class: "line-x" };
const _hoisted_12$2 = { class: "line-legend" };
const _hoisted_13$2 = { class: "lg-k" };
const _hoisted_14$2 = { class: "lg-k" };

const W = 320;
const H = 120;
const PAD = 12;


const _sfc_main$2 = {
  __name: 'SLine',
  props: {
  data: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
  // 图例文案(2026-09-28 桌面深度开发:出入库/送检合格等场景复用;默认保持原 新增/完工)
  legendA: { type: String, default: '新增' },
  legendB: { type: String, default: '完工' },
},
  setup(__props) {

const props = __props;

const max = computed(() => Math.max(...props.data.flatMap((d) => [d.added || 0, d.done || 0]), 1));
const xy = (key) => {
  const n = props.data.length;
  return props.data.map((d, i) => ({
    x: n <= 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1),
    y: H - PAD - ((d[key] || 0) / max.value) * (H - PAD * 2),
  }))
};
const xysA = computed(() => xy('added'));
const xysB = computed(() => xy('done'));
const ptsA = computed(() => xysA.value.map((p) => `${p.x},${p.y}`).join(' '));
const ptsB = computed(() => xysB.value.map((p) => `${p.x},${p.y}`).join(' '));
const areaA = computed(() => {
  if (!xysA.value.length) return ''
  return `${PAD},${H - PAD} ${ptsA.value} ${W - PAD},${H - PAD}`
});
// 语境标注(2026-09-28 参考升级):峰值=added 序列最大值;末点=added 最后一天读数
const peakIdxA = computed(() => {
  let best = -1, bv = -1;
  props.data.forEach((d, i) => { if ((d.added || 0) > bv) { bv = d.added || 0; best = i; } });
  return best
});
const peakText = computed(() => {
  const d = props.data[peakIdxA.value];
  return d ? `${d.date} · ${d.added || 0}` : ''
});
const lastA = computed(() => xysA.value[xysA.value.length - 1] || null);
const lastText = computed(() => {
  const d = props.data[props.data.length - 1];
  return d ? String(d.added || 0) : ''
});

return (_ctx, _cache) => {
  return (openBlock(), createElementBlock("div", {
    class: normalizeClass(["sline", { compact: __props.compact }])
  }, [
    (__props.data.length)
      ? (openBlock(), createElementBlock("div", _hoisted_1$2, [
          createBaseVNode("span", _hoisted_2$2, toDisplayString(unref(tt)('峰值')) + " " + toDisplayString(peakText.value), 1)
        ]))
      : createCommentVNode("", true),
    (openBlock(), createElementBlock("svg", {
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: "none",
      class: "line-svg"
    }, [
      (openBlock(), createElementBlock(Fragment, null, renderList([30, 60, 90], (y) => {
        return createBaseVNode("line", {
          key: y,
          x1: "12",
          y1: y,
          x2: "308",
          y2: y,
          class: "grid-line"
        }, null, 8, _hoisted_4$2)
      }), 64)),
      createBaseVNode("polygon", {
        points: areaA.value,
        class: "line-area"
      }, null, 8, _hoisted_5$2),
      createBaseVNode("polyline", {
        points: ptsA.value,
        fill: "none",
        stroke: "#537786",
        "stroke-width": "2",
        class: "series-line"
      }, null, 8, _hoisted_6$2),
      createBaseVNode("polyline", {
        points: ptsB.value,
        fill: "none",
        stroke: "#116a5b",
        "stroke-width": "2",
        "stroke-dasharray": "5 4",
        class: "series-line series-done"
      }, null, 8, _hoisted_7$2),
      (openBlock(true), createElementBlock(Fragment, null, renderList(xysA.value, (p, i) => {
        return (openBlock(), createElementBlock("circle", {
          key: 'a' + i,
          cx: p.x,
          cy: p.y,
          r: "2.5",
          fill: "#537786",
          class: normalizeClass({ peak: i === peakIdxA.value })
        }, null, 10, _hoisted_8$2))
      }), 128)),
      (openBlock(true), createElementBlock(Fragment, null, renderList(xysB.value, (p, i) => {
        return (openBlock(), createElementBlock("circle", {
          key: 'd' + i,
          cx: p.x,
          cy: p.y,
          r: "2.5",
          fill: "#116a5b"
        }, null, 8, _hoisted_9$2))
      }), 128)),
      (lastA.value && __props.data.length)
        ? (openBlock(), createElementBlock("text", {
            key: 0,
            x: Math.min(lastA.value.x, W - 6),
            y: Math.max(lastA.value.y - 6, 10),
            class: "last-val",
            "text-anchor": "end"
          }, toDisplayString(lastText.value), 9, _hoisted_10$2))
        : createCommentVNode("", true)
    ], 8, _hoisted_3$2)),
    createBaseVNode("div", _hoisted_11$2, [
      (openBlock(true), createElementBlock(Fragment, null, renderList(__props.data, (d) => {
        return (openBlock(), createElementBlock("span", {
          key: d.date,
          class: "lx"
        }, toDisplayString(d.date), 1))
      }), 128))
    ]),
    createBaseVNode("div", _hoisted_12$2, [
      createBaseVNode("span", _hoisted_13$2, [
        _cache[0] || (_cache[0] = createBaseVNode("i", { class: "lg-dot added" }, null, -1)),
        createTextVNode(toDisplayString(__props.legendA), 1)
      ]),
      createBaseVNode("span", _hoisted_14$2, [
        _cache[1] || (_cache[1] = createBaseVNode("i", { class: "lg-dot done" }, null, -1)),
        createTextVNode(toDisplayString(__props.legendB), 1)
      ])
    ])
  ], 2))
}
}

};
const SLine = /*#__PURE__*/_export_sfc(_sfc_main$2, [['__scopeId',"data-v-7d9dbf31"]]);

/**
 * 产能对比柱状图 —— 几何与格式化口径的唯一真源(纯函数,node:test 钉住)。
 *
 * 为什么单独成文件(2026-10-08 用户需求「日产能对比可以 tap 切换周/月/年,柱状图竖向排列」):
 *   柱高怎么算、轴取到多少、哪根柱该变色,这些如果写在 .vue 里就只能靠肉眼看图验证;
 *   8 条产线 × 4 个周期各画一遍,改一次样式就要人眼复核一次,画错了没人发现。
 *   抽成纯函数后,几何口径由 `capacityBars.test.js` 守着,组件只负责画。
 *
 * 口径(与既有「单天产能比」子弹条 SCapacity.vue 保持一致,别各写一套):
 *   · 实际与上限**共用同一条刻度轴**(轴上限 = 两者最大值向上取整到 1/2/5×10^n),
 *     否则「实际比上限高」这种事实在图上读不出来;
 *   · 超上限的柱高帽在 100% —— 比例失真是误导,溢出靠颜色 + 数字表达;
 *   · 未配日产能上限(limit=null)的行不画上限柱,色标记 na,提示去产线档案维护。
 */

/** 四档周期。key 与后端 `?period=` 一一对应;days 用于图例说明上限折算口径。 */
const CAPACITY_PERIODS = [
  { key: 'day', label: '日产能', days: 1 },
  { key: 'week', label: '周产能', days: 7 },
  // 月按自然月天数折算(28~31 天不定),故 days=null 由后端算,前端只说明「按当月自然日」
  { key: 'month', label: '月产能', days: null },
  { key: 'year', label: '年产能', days: 365 },
];

/** 轴上限:向上取整到 1/2/5×10^n。空/非正数退化为 1(顺带做除零保护)。 */
function niceMax(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  for (const m of [1, 2, 5, 10]) {
    if (n <= m * exp) return m * exp
  }
  return 10 * exp
}

/** 达成率配色:与子弹条同阈值(<80 正常 / 80–100 接近满载 / >100 超上限 / 无上限)。 */
function toneOf(pct) {
  if (pct == null) return 'na'
  if (pct > 100) return 'over'
  if (pct >= 80) return 'warn'
  return 'ok'
}

/**
 * 把后端行数据换算成柱高百分比。
 * @param {Array<{name:string, actual:number, limit:number|null, pct:number|null}>} rows 后端顺序即显示顺序
 * @returns {{max:number, rows:Array}} max = 刻度轴上限(原始值,用于刻度标签)
 */
function scaleCapacity(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { max: 1, rows: [] }
  const nums = [];
  for (const r of list) {
    const a = Number(r?.actual);
    if (Number.isFinite(a)) nums.push(a);
    const l = Number(r?.limit);
    if (r?.limit != null && Number.isFinite(l)) nums.push(l);
  }
  const max = niceMax(nums.length ? Math.max(...nums) : 0);
  const pctOf = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 0
    return Math.min(100, Math.max(0, Math.round((n / max) * 100)))
  };
  return {
    max,
    rows: list.map((r) => ({
      ...r,
      actualPct: pctOf(r?.actual),
      limitPct: r?.limit == null ? 0 : pctOf(r.limit),
      tone: toneOf(r?.pct),
    })),
  }
}

/** 柱顶/纵轴数值:≤4 字符宽,过万缩「x.x万」(与看板 KPI 同款紧凑口径)。 */
function fmtCompact(v) {
  const n = Number(v || 0);
  if (Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  }
  return n.toLocaleString('zh-CN')
}

/**
 * 标题副行:数据区间 + 上限折算口径。
 * ⚠ 口径按**数据自己的周期**(payload.period)取,不按当前选中的 tab ——
 *   点「周产能」的一瞬间新周期规则就绪、数据还没回来,若按选中的 tab 标注,
 *   标题会写成「数据区间 2026-08-26 · 上限 = 日产能 × 7 天」这种自相矛盾的组合
 *   (2026-10-08 界面探针在切换瞬间读到过这个混搭态)。
 * @param {{period?:string, from?:string, to?:string}|null} payload 后端载荷
 * @param {string} selectedKey 当前选中的周期(载荷还没有 period 时的兜底)
 * @param {(s:string)=>string} t 翻译函数(默认原样返回,便于单测)
 */
function capacitySubText(payload, selectedKey, t = (s) => s) {
  const d = payload || {};
  const p = CAPACITY_PERIODS.find((x) => x.key === (d.period || selectedKey)) || CAPACITY_PERIODS[0];
  const span = d.from ? `${d.from}${d.to && d.to !== d.from ? ' ~ ' + d.to : ''}` : '';
  const rule = p.days ? `${t('上限 = 日产能 ×')} ${p.days} ${t('天')}` : t('上限 = 日产能 × 当月自然日');
  return [span ? `${t('数据区间')} ${span}` : '', rule].filter(Boolean).join(' · ')
}

/* unplugin-vue-components disabled */

const _hoisted_1$1 = ["data-period", "data-loading", "data-err"];
const _hoisted_2$1 = { class: "cap-head" };
const _hoisted_3$1 = ["aria-label"];
const _hoisted_4$1 = ["aria-selected", "onClick"];
const _hoisted_5$1 = ["title"];
const _hoisted_6$1 = {
  key: 0,
  class: "chart-empty"
};
const _hoisted_7$1 = {
  key: 1,
  class: "chart-empty"
};
const _hoisted_8$1 = {
  key: 2,
  class: "chart-empty"
};
const _hoisted_9$1 = {
  class: "cap-grid",
  "aria-hidden": "true"
};
const _hoisted_10$1 = { class: "grid-num" };
const _hoisted_11$1 = { class: "cap-groups" };
const _hoisted_12$1 = ["title", "aria-label"];
const _hoisted_13$1 = { class: "cap-pair" };
const _hoisted_14$1 = { class: "bar-num" };
const _hoisted_15$1 = ["title"];
const _hoisted_16$1 = { class: "cap-legend" };
const _hoisted_17$1 = { class: "lg-k" };
const _hoisted_18$1 = { class: "lg-k" };


const _sfc_main$1 = {
  __name: 'SCapacityBars',
  setup(__props) {

/**
 * SCapacityBars —— 产能对比(竖向双柱 + 周期 tab)。
 *
 * 2026-10-08 用户需求:「把生产方面的日产能对比加上可以 tap 切换周产能、月产能、年产能对比,
 * 然后柱状图应该是竖向排列」。
 *   · 取代原 SCapacity.vue 的水平子弹条(同一块卡片),改成**竖向柱**:
 *     每条产线一组两根柱 —— 实际(语义色)与上限(浅色),共用一条刻度轴才能读出「实际比上限高」;
 *   · 四档周期各自向后端取数(`/dashboard/capacity?period=`) —— 切 tab 只重算这一块,
 *     不重跑整桌面的聚合;周期口径(最近有报工的那个周期)与上限折算由后端定,前端不自行推算;
 *   · 柱高/刻度/配色口径全在纯函数 `@core/dashboard/capacityBars`(有单测),本组件只负责画。
 * 为什么是竖向:横向条在同一屏里最多堆 8~10 条就占满高度,而「周期对比」的直觉是时间轴上的柱,
 * 且竖向柱能并排表达「实际 vs 上限」这组对照(横向条只能叠两层)。
 */
const periods = CAPACITY_PERIODS;
const period = ref(periods[0].key);
const payload = ref({ rows: [] });
const loading = ref(false);
const err = ref(false);
/** 连点 tab 时丢弃过期响应(慢的那个后到会把新周期的数据画上去) */
let seq = 0;

const scaled = computed(() => scaleCapacity(payload.value.rows || []));

/** 纵轴刻度:0/25/50/75/100% 五档(轴上限即最大柱值,数值用紧凑格式) */
const ticks = computed(() =>
  [0, 25, 50, 75, 100].map((pct) => ({ pct, value: Math.round((scaled.value.max * pct) / 100) })),
);

const subText = computed(() => capacitySubText(payload.value, period.value, tt));

function select(key) {
  if (key === period.value) return
  period.value = key;
  load();
}

function rowTitle(r) {
  const head = `${r.name}：${tt('实际产出')} ${fmtCompact(r.actual)}`;
  if (r.limit == null) return `${head} · ${tt('未配日产能上限，请在产线档案维护')}`
  return `${head} / ${tt('产能上限')} ${fmtCompact(r.limit)}（${r.pct}%）`
}

async function load() {
  const mine = ++seq;
  loading.value = true;
  err.value = false;
  try {
    payload.value = await fetchCapacity(mine);
  } catch (e) {
    // 后端冷启动时首次请求会超时(2026-10-08 实测:AxiosError timeout of 15000ms,
    // 而同端点在热态只要 4~32ms)—— 桌面卡片不该为这一下就摆出失败态,自动重试一次再说。
    console.warn('[SCapacityBars] 首次请求失败,1.5s 后重试一次', e);
    await new Promise((r) => setTimeout(r, 1500));
    try {
      payload.value = await fetchCapacity(mine);
    } catch (e2) {
      // 重试仍失败必须**说出来**:原先一律退化成「暂无数据」,把「请求挂了」伪装成「本来就没数据」,
      // 用户看到空图、排查时也看不到原因(2026-10-08 界面探针正是这么被误导的)
      console.error('[SCapacityBars] 产能接口请求失败', e2);
      if (mine === seq) {
        err.value = true;
        payload.value = { rows: [] };
      }
    }
  } finally {
    if (mine === seq) loading.value = false;
  }
}

/** 取一个周期的数据;并发过期(连点 tab)时返回 undefined 由调用方丢弃 */
async function fetchCapacity(mine) {
  const r = await request.get('/dashboard/capacity', { params: { period: period.value } });
  if (mine !== seq) return undefined
  return r?.data || { rows: [] }
}

onMounted(load);

return (_ctx, _cache) => {
  return (openBlock(), createElementBlock("div", {
    class: "scapbars",
    "data-period": payload.value.period || '',
    "data-loading": loading.value ? '1' : '0',
    "data-err": err.value ? '1' : '0'
  }, [
    createBaseVNode("div", _hoisted_2$1, [
      createBaseVNode("div", {
        class: "cap-tabs",
        role: "tablist",
        "aria-label": unref(tt)('产能统计周期')
      }, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(unref(periods), (p) => {
          return (openBlock(), createElementBlock("button", {
            key: p.key,
            type: "button",
            role: "tab",
            class: normalizeClass(["cap-tab", { on: period.value === p.key }]),
            "aria-selected": period.value === p.key,
            onClick: $event => (select(p.key))
          }, toDisplayString(unref(tt)(p.label)), 11, _hoisted_4$1))
        }), 128))
      ], 8, _hoisted_3$1),
      createBaseVNode("span", {
        class: "cap-sub",
        title: subText.value
      }, toDisplayString(subText.value), 9, _hoisted_5$1)
    ]),
    (loading.value && !scaled.value.rows.length)
      ? (openBlock(), createElementBlock("div", _hoisted_6$1, toDisplayString(unref(tt)('加载中')) + "…", 1))
      : (err.value)
        ? (openBlock(), createElementBlock("div", _hoisted_7$1, [
            createTextVNode(toDisplayString(unref(tt)('加载失败')) + " ", 1),
            createBaseVNode("button", {
              type: "button",
              class: "cap-retry",
              onClick: load
            }, toDisplayString(unref(tt)('重试')), 1)
          ]))
        : (!scaled.value.rows.length)
          ? (openBlock(), createElementBlock("div", _hoisted_8$1, toDisplayString(unref(tt)('暂无数据')), 1))
          : (openBlock(), createElementBlock(Fragment, { key: 3 }, [
              createBaseVNode("div", {
                class: normalizeClass(["cap-plot", { busy: loading.value }])
              }, [
                createBaseVNode("div", _hoisted_9$1, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(ticks.value, (t) => {
                    return (openBlock(), createElementBlock("span", {
                      key: t.pct,
                      class: "grid-line",
                      style: normalizeStyle({ bottom: t.pct + '%' })
                    }, [
                      createBaseVNode("em", _hoisted_10$1, toDisplayString(unref(fmtCompact)(t.value)), 1)
                    ], 4))
                  }), 128))
                ]),
                createBaseVNode("div", _hoisted_11$1, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(scaled.value.rows, (r) => {
                    return (openBlock(), createElementBlock("div", {
                      key: r.name,
                      class: "cap-group",
                      title: rowTitle(r),
                      "aria-label": rowTitle(r)
                    }, [
                      createBaseVNode("div", _hoisted_13$1, [
                        createBaseVNode("div", {
                          class: normalizeClass(["cap-bar actual", 'tone-' + r.tone]),
                          style: normalizeStyle({ height: r.actualPct + '%' })
                        }, [
                          createBaseVNode("span", _hoisted_14$1, toDisplayString(unref(fmtCompact)(r.actual)), 1)
                        ], 6),
                        createBaseVNode("div", {
                          class: normalizeClass(["cap-bar limit", { none: r.limit == null }]),
                          style: normalizeStyle({ height: r.limitPct + '%' })
                        }, null, 6)
                      ]),
                      createBaseVNode("span", {
                        class: "cap-name",
                        title: r.name
                      }, toDisplayString(r.name), 9, _hoisted_15$1)
                    ], 8, _hoisted_12$1))
                  }), 128))
                ])
              ], 2),
              createBaseVNode("div", _hoisted_16$1, [
                createBaseVNode("span", _hoisted_17$1, [
                  _cache[0] || (_cache[0] = createBaseVNode("i", { class: "lg-swatch actual" }, null, -1)),
                  createTextVNode(toDisplayString(unref(tt)('实际产出')), 1)
                ]),
                createBaseVNode("span", _hoisted_18$1, [
                  _cache[1] || (_cache[1] = createBaseVNode("i", { class: "lg-swatch limit" }, null, -1)),
                  createTextVNode(toDisplayString(unref(tt)('产能上限')), 1)
                ]),
                _cache[2] || (_cache[2] = createStaticVNode("<span class=\"lg-k\" data-v-35f969c0><i class=\"lg-dot ok\" data-v-35f969c0></i>&lt;80%</span><span class=\"lg-k\" data-v-35f969c0><i class=\"lg-dot warn\" data-v-35f969c0></i>80–100%</span><span class=\"lg-k\" data-v-35f969c0><i class=\"lg-dot over\" data-v-35f969c0></i>&gt;100%</span>", 3))
              ])
            ], 64))
  ], 8, _hoisted_1$1))
}
}

};
const SCapacityBars = /*#__PURE__*/_export_sfc(_sfc_main$1, [['__scopeId',"data-v-35f969c0"]]);

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "dashboard" };
const _hoisted_2 = { class: "welcome card" };
const _hoisted_3 = { class: "wl-left" };
const _hoisted_4 = { class: "hello" };
const _hoisted_5 = { class: "meta" };
const _hoisted_6 = { class: "shift-ic" };
const _hoisted_7 = {
  key: 0,
  class: "quick"
};
const _hoisted_8 = { class: "mod-tabs" };
const _hoisted_9 = ["aria-pressed", "onClick"];
const _hoisted_10 = {
  key: 0,
  class: "dash-grid"
};
const _hoisted_11 = { class: "metric-head" };
const _hoisted_12 = { class: "metric-label" };
const _hoisted_13 = { class: "metric-state" };
const _hoisted_14 = { class: "metric-main" };
const _hoisted_15 = { class: "metric-icon" };
const _hoisted_16 = { class: "metric-reading" };
const _hoisted_17 = {
  class: "micro-bars",
  "aria-hidden": "true"
};
const _hoisted_18 = { class: "metric-foot" };
const _hoisted_19 = { class: "metric-signal" };
const _hoisted_20 = {
  key: 1,
  class: "card operation-core col-8 reveal-item"
};
const _hoisted_21 = { class: "panel-heading" };
const _hoisted_22 = { class: "card-title" };
const _hoisted_23 = { class: "live-chip" };
const _hoisted_24 = { class: "core-layout" };
const _hoisted_25 = { class: "execution-gauge" };
const _hoisted_26 = { class: "gauge-visual" };
const _hoisted_27 = {
  viewBox: "0 0 120 120",
  "aria-hidden": "true"
};
const _hoisted_28 = { class: "gauge-copy" };
const _hoisted_29 = { class: "gauge-facts" };
const _hoisted_30 = { class: "execution-detail" };
const _hoisted_31 = { class: "trend-head" };
const _hoisted_32 = {
  key: 1,
  class: "empty compact-empty trend-empty"
};
const _hoisted_33 = { class: "order-queue" };
const _hoisted_34 = ["title"];
const _hoisted_35 = ["aria-label"];
const _hoisted_36 = {
  key: 0,
  class: "empty compact-empty"
};
const _hoisted_37 = {
  key: 2,
  class: "card quality-watch col-4 reveal-item"
};
const _hoisted_38 = { class: "panel-heading" };
const _hoisted_39 = { class: "card-title" };
const _hoisted_40 = { class: "quality-summary" };
const _hoisted_41 = { class: "quality-ring" };
const _hoisted_42 = {
  viewBox: "0 0 80 80",
  "aria-hidden": "true"
};
const _hoisted_43 = { class: "quality-facts" };
const _hoisted_44 = { class: "danger-text" };
const _hoisted_45 = { class: "result-strip" };
const _hoisted_46 = { class: "card event-stream col-7 reveal-item" };
const _hoisted_47 = { class: "panel-heading" };
const _hoisted_48 = { class: "card-title" };
const _hoisted_49 = {
  key: 0,
  class: "event-count"
};
const _hoisted_50 = {
  key: 1,
  class: "event-count"
};
const _hoisted_51 = {
  key: 0,
  class: "dev-board"
};
const _hoisted_52 = {
  key: 0,
  class: "dev-table"
};
const _hoisted_53 = { class: "dev-th-prod" };
const _hoisted_54 = { class: "dev-td-prod" };
const _hoisted_55 = ["role", "tabindex", "title", "onClick", "onKeydown"];
const _hoisted_56 = {
  key: 1,
  class: "empty"
};
const _hoisted_57 = {
  key: 1,
  class: "event-list"
};
const _hoisted_58 = { class: "event-axis" };
const _hoisted_59 = { class: "event-icon" };
const _hoisted_60 = ["title"];
const _hoisted_61 = {
  key: 0,
  class: "empty"
};
const _hoisted_62 = { class: "card business-vitals col-5 reveal-item" };
const _hoisted_63 = { class: "panel-heading" };
const _hoisted_64 = { class: "card-title" };
const _hoisted_65 = { class: "doc-volume" };
const _hoisted_66 = ["title"];
const _hoisted_67 = { class: "resource-grid" };
const _hoisted_68 = { class: "data-link" };
const _hoisted_69 = {
  key: 1,
  class: "dash-grid"
};
const _hoisted_70 = { class: "card col-4" };
const _hoisted_71 = { class: "card-title" };
const _hoisted_72 = { class: "chart-box" };
const _hoisted_73 = { class: "card col-4" };
const _hoisted_74 = { class: "card-title" };
const _hoisted_75 = { class: "chart-box" };
const _hoisted_76 = { class: "card col-4" };
const _hoisted_77 = { class: "card-title" };
const _hoisted_78 = { class: "chart-box" };
const _hoisted_79 = { class: "card col-4" };
const _hoisted_80 = { class: "card-title" };
const _hoisted_81 = { class: "chart-sub" };
const _hoisted_82 = { class: "chart-box" };
const _hoisted_83 = { class: "card col-8" };
const _hoisted_84 = { class: "card-title" };
const _hoisted_85 = { class: "chart-box" };
const _hoisted_86 = {
  key: 2,
  class: "dash-grid"
};
const _hoisted_87 = { class: "card metric-card col-3" };
const _hoisted_88 = { class: "kpi-num tone-primary" };
const _hoisted_89 = { class: "kpi-title" };
const _hoisted_90 = { class: "card metric-card col-3" };
const _hoisted_91 = { class: "kpi-num tone-warning" };
const _hoisted_92 = { class: "kpi-title" };
const _hoisted_93 = { class: "card metric-card col-3" };
const _hoisted_94 = { class: "kpi-num tone-steel" };
const _hoisted_95 = { class: "kpi-title" };
const _hoisted_96 = { class: "card metric-card col-3" };
const _hoisted_97 = { class: "kpi-num tone-neutral" };
const _hoisted_98 = { class: "kpi-title" };
const _hoisted_99 = { class: "card col-6" };
const _hoisted_100 = { class: "card-title" };
const _hoisted_101 = { class: "chart-box" };
const _hoisted_102 = { class: "card col-6" };
const _hoisted_103 = { class: "card-title" };
const _hoisted_104 = { class: "chart-box" };
const _hoisted_105 = { class: "card col-6" };
const _hoisted_106 = { class: "card-title" };
const _hoisted_107 = { class: "chart-box" };
const _hoisted_108 = { class: "card col-6" };
const _hoisted_109 = { class: "card-title" };
const _hoisted_110 = { class: "chart-box" };
const _hoisted_111 = {
  key: 3,
  class: "dash-grid"
};
const _hoisted_112 = { class: "card metric-card col-4" };
const _hoisted_113 = { class: "kpi-num tone-primary" };
const _hoisted_114 = { class: "kpi-title" };
const _hoisted_115 = { class: "card metric-card col-4" };
const _hoisted_116 = { class: "kpi-num tone-warning" };
const _hoisted_117 = { class: "kpi-title" };
const _hoisted_118 = { class: "card metric-card col-4" };
const _hoisted_119 = { class: "kpi-num tone-steel" };
const _hoisted_120 = { class: "kpi-title" };
const _hoisted_121 = { class: "card col-6" };
const _hoisted_122 = { class: "card-title" };
const _hoisted_123 = { class: "chart-box" };
const _hoisted_124 = { class: "card col-6" };
const _hoisted_125 = { class: "card-title" };
const _hoisted_126 = { class: "chart-box" };
const _hoisted_127 = { class: "card col-6" };
const _hoisted_128 = { class: "card-title" };
const _hoisted_129 = { class: "chart-box" };
const _hoisted_130 = { class: "card col-6" };
const _hoisted_131 = { class: "card-title" };
const _hoisted_132 = { class: "chart-box" };
const _hoisted_133 = { class: "rd-grid" };
const _hoisted_134 = { class: "card rd-feed" };
const _hoisted_135 = { class: "card-head" };
const _hoisted_136 = { class: "rd-sub" };
const _hoisted_137 = {
  key: 0,
  class: "rd-empty"
};
const _hoisted_138 = {
  key: 1,
  class: "rd-list"
};
const _hoisted_139 = ["onClick"];
const _hoisted_140 = { class: "rd-badge mod" };
const _hoisted_141 = ["title"];
const _hoisted_142 = { class: "rd-meta" };
const _hoisted_143 = { class: "card rd-feed" };
const _hoisted_144 = { class: "card-head" };
const _hoisted_145 = { class: "rd-sub" };
const _hoisted_146 = {
  key: 0,
  class: "rd-empty"
};
const _hoisted_147 = {
  key: 1,
  class: "rd-list"
};
const _hoisted_148 = ["onClick"];
const _hoisted_149 = { class: "rd-badge new" };
const _hoisted_150 = ["title"];
const _hoisted_151 = { class: "rd-meta" };
const _hoisted_152 = { class: "card rd-archive" };
const _hoisted_153 = { class: "card-head" };
const _hoisted_154 = { class: "rd-sub" };
const _hoisted_155 = { class: "rd-chips" };
const _hoisted_156 = ["onClick"];
const _hoisted_157 = {
  key: 0,
  class: "rd-empty"
};
const _hoisted_158 = { class: "dash-grid" };
const _hoisted_159 = { class: "card col-4" };
const _hoisted_160 = { class: "card-title" };
const _hoisted_161 = { class: "chart-box" };
const _hoisted_162 = { class: "card col-4" };
const _hoisted_163 = { class: "card-title" };
const _hoisted_164 = { class: "chart-sub" };
const _hoisted_165 = { class: "chart-box" };
const _hoisted_166 = { class: "card col-4" };
const _hoisted_167 = { class: "card-title" };
const _hoisted_168 = { class: "chart-sub" };
const _hoisted_169 = { class: "chart-box" };
const _hoisted_170 = {
  key: 5,
  class: "dash-grid"
};
const _hoisted_171 = { class: "card metric-card col-3" };
const _hoisted_172 = { class: "kpi-num tone-steel" };
const _hoisted_173 = { class: "kpi-title" };
const _hoisted_174 = { class: "card metric-card col-3" };
const _hoisted_175 = { class: "kpi-num tone-primary" };
const _hoisted_176 = { class: "kpi-title" };
const _hoisted_177 = { class: "card metric-card col-3" };
const _hoisted_178 = { class: "kpi-num tone-danger" };
const _hoisted_179 = { class: "kpi-title" };
const _hoisted_180 = { class: "card metric-card col-3" };
const _hoisted_181 = { class: "kpi-num tone-warning" };
const _hoisted_182 = { class: "kpi-title" };
const _hoisted_183 = { class: "card col-6" };
const _hoisted_184 = { class: "card-title" };
const _hoisted_185 = { class: "chart-box" };
const _hoisted_186 = { class: "card col-6" };
const _hoisted_187 = { class: "card-title" };
const _hoisted_188 = { class: "chart-box" };
const _hoisted_189 = { class: "card col-6" };
const _hoisted_190 = { class: "card-title" };
const _hoisted_191 = { class: "chart-box" };
const _hoisted_192 = { class: "card col-6" };
const _hoisted_193 = { class: "card-title" };
const _hoisted_194 = { class: "chart-box" };
const _hoisted_195 = { class: "arch-bar" };
const _hoisted_196 = ["title", "disabled"];
const _hoisted_197 = ["title", "disabled"];
const _hoisted_198 = { class: "arch-no" };
const _hoisted_199 = ["title", "disabled"];
const _hoisted_200 = ["title", "disabled"];
const _hoisted_201 = { class: "arch-body" };
const _hoisted_202 = {
  key: 1,
  class: "arch-fallback"
};
const _hoisted_203 = { class: "af-grid" };
const _hoisted_204 = { class: "af-label" };
const _hoisted_205 = { class: "af-value" };
const _hoisted_206 = {
  key: 2,
  class: "rd-empty"
};


const _sfc_main = {
  __name: 'index',
  setup(__props) {

const user = useUserStore();
const tabs = useTabsStore();
const app = useAppStore();
const router = useRouter();

const desk = computed(() => app.deskSettings);

// 右上角快捷入口:候选清单真源在 @core/dashboard/deskQuick.js
// (与「工作台设置」的勾选项同一份,加入口只改那里一行)
const quickEntries = computed(() => pickQuickEntries(desk.value.quick, {
  isAdmin: user.isAdmin,
  visiblePanels: user.visiblePanels,
}));

// ---------- 看板模块 ----------
const MODULES = [
  { key: 'overview', title: '概览', icon: 'DataBoard' },
  { key: 'rd', title: '研发管理', icon: 'MagicStick' },
  { key: 'prod', title: '生产', icon: 'Odometer' },
  { key: 'stock', title: '库存', icon: 'Box' },
  { key: 'sales', title: '销售', icon: 'ShoppingCart' },
  { key: 'quality', title: '质量', icon: 'Aim' },
];
const mod = ref('overview');

// ---------- 研发管理模块:修改申请动态 + 最新单据 + 面板档案本 ----------
const rdData = ref({ modifyRequests: [], newDocs: [], panels: [] });
let rdLoaded = false;
async function loadRd() {
  try {
    const r = await request.get('/dashboard/rd');
    if (r?.data) rdData.value = r.data;
    rdLoaded = true;
  } catch { /* 静默 */ }
}
watch(mod, (v) => {
  if (v === 'rd' && !rdLoaded) loadRd();
}, { immediate: true });
function goPanel(panelCode, docNo) {
  if (!panelCode) return
  router.push({ path: `/panelx/list/${panelCode}`, query: docNo ? { focus: docNo } : {} });
}
function fmtRdTime(t) {
  if (!t) return ''
  const s = String(t).replace('T', ' ');
  return s.length > 16 ? s.slice(0, 16) : s
}

// ---------- 档案本:像翻档案一样查阅各文件面板单据(纸张渲染 + 翻页) ----------
const RECORD_SHEET_SET = new Set(Object.keys(recordSheetConfigs));
const archVisible = ref(false);
const archPanel = ref('');
const archPanelName = ref('');
const archDocs = ref([]);
const archFields = ref([]);
const archIdx = ref(0);
const archLoading = ref(false);
const archIsSheet = computed(() => RECORD_SHEET_SET.has(archPanel.value));
const archDoc = computed(() => archDocs.value[archIdx.value] || null);
const archHeaderFields = computed(() => archFields.value.filter((f) => !f.hidden));
async function openArchive(code) {
  archPanel.value = code;
  const p = rdData.value.panels.find((x) => x.code === code);
  archPanelName.value = p ? p.name : code;
  archVisible.value = true;
  archLoading.value = true;
  archIdx.value = 0;
  try {
    const [cfg, docs] = await Promise.all([
      request.get('/px/getPanelConfig', { params: { panelCode: code } }),
      request.post('/px/queryFormDataList', { panelCode: code, condition: {}, pageNo: 1, pageSize: 500 }),
    ]);
    const header = (cfg?.data?.dataSchema?.fields || []).filter((f) => !f.hidden);
    const detail = cfg?.data?.detail?.tabs?.[0]?.fields || [];
    archFields.value = [...header, ...detail];
    archDocs.value = docs?.data?.list || [];
  } catch {
    archDocs.value = [];
    archFields.value = [];
  } finally {
    archLoading.value = false;
  }
}

// ---------- 班次：8:00-21:00 白班，其余夜班；每分钟自动检查，到点自动切换 ----------
const now = ref(new Date());
const shift = computed(() => {
  const h = now.value.getHours();
  return h >= 8 && h < 21
    ? { key: 'day', name: '白班', icon: '☀️', range: '08:00 - 21:00' }
    : { key: 'night', name: '夜班', icon: '🌙', range: '21:00 - 次日 08:00' }
});
const nowTime = computed(() => now.value.toTimeString().slice(0, 5));
const today = computed(() => now.value.toLocaleDateString('zh-CN'));
const greeting = computed(() => {
  const h = now.value.getHours();
  if (h < 6) return '凌晨好'
  if (h < 12) return '上午好'
  if (h < 18) return '下午好'
  return '晚上好'
});
let shiftTimer = null;
let lastShift = '';
function startShiftTimer() {
  lastShift = shift.value.key;
  shiftTimer = setInterval(() => {
    now.value = new Date();
    if (shift.value.key !== lastShift) {
      lastShift = shift.value.key;
      ElNotification({
        title: `已切换至${shift.value.name}`,
        message: `当前班次时段：${shift.value.range}`,
        type: shift.value.key === 'day' ? 'success' : 'info',
        duration: 4000,
      });
    }
  }, 60000);
}

// ---------- 数据加载（真实接口 /dashboard/stats，每 5 分钟刷新） ----------
const stats = ref({
  kpis: {}, docStats: [], progress: [], todos: [], archives: {}, latest: [],
  production: {}, stock: {}, sales: {}, quality: {},
});
const loadingStats = ref(false);
const loadError = ref(false);
const lastUpdated = ref(null);
const refreshLeft = ref(300);
async function load() {
  if (loadingStats.value) return
  loadingStats.value = true;
  try {
    const r = await request.get('/dashboard/stats');
    if (r?.data) {
      stats.value = { ...stats.value, ...r.data };
      lastUpdated.value = new Date();
      refreshLeft.value = 300;
      loadError.value = false;
    }
  } catch (e) {
    loadError.value = true;
  } finally {
    loadingStats.value = false;
  }
}
let refreshTimer = null;

// ── 产品开发业务流(2026-09-09):实时业务事件流里可选「产品信息表」查看下发开发情况 ──
const flowPanel = ref('');
const devBoard = ref([]);
const devMeta = ref([]);
const devLoading = ref(false);
async function loadDevBoard() {
  devLoading.value = true;
  try {
    const [metaRes, boardRes] = await Promise.all([
      request.get('/px/rdDev/meta'),
      request.get('/px/rdDev/board'),
    ]);
    devMeta.value = Array.isArray(metaRes?.data) ? metaRes.data : [];
    devBoard.value = Array.isArray(boardRes?.data) ? boardRes.data : [];
  } catch (e) {
    devMeta.value = [];
    devBoard.value = [];
  } finally {
    devLoading.value = false;
  }
}
function onFlowChange(v) {
  if (v === 'RD_PROD_INFO') loadDevBoard();
}
function devTone(status) {
  if (status === '开发完毕') return 'done'
  if (status === '开发审核中') return 'review'
  if (status === '开发中') return 'doing'
  return 'none'
}
function canApprovePanel(panelCode) {
  const ap = user.approvePanels || [];
  return !!user.isAdmin || ap.includes('*') || ap.includes(String(panelCode))
}
/** 矩阵单元格是否可点去审批(与 :class/:title/:tabindex 共用一份判定) */
function devClickable(row, m) {
  return row.cells && row.cells[m.panelCode] === '开发审核中' && canApprovePanel(m.panelCode)
}
async function onDevCell(row, m) {
  const st = row.cells ? row.cells[m.panelCode] : '';
  if (st !== '开发审核中') return
  if (!canApprovePanel(m.panelCode)) {
    ElMessage.warning(tt('无该面板审批权限'));
    return
  }
  const target = `/panelx/list/${m.panelCode}`;
  try {
    const res = await request.post('/px/queryFormDataList', {
      panelCode: m.panelCode, condition: {}, pageNo: 1, pageSize: 300,
    });
    const list = res?.data?.list || [];
    // 按「产品编号」找该产品对应的在审单据。规格书 RD_SPEC_DOC 原先把本面板的字段键特判成
    // 「编号」—— 那是它当时唯一的产品键;2026-09-30 该字段已改名「产品编号」(旧键名「编号」
    // 被引擎当单据标识用,值会被单据号覆盖,见 migrate-rd-specdoc-prodno-2026-09-30.sql),
    // 于是这里不必再特判,与其它面板统一。
    const key = '产品编号';
    const hit = list.find((r) => String(r[key] ?? '') === String(row['产品编号'] ?? '')
      && String(r['单据状态'] ?? '').includes('审批'));
    const docNo = hit ? (hit['单据编号'] || hit['编号'] || '') : '';
    router.push(docNo ? { path: target, query: { docNo } } : target);
  } catch (e) {
    router.push(target);
  }
}
let countdownTimer = null;

onMounted(() => {
  // 首次进入桌面:按角色套一次预设(用户已自定义过则不动)—— 2026-09-22 展示优化
  app.applyRoleDeskPreset(user.isAdmin);
  // 老用户增量补新候选(项目申请/产品开发),不动用户自己的勾选
  app.upgradeDeskSettings(user.isAdmin);
  load();
  refreshTimer = setInterval(load, 300000);
  countdownTimer = setInterval(() => {
    if (!loadingStats.value && refreshLeft.value > 0) refreshLeft.value -= 1;
  }, 1000);
  startShiftTimer();
});
onBeforeUnmount(() => {
  clearInterval(refreshTimer);
  clearInterval(countdownTimer);
  clearInterval(shiftTimer);
});

// ---------- 概览数据 ----------
const todos = computed(() => stats.value.todos || []);
const docStats = computed(() => stats.value.docStats || []);
/** 单据流量:有量的排前面(降序),空面板垫底,最多 9 行 —— 30 个面板全摊开只是噪音 */
const docVolume = computed(() => {
  const all = docStats.value.map((d) => ({ ...d, n: Number(d.count || 0) }));
  const hot = all.filter((d) => d.n > 0).sort((a, b) => b.n - a.n);
  const cold = all.filter((d) => d.n === 0);
  return [...hot, ...cold].slice(0, 9)
});
const archives = computed(() => stats.value.archives || {});
const latest = computed(() => stats.value.latest || []);
const progress = computed(() => stats.value.progress || []);

// ---------- 生产数据 ----------
const prod = computed(() => stats.value.production || {});
// 产能对比(2026-10-08 起)自带周期 tab 与取数,见 SCapacityBars.vue / @core/dashboard/capacityBars;
// 此处不再从 /dashboard/stats 取 capacityToday(该键与「单天产能子弹条」一并退场)。

// ---------- 库存数据 ----------
const stock = computed(() => stats.value.stock || {});
const stockCount = computed(() => (stock.value.panels || []).reduce((s, p) => s + (p.count || 0), 0));
const stockPanels = computed(() => (stock.value.panels || []).map((p) => ({ name: p.panelName, value: p.count })));
const stockLines = computed(() => (stock.value.panels || []).map((p) => ({ name: p.panelName, value: p.lines })));

// ---------- 销售数据 ----------
const sales = computed(() => stats.value.sales || {});
const salesDone = computed(() => {
  const s = (sales.value.byStatus || []).find((x) => x.name === '已审核');
  return s ? s.value : 0
});

// ---------- 质量数据 ----------
const quality = computed(() => stats.value.quality || { total: 0, pass: 0, passRate: 0, byResult: [] });

// ---------- 研发数据(2026-09-28 桌面深度开发:阶段分布/趋势来自 DashboardStatsService;面板单据量复用 docStats 过滤) ----------
const rd = computed(() => stats.value.rd || {});
const rdDocStats = computed(() =>
  docStats.value
    .filter((d) => String(d.panelCode || '').startsWith('RD_'))
    .map((d) => ({ name: d.panelName, value: Number(d.count || 0) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
);

// ---------- 实时驾驶舱派生指标 ----------
const productionTotal = computed(() => Number(stats.value.kpis.moTotal || 0));
const productionDone = computed(() => {
  const item = (prod.value.statusDist || []).find((entry) => entry.name === '已完工');
  return Number(item?.value || 0)
});
const productionRunning = computed(() => {
  const item = (prod.value.statusDist || []).find((entry) => entry.name === '生产中');
  return Number(item?.value || 0)
});
const completionRate = computed(() => (
  productionTotal.value ? Math.round((productionDone.value / productionTotal.value) * 100) : 0
));
const gaugeOffset = computed(() => 301.6 * (1 - completionRate.value / 100));
const qualityRate = computed(() => Number(quality.value.passRate || 0));
const qualityGaugeOffset = computed(() => 201.1 * (1 - Math.min(100, qualityRate.value) / 100));
const qualityExceptions = computed(() => Math.max(0, Number(quality.value.total || 0) - Number(quality.value.pass || 0)));
const qualityRisk = computed(() => {
  if (!quality.value.total) return { label: '暂无检验', tone: 'neutral' }
  if (qualityRate.value >= 95) return { label: '质量稳定', tone: 'stable' }
  if (qualityRate.value >= 80) return { label: '需要关注', tone: 'attention' }
  return { label: '质量风险', tone: 'risk' }
});
const qualityResults = computed(() => {
  const tones = { 合格: 'stable', 不合格: 'risk', 让步接收: 'attention', 待检: 'neutral' };
  return (quality.value.byResult || []).map((item) => ({ ...item, tone: tones[item.name] || 'neutral' }))
});
const resourceStats = computed(() => [
  { label: '存货', value: archives.value.invItems ?? 0, icon: 'Grid' },
  { label: '部门', value: archives.value.deptCount ?? 0, icon: 'OfficeBuilding' },
  { label: '仓库', value: archives.value.whCount ?? 0, icon: 'House' },
]);
const lastUpdatedText = computed(() => (
  lastUpdated.value ? lastUpdated.value.toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 8) : '等待同步'
));
const kpis = computed(() => {
  const trend = prod.value.trend7 || [];
  const amount = Number(sales.value.amount || 0);
  return [
    {
      title: tt('生产任务负载'), value: Number(stats.value.kpis.moActive || 0), unit: tt('单'), icon: 'Odometer',
      tone: 'primary', state: tt('实时'), meta: `${tt('总计')} ${productionTotal.value} ${tt('单')}`, signal: `${productionRunning.value} ${tt('单生产中')}`,
      bars: trend.map((item) => Number(item.added || 0)),
    },
    {
      title: tt('工单闭环率'), value: completionRate.value, unit: '%', icon: 'CircleCheck',
      tone: 'steel', state: completionRate.value >= 80 ? tt('稳定') : tt('推进中'),
      meta: `${productionDone.value} / ${productionTotal.value} ${tt('已完工')}`, signal: tt('生命周期'),
      bars: trend.map((item) => Number(item.done || 0)),
    },
    {
      title: tt('检验合格率'), value: quality.value.total ? qualityRate.value : '--', unit: quality.value.total ? '%' : '', icon: 'Aim',
      tone: qualityRate.value < 80 && quality.value.total ? 'danger' : 'warning', state: qualityRisk.value.label,
      meta: `${quality.value.pass || 0} / ${quality.value.total || 0} ${tt('合格')}`, signal: `${qualityExceptions.value} ${tt('项待处理')}`,
      bars: (quality.value.byResult || []).map((item) => Number(item.value || 0)),
    },
    {
      title: tt('销售订单金额'), value: formatCompact(amount), unit: tt('元'), icon: 'TrendCharts',
      tone: 'neutral', state: `${sales.value.total || 0} ${tt('张订单')}`, meta: `${salesDone.value} ${tt('张已审核')}`, signal: tt('业务流入'),
      bars: (sales.value.byCustomer || []).map((item) => Number(item.value || 0)),
    },
  ]
});

// ---------- 工具 ----------
function statusTone(status) {
  return {
    已完工: 'stable', 已审核: 'stable', 已完成: 'stable', 启用: 'stable', 生产中: 'running',
    审批中: 'attention', 待审批: 'attention', 草稿: 'neutral', 不合格: 'risk',
    已中止: 'risk', 已关闭: 'risk',
  }[status] || 'neutral'
}
function orderStage(status) {
  return { 草稿: 1, 已审核: 2, 已完成: 4, 生产中: 3, 已完工: 4, 已关闭: 4 }[status] || 1
}
function eventIcon(panel) {
  const name = String(panel || '');
  if (name.includes('生产') || name.includes('加工')) return 'SetUp'
  if (name.includes('销售') || name.includes('订单')) return 'ShoppingCart'
  if (name.includes('检验') || name.includes('质量')) return 'Aim'
  if (name.includes('入库') || name.includes('出库')) return 'Box'
  return 'Document'
}
function panelTitle(panel) {
  return {
    PURCHASE_IN: '采购入库单', QUOTE_ORDER: '报价单', CUSTOMER_TRACE_SETTINGS: '客户追溯设置',
    TRACE_PRINT_TEMPLATE: '追溯打印模板', COMPANY_TRACE_SETTINGS: '企业追溯设置', QC_ITEM: '质检项目',
    MANU_ORDER: '生产工单', SO_ORDER: '销售订单', PROCESS_REPORT: '工序汇报单',
    FINISH_IN: '产成品入库单', SALE_OUT: '销售出库单', DEPT: '部门档案',
  }[panel] || panel || '业务单据'
}
function compactTime(value) {
  const text = String(value || '');
  return text.length >= 16 ? text.slice(5, 16).replace('T', ' ') : text || '--'
}
function formatCompact(value) {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)
}
function barHeight(values, value) {
  const max = Math.max(...(values || []).map(Number), 1);
  return Math.max(16, Math.round((Number(value || 0) / max) * 100))
}
function docPercent(value) {
  const max = Math.max(...docStats.value.map((item) => Number(item.count || 0)), 1);
  return value ? Math.max(8, Math.round((Number(value) / max) * 100)) : 0
}
function go(path, title) {
  router.push(path);
  tabs.open({ path, title });
}

return (_ctx, _cache) => {
  const _component_el_button = ElButton;
  const _component_el_icon = ElIcon;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_Refresh = resolveComponent("Refresh");
  const _component_el_tooltip = ElTooltip;
  const _component_el_dialog = ElDialog;
  const _directive_loading = vLoading;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    createBaseVNode("div", _hoisted_2, [
      createBaseVNode("div", _hoisted_3, [
        createBaseVNode("div", _hoisted_4, toDisplayString(unref(tt)(greeting.value)) + "，" + toDisplayString(unref(user).realName) + "！", 1),
        createBaseVNode("div", _hoisted_5, [
          createBaseVNode("span", {
            class: normalizeClass(["shift-badge", shift.value.key])
          }, [
            createBaseVNode("span", _hoisted_6, toDisplayString(shift.value.icon), 1),
            createTextVNode(toDisplayString(unref(tt)(shift.value.name)), 1),
            createBaseVNode("em", null, toDisplayString(shift.value.range), 1)
          ], 2),
          _cache[6] || (_cache[6] = createBaseVNode("span", { class: "meta-sep" }, "|", -1)),
          createTextVNode(" " + toDisplayString(unref(user).factoryName) + " · " + toDisplayString(today.value) + " " + toDisplayString(nowTime.value), 1)
        ])
      ]),
      (quickEntries.value.length)
        ? (openBlock(), createElementBlock("div", _hoisted_7, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(quickEntries.value, (q) => {
              return (openBlock(), createBlock(_component_el_button, {
                key: q.key,
                type: q.primary ? 'primary' : 'default',
                title: q.hint ? unref(tt)(q.hint) : '',
                onClick: $event => (go(q.path, q.title))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)(q.title)), 1)
                ]),
                _: 2
              }, 1032, ["type", "title", "onClick"]))
            }), 128))
          ]))
        : createCommentVNode("", true)
    ]),
    createBaseVNode("div", _hoisted_8, [
      (openBlock(), createElementBlock(Fragment, null, renderList(MODULES, (m) => {
        return createBaseVNode("button", {
          key: m.key,
          type: "button",
          class: normalizeClass(["mod-tab", { on: mod.value === m.key }]),
          "aria-pressed": mod.value === m.key,
          onClick: $event => (mod.value = m.key)
        }, [
          createVNode(_component_el_icon, null, {
            default: withCtx(() => [
              (openBlock(), createBlock(resolveDynamicComponent(m.icon)))
            ]),
            _: 2
          }, 1024),
          createTextVNode(toDisplayString(unref(tt)(m.title)), 1)
        ], 10, _hoisted_9)
      }), 64))
    ]),
    (mod.value === 'overview')
      ? (openBlock(), createElementBlock("div", _hoisted_10, [
          (desk.value.showKpi)
            ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(kpis.value, (metric, index) => {
                return (openBlock(), createElementBlock("article", {
                  key: metric.title,
                  class: normalizeClass(["card live-metric col-3 reveal-item", `metric-${metric.tone}`]),
                  style: normalizeStyle({ '--reveal-delay': `${index * 55}ms` })
                }, [
                  createBaseVNode("div", _hoisted_11, [
                    createBaseVNode("span", _hoisted_12, toDisplayString(unref(tt)(metric.title)), 1),
                    createBaseVNode("span", _hoisted_13, toDisplayString(unref(tt)(metric.state)), 1)
                  ]),
                  createBaseVNode("div", _hoisted_14, [
                    createBaseVNode("div", _hoisted_15, [
                      createVNode(_component_el_icon, null, {
                        default: withCtx(() => [
                          (openBlock(), createBlock(resolveDynamicComponent(metric.icon)))
                        ]),
                        _: 2
                      }, 1024)
                    ]),
                    createBaseVNode("div", _hoisted_16, [
                      createBaseVNode("strong", null, toDisplayString(metric.value), 1),
                      createBaseVNode("span", null, toDisplayString(metric.unit), 1)
                    ]),
                    createBaseVNode("div", _hoisted_17, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(metric.bars, (value, barIndex) => {
                        return (openBlock(), createElementBlock("i", {
                          key: barIndex,
                          style: normalizeStyle({ height: `${barHeight(metric.bars, value)}%` })
                        }, null, 4))
                      }), 128))
                    ])
                  ]),
                  createBaseVNode("div", _hoisted_18, [
                    createBaseVNode("span", null, toDisplayString(unref(tt)(metric.meta)), 1),
                    createBaseVNode("span", _hoisted_19, [
                      _cache[7] || (_cache[7] = createBaseVNode("i", null, null, -1)),
                      createTextVNode(toDisplayString(unref(tt)(metric.signal)), 1)
                    ])
                  ])
                ], 6))
              }), 128))
            : createCommentVNode("", true),
          (desk.value.showProgress)
            ? (openBlock(), createElementBlock("section", _hoisted_20, [
                createBaseVNode("div", _hoisted_21, [
                  createBaseVNode("div", null, [
                    createBaseVNode("div", _hoisted_22, toDisplayString(unref(tt)('生产执行核心')), 1),
                    createBaseVNode("p", null, toDisplayString(unref(tt)('工单生命周期与近 7 天执行脉冲')), 1)
                  ]),
                  createBaseVNode("div", _hoisted_23, [
                    _cache[8] || (_cache[8] = createBaseVNode("i", null, null, -1)),
                    createTextVNode("LIVE · " + toDisplayString(lastUpdatedText.value), 1)
                  ])
                ]),
                createBaseVNode("div", _hoisted_24, [
                  createBaseVNode("div", _hoisted_25, [
                    createBaseVNode("div", _hoisted_26, [
                      (openBlock(), createElementBlock("svg", _hoisted_27, [
                        _cache[9] || (_cache[9] = createBaseVNode("circle", {
                          class: "gauge-track",
                          cx: "60",
                          cy: "60",
                          r: "48"
                        }, null, -1)),
                        createBaseVNode("circle", {
                          class: "gauge-value",
                          cx: "60",
                          cy: "60",
                          r: "48",
                          style: normalizeStyle({ strokeDashoffset: gaugeOffset.value })
                        }, null, 4)
                      ])),
                      createBaseVNode("div", _hoisted_28, [
                        createBaseVNode("strong", null, toDisplayString(completionRate.value) + "%", 1),
                        createBaseVNode("span", null, toDisplayString(unref(tt)('工单闭环率')), 1)
                      ])
                    ]),
                    createBaseVNode("div", _hoisted_29, [
                      createBaseVNode("span", null, [
                        createBaseVNode("b", null, toDisplayString(productionTotal.value), 1),
                        createTextVNode(toDisplayString(unref(tt)('总工单')), 1)
                      ]),
                      createBaseVNode("span", null, [
                        createBaseVNode("b", null, toDisplayString(productionRunning.value), 1),
                        createTextVNode(toDisplayString(unref(tt)('执行中')), 1)
                      ]),
                      createBaseVNode("span", null, [
                        createBaseVNode("b", null, toDisplayString(productionDone.value), 1),
                        createTextVNode(toDisplayString(unref(tt)('已完工')), 1)
                      ])
                    ])
                  ]),
                  createBaseVNode("div", _hoisted_30, [
                    createBaseVNode("div", _hoisted_31, [
                      createBaseVNode("span", null, toDisplayString(unref(tt)('新增 / 完工趋势')), 1),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('近 7 天')), 1)
                    ]),
                    ((prod.value.trend7 || []).length)
                      ? (openBlock(), createBlock(SLine, {
                          key: 0,
                          data: prod.value.trend7,
                          compact: ""
                        }, null, 8, ["data"]))
                      : (openBlock(), createElementBlock("div", _hoisted_32, toDisplayString(unref(tt)('暂无趋势数据')), 1)),
                    createBaseVNode("div", _hoisted_33, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(progress.value.slice(0, 3), (order) => {
                        return (openBlock(), createElementBlock("div", {
                          key: order['编号'],
                          class: "order-row"
                        }, [
                          createBaseVNode("div", {
                            class: "order-copy",
                            title: `${order['产品'] || unref(tt)('未指定产品')} ${order['编号'] || ''}`
                          }, [
                            createBaseVNode("strong", null, toDisplayString(order['产品'] || unref(tt)('未指定产品')), 1),
                            createBaseVNode("span", null, toDisplayString(order['编号']), 1)
                          ], 8, _hoisted_34),
                          createBaseVNode("div", {
                            class: "stage-track",
                            "aria-label": unref(tt)('当前状态：') + (order['状态'] || '')
                          }, [
                            (openBlock(), createElementBlock(Fragment, null, renderList(4, (stageIndex) => {
                              return createBaseVNode("i", {
                                key: stageIndex,
                                class: normalizeClass({ active: stageIndex <= orderStage(order['状态']) })
                              }, null, 2)
                            }), 64))
                          ], 8, _hoisted_35),
                          createBaseVNode("span", {
                            class: normalizeClass(["order-status", statusTone(order['状态'])])
                          }, toDisplayString(unref(tt)(order['状态'])), 3)
                        ]))
                      }), 128)),
                      (!progress.value.length)
                        ? (openBlock(), createElementBlock("div", _hoisted_36, [
                            createBaseVNode("span", null, toDisplayString(unref(tt)('暂无工单执行数据')), 1),
                            createBaseVNode("em", null, toDisplayString(unref(tt)('可在「新建加工单」里建第一张单')), 1)
                          ]))
                        : createCommentVNode("", true)
                    ])
                  ])
                ])
              ]))
            : createCommentVNode("", true),
          (desk.value.showTodo)
            ? (openBlock(), createElementBlock("section", _hoisted_37, [
                createBaseVNode("div", _hoisted_38, [
                  createBaseVNode("div", null, [
                    createBaseVNode("div", _hoisted_39, toDisplayString(unref(tt)('质量与待办监测')), 1),
                    createBaseVNode("p", null, toDisplayString(unref(tt)('检验结果和流程阻塞')), 1)
                  ]),
                  createBaseVNode("span", {
                    class: normalizeClass(["risk-level", qualityRisk.value.tone])
                  }, toDisplayString(unref(tt)(qualityRisk.value.label)), 3)
                ]),
                createBaseVNode("div", _hoisted_40, [
                  createBaseVNode("div", _hoisted_41, [
                    (openBlock(), createElementBlock("svg", _hoisted_42, [
                      _cache[10] || (_cache[10] = createBaseVNode("circle", {
                        class: "quality-track",
                        cx: "40",
                        cy: "40",
                        r: "32"
                      }, null, -1)),
                      createBaseVNode("circle", {
                        class: normalizeClass(["quality-value", qualityRisk.value.tone]),
                        cx: "40",
                        cy: "40",
                        r: "32",
                        style: normalizeStyle({ strokeDashoffset: qualityGaugeOffset.value })
                      }, null, 6)
                    ])),
                    createBaseVNode("div", null, [
                      createBaseVNode("strong", null, toDisplayString(quality.value.total ? `${qualityRate.value}%` : '--'), 1),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('检验合格率')), 1)
                    ])
                  ]),
                  createBaseVNode("div", _hoisted_43, [
                    createBaseVNode("div", null, [
                      createBaseVNode("span", null, toDisplayString(unref(tt)('检验明细')), 1),
                      createBaseVNode("strong", null, toDisplayString(quality.value.total || 0), 1)
                    ]),
                    createBaseVNode("div", null, [
                      createBaseVNode("span", null, toDisplayString(unref(tt)('非合格 / 待判')), 1),
                      createBaseVNode("strong", _hoisted_44, toDisplayString(qualityExceptions.value), 1)
                    ]),
                    createBaseVNode("div", null, [
                      createBaseVNode("span", null, toDisplayString(unref(tt)('流程待办')), 1),
                      createBaseVNode("strong", null, toDisplayString(todos.value.length), 1)
                    ])
                  ])
                ]),
                createBaseVNode("div", _hoisted_45, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(qualityResults.value, (result) => {
                    return (openBlock(), createElementBlock("div", {
                      key: result.name
                    }, [
                      createBaseVNode("span", null, [
                        createBaseVNode("i", {
                          class: normalizeClass(result.tone)
                        }, null, 2),
                        createTextVNode(toDisplayString(result.name), 1)
                      ]),
                      createBaseVNode("strong", null, toDisplayString(result.value), 1)
                    ]))
                  }), 128))
                ]),
                createBaseVNode("div", {
                  class: normalizeClass(["watch-message", { clear: !todos.value.length }])
                }, [
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      (openBlock(), createBlock(resolveDynamicComponent(todos.value.length ? 'Warning' : 'CircleCheck')))
                    ]),
                    _: 1
                  }),
                  createBaseVNode("span", null, toDisplayString(todos.value.length ? `${todos.value.length} ${unref(tt)('项流程等待处理')}` : unref(tt)('当前没有审批流程阻塞')), 1)
                ], 2)
              ]))
            : createCommentVNode("", true),
          createBaseVNode("section", _hoisted_46, [
            createBaseVNode("div", _hoisted_47, [
              createBaseVNode("div", null, [
                createBaseVNode("div", _hoisted_48, toDisplayString(unref(tt)('实时业务事件流')), 1),
                createBaseVNode("p", null, toDisplayString(unref(tt)('来自 SQL 业务单据的最新活动')), 1)
              ]),
              createVNode(_component_el_select, {
                modelValue: flowPanel.value,
                "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((flowPanel).value = $event)),
                size: "small",
                class: "flow-pick",
                onChange: onFlowChange
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_option, {
                    label: unref(tt)('全部事件'),
                    value: ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_option, {
                    label: unref(tt)('产品开发业务流'),
                    value: "RD_PROD_INFO"
                  }, null, 8, ["label"])
                ]),
                _: 1
              }, 8, ["modelValue"]),
              (flowPanel.value !== 'RD_PROD_INFO')
                ? (openBlock(), createElementBlock("span", _hoisted_49, toDisplayString(latest.value.length) + " " + toDisplayString(unref(tt)('条事件')), 1))
                : (openBlock(), createElementBlock("span", _hoisted_50, toDisplayString(devBoard.value.length) + " " + toDisplayString(unref(tt)('已下发产品')), 1))
            ]),
            (flowPanel.value === 'RD_PROD_INFO')
              ? withDirectives((openBlock(), createElementBlock("div", _hoisted_51, [
                  (devBoard.value.length)
                    ? (openBlock(), createElementBlock("table", _hoisted_52, [
                        createBaseVNode("thead", null, [
                          createBaseVNode("tr", null, [
                            createBaseVNode("th", _hoisted_53, toDisplayString(unref(tt)('产品编号')), 1),
                            createBaseVNode("th", null, toDisplayString(unref(tt)('产品名称')), 1),
                            (openBlock(true), createElementBlock(Fragment, null, renderList(devMeta.value, (m) => {
                              return (openBlock(), createElementBlock("th", {
                                key: m.panelCode
                              }, toDisplayString(unref(tt)(m.panelName)), 1))
                            }), 128)),
                            createBaseVNode("th", null, toDisplayString(unref(tt)('总进度')), 1)
                          ])
                        ]),
                        createBaseVNode("tbody", null, [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(devBoard.value, (row) => {
                            return (openBlock(), createElementBlock("tr", {
                              key: row['产品编号']
                            }, [
                              createBaseVNode("td", _hoisted_54, toDisplayString(row['产品编号']), 1),
                              createBaseVNode("td", null, toDisplayString(row['产品名称']), 1),
                              (openBlock(true), createElementBlock(Fragment, null, renderList(devMeta.value, (m) => {
                                return (openBlock(), createElementBlock("td", {
                                  key: m.panelCode
                                }, [
                                  createBaseVNode("span", {
                                    class: normalizeClass(["dev-cell", [devTone(row.cells[m.panelCode]), { clickable: devClickable(row, m) }]]),
                                    role: devClickable(row, m) ? 'button' : null,
                                    tabindex: devClickable(row, m) ? 0 : -1,
                                    title: row.cells[m.panelCode] === '开发审核中' ? (canApprovePanel(m.panelCode) ? unref(tt)('点击去审批') : unref(tt)('无该面板审批权限')) : '',
                                    onClick: $event => (onDevCell(row, m)),
                                    onKeydown: withKeys($event => (onDevCell(row, m)), ["enter"])
                                  }, toDisplayString(unref(tt)(row.cells[m.panelCode])), 43, _hoisted_55)
                                ]))
                              }), 128)),
                              createBaseVNode("td", null, toDisplayString(row.doneCount) + "/" + toDisplayString(row.totalCount), 1)
                            ]))
                          }), 128))
                        ])
                      ]))
                    : (openBlock(), createElementBlock("div", _hoisted_56, toDisplayString(unref(tt)('暂无已下发产品')), 1))
                ])), [
                  [_directive_loading, devLoading.value]
                ])
              : (openBlock(), createElementBlock("div", _hoisted_57, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(latest.value.slice(0, 6), (event, index) => {
                    return (openBlock(), createElementBlock("div", {
                      key: `${event['编号']}-${index}`,
                      class: "event-row"
                    }, [
                      createBaseVNode("div", _hoisted_58, [
                        createBaseVNode("i", {
                          class: normalizeClass({ pulse: index === 0 })
                        }, null, 2)
                      ]),
                      createBaseVNode("div", _hoisted_59, [
                        createVNode(_component_el_icon, null, {
                          default: withCtx(() => [
                            (openBlock(), createBlock(resolveDynamicComponent(eventIcon(event.panel))))
                          ]),
                          _: 2
                        }, 1024)
                      ]),
                      createBaseVNode("div", {
                        class: "event-copy",
                        title: `${unref(tt)(panelTitle(event.panel))} ${event['编号'] || ''}`
                      }, [
                        createBaseVNode("strong", null, toDisplayString(unref(tt)(panelTitle(event.panel))), 1),
                        createBaseVNode("span", null, toDisplayString(event['编号']), 1)
                      ], 8, _hoisted_60),
                      createBaseVNode("span", {
                        class: normalizeClass(["event-status", statusTone(event['状态'])])
                      }, toDisplayString(unref(tt)(event['状态'])), 3),
                      createBaseVNode("time", null, toDisplayString(compactTime(event['时间'])), 1)
                    ]))
                  }), 128)),
                  (!latest.value.length)
                    ? (openBlock(), createElementBlock("div", _hoisted_61, toDisplayString(unref(tt)('暂无业务事件')), 1))
                    : createCommentVNode("", true)
                ]))
          ]),
          createBaseVNode("section", _hoisted_62, [
            createBaseVNode("div", _hoisted_63, [
              createBaseVNode("div", null, [
                createBaseVNode("div", _hoisted_64, toDisplayString(unref(tt)('业务数据内核')), 1),
                createBaseVNode("p", null, toDisplayString(unref(tt)('单据流量与基础资源覆盖')), 1)
              ]),
              createVNode(_component_el_tooltip, {
                content: unref(tt)('数据每 5 分钟自动同步'),
                placement: "top"
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_button, {
                    class: "sync-button",
                    text: "",
                    circle: "",
                    loading: loadingStats.value,
                    onClick: load
                  }, {
                    default: withCtx(() => [
                      createVNode(_component_el_icon, null, {
                        default: withCtx(() => [
                          createVNode(_component_Refresh)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, ["loading"])
                ]),
                _: 1
              }, 8, ["content"])
            ]),
            createBaseVNode("div", _hoisted_65, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(docVolume.value, (doc) => {
                return (openBlock(), createElementBlock("div", {
                  key: doc.panelCode,
                  class: "doc-row"
                }, [
                  createBaseVNode("span", {
                    title: unref(tt)(doc.panelName)
                  }, toDisplayString(unref(tt)(doc.panelName)), 9, _hoisted_66),
                  createBaseVNode("div", null, [
                    createBaseVNode("i", {
                      style: normalizeStyle({ width: `${docPercent(doc.count)}%` })
                    }, null, 4)
                  ]),
                  createBaseVNode("strong", null, toDisplayString(doc.count), 1)
                ]))
              }), 128))
            ]),
            createBaseVNode("div", _hoisted_67, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(resourceStats.value, (resource) => {
                return (openBlock(), createElementBlock("div", {
                  key: resource.label
                }, [
                  createVNode(_component_el_icon, null, {
                    default: withCtx(() => [
                      (openBlock(), createBlock(resolveDynamicComponent(resource.icon)))
                    ]),
                    _: 2
                  }, 1024),
                  createBaseVNode("strong", null, toDisplayString(resource.value), 1),
                  createBaseVNode("span", null, toDisplayString(unref(tt)(resource.label)), 1)
                ]))
              }), 128))
            ]),
            createBaseVNode("div", _hoisted_68, [
              createBaseVNode("span", null, [
                createBaseVNode("i", {
                  class: normalizeClass({ error: loadError.value })
                }, null, 2),
                createTextVNode(toDisplayString(loadError.value ? unref(tt)('数据同步异常') : unref(tt)('SQL 数据链路在线')), 1)
              ]),
              createBaseVNode("span", null, toDisplayString(loadingStats.value ? unref(tt)('同步中') : `${refreshLeft.value}s ${unref(tt)('后刷新')}`), 1)
            ])
          ])
        ]))
      : (mod.value === 'prod')
        ? (openBlock(), createElementBlock("div", _hoisted_69, [
            createBaseVNode("div", _hoisted_70, [
              createBaseVNode("div", _hoisted_71, toDisplayString(unref(tt)('工单状态分布')), 1),
              createBaseVNode("div", _hoisted_72, [
                createVNode(SBars, {
                  data: prod.value.statusDist,
                  "show-pct": ""
                }, null, 8, ["data"])
              ])
            ]),
            createBaseVNode("div", _hoisted_73, [
              createBaseVNode("div", _hoisted_74, toDisplayString(unref(tt)('车间生产分布')), 1),
              createBaseVNode("div", _hoisted_75, [
                createVNode(SDonut, {
                  data: prod.value.workshopDist,
                  sub: unref(tt)('加工单')
                }, null, 8, ["data", "sub"])
              ])
            ]),
            createBaseVNode("div", _hoisted_76, [
              createBaseVNode("div", _hoisted_77, toDisplayString(unref(tt)('近 7 天新增 / 完工')), 1),
              createBaseVNode("div", _hoisted_78, [
                createVNode(SLine, {
                  data: prod.value.trend7
                }, null, 8, ["data"])
              ])
            ]),
            createBaseVNode("div", _hoisted_79, [
              createBaseVNode("div", _hoisted_80, [
                createTextVNode(toDisplayString(unref(tt)('五工序报工完成率')), 1),
                createBaseVNode("span", _hoisted_81, toDisplayString(unref(tt)('按报工记录统计（%）')), 1)
              ]),
              createBaseVNode("div", _hoisted_82, [
                createVNode(SBars, {
                  data: prod.value.stageRates,
                  colors: ['#116a5b', '#3b8978', '#d79a2b', '#b94d3f', '#537786']
                }, null, 8, ["data"])
              ])
            ]),
            createBaseVNode("div", _hoisted_83, [
              createBaseVNode("div", _hoisted_84, toDisplayString(unref(tt)('产能对比')), 1),
              createBaseVNode("div", _hoisted_85, [
                createVNode(SCapacityBars)
              ])
            ])
          ]))
        : (mod.value === 'stock')
          ? (openBlock(), createElementBlock("div", _hoisted_86, [
              createBaseVNode("div", _hoisted_87, [
                createBaseVNode("div", _hoisted_88, toDisplayString(stock.value.totalIn), 1),
                createBaseVNode("div", _hoisted_89, toDisplayString(unref(tt)('入库单量')), 1)
              ]),
              createBaseVNode("div", _hoisted_90, [
                createBaseVNode("div", _hoisted_91, toDisplayString(stock.value.totalOut), 1),
                createBaseVNode("div", _hoisted_92, toDisplayString(unref(tt)('出库单量')), 1)
              ]),
              createBaseVNode("div", _hoisted_93, [
                createBaseVNode("div", _hoisted_94, toDisplayString(stockCount.value), 1),
                createBaseVNode("div", _hoisted_95, toDisplayString(unref(tt)('出入库单据总数')), 1)
              ]),
              createBaseVNode("div", _hoisted_96, [
                createBaseVNode("div", _hoisted_97, toDisplayString(stock.value.totalLines), 1),
                createBaseVNode("div", _hoisted_98, toDisplayString(unref(tt)('明细行数合计')), 1)
              ]),
              createBaseVNode("div", _hoisted_99, [
                createBaseVNode("div", _hoisted_100, toDisplayString(unref(tt)('各单据数量')), 1),
                createBaseVNode("div", _hoisted_101, [
                  createVNode(SBars, { data: stockPanels.value }, null, 8, ["data"])
                ])
              ]),
              createBaseVNode("div", _hoisted_102, [
                createBaseVNode("div", _hoisted_103, toDisplayString(unref(tt)('各单据明细行数')), 1),
                createBaseVNode("div", _hoisted_104, [
                  createVNode(SBars, {
                    data: stockLines.value,
                    colors: ['#537786', '#116a5b', '#d79a2b', '#7a8b84', '#3b8978', '#9c7650']
                  }, null, 8, ["data"])
                ])
              ]),
              createBaseVNode("div", _hoisted_105, [
                createBaseVNode("div", _hoisted_106, toDisplayString(unref(tt)('近 7 天出入库趋势')), 1),
                createBaseVNode("div", _hoisted_107, [
                  createVNode(SLine, {
                    data: stock.value.trend7,
                    "legend-a": unref(tt)('入库'),
                    "legend-b": unref(tt)('出库')
                  }, null, 8, ["data", "legend-a", "legend-b"])
                ])
              ]),
              createBaseVNode("div", _hoisted_108, [
                createBaseVNode("div", _hoisted_109, toDisplayString(unref(tt)('现存量 TOP 物料')), 1),
                createBaseVNode("div", _hoisted_110, [
                  createVNode(SBars, {
                    data: stock.value.topItems,
                    colors: ['#537786', '#116a5b', '#3b8978', '#d79a2b', '#8a9a92', '#9c7650', '#708575', '#b94d3f']
                  }, null, 8, ["data"])
                ])
              ])
            ]))
          : (mod.value === 'sales')
            ? (openBlock(), createElementBlock("div", _hoisted_111, [
                createBaseVNode("div", _hoisted_112, [
                  createBaseVNode("div", _hoisted_113, toDisplayString(sales.value.total), 1),
                  createBaseVNode("div", _hoisted_114, toDisplayString(unref(tt)('销售订单数')), 1)
                ]),
                createBaseVNode("div", _hoisted_115, [
                  createBaseVNode("div", _hoisted_116, toDisplayString(sales.value.amount ?? 0), 1),
                  createBaseVNode("div", _hoisted_117, toDisplayString(unref(tt)('明细金额合计（元）')), 1)
                ]),
                createBaseVNode("div", _hoisted_118, [
                  createBaseVNode("div", _hoisted_119, toDisplayString(salesDone.value), 1),
                  createBaseVNode("div", _hoisted_120, toDisplayString(unref(tt)('已审核订单')), 1)
                ]),
                createBaseVNode("div", _hoisted_121, [
                  createBaseVNode("div", _hoisted_122, toDisplayString(unref(tt)('客户订单分布')), 1),
                  createBaseVNode("div", _hoisted_123, [
                    createVNode(SDonut, {
                      data: sales.value.byCustomer,
                      sub: unref(tt)('订单')
                    }, null, 8, ["data", "sub"])
                  ])
                ]),
                createBaseVNode("div", _hoisted_124, [
                  createBaseVNode("div", _hoisted_125, toDisplayString(unref(tt)('订单状态分布')), 1),
                  createBaseVNode("div", _hoisted_126, [
                    createVNode(SBars, {
                      data: sales.value.byStatus,
                      "show-pct": ""
                    }, null, 8, ["data"])
                  ])
                ]),
                createBaseVNode("div", _hoisted_127, [
                  createBaseVNode("div", _hoisted_128, toDisplayString(unref(tt)('近 7 天订单趋势')), 1),
                  createBaseVNode("div", _hoisted_129, [
                    createVNode(SLine, {
                      data: sales.value.trend7,
                      "legend-a": unref(tt)('新增'),
                      "legend-b": unref(tt)('已审核')
                    }, null, 8, ["data", "legend-a", "legend-b"])
                  ])
                ]),
                createBaseVNode("div", _hoisted_130, [
                  createBaseVNode("div", _hoisted_131, toDisplayString(unref(tt)('TOP 产品下单量')), 1),
                  createBaseVNode("div", _hoisted_132, [
                    createVNode(SBars, {
                      data: sales.value.topProducts,
                      colors: ['#116a5b', '#3b8978', '#537786', '#d79a2b', '#8a9a92', '#9c7650', '#708575', '#b94d3f']
                    }, null, 8, ["data"])
                  ])
                ])
              ]))
            : (mod.value === 'rd')
              ? (openBlock(), createElementBlock(Fragment, { key: 4 }, [
                  createBaseVNode("div", _hoisted_133, [
                    createBaseVNode("section", _hoisted_134, [
                      createBaseVNode("div", _hoisted_135, [
                        createBaseVNode("h3", null, toDisplayString(unref(tt)('修改申请动态')), 1),
                        createBaseVNode("span", _hoisted_136, toDisplayString(unref(tt)('待管理员审批的文件')), 1)
                      ]),
                      (!rdData.value.modifyRequests.length)
                        ? (openBlock(), createElementBlock("div", _hoisted_137, toDisplayString(unref(tt)('暂无修改申请')), 1))
                        : (openBlock(), createElementBlock("div", _hoisted_138, [
                            (openBlock(true), createElementBlock(Fragment, null, renderList(rdData.value.modifyRequests, (m) => {
                              return (openBlock(), createElementBlock("button", {
                                key: m.panelCode + ':' + m.docNo,
                                type: "button",
                                class: "rd-item",
                                onClick: $event => (goPanel(m.panelCode, m.docNo))
                              }, [
                                createBaseVNode("span", _hoisted_140, toDisplayString(unref(tt)('修改申请')), 1),
                                createBaseVNode("span", {
                                  class: "rd-txt",
                                  title: `${unref(tt)(m.panelName)} ${m.docNo}`
                                }, toDisplayString(unref(tt)(m.panelName)) + " " + toDisplayString(m.docNo), 9, _hoisted_141),
                                createBaseVNode("span", _hoisted_142, toDisplayString(m.by || '-') + " · " + toDisplayString(fmtRdTime(m.at)), 1)
                              ], 8, _hoisted_139))
                            }), 128))
                          ]))
                    ]),
                    createBaseVNode("section", _hoisted_143, [
                      createBaseVNode("div", _hoisted_144, [
                        createBaseVNode("h3", null, toDisplayString(unref(tt)('最新单据')), 1),
                        createBaseVNode("span", _hoisted_145, toDisplayString(unref(tt)('各面板最近新增')), 1)
                      ]),
                      (!rdData.value.newDocs.length)
                        ? (openBlock(), createElementBlock("div", _hoisted_146, toDisplayString(unref(tt)('暂无单据')), 1))
                        : (openBlock(), createElementBlock("div", _hoisted_147, [
                            (openBlock(true), createElementBlock(Fragment, null, renderList(rdData.value.newDocs, (d, i) => {
                              return (openBlock(), createElementBlock("button", {
                                key: i,
                                type: "button",
                                class: "rd-item",
                                onClick: $event => (goPanel(d.panelCode, d.docNo))
                              }, [
                                createBaseVNode("span", _hoisted_149, toDisplayString(unref(tt)('新增')), 1),
                                createBaseVNode("span", {
                                  class: "rd-txt",
                                  title: `${unref(tt)(d.panelName)} ${d.docNo}`
                                }, toDisplayString(unref(tt)(d.panelName)) + " " + toDisplayString(d.docNo), 9, _hoisted_150),
                                createBaseVNode("span", _hoisted_151, toDisplayString(d.creator || '-') + " · " + toDisplayString(fmtRdTime(d.at)), 1)
                              ], 8, _hoisted_148))
                            }), 128))
                          ]))
                    ]),
                    createBaseVNode("section", _hoisted_152, [
                      createBaseVNode("div", _hoisted_153, [
                        createBaseVNode("h3", null, toDisplayString(unref(tt)('面板档案本')), 1),
                        createBaseVNode("span", _hoisted_154, toDisplayString(unref(tt)('像翻档案一样查阅各面板文件')), 1)
                      ]),
                      createBaseVNode("div", _hoisted_155, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(rdData.value.panels, (p) => {
                          return (openBlock(), createElementBlock("button", {
                            key: p.code,
                            type: "button",
                            class: "rd-chip",
                            onClick: $event => (openArchive(p.code))
                          }, toDisplayString(unref(tt)(p.name)), 9, _hoisted_156))
                        }), 128))
                      ]),
                      (!rdData.value.panels.length)
                        ? (openBlock(), createElementBlock("div", _hoisted_157, toDisplayString(unref(tt)('暂无面板')), 1))
                        : createCommentVNode("", true)
                    ])
                  ]),
                  createBaseVNode("div", _hoisted_158, [
                    createBaseVNode("div", _hoisted_159, [
                      createBaseVNode("div", _hoisted_160, toDisplayString(unref(tt)('研发面板单据量')), 1),
                      createBaseVNode("div", _hoisted_161, [
                        createVNode(SBars, { data: rdDocStats.value }, null, 8, ["data"])
                      ])
                    ]),
                    createBaseVNode("div", _hoisted_162, [
                      createBaseVNode("div", _hoisted_163, [
                        createTextVNode(toDisplayString(unref(tt)('项目阶段进度分布')), 1),
                        createBaseVNode("span", _hoisted_164, toDisplayString(unref(tt)('实施计划口径')), 1)
                      ]),
                      createBaseVNode("div", _hoisted_165, [
                        createVNode(SBars, {
                          data: rd.value.stageDist,
                          "show-pct": "",
                          colors: ['#8a9a92', '#116a5b', '#b94d3f', '#3b8978']
                        }, null, 8, ["data"])
                      ])
                    ]),
                    createBaseVNode("div", _hoisted_166, [
                      createBaseVNode("div", _hoisted_167, [
                        createTextVNode(toDisplayString(unref(tt)('实施计划新增趋势')), 1),
                        createBaseVNode("span", _hoisted_168, toDisplayString(unref(tt)('近 30 天')), 1)
                      ]),
                      createBaseVNode("div", _hoisted_169, [
                        createVNode(SLine, {
                          data: rd.value.trend30,
                          "legend-a": unref(tt)('新增'),
                          "legend-b": unref(tt)('累计内')
                        }, null, 8, ["data", "legend-a", "legend-b"])
                      ])
                    ])
                  ])
                ], 64))
              : (openBlock(), createElementBlock("div", _hoisted_170, [
                  createBaseVNode("div", _hoisted_171, [
                    createBaseVNode("div", _hoisted_172, toDisplayString(quality.value.total), 1),
                    createBaseVNode("div", _hoisted_173, toDisplayString(unref(tt)('检验明细总数')), 1)
                  ]),
                  createBaseVNode("div", _hoisted_174, [
                    createBaseVNode("div", _hoisted_175, toDisplayString(quality.value.pass), 1),
                    createBaseVNode("div", _hoisted_176, toDisplayString(unref(tt)('合格数')), 1)
                  ]),
                  createBaseVNode("div", _hoisted_177, [
                    createBaseVNode("div", _hoisted_178, toDisplayString(quality.value.total - quality.value.pass), 1),
                    createBaseVNode("div", _hoisted_179, toDisplayString(unref(tt)('非合格数')), 1)
                  ]),
                  createBaseVNode("div", _hoisted_180, [
                    createBaseVNode("div", _hoisted_181, toDisplayString(quality.value.passRate) + "%", 1),
                    createBaseVNode("div", _hoisted_182, toDisplayString(unref(tt)('合格率')), 1)
                  ]),
                  createBaseVNode("div", _hoisted_183, [
                    createBaseVNode("div", _hoisted_184, toDisplayString(unref(tt)('检验结果分布')), 1),
                    createBaseVNode("div", _hoisted_185, [
                      createVNode(SDonut, {
                        data: quality.value.byResult,
                        sub: unref(tt)('明细')
                      }, null, 8, ["data", "sub"])
                    ])
                  ]),
                  createBaseVNode("div", _hoisted_186, [
                    createBaseVNode("div", _hoisted_187, toDisplayString(unref(tt)('检验结果对比')), 1),
                    createBaseVNode("div", _hoisted_188, [
                      createVNode(SBars, {
                        data: quality.value.byResult,
                        "show-pct": ""
                      }, null, 8, ["data"])
                    ])
                  ]),
                  createBaseVNode("div", _hoisted_189, [
                    createBaseVNode("div", _hoisted_190, toDisplayString(unref(tt)('近 7 天送检 / 合格')), 1),
                    createBaseVNode("div", _hoisted_191, [
                      createVNode(SLine, {
                        data: quality.value.trend7,
                        "legend-a": unref(tt)('送检'),
                        "legend-b": unref(tt)('合格')
                      }, null, 8, ["data", "legend-a", "legend-b"])
                    ])
                  ]),
                  createBaseVNode("div", _hoisted_192, [
                    createBaseVNode("div", _hoisted_193, toDisplayString(unref(tt)('不良物料分布')), 1),
                    createBaseVNode("div", _hoisted_194, [
                      createVNode(SBars, {
                        data: quality.value.defectItems,
                        colors: ['#b94d3f', '#d79a2b', '#9c7650', '#537786', '#708575', '#8a9a92']
                      }, null, 8, ["data"])
                    ])
                  ])
                ])),
    createVNode(_component_el_dialog, {
      modelValue: archVisible.value,
      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((archVisible).value = $event)),
      title: unref(tt)('档案本') + ' · ' + archPanelName.value,
      width: "920px",
      top: "4vh",
      "append-to-body": "",
      class: "arch-dialog"
    }, {
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_195, [
          createBaseVNode("button", {
            type: "button",
            class: "arch-btn",
            title: unref(tt)('第一页'),
            disabled: !archIdx.value,
            onClick: _cache[1] || (_cache[1] = $event => (archIdx.value = 0))
          }, "◁", 8, _hoisted_196),
          createBaseVNode("button", {
            type: "button",
            class: "arch-btn",
            title: unref(tt)('上一页'),
            disabled: !archIdx.value,
            onClick: _cache[2] || (_cache[2] = $event => (archIdx.value = Math.max(0, archIdx.value - 1)))
          }, "◀", 8, _hoisted_197),
          createBaseVNode("span", _hoisted_198, toDisplayString(archIdx.value + 1) + " / " + toDisplayString(archDocs.value.length), 1),
          createBaseVNode("button", {
            type: "button",
            class: "arch-btn",
            title: unref(tt)('下一页'),
            disabled: archIdx.value >= archDocs.value.length - 1,
            onClick: _cache[3] || (_cache[3] = $event => (archIdx.value = Math.min(archDocs.value.length - 1, archIdx.value + 1)))
          }, "▶", 8, _hoisted_199),
          createBaseVNode("button", {
            type: "button",
            class: "arch-btn",
            title: unref(tt)('末页'),
            disabled: archIdx.value >= archDocs.value.length - 1,
            onClick: _cache[4] || (_cache[4] = $event => (archIdx.value = archDocs.value.length - 1))
          }, "▷", 8, _hoisted_200),
          (archDoc.value && archDoc.value['单据状态'])
            ? (openBlock(), createElementBlock("span", {
                key: 0,
                class: normalizeClass(["arch-status", archDoc.value['单据状态']])
              }, toDisplayString(unref(tt)(archDoc.value['单据状态'])), 3))
            : createCommentVNode("", true)
        ]),
        withDirectives((openBlock(), createElementBlock("div", _hoisted_201, [
          (archDoc.value && archIsSheet.value)
            ? (openBlock(), createBlock(RecordSheetPanels, {
                key: 0,
                head: archDoc.value,
                fields: archFields.value,
                editable: false,
                "panel-code": archPanel.value
              }, null, 8, ["head", "fields", "panel-code"]))
            : (archDoc.value)
              ? (openBlock(), createElementBlock("div", _hoisted_202, [
                  createBaseVNode("div", _hoisted_203, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(archHeaderFields.value, (f) => {
                      return (openBlock(), createElementBlock("div", {
                        key: f.dataName,
                        class: "af-cell"
                      }, [
                        createBaseVNode("span", _hoisted_204, toDisplayString(unref(tt)(f.displayName || f.dataName)), 1),
                        createBaseVNode("span", _hoisted_205, toDisplayString(archDoc.value[f.dataName] ?? ''), 1)
                      ]))
                    }), 128))
                  ])
                ]))
              : (openBlock(), createElementBlock("div", _hoisted_206, toDisplayString(unref(tt)('该面板暂无单据')), 1))
        ])), [
          [_directive_loading, archLoading.value]
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"])
  ]))
}
}

};
const index = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-68b1c62e"]]);

export { index as default };
