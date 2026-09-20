<template>
  <!-- 左栏「单据选择」翻页条(顶/底各一条):整页翻(每页 = pageSize 条,当前 50 条),
       首/末页按钮在边界自动置灰;页码口径 = 后端分页页号(与页脚「第 X/N 张」同一数据源)。 -->
  <div class="drp">
    <span class="drp-btn" :class="{ off: atFirst }" :title="tt('首页')" @click="go(1)">◁</span>
    <span class="drp-btn" :class="{ off: atFirst }" :title="tt('上一页')" @click="go(pageNo - 1)">◀</span>
    <span class="drp-no">
      {{ tt('第 {p}/{n} 页').replace('{p}', String(pageNo)).replace('{n}', String(pageCount)) }}
      <span class="drp-range">（{{ from }}-{{ to }} / {{ total }}）</span>
    </span>
    <span class="drp-btn" :class="{ off: atLast }" :title="tt('下一页')" @click="go(pageNo + 1)">▶</span>
    <span class="drp-btn" :class="{ off: atLast }" :title="tt('末页')" @click="go(pageCount)">▷</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { tt } from '@/i18n'

const props = defineProps({
  /** 当前页号(1 基,与后端 pageNo 一致) */
  pageNo: { type: Number, default: 1 },
  /** 总页数 = ceil(total / pageSize) */
  pageCount: { type: Number, default: 1 },
  /** 本页首条 / 末条的全局序号(展示用) */
  from: { type: Number, default: 0 },
  to: { type: Number, default: 0 },
  /** 单据总张数 */
  total: { type: Number, default: 0 },
})
const emit = defineEmits(['go'])

const atFirst = computed(() => props.pageNo <= 1)
const atLast = computed(() => props.pageNo >= props.pageCount)
/** 目标页号夹到 [1, pageCount];同页不发事件(边界按钮点了无动作) */
function go(target) {
  const t = Math.min(Math.max(1, Math.round(target) || 1), Math.max(1, props.pageCount))
  if (t !== props.pageNo) emit('go', t)
}
</script>

<style scoped>
.drp {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--t-border-light, #edf1ef);
  background: var(--t-card-bg, #fff);
  flex: none;
}
.drp-btn {
  min-width: 18px;
  height: 18px;
  line-height: 16px;
  text-align: center;
  font-size: 10px;
  border: 1px solid #cfdced;
  border-radius: 4px;
  background: #fff;
  color: #44608a;
  cursor: pointer;
  user-select: none;
}
.drp-btn:hover { border-color: #b9c9dc; background: #f2f6fa; }
.drp-btn.off { color: #c3ccd6; border-color: #e4e9f0; cursor: default; background: #fbfcfe; }
.drp-no { font-size: 11px; color: var(--t-text-2, #5d6c67); white-space: nowrap; }
.drp-range { color: var(--t-text-3, #8b9893); }
</style>
