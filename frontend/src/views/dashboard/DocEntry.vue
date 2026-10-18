<template>
  <!-- 模块「单据入口」(2026-10-18):列出本模块最近 7 张单据,点一行 = 跳到该单据所在面板并定位这张单
       (跳转口径与桌面其它卡片一致:/panelx/list/<panelCode>?focus=<单号>)。
       根元素刻意是 section.card —— 父组件(桌面)的 .card / .col-12 是 scoped 样式,子组件根节点
       会继承父作用域 id,所以卡片外观与栅格宽度都沿用桌面那一套,不另起一套卡片皮肤。 -->
  <section class="card doc-entry">
    <div class="doc-head" :class="{ compact }">
      <h3>{{ tt('单据入口') }}</h3>
      <span class="doc-sub">{{ tt('最近 7 张单据') }}</span>
      <!-- 可选面板(2026-10-18 用户口径):默认「全部面板」= 本模块汇总;选某张面板 ⇒ 只出该面板最近 7 张。
           选项来自后端返回的 panels(接口保证 panels 不随 panel 收窄),clearable 可退回全部。 -->
      <el-select
        v-model="selectedPanel"
        class="doc-filter"
        size="small"
        clearable
        filterable
        :placeholder="tt('全部面板')"
        :aria-label="tt('全部面板')"
        @change="load"
      >
        <el-option v-for="p in panels" :key="p.code" :label="tt(p.name)" :value="p.code" />
      </el-select>
      <span v-if="panels.length" class="doc-count">{{ panels.length }} {{ tt('个单据面板') }}</span>
    </div>
    <div v-if="loading" class="doc-empty">{{ tt('加载中…') }}</div>
    <div v-else-if="!docs.length" class="doc-empty">{{ tt('暂无单据') }}</div>
    <template v-else>
      <div class="doc-list" :class="{ compact }">
        <button
          v-for="d in docs"
          :key="d.panelCode + ':' + d.docNo"
          type="button"
          class="doc-item"
          :title="tt(d.panelName) + ' ' + d.docNo"
          @click="emit('open', d)"
        >
          <span class="doc-badge">{{ tt(d.panelName) }}</span>
          <span class="doc-no">{{ d.docNo || '-' }}</span>
          <span class="doc-meta">{{ d.creator || '-' }} · {{ fmtTime(d.at) }}</span>
          <span class="doc-go" aria-hidden="true">›</span>
        </button>
      </div>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import request from '@core/request'
import { tt } from '@/i18n'

const props = defineProps({
  // 模块键:rd / prod / stock / sales / quality(后端 /dashboard/module-docs 按它取面板范围)
  module: { type: String, required: true },
  // 取几张:默认 7(用户口径「显示最新的 7 张单据」)
  limit: { type: Number, default: 7 },
  // 窄卡片(研发页塞在 3 栏栅格的一格里,宽约 430px):列表改单列、徽标与单号收窄,
  // 否则两列时 badge+单号的最小宽度之和会超出格子
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['open'])

const docs = ref([])
const panels = ref([])
const loading = ref(true)
/** 选中的单据面板码;空 = 全部面板(后端不带 panel 参数) */
const selectedPanel = ref('')

/** 时间显示口径与研发「最新单据」一致:yyyy-MM-dd HH:mm,秒与 T 都截掉 */
function fmtTime(t) {
  if (!t) return ''
  const s = String(t).replace('T', ' ')
  return s.length > 16 ? s.slice(0, 16) : s
}

async function load() {
  loading.value = true
  try {
    const params = { module: props.module, limit: props.limit }
    if (selectedPanel.value) params.panel = selectedPanel.value
    const r = await request.get('/dashboard/module-docs', { params })
    const d = r?.data || {}
    docs.value = d.docs || []
    panels.value = d.panels || []
  } catch {
    // 静默:桌面不该因为一个入口接口失败而弹错(与 loadRd/loadFlow 同口径)
    docs.value = []
    panels.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.doc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.doc-head h3 {
  margin: 0;
  position: relative;
  padding-left: 9px;
  font-size: 14px;
  font-weight: 650;
  color: var(--t-text-1, #263548);
}
.doc-head h3::before {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  width: 3px;
  background: var(--t-primary, #116a5b);
  content: '';
}
.doc-sub {
  font-size: 12px;
  color: #9ca3af;
}
.doc-count {
  margin-left: 8px;
  font-size: 12px;
  color: #9ca3af;
}
/* 可选面板下拉:靠右;compact(研发页 ~400px 卡)时收窄并让出副标题的位置 */
.doc-filter {
  flex: none;
  width: 190px;
  margin-left: auto;
}
.doc-head.compact .doc-sub {
  display: none;
}
.doc-head.compact .doc-filter {
  width: 140px;
}
/* 手机(≤768):标题/副标题/计数一行,面板下拉整体换到下一行并拉满(190px 固定宽在 355px 卡里必溢出) */
@media (max-width: 768px) {
  .doc-head {
    flex-wrap: wrap;
  }
  .doc-filter,
  .doc-head.compact .doc-filter {
    order: 5;
    width: 100%;
    margin-left: 0;
  }
  .doc-count {
    margin-left: auto;
  }
}
.doc-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 10px;
}
@media (max-width: 768px) {
  .doc-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* 窄卡片单列(研发页 3 栏栅格里的那一格) */
.doc-list.compact {
  grid-template-columns: minmax(0, 1fr);
}
.doc-list.compact .doc-badge {
  max-width: 104px;
}
.doc-list.compact .doc-no {
  max-width: 170px;
}
.doc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  color: inherit;
}
.doc-item:hover {
  background: #f0f6ff;
}
.doc-item:focus-visible {
  outline: 2px solid var(--t-primary, #116a5b);
  outline-offset: -2px;
}
.doc-badge {
  flex: none;
  max-width: 128px;
  overflow: hidden;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: #1f6f61;
  background: #eef7f4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.doc-no {
  flex: none;
  overflow: hidden;
  max-width: 210px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  color: #263548;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.doc-meta {
  flex: 1;
  overflow: hidden;
  font-size: 12px;
  color: #9ca3af;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.doc-go {
  flex: none;
  font-size: 14px;
  color: #c8ced8;
}
.doc-empty {
  padding: 20px 0;
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
}
</style>
