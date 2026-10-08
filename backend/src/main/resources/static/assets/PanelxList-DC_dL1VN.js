const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/jspdf.es.min-B__CRW4f.js","assets/index-CqmwEeWF.js","assets/vue-vendor-DyX2BAKf.js","assets/element-plus-W84rT0en.js","assets/element-icons-DOEvq9OG.js","assets/index-g8h1xhDy.css"])))=>i.map(i=>d[i]);
import { t as tt, u as usePanelRuntime, e as extFieldRetire, a as extFieldOverview, b as extFieldAdd, r as request, c as useUserStore, d as applyCalcRules, _ as __vitePreload, f as callButton, g as errMsg, h as useLocaleStore } from './index-CqmwEeWF.js';
import { d as ElButton, f as ElDialog, v as vLoading, g as ElTableColumn, h as ElInputNumber, c as ElTag, i as ElInput, j as ElTable, k as ElMessage, l as ElMessageBox, m as ElFormItem, n as ElSelect, o as ElOption, q as ElTooltip, r as ElRadioGroup, s as ElRadio, t as ElSwitch, u as ElDivider, w as ElForm, x as ElTabs, y as ElImage, z as ElDatePicker, A as ElIcon, B as ElTabPane, C as ElOptionGroup, D as ElCheckbox, F as ElPopover, G as ElCheckboxGroup, H as ElPagination, b as ElEmpty, I as ElRadioButton } from './element-plus-W84rT0en.js';
/* empty css                   */
/* empty css                    */
/* empty css                  */
/* empty css                         */
/* empty css                */
/* empty css                  */
/* empty css                   */
/* empty css                       */
/* empty css                   */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                         */
/* empty css                        */
import { o as openBlock, P as createBlock, W as withCtx, a as createBaseVNode, $ as toDisplayString, A as unref, a0 as createVNode, _ as createTextVNode, c as createElementBlock, ae as renderList, Z as createCommentVNode, J as Fragment, p as ref, f as computed, X as withDirectives, z as reactive, u as nextTick, j as watch, S as normalizeClass, ac as withModifiers, a5 as onUnmounted, R as normalizeStyle, q as onMounted, D as onBeforeUnmount, aq as withKeys, aE as useRouter, ag as toRaw, aD as useRoute, aF as onBeforeRouteLeave, O as onDeactivated, T as Teleport, aa as markRaw } from './vue-vendor-DyX2BAKf.js';
import { M as search_default, B as plus_default, P as delete_default, R as filter_default } from './element-icons-DOEvq9OG.js';
import { u as useTabsStore } from './tabs-DN15ZjeN.js';
import { I as ImportDialog, A as ApprovalHistoryDialog, S as SelectVoucherDialog, a as ScanFillDialog, e as ensureScanFillAction, r as refShowsCode, b as applyRefCarry, c as refConfigOf } from './ScanFillDialog-AluwVbET.js';
import { s as sumKeepScale } from './sumTotals-C3PClexH.js';
import { Q as QRCode, p as printProductCards, w as woQrText, a as printPuOrder, b as printPuOrderNoAmount, c as printQcReturn, d as printLocationCards, e as printProductionTask } from './print-formats-CjwOqWEr.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
/* empty css                      */
import { R as RefPickDialog, S as StdLibManager, F as FileAttachCell } from './StdLibManager-Dp-r8k7m.js';
import { R as RecordSheetPanels, r as recordSheetConfigs } from './RecordSheetPanels-qfyFO_4T.js';
/* empty css                  */

/**
 * 项目进度查询(RD_PROGRESS)控制列表 —— 列定义的唯一真源。
 *
 * 【为什么必须把"显示名"和"数据键"分开】
 * 这个面板是一张手写表格:表头是业务显示名(项目负责人 / 立项日期 / …),
 * 但写进 detail 行的 **数据键必须是 RD_PROGRESS 的元数据列名**
 * (yj_field.col_name,也就是 rd_progress_detail 的物理列名)。
 * 后端 ButtonService.saveXxx 对明细行执行 labelsToCols(def.fields(), item),
 * 只映射元数据里存在的标签,其余键在保存时被**静默丢弃**。
 *
 * 【历史坑,2026-09-10 修复】
 * 此前前端一直拿"显示名"当数据键,于是除 项目名称 / 子项目/尺寸 / 内容 / 状态 之外
 * 的 10 列全部丢库 —— 表现就是用户报的
 * 「项目实施计划和项目进度查询的自动导入没有实现,出现了偏差」:
 * 自动导入写的「预计完成日期」「项目负责人」保存后消失,手填的那些列同样消失。
 *
 * 【2026-09-18 二次重构:对齐设计《二三级四级项目控制表2026》18 列】
 * 上一轮只做到"6 列把显示名映射到语义无关的物理列"——为不改库结构而做的临时妥协:
 *     立项日期↔实施进度、测试情况↔测试员、项目编号↔说明、
 *     预计完成日期↔里程完成、项目负责人↔项目负责、项目发起人↔项目级
 * 另有 3 列标 pendingAlign(只显示不落库)。
 * 本轮按设计补齐物理列(migrate-rd-progress-18cols.sql),**显示名与数据键 1:1 对齐,
 * 不再有 pendingAlign、不再有错位**。所以下面 6 处 alias 是**历史表头兼容**(旧 Excel
 * 导入模板用的列名),不是错位映射。
 *
 * 【2026-09-22 用户口径:控制列表 14 列】
 * 用户拿设计截图确认:纸面就是 14 列。设计文件表头行虽有 18 格,但其中 4 格不上控制列表:
 *   · 开发复杂度 / 重要程度 / 紧急程度 —— 每行都填着占位符 `n n n`,从无真实数据
 *     (三列物理列由 18cols 迁移新增,无旧列对应)
 *   · 项目定及变更 —— 18cols 迁移为承接「设计 O 列(状态)的手填说明」而建;
 *     用户确认不上控制列表(**物理列与已回填数据都保留**,只是不占纸面)
 * 这 4 列仍保留在 RD_PROGRESS_DETAIL_COLUMNS 里(保存链与历史数据不受影响),
 * 只是不出现在 PROGRESS_COLUMNS(纸面列)中。判据由 progressColumns.test.js 钉死。
 *
 * 改库时必须同步改这里 + progressColumns.test.js 会守住这条线。
 */


/**
 * 控制列表的 **14 列**(顺序 = 纸面列序;2026-09-22 用户拿设计截图确认)。
 *
 * - `label`:界面表头与 Excel 表头的**设计显示名**(业务语言,可多语言)
 * - `key`  :**落库数据键 = 该字段的 yj_field.label**(后端 labelsToCols / rowToLabels 都按 label 收发),
 *           必须在 RD_PROGRESS_DETAIL_LABELS 里。
 *           ⚠ 2026-09-22 修正:此前这里放的是 col_name(物理列名),对 6 处 label≠col 的列是**错的** ——
 *             以「项目定级」为例,载荷键写成 `项目层级` 后:后端按 label 取值取不到 ⇒ **读出来永远是空**
 *             (等级列空白、按等级合并归类从不生效),写回去也被静默丢弃。现统一改为 label。
 *           (label 与物理列名不同的列:项目定级↔项目层级、项目编号↔说明、项目发起人↔项目级、
 *            项目负责人↔项目负责、立项日期↔实施进度、预计完成日期↔里程完成、测试情况↔测试员)
 * - `alias`:Excel 导入时**额外接受**的表头名(readCell 依次尝试 label → alias…)。
 *           分两类,都保留:
 *             ① 历史模板表头 —— 旧版导出的 Excel 用 `项目等级` / `子项目尺寸`,不认就该列丢空
 *             ② 旧物理列名   —— 2026-09-10 那轮"拿显示名当数据键"时期的表头(`说明`/`项目负责`…)
 *           ⚠ 本轮 6 处 label≠key 是**刻意的**:数据库列名是历史遗留
 *             (2026-09-18 决策:col_name 一律不改 —— 数据键永久不变,改则历史单据字段全丢),
 *             而界面按最新设计显示。
 * - `group`:该项目定级值相同的行在渲染时合并该列单元格(设计是纵向合并的行组)
 *
 * ⚠ 不上纸面的 4 列(开发复杂度/重要程度/紧急程度/项目定及变更)不在此表;
 *   它们仍在 RD_PROGRESS_DETAIL_COLUMNS 里,数据照旧保留(见文件头说明)。
 */
const PROGRESS_COLUMNS = Object.freeze([
  { label: '项目定级',     key: '项目定级',     width: 8,  group: true, alias: ['项目等级'] },
  { label: '项目名称',     key: '项目名称',     width: 18 },
  { label: '子项目/尺寸',  key: '子项目/尺寸',  width: 20, alias: ['子项目尺寸'] },
  { label: '项目编号',     key: '项目编号',     width: 16, alias: ['说明'] },
  { label: '内容',         key: '内容',         width: 28 },
  { label: '项目发起人',   key: '项目级',       width: 10, alias: ['项目发起人'] },
  { label: '项目负责人',   key: '项目负责',     width: 10, alias: ['项目负责人'] },
  { label: '立项日期',     key: '实施进度',     width: 10, alias: ['立项日期'] },
  { label: '预计完成日期', key: '里程完成',     width: 11, alias: ['预计完成日期'] },
  { label: '状态',         key: '状态',         width: 18, readonly: true },
  { label: '测试情况',     key: '测试员',       width: 20, alias: ['测试情况'] },
  { label: '技术目标达成', key: '技术目标达成', width: 10 },
  { label: '是否市场转化', key: '是否市场转化', width: 10 },
  { label: '未转换原因',   key: '未转换原因',   width: 14 },
]);

/** 按显示名取列定义 */
function columnByLabel(label) {
  return PROGRESS_COLUMNS.find((c) => c.label === label) || null
}

/** Excel 导入:从一行里取该列的值(兼容历史表头别名) */
function readCell(row, label) {
  const col = columnByLabel(label);
  if (!col) return undefined
  const names = [col.label, ...(col.alias || [])];
  for (const n of names) {
    if (row && Object.prototype.hasOwnProperty.call(row, n)) return row[n]
  }
  return undefined
}

/**
 * 文书默认值(Doc Sheet Defaults)
 *
 * 新建/起草文书面板时带出的初始值。真源在这里,不要在组件里再写一份。
 * (2026-09-21 起也承载**采购入库单的批次号预设**:该单不是文书面板,但"填单时预设、用户可改"
 *  的语义与这里的"仅空值带出"完全一致,放同处便于一处维护。)
 *
 * 两条口径(2026-09-11 grill 确定):
 *  · **锁定字段**:立项申请的「申请立项人」、实施计划的「负责人」——由当前登录用户决定,
 *    用户不可改(元数据里 editable=0,UI 三处按只读渲染)。只在「新增」时写入;
 *    打开既有单据(isNew=false)一律不碰,否则弃审后再打开会把申请人改成操作人 = 冒名。
 *  · **其余默认值**:仅当为空时填,用户可改(文件管理人/密级/申请立项日期等)。
 *
 * 为什么必须挂在「新增」这一刻:RD_APPROVAL/RD_PLAN 属 DOC_ARCHIVE_PANELS,保存后
 * 管理员=已归档、普通用户=审批中,**都不经过草稿态**;旧实现挂在要求 draftEditable 的
 * watch 上,所以从未执行过。
 */

/** 锁定字段:面板 → 由当前登录用户自动填入的字段标签 */
const LOCKED_PERSON = {
  RD_APPROVAL: '申请立项人',
  RD_PLAN: '负责人',
  // 检验数据记录(YJ-QR-96 检验报告):原表「检验人=账号登录人自动生成」——由登录用户锁定填入
  QC_INSP_REC: '检验人',
  // 2026-09-18:出货检验计划表「编写人」= 编写人固定登录账号人员(设计原文),元数据 editable=0
  RD_INSP_PLAN: '编写人',
};

/** 非锁定默认值:'@today' 占位表示当天日期(可内嵌,如「V@today」⇒ V2026-09-20);函数形式按 (form, ctx) 现算 */
const DOC_DEFAULTS = {
  // 2026-09-22:补「密级=保密」——两份设计纸的右上信息表印的就是它
  // (立项申请表.xlsx G3 / 项目实施计划.xlsx G4);同族面板(FILTER_EFF/SAMPLE_NO/PROD_DOCLIST)早有该默认值
  RD_APPROVAL: [['申请立项日期', '@today'], ['文件管理人', '陈秀丽'], ['密级', '保密']],
  RD_PLAN: [['文件管理人', '陈秀丽'], ['密级', '保密']],
  // 2026-09-22:控制列表纸面印的是「密级=绝密 / 适用范围=工程技术中心」(设计 P2/Q2、P3/Q3)
  RD_PROGRESS: [['文件使用范围', '工程技术中心'], ['密级', '绝密']],
  RD_FILTER_EFF: [['密级', '保密'], ['适用范围', '银嘉内部'], ['测试主题', '伊可普需求2炭棒除VOC测试'], ['表单审核人', '秀丽']],
  // 数据记录表(实验室 8 张)的「审核人」——需求《产品开发系统需求汇总.xlsx》sheet「数据记录表」
  // 第 1 条原文:「都需要审核人(秀丽)」。
  // ⚠ 这里是**纸面签名文本**(默认带出、可人工改),不是审批权:
  //   真审批权在 yj_role_panel.can_approve(陈秀丽挂「研发审核」角色,8 张表全勾),
  //   见 tools/migrate-rd-datarec-reviewer-2026-09-30.sql。
  // ⚠ 落库键是「表单审核人」而不是「审核人」:后者会被 ButtonService.save() 的
  //   body.remove("审核人") 静默丢弃(那是 yj_doc_status.shr 的虚拟字段)——与 QC_INSP_REC 同款口径。
  RD_ALKALINE: [['表单审核人', '秀丽']],
  RD_MINERAL: [['表单审核人', '秀丽']],
  RD_ANTIBACT: [['表单审核人', '秀丽']],
  RD_SCALE: [['表单审核人', '秀丽']],
  RD_RO_PROTECT: [['表单审核人', '秀丽']],
  RD_SOAK: [['表单审核人', '秀丽']],
  RD_DROP_PREC: [['表单审核人', '秀丽']],
  // 检验数据记录(YJ-QR-96 检验报告):原表固定项——文件编码 YJ-QR-96 / 检验依据 YJ-Q-30 / 审核人 固定:冯敏
  // (签名行落库列名是「表单审核人」:叫「审核人」会被 ButtonService 保存时显式丢弃,见该面板迁移注释)
  QC_INSP_REC: [['文件编码', 'YJ-QR-96'], ['检验依据', 'YJ-Q-30'], ['表单审核人', '冯敏'], ['检验日期', '@today']],
  // 采购入库单的「批次号」预设已于 2026-10-04 **移除** —— 批次号现由**生单那一刻**在服务端定稿
  // (供应商编码去掉 YJ- 前缀 + `-` + 生单当天 yyyyMMdd,如 YJ-TX ⇒ TX-20260910),
  // 并沿 暂收 → 检验 → 入库 逐站继承;前端再"按单据日期预设"会与继承值打架(旧值是纯日期,格式也不同)。
  // 真源:BatchService.buildBatchNo / PushGenerateHandler.generateBatch;
  // 手工新建的链路单由 BatchService.syncBatchNo 在保存时按同一公式兜底取号。
  // 2026-09-18 新增(研发管理 × 产品开发最新设计)
  // ⚠ 同批新增的「样品编号表」(RD_SAMPLE_NO)已于 2026-09-30 下架(用户口径「样品编号表删掉」),
  //   它的默认值条目随之移除 —— 见 tools/migrate-drop-sample-no-panel-2026-09-30.sql。
  RD_PROD_DOCLIST: [['密级', '保密'], ['文件使用范围', '工程技术中心'], ['文件管理人', '陈秀丽']],
  // 2026-09-18 第二轮(产品信息表界面调整):
  //   两级审批人**固定填写** 冯总 / 秀丽(用户口径)。
  //   ⚠ 走"默认值"而不是"锁定只读":固定是业务口径,但发文人偶尔需要按实际改
  //     (与 文件管理人=陈秀丽 同款处理);若将来要收紧成不可改,改 yj_field.editable=0 即可。
  RD_PROD_INFO: [
    ['审核人一级', '冯总'],
    ['审核人二级', '秀丽'],
  ],
  // 2026-09-20 出货检验项目控制计划按《出货检验项目控制计划.xlsx》重排为「一张表 7 列」。
  //   设计纸张上写死的那几格(表单管理人=冯敏 / 密级=保密 / 使用范围=全公司 / 审核人=冯加劲)
  //   照录为默认值 —— 走"默认值"而非"锁定只读",因为这几格是业务常值不是身份,
  //   与 RD_PROD_INFO 的两级审批人同款口径。
  //   版本号设计原文是「V + 按照日期来」⇒ 'V@today' 展开成「V2026-09-20」(当天)。
  //   ⚠ 编写人不在这里:它由登录人决定,在 LOCKED_PERSON 里(editable=0,UI 三处按只读渲染)。
  RD_INSP_PLAN: [
    ['表单管理人', '冯敏'],
    ['密级', '保密'],
    ['使用范围', '全公司'],
    ['审核人', '冯加劲'],
    ['版本号', 'V@today'],
  ],
};

/** 该面板由当前用户锁定的字段标签;没有则 null */
function lockedPersonLabel(panelCode) {
  return LOCKED_PERSON[String(panelCode || '')] || null
}

/** 本地时区的 YYYY-MM-DD(用 UTC 直取会在东八区差一天) */
function todayStr(d = new Date()) {
  const t = d instanceof Date ? d : new Date(d);
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function isEmpty(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

/**
 * 日期 → yyyyMMdd(取前 8 位数字:'2026-09-21' / '2026/09/21' / '20260921' → '20260921')。
 *
 * ⚠ 与批次号已**无生成关系**(2026-10-04 起批次号由服务端在生单时取:
 * 供应商编码去 YJ- 前缀 + `-` + 当天 yyyyMMdd,见 BatchService.buildBatchNo)。
 * 现存唯一用途 = 打印层对**口径上线前的老单**做批次兜底展示
 * (PanelxList「打印标识卡」:头批次号空时退回单据日期推导),纯出参、不写库。
 */
function docNoFromDate(dateStr) {
  const digits = String(dateStr ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(0, 8) : ''
}

/** 展开值里的 '@today'(整串或内嵌:「V@today」⇒ V2026-09-20);没有占位就原样返回 */
function expandToday(value, today) {
  return typeof value === 'string' && value.includes('@today') ? value.split('@today').join(today) : value
}

/** 当前用户显示名(user store 的 realName getter 同口径:姓名优先,退回账号) */
function displayNameOf(user) {
  return String((user && (user.realName || user.userName)) || '').trim()
}

/**
 * 就地套用默认值,返回同一个 form(便于链式调用)。
 * @param {string} panelCode 面板编码
 * @param {object} form 表单(键=字段标签)
 * @param {object} user 当前用户(realName/userName)
 * @param {{isNew?: boolean, today?: string}} opts isNew=新增(才写锁定字段)
 */
function applyDocDefaults(panelCode, form, user, opts = {}) {
  if (!form || typeof form !== 'object') return form
  const code = String(panelCode || '');
  const { isNew = false, today = todayStr() } = opts;

  if (isNew) {
    const locked = lockedPersonLabel(code);
    const name = displayNameOf(user);
    if (locked && name) form[locked] = name;
  }

  for (const [key, value] of DOC_DEFAULTS[code] || []) {
    if (!isEmpty(form[key])) continue
    form[key] = typeof value === 'function' ? value(form, { today }) : expandToday(value, today);
  }
  return form
}

/* unplugin-vue-components disabled */

const _hoisted_1$g = { class: "qr-label-toolbar" };
const _hoisted_2$g = { class: "qr-label-tip" };
const _hoisted_3$g = ["src"];
const _hoisted_4$g = { class: "qr-label-info" };
const _hoisted_5$f = { class: "qr-label-line strong" };
const _hoisted_6$f = { class: "qr-label-line" };
const _hoisted_7$e = {
  key: 0,
  class: "qr-label-line"
};
const _hoisted_8$d = { class: "qr-label-line dim" };
const _hoisted_9$b = {
  key: 0,
  class: "qr-label-empty"
};


const _sfc_main$g = {
  __name: 'QrLabelDialog',
  props: {
  modelValue: Boolean,
  /** [{code, name, lot, qty, unit, doc, qrText?}] */
  labels: { type: Array, default: () => [] },
  /** 标题/提示可覆盖(工单二维码标签等复用本对话框) */
  title: { type: String, default: '' },
  tip: { type: String, default: '' },
},
  emits: ['update:modelValue'],
  setup(__props, { emit: __emit }) {

/**
 * QrLabelDialog — 材料二维码标签打印(品检分流链 #3)
 * 数据源:暂收单明细行(物料编码/名称/批号/数量/单位)/采购订单明细行(无批号,供应商贴码);
 * 二维码内容 = `物料编码|批号@数量`(2026-09-28 用户口径加 @数量;批号空→无批号段,数量空→无@段;
 * 工单/产品二维码经 qrText 覆盖,不受默认拼接影响)。
 * 打印:对话框内打印样式(@media print 只显示标签网格),调用 window.print()。
 */
const props = __props;
const emit = __emit;
const visibleModel = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) });
const gridRef = ref(null);

async function renderQr() {
  for (const lb of props.labels) {
    if (!lb.qr && lb.code) {
      // @数量段(2026-09-28):数量空则整段省略;批号空则无 |批号 段 —— 供应商在采购订单打码即 编码@数量
      const qtySuffix = lb.qty == null || lb.qty === '' ? '' : '@' + lb.qty;
      const text = lb.qrText || (lb.lot ? `${lb.code}|${lb.lot}${qtySuffix}` : `${lb.code}${qtySuffix}`);
      try { lb.qr = await QRCode.toDataURL(text, { width: 160, margin: 1, errorCorrectionLevel: 'M' }); }
      catch { /* 单张失败不影响其余 */ }
    }
  }
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function print() {
  const cards = props.labels.filter((l) => l.qr).map((l) => `<div class="card"><img src="${l.qr}"/>
    <div class="info"><div class="l strong">${esc(l.code)}</div><div class="l">${esc(l.name)}</div>
    <div class="l">LOT ${esc(l.lot)}</div><div class="l dim">${esc(l.qty)} ${esc(l.unit)} · ${esc(l.doc)}</div></div></div>`).join('');
  const w = window.open('', '_blank', 'width=820,height=640');
  if (!w) return
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>材料二维码标签</title><style>'
    + 'body{font-family:system-ui,"Microsoft YaHei",sans-serif;margin:14px;color:#222}'
    + '.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}'
    + '.card{display:flex;gap:10px;padding:8px;border:1px solid #999;border-radius:4px;page-break-inside:avoid;break-inside:avoid}'
    + '.card img{width:84px;height:84px}'
    + '.info{display:flex;flex-direction:column;justify-content:center;min-width:0}'
    + '.l{font-size:12px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.strong{font-weight:600;font-size:14px}.dim{color:#666}'
    + '@page{margin:8mm}'
    + '</style></head><body><div class="grid">' + cards + '</div>'
    + '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print()},150)}</scr' + 'ipt></body></html>');
  w.document.close();
}

return (_ctx, _cache) => {
  return (openBlock(), createBlock(unref(ElDialog), {
    modelValue: visibleModel.value,
    "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((visibleModel).value = $event)),
    title: props.title || unref(tt)('材料二维码标签'),
    width: "720px",
    "append-to-body": "",
    class: "qr-label-dlg",
    onOpened: renderQr
  }, {
    default: withCtx(() => [
      createBaseVNode("div", _hoisted_1$g, [
        createBaseVNode("span", _hoisted_2$g, toDisplayString(props.tip || unref(tt)('二维码 = 物料编码|批号@数量（扫描后可解析出入库与追溯信息），每行物料一张标签')), 1),
        createVNode(unref(ElButton), {
          size: "small",
          type: "primary",
          onClick: print
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('打印')), 1)
          ]),
          _: 1
        })
      ]),
      createBaseVNode("div", {
        class: "qr-label-grid",
        ref_key: "gridRef",
        ref: gridRef
      }, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(__props.labels, (lb, i) => {
          return (openBlock(), createElementBlock("div", {
            key: i,
            class: "qr-label-card"
          }, [
            (lb.qr)
              ? (openBlock(), createElementBlock("img", {
                  key: 0,
                  src: lb.qr,
                  class: "qr-label-img"
                }, null, 8, _hoisted_3$g))
              : createCommentVNode("", true),
            createBaseVNode("div", _hoisted_4$g, [
              createBaseVNode("div", _hoisted_5$f, toDisplayString(lb.code), 1),
              createBaseVNode("div", _hoisted_6$f, toDisplayString(lb.name), 1),
              (lb.lot)
                ? (openBlock(), createElementBlock("div", _hoisted_7$e, "LOT " + toDisplayString(lb.lot), 1))
                : createCommentVNode("", true),
              createBaseVNode("div", _hoisted_8$d, toDisplayString(lb.qty) + " " + toDisplayString(lb.unit) + " · " + toDisplayString(lb.doc), 1)
            ])
          ]))
        }), 128)),
        (!__props.labels.length)
          ? (openBlock(), createElementBlock("div", _hoisted_9$b, toDisplayString(unref(tt)('当前单据没有可打印的明细行（或行缺少批号，请先保存）')), 1))
          : createCommentVNode("", true)
      ], 512)
    ]),
    _: 1
  }, 8, ["modelValue", "title"]))
}
}

};
const QrLabelDialog = /*#__PURE__*/_export_sfc(_sfc_main$g, [['__scopeId',"data-v-623e5372"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$f = { class: "mlq" };
const _hoisted_2$f = { class: "mlq-bar" };
const _hoisted_3$f = { class: "mlq-chip" };
const _hoisted_4$f = { class: "mlq-chip mlq-batch" };
const _hoisted_5$e = { class: "mlq-chip mlq-tip" };
const _hoisted_6$e = { class: "mlq-oneline" };
const _hoisted_7$d = { class: "mlq-foot" };
const _hoisted_8$c = {
  key: 0,
  class: "mlq-tip"
};
const _hoisted_9$a = {
  key: 0,
  class: "mlq-supp"
};
const _hoisted_10$a = { class: "mlq-supp-title" };
const _hoisted_11$a = { class: "mlq-tip" };
const _hoisted_12$a = { class: "mlq-records" };
const _hoisted_13$a = { class: "mlq-rec-title" };


const _sfc_main$f = {
  __name: 'MaterialLabelDialog',
  props: {
  modelValue: { type: Boolean, default: false },
  /** 采购订单号(当前单据) */
  orderNo: { type: String, default: '' },
},
  emits: ['update:modelValue', 'printed'],
  setup(__props, { emit: __emit }) {

/**
 * MaterialLabelDialog — 采购订单「打印材料码」弹窗(2026-10-04)
 *
 * 为什么有这个弹窗:供应商自己打码时,标签上必须印批次号,而批次号原本要到**生单那一刻**才有。
 * 本弹窗把批次号前移:打印时按公式预填、可人工改,确认后**先落库**(bd_pu_label/bl_pu_label)再出纸。
 * 打印记录即该订单上批次号的权威登记处,并**预约**该行数量(未生单的预约量从余量里扣减);
 * 生单对话框里它是**独立的一行**（数量已从原行切走），勾它即按这个号生单,不再按公式重算。
 *
 * ⚠ **一次可以勾多行,但每行各自出一张打印单**(用户口径:先「不能多行否则作废就全部作废了」,
 * 再追加「一次是可以打印多行的」⇒ 粒度落在**单**上而不是弹窗上):
 * 勾 3 行 ⇒ 落 3 张 bd_pu_label(同一个批次号、3 个单号),作废其中一张只影响它自己那一行。
 * 方案:docs/plans/2026-10-04-采购订单材料码批次号方案.md
 *
 * 出纸复用 printProductCards(75×100mm 产品标识卡),这次把「批次」传真值 ——
 * 纸面不再留横线,二维码也随之带上批号段(公司代码@物料编码@批次号,与采购入库单标识卡同口径)。
 */
const engine = usePanelRuntime();

const props = __props;
const emit = __emit;

const loading = ref(false);
const busy = ref(false);
const data = ref({});
const head = computed(() => data.value || {});
const rows = computed(() => data.value.lines || []);
const batchNo = ref('');
const tableRef = ref(null);
/** **多选**:本次要打的行(勾选是权威;服务端会按**每行一张单**落库) */
const picked = ref([]);
const qtyOf = reactive({});

const pickedKeys = computed(() => new Set(picked.value.map((r) => r.id)));
const totalQty = computed(() => {
  let s = 0;
  for (const r of rows.value) if (pickedKeys.value.has(r.id)) s += Number(qtyOf[r.id] || 0) || 0;
  return Math.round(s * 100) / 100
});
/** 该行本次最多能打多少(服务端算好的「剩余可打」;前端只做即时约束,后端还会重算一遍) */
function capOf(row) {
  return Math.max(0, Number(row?.剩余可打 || 0))
}
/** 有可打量才让勾(打满的行不给勾) */
function rowSelectable(row) {
  return capOf(row) > 0
}

/* ── 下层「已生单可补打」:已收但还没打码的量(按 订单行 × 已生单批次号 一行) ── */
const suppRef = ref(null);
const suppPicked = ref([]);
const suppQty = reactive({});
/** 补登行的唯一键(行id + 批次号;批次号里可能有特殊字符,故用 \u0001 拼) */
const suppKeyOf = (row) => `${row['采购订单行id']}\u0001${row['批次号']}`;
const suppRows = computed(() => (data.value['补登行'] || []).map((r) => ({ ...r, suppKey: suppKeyOf(r) })));
function suppSelectable(row) {
  return Number(row['可补登数量'] || 0) > 0
}
function onSuppPicked(list) {
  suppPicked.value = list || [];
  for (const r of suppPicked.value) {
    if (!(Number(suppQty[r.suppKey] || 0) > 0)) suppQty[r.suppKey] = Number(r['可补登数量'] || 0);
  }
}
const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';

async function load() {
  if (!props.orderNo) return
  loading.value = true;
  try {
    data.value = await engine.puLabelDialog(props.orderNo);
    batchNo.value = String(data.value?.prefBatchNo || '');
    Object.keys(qtyOf).forEach((k) => delete qtyOf[k]);
    for (const r of rows.value) qtyOf[r.id] = capOf(r) > 0 ? capOf(r) : 0;
    // 下层补登:数量与勾选每次都清空(默认不勾 —— 补登是"事后补打",必须显式选)
    Object.keys(suppQty).forEach((k) => delete suppQty[k]);
    suppPicked.value = [];
    for (const r of suppRows.value) suppQty[r.suppKey] = 0;
    // 默认勾上**所有有可打量**的行(与分批送料对话框同款便利,勾选仍是权威)
    await Promise.resolve();
    syncPick(rows.value.filter((r) => capOf(r) > 0).map((r) => r.id));
    await nextTick();
    suppRef.value?.clearSelection();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('材料码数据加载失败'));
  } finally {
    loading.value = false;
  }
}

/** 勾选集合 → 表格勾选态(并同步 picked,避免依赖 selection-change 的时序) */
function syncPick(ids) {
  const set = new Set(ids);
  tableRef.value?.clearSelection();
  picked.value = [];
  for (const r of rows.value) if (set.has(r.id)) tableRef.value?.toggleRowSelection(r, true);
  picked.value = rows.value.filter((r) => set.has(r.id));
  prefill();
}
function onPicked(list) {
  picked.value = list || [];
  prefill();
}
/** 新勾上的行按剩余可打量预填(已填过的不覆盖:取消勾选不吞已填数量,重勾还能用) */
function prefill() {
  for (const r of picked.value) if (!(Number(qtyOf[r.id] || 0) > 0)) qtyOf[r.id] = capOf(r);
}
function fillRemaining() {
  for (const r of rows.value) qtyOf[r.id] = capOf(r);
  syncPick(rows.value.filter((r) => capOf(r) > 0).map((r) => r.id));
}
function clearAll() {
  for (const r of rows.value) qtyOf[r.id] = 0;
  syncPick([]);
}

/** 出纸:纸上的号 = 库里的号(先落库再打印) */
function cardsOf(res) {
  return (res?.lines || []).map((l) => ({
    编码: l['物料编码'],
    规格: l['规格型号'] || '',
    数量: l['打印数量'],
    批次: res['批次号'],
    订单编号: props.orderNo,
    供应商名称: head.value['供应商'] || '',
    生产日期: '',
  }))
}

async function confirm() {
  const lines = rows.value
    .filter((r) => pickedKeys.value.has(r.id) && Number(qtyOf[r.id] || 0) > 0)
    .map((r) => ({ 采购订单行id: r.id, 打印数量: Number(qtyOf[r.id]) }));
  // 下层补登行:各自带自己的批次号(该批货单据上的号),标记 补登=true
  const supLines = suppPicked.value
    .filter((r) => Number(suppQty[r.suppKey] || 0) > 0)
    .map((r) => ({
      采购订单行id: r['采购订单行id'], 打印数量: Number(suppQty[r.suppKey]),
      批次号: String(r['批次号'] || ''), 补登: true,
    }));
  const all = [...lines, ...supLines];
  if (!all.length) { ElMessage.warning(tt('请至少勾选一行并填写本次打印数量')); return }
  // 上层走顶部批次号(未生单的码,公式号/人工号);只勾下层补登行时不需要顶部号
  if (lines.length && isEmpty(batchNo.value)) { ElMessage.warning(tt('请填写批次号')); return }
  busy.value = true;
  try {
    // 可以一次勾多行:服务端**每行各出一张打印单**(作废因此只影响对应那一行)
    const res = await engine.puLabelPrint({
      orderNo: props.orderNo, batchNo: String(batchNo.value).trim(), lines: all,
    });
    await printProductCards(cardsOf(res));
    const docs = res['单据编号列表'] || [res['单据编号']];
    ElMessage.success(docs.length > 1
      ? `${tt('已登记并打印 {n} 张打印单').replace('{n}', docs.length)}${docs.join('、')}（${tt('批次号')} ${res['批次号']}）`
      : `${tt('已登记并打印')} ${res['单据编号']}（${tt('批次号')} ${res['批次号']}）`);
    emit('printed', {
      orderNo: props.orderNo, docNo: res['单据编号'], batchNo: res['批次号'], count: docs.length,
    });
    await load();          // 刷新"剩余可打"与"已打印记录"
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('打印登记失败'));
  } finally {
    busy.value = false;
  }
}

/** 重打:同一张打印单原样再打一遍(只累加打印次数,不新增预约) */
async function doReprint(row) {
  busy.value = true;
  try {
    const res = await engine.puLabelReprint(row['单据编号']);
    await printProductCards(cardsOf(res));
    ElMessage.success(`${tt('已重打（第 {n} 次）').replace('{n}', res['打印次数'])} ${res['单据编号']}`);
    await load();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('重打失败'));
  } finally {
    busy.value = false;
  }
}

async function doVoid(row) {
  try {
    await ElMessageBox.confirm(
      `${tt('作废后该批次的预约量立即释放回余量（已打印的纸仍在供应商手里，请自行作废）。')}\n${tt('打印单号')} ${row['单据编号']} / ${tt('批次号')} ${row['批次号']}`,
      tt('作废打印记录'), { type: 'warning' });
  } catch { return }
  busy.value = true;
  try {
    await engine.puLabelVoid(row['单据编号']);
    ElMessage.success(tt('已作废，预约量已释放'));
    await load();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('作废失败'));
  } finally {
    busy.value = false;
  }
}

return (_ctx, _cache) => {
  const _component_el_input = ElInput;
  const _component_el_button = ElButton;
  const _component_el_table_column = ElTableColumn;
  const _component_el_input_number = ElInputNumber;
  const _component_el_table = ElTable;
  const _component_el_tag = ElTag;
  const _component_el_dialog = ElDialog;
  const _directive_loading = vLoading;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: unref(tt)('打印材料码') + (__props.orderNo ? ' · ' + __props.orderNo : ''),
    width: "1000px",
    "append-to-body": "",
    "destroy-on-close": "",
    "onUpdate:modelValue": _cache[2] || (_cache[2] = (v) => emit('update:modelValue', v)),
    onOpen: load
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, { onClick: fillRemaining }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('按剩余量填充')), 1)
        ]),
        _: 1
      }),
      createVNode(_component_el_button, { onClick: clearAll }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('清空')), 1)
        ]),
        _: 1
      }),
      createVNode(_component_el_button, {
        type: "primary",
        loading: busy.value,
        onClick: confirm
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('确定并打印')), 1)
        ]),
        _: 1
      }, 8, ["loading"])
    ]),
    default: withCtx(() => [
      withDirectives((openBlock(), createElementBlock("div", _hoisted_1$f, [
        createBaseVNode("div", _hoisted_2$f, [
          createBaseVNode("span", _hoisted_3$f, toDisplayString(unref(tt)('供应商')) + ": " + toDisplayString(head.value['供应商'] || head.value['供应商编码'] || '—'), 1),
          createBaseVNode("span", _hoisted_4$f, [
            createTextVNode(toDisplayString(unref(tt)('批次号')) + ": ", 1),
            createVNode(_component_el_input, {
              modelValue: batchNo.value,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((batchNo).value = $event)),
              size: "small",
              class: "mlq-batch-inp",
              maxlength: "100",
              clearable: "",
              placeholder: unref(tt)('生单时按供应商编码与当天日期生成')
            }, null, 8, ["modelValue", "placeholder"]),
            (batchNo.value !== data.value.prefBatchNo)
              ? (openBlock(), createBlock(_component_el_button, {
                  key: 0,
                  link: "",
                  type: "primary",
                  size: "small",
                  onClick: _cache[1] || (_cache[1] = $event => (batchNo.value = data.value.prefBatchNo))
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('恢复默认')), 1)
                  ]),
                  _: 1
                }))
              : createCommentVNode("", true)
          ]),
          createBaseVNode("span", _hoisted_5$e, toDisplayString(unref(tt)('打印上限 = 订单数量 ×（1 + 超送比例）− 已送 + 已退回 − 已打印未生单')), 1)
        ]),
        createBaseVNode("div", _hoisted_6$e, toDisplayString(unref(tt)('可一次勾选多行；每行各自出一张打印单（作废只影响对应那一行）')), 1),
        createVNode(_component_el_table, {
          ref_key: "tableRef",
          ref: tableRef,
          data: rows.value,
          "row-key": "id",
          border: "",
          size: "small",
          height: "330",
          onSelectionChange: onPicked
        }, {
          default: withCtx(() => [
            createVNode(_component_el_table_column, {
              type: "selection",
              width: "42",
              selectable: rowSelectable
            }),
            createVNode(_component_el_table_column, {
              prop: "行号",
              label: unref(tt)('行号'),
              width: "70"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "物料编码",
              label: unref(tt)('物料编码'),
              "min-width": "130",
              "show-overflow-tooltip": ""
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "物料名称",
              label: unref(tt)('物料名称'),
              "min-width": "130",
              "show-overflow-tooltip": ""
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "规格型号",
              label: unref(tt)('规格型号'),
              "min-width": "110",
              "show-overflow-tooltip": ""
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "数量",
              label: unref(tt)('订单数量'),
              width: "95",
              align: "right"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "已送数量",
              label: unref(tt)('已送'),
              width: "80",
              align: "right"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "已打印数量",
              label: unref(tt)('已打印'),
              width: "85",
              align: "right"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "剩余可打",
              label: unref(tt)('剩余可打'),
              width: "90",
              align: "right"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              label: unref(tt)('本次打印数量'),
              width: "150"
            }, {
              default: withCtx(({ row }) => [
                createVNode(_component_el_input_number, {
                  modelValue: qtyOf[row.id],
                  "onUpdate:modelValue": $event => ((qtyOf[row.id]) = $event),
                  min: 0,
                  max: capOf(row),
                  controls: false,
                  disabled: !(capOf(row) > 0),
                  precision: 2,
                  style: {"width":"130px"}
                }, null, 8, ["modelValue", "onUpdate:modelValue", "max", "disabled"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "计量单位",
              label: unref(tt)('计量单位'),
              width: "85"
            }, null, 8, ["label"])
          ]),
          _: 1
        }, 8, ["data"]),
        createBaseVNode("div", _hoisted_7$d, [
          createBaseVNode("span", null, [
            createTextVNode(toDisplayString(unref(tt)('已选')) + " ", 1),
            createBaseVNode("b", null, toDisplayString(picked.value.length), 1),
            createTextVNode(" " + toDisplayString(unref(tt)('行')) + " · " + toDisplayString(unref(tt)('本次合计')) + ": ", 1),
            createBaseVNode("b", null, toDisplayString(totalQty.value), 1),
            (picked.value.length > 1)
              ? (openBlock(), createElementBlock("span", _hoisted_8$c, "（" + toDisplayString(unref(tt)('将生成')) + " " + toDisplayString(picked.value.length) + " " + toDisplayString(unref(tt)('张打印单')) + "）", 1))
              : createCommentVNode("", true)
          ])
        ]),
        (suppRows.value.length)
          ? (openBlock(), createElementBlock("div", _hoisted_9$a, [
              createBaseVNode("div", _hoisted_10$a, [
                createTextVNode(toDisplayString(unref(tt)('已生单可补打（已经收了的量还没打码）')) + " ", 1),
                createBaseVNode("span", _hoisted_11$a, toDisplayString(unref(tt)('补打只为留痕：不占用余量、不会在生单弹窗里多出一行；批次号取该批货单据上的号，不可改')), 1)
              ]),
              createVNode(_component_el_table, {
                ref_key: "suppRef",
                ref: suppRef,
                data: suppRows.value,
                "row-key": "suppKey",
                border: "",
                size: "small",
                "max-height": "200",
                onSelectionChange: onSuppPicked
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    type: "selection",
                    width: "42",
                    selectable: suppSelectable
                  }),
                  createVNode(_component_el_table_column, {
                    prop: "批次号",
                    label: unref(tt)('批次号'),
                    "min-width": "150",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "行号",
                    label: unref(tt)('行号'),
                    width: "60"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "物料编码",
                    label: unref(tt)('物料编码'),
                    "min-width": "120",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "物料名称",
                    label: unref(tt)('物料名称'),
                    "min-width": "120",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "去向单据",
                    label: unref(tt)('去向单据'),
                    "min-width": "140",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "已收数量",
                    label: unref(tt)('已收'),
                    width: "85",
                    align: "right"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "已补登数量",
                    label: unref(tt)('已补打'),
                    width: "85",
                    align: "right"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "可补登数量",
                    label: unref(tt)('可补打'),
                    width: "90",
                    align: "right"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('本次打印数量'),
                    width: "150"
                  }, {
                    default: withCtx(({ row }) => [
                      createVNode(_component_el_input_number, {
                        modelValue: suppQty[row.suppKey],
                        "onUpdate:modelValue": $event => ((suppQty[row.suppKey]) = $event),
                        min: 0,
                        max: Number(row['可补登数量'] || 0),
                        controls: false,
                        disabled: !(Number(row['可补登数量'] || 0) > 0),
                        precision: 2,
                        style: {"width":"130px"}
                      }, null, 8, ["modelValue", "onUpdate:modelValue", "max", "disabled"])
                    ]),
                    _: 1
                  }, 8, ["label"])
                ]),
                _: 1
              }, 8, ["data"])
            ]))
          : createCommentVNode("", true),
        createBaseVNode("div", _hoisted_12$a, [
          createBaseVNode("div", _hoisted_13$a, toDisplayString(unref(tt)('已打印记录（本订单）')), 1),
          createVNode(_component_el_table, {
            data: data.value.records || [],
            border: "",
            size: "small",
            "max-height": "200"
          }, {
            empty: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('该订单还没有打印过材料码')), 1)
            ]),
            default: withCtx(() => [
              createVNode(_component_el_table_column, {
                prop: "批次号",
                label: unref(tt)('批次号'),
                "min-width": "160"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                prop: "单据编号",
                label: unref(tt)('打印单号'),
                "min-width": "150"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('用途'),
                width: "110",
                align: "center"
              }, {
                default: withCtx(({ row }) => [
                  createVNode(_component_el_tag, {
                    type: row['补登'] ? 'info' : 'success',
                    size: "small"
                  }, {
                    default: withCtx(() => [
                      createTextVNode(toDisplayString(unref(tt)(row['补登'] ? '已生单补登' : '待生单')), 1)
                    ]),
                    _: 2
                  }, 1032, ["type"])
                ]),
                _: 1
              }, 8, ["label"]),
              createVNode(_component_el_table_column, {
                prop: "打印量合计",
                label: unref(tt)('打印量'),
                width: "90",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                prop: "已生单合计",
                label: unref(tt)('已生单'),
                width: "90",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                prop: "未生单合计",
                label: unref(tt)('未生单'),
                width: "90",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                prop: "行数",
                label: unref(tt)('行数'),
                width: "70",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                prop: "打印时间",
                label: unref(tt)('打印时间'),
                width: "150"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                prop: "打印次数",
                label: unref(tt)('打印次数'),
                width: "85",
                align: "right"
              }, null, 8, ["label"]),
              createVNode(_component_el_table_column, {
                label: unref(tt)('操作'),
                width: "130",
                align: "center"
              }, {
                default: withCtx(({ row }) => [
                  createVNode(_component_el_button, {
                    link: "",
                    type: "primary",
                    disabled: busy.value,
                    onClick: $event => (doReprint(row))
                  }, {
                    default: withCtx(() => [
                      createTextVNode(toDisplayString(unref(tt)('重打')), 1)
                    ]),
                    _: 1
                  }, 8, ["disabled", "onClick"]),
                  createVNode(_component_el_button, {
                    link: "",
                    type: "danger",
                    disabled: busy.value,
                    onClick: $event => (doVoid(row))
                  }, {
                    default: withCtx(() => [
                      createTextVNode(toDisplayString(unref(tt)('作废')), 1)
                    ]),
                    _: 1
                  }, 8, ["disabled", "onClick"])
                ]),
                _: 1
              }, 8, ["label"])
            ]),
            _: 1
          }, 8, ["data"])
        ])
      ])), [
        [_directive_loading, loading.value]
      ])
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const MaterialLabelDialog = /*#__PURE__*/_export_sfc(_sfc_main$f, [['__scopeId',"data-v-f3379c4e"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$e = { class: "fm-summary" };
const _hoisted_2$e = {
  key: 0,
  class: "fm-tabusage"
};
const _hoisted_3$e = { class: "fm-parent" };
const _hoisted_4$e = {
  key: 0,
  class: "fm-parent-hint"
};

// 2026-09-28 修「点关闭无反应」:本组件此前声明 visible prop + emit('update:visible'),
// 而父组件(PanelxList)用 v-model(即 modelValue / update:modelValue)⇒ 页脚「关闭」按钮
// 发出的 update:visible 没人监听(× 能关是 el-dialog 的 update:modelValue 经透传 attr 落回父级)。
// 统一为 Vue 标准 v-model 契约:modelValue + update:modelValue。

const _sfc_main$e = {
  __name: 'FieldManagerDialog',
  props: {
  modelValue: Boolean,
  panelCode: String,
  /** 分页签面板(来料检验要求)才传:该面板的页签清单 [{value,label}] —— 自定义列必须指明住哪张表 */
  tabs: { type: Array, default: () => [] },
  /** 打开时默认选中的页签(一般是当前正在看的那张表) */
  defaultTab: { type: String, default: '' },
  /** 父字段候选:(tabKey) => string[] —— 固定列已有的分组 + 该页签已用的父(仍可自己新建) */
  parentOptionsOf: { type: Function, default: null },
},
  emits: ['update:modelValue', 'done'],
  setup(__props, { emit: __emit }) {

// 字段管理(动态字段/备用列池):仅管理员;列表/表单/查询/导出由元数据引擎自动获得新字段。
// 规格见 docs/design/动态字段扩展-备用列池-V1.0.md §10;入口由 PanelxList「更多 ▼」注入。
const props = __props;
const emit = __emit;
const loading = ref(false);
const saving = ref(false);
const data = ref({ capacity: 20, fields: [], linePool: [] });
const form = ref({ label: '', labelEn: '', dataType: '文本', dictOptions: '', place: 'detail', inQuery: false, width: 120, required: false, confirmDirty: false, tab: '', parent: '' });
/** 需要指定「所属页签」的面板:传了 tabs 就是 */
const needTab = () => Array.isArray(props.tabs) && props.tabs.length > 0;
const blankForm = () => ({ label: '', labelEn: '', dataType: '文本', dictOptions: '', place: 'detail', inQuery: false, width: 120, required: false, confirmDirty: false, tab: needTab() ? (props.defaultTab || props.tabs[0].value) : '', parent: '' });
/** 当前所选页签的父字段候选 */
const parentOptions = computed(() => (needTab() && props.parentOptionsOf ? props.parentOptionsOf(form.value.tab) || [] : []));
/** 父字段下拉没有候选(该表还没任何分组名)—— 提示"直接输入一个新名字即可新建" */
const parentEmptyHint = computed(() => needTab() && parentOptions.value.length === 0);
/** 字段列表**只显示当前所选页签自己的**自定义字段(用户口径 2026-10-04:切页签要显示他自己的页面的自定义字段)。
 *  归属判据与 @core/qc/qcInspReqCols 同一口径:严格按 tab 比(分页签面板绑定必填所属页签)。 */
const visibleFields = computed(() => {
  const all = Array.isArray(data.value?.fields) ? data.value.fields : [];
  if (!needTab()) return all
  const cur = String(form.value.tab || '').trim();
  return all.filter((f) => String(f.tab || '').trim() === cur)
});
/** 各页签用量一览(切页签前也能看到别的表用了多少) */
const tabUsage = computed(() => {
  const tp = data.value?.tabPools;
  if (!tp || !needTab()) return []
  return props.tabs.map((t) => ({ tab: t.value, label: t.label, used: tp[t.value]?.used ?? 0, capacity: tp[t.value]?.capacity ?? 20 }))
});
/** 当前所选页签的扩展池用量(每表 20 个:后端 tabPools 按页签给账) */
const tabPool = computed(() => {
  const tp = data.value?.tabPools;
  if (!tp || !needTab()) return null
  return tp[form.value.tab] || null
});

watch(() => props.modelValue, (v) => { if (v) { form.value = blankForm(); load(); } });

async function load() {
  loading.value = true;
  try {
    data.value = await extFieldOverview(props.panelCode);
  } catch (e) {
    ElMessage.error(String(e?.message || e));
    emit('update:modelValue', false);
  } finally { loading.value = false; }
}

function usedOf(pool) { return (pool || []).filter((p) => p.bound).length }

async function submit() {
  saving.value = true;
  try {
    const payload = { ...form.value, panel: props.panelCode };
    const res = await extFieldAdd(payload);
    ElMessage.success(tt('字段已添加') + ':' + res.colName);
    form.value = blankForm();
    await load();
    emit('done');
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || String(e);
    if (String(msg).includes('历史数据') && !form.value.confirmDirty) {
      try {
        await ElMessageBox.confirm(msg + tt('。确认绑定该列?(数据将保留,与新字段同显)'), tt('占用列含历史数据'), { type: 'warning' });
        form.value.confirmDirty = true;
        return submit()
      } catch { return }
    }
    ElMessage.error(msg);
  } finally { saving.value = false; }
}

async function retire(f) {
  try {
    await ElMessageBox.confirm(tt('停用字段「') + f.label + tt('」?已录入数据将保留,重新绑定同名标签即可恢复显示。'), tt('停用字段'), { type: 'warning' });
  } catch { return }
  try {
    await extFieldRetire({ panel: props.panelCode, fieldId: f.id });
    ElMessage.success(tt('已停用'));
    await load();
    emit('done');
  } catch (e) { ElMessage.error(e?.response?.data?.message || String(e)); }
}

return (_ctx, _cache) => {
  const _component_el_table_column = ElTableColumn;
  const _component_el_button = ElButton;
  const _component_el_table = ElTable;
  const _component_el_divider = ElDivider;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_tooltip = ElTooltip;
  const _component_el_form_item = ElFormItem;
  const _component_el_input = ElInput;
  const _component_el_radio = ElRadio;
  const _component_el_radio_group = ElRadioGroup;
  const _component_el_switch = ElSwitch;
  const _component_el_input_number = ElInputNumber;
  const _component_el_form = ElForm;
  const _component_el_dialog = ElDialog;
  const _directive_loading = vLoading;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: unref(tt)('字段管理'),
    width: "640px",
    "append-to-body": "",
    "close-on-click-modal": false,
    "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => (emit('update:modelValue', $event)))
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, {
        onClick: _cache[11] || (_cache[11] = $event => (emit('update:modelValue', false)))
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
        ]),
        _: 1
      }),
      createVNode(_component_el_button, {
        type: "primary",
        loading: saving.value,
        onClick: submit
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('添加')), 1)
        ]),
        _: 1
      }, 8, ["loading"])
    ]),
    default: withCtx(() => [
      withDirectives((openBlock(), createElementBlock("div", null, [
        createBaseVNode("div", _hoisted_1$e, [
          createTextVNode(toDisplayString(unref(tt)('动态字段')) + " " + toDisplayString(visibleFields.value.length) + " ", 1),
          (data.value.tabPools)
            ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                createTextVNode(" · " + toDisplayString(unref(tt)('每张表各 20 个扩展位')) + " · " + toDisplayString(unref(tt)('本表已用')) + " ", 1),
                createBaseVNode("b", null, toDisplayString(tabPool.value ? tabPool.value.used : 0), 1),
                createTextVNode("/" + toDisplayString(data.value.capacity), 1)
              ], 64))
            : (data.value.headPool)
              ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                  createTextVNode(" / " + toDisplayString(data.value.capacity) + " · " + toDisplayString(unref(tt)('表头池')) + " " + toDisplayString(usedOf(data.value.headPool)) + "/" + toDisplayString((data.value.headPool || []).length) + " · " + toDisplayString(unref(tt)('明细池')) + " " + toDisplayString(usedOf(data.value.linePool)) + "/" + toDisplayString((data.value.linePool || []).length), 1)
                ], 64))
              : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                  createTextVNode(" / " + toDisplayString(data.value.capacity) + " · " + toDisplayString(unref(tt)('池')) + " " + toDisplayString(usedOf(data.value.linePool)) + "/" + toDisplayString((data.value.linePool || []).length), 1)
                ], 64))
        ]),
        (tabUsage.value.length)
          ? (openBlock(), createElementBlock("div", _hoisted_2$e, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(tabUsage.value, (u) => {
                return (openBlock(), createElementBlock("span", {
                  key: u.tab,
                  class: normalizeClass(["fm-tabusage-item", { cur: u.tab === form.value.tab }])
                }, toDisplayString(unref(tt)(u.label)) + " " + toDisplayString(u.used) + "/" + toDisplayString(u.capacity), 3))
              }), 128))
            ]))
          : createCommentVNode("", true),
        createVNode(_component_el_table, {
          data: visibleFields.value,
          size: "small",
          "max-height": "200"
        }, {
          empty: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('这张表还没有自定义列')), 1)
          ]),
          default: withCtx(() => [
            createVNode(_component_el_table_column, {
              prop: "label",
              label: unref(tt)('字段名'),
              "min-width": "140"
            }, null, 8, ["label"]),
            (needTab())
              ? (openBlock(), createBlock(_component_el_table_column, {
                  key: 0,
                  prop: "tab",
                  label: unref(tt)('所属页签'),
                  width: "130"
                }, null, 8, ["label"]))
              : createCommentVNode("", true),
            (needTab())
              ? (openBlock(), createBlock(_component_el_table_column, {
                  key: 1,
                  prop: "parent",
                  label: unref(tt)('父字段(分组)'),
                  width: "120"
                }, null, 8, ["label"]))
              : createCommentVNode("", true),
            createVNode(_component_el_table_column, {
              prop: "col",
              label: unref(tt)('承载列'),
              width: "90"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "dataType",
              label: unref(tt)('类型'),
              width: "80"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "place",
              label: unref(tt)('位置'),
              width: "120"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              label: unref(tt)('操作'),
              width: "80"
            }, {
              default: withCtx(({ row }) => [
                createVNode(_component_el_button, {
                  link: "",
                  type: "danger",
                  size: "small",
                  onClick: $event => (retire(row))
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('停用')), 1)
                  ]),
                  _: 1
                }, 8, ["onClick"])
              ]),
              _: 1
            }, 8, ["label"])
          ]),
          _: 1
        }, 8, ["data"]),
        createVNode(_component_el_divider, { "content-position": "left" }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('新增字段')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_form, {
          model: form.value,
          "label-width": "90px",
          size: "small",
          onSubmit: _cache[10] || (_cache[10] = withModifiers(() => {}, ["prevent"]))
        }, {
          default: withCtx(() => [
            (needTab())
              ? (openBlock(), createBlock(_component_el_form_item, {
                  key: 0,
                  label: unref(tt)('所属页签')
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_select, {
                      modelValue: form.value.tab,
                      "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((form.value.tab) = $event)),
                      style: {"width":"220px"}
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(__props.tabs, (t) => {
                          return (openBlock(), createBlock(_component_el_option, {
                            key: t.value,
                            label: unref(tt)(t.label),
                            value: t.value
                          }, null, 8, ["label", "value"]))
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue"]),
                    createVNode(_component_el_tooltip, {
                      content: unref(tt)('该列只出现在这张表里;检验数据记录带入时也按这张表的列走'),
                      placement: "top"
                    }, {
                      default: withCtx(() => [...(_cache[13] || (_cache[13] = [
                        createBaseVNode("span", { class: "fm-help" }, "?", -1)
                      ]))]),
                      _: 1
                    }, 8, ["content"])
                  ]),
                  _: 1
                }, 8, ["label"]))
              : createCommentVNode("", true),
            createVNode(_component_el_form_item, {
              label: unref(tt)('字段名')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: form.value.label,
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((form.value.label) = $event)),
                  placeholder: unref(tt)('中文,禁 . % / ( ) 空格'),
                  maxlength: "60"
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            (needTab())
              ? (openBlock(), createBlock(_component_el_form_item, {
                  key: 1,
                  label: unref(tt)('父字段(分组)')
                }, {
                  default: withCtx(() => [
                    createBaseVNode("div", _hoisted_3$e, [
                      createVNode(_component_el_select, {
                        modelValue: form.value.parent,
                        "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((form.value.parent) = $event)),
                        style: {"width":"220px"},
                        filterable: "",
                        clearable: "",
                        "allow-create": "",
                        "default-first-option": "",
                        placeholder: unref(tt)('留空=独立列;可直接输入新分组名')
                      }, {
                        default: withCtx(() => [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(parentOptions.value, (p) => {
                            return (openBlock(), createBlock(_component_el_option, {
                              key: p,
                              label: unref(tt)(p),
                              value: p
                            }, null, 8, ["label", "value"]))
                          }), 128))
                        ]),
                        _: 1
                      }, 8, ["modelValue", "placeholder"]),
                      (parentEmptyHint.value)
                        ? (openBlock(), createElementBlock("span", _hoisted_4$e, toDisplayString(unref(tt)('该表还没有分组名：直接输入一个名字（回车）即可新建')), 1))
                        : createCommentVNode("", true)
                    ]),
                    createVNode(_component_el_tooltip, {
                      content: unref(tt)('父只做表头分组、没有数据格;检验数据记录只带入子字段'),
                      placement: "top"
                    }, {
                      default: withCtx(() => [...(_cache[14] || (_cache[14] = [
                        createBaseVNode("span", { class: "fm-help" }, "?", -1)
                      ]))]),
                      _: 1
                    }, 8, ["content"])
                  ]),
                  _: 1
                }, 8, ["label"]))
              : createCommentVNode("", true),
            createVNode(_component_el_form_item, {
              label: unref(tt)('英文名')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: form.value.labelEn,
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((form.value.labelEn) = $event)),
                  maxlength: "60"
                }, null, 8, ["modelValue"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('类型')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_select, {
                  modelValue: form.value.dataType,
                  "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((form.value.dataType) = $event)),
                  style: {"width":"160px"}
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_option, {
                      label: "文本",
                      value: "文本"
                    }),
                    createVNode(_component_el_option, {
                      label: "下拉框",
                      value: "下拉框"
                    }),
                    createVNode(_component_el_option, {
                      label: "日期",
                      value: "日期"
                    }),
                    createVNode(_component_el_option, {
                      label: "是否",
                      value: "是否"
                    })
                  ]),
                  _: 1
                }, 8, ["modelValue"]),
                createVNode(_component_el_tooltip, {
                  content: unref(tt)('日期按 ISO 文本存储,排序正确;数值型请走正式迁移(需合计/排序精度)'),
                  placement: "top"
                }, {
                  default: withCtx(() => [...(_cache[15] || (_cache[15] = [
                    createBaseVNode("span", { class: "fm-help" }, "?", -1)
                  ]))]),
                  _: 1
                }, 8, ["content"])
              ]),
              _: 1
            }, 8, ["label"]),
            (form.value.dataType === '下拉框')
              ? (openBlock(), createBlock(_component_el_form_item, {
                  key: 2,
                  label: unref(tt)('词表')
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_input, {
                      modelValue: form.value.dictOptions,
                      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((form.value.dictOptions) = $event)),
                      placeholder: unref(tt)('逗号分隔,如: 是,否,待定')
                    }, null, 8, ["modelValue", "placeholder"])
                  ]),
                  _: 1
                }, 8, ["label"]))
              : createCommentVNode("", true),
            (data.value.headPool)
              ? (openBlock(), createBlock(_component_el_form_item, {
                  key: 3,
                  label: unref(tt)('位置')
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_radio_group, {
                      modelValue: form.value.place,
                      "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((form.value.place) = $event))
                    }, {
                      default: withCtx(() => [
                        createVNode(_component_el_radio, { value: "detail" }, {
                          default: withCtx(() => [
                            createTextVNode(toDisplayString(unref(tt)('明细行')), 1)
                          ]),
                          _: 1
                        }),
                        createVNode(_component_el_radio, { value: "header" }, {
                          default: withCtx(() => [
                            createTextVNode(toDisplayString(unref(tt)('表头')), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }, 8, ["modelValue"])
                  ]),
                  _: 1
                }, 8, ["label"]))
              : createCommentVNode("", true),
            createVNode(_component_el_form_item, {
              label: unref(tt)('进查询区')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_switch, {
                  modelValue: form.value.inQuery,
                  "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((form.value.inQuery) = $event))
                }, null, 8, ["modelValue"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('必填')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_switch, {
                  modelValue: form.value.required,
                  "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((form.value.required) = $event))
                }, null, 8, ["modelValue"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('列宽')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input_number, {
                  modelValue: form.value.width,
                  "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((form.value.width) = $event)),
                  min: 60,
                  max: 400
                }, null, 8, ["modelValue"])
              ]),
              _: 1
            }, 8, ["label"])
          ]),
          _: 1
        }, 8, ["model"])
      ])), [
        [_directive_loading, loading.value]
      ])
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const FieldManagerDialog = /*#__PURE__*/_export_sfc(_sfc_main$e, [['__scopeId',"data-v-55b961dd"]]);

/**
 * 表格排序比较器(纯函数,无 Vue 依赖)。
 * 口径(2026-09-09 通用规则,明细/主表/报表现共用):
 *  - 字段类型优先(yj_field.dataType):整数/小数/数字 → 按数值;日期/日期时间 → 按时间;
 *    其余(文本/下拉框/参照/是否) → zh-CN 排序(中文=拼音序)。同列一个口径,不逐值猜测。
 *  - 空值(空串/null/undefined)升序降序都排最后。
 *  - 返回排序副本、稳定排序,不改动入参数组、不改行数据(调用方只换渲染顺序)。
 *  - 未提供字段元数据时沿用旧口径(两侧都能当数字才按数字),兼容既有报表调用。
 */

const NUMERIC_TYPES = new Set(['整数', '小数', '数字']);
const DATE_TYPES = new Set(['日期', '日期时间']);

/** 空值判定:null/undefined/空串(纯空白同空) */
function isBlankValue(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

/** 数值解析:容忍千分位逗号、空白与百分号;解析不出返回 null */
function toNumber(value) {
  const text = String(value).replace(/[,\s]/g, '').replace(/%$/, '');
  if (text === '') return null
  const num = Number(text);
  return Number.isFinite(num) ? num : null
}

/** 时间解析:兼容 2026-09-09 / 2026/9/9 / 带T的 ISO / 带时分秒;解析不出返回 null */
function toTime(value) {
  const text = String(value).trim().replace(/\//g, '-').replace('T', ' ');
  const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0))
}

/** 中文/通用文本比较:zh-CN 排序规则(中文按拼音,英文按字母) */
function compareText(a, b) {
  return String(a).localeCompare(String(b), 'zh-CN')
}

/** 单列比较:类型决定口径,同列一致 */
function compareByField(field, a, b) {
  const type = field && field.dataType ? String(field.dataType) : '';
  if (NUMERIC_TYPES.has(type)) {
    const na = toNumber(a);
    const nb = toNumber(b);
    return na !== null && nb !== null ? na - nb : compareText(a, b)
  }
  if (DATE_TYPES.has(type)) {
    const ta = toTime(a);
    const tb = toTime(b);
    return ta !== null && tb !== null ? ta - tb : compareText(a, b)
  }
  if (type) return compareText(a, b)
  // 无字段元数据:沿用旧报表口径(两侧都能当数字才按数字)
  const na = toNumber(a);
  const nb = toNumber(b);
  return na !== null && nb !== null ? na - nb : compareText(a, b)
}

/**
 * 行排序。行整体移动(字段随行走),字段对位不变。
 * @param {Object[]} rows 原始行(不被修改)
 * @param {{prop:string, order:'asc'|'desc'|'', field?:Object}} sort 排序配置
 * @returns {Object[]} 排序后的新数组(order 为空时返回原顺序副本)
 */
function sortRows(rows = [], sort = {}) {
  const out = [...rows];
  const prop = sort ? sort.prop : '';
  const order = sort ? sort.order : '';
  if (!prop || (order !== 'asc' && order !== 'desc')) return out
  const field = sort ? sort.field : null;
  const dir = order === 'asc' ? 1 : -1;
  return out
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = left.row ? left.row[prop] : undefined;
      const b = right.row ? right.row[prop] : undefined;
      const blankA = isBlankValue(a);
      const blankB = isBlankValue(b);
      if (blankA || blankB) {
        if (blankA && blankB) return left.index - right.index
        return blankA ? 1 : -1 // 空值恒排最后
      }
      const result = compareByField(field, a, b);
      return result !== 0 ? result * dir : left.index - right.index
    })
    .map((item) => item.row)
}

/**
 * 表头点击循环:升 → 降 → 取消。点别的列时由调用方传入新列(单键排序,覆盖前一列)。
 * @returns {{prop:string, order:string}} 下一个排序状态
 */
function nextSortState(current, prop) {
  if (!prop) return { prop: '', order: '' }
  if (!current || current.prop !== prop || !current.order) return { prop, order: 'asc' }
  if (current.order === 'asc') return { prop, order: 'desc' }
  return { prop: '', order: '' }
}

/**
 * 报表栏目设置纯函数层(报表表头筛选与排序补丁)。
 * 无 Vue 依赖,可被 composable 与单元测试共用。
 */


/**
 * 构建栏目设置数组。
 * @param {string[]} columns - 面板全部字段名列表
 * @param {Object|null} saved - 后端保存的设置
 * @returns {{prop:string, label:string, visible:boolean}[]}
 */
function buildReportColumnSettings(columns = [], saved = null) {
  const savedByProp = new Map((saved?.columns || []).map((column) => [column.prop, column]));
  return columns.map((prop) => ({
    prop,
    label: savedByProp.get(prop)?.label || prop,
    visible: savedByProp.has(prop) ? savedByProp.get(prop).visible : true
  }))
}

/**
 * 过滤出可见列。
 * @param {{prop:string, visible:boolean}[]} settings
 * @returns {string[]}
 */
function visibleReportColumns(settings = []) {
  return settings.filter((column) => column.visible).map((column) => column.prop)
}

/**
 * 排序数据行。2026-09-09 起与表格面板共用同一套类型化比较器
 * (core/sort/rowSort:字段类型优先 → 数值/时间/拼音,空值恒最后)。
 * 未传字段元数据时沿用旧口径(两侧都能当数字才按数字),历史调用与单测语义不变。
 * @param {Object[]} rows - 原始数据行
 * @param {{prop:string, order:string, field?:Object}} sort - 排序配置
 * @returns {Object[]}
 */
function sortReportRows(rows = [], sort = {}) {
  return sortRows(rows, sort)
}

/**
 * 通用报表栏目 composable(报表表头筛选与排序补丁)。
 * 任何组件调用即可获得栏目显隐、表头筛选、升序降序、后端持久化能力。
 *
 * @param {Ref<string>} panelCode - 当前面板编码
 * @param {ComputedRef<string[]>} columns - 当前报表全部字段名列表
 * @param {ComputedRef<Object[]>} rows - 当前报表原始数据行
 */
function useReportColumns(panelCode, columns, rows) {
  // ---- 状态 ----
  const columnVisible = ref(false);     // 栏目设置弹窗显示状态
  const columnDraft = ref([]);           // 栏目设置弹窗的编辑副本
  const columnCurrent = ref(null);       // 栏目弹窗当前选中行
  const sort = reactive({ prop: '', order: '' });  // 排序状态
  const headerFilters = reactive({});    // 表头筛选状态 {字段名: 已选值数组}
  const serverSaved = ref(null);         // 后端返回的已保存设置
  const settingsLoaded = ref(false);     // 是否已从后端加载
  const filterVisible = ref(false);      // 表头筛选面板显示状态
  const filterProp = ref('');            // 当前筛选的字段名

  // ---- 后端持久化 ----

  async function loadSaved() {
    if (settingsLoaded.value) return serverSaved.value
    try {
      const res = await request.get(`/px/reportColumnSettings`, {
        params: { panelCode: panelCode.value }
      });
      const data = res?.data ?? res;
      serverSaved.value = data && Object.keys(data).length ? data : null;
    } catch { serverSaved.value = null; }
    settingsLoaded.value = true;
    return serverSaved.value
  }

  function applySaved(saved) {
    if (!saved) return
    columnDraft.value = buildReportColumnSettings(columns.value, saved);
    sort.prop = saved?.sort?.prop || '';
    sort.order = saved?.sort?.order || '';
  }

  // ---- 计算属性 ----

  /** 可见列的 prop 列表(弹窗未打开过时回落到全部列) */
  const visibleProps = computed(() => {
    return columnDraft.value.length
      ? visibleReportColumns(columnDraft.value)
      : columns.value
  });

  /** 按表头筛选条件过滤后的行 */
  const filteredRows = computed(() => {
    const entries = Object.entries(headerFilters)
      .filter(([, values]) => Array.isArray(values) && values.length);
    if (!entries.length) return rows.value
    return rows.value.filter((row) =>
      entries.every(([prop, values]) => values.includes(row[prop] ?? ''))
    )
  });

  /** 筛选后再排序的最终数据 */
  const sortedRows = computed(() => sortReportRows(filteredRows.value, sort));

  /** 弹窗中勾选的可见列数量 */
  const selectedCount = computed(() =>
    columnDraft.value.filter((column) => column.visible).length
  );

  // ---- 操作函数 ----

  /** 获取某列的去重值列表(用于筛选面板) */
  function distinctValues(prop) {
    const values = new Set(rows.value.map((row) => row[prop] ?? ''));
    return [...values].sort((l, r) => String(l).localeCompare(String(r), 'zh-CN'))
  }

  /** 判断某列是否已设置筛选 */
  function isFiltered(prop) {
    return Array.isArray(headerFilters[prop]) && headerFilters[prop].length > 0
  }

  /** 清除某列筛选 */
  function clearFilter(prop) { headerFilters[prop] = []; }

  /** 设置排序(表头图标点击) */
  function setSort(prop, order) { sort.prop = prop; sort.order = order; }

  /** 打开某列的筛选面板 */
  function openFilter(prop) {
    if (!Array.isArray(headerFilters[prop])) headerFilters[prop] = [];
    filterProp.value = prop;
    filterVisible.value = true;
  }

  function applyFilter() { filterVisible.value = false; }

  /** 打开栏目设置弹窗(从后端加载已保存设置) */
  async function openDialog() {
    const saved = await loadSaved();
    applySaved(saved);
    columnCurrent.value = null;
    columnVisible.value = true;
  }

  /** 保存栏目设置到后端 */
  async function saveDialog() {
    const settings = { columns: columnDraft.value, sort: { ...sort } };
    try {
      await request.post('/px/reportColumnSettings', {
        panelCode: panelCode.value, settings
      });
    } catch { /* 保存失败不阻断本地效果 */ }
    columnVisible.value = false;
    columnCurrent.value = null;
  }

  /** 取消栏目设置(不保存) */
  function cancelDialog() {
    columnVisible.value = false;
    columnDraft.value = [];
    columnCurrent.value = null;
  }

  // 面板切换时重置状态
  watch(panelCode, () => {
    columnDraft.value = [];
    sort.prop = '';
    sort.order = '';
    serverSaved.value = null;
    settingsLoaded.value = false;
    Object.keys(headerFilters).forEach((key) => delete headerFilters[key]);
  });

  return {
    columnVisible, columnDraft, columnCurrent,
    sort, headerFilters,
    visibleProps, sortedRows, selectedCount,
    distinctValues, isFiltered, clearFilter, setSort,
    openDialog, saveDialog, cancelDialog,
    filterVisible, filterProp, openFilter, applyFilter,
  }
}

/**
 * 文书侧栏「模糊搜索」条件构建(纯函数,无 Vue 依赖)。
 * 把「字段 + 内容」条件行翻译成后端 queryFormDataList 的入参:
 *  - 具体字段 → condition[字段] = 内容,后端按 LIKE '%内容%' 匹配
 *    (表头字段打到单头表;明细字段走 EXISTS 行匹配,任一明细行命中即算命中该单据)
 *  - 「全部字段」→ keyword,后端在表头+明细全部字段上 OR 模糊
 *  - 多条件由后端自动 AND(即"精准搜索")
 *  - 空行忽略;同一字段填多行时后一行覆盖前一行(条件表是 key-value,同字段无法并存两条)
 */

/** 字段下拉里的「全部字段」选项值(与真实字段名不会冲突) */
const ALL_FIELDS = '__all__';

/**
 * @param {{field:string, value:string}[]} rows 条件行
 * @returns {{condition:Object, keyword:string, valid:boolean}}
 */
function buildFuzzyQuery(rows = []) {
  const condition = {};
  let keyword = '';
  for (const row of rows || []) {
    const field = row && row.field ? String(row.field).trim() : '';
    const value = row && row.value !== null && row.value !== undefined ? String(row.value).trim() : '';
    if (!field || !value) continue
    if (field === ALL_FIELDS) {
      keyword = value;
      continue
    }
    condition[field] = value;
  }
  return { condition, keyword, valid: !!keyword || Object.keys(condition).length > 0 }
}

/**
 * prodDocSearch.js — 产品文件列表(RD_PROD_DOCLIST)**矩阵行**的搜索口径(纯函数)。
 *
 * 【为什么需要它】该面板是「单单据 + 矩阵」:库里只有 1 张单据(PDL-0001),
 * 真正的内容是表格里的**产品行**(产品编号 × 4 个文件 × 状态)。侧栏的
 * 「模糊搜索 / 查询单据 / 单据预览」原先都是对那 1 张单据做**文档查询** ——
 * 于是用户看到的就是「搜索在这个面板不可用」(2026-09-30 用户反馈)。
 * 现在这三个入口在该面板改为**对矩阵行筛选**(客户端,不跑单据查询),判定集中在这里。
 *
 * 字段口径(与界面上那个字段下拉一一对应):
 *   · 产品编号 / 是否受控 / 受控日期 → 该列内容包含关键字(忽略大小写)
 *   · 状态（任一文件）               → 4 个文件里**任一**状态包含关键字
 *                                     (填「未开发」= 找还有文件没做的产品)
 *   · 任意字段(ALL_FIELDS)           → 以上任一命中即算命中
 * 多条件 AND;同字段多行时后一行覆盖前一行(与文书侧栏 buildFuzzyQuery 同口径)。
 */

/** 「状态（任一文件）」这个虚拟字段名(不是表列,是横跨 4 个状态格的检索口径) */
const PROD_DOC_STATUS_FIELD = '状态（任一文件）';

/** 字段下拉顺序(产品编号在最前:设计原表就写着「可通过产品编号直接搜索」) */
const PROD_DOC_FIELD_OPTIONS = ['产品编号', '是否受控', '受控日期', PROD_DOC_STATUS_FIELD];

/** 单元格 → 可比文本 */
function txt(v) {
  return v === undefined || v === null ? '' : String(v)
}

/** a 是否包含 b(忽略大小写) */
function has(a, b) {
  const s = txt(a).toLowerCase();
  const k = txt(b).toLowerCase().trim();
  return !!k && s.includes(k)
}

/** 某行某面板的状态(与 ProdDocListSheet.statusOf 同口径) */
function statusOf(row, col) {
  const cells = row && row.cells ? row.cells : null;
  if (!cells) return ''
  const v = cells[col.panelCode];
  return v === undefined || v === null ? '' : String(v)
}

/**
 * 条件行(字段+内容)→ 生效条件。空行忽略;有值即 valid;同字段后者覆盖前者。
 * @param {{field:string,value:string}[]} rows
 * @returns {{conditions:{field:string,value:string}[], valid:boolean}}
 */
function buildProdDocFilter(rows = []) {
  const byField = new Map();
  for (const r of rows || []) {
    const field = r && r.field ? String(r.field).trim() : '';
    const value = r && r.value !== undefined && r.value !== null ? String(r.value).trim() : '';
    if (!field || !value) continue
    byField.set(field, value); // 同字段后者覆盖前者
  }
  const conditions = [...byField.entries()].map(([field, value]) => ({ field, value }));
  return { conditions, valid: conditions.length > 0 }
}

/** 单行是否命中全部条件(AND) */
function matchProdDocRow(row, columns, filter) {
  const conds = filter && Array.isArray(filter.conditions) ? filter.conditions : [];
  if (!conds.length) return true
  const cols = Array.isArray(columns) ? columns : [];
  return conds.every(({ field, value }) => {
    if (field === PROD_DOC_STATUS_FIELD) return cols.some((c) => has(statusOf(row, c), value))
    if (field === ALL_FIELDS) {
      return has(row?.产品编号, value)
        || has(row?.['是否受控'], value)
        || has(row?.['受控日期'], value)
        || cols.some((c) => has(statusOf(row, c), value))
    }
    return has(row?.[field], value)
  })
}

/**
 * 按条件过滤矩阵行。**没有生效条件时原样返回**(不是清空)。
 * @param {object[]} rows
 * @param {{panelCode:string,panelName:string}[]} columns
 * @param {{conditions:{field:string,value:string}[], valid:boolean}|null} filter
 */
function filterProdDocRows(rows, columns, filter) {
  const list = Array.isArray(rows) ? rows : [];
  if (!filter || !filter.valid) return list
  return list.filter((r) => matchProdDocRow(r, columns, filter))
}

/**
 * 分批送料对话框的「生单行」构造(纯函数 —— 便于 node --test 直接单测,不需要浏览器)。
 *
 * 用户报的缺陷(2026-09-21):
 *   「生单勾选明细时,只勾选一条生成也会变成全部生单。」
 * 病根:对话框把**勾选**和**本次送料量**两套信号混在一起 ——
 *   ① load() 给**每一行**都预填了「本次送料量 = 剩余量」;
 *   ② confirm() 只按 `qty > 0` 过滤,`picked`(勾选)收下来却**从未使用**。
 *   ⇒ 只勾一行,提交的仍是全部行(所有行 qty 都 > 0)。
 *
 * 修法(用户口径):**勾选是权威** ——
 *   · 只有"被勾选 且 本次送料量 > 0"的行才进入生单 payload;
 *   · 勾选/取消勾选只影响是否提交,不吞掉用户已填的数量(取消后重勾还能用);
 *   · 打开对话框时默认勾选"有剩余的行"(保留"打开即可全送"的便利),
 *     「按剩余量填充/清空」= 全选/全不选。
 *
 * 台账/后端契约不变:`lines = [{lineKey, qty}]`,后端只按 qty>0 的行生成
 * (PushGenerateHandler.generateBatch),所以这里**必须**先把未勾选的行滤掉。
 */

/** 勾选项 → lineKey 集合(组件里 picked 是 el-table 的选中行数组;也接受 lineKey 字符串数组) */
function pickedKeySet(picked = []) {
  return new Set((picked || []).map((r) => (typeof r === 'string' ? r : r && r.lineKey)).filter(Boolean))
}

/** 默认勾选范围:还有剩余可送的行(lineKey 升序保持表格顺序) */
function defaultPickKeys(rows = []) {
  return (rows || []).filter((r) => Number(r?.剩余数量 || 0) > 0).map((r) => r.lineKey)
}

/**
 * 生单 payload 行:仅"已勾选 且 数量 > 0"。
 * @param {Array} rows       对话框表格行(含 lineKey/剩余数量)
 * @param {Set|Array} picked 勾选项(lineKey 集合,或行数组)
 * @param {object} qtyOf     本次送料量:{ [lineKey]: number }
 */
function buildBatchSendLines(rows = [], picked = [], qtyOf = {}) {
  const keys = picked instanceof Set ? picked : pickedKeySet(picked);
  const out = [];
  for (const r of rows || []) {
    const key = r?.lineKey;
    if (!key || !keys.has(key)) continue          // ← 未勾选:不送(本次修复的核心)
    const qty = Number(qtyOf?.[key] ?? 0);
    if (!(qty > 0)) continue                      // 勾了但没填量:视为不送
    out.push({ lineKey: key, qty });
  }
  return out
}

/** 本次合计:只算**已勾选**的行(未勾选行即使填了量也不计入,否则合计与生单结果不符) */
function sumPickedQty(rows = [], picked = [], qtyOf = {}) {
  const keys = picked instanceof Set ? picked : pickedKeySet(picked);
  let sum = 0;
  for (const r of rows || []) {
    const key = r?.lineKey;
    if (!key || !keys.has(key)) continue
    sum += Number(qtyOf?.[key] ?? 0) || 0;
  }
  return Math.round(sum * 100) / 100
}

/**
 * 分批送料「可送上限」(2026-09-22 口径):**按全部数量算** ——
 *   订单数量 ×(1 + 超送比例)− 已送 + 已退回,负数归 0;
 *   超送比例给百分数(0~50,超出按 50 钳制 —— 用户口径:超送最高 50%)。
 * 旧口径 剩余×(1+比例) 的问题:每批只给"当批剩余"的比例额,分批越多超送额度越算越少,
 * 累计超送永远到不了订单总量的比例额;正确语义是"整张订单行累计最多收 数量×(1+比例)"。
 */
function overAllowance(orderQty, sent, returned, ratioPct = 0) {
  const r = Math.max(0, Math.min(50, Number(ratioPct) || 0)) / 100;
  const v = Number(orderQty || 0) * (1 + r) - Number(sent || 0) + Number(returned || 0);
  return v > 0 ? Math.round(v * 100) / 100 : 0
}

/* unplugin-vue-components disabled */

const _hoisted_1$d = { class: "bsd" };
const _hoisted_2$d = { class: "bsd-bar" };
const _hoisted_3$d = { class: "bsd-chip" };
const _hoisted_4$d = { class: "bsd-chip bsd-batch" };
const _hoisted_5$d = {
  key: 1,
  class: "bsd-batch-lock"
};
const _hoisted_6$d = { class: "bsd-chip bsd-ratio" };
const _hoisted_7$c = { class: "bsd-ratio-tip" };
const _hoisted_8$b = {
  key: 0,
  class: "bsd-ratio-tip"
};
const _hoisted_9$9 = {
  key: 1,
  class: "bsd-ratio-saved"
};
const _hoisted_10$9 = {
  key: 0,
  class: "bsd-chip"
};
const _hoisted_11$9 = ["title"];
const _hoisted_12$9 = { class: "bsd-foot" };
const _hoisted_13$9 = { class: "bsd-tip" };
const _hoisted_14$9 = {
  key: 0,
  class: "bsd-printed"
};
const _hoisted_15$8 = { class: "bsd-printed-title" };
const _hoisted_16$8 = { class: "bsd-tip" };


const _sfc_main$d = {
  __name: 'BatchSendDialog',
  props: {
  modelValue: { type: Boolean, default: false },
  sourcePanel: { type: String, default: '' },
  targetPanel: { type: String, default: '' },
  sourceNo: { type: String, default: '' },
},
  emits: ['update:modelValue', 'generated'],
  setup(__props, { emit: __emit }) {

const engine = usePanelRuntime();

const props = __props;
const emit = __emit;

const loading = ref(false);
const saving = ref(false);
/** 服务端给的**全部**候选行(原行 + 已打印隔离行);下面按 rowKind 分成上下两层 */
const allRows = ref([]);
const tableRef = ref(null);
const picked = ref([]);         // 上层(原行)勾选 —— el-table 当前勾选的行(生单只认它,2026-09-21 修复"只勾一行却全送")
const overRatio = ref(0);       // 系统默认比例(0~1)
const overRatioPct = ref(5);    // 本次生效比例(%):可调,生单时随请求带给后端
const batches = ref([]);
/** 本批批次号:服务端按「供应商编码去 YJ- 前缀 + 当天」预填(与生单同源),**可人工改** */
const nextBatchNo = ref('');
const batchNo = ref('');
/** 两层共用一个「本次送料数量」映射:行键唯一(隔离行是 `...#行id@打印行id`),不会撞 */
const qtyOf = reactive({});

/* ── 已打印隔离行(2026-10-04 材料码):上下两层 —— 上层原行、下层已打印行 ──
   用户口径「打印后的那一行是已经从原来数量隔离出来的,没有作废之前是不会与生单有关联的」:
   上层原行的「数量」已扣掉打印量,已打印的量在**下层**自成一行,只能显式勾它才会被生单;
   用它生单后该行仍在下层、标「已生单」(剩余=0)且勾选框禁用。 */
const printedRef = ref(null);
/** 上层:采购订单原行(数量已切走打印量) */
const rows = computed(() => allRows.value.filter((r) => r.rowKind !== 'printed'));
/** 下层:已打印的隔离行 */
const printedRows = computed(() => allRows.value.filter((r) => r.rowKind === 'printed'));
const printedPicked = ref([]);
/** 下层勾选行涉及的批次号(1 个 ⇒ 顶部批次号锁死为该号;>1 个 ⇒ 按号分组各出一张单) */
const printedBatches = computed(() => [...new Set(
  printedPicked.value.filter((r) => r['批次号']).map((r) => r['批次号']),
)]);
const batchLocked = computed(() => printedBatches.value.length === 1);
// 勾了已打印行 ⇒ 批次号以材料码为准(标签已印在实物上,系统只能服从)
watch(printedBatches, (bs) => { if (bs.length === 1) batchNo.value = bs[0]; });
/** 已生单的隔离行(剩余=0)不允许再勾;其余行照旧 */
function rowSelectable(row) {
  return capOf(row) > 0
}

const pickedKeys = computed(() => new Set(picked.value.map((r) => r.lineKey)));
/** 下层(已打印行)勾选的键 */
const printedKeys = computed(() => new Set(printedPicked.value.map((r) => r.lineKey)));
/** 本次合计:只算**已勾选**的行(两层都算;未勾选行即使填了量也不送,合计必须与生单结果一致) */
const totalQty = computed(() =>
  sumPickedQty(rows.value, pickedKeys.value, qtyOf) + sumPickedQty(printedRows.value, printedKeys.value, qtyOf));
/** 本次生效超送比例(0~1;**最高 50%** —— 2026-09-22 用户口径,超出按 50 算) */
const ratio = computed(() => Math.max(0, Math.min(50, Number(overRatioPct.value) || 0)) / 100);
/** 行的可送上限 = 订单数量×(1+本次比例)−已送+已退回(按**全部数量**算;比例一改即时重算,后端同口径再校验) */
/**
 * 该行「本次送料数量」的上限。
 * · **隔离行**(rowKind='printed'):数量就是**印在标签实物上的定量**,不参与超送 ⇒ 直接用服务端给的
 *   可送上限(= 未生单量)。用本地 overAllowance 会算出 数量×(1+超送比例),比真实上限大,
 *   用户按它填就会被后端拒(实测 50 会显示成 52.5)。
 * · **原行**:数量已由服务端扣掉打印量,本地同公式 overAllowance 与后端逐字一致,
 *   保留本地算法是为了"超送比例输入框一改就即时重算"的预览体验。
 */
function capOf(row) {
  if (row?.rowKind === 'printed') return Math.max(0, Number(row.可送上限 || 0))
  return overAllowance(row.数量, row.已送数量, row.已退回数量, overRatioPct.value)
}
function recompute() {
  // 比例调小后可能低于已填数量 → 收敛到新上限,避免提交时被后端拒
  for (const r of rows.value) {
    const cap = capOf(r);
    if (Number(qtyOf[r.lineKey] || 0) > cap) qtyOf[r.lineKey] = cap;
  }
}

/* ── 超送比例**改完自动保存**(2026-10-04 用户口径「超送应该更改后会自动保存」)─────────────
   存的是**系统参数**(yj_app_setting.receive_over_ratio),所以下次打开按新比例预填、
   后端校验与材料码打印的可打上限也按新比例算 —— 不再是"每次打开都退回 5%"。
   防抖 600ms:数字框敲一下会连着触发几次 change,别把请求打成一串。 */
const ratioSaving = ref(false);
const ratioSaved = ref(false);
let ratioTimer = null;
function onRatioChange() {
  recompute();
  ratioSaved.value = false;
  clearTimeout(ratioTimer);
  ratioTimer = setTimeout(saveRatio, 600);
}
async function saveRatio() {
  ratioSaving.value = true;
  try {
    const res = await engine.batchFlowSaveOverRatio(ratio.value);
    overRatio.value = Number(res?.overRatio ?? ratio.value);
    ratioSaved.value = true;
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('超送比例保存失败'));
  } finally {
    ratioSaving.value = false;
  }
}
onUnmounted(() => clearTimeout(ratioTimer));

async function load() {
  if (!props.sourceNo) return
  loading.value = true;
  try {
    const res = await engine.batchFlowLines({
      sourcePanel: props.sourcePanel, targetPanel: props.targetPanel, sourceNo: props.sourceNo,
    });
    allRows.value = res?.lines || [];
    overRatio.value = Number(res?.overRatio || 0);
    overRatioPct.value = Math.round(overRatio.value * 100);
    batches.value = res?.batches || [];
    nextBatchNo.value = String(res?.nextBatchNo || '');
    batchNo.value = nextBatchNo.value;      // 预填 = 公式算出来的号;用户可在对话框里改
    Object.keys(qtyOf).forEach((k) => delete qtyOf[k]);
    for (const r of allRows.value) qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0;
    // 默认勾选:上层**原行**里有剩余的(保留"打开即可全送"的便利);下层已打印行**默认不勾**
    // (用户口径「打印后的那一行…没有作废之前是不会与生单有关联的」⇒ 必须显式勾)
    await nextTick();
    syncPick(defaultSendKeys());
    printedRef.value?.clearSelection();
    printedPicked.value = [];
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('分批送料数据加载失败'));
  } finally {
    loading.value = false;
  }
}

/** 勾选集合 → **上层**表格勾选态(并同步 picked,避免依赖 selection-change 的时序) */
function syncPick(keys) {
  const set = new Set(keys);
  tableRef.value?.clearSelection();
  picked.value = [];
  for (const r of rows.value) {
    if (!set.has(r.lineKey)) continue
    tableRef.value?.toggleRowSelection(r, true);
  }
  picked.value = rows.value.filter((r) => set.has(r.lineKey));
  prefillNewlyPicked();
}

/** 上层勾选变化:新勾上而"本次送料数量"还是 0 的行按剩余量预填;取消勾选**不吞**已填数量(重勾还能用) */
function onPicked(list) {
  picked.value = list || [];
  prefillNewlyPicked();
}
/** 下层(已打印行)勾选变化:同样按未生单量预填 */
function onPrintedPicked(list) {
  printedPicked.value = list || [];
  for (const r of printedPicked.value) {
    if (Number(qtyOf[r.lineKey] || 0) > 0) continue
    qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0;
  }
}
function prefillNewlyPicked() {
  for (const r of picked.value) {
    if (Number(qtyOf[r.lineKey] || 0) > 0) continue
    qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0;
  }
}

/**
 * 默认勾选的行:**只勾上层原行**(有剩余的),不勾下层已打印行。
 * 用户口径「打印后的那一行…没有作废之前是不会与生单有关联的」⇒ 隔离行必须由用户**显式勾选**才会被生单,
 * 不能因为"打开对话框默认全选"就把已打印批次顺手送掉。
 */
function defaultSendKeys() {
  return defaultPickKeys(rows.value)
}

/** 全送:勾选所有有剩余的**原行** + 数量按剩余量填满(已打印行仍需单独勾) */
function fillRemaining() {
  for (const r of allRows.value) qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0;
  syncPick(defaultSendKeys());
}
/** 全不送:两层都取消勾选 + 数量清零 */
function clearAll() {
  for (const r of allRows.value) qtyOf[r.lineKey] = 0;
  syncPick([]);
  printedRef.value?.clearSelection();
  printedPicked.value = [];
}

async function confirm() {
  // 只有"已勾选 且 数量 > 0"的行才生单(2026-09-21 修复:此前只按数量过滤、勾选形同虚设)
  // **两层各自取勾选**:上层原行 + 下层已打印行;行键自带身份(`...#行id@打印行id` 就是隔离行),
  // 批次号由后端按行自取,前端**不需要**逐行传 batchNo —— 少一处口径就少一处能对不上的地方。
  const lines = [
    ...buildBatchSendLines(rows.value, pickedKeys.value, qtyOf),
    ...buildBatchSendLines(printedRows.value, printedKeys.value, qtyOf),
  ];
  if (!lines.length) { ElMessage.warning(tt('请至少勾选一行并填写本次送料数量')); return }
  const rowOf = (lineKey) => allRows.value.find((r) => r.lineKey === lineKey) || {};
  const isPrinted = (l) => rowOf(l.lineKey).rowKind === 'printed';
  const resvKeys = [...new Set(lines.filter(isPrinted).map((l) => String(rowOf(l.lineKey)['批次号'] || '')).filter(Boolean))];
  if (resvKeys.length > 1 && lines.some((l) => !isPrinted(l))) {
    ElMessage.warning(tt('勾选了多个已打印批次号时不能同时送未打印量：请先按已打印行生单，或把未打印量分开操作'));
    return
  }
  if (resvKeys.length > 1) {
    try {
      await ElMessageBox.confirm(
        `${tt('已打印隔离行涉及多个批次号，将按批次号分成多张单据生成：')}\n${resvKeys.join('、')}`,
        tt('分批生单'), { type: 'info' });
    } catch { return }
  }
  // 目标批次号分组:隔离行取**它自己的号**;原行取顶部输入框的号 ——
  // 勾了隔离行时顶部已被锁定为该号,于是"未打印量"自然并进同一张单(整单同一个号)。
  const byBatch = new Map();
  for (const l of lines) {
    const target = (isPrinted(l) ? String(rowOf(l.lineKey)['批次号'] || '') : '') || String(batchNo.value || '').trim();
    if (!byBatch.has(target)) byBatch.set(target, []);
    byBatch.get(target).push(l);
  }
  saving.value = true;
  try {
    const post = (payload) => engine.batchFlowGenerate({
      sourcePanel: props.sourcePanel, targetPanel: props.targetPanel, sourceNo: props.sourceNo,
      overRatio: ratio.value, ...payload,
    });
    const made = [];
    for (const [target, g] of byBatch) {
      made.push(await post({ lines: g, batchNo: target }));
    }
    // 批次号已在生单这一刻定稿 —— 提示里回显**真号**(res['批次号']),不再是"以后再取"
    if (made.length === 1) {
      const res = made[0];
      const no = String(res?.['批次号'] || batchNo.value || nextBatchNo.value || '');
      ElMessage.success(no
        ? `${tt('已生成')} ${res['编号']}（${tt('批次号')} ${no}）`
        : `${tt('已生成')} ${res['编号']}`);
    } else {
      ElMessage.success(`${tt('已按批次号生成')} ${made.length} ${tt('张单据')}：`
        + made.map((r) => `${r['编号']}(${r['批次号']})`).join('、'));
    }
    const first = made[0] || {};
    emit('generated', {
      panel: first.gotoPanel || props.targetPanel,
      no: first['编号'],
      batchNo: String(first['批次号'] || ''),
      count: made.length,
      silent: true,      // 本对话框已把"生成了几张"说清了,列表页不用再说一遍
    });
    emit('update:modelValue', false);
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('生单失败'));
  } finally {
    saving.value = false;
  }
}

return (_ctx, _cache) => {
  const _component_el_input = ElInput;
  const _component_el_button = ElButton;
  const _component_el_input_number = ElInputNumber;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_tag = ElTag;
  const _component_el_dialog = ElDialog;
  const _directive_loading = vLoading;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: unref(tt)('分批送料') + ' · ' + __props.sourceNo,
    width: "900px",
    "append-to-body": "",
    "destroy-on-close": "",
    "onUpdate:modelValue": _cache[3] || (_cache[3] = (v) => emit('update:modelValue', v)),
    onOpen: load
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, { onClick: fillRemaining }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('按剩余量填充')), 1)
        ]),
        _: 1
      }),
      createVNode(_component_el_button, { onClick: clearAll }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('清空')), 1)
        ]),
        _: 1
      }),
      createVNode(_component_el_button, {
        type: "primary",
        loading: saving.value,
        onClick: confirm
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('确定生单')), 1)
        ]),
        _: 1
      }, 8, ["loading"])
    ]),
    default: withCtx(() => [
      withDirectives((openBlock(), createElementBlock("div", _hoisted_1$d, [
        createBaseVNode("div", _hoisted_2$d, [
          createBaseVNode("span", _hoisted_3$d, toDisplayString(unref(tt)('采购订单')) + ": " + toDisplayString(__props.sourceNo), 1),
          createBaseVNode("span", _hoisted_4$d, [
            createTextVNode(toDisplayString(unref(tt)('批次号')) + ": ", 1),
            createVNode(_component_el_input, {
              modelValue: batchNo.value,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((batchNo).value = $event)),
              size: "small",
              class: "bsd-batch-inp",
              disabled: batchLocked.value,
              placeholder: unref(tt)('生单时按供应商编码与当天日期生成'),
              maxlength: "100",
              clearable: ""
            }, null, 8, ["modelValue", "disabled", "placeholder"]),
            (!batchLocked.value && batchNo.value !== nextBatchNo.value)
              ? (openBlock(), createBlock(_component_el_button, {
                  key: 0,
                  link: "",
                  type: "primary",
                  size: "small",
                  class: "bsd-batch-reset",
                  onClick: _cache[1] || (_cache[1] = $event => (batchNo.value = nextBatchNo.value))
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('恢复默认')), 1)
                  ]),
                  _: 1
                }))
              : createCommentVNode("", true),
            (batchLocked.value)
              ? (openBlock(), createElementBlock("span", _hoisted_5$d, toDisplayString(unref(tt)('已按材料码批次号锁定')), 1))
              : createCommentVNode("", true)
          ]),
          createBaseVNode("span", _hoisted_6$d, [
            createTextVNode(toDisplayString(unref(tt)('超送比例')) + ": ", 1),
            createVNode(_component_el_input_number, {
              modelValue: overRatioPct.value,
              "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((overRatioPct).value = $event)),
              min: 0,
              max: 50,
              step: 1,
              precision: 0,
              size: "small",
              controls: false,
              style: {"width":"62px"},
              onChange: onRatioChange
            }, null, 8, ["modelValue"]),
            _cache[4] || (_cache[4] = createTextVNode(" %", -1)),
            createBaseVNode("span", _hoisted_7$c, toDisplayString(unref(tt)('（0 = 不允许；最高 50%，额度按订单数量算；改完自动保存为系统默认）')), 1),
            (ratioSaving.value)
              ? (openBlock(), createElementBlock("span", _hoisted_8$b, toDisplayString(unref(tt)('保存中…')), 1))
              : (ratioSaved.value)
                ? (openBlock(), createElementBlock("span", _hoisted_9$9, toDisplayString(unref(tt)('已自动保存')), 1))
                : createCommentVNode("", true)
          ]),
          ((batches.value || []).length)
            ? (openBlock(), createElementBlock("span", _hoisted_10$9, toDisplayString(unref(tt)('已有批次')) + ": " + toDisplayString(batches.value.map((b) => b.batchNo || unref(tt)('待编号')).join('、')), 1))
            : createCommentVNode("", true)
        ]),
        createVNode(_component_el_table, {
          ref_key: "tableRef",
          ref: tableRef,
          data: rows.value,
          "row-key": "lineKey",
          border: "",
          size: "small",
          height: "300",
          onSelectionChange: onPicked
        }, {
          default: withCtx(() => [
            createVNode(_component_el_table_column, {
              type: "selection",
              width: "42",
              selectable: rowSelectable
            }),
            createVNode(_component_el_table_column, {
              prop: "行号",
              label: unref(tt)('行号'),
              width: "55"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "物料编码",
              label: unref(tt)('物料编码'),
              "min-width": "120",
              "show-overflow-tooltip": ""
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "物料名称",
              label: unref(tt)('物料名称'),
              "min-width": "120",
              "show-overflow-tooltip": ""
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "规格型号",
              label: unref(tt)('规格型号'),
              "min-width": "100",
              "show-overflow-tooltip": ""
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "数量",
              label: unref(tt)('数量'),
              width: "95",
              align: "right"
            }, {
              default: withCtx(({ row }) => [
                createBaseVNode("span", {
                  title: `${unref(tt)('订单数量')} ${row['订单数量']} − ${unref(tt)('已打印')} ${row['已打印数量']}`
                }, toDisplayString(row['数量']), 9, _hoisted_11$9)
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "已送数量",
              label: unref(tt)('已送'),
              width: "80",
              align: "right"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "已退回数量",
              label: unref(tt)('已退回'),
              width: "80",
              align: "right"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "剩余数量",
              label: unref(tt)('剩余'),
              width: "80",
              align: "right"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              label: unref(tt)('可送上限'),
              width: "95",
              align: "right"
            }, {
              default: withCtx(({ row }) => [
                createTextVNode(toDisplayString(capOf(row)), 1)
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_table_column, {
              label: unref(tt)('本次送料数量'),
              width: "150"
            }, {
              default: withCtx(({ row }) => [
                createVNode(_component_el_input_number, {
                  modelValue: qtyOf[row.lineKey],
                  "onUpdate:modelValue": $event => ((qtyOf[row.lineKey]) = $event),
                  min: 0,
                  max: capOf(row),
                  controls: false,
                  disabled: !(capOf(row) > 0),
                  precision: 2,
                  style: {"width":"130px"}
                }, null, 8, ["modelValue", "onUpdate:modelValue", "max", "disabled"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "计量单位",
              label: unref(tt)('计量单位'),
              width: "85"
            }, null, 8, ["label"])
          ]),
          _: 1
        }, 8, ["data"]),
        createBaseVNode("div", _hoisted_12$9, [
          createBaseVNode("span", null, [
            createTextVNode(toDisplayString(unref(tt)('已选')) + " ", 1),
            createBaseVNode("b", null, toDisplayString(picked.value.length), 1),
            createTextVNode(" " + toDisplayString(unref(tt)('行')) + " · " + toDisplayString(unref(tt)('本次合计')) + ": ", 1),
            createBaseVNode("b", null, toDisplayString(totalQty.value), 1)
          ]),
          createBaseVNode("span", _hoisted_13$9, toDisplayString(unref(tt)('只生成已勾选的行；可送上限 = 订单数量 ×（1 + 超送比例）− 已送 + 已退回（超送最高 50%）')), 1)
        ]),
        (printedRows.value.length)
          ? (openBlock(), createElementBlock("div", _hoisted_14$9, [
              createBaseVNode("div", _hoisted_15$8, [
                createTextVNode(toDisplayString(unref(tt)('已打印待生单')) + " ", 1),
                createBaseVNode("span", _hoisted_16$8, toDisplayString(unref(tt)('勾选即按该批次号生单；勾到多个批次号会按号分成多张单据')), 1)
              ]),
              createVNode(_component_el_table, {
                ref_key: "printedRef",
                ref: printedRef,
                data: printedRows.value,
                "row-key": "lineKey",
                border: "",
                size: "small",
                "max-height": "260",
                onSelectionChange: onPrintedPicked
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    type: "selection",
                    width: "42",
                    selectable: rowSelectable
                  }),
                  createVNode(_component_el_table_column, {
                    prop: "批次号",
                    label: unref(tt)('批次号'),
                    "min-width": "150",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "行号",
                    label: unref(tt)('行号'),
                    width: "55"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "物料编码",
                    label: unref(tt)('物料编码'),
                    "min-width": "120",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "物料名称",
                    label: unref(tt)('物料名称'),
                    "min-width": "120",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "数量",
                    label: unref(tt)('打印数量'),
                    width: "95",
                    align: "right"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "已送数量",
                    label: unref(tt)('已生单'),
                    width: "90",
                    align: "right"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "剩余数量",
                    label: unref(tt)('未生单'),
                    width: "90",
                    align: "right"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('本次送料数量'),
                    width: "150"
                  }, {
                    default: withCtx(({ row }) => [
                      createVNode(_component_el_input_number, {
                        modelValue: qtyOf[row.lineKey],
                        "onUpdate:modelValue": $event => ((qtyOf[row.lineKey]) = $event),
                        min: 0,
                        max: capOf(row),
                        controls: false,
                        disabled: !(capOf(row) > 0),
                        precision: 2,
                        style: {"width":"130px"}
                      }, null, 8, ["modelValue", "onUpdate:modelValue", "max", "disabled"])
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('状态'),
                    width: "90",
                    align: "center"
                  }, {
                    default: withCtx(({ row }) => [
                      createVNode(_component_el_tag, {
                        type: row.已生单 ? 'info' : 'warning',
                        size: "small"
                      }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(unref(tt)(row.已生单 ? '已生单' : '已打印')), 1)
                        ]),
                        _: 2
                      }, 1032, ["type"])
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "打印单号",
                    label: unref(tt)('打印单号'),
                    "min-width": "140",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "打印时间",
                    label: unref(tt)('打印时间'),
                    width: "150",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"])
                ]),
                _: 1
              }, 8, ["data"])
            ]))
          : createCommentVNode("", true)
      ])), [
        [_directive_loading, loading.value]
      ])
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const BatchSendDialog = /*#__PURE__*/_export_sfc(_sfc_main$d, [['__scopeId',"data-v-fd8a12ac"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$c = { class: "nvd" };
const _hoisted_2$c = ["title"];
const _hoisted_3$c = {
  key: 0,
  class: "req"
};
const _hoisted_4$c = {
  key: 2,
  class: "ref-ctl"
};
const _hoisted_5$c = {
  key: 0,
  class: "detail"
};
const _hoisted_6$c = {
  key: 0,
  class: "req"
};
const _hoisted_7$b = { class: "tab-toolbar" };
const _hoisted_8$a = ["disabled", "title", "onClick"];


const _sfc_main$c = {
  __name: 'NewVoucherDialog',
  props: {
  visible: { type: Boolean, default: false },
  panelCode: { type: String, default: '' },
  panelName: { type: String, default: '单据' },
  // 表头字段列数（2列×N行；FINISH_IN 等单据按需传 2）
  fieldCols: { type: Number, default: 2 },
},
  emits: ['update:visible', 'saved'],
  setup(__props, { emit: __emit }) {

const engine = usePanelRuntime();
const user = useUserStore();

const props = __props;
const emit = __emit;

const form = reactive({});
const meta = ref([]);
const detailDef = ref(null);
const detailData = reactive({});
const activeTab = ref('');
const loading = ref(false);
const saving = ref(false);

const visibleMeta = computed(() => (meta.value || []).filter((r) => !r.hidden));
const tabs = computed(() => {
  const d = detailDef.value;
  if (!d) return []
  if (Array.isArray(d.tabs)) return d.tabs
  return []
});

function isText(r) { return !r.dataType || r.dataType === '文本' || r.dataType === 'STRING' }
function isNumber(r) { return ['小数', '整数', 'Decimal', 'Long', 'Integer', 'Double'].includes(r.dataType) }
function isDate(r) { return ['日期', '时间', 'DATE', 'DateTime', 'Date'].includes(r.dataType) }
function isBool(r) { return ['是否', 'Boolean', 'BOOL'].includes(r.dataType) }
function isSelect(r) { return r.dataType === '下拉框' || r.dataType === '参照' }

// ---------- 参照字段弹窗选择（开发约束十一-1：能对应基础档案的字段弹窗拉取勾选导入） ----------
const refVisible = ref(false);
const refPick = ref(null);

function isRef(r) {
  return r.dataType === '参照' && (r.ref || r.refPanel)
}

function fieldLocked(r) {
  // readonly:元数据 editable=0(yj_field)→ buildMeta 下发 readonly,文书锁定字段(申请立项人/负责人)靠它
  return !!(r.autoCode || r.computed || r.readonly)
}

function refText(r, v) {
  if (v === undefined || v === null || v === '') return ''
  const text = engine.refLabelOf(r, v);
  return text === null || text === undefined ? String(v) : text
}

function refPlaceholder(r) {
  const ref = r.ref || r;
  return `选择${ref.display || ref.displayField || r.dataName || ''}`
}

function openRefPick(r) {
  if (fieldLocked(r)) return
  refPick.value = { field: r, kind: 'header', code: r.code };
  refVisible.value = true;
}

function drRefText(dr, row) {
  return refText(dr, row[dr.dataName])
}

function openDetailRef(dr, row, tab) {
  if (dr.computed) return
  refPick.value = { field: dr, kind: 'detail', row, tab };
  refVisible.value = true;
}

async function onRefConfirm(rows) {
  const p = refPick.value;
  if (!p || !rows.length) return
  const r = p.field;
  const rp = r.ref || r;
  const refField = rp.field || rp.refField;
  const multi = !!(rp.multi || rp.refMulti);
  const vals = rows.map((x) => x[refField]);
  const maps = rp.map || rp.refMap || [];
  const applyMap = (target, srcRow) => {
    for (const m of maps) {
      if (!m || srcRow[m.from] === undefined) continue
      const to = m.to || m.from;
      if (to !== p.code && to !== r.dataName) target[to] = srcRow[m.from];
    }
  };
  if (p.kind === 'detail') {
    const row = p.row;
    const tab = p.tab;
    row[r.dataName] = vals[0];
    applyMap(row, rows[0] || {});
    // 多选批量：其余选中行直接新增明细行
    if (multi && rows.length > 1 && tab) {
      for (let i = 1; i < rows.length; i++) {
        const nr = addDetailRow(tab);
        nr[r.dataName] = rows[i][refField];
        applyMap(nr, rows[i]);
      }
    }
  } else {
    form[p.code] = multi ? vals.join('、') : vals[0];
    applyMap(form, rows[0] || {});
  }
  applyCalc();
  ElMessage.success(`已导入 ${rows.length} 行${await engine.refPanelName(r)}数据`);
}
function visibleFields(tab) { return (tab.fields || []).filter((r) => !r.hidden) }

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// 表达式计算链(求值口径统一在 @core/panel/calcRules,与 PanelxForm/PanelxList 及后端 CalcRuleService 同一份)
function applyCalc() {
  for (const tab of tabs.value) {
    const rows = detailData[tab.key] || [];
    // 「产品数量」= 产成品明细的合计数量,是这些公式的额外变量(不写回行)
    const extraVars = { 产品数量: (detailData.products || []).reduce((s, r) => s + num(r['数量']), 0) };
    for (const row of rows) applyCalcRules(tab.calc, row, extraVars);
  }
}

watch(detailData, applyCalc, { deep: true });

function addDetailRow(tab) {
  const rows = detailData[tab.key] || (detailData[tab.key] = []);
  const row = {};
  for (const dr of tab.fields || []) {
    if (dr.dataType === '小数' || dr.dataType === '整数') row[dr.dataName] = dr.defaultValue ?? 0;
    else if (dr.dataType === '是否') row[dr.dataName] = dr.defaultValue ?? false;
    else if (dr.dataType === '日期') row[dr.dataName] = dr.defaultValue ?? '';
    else row[dr.dataName] = dr.defaultValue ?? '';
  }
  if (tab.subTable) row['子表材料'] = [];
  rows.push(row);
  return row
}

async function onOpen() {
  if (!props.panelCode) return
  loading.value = true;
  try {
    const p = await engine.getNewFormPermMatrix({ panelCode: props.panelCode, operationName: '新增流程' });
    Object.keys(form).forEach((k) => delete form[k]);
    Object.assign(form, p.data || {});
    // 文书默认值:必须在「新增」这一刻带出。文书面板(RD_APPROVAL/RD_PLAN 等)保存后
    // 管理员=已归档、普通用户=审批中,都不经过草稿态,挂到列表页草稿 watch 上等于永不执行。
    applyDocDefaults(props.panelCode, form, user, { isNew: true });
    meta.value = p.meta || [];
    detailDef.value = p.detail || null;
    Object.keys(detailData).forEach((k) => delete detailData[k]);
    if (p.detailData && typeof p.detailData === 'object') Object.assign(detailData, p.detailData);
    const firstTab = tabs.value[0];
    if (firstTab) activeTab.value = firstTab.key;
    applyCalc();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '初始化失败');
  } finally {
    loading.value = false;
  }
}

function emptyValue(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

function validate() {
  for (const r of visibleMeta.value) {
    if (r.isNotNull && emptyValue(form[r.code])) return `${r.name}不能为空`
  }
  for (const tab of tabs.value) {
    const rows = detailData[tab.key] || [];
    if (tab.isRequired && !rows.length) return `请至少添加一行${tab.label}`
    for (let i = 0; i < rows.length; i++) {
      for (const f of tab.fields || []) {
        if (f.isRequired && emptyValue(rows[i][f.dataName])) return `${tab.label}第 ${i + 1} 行${f.dataName}不能为空`
      }
    }
  }
  return ''
}

async function onSave() {
  const msg = validate();
  if (msg) return ElMessage.warning(msg)
  saving.value = true;
  try {
    const rd = { ...form };
    if (tabs.value.length) rd.detail = { ...detailData };
    const res = await engine.callButton({ panelCode: props.panelCode, buttonName: '保存', formData: rd, buttonParam: {} });
    ElMessage.success(`保存成功：${res?.['编号'] || ''}`);
    emit('update:visible', false);
    emit('saved', res);
  } catch (e) {
    const m = engine.errMsg(e) || '保存失败';
    if (m.includes('演示环境暂未实现')) ElMessage.info(m);
    else ElMessage.error(m);
  } finally {
    saving.value = false;
  }
}

return (_ctx, _cache) => {
  const _component_el_input = ElInput;
  const _component_el_input_number = ElInputNumber;
  const _component_el_button = ElButton;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_switch = ElSwitch;
  const _component_el_table_column = ElTableColumn;
  const _component_el_image = ElImage;
  const _component_el_icon = ElIcon;
  const _component_el_table = ElTable;
  const _component_el_tab_pane = ElTabPane;
  const _component_el_tabs = ElTabs;
  const _component_el_dialog = ElDialog;
  const _directive_loading = vLoading;

  return (openBlock(), createElementBlock(Fragment, null, [
    createVNode(_component_el_dialog, {
      "model-value": __props.visible,
      title: unref(tt)('新增') + __props.panelName,
      width: "960px",
      "append-to-body": "",
      "destroy-on-close": "",
      "onUpdate:modelValue": _cache[2] || (_cache[2] = (v) => emit('update:visible', v)),
      onOpen: onOpen
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[1] || (_cache[1] = $event => (emit('update:visible', false)))
        }, {
          default: withCtx(() => [...(_cache[7] || (_cache[7] = [
            createTextVNode("取消", -1)
          ]))]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: saving.value,
          onClick: onSave
        }, {
          default: withCtx(() => [...(_cache[8] || (_cache[8] = [
            createTextVNode("保存", -1)
          ]))]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        withDirectives((openBlock(), createElementBlock("div", _hoisted_1$c, [
          createBaseVNode("div", {
            class: "fields udl-fields",
            style: normalizeStyle({ gridTemplateColumns: 'repeat(' + __props.fieldCols + ', 1fr)' })
          }, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(visibleMeta.value, (r) => {
              return (openBlock(), createElementBlock("div", {
                key: r.code,
                class: "field"
              }, [
                createBaseVNode("label", {
                  title: unref(tt)(r.name)
                }, [
                  createTextVNode(toDisplayString(unref(tt)(r.name)), 1),
                  (r.isNotNull)
                    ? (openBlock(), createElementBlock("span", _hoisted_3$c, "*"))
                    : createCommentVNode("", true)
                ], 8, _hoisted_2$c),
                (isText(r))
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: form[r.code],
                      "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                      disabled: fieldLocked(r),
                      placeholder: unref(tt)(r.name)
                    }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled", "placeholder"]))
                  : (isNumber(r))
                    ? (openBlock(), createBlock(_component_el_input_number, {
                        key: 1,
                        modelValue: form[r.code],
                        "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                        disabled: fieldLocked(r),
                        controls: false,
                        style: {"width":"100%"}
                      }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                    : (isRef(r))
                      ? (openBlock(), createElementBlock("div", _hoisted_4$c, [
                          createVNode(_component_el_input, {
                            "model-value": refText(r, form[r.code]),
                            readonly: "",
                            disabled: fieldLocked(r),
                            placeholder: unref(tt)('点击选择'),
                            onClick: $event => (openRefPick(r))
                          }, null, 8, ["model-value", "disabled", "placeholder", "onClick"]),
                          (!fieldLocked(r))
                            ? (openBlock(), createBlock(_component_el_button, {
                                key: 0,
                                size: "small",
                                icon: unref(search_default),
                                class: "ref-btn",
                                onClick: $event => (openRefPick(r))
                              }, null, 8, ["icon", "onClick"]))
                            : createCommentVNode("", true)
                        ]))
                      : (isSelect(r))
                        ? (openBlock(), createBlock(_component_el_select, {
                            key: 3,
                            modelValue: form[r.code],
                            "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                            disabled: fieldLocked(r),
                            filterable: "",
                            clearable: "",
                            "allow-create": "",
                            style: {"width":"100%"}
                          }, {
                            default: withCtx(() => [
                              (openBlock(true), createElementBlock(Fragment, null, renderList(r.options || [], (o) => {
                                return (openBlock(), createBlock(_component_el_option, {
                                  key: o,
                                  label: o.label ?? o,
                                  value: o.value ?? o
                                }, null, 8, ["label", "value"]))
                              }), 128))
                            ]),
                            _: 2
                          }, 1032, ["modelValue", "onUpdate:modelValue", "disabled"]))
                        : (isDate(r))
                          ? (openBlock(), createBlock(_component_el_date_picker, {
                              key: 4,
                              modelValue: form[r.code],
                              "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                              disabled: fieldLocked(r),
                              type: "date",
                              "value-format": "YYYY-MM-DD",
                              style: {"width":"100%"}
                            }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                          : (isBool(r))
                            ? (openBlock(), createBlock(_component_el_switch, {
                                key: 5,
                                modelValue: form[r.code],
                                "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                                disabled: fieldLocked(r)
                              }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                            : (openBlock(), createBlock(_component_el_input, {
                                key: 6,
                                modelValue: form[r.code],
                                "onUpdate:modelValue": $event => ((form[r.code]) = $event),
                                disabled: fieldLocked(r),
                                placeholder: unref(tt)(r.name)
                              }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled", "placeholder"]))
              ]))
            }), 128))
          ], 4),
          (tabs.value.length)
            ? (openBlock(), createElementBlock("div", _hoisted_5$c, [
                createVNode(_component_el_tabs, {
                  modelValue: activeTab.value,
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((activeTab).value = $event))
                }, {
                  default: withCtx(() => [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(tabs.value, (tab) => {
                      return (openBlock(), createBlock(_component_el_tab_pane, {
                        key: tab.key,
                        name: tab.key
                      }, {
                        label: withCtx(() => [
                          createBaseVNode("span", null, [
                            createTextVNode(toDisplayString(tab.label), 1),
                            (tab.isRequired)
                              ? (openBlock(), createElementBlock("span", _hoisted_6$c, "*"))
                              : createCommentVNode("", true)
                          ])
                        ]),
                        default: withCtx(() => [
                          createBaseVNode("div", _hoisted_7$b, [
                            createVNode(_component_el_button, {
                              size: "small",
                              type: "primary",
                              icon: unref(plus_default),
                              onClick: $event => (addDetailRow(tab))
                            }, {
                              default: withCtx(() => [...(_cache[4] || (_cache[4] = [
                                createTextVNode("新增数据", -1)
                              ]))]),
                              _: 1
                            }, 8, ["icon", "onClick"])
                          ]),
                          createVNode(_component_el_table, {
                            data: detailData[tab.key] || [],
                            size: "small",
                            border: "",
                            height: "260"
                          }, {
                            default: withCtx(() => [
                              createVNode(_component_el_table_column, {
                                label: "序号",
                                width: "50",
                                align: "center"
                              }, {
                                default: withCtx(({ $index }) => [
                                  createTextVNode(toDisplayString($index + 1), 1)
                                ]),
                                _: 1
                              }),
                              (openBlock(true), createElementBlock(Fragment, null, renderList(visibleFields(tab), (dr) => {
                                return (openBlock(), createBlock(_component_el_table_column, {
                                  key: dr.dataName,
                                  label: dr.dataName,
                                  "min-width": "110",
                                  "class-name": [dr.computed ? 'computed-col' : '', dr.dataType === '参照' ? 'detail-ref-col' : ''].filter(Boolean).join(' ')
                                }, {
                                  default: withCtx(({ row }) => [
                                    (dr.dataType === '参照')
                                      ? (openBlock(), createElementBlock("button", {
                                          key: 0,
                                          type: "button",
                                          class: "detail-ref-cell",
                                          disabled: dr.computed,
                                          title: drRefText(dr, row) || undefined,
                                          onClick: withModifiers($event => (openDetailRef(dr, row, tab)), ["stop"])
                                        }, toDisplayString(drRefText(dr, row) || refPlaceholder(dr)), 9, _hoisted_8$a))
                                      : (dr.dataType === '下拉框')
                                        ? (openBlock(), createBlock(_component_el_select, {
                                            key: 1,
                                            modelValue: row[dr.dataName],
                                            "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                            disabled: dr.computed,
                                            filterable: "",
                                            "allow-create": "",
                                            style: {"width":"100%"}
                                          }, {
                                            default: withCtx(() => [
                                              (openBlock(true), createElementBlock(Fragment, null, renderList(dr.options || [], (o) => {
                                                return (openBlock(), createBlock(_component_el_option, {
                                                  key: o,
                                                  label: o.label ?? o,
                                                  value: o.value ?? o
                                                }, null, 8, ["label", "value"]))
                                              }), 128))
                                            ]),
                                            _: 2
                                          }, 1032, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                        : (dr.dataType === '是否')
                                          ? (openBlock(), createBlock(_component_el_switch, {
                                              key: 2,
                                              modelValue: row[dr.dataName],
                                              "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                              disabled: dr.computed
                                            }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                          : (dr.dataType === '图片')
                                            ? (openBlock(), createBlock(_component_el_image, {
                                                key: 3,
                                                src: row[dr.dataName] || '',
                                                fit: "contain",
                                                style: {"width":"34px","height":"34px"}
                                              }, {
                                                error: withCtx(() => [...(_cache[5] || (_cache[5] = [
                                                  createBaseVNode("span", { class: "img-ph" }, "图", -1)
                                                ]))]),
                                                _: 1
                                              }, 8, ["src"]))
                                            : (dr.dataType === '小数' || dr.dataType === '整数')
                                              ? (openBlock(), createBlock(_component_el_input_number, {
                                                  key: 4,
                                                  modelValue: row[dr.dataName],
                                                  "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                                  disabled: dr.computed,
                                                  controls: false,
                                                  style: {"width":"100%"}
                                                }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                              : (dr.dataType === '日期')
                                                ? (openBlock(), createBlock(_component_el_date_picker, {
                                                    key: 5,
                                                    modelValue: row[dr.dataName],
                                                    "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                                    disabled: dr.computed,
                                                    type: "date",
                                                    "value-format": "YYYY-MM-DD",
                                                    style: {"width":"100%"}
                                                  }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                                : (openBlock(), createBlock(_component_el_input, {
                                                    key: 6,
                                                    modelValue: row[dr.dataName],
                                                    "onUpdate:modelValue": $event => ((row[dr.dataName]) = $event),
                                                    disabled: dr.computed
                                                  }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                  ]),
                                  _: 2
                                }, 1032, ["label", "class-name"]))
                              }), 128)),
                              createVNode(_component_el_table_column, {
                                label: "操作",
                                width: "50",
                                align: "center"
                              }, {
                                default: withCtx(({ $index }) => [
                                  createVNode(_component_el_icon, {
                                    class: "del",
                                    onClick: $event => (detailData[tab.key].splice($index, 1))
                                  }, {
                                    default: withCtx(() => [
                                      createVNode(unref(delete_default))
                                    ]),
                                    _: 1
                                  }, 8, ["onClick"])
                                ]),
                                _: 2
                              }, 1024)
                            ]),
                            _: 2
                          }, 1032, ["data"])
                        ]),
                        _: 2
                      }, 1032, ["name"]))
                    }), 128))
                  ]),
                  _: 1
                }, 8, ["modelValue"])
              ]))
            : createCommentVNode("", true),
          _cache[6] || (_cache[6] = createBaseVNode("div", { class: "hint" }, "提示：也可在列表页底部空白行双击单元格直接填写（内联新增）", -1))
        ])), [
          [_directive_loading, loading.value]
        ])
      ]),
      _: 1
    }, 8, ["model-value", "title"]),
    createVNode(RefPickDialog, {
      modelValue: refVisible.value,
      "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((refVisible).value = $event)),
      field: refPick.value?.field,
      mode: refPick.value?.kind || 'header',
      onConfirm: onRefConfirm
    }, null, 8, ["modelValue", "field", "mode"])
  ], 64))
}
}

};
const NewVoucherDialog = /*#__PURE__*/_export_sfc(_sfc_main$c, [['__scopeId',"data-v-d648f312"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$b = { class: "drp" };
const _hoisted_2$b = ["title"];
const _hoisted_3$b = ["title"];
const _hoisted_4$b = { class: "drp-no" };
const _hoisted_5$b = { class: "drp-range" };
const _hoisted_6$b = ["title"];
const _hoisted_7$a = ["title"];


const _sfc_main$b = {
  __name: 'DocRailPager',
  props: {
  /** 当前页号(1 基,与后端 pageNo 一致) */
  pageNo: { type: Number, default: 1 },
  /** 总页数 = ceil(total / pageSize) */
  pageCount: { type: Number, default: 1 },
  /** 本页首条 / 末条的全局序号(展示用) */
  from: { type: Number, default: 0 },
  to: { type: Number, default: 0 },
  /** 单据总张数 */
  total: { type: Number, default: 0 },
},
  emits: ['go'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

const atFirst = computed(() => props.pageNo <= 1);
const atLast = computed(() => props.pageNo >= props.pageCount);
/** 目标页号夹到 [1, pageCount];同页不发事件(边界按钮点了无动作) */
function go(target) {
  const t = Math.min(Math.max(1, Math.round(target) || 1), Math.max(1, props.pageCount));
  if (t !== props.pageNo) emit('go', t);
}

return (_ctx, _cache) => {
  return (openBlock(), createElementBlock("div", _hoisted_1$b, [
    createBaseVNode("span", {
      class: normalizeClass(["drp-btn", { off: atFirst.value }]),
      title: unref(tt)('首页'),
      onClick: _cache[0] || (_cache[0] = $event => (go(1)))
    }, "◁", 10, _hoisted_2$b),
    createBaseVNode("span", {
      class: normalizeClass(["drp-btn", { off: atFirst.value }]),
      title: unref(tt)('上一页'),
      onClick: _cache[1] || (_cache[1] = $event => (go(__props.pageNo - 1)))
    }, "◀", 10, _hoisted_3$b),
    createBaseVNode("span", _hoisted_4$b, [
      createTextVNode(toDisplayString(unref(tt)('第 {p}/{n} 页').replace('{p}', String(__props.pageNo)).replace('{n}', String(__props.pageCount))) + " ", 1),
      createBaseVNode("span", _hoisted_5$b, "（" + toDisplayString(__props.from) + "-" + toDisplayString(__props.to) + " / " + toDisplayString(__props.total) + "）", 1)
    ]),
    createBaseVNode("span", {
      class: normalizeClass(["drp-btn", { off: atLast.value }]),
      title: unref(tt)('下一页'),
      onClick: _cache[2] || (_cache[2] = $event => (go(__props.pageNo + 1)))
    }, "▶", 10, _hoisted_6$b),
    createBaseVNode("span", {
      class: normalizeClass(["drp-btn", { off: atLast.value }]),
      title: unref(tt)('末页'),
      onClick: _cache[3] || (_cache[3] = $event => (go(__props.pageCount)))
    }, "▷", 10, _hoisted_7$a)
  ]))
}
}

};
const DocRailPager = /*#__PURE__*/_export_sfc(_sfc_main$b, [['__scopeId',"data-v-bfce42d1"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$a = { class: "dsr-head" };
const _hoisted_2$a = ["title"];
const _hoisted_3$a = ["title"];
const _hoisted_4$a = { class: "dsr-filters" };
const _hoisted_5$a = { class: "dsr-kw" };
const _hoisted_6$a = { class: "dsr-count" };
const _hoisted_7$9 = {
  key: 0,
  class: "dsr-count-sub"
};
const _hoisted_8$9 = { class: "dsr-grid" };
const _hoisted_9$8 = ["onClick"];
const _hoisted_10$8 = ["title"];
const _hoisted_11$8 = { key: 0 };
const _hoisted_12$8 = ["colspan"];
const _hoisted_13$8 = ["title"];
const _hoisted_14$8 = ["title"];

const MIN_W = 200;
const MAX_W = 560;
const DEFAULT_W = 320; // 量出自然宽之前的兜底值

const _sfc_main$a = {
  __name: 'DocSelectRail',
  props: {
  title: { type: String, default: '' },
  /** 当前页单据列表(PanelxList list,行键=中文标签) */
  rows: { type: Array, default: () => [] },
  /** 当前单据编号(高亮) */
  currentNo: { type: String, default: '' },
  collapsed: { type: Boolean, default: false },
  /** 单据总张数(后端 totalSize,全量而非本页)——「共有数据」与页码都按它算 */
  total: { type: Number, default: 0 },
  /** 当前页号(1 基,= 后端 pageNo) */
  pageNo: { type: Number, default: 1 },
  /** 每页条数(整页翻的步长,当前 50) */
  pageSize: { type: Number, default: 50 },
  /** 生效中的模糊搜索关键字(后端 keyword;显示用,父组件是唯一真源) */
  keyword: { type: String, default: '' },
  /** 列配置(按单据定制):[{label, keys(候选行键,取首个非空), align, tag(状态标签), no(单号样式)}];
   *  约定首列=单号、次列=日期、末列=审核状态(tag),中间列由挂载方按单据挑重要字段 */
  columns: { type: Array, default: null },
},
  emits: ['select', 'toggle', 'page', 'search'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

/** 总页数:按总张数与每页条数算,至少 1 页 */
const pageCount = computed(() => Math.max(1, Math.ceil((props.total || 0) / Math.max(1, props.pageSize))));
/** 本页首/末条的全局序号(展示「1-50 / 59」) */
const rangeFrom = computed(() => (props.rows.length ? (props.pageNo - 1) * props.pageSize + 1 : 0));
const rangeTo = computed(() => (props.rows.length ? rangeFrom.value + props.rows.length - 1 : 0));

const noOf = (row) => String(row['编号'] || row['单据编号'] || row['单号'] || '');

/** 兜底列(未传 columns 时):单号/日期/往来单位/审核状态(「部门」列 2026-09-20 去掉:
 *  实测多数面板该列恒空,带左栏的面板已各自指定中间列) */
const DEFAULT_COLUMNS = [
  { label: '单号', keys: ['编号', '单据编号', '单号'], align: 'left', no: true },
  { label: '日期', keys: ['日期', '单据日期'], align: 'left' },
  { label: '供应商', keys: ['供应商', '客户'], align: 'left' },
  { label: '审核状态', keys: ['单据状态'], align: 'center', tag: true },
];
const cols = computed(() => (props.columns && props.columns.length ? props.columns : DEFAULT_COLUMNS));
const colValue = (row, c) => {
  // derive 列:值由挂载方函数从行派生(如转ERP状态:行上无现成字段,由 ERP单号/是否已转ERP 推出)
  if (typeof c.derive === 'function') return c.derive(row) ?? ''
  for (const k of c.keys || [c.label]) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return ''
};

const kw = ref(props.keyword || '');
/** 外部(父组件)改动关键字时同步输入框:切面板/清空/查询弹窗重置都要跟随 */
watch(() => props.keyword, (v) => { if (String(v || '') !== (kw.value || '').trim()) kw.value = String(v || ''); });
/** 点「查找」/回车:关键字上抛,由父组件走后端全库模糊搜索(本组件不再本地过滤) */
function apply() { emit('search', (kw.value || '').trim()); }

/** 行视图:仅做"行契约→单元格"映射(idx 保持指向 props.rows,点行回传原始下标) */
const viewRows = computed(() => props.rows.map((row, idx) => ({
  key: noOf(row) + '#' + idx, idx, no: noOf(row), cells: cols.value.map((c) => colValue(row, c)),
})));

/** 状态标签色彩(沿用系统制造绿体系:主色=已审核,青蓝=已完成(与已审核区分),
 *  中性灰=草稿,琥珀=流转中,红=作废/驳回) */
const TAG_OK = ['已审核', '已归档', '生产中', '已完工', '已关闭', '已审批', '已通过', '已转'];
/** 已完成(金蝶自动关单):与「已审核」同为正常终态,但语义是"做完了",用青蓝一眼区分 */
const TAG_DONE = ['已完成'];
const TAG_PENDING = ['审批中', '待二级审批', '修改中', '删除申请中', '修改申请中', '提交审批'];
const TAG_DANGER = ['已作废', '已中止', '已终止', '审批驳回', '驳回'];
function tagClass(status) {
  const s = String(status || '');
  if (TAG_DONE.includes(s)) return 'done'
  if (TAG_OK.includes(s)) return 'ok'
  if (TAG_DANGER.includes(s)) return 'danger'
  if (TAG_PENDING.includes(s)) return 'pending'
  return 'draft'
}

// ---- 拖拽调宽:只改本栏外层宽度;表格 width:100% + min-width:max-content ——
// 面板拖宽时表格跟随一起变宽(列同步伸展),拖窄到自然宽以下时容器出横向滚动条。
// 宽度不做任何持久化(不写 localStorage):每次进页面按内容量一次即可。
const width = ref(DEFAULT_W);
const railEl = ref(null);
const tableEl = ref(null);

/** 进入面板时量表格自然宽,把栏宽定到刚好完整展示;用户一旦拖拽即停止自动拟合(不持久化)。
 *  量法:临时切 max-content 取真实自然宽——表格常态跟随容器,直接量只会量到容器宽。
 *  只增不减:首帧数据未到时量到的是空表头宽,数据到达后会被真实值纠正。 */
let autoFit = true;
let fittedW = 0;
function fitOnce() {
  if (!autoFit) return
  const el = tableEl.value;
  if (!el) return
  const prev = el.style.width;
  el.style.width = 'max-content';
  const natural = Math.ceil(el.getBoundingClientRect().width || el.scrollWidth || 0);
  el.style.width = prev;
  if (!natural) return
  const target = Math.min(MAX_W, Math.max(MIN_W, natural + 1));
  if (shrinkNext) { shrinkNext = false; fittedW = target; width.value = target; return }
  if (target > fittedW) { fittedW = target; width.value = target; }
}
const refit = () => { autoFit = true; fittedW = 0; nextTick(fitOnce); };
// 切面板:旧面板的拟合值已无意义,清零后允许首轮拟合直接收缩到新面板的自然宽
const refitShrink = () => { autoFit = true; fittedW = 0; shrinkNext = true; nextTick(fitOnce); };
let shrinkNext = false;
onMounted(() => nextTick(fitOnce));
watch(() => props.title, refitShrink);
watch(() => props.rows.length, (n) => { if (!n) refitShrink(); else nextTick(fitOnce); });
watch(() => props.collapsed, (c) => { if (!c) refit(); });
let dragging = false;
function onDragMove(e) {
  if (!dragging) return
  const left = railEl.value?.getBoundingClientRect().left ?? 0;
  width.value = Math.min(MAX_W, Math.max(MIN_W, Math.round(e.clientX - left)));
}
function detachDrag() {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
}
function onDragEnd() {
  if (!dragging) return
  dragging = false;
  detachDrag();
}
function startDrag() {
  dragging = true;
  autoFit = false; // 用户开始拖拽:停止自动拟合,栏宽此后完全由拖拽决定
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}
// 卸载只解绑监听
onBeforeUnmount(detachDrag);

return (_ctx, _cache) => {
  const _component_el_input = ElInput;
  const _component_el_button = ElButton;

  return (!__props.collapsed)
    ? (openBlock(), createElementBlock("div", {
        key: 0,
        ref_key: "railEl",
        ref: railEl,
        class: "doc-select-rail",
        style: normalizeStyle({ width: width.value + 'px' })
      }, [
        createBaseVNode("div", _hoisted_1$a, [
          createBaseVNode("span", {
            class: "dsr-title",
            title: __props.title
          }, toDisplayString(__props.title), 9, _hoisted_2$a),
          createBaseVNode("span", {
            class: "dsr-coll",
            title: unref(tt)('收起'),
            onClick: _cache[0] || (_cache[0] = $event => (_ctx.$emit('toggle')))
          }, "«", 8, _hoisted_3$a)
        ]),
        createBaseVNode("div", _hoisted_4$a, [
          createBaseVNode("div", _hoisted_5$a, [
            createVNode(_component_el_input, {
              modelValue: kw.value,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((kw).value = $event)),
              size: "small",
              clearable: "",
              placeholder: unref(tt)('模糊搜索'),
              onKeyup: withKeys(apply, ["enter"]),
              onClear: apply
            }, null, 8, ["modelValue", "placeholder"]),
            createVNode(_component_el_button, {
              size: "small",
              type: "primary",
              plain: "",
              onClick: apply
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(tt)('查找')), 1)
              ]),
              _: 1
            })
          ]),
          createBaseVNode("div", _hoisted_6$a, [
            createTextVNode(toDisplayString(unref(tt)('共有数据')) + ": " + toDisplayString(__props.total) + " " + toDisplayString(unref(tt)('条')) + " ", 1),
            (__props.keyword)
              ? (openBlock(), createElementBlock("span", _hoisted_7$9, "（" + toDisplayString(unref(tt)('模糊搜索')) + ": " + toDisplayString(__props.keyword) + "）", 1))
              : createCommentVNode("", true)
          ])
        ]),
        createVNode(DocRailPager, {
          "page-no": __props.pageNo,
          "page-count": pageCount.value,
          from: rangeFrom.value,
          to: rangeTo.value,
          total: __props.total,
          onGo: _cache[2] || (_cache[2] = (p) => _ctx.$emit('page', p))
        }, null, 8, ["page-no", "page-count", "from", "to", "total"]),
        createBaseVNode("div", _hoisted_8$9, [
          createBaseVNode("table", {
            ref_key: "tableEl",
            ref: tableEl
          }, [
            createBaseVNode("thead", null, [
              createBaseVNode("tr", null, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(cols.value, (c) => {
                  return (openBlock(), createElementBlock("th", {
                    key: c.label,
                    class: normalizeClass(c.align === 'center' ? 'a-center' : 'a-left')
                  }, toDisplayString(unref(tt)(c.label)), 3))
                }), 128))
              ])
            ]),
            createBaseVNode("tbody", null, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(viewRows.value, (r) => {
                return (openBlock(), createElementBlock("tr", {
                  key: r.key,
                  class: normalizeClass({ active: r.no === __props.currentNo }),
                  onClick: $event => (_ctx.$emit('select', r.idx))
                }, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(cols.value, (c, ci) => {
                    return (openBlock(), createElementBlock("td", {
                      key: c.label,
                      class: normalizeClass([c.align === 'center' ? 'a-center' : 'a-left', { 'dsr-no': c.no }]),
                      title: r.cells[ci]
                    }, [
                      (c.tag && r.cells[ci])
                        ? (openBlock(), createElementBlock("span", {
                            key: 0,
                            class: normalizeClass(["dsr-tag", tagClass(r.cells[ci])])
                          }, toDisplayString(unref(tt)(r.cells[ci])), 3))
                        : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                            createTextVNode(toDisplayString(r.cells[ci]), 1)
                          ], 64))
                    ], 10, _hoisted_10$8))
                  }), 128))
                ], 10, _hoisted_9$8))
              }), 128)),
              (!viewRows.value.length)
                ? (openBlock(), createElementBlock("tr", _hoisted_11$8, [
                    createBaseVNode("td", {
                      colspan: cols.value.length,
                      class: "dsr-empty"
                    }, toDisplayString(unref(tt)('暂无数据')), 9, _hoisted_12$8)
                  ]))
                : createCommentVNode("", true)
            ])
          ], 512)
        ]),
        createBaseVNode("div", {
          class: "dsr-resizer",
          title: unref(tt)('拖动调整宽度'),
          onMousedown: withModifiers(startDrag, ["prevent"])
        }, null, 40, _hoisted_13$8)
      ], 4))
    : (openBlock(), createElementBlock("div", {
        key: 1,
        class: "doc-select-rail coll",
        title: __props.title,
        onClick: _cache[3] || (_cache[3] = $event => (_ctx.$emit('toggle')))
      }, "»", 8, _hoisted_14$8))
}
}

};
const DocSelectRail = /*#__PURE__*/_export_sfc(_sfc_main$a, [['__scopeId',"data-v-bb7ce6f6"]]);

/**
 * 项目阶段进度(纯函数,无 Vue 依赖)。
 * 数据来源:项目实施计划(RD_PLAN)的阶段框字段
 *   阶段N            = 阶段标题(旧版单字段,兜底)
 *   阶段N_计划内容    = 计划内容(有效阶段的判定键)
 *   阶段N_计划开始 / 阶段N_计划完成 / 阶段N_实际完成 / 阶段N_责任人
 * 口径:已完成 = 实际完成非空;逾期 = 未完成且计划完成早于今天(当天不算逾期);空阶段框不计入。
 */

const MAX_STAGE = 10;

/** 可翻译的状态词(UI 用 tt() 组句,数字由界面拼) */
const STATUS_TOKENS = {
  no_plan: '无实施计划',
  none: '无阶段计划',
  not_started: '未开始',
  doing: '进行中',
  done: '全部完成',
  overdue: '逾期',
};

function text(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/** 归一为 YYYY-MM-DD(兼容 2026/9/12 与带时分的值);解析不出返回空串 */
function normDate(value) {
  const raw = text(value);
  if (!raw) return ''
  const m = raw.replace(/\//g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return ''
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
}

function isOverdue(stage, today) {
  if (stage.actual) return false
  const due = normDate(stage.due);
  const now = normDate(today);
  if (!due || !now) return false
  return due < now
}

/**
 * 抽取有效阶段(计划内容或旧版阶段标题非空),按阶段号升序。
 * @param {Object} planHead 实施计划单据表头
 */
function pickStages(planHead) {
  if (!planHead) return []
  const out = [];
  for (let no = 1; no <= MAX_STAGE; no += 1) {
    const content = text(planHead[`阶段${no}_计划内容`]) || text(planHead[`阶段${no}`]);
    if (!content) continue
    out.push({
      no,
      content,
      start: text(planHead[`阶段${no}_计划开始`]),
      due: text(planHead[`阶段${no}_计划完成`]),
      actual: text(planHead[`阶段${no}_实际完成`]),
      owner: text(planHead[`阶段${no}_责任人`]),
    });
  }
  return out
}

/** 阶段框内 5 个字段(与实施计划纸面阶段框一一对应) */
const PHASE_FIELDS = ['计划内容', '计划开始', '计划完成', '实际完成', '责任人'];

/** 阶段框是否填过内容:5 个字段任一非空即为已填;全空则在导出/打印时跳过该框 */
function hasPhaseContent(head, no) {
  if (!head) return false
  return PHASE_FIELDS.some((field) => text(head[`阶段${no}_${field}`]) !== '')
}

/** 单个阶段的行内状态(弹窗徽标用) */
function stageRowState(stage, today = '') {
  if (stage && stage.actual) return 'done'
  return isOverdue(stage || {}, today) ? 'overdue' : 'doing'
}

/**
 * 汇总阶段完成情况。
 * @param {Array|null} stages pickStages 的结果;null=没找到实施计划
 * @param {string} today 今天 YYYY-MM-DD
 */
function summarizeStages(stages, today = '') {
  if (stages === null || stages === undefined) {
    return { state: 'no_plan', total: 0, done: 0, overdue: 0, next: null }
  }
  const list = stages || [];
  const total = list.length;
  const done = list.filter((s) => !!s.actual).length;
  const overdue = list.filter((s) => isOverdue(s, today)).length;
  const next = list.find((s) => !s.actual) || null;
  let state = 'none';
  if (total > 0) {
    if (done === 0) state = 'not_started';
    else if (done === total) state = 'done';
    else state = 'doing';
  }
  return { state, total, done, overdue, next }
}

/** 状态标签文案(中文原文;UI 展示用 STATUS_TOKENS 逐词 tt() 组句) */
function statusLabel(summary) {
  if (!summary) return ''
  switch (summary.state) {
    case 'no_plan':
      return STATUS_TOKENS.no_plan
    case 'none':
      return STATUS_TOKENS.none
    case 'not_started':
      return `${STATUS_TOKENS.not_started} 0/${summary.total}`
    case 'done':
      return `${STATUS_TOKENS.done} ${summary.done}/${summary.total}`
    default:
      return summary.overdue > 0
        ? `${STATUS_TOKENS.doing} ${summary.done}/${summary.total} · ${STATUS_TOKENS.overdue} ${summary.overdue}`
        : `${STATUS_TOKENS.doing} ${summary.done}/${summary.total}`
  }
}

/** 状态色:no_plan/none/not_started 灰,doing 蓝,逾期橙,done 绿 */
function statusTone(summary) {
  if (!summary) return 'none'
  if (summary.state === 'done') return 'done'
  if (summary.state === 'doing') return summary.overdue > 0 ? 'overdue' : 'doing'
  return 'idle'
}

// ---------- 阶段计划日期:次日 + 相邻阶段自动衔接 ----------
// 用途:项目实施计划的阶段框里,计划开始/计划完成改为日期弹窗后,
// 填完某阶段的「计划完成」就把下一阶段的「计划开始」接上次日,避免 10 个阶段逐个手填。
// 实测数据习惯即为如此:阶段1 09-01→09-10,阶段2 09-11→09-25。

/** 次日(YYYY-MM-DD);解析不出返回空串(不写脏数据) */
function nextDay(value) {
  const day = normDate(value);
  if (!day) return ''
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 1);
  const p = (x) => String(x).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`
}

/**
 * 相邻阶段日期衔接:阶段 n「计划完成」确定后,若阶段 n+1「计划开始」为空则填次日。
 * 规则:**只在下一阶段为空时写入**,不覆盖已填值;本阶段日期为空/非法、或 n 已是最后阶段时不写入。
 * 就地修改 head(与面板其它字段读写方式一致)。
 * @param {Object} head 实施计划单据表头
 * @param {number} n 阶段号
 * @returns {number} 被写入的阶段号;未写入返回 0
 */
function chainNextStageStart(head, n, total = MAX_STAGE) {
  if (!head || !n || n >= total) return 0
  const start = nextDay(head[`阶段${n}_计划完成`]);
  if (!start) return 0
  const nextKey = `阶段${n + 1}_计划开始`;
  if (text(head[nextKey])) return 0
  head[nextKey] = start;
  return n + 1
}

/* unplugin-vue-components disabled */

/* unplugin-vue-components disabled */

const _hoisted_1$9 = { class: "approval-sheet" };
const _hoisted_2$9 = { class: "atb-tag" };
const _hoisted_3$9 = { class: "atb-txt" };
const _hoisted_4$9 = { class: "atb-tag" };
const _hoisted_5$9 = { class: "atb-txt" };
const _hoisted_6$9 = {
  key: 0,
  class: "atb-ops"
};
const _hoisted_7$8 = {
  key: 1,
  class: "atb-ops"
};
const _hoisted_8$8 = { class: "as-topbar" };
const _hoisted_9$7 = { class: "as-docno" };
const _hoisted_10$7 = ["title"];
const _hoisted_11$7 = { class: "as-title-row" };
const _hoisted_12$7 = { class: "as-title" };
const _hoisted_13$7 = { class: "as-info-table" };
const _hoisted_14$7 = { class: "as-info-label" };
const _hoisted_15$7 = { class: "as-info-value" };
const _hoisted_16$7 = ["title", "onClick"];
const _hoisted_17$7 = { class: "as-ref-text" };
const _hoisted_18$7 = { class: "as-body" };
const _hoisted_19$7 = { class: "as-table" };
const _hoisted_20$7 = {
  key: 0,
  class: "q-vrun"
};
const _hoisted_21$7 = { class: "q-vrows" };
const _hoisted_22$7 = ["onClick"];
const _hoisted_23$7 = {
  key: 1,
  class: "as-ro-text"
};
const _hoisted_24$7 = {
  key: 2,
  class: "q-signline end"
};
const _hoisted_25$7 = { class: "q-sign-label" };
const _hoisted_26$7 = { class: "q-sign-val" };
const _hoisted_27$7 = { key: 1 };
const _hoisted_28$7 = { class: "q-sign-date" };
const _hoisted_29$7 = ["title", "onClick"];
const _hoisted_30$7 = { class: "as-ref-text" };
const _hoisted_31$7 = {
  key: 6,
  class: "q-ro"
};
const _hoisted_32$7 = ["onClick"];
const _hoisted_33$7 = {
  key: 1,
  class: "as-ro-text"
};
const _hoisted_34$6 = {
  key: 2,
  class: "q-signline end"
};
const _hoisted_35$6 = { class: "q-sign-label" };
const _hoisted_36$6 = { class: "q-sign-val" };
const _hoisted_37$6 = { key: 1 };
const _hoisted_38$5 = { class: "q-sign-date" };
const _hoisted_39$5 = ["title", "onClick"];
const _hoisted_40$5 = { class: "as-ref-text" };
const _hoisted_41$5 = {
  key: 6,
  class: "q-ro"
};
const _hoisted_42$5 = { class: "q-section-title" };
const _hoisted_43$5 = { class: "q-section-body" };
const _hoisted_44$5 = { class: "q-sub-label" };
const _hoisted_45$4 = {
  key: 0,
  class: "q-sub-max"
};
const _hoisted_46$4 = {
  key: 1,
  class: "as-ro-text"
};
const _hoisted_47$4 = {
  key: 2,
  class: "as-ro-text"
};
const _hoisted_48$4 = ["onClick"];
const _hoisted_49$4 = {
  key: 4,
  class: "q-signline"
};
const _hoisted_50$4 = { class: "q-sign-label" };
const _hoisted_51$4 = { class: "q-sign-val" };
const _hoisted_52$4 = { key: 1 };
const _hoisted_53$4 = { class: "q-sign-date" };
const _hoisted_54$3 = { class: "q-dept-body" };
const _hoisted_55$3 = { class: "q-dept-sub-head" };
const _hoisted_56$3 = {
  key: 0,
  class: "q-dept-sub-label"
};
const _hoisted_57$3 = {
  key: 1,
  class: "q-checks deco"
};
const _hoisted_58$3 = {
  key: 2,
  class: "q-dept-sign"
};
const _hoisted_59$3 = {
  key: 1,
  class: "as-ro-text"
};
const _hoisted_60$3 = {
  key: 2,
  class: "q-dept-signline"
};
const _hoisted_61$3 = {
  key: 1,
  class: "q-sign-name"
};
const _hoisted_62$3 = { class: "as-no" };
const _hoisted_63$3 = { class: "as-name" };
const _hoisted_64$3 = {
  key: 0,
  class: "as-hint"
};
const _hoisted_65$3 = { class: "as-fill-main" };
const _hoisted_66$3 = {
  key: 3,
  class: "as-ro-text"
};
const _hoisted_67$3 = {
  key: 1,
  class: "as-second"
};
const _hoisted_68$3 = { class: "as-second-label" };
const _hoisted_69$3 = { class: "as-second-value" };
const _hoisted_70$3 = {
  key: 2,
  class: "as-ro-text"
};
const _hoisted_71$3 = { class: "as-no" };
const _hoisted_72$3 = { class: "as-name" };
const _hoisted_73$3 = { class: "as-fill as-fill-multi" };
const _hoisted_74$3 = { class: "as-sub-label" };
const _hoisted_75$3 = {
  key: 1,
  class: "as-ro-text"
};
const _hoisted_76$3 = { class: "as-no" };
const _hoisted_77$3 = { class: "as-name" };
const _hoisted_78$3 = { class: "as-fill" };
const _hoisted_79$3 = ["data-filled"];
const _hoisted_80$3 = { class: "as-phase-head" };
const _hoisted_81$3 = { class: "as-phase-title" };
const _hoisted_82$2 = {
  key: 0,
  class: "as-phase-badge"
};
const _hoisted_83$2 = ["onClick"];
const _hoisted_84$2 = { class: "as-phase-grid" };
const _hoisted_85$2 = { class: "as-phase-row" };
const _hoisted_86$2 = { class: "as-phase-row-label" };
const _hoisted_87$2 = { class: "as-phase-row-value" };
const _hoisted_88$2 = {
  key: 1,
  class: "as-phase-text"
};
const _hoisted_89$2 = { class: "as-phase-row" };
const _hoisted_90$2 = { class: "as-phase-row-label" };
const _hoisted_91$2 = { class: "as-phase-row-value" };
const _hoisted_92$2 = {
  key: 1,
  class: "as-phase-text"
};
const _hoisted_93$2 = { class: "as-phase-row" };
const _hoisted_94$2 = { class: "as-phase-row-label" };
const _hoisted_95$2 = { class: "as-phase-row-value" };
const _hoisted_96$2 = {
  key: 1,
  class: "as-phase-text"
};
const _hoisted_97$2 = { class: "as-phase-row" };
const _hoisted_98$2 = { class: "as-phase-row-label" };
const _hoisted_99$2 = { class: "as-phase-row-value" };
const _hoisted_100$2 = { class: "as-phase-row" };
const _hoisted_101$2 = { class: "as-phase-row-label" };
const _hoisted_102$2 = { class: "as-phase-row-value" };
const _hoisted_103$2 = {
  key: 1,
  class: "as-phase-text"
};
const _hoisted_104$2 = {
  key: 0,
  class: "as-phase-footer"
};
const _hoisted_105$2 = {
  key: 0,
  class: "q-signrow"
};
const _hoisted_106$2 = { class: "q-signitem-label" };
const _hoisted_107$2 = {
  key: 1,
  class: "q-signitem-val"
};
const _hoisted_108$2 = {
  key: 1,
  class: "as-sign-row"
};
const _hoisted_109$2 = { class: "as-sign-val" };
const _hoisted_110$2 = {
  key: 0,
  class: "as-remark"
};
const _hoisted_111$2 = { class: "as-remark-label" };
const _hoisted_112$2 = {
  key: 1,
  class: "as-ro-text as-remark-ro"
};


const _sfc_main$9 = {
  __name: 'DocSheet',
  props: {
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  config: { type: Object, required: true },
  /** 面板编码(阶段完成按钮的 API 目标) */
  panelCode: { type: String, default: '' },
  /** 单据是否已审核(阶段完成按钮仅在审核后可用) */
  audited: { type: Boolean, default: false },
  /** 当前用户(终止审批按钮显隐:一级=立项人姓名匹配,二级=管理员) */
  user: { type: Object, default: () => ({}) },
},
  emits: ['dirty', 'term-changed'],
  setup(__props, { expose: __expose, emit: __emit }) {

const props = __props;
const emit = __emit;

const engine = usePanelRuntime();
const stageLoading = ref(0);

/** 阶段完成按钮可用:非编辑态 + 已审核 */
const canStageComplete = computed(() => !props.editable && props.audited && props.panelCode === 'RD_PLAN');

/** vcell 连续的 pairs 行合成一段(渲染成左侧一格真正的合并竖列):
 *  原图(扫描实测):申请单位 申/请/单/位 四字紧排成一组,组中心 207 ≈ 整段中心 208,
 *  即字组在整条合并格里垂直居中,而非逐行居中;行间横线只画到列右沿(列内无线)。 */
const rowGroups = computed(() => {
  const out = [];
  for (const row of props.config?.rows || []) {
    if (row.kind === 'pairs' && row.vcell !== undefined) {
      let g = out[out.length - 1];
      if (!g?.run) { g = { run: true, rows: [], chars: '' }; out.push(g); }
      g.rows.push(row);
      if (row.vcell) g.chars += row.vcell;
    } else out.push({ row });
  }
  return out
});

/** 签名日期:纸面是 年_月_日 三段空,单字段存 'YYYY-MM-DD'。允许部分填写(如只填年 → '2026-');
 *  全空存 ''。datePart 取段,setDatePart 只改本段、只留数字(年 4 位/月日 2 位)。 */
const datePart = (key, p) => {
  const s = String(props.head?.[key] ?? '').split('-');
  return (p === 'y' ? s[0] : p === 'm' ? s[1] : s[2]) || ''
};
const setDatePart = (key, p, v) => {
  const parts = [datePart(key, 'y'), datePart(key, 'm'), datePart(key, 'd')];
  parts[p === 'y' ? 0 : p === 'm' ? 1 : 2] = String(v ?? '').replace(/\D/g, '').slice(0, p === 'y' ? 4 : 2);
  props.head[key] = parts.every(x => !x) ? '' : parts.join('-');
  emit('dirty');
};

/** 阶段计划开始:归一空值(清空时 el-date-picker 给 null),别把 null 存进库 */
function onPhaseStart(phaseKey, v) {
  props.head[phaseKey + '_计划开始'] = v || '';
  emit('dirty');
}

/** 阶段计划完成:同上归一,并把下一阶段的「计划开始」接上次日(仅当其为空) */
function onPhaseDone(phaseKey, v) {
  props.head[phaseKey + '_计划完成'] = v || '';
  const n = Number(String(phaseKey).replace(/[^0-9]/g, ''));
  if (n) chainNextStageStart(props.head, n);
  emit('dirty');
}
async function doStageComplete(stageNum) {
  stageLoading.value = stageNum;
  try {
    const no = props.head['单据编号'] || props.head['编号'] || '';
    const res = await engine.callButton({
      panelCode: props.panelCode,
      buttonName: '阶段完成',
      formData: { 编号: no, 阶段序号: String(stageNum) },
      buttonParam: {},
    });
    if (res?.['实际完成']) {
      props.head[`阶段${stageNum}_实际完成`] = res['实际完成'];
      ElMessage.success(`阶段${stageNum} 已完成 (${res['实际完成']})`);
    }
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || `阶段${stageNum} 完成失败`);
  } finally {
    stageLoading.value = 0;
  }
}

// ── 申请终止(阶段处)二级审批:立项人 → 管理员 → 落实终止(2026-09-11) ──
// 状态源 GET /px/planTerm(yj_plan_term 一单一行);动作走 callButton;动作后刷新状态并通知父级重载单据状态。
const term = ref(null);
const docNoOf = () => props.head['单据编号'] || props.head['编号'] || '';
async function loadTerm() {
  if (props.panelCode !== 'RD_PLAN') { term.value = null; return }
  const no = docNoOf();
  if (!no) { term.value = null; return }
  try {
    const res = await request.get('/px/planTerm', { params: { code: no } });
    term.value = res?.data || null;
  } catch { term.value = null; }
}
watch(() => [props.panelCode, docNoOf()], () => loadTerm(), { immediate: true });

/** 一级审批权:当前用户姓名 = 立项人(严格口径,姓名匹配;管理员不代审);二级:管理员 */
const canApproveTerm = computed(() => {
  if (!term.value) return false
  if (term.value.state === 'P1') return !!props.user?.realName && props.user.realName === term.value.initiator
  if (term.value.state === 'P2') return !!props.user?.isAdmin
  return false
});
/** 撤回权:发起人本人或管理员(仅 P1/P2) */
const canWithdrawTerm = computed(() => {
  if (!term.value || term.value.state === 'T') return false
  return props.user?.isAdmin || (props.user?.userName && props.user.userName === term.value.req_by)
});

async function doTermRequest(stageNum) {
  let reason = '';
  try {
    const { value } = await ElMessageBox.prompt(
      `${tt('申请终止')}：${tt('终止于阶段')} ${stageNum}。${tt('终止原因（选填）')}：`,
      tt('申请终止'), { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), inputPlaceholder: tt('终止原因（选填）') });
    reason = value || '';
  } catch { return /* 取消 */ }
  try {
    const res = await engine.callButton({ panelCode: props.panelCode, buttonName: '申请终止',
      formData: { 编号: docNoOf(), 阶段序号: String(stageNum), 终止原因: reason }, buttonParam: {} });
    ElMessage.success(`${tt('已提交终止申请')}（${tt('阶段')} ${res?.['阶段'] || stageNum}）→ ${tt('待立项人审批')}`);
    await loadTerm();
    emit('term-changed');
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('提交终止申请失败'));
  }
}

async function doTermAction(buttonName) {
  if (buttonName === '终止审批驳回' || (buttonName === '终止审批通过' && term.value?.state === 'P2')) {
    try {
      const { value } = await ElMessageBox.prompt(
        buttonName === '终止审批通过' ? `${tt('审批意见（选填）')}：` : `${tt('驳回须填写意见')}：`,
        tt(buttonName), { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'),
          inputValidator: buttonName === '终止审批通过' ? undefined : (v) => (v && v.trim() ? true : tt('意见必填')) });
      var opinion = value || '';
    } catch { return /* 取消 */ }
    try {
      await engine.callButton({ panelCode: props.panelCode, buttonName,
        formData: { 编号: docNoOf(), 审批意见: opinion }, buttonParam: {} });
    } catch (e) { ElMessage.error(engine.errMsg(e) || tt('操作失败')); return }
  } else {
    try {
      await engine.callButton({ panelCode: props.panelCode, buttonName, formData: { 编号: docNoOf() }, buttonParam: {} });
    } catch (e) { ElMessage.error(engine.errMsg(e) || tt('操作失败')); return }
  }
  ElMessage.success(tt('操作成功'));
  await loadTerm();
  emit('term-changed');
}

// 阶段框显示状态(本地视图;导出/打印按当前实际显示渲染)
const phaseHidden = reactive({});

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])));
/** 字段级只读(元数据 editable=0 → readonly):文书锁定字段(申请立项人/负责人)按纯文本显示,不可改 */
function signLocked(c) {
  return !!(fieldMap.value.get(c.key) || {}).readonly
}
/**
 * 签名格同口径只读(2026-10-04):签名格绑的是 signKey(可能不是 c.key 本身 —— 如特采理由行的
 * 「申请人」绑 编制人、底部落款「批准」绑 审批人),此前这些格子**不认**字段只读,于是
 * 元数据把字段设成只读、界面上却照样能打字。特采单两级审批要求「编制/审核/批准」三格全自动
 * 不可改,故统一按 signKey 的字段元数据判只读(不给 signKey 时按历史缺省 '填写人')。
 */
function signKeyLocked(c) {
  const key = (c && c.signKey) || '填写人';
  return !!(fieldMap.value.get(key) || {}).readonly
}

// 右上信息表:未配置 config.info 时保持 文件管理人/密级/文件使用范围 三行(立项申请/实施计划原样)
const DEFAULT_INFO = [
  { label: '文件管理人', key: '文件管理人' },
  { label: '密级', key: '密级' },
  { label: '文件使用范围', key: '文件使用范围' },
];
const infoRows = computed(() => props.config.info || DEFAULT_INFO);

function selectOptions(key) {
  const f = fieldMap.value.get(key);
  const opts = f?.options || [];
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// 网格行单元格下拉:配置 options 优先,其次字段字典
function cellOptions(c) {
  if (c.options && c.options.length) {
    return c.options.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
  }
  return selectOptions(c.key)
}

// 勾选(单选语义,存选项值);只读态仅展示,点击无效
function setCheck(key, o) {
  if (!props.editable || !key) return
  if (props.head[key] !== o) {
    props.head[key] = o;
    emit('dirty');
  }
}

// ── 参照字段(文档编号 → 立项申请右上角编号):点击右上角弹参照,确认后按 refMap 带回(密级等) ──
function isRefKey(key) {
  if (!key) return false
  const f = fieldMap.value.get(key);
  return !!(f && f.refPanel)
}
const prodRefVisible = ref(false);
const prodRefKey = ref('');
const prodRefField = computed(() => fieldMap.value.get(prodRefKey.value) || null);
function openProdRef(key) {
  if (!props.editable || !isRefKey(key)) return
  prodRefKey.value = key;
  prodRefVisible.value = true;
}
function onProdRefConfirm(rows) {
  const f = prodRefField.value;
  const source = rows?.[0];
  if (!f || !source) return
  const refField = f.refField || f.dataName;
  props.head[prodRefKey.value] = source[refField] ?? '';
  for (const m of f.refMap || []) {
    if (m && source[m.from] !== undefined) props.head[m.to || m.from] = source[m.from];
  }
  prodRefVisible.value = false;
  emit('dirty');
}

// ── 校验定位(供 PanelxList 保存校验调用):滚动到该字段行并琥珀闪烁 ──
function focusField(label) {
  if (!label) return false
  nextTick(() => {
    const root = document.querySelector('.approval-sheet');
    if (!root) return
    const el = [...root.querySelectorAll('.as-name, .as-info-label, .as-sub-label, .q-label, .q-section-title, .q-dept-name, .q-dept-sub-label')]
      .find((e) => (e.textContent || '').trim() === label)
    || [...root.querySelectorAll('.as-name, .as-info-label, .as-sub-label, .q-label, .q-section-title, .q-dept-name, .q-dept-sub-label')]
        .find((e) => (e.textContent || '').includes(label));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('field-blink');
      setTimeout(() => el.classList.remove('field-blink'), 3200);
    }
  });
  return true
}
__expose({ focusField });

return (_ctx, _cache) => {
  const _component_el_icon = ElIcon;
  const _component_el_input = ElInput;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;

  return (openBlock(), createElementBlock("div", _hoisted_1$9, [
    (__props.panelCode === 'RD_PLAN' && term.value)
      ? (openBlock(), createElementBlock("div", {
          key: 0,
          class: normalizeClass(["as-term-banner no-print-term", 'term-' + term.value.state])
        }, [
          (term.value.state === 'T')
            ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                createBaseVNode("span", _hoisted_2$9, toDisplayString(unref(tt)('已终止')), 1),
                createBaseVNode("span", _hoisted_3$9, toDisplayString(unref(tt)('终止于阶段')) + " " + toDisplayString(term.value.stage) + " · " + toDisplayString(unref(tt)('落实于')) + " " + toDisplayString(term.value.p2_at || '') + "（" + toDisplayString(term.value.p2_by || '') + "）", 1)
              ], 64))
            : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                createBaseVNode("span", _hoisted_4$9, toDisplayString(unref(tt)(term.value.state === 'P1' ? '终止审批中（立项人）' : '终止审批中（管理员）')), 1),
                createBaseVNode("span", _hoisted_5$9, [
                  createTextVNode(toDisplayString(unref(tt)('终止于阶段')) + " " + toDisplayString(term.value.stage) + " · " + toDisplayString(unref(tt)('发起人')) + " " + toDisplayString(term.value.req_by || ''), 1),
                  (term.value.reason)
                    ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                        createTextVNode(" · " + toDisplayString(unref(tt)('原因')) + "：" + toDisplayString(term.value.reason), 1)
                      ], 64))
                    : createCommentVNode("", true)
                ]),
                (canApproveTerm.value)
                  ? (openBlock(), createElementBlock("span", _hoisted_6$9, [
                      createVNode(unref(ElButton), {
                        type: "danger",
                        size: "small",
                        onClick: _cache[0] || (_cache[0] = $event => (doTermAction('终止审批通过')))
                      }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(unref(tt)('终止审批通过')), 1)
                        ]),
                        _: 1
                      }),
                      createVNode(unref(ElButton), {
                        size: "small",
                        onClick: _cache[1] || (_cache[1] = $event => (doTermAction('终止审批驳回')))
                      }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(unref(tt)('终止审批驳回')), 1)
                        ]),
                        _: 1
                      })
                    ]))
                  : (canWithdrawTerm.value)
                    ? (openBlock(), createElementBlock("span", _hoisted_7$8, [
                        createVNode(unref(ElButton), {
                          size: "small",
                          onClick: _cache[2] || (_cache[2] = $event => (doTermAction('撤回终止申请')))
                        }, {
                          default: withCtx(() => [
                            createTextVNode(toDisplayString(unref(tt)('撤回终止申请')), 1)
                          ]),
                          _: 1
                        })
                      ]))
                    : createCommentVNode("", true)
              ], 64))
        ], 2))
      : createCommentVNode("", true),
    createBaseVNode("div", _hoisted_8$8, [
      _cache[39] || (_cache[39] = createBaseVNode("div", { class: "as-company" }, "惠州市银嘉环保科技有限公司", -1)),
      createBaseVNode("div", _hoisted_9$7, [
        (__props.editable && isRefKey('文档编号'))
          ? (openBlock(), createElementBlock("div", {
              key: 0,
              class: "as-ref-ctl",
              title: unref(tt)('点击选择'),
              onClick: _cache[3] || (_cache[3] = $event => (openProdRef('文档编号')))
            }, [
              createBaseVNode("span", {
                class: normalizeClass(["as-ref-text", { 'is-empty': !__props.head['文档编号'] }])
              }, toDisplayString(__props.head['文档编号'] || unref(tt)('文档编号：')), 3),
              createVNode(_component_el_icon, { class: "as-ref-ico" }, {
                default: withCtx(() => [
                  createVNode(unref(search_default))
                ]),
                _: 1
              })
            ], 8, _hoisted_10$7))
          : (__props.editable)
            ? (openBlock(), createBlock(_component_el_input, {
                key: 1,
                modelValue: __props.head['文档编号'],
                "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((__props.head['文档编号']) = $event)),
                size: "small",
                maxlength: "30",
                class: "as-docno-input",
                placeholder: unref(tt)('文档编号：'),
                onInput: _cache[5] || (_cache[5] = $event => (emit('dirty')))
              }, null, 8, ["modelValue", "placeholder"]))
            : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                createTextVNode(toDisplayString(__props.head['文档编号'] || __props.head['单据编号'] || __props.config.docno || 'YJ-XS002'), 1)
              ], 64))
      ])
    ]),
    createBaseVNode("div", _hoisted_11$7, [
      createBaseVNode("div", _hoisted_12$7, [
        createTextVNode(toDisplayString(unref(tt)(__props.config.titlePart1)), 1),
        (__props.config.titlePart2)
          ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
              createTextVNode("（" + toDisplayString(unref(tt)(__props.config.titlePart2)) + "）", 1)
            ], 64))
          : createCommentVNode("", true),
        (__props.config.titlePart3)
          ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
              createTextVNode(toDisplayString(unref(tt)(__props.config.titlePart3)), 1)
            ], 64))
          : createCommentVNode("", true)
      ]),
      createBaseVNode("div", _hoisted_13$7, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(infoRows.value, (info) => {
          return (openBlock(), createElementBlock("div", {
            key: info.key || info.label,
            class: "as-info-row"
          }, [
            createBaseVNode("span", _hoisted_14$7, toDisplayString(unref(tt)(info.label)), 1),
            createBaseVNode("span", _hoisted_15$7, [
              (info.kind === 'static')
                ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                    createTextVNode(toDisplayString(unref(tt)(info.text || '')), 1)
                  ], 64))
                : (__props.editable && isRefKey(info.key))
                  ? (openBlock(), createElementBlock("div", {
                      key: 1,
                      class: "as-ref-ctl",
                      title: unref(tt)('点击选择'),
                      onClick: $event => (openProdRef(info.key))
                    }, [
                      createBaseVNode("span", _hoisted_17$7, toDisplayString(__props.head[info.key] || unref(tt)('点击选择')), 1),
                      createVNode(_component_el_icon, { class: "as-ref-ico" }, {
                        default: withCtx(() => [
                          createVNode(unref(search_default))
                        ]),
                        _: 1
                      })
                    ], 8, _hoisted_16$7))
                  : (__props.editable && info.kind === 'date')
                    ? (openBlock(), createBlock(_component_el_date_picker, {
                        key: 2,
                        modelValue: __props.head[info.key],
                        "onUpdate:modelValue": $event => ((__props.head[info.key]) = $event),
                        type: "date",
                        "value-format": "YYYY-MM-DD",
                        size: "small",
                        class: "as-date",
                        clearable: false,
                        onChange: _cache[6] || (_cache[6] = $event => (emit('dirty')))
                      }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                    : (__props.editable && (info.kind === 'select' || selectOptions(info.key).length))
                      ? (openBlock(), createBlock(_component_el_select, {
                          key: 3,
                          modelValue: __props.head[info.key],
                          "onUpdate:modelValue": $event => ((__props.head[info.key]) = $event),
                          size: "small",
                          class: "as-cell-input",
                          clearable: false,
                          onChange: _cache[7] || (_cache[7] = $event => (emit('dirty')))
                        }, {
                          default: withCtx(() => [
                            (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions(info.key), (o) => {
                              return (openBlock(), createBlock(_component_el_option, {
                                key: o.value,
                                label: o.label,
                                value: o.value
                              }, null, 8, ["label", "value"]))
                            }), 128))
                          ]),
                          _: 2
                        }, 1032, ["modelValue", "onUpdate:modelValue"]))
                      : (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 4,
                            modelValue: __props.head[info.key],
                            "onUpdate:modelValue": $event => ((__props.head[info.key]) = $event),
                            size: "small",
                            maxlength: "50",
                            class: "as-cell-input",
                            onInput: _cache[8] || (_cache[8] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock(Fragment, { key: 5 }, [
                            createTextVNode(toDisplayString(__props.head[info.key] || ''), 1)
                          ], 64))
            ])
          ]))
        }), 128))
      ])
    ]),
    createBaseVNode("div", _hoisted_18$7, [
      createBaseVNode("div", _hoisted_19$7, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(rowGroups.value, ({ row, run, rows, chars }, gi) => {
          return (openBlock(), createElementBlock(Fragment, { key: gi }, [
            run
              ? (openBlock(), createElementBlock("div", _hoisted_20$7, [
                  createBaseVNode("div", {
                    class: "q-vlabel",
                    style: normalizeStyle({ width: (__props.config.vcol || 65) + 'px' })
                  }, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(chars, (ch, ci) => {
                      return (openBlock(), createElementBlock("span", {
                        key: ci,
                        class: "q-vchar"
                      }, toDisplayString(unref(tt)(ch)), 1))
                    }), 128))
                  ], 4),
                  createBaseVNode("div", _hoisted_21$7, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(rows, (row, ri) => {
                      return (openBlock(), createElementBlock("div", {
                        key: row.key || row.label || ri,
                        class: "as-row q-pairs",
                        style: normalizeStyle({ minHeight: (row.h || 40) + 'px' })
                      }, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(row.cells, (c, ci) => {
                          return (openBlock(), createElementBlock("div", {
                            key: (c.key || c.label) + ci,
                            class: "q-pair",
                            style: normalizeStyle({ flex: c.flex || 1 })
                          }, [
                            (c.label)
                              ? (openBlock(), createElementBlock("div", {
                                  key: 0,
                                  class: "q-label",
                                  style: normalizeStyle({ width: (c.labelW || row.labelW || __props.config.labelW || 110) + 'px' })
                                }, toDisplayString(unref(tt)(c.label)), 5))
                              : createCommentVNode("", true),
                            createBaseVNode("div", {
                              class: normalizeClass(["q-value", { 'q-col': c.kind === 'textarea' }])
                            }, [
                              (c.kind === 'checks')
                                ? (openBlock(), createElementBlock("div", {
                                    key: 0,
                                    class: normalizeClass(["q-checks", { spread: c.spread }])
                                  }, [
                                    (openBlock(true), createElementBlock(Fragment, null, renderList(c.options, (o) => {
                                      return (openBlock(), createElementBlock("span", {
                                        key: o,
                                        class: normalizeClass(["q-check", { on: __props.head[c.key] === o }]),
                                        onClick: $event => (setCheck(c.key, o))
                                      }, toDisplayString(__props.head[c.key] === o ? '☑' : '□') + " " + toDisplayString(unref(tt)(o)), 11, _hoisted_22$7))
                                    }), 128))
                                  ], 2))
                                : (c.kind === 'textarea')
                                  ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                      (__props.editable)
                                        ? (openBlock(), createBlock(_component_el_input, {
                                            key: 0,
                                            modelValue: __props.head[c.key],
                                            "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                            type: "textarea",
                                            rows: c.rows || 3,
                                            maxlength: c.max || 2000,
                                            class: "as-fill-input as-fill-area",
                                            resize: "none",
                                            onInput: _cache[9] || (_cache[9] = $event => (emit('dirty')))
                                          }, null, 8, ["modelValue", "onUpdate:modelValue", "rows", "maxlength"]))
                                        : (openBlock(), createElementBlock("div", _hoisted_23$7, toDisplayString(__props.head[c.key] || ''), 1)),
                                      (c.sign)
                                        ? (openBlock(), createElementBlock("div", _hoisted_24$7, [
                                            createBaseVNode("span", _hoisted_25$7, toDisplayString(unref(tt)(c.sign)) + "：", 1),
                                            createBaseVNode("span", _hoisted_26$7, [
                                              (__props.editable && !signKeyLocked(c))
                                                ? (openBlock(), createBlock(_component_el_input, {
                                                    key: 0,
                                                    modelValue: __props.head[c.signKey || '填写人'],
                                                    "onUpdate:modelValue": $event => ((__props.head[c.signKey || '填写人']) = $event),
                                                    size: "small",
                                                    maxlength: "50",
                                                    class: "as-cell-input q-sign-input",
                                                    onInput: _cache[10] || (_cache[10] = $event => (emit('dirty')))
                                                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                                : (openBlock(), createElementBlock("span", _hoisted_27$7, toDisplayString(__props.head[c.signKey || '填写人'] || ''), 1))
                                            ]),
                                            createBaseVNode("span", _hoisted_28$7, [
                                              (c.dateKey && __props.editable)
                                                ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                                    createVNode(_component_el_input, {
                                                      class: "as-cell-input q-date-in q-dy",
                                                      size: "small",
                                                      "model-value": datePart(c.dateKey, 'y'),
                                                      "onUpdate:modelValue": v => setDatePart(c.dateKey, 'y', v)
                                                    }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                                    createTextVNode(" " + toDisplayString(unref(tt)('年')) + " ", 1),
                                                    createVNode(_component_el_input, {
                                                      class: "as-cell-input q-date-in q-dm",
                                                      size: "small",
                                                      "model-value": datePart(c.dateKey, 'm'),
                                                      "onUpdate:modelValue": v => setDatePart(c.dateKey, 'm', v)
                                                    }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                                    createTextVNode(" " + toDisplayString(unref(tt)('月')) + " ", 1),
                                                    createVNode(_component_el_input, {
                                                      class: "as-cell-input q-date-in q-dm",
                                                      size: "small",
                                                      "model-value": datePart(c.dateKey, 'd'),
                                                      "onUpdate:modelValue": v => setDatePart(c.dateKey, 'd', v)
                                                    }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                                    createTextVNode(" " + toDisplayString(unref(tt)('日')), 1)
                                                  ], 64))
                                                : (c.dateKey && __props.head[c.dateKey])
                                                  ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                                      createTextVNode(toDisplayString(datePart(c.dateKey, 'y')) + " " + toDisplayString(unref(tt)('年')) + " " + toDisplayString(datePart(c.dateKey, 'm')) + " " + toDisplayString(unref(tt)('月')) + " " + toDisplayString(datePart(c.dateKey, 'd')) + " " + toDisplayString(unref(tt)('日')), 1)
                                                    ], 64))
                                                  : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                                                      createTextVNode("　　　　　" + toDisplayString(unref(tt)('年')) + "　　" + toDisplayString(unref(tt)('月')) + "　　" + toDisplayString(unref(tt)('日')), 1)
                                                    ], 64))
                                            ])
                                          ]))
                                        : createCommentVNode("", true)
                                    ], 64))
                                  : (__props.editable && isRefKey(c.key))
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 2,
                                        class: "as-ref-ctl",
                                        title: unref(tt)('点击选择'),
                                        onClick: $event => (openProdRef(c.key))
                                      }, [
                                        createBaseVNode("span", _hoisted_30$7, toDisplayString(__props.head[c.key] || unref(tt)('点击选择')), 1),
                                        createVNode(_component_el_icon, { class: "as-ref-ico" }, {
                                          default: withCtx(() => [
                                            createVNode(unref(search_default))
                                          ]),
                                          _: 1
                                        })
                                      ], 8, _hoisted_29$7))
                                    : (__props.editable && c.kind === 'date')
                                      ? (openBlock(), createBlock(_component_el_date_picker, {
                                          key: 3,
                                          modelValue: __props.head[c.key],
                                          "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                          type: "date",
                                          "value-format": "YYYY-MM-DD",
                                          size: "small",
                                          class: "as-date",
                                          clearable: false,
                                          onChange: _cache[11] || (_cache[11] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                      : (__props.editable && c.kind === 'select')
                                        ? (openBlock(), createBlock(_component_el_select, {
                                            key: 4,
                                            modelValue: __props.head[c.key],
                                            "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                            size: "small",
                                            class: "as-cell-input",
                                            clearable: false,
                                            onChange: _cache[12] || (_cache[12] = $event => (emit('dirty')))
                                          }, {
                                            default: withCtx(() => [
                                              (openBlock(true), createElementBlock(Fragment, null, renderList(cellOptions(c), (o) => {
                                                return (openBlock(), createBlock(_component_el_option, {
                                                  key: o.value,
                                                  label: o.label,
                                                  value: o.value
                                                }, null, 8, ["label", "value"]))
                                              }), 128))
                                            ]),
                                            _: 2
                                          }, 1032, ["modelValue", "onUpdate:modelValue"]))
                                        : (__props.editable)
                                          ? (openBlock(), createBlock(_component_el_input, {
                                              key: 5,
                                              modelValue: __props.head[c.key],
                                              "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                              size: "small",
                                              maxlength: c.max || 200,
                                              class: "as-cell-input",
                                              onInput: _cache[13] || (_cache[13] = $event => (emit('dirty')))
                                            }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                          : (openBlock(), createElementBlock("div", _hoisted_31$7, toDisplayString(__props.head[c.key] || ''), 1))
                            ], 2)
                          ], 4))
                        }), 128))
                      ], 4))
                    }), 128))
                  ])
                ]))
              : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                  (row.kind === 'pairs')
                    ? (openBlock(), createElementBlock("div", {
                        key: 0,
                        class: "as-row q-pairs",
                        style: normalizeStyle({ minHeight: (row.h || 40) + 'px' })
                      }, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(row.cells, (c, ci) => {
                          return (openBlock(), createElementBlock("div", {
                            key: (c.key || c.label) + ci,
                            class: "q-pair",
                            style: normalizeStyle({ flex: c.flex || 1 })
                          }, [
                            (c.label)
                              ? (openBlock(), createElementBlock("div", {
                                  key: 0,
                                  class: "q-label",
                                  style: normalizeStyle({ width: (c.labelW || row.labelW || __props.config.labelW || 110) + 'px' })
                                }, toDisplayString(unref(tt)(c.label)), 5))
                              : createCommentVNode("", true),
                            createBaseVNode("div", {
                              class: normalizeClass(["q-value", { 'q-col': c.kind === 'textarea' }])
                            }, [
                              (c.kind === 'checks')
                                ? (openBlock(), createElementBlock("div", {
                                    key: 0,
                                    class: normalizeClass(["q-checks", { spread: c.spread }])
                                  }, [
                                    (openBlock(true), createElementBlock(Fragment, null, renderList(c.options, (o) => {
                                      return (openBlock(), createElementBlock("span", {
                                        key: o,
                                        class: normalizeClass(["q-check", { on: __props.head[c.key] === o }]),
                                        onClick: $event => (setCheck(c.key, o))
                                      }, toDisplayString(__props.head[c.key] === o ? '☑' : '□') + " " + toDisplayString(unref(tt)(o)), 11, _hoisted_32$7))
                                    }), 128))
                                  ], 2))
                                : (c.kind === 'textarea')
                                  ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                      (__props.editable)
                                        ? (openBlock(), createBlock(_component_el_input, {
                                            key: 0,
                                            modelValue: __props.head[c.key],
                                            "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                            type: "textarea",
                                            rows: c.rows || 3,
                                            maxlength: c.max || 2000,
                                            class: "as-fill-input as-fill-area",
                                            resize: "none",
                                            onInput: _cache[14] || (_cache[14] = $event => (emit('dirty')))
                                          }, null, 8, ["modelValue", "onUpdate:modelValue", "rows", "maxlength"]))
                                        : (openBlock(), createElementBlock("div", _hoisted_33$7, toDisplayString(__props.head[c.key] || ''), 1)),
                                      (c.sign)
                                        ? (openBlock(), createElementBlock("div", _hoisted_34$6, [
                                            createBaseVNode("span", _hoisted_35$6, toDisplayString(unref(tt)(c.sign)) + "：", 1),
                                            createBaseVNode("span", _hoisted_36$6, [
                                              (__props.editable && !signKeyLocked(c))
                                                ? (openBlock(), createBlock(_component_el_input, {
                                                    key: 0,
                                                    modelValue: __props.head[c.signKey || '填写人'],
                                                    "onUpdate:modelValue": $event => ((__props.head[c.signKey || '填写人']) = $event),
                                                    size: "small",
                                                    maxlength: "50",
                                                    class: "as-cell-input q-sign-input",
                                                    onInput: _cache[15] || (_cache[15] = $event => (emit('dirty')))
                                                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                                : (openBlock(), createElementBlock("span", _hoisted_37$6, toDisplayString(__props.head[c.signKey || '填写人'] || ''), 1))
                                            ]),
                                            createBaseVNode("span", _hoisted_38$5, [
                                              (c.dateKey && __props.editable)
                                                ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                                    createVNode(_component_el_input, {
                                                      class: "as-cell-input q-date-in q-dy",
                                                      size: "small",
                                                      "model-value": datePart(c.dateKey, 'y'),
                                                      "onUpdate:modelValue": v => setDatePart(c.dateKey, 'y', v)
                                                    }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                                    createTextVNode(" " + toDisplayString(unref(tt)('年')) + " ", 1),
                                                    createVNode(_component_el_input, {
                                                      class: "as-cell-input q-date-in q-dm",
                                                      size: "small",
                                                      "model-value": datePart(c.dateKey, 'm'),
                                                      "onUpdate:modelValue": v => setDatePart(c.dateKey, 'm', v)
                                                    }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                                    createTextVNode(" " + toDisplayString(unref(tt)('月')) + " ", 1),
                                                    createVNode(_component_el_input, {
                                                      class: "as-cell-input q-date-in q-dm",
                                                      size: "small",
                                                      "model-value": datePart(c.dateKey, 'd'),
                                                      "onUpdate:modelValue": v => setDatePart(c.dateKey, 'd', v)
                                                    }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                                    createTextVNode(" " + toDisplayString(unref(tt)('日')), 1)
                                                  ], 64))
                                                : (c.dateKey && __props.head[c.dateKey])
                                                  ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                                      createTextVNode(toDisplayString(datePart(c.dateKey, 'y')) + " " + toDisplayString(unref(tt)('年')) + " " + toDisplayString(datePart(c.dateKey, 'm')) + " " + toDisplayString(unref(tt)('月')) + " " + toDisplayString(datePart(c.dateKey, 'd')) + " " + toDisplayString(unref(tt)('日')), 1)
                                                    ], 64))
                                                  : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                                                      createTextVNode("　　　　　" + toDisplayString(unref(tt)('年')) + "　　" + toDisplayString(unref(tt)('月')) + "　　" + toDisplayString(unref(tt)('日')), 1)
                                                    ], 64))
                                            ])
                                          ]))
                                        : createCommentVNode("", true)
                                    ], 64))
                                  : (__props.editable && isRefKey(c.key))
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 2,
                                        class: "as-ref-ctl",
                                        title: unref(tt)('点击选择'),
                                        onClick: $event => (openProdRef(c.key))
                                      }, [
                                        createBaseVNode("span", _hoisted_40$5, toDisplayString(__props.head[c.key] || unref(tt)('点击选择')), 1),
                                        createVNode(_component_el_icon, { class: "as-ref-ico" }, {
                                          default: withCtx(() => [
                                            createVNode(unref(search_default))
                                          ]),
                                          _: 1
                                        })
                                      ], 8, _hoisted_39$5))
                                    : (__props.editable && c.kind === 'date')
                                      ? (openBlock(), createBlock(_component_el_date_picker, {
                                          key: 3,
                                          modelValue: __props.head[c.key],
                                          "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                          type: "date",
                                          "value-format": "YYYY-MM-DD",
                                          size: "small",
                                          class: "as-date",
                                          clearable: false,
                                          onChange: _cache[16] || (_cache[16] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                      : (__props.editable && c.kind === 'select')
                                        ? (openBlock(), createBlock(_component_el_select, {
                                            key: 4,
                                            modelValue: __props.head[c.key],
                                            "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                            size: "small",
                                            class: "as-cell-input",
                                            clearable: false,
                                            onChange: _cache[17] || (_cache[17] = $event => (emit('dirty')))
                                          }, {
                                            default: withCtx(() => [
                                              (openBlock(true), createElementBlock(Fragment, null, renderList(cellOptions(c), (o) => {
                                                return (openBlock(), createBlock(_component_el_option, {
                                                  key: o.value,
                                                  label: o.label,
                                                  value: o.value
                                                }, null, 8, ["label", "value"]))
                                              }), 128))
                                            ]),
                                            _: 2
                                          }, 1032, ["modelValue", "onUpdate:modelValue"]))
                                        : (__props.editable)
                                          ? (openBlock(), createBlock(_component_el_input, {
                                              key: 5,
                                              modelValue: __props.head[c.key],
                                              "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                              size: "small",
                                              maxlength: c.max || 200,
                                              class: "as-cell-input",
                                              onInput: _cache[18] || (_cache[18] = $event => (emit('dirty')))
                                            }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                          : (openBlock(), createElementBlock("div", _hoisted_41$5, toDisplayString(__props.head[c.key] || ''), 1))
                            ], 2)
                          ], 4))
                        }), 128))
                      ], 4))
                    : (row.kind === 'section')
                      ? (openBlock(), createElementBlock("div", {
                          key: 1,
                          class: "as-row q-section",
                          style: normalizeStyle({ minHeight: (row.h || 120) + 'px' })
                        }, [
                          createBaseVNode("div", _hoisted_42$5, toDisplayString(unref(tt)(row.label)), 1),
                          createBaseVNode("div", _hoisted_43$5, [
                            (row.subs)
                              ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(row.subs, (sub) => {
                                  return (openBlock(), createElementBlock("div", {
                                    key: sub.key,
                                    class: "q-sub"
                                  }, [
                                    createBaseVNode("div", _hoisted_44$5, [
                                      createTextVNode(toDisplayString(unref(tt)(sub.label)), 1),
                                      (sub.max)
                                        ? (openBlock(), createElementBlock("span", _hoisted_45$4, "（" + toDisplayString(sub.max) + toDisplayString(unref(tt)('字')) + "）", 1))
                                        : createCommentVNode("", true)
                                    ]),
                                    (__props.editable)
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: __props.head[sub.key],
                                          "onUpdate:modelValue": $event => ((__props.head[sub.key]) = $event),
                                          type: "textarea",
                                          rows: sub.rows || 2,
                                          maxlength: sub.max || 1000,
                                          class: "as-fill-input as-fill-area",
                                          resize: "none",
                                          onInput: _cache[19] || (_cache[19] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "rows", "maxlength"]))
                                      : (openBlock(), createElementBlock("div", _hoisted_46$4, toDisplayString(__props.head[sub.key] || ''), 1))
                                  ]))
                                }), 128))
                              : (__props.editable && row.key && !row.checks)
                                ? (openBlock(), createBlock(_component_el_input, {
                                    key: 1,
                                    modelValue: __props.head[row.key],
                                    "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                                    type: "textarea",
                                    rows: row.rows || 3,
                                    maxlength: row.max || 2000,
                                    class: "as-fill-input as-fill-area",
                                    resize: "none",
                                    onInput: _cache[20] || (_cache[20] = $event => (emit('dirty')))
                                  }, null, 8, ["modelValue", "onUpdate:modelValue", "rows", "maxlength"]))
                                : (row.key && !row.checks)
                                  ? (openBlock(), createElementBlock("div", _hoisted_47$4, toDisplayString(__props.head[row.key] || ''), 1))
                                  : createCommentVNode("", true),
                            (row.checks)
                              ? (openBlock(), createElementBlock("div", {
                                  key: 3,
                                  class: normalizeClass(["q-checks", { spread: row.spread }])
                                }, [
                                  (openBlock(true), createElementBlock(Fragment, null, renderList(row.checks, (o) => {
                                    return (openBlock(), createElementBlock("span", {
                                      key: o,
                                      class: normalizeClass(["q-check", { on: __props.head[row.key] === o }]),
                                      onClick: $event => (setCheck(row.key, o))
                                    }, toDisplayString(__props.head[row.key] === o ? '☑' : '□') + " " + toDisplayString(unref(tt)(o)), 11, _hoisted_48$4))
                                  }), 128))
                                ], 2))
                              : createCommentVNode("", true),
                            (row.sign)
                              ? (openBlock(), createElementBlock("div", _hoisted_49$4, [
                                  createBaseVNode("span", _hoisted_50$4, toDisplayString(unref(tt)(row.sign)) + "：", 1),
                                  createBaseVNode("span", _hoisted_51$4, [
                                    (__props.editable && !signKeyLocked(row))
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: __props.head[row.signKey || '填写人'],
                                          "onUpdate:modelValue": $event => ((__props.head[row.signKey || '填写人']) = $event),
                                          size: "small",
                                          maxlength: "50",
                                          class: "as-cell-input q-sign-input",
                                          onInput: _cache[21] || (_cache[21] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                      : (openBlock(), createElementBlock("span", _hoisted_52$4, toDisplayString(__props.head[row.signKey || '填写人'] || ''), 1))
                                  ]),
                                  createBaseVNode("span", _hoisted_53$4, toDisplayString(unref(tt)('日期')) + "：　　　　　" + toDisplayString(unref(tt)('年')) + "　　" + toDisplayString(unref(tt)('月')) + "　　" + toDisplayString(unref(tt)('日')), 1)
                                ]))
                              : createCommentVNode("", true)
                          ])
                        ], 4))
                      : (row.kind === 'dept')
                        ? (openBlock(), createElementBlock("div", {
                            key: 2,
                            class: "as-row q-dept",
                            style: normalizeStyle({ minHeight: (row.h || 90) + 'px' })
                          }, [
                            createBaseVNode("div", {
                              class: "q-dept-name",
                              style: normalizeStyle({ width: (row.nameW || 130) + 'px' })
                            }, toDisplayString(unref(tt)(row.label)), 5),
                            createBaseVNode("div", _hoisted_54$3, [
                              (openBlock(true), createElementBlock(Fragment, null, renderList(row.subs, (sub, si) => {
                                return (openBlock(), createElementBlock("div", {
                                  key: sub.key,
                                  class: normalizeClass(["q-dept-sub", { first: si === 0, 'q-sub-h': !!sub.flex }]),
                                  style: normalizeStyle(sub.flex ? { flex: sub.flex } : {})
                                }, [
                                  createBaseVNode("div", _hoisted_55$3, [
                                    (sub.label)
                                      ? (openBlock(), createElementBlock("span", _hoisted_56$3, toDisplayString(unref(tt)(sub.label)), 1))
                                      : createCommentVNode("", true),
                                    (sub.checks)
                                      ? (openBlock(), createElementBlock("span", _hoisted_57$3, [
                                          (openBlock(true), createElementBlock(Fragment, null, renderList(sub.checks, (o) => {
                                            return (openBlock(), createElementBlock("span", {
                                              key: o,
                                              class: "q-check"
                                            }, "□ " + toDisplayString(unref(tt)(o)), 1))
                                          }), 128))
                                        ]))
                                      : createCommentVNode("", true),
                                    (!__props.config.deptSignBottom)
                                      ? (openBlock(), createElementBlock("span", _hoisted_58$3, toDisplayString(unref(tt)('签名')) + "：　　　　" + toDisplayString(unref(tt)('年')) + "　　" + toDisplayString(unref(tt)('月')) + "　　" + toDisplayString(unref(tt)('日')), 1))
                                      : createCommentVNode("", true)
                                  ]),
                                  (__props.editable)
                                    ? (openBlock(), createBlock(_component_el_input, {
                                        key: 0,
                                        modelValue: __props.head[sub.key],
                                        "onUpdate:modelValue": $event => ((__props.head[sub.key]) = $event),
                                        type: "textarea",
                                        rows: sub.rows || 2,
                                        maxlength: sub.max || 500,
                                        class: "as-fill-input as-fill-area",
                                        resize: "none",
                                        onInput: _cache[22] || (_cache[22] = $event => (emit('dirty')))
                                      }, null, 8, ["modelValue", "onUpdate:modelValue", "rows", "maxlength"]))
                                    : (openBlock(), createElementBlock("div", _hoisted_59$3, toDisplayString(__props.head[sub.key] || ''), 1)),
                                  (__props.config.deptSignBottom)
                                    ? (openBlock(), createElementBlock("div", _hoisted_60$3, [
                                        (row.signKey)
                                          ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                              createTextVNode(toDisplayString(unref(tt)('签名')) + "： ", 1),
                                              (__props.editable && !signKeyLocked(row))
                                                ? (openBlock(), createBlock(_component_el_input, {
                                                    key: 0,
                                                    modelValue: __props.head[row.signKey],
                                                    "onUpdate:modelValue": $event => ((__props.head[row.signKey]) = $event),
                                                    size: "small",
                                                    maxlength: "50",
                                                    class: "as-cell-input q-sign-input q-sign-name",
                                                    onInput: _cache[23] || (_cache[23] = $event => (emit('dirty')))
                                                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                                : (openBlock(), createElementBlock("span", _hoisted_61$3, toDisplayString(__props.head[row.signKey] || ''), 1))
                                            ], 64))
                                          : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                              createTextVNode(toDisplayString(unref(tt)('签名')) + "：　　　　", 1)
                                            ], 64)),
                                        (row.dateKey)
                                          ? (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                                              (__props.editable)
                                                ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                                    createVNode(_component_el_input, {
                                                      class: "as-cell-input q-date-in q-dy",
                                                      size: "small",
                                                      "model-value": datePart(row.dateKey, 'y'),
                                                      "onUpdate:modelValue": v => setDatePart(row.dateKey, 'y', v)
                                                    }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                                    createTextVNode(" " + toDisplayString(unref(tt)('年')) + " ", 1),
                                                    createVNode(_component_el_input, {
                                                      class: "as-cell-input q-date-in q-dm",
                                                      size: "small",
                                                      "model-value": datePart(row.dateKey, 'm'),
                                                      "onUpdate:modelValue": v => setDatePart(row.dateKey, 'm', v)
                                                    }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                                    createTextVNode(" " + toDisplayString(unref(tt)('月')) + " ", 1),
                                                    createVNode(_component_el_input, {
                                                      class: "as-cell-input q-date-in q-dm",
                                                      size: "small",
                                                      "model-value": datePart(row.dateKey, 'd'),
                                                      "onUpdate:modelValue": v => setDatePart(row.dateKey, 'd', v)
                                                    }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                                    createTextVNode(" " + toDisplayString(unref(tt)('日')), 1)
                                                  ], 64))
                                                : (__props.head[row.dateKey])
                                                  ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                                      createTextVNode(toDisplayString(datePart(row.dateKey, 'y')) + " " + toDisplayString(unref(tt)('年')) + " " + toDisplayString(datePart(row.dateKey, 'm')) + " " + toDisplayString(unref(tt)('月')) + " " + toDisplayString(datePart(row.dateKey, 'd')) + " " + toDisplayString(unref(tt)('日')), 1)
                                                    ], 64))
                                                  : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                                                      createTextVNode("　　　　" + toDisplayString(unref(tt)('年')) + "　　" + toDisplayString(unref(tt)('月')) + "　　" + toDisplayString(unref(tt)('日')), 1)
                                                    ], 64))
                                            ], 64))
                                          : (openBlock(), createElementBlock(Fragment, { key: 3 }, [
                                              createTextVNode(toDisplayString(unref(tt)('年')) + "　　" + toDisplayString(unref(tt)('月')) + "　　" + toDisplayString(unref(tt)('日')), 1)
                                            ], 64))
                                      ]))
                                    : createCommentVNode("", true)
                                ], 6))
                              }), 128))
                            ])
                          ], 4))
                        : (!row.subs && row.kind !== 'phases')
                          ? (openBlock(), createElementBlock("div", {
                              key: 3,
                              class: "as-row",
                              style: normalizeStyle({ minHeight: row.h + 'px' })
                            }, [
                              createBaseVNode("div", _hoisted_62$3, toDisplayString(row.num), 1),
                              createBaseVNode("div", _hoisted_63$3, toDisplayString(unref(tt)(row.label)), 1),
                              createBaseVNode("div", {
                                class: normalizeClass(["as-fill", { 'as-fill-split': !!row.second }])
                              }, [
                                (row.hint)
                                  ? (openBlock(), createElementBlock("div", _hoisted_64$3, toDisplayString(unref(tt)(row.hint)), 1))
                                  : createCommentVNode("", true),
                                createBaseVNode("div", _hoisted_65$3, [
                                  (__props.editable && !signLocked(row) && row.kind === 'input')
                                    ? (openBlock(), createBlock(_component_el_input, {
                                        key: 0,
                                        modelValue: __props.head[row.key],
                                        "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                                        type: "text",
                                        maxlength: row.max || 50,
                                        style: normalizeStyle({ height: (row.h - 14) + 'px' }),
                                        class: "as-fill-input",
                                        onInput: _cache[24] || (_cache[24] = $event => (emit('dirty')))
                                      }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength", "style"]))
                                    : (__props.editable && !signLocked(row) && row.kind === 'select')
                                      ? (openBlock(), createBlock(_component_el_select, {
                                          key: 1,
                                          modelValue: __props.head[row.key],
                                          "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                                          style: normalizeStyle({ height: (row.h - 14) + 'px' }),
                                          class: "as-fill-input as-fill-select",
                                          clearable: false,
                                          placeholder: row.hint ? unref(tt)(row.hint) : unref(tt)('请选择'),
                                          onChange: _cache[25] || (_cache[25] = $event => (emit('dirty')))
                                        }, {
                                          default: withCtx(() => [
                                            (openBlock(true), createElementBlock(Fragment, null, renderList((row.options || []), (o) => {
                                              return (openBlock(), createBlock(_component_el_option, {
                                                key: o.value,
                                                label: unref(tt)(o.label),
                                                value: o.value
                                              }, null, 8, ["label", "value"]))
                                            }), 128))
                                          ]),
                                          _: 2
                                        }, 1032, ["modelValue", "onUpdate:modelValue", "style", "placeholder"]))
                                      : (__props.editable && !signLocked(row))
                                        ? (openBlock(), createBlock(_component_el_input, {
                                            key: 2,
                                            modelValue: __props.head[row.key],
                                            "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                                            type: "textarea",
                                            maxlength: row.max || 2000,
                                            class: "as-fill-input as-fill-area",
                                            resize: "none",
                                            onInput: _cache[26] || (_cache[26] = $event => (emit('dirty')))
                                          }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                        : (openBlock(), createElementBlock("div", _hoisted_66$3, toDisplayString(__props.head[row.key] || ''), 1))
                                ]),
                                (row.second)
                                  ? (openBlock(), createElementBlock("div", _hoisted_67$3, [
                                      createBaseVNode("span", _hoisted_68$3, toDisplayString(unref(tt)(row.second.label)) + "：", 1),
                                      createBaseVNode("span", _hoisted_69$3, [
                                        (__props.editable && !signLocked(row.second) && row.second.kind === 'date')
                                          ? (openBlock(), createBlock(_component_el_date_picker, {
                                              key: 0,
                                              modelValue: __props.head[row.second.key],
                                              "onUpdate:modelValue": $event => ((__props.head[row.second.key]) = $event),
                                              type: "date",
                                              "value-format": "YYYY-MM-DD",
                                              size: "small",
                                              class: "as-date as-second-input",
                                              clearable: false,
                                              onChange: _cache[27] || (_cache[27] = $event => (emit('dirty')))
                                            }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                          : (__props.editable && !signLocked(row.second))
                                            ? (openBlock(), createBlock(_component_el_input, {
                                                key: 1,
                                                modelValue: __props.head[row.second.key],
                                                "onUpdate:modelValue": $event => ((__props.head[row.second.key]) = $event),
                                                size: "small",
                                                maxlength: "50",
                                                class: "as-cell-input as-second-input",
                                                onInput: _cache[28] || (_cache[28] = $event => (emit('dirty')))
                                              }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                            : (openBlock(), createElementBlock("span", _hoisted_70$3, toDisplayString(__props.head[row.second.key] || ''), 1))
                                      ])
                                    ]))
                                  : createCommentVNode("", true)
                              ], 2)
                            ], 4))
                          : (row.subs)
                            ? (openBlock(), createElementBlock("div", {
                                key: 4,
                                class: "as-row",
                                style: normalizeStyle({ minHeight: row.h + 'px' })
                              }, [
                                createBaseVNode("div", _hoisted_71$3, toDisplayString(row.num), 1),
                                createBaseVNode("div", _hoisted_72$3, toDisplayString(unref(tt)(row.label)), 1),
                                createBaseVNode("div", _hoisted_73$3, [
                                  (openBlock(true), createElementBlock(Fragment, null, renderList(row.subs, (sub, si) => {
                                    return (openBlock(), createElementBlock("div", {
                                      key: sub.key,
                                      class: normalizeClass(["as-sub", { first: si === 0 }])
                                    }, [
                                      createBaseVNode("div", _hoisted_74$3, toDisplayString(unref(tt)(sub.label)) + "：" + toDisplayString(sub.max) + toDisplayString(unref(tt)('字')), 1),
                                      (__props.editable)
                                        ? (openBlock(), createBlock(_component_el_input, {
                                            key: 0,
                                            modelValue: __props.head[sub.key],
                                            "onUpdate:modelValue": $event => ((__props.head[sub.key]) = $event),
                                            type: "textarea",
                                            maxlength: sub.max,
                                            rows: "2",
                                            class: "as-fill-input as-fill-area",
                                            resize: "none",
                                            onInput: _cache[29] || (_cache[29] = $event => (emit('dirty')))
                                          }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                        : (openBlock(), createElementBlock("div", _hoisted_75$3, toDisplayString(__props.head[sub.key] || ''), 1))
                                    ], 2))
                                  }), 128))
                                ])
                              ], 4))
                            : (openBlock(), createElementBlock("div", {
                                key: 5,
                                class: "as-row as-row-phases",
                                style: normalizeStyle({ minHeight: (row.h || 200) + 'px' })
                              }, [
                                createBaseVNode("div", _hoisted_76$3, toDisplayString(row.num), 1),
                                createBaseVNode("div", _hoisted_77$3, toDisplayString(unref(tt)(row.label)), 1),
                                createBaseVNode("div", _hoisted_78$3, [
                                  (openBlock(true), createElementBlock(Fragment, null, renderList(row.phases, (ph, pi) => {
                                    return (openBlock(), createElementBlock(Fragment, {
                                      key: ph.key
                                    }, [
                                      (!phaseHidden[pi])
                                        ? (openBlock(), createElementBlock("div", {
                                            key: 0,
                                            class: normalizeClass(["as-phase", { 'as-phase-done': __props.head[ph.key + '_实际完成'] }]),
                                            "data-filled": unref(hasPhaseContent)(__props.head, ph.num) ? '1' : '0'
                                          }, [
                                            createBaseVNode("div", _hoisted_80$3, [
                                              createBaseVNode("span", _hoisted_81$3, toDisplayString(unref(tt)('阶段')) + toDisplayString(ph.num), 1),
                                              (__props.head[ph.key + '_实际完成'])
                                                ? (openBlock(), createElementBlock("span", _hoisted_82$2, toDisplayString(unref(tt)('已完成')), 1))
                                                : createCommentVNode("", true),
                                              createBaseVNode("span", {
                                                class: "as-phase-toggle",
                                                onClick: withModifiers($event => (phaseHidden[pi] = true), ["stop"])
                                              }, toDisplayString(unref(tt)('隐藏')), 9, _hoisted_83$2)
                                            ]),
                                            createBaseVNode("div", _hoisted_84$2, [
                                              createBaseVNode("div", _hoisted_85$2, [
                                                createBaseVNode("span", _hoisted_86$2, toDisplayString(unref(tt)('计划内容')), 1),
                                                createBaseVNode("div", _hoisted_87$2, [
                                                  (__props.editable)
                                                    ? (openBlock(), createBlock(_component_el_input, {
                                                        key: 0,
                                                        modelValue: __props.head[ph.key + '_计划内容'],
                                                        "onUpdate:modelValue": $event => ((__props.head[ph.key + '_计划内容']) = $event),
                                                        type: "textarea",
                                                        autosize: { minRows: 1, maxRows: 3 },
                                                        maxlength: ph.max || 500,
                                                        class: "as-fill-input as-fill-area",
                                                        resize: "none",
                                                        onInput: _cache[30] || (_cache[30] = $event => (emit('dirty')))
                                                      }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                                    : (openBlock(), createElementBlock("span", _hoisted_88$2, toDisplayString(__props.head[ph.key + '_计划内容'] || ''), 1))
                                                ])
                                              ]),
                                              createBaseVNode("div", _hoisted_89$2, [
                                                createBaseVNode("span", _hoisted_90$2, toDisplayString(unref(tt)('计划开始')), 1),
                                                createBaseVNode("div", _hoisted_91$2, [
                                                  (__props.editable)
                                                    ? (openBlock(), createBlock(_component_el_date_picker, {
                                                        key: 0,
                                                        modelValue: __props.head[ph.key + '_计划开始'],
                                                        "onUpdate:modelValue": $event => ((__props.head[ph.key + '_计划开始']) = $event),
                                                        type: "date",
                                                        "value-format": "YYYY-MM-DD",
                                                        format: "YYYY-MM-DD",
                                                        size: "small",
                                                        class: "as-phase-input as-phase-date",
                                                        placeholder: "YYYY-MM-DD",
                                                        onChange: $event => (onPhaseStart(ph.key, $event))
                                                      }, null, 8, ["modelValue", "onUpdate:modelValue", "onChange"]))
                                                    : (openBlock(), createElementBlock("span", _hoisted_92$2, toDisplayString(__props.head[ph.key + '_计划开始'] || ''), 1))
                                                ])
                                              ]),
                                              createBaseVNode("div", _hoisted_93$2, [
                                                createBaseVNode("span", _hoisted_94$2, toDisplayString(unref(tt)('计划完成')), 1),
                                                createBaseVNode("div", _hoisted_95$2, [
                                                  (__props.editable)
                                                    ? (openBlock(), createBlock(_component_el_date_picker, {
                                                        key: 0,
                                                        modelValue: __props.head[ph.key + '_计划完成'],
                                                        "onUpdate:modelValue": $event => ((__props.head[ph.key + '_计划完成']) = $event),
                                                        type: "date",
                                                        "value-format": "YYYY-MM-DD",
                                                        format: "YYYY-MM-DD",
                                                        size: "small",
                                                        class: "as-phase-input as-phase-date",
                                                        placeholder: "YYYY-MM-DD",
                                                        onChange: $event => (onPhaseDone(ph.key, $event))
                                                      }, null, 8, ["modelValue", "onUpdate:modelValue", "onChange"]))
                                                    : (openBlock(), createElementBlock("span", _hoisted_96$2, toDisplayString(__props.head[ph.key + '_计划完成'] || ''), 1))
                                                ])
                                              ]),
                                              createBaseVNode("div", _hoisted_97$2, [
                                                createBaseVNode("span", _hoisted_98$2, toDisplayString(unref(tt)('实际完成')), 1),
                                                createBaseVNode("div", _hoisted_99$2, [
                                                  createBaseVNode("span", {
                                                    class: normalizeClass(["as-phase-text as-phase-actual", { done: __props.head[ph.key + '_实际完成'] }])
                                                  }, toDisplayString(__props.head[ph.key + '_实际完成'] || '—'), 3)
                                                ])
                                              ]),
                                              createBaseVNode("div", _hoisted_100$2, [
                                                createBaseVNode("span", _hoisted_101$2, toDisplayString(unref(tt)('责任人')), 1),
                                                createBaseVNode("div", _hoisted_102$2, [
                                                  (__props.editable)
                                                    ? (openBlock(), createBlock(_component_el_input, {
                                                        key: 0,
                                                        modelValue: __props.head[ph.key + '_责任人'],
                                                        "onUpdate:modelValue": $event => ((__props.head[ph.key + '_责任人']) = $event),
                                                        size: "small",
                                                        class: "as-phase-input",
                                                        maxlength: "50",
                                                        onInput: _cache[31] || (_cache[31] = $event => (emit('dirty')))
                                                      }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                                    : (openBlock(), createElementBlock("span", _hoisted_103$2, toDisplayString(__props.head[ph.key + '_责任人'] || ''), 1))
                                                ])
                                              ])
                                            ]),
                                            (canStageComplete.value && __props.head[ph.key + '_计划内容'])
                                              ? (openBlock(), createElementBlock("div", _hoisted_104$2, [
                                                  (!__props.head[ph.key + '_实际完成'])
                                                    ? (openBlock(), createBlock(unref(ElButton), {
                                                        key: 0,
                                                        type: "success",
                                                        size: "small",
                                                        loading: stageLoading.value === ph.num,
                                                        onClick: withModifiers($event => (doStageComplete(ph.num)), ["stop"])
                                                      }, {
                                                        default: withCtx(() => [
                                                          createTextVNode(toDisplayString(unref(tt)('完成')), 1)
                                                        ]),
                                                        _: 1
                                                      }, 8, ["loading", "onClick"]))
                                                    : createCommentVNode("", true),
                                                  (!term.value)
                                                    ? (openBlock(), createBlock(unref(ElButton), {
                                                        key: 1,
                                                        type: "danger",
                                                        plain: "",
                                                        size: "small",
                                                        onClick: withModifiers($event => (doTermRequest(ph.num)), ["stop"])
                                                      }, {
                                                        default: withCtx(() => [
                                                          createTextVNode(toDisplayString(unref(tt)('申请终止')), 1)
                                                        ]),
                                                        _: 1
                                                      }, 8, ["onClick"]))
                                                    : createCommentVNode("", true)
                                                ]))
                                              : createCommentVNode("", true)
                                          ], 10, _hoisted_79$3))
                                        : createCommentVNode("", true)
                                    ], 64))
                                  }), 128)),
                                  (Object.values(phaseHidden).filter(Boolean).length)
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 0,
                                        class: "as-phase-restore",
                                        onClick: _cache[32] || (_cache[32] = withModifiers($event => (phaseHidden = {}), ["stop"]))
                                      }, toDisplayString(unref(tt)('显示全部')) + "（" + toDisplayString(row.phases.length) + "） ", 1))
                                    : createCommentVNode("", true)
                                ])
                              ], 4))
                ], 64))
          ], 64))
        }), 128)),
        (__props.config.signKind === 'plain')
          ? (openBlock(), createElementBlock("div", _hoisted_105$2, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(__props.config.signCells, (c) => {
                return (openBlock(), createElementBlock("div", {
                  key: c.key,
                  class: "q-signitem",
                  style: normalizeStyle({ flex: c.flex || 1 })
                }, [
                  createBaseVNode("span", _hoisted_106$2, toDisplayString(unref(tt)(c.label)) + "：", 1),
                  (__props.editable && !signLocked(c))
                    ? (openBlock(), createBlock(_component_el_input, {
                        key: 0,
                        modelValue: __props.head[c.key],
                        "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                        size: "small",
                        maxlength: "50",
                        class: "as-cell-input q-signitem-input",
                        onInput: _cache[33] || (_cache[33] = $event => (emit('dirty')))
                      }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                    : (openBlock(), createElementBlock("span", _hoisted_107$2, toDisplayString(__props.head[c.key] || ''), 1))
                ], 4))
              }), 128))
            ]))
          : (openBlock(), createElementBlock("div", _hoisted_108$2, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(__props.config.signCells, (c, ci) => {
                return (openBlock(), createElementBlock("div", {
                  key: c.key,
                  class: "as-sign-pair",
                  style: normalizeStyle({ flex: c.flex })
                }, [
                  createBaseVNode("div", {
                    class: normalizeClass(["as-sign-cell", { 'white-shell': c.white }]),
                    style: normalizeStyle({ width: c.w + 'px' })
                  }, toDisplayString(unref(tt)(c.label)), 7),
                  createBaseVNode("div", _hoisted_109$2, [
                    (__props.editable && c.type === 'text' && !signLocked(c))
                      ? (openBlock(), createBlock(_component_el_input, {
                          key: 0,
                          modelValue: __props.head[c.key],
                          "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                          size: "small",
                          maxlength: "50",
                          class: "as-cell-input",
                          onInput: _cache[34] || (_cache[34] = $event => (emit('dirty')))
                        }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                      : (__props.editable && !signLocked(c))
                        ? (openBlock(), createBlock(_component_el_date_picker, {
                            key: 1,
                            modelValue: __props.head[c.key],
                            "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                            type: "date",
                            "value-format": "YYYY-MM-DD",
                            size: "small",
                            class: "as-date",
                            clearable: false,
                            onChange: _cache[35] || (_cache[35] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                            createTextVNode(toDisplayString(__props.head[c.key] || ''), 1)
                          ], 64))
                  ])
                ], 4))
              }), 128))
            ]))
      ]),
      (__props.config.remark)
        ? (openBlock(), createElementBlock("div", _hoisted_110$2, [
            createBaseVNode("div", _hoisted_111$2, toDisplayString(unref(tt)(__props.config.remark.label)), 1),
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head[__props.config.remark.key],
                  "onUpdate:modelValue": _cache[36] || (_cache[36] = $event => ((__props.head[__props.config.remark.key]) = $event)),
                  type: "textarea",
                  maxlength: __props.config.remark.max || 2000,
                  class: "as-remark-input",
                  resize: "none",
                  onInput: _cache[37] || (_cache[37] = $event => (emit('dirty')))
                }, null, 8, ["modelValue", "maxlength"]))
              : (openBlock(), createElementBlock("div", _hoisted_112$2, toDisplayString(__props.head[__props.config.remark.key] || ''), 1))
          ]))
        : createCommentVNode("", true)
    ]),
    createVNode(RefPickDialog, {
      modelValue: prodRefVisible.value,
      "onUpdate:modelValue": _cache[38] || (_cache[38] = $event => ((prodRefVisible).value = $event)),
      field: prodRefField.value,
      mode: "header",
      onConfirm: onProdRefConfirm
    }, null, 8, ["modelValue", "field"])
  ]))
}
}

};
const DocSheet = /*#__PURE__*/_export_sfc(_sfc_main$9, [['__scopeId',"data-v-9c3baed8"]]);

/* unplugin-vue-components disabled */

/* unplugin-vue-components disabled */

const _hoisted_1$8 = { class: "progress-sheet" };
const _hoisted_2$8 = { class: "ps-topbar" };
const _hoisted_3$8 = { class: "ps-docno" };
const _hoisted_4$8 = { class: "ps-title-row" };
const _hoisted_5$8 = { class: "ps-title" };
const _hoisted_6$8 = { class: "ps-info-table" };
const _hoisted_7$7 = { class: "ps-info-row" };
const _hoisted_8$7 = { class: "ps-info-label" };
const _hoisted_9$6 = { class: "ps-info-value" };
const _hoisted_10$6 = { class: "ps-info-row" };
const _hoisted_11$6 = { class: "ps-info-label" };
const _hoisted_12$6 = { class: "ps-info-value" };
const _hoisted_13$6 = { class: "ps-principle" };
const _hoisted_14$6 = { class: "ps-scroll" };
const _hoisted_15$6 = { class: "ps-table" };
const _hoisted_16$6 = { class: "c-level" };
const _hoisted_17$6 = { class: "c-name" };
const _hoisted_18$6 = { class: "c-sub" };
const _hoisted_19$6 = { class: "c-remark" };
const _hoisted_20$6 = { class: "c-content" };
const _hoisted_21$6 = { class: "c-grade" };
const _hoisted_22$6 = { class: "c-owner" };
const _hoisted_23$6 = { class: "c-progress" };
const _hoisted_24$6 = { class: "c-mile" };
const _hoisted_25$6 = { class: "c-status" };
const _hoisted_26$6 = { class: "c-tester" };
const _hoisted_27$6 = { class: "c-approve" };
const _hoisted_28$6 = { class: "c-inspect" };
const _hoisted_29$6 = { class: "c-reason" };
const _hoisted_30$6 = {
  key: 0,
  class: "c-op"
};
const _hoisted_31$6 = ["rowspan"];
const _hoisted_32$6 = ["title"];
const _hoisted_33$6 = ["rowspan"];
const _hoisted_34$5 = {
  key: 1,
  class: "ps-cell-text ps-name-block"
};
const _hoisted_35$5 = { class: "c-sub" };
const _hoisted_36$5 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_37$5 = { class: "c-remark" };
const _hoisted_38$4 = {
  key: 0,
  class: "ps-code-cell"
};
const _hoisted_39$4 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_40$4 = ["title", "onClick"];
const _hoisted_41$4 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_42$4 = { class: "c-content" };
const _hoisted_43$4 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_44$4 = { class: "c-grade" };
const _hoisted_45$3 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_46$3 = { class: "c-owner" };
const _hoisted_47$3 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_48$3 = { class: "c-progress" };
const _hoisted_49$3 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_50$3 = { class: "c-mile" };
const _hoisted_51$3 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_52$3 = { class: "c-status" };
const _hoisted_53$3 = ["title", "onClick"];
const _hoisted_54$2 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_55$2 = { class: "c-tester" };
const _hoisted_56$2 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_57$2 = { class: "c-approve" };
const _hoisted_58$2 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_59$2 = { class: "c-inspect" };
const _hoisted_60$2 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_61$2 = { class: "c-reason" };
const _hoisted_62$2 = {
  key: 1,
  class: "ps-cell-text"
};
const _hoisted_63$2 = {
  key: 2,
  class: "c-op"
};
const _hoisted_64$2 = ["title", "onClick"];
const _hoisted_65$2 = ["title", "onClick"];
const _hoisted_66$2 = { key: 0 };
const _hoisted_67$2 = ["colspan"];
const _hoisted_68$2 = {
  key: 0,
  class: "ps-addbar"
};
const _hoisted_69$2 = { class: "ps-addbar-tip" };
const _hoisted_70$2 = { class: "ps-dlg-row" };
const _hoisted_71$2 = { class: "ps-dlg-label" };
const _hoisted_72$2 = { class: "ps-dlg-row" };
const _hoisted_73$2 = { class: "ps-dlg-label" };
const _hoisted_74$2 = { class: "ps-dlg-row ps-dlg-row-top" };
const _hoisted_75$2 = { class: "ps-dlg-label" };
const _hoisted_76$2 = { class: "ps-dlg-tip" };
const _hoisted_77$2 = { class: "psd-head" };
const _hoisted_78$2 = { key: 0 };
const _hoisted_79$2 = { class: "psd-sum" };
const _hoisted_80$2 = {
  key: 0,
  class: "psd-next"
};
const _hoisted_81$2 = {
  key: 1,
  class: "psd-empty"
};

/**
 * 界面显示名 → 落库数据键 的映射(唯一真源见 progressColumns.js)。
 *
 * 表头仍显示业务名称,但写进 detail 行的 **键** 必须是 RD_PROGRESS 的元数据列名,
 * 否则后端 ButtonService.labelsToCols(def.fields(), item) 会按元数据把它过滤掉,
 * 值保存后就消失(自动导入写的「预计完成日期」「项目负责人」就是这么丢的)。
 */
const PLAN_LEVEL_KEY = '项目定级';
/** 按项目名称取实施计划里填的等级;没有对应计划则返回空串 */

const _sfc_main$8 = {
  __name: 'ProgressControlSheet',
  props: {
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
},
  emits: ['dirty', 'open-sheets'],
  setup(__props, { expose: __expose, emit: __emit }) {

const K = Object.fromEntries(PROGRESS_COLUMNS.map((c) => [c.label, c.key]));

const props = __props;
const emit = __emit;

const engine = usePanelRuntime();

/** 子项目行(来自当前单据 detail.items;新增行无 id,保存后由引擎写入) */
const items = computed(() => {
  const d = props.head?.detail;
  return d && Array.isArray(d.items) ? d.items : []
});

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])));
function selectOptions(key) {
  const f = fieldMap.value.get(key);
  const opts = f?.options || [];
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// ---------- 项目名称:填选实施计划项目(≤200 条选项;选中带回实施计划同名字段+阶段进度) ----------
const refOptions = ref([]);
const refRows = ref([]);
const refLoading = ref(false);
const planStageMap = ref({}); // 项目名称 → {planNo, head, stages, summary}
/** 今天(YYYY-MM-DD):逾期判定基准 */
function todayStr() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
async function loadRefOptions() {
  if (refOptions.value.length) return
  refLoading.value = true;
  try {
    const res = await engine.queryFormDataList({ panelCode: 'RD_PLAN', condition: {}, pageNo: 1, pageSize: 200 });
    const rows = res.list || [];
    refRows.value = rows;
    // 选项:项目名称（实施计划单号）;同时按阶段进度口径(共用 core/progress 纯函数)提取阶段与汇总
    const stageMap = {};
    const today = todayStr();
    refOptions.value = rows
      .filter((r) => r[K['项目名称']])
      .map((r) => {
        const stages = pickStages(r);
        const summary = summarizeStages(stages, today);
        const planNo = r['单据编号'] || r['编号'] || '';
        const prev = stageMap[r[K['项目名称']]];
        // 同名多张实施计划:取最新一张(列表按单据编号倒序,先到的即最新)
        if (!prev) stageMap[r[K['项目名称']]] = { planNo, head: r, stages, summary, 负责人: r['负责人'] || '' };
        return { value: r[K['项目名称']], label: `${r[K['项目名称']]}（${planNo}）` }
      });
    planStageMap.value = stageMap;
    applyDerivedStatus();
  } catch (e) {
    /* 实施计划未就绪时静默 */
  } finally {
    refLoading.value = false;
  }
}
onMounted(loadRefOptions);
watch(() => props.editable, (v) => { if (v) loadRefOptions(); });

// ---------- 状态列 = 阶段进度自动派生(只读) ----------
/** 状态文案:逐词 tt() 组句,数字由界面拼(便于多语言) */
function statusText(summary) {
  if (!summary) return tt(STATUS_TOKENS.no_plan)
  if (summary.state === 'none') return tt(STATUS_TOKENS.none)
  if (summary.state === 'not_started') return `${tt(STATUS_TOKENS.not_started)} 0/${summary.total}`
  if (summary.state === 'done') return `${tt(STATUS_TOKENS.done)} ${summary.done}/${summary.total}`
  const base = `${tt(STATUS_TOKENS.doing)} ${summary.done}/${summary.total}`;
  return summary.overdue > 0 ? `${base} · ${tt(STATUS_TOKENS.overdue)} ${summary.overdue}` : base
}
/** 该行的实施计划(按项目名称关联;同名多张取最新) */
function planOf(row) {
  const name = String(row?.[K['项目名称']] || '').trim();
  return name ? planStageMap.value[name] || null : null
}
function progressText(row) {
  const name = String(row?.[K['项目名称']] || '').trim();
  if (!name) return ''
  const plan = planStageMap.value[name];
  if (!plan) return Object.keys(planStageMap.value).length ? tt(STATUS_TOKENS.no_plan) : ''
  return statusText(plan.summary)
}
function progressToneOf(row) {
  const plan = planOf(row);
  return plan ? statusTone(plan.summary) : 'idle'
}
/** 载入/刷新把派生状态写回行模型:列表、导出、保存入库口径一致 */
function applyDerivedStatus() {
  const rows = items.value || [];
  if (!rows.length || !Object.keys(planStageMap.value).length) return
  for (const row of rows) {
    const name = String(row?.[K['项目名称']] || '').trim();
    if (!name) continue
    const plan = planStageMap.value[name];
    if (plan) row[K['状态']] = statusLabel(plan.summary);
  }
}
watch(items, () => applyDerivedStatus(), { deep: false });

// ---------- 点状态 → 阶段计划弹窗(只读) ----------
const stageDlgVisible = ref(false);
const stageDlgName = ref('');
const stageDlgRow = ref(null);
function openStageDialog(row) {
  const name = String(row?.[K['项目名称']] || '').trim();
  if (!name) {
    ElMessage.warning(tt('请先填写项目名称'));
    return
  }
  stageDlgName.value = name;
  stageDlgRow.value = row;
  stageDlgVisible.value = true;
}
const stageDlgPlan = computed(() => planStageMap.value[stageDlgName.value] || null);
const stageDlgStages = computed(() => (stageDlgPlan.value ? stageDlgPlan.value.stages : []));
const stageDlgSummary = computed(() => (stageDlgPlan.value ? stageDlgPlan.value.summary : null));
const stageDlgToday = computed(() => todayStr());
function stageBadgeTone(stage) {
  return stageRowState(stage, stageDlgToday.value)
}
function stageBadgeText(stage) {
  const state = stageBadgeTone(stage);
  if (state === 'done') return tt('已完成')
  if (state === 'overdue') return tt('逾期')
  return tt('进行中')
}
function stageDueText(due) {
  return String(due || '').replace(/\//g, '-') || '—'
}
/** 项目预计完成日期 = 最后一个有内容的阶段的计划完成(缺则取实际完成最大值) */
function planDueDate(plan) {
  if (!plan) return ''
  const pick = (key) => (plan.stages || [])
    .map((s) => String(s[key] || '').replace(/\//g, '-'))
    .filter(Boolean)
    .sort();
  const dues = pick('due');
  if (dues.length) return dues[dues.length - 1]
  const actuals = pick('actual');
  return actuals.length ? actuals[actuals.length - 1] : ''
}

// ---------- 项目(组)/子项目 行增删 ----------/** 组首行:与上一行项目名称不同(或首行) → 显示 项目名称/层级 输入,否则并入上一组 */
function isGroupHead(i) {
  if (i <= 0) return true
  return items.value[i]?.[K['项目名称']] !== items.value[i - 1]?.[K['项目名称']]
}
/** 等级头行:只读态相邻同级合并为一个"项目等级"块 */
function isLevelHead(i) {
  if (i <= 0) return true
  const lv = items.value[i]?.[K['项目定级']];
  if (!lv) return true
  return items.value[i - 1]?.[K['项目定级']] !== lv
}
/** 相邻同级行数(等级合并块) */
function levelSpan(i) {
  if (!isLevelHead(i)) return 0
  const lv = items.value[i]?.[K['项目定级']];
  if (!lv) return 1
  let n = 1;
  while (i + n < items.value.length && items.value[i + n]?.[K['项目定级']] === lv) n++;
  return n
}
/** 组内行数(名称列 rowspan 合并铺满整组;空名称新组不合并) */
function groupSpan(i) {
  if (!isGroupHead(i)) return 0
  const name = items.value[i]?.[K['项目名称']];
  if (!name) return 1
  let n = 1;
  while (i + n < items.value.length && items.value[i + n]?.[K['项目名称']] === name) n++;
  return n
}
/** 组首行名称变更:同步组内同名行 + 选实施计划项目带回同名字段 */
function changeGroupName(i, v) {
  const row = items.value[i];
  const old = row[K['项目名称']];
  row[K['项目名称']] = v;
  let j = i + 1;
  while (j < items.value.length && items.value[j][K['项目名称']] === old) {
    items.value[j][K['项目名称']] = v;
    j++;
  }
  const found = refRows.value.find((r) => r[K['项目名称']] === v);
  if (found) {
    const keys = ['项目定级', '测试内容', '测试产品打样要求', '测试目标', '测试条件', '测试方法', '测试标准'];
    for (const k of keys) {
      if (found[k] != null && found[k] !== '') props.head[k] = found[k];
    }
  }
  emit('dirty');
}
/** 新增项目:点击按钮弹窗(项目名称 手填/选实施计划项目),项目等级**不手选** ——
 *  由所选实施计划的「项目定级」自动带入,并据此归入对应等级块(2026-09-22 用户口径)。 */
const dlgVisible = ref(false);
const dlgName = ref('');
/** 弹窗里只读展示的等级:来自所选实施计划,不是用户输入 */
const dlgLevel = ref('');
/** 子项目/尺寸:明细必填项,新增时就一起填,否则整张单据保存会被校验拦下 */
const dlgSub = ref('');
/** 实施计划(RD_PLAN)行里的等级字段名 —— 注意这是**计划侧列名**,
 *  与 RD_PROGRESS 明细的数据键 `项目层级` 不是一回事(本项目规定数据键一律经 K 映射取)。
 *  单列成常量:既表达清楚语义,也避免源码守卫把它误判成"拿显示名当数据键"。 */
function planLevelOf(name) {
  const found = refRows.value.find((r) => r[K['项目名称']] === name);
  return found ? String(found[PLAN_LEVEL_KEY] || '').trim() : ''
}
function onDlgNameChange() {
  dlgLevel.value = planLevelOf(dlgName.value);
}
function openAddProject() {
  dlgName.value = '';
  dlgLevel.value = '';
  dlgSub.value = '';
  dlgVisible.value = true;
}
function confirmAddProject() {
  const name = String(dlgName.value || '').trim();
  if (!name) {
    ElMessage.warning(tt('请填写项目名称'));
    return
  }
  const sub = String(dlgSub.value || '').trim();
  if (!sub) {
    // 子项目/尺寸 是明细必填项:这里拦住并说清楚,免得点了保存才被后端拒绝
    ElMessage.warning(tt('请填写子项目/尺寸'));
    return
  }
  const d = props.head.detail || (props.head.detail = {});
  if (!Array.isArray(d.items)) d.items = [];
  // 等级由实施计划带入(手填的新项目没有计划 ⇒ 留空,等实施计划建好保存时由后端 syncPlanToProgress 兜底带入)
  const lv = planLevelOf(name);
  const row = { [K['项目名称']]: name, [K['子项目/尺寸']]: sub };
  if (lv) row[K['项目定级']] = lv;
  let idx = -1;
  if (lv) {
    for (let i = d.items.length - 1; i >= 0; i--) {
      if (d.items[i][K['项目定级']] === lv) { idx = i; break }
    }
  }
  if (idx >= 0) d.items.splice(idx + 1, 0, row);
  else d.items.push(row);
  // 选实施计划项目:自动导入实施计划相关信息(项目定级/测试内容/…)
  const found = refRows.value.find((r) => r[K['项目名称']] === name);
  if (found) {
    const keys = ['项目定级', '测试内容', '测试产品打样要求', '测试目标', '测试条件', '测试方法', '测试标准'];
    for (const k of keys) {
      if (found[k] != null && found[k] !== '') props.head[k] = found[k];
    }
  }
  // 自动导入阶段进度到「状态」列(与状态列同一口径:core/progress 纯函数)
  const plan = planStageMap.value[name];
  if (plan) {
    row[K['状态']] = statusLabel(plan.summary);
    const due = planDueDate(plan);
    if (due) row[K['预计完成日期']] = due;
    if (plan.负责人) row[K['项目负责人']] = plan.负责人;
  }
  dlgVisible.value = false;
  emit('dirty');
}
/** 在当前子项目后插入同组新子项目(复制所属项目名称/层级) */

/** 同步阶段进度:遍历所有子项目行,从实施计划阶段数据刷新「状态」「预计完成日期」「项目负责人」 */
function syncStageProgress() {
  const d = props.head.detail;
  if (!d || !Array.isArray(d.items) || !d.items.length) {
    ElMessage.warning(tt('暂无子项目可同步'));
    return
  }
  let updated = 0;
  for (const row of d.items) {
    const name = row[K['项目名称']];
    if (!name) continue
    const stage = planStageMap.value[name];
    if (!stage) continue
    row[K['状态']] = statusLabel(stage.summary);
    const due = planDueDate(stage);
    if (due) row[K['预计完成日期']] = due;
    if (stage.负责人) row[K['项目负责人']] = stage.负责人;
    updated++;
  }
  if (updated > 0) {
    ElMessage.success(tt('已同步') + ` ${updated} ` + tt('个子项目的阶段进度') + tt('，请保存入库'));
    emit('dirty');
  } else {
    ElMessage.warning(tt('未找到与实施计划匹配的项目(请确认项目名称一致)'));
  }
}

function insertAfter(i) {
  const d = props.head.detail;
  if (!Array.isArray(d.items)) return
  const src = d.items[i] || {};
  d.items.splice(i + 1, 0, { [K['项目名称']]: src[K['项目名称']], [K['项目定级']]: src[K['项目定级']] });
  emit('dirty');
}
function removeItem(i) {
  const d = props.head.detail;
  if (d && Array.isArray(d.items)) d.items.splice(i, 1);
  emit('dirty');
}

/** 导入 Excel(模板 14 列):解析后追加子项目行到当前控制列表 */
const fileRef = ref(null);
function pickImportFile() {
  fileRef.value?.click();
}
function importExcelFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const XLSX = await __vitePreload(() => import('./xlsx-yBJAythd.js'),true              ?[]:void 0);
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const d = props.head.detail || (props.head.detail = {});
      if (!Array.isArray(d.items)) d.items = [];
      let added = 0;
      for (const r of rows) {
        const name = String(readCell(r, '项目名称') || '').trim();
        if (!name) continue
        const item = {};
        // Excel 表头是"显示名",落库键取 PROGRESS_COLUMNS 的 key(见 progressColumns.js)
        for (const col of PROGRESS_COLUMNS) {
          const v = readCell(r, col.label);
          if (v === undefined || v === null || v === '') continue
          item[col.key] = String(v);
        }
        item[K['项目名称']] = name;
        if (!item[K['项目定级']]) item[K['项目定级']] = '二级';
        d.items.push(item);
        added++;
      }
      if (!added) {
        ElMessage.warning(tt('未识别到有效数据（请确认首行为面板列头且含项目名称）'));
        return
      }
      ElMessage.success(`${tt('已导入')} ${added} ${tt('行，请保存入库')}`);
      emit('dirty');
    } catch (err) {
      ElMessage.error(tt('导入失败') + '：' + (err.message || ''));
    }
  };
  reader.readAsArrayBuffer(file);
}

/** 导出 Excel:面板块信息 + 全部字段列 + 全部数据行(内容完整,不受列宽/纸张限制) */async function exportProgressExcel() {
  const XLSX = await __vitePreload(() => import('./xlsx-yBJAythd.js'),true              ?[]:void 0);
  const head = props.head || {};
  const rows = (head.detail && Array.isArray(head.detail.items) ? head.detail.items : []);
  const title = '产品开发二三四级项目控制列表';
  const info = `惠州市银嘉环保科技有限公司　　文档编号：${head['文档编号'] || 'YJ-XS002'}　　密级：${head['密级'] || ''}　　使用范围：${head['文件使用范围'] || ''}　　单据编号：${head['单据编号'] || ''}`;
  // 表头=显示名(label);取数=落库键(key);列宽也用同一份定义(见 progressColumns.js)
  const header = PROGRESS_COLUMNS.map((c) => c.label);
  const data = rows.map((r) => PROGRESS_COLUMNS.map((c) => r[c.key]));
  const aoa = [[title], [info], [], header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = PROGRESS_COLUMNS.map((c) => ({ wch: c.width }));
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } }];
  // 表头加粗 + 数据单元格自动换行
  const cols = header.length;
  for (let c = 0; c < cols; c++) {
    const cell = ws[{ }];
    if (cell) cell.s = { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true }, fill: { fgColor: { rgb: 'D9ECFB' } } };
  }
  for (let r = 4; r < aoa.length; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = ws[{ }];
      if (cell) cell.s = { alignment: { vertical: 'top', wrapText: true } };
    }
  }
  const c0 = ws[{ }];
  if (c0) c0.s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } };
  const c1 = ws[{ }];
  if (c1) c1.s = { font: { sz: 10, color: { rgb: '666666' } }, alignment: { horizontal: 'left' } };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `${title}-${head['单据编号'] || head['文档编号'] || '导出'}.xlsx`);
}

__expose({ exportProgressExcel });

return (_ctx, _cache) => {
  const _component_el_input = ElInput;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;

  return (openBlock(), createElementBlock("div", _hoisted_1$8, [
    createBaseVNode("div", _hoisted_2$8, [
      _cache[24] || (_cache[24] = createBaseVNode("div", { class: "ps-company" }, "惠州市银嘉环保科技有限公司", -1)),
      createBaseVNode("div", _hoisted_3$8, [
        (__props.editable)
          ? (openBlock(), createBlock(_component_el_input, {
              key: 0,
              modelValue: __props.head['文档编号'],
              "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((__props.head['文档编号']) = $event)),
              size: "small",
              maxlength: "30",
              class: "ps-docno-input",
              onInput: _cache[1] || (_cache[1] = $event => (emit('dirty')))
            }, null, 8, ["modelValue"]))
          : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
              createTextVNode(toDisplayString(__props.head['文档编号'] || 'YJ-XS002'), 1)
            ], 64))
      ])
    ]),
    createBaseVNode("div", _hoisted_4$8, [
      createBaseVNode("div", _hoisted_5$8, toDisplayString(unref(tt)('产品开发二三四级项目控制列表')), 1),
      createBaseVNode("div", _hoisted_6$8, [
        createBaseVNode("div", _hoisted_7$7, [
          createBaseVNode("span", _hoisted_8$7, toDisplayString(unref(tt)('密级')), 1),
          createBaseVNode("span", _hoisted_9$6, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_select, {
                  key: 0,
                  modelValue: __props.head['密级'],
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((__props.head['密级']) = $event)),
                  size: "small",
                  class: "ps-cell-input",
                  clearable: false,
                  onChange: _cache[3] || (_cache[3] = $event => (emit('dirty')))
                }, {
                  default: withCtx(() => [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions('密级'), (o) => {
                      return (openBlock(), createBlock(_component_el_option, {
                        key: o.value,
                        label: o.label,
                        value: o.value
                      }, null, 8, ["label", "value"]))
                    }), 128))
                  ]),
                  _: 1
                }, 8, ["modelValue"]))
              : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                  createTextVNode(toDisplayString(__props.head['密级'] || ''), 1)
                ], 64))
          ])
        ]),
        createBaseVNode("div", _hoisted_10$6, [
          createBaseVNode("span", _hoisted_11$6, toDisplayString(unref(tt)('适用范围')), 1),
          createBaseVNode("span", _hoisted_12$6, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_select, {
                  key: 0,
                  modelValue: __props.head['文件使用范围'],
                  "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((__props.head['文件使用范围']) = $event)),
                  size: "small",
                  class: "ps-cell-input",
                  clearable: false,
                  onChange: _cache[5] || (_cache[5] = $event => (emit('dirty')))
                }, {
                  default: withCtx(() => [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions('文件使用范围'), (o) => {
                      return (openBlock(), createBlock(_component_el_option, {
                        key: o.value,
                        label: o.label,
                        value: o.value
                      }, null, 8, ["label", "value"]))
                    }), 128))
                  ]),
                  _: 1
                }, 8, ["modelValue"]))
              : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                  createTextVNode(toDisplayString(__props.head['文件使用范围'] || ''), 1)
                ], 64))
          ])
        ])
      ])
    ]),
    createBaseVNode("div", _hoisted_13$6, toDisplayString(unref(tt)('项目定级原则')) + "：" + toDisplayString(unref(tt)('1.二级项目-A级或B级客户/该产品一年内有重要经济效益或对应技术产品有重大推广价值/部分对客户认同有重要影响的项目；')) + toDisplayString(unref(tt)('2.三级项目-A级或B级客户/未来（一年后）可能有重要经济效益；')) + toDisplayString(unref(tt)('3.四级项目-简单应对（检测/打样）：如内部简单测试、客户样品测试等')), 1),
    createBaseVNode("div", _hoisted_14$6, [
      createBaseVNode("table", _hoisted_15$6, [
        createBaseVNode("thead", null, [
          createBaseVNode("tr", null, [
            createBaseVNode("th", _hoisted_16$6, toDisplayString(unref(tt)('项目定级')), 1),
            createBaseVNode("th", _hoisted_17$6, toDisplayString(unref(tt)('项目名称')), 1),
            createBaseVNode("th", _hoisted_18$6, toDisplayString(unref(tt)('子项目/尺寸')), 1),
            createBaseVNode("th", _hoisted_19$6, toDisplayString(unref(tt)('项目编号')), 1),
            createBaseVNode("th", _hoisted_20$6, toDisplayString(unref(tt)('内容')), 1),
            createBaseVNode("th", _hoisted_21$6, toDisplayString(unref(tt)('项目发起人')), 1),
            createBaseVNode("th", _hoisted_22$6, toDisplayString(unref(tt)('项目负责人')), 1),
            createBaseVNode("th", _hoisted_23$6, toDisplayString(unref(tt)('立项日期')), 1),
            createBaseVNode("th", _hoisted_24$6, toDisplayString(unref(tt)('预计完成日期')), 1),
            createBaseVNode("th", _hoisted_25$6, toDisplayString(unref(tt)('状态')), 1),
            createBaseVNode("th", _hoisted_26$6, toDisplayString(unref(tt)('测试情况')), 1),
            createBaseVNode("th", _hoisted_27$6, toDisplayString(unref(tt)('技术目标达成')), 1),
            createBaseVNode("th", _hoisted_28$6, toDisplayString(unref(tt)('是否市场转化')), 1),
            createBaseVNode("th", _hoisted_29$6, toDisplayString(unref(tt)('未转换原因')), 1),
            (__props.editable)
              ? (openBlock(), createElementBlock("th", _hoisted_30$6))
              : createCommentVNode("", true)
          ])
        ]),
        createBaseVNode("tbody", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(items.value, (row, i) => {
            return (openBlock(), createElementBlock("tr", {
              key: row.id ?? ('new' + i)
            }, [
              (isLevelHead(i))
                ? (openBlock(), createElementBlock("td", {
                    key: 0,
                    class: "c-level",
                    rowspan: levelSpan(i)
                  }, [
                    createBaseVNode("span", {
                      class: "ps-level-block",
                      title: unref(tt)('项目等级来自项目实施计划，请在实施计划中修改')
                    }, toDisplayString(row[unref(K)['项目定级']] || ''), 9, _hoisted_32$6)
                  ], 8, _hoisted_31$6))
                : createCommentVNode("", true),
              (isGroupHead(i))
                ? (openBlock(), createElementBlock("td", {
                    key: 1,
                    class: "c-name",
                    rowspan: groupSpan(i)
                  }, [
                    (__props.editable)
                      ? (openBlock(), createBlock(_component_el_select, {
                          key: 0,
                          "model-value": row[unref(K)['项目名称']],
                          filterable: "",
                          "allow-create": "",
                          "default-first-option": "",
                          clearable: "",
                          size: "small",
                          loading: refLoading.value,
                          onChange: $event => (changeGroupName(i, $event))
                        }, {
                          default: withCtx(() => [
                            (openBlock(true), createElementBlock(Fragment, null, renderList(refOptions.value, (o) => {
                              return (openBlock(), createBlock(_component_el_option, {
                                key: o.value,
                                label: o.label,
                                value: o.value
                              }, null, 8, ["label", "value"]))
                            }), 128))
                          ]),
                          _: 1
                        }, 8, ["model-value", "loading", "onChange"]))
                      : (openBlock(), createElementBlock("span", _hoisted_34$5, toDisplayString(row[unref(K)['项目名称']] || ''), 1))
                  ], 8, _hoisted_33$6))
                : createCommentVNode("", true),
              createBaseVNode("td", _hoisted_35$5, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: row[unref(K)['子项目/尺寸']],
                      "onUpdate:modelValue": $event => ((row[unref(K)['子项目/尺寸']]) = $event),
                      type: "textarea",
                      autosize: { minRows: 1, maxRows: 4 },
                      size: "small",
                      class: "ps-cell-input",
                      onInput: _cache[6] || (_cache[6] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_36$5, toDisplayString(row[unref(K)['子项目/尺寸']] || ''), 1))
              ]),
              createBaseVNode("td", _hoisted_37$5, [
                (row[unref(K)['项目编号']])
                  ? (openBlock(), createElementBlock("div", _hoisted_38$4, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: row[unref(K)['项目编号']],
                            "onUpdate:modelValue": $event => ((row[unref(K)['项目编号']]) = $event),
                            type: "textarea",
                            autosize: { minRows: 1, maxRows: 4 },
                            size: "small",
                            class: "ps-cell-input",
                            onInput: _cache[7] || (_cache[7] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_39$4, toDisplayString(row[unref(K)['项目编号']]), 1)),
                      createBaseVNode("span", {
                        class: "ps-code-link no-print",
                        title: unref(tt)('查看该项目的数据记录表单据'),
                        onClick: withModifiers($event => (emit('open-sheets', row)), ["stop"])
                      }, "📄", 8, _hoisted_40$4)
                    ]))
                  : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: row[unref(K)['项目编号']],
                            "onUpdate:modelValue": $event => ((row[unref(K)['项目编号']]) = $event),
                            type: "textarea",
                            autosize: { minRows: 1, maxRows: 4 },
                            size: "small",
                            class: "ps-cell-input",
                            onInput: _cache[8] || (_cache[8] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_41$4, toDisplayString(row[unref(K)['项目编号']] || ''), 1))
                    ], 64))
              ]),
              createBaseVNode("td", _hoisted_42$4, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: row[unref(K)['内容']],
                      "onUpdate:modelValue": $event => ((row[unref(K)['内容']]) = $event),
                      type: "textarea",
                      autosize: { minRows: 1, maxRows: 6 },
                      size: "small",
                      class: "ps-cell-input",
                      onInput: _cache[9] || (_cache[9] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_43$4, toDisplayString(row[unref(K)['内容']] || ''), 1))
              ]),
              createBaseVNode("td", _hoisted_44$4, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: row[unref(K)['项目发起人']],
                      "onUpdate:modelValue": $event => ((row[unref(K)['项目发起人']]) = $event),
                      size: "small",
                      class: "ps-cell-input",
                      maxlength: "50",
                      onInput: _cache[10] || (_cache[10] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_45$3, toDisplayString(row[unref(K)['项目发起人']] || ''), 1))
              ]),
              createBaseVNode("td", _hoisted_46$3, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: row[unref(K)['项目负责人']],
                      "onUpdate:modelValue": $event => ((row[unref(K)['项目负责人']]) = $event),
                      size: "small",
                      class: "ps-cell-input",
                      maxlength: "100",
                      onInput: _cache[11] || (_cache[11] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_47$3, toDisplayString(row[unref(K)['项目负责人']] || ''), 1))
              ]),
              createBaseVNode("td", _hoisted_48$3, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: row[unref(K)['立项日期']],
                      "onUpdate:modelValue": $event => ((row[unref(K)['立项日期']]) = $event),
                      size: "small",
                      class: "ps-cell-input",
                      maxlength: "200",
                      onInput: _cache[12] || (_cache[12] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_49$3, toDisplayString(row[unref(K)['立项日期']] || ''), 1))
              ]),
              createBaseVNode("td", _hoisted_50$3, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: row[unref(K)['预计完成日期']],
                      "onUpdate:modelValue": $event => ((row[unref(K)['预计完成日期']]) = $event),
                      size: "small",
                      class: "ps-cell-input",
                      maxlength: "50",
                      onInput: _cache[13] || (_cache[13] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_51$3, toDisplayString(row[unref(K)['预计完成日期']] || ''), 1))
              ]),
              createBaseVNode("td", _hoisted_52$3, [
                (progressText(row))
                  ? (openBlock(), createElementBlock("span", {
                      key: 0,
                      class: normalizeClass(["ps-status-tag", progressToneOf(row)]),
                      title: unref(tt)('点击查看阶段计划'),
                      onClick: $event => (openStageDialog(row))
                    }, toDisplayString(progressText(row)), 11, _hoisted_53$3))
                  : (openBlock(), createElementBlock("span", _hoisted_54$2, "—"))
              ]),
              createBaseVNode("td", _hoisted_55$2, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: row[unref(K)['测试情况']],
                      "onUpdate:modelValue": $event => ((row[unref(K)['测试情况']]) = $event),
                      type: "textarea",
                      autosize: { minRows: 1, maxRows: 6 },
                      size: "small",
                      class: "ps-cell-input",
                      onInput: _cache[14] || (_cache[14] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_56$2, toDisplayString(row[unref(K)['测试情况']] || ''), 1))
              ]),
              createBaseVNode("td", _hoisted_57$2, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: row[unref(K)['技术目标达成']],
                      "onUpdate:modelValue": $event => ((row[unref(K)['技术目标达成']]) = $event),
                      size: "small",
                      class: "ps-cell-input",
                      maxlength: "50",
                      onInput: _cache[15] || (_cache[15] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_58$2, toDisplayString(row[unref(K)['技术目标达成']] || ''), 1))
              ]),
              createBaseVNode("td", _hoisted_59$2, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: row[unref(K)['是否市场转化']],
                      "onUpdate:modelValue": $event => ((row[unref(K)['是否市场转化']]) = $event),
                      size: "small",
                      class: "ps-cell-input",
                      maxlength: "50",
                      onInput: _cache[16] || (_cache[16] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_60$2, toDisplayString(row[unref(K)['是否市场转化']] || ''), 1))
              ]),
              createBaseVNode("td", _hoisted_61$2, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: row[unref(K)['未转换原因']],
                      "onUpdate:modelValue": $event => ((row[unref(K)['未转换原因']]) = $event),
                      type: "textarea",
                      autosize: { minRows: 1, maxRows: 5 },
                      size: "small",
                      class: "ps-cell-input",
                      onInput: _cache[17] || (_cache[17] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_62$2, toDisplayString(row[unref(K)['未转换原因']] || ''), 1))
              ]),
              (__props.editable)
                ? (openBlock(), createElementBlock("td", _hoisted_63$2, [
                    createBaseVNode("span", {
                      class: "ps-addrow",
                      title: unref(tt)('在该项目后新增子项目'),
                      onClick: $event => (insertAfter(i))
                    }, "＋", 8, _hoisted_64$2),
                    createBaseVNode("span", {
                      class: "ps-del",
                      title: unref(tt)('删除该子项目'),
                      onClick: $event => (removeItem(i))
                    }, "×", 8, _hoisted_65$2)
                  ]))
                : createCommentVNode("", true)
            ]))
          }), 128)),
          (!items.value.length)
            ? (openBlock(), createElementBlock("tr", _hoisted_66$2, [
                createBaseVNode("td", {
                  colspan: __props.editable ? 15 : 14,
                  class: "ps-empty"
                }, toDisplayString(unref(tt)('暂无子项目，点击下方按钮新增')), 9, _hoisted_67$2)
              ]))
            : createCommentVNode("", true)
        ])
      ]),
      (__props.editable)
        ? (openBlock(), createElementBlock("div", _hoisted_68$2, [
            createBaseVNode("div", {
              class: "ps-add",
              onClick: openAddProject
            }, "＋ " + toDisplayString(unref(tt)('新增项目')), 1),
            createBaseVNode("div", {
              class: "ps-add",
              onClick: syncStageProgress
            }, "⟳ " + toDisplayString(unref(tt)('同步阶段进度')), 1),
            createBaseVNode("div", {
              class: "ps-add",
              onClick: pickImportFile
            }, "⬆ " + toDisplayString(unref(tt)('导入Excel')), 1),
            createBaseVNode("span", _hoisted_69$2, toDisplayString(unref(tt)('导入Excel列与面板一致（项目定级/项目名称/子项目尺寸/项目编号/内容/项目发起人/项目负责人/立项日期/预计完成日期/状态/测试情况/技术目标达成/是否市场转化/未转换原因），导入后自动追加子项目行，请保存入库。')), 1),
            createBaseVNode("input", {
              ref_key: "fileRef",
              ref: fileRef,
              type: "file",
              accept: ".xlsx,.xls",
              style: {"display":"none"},
              onChange: importExcelFile
            }, null, 544)
          ]))
        : createCommentVNode("", true)
    ]),
    createVNode(_component_el_dialog, {
      modelValue: dlgVisible.value,
      "onUpdate:modelValue": _cache[21] || (_cache[21] = $event => ((dlgVisible).value = $event)),
      title: unref(tt)('新增项目'),
      width: "400px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[20] || (_cache[20] = $event => (dlgVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: confirmAddProject
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('确定')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_70$2, [
          createBaseVNode("span", _hoisted_71$2, toDisplayString(unref(tt)('项目名称')), 1),
          createVNode(_component_el_select, {
            modelValue: dlgName.value,
            "onUpdate:modelValue": _cache[18] || (_cache[18] = $event => ((dlgName).value = $event)),
            filterable: "",
            "allow-create": "",
            "default-first-option": "",
            clearable: "",
            size: "default",
            style: {"width":"220px"},
            loading: refLoading.value,
            onChange: onDlgNameChange
          }, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(refOptions.value, (o) => {
                return (openBlock(), createBlock(_component_el_option, {
                  key: o.value,
                  label: o.label,
                  value: o.value
                }, null, 8, ["label", "value"]))
              }), 128))
            ]),
            _: 1
          }, 8, ["modelValue", "loading"])
        ]),
        createBaseVNode("div", _hoisted_72$2, [
          createBaseVNode("span", _hoisted_73$2, toDisplayString(unref(tt)('项目等级')), 1),
          createBaseVNode("span", {
            class: normalizeClass(["ps-dlg-readonly", { 'is-empty': !dlgLevel.value }])
          }, toDisplayString(dlgLevel.value || unref(tt)('（由项目实施计划带入）')), 3)
        ]),
        createBaseVNode("div", _hoisted_74$2, [
          createBaseVNode("span", _hoisted_75$2, toDisplayString(unref(tt)('子项目/尺寸')), 1),
          createVNode(_component_el_input, {
            modelValue: dlgSub.value,
            "onUpdate:modelValue": _cache[19] || (_cache[19] = $event => ((dlgSub).value = $event)),
            type: "textarea",
            autosize: { minRows: 1, maxRows: 3 },
            size: "default",
            style: {"width":"220px"},
            maxlength: "200",
            placeholder: unref(tt)('必填')
          }, null, 8, ["modelValue", "placeholder"])
        ]),
        createBaseVNode("div", _hoisted_76$2, [
          createTextVNode(toDisplayString(unref(tt)('下拉可选择项目实施计划项目（含其实施计划单号），选中后自动导入实施计划相关信息；也可直接输入新项目名称。')), 1),
          _cache[25] || (_cache[25] = createBaseVNode("br", null, null, -1)),
          createTextVNode(toDisplayString(unref(tt)('项目等级由项目实施计划带入，不在此手选；选中的计划没有等级时，请先到实施计划里填写。')), 1)
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: stageDlgVisible.value,
      "onUpdate:modelValue": _cache[23] || (_cache[23] = $event => ((stageDlgVisible).value = $event)),
      title: unref(tt)('项目阶段计划'),
      width: "900px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[22] || (_cache[22] = $event => (stageDlgVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_77$2, [
          createBaseVNode("span", null, [
            createTextVNode(toDisplayString(unref(tt)('项目名称')) + "：", 1),
            createBaseVNode("b", null, toDisplayString(stageDlgName.value), 1)
          ]),
          (stageDlgPlan.value)
            ? (openBlock(), createElementBlock("span", _hoisted_78$2, toDisplayString(unref(tt)('实施计划')) + "：" + toDisplayString(stageDlgPlan.value.planNo), 1))
            : createCommentVNode("", true)
        ]),
        (stageDlgStages.value.length)
          ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
              createBaseVNode("div", _hoisted_79$2, [
                createBaseVNode("span", {
                  class: normalizeClass(["ps-status-tag", progressToneOf(stageDlgRow.value)])
                }, toDisplayString(statusText(stageDlgSummary.value)), 3),
                createBaseVNode("span", null, [
                  createTextVNode(toDisplayString(unref(tt)('已完成')) + " " + toDisplayString(stageDlgSummary.value.done) + " · " + toDisplayString(unref(tt)('未完成')) + " " + toDisplayString(stageDlgSummary.value.total - stageDlgSummary.value.done), 1),
                  (stageDlgSummary.value.overdue)
                    ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                        createTextVNode(" · " + toDisplayString(unref(tt)('逾期')) + " " + toDisplayString(stageDlgSummary.value.overdue), 1)
                      ], 64))
                    : createCommentVNode("", true)
                ]),
                (stageDlgSummary.value.next)
                  ? (openBlock(), createElementBlock("span", _hoisted_80$2, [
                      createTextVNode(toDisplayString(unref(tt)('下一阶段')) + "：" + toDisplayString(unref(tt)('阶段')) + toDisplayString(stageDlgSummary.value.next.no) + " " + toDisplayString(stageDlgSummary.value.next.content), 1),
                      (stageDlgSummary.value.next.due)
                        ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                            createTextVNode("（" + toDisplayString(unref(tt)('计划完成')) + " " + toDisplayString(stageDueText(stageDlgSummary.value.next.due)) + "）", 1)
                          ], 64))
                        : createCommentVNode("", true)
                    ]))
                  : createCommentVNode("", true)
              ]),
              createVNode(_component_el_table, {
                data: stageDlgStages.value,
                size: "small",
                border: "",
                "max-height": "420",
                class: "psd-table"
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    type: "index",
                    label: unref(tt)('序号'),
                    width: "52",
                    align: "center"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "content",
                    label: unref(tt)('计划内容'),
                    "min-width": "240",
                    "show-overflow-tooltip": ""
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('计划开始'),
                    width: "104",
                    align: "center"
                  }, {
                    default: withCtx(({ row }) => [
                      createTextVNode(toDisplayString(stageDueText(row.start)), 1)
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('计划完成'),
                    width: "104",
                    align: "center"
                  }, {
                    default: withCtx(({ row }) => [
                      createTextVNode(toDisplayString(stageDueText(row.due)), 1)
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('实际完成'),
                    width: "104",
                    align: "center"
                  }, {
                    default: withCtx(({ row }) => [
                      createTextVNode(toDisplayString(stageDueText(row.actual)), 1)
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "owner",
                    label: unref(tt)('责任人'),
                    width: "96"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('状态'),
                    width: "92",
                    align: "center"
                  }, {
                    default: withCtx(({ row }) => [
                      createBaseVNode("span", {
                        class: normalizeClass(["ps-status-tag", stageBadgeTone(row)])
                      }, toDisplayString(stageBadgeText(row)), 3)
                    ]),
                    _: 1
                  }, 8, ["label"])
                ]),
                _: 1
              }, 8, ["data"])
            ], 64))
          : (openBlock(), createElementBlock("div", _hoisted_81$2, [
              (stageDlgPlan.value)
                ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                    createTextVNode(toDisplayString(unref(tt)('该实施计划尚未录入阶段内容')), 1)
                  ], 64))
                : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                    createTextVNode(toDisplayString(unref(tt)('未找到同名项目实施计划，请先在项目实施计划中录入阶段')), 1)
                  ], 64))
            ]))
      ]),
      _: 1
    }, 8, ["modelValue", "title"])
  ]))
}
}

};
const ProgressControlSheet = /*#__PURE__*/_export_sfc(_sfc_main$8, [['__scopeId',"data-v-226ee350"]]);

/**
 * 检验目录(QC_CATALOG)控制列表 —— 列定义的唯一真源。
 *
 * 【与项目进度查询同构】
 * RD_PROGRESS 的控制列表把"显示名"和"落库数据键"分开(progressColumns.js 里有历史坑),
 * 本表**两者同名**:yj_field.col_name 就是原表列名(检测物料类别/物料名称/批次号/数量/检验状态/是否合格),
 * 所以前端直接用中文列名当数据键,后端 labelsToCols 能原样对上,不会丢库。
 * 若将来某列要改显示名,必须照 progressColumns.js 的做法加 label→key 映射,不可直接改名。
 *
 * 【表结构来源】《品质资料 2026.09.19.xlsx》「检验目录」页签,三组表头一比一:
 *   第1类 检测物料类别 → 第2类 物料名称 → 第3类 检验记录目录(批次号|数量|检验状态|是否合格)
 */


/** 列定义:label=表头显示名,key=落库数据键(本表同名);group 仅用于「检验记录目录」分组下的叶子列 */
const QC_CATALOG_COLUMNS = Object.freeze([
  { label: '检测物料类别', key: '检测物料类别', width: 14 },
  { label: '物料名称', key: '物料名称', width: 16 },
  { label: '物料编码', key: '物料编码', width: 13 },
  { label: '批次号', key: '批次号', width: 12, group: '检验记录目录' },
  { label: '数量', key: '数量', width: 9, group: '检验记录目录' },
  { label: '检验状态', key: '检验状态', width: 11, group: '检验记录目录' },
  { label: '是否合格', key: '是否合格', width: 9, group: '检验记录目录' },
  { label: '检验单号', key: '检验单号', width: 14, group: '检验记录目录' },
  { label: '检验数据记录单号', key: '检验数据记录单号', width: 16, group: '检验记录目录' },
]);
const QC_STATUS_DONE = '已完成检验';

/** Excel 导出用:表头行 = 列显示名 */
function exportHeaderRow() {
  return QC_CATALOG_COLUMNS.map((c) => c.label)
}

/** Excel 导出用:一行数据按列定义取值 */
function exportRow(row) {
  return QC_CATALOG_COLUMNS.map((c) => (row ? row[c.key] : ''))
}

/* unplugin-vue-components disabled */

/* unplugin-vue-components disabled */

const _hoisted_1$7 = { class: "catalog-sheet" };
const _hoisted_2$7 = { class: "cs-titlerow" };
const _hoisted_3$7 = { class: "cs-title" };
const _hoisted_4$7 = { class: "cs-scroll" };
const _hoisted_5$7 = { class: "cs-table" };
const _hoisted_6$7 = {
  class: "c-cat",
  rowspan: "2"
};
const _hoisted_7$6 = {
  class: "c-mat",
  rowspan: "2"
};
const _hoisted_8$6 = {
  class: "c-code",
  rowspan: "2"
};
const _hoisted_9$5 = ["colspan"];
const _hoisted_10$5 = ["rowspan"];
const _hoisted_11$5 = { class: "cs-cell-text cs-block" };
const _hoisted_12$5 = ["rowspan"];
const _hoisted_13$5 = { class: "cs-cell-text cs-block" };
const _hoisted_14$5 = { class: "c-code" };
const _hoisted_15$5 = { class: "c-batch" };
const _hoisted_16$5 = { class: "c-qty" };
const _hoisted_17$5 = { class: "c-status" };
const _hoisted_18$5 = { class: "c-ok" };
const _hoisted_19$5 = { class: "c-no" };
const _hoisted_20$5 = {
  key: 0,
  class: "cs-no-cell"
};
const _hoisted_21$5 = { class: "cs-no-text" };
const _hoisted_22$5 = ["title", "onClick"];
const _hoisted_23$5 = ["title", "onClick"];
const _hoisted_24$5 = {
  key: 1,
  class: "cs-cell-text"
};
const _hoisted_25$5 = { class: "c-no" };
const _hoisted_26$5 = {
  key: 0,
  class: "cs-no-cell"
};
const _hoisted_27$5 = { class: "cs-no-text" };
const _hoisted_28$5 = ["title", "onClick"];
const _hoisted_29$5 = ["title", "onClick"];
const _hoisted_30$5 = {
  key: 1,
  class: "cs-cell-text"
};
const _hoisted_31$5 = { class: "c-op no-print" };
const _hoisted_32$5 = ["title", "onClick"];
const _hoisted_33$5 = ["title", "onClick"];
const _hoisted_34$4 = ["title", "onClick"];
const _hoisted_35$4 = { key: 0 };
const _hoisted_36$4 = ["colspan"];
const _hoisted_37$4 = { class: "cs-note" };
const _hoisted_38$3 = { class: "cs-note-sub" };
const _hoisted_39$3 = { class: "csd-head" };
const _hoisted_40$3 = { class: "cs-dlg-row" };
const _hoisted_41$3 = { class: "cs-dlg-label" };
const _hoisted_42$3 = { class: "csd-tip" };
const _hoisted_43$3 = {
  key: 0,
  class: "csd-empty"
};
const _hoisted_44$3 = { class: "csd-sec" };

/** 数据键(与 qc_catalog_detail 物理列同名,见 qcCatalogColumns.js) */

const _sfc_main$7 = {
  __name: 'QcCatalogSheet',
  props: {
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
},
  emits: ['dirty'],
  setup(__props, { expose: __expose, emit: __emit }) {

const K = Object.freeze({
  CAT: '检测物料类别',
  MAT: '物料名称',
  CODE: '物料编码',
  BATCH: '批次号',
  QTY: '数量',
  STATUS: '检验状态',
  OK: '是否合格',
  INSP: '检验单号',
  REC: '检验数据记录单号',
});

const props = __props;

const engine = usePanelRuntime();
const router = useRouter();

/** 表体列(第3类 检验记录目录 的叶子列) */
const catalogCols = computed(() => QC_CATALOG_COLUMNS.filter((c) => c.group === '检验记录目录'));

/** 目录行(来自当前目录单 detail.items) */
const items = computed(() => {
  const d = props.head?.detail;
  return d && Array.isArray(d.items) ? d.items : []
});

/**
 * 展示顺序(用户口径:类别相同的归为一整个大类):
 * 按「检测物料类别」整块聚合 —— 同类别行不论原来分散在哪都收拢成连续一块(块内保持原顺序),
 * 大类的先后 = 该类别首次出现的位置;类别为空的行不归纳,各自单独成行(在原位置附近输出)。
 */
const displayRows = computed(() => {
  const rows = items.value || [];
  const out = [];
  const done = new Set();
  for (const r of rows) {
    const cat = r?.[K.CAT];
    if (!cat) { out.push(r); continue }              // 空类别:各自成行
    if (done.has(cat)) continue                      // 该类别的整块已在首次出现处输出
    done.add(cat);
    for (const x of rows) if (x?.[K.CAT] === cat) out.push(x);
  }
  return out
});

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])));
function optionsOf(key) {
  const f = fieldMap.value.get(key);
  return (f?.options || []).map((o) => (typeof o === 'object'
    ? { value: o.value ?? o.label, label: o.label ?? o.value }
    : { value: o, label: o }))
}
/** 是否合格候选(字典值=中文数据键) */
const qualifiedOptions = computed(() => optionsOf(K.OK));

/** 分组合并:检测物料类别(空值不归纳 —— 每行各自渲染单元格,避免与 groupSpan 不自洽导致整行错列) */
function isGroupHead(i, key) {
  const v = displayRows.value[i]?.[key];
  if (!v) return true                 // 空类别:本行自成一行(必须渲染单元格)
  if (i <= 0) return true
  return v !== displayRows.value[i - 1]?.[key]
}
function groupSpan(i, key) {
  if (!isGroupHead(i, key)) return 0
  const v = displayRows.value[i]?.[key];
  if (!v) return 1
  let n = 1;
  while (i + n < displayRows.value.length && displayRows.value[i + n]?.[key] === v) n++;
  return n
}
/** 物料层:按「物料名称 + 物料编码」合并;两者皆空时每行自成一行(同空值不自洽会错列) */
function matKeyOf(row) {
  return [row?.[K.MAT] || '', row?.[K.CODE] || ''].join('|')
}
function isMatHead(i) {
  if (i <= 0) return true
  const k = matKeyOf(displayRows.value[i]);
  if (k === '|') return true
  return k !== matKeyOf(displayRows.value[i - 1])
}
function matSpan(i) {
  if (!isMatHead(i)) return 0
  const k = matKeyOf(displayRows.value[i]);
  if (k === '|') return 1
  let n = 1;
  while (i + n < displayRows.value.length && matKeyOf(displayRows.value[i + n]) === k) n++;
  return n
}
function colClass(key) {
  return {
    批次号: 'c-batch',
    数量: 'c-qty',
    检验状态: 'c-status',
    是否合格: 'c-ok',
    检验单号: 'c-no',
    检验数据记录单号: 'c-no',
  }[key] || 'c-no'
}

// ---------- 行动作:完成 / 修改 / 删除记录 ----------
const acting = ref(false);
const completeVisible = ref(false);
const completeRow = ref(null);
const completeQualified = ref('');

function openComplete(row) {
  if (!row?.[K.INSP] || !row?.[K.REC]) {
    return ElMessage.warning(tt('该目录行缺少关联的检验单或检验数据记录，无法完成'))
  }
  completeRow.value = row;
  completeQualified.value = row[K.OK] || '';
  completeVisible.value = true;
}

async function callCatalog(buttonName, payload) {
  acting.value = true;
  try {
    const res = await engine.callButton({
      panelCode: 'QC_CATALOG',
      buttonName,
      formData: { 编号: props.head['单据编号'], ...payload },
      buttonParam: {},
    });
    await reloadDoc();
    return res
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('操作失败'));
    return null
  } finally {
    acting.value = false;
  }
}

async function doComplete() {
  const row = completeRow.value;
  if (!row) return
  const res = await callCatalog('完成', { id: row.id, 是否合格: completeQualified.value });
  if (!res) return
  completeVisible.value = false;
  ElMessage.success(tt('已标记为已完成检验'));
}

async function doReopen(row) {
  try {
    await ElMessageBox.confirm(
      tt('取消完成后该目录行回到「正在检验中」，之后才可反审核挂靠的检验单与检验数据记录。确定取消完成吗？'),
      tt('取消完成'),
      { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), type: 'warning' },
    );
  } catch { return }
  const res = await callCatalog('修改', { id: row.id });
  if (!res) return
  ElMessage.success(tt('已取消完成（已写入修改记录）'));
}

async function doDelete(row) {
  try {
    await ElMessageBox.confirm(
      tt('删除该目录记录前，需先删除挂靠的检验单与检验数据记录。确定删除吗？'),
      tt('删除目录记录'),
      { confirmButtonText: tt('确定'), cancelButtonText: tt('取消'), type: 'warning' },
    );
  } catch { return }
  const res = await callCatalog('删除记录', { id: row.id });
  if (!res) return
  ElMessage.success(tt('已删除该目录记录'));
}

// ---------- 查看/跳转关联单据 ----------
const docVisible = ref(false);
const docLoading = ref(false);
const docDetail = ref(null);
const docTitle = ref('');
const docNo = ref('');
const docPanel = ref('');

async function openDoc(no, panel) {
  if (!no) return
  docNo.value = no;
  docPanel.value = panel;
  docTitle.value = (panel === 'QC_INSP_REC' ? tt('检验数据记录') : tt('来料检验单')) + ' ' + no;
  docDetail.value = null;
  docVisible.value = true;
  docLoading.value = true;
  try {
    const fd = await engine.getFormDescriptor({ panelCode: panel, code: no });
    const head = fd?.data || {};
    const tabs = fd?.detail?.tabs || [];
    const tab = tabs[0] || { fields: [] };
    docDetail.value = {
      head: Object.entries(head)
        .filter(([k, v]) => !['saved', '编号'].includes(k) && v !== null && v !== '' && v !== undefined)
        .map(([k, v]) => ({ label: k, value: String(v) })),
      detailFields: (tab.fields || []).map((f) => f.dataName || f.code),
      rows: fd?.detailData?.[tab.key || 'items'] || [],
    };
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'));
  } finally {
    docLoading.value = false;
  }
}

/** 跳转到目标面板并定位该单据(PanelxList 支持 ?docNo= 定位) */
function gotoDoc(no, panel) {
  if (!no) return
  docVisible.value = false;
  router.push({ path: `/panelx/list/${panel}`, query: { docNo: no } });
}

/** 动作后重取当前目录单(状态/是否合格/挂靠单号都已变化) */
async function reloadDoc() {
  const no = props.head['单据编号'];
  if (!no) return
  try {
    const fd = await engine.getFormDescriptor({ panelCode: 'QC_CATALOG', code: no });
    const d = fd?.data || {};
    for (const [k, v] of Object.entries(d)) {
      if (k === 'detail') continue
      props.head[k] = v;
    }
    const rows = fd?.detailData?.items || [];
    if (props.head.detail && Array.isArray(props.head.detail.items)) props.head.detail.items = rows;
    else props.head.detail = { items: rows };
  } catch { /* 重取失败保持现状 */ }
}

/** 导出 Excel:标题 + 列头 + 全部目录行(与 qcCatalogColumns 同源) */
async function exportCatalogExcel() {
  const XLSX = await __vitePreload(() => import('./xlsx-yBJAythd.js'),true              ?[]:void 0);
  const rows = displayRows.value || [];   // 导出与纸面同序(类别整块聚合后的顺序)
  const title = '检验目录';
  const header = exportHeaderRow();
  const aoa = [[title], [], header, ...rows.map((r) => exportRow(r))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = QC_CATALOG_COLUMNS.map((c) => ({ wch: c.width }));
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: QC_CATALOG_COLUMNS.length - 1 } }];
  const c0 = ws[{ }];
  if (c0) c0.s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } };
  for (let c = 0; c < header.length; c++) {
    const cell = ws[{ }];
    if (cell) cell.s = { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true }, fill: { fgColor: { rgb: 'D9ECFB' } } };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title);
  XLSX.writeFile(wb, `${title}-${props.head['单据编号'] || '导出'}.xlsx`);
}

__expose({ exportCatalogExcel });

return (_ctx, _cache) => {
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;

  return (openBlock(), createElementBlock("div", _hoisted_1$7, [
    createBaseVNode("div", _hoisted_2$7, [
      createBaseVNode("div", _hoisted_3$7, toDisplayString(unref(tt)('检验目录')), 1)
    ]),
    createBaseVNode("div", _hoisted_4$7, [
      createBaseVNode("table", _hoisted_5$7, [
        createBaseVNode("thead", null, [
          createBaseVNode("tr", null, [
            createBaseVNode("th", _hoisted_6$7, toDisplayString(unref(tt)('检测物料类别')), 1),
            createBaseVNode("th", _hoisted_7$6, toDisplayString(unref(tt)('物料名称')), 1),
            createBaseVNode("th", _hoisted_8$6, toDisplayString(unref(tt)('物料编码')), 1),
            createBaseVNode("th", {
              class: "c-group",
              colspan: catalogCols.value.length
            }, toDisplayString(unref(tt)('检验记录目录')), 9, _hoisted_9$5),
            _cache[6] || (_cache[6] = createBaseVNode("th", {
              class: "c-op c-op-plain",
              rowspan: 2
            }, null, -1))
          ]),
          createBaseVNode("tr", null, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(catalogCols.value, (c) => {
              return (openBlock(), createElementBlock("th", {
                key: c.key,
                class: normalizeClass(colClass(c.key))
              }, toDisplayString(unref(tt)(c.label)), 3))
            }), 128))
          ])
        ]),
        createBaseVNode("tbody", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(displayRows.value, (row, i) => {
            return (openBlock(), createElementBlock("tr", {
              key: row.id ?? ('r' + i)
            }, [
              (isGroupHead(i, unref(K).CAT))
                ? (openBlock(), createElementBlock("td", {
                    key: 0,
                    class: "c-cat",
                    rowspan: groupSpan(i, unref(K).CAT)
                  }, [
                    createBaseVNode("span", _hoisted_11$5, toDisplayString(row[unref(K).CAT] || '—'), 1)
                  ], 8, _hoisted_10$5))
                : createCommentVNode("", true),
              (isMatHead(i))
                ? (openBlock(), createElementBlock("td", {
                    key: 1,
                    class: "c-mat",
                    rowspan: matSpan(i)
                  }, [
                    createBaseVNode("span", _hoisted_13$5, toDisplayString(row[unref(K).MAT] || ''), 1)
                  ], 8, _hoisted_12$5))
                : createCommentVNode("", true),
              createBaseVNode("td", _hoisted_14$5, toDisplayString(row[unref(K).CODE] || ''), 1),
              createBaseVNode("td", _hoisted_15$5, toDisplayString(row[unref(K).BATCH] || ''), 1),
              createBaseVNode("td", _hoisted_16$5, toDisplayString(row[unref(K).QTY] || ''), 1),
              createBaseVNode("td", _hoisted_17$5, [
                createBaseVNode("span", {
                  class: normalizeClass(["cs-status-tag", row[unref(K).STATUS] === unref(QC_STATUS_DONE) ? 'done' : 'doing'])
                }, toDisplayString(row[unref(K).STATUS] || '—'), 3)
              ]),
              createBaseVNode("td", _hoisted_18$5, toDisplayString(row[unref(K).OK] || ''), 1),
              createBaseVNode("td", _hoisted_19$5, [
                (row[unref(K).INSP])
                  ? (openBlock(), createElementBlock("span", _hoisted_20$5, [
                      createBaseVNode("span", _hoisted_21$5, toDisplayString(row[unref(K).INSP]), 1),
                      createBaseVNode("span", {
                        class: "cs-link no-print",
                        title: unref(tt)('查看该检验单详情'),
                        onClick: withModifiers($event => (openDoc(row[unref(K).INSP], 'QC_INSP')), ["stop"])
                      }, "📄", 8, _hoisted_22$5),
                      createBaseVNode("span", {
                        class: "cs-link no-print",
                        title: unref(tt)('跳转到该检验单'),
                        onClick: withModifiers($event => (gotoDoc(row[unref(K).INSP], 'QC_INSP')), ["stop"])
                      }, "↗", 8, _hoisted_23$5)
                    ]))
                  : (openBlock(), createElementBlock("span", _hoisted_24$5, "—"))
              ]),
              createBaseVNode("td", _hoisted_25$5, [
                (row[unref(K).REC])
                  ? (openBlock(), createElementBlock("span", _hoisted_26$5, [
                      createBaseVNode("span", _hoisted_27$5, toDisplayString(row[unref(K).REC]), 1),
                      createBaseVNode("span", {
                        class: "cs-link no-print",
                        title: unref(tt)('查看该检验数据记录详情'),
                        onClick: withModifiers($event => (openDoc(row[unref(K).REC], 'QC_INSP_REC')), ["stop"])
                      }, "📄", 8, _hoisted_28$5),
                      createBaseVNode("span", {
                        class: "cs-link no-print",
                        title: unref(tt)('跳转到该检验数据记录'),
                        onClick: withModifiers($event => (gotoDoc(row[unref(K).REC], 'QC_INSP_REC')), ["stop"])
                      }, "↗", 8, _hoisted_29$5)
                    ]))
                  : (openBlock(), createElementBlock("span", _hoisted_30$5, "—"))
              ]),
              createBaseVNode("td", _hoisted_31$5, [
                createBaseVNode("span", {
                  class: normalizeClass(["cs-act", { disabled: row[unref(K).STATUS] === unref(QC_STATUS_DONE) || !row[unref(K).INSP] || !row[unref(K).REC] }]),
                  title: row[unref(K).STATUS] === unref(QC_STATUS_DONE)
                  ? unref(tt)('该行已完成检验')
                  : unref(tt)('完成检验（需关联的检验单与检验数据记录都已审批）'),
                  onClick: withModifiers($event => (openComplete(row)), ["stop"])
                }, toDisplayString(unref(tt)('完成检验')), 11, _hoisted_32$5),
                createBaseVNode("span", {
                  class: normalizeClass(["cs-act warn", { disabled: row[unref(K).STATUS] !== unref(QC_STATUS_DONE) }]),
                  title: row[unref(K).STATUS] === unref(QC_STATUS_DONE)
                  ? unref(tt)('取消完成并回弹为正在检验中（之后才可反审核挂靠单据）')
                  : unref(tt)('仅「已完成检验」的行可取消完成'),
                  onClick: withModifiers($event => (row[unref(K).STATUS] === unref(QC_STATUS_DONE) && doReopen(row)), ["stop"])
                }, toDisplayString(unref(tt)('修改')), 11, _hoisted_33$5),
                createBaseVNode("span", {
                  class: "cs-act danger",
                  title: unref(tt)('删除该目录记录（需先删除挂靠的检验单与检验数据记录）'),
                  onClick: withModifiers($event => (doDelete(row)), ["stop"])
                }, "✕", 8, _hoisted_34$4)
              ])
            ]))
          }), 128)),
          (!displayRows.value.length)
            ? (openBlock(), createElementBlock("tr", _hoisted_35$4, [
                createBaseVNode("td", {
                  colspan: catalogCols.value.length + 4,
                  class: "cs-empty"
                }, toDisplayString(unref(tt)('暂无检验记录，暂收单生单生成检验单后自动带入')), 9, _hoisted_36$4)
              ]))
            : createCommentVNode("", true)
        ])
      ])
    ]),
    createBaseVNode("div", _hoisted_37$4, [
      createBaseVNode("div", null, toDisplayString(unref(tt)('输入批次号后点击批次号可查阅详细或者新增检验')), 1),
      createBaseVNode("div", _hoisted_38$3, toDisplayString(unref(tt)('目录记录由检验单生单自动生成、不可手工修改；状态变更走行上的「完成 / 修改」。')), 1)
    ]),
    createVNode(_component_el_dialog, {
      modelValue: completeVisible.value,
      "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((completeVisible).value = $event)),
      title: unref(tt)('完成检验'),
      width: "420px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[1] || (_cache[1] = $event => (completeVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: acting.value,
          onClick: doComplete
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('确定')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_39$3, [
          createBaseVNode("span", null, [
            createTextVNode(toDisplayString(unref(tt)('物料')) + "：", 1),
            createBaseVNode("b", null, toDisplayString(completeRow.value && completeRow.value[unref(K).MAT]), 1)
          ]),
          createBaseVNode("span", null, [
            createTextVNode(toDisplayString(unref(tt)('批次号')) + "：", 1),
            createBaseVNode("b", null, toDisplayString(completeRow.value && completeRow.value[unref(K).BATCH]), 1)
          ])
        ]),
        createBaseVNode("div", _hoisted_40$3, [
          createBaseVNode("span", _hoisted_41$3, toDisplayString(unref(tt)('是否合格')), 1),
          createVNode(_component_el_select, {
            modelValue: completeQualified.value,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((completeQualified).value = $event)),
            clearable: "",
            size: "default",
            style: {"width":"200px"},
            placeholder: unref(tt)('请选择')
          }, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(qualifiedOptions.value, (o) => {
                return (openBlock(), createBlock(_component_el_option, {
                  key: o.value,
                  label: o.label,
                  value: o.value
                }, null, 8, ["label", "value"]))
              }), 128))
            ]),
            _: 1
          }, 8, ["modelValue", "placeholder"])
        ]),
        createBaseVNode("div", _hoisted_42$3, toDisplayString(unref(tt)('完成前会校验：关联的检验单已审核、检验数据记录已审批（归档）。')), 1)
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: docVisible.value,
      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((docVisible).value = $event)),
      title: docTitle.value,
      width: "920px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[3] || (_cache[3] = $event => (docVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
          ]),
          _: 1
        }),
        (docNo.value)
          ? (openBlock(), createBlock(_component_el_button, {
              key: 0,
              type: "primary",
              onClick: _cache[4] || (_cache[4] = $event => (gotoDoc(docNo.value, docPanel.value)))
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(tt)('跳转到该单据')), 1)
              ]),
              _: 1
            }))
          : createCommentVNode("", true)
      ]),
      default: withCtx(() => [
        (docLoading.value)
          ? (openBlock(), createElementBlock("div", _hoisted_43$3, toDisplayString(unref(tt)('查询中…')), 1))
          : (docDetail.value)
            ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                createVNode(_component_el_table, {
                  data: docDetail.value.head,
                  size: "small",
                  border: "",
                  "max-height": "320",
                  class: "csd-kv"
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_table_column, {
                      prop: "label",
                      label: unref(tt)('项目'),
                      width: "160"
                    }, null, 8, ["label"]),
                    createVNode(_component_el_table_column, {
                      prop: "value",
                      label: unref(tt)('内容'),
                      "min-width": "240",
                      "show-overflow-tooltip": ""
                    }, null, 8, ["label"])
                  ]),
                  _: 1
                }, 8, ["data"]),
                (docDetail.value.detailFields.length)
                  ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                      createBaseVNode("div", _hoisted_44$3, toDisplayString(unref(tt)('明细')), 1),
                      createVNode(_component_el_table, {
                        data: docDetail.value.rows,
                        size: "small",
                        border: "",
                        "max-height": "280"
                      }, {
                        default: withCtx(() => [
                          createVNode(_component_el_table_column, {
                            type: "index",
                            label: unref(tt)('序号'),
                            width: "52",
                            align: "center"
                          }, null, 8, ["label"]),
                          (openBlock(true), createElementBlock(Fragment, null, renderList(docDetail.value.detailFields, (f) => {
                            return (openBlock(), createBlock(_component_el_table_column, {
                              key: f,
                              prop: f,
                              label: unref(tt)(f),
                              "min-width": "110",
                              "show-overflow-tooltip": ""
                            }, null, 8, ["prop", "label"]))
                          }), 128))
                        ]),
                        _: 1
                      }, 8, ["data"])
                    ], 64))
                  : createCommentVNode("", true)
              ], 64))
            : createCommentVNode("", true)
      ]),
      _: 1
    }, 8, ["modelValue", "title"])
  ]))
}
}

};
const QcCatalogSheet = /*#__PURE__*/_export_sfc(_sfc_main$7, [['__scopeId',"data-v-e3e5e4dd"]]);

/**
 * detailRows.js — 「明细行住在 detail 的哪个键下」的唯一判据。
 *
 * 【为什么必须有这一处(2026-10-04 实测踩坑)】
 *   接口返回的明细键**不是**恒为 `items`,而是 yj_panel.detail_key
 *   (`QueryService.queryArchive`: `doc.put("detail", Map.of(def.tabKey(), items))`;
 *     `migrate-arch-single-doc.sql`: 档案面板 `detail_key = LOWER(panel_code)`,单据面板 = 'items')。
 *   实测:INV → detail.inv(3874 行)、EMP → detail.emp(130 行)、QC_INSP_REQ → detail.qc_insp_req(79 行),
 *        而 QC_CATALOG / QC_INSP_REC 这类单据面板 → detail.items。
 *   于是照 `head.detail.items` 写死的专属表格组件在**档案面板**上恒空:
 *   QcInspReqSheet 7 个页签全「暂无数据」、检验报告点「检验要求」恒「该物料未维护来料检验要求」
 *   —— 浏览器实测复现(见 tools/archive/_probe-qc-insp-carry/)。
 *
 * 【口径】读:优先 `items`(单据面板/合成 head),否则取 detail 里**第一个数组值**的键(与
 *   PanelxList.allArchiveRows / saveInlineDraft 的"逐键镜像"同源),再退回调用方给的 fallback
 *   (档案面板传 panelCode.toLowerCase())。写:写进同一个键 —— 保存时 PanelxList 按
 *   `Object.keys(detail)` 逐键镜像提交,键错位会让新行既不在表里也不在提交内容里。
 */

/** detail 里存着明细行的键(拿不到再退回 fallbackKey,最后退回 'items') */
function detailKeyOf(head, fallbackKey = '') {
  const d = head?.detail;
  const fb = fallbackKey || 'items';
  if (!d || typeof d !== 'object') return fb
  if (Array.isArray(d.items)) return 'items'
  for (const [k, v] of Object.entries(d)) if (Array.isArray(v)) return k
  return fb
}

/** 只读取明细行(不创建);head 结构不对给空数组 */
function detailRowsOf(head, fallbackKey = '') {
  const d = head?.detail;
  if (!d || typeof d !== 'object') return []
  const key = detailKeyOf(head, fallbackKey);
  return Array.isArray(d[key]) ? d[key] : []
}

/** 取**可写**的明细行数组(必要时建 detail 与那个键);新增行必须走这里,键才不会错位 */
function ensureDetailRows(head, fallbackKey = '') {
  if (!head.detail || typeof head.detail !== 'object') head.detail = {};
  const key = detailKeyOf(head, fallbackKey);
  if (!Array.isArray(head.detail[key])) head.detail[key] = [];
  return head.detail[key]
}

/**
 * qcInspReqConfig.js — 来料检验要求面板(QC_INSP_REQ)7 页签配置
 * 依据《品质资料 2026.09.19.xlsx》自「折叠棉」起的 7 张检验要求表一比一复刻:
 *   页签条 = 规格书式 rsp-pages;每页 = 大标题行 + 两行分组表头 + Excel 原列宽数据行。
 * 数据键 = 中文标签 = qc_insp_req 物理列名;行按 [物料类别]=tab.key 分流到各页签
 * (同名叶列跨页签共用一列,如 脏污、头发丝 6 个页签共用;PP管 原表 B 空列丢弃)。
 * 列定义:w=Excel 原列宽 px;rowspan:2=纵向合并两行的独立表头;group=两行分组表头的子列。
 */
const qcInspReqTabs = [
  {
    key: '折叠棉',
    sheetTitle: '折叠棉检验要求',
    cols: [
      { key: '物料编号', w: 140, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '折叠棉', w: 140, group: '规格' },
      { key: '炭棒', w: 140, group: '规格' },
      { key: '实配炭棒后外径', w: 140, group: '规格' },
      { key: '折数', w: 125, rowspan: 2 },
      { key: '折高', w: 125, rowspan: 2 },
    ],
  },
  {
    key: '垫片',
    sheetTitle: '垫片/密封圈检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '外径', w: 101, group: '规格' },
      { key: '内径', w: 123, group: '规格' },
      { key: '厚度', w: 81, group: '规格' },
      { key: '实配端盖效果', w: 83, rowspan: 2 },
      { key: '脏污、头发丝', w: 116, group: '外观' },
      { key: '材质', w: 116, group: '外观' },
    ],
  },
  {
    key: '无纺布',
    sheetTitle: '无纺布检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '长', w: 101, group: '规格（片布）' },
      { key: '宽', w: 123, group: '规格（片布）' },
      { key: '克数', w: 81, group: '规格（片布）' },
      { key: '宽度', w: 83, group: '规格（卷布）' },
      { key: '克重', w: 83, group: '规格（卷布）' },
      { key: '脏污、头发丝', w: 116, group: '外观' },
      { key: '颜色（白/黑）', w: 116, group: '外观' },
    ],
  },
  {
    key: '网套',
    sheetTitle: '网套检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '尺寸', w: 118, group: '规格' },
      { key: '实配炭棒后外径', w: 118, group: '规格' },
      { key: '实配端盖', w: 118, group: '规格' },
      { key: '折数', w: 83, rowspan: 2 },
      { key: '叠高', w: 83, rowspan: 2 },
      { key: '脏污、头发丝', w: 116, group: '外观' },
      { key: '接口牢固度', w: 116, group: '外观' },
    ],
  },
  {
    key: 'PP管',
    sheetTitle: 'PP胶管检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '长', w: 101, group: '规格' },
      { key: '内径', w: 92, group: '规格' },
      { key: '外径', w: 81, group: '规格' },
      { key: '脏污、头发丝', w: 116, group: '外观' },
      { key: '破损、切斜', w: 116, group: '外观' },
    ],
  },
  {
    key: '端盖',
    sheetTitle: '端盖检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '外径1', w: 101, group: '规格' },
      { key: '外径2', w: 123, group: '规格' },
      { key: '高度', w: 81, group: '规格' },
      { key: '外径（+密封圈）', w: 118, group: '外观' },
      { key: '出水口堵孔、批锋', w: 83, group: '外观' },
      { key: '脏污、头发丝', w: 116, group: '外观' },
      { key: '变形、破损', w: 116, group: '外观' },
    ],
  },
  {
    key: 'PP棉',
    sheetTitle: 'PP棉检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '尺寸', w: 146, group: '规格' },
      { key: '实配炭棒', w: 146, group: '规格' },
      { key: '实配端盖', w: 146, group: '规格' },
      { key: '切面（平整、无歪斜）', w: 119, group: '外观' },
      { key: '脏污、头发丝', w: 119, group: '外观' },
      { key: '破损、变形', w: 119, group: '外观' },
    ],
  },
];

/* ═══════════ 两个「来料检验要求」面板(2026-10-04 用户口径:表太多挤在一个面板,拆成两个)═══════════
 * · QC_INSP_REQ        —— 本文件上面 7 张**固定**表(Excel 一比一复刻)+ 每表可加自定义列
 * · QC_INSP_REQ_SERIES —— 10 张**全自定义**表(阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/
 *                          抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料),列全由动态字段承载
 * 两个面板同构:档案式整表、行按 物料类别 分流到页签、每表各 20 个扩展位、自定义列可带父字段(分组表头)、
 * 检验数据记录都按物料编码带入(只带子字段)。差别只在:一个是固定表,一个是全自定义表。
 * (原先那个「自定义检验要求」页签已下线 —— 它连同 10 张系列表独立成一个面板:表不再挤在一个面板里。)
 */
const QC_INSP_REQ_PANEL = 'QC_INSP_REQ';
const QC_INSP_REQ_SERIES_PANEL = 'QC_INSP_REQ_SERIES';
/** 走「来料检验要求」专属纸张面板(规格书式页签 + Excel 复刻表格)的面板码 */
const QC_INSP_REQ_PANELS = [QC_INSP_REQ_PANEL, QC_INSP_REQ_SERIES_PANEL];

/** 是否属于这两个分页签的来料检验要求面板 */
function isQcInspReqPanel(panelCode) {
  return QC_INSP_REQ_PANELS.includes(String(panelCode || ''))
}

/**
 * 该面板的页签集。
 * · QC_INSP_REQ:静态配置(7 张 Excel 复刻表,列宽/分组表头都在本文件);
 * · QC_INSP_REQ_SERIES:完全由**物料类别词典**决定(后端 /px/extFields 的 tabs,顺序即扩展池分段序)
 *   —— 加页签只改词典(迁移),前后端都不用改;每张表都是「全自定义」(列 = 该表自己的动态字段)。
 * @param {string} panelCode 面板码
 * @param {string[]} [apiTabs] 后端下发的页签(全自定义面板用)
 */
function tabsOfPanel(panelCode, apiTabs) {
  if (String(panelCode || '') === QC_INSP_REQ_PANEL) return qcInspReqTabs
  return (Array.isArray(apiTabs) ? apiTabs : []).map((key) => ({
    key,
    sheetTitle: key,
    dynamicCols: true,   // 全自定义表:列只有 物料编号 + 本表的动态字段
    cols: [],
  }))
}

/**
 * qcInspReqLookup.js — 「按物料编码查看来料检验要求」纯逻辑(无 Vue 依赖,可单测)
 *
 * 场景(2026-09-23 用户口径:「检验数据记录要根据物料编码能够查看来料检验要求相关物料的信息」):
 *   检验数据记录(QC_INSP_REC)的抬头有「物料编码」,而该物料的检验要求维护在
 *   来料检验要求(QC_INSP_REQ,7 页签档案表)里 —— 录入/查看报告时要能直接看到对应要求。
 *
 * 匹配口径:
 *   · 键 = 检验数据记录.物料编码 ↔ 来料检验要求.物料编号,两侧 trim 后**精确相等**。
 *     不用模糊匹配:物料编号是唯一规格标识(实测 78 行 = 78 个不同编号),
 *     LIKE '%code%' 会把 YJ-AJ-001 与 YJ-AJ-0011 这类串起来 —— 库里暂时没有,但口径上不留这个口子。
 *   · 分组 = 按行上的「物料类别」归到 7 个页签之一,顺序**循 qcInspReqTabs 的配置序**
 *     (与维护面板页签顺序一致,不按数据出现顺序);组内按 id 升序(对齐 Excel 原序)。
 *   · 配置外的物料类别(理论上不会有:物料类别是 7 值下拉)也**不静默丢弃** ——
 *     作为 unknown 组返回,由调用方提示,免得"该物料有要求却看不见"。
 */

/** 物料编号/编码归一:去首尾空白(null/undefined → 空串) */
function normCode(v) {
  return String(v ?? '').trim()
}

/** 行 id 升序(无 id 的新行殿后) */
function byIdAsc(a, b) {
  return (a?.id ?? Number.MAX_SAFE_INTEGER) - (b?.id ?? Number.MAX_SAFE_INTEGER)
}

/**
 * 从档案全量行里挑出该物料的检验要求行(精确匹配 物料编号)。
 * @param {Array<object>} rows 来料检验要求全量行
 * @param {string} materialCode 检验数据记录的物料编码
 * @returns {Array<object>} 匹配行(保持原顺序)
 */
function matchReqRowsByMaterial(rows, materialCode) {
  const code = normCode(materialCode);
  if (!code || !Array.isArray(rows)) return []
  return rows.filter((r) => r && normCode(r['物料编号']) === code)
}

/**
 * 匹配行 → 按页签分组(配置序;配置外类别作为 tab=null 的组殿后)。
 * @param {Array<object>} matched 命中行
 * @param {Array<object>} [tabs] 页签配置全集 —— **默认** QC_INSP_REQ 的 7 张固定表;
 *        检验数据记录要同时看两个面板(固定表 + 10 张系列表)⇒ 调用方传全集
 *        ([...qcInspReqTabs, ...系列面板的 10 个页签])。
 * @returns {Array<{key: string, tab: object|null, rows: Array<object>}>}
 */
function reqGroupsOf(matched, tabs) {
  const list = Array.isArray(matched) ? matched : [];
  const all = Array.isArray(tabs) && tabs.length ? tabs : qcInspReqTabs;
  const groups = [];
  const used = new Set();
  for (const tab of all) {
    const rows = list.filter((r) => r && normCode(r['物料类别']) === tab.key).slice().sort(byIdAsc);
    if (rows.length) {
      groups.push({ key: tab.key, tab, rows });
      rows.forEach((r) => used.add(r));
    }
  }
  const rest = list.filter((r) => r && !used.has(r)).slice().sort(byIdAsc);
  if (rest.length) groups.push({ key: '', tab: null, rows: rest });
  return groups
}

/** 匹配行里落在配置页签上的页签 key 列表(供只读嵌入时只渲染命中页签) */
function reqTabKeysOf(groups) {
  return (Array.isArray(groups) ? groups : []).filter((g) => !!g.tab).map((g) => g.key)
}

/**
 * 一行到位:全量行 + 物料编码 → 分组结果
 * @returns {Array<{key: string, tab: object|null, rows: Array<object>}>}
 */
function lookupReqGroups(rows, materialCode, tabs) {
  return reqGroupsOf(matchReqRowsByMaterial(rows, materialCode), tabs)
}

/**
 * qcInspReqApi.js — 两个「来料检验要求」面板的取数唯一入口。
 *
 * 面板(2026-10-04 拆分,表太多不再挤在一个面板里):
 *   · QC_INSP_REQ        7 张**固定**表(Excel 一比一)+ 每表可加自定义列
 *   · QC_INSP_REQ_SERIES 10 张**全自定义**表(阻垢系列…原料来料)
 * 检验数据记录不关心要求维护在哪张表上 ⇒ fetchReqRows 一次取**两个面板**并合并,
 * 「检验要求」弹窗与报告带入都走它(同一口径,不会出现"弹窗看得到、报告带不进来")。
 *
 * 档案式面板:整表一张虚拟单,服务端按 condition 收窄,前端再按 物料编号 精确过滤(见 qcInspReqLookup)。
 */

/**
 * 取某物料在**一个**来料检验要求面板里的全部行(未过滤;分组/匹配交给 qcInspReqLookup)。
 * @param {string} panelCode 面板码(QC_INSP_REQ / QC_INSP_REQ_SERIES)
 * @param {string} materialCode 物料编码/编号(两侧 trim 后精确匹配)
 * @returns {Promise<Array<object>>} 要求行(空编码或没命中给空数组)
 */
async function fetchReqRowsOfPanel(panelCode, materialCode) {
  const code = normCode(materialCode);
  if (!code) return []
  const res = await request.post('/px/queryFormDataList', {
    panelCode,
    condition: { 物料编号: code },
    pageNo: 1,
    pageSize: 1,
  });
  const doc = res?.data?.list?.[0];
  // ⚠ 明细键 = yj_panel.detail_key(LOWER(panel_code)),**不是** items ——
  //   照 detail.items 取会恒空,报表现象就是「该物料未维护来料检验要求」(见 detailRows.js 说明)
  return detailRowsOf(doc, String(panelCode).toLowerCase())
}

/**
 * 取某物料在**两个**来料检验要求面板里的全部行(合并;调用方按 物料类别 分组)。
 * 单面板取数失败按空算,不让一个面板挂掉整条带入链。
 * @returns {Promise<Array<object>>} 合并后的行
 */
async function fetchReqRows(materialCode) {
  const code = normCode(materialCode);
  if (!code) return []
  const results = await Promise.all(QC_INSP_REQ_PANELS.map((p) => fetchReqRowsOfPanel(p, code).catch(() => [])));
  return results.flat()
}

/* ── 动态字段(每张表各自的自定义列) ──
 * 检验要求表自己的字段清单:QcInspReqSheet(渲染)与检验报告(带入)都要它 ——
 * 同一份数据两处各拉一次是浪费,更怕两处口径不一致,故在此统一取,并做短缓存。
 * /px/extFields 任何登录用户可读(写操作服务端 requireAdmin)。 */
const extCache = new Map();   // panelCode -> {at, data}
const EXT_TTL_MS = 30_000;
const EMPTY_OVERVIEW = { fields: [], tabs: [], tabPools: {}, capacity: 20 };

/**
 * 取该面板的动态字段总览。
 * @returns {Promise<{fields:Array, tabs:string[], tabPools:object, capacity:number}>}
 *   fields = [{id,label,col,dataType,place,tab,parent}];tabs = 页签集(顺序=扩展池分段序);
 *   tabPools = {页签: {capacity,used,free,from,to}}
 */
async function fetchExtOverview(panelCode = QC_INSP_REQ_PANEL, { force = false } = {}) {
  const key = String(panelCode);
  const hit = extCache.get(key);
  const now = Date.now();
  if (!force && hit && now - hit.at < EXT_TTL_MS) return hit.data
  try {
    const res = await request.get('/px/extFields', { params: { panel: key } });
    const data = res?.data || {};
    const out = {
      fields: Array.isArray(data.fields) ? data.fields : [],
      tabs: Array.isArray(data.tabs) ? data.tabs : [],
      tabPools: data.tabPools || {},
      capacity: data.capacity ?? 20,
    };
    extCache.set(key, { at: now, data: out });
    return out
  } catch {
    return hit?.data || EMPTY_OVERVIEW
  }
}

/** 让缓存失效(管理员加/停列之后调,避免 30s 内还按旧字段表渲染);不传面板=全清 */
function invalidateExtFields(panelCode) {
  if (panelCode) extCache.delete(String(panelCode));
  else extCache.clear();
}

/**
 * qcInspReqCols.js — 「来料检验要求每个页签有哪些列」的唯一判据(纯函数,无 Vue 依赖,可单测)
 *
 * 【用户口径(2026-10-04)】「检验数据要求的自定义字段,是单独针对每个表的」——
 *   每张表(页签)各有各的自定义列:给「折叠棉」表加一列「炭棒直径」,只出现在折叠棉表里;
 *   给「垫片」表也加一列叫「外观」的同名列,两张表互不影响(后端唯一性限制已改为「同页签内唯一」)。
 *
 * 【列的构成】某页签的列 = 该页签的固定列 + **属于该页签的动态字段**(备用列池):
 *   · 固定 7 张表(折叠棉/垫片/无纺布/网套/PP管/端盖/PP棉)的固定列来自 qcInspReqConfig.js(Excel 原列序);
 *   · 「自定义检验要求」页签没有固定列,只有匹配键 物料编号;
 *   · 动态字段的归属看 /px/extFields 的 fields[].tab(= yj_field.tab_key);**没有 tab 的**归
 *     「自定义检验要求」—— 那正是本改动之前它们唯一的显示位置(回填脚本之外的兜底,行为不变)。
 *   · 自定义列一律**追加在固定列之后**(不改 Excel 原列序)。
 *
 * 【为什么必须只有这一处】渲染(QcInspReqSheet)与带入检验数据记录(qcInspReqCarry)若各写一份,
 *   就会出现"界面上看得到、报告里带不进来"(或反过来)的不一致 —— 2026-10-04 实测就是这么发现的。
 */
const LEAD_COLS = Object.freeze([
  { key: '物料编号', w: 140 },
  { key: '文件编码', w: 120 },
  { key: '检验依据', w: 130 },
]);
/** 动态列取不到元数据列宽时的默认宽 */
const DEFAULT_EXT_COL_W = 140;
/** 动态字段是否属于该页签(严格按 tab 比)。
 *  原先那条"没标 tab 就归「自定义检验要求」"的兜底已随该页签下线一并取消 ——
 *  分页签面板绑定自定义列时**必须**指明所属页签(后端强制),故正常数据都有 tab;
 *  真没标的(历史脏数据)不属于任何页签,由迁移清理(retire)。 */
function extFieldInTab(f, tabKey) {
  const want = normCode(tabKey);
  return !!want && normCode(f?.tab) === want
}

/** 该页签的动态字段(按接口给的顺序 = yj_field.seq 序) */
function extFieldsOfTab(extFields, tabKey) {
  return (Array.isArray(extFields) ? extFields : []).filter((f) => f && f.label && extFieldInTab(f, tabKey))
}

/**
 * 某页签的列(渲染与带入共用)。
 * @param {{key:string, dynamicCols?:boolean, cols?:Array}|null} tab 页签配置(qcInspReqTabs 的一项)
 * @param {Array<{label:string, tab?:string, parent?:string}>} extFields 动态字段(/px/extFields 的 fields)
 * @param {(label:string)=>number} [widthOf] 动态列取宽(缺省 DEFAULT_EXT_COL_W)
 * @returns {Array<{key:string, w:number, group?:string}>} 列定义(key = 数据键 = 后端下发的 label)
 *
 * 【父字段(分组表头)】动态字段可以带 parent(= yj_field.col_group):父**只做表头分组、没有数据格**,
 *   与固定表的 规格/外观 是同一套东西,所以:
 *   · 有父 ⇒ 插到该父分组**最后一个成员之后**(保持同组相邻,表头才会合并成一个跨列标题);
 *   · 父在表头里还没有 ⇒ 追加到末尾,自成一组(表格自己会画出一个新的分组标题);
 *   · 无父 ⇒ 追加到末尾(独立列,占满两行)。
 *   返回的列里**只有子字段**(每个 key 都是子字段的 label)—— 带入检验数据记录时天然只带子字段。
 */
function colsOfTab(tab, extFields, widthOf) {
  if (!tab) return []
  const w = typeof widthOf === 'function' ? widthOf : () => DEFAULT_EXT_COL_W;
  const dyn = extFieldsOfTab(extFields, tab.key).map((f) => {
    const parent = normCode(f.parent);
    return { key: f.label, w: w(f.label) || DEFAULT_EXT_COL_W, ...(parent ? { group: parent } : {}) }
  });
  const out = tab.dynamicCols ? LEAD_COLS.map((c) => ({ ...c })) : (tab.cols || []).map((c) => ({ ...c }));
  for (const d of dyn) {
    let at = out.length;
    if (d.group) {
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].group === d.group) { at = i + 1; break }
      }
    }
    out.splice(at, 0, d);
  }
  return out
}

/** 该页签可供选择的父字段名(分组表头候选):固定列已有的分组 + 本页签动态字段已用的父。
 *  供「自定义字段」弹窗的「父字段」下拉做候选(仍可自己新建一个父名)。 */
function parentOptionsOfTab(tab, extFields) {
  if (!tab) return []
  const out = [];
  const push = (v) => { const s = String(v ?? '').trim(); if (s && !out.includes(s)) out.push(s); };
  if (!tab.dynamicCols) for (const c of tab.cols || []) push(c.group);
  for (const f of extFieldsOfTab(extFields, tab.key)) push(f.parent);
  return out
}

/* unplugin-vue-components disabled */

const _hoisted_1$6 = {
  key: 0,
  class: "qc-bar"
};
const _hoisted_2$6 = ["title"];
const _hoisted_3$6 = ["title"];
const _hoisted_4$6 = {
  key: 1,
  class: "qc-bar qc-bar2"
};
const _hoisted_5$6 = ["title"];
const _hoisted_6$6 = ["title"];
const _hoisted_7$5 = ["title"];
const _hoisted_8$5 = {
  key: 2,
  class: "fuzzy-panel"
};
const _hoisted_9$4 = { class: "fuzzy-head" };
const _hoisted_10$4 = ["title"];
const _hoisted_11$4 = ["title", "onClick"];
const _hoisted_12$4 = { class: "fuzzy-btns" };
const _hoisted_13$4 = {
  key: 0,
  class: "fuzzy-result"
};
const _hoisted_14$4 = { class: "fuzzy-result-head" };
const _hoisted_15$4 = { key: 0 };
const _hoisted_16$4 = ["onClick"];
const _hoisted_17$4 = { class: "fz-no" };
const _hoisted_18$4 = { class: "fz-meta" };
const _hoisted_19$4 = {
  key: 0,
  class: "fuzzy-empty"
};
const _hoisted_20$4 = {
  key: 3,
  class: "rsp-pages"
};
const _hoisted_21$4 = ["onClick"];
const _hoisted_22$4 = {
  key: 4,
  class: "qc-tabs-loading"
};
const _hoisted_23$4 = {
  key: 0,
  class: "qc-op-col"
};
const _hoisted_24$4 = ["colspan"];
const _hoisted_25$4 = { class: "rs-grp" };
const _hoisted_26$4 = ["rowspan"];
const _hoisted_27$4 = ["colspan"];
const _hoisted_28$4 = {
  key: 0,
  class: "rs-th-op"
};
const _hoisted_29$4 = {
  key: 0,
  class: "rs-grp2"
};
const _hoisted_30$4 = ["data-edit"];
const _hoisted_31$4 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_32$4 = {
  key: 0,
  class: "rs-td-op"
};
const _hoisted_33$4 = ["onClick"];
const _hoisted_34$3 = ["onClick"];
const _hoisted_35$3 = { key: 1 };
const _hoisted_36$3 = ["colspan"];
const _hoisted_37$3 = {
  key: 0,
  class: "rsp-op-pad"
};
const _hoisted_38$2 = {
  key: 1,
  class: "qc-ext-empty"
};
const _hoisted_39$2 = {
  key: 0,
  class: "mod-log-empty"
};
const _hoisted_40$2 = {
  key: 1,
  class: "mod-log-empty"
};
const _hoisted_41$2 = {
  key: 2,
  class: "mod-log-list"
};
const _hoisted_42$2 = { class: "mod-log-head" };
const _hoisted_43$2 = { class: "mod-log-seq" };
const _hoisted_44$2 = {
  key: 0,
  class: "mod-log-table"
};
const _hoisted_45$2 = { style: {"width":"70px"} };
const _hoisted_46$2 = { style: {"width":"260px"} };
const _hoisted_47$2 = { class: "mod-old" };
const _hoisted_48$2 = { class: "mod-new" };
const _hoisted_49$2 = {
  key: 1,
  class: "mod-log-nodata"
};
const _hoisted_50$2 = {
  key: 2,
  class: "mod-log-meta"
};
const _hoisted_51$2 = { key: 0 };
const _hoisted_52$2 = { key: 1 };
const _hoisted_53$2 = { key: 2 };

const FUZZY_SHOW = 50;

const _sfc_main$6 = {
  __name: 'QcInspReqSheet',
  props: {
  head: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  panelCode: { type: String, required: true },
  /** 面板字段元数据(可选):自定义页签的列宽从这里取(label→width),取不到用默认宽 */
  fields: { type: Array, default: () => [] },
  /** 只读嵌入模式(检验数据记录的「检验要求」弹窗用):隐藏本面板自带的迷你工具栏与
   *  模糊搜索/修改记录入口,并收掉为浮动行操作按钮预留的右侧 84px 留白。
   *  只影响"外壳",表格本体(页签 + Excel 一比一表)完全复用 —— 一处维护两处显示。 */
  showToolbar: { type: Boolean, default: true },
  /** 只渲染指定页签(数组;空=全部页签)。弹窗里只显示命中该物料的那几个页签。 */
  tabKeys: { type: Array, default: () => [] },
},
  emits: ['dirty', 'save', 'refresh', 'refresh-config'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;
const user = useUserStore();

/* ── 每张表各自的自定义列(动态字段/备用列池,「自定义字段」里维护) ──
 * 2026-10-04 用户口径:「自定义字段单独针对每个表」——
 * 字段的归属页签 = /px/extFields 的 fields[].tab(= yj_field.tab_key);
 * 列的解析统一走 @core/qc/qcInspReqCols(渲染与带入同源,避免"界面看得到、报告带不进来")。
 * 总览同时下发 **tabs**(该面板页签集):全自定义面板(QC_INSP_REQ_SERIES)的页签条就由它决定。 */
const extFields = ref([]);
const apiTabs = ref([]);
async function loadExtFields() {
  const ov = await fetchExtOverview(props.panelCode, { force: true });
  extFields.value = ov.fields;
  apiTabs.value = ov.tabs;
}
watch(() => props.panelCode, () => { void loadExtFields(); }, { immediate: true });

/** 面板字段元数据里该标签的列宽(取不到给默认宽) */
function extColWidth(label) {
  const f = (props.fields || []).find((x) => (x.dataName || x.code) === label);
  const w = Number(f?.width);
  return Number.isFinite(w) && w > 0 ? w : DEFAULT_EXT_COL_W
}
/** 页签的列:固定列(Excel 原列序) + 该页签自己的自定义列(有父字段的插到该分组末尾) */
function colsOf(t) {
  return colsOfTab(t, extFields.value, extColWidth)
}
/** 是否有分组表头行(列上没有 group ⇒ 单行表头,如全自定义页签) */
function hasGroupRow(t) {
  return groupCols(t).length > 0
}
/** 「自定义字段」弹窗的「所属页签」候选 = 本面板全部页签 */
const tabOptions = computed(() => tabs.value.map((t) => ({ value: t.key, label: t.key })));
/** 「自定义字段」弹窗的「父字段」候选:该页签固定列已有的分组 + 该页签已用的父 */
function parentOptions(tabKey) {
  return parentOptionsOfTab(tabs.value.find((t) => t.key === tabKey) || null, extFields.value)
}
/** 自定义页签还没定义任何列(只有匹配键列,没得可填)—— 界面提示先去加列 */
const tabDynamicEmpty = computed(() => !!tab.value?.dynamicCols && colsOf(tab.value).length <= 1);

/** 页签集:面板决定(固定表=配置;全自定义=物料类别词典);tabKeys 非空时按命中页签收窄(只读弹窗用) */
const tabs = computed(() => {
  const all = tabsOfPanel(props.panelCode, apiTabs.value);
  const keys = props.tabKeys;
  if (!Array.isArray(keys) || !keys.length) return all
  const filtered = all.filter((t) => keys.includes(t.key));
  return filtered.length ? filtered : all
});
const activeTab = ref(0);
/** 当前页签;**全自定义面板的页签集来自接口**,首帧还没回来时给个空页签兜底 ——
 *  否则模板里 tt(tab.sheetTitle) 会读 null 抛错,整个面板白屏(2026-10-04 实测踩到)。 */
const EMPTY_TAB = Object.freeze({ key: '', sheetTitle: '', cols: [], dynamicCols: false });
const tab = computed(() => tabs.value[activeTab.value] || tabs.value[0] || EMPTY_TAB);
/** 页签集还没就绪(全自定义面板:物料类别词典未取回)—— 表格区显示提示而不是渲染空表 */
const tabsReady = computed(() => tabs.value.length > 0);

// ── 行数据:与明细行数组(head.detail[detail_key])同引用的工作镜像(raw 数组无响应式,镜像驱动界面) ──
const rows = ref([]);
const dirty = ref(false);
/** 当前处于编辑态的行(按对象引用比):默认 null=整表只读,防止随手改到数据 */
const editRow = ref(null);
/** 编辑态字段值的响应式草稿(2026-09-23 修「字敲进去又弹回来」)。
 *  根因:档案明细行与行数组都被 markArchListRaw/normalizeArchRaw 打了 raw 标记(无响应式),
 *  v-model 直接绑 row[c.key] 时写值不触发重渲染 —— 而 el-input 的 handleInput 在 emit 之后会
 *  await nextTick() 再用**上一帧的 modelValue** 把 DOM 值刷回去,于是屏幕上刚敲的字原地消失
 *  (实测 `_v-qc-req-type2.cjs`:打完 600ms 后 DOM value 弹回原值,可点「完成」离开编辑态就看得见
 *  那个新值 —— 字确实写进了行对象,只是界面不刷新)。新增行更早一步被打 raw:addRow 里的
 *  touchDirty() → 父级 markInlineDirty → normalizeArchRaw 在它第一次渲染前就标记完了。
 *  故输入框一律绑这层草稿(响应式、驱动界面),每次变更立即回写原行(保存取数不失真)。 */
const editDraft = ref({});
watch(
  editDraft,
  (d) => {
    const row = editRow.value;
    if (!row || !d) return
    for (const k of Object.keys(d)) row[k] = d[k];
  },
  { deep: true },
);
function sourceItems() {
  // ⚠ 明细键 = yj_panel.detail_key(档案面板 = LOWER(panelCode) = 'qc_insp_req'),不是 items ——
  //   原先写死「items 键」建键,界面恒「暂无数据」、新行也不在提交内容里(见 detailRows.js)
  return ensureDetailRows(props.head, detailKeyFallback())
}
/** 兜底键:本组件只服务档案式 QC_INSP_REQ,键 = 面板码小写 */
function detailKeyFallback() {
  return String(props.panelCode || '').toLowerCase()
}
// 镜像同步(2026-09-23 修):本 watch 只在明细行数组 **引用变化**时触发 —— 即载入/切单/刷新,
// 以及 addRow 里 sourceItems() 首次创建那个键的那一次。原实现无条件清 editRow,于是
// 「＋新增数据记录行」加出来的那一行(排在表格最下面)刚进入可填状态就被清成只读文本
// (填写时看不见),再点「修改」也会被同一批重置冲掉(还是不肯修改)。
// 故:编辑进行中**保留编辑态与脏标记**(只同步镜像,新行不丢);
//     非编辑态(载入/切单/保存后刷新)照旧重置镜像并清脏标记。
watch(
  () => detailRowsOf(props.head, detailKeyFallback()),
  (arr) => {
    const next = Array.isArray(arr) ? arr : [];
    if (editRow.value !== null) {
      if (next.length !== rows.value.length || next.some((r, i) => toRaw(r) !== toRaw(rows.value[i]))) {
        rows.value = [...next];
      }
      return
    }
    rows.value = [...next];
    dirty.value = false;
  },
  { immediate: true },
);
/** 两侧都取 raw 再比:ref 里的对象读出来是 reactive 代理,模板里的行也是代理,代理≠原对象 */
function isEditing(row) {
  return editRow.value !== null && toRaw(row) === toRaw(editRow.value)
}
function startEdit(row) {
  const raw = toRaw(row);
  editRow.value = raw;
  // 草稿整行浅拷贝(不只当前页签的列:切页签后列可能变,少了键会显示成空格)
  editDraft.value = { ...raw };
  scrollEditIntoView();
}
/** 把「正在编辑/刚新增」的那一行滚进视野(2026-09-23)。
 *  缘由:折叠棉等页签行数多(实测 26 行),新增行按 id 排到**表格最下面**、
 *  落在视口之外 —— 输入框其实已渲染且能打字(实测 123×22、visible、无裁剪),
 *  但用户看不到,表现就是"新增时填写看不见""点修改也不可编辑"(其实状态已切换)。
 *  用 block:'nearest' 只做最小滚动,不把整页跳走。 */
function scrollEditIntoView() {
  nextTick(() => {
    const el = document.querySelector('.qc-paper tr[data-edit="1"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  });
}
function endEdit() {
  editRow.value = null;
  editDraft.value = {};
}
/** 模糊搜索跳转后的高亮行(同样两侧取 raw 比) */
const flashRow = ref(null);
function isFlash(row) {
  return flashRow.value !== null && toRaw(row) === toRaw(flashRow.value)
}
/** 页签行集:按物料类别过滤;id 升序对齐 Excel 原序(服务端返回 id 倒序),新行殿后 */
function tabRows(t) {
  return rows.value
    .filter((r) => String(r['物料类别'] || '') === t.key)
    .slice()
    .sort((a, b) => (a.id ?? 1e15) - (b.id ?? 1e15))
}
/** 当前页签的行集(2026-09-22:原来的表头关键字过滤框已删,查找统一走「模糊搜索」) */
function rowsOf(t) {
  return tabRows(t)
}

function addRow(t) {
  const row = { '物料类别': t.key };
  sourceItems().push(row); // 原数组(保存取数)
  rows.value.push(row); // 镜像(界面响应)
  startEdit(row); // 新行直接可填(顺带建好响应式草稿)
  touchDirty();
  scrollEditIntoView(); // 新行在表格最下面,滚进视野(否则"填写时看不见")
}
async function removeRow(row) {
  try {
    await ElMessageBox.confirm(tt('删除该行后点「保存」才会落库,确定删除?'), tt('删除该行'), { type: 'warning' });
  } catch { return }
  const raw = toRaw(row);
  const src = sourceItems();
  // 原数组里存的是 raw 行(新增行可能已被 Vue 代理),两个引用都试一遍,避免删不掉
  const i = src.indexOf(raw) >= 0 ? src.indexOf(raw) : src.indexOf(row);
  if (i >= 0) src.splice(i, 1);
  const j = rows.value.indexOf(row);
  if (j >= 0) rows.value.splice(j, 1);
  if (editRow.value !== null && raw === toRaw(editRow.value)) endEdit();
  touchDirty();
}
function touchDirty() {
  dirty.value = true;
  emit('dirty');
}
/** 刷新=整表从后端重取,故先拦一道(未保存的修改会丢) */
async function reload() {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm(tt('未保存的修改将丢失,确定重新加载?'), tt('提示'), { type: 'warning' });
    } catch { return }
  }
  // 镜像 watch 在"编辑进行中"会保留编辑态,刷新属于真·重载,先把编辑态清掉再取数
  endEdit();
  emit('refresh');
}

// ── 模糊搜索(同立项申请那套:字段+内容多条件 AND,可跨页签)→ 点结果跳到该行并高亮 ──
const fuzzyOpen = ref(false);
const fuzzySearched = ref(false);
const fuzzyRows = ref([{ field: '', value: '' }]);
/** 条件字段下拉:按页签分组列全部叶子列(同一列出现在多个页签时各自成项,匹配跨页签生效) */
const fuzzyFieldGroups = computed(() => tabs.value.map((t) => ({
  label: t.key,
  options: colsOf(t).map((c) => ({ value: c.key, label: c.key })),
})));
function toggleFuzzy() {
  fuzzyOpen.value = !fuzzyOpen.value;
  if (!fuzzyOpen.value) fuzzySearched.value = false;
}
function closeFuzzy() {
  fuzzyOpen.value = false;
  fuzzySearched.value = false;
}
function addFuzzyRow() {
  fuzzyRows.value.push({ field: '', value: '' });
}
function removeFuzzyRow(i) {
  fuzzyRows.value.splice(i, 1);
  if (!fuzzyRows.value.length) addFuzzyRow();
}
/** 查找=置标记,结果由 fuzzyResults 计算属性即时算(与立项申请同款:改条件要重新点查找) */
function runFuzzySearch() {
  fuzzySearched.value = true;
}
/** 结果行集:每个条件都要命中(字段空=该页签任意列),命中列与值一并带出便于核对 */
const fuzzyResults = computed(() => {
  if (!fuzzySearched.value) return []
  const conds = fuzzyRows.value.map((r) => ({ field: r.field || '', value: String(r.value || '').trim().toLowerCase() })).filter((c) => c.value);
  if (!conds.length) return []
  const out = [];
  tabs.value.forEach((t, ti) => {
    const colsOfTab = colsOf(t);
    for (const row of tabRows(t)) {
      const hits = [];
      let ok = true;
      for (const c of conds) {
        const cols = c.field ? [c.field] : colsOfTab.map((x) => x.key);
        const hitCol = cols.find((k) => String(row[k] ?? '').toLowerCase().includes(c.value));
        if (!hitCol) { ok = false; break }
        hits.push(`${hitCol}=${String(row[hitCol] ?? '').trim()}`);
      }
      // 行标识:首列(通常是 物料编号)取不到就退到 物料编号/行号 —— 自定义页签首列可能还没定义
      const no = row[colsOfTab[0]?.key] || row['物料编号'] || '#' + (row.id ?? '');
      if (ok) out.push({ tabIndex: ti, tabKey: t.key, row, no, hit: hits.join('；') });
    }
  });
  return out
});
function openFuzzyResult(r) {
  activeTab.value = r.tabIndex;
  flashRow.value = toRaw(r.row);
  nextTick(() => {
    const el = document.querySelector('.qc-insp-sheet .qc-flash');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  setTimeout(() => { flashRow.value = null; }, 2600);
}

// ── 修改记录(本表每次保存留痕:操作人/时间 + 行变化摘要 + 字段级变化) ──
const modLogVisible = ref(false);
const modLogLoading = ref(false);
const modLogRecords = ref([]);
const modLogNo = ref('');
async function openModifyLog() {
  const no = props.head?.['编号'] || props.head?.['单据编号'] || '';
  modLogVisible.value = true;
  modLogLoading.value = true;
  try {
    const res = await callButton({ panelCode: props.panelCode, buttonName: '修改记录', formData: { 编号: no }, buttonParam: {} });
    modLogNo.value = res?.编号 || no;
    modLogRecords.value = (res?.records || []).map((r) => ({
      ...r,
      changes: typeof r.changes === 'string' ? (safeParseJson(r.changes) || []) : (r.changes || []),
      changeMeta: typeof r.changeMeta === 'string' ? (safeParseJson(r.changeMeta) || {}) : (r.changeMeta || {}),
    }));
  } catch (e) {
    modLogRecords.value = [];
    ElMessage.error(errMsg(e) || tt('查询失败'));
  } finally {
    modLogLoading.value = false;
  }
}
function safeParseJson(s) {
  try { return JSON.parse(s) } catch { return null }
}

// ── 表头(同 RecordSheetPanels 两行分组表头算法,配置源=页签 cols) ──
function groupCols(t) {
  return colsOf(t).filter((c) => c.group)
}
function headerRow1(t) {
  const out = [];
  for (const c of colsOf(t)) {
    if (!c.group) {
      out.push({ kind: 'plain', key: c.key, span: 1 });
    } else if (!out.length || out[out.length - 1].kind !== 'group' || out[out.length - 1].label !== c.group) {
      out.push({ kind: 'group', label: c.group, span: 1 });
    } else {
      out[out.length - 1].span += 1;
    }
  }
  return out
}
function gridW(cols) {
  return (cols || []).reduce((s, c) => s + (c.w || 0), 0)
}

/* ── 自定义字段(动态字段/备用列池):**每张表各有各的自定义列**,在这里增删 ──
 * 加完必须重新取动态字段 + 面板配置(PanelxList 的 onFieldEditRefresh 会清 cfgCache)——
 * 引擎那边 registry.reload() 已刷新,不清前端缓存就还是旧字段表。 */
const extMgrVisible = ref(false);
async function onExtFieldDone() {
  invalidateExtFields(props.panelCode);
  await loadExtFields();
  emit('refresh-config');
  emit('refresh');
}

return (_ctx, _cache) => {
  const _component_el_option = ElOption;
  const _component_el_option_group = ElOptionGroup;
  const _component_el_select = ElSelect;
  const _component_el_input = ElInput;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createElementBlock("div", {
    class: normalizeClass(["qc-insp-sheet", { 'qc-insp-sheet--embed': !__props.showToolbar }])
  }, [
    (__props.showToolbar)
      ? (openBlock(), createElementBlock("div", _hoisted_1$6, [
          createBaseVNode("span", {
            class: "qc-bar-btn",
            title: unref(tt)('重新加载数据'),
            onClick: reload
          }, "↻ " + toDisplayString(unref(tt)('刷新')), 9, _hoisted_2$6),
          createBaseVNode("span", {
            class: "qc-bar-btn primary",
            title: unref(tt)('保存整表(缺席行视为删除)'),
            onClick: _cache[0] || (_cache[0] = $event => (emit('save')))
          }, toDisplayString(unref(tt)('保存')), 9, _hoisted_3$6)
        ]))
      : createCommentVNode("", true),
    (__props.showToolbar)
      ? (openBlock(), createElementBlock("div", _hoisted_4$6, [
          createBaseVNode("span", {
            class: "qc-bar-btn",
            title: unref(tt)('按字段+内容多条件查找(可跨页签,点结果跳到该行)'),
            onClick: toggleFuzzy
          }, "🔍 " + toDisplayString(unref(tt)('模糊搜索')), 9, _hoisted_5$6),
          createBaseVNode("span", {
            class: "qc-bar-btn",
            title: unref(tt)('查看本表的修改记录(每次保存留痕,近 3 次)'),
            onClick: openModifyLog
          }, "🕘 " + toDisplayString(unref(tt)('修改记录')), 9, _hoisted_6$6),
          (__props.showToolbar && unref(user).isAdmin)
            ? (openBlock(), createElementBlock("span", {
                key: 0,
                class: "qc-bar-btn",
                title: unref(tt)('给某张表增删自定义列(动态字段/备用列池,仅管理员;弹窗里选所属页签)'),
                onClick: _cache[1] || (_cache[1] = $event => (extMgrVisible.value = true))
              }, "⚙ " + toDisplayString(unref(tt)('自定义字段')), 9, _hoisted_7$5))
            : createCommentVNode("", true)
        ]))
      : createCommentVNode("", true),
    (__props.showToolbar && fuzzyOpen.value)
      ? (openBlock(), createElementBlock("div", _hoisted_8$5, [
          createBaseVNode("div", _hoisted_9$4, [
            createBaseVNode("span", null, toDisplayString(unref(tt)('模糊搜索')), 1),
            createBaseVNode("span", {
              class: "fuzzy-back",
              title: unref(tt)('返回'),
              onClick: closeFuzzy
            }, "↩", 8, _hoisted_10$4)
          ]),
          (openBlock(true), createElementBlock(Fragment, null, renderList(fuzzyRows.value, (row, fi) => {
            return (openBlock(), createElementBlock("div", {
              key: 'fz' + fi,
              class: "fuzzy-row"
            }, [
              createVNode(_component_el_select, {
                modelValue: row.field,
                "onUpdate:modelValue": $event => ((row.field) = $event),
                size: "small",
                filterable: "",
                class: "fuzzy-field",
                placeholder: unref(tt)('字段')
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_option, {
                    value: "",
                    label: unref(tt)('全部字段')
                  }, null, 8, ["label"]),
                  (openBlock(true), createElementBlock(Fragment, null, renderList(fuzzyFieldGroups.value, (g) => {
                    return (openBlock(), createBlock(_component_el_option_group, {
                      key: g.label,
                      label: g.label
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(g.options, (o) => {
                          return (openBlock(), createBlock(_component_el_option, {
                            key: o.value,
                            label: o.label,
                            value: o.value
                          }, null, 8, ["label", "value"]))
                        }), 128))
                      ]),
                      _: 2
                    }, 1032, ["label"]))
                  }), 128))
                ]),
                _: 1
              }, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]),
              createVNode(_component_el_input, {
                modelValue: row.value,
                "onUpdate:modelValue": $event => ((row.value) = $event),
                size: "small",
                class: "fuzzy-value",
                placeholder: unref(tt)('内容'),
                onKeyup: withKeys(runFuzzySearch, ["enter"])
              }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]),
              createBaseVNode("span", {
                class: "fuzzy-del",
                title: unref(tt)('删除该条件'),
                onClick: $event => (removeFuzzyRow(fi))
              }, "×", 8, _hoisted_11$4)
            ]))
          }), 128)),
          createBaseVNode("div", _hoisted_12$4, [
            createBaseVNode("span", {
              class: "qc-bar-btn",
              onClick: addFuzzyRow
            }, toDisplayString(unref(tt)('添加条件')), 1),
            createBaseVNode("span", {
              class: "qc-bar-btn primary",
              onClick: runFuzzySearch
            }, toDisplayString(unref(tt)('查找')), 1)
          ]),
          (fuzzySearched.value)
            ? (openBlock(), createElementBlock("div", _hoisted_13$4, [
                createBaseVNode("div", _hoisted_14$4, [
                  createTextVNode(toDisplayString(unref(tt)('结果')) + "：" + toDisplayString(fuzzyResults.value.length) + " " + toDisplayString(unref(tt)('行')) + " ", 1),
                  (fuzzyResults.value.length > FUZZY_SHOW)
                    ? (openBlock(), createElementBlock("span", _hoisted_15$4, toDisplayString(unref(tt)('（清单仅显示前 {m} 行）').replace('{m}', String(FUZZY_SHOW))), 1))
                    : createCommentVNode("", true)
                ]),
                (openBlock(true), createElementBlock(Fragment, null, renderList(fuzzyResults.value.slice(0, FUZZY_SHOW), (r, ri) => {
                  return (openBlock(), createElementBlock("div", {
                    key: 'fr' + ri,
                    class: "fuzzy-result-row",
                    onClick: $event => (openFuzzyResult(r))
                  }, [
                    createBaseVNode("span", _hoisted_17$4, toDisplayString(unref(tt)(r.tabKey)) + " · " + toDisplayString(r.no), 1),
                    createBaseVNode("span", _hoisted_18$4, toDisplayString(r.hit), 1)
                  ], 8, _hoisted_16$4))
                }), 128)),
                (!fuzzyResults.value.length)
                  ? (openBlock(), createElementBlock("div", _hoisted_19$4, toDisplayString(unref(tt)('未找到匹配行')), 1))
                  : createCommentVNode("", true)
              ]))
            : createCommentVNode("", true)
        ]))
      : createCommentVNode("", true),
    (tabsReady.value)
      ? (openBlock(), createElementBlock("div", _hoisted_20$4, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(tabs.value, (t, ti) => {
            return (openBlock(), createElementBlock("div", {
              key: 'qt' + ti,
              class: normalizeClass(["rsp-page-tab", { active: activeTab.value === ti }]),
              onClick: $event => (activeTab.value = ti)
            }, toDisplayString(unref(tt)(t.key)), 11, _hoisted_21$4))
          }), 128))
        ]))
      : (openBlock(), createElementBlock("div", _hoisted_22$4, toDisplayString(unref(tt)('加载中…')), 1)),
    (tabsReady.value)
      ? (openBlock(), createElementBlock("div", {
          key: 5,
          class: "qc-paper",
          style: normalizeStyle({ width: gridW(colsOf(tab.value)) + 'px' })
        }, [
          createBaseVNode("table", {
            class: "rs-t",
            style: normalizeStyle({ width: gridW(colsOf(tab.value)) + 'px' })
          }, [
            createBaseVNode("colgroup", null, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(colsOf(tab.value), (c, ci) => {
                return (openBlock(), createElementBlock("col", {
                  key: 'qc' + ci,
                  style: normalizeStyle({ width: c.w + 'px' })
                }, null, 4))
              }), 128)),
              (__props.editable)
                ? (openBlock(), createElementBlock("col", _hoisted_23$4))
                : createCommentVNode("", true)
            ]),
            createBaseVNode("tbody", null, [
              createBaseVNode("tr", null, [
                createBaseVNode("td", {
                  colspan: colsOf(tab.value).length,
                  class: "qc-title"
                }, toDisplayString(unref(tt)(tab.value.sheetTitle)), 9, _hoisted_24$4)
              ]),
              createBaseVNode("tr", _hoisted_25$4, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(headerRow1(tab.value), (g, gi) => {
                  return (openBlock(), createElementBlock(Fragment, {
                    key: 'qh1' + gi
                  }, [
                    (g.kind === 'plain')
                      ? (openBlock(), createElementBlock("th", {
                          key: 0,
                          class: "rs-th",
                          rowspan: hasGroupRow(tab.value) ? 2 : 1
                        }, toDisplayString(unref(tt)(g.key)), 9, _hoisted_26$4))
                      : (openBlock(), createElementBlock("th", {
                          key: 1,
                          class: "rs-th",
                          colspan: g.span
                        }, toDisplayString(unref(tt)(g.label)), 9, _hoisted_27$4))
                  ], 64))
                }), 128)),
                (__props.editable)
                  ? (openBlock(), createElementBlock("th", _hoisted_28$4))
                  : createCommentVNode("", true)
              ]),
              (hasGroupRow(tab.value))
                ? (openBlock(), createElementBlock("tr", _hoisted_29$4, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(groupCols(tab.value), (c) => {
                      return (openBlock(), createElementBlock("th", {
                        key: 'qh2' + c.key,
                        class: "rs-th"
                      }, toDisplayString(unref(tt)(c.key)), 1))
                    }), 128))
                  ]))
                : createCommentVNode("", true),
              (openBlock(true), createElementBlock(Fragment, null, renderList(rowsOf(tab.value), (row, i) => {
                return (openBlock(), createElementBlock("tr", {
                  key: row.id ?? ('new' + i),
                  class: normalizeClass({ 'qc-flash': isFlash(row) }),
                  "data-edit": isEditing(row) ? '1' : null
                }, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(colsOf(tab.value), (c) => {
                    return (openBlock(), createElementBlock("td", {
                      key: c.key,
                      class: "rs-td"
                    }, [
                      (__props.editable && isEditing(row))
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: editDraft.value[c.key],
                            "onUpdate:modelValue": $event => ((editDraft.value[c.key]) = $event),
                            size: "small",
                            class: "rs-c-in",
                            onInput: _cache[2] || (_cache[2] = $event => (touchDirty()))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_31$4, toDisplayString(row[c.key] || ''), 1))
                    ]))
                  }), 128)),
                  (__props.editable)
                    ? (openBlock(), createElementBlock("td", _hoisted_32$4, [
                        (!isEditing(row))
                          ? (openBlock(), createElementBlock("span", {
                              key: 0,
                              class: "rs-op-btn rs-op-edit",
                              onClick: $event => (startEdit(row))
                            }, toDisplayString(unref(tt)('修改')), 9, _hoisted_33$4))
                          : (openBlock(), createElementBlock("span", {
                              key: 1,
                              class: "rs-op-btn rs-op-done",
                              onClick: _cache[3] || (_cache[3] = $event => (endEdit()))
                            }, toDisplayString(unref(tt)('完成')), 1)),
                        createBaseVNode("span", {
                          class: "rs-op-btn rs-op-del",
                          onClick: $event => (removeRow(row))
                        }, toDisplayString(unref(tt)('删除')), 9, _hoisted_34$3)
                      ]))
                    : createCommentVNode("", true)
                ], 10, _hoisted_30$4))
              }), 128)),
              (!rowsOf(tab.value).length)
                ? (openBlock(), createElementBlock("tr", _hoisted_35$3, [
                    createBaseVNode("td", {
                      colspan: colsOf(tab.value).length,
                      class: "rs-empty"
                    }, toDisplayString(unref(tt)('暂无数据')), 9, _hoisted_36$3),
                    (__props.editable)
                      ? (openBlock(), createElementBlock("td", _hoisted_37$3))
                      : createCommentVNode("", true)
                  ]))
                : createCommentVNode("", true)
            ])
          ], 4),
          (__props.editable)
            ? (openBlock(), createElementBlock("div", {
                key: 0,
                class: "rs-add",
                style: normalizeStyle({ width: gridW(colsOf(tab.value)) + 'px' }),
                onClick: _cache[4] || (_cache[4] = $event => (addRow(tab.value)))
              }, "＋ " + toDisplayString(unref(tt)('新增数据记录行')), 5))
            : createCommentVNode("", true),
          (tabDynamicEmpty.value)
            ? (openBlock(), createElementBlock("div", _hoisted_38$2, toDisplayString(unref(tt)('该页签的列由「自定义字段」维护，当前还没有列 —— 先加一列再录数据')), 1))
            : createCommentVNode("", true)
        ], 4))
      : createCommentVNode("", true),
    createVNode(FieldManagerDialog, {
      modelValue: extMgrVisible.value,
      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((extMgrVisible).value = $event)),
      "panel-code": __props.panelCode,
      tabs: tabOptions.value,
      "default-tab": tab.value?.key || '',
      "parent-options-of": parentOptions,
      onDone: onExtFieldDone
    }, null, 8, ["modelValue", "panel-code", "tabs", "default-tab"]),
    createVNode(_component_el_dialog, {
      modelValue: modLogVisible.value,
      "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((modLogVisible).value = $event)),
      title: unref(tt)('修改记录') + (modLogNo.value ? ' · ' + modLogNo.value : ''),
      width: "760px",
      "append-to-body": ""
    }, {
      default: withCtx(() => [
        (modLogLoading.value)
          ? (openBlock(), createElementBlock("div", _hoisted_39$2, toDisplayString(unref(tt)('查询中…')), 1))
          : (!modLogRecords.value.length)
            ? (openBlock(), createElementBlock("div", _hoisted_40$2, toDisplayString(unref(tt)('暂无修改记录')), 1))
            : (openBlock(), createElementBlock("div", _hoisted_41$2, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(modLogRecords.value, (r, ri) => {
                  return (openBlock(), createElementBlock("div", {
                    key: 'ml' + ri,
                    class: "mod-log-card"
                  }, [
                    createBaseVNode("div", _hoisted_42$2, [
                      createBaseVNode("span", _hoisted_43$2, toDisplayString(unref(tt)('第')) + " " + toDisplayString(modLogRecords.value.length - ri) + " " + toDisplayString(unref(tt)('次保存')), 1),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('操作人')) + "：" + toDisplayString(r.applyBy || '-') + " " + toDisplayString(r.applyAt || ''), 1)
                    ]),
                    ((r.changes || []).length)
                      ? (openBlock(), createElementBlock("table", _hoisted_44$2, [
                          createBaseVNode("thead", null, [
                            createBaseVNode("tr", null, [
                              createBaseVNode("th", _hoisted_45$2, toDisplayString(unref(tt)('类型')), 1),
                              createBaseVNode("th", _hoisted_46$2, toDisplayString(unref(tt)('字段')), 1),
                              createBaseVNode("th", null, toDisplayString(unref(tt)('原内容')), 1),
                              createBaseVNode("th", null, toDisplayString(unref(tt)('新内容')), 1)
                            ])
                          ]),
                          createBaseVNode("tbody", null, [
                            (openBlock(true), createElementBlock(Fragment, null, renderList(r.changes, (c, ci) => {
                              return (openBlock(), createElementBlock("tr", { key: ci }, [
                                createBaseVNode("td", null, [
                                  createBaseVNode("span", {
                                    class: normalizeClass(["mod-kind", String(c.kind)])
                                  }, toDisplayString(unref(tt)(String(c.kind))), 3)
                                ]),
                                createBaseVNode("td", null, toDisplayString(c.label), 1),
                                createBaseVNode("td", _hoisted_47$2, toDisplayString(c.old || '—'), 1),
                                createBaseVNode("td", _hoisted_48$2, toDisplayString(c.new || '—'), 1)
                              ]))
                            }), 128))
                          ])
                        ]))
                      : (openBlock(), createElementBlock("div", _hoisted_49$2, toDisplayString(unref(tt)('本次保存未变更字段值')), 1)),
                    (r.changeMeta && (r.changeMeta.addedRows || r.changeMeta.removedRows || r.changeMeta.changedRows))
                      ? (openBlock(), createElementBlock("div", _hoisted_50$2, [
                          createTextVNode(toDisplayString(unref(tt)('行变化')) + "：" + toDisplayString(unref(tt)('新增')) + " " + toDisplayString(r.changeMeta.addedRows || 0) + " " + toDisplayString(unref(tt)('行')) + " / " + toDisplayString(unref(tt)('删除')) + " " + toDisplayString(r.changeMeta.removedRows || 0) + " " + toDisplayString(unref(tt)('行')) + " / " + toDisplayString(unref(tt)('修改')) + " " + toDisplayString(r.changeMeta.changedRows || 0) + " " + toDisplayString(unref(tt)('行')) + " ", 1),
                          ((r.changeMeta.addedSamples || []).length)
                            ? (openBlock(), createElementBlock("span", _hoisted_51$2, "（" + toDisplayString(unref(tt)('新增')) + "：" + toDisplayString(r.changeMeta.addedSamples.join('、')) + "）", 1))
                            : createCommentVNode("", true),
                          ((r.changeMeta.removedSamples || []).length)
                            ? (openBlock(), createElementBlock("span", _hoisted_52$2, "（" + toDisplayString(unref(tt)('删除')) + "：" + toDisplayString(r.changeMeta.removedSamples.join('、')) + "）", 1))
                            : createCommentVNode("", true),
                          (r.changeMeta.truncated)
                            ? (openBlock(), createElementBlock("span", _hoisted_53$2, "（" + toDisplayString(unref(tt)('字段变化过多，仅显示前 80 条')) + "）", 1))
                            : createCommentVNode("", true)
                        ]))
                      : createCommentVNode("", true)
                  ]))
                }), 128))
              ]))
      ]),
      _: 1
    }, 8, ["modelValue", "title"])
  ], 2))
}
}

};
const QcInspReqSheet = /*#__PURE__*/_export_sfc(_sfc_main$6, [['__scopeId',"data-v-55300d13"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$5 = {
  key: 0,
  class: "req-view-tip"
};
const _hoisted_2$5 = {
  key: 1,
  class: "req-view-tip err"
};
const _hoisted_3$5 = { class: "req-view-sub" };
const _hoisted_4$5 = { class: "req-view-count" };
const _hoisted_5$5 = {
  key: 0,
  class: "req-view-warn"
};
const _hoisted_6$5 = {
  key: 0,
  class: "req-view-sec-title"
};
const _hoisted_7$4 = { class: "req-view-count" };
const _hoisted_8$4 = {
  key: 3,
  class: "req-view-tip"
};


const _sfc_main$5 = {
  __name: 'QcInspReqViewDialog',
  props: {
  modelValue: { type: Boolean, default: false },
  /** 本单的物料编码(检验数据记录抬头);空则不应打开弹窗 */
  materialCode: { type: String, default: '' },
},
  emits: ['update:modelValue'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

const code = computed(() => normCode(props.materialCode));
const title = computed(() => tt('来料检验要求') + (code.value ? ' · ' + code.value : ''));

const rows = ref([]);
const loading = ref(false);
const loadError = ref('');
/** 两个面板的页签集(全自定义面板由物料类别词典决定) */
const seriesTabs = ref([]);

/** 面板名(标题只在两个面板都有命中时才显示,单一命中时不啰嗦) */
const PANEL_NAMES = { [QC_INSP_REQ_PANEL]: '来料检验要求', [QC_INSP_REQ_SERIES_PANEL]: '来料检验要求(系列)' };

/** 每段 = 一个面板:只喂落在**该面板页签**上的行(配置外类别另行提示,不让它悄悄消失) */
const sections = computed(() => {
  const panels = [
    { panelCode: QC_INSP_REQ_PANEL, tabs: qcInspReqTabs },
    { panelCode: QC_INSP_REQ_SERIES_PANEL, tabs: tabsOfPanel(QC_INSP_REQ_SERIES_PANEL, seriesTabs.value) },
  ];
  const out = [];
  for (const p of panels) {
    const mine = rows.value.filter((r) => String(r?.['__panel'] || '') === p.panelCode);
    const groups = lookupReqGroups(mine, code.value, p.tabs);
    const hitRows = groups.filter((g) => g.tab).flatMap((g) => g.rows);
    if (!hitRows.length) continue
    out.push({
      panelCode: p.panelCode,
      panelName: PANEL_NAMES[p.panelCode],
      rows: hitRows,
      tabKeys: reqTabKeysOf(groups),
      head: { detail: { items: hitRows } },
    });
  }
  return out
});
const unknownRows = computed(() => {
  const known = new Set([...qcInspReqTabs.map((t) => t.key), ...seriesTabs.value]);
  return rows.value.filter((r) => !known.has(String(r?.['物料类别'] || '').trim())).length
});
/** 命中行总数(含配置外类别,如实计数) */
const totalRows = computed(() => rows.value.filter((r) => {
  const k = String(r?.['物料类别'] || '').trim();
  return qcInspReqTabs.some((t) => t.key === k) || seriesTabs.value.includes(k)
}).length);

/** 打开即取数:两个面板各取一次(档案面板一次全量,量小),行上打 __panel 标签便于分段显示。
 *  取数走 @core/qc/qcInspReqApi(与检验报告的「带入检验要求」同一入口,两处所见必须一致) */
watch(
  () => [props.modelValue, code.value],
  async ([open]) => {
    if (!open) return
    if (!code.value) { rows.value = []; seriesTabs.value = []; return }
    loading.value = true;
    loadError.value = '';
    try {
      const [rowsA, rowsB, ovB] = await Promise.all([
        fetchReqRowsOfPanel(QC_INSP_REQ_PANEL, code.value),
        fetchReqRowsOfPanel(QC_INSP_REQ_SERIES_PANEL, code.value),
        fetchExtOverview(QC_INSP_REQ_SERIES_PANEL),
      ]);
      seriesTabs.value = ovB.tabs;
      rows.value = [
        ...rowsA.map((r) => ({ ...r, __panel: QC_INSP_REQ_PANEL })),
        ...rowsB.map((r) => ({ ...r, __panel: QC_INSP_REQ_SERIES_PANEL })),
      ];
    } catch (e) {
      rows.value = [];
      loadError.value = e?.response?.data?.msg || e?.message || String(e);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

return (_ctx, _cache) => {
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: title.value,
    width: "1100px",
    top: "6vh",
    "append-to-body": "",
    "destroy-on-close": "",
    "onUpdate:modelValue": _cache[1] || (_cache[1] = (v) => emit('update:modelValue', v))
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, {
        onClick: _cache[0] || (_cache[0] = $event => (emit('update:modelValue', false)))
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
        ]),
        _: 1
      })
    ]),
    default: withCtx(() => [
      (loading.value)
        ? (openBlock(), createElementBlock("div", _hoisted_1$5, toDisplayString(unref(tt)('查询中…')), 1))
        : (loadError.value)
          ? (openBlock(), createElementBlock("div", _hoisted_2$5, toDisplayString(loadError.value), 1))
          : (sections.value.length)
            ? (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                createBaseVNode("div", _hoisted_3$5, [
                  createTextVNode(toDisplayString(unref(tt)('物料编号')) + "：", 1),
                  createBaseVNode("b", null, toDisplayString(code.value), 1),
                  createBaseVNode("span", _hoisted_4$5, "（" + toDisplayString(unref(tt)('共 {n} 行').replace('{n}', String(totalRows.value))) + "）", 1),
                  (unknownRows.value)
                    ? (openBlock(), createElementBlock("span", _hoisted_5$5, toDisplayString(unref(tt)('另有 {n} 行物料类别不在检验要求模板中').replace('{n}', String(unknownRows.value))), 1))
                    : createCommentVNode("", true)
                ]),
                (openBlock(true), createElementBlock(Fragment, null, renderList(sections.value, (sec) => {
                  return (openBlock(), createElementBlock("div", {
                    key: sec.panelCode,
                    class: "req-view-sec"
                  }, [
                    (sections.value.length > 1)
                      ? (openBlock(), createElementBlock("div", _hoisted_6$5, [
                          createTextVNode(toDisplayString(unref(tt)(sec.panelName)) + " ", 1),
                          createBaseVNode("span", _hoisted_7$4, "（" + toDisplayString(unref(tt)('共 {n} 行').replace('{n}', String(sec.rows.length))) + "）", 1)
                        ]))
                      : createCommentVNode("", true),
                    createVNode(QcInspReqSheet, {
                      head: sec.head,
                      editable: false,
                      "panel-code": sec.panelCode,
                      "show-toolbar": false,
                      "tab-keys": sec.tabKeys
                    }, null, 8, ["head", "panel-code", "tab-keys"])
                  ]))
                }), 128))
              ], 64))
            : (openBlock(), createElementBlock("div", _hoisted_8$4, toDisplayString(unref(tt)('该物料未维护来料检验要求')), 1))
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const QcInspReqViewDialog = /*#__PURE__*/_export_sfc(_sfc_main$5, [['__scopeId',"data-v-14588d02"]]);

/**
 * qcInspReqCarry.js — 「来料检验要求 → 检验报告表体」带入逻辑(纯函数,无 Vue 依赖,可单测)
 *
 * 【用户口径(2026-10-04)】
 *   「更改检验报告,需要根据物料编码能够在来料检验要求找到对应的行。并且在检验项和检验标准中,
 *     做到对应填入检验项就是上面的检验项目,检验标准就是下面对应的数据。」
 *   即:来料检验要求(QC_INSP_REQ)那张 Excel 表 —— **列名(表头)= 检验项目**,
 *       该列在命中行里的**数据 = 检测标准**;逐列拆成检验报告的「检验项 / 检测标准」两列。
 *   例:PP管 YJ-JB-001 命中行 → 长=274.5±0.5 / 内径=6±0.2 / 外径=8.1±0.1
 *       → 报告三行:检验项「长」检测标准「274.5±0.5」…(顺序 = Excel 原列序 = 页签配置序)
 *   列名与标准库 qc.insp_item 的 25 条词条完全一致(那份词条就是从这 7 张表的非标识列名并集来的),
 *   故带入的检验项在下拉里选得中,不是新造词汇。
 *
 * 【合并口径(用户选:只补缺失项)】
 *   报告里已经有的检验项一律保留 —— **检测结果/单项判定绝不覆盖**,只把缺的按上述顺序补进来。
 *   于是「重复点带入」是幂等的:补过一遍之后再点,一行都不加。
 *
 * 【多页签/多行命中】按 qcInspReqTabs 配置序 + 组内 id 升序(由 lookupReqGroups 保证)展平;
 *   同名检验项只带一次,取**首个非空数据**那一行(实测同一编号跨页签的列名基本不重叠)。
 */

/** 要求表的标识列:不进检验项(物料编号=匹配键;物料类别=页签分流键) */
const ID_COLS = Object.freeze(['物料编号', '物料类别']);
/** 只进报告**抬头**、不进表体的列:文件编码/检验依据 按物料编码带进报告的抬头两格
 *  (用户口径 2026-10-04:「检验报告里面的文件编码与检验依据,要靠物料编码来对应填入」),
 *  它们**不是检验项** —— 表体里不该出现「检验项=文件编码」这种行。 */
const HEAD_ONLY_COLS = Object.freeze(['文件编码', '检验依据']);

/** 非业务列(主键/审计列):配置外类别的兜底列名推导时要排掉 */
const NON_BIZ_COLS = Object.freeze(['id']);
const isNonBiz = (k) => NON_BIZ_COLS.includes(k) || String(k).startsWith('asp_');

/** 检验项去重键:去掉**所有**空白(半角/全角/换行)后再比 ——
 *  「脏污、头发丝」与「脏污、头发丝 」「外径 1」与「外径1」在业务上是同一项,
 *  因空格差异被当成两项就会带出一条重复行(标准库与 Excel 排版差异的常见来源)。 */
function carryKeyOf(v) {
  return String(v ?? '').replace(/\s+/g, '')
}

/**
 * 配置外物料类别的兜底列名:取该组行对象的自有键顺序(JSON 键序 = SQL 选取列序),
 * 排掉标识列/主键/审计列。只为「不静默丢数据」,正常路径始终走页签配置的 cols。
 */
function fallbackColsOf(rows) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const k of Object.keys(row || {})) {
      if (ID_COLS.includes(k) || isNonBiz(k) || out.includes(k)) continue
      out.push(k);
    }
  }
  return out
}

/**
 * 命中分组 → 检验报告的「检验项 / 检测标准」条目(已去重、已剔除空数据列)。
 * @param {Array} groups lookupReqGroups 的结果
 * @param {Array<{label:string, tab?:string}>} [extFields] 来料检验要求的动态字段(/px/extFields 的 fields):
 *        每张表各自的自定义列也在这张表里带入(用户口径 2026-10-04「自定义字段单独针对每个表」)。
 *        不传 = 只带固定列(与改动前等价)。
 * @returns {Array<{检验项: string, 检测标准: string}>}
 */
function carryEntriesOf(groups, extFields) {
  const out = [];
  const seen = new Set();
  for (const g of Array.isArray(groups) ? groups : []) {
    // 列序与界面**同源**(colsOfTab):固定列在前(Excel 原列序)、该表的自定义列追加在后;
    // 配置外物料类别(理论上不会有)没有页签配置,退回按行自身的键序(后端按 yj_field 顺序下发)。
    let cols = g?.tab ? colsOfTab(g.tab, extFields).map((c) => c.key) : fallbackColsOf(g?.rows);
    // 兜底:全自定义页签的列全在动态字段里 —— 字段清单取不到(接口失败/调用方没传)时,
    // 退回按行自身键序,否则那张表会**一条都带不出来**(静默丢数据,比列序不理想严重得多)。
    if (g?.tab?.dynamicCols && cols.length <= 1) cols = fallbackColsOf(g?.rows);
    for (const row of Array.isArray(g?.rows) ? g.rows : []) {
      for (const key of cols) {
        if (ID_COLS.includes(key) || HEAD_ONLY_COLS.includes(key) || isNonBiz(key)) continue
        const std = String(row?.[key] ?? '').trim();
        // 该列数据为空 ⇒ 这条要求没有可填的检测标准,不成一项(带走一行空标准只会添乱)
        if (!std) continue
        const k = carryKeyOf(key);
        if (!key || !k || seen.has(k)) continue
        seen.add(k);
        out.push({ 检验项: key, 检测标准: std });
      }
    }
  }
  return out
}

/**
 * 从条目里挑出报告**还没有**的检验项(已有的连同行内已填的检测结果/判定一起保留)。
 * @param {Array<object>} existingItems 报告表体现有行(键=『检验项』)
 * @param {Array<{检验项: string, 检测标准: string}>} entries carryEntriesOf 的结果
 * @returns {Array<{检验项: string, 检测标准: string}>} 需要补进来的行(顺序同 entries)
 */
function missingCarryRows(existingItems, entries) {
  const have = new Set(
    (Array.isArray(existingItems) ? existingItems : [])
      .map((r) => carryKeyOf(r?.['检验项']))
      .filter(Boolean),
  );
  return (Array.isArray(entries) ? entries : []).filter((e) => e && !have.has(carryKeyOf(e.检验项)))
}

/**
 * 从命中分组里取**报告抬头**要带入的两项:文件编码 / 检验依据(2026-10-04 用户口径:
 * 「检验报告里面的文件编码与检验依据,要靠物料编码来对应填入,并且不可以修改」)。
 * 口径:按页签配置序取**首个非空值**(与「检验项」的取法同源,不另立一套);
 * 要求表没填的项**不返回**(调用方保留报告原值/默认 YJ-QR-96 / YJ-Q-30)。
 * @param {Array} groups lookupReqGroups 的结果
 * @returns {{文件编码?: string, 检验依据?: string}}
 */
const CARRY_HEAD_KEYS = Object.freeze(['文件编码', '检验依据']);
function carryHeadOf(groups) {
  const out = {};
  for (const key of CARRY_HEAD_KEYS) {
    for (const g of Array.isArray(groups) ? groups : []) {
      for (const row of Array.isArray(g?.rows) ? g.rows : []) {
        const v = String(row?.[key] ?? '').trim();
        if (v) { out[key] = v; break }
      }
      if (out[key]) break
    }
  }
  return out
}

/**
 * 一行到位:来料检验要求全量行 + 物料编码 + 报告现有行 → 该补进来的行 + 抬头该带入的两项。
 * @param {Array} reqRows 两个面板的要求行(已合并)
 * @param {string} materialCode 物料编码
 * @param {Array} existingItems 报告表体现有行
 * @param {Array} [extFields] 两个面板的动态字段(合并传)
 * @param {Array} [tabs] 两个面板的页签全集(默认只有固定 7 张)
 * @returns {{entries: Array<object>, add: Array<object>, head: object}}
 *          entries=该物料的全部可带入项;add=其中缺的;head=报告抬头要写入的 文件编码/检验依据
 */
function carryPlan(reqRows, materialCode, existingItems, extFields, tabs) {
  const groups = lookupReqGroups(reqRows, materialCode, tabs);
  const entries = carryEntriesOf(groups, extFields);
  return { entries, add: missingCarryRows(existingItems, entries), head: carryHeadOf(groups) }
}

/**
 * 检验数据记录(QC_INSP_REC)检验报告 —— 版式与字段定义的唯一真源。
 *
 * 【版式来源】《品质资料 2026.09.19.xlsx》「检验数据记录模版」页签(整张 YJ-QR-96 检验报告):
 *   抬头: 物料名称 / 物料编码 / 物料批次 / 检验日期 ｜ 来料日期 / 来料数量 / 文件编码(YJ-QR-96) / 检验依据(YJ-Q-30)
 *   表体: 检验项(数据库选择) | 检测标准 | 检测结果 | 单项判定
 *   表尾: 检验结论 / 处理意见 ｜ 检验人(账号登录人自动生成) / 审核人(固定:冯敏)
 *
 * 【键口径】yj_field 里 label == col_name(与检验目录同理),所以前端中文列名即落库键;
 *   后端 rowToLabels 载入按标签、labelsToCols 保存按标签映射,两侧一致才不会丢库。
 */

/** 抬头区(原表右上/左上两列成对布局):左标签-右值 各一行,两列成对。
 *  `locked`:需要**回填/带入**的字段只读 ——
 *  · 物料批次:批次号在采购入库审核时才分配并回填(BatchService 回填检验单/检验目录/本报告),录入阶段不许手填;
 *  · 文件编码 / 检验依据:按**物料编码**从「来料检验要求」对应行的同名两列带入(2026-10-04 用户口径
 *    「要靠物料编码来对应填入,并且不可以修改」),故纸面只显示文本、不给输入框。
 *  程序化带入(「带入检验要求」/自动带入)不受影响。 */
const QC_INSP_REC_HEAD_ROWS = Object.freeze([
  [{ label: '物料名称', key: '物料名称' }, { label: '来料日期', key: '来料日期' }],
  [{ label: '物料编码', key: '物料编码' }, { label: '来料数量', key: '来料数量' }],
  [{ label: '物料批次', key: '物料批次', locked: true }, { label: '文件编码', key: '文件编码', locked: true }],
  [{ label: '检验日期', key: '检验日期' }, { label: '检验依据', key: '检验依据', locked: true }],
]);

/** 表尾区:检验结论/处理意见(整宽) + 签名行 */
const QC_INSP_REC_FOOT_FULL = Object.freeze([
  { label: '检验结论', key: '检验结论' },
  { label: '处理意见', key: '处理意见' },
]);
const QC_INSP_REC_SIGN_ROW = Object.freeze([
  { label: '检验人', key: '检验人', locked: true },
  // 原表印「审核人 固定:冯敏」。落库列名不能叫「审核人」——ButtonService 保存时显式丢弃
  // 「审核人/审核时间」(那是 yj_doc_status.shr 审核留痕的虚拟字段),故用专属列 表单审核人,
  // 纸面仍按原表显示「审核人」;单据真审核后另有虚拟键 审核人(=shr)可作只读兜底。
  { label: '审核人', key: '表单审核人', displayKey: '表单审核人', auditKey: '审核人' },
]);

/** 检验项所在的标准库编码(与原表「检验项为数据库选择」对应) */
const QC_INSP_ITEM_LIB = 'qc.insp_item';

/* unplugin-vue-components disabled */

/* unplugin-vue-components disabled */

const _hoisted_1$4 = { class: "qc-rec-sheet" };
const _hoisted_2$4 = { class: "qr-titlerow" };
const _hoisted_3$4 = { class: "qr-title" };
const _hoisted_4$4 = { class: "qr-head-table" };
const _hoisted_5$4 = { class: "qr-label" };
const _hoisted_6$4 = {
  key: 2,
  class: "qr-cell-text"
};
const _hoisted_7$3 = ["title"];
const _hoisted_8$3 = { class: "qr-section" };
const _hoisted_9$3 = ["title"];
const _hoisted_10$3 = { class: "qr-table" };
const _hoisted_11$3 = { class: "c-item" };
const _hoisted_12$3 = ["title"];
const _hoisted_13$3 = { class: "c-std" };
const _hoisted_14$3 = { class: "c-result" };
const _hoisted_15$3 = { class: "c-judge" };
const _hoisted_16$3 = {
  key: 0,
  class: "c-op"
};
const _hoisted_17$3 = { class: "c-item" };
const _hoisted_18$3 = {
  key: 1,
  class: "qr-cell-text"
};
const _hoisted_19$3 = { class: "c-std" };
const _hoisted_20$3 = {
  key: 1,
  class: "qr-cell-text"
};
const _hoisted_21$3 = { class: "c-result" };
const _hoisted_22$3 = {
  key: 1,
  class: "qr-cell-text"
};
const _hoisted_23$3 = { class: "c-judge" };
const _hoisted_24$3 = {
  key: 1,
  class: "qr-cell-text"
};
const _hoisted_25$3 = {
  key: 0,
  class: "c-op"
};
const _hoisted_26$3 = ["title", "onClick"];
const _hoisted_27$3 = ["title", "onClick"];
const _hoisted_28$3 = { key: 0 };
const _hoisted_29$3 = ["colspan"];
const _hoisted_30$3 = {
  key: 0,
  class: "qr-addbar"
};
const _hoisted_31$3 = { class: "qr-foot-table" };
const _hoisted_32$3 = { class: "qr-label" };
const _hoisted_33$3 = {
  class: "qr-value qr-value-wide",
  colspan: "3"
};
const _hoisted_34$2 = {
  key: 1,
  class: "qr-cell-text"
};
const _hoisted_35$2 = { class: "qr-label" };
const _hoisted_36$2 = { class: "qr-value" };
const _hoisted_37$2 = {
  key: 1,
  class: "qr-cell-text qr-sign"
};

/** 表体数据键(与 qc_insp_rec_detail 物理列同名) */
const AUTO_CARRY_DELAY = 600;

const _sfc_main$4 = {
  __name: 'QcInspRecSheet',
  props: {
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
},
  emits: ['dirty', 'refresh-config'],
  setup(__props, { emit: __emit }) {

const K = Object.freeze({
  ITEM: '检验项',
  STD: '检测标准',
  RESULT: '检测结果',
  JUDGE: '单项判定',
});

const props = __props;
const emit = __emit;

/** 检验项明细行(来自当前单据 detail.items;新增行无 id,保存后由引擎写入) */
const items = computed(() => {
  const d = props.head?.detail;
  return d && Array.isArray(d.items) ? d.items : []
});

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])));
function optionsOf(key) {
  const f = fieldMap.value.get(key);
  return (f?.options || []).map((o) => (typeof o === 'object'
    ? { value: o.value ?? o.label, label: o.label ?? o.value }
    : { value: o, label: o }))
}
/** 检验项候选:来自标准库 qc.insp_item(原表「检验项为数据库选择」) */
const itemOptions = computed(() => optionsOf(K.ITEM));
/** 单项判定:下拉(合格/不合格),字典值=中文数据键 */
const judgeOptions = computed(() => optionsOf(K.JUDGE));

function isDateField(key) {
  return String(fieldMap.value.get(key)?.dataType || '') === '日期'
}

/**
 * 签名行取值(只读态):
 * · 检验人(锁定,原表「账号登录人自动生成」)——未落值时显示说明文案;
 * · 审核人(原表「固定:冯敏」)——落库键是 表单审核人;单据真审核后另有虚拟键 审核人(=yj_doc_status.shr)兜底。
 */
/** 签名行取值(只读态):见 signText 注释;取值走 headVal,避免与模板里的 props.head 同名遮蔽 */
function signText(cell) {
  const v = headVal(cell.key) || (cell.auditKey ? headVal(cell.auditKey) : '');
  if (v) return v
  return cell.locked ? tt('账号登录人自动生成') : ''
}
function headVal(key) {
  const v = props.head?.[key];
  return v === undefined || v === null ? '' : String(v)
}

/** 行增删(与检验目录同款 ＋/× 操作) */
function insertAfter(i) {
  const d = props.head.detail;
  if (!d || !Array.isArray(d.items)) return
  d.items.splice(i + 1, 0, {});
  emit('dirty');
}
function removeItem(i) {
  const d = props.head.detail;
  if (d && Array.isArray(d.items)) d.items.splice(i, 1);
  emit('dirty');
}
function addItem() {
  const d = props.head.detail || (props.head.detail = {});
  if (!Array.isArray(d.items)) d.items = [];
  d.items.push({});
  emit('dirty');
}

/** 标准库维护:改完让面板重拉一次配置(选项随之刷新) */
const stdLibVisible = ref(false);
function openStdLib() {
  stdLibVisible.value = true;
}
function onStdLibChanged() {
  emit('refresh-config');
}

/**
 * 按「物料编码」查看来料检验要求(2026-09-23 用户口径)。
 * 只读弹窗按物料编号精确匹配品质管理 > 来料检验要求里的行;本单没填物料编码时先提示再拦。
 */
const reqViewVisible = ref(false);
const materialCode = computed(() => String(props.head?.['物料编码'] ?? '').trim());
function openReqView() {
  if (!materialCode.value) {
    ElMessage.warning(tt('请先填写物料编码'));
    return
  }
  reqViewVisible.value = true;
}

/**
 * 按物料编码把「来料检验要求」的检验项与检测标准带进表体(2026-10-04 用户口径):
 *   「根据物料编码能够在来料检验要求找到对应的行;检验项就是上面的检验项目,
 *     检验标准就是下面对应的数据。」
 * 即:要求表里**列名(表头)= 检验项目**、**该列在命中行里的数据 = 检测标准**,
 * 逐列拆成本报告的两列(算法在 @core/qc/qcInspReqCarry,纯函数有单测)。
 * 合并口径:只补缺失项 —— 已有的检验项一律保留,检测结果/单项判定绝不覆盖,重复点击幂等。
 * @param {{silent?: boolean}} opts silent=true 时(自动带入)不弹「无需带入」这类打扰提示
 * @returns {Promise<number>} 实际补进来的行数
 */
const carrying = ref(false);
async function carryFromReq(opts = {}) {
  const code = materialCode.value;
  if (!code) {
    if (!opts.silent) ElMessage.warning(tt('请先填写物料编码'));
    return 0
  }
  if (carrying.value) return 0
  carrying.value = true;
  try {
    // 两个面板一起带:要求可能维护在 QC_INSP_REQ(7 张固定表)或 QC_INSP_REQ_SERIES(10 张系列表);
    // 动态字段(每张表各自的自定义列)与页签全集一并取,否则界面上看得到的自定义列带不进来。
    const [rows, ovA, ovB] = await Promise.all([
      fetchReqRows(code),
      fetchExtOverview(QC_INSP_REQ_PANEL),
      fetchExtOverview(QC_INSP_REQ_SERIES_PANEL),
    ]);
    const extFields = [...ovA.fields, ...ovB.fields];
    const tabs = [...qcInspReqTabs, ...tabsOfPanel(QC_INSP_REQ_SERIES_PANEL, ovB.tabs)];
    const plan = carryPlan(rows, code, items.value, extFields, tabs);
    // 抬头两项(文件编码/检验依据):按物料编码带入,纸面不可修改 ——
    // 要求表没填的项**不动**(保留报告原值/默认 YJ-QR-96 / YJ-Q-30)
    let headChanged = 0;
    for (const [k, v] of Object.entries(plan.head || {})) {
      if (v && String(props.head[k] ?? '') !== String(v)) { props.head[k] = v; headChanged++; }
    }
    if (!plan.entries.length) {
      if (headChanged) emit('dirty');
      else if (!opts.silent) ElMessage.warning(tt('来料检验要求里没有该物料的检验数据，无法带入'));
      return headChanged
    }
    if (!plan.add.length) {
      if (headChanged) emit('dirty');
      if (!opts.silent) {
        ElMessage.info(headChanged
          ? tt('已按来料检验要求更新文件编码与检验依据')
          : tt('检验项已与来料检验要求一致，无需带入'));
      }
      return headChanged
    }
    const d = props.head.detail || (props.head.detail = {});
    if (!Array.isArray(d.items)) d.items = [];
    // 逐列落成行:检验项=表头列名,检测标准=该列数据;结果/判定留空等人填
    for (const e of plan.add) d.items.push({ [K.ITEM]: e.检验项, [K.STD]: e.检测标准 });
    emit('dirty');
    ElMessage.success(tt('已按来料检验要求带入 {n} 项检验项').replace('{n}', String(plan.add.length)));
    return plan.add.length
  } catch (e) {
    if (!opts.silent) ElMessage.error(errMsg(e) || tt('带入检验要求失败'));
    return 0
  } finally {
    carrying.value = false;
  }
}

/**
 * 物料编码填好后自动带入(2026-10-04):仅当**报告表体还没有检验项行**时触发;
 * 已有行(哪怕只有一行)一律不自动改 —— 想补走「带入检验要求」按钮,口径一致(只补缺失项)。
 * 去抖 600ms:物料编码是逐字符输入的,没必要也不能每敲一下就去查一次;
 * 半截编码不精确匹配任何物料(见 matchReqRowsByMaterial),所以中途不会带错内容。
 */
let autoCarryTimer = 0;
watch(materialCode, (code) => {
  if (autoCarryTimer) { clearTimeout(autoCarryTimer); autoCarryTimer = 0; }
  if (!props.editable || !code) return
  autoCarryTimer = setTimeout(() => {
    autoCarryTimer = 0;
    // 到点了再确认一次:这 600ms 里可能已经手工加了行 / 单据被切走成了只读
    if (!props.editable || items.value.length) return
    void carryFromReq({ silent: true });
  }, AUTO_CARRY_DELAY);
});
onBeforeUnmount(() => { if (autoCarryTimer) clearTimeout(autoCarryTimer); });

/**
 * 从检验目录「新增检验」跳进来时,把批次/物料预填到**新建的空报告**上
 * (路由 query: prefillBatch/prefillMaterial)。只在单据还空着时填一次,已录入内容一律不动。
 */
const route = useRoute();
const prefilled = ref(false);
watch(
  () => [props.editable, props.head?.['单据编号'], props.head?.['物料批次']],
  () => {
    if (prefilled.value || !props.editable) return
    const q = route.query || {};
    const batch = String(q.prefillBatch || '').trim();
    if (!batch) return
    const d = props.head?.detail;
    const hasRows = !!(d && Array.isArray(d.items) && d.items.length);
    if (props.head['物料批次'] || hasRows) {
      prefilled.value = true; // 已有内容:不是新建空单,不预填
      return
    }
    props.head['物料批次'] = batch;
    const mat = String(q.prefillMaterial || '').trim();
    if (mat) props.head['物料名称'] = mat;
    prefilled.value = true;
    emit('dirty');
  },
  { immediate: true },
);

return (_ctx, _cache) => {
  const _component_el_date_picker = ElDatePicker;
  const _component_el_input = ElInput;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createElementBlock("div", _hoisted_1$4, [
    createBaseVNode("div", _hoisted_2$4, [
      createBaseVNode("div", _hoisted_3$4, toDisplayString(unref(tt)('检验报告')), 1)
    ]),
    createBaseVNode("table", _hoisted_4$4, [
      _cache[12] || (_cache[12] = createBaseVNode("colgroup", null, [
        createBaseVNode("col", { class: "fc-label" }),
        createBaseVNode("col", { class: "fc-v1" }),
        createBaseVNode("col", { class: "fc-label2" }),
        createBaseVNode("col", { class: "fc-v2" })
      ], -1)),
      createBaseVNode("tbody", null, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(unref(QC_INSP_REC_HEAD_ROWS), (pair, ri) => {
          return (openBlock(), createElementBlock("tr", {
            key: 'h' + ri
          }, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(pair, (cell) => {
              return (openBlock(), createElementBlock(Fragment, {
                key: cell.key
              }, [
                createBaseVNode("th", _hoisted_5$4, toDisplayString(unref(tt)(cell.label)), 1),
                createBaseVNode("td", {
                  class: normalizeClass(["qr-value", { 'qr-value-code': cell.key === '物料编码' }])
                }, [
                  (isDateField(cell.key) && __props.editable && !cell.locked)
                    ? (openBlock(), createBlock(_component_el_date_picker, {
                        key: 0,
                        modelValue: __props.head[cell.key],
                        "onUpdate:modelValue": $event => ((__props.head[cell.key]) = $event),
                        type: "date",
                        "value-format": "YYYY-MM-DD",
                        size: "small",
                        class: "qr-cell-input",
                        placeholder: unref(tt)('选择日期'),
                        onChange: _cache[0] || (_cache[0] = $event => (emit('dirty')))
                      }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]))
                    : (__props.editable && !cell.locked)
                      ? (openBlock(), createBlock(_component_el_input, {
                          key: 1,
                          modelValue: __props.head[cell.key],
                          "onUpdate:modelValue": $event => ((__props.head[cell.key]) = $event),
                          size: "small",
                          class: "qr-cell-input",
                          maxlength: "200",
                          onInput: _cache[1] || (_cache[1] = $event => (emit('dirty')))
                        }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                      : (openBlock(), createElementBlock("span", _hoisted_6$4, toDisplayString(__props.head[cell.key] || ''), 1)),
                  (cell.key === '物料编码')
                    ? (openBlock(), createElementBlock("span", {
                        key: 3,
                        class: "qr-lib-btn no-print",
                        title: unref(tt)('按物料编码查看来料检验要求相关内容'),
                        onClick: openReqView
                      }, "⧉ " + toDisplayString(unref(tt)('检验要求')), 9, _hoisted_7$3))
                    : createCommentVNode("", true)
                ], 2)
              ], 64))
            }), 128))
          ]))
        }), 128))
      ])
    ]),
    createBaseVNode("div", _hoisted_8$3, [
      createTextVNode(toDisplayString(unref(tt)('检验结果')) + " ", 1),
      (__props.editable)
        ? (openBlock(), createElementBlock("span", {
            key: 0,
            class: "qr-lib-btn no-print qr-carry-btn",
            title: unref(tt)('按物料编码从来料检验要求带入检验项与检测标准（只补缺失项，已填的检测结果不动）'),
            onClick: _cache[2] || (_cache[2] = $event => (carryFromReq()))
          }, "⧉ " + toDisplayString(carrying.value ? unref(tt)('带入中…') : unref(tt)('带入检验要求')), 9, _hoisted_9$3))
        : createCommentVNode("", true)
    ]),
    createBaseVNode("table", _hoisted_10$3, [
      createBaseVNode("thead", null, [
        createBaseVNode("tr", null, [
          createBaseVNode("th", _hoisted_11$3, [
            createTextVNode(toDisplayString(unref(tt)('检验项')) + " ", 1),
            (__props.editable)
              ? (openBlock(), createElementBlock("span", {
                  key: 0,
                  class: "qr-lib-btn no-print",
                  title: unref(tt)('检验项来自数据库选择，可在此维护'),
                  onClick: openStdLib
                }, "⧉ " + toDisplayString(unref(tt)('标准库维护')), 9, _hoisted_12$3))
              : createCommentVNode("", true)
          ]),
          createBaseVNode("th", _hoisted_13$3, toDisplayString(unref(tt)('检测标准')), 1),
          createBaseVNode("th", _hoisted_14$3, toDisplayString(unref(tt)('检测结果')), 1),
          createBaseVNode("th", _hoisted_15$3, toDisplayString(unref(tt)('单项判定')), 1),
          (__props.editable)
            ? (openBlock(), createElementBlock("th", _hoisted_16$3))
            : createCommentVNode("", true)
        ])
      ]),
      createBaseVNode("tbody", null, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(items.value, (row, i) => {
          return (openBlock(), createElementBlock("tr", {
            key: row.id ?? ('new' + i)
          }, [
            createBaseVNode("td", _hoisted_17$3, [
              (__props.editable)
                ? (openBlock(), createBlock(_component_el_select, {
                    key: 0,
                    modelValue: row[unref(K).ITEM],
                    "onUpdate:modelValue": $event => ((row[unref(K).ITEM]) = $event),
                    size: "small",
                    filterable: "",
                    clearable: "",
                    "allow-create": "",
                    "default-first-option": "",
                    class: "qr-cell-input",
                    placeholder: unref(tt)('请选择'),
                    onChange: _cache[3] || (_cache[3] = $event => (emit('dirty')))
                  }, {
                    default: withCtx(() => [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(itemOptions.value, (o) => {
                        return (openBlock(), createBlock(_component_el_option, {
                          key: o.value,
                          label: o.label,
                          value: o.value
                        }, null, 8, ["label", "value"]))
                      }), 128))
                    ]),
                    _: 1
                  }, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]))
                : (openBlock(), createElementBlock("span", _hoisted_18$3, toDisplayString(row[unref(K).ITEM] || ''), 1))
            ]),
            createBaseVNode("td", _hoisted_19$3, [
              (__props.editable)
                ? (openBlock(), createBlock(_component_el_input, {
                    key: 0,
                    modelValue: row[unref(K).STD],
                    "onUpdate:modelValue": $event => ((row[unref(K).STD]) = $event),
                    size: "small",
                    class: "qr-cell-input",
                    maxlength: "500",
                    onInput: _cache[4] || (_cache[4] = $event => (emit('dirty')))
                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                : (openBlock(), createElementBlock("span", _hoisted_20$3, toDisplayString(row[unref(K).STD] || ''), 1))
            ]),
            createBaseVNode("td", _hoisted_21$3, [
              (__props.editable)
                ? (openBlock(), createBlock(_component_el_input, {
                    key: 0,
                    modelValue: row[unref(K).RESULT],
                    "onUpdate:modelValue": $event => ((row[unref(K).RESULT]) = $event),
                    type: "textarea",
                    autosize: { minRows: 1, maxRows: 5 },
                    size: "small",
                    class: "qr-cell-input",
                    maxlength: "500",
                    onInput: _cache[5] || (_cache[5] = $event => (emit('dirty')))
                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                : (openBlock(), createElementBlock("span", _hoisted_22$3, toDisplayString(row[unref(K).RESULT] || ''), 1))
            ]),
            createBaseVNode("td", _hoisted_23$3, [
              (__props.editable)
                ? (openBlock(), createBlock(_component_el_select, {
                    key: 0,
                    modelValue: row[unref(K).JUDGE],
                    "onUpdate:modelValue": $event => ((row[unref(K).JUDGE]) = $event),
                    size: "small",
                    clearable: "",
                    class: "qr-cell-input",
                    placeholder: unref(tt)('请选择'),
                    onChange: _cache[6] || (_cache[6] = $event => (emit('dirty')))
                  }, {
                    default: withCtx(() => [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(judgeOptions.value, (o) => {
                        return (openBlock(), createBlock(_component_el_option, {
                          key: o.value,
                          label: o.label,
                          value: o.value
                        }, null, 8, ["label", "value"]))
                      }), 128))
                    ]),
                    _: 1
                  }, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]))
                : (openBlock(), createElementBlock("span", _hoisted_24$3, toDisplayString(row[unref(K).JUDGE] || ''), 1))
            ]),
            (__props.editable)
              ? (openBlock(), createElementBlock("td", _hoisted_25$3, [
                  createBaseVNode("span", {
                    class: "qr-addrow",
                    title: unref(tt)('在该行后新增一行'),
                    onClick: $event => (insertAfter(i))
                  }, "＋", 8, _hoisted_26$3),
                  createBaseVNode("span", {
                    class: "qr-del",
                    title: unref(tt)('删除该行'),
                    onClick: $event => (removeItem(i))
                  }, "×", 8, _hoisted_27$3)
                ]))
              : createCommentVNode("", true)
          ]))
        }), 128)),
        (!items.value.length)
          ? (openBlock(), createElementBlock("tr", _hoisted_28$3, [
              createBaseVNode("td", {
                colspan: __props.editable ? 5 : 4,
                class: "qr-empty"
              }, toDisplayString(unref(tt)('暂无检验项，点击下方按钮新增')), 9, _hoisted_29$3)
            ]))
          : createCommentVNode("", true)
      ])
    ]),
    (__props.editable)
      ? (openBlock(), createElementBlock("div", _hoisted_30$3, [
          createBaseVNode("div", {
            class: "qr-add",
            onClick: addItem
          }, "＋ " + toDisplayString(unref(tt)('新增检验项')), 1)
        ]))
      : createCommentVNode("", true),
    createBaseVNode("table", _hoisted_31$3, [
      _cache[13] || (_cache[13] = createBaseVNode("colgroup", null, [
        createBaseVNode("col", { class: "fc-label" }),
        createBaseVNode("col", { class: "fc-v1" }),
        createBaseVNode("col", { class: "fc-label2" }),
        createBaseVNode("col", { class: "fc-v2" })
      ], -1)),
      createBaseVNode("tbody", null, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(unref(QC_INSP_REC_FOOT_FULL), (cell) => {
          return (openBlock(), createElementBlock("tr", {
            key: cell.key
          }, [
            createBaseVNode("th", _hoisted_32$3, toDisplayString(unref(tt)(cell.label)), 1),
            createBaseVNode("td", _hoisted_33$3, [
              (__props.editable)
                ? (openBlock(), createBlock(_component_el_input, {
                    key: 0,
                    modelValue: __props.head[cell.key],
                    "onUpdate:modelValue": $event => ((__props.head[cell.key]) = $event),
                    type: "textarea",
                    autosize: { minRows: 2, maxRows: 8 },
                    size: "small",
                    class: "qr-cell-input",
                    maxlength: "1000",
                    onInput: _cache[7] || (_cache[7] = $event => (emit('dirty')))
                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                : (openBlock(), createElementBlock("span", _hoisted_34$2, toDisplayString(__props.head[cell.key] || ''), 1))
            ])
          ]))
        }), 128)),
        createBaseVNode("tr", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(QC_INSP_REC_SIGN_ROW), (cell) => {
            return (openBlock(), createElementBlock(Fragment, {
              key: cell.key
            }, [
              createBaseVNode("th", _hoisted_35$2, toDisplayString(unref(tt)(cell.label)), 1),
              createBaseVNode("td", _hoisted_36$2, [
                (__props.editable && !cell.locked)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: __props.head[cell.key],
                      "onUpdate:modelValue": $event => ((__props.head[cell.key]) = $event),
                      size: "small",
                      class: "qr-cell-input",
                      maxlength: "50",
                      onInput: _cache[8] || (_cache[8] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_37$2, toDisplayString(signText(cell)), 1))
              ])
            ], 64))
          }), 128))
        ])
      ])
    ]),
    createVNode(_component_el_dialog, {
      modelValue: stdLibVisible.value,
      "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((stdLibVisible).value = $event)),
      title: unref(tt)('标准库维护') + ' · ' + unref(tt)('检验项'),
      width: "680px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[9] || (_cache[9] = $event => (stdLibVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createVNode(StdLibManager, {
          lib: unref(QC_INSP_ITEM_LIB),
          onChanged: onStdLibChanged
        }, null, 8, ["lib"])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(QcInspReqViewDialog, {
      modelValue: reqViewVisible.value,
      "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((reqViewVisible).value = $event)),
      "material-code": materialCode.value
    }, null, 8, ["modelValue", "material-code"])
  ]))
}
}

};
const QcInspRecSheet = /*#__PURE__*/_export_sfc(_sfc_main$4, [['__scopeId',"data-v-514d83a2"]]);

/**
 * panelAccess.js — 「当前账号能不能查看某个面板」的纯判定。
 *
 * 口径与导航/桌面入口**同一真源**(`business/menus.js` 的 filterMenuTree、
 * `core/dashboard/deskQuick.js`):admin 全量;其余账号看 `user.visiblePanels`
 * (后端 AuthController 按角色面板权限下发)。拿不到用户信息时**一律不放行** ——
 * 宁可提示无权限,也不要放进去吃一个 403 白屏。
 *
 * 用例:产品文件列表点某个文件的「状态」跳转到该文件面板之前的预检
 * (2026-09-30 用户口径:没有该面板查看权限时提示「无查看该面板的权限」)。
 */

/**
 * @param {{isAdmin?:boolean, visiblePanels?:string[]}|null|undefined} user
 * @param {string} panelCode
 * @returns {boolean}
 */
function canViewPanel(user, panelCode) {
  const code = String(panelCode ?? '').trim();
  if (!code) return false
  if (!user) return false
  if (user.isAdmin === true) return true
  const vis = Array.isArray(user.visiblePanels) ? user.visiblePanels : [];
  return vis.includes(code)
}

/* unplugin-vue-components disabled */

const _hoisted_1$3 = { class: "prod-doc-sheet" };
const _hoisted_2$3 = { class: "pds-topbar" };
const _hoisted_3$3 = { class: "pds-company" };
const _hoisted_4$3 = { class: "pds-docno" };
const _hoisted_5$3 = { class: "pds-title-row" };
const _hoisted_6$3 = { class: "pds-title" };
const _hoisted_7$2 = { class: "pds-info-table" };
const _hoisted_8$2 = { class: "pds-info-row" };
const _hoisted_9$2 = { class: "pds-info-label" };
const _hoisted_10$2 = { class: "pds-info-value" };
const _hoisted_11$2 = { class: "pds-info-row" };
const _hoisted_12$2 = { class: "pds-info-label" };
const _hoisted_13$2 = { class: "pds-info-value" };
const _hoisted_14$2 = { class: "pds-note" };
const _hoisted_15$2 = {
  key: 0,
  class: "pds-filter"
};
const _hoisted_16$2 = { class: "pds-filter-txt" };
const _hoisted_17$2 = { class: "pds-filter-count" };
const _hoisted_18$2 = { class: "pds-scroll" };
const _hoisted_19$2 = { class: "pds-table" };
const _hoisted_20$2 = { class: "pds-c-no" };
const _hoisted_21$2 = { class: "pds-c-file" };
const _hoisted_22$2 = { class: "pds-c-status" };
const _hoisted_23$2 = { class: "pds-c-owner" };
const _hoisted_24$2 = { class: "pds-c-ctrl" };
const _hoisted_25$2 = { class: "pds-c-date" };
const _hoisted_26$2 = { class: "pds-c-no" };
const _hoisted_27$2 = { class: "pds-c-file" };
const _hoisted_28$2 = ["title", "onClick"];
const _hoisted_29$2 = { class: "pds-c-owner" };
const _hoisted_30$2 = { class: "pds-c-ctrl" };
const _hoisted_31$2 = { class: "pds-c-date" };
const _hoisted_32$2 = { key: 0 };
const _hoisted_33$2 = {
  colspan: 12,
  class: "pds-empty"
};


const _sfc_main$3 = {
  __name: 'ProdDocListSheet',
  props: {
  head: { type: Object, default: () => ({}) },
  panelCode: { type: String, default: '' },
  // 侧栏搜索生效中的矩阵行筛选({conditions, valid});无则整表显示
  filter: { type: Object, default: null },
},
  emits: ['rows', 'clear-filter'],
  setup(__props, { emit: __emit }) {

const props = __props;
// rows:取到矩阵行后上报(侧栏的结果清单/预览卡片要用同一份数据;本组件自己不存搜索结果)
const emit = __emit;

const router = useRouter();
const user = useUserStore();

const columns = ref([]);
const rows = ref([]);

/** 生效中的筛选(横幅与"没有符合条件的产品"空态都看它) */
const activeFilter = computed(() => (props.filter && props.filter.valid ? props.filter : null));
const shownRows = computed(() => filterProdDocRows(rows.value, columns.value, activeFilter.value));
/** 横幅文案:字段 包含 "值" [+ …] */
const filterText = computed(() => (activeFilter.value?.conditions || [])
  .map((c) => `${tt(c.field)} ${tt('包含')} "${c.value}"`)
  .join('  '));

/**
 * 一行里某面板的状态。
 * 后端 board() 把 4 个面板的状态放在 row.cells[panelCode](键=面板编码)。
 * 兜底:缺该面板(历史 rd_dev_task 只指向已下线面板)时记「—」而不是空白。
 */
function statusOf(row, panelCode) {
  const c = row && row.cells ? row.cells[panelCode] : null;
  return c || '—'
}

/** 状态色调:沿用项目既有语义(开发完毕=绿 / 开发中·开发审核中=蓝 / 未开发=灰) */
function toneOf(st) {
  if (st === '开发完毕') return 'done'
  if (st === '开发审核中') return 'review'
  if (st === '开发中') return 'doing'
  return 'none'
}

/** 该产品在该文件面板的单据号(点状态跳转的目标;未开发时为空) */
function docNoOf(row, panelCode) {
  const m = row && row.docNos ? row.docNos : null;
  const v = m ? m[panelCode] : '';
  return v === undefined || v === null ? '' : String(v)
}

function canView(panelCode) {
  return canViewPanel({ isAdmin: user.isAdmin, visiblePanels: user.visiblePanels }, panelCode)
}

/** 状态格的悬停提示:说清点了会发生什么(含"没有查看权限"这一种) */
function jumpTitle(c, row) {
  if (!canView(c.panelCode)) return tt('无查看该面板的权限')
  const no = docNoOf(row, c.panelCode);
  return no ? `${tt('查看')}：${tt(c.panelName)} ${no}` : `${tt('打开')}：${tt(c.panelName)}`
}

/**
 * 点状态 → 跳该文件面板查看(带 ?focus=单据号 直接定位到那张单)。
 * 权限预检走 core/auth/panelAccess(与导航/桌面入口同一口径),不放行就提示,不跳。
 */
function onStatusClick(c, row) {
  if (!canView(c.panelCode)) {
    ElMessage.warning(`${tt('无查看该面板的权限')}：${tt(c.panelName)}`);
    return
  }
  const no = docNoOf(row, c.panelCode);
  router.push({ path: `/panelx/list/${c.panelCode}`, query: no ? { focus: no } : {} });
}

async function load() {
  try {
    const res = await request.get('/px/prodDocList');
    const data = (res && res.data) || {};
    columns.value = data.columns || [];
    rows.value = data.rows || [];
  } catch (e) {
    columns.value = [];
    rows.value = [];
  }
  emit('rows', rows.value, columns.value);
}

onMounted(load);
// 单据切换(单单据面板下通常只有一张)或面板编码变化时重取
watch(() => [props.panelCode, props.head && props.head['单据编号']], load);

return (_ctx, _cache) => {
  return (openBlock(), createElementBlock("div", _hoisted_1$3, [
    createBaseVNode("div", _hoisted_2$3, [
      createBaseVNode("div", _hoisted_3$3, toDisplayString(unref(tt)('惠州市银嘉环保科技有限公司')), 1),
      createBaseVNode("div", _hoisted_4$3, toDisplayString(__props.head && __props.head['单据编号'] ? __props.head['单据编号'] : ''), 1)
    ]),
    createBaseVNode("div", _hoisted_5$3, [
      createBaseVNode("div", _hoisted_6$3, toDisplayString(unref(tt)('产品文件列表')), 1),
      createBaseVNode("div", _hoisted_7$2, [
        createBaseVNode("div", _hoisted_8$2, [
          createBaseVNode("span", _hoisted_9$2, toDisplayString(unref(tt)('密级')), 1),
          createBaseVNode("span", _hoisted_10$2, toDisplayString((__props.head && __props.head['密级']) || ''), 1)
        ]),
        createBaseVNode("div", _hoisted_11$2, [
          createBaseVNode("span", _hoisted_12$2, toDisplayString(unref(tt)('文件使用范围')), 1),
          createBaseVNode("span", _hoisted_13$2, toDisplayString((__props.head && __props.head['文件使用范围']) || ''), 1)
        ])
      ])
    ]),
    createBaseVNode("div", _hoisted_14$2, toDisplayString(unref(tt)('可通过产品编号直接搜索；状态由各文件面板的单据实时推导（未开发 / 开发中 / 开发审核中 / 开发完毕）。')), 1),
    (activeFilter.value)
      ? (openBlock(), createElementBlock("div", _hoisted_15$2, [
          createBaseVNode("span", _hoisted_16$2, [
            createTextVNode(toDisplayString(unref(tt)('筛选中')) + "：" + toDisplayString(filterText.value) + " ", 1),
            createBaseVNode("span", _hoisted_17$2, toDisplayString(shownRows.value.length) + " / " + toDisplayString(rows.value.length), 1)
          ]),
          createBaseVNode("span", {
            class: "pds-filter-clear",
            onClick: _cache[0] || (_cache[0] = $event => (emit('clear-filter')))
          }, "✕ " + toDisplayString(unref(tt)('清除筛选')), 1)
        ]))
      : createCommentVNode("", true),
    createBaseVNode("div", _hoisted_18$2, [
      createBaseVNode("table", _hoisted_19$2, [
        createBaseVNode("thead", null, [
          createBaseVNode("tr", null, [
            createBaseVNode("th", _hoisted_20$2, toDisplayString(unref(tt)('产品编号')), 1),
            (openBlock(true), createElementBlock(Fragment, null, renderList(columns.value, (c, ci) => {
              return (openBlock(), createElementBlock(Fragment, {
                key: 'h' + c.panelCode
              }, [
                createBaseVNode("th", _hoisted_21$2, toDisplayString(unref(tt)('文件' + (ci + 1))), 1),
                createBaseVNode("th", _hoisted_22$2, toDisplayString(unref(tt)('状态')), 1)
              ], 64))
            }), 128)),
            createBaseVNode("th", _hoisted_23$2, toDisplayString(unref(tt)('产品负责人')), 1),
            createBaseVNode("th", _hoisted_24$2, toDisplayString(unref(tt)('是否受控')), 1),
            createBaseVNode("th", _hoisted_25$2, toDisplayString(unref(tt)('受控日期')), 1)
          ])
        ]),
        createBaseVNode("tbody", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(shownRows.value, (row, i) => {
            return (openBlock(), createElementBlock("tr", {
              key: row['产品编号'] || ('r' + i)
            }, [
              createBaseVNode("td", _hoisted_26$2, toDisplayString(row['产品编号'] || ''), 1),
              (openBlock(true), createElementBlock(Fragment, null, renderList(columns.value, (c) => {
                return (openBlock(), createElementBlock(Fragment, {
                  key: 'c' + c.panelCode + (row['产品编号'] || i)
                }, [
                  createBaseVNode("td", _hoisted_27$2, toDisplayString(unref(tt)(c.panelName)), 1),
                  createBaseVNode("td", {
                    class: "pds-c-status pds-c-jump",
                    title: jumpTitle(c, row),
                    onClick: $event => (onStatusClick(c, row))
                  }, [
                    createBaseVNode("span", {
                      class: normalizeClass(["pds-badge", toneOf(statusOf(row, c.panelCode))])
                    }, toDisplayString(unref(tt)(statusOf(row, c.panelCode))), 3)
                  ], 8, _hoisted_28$2)
                ], 64))
              }), 128)),
              createBaseVNode("td", _hoisted_29$2, toDisplayString(row['产品负责人'] || ''), 1),
              createBaseVNode("td", _hoisted_30$2, toDisplayString(unref(tt)(row['是否受控'] || '否')), 1),
              createBaseVNode("td", _hoisted_31$2, toDisplayString(row['受控日期'] || ''), 1)
            ]))
          }), 128)),
          (!shownRows.value.length)
            ? (openBlock(), createElementBlock("tr", _hoisted_32$2, [
                createBaseVNode("td", _hoisted_33$2, toDisplayString(activeFilter.value
                ? unref(tt)('没有符合筛选条件的产品（点上方「清除筛选」看全部）')
                : unref(tt)('暂无已下发的产品文件记录（先在产品信息表归档后点「产品开发」下发）')), 1)
              ]))
            : createCommentVNode("", true)
        ])
      ])
    ])
  ]))
}
}

};
const ProdDocListSheet = /*#__PURE__*/_export_sfc(_sfc_main$3, [['__scopeId',"data-v-05af430d"]]);

/**
 * 纸张面板「字段编辑」列偏好(纯函数,无 Vue 依赖)。
 * 用途:表头显示名(别名优先)、列显隐判定、以及"只发改动行"的保存载荷。
 * 口径:别名存在即显示别名,否则回退配置里的默认标签;visible 显式为 false 才算隐藏。
 */

/** 列显示名:别名(displayName)优先,缺省用默认标签 */
function resolveColumnLabel(field, fallback) {
  const alias = field && field.displayName ? String(field.displayName) : '';
  return alias || fallback || ''
}

/** 列是否隐藏:只有后端明确给出 visible=false 才隐藏 */
function isColumnHidden(field) {
  return !!field && field.visible === false
}

/**
 * 保存载荷:只发有改动的行(避免空别名批量覆盖已有别名 + seq 重排副作用)。
 * @param {{key:string, alias:string, originalAlias:string, visible:boolean, originalVisible:boolean}[]} rows
 * @returns {{label:string, alias:string, visible:boolean}[]}
 */
function buildColumnPrefsPayload(rows = []) {
  return (rows || [])
    .filter((row) => String(row.alias || '') !== String(row.originalAlias || '') || !!row.visible !== !!row.originalVisible)
    .map((row) => ({ label: row.key, alias: row.alias || '', visible: !!row.visible }))
}

/**
 * sampleCols.js — 数据记录表「功能性滤效」(RD_FILTER_EFF)的**动态样品列字段单一真源**。
 *
 * 面板按头字段「样品数」(2~6)把若干行**按样品**铺开:加一个样品列 ⇒ 这些字段各多一格;
 * 减一个样品列 ⇒ 这些字段的该列数据必须清空(用户口径:减列即清数据,确认弹窗后执行)。
 * 字段名 = 前缀 + 序号(`样品信息1` / `样品配方3` …),与 yj_field.label(数据键)同名。
 *
 * 【为什么必须集中管理】2026-09-30 用户报「样品配方列数应该跟样品信息同步」:
 *   样品配方 原是一个**单字段**(纸面一格跨全部样品列),而设计原表里它是**每样品一格**
 *   ——《数据记录表.xlsx》sheet 功能性滤效 第 10 行 merges `C10:G10` + `H10:L10`,
 *   与第 11 行 样品信息 `C11:G11` + `H11:L11` **同一分块**。
 *   病根是「哪些字段按样品铺开」散在组件里:漏登记一个前缀 ⇒ 加列时不分裂、减列时不清空,
 *   而且要等用户减列才暴露。这里集中成常量 + 纯函数,由 sampleCols.test.js 钉死。
 */

/** 按样品铺开的**头字段**前缀(每样品一格;字段名 = 前缀 + 1..样品数) */
const SAMPLE_HEAD_PREFIXES = ['样品信息', '测试装置及编号', '样品配方'];

/** 按样品铺开的**明细行**字段前缀(3.数据记录表里每组各样品一列) */
const SAMPLE_DETAIL_PREFIXES = [
  '压力（PSI)样品',
  '流速（L/min)样品',
  '出水含量（ug/L）样品',
  '去除率%样品',
];

/** 第 n 个样品的字段名(与 yj_field.label 同名) */
function sampleHeadKey(prefix, n) {
  return `${prefix}${n}`
}

/**
 * 清空第 n 个样品列的全部数据(头字段 + 每一行明细),返回被清空的键清单。
 * 其它样品列一格不动;head/明细缺失或序号非法时安静返回(减列是常态操作,不该抛错)。
 * @param {object} head 单据表头(含 detail.items)
 * @param {number} n 被减掉的样品序号(1..6)
 * @returns {string[]} 本次清空的键(重复的明细键只记一次)
 */
function clearSampleColumn(head, n) {
  const idx = Number(n);
  if (!head || !Number.isFinite(idx) || idx < 1) return []
  const cleared = [];
  for (const prefix of SAMPLE_HEAD_PREFIXES) {
    const k = sampleHeadKey(prefix, idx);
    head[k] = '';
    cleared.push(k);
  }
  for (const row of head?.detail?.items || []) {
    if (!row) continue
    for (const prefix of SAMPLE_DETAIL_PREFIXES) {
      const k = sampleHeadKey(prefix, idx);
      row[k] = '';
      cleared.push(k);
    }
  }
  return cleared
}

/* unplugin-vue-components disabled */

const _hoisted_1$2 = { class: "record-sheet" };
const _hoisted_2$2 = { class: "rs-t rs-head-t" };
const _hoisted_3$2 = { class: "rs-td rs-docno" };
const _hoisted_4$2 = ["title"];
const _hoisted_5$2 = { class: "rs-ref-text" };
const _hoisted_6$2 = {
  key: 2,
  class: "rs-docno-text"
};
const _hoisted_7$1 = {
  class: "rs-td rs-topic-cell",
  rowspan: "5"
};
const _hoisted_8$1 = {
  key: 1,
  class: "rs-topic"
};
const _hoisted_9$1 = { class: "rs-td rs-info-cell" };
const _hoisted_10$1 = { class: "rs-irow" };
const _hoisted_11$1 = { class: "rs-ilabel" };
const _hoisted_12$1 = { class: "rs-ivalue" };
const _hoisted_13$1 = { class: "rs-td rs-info-cell" };
const _hoisted_14$1 = { class: "rs-irow" };
const _hoisted_15$1 = { class: "rs-ilabel" };
const _hoisted_16$1 = { class: "rs-ivalue" };
const _hoisted_17$1 = { class: "rs-td rs-info-cell" };
const _hoisted_18$1 = { class: "rs-irow" };
const _hoisted_19$1 = { class: "rs-ilabel" };
const _hoisted_20$1 = { class: "rs-ivalue" };
const _hoisted_21$1 = { class: "rs-td rs-info-cell" };
const _hoisted_22$1 = { class: "rs-irow" };
const _hoisted_23$1 = { class: "rs-ilabel" };
const _hoisted_24$1 = { class: "rs-ivalue" };
const _hoisted_25$1 = { class: "rs-td rs-info-cell" };
const _hoisted_26$1 = { class: "rs-irow" };
const _hoisted_27$1 = { class: "rs-ilabel" };
const _hoisted_28$1 = { class: "rs-ivalue" };
const _hoisted_29$1 = {
  key: 0,
  class: "rs-sample-ctl"
};
const _hoisted_30$1 = { class: "rs-sample-label" };
const _hoisted_31$1 = ["title"];
const _hoisted_32$1 = { class: "rs-sample-num" };
const _hoisted_33$1 = ["title"];
const _hoisted_34$1 = { class: "rs-t" };
const _hoisted_35$1 = ["colspan"];
const _hoisted_36$1 = { class: "rs-td rs-label" };
const _hoisted_37$1 = ["colspan"];
const _hoisted_38$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_39$1 = { class: "rs-td rs-label" };
const _hoisted_40$1 = ["colspan"];
const _hoisted_41$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_42$1 = { class: "rs-row-mid" };
const _hoisted_43$1 = { class: "rs-td rs-label" };
const _hoisted_44$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_45$1 = { class: "rs-td rs-label" };
const _hoisted_46$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_47$1 = { class: "rs-td rs-label" };
const _hoisted_48$1 = ["colspan"];
const _hoisted_49$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_50$1 = { class: "rs-td rs-label" };
const _hoisted_51$1 = ["colspan"];
const _hoisted_52$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_53$1 = { class: "rs-td rs-label" };
const _hoisted_54$1 = ["colspan"];
const _hoisted_55$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_56$1 = { class: "rs-td rs-label" };
const _hoisted_57$1 = ["colspan"];
const _hoisted_58$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_59$1 = { class: "rs-t" };
const _hoisted_60$1 = ["colspan"];
const _hoisted_61$1 = { class: "rs-td rs-label" };
const _hoisted_62$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_63$1 = { class: "rs-td rs-label" };
const _hoisted_64$1 = ["colspan"];
const _hoisted_65$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_66$1 = { class: "rs-td rs-label" };
const _hoisted_67$1 = ["colspan"];
const _hoisted_68$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_69$1 = { class: "rs-td rs-label" };
const _hoisted_70$1 = ["colspan"];
const _hoisted_71$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_72$1 = {
  class: "rs-td rs-label rs-water-label",
  rowspan: "2"
};
const _hoisted_73$1 = ["colspan"];
const _hoisted_74$1 = { class: "rs-inner" };
const _hoisted_75$1 = { class: "rs-ind-name" };
const _hoisted_76$1 = { class: "rs-ind-name" };
const _hoisted_77$1 = { class: "rs-ind-name" };
const _hoisted_78$1 = { class: "rs-ind-name" };
const _hoisted_79$1 = { class: "rs-ind-name" };
const _hoisted_80$1 = { class: "rs-ind-name narrow" };
const _hoisted_81$1 = { class: "rs-ind-name" };
const _hoisted_82$1 = { class: "rs-ind-name" };
const _hoisted_83$1 = { class: "rs-water-val" };
const _hoisted_84$1 = { class: "rs-water-val" };
const _hoisted_85$1 = { class: "rs-water-val" };
const _hoisted_86$1 = { class: "rs-water-val" };
const _hoisted_87$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_88$1 = { class: "rs-water-val" };
const _hoisted_89$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_90$1 = { class: "rs-water-val" };
const _hoisted_91$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_92$1 = { class: "rs-water-val" };
const _hoisted_93$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_94$1 = { class: "rs-water-val" };
const _hoisted_95$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_96$1 = { class: "rs-t rs-dt" };
const _hoisted_97$1 = {
  key: 0,
  style: {"width":"130px"}
};
const _hoisted_98$1 = {
  key: 1,
  style: {"width":"96px"}
};
const _hoisted_99$1 = {
  key: 2,
  style: {"width":"80px"}
};
const _hoisted_100$1 = {
  key: 3,
  style: {"width":"96px"}
};
const _hoisted_101$1 = {
  key: 4,
  style: {"width":"110px"}
};
const _hoisted_102$1 = {
  key: 5,
  style: {"width":"60px"}
};
const _hoisted_103$1 = ["colspan"];
const _hoisted_104$1 = ["title"];
const _hoisted_105$1 = { class: "rs-grp" };
const _hoisted_106$1 = {
  key: 0,
  class: "rs-th",
  rowspan: "2"
};
const _hoisted_107$1 = {
  key: 1,
  class: "rs-th",
  rowspan: "2"
};
const _hoisted_108$1 = {
  key: 2,
  class: "rs-th",
  rowspan: "2"
};
const _hoisted_109$1 = ["colspan"];
const _hoisted_110$1 = {
  key: 4,
  class: "rs-th",
  rowspan: "2"
};
const _hoisted_111$1 = ["colspan"];
const _hoisted_112$1 = ["colspan"];
const _hoisted_113$1 = {
  key: 7,
  class: "rs-th",
  rowspan: "2"
};
const _hoisted_114$1 = {
  key: 8,
  class: "rs-th rs-th-op",
  rowspan: "2"
};
const _hoisted_115$1 = { class: "rs-grp2" };
const _hoisted_116$1 = {
  key: 0,
  class: "rs-th"
};
const _hoisted_117$1 = {
  key: 0,
  class: "rs-th"
};
const _hoisted_118$1 = {
  key: 0,
  class: "rs-th"
};
const _hoisted_119$1 = {
  key: 0,
  class: "rs-td"
};
const _hoisted_120$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_121$1 = {
  key: 1,
  class: "rs-td"
};
const _hoisted_122$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_123$1 = {
  key: 2,
  class: "rs-td"
};
const _hoisted_124$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_125$1 = {
  key: 0,
  class: "rs-td"
};
const _hoisted_126$1 = { class: "rs-combo" };
const _hoisted_127$1 = {
  key: 2,
  class: "rs-txt"
};
const _hoisted_128$1 = {
  key: 3,
  class: "rs-td"
};
const _hoisted_129$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_130$1 = {
  key: 0,
  class: "rs-td"
};
const _hoisted_131$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_132$1 = {
  key: 0,
  class: "rs-td"
};
const _hoisted_133$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_134$1 = {
  key: 4,
  class: "rs-td"
};
const _hoisted_135$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_136$1 = {
  key: 5,
  class: "rs-td rs-td-op"
};
const _hoisted_137$1 = ["onClick"];
const _hoisted_138$1 = ["onClick"];
const _hoisted_139$1 = { key: 0 };
const _hoisted_140$1 = ["colspan"];
const _hoisted_141$1 = { class: "rs-t" };
const _hoisted_142$1 = {
  colspan: "3",
  class: "rs-sectionbar"
};
const _hoisted_143$1 = {
  class: "rs-td rs-conclusion",
  colspan: "3"
};
const _hoisted_144$1 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_145$1 = { class: "fe-list" };
const _hoisted_146$1 = ["title"];
const _hoisted_147$1 = { class: "fe-label" };
const _hoisted_148$1 = { style: {"margin-top":"8px","color":"#909399","font-size":"12px"} };

const MIN_SAMPLES = 2;
const MAX_SAMPLES = 6;

const _sfc_main$2 = {
  __name: 'DataRecordSheet',
  props: {
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
},
  emits: ['dirty'],
  setup(__props, { expose: __expose, emit: __emit }) {

const props = __props;
const emit = __emit;

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])));
function selectOptions(key) {
  const f = fieldMap.value.get(key);
  const opts = f?.options || [];
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// ── 参照字段(文档编号 → 立项申请右上角编号):点击单元格弹参照,确认后按 refMap 带回(密级等) ──
function isRefKey(key) {
  const f = fieldMap.value.get(key);
  return !!(f && f.refPanel)
}
const prodRefVisible = ref(false);
const prodRefKey = ref('');
const prodRefField = computed(() => fieldMap.value.get(prodRefKey.value) || null);
function openProdRef(key) {
  if (!props.editable || !isRefKey(key)) return
  prodRefKey.value = key;
  prodRefVisible.value = true;
}
function onProdRefConfirm(rows) {
  const f = prodRefField.value;
  const source = rows?.[0];
  if (!f || !source) return
  const refField = f.refField || f.dataName;
  props.head[prodRefKey.value] = source[refField] ?? '';
  for (const m of f.refMap || []) {
    if (m && source[m.from] !== undefined) props.head[m.to || m.from] = source[m.from];
  }
  prodRefVisible.value = false;
  emit('dirty');
}

// ── 3.数据记录表:列名(别名)与显隐可配置,与其余 7 张同一接口(字段编辑) ──
// 分组表头(取样前样品/出水含量/去除率)各管"样品数"列;隐藏一列时分组标题 colspan 自动收缩,全隐藏则整组不渲染。
// ── 动态样品列(2026-09-11):默认 2 列,2~6 列可调 ──
// 计数存头字段「样品数」(物理列 预置到 样品6,见 tools/migrate-filter-eff-samples.sql);
// 加列即时生效;减列**清空被减列数据**(用户口径,确认弹窗);总表宽恒定——样品组总宽不变,列宽=组总宽÷列数。
// 1.基本信息 里**按样品铺开**的行 = 样品信息 / 测试装置及编号 / 样品配方(三者列数恒等于 样品数;
// 样品配方 2026-09-30 由"一格跨全部样品"改为每样品一格,与设计原表 C10:G10+H10:L10 分块一致)。
// ⚠ 字段名单别在组件里手写:见 core/sheet/sampleCols.js(加/减列都按它走)
const sampleCount = computed(() => {
  const n = parseInt(props.head?.['样品数'], 10);
  return Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Number.isFinite(n) ? n : MIN_SAMPLES))
});
async function setSampleCount(n) {
  if (!props.editable) return
  const cur = sampleCount.value;
  if (n === cur) return
  if (n < MIN_SAMPLES) return ElMessage.warning(tt('已是最少列数'))
  if (n > MAX_SAMPLES) return ElMessage.warning(tt('已是最大列数'))
  if (n < cur) {
    try {
      await ElMessageBox.confirm(tt('减少样品列将清空该列已填数据，确定减少吗？'), tt('减少样品列'),
        { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') });
    } catch { return /* 取消 */ }
    // 清空被减列:头字段(样品信息/测试装置及编号/样品配方)+ 每行明细(压力/流速/出水含量/去除率)
    // —— 字段名单在 core/sheet/sampleCols.js(单一真源,单测钉住;别再往这里手写清单)
    clearSampleColumn(props.head, cur);
  }
  props.head['样品数'] = String(n);
  emit('dirty');
}
/** 样品组列宽:组总宽÷当前列数(总宽恒定,维持表格整齐;下限防过窄) */
const pressColW = computed(() => Math.max(34, Math.floor(220 / sampleCount.value)));
const outColW = computed(() => Math.max(30, Math.floor(192 / sampleCount.value)));
/** 某样品组的物理列键(1..样品数) */
function sampleKeys(prefix) {
  return Array.from({ length: sampleCount.value }, (_, i) => `${prefix}${i + 1}`)
}
const DT_GROUPS = {
  压力: { label: '取样前样品：压力（PSI)/流速（L/min）', prefix: '压力（PSI)样品' },
  出水: { label: '出水含量（ug/L）', prefix: '出水含量（ug/L）样品' },
  去除率: { label: '去除率%', prefix: '去除率%样品' },
};
/** 数据记录表全部物理列(键=数据键,label=纸面默认表头;样品列到 6,字段编辑可管全部) */
const DT_COLUMNS = (() => {
  const cols = [
    { key: '冲水时间', label: '冲水时间' },
    { key: '累计进水（L）', label: '累计进水（L）' },
    { key: '水温（℃）', label: '水温（℃）' },
  ];
  for (let n = 1; n <= MAX_SAMPLES; n++) cols.push({ key: `压力（PSI)样品${n}`, label: `样品${n}（压力/流速）` });
  cols.push({ key: '原水含量（ug/L）5号缸', label: '原水含量（ug/L）' });
  for (let n = 1; n <= MAX_SAMPLES; n++) cols.push({ key: `出水含量（ug/L）样品${n}`, label: `样品${n}` });
  for (let n = 1; n <= MAX_SAMPLES; n++) cols.push({ key: `去除率%样品${n}`, label: `样品${n}` });
  cols.push({ key: '测试时间', label: '测试时间' });
  return cols
})();
/** 当前渲染的列键序(固定列 + 各样品组 1..样品数 中未隐藏者) */
const dtRenderedKeys = computed(() => {
  const keys = [];
  for (const k of ['冲水时间', '累计进水（L）', '水温（℃）']) if (!dtHidden(k)) keys.push(k);
  for (const k of sampleKeys(DT_GROUPS.压力.prefix)) if (!dtHidden(k)) keys.push(k);
  if (!dtHidden('原水含量（ug/L）5号缸')) keys.push('原水含量（ug/L）5号缸');
  for (const k of sampleKeys(DT_GROUPS.出水.prefix)) if (!dtHidden(k)) keys.push(k);
  for (const k of sampleKeys(DT_GROUPS.去除率.prefix)) if (!dtHidden(k)) keys.push(k);
  if (!dtHidden('测试时间')) keys.push('测试时间');
  return keys
});
function dtFieldOf(key) {
  return fieldMap.value.get(key)
}
function dtHidden(key) {
  return isColumnHidden(dtFieldOf(key))
}
function dtLabel(key, fallback) {
  return resolveColumnLabel(dtFieldOf(key), fallback || key)
}
function dtGroupSpan(name) {
  return sampleKeys(DT_GROUPS[name]?.prefix || '').filter((k) => !dtHidden(k)).length
}
function dtGroupLabel(name) {
  const g = DT_GROUPS[name];
  return g ? tt(g.label) : ''
}
const dtColSpan = computed(() => dtRenderedKeys.value.length + (props.editable ? 1 : 0));

/** 字段编辑弹窗:改列别名/显隐(存 yj_field.alias/visible,全用户共享) */
const fieldEditVisible = ref(false);
const fieldEditRows = ref([]);
function openFieldEdit() {
  fieldEditRows.value = DT_COLUMNS.map((col) => {
    const f = dtFieldOf(col.key);
    const alias = f && f.displayName && f.displayName !== f.dataName ? String(f.displayName) : '';
    const visible = !dtHidden(col.key);
    return { key: col.key, label: col.label, alias, originalAlias: alias, visible, originalVisible: visible }
  });
  fieldEditVisible.value = true;
}
async function saveFieldEdit() {
  const changed = buildColumnPrefsPayload(fieldEditRows.value);
  if (!changed.length) {
    fieldEditVisible.value = false;
    return
  }
  try {
    // 该组件只服务功能性滤效面板;接口与其余 7 张数据记录表一致
    const res = await request.post('/px/saveColumnPrefs', { panelCode: 'RD_FILTER_EFF', columns: changed });
    if (res && res.code && res.code !== 200) {
      ElMessage.error(res.message || tt('保存失败'));
      return
    }
    ElMessage.success(tt('字段编辑已保存'));
    fieldEditVisible.value = false;
    emit('refresh-config');
  } catch (e) {
    ElMessage.error(tt('保存失败'));
  }
}

// ── 校验定位(供 PanelxList 保存校验调用):滚动到该字段并琥珀闪烁 ──
function focusField(label) {
  if (!label) return false
  nextTick(() => {
    const root = document.querySelector('.drc-sheet') || document.querySelector('.record-sheet');
    if (!root) return
    const el = [...root.querySelectorAll('td.rs-label, .rs-topic-cell, th')]
      .find((e) => (e.textContent || '').trim() === label)
      || [...root.querySelectorAll('td.rs-label, .rs-topic-cell, th')]
        .find((e) => (e.textContent || '').includes(label));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('field-blink');
      setTimeout(() => el.classList.remove('field-blink'), 3200);
    }
  });
  return true
}
__expose({ focusField });

/** 取样前组合显示:流速 / 压力(复刻 Excel "1.93/61.1") */
function combo(row, pKey, fKey) {
  const p = row[pKey] || '';
  const f = row[fKey] || '';
  if (!p && !f) return ' / '
  return `${f}/${p}`
}

const items = computed(() => {
  const d = props.head?.detail;
  return d && Array.isArray(d.items) ? d.items : []
});
function touch() {
  const d = props.head.detail || (props.head.detail = {});
  if (!Array.isArray(d.items)) d.items = [];
  return d.items
}
function addRow(i) {
  const arr = touch();
  if (i >= 0) arr.splice(i + 1, 0, {});
  else arr.push({});
  emit('dirty');
}
function removeRow(i) {
  const d = props.head.detail;
  if (d && Array.isArray(d.items)) d.items.splice(i, 1);
  emit('dirty');
}

return (_ctx, _cache) => {
  const _component_el_icon = ElIcon;
  const _component_el_input = ElInput;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_checkbox = ElCheckbox;
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createElementBlock("div", _hoisted_1$2, [
    createBaseVNode("table", _hoisted_2$2, [
      _cache[70] || (_cache[70] = createBaseVNode("colgroup", null, [
        createBaseVNode("col", { style: {"width":"78.46%"} }),
        createBaseVNode("col", { style: {"width":"21.54%"} })
      ], -1)),
      createBaseVNode("tbody", null, [
        createBaseVNode("tr", null, [
          _cache[69] || (_cache[69] = createBaseVNode("td", { class: "rs-td rs-company-cell" }, "惠州市银嘉环保科技有限公司", -1)),
          createBaseVNode("td", _hoisted_3$2, [
            (__props.editable && isRefKey('文档编号'))
              ? (openBlock(), createElementBlock("div", {
                  key: 0,
                  class: "rs-ref-ctl",
                  title: unref(tt)('点击选择'),
                  onClick: _cache[0] || (_cache[0] = $event => (openProdRef('文档编号')))
                }, [
                  createBaseVNode("span", _hoisted_5$2, toDisplayString(__props.head['文档编号'] || unref(tt)('点击选择')), 1),
                  createVNode(_component_el_icon, { class: "rs-ref-ico" }, {
                    default: withCtx(() => [
                      createVNode(unref(search_default))
                    ]),
                    _: 1
                  })
                ], 8, _hoisted_4$2))
              : (__props.editable)
                ? (openBlock(), createBlock(_component_el_input, {
                    key: 1,
                    modelValue: __props.head['文档编号'],
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((__props.head['文档编号']) = $event)),
                    size: "small",
                    maxlength: "30",
                    class: "rs-docno-input",
                    onInput: _cache[2] || (_cache[2] = $event => (emit('dirty')))
                  }, null, 8, ["modelValue"]))
                : (openBlock(), createElementBlock("span", _hoisted_6$2, toDisplayString(__props.head['文档编号'] || __props.head['单据编号'] || 'YJ-PD-01'), 1))
          ])
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_7$1, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['测试主题'],
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((__props.head['测试主题']) = $event)),
                  size: "small",
                  class: "rs-topic-input",
                  onInput: _cache[4] || (_cache[4] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_8$1, toDisplayString(__props.head['测试主题'] || ''), 1))
          ]),
          createBaseVNode("td", _hoisted_9$1, [
            createBaseVNode("div", _hoisted_10$1, [
              createBaseVNode("span", _hoisted_11$1, toDisplayString(unref(tt)('密级')), 1),
              createBaseVNode("span", _hoisted_12$1, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_select, {
                      key: 0,
                      modelValue: __props.head['密级'],
                      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((__props.head['密级']) = $event)),
                      size: "small",
                      clearable: false,
                      onChange: _cache[6] || (_cache[6] = $event => (emit('dirty')))
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions('密级'), (o) => {
                          return (openBlock(), createBlock(_component_el_option, {
                            key: o.value,
                            label: o.label,
                            value: o.value
                          }, null, 8, ["label", "value"]))
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue"]))
                  : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                      createTextVNode(toDisplayString(__props.head['密级'] || ''), 1)
                    ], 64))
              ])
            ])
          ])
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_13$1, [
            createBaseVNode("div", _hoisted_14$1, [
              createBaseVNode("span", _hoisted_15$1, toDisplayString(unref(tt)('适用范围')), 1),
              createBaseVNode("span", _hoisted_16$1, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_select, {
                      key: 0,
                      modelValue: __props.head['适用范围'],
                      "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((__props.head['适用范围']) = $event)),
                      size: "small",
                      clearable: false,
                      onChange: _cache[8] || (_cache[8] = $event => (emit('dirty')))
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions('适用范围'), (o) => {
                          return (openBlock(), createBlock(_component_el_option, {
                            key: o.value,
                            label: o.label,
                            value: o.value
                          }, null, 8, ["label", "value"]))
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue"]))
                  : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                      createTextVNode(toDisplayString(__props.head['适用范围'] || ''), 1)
                    ], 64))
              ])
            ])
          ])
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_17$1, [
            createBaseVNode("div", _hoisted_18$1, [
              createBaseVNode("span", _hoisted_19$1, toDisplayString(unref(tt)('测试负责人')), 1),
              createBaseVNode("span", _hoisted_20$1, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: __props.head['测试负责人'],
                      "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((__props.head['测试负责人']) = $event)),
                      size: "small",
                      maxlength: "80",
                      class: "rs-c-in",
                      onInput: _cache[10] || (_cache[10] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue"]))
                  : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                      createTextVNode(toDisplayString(__props.head['测试负责人'] || ''), 1)
                    ], 64))
              ])
            ])
          ])
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_21$1, [
            createBaseVNode("div", _hoisted_22$1, [
              createBaseVNode("span", _hoisted_23$1, toDisplayString(unref(tt)('测试编号')), 1),
              createBaseVNode("span", _hoisted_24$1, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: __props.head['测试编号'],
                      "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((__props.head['测试编号']) = $event)),
                      size: "small",
                      maxlength: "80",
                      class: "rs-c-in",
                      onInput: _cache[12] || (_cache[12] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue"]))
                  : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                      createTextVNode(toDisplayString(__props.head['测试编号'] || ''), 1)
                    ], 64))
              ])
            ])
          ])
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_25$1, [
            createBaseVNode("div", _hoisted_26$1, [
              createBaseVNode("span", _hoisted_27$1, toDisplayString(unref(tt)('审核人')), 1),
              createBaseVNode("span", _hoisted_28$1, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: __props.head['表单审核人'],
                      "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((__props.head['表单审核人']) = $event)),
                      size: "small",
                      maxlength: "80",
                      class: "rs-c-in",
                      onInput: _cache[14] || (_cache[14] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue"]))
                  : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                      createTextVNode(toDisplayString(__props.head['表单审核人'] || ''), 1)
                    ], 64))
              ])
            ])
          ])
        ])
      ])
    ]),
    (__props.editable)
      ? (openBlock(), createElementBlock("div", _hoisted_29$1, [
          createBaseVNode("span", _hoisted_30$1, toDisplayString(unref(tt)('样品列')), 1),
          createBaseVNode("span", {
            class: normalizeClass(["rs-sample-btn", { dim: sampleCount.value <= MIN_SAMPLES }]),
            title: unref(tt)('减少样品列(清空该列数据)'),
            onClick: _cache[15] || (_cache[15] = $event => (setSampleCount(sampleCount.value - 1)))
          }, "－", 10, _hoisted_31$1),
          createBaseVNode("span", _hoisted_32$1, toDisplayString(sampleCount.value), 1),
          createBaseVNode("span", {
            class: normalizeClass(["rs-sample-btn", { dim: sampleCount.value >= MAX_SAMPLES }]),
            title: unref(tt)('增加样品列'),
            onClick: _cache[16] || (_cache[16] = $event => (setSampleCount(sampleCount.value + 1)))
          }, "＋", 10, _hoisted_33$1)
        ]))
      : createCommentVNode("", true),
    createBaseVNode("table", _hoisted_34$1, [
      createBaseVNode("colgroup", null, [
        _cache[71] || (_cache[71] = createBaseVNode("col", { style: {"width":"170px"} }, null, -1)),
        (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
          return (openBlock(), createElementBlock("col", {
            key: 'bc' + n,
            style: {"width":"auto"}
          }))
        }), 128))
      ]),
      createBaseVNode("tbody", null, [
        createBaseVNode("tr", null, [
          createBaseVNode("td", {
            colspan: sampleCount.value + 1,
            class: "rs-sectionbar"
          }, toDisplayString(unref(tt)('1.基本信息')), 9, _hoisted_35$1)
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_36$1, toDisplayString(unref(tt)('测试目的/背景')), 1),
          createBaseVNode("td", {
            class: "rs-td",
            colspan: sampleCount.value
          }, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['测试目的/背景'],
                  "onUpdate:modelValue": _cache[17] || (_cache[17] = $event => ((__props.head['测试目的/背景']) = $event)),
                  type: "textarea",
                  autosize: { minRows: 1, maxRows: 6 },
                  size: "small",
                  class: "rs-t-in",
                  onInput: _cache[18] || (_cache[18] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_38$1, toDisplayString(__props.head['测试目的/背景'] || ''), 1))
          ], 8, _hoisted_37$1)
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_39$1, toDisplayString(unref(tt)('规格')), 1),
          createBaseVNode("td", {
            class: "rs-td",
            colspan: sampleCount.value
          }, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['规格'],
                  "onUpdate:modelValue": _cache[19] || (_cache[19] = $event => ((__props.head['规格']) = $event)),
                  size: "small",
                  maxlength: "200",
                  class: "rs-t-in",
                  onInput: _cache[20] || (_cache[20] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_41$1, toDisplayString(__props.head['规格'] || ''), 1))
          ], 8, _hoisted_40$1)
        ]),
        createBaseVNode("tr", _hoisted_42$1, [
          createBaseVNode("td", _hoisted_43$1, toDisplayString(unref(tt)('样品配方')), 1),
          (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
            return (openBlock(), createElementBlock("td", {
              key: 'sf' + n,
              class: "rs-td"
            }, [
              (__props.editable)
                ? (openBlock(), createBlock(_component_el_input, {
                    key: 0,
                    modelValue: __props.head['样品配方' + n],
                    "onUpdate:modelValue": $event => ((__props.head['样品配方' + n]) = $event),
                    type: "textarea",
                    autosize: { minRows: 3, maxRows: 12 },
                    size: "small",
                    maxlength: "300",
                    class: "rs-t-in",
                    onInput: _cache[21] || (_cache[21] = $event => (emit('dirty')))
                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                : (openBlock(), createElementBlock("span", _hoisted_44$1, toDisplayString(__props.head['样品配方' + n] || ''), 1))
            ]))
          }), 128))
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_45$1, toDisplayString(unref(tt)('样品信息')), 1),
          (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
            return (openBlock(), createElementBlock("td", {
              key: 'si' + n,
              class: "rs-td"
            }, [
              (__props.editable)
                ? (openBlock(), createBlock(_component_el_input, {
                    key: 0,
                    modelValue: __props.head['样品信息' + n],
                    "onUpdate:modelValue": $event => ((__props.head['样品信息' + n]) = $event),
                    type: "textarea",
                    autosize: { minRows: 3, maxRows: 12 },
                    size: "small",
                    class: "rs-t-in",
                    onInput: _cache[22] || (_cache[22] = $event => (emit('dirty')))
                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                : (openBlock(), createElementBlock("span", _hoisted_46$1, toDisplayString(__props.head['样品信息' + n] || ''), 1))
            ]))
          }), 128))
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_47$1, toDisplayString(unref(tt)('测试要求')), 1),
          createBaseVNode("td", {
            class: "rs-td",
            colspan: sampleCount.value
          }, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['测试要求'],
                  "onUpdate:modelValue": _cache[23] || (_cache[23] = $event => ((__props.head['测试要求']) = $event)),
                  type: "textarea",
                  autosize: { minRows: 1, maxRows: 6 },
                  size: "small",
                  class: "rs-t-in",
                  onInput: _cache[24] || (_cache[24] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_49$1, toDisplayString(__props.head['测试要求'] || ''), 1))
          ], 8, _hoisted_48$1)
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_50$1, toDisplayString(unref(tt)('测试标准')), 1),
          createBaseVNode("td", {
            class: "rs-td",
            colspan: sampleCount.value
          }, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['测试标准'],
                  "onUpdate:modelValue": _cache[25] || (_cache[25] = $event => ((__props.head['测试标准']) = $event)),
                  size: "small",
                  maxlength: "300",
                  class: "rs-t-in",
                  onInput: _cache[26] || (_cache[26] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_52$1, toDisplayString(__props.head['测试标准'] || ''), 1))
          ], 8, _hoisted_51$1)
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_53$1, toDisplayString(unref(tt)('测试时间')), 1),
          createBaseVNode("td", {
            class: "rs-td",
            colspan: sampleCount.value
          }, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['测试时间'],
                  "onUpdate:modelValue": _cache[27] || (_cache[27] = $event => ((__props.head['测试时间']) = $event)),
                  size: "small",
                  maxlength: "200",
                  class: "rs-t-in",
                  onInput: _cache[28] || (_cache[28] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_55$1, toDisplayString(__props.head['测试时间'] || ''), 1))
          ], 8, _hoisted_54$1)
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_56$1, toDisplayString(unref(tt)('本次实验目的')), 1),
          createBaseVNode("td", {
            class: "rs-td",
            colspan: sampleCount.value
          }, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['本次实验目的'],
                  "onUpdate:modelValue": _cache[29] || (_cache[29] = $event => ((__props.head['本次实验目的']) = $event)),
                  type: "textarea",
                  autosize: { minRows: 1, maxRows: 6 },
                  size: "small",
                  class: "rs-t-in",
                  onInput: _cache[30] || (_cache[30] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_58$1, toDisplayString(__props.head['本次实验目的'] || ''), 1))
          ], 8, _hoisted_57$1)
        ])
      ])
    ]),
    createBaseVNode("table", _hoisted_59$1, [
      createBaseVNode("colgroup", null, [
        _cache[72] || (_cache[72] = createBaseVNode("col", { style: {"width":"170px"} }, null, -1)),
        (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
          return (openBlock(), createElementBlock("col", {
            key: 'cc' + n,
            style: {"width":"auto"}
          }))
        }), 128))
      ]),
      createBaseVNode("tbody", null, [
        createBaseVNode("tr", null, [
          createBaseVNode("td", {
            colspan: sampleCount.value + 1,
            class: "rs-sectionbar"
          }, toDisplayString(unref(tt)('2.测试条件')), 9, _hoisted_60$1)
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_61$1, toDisplayString(unref(tt)('测试装置及编号')), 1),
          (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
            return (openBlock(), createElementBlock("td", {
              key: 'td' + n,
              class: "rs-td"
            }, [
              (__props.editable)
                ? (openBlock(), createBlock(_component_el_input, {
                    key: 0,
                    modelValue: __props.head['测试装置及编号' + n],
                    "onUpdate:modelValue": $event => ((__props.head['测试装置及编号' + n]) = $event),
                    size: "small",
                    maxlength: "200",
                    class: "rs-t-in",
                    onInput: _cache[31] || (_cache[31] = $event => (emit('dirty')))
                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                : (openBlock(), createElementBlock("span", _hoisted_62$1, toDisplayString(__props.head['测试装置及编号' + n] || ''), 1))
            ]))
          }), 128))
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_63$1, toDisplayString(unref(tt)('加标方式')), 1),
          createBaseVNode("td", {
            class: "rs-td",
            colspan: sampleCount.value
          }, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['加标方式'],
                  "onUpdate:modelValue": _cache[32] || (_cache[32] = $event => ((__props.head['加标方式']) = $event)),
                  type: "textarea",
                  autosize: { minRows: 1, maxRows: 6 },
                  size: "small",
                  class: "rs-t-in",
                  onInput: _cache[33] || (_cache[33] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_65$1, toDisplayString(__props.head['加标方式'] || ''), 1))
          ], 8, _hoisted_64$1)
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_66$1, toDisplayString(unref(tt)('冲水方式')), 1),
          createBaseVNode("td", {
            class: "rs-td",
            colspan: sampleCount.value
          }, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['冲水方式'],
                  "onUpdate:modelValue": _cache[34] || (_cache[34] = $event => ((__props.head['冲水方式']) = $event)),
                  type: "textarea",
                  autosize: { minRows: 3, maxRows: 12 },
                  size: "small",
                  class: "rs-t-in",
                  onInput: _cache[35] || (_cache[35] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_68$1, toDisplayString(__props.head['冲水方式'] || ''), 1))
          ], 8, _hoisted_67$1)
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_69$1, toDisplayString(unref(tt)('测试用仪器/检出限')), 1),
          createBaseVNode("td", {
            class: "rs-td",
            colspan: sampleCount.value
          }, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['测试用仪器/检出限'],
                  "onUpdate:modelValue": _cache[36] || (_cache[36] = $event => ((__props.head['测试用仪器/检出限']) = $event)),
                  size: "small",
                  maxlength: "500",
                  class: "rs-t-in",
                  onInput: _cache[37] || (_cache[37] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_71$1, toDisplayString(__props.head['测试用仪器/检出限'] || ''), 1))
          ], 8, _hoisted_70$1)
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_72$1, toDisplayString(unref(tt)('原水水质条件')), 1),
          createBaseVNode("td", {
            class: "rs-td rs-water-zone",
            colspan: sampleCount.value
          }, [
            createBaseVNode("table", _hoisted_74$1, [
              createBaseVNode("tbody", null, [
                createBaseVNode("tr", null, [
                  createBaseVNode("td", _hoisted_75$1, toDisplayString(unref(tt)('自来水')), 1),
                  createBaseVNode("td", _hoisted_76$1, toDisplayString(unref(tt)('纯水')), 1),
                  createBaseVNode("td", _hoisted_77$1, toDisplayString(unref(tt)('超纯水')), 1),
                  createBaseVNode("td", _hoisted_78$1, toDisplayString(unref(tt)('PH')), 1),
                  createBaseVNode("td", _hoisted_79$1, toDisplayString(unref(tt)('TDS')), 1),
                  createBaseVNode("td", _hoisted_80$1, toDisplayString(unref(tt)('缸内自来水VOC浓度')), 1),
                  createBaseVNode("td", _hoisted_81$1, toDisplayString(unref(tt)('自来水加氯浓度')), 1),
                  createBaseVNode("td", _hoisted_82$1, toDisplayString(unref(tt)('水温℃')), 1)
                ]),
                createBaseVNode("tr", null, [
                  createBaseVNode("td", _hoisted_83$1, [
                    (__props.editable)
                      ? (openBlock(), createBlock(_component_el_select, {
                          key: 0,
                          modelValue: __props.head['原水自来水'],
                          "onUpdate:modelValue": _cache[38] || (_cache[38] = $event => ((__props.head['原水自来水']) = $event)),
                          size: "small",
                          clearable: false,
                          onChange: _cache[39] || (_cache[39] = $event => (emit('dirty')))
                        }, {
                          default: withCtx(() => [
                            (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions('原水自来水'), (o) => {
                              return (openBlock(), createBlock(_component_el_option, {
                                key: o.value,
                                label: o.label,
                                value: o.value
                              }, null, 8, ["label", "value"]))
                            }), 128))
                          ]),
                          _: 1
                        }, 8, ["modelValue"]))
                      : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                          createTextVNode(toDisplayString(__props.head['原水自来水'] || ''), 1)
                        ], 64))
                  ]),
                  createBaseVNode("td", _hoisted_84$1, [
                    (__props.editable)
                      ? (openBlock(), createBlock(_component_el_select, {
                          key: 0,
                          modelValue: __props.head['原水纯水'],
                          "onUpdate:modelValue": _cache[40] || (_cache[40] = $event => ((__props.head['原水纯水']) = $event)),
                          size: "small",
                          clearable: false,
                          onChange: _cache[41] || (_cache[41] = $event => (emit('dirty')))
                        }, {
                          default: withCtx(() => [
                            (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions('原水纯水'), (o) => {
                              return (openBlock(), createBlock(_component_el_option, {
                                key: o.value,
                                label: o.label,
                                value: o.value
                              }, null, 8, ["label", "value"]))
                            }), 128))
                          ]),
                          _: 1
                        }, 8, ["modelValue"]))
                      : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                          createTextVNode(toDisplayString(__props.head['原水纯水'] || ''), 1)
                        ], 64))
                  ]),
                  createBaseVNode("td", _hoisted_85$1, [
                    (__props.editable)
                      ? (openBlock(), createBlock(_component_el_select, {
                          key: 0,
                          modelValue: __props.head['原水超纯水'],
                          "onUpdate:modelValue": _cache[42] || (_cache[42] = $event => ((__props.head['原水超纯水']) = $event)),
                          size: "small",
                          clearable: false,
                          onChange: _cache[43] || (_cache[43] = $event => (emit('dirty')))
                        }, {
                          default: withCtx(() => [
                            (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions('原水超纯水'), (o) => {
                              return (openBlock(), createBlock(_component_el_option, {
                                key: o.value,
                                label: o.label,
                                value: o.value
                              }, null, 8, ["label", "value"]))
                            }), 128))
                          ]),
                          _: 1
                        }, 8, ["modelValue"]))
                      : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                          createTextVNode(toDisplayString(__props.head['原水超纯水'] || ''), 1)
                        ], 64))
                  ]),
                  createBaseVNode("td", _hoisted_86$1, [
                    (__props.editable)
                      ? (openBlock(), createBlock(_component_el_input, {
                          key: 0,
                          modelValue: __props.head['原水PH'],
                          "onUpdate:modelValue": _cache[44] || (_cache[44] = $event => ((__props.head['原水PH']) = $event)),
                          size: "small",
                          class: "rs-c-in",
                          onInput: _cache[45] || (_cache[45] = $event => (emit('dirty')))
                        }, null, 8, ["modelValue"]))
                      : (openBlock(), createElementBlock("span", _hoisted_87$1, toDisplayString(__props.head['原水PH'] || ''), 1))
                  ]),
                  createBaseVNode("td", _hoisted_88$1, [
                    (__props.editable)
                      ? (openBlock(), createBlock(_component_el_input, {
                          key: 0,
                          modelValue: __props.head['原水TDS'],
                          "onUpdate:modelValue": _cache[46] || (_cache[46] = $event => ((__props.head['原水TDS']) = $event)),
                          size: "small",
                          class: "rs-c-in",
                          onInput: _cache[47] || (_cache[47] = $event => (emit('dirty')))
                        }, null, 8, ["modelValue"]))
                      : (openBlock(), createElementBlock("span", _hoisted_89$1, toDisplayString(__props.head['原水TDS'] || ''), 1))
                  ]),
                  createBaseVNode("td", _hoisted_90$1, [
                    (__props.editable)
                      ? (openBlock(), createBlock(_component_el_input, {
                          key: 0,
                          modelValue: __props.head['缸内自来水VOC浓度'],
                          "onUpdate:modelValue": _cache[48] || (_cache[48] = $event => ((__props.head['缸内自来水VOC浓度']) = $event)),
                          size: "small",
                          class: "rs-c-in",
                          onInput: _cache[49] || (_cache[49] = $event => (emit('dirty')))
                        }, null, 8, ["modelValue"]))
                      : (openBlock(), createElementBlock("span", _hoisted_91$1, toDisplayString(__props.head['缸内自来水VOC浓度'] || ''), 1))
                  ]),
                  createBaseVNode("td", _hoisted_92$1, [
                    (__props.editable)
                      ? (openBlock(), createBlock(_component_el_input, {
                          key: 0,
                          modelValue: __props.head['自来水加氯浓度'],
                          "onUpdate:modelValue": _cache[50] || (_cache[50] = $event => ((__props.head['自来水加氯浓度']) = $event)),
                          size: "small",
                          class: "rs-c-in",
                          onInput: _cache[51] || (_cache[51] = $event => (emit('dirty')))
                        }, null, 8, ["modelValue"]))
                      : (openBlock(), createElementBlock("span", _hoisted_93$1, toDisplayString(__props.head['自来水加氯浓度'] || ''), 1))
                  ]),
                  createBaseVNode("td", _hoisted_94$1, [
                    (__props.editable)
                      ? (openBlock(), createBlock(_component_el_input, {
                          key: 0,
                          modelValue: __props.head['水温'],
                          "onUpdate:modelValue": _cache[52] || (_cache[52] = $event => ((__props.head['水温']) = $event)),
                          size: "small",
                          class: "rs-c-in",
                          onInput: _cache[53] || (_cache[53] = $event => (emit('dirty')))
                        }, null, 8, ["modelValue"]))
                      : (openBlock(), createElementBlock("span", _hoisted_95$1, toDisplayString(__props.head['水温'] || ''), 1))
                  ])
                ])
              ])
            ])
          ], 8, _hoisted_73$1)
        ])
      ])
    ]),
    createBaseVNode("table", _hoisted_96$1, [
      createBaseVNode("colgroup", null, [
        (!dtHidden('冲水时间'))
          ? (openBlock(), createElementBlock("col", _hoisted_97$1))
          : createCommentVNode("", true),
        (!dtHidden('累计进水（L）'))
          ? (openBlock(), createElementBlock("col", _hoisted_98$1))
          : createCommentVNode("", true),
        (!dtHidden('水温（℃）'))
          ? (openBlock(), createElementBlock("col", _hoisted_99$1))
          : createCommentVNode("", true),
        (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
          return (openBlock(), createElementBlock(Fragment, {
            key: 'cp' + n
          }, [
            (!dtHidden(`压力（PSI)样品${n}`))
              ? (openBlock(), createElementBlock("col", {
                  key: 0,
                  style: normalizeStyle({ width: pressColW.value + 'px' })
                }, null, 4))
              : createCommentVNode("", true)
          ], 64))
        }), 128)),
        (!dtHidden('原水含量（ug/L）5号缸'))
          ? (openBlock(), createElementBlock("col", _hoisted_100$1))
          : createCommentVNode("", true),
        (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
          return (openBlock(), createElementBlock(Fragment, {
            key: 'co' + n
          }, [
            (!dtHidden(`出水含量（ug/L）样品${n}`))
              ? (openBlock(), createElementBlock("col", {
                  key: 0,
                  style: normalizeStyle({ width: outColW.value + 'px' })
                }, null, 4))
              : createCommentVNode("", true)
          ], 64))
        }), 128)),
        (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
          return (openBlock(), createElementBlock(Fragment, {
            key: 'cr' + n
          }, [
            (!dtHidden(`去除率%样品${n}`))
              ? (openBlock(), createElementBlock("col", {
                  key: 0,
                  style: normalizeStyle({ width: outColW.value + 'px' })
                }, null, 4))
              : createCommentVNode("", true)
          ], 64))
        }), 128)),
        (!dtHidden('测试时间'))
          ? (openBlock(), createElementBlock("col", _hoisted_101$1))
          : createCommentVNode("", true),
        (__props.editable)
          ? (openBlock(), createElementBlock("col", _hoisted_102$1))
          : createCommentVNode("", true)
      ]),
      createBaseVNode("tbody", null, [
        createBaseVNode("tr", null, [
          createBaseVNode("td", {
            colspan: dtColSpan.value,
            class: "rs-sectionbar"
          }, [
            createTextVNode(toDisplayString(unref(tt)('3.数据记录表')) + " ", 1),
            (__props.editable)
              ? (openBlock(), createElementBlock("span", {
                  key: 0,
                  class: "rs-fieldedit",
                  title: unref(tt)('可改列名(别名)与显隐,全用户共享'),
                  onClick: openFieldEdit
                }, "✎ " + toDisplayString(unref(tt)('字段编辑')), 9, _hoisted_104$1))
              : createCommentVNode("", true)
          ], 8, _hoisted_103$1)
        ]),
        createBaseVNode("tr", _hoisted_105$1, [
          (!dtHidden('冲水时间'))
            ? (openBlock(), createElementBlock("th", _hoisted_106$1, toDisplayString(dtLabel('冲水时间')), 1))
            : createCommentVNode("", true),
          (!dtHidden('累计进水（L）'))
            ? (openBlock(), createElementBlock("th", _hoisted_107$1, toDisplayString(dtLabel('累计进水（L）')), 1))
            : createCommentVNode("", true),
          (!dtHidden('水温（℃）'))
            ? (openBlock(), createElementBlock("th", _hoisted_108$1, toDisplayString(dtLabel('水温（℃）')), 1))
            : createCommentVNode("", true),
          (dtGroupSpan('压力'))
            ? (openBlock(), createElementBlock("th", {
                key: 3,
                class: "rs-th",
                colspan: dtGroupSpan('压力')
              }, toDisplayString(dtGroupLabel('压力')), 9, _hoisted_109$1))
            : createCommentVNode("", true),
          (!dtHidden('原水含量（ug/L）5号缸'))
            ? (openBlock(), createElementBlock("th", _hoisted_110$1, toDisplayString(dtLabel('原水含量（ug/L）5号缸', '原水含量（ug/L）')), 1))
            : createCommentVNode("", true),
          (dtGroupSpan('出水'))
            ? (openBlock(), createElementBlock("th", {
                key: 5,
                class: "rs-th",
                colspan: dtGroupSpan('出水')
              }, toDisplayString(dtGroupLabel('出水')), 9, _hoisted_111$1))
            : createCommentVNode("", true),
          (dtGroupSpan('去除率'))
            ? (openBlock(), createElementBlock("th", {
                key: 6,
                class: "rs-th",
                colspan: dtGroupSpan('去除率')
              }, toDisplayString(dtGroupLabel('去除率')), 9, _hoisted_112$1))
            : createCommentVNode("", true),
          (!dtHidden('测试时间'))
            ? (openBlock(), createElementBlock("th", _hoisted_113$1, toDisplayString(dtLabel('测试时间')), 1))
            : createCommentVNode("", true),
          (__props.editable)
            ? (openBlock(), createElementBlock("th", _hoisted_114$1))
            : createCommentVNode("", true)
        ]),
        createBaseVNode("tr", _hoisted_115$1, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
            return (openBlock(), createElementBlock(Fragment, {
              key: 'hp' + n
            }, [
              (!dtHidden(`压力（PSI)样品${n}`))
                ? (openBlock(), createElementBlock("th", _hoisted_116$1, toDisplayString(dtLabel(`压力（PSI)样品${n}`, `样品${n}`)), 1))
                : createCommentVNode("", true)
            ], 64))
          }), 128)),
          (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
            return (openBlock(), createElementBlock(Fragment, {
              key: 'ho' + n
            }, [
              (!dtHidden(`出水含量（ug/L）样品${n}`))
                ? (openBlock(), createElementBlock("th", _hoisted_117$1, toDisplayString(dtLabel(`出水含量（ug/L）样品${n}`, `样品${n}`)), 1))
                : createCommentVNode("", true)
            ], 64))
          }), 128)),
          (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
            return (openBlock(), createElementBlock(Fragment, {
              key: 'hr' + n
            }, [
              (!dtHidden(`去除率%样品${n}`))
                ? (openBlock(), createElementBlock("th", _hoisted_118$1, toDisplayString(dtLabel(`去除率%样品${n}`, `样品${n}`)), 1))
                : createCommentVNode("", true)
            ], 64))
          }), 128))
        ]),
        (openBlock(true), createElementBlock(Fragment, null, renderList(items.value, (row, i) => {
          return (openBlock(), createElementBlock("tr", {
            key: row.id ?? ('new' + i)
          }, [
            (!dtHidden('冲水时间'))
              ? (openBlock(), createElementBlock("td", _hoisted_119$1, [
                  (__props.editable)
                    ? (openBlock(), createBlock(_component_el_input, {
                        key: 0,
                        modelValue: row['冲水时间'],
                        "onUpdate:modelValue": $event => ((row['冲水时间']) = $event),
                        size: "small",
                        class: "rs-c-in",
                        onInput: _cache[54] || (_cache[54] = $event => (emit('dirty')))
                      }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                    : (openBlock(), createElementBlock("span", _hoisted_120$1, toDisplayString(row['冲水时间'] || ' / '), 1))
                ]))
              : createCommentVNode("", true),
            (!dtHidden('累计进水（L）'))
              ? (openBlock(), createElementBlock("td", _hoisted_121$1, [
                  (__props.editable)
                    ? (openBlock(), createBlock(_component_el_input, {
                        key: 0,
                        modelValue: row['累计进水（L）'],
                        "onUpdate:modelValue": $event => ((row['累计进水（L）']) = $event),
                        size: "small",
                        class: "rs-c-in",
                        onInput: _cache[55] || (_cache[55] = $event => (emit('dirty')))
                      }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                    : (openBlock(), createElementBlock("span", _hoisted_122$1, toDisplayString(row['累计进水（L）'] || ' / '), 1))
                ]))
              : createCommentVNode("", true),
            (!dtHidden('水温（℃）'))
              ? (openBlock(), createElementBlock("td", _hoisted_123$1, [
                  (__props.editable)
                    ? (openBlock(), createBlock(_component_el_input, {
                        key: 0,
                        modelValue: row['水温（℃）'],
                        "onUpdate:modelValue": $event => ((row['水温（℃）']) = $event),
                        size: "small",
                        class: "rs-c-in",
                        onInput: _cache[56] || (_cache[56] = $event => (emit('dirty')))
                      }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                    : (openBlock(), createElementBlock("span", _hoisted_124$1, toDisplayString(row['水温（℃）'] || ' / '), 1))
                ]))
              : createCommentVNode("", true),
            (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
              return (openBlock(), createElementBlock(Fragment, {
                key: 'dp' + n
              }, [
                (!dtHidden(`压力（PSI)样品${n}`))
                  ? (openBlock(), createElementBlock("td", _hoisted_125$1, [
                      createBaseVNode("div", _hoisted_126$1, [
                        (__props.editable)
                          ? (openBlock(), createBlock(_component_el_input, {
                              key: 0,
                              modelValue: row[`压力（PSI)样品${n}`],
                              "onUpdate:modelValue": $event => ((row[`压力（PSI)样品${n}`]) = $event),
                              size: "small",
                              class: "rs-c-in hl",
                              placeholder: "压力",
                              onInput: _cache[57] || (_cache[57] = $event => (emit('dirty')))
                            }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                          : createCommentVNode("", true),
                        (__props.editable)
                          ? (openBlock(), createBlock(_component_el_input, {
                              key: 1,
                              modelValue: row[`流速（L/min)样品${n}`],
                              "onUpdate:modelValue": $event => ((row[`流速（L/min)样品${n}`]) = $event),
                              size: "small",
                              class: "rs-c-in hl",
                              placeholder: "流速",
                              onInput: _cache[58] || (_cache[58] = $event => (emit('dirty')))
                            }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                          : (openBlock(), createElementBlock("span", _hoisted_127$1, toDisplayString(combo(row, `压力（PSI)样品${n}`, `流速（L/min)样品${n}`)), 1))
                      ])
                    ]))
                  : createCommentVNode("", true)
              ], 64))
            }), 128)),
            (!dtHidden('原水含量（ug/L）5号缸'))
              ? (openBlock(), createElementBlock("td", _hoisted_128$1, [
                  (__props.editable)
                    ? (openBlock(), createBlock(_component_el_input, {
                        key: 0,
                        modelValue: row['原水含量（ug/L）5号缸'],
                        "onUpdate:modelValue": $event => ((row['原水含量（ug/L）5号缸']) = $event),
                        size: "small",
                        class: "rs-c-in",
                        onInput: _cache[59] || (_cache[59] = $event => (emit('dirty')))
                      }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                    : (openBlock(), createElementBlock("span", _hoisted_129$1, toDisplayString(row['原水含量（ug/L）5号缸'] || ' / '), 1))
                ]))
              : createCommentVNode("", true),
            (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
              return (openBlock(), createElementBlock(Fragment, {
                key: 'do' + n
              }, [
                (!dtHidden(`出水含量（ug/L）样品${n}`))
                  ? (openBlock(), createElementBlock("td", _hoisted_130$1, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: row[`出水含量（ug/L）样品${n}`],
                            "onUpdate:modelValue": $event => ((row[`出水含量（ug/L）样品${n}`]) = $event),
                            size: "small",
                            class: "rs-c-in",
                            onInput: _cache[60] || (_cache[60] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_131$1, toDisplayString(row[`出水含量（ug/L）样品${n}`] || ' / '), 1))
                    ]))
                  : createCommentVNode("", true)
              ], 64))
            }), 128)),
            (openBlock(true), createElementBlock(Fragment, null, renderList(sampleCount.value, (n) => {
              return (openBlock(), createElementBlock(Fragment, {
                key: 'dr' + n
              }, [
                (!dtHidden(`去除率%样品${n}`))
                  ? (openBlock(), createElementBlock("td", _hoisted_132$1, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: row[`去除率%样品${n}`],
                            "onUpdate:modelValue": $event => ((row[`去除率%样品${n}`]) = $event),
                            size: "small",
                            class: "rs-c-in",
                            onInput: _cache[61] || (_cache[61] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_133$1, toDisplayString(row[`去除率%样品${n}`] || ' / '), 1))
                    ]))
                  : createCommentVNode("", true)
              ], 64))
            }), 128)),
            (!dtHidden('测试时间'))
              ? (openBlock(), createElementBlock("td", _hoisted_134$1, [
                  (__props.editable)
                    ? (openBlock(), createBlock(_component_el_input, {
                        key: 0,
                        modelValue: row['测试时间'],
                        "onUpdate:modelValue": $event => ((row['测试时间']) = $event),
                        size: "small",
                        class: "rs-c-in",
                        onInput: _cache[62] || (_cache[62] = $event => (emit('dirty')))
                      }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                    : (openBlock(), createElementBlock("span", _hoisted_135$1, toDisplayString(row['测试时间'] || ' / '), 1))
                ]))
              : createCommentVNode("", true),
            (__props.editable)
              ? (openBlock(), createElementBlock("td", _hoisted_136$1, [
                  createBaseVNode("span", {
                    class: "rs-op-add",
                    onClick: $event => (addRow(i))
                  }, "＋", 8, _hoisted_137$1),
                  createBaseVNode("span", {
                    class: "rs-op-del",
                    onClick: $event => (removeRow(i))
                  }, "×", 8, _hoisted_138$1)
                ]))
              : createCommentVNode("", true)
          ]))
        }), 128)),
        (!items.value.length)
          ? (openBlock(), createElementBlock("tr", _hoisted_139$1, [
              createBaseVNode("td", {
                colspan: dtColSpan.value,
                class: "rs-empty"
              }, "—", 8, _hoisted_140$1)
            ]))
          : createCommentVNode("", true)
      ])
    ]),
    (__props.editable)
      ? (openBlock(), createElementBlock("div", {
          key: 1,
          class: "rs-add",
          onClick: _cache[63] || (_cache[63] = $event => (addRow(-1)))
        }, "＋ " + toDisplayString(unref(tt)('新增数据记录行')), 1))
      : createCommentVNode("", true),
    createBaseVNode("table", _hoisted_141$1, [
      createBaseVNode("tbody", null, [
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_142$1, toDisplayString(unref(tt)('4.数据结论')), 1)
        ]),
        createBaseVNode("tr", null, [
          createBaseVNode("td", _hoisted_143$1, [
            (__props.editable)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: __props.head['数据结论'],
                  "onUpdate:modelValue": _cache[64] || (_cache[64] = $event => ((__props.head['数据结论']) = $event)),
                  type: "textarea",
                  autosize: { minRows: 2, maxRows: 12 },
                  size: "small",
                  class: "rs-t-in",
                  onInput: _cache[65] || (_cache[65] = $event => (emit('dirty')))
                }, null, 8, ["modelValue"]))
              : (openBlock(), createElementBlock("span", _hoisted_144$1, toDisplayString(__props.head['数据结论'] || ''), 1))
          ])
        ])
      ])
    ]),
    createVNode(RefPickDialog, {
      modelValue: prodRefVisible.value,
      "onUpdate:modelValue": _cache[66] || (_cache[66] = $event => ((prodRefVisible).value = $event)),
      field: prodRefField.value,
      mode: "header",
      onConfirm: onProdRefConfirm
    }, null, 8, ["modelValue", "field"]),
    createVNode(_component_el_dialog, {
      modelValue: fieldEditVisible.value,
      "onUpdate:modelValue": _cache[68] || (_cache[68] = $event => ((fieldEditVisible).value = $event)),
      title: unref(tt)('字段编辑'),
      width: "620px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[67] || (_cache[67] = $event => (fieldEditVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: saveFieldEdit
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('保存')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_145$1, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(fieldEditRows.value, (row, idx) => {
            return (openBlock(), createElementBlock("div", {
              key: idx,
              class: "fe-row"
            }, [
              createBaseVNode("span", {
                class: "fe-key",
                title: row.key
              }, toDisplayString(row.key), 9, _hoisted_146$1),
              createBaseVNode("span", _hoisted_147$1, toDisplayString(unref(tt)(row.label)), 1),
              createVNode(_component_el_input, {
                "model-value": row.alias,
                "onUpdate:modelValue": (v) => { row.alias = v; },
                size: "small",
                placeholder: unref(tt)(row.label),
                clearable: "",
                class: "fe-alias"
              }, null, 8, ["model-value", "onUpdate:modelValue", "placeholder"]),
              createVNode(_component_el_checkbox, {
                "model-value": row.visible,
                "onUpdate:modelValue": (v) => { row.visible = v; },
                class: "fe-vis",
                title: unref(tt)('不勾选=该列不显示/不导出')
              }, null, 8, ["model-value", "onUpdate:modelValue", "title"])
            ]))
          }), 128))
        ]),
        createBaseVNode("div", _hoisted_148$1, toDisplayString(unref(tt)('留空=沿用原名;修改全局生效(所有用户共享)')), 1)
      ]),
      _: 1
    }, 8, ["modelValue", "title"])
  ]))
}
}

};
const DataRecordSheet = /*#__PURE__*/_export_sfc(_sfc_main$2, [['__scopeId',"data-v-2b931932"]]);

/**
 * 文件类文书面板配置(数据驱动:DocSheet 按配置渲染版式)
 * row 类型:
 *  - field: { num, label, key, max, h, kind:'input'|'textarea', hint?,
 *             second?:{ label, key, kind:'date'|'text' } }   单字段行(second = 同一行右侧的第二字段)
 *  - multi: { num, label, h, subs:[{ label, key, max }] }                  多子区行(如 测试方案)
 * signCells: 底部签名区 [ { label, key, w(蓝格宽), type:'text'|'date', flex(占比), white(白底蓝字) } ]
 * remark:    { label, key, max }  右侧**可填**备注列(立项申请表设计 F5 标签 + F6:G15 填写区);
 *            2026-09-22 前该列是 deco 装饰虚线(只画不填),已被 remark 取代 —— deco 开关与渲染分支已删除
 * 行高 h 的口径:设计 xlsx 的**磅值 × 4/3**(96dpi),合并行取参与合并各行之和;
 *            因控件不得被裁切,DocSheet 对「单字段行/多子区行/阶段框行」一律按 min-height 渲染。
 * 依据与不变量见同目录 docSheetConfigs.test.js(标题/下拉口径/备注区/第 8 行/行高)
 */
const approvalSheetCfg = {
  titlePart1: '立项申请表',
  titlePart2: '二三四级项目',
  titlePart3: '',
  seq: 'cn',
  // 设计右侧是可填的「备注」区(F5 标签 + F6:G15 合并填写区)⇒ 渲染成真的备注列,
  // 不再是 deco 装饰虚线(2026-09-22 对齐设计;rd_approval.备注 列本就存在,只是没登记字段)
  remark: { label: '备注', key: '备注', max: 1000 },
  rows: [
    // 行高 = 设计磅值 × 4/3(96dpi),来源「立项申请表.xlsx」行高
    // [33,24,18.75,20.25,33.75,38.25,33,null,null,41.25,75.75,157.5,70.5,41.25,41.25,33]
    { num: '一', label: '客户名', key: '客户名', max: 0, h: 45, kind: 'input' },
    { num: '二', label: '立项背景', key: '立项背景', max: 250, h: 133, kind: 'textarea' },
    { num: '三', label: '机型及应用位置', key: '机型及应用位置', max: 50, h: 55, kind: 'textarea' },
    { num: '四', label: '滤芯/炭棒规格或结构', key: '滤芯/炭棒规格或结构', max: 100, h: 101, kind: 'textarea' },
    { num: '五', label: '项目开发目标', key: '项目开发目标', max: 250, h: 210, kind: 'textarea' },
    { num: '六', label: '项目输出', key: '项目输出', max: 100, h: 94, kind: 'textarea' },
    { num: '七', label: '开发周期要求', key: '开发周期要求', max: 50, h: 55, kind: 'textarea' },
    { num: '八', label: '其它要求', key: '其它要求', max: 250, h: 55, kind: 'textarea' },
  ],
  signCells: [
    { label: '申请立项人', key: '申请立项人', w: 202, type: 'text', flex: 53 },
    { label: '申请立项日期', key: '申请立项日期', w: 150, type: 'date', flex: 47, white: true },
  ],
};

/** 项目实施计划(二三四级项目):原图无右侧虚列;测试方案行为三子区(条件/方法/标准);末行 负责人+编制日期 */
const planSheetCfg = {
  titlePart1: '项目',
  titlePart2: '二三四级',
  titlePart3: '实施计划',
  seq: 'num',
  rows: [
    // 行高 = 设计磅值 × 4/3(96dpi),来源「项目实施计划.xlsx」行高
    // [20.15,27.75,27.75,27.75,33.75,33.75,32.1,77.1,60.95,39.95,39.95,39.95,68.25,30]
    { num: '1', label: '项目名称', key: '项目名称', max: 50, h: 45, kind: 'input' },
    // 下拉口径必须与库字典一致:RD_PLAN.项目定级 已被 migrate-approval-level.sql(2026-09-21)
    // 补入「一级」(下游承接立项申请的 项目等级 一~四级),少一级会让参照带入的值选不中
    { num: '2', label: '项目定级', key: '项目定级', max: 0, h: 45, kind: 'select',
      options: [
        { value: '一级', label: '一级' },
        { value: '二级', label: '二级' },
        { value: '三级', label: '三级' },
        { value: '四级', label: '四级' },
      ], required: true,
      hint: '必填' },
    { num: '3', label: '测试内容', key: '测试内容', max: 100, h: 43, kind: 'textarea' },
    { num: '4', label: '测试产品打样要求', key: '测试产品打样要求', max: 100, h: 103, kind: 'textarea' },
    { num: '5', label: '测试目标', key: '测试目标', max: 50, h: 81, kind: 'textarea' },
    {
      num: '6', label: '测试方案', h: 160,
      subs: [
        { label: '测试条件', key: '测试条件', max: 150 },
        { label: '测试方法', key: '测试方法', max: 150 },
        { label: '测试标准', key: '测试标准', max: 150 },
      ],
    },
    // 测试计划:10 个阶段框(默认全显示;每个框可隐藏/显示,隐藏后下方自动接上;导出按实际显示)
    // 设计该行只有 68.25pt 高的一格,而实现是 10 个阶段框×5 字段的功能面板 ⇒ h 只作最小高度
    {
      num: '7', label: '测试计划', kind: 'phases', h: 91,
      phases: [
        { num: 1, key: '阶段1', max: 500 },
        { num: 2, key: '阶段2', max: 500 },
        { num: 3, key: '阶段3', max: 500 },
        { num: 4, key: '阶段4', max: 500 },
        { num: 5, key: '阶段5', max: 500 },
        { num: 6, key: '阶段6', max: 500 },
        { num: 7, key: '阶段7', max: 500 },
        { num: 8, key: '阶段8', max: 500 },
        { num: 9, key: '阶段9', max: 500 },
        { num: 10, key: '阶段10', max: 500 },
      ],
    },
    // 第 8 行 = 设计末行(B15=8 / C15=负责人 / F15=编制日期:):负责人在左、编制日期在右同一行,
    // 2026-09-22 前落在底部签名区(与设计不符);负责人由登录人锁定,渲染按字段级只读
    { num: '8', label: '负责人', key: '负责人', max: 50, h: 40, kind: 'input',
      second: { label: '编制日期', key: '编制日期', kind: 'date' } },
  ],
  signCells: [],
};

/**
 * ═══ 品质管理八单据(YJ-QR-11/59/60/64/92/118/119/120):按原表格版式渲染 ═══
 * 另含 QC_TC_IN(来料品质特采单):YJ-QR-60 表单,独立面板 / 独立表 / 独立编号(TCI)。
 * 原 质量单据·特采申请单 QC_TC 与之重复,已于 2026-09-22 整体下线(本文件不再有该键)。
 * 行型: pairs(网格行:标签|值 多组)/section(章节行:标题+填写区/勾选/子区+签名行)/dept(部门会签行)
 * 约定: key=数据列名(=字段 label);checks 单选语义存选项值;dept 子区勾选为纸面装饰(同意/不同意由审批留痕);
 *       右上信息表 info: static=印刷值,date/ref/input 自动判型;底部 signKind:'plain'=编制/审核/批准 简单行。
 */

// 通用右上信息表:使用范围/责任部门(纸面印刷值,非录入项)/时间(单据日期)
// 责任部门仅 QC_BHG(不合格报告)是纸面留空的录入字段(表列存在);其余七单纸面为印好的固定部门
const qcInfo = (dept) => [
  { label: '使用范围', kind: 'static', text: '公司内部' },
  { label: '责任部门', kind: 'static', text: dept },
  { label: '时间', key: '单据日期', kind: 'date' },
];
// 通用底部落款
const qcSignStd = (bianzhi) => [
  { label: '编制', key: bianzhi, flex: 1 },
  { label: '审核', key: '审核人', flex: 1 },
  { label: '批准', key: '审批人', flex: 1 },
];

const qcSheetCfgs = {
  // YJ-QR-11 不合格报告(制程)
  QC_BHG: {
    docno: 'YJ-QR-11',
    titlePart1: '不合格品分析报告', titlePart2: '制程', titlePart3: '',
    info: [
      { label: '填写部门', key: '填写部门' },
      { label: '填写人', key: '填写人' },
      { label: '填写日期', key: '单据日期', kind: 'date' },
    ],
    rows: [
      { kind: 'pairs', cells: [
        { label: '检验工站', key: '检验工站', flex: 1 },
        { label: '客户', key: '客户名称', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '异常时间', key: '异常时间', kind: 'date', flex: 1 },
        { label: '责任部门', key: '责任部门', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '产品名称', key: '产品名称', flex: 1 },
        { label: '异常产品规格', key: '异常产品规格', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '不合格品数量', key: '不合格品数量', flex: 0.9 },
        { label: '异常等级', key: '异常等级', kind: 'checks', options: ['一般不合格', '严重不合格'], flex: 1.6 },
      ] },
      { kind: 'section', label: '异常描述', key: '异常描述', h: 110, max: 2000, sign: '签名' },
      { kind: 'section', label: '原因分析（生产部）', key: '原因分析', h: 110, max: 2000, sign: '签名' },
      { kind: 'section', label: '改善对策（生产部/IPQC）', key: '改善对策', h: 110, max: 2000, sign: '签名' },
      { kind: 'section', label: '效果跟踪', key: '效果跟踪', h: 90, max: 1000, sign: '签名' },
      { kind: 'section', label: '品质部意见', key: '品质部意见', h: 90, max: 1000, sign: '签名' },
    ],
    signKind: 'plain',
    signCells: qcSignStd('填写人'),
  },

  // YJ-QR-59 不合格品处理单(制程)
  QC_BHC: {
    docno: 'YJ-QR-59',
    titlePart1: '不合格品处理单', titlePart2: '制程', titlePart3: '',
    info: qcInfo('质量管理中心'),
    rows: [
      { kind: 'pairs', cells: [
        { label: '客户名称', key: '客户名称', flex: 1.1 },
        { label: '产品编码', key: '产品编码', flex: 0.9 },
        { label: '产品名称', key: '产品名称', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '产品规格', key: '产品规格', flex: 1 },
        { label: '生产量', key: '生产量', flex: 0.8 },
        { label: '不合格品数量', key: '不合格品数量', flex: 0.9 },
        { label: '不合格品比例', key: '不合格品比例', flex: 0.9 },
      ] },
      { kind: 'pairs', cells: [
        { label: '问题来源', key: '问题来源', kind: 'checks', options: ['成型', '组装'], flex: 1.5 },
        { label: '责任人', key: '责任人', flex: 1 },
      ] },
      { kind: 'section', label: '一．问题描述（可附图片，必要时另附问题品）', key: '问题描述', h: 110, max: 2000, sign: '责任人' },
      { kind: 'section', label: '二．原因分析', key: '原因分析', h: 100, max: 2000, sign: '责任人' },
      { kind: 'section', label: '三．性能验证', key: '性能验证', h: 90, max: 1000, sign: '责任人' },
      { kind: 'section', label: '四．不合格品处理意见', key: '处理意见', h: 70, sign: '品质部', signKey: '责任人',
        checks: ['返工达到规定要求', '让步使用', '报废', '筛选合格品留用'] },
      { kind: 'section', label: '五．相关部门处理意见', h: 34 },
      { kind: 'dept', label: '产品开发部意见', h: 130, subs: [
        { label: '性能', key: '产品开发部性能意见', checks: ['同意使用', '不同意使用'], max: 250 },
        { label: '工艺', key: '产品开发部工艺意见', checks: ['同意使用', '不同意使用'], max: 250 },
      ] },
      { kind: 'dept', label: '销售部意见', h: 80, subs: [
        { key: '销售部意见', checks: ['同意使用', '不同意使用'], max: 250 },
      ] },
      { kind: 'section', label: '六、改善效果验证（如有返工处理需填写）', key: '改善效果验证', h: 90, max: 1000, sign: '责任人' },
      { kind: 'section', label: '七．损失成本', h: 46 },
      { kind: 'pairs', cells: [
        { label: '材料费用', key: '材料费用', flex: 1 },
        { label: '人工费', key: '人工费', flex: 1 },
        { label: '其他费用', key: '其他费用', flex: 1 },
      ] },
    ],
    signKind: 'plain',
    signCells: qcSignStd('责任人'),
  },

  // 来料品质特采单(YJ-QR-60 表单,独立面板 + 独立表,挂 品质管理 > 来料品质)
  // 2026-09-22:原「质量单据·特采申请单」QC_TC 与本单同表同版式、属重复,已整体下线
  // (面板行/表/版式键一并删除,见 tools/migrate-qc-tc-drop.sql)→ 特采只此一个入口,前缀 TCI。
  // 版式 1:1 对齐原扫描图(YJ-QR-60):表体 x48..495=447px → 纸面 938px(比例 2.098),以下
  //   列宽 / 行高全部取实测值换算,不用估:「申请单位」竖排列 31px→65px(vcol,一行一字 vcell)、
  //   其后标签列 50px→105px(labelW)、三组「标签|值」50+66 / 82+79 / 62+77 → 243 / 338 / 292(flex);
  //   表头五行共用这两条竖线(申请单位列 65 与标签列右沿 170)→ 竖线贯通不断,故不错位;
  //   部门会签名格取 170px(nameW),与标签列右沿同一条线 → 整张表是一张网格。
  QC_TC_IN: {
    docno: 'YJ-QR-60',
    titlePart1: '特采申请单', titlePart2: '', titlePart3: '',
    info: qcInfo('采购部'),
    vcol: 65,
    labelW: 105,
    deptSignBottom: true,
    rows: [
      { kind: 'pairs', h: 52, vcell: '申', cells: [
        { label: '供应商', key: '供应商', labelW: 105, flex: 243 },
        { label: '采购单号', key: '采购单号', labelW: 172, flex: 338 },
        { label: '产品名称', key: '产品名称', labelW: 130, flex: 292 },
      ] },
      // 与上一行同一组列宽(原图两行竖线本是重合的)→ 两组值区左右边界逐格对齐
      { kind: 'pairs', h: 63, vcell: '请', cells: [
        { label: '总数量', key: '总数量', labelW: 105, flex: 243 },
        { label: '不合格品数量', key: '不合格品数量', labelW: 172, flex: 338 },
        { label: '不合格品比例', key: '不合格品比例', labelW: 130, flex: 292 },
      ] },
      // 原图:不良说明 与 严重程度 是上下两行、各占整宽(不是并排)→ 各用单元素 pairs 行
      { kind: 'pairs', h: 63, vcell: '单', cells: [
        { label: '不良说明', key: '不良说明', flex: 1 },
      ] },
      { kind: 'pairs', h: 61, vcell: '位', cells: [
        { label: '严重程度', key: '严重程度', kind: 'checks', options: ['严重', '一般', '轻微'], spread: true, flex: 1 },
      ] },
      // 原图:特采理由 一格到底 —— 左侧标签 + 整宽填写区,最下一行右端「申请人：　年　月　日」
      // (申请单位列在此行只有竖线、无字,故 vcell 给空串;dateKey=年月日三段可填,存 特采理由日期)
      { kind: 'pairs', h: 185, vcell: '', cells: [
        { label: '特采理由', key: '特采理由', kind: 'textarea', rows: 3, max: 1000,
          sign: '申请人', signKey: '编制人', dateKey: '特采理由日期', flex: 1 },
      ] },
      { kind: 'section', label: '一．相关部门处理意见', h: 34 },
      // 部门意见区:原图只有「签名：　年　月　日」(落在各块最下一行),没有勾选框(同意/不同意由审批流留痕);
      // 行高与子区比例(性能 101 / 工艺 124)、品质/销售/研发 124/122/92 均取原图实测;
      // signKey/dateKey=会签签名与年月日可填(各落一列,hidden 字段,不进通用表单)
      { kind: 'dept', label: '产品开发部意见', h: 225, nameW: 170, signKey: '产品开发部签名', dateKey: '产品开发部日期', subs: [
        { label: '性能', key: '产品开发部性能意见', max: 250, rows: 1, flex: 101 },
        { label: '工艺', key: '产品开发部工艺意见', max: 250, rows: 1, flex: 124 },
      ] },
      { kind: 'dept', label: '品质部意见', h: 124, nameW: 170, signKey: '品质部签名', dateKey: '品质部日期', subs: [{ key: '品质部意见', max: 250, rows: 1, flex: 1 }] },
      { kind: 'dept', label: '销售部意见', h: 122, nameW: 170, signKey: '销售部签名', dateKey: '销售部日期', subs: [{ key: '销售部意见', max: 250, rows: 1, flex: 1 }] },
      { kind: 'dept', label: '研发意见', h: 92, nameW: 170, signKey: '研发签名', dateKey: '研发日期', subs: [{ key: '研发意见', max: 250, rows: 1, flex: 1 }] },
      // 原图:先一条整宽标题带,再一行整宽勾选(正常使用/管控使用/挑选使用,左起均匀铺开)
      { kind: 'section', label: '二．最终处理结果', h: 36 },
      { kind: 'pairs', h: 71, cells: [
        { key: '最终处理结果', kind: 'checks', options: ['正常使用', '管控使用', '挑选使用'], spread: true, flex: 1 },
      ] },
    ],
    signKind: 'plain',
    signCells: qcSignStd('编制人'),
  },

  // YJ-QR-64 不合格品处理单(自制物料)
  QC_BHZ: {
    docno: 'YJ-QR-64',
    titlePart1: '不合格品处理单', titlePart2: '自制物料', titlePart3: '',
    info: qcInfo('质量管理中心'),
    rows: [
      { kind: 'pairs', cells: [
        { label: '物料名称', key: '物料名称', flex: 1.1 },
        { label: '物料编码', key: '物料编码', flex: 1 },
        { label: '物料批次', key: '物料批次', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '生产数量', key: '生产数量', flex: 0.9 },
        { label: '问题来源', key: '问题来源', kind: 'checks', options: ['制程', '成品'], flex: 1.5 },
        { label: '责任人', key: '责任人', flex: 1 },
      ] },
      { kind: 'section', label: '一．问题描述（可附图片，必要时另附问题品）', key: '问题描述', h: 110, max: 2000, sign: '责任人' },
      { kind: 'section', label: '二．原因分析', key: '原因分析', h: 100, max: 2000, sign: '责任人' },
      { kind: 'section', label: '三．性能验证', key: '性能验证', h: 90, max: 1000, sign: '责任人' },
      { kind: 'section', label: '四．不合格品处理意见', key: '处理意见', h: 70, sign: '品质部', signKey: '责任人',
        checks: ['返工达到规定要求', '让步使用', '报废', '筛选合格品留用'] },
      { kind: 'section', label: '五．相关部门处理意见', h: 34 },
      { kind: 'dept', label: '研发部意见', h: 85, subs: [{ key: '研发部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'dept', label: '产品开发部意见', h: 85, subs: [{ key: '产品开发部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'section', label: '六、改善效果验证（如有返工处理需填写）', key: '改善效果验证', h: 90, max: 1000, sign: '责任人' },
      { kind: 'section', label: '七．成本损失', h: 46 },
      { kind: 'pairs', cells: [
        { label: '材料费用', key: '材料费用', flex: 1 },
        { label: '人工费', key: '人工费', flex: 1 },
        { label: '其他费用', key: '其他费用', flex: 1 },
      ] },
    ],
    signKind: 'plain',
    signCells: qcSignStd('责任人'),
  },

  // YJ-QR-92 紧急放行申请单
  QC_JJF: {
    docno: 'YJ-QR-92',
    titlePart1: '紧急放行通知单', titlePart2: '', titlePart3: '',
    info: qcInfo(''),
    rows: [
      { kind: 'pairs', cells: [
        { label: '物料类型', key: '物料类型', kind: 'checks', options: ['外部来料', '自制物料'], flex: 3 },
      ] },
      { kind: 'pairs', cells: [
        { label: '物料名称', key: '物料名称', flex: 1 },
        { label: '物料编码', key: '物料编码', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '申请放行数量', key: '申请放行数量', flex: 1 },
        { label: '批次号', key: '批次号', flex: 1 },
      ] },
      { kind: 'section', label: '一．紧急放行原因', key: '紧急放行原因', h: 110, max: 2000, sign: '责任人', signKey: '责任人' },
      { kind: 'section', label: '二．相关部门处理意见', h: 34 },
      { kind: 'dept', label: '产品开发部意见', h: 130, subs: [
        { label: '性能', key: '产品开发部性能意见', checks: ['同意使用', '不同意使用'], max: 250 },
        { label: '工艺', key: '产品开发部工艺意见', checks: ['同意使用', '不同意使用'], max: 250 },
      ] },
      { kind: 'dept', label: '品质部意见', h: 80, subs: [{ key: '品质部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'section', label: '三．检测结果', key: '检测结果', h: 90, max: 1000 },
    ],
    signKind: 'plain',
    signCells: qcSignStd('检测人'),
  },

  // YJ-QR-118 试产材料使用申请单
  QC_SCP: {
    docno: 'YJ-QR-118',
    titlePart1: '试产材料使用申请单', titlePart2: '', titlePart3: '',
    info: qcInfo('研发部'),
    rows: [
      { kind: 'pairs', cells: [
        { label: '物料名称', key: '物料名称', flex: 1.1 },
        { label: '物料编码', key: '物料编码', flex: 1 },
        { label: '物料批次', key: '物料批次', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '生产量', key: '生产量', flex: 0.9 },
        { label: '责任人', key: '责任人', flex: 2 },
      ] },
      { kind: 'section', label: '一．材料来源描述（可附图片，必要时另附问题品）', key: '材料来源描述', h: 110, max: 2000, sign: '责任人' },
      { kind: 'section', label: '二．测试结果', key: '测试结果', h: 110, max: 2000, sign: '责任人' },
      { kind: 'section', label: '三．相关部门处理意见', h: 34 },
      { kind: 'dept', label: '研发部意见', h: 80, subs: [{ key: '研发部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'dept', label: '产品开发部意见', h: 80, subs: [{ key: '产品开发部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'dept', label: '品质部意见', h: 80, subs: [{ key: '品质部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
    ],
    signKind: 'plain',
    signCells: qcSignStd('责任人'),
  },

  // YJ-QR-119 来料异常分析报告
  QC_LYB: {
    docno: 'YJ-QR-119',
    titlePart1: '来料异常分析报告', titlePart2: '', titlePart3: '',
    info: qcInfo(''),
    rows: [
      { kind: 'pairs', cells: [
        { label: '供应商', key: '供应商', flex: 1.2 },
        { label: '物料批次', key: '物料批次', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '物料名称', key: '物料名称', flex: 1.2 },
        { label: '来料数量', key: '来料数量', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '物料编码', key: '物料编码', flex: 1.2 },
        { label: '不良率', key: '不良率', flex: 1 },
      ] },
      { kind: 'section', label: '一．异常描述（可附图片，必要时另附问题品）', key: '异常描述', h: 110, max: 2000, sign: '责任人', signKey: '编制人' },
      { kind: 'section', label: '二、异常原因分析', h: 150, subs: [
        { label: '供应商原因', key: '供应商原因', max: 500 },
        { label: '内部原因（无则填无）', key: '内部原因', max: 500 },
      ] },
      { kind: 'section', label: '三、处理方式（品质部）', key: '处理方式', h: 60, sign: '签名', signKey: '编制人',
        checks: ['整批退货', '全检挑选', '让步接收'] },
      { kind: 'section', label: '四．改善追踪结果', key: '改善追踪结果', h: 100, max: 1000 },
    ],
    signKind: 'plain',
    signCells: qcSignStd('编制人'),
  },

  // YJ-QR-120 生产异常分析报告
  QC_SCY: {
    docno: 'YJ-QR-120',
    titlePart1: '生产异常分析报告', titlePart2: '', titlePart3: '',
    info: qcInfo('生产部'),
    rows: [
      { kind: 'pairs', cells: [
        { label: '产品/物料名称', key: '产品物料名称', flex: 1.2 },
        { label: '产品/物料批次', key: '产品物料批次', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '产品/物料编码', key: '产品物料编码', flex: 1.2 },
        { label: '生产量', key: '生产量', flex: 1 },
      ] },
      { kind: 'section', label: '异常描述', key: '异常描述', h: 110, max: 2000, sign: '签名', signKey: '编制人' },
      { kind: 'section', label: '原因分析', key: '原因分析', h: 110, max: 2000, sign: '签名', signKey: '编制人' },
      { kind: 'section', label: '改善对策', key: '改善对策', h: 110, max: 2000, sign: '签名', signKey: '编制人' },
      { kind: 'section', label: '效果跟踪', key: '效果跟踪', h: 90, max: 1000, sign: '签名', signKey: '编制人' },
      { kind: 'section', label: '品质部意见', key: '品质部意见', h: 90, max: 1000, sign: '签名', signKey: '编制人' },
    ],
    signKind: 'plain',
    signCells: qcSignStd('编制人'),
  },
};

/* unplugin-vue-components disabled */

const _hoisted_1$1 = {
  key: 0,
  class: "mm-head"
};
const _hoisted_2$1 = { class: "mm-tag" };
const _hoisted_3$1 = { class: "mm-name" };
const _hoisted_4$1 = {
  key: 0,
  class: "mm-tip"
};
const _hoisted_5$1 = { class: "mm-toolbar" };
const _hoisted_6$1 = { class: "mm-count" };


const _sfc_main$1 = {
  __name: 'DetailMaintainDialog',
  props: {
  modelValue: { type: Boolean, default: false },
  panelCode: { type: String, default: '' },
  row: { type: Object, default: null }, // 当前单据行（含 编号/单据状态 + detail）
},
  emits: ['update:modelValue', 'saved'],
  setup(__props, { emit: __emit }) {

const engine = usePanelRuntime();

const props = __props;
const emit = __emit;

// 布尔开关渲染依赖(行对象可能 markRaw 去响应式,值变化不触发重渲染——写值后 bump 本版本号驱动翻转动画)
const swBump = ref(0);
function boolOf(v) {
  void swBump.value; // 建立渲染依赖
  return v === true || v === 1 || v === '1' || v === 'true' || v === '是'
}

const info = ref(null); // 表头 data（getFormDescriptor.data）
const detailDef = ref(null); // detail 定义（tabs）
const rows = ref([]);
const selRows = ref([]);
const saving = ref(false);
const refCache = ref({}); // refPanel -> 选项行数组

const tab = computed(() => (detailDef.value?.tabs || [])[0] || null);
const fields = computed(() => (tab.value?.fields || []).filter((f) => !f.hidden));
const headCodeField = computed(() => (tab.value?.fields || []).some((f) => f.dataName === '工艺路线编码') ? '工艺路线编码' : '编号');
const headNameField = computed(() => (tab.value?.fields || []).some((f) => f.dataName === '工艺路线名称') ? '工艺路线名称' : '编号');
const editable = computed(() => !info.value || info.value['单据状态'] === '草稿' || info.value['单据状态'] === '启用' || info.value['单据状态'] === '停用');
const title = computed(() => {
  const no = props.row ? props.row['编号'] : '';
  return '明细维护' + (no ? ' - ' + no : '')
});

watch(
  () => [props.modelValue, props.row],
  () => {
    if (props.modelValue && props.row) load();
  },
  { immediate: true }
);

async function load() {
  const no = props.row?.['编号'];
  if (!no) return
  info.value = null;
  detailDef.value = null;
  rows.value = [];
  refCache.value = {};
  try {
    const res = await engine.getFormDescriptor({ panelCode: props.panelCode, code: no });
    info.value = res.data || {};
    detailDef.value = res.detail || null;
    const dd = res.detailData || {};
    const key = tab.value?.key;
    rows.value = (key && Array.isArray(dd[key]) ? dd[key] : []).map((r) => ({ ...r }));
    for (const f of fields.value) if (f.dataType === '参照') await ensureRef(f);
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '明细加载失败');
  }
}

// ---------- 参照 ----------
function refPanelOf(f) {
  return f.refPanel || (f.ref && f.ref.panel) || ''
}
function refValOf(f) {
  return f.refField || (f.ref && f.ref.field) || f.dataName
}
function refDispOf(f) {
  return f.displayField || (f.ref && f.ref.display) || f.dataName
}
async function ensureRef(f) {
  const panel = refPanelOf(f);
  if (!panel || refCache.value[panel]) return
  try {
    refCache.value[panel] = await engine.queryRefRows(f, { keyword: '' });
  } catch {
    refCache.value[panel] = [];
  }
}
function refOptions(f) {
  return refCache.value[refPanelOf(f)] || []
}
function onRefChange(f, row) {
  const panel = refPanelOf(f);
  const val = row[f.dataName];
  if (!panel || val === undefined || val === null || val === '') return
  const target = (refCache.value[panel] || []).find((r) => r[refValOf(f)] === val);
  if (!target) return
  const maps = f.refMap || (f.ref && f.ref.map) || [];
  for (const m of maps) {
    if (!m) continue
    if (target[m.from] !== undefined && m.to !== f.dataName) row[m.to] = target[m.from];
  }
}

// ---------- 行维护 ----------
function addRow() {
  const base = {};
  for (const f of fields.value) {
    if (f.dataType === '是否') base[f.dataName] = false;
    else if (f.dataType === '小数') base[f.dataName] = 0;
    else if (f.dataType === '整数') base[f.dataName] = rows.value.length + 1;
    else if (f.dataType === '下拉框') base[f.dataName] = f.defaultValue ?? (f.options?.[0]?.value ?? f.options?.[0] ?? '');
    else base[f.dataName] = f.defaultValue ?? '';
  }
  if (fields.value.some((f) => f.dataName === '加工顺序')) base['加工顺序'] = rows.value.length + 1;
  rows.value.push(base);
}
function delRows() {
  const keep = new Set(selRows.value);
  rows.value = rows.value.filter((r) => !keep.has(r));
  selRows.value = [];
}

// ---------- 保存 ----------
async function save() {
  if (!tab.value) return
  saving.value = true;
  try {
    const detail = { [tab.value.key]: rows.value.map((r) => ({ ...r })) };
    await engine.callButton({
      panelCode: props.panelCode,
      buttonName: '保存',
      formData: { ...info.value, detail },
      buttonParam: { code: info.value['编号'] },
    });
    ElMessage.success('保存成功');
    emit('saved');
    close();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '保存失败');
  } finally {
    saving.value = false;
  }
}

function close() {
  emit('update:modelValue', false);
}

return (_ctx, _cache) => {
  const _component_el_button = ElButton;
  const _component_el_table_column = ElTableColumn;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_switch = ElSwitch;
  const _component_el_input_number = ElInputNumber;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_input = ElInput;
  const _component_el_table = ElTable;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: title.value,
    width: "1180px",
    "append-to-body": "",
    "onUpdate:modelValue": close
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, { onClick: close }, {
        default: withCtx(() => [...(_cache[3] || (_cache[3] = [
          createTextVNode("取消", -1)
        ]))]),
        _: 1
      }),
      createVNode(_component_el_button, {
        type: "primary",
        disabled: !editable.value || saving.value,
        onClick: save
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(saving.value ? '保存中…' : '保存'), 1)
        ]),
        _: 1
      }, 8, ["disabled"])
    ]),
    default: withCtx(() => [
      (info.value)
        ? (openBlock(), createElementBlock("div", _hoisted_1$1, [
            createBaseVNode("span", _hoisted_2$1, toDisplayString(info.value[headCodeField.value] || ''), 1),
            createBaseVNode("span", _hoisted_3$1, toDisplayString(info.value[headNameField.value] || ''), 1),
            createBaseVNode("span", {
              class: normalizeClass(["mm-status", info.value['单据状态']])
            }, toDisplayString(info.value['单据状态'] || ''), 3),
            (!editable.value)
              ? (openBlock(), createElementBlock("span", _hoisted_4$1, "已审核/生效单据需弃审后维护"))
              : createCommentVNode("", true)
          ]))
        : createCommentVNode("", true),
      createBaseVNode("div", _hoisted_5$1, [
        createVNode(_component_el_button, {
          size: "small",
          type: "primary",
          disabled: !editable.value,
          onClick: addRow
        }, {
          default: withCtx(() => [...(_cache[1] || (_cache[1] = [
            createTextVNode("新增数据", -1)
          ]))]),
          _: 1
        }, 8, ["disabled"]),
        createVNode(_component_el_button, {
          size: "small",
          disabled: !editable.value || !selRows.value.length,
          onClick: delRows
        }, {
          default: withCtx(() => [...(_cache[2] || (_cache[2] = [
            createTextVNode("删除选中", -1)
          ]))]),
          _: 1
        }, 8, ["disabled"]),
        createBaseVNode("span", _hoisted_6$1, "共 " + toDisplayString(rows.value.length) + " 行", 1)
      ]),
      createVNode(_component_el_table, {
        data: rows.value,
        size: "small",
        border: "",
        height: "380",
        onSelectionChange: _cache[0] || (_cache[0] = (r) => (selRows.value = r))
      }, {
        default: withCtx(() => [
          createVNode(_component_el_table_column, {
            type: "selection",
            width: "40",
            selectable: () => editable.value
          }, null, 8, ["selectable"]),
          createVNode(_component_el_table_column, {
            type: "index",
            label: "序号",
            width: "55",
            align: "center",
            index: (i) => i + 1
          }, null, 8, ["index"]),
          (openBlock(true), createElementBlock(Fragment, null, renderList(fields.value, (f) => {
            return (openBlock(), createBlock(_component_el_table_column, {
              key: f.dataName,
              label: f.dataName,
              "min-width": "110"
            }, {
              default: withCtx(({ row }) => [
                (f.dataType === '参照')
                  ? (openBlock(), createBlock(_component_el_select, {
                      key: 0,
                      modelValue: row[f.dataName],
                      "onUpdate:modelValue": $event => ((row[f.dataName]) = $event),
                      filterable: "",
                      size: "small",
                      disabled: !editable.value,
                      style: {"width":"100%"},
                      placeholder: "选择",
                      onChange: $event => (onRefChange(f, row))
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(refOptions(f), (o) => {
                          return (openBlock(), createBlock(_component_el_option, {
                            key: o[refValOf(f)],
                            label: o[refValOf(f)] + ' ' + (o[refDispOf(f)] || ''),
                            value: o[refValOf(f)]
                          }, null, 8, ["label", "value"]))
                        }), 128))
                      ]),
                      _: 2
                    }, 1032, ["modelValue", "onUpdate:modelValue", "disabled", "onChange"]))
                  : (f.dataType === '下拉框')
                    ? (openBlock(), createBlock(_component_el_select, {
                        key: 1,
                        modelValue: row[f.dataName],
                        "onUpdate:modelValue": $event => ((row[f.dataName]) = $event),
                        filterable: "",
                        "allow-create": "",
                        size: "small",
                        disabled: !editable.value,
                        style: {"width":"100%"}
                      }, {
                        default: withCtx(() => [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(f.options || [], (o) => {
                            return (openBlock(), createBlock(_component_el_option, {
                              key: o.label ?? o,
                              label: o.label ?? o,
                              value: o.value ?? o
                            }, null, 8, ["label", "value"]))
                          }), 128))
                        ]),
                        _: 2
                      }, 1032, ["modelValue", "onUpdate:modelValue", "disabled"]))
                    : (f.dataType === '是否')
                      ? (openBlock(), createBlock(_component_el_switch, {
                          key: 2,
                          "model-value": boolOf(row[f.dataName]),
                          disabled: !editable.value,
                          onChange: (v) => { row[f.dataName] = v; swBump.value++; }
                        }, null, 8, ["model-value", "disabled", "onChange"]))
                      : (f.dataType === '小数' || f.dataType === '整数')
                        ? (openBlock(), createBlock(_component_el_input_number, {
                            key: 3,
                            modelValue: row[f.dataName],
                            "onUpdate:modelValue": $event => ((row[f.dataName]) = $event),
                            controls: false,
                            size: "small",
                            disabled: !editable.value,
                            style: {"width":"100%"}
                          }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                        : (f.dataType === '日期')
                          ? (openBlock(), createBlock(_component_el_date_picker, {
                              key: 4,
                              modelValue: row[f.dataName],
                              "onUpdate:modelValue": $event => ((row[f.dataName]) = $event),
                              type: "date",
                              "value-format": "YYYY-MM-DD",
                              size: "small",
                              disabled: !editable.value,
                              style: {"width":"100%"}
                            }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                          : (openBlock(), createBlock(_component_el_input, {
                              key: 5,
                              modelValue: row[f.dataName],
                              "onUpdate:modelValue": $event => ((row[f.dataName]) = $event),
                              size: "small",
                              disabled: !editable.value
                            }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
              ]),
              _: 2
            }, 1032, ["label"]))
          }), 128))
        ]),
        _: 1
      }, 8, ["data"])
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const DetailMaintainDialog = /*#__PURE__*/_export_sfc(_sfc_main$1, [['__scopeId',"data-v-6ef8d0cb"]]);

/* unplugin-vue-components disabled */

const _hoisted_1 = {
  key: 0,
  class: "tools"
};
const _hoisted_2 = ["title"];
const _hoisted_3 = ["onClick"];
const _hoisted_4 = { class: "act-name" };
const _hoisted_5 = ["onClick"];
const _hoisted_6 = {
  key: 1,
  class: "tb-menu"
};
const _hoisted_7 = ["onClick"];
const _hoisted_8 = ["title"];
const _hoisted_9 = { class: "act-name" };
const _hoisted_10 = { class: "tools-right" };
const _hoisted_11 = { class: "doc-chip" };
const _hoisted_12 = { class: "report-count" };
const _hoisted_13 = ["title"];
const _hoisted_14 = ["title"];
const _hoisted_15 = { class: "page-no" };
const _hoisted_16 = ["title"];
const _hoisted_17 = ["title"];
const _hoisted_18 = { class: "doc-chip" };
const _hoisted_19 = ["title"];
const _hoisted_20 = {
  key: 1,
  class: "doc-cat"
};
const _hoisted_21 = ["title"];
const _hoisted_22 = ["title"];
const _hoisted_23 = { class: "page-no" };
const _hoisted_24 = ["title"];
const _hoisted_25 = ["title"];
const _hoisted_26 = {
  key: 1,
  class: "fields udl-fields"
};
const _hoisted_27 = {
  key: 0,
  class: "query-ref-select"
};
const _hoisted_28 = {
  key: 1,
  class: "query-ref"
};
const _hoisted_29 = {
  key: 2,
  class: "approval-layout"
};
const _hoisted_30 = { key: 0 };
const _hoisted_31 = { class: "as-side-toggle" };
const _hoisted_32 = { class: "as-side-status-row" };
const _hoisted_33 = ["title"];
const _hoisted_34 = {
  key: 1,
  class: "doc-status none"
};
const _hoisted_35 = { class: "as-side-pager" };
const _hoisted_36 = ["title"];
const _hoisted_37 = ["title"];
const _hoisted_38 = { class: "page-no" };
const _hoisted_39 = ["title"];
const _hoisted_40 = ["title"];
const _hoisted_41 = {
  key: 0,
  class: "fuzzy-panel"
};
const _hoisted_42 = { class: "fuzzy-head" };
const _hoisted_43 = ["title"];
const _hoisted_44 = ["title", "onClick"];
const _hoisted_45 = { class: "fuzzy-btns" };
const _hoisted_46 = {
  key: 0,
  class: "fuzzy-result"
};
const _hoisted_47 = { class: "fuzzy-result-head" };
const _hoisted_48 = { key: 0 };
const _hoisted_49 = ["onClick"];
const _hoisted_50 = { class: "fz-no" };
const _hoisted_51 = { class: "fz-meta" };
const _hoisted_52 = {
  key: 0,
  class: "fuzzy-empty"
};
const _hoisted_53 = {
  key: 1,
  class: "fuzzy-panel"
};
const _hoisted_54 = { class: "fuzzy-head" };
const _hoisted_55 = ["title"];
const _hoisted_56 = { class: "preview-cards" };
const _hoisted_57 = ["onClick"];
const _hoisted_58 = { class: "pc-head" };
const _hoisted_59 = { class: "pc-no" };
const _hoisted_60 = { class: "pc-date" };
const _hoisted_61 = { class: "pc-label" };
const _hoisted_62 = { class: "pc-value" };
const _hoisted_63 = {
  key: 0,
  class: "pc-none"
};
const _hoisted_64 = {
  key: 0,
  class: "fuzzy-empty"
};
const _hoisted_65 = {
  key: 2,
  class: "as-side-btns"
};
const _hoisted_66 = { class: "as-side-section" };
const _hoisted_67 = { class: "as-side-section" };
const _hoisted_68 = {
  key: 0,
  class: "as-side-del danger"
};
const _hoisted_69 = { class: "as-side-btn-row" };
const _hoisted_70 = ["title"];
const _hoisted_71 = {
  key: 1,
  style: {"font-size":"12px","color":"#e6a23c","line-height":"1.7","padding":"2px 0 6px","border-bottom":"1px dashed #dcdfe6","margin-bottom":"4px"}
};
const _hoisted_72 = { key: 0 };
const _hoisted_73 = { key: 1 };
const _hoisted_74 = {
  key: 2,
  style: {"font-size":"12px","color":"#606266","line-height":"1.7","padding":"2px 0 6px","border-bottom":"1px dashed #dcdfe6","margin-bottom":"4px"}
};
const _hoisted_75 = { key: 0 };
const _hoisted_76 = {
  key: 5,
  class: "as-side-del"
};
const _hoisted_77 = { class: "as-side-btn-row" };
const _hoisted_78 = ["title"];
const _hoisted_79 = { class: "as-side-section" };
const _hoisted_80 = ["title"];
const _hoisted_81 = ["title"];
const _hoisted_82 = ["title"];
const _hoisted_83 = ["onClick"];
const _hoisted_84 = ["onClick"];
const _hoisted_85 = {
  key: 3,
  class: "report-body"
};
const _hoisted_86 = { class: "report-heading" };
const _hoisted_87 = { class: "report-col-container" };
const _hoisted_88 = { class: "report-col-title" };
const _hoisted_89 = ["title", "onClick"];
const _hoisted_90 = ["onClick"];
const _hoisted_91 = ["title", "onClick"];
const _hoisted_92 = { key: 1 };
const _hoisted_93 = { class: "report-col-container" };
const _hoisted_94 = { class: "report-col-title" };
const _hoisted_95 = ["title", "onClick"];
const _hoisted_96 = ["onClick"];
const _hoisted_97 = { class: "doc-rail-main" };
const _hoisted_98 = ["title"];
const _hoisted_99 = {
  key: 0,
  class: "query-ref-select"
};
const _hoisted_100 = {
  key: 1,
  class: "query-ref"
};
const _hoisted_101 = {
  key: 2,
  class: "query-ref"
};
const _hoisted_102 = ["title"];
const _hoisted_103 = ["title"];
const _hoisted_104 = { class: "bsl-tag" };
const _hoisted_105 = {
  key: 0,
  class: "bsl-pending"
};
const _hoisted_106 = { class: "batch-pop-body" };
const _hoisted_107 = {
  key: 0,
  class: "bpb-void"
};
const _hoisted_108 = { key: 1 };
const _hoisted_109 = {
  key: 0,
  class: "attach-strip"
};
const _hoisted_110 = { class: "attach-strip-label" };
const _hoisted_111 = { class: "attach-slot" };
const _hoisted_112 = {
  key: 1,
  class: "doc-print",
  "aria-hidden": "true"
};
const _hoisted_113 = { class: "dp-title" };
const _hoisted_114 = { class: "dp-head" };
const _hoisted_115 = { class: "dp-label" };
const _hoisted_116 = { class: "dp-value" };
const _hoisted_117 = { class: "dp-table" };
const _hoisted_118 = {
  key: 0,
  class: "main-grid"
};
const _hoisted_119 = { class: "dt-head" };
const _hoisted_120 = { class: "dt-tab on" };
const _hoisted_121 = { class: "dt-ics" };
const _hoisted_122 = ["title"];
const _hoisted_123 = ["onClick"];
const _hoisted_124 = ["title", "onClick"];
const _hoisted_125 = ["onClick", "title"];
const _hoisted_126 = {
  key: 0,
  class: "approved-stamp"
};
const _hoisted_127 = { class: "dt-head" };
const _hoisted_128 = ["onClick"];
const _hoisted_129 = {
  key: 0,
  class: "filter-hint"
};
const _hoisted_130 = { class: "dt-ics" };
const _hoisted_131 = ["onClick"];
const _hoisted_132 = {
  key: 1,
  class: "arch-pager"
};
const _hoisted_133 = ["onClick"];
const _hoisted_134 = ["title", "onClick"];
const _hoisted_135 = ["onClick", "title"];
const _hoisted_136 = {
  key: 0,
  class: "inline-computed-value"
};
const _hoisted_137 = ["title"];
const _hoisted_138 = {
  key: 2,
  class: "line-toggle-cell"
};
const _hoisted_139 = ["title", "onClick"];
const _hoisted_140 = ["onClick"];
const _hoisted_141 = { key: 1 };
const _hoisted_142 = {
  key: 3,
  class: "footer"
};
const _hoisted_143 = { class: "remark" };
const _hoisted_144 = { class: "audit-line" };
const _hoisted_145 = {
  key: 5,
  class: "qc-insp-wrap"
};
const _hoisted_146 = ["onClick"];
const _hoisted_147 = { class: "dict-pick-list" };
const _hoisted_148 = ["onClick"];
const _hoisted_149 = { class: "query-plan-bar" };
const _hoisted_150 = { class: "plan-label" };
const _hoisted_151 = { class: "plan-option-name" };
const _hoisted_152 = { class: "plan-option-meta" };
const _hoisted_153 = { class: "query-dialog-fields" };
const _hoisted_154 = {
  key: 0,
  class: "query-dialog-field"
};
const _hoisted_155 = { class: "req-label" };
const _hoisted_156 = {
  key: 1,
  class: "query-dialog-field"
};
const _hoisted_157 = {
  key: 0,
  class: "req-star"
};
const _hoisted_158 = {
  key: 1,
  class: "query-ref"
};
const _hoisted_159 = {
  key: 7,
  class: "query-field-hint"
};
const _hoisted_160 = {
  key: 0,
  class: "adv-filter-section"
};
const _hoisted_161 = { class: "adv-filter-head" };
const _hoisted_162 = { class: "adv-filter-title" };
const _hoisted_163 = { class: "adv-filter-dim" };
const _hoisted_164 = { class: "adv-range-row" };
const _hoisted_165 = { class: "adv-filter-section" };
const _hoisted_166 = { class: "adv-filter-head" };
const _hoisted_167 = { class: "adv-filter-title" };
const _hoisted_168 = {
  key: 1,
  class: "adv-value adv-no-value"
};
const _hoisted_169 = {
  key: 0,
  class: "plan-empty"
};
const _hoisted_170 = { class: "plan-info" };
const _hoisted_171 = { class: "plan-name" };
const _hoisted_172 = { class: "plan-meta" };
const _hoisted_173 = { class: "plan-ops" };
const _hoisted_174 = {
  key: 0,
  class: "mod-log-empty"
};
const _hoisted_175 = { class: "ds-jump" };
const _hoisted_176 = { class: "ds-viewbar" };
const _hoisted_177 = {
  key: 0,
  class: "ds-switch"
};
const _hoisted_178 = ["onClick"];
const _hoisted_179 = { class: "ds-doc-wrap" };
const _hoisted_180 = {
  key: 2,
  class: "mod-log-empty"
};
const _hoisted_181 = { class: "efmt-list" };
const _hoisted_182 = { class: "efmt-txt" };
const _hoisted_183 = { class: "efmt-name" };
const _hoisted_184 = { class: "efmt-desc" };
const _hoisted_185 = { class: "efmt-txt" };
const _hoisted_186 = { class: "efmt-name" };
const _hoisted_187 = { class: "efmt-desc" };
const _hoisted_188 = {
  key: 0,
  class: "rpt-tpl-row"
};
const _hoisted_189 = { class: "rpt-tpl-label" };
const _hoisted_190 = {
  key: 1,
  class: "rpt-tpl-empty"
};
const _hoisted_191 = { class: "efmt-list" };
const _hoisted_192 = { class: "efmt-txt" };
const _hoisted_193 = { class: "efmt-name" };
const _hoisted_194 = { class: "efmt-desc" };
const _hoisted_195 = { class: "efmt-txt" };
const _hoisted_196 = { class: "efmt-name" };
const _hoisted_197 = { class: "efmt-desc" };
const _hoisted_198 = { class: "efmt-txt" };
const _hoisted_199 = { class: "efmt-name" };
const _hoisted_200 = { class: "efmt-desc" };
const _hoisted_201 = { class: "rpt-mg-toolbar" };
const _hoisted_202 = { class: "rpt-mg-tip" };
const _hoisted_203 = { class: "rpt-up-row" };
const _hoisted_204 = { class: "rpt-up-label" };
const _hoisted_205 = { class: "rpt-up-row" };
const _hoisted_206 = { class: "rpt-up-label" };
const _hoisted_207 = { class: "rpt-up-row" };
const _hoisted_208 = { class: "rpt-up-label" };
const _hoisted_209 = { class: "rpt-up-row" };
const _hoisted_210 = { class: "rpt-up-label" };
const _hoisted_211 = { class: "rpt-up-row" };
const _hoisted_212 = { class: "rpt-up-label" };
const _hoisted_213 = {
  key: 0,
  class: "mod-log-empty"
};
const _hoisted_214 = {
  key: 1,
  class: "mod-log-list"
};
const _hoisted_215 = {
  key: 0,
  class: "mod-log-open"
};
const _hoisted_216 = { class: "mod-log-head" };
const _hoisted_217 = { class: "mod-log-seq" };
const _hoisted_218 = {
  key: 1,
  class: "mod-log-reason"
};
const _hoisted_219 = {
  key: 2,
  class: "mod-log-table"
};
const _hoisted_220 = { style: {"width":"70px"} };
const _hoisted_221 = { style: {"width":"140px"} };
const _hoisted_222 = { class: "mod-old" };
const _hoisted_223 = { class: "mod-new" };
const _hoisted_224 = {
  key: 3,
  class: "mod-log-nodata"
};
const _hoisted_225 = {
  key: 4,
  class: "mod-log-meta"
};
const _hoisted_226 = { key: 0 };
const _hoisted_227 = { key: 1 };
const _hoisted_228 = { class: "dq-form" };
const _hoisted_229 = {
  class: "dq-row",
  style: {"margin-bottom":"6px"}
};
const _hoisted_230 = { class: "dq-label" };
const _hoisted_231 = {
  key: 0,
  class: "mod-log-meta",
  style: {"margin-bottom":"8px"}
};
const _hoisted_232 = {
  key: 1,
  class: "mod-log-table",
  style: {"margin-bottom":"10px"}
};
const _hoisted_233 = { style: {"width":"70px"} };
const _hoisted_234 = { class: "dq-label" };
const _hoisted_235 = ["onClick"];
const _hoisted_236 = {
  key: 3,
  class: "mod-log-meta"
};
const _hoisted_237 = { class: "dq-form" };
const _hoisted_238 = {
  class: "mod-log-meta",
  style: {"margin-bottom":"8px"}
};
const _hoisted_239 = {
  class: "dq-label",
  style: {"width":"130px"}
};
const _hoisted_240 = { class: "mod-log-meta" };
const _hoisted_241 = { class: "dq-form" };
const _hoisted_242 = {
  class: "mod-log-meta",
  style: {"margin-bottom":"8px"}
};
const _hoisted_243 = {
  class: "dq-row",
  style: {"align-items":"center"}
};
const _hoisted_244 = { class: "dq-label" };
const _hoisted_245 = {
  class: "dq-row",
  style: {"align-items":"flex-start"}
};
const _hoisted_246 = { class: "dq-label" };
const _hoisted_247 = { class: "dq-form" };
const _hoisted_248 = {
  class: "mod-log-meta",
  style: {"margin-bottom":"8px"}
};
const _hoisted_249 = {
  class: "dq-row",
  style: {"align-items":"center"}
};
const _hoisted_250 = { class: "dq-label" };
const _hoisted_251 = {
  class: "dq-row",
  style: {"align-items":"flex-start"}
};
const _hoisted_252 = { class: "dq-label" };
const _hoisted_253 = { class: "dq-form" };
const _hoisted_254 = { class: "dq-row" };
const _hoisted_255 = { class: "dq-label" };
const _hoisted_256 = { class: "dq-row" };
const _hoisted_257 = { class: "dq-label" };
const _hoisted_258 = { class: "dq-tip" };
const _hoisted_259 = {
  key: 1,
  class: "dq-tip"
};
const _hoisted_260 = { class: "dq-form" };
const _hoisted_261 = { class: "dq-row" };
const _hoisted_262 = { class: "dq-label" };
const _hoisted_263 = { class: "dq-row" };
const _hoisted_264 = { class: "dq-label" };
const _hoisted_265 = { class: "dq-row" };
const _hoisted_266 = { class: "dq-label" };
const _hoisted_267 = { class: "dq-row" };
const _hoisted_268 = { class: "dq-label" };
const _hoisted_269 = { class: "dq-row" };
const _hoisted_270 = { class: "dq-label" };
const _hoisted_271 = { class: "dq-row" };
const _hoisted_272 = { class: "dq-label" };
const _hoisted_273 = { class: "mo-sch-row" };
const _hoisted_274 = { class: "mo-sch-row" };
const _hoisted_275 = { class: "mo-sch-row" };
const _hoisted_276 = { class: "mo-sch-row" };
const _hoisted_277 = { class: "mo-sch-row" };
const _hoisted_278 = { class: "col-pref-tip" };
const _hoisted_279 = { class: "col-pref-count" };
const _hoisted_280 = { class: "col-pref-list" };
const _hoisted_281 = ["onDragstart", "onDrop"];
const _hoisted_282 = { class: "cp-order" };
const _hoisted_283 = { class: "cp-label" };
const _hoisted_284 = { class: "col-pref-tip" };
const _hoisted_285 = { class: "col-pref-tip" };
const _hoisted_286 = { class: "col-pref-count" };
const _hoisted_287 = { class: "col-pref-list" };
const _hoisted_288 = ["onDragstart", "onDrop"];
const _hoisted_289 = ["title"];
const _hoisted_290 = { class: "cp-order" };
const _hoisted_291 = { class: "cp-label" };
const _hoisted_292 = { class: "filter-panel-header" };
const _hoisted_293 = { class: "filter-panel-body" };
const _hoisted_294 = { class: "filter-panel-text" };
const _hoisted_295 = { class: "filter-panel-footer" };

const REF_DROPDOWN_THRESHOLD = 20;

const RAIL_PAGE_SIZE = 50;
const BATCH_SUMMARY_TARGET = 'QC_RECV';
const MIN_ROWS = 5;
const ROW_H = 31;
const HEAD_H = 32;
const FOOT_H = 32;

const ARCH_FIT_MAX_COLS = 16;
const GRADE_PANEL = 'RD_APPROVAL';
const FRESH_DRAFT_KEY = 'mes_fresh_draft';

const _sfc_main = {
  __name: 'PanelxList',
  setup(__props) {

const engine = usePanelRuntime();
const route = useRoute();
const router = useRouter();
const tabs = useTabsStore();
const user = useUserStore();
const localeStore = useLocaleStore();

// 语言热切换:仅重拉面板配置(字段标签/面板名/列别名随 Accept-Language 更新),
// 不重拉数据——分页、滚动、弹窗、筛选、展开状态全部保留。
watch(() => localeStore.locale, async () => {
  if (!panelCode.value || invalidPanel.value) return
  try {
    cfgCache.value = null;
    await loadCrg();
  } catch { /* 配置重拉失败保持现状 */ }
});

const panelCode = computed(() => route.params.panelCode);
const operationName = computed(() => route.meta.operationName || route.query.operationName || '新增流程');
const invalidPanel = computed(() => !panelCode.value || panelCode.value === 'undefined');

// 立项申请表/项目实施计划/项目进度查询/数据记录表(功能性滤效+其余7张)+实验室使用记录表4张:文件类文书式特例面板
const RECORD_SHEET_PANELS = Object.keys(recordSheetConfigs);
const isApprovalDoc = computed(() => ['RD_APPROVAL', 'RD_PLAN', 'RD_PROGRESS', 'RD_PROD_DOCLIST', 'RD_FILTER_EFF', 'QC_CATALOG', 'QC_INSP_REC', ...RECORD_SHEET_PANELS, ...Object.keys(qcSheetCfgs)].includes(String(panelCode.value)));
const isRecordSheetPanel = computed(() => RECORD_SHEET_PANELS.includes(String(panelCode.value)));
/**
 * 产品文件列表(RD_PROD_DOCLIST)= **单单据 + 矩阵**面板:库里只有 1 张单据(PDL-0001),
 * 真正的内容是表格里的**产品行**(产品编号 × 4 个文件 × 状态)。
 * ⇒ 侧栏的「查询产品 / 模糊搜索 / 产品预览」三处在这面板一律改为**筛矩阵行**
 *   (2026-09-30 用户口径:原先对那 1 张单据做文档查询,用户看到的就是"搜索不可用")。
 */
const isProdDocMatrix = computed(() => String(panelCode.value) === 'RD_PROD_DOCLIST');
// 来料检验要求(品质资料 7 表):档案式特例面板——工具栏/单据卡片/明细表格/页脚全隐,QcInspReqSheet 整体接管
const isQcInspReq = computed(() => isQcInspReqPanel(panelCode.value));
/** 产品变更申请单:当前账号可填的纸面部门行(后端按 yj_user.dept_id → yj_change_dept 算,metadata 下发)。
 *  仅 RD_CHANGE 有该键;其它面板拿到空数组也无害(没有 lockKey 的表根本不看它)。 */
const changeDeptRows = computed(() => cfgCache.value?.metadata?.changeDepts || []);

// ── 产品变更申请单:会签按钮组的身份判据(2026-09-21)──
// 会签人 = 头字段「会签人」里的账号(顿号/逗号分隔);发起人 = 纸面「申请人」= 当前用户姓名。
// 两者只决定**按钮显不显示**:服务端 ButtonService.requireSigner / requireChangeInitiator 才是门禁。
const isChangePanel = computed(() => String(panelCode.value) === 'RD_CHANGE');
const changeSigners = computed(() => String(cur.value?.['会签人'] ?? '')
  .split(/[,，、;；\s]+/).map((s) => s.trim()).filter(Boolean));
const iAmChangeSigner = computed(() => changeSigners.value.includes(String(user.account || user.userName || '')));
const isChangeInitiator = computed(() => user.isAdmin === true
  || (!!user.realName && String(cur.value?.['申请人'] ?? '') === String(user.realName)));
const docSheetConfig = computed(() => qcSheetCfgs[panelCode.value] || (panelCode.value === 'RD_PLAN' ? planSheetCfg : approvalSheetCfg));

const query = reactive({ keyword: '', pageNo: 1, pageSize: 20 });
const condition = reactive({});
const list = ref([]);
const total = ref(0);
const loading = ref(false);
const current = ref(null);
const queryFields = ref([]);
const gridTabs = ref([]);
const groups = ref([]);
const panelName = ref('');
const cfgCache = ref(null);
const queryRefVisible = ref(false);
const queryRefField = ref(null);
const queryRefContext = ref('page');
const queryDialogVisible = ref(false);
const queryDraft = reactive({});
const headerRefVisible = ref(false);
const headerRefField = ref(null);
const detailRefVisible = ref(false);
const detailRefPick = ref(null);
const detailRefSaving = ref(false);
const inlineSaving = ref(false);
// ---- 列头点击筛选(所有表格) ----
const colFilterText = reactive({});   // { [colProp]: 'filter text' }
const filterColProp = ref(null);      // 当前打开筛选输入的列 prop

function toggleColFilter(prop) {
  if (filterColProp.value === prop) {
    filterColProp.value = null;
  } else {
    filterColProp.value = prop;
    if (colFilterText[prop] === undefined) colFilterText[prop] = '';
  }
}

function clearColFilter(prop) {
  colFilterText[prop] = '';
  filterColProp.value = null;
}

function hasColFilter(prop) {
  return !!(colFilterText[prop] && String(colFilterText[prop]).trim())
}

/** 对行数组应用列筛选 */
function applyColFilters(rows, cols) {
  let out = rows;
  for (const c of cols) {
    const kw = colFilterText[c.prop];
    if (kw && String(kw).trim()) {
      const k = String(kw).toLowerCase();
      out = out.filter((row) => String(row[c.prop] ?? '').toLowerCase().includes(k));
    }
  }
  return out
}

// ---- 高级筛选(查询弹窗):字段 + 匹配运算符 + 值,前端过滤主表/明细行 ----
const ADV_OPS = [
  { value: 'contains', label: '包含' },
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'ge', label: '大于等于' },
  { value: 'le', label: '小于等于' },
  { value: 'empty', label: '为空' },
  { value: 'notEmpty', label: '不为空' },
];
const advFilters = ref([]);
// 日期范围(2026-09-24 用户要求,对齐旧系统列表查询区):起/止 → 自动展开为 日期字段 ge/le 两条高级筛选,
// 随查询一起服务端过滤(单据/报表/档案面板皆可);不入 advFilters 可见行,避免出现"凭空多出的条件行"。
const dateFrom = ref('');
const dateTo = ref('');
/** 面板主日期字段:优先「单据日期」,否则取首个日期型查询字段 */
const dateFieldLabel = computed(() => {
  const qs = queryFields.value || [];
  const byName = qs.find((f) => ['单据日期', '日期'].includes(headerFieldKey(f)));
  if (byName) return headerFieldKey(byName)
  const anyDate = qs.find((f) => String(f.dataType || f.type || '').includes('日期'));
  return anyDate ? headerFieldKey(anyDate) : ''
});
const dateAdvFilters = computed(() => {
  const lf = dateFieldLabel.value;
  const out = [];
  if (lf && dateFrom.value) out.push({ field: lf, op: 'ge', value: dateFrom.value });
  if (lf && dateTo.value) out.push({ field: lf, op: 'le', value: dateTo.value });
  return out
});
/** 生效条件 = 高级筛选行 + 日期范围展开行 */
const effectiveAdvFilters = computed(() => [...advFilters.value, ...dateAdvFilters.value]);
function clearDateRange() { dateFrom.value = ''; dateTo.value = ''; }

/** 可筛选字段:表头 + 查询字段 + 明细各页签字段(中文键去重,选项显示译名)。 */
const advFilterFields = computed(() => {
  const seen = new Set();
  const out = [];
  const push = (label) => { if (label && !seen.has(label)) { seen.add(label); out.push(label); } };
  queryFields.value.forEach((f) => push(headerFieldKey(f)));
  headerEditFields.value.forEach((f) => push(headerFieldKey(f)))
  ;(cfgCache.value?.detail?.tabs || []).forEach((t) => (t.fields || []).forEach((f) => push(f.dataName)));
  return out
});

function addAdvFilter() {
  advFilters.value.push({ field: advFilterFields.value[0] || '', op: 'contains', value: '' });
}

function removeAdvFilter(i) {
  advFilters.value.splice(i, 1);
}

/** 单条条件匹配:数值可比较时按数值(忽略千分位),否则按字符串;包含不区分大小写。 */
function advMatch(row, f) {
  const str = row[f.field] === undefined || row[f.field] === null ? '' : String(row[f.field]).trim();
  const val = String(f.value ?? '').trim();
  if (f.op === 'empty') return str === ''
  if (f.op === 'notEmpty') return str !== ''
  if (!val) return true
  if (f.op === 'contains') return str.toLowerCase().includes(val.toLowerCase())
  if (f.op === 'eq') return str === val
  if (f.op === 'ne') return str !== val
  const a = parseFloat(str.replace(/,/g, ''));
  const b = parseFloat(val.replace(/,/g, ''));
  const [x, y] = Number.isFinite(a) && Number.isFinite(b) ? [a, b] : [str, val];
  if (f.op === 'gt') return x > y
  if (f.op === 'lt') return x < y
  if (f.op === 'ge') return x >= y
  if (f.op === 'le') return x <= y
  return true
}

/** 应用全部有效高级筛选条件(AND 组合);空条件(未填值)不参与过滤。 */
function applyAdvFilters(rows) {
  const active = effectiveAdvFilters.value.filter((f) => f.field && (f.op === 'empty' || f.op === 'notEmpty' || String(f.value ?? '').trim() !== ''));
  if (!active.length) return rows
  return rows.filter((row) => active.every((f) => advMatch(row, f)))
}

// ---- 表格列自定义(排序/栏名/显隐) ----
const colPrefVisible = ref(false);
// 字段管理(动态字段/备用列池):仅 admin 入口可见,服务端 requireAdmin 把守写操作
const fieldMgrVisible = ref(false);
const colPrefSaving = ref(false);
const colPrefRows = ref([]);

// ── 批量转ERP ──
const batchErpVisible = ref(false);
const batchErpList = ref([]);
const batchErpSel = ref([]);
const batchErpLoading = ref(false);

async function openBatchErp() {
  try {
    const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '查询可转ERP', formData: {}, buttonParam: {} });
    batchErpList.value = (res?.list || []).map((r) => ({ ...r, result: '' }));
    batchErpSel.value = [];
    batchErpVisible.value = true;
    if (!batchErpList.value.length) ElMessage.info('暂无已审核且未转ERP的单据');
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'));
  }
}

async function doBatchErp() {
  if (!batchErpSel.value.length) return
  batchErpLoading.value = true;
  let ok = 0, skip = 0, fail = 0;
  for (const row of batchErpSel.value) {
    try {
      const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '转ERP', formData: { 编号: row.单据编号, 单据编号: row.单据编号 }, buttonParam: {} });
      if (res?.message?.includes('已转入ERP')) { row.result = 'skip'; skip++; }
      else { row.result = 'ok'; row.erpBillNo = res?.ERP单号 || ''; ok++; }
    } catch { row.result = 'fail'; fail++; }
  }
  batchErpLoading.value = false;
  ElMessage.success(`批量转ERP完成: 成功${ok} 跳过${skip} 失败${fail}`);
  await load();
}
const colDragIdx = ref(-1);

function openColPrefs() {
  const gridTab = gridTabs.value?.[0];
  const aliases = gridTab?.columnAliases || {};
  const allFields = cfgCache.value?.detail?.tabs?.[0]?.fields || [];
  const visibleCols = new Set(gridTab?.columns || []);
  colPrefRows.value = allFields.map((f) => {
    const label = f.dataName || f.name || f.code;
    return { label, alias: aliases[label] || f.displayName || '', visible: visibleCols.has(label) }
  });
  colPrefVisible.value = true;
}

function moveCol(idx, dir) {
  const rows = colPrefRows.value;
  const target = idx + dir;
  if (target < 0 || target >= rows.length) return
  const tmp = rows[idx];
  rows[idx] = rows[target];
  rows[target] = tmp;
}

function onColDrop(idx) {
  const from = colDragIdx.value;
  if (from < 0 || from === idx) return
  const rows = colPrefRows.value;
  const item = rows.splice(from, 1)[0];
  rows.splice(idx, 0, item);
  colDragIdx.value = -1;
}

async function saveColPrefs() {
  colPrefSaving.value = true;
  try {
    await engine.saveColumnPrefs({
      panelCode: panelCode.value,
      columns: colPrefRows.value.map((r) => ({ label: r.label, alias: r.alias || '', visible: !!r.visible })),
    });
    ElMessage.success('表格调整已保存');
    colPrefVisible.value = false;
    cfgCache.value = null;
    await load();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '保存失败');
  } finally {
    colPrefSaving.value = false;
  }
}

function resetColPrefs() {
  colPrefRows.value.forEach((r) => { r.alias = ''; r.visible = true; });
  ElMessage.info('已恢复默认(需保存生效)');
}

// ---- 表头字段自定义(表头调整:排序/栏名/显隐,与表格调整同款交互;显隐 hidden+visible 同开同关) ----
const headPrefVisible = ref(false);
const headPrefSaving = ref(false);
const headPrefRows = ref([]);
const headDragIdx = ref(-1);

function openHeadPrefs() {
  const fields = cfgCache.value?.dataSchema?.fields || [];
  if (!fields.length) return ElMessage.warning(tt('该面板没有可调整的表头字段'))
  headPrefRows.value = fields.map((f) => ({
    label: f.dataName || f.name || f.code,
    alias: f.displayName || '',
    visible: f.hidden !== true && f.visible !== false,
  }));
  headPrefVisible.value = true;
}

function moveHead(idx, dir) {
  const rows = headPrefRows.value;
  const target = idx + dir;
  if (target < 0 || target >= rows.length) return
  const tmp = rows[idx];
  rows[idx] = rows[target];
  rows[target] = tmp;
}

function onHeadDrop(idx) {
  const from = headDragIdx.value;
  if (from < 0 || from === idx) return
  const rows = headPrefRows.value;
  const item = rows.splice(from, 1)[0];
  rows.splice(idx, 0, item);
  headDragIdx.value = -1;
}

async function saveHeadPrefs() {
  headPrefSaving.value = true;
  try {
    await engine.saveHeaderPrefs({
      panelCode: panelCode.value,
      columns: headPrefRows.value.map((r) => ({ label: r.label, alias: r.alias || '', visible: !!r.visible })),
    });
    ElMessage.success(tt('表头调整已保存'));
    headPrefVisible.value = false;
    cfgCache.value = null;
    await load();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('保存失败'));
  } finally {
    headPrefSaving.value = false;
  }
}

function resetHeadPrefs() {
  headPrefRows.value.forEach((r) => { r.alias = ''; r.visible = true; });
  ElMessage.info(tt('已恢复默认(需保存生效)'));
}
// ---- 参照字段动态模式(≤20 下拉 / >20 弹窗):缓存计数 + 下拉选项 ----
// 数据量跨越阈值时(增删档案后)由 refreshRefModes 重新判定,模式随之切换。
const refModeMap = reactive({});      // fieldKey -> 'dialog' | 'select'
const refSelectData = reactive({});   // fieldKey -> { options: [], loading: bool }
async function checkRefMode(field, fieldKey) {
  if (refModeMap[fieldKey]) return refModeMap[fieldKey]
  refModeMap[fieldKey] = 'dialog'; // 默认弹窗,异步判定后可能切下拉
  try {
    const count = await engine.refRowCount(field);
    // 少量数据(≤20)用下拉轻快;大量数据(>20)用弹窗带搜索定位(仅表头/查询区;明细单元格恒弹窗)
    refModeMap[fieldKey] = count > REF_DROPDOWN_THRESHOLD ? 'dialog' : 'select';
    if (refModeMap[fieldKey] === 'select') await loadRefSelectOptions(field, fieldKey, '');
  } catch (e) { /* 保持弹窗 */ }
  return refModeMap[fieldKey]
}

/** 数据变化后重新判定全部参照字段模式(清空缓存计数,按最新数据量切换下拉/弹窗)。 */
async function refreshRefModes() {
  const all = [...(queryFields.value || []), ...(headerFields.value || [])].filter(isReferenceField);
  const validKeys = new Set(all.map((f) => headerFieldKey(f)));
  Object.keys(refModeMap).forEach((k) => { if (!validKeys.has(k)) delete refModeMap[k]; });
  await Promise.all(all.map((f) => {
    const key = headerFieldKey(f);
    delete refModeMap[key];
    return checkRefMode(f, key)
  }));
}

// ---- 下拉框字段双模(≤20 下拉 / >20 弹窗):options 内嵌于面板配置,按数量直接判定 ----
const dictModeMap = reactive({}); // fieldKey -> 'dialog' | 'select'

function dictModeOf(field, fieldKey) {
  if (!dictModeMap[fieldKey]) {
    dictModeMap[fieldKey] = fieldOptions(field).length > REF_DROPDOWN_THRESHOLD ? 'dialog' : 'select';
  }
  return dictModeMap[fieldKey]
}

/** 面板切换时清理上个面板的字典模式缓存(同名字段如「业务类型」在不同面板数量可能不同)。 */
function resetDictModes() {
  Object.keys(dictModeMap).forEach((k) => delete dictModeMap[k]);
}

// 字典弹窗选择(>20 条):搜索 + 列表点击回填
const dictPickVisible = ref(false);
const dictPickField = ref(null);
const dictPickKeyword = ref('');
const dictPickOptions = computed(() => {
  const field = dictPickField.value;
  if (!field) return []
  const kw = dictPickKeyword.value.trim().toLowerCase();
  const opts = fieldOptions(field);
  if (!kw) return opts
  return opts.filter((o) =>
    String(o.label).toLowerCase().includes(kw) || String(o.value).toLowerCase().includes(kw))
});

function openDictPick(field) {
  if (!draftEditable.value || headerFieldLocked(field)) return
  dictPickField.value = field;
  dictPickKeyword.value = '';
  dictPickVisible.value = true;
}

function onDictPick(option) {
  const field = dictPickField.value;
  if (field) {
    cur.value[headerFieldKey(field)] = option.value;
    markInlineDirty();
  }
  dictPickVisible.value = false;
  dictPickField.value = null;
}

function clearDictPick() {
  const field = dictPickField.value;
  if (field) {
    cur.value[headerFieldKey(field)] = '';
    markInlineDirty();
  }
  dictPickVisible.value = false;
  dictPickField.value = null;
}

async function loadRefSelectOptions(field, fieldKey, keyword) {
  if (!refSelectData[fieldKey]) refSelectData[fieldKey] = reactive({ options: [], loading: false });
  refSelectData[fieldKey].loading = true;
  try {
    refSelectData[fieldKey].options = await engine.refSelectOptions(field, keyword);
  } catch (e) {
    refSelectData[fieldKey].options = [];
  } finally {
    refSelectData[fieldKey].loading = false;
  }
}

function isRefSelect(field) {
  return isReferenceField(field) && refModeMap[headerFieldKey(field)] === 'select'
}

/** 草稿表头下拉选中带回:与表头参照弹窗同口径,按 refMap 把选中项源数据行的其他字段整串回填。
 *  allow-create 自由输入/清空时无源行,跳过映射只标记脏(不动已填字段,与弹窗取消一致)。 */
function onHeaderRefSelectChange(field, v) {
  const key = headerFieldKey(field);
  const opt = (refSelectData[key]?.options || []).find((o) => o.value === v);
  if (opt?.row) {
    applyRefCarry(cur.value, opt.row, refConfigOf(field), key);
  }
  markInlineDirty();
}

const reportMode = computed(() => cfgCache.value?.metadata?.report === true || cfgCache.value?.metadata?.panelCategory === '报表');
// ── 报表查询弹窗(T+ 同款,收发存汇总/库存台账):与「查询」按钮共用同一个弹窗 ──
// 字段:单据日期(区间控件,必填) + 仓库/存货(参照;台账必填单一仓库+单一存货,汇总选填)
// 进入态差异:①未完成过查询就关闭(✕/取消)=退出页面 ②必填项校验(applyHeaderQuery)。
const reportQueryDialog = computed(() => cfgCache.value?.metadata?.reportQueryDialog === true);
// 级联查询面板(台账/库存状况):仓库/存货走基础资料参照(WH/INV,绑定编码)+「档案∩有流水」联动收窄;
// 台账 仓库/存货 必填(单一仓库的一种存货=仓库编码+存货编码唯一);库存状况表选填(快照,无日期)
const isCascadePanel = computed(() => ['STOCK_LEDGER', 'STOCK_BALANCE'].includes(panelCode.value));
/** 查询条件只进弹窗、无内联查询区的面板(台账/汇总=强制弹窗;状况表=级联)——「查询」按钮统一开弹窗 */
const queryInDialogOnly = computed(() => reportQueryDialog.value || isCascadePanel.value);
// 报表弹窗「模糊搜索」关键字(后端 keyword 全字段 OR LIKE;进弹窗回显上次值,点查询生效)
const reportKeyword = ref('');
// 高级筛选「生效中」快照:applyHeaderQuery 定格;报表面板随查询 POST 给后端全表过滤,
// 单据/档案面板不用它(仍走 mainRows/blockRows 的前端过滤)
const activeAdvFilters = ref([]);
const rqdDone = ref(false); // 本面板本轮是否已通过弹窗查询(未过弹窗前拦截一切列表加载)
const rqdRange = ref([]);   // 单据日期区间 [开始, 结束](YYYY-MM-DD)
/** 台账:仓库/存货必填(单选一个仓库的一种存货);汇总:仅单据日期必填 */
function rqdFieldRequired(field) {
  if (!reportQueryDialog.value) return false
  if (panelCode.value === 'STOCK_LEDGER' && ['仓库', '存货'].includes(headerFieldKey(field))) return true
  return false
}
// 台账联动选项:仓库/存货下拉互相约束(选项=后端 v_stock_ledger 真实组合,按编码匹配)
// 2026-09-28 起选项为码名对 [{仓库编码,仓库}] / [{存货编码,存货}]——编码是稳定键(名称会重名/
// 改名/带尾空格),联动收窄与查询条件都绑编码(_whCode/_itemCode),名称仅弹窗回显。
// 参照随之绑定编码(ref_field=仓库编码/存货编码,display 仍显示名称,见 migrate-ledger-code-filter.sql)
const ledgerWhOptions = ref([]);    // [{code,name}] 该存货有流水的仓(或未选存货=全部有流水仓)
const ledgerItemOptions = ref([]);  // [{code,name}] 该仓有流水的存货(或未选仓库=全部有流水的存货)
const ledgerOptsLoading = ref(false);
async function loadLedgerRefOptions({ keepWh = true, keepItem = true } = {}) {
  ledgerOptsLoading.value = true;
  try {
    const res = await engine.callButton({
      panelCode: panelCode.value, buttonName: '台账联动选项',
      formData: {
        仓库编码: queryDraft['_whCode'] || '', 存货编码: queryDraft['_itemCode'] || '',
        仓库: queryDraft['仓库'] || '', 存货: queryDraft['存货'] || '',
      }, buttonParam: {},
    });
    const whPairs = (res?.仓库列表 || []).map((o) => ({ code: String(o.仓库编码 ?? '').trim(), name: String(o.仓库 ?? '').trim() }));
    const itemPairs = (res?.存货列表 || []).map((o) => ({ code: String(o.存货编码 ?? '').trim(), name: String(o.存货 ?? '').trim() }));
    ledgerWhOptions.value = whPairs;
    ledgerItemOptions.value = itemPairs;
    // 约束收紧后当前值可能不再合法:清掉无效侧(名称与编码成对清理,保持绑定一致)
    if (!keepWh && queryDraft['仓库'] && !whPairs.some((o) => o.name === queryDraft['仓库'] || o.code === queryDraft['_whCode'])) {
      delete queryDraft['仓库']; delete queryDraft['_whCode'];
    }
    if (!keepItem && queryDraft['存货'] && !itemPairs.some((o) => o.name === queryDraft['存货'] || o.code === queryDraft['_itemCode'])) {
      delete queryDraft['存货']; delete queryDraft['_itemCode'];
    }
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'));
  } finally {
    ledgerOptsLoading.value = false;
  }
}
/** 弹窗参照选中变化:台账/库存状况的「仓库」要重拉联动(存货可能因换仓失效被清)。其余参照不联动。
 *  v=仓库编码(参照绑定编码),其余参照不联动 */
async function onDialogRefSelectChange(field) {
  if (!isCascadePanel.value || headerFieldKey(field) !== '仓库') return
  // 编码随行:下拉选项携带档案行(含 仓库编码),选中即绑定编码;清空则码一起清
  const key = headerFieldKey(field);
  const opt = (refSelectData[key]?.options || []).find((o) => o.value === queryDraft[key]);
  const rowCode = opt?.row?.['仓库编码'];
  queryDraft['_whCode'] = rowCode ? String(rowCode).trim() : '';
  const hadItem = queryDraft['存货'];
  await loadLedgerRefOptions({ keepWh: true, keepItem: false });
  if (hadItem && !queryDraft['存货']) ElMessage.info(tt('该仓无此存货流水，已清空存货'));
}
/** 仓库下拉选项置灰(选了存货后):该存货无流水的仓不可选 —— 按编码比对(选项行无编码时退回名称)。
 *  选项=档案(bs_wh) ∩ 有流水;ledgerWhOptions 是 [{code,name}] 码名对 */
function ledgerOptionDisabled(field, option) {
  if (!isCascadePanel.value || headerFieldKey(field) !== '仓库') return false
  if (!queryDraft['存货']) return false
  const code = option.row?.['仓库编码'];
  if (code !== undefined && code !== null && String(code).trim() !== '') {
    return !ledgerWhOptions.value.some((o) => o.code === String(code).trim())
  }
  return !ledgerWhOptions.value.some((o) => o.name === option.label)
}
/** 弹窗字段下方的联动提示行:选仓后存货候选收窄计数 / 选存货后全仓无流水的说明 */
function dialogFieldHint(field) {
  if (!isCascadePanel.value) return ''
  const key = headerFieldKey(field);
  if (key === '存货' && queryDraft['仓库']) {
    return ledgerItemOptions.value.length
      ? `${tt('候选已按所选仓库收窄')} ${ledgerItemOptions.value.length} ${tt('项')}`
      : tt('该仓库在存货档案内无流水存货')
  }
  if (key === '仓库' && queryDraft['存货'] && !ledgerWhOptions.value.length) {
    return tt('该存货在各仓库均无流水')
  }
  return ''
}
/** 弹窗关闭:查询弹窗面板在未完成过一次查询时,关闭(✕/取消)即退出页面(对齐 T+ 报表交互) */
function onQueryDialogClose() {
  if (reportQueryDialog.value && !rqdDone.value) router.push('/dashboard');
}
// YINJIA 适配:单单据面板(基础档案)只有一张虚拟单,隐藏单据切换按钮(◁◀ 第X/Y张 ▶▷)
const singleDocMode = computed(() => cfgCache.value?.metadata?.singleDoc === true);
/** 单据面板(头行/单表单据):既非报表平表、也非档案单单据 → 高级筛选走服务端(2026-09-24) */
const docPanel = computed(() => !reportMode.value && !singleDocMode.value);
/**
 * 档案「改动行提交」基线(2026-10-03 用户口径「修改提交改动行」+ 同日误删事故护栏)。
 *
 * 事故:档案面板保存语义曾是「整表 upsert,缺席行=已删除」,而列表查询带条件时后端只回**子集**
 * ⇒ 一次带筛选的保存把未加载的 3873/3874 行商品档案软删(yj_archive_change_log id=8 removedRows=3873)。
 * 现在:载入时给每行存一份 JSON 基线,保存**只提交与基线不同的行**(无 id 的新行必然提交),
 * 并声明 `只提交改动行=true` —— 后端据此逐行 upsert,**绝不做"缺席即删除"推断**;
 * 删除档案行走「删除」按钮的显式 `作废行id`(见 onButton 的删除分支)。
 * 判据只看行内容,不依赖"哪些事件算编辑"⇒ 手输/参照带回/粘贴/导入任何编辑路径都不会漏。
 */
const archiveBaseline = new Map(); // 行 id -> 载入时的 JSON 快照
function archiveRowIdOf(row) {
  const id = row?.id ?? row?.__id;
  return id === undefined || id === null || String(id).trim() === '' ? null : String(id)
}
/** 档案整档行(单单据面板:list[0].detail[tabKey] 就是全部行) */
function allArchiveRows() {
  const rows = [];
  for (const v of Object.values(cur.value?.detail || {})) if (Array.isArray(v)) rows.push(...v);
  return rows
}
/** 载入/保存成功后重建基线(load 末尾调用) */
function snapshotArchiveBaseline() {
  archiveBaseline.clear();
  if (!singleDocMode.value) return
  for (const r of allArchiveRows()) {
    const id = archiveRowIdOf(r);
    if (id && !archiveBaseline.has(id)) archiveBaseline.set(id, JSON.stringify(r));
  }
}
/** 本次要提交的改动行 = 与基线不同 + 所有新行(无 id) */
function changedArchiveRows() {
  const out = [];
  if (!singleDocMode.value) return out
  for (const r of allArchiveRows()) {
    const id = archiveRowIdOf(r);
    if (!id || archiveBaseline.get(id) !== JSON.stringify(r)) out.push(r);
  }
  return out
}
/** 档案保存的按钮声明:只提交改动行(未声明的老口径由后端保守处理 —— 只 upsert、绝不删行) */
function archiveSaveParam() {
  return { 只提交改动行: true }
}
const reportPageCount = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)));
const reportPeriod = computed(() => {
  const start = condition['开始日期'];
  const end = condition['结束日期'];
  if (start && end) return `${start} - ${end}`
  if (start) return `${start} 起`
  if (end) return `截至 ${end}`
  return tt('当前业务数据')
});
const reportColumns = computed(() => gridTabs.value[0]?.columns || []);
// ── 报表表头筛选与排序补丁:栏目显隐 / 表头筛选 / 升降序 / 后端持久化 ──
const reportCols = useReportColumns(panelCode, reportColumns, list);
const reportList = reportCols.sortedRows;          // 排序+筛选后的报表数据(模板顶层引用以自动解包)
const reportFilterVisible = ref(false);             // 筛选面板显示状态(本地驱动,配合 teleport 定位)
const reportFilterProp = ref('');                   // 当前筛选的字段名
const reportFilterX = ref(0);
const reportFilterY = ref(0);

function hasDistinctValues(prop) {
  return reportCols.distinctValues(prop).length > 1
}

function openFilterAt(prop, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  reportFilterX.value = rect.left;
  reportFilterY.value = rect.bottom + 4;
  if (!Array.isArray(reportCols.headerFilters[prop])) reportCols.headerFilters[prop] = [];
  reportFilterProp.value = prop;
  reportFilterVisible.value = true;
}

function closeFilterPanel(e) {
  if (!reportFilterVisible.value) return
  if (e.target.closest('.report-filter-panel')) return
  if (e.target.closest('.report-col-filter')) return
  reportFilterVisible.value = false;
}

onMounted(() => document.addEventListener('click', closeFilterPanel));
onUnmounted(() => document.removeEventListener('click', closeFilterPanel));

const reportColumnTree = computed(() => {
  const groups = gridTabs.value[0]?.columnGroups || [];
  const owner = new Map();
  for (const group of groups) for (const column of group.columns || []) owner.set(column, group);
  const emitted = new Set();
  const out = [];
  for (const column of reportColumns.value
          .filter((name) => reportCols.visibleProps.value.includes(name))) {
    const group = owner.get(column);
    if (group) {
      if (emitted.has(group.label)) continue
      emitted.add(group.label);
      out.push({
        label: group.label,
        children: (group.columns || []).filter((name) => reportCols.visibleProps.value.includes(name)).map(reportLeaf),
      });
    } else {
      out.push(reportLeaf(column));
    }
  }
  return out
});
const toolbarGroups = computed(() => (groups.value || []).map((group) => {
  // 2026-10-15 用户口径:列表页不再提供「能打开整单卡片(VoucherFormDialog)」的入口 ——
  //   「修改」动作唯一的作用就是弹那张卡片,卡片删除后它成了死按钮,故与 查询/查找 一样从工具栏摘掉。
  const actions = actsOf(group).filter((action) => !['查询', '查找', '修改'].includes(action));
  const name = ['查询', '查找'].includes(group.name) ? (actions[0] || group.name) : group.name;
  return { ...group, name, actions }
}).filter((group) => actsOf(group).length));
// 文书式面板右侧栏:过滤无意义动作(选单/生单/复制/表格调整 对无明细文书无作用;审批流程本面板不启用)
const APPROVAL_SIDE_EXCLUDE = ['选单', '生单', '复制', '表格调整', '表头调整', '审核', '提交审批', '审批通过', '审批驳回', '审批情况', '弃审', '刷新', '退出']; // 刷新/退出在文书侧栏体验差(刷新整页重载/退出关闭页签),2026-09-14 移除
// 删除组单独渲染(带下拉:删除=整单删除;管理员含 删除审批通过/驳回)
const openDelMenu = ref(false);

// ---------- 修改组(文书归档面板):归档后申请修改(管理员审批进入修改态)+ 修改记录(滚动3条) ----------
// 面板集合真源 = 后端 ButtonService.DOC_ARCHIVE_PANELS,经面板配置 metadata.docArchive 下发;
// 2026-09-11 从产品文件 7 面板放开到全部保存即归档面板(实验室 4/数据记录表 8/立项申请/实施计划等),
// 前端不再维护清单——新文书面板在后端登记即自动获得修改闭环。

/** 审批权限:管理员,或角色对该面板勾了审批(approvePanels,后端 can_approve 口径) */
function canApproveHere() {
  const ap = user.approvePanels || [];
  return user.isAdmin || ap.includes('*') || ap.includes(String(panelCode.value))
}

// ---------- 文件面板查询单据:编号模糊(单据编号/文档编号) + 首次归档时间区间 ----------
const docQueryVisible = ref(false);
const docQueryNo = ref('');
const docQueryRange = ref(null);

// ---------- 库存状况:仓库下拉(_ckdm 按仓库编码精确过滤;dm_ck 字典改名不影响绑定) ----------
const stockWh = ref('');
const warehouseOptions = ref([]);
const isStockStatus = computed(() => String(panelCode.value) === 'STOCK_STATUS');
watch(isStockStatus, async (v) => {
  if (!v || warehouseOptions.value.length) return
  try {
    const res = await request.get('/base/warehouse/list');
    warehouseOptions.value = res?.data || [];
  } catch {
    warehouseOptions.value = [];
  }
}, { immediate: true });
function onStockWhChange(v) {
  if (v) condition['_ckdm'] = v;
  else delete condition['_ckdm'];
  search();
}

// ---------- 新增库存(库存状况):存货/仓库按编码绑定基础档案,期初现存量+预警数量 ----------
const stockAddVisible = ref(false);
const stockAdding = ref(false);
const stockAddForm = reactive({ 存货编码: '', 仓库: '', 批号: '', 入库日期: '', 现存量: 0, 预警数量: null });
function openStockAdd() {
  stockAddForm['存货编码'] = '';
  stockAddForm['仓库'] = '';
  stockAddForm['批号'] = '';
  stockAddForm['入库日期'] = todayStr();
  stockAddForm['现存量'] = 0;
  stockAddForm['预警数量'] = 50;
  stockAddVisible.value = true;
}
async function submitStockAdd() {
  stockAdding.value = true;
  try {
    await engine.callButton({
      panelCode: 'STOCK_STATUS',
      buttonName: '新增库存',
      formData: { ...stockAddForm, 预警数量: stockAddForm['预警数量'] ?? '' },
      buttonParam: {},
    });
    ElMessage.success(tt('库存已新增'));
    stockAddVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('新增失败'));
  } finally {
    stockAdding.value = false;
  }
}

// ---------- 预警数量行内编辑(库存状况):点击变输入框,回车/失焦保存,Esc 取消 ----------
const warnEdit = reactive({ id: null, value: null });
const warnEditRef = ref(null);
watch(() => warnEdit.id, async (v) => {
  if (v == null) return
  await nextTick();
  const el = warnEditRef.value;
  if (el && typeof el.focus === 'function') el.focus();
});
function startWarnEdit(row) {
  warnEdit.id = row.id;
  warnEdit.value = row['预警数量'] == null || row['预警数量'] === '' ? null : Number(row['预警数量']);
}
async function saveWarnEdit() {
  if (warnEdit.id == null) return
  const id = warnEdit.id;
  const val = warnEdit.value;
  warnEdit.id = null;
  try {
    await engine.callButton({
      panelCode: 'STOCK_STATUS',
      buttonName: '更新预警数量',
      formData: { id, 预警数量: val == null ? '' : String(val) },
      buttonParam: {},
    });
    const row = (reportList.value || list.value).find((r) => r.id === id);
    if (row) row['预警数量'] = val == null ? null : val;
    ElMessage.success(tt('预警数量已更新'));
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('更新失败'));
    load();
  }
}

async function applyDocQuery() {
  // 产品文件列表(单单据 + 矩阵):「查询单据」改成**按产品编号筛矩阵行**(2026-09-30 用户口径)——
  // 该面板库里只有 1 张单据(PDL-0001),对单据做模糊/归档时间查询必然"查无可查"。
  if (isProdDocMatrix.value) {
    if (docQueryNo.value.trim()) setProdDocFilter([{ field: '产品编号', value: docQueryNo.value }]);
    else clearProdDocFilter();
    docQueryVisible.value = false;
    const n = prodDocFilteredRows.value.length;
    if (n) ElMessage.success(`${tt('筛选到')} ${n} ${tt('个产品')}`);
    else ElMessage.warning(tt('未筛选到匹配的产品'));
    return
  }
  condition['_docNo'] = docQueryNo.value || '';
  const r = docQueryRange.value || [];
  condition['_archFrom'] = r[0] || '';
  condition['_archTo'] = r[1] || '';
  docQueryVisible.value = false;
  query.pageNo = 1;
  curIdx.value = 0;
  await load();
  if (!list.value.length) {
    // 零匹配:自动恢复全部单据,避免停留在空白视图
    delete condition['_docNo'];
    delete condition['_archFrom'];
    delete condition['_archTo'];
    ElMessage.warning(tt('未查询到匹配单据，已恢复全部单据'));
    await load();
    return
  }
  const firstNo = list.value[0]?.['单据编号'] || list.value[0]?.['编号'] || '';
  ElMessage.success(`${tt('查询到')} ${total.value} ${tt('张')}，${tt('已跳转到')}：${firstNo}`);
}

function clearDocQuery() {
  docQueryNo.value = '';
  docQueryRange.value = null;
  if (isProdDocMatrix.value) {
    clearProdDocFilter();
    docQueryVisible.value = false;
    return
  }
  delete condition['_docNo'];
  delete condition['_archFrom'];
  delete condition['_archTo'];
  docQueryVisible.value = false;
  search();
}

// ---------- 产品文件列表(RD_PROD_DOCLIST)专用:侧栏搜索改为**筛矩阵行** ----------
// 该面板是「单单据 + 矩阵」:库里只有 1 张单据,内容是表格里的产品行。对单据做文档查询
// (模糊搜索/查询单据/单据预览)在这面板等于不可用 —— 2026-09-30 用户口径:三个入口都改成对
// **矩阵里的产品行**筛选;判定在 core/prod/prodDocSearch.js(纯函数 + 单测)。
const prodDocRows = ref([]);
const prodDocCols = ref([]);
/** 生效中的行筛选({conditions, valid});经 :filter 下发给 ProdDocListSheet */
const prodDocFilter = ref(null);
function onProdDocRows(rows, cols) {
  prodDocRows.value = Array.isArray(rows) ? rows : [];
  prodDocCols.value = Array.isArray(cols) ? cols : [];
}
function setProdDocFilter(rows) {
  const built = buildProdDocFilter(rows);
  prodDocFilter.value = built.valid ? built : null;
  return built
}
function clearProdDocFilter() {
  prodDocFilter.value = null;
}
const prodDocFilteredRows = computed(() => filterProdDocRows(prodDocRows.value, prodDocCols.value, prodDocFilter.value));

// ---------- 文书侧栏「模糊搜索」:字段+内容(可加多条件 AND) → 查找 → 单条跳转/多条出清单 ----------
// 复用现有查询:具体字段 → condition[字段](后端 LIKE '%值%';明细字段走 EXISTS 行匹配),
// 「全部字段」→ keyword(后端在表头+明细全部字段 OR 模糊)。零后端改动。
const fuzzyMode = ref(false);
const fuzzyRows = ref([{ field: '', value: '' }]);
const fuzzySearched = ref(false);
const fuzzyApplied = ref(null); // 生效中的条件 {condition, keyword, valid}
let fuzzyPrevPageSize = null;
const curDocNo = computed(() => String(cur.value?.['单据编号'] || cur.value?.['编号'] || ''));

/** 字段下拉:全部字段 / 表头字段 / 明细字段(值=字段中文标签,后端按标签映射列)
 *  ⚠ 产品文件列表(单单据 + 矩阵)走另一套:字段 = 矩阵列(产品编号/是否受控/受控日期/状态(任一文件)) */
const fuzzyFieldGroups = computed(() => {
  const cfg = cfgCache.value;
  const header = (headerFields.value || []).map((f) => headerFieldKey(f)).filter(Boolean);
  const seen = new Set(header);
  const detail = [];
  for (const tab of cfg?.detail?.tabs || []) {
    for (const f of tab.fields || []) {
      const key = f.dataName || f.code;
      if (!key || seen.has(key) || f.hidden) continue
      seen.add(key);
      detail.push(key);
    }
  }
  const groups = [{ label: tt('全部字段'), options: [{ value: ALL_FIELDS, label: tt('任意字段') }] }];
  if (isProdDocMatrix.value) {
    // 矩阵面板:字段清单 = 表格自己的列(+「状态（任一文件）」这个横跨 4 个状态格的检索口径)
    groups.push({ label: tt('矩阵列'), options: PROD_DOC_FIELD_OPTIONS.map((k) => ({ value: k, label: tt(k) })) });
    return groups
  }
  if (header.length) groups.push({ label: tt('表头字段'), options: header.map((k) => ({ value: k, label: tt(k) })) });
  if (detail.length) groups.push({ label: tt('明细字段'), options: detail.map((k) => ({ value: k, label: tt(k) })) });
  return groups
});

/** 结果清单:直接取当前已加载列表(查找后列表本身就是命中集合)
 *  ⚠ 矩阵面板的结果 = **产品行**(不是单据行) */
const fuzzyResultRows = computed(() => {
  if (isProdDocMatrix.value) {
    return prodDocFilteredRows.value.map((row) => ({
      no: String(row['产品编号'] || ''),
      date: String(row['受控日期'] || ''),
      status: `${row['doneCount'] ?? 0}/${row['totalCount'] ?? prodDocCols.value.length}`,
      row,
    }))
  }
  return (list.value || []).map((row) => ({
    no: String(row['单据编号'] || row['编号'] || ''),
    date: String(row['单据日期'] || ''),
    status: String(row['单据状态'] || ''),
    row,
  }))
});

function openFuzzy() {
  fuzzyMode.value = true;
  if (!fuzzyRows.value.length) fuzzyRows.value = [{ field: '', value: '' }];
}
function addFuzzyRow() {
  fuzzyRows.value.push({ field: '', value: '' });
}
function removeFuzzyRow(index) {
  fuzzyRows.value.splice(index, 1);
  if (!fuzzyRows.value.length) addFuzzyRow();
}
async function closeFuzzy() {
  fuzzyMode.value = false;
  fuzzyRows.value = [{ field: '', value: '' }];
  fuzzySearched.value = false;
  fuzzyApplied.value = null;
  // 矩阵面板:关掉搜索面板 = 连行筛选一起清掉(回到全表)
  if (isProdDocMatrix.value) {
    clearProdDocFilter();
    return
  }
  if (fuzzyPrevPageSize) { query.pageSize = fuzzyPrevPageSize; fuzzyPrevPageSize = null; }
  query.pageNo = 1;
  curIdx.value = 0;
  await load();
}
async function runFuzzySearch() {
  // 产品文件列表:对**矩阵行**筛选(不跑单据查询 —— 该面板只有 1 张单,查单据必然"查无可查")
  if (isProdDocMatrix.value) {
    const built = setProdDocFilter(fuzzyRows.value);
    if (!built.valid) {
      ElMessage.warning(tt('请先填写字段和内容'));
      return
    }
    fuzzySearched.value = true;
    const n = prodDocFilteredRows.value.length;
    if (!n) ElMessage.warning(tt('未找到匹配的产品'));
    else ElMessage.success(`${tt('找到')} ${n} ${tt('个产品')}`);
    return
  }
  const built = buildFuzzyQuery(fuzzyRows.value);
  if (!built.valid) {
    ElMessage.warning(tt('请先填写字段和内容'));
    return
  }
  if (fuzzyPrevPageSize === null) fuzzyPrevPageSize = query.pageSize;
  fuzzyApplied.value = built;
  query.pageSize = 200; // 模糊搜索一次取够,结果清单要能列全
  query.pageNo = 1;
  curIdx.value = 0;
  await load();
  fuzzySearched.value = true;
  if (!total.value) {
    ElMessage.warning(tt('未找到匹配单据'));
    return
  }
  if (total.value === 1) {
    ElMessage.success(`${tt('已跳转到')}：${fuzzyResultRows.value[0]?.no || ''}`);
    return
  }
  // 结果清单一次最多取 200 张(pageSize=200):命中更多时必须讲清"共命中 N 张、仅列前 M 张",
  // 否则「共 N 张」与清单实际条数不符(2026-09-20 修)
  const shown = list.value.length;
  if (total.value > shown) ElMessage.warning(tt('找到 {n} 张单据，清单仅列出前 {m} 张').replace('{n}', total.value).replace('{m}', shown));
  else ElMessage.success(`${tt('找到')} ${total.value} ${tt('张单据')}，${tt('点清单切换查看')}`);
}
/** 点结果行 = 切换当前单据(走既有离开守卫:草稿未保存会提示)
 *  ⚠ 矩阵面板:结果是**产品行**,点它 = 把筛选收窄到该产品(表格随即只剩这一行) */
async function openFuzzyResult(r) {
  if (isProdDocMatrix.value) {
    setProdDocFilter([{ field: '产品编号', value: String(r.no || '') }]);
    return
  }
  const index = list.value.indexOf(r.row);
  if (index >= 0) await guardDocSwitch(index);
}
// ---------- 文书侧栏「单据预览查找」:全量单据卡片(编号/状态/日期+前4个非空业务字段摘要) ----------
// 与模糊搜索同源取数(pageSize 拉到 200 一次取全),关键字客户端筛选;点卡片即跳转,文件档案查看效果。零后端改动。
const previewMode = ref(false);
const previewKw = ref('');
let previewPrevPageSize = null;
/** 摘要字段剔除清单:系统列与阶段明细列不进卡片 */
const PREVIEW_SKIP = new Set(['单据编号', '编号', '单据日期', '单据状态', '文档编号', '文件管理人', '密级', '文件使用范围', '备注', '打印时间', '公司名称']);
function previewFieldsOf(row) {
  const out = [];
  for (const f of headerFields.value || []) {
    if (out.length >= 4) break
    const key = headerFieldKey(f);
    if (!key || PREVIEW_SKIP.has(key) || /^阶段\d+/.test(key)) continue
    const v = row[key];
    if (v == null || String(v).trim() === '') continue
    const s = String(v).replace(/\s+/g, ' ').trim();
    if (!s) continue
    out.push({ label: key, value: s.length > 42 ? s.slice(0, 42) + '…' : s });
  }
  return out
}
const previewCards = computed(() => {
  // 产品文件列表:卡片 = **产品行**(编号 + 受控 + 4 个文件各自的状态),不是单据卡片
  if (isProdDocMatrix.value) {
    const kw = previewKw.value.trim().toLowerCase();
    return prodDocFilteredRows.value.map((row) => {
      // 卡片字段 = 4 个文件各自的状态:label 走 tt('文件N'),value = 文件名 + 状态(都过 tt(),
      // 面板名/状态值本身在翻译表里有词条;拼串不整串丢进 tt(),否则会机翻出无意义词条)
      const fields = prodDocCols.value.map((c, i) => ({
        label: `文件${i + 1}`,
        value: `${tt(c.panelName)}：${tt(String(row?.cells?.[c.panelCode] || '—'))}`,
      }));
      const no = String(row['产品编号'] || '');
      const hit = !kw || no.toLowerCase().includes(kw)
        || fields.some((x) => x.value.toLowerCase().includes(kw))
        || prodDocCols.value.some((c) => String(row?.cells?.[c.panelCode] || '').toLowerCase().includes(kw));
      return { no, date: String(row['受控日期'] || ''), status: String(row['是否受控'] || ''), fields, hit, row }
    }).filter((c) => c.hit)
  }
  return (list.value || []).map((row) => {
    const no = String(row['单据编号'] || row['编号'] || '');
    const fields = previewFieldsOf(row);
    const kw = previewKw.value.trim().toLowerCase();
    const hit = !kw || no.toLowerCase().includes(kw) || fields.some((x) => x.value.toLowerCase().includes(kw));
    return { no, date: String(row['单据日期'] || ''), status: String(row['单据状态'] || ''), fields, hit, row }
  }).filter((c) => c.hit)
});
async function openDocPreview() {
  if (fuzzyMode.value) { // 与模糊搜索互斥:模糊条件失效,pageSize 直接接管
    fuzzyMode.value = false;
    fuzzySearched.value = false;
    fuzzyApplied.value = null;
    fuzzyPrevPageSize = null;
  }
  previewMode.value = true;
  previewKw.value = '';
  // 矩阵面板:卡片来自矩阵行,不跑单据查询(该面板只有 1 张单)
  if (isProdDocMatrix.value) return
  if (previewPrevPageSize === null) previewPrevPageSize = query.pageSize;
  query.pageSize = 200;
  query.pageNo = 1;
  curIdx.value = 0;
  await load();
}
async function closeDocPreview() {
  previewMode.value = false;
  previewKw.value = '';
  if (isProdDocMatrix.value) return
  if (previewPrevPageSize !== null) { query.pageSize = previewPrevPageSize; previewPrevPageSize = null; }
  query.pageNo = 1;
  curIdx.value = 0;
  await load();
}
async function openPreviewCard(c) {
  // 矩阵面板:点产品卡 = 把筛选收窄到该产品
  if (isProdDocMatrix.value) {
    setProdDocFilter([{ field: '产品编号', value: String(c.no || '') }]);
    return
  }
  const index = list.value.indexOf(c.row);
  if (index >= 0) await guardDocSwitch(index);
}
/** 文书归档面板(保存即归档):修改闭环按钮组的显隐开关,真源后端 metadata.docArchive */
const isDocArchivePanel = computed(() => !!cfgCache.value?.metadata?.docArchive);
/**
 * 侧栏是否放出「修改记录」按钮:文书归档面板一族(isDocArchivePanel)照旧;
 * 检验目录(QC_CATALOG)不是归档面板,但其「修改」动作会把「已完成检验」回弹并写 yj_doc_modify_log
 * (2026-09-22 用户口径:修改记录要放在按钮栏处),故一并放开。
 */
const isModLogPanel = computed(() => isDocArchivePanel.value || String(panelCode.value) === 'QC_CATALOG');
/** 品质单据等标准流文书面板:非文件类(保存不自动提交审批),侧栏需显式审批动作组 */
const isStandardFlowSheet = computed(() => Object.prototype.hasOwnProperty.call(qcSheetCfgs, String(panelCode.value)));
/**
 * 侧栏是否放出「提交审批 / 审批通过 / 审批驳回 / 弃审 / 审批情况」按钮组:
 * 标准流文书面板(特采单等)照旧;检验数据记录(QC_INSP_REC)虽走归档一族(保存即归档),
 * 但用户口径要求有明确的审批与审批通过按钮,故一并放开。
 * 测试申请单(RD_DOM_TEST,2026-09-30 用户口径)同 QC_INSP_REC 口径:它也是归档一族
 * (保存=普通用户自动送审 / 管理员直接归档),此前审批动作只藏在「申请修改」组的下拉里,
 * 用户要求把动作组直接放出来 —— 归档闭环本身不动(「申请修改/修改记录」照旧保留)。
 */
const hasApprovalBtns = computed(() => isStandardFlowSheet.value
  || String(panelCode.value) === 'QC_INSP_REC'
  || String(panelCode.value) === 'RD_DOM_TEST');
const openModMenu = ref(false);
const curDocStatus = computed(() => String(cur.value?.['单据状态'] || ''));
// 规格书两级分发(2026-09-12):已分配单仅 责任人∪总负责人∪管理员 可编辑,其他人可见只读
const specDocAssign = ref(null);
const specAssignBlocked = computed(() => !!(specDocAssign.value?.hasAssign)
  && !user.isAdmin
  && user.account !== specDocAssign.value?.owner
  && user.account !== specDocAssign.value?.supervisor);
const canModifyReq = computed(() => ['已归档', '已审核'].includes(curDocStatus.value) && !specAssignBlocked.value);

// ── 四个受控文件的编辑门禁 → 前端置灰(2026-09-21 全流程走查补)──
// 服务端 ensureDevFileEditable 早就拦住了非责任人,但界面不置灰:用户能改、能点保存,点完才被拒。
// 现在判定经 /px/rdDev/fileEdit 下发(与保存门禁同一真源),非责任人打开就只读 + 看得到责任人是谁。
const DEV_FILE_PANELS = ['RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_SPEC_DOC', 'RD_INSP_PLAN'];
const devFileGate = ref(null);
/** 门禁不适用(非四文件面板/历史单/管理员)时为 false */
const devFileBlocked = computed(() => !!(devFileGate.value?.applicable && devFileGate.value?.canEdit === false));
async function loadDevFileGate() {
  if (!DEV_FILE_PANELS.includes(String(panelCode.value))) { devFileGate.value = null; return }
  const no = cur.value?.['单据编号'] || '';
  if (!no) { devFileGate.value = null; return }
  try {
    devFileGate.value = await engine.rdDevFileEdit(panelCode.value, no);
  } catch {
    // 取不到判定 ⇒ 不锁(宁可不置灰,也别把责任人自己锁在外面;保存时服务端仍会兜底)
    devFileGate.value = null;
  }
}
const modifyLogVisible = ref(false);
const modifyLogRecords = ref([]);
const modifyLogNo = ref('');

// ── 分发责任人(2026-09-20;原名「产品开发下发」2026-09-09)──
// 口径:已归档 + (二级审核人 ∪ 管理员)可分发;四个下游文件**各自**一个责任人,分发后随时可改。
const devDispatch = reactive({ productCode: '', dispatched: false, busy: false, supervisor: '', supervisorName: '', supervisorResolved: false, canAssign: false, l2Approver: '', isL2: false, assigns: {} });
const canDevDispatch = computed(() => panelCode.value === 'RD_PROD_INFO' && curDocStatus.value === '已归档' && devDispatch.canAssign);
async function loadDevDispatchState() {
  if (panelCode.value !== 'RD_PROD_INFO') {
    Object.assign(devDispatch, { productCode: '', dispatched: false, supervisor: '', supervisorName: '', supervisorResolved: false, canAssign: false, l2Approver: '', assigns: {} });
    return
  }
  const no = cur.value?.['单据编号'] || '';
  if (!no) {
    Object.assign(devDispatch, { productCode: '', dispatched: false, supervisor: '', supervisorName: '', supervisorResolved: false, canAssign: false, l2Approver: '', assigns: {} });
    return
  }
  try {
    const res = await engine.rdDevButtonState(no);
    devDispatch.productCode = res?.productCode || '';
    devDispatch.dispatched = !!res?.dispatched;
    // 总负责人(=产品信息表「责任人」→账号;后端懒重解:产品信息改好人后这里即补挂)
    devDispatch.supervisor = res?.supervisor || '';
    devDispatch.supervisorName = res?.supervisorName || '';
    devDispatch.supervisorResolved = !!res?.supervisorResolved;
    devDispatch.canAssign = !!res?.canAssign;
    devDispatch.l2Approver = res?.l2Approver || '';
    devDispatch.isL2 = !!res?.isL2Approver;
    devDispatch.assigns = res?.assigns || {};
  } catch (e) {
    Object.assign(devDispatch, { productCode: '', dispatched: false, supervisor: '', supervisorName: '', supervisorResolved: false, canAssign: false, l2Approver: '', assigns: {} });
  }
}
async function onDevDispatch() {
  if (!canDevDispatch.value || devDispatch.busy) return
  await openDevAssign();
}

/** 本单据一级选定的二级审核人 = 当前登录人(二级节点才由他审批;被选中即授权) */
const l2ApproverNow = computed(() => panelCode.value === 'RD_PROD_INFO' && !!devDispatch.isL2);

// ── 质量单据两级审批(2026-10-04 用户口径:品质管理·质量单据一族 + 来料品质·特采单)──
// 纸面(YJ-QR 体系)底部都是「编制 / 审核 / 批准」三格,系统口径与之一一对应:
//   编制 = 提交审批的人(提交时后端自动落值);审核 = 一级审批通过的人;批准 = 超级管理员。
// 一级 = 有该面板「审核反审核」权的角色 ∪ 管理员(yj_role_panel.can_approve,即 canApproveHere);
// 二级 = **超级管理员**(yj_user.is_admin='Y'),不选人、不是角色。
// ⚠ 两级**必须各点一次**(同一个人也要两次),故按钮分节点显隐,不给"一次动作跨两级"的入口。
// ⚠ 清单必须与后端 ButtonService.ADMIN_L2_PANELS 一致(那边是 QC_DOC_PREPARER 的键集)。
const L2_DOC_PANELS = ['QC_TC_IN', 'QC_BHG', 'QC_BHC', 'QC_BHZ', 'QC_JJF', 'QC_SCP', 'QC_LYB', 'QC_SCY'];
const isQcL2Panel = computed(() => L2_DOC_PANELS.includes(String(panelCode.value)));
/** 一级审核节点(节点 1):状态还是「审批中」 */
const qcL2Node = computed(() => isQcL2Panel.value && curDocStatus.value === '待二级审批');
/** 本节点我能不能批:一级看面板审批权,二级只有超级管理员 */
const canApproveQcL2Here = computed(() => (qcL2Node.value ? user.isAdmin === true : canApproveHere()));
/** 侧栏点「审批通过/批准通过」都打到后端的「审批通过」按钮(节点由后端 approve_node 判,前端只管显隐与文案) */
function qcL2ApproveLabel() {
  return qcL2Node.value ? tt('批准通过') : tt('审批通过')
}
function qcL2RejectLabel() {
  return qcL2Node.value ? tt('批准驳回') : tt('审批驳回')
}

// ── 分发责任人弹窗(2026-09-20):四个下游文件各选一个责任人 ──
const devAssignVisible = ref(false);
const devAssignBusy = ref(false);
const devAssignUsers = ref([]);
// 顺序与后端 DevTaskService.DEV_PANELS / 设计「文件汇总表」第 9 行一致:
// 规格书 → 成型工艺清单 → 组装工艺清单 → 出货检验计划表(2026-09-30 用户口径:按设计排)
const DEV_PANELS = [
  { code: 'RD_SPEC_DOC', label: '规格书' },
  { code: 'RD_MOLD_PROC', label: '成型工艺清单' },
  { code: 'RD_ASM_PROC', label: '组装工艺清单' },
  { code: 'RD_INSP_PLAN', label: '出货检验计划表' },
];
const devAssignRows = ref(DEV_PANELS.map((p) => ({ panel: p.code, label: p.label, owner: '' })));
const devAssignDocNo = ref('');
async function openDevAssign() {
  const no = cur.value?.['单据编号'] || '';
  if (!no) return ElMessage.warning('请先保存单据')
  devAssignBusy.value = true;
  try {
    if (!devAssignUsers.value.length) devAssignUsers.value = (await engine.rdDevUsers()) || [];
    const st = await engine.rdDevAssignState(no);
    const assigns = st?.assigns || {};
    // 默认责任人 = **按需求逐文件预置**(《产品开发系统需求汇总.xlsx》sheet「文件汇总表」的「产品文件流程」):
    //   5.1 规格书 = 项目负责人(后端 buttonState.supervisor 下发,动态)
    //   5.2 成型控制要点 = 刘磊(liulei)
    //   5.3 组装控制要求 = 柴善银(chaishanyin)
    //   5.4 出货控制计划 = 冯敏(fengmin)
    // ⚠ 这三个是**账号名(username)**,不是姓名 —— 载荷「分发责任人={面板编码:账号}」按账号落 rd_dev_task;
    //   账号由 tools/migrate-rd-file-owner-2026-09-30.sql 建,角色「文件负责人」。
    // 已分发过的以库里现有分配为准(assigns 优先),四格仍可逐个改。
    const fallback = devDispatch.supervisor || '';
    const FILE_OWNER_DEFAULT = { RD_MOLD_PROC: 'liulei', RD_ASM_PROC: 'chaishanyin', RD_INSP_PLAN: 'fengmin' };
    devAssignRows.value = DEV_PANELS.map((p) => ({
      panel: p.code,
      label: p.label,
      owner: assigns[p.code] || FILE_OWNER_DEFAULT[p.code] || fallback,
    }));
    devAssignDocNo.value = no;
    devAssignVisible.value = true;
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '读取分发状态失败');
  } finally {
    devAssignBusy.value = false;
  }
}
async function confirmDevAssign() {
  if (devAssignBusy.value) return
  devAssignBusy.value = true;
  try {
    const 分发责任人 = {};
    for (const r of devAssignRows.value) if (r.owner) 分发责任人[r.panel] = r.owner;
    const res = await engine.callButton({
      panelCode: 'RD_PROD_INFO', buttonName: '分发责任人',
      formData: { 编号: devAssignDocNo.value, 分发责任人 }, buttonParam: {},
    });
    const n = Object.keys(res?.assigns || {}).length;
    ElMessage.success(`已分发 ${n} 个文件的责任人`);
    devAssignVisible.value = false;
    await loadDevDispatchState();
    await load();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '分发失败');
  } finally {
    devAssignBusy.value = false;
  }
}

// ── 规格书两级分发(2026-09-12):总负责人按 种类+责任人 批量建规格书草稿单 ──
const canSpecDispatch = computed(() => user.isAdmin || (!!devDispatch.supervisor && user.account === devDispatch.supervisor));
const specAssignVisible = ref(false);
const specAssignStateData = ref(null);
const specAssignRows = ref([]);
const specAssignUsers = ref([]);
const specAssignBusy = ref(false);
/** 可分配候选单 = 服务端 docs(存活且未分配的单据) − 本弹窗各行已选(分发过的不再重复分发) */
const specDocsAvail = computed(() => {
  const picked = new Set(specAssignRows.value.map((r) => String(r['编号'] || '').trim()).filter(Boolean));
  return (specAssignStateData.value?.docs || []).filter((d) => !picked.has(d['单据编号']))
});
/** 候选单下拉展示:单据编号 · 种类(有则附) · 状态 */
const specDocLabel = (d) => {
  const kind = d['规格书种类'] ? ` · ${d['规格书种类']}` : '';
  return `${d['单据编号']}${kind} · ${tt(String(d.status))}`
};
/** 规格书单据编辑闸门:随面板/当前单据加载分配状态(无分配=历史单,不受封锁) */
async function loadSpecDocAssign() {
  if (panelCode.value !== 'RD_SPEC_DOC') { specDocAssign.value = null; return }
  const no = cur.value?.['单据编号'] || '';
  if (!no) { specDocAssign.value = null; return }
  try { specDocAssign.value = await engine.specAssignDoc(no); } catch { specDocAssign.value = null; }
}
async function openSpecAssign() {
  if (!canSpecDispatch.value) return
  if (!devDispatch.productCode) await loadDevDispatchState();
  try {
    const [state, users] = await Promise.all([
      engine.specAssignState(devDispatch.productCode),
      request.get('/sys/user/list').then((r) => r?.data || []),
    ]);
    specAssignStateData.value = state;
    specAssignUsers.value = (Array.isArray(users) ? users : []).filter((u) => String(u.enabled) !== '0' && u.userName);
    specAssignRows.value = [{ '编号': '', '责任人': '' }];
    specAssignVisible.value = true;
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'));
  }
}
async function submitSpecAssign() {
  const assigns = specAssignRows.value
    .map((r) => ({ '编号': String(r['编号'] || '').trim(), '责任人': String(r['责任人'] || '').trim() }))
    .filter((r) => r['编号'] || r['责任人']);
  if (!assigns.length) return ElMessage.warning(tt('请选择规格书单据') + ' / ' + tt('请选择责任人'))
  if (assigns.some((r) => !r['编号'])) return ElMessage.warning(tt('请选择规格书单据'))
  if (assigns.some((r) => !r['责任人'])) return ElMessage.warning(tt('请选择责任人'))
  specAssignBusy.value = true;
  try {
    const res = await engine.callButton({
      panelCode: 'RD_PROD_INFO',
      buttonName: '规格书分发',
      formData: { 编号: cur.value?.['单据编号'], assigns },
      buttonParam: {},
    });
    const n = (res?.assigned || assigns).length;
    ElMessage.success(tt('分发成功，已分配 {n} 张规格书').replace('{n}', String(n)));
    specAssignVisible.value = false;
    specAssignStateData.value = await engine.specAssignState(devDispatch.productCode);
    specAssignRows.value = [];
    await load();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('操作失败'));
  } finally {
    specAssignBusy.value = false;
  }
}

function pickModAction(action) {
  openModMenu.value = false;
  onSideAction(action);
}

function safeParseJson(s) {
  try { return JSON.parse(s) } catch { return null }
}

async function openModifyLog() {
  if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
  const no = current.value['编号'] || current.value['单据编号'] || '';
  try {
    const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '修改记录', formData: { 编号: no }, buttonParam: {} });
    modifyLogNo.value = no;
    modifyLogRecords.value = (res?.records || []).map((r) => ({
      ...r,
      changes: typeof r.changes === 'string' ? (safeParseJson(r.changes) || []) : (r.changes || []),
      changeMeta: typeof r.changeMeta === 'string' ? (safeParseJson(r.changeMeta) || {}) : (r.changeMeta || {}),
    }));
    modifyLogVisible.value = true;
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'));
  }
}
const approvalSideGroups = computed(() => toolbarGroups.value
  .map((g) => ({
    ...g,
    actions: (g.actions || []).filter((a) => !APPROVAL_SIDE_EXCLUDE.includes(a)
      // 单单据面板(项目进度查询 RD_PROGRESS):全部数据都进同一张单据,不提供「新增」入口
      && !(singleDocMode.value && (a === '新增' || a === '新增流程' || a === '新建'))),
  }))
  .filter((g) => (g.actions || []).length && !(g.actions || []).includes('删除')));
const headerFields = computed(() => {
  const fields = (cfgCache.value?.dataSchema?.fields || []).filter((field) => !field.hidden);
  const names = cfgCache.value?.metadata?.panelPageDto?.formPages?.[0]?.fieldNames;
  if (!names) return fields
  const ordered = String(names).split(',').map((name) => name.trim()).filter(Boolean);
  const byName = new Map(fields.map((field) => [headerFieldKey(field), field]));
  return ordered.map((name) => byName.get(name)).filter(Boolean)
});
/** 附件类表头字段不进表头网格:单独「附件」区渲染,载入单据后常驻上传/查看 */
const attachFields = computed(() => (headerFields.value || []).filter((f) => f.dataType === '附件'));
const headerEditFields = computed(() => (headerFields.value || []).filter((f) => f.dataType !== '附件'));
/** 头表附件列位键(附件1..附件6):页面单格聚合,上传按序占第一个空余列位 */
const attachKeys = computed(() => attachFields.value.map((f) => headerFieldKey(f)));
const attachValues = computed(() => Object.fromEntries(attachKeys.value.map((k) => [k, cur.value[k] || ''])));
function applyAttachSlots(map) {
  Object.entries(map || {}).forEach(([k, v]) => { cur.value[k] = v; });
}
/** RecordSheetPanels 专用:表头字段 + 明细字段(数据表列的 alias 从明细字段元数据取) */
const sheetAllFields = computed(() => {
  const header = headerFields.value || [];
  const detail = cfgCache.value?.detail?.tabs?.[0]?.fields || [];
  return [...header, ...detail]
});
const queryDialogFields = computed(() => {
  // 档案/单单据面板(基础资料):表头只剩「备注」,查询条件取元数据登记的常规字段(queryFields,每面板 ≤6 个)
  const fields = (reportMode.value || singleDocMode.value) ? queryFields.value : headerEditFields.value;
  return fields.filter((field) => headerFieldKey(field) !== '备注')
    // 台账/库存状况的 仓库/存货 也走通用渲染:参照双模(仓库 6 行下拉/存货 3838 行弹窗)+ 联动收窄提示
});
const draftEditable = computed(() => {
  if (reportMode.value) return false
  // 规格书已分配:非 责任人∪总负责人∪管理员 只读(服务端三个入口同口径强制,这里提前置灰)
  if (specAssignBlocked.value) return false
  // 四个受控文件:非该文件责任人只读(判定来自服务端,与保存门禁同一真源)
  if (devFileBlocked.value) return false
  const st = cur.value?.['单据状态'];
  if (st === '草稿') return true
  // 修改态(文件类:申请修改经管理员审批通过):可编辑,保存不再自动归档,走再审批
  if (st === '修改中') return true
  // 档案/单单据面板（存货档案、员工、部门、工艺路线等）：启用/停用状态列表页同样内联可编辑（2026-08-24）
  if ((cfgCache.value?.metadata?.singleDoc || cfgCache.value?.metadata?.panelCategory === '设置') && (st === '启用' || st === '停用')) return true
  return false
});

/** 附件上传闸门(2026-09-20):草稿/修改中照旧可传;**凡配了附件列位的单据,已审核/已完成也允许补附件**
 *  (合同/送货单/检验报告等佐证材料,只写附件列与 yj_attachment,不动业务字段;金蝶同步进来的订单
 *  本来就是已审核,沿用"审核即锁定"这些单永远传不了附件)。仅「已作废」单据禁止。
 *  名单 = 已配 6 列位的单据:SALE/采购订单、生产工单、委外加工单、生产工单、客户订单
 *  + 采购链的送料暂收/来料检验/暂收退回/采购入库(见 migrate-order-attach / migrate-attach-restore)。 */
const ATTACH_EDIT_PANELS = new Set([
  'PU_ORDER', 'SO_ORDER', 'MANU_ORDER', 'OUTSOURCE_ORDER', 'WO_ORDER', 'KHDD',
  'QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN', 'SALE_OUT',
]);
const attachEditable = computed(() => {
  if (draftEditable.value) return true
  if (!ATTACH_EDIT_PANELS.has(panelCode.value)) return false
  if (!curDocNo.value) return false
  return String(cur.value?.['单据状态'] || '') !== '已作废'
});

// ══════════ 分批送料(2026-09-20 P0)══════════
// 目标面板配了「批次号」表头字段 = 分批链路;生单走分批对话框(逐行填本次数量),而不是整单一次性生成
const batchSendVisible = ref(false);
const batchSend = ref(null); // {sourcePanel, targetPanel, sourceNo}
const batchTargetCache = new Map();
/**
 * 本面板是否「分批链路单据」(表头配了「批次号」字段)—— 与后端
 * PanelConfigService.buildSelectConfig 的 batchFlow、PushGenerateHandler.isBatchTarget
 * 同一判据(同一个元数据事实:表头有批次号即链路单据)。
 */
const batchChainPanel = computed(() => (cfgCache.value?.dataSchema?.fields || [])
  .some((f) => (f.dataName || f.label) === '批次号'));
/**
 * 明细行「批次号」是否锁定(2026-10-04 批次号口径):
 * 批次号在**生单那一刻**由服务端定稿(供应商编码去掉 YJ- 前缀 + `-` + 生单当天 yyyyMMdd,
 * 如 YJ-TX ⇒ TX-20260910),并沿 暂收 → 检验 → 入库 逐站继承;明细行一律**随单头一致**
 * (后端 BatchService.syncBatchNo 每次保存/审核都按单头覆盖写全部明细行)。
 * 因此明细格只读:可改的只有送料暂收单草稿态的**单头**批次号。
 *
 * 为什么按"列名 + 链路单据"判定、而不是直接用元数据 `editable=0` 下发的 `readonly`:
 * 明细单元格的内联编辑器只读 `field.computed`(全库从未被赋值),**不读 `readonly`**;
 * 若为此全局放开"明细列尊重 readonly",会连带锁死 MANU_SCHEDULE(21 列)、
 * PURCHASE_IN 的 送检数量/备注 等一批与本次需求无关的列 —— 影响面不可控,
 * 故这里只对本需求的批次号列做定向锁定(链路判定仍是元数据驱动的)。
 */
function detailBatchLocked(prop) {
  return prop === '批次号' && batchChainPanel.value
}

/** 面板是否配了「批次号」字段(= 分批链路上的单据) */
async function panelHasBatchField(panel) {
  if (!panel) return false
  if (batchTargetCache.has(panel)) return batchTargetCache.get(panel)
  let yes = false;
  try {
    const cfg = await engine.getPanelConfig(panel);
    yes = (cfg?.dataSchema?.fields || []).some((f) => (f.dataName || f.label) === '批次号');
  } catch { yes = false; }
  batchTargetCache.set(panel, yes);
  return yes
}
/**
 * 生单是否走「分批送料对话框」——**只在批次源头那一跳**(用户口径 2026-09-20):
 * 采购订单→送料暂收单:来源(订单)无批次号 → 弹框逐行填本次送料量,可多次分批;
 * 送料暂收→来料检验:来源已带批次号 → **一键整单生单**(送检数量 = 剩余全部,批次号继承),不弹框。
 */
async function needBatchDialog(target) {
  if (!target) return false
  if (!(await panelHasBatchField(target))) return false
  return !(await panelHasBatchField(panelCode.value))
}
/** 分批生单完成:跳到目标面板继续填写(与推式生单同款:关源页签、开目标页签、新单按创建时间倒序在第一张) */
function onBatchGenerated({ panel, no, batchNo, silent }) {
  const targetPanel = panel || batchSend.value?.targetPanel || '';
  if (!targetPanel) return
  // 批次号在**生单那一刻**已由服务端定稿(供应商编码去 YJ- 前缀 + 当天日期),这里直接把真号回显给用户。
  // 分批送料对话框自己会把"生成了几张、各是什么号"说清(silent=true,含按批次号分组的多张情形),此处不重复。
  if (!silent) {
    ElMessage.success(batchNo
      ? `${tt('已生成')} ${targetPanel} ${no}（${tt('批次号')} ${batchNo}）`
      : `${tt('已生成')} ${targetPanel} ${no}，请在列表页继续填写`);
  }
  const targetPath = `/panelx/list/${targetPanel}`;
  tabs.close(route.path);
  router.push(targetPath);
  tabs.open({ path: targetPath, title: targetPanel });
}
const newVisible = ref(false);
const approvalVisible = ref(false);
const approvalNo = ref('');
const selVisible = ref(false);
const impVisible = ref(false);
const impFields = ref([]);
const impLabel = ref('明细');
const scanVisible = ref(false);
const selCfg = ref(null);
// 材料二维码标签(品检分流链:暂收单行 打印标签)
const qrVisible = ref(false);
/** 采购订单·打印材料码弹窗(2026-10-04):批次号在打印时登记,并预约该行数量 */
const materialLabelVisible = ref(false);
const materialLabelNo = ref('');
/** 打印登记完成后提示一句:这批量已从订单数量隔离成独立一行,去生单对话框勾它即可 */
function onMaterialLabelPrinted({ docNo, batchNo, count }) {
  ElMessage.success(`${tt('已登记材料码')} ${docNo}（${tt('批次号')} ${batchNo}，${count} ${tt('张标签')}）——${tt('该批数量已从订单数量隔离出来，生单时在明细里直接勾选它')}`);
}
const qrLabels = ref([]);

function openQrLabels() {
  const rows = current.value?.detail?.items || [];
  const doc = current.value?.['单据编号'] || current.value?.['编号'] || '';
  qrLabels.value = rows
    .filter((r) => r['批号'])
    .map((r) => ({ code: r['物料编码'], name: r['物料名称'], lot: r['批号'], qty: r['暂收数量'], unit: r['单位'], doc, qr: '' }));
  if (!qrLabels.value.length) {
    ElMessage.warning(tt('当前单据明细行均无批号——请先保存(保存时自动取批号)后再打印'));
    return
  }
  qrVisible.value = true;
}

function selectConfigFor(action = '选单') {
  const cfg = cfgCache.value || {};
  const configs = cfg.selectConfigs || {};
  if (configs[action]) return configs[action]
  // 后端目前只下发单来源的 selectConfig(不发 selectConfigs),所以「选XX」下拉项此前一律返回 null、
  // 点了只弹「演示环境暂未实现」—— 与「选单」同样回落到 selectConfig(不影响已能工作的路径)。
  if (action === '选单' || action.startsWith('选')) return cfg.selectConfig || Object.values(configs)[0]
  return null
}
const delMode = ref(false);
const delSel = ref([]);

// 产成品→材料联动：当前选中产成品（列表页单据流览内点击产成品明细行）；材料明细按其 子件BOM 存储值过滤
const selectedProduct = ref(null);

// ---------- 明细维护弹窗（主表双击行打开：在弹窗内维护该单明细，新增/删除/保存） ----------
const maintainVisible = ref(false);
const maintainRow = ref(null);
function openMaintain(row) {
  if (!row || row._placeholder) return
  maintainRow.value = row;
  maintainVisible.value = true;
}
function onMaintainSaved() {
  load();
}

// ---------- 单据浏览器：翻页切单据 ----------
const curIdx = ref(0);
const cur = computed(() => {
  const l = list.value;
  if (!l.length) return {}
  return l[Math.min(curIdx.value, l.length - 1)]
});
// 当前单据在全量中的序号(不是页内序号!)——页脚「第 X/N 张」必须用全局序号,
// 否则数据量超过一页后永远显示 1..pageSize(2026-09-20 修:分页显示与实际不符)
const curNo = computed(() => {
  if (!list.value.length) return 0
  const i = Math.min(curIdx.value, list.value.length - 1);
  return (query.pageNo - 1) * query.pageSize + i + 1
});
/** 总页数(单据面板分页用;与后端 OFFSET/FETCH 口径一致) */
const lastPage = computed(() => Math.max(1, Math.ceil(total.value / Math.max(1, query.pageSize))));

// 产品开发下发按钮状态:随面板/当前单据变化刷新(必须在 cur 定义之后,immediate 会在 setup 时立即求值)
// 规格书分配状态(编辑闸门)同批加载:RD_SPEC_DOC 单据打开即取分配,决定只读与否
watch(() => [panelCode.value, cur.value?.['单据编号']], () => { loadDevDispatchState(); loadSpecDocAssign(); loadDevFileGate(); }, { immediate: true });

/* 批次号「材料码锁定」(2026-10-04 用户口径:凡**有关打印明细生成的单据**都不可以修改批次号)。
   判定在服务端:该单的来源链里有没有**隔离行键**(`{订单号}#{行id}@{打印行id}`)的 ACTIVE link ——
   有 ⇒ 它是由材料码(打印明细)生出来的,标签上已印那个号,草稿态也不许改。
   只对**批次链路单据**(表头有「批次号」字段)问,别的面板一次多余请求都不发。 */
const printBatchLock = ref({ 锁定: false, 批次号: '', 依据: '' });
watch(() => [panelCode.value, curDocNo.value], async () => {
  printBatchLock.value = { 锁定: false, 批次号: '', 依据: '' };
  const no = String(curDocNo.value || '');
  if (!no || !batchChainPanel.value) return
  try {
    const r = await engine.puLabelBatchLock(panelCode.value, no);
    if (r && String(curDocNo.value) === no) printBatchLock.value = r;
  } catch { /* 端点不可用(旧后端)时按"不锁"处理,不阻断打开单据 */ }
}, { immediate: true });

// 文书默认值:文书面板的「新增」= directAdd 建一张空白草稿(库端 saved='N'),此时 draftEditable 为真,
// 本 watch 生效。锁定字段(申请立项人/负责人)只在「本次新增且尚未保存过」时带出——用 isFreshAddedDoc()
// 判定(跨刷新可靠),绝不在打开既有单据时改它,否则弃审后再打开会把申请人改成操作人(冒名)。
// 默认值真源见 core/panel/docDefaults.js
// 注意:watch getter 在 setup 时立即求值,必须位于 draftEditable/cur 定义之后
watch(
  () => [isApprovalDoc.value, draftEditable.value, cur.value?.['单据编号']],
  () => {
    if (!isApprovalDoc.value || !draftEditable.value || !cur.value) return
    applyDocDefaults(panelCode.value, cur.value, user, { isNew: isFreshAddedDoc(), today: todayStr() });
  },
);

// 采购入库单批次号(2026-10-04 口径变更):批次号不再由前端「按单据日期预设」——
// 它由**服务端在生单那一刻**定稿(供应商编码去掉 YJ- 前缀 + `-` + 生单当天 yyyyMMdd,如 YJ-TX ⇒ TX-20260910),
// 并沿 暂收 → 检验 → 入库 逐站继承;BatchService.syncBatchNo 在每次保存/审核时把单头值同步到全部明细行。
// 因此这里**不再需要**「单据日期 → 批次号」联动(旧的 applyDocDefaults/syncBatchNoWithDocDate 调用已删除):
// 前端再预设一个纯日期的号,只会与生单继承来的号打架(格式也不同)。

watch(cur, (v) => {
  current.value = v;
  markSavedSnapshot(); // 基线快照跟随当前单据:静默切单后不重打会快照错位,导致后续误判"有未保存修改"
  detailRefVisible.value = false;
  detailRefPick.value = null;
  // 产成品→材料联动：默认不选中（点击产成品明细行才过滤材料明细），切换单据时重置
  if (selectedProduct.value) selectedProduct.value = null;
});

/** 面板内切单守卫(翻页/点行):当前单有未保存修改时弹三态窗,干净则直切 */
async function guardDocSwitch(nextIdx) {
  if (nextIdx === curIdx.value) return
  if (guardAsking) return // 弹窗进行中:忽略后续切单动作,防绕过弹窗
  if (!hasUnsavedChanges()) { curIdx.value = nextIdx; return }
  guardAsking = true;
  pendingLeave.value = null;
  pendingAction = async () => { curIdx.value = Math.min(nextIdx, Math.max(0, list.value.length - 1)); };
  askUnsavedLeave();
}

/** 翻页动作守卫(含跨页):脏时弹三态窗,选择后执行原翻页逻辑 */
async function guardPageAction(run) {
  if (guardAsking) return // 弹窗进行中:忽略后续动作,防绕过弹窗
  if (!hasUnsavedChanges()) { await run(); return }
  guardAsking = true;
  pendingLeave.value = null;
  pendingAction = run;
  askUnsavedLeave();
}

// ═══ 左侧「单据选择」栏(对齐 PANDA 暂收入库单选择):按面板启用,点行切换右侧当前单据 ═══
// 值=该单据左栏的中间列(重要字段);首列单号/次列日期/末列审核状态由下方组装兜底(键含各单据别名);
// 中间列支持字符串(行键)或列对象(derive 派生列,如采购入库的 ERP 状态)
/** 左栏「单据选择」每页条数(整页翻的步长;2026-09-20 按用户口径统一 50 条,
 *  原 QC_RECV/QC_INSP/QC_RETURN 面板配置是 20 条 → 带左栏的面板一律按此值分页) */
const DOC_RAIL_PANELS = {
  QC_RECV: ['供应商', '采购订单号', '批次号'],   // 送料暂收单(2026-09-20 面板编码由 SL_RECV 改;原「部门」列实测 12 单仅 1 单有值,按链路可见性换成采购订单号,再加批次号)
  QC_INSP: ['供应商', '采购订单号', '批次号'],   // 来料检验单(「部门」11 单全空,换采购订单号;批次号随链带入)
  QC_RETURN: ['供应商', '检验单号', '批次号'],   // 暂收退料单(qc_return 无「部门」列,恒空;检验单号可直接追到检验单)
  PU_ORDER: ['供应商'],          // 采购订单(币种列 2026-09-16 按用户口径删)
  SO_ORDER: ['客户'],            // 销售订单(对齐采购订单:中间列只留往来单位,采购=供应商/销售=客户)
  PURCHASE_IN: ['供应商', '批次号', {   // 采购入库单(入库类别列 2026-09-16 按用户口径换成 ERP 转入状态;2026-09-20 加批次号)
    label: 'ERP单', align: 'center', tag: true,
    // 已转=转ERP成功才有(ERP单号成功回填/弃审清空;是否已转ERP 未入 yj_field 不随行下发,作首选信号)
    derive: (row) => (String(row?.['是否已转ERP'] ?? '') === '是' || String(row?.['ERP单号'] ?? '').trim() !== '' ? '已转' : '未转'),
  }],
};
const docRailCfg = computed(() => {
  const middles = DOC_RAIL_PANELS[panelCode.value];
  if (!middles) return null
  const columns = [
    { label: '单号', keys: ['编号', '单据编号', '单号'], align: 'left', no: true },
    { label: '日期', keys: ['日期', '单据日期'], align: 'left' },
    ...middles.map((m) => (typeof m === 'string' ? { label: m, keys: [m], align: 'left' } : m)),
    { label: '审核状态', keys: ['单据状态'], align: 'center', tag: true },
  ];
  return { title: (panelName.value || '') + tt('选择'), columns }
});
const railCollapsed = ref(false);
const railCurNo = computed(() => {
  const c = cur.value || {};
  return String(c['编号'] || c['单据编号'] || c['单号'] || '')
});
function onRailSelect(idx) {
  guardPageAction(async () => { curIdx.value = idx; });
}

/** 左栏「单据选择」翻页条:整页翻(每页 RAIL_PAGE_SIZE 条),页号即后端分页页号。
 *  翻页后当前单据落到新页首张(与顶部「下一张」跨页行为一致),未保存草稿走同一离开守卫。 */
function onRailPage(target) {
  const t = Math.min(Math.max(1, Math.round(target) || 1), lastPage.value);
  if (t === query.pageNo) return
  guardPageAction(async () => { query.pageNo = t; await load(); curIdx.value = 0; });
}

/** 左栏「单据选择」模糊搜索:**全库跨页**(把关键字交给后端 keyword,对各字段列 LIKE),
 *  「共有数据」与总页数随之变成命中结果;清空关键字即回到全量。 */
function onRailSearch(kw) {
  const k = String(kw || '').trim();
  if (k === (query.keyword || '')) return
  guardPageAction(async () => { query.keyword = k; query.pageNo = 1; await load(); curIdx.value = 0; });
}

async function page(delta) {
  const l = list.value;
  if (!l.length) return
  const nxt = curIdx.value + delta;
  if (nxt >= 0 && nxt < l.length) {
    await guardDocSwitch(nxt);
    return
  }
  // 翻页判据必须用「全局位置」:l.length 只在末页才小于 total,
  // 旧写法 l.length < total 在任意非末页都成立 → 末页点「下一张」会翻出空白页(2026-09-20 修)
  const globalIdx = (query.pageNo - 1) * query.pageSize + Math.min(curIdx.value, l.length - 1);
  if (delta > 0 && globalIdx + 1 < total.value && query.pageNo < lastPage.value) {
    await guardPageAction(async () => { query.pageNo += 1; await load(); curIdx.value = 0; });
    return
  }
  if (delta < 0 && query.pageNo > 1) {
    await guardPageAction(async () => { query.pageNo -= 1; await load(); curIdx.value = list.value.length - 1; });
    return
  }
  // 边界翻页（第 1 张点上一张/末张点下一张/仅 1 张）:动作为空,但当前草稿未保存仍需弹守卫——
  // 否则「新增后落在第 1 张点翻页」永远不触发提示(规范 §6.2);干净单据保持原样无感直过
  await guardPageAction(async () => {});
}

async function pageFirst() {
  if (!list.value.length) return
  await guardPageAction(async () => { if (query.pageNo > 1) { query.pageNo = 1; await load(); } curIdx.value = 0; });
}

async function pageLast() {
  if (!list.value.length) return
  await guardPageAction(async () => { if (query.pageNo < lastPage.value) { query.pageNo = lastPage.value; await load(); } curIdx.value = list.value.length - 1; });
}

// ══════════ 明细区块模型（配置驱动，见 docs/frontend/前端面板设计.md）══════════
// 视图状态：view[blockId + ':tab'] = 当前页签 key；view[blockId + ':' + tabKey + ':view'] = 'detail' | 'summary'
const view = reactive({});
const blocks = computed(() => buildBlocks(cfgCache.value));

// ══════════ 主表预览表格（mainTable 配置，如工艺路线主表；点行切换当前单据，下方明细联动）══════════
const mainGrid = computed(() => {
  const tp = cfgCache.value?.metadata?.panelPageDto?.tablePages?.[0];
  return tp?.mainTable || null
});
const mainCols = computed(() => (mainGrid.value?.columns || []).filter((c) => c !== '序号'));
// ── 表头点击排序(2026-09-09 通用规则):每张表格自己一个排序状态,单键排序(点别的列覆盖前一列),升→降→取消 ──
// 明细块按 块id:页签 分别记状态;主表预览独立一份;报表沿用 reportCols.sort(后端持久化那套不动)。
const mainSort = reactive({ prop: '', order: '' });
const blockSorts = reactive({});
function blockSortOf(b) {
  const key = `${b.id}:${activeTab(b)?.key || ''}`;
  if (!blockSorts[key]) blockSorts[key] = { prop: '', order: '' };
  return blockSorts[key]
}
/** 点击角标:升 → 降 → 取消(状态对象就地更新) */
function cycleSort(state, prop) {
  const next = nextSortState(state, prop);
  state.prop = next.prop;
  state.order = next.order;
}
/** 视图排序:占位行不参与;按字段类型选比较器;不改行数据、不改原数组 */
function sortViewRows(rows, state) {
  if (!state || !state.prop || !state.order) return rows
  return sortRows(rows.filter((r) => !r._placeholder), {
    prop: state.prop, order: state.order, field: fieldDefOf(state.prop),
  })
}
function sortCaret(state, prop) {
  if (!state || state.prop !== prop || !state.order) return '⇅'
  return state.order === 'asc' ? '▲' : '▼'
}
function isSortOn(state, prop) {
  return !!state && state.prop === prop && !!state.order
}
function resetTableSorts() {
  mainSort.prop = '';
  mainSort.order = '';
  Object.keys(blockSorts).forEach((key) => delete blockSorts[key]);
}
// 报表表头沿用同一循环口径(底层仍是 reportCols.sort,栏目设置的后端持久化不变)
function cycleReportSort(prop) {
  const next = nextSortState(reportCols.sort, prop);
  reportCols.setSort(next.prop, next.order);
}
function reportSortCaret(prop) {
  if (reportCols.sort.prop !== prop || !reportCols.sort.order) return '⇅'
  return reportCols.sort.order === 'asc' ? '▲' : '▼'
}
function reportSortOn(prop) {
  return reportCols.sort.prop === prop && !!reportCols.sort.order
}
// 主表固定 5 行（不足补占位，与明细区一致）
const mainRows = computed(() => {
  const l = list.value;
  if (!l.length) return []
  const filtered = applyAdvFilters(applyColFilters(l.map((r) => r), mainCols.value.map((c) => ({ prop: c }))));
  // 排序在取前 5 行之前:排序后看到的是"本页该字段前 5 条",而不是"前 5 条里再排"
  // 生产加工单=工单列表形态(2026-09-24):预览行数放开到 20(其余面板保持 5 行预览)
  const LIMIT = panelCode.value === 'MANU_ORDER' ? 20 : 5;
  const rows = sortViewRows(filtered, mainSort).slice(0, LIMIT);
  while (rows.length < LIMIT) rows.push({ _placeholder: true });
  return rows
});
async function onMainRowClick(row) {
  const i = list.value.indexOf(row);
  if (i >= 0) await guardDocSwitch(i);
}
function mainRowCls({ row }) {
  if (row._placeholder) return 'ph-row'
  return row === cur.value ? 'row-cur' : ''
}


// ═══ 采购订单表头「送料」只读摘要(方案 A 轻量版,2026-09-21)═══════════════════
// 页面结构一点不动:只在表头字段区末尾多**一行只读文字**,点它弹一个小浮层(批次窄表)。
// 性能:仅「采购订单 + 已审批」的单据在**切换单据时**请求一次批次数据(按单号缓存);
//       点开浮层时强制刷新一次(保证看的时候是最新);不点不看 = 不产生额外请求。
const APPROVED_STATUS_VALUES = ['已审批', '已通过']; // 审批判据统一:后端只产 '已通过',历史数据有 '已审批'
const batchTab = reactive({ doc: '', loading: false, rows: [], sum: { batches: 0, pending: 0, sent: 0, left: 0, ret: 0 } });
const batchPopover = ref(false);
const showBatchSummary = computed(() => panelCode.value === 'PU_ORDER' && !!curDocNo.value
  && APPROVED_STATUS_VALUES.includes(String(cur.value?.['审批状态'] || ''))
  && String(cur.value?.['单据状态'] || '') !== '已中止');
async function loadBatchTab(docNo, force = false) {
  if (!docNo || (batchTab.doc === docNo && !force)) return
  batchTab.doc = docNo;
  batchTab.loading = true;
  try {
    const res = await engine.batchFlowLines({ sourcePanel: panelCode.value, targetPanel: BATCH_SUMMARY_TARGET, sourceNo: docNo });
    batchTab.rows = res?.batches || [];
    const lines = res?.lines || [];
    batchTab.sum = {
      batches: batchTab.rows.length,
      // 待编号批次数(台账 status='PENDING',批次号留空 —— 采购入库单审核时才取号)
      pending: batchTab.rows.filter((r) => r.status === 'PENDING').length,
      // 明细行数量合计(位数跟明细走,见 @core/panel/sumTotals)
      sent: sumKeepScale(lines.map((l) => l.已送数量)) ?? 0,
      left: sumKeepScale(lines.map((l) => l.剩余数量)) ?? 0,
      ret: sumKeepScale(lines.map((l) => l.已退回数量)) ?? 0,
    };
  } catch { batchTab.rows = []; batchTab.sum = { batches: 0, pending: 0, sent: 0, left: 0, ret: 0 }; } finally { batchTab.loading = false; }
}
/** 浮层里点批次行 = 跳到该批次生成的送料暂收单(已走到下游则直达链路终点) */
function onBatchTabRow(row) {
  const no = row?.targetFormNo;
  // 整链皆作废/单据不存在:后端已置空并标 targetInvalid,不跳(列表按状态过滤,跳过去是空白页)
  if (!no || row?.targetInvalid) return
  const panel = row.targetPanel || BATCH_SUMMARY_TARGET;
  const base = `/panelx/list/${panel}`;
  batchPopover.value = false;
  tabs.open({ path: base, title: panel });
  router.push({ path: base, query: { docNo: no } });
}
watch(
  () => [panelCode.value, curDocNo.value, String(cur.value?.['审批状态'] || '')],
  ([pc, no, st]) => {
    if (pc === 'PU_ORDER' && no && APPROVED_STATUS_VALUES.includes(st)) loadBatchTab(no);
  },
  { immediate: true }
);
watch(batchPopover, (open) => { if (open && curDocNo.value) loadBatchTab(curDocNo.value, true); });
// 摘要行的落位:排在**所有表头字段之后**(DOM 顺序即最后一项)——表头字段怎么改(显隐/栏目设置/顺序),
// 摘要行始终跟在最后一个字段后面;浮层锚点再排其后,故浮层永远落在字段区末尾。
function buildBlocks(cfg) {
  if (!cfg) return []
  const tp = cfg.metadata?.panelPageDto?.tablePages?.[0];
  const gt = tp?.gridTabs || [];
  const tabs = cfg.detail?.tabs || [];
  const out = [];
  const mkTab = (key, label, cols, summaryItems, sumLabel, hasSummary, columnAliases) => ({ key, label, cols, summaryItems, sumLabel, hasSummary, columnAliases });
  /** 从字段定义构造列别名(dataName→displayName),补 gridTabs 未覆盖的页签。 */
  const aliasesOfFields = (fields) => {
    const m = {};
    for (const f of fields || []) {
      if (f.displayName && f.dataName && f.displayName !== f.dataName) m[f.dataName] = f.displayName;
    }
    return m
  };
  // A 区：优先 gridTabs[0]，其次 detail.tabs[0]（页签 = 明细 + 汇总）
  const first = tabs[0];
  const mainCols = gt[0]?.columns || (first ? (first.fields || []).filter((f) => !f.hidden).map((f) => f.dataName) : []);
  if (mainCols.length) {
    const sumItems = first?.summaryItems || [];
    const label = gt[0]?.label || first?.label || '明细';
    const hasSummary = !!(gt.length > 1 && gt[1]?.summary) || sumItems.length > 0;
    // 列别名:gridTabs.columnAliases(后端按 locale 供给)优先,detail 字段 displayName 兜底
    const mainAliases = { ...aliasesOfFields(first?.fields), ...(gt[0]?.columnAliases || {}) };
    out.push({
      id: 'A', isMain: true,
      tabs: [mkTab(first?.key || 'items', label, mainCols, sumItems, gt[1]?.label || (sumItems.length ? label + '汇总' : ''), hasSummary, mainAliases)],
    });
  }
  // B 区：detail.tabs[1..n] 合并为一个区块、页签内切换（同 T+：材料明细/工序明细共区块）
  const rest = tabs.slice(1).map((t) => {
    const cols = (t.fields || []).filter((f) => !f.hidden).map((f) => f.dataName);
    return cols.length ? mkTab(t.key, t.label, cols, t.summaryItems || [], t.summaryItems?.length ? t.label + '汇总' : '', !!(t.summaryItems?.length), aliasesOfFields(t.fields)) : null
  }).filter(Boolean);
  if (rest.length) out.push({ id: 'B', isMain: false, tabs: rest });
  return out
}

function activeTab(b) {
  const k = view[b.id + ':tab'];
  return b.tabs.find((t) => t.key === k) || b.tabs[0]
}

function tabView(b, t) {
  return view[b.id + ':' + t.key + ':view'] === 'summary' ? 'summary' : 'detail'
}

// 页签头条目：明细页签 + 汇总页签 依次展开
function headItems(b) {
  const out = [];
  for (const t of b.tabs) {
    out.push({ kind: 'tab', key: t.key, label: t.label });
    if (t.hasSummary) out.push({ kind: 'sum', key: t.key, label: t.sumLabel });
  }
  return out
}

function isOn(b, item) {
  const cur = activeTab(b);
  if (cur.key !== item.key) return false
  return item.kind === 'sum' ? tabView(b, cur) === 'summary' : tabView(b, cur) !== 'summary'
}

function switchTab(b, item) {
  view[b.id + ':tab'] = item.key;
  view[b.id + ':' + item.key + ':view'] = item.kind === 'sum' ? 'summary' : 'detail';
}

// 明细数据：单据类取 cur.detail[block.key]；平铺类（档案/报表）把当前行当明细
function detailRows(b) {
  const d = cur.value.detail;
  if (d && Array.isArray(d[b.key])) return d[b.key]
  if ((b.cols || []).some((c) => cur.value[c] !== undefined)) return [cur.value]
  return []
}

const KNOWN_NUM = ['数量', '实收数量', '报工数量', '合格数量', '不合格数量', '工价', '计时/计件金额', '金额', '含税金额', '含税单价', '单价', '税额', '现存量', '需用数量', '损耗数量', '计划数量', '累计领用数量', '齐套数量(主)', '累计汇报套数(工序单位)', '总重', '单重', '委外金额', '委外税额', '委外含税金额', '换算率', '可报工数量', '累计汇报数量'];

function numericCols(rows, b) {
  const fromItems = (b.summaryItems || []).map((it) => it.field);
  const known = (b.cols || []).filter((c) => KNOWN_NUM.includes(c) && rows.every((r) => Number.isFinite(Number(r[c]))));
  return [...new Set([...fromItems, ...known])].filter((c) => (b.cols || []).includes(c))
}

function groupKeyOf(b) {
  return b.keyField || ['存货编码', '产品编码', '材料编码', '存货名称', '产品名称', '材料名称'].find((k) => (b.cols || []).includes(k)) || (b.cols || [])[0] || '编号'
}

// 汇总：按 编码/名称 分组 + 合计行（对齐 T+ 汇总页签）
// 位数口径(2026-10-03 用户报「明细与合计小数点后位数有差距」):分组小计与合计行都走
// sumKeepScale —— 位数跟本列明细走，顺带吃掉裸加的浮点尾差(1.1+2.2 曾显示 3.3000000000000003)
function summaryRows(rows, b) {
  if (!rows.length) return []
  const keyField = groupKeyOf(b);
  const numeric = numericCols(rows, b);
  const group = new Map();   // 组键 → 组基础行(已剔除汇总列，避免分组行把首行原值又累加一次)
  const cells = new Map();   // 组键 → { 列: [该组明细值...] }
  for (const r of rows) {
    const k = r[keyField] || '(空)';
    if (!group.has(k)) {
      const base = { ...r };
      for (const c of numeric) delete base[c];
      group.set(k, base);
      cells.set(k, Object.fromEntries(numeric.map((c) => [c, []])));
    }
    const bucket = cells.get(k);
    for (const c of numeric) bucket[c].push(r[c]);
  }
  const out = [];
  for (const [k, base] of group) {
    const bucket = cells.get(k);
    for (const c of numeric) base[c] = sumKeepScale(bucket[c]) ?? 0;
    out.push(base);
  }
  const total = {};
  for (const c of numeric) total[c] = sumKeepScale(rows.map((r) => r[c])) ?? 0;
  out.push({ [keyField]: '合计', ...total });
  return out
}

// 所有表格固定展示 5 行：不足补空占位行（{_placeholder:true}），超出 5 行鼠标滚动（见 docs/frontend/前端面板设计.md）
function blockData(b) {
  const t = activeTab(b);
  let rows = detailRows(t);
  // 产成品→材料联动过滤：点产成品行后，材料明细只显示该产品的 BOM 子件（按材料行自身 子件BOM 存储值）
  if (t.key === 'materials' && selectedProduct.value) {
    const byBom = rows.filter((m) => m['子件BOM'] === selectedProduct.value);
    if (byBom.length) rows = byBom;
  }
  return tabView(b, t) === 'summary' ? summaryRows(rows, t) : rows
}

function blockRows(b) {
  const filtered = applyAdvFilters(applyColFilters(blockData(b).map((r) => r), blockCols(b)));
  // 视图排序(不改行数据):占位行在排序之后补,不参与比较
  const out = sortViewRows(filtered, blockSortOf(b));
  // 工艺路线(ROUTE)口径(2026-10-06 用户口径「直接选工序就能带进来并新增一行,不必先点新增数据」):
  //   末行之后**恒留一个空占位行** —— 点它即 onRowClick → openBlankDetailRow(推一行 + 直接开「工序编码」参照),
  //   确认后新行带着工序落在末尾。原因是原规则(不足 MIN_ROWS 才补空行)在行数 ≥5 时一个空行都不补,
  //   用户眼里"没有可点的空行",只能先点「新增数据」再点新行的工序格 —— 正是被报的那条路径。
  //   占位行只是显示物(_placeholder):进出都不落库、不参与合计/校验,对其它面板零影响。
  const minRows = panelCode.value === 'ROUTE' ? Math.max(MIN_ROWS, out.length + 1) : MIN_ROWS;
  while (out.length < minRows) out.push({ _placeholder: true });
  return out
}

// ═══ 档案大表分页渲染(2026-09-16):数据全量驻留内存(保存语义"缺席行=已删除"不变),
// DOM 只渲染当前页 —— 商品等几千行×几十列的档案页全量渲染会把 DOM 撑到十几万格导致整页卡死;
// 全部 singleDoc 档案面板(INV/KHDA/GFDA/EMP/WH/PARTNER/DEPT/UOM/REGION/ZDGL…)走同一通道自动生效。
// 分页器形态(用户口径):总数 + 每页条数下拉(默认100) + 左右箭头 + 输入跳页(不要数字页码按钮) ═══
const archPageSize = ref(50);
const ARCH_SIZE_OPTS = [50, 100, 200, 500];
const archPage = ref(1);
function onArchSizeChange() { archPage.value = 1; } // 换每页条数后回首页

// ═══ 档案二维码标签(勾选即打):工具栏「二维码标签」按行勾选 → 75×100mm 标识卡(print-formats 本地生成)。
// 勾选集自管(Set 换新触发响应式),跨页/跨筛选保留;行键 = 后端 metadata.qrLabelKey(INV=存货编码),
// 同码行勾一个即代表该码;WHLOC 库位(2026-09-28)另带 qrLabelScopeKey=仓库 ⇒ 行键=仓库+库位编码 复合
// (库位编码按仓内唯一,同码多仓不串选)。 ═══
const qrSel = ref(new Set());
const qrKey = computed(() => cfgCache.value?.metadata?.qrLabelKey || '');
const qrScopeKey = computed(() => cfgCache.value?.metadata?.qrLabelScopeKey || '');
function qrRowKey(row) {
  const k = String(row?.[qrKey.value] ?? '').trim();
  // 复合行键(库位):仓库 + \u0001 + 库位编码 —— \u0001 不出现在业务文本里,避免拼接歧义
  const scope = qrScopeKey.value ? String(row?.[qrScopeKey.value] ?? '').trim() : '';
  return scope ? `${scope}\u0001${k}` : k
}
function qrToggleRow(row) {
  const k = qrRowKey(row);
  if (!k) return
  const s = new Set(qrSel.value);
  if (s.has(k)) s.delete(k);
  else s.add(k);
  qrSel.value = s;
}
function qrVisibleRows(b) { return pagedBlockRows(b).filter((r) => !r._placeholder) }
function qrPageAllChecked(b) {
  const rows = qrVisibleRows(b);
  return rows.length > 0 && rows.every((r) => qrSel.value.has(qrRowKey(r)))
}
function qrPageSomeChecked(b) {
  const rows = qrVisibleRows(b);
  return !qrPageAllChecked(b) && rows.some((r) => qrSel.value.has(qrRowKey(r)))
}
function qrTogglePage(b, on) {
  const s = new Set(qrSel.value);
  for (const r of qrVisibleRows(b)) {
    const k = qrRowKey(r);
    if (!k) continue
    if (on) s.add(k);
    else s.delete(k);
  }
  qrSel.value = s;
}

// ═══ 生产工单:打印工单 / 排产(2026-09-24 用户要求,按钮挂 MANU_ORDER 面板) ═══
// 打印工单=生产任务单固定版式(print-formats.printProductionTask,与工单排产看板同一实现)+ 打印留痕;
// 排产=本单快捷排线(弹窗选产线/日期/数量 → 复用排产工作台 assign:仅已审核可排/数量守恒/停用线拒绝/留痕)。
const moSchVisible = ref(false);
const moSchNo = ref('');
const moSchLine = ref('');
const moSchStart = ref('');
const moSchEnd = ref('');
const moSchQty = ref(null);
const moSchLines = ref([]);

/** 当前生产工单单号:头键=合同号(list 行/表单一致) */
function moDocNo(row) {
  const r = current.value || {};
  return String(r['合同号'] || r['单据编号'] || r['编号'] || '').trim()
}

async function openPanelPrintWorkOrder() {
  const no = moDocNo();
  if (!no) return ElMessage.warning(tt('请先选择一张单据'))
  try {
    const res = await engine.getFormDescriptor({ panelCode: panelCode.value, code: no });
    const doc = res?.data || {};
    const lines = Object.values(res?.detailData || {})[0] || [];
    const l = lines[0] || {};
    const qty = doc['排产数量'] ?? l['排产数量'] ?? '';
    const perBox = l['每箱数量'] ?? '';
    const rows = [{
      加工单号: no,
      客户: doc['客户'] || '',
      产品名称: l['产品名称'] || '',
      批号: doc['批号'] || l['批号'] || '',
      规格型号: l['规格型号'] || '',
      重点管控: doc['重点管控'] || '',
      客户PO: doc['销售订单号'] || '',
      排产数量: qty,
      每箱数量: perBox,
      箱数: Number(perBox) > 0 ? Number(qty) / Number(perBox) : '',
      计划完工日期: String(doc['预完工日'] || '').slice(0, 10),
      备注: doc['备注'] || '',
      生产线: doc['生产线'] || '',
    }];
    const sent = await printProductionTask(rows, { line: rows[0].生产线, preparedBy: user.realName });
    try {
      await request.post('/px/scheduleBoard/printStamp', { rows: [{ 加工单号: no }] });
    } catch { /* 留痕失败不阻断打印 */ }
    if (sent) ElMessage.success(tt('已发送打印'));
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('打印失败'));
  }
}

/** 打开本单排产弹窗:产线源=排产工作台 stats(启用线 + 当日负荷/日产能) */
async function openPanelSchedule() {
  const no = moDocNo();
  if (!no) return ElMessage.warning(tt('请先选择一张单据'))
  try {
    const stats = await request.post('/px/scheduleBoard/stats', {});
    moSchLines.value = (stats.data?.['产线'] || []).filter((l) => !l['停用']);
  } catch { moSchLines.value = []; }
  const cur = current.value || {};
  moSchNo.value = no;
  moSchLine.value = cur['生产线'] || '';
  moSchStart.value = String(cur['预开工日'] || '').slice(0, 10);
  moSchEnd.value = String(cur['预完工日'] || '').slice(0, 10);
  moSchQty.value = Number(cur['排产数量']) || null;
  moSchVisible.value = true;
}

async function submitPanelSchedule() {
  if (!moSchLine.value) return ElMessage.warning(tt('请选择生产线'))
  try {
    const res = await request.post('/px/scheduleBoard/assign', {
      rows: [{
        加工单号: moSchNo.value,
        生产线: moSchLine.value,
        预开工日: moSchStart.value || undefined,
        预完工日: moSchEnd.value || undefined,
        排产数量: moSchQty.value || undefined,
      }],
    });
    const d = res.data || {};
    const rc = (d['产线回执'] || []).map((l) => `${l['生产线']}:${tt('今日负荷')}${l['今日负荷'] ?? 0}/${tt('日产能')}${l['日产能'] ?? 0}${l['提示'] === '超载' ? ' ⚠' + tt('超载') : ''}`).join('；');
    const failed = d['失败行'] || [];
    if (failed.length) ElMessage.warning(failed[0]);
    else ElMessage.success(`${tt('已排产')} ${moSchNo.value} → ${moSchLine.value}` + (rc ? `（${rc}）` : ''));
    moSchVisible.value = false;
    await search();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('排产失败'));
  }
}
/** 档案行非响应化(2026-09-16 四期,入口卡顿主因):几千行×几十列被 Vue 深度代理
 *  (首次全量过滤/排序/快照访问 ≈29 万属性走 proxy get)是"点进页面转圈"的最大开销源(实测单一 4.4s 长任务)。
 *  将档案明细数组与行 markRaw 后,读取零代理;写入(编辑/带回/新增)经 markInlineDirty
 *  统一 bump archVersion 驱动视图与计算刷新——所有写路径本就必须置脏(守卫语义),天然闭环。
 *  ⚠ markRaw 必须打在原始对象上:打在 reactive 代理上无效(标记不落 target)。
 *  load 侧在赋给 list.value 之前处理(对象必然是原始的);本函数兜底带 ref 替换/追加的场景,经 toRaw 取原件。 */
const archVersion = ref(0);
function normalizeArchRaw() {
  if (!singleDocMode.value) return
  const doc = toRaw(cur.value || {});
  const detail = doc?.detail;
  if (!detail) return
  let touched = false;
  for (const rows of Object.values(detail)) {
    if (!Array.isArray(rows)) continue
    if (!rows.__v_skip) { markRaw(rows); touched = true; }
    for (const r of rows) if (r && typeof r === 'object' && !r.__v_skip) { markRaw(r); touched = true; }
  }
  if (touched) archVersion.value++;
}
/** 载入的档案文档在进入响应式系统前预打 raw 标记(load 赋值 list.value 之前调用) */
function markArchListRaw(docs) {
  if (!singleDocMode.value || !Array.isArray(docs)) return
  const doc = docs[0];
  const detail = doc?.detail;
  if (!detail) return
  for (const rows of Object.values(detail)) {
    if (!Array.isArray(rows)) continue
    markRaw(rows);
    for (const r of rows) if (r && typeof r === 'object') markRaw(r);
  }
}
/** 档案行计算缓存:一次响应式变更只过滤+排序一遍 —— 此前 archTotal/pagedBlockRows/sumMethodFor/
 *  分页器/表格高度各自调 blockRows,每次渲染对几千行重复跑 4~5 遍过滤+排序,交互卡顿主因之一 */
const archRowsMap = computed(() => {
  const m = {};
  if (!singleDocMode.value) return m
  void archVersion.value; // 档案行 markRaw 后值变化无响应依赖,以版本号驱动重算(markInlineDirty/load 时 bump)
  const detail = cur.value?.detail;
  if (detail) void Object.keys(detail).length;
  for (const b of blocks.value) m[b.id] = blockRows(b);
  return m
});
function archRows(b) { return singleDocMode.value ? (archRowsMap.value[b.id] ?? blockRows(b)) : blockRows(b) }
function archTotal(b) { return archRows(b).filter((r) => !r._placeholder).length }
/** 档案列/列宽计算缓存(2026-09-16 三期):blockCols 内含 fieldDefOf 线性扫描,此前每次渲染
 *  被调 1(v-for)+N(archColW 逐列)次,商品 75 列 ≈ 5800 次字段扫描;缓存后一次变更只构建一遍 */
const archColsMap = computed(() => {
  const m = {};
  if (!singleDocMode.value) return m
  for (const b of blocks.value) {
    const cols = blockCols(b);
    const widths = new Map();
    if (cols.length <= ARCH_FIT_MAX_COLS && detailW.value) {
      const avail = detailW.value - (delMode.value ? 47 : 0);
      const sum = cols.reduce((a, x) => a + (Number(x.width) || 100), 0);
      const raw = cols.map((x) => Math.max(48, Math.round(((Number(x.width) || 100) / sum) * avail)));
      // 最小列宽钳制可能让合计偏离容器宽:差额多退少补全落到最宽列,保证恰好铺满
      const diff = avail - raw.reduce((a, v) => a + v, 0);
      if (diff !== 0) {
        const idx = raw.indexOf(Math.max(...raw));
        raw[idx] = Math.max(48, raw[idx] + diff);
      }
      cols.forEach((x, i) => widths.set(x.prop, raw[i]));
    }
    m[b.id] = { cols, widths };
  }
  return m
});
function archCols(b) { return singleDocMode.value ? (archColsMap.value[b.id]?.cols ?? blockCols(b)) : blockCols(b) }
/** 档案块可编辑性缓存:模板每格 v-if 原先调 detailEditable(b)(多层 computed 链)×3750 格;
 *  缓存后每块一次,状态变化经 computed 依赖自动刷新 */
const archEditableMap = computed(() => {
  const m = {};
  if (!singleDocMode.value) return m
  for (const b of blocks.value) m[b.id] = detailEditable(b);
  return m
});
function archEditable(b) { return singleDocMode.value ? (archEditableMap.value[b.id] ?? detailEditable(b)) : detailEditable(b) }
/** 列懒渲染(2026-09-16 五期 → 2026-09-28 升级为列级虚拟化):超宽档案(列>16 走横向滚动,
 *  如商品 55 列)视口外的列**整列不渲染**,以左右占位列撑住总宽(见 archGridCols)——
 *  五期只懒渲染单元格内容,56 个 el-table-column 组件与占位 td 仍在,CPU 剖面显示
 *  el-table 逐列/逐格更新机制(update/renderCell/getColumnElIndex)是宽表挂载长帧的主体。
 *  响应式行/列缓存与两段渲染(120ms 后扩窗)均在位;横向滚动按需进出列。 */
const archViewport = reactive({ left: -1, w: 1042, stage: 0 });
const COL_LAZY_MIN = ARCH_FIT_MAX_COLS + 1;
// 三段渲染:首帧窄窗(视口+0.3屏)最快见内容 → 120ms 扩到 0.5+1.5 屏 → 再 300ms 扩到 0.5+2.75 屏
// (常驻缓冲)。把 55 列首渲染拆成三段短任务,页面更早可交互,单段长帧 <160ms(实测)。
let colExpandTimer = 0;
function scheduleColExpand() {
  archViewport.stage = 0;
  clearTimeout(colExpandTimer);
  colExpandTimer = setTimeout(() => {
    archViewport.stage = 1;
    colExpandTimer = setTimeout(() => { archViewport.stage = 2; }, 300);
  }, 120);
}
watch(panelCode, scheduleColExpand);
// 查询弹窗面板(收发存/台账):切换面板重置(重新进入需再过条件弹窗)
watch(panelCode, () => {
  rqdDone.value = false;
  rqdRange.value = [];
  ledgerWhOptions.value = [];
  ledgerItemOptions.value = [];
});
onMounted(scheduleColExpand);
function archLazyOn(b) { return singleDocMode.value && archCols(b).length >= COL_LAZY_MIN }
let colLazyRaf = 0;
/** 可见窗口头尾缓冲(屏为单位),三段扩窗:
 *  stage 0 = 首帧窄窗(0.3+0.3,最快见内容)→ 120ms 后 stage 1(0.5+1.5)→ 再 300ms stage 2(0.5+2.75 常驻缓冲)。
 *  tail 决定滚动补窗间隔:补窗发生在滚出 (tail-margin-1) 屏之后 ⇒ tail 2.75 时约每 1.5 屏一次;
 *  一次性扩到 2.75 会让挂载出现 ~220ms 长帧,分两段扩则每段 <160ms。 */
function archWin() {
  if (archViewport.stage === 2) return { head: 0.5, tail: 2.75 }
  if (archViewport.stage === 1) return { head: 0.5, tail: 1.5 }
  return { head: 0.3, tail: 0.3 }
}
function onArchScroll(e, b) {
  if (!archLazyOn(b)) return
  const el = e.target;
  if (!el || el.scrollWidth <= el.clientWidth) return
  if (colLazyRaf) return
  colLazyRaf = requestAnimationFrame(() => {
    colLazyRaf = 0;
    const L = el.scrollLeft, W = el.clientWidth || 1042;
    const base = Math.max(0, archViewport.left);
    const win = archWin();
    // 列级虚拟化:不做逐帧窗口跟随 —— 每次窗口移动都会增删列组件,el-table 随之整表重排
    // (实测每 100px 一步就掉 ~130ms 帧)。改为「视口逼近已渲染边缘(0.25 屏内)才补窗」:
    // 补窗直接进 stage 2 常驻缓冲(前 0.5 后 2.75 屏)⇒ 连续快滚约每 1.5 屏重排一次,缓滚/停住零成本。
    if (L + W >= base + win.tail * W - 0.25 * W || L <= base - win.head * W + 0.25 * W) {
      archViewport.left = L;
      archViewport.w = W;
      if (archViewport.stage < 2) archViewport.stage = 2;
    }
  });
}
/** 列级虚拟化(2026-09-28,取代五期的单元格级占位):返回 [左占位?, …可见列…, 右占位?]。
 *  占位宽度=被隐藏列宽之和 ⇒ 表格总宽与列位置和整列渲染完全一致(滚动条不跳),
 *  可见窗口沿用五期的头尾缓冲公式(含两段渲染 expand);窗口由 archViewport 驱动(滚动 rAF 节流)。
 *  单遍累计列宽,不做逐列 O(n) 重扫。 */
function archGridCols(b) {
  const cols = archCols(b);
  if (!archLazyOn(b)) return cols
  const widths = archColsMap.value[b.id]?.widths;
  const base = Math.max(0, archViewport.left);
  const win = archWin();
  const lo = base - archViewport.w * win.head;
  const hi = base + archViewport.w * win.tail;
  const out = [];
  let x = 0, leftW = 0, rightW = 0, seen = false;
  for (const k of cols) {
    const w = widths?.get(k.prop) ?? Number(k.width) ?? 100;
    if (x + w >= lo && x <= hi) { out.push(k); seen = true; }
    else if (!seen) leftW += w;
    else rightW += w;
    x += w;
  }
  if (leftW > 0) out.unshift({ spacer: 'L', width: Math.max(1, Math.round(leftW)) });
  if (rightW > 0) out.push({ spacer: 'R', width: Math.max(1, Math.round(rightW)) });
  return out
}
function archCurPage(b) { return Math.min(archPage.value, Math.max(1, Math.ceil(archTotal(b) / archPageSize.value))) }
function pagedBlockRows(b) {
  const rows = archRows(b);
  if (!singleDocMode.value) return rows
  const real = rows.filter((r) => !r._placeholder);
  if (real.length <= archPageSize.value) return rows
  const start = (archCurPage(b) - 1) * archPageSize.value;
  return real.slice(start, start + archPageSize.value)
}
/** 档案分页时合计行仍按全量行计算,不随当前页截断;
 *  合计值走 archSums 缓存(全量行×数值列只算一遍)——此前每次翻页 el-table 重算合计,
 *  对 3850行×75列 做 ~28 万次 Number(),是翻页卡顿主因 */
const archSumsMap = computed(() => {
  const m = {};
  if (!singleDocMode.value) return m
  for (const b of blocks.value) {
    const sums = {};
    for (const c of archCols(b)) {
      const f = c.field;
      if (f && (f.dataType === '小数' || f.dataType === '整数')) {
        const vals = [];
        for (const r of archRows(b)) {
          if (r._placeholder) continue
          const v = Number(r[c.prop]);
          if (Number.isFinite(v)) vals.push(v);
        }
        // 位数跟明细走(decimal(18,4) 不再被砍成 2 位),见 @core/panel/sumTotals
        sums[c.prop] = vals.length ? sumKeepScale(vals) : '';
      }
    }
    m[b.id] = sums;
  }
  return m
});
function sumMethodFor(b, p) {
  const sums = singleDocMode.value ? archSumsMap.value[b.id] : null;
  if (!sums) return sumMethod(p)
  const { columns } = p;
  const out = [];
  columns.forEach((col, i) => { out[i] = i === 0 ? tt('合计') : (sums[col.property] ?? ''); });
  return out
}
/** 档案列铺满边框(2026-09-16):列数可容纳(≤ARCH_FIT_MAX_COLS)时按原列宽比例把容器宽度
 *  分配为像素列宽(EP 列宽不支持百分比,parseWidth 会吞掉 %),表格恒等于容器宽、无横向滚动;
 *  列过多(如商品 75 列)返回 undefined,保持像素宽+横向滚动。宽度随窗口缩放自动重算。 */
const detailW = ref(0);
const bodyH = ref(0);
function measureDetailW() {
  const el = document.querySelector('.panelx-list .detail');
  detailW.value = el ? el.clientWidth - 2 /*左右边框*/ : 0;
  const body = document.querySelector('.panelx-list .body');
  bodyH.value = body ? body.clientHeight : 0;
}
let detailRO = null;
onMounted(() => {
  nextTick(measureDetailW);
  // ResizeObserver 监听根容器:窗口缩放/侧栏拖拽等一切布局变化都触发重测(比 window.resize 可靠)
  const root = document.querySelector('.panelx-list');
  if (root && window.ResizeObserver) {
    detailRO = new ResizeObserver(() => measureDetailW());
    detailRO.observe(root);
  }
  window.addEventListener('resize', measureDetailW);
});
onUnmounted(() => { detailRO?.disconnect(); window.removeEventListener('resize', measureDetailW); });
watch(loading, () => !loading.value && nextTick(measureDetailW));
function archColW(b, c) {
  if (!singleDocMode.value) return undefined
  return archColsMap.value[b.id]?.widths.get(c.prop) // 列宽缓存一次构建(含铺满/多退少补),逐列读取 O(1)
}

function tableH(b) {
  const hasFooter = tabView(b, activeTab(b)) !== 'summary';
  // 档案页(2026-09-16):表格高度填充 .body 可用高度(到表尾备注区为止,不越过)——
  // 固定 5 行高在小数据时下方大片空白,大数据时又只有 5 行视口
  if (singleDocMode.value && bodyH.value) {
    const pagerH = archTotal(b) > ARCH_SIZE_OPTS[0] ? 40 : 0;
    return Math.max(HEAD_H + MIN_ROWS * ROW_H + (hasFooter ? FOOT_H : 0), bodyH.value - 8 - 2 - 33 - pagerH - 10)
  }
  return HEAD_H + MIN_ROWS * ROW_H + (hasFooter ? FOOT_H : 0)
}

function blockCols(b) {
  const t = activeTab(b);
  const aliases = t.columnAliases || {};
  return (t.cols || []).map((c) => {
    const f = fieldDefOf(c);
    return {
      prop: c,
      label: aliases[c] || tt(c),
      field: f,
      width: colW(f),
      align: f.dataType === '小数' || f.dataType === '整数' ? 'right' : 'left',
    }
  })
}

const showFooter = computed(() => {
  // 文书式面板(立项申请):不按表头/表中/表尾三段式,页脚(备注+审核行)整体隐藏
  if (isApprovalDoc.value) return false
  // 来料检验要求(档案特例):整表 Excel 复刻面板,无备注/审核行
  if (isQcInspReq.value) return false
  const cfg = cfgCache.value;
  return cfg?.metadata?.panelCategory === '单据' || (cfg?.detail?.tabs || []).length > 0
});

function sumMethod({ columns, data }) {
  const sums = [];
  // 占位行不参与合计
  const real = (data || []).filter((r) => !r._placeholder);
  columns.forEach((col, i) => {
    if (i === 0) {
      sums[i] = tt('合计');
      return
    }
    // 只对「小数/整数」类型的字段求和：纯数字文本（身份证号/手机号/编码）不参与合计
    const f = fieldDefOf(col.property);
    const isNumeric = f && (f.dataType === '小数' || f.dataType === '整数');
    // NaN 过滤:三段式台账的期初/期末合成行大量缺键(Number(undefined)=NaN),
    // 旧行为 every(isFinite) 会因一行的缺失清空整列合计(合计消失的根因)
    const vals = real.map((r) => Number(r[col.property])).filter((v) => Number.isFinite(v));
    if (!isNumeric || !vals.length) { sums[i] = ''; return }
    // 台账三段式:期初列合计=首值(期初),期末列合计=末值(期末结存);累计值求和无意义
    if (panelCode.value === 'STOCK_LEDGER' && String(col.property || '').startsWith('期初')) {
      sums[i] = vals[0];
      return
    }
    if (panelCode.value === 'STOCK_LEDGER' && String(col.property || '').startsWith('期末')) {
      sums[i] = vals[vals.length - 1];
      return
    }
    // 位数跟本列明细走(2026-10-03:合计原先恒 2 位,明细是 decimal(18,4) ⇒ 1.2345 被显示成 1.23)
    sums[i] = sumKeepScale(vals);
  });
  return sums
}

// 审批流：当前单据已审批 → 表格左上角「已审批」角标；已审批明细行浅绿底色
// 判据统一(2026-09-11):后端 QueryService 只产 '已通过'(shr 非空)/'审批中',历史数据里也有 '已审批',
// 两值都认;禁止各处再手写单值比较(口径见 CONTEXT.md「已审批判据」;常量见上方表头送料摘要块)。
const isApproved = computed(() => cur.value && APPROVED_STATUS_VALUES.includes(cur.value['审批状态']));

function rowCls({ row }, b) {
  if (row._placeholder) return 'ph-row'
  if (b && b.id === 'A' && row['产品编码'] && row['产品编码'] === selectedProduct.value) return 'prod-selected'
  if (APPROVED_STATUS_VALUES.includes(row['审批状态'])) return 'row-approved'
  return ['产品编码', '材料编码', '存货编码', '存货名称', '产品名称', '材料名称'].some((k) => row[k] === '合计') ? 'sum-row' : ''
}

// ---------- 明细表格列宽（按字段类型推算，横向滚动同 T+） ----------
function colW(f) {
  const t = f.dataType || '文本';
  if (t === '是否') return 74
  if (t === '图片') return 56
  if (t === '小数' || t === '整数') return 104
  if (t === '日期' || t === '日期时间') return 136
  const n = f.label || f.dataName || '';
  return n.length <= 2 ? 96 : Math.min(Math.max(n.length * 16 + 30, 96), 220)
}

// ---------- 明细右键/图标操作（作用于当前活动区块） ----------
const ctxItems = ['定位', '复制到剪贴板', '从剪贴板粘贴', '另存为EXCEL模板', '批量修改', '销售订单查询', '存货中心', '更多'];
const iconA = ['☑ Ctrl+V列粘贴', '定位', '复制到剪贴板', '从剪贴板粘贴', '另存为EXCEL模板', '批量修改', '销售订单查询', '存货中心', '更多▼'];
const iconB = ['现存量提取', '定位', '复制到剪贴板', '从剪贴板粘贴', '另存为EXCEL模板', '批量修改', '更多▼'];

const ctxBlock = ref(null);
const ctx = reactive({ visible: false, x: 0, y: 0, row: null });

const activeCols = computed(() => (ctxBlock.value ? blockCols(ctxBlock.value) : []));
const activeData = computed(() => (ctxBlock.value ? blockData(ctxBlock.value) : []));

function onCtx(ev, row, b) {
  ev.preventDefault();
  ev.stopPropagation();
  ctxBlock.value = b;
  ctx.row = row;
  ctx.x = ev.clientX;
  ctx.y = ev.clientY;
  ctx.visible = true;
}

function closeCtx() {
  ctx.visible = false;
  openGroup.value = -1;
  openDelMenu.value = false;
}

// ---------- 审批按钮权限（提交审批/审批情况公开；审批通过/驳回需角色审批权限） ----------
const APPROVE_ACTIONS = ['审批通过', '审批驳回'];
// 直接「审核」仅管理员（2026-09-22）：审批下拉最下的直审按钮收权——
// 有审批权的角色走 提交审批→审批通过（同效已审核），不再保留直审入口；后端 audit() 同口径拒绝
const ADMIN_ONLY_ACTIONS = ['审核'];

/** 处于审批流程中的状态(2026-09-20 两级审批:一级「审批中」/二级「待二级审批」) */
const IN_APPROVAL = ['审批中', '待二级审批'];

// ---------- 二级审核人选取(2026-09-20 两级审批:一级通过时必须选人) ----------
const l2PickVisible = ref(false);
const l2PickBusy = ref(false);
const l2PickUser = ref('');
const l2PickOpinion = ref('');
const l2PickUsers = ref([]);
const l2PickDocNo = ref('');
/** 一级审批通过入口:产品信息表的一级节点必须先选二级审核人,其余面板/二级节点走原确认框 */
async function openL2Pick(no) {
  l2PickDocNo.value = no;
  l2PickUser.value = '';
  l2PickOpinion.value = '';
  if (!l2PickUsers.value.length) {
    try {
      l2PickUsers.value = (await engine.rdDevUsers()) || [];
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '读取账号列表失败');
      return
    }
  }
  l2PickVisible.value = true;
}
async function confirmL2Pick() {
  if (!l2PickUser.value) return ElMessage.warning(tt('请选取二级审核人'))
  if (l2PickBusy.value) return
  l2PickBusy.value = true;
  try {
    await engine.callButton({
      panelCode: 'RD_PROD_INFO', buttonName: '审批通过',
      formData: { 编号: l2PickDocNo.value, 二级审批人: l2PickUser.value, ...(l2PickOpinion.value ? { 审批意见: l2PickOpinion.value } : {}) },
      buttonParam: {},
    });
    ElMessage.success(tt('已转交二级审核人'));
    l2PickVisible.value = false;
    await load();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '审批失败');
  } finally {
    l2PickBusy.value = false;
  }
}

function filterGroups(raw) {
  const canApprove = user.isAdmin || user.approvePanels.includes(panelCode.value);
  return (raw || [])
    .map((g) => {
      let actions = (g.actions || g.items || []).filter((a) => !(!user.isAdmin && ADMIN_ONLY_ACTIONS.includes(a)));
      if (!canApprove) actions = actions.filter((a) => !APPROVE_ACTIONS.includes(a));
      return { ...g, actions }
    })
    .filter((g) => (g.actions || []).length > 0)
}

// ---------- 项目定级(2026-09-21):立项申请表审核通过后,由审核人给项目定级 ----------
// 等级(一/二/三/四级)是后续立项(实施计划)与进度流程的属性:计划按「文档编号」参照本单时
// 由 REF_SYNONYMS(项目等级 → 项目定级)自动带回;进度查询再从计划同步。
const canGradeProject = computed(() => panelCode.value === GRADE_PANEL
  && ['已审核', '已归档'].includes(curDocStatus.value)
  && (user.isAdmin || user.approvePanels.includes(GRADE_PANEL)));
const gradeVisible = ref(false);
const gradeBusy = ref(false);
const gradeLevel = ref('');
const gradeOpinion = ref('');
/** 等级候选:取本面板「项目等级」字段的字典(一/二/三/四级,与下游同字典) */
const gradeOptions = computed(() => {
  const f = (cfgCache.value?.dataSchema?.fields || []).find((x) => (x.dataName || x.code) === '项目等级');
  return (f?.options || []).map((o) => (typeof o === 'string' ? o : (o.value ?? o.label)))
});
function openGrade() {
  if (!canGradeProject.value) return
  gradeLevel.value = String(cur.value?.['项目等级'] || '');
  gradeOpinion.value = '';
  gradeVisible.value = true;
}
async function confirmGrade() {
  if (!gradeLevel.value) return ElMessage.warning(tt('请选择项目等级'))
  if (gradeBusy.value) return
  gradeBusy.value = true;
  try {
    const no = cur.value?.['编号'] || cur.value?.['单据编号'] || '';
    await engine.callButton({
      panelCode: GRADE_PANEL, buttonName: '项目定级',
      formData: { 编号: no, 项目等级: gradeLevel.value, ...(gradeOpinion.value ? { 审批意见: gradeOpinion.value } : {}) },
      buttonParam: {},
    });
    ElMessage.success(tt('项目已定级：') + gradeLevel.value);
    gradeVisible.value = false;
    await load();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('项目定级失败'));
  } finally {
    gradeBusy.value = false;
  }
}

// ---------- 工具栏分组（配置 {name, actions}：主按钮=第一个 action，actions>1 显示 ▼ 下拉） ----------
const openGroup = ref(-1);
function actsOf(g) {
  return g.actions || g.items || []
}
// 下拉项 = 除主按钮（第一个 action）外的其余动作（2026-08-20：避免下拉与组按钮重复）
function dropItems(g) {
  return actsOf(g).slice(1)
}
function btnName(g) {
  return actsOf(g)[0] || g.name
}
function toggleGroup(gi) {
  openGroup.value = openGroup.value === gi ? -1 : gi;
}
function onGroupAction(a) {
  openGroup.value = -1;
  // 2026-08-25：灰按钮（如草稿态「生成XX」）点击不执行、不弹提示
  if (isDisabled(a)) return
  onButton(a);
}

// 文书面板右侧操作栏:默认展开,可收纳(收起为窄条,点击标题切换)
const sideCollapsed = ref(false);
// ══════════ 文书式面板:导出 = 整张文书打印/存PDF(浏览器原生,所见即所得) ══════════
const approvalSheetRef = ref(null);
/** 删除组下拉动作:收起菜单后走统一入口(删除带整单确认) */
function pickDelAction(a) {
  openDelMenu.value = false;
  onSideAction(a);
}
function onSideAction(a) {
  // 导出:文书面板=选择格式导出(PDF/Excel 分离,打印按钮独立);控制列表=完整 Excel(全字段+全数据)
  if (isApprovalDoc.value && a === '导出') {
    exportFmtVisible.value = true;
    return
  }
  // 删除确认与整单语义统一在 onButton(isApprovalDoc 分支)处理
  if (isDisabled(a)) return
  onButton(a);
}

// ── 文书面板导出:格式选择(PDF / Excel);打印为独立按钮不经过这里 ──
const exportFmtVisible = ref(false);
/** 导出 PDF:浏览器内直接生成 .pdf 下载,不弹打印对话框/无需打印机。
 *  页面尺寸=纸张实际尺寸单页输出(不套 A4)。截图用 modern-screenshot(SVG foreignObject,
 *  无 iframe 克隆)——根治 html2canvas 的 "Unable to find element in cloned iframe"。
 *  宽表(压降/精度等 ~1300px)整张不截的关键:**离屏克隆 + 按纸宽强制布局**——
 *  根节点 max-width:100% 在窄窗下 computed width 被压缩,直接截原元素时 foreignObject
 *  里的克隆树仍按窄宽排版(画布再宽也只排半张);克隆体显式定宽+去 max-width 再截,一次到位。 */
async function exportSheetPdf() {
  exportFmtVisible.value = false;
  // $el 在 dev 下可能是 fragment 注释锚点(组件含多个 append-to-body 弹窗)——不是元素时按纸张根类名兜底
  const el0 = approvalSheetRef.value?.$el;
  const el = el0 instanceof HTMLElement && el0.offsetWidth > 0 ? el0 : document.querySelector(
    '.approval-layout .record-sheet, .approval-layout .approval-sheet, .approval-layout .progress-sheet, .approval-layout .catalog-sheet, .approval-layout .qc-rec-sheet');
  if (!el || !(el instanceof HTMLElement)) return ElMessage.warning(tt('未找到可导出的单据'))
  const loadingMsg = ElMessage({ message: tt('正在生成 PDF…'), duration: 0 });
  let holder = null;
  try {
    const [{ domToPng }, { jsPDF }] = await Promise.all([__vitePreload(() => import('./index-NPOMfl-z.js'),true              ?[]:void 0), __vitePreload(() => import('./jspdf.es.min-B__CRW4f.js').then(n => n.j),true              ?__vite__mapDeps([0,1,2,3,4,5]):void 0)]);
    await nextTick();
    // 纸宽=scrollWidth(max-width:100% 压缩 offsetWidth 时,内容横向溢出,scrollWidth 才是整张纸)
    const w0 = Math.max(el.scrollWidth, el.offsetWidth);
    holder = document.createElement('div');
    holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${w0}px;background:#ffffff;`;
    const clone = el.cloneNode(true);
    clone.style.width = w0 + 'px';
    clone.style.maxWidth = 'none';
    clone.style.overflow = 'visible';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    // 双 raf:等克隆体按全宽完成重排再量高(窄窗换行多,原元素高度偏大;全宽布局高度才是纸高)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const h0 = Math.max(clone.scrollHeight, clone.offsetHeight, el.scrollHeight);
    const scale = 2;
    const dataUrl = await domToPng(clone, {
      scale,
      backgroundColor: '#ffffff',
      width: w0,
      height: h0,
      // 隐藏编辑态元素(字段编辑/标准库/终止横幅等),与打印口径一致
      filter: (node) => !(node instanceof HTMLElement && node.classList?.contains?.('no-print')),
    });
    // 页面尺寸用 mm + 自算 96dpi 换算(1px=25.4/96mm):jsPDF 的 px 单位换算因子与 CSS 不一致,
    // 会标出 598×980mm 巨页、内容只占一部分(边框缩成发丝看不见)——mm 直算保证页面=纸张真实物理尺寸
    const MM = 25.4 / 96;
    const pw = w0 * MM;
    const ph = h0 * MM;
    const pdf = new jsPDF({ orientation: pw > ph ? 'l' : 'p', unit: 'mm', format: [pw, ph], compress: true });
    pdf.addImage(dataUrl, 'PNG', 0, 0, pw, ph);
    const no = cur.value?.['单据编号'] || cur.value?.['编号'] || '';
    pdf.save(`${panelName.value}-${no || '导出'}.pdf`);
    ElMessage.success(tt('已导出') + ' PDF');
  } catch (e) {
    console.error('pdf-export failed', e);
    ElMessage.error(tt('导出失败'));
  } finally {
    if (holder) holder.remove();
    loadingMsg.close();
  }
}
/** 导出 Excel(.xlsx):当前单据 头字段键值 + 各明细页签(全字段全数据,不受纸张限制);控制列表走专属导出 */
async function exportSheetExcel() {
  exportFmtVisible.value = false;
  // 控制列表专属导出:列定义与纸面同源(项目进度查询 / 检验目录)
  const catalogExporter = { RD_PROGRESS: 'exportProgressExcel', QC_CATALOG: 'exportCatalogExcel' }[panelCode.value];
  if (catalogExporter) {
    const sheet = approvalSheetRef.value;
    if (sheet && typeof sheet[catalogExporter] === 'function') {
      try {
        sheet[catalogExporter]();
        ElMessage.success(tt('已导出') + ' Excel');
      } catch (e) {
        console.error('sheet-excel-export failed', e);
        ElMessage.error(tt('导出失败'));
      }
      return
    }
  }
  try {
    const XLSX = await __vitePreload(() => import('./xlsx-yBJAythd.js'),true              ?[]:void 0);
    const head = cur.value || {};
    const no = head['单据编号'] || head['编号'] || '';
    const name = String(panelName.value || panelCode.value);
    const aoa = [
      [`${name}${no ? '　' + no : ''}`],
      [`惠州市银嘉环保科技有限公司　　单据编号：${no || ''}　　单据状态：${tt(String(head['单据状态'] || ''))}`],
      [],
    ];
    // 头字段键值(显示名=别名优先)
    const sysKeys = new Set(['编号', '单据状态', 'saved', 'detail', '审核人', '审核时间', '审批状态', '提交人', '提交时间']);
    for (const f of headerFields.value || []) {
      const k = headerFieldKey(f);
      if (sysKeys.has(k)) continue
      aoa.push([headerFieldLabel(f) || k, String(head[k] ?? '')]);
    }
    aoa.push([]);
    // 各明细页签(全字段全数据;隐藏列略)
    const tabs = cfgCache.value?.detail?.tabs || [];
    for (const t of tabs) {
      const rows = (head?.detail?.[t.key]) || [];
      if (!Array.isArray(rows) || !rows.length) continue
      const cols = (t.fields || []).filter((f) => !f.hidden && (f.dataName || f.code));
      aoa.push([`${t.label || t.key}（${rows.length} ${tt('行')}）`]);
      aoa.push(cols.map((f) => f.displayName || f.dataName || f.code));
      for (const r of rows) aoa.push(cols.map((f) => String(r[f.dataName || f.code] ?? '')));
      aoa.push([]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 24 }, { wch: 36 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (name || '单据').slice(0, 28));
    XLSX.writeFile(wb, `${name}-${no || '导出'}.xlsx`);
    ElMessage.success(tt('已导出') + ' Excel');
  } catch (e) {
    ElMessage.error(tt('导出失败'));
  }
}
async function printApprovalSheet() {
  if (!approvalSheetRef.value) return
  // 打印样式(approval-printing):只打印文书纸张,隐藏侧栏/其它页面元素
  document.body.classList.add('approval-printing');
  const restore = () => {
    document.body.classList.remove('approval-printing');
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  // 等样式生效后调打印预览(用户可另存为 PDF 或打印)
  setTimeout(() => window.print(), 150);
}

// ══════════ 单据打印版式(2026-09-15):宽明细表 A4 纸面优化 ══════════
// 标准单据面板打印不再直出屏幕 DOM(el-table 固定列宽,字段一多打印必然横向截断),
// 改走 .doc-print 纯表格打印层:数据与 A 区同源(同 tab/同过滤排序),仅版式为打印优化。
const docPrintEnabled = computed(() => {
  if (isApprovalDoc.value || reportMode.value) return false
  return (cfgCache.value?.detail?.tabs || []).length > 0
});
const docPrintBlock = computed(() => blocks.value.find((b) => b.isMain) || blocks.value[0] || null);
const docPrintHead = computed(() => (headerEditFields.value || []).filter((f) => !f.hidden));
const docPrintRows = computed(() => {
  const b = docPrintBlock.value;
  if (!b) return []
  return blockRows(b).filter((r) => !r._placeholder)
});
// 宽表列合并对(两列同时存在才合并;如 来料检验单 物料名称/型号、合格数量/不良数量)
const DOC_PRINT_MERGE_PAIRS = [['物料名称', '型号'], ['合格数量', '不良数量']];
/** 列宽基准(按中文列名关键词,与界面语言无关);打印前归一化为百分比 */
function dpBaseW(prop) {
  if (/序号/.test(prop)) return 4
  if (/描述|备注/.test(prop)) return 12
  if (/编码|代码|单号/.test(prop)) return 8
  if (/名称/.test(prop)) return 10
  if (/型号|规格/.test(prop)) return 7
  if (/日期/.test(prop)) return 7
  if (/金额|税额|总额/.test(prop)) return 6
  if (/数量|箱数|合格|不良/.test(prop)) return 5.5
  if (/单价|折扣|税率/.test(prop)) return 5
  return 6
}
const docPrintCols = computed(() => {
  const b = docPrintBlock.value;
  if (!b) return []
  const cols = blockCols(b);
  const props = cols.map((c) => c.prop);
  const consumed = new Set();
  const out = [{ title: tt('序号'), base: 4, text: (_r, i) => String(i + 1) }];
  for (const c of cols) {
    if (consumed.has(c.prop)) continue
    const pair = DOC_PRINT_MERGE_PAIRS.find(([x, y]) => x === c.prop && props.includes(y));
    if (pair) {
      const cy = cols.find((z) => z.prop === pair[1]);
      consumed.add(pair[1]);
      out.push({
        title: c.label + ' / ' + cy.label,
        base: dpBaseW(c.prop) + dpBaseW(cy.prop),
        text: (r) => [r[c.prop], r[cy.prop]]
          .map((v) => (v ?? '') === '' ? '' : String(v))
          .filter((s) => s !== '')
          .join(' / '),
      });
      continue
    }
    out.push({ title: c.label, base: dpBaseW(c.prop), text: (r) => formatFieldValue(c.field, r[c.prop]) });
  }
  const total = out.reduce((s, c) => s + c.base, 0) || 1;
  for (const c of out) c.pct = Math.round((c.base / total) * 1000) / 10;
  return out
});
/** 打印前置:挂 body 样式 + 注入 @page 规则(列数≥8 横向,否则纵向;@page 不响应类选择器,只能动态注入) */
function prepareDocPrint() {
  document.body.classList.add('doc-printing');
  const wide = docPrintCols.value.length >= 8;
  let st = document.getElementById('doc-print-page');
  if (!st) {
    st = document.createElement('style');
    st.id = 'doc-print-page';
    document.head.appendChild(st);
  }
  st.textContent = wide
    ? '@page { size: A4 landscape; margin: 9mm 8mm; }'
    : '@page { size: A4 portrait; margin: 12mm 10mm; }';
}
function onBeforePrintDoc() {
  // Ctrl+P 直打印也要走打印版式(beforeprint 在快照前同步触发)
  if (docPrintEnabled.value) prepareDocPrint();
}
function onAfterPrintDoc() {
  document.body.classList.remove('doc-printing');
}

// ══════════ 对外正式报表(后端 JasperReports 模板;IT 做版式,业务只选单据/格式) ══════════
// 与上面的「导出」不是一回事:上面是浏览器内基于当前屏幕纸张生成(所见即所得),
// 这里是后端按 IT 维护的 .jrxml 重新排版(A4 + 公司抬头 + 页眉页脚 + 页码),用于对外正式文件。
const reportTemplates = ref([]);
const reportVisible = ref(false);

/** 该面板有没有服务端报表模板(模板表 reports/report-templates.properties 决定)——有才显示入口 */
async function loadReportTemplates() {
  try {
    const res = await request.get('/report/templates', { params: { panelCode: panelCode.value } });
    reportTemplates.value = Array.isArray(res?.data) ? res.data : [];
  } catch (e) {
    reportTemplates.value = []; // 报表是增量能力,取不到就当没有,不影响面板本身
  }
}

// ══════════ 模板选择 + 报表模板管理(仅管理员;ADR-0002) ══════════
const selectedReportCode = ref('');
watch(reportTemplates, (list) => {
  if (!list?.length) { selectedReportCode.value = ''; return }
  if (!list.some((t) => t.code === selectedReportCode.value)) selectedReportCode.value = list[0].code;
}, { immediate: true });

const manageVisible = ref(false);
const manageList = ref([]);
const uploadFormVisible = ref(false);
const uploading = ref(false);
const uploadForm = ref({ templateCode: '', name: '', panelCode: '', remark: '' });
let uploadJrxml = '';

function openManage() {
  manageVisible.value = true;
  loadManageList();
}
async function loadManageList() {
  try {
    const res = await request.get('/report/templates', { params: { all: true } });
    manageList.value = Array.isArray(res?.data) ? res.data : [];
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('加载模板列表失败'));
  }
}
function onRptFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return
  const reader = new FileReader();
  reader.onload = (ev) => {
    uploadJrxml = String(ev.target.result || '');
    const base = file.name.replace(/\.(jrxml|xml)$/i, '');
    if (!uploadForm.value.templateCode) {
      uploadForm.value.templateCode = base.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    }
    if (!uploadForm.value.name) uploadForm.value.name = base;
  };
  reader.readAsText(file, 'utf-8');
}
async function submitUpload() {
  const f = uploadForm.value;
  if (!uploadJrxml) return ElMessage.warning(tt('请先选择 .jrxml 模板文件'))
  if (!f.templateCode || !f.name || !f.panelCode) return ElMessage.warning(tt('编码/名称/绑定面板不能为空'))
  uploading.value = true;
  try {
    await request.post('/report/templates', { templateCode: f.templateCode, panelCode: f.panelCode, name: f.name, remark: f.remark, jrxml: uploadJrxml });
    ElMessage.success(tt('模板已上传并启用'));
    uploadFormVisible.value = false;
    uploadForm.value = { templateCode: '', name: '', panelCode: panelCode.value, remark: '' };
    uploadJrxml = '';
    await loadManageList();
    await loadReportTemplates();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('上传失败'));
  } finally {
    uploading.value = false;
  }
}
async function toggleTpl(row) {
  try {
    await request.put(`/report/templates/${row.id}/enabled`, null, { params: { enabled: row.enabled ? 'N' : 'Y' } });
    await loadManageList();
    await loadReportTemplates();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('操作失败'));
  }
}
async function removeTpl(row) {
  try {
    await ElMessageBox.confirm(tt('确认删除模板「{name}」？删除后不可恢复。').replace('{name}', row.name), tt('删除确认'), { type: 'warning' });
  } catch { return }
  try {
    await request.delete(`/report/templates/${row.id}`);
    ElMessage.success(tt('已删除'));
    await loadManageList();
    await loadReportTemplates();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('删除失败'));
  }
}
function previewTpl(row) {
  const no = curDocNo.value;
  if (!no) return ElMessage.warning(tt('请先在列表勾选一张单据（预览用其数据渲染）'))
  request.get('/report/export', {
    params: { code: row.code, panelCode: row.panelCode, docNo: no, format: 'pdf', disposition: 'inline' },
    responseType: 'blob',
  }).then((blob) => {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }).catch((e) => ElMessage.error(engine.errMsg(e) || tt('预览失败')));
}
/** 取报表字节(Blob);失败由调用方提示 */
function fetchReportBlob(fmt) {
  return request.get('/report/export', {
    params: {
      code: selectedReportCode.value || reportTemplates.value[0]?.code,
      panelCode: panelCode.value,
      docNo: curDocNo.value,
      format: fmt,
    },
    responseType: 'blob',
  })
}

/** 下载报表:PDF / Excel(.xlsx),文件名由后端 Content-Disposition 给,这里按同口径命名 */
async function downloadReport(fmt) {
  const no = curDocNo.value;
  if (!no) return ElMessage.warning(tt('未找到可导出的单据'))
  reportVisible.value = false;
  const loading = ElMessage({ message: tt('正在生成报表…'), duration: 0 });
  try {
    const blob = await fetchReportBlob(fmt);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTemplates.value.find((t) => t.code === selectedReportCode.value)?.name || '报表'}-${no}.${fmt === 'xlsx' ? 'xlsx' : 'pdf'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    ElMessage.success(tt('已导出') + ' ' + (fmt === 'xlsx' ? 'Excel' : 'PDF'));
  } catch (e) {
    ElMessage.error(tt('报表生成失败'));
  } finally {
    loading.close();
  }
}

/** 打印预览:先同步开窗口占位(否则 await 之后新窗口会被浏览器拦截),拿到 PDF 再指向它 */
async function previewServerReport() {
  const no = curDocNo.value;
  if (!no) return ElMessage.warning(tt('未找到可导出的单据'))
  reportVisible.value = false;
  const win = window.open('', '_blank');
  const loading = ElMessage({ message: tt('正在生成报表…'), duration: 0 });
  try {
    const blob = await fetchReportBlob('pdf');
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else ElMessage.warning(tt('浏览器拦截了新窗口，请允许弹出窗口'));
  } catch (e) {
    if (win) win.close();
    ElMessage.error(tt('报表生成失败'));
  } finally {
    loading.close();
  }
}

async function copyActive() {
  const cols = activeCols.value;
  const rows = (activeData.value || []).filter((r) => !r._placeholder);
  const text = cols.map((c) => c.label).join('\t') + '\n' + rows.map((r) => cols.map((c) => r[c.prop] ?? '').join('\t')).join('\n');
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  ElMessage.success(`已复制 ${rows.length} 行到剪贴板`);
}

function exportActive() {
  const cols = activeCols.value;
  const rows = (activeData.value || []).filter((r) => !r._placeholder);
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n\t]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  };
  const csv = '\ufeff' + cols.map((c) => esc(c.label)).join(',') + '\n' + rows.map((r) => cols.map((c) => esc(r[c.prop])).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${panelCode.value}-${ctxBlock.value?.id || 'list'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已导出 ' + a.download);
}

async function onIcon(it, b) {
  ctxBlock.value = b;
  if (it === '复制到剪贴板') {
    copyActive();
    return
  }
  if (it === '另存为EXCEL模板') {
    exportActive();
    return
  }
  if (it === '现存量提取') {
    try {
      const count = await engine.fillCurrentStock(blockData(b));
      ElMessage.success(`已按库存状况表刷新 ${count} 行现存量`);
    } catch (error) {
      ElMessage.error(engine.errMsg(error) || '现存量提取失败');
    }
    return
  }
  ElMessage.info(`演示环境暂未实现「${it}」，界面与 T+ 保持一致`);
}

async function onCtxItem(it) {
  const row = ctx.row;
  ctx.visible = false;
  if (!row) return
  if (it === '定位') {
    ElMessage.success('已定位：' + (row['产品编码'] || row['材料编码'] || row['存货编码'] || row['工序编码'] || row['编号'] || ''));
    return
  }
  if (it === '复制到剪贴板') {
    copyActive();
    return
  }
  if (it === '另存为EXCEL模板') {
    exportActive();
    return
  }
  ElMessage.info(`演示环境暂未实现「${it}」，界面与 T+ 保持一致`);
}

// ---------- 查询区 ----------
function fieldDefOf(col) {
  const cfg = cfgCache.value;
  const r = (cfg?.dataSchema?.fields || []).find((x) => x.dataName === col);
  if (r) return r
  for (const tab of cfg?.detail?.tabs || []) {
    const dr = (tab.fields || []).find((x) => x.dataName === col);
    if (dr) return dr
  }
  return { dataName: col, dataType: '文本', options: [] }
}

function headerFieldKey(field) {
  return field.code || field.dataName
}

function headerFieldLabel(field) {
  // 显示层翻译(tt):en 时按中文原文查 biz 词典;数据键(headerFieldKey)不受影响
  return tt(field.name || field.label || field.displayName || field.dataName || field.code)
}

function fieldType(field) {
  return field?.dataType || '文本'
}

function isReferenceField(field) {
  return fieldType(field) === '参照' && !!(field?.refPanel || field?.ref?.panel)
}

function isSelectField(field) {
  return fieldType(field) === '下拉框'
}

function isDateField(field) {
  return ['日期', '日期时间', '时间', 'DATE', 'DateTime', 'Date'].includes(fieldType(field))
}

function isNumberField(field) {
  return ['小数', '整数', 'Decimal', 'Long', 'Integer', 'Double'].includes(fieldType(field))
}

function isBooleanField(field) {
  return ['是否', 'Boolean', 'BOOL'].includes(fieldType(field))
}

/** 生产线档案「停用」列按钮化:仅 PROD_LINE 面板的 停用 列走行内切换按钮(2026-09-24 随生产域下拉) */
function isLineToggleCol(prop) {
  return panelCode.value === 'PROD_LINE' && prop === '停用'
}

/** 生产线档案「停用」列:开关切换——@change 给出的新值**同步乐观翻转**(点击立即出动画),
 *  POST 落库以服务端结果校准,失败回滚。⚠ 档案行是 markRaw 的(去响应式优化),
 *  改 row 属性不触发重渲染——每次写值后按平台约定 bump archVersion 驱动刷新 */
async function toggleLineDisable(row, next) {
  if (row._toggling) return
  const old = row['停用'];
  row['停用'] = next ? 1 : 0;                 // 乐观更新
  archVersion.value++;                        // 档案行 markRaw:bump 版本号 → 重渲染 → 动画立即播放
  row._toggling = true;
  try {
    const res = await request.post('/px/prodLine/toggle', { 生产线: row.生产线 });
    row['停用'] = res.data?.['停用'] ?? row['停用'];   // 以服务端翻转结果为准
    archVersion.value++;
    ElMessage.success(row['停用'] === 1
      ? tt('已停用') + '：' + row.生产线 + tt('（快速排产已不可选）')
      : tt('已启用') + '：' + row.生产线);
  } catch (e) {
    row['停用'] = old;                      // 失败回滚(反向动画退回)
    archVersion.value++;
    ElMessage.error(e?.response?.data?.message || tt('操作失败'));
  } finally {
    row._toggling = false;
  }
}

/** 布尔归一化:后端 bit 经行映射可能为 boolean/1/'1'/'true'/'是'(字符串 '0' 在 JS 为真值,必须显式归一) */
function toBool(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'True' || v === '是'
}

function fieldOptions(field) {
  return (field?.options || engine.fieldOptions(field || {}) || []).map((option) => (
    typeof option === 'object'
      ? { value: option.value ?? option.label, label: option.label ?? option.value }
      : { value: option, label: option }
  ))
}

function formatFieldValue(field, value) {
  if (value === undefined || value === null || value === '') return ''
  if (isBooleanField(field)) return toBool(value) ? '是' : '否'
  return String(value)
}

function headerFieldLocked(field) {
  const key = headerFieldKey(field);
  // 材料码打印明细生成的单据:**批次号锁死**(草稿态也不给改)——
  // 用户口径「只要有关打印明细生成的单据都不可以修改批次号」。依据见 printBatchLock。
  if (key === '批次号' && printBatchLock.value?.锁定) return true
  // readonly:元数据 editable=0 → buildMeta 下发 readonly(文书锁定字段 申请立项人/负责人 在此列)
  return !!field.computed || !!field.autoCode || !!field.readonly
    || ['编号', '单据状态', '创建时间', '更新时间', '发起人编号'].includes(key)
}

/** 批次号被"材料码"锁定的原因(没锁则空串;给只读格当 title 用) */
function printBatchLockReason(field) {
  return headerFieldKey(field) === '批次号' && printBatchLock.value?.锁定
    ? String(printBatchLock.value?.依据 || tt('已按材料码批次号锁定'))
    : ''
}

function headerRefText(field) {
  return formatFieldValue(field, cur.value[headerFieldKey(field)])
}

function openHeaderRef(field) {
  if (!draftEditable.value || headerFieldLocked(field)) return
  headerRefField.value = field;
  headerRefVisible.value = true;
}

function onHeaderRefConfirm(rows) {
  const field = headerRefField.value;
  const source = rows?.[0];
  if (!field || !source || !draftEditable.value) return
  const key = headerFieldKey(field);
  const ref = refConfigOf(field);
  const refField = ref.field || ref.refField || key;
  cur.value[key] = source[refField] ?? '';
  applyRefCarry(cur.value, source, ref, key);
  headerRefVisible.value = false;
  headerRefField.value = null;
  markInlineDirty(); // 表头参照带回 = 未保存修改
}

function detailTabDefOf(key) {
  return (cfgCache.value?.detail?.tabs || []).find((tab) => tab.key === key) || null
}

function detailEditable(b) {
  return draftEditable.value && !!b && tabView(b, activeTab(b)) !== 'summary'
}

function detailRefTrigger(field) {
  return field?.refTrigger || field?.trigger || 'click'
}

function isActiveDetailRefRow(row, b, prop) {
  const pick = detailRefPick.value;
  return detailRefVisible.value && !!pick && pick.row === row && pick.tabKey === activeTab(b).key && pick.field?.dataName === prop
}

// ---------- 明细单元格编辑器懒渲染(2026-09-08) ----------
// 只给「当前激活的单元格」挂载编辑控件,其余单元格渲染纯文本。
// 动因:数据字典 210 行 × 6 列 = 1260 个常驻编辑器(含 el-select 全部选项 3165 个 option 节点),
// DOM 达 1.85 万节点、首屏 2.1s,表现为点击后面板长时间白屏。
const activeCell = ref(null);
/** 激活格本地回显值(2026-09-28,修"打的字立刻消失"):档案行 markRaw(大表性能优化)后
 *  v-model 写行属性是静默的——不触发重渲染,el-input 的 modelValue prop 停在旧值;
 *  而 Element Plus el-input 在 emit 后 nextTick 强制把原生值拨回 props.modelValue
 *  (input.vue setNativeInputValue),于是每敲一个字都被立刻清掉——库位档案 库位编码/库位地址
 *  「无法填写」即此(参照列走选择器写入+bump 版本刷新,不受影响)。
 *  解法:文本/数值激活编辑器改绑本响应式回显——输入即时更新回显(prop 跟上,EP 不再回拨),
 *  同时把值落进 raw 行(保存/失焦回显用),零表格级重渲染。 */
const activeCellEcho = ref('');
function isActiveCell(row, b, prop) {
  const a = activeCell.value;
  return !!a && a.row === row && a.tabKey === activeTab(b).key && a.prop === prop
}
function syncActiveCellEcho(row, prop) {
  const v = row?.[prop];
  activeCellEcho.value = v === undefined || v === null ? '' : v;
}
function onActiveCellEchoInput(row, prop, v) {
  activeCellEcho.value = v ?? '';
  row[prop] = activeCellEcho.value;
}
function activateCell(row, b, prop) {
  if (!detailEditable(b) || row?._placeholder) return
  if (detailBatchLocked(prop)) return    // 批次号(链路单据):行随单头,明细格不进入编辑(2026-10-04 口径)
  const a = activeCell.value;
  if (a && a.row === row && a.tabKey === activeTab(b).key && a.prop === prop) return
  activeCell.value = { row, tabKey: activeTab(b).key, prop };
  syncActiveCellEcho(row, prop);
}
/** 激活格编辑器挂载即聚焦(v-cell-focus,2026-09-28):懒激活单元格此前只挂编辑器不聚焦,
 *  一击后键盘输入落在页面而非输入框,用户表现为「无法填写」(库位档案 库位编码/库位地址;
 *  对照组=参照列常驻编辑器一击即选,落差感更强)。挂载即 focus ⇒ 一击=可打字;
 *  el-switch 无 input 聚焦自身(空格可切换),指令挂在组件根元素上取内层 input。 */
const vCellFocus = {
  mounted(el) {
    const target = el.querySelector?.('input') || (el.querySelector?.('[tabindex]') ?? (el.getAttribute?.('role') === 'switch' ? el : null));
    if (!target || typeof target.focus !== 'function') return
    // 挂载发生在激活点击的同帧,浏览器默认焦点动作在 click 后已结束;直接聚焦即可稳定生效
    target.focus();
  },
};

function openDetailReference(field, row, b) {
  if (!detailEditable(b) || !isReferenceField(field) || field.computed || row?._placeholder) return
  detailRefPick.value = {
    field,
    row,
    tabKey: activeTab(b).key,
    documentNo: cur.value['编号'],
    created: false,
  };
  detailRefVisible.value = true;
}

function openClickDetailRef(field, row, b) {
  if (detailRefTrigger(field) === 'click') openDetailReference(field, row, b);
}

function onDetailCellDblclick(row, column, event, b) {
  const field = fieldDefOf(column?.property);
  // 明细行双击**只**服务「参照触发=双击」的字段(如存货:双击弹参照选择器);其余情况什么都不做。
  // 🔴 2026-10-15 用户口径:原实现在非草稿态还会 `openForm(cur.value)` —— 即双击明细行弹出整单卡片
  //    (VoucherFormDialog),采购入库单/材料出库单…所有单据面板都一样,用户明确要求双击不要再弹。
  //    随后用户进一步确认「不需要能打开这个卡片」⇒ 卡片与工具栏「修改」入口**全部删除**(见 openForm 处注释)。
  if (detailEditable(b) && isReferenceField(field) && detailRefTrigger(field) === 'dblclick') {
    event?.stopPropagation?.();
    if (!row?._placeholder) openDetailReference(field, row, b);
  }
}

function newDetailRow(tabKey) {
  const row = {};
  for (const field of detailTabDefOf(tabKey)?.fields || []) {
    if (field.dataType === '小数' || field.dataType === '整数') row[field.dataName] = field.defaultValue ?? 0;
    else if (field.dataType === '是否') row[field.dataName] = field.defaultValue ?? false;
    else row[field.dataName] = field.defaultValue ?? '';
  }
  return row
}

function addInlineDetailRow(b) {
  if (!detailEditable(b)) return
  const tabKey = activeTab(b).key;
  if (!cur.value.detail) cur.value.detail = {};
  const rows = cur.value.detail[tabKey] || (cur.value.detail[tabKey] = []);
  // 排序激活时先清排序:新行落在数据末尾,避免"插到已排好的中间"的错觉
  const state = blockSortOf(b);
  if (state.order) { state.prop = ''; state.order = ''; }
  const row = newDetailRow(tabKey);
  rows.push(row);
  archPage.value = Math.ceil(rows.length / archPageSize.value); // 档案分页:新行在末尾,跳到末页立即可见
  // 新行首个可编辑格直接激活并聚焦(2026-09-28):「新增数据」后懒激活格子只显示空文本、
  // 无任何编辑器视觉痕迹,用户不知道要点它(库位档案 库位编码/库位地址 因此被报"无法填写")。
  // 这里替用户完成那第一击:跳过参照列(常驻编辑器,一击即选不需要预激活)、图片列、
  // 以及参照带回目标字段(如 仓库编码=选仓库时自动带入,不该让光标落进去手敲),
  // 找第一个常规可编辑字段(如 库位编码)激活,v-cell-focus 挂载即聚焦 → 点完按钮直接打字。
  const carriedNames = new Set();
  for (const f of detailTabDefOf(tabKey)?.fields || []) {
    for (const m of f.refMap || f.map || []) if (m?.to) carriedNames.add(m.to);
  }
  const firstEditable = (detailTabDefOf(tabKey)?.fields || []).find((f) => (
    !f.hidden && !f.computed && !isReferenceField(f) && f.dataType !== '图片' && !carriedNames.has(f.dataName)
  ));
  if (firstEditable) {
    activeCell.value = { row, tabKey, prop: firstEditable.dataName };
    syncActiveCellEcho(row, firstEditable.dataName);
  }
  markInlineDirty(); // 新增明细行 = 未保存修改
}

function primaryDetailRefField(b) {
  if (!detailEditable(b)) return null
  const columns = new Set(activeTab(b).cols || []);
  const fields = (detailTabDefOf(activeTab(b).key)?.fields || []).filter((field) => (
    columns.has(field.dataName) && isReferenceField(field) && !field.computed
  ));
  return fields.find((field) => ['产品编码', '存货编码', '材料编码'].includes(field.dataName)) || fields[0] || null
}

function openBlankDetailRow(b) {
  const field = primaryDetailRefField(b);
  if (!field) return
  const tabKey = activeTab(b).key;
  if (!cur.value.detail) cur.value.detail = {};
  const rows = cur.value.detail[tabKey] || (cur.value.detail[tabKey] = []);
  const row = newDetailRow(tabKey);
  rows.push(row);
  detailRefPick.value = {
    field,
    row,
    tabKey,
    documentNo: cur.value['编号'],
    created: true,
  };
  detailRefVisible.value = true;
}

function discardCreatedDetailRefRow(pick) {
  if (!pick?.created) return
  const rows = cur.value.detail?.[pick.tabKey];
  if (!Array.isArray(rows)) return
  const index = rows.indexOf(pick.row);
  if (index >= 0) rows.splice(index, 1);
}

async function onInlineDetailChange(tabKey, row, field) {
  markInlineDirty(); // 明细单元格任何值变更 → 未保存离开守卫置脏
  calculateDetailRow(tabKey, row);
  if (['存货编码', '存货名称', '产品编码', '产品名称', '材料编码', '材料名称', '仓库', '预出仓库', '出库仓库'].includes(field?.dataName)) {
    try { await engine.fillCurrentStock(row); } catch (error) { ElMessage.error(engine.errMsg(error) || '现存量刷新失败'); }
  }
}

function applyDetailReference(target, field, source) {
  const refField = field.refField || field.field;
  target[field.dataName] = source[refField];
  for (const map of field.refMap || field.map || []) {
    if (map && source[map.from] !== undefined) target[map.to || map.from] = source[map.from];
  }
}

function calculateDetailRow(tabKey, row) {
  const tab = detailTabDefOf(tabKey);
  if (!tab?.calc?.length) return
  // 求值口径统一在 @core/panel/calcRules(与后端 CalcRuleService 同一份规则、同一个守卫):
  // 入参全空则不写入,避免"单价/数量都没填"的行因改别的格子把手工金额抹成 0。
  applyCalcRules(tab.calc, row);
}

function currentFormData(detail) {
  const head = { ...cur.value };
  delete head.detail;
  delete head['编号'];
  delete head['单据状态'];
  delete head['创建时间'];
  delete head['更新时间'];
  delete head['发起人编号'];
  return { ...head, 编号: cur.value['编号'], detail }
}

function emptyFieldValue(value) {
  return value === undefined || value === null || String(value).trim() === ''
}

function validateInlineDraft() {
  for (const field of headerFields.value) {
    const key = headerFieldKey(field);
    if (field.isRequired && emptyFieldValue(cur.value[key])) {
      // 系统字段:单据日期默认今天、单据编号由后端自动生成、规格书种类为页签分类(旧草稿可能为空)
      if (key === '单据日期') {
        cur.value[key] = todayStr();
        continue
      }
      if (key === '单据编号' || key === '规格书种类') continue
      return `${headerFieldLabel(field)}不能为空`
    }
  }
  for (const tab of cfgCache.value?.detail?.tabs || []) {
    const rows = cur.value.detail?.[tab.key] || [];
    if (tab.isRequired && !rows.length) return `请至少添加一行${tab.label || '明细'}`
    // 2026-10-05 修复(用户报障「明细第 2 行工序控制不能为空」,而第 2 行根本没录入数据):
    //   编辑器会给明细**预置空白行**,原实现逐行逐格校必填 ⇒ 空白行被判缺必填、拦在保存上。
    //   口径:**空行视为"未录入"**,不参与必填校验;若整张明细全是空行,按"请至少添加一行"处理。
    let nonEmpty = 0;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index] || {};
      // 空行判定(2026-10-05 二次修正):预置空行的布尔开关默认 false、数值默认 0/null 都会被
      // String() 变成 "false"/"0" 而**看起来"有值"** ⇒ 空行被判成有数据的行,继续跑必填校验
      // (用户报障:第 2 行没录任何东西也报"明细第 2 行工序控制不能为空")。
      // 口径:boolean、以及 "false"/"true"/"0"/"Y"/"N"/"是"/"否" 一律视为**未录入**。
      const rowEmpty = (tab.fields || []).every((f) => {
        const v = row[f.dataName];
        if (emptyFieldValue(v)) return true
        if (typeof v === 'boolean') return true
        const s = String(v).trim().toLowerCase();
        return s === 'false' || s === 'true' || s === '0' || s === 'y' || s === 'n' || s === '是' || s === '否'
      });
      if (rowEmpty) continue
      nonEmpty++;
      for (const field of tab.fields || []) {
        if (field.isRequired && emptyFieldValue(row[field.dataName])) {
          return `${tab.label || '明细'}第 ${index + 1} 行${field.dataName}不能为空`
        }
      }
    }
    if (tab.isRequired && nonEmpty === 0) return `请至少添加一行${tab.label || '明细'}`
  }
  return ''
}

async function saveInlineDraft(buttonName = '保存', { silent = false, skipValidation = false } = {}) {
  if (!draftEditable.value || inlineSaving.value) return false
  // ⚠ skipValidation 必须在这里真正生效(2026-09-20 修):
  //   参数早就声明了、调用方也传了(「保存为草稿」传 true),但函数体里**从来没读过它** ——
  //   于是草稿路径照样跑全量必填校验 ⇒ "保存为草稿"做不到"存一半"。
  //   用户口径:保存为草稿不做必填限制;保存/提交才做。
  const validation = skipValidation ? '' : validateInlineDraft();
  if (validation) {
    ElMessage.warning(validation);
    // 文书面板(RecordSheetPanels/DocSheet/DataRecordSheet):自动定位缺失字段(翻页/滚动/闪烁);仅必填触发
    if (approvalSheetRef.value?.focusField) {
      const label = validation.replace(/第\s*\d+\s*行/g, '').match(/^(.+?)不能为空/)?.[1] || '';
      approvalSheetRef.value.focusField(String(label).trim());
    }
    return false
  }
  for (const tab of cfgCache.value?.detail?.tabs || []) {
    for (const row of cur.value.detail?.[tab.key] || []) calculateDetailRow(tab.key, row);
  }
  inlineSaving.value = true;
  const documentNo = cur.value['编号'];
  try {
    // 档案面板:只提交**改动行**(用户口径 2026-10-03「修改提交改动行」)——
    // 商品这类几千行的档案不再整表提交,后端也据此不做"缺席即删除"推断(误删护栏)。
    let payload;
    if (singleDocMode.value) {
      const changed = changedArchiveRows();
      if (!changed.length) {
        inlineDirtyFlag.value = false;
        markSavedSnapshot();
        if (!silent) ElMessage.success(tt('没有需要保存的改动'));
        return true
      }
      const detail = {};
      for (const key of Object.keys(cur.value.detail || {})) detail[key] = changed;
      payload = currentFormData(detail);
    } else {
      payload = currentFormData({ ...(cur.value.detail || {}) });
    }
    const res = await engine.callButton({
      panelCode: panelCode.value,
      buttonName,
      formData: payload,
      buttonParam: archiveSaveParam(),
    });    // 旧客户端口径的兜底提示:后端在"既没声明改动行、也没声明整档"时会跳过缺席行软删
    if (res && Number(res['未全量跳过软删']) > 0) {
      ElMessage.warning(tt('当前列表带筛选，本次保存只更新已加载的行，未显示的行不会被删除'));
    }
    await load();
    const index = list.value.findIndex((item) => item['编号'] === documentNo);
    if (index >= 0) curIdx.value = index;
    if (!silent) ElMessage.success(`「${buttonName}」成功`);
    inlineDirtyFlag.value = false;
    freshAdded.value = false;
    freshAddedNo.value = '';
    clearFreshDraft(documentNo);
    return true
  } catch (error) {
    ElMessage.error(engine.errMsg(error) || '保存失败');
    return false
  } finally {
    inlineSaving.value = false;
  }
}

async function onDetailRefConfirm(selectedRows) {
  const pick = detailRefPick.value;
  if (!pick || !selectedRows?.length || detailRefSaving.value) return
  // 草稿判定仅适用于单据式面板(有 单据状态=草稿 语义);
  // singleDoc 档案长表格面板(如 项目/基础档案)状态为 启用/停用,行始终可编辑,不做该判定。
  if (cfgCache.value?.metadata?.singleDoc !== true
      && (cur.value['编号'] !== pick.documentNo || cur.value['单据状态'] !== '草稿')) {
    detailRefVisible.value = false;
    ElMessage.warning('当前单据已切换或不再是草稿，请重新选择');
    return
  }

  // ⚠ 2026-10-06 根因(修「直接点空行选工序 → 一行都没多出来」):下面 `await engine.fillCurrentStock(...)`
  //   之前**不**置位 detailRefSaving 时,存在一个丢行的竞态 —— RefPickDialog.confirm() 在 emit('confirm')
  //   之后立刻 emit('update:modelValue', false) 关弹窗,而 watch(detailRefVisible)(见文件下方)看到
  //   「已关闭 && !detailRefSaving」就判定为"用户取消",把 openBlankDetailRow 刚推的 pick.created 行
  //   **原地 splice 掉**;本函数此刻正停在那个 await 上,恢复后照样把带入值写进**已被摘掉的行对象**、
  //   照样弹绿色提示 ⇒ 用户看到「已带入 1 条工序」却一行都没多(浏览器实测:点空行后行数 2→3,
  //   确认后立刻回到 2,期间 0 个 /api 请求 —— 纯客户端摘行,不是保存失败/回滚)。
  //   2026-10-06 只给 ROUTE 提前置位(其它面板当时还走「顺带保存整单 + load() 重取」,服务端数据会把
  //   那一行取回来,那摘只是瞬时闪烁);2026-10-14 起**所有面板**都不再落库、不 load,行只活在前端,
  //   摘掉就再也回不来 ⇒ 置位推广到全部面板(取舍见 docs/development/明细参照确认与必填校验-成因与处理方案.md)。
  //   置位点仍在本函数第一个 await 之前、且在所有早退分支之后(早退不动它,避免卡住后续参照确认);
  //   本函数末尾的 finally 负责复位,取消(不确认)路径不经过这里 ⇒ 取消仍会正确撤掉那行空行。
  detailRefSaving.value = true;

  // ── 带入值写**活行**(cur.value.detail[pick.tabKey],就是表格渲染的那批对象) ──
  // 2026-10-14 口径(方案 A,用户拍板「全都按方案 A 实现」):参照确认 = 只写本地草稿 + 标脏,
  //   **不再顺带保存整单**。原实现的三个后果(用户报障「选商品就报 明细第 1 行批号不能为空」
  //   「填明细却提示表头未填写」):
  //     ① 那次隐式「保存」走后端全量必填校验(ButtonService ensureRequiredFilled +
  //        ensureDetailRequiredFilled)⇒ 录明细中途必然缺必填,必然弹错;
  //     ② 带入值只写进 cur.value.detail 的深拷贝快照,失败时快照整份丢弃 ⇒ 界面上那一行始终是空的
  //        (像"选了商品没反应"),新推的空行还会被摘掉;
  //     ③ 文书类面板「保存即归档/自动送审」会被这种隐式保存触发(ButtonService DOC_ARCHIVE_PANELS)。
  //   必填校验因此只剩显式「保存 / 保存新增 / 提交审批 / 审核」两处(前端 validateInlineDraft +
  //   后端 ensureRequiredFilled/ensureDetailRequiredFilled),与工艺路线 2026-10-06 口径一致。
  let targetRows = null;
  const pushedRows = [];
  try {
    if (!cur.value.detail) cur.value.detail = {};
    targetRows = Array.isArray(cur.value.detail[pick.tabKey])
      ? cur.value.detail[pick.tabKey]
      : (cur.value.detail[pick.tabKey] = []);
    const targetIndex = pick.row ? targetRows.indexOf(pick.row) : -1;
    const changedRows = [];
    let offset = 0;
    if (targetIndex >= 0) {
      applyDetailReference(targetRows[targetIndex], pick.field, selectedRows[0]);
      calculateDetailRow(pick.tabKey, targetRows[targetIndex]);
      changedRows.push(targetRows[targetIndex]);
      offset = 1;
    }
    for (let index = offset; index < selectedRows.length; index++) {
      const row = newDetailRow(pick.tabKey);
      applyDetailReference(row, pick.field, selectedRows[index]);
      calculateDetailRow(pick.tabKey, row);
      targetRows.push(row);
      pushedRows.push(row);
      changedRows.push(row);
    }
    // 现存量仍是本地刷新(按库存状况表口径算),失败不拦带入
    try { await engine.fillCurrentStock(changedRows); } catch (error) { ElMessage.error(engine.errMsg(error) || '现存量刷新失败'); }
    markInlineDirty(); // 未保存离开守卫;档案行(markRaw)靠它 bump archVersion 驱动重渲染
    detailRefVisible.value = false;
    ElMessage.success(tt('已带入 {n} 行，请点「保存」提交').replace('{n}', String(selectedRows.length)));
  } catch (error) {
    // 带入过程本身出错(非必填拦截——那个已不在本路径):撤掉本次推入的行,不留半截行
    for (const row of pushedRows) {
      const index = targetRows ? targetRows.indexOf(row) : -1;
      if (index >= 0) targetRows.splice(index, 1);
    }
    discardCreatedDetailRefRow(pick);
    ElMessage.error(engine.errMsg(error) || '参照带入失败');
  } finally {
    detailRefSaving.value = false;
    detailRefPick.value = null;
  }
}

/** 页码文案(语序适配:中文 第x/y张;英文 No. x of y) */
function pageText(cur, total, unit) {
  const zh = String(localStorage.getItem("mes_locale") || "zh-CN").startsWith("zh");
  return zh ? `第 ${cur}/${total} ${unit}` : `${unit === "张" ? "No." : "Page"} ${cur} / ${total}`
}

function qType(qr) {
  const t = qr.dataType || fieldDefOf(qr.dataName).dataType || '文本';
  if (t === '参照') return 'ref'
  if (t === '下拉框') return 'select'
  if (t === '日期' || t === '日期时间') return 'date'
  return 'input'
}

function openQueryDialog() {
  Object.keys(queryDraft).forEach((key) => delete queryDraft[key]);
  Object.assign(queryDraft, condition);
  // 弹窗面板:单据日期区间从当前条件回填(重开弹窗保留上次区间);级联面板加载联动选项
  if (reportQueryDialog.value) {
    rqdRange.value = condition['开始日期'] && condition['结束日期'] ? [condition['开始日期'], condition['结束日期']] : [];
  }
  if (isCascadePanel.value) loadLedgerRefOptions();
  queryDialogVisible.value = true;
}

function openQueryRef(qr, context = 'page') {
  // 台账/库存状况(2026-09-28):弹窗里选「存货」且已选仓库 → 候选按「该仓有流水」收窄。
  // 注入数组型 filter{存货编码:[…]}(engine.queryRefRows 对数组 filter 在展平后的档案行上逐行精确匹配,
  // 不会误发给后端当查询条件);按编码收窄(名称重名/改名不影响);该仓无任何有流水的档案存货时不收窄(不给空清单)。
  // 按**编码**而非名称:存货档案重名严重(「端盖」24 码、「PP棉」18 码),按名称会把
  // 同名异码整批放进候选,用户分不清哪个有流水 —— 编码唯一,收窄后一码一物(单一性)。
  if (context === 'dialog' && isCascadePanel.value && headerFieldKey(qr) === '存货' && queryDraft['仓库']) {
    const codes = ledgerItemOptions.value.map((o) => o.code).filter(Boolean);
    if (codes.length) qr = { ...qr, filter: { ...(qr.filter || {}), 存货编码: codes } };
  }
  queryRefField.value = qr;
  queryRefContext.value = context;
  queryRefVisible.value = true;
}

function clearQueryRef(qr, context = 'page') {
  const key = headerFieldKey(qr);
  if (context === 'dialog') {
    delete queryDraft[key];
    // 编码与名称成对清理(台账/状况表绑码)
    if (isCascadePanel.value && key === '仓库') delete queryDraft['_whCode'];
    if (isCascadePanel.value && key === '存货') delete queryDraft['_itemCode'];
    return
  }
  delete condition[key];
  search();
}

function onQueryRefConfirm(rows) {
  const field = queryRefField.value;
  const row = rows?.[0];
  if (!field || !row) return
  const ref = field.ref && typeof field.ref === 'object' ? field.ref : field;
  const valueField = ref.field || ref.refField || ref.display || ref.displayField || headerFieldKey(field);
  const target = queryRefContext.value === 'dialog' ? queryDraft : condition;
  target[headerFieldKey(field)] = row[valueField] ?? '';
  // 台账/状况表:参照行携带编码,选中即绑码(_whCode/_itemCode)——查询条件按编码过滤,名称仅回显
  if (queryRefContext.value === 'dialog' && isCascadePanel.value) {
    const key = headerFieldKey(field);
    if (key === '仓库') {
      const c = row['仓库编码'];
      queryDraft['_whCode'] = c ? String(c).trim() : '';
    }
    if (key === '存货') {
      const c = row['存货编码'];
      queryDraft['_itemCode'] = c ? String(c).trim() : '';
    }
  }
  queryRefVisible.value = false;
  queryRefField.value = null;
  // 台账/库存状况:弹窗选了 仓库 或 存货 都重拉联动——选仓后存货候选按新仓收窄(旧存货失效被清);
  // 选存货后该存货无流水的仓置灰(当前仓无此存货流水则清仓)。补上了旧版「参照弹窗选仓不联动」的缺口。
  if (queryRefContext.value === 'dialog' && isCascadePanel.value && ['仓库', '存货'].includes(headerFieldKey(field))) {
    const isWh = headerFieldKey(field) === '仓库';
    loadLedgerRefOptions(isWh ? { keepWh: true, keepItem: false } : { keepWh: false, keepItem: true });
  }
  if (queryRefContext.value === 'page') search();
}

function applyHeaderQuery() {
  // 查询弹窗面板:单据日期(区间)必填;台账加验 仓库/存货 必填(单一仓库的一种存货)
  if (reportQueryDialog.value) {
    const [ds, de] = rqdRange.value || [];
    if (!ds || !de) {
      ElMessage.warning(tt('请填写单据日期'));
      return
    }
    if (panelCode.value === 'STOCK_LEDGER' && (!queryDraft['仓库'] || !queryDraft['存货'])) {
      ElMessage.warning(tt('库存台账需选择一个仓库和一种存货'));
      return
    }
    queryDraft['开始日期'] = ds;
    queryDraft['结束日期'] = de;
  }
  Object.keys(condition).forEach((key) => delete condition[key]);
  for (const [key, value] of Object.entries(queryDraft)) {
    if (value !== undefined && value !== null && String(value) !== '') condition[key] = value;
  }
  // 高级筛选定格为「生效中」:报表/单据面板随本次查询 POST 给后端全表过滤(分页/导出口径一致;
  // 单据面板 2026-09-24 起同样服务端化);档案面板仍是前端过滤。
  // 日期范围(起/止)在此并入(ge/le 两条),不占可见条件行。
  const act = (list) => list.filter((f) => f.field && (f.op === 'empty' || f.op === 'notEmpty' || String(f.value ?? '').trim() !== ''));
  activeAdvFilters.value = act(effectiveAdvFilters.value);
  rqdDone.value = true; // 已通过弹窗查询(此后关闭弹窗不再退页)
  queryDialogVisible.value = false;
  search();
}

// ---- 查询方案:保存当前条件(表头+高级筛选)为命名方案,供下次调用/维护 ----
const planManageVisible = ref(false);
const selectedPlan = ref('');
const queryPlans = ref([]);

function plansKey() {
  return `mes_query_plans_${panelCode.value}`
}
function loadPlans() {
  try {
    queryPlans.value = JSON.parse(localStorage.getItem(plansKey()) || '[]');
  } catch { queryPlans.value = []; }
}
function persistPlans() {
  try { localStorage.setItem(plansKey(), JSON.stringify(queryPlans.value)); } catch { /* ignore */ }
}

/** 将当前弹窗条件(表头草稿 + 高级筛选)存为方案。 */
async function saveCurrentPlan() {
  const adv = advFilters.value.filter((f) => f.field && (f.op === 'empty' || f.op === 'notEmpty' || String(f.value ?? '').trim() !== ''));
  const cond = {};
  for (const [k, v] of Object.entries(queryDraft)) {
    if (v !== undefined && v !== null && String(v) !== '') cond[k] = v;
  }
  if (!adv.length && !Object.keys(cond).length) {
    ElMessage.warning(tt('当前没有可保存的查询条件'));
    return
  }
  try {
    const { value } = await ElMessageBox.prompt(tt('请输入方案名称'), tt('保存查询方案'), {
      confirmButtonText: tt('保存'), cancelButtonText: tt('取消'),
      inputValidator: (v) => (v && v.trim() ? true : tt('方案名称不能为空')),
    });
    const name = String(value).trim();
    const exists = queryPlans.value.find((p) => p.name === name);
    const plan = { name, condition: { ...cond }, advFilters: JSON.parse(JSON.stringify(adv)), dateFrom: dateFrom.value, dateTo: dateTo.value, updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') };
    if (exists) Object.assign(exists, plan);
    else queryPlans.value.push(plan);
    persistPlans();
    selectedPlan.value = name;
    ElMessage.success(tt('查询方案已保存'));
  } catch { /* 取消 */ }
}

/** 调用方案:填充表头草稿与高级筛选(不自动执行,由用户点击查询)。 */
function applyPlan(name) {
  const plan = queryPlans.value.find((p) => p.name === name);
  if (!plan) return
  Object.keys(queryDraft).forEach((k) => delete queryDraft[k]);
  Object.assign(queryDraft, plan.condition || {});
  advFilters.value = JSON.parse(JSON.stringify(plan.advFilters || []));
  dateFrom.value = plan.dateFrom || '';
  dateTo.value = plan.dateTo || '';
}

/** 维护操作:更新(以当前弹窗条件覆盖同名方案)/重命名/删除。 */
function updatePlan(name) {
  const plan = queryPlans.value.find((p) => p.name === name);
  if (!plan) return
  const adv = advFilters.value.filter((f) => f.field && (f.op === 'empty' || f.op === 'notEmpty' || String(f.value ?? '').trim() !== ''));
  const cond = {};
  for (const [k, v] of Object.entries(queryDraft)) {
    if (v !== undefined && v !== null && String(v) !== '') cond[k] = v;
  }
  plan.condition = cond;
  plan.advFilters = JSON.parse(JSON.stringify(adv));
  plan.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
  persistPlans();
  ElMessage.success(tt('查询方案已更新'));
}
async function renamePlan(name) {
  const plan = queryPlans.value.find((p) => p.name === name);
  if (!plan) return
  try {
    const { value } = await ElMessageBox.prompt(tt('请输入方案名称'), tt('重命名方案'), {
      confirmButtonText: tt('确定'), cancelButtonText: tt('取消'),
      inputValue: plan.name,
      inputValidator: (v) => (v && v.trim() ? true : tt('方案名称不能为空')),
    });
    plan.name = String(value).trim();
    if (selectedPlan.value === name) selectedPlan.value = plan.name;
    persistPlans();
  } catch { /* 取消 */ }
}
function deletePlan(name) {
  const idx = queryPlans.value.findIndex((p) => p.name === name);
  if (idx >= 0) queryPlans.value.splice(idx, 1);
  if (selectedPlan.value === name) selectedPlan.value = '';
  persistPlans();
}
function planSummary(plan) {
  const parts = [];
  const condKeys = Object.keys(plan.condition || {});
  if (condKeys.length) parts.push(condKeys.slice(0, 3).join('、') + (condKeys.length > 3 ? ` …×${condKeys.length}` : ''));
  if ((plan.advFilters || []).length) parts.push(`${tt('高级筛选')}×${plan.advFilters.length}`);
  if (plan.dateFrom || plan.dateTo) parts.push(`${tt('日期范围')} ${plan.dateFrom || ''}~${plan.dateTo || ''}`);
  return parts.join(' + ') || '-'
}

function resetHeaderQuery() {
  Object.keys(queryDraft).forEach((key) => delete queryDraft[key]);
  Object.keys(condition).forEach((key) => delete condition[key]);
  rqdRange.value = []; // 弹窗面板:单据日期区间一并重置
  advFilters.value = [];
  dateFrom.value = '';
  dateTo.value = '';
  activeAdvFilters.value = [];
  reportKeyword.value = '';
  query.keyword = '';
  queryDialogVisible.value = false;
  search();
}

const qOptCache = new Map();
function qOptions(qr) {
  const key = panelCode.value + '|' + qr.dataName;
  if (!qOptCache.has(key)) qOptCache.set(key, (qr.options || engine.fieldOptions(qr)).map((o) => typeof o === 'object' ? o : ({ value: o, label: o })));
  return qOptCache.get(key)
}

function reportLeaf(column) {
  const field = fieldDefOf(column);
  const numeric = field.dataType === '小数' || field.dataType === '整数';
  return { prop: column, label: column, width: colW(field), align: numeric ? 'right' : 'left' }
}

async function reportPage(pageNo) {
  const target = Math.max(1, Math.min(pageNo, reportPageCount.value));
  if (target === query.pageNo) return
  query.pageNo = target;
  await load();
}

function exportReport() {
  const columns = reportColumns.value;
  const esc = (value) => {
    const text = String(value ?? '');
    return /[",\n\t]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
  };
  const csv = '\ufeff' + columns.map(esc).join(',') + '\n' + list.value.map((row) => columns.map((column) => esc(row[column])).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${panelName.value}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已导出当前页 ' + list.value.length + ' 条数据');
}

/** 单据明细导出:当前 A 区活动页签(明细/汇总视图均可)导出 CSV(PANDA 打印组·导出) */
function exportDetail() {
  const blk = blocks.value.find((b) => b.id === 'A');
  if (!blk) return ElMessage.warning('该面板无可导出的明细')
  const tab = activeTab(blk);
  const cols = blockCols(blk);
  const rows = blockData(blk);
  if (!rows.length) return ElMessage.warning('当前单据无明细可导出')
  const esc = (value) => {
    const text = String(value ?? '');
    return /[",\n\t]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
  };
  const csv = '﻿' + cols.map(esc).join(',') + '\n'
    + rows.map((row) => cols.map((col) => esc(row[col])).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${panelName.value}-${current.value?.['编号'] || current.value?.['单据编号'] || ''}-${tab.label || '明细'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已导出明细 ' + rows.length + ' 行');
}

// 底部备注（可编辑，绑定当前单据）
const remarkText = computed({
  get: () => cur.value['备注'] ?? '',
  set: (v) => {
    if (cur.value && Object.keys(cur.value).length) cur.value['备注'] = v;
  },
});

// ---------- 配置与按钮 ----------
async function loadCrg() {
  if (cfgCache.value) return cfgCache.value
  const cfg = await engine.getPanelConfig(panelCode.value);
  cfgCache.value = cfg;
  const tp = cfg?.metadata?.panelPageDto?.tablePages?.[0];
  panelName.value = cfg?.metadata?.panelName || panelCode.value;
  // 页面标题 = 真实面板名（路由 meta.title 是通用占位，配置加载后覆盖）
  document.title = panelName.value + ' · YINJIA-MES';
  // 页签标题同步（生单直接跳转/页签替换后显示真实面板名）
  const curTab = tabs.tabs.find((x) => x.path === route.path);
  if (curTab) curTab.title = panelName.value;
  queryFields.value = tp?.queryFields || [];
  // 参照字段动态模式检查(≤20 弹窗,>20 下拉):并行判定全部参照字段
  const allRefFields = [...(queryFields.value || []), ...(headerFields.value || [])].filter(isReferenceField);
  for (const rf of allRefFields) checkRefMode(rf, headerFieldKey(rf));
  // 面板可配置每页条数（如档案类大列表 pageSize=100），未配置时保持默认 20；
  // 带左栏「单据选择」的面板一律 RAIL_PAGE_SIZE(50):左栏翻页条按"整页 50 条"翻
  const wantSize = DOC_RAIL_PANELS[panelCode.value] ? RAIL_PAGE_SIZE : (tp?.pageSize || 0);
  if (wantSize && query.pageSize !== wantSize) {
    query.pageSize = wantSize;
    query.pageNo = 1;
  }
  // 档案面板的显示分页(pagedBlockRows/archSlice)同样取面板配置 —— 2026-09-28 修:
  //   此前 archPageSize 硬编码 50,而 yj_panel.page_size 对档案面板**完全无效**
  //   (queryArchive 忽略 pageSize 全量返回,显示走 archPageSize)⇒ 元数据误导,
  //   且宽表(如商品 55 列 × 50 行 = 2800 单元格 / 1.7 万 DOM)没有"少渲染"的旋钮。
  //   现在按配置走:宽表把 yj_panel.page_size 调到 25,单页渲染量与切换耗时直接减半。
  if (singleDocMode.value) {
    const archWant = Number(tp?.pageSize) || 50;
    if (archPageSize.value !== archWant) {
      archPageSize.value = archWant;
      archPage.value = 1;
    }
  }
  gridTabs.value = tp?.gridTabs || [];
  groups.value = filterGroups(ensureScanFillAction(
    cfg?.metadata?.buttonGroups,
    cfg?.metadata,
  ));
  // 字段管理(动态字段):非 admin 隐藏入口(服务端 requireAdmin 是真闸门;flat 面板后端不注入)
  if (!user.isAdmin) {
    groups.value = groups.value.map((g) => ({ ...g, actions: (g.actions || []).filter((a) => a !== '字段管理') }));
  }
  return cfg
}

function isDisabled(action) {
  const st = current.value?.['单据状态'];
  const map = {
    新增: false, // 单单据面板新增按钮不置灰
    删除: !current.value,
    审核: !current.value || st !== '草稿',
    弃审: !current.value || st !== '已审核',
    中止执行: !current.value || !['已审核', '生产中', '已完工'].includes(st),
    整单中止: !current.value || !['已审核', '生产中', '已完工'].includes(st),
    草稿: !current.value || st !== '已中止',
    取消中止: !current.value || st !== '已中止',
    修改: !current.value || !['已审核', '生产中', '已完工'].includes(st),
    审批情况: false,
    提交审批: !current.value || (st !== '草稿' && st !== '修改中'),
    审批通过: !current.value || !IN_APPROVAL.includes(st),
    审批驳回: !current.value || !IN_APPROVAL.includes(st),
   驳回审批: !current.value || !IN_APPROVAL.includes(st),
    // 卡死单据出口(2026-09-11):撤回删除/修改申请仅在对应申请态可点
    撤回删除申请: !current.value || st !== '删除申请中',
    撤回修改申请: !current.value || st !== '修改申请中',
    保存: !draftEditable.value || inlineSaving.value,
    保存为草稿: !draftEditable.value || inlineSaving.value,
    保存新增: !draftEditable.value || inlineSaving.value,
    扫描填单: reportMode.value,
    // PANDA 工具栏动作(列表页语义)
    复制: !current.value,            // 整单复制=另存为一张新草稿
    放弃: false,                     // 丢弃内联草稿修改,恢复最近一次保存
    打印: false, 预览: false, 导出: false,
    发送邮件: false, 退出: false, 表格调整: false, 分类管理: false, 表头调整: false,
    二维码标签: false, // 档案工具栏动作:是否可点由前端勾选数提示兜底,不按单据状态置灰
  };
  // 灰色占位动作(后端 metadata.disabledActions:选单无流转来源/生单无实现链路)恒置灰,点击忽略
  if (map[action] === undefined && (cfgCache.value?.metadata?.disabledActions || []).includes(action)) {
    return true
  }
  // 2026-08-25：所有「生成XX」生单按钮统一仅已审核可用（对齐 T+：已审核才能选择生单）
  // 2026-09-20：去掉残留的「生产中」档 —— 状态推导里不存在该档(全库无此值),
  // 而后端 PushGenerateHandler 只认「已审核」,留着会让 UI 亮着却被后端拒(口径:选单/生单只能已审核)
  if (map[action] === undefined && action.startsWith('生成')) {
    return !current.value || st !== '已审核'
  }
  return map[action] === true
}

// 2026-10-15 用户口径:列表页**不再有**任何打开「整单卡片」的入口 ——
//   双击明细行(见 onDetailCellDblclick)与工具栏「修改」都曾走这里的 openForm() 弹 VoucherFormDialog,
//   两者连同 VoucherFormDialog 组件一并删除;单据数据一律在列表页原地内联编辑(草稿态)。

// 直接新增：调后端保存（空表头）创建最新草稿单（autoCode 编号 + 单据日期=当天自动填入），
// 刷新列表并定位到新单，在列表页直接内联填写（不跳转表单页/不弹新增弹窗）。
// 流程规范：新增时当前页面未保存的内容直接剔除,不弹确认——
//   新增未保存过的占位单 → 撤回(防垃圾空单残留);已保存单据的未保存修改 → 随 load 放弃。
async function directAdd() {
  try {
    const formData = {};
    const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '保存', formData, buttonParam: {} });
    const no = res && (res['编号'] || res.formNo);
    if (!no) return ElMessage.error('新增失败：未返回单据编号')
    // 标记必须先立:下面的 load() 刷新列表时 cur 就可能切到这张新草稿,文书默认值 watch 在
    // await 期间就会跑;标记晚设会被 isFreshAddedDoc() 判成 false,锁定字段(申请立项人/负责人)就带不出来
    freshAdded.value = true; // 本次新增尚未成功保存过：离开守卫「不保存」时据此撤回整单
    freshAddedNo.value = no; // 撤回只允许命中这张新建单
    markFreshDraft(no); // 持久化标记：刷新/重进后守卫仍能识别并撤回这张草稿
    await load(); // 刷新列表
    // 定位到新单:列表按单据号排序,新单号不一定排在首位(如存在 WW-/旧格式单号时 WO 新单不在第 1 位),
    // 必须按编号精确定位,否则新增后仍显示旧单,看起来像"新增复制了当前页面的内容"
    const idx = list.value.findIndex((item) => item['编号'] === no);
    curIdx.value = idx >= 0 ? idx : 0;
    markSavedSnapshot();
    ElMessage.success(`已新增 ${panelName.value}-${no}，请在列表页填写并保存`);
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '新增失败');
  }
}

// ============ 未保存离开守卫（开发规范 2026-09-01） ============
// 草稿态内联编辑存在未保存修改时离开本页（菜单切换/页签关闭/后退）弹窗三态：
// - 保存 → 走「保存」按钮路径(saveInlineDraft)落库后放行
// - 不保存 → 新增未保存过的撤回整单（走「删除」按钮路径：软删作废，
//   yj_doc_status.cancel_by/cancel_at 留痕 + form_flow_link 占用释放）；
//   修改既有草稿的仅放弃修改（不删单）
// - 取消(关闭弹窗) → 留在本页
// 实现：路由守卫【同步】return false 拦截，弹窗在守卫之外(普通交互流程)弹出，
// 选择完成后置 leaveConfirmed 再发起导航放行——避开在导航守卫内 await 弹窗的
// 竞态(hash 已改/页签已关导致体验异常)。另挂 beforeunload 兜底刷新/关窗提醒。

const savedSnapshot = ref('');
const freshAdded = ref(false);
const freshAddedNo = ref(''); // freshAdded 绑定的单据编号:撤回只允许命中这张单,防止 cur 漂移后误撤既有单据
/** 当前单据是否为「本次新增且尚未成功保存过」的草稿(freshAdded 且编号匹配,防 cur 漂移误判) */
function isFreshAddedDoc() {
  if (!freshAdded.value) return false
  if (!freshAddedNo.value) return true
  if (cur.value?.['编号'] === freshAddedNo.value) return true
  // 库端标记(directAdd 占位=库存 saved=N;保存/保存为草稿后=Y):跨刷新/跨会话/跨浏览器可靠
  return cur.value?.['saved'] === 'N'
}
// ---- 新增草稿标记的持久化(2026-09-09 补齐):刷新/重进后离开守卫仍能识别并撤回这张草稿 ----
function markFreshDraft(documentNo) {
  try {
    sessionStorage.setItem(FRESH_DRAFT_KEY, JSON.stringify({ panel: panelCode.value, no: String(documentNo || '') }));
  } catch { /* 存储不可用则退化为仅内存标记 */ }
}
function clearFreshDraft(documentNo) {
  try {
    const raw = sessionStorage.getItem(FRESH_DRAFT_KEY);
    if (!raw) return
    let saved = null;
    try { saved = JSON.parse(raw); } catch { saved = null; }
    if (!documentNo || !saved || String(saved.no || '') === String(documentNo)) {
      sessionStorage.removeItem(FRESH_DRAFT_KEY);
    }
  } catch { /* ignore */ }
}
function restoreFreshDraft() {
  try {
    const raw = sessionStorage.getItem(FRESH_DRAFT_KEY);
    if (!raw) return
    const saved = JSON.parse(raw);
    if (saved && saved.panel === panelCode.value && saved.no) {
      freshAdded.value = true;
      freshAddedNo.value = String(saved.no);
    }
  } catch { /* ignore */ }
}
/** 变更钩子置脏(表头/明细控件 @change;对真实交互可靠)——快照对比作兜底 */
const inlineDirtyFlag = ref(false);
function markInlineDirty() {
  if (draftEditable.value) inlineDirtyFlag.value = true;
  normalizeArchRaw(); // 档案行 raw 写入不触发响应式:统一在此 markRaw 新行/新数组并 bump 版本驱动视图刷新
}

/** 终止审批动作后(申请终止/审批/撤回):重载列表刷新单据状态(终止审批中/已终止) */
async function onTermChanged() {
  await load();
}

// ── 项目进度查询:点项目编号 → 该项目的数据记录表单据(8 面板按文档编号关联;弹窗内就地只读渲染,不跳转) ──
const dataSheetsVisible = ref(false);
const dataSheetsLoading = ref(false);
const dataSheetsRows = ref([]);
const dataSheetsCode = ref('');
const dsActive = ref(null); // 当前展示的单据 {panelCode,panelName,docNo,doc,headerFields,allFields,loading}
const dsCfgCache = new Map(); // panelCode → 面板配置(字段元数据;会话内缓存)
async function openDataSheets(row) {
  const K = Object.fromEntries(PROGRESS_COLUMNS.map((c) => [c.label, c.key]));
  const code = String(row?.[K['项目编号']] || '').trim();
  if (!code) return ElMessage.warning(tt('该行未填项目编号，无法关联数据记录表'))
  dataSheetsCode.value = code;
  dataSheetsVisible.value = true;
  dataSheetsLoading.value = true;
  dataSheetsRows.value = [];
  dsActive.value = null;
  try {
    const res = await request.get('/px/progress/dataSheets', { params: { code } });
    dataSheetsRows.value = res?.data || [];
    // 单张:直接进入查看;多张:先出选取列表,选中后再查看
    if (dataSheetsRows.value.length === 1) await selectDataSheet(dataSheetsRows.value[0]);
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'));
  } finally {
    dataSheetsLoading.value = false;
  }
}
/** 载入一张单据到弹窗(面板配置缓存 + getFormDescriptor 头明细拼回行模型) */
async function selectDataSheet(r) {
  if (!r?.panelCode || !r?.docNo) return
  dsActive.value = { ...r, loading: true, doc: null, headerFields: [], allFields: [] };
  try {
    let cfg = dsCfgCache.get(r.panelCode);
    if (!cfg) {
      const c = await request.get('/px/getPanelConfig', { params: { panelCode: r.panelCode } });
      cfg = c?.data || {};
      dsCfgCache.set(r.panelCode, cfg);
    }
    const d = await request.get('/px/getFormDescriptor', { params: { panelCode: r.panelCode, code: r.docNo } });
    // 响应体 data → {data: 头字段labels, detailData: {items}, ...};拼回行模型(head + detail.items)
    const payload = d?.data || {};
    const doc = { ...(payload.data || {}), detail: payload.detailData || {} };
    const headerFields = cfg?.dataSchema?.fields || [];
    const allFields = [...headerFields, ...((cfg?.detail?.tabs?.[0]?.fields) || [])];
    dsActive.value = { ...r, loading: false, doc, headerFields, allFields };
  } catch (e) {
    dsActive.value = { ...r, loading: false, doc: null, headerFields: [], allFields: [] };
    ElMessage.error(engine.errMsg(e) || tt('查询失败'));
  }
}
/** 字段编辑保存后刷新面板配置(yj_field 别名随配置接口重新下发) */
async function onFieldEditRefresh() {
  cfgCache.value = null;
  await load();
}

/** 记录"已保存"基线快照（load 完成/保存成功后调用） */
function markSavedSnapshot() {
  try {
    savedSnapshot.value = cur.value ? JSON.stringify(guardFormData()) : '';
  } catch {
    savedSnapshot.value = '';
  }
}

/** 守卫对比数据:在表单数据上剔除附件列位键——附件格挂载后异步回写头列位
 *  (AttachmentService 聚合值落表单,晚于载入快照),属服务端值同步而非用户编辑,
 *  不剔除会把带附件面板(QC_INSP/QC_RECV 等)的载入误判成未保存,守卫永远误弹。 */
function guardFormData() {
  const data = currentFormData(cur.value.detail || {});
  for (const k of attachKeys.value) delete data[k];
  return data
}

/** 当前是否存在未保存修改（草稿态且 变更钩子置脏/新增未保存/基线为空白草稿 或 相对基线有变化）。
 * directAdd 新建且尚未保存过的草稿即使零修改也算未保存：否则「新增后未填写直接离开」
 * 不触发守卫弹窗，空草稿永久残留（规范 §6.2「不保存→撤回整单」依赖本判定）。 */
function hasUnsavedChanges() {
  if (!draftEditable.value || !cur.value) return false
  if (inlineDirtyFlag.value || isFreshAddedDoc()) return true
  try {
    return JSON.stringify(guardFormData()) !== savedSnapshot.value
  } catch { return false }
}

/** 取消离开时页签可能已被 TabsBar 关闭，补回当前页签 */
function restoreCurrentTab() {
  try { tabs.open({ path: route.fullPath, title: panelName.value }); } catch { /* 页签兜底失败不阻断 */ }
}

// ---- 离开守卫：同步拦截 → 守卫外弹窗 → 选择后放行 ----
const pendingLeave = ref(null);   // 被拦截的目标路由(选择后跳转)
let pendingAction = null;          // 被拦截的面板内动作(翻页/点行切单,选择后执行)
const leaveConfirmed = ref(false); // 弹窗已决：放行下一次(由本组件发起的)导航
let guardAsking = false;          // 弹窗进行中防重入

onBeforeRouteLeave((to) => {
  if (leaveConfirmed.value) { leaveConfirmed.value = false; return true }
  if (guardAsking) return false // 弹窗进行中:拦截一切导航(三态选择后由 onLeaveChoice 放行)
  if (!hasUnsavedChanges()) { pendingLeave.value = null; return true }
  pendingLeave.value = to;
  guardAsking = true;
  nextTick(() => askUnsavedLeave()); // 守卫拦截后弹模板确认框
  return false
});

const leaveVisible = ref(false);
let leaveChoiceHandled = false;    // onLeaveChoice 已处理置 false 的弹窗,@close 兜底跳过

/** 弹窗问句:新建未保存/基线为空白草稿走「尚未保存」文案(提示不保存将撤回),有修改的走「有修改」 */
const leaveQuestion = computed(() => (
  isFreshAddedDoc() && !inlineDirtyFlag.value
    ? tt('当前草稿尚未保存，是否保存？（不保存将撤回该单）')
    : tt('当前单据有未保存的修改，是否保存？')
));

/** 守卫拦截后弹出模板确认框(命令式 ElMessageBox 在导航守卫上下文中不渲染,改用模板弹窗) */
function askUnsavedLeave() {
  leaveChoiceHandled = false;
  leaveVisible.value = true;
}

/** ESC/右上角 × 关闭弹窗(未做三态选择)= 留在本页:必须复位守卫状态,否则后续导航/切单被永久拦截 */
function onLeaveDialogClose() {
  if (leaveChoiceHandled) { leaveChoiceHandled = false; return }
  if (!guardAsking) return
  guardAsking = false;
  pendingLeave.value = null;
  pendingAction = null;
  restoreCurrentTab();
}

/** 离开守卫三态选择:save=按保存按钮落库;discard=撤回新增/放弃修改;stay=留在本页 */
async function onLeaveChoice(choice) {
  leaveChoiceHandled = true;
  leaveVisible.value = false;
  const to = pendingLeave.value;
  if (choice === 'stay') {
    guardAsking = false;
    pendingLeave.value = null;
    restoreCurrentTab();
    return
  }
  if (choice === 'save') {
    const saved = await saveInlineDraft('保存', { silent: true });
    if (!saved) { guardAsking = false; pendingLeave.value = null; restoreCurrentTab(); return }
  } else if (isFreshAddedDoc()) {
    // 不保存 + 新建未保存过或基线为空白草稿 → 撤回整单(走「删除」按钮路径:按开发规范留痕+释放占用)。
    // 有修改的既有草稿(基线含实质数据)不走此分支:仅放弃修改,保留单据(避免误删已填写内容)
    const withdrawNo = cur.value['编号'];
    try {
      await engine.callButton({ panelCode: panelCode.value, buttonName: '删除', formData: { 编号: withdrawNo }, buttonParam: {} });
      ElMessage.success(`已撤回新增：${withdrawNo}`);
      clearFreshDraft(withdrawNo);
      await load(); // 撤回后重载列表(挂起的切单/翻页动作据此定位)
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '撤回新增失败，请手动删除草稿');
      guardAsking = false;
      pendingLeave.value = null;
      restoreCurrentTab();
      return
    }
  }
  freshAdded.value = false;
  freshAddedNo.value = '';
  inlineDirtyFlag.value = false;
  guardAsking = false;
  pendingLeave.value = null;
  const action = pendingAction;
  pendingAction = null;
  if (action) {
    // 面板内动作(翻页/点行切单):load 时的快照对应切换前的单据,切换后必须重打
    // 基线快照,否则快照错位导致恒脏(误弹守卫/beforeunload 卡死)
    await action();
    markSavedSnapshot();
    return
  }
  leaveConfirmed.value = true;
  if (to) router.push(typeof to === 'string' ? to : (to.fullPath || to.path));
}

// 刷新/关闭浏览器兜底：未保存时浏览器原生确认
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges()) { e.preventDefault(); e.returnValue = ''; }
  });
}

async function onButton(action) {
  // 2026-08-25：灰按钮（disabled）点击直接忽略，不执行、不弹提示（如草稿态「生成XX」生单按钮）
  if (isDisabled(action)) return
  if (APPROVE_ACTIONS.includes(action) && !user.isAdmin && !user.approvePanels.includes(panelCode.value)) {
    return ElMessage.warning('当前角色无审批权限')
  }
  if (action === '扫描填单') {
    scanVisible.value = true;
    return
  }
  // 批量转ERP:弹窗显示已审核+未转的单据,勾选后批量推送
  if (action === '批量转ERP') {
    openBatchErp();
    return
  }
  // 材料二维码标签打印(品检分流链):本地拦截,数据源=当前暂收单明细行
  if (action === '打印标签') {
    openQrLabels();
    return
  }
      // ═══ 分批送料(2026-09-20):仅"批次源头那一跳"(采购订单→送料暂收单)弹分批对话框 ═══
      // 逐行填本次送料数量、可多次分批;下游(暂收→检验)来源已带批次号 → 一键整单生单,不弹框
      const pushTarget = cfgCache.value?.metadata?.pushTargets?.[action];
      if (await needBatchDialog(pushTarget)) {
        const no = current.value?.['单据编号'] || current.value?.['编号'] || '';
        if (!no) return ElMessage.warning('请先选择一张单据')
        batchSend.value = { sourcePanel: panelCode.value, targetPanel: pushTarget, sourceNo: no };
        batchSendVisible.value = true;
        return
      }
  // 工单二维码(计划层):单产品工单一张标签,二维码=公司代码@工单号@1000+工单行号(woQrText,2026-10-09 规则改版,扫码报工/领料入口);
  // 2026-09-22 面板化:适配生产工单(MANU_ORDER)字段(合同号/排产数量/生产单位/工序交期/生产线)
  // 生产工单:打印工单(生产任务单版式)/排产(本单快捷排线) —— 仅 MANU_ORDER 面板(2026-09-24 用户要求)
  if (action === '打印工单' && panelCode.value === 'MANU_ORDER') {
    await openPanelPrintWorkOrder();
    return
  }
  if (action === '排产' && panelCode.value === 'MANU_ORDER') {
    await openPanelSchedule();
    return
  }  if (action === '打印工单二维码') {
    const cur = current.value || {};
    const no = cur['单据编号'] || cur['编号'] || cur['合同号'] || cur['加工单号'] || '';
    if (!no) return ElMessage.warning('请先选择一张工单')
    const qty = cur['排产数量'] ?? cur['订单数量'] ?? cur['数量'] ?? '';
    const unit = cur['生产单位'] || cur['单位'] || '';
    const due = cur['工序交期'] || cur['预完工日'] || cur['交期'] || '-';
    qrLabels.value = [{
      code: no, name: cur['产品名称'] || cur['品名'] || '', lot: cur['批号'] || '', qty, unit,
      doc: `交期 ${due}` + (cur['生产线'] ? ` · ${cur['生产线']}` : ''),
      qrText: woQrText(cur), qr: '',
    }];
    qrVisible.value = true;
    return
  }
  // 采购订单·打印材料码(2026-10-04 用户口径:供应商自己打码):
  // 由"直接出纸"改为**打开打印弹窗** —— 打印时才能确定批次号(它原本要到生单那一刻才有),
  // 弹窗里按公式预填、可改、勾行填量,确认后**先落库登记**(bd_pu_label/bl_pu_label)再出纸,
  // 并**预约**该行数量(未生单的预约量从余量里扣减)。该预约随后在生单对话框的
  // 作为**独立的一行**被消费。方案:docs/plans/2026-10-04-采购订单材料码批次号方案.md
  // 入口分工不变:没批号→商品档案「二维码标签」;自己打带批号→本弹窗(采购入库单另有「打印标识卡」)。
  if (action === '打印材料码' && panelCode.value === 'PU_ORDER') {
    const cur = current.value || {};
    const no = cur['单据编号'] || cur['编号'] || '';
    if (!no) return ElMessage.warning(tt('请先选择一张单据'))
    materialLabelNo.value = no;
    materialLabelVisible.value = true;
    return
  }
  // 采购入库单·打印标识卡(2026-09-28 用户需求):当前单据明细行 → 商品档案同款 75×100mm 产品标识卡
  // (printProductCards 一行一卡);订单编号/供应商名称/数量/批次/生产日期取单据事实填充,缺值留横线手填。
  // 取数走 getFormDescriptor(已保存的最新行,同 打印采购订单 先例),不读编辑中的草稿。
  // 批次兜底(2026-09-28 用户反馈"标识卡没有批次号"):批次号口径上线前的老单 头/行批次号均空
  // (如 PI-2026-09-0013),打印层按既有口径兜底 行批次号→头批次号→单据日期推导(docNoFromDate,
  // 纯展示出参,不写库;空值才推导,不会覆盖任何人工值);二维码(公司代码@编码@批次)随之带出批号段。
  if (action === '打印标识卡' && panelCode.value === 'PURCHASE_IN') {
    const cur = current.value || {};
    const no = cur['单据编号'] || cur['编号'] || '';
    if (!no) return ElMessage.warning(tt('请先选择一张单据'))
    try {
      const res = await engine.getFormDescriptor({ panelCode: panelCode.value, code: no });
      const doc = res?.data || {};
      const lines = Object.values(res?.detailData || {})[0] || [];
      const headBatch = doc['批次号'] || docNoFromDate(doc['单据日期']) || '';
      const rows = (lines || [])
        .filter((l) => l && l['存货编码'])
        .map((l) => ({
          编码: l['存货编码'],
          规格: l['规格型号'] || '',
          数量: l['实收数量'] ?? l['数量'] ?? '',
          批次: l['批次号'] || l['批号'] || headBatch,
          订单编号: doc['采购订单号'] || doc['单据编号'] || no,
          供应商名称: doc['供应商'] || '',
          生产日期: l['生产日期'] || '',
        }));
      if (!rows.length) return ElMessage.warning(tt('当前单据没有可打印的明细行'))
      await printProductCards(rows);
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || tt('打印失败'));
    }
    return
  }
  // 银嘉固定版式纸质单打印(2026-09-23):采购订单/暂收退料单 → print-formats.js;
  // 列表选中单 → getFormDescriptor 取头+明细行(§5.5 D3:头=data,明细=detailData 首页签),新窗口打印
  // (无后端处理器,同 打印工单二维码 本地拦截先例)
  // 打印订单无金额(2026-09-28 用户澄清):采购订单的另一种报表,版式同款仅去 单价/小计/总计金额
  if (action === '打印采购订单' || action === '打印退货单' || action === '打印订单无金额') {
    const cur = current.value || {};
    const no = cur['单据编号'] || cur['编号'] || '';
    if (!no) return ElMessage.warning(tt('请先选择一张单据'))
    try {
      const res = await engine.getFormDescriptor({ panelCode: panelCode.value, code: no });
      const doc = res?.data || {};
      const lines = Object.values(res?.detailData || {})[0] || [];
      // 头单号键随面板而异(PU_ORDER=单据编号,QC_RETURN=单号/编号,见 PxController 纸张右上角注释)
      if (!doc['单据编号'] && !doc['单号'] && !doc['编号']) return ElMessage.warning(tt('未取到单据数据'))
      if (action === '打印采购订单') printPuOrder(doc, lines);
      else if (action === '打印订单无金额') printPuOrderNoAmount(doc, lines);
      else printQcReturn(doc, lines);
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || tt('打印失败'));
    }
    return
  }
  // 产品二维码(成型后):二维码=产品编码|产品批号;批号由后端按需取号(一次生成终身复用)
  if (action === '打印产品二维码') {
    const cur = current.value || {};
    const no = cur['单据编号'] || cur['编号'] || '';
    if (!no) return ElMessage.warning('请先选择一张工单')
    try {
      const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '生成产品批号', formData: { 编号: no }, buttonParam: {} });
      const lot = res?.['产品批号'];
      if (!lot) throw new Error('未返回产品批号')
      await load();
      const fresh = list.value.find((r) => (r['单据编号'] || r['编号']) === no) || cur;
      qrLabels.value = [{
        code: fresh['产品编码'] || cur['产品编码'] || '', name: fresh['产品名称'] || cur['产品名称'] || '',
        lot, qty: fresh['订单数量'] ?? cur['订单数量'], unit: fresh['单位'] || cur['单位'] || '',
        doc: `工单 ${no} · 交期 ${fresh['交期'] || cur['交期'] || '-'}`, qr: '',
      }];
      qrVisible.value = true;
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '生成产品批号失败');
    }
    return
  }
  if (action === '查询' || action === '查找') {
    // 查询弹窗面板(T+ 收发存/台账 + 库存状况):查询按钮重开条件弹窗,而非直接刷新
    if (queryInDialogOnly.value) { openQueryDialog(); return }
    search();
    return
  }
  // 库存三报表「重算成本」:全量重算移动加权物化表(审核钩子之外的兜底 —— 金蝶同步等旁路写入)
  if (action === '重算成本') {
    try {
      const res = await engine.callButton({ panelCode: panelCode.value, buttonName: action, formData: {}, buttonParam: {} });
      ElMessage.success(`${tt('重算成本')}${tt('完成')}(${res?.['重算行数'] ?? '?'} ${tt('行')})`);
      await load();
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || tt('按钮执行失败'));
    }
    return
  }
  if (action === '导出') {
    // 报表=整表 CSV;单据=当前明细页签 CSV(PANDA 打印组/委外更多 的导出)
    if (reportMode.value) exportReport();
    else exportDetail();
    return
  }
  if (action === '打印' || action === '预览') {
    if (docPrintEnabled.value) prepareDocPrint();
    window.print();
    return
  }
  if (action === '恢复') {
    await load();
    ElMessage.success('已恢复为最近一次保存的数据');
    return
  }
  if (reportMode.value && action === '发送邮件') {
    ElMessage.info('报表邮件发送需先配置企业邮箱服务');
    return
  }
  if (action === '退出') {
    router.push('/dashboard');
    return
  }
  // 放弃(列表页):丢弃内联草稿修改,恢复最近一次保存的数据
  if (action === '放弃') {
    if (draftEditable.value) {
      await load();
      ElMessage.success('已放弃未保存的修改');
    } else {
      ElMessage.info('当前没有未保存的修改');
    }
    return
  }
  // 复制(列表页):整单复制为一张新草稿(表头+明细,去掉编号/状态/行 id)
  if (action === '复制') {
    if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
    if (cfgCache.value?.metadata?.singleDoc) return ElMessage.info('档案面板不支持整单复制')
    const srcNo = current.value['编号'] || current.value['单据编号'];
    try {
      const fd = await engine.getFormDescriptor({ panelCode: panelCode.value, code: srcNo });
      const head = { ...(fd.data || {}) };
      delete head['编号']; delete head['单据状态'];
      const detail = {};
      for (const [key, rows] of Object.entries(fd.detailData || {})) {
        if (!Array.isArray(rows)) continue
        detail[key] = rows.map((row) => {
          const copy = { ...row };
          delete copy.id; delete copy.__id; delete copy.__no;
          return copy
        });
      }
      const res = await engine.callButton({
        panelCode: panelCode.value, buttonName: '保存', formData: { ...head, detail }, buttonParam: {},
      });
      ElMessage.success('已复制为新草稿：' + (res['编号'] || ''));
      await load();
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '复制失败');
    }
    return
  }
  if (action === '导入') {
    // Excel 导入：识别 A 区主明细字段，导入后追加行并自动保存
    const blk = blocks.value.find((x) => x.id === 'A');
    const tab = blk ? activeTab(blk) : null;
    if (!tab) return ElMessage.warning('该面板无明细可导入')
    // 字段定义取自面板配置 detail.tabs（blocks 的 tab 只有列名 cols）；档案面板无明细 tab → 用 dataSchema.fields
    const tabDef = (cfgCache.value?.detail?.tabs || []).find((t) => t.key === tab.key);
    const fields = (tabDef && tabDef.fields && tabDef.fields.length)
      ? tabDef.fields
      : (cfgCache.value?.dataSchema?.fields || []);
    impFields.value = (fields || []).filter((f) => !f.hidden);
    impLabel.value = tab.label || '明细';
    impVisible.value = true;
    return
  }
  // 选单通用化：任意 选X 动作且配置有 selectConfig 即走选单（对齐 PanelxForm 的通用分支）
  if (action === '选单' || action.startsWith('选')) {
    const sc = selectConfigFor(action);
    if (sc) {
      // 选单通用化：列表页内嵌小弹窗勾选已审核源单据，确定后生成目标单据并打开表单（对齐 T+ 选单生单语义，不再跳转「新增」页面）
      selCfg.value = sc;
      selVisible.value = true;
      return
    }
    ElMessage.info('演示环境暂未实现「选单」，界面与 T+ 保持一致');
    return
  }
  if (action === '新增' || action === '新建' || action === '新增流程') {
    if (cfgCache.value?.metadata?.singleDoc && current.value && current.value['编号']) {
      // 档案/单单据面板（存货档案、员工、部门等）：直接在当前单据页填写（列表页已内联可编辑），不弹新增弹窗
      ElMessage.info('请在下方列表页直接填写并保存');
      return
    }
    // 统一直接新增（2026-08-24 全量生效）：后端创建一张最新草稿单（autoCode 编号 + 单据日期=当天填入表头），
    // 刷新列表并定位到新单，在列表页内联填写（不再弹新增弹窗、不跳转表单页）。
    // 流程规范：新增时当前未保存内容直接剔除,不弹确认(directAdd 内部静默撤回占位单)
    await directAdd();
    return
  }
  // 2026-10-15:「修改」原=打开整单卡片(VoucherFormDialog),卡片已按用户口径删除,
  //   该动作也一并从工具栏摘掉(toolbarGroups 过滤),此处不再处理。
  if (['保存', '保存为草稿', '保存新增'].includes(action) && draftEditable.value) {
    if (action === '保存为草稿') {
      // 暂存:不校验(未完成的数据也可落库)
      await saveInlineDraft(action, { skipValidation: true });
      return
    }
    if (action === '保存新增') {
      // 保存当前单据(执行校验) → 成功后自动新增一页
      if (await saveInlineDraft('保存')) await directAdd();
      return
    }
    await saveInlineDraft(action);
    return
  }
  if (action === '刷新') {
    load();
    return
  }
  if (action === '表格调整') {
    openColPrefs();
    return
  }
  if (action === '表头调整') {
    openHeadPrefs();
    return
  }
  if (action === '字段管理') {
    fieldMgrVisible.value = true;
    return
  }
  if (action === '分类管理') {
    // 客户/供应商档案 → 对应分类面板(金蝶同款:分类不占导航,从档案工具栏进)
    const target = cfgCache.value?.metadata?.classifyPanel;
    const title = cfgCache.value?.metadata?.classifyTitle || target;
    if (!target) return ElMessage.warning(tt('该面板没有可管理的分类'))
    const targetPath = `/panelx/list/${target}`;
    router.push(targetPath);
    tabs.open({ path: targetPath, title: tt(title) });
    return
  }
  if (action === '二维码标签') {
    // 二维码标签(INV,2026-09-24 改版,用户拍板):勾行 → 75×100mm 七字段标签
    // (订单编号/供应商名称/物料编码/物料规格/数量/批次/生产日期,编码·规格取行,其余手填);
    // 二维码=公司代码@物料编码[@批号](print-formats.printProductCards 本地生成;旧 /report/qr-label 暂留可回滚)
    // WHLOC 库位(2026-09-28):同款勾选即打,卡面=仓库/库位地址/库位编码(printLocationCards),
    // 二维码=仓库编码@库位地址@库位编码(同日改版:首段仓库→仓库编码,行带 仓库编码 值);
    // 勾选行键=仓库+库位编码 复合(后端 qrLabelKind/qrLabelScopeKey 分发)
    const whloc = cfgCache.value?.metadata?.qrLabelKind === 'whloc';
    const sel = qrSel.value;
    const rows = [];
    for (const b of blocks.value) {
      for (const r of archRows(b)) {
        const k = qrRowKey(r);
        if (!k || !sel.has(k)) continue
        if (whloc) rows.push({ 仓库: r['仓库'], 仓库编码: r['仓库编码'], 库位地址: r['库位地址'], 库位编码: r['库位编码'] });
        else rows.push({ 编码: k, 规格: r['规格型号'] || r['型号'] || '' });
      }
    }
    if (!rows.length) return ElMessage.warning(tt(whloc ? '请先勾选要打印的库位' : '请先勾选要导出的商品'))
    await (whloc ? printLocationCards(rows) : printProductCards(rows));
    return
  }
  // 文件类面板(文书式):「删除」= 整单删除(草稿直接作废;已归档提交删除申请,管理员审批)
  if (isApprovalDoc.value && (action === '删除' || action === '删除单据')) {
    if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
    const no = current.value['编号'] || current.value['单据编号'] || '';
    try {
      await ElMessageBox.confirm(
        `${tt('确定删除整张单据？')}（${tt('草稿')}${tt('直接作废')}；${tt('已归档')}${tt('需管理员审批通过后删除')}）`,
        tt('删除确认'),
        { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
      );
    } catch (e) {
      return
    }
    try {
      const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '删除', formData: { 编号: no }, buttonParam: {} });
      ElMessage.success(res?.['单据状态'] === '删除申请中' ? `${no} 删除申请已提交，待管理员审核` : `${no} 已删除`);
      delMode.value = false;
      delSel.value = [];
      load();
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '删除失败');
    }
    return
  }
  if (action === '删除单据') {
    if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
    const no = current.value['编号'] || current.value['单据编号'] || '';
    try {
      await ElMessageBox.confirm(tt('确认删除整张单据 {no}？该操作不可恢复。').replace('{no}', no), tt('删除单据确认'), { type: 'warning' });
    } catch (e) {
      return
    }
    try {
      await engine.deleteForms({ panelCode: panelCode.value, rowCodes: [no] });
      ElMessage.success('单据已删除：' + no);
      delMode.value = false;
      delSel.value = [];
      load();
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '删除失败');
    }
    return
  }
  if (action === '删除') {
    if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
    if (!delMode.value) {
      delMode.value = true;
      ElMessage.info('已进入删除模式：勾选要删除的行，再点「删除」确认；点「刷新」或翻页取消');
      return
    }
    if (!delSel.value.length) return ElMessage.warning(tt('请先勾选要删除的行'))
    try {
      await ElMessageBox.confirm(tt('确认删除勾选的 {n} 行明细？').replace('{n}', delSel.value.length), tt('删除确认'), { type: 'warning' });
    } catch (e) {
      return
    }
    try {
      // 勾选删除：从当前单据对应明细中移除所选行（按对象引用匹配）
      const blk = blocks.value.find((x) => x.isMain);
      const tab = blk ? activeTab(blk) : null;
      const key = tab ? tab.key : 'items';
      const items = cur.value.detail && Array.isArray(cur.value.detail[key]) ? cur.value.detail[key] : [];
      // 档案面板:删除走**显式作废行id**(不再靠"缺席即删除"推断)——先取 id 再摘行,
      // 提交内容仍是"只提交改动行"(其余行原样不动)
      const removedIds = singleDocMode.value
        ? delSel.value.map((r) => archiveRowIdOf(r)).filter(Boolean) : [];
      const remain = items.filter((it) => !delSel.value.includes(it));
      const head = { ...cur.value };
      delete head.detail;
      delete head['编号'];
      delete head['单据状态'];
      delete head['创建时间'];
      delete head['更新时间'];
      delete head['发起人编号'];
      const detailPayload = singleDocMode.value
        ? Object.fromEntries(Object.keys(cur.value.detail || {}).map((k) => [k, changedArchiveRows()]))
        : { ...(cur.value.detail || {}), [key]: remain };
      await engine.callButton({
        panelCode: panelCode.value,
        buttonName: '保存',
        formData: {
          ...head, 编号: cur.value['编号'], detail: detailPayload,
          ...(removedIds.length ? { 作废行id: removedIds } : {}),
        },
        buttonParam: archiveSaveParam(),
      });
      ElMessage.success('已删除 ' + delSel.value.length + ' 行');
      delMode.value = false;
      delSel.value = [];
      load();
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '删除失败');
    }
    return
  }
  if (['中止执行', '整单中止', '草稿', '取消中止', '提交审批', '审批通过', '驳回审批'].includes(action)) {
    if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
  }
  // 人工审核：确认弹窗 + 审核意见（选填）；审核人取当前登录人（后端从 JWT 取）
  let auditOpinion = '';
  if (action === '审核') {
    if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
    // 已审核过的单据不允许再次审核，也不允许补填审批意见
    if (current.value['单据状态'] !== '草稿') return ElMessage.warning('仅草稿状态可审核，已审核单据不允许再次审核')
    const no = current.value['编号'] || current.value['单据编号'] || '';
    try {
      const { value } = await ElMessageBox.prompt(
        tt('单据：{no}（当前状态：{st}）').replace('{no}', no).replace('{st}', current.value['单据状态'] || ''),
        '人工审核确认',
        { confirmButtonText: '确认审核', cancelButtonText: '取消', inputType: 'textarea', inputPlaceholder: '审核意见（选填）' }
      );
      auditOpinion = value || '';
    } catch (e) {
      return
    }
  } else if (action === '弃审') {
    if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
    if (current.value['单据状态'] !== '已审核') return ElMessage.warning(tt('仅已审核状态可弃审'))
    try {
      await ElMessageBox.confirm(tt('确认弃审该单据？弃审后需重新审核。'), tt('弃审确认'), { type: 'warning' });
    } catch (e) {
      return
    }
  }
  try {
    // 审批流：提交审批/审批通过（确认+意见）、审批驳回（意见必填）、审批情况（历史弹窗）
    let approvalOpinion = '';
    // 「申请修改」的修改原因(2026-09-30 需求:数据记录表「修改:只需填写修改原因」)
    let modifyReason = '';
    if (action === '提交审批' || action === '审批通过') {
      if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
      // 提交审批:草稿或修改态(文件类申请修改经审批)可提交;审批通过:审批中(一级)/待二级审批(二级)
      if (action === '提交审批') {
        if (!['草稿', '修改中'].includes(current.value['单据状态'])) return ElMessage.warning('仅草稿或修改中状态可提交审批')
      } else if (!IN_APPROVAL.includes(current.value['单据状态'])) {
        return ElMessage.warning('仅审批中或待二级审批状态可审批通过')
      }
      // 产品信息表一级节点(状态=审批中):走「选取二级审核人」弹窗(二级签核人由一级指定)
      if (action === '审批通过' && panelCode.value === 'RD_PROD_INFO' && current.value['单据状态'] === '审批中') {
        if (draftEditable.value) {
          const saved = await saveInlineDraft('保存', { silent: true });
          if (!saved) return
        }
        return openL2Pick(current.value['编号'] || current.value['单据编号'] || '')
      }
      const no = current.value['编号'] || current.value['单据编号'] || '';
      try {
        const { value } = await ElMessageBox.prompt(
          tt('单据：{no}（当前状态：{st}）').replace('{no}', no).replace('{st}', current.value['单据状态'] || ''),
          action + '确认',
          { confirmButtonText: '确认' + action, cancelButtonText: '取消', inputType: 'textarea', inputPlaceholder: action === '审批通过' ? '审批意见（选填）' : '提交说明（选填）' }
        );
        approvalOpinion = value || '';
      } catch (e) {
        return
      }
    } else if (action === '申请修改') {
      // 2026-09-30 需求(《产品开发系统需求汇总.xlsx》sheet「数据记录表」第 2 条:
      //   「修改:不需要反审核,只需填写修改原因」):申请修改**必须填原因**。
      // 用户口径「改完需要再审核」⇒ 本处只补这一格,后面的
      //   「申请修改 → 管理员批 → 改 → 提交审批 → 管理员批 → 再归档」闭环原样不动。
      // 原因随 formData 的「修改原因」键发到后端(PanelxList 此前对申请修改**没有任何输入框**,
      // 后端 modifyRequest 拿到的原因因此恒为空串)。
      if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
      const noMod = current.value['编号'] || current.value['单据编号'] || '';
      try {
        const { value } = await ElMessageBox.prompt(
          tt('单据：{no}（当前状态：{st}）\n请写明本次要修改什么、为什么改').replace('{no}', noMod).replace('{st}', current.value['单据状态'] || ''),
          tt('申请修改确认'),
          {
            confirmButtonText: tt('提交修改申请'),
            cancelButtonText: tt('取消'),
            inputType: 'textarea',
            inputPlaceholder: tt('修改原因（必填）'),
            inputValidator: (v) => (v && v.trim() ? true : tt('修改原因不能为空')),
          }
        );
        modifyReason = value || '';
      } catch (e) {
        return
      }
    } else if (action === '审批驳回') {
      if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
      if (!IN_APPROVAL.includes(current.value['单据状态'])) return ElMessage.warning(tt('仅审批中或待二级审批状态可审批驳回'))
      const no = current.value['编号'] || current.value['单据编号'] || '';
      try {
        const { value } = await ElMessageBox.prompt(
          tt('单据：{no}（当前状态：审批中）\n驳回必须填写审批意见').replace('{no}', no),
          tt('审批驳回确认'),
          { confirmButtonText: tt('确认驳回'), cancelButtonText: tt('取消'), inputType: 'textarea', inputPlaceholder: tt('驳回原因（必填）'), inputValidator: (v) => (v && v.trim() ? true : tt('驳回必须填写审批意见')) }
        );
        approvalOpinion = value || '';
      } catch (e) {
        return
      }
    } else if (action === '审批情况') {
      if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
      approvalNo.value = current.value['编号'] || current.value['单据编号'] || '';
      approvalVisible.value = true;
      return
    } else if (['提交会签', '会签通过', '会签驳回', '撤回会签'].includes(action)) {
      // 产品变更申请单会签组(2026-09-21):驳回必须填意见;其余给一次确认(会签=对别人负责的动作)
      if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
      const no2 = current.value['编号'] || current.value['单据编号'] || '';
      try {
        if (action === '会签驳回') {
          const { value } = await ElMessageBox.prompt(
            tt('单据：{no}（当前状态：会签中）\n驳回必须填写意见').replace('{no}', no2),
            tt('会签驳回确认'),
            { confirmButtonText: '确认驳回', cancelButtonText: '取消', inputType: 'textarea',
              inputPlaceholder: tt('驳回意见（必填）'), inputValidator: (v) => (v && v.trim() ? true : tt('会签驳回必须填写意见')) }
          );
          approvalOpinion = value || '';
        } else {
          await ElMessageBox.confirm(
            tt('单据：{no}（当前状态：{st}）').replace('{no}', no2).replace('{st}', current.value['单据状态'] || ''),
            action + '确认',
            { confirmButtonText: '确认' + action, cancelButtonText: '取消', type: 'warning' }
          );
          if (action === '会签通过') approvalOpinion = '';
        }
      } catch (e) {
        return
      }
    }
    const actionDocumentNo = current.value?.['编号'] || current.value?.['单据编号'] || '';
    // 列表页草稿是前端内联编辑态；审核/提交审批前必须先落库，否则状态刷新后会显示数据库中的旧空明细。
    // (提交会签同此:需会签/会签人 是头字段,刚填的必须先生效,否则后端按库里的旧值判"没填会签人")
    if (['审核', '提交审批', '提交会签'].includes(action) && draftEditable.value) {
      const saved = await saveInlineDraft('保存', { silent: true });
      if (!saved) return
    }
    const res = await engine.callButton({
      panelCode: panelCode.value,
      buttonName: action,
      formData: current.value ? { 编号: current.value['编号'], ...(auditOpinion !== '' ? { 审核意见: auditOpinion } : {}), ...(approvalOpinion !== '' ? { 审批意见: approvalOpinion } : {}), ...(modifyReason !== '' ? { 修改原因: modifyReason } : {}) } : {},
      buttonParam: {},
    });
    // 送料暂收单「生单」按商品基本档案「来料检验」**逐行分流**(2026-10-05 用户口径):
    // 一张暂收单可能同时产出 来料检验单 + 采购入库单,后端把实际生成的清单放在 res['生成清单'] —— 这里逐张说清,
    // 再跳到第一张(通用 gotoPanel 分支只会报一张,会把"其实还生成了另一张"瞒掉)。
    if (Array.isArray(res?.['生成清单']) && res['生成清单'].length) {
      const made = res['生成清单'];
      const parts = made.map((m) => `${tt(m['面板名称'])} ${m['编号']}（${m['行数']} ${tt('行')}）`).join('、');
      ElMessage.success(`${tt('已生成')} ${parts}，${tt('请在列表页继续填写')}`);
      const missing = res['未登记商品'];
      if (Array.isArray(missing) && missing.length) {
        ElMessage.warning(`${tt('商品档案未登记的商品按免检（否）处理')}：${missing.join('、')}`);
      }
      const targetPanel = made[0]['面板'];
      const targetPath = `/panelx/list/${targetPanel}`;
      tabs.close(route.path);
      router.push(targetPath);
      tabs.open({ path: targetPath, title: targetPanel });
      return
    }
      if (res?.gotoPanel) {
      if (res.gotoPanel === 'WORK_ORDER_LIST') {
        // 单轨(2026-09-26):生产工单落 plang,前往生产工单列表页(独立路由,非 panelx 面板)
        ElMessage.success(`已生成生产工单：${(res['编号清单'] || [res['编号']]).join('、')}`);
        tabs.close(route.path);
        router.push('/prod/plan/workOrderList');
        tabs.open({ path: '/prod/plan/workOrderList', title: '生产工单' });
        return
      }
      // 推式生单：直接跳转到目标面板列表页（不新开标签页），新生成的单据按创建时间倒序显示在第一张（草稿内联可编辑）
      ElMessage.success(`已生成${res.gotoPanel === 'MANU_ORDER' ? '生产工单' : res.gotoPanel}：${res['编号']}，请在列表页继续填写`);
      const targetPath = `/panelx/list/${res.gotoPanel}`;
      tabs.close(route.path); // 关闭当前源面板页签（页签被目标面板替换）
      router.push(targetPath);
      tabs.open({ path: targetPath, title: res.gotoPanel });
      return
    }
    ElMessage.success(`「${action}」执行成功`);
    await load();
    const actionIndex = list.value.findIndex((item) => (
      (item['编号'] || item['单据编号'] || item['锭号']) === actionDocumentNo
    ));
    if (actionIndex >= 0) curIdx.value = actionIndex;
  } catch (e) {
    const msg = engine.errMsg(e) || '按钮执行失败';
    if (msg.includes('演示环境暂未实现')) ElMessage.info(msg);
    else ElMessage.error(msg);
  }
}

async function onScanApply(payload) {
  if (!draftEditable.value) {
    try {
      const created = await engine.callButton({ panelCode: panelCode.value, buttonName: '保存', formData: {}, buttonParam: {} });
      const documentNo = created?.['编号'] || created?.formNo;
      if (!documentNo) throw new Error('未返回单据编号')
      await load();
      const index = list.value.findIndex((row) => row['编号'] === documentNo);
      curIdx.value = index >= 0 ? index : 0;
    } catch (error) {
      ElMessage.error(engine.errMsg(error) || '新建草稿失败');
      return
    }
  }

  const fields = new Map(headerFields.value.map((field) => [headerFieldKey(field), field]));
  for (const [key, value] of Object.entries(payload?.header || {})) {
    const field = fields.get(key);
    if (!field || field.hidden || field.computed || field.autoCode || headerFieldLocked(field)) continue
    cur.value[key] = value;
  }

  if (!cur.value.detail) cur.value.detail = {};
  const tabMap = new Map((cfgCache.value?.detail?.tabs || []).map((tab) => [tab.key, tab]));
  for (const [tabKey, rows] of Object.entries(payload?.detail || {})) {
    const tab = tabMap.get(tabKey);
    if (!tab || !Array.isArray(rows)) continue
    const writable = new Set((tab.fields || []).filter((field) => !field.hidden && !field.computed).map((field) => field.dataName));
    const recognizedRows = rows.map((row) => Object.fromEntries(
      Object.entries(row || {}).filter(([key]) => writable.has(key)),
    ));
    cur.value.detail[tabKey] = payload?.detailMode === 'append'
      ? [...(cur.value.detail[tabKey] || []), ...recognizedRows]
      : recognizedRows;
    for (const row of cur.value.detail[tabKey]) calculateDetailRow(tabKey, row);
  }
  ElMessage.success('识别数据已填入草稿，请核对后保存');
}

async function load(clamping = false) {
  delMode.value = false;
  delSel.value = [];
  archPage.value = 1; // 档案分页随每次载入回到首页
  if (invalidPanel.value) {
    ElMessage.error('面板编号无效，请从菜单重新进入');
    return
  }
  await loadCrg(); // 配置先行(弹窗门依赖 metadata.reportQueryDialog)
  if (reportQueryDialog.value && !rqdDone.value) {
    loading.value = false;
    list.value = [];
    total.value = 0;
    openQueryDialog(); // 与「查询」按钮同一个弹窗(格式一致)
    return
  }
  loading.value = true;
  try {
    loadReportTemplates(); // 服务端报表入口(该面板有模板才显示;不阻塞列表)
    const params = { panelCode: panelCode.value, condition: { ...condition }, pageNo: query.pageNo, pageSize: query.pageSize };
    // 模糊搜索生效中:叠加字段条件(后端 AND)与「全部字段」关键字
    if (fuzzyApplied.value?.valid) {
      Object.assign(params.condition, fuzzyApplied.value.condition || {});
      if (!query.keyword && fuzzyApplied.value.keyword) params.keyword = fuzzyApplied.value.keyword;
    }
    if (query.keyword) params.keyword = query.keyword;
    // 高级筛选服务端化:报表(平表)与单据(2026-09-24 起)都随查询 POST advFilters,后端逐条 AND 并入
    // WHERE → 全表过滤,分页 totalSize 与导出一致;单据面板只认头表字段(行级字段后端剔除)。
    // 台账期初/期末合成行按 仓库+存货+日期段 另算,不受影响。弹窗「模糊搜索」仅报表同批发。
    if (reportMode.value || docPanel.value) {
      if (activeAdvFilters.value.length) {
        params.advFilters = activeAdvFilters.value.map((f) => ({ field: f.field, op: f.op, value: String(f.value ?? '').trim() }));
      }
      if (reportMode.value && reportKeyword.value.trim()) params.keyword = reportKeyword.value.trim();
    }
    const res = await engine.queryFormDataList(params);
    markArchListRaw(res.list); // 档案:进入响应式系统前 markRaw 明细行(赋值后打在代理上无效)
    list.value = res.list || [];
    total.value = res.totalSize || 0;
    // 档案「改动行提交」基线:载入即快照,保存只发改动行(见 archiveBaseline 注释)
    snapshotArchiveBaseline();
    // 页码越界自愈(末页删单/换每页条数/筛选后页码残留):回落到最后一页重取,避免空白页与页码错乱
    const lp = Math.max(1, Math.ceil(total.value / Math.max(1, query.pageSize)));
    if (!clamping && query.pageNo > lp) {
      query.pageNo = lp;
      await load(true);
      return
    }
    if (curIdx.value >= list.value.length) curIdx.value = 0;
    // 2026-08-25：?focus=单号 定位（选单/生单从表单页跳转过来时直接显示目标单据）
    const focus = route.query.focus;
    if (focus) {
      const fi = list.value.findIndex((r) => (r['编号'] || r['单据编号'] || r['锭号']) === String(focus));
      if (fi >= 0) curIdx.value = fi;
      router.replace({ path: route.path, query: { ...route.query, focus: undefined } });
    }
    // 参照字段模式跟随最新数据量(增删档案跨越 20 条阈值时下拉↔弹窗自动切换)
    refreshRefModes();
    markSavedSnapshot(); // 未保存离开守卫的基线快照（载入即干净；保存成功也会经此刷新）
    inlineDirtyFlag.value = false;
    restoreFreshDraft(); // 刷新/重进后恢复「本次新增未保存草稿」标记,守卫仍可撤回
  } catch (e) {
    const msg = engine.errMsg(e) || '加载失败';
    ElMessage.error(msg);
  } finally {
    loading.value = false;
  }
}

function search() {
  query.pageNo = 1;
  curIdx.value = 0;
  load();
}

function onNewSaved() {
  load();
}

function onSelGenerated(generated) {
  const first = generated && generated[0];
  const finish = () => {
    if (first) {
      // 2026-08-25：选单生成后不再弹窗，直接定位到列表页新选入单据（一屏一单流览）
      const idx = list.value.findIndex((r) => (r['编号'] || r['单据编号'] || r['锭号']) === first.no);
      curIdx.value = idx >= 0 ? idx : 0;
    }
  };
  load().then(finish);
}

// Excel 导入完成：单据面板追加到当前单明细并保存；档案面板（无明细 tab）逐行新建档案
async function onImported(rows) {
  const hasDetailTabs = (cfgCache.value?.detail?.tabs || []).length > 0;
  if (!hasDetailTabs) {
    // 档案类（EMP/DEPT/WH…）：Excel 每行 = 一条新档案
    ElMessage.success('已解析 ' + rows.length + ' 行，正在逐条建档…');
    let ok = 0;
    try {
      for (const r of rows) {
        await engine.callButton({ panelCode: panelCode.value, buttonName: '保存', formData: { ...r }, buttonParam: {} });
        ok++;
      }
      ElMessage.success('已导入 ' + ok + ' 条档案');
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '第 ' + (ok + 1) + ' 条导入失败');
    }
    load();
    return
  }
  const blk = blocks.value.find((x) => x.id === 'A');
  const tab = blk ? activeTab(blk) : null;
  const key = tab ? tab.key : 'items';
  if (!cur.value.detail || !Array.isArray(cur.value.detail[key])) {
    if (!cur.value.detail) cur.value.detail = {};
    cur.value.detail[key] = [];
  }
  for (const r of rows) cur.value.detail[key].push(r);
  ElMessage.success('已导入 ' + rows.length + ' 行，正在保存…');
  try {
    const head = { ...cur.value };
    delete head.detail;
    delete head['编号'];
    delete head['单据状态'];
    delete head['创建时间'];
    delete head['更新时间'];
    delete head['发起人编号'];
    await engine.callButton({
      panelCode: panelCode.value,
      buttonName: '保存',
      formData: { ...head, 编号: cur.value['编号'], detail: { ...cur.value.detail } },
      buttonParam: {},
    });
    ElMessage.success('导入并保存成功');
    load();
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '保存失败');
  }
}

// 明细行单击：占位行 → 新增行；产成品明细行 → 联动过滤材料明细（存货 INV 面板为纯存货管理,行点击不做额外处理）
function onRowClick(row, b) {
  if (row?._placeholder && detailEditable(b)) {
    openBlankDetailRow(b);
    return
  }
  // 产成品→材料联动：MANU_ORDER 等单据点产成品明细行 → 材料明细只显示其 BOM 子件
  if (b && b.id === 'A' && row && row['产品编码'] && row['产品编码'] !== selectedProduct.value) {
    selectProduct(row['产品编码']);
    return
  }
  // 存货（INV）面板为纯存货管理,存货行点击不再做任何额外处理
  if (panelCode.value === 'INV') return
}

// 捕获阶段监听：点产成品明细行任意单元格（含固定列/控件）都触发联动
async function onTableClick(b, e) {
  if (!b || !e || !e.target || !e.target.closest) return
  const t = activeTab(b);
  if (b.id !== 'A') return
  if (t.key !== 'products') return
  const tr = e.target.closest('tr');
  if (!tr) return
  const body = tr.closest('.el-table__body-wrapper') || tr.closest('.el-table__fixed-body-wrapper');
  const rows = body ? [...body.querySelectorAll('tbody tr')] : [];
  const idx = rows.indexOf(tr);
  const row = detailRows(t)[idx];
  if (!row || !row['产品编码']) return
  selectProduct(row['产品编码']);
}

// 选中产成品：行高亮 + 材料明细联动（材料行按自身 子件BOM=产品编码 的存储值过滤，纯本地数据，无外部取数）
function selectProduct(code) {
  selectedProduct.value = code;
}

// 切面板拆装分帧(2026-09-28):清空 cfgCache/gridTabs 会同步拆掉旧表格,而参照记忆化后
// getPanelConfig 瞬时命中缓存(微任务边界)⇒ 拆旧+装新挤进同一个 patch —— 宽表面板实测
// 233ms 单帧长任务。让出一帧(浏览器先提交"移除旧 DOM")再装新面板,长帧减半;
// 连续快速切换用 token 只认最后一次,避免过期装载。
let switchFrameToken = 0;
watch(
  () => [panelCode.value, operationName.value],
  async () => {
    scanVisible.value = false;
    // 2026-08-20：关闭页签/切走时 panelCode 变 undefined——不触发加载（避免「面板编号无效」误报）
    if (!panelCode.value || panelCode.value === 'undefined') return
    // 拆除顺序(2026-09-28):先清行、再清配置 —— 若在仍挂着旧行数据时清 gridTabs,
    // el-table 每删一列都会对全部行重渲染一次(O(列×行),宽表拆除的主长帧来源之一)。
    list.value = [];
    total.value = 0;
    cfgCache.value = null;
    qrSel.value = new Set(); // 二维码标签勾选集随面板清空(行键属于上一个档案)
    resetDictModes();
    resetTableSorts(); // 切面板清排序(同一面板内保留:切单据/翻页/查询都在)
    // 切面板退出模糊搜索态并清条件(条件字段属于上一个面板)
    fuzzyMode.value = false;
    fuzzyRows.value = [{ field: '', value: '' }];
    fuzzySearched.value = false;
    fuzzyApplied.value = null;
    fuzzyPrevPageSize = null;
    qOptCache.clear();
    Object.keys(condition).forEach((key) => delete condition[key]);
    Object.keys(queryDraft).forEach((key) => delete queryDraft[key]);
    query.keyword = '';
    queryFields.value = [];
    gridTabs.value = [];
    queryRefVisible.value = false;
    queryRefField.value = null;
    queryDialogVisible.value = false;
    headerRefVisible.value = false;
    headerRefField.value = null;
    detailRefVisible.value = false;
    detailRefPick.value = null;
    curIdx.value = 0;
    // 跨面板跳转(采购订单「送料批次」→暂收单、左栏链路跳转等):同一路由记录换面板时组件被复用,
    // onMounted 不再执行 —— 这里同样消费 ?docNo=,否则会退回「列表第一张」而定位不到目标单据
    const tok = ++switchFrameToken;
    // 双 rAF:任务里注册的 rAF 在**同一帧**绘制前执行,拆装之间并不会发生绘制;
    // 嵌套一层才真正等到"旧 DOM 已提交绘制"之后的下一帧(实测单层时 INV→SO_ORDER 仍有 200ms 同帧)。
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (tok !== switchFrameToken || !panelCode.value || panelCode.value === 'undefined') return
    if (applyDocNoQuery()) load();
    else search();
  }
);

let lastDocJumpAt = 0;
/** 消费 URL 上的 ?docNo=(定位到指定单据);消费后从地址栏摘除,避免污染后续切换。挂载与路由变化共用 */
function applyDocNoQuery() {
  const no = route.query.docNo;
  if (!no) return false
  docQueryNo.value = String(no);
  condition['_docNo'] = String(no);
  lastDocJumpAt = Date.now();
  router.replace({ path: route.path, query: { ...route.query, docNo: undefined } });
  return true
}
// 同一面板内跳另一张单据(panelCode 不变,上面的 watcher 不触发)
watch(
  () => route.query.docNo,
  (v) => {
    if (!v || Date.now() - lastDocJumpAt < 400) return
    if (applyDocNoQuery()) load();
  }
);

watch(detailRefVisible, (visible) => {
  if (!visible && !detailRefSaving.value) {
    discardCreatedDetailRefRow(detailRefPick.value);
    detailRefPick.value = null;
  }
});

watch(headerRefVisible, (visible) => {
  if (!visible) headerRefField.value = null;
});

watch(queryRefVisible, (visible) => {
  if (!visible) queryRefField.value = null;
});

// 快捷入口「新增单据」（?new=1）统一走直接新增（不弹窗）；singleDoc 无单据时兜底弹窗新建
let newQueryHandled = false;
async function handleNewQuery() {
  if (newQueryHandled) return
  if (cfgCache.value?.metadata?.singleDoc && current.value && current.value['编号']) {
    newQueryHandled = true;
    ElMessage.info('请在下方列表页直接填写并保存');
    return
  }
  if (cfgCache.value?.metadata?.singleDoc) {
    newQueryHandled = true;
    newVisible.value = true;
    return
  }
  newQueryHandled = true;
  await directAdd();
}
watch(
  () => route.query.new,
  (v) => {
    if (v) handleNewQuery();
  }
);
watch(cfgCache, (cfg) => {
  // 配置加载完成后处理初始 ?new=1（此时才能判断 singleDoc）
  if (cfg && route.query.new) handleNewQuery();
});

onMounted(() => {
  document.addEventListener('click', closeCtx);
  document.addEventListener('contextmenu', closeCtx);
  // 单据打印版式:Ctrl+P 直打印同样走 .doc-print 层;打印结束还原屏幕
  window.addEventListener('beforeprint', onBeforePrintDoc);
  window.addEventListener('afterprint', onAfterPrintDoc);
  if (invalidPanel.value) {
    router.replace('/panelx/list/MANU_ORDER');
    return
  }
  // 从「我的桌面 · 产品开发」矩阵跳转:带 ?docNo= 直接定位到该单据
  applyDocNoQuery();
  load();
});

onDeactivated(() => {
  // keep-alive 切离时关闭弹窗（防止 append-to-body 弹窗残留）
  newVisible.value = false;
  queryDialogVisible.value = false;
  queryRefVisible.value = false;
  queryRefField.value = null;
  headerRefVisible.value = false;
  headerRefField.value = null;
  detailRefVisible.value = false;
  detailRefPick.value = null;
  impVisible.value = false;
  scanVisible.value = false;
  maintainVisible.value = false;
  selVisible.value = false;
});

onUnmounted(() => {
  document.removeEventListener('click', closeCtx);
  document.removeEventListener('contextmenu', closeCtx);
  window.removeEventListener('beforeprint', onBeforePrintDoc);
  window.removeEventListener('afterprint', onAfterPrintDoc);
  document.body.classList.remove('doc-printing');
});

return (_ctx, _cache) => {
  const _component_el_icon = ElIcon;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_input = ElInput;
  const _component_el_button = ElButton;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_option_group = ElOptionGroup;
  const _component_el_table_column = ElTableColumn;
  const _component_el_input_number = ElInputNumber;
  const _component_el_table = ElTable;
  const _component_el_switch = ElSwitch;
  const _component_el_popover = ElPopover;
  const _component_el_pagination = ElPagination;
  const _component_el_checkbox = ElCheckbox;
  const _component_el_dialog = ElDialog;
  const _component_el_empty = ElEmpty;
  const _component_el_tag = ElTag;
  const _component_el_radio_button = ElRadioButton;
  const _component_el_radio_group = ElRadioGroup;
  const _component_el_checkbox_group = ElCheckboxGroup;
  const _directive_loading = vLoading;

  return (openBlock(), createElementBlock("div", {
    class: "panelx-list",
    onClick: closeCtx
  }, [
    (!isApprovalDoc.value && !isQcInspReq.value)
      ? (openBlock(), createElementBlock("div", _hoisted_1, [
          createBaseVNode("button", {
            type: "button",
            class: "toolbar-query-btn",
            title: unref(tt)('按表头字段查询单据'),
            onClick: withModifiers(openQueryDialog, ["stop"])
          }, [
            createVNode(_component_el_icon, null, {
              default: withCtx(() => [
                createVNode(unref(search_default))
              ]),
              _: 1
            }),
            createBaseVNode("span", null, toDisplayString(unref(tt)('查询')), 1)
          ], 8, _hoisted_2),
          (panelCode.value === 'STOCK_STATUS')
            ? (openBlock(), createBlock(_component_el_select, {
                key: 0,
                modelValue: stockWh.value,
                "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((stockWh).value = $event)),
                class: "wh-filter",
                size: "small",
                clearable: "",
                filterable: "",
                placeholder: unref(tt)('全部仓库'),
                onChange: onStockWhChange
              }, {
                default: withCtx(() => [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(warehouseOptions.value, (w) => {
                    return (openBlock(), createBlock(_component_el_option, {
                      key: w.code,
                      label: `${w.name}（${w.code}）`,
                      value: w.code
                    }, null, 8, ["label", "value"]))
                  }), 128))
                ]),
                _: 1
              }, 8, ["modelValue", "placeholder"]))
            : createCommentVNode("", true),
          (panelCode.value === 'STOCK_STATUS')
            ? (openBlock(), createElementBlock("button", {
                key: 1,
                type: "button",
                class: "toolbar-query-btn",
                onClick: withModifiers(openStockAdd, ["stop"])
              }, [
                createVNode(_component_el_icon, null, {
                  default: withCtx(() => [
                    createVNode(unref(plus_default))
                  ]),
                  _: 1
                }),
                createBaseVNode("span", null, toDisplayString(unref(tt)('新增库存')), 1)
              ]))
            : createCommentVNode("", true),
          (openBlock(true), createElementBlock(Fragment, null, renderList(toolbarGroups.value, (g, gi) => {
            return (openBlock(), createElementBlock("div", {
              class: "tb-group",
              key: 'g' + gi
            }, [
              createBaseVNode("span", {
                class: normalizeClass(["tb-main", { disabled: isDisabled(btnName(g)) }]),
                onClick: $event => (onButton(btnName(g)))
              }, [
                createBaseVNode("span", _hoisted_4, toDisplayString(unref(tt)(g.name)), 1)
              ], 10, _hoisted_3),
              (actsOf(g).length > 1)
                ? (openBlock(), createElementBlock("span", {
                    key: 0,
                    class: "tb-caret",
                    onClick: withModifiers($event => (toggleGroup(gi)), ["stop"])
                  }, "▼", 8, _hoisted_5))
                : createCommentVNode("", true),
              (openGroup.value === gi)
                ? (openBlock(), createElementBlock("div", _hoisted_6, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(dropItems(g), (a) => {
                      return (openBlock(), createElementBlock("div", {
                        class: normalizeClass(["ctx-item", { disabled: isDisabled(a) }]),
                        key: a,
                        onClick: $event => (onGroupAction(a))
                      }, toDisplayString(unref(tt)(a)), 11, _hoisted_7))
                    }), 128))
                  ]))
                : createCommentVNode("", true)
            ]))
          }), 128)),
          (reportTemplates.value.length || unref(user).isAdmin)
            ? (openBlock(), createElementBlock("span", {
                key: 2,
                class: "tb-main",
                title: unref(tt)('服务端正式报表：含公司抬头、页眉页脚与页码'),
                onClick: _cache[1] || (_cache[1] = withModifiers($event => (reportVisible.value = true), ["stop"]))
              }, [
                createBaseVNode("span", _hoisted_9, toDisplayString(unref(tt)('导出报表')), 1)
              ], 8, _hoisted_8))
            : createCommentVNode("", true),
          createBaseVNode("div", _hoisted_10, [
            (reportMode.value)
              ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                  createBaseVNode("span", _hoisted_11, toDisplayString(panelName.value), 1),
                  createBaseVNode("span", _hoisted_12, toDisplayString(unref(tt)('共')) + " " + toDisplayString(total.value) + " " + toDisplayString(unref(tt)('条')), 1),
                  createBaseVNode("span", {
                    class: "page-btn",
                    title: unref(tt)('首页'),
                    onClick: _cache[2] || (_cache[2] = $event => (reportPage(1)))
                  }, "◁", 8, _hoisted_13),
                  createBaseVNode("span", {
                    class: "page-btn",
                    title: unref(tt)('上一页'),
                    onClick: _cache[3] || (_cache[3] = $event => (reportPage(query.pageNo - 1)))
                  }, "◀", 8, _hoisted_14),
                  createBaseVNode("span", _hoisted_15, toDisplayString(pageText(query.pageNo, reportPageCount.value, '页')), 1),
                  createBaseVNode("span", {
                    class: "page-btn",
                    title: unref(tt)('下一页'),
                    onClick: _cache[4] || (_cache[4] = $event => (reportPage(query.pageNo + 1)))
                  }, "▶", 8, _hoisted_16),
                  createBaseVNode("span", {
                    class: "page-btn",
                    title: unref(tt)('末页'),
                    onClick: _cache[5] || (_cache[5] = $event => (reportPage(reportPageCount.value)))
                  }, "▷", 8, _hoisted_17)
                ], 64))
              : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                  createBaseVNode("span", _hoisted_18, toDisplayString(unref(tt)('单据：')) + toDisplayString(cur.value['编号'] || cur.value['单据编号'] || '-'), 1),
                  (cur.value['批次号'])
                    ? (openBlock(), createElementBlock("span", {
                        key: 0,
                        class: "doc-batch",
                        title: unref(tt)('批次号')
                      }, toDisplayString(unref(tt)('批次号')) + ": " + toDisplayString(cur.value['批次号']), 9, _hoisted_19))
                    : createCommentVNode("", true),
                  (cur.value['类别'])
                    ? (openBlock(), createElementBlock("span", _hoisted_20, toDisplayString(unref(tt)(cur.value['类别'])), 1))
                    : createCommentVNode("", true),
                  (cur.value['单据状态'])
                    ? (openBlock(), createElementBlock("span", {
                        key: 2,
                        class: normalizeClass(["doc-status", cur.value['单据状态']])
                      }, toDisplayString(unref(tt)(cur.value['单据状态'])), 3))
                    : createCommentVNode("", true),
                  (!singleDocMode.value)
                    ? (openBlock(), createElementBlock(Fragment, { key: 3 }, [
                        createBaseVNode("span", {
                          class: "page-btn",
                          title: unref(tt)('首页'),
                          onClick: pageFirst
                        }, "◁", 8, _hoisted_21),
                        createBaseVNode("span", {
                          class: "page-btn",
                          title: unref(tt)('上一张'),
                          onClick: _cache[6] || (_cache[6] = $event => (page(-1)))
                        }, "◀", 8, _hoisted_22),
                        createBaseVNode("span", _hoisted_23, toDisplayString(pageText(curNo.value, total.value, '张')), 1),
                        createBaseVNode("span", {
                          class: "page-btn",
                          title: unref(tt)('下一张'),
                          onClick: _cache[7] || (_cache[7] = $event => (page(1)))
                        }, "▶", 8, _hoisted_24),
                        createBaseVNode("span", {
                          class: "page-btn",
                          title: unref(tt)('末页'),
                          onClick: pageLast
                        }, "▷", 8, _hoisted_25)
                      ], 64))
                    : createCommentVNode("", true)
                ], 64))
          ])
        ]))
      : createCommentVNode("", true),
    (reportMode.value && !reportQueryDialog.value && !isCascadePanel.value)
      ? (openBlock(), createElementBlock("div", _hoisted_26, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(queryFields.value, (qr) => {
            return (openBlock(), createElementBlock("div", {
              class: "field",
              key: qr.dataName
            }, [
              createBaseVNode("label", {
                class: normalizeClass({ req: qr.isRequired })
              }, toDisplayString(qr.displayName || unref(tt)(qr.dataName)), 3),
              (qType(qr) === 'ref' && refModeMap[qr.dataName] === 'select')
                ? (openBlock(), createElementBlock("div", _hoisted_27, [
                    createVNode(_component_el_select, {
                      modelValue: condition[qr.dataName],
                      "onUpdate:modelValue": $event => ((condition[qr.dataName]) = $event),
                      clearable: "",
                      filterable: "",
                      remote: "",
                      "allow-create": "",
                      "default-first-option": "",
                      "remote-method": (kw) => loadRefSelectOptions(qr, qr.dataName, kw),
                      loading: refSelectData[qr.dataName]?.loading,
                      placeholder: qr.placeholder || unref(tt)('输入搜索'),
                      style: {"width":"100%"},
                      onChange: search,
                      onClear: search,
                      onFocus: $event => (checkRefMode(qr, qr.dataName))
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList((refSelectData[qr.dataName]?.options || []), (o) => {
                          return (openBlock(), createBlock(_component_el_option, {
                            key: o.value,
                            label: o.label,
                            value: o.value
                          }, null, 8, ["label", "value"]))
                        }), 128))
                      ]),
                      _: 2
                    }, 1032, ["modelValue", "onUpdate:modelValue", "remote-method", "loading", "placeholder", "onFocus"])
                  ]))
                : (qType(qr) === 'ref')
                  ? (openBlock(), createElementBlock("div", _hoisted_28, [
                      createVNode(_component_el_input, {
                        "model-value": condition[qr.dataName] || '',
                        readonly: "",
                        clearable: "",
                        placeholder: qr.placeholder || '请选择',
                        onClick: $event => (openQueryRef(qr, 'page')),
                        onClear: $event => (clearQueryRef(qr, 'page'))
                      }, null, 8, ["model-value", "placeholder", "onClick", "onClear"]),
                      createVNode(_component_el_button, {
                        icon: unref(search_default),
                        title: "打开参照",
                        onClick: $event => (openQueryRef(qr, 'page'))
                      }, null, 8, ["icon", "onClick"])
                    ]))
                  : (qType(qr) === 'select')
                    ? (openBlock(), createBlock(_component_el_select, {
                        key: 2,
                        modelValue: condition[qr.dataName],
                        "onUpdate:modelValue": $event => ((condition[qr.dataName]) = $event),
                        clearable: "",
                        filterable: "",
                        placeholder: qr.placeholder || '',
                        onChange: search
                      }, {
                        default: withCtx(() => [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(qOptions(qr), (o) => {
                            return (openBlock(), createBlock(_component_el_option, {
                              key: o.value,
                              label: o.label ?? o.value,
                              value: o.value
                            }, null, 8, ["label", "value"]))
                          }), 128))
                        ]),
                        _: 2
                      }, 1032, ["modelValue", "onUpdate:modelValue", "placeholder"]))
                    : (qType(qr) === 'date')
                      ? (openBlock(), createBlock(_component_el_date_picker, {
                          key: 3,
                          modelValue: condition[qr.dataName],
                          "onUpdate:modelValue": $event => ((condition[qr.dataName]) = $event),
                          type: "date",
                          "value-format": "YYYY-MM-DD",
                          placeholder: qr.placeholder || '选择日期',
                          onChange: search
                        }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]))
                      : (openBlock(), createBlock(_component_el_input, {
                          key: 4,
                          modelValue: condition[qr.dataName],
                          "onUpdate:modelValue": $event => ((condition[qr.dataName]) = $event),
                          placeholder: qr.placeholder || '',
                          onKeyup: withKeys(search, ["enter"]),
                          clearable: "",
                          onClear: search
                        }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]))
            ]))
          }), 128))
        ]))
      : (isApprovalDoc.value)
        ? (openBlock(), createElementBlock("div", _hoisted_29, [
            (panelCode.value === 'RD_PROGRESS')
              ? (openBlock(), createBlock(ProgressControlSheet, {
                  key: 0,
                  ref_key: "approvalSheetRef",
                  ref: approvalSheetRef,
                  head: cur.value,
                  fields: headerFields.value,
                  editable: draftEditable.value,
                  onDirty: markInlineDirty,
                  onOpenSheets: openDataSheets
                }, null, 8, ["head", "fields", "editable"]))
              : (panelCode.value === 'QC_CATALOG')
                ? (openBlock(), createBlock(QcCatalogSheet, {
                    key: 1,
                    ref_key: "approvalSheetRef",
                    ref: approvalSheetRef,
                    head: cur.value,
                    fields: sheetAllFields.value,
                    editable: draftEditable.value,
                    onDirty: markInlineDirty
                  }, null, 8, ["head", "fields", "editable"]))
                : (panelCode.value === 'QC_INSP_REC')
                  ? (openBlock(), createBlock(QcInspRecSheet, {
                      key: 2,
                      ref_key: "approvalSheetRef",
                      ref: approvalSheetRef,
                      head: cur.value,
                      fields: sheetAllFields.value,
                      editable: draftEditable.value,
                      onDirty: markInlineDirty,
                      onRefreshConfig: onFieldEditRefresh
                    }, null, 8, ["head", "fields", "editable"]))
                  : (panelCode.value === 'RD_PROD_DOCLIST')
                    ? (openBlock(), createBlock(ProdDocListSheet, {
                        key: 3,
                        ref_key: "approvalSheetRef",
                        ref: approvalSheetRef,
                        head: cur.value,
                        "panel-code": panelCode.value,
                        filter: prodDocFilter.value,
                        onRows: onProdDocRows,
                        onClearFilter: clearProdDocFilter
                      }, null, 8, ["head", "panel-code", "filter"]))
                    : (panelCode.value === 'RD_FILTER_EFF')
                      ? (openBlock(), createBlock(DataRecordSheet, {
                          key: 4,
                          ref_key: "approvalSheetRef",
                          ref: approvalSheetRef,
                          head: cur.value,
                          fields: sheetAllFields.value,
                          editable: draftEditable.value,
                          onDirty: markInlineDirty,
                          onRefreshConfig: onFieldEditRefresh
                        }, null, 8, ["head", "fields", "editable"]))
                      : (isRecordSheetPanel.value)
                        ? (openBlock(), createBlock(RecordSheetPanels, {
                            key: 5,
                            ref_key: "approvalSheetRef",
                            ref: approvalSheetRef,
                            head: cur.value,
                            fields: sheetAllFields.value,
                            editable: draftEditable.value,
                            "panel-code": panelCode.value,
                            "my-dept-rows": changeDeptRows.value,
                            "dept-lock-all": unref(user).isAdmin === true,
                            onDirty: markInlineDirty,
                            onRefreshConfig: onFieldEditRefresh
                          }, null, 8, ["head", "fields", "editable", "panel-code", "my-dept-rows", "dept-lock-all"]))
                        : (openBlock(), createBlock(DocSheet, {
                            key: 6,
                            ref_key: "approvalSheetRef",
                            ref: approvalSheetRef,
                            head: cur.value,
                            fields: headerFields.value,
                            editable: draftEditable.value,
                            config: docSheetConfig.value,
                            "panel-code": panelCode.value,
                            audited: curDocStatus.value === '已审核' || curDocStatus.value === '已归档',
                            user: { realName: unref(user).realName, isAdmin: unref(user).isAdmin, userName: unref(user).userName },
                            onDirty: markInlineDirty,
                            onTermChanged: onTermChanged
                          }, null, 8, ["head", "fields", "editable", "config", "panel-code", "audited", "user"])),
            createBaseVNode("div", {
              class: normalizeClass(["approval-side", { collapsed: sideCollapsed.value }])
            }, [
              createBaseVNode("div", {
                class: "as-side-title",
                onClick: _cache[8] || (_cache[8] = $event => (sideCollapsed.value = !sideCollapsed.value))
              }, [
                (!sideCollapsed.value)
                  ? (openBlock(), createElementBlock("span", _hoisted_30, toDisplayString(unref(tt)(panelName.value)), 1))
                  : createCommentVNode("", true),
                createBaseVNode("span", _hoisted_31, toDisplayString(sideCollapsed.value ? '◀' : '▶'), 1)
              ]),
              (!sideCollapsed.value)
                ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                    createBaseVNode("div", _hoisted_32, [
                      (cur.value['单据状态'])
                        ? (openBlock(), createElementBlock("span", {
                            key: 0,
                            class: normalizeClass(["doc-status", cur.value['单据状态']]),
                            title: cur.value['单据状态']
                          }, toDisplayString(unref(tt)(cur.value['单据状态'])), 11, _hoisted_33))
                        : (openBlock(), createElementBlock("span", _hoisted_34, "—"))
                    ]),
                    createBaseVNode("div", _hoisted_35, [
                      createBaseVNode("span", {
                        class: "page-btn",
                        title: unref(tt)('最前一张'),
                        onClick: pageFirst
                      }, "◁", 8, _hoisted_36),
                      createBaseVNode("span", {
                        class: "page-btn",
                        title: unref(tt)('上一张'),
                        onClick: _cache[9] || (_cache[9] = $event => (page(-1)))
                      }, "◀", 8, _hoisted_37),
                      createBaseVNode("span", _hoisted_38, toDisplayString(pageText(curNo.value, total.value, '')), 1),
                      createBaseVNode("span", {
                        class: "page-btn",
                        title: unref(tt)('下一张'),
                        onClick: _cache[10] || (_cache[10] = $event => (page(1)))
                      }, "▶", 8, _hoisted_39),
                      createBaseVNode("span", {
                        class: "page-btn",
                        title: unref(tt)('最后一张'),
                        onClick: pageLast
                      }, "▷", 8, _hoisted_40)
                    ]),
                    (fuzzyMode.value)
                      ? (openBlock(), createElementBlock("div", _hoisted_41, [
                          createBaseVNode("div", _hoisted_42, [
                            createBaseVNode("span", null, toDisplayString(unref(tt)('模糊搜索')), 1),
                            createBaseVNode("span", {
                              class: "fuzzy-back",
                              title: unref(tt)('返回'),
                              onClick: closeFuzzy
                            }, "↩", 8, _hoisted_43)
                          ]),
                          (openBlock(true), createElementBlock(Fragment, null, renderList(fuzzyRows.value, (row, fi) => {
                            return (openBlock(), createElementBlock("div", {
                              key: 'fz' + fi,
                              class: "fuzzy-row"
                            }, [
                              createVNode(_component_el_select, {
                                modelValue: row.field,
                                "onUpdate:modelValue": $event => ((row.field) = $event),
                                size: "small",
                                filterable: "",
                                placeholder: unref(tt)('字段'),
                                class: "fuzzy-field"
                              }, {
                                default: withCtx(() => [
                                  (openBlock(true), createElementBlock(Fragment, null, renderList(fuzzyFieldGroups.value, (g) => {
                                    return (openBlock(), createBlock(_component_el_option_group, {
                                      key: g.label,
                                      label: g.label
                                    }, {
                                      default: withCtx(() => [
                                        (openBlock(true), createElementBlock(Fragment, null, renderList(g.options, (o) => {
                                          return (openBlock(), createBlock(_component_el_option, {
                                            key: o.value,
                                            label: o.label,
                                            value: o.value
                                          }, null, 8, ["label", "value"]))
                                        }), 128))
                                      ]),
                                      _: 2
                                    }, 1032, ["label"]))
                                  }), 128))
                                ]),
                                _: 1
                              }, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]),
                              createVNode(_component_el_input, {
                                modelValue: row.value,
                                "onUpdate:modelValue": $event => ((row.value) = $event),
                                size: "small",
                                class: "fuzzy-value",
                                placeholder: unref(tt)('内容'),
                                onKeyup: withKeys(runFuzzySearch, ["enter"])
                              }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]),
                              createBaseVNode("span", {
                                class: "fuzzy-del",
                                title: unref(tt)('删除该条件'),
                                onClick: $event => (removeFuzzyRow(fi))
                              }, "×", 8, _hoisted_44)
                            ]))
                          }), 128)),
                          createBaseVNode("div", _hoisted_45, [
                            createBaseVNode("span", {
                              class: "as-side-btn",
                              onClick: addFuzzyRow
                            }, toDisplayString(unref(tt)('添加条件')), 1),
                            createBaseVNode("span", {
                              class: "as-side-btn primary",
                              onClick: runFuzzySearch
                            }, toDisplayString(unref(tt)('查找')), 1)
                          ]),
                          (fuzzySearched.value)
                            ? (openBlock(), createElementBlock("div", _hoisted_46, [
                                createBaseVNode("div", _hoisted_47, [
                                  createTextVNode(toDisplayString(unref(tt)('结果')) + "： ", 1),
                                  (isProdDocMatrix.value)
                                    ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                        createTextVNode(toDisplayString(prodDocFilteredRows.value.length) + " " + toDisplayString(unref(tt)('个产品')), 1)
                                      ], 64))
                                    : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                        createTextVNode(toDisplayString(total.value) + " " + toDisplayString(unref(tt)('张')), 1),
                                        (total.value > (list.value.length || 0))
                                          ? (openBlock(), createElementBlock("span", _hoisted_48, toDisplayString(unref(tt)('（清单仅显示前 {m} 张）').replace('{m}', String(list.value.length))), 1))
                                          : createCommentVNode("", true)
                                      ], 64))
                                ]),
                                (openBlock(true), createElementBlock(Fragment, null, renderList(fuzzyResultRows.value, (r) => {
                                  return (openBlock(), createElementBlock("div", {
                                    key: r.no,
                                    class: normalizeClass(["fuzzy-result-row", { on: !isProdDocMatrix.value && r.no === curDocNo.value }]),
                                    onClick: $event => (openFuzzyResult(r))
                                  }, [
                                    createBaseVNode("span", _hoisted_50, toDisplayString(r.no), 1),
                                    createBaseVNode("span", _hoisted_51, toDisplayString(r.date) + " " + toDisplayString(isProdDocMatrix.value ? r.status : unref(tt)(r.status)), 1)
                                  ], 10, _hoisted_49))
                                }), 128)),
                                (!fuzzyResultRows.value.length)
                                  ? (openBlock(), createElementBlock("div", _hoisted_52, toDisplayString(unref(tt)(isProdDocMatrix.value ? '未找到匹配的产品' : '未找到匹配单据')), 1))
                                  : createCommentVNode("", true)
                              ]))
                            : createCommentVNode("", true)
                        ]))
                      : (previewMode.value)
                        ? (openBlock(), createElementBlock("div", _hoisted_53, [
                            createBaseVNode("div", _hoisted_54, [
                              createBaseVNode("span", null, toDisplayString(unref(tt)(isProdDocMatrix.value ? '产品预览查找' : '单据预览查找')), 1),
                              createBaseVNode("span", {
                                class: "fuzzy-back",
                                title: unref(tt)('返回'),
                                onClick: closeDocPreview
                              }, "↩", 8, _hoisted_55)
                            ]),
                            createVNode(_component_el_input, {
                              modelValue: previewKw.value,
                              "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((previewKw).value = $event)),
                              size: "small",
                              clearable: "",
                              placeholder: unref(tt)(isProdDocMatrix.value ? '输入产品编号或文件状态快速筛选' : '输入编号或任意内容快速筛选'),
                              class: "preview-kw"
                            }, null, 8, ["modelValue", "placeholder"]),
                            createBaseVNode("div", _hoisted_56, [
                              (openBlock(true), createElementBlock(Fragment, null, renderList(previewCards.value, (c) => {
                                return (openBlock(), createElementBlock("div", {
                                  key: c.no,
                                  class: normalizeClass(["preview-card", { on: !isProdDocMatrix.value && c.no === curDocNo.value }]),
                                  onClick: $event => (openPreviewCard(c))
                                }, [
                                  createBaseVNode("div", _hoisted_58, [
                                    createBaseVNode("span", _hoisted_59, toDisplayString(c.no), 1),
                                    (c.status)
                                      ? (openBlock(), createElementBlock("span", {
                                          key: 0,
                                          class: normalizeClass(["doc-status", c.status])
                                        }, toDisplayString(unref(tt)(c.status)), 3))
                                      : createCommentVNode("", true)
                                  ]),
                                  createBaseVNode("div", _hoisted_60, toDisplayString(c.date), 1),
                                  (openBlock(true), createElementBlock(Fragment, null, renderList(c.fields, (f, i) => {
                                    return (openBlock(), createElementBlock("div", {
                                      key: i,
                                      class: "pc-field"
                                    }, [
                                      createBaseVNode("span", _hoisted_61, toDisplayString(unref(tt)(f.label)), 1),
                                      createBaseVNode("span", _hoisted_62, toDisplayString(f.value), 1)
                                    ]))
                                  }), 128)),
                                  (!c.fields.length)
                                    ? (openBlock(), createElementBlock("div", _hoisted_63, toDisplayString(unref(tt)('（无摘要字段）')), 1))
                                    : createCommentVNode("", true)
                                ], 10, _hoisted_57))
                              }), 128)),
                              (!previewCards.value.length)
                                ? (openBlock(), createElementBlock("div", _hoisted_64, toDisplayString(unref(tt)(isProdDocMatrix.value ? '未找到匹配的产品' : '未找到匹配单据')), 1))
                                : createCommentVNode("", true)
                            ])
                          ]))
                        : (openBlock(), createElementBlock("div", _hoisted_65, [
                            createBaseVNode("div", _hoisted_66, toDisplayString(unref(tt)('查找')), 1),
                            createBaseVNode("div", {
                              class: "as-side-btn",
                              onClick: _cache[12] || (_cache[12] = $event => (docQueryVisible.value = true))
                            }, toDisplayString(unref(tt)(isProdDocMatrix.value ? '查询产品' : '查询单据')), 1),
                            createBaseVNode("div", {
                              class: "as-side-btn",
                              onClick: openFuzzy
                            }, toDisplayString(unref(tt)('模糊搜索')), 1),
                            createBaseVNode("div", {
                              class: "as-side-btn",
                              onClick: openDocPreview
                            }, toDisplayString(unref(tt)(isProdDocMatrix.value ? '产品预览' : '单据预览')), 1),
                            createBaseVNode("div", _hoisted_67, toDisplayString(unref(tt)('单据操作')), 1),
                            (isApprovalDoc.value)
                              ? (openBlock(), createElementBlock("div", _hoisted_68, [
                                  createBaseVNode("div", _hoisted_69, [
                                    createBaseVNode("div", {
                                      class: "as-side-btn",
                                      style: {"flex":"1"},
                                      onClick: _cache[13] || (_cache[13] = $event => (onSideAction('删除')))
                                    }, toDisplayString(unref(tt)('删除')), 1),
                                    createBaseVNode("div", {
                                      class: "as-side-caret",
                                      title: unref(tt)('更多操作'),
                                      onClick: _cache[14] || (_cache[14] = withModifiers($event => (openDelMenu.value = !openDelMenu.value), ["stop"]))
                                    }, "▼", 8, _hoisted_70)
                                  ]),
                                  (curDocStatus.value === '删除申请中')
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 0,
                                        class: "as-side-btn",
                                        onClick: _cache[15] || (_cache[15] = $event => (pickDelAction('撤回删除申请')))
                                      }, toDisplayString(unref(tt)('撤回删除申请')), 1))
                                    : createCommentVNode("", true),
                                  (openDelMenu.value)
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 1,
                                        class: "as-side-menu",
                                        onClick: _cache[19] || (_cache[19] = withModifiers(() => {}, ["stop"]))
                                      }, [
                                        createBaseVNode("div", {
                                          class: "as-side-menu-item danger",
                                          onClick: _cache[16] || (_cache[16] = $event => (pickDelAction('删除')))
                                        }, toDisplayString(unref(tt)('删除')) + "（" + toDisplayString(unref(tt)('整单删除')) + "）", 1),
                                        (canApproveHere())
                                          ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                              createBaseVNode("div", {
                                                class: "as-side-menu-item danger",
                                                onClick: _cache[17] || (_cache[17] = $event => (pickDelAction('删除审批通过')))
                                              }, toDisplayString(unref(tt)('删除审批通过')), 1),
                                              createBaseVNode("div", {
                                                class: "as-side-menu-item danger",
                                                onClick: _cache[18] || (_cache[18] = $event => (pickDelAction('删除审批驳回')))
                                              }, toDisplayString(unref(tt)('删除审批驳回')), 1)
                                            ], 64))
                                          : createCommentVNode("", true)
                                      ]))
                                    : createCommentVNode("", true)
                                ]))
                              : createCommentVNode("", true),
                            (devFileGate.value?.applicable && devFileGate.value.canEdit === false)
                              ? (openBlock(), createElementBlock("div", _hoisted_71, [
                                  (devFileGate.value.ownerName)
                                    ? (openBlock(), createElementBlock("div", _hoisted_72, toDisplayString(unref(tt)('本文件责任人')) + "：" + toDisplayString(devFileGate.value.ownerName) + "（" + toDisplayString(unref(tt)('只读')) + "）", 1))
                                    : (openBlock(), createElementBlock("div", _hoisted_73, toDisplayString(unref(tt)('尚未分发责任人')) + "：" + toDisplayString(unref(tt)('请先在产品信息表点「分发责任人」')), 1))
                                ]))
                              : createCommentVNode("", true),
                            (panelCode.value === 'RD_SPEC_DOC' && specDocAssign.value?.hasAssign)
                              ? (openBlock(), createElementBlock("div", _hoisted_74, [
                                  createBaseVNode("div", null, [
                                    createTextVNode(toDisplayString(unref(tt)('责任人')) + "：" + toDisplayString(specDocAssign.value.ownerName || specDocAssign.value.owner), 1),
                                    (specAssignBlocked.value)
                                      ? (openBlock(), createElementBlock("span", _hoisted_75, "（" + toDisplayString(unref(tt)('只读')) + "）", 1))
                                      : createCommentVNode("", true)
                                  ]),
                                  createBaseVNode("div", null, toDisplayString(unref(tt)('总负责人')) + "：" + toDisplayString(specDocAssign.value.supervisorName || specDocAssign.value.supervisor || unref(tt)('未落实')), 1)
                                ]))
                              : createCommentVNode("", true),
                            (hasApprovalBtns.value)
                              ? (openBlock(), createElementBlock(Fragment, { key: 3 }, [
                                  createBaseVNode("div", {
                                    class: normalizeClass(["as-side-btn", { disabled: isDisabled('提交审批') }]),
                                    onClick: _cache[20] || (_cache[20] = $event => (onSideAction('提交审批')))
                                  }, toDisplayString(unref(tt)('提交审批')), 3),
                                  (isQcL2Panel.value)
                                    ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                        (canApproveQcL2Here.value)
                                          ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                              createBaseVNode("div", {
                                                class: normalizeClass(["as-side-btn", { disabled: isDisabled('审批通过') }]),
                                                onClick: _cache[21] || (_cache[21] = $event => (onSideAction('审批通过')))
                                              }, toDisplayString(qcL2ApproveLabel()), 3),
                                              createBaseVNode("div", {
                                                class: normalizeClass(["as-side-btn", { disabled: isDisabled('审批驳回') }]),
                                                onClick: _cache[22] || (_cache[22] = $event => (onSideAction('审批驳回')))
                                              }, toDisplayString(qcL2RejectLabel()), 3)
                                            ], 64))
                                          : createCommentVNode("", true),
                                        (canApproveHere())
                                          ? (openBlock(), createElementBlock("div", {
                                              key: 1,
                                              class: normalizeClass(["as-side-btn", { disabled: isDisabled('弃审') }]),
                                              onClick: _cache[23] || (_cache[23] = $event => (onSideAction('弃审')))
                                            }, toDisplayString(unref(tt)('弃审')), 3))
                                          : createCommentVNode("", true)
                                      ], 64))
                                    : (canApproveHere())
                                      ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                          createBaseVNode("div", {
                                            class: normalizeClass(["as-side-btn", { disabled: isDisabled('审批通过') }]),
                                            onClick: _cache[24] || (_cache[24] = $event => (onSideAction('审批通过')))
                                          }, toDisplayString(unref(tt)('审批通过')), 3),
                                          createBaseVNode("div", {
                                            class: normalizeClass(["as-side-btn", { disabled: isDisabled('审批驳回') }]),
                                            onClick: _cache[25] || (_cache[25] = $event => (onSideAction('审批驳回')))
                                          }, toDisplayString(unref(tt)('审批驳回')), 3),
                                          createBaseVNode("div", {
                                            class: normalizeClass(["as-side-btn", { disabled: isDisabled('弃审') }]),
                                            onClick: _cache[26] || (_cache[26] = $event => (onSideAction('弃审')))
                                          }, toDisplayString(unref(tt)('弃审')), 3)
                                        ], 64))
                                      : createCommentVNode("", true),
                                  createBaseVNode("div", {
                                    class: "as-side-btn",
                                    onClick: _cache[27] || (_cache[27] = $event => (onSideAction('审批情况')))
                                  }, toDisplayString(unref(tt)('审批情况')), 1)
                                ], 64))
                              : createCommentVNode("", true),
                            (isChangePanel.value)
                              ? (openBlock(), createElementBlock(Fragment, { key: 4 }, [
                                  (['草稿', '修改中'].includes(curDocStatus.value) && cur.value['需会签'] === '是' && isChangeInitiator.value)
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 0,
                                        class: "as-side-btn",
                                        onClick: _cache[28] || (_cache[28] = $event => (onSideAction('提交会签')))
                                      }, toDisplayString(unref(tt)('提交会签')), 1))
                                    : createCommentVNode("", true),
                                  (curDocStatus.value === '会签中')
                                    ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                        (iAmChangeSigner.value)
                                          ? (openBlock(), createElementBlock("div", {
                                              key: 0,
                                              class: "as-side-btn",
                                              onClick: _cache[29] || (_cache[29] = $event => (onSideAction('会签通过')))
                                            }, toDisplayString(unref(tt)('会签通过')), 1))
                                          : createCommentVNode("", true),
                                        (iAmChangeSigner.value)
                                          ? (openBlock(), createElementBlock("div", {
                                              key: 1,
                                              class: "as-side-btn",
                                              onClick: _cache[30] || (_cache[30] = $event => (onSideAction('会签驳回')))
                                            }, toDisplayString(unref(tt)('会签驳回')), 1))
                                          : createCommentVNode("", true),
                                        (isChangeInitiator.value)
                                          ? (openBlock(), createElementBlock("div", {
                                              key: 2,
                                              class: "as-side-btn",
                                              onClick: _cache[31] || (_cache[31] = $event => (onSideAction('撤回会签')))
                                            }, toDisplayString(unref(tt)('撤回会签')), 1))
                                          : createCommentVNode("", true)
                                      ], 64))
                                    : createCommentVNode("", true),
                                  (['草稿', '修改中'].includes(curDocStatus.value) && cur.value['需会签'] !== '是' && isChangeInitiator.value)
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 2,
                                        class: "as-side-btn",
                                        onClick: _cache[32] || (_cache[32] = $event => (onSideAction('提交审批')))
                                      }, toDisplayString(unref(tt)('提交审批')), 1))
                                    : createCommentVNode("", true),
                                  (IN_APPROVAL.includes(curDocStatus.value) && canApproveHere())
                                    ? (openBlock(), createElementBlock(Fragment, { key: 3 }, [
                                        createBaseVNode("div", {
                                          class: "as-side-btn",
                                          onClick: _cache[33] || (_cache[33] = $event => (onSideAction('审批通过')))
                                        }, toDisplayString(unref(tt)('审批通过')), 1),
                                        createBaseVNode("div", {
                                          class: "as-side-btn",
                                          onClick: _cache[34] || (_cache[34] = $event => (onSideAction('审批驳回')))
                                        }, toDisplayString(unref(tt)('审批驳回')), 1)
                                      ], 64))
                                    : createCommentVNode("", true),
                                  createBaseVNode("div", {
                                    class: "as-side-btn",
                                    onClick: _cache[35] || (_cache[35] = $event => (onSideAction('审批情况')))
                                  }, toDisplayString(unref(tt)('审批情况')), 1)
                                ], 64))
                              : createCommentVNode("", true),
                            (isDocArchivePanel.value)
                              ? (openBlock(), createElementBlock("div", _hoisted_76, [
                                  createBaseVNode("div", _hoisted_77, [
                                    createBaseVNode("div", {
                                      class: normalizeClass(["as-side-btn", { disabled: !canModifyReq.value }]),
                                      style: {"flex":"1"},
                                      onClick: _cache[36] || (_cache[36] = $event => (pickModAction('申请修改')))
                                    }, toDisplayString(unref(tt)('申请修改')), 3),
                                    createBaseVNode("div", {
                                      class: "as-side-caret",
                                      title: unref(tt)('更多操作'),
                                      onClick: _cache[37] || (_cache[37] = withModifiers($event => (openModMenu.value = !openModMenu.value), ["stop"]))
                                    }, "▼", 8, _hoisted_78)
                                  ]),
                                  (curDocStatus.value === '修改中')
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 0,
                                        class: "as-side-btn",
                                        onClick: _cache[38] || (_cache[38] = $event => (pickModAction('提交审批')))
                                      }, toDisplayString(unref(tt)('提交审批')), 1))
                                    : createCommentVNode("", true),
                                  (curDocStatus.value === '修改申请中')
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 1,
                                        class: "as-side-btn",
                                        onClick: _cache[39] || (_cache[39] = $event => (pickModAction('撤回修改申请')))
                                      }, toDisplayString(unref(tt)('撤回修改申请')), 1))
                                    : createCommentVNode("", true),
                                  (openModMenu.value)
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 2,
                                        class: "as-side-menu flip-up",
                                        onClick: _cache[45] || (_cache[45] = withModifiers(() => {}, ["stop"]))
                                      }, [
                                        (canApproveHere() || l2ApproverNow.value)
                                          ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                              (curDocStatus.value === '修改申请中')
                                                ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                                    createBaseVNode("div", {
                                                      class: "as-side-menu-item",
                                                      onClick: _cache[40] || (_cache[40] = $event => (pickModAction('修改审批通过')))
                                                    }, toDisplayString(unref(tt)('修改审批通过')), 1),
                                                    createBaseVNode("div", {
                                                      class: "as-side-menu-item",
                                                      onClick: _cache[41] || (_cache[41] = $event => (pickModAction('修改审批驳回')))
                                                    }, toDisplayString(unref(tt)('修改审批驳回')), 1)
                                                  ], 64))
                                                : (IN_APPROVAL.includes(curDocStatus.value) && (curDocStatus.value === '待二级审批' ? l2ApproverNow.value : canApproveHere()))
                                                  ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                                      createBaseVNode("div", {
                                                        class: "as-side-menu-item",
                                                        onClick: _cache[42] || (_cache[42] = $event => (pickModAction('审批通过')))
                                                      }, toDisplayString(unref(tt)('审批通过')), 1),
                                                      createBaseVNode("div", {
                                                        class: "as-side-menu-item",
                                                        onClick: _cache[43] || (_cache[43] = $event => (pickModAction('审批驳回')))
                                                      }, toDisplayString(unref(tt)('审批驳回')), 1)
                                                    ], 64))
                                                  : createCommentVNode("", true)
                                            ], 64))
                                          : createCommentVNode("", true),
                                        createBaseVNode("div", {
                                          class: "as-side-menu-item",
                                          onClick: _cache[44] || (_cache[44] = $event => (pickModAction('审批情况')))
                                        }, toDisplayString(unref(tt)('审批情况')), 1)
                                      ]))
                                    : createCommentVNode("", true)
                                ]))
                              : createCommentVNode("", true),
                            (isModLogPanel.value)
                              ? (openBlock(), createElementBlock("div", {
                                  key: 6,
                                  class: "as-side-btn",
                                  onClick: openModifyLog
                                }, toDisplayString(unref(tt)('修改记录')), 1))
                              : createCommentVNode("", true),
                            createBaseVNode("div", _hoisted_79, toDisplayString(unref(tt)('文档输出')), 1),
                            (isApprovalDoc.value)
                              ? (openBlock(), createElementBlock("div", {
                                  key: 7,
                                  class: "as-side-btn",
                                  onClick: printApprovalSheet
                                }, toDisplayString(unref(tt)('打印')), 1))
                              : createCommentVNode("", true),
                            (reportTemplates.value.length || unref(user).isAdmin)
                              ? (openBlock(), createElementBlock("div", {
                                  key: 8,
                                  class: "as-side-btn",
                                  onClick: _cache[46] || (_cache[46] = $event => (reportVisible.value = true))
                                }, toDisplayString(unref(tt)('导出报表')), 1))
                              : createCommentVNode("", true),
                            (panelCode.value === 'RD_APPROVAL')
                              ? (openBlock(), createElementBlock("div", {
                                  key: 9,
                                  class: normalizeClass(["as-side-btn", { disabled: !canGradeProject.value }]),
                                  title: canGradeProject.value ? unref(tt)('给该项目定级(一/二/三/四级)')
                  : (['已审核', '已归档'].includes(curDocStatus.value) ? unref(tt)('仅审批人（或管理员）可项目定级') : unref(tt)('仅已审核或已归档的立项申请可项目定级')),
                                  onClick: openGrade
                                }, toDisplayString(unref(tt)('项目定级')) + toDisplayString(cur.value && cur.value['项目等级'] ? '·' + cur.value['项目等级'] : ''), 11, _hoisted_80))
                              : createCommentVNode("", true),
                            (panelCode.value === 'RD_PROD_INFO')
                              ? (openBlock(), createElementBlock("div", {
                                  key: 10,
                                  class: normalizeClass(["as-side-btn", { disabled: !canDevDispatch.value || devDispatch.busy }]),
                                  title: devDispatch.dispatched ? unref(tt)('重新分发/调整四个文件的责任人')
                  : (canDevDispatch.value ? unref(tt)('把四个下游文件各自分给责任人')
                    : (curDocStatus.value === '已归档' ? unref(tt)('仅二级审核人或管理员可分发责任人') : unref(tt)('仅已归档的产品信息表可分发责任人'))),
                                  onClick: onDevDispatch
                                }, toDisplayString(devDispatch.dispatched ? unref(tt)('改责任人') : unref(tt)('分发责任人')), 11, _hoisted_81))
                              : createCommentVNode("", true),
                            (panelCode.value === 'RD_PROD_INFO' && devDispatch.dispatched)
                              ? (openBlock(), createElementBlock("div", {
                                  key: 11,
                                  class: normalizeClass(["as-side-btn", { disabled: !canSpecDispatch.value }]),
                                  title: canSpecDispatch.value ? unref(tt)('把该产品的规格书单据分发给责任人填写')
                  : (devDispatch.supervisorResolved ? unref(tt)('仅总负责人或管理员可分发规格书') : unref(tt)('产品信息表「责任人」未匹配到启用账号，任务挂起')),
                                  onClick: openSpecAssign
                                }, toDisplayString(unref(tt)('规格书分发')), 11, _hoisted_82))
                              : createCommentVNode("", true),
                            (openBlock(true), createElementBlock(Fragment, null, renderList(approvalSideGroups.value, (g, gi) => {
                              return (openBlock(), createElementBlock(Fragment, {
                                key: 'sg' + gi
                              }, [
                                createBaseVNode("div", {
                                  class: normalizeClass(["as-side-btn", { disabled: isDisabled(btnName(g)) }]),
                                  onClick: $event => (onSideAction(btnName(g)))
                                }, toDisplayString(unref(tt)(btnName(g))), 11, _hoisted_83),
                                (openBlock(true), createElementBlock(Fragment, null, renderList(dropItems(g), (a) => {
                                  return (openBlock(), createElementBlock("div", {
                                    key: a,
                                    class: normalizeClass(["as-side-btn sub", { disabled: isDisabled(a) }]),
                                    onClick: $event => (onSideAction(a))
                                  }, toDisplayString(unref(tt)(a)), 11, _hoisted_84))
                                }), 128))
                              ], 64))
                            }), 128))
                          ]))
                  ], 64))
                : createCommentVNode("", true)
            ], 2)
          ]))
        : createCommentVNode("", true),
    (reportMode.value)
      ? withDirectives((openBlock(), createElementBlock("div", _hoisted_85, [
          createBaseVNode("div", _hoisted_86, [
            createBaseVNode("strong", null, toDisplayString(panelName.value), 1),
            createBaseVNode("span", null, toDisplayString(reportPeriod.value), 1)
          ]),
          createVNode(_component_el_table, {
            class: "report-table",
            data: unref(reportList),
            border: "",
            stripe: "",
            size: "small",
            height: "100%",
            "show-summary": "",
            "summary-method": sumMethod,
            "empty-text": "暂无符合条件的数据",
            onRowClick: _cache[49] || (_cache[49] = (row) => (current.value = row))
          }, {
            default: withCtx(() => [
              createVNode(_component_el_table_column, {
                type: "index",
                label: unref(tt)('序号'),
                width: "58",
                fixed: "left",
                index: (i) => (query.pageNo - 1) * query.pageSize + i + 1
              }, null, 8, ["label", "index"]),
              (openBlock(true), createElementBlock(Fragment, null, renderList(reportColumnTree.value, (column) => {
                return (openBlock(), createElementBlock(Fragment, {
                  key: column.label
                }, [
                  (column.children)
                    ? (openBlock(), createBlock(_component_el_table_column, {
                        key: 0,
                        label: unref(tt)(column.label),
                        align: "center"
                      }, {
                        default: withCtx(() => [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(column.children, (child) => {
                            return (openBlock(), createBlock(_component_el_table_column, {
                              key: child.prop,
                              prop: child.prop,
                              "min-width": child.width,
                              align: child.align,
                              "show-overflow-tooltip": ""
                            }, {
                              header: withCtx(() => [
                                createBaseVNode("div", _hoisted_87, [
                                  createBaseVNode("span", _hoisted_88, toDisplayString(unref(tt)(child.label)), 1),
                                  createBaseVNode("span", {
                                    class: normalizeClass(["report-col-operator", { 'has-sort': reportSortOn(child.prop) }])
                                  }, [
                                    createBaseVNode("span", {
                                      class: normalizeClass(["report-col-sorter", {on: reportSortOn(child.prop)}]),
                                      title: unref(tt)('点击排序：升序 → 降序 → 取消'),
                                      onClick: withModifiers($event => (cycleReportSort(child.prop)), ["stop"])
                                    }, toDisplayString(reportSortCaret(child.prop)), 11, _hoisted_89),
                                    (hasDistinctValues(child.prop))
                                      ? (openBlock(), createElementBlock("span", {
                                          key: 0,
                                          class: normalizeClass(["report-col-filter", {on: unref(reportCols).isFiltered(child.prop)}]),
                                          onClick: withModifiers($event => (openFilterAt(child.prop, $event)), ["stop"])
                                        }, [
                                          createVNode(_component_el_icon, null, {
                                            default: withCtx(() => [
                                              createVNode(unref(filter_default))
                                            ]),
                                            _: 1
                                          })
                                        ], 10, _hoisted_90))
                                      : createCommentVNode("", true)
                                  ], 2)
                                ])
                              ]),
                              _: 2
                            }, 1032, ["prop", "min-width", "align"]))
                          }), 128))
                        ]),
                        _: 2
                      }, 1032, ["label"]))
                    : (openBlock(), createBlock(_component_el_table_column, {
                        key: 1,
                        prop: column.prop,
                        "min-width": column.width,
                        align: column.align,
                        "show-overflow-tooltip": ""
                      }, {
                        default: withCtx(({ row }) => [
                          (isStockStatus.value && column.prop === '预警数量')
                            ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                (warnEdit.id === row.id)
                                  ? (openBlock(), createBlock(_component_el_input_number, {
                                      key: 0,
                                      ref_for: true,
                                      ref_key: "warnEditRef",
                                      ref: warnEditRef,
                                      modelValue: warnEdit.value,
                                      "onUpdate:modelValue": _cache[47] || (_cache[47] = $event => ((warnEdit.value) = $event)),
                                      controls: false,
                                      min: 0,
                                      precision: 0,
                                      size: "small",
                                      class: "warn-input",
                                      onKeyup: [
                                        withKeys(saveWarnEdit, ["enter"]),
                                        _cache[48] || (_cache[48] = withKeys($event => (warnEdit.id = null), ["esc"]))
                                      ],
                                      onBlur: saveWarnEdit
                                    }, null, 8, ["modelValue"]))
                                  : (openBlock(), createElementBlock("span", {
                                      key: 1,
                                      class: "warn-editable",
                                      title: unref(tt)('点击修改预警数量，留空使用默认阈值50'),
                                      onClick: $event => (startWarnEdit(row))
                                    }, toDisplayString(row['预警数量'] == null || row['预警数量'] === '' ? '—' : row['预警数量']), 9, _hoisted_91))
                              ], 64))
                            : (openBlock(), createElementBlock("span", _hoisted_92, toDisplayString(row[column.prop]), 1))
                        ]),
                        header: withCtx(() => [
                          createBaseVNode("div", _hoisted_93, [
                            createBaseVNode("span", _hoisted_94, toDisplayString(unref(tt)(column.label)), 1),
                            createBaseVNode("span", {
                              class: normalizeClass(["report-col-operator", { 'has-sort': reportSortOn(column.prop) }])
                            }, [
                              createBaseVNode("span", {
                                class: normalizeClass(["report-col-sorter", {on: reportSortOn(column.prop)}]),
                                title: unref(tt)('点击排序：升序 → 降序 → 取消'),
                                onClick: withModifiers($event => (cycleReportSort(column.prop)), ["stop"])
                              }, toDisplayString(reportSortCaret(column.prop)), 11, _hoisted_95),
                              (hasDistinctValues(column.prop))
                                ? (openBlock(), createElementBlock("span", {
                                    key: 0,
                                    class: normalizeClass(["report-col-filter", {on: unref(reportCols).isFiltered(column.prop)}]),
                                    onClick: withModifiers($event => (openFilterAt(column.prop, $event)), ["stop"])
                                  }, [
                                    createVNode(_component_el_icon, null, {
                                      default: withCtx(() => [
                                        createVNode(unref(filter_default))
                                      ]),
                                      _: 1
                                    })
                                  ], 10, _hoisted_96))
                                : createCommentVNode("", true)
                            ], 2)
                          ])
                        ]),
                        _: 2
                      }, 1032, ["prop", "min-width", "align"]))
                ], 64))
              }), 128))
            ]),
            _: 1
          }, 8, ["data"])
        ])), [
          [_directive_loading, loading.value]
        ])
      : (!isApprovalDoc.value && !isQcInspReq.value)
        ? (openBlock(), createElementBlock("div", {
            key: 4,
            class: normalizeClass(["doc-rail-layout", { 'rail-on': !!docRailCfg.value && !railCollapsed.value }])
          }, [
            (docRailCfg.value)
              ? (openBlock(), createBlock(DocSelectRail, {
                  key: 0,
                  title: docRailCfg.value.title,
                  columns: docRailCfg.value.columns,
                  rows: list.value,
                  "current-no": railCurNo.value,
                  collapsed: railCollapsed.value,
                  total: total.value,
                  "page-no": query.pageNo,
                  "page-size": query.pageSize,
                  keyword: query.keyword,
                  onSelect: onRailSelect,
                  onToggle: _cache[50] || (_cache[50] = $event => (railCollapsed.value = !railCollapsed.value)),
                  onPage: onRailPage,
                  onSearch: onRailSearch
                }, null, 8, ["title", "columns", "rows", "current-no", "collapsed", "total", "page-no", "page-size", "keyword"]))
              : createCommentVNode("", true),
            createBaseVNode("div", _hoisted_97, [
              createBaseVNode("div", {
                class: normalizeClass(["fields header-fields udl-fields", { 'is-draft': draftEditable.value }])
              }, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(headerEditFields.value, (field) => {
                  return (openBlock(), createElementBlock("div", {
                    class: "field",
                    key: headerFieldKey(field)
                  }, [
                    createBaseVNode("label", {
                      class: normalizeClass({ req: field.isRequired })
                    }, [
                      createTextVNode(toDisplayString(headerFieldLabel(field)), 1),
                      (printBatchLockReason(field))
                        ? (openBlock(), createElementBlock("span", {
                            key: 0,
                            class: "field-lock-badge",
                            title: printBatchLockReason(field)
                          }, toDisplayString(unref(tt)('已按材料码批次号锁定')), 9, _hoisted_98))
                        : createCommentVNode("", true)
                    ], 2),
                    (draftEditable.value)
                      ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                          (isRefSelect(field))
                            ? (openBlock(), createElementBlock("div", _hoisted_99, [
                                createVNode(_component_el_select, {
                                  modelValue: cur.value[headerFieldKey(field)],
                                  "onUpdate:modelValue": $event => ((cur.value[headerFieldKey(field)]) = $event),
                                  clearable: "",
                                  filterable: "",
                                  remote: "",
                                  "allow-create": "",
                                  "default-first-option": "",
                                  disabled: headerFieldLocked(field),
                                  onChange: (v) => onHeaderRefSelectChange(field, v),
                                  "remote-method": (kw) => loadRefSelectOptions(field, headerFieldKey(field), kw),
                                  loading: refSelectData[headerFieldKey(field)]?.loading,
                                  placeholder: unref(tt)('输入搜索'),
                                  style: {"width":"100%"},
                                  onFocus: $event => (checkRefMode(field, headerFieldKey(field)))
                                }, {
                                  default: withCtx(() => [
                                    (openBlock(true), createElementBlock(Fragment, null, renderList((refSelectData[headerFieldKey(field)]?.options || []), (o) => {
                                      return (openBlock(), createBlock(_component_el_option, {
                                        key: o.value,
                                        label: unref(refShowsCode)(field) ? o.value : o.label,
                                        value: o.value
                                      }, null, 8, ["label", "value"]))
                                    }), 128))
                                  ]),
                                  _: 2
                                }, 1032, ["modelValue", "onUpdate:modelValue", "disabled", "onChange", "remote-method", "loading", "placeholder", "onFocus"])
                              ]))
                            : (isReferenceField(field))
                              ? (openBlock(), createElementBlock("div", _hoisted_100, [
                                  createVNode(_component_el_input, {
                                    "model-value": headerRefText(field),
                                    readonly: "",
                                    disabled: headerFieldLocked(field),
                                    placeholder: "请选择",
                                    onClick: $event => (openHeaderRef(field))
                                  }, null, 8, ["model-value", "disabled", "onClick"]),
                                  createVNode(_component_el_button, {
                                    icon: unref(search_default),
                                    title: "打开参照",
                                    disabled: headerFieldLocked(field),
                                    onClick: $event => (openHeaderRef(field))
                                  }, null, 8, ["icon", "disabled", "onClick"])
                                ]))
                              : (isSelectField(field) && dictModeOf(field, headerFieldKey(field)) === 'dialog')
                                ? (openBlock(), createElementBlock("div", _hoisted_101, [
                                    createVNode(_component_el_input, {
                                      "model-value": cur.value[headerFieldKey(field)],
                                      readonly: "",
                                      disabled: headerFieldLocked(field),
                                      placeholder: unref(tt)('请选择'),
                                      onClick: $event => (openDictPick(field))
                                    }, null, 8, ["model-value", "disabled", "placeholder", "onClick"]),
                                    createVNode(_component_el_button, {
                                      icon: unref(search_default),
                                      title: unref(tt)('选择'),
                                      disabled: headerFieldLocked(field),
                                      onClick: $event => (openDictPick(field))
                                    }, null, 8, ["icon", "title", "disabled", "onClick"])
                                  ]))
                                : (isSelectField(field))
                                  ? (openBlock(), createBlock(_component_el_select, {
                                      key: 3,
                                      modelValue: cur.value[headerFieldKey(field)],
                                      "onUpdate:modelValue": $event => ((cur.value[headerFieldKey(field)]) = $event),
                                      disabled: headerFieldLocked(field),
                                      clearable: "",
                                      filterable: "",
                                      "allow-create": "",
                                      onChange: markInlineDirty
                                    }, {
                                      default: withCtx(() => [
                                        (openBlock(true), createElementBlock(Fragment, null, renderList(fieldOptions(field), (option) => {
                                          return (openBlock(), createBlock(_component_el_option, {
                                            key: option.value,
                                            label: option.label,
                                            value: option.value
                                          }, null, 8, ["label", "value"]))
                                        }), 128))
                                      ]),
                                      _: 2
                                    }, 1032, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                  : (isDateField(field))
                                    ? (openBlock(), createBlock(_component_el_date_picker, {
                                        key: 4,
                                        modelValue: cur.value[headerFieldKey(field)],
                                        "onUpdate:modelValue": $event => ((cur.value[headerFieldKey(field)]) = $event),
                                        disabled: headerFieldLocked(field),
                                        type: "date",
                                        "value-format": "YYYY-MM-DD",
                                        onChange: markInlineDirty
                                      }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                    : (isNumberField(field))
                                      ? (openBlock(), createBlock(_component_el_input_number, {
                                          key: 5,
                                          modelValue: cur.value[headerFieldKey(field)],
                                          "onUpdate:modelValue": $event => ((cur.value[headerFieldKey(field)]) = $event),
                                          disabled: headerFieldLocked(field),
                                          controls: false,
                                          onChange: markInlineDirty
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                      : (isBooleanField(field))
                                        ? (openBlock(), createBlock(_component_el_switch, {
                                            key: 6,
                                            modelValue: cur.value[headerFieldKey(field)],
                                            "onUpdate:modelValue": $event => ((cur.value[headerFieldKey(field)]) = $event),
                                            disabled: headerFieldLocked(field),
                                            onChange: markInlineDirty
                                          }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                                        : (openBlock(), createBlock(_component_el_input, {
                                            key: 7,
                                            modelValue: cur.value[headerFieldKey(field)],
                                            "onUpdate:modelValue": $event => ((cur.value[headerFieldKey(field)]) = $event),
                                            disabled: headerFieldLocked(field),
                                            onChange: markInlineDirty
                                          }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"]))
                        ], 64))
                      : (openBlock(), createElementBlock("div", {
                          key: 1,
                          class: "field-readonly",
                          title: printBatchLockReason(field) || String(cur.value[headerFieldKey(field)] ?? '')
                        }, toDisplayString(formatFieldValue(field, cur.value[headerFieldKey(field)])), 9, _hoisted_102))
                  ]))
                }), 128)),
                (showBatchSummary.value)
                  ? (openBlock(), createElementBlock("button", {
                      key: 0,
                      type: "button",
                      class: "batch-sum-line",
                      title: unref(tt)('点击查看送料批次'),
                      onClick: _cache[51] || (_cache[51] = $event => (batchPopover.value = !batchPopover.value))
                    }, [
                      createBaseVNode("span", _hoisted_104, toDisplayString(unref(tt)('送料')), 1),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('已送')) + " " + toDisplayString(batchTab.sum.batches) + " " + toDisplayString(unref(tt)('批')), 1),
                      (batchTab.sum.pending)
                        ? (openBlock(), createElementBlock("span", _hoisted_105, "(" + toDisplayString(unref(tt)('{n} 批待编号').replace('{n}', batchTab.sum.pending)) + ")", 1))
                        : createCommentVNode("", true),
                      _cache[155] || (_cache[155] = createBaseVNode("span", { class: "bsl-sep" }, "/", -1)),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('剩余')) + " " + toDisplayString(batchTab.sum.left), 1),
                      _cache[156] || (_cache[156] = createBaseVNode("span", { class: "bsl-sep" }, "/", -1)),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('可补')) + " " + toDisplayString(batchTab.sum.ret), 1),
                      _cache[157] || (_cache[157] = createBaseVNode("span", { class: "bsl-caret" }, "▸", -1))
                    ], 8, _hoisted_103))
                  : createCommentVNode("", true),
                (showBatchSummary.value)
                  ? (openBlock(), createBlock(_component_el_popover, {
                      key: 1,
                      visible: batchPopover.value,
                      "onUpdate:visible": _cache[52] || (_cache[52] = $event => ((batchPopover).value = $event)),
                      placement: "bottom-end",
                      width: 760,
                      "show-arrow": false,
                      trigger: "click",
                      "popper-class": "batch-pop"
                    }, {
                      reference: withCtx(() => [...(_cache[158] || (_cache[158] = [
                        createBaseVNode("span", {
                          class: "batch-anchor",
                          "aria-hidden": "true"
                        }, null, -1)
                      ]))]),
                      default: withCtx(() => [
                        withDirectives((openBlock(), createElementBlock("div", _hoisted_106, [
                          createVNode(_component_el_table, {
                            data: batchTab.rows,
                            border: "",
                            size: "small",
                            "max-height": "330"
                          }, {
                            empty: withCtx(() => [
                              createTextVNode(toDisplayString(unref(tt)('该订单暂无送料批次')), 1)
                            ]),
                            default: withCtx(() => [
                              createVNode(_component_el_table_column, {
                                prop: "batchNo",
                                label: unref(tt)('批次号'),
                                "min-width": "180"
                              }, null, 8, ["label"]),
                              createVNode(_component_el_table_column, {
                                prop: "createTime",
                                label: unref(tt)('日期'),
                                width: "150"
                              }, null, 8, ["label"]),
                              createVNode(_component_el_table_column, {
                                prop: "batchQty",
                                label: unref(tt)('数量'),
                                width: "90",
                                align: "right"
                              }, null, 8, ["label"]),
                              createVNode(_component_el_table_column, {
                                label: unref(tt)('状态'),
                                width: "90",
                                align: "center"
                              }, {
                                default: withCtx(({ row }) => [
                                  createTextVNode(toDisplayString(unref(tt)(row.status === 'ACTIVE' ? '有效' : row.status === 'PENDING' ? '待编号' : '已释放')), 1)
                                ]),
                                _: 1
                              }, 8, ["label"]),
                              createVNode(_component_el_table_column, {
                                label: unref(tt)('去向单号'),
                                "min-width": "150"
                              }, {
                                default: withCtx(({ row }) => [
                                  (row.targetInvalid || !row.targetFormNo)
                                    ? (openBlock(), createElementBlock("span", _hoisted_107, toDisplayString(unref(tt)('已作废')), 1))
                                    : (openBlock(), createElementBlock("span", _hoisted_108, toDisplayString(row.targetFormNo), 1))
                                ]),
                                _: 1
                              }, 8, ["label"]),
                              createVNode(_component_el_table_column, {
                                label: unref(tt)('操作'),
                                width: "80",
                                align: "center"
                              }, {
                                default: withCtx(({ row }) => [
                                  createVNode(_component_el_button, {
                                    link: "",
                                    type: "primary",
                                    disabled: !row.targetFormNo || row.targetInvalid,
                                    onClick: $event => (onBatchTabRow(row))
                                  }, {
                                    default: withCtx(() => [
                                      createTextVNode(toDisplayString(unref(tt)('查看')), 1)
                                    ]),
                                    _: 1
                                  }, 8, ["disabled", "onClick"])
                                ]),
                                _: 1
                              }, 8, ["label"])
                            ]),
                            _: 1
                          }, 8, ["data"])
                        ])), [
                          [_directive_loading, batchTab.loading]
                        ])
                      ]),
                      _: 1
                    }, 8, ["visible"]))
                  : createCommentVNode("", true)
              ], 2),
              (attachFields.value.length && curDocNo.value)
                ? (openBlock(), createElementBlock("div", _hoisted_109, [
                    createBaseVNode("span", _hoisted_110, toDisplayString(unref(tt)('附件')), 1),
                    createBaseVNode("div", _hoisted_111, [
                      createVNode(FileAttachCell, {
                        "panel-code": panelCode.value,
                        "doc-no": curDocNo.value,
                        slots: attachKeys.value,
                        values: attachValues.value,
                        "can-edit": attachEditable.value,
                        onChange: applyAttachSlots
                      }, null, 8, ["panel-code", "doc-no", "slots", "values", "can-edit"])
                    ])
                  ]))
                : createCommentVNode("", true),
              (docPrintEnabled.value)
                ? (openBlock(), createElementBlock("div", _hoisted_112, [
                    createBaseVNode("div", _hoisted_113, toDisplayString(unref(tt)(panelName.value)), 1),
                    createBaseVNode("div", _hoisted_114, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(docPrintHead.value, (f) => {
                        return (openBlock(), createElementBlock("div", {
                          key: headerFieldKey(f),
                          class: "dp-pair"
                        }, [
                          createBaseVNode("span", _hoisted_115, toDisplayString(unref(tt)(headerFieldLabel(f))) + "：", 1),
                          createBaseVNode("span", _hoisted_116, toDisplayString(formatFieldValue(f, cur.value[headerFieldKey(f)])), 1)
                        ]))
                      }), 128))
                    ]),
                    createBaseVNode("table", _hoisted_117, [
                      createBaseVNode("colgroup", null, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(docPrintCols.value, (c, i) => {
                          return (openBlock(), createElementBlock("col", {
                            key: i,
                            style: normalizeStyle({ width: c.pct + '%' })
                          }, null, 4))
                        }), 128))
                      ]),
                      createBaseVNode("thead", null, [
                        createBaseVNode("tr", null, [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(docPrintCols.value, (c, i) => {
                            return (openBlock(), createElementBlock("th", { key: i }, toDisplayString(c.title), 1))
                          }), 128))
                        ])
                      ]),
                      createBaseVNode("tbody", null, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(docPrintRows.value, (r, ri) => {
                          return (openBlock(), createElementBlock("tr", { key: ri }, [
                            (openBlock(true), createElementBlock(Fragment, null, renderList(docPrintCols.value, (c, ci) => {
                              return (openBlock(), createElementBlock("td", { key: ci }, toDisplayString(c.text(r, ri)), 1))
                            }), 128))
                          ]))
                        }), 128))
                      ])
                    ])
                  ]))
                : createCommentVNode("", true),
              (!isApprovalDoc.value && !isQcInspReq.value)
                ? withDirectives((openBlock(), createElementBlock("div", {
                    key: 2,
                    class: normalizeClass(["body", { 'draft-body': draftEditable.value }])
                  }, [
                    (mainGrid.value)
                      ? (openBlock(), createElementBlock("div", _hoisted_118, [
                          createBaseVNode("div", _hoisted_119, [
                            createBaseVNode("span", _hoisted_120, toDisplayString(mainGrid.value.label), 1),
                            createBaseVNode("span", _hoisted_121, [
                              createBaseVNode("span", {
                                class: "dt-ic",
                                title: unref(tt)('点行切换当前单据')
                              }, toDisplayString(unref(tt)('定位')), 9, _hoisted_122)
                            ])
                          ]),
                          createVNode(_component_el_table, {
                            data: mainRows.value,
                            border: "",
                            size: "small",
                            "row-class-name": mainRowCls,
                            onRowClick: onMainRowClick,
                            onRowDblclick: openMaintain
                          }, {
                            default: withCtx(() => [
                              createVNode(_component_el_table_column, {
                                type: "index",
                                label: unref(tt)('序号'),
                                width: "60",
                                align: "center",
                                index: (i) => i + 1
                              }, null, 8, ["label", "index"]),
                              (openBlock(true), createElementBlock(Fragment, null, renderList(mainCols.value, (c) => {
                                return (openBlock(), createBlock(_component_el_table_column, {
                                  key: c,
                                  prop: c,
                                  label: unref(tt)(c),
                                  "min-width": "110",
                                  "show-overflow-tooltip": ""
                                }, {
                                  header: withCtx(() => [
                                    createBaseVNode("div", {
                                      class: normalizeClass(["col-hdr", { filtering: hasColFilter(c) }]),
                                      onClick: withModifiers($event => (toggleColFilter(c)), ["stop"])
                                    }, [
                                      createBaseVNode("span", null, toDisplayString(unref(tt)(c)), 1),
                                      createBaseVNode("span", {
                                        class: normalizeClass(["col-hdr-sort", { on: isSortOn(mainSort, c) }]),
                                        title: unref(tt)('点击排序：升序 → 降序 → 取消'),
                                        onClick: withModifiers($event => (cycleSort(mainSort, c)), ["stop"])
                                      }, toDisplayString(sortCaret(mainSort, c)), 11, _hoisted_124),
                                      (hasColFilter(c))
                                        ? (openBlock(), createElementBlock("span", {
                                            key: 0,
                                            class: "col-hdr-tag",
                                            onClick: withModifiers($event => (clearColFilter(c)), ["stop"]),
                                            title: unref(tt)('清除')
                                          }, toDisplayString(colFilterText[c]) + " ×", 9, _hoisted_125))
                                        : (openBlock(), createBlock(_component_el_icon, {
                                            key: 1,
                                            class: "col-hdr-ic"
                                          }, {
                                            default: withCtx(() => [
                                              createVNode(unref(search_default))
                                            ]),
                                            _: 1
                                          }))
                                    ], 10, _hoisted_123),
                                    (filterColProp.value === c)
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: colFilterText[c],
                                          "onUpdate:modelValue": $event => ((colFilterText[c]) = $event),
                                          size: "small",
                                          placeholder: unref(tt)('筛选...'),
                                          clearable: "",
                                          class: "col-filter-inp",
                                          onClick: _cache[53] || (_cache[53] = withModifiers(() => {}, ["stop"])),
                                          onClear: $event => (clearColFilter(c)),
                                          onKeyup: withKeys($event => (clearColFilter(c)), ["escape"])
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder", "onClear", "onKeyup"]))
                                      : createCommentVNode("", true)
                                  ]),
                                  _: 2
                                }, 1032, ["prop", "label"]))
                              }), 128))
                            ]),
                            _: 1
                          }, 8, ["data"])
                        ]))
                      : createCommentVNode("", true),
                    (openBlock(true), createElementBlock(Fragment, null, renderList(blocks.value, (b) => {
                      return (openBlock(), createElementBlock("div", {
                        class: "detail",
                        key: b.id
                      }, [
                        (isApproved.value)
                          ? (openBlock(), createElementBlock("div", _hoisted_126, toDisplayString(unref(tt)('已审批')), 1))
                          : createCommentVNode("", true),
                        createBaseVNode("div", _hoisted_127, [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(headItems(b), (it) => {
                            return (openBlock(), createElementBlock("span", {
                              key: it.kind + it.key,
                              class: normalizeClass(["dt-tab", { on: isOn(b, it) }]),
                              onClick: $event => (switchTab(b, it))
                            }, toDisplayString(unref(tt)(it.label)), 11, _hoisted_128))
                          }), 128)),
                          (b.id === 'B' && activeTab(b).key === 'materials' && selectedProduct.value)
                            ? (openBlock(), createElementBlock("span", _hoisted_129, toDisplayString(unref(tt)('当前产品：')) + toDisplayString(selectedProduct.value) + " " + toDisplayString(unref(tt)('的 BOM 子件')), 1))
                            : createCommentVNode("", true),
                          createBaseVNode("span", _hoisted_130, [
                            (detailEditable(b))
                              ? (openBlock(), createBlock(_component_el_button, {
                                  key: 0,
                                  size: "small",
                                  type: "primary",
                                  icon: unref(plus_default),
                                  onClick: $event => (addInlineDetailRow(b))
                                }, {
                                  default: withCtx(() => [
                                    createTextVNode(toDisplayString(unref(tt)('新增数据')), 1)
                                  ]),
                                  _: 1
                                }, 8, ["icon", "onClick"]))
                              : createCommentVNode("", true),
                            (openBlock(true), createElementBlock(Fragment, null, renderList(b.isMain ? iconA : iconB, (ic) => {
                              return (openBlock(), createElementBlock("span", {
                                class: "dt-ic",
                                key: ic,
                                onClick: $event => (onIcon(ic, b))
                              }, toDisplayString(unref(tt)(ic)), 9, _hoisted_131))
                            }), 128))
                          ])
                        ]),
                        (singleDocMode.value && archTotal(b) > ARCH_SIZE_OPTS[0])
                          ? (openBlock(), createElementBlock("div", _hoisted_132, [
                              createVNode(_component_el_pagination, {
                                small: "",
                                background: "",
                                "page-size": archPageSize.value,
                                "onUpdate:pageSize": _cache[54] || (_cache[54] = $event => ((archPageSize).value = $event)),
                                layout: "total, sizes, prev, next, jumper",
                                "page-sizes": ARCH_SIZE_OPTS,
                                total: archTotal(b),
                                "current-page": archCurPage(b),
                                onSizeChange: onArchSizeChange,
                                onCurrentChange: _cache[55] || (_cache[55] = (p) => (archPage.value = p))
                              }, null, 8, ["page-size", "total", "current-page"])
                            ]))
                          : createCommentVNode("", true),
                        createVNode(_component_el_table, {
                          data: pagedBlockRows(b),
                          height: tableH(b),
                          border: "",
                          size: "small",
                          "show-summary": tabView(b, activeTab(b)) !== 'summary',
                          "summary-method": (p) => sumMethodFor(b, p),
                          "sum-text": unref(tt)('合计'),
                          "row-class-name": (o) => rowCls(o, b),
                          onSelectionChange: _cache[57] || (_cache[57] = (r) => (delSel.value = r)),
                          onRowContextmenu: (row, col, ev) => onCtx(ev, row, b),
                          onCellDblclick: (row, col, cell, ev) => onDetailCellDblclick(row, col, ev, b),
                          onRowClick: (row) => onRowClick(row, b),
                          onClickCapture: (e) => onTableClick(b, e),
                          onScrollCapture: (e) => onArchScroll(e, b)
                        }, {
                          default: withCtx(() => [
                            (delMode.value && b.isMain)
                              ? (openBlock(), createBlock(_component_el_table_column, {
                                  key: 0,
                                  type: "selection",
                                  width: "45",
                                  fixed: "left"
                                }))
                              : createCommentVNode("", true),
                            (qrKey.value && b.isMain)
                              ? (openBlock(), createBlock(_component_el_table_column, {
                                  key: 1,
                                  width: "40",
                                  fixed: "left",
                                  align: "center"
                                }, {
                                  header: withCtx(() => [
                                    createVNode(_component_el_checkbox, {
                                      "model-value": qrPageAllChecked(b),
                                      indeterminate: qrPageSomeChecked(b),
                                      title: unref(tt)('本页全选'),
                                      onChange: (v) => qrTogglePage(b, v)
                                    }, null, 8, ["model-value", "indeterminate", "title", "onChange"])
                                  ]),
                                  default: withCtx(({ row }) => [
                                    createVNode(_component_el_checkbox, {
                                      "model-value": qrSel.value.has(qrRowKey(row)),
                                      disabled: !qrRowKey(row),
                                      onChange: () => qrToggleRow(row)
                                    }, null, 8, ["model-value", "disabled", "onChange"])
                                  ]),
                                  _: 2
                                }, 1024))
                              : createCommentVNode("", true),
                            (openBlock(true), createElementBlock(Fragment, null, renderList(archGridCols(b), (c) => {
                              return (openBlock(), createElementBlock(Fragment, {
                                key: c.spacer ? 'lazy-' + c.spacer : c.prop
                              }, [
                                (c.spacer)
                                  ? (openBlock(), createBlock(_component_el_table_column, {
                                      key: 0,
                                      width: c.width,
                                      label: '',
                                      "column-key": "col-lazy-spacer",
                                      resizable: false,
                                      "class-name": "col-lazy-spacer"
                                    }, null, 8, ["width"]))
                                  : (openBlock(), createBlock(_component_el_table_column, {
                                      key: 1,
                                      prop: c.prop,
                                      label: c.label,
                                      width: archColW(b, c),
                                      "min-width": archColW(b, c) ? undefined : c.width,
                                      align: c.align,
                                      "show-overflow-tooltip": !detailEditable(b)
                                    }, {
                                      header: withCtx(() => [
                                        createBaseVNode("div", {
                                          class: normalizeClass(["col-hdr", { filtering: hasColFilter(c.prop) }]),
                                          onClick: withModifiers($event => (toggleColFilter(c.prop)), ["stop"])
                                        }, [
                                          createBaseVNode("span", {
                                            class: normalizeClass(["col-hdr-text", { req: c.field?.isRequired }])
                                          }, toDisplayString(c.label), 3),
                                          createBaseVNode("span", {
                                            class: normalizeClass(["col-hdr-sort", { on: isSortOn(blockSortOf(b), c.prop) }]),
                                            title: unref(tt)('点击排序：升序 → 降序 → 取消'),
                                            onClick: withModifiers($event => (cycleSort(blockSortOf(b), c.prop)), ["stop"])
                                          }, toDisplayString(sortCaret(blockSortOf(b), c.prop)), 11, _hoisted_134),
                                          (hasColFilter(c.prop))
                                            ? (openBlock(), createElementBlock("span", {
                                                key: 0,
                                                class: "col-hdr-tag",
                                                onClick: withModifiers($event => (clearColFilter(c.prop)), ["stop"]),
                                                title: unref(tt)('清除筛选')
                                              }, toDisplayString(colFilterText[c.prop]) + " ×", 9, _hoisted_135))
                                            : (openBlock(), createBlock(_component_el_icon, {
                                                key: 1,
                                                class: "col-hdr-ic"
                                              }, {
                                                default: withCtx(() => [
                                                  createVNode(unref(search_default))
                                                ]),
                                                _: 1
                                              }))
                                        ], 10, _hoisted_133),
                                        (filterColProp.value === c.prop)
                                          ? (openBlock(), createBlock(_component_el_input, {
                                              key: 0,
                                              modelValue: colFilterText[c.prop],
                                              "onUpdate:modelValue": $event => ((colFilterText[c.prop]) = $event),
                                              size: "small",
                                              placeholder: unref(tt)('筛选...'),
                                              clearable: "",
                                              class: "col-filter-inp",
                                              onClick: _cache[56] || (_cache[56] = withModifiers(() => {}, ["stop"])),
                                              onClear: $event => (clearColFilter(c.prop)),
                                              onKeyup: withKeys($event => (clearColFilter(c.prop)), ["escape"])
                                            }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder", "onClear", "onKeyup"]))
                                          : createCommentVNode("", true)
                                      ]),
                                      default: withCtx(({ row }) => [
                                        (archEditable(b) && !row._placeholder)
                                          ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                              (c.field.computed)
                                                ? (openBlock(), createElementBlock("span", _hoisted_136, toDisplayString(formatFieldValue(c.field, row[c.prop])), 1))
                                                : (detailBatchLocked(c.prop))
                                                  ? (openBlock(), createElementBlock("span", {
                                                      key: 1,
                                                      class: "cell-locked",
                                                      title: unref(tt)('随单头批次号一致,不可修改')
                                                    }, toDisplayString(row[c.prop] ?? ''), 9, _hoisted_137))
                                                  : (isLineToggleCol(c.prop))
                                                    ? (openBlock(), createElementBlock("span", _hoisted_138, [
                                                        createVNode(_component_el_switch, {
                                                          "model-value": toBool(row[c.prop]),
                                                          onChange: (v) => toggleLineDisable(row, v)
                                                        }, null, 8, ["model-value", "onChange"])
                                                      ]))
                                                    : (isReferenceField(c.field) && (!singleDocMode.value.value || isActiveCell(row, b, c.prop)))
                                                      ? (openBlock(), createElementBlock("div", {
                                                          key: 3,
                                                          class: normalizeClass(["inline-ref-editor", { active: isActiveDetailRefRow(row, b, c.prop) }])
                                                        }, [
                                                          createVNode(_component_el_input, {
                                                            "model-value": formatFieldValue(c.field, row[c.prop]),
                                                            readonly: "",
                                                            title: detailRefTrigger(c.field) === 'dblclick' ? unref(tt)('双击选择存货') : unref(tt)('点击选择'),
                                                            onClick: $event => (openClickDetailRef(c.field, row, b))
                                                          }, null, 8, ["model-value", "title", "onClick"]),
                                                          (detailRefTrigger(c.field) === 'dblclick' && isActiveDetailRefRow(row, b, c.prop))
                                                            ? (openBlock(), createBlock(_component_el_icon, {
                                                                key: 0,
                                                                class: "list-ref-icon"
                                                              }, {
                                                                default: withCtx(() => [
                                                                  createVNode(unref(search_default))
                                                                ]),
                                                                _: 1
                                                              }))
                                                            : createCommentVNode("", true)
                                                        ], 2))
                                                      : (isReferenceField(c.field))
                                                        ? (openBlock(), createElementBlock("span", {
                                                            key: 4,
                                                            class: "cell-lazy",
                                                            title: unref(tt)('点击编辑'),
                                                            onClick: $event => (activateCell(row, b, c.prop))
                                                          }, toDisplayString(formatFieldValue(c.field, row[c.prop])), 9, _hoisted_139))
                                                        : (isActiveCell(row, b, c.prop))
                                                          ? (openBlock(), createElementBlock(Fragment, { key: 5 }, [
                                                              (isSelectField(c.field))
                                                                ? withDirectives((openBlock(), createBlock(_component_el_select, {
                                                                    key: 0,
                                                                    modelValue: row[c.prop],
                                                                    "onUpdate:modelValue": $event => ((row[c.prop]) = $event),
                                                                    disabled: c.field.computed,
                                                                    filterable: "",
                                                                    clearable: "",
                                                                    "allow-create": "",
                                                                    onChange: $event => (onInlineDetailChange(activeTab(b).key, row, c.field))
                                                                  }, {
                                                                    default: withCtx(() => [
                                                                      (openBlock(true), createElementBlock(Fragment, null, renderList(fieldOptions(c.field), (option) => {
                                                                        return (openBlock(), createBlock(_component_el_option, {
                                                                          key: option.value,
                                                                          label: option.label,
                                                                          value: option.value
                                                                        }, null, 8, ["label", "value"]))
                                                                      }), 128))
                                                                    ]),
                                                                    _: 2
                                                                  }, 1032, ["modelValue", "onUpdate:modelValue", "disabled", "onChange"])), [
                                                                    [vCellFocus]
                                                                  ])
                                                                : (isDateField(c.field))
                                                                  ? withDirectives((openBlock(), createBlock(_component_el_date_picker, {
                                                                      key: 1,
                                                                      modelValue: row[c.prop],
                                                                      "onUpdate:modelValue": $event => ((row[c.prop]) = $event),
                                                                      disabled: c.field.computed,
                                                                      type: "date",
                                                                      "value-format": "YYYY-MM-DD",
                                                                      onChange: $event => (onInlineDetailChange(activeTab(b).key, row, c.field))
                                                                    }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled", "onChange"])), [
                                                                      [vCellFocus]
                                                                    ])
                                                                  : (isNumberField(c.field))
                                                                    ? withDirectives((openBlock(), createBlock(_component_el_input_number, {
                                                                        key: 2,
                                                                        "model-value": activeCellEcho.value,
                                                                        disabled: c.field.computed,
                                                                        controls: false,
                                                                        "onUpdate:modelValue": (v) => onActiveCellEchoInput(row, c.prop, v),
                                                                        onChange: $event => (onInlineDetailChange(activeTab(b).key, row, c.field))
                                                                      }, null, 8, ["model-value", "disabled", "onUpdate:modelValue", "onChange"])), [
                                                                        [vCellFocus]
                                                                      ])
                                                                    : (isBooleanField(c.field))
                                                                      ? withDirectives((openBlock(), createBlock(_component_el_switch, {
                                                                          key: 3,
                                                                          modelValue: row[c.prop],
                                                                          "onUpdate:modelValue": $event => ((row[c.prop]) = $event),
                                                                          disabled: c.field.computed,
                                                                          onChange: $event => (onInlineDetailChange(activeTab(b).key, row, c.field))
                                                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled", "onChange"])), [
                                                                          [vCellFocus]
                                                                        ])
                                                                      : withDirectives((openBlock(), createBlock(_component_el_input, {
                                                                          key: 4,
                                                                          "model-value": activeCellEcho.value,
                                                                          disabled: c.field.computed,
                                                                          "onUpdate:modelValue": (v) => onActiveCellEchoInput(row, c.prop, v),
                                                                          onChange: $event => (onInlineDetailChange(activeTab(b).key, row, c.field))
                                                                        }, null, 8, ["model-value", "disabled", "onUpdate:modelValue", "onChange"])), [
                                                                          [vCellFocus]
                                                                        ])
                                                            ], 64))
                                                          : (openBlock(), createElementBlock("span", {
                                                              key: 6,
                                                              class: "cell-lazy",
                                                              onClick: $event => (activateCell(row, b, c.prop))
                                                            }, toDisplayString(formatFieldValue(c.field, row[c.prop])), 9, _hoisted_140))
                                            ], 64))
                                          : (openBlock(), createElementBlock("span", _hoisted_141, toDisplayString(unref(tt)(row[c.prop] ?? '')), 1))
                                      ]),
                                      _: 2
                                    }, 1032, ["prop", "label", "width", "min-width", "align", "show-overflow-tooltip"]))
                              ], 64))
                            }), 128))
                          ]),
                          _: 2
                        }, 1032, ["data", "height", "show-summary", "summary-method", "sum-text", "row-class-name", "onRowContextmenu", "onCellDblclick", "onRowClick", "onClickCapture", "onScrollCapture"])
                      ]))
                    }), 128))
                  ], 2)), [
                    [_directive_loading, loading.value]
                  ])
                : createCommentVNode("", true),
              (showFooter.value)
                ? (openBlock(), createElementBlock("div", _hoisted_142, [
                    createBaseVNode("div", _hoisted_143, [
                      createBaseVNode("label", null, toDisplayString(unref(tt)('备注')), 1),
                      createVNode(_component_el_input, {
                        modelValue: remarkText.value,
                        "onUpdate:modelValue": _cache[58] || (_cache[58] = $event => ((remarkText).value = $event)),
                        size: "small",
                        placeholder: "",
                        disabled: !draftEditable.value
                      }, null, 8, ["modelValue", "disabled"])
                    ]),
                    _cache[159] || (_cache[159] = createBaseVNode("div", { class: "footer-hr" }, null, -1)),
                    createBaseVNode("div", _hoisted_144, [
                      createBaseVNode("span", null, toDisplayString(unref(tt)('制单人：')) + toDisplayString(cur.value['制单人'] || cur.value['发起人编号'] || ''), 1),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('审核人：')) + toDisplayString(cur.value['审核人'] || ''), 1),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('审核日期：')) + toDisplayString(cur.value['审核日期'] || ''), 1),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('审核时间：')) + toDisplayString(cur.value['审核时间'] || ''), 1),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('打印次数：')) + toDisplayString(cur.value['打印次数'] ?? 0), 1),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('创建时间：')) + toDisplayString(cur.value['创建时间'] || ''), 1),
                      createBaseVNode("span", null, toDisplayString(unref(tt)('审核意见：')) + toDisplayString(cur.value['审核意见'] || '-'), 1)
                    ])
                  ]))
                : createCommentVNode("", true)
            ])
          ], 2))
        : (isQcInspReq.value)
          ? withDirectives((openBlock(), createElementBlock("div", _hoisted_145, [
              createVNode(QcInspReqSheet, {
                head: cur.value,
                editable: draftEditable.value,
                "panel-code": panelCode.value,
                fields: sheetAllFields.value,
                onDirty: markInlineDirty,
                onSave: _cache[59] || (_cache[59] = $event => (saveInlineDraft('保存'))),
                onRefresh: _cache[60] || (_cache[60] = $event => (load())),
                onRefreshConfig: onFieldEditRefresh
              }, null, 8, ["head", "editable", "panel-code", "fields"])
            ])), [
              [_directive_loading, loading.value]
            ])
          : createCommentVNode("", true),
    (ctx.visible)
      ? (openBlock(), createElementBlock("div", {
          key: 6,
          class: "ctx-menu",
          style: normalizeStyle({ left: ctx.x + 'px', top: ctx.y + 'px' })
        }, [
          (openBlock(), createElementBlock(Fragment, null, renderList(ctxItems, (it) => {
            return createBaseVNode("div", {
              class: "ctx-item",
              key: it,
              onClick: $event => (onCtxItem(it))
            }, toDisplayString(unref(tt)(it)), 9, _hoisted_146)
          }), 64))
        ], 4))
      : createCommentVNode("", true),
    createVNode(_component_el_dialog, {
      modelValue: leaveVisible.value,
      "onUpdate:modelValue": _cache[64] || (_cache[64] = $event => ((leaveVisible).value = $event)),
      title: unref(tt)('未保存提示'),
      width: "420px",
      "append-to-body": "",
      "close-on-click-modal": false,
      onClose: onLeaveDialogClose
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[61] || (_cache[61] = $event => (onLeaveChoice('stay')))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          onClick: _cache[62] || (_cache[62] = $event => (onLeaveChoice('discard')))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('不保存')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: _cache[63] || (_cache[63] = $event => (onLeaveChoice('save')))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('保存')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("span", null, toDisplayString(leaveQuestion.value), 1)
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(RefPickDialog, {
      modelValue: queryRefVisible.value,
      "onUpdate:modelValue": _cache[65] || (_cache[65] = $event => ((queryRefVisible).value = $event)),
      field: queryRefField.value,
      mode: "query",
      onConfirm: onQueryRefConfirm
    }, null, 8, ["modelValue", "field"]),
    createVNode(RefPickDialog, {
      modelValue: headerRefVisible.value,
      "onUpdate:modelValue": _cache[66] || (_cache[66] = $event => ((headerRefVisible).value = $event)),
      field: headerRefField.value,
      mode: "header",
      onConfirm: onHeaderRefConfirm
    }, null, 8, ["modelValue", "field"]),
    createVNode(RefPickDialog, {
      modelValue: detailRefVisible.value,
      "onUpdate:modelValue": _cache[67] || (_cache[67] = $event => ((detailRefVisible).value = $event)),
      field: detailRefPick.value?.field,
      mode: "detail",
      onConfirm: onDetailRefConfirm
    }, null, 8, ["modelValue", "field"]),
    createVNode(BatchSendDialog, {
      modelValue: batchSendVisible.value,
      "onUpdate:modelValue": _cache[68] || (_cache[68] = $event => ((batchSendVisible).value = $event)),
      "source-panel": batchSend.value?.sourcePanel || '',
      "target-panel": batchSend.value?.targetPanel || '',
      "source-no": batchSend.value?.sourceNo || '',
      onGenerated: onBatchGenerated
    }, null, 8, ["modelValue", "source-panel", "target-panel", "source-no"]),
    createVNode(_component_el_dialog, {
      modelValue: dictPickVisible.value,
      "onUpdate:modelValue": _cache[71] || (_cache[71] = $event => ((dictPickVisible).value = $event)),
      title: unref(tt)('选择') + '：' + (dictPickField.value ? headerFieldLabel(dictPickField.value) : ''),
      width: "440px",
      "append-to-body": "",
      "close-on-click-modal": false
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, { onClick: clearDictPick }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('清空')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: _cache[70] || (_cache[70] = $event => (dictPickVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createVNode(_component_el_input, {
          modelValue: dictPickKeyword.value,
          "onUpdate:modelValue": _cache[69] || (_cache[69] = $event => ((dictPickKeyword).value = $event)),
          placeholder: unref(tt)('输入搜索'),
          clearable: "",
          class: "dict-pick-search"
        }, null, 8, ["modelValue", "placeholder"]),
        createBaseVNode("div", _hoisted_147, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(dictPickOptions.value, (o, i) => {
            return (openBlock(), createElementBlock("div", {
              key: i,
              class: "dict-pick-item",
              onClick: $event => (onDictPick(o))
            }, toDisplayString(o.label), 9, _hoisted_148))
          }), 128)),
          (!dictPickOptions.value.length)
            ? (openBlock(), createBlock(_component_el_empty, {
                key: 0,
                description: unref(tt)('暂无数据'),
                "image-size": 50
              }, null, 8, ["description"]))
            : createCommentVNode("", true)
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: queryDialogVisible.value,
      "onUpdate:modelValue": _cache[80] || (_cache[80] = $event => ((queryDialogVisible).value = $event)),
      title: unref(tt)('查询'),
      width: "760px",
      "append-to-body": "",
      "destroy-on-close": "",
      class: "header-query-dialog",
      onOpen: loadPlans,
      onClose: onQueryDialogClose
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, { onClick: resetHeaderQuery }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('重置')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          onClick: _cache[79] || (_cache[79] = $event => (queryDialogVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          icon: unref(search_default),
          onClick: applyHeaderQuery
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('查询')), 1)
          ]),
          _: 1
        }, 8, ["icon"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_149, [
          createBaseVNode("span", _hoisted_150, toDisplayString(unref(tt)('查询方案')), 1),
          createVNode(_component_el_select, {
            modelValue: selectedPlan.value,
            "onUpdate:modelValue": _cache[72] || (_cache[72] = $event => ((selectedPlan).value = $event)),
            placeholder: unref(tt)('选择方案'),
            clearable: "",
            filterable: "",
            size: "small",
            class: "plan-select",
            onChange: _cache[73] || (_cache[73] = (v) => v && applyPlan(v))
          }, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(queryPlans.value, (p) => {
                return (openBlock(), createBlock(_component_el_option, {
                  key: p.name,
                  value: p.name,
                  label: p.name
                }, {
                  default: withCtx(() => [
                    createBaseVNode("span", _hoisted_151, toDisplayString(p.name), 1),
                    createBaseVNode("span", _hoisted_152, toDisplayString(planSummary(p)), 1)
                  ]),
                  _: 2
                }, 1032, ["value", "label"]))
              }), 128))
            ]),
            _: 1
          }, 8, ["modelValue", "placeholder"]),
          createVNode(_component_el_button, {
            size: "small",
            type: "primary",
            plain: "",
            onClick: saveCurrentPlan
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('保存方案')), 1)
            ]),
            _: 1
          }),
          createVNode(_component_el_button, {
            size: "small",
            onClick: _cache[74] || (_cache[74] = $event => (planManageVisible.value = true))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('方案维护')), 1)
            ]),
            _: 1
          })
        ]),
        createBaseVNode("div", _hoisted_153, [
          (reportQueryDialog.value)
            ? (openBlock(), createElementBlock("div", _hoisted_154, [
                createBaseVNode("label", _hoisted_155, [
                  createTextVNode(toDisplayString(unref(tt)('单据日期')), 1),
                  _cache[160] || (_cache[160] = createBaseVNode("span", { class: "req-star" }, "*", -1))
                ]),
                createVNode(_component_el_date_picker, {
                  modelValue: rqdRange.value,
                  "onUpdate:modelValue": _cache[75] || (_cache[75] = $event => ((rqdRange).value = $event)),
                  type: "daterange",
                  "value-format": "YYYY-MM-DD",
                  "range-separator": unref(tt)('至'),
                  "start-placeholder": unref(tt)('开始日期'),
                  "end-placeholder": unref(tt)('结束日期'),
                  style: {"width":"100%"}
                }, null, 8, ["modelValue", "range-separator", "start-placeholder", "end-placeholder"])
              ]))
            : createCommentVNode("", true),
          (reportMode.value)
            ? (openBlock(), createElementBlock("div", _hoisted_156, [
                createBaseVNode("label", null, toDisplayString(unref(tt)('模糊搜索')), 1),
                createVNode(_component_el_input, {
                  modelValue: reportKeyword.value,
                  "onUpdate:modelValue": _cache[76] || (_cache[76] = $event => ((reportKeyword).value = $event)),
                  clearable: "",
                  placeholder: unref(tt)('任意字段包含关键字'),
                  onKeyup: withKeys(applyHeaderQuery, ["enter"])
                }, null, 8, ["modelValue", "placeholder"])
              ]))
            : createCommentVNode("", true),
          (openBlock(true), createElementBlock(Fragment, null, renderList(queryDialogFields.value, (field) => {
            return (openBlock(), createElementBlock("div", {
              key: headerFieldKey(field),
              class: "query-dialog-field"
            }, [
              createBaseVNode("label", {
                class: normalizeClass({ 'req-label': rqdFieldRequired(field) })
              }, [
                createTextVNode(toDisplayString(headerFieldLabel(field)), 1),
                (rqdFieldRequired(field))
                  ? (openBlock(), createElementBlock("span", _hoisted_157, "*"))
                  : createCommentVNode("", true)
              ], 2),
              (isReferenceField(field) && refModeMap[headerFieldKey(field)] === 'select')
                ? (openBlock(), createBlock(_component_el_select, {
                    key: 0,
                    modelValue: queryDraft[headerFieldKey(field)],
                    "onUpdate:modelValue": $event => ((queryDraft[headerFieldKey(field)]) = $event),
                    clearable: "",
                    filterable: "",
                    remote: "",
                    "default-first-option": "",
                    "remote-method": (kw) => loadRefSelectOptions(field, headerFieldKey(field), kw),
                    loading: refSelectData[headerFieldKey(field)]?.loading,
                    placeholder: unref(tt)('输入搜索'),
                    style: {"width":"100%"},
                    onFocus: $event => (checkRefMode(field, headerFieldKey(field))),
                    onChange: $event => (onDialogRefSelectChange(field))
                  }, {
                    default: withCtx(() => [
                      (openBlock(true), createElementBlock(Fragment, null, renderList((refSelectData[headerFieldKey(field)]?.options || []), (o) => {
                        return (openBlock(), createBlock(_component_el_option, {
                          key: o.value,
                          label: o.label,
                          value: o.value,
                          disabled: ledgerOptionDisabled(field, o)
                        }, null, 8, ["label", "value", "disabled"]))
                      }), 128))
                    ]),
                    _: 2
                  }, 1032, ["modelValue", "onUpdate:modelValue", "remote-method", "loading", "placeholder", "onFocus", "onChange"]))
                : (isReferenceField(field))
                  ? (openBlock(), createElementBlock("div", _hoisted_158, [
                      createVNode(_component_el_input, {
                        "model-value": queryDraft[headerFieldKey(field)] ?? '',
                        readonly: "",
                        clearable: "",
                        placeholder: "请选择",
                        onClick: $event => (openQueryRef(field, 'dialog')),
                        onClear: $event => (clearQueryRef(field, 'dialog'))
                      }, null, 8, ["model-value", "onClick", "onClear"]),
                      createVNode(_component_el_button, {
                        icon: unref(search_default),
                        title: "打开参照",
                        onClick: $event => (openQueryRef(field, 'dialog'))
                      }, null, 8, ["icon", "onClick"])
                    ]))
                  : (isSelectField(field))
                    ? (openBlock(), createBlock(_component_el_select, {
                        key: 2,
                        modelValue: queryDraft[headerFieldKey(field)],
                        "onUpdate:modelValue": $event => ((queryDraft[headerFieldKey(field)]) = $event),
                        clearable: "",
                        filterable: "",
                        "allow-create": ""
                      }, {
                        default: withCtx(() => [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(fieldOptions(field), (option) => {
                            return (openBlock(), createBlock(_component_el_option, {
                              key: option.value,
                              label: option.label,
                              value: option.value
                            }, null, 8, ["label", "value"]))
                          }), 128))
                        ]),
                        _: 2
                      }, 1032, ["modelValue", "onUpdate:modelValue"]))
                    : (isDateField(field))
                      ? (openBlock(), createBlock(_component_el_date_picker, {
                          key: 3,
                          modelValue: queryDraft[headerFieldKey(field)],
                          "onUpdate:modelValue": $event => ((queryDraft[headerFieldKey(field)]) = $event),
                          type: "date",
                          "value-format": "YYYY-MM-DD"
                        }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                      : (isNumberField(field))
                        ? (openBlock(), createBlock(_component_el_input_number, {
                            key: 4,
                            modelValue: queryDraft[headerFieldKey(field)],
                            "onUpdate:modelValue": $event => ((queryDraft[headerFieldKey(field)]) = $event),
                            controls: false
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (isBooleanField(field))
                          ? (openBlock(), createBlock(_component_el_select, {
                              key: 5,
                              modelValue: queryDraft[headerFieldKey(field)],
                              "onUpdate:modelValue": $event => ((queryDraft[headerFieldKey(field)]) = $event),
                              clearable: ""
                            }, {
                              default: withCtx(() => [
                                createVNode(_component_el_option, {
                                  label: "是",
                                  value: true
                                }),
                                createVNode(_component_el_option, {
                                  label: "否",
                                  value: false
                                })
                              ]),
                              _: 1
                            }, 8, ["modelValue", "onUpdate:modelValue"]))
                          : (openBlock(), createBlock(_component_el_input, {
                              key: 6,
                              modelValue: queryDraft[headerFieldKey(field)],
                              "onUpdate:modelValue": $event => ((queryDraft[headerFieldKey(field)]) = $event),
                              clearable: "",
                              onKeyup: withKeys(applyHeaderQuery, ["enter"])
                            }, null, 8, ["modelValue", "onUpdate:modelValue"])),
              (dialogFieldHint(field))
                ? (openBlock(), createElementBlock("div", _hoisted_159, toDisplayString(dialogFieldHint(field)), 1))
                : createCommentVNode("", true)
            ]))
          }), 128))
        ]),
        (dateFieldLabel.value)
          ? (openBlock(), createElementBlock("div", _hoisted_160, [
              createBaseVNode("div", _hoisted_161, [
                createBaseVNode("span", _hoisted_162, toDisplayString(unref(tt)('日期范围')), 1),
                createBaseVNode("span", _hoisted_163, toDisplayString(unref(tt)(dateFieldLabel.value)), 1)
              ]),
              createBaseVNode("div", _hoisted_164, [
                createVNode(_component_el_date_picker, {
                  modelValue: dateFrom.value,
                  "onUpdate:modelValue": _cache[77] || (_cache[77] = $event => ((dateFrom).value = $event)),
                  type: "date",
                  "value-format": "YYYY-MM-DD",
                  size: "small",
                  placeholder: unref(tt)('起'),
                  style: {"width":"150px"}
                }, null, 8, ["modelValue", "placeholder"]),
                _cache[161] || (_cache[161] = createBaseVNode("span", { class: "adv-filter-dash" }, "-", -1)),
                createVNode(_component_el_date_picker, {
                  modelValue: dateTo.value,
                  "onUpdate:modelValue": _cache[78] || (_cache[78] = $event => ((dateTo).value = $event)),
                  type: "date",
                  "value-format": "YYYY-MM-DD",
                  size: "small",
                  placeholder: unref(tt)('止'),
                  style: {"width":"150px"}
                }, null, 8, ["modelValue", "placeholder"]),
                createVNode(_component_el_button, {
                  link: "",
                  type: "primary",
                  size: "small",
                  onClick: clearDateRange
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('清空')), 1)
                  ]),
                  _: 1
                })
              ])
            ]))
          : createCommentVNode("", true),
        createBaseVNode("div", _hoisted_165, [
          createBaseVNode("div", _hoisted_166, [
            createBaseVNode("span", _hoisted_167, toDisplayString(unref(tt)('高级筛选')), 1),
            createVNode(_component_el_button, {
              size: "small",
              text: "",
              type: "primary",
              icon: unref(plus_default),
              onClick: addAdvFilter
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(tt)('添加条件')), 1)
              ]),
              _: 1
            }, 8, ["icon"])
          ]),
          (openBlock(true), createElementBlock(Fragment, null, renderList(advFilters.value, (f, i) => {
            return (openBlock(), createElementBlock("div", {
              key: i,
              class: "adv-filter-row"
            }, [
              createVNode(_component_el_select, {
                modelValue: f.field,
                "onUpdate:modelValue": $event => ((f.field) = $event),
                filterable: "",
                placeholder: unref(tt)('字段'),
                class: "adv-field",
                size: "small"
              }, {
                default: withCtx(() => [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(advFilterFields.value, (fd) => {
                    return (openBlock(), createBlock(_component_el_option, {
                      key: fd,
                      label: unref(tt)(fd),
                      value: fd
                    }, null, 8, ["label", "value"]))
                  }), 128))
                ]),
                _: 1
              }, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]),
              createVNode(_component_el_select, {
                modelValue: f.op,
                "onUpdate:modelValue": $event => ((f.op) = $event),
                class: "adv-op",
                size: "small"
              }, {
                default: withCtx(() => [
                  (openBlock(), createElementBlock(Fragment, null, renderList(ADV_OPS, (op) => {
                    return createVNode(_component_el_option, {
                      key: op.value,
                      label: unref(tt)(op.label),
                      value: op.value
                    }, null, 8, ["label", "value"])
                  }), 64))
                ]),
                _: 1
              }, 8, ["modelValue", "onUpdate:modelValue"]),
              (f.op !== 'empty' && f.op !== 'notEmpty')
                ? (openBlock(), createBlock(_component_el_input, {
                    key: 0,
                    modelValue: f.value,
                    "onUpdate:modelValue": $event => ((f.value) = $event),
                    placeholder: unref(tt)('值'),
                    class: "adv-value",
                    size: "small",
                    clearable: "",
                    onKeyup: withKeys(applyHeaderQuery, ["enter"])
                  }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]))
                : (openBlock(), createElementBlock("span", _hoisted_168)),
              createVNode(_component_el_button, {
                link: "",
                type: "danger",
                size: "small",
                onClick: $event => (removeAdvFilter(i))
              }, {
                default: withCtx(() => [...(_cache[162] || (_cache[162] = [
                  createTextVNode("✕", -1)
                ]))]),
                _: 1
              }, 8, ["onClick"])
            ]))
          }), 128))
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: planManageVisible.value,
      "onUpdate:modelValue": _cache[81] || (_cache[81] = $event => ((planManageVisible).value = $event)),
      title: unref(tt)('方案维护'),
      width: "560px",
      "append-to-body": ""
    }, {
      default: withCtx(() => [
        (!queryPlans.value.length)
          ? (openBlock(), createElementBlock("div", _hoisted_169, toDisplayString(unref(tt)('暂无保存的查询方案')), 1))
          : createCommentVNode("", true),
        (openBlock(true), createElementBlock(Fragment, null, renderList(queryPlans.value, (p) => {
          return (openBlock(), createElementBlock("div", {
            key: p.name,
            class: "plan-row"
          }, [
            createBaseVNode("div", _hoisted_170, [
              createBaseVNode("div", _hoisted_171, toDisplayString(p.name), 1),
              createBaseVNode("div", _hoisted_172, toDisplayString(planSummary(p)) + " · " + toDisplayString(p.updatedAt), 1)
            ]),
            createBaseVNode("div", _hoisted_173, [
              createVNode(_component_el_button, {
                link: "",
                type: "primary",
                size: "small",
                onClick: $event => {applyPlan(p.name); planManageVisible.value = false;}
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('调用')), 1)
                ]),
                _: 1
              }, 8, ["onClick"]),
              createVNode(_component_el_button, {
                link: "",
                type: "primary",
                size: "small",
                onClick: $event => (updatePlan(p.name))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('更新')), 1)
                ]),
                _: 1
              }, 8, ["onClick"]),
              createVNode(_component_el_button, {
                link: "",
                size: "small",
                onClick: $event => (renamePlan(p.name))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('重命名')), 1)
                ]),
                _: 1
              }, 8, ["onClick"]),
              createVNode(_component_el_button, {
                link: "",
                type: "danger",
                size: "small",
                onClick: $event => (deletePlan(p.name))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('删除')), 1)
                ]),
                _: 1
              }, 8, ["onClick"])
            ])
          ]))
        }), 128))
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(NewVoucherDialog, {
      visible: newVisible.value,
      "onUpdate:visible": _cache[82] || (_cache[82] = $event => ((newVisible).value = $event)),
      panelCode: panelCode.value,
      "panel-name": panelName.value,
      onSaved: onNewSaved
    }, null, 8, ["visible", "panelCode", "panel-name"]),
    createVNode(ImportDialog, {
      modelValue: impVisible.value,
      "onUpdate:modelValue": _cache[83] || (_cache[83] = $event => ((impVisible).value = $event)),
      fields: impFields.value,
      "target-label": impLabel.value,
      onImported: onImported
    }, null, 8, ["modelValue", "fields", "target-label"]),
    createVNode(ApprovalHistoryDialog, {
      modelValue: approvalVisible.value,
      "onUpdate:modelValue": _cache[84] || (_cache[84] = $event => ((approvalVisible).value = $event)),
      panelCode: panelCode.value,
      formNo: approvalNo.value
    }, null, 8, ["modelValue", "panelCode", "formNo"]),
    createVNode(_component_el_dialog, {
      modelValue: dataSheetsVisible.value,
      "onUpdate:modelValue": _cache[87] || (_cache[87] = $event => ((dataSheetsVisible).value = $event)),
      title: unref(tt)('数据记录表单据') + ' · ' + dataSheetsCode.value,
      width: "1240px",
      top: "4vh",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[86] || (_cache[86] = $event => (dataSheetsVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        withDirectives((openBlock(), createElementBlock("div", null, [
          (!dataSheetsLoading.value && !dataSheetsRows.value.length)
            ? (openBlock(), createElementBlock("div", _hoisted_174, toDisplayString(unref(tt)('该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）')), 1))
            : (!dsActive.value)
              ? (openBlock(), createBlock(_component_el_table, {
                  key: 1,
                  data: dataSheetsRows.value,
                  size: "small",
                  border: "",
                  "max-height": "480",
                  "row-class-name": "ds-sel-row",
                  onRowClick: selectDataSheet
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_table_column, {
                      prop: "panelName",
                      label: unref(tt)('数据记录表'),
                      "min-width": "150"
                    }, null, 8, ["label"]),
                    createVNode(_component_el_table_column, {
                      prop: "docNo",
                      label: unref(tt)('单据编号'),
                      "min-width": "130"
                    }, null, 8, ["label"]),
                    createVNode(_component_el_table_column, {
                      prop: "docDate",
                      label: unref(tt)('单据日期'),
                      width: "110",
                      align: "center"
                    }, null, 8, ["label"]),
                    createVNode(_component_el_table_column, {
                      label: unref(tt)('单据状态'),
                      width: "120",
                      align: "center"
                    }, {
                      default: withCtx(({ row }) => [
                        createBaseVNode("span", {
                          class: normalizeClass(["doc-status", row.status])
                        }, toDisplayString(unref(tt)(row.status)), 3)
                      ]),
                      _: 1
                    }, 8, ["label"]),
                    createVNode(_component_el_table_column, {
                      label: unref(tt)('操作'),
                      width: "90",
                      align: "center"
                    }, {
                      default: withCtx(() => [
                        createBaseVNode("span", _hoisted_175, toDisplayString(unref(tt)('查看')) + " →", 1)
                      ]),
                      _: 1
                    }, 8, ["label"])
                  ]),
                  _: 1
                }, 8, ["data"]))
              : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                  createBaseVNode("div", _hoisted_176, [
                    createBaseVNode("span", {
                      class: "ds-back",
                      onClick: _cache[85] || (_cache[85] = $event => (dsActive.value = null))
                    }, "← " + toDisplayString(unref(tt)('返回列表')), 1),
                    (dataSheetsRows.value.length > 1)
                      ? (openBlock(), createElementBlock("span", _hoisted_177, [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(dataSheetsRows.value, (r) => {
                            return (openBlock(), createElementBlock("span", {
                              key: r.panelCode + r.docNo,
                              class: normalizeClass(["ds-pill", { on: dsActive.value.panelCode === r.panelCode && dsActive.value.docNo === r.docNo }]),
                              onClick: $event => (selectDataSheet(r))
                            }, toDisplayString(unref(tt)(r.panelName)) + " " + toDisplayString(r.docNo), 11, _hoisted_178))
                          }), 128))
                        ]))
                      : createCommentVNode("", true)
                  ]),
                  withDirectives((openBlock(), createElementBlock("div", _hoisted_179, [
                    (dsActive.value.doc && dsActive.value.panelCode === 'RD_FILTER_EFF')
                      ? (openBlock(), createBlock(DataRecordSheet, {
                          key: 0,
                          head: dsActive.value.doc,
                          fields: dsActive.value.headerFields,
                          editable: false
                        }, null, 8, ["head", "fields"]))
                      : (dsActive.value.doc)
                        ? (openBlock(), createBlock(RecordSheetPanels, {
                            key: 1,
                            head: dsActive.value.doc,
                            fields: dsActive.value.allFields,
                            editable: false,
                            "panel-code": dsActive.value.panelCode
                          }, null, 8, ["head", "fields", "panel-code"]))
                        : (openBlock(), createElementBlock("div", _hoisted_180, toDisplayString(unref(tt)('加载中…')), 1))
                  ])), [
                    [_directive_loading, dsActive.value.loading]
                  ])
                ], 64))
        ])), [
          [_directive_loading, dataSheetsLoading.value]
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: exportFmtVisible.value,
      "onUpdate:modelValue": _cache[89] || (_cache[89] = $event => ((exportFmtVisible).value = $event)),
      title: unref(tt)('选择导出格式'),
      width: "380px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[88] || (_cache[88] = $event => (exportFmtVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_181, [
          createBaseVNode("div", {
            class: "efmt-item",
            onClick: exportSheetPdf
          }, [
            _cache[163] || (_cache[163] = createBaseVNode("span", { class: "efmt-ico" }, "📄", -1)),
            createBaseVNode("div", _hoisted_182, [
              createBaseVNode("div", _hoisted_183, toDisplayString(unref(tt)('导出 PDF')), 1),
              createBaseVNode("div", _hoisted_184, toDisplayString(unref(tt)('按纸张实际尺寸单页生成，直接下载，无需打印机')), 1)
            ])
          ]),
          createBaseVNode("div", {
            class: "efmt-item",
            onClick: exportSheetExcel
          }, [
            _cache[164] || (_cache[164] = createBaseVNode("span", { class: "efmt-ico" }, "📊", -1)),
            createBaseVNode("div", _hoisted_185, [
              createBaseVNode("div", _hoisted_186, toDisplayString(unref(tt)('导出 Excel（.xlsx）')), 1),
              createBaseVNode("div", _hoisted_187, toDisplayString(unref(tt)('头字段键值 + 各明细页签全字段全数据，不受纸张限制')), 1)
            ])
          ])
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: reportVisible.value,
      "onUpdate:modelValue": _cache[94] || (_cache[94] = $event => ((reportVisible).value = $event)),
      title: unref(tt)('导出报表'),
      width: "460px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        (unref(user).isAdmin)
          ? (openBlock(), createBlock(_component_el_button, {
              key: 0,
              type: "primary",
              link: "",
              onClick: openManage
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(tt)('模板管理')), 1)
              ]),
              _: 1
            }))
          : createCommentVNode("", true),
        createVNode(_component_el_button, {
          onClick: _cache[93] || (_cache[93] = $event => (reportVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        (reportTemplates.value.length)
          ? (openBlock(), createElementBlock("div", _hoisted_188, [
              createBaseVNode("span", _hoisted_189, toDisplayString(unref(tt)('报表模板')), 1),
              createVNode(_component_el_select, {
                modelValue: selectedReportCode.value,
                "onUpdate:modelValue": _cache[90] || (_cache[90] = $event => ((selectedReportCode).value = $event)),
                size: "default",
                style: {"flex":"1"},
                placeholder: unref(tt)('选择报表模板')
              }, {
                default: withCtx(() => [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(reportTemplates.value, (t) => {
                    return (openBlock(), createBlock(_component_el_option, {
                      key: t.code,
                      label: t.name,
                      value: t.code
                    }, null, 8, ["label", "value"]))
                  }), 128))
                ]),
                _: 1
              }, 8, ["modelValue", "placeholder"])
            ]))
          : (openBlock(), createElementBlock("div", _hoisted_190, toDisplayString(unref(tt)('该面板暂无报表模板，可点下方「模板管理」上传')), 1)),
        createBaseVNode("div", _hoisted_191, [
          createBaseVNode("div", {
            class: "efmt-item",
            onClick: _cache[91] || (_cache[91] = $event => (downloadReport('pdf')))
          }, [
            _cache[165] || (_cache[165] = createBaseVNode("span", { class: "efmt-ico" }, "📄", -1)),
            createBaseVNode("div", _hoisted_192, [
              createBaseVNode("div", _hoisted_193, toDisplayString(unref(tt)('导出 PDF')), 1),
              createBaseVNode("div", _hoisted_194, toDisplayString(unref(tt)('服务端正式报表：含公司抬头、页眉页脚与页码')), 1)
            ])
          ]),
          createBaseVNode("div", {
            class: "efmt-item",
            onClick: previewServerReport
          }, [
            _cache[166] || (_cache[166] = createBaseVNode("span", { class: "efmt-ico" }, "🖨", -1)),
            createBaseVNode("div", _hoisted_195, [
              createBaseVNode("div", _hoisted_196, toDisplayString(unref(tt)('打印预览')), 1),
              createBaseVNode("div", _hoisted_197, toDisplayString(unref(tt)('在浏览器新窗口内打开 PDF，可直接打印')), 1)
            ])
          ]),
          createBaseVNode("div", {
            class: "efmt-item",
            onClick: _cache[92] || (_cache[92] = $event => (downloadReport('xlsx')))
          }, [
            _cache[167] || (_cache[167] = createBaseVNode("span", { class: "efmt-ico" }, "📊", -1)),
            createBaseVNode("div", _hoisted_198, [
              createBaseVNode("div", _hoisted_199, toDisplayString(unref(tt)('导出 Excel（.xlsx）')), 1),
              createBaseVNode("div", _hoisted_200, toDisplayString(unref(tt)('报表数据行 + 页眉信息，可在 Excel 里直接编辑')), 1)
            ])
          ])
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: manageVisible.value,
      "onUpdate:modelValue": _cache[97] || (_cache[97] = $event => ((manageVisible).value = $event)),
      title: unref(tt)('报表模板管理'),
      width: "780px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[96] || (_cache[96] = $event => (manageVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_201, [
          createVNode(_component_el_button, {
            type: "primary",
            size: "small",
            onClick: _cache[95] || (_cache[95] = $event => (uploadFormVisible.value = true))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('上传模板')), 1)
            ]),
            _: 1
          }),
          createBaseVNode("span", _hoisted_202, toDisplayString(unref(tt)('模板为 .jrxml（Jaspersoft Studio 制作）；字段中文名须与面板字段标签一致；上传即生效')), 1)
        ]),
        createVNode(_component_el_table, {
          data: manageList.value,
          size: "small",
          border: "",
          height: "320"
        }, {
          default: withCtx(() => [
            createVNode(_component_el_table_column, {
              prop: "code",
              label: unref(tt)('编码'),
              width: "140"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "name",
              label: unref(tt)('名称'),
              width: "140"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "panelCode",
              label: unref(tt)('绑定面板'),
              width: "150"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              label: unref(tt)('状态'),
              width: "70",
              align: "center"
            }, {
              default: withCtx(({ row }) => [
                createVNode(_component_el_tag, {
                  type: row.enabled ? 'success' : 'info',
                  size: "small"
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(row.enabled ? unref(tt)('启用') : unref(tt)('停用')), 1)
                  ]),
                  _: 2
                }, 1032, ["type"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "updateBy",
              label: unref(tt)('更新'),
              width: "130"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              label: unref(tt)('操作'),
              "min-width": "150"
            }, {
              default: withCtx(({ row }) => [
                createVNode(_component_el_button, {
                  size: "small",
                  link: "",
                  type: "primary",
                  onClick: $event => (previewTpl(row))
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('预览')), 1)
                  ]),
                  _: 1
                }, 8, ["onClick"]),
                createVNode(_component_el_button, {
                  size: "small",
                  link: "",
                  type: row.enabled ? 'warning' : 'success',
                  onClick: $event => (toggleTpl(row))
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(row.enabled ? unref(tt)('停用') : unref(tt)('启用')), 1)
                  ]),
                  _: 2
                }, 1032, ["type", "onClick"]),
                createVNode(_component_el_button, {
                  size: "small",
                  link: "",
                  type: "danger",
                  onClick: $event => (removeTpl(row))
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('删除')), 1)
                  ]),
                  _: 1
                }, 8, ["onClick"])
              ]),
              _: 1
            }, 8, ["label"])
          ]),
          _: 1
        }, 8, ["data"])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: uploadFormVisible.value,
      "onUpdate:modelValue": _cache[103] || (_cache[103] = $event => ((uploadFormVisible).value = $event)),
      title: unref(tt)('上传模板'),
      width: "520px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[102] || (_cache[102] = $event => (uploadFormVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: uploading.value,
          onClick: submitUpload
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('上传并启用')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_203, [
          createBaseVNode("span", _hoisted_204, toDisplayString(unref(tt)('模板文件')), 1),
          createBaseVNode("input", {
            ref: "rptFileRef",
            type: "file",
            accept: ".jrxml,.xml",
            onChange: onRptFile
          }, null, 544)
        ]),
        createBaseVNode("div", _hoisted_205, [
          createBaseVNode("span", _hoisted_206, toDisplayString(unref(tt)('模板编码')), 1),
          createVNode(_component_el_input, {
            modelValue: uploadForm.value.templateCode,
            "onUpdate:modelValue": _cache[98] || (_cache[98] = $event => ((uploadForm.value.templateCode) = $event)),
            size: "small",
            style: {"width":"260px"},
            placeholder: "小写字母/数字/下划线,如 so_order"
          }, null, 8, ["modelValue"])
        ]),
        createBaseVNode("div", _hoisted_207, [
          createBaseVNode("span", _hoisted_208, toDisplayString(unref(tt)('报表名称')), 1),
          createVNode(_component_el_input, {
            modelValue: uploadForm.value.name,
            "onUpdate:modelValue": _cache[99] || (_cache[99] = $event => ((uploadForm.value.name) = $event)),
            size: "small",
            style: {"width":"260px"}
          }, null, 8, ["modelValue"])
        ]),
        createBaseVNode("div", _hoisted_209, [
          createBaseVNode("span", _hoisted_210, toDisplayString(unref(tt)('绑定面板')), 1),
          createVNode(_component_el_input, {
            modelValue: uploadForm.value.panelCode,
            "onUpdate:modelValue": _cache[100] || (_cache[100] = $event => ((uploadForm.value.panelCode) = $event)),
            size: "small",
            style: {"width":"260px"}
          }, null, 8, ["modelValue"])
        ]),
        createBaseVNode("div", _hoisted_211, [
          createBaseVNode("span", _hoisted_212, toDisplayString(unref(tt)('备注')), 1),
          createVNode(_component_el_input, {
            modelValue: uploadForm.value.remark,
            "onUpdate:modelValue": _cache[101] || (_cache[101] = $event => ((uploadForm.value.remark) = $event)),
            size: "small",
            style: {"width":"260px"}
          }, null, 8, ["modelValue"])
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: modifyLogVisible.value,
      "onUpdate:modelValue": _cache[104] || (_cache[104] = $event => ((modifyLogVisible).value = $event)),
      title: unref(tt)('修改记录') + ' · ' + modifyLogNo.value,
      width: "720px",
      "append-to-body": ""
    }, {
      default: withCtx(() => [
        (!modifyLogRecords.value.length)
          ? (openBlock(), createElementBlock("div", _hoisted_213, toDisplayString(unref(tt)('暂无修改记录')), 1))
          : (openBlock(), createElementBlock("div", _hoisted_214, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(modifyLogRecords.value, (r, ri) => {
                return (openBlock(), createElementBlock("div", {
                  key: ri,
                  class: "mod-log-card"
                }, [
                  (!r.rearchiveAt)
                    ? (openBlock(), createElementBlock("div", _hoisted_215, toDisplayString(unref(tt)('修改进行中——内容随保存实时更新，再归档审批后定格')), 1))
                    : createCommentVNode("", true),
                  createBaseVNode("div", _hoisted_216, [
                    createBaseVNode("span", _hoisted_217, toDisplayString(unref(tt)('第')) + " " + toDisplayString(modifyLogRecords.value.length - ri) + " " + toDisplayString(unref(tt)('次修改')), 1),
                    createBaseVNode("span", null, toDisplayString(unref(tt)('申请')) + "：" + toDisplayString(r.applyBy || '-') + " " + toDisplayString(r.applyAt || ''), 1),
                    createBaseVNode("span", null, toDisplayString(unref(tt)('修改审批')) + "：" + toDisplayString(r.approveBy || '-') + " " + toDisplayString(r.approveAt || ''), 1),
                    createBaseVNode("span", null, toDisplayString(unref(tt)('再归档')) + "：" + toDisplayString(r.rearchiveBy || '-') + " " + toDisplayString(r.rearchiveAt || unref(tt)('未归档')), 1)
                  ]),
                  (r.reason)
                    ? (openBlock(), createElementBlock("div", _hoisted_218, toDisplayString(unref(tt)('修改原因')) + "：" + toDisplayString(r.reason), 1))
                    : createCommentVNode("", true),
                  ((r.changes || []).length)
                    ? (openBlock(), createElementBlock("table", _hoisted_219, [
                        createBaseVNode("thead", null, [
                          createBaseVNode("tr", null, [
                            createBaseVNode("th", _hoisted_220, toDisplayString(unref(tt)('类型')), 1),
                            createBaseVNode("th", _hoisted_221, toDisplayString(unref(tt)('字段')), 1),
                            createBaseVNode("th", null, toDisplayString(unref(tt)('原内容')), 1),
                            createBaseVNode("th", null, toDisplayString(unref(tt)('新内容')), 1)
                          ])
                        ]),
                        createBaseVNode("tbody", null, [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(r.changes, (c, ci) => {
                            return (openBlock(), createElementBlock("tr", { key: ci }, [
                              createBaseVNode("td", null, [
                                createBaseVNode("span", {
                                  class: normalizeClass(["mod-kind", String(c.kind)])
                                }, toDisplayString(unref(tt)(String(c.kind))), 3)
                              ]),
                              createBaseVNode("td", null, toDisplayString(c.label), 1),
                              createBaseVNode("td", _hoisted_222, toDisplayString(c.old || '—'), 1),
                              createBaseVNode("td", _hoisted_223, toDisplayString(c.new || '—'), 1)
                            ]))
                          }), 128))
                        ])
                      ]))
                    : (openBlock(), createElementBlock("div", _hoisted_224, toDisplayString(unref(tt)('本次修改未变更头字段')), 1)),
                  (r.changeMeta && (r.changeMeta.addedRows || r.changeMeta.removedRows || r.changeMeta.changedRows))
                    ? (openBlock(), createElementBlock("div", _hoisted_225, [
                        createTextVNode(toDisplayString(unref(tt)('明细变化')) + "：" + toDisplayString(unref(tt)('新增')) + " " + toDisplayString(r.changeMeta.addedRows || 0) + " " + toDisplayString(unref(tt)('行')) + " / " + toDisplayString(unref(tt)('删除')) + " " + toDisplayString(r.changeMeta.removedRows || 0) + " " + toDisplayString(unref(tt)('行')) + " / " + toDisplayString(unref(tt)('修改')) + " " + toDisplayString(r.changeMeta.changedRows || 0) + " " + toDisplayString(unref(tt)('行')) + " ", 1),
                        ((r.changeMeta.addedSamples || []).length)
                          ? (openBlock(), createElementBlock("span", _hoisted_226, "（" + toDisplayString(unref(tt)('新增')) + "：" + toDisplayString(r.changeMeta.addedSamples.join('、')) + toDisplayString((r.changeMeta.addedRows || 0) > (r.changeMeta.addedSamples || []).length ? ' …' : '') + "）", 1))
                          : createCommentVNode("", true),
                        ((r.changeMeta.removedSamples || []).length)
                          ? (openBlock(), createElementBlock("span", _hoisted_227, "（" + toDisplayString(unref(tt)('删除')) + "：" + toDisplayString(r.changeMeta.removedSamples.join('、')) + toDisplayString((r.changeMeta.removedRows || 0) > (r.changeMeta.removedSamples || []).length ? ' …' : '') + "）", 1))
                          : createCommentVNode("", true)
                      ]))
                    : createCommentVNode("", true)
                ]))
              }), 128))
            ]))
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: specAssignVisible.value,
      "onUpdate:modelValue": _cache[107] || (_cache[107] = $event => ((specAssignVisible).value = $event)),
      title: unref(tt)('规格书分发') + (specAssignStateData.value?.productName ? ' · ' + specAssignStateData.value.productName : ''),
      width: "640px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[106] || (_cache[106] = $event => (specAssignVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: specAssignBusy.value,
          onClick: submitSpecAssign
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('分发')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_228, [
          createBaseVNode("div", _hoisted_229, [
            createBaseVNode("span", _hoisted_230, toDisplayString(unref(tt)('总负责人')), 1),
            createBaseVNode("span", null, toDisplayString(specAssignStateData.value?.supervisorName || specAssignStateData.value?.supervisor || unref(tt)('产品信息表「责任人」未匹配到启用账号，任务挂起')), 1)
          ]),
          ((specAssignStateData.value?.assigns || []).length)
            ? (openBlock(), createElementBlock("div", _hoisted_231, toDisplayString(unref(tt)('已分发规格书')) + "：" + toDisplayString(specAssignStateData.value.assigns.length) + " " + toDisplayString(unref(tt)('张')), 1))
            : createCommentVNode("", true),
          ((specAssignStateData.value?.assigns || []).length)
            ? (openBlock(), createElementBlock("table", _hoisted_232, [
                createBaseVNode("thead", null, [
                  createBaseVNode("tr", null, [
                    createBaseVNode("th", null, toDisplayString(unref(tt)('单据编号')), 1),
                    createBaseVNode("th", null, toDisplayString(unref(tt)('规格书种类')), 1),
                    createBaseVNode("th", null, toDisplayString(unref(tt)('责任人')), 1),
                    createBaseVNode("th", _hoisted_233, toDisplayString(unref(tt)('单据状态')), 1)
                  ])
                ]),
                createBaseVNode("tbody", null, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(specAssignStateData.value.assigns, (a) => {
                    return (openBlock(), createElementBlock("tr", {
                      key: a['单据编号']
                    }, [
                      createBaseVNode("td", null, toDisplayString(a['单据编号']), 1),
                      createBaseVNode("td", null, toDisplayString(a['规格书种类']), 1),
                      createBaseVNode("td", null, toDisplayString(a.ownerName || a['责任人']), 1),
                      createBaseVNode("td", null, toDisplayString(unref(tt)(String(a.status))), 1)
                    ]))
                  }), 128))
                ])
              ]))
            : createCommentVNode("", true),
          (openBlock(true), createElementBlock(Fragment, null, renderList(specAssignRows.value, (row, ri) => {
            return (openBlock(), createElementBlock("div", {
              key: ri,
              class: "dq-row",
              style: {"align-items":"center"}
            }, [
              createBaseVNode("span", _hoisted_234, toDisplayString(unref(tt)('新增分发')), 1),
              createVNode(_component_el_select, {
                modelValue: row['编号'],
                "onUpdate:modelValue": $event => ((row['编号']) = $event),
                style: {"flex":"1"},
                filterable: "",
                placeholder: unref(tt)('请选择规格书单据')
              }, {
                default: withCtx(() => [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(specDocsAvail.value, (d) => {
                    return (openBlock(), createBlock(_component_el_option, {
                      key: d['单据编号'],
                      label: specDocLabel(d),
                      value: d['单据编号']
                    }, null, 8, ["label", "value"]))
                  }), 128))
                ]),
                _: 1
              }, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]),
              createVNode(_component_el_select, {
                modelValue: row['责任人'],
                "onUpdate:modelValue": $event => ((row['责任人']) = $event),
                style: {"flex":"1"},
                filterable: "",
                placeholder: unref(tt)('请选择责任人')
              }, {
                default: withCtx(() => [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(specAssignUsers.value, (u) => {
                    return (openBlock(), createBlock(_component_el_option, {
                      key: u.userName,
                      label: `${u.realName}（${u.userName}）`,
                      value: u.userName
                    }, null, 8, ["label", "value"]))
                  }), 128))
                ]),
                _: 1
              }, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]),
              createBaseVNode("span", {
                style: {"cursor":"pointer","color":"#f56c6c","padding":"0 4px"},
                onClick: $event => (specAssignRows.value.splice(ri, 1))
              }, "×", 8, _hoisted_235)
            ]))
          }), 128)),
          (specDocsAvail.value.length)
            ? (openBlock(), createElementBlock("div", {
                key: 2,
                class: "as-side-btn",
                style: {"display":"inline-block"},
                onClick: _cache[105] || (_cache[105] = $event => (specAssignRows.value.push({ '编号': '', '责任人': '' })))
              }, "+ " + toDisplayString(unref(tt)('新增分发')), 1))
            : (openBlock(), createElementBlock("div", _hoisted_236, toDisplayString(unref(tt)('该产品暂无可分发的规格书单据')), 1))
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: devAssignVisible.value,
      "onUpdate:modelValue": _cache[109] || (_cache[109] = $event => ((devAssignVisible).value = $event)),
      title: unref(tt)('分发责任人') + (devDispatch.productCode ? ' · ' + devDispatch.productCode : ''),
      width: "620px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[108] || (_cache[108] = $event => (devAssignVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: devAssignBusy.value,
          onClick: confirmDevAssign
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('分发')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_237, [
          createBaseVNode("div", _hoisted_238, toDisplayString(unref(tt)('为四个下游文件各指定一个责任人；分发后这四个文件同时对该责任人开放编辑（互不依赖）。')), 1),
          (openBlock(true), createElementBlock(Fragment, null, renderList(devAssignRows.value, (row) => {
            return (openBlock(), createElementBlock("div", {
              key: row.panel,
              class: "dq-row",
              style: {"align-items":"center"}
            }, [
              createBaseVNode("span", _hoisted_239, toDisplayString(unref(tt)(row.label)), 1),
              createVNode(_component_el_select, {
                modelValue: row.owner,
                "onUpdate:modelValue": $event => ((row.owner) = $event),
                style: {"flex":"1"},
                filterable: "",
                clearable: "",
                placeholder: unref(tt)('请选择责任人（留空=挂起）')
              }, {
                default: withCtx(() => [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(devAssignUsers.value, (u) => {
                    return (openBlock(), createBlock(_component_el_option, {
                      key: u.username,
                      label: `${u.realName}（${u.username}）`,
                      value: u.username
                    }, null, 8, ["label", "value"]))
                  }), 128))
                ]),
                _: 1
              }, 8, ["modelValue", "onUpdate:modelValue", "placeholder"])
            ]))
          }), 128)),
          createBaseVNode("div", _hoisted_240, toDisplayString(unref(tt)('二级审核人')) + "：" + toDisplayString(devDispatch.l2Approver || unref(tt)('（未选，历史单由有编辑权的人分发）')), 1)
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: l2PickVisible.value,
      "onUpdate:modelValue": _cache[113] || (_cache[113] = $event => ((l2PickVisible).value = $event)),
      title: unref(tt)('选取二级审核人'),
      width: "460px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[112] || (_cache[112] = $event => (l2PickVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: l2PickBusy.value,
          onClick: confirmL2Pick
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('确认审批通过')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_241, [
          createBaseVNode("div", _hoisted_242, toDisplayString(unref(tt)('一级审批通过后，由该审核人完成二级签核；二级通过即归档，随后由其分发责任人。')), 1),
          createBaseVNode("div", _hoisted_243, [
            createBaseVNode("span", _hoisted_244, toDisplayString(unref(tt)('二级审核人')), 1),
            createVNode(_component_el_select, {
              modelValue: l2PickUser.value,
              "onUpdate:modelValue": _cache[110] || (_cache[110] = $event => ((l2PickUser).value = $event)),
              style: {"flex":"1"},
              filterable: "",
              placeholder: unref(tt)('请选择二级审核人')
            }, {
              default: withCtx(() => [
                (openBlock(true), createElementBlock(Fragment, null, renderList(l2PickUsers.value, (u) => {
                  return (openBlock(), createBlock(_component_el_option, {
                    key: u.username,
                    label: `${u.realName}（${u.username}）`,
                    value: u.username
                  }, null, 8, ["label", "value"]))
                }), 128))
              ]),
              _: 1
            }, 8, ["modelValue", "placeholder"])
          ]),
          createBaseVNode("div", _hoisted_245, [
            createBaseVNode("span", _hoisted_246, toDisplayString(unref(tt)('审批意见')), 1),
            createVNode(_component_el_input, {
              modelValue: l2PickOpinion.value,
              "onUpdate:modelValue": _cache[111] || (_cache[111] = $event => ((l2PickOpinion).value = $event)),
              type: "textarea",
              rows: 3,
              placeholder: unref(tt)('审批意见（选填）')
            }, null, 8, ["modelValue", "placeholder"])
          ])
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: gradeVisible.value,
      "onUpdate:modelValue": _cache[117] || (_cache[117] = $event => ((gradeVisible).value = $event)),
      title: unref(tt)('项目定级'),
      width: "460px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[116] || (_cache[116] = $event => (gradeVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: gradeBusy.value,
          onClick: confirmGrade
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('确定定级')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_247, [
          createBaseVNode("div", _hoisted_248, toDisplayString(unref(tt)('等级作为后续立项（实施计划）与进度流程的属性，会随「文档编号」参照自动带到下游。')), 1),
          createBaseVNode("div", _hoisted_249, [
            createBaseVNode("span", _hoisted_250, toDisplayString(unref(tt)('项目等级')), 1),
            createVNode(_component_el_radio_group, {
              modelValue: gradeLevel.value,
              "onUpdate:modelValue": _cache[114] || (_cache[114] = $event => ((gradeLevel).value = $event))
            }, {
              default: withCtx(() => [
                (openBlock(true), createElementBlock(Fragment, null, renderList(gradeOptions.value, (lv) => {
                  return (openBlock(), createBlock(_component_el_radio_button, {
                    key: lv,
                    value: lv
                  }, {
                    default: withCtx(() => [
                      createTextVNode(toDisplayString(unref(tt)(lv)), 1)
                    ]),
                    _: 2
                  }, 1032, ["value"]))
                }), 128))
              ]),
              _: 1
            }, 8, ["modelValue"])
          ]),
          createBaseVNode("div", _hoisted_251, [
            createBaseVNode("span", _hoisted_252, toDisplayString(unref(tt)('定级说明')), 1),
            createVNode(_component_el_input, {
              modelValue: gradeOpinion.value,
              "onUpdate:modelValue": _cache[115] || (_cache[115] = $event => ((gradeOpinion).value = $event)),
              type: "textarea",
              rows: 3,
              placeholder: unref(tt)('定级说明（选填）')
            }, null, 8, ["modelValue", "placeholder"])
          ])
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: docQueryVisible.value,
      "onUpdate:modelValue": _cache[120] || (_cache[120] = $event => ((docQueryVisible).value = $event)),
      title: unref(tt)(isProdDocMatrix.value ? '查询产品' : '查询单据'),
      width: "480px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, { onClick: clearDocQuery }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('清空')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: applyDocQuery
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('查询')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_253, [
          createBaseVNode("div", _hoisted_254, [
            createBaseVNode("span", _hoisted_255, toDisplayString(unref(tt)(isProdDocMatrix.value ? '产品编号' : '编号')), 1),
            createVNode(_component_el_input, {
              modelValue: docQueryNo.value,
              "onUpdate:modelValue": _cache[118] || (_cache[118] = $event => ((docQueryNo).value = $event)),
              clearable: "",
              placeholder: unref(tt)(isProdDocMatrix.value ? '产品编号模糊匹配（筛选下方产品行）' : '单据编号/文档编号模糊匹配'),
              onKeyup: withKeys(applyDocQuery, ["enter"])
            }, null, 8, ["modelValue", "placeholder"])
          ]),
          (!isProdDocMatrix.value)
            ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                createBaseVNode("div", _hoisted_256, [
                  createBaseVNode("span", _hoisted_257, toDisplayString(unref(tt)('归档时间')), 1),
                  createVNode(_component_el_date_picker, {
                    modelValue: docQueryRange.value,
                    "onUpdate:modelValue": _cache[119] || (_cache[119] = $event => ((docQueryRange).value = $event)),
                    type: "daterange",
                    "value-format": "YYYY-MM-DD",
                    "start-placeholder": unref(tt)('起'),
                    "end-placeholder": unref(tt)('止'),
                    style: {"width":"100%"}
                  }, null, 8, ["modelValue", "start-placeholder", "end-placeholder"])
                ]),
                createBaseVNode("div", _hoisted_258, toDisplayString(unref(tt)('按首次归档时间过滤；草稿未归档不计入区间')), 1)
              ], 64))
            : (openBlock(), createElementBlock("div", _hoisted_259, toDisplayString(unref(tt)('本面板是产品文件矩阵（库里只有 1 张单据）：按产品编号筛选表格里的产品行')), 1))
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: stockAddVisible.value,
      "onUpdate:modelValue": _cache[128] || (_cache[128] = $event => ((stockAddVisible).value = $event)),
      title: unref(tt)('新增库存'),
      width: "460px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[127] || (_cache[127] = $event => (stockAddVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: stockAdding.value,
          onClick: submitStockAdd
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('确定')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_260, [
          createBaseVNode("div", _hoisted_261, [
            createBaseVNode("span", _hoisted_262, toDisplayString(unref(tt)('存货编码')), 1),
            createVNode(_component_el_input, {
              modelValue: stockAddForm['存货编码'],
              "onUpdate:modelValue": _cache[121] || (_cache[121] = $event => ((stockAddForm['存货编码']) = $event)),
              placeholder: unref(tt)('基础档案·存货中的编码，如 CL001')
            }, null, 8, ["modelValue", "placeholder"])
          ]),
          createBaseVNode("div", _hoisted_263, [
            createBaseVNode("span", _hoisted_264, toDisplayString(unref(tt)('仓库')), 1),
            createVNode(_component_el_select, {
              modelValue: stockAddForm['仓库'],
              "onUpdate:modelValue": _cache[122] || (_cache[122] = $event => ((stockAddForm['仓库']) = $event)),
              style: {"width":"100%"},
              filterable: "",
              placeholder: unref(tt)('选择仓库（基础档案·仓库）')
            }, {
              default: withCtx(() => [
                (openBlock(true), createElementBlock(Fragment, null, renderList(warehouseOptions.value, (w) => {
                  return (openBlock(), createBlock(_component_el_option, {
                    key: w.code,
                    label: `${w.name}（${w.code}）`,
                    value: w.code
                  }, null, 8, ["label", "value"]))
                }), 128))
              ]),
              _: 1
            }, 8, ["modelValue", "placeholder"])
          ]),
          createBaseVNode("div", _hoisted_265, [
            createBaseVNode("span", _hoisted_266, toDisplayString(unref(tt)('批号')), 1),
            createVNode(_component_el_input, {
              modelValue: stockAddForm['批号'],
              "onUpdate:modelValue": _cache[123] || (_cache[123] = $event => ((stockAddForm['批号']) = $event)),
              placeholder: unref(tt)('可留空')
            }, null, 8, ["modelValue", "placeholder"])
          ]),
          createBaseVNode("div", _hoisted_267, [
            createBaseVNode("span", _hoisted_268, toDisplayString(unref(tt)('入库日期')), 1),
            createVNode(_component_el_date_picker, {
              modelValue: stockAddForm['入库日期'],
              "onUpdate:modelValue": _cache[124] || (_cache[124] = $event => ((stockAddForm['入库日期']) = $event)),
              type: "date",
              "value-format": "YYYY-MM-DD",
              style: {"width":"100%"}
            }, null, 8, ["modelValue"])
          ]),
          createBaseVNode("div", _hoisted_269, [
            createBaseVNode("span", _hoisted_270, toDisplayString(unref(tt)('现存量')), 1),
            createVNode(_component_el_input_number, {
              modelValue: stockAddForm['现存量'],
              "onUpdate:modelValue": _cache[125] || (_cache[125] = $event => ((stockAddForm['现存量']) = $event)),
              min: 0,
              precision: 2,
              style: {"width":"100%"}
            }, null, 8, ["modelValue"])
          ]),
          createBaseVNode("div", _hoisted_271, [
            createBaseVNode("span", _hoisted_272, toDisplayString(unref(tt)('预警数量')), 1),
            createVNode(_component_el_input_number, {
              modelValue: stockAddForm['预警数量'],
              "onUpdate:modelValue": _cache[126] || (_cache[126] = $event => ((stockAddForm['预警数量']) = $event)),
              min: 0,
              precision: 0,
              style: {"width":"100%"},
              placeholder: unref(tt)('留空使用默认阈值50')
            }, null, 8, ["modelValue", "placeholder"])
          ])
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(SelectVoucherDialog, {
      modelValue: selVisible.value,
      "onUpdate:modelValue": _cache[129] || (_cache[129] = $event => ((selVisible).value = $event)),
      panelCode: panelCode.value,
      config: selCfg.value,
      onGenerated: onSelGenerated
    }, null, 8, ["modelValue", "panelCode", "config"]),
    createVNode(QrLabelDialog, {
      modelValue: qrVisible.value,
      "onUpdate:modelValue": _cache[130] || (_cache[130] = $event => ((qrVisible).value = $event)),
      labels: qrLabels.value
    }, null, 8, ["modelValue", "labels"]),
    createVNode(MaterialLabelDialog, {
      modelValue: materialLabelVisible.value,
      "onUpdate:modelValue": _cache[131] || (_cache[131] = $event => ((materialLabelVisible).value = $event)),
      "order-no": materialLabelNo.value,
      onPrinted: onMaterialLabelPrinted
    }, null, 8, ["modelValue", "order-no"]),
    createVNode(_component_el_dialog, {
      modelValue: moSchVisible.value,
      "onUpdate:modelValue": _cache[137] || (_cache[137] = $event => ((moSchVisible).value = $event)),
      title: unref(tt)('排产'),
      width: "420px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[136] || (_cache[136] = $event => (moSchVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: submitPanelSchedule
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('确认排产')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_273, [
          createTextVNode(toDisplayString(unref(tt)('工单号')) + ":", 1),
          createBaseVNode("b", null, toDisplayString(moSchNo.value), 1)
        ]),
        createBaseVNode("div", _hoisted_274, [
          createTextVNode(toDisplayString(unref(tt)('生产线')) + " ", 1),
          createVNode(_component_el_select, {
            modelValue: moSchLine.value,
            "onUpdate:modelValue": _cache[132] || (_cache[132] = $event => ((moSchLine).value = $event)),
            filterable: "",
            style: {"width":"240px"},
            placeholder: unref(tt)('选择生产线')
          }, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(moSchLines.value, (l) => {
                return (openBlock(), createBlock(_component_el_option, {
                  key: l['生产线'],
                  value: l['生产线'],
                  label: `${l['生产线']} · ${unref(tt)('今日负荷')}${l['今日负荷'] ?? 0}/${unref(tt)('日产能')}${l['日产能'] ?? 0}`
                }, null, 8, ["value", "label"]))
              }), 128))
            ]),
            _: 1
          }, 8, ["modelValue", "placeholder"])
        ]),
        createBaseVNode("div", _hoisted_275, [
          createTextVNode(toDisplayString(unref(tt)('预开工日')) + " ", 1),
          createVNode(_component_el_date_picker, {
            modelValue: moSchStart.value,
            "onUpdate:modelValue": _cache[133] || (_cache[133] = $event => ((moSchStart).value = $event)),
            type: "date",
            "value-format": "YYYY-MM-DD",
            style: {"width":"150px"}
          }, null, 8, ["modelValue"])
        ]),
        createBaseVNode("div", _hoisted_276, [
          createTextVNode(toDisplayString(unref(tt)('预完工日')) + " ", 1),
          createVNode(_component_el_date_picker, {
            modelValue: moSchEnd.value,
            "onUpdate:modelValue": _cache[134] || (_cache[134] = $event => ((moSchEnd).value = $event)),
            type: "date",
            "value-format": "YYYY-MM-DD",
            style: {"width":"150px"}
          }, null, 8, ["modelValue"])
        ]),
        createBaseVNode("div", _hoisted_277, [
          createTextVNode(toDisplayString(unref(tt)('排产数量')) + "（" + toDisplayString(unref(tt)('空=全排')) + "） ", 1),
          createVNode(_component_el_input_number, {
            modelValue: moSchQty.value,
            "onUpdate:modelValue": _cache[135] || (_cache[135] = $event => ((moSchQty).value = $event)),
            min: 0,
            controls: false,
            style: {"width":"130px"}
          }, null, 8, ["modelValue"])
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(DetailMaintainDialog, {
      modelValue: maintainVisible.value,
      "onUpdate:modelValue": _cache[138] || (_cache[138] = $event => ((maintainVisible).value = $event)),
      "panel-code": panelCode.value,
      row: maintainRow.value,
      onSaved: onMaintainSaved
    }, null, 8, ["modelValue", "panel-code", "row"]),
    createVNode(FieldManagerDialog, {
      modelValue: fieldMgrVisible.value,
      "onUpdate:modelValue": _cache[139] || (_cache[139] = $event => ((fieldMgrVisible).value = $event)),
      "panel-code": panelCode.value,
      onDone: _cache[140] || (_cache[140] = $event => {cfgCache.value = null; load();})
    }, null, 8, ["modelValue", "panel-code"]),
    createVNode(ScanFillDialog, {
      modelValue: scanVisible.value,
      "onUpdate:modelValue": _cache[141] || (_cache[141] = $event => ((scanVisible).value = $event)),
      "panel-code": panelCode.value,
      "panel-name": panelName.value,
      "header-fields": headerFields.value,
      "detail-tabs": cfgCache.value?.detail?.tabs || [],
      onApply: onScanApply
    }, null, 8, ["modelValue", "panel-code", "panel-name", "header-fields", "detail-tabs"]),
    createVNode(_component_el_dialog, {
      modelValue: colPrefVisible.value,
      "onUpdate:modelValue": _cache[144] || (_cache[144] = $event => ((colPrefVisible).value = $event)),
      title: "表格调整",
      width: "520px",
      "append-to-body": "",
      "close-on-click-modal": false
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          size: "small",
          onClick: _cache[143] || (_cache[143] = $event => (colPrefVisible.value = false))
        }, {
          default: withCtx(() => [...(_cache[172] || (_cache[172] = [
            createTextVNode("取消", -1)
          ]))]),
          _: 1
        }),
        createVNode(_component_el_button, {
          size: "small",
          onClick: resetColPrefs
        }, {
          default: withCtx(() => [...(_cache[173] || (_cache[173] = [
            createTextVNode("恢复默认", -1)
          ]))]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          size: "small",
          loading: colPrefSaving.value,
          onClick: saveColPrefs
        }, {
          default: withCtx(() => [...(_cache[174] || (_cache[174] = [
            createTextVNode("保存", -1)
          ]))]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_278, [
          _cache[168] || (_cache[168] = createTextVNode("拖动或用箭头调整列顺序;勾选=显示;栏名可改。 ", -1)),
          createBaseVNode("span", _hoisted_279, "总 " + toDisplayString(colPrefRows.value.length) + " 列 / 显示 " + toDisplayString(colPrefRows.value.filter(r => r.visible).length), 1)
        ]),
        createBaseVNode("div", _hoisted_280, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(colPrefRows.value, (item, idx) => {
            return (openBlock(), createElementBlock("div", {
              key: item.label,
              class: "col-pref-row",
              draggable: "true",
              onDragstart: $event => (colDragIdx.value = idx),
              onDragover: _cache[142] || (_cache[142] = withModifiers(() => {}, ["prevent"])),
              onDrop: $event => (onColDrop(idx))
            }, [
              _cache[171] || (_cache[171] = createBaseVNode("div", {
                class: "cp-drag",
                title: "拖动排序"
              }, "⋮⋮", -1)),
              createBaseVNode("div", _hoisted_282, [
                createVNode(_component_el_button, {
                  link: "",
                  size: "small",
                  disabled: idx === 0,
                  onClick: $event => (moveCol(idx, -1))
                }, {
                  default: withCtx(() => [...(_cache[169] || (_cache[169] = [
                    createTextVNode("▲", -1)
                  ]))]),
                  _: 1
                }, 8, ["disabled", "onClick"]),
                createVNode(_component_el_button, {
                  link: "",
                  size: "small",
                  disabled: idx === colPrefRows.value.length - 1,
                  onClick: $event => (moveCol(idx, 1))
                }, {
                  default: withCtx(() => [...(_cache[170] || (_cache[170] = [
                    createTextVNode("▼", -1)
                  ]))]),
                  _: 1
                }, 8, ["disabled", "onClick"])
              ]),
              createVNode(_component_el_checkbox, {
                modelValue: item.visible,
                "onUpdate:modelValue": $event => ((item.visible) = $event),
                class: "cp-vis"
              }, null, 8, ["modelValue", "onUpdate:modelValue"]),
              createBaseVNode("div", _hoisted_283, toDisplayString(item.label), 1),
              createVNode(_component_el_input, {
                modelValue: item.alias,
                "onUpdate:modelValue": $event => ((item.alias) = $event),
                class: "cp-alias",
                size: "small",
                placeholder: item.label,
                clearable: ""
              }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"])
            ], 40, _hoisted_281))
          }), 128))
        ])
      ]),
      _: 1
    }, 8, ["modelValue"]),
    createVNode(_component_el_dialog, {
      modelValue: batchErpVisible.value,
      "onUpdate:modelValue": _cache[147] || (_cache[147] = $event => ((batchErpVisible).value = $event)),
      title: unref(tt)('批量转ERP'),
      width: "600px",
      "append-to-body": "",
      "close-on-click-modal": false
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          size: "small",
          onClick: _cache[146] || (_cache[146] = $event => (batchErpVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          size: "small",
          loading: batchErpLoading.value,
          disabled: !batchErpSel.value.length,
          onClick: doBatchErp
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('开始转ERP')) + " (" + toDisplayString(batchErpSel.value.length) + ") ", 1)
          ]),
          _: 1
        }, 8, ["loading", "disabled"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_284, toDisplayString(unref(tt)('以下为已审核且未转入ERP的单据，勾选后点击"开始转ERP"')), 1),
        createVNode(_component_el_table, {
          data: batchErpList.value,
          size: "small",
          border: "",
          "max-height": "400",
          onSelectionChange: _cache[145] || (_cache[145] = (val) => (batchErpSel.value = val))
        }, {
          default: withCtx(() => [
            createVNode(_component_el_table_column, {
              type: "selection",
              width: "45"
            }),
            createVNode(_component_el_table_column, {
              prop: "单据编号",
              label: unref(tt)('单据编号'),
              width: "160"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "单据日期",
              label: unref(tt)('单据日期'),
              width: "110"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "partner",
              label: unref(tt)('供应商/客户')
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              label: unref(tt)('状态'),
              width: "80"
            }, {
              default: withCtx(({ row }) => [
                (row.result === 'ok')
                  ? (openBlock(), createBlock(_component_el_tag, {
                      key: 0,
                      type: "success",
                      size: "small"
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(row.erpBillNo || '成功'), 1)
                      ]),
                      _: 2
                    }, 1024))
                  : (row.result === 'skip')
                    ? (openBlock(), createBlock(_component_el_tag, {
                        key: 1,
                        type: "info",
                        size: "small"
                      }, {
                        default: withCtx(() => [...(_cache[175] || (_cache[175] = [
                          createTextVNode("已转", -1)
                        ]))]),
                        _: 1
                      }))
                    : (row.result === 'fail')
                      ? (openBlock(), createBlock(_component_el_tag, {
                          key: 2,
                          type: "danger",
                          size: "small"
                        }, {
                          default: withCtx(() => [
                            createTextVNode(toDisplayString(unref(tt)('失败')), 1)
                          ]),
                          _: 1
                        }))
                      : createCommentVNode("", true)
              ]),
              _: 1
            }, 8, ["label"])
          ]),
          _: 1
        }, 8, ["data"])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: headPrefVisible.value,
      "onUpdate:modelValue": _cache[150] || (_cache[150] = $event => ((headPrefVisible).value = $event)),
      title: unref(tt)('表头调整'),
      width: "520px",
      "append-to-body": "",
      "close-on-click-modal": false
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          size: "small",
          onClick: _cache[149] || (_cache[149] = $event => (headPrefVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          size: "small",
          onClick: resetHeadPrefs
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('恢复默认')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          size: "small",
          loading: headPrefSaving.value,
          onClick: saveHeadPrefs
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('保存')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_285, [
          createTextVNode(toDisplayString(unref(tt)('拖动或用箭头调整字段顺序;勾选=显示;栏名可改。')) + " ", 1),
          createBaseVNode("span", _hoisted_286, toDisplayString(unref(tt)('总')) + " " + toDisplayString(headPrefRows.value.length) + " " + toDisplayString(unref(tt)('个')) + " / " + toDisplayString(unref(tt)('显示')) + " " + toDisplayString(headPrefRows.value.filter(r => r.visible).length), 1)
        ]),
        createBaseVNode("div", _hoisted_287, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(headPrefRows.value, (item, idx) => {
            return (openBlock(), createElementBlock("div", {
              key: item.label,
              class: "col-pref-row",
              draggable: "true",
              onDragstart: $event => (headDragIdx.value = idx),
              onDragover: _cache[148] || (_cache[148] = withModifiers(() => {}, ["prevent"])),
              onDrop: $event => (onHeadDrop(idx))
            }, [
              createBaseVNode("div", {
                class: "cp-drag",
                title: unref(tt)('拖动排序')
              }, "⋮⋮", 8, _hoisted_289),
              createBaseVNode("div", _hoisted_290, [
                createVNode(_component_el_button, {
                  link: "",
                  size: "small",
                  disabled: idx === 0,
                  onClick: $event => (moveHead(idx, -1))
                }, {
                  default: withCtx(() => [...(_cache[176] || (_cache[176] = [
                    createTextVNode("▲", -1)
                  ]))]),
                  _: 1
                }, 8, ["disabled", "onClick"]),
                createVNode(_component_el_button, {
                  link: "",
                  size: "small",
                  disabled: idx === headPrefRows.value.length - 1,
                  onClick: $event => (moveHead(idx, 1))
                }, {
                  default: withCtx(() => [...(_cache[177] || (_cache[177] = [
                    createTextVNode("▼", -1)
                  ]))]),
                  _: 1
                }, 8, ["disabled", "onClick"])
              ]),
              createVNode(_component_el_checkbox, {
                modelValue: item.visible,
                "onUpdate:modelValue": $event => ((item.visible) = $event),
                class: "cp-vis"
              }, null, 8, ["modelValue", "onUpdate:modelValue"]),
              createBaseVNode("div", _hoisted_291, toDisplayString(item.label), 1),
              createVNode(_component_el_input, {
                modelValue: item.alias,
                "onUpdate:modelValue": $event => ((item.alias) = $event),
                class: "cp-alias",
                size: "small",
                placeholder: item.label,
                clearable: ""
              }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"])
            ], 40, _hoisted_288))
          }), 128))
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    (openBlock(), createBlock(Teleport, { to: "body" }, [
      (reportFilterVisible.value)
        ? (openBlock(), createElementBlock("div", {
            key: 0,
            class: "report-filter-panel",
            style: normalizeStyle({ left: reportFilterX.value + 'px', top: reportFilterY.value + 'px' }),
            onClick: _cache[154] || (_cache[154] = withModifiers(() => {}, ["stop"]))
          }, [
            createBaseVNode("div", _hoisted_292, toDisplayString(unref(tt)('筛选')), 1),
            createBaseVNode("div", _hoisted_293, [
              createVNode(_component_el_checkbox_group, {
                modelValue: unref(reportCols).headerFilters[reportFilterProp.value],
                "onUpdate:modelValue": _cache[151] || (_cache[151] = $event => ((unref(reportCols).headerFilters[reportFilterProp.value]) = $event))
              }, {
                default: withCtx(() => [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(unref(reportCols).distinctValues(reportFilterProp.value), (v) => {
                    return (openBlock(), createBlock(_component_el_checkbox, {
                      key: String(v),
                      value: v,
                      class: "filter-panel-item"
                    }, {
                      default: withCtx(() => [
                        createBaseVNode("span", _hoisted_294, toDisplayString(v === '' || v == null ? unref(tt)('（空）') : v), 1)
                      ]),
                      _: 2
                    }, 1032, ["value"]))
                  }), 128))
                ]),
                _: 1
              }, 8, ["modelValue"])
            ]),
            createBaseVNode("div", _hoisted_295, [
              createVNode(_component_el_button, {
                size: "small",
                onClick: _cache[152] || (_cache[152] = $event => (unref(reportCols).clearFilter(reportFilterProp.value)))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('清除')), 1)
                ]),
                _: 1
              }),
              createVNode(_component_el_button, {
                size: "small",
                type: "primary",
                onClick: _cache[153] || (_cache[153] = $event => (reportFilterVisible.value = false))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('确定')), 1)
                ]),
                _: 1
              })
            ])
          ], 4))
        : createCommentVNode("", true)
    ]))
  ]))
}
}

};
const PanelxList = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-d6d85387"]]);

export { PanelxList as default };
