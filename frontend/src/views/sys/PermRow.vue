<!-- PermRow.vue — 权限矩阵单行(面板 × 操作列勾选框)
独立子组件:行内权限(permsSet)变更只重渲染本行(12 格),拖动框选大量改格时
避免父级 OrgAdmin(含部门树/用户表/角色表/744 格)整体重渲染造成卡顿。 -->
<template>
  <tr>
    <td class="pt-panel">{{ tt(row.panelName) }}</td>
    <td
      v-for="act in acts"
      :key="act[0]"
      class="pt-act"
      :data-panel="row.panelCode"
      :data-col="act[0]"
      @pointerdown="$emit('paintDown', row, act[0], $event)"
    >
      <el-checkbox :model-value="has(act[0])" />
    </td>
    <td
      class="pt-all"
      :data-panel="row.panelCode"
      :data-col="ALL_COL"
      @pointerdown="$emit('paintDown', row, ALL_COL, $event)"
    >
      <el-checkbox :model-value="isAll" />
    </td>
  </tr>
</template>

<script setup>
import { computed } from 'vue'
import { tt } from '@/i18n'

const props = defineProps({
  row: { type: Object, required: true }, // { panelCode, panelName, permsSet }
  acts: { type: Array, required: true }, // [['view','可见'],...]
})
defineEmits(['paintDown'])

// 与 OrgAdmin 框选逻辑的「全选」列标识保持一致
const ALL_COL = '__all__'
function has(code) {
  return props.row.permsSet ? props.row.permsSet.has(code) : false
}
const isAll = computed(() => props.acts.length > 0 && props.acts.every((a) => has(a[0])))
</script>

<style scoped>
.perm-table td {
  border: 1px solid #e8ecf1;
  padding: 4px 6px;
  text-align: center;
  white-space: nowrap;
}
.perm-table .pt-panel {
  text-align: left;
  min-width: 100px;
  font-weight: 500;
}
.perm-table .pt-act { min-width: 48px; }
.perm-table .pt-all {
  min-width: 40px;
  background: #fafbfc;
  font-weight: 600;
}
.perm-table tbody tr:hover { background: #f8f9fb; }
/* 勾选框纯展示,指针事件交给单元格(框选按下/拖动由父级统一处理) */
.perm-table :deep(.el-checkbox) { pointer-events: none; height: auto; }
.perm-box.painting .perm-table td { cursor: pointer; }
</style>
