<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('仓位分区')"
    width="740px"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <div class="zpd">
      <div class="zpd-tip">
        {{ tt('分区跟随仓位存在：候选自动来自仓位的实际数据，不需要单独登记；仓位没了，分区就没了。') }}
      </div>
      <div class="zpd-tip zpd-tip2">
        {{ tt('选择时会同时填入「大区」和「存储分区」（它们是一个组合）') }}
      </div>

      <!-- 新增:直接填一对新值 → 一起写进当前行;保存后它自然进入候选(候选就是数据) -->
      <div class="zpd-add">
        <span class="zpd-lb">{{ tt('大区') }}</span>
        <el-input v-model="newArea" size="small" clearable style="width: 170px" @keyup.enter="fillNew" />
        <span class="zpd-lb">{{ tt('存储分区') }}</span>
        <el-input v-model="newZone" size="small" clearable style="width: 170px" @keyup.enter="fillNew" />
        <el-button size="small" type="primary" :disabled="!canFillNew" @click="fillNew">{{ tt('填入本格') }}</el-button>
      </div>
      <div class="zpd-hint">
        {{ tt('填一个新名字即可新增分区（保存后进入候选）') }}
      </div>

      <el-table :data="combos" size="small" border height="330" highlight-current-row>
        <el-table-column :label="tt('大区')" min-width="150">
          <template #default="{ row }">{{ row[areaKey] || tt('(不分区)') }}</template>
        </el-table-column>
        <el-table-column :label="tt('存储分区')" min-width="150">
          <template #default="{ row }">{{ row[zoneKey] || tt('(不细分)') }}</template>
        </el-table-column>
        <el-table-column :label="tt('仓位数')" width="90" align="right" prop="数量" />
        <el-table-column :label="tt('操作')" width="170">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="pickRow(row)">{{ tt('填入') }}</el-button>
            <el-button link type="danger" size="small" @click="askRemove(row)">{{ tt('删除') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer>
      <el-button @click="emit('pick', { [areaKey]: '', [zoneKey]: '' })">{{ tt('清空本格') }}</el-button>
      <el-button type="primary" @click="emit('update:modelValue', false)">{{ tt('关闭') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * 仓位分区弹窗(2026-10-08,方案 A 修正版)。
 *
 * 口径(用户原话):「如果存在这个分区是因为我有这个仓位数据,但是我没有这个仓位是不是就没有这个分区了,
 *   增加提示即可,让当前的这个分区的仓位存在时就无法删除这个分区,当这个分区的仓位删除完后就会提示
 *   当前的分区也一起没了。」
 * 回填口径(2026-10-08 追加):「让当前大区和存储分区被选择的时候**一起填入**」
 *   —— 「大区 + 存储分区」是一个组合,选中一行/填入一对新值,**两列一起写**,不留半拉状态。
 *
 * 因此:**分区是仓位数据的派生,不落任何存储** ——
 *   · 候选 = 本面板已加载的仓位行里 (大区, 存储分区) 的去重并集 + 每组的仓位数(纯内存计算);
 *   · 「填入」(行内或新增框)= 把**整对**值写进当前行(保存后才落库,落库后自然进候选);
 *   · 「删除」= 带保护的指引:还有仓位时**明确拒绝**并说明该怎么做;仓位清零后分区自动消失。
 * 好处:零新表、零新面板、零 DDL、零后端接口,**且任何操作都不会触碰仓位数据**。
 */
import { ref, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 本面板已加载的全部仓位行(档案面板全量驻内存;由调用方传 archRows(b)) */
  rows: { type: Array, default: () => [] },
  /** 组合里两列的列名(「分区选择」型固定是这两列,由调用方传入以免两处硬编码) */
  areaKey: { type: String, default: '大区' },
  zoneKey: { type: String, default: '存储分区' },
})
const emit = defineEmits(['update:modelValue', 'pick'])

const newArea = ref('')
const newZone = ref('')

/** 候选 = 现有仓位行的 (大区, 存储分区) 去重 + 计数;排序后大区在前 */
const combos = computed(() => {
  const map = new Map()
  for (const r of props.rows || []) {
    if (!r || r._placeholder) continue
    const a = String(r[props.areaKey] ?? '').trim()
    const z = String(r[props.zoneKey] ?? '').trim()
    if (!a && !z) continue
    const key = a + '\u0001' + z
    const hit = map.get(key)
    if (hit) hit.数量 += 1
    else map.set(key, { [props.areaKey]: a, [props.zoneKey]: z, 数量: 1 })
  }
  return [...map.values()].sort((x, y) => (x[props.areaKey] || '').localeCompare(y[props.areaKey] || '', 'zh')
    || (x[props.zoneKey] || '').localeCompare(y[props.zoneKey] || '', 'zh'))
})

/** 新增:至少要填一个;整对一起回填 */
const canFillNew = computed(() => !!(newArea.value.trim() || newZone.value.trim()))
function fillNew() {
  if (!canFillNew.value) return
  emit('pick', { [props.areaKey]: newArea.value.trim(), [props.zoneKey]: newZone.value.trim() })
}
function pickRow(row) {
  emit('pick', { [props.areaKey]: row[props.areaKey] || '', [props.zoneKey]: row[props.zoneKey] || '' })
}

/** 删除 = 带保护的指引(不触碰仓位数据) */
function askRemove(row) {
  const name = row[props.zoneKey] || row[props.areaKey] || tt('(不细分)')
  const n = row.数量
  if (n > 0) {
    ElMessageBox.alert(
      `${n} ${tt('个仓位仍在使用该分区，无法删除。分区跟随仓位存在：请先把这些仓位改到别的分区或删除它们；当最后一个仓位离开后，本分区会自动从候选里消失。')}`,
      `${tt('无法删除')}：${name}`,
      { confirmButtonText: tt('知道了'), type: 'warning' },
    ).catch(() => {})
    return
  }
  // 数量为 0 的组合本来就不会出现在列表里(候选=数据);保底给同样的说明
  ElMessageBox.alert(tt('该分区已没有仓位，它已经随仓位一起从候选里消失了。'), tt('分区已消失'), { confirmButtonText: tt('知道了') }).catch(() => {})
}
</script>

<style scoped>
.zpd-tip {
  font-size: 12px;
  color: var(--t-text-3);
  line-height: 1.6;
  margin-bottom: 6px;
  padding: 6px 10px;
  background: var(--t-bg-2, #f7f8fa);
  border-radius: 4px;
}
.zpd-tip2 {
  color: #b26a00;
  background: #fff7e6;
}
.zpd-add {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.zpd-lb {
  font-size: 13px;
  color: var(--t-text-2);
}
.zpd-hint {
  font-size: 12px;
  color: var(--t-text-3);
  margin: 6px 0 10px;
}
</style>
