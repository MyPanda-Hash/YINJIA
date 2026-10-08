import { d as ElButton, $ as ElTree, j as ElTable, n as ElSelect, S as ElCollapse, k as ElMessage, f as ElDialog, g as ElTableColumn, c as ElTag, o as ElOption, T as ElCollapseItem, D as ElCheckbox, w as ElForm, m as ElFormItem, a0 as ElTreeSelect, i as ElInput, t as ElSwitch, l as ElMessageBox } from './element-plus-W84rT0en.js';
import { c as useUserStore, t as tt, r as request } from './index-CqmwEeWF.js';
/* empty css                   */
/* empty css                      */
/* empty css                   */
/* empty css                */
/* empty css                   */
/* empty css                        */
/* empty css                          */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
import { q as onMounted, a5 as onUnmounted, D as onBeforeUnmount, c as createElementBlock, a as createBaseVNode, $ as toDisplayString, A as unref, a0 as createVNode, W as withCtx, _ as createTextVNode, J as Fragment, Z as createCommentVNode, p as ref, z as reactive, f as computed, o as openBlock, ac as withModifiers, P as createBlock, ae as renderList } from './vue-vendor-DyX2BAKf.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';
import './element-icons-DOEvq9OG.js';

/* unplugin-vue-components disabled */

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "org-wrap" };
const _hoisted_2 = { class: "org-col dept" };
const _hoisted_3 = { class: "col-head" };
const _hoisted_4 = { class: "col-title" };
const _hoisted_5 = { class: "dept-node" };
const _hoisted_6 = { class: "col-tip" };
const _hoisted_7 = { class: "org-col users" };
const _hoisted_8 = { class: "col-head" };
const _hoisted_9 = { class: "col-title" };
const _hoisted_10 = { class: "col-head-btns" };
const _hoisted_11 = { class: "col-tip" };
const _hoisted_12 = { class: "org-col roles" };
const _hoisted_13 = { class: "col-head" };
const _hoisted_14 = { class: "col-title" };
const _hoisted_15 = { key: 1 };
const _hoisted_16 = {
  key: 0,
  class: "perm-box"
};
const _hoisted_17 = { class: "perm-head" };
const _hoisted_18 = { class: "perm-sub" };
const _hoisted_19 = { class: "perm-copy" };
const _hoisted_20 = {
  key: 0,
  class: "admin-tip"
};
const _hoisted_21 = {
  key: 0,
  class: "result-banner"
};
const _hoisted_22 = { class: "g-title" };
const _hoisted_23 = { class: "g-count" };
const _hoisted_24 = { class: "g-granted" };
const _hoisted_25 = { class: "perm-table-wrap" };
const _hoisted_26 = { class: "perm-table" };
const _hoisted_27 = { class: "pt-panel" };
const _hoisted_28 = ["title"];
const _hoisted_29 = { class: "pt-all" };
const _hoisted_30 = { class: "pt-panel" };
const _hoisted_31 = ["onMousedown", "onMouseenter"];
const _hoisted_32 = ["checked", "disabled"];
const _hoisted_33 = {
  key: 1,
  class: "pt-na"
};
const _hoisted_34 = { class: "pt-all" };
const _hoisted_35 = { class: "perm-actions" };
const _hoisted_36 = { class: "paint-tip" };
const _hoisted_37 = { class: "batch-tip" };

const ALL_COL = '__all__';

const _sfc_main = {
  __name: 'OrgAdmin',
  setup(__props) {

const user = useUserStore();

// YINJIA-MES 适配:面板模块分组由后端按真实模块(yj_panel.module_group,
// 对齐 HSDZ permission.GROP)返回,前端不再硬编码 light-mes 面板清单
const panelModules = ref([]);
const openGroups = ref([]);
const permActions = ref([]);  // [['view','可见'],['query','查询'],...]

function applyPanelModules(modules, actions) {
  panelModules.value = (modules || []).filter((m) => (m.panels || []).length);
  openGroups.value = panelModules.value.map((m) => m.code);
  permActions.value = actions || [];
}

// 按模块分组渲染（行对象与 panelRows 同引用，勾选联动保存）
const groupedPanels = computed(() => {
  const rowsByCode = {};
  for (const r of panelRows.value) rowsByCode[r.panelCode] = r;
  const buckets = panelModules.value.map((m) => ({
    code: m.code,
    name: m.name,
    panels: (m.panels || []).map((p) => rowsByCode[p.panelCode]).filter(Boolean),
  }));
  const known = new Set(buckets.flatMap((b) => b.panels.map((p) => p.panelCode)));
  const other = { code: 'other', name: '其他', panels: panelRows.value.filter((r) => !known.has(r.panelCode)) };
  return other.panels.length ? buckets.concat(other) : buckets
});

// ---- 操作权限工具(行对象 permsSet 为 Set;动作集按行,文件面板 8 项/通用面板 11 项) ----
/** 组内动作列 = 成员行动作集的并集(保序去重);同组混合时不适用的格显示 — */
function groupActs(g) {
  const seen = new Set();
  const out = [];
  for (const r of g.panels) {
    for (const a of r.actions || []) {
      if (!seen.has(a[0])) { seen.add(a[0]); out.push(a); }
    }
  }
  return out
}
function rowHasAct(row, code) {
  return (row.actions || []).some((a) => a[0] === code)
}
/** 组内动作列缓存(computed 一次),避免每格每轮渲染重算并集导致卡顿 */
const groupActsMap = computed(() => {
  const m = {};
  for (const g of groupedPanels.value) m[g.code] = groupActs(g);
  return m
});
function actsOf(g) {
  return groupActsMap.value[g.code] || []
}
/** 该格可操作:可见列恒可操作,其余需先勾可见 */
function canAct(row, code) {
  return code === 'view' || hasPerm(row, 'view')
}
// ---------- 滑动勾选:按下即切换,按住拖过多格批量套用同一状态 ----------
const sweeping = ref(false);
const sweepMode = ref(true);
function startSweep(row, code) {
  sweeping.value = true;
  sweepMode.value = !hasPerm(row, code);
  togglePerm(row, code, sweepMode.value);
}
function sweepOver(row, code) {
  if (!sweeping.value || !canAct(row, code)) return
  if (hasPerm(row, code) !== sweepMode.value) togglePerm(row, code, sweepMode.value);
}
function stopSweep() {
  sweeping.value = false;
}
onMounted(() => window.addEventListener('mouseup', stopSweep));
onUnmounted(() => window.removeEventListener('mouseup', stopSweep));
function hasPerm(row, code) {
  return row.permsSet ? row.permsSet.has(code) : false
}
function togglePerm(row, code, val) {
  if (!row.permsSet) row.permsSet = new Set();
  if (val) {
    row.permsSet.add(code);
    if (code !== 'view') row.permsSet.add('view'); // 其他权限隐含可见
  } else {
    row.permsSet.delete(code);
    if (code === 'view') row.permsSet.clear(); // 取消可见则清空全部
  }
}
function isAllPerms(row) {
  return (row.actions || []).length > 0 && row.actions.every((a) => row.permsSet && row.permsSet.has(a[0]))
}
function toggleAllPerms(row, val) {
  if (val) {
    row.permsSet = new Set(row.actions.map((a) => a[0]));
  } else {
    row.permsSet = new Set();
  }
}
function setGroupPerms(g, mode) {
  for (const r of g.panels) {
    if (mode === 'all') r.permsSet = new Set(r.actions.map((a) => a[0]));
    else r.permsSet = new Set();
  }
  refreshHeadMarks();
}

// ---- 组头已勾计数(2026-09-28):勾选进度即时反馈,防盲选 ----
function grantedOf(g) {
  let n = 0;
  for (const r of g.panels) for (const a of r.actions || []) if (hasPerm(r, a[0])) n++;
  return n
}
function grantableOf(g) {
  let n = 0;
  for (const r of g.panels) n += (r.actions || []).length;
  return n
}

// ---- 拖动框选:按住左键拉出矩形,框内格子实时应用按下格的状态;框缩小则实时回退 ----
// 语义:pointerdown 切换按下格并记下"涂选值"(单击=只切换该格,无反馈标识);
// 移动超过阈值后出现框选矩形,矩形当前覆盖到的格子应用涂选值,退出覆盖的格恢复拖动前状态
// —— 最终结果恒等于松手时框住的格子,与常规框选体验一致。
// 滚动:拖动中指针到达滚动容器上下边缘自动滚动;滚轮滚动同样实时跟进(锚点按内容坐标存储)。
// 性能:拖动周期内的一切 UI(显隐/矩形/徽标/面板 painting 类/列头三态)全部直接操作 DOM,
// 不经 Vue 响应式——否则按下/松手/每次移动都会触发本组件(744 格+部门树+用户表+130 个
// 下拉列头)全量重渲染,dev 模式单次 ~300ms,是拖动卡顿的根因。
const rectRef = ref(null);
const badgeRef = ref(null);
function onPaintMove(e) {
  return
}
function onPaintUp() {
  return
}
function onPaintScroll() {
}

// ---- 列头三态下拉:全勾✓/部分"−"/全空(无标) → 菜单批量设置仅作用于当前模块分组 ----
// 性能:三态标记永远读"快照缓存"(普通 Map,非响应式)——thead 不实时依赖行 permsSet,
// 否则任何一格变更都会把 OrgAdmin(整个页面,dev 模式单次渲染 ~300ms)拉进重渲染。
// 缓存在权限变化点(拖动起止/菜单命令/分组按钮/载入)由 refreshHeadMarks() 重建,
// 并直接同步到 DOM(130 个标记节点,<1ms);菜单打开时弹层按当前缓存惰性渲染,天然新鲜。
let headMarkCache = new Map(); // 分组 panels 数组 -> col -> {mark, cls, text}
function buildHeadMarkCache() {
  headMarkCache = new Map();
  const cols = [ALL_COL, ...permActions.value.map((a) => a[0])];
  for (const g of groupedPanels.value) {
    const m = new Map();
    for (const c of cols) {
      const n = colCount(g.panels, c);
      const total = g.panels.length;
      m.set(c, {
        mark: n === 0 ? '' : n === total ? '✓' : '−',
        cls: n === 0 ? '' : n === total ? 'is-all' : 'is-part',
        text: n + '/' + total + ' ' + tt('已选'),
      });
    }
    headMarkCache.set(g.panels, m);
  }
}
/** 重建三态快照并直接同步到列头 DOM(不经 Vue 重渲染) */
function refreshHeadMarks() {
  buildHeadMarkCache();
  const items = document.querySelectorAll('.perm-collapse .el-collapse-item');
  groupedPanels.value.forEach((g, idx) => {
    const table = items[idx] && items[idx].querySelector('.perm-table');
    const m = headMarkCache.get(g.panels);
    if (!table || !m) return
    table.querySelectorAll('thead th[data-col]').forEach((th) => {
      const info = m.get(th.dataset.col);
      if (!info) return
      const caret = th.querySelector('.pt-head-caret');
      if (caret) {
        caret.classList.toggle('is-all', info.cls === 'is-all');
        caret.classList.toggle('is-part', info.cls === 'is-part');
      }
      const mark = th.querySelector('.pt-head-mark');
      if (mark) mark.textContent = info.mark;
    });
  });
}
function colCount(panels, col) {
  if (col === ALL_COL) return panels.filter((r) => isAllPerms(r)).length
  return panels.filter((r) => hasPerm(r, col)).length
}

// ---- 批量操作结果反馈:浅绿色横幅(4 秒自动消退) ----
const resultBanner = ref('');

const deptTree = ref([]);
const deptVisible = ref(false);
const editingDept = ref(null);
const savingDept = ref(false);
const deptForm = reactive({ id: null, parentId: 0, deptName: '' });

const users = ref([]);
const roles = ref([]);

// ---------- 用户批量分配角色 ----------
const userSel = ref([]);
function onUserSel(rows) {
  userSel.value = rows || [];
}
const batchRoleVisible = ref(false);
const batchRoleId = ref(null);
async function applyBatchRole() {
  try {
    await request.post('/sys/user/batch-role', { userIds: userSel.value.map((u) => u.id), roleId: batchRoleId.value });
    ElMessage.success(`${tt('已为')} ${userSel.value.length} ${tt('个用户分配角色')}`);
    batchRoleVisible.value = false;
    batchRoleId.value = null;
    await loadUsers();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('批量分配失败'));
  }
}

// ---------- 复制角色权限(把源角色勾选载入当前编辑,保存后生效) ----------
const copyFromRoleId = ref(null);
const copyableRoles = computed(() => roles.value.filter((r) => !r.isAdmin && selRole.value && r.id !== selRole.value.id));
async function copyRolePerms() {
  const src = roles.value.find((r) => r.id === copyFromRoleId.value);
  if (!src) return
  try {
    await ElMessageBox.confirm(
      `${tt('将用')}「${src.roleName}」${tt('的面板权限覆盖当前编辑内容？')}${tt('保存后生效')}`,
      tt('复制权限'),
      { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
    );
  } catch (e) {
    return
  }
  try {
    const r = await request.get('/sys/role/' + src.id + '/panels');
    const granted = r?.data?.granted || [];
    const byCode = {};
    for (const g of granted) byCode[g.panelCode] = g.perms || '';
    for (const p of panelRows.value) {
      p.permsSet = new Set((byCode[p.panelCode] || '').split(',').filter(Boolean));
    }
    ElMessage.success(`${tt('已复制')}「${src.roleName}」${tt('的权限，确认无误后请保存')}`);
  } catch (e) {
    ElMessage.error(tt('复制权限失败'));
  }
}
const selRole = ref(null);
const panelRows = ref([]);
const saving = ref(false);
const savingUser = ref(false);
const savingRole = ref(false);

const userVisible = ref(false);
const editingUser = ref(null);
const userForm = reactive({ userName: '', realName: '', password: '', deptId: null, roleId: null, workshop: '', enabled: 1 });
const workshops = ref([]);
const newRoleVisible = ref(false);
const roleForm = reactive({ roleCode: '', roleName: '', remark: '' });

// el-tree-select 数据（value/label/children）
const deptSelectData = computed(() => toSelect(deptTree.value));
function toSelect(nodes) {
  return (nodes || []).map((n) => ({
    value: n.id,
    label: n.deptName,
    children: n.children && n.children.length ? toSelect(n.children) : undefined,
  }))
}

async function load() {
  await Promise.all([loadDepts(), loadUsers(), loadRoles()]);
}

async function loadDepts() {
  try {
    const r = await request.get('/sys/dept/tree');
    deptTree.value = r?.data || [];
  } catch (e) {
    ElMessage.error(tt('部门加载失败'));
  }
}

async function loadUsers() {
  try {
    const r = await request.get('/sys/user/list');
    users.value = r?.data || [];
  } catch (e) {
    ElMessage.error(tt('用户列表加载失败'));
  }
}

async function loadRoles() {
  try {
    const r = await request.get('/sys/role/list');
    roles.value = r?.data || [];
  } catch (e) {
    ElMessage.error(tt('角色列表加载失败'));
  }
}

function onDeptClick() {}

function newDept(parentId) {
  editingDept.value = null;
  deptForm.id = null;
  deptForm.parentId = parentId;
  deptForm.deptName = '';
  deptVisible.value = true;
}

function editDept(d) {
  editingDept.value = d;
  deptForm.id = d.id;
  deptForm.parentId = d.parentId;
  deptForm.deptName = d.deptName;
  deptVisible.value = true;
}

async function saveDept() {
  if (!deptForm.deptName.trim()) return ElMessage.warning(tt('请输入部门名称'))
  savingDept.value = true;
  try {
    await request.post('/sys/dept/save', { id: deptForm.id, parentId: deptForm.parentId || 0, deptName: deptForm.deptName });
    ElMessage.success(tt('部门已保存'));
    deptVisible.value = false;
    await loadDepts();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('保存失败'));
  } finally {
    savingDept.value = false;
  }
}

async function delDept(d) {
  try {
    await ElMessageBox.confirm(
      tt('删除部门「{name}」？').replace('{name}', d.deptName),
      tt('提示'),
      { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
    );
  } catch (e) {
    return
  }
  try {
    await request.delete('/sys/dept/' + d.id);
    ElMessage.success(tt('部门已删除'));
    await loadDepts();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('删除失败'));
  }
}

/** 可删的账号:管理员账号与当前登录账号不给删(服务端同样拦,这里只是不显示按钮) */
function canDelUser(row) {
  return !!row && !row.isAdmin && String(row.userName) !== String(user.account || '')
}

/**
 * 删除账号(物理删除 yj_user 行)。
 * 历史单据上的制单人/审核人存的是账号与姓名**文本**,不随账号消失而改变 —— 故弹窗里明确写清
 * "历史单据记录不受影响",避免用户以为会把单据一起删掉而不敢用。
 * 确认按钮文案走 tt()(ElMessageBox 默认按钮文案来自 Element Plus 自带语言包,不随本系统切语言)。
 */
async function delUser(row) {
  try {
    await ElMessageBox.confirm(
      tt('删除账号「{name}」？删除后该账号无法再登录，历史单据上的记录不受影响。').replace('{name}', row.userName),
      tt('提示'),
      { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
    );
  } catch (e) {
    return
  }
  try {
    await request.delete('/sys/user/' + row.id);
    ElMessage.success(tt('账号已删除'));
    if (editingUser.value && editingUser.value.id === row.id) editingUser.value = null;
    userSel.value = [];
    await loadUsers();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('删除失败'));
  }
}

function openUser(row) {
  editingUser.value = row || null;
  userForm.userName = row?.userName || '';
  userForm.realName = row?.realName || '';
  userForm.password = '';
  userForm.deptId = row?.deptId ?? null;
  userForm.roleId = row?.roleId ?? null;
  userForm.workshop = row?.workshop || '';
  userForm.enabled = row?.enabled ?? 1;
  loadWorkshops();
  userVisible.value = true;
}

/** 车间下拉 = 生产线档案里出现过的车间(取值域同 bs_prod_line.生产车间) */
async function loadWorkshops() {
  if (workshops.value.length) return
  try {
    const res = await request.post('/px/scheduleBoard/workshops', {});
    workshops.value = (res.data || []).map((x) => x['车间']).filter(Boolean);
  } catch { /* 不阻断 */ }
}

async function saveUser() {
  if (!userForm.userName.trim()) return ElMessage.warning(tt('请输入账号'))
  savingUser.value = true;
  try {
    const body = { ...userForm };
    if (editingUser.value) body.id = editingUser.value.id;
    await request.post('/sys/user/save', body);
    ElMessage.success(tt('用户已保存'));
    userVisible.value = false;
    await loadUsers();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('保存失败'));
  } finally {
    savingUser.value = false;
  }
}

async function saveRole() {
  if (!roleForm.roleCode.trim() || !roleForm.roleName.trim()) return ElMessage.warning(tt('请填写编码与名称'))
  savingRole.value = true;
  try {
    await request.post('/sys/role/save', { ...roleForm });
    ElMessage.success(tt('角色已创建'));
    newRoleVisible.value = false;
    roleForm.roleCode = '';
    roleForm.roleName = '';
    roleForm.remark = '';
    await loadRoles();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('创建失败'));
  } finally {
    savingRole.value = false;
  }
}

async function delRole(row) {
  try {
    await ElMessageBox.confirm(
      tt('删除角色「{name}」？其下用户角色将清空').replace('{name}', row.roleName),
      tt('提示'),
      { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
    );
  } catch (e) {
    return
  }
  try {
    await request.delete('/sys/role/' + row.id);
    ElMessage.success(tt('角色已删除'));
    if (selRole.value && selRole.value.id === row.id) {
      selRole.value = null;
      panelRows.value = [];
    }
    await loadRoles();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('删除失败'));
  }
}

async function onRoleSelect(row) {
  selRole.value = row;
  if (row && !row.isAdmin) await loadRolePanels(row);
}

async function loadRolePanels(row) {
  try {
    const r = await request.get('/sys/role/' + row.id + '/panels');
    const d = r?.data || {};
    applyPanelModules(d.modules, d.actions);
    const all = (d.modules || []).flatMap((m) => m.panels || []);
    const granted = d.granted || [];
    const grantedPerms = {};
    for (const g of granted) grantedPerms[g.panelCode] = g.perms || '';
    panelRows.value = all.map((p) => ({
      panelCode: p.panelCode,
      panelName: p.panelName,
      hasApproval: !!p.hasApproval,
      // 面板级动作集:文件类=专属 8 项(按真实操作行为),其余=通用 11 项
      actions: (p.actions && p.actions.length ? p.actions : permActions.value),
      permsSet: new Set((grantedPerms[p.panelCode] || '').split(',').filter(Boolean)),
    }));
    buildHeadMarkCache(); // 首次渲染前备好快照(thead 三态绑定读缓存)
  } catch (e) {
    ElMessage.error(tt('面板权限加载失败'));
  }
}

async function savePanels() {
  saving.value = true;
  try {
    const panels = panelRows.value
      .filter((p) => p.permsSet && p.permsSet.size > 0)
      .map((p) => ({ panelCode: p.panelCode, perms: [...p.permsSet].join(',') }));
    await request.post('/sys/role/' + selRole.value.id + '/panels', { panels });
    ElMessage.success(tt('面板权限已保存'));
    if (selRole.value.roleCode === user.roleCode) await user.fetchPerms();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('保存失败'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  load();
  window.addEventListener('pointermove', onPaintMove);
  window.addEventListener('pointerup', onPaintUp);
  window.addEventListener('scroll', onPaintScroll, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPaintMove);
  window.removeEventListener('pointerup', onPaintUp);
  window.removeEventListener('scroll', onPaintScroll, true);
});

return (_ctx, _cache) => {
  const _component_el_button = ElButton;
  const _component_el_tree = ElTree;
  const _component_el_table_column = ElTableColumn;
  const _component_el_tag = ElTag;
  const _component_el_table = ElTable;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_checkbox = ElCheckbox;
  const _component_el_collapse_item = ElCollapseItem;
  const _component_el_collapse = ElCollapse;
  const _component_el_dialog = ElDialog;
  const _component_el_tree_select = ElTreeSelect;
  const _component_el_form_item = ElFormItem;
  const _component_el_input = ElInput;
  const _component_el_form = ElForm;
  const _component_el_switch = ElSwitch;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    createBaseVNode("div", _hoisted_2, [
      createBaseVNode("div", _hoisted_3, [
        createBaseVNode("span", _hoisted_4, toDisplayString(unref(tt)('部门')), 1),
        createVNode(_component_el_button, {
          type: "primary",
          size: "small",
          onClick: _cache[0] || (_cache[0] = $event => (newDept(0)))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('新增部门')), 1)
          ]),
          _: 1
        })
      ]),
      createVNode(_component_el_tree, {
        class: "dept-tree",
        data: deptTree.value,
        "node-key": "id",
        props: { label: 'deptName', children: 'children' },
        "highlight-current": "",
        "expand-on-click-node": false,
        onNodeClick: onDeptClick
      }, {
        default: withCtx(({ data }) => [
          createBaseVNode("div", _hoisted_5, [
            createBaseVNode("span", null, toDisplayString(data.deptName), 1),
            createBaseVNode("span", {
              class: "dept-ops",
              onClick: _cache[1] || (_cache[1] = withModifiers(() => {}, ["stop"]))
            }, [
              createVNode(_component_el_button, {
                size: "small",
                link: "",
                type: "primary",
                onClick: $event => (newDept(data.id))
              }, {
                default: withCtx(() => [
                  createTextVNode("+" + toDisplayString(unref(tt)('子')), 1)
                ]),
                _: 1
              }, 8, ["onClick"]),
              createVNode(_component_el_button, {
                size: "small",
                link: "",
                type: "primary",
                onClick: $event => (editDept(data))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('改')), 1)
                ]),
                _: 1
              }, 8, ["onClick"]),
              (data.id !== 1)
                ? (openBlock(), createBlock(_component_el_button, {
                    key: 0,
                    size: "small",
                    link: "",
                    type: "danger",
                    onClick: $event => (delDept(data))
                  }, {
                    default: withCtx(() => [
                      createTextVNode(toDisplayString(unref(tt)('删')), 1)
                    ]),
                    _: 1
                  }, 8, ["onClick"]))
                : createCommentVNode("", true)
            ])
          ])
        ]),
        _: 1
      }, 8, ["data"]),
      createBaseVNode("div", _hoisted_6, toDisplayString(unref(tt)('支持多级部门；「+子」新增下级部门')), 1)
    ]),
    createBaseVNode("div", _hoisted_7, [
      createBaseVNode("div", _hoisted_8, [
        createBaseVNode("span", _hoisted_9, toDisplayString(unref(tt)('用户（组织调整）')), 1),
        createBaseVNode("span", _hoisted_10, [
          createVNode(_component_el_button, {
            size: "small",
            disabled: !userSel.value.length,
            onClick: _cache[2] || (_cache[2] = $event => (batchRoleVisible.value = true))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('批量分配角色')) + "(" + toDisplayString(userSel.value.length) + ")", 1)
            ]),
            _: 1
          }, 8, ["disabled"]),
          createVNode(_component_el_button, {
            type: "primary",
            size: "small",
            onClick: _cache[3] || (_cache[3] = $event => (openUser()))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('新增用户')), 1)
            ]),
            _: 1
          })
        ])
      ]),
      createVNode(_component_el_table, {
        data: users.value,
        size: "small",
        border: "",
        height: "620",
        "highlight-current-row": "",
        onRowClick: openUser,
        onSelectionChange: onUserSel
      }, {
        default: withCtx(() => [
          createVNode(_component_el_table_column, {
            type: "selection",
            width: "38",
            selectable: (row) => !row.isAdmin
          }, null, 8, ["selectable"]),
          createVNode(_component_el_table_column, {
            prop: "userName",
            label: unref(tt)('账号'),
            width: "100"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            prop: "realName",
            label: unref(tt)('姓名'),
            "min-width": "80"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('部门'),
            "min-width": "110"
          }, {
            default: withCtx(({ row }) => [
              createTextVNode(toDisplayString(row.deptName || '-'), 1)
            ]),
            _: 1
          }, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('角色'),
            "min-width": "100"
          }, {
            default: withCtx(({ row }) => [
              createTextVNode(toDisplayString(row.roleName || '-'), 1)
            ]),
            _: 1
          }, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('状态'),
            width: "64",
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
            label: unref(tt)('操作'),
            width: "104",
            align: "center"
          }, {
            default: withCtx(({ row }) => [
              createVNode(_component_el_button, {
                size: "small",
                link: "",
                type: "primary",
                onClick: withModifiers($event => (openUser(row)), ["stop"])
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(unref(tt)('编辑')), 1)
                ]),
                _: 1
              }, 8, ["onClick"]),
              (canDelUser(row))
                ? (openBlock(), createBlock(_component_el_button, {
                    key: 0,
                    size: "small",
                    link: "",
                    type: "danger",
                    onClick: withModifiers($event => (delUser(row)), ["stop"])
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
      }, 8, ["data"]),
      createBaseVNode("div", _hoisted_11, toDisplayString(unref(tt)('点击用户行可分配部门 / 角色 / 启停用')) + toDisplayString(unref(tt)('；管理员账号与当前登录账号不可删除')), 1)
    ]),
    createBaseVNode("div", _hoisted_12, [
      createBaseVNode("div", _hoisted_13, [
        createBaseVNode("span", _hoisted_14, toDisplayString(unref(tt)('角色与面板权限')), 1),
        createVNode(_component_el_button, {
          type: "primary",
          size: "small",
          onClick: _cache[4] || (_cache[4] = $event => (newRoleVisible.value = true))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('创建角色')), 1)
          ]),
          _: 1
        })
      ]),
      createVNode(_component_el_table, {
        data: roles.value,
        size: "small",
        border: "",
        height: "200",
        "highlight-current-row": "",
        onCurrentChange: onRoleSelect
      }, {
        default: withCtx(() => [
          createVNode(_component_el_table_column, {
            prop: "roleName",
            label: unref(tt)('角色名称'),
            "min-width": "110"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            prop: "roleCode",
            label: unref(tt)('编码'),
            width: "100"
          }, null, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('类型'),
            width: "64",
            align: "center"
          }, {
            default: withCtx(({ row }) => [
              (row.isAdmin)
                ? (openBlock(), createBlock(_component_el_tag, {
                    key: 0,
                    type: "danger",
                    size: "small"
                  }, {
                    default: withCtx(() => [
                      createTextVNode(toDisplayString(unref(tt)('超级')), 1)
                    ]),
                    _: 1
                  }))
                : (openBlock(), createElementBlock("span", _hoisted_15, "-"))
            ]),
            _: 1
          }, 8, ["label"]),
          createVNode(_component_el_table_column, {
            label: unref(tt)('操作'),
            width: "56",
            align: "center"
          }, {
            default: withCtx(({ row }) => [
              (!row.isAdmin)
                ? (openBlock(), createBlock(_component_el_button, {
                    key: 0,
                    size: "small",
                    link: "",
                    type: "danger",
                    onClick: withModifiers($event => (delRole(row)), ["stop"])
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
      }, 8, ["data"]),
      (selRole.value)
        ? (openBlock(), createElementBlock("div", _hoisted_16, [
            createBaseVNode("div", _hoisted_17, [
              createTextVNode(" 「" + toDisplayString(selRole.value.roleName) + "」" + toDisplayString(unref(tt)('面板操作权限')) + " ", 1),
              createBaseVNode("span", _hoisted_18, toDisplayString(unref(tt)('（勾选对应操作权限;可见=能看到面板,其余为操作级别）')), 1),
              createBaseVNode("span", _hoisted_19, [
                createTextVNode(toDisplayString(unref(tt)('复制自')) + " ", 1),
                createVNode(_component_el_select, {
                  modelValue: copyFromRoleId.value,
                  "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((copyFromRoleId).value = $event)),
                  size: "small",
                  style: {"width":"130px"},
                  clearable: "",
                  placeholder: unref(tt)('选择角色')
                }, {
                  default: withCtx(() => [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(copyableRoles.value, (r) => {
                      return (openBlock(), createBlock(_component_el_option, {
                        key: r.id,
                        label: r.roleName,
                        value: r.id
                      }, null, 8, ["label", "value"]))
                    }), 128))
                  ]),
                  _: 1
                }, 8, ["modelValue", "placeholder"]),
                createVNode(_component_el_button, {
                  size: "small",
                  type: "primary",
                  plain: "",
                  disabled: !copyFromRoleId.value,
                  onClick: copyRolePerms
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(tt)('复制权限')), 1)
                  ]),
                  _: 1
                }, 8, ["disabled"])
              ])
            ]),
            (selRole.value.isAdmin)
              ? (openBlock(), createElementBlock("div", _hoisted_20, toDisplayString(unref(tt)('管理员为超级权限：默认拥有全部操作权限，无需配置。')), 1))
              : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                  (resultBanner.value)
                    ? (openBlock(), createElementBlock("div", _hoisted_21, toDisplayString(resultBanner.value), 1))
                    : createCommentVNode("", true),
                  createVNode(_component_el_collapse, {
                    modelValue: openGroups.value,
                    "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((openGroups).value = $event)),
                    class: "perm-collapse"
                  }, {
                    default: withCtx(() => [
                      createBaseVNode("div", {
                        ref_key: "rectRef",
                        ref: rectRef,
                        class: "paint-rect",
                        style: {"display":"none"}
                      }, null, 512),
                      (openBlock(true), createElementBlock(Fragment, null, renderList(groupedPanels.value, (g) => {
                        return (openBlock(), createBlock(_component_el_collapse_item, {
                          key: g.code,
                          name: g.code
                        }, {
                          title: withCtx(() => [
                            createBaseVNode("span", _hoisted_22, toDisplayString(unref(tt)(g.name)), 1),
                            createBaseVNode("span", _hoisted_23, toDisplayString(g.panels.length) + " " + toDisplayString(unref(tt)('个面板')), 1),
                            createBaseVNode("span", _hoisted_24, toDisplayString(grantedOf(g)) + " / " + toDisplayString(grantableOf(g)), 1),
                            createBaseVNode("span", {
                              class: "g-actions",
                              onClick: _cache[6] || (_cache[6] = withModifiers(() => {}, ["stop"]))
                            }, [
                              createVNode(_component_el_button, {
                                link: "",
                                size: "small",
                                type: "primary",
                                onClick: $event => (setGroupPerms(g, 'all'))
                              }, {
                                default: withCtx(() => [
                                  createTextVNode(toDisplayString(unref(tt)('全选')), 1)
                                ]),
                                _: 1
                              }, 8, ["onClick"]),
                              createVNode(_component_el_button, {
                                link: "",
                                size: "small",
                                onClick: $event => (setGroupPerms(g, 'none'))
                              }, {
                                default: withCtx(() => [
                                  createTextVNode(toDisplayString(unref(tt)('清空')), 1)
                                ]),
                                _: 1
                              }, 8, ["onClick"])
                            ])
                          ]),
                          default: withCtx(() => [
                            createBaseVNode("div", _hoisted_25, [
                              createBaseVNode("table", _hoisted_26, [
                                createBaseVNode("thead", null, [
                                  createBaseVNode("tr", null, [
                                    createBaseVNode("th", _hoisted_27, toDisplayString(unref(tt)('面板')), 1),
                                    (openBlock(true), createElementBlock(Fragment, null, renderList(actsOf(g), (act) => {
                                      return (openBlock(), createElementBlock("th", {
                                        key: act[0],
                                        class: "pt-act",
                                        title: unref(tt)(act[1])
                                      }, toDisplayString(unref(tt)(act[1])), 9, _hoisted_28))
                                    }), 128)),
                                    createBaseVNode("th", _hoisted_29, toDisplayString(unref(tt)('全选')), 1)
                                  ])
                                ]),
                                createBaseVNode("tbody", null, [
                                  (openBlock(true), createElementBlock(Fragment, null, renderList(g.panels, (r) => {
                                    return (openBlock(), createElementBlock("tr", {
                                      key: r.panelCode
                                    }, [
                                      createBaseVNode("td", _hoisted_30, toDisplayString(unref(tt)(r.panelName)), 1),
                                      (openBlock(true), createElementBlock(Fragment, null, renderList(actsOf(g), (act) => {
                                        return (openBlock(), createElementBlock("td", {
                                          key: act[0],
                                          class: "pt-act pt-sweep",
                                          onMousedown: withModifiers($event => (rowHasAct(r, act[0]) && canAct(r, act[0]) && startSweep(r, act[0])), ["prevent"]),
                                          onMouseenter: $event => (rowHasAct(r, act[0]) && sweepOver(r, act[0]))
                                        }, [
                                          (rowHasAct(r, act[0]))
                                            ? (openBlock(), createElementBlock("input", {
                                                key: 0,
                                                type: "checkbox",
                                                class: "pt-cb",
                                                checked: hasPerm(r, act[0]),
                                                disabled: !canAct(r, act[0])
                                              }, null, 8, _hoisted_32))
                                            : (openBlock(), createElementBlock("span", _hoisted_33, "—"))
                                        ], 40, _hoisted_31))
                                      }), 128)),
                                      createBaseVNode("td", _hoisted_34, [
                                        createVNode(_component_el_checkbox, {
                                          "model-value": isAllPerms(r),
                                          "onUpdate:modelValue": $event => (toggleAllPerms(r, $event))
                                        }, null, 8, ["model-value", "onUpdate:modelValue"])
                                      ])
                                    ]))
                                  }), 128))
                                ])
                              ])
                            ])
                          ]),
                          _: 2
                        }, 1032, ["name"]))
                      }), 128))
                    ]),
                    _: 1
                  }, 8, ["modelValue"]),
                  createBaseVNode("div", _hoisted_35, [
                    createVNode(_component_el_button, {
                      type: "primary",
                      size: "small",
                      loading: saving.value,
                      onClick: savePanels
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(unref(tt)('保存面板权限')), 1)
                      ]),
                      _: 1
                    }, 8, ["loading"]),
                    createVNode(_component_el_button, {
                      size: "small",
                      onClick: _cache[8] || (_cache[8] = $event => (loadRolePanels(selRole.value)))
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(unref(tt)('刷新')), 1)
                      ]),
                      _: 1
                    }),
                    createBaseVNode("span", _hoisted_36, toDisplayString(unref(tt)('提示：按住左键拖动框选，批量勾选/取消经过的权限')), 1)
                  ])
                ], 64))
          ]))
        : createCommentVNode("", true)
    ]),
    createVNode(_component_el_dialog, {
      modelValue: batchRoleVisible.value,
      "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((batchRoleVisible).value = $event)),
      title: unref(tt)('批量分配角色'),
      width: "380px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[10] || (_cache[10] = $event => (batchRoleVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: applyBatchRole
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('确定')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_37, toDisplayString(unref(tt)('已选')) + " " + toDisplayString(userSel.value.length) + " " + toDisplayString(unref(tt)('个用户（管理员账号自动跳过）')), 1),
        createVNode(_component_el_select, {
          modelValue: batchRoleId.value,
          "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((batchRoleId).value = $event)),
          clearable: "",
          style: {"width":"100%"},
          placeholder: unref(tt)('选择目标角色')
        }, {
          default: withCtx(() => [
            (openBlock(true), createElementBlock(Fragment, null, renderList(roles.value.filter((x) => !x.isAdmin), (r) => {
              return (openBlock(), createBlock(_component_el_option, {
                key: r.id,
                label: r.roleName,
                value: r.id
              }, null, 8, ["label", "value"]))
            }), 128))
          ]),
          _: 1
        }, 8, ["modelValue", "placeholder"])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: deptVisible.value,
      "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => ((deptVisible).value = $event)),
      title: editingDept.value ? unref(tt)('编辑部门') : unref(tt)('新增部门'),
      width: "360px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[14] || (_cache[14] = $event => (deptVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: savingDept.value,
          onClick: saveDept
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('保存')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createVNode(_component_el_form, { "label-width": "80px" }, {
          default: withCtx(() => [
            createVNode(_component_el_form_item, {
              label: unref(tt)('上级部门')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_tree_select, {
                  modelValue: deptForm.parentId,
                  "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => ((deptForm.parentId) = $event)),
                  data: deptSelectData.value,
                  "check-strictly": "",
                  clearable: "",
                  style: {"width":"100%"}
                }, null, 8, ["modelValue", "data"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('部门名称'),
              required: ""
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: deptForm.deptName,
                  "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((deptForm.deptName) = $event)),
                  placeholder: unref(tt)('如 车间 / 质检部')
                }, null, 8, ["modelValue", "placeholder"])
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
      modelValue: userVisible.value,
      "onUpdate:modelValue": _cache[24] || (_cache[24] = $event => ((userVisible).value = $event)),
      title: (editingUser.value ? unref(tt)('编辑用户：') + editingUser.value.userName : unref(tt)('新增用户')),
      width: "420px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[23] || (_cache[23] = $event => (userVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: savingUser.value,
          onClick: saveUser
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('保存')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createVNode(_component_el_form, { "label-width": "80px" }, {
          default: withCtx(() => [
            createVNode(_component_el_form_item, {
              label: unref(tt)('账号'),
              required: ""
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: userForm.userName,
                  "onUpdate:modelValue": _cache[16] || (_cache[16] = $event => ((userForm.userName) = $event)),
                  disabled: !!editingUser.value,
                  placeholder: unref(tt)('登录账号')
                }, null, 8, ["modelValue", "disabled", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('姓名')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: userForm.realName,
                  "onUpdate:modelValue": _cache[17] || (_cache[17] = $event => ((userForm.realName) = $event)),
                  placeholder: unref(tt)('真实姓名')
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            (!editingUser.value)
              ? (openBlock(), createBlock(_component_el_form_item, {
                  key: 0,
                  label: unref(tt)('密码')
                }, {
                  default: withCtx(() => [
                    createVNode(_component_el_input, {
                      modelValue: userForm.password,
                      "onUpdate:modelValue": _cache[18] || (_cache[18] = $event => ((userForm.password) = $event)),
                      type: "password",
                      placeholder: unref(tt)('默认 123456')
                    }, null, 8, ["modelValue", "placeholder"])
                  ]),
                  _: 1
                }, 8, ["label"]))
              : createCommentVNode("", true),
            createVNode(_component_el_form_item, {
              label: unref(tt)('部门')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_tree_select, {
                  modelValue: userForm.deptId,
                  "onUpdate:modelValue": _cache[19] || (_cache[19] = $event => ((userForm.deptId) = $event)),
                  data: deptSelectData.value,
                  "check-strictly": "",
                  clearable: "",
                  style: {"width":"100%"}
                }, null, 8, ["modelValue", "data"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('生产车间')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_select, {
                  modelValue: userForm.workshop,
                  "onUpdate:modelValue": _cache[20] || (_cache[20] = $event => ((userForm.workshop) = $event)),
                  placeholder: unref(tt)('留空=不受限(计划组/管理员)'),
                  clearable: "",
                  filterable: "",
                  style: {"width":"100%"}
                }, {
                  default: withCtx(() => [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(workshops.value, (w) => {
                      return (openBlock(), createBlock(_component_el_option, {
                        key: w,
                        label: w,
                        value: w
                      }, null, 8, ["label", "value"]))
                    }), 128))
                  ]),
                  _: 1
                }, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('角色')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_select, {
                  modelValue: userForm.roleId,
                  "onUpdate:modelValue": _cache[21] || (_cache[21] = $event => ((userForm.roleId) = $event)),
                  placeholder: unref(tt)('选择角色'),
                  clearable: "",
                  style: {"width":"100%"}
                }, {
                  default: withCtx(() => [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(roles.value, (r) => {
                      return (openBlock(), createBlock(_component_el_option, {
                        key: r.id,
                        label: r.roleName,
                        value: r.id
                      }, null, 8, ["label", "value"]))
                    }), 128))
                  ]),
                  _: 1
                }, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('启用')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_switch, {
                  modelValue: userForm.enabled,
                  "onUpdate:modelValue": _cache[22] || (_cache[22] = $event => ((userForm.enabled) = $event)),
                  "active-value": 1,
                  "inactive-value": 0
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
      modelValue: newRoleVisible.value,
      "onUpdate:modelValue": _cache[29] || (_cache[29] = $event => ((newRoleVisible).value = $event)),
      title: unref(tt)('创建角色'),
      width: "400px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[28] || (_cache[28] = $event => (newRoleVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          loading: savingRole.value,
          onClick: saveRole
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('创建')), 1)
          ]),
          _: 1
        }, 8, ["loading"])
      ]),
      default: withCtx(() => [
        createVNode(_component_el_form, { "label-width": "80px" }, {
          default: withCtx(() => [
            createVNode(_component_el_form_item, {
              label: unref(tt)('角色编码'),
              required: ""
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: roleForm.roleCode,
                  "onUpdate:modelValue": _cache[25] || (_cache[25] = $event => ((roleForm.roleCode) = $event)),
                  placeholder: "operator / workshop"
                }, null, 8, ["modelValue"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('角色名称'),
              required: ""
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: roleForm.roleName,
                  "onUpdate:modelValue": _cache[26] || (_cache[26] = $event => ((roleForm.roleName) = $event)),
                  placeholder: unref(tt)('如 车间操作员')
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"]),
            createVNode(_component_el_form_item, {
              label: unref(tt)('备注')
            }, {
              default: withCtx(() => [
                createVNode(_component_el_input, {
                  modelValue: roleForm.remark,
                  "onUpdate:modelValue": _cache[27] || (_cache[27] = $event => ((roleForm.remark) = $event)),
                  placeholder: unref(tt)('说明该角色的职责范围')
                }, null, 8, ["modelValue", "placeholder"])
              ]),
              _: 1
            }, 8, ["label"])
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createBaseVNode("div", {
      ref_key: "badgeRef",
      ref: badgeRef,
      class: "paint-badge",
      style: {"display":"none"}
    }, null, 512)
  ]))
}
}

};
const OrgAdmin = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-279ddd0c"]]);

export { OrgAdmin as default };
