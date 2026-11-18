<!--
  PickKindDialog.vue — 领料/退料「扫工单码时选择打开哪一张单」(2026-11-18 新增)

  【用户口径】
  「如果领料退料扫的是工单码,就要弹窗选择是混料还是组装。如果是领料单上的二维码就直接跳转」

  ⇒ 一个工单行会出**两张**单(组装领料 / 混料领料),工单码本身分不出要哪张 —— 弹这个框让人点;
     而领料单纸面二维码第 4 段带了标记(`@A`/`@M`),调用方自己就能定位,**不会**弹框。

  只用最朴素的大按钮列表:现场戴手套/光线差,行高 64px 起,一屏放得下两张。
-->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('选择要打开的单据')"
    width="92%"
    append-to-body
    align-center
    class="pk-dlg"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <div class="pk-hint">{{ tt('这张工单开了两张领料单；扫领料单上的二维码可直接打开对应那张') }}</div>
    <div class="pk-list">
      <button
        v-for="d in docs"
        :key="d.id"
        type="button"
        class="pk-item"
        :class="d.领料类型 === '混料' ? 'is-mix' : 'is-asm'"
        @click="pick(d)"
      >
        <span class="pk-tag">{{ tt(d.领料类型 || '组装') }}</span>
        <span class="pk-main">
          <span class="pk-no mono">{{ d.领料单号 || '—' }}</span>
          <span class="pk-meta">
            {{ d.工单号 || '' }}<i v-if="d.工单行号"> #{{ d.工单行号 }}</i>
            <template v-if="d.状态"> · {{ tt(d.状态) }}</template>
            <template v-if="d.物料项数"> · {{ tt('物料项数') }} {{ d.物料项数 }}</template>
          </span>
        </span>
        <span class="pk-open">{{ tt('打开') }}</span>
      </button>
    </div>
    <div class="pk-empty" v-if="!docs.length">{{ tt('没有可打开的单据') }}</div>
  </el-dialog>
</template>

<script setup>
import { tt } from '@/i18n'

defineProps({
  /** v-model:是否显示 */
  modelValue: { type: Boolean, default: false },
  /** 候选单据(locate 接口的 单据[] :id/领料单号/领料类型/工单号/工单行号/状态/物料项数) */
  docs: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'pick'])

function pick(d) {
  emit('pick', d)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.pk-hint { font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.6; margin-bottom: 10px; }
.pk-list { display: flex; flex-direction: column; gap: 10px; }
.pk-item {
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 64px;
  padding: 10px 12px; text-align: left; cursor: pointer;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color); border-radius: 10px;
}
.pk-item:active { background: var(--el-fill-color-light); }
.pk-item.is-mix { border-left: 4px solid var(--el-color-warning); }
.pk-item.is-asm { border-left: 4px solid var(--el-color-primary); }
.pk-tag {
  flex: none; padding: 2px 8px; border-radius: 6px; font-size: 12px;
  background: var(--el-fill-color); color: var(--el-text-color-primary);
}
.pk-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pk-no { font-size: 15px; font-weight: 600; }
.pk-meta { font-size: 12px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pk-open { flex: none; font-size: 13px; color: var(--el-color-primary); }
.pk-empty { padding: 12px; font-size: 13px; color: var(--el-text-color-secondary); text-align: center; }
.mono { font-variant-numeric: tabular-nums; }
</style>
