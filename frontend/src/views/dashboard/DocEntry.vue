<template>
  <!-- 模块「单据入口」(2026-10-18):列出本模块最近 7 张单据,点一行 = 跳到该单据所在面板并定位这张单
       (跳转口径与桌面其它卡片一致:/panelx/list/<panelCode>?focus=<单号>)。
       根元素刻意是 section.card —— 父组件(桌面)的 .card / .col-12 是 scoped 样式,子组件根节点
       会继承父作用域 id,所以卡片外观与栅格宽度都沿用桌面那一套,不另起一套卡片皮肤。 -->
  <section class="card doc-entry">
    <div class="doc-head">
      <h3>{{ tt('单据入口') }}</h3>
      <span class="doc-sub">{{ tt('最近 7 张单据') }}</span>
      <span v-if="panels.length" class="doc-count">{{ panels.length }} {{ tt('个单据面板') }}</span>
    </div>
    <div v-if="loading" class="doc-empty">{{ tt('加载中…') }}</div>
    <div v-else-if="!docs.length" class="doc-empty">{{ tt('暂无单据') }}</div>
    <template v-else>
      <div class="doc-list">
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
})
const emit = defineEmits(['open'])

const docs = ref([])
const panels = ref([])
const loading = ref(true)

/** 时间显示口径与研发「最新单据」一致:yyyy-MM-dd HH:mm,秒与 T 都截掉 */
function fmtTime(t) {
  if (!t) return ''
  const s = String(t).replace('T', ' ')
  return s.length > 16 ? s.slice(0, 16) : s
}

async function load() {
  loading.value = true
  try {
    const r = await request.get('/dashboard/module-docs', { params: { module: props.module, limit: props.limit } })
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
  align-items: baseline;
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
  margin-left: auto;
  font-size: 12px;
  color: #9ca3af;
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
