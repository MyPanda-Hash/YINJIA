<!-- QcInspItemPickDialog.vue — 选检验项目(2026-10-09,用户口径:「使用当前的检验单模板实现填写,
     然后在当前页面可以看到对应的检验项目,然后选择填写检验单的数据」)

     作用:在**组装成品检验单(及成型/切炭检验单)页面**打开,列出维护好的检验方案下的检验项目,
     勾选后**带入当前单据明细**(表区=检验项目:检验项目/标准要求/检验方法),再按现有模板逐行填
     实测数值/判定 —— 不自动保存,也不改动库里任何数据(保存仍由用户点「保存」)。

     与 QcInspPlanDialog 的分工:
       · QcInspPlanDialog  = 维护**标准**(方案/项目本身)
       · 本组件            = 把标准**选用**到当前这张单上(手动、可勾选、可复选)
     可撤回:删本组件 + PanelxList 的挂载/action 分支 + PanelConfigService 的按钮注入。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('选检验项目')" width="980px" top="6vh" append-to-body
             destroy-on-close @update:model-value="(v) => emit('update:modelValue', v)" @open="load">
    <div class="qcpick-tip">
      {{ tt('从维护好的检验标准里勾选，带入当前单据明细（表区=检验项目）；带入后按现有模板填写实测数值与判定，保存仍要点「保存」。') }}
    </div>

    <div class="qcpick-bar">
      <span class="qcpick-lb">{{ tt('检验方案') }}</span>
      <el-select v-model="planCode" size="small" filterable style="width: 320px" @change="onPlanChange">
        <el-option v-for="p in plans" :key="p['方案编码']" :value="p['方案编码']"
                   :label="`${p['方案名称']}${p['适用存货'] ? '（' + p['适用存货'] + '）' : ''}`" />
      </el-select>
      <span class="qcpick-sub">{{ tt('方案下的检验项目') }}：{{ items.length }}</span>
      <span class="qcpick-gap" />
      <el-input v-model="kw" size="small" clearable style="width: 180px" :placeholder="tt('筛选项目')" />
      <el-button size="small" @click="selectAll">{{ tt('全选') }}</el-button>
      <el-button size="small" @click="clearAll">{{ tt('清空') }}</el-button>
    </div>

    <el-table ref="tableRef" :data="filtered" size="small" border height="380" row-key="id"
              :empty-text="tt('该方案下没有可选的检验项目')" @selection-change="(r) => (picked = r)">
      <el-table-column type="selection" width="42" reserve-selection />
      <el-table-column :label="tt('序号')" prop="序号" width="60" />
      <el-table-column :label="tt('项目编码')" prop="项目编码" width="140" show-overflow-tooltip />
      <el-table-column :label="tt('项目名称')" prop="项目名称" width="170" show-overflow-tooltip />
      <el-table-column :label="tt('检验内容')" prop="检验内容" width="100" show-overflow-tooltip />
      <el-table-column :label="tt('检验标准')" prop="检验标准" min-width="180" show-overflow-tooltip />
      <el-table-column :label="tt('计量单位')" prop="计量单位" width="80" />
      <el-table-column :label="tt('取样要求')" prop="取样要求" width="110" show-overflow-tooltip />
      <el-table-column :label="tt('检验方法')" prop="检验方法" min-width="200" show-overflow-tooltip />
    </el-table>

    <template #footer>
      <span class="qcpick-count">{{ tt('已选') }} {{ picked.length }} {{ tt('项') }}</span>
      <el-button size="small" @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button size="small" type="primary" :disabled="!picked.length" @click="confirm">{{ tt('带入明细') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 当前单据的产品编码/名称:用来**预选**匹配的检验方案(仍由用户确认,不自动带入) */
  productCode: { type: String, default: '' },
  productName: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'pick'])

const plans = ref([])
const planCode = ref('')
const items = ref([])
const picked = ref([])
const kw = ref('')
const tableRef = ref(null)

const filtered = computed(() => {
  const k = kw.value.trim()
  if (!k) return items.value
  return items.value.filter((r) => `${r['项目编码']}${r['项目名称']}${r['检验内容']}${r['检验标准']}`.includes(k))
})

async function load() {
  kw.value = ''
  picked.value = []
  try {
    const r = await request.get('/qc/inspPlan/plans', { params: { all: '' } })
    plans.value = r.data || []
    // 预选:适用存货命中当前产品(编码或名称)的方案;没命中就取第一个
    const hit = plans.value.find((p) => {
      const s = String(p['适用存货'] || '').trim()
      return s && (s === props.productCode || s === props.productName)
    })
    planCode.value = (hit || plans.value[0])?.['方案编码'] || ''
    await loadItems()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('加载检验方案失败'))
  }
}

async function loadItems() {
  items.value = []
  picked.value = []
  tableRef.value?.clearSelection?.()
  if (!planCode.value) return
  try {
    const r = await request.get('/qc/inspPlan/items', { params: { planCode: planCode.value, all: '' } })
    items.value = r.data || []
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('加载检验项目失败'))
  }
}

function onPlanChange() { loadItems() }
function selectAll() { (filtered.value || []).forEach((r) => tableRef.value?.toggleRowSelection(r, true)) }
function clearAll() { tableRef.value?.clearSelection?.(); picked.value = [] }

function confirm() {
  if (!picked.value.length) return
  emit('pick', picked.value.slice())
  emit('update:modelValue', false)
}
</script>

<style scoped>
.qcpick-tip { font-size: 12px; color: #909399; background: #f4f4f5; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; }
.qcpick-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.qcpick-lb { font-size: 13px; color: #303133; }
.qcpick-sub { font-size: 12px; color: #909399; }
.qcpick-gap { flex: 1; }
.qcpick-count { float: left; font-size: 12px; color: #909399; line-height: 32px; }
</style>
