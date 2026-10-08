const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/docx-preview-C1Hcu-oU.js","assets/element-plus-W84rT0en.js","assets/vue-vendor-DyX2BAKf.js","assets/element-icons-DOEvq9OG.js"])))=>i.map(i=>d[i]);
import { t as tt, r as request, _ as __vitePreload } from './index-CqmwEeWF.js';
import { v as vLoading, l as ElMessageBox, k as ElMessage, $ as ElTree, d as ElButton, i as ElInput, j as ElTable, H as ElPagination, f as ElDialog, g as ElTableColumn, w as ElForm, m as ElFormItem, a0 as ElTreeSelect, h as ElInputNumber, z as ElDatePicker } from './element-plus-W84rT0en.js';
/* empty css                   */
/* empty css                        */
/* empty css                      */
/* empty css                         */
/* empty css                */
/* empty css                   */
/* empty css                        */
/* empty css                       */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
import { q as onMounted, c as createElementBlock, a as createBaseVNode, $ as toDisplayString, A as unref, S as normalizeClass, Z as createCommentVNode, a0 as createVNode, W as withCtx, P as createBlock, aq as withKeys, X as withDirectives, z as reactive, p as ref, f as computed, o as openBlock, _ as createTextVNode } from './vue-vendor-DyX2BAKf.js';
import { a6 as upload_filled_default, M as search_default } from './element-icons-DOEvq9OG.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "sf-page" };
const _hoisted_2 = { class: "sf-head" };
const _hoisted_3 = { class: "sf-title" };
const _hoisted_4 = { class: "sf-sub" };
const _hoisted_5 = { class: "sf-body" };
const _hoisted_6 = { class: "sf-tree" };
const _hoisted_7 = { class: "sf-tree-hd" };
const _hoisted_8 = {
  key: 0,
  class: "sf-tree-ops"
};
const _hoisted_9 = ["title"];
const _hoisted_10 = ["title"];
const _hoisted_11 = ["title"];
const _hoisted_12 = { class: "sf-tree-body" };
const _hoisted_13 = { class: "sf-tree-name" };
const _hoisted_14 = { class: "sf-tree-cnt" };
const _hoisted_15 = ["title"];
const _hoisted_16 = { class: "sf-tree-cnt" };
const _hoisted_17 = { class: "sf-main" };
const _hoisted_18 = { class: "sf-bar" };
const _hoisted_19 = { class: "sf-total" };
const _hoisted_20 = ["title", "onClick"];
const _hoisted_21 = { key: 1 };
const _hoisted_22 = { class: "sf-pager" };
const _hoisted_23 = { class: "sf-date-sep" };
const _hoisted_24 = ["title"];


const _sfc_main = {
  __name: 'ShareFileCenter',
  setup(__props) {

const perm = reactive({ canUpload: false, canMaintain: false, canDelete: false });
const cats = ref([]);
const rows = ref([]);
const loading = ref(false);
const saving = ref(false);
const total = ref(0);
const totalAll = ref(0);
const catId = ref(null);
const selCat = ref(null);
const keyword = ref('');
const pageNo = ref(1);
const pageSize = ref(20);

const catVisible = ref(false);
const catMode = ref('add');
const catForm = reactive({ id: null, parentId: null, name: '', seq: 0 });

const fileVisible = ref(false);
const fileForm = reactive({ id: null, catId: null, name: '', version: '', effectiveDate: '', expiryDate: '', keywords: '', remark: '' });
const pickedFile = ref(null);
const pickedName = ref('');
const fileInput = ref(null);

/** 平铺分类 → 树(count 已含子孙;顺序=SQL 的 seq,id,不做二次排序) */
const catTree = computed(() => {
  const byId = new Map();
  const roots = [];
  for (const c of cats.value) byId.set(c.id, { value: c.id, id: c.id, label: c.name, count: c.count, children: [] });
  for (const c of cats.value) {
    const node = byId.get(c.id);
    const parent = c.parentId != null ? byId.get(c.parentId) : null
    ;(parent ? parent.children : roots).push(node);
  }
  return roots
});
/** 分类选择(文件用):任一级可选,含路径名 */
const catPickOptions = computed(() => withPath(catTree.value, ''));
function withPath(list, prefix) {
  return list.map((n) => {
    const label = prefix ? `${prefix} / ${n.label}` : n.label;
    return { value: n.value, label, children: withPath(n.children || [], label) }
  })
}
/** 上级分类选择:编辑时排除自己及子孙 */
const catParentOptions = computed(() => {
  const stripDisabled = (list, hideSelf) => list
    .filter((n) => !hideSelf || n.id !== catForm.id)
    .map((n) => ({ value: n.value, label: n.label, children: stripDisabled(n.children || [], hideSelf || n.id === catForm.id) }));
  return stripDisabled(catTree.value, catMode.value === 'edit')
});

async function loadPerm() {
  try {
    const res = await request.get('/share-file/perm');
    Object.assign(perm, res?.data || {});
  } catch { /* 权限加载失败按只读处理 */ }
}

async function loadCats() {
  try {
    const res = await request.get('/share-file/categories');
    cats.value = res?.data || [];
    // 全部文件数 = 一级分类含子孙数之和(根级 count 已含子孙)
    totalAll.value = cats.value.filter((c) => c.parentId == null).reduce((s, c) => s + (c.count || 0), 0);
  } catch (e) {
    fail(e, '加载分类失败');
  }
}

async function load() {
  loading.value = true;
  try {
    const res = await request.get('/share-file/list', {
      params: { catId: catId.value || undefined, keyword: keyword.value || undefined, pageNo: pageNo.value, pageSize: pageSize.value },
    });
    if (res?.code === 200) {
      rows.value = res.data.rows || [];
      total.value = res.data.total || 0;
    } else fail(res, '加载文件失败');
  } catch (e) {
    fail(e, '加载文件失败');
  } finally {
    loading.value = false;
  }
}

function reload() {
  pageNo.value = 1;
  load();
}

function pickCat(id) {
  catId.value = id;
  selCat.value = id == null ? null : cats.value.find((c) => c.id === id) || null;
  reload();
}

// ══════════ 分类维护 ══════════

function openCatDialog(mode) {
  catMode.value = mode;
  if (mode === 'add') {
    catForm.id = null;
    catForm.parentId = catId.value; // 默认在当前选中分类下新增
    catForm.name = '';
    catForm.seq = 0;
  } else if (selCat.value) {
    catForm.id = selCat.value.id;
    catForm.parentId = selCat.value.parentId;
    catForm.name = selCat.value.name;
    catForm.seq = selCat.value.seq;
  } else return
  catVisible.value = true;
}

async function saveCat() {
  if (!catForm.name.trim()) return ElMessage.warning(tt('请输入分类名称'))
  saving.value = true;
  try {
    const body = { parentId: catForm.parentId ?? null, name: catForm.name.trim(), seq: catForm.seq || 0 };
    const res = catMode.value === 'add'
      ? await request.post('/share-file/categories', body)
      : await request.post(`/share-file/categories/${catForm.id}/update`, body);
    if (res?.code === 200) {
      ElMessage.success(tt('保存成功'));
      catVisible.value = false;
      await loadCats();
    } else fail(res, '保存失败');
  } catch (e) {
    fail(e, '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onDeleteCat() {
  if (!selCat.value) return
  try {
    await ElMessageBox.confirm(tt('确认删除该分类？'), tt('删除确认'), { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') });
  } catch { return }
  try {
    const res = await request.delete(`/share-file/categories/${selCat.value.id}`);
    if (res?.code === 200) {
      ElMessage.success(tt('删除成功'));
      if (catId.value === selCat.value.id) pickCat(null);
      await loadCats();
    } else fail(res, '删除失败');
  } catch (e) {
    fail(e, '删除失败');
  }
}

// ══════════ 文件 ══════════

function openFileDialog(row) {
  pickedFile.value = null;
  pickedName.value = '';
  if (row) {
    Object.assign(fileForm, {
      id: row.id, catId: row.catId, name: row.name, version: row.version || '',
      effectiveDate: row.effectiveDate || '', expiryDate: row.expiryDate || '',
      keywords: row.keywords || '', remark: row.remark || '',
    });
    pickedName.value = row.fileName || '';
  } else {
    Object.assign(fileForm, {
      id: null, catId: catId.value, name: '', version: '',
      effectiveDate: '', expiryDate: '', keywords: '', remark: '',
    });
  }
  fileVisible.value = true;
}

function onPickFile(e) {
  const f = e.target.files?.[0] || null;
  pickedFile.value = f;
  pickedName.value = f ? f.name : '';
  if (f && !fileForm.id && !fileForm.name) {
    const dot = f.name.lastIndexOf('.');
    fileForm.name = dot > 0 ? f.name.slice(0, dot) : f.name;
  }
}

async function saveFile() {
  if (!fileForm.catId) return ElMessage.warning(tt('请选择分类'))
  if (!fileForm.name.trim()) return ElMessage.warning(tt('请输入文件名称'))
  if (!fileForm.id && !pickedFile.value) return ElMessage.warning(tt('请选择文件'))
  saving.value = true;
  try {
    if (fileForm.id) {
      const res = await request.post(`/share-file/${fileForm.id}/update`, {
        catId: fileForm.catId, name: fileForm.name.trim(), version: fileForm.version.trim(),
        effectiveDate: fileForm.effectiveDate, expiryDate: fileForm.expiryDate,
        keywords: fileForm.keywords.trim(), remark: fileForm.remark.trim(),
      });
      if (res?.code !== 200) return fail(res, '保存失败')
      if (pickedFile.value) {
        const fd = new FormData();
        fd.append('file', pickedFile.value);
        const r2 = await request.post(`/share-file/${fileForm.id}/replace-file`, fd, { timeout: 120000 });
        if (r2?.code !== 200) return fail(r2, '上传失败')
      }
      ElMessage.success(tt('保存成功'));
    } else {
      const fd = new FormData();
      fd.append('file', pickedFile.value);
      fd.append('catId', fileForm.catId);
      fd.append('name', fileForm.name.trim());
      if (fileForm.version.trim()) fd.append('version', fileForm.version.trim());
      if (fileForm.effectiveDate) fd.append('effectiveDate', fileForm.effectiveDate);
      if (fileForm.expiryDate) fd.append('expiryDate', fileForm.expiryDate);
      if (fileForm.keywords.trim()) fd.append('keywords', fileForm.keywords.trim());
      if (fileForm.remark.trim()) fd.append('remark', fileForm.remark.trim());
      const res = await request.post('/share-file/upload', fd, { timeout: 120000 });
      if (res?.code !== 200) return fail(res, '上传失败')
      ElMessage.success(tt('上传成功'));
    }
    fileVisible.value = false;
    await Promise.all([loadCats(), load()]);
  } catch (e) {
    fail(e, '上传失败');
  } finally {
    saving.value = false;
  }
}

async function onDeleteFile(row) {
  try {
    await ElMessageBox.confirm(`${tt('确认删除该文件？')}（${row.no} ${row.name}）`, tt('删除确认'), { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') });
  } catch { return }
  try {
    const res = await request.delete(`/share-file/${row.id}`);
    if (res?.code === 200) {
      ElMessage.success(tt('删除成功'));
      await Promise.all([loadCats(), load()]);
    } else fail(res, '删除失败');
  } catch (e) {
    fail(e, '删除失败');
  }
}

/** 预览:同「导出报表→打印预览」(previewServerReport) 机制——点击时同步开窗口占位
 *  (用户手势内,弹窗拦截器不拦),await 拿到文件后再呈现:
 *  图片/PDF/文本=blob 直指(浏览器原生渲染);docx=docx-preview 按需加载渲染成 HTML 写入占位窗;
 *  其余类型(含老 .doc)转下载。 */
async function openFile(row) {
  if (!row.attachmentId) return
  const type = row.contentType || '';
  const inlineable = type.startsWith('image/') || type.startsWith('text/')
    || type === 'application/pdf' || type === 'application/json';
  const docx = isDocx(row);
  if (!inlineable && !docx) {
    await downloadFile(row);
    ElMessage.info(tt('已开始下载'));
    return
  }
  const win = window.open('', '_blank');
  const loading = ElMessage({ message: tt('正在打开预览…'), duration: 0 });
  try {
    const blob = await request.get(`/attachment/${row.attachmentId}/download`, { responseType: 'blob', timeout: 120000 });
    if (docx) {
      if (!win) {
        triggerDownload(URL.createObjectURL(blob), row.fileName || row.name);
        ElMessage.warning(tt('浏览器拦截了新窗口，请允许弹出窗口'));
        return
      }
      try {
        await renderDocxToWindow(blob, row, win);
      } catch {
        // 渲染失败(老格式伪装 docx/文件损坏/极端排版)优雅降级为下载
        if (win) win.close();
        triggerDownload(URL.createObjectURL(blob), row.fileName || row.name);
        ElMessage.info(tt('该文件无法在线预览，已转为下载'));
      }
    } else {
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else {
        triggerDownload(url, row.fileName || row.name);
        ElMessage.warning(tt('浏览器拦截了新窗口，请允许弹出窗口'));
      }
    }
  } catch {
    if (win) win.close();
    ElMessage.error(tt('附件下载失败'));
  } finally {
    loading.close();
  }
}

/** .docx 识别:content_type(wordprocessingml)优先,扩展名兜底(历史行 content_type 可能缺失) */
function isDocx(row) {
  const type = row.contentType || '';
  if (type.includes('wordprocessingml')) return true
  return /\.docx$/i.test(String(row.fileName || row.name || ''))
}

/** docx → HTML 渲染进占位窗口:docx-preview 按需动态加载(不预览 Word 不下载这段代码);
 *  先在主文档隐藏容器渲染再序列化写入,避免第三方库跨 window 建 DOM 的兼容性问题。
 *  useBase64URL 把内嵌图片转 data URI,弹窗 HTML 自包含。 */
async function renderDocxToWindow(blob, row, win) {
  const { renderAsync } = await __vitePreload(async () => { const { renderAsync } = await import('./docx-preview-C1Hcu-oU.js');return { renderAsync }},true              ?__vite__mapDeps([0,1,2,3]):void 0);
  const buf = await blob.arrayBuffer();
  const bodyHost = document.createElement('div');
  const styleHost = document.createElement('div');
  bodyHost.style.display = 'none';
  styleHost.style.display = 'none';
  document.body.appendChild(bodyHost);
  document.body.appendChild(styleHost);
  try {
    await renderAsync(buf, bodyHost, styleHost, { inWrapper: true, useBase64URL: true });
    if (!bodyHost.innerHTML) throw new Error('docx 渲染结果为空')
    const title = row.fileName || row.name || '';
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    win.document.open();
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>'
      + '<style>body{margin:0;background:#525659;}</style>'
      + styleHost.innerHTML
      + '</head><body>' + bodyHost.innerHTML + '</body></html>'
    );
    win.document.close();
  } finally {
    bodyHost.remove();
    styleHost.remove();
  }
}

async function downloadFile(row) {
  if (!row.attachmentId) return
  try {
    const blob = await request.get(`/attachment/${row.attachmentId}/download`, { responseType: 'blob', timeout: 120000 });
    triggerDownload(URL.createObjectURL(blob), row.fileName || row.name);
  } catch {
    ElMessage.error(tt('附件下载失败'));
  }
}

function triggerDownload(url, name) {
  const el = document.createElement('a');
  el.href = url;
  el.download = name;
  el.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function fmtSize(n) {
  if (n == null) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

function fail(e, fallback) {
  const msg = e?.data?.message || e?.response?.data?.message || (typeof e?.message === 'string' && !e?.response ? e.message : '') || fallback;
  ElMessage.error(msg);
}

onMounted(async () => {
  await loadPerm();
  await Promise.all([loadCats(), load()]);
});

return (_ctx, _cache) => {
  const _component_el_tree = ElTree;
  const _component_el_button = ElButton;
  const _component_el_input = ElInput;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_pagination = ElPagination;
  const _component_el_tree_select = ElTreeSelect;
  const _component_el_form_item = ElFormItem;
  const _component_el_input_number = ElInputNumber;
  const _component_el_form = ElForm;
  const _component_el_dialog = ElDialog;
  const _component_el_date_picker = ElDatePicker;
  const _directive_loading = vLoading;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    createBaseVNode("div", _hoisted_2, [
      createBaseVNode("div", _hoisted_3, toDisplayString(unref(tt)('共享文件库')), 1),
      createBaseVNode("div", _hoisted_4, toDisplayString(unref(tt)('标准、测试报告、认证报告，指定人上传维护，其余仅查阅')), 1)
    ]),
    createBaseVNode("div", _hoisted_5, [
      createBaseVNode("div", _hoisted_6, [
        createBaseVNode("div", _hoisted_7, [
          createBaseVNode("span", null, toDisplayString(unref(tt)('分类')), 1),
          (perm.canMaintain)
            ? (openBlock(), createElementBlock("span", _hoisted_8, [
                createBaseVNode("span", {
                  title: unref(tt)('新增分类'),
                  onClick: _cache[0] || (_cache[0] = $event => (openCatDialog('add')))
                }, "＋", 8, _hoisted_9),
                createBaseVNode("span", {
                  title: unref(tt)('编辑分类'),
                  class: normalizeClass({ dim: !selCat.value }),
                  onClick: _cache[1] || (_cache[1] = $event => (openCatDialog('edit')))
                }, "✎", 10, _hoisted_10),
                createBaseVNode("span", {
                  title: unref(tt)('删除'),
                  class: normalizeClass({ dim: !selCat.value }),
                  onClick: onDeleteCat
                }, "✕", 10, _hoisted_11)
              ]))
            : createCommentVNode("", true)
        ]),
        createBaseVNode("div", _hoisted_12, [
          createBaseVNode("div", {
            class: normalizeClass(["sf-tree-node", { on: !catId.value }]),
            onClick: _cache[2] || (_cache[2] = $event => (pickCat(null)))
          }, [
            createBaseVNode("span", _hoisted_13, toDisplayString(unref(tt)('全部文件')), 1),
            createBaseVNode("span", _hoisted_14, toDisplayString(totalAll.value), 1)
          ], 2),
          createVNode(_component_el_tree, {
            data: catTree.value,
            "node-key": "id",
            "expand-on-click-node": false,
            "default-expand-all": "",
            "highlight-current": true,
            "current-node-key": catId.value || undefined,
            onCurrentChange: _cache[3] || (_cache[3] = (d) => d && pickCat(d.id))
          }, {
            default: withCtx(({ data }) => [
              createBaseVNode("div", {
                class: normalizeClass(["sf-tree-node", { on: data.id === catId.value }])
              }, [
                createBaseVNode("span", {
                  class: "sf-tree-name",
                  title: data.label
                }, toDisplayString(data.label), 9, _hoisted_15),
                createBaseVNode("span", _hoisted_16, toDisplayString(data.count), 1)
              ], 2)
            ]),
            _: 1
          }, 8, ["data", "current-node-key"])
        ])
      ]),
      createBaseVNode("div", _hoisted_17, [
        createBaseVNode("div", _hoisted_18, [
          (perm.canUpload)
            ? (openBlock(), createBlock(_component_el_button, {
                key: 0,
                type: "primary",
                size: "small",
                icon: unref(upload_filled_default),
                onClick: _cache[4] || (_cache[4] = $event => (openFileDialog()))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('上传')), 1)
                ]),
                _: 1
              }, 8, ["icon"]))
            : createCommentVNode("", true),
          createVNode(_component_el_input, {
            modelValue: keyword.value,
            "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((keyword).value = $event)),
            size: "small",
            clearable: "",
            style: {"width":"260px"},
            placeholder: unref(tt)('搜索：名称/关键词/备注'),
            onKeyup: withKeys(reload, ["enter"]),
            onClear: reload
          }, null, 8, ["modelValue", "placeholder"]),
          createVNode(_component_el_button, {
            size: "small",
            icon: unref(search_default),
            onClick: reload
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('搜索')), 1)
            ]),
            _: 1
          }, 8, ["icon"]),
          createBaseVNode("span", _hoisted_19, toDisplayString(unref(tt)('共')) + " " + toDisplayString(total.value) + " " + toDisplayString(unref(tt)('份文件')), 1)
        ]),
        withDirectives((openBlock(), createBlock(_component_el_table, {
          data: rows.value,
          border: "",
          size: "small",
          "empty-text": unref(tt)('暂无文件')
        }, {
          default: withCtx(() => [
            createVNode(_component_el_table_column, {
              prop: "name",
              label: unref(tt)('文件名称'),
              "min-width": "220",
              "show-overflow-tooltip": ""
            }, {
              default: withCtx(({ row }) => [
                (row.attachmentId)
                  ? (openBlock(), createElementBlock("span", {
                      key: 0,
                      class: "sf-file-link",
                      title: unref(tt)('预览'),
                      onClick: $event => (openFile(row))
                    }, toDisplayString(row.name), 9, _hoisted_20))
                  : (openBlock(), createElementBlock("span", _hoisted_21, toDisplayString(row.name), 1))
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "catPath",
              label: unref(tt)('分类'),
              "min-width": "140",
              "show-overflow-tooltip": ""
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "version",
              label: unref(tt)('版本号'),
              width: "90",
              align: "center"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "effectiveDate",
              label: unref(tt)('生效日期'),
              width: "100",
              align: "center"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "expiryDate",
              label: unref(tt)('失效日期'),
              width: "100",
              align: "center"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              label: unref(tt)('大小'),
              width: "90",
              align: "right"
            }, {
              default: withCtx(({ row }) => [
                createTextVNode(toDisplayString(fmtSize(row.fileSize)), 1)
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "uploader",
              label: unref(tt)('上传人'),
              width: "80",
              align: "center"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              prop: "uploadTime",
              label: unref(tt)('上传时间'),
              width: "140",
              align: "center"
            }, null, 8, ["label"]),
            createVNode(_component_el_table_column, {
              label: unref(tt)('操作'),
              width: "170",
              align: "center",
              fixed: "right"
            }, {
              default: withCtx(({ row }) => [
                (row.attachmentId)
                  ? (openBlock(), createBlock(_component_el_button, {
                      key: 0,
                      link: "",
                      type: "primary",
                      size: "small",
                      onClick: $event => (openFile(row))
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(unref(tt)('预览')), 1)
                      ]),
                      _: 1
                    }, 8, ["onClick"]))
                  : createCommentVNode("", true),
                (row.attachmentId)
                  ? (openBlock(), createBlock(_component_el_button, {
                      key: 1,
                      link: "",
                      type: "primary",
                      size: "small",
                      onClick: $event => (downloadFile(row))
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(unref(tt)('下载')), 1)
                      ]),
                      _: 1
                    }, 8, ["onClick"]))
                  : createCommentVNode("", true),
                (perm.canUpload)
                  ? (openBlock(), createBlock(_component_el_button, {
                      key: 2,
                      link: "",
                      type: "primary",
                      size: "small",
                      onClick: $event => (openFileDialog(row))
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(unref(tt)('编辑')), 1)
                      ]),
                      _: 1
                    }, 8, ["onClick"]))
                  : createCommentVNode("", true),
                (perm.canDelete)
                  ? (openBlock(), createBlock(_component_el_button, {
                      key: 3,
                      link: "",
                      type: "danger",
                      size: "small",
                      onClick: $event => (onDeleteFile(row))
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(unref(tt)('删除')), 1)
                      ]),
                      _: 1
                    }, 8, ["onClick"]))
                  : createCommentVNode("", true)
              ]),
              _: 1
            }, 8, ["label"])
          ]),
          _: 1
        }, 8, ["data", "empty-text"])), [
          [_directive_loading, loading.value]
        ]),
        createBaseVNode("div", _hoisted_22, [
          createVNode(_component_el_pagination, {
            small: "",
            background: "",
            layout: "total, sizes, prev, pager, next, jumper",
            total: total.value,
            "current-page": pageNo.value,
            "onUpdate:currentPage": _cache[6] || (_cache[6] = $event => ((pageNo).value = $event)),
            "page-size": pageSize.value,
            "onUpdate:pageSize": _cache[7] || (_cache[7] = $event => ((pageSize).value = $event)),
            "page-sizes": [20, 50, 100],
            onSizeChange: reload,
            onCurrentChange: load
          }, null, 8, ["total", "current-page", "page-size"])
        ])
      ])
    ]),
    createVNode(_component_el_dialog, {
      modelValue: catVisible.value,
      "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => ((catVisible).value = $event)),
      title: catMode.value === 'add' ? unref(tt)('新增分类') : unref(tt)('编辑分类'),
      width: "420px",
      "append-to-body": "",
      "close-on-click-modal": false
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[11] || (_cache[11] = $event => (catVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: saving.value,
          onClick: saveCat
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('保存')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createVNode(_component_el_form, {
          "label-width": "90px",
          size: "small"
        }, {
          default: withCtx(() => [
            createVNode(_component_el_form_item, {
              label: unref(tt)('上级分类')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_tree_select, {
                  modelValue: catForm.parentId,
                  "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((catForm.parentId) = $event)),
                  data: catParentOptions.value,
                  "check-strictly": "",
                  "render-after-expand": false,
                  style: {"width":"100%"},
                  placeholder: unref(tt)('一级分类'),
                  clearable: ""
                }, null, 8, ["modelValue", "data", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('分类名称'),
              required: ""
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: catForm.name,
                  "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((catForm.name) = $event)),
                  placeholder: unref(tt)('请输入分类名称'),
                  maxlength: "100"
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('排序')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input_number, {
                  modelValue: catForm.seq,
                  "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((catForm.seq) = $event)),
                  controls: false,
                  style: {"width":"140px"}
                }, null, 8, ["modelValue"])
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
      modelValue: fileVisible.value,
      "onUpdate:modelValue": _cache[22] || (_cache[22] = $event => ((fileVisible).value = $event)),
      title: fileForm.id ? unref(tt)('编辑') : unref(tt)('上传'),
      width: "520px",
      "append-to-body": "",
      "close-on-click-modal": false
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[21] || (_cache[21] = $event => (fileVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: saving.value,
          onClick: saveFile
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('保存')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createVNode(_component_el_form, {
          "label-width": "90px",
          size: "small"
        }, {
          default: withCtx(() => [
            createVNode(_component_el_form_item, {
              label: unref(tt)('分类'),
              required: ""
            }, {
              default: withCtx(() => [
                createVNode(_component_el_tree_select, {
                  modelValue: fileForm.catId,
                  "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((fileForm.catId) = $event)),
                  data: catPickOptions.value,
                  "check-strictly": "",
                  "render-after-expand": false,
                  style: {"width":"100%"},
                  placeholder: unref(tt)('请选择分类')
                }, null, 8, ["modelValue", "data", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('文件名称'),
              required: ""
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: fileForm.name,
                  "onUpdate:modelValue": _cache[14] || (_cache[14] = $event => ((fileForm.name) = $event)),
                  placeholder: unref(tt)('请输入文件名称'),
                  maxlength: "200"
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('版本号')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: fileForm.version,
                  "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => ((fileForm.version) = $event)),
                  placeholder: unref(tt)('如 2024版或V2.1'),
                  maxlength: "50",
                  style: {"width":"200px"}
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('生效日期')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_date_picker, {
                  modelValue: fileForm.effectiveDate,
                  "onUpdate:modelValue": _cache[16] || (_cache[16] = $event => ((fileForm.effectiveDate) = $event)),
                  type: "date",
                  "value-format": "YYYY-MM-DD",
                  style: {"width":"160px"}
                }, null, 8, ["modelValue"]),
                createBaseVNode("span", _hoisted_23, toDisplayString(unref(tt)('失效日期')), 1),
                createVNode(_component_el_date_picker, {
                  modelValue: fileForm.expiryDate,
                  "onUpdate:modelValue": _cache[17] || (_cache[17] = $event => ((fileForm.expiryDate) = $event)),
                  type: "date",
                  "value-format": "YYYY-MM-DD",
                  style: {"width":"160px"}
                }, null, 8, ["modelValue"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('关键词')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: fileForm.keywords,
                  "onUpdate:modelValue": _cache[18] || (_cache[18] = $event => ((fileForm.keywords) = $event)),
                  placeholder: unref(tt)('检索用，空格分隔多词'),
                  maxlength: "200"
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('备注')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: fileForm.remark,
                  "onUpdate:modelValue": _cache[19] || (_cache[19] = $event => ((fileForm.remark) = $event)),
                  type: "textarea",
                  rows: 2,
                  maxlength: "500"
                }, null, 8, ["modelValue"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: fileForm.id ? unref(tt)('替换文件') : unref(tt)('文件'),
              required: !fileForm.id
            }, {
              default: withCtx(() => [
                createBaseVNode("input", {
                  ref_key: "fileInput",
                  ref: fileInput,
                  type: "file",
                  hidden: "",
                  onChange: onPickFile
                }, null, 544),
                createVNode(_component_el_button, {
                  size: "small",
                  onClick: _cache[20] || (_cache[20] = $event => (fileInput.value?.click()))
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(fileForm.id ? unref(tt)('选择文件') : unref(tt)('请选择文件')), 1)
                  ]),
                  _: 1
                }),
                (pickedName.value)
                  ? (openBlock(), createElementBlock("span", {
                      key: 0,
                      class: "sf-picked",
                      title: pickedName.value
                    }, toDisplayString(pickedName.value), 9, _hoisted_24))
                  : createCommentVNode("", true)
              ]),
              _: 1
            }, 8, ["label", "required"])
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue", "title"])
  ]))
}
}

};
const ShareFileCenter = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-4f1cf87d"]]);

export { ShareFileCenter as default };
