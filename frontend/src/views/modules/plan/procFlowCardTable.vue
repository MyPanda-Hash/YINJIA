<!--
  procFlowCardTable.vue — 流程卡列表(2026-10-29,工序流程追踪卡)

  列 = 契约 §3.7「行」结构(卡号/大批次/小批次/工单号/行号/产品/规格/计划数量/生产线/
  卡状态/工序进度/完成工序数(工序数)/照片数/创建人/更新时间)。

  【为什么单独抽出来】页签②「卡片列表」(分页查询)与页签③「批次追溯」(该批次下的卡片)
  是**同一张表**,只是数据源/分页/点击行为不同 ⇒ 表头写两遍必然漂移(规范 D1)。
  行点击由父级决定(② 开详情抽屉、③ 开追溯抽屉)。
-->
<template>
  <el-table
    :data="rows"
    size="small"
    border
    highlight-current-row
    v-loading="loading"
    :empty-text="tt('暂无数据')"
    max-height="60vh"
    class="pftt"
    @row-click="(r) => $emit('row-click', r)"
  >
    <el-table-column :label="tt('卡号')" prop="卡号" min-width="140" show-overflow-tooltip fixed="left">
      <template #default="{ row }">
        <el-link type="primary" underline="never">{{ row.卡号 }}</el-link>
      </template>
    </el-table-column>
    <el-table-column :label="tt('小批次号')" prop="小批次号" width="118" show-overflow-tooltip />
    <el-table-column :label="tt('大批次号')" prop="大批次号" width="100" show-overflow-tooltip />
    <el-table-column :label="tt('工单号')" prop="工单号" min-width="132" show-overflow-tooltip />
    <el-table-column :label="tt('行号')" prop="工单行号" width="62" align="right" />
    <el-table-column :label="tt('产品编码')" prop="产品编码" min-width="104" show-overflow-tooltip />
    <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="150" show-overflow-tooltip />
    <el-table-column :label="tt('规格型号')" prop="规格型号" min-width="124" show-overflow-tooltip />
    <el-table-column :label="tt('计划数量')" width="90" align="right">
      <template #default="{ row }">{{ fmtNum(row.计划数量) }}</template>
    </el-table-column>
    <el-table-column :label="tt('生产线')" prop="生产线" width="108" show-overflow-tooltip />
    <el-table-column :label="tt('卡状态')" width="86">
      <template #default="{ row }">
        <el-tag size="small" :type="cardStatusType(row.卡状态)">{{ tt(row.卡状态 || '-') }}</el-tag>
      </template>
    </el-table-column>
    <!-- 工序进度是后端拼好的业务串(「成型 3078/3078 ✓；切炭 0/3078」),属于事实数据,原样显示不翻译 -->
    <el-table-column :label="tt('工序进度')" min-width="220" show-overflow-tooltip>
      <template #default="{ row }">{{ row.工序进度 || '-' }}</template>
    </el-table-column>
    <el-table-column :label="tt('完成工序数')" width="96" align="right">
      <template #default="{ row }">{{ row.完成工序数 ?? '-' }} / {{ row.工序数 ?? '-' }}</template>
    </el-table-column>
    <el-table-column :label="tt('照片')" prop="照片数" width="62" align="right" />
    <el-table-column :label="tt('创建人')" prop="创建人" width="90" show-overflow-tooltip />
    <el-table-column :label="tt('更新时间')" width="150">
      <template #default="{ row }">{{ rmtTime(row.更新时间) }}</template>
    </el-table-column>
  </el-table>
</template>

<script setup>
import { tt } from '@/i18n'
import { cardStatusType, fmtNum, rmtTime } from './procFlowCardApi'

defineProps({
  /** 契约 §3.7 的「行」数组 */
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
defineEmits(['row-click'])
</script>

<style scoped>
.pftt { width: 100%; }
</style>
