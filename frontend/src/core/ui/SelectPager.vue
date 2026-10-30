<template>
  <!-- 下拉候选的翻页条（2026-10-30 用户口径「提供切页选项…不会出现明明有这个物料但找不到」）。
       放在 el-select 的 #footer 槽里：中间报"现在看的是第几条到第几条 / 共多少"，
       两端是上一页 / 下一页，到头的一段变灰且不响应点击。
       ⚠ 必须 stop 掉 click/mousedown 的冒泡：弹层是"点外面就关"的，
       一次翻页把下拉关掉，用户点完还得再点开一次 —— 那就等于没做。 -->
  <div class="sel-pager" @click.stop @mousedown.stop>
    <span class="spg-nav" :class="{ 'is-off': page <= 1 }" @click="go(page - 1)">‹ {{ tt('上一页') }}</span>
    <span class="spg-info">{{ from }}–{{ to }} / {{ total }}</span>
    <span class="spg-nav" :class="{ 'is-off': page >= pages }" @click="go(page + 1)">{{ tt('下一页') }} ›</span>
  </div>
</template>

<script setup>
import { tt } from '@/i18n'

const props = defineProps({
  page: { type: Number, default: 1 },
  pages: { type: Number, default: 1 },
  from: { type: Number, default: 0 },
  to: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
})
const emit = defineEmits(['go'])

/** 越界不出事：夹到 [1, pages] 再抛出去，调用方拿到的一定是有效页码 */
function go(p) {
  const want = Math.trunc(Number(p) || 1)
  const next = Math.min(Math.max(1, want), Math.max(1, props.pages))
  if (next !== props.page) emit('go', next)
}
</script>

<style scoped>
.sel-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 6px;
  border-top: 1px solid var(--t-border-light);
  font-size: 12px;
  user-select: none;
}
.spg-nav {
  flex: none;
  padding: 3px 8px;
  border-radius: 4px;
  color: var(--t-primary);
  cursor: pointer;
  transition: background-color 0.12s ease;
}
.spg-nav:hover {
  background: var(--t-hover-bg);
}
.spg-nav.is-off {
  color: var(--t-text-3);
  cursor: default;
}
.spg-nav.is-off:hover {
  background: transparent;
}
.spg-info {
  flex: 1 1 auto;
  text-align: center;
  color: var(--t-text-2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
