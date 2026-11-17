<!-- PurInSplitDialog.vue —— 采购入库单「一行明细拆成多个仓库存放」(2026-11-17 客户口径)

     用户原话:「采购入库单在草稿状态下要可以实现一个明细划分多个仓库来存放」+
               「但是来源采购订单行号和上游的行号不变」;数量口径「各仓库合计 = 该行实收数量」。

     为什么是"拆成多条行"而不是行内挂分配子表(用户拍板的那条路):
       库存台账/流水/库存状况表/转ERP 推金蝶**全是按行**取 仓库+数量 ⇒ 拆成多行,这条链一个字都不用改,
       也不会出现"行上一个仓库、分配表里另几个仓库"的两套账。
     真正拆行在服务端(`PurInSplitService`:复制行 + 按数量占比分摊金额 + 拆占用链,一个事务),
       本弹窗只负责收集分配清单并先把关(纯函数见 core/panel/purInSplit.js)。 -->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('拆分仓库') + (docNo ? ' · ' + docNo : '')"
    width="760px"
    top="6vh"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="onOpen"
  >
    <div class="pis">
      <div class="pis-head">
        <span class="pis-chip">{{ tt('存货') }}: <b>{{ line['存货编码'] || '—' }}</b> {{ line['存货名称'] || '' }}</span>
        <span class="pis-chip">{{ tt('实收数量') }}: <b>{{ total }}</b> {{ line['计量单位'] || '' }}</span>
        <span class="pis-chip">{{ tt('批次号') }}: {{ line['批次号'] || line['批号'] || '—' }}</span>
        <span class="pis-chip">{{ tt('采购订单行号') }}: {{ line['采购订单行号'] || line['源单行号'] || '—' }}</span>
      </div>
      <div class="pis-tip">{{ tt('拆成多行后：来源采购订单行号与批次号保持不变；各仓库数量合计必须等于实收数量') }}</div>

      <el-table :data="allocs" size="small" border>
        <el-table-column :label="tt('仓库')" min-width="200">
          <template #default="{ row: a }">
            <el-select v-model="a['仓库']" filterable clearable :placeholder="tt('选择仓库')"
                       style="width: 100%" @change="onWhChange(a)">
              <el-option v-for="w in whSrc.warehouses" :key="w.code || w.name" :label="w.name" :value="w.name" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column :label="tt('仓位')" min-width="160">
          <template #default="{ row: a }">
            <el-select v-model="a['仓位编码']" filterable clearable
                       :disabled="!a['仓库']"
                       :placeholder="a['仓库'] ? tt('选择仓位') : tt('先选仓库')"
                       style="width: 100%">
              <el-option v-for="b in binsOfWarehouse(whSrc.bins, a['仓库'])" :key="b.code" :label="b.code" :value="b.code" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column :label="tt('数量')" width="160">
          <template #default="{ row: a }">
            <el-input-number v-model="a['数量']" :min="0" :max="total" :controls="false" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column :label="tt('操作')" width="60" align="center">
          <template #default="{ $index }">
            <el-icon class="pis-del" :title="tt('删除')" @click="removeRow($index)"><Delete /></el-icon>
          </template>
        </el-table-column>
      </el-table>

      <div class="pis-foot">
        <el-button size="small" :icon="Plus" @click="addRow">{{ tt('增加一行') }}</el-button>
        <span class="pis-sum">
          {{ tt('已分配合计') }} <b>{{ sum }}</b> / {{ total }}
          · {{ tt('差额') }} <b :class="{ bad: diff !== 0 }">{{ diff }}</b>
        </span>
      </div>
      <div v-if="problemText" class="pis-problem">{{ problemText }}</div>
    </div>
    <template #footer>
      <el-button @click="close">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!canSubmit" :loading="saving" @click="confirm">{{ tt('确定拆分') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * 弹窗只做三件事:① 拉仓库/仓位档案 ② 收集分配清单并**先把关**(纯函数) ③ 提交给服务端拆行。
 * 校验口径全在 core/panel/purInSplit.js(有单测),这里不再写第二份判断。
 */
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { binsOfWarehouse, defaultBinOf, loadWhBinSources } from '@core/selection/genWhBin'
import {
  allocSum, canSplitRow, defaultAllocs, remainingQty, rowTotalQty, toPayload, validateAllocs,
} from '@core/panel/purInSplit'

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 采购入库单号(拆分作用在这张单上;服务端还会校验它是否草稿、是否已转ERP) */
  docNo: { type: String, default: '' },
  /** 要拆的那一行(bl_purchase_in 的一行,至少要有 id / 实收数量 / 仓库) */
  row: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const line = computed(() => props.row || {})
const total = computed(() => rowTotalQty(line.value))
const allocs = reactive([])
const whSrc = reactive({ warehouses: [], bins: [] })
const saving = ref(false)

const sum = computed(() => allocSum(allocs))
const diff = computed(() => remainingQty(allocs, total.value))
const check = computed(() => validateAllocs(allocs, total.value))
/** 能不能提交:行本身可拆(已落库、数量>0)+ 校验全过 + 不在提交中 */
const canSubmit = computed(() => canSplitRow(line.value) && check.value.ok && !saving.value)

/** 校验失败说明(取第一条问题的 code,配 tt 文案;行号从 1 开始) */
const problemText = computed(() => {
  const p = (check.value.problems || [])[0]
  if (!p) return ''
  const n = p.index >= 0 ? p.index + 1 : 0
  if (p.code === 'needTwo') return tt('至少要分到两个仓库')
  if (p.code === 'noWh') return tt('第 {n} 行没有选仓库').replace('{n}', String(n))
  if (p.code === 'qtyNotPositive') return tt('第 {n} 行数量必须大于 0').replace('{n}', String(n))
  if (p.code === 'sumMismatch') return tt('各仓库数量合计必须等于实收数量')
  return ''
})

async function onOpen() {
  // 每次打开都按当前行重置(同一弹窗会被不同行复用)
  allocs.splice(0, allocs.length, ...defaultAllocs(line.value))
  try {
    const src = await loadWhBinSources(engine)
    whSrc.warehouses = src.warehouses
    whSrc.bins = src.bins
  } catch (e) {
    // 档案取不到不算致命:仓库下拉为空时用户也能手输?不能 —— 直接给出提示,别让他白填
    ElMessage.warning(tt('仓库档案读取失败，请刷新后重试'))
  }
}

/** 换仓库:已选仓位不在新仓里就清掉,空则按该仓默认仓位预填(与生单弹窗同一口径) */
function onWhChange(a) {
  const list = binsOfWarehouse(whSrc.bins, a['仓库'])
  if (a['仓位编码'] && !list.some((b) => b.code === a['仓位编码'])) a['仓位编码'] = ''
  if (!a['仓位编码']) a['仓位编码'] = defaultBinOf(whSrc.bins, a['仓库'])
}

/** 加一行:数量默认 = 剩余未分量(常见操作"剩下的给这个仓"),没有剩余就 0 */
function addRow() {
  allocs.push({ 仓库: '', 仓位编码: '', 数量: Math.max(0, diff.value) })
}

function removeRow(index) {
  if (allocs.length <= 2) {
    ElMessage.warning(tt('至少要分到两个仓库'))
    return
  }
  allocs.splice(index, 1)
}

function close() {
  emit('update:modelValue', false)
}

async function confirm() {
  if (!canSubmit.value) return
  saving.value = true
  try {
    const res = await engine.splitPurInLine({
      docNo: props.docNo,
      lineId: Number(line.value.id),
      allocs: toPayload(allocs),
    })
    const rows = res?.rows || allocs.length
    ElMessage.success(tt('拆分成功，已拆成 {n} 行').replace('{n}', String(rows)))
    emit('saved', res)
    close()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('拆分失败'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.pis { display: flex; flex-direction: column; gap: 10px; }
.pis-head { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12.5px; color: #46586e; }
.pis-chip { background: #f2f6fa; border: 1px solid #e1e8f0; border-radius: 4px; padding: 2px 8px; }
.pis-tip { font-size: 12px; color: #8b9893; }
.pis-foot { display: flex; align-items: center; gap: 12px; }
.pis-sum { font-size: 12.5px; color: #46586e; }
.pis-sum b { color: #1e6fb8; }
.pis-sum b.bad { color: #c84d3f; }
.pis-problem { font-size: 12px; color: #c84d3f; }
.pis-del { cursor: pointer; color: #c84d3f; }
</style>
