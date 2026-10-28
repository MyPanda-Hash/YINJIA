<!-- MenuDesigner.vue — 系统管理平台 · 菜单设计(2026-10-23) -->
<!-- 用户口径:「给系统管理模块加上一个菜单命名的功能,就是可以编辑各个面板的位置与一级模块与
     二级模块的分支和名字,就不需要每次修改都要重新打包部署」。
     能改的四件事:名称 / 上级分组 / 同组顺序 / 隐藏;不可改(只读显示):路由、面板编码、图标
     —— 它们是数据键,和路由注册/权限词/面板元数据一一对应(口径见 business/menuOverrides.js)。
     保存 = 整表替换 yj_menu_node(后端同一事务),保存后左栏立即按新树渲染,所有账号刷新即见;
     「恢复代码默认」只清空覆盖表,不删任何面板数据。管理员专属(菜单 adminOnly + 路由 requireAdmin)。 -->
<template>
  <div class="md-page">
    <div class="md-head">
      <div class="md-title">
        <span class="md-name">{{ tt('菜单设计') }}</span>
        <el-tag v-if="customized" size="small" type="warning">{{ tt('已定制') }}</el-tag>
        <el-tag v-else size="small" type="info">{{ tt('未定制（按代码默认）') }}</el-tag>
        <el-tag v-if="dirty" size="small" type="danger">{{ tt('未保存') }}</el-tag>
      </div>
      <div class="md-actions">
        <el-button size="small" @click="setAllExpanded(true)">{{ tt('展开全部') }}</el-button>
        <el-button size="small" @click="setAllExpanded(false)">{{ tt('收起全部') }}</el-button>
        <el-button size="small" @click="addTopGroup">{{ tt('新建一级模块') }}</el-button>
        <el-button size="small" :disabled="!dirty" :loading="loading" @click="reload">{{ tt('放弃改动') }}</el-button>
        <el-button size="small" type="primary" :disabled="!dirty" :loading="saving" @click="save">{{ tt('保存') }}</el-button>
        <el-button size="small" type="danger" plain :loading="resetting" @click="resetAll">{{ tt('恢复代码默认') }}</el-button>
      </div>
    </div>

    <div class="md-tip">
      {{ tt('拖动节点即可换分组、调顺序；双击名称或点「改名」；「隐藏」后侧边栏不再显示（可随时恢复）。保存后立即生效，不用重新打包部署。') }}
    </div>

    <div class="md-grid">
      <!-- 左：编辑树 -->
      <section class="md-card md-tree-card">
        <div class="md-tree-tools">
          <el-input v-model="keyword" :placeholder="tt('搜索名称 / 面板编码')" clearable class="md-search" :prefix-icon="Search" />
          <span class="md-stat">
            {{ tt('一级模块') }} {{ stats.top }} · {{ tt('分组') }} {{ stats.group }} · {{ tt('面板') }} {{ stats.leaf }} ·
            <span :class="{ 'md-stat-hidden': stats.hidden > 0 }">{{ tt('隐藏') }} {{ stats.hidden }}</span>
          </span>
        </div>
        <el-tree
          ref="treeRef"
          :data="working"
          node-key="code"
          :props="{ label: 'title', children: 'children' }"
          :filter-node-method="filterNode"
          :expand-on-click-node="false"
          :allow-drop="allowDrop"
          draggable
          empty-text=""
          class="md-tree"
          @node-drop="onDrop"
        >
          <template #default="{ data }">
            <span class="md-node" :class="{ 'is-group': isGroup(data), 'is-hidden': data.hidden }">
              <span v-if="renaming === data.code" class="md-rename">
                <el-input
                  v-model="renameText"
                  size="small"
                  maxlength="100"
                  :ref="setRenameInput"
                  @keyup.enter="commitRename(data)"
                  @keyup.esc="cancelRename"
                  @blur="commitRename(data)"
                  @click.stop
                />
              </span>
              <span v-else class="md-label" :title="tt(data.title)" @dblclick.stop="startRename(data)">{{ tt(data.title) }}</span>
              <span v-if="!isGroup(data) && data.panelCode" class="md-code">{{ data.panelCode }}</span>
              <span v-else-if="isGroup(data)" class="md-kids">{{ (data.children || []).length }}</span>
              <el-tag v-if="data.hidden" size="small" type="info" class="md-tag">{{ tt('已隐藏') }}</el-tag>
              <span class="md-ops">
                <el-button link size="small" @click.stop="startRename(data)">{{ tt('改名') }}</el-button>
                <el-button v-if="isGroup(data)" link size="small" @click.stop="addChildGroup(data)">{{ tt('加子分组') }}</el-button>
                <el-button link size="small" @click.stop="toggleHide(data)">{{ data.hidden ? tt('显示') : tt('隐藏') }}</el-button>
                <el-button v-if="data.isNew" link size="small" type="danger" @click.stop="removeGroup(data)">{{ tt('删除') }}</el-button>
              </span>
            </span>
          </template>
        </el-tree>
      </section>

      <!-- 右：本次改动 ＋ 说明 -->
      <section class="md-card md-side">
        <div class="md-side-head">
          <span>{{ tt('本次改动') }}</span>
          <el-tag size="small" :type="dirty ? 'warning' : 'info'">{{ changes.length }}</el-tag>
        </div>
        <ul v-if="changes.length" class="md-changes">
          <li v-for="(c, i) in changes" :key="i">{{ c }}</li>
        </ul>
        <div v-else class="md-hint">{{ tt('还没有改动。拖动、改名或隐藏后，这里会列出每一条，保存前先核对。') }}</div>
        <div class="md-side-foot">
          <div>{{ tt('保存 = 覆盖全公司导航，所有账号刷新后看到新菜单。') }}</div>
          <div>{{ tt('不可在此修改：路由 / 面板编码 / 图标（与代码、权限一一对应）。') }}</div>
          <div>{{ tt('「恢复代码默认」只清空自定义，不删任何面板或业务数据。') }}</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import request from '@core/request'
import { tt } from '@/i18n'
import { useMenuStore } from '@/stores/menu'
import { flattenMenuNodes, wouldCycle } from '@/business/menuOverrides'

const menuStore = useMenuStore()

const treeRef = ref(null)
const keyword = ref('')
const working = ref([])      // 工作副本(el-tree 拖拽直接改它)
const baseline = ref([])     // 最近一次载入/保存后的快照,用于算「本次改动」
const loading = ref(false)
const saving = ref(false)
const resetting = ref(false)
const renaming = ref('')
const renameText = ref('')
let renameInputEl = null

const isGroup = (data) => Array.isArray(data?.children)
const codeOf = (data) => String(data?.code || '')

/** 名称可读化:给「挪到 XXX」用 */
function titleOfCode(code) {
  if (!code) return tt('一级模块')
  let hit = ''
  const walk = (list) => {
    for (const n of list || []) {
      if (n.code === code) { hit = n.title; return true }
      if (n.children && walk(n.children)) return true
    }
    return false
  }
  walk(working.value)
  return hit ? `「${hit}」` : `「${code}」`
}

function eachNode(fn) {
  const walk = (list, parentCode) => {
    for (const n of list || []) {
      fn(n, parentCode)
      if (n.children) walk(n.children, n.code)
    }
  }
  walk(working.value, null)
}

const stats = computed(() => {
  const s = { top: 0, group: 0, leaf: 0, hidden: 0 }
  for (const n of working.value) s.top++
  eachNode((n) => {
    if (n.hidden) s.hidden++
    if (isGroup(n)) s.group++
    else s.leaf++
  })
  return s
})

/** 覆盖表里已经有行 = 已定制(空表 = 完全按代码) */
const customized = computed(() => (menuStore.rows || []).length > 0)

/** 本次改动清单(改名/挪动/隐藏/新增/顺序) */
const changes = computed(() => {
  const now = flattenMenuNodes(working.value)
  const before = new Map((baseline.value || []).map((r) => [r.menuCode, r]))
  const out = []
  const parentsNow = new Map()
  const parentsBefore = new Map()
  const pushTo = (map, parent, code) => {
    const list = map.get(parent || '') || []
    list.push(code)
    map.set(parent || '', list)
  }
  for (const r of now) pushTo(parentsNow, r.parentCode, r.menuCode)
  for (const r of baseline.value || []) pushTo(parentsBefore, r.parentCode, r.menuCode)

  for (const r of now) {
    const b = before.get(r.menuCode)
    if (!b) {
      out.push(`${tt('新增分组')}「${r.title}」`)
      continue
    }
    if (r.title !== b.title) out.push(`${tt('改名')}「${b.title}」→「${r.title}」`)
    if ((r.parentCode || '') !== (b.parentCode || '')) {
      out.push(`${tt('挪动')}「${r.title}」→ ${titleOfCode(r.parentCode)}`)
    }
    if (r.hidden !== b.hidden) out.push(`${r.hidden ? tt('隐藏') : tt('显示')}「${r.title}」`)
  }
  // 纯顺序变化(没有改名/挪动)单独列一条,免得「拖了却没看出变化」
  for (const [parent, list] of parentsNow) {
    const old = parentsBefore.get(parent)
    if (!old || old.length !== list.length) continue
    const same = old.every((c, i) => c === list[i])
    if (!same) out.push(`${titleOfCode(parent === '' ? null : parent)} ${tt('下顺序已调整')}`)
  }
  return out
})
const dirty = computed(() => changes.value.length > 0)

watch(keyword, (k) => treeRef.value?.filter(k))

function filterNode(value, data) {
  const k = String(value || '').trim().toLowerCase()
  if (!k) return true
  const hay = `${data.title || ''} ${data.panelCode || ''} ${data.code || ''}`.toLowerCase()
  return hay.includes(k)
}

function setAllExpanded(open) {
  const store = treeRef.value?.store
  if (!store) return
  Object.values(store.nodesMap).forEach((n) => { if (n.childNodes?.length) n.expanded = open })
}

/** 拖拽规则:面板不能当父;分组不能拖进自己的子孙(成环) */
function allowDrop(dragging, dropNode, type) {
  if (type === 'inner') {
    if (!isGroup(dropNode.data)) return false
    if (wouldCycle(working.value, codeOf(dragging.data), codeOf(dropNode.data))) return false
  }
  return true
}

function onDrop() {
  // el-tree 已把工作副本改好;这里只做一次「顺序/层级」自检提示,不改数据
  if (dirty.value) ElMessage.info(tt('已调整，记得点「保存」生效'))
}

// ---------- 改名 ----------
function setRenameInput(el) { renameInputEl = el }
function startRename(data) {
  renaming.value = codeOf(data)
  renameText.value = data.title || ''
  nextTick(() => {
    const el = renameInputEl?.focus ? renameInputEl : renameInputEl?.$el?.querySelector?.('input')
    el?.focus?.()
    if (renameInputEl?.select) renameInputEl.select()
  })
}
function cancelRename() {
  renaming.value = ''
  renameText.value = ''
}
function commitRename(data) {
  if (renaming.value !== codeOf(data)) return
  const text = String(renameText.value || '').trim()
  if (text && text !== data.title) data.title = text
  cancelRename()
}

// ---------- 隐藏 ----------
function toggleHide(data) {
  data.hidden = !data.hidden
}

// ---------- 新建 / 删除分组 ----------
function uniqCode(prefix) {
  let code = `${prefix}${Date.now().toString(36)}`
  let i = 1
  const exists = new Set()
  eachNode((n) => exists.add(n.code))
  while (exists.has(code)) code = `${prefix}${Date.now().toString(36)}${i++}`
  return code
}

async function promptGroupTitle(title) {
  const r = await ElMessageBox.prompt(title, tt('新建分组'), {
    confirmButtonText: tt('确定'),
    cancelButtonText: tt('取消'),
    inputPlaceholder: tt('如：数据安全'),
    inputValidator: (v) => (String(v || '').trim() ? true : tt('名称不能为空')),
  })
  return String(r.value || '').trim()
}

async function addTopGroup() {
  const title = await promptGroupTitle(tt('新一级模块的名称'))
  working.value.push({ code: uniqCode('g'), title, icon: 'Folder', isNew: true, children: [] })
}

async function addChildGroup(data) {
  const title = await promptGroupTitle(tt('新分组的名称'))
  data.children.push({ code: uniqCode('g'), title, icon: 'FolderOpened', isNew: true, children: [] })
}

function removeGroup(data) {
  if ((data.children || []).length) {
    ElMessage.warning(tt('先把里面的面板拖到别处，再删除这个空分组'))
    return
  }
  const drop = (list) => {
    const i = list.findIndex((n) => codeOf(n) === codeOf(data))
    if (i >= 0) { list.splice(i, 1); return true }
    return (list || []).some((n) => n.children && drop(n.children))
  }
  drop(working.value)
  ElMessage.success(tt('已删除（记得保存）'))
}

// ---------- 载入 / 保存 / 恢复 ----------
function loadWorking() {
  working.value = JSON.parse(JSON.stringify(menuStore.tree || []))
  baseline.value = flattenMenuNodes(working.value)
  cancelRename()
  nextTick(() => {
    const store = treeRef.value?.store
    if (!store) return
    for (const n of working.value) {
      const node = store.nodesMap[n.code]
      if (node && node.childNodes?.length) node.expanded = true
    }
  })
}

async function reload() {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm(tt('放弃未保存的改动？'), tt('放弃改动'), {
        confirmButtonText: tt('放弃'), cancelButtonText: tt('取消'), type: 'warning',
      })
    } catch { return }
  }
  loading.value = true
  try {
    await menuStore.load(true)
    loadWorking()
  } finally {
    loading.value = false
  }
}

async function save() {
  const rows = flattenMenuNodes(working.value)
  saving.value = true
  try {
    const r = await request.post('/sys/menu/nodes', rows)
    // 立刻生效:同一页面左栏(LeftNav)、顶栏单据查询都读这个 store
    menuStore.setRows(rows)
    baseline.value = flattenMenuNodes(working.value)
    ElMessage.success(`${tt('菜单已保存')}：${r?.data?.count ?? rows.length} ${tt('项')}`)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('保存失败'))
  } finally {
    saving.value = false
  }
}

async function resetAll() {
  try {
    await ElMessageBox.confirm(
      tt('将清空全部自定义（名称/分组/顺序/隐藏），恢复成代码里的默认菜单。该操作不影响任何面板或业务数据。'),
      tt('恢复代码默认'),
      { confirmButtonText: tt('恢复'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return }
  resetting.value = true
  try {
    const r = await request.post('/sys/menu/reset', {})
    menuStore.setRows([])
    loadWorking()
    ElMessage.success(`${tt('已恢复代码默认')}（${tt('清除')} ${r?.data?.cleared ?? 0} ${tt('项')}）`)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('恢复失败'))
  } finally {
    resetting.value = false
  }
}

onMounted(async () => {
  await menuStore.load()
  loadWorking()
})
</script>

<style scoped>
.md-page { padding: 12px 14px 18px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.md-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
.md-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; color: #1f2d3d; }
.md-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.md-tip { font-size: 12px; line-height: 1.6; color: #6b7785; background: #f4f7fb; border: 1px solid #e4eaf2; border-radius: 6px; padding: 7px 10px; }
.md-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 12px; align-items: start; }
.md-card { background: #fff; border: 1px solid #e4e9f0; border-radius: 8px; min-width: 0; }
.md-tree-card { display: flex; flex-direction: column; overflow: hidden; }
.md-tree-tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #eef2f7; }
.md-search { max-width: 280px; flex: 1 1 200px; }
.md-stat { font-size: 12px; color: #6b7785; }
.md-stat-hidden { color: #d97706; }
.md-tree { padding: 6px 8px 12px; max-height: calc(100vh - 230px); overflow: auto; }
/* el-tree 默认把每行锁死 26px 高;窄屏上节点行会折成两行,锁死高度就变成**文字互相压住**。
   这里放开行高,折行时正常把后面的节点往下推(2026-10-23 375 宽实测踩到)。 */
.md-tree :deep(.el-tree-node__content) { height: auto; min-height: 30px; padding: 2px 0; }
.md-tree :deep(.el-tree-node__content:hover) { background: #f5f8fc; }
.md-node { display: flex; flex-wrap: nowrap; align-items: center; gap: 6px; min-width: 0; width: 100%; padding: 2px 0; }
.md-label { flex: 1 1 auto; min-width: 0; font-size: 13px; color: #25303b; cursor: text; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.md-node.is-group > .md-label { font-weight: 600; }
.md-node.is-hidden > .md-label { color: #98a3b0; text-decoration: line-through; }
.md-code { font-size: 11px; color: #8d98a6; font-family: Consolas, Menlo, monospace; }
.md-kids { font-size: 11px; color: #6b7785; background: #eef2f7; border-radius: 8px; padding: 0 6px; }
.md-tag { transform: scale(0.9); transform-origin: left center; }
.md-ops { display: flex; flex-wrap: nowrap; gap: 2px; margin-left: auto; flex: 0 0 auto; }
.md-ops :deep(.el-button) { height: 32px; padding: 0 7px; }
.md-rename { min-width: 160px; }
.md-side { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.md-side-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #25303b; }
.md-changes { margin: 0; padding-left: 18px; max-height: 320px; overflow: auto; font-size: 12px; line-height: 1.7; color: #33404d; }
.md-changes li { word-break: break-all; }
.md-hint { font-size: 12px; color: #8d98a6; line-height: 1.6; }
.md-side-foot { margin-top: auto; border-top: 1px dashed #e4e9f0; padding-top: 8px; font-size: 12px; color: #6b7785; line-height: 1.7; }
@media (max-width: 900px) {
  .md-grid { grid-template-columns: minmax(0, 1fr); }
  .md-tree { max-height: none; }
  .md-ops :deep(.el-button) { height: 40px; }
}
@media (max-width: 640px) {
  .md-page { padding: 10px; }
  .md-actions :deep(.el-button) { height: 40px; }
  /* 窄屏优先保住「名称 + 操作」在一行(折行会把行高撑乱):面板编码让位,名称省略号截断 */
  .md-code { display: none; }
  .md-label { font-size: 13px; }
}
</style>
