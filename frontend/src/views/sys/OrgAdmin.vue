<!-- OrgAdmin.vue — 组织架构（仅管理员）：部门树 + 用户管理（分配角色/部门）+ 角色管理（面板勾选、审批权限） -->
<template>
  <div class="org-wrap">
    <!-- 左：部门 -->
    <div class="org-col dept">
      <div class="col-head">
        <span class="col-title">{{ tt('部门') }}</span>
        <el-button type="primary" size="small" @click="newDept(0)">{{ tt('新增部门') }}</el-button>
      </div>
      <el-tree
        class="dept-tree"
        :data="deptTree"
        node-key="id"
        :props="{ label: 'deptName', children: 'children' }"
        highlight-current
        :expand-on-click-node="false"
        @node-click="onDeptClick"
      >
        <template #default="{ data }">
          <div class="dept-node">
            <span>{{ data.deptName }}</span>
            <span class="dept-ops" @click.stop>
              <el-button size="small" link type="primary" @click="newDept(data.id)">+{{ tt('子') }}</el-button>
              <el-button size="small" link type="primary" @click="editDept(data)">{{ tt('改') }}</el-button>
              <el-button v-if="data.id !== 1" size="small" link type="danger" @click="delDept(data)">{{ tt('删') }}</el-button>
            </span>
          </div>
        </template>
      </el-tree>
      <div class="col-tip">{{ tt('支持多级部门；「+子」新增下级部门') }}</div>
    </div>

    <!-- 中：用户 -->
    <div class="org-col users">
      <div class="col-head">
        <span class="col-title">{{ tt('用户（组织调整）') }}</span>
        <span class="col-head-btns">
          <el-button size="small" :disabled="!userSel.length" @click="batchRoleVisible = true">{{ tt('批量分配角色') }}({{ userSel.length }})</el-button>
          <el-button type="primary" size="small" @click="openUser()">{{ tt('新增用户') }}</el-button>
        </span>
      </div>
      <el-table :data="users" size="small" border height="620" highlight-current-row @row-click="openUser" @selection-change="onUserSel">
        <el-table-column type="selection" width="38" :selectable="(row) => !row.isAdmin" />
        <el-table-column prop="userName" :label="tt('账号')" width="100" />
        <el-table-column prop="realName" :label="tt('姓名')" min-width="80" />
        <el-table-column :label="tt('部门')" min-width="110">
          <template #default="{ row }">{{ row.deptName || '-' }}</template>
        </el-table-column>
        <el-table-column :label="tt('角色')" min-width="100">
          <template #default="{ row }">{{ row.roleName || '-' }}</template>
        </el-table-column>
        <el-table-column :label="tt('状态')" width="64" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? tt('启用') : tt('停用') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="tt('操作')" width="56" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click.stop="openUser(row)">{{ tt('编辑') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="col-tip">{{ tt('点击用户行可分配部门 / 角色 / 启停用') }}</div>
    </div>

    <!-- 右：角色与面板权限 -->
    <div class="org-col roles">
      <div class="col-head">
        <span class="col-title">{{ tt('角色与面板权限') }}</span>
        <el-button type="primary" size="small" @click="newRoleVisible = true">{{ tt('创建角色') }}</el-button>
      </div>
      <el-table :data="roles" size="small" border height="200" highlight-current-row @current-change="onRoleSelect">
        <el-table-column prop="roleName" :label="tt('角色名称')" min-width="110" />
        <el-table-column prop="roleCode" :label="tt('编码')" width="100" />
        <el-table-column :label="tt('类型')" width="64" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isAdmin" type="danger" size="small">{{ tt('超级') }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('操作')" width="56" align="center">
          <template #default="{ row }">
            <el-button v-if="!row.isAdmin" size="small" link type="danger" @click.stop="delRole(row)">{{ tt('删除') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="selRole" class="perm-box">
        <div class="perm-head">
          「{{ selRole.roleName }}」{{ tt('面板操作权限') }}
          <span class="perm-sub">{{ tt('（勾选对应操作权限;可见=能看到面板,其余为操作级别）') }}</span>
          <span class="perm-copy">
            {{ tt('复制自') }}
            <el-select v-model="copyFromRoleId" size="small" style="width: 130px" clearable :placeholder="tt('选择角色')">
              <el-option v-for="r in copyableRoles" :key="r.id" :label="r.roleName" :value="r.id" />
            </el-select>
            <el-button size="small" type="primary" plain :disabled="!copyFromRoleId" @click="copyRolePerms">{{ tt('复制权限') }}</el-button>
          </span>
        </div>
        <div v-if="selRole.isAdmin" class="admin-tip">{{ tt('管理员为超级权限：默认拥有全部操作权限，无需配置。') }}</div>
        <template v-else>
          <div v-if="resultBanner" class="result-banner">{{ resultBanner }}</div>
          <el-collapse v-model="openGroups" class="perm-collapse">
            <!-- 框选矩形:容器内绝对定位(内容坐标),直接 DOM 更新(不走 Vue 响应式,防拖动卡顿) -->
            <div ref="rectRef" class="paint-rect" style="display: none"></div>
            <el-collapse-item v-for="g in groupedPanels" :key="g.code" :name="g.code">
              <template #title>
                <span class="g-title">{{ tt(g.name) }}</span>
                <span class="g-count">{{ g.panels.length }} {{ tt('个面板') }}</span>
                <span class="g-actions" @click.stop>
                  <el-button link size="small" type="primary" @click="setGroupPerms(g, 'all')">{{ tt('全选') }}</el-button>
                  <el-button link size="small" @click="setGroupPerms(g, 'none')">{{ tt('清空') }}</el-button>
                </span>
              </template>
              <div class="perm-table-wrap">
                <table class="perm-table">
                  <thead>
                    <tr>
                      <th class="pt-panel">{{ tt('面板') }}</th>
                      <th v-for="act in actsOf(g)" :key="act[0]" class="pt-act" :title="tt(act[1])">{{ tt(act[1]) }}</th>
                      <th class="pt-all">{{ tt('全选') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in g.panels" :key="r.panelCode">
                      <td class="pt-panel">{{ tt(r.panelName) }}</td>
                      <td v-for="act in actsOf(g)" :key="act[0]" class="pt-act pt-sweep"
                          @mousedown.prevent="rowHasAct(r, act[0]) && canAct(r, act[0]) && startSweep(r, act[0])"
                          @mouseenter="rowHasAct(r, act[0]) && sweepOver(r, act[0])">
                        <input
                          v-if="rowHasAct(r, act[0])"
                          type="checkbox"
                          class="pt-cb"
                          :checked="hasPerm(r, act[0])"
                          :disabled="!canAct(r, act[0])"
                        />
                        <span v-else class="pt-na">—</span>
                      </td>
                      <td class="pt-all">
                        <el-checkbox
                          :model-value="isAllPerms(r)"
                          @update:model-value="toggleAllPerms(r, $event)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </el-collapse-item>
          </el-collapse>
          <div class="perm-actions">
            <el-button type="primary" size="small" :loading="saving" @click="savePanels">{{ tt('保存面板权限') }}</el-button>
            <el-button size="small" @click="loadRolePanels(selRole)">{{ tt('刷新') }}</el-button>
            <span class="paint-tip">{{ tt('提示：按住左键拖动框选，批量勾选/取消经过的权限') }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- 批量分配角色 -->
    <el-dialog v-model="batchRoleVisible" :title="tt('批量分配角色')" width="380px" append-to-body>
      <div class="batch-tip">{{ tt('已选') }} {{ userSel.length }} {{ tt('个用户（管理员账号自动跳过）') }}</div>
      <el-select v-model="batchRoleId" clearable style="width: 100%" :placeholder="tt('选择目标角色')">
        <el-option v-for="r in roles.filter((x) => !x.isAdmin)" :key="r.id" :label="r.roleName" :value="r.id" />
      </el-select>
      <template #footer>
        <el-button @click="batchRoleVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="applyBatchRole">{{ tt('确定') }}</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑部门 -->
    <el-dialog v-model="deptVisible" :title="editingDept ? tt('编辑部门') : tt('新增部门')" width="360px" append-to-body>
      <el-form label-width="80px">
        <el-form-item :label="tt('上级部门')">
          <el-tree-select v-model="deptForm.parentId" :data="deptSelectData" check-strictly clearable style="width: 100%" />
        </el-form-item>
        <el-form-item :label="tt('部门名称')" required>
          <el-input v-model="deptForm.deptName" :placeholder="tt('如 车间 / 质检部')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deptVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="savingDept" @click="saveDept">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑用户 -->
    <el-dialog v-model="userVisible" :title="(editingUser ? tt('编辑用户：') + editingUser.userName : tt('新增用户'))" width="420px" append-to-body>
      <el-form label-width="80px">
        <el-form-item :label="tt('账号')" required>
          <el-input v-model="userForm.userName" :disabled="!!editingUser" :placeholder="tt('登录账号')" />
        </el-form-item>
        <el-form-item :label="tt('姓名')">
          <el-input v-model="userForm.realName" :placeholder="tt('真实姓名')" />
        </el-form-item>
        <el-form-item v-if="!editingUser" :label="tt('密码')">
          <el-input v-model="userForm.password" type="password" :placeholder="tt('默认 123456')" />
        </el-form-item>
        <el-form-item :label="tt('部门')">
          <el-tree-select v-model="userForm.deptId" :data="deptSelectData" check-strictly clearable style="width: 100%" />
        </el-form-item>
        <el-form-item :label="tt('角色')">
          <el-select v-model="userForm.roleId" :placeholder="tt('选择角色')" clearable style="width: 100%">
            <el-option v-for="r in roles" :key="r.id" :label="r.roleName" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tt('启用')">
          <el-switch v-model="userForm.enabled" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="savingUser" @click="saveUser">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <!-- 创建角色 -->
    <el-dialog v-model="newRoleVisible" :title="tt('创建角色')" width="400px" append-to-body>
      <el-form label-width="80px">
        <el-form-item :label="tt('角色编码')" required>
          <el-input v-model="roleForm.roleCode" placeholder="operator / workshop" />
        </el-form-item>
        <el-form-item :label="tt('角色名称')" required>
          <el-input v-model="roleForm.roleName" :placeholder="tt('如 车间操作员')" />
        </el-form-item>
        <el-form-item :label="tt('备注')">
          <el-input v-model="roleForm.remark" :placeholder="tt('说明该角色的职责范围')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newRoleVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="savingRole" @click="saveRole">{{ tt('创建') }}</el-button>
      </template>
    </el-dialog>

    <!-- 拖动框选跟随提示(直接 DOM 更新;矩形本体在 .perm-collapse 内部,受容器裁剪) -->
    <div ref="badgeRef" class="paint-badge" style="display: none"></div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'
import PermRow from './PermRow.vue'

const user = useUserStore()

// YINJIA-MES 适配:面板模块分组由后端按真实模块(yj_panel.module_group,
// 对齐 HSDZ permission.GROP)返回,前端不再硬编码 light-mes 面板清单
const panelModules = ref([])
const openGroups = ref([])
const permActions = ref([])  // [['view','可见'],['query','查询'],...]

function applyPanelModules(modules, actions) {
  panelModules.value = (modules || []).filter((m) => (m.panels || []).length)
  openGroups.value = panelModules.value.map((m) => m.code)
  permActions.value = actions || []
}

// 按模块分组渲染（行对象与 panelRows 同引用，勾选联动保存）
const groupedPanels = computed(() => {
  const rowsByCode = {}
  for (const r of panelRows.value) rowsByCode[r.panelCode] = r
  const buckets = panelModules.value.map((m) => ({
    code: m.code,
    name: m.name,
    panels: (m.panels || []).map((p) => rowsByCode[p.panelCode]).filter(Boolean),
  }))
  const known = new Set(buckets.flatMap((b) => b.panels.map((p) => p.panelCode)))
  const other = { code: 'other', name: '其他', panels: panelRows.value.filter((r) => !known.has(r.panelCode)) }
  return other.panels.length ? buckets.concat(other) : buckets
})

// ---- 操作权限工具(行对象 permsSet 为 Set;动作集按行,文件面板 8 项/通用面板 11 项) ----
/** 组内动作列 = 成员行动作集的并集(保序去重);同组混合时不适用的格显示 — */
function groupActs(g) {
  const seen = new Set()
  const out = []
  for (const r of g.panels) {
    for (const a of r.actions || []) {
      if (!seen.has(a[0])) { seen.add(a[0]); out.push(a) }
    }
  }
  return out
}
function rowHasAct(row, code) {
  return (row.actions || []).some((a) => a[0] === code)
}
/** 组内动作列缓存(computed 一次),避免每格每轮渲染重算并集导致卡顿 */
const groupActsMap = computed(() => {
  const m = {}
  for (const g of groupedPanels.value) m[g.code] = groupActs(g)
  return m
})
function actsOf(g) {
  return groupActsMap.value[g.code] || []
}
/** 该格可操作:可见列恒可操作,其余需先勾可见 */
function canAct(row, code) {
  return code === 'view' || hasPerm(row, 'view')
}
// ---------- 滑动勾选:按下即切换,按住拖过多格批量套用同一状态 ----------
const sweeping = ref(false)
const sweepMode = ref(true)
function startSweep(row, code) {
  sweeping.value = true
  sweepMode.value = !hasPerm(row, code)
  togglePerm(row, code, sweepMode.value)
}
function sweepOver(row, code) {
  if (!sweeping.value || !canAct(row, code)) return
  if (hasPerm(row, code) !== sweepMode.value) togglePerm(row, code, sweepMode.value)
}
function stopSweep() {
  sweeping.value = false
}
onMounted(() => window.addEventListener('mouseup', stopSweep))
onUnmounted(() => window.removeEventListener('mouseup', stopSweep))
function hasPerm(row, code) {
  return row.permsSet ? row.permsSet.has(code) : false
}
function togglePerm(row, code, val) {
  if (!row.permsSet) row.permsSet = new Set()
  if (val) {
    row.permsSet.add(code)
    if (code !== 'view') row.permsSet.add('view') // 其他权限隐含可见
  } else {
    row.permsSet.delete(code)
    if (code === 'view') row.permsSet.clear() // 取消可见则清空全部
  }
}
function isAllPerms(row) {
  return (row.actions || []).length > 0 && row.actions.every((a) => row.permsSet && row.permsSet.has(a[0]))
}
function toggleAllPerms(row, val) {
  if (val) {
    row.permsSet = new Set(row.actions.map((a) => a[0]))
  } else {
    row.permsSet = new Set()
  }
}
function setGroupPerms(g, mode) {
  for (const r of g.panels) {
    if (mode === 'all') r.permsSet = new Set(r.actions.map((a) => a[0]))
    else r.permsSet = new Set()
  }
  refreshHeadMarks()
}

// ---- 拖动框选:按住左键拉出矩形,框内格子实时应用按下格的状态;框缩小则实时回退 ----
// 语义:pointerdown 切换按下格并记下"涂选值"(单击=只切换该格,无反馈标识);
// 移动超过阈值后出现框选矩形,矩形当前覆盖到的格子应用涂选值,退出覆盖的格恢复拖动前状态
// —— 最终结果恒等于松手时框住的格子,与常规框选体验一致。
// 滚动:拖动中指针到达滚动容器上下边缘自动滚动;滚轮滚动同样实时跟进(锚点按内容坐标存储)。
// 性能:拖动周期内的一切 UI(显隐/矩形/徽标/面板 painting 类/列头三态)全部直接操作 DOM,
// 不经 Vue 响应式——否则按下/松手/每次移动都会触发本组件(744 格+部门树+用户表+130 个
// 下拉列头)全量重渲染,dev 模式单次 ~300ms,是拖动卡顿的根因。
const ALL_COL = '__all__'
const rectRef = ref(null)
const badgeRef = ref(null)
const paint = {
  active: false, moved: false, col: '', value: false, count: 0,
  x: 0, y: 0,   // 当前指针(视口坐标)
  ax: 0, ay: 0, // 按下锚点(视口坐标,每帧由内容坐标换算——滚动时跟随内容)
  rx: 0, ry: 0, // 矩形随指针移动的当前角(视口坐标)
  acy: 0,       // 按下锚点的纵向内容坐标(相对滚动容器内容原点,滚动不变)
}
let paintCells = []       // 全部可涂格 {panel,col,x,y,w,h}(按下时收集)
let panelRowMap = new Map() // panelCode -> 行对象(拖动期查表,避免逐格线性扫描)
let dragOrig = new Map()  // 本次拖动改过状态的格 → 拖动前状态(框缩小时实时回退)
let paintRaf = 0
let paintScrollEl = null  // 拖动目标所在的纵向滚动容器(边缘自动滚动作用对象)
let paintHostEl = null    // 矩形渲染宿主(.perm-collapse,容器内绝对定位 + 裁剪)
let paintBoxEl = null     // .perm-box(painting 类的直接开关)
let autoScrollRaf = 0
const AUTOSCROLL_EDGE = 28  // 距容器边缘多少像素触发自动滚动
const AUTOSCROLL_STEP = 9   // 每帧基础滚动量(px,按深入边缘比例加速)
function trailKey(panelCode, col) {
  return panelCode + ':' + col
}
function colLabel(col) {
  if (col === ALL_COL) return tt('全选')
  const act = permActions.value.find((a) => a[0] === col)
  return act ? tt(act[1]) : col
}
/** 由内容坐标换算锚点的视口纵坐标(容器自身滚动/页面滚动均自动跟随) */
function anchorViewportY() {
  if (!paintHostEl) return paint.ay
  const r = paintHostEl.getBoundingClientRect()
  return r.top + (paint.acy - paintHostEl.scrollTop)
}
/** 找 td 的最近纵向可滚动祖先(如权限分组的 .perm-collapse) */
function findScrollContainer(el) {
  let p = el && el.parentElement
  while (p) {
    const s = getComputedStyle(p)
    if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return p
    p = p.parentElement
  }
  return null
}
function cellState(row, col) {
  return col === ALL_COL ? isAllPerms(row) : hasPerm(row, col)
}
function setCellState(row, col, val) {
  if (col === ALL_COL) toggleAllPerms(row, val)
  else togglePerm(row, col, val)
}
function collectPaintCells() {
  paintCells = []
  panelRowMap = new Map(panelRows.value.map((r) => [r.panelCode, r]))
  document.querySelectorAll('.perm-box .perm-table tbody td[data-col]').forEach((td) => {
    const r = td.getBoundingClientRect()
    paintCells.push({ panel: td.dataset.panel, col: td.dataset.col, x: r.x, y: r.y, w: r.width, h: r.height })
  })
}
/** 矩形/徽标的直接 DOM 同步(高频路径,不经 Vue 响应式) */
function syncPaintUi() {
  if (rectRef.value && paintHostEl) {
    const r = paintHostEl.getBoundingClientRect()
    // 渲染盒与容器可视区取交集:布局级钳制,不产生横向滚动条,绝不超出面板
    const vx1 = Math.max(Math.min(paint.ax, paint.rx), r.left)
    const vx2 = Math.min(Math.max(paint.ax, paint.rx), r.left + paintHostEl.clientWidth)
    const vy1 = Math.max(Math.min(paint.ay, paint.ry), r.top)
    const vy2 = Math.min(Math.max(paint.ay, paint.ry), r.top + paintHostEl.clientHeight)
    const s = rectRef.value.style
    s.left = (vx1 - r.left) + 'px'
    s.width = Math.max(0, vx2 - vx1) + 'px'
    s.top = (vy1 - r.top + paintHostEl.scrollTop) + 'px'
    s.height = Math.max(0, vy2 - vy1) + 'px'
  }
  if (badgeRef.value) {
    badgeRef.value.style.left = (paint.x + 14) + 'px'
    badgeRef.value.style.top = (paint.y + 18) + 'px'
    badgeRef.value.textContent = (paint.value ? tt('勾选') : tt('取消')) + ' ' + colLabel(paint.col) + ' · ' + paint.count
  }
}
function processPaintRect() {
  paintRaf = 0
  if (!paint.active || !paint.moved) return
  paint.ay = anchorViewportY() // 滚动后锚点跟随内容(矩形不漂移)
  const x1 = Math.min(paint.ax, paint.rx)
  const x2 = Math.max(paint.ax, paint.rx)
  const y1 = Math.min(paint.ay, paint.ry)
  const y2 = Math.max(paint.ay, paint.ry)
  const covered = new Set()
  for (const c of paintCells) {
    // 框选语义:格子盒子与框选矩形相交即命中(中心点判定会因亚像素取整漏掉边界格)
    if (c.x + c.w < x1 || c.x > x2 || c.y + c.h < y1 || c.y > y2) continue
    const key = trailKey(c.panel, c.col)
    covered.add(key)
    const row = panelRowMap.get(c.panel)
    if (!row || cellState(row, c.col) === paint.value) continue
    if (!dragOrig.has(key)) dragOrig.set(key, { panel: c.panel, col: c.col, val: cellState(row, c.col) })
    setCellState(row, c.col, paint.value)
  }
  // 实时回退:本次拖动改过、现已退出框内的格恢复拖动前状态
  for (const [key, o] of dragOrig) {
    if (covered.has(key)) continue
    const row = panelRowMap.get(o.panel)
    if (row && cellState(row, o.col) !== o.val) setCellState(row, o.col, o.val)
    dragOrig.delete(key)
  }
  paint.count = covered.size
  syncPaintUi()
}
function scheduleProcess() {
  // rAF 节流:每帧最多重算一次(高频鼠标/触控下避免重复全量遍历造成卡顿)
  if (!paintRaf) paintRaf = requestAnimationFrame(processPaintRect)
}
/** 拖动期间持续运行:指针贴近/越过滚动容器上下边缘时按比例自动滚动 */
function autoScrollTick() {
  autoScrollRaf = 0
  if (!paint.active) return
  const el = paintScrollEl
  if (el && paint.moved) {
    const r = el.getBoundingClientRect()
    let d = 0
    if (paint.y < r.top + AUTOSCROLL_EDGE) {
      d = -AUTOSCROLL_STEP * Math.min(1, (r.top + AUTOSCROLL_EDGE - paint.y) / AUTOSCROLL_EDGE)
    } else if (paint.y > r.bottom - AUTOSCROLL_EDGE) {
      d = AUTOSCROLL_STEP * Math.min(1, (paint.y - (r.bottom - AUTOSCROLL_EDGE)) / AUTOSCROLL_EDGE)
    }
    if (d) {
      const before = el.scrollTop
      el.scrollTop = before + d
      if (el.scrollTop !== before) {
        collectPaintCells() // 滚动改变格子视口坐标,刷新几何后立即重算
        scheduleProcess()
      }
    }
  }
  autoScrollRaf = requestAnimationFrame(autoScrollTick)
}
function onPaintDown(row, col, e) {
  if (e.button !== 0) return
  e.preventDefault() // 禁止拖选时触发文本选择/原生点击
  paint.active = true
  paint.moved = false
  paint.col = col
  paint.value = col === ALL_COL ? !isAllPerms(row) : !hasPerm(row, col)
  paint.count = 0
  paint.ax = paint.rx = paint.x = e.clientX
  paint.ay = paint.ry = paint.y = e.clientY
  dragOrig.clear()
  setCellState(row, col, paint.value) // 单击=只切换该格(此时 moved=false,无反馈标识)
  collectPaintCells()
  // 锚点内容坐标 + 滚动容器(边缘自动滚动);无滚动容器时自动滚动自然失效
  paintScrollEl = findScrollContainer(e.currentTarget)
  paintHostEl = e.currentTarget.closest('.perm-collapse') || null
  paintBoxEl = e.currentTarget.closest('.perm-box') || null
  if (paintHostEl) {
    paint.acy = e.clientY - paintHostEl.getBoundingClientRect().top + paintHostEl.scrollTop
  }
  if (!autoScrollRaf) autoScrollRaf = requestAnimationFrame(autoScrollTick)
}
/** 框选 UI(矩形/徽标/painting 类)显隐:直接 DOM,不走 Vue 响应式 */
function setPaintUiVisible(v) {
  if (rectRef.value) rectRef.value.style.display = v ? 'block' : 'none'
  if (badgeRef.value) badgeRef.value.style.display = v ? 'block' : 'none'
  if (paintBoxEl) paintBoxEl.classList.toggle('painting', v)
}
function onPaintMove(e) {
  if (!paint.active) return
  paint.x = e.clientX
  paint.y = e.clientY
  if (!paint.moved) {
    // 位移超过阈值才认定拖动:普通单击不出现框选矩形/徽标/轨迹
    if (Math.hypot(e.clientX - paint.ax, e.clientY - paint.ay) < 4) return
    paint.moved = true
    setPaintUiVisible(true)
    syncPaintUi() // 显示前先就位(零尺寸矩形+徽标),避免首帧闪跳
  }
  paint.rx = e.clientX
  paint.ry = e.clientY
  scheduleProcess()
}
function onPaintUp() {
  if (!paint.active) return
  if (autoScrollRaf) { cancelAnimationFrame(autoScrollRaf); autoScrollRaf = 0 }
  if (paintRaf) { cancelAnimationFrame(paintRaf); paintRaf = 0 }
  if (paint.moved) processPaintRect() // 松开前补算:最终状态=松手时矩形覆盖
  paint.active = false
  setPaintUiVisible(false)
  dragOrig.clear()
  paintCells = []
  paintScrollEl = null
  paintHostEl = null
  paintBoxEl = null
  refreshHeadMarks() // 列头三态取松手后的最新值(直接 DOM,不触发重渲染)
}
function onPaintScroll() {
  // 拖动中滚动(滚轮/触摸板/程序滚动):格子视口坐标变化,刷新几何并重算覆盖
  // (锚点存内容坐标,processPaintRect 内自动换算回视口——矩形跟随内容不漂移)
  if (paint.active && paint.moved) {
    collectPaintCells()
    scheduleProcess()
  }
}

// ---- 列头三态下拉:全勾✓/部分"−"/全空(无标) → 菜单批量设置仅作用于当前模块分组 ----
// 性能:三态标记永远读"快照缓存"(普通 Map,非响应式)——thead 不实时依赖行 permsSet,
// 否则任何一格变更都会把 OrgAdmin(整个页面,dev 模式单次渲染 ~300ms)拉进重渲染。
// 缓存在权限变化点(拖动起止/菜单命令/分组按钮/载入)由 refreshHeadMarks() 重建,
// 并直接同步到 DOM(130 个标记节点,<1ms);菜单打开时弹层按当前缓存惰性渲染,天然新鲜。
let headMarkCache = new Map() // 分组 panels 数组 -> col -> {mark, cls, text}
function buildHeadMarkCache() {
  headMarkCache = new Map()
  const cols = [ALL_COL, ...permActions.value.map((a) => a[0])]
  for (const g of groupedPanels.value) {
    const m = new Map()
    for (const c of cols) {
      const n = colCount(g.panels, c)
      const total = g.panels.length
      m.set(c, {
        mark: n === 0 ? '' : n === total ? '✓' : '−',
        cls: n === 0 ? '' : n === total ? 'is-all' : 'is-part',
        text: n + '/' + total + ' ' + tt('已选'),
      })
    }
    headMarkCache.set(g.panels, m)
  }
}
/** 重建三态快照并直接同步到列头 DOM(不经 Vue 重渲染) */
function refreshHeadMarks() {
  buildHeadMarkCache()
  const items = document.querySelectorAll('.perm-collapse .el-collapse-item')
  groupedPanels.value.forEach((g, idx) => {
    const table = items[idx] && items[idx].querySelector('.perm-table')
    const m = headMarkCache.get(g.panels)
    if (!table || !m) return
    table.querySelectorAll('thead th[data-col]').forEach((th) => {
      const info = m.get(th.dataset.col)
      if (!info) return
      const caret = th.querySelector('.pt-head-caret')
      if (caret) {
        caret.classList.toggle('is-all', info.cls === 'is-all')
        caret.classList.toggle('is-part', info.cls === 'is-part')
      }
      const mark = th.querySelector('.pt-head-mark')
      if (mark) mark.textContent = info.mark
    })
  })
}
function colCount(panels, col) {
  if (col === ALL_COL) return panels.filter((r) => isAllPerms(r)).length
  return panels.filter((r) => hasPerm(r, col)).length
}
function colMark(panels, col) {
  const m = headMarkCache.get(panels)
  return (m && m.get(col) && m.get(col).mark) || ''
}
function colStateClass(panels, col) {
  const m = headMarkCache.get(panels)
  return (m && m.get(col) && m.get(col).cls) || ''
}
function colCountText(panels, col) {
  const m = headMarkCache.get(panels)
  return (m && m.get(col) && m.get(col).text) || ''
}
function setCol(panels, col, val) {
  let changed = 0
  for (const r of panels) {
    // 全选列:行有任意权限即视为"已选"(清空=清掉整行);普通列:按该列权限判断
    const cur = col === ALL_COL ? (!!r.permsSet && r.permsSet.size > 0) : hasPerm(r, col)
    if (cur === val) continue
    if (col === ALL_COL) toggleAllPerms(r, val)
    else togglePerm(r, col, val)
    changed++
  }
  return changed
}
function colClearMsg(col) {
  return tt('即将清空当前角色下所有面板的【{act}】权限').replace('{act}', colLabel(col))
}
function onHeadCommand(cmd, col, panels) {
  if (cmd === 'all') {
    const n = setCol(panels, col, true)
    showBanner(tt('已为{n}个面板开启【{act}】权限').replace('{n}', String(n)).replace('{act}', colLabel(col)))
  } else {
    ElMessage.info(colClearMsg(col)) // 清空属破坏性操作:执行前轻提示
    const n = setCol(panels, col, false)
    showBanner(tt('已清空{n}个面板的【{act}】权限').replace('{n}', String(n)).replace('{act}', colLabel(col)))
  }
  refreshHeadMarks()
}

// ---- 批量操作结果反馈:浅绿色横幅(4 秒自动消退) ----
const resultBanner = ref('')
let bannerTimer = null
function showBanner(text) {
  resultBanner.value = text
  if (bannerTimer) clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => { resultBanner.value = '' }, 4000)
}

const deptTree = ref([])
const deptVisible = ref(false)
const editingDept = ref(null)
const savingDept = ref(false)
const deptForm = reactive({ id: null, parentId: 0, deptName: '' })

const users = ref([])
const roles = ref([])

// ---------- 用户批量分配角色 ----------
const userSel = ref([])
function onUserSel(rows) {
  userSel.value = rows || []
}
const batchRoleVisible = ref(false)
const batchRoleId = ref(null)
async function applyBatchRole() {
  try {
    await request.post('/sys/user/batch-role', { userIds: userSel.value.map((u) => u.id), roleId: batchRoleId.value })
    ElMessage.success(`${tt('已为')} ${userSel.value.length} ${tt('个用户分配角色')}`)
    batchRoleVisible.value = false
    batchRoleId.value = null
    await loadUsers()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '批量分配失败')
  }
}

// ---------- 复制角色权限(把源角色勾选载入当前编辑,保存后生效) ----------
const copyFromRoleId = ref(null)
const copyableRoles = computed(() => roles.value.filter((r) => !r.isAdmin && selRole.value && r.id !== selRole.value.id))
async function copyRolePerms() {
  const src = roles.value.find((r) => r.id === copyFromRoleId.value)
  if (!src) return
  try {
    await ElMessageBox.confirm(
      `${tt('将用')}「${src.roleName}」${tt('的面板权限覆盖当前编辑内容？')}${tt('保存后生效')}`,
      tt('复制权限'),
      { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
    )
  } catch (e) {
    return
  }
  try {
    const r = await request.get('/sys/role/' + src.id + '/panels')
    const granted = r?.data?.granted || []
    const byCode = {}
    for (const g of granted) byCode[g.panelCode] = g.perms || ''
    for (const p of panelRows.value) {
      p.permsSet = new Set((byCode[p.panelCode] || '').split(',').filter(Boolean))
    }
    ElMessage.success(`${tt('已复制')}「${src.roleName}」${tt('的权限，确认无误后请保存')}`)
  } catch (e) {
    ElMessage.error('复制权限失败')
  }
}
const selRole = ref(null)
const panelRows = ref([])
const saving = ref(false)
const savingUser = ref(false)
const savingRole = ref(false)

const userVisible = ref(false)
const editingUser = ref(null)
const userForm = reactive({ userName: '', realName: '', password: '', deptId: null, roleId: null, enabled: 1 })
const newRoleVisible = ref(false)
const roleForm = reactive({ roleCode: '', roleName: '', remark: '' })

// el-tree-select 数据（value/label/children）
const deptSelectData = computed(() => toSelect(deptTree.value))
function toSelect(nodes) {
  return (nodes || []).map((n) => ({
    value: n.id,
    label: n.deptName,
    children: n.children && n.children.length ? toSelect(n.children) : undefined,
  }))
}

async function load() {
  await Promise.all([loadDepts(), loadUsers(), loadRoles()])
}

async function loadDepts() {
  try {
    const r = await request.get('/sys/dept/tree')
    deptTree.value = r?.data || []
  } catch (e) {
    ElMessage.error('部门加载失败')
  }
}

async function loadUsers() {
  try {
    const r = await request.get('/sys/user/list')
    users.value = r?.data || []
  } catch (e) {
    ElMessage.error('用户列表加载失败')
  }
}

async function loadRoles() {
  try {
    const r = await request.get('/sys/role/list')
    roles.value = r?.data || []
  } catch (e) {
    ElMessage.error('角色列表加载失败')
  }
}

function onDeptClick() {}

function newDept(parentId) {
  editingDept.value = null
  deptForm.id = null
  deptForm.parentId = parentId
  deptForm.deptName = ''
  deptVisible.value = true
}

function editDept(d) {
  editingDept.value = d
  deptForm.id = d.id
  deptForm.parentId = d.parentId
  deptForm.deptName = d.deptName
  deptVisible.value = true
}

async function saveDept() {
  if (!deptForm.deptName.trim()) return ElMessage.warning('请输入部门名称')
  savingDept.value = true
  try {
    await request.post('/sys/dept/save', { id: deptForm.id, parentId: deptForm.parentId || 0, deptName: deptForm.deptName })
    ElMessage.success('部门已保存')
    deptVisible.value = false
    await loadDepts()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    savingDept.value = false
  }
}

async function delDept(d) {
  try {
    await ElMessageBox.confirm('删除部门「' + d.deptName + '」？', '提示', { type: 'warning' })
  } catch (e) {
    return
  }
  try {
    await request.delete('/sys/dept/' + d.id)
    ElMessage.success('部门已删除')
    await loadDepts()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '删除失败')
  }
}

function openUser(row) {
  editingUser.value = row || null
  userForm.userName = row?.userName || ''
  userForm.realName = row?.realName || ''
  userForm.password = ''
  userForm.deptId = row?.deptId ?? null
  userForm.roleId = row?.roleId ?? null
  userForm.enabled = row?.enabled ?? 1
  userVisible.value = true
}

async function saveUser() {
  if (!userForm.userName.trim()) return ElMessage.warning('请输入账号')
  savingUser.value = true
  try {
    const body = { ...userForm }
    if (editingUser.value) body.id = editingUser.value.id
    await request.post('/sys/user/save', body)
    ElMessage.success('用户已保存')
    userVisible.value = false
    await loadUsers()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    savingUser.value = false
  }
}

async function saveRole() {
  if (!roleForm.roleCode.trim() || !roleForm.roleName.trim()) return ElMessage.warning('请填写编码与名称')
  savingRole.value = true
  try {
    await request.post('/sys/role/save', { ...roleForm })
    ElMessage.success('角色已创建')
    newRoleVisible.value = false
    roleForm.roleCode = ''
    roleForm.roleName = ''
    roleForm.remark = ''
    await loadRoles()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '创建失败')
  } finally {
    savingRole.value = false
  }
}

async function delRole(row) {
  try {
    await ElMessageBox.confirm('删除角色「' + row.roleName + '」？其下用户角色将清空', '提示', { type: 'warning' })
  } catch (e) {
    return
  }
  try {
    await request.delete('/sys/role/' + row.id)
    ElMessage.success('角色已删除')
    if (selRole.value && selRole.value.id === row.id) {
      selRole.value = null
      panelRows.value = []
    }
    await loadRoles()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '删除失败')
  }
}

async function onRoleSelect(row) {
  selRole.value = row
  if (row && !row.isAdmin) await loadRolePanels(row)
}

async function loadRolePanels(row) {
  try {
    const r = await request.get('/sys/role/' + row.id + '/panels')
    const d = r?.data || {}
    applyPanelModules(d.modules, d.actions)
    const all = (d.modules || []).flatMap((m) => m.panels || [])
    const granted = d.granted || []
    const grantedPerms = {}
    for (const g of granted) grantedPerms[g.panelCode] = g.perms || ''
    panelRows.value = all.map((p) => ({
      panelCode: p.panelCode,
      panelName: p.panelName,
      hasApproval: !!p.hasApproval,
      // 面板级动作集:文件类=专属 8 项(按真实操作行为),其余=通用 11 项
      actions: (p.actions && p.actions.length ? p.actions : permActions.value),
      permsSet: new Set((grantedPerms[p.panelCode] || '').split(',').filter(Boolean)),
    }))
    buildHeadMarkCache() // 首次渲染前备好快照(thead 三态绑定读缓存)
  } catch (e) {
    ElMessage.error('面板权限加载失败')
  }
}

async function savePanels() {
  saving.value = true
  try {
    const panels = panelRows.value
      .filter((p) => p.permsSet && p.permsSet.size > 0)
      .map((p) => ({ panelCode: p.panelCode, perms: [...p.permsSet].join(',') }))
    await request.post('/sys/role/' + selRole.value.id + '/panels', { panels })
    ElMessage.success('面板权限已保存')
    if (selRole.value.roleCode === user.roleCode) await user.fetchPerms()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load()
  window.addEventListener('pointermove', onPaintMove)
  window.addEventListener('pointerup', onPaintUp)
  window.addEventListener('scroll', onPaintScroll, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPaintMove)
  window.removeEventListener('pointerup', onPaintUp)
  window.removeEventListener('scroll', onPaintScroll, true)
})
</script>

<style scoped>
.org-wrap {
  display: flex;
  gap: 12px;
  padding: 14px;
  height: 100%;
  box-sizing: border-box;
}
.org-col {
  background: #fff;
  border: 1px solid #e3e8ef;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.org-col.dept { flex: 1; }
.org-col.users { flex: 1.4; }
.org-col.roles { flex: 1.6; }
.col-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.col-title { font-size: 14px; font-weight: 600; color: #1c4f8a; }
.col-tip { margin-top: 8px; font-size: 12px; color: #999; }
.dept-tree { overflow: auto; flex: 1; }
.dept-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 6px;
}
.dept-ops { display: none; }
.dept-node:hover .dept-ops { display: inline-flex; gap: 2px; }
.perm-box { margin-top: 12px; border-top: 1px dashed #d0d7e3; padding-top: 10px; }
.perm-head { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.perm-copy { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-weight: 400; }
.col-head-btns { display: inline-flex; gap: 8px; }
.batch-tip { margin-bottom: 10px; font-size: 13px; color: #6b7280; }
.perm-sub { font-weight: 400; color: #888; font-size: 12px; }
.admin-tip { color: #c0392b; font-size: 12px; padding: 8px 0; }
.perm-actions { margin-top: 10px; display: flex; gap: 8px; }
/* 2026-08-25：按业务模块分组的权限配置 */
.perm-collapse {
  position: relative; /* 框选矩形的定位宿主:矩形在容器内绝对定位,越界被裁剪 */
  border: 1px solid #e3e8ef;
  border-radius: 6px;
  max-height: 340px;
  overflow-y: auto;
}
.perm-collapse :deep(.el-collapse-item__header) {
  height: 34px;
  line-height: 34px;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #1c4f8a;
  background: #f7f9fc;
}
.perm-collapse :deep(.el-collapse-item__wrap) {
  padding: 6px 10px 10px;
}
.g-count {
  font-weight: 400;
  color: #999;
  font-size: 12px;
  margin-left: 6px;
}
.g-actions {
  margin-left: auto;
  margin-right: 14px;
  display: inline-flex;
  align-items: center;
}
/* 操作权限矩阵表(11 项) */
.perm-table-wrap { overflow: auto; max-height: 70vh; }
.perm-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #eef1f6;
}
.perm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.perm-table th {
  border: 1px solid #e8ecf1;
  padding: 4px 6px;
  text-align: center;
  white-space: nowrap;
}
.perm-table thead th {
  background: #f5f7fa;
  font-weight: 600;
  color: #333;
  font-size: 11px;
}
.perm-table th .pt-panel { text-align: left; }
/* 列头:操作名 + 三态标记(✓/−)+ ▾ 下拉(批量设置收进菜单,表头保持素净) */
.pt-head {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
.perm-table .pt-act { min-width: 40px; text-align: center; }
.perm-table .pt-na { color: #d1d5db; }
/* 原生大号勾选框(18px)+滑动扫选:整格命中,按下即切换,拖动批量套用 */
.perm-table .pt-cb {
  width: 18px;
  height: 18px;
  margin: 0;
  cursor: pointer;
  accent-color: #409eff;
  vertical-align: middle;
  pointer-events: none; /* 状态由格子 mousedown 统一驱动,勾选/滑动一致 */
}
.perm-table td.pt-sweep { cursor: pointer; user-select: none; padding: 6px 4px; }
.perm-table td.pt-sweep:active { background: #f0f6ff; }
.perm-table .pt-all {
  min-width: 40px;
  background: #fafbfc;
  font-weight: 600;
}
.pt-head-caret:hover { color: #409eff; background: rgba(64, 158, 255, 0.12); }
.pt-head-caret.is-all { color: #409eff; }
.pt-head-caret.is-part { color: #e6a23c; }
.pt-head-mark { font-weight: 700; }
.pt-head-arrow { font-size: 10px; }
/* 下拉菜单内的三态标记与计数行 */
.dd-mark { display: inline-block; width: 14px; color: #409eff; font-weight: 700; }
.dd-count {
  padding: 4px 16px 6px;
  margin: 0;
  font-size: 11px;
  color: #909399;
  cursor: default;
  border-top: 1px solid #ebeef5;
}
/* 批量操作结果横幅(浅绿) */
.result-banner {
  margin: 6px 0 8px;
  padding: 6px 10px;
  border-radius: 4px;
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  color: #529b2e;
  font-size: 12px;
}
/* ---- 拖动框选 ---- */
/* 框选中:禁止文本选区干扰(轨迹/格子样式见 PermRow 子组件) */
.perm-box.painting,
.perm-box.painting * { user-select: none; -webkit-user-select: none; }
/* 框选矩形(锚点到当前指针,主题蓝半透明+虚线边,不与勾选框蓝/表头灰冲突) */
.paint-rect {
  position: absolute; /* 容器内容坐标定位:随滚动移动,与容器可视区交集钳制 */
  z-index: 5;
  pointer-events: none;
  background: rgba(64, 158, 255, 0.10);
  border: 1px dashed rgba(64, 158, 255, 0.55);
}
/* 跟随光标的框选反馈徽标 */
.paint-badge {
  position: fixed;
  z-index: 3000;
  pointer-events: none;
  background: #1c4f8a;
  color: #fff;
  font-size: 12px;
  line-height: 18px;
  padding: 3px 10px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(28, 79, 138, 0.35);
  white-space: nowrap;
}
.paint-tip { margin-left: auto; font-size: 12px; color: #999; }
</style>
