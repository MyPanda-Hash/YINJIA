import { v as vLoading, j as ElTable, g as ElTableColumn, k as ElMessage, i as ElInput, d as ElButton, H as ElPagination, f as ElDialog, l as ElMessageBox } from './element-plus-W84rT0en.js';
import { u as usePanelRuntime, t as tt, r as request } from './index-CqmwEeWF.js';
/* empty css                   */
/* empty css                */
/* empty css                   */
/* empty css                       */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
import { o as openBlock, P as createBlock, W as withCtx, a as createBaseVNode, a0 as createVNode, aq as withKeys, _ as createTextVNode, A as unref, $ as toDisplayString, X as withDirectives, c as createElementBlock, ae as renderList, ad as createSlots, S as normalizeClass, J as Fragment, Z as createCommentVNode, aa as markRaw, p as ref, f as computed, j as watch, ac as withModifiers } from './vue-vendor-DyX2BAKf.js';
import { M as search_default } from './element-icons-DOEvq9OG.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

/* unplugin-vue-components disabled */

const _hoisted_1$2 = { class: "rpd" };
const _hoisted_2$2 = { class: "rpd-toolbar" };
const _hoisted_3$2 = { class: "rpd-tip" };
const _hoisted_4$2 = {
  key: 0,
  class: "rpd-pager"
};


const _sfc_main$2 = {
  __name: 'RefPickDialog',
  props: {
  modelValue: { type: Boolean, default: false },
  // 兼容旧调用方（v-model:visible）
  // 参照字段定义（原始配置字段或 buildMeta 输出的 meta.ref 均可）
  field: { type: Object, default: null },
  // 'header' 表头单值字段（多选仅导入第一行）/ 'detail' 明细行（多选每行生成一条明细）
  mode: { type: String, default: 'header' },
  // 调用方所属面板(用于「产品开发」状态标注:仅下游文件面板显示;2026-09-11 起 4 个)
  ownerPanel: { type: String, default: '' },
},
  emits: ['update:modelValue', 'update:visible', 'confirm'],
  setup(__props, { emit: __emit }) {

const engine = usePanelRuntime();

const props = __props;
const emit = __emit;

const keyword = ref('');
const rows = ref([]);
const columns = ref([]);
const selected = ref([]);
const loading = ref(false);
const total = ref(0);

// ── 大数据参照分页(2026-09-16):档案参照(商品 3850 行×75 列)此前全量渲染把弹窗冻住。
// 数据全量驻内存(同档案页口径),DOM 只渲染当前页;行对象 markRaw 避免 ~29 万属性深度代理。
const PAGE_SIZES = [50, 100, 200, 500];
const pageSize = ref(PAGE_SIZES[0]);
const page = ref(1);
const tableRef = ref(null);
const pagedRows = computed(() => {
  const s = (page.value - 1) * pageSize.value;
  return rows.value.slice(s, s + pageSize.value)
});
function onSizeChange() { page.value = 1; }
/** reserve-selection 的稳定行键:载入时按序分配(过滤/翻页后仍指向同一行对象) */
function rowKeyOf(r) { return r.__rk }

// ── 产品开发状态标注(2026-09-09):参照产品信息表时,按当前面板标注 未开发 / 已开发 ──
const DEV_PANEL_CODES = ['RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_SPEC_DOC', 'RD_INSP_PLAN'];
const devMap = ref({});
const showDevStatus = computed(() => props.field?.refPanel === 'RD_PROD_INFO'
  && DEV_PANEL_CODES.includes(String(props.ownerPanel || '')));
const displayColumns = computed(() => (showDevStatus.value ? [...columns.value, '开发状态'] : columns.value));
function devTone(status) {
  return status === '已开发' ? 'done' : 'none'
}

const title = ref('参照选择');
const multi = computed(() => !!props.field?.refMulti || !!props.field?.multi);
const tipText = computed(() => {
  if (props.mode === 'detail') return '可勾选多行，确定后每行生成一条明细'
  if (multi.value) return '可勾选多行，确定后一次导入（多值顿号连接）'
  return '单值字段，勾选多行时仅导入第一行'
});

async function open() {
  if (!props.field) return
  title.value = (await engine.refPanelName(props.field)) + ' · 参照选择';
  loading.value = true;
  tableRef.value?.clearSelection(); // 重新查询后旧勾选(含跨页保留)整体作废
  selected.value = [];
  rows.value = [];
  try {
    columns.value = await engine.refColumns(props.field);
    const list = await engine.queryRefRows(props.field, { keyword: keyword.value });
    if (showDevStatus.value) {
      const codes = list.map((r) => r['产品编号']).filter((v) => v !== undefined && v !== null && v !== '');
      try {
        devMap.value = (await engine.rdDevAnnotate(props.ownerPanel, codes)) || {};
      } catch (e) {
        devMap.value = {};
      }
      // 标注写进行对象,须在 rows.value 赋值(raw 进响应式)之前完成,渲染时即带值
      for (const r of list) r['开发状态'] = devMap.value[r['产品编号']] || '';
    } else {
      devMap.value = {};
    }
    // markRaw 必须在进入响应式系统(rows.value 赋值)之前打在原始行对象上
    for (let i = 0; i < list.length; i++) { list[i].__rk = String(i); markRaw(list[i]); }
    rows.value = list;
    total.value = list.length;
    page.value = 1;
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '参照数据加载失败');
  } finally {
    loading.value = false;
  }
}

function confirm() {
  if (!selected.value.length) return
  emit('confirm', selected.value);
  emit('update:modelValue', false);
}

return (_ctx, _cache) => {
  const _component_el_input = ElInput;
  const _component_el_button = ElButton;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_pagination = ElPagination;
  const _component_el_dialog = ElDialog;
  const _directive_loading = vLoading;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: title.value,
    width: "880px",
    "append-to-body": "",
    "destroy-on-close": "",
    "onUpdate:modelValue": _cache[5] || (_cache[5] = (v) => emit('update:modelValue', v)),
    onOpen: open
  }, {
    footer: withCtx(() => [
      createVNode(_component_el_button, {
        onClick: _cache[4] || (_cache[4] = $event => (emit('update:modelValue', false)))
      }, {
        default: withCtx(() => [...(_cache[7] || (_cache[7] = [
          createTextVNode("取消", -1)
        ]))]),
        _: 1
      }),
      createVNode(_component_el_button, {
        type: "primary",
        disabled: !selected.value.length,
        onClick: confirm
      }, {
        default: withCtx(() => [
          createTextVNode("确定导入（" + toDisplayString(selected.value.length) + " 行）", 1)
        ]),
        _: 1
      }, 8, ["disabled"])
    ]),
    default: withCtx(() => [
      createBaseVNode("div", _hoisted_1$2, [
        createBaseVNode("div", _hoisted_2$2, [
          createVNode(_component_el_input, {
            modelValue: keyword.value,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((keyword).value = $event)),
            placeholder: "输入关键字过滤…",
            clearable: "",
            size: "small",
            style: {"width":"240px"},
            onKeyup: withKeys(open, ["enter"])
          }, null, 8, ["modelValue"]),
          createVNode(_component_el_button, {
            size: "small",
            type: "primary",
            icon: unref(search_default),
            onClick: open
          }, {
            default: withCtx(() => [...(_cache[6] || (_cache[6] = [
              createTextVNode("查询", -1)
            ]))]),
            _: 1
          }, 8, ["icon"]),
          createBaseVNode("span", _hoisted_3$2, toDisplayString(tipText.value) + " · 共 " + toDisplayString(total.value) + " 条", 1)
        ]),
        withDirectives((openBlock(), createBlock(_component_el_table, {
          ref_key: "tableRef",
          ref: tableRef,
          data: pagedRows.value,
          "row-key": rowKeyOf,
          size: "small",
          border: "",
          height: "380",
          "highlight-current-row": "",
          onSelectionChange: _cache[1] || (_cache[1] = (r) => (selected.value = r))
        }, {
          default: withCtx(() => [
            createVNode(_component_el_table_column, {
              type: "selection",
              width: "45",
              "reserve-selection": ""
            }),
            (openBlock(true), createElementBlock(Fragment, null, renderList(displayColumns.value, (c) => {
              return (openBlock(), createBlock(_component_el_table_column, {
                key: c,
                prop: c,
                label: c,
                "min-width": "110",
                "show-overflow-tooltip": ""
              }, createSlots({ _: 2 }, [
                (c === '开发状态')
                  ? {
                      name: "default",
                      fn: withCtx(({ row }) => [
                        createBaseVNode("span", {
                          class: normalizeClass(["rpd-dev", devTone(row['开发状态'])])
                        }, toDisplayString(unref(tt)(row['开发状态'])), 3)
                      ]),
                      key: "0"
                    }
                  : undefined
              ]), 1032, ["prop", "label"]))
            }), 128))
          ]),
          _: 1
        }, 8, ["data"])), [
          [_directive_loading, loading.value]
        ]),
        (total.value > PAGE_SIZES[0])
          ? (openBlock(), createElementBlock("div", _hoisted_4$2, [
              createVNode(_component_el_pagination, {
                small: "",
                background: "",
                "page-size": pageSize.value,
                "onUpdate:pageSize": _cache[2] || (_cache[2] = $event => ((pageSize).value = $event)),
                layout: "total, sizes, prev, next, jumper",
                "page-sizes": PAGE_SIZES,
                total: total.value,
                "current-page": page.value,
                onSizeChange: onSizeChange,
                onCurrentChange: _cache[3] || (_cache[3] = (p) => (page.value = p))
              }, null, 8, ["page-size", "total", "current-page"])
            ]))
          : createCommentVNode("", true)
      ])
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const RefPickDialog = /*#__PURE__*/_export_sfc(_sfc_main$2, [['__scopeId',"data-v-8835fb7c"]]);

/* unplugin-vue-components disabled */

const _hoisted_1$1 = { class: "fac-cell" };
const _hoisted_2$1 = {
  key: 0,
  class: "fac-legacy"
};
const _hoisted_3$1 = { class: "fac-list" };
const _hoisted_4$1 = ["title", "onClick"];
const _hoisted_5$1 = { class: "fac-name" };
const _hoisted_6$1 = ["title", "onClick"];
const _hoisted_7 = {
  key: 0,
  class: "fac-empty"
};
const _hoisted_8 = {
  key: 1,
  class: "fac-actions no-print"
};


const _sfc_main$1 = {
  __name: 'FileAttachCell',
  props: {
  panelCode: { type: String, required: true },
  /** 单据编号=附件锚点;新建未保存(无编号)不可上传,点上传时提示先保存 */
  docNo: { type: String, default: '' },
  /** 单列位模式:字段中文键(=头表列名) */
  fieldKey: { type: String, default: '' },
  /** 头字段当前值(文件名串;无附件时可能为历史遗留文本,只读展示) */
  modelValue: { type: String, default: '' },
  /** 多列位模式:头表附件列位数组(如 ['附件1','附件2',...]),与 fieldKey 二选一 */
  slots: { type: Array, default: null },
  /** 多列位模式:各列位当前头值(遗留文本只读展示用) */
  values: { type: Object, default: null },
  /** 可编辑=允许上传/删除;已审核锁定单据只保留查看/下载 */
  canEdit: { type: Boolean, default: true },
},
  emits: ['update:modelValue', 'change'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

const files = ref([]);
const busy = ref(false);
const fileInput = ref(null);

const isMulti = computed(() => Array.isArray(props.slots) && props.slots.length > 0);
const slotsKey = computed(() => (isMulti.value ? props.slots.join(',') : ''));
const legacyText = computed(() => {
  if (files.value.length) return ''
  if (isMulti.value) {
    return props.slots.map((s) => String(props.values?.[s] || '').trim()).filter(Boolean).join('、')
  }
  return String(props.modelValue || '').trim()
});

function fmtSize(n) {
  if (!n && n !== 0) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}
function chipTitle(a) {
  return [tt('文件大小') + ' ' + fmtSize(a.fileSize), tt('上传人') + ' ' + (a.uploader || ''),
    tt('上传时间') + ' ' + (a.uploadTime || '')].join('\n')
}

async function loadField(field) {
  const res = await request.get('/attachment/list', { params: { panelCode: props.panelCode, docNo: props.docNo, field } });
  return (res?.data || []).map((x) => ({ ...x, _field: field }))
}

/** 多列位:聚合全部列位附件;emitNames=true 时把各列位文件名串回抛父级(同步头列模型,不触发 dirty) */
async function loadAll(emitNames) {
  if (!props.docNo) {
    files.value = [];
    return
  }
  try {
    const lists = await Promise.all(props.slots.map((f) => loadField(f).catch(() => [])));
    files.value = lists.flat();
    if (emitNames) emitChange();
  } catch { /* 列表加载失败不阻塞表单 */ }
}

/** 单列位:原逻辑 */
async function load(emitNames) {
  if (!props.docNo) {
    files.value = [];
    return
  }
  try {
    const res = await request.get('/attachment/list', { params: { panelCode: props.panelCode, docNo: props.docNo, field: props.fieldKey } });
    files.value = res?.data || [];
    // 服务端已同步头字段列;前端头模型跟随,列表/翻页/打印一致(不触发 dirty,真源在库)
    if (emitNames && files.value.length)
      emit('update:modelValue', files.value.map((f) => f.fileName).join('、'));
  } catch { /* 列表加载失败不阻塞表单 */ }
}

/** 多列位:把各列位文件名串抛给父级 {附件1:'a.pdf',附件2:'b.pdf',...} */
function emitChange() {
  if (!isMulti.value) return
  const map = {};
  for (const f of props.slots) {
    map[f] = files.value.filter((x) => x._field === f).map((x) => x.fileName).join('、');
  }
  emit('change', map);
}

watch(() => [props.panelCode, props.docNo, props.fieldKey, slotsKey.value], () => {
  isMulti.value ? loadAll(true) : load(true);
}, { immediate: true });

function pickFile() {
  if (!props.docNo) {
    ElMessage.warning(tt('请先保存单据再上传附件'));
    return
  }
  fileInput.value?.click();
}

/** 多列位:第一个空余列位(每列位 1 个文件,6 个占位=最多 6 个附件) */
function pickSlot() {
  return props.slots.find((f) => !files.value.some((x) => x._field === f))
}

async function onFiles(e) {
  const list = [...(e.target.files || [])];
  e.target.value = '';
  if (!list.length) return
  busy.value = true;
  try {
    for (const f of list) {
      const field = isMulti.value ? pickSlot() : props.fieldKey;
      if (field == null) {
        ElMessage.warning(tt('附件占位已满') + '（' + props.slots.length + '）');
        break
      }
      const fd = new FormData();
      fd.append('file', f);
      fd.append('panelCode', props.panelCode);
      fd.append('docNo', props.docNo);
      fd.append('field', field);
      try {
        const res = await request.post('/attachment/upload', fd, { timeout: 120000 });
        if (isMulti.value) {
          // 服务端返回该列位全部附件;替换本地对应分组后再为下一个文件选位
          const group = (res?.data?.files || []).map((x) => ({ ...x, _field: field }));
          files.value = files.value.filter((x) => x._field !== field).concat(group);
          emitChange();
        } else {
          files.value = res?.data?.files || files.value;
          if (res?.data?.names !== undefined) emit('update:modelValue', res.data.names);
        }
      } catch (err) {
        ElMessage.error(tt('附件上传失败') + (err?.response?.data?.message ? '：' + err.response.data.message : ''));
      }
    }
  } finally {
    busy.value = false;
  }
}

async function removeFile(a) {
  try {
    await ElMessageBox.confirm(tt('确认删除该附件？'), tt('删除确认'), { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') });
  } catch { return /* 取消 */ }
  try {
    await request.post('/attachment/delete', { id: a.id });
    if (isMulti.value) await loadAll(true);
    else await load(true);
    ElMessage.success(tt('附件已删除'));
  } catch (err) {
    ElMessage.error(tt('附件删除失败') + (err?.response?.data?.message ? '：' + err.response.data.message : ''));
  }
}

/** 点击文件名=查看:图片/PDF/文本新标签页打开,其余浏览器下载(均保留原文件名) */
async function openFile(a) {
  try {
    const blob = await request.get(`/attachment/${a.id}/download`, { responseType: 'blob', timeout: 120000 });
    const type = a.contentType || blob?.type || '';
    const url = URL.createObjectURL(blob);
    if (type.startsWith('image/') || type.startsWith('text/') || type === 'application/pdf') {
      window.open(url, '_blank');
    } else {
      const el = document.createElement('a');
      el.href = url;
      el.download = a.fileName;
      el.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    ElMessage.error(tt('附件下载失败'));
  }
}

return (_ctx, _cache) => {
  return (openBlock(), createElementBlock("div", _hoisted_1$1, [
    (!files.value.length && legacyText.value)
      ? (openBlock(), createElementBlock("div", _hoisted_2$1, toDisplayString(legacyText.value), 1))
      : createCommentVNode("", true),
    createBaseVNode("div", _hoisted_3$1, [
      (openBlock(true), createElementBlock(Fragment, null, renderList(files.value, (a) => {
        return (openBlock(), createElementBlock("span", {
          key: a.id,
          class: "fac-chip",
          title: chipTitle(a),
          onClick: $event => (openFile(a))
        }, [
          createBaseVNode("span", _hoisted_5$1, toDisplayString(a.fileName), 1),
          (!busy.value && __props.canEdit)
            ? (openBlock(), createElementBlock("span", {
                key: 0,
                class: "fac-del no-print",
                title: unref(tt)('删除'),
                onClick: withModifiers($event => (removeFile(a)), ["stop"])
              }, "✕", 8, _hoisted_6$1))
            : createCommentVNode("", true)
        ], 8, _hoisted_4$1))
      }), 128)),
      (!files.value.length && !legacyText.value)
        ? (openBlock(), createElementBlock("span", _hoisted_7, toDisplayString(unref(tt)('暂无附件')), 1))
        : createCommentVNode("", true)
    ]),
    (__props.canEdit)
      ? (openBlock(), createElementBlock("div", _hoisted_8, [
          createBaseVNode("span", {
            class: "fac-upload-btn",
            onClick: pickFile
          }, "⬆ " + toDisplayString(unref(tt)('上传附件')), 1),
          createBaseVNode("input", {
            ref_key: "fileInput",
            ref: fileInput,
            type: "file",
            multiple: "",
            hidden: "",
            onChange: onFiles
          }, null, 544)
        ]))
      : createCommentVNode("", true)
  ]))
}
}

};
const FileAttachCell = /*#__PURE__*/_export_sfc(_sfc_main$1, [['__scopeId',"data-v-7b589ad6"]]);

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "slm" };
const _hoisted_2 = { class: "slm-tip" };
const _hoisted_3 = {
  key: 0,
  class: "slm-add"
};
const _hoisted_4 = { class: "slm-actions" };
const _hoisted_5 = ["onDblclick"];
const _hoisted_6 = {
  key: 1,
  class: "slm-empty"
};

/**
 * 标准库维护(共用组件)
 * 数据源 yj_std_lib,按 lib(+item) 分组;条目正文可能是纯文本,也可能是 JSON(spec.test/insp.plan
 * 存结构化 JSON)——本组件只把它当字符串原样编辑/往返,不解析,避免改坏结构化条目。
 *
 * 不污染已录入数据:面板勾选录入时存的是**文本内容**,单据列不存条目 id,所以这里改条目
 * 只影响以后的勾选候选,历史单据原样不动(探针 tools/archive/_probe-stdlib-edit.cjs 钉这条)。
 */

const _sfc_main = {
  __name: 'StdLibManager',
  props: {
  lib: { type: String, required: true },
  item: { type: String, default: '' },
  /** 新增条目的 item_code(实验室库统一 '默认';规格书章节库=章节名) */
  addItem: { type: String, default: '默认' },
  /** 是否提供「填入」动作(章节库要把它填到当前字段上) */
  pickable: { type: Boolean, default: false },
  /** 是否自带「新增条目」输入行(章节库正文是多行,用调用方自己的文本框) */
  showAdd: { type: Boolean, default: true },
  /** 是否显示「条目名」列:一条=一个键的库需要它(配方计算参数:条目名=产品编号);默认关,不影响既有调用方 */
  showItem: { type: Boolean, default: false },
},
  emits: ['pick', 'changed'],
  setup(__props, { expose: __expose, emit: __emit }) {

const props = __props;
const emit = __emit;

const rows = ref([]);
const checked = ref([]);
const busy = ref(false);
const newText = ref('');
const editingId = ref(null);
const editText = ref('');

const isOn = (r) => Number(r.enabled) !== 0;
const checkedEnabled = computed(() => checked.value.filter(isOn));
const checkedDisabled = computed(() => checked.value.filter((r) => !isOn(r)));
const multiline = computed(() => String(editText.value || '').includes('\n'));

async function load() {
  if (!props.lib) return
  busy.value = true;
  try {
    // all=1:维护界面要看得见已停用条目(灰显),业务下拉用的是默认列表(enabled=1)
    const res = await request.get('/stdlib/list', { params: { lib: props.lib, item: props.item || undefined, all: 1 } });
    rows.value = (res?.data || []).map((r) => ({ id: r.id, content: r.content, enabled: r.enabled, item: r.item }));
  } catch (e) {
    rows.value = [];
  } finally {
    busy.value = false;
  }
}
/** 外部拿到组件实例后刷新用 */
__expose({ load });

watch(() => [props.lib, props.item], () => { cancelEdit(); load(); }, { immediate: true });

async function add() {
  const v = String(newText.value || '').trim();
  if (!v) return ElMessage.warning(tt('内容不能为空'))
  try {
    await request.post('/stdlib/add', { lib: props.lib, item: props.item || props.addItem, content: v });
    ElMessage.success(tt('已加入标准库'));
    newText.value = '';
    await load();
    emit('changed');
  } catch (e) {
    ElMessage.error(tt('保存失败'));
  }
}

function startEdit() {
  const row = checked.value[0];
  if (!row) return ElMessage.warning(tt('请先勾选一行'))
  startEditRow(row);
}
function startEditRow(row) {
  editingId.value = row.id;
  editText.value = String(row.content ?? '');
}
function cancelEdit() {
  editingId.value = null;
  editText.value = '';
}
async function saveEdit() {
  const id = editingId.value;
  if (!id) return
  const v = String(editText.value ?? '');
  if (!v.trim()) return ElMessage.warning(tt('内容不能为空'))
  try {
    await request.post('/stdlib/update', { id, content: v });
    ElMessage.success(tt('已保存'));
    cancelEdit();
    await load();
    emit('changed');
  } catch (e) {
    ElMessage.error(tt('保存失败'));
  }
}

async function switchEnabled(enabled) {
  const list = enabled ? checkedDisabled.value : checkedEnabled.value;
  if (!list.length) return
  try {
    for (const r of list) {
      await request.post(enabled ? '/stdlib/enable' : '/stdlib/remove', { id: r.id });
    }
    ElMessage.success(enabled ? tt('已恢复启用') : tt('已停用该条目'));
    await load();
    emit('changed');
  } catch (e) {
    ElMessage.error(tt('操作失败'));
  }
}

function pick() {
  const row = checked.value[0];
  if (!row) return ElMessage.warning(tt('请先勾选一行'))
  emit('pick', String(row.content ?? ''));
}

return (_ctx, _cache) => {
  const _component_el_input = ElInput;
  const _component_el_button = ElButton;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _directive_loading = vLoading;

  return withDirectives((openBlock(), createElementBlock("div", _hoisted_1, [
    createBaseVNode("div", _hoisted_2, toDisplayString(unref(tt)('下拉即可从标准库选择；勾选条目后可「编辑 / 停用 / 恢复启用」。编辑只改标准库条目本身，已录入单据里的内容不会被改动。')), 1),
    (__props.showAdd)
      ? (openBlock(), createElementBlock("div", _hoisted_3, [
          createVNode(_component_el_input, {
            modelValue: newText.value,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((newText).value = $event)),
            size: "small",
            placeholder: unref(tt)('新增条目'),
            onKeyup: withKeys(add, ["enter"])
          }, null, 8, ["modelValue", "placeholder"]),
          createVNode(_component_el_button, {
            size: "small",
            type: "primary",
            onClick: add
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('加入标准库')), 1)
            ]),
            _: 1
          })
        ]))
      : createCommentVNode("", true),
    createBaseVNode("div", _hoisted_4, [
      createVNode(_component_el_button, {
        size: "small",
        disabled: checked.value.length !== 1,
        onClick: startEdit
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('编辑')), 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      createVNode(_component_el_button, {
        size: "small",
        disabled: !checkedEnabled.value.length,
        onClick: _cache[1] || (_cache[1] = $event => (switchEnabled(0)))
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('停用')), 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      createVNode(_component_el_button, {
        size: "small",
        disabled: !checkedDisabled.value.length,
        onClick: _cache[2] || (_cache[2] = $event => (switchEnabled(1)))
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('恢复启用')), 1)
        ]),
        _: 1
      }, 8, ["disabled"]),
      (__props.pickable)
        ? (openBlock(), createBlock(_component_el_button, {
            key: 0,
            size: "small",
            type: "primary",
            plain: "",
            disabled: checked.value.length !== 1,
            onClick: pick
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('填入')), 1)
            ]),
            _: 1
          }, 8, ["disabled"]))
        : createCommentVNode("", true)
    ]),
    createVNode(_component_el_table, {
      data: rows.value,
      size: "small",
      border: "",
      "max-height": "360",
      "row-key": "id",
      onSelectionChange: _cache[5] || (_cache[5] = (s) => (checked.value = s))
    }, {
      default: withCtx(() => [
        createVNode(_component_el_table_column, {
          type: "selection",
          width: "42"
        }),
        (__props.showItem)
          ? (openBlock(), createBlock(_component_el_table_column, {
              key: 0,
              label: unref(tt)('条目名'),
              width: "150",
              "show-overflow-tooltip": ""
            }, {
              default: withCtx(({ row }) => [
                createTextVNode(toDisplayString(row.item), 1)
              ]),
              _: 1
            }, 8, ["label"]))
          : createCommentVNode("", true),
        createVNode(_component_el_table_column, {
          label: unref(tt)('条目内容'),
          "min-width": "260"
        }, {
          default: withCtx(({ row }) => [
            (editingId.value === row.id && multiline.value)
              ? (openBlock(), createBlock(_component_el_input, {
                  key: 0,
                  modelValue: editText.value,
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((editText).value = $event)),
                  type: "textarea",
                  autosize: { minRows: 1, maxRows: 6 },
                  size: "small",
                  onKeyup: withKeys(withModifiers(saveEdit, ["ctrl"]), ["enter"])
                }, null, 8, ["modelValue", "onKeyup"]))
              : (editingId.value === row.id)
                ? (openBlock(), createBlock(_component_el_input, {
                    key: 1,
                    modelValue: editText.value,
                    "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((editText).value = $event)),
                    size: "small",
                    onKeyup: withKeys(saveEdit, ["enter"])
                  }, null, 8, ["modelValue"]))
                : (openBlock(), createElementBlock("span", {
                    key: 2,
                    class: normalizeClass(["slm-text", { 'slm-off': !isOn(row) }]),
                    onDblclick: $event => (startEditRow(row))
                  }, toDisplayString(row.content), 43, _hoisted_5))
          ]),
          _: 1
        }, 8, ["label"]),
        createVNode(_component_el_table_column, {
          label: unref(tt)('状态'),
          width: "82",
          align: "center"
        }, {
          default: withCtx(({ row }) => [
            createBaseVNode("span", {
              class: normalizeClass(isOn(row) ? 'slm-on' : 'slm-off')
            }, toDisplayString(isOn(row) ? unref(tt)('已启用') : unref(tt)('已停用')), 3)
          ]),
          _: 1
        }, 8, ["label"]),
        (editingId.value)
          ? (openBlock(), createBlock(_component_el_table_column, {
              key: 1,
              label: unref(tt)('操作'),
              width: "128",
              align: "center"
            }, {
              default: withCtx(() => [
                createVNode(_component_el_button, {
                  size: "small",
                  type: "primary",
                  onClick: saveEdit
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('确定')), 1)
                  ]),
                  _: 1
                }),
                createVNode(_component_el_button, {
                  size: "small",
                  onClick: cancelEdit
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('取消')), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["label"]))
          : createCommentVNode("", true)
      ]),
      _: 1
    }, 8, ["data"]),
    (!busy.value && !rows.value.length)
      ? (openBlock(), createElementBlock("div", _hoisted_6, toDisplayString(unref(tt)('暂无条目,请在上方新增')), 1))
      : createCommentVNode("", true)
  ])), [
    [_directive_loading, busy.value]
  ])
}
}

};
const StdLibManager = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-73079de0"]]);

export { FileAttachCell as F, RefPickDialog as R, StdLibManager as S };
