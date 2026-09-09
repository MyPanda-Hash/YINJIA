<template>
  <div class="notice-center">
    <el-popover
      v-for="cfg in types"
      :key="cfg.type"
      :visible="visible === cfg.type"
      placement="bottom-end"
      :width="340"
      popper-class="notice-popover"
      @show="load(cfg.type)"
      @hide="handleHide(cfg.type)"
    >
      <template #reference>
        <button
          type="button"
          class="nc-ref"
          :class="[`type-${cfg.type}`, { active: visible === cfg.type }]"
          :aria-label="`${cfg.title}${badge[cfg.type] ? `，${badge[cfg.type]} 条` : ''}`"
          @click="visible = visible === cfg.type ? null : cfg.type"
        >
          <el-tooltip :content="cfg.title" placement="bottom">
            <el-badge :value="badge[cfg.type]" :max="99" :hidden="!badge[cfg.type]" class="nc-badge">
              <el-icon><component :is="cfg.icon" /></el-icon>
            </el-badge>
          </el-tooltip>
        </button>
      </template>
      <div class="nc-head">
        <div class="nc-heading">
          <span class="nc-title">{{ tt(cfg.title) }}</span>
          <span class="nc-scope">{{ user.account || user.realName }}</span>
        </div>
        <div class="nc-head-actions">
          <span v-if="cfg.type === 'msg' && badge.msg" class="nc-more" @click.stop="readAllMsg">{{ tt('全部已读') }}</span>
          <span class="nc-more" @click="openHistory(cfg)">{{ tt('全部') }} {{ badge[cfg.type] || 0 }} {{ tt('项') }}</span>
        </div>
      </div>
      <div v-loading="loadingMap[cfg.type]" class="nc-list">
        <div
          v-for="n in listMap[cfg.type]"
          :key="n.id"
          class="nc-item"
          :class="{ unread: !n.read }"
          @click="openDetail(n, cfg)"
        >
          <div class="nc-item-top">
            <span class="nc-item-title">{{ n.title }}</span>
            <span v-if="!n.read" class="nc-dot"></span>
          </div>
          <div class="nc-item-summary">{{ n.content }}</div>
          <div class="nc-item-time">{{ n.time }}</div>
        </div>
        <el-empty v-if="!listMap[cfg.type]?.length" :description="tt('暂无数据')" :image-size="50" />
      </div>
    </el-popover>

    <el-dialog v-model="detailVisible" :title="tt(current?.typeTitle || '消息通知')" width="560px" append-to-body>
      <div v-if="current" class="nc-detail">
        <div class="nc-detail-head">
          <el-tag size="small" :type="current.tagType">{{ current.typeTitle }}</el-tag>
          <span class="nc-detail-title">{{ current.title }}</span>
        </div>
        <div class="nc-detail-time">{{ current.time }}</div>
        <div class="nc-detail-content">{{ current.content }}</div>
      </div>
      <template #footer>
        <el-button @click="openHistory(currentCrg)">{{ tt('全部记录') }}</el-button>
        <el-button :disabled="!hasPrev" @click="step(-1)">{{ tt('上一条') }}</el-button>
        <el-button :disabled="!hasNext" @click="step(1)">{{ tt('下一条') }}</el-button>
        <el-button @click="detailVisible = false">{{ tt('关闭') }}</el-button>
        <el-button v-if="current?.targetPath" type="primary" @click="goCurrent">
          {{ current.actionLabel || '前往处理' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyVisible" :title="`${historyCrg.title}记录`" width="620px" append-to-body>
      <div class="nc-history">
        <div
          v-for="n in historyList"
          :key="n.id"
          class="nc-item"
          :class="{ unread: !n.read }"
          @click="openDetail(n, historyCrg)"
        >
          <div class="nc-item-top">
            <el-tag size="small" :type="n.tagType" class="nc-h-tag">{{ n.typeTitle }}</el-tag>
            <span class="nc-item-title">{{ n.title }}</span>
            <span v-if="!n.read" class="nc-dot"></span>
          </div>
          <div class="nc-item-summary">{{ n.content }}</div>
          <div class="nc-item-time">{{ n.time }}</div>
        </div>
        <el-empty v-if="!historyList.length" :description="tt('暂无历史消息')" :image-size="60" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { apiGetBadge, apiGetNotices, apiGetMessages, apiReadMessage, apiReadAllMessages } from '@/business/api'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'
import { ElMessage } from 'element-plus'

const router = useRouter()
const user = useUserStore()

const types = [
  { type: 'todo', title: '待办', icon: 'Bell' },
  { type: 'msg', title: '消息', icon: 'ChatDotRound' },
  { type: 'dev', title: '产品开发', icon: 'Promotion' },
  { type: 'alarm', title: '预警', icon: 'Warning' },
]

const TAG_TYPE = { todo: 'warning', msg: 'primary', dev: 'primary', alarm: 'danger' }

const visible = ref(null)
const badge = ref({ todo: 0, msg: 0, dev: 0, alarm: 0 })
const listMap = reactive({ todo: [], msg: [], dev: [], alarm: [] })
const loadingMap = reactive({ todo: false, msg: false, dev: false, alarm: false })

// ── 业务事件消息(2026-09-09):消息码 + 参数 → i18n 模板渲染(键即中文模板,切语言消息跟着变) ──
const MSG_TPL = {
  APPROVAL_SUBMITTED: { title: '新的待审批单据', body: '{actor} 提交了「{panelName} {docNo}」，等待您审批。' },
  APPROVAL_APPROVED: { title: '审批通过', body: '您提交的「{panelName} {docNo}」已由 {actor} 审批通过。' },
  APPROVAL_REJECTED: { title: '审批被驳回', body: '您提交的「{panelName} {docNo}」被 {actor} 驳回。意见：{opinion}' },
  MODIFY_REQUESTED: { title: '新的修改申请', body: '{actor} 申请修改「{panelName} {docNo}」，等待您审批。' },
  DELETE_REQUESTED: { title: '新的删除申请', body: '{actor} 申请删除「{panelName} {docNo}」，等待您审批。' },
}

function fillTpl(text, params) {
  let out = tt(text)
  for (const [k, v] of Object.entries(params || {})) {
    out = out.split(`{${k}}`).join(v === null || v === undefined ? '' : String(v))
  }
  return out.replace(/\{[a-zA-Z]+\}/g, '').trim()
}

function mapMsg(r) {
  const tpl = MSG_TPL[r['消息码']] || { title: '业务消息', body: '{panelName} {docNo}' }
  const params = r.params || {}
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
  loadingMap[type] = true
  try {
    if (type === 'msg') {
      const rows = await apiGetMessages({ limit: 100 })
      listMap.msg = (rows || []).map(mapMsg)
      badge.value = { ...badge.value, msg: listMap.msg.filter((m) => !m.read).length }
    } else {
      listMap[type] = await apiGetNotices(type)
      badge.value = { ...badge.value, [type]: listMap[type].length }
    }
  } catch (e) {
    listMap[type] = []
  } finally {
    loadingMap[type] = false
  }
}

/** 全部已读(仅「消息」页签) */
async function readAllMsg() {
  try {
    const res = await apiReadAllMessages()
    badge.value = { ...badge.value, msg: res?.unread ?? 0 }
    listMap.msg = listMap.msg.map((m) => ({ ...m, read: true }))
    ElMessage.success(tt('已全部标记为已读'))
  } catch (e) {
    ElMessage.error(tt('操作失败'))
  }
}

const detailVisible = ref(false)
const historyVisible = ref(false)
const current = ref(null)
const currentCrg = ref(types[0])
const historyCrg = ref(types[0])
const historyList = ref([])

async function refreshBadge() {
  try {
    badge.value = { ...badge.value, ...(await apiGetBadge()) }
  } catch (e) {}
}

function decorate(n) {
  return { ...n, typeTitle: types.find((t) => t.type === n.type)?.title || n.type, tagType: TAG_TYPE[n.type] || 'info' }
}

function handleHide(type) {
  if (visible.value === type) visible.value = null
}

function openDetail(n, cfg) {
  // 业务消息:点开即已读(2026-09-09)
  if (n.type === 'msg' && !n.read && n.rawId) {
    n.read = true
    apiReadMessage(n.rawId)
      .then((res) => { badge.value = { ...badge.value, msg: res?.unread ?? 0 } })
      .catch(() => {})
  }
  current.value = decorate(n)
  currentCrg.value = cfg
  visible.value = null
  historyVisible.value = false
  detailVisible.value = true
}

function openHistory(cfg) {
  historyCrg.value = cfg
  historyList.value = listMap[cfg.type].map(decorate)
  visible.value = null
  detailVisible.value = false
  historyVisible.value = true
}

async function goCurrent() {
  if (!current.value?.targetPath) return
  const target = {
    path: current.value.targetPath,
    query: current.value.formNo ? { focus: current.value.formNo } : {},
  }
  detailVisible.value = false
  historyVisible.value = false
  await router.push(target)
}

const hasPrev = computed(() => {
  if (!current.value) return false
  const list = listMap[current.value.type] || []
  return list.findIndex((n) => n.id === current.value.id) > 0
})

const hasNext = computed(() => {
  if (!current.value) return false
  const list = listMap[current.value.type] || []
  const idx = list.findIndex((n) => n.id === current.value.id)
  return idx >= 0 && idx < list.length - 1
})

function step(dir) {
  if (!current.value) return
  const list = listMap[current.value.type] || []
  const idx = list.findIndex((n) => n.id === current.value.id)
  const next = list[idx + dir]
  if (next) current.value = decorate(next)
}

let refreshTimer = null

onMounted(() => {
  Promise.all(types.map((type) => load(type.type)))
  refreshTimer = window.setInterval(() => {
    refreshBadge()
    if (visible.value) load(visible.value)
  }, 60_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<style scoped>
.notice-center {
  height: 34px;
  display: inline-grid;
  /* 自适应列数(原来写死 repeat(3,34px),加到 5 个页签后会折行错位) */
  grid-auto-flow: column;
  grid-auto-columns: 34px;
  align-items: center;
  flex: 0 0 auto;
  overflow: visible;
  border: 1px solid var(--t-border);
  border-radius: 6px;
  background: var(--t-sidebar-bg);
}

.nc-ref {
  position: relative;
  width: 34px;
  height: 32px;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0;
  appearance: none;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--t-navbar-text);
  font: inherit;
  font-size: 17px;
  cursor: pointer;
  outline: none;
}

.nc-ref + .nc-ref::before {
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: 0;
  width: 1px;
  background: var(--t-border);
  content: '';
}

.nc-ref:hover,
.nc-ref.active {
  color: var(--t-primary);
  background: var(--t-hover-bg);
}

.nc-ref.type-todo.active { color: #a56b14; background: #fff3dc; }
.nc-ref.type-msg.active { color: #1a56db; background: #e8f0fe; }
.nc-ref.type-dev.active { color: #1a56db; background: #e8f0fe; }
.nc-ref.type-alarm.active { color: #ad4438; background: #faece9; }

.nc-badge {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
}

.nc-badge :deep(.el-badge__content) {
  top: 0;
  right: 2px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border: 2px solid var(--t-navbar-bg);
  background-color: var(--t-badge);
  font-size: 9px;
  line-height: 11px;
  transform: translate(52%, -38%);
}
.nc-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--t-border-light);
  padding-bottom: 8px;
  margin-bottom: 6px;
}
/* 消息页签头部动作:全部已读 + 全部N项 */
.nc-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.nc-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--t-text-1);
}
.nc-heading {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.nc-scope {
  max-width: 120px;
  overflow: hidden;
  color: var(--t-text-3);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nc-more {
  font-size: 12px;
  color: var(--t-primary);
  cursor: pointer;
}
.nc-list {
  min-height: 86px;
  max-height: 320px;
  overflow: auto;
}
.nc-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.nc-item:hover {
  background: var(--t-hover-bg);
}
.nc-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nc-item-title {
  font-size: 13px;
  color: var(--t-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nc-item.unread .nc-item-title {
  font-weight: 600;
}
.nc-item-summary {
  display: -webkit-box;
  margin-top: 3px;
  overflow: hidden;
  color: var(--t-text-2);
  font-size: 12px;
  line-height: 18px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.nc-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--t-badge);
  flex-shrink: 0;
}
.nc-item-time {
  font-size: 12px;
  color: var(--t-text-3);
  margin-top: 2px;
}
.nc-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nc-detail-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--t-text-1);
}
.nc-detail-time {
  font-size: 12px;
  color: var(--t-text-3);
  margin: 8px 0;
}
.nc-detail-content {
  font-size: 13px;
  line-height: 1.8;
  color: var(--t-text-2);
  background: var(--t-content-bg);
  border-radius: 8px;
  padding: 12px;
  min-height: 80px;
}
.nc-history {
  max-height: 420px;
  overflow: auto;
}
.nc-h-tag {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .notice-center {
    height: 36px;
    grid-template-columns: repeat(3, 36px);
  }

  .nc-ref {
    width: 36px;
    height: 34px;
    font-size: 18px;
  }
}

:global(.notice-popover) {
  max-width: calc(100vw - 20px);
}
</style>
