<!-- ProcessQueue.vue — 工序任务(路线驱动,A 项,2026-10-05)
     一道工序一份待加工队列:按 急单 → 计划完工日 → 排序号 排队;勾选可派工到产线、可标急单/排序。
     数据源 /px/processTask/queue(载体 = wo_progress,由转工单按工艺路线生成;报工审核回写完成量)。 -->
<template>
  <div class="pq-page">
    <div class="pq-bar">
      <span class="pq-lb">{{ tt('工序/工艺') }}</span>
      <el-select v-model="f.工序" clearable filterable style="width: 130px" :placeholder="tt('全部')" @change="load">
        <el-option v-for="o in meta.工序" :key="o" :label="tt(o)" :value="o" />
      </el-select>
      <span class="pq-lb">{{ tt('状态') }}</span>
      <el-select v-model="f.状态" clearable style="width: 120px" :placeholder="tt('全部')" @change="load">
        <el-option v-for="s in meta.状态" :key="s" :label="tt(s)" :value="s" />
      </el-select>
      <span class="pq-lb">{{ tt('生产线') }}</span>
      <el-select v-model="f.生产线" clearable filterable style="width: 150px" :placeholder="tt('全部')" @change="load">
        <el-option v-for="l in meta.产线" :key="l" :label="l" :value="l" />
      </el-select>
      <span class="pq-lb">{{ tt('关键字') }}</span>
      <el-input v-model="f.keyword" clearable style="width: 180px" :placeholder="tt('工单号/产品/客户')" @keyup.enter="load" />
      <el-button type="primary" size="small" @click="load">{{ tt('查询') }}</el-button>

      <span class="pq-actions">
        <el-button size="small" type="warning" plain :disabled="!checked.length" @click="openAssign">
          {{ tt('派工到产线') }}（{{ checked.length }}）
        </el-button>
        <el-button size="small" plain :disabled="!checked.length" @click="doPriority('急单')">{{ tt('标急单') }}</el-button>
        <el-button size="small" plain :disabled="!checked.length" @click="doPriority('普通')">{{ tt('取消急单') }}</el-button>
        <span class="pq-cnt">{{ tt('共') }} {{ rows.length }} {{ tt('条') }} ｜ {{ tt('未完成') }} {{ num(sumLeft) }}</span>
      </span>
    </div>

    <el-table :data="rows" size="small" border height="100%" empty-text="" row-key="任务id" @selection-change="(r) => (checked = r)">
      <el-table-column type="selection" width="42" />
      <el-table-column :label="tt('工序')" prop="工序" width="90" sortable>
        <template #default="{ row }">{{ tt(row.工序) }}</template>
      </el-table-column>
      <el-table-column :label="tt('序')" prop="工序序" width="55" align="right" sortable />
      <el-table-column :label="tt('优先级')" width="85">
        <template #default="{ row }">
          <span :class="{ 'pq-urgent': row.优先级 === '急单' }">{{ tt(row.优先级) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('工单号')" prop="工单号" width="150" sortable show-overflow-tooltip />
      <el-table-column :label="tt('工单行号')" prop="工单行号" width="85" align="right" />
      <el-table-column :label="tt('批次号')" prop="批次号" width="100" />
      <el-table-column :label="tt('产品编码')" prop="产品编码" width="110" show-overflow-tooltip />
      <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="150" show-overflow-tooltip />
      <el-table-column :label="tt('规格型号')" prop="规格型号" width="120" show-overflow-tooltip />
      <el-table-column :label="tt('客户')" prop="客户代码" width="100" show-overflow-tooltip />
      <el-table-column :label="tt('计划数量')" prop="计划数量" width="95" align="right" />
      <el-table-column :label="tt('完成数量')" prop="完成数量" width="95" align="right" />
      <el-table-column :label="tt('未完成')" prop="未完成量" width="90" align="right" />
      <el-table-column :label="tt('计划完工日期')" prop="计划完工日期" width="115" sortable />
      <el-table-column :label="tt('状态')" prop="状态" width="90" fixed="right">
        <template #default="{ row }">
          <el-tag size="small" :type="row.状态 === '已完工' ? 'success' : (row.状态 === '在加工' ? 'warning' : 'info')">{{ tt(row.状态) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="tt('生产线')" prop="生产线" width="110" fixed="right">
        <template #default="{ row }">{{ row.生产线 || '-' }}</template>
      </el-table-column>
    </el-table>

    <!-- 派工弹窗:目标产线(按工序/工艺收敛:该工序 = 该功能,只列本功能的线) -->
    <el-dialog v-model="asVisible" :title="tt('派工到产线')" width="380px" append-to-body>
      <div class="pq-p">{{ tt('目标生产线') }}
        <el-select v-model="asLine" filterable style="width: 210px">
          <el-option v-for="l in assignLines" :key="l" :label="l" :value="l" />
        </el-select>
      </div>
      <div class="pq-tip">{{ tt('只列本工序功能下的产线(工序/工艺 = 成型/切炭/组装)') }}</div>
      <template #footer>
        <el-button @click="asVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="doAssign">{{ tt('确认派工') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'

const f = reactive({ 工序: '', 状态: '待加工', 生产线: '', keyword: '' })
const rows = ref([])
const checked = ref([])
const meta = ref({ 工序: [], 状态: [], 产线: [] })
const asVisible = ref(false)
const asLine = ref('')

const num = (v) => { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
const sumLeft = computed(() => rows.value.reduce((a, r) => a + Number(r.未完成量 || 0), 0))
/** 派工候选线:该工序对应的功能(生产车间)= 该工序名,取本功能下的启用线 */
const assignLines = computed(() => {
  const op = f.工序 || (checked.value[0] && checked.value[0].工序)
  const shop = checked.value[0]?.生产车间 || op
  return meta.value.产线.filter((l) => !shop || lineShop(l) === shop)
})
const lineShops = ref({})
function lineShop(l) { return lineShops.value[l] || '' }

async function loadMeta() {
  try {
    const res = await request.post('/px/processTask/meta', {})
    meta.value = res.data || {}
    const lines = await request.post('/px/scheduleBoard/linesSummary', {})
    const m = {}
    for (const x of (lines.data || [])) m[x.生产线] = x.生产车间
    lineShops.value = m
  } catch { /* 不阻断 */ }
}

async function load() {
  try {
    const res = await request.post('/px/processTask/queue', { ...f })
    rows.value = res.data || []
    checked.value = []
  } catch (e) { ElMessage.error(e?.response?.data?.message || tt('查询失败')) }
}

function openAssign() {
  asLine.value = ''
  asVisible.value = true
}

async function doAssign() {
  if (!asLine.value) { ElMessage.warning(tt('请选择目标生产线')); return }
  try {
    const res = await request.post('/px/processTask/assign', { ids: checked.value.map((r) => r.任务id), 生产线: asLine.value })
    const d = res.data || {}
    const failed = d['失败行'] || []
    ElMessage.success(`${tt('已派工')} ${d['派工行数']} ${tt('条')} → ${d['生产线']}` + (failed.length ? `（${tt('跳过')} ${failed.length}）` : ''))
    asVisible.value = false
    load()
  } catch (e) { ElMessage.error(e?.response?.data?.message || tt('派工失败')) }
}

async function doPriority(p) {
  try {
    await ElMessageBox.confirm(`${tt('将选中的')} ${checked.value.length} ${tt('条任务标为')} ${tt(p)}？`, tt('优先级'),
      { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.post('/px/processTask/prioritize', { ids: checked.value.map((r) => r.任务id), 优先级: p })
    ElMessage.success(`${tt('已更新')} ${(res.data || {})['更新行数']} ${tt('条')}`)
    load()
  } catch (e) { ElMessage.error(e?.response?.data?.message || tt('更新失败')) }
}

onMounted(() => { loadMeta(); load() })
</script>

<style scoped>
.pq-page { padding: 8px 12px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #fff; }
.pq-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 0; border-bottom: 1px solid #eee; }
.pq-lb { font-size: 13px; color: #606266; }
.pq-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.pq-cnt { font-size: 12px; color: #116a5b; font-weight: 600; }
.pq-urgent { color: #f56c6c; font-weight: 700; }
.pq-p { padding: 6px 0; }
.pq-tip { color: #909399; font-size: 12px; }
</style>
