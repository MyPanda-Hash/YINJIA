<template>
  <div class="tabsbar">
    <div class="tabs" ref="tabsWrapRef">
      <div
        v-for="t in tabs.tabs"
        :key="t.path"
        class="tab"
        :class="{ active: tabs.active === t.path }"
        @click="go(t)"
        @contextmenu.prevent="showCtx(t, $event)"
      >
        <span>{{ tt(t.title) }}</span>
        <el-icon v-if="!t.affix" class="close" @click.stop="closeAndGo(t.path)"><Close /></el-icon>
      </div>
    </div>

    <!-- T+ tabs-right 按钮组：最大化恢复 / 关闭全部 -->
    <div class="tab-actions">
      <el-tooltip :content="app.maxContent ? '恢复' : '最大化'" placement="bottom">
        <el-icon class="action-icon" @click="app.toggleMaxContent()">
          <FullScreen v-if="!app.maxContent" />
          <Crop v-else />
        </el-icon>
      </el-tooltip>

      <el-tooltip content="关闭全部页签" placement="bottom">
        <el-icon class="action-icon" @click="closeAll"><Close /></el-icon>
      </el-tooltip>
    </div>

    <ul v-if="ctx.tab" class="ctx-menu" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @mouseleave="ctx.tab = null">
      <li @click="doCtx('refresh')">刷新</li>
      <li v-if="!ctx.tab.affix" @click="doCtx('close')">关闭</li>
      <li @click="doCtx('others')">关闭其他</li>
      <li @click="doCtx('all')">关闭全部</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTabsStore } from '@/stores/tabs'
import { useUnsavedStore, tabClosePlan } from '@/stores/unsaved'
import { useAppStore } from '@/stores/app'
import { apiPageManuOrders } from '@/business/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'

const tabs = useTabsStore()
const unsaved = useUnsavedStore()
const app = useAppStore()
const router = useRouter()
const route = useRoute()

// 路由变化时同步活动页签的 query/标题（含 生单跳转 ?code= 等），保证切回页签数据不丢
watch(
  () => route.fullPath,
  () => tabs.sync(route),
  { immediate: true }
)
const ctx = ref({ tab: null, x: 0, y: 0 })
const findPop = ref(false)
const findNo = ref('')

function go(t) {
  tabs.setActive(t.path)
  // 恢复页签携带的 query（如 ?code=单据号），修复切换单据回来数据丢失
  router.push({ path: t.path, query: t.query || {} })
}

function refresh() {
  router.replace({ path: route.path, query: { ...route.query, _t: Date.now() } })
}

function showCtx(tab, e) {
  ctx.value = { tab, x: e.clientX, y: e.clientY + 4 }
}

function doCtx(cmd) {
  const { tab } = ctx.value
  ctx.value.tab = null
  if (cmd === 'refresh') refresh()
  else if (cmd === 'close') closeAndGo(tab.path)
  else if (cmd === 'others') { closeOthersGuarded(tab.path) }
  else if (cmd === 'all') { closeAllGuarded() }
}

/**
 * 关页签前问一句(2026-10-16 用户口径:「面板在未×掉之前数据保留,叉掉时还应该弹窗提示是否保存」)。
 * 面板(PanelxList)挂载时把自己的未保存状态与保存/放弃能力登记在 stores/unsaved,这里按 path 取;
 * 没登记或报告不脏 ⇒ 直接关(判定表见 stores/unsaved.js 的 tabClosePlan,带单测)。
 * @returns {Promise<boolean>} 是否放行关闭
 */
async function confirmCloseIfDirty(path) {
  const api = unsaved.apiOf(path)
  if (tabClosePlan(api).step !== 'ask') return true
  let choice = null
  try {
    await ElMessageBox.confirm(tt('当前单据有未保存的修改，是否保存？'), tt('关闭前确认'), {
      distinguishCancelAndClose: true,
      confirmButtonText: tt('保存'),
      cancelButtonText: tt('不保存'),
      closeOnClickModal: false,
      type: 'warning',
    })
    choice = 'save'
  } catch (e) {
    // cancel = 点了「不保存」;close = 右上角 × / ESC ⇒ 当作取消关闭(绝不静默丢数据)
    choice = e === 'cancel' ? 'discard' : 'cancel'
  }
  const plan = tabClosePlan(api, choice)
  if (plan.step === 'cancel') return false
  if (plan.step === 'save') {
    const ok = await api.save()
    if (!ok) return false // 校验没过/保存失败:保持页签打开,让用户看到报错
  } else if (plan.step === 'discard') {
    const ok = await api.discard()
    if (!ok) return false
  }
  api?.confirmLeave?.() // 已问过:放行随后那次导航,别让路由守卫再问一遍
  return true
}

async function closeAndGo(path) {
  if (!(await confirmCloseIfDirty(path))) return
  tabs.close(path)
  if (route.path === path) {
    const act = tabs.tabs.find((t) => t.path === tabs.active)
    router.replace(act ? { path: act.path, query: act.query || {} } : tabs.active)
  }
}

/** 关闭其他页签:逐个问(有未保存内容的不经确认不关) */
async function closeOthersGuarded(keepPath) {
  for (const t of [...tabs.tabs]) {
    if (t.affix || t.path === keepPath) continue
    if (!(await confirmCloseIfDirty(t.path))) {
      // 中途取消:已经关掉的保持关掉,剩下的留着(与「关闭其他」的语义一致,不静默丢弃未保存内容)
      if (route.path !== tabs.active) return
      break
    }
  }
  tabs.closeOthers(keepPath)
  router.replace(keepPath)
}

/** 关闭全部页签:同样逐个问 */
async function closeAllGuarded() {
  for (const t of [...tabs.tabs]) {
    if (t.affix) continue
    if (!(await confirmCloseIfDirty(t.path))) {
      if (route.path !== tabs.active) return
      break
    }
  }
  closeAll()
}

function closeAll() {
  tabs.closeAll()
  router.replace('/dashboard')
}

function onMore(cmd) {
  if (!cmd) return
  if (cmd.startsWith('go:')) {
    const p = cmd.slice(3)
    tabs.setActive(p)
    const t = tabs.tabs.find((x) => x.path === p)
    router.push({ path: p, query: t ? t.query || {} : {} })
  } else if (cmd === 'others') {
    tabs.closeOthers(tabs.active)
  } else if (cmd === 'all') {
    closeAll()
  } else if (cmd === 'refresh') {
    refresh()
  }
}

// 快速查找单据：按编号搜索生产加工单（T+ searchVoucher 对应能力）
async function quickFind() {
  const no = findNo.value.trim()
  if (!no) return ElMessage.warning('请输入单据编号')
  try {
    const res = await apiPageManuOrders({ orderNo: no, pageNo: 1, pageSize: 5 })
    const hit = res.records?.[0] || res.list?.[0]
    if (!hit) {
      ElMessage.warning(`未找到单据：${no}`)
      return
    }
    const path = `/panelx/form/MANU_ORDER?id=${hit.id}`
    tabs.open({ title: `加工单 ${hit.orderNo}`, path: '/panelx/form/MANU_ORDER', query: { id: hit.id } })
    router.push(path)
    findPop.value = false
    findNo.value = ''
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '查询失败')
  }
}
</script>

<style scoped>
.tabsbar {
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: stfetch;
  background: var(--t-card-bg);
  border-bottom: 1px solid var(--t-border);
}
.tabs {
  display: flex;
  padding: 0 8px;
  overflow: hidden;
  flex: 1;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 36px;
  font-size: 13px;
  color: var(--t-text-2);
  border-bottom: 3px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.tab:hover {
  color: var(--t-text-1);
}
.tab.active {
  color: var(--t-primary);
  border-bottom-color: var(--t-tab-active);
  font-weight: 600;
}
.tab .close {
  font-size: 13px;
  border-radius: 50%;
}
.tab .close:hover {
  background: #d9dee5;
  color: var(--t-text-1);
}
.tab-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 12px;
  flex-shrink: 0;
}
.action-icon {
  font-size: 15px;
  color: var(--t-text-2);
  cursor: pointer;
  outline: none;
}
.action-icon:hover {
  color: var(--t-primary);
}
.find-box {
  padding: 2px 0;
}
.find-btn {
  cursor: pointer;
}
.ctx-menu {
  position: fixed;
  z-index: 3000;
  background: var(--t-card-bg);
  border: 1px solid var(--t-border);
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  list-style: none;
  margin: 0;
  padding: 4px 0;
  min-width: 110px;
}
.ctx-menu li {
  padding: 7px 16px;
  font-size: 13px;
  cursor: pointer;
  color: var(--t-text-1);
}
.ctx-menu li:hover {
  background: var(--t-hover-bg);
  color: var(--t-primary);
}

/* ===== 移动端（≤768px）：页签横向滑动 + 操作区紧凑 ===== */
@media (max-width: 768px) {
  .tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .tab {
    padding: 0 10px;
    font-size: 13px;
  }
  .tab-actions {
    gap: 8px;
    padding: 0 8px;
  }
  .action-icon {
    font-size: 16px;
    padding: 4px;
  }
}
</style>
