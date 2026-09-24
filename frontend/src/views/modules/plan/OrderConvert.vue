<!-- OrderConvert.vue — 订单结转·发单工作台(《订单结转实现方案-V1.0》2026-09-22)
     定位:发单调度台——判断+生成单据+跳转;生成的加工单/采购申请是标准面板单据,后续按面板↔面板流转。
     防重复:行级占用链(剩余=需求−已排产−已采购),转满自动消失,删下游草稿自动回现;不改销售订单状态。 -->
<template>
  <div class="oc-page">
    <!-- 汇总条(蓝底白字,同参考) -->
    <div class="oc-summary">
      <span>{{ tt('未结转订单汇总') }}（{{ tt('总订单笔数') }}: {{ s.未结转?.总订单笔数 ?? 0 }}　{{ tt('总款数') }}: {{ s.未结转?.总款数 ?? 0 }}　{{ tt('总下单数量') }}: {{ s.未结转?.总下单数量 ?? 0 }}）</span>
      <span class="oc-sep">；</span>
      <span>{{ tt('今日结转订单汇总') }}（{{ tt('总订单笔数') }}: {{ s.今日结转?.总订单笔数 ?? 0 }}　{{ tt('总款数') }}: {{ s.今日结转?.总款数 ?? 0 }}　{{ tt('总下单数量') }}: {{ s.今日结转?.总下单数量 ?? 0 }}）</span>
      <span class="oc-sep">；</span>
      <span>{{ tt('当前数据') }}（{{ s.当前数据笔数 ?? 0 }}）{{ tt('笔') }}</span>
    </div>

    <!-- 工具栏 -->
    <el-form inline class="oc-bar" @submit.prevent>
      <el-form-item :label="tt('查询条件')">
        <el-input v-model="keyword" :placeholder="tt('订单号 / 客户 / 物料')" clearable style="width: 260px" @keyup.enter="loadAll" />
      </el-form-item>
      <el-button type="primary" @click="loadAll">{{ tt('查询') }}</el-button>
      <el-button :loading="loading" @click="loadAll">{{ tt('刷新') }}</el-button>
      <el-button type="danger" plain :disabled="!dateChanged.length" @click="saveDates">
        {{ tt('保存交期') }}（{{ dateChanged.length }}）
      </el-button>
      <el-button type="success" :disabled="!checked.length" @click="toManu">{{ tt('转工单') }}（{{ checked.length }}）</el-button>
      <el-button type="warning" :disabled="!checked.length" @click="toPurchase">{{ tt('转采购单') }}（{{ checked.length }}）</el-button>
    </el-form>

    <!-- 待结转表 -->
    <el-table ref="tableRef" :data="rows" size="small" border height="calc(100% - 120px)" empty-text="" row-key="rowKey"
              @selection-change="onCheck">
      <el-table-column type="selection" width="42" reserve-selection />
      <el-table-column :label="tt('订单资料')" width="240" fixed>
        <template #default="{ row }">
          <div class="oc-strong">{{ row.订单号 }}</div>
          <div class="oc-dim">{{ row.物料编码 }}</div>
          <div class="oc-dim">{{ row.品名 }}</div>
        </template>
      </el-table-column>
      <el-table-column :label="tt('下单日期')" prop="下单日期" width="100" />
      <el-table-column :label="tt('交货日期')" width="150" fixed="left">
        <template #default="{ row }">
          <el-date-picker v-model="row.交货日期" type="date" value-format="YYYY-MM-DD" size="small"
                          style="width: 130px" :class="{ 'oc-date-dirty': row.交货日期 !== row.交货日期原始 }"
                          :title="tt('同步交期常与创建日期雷同，可在此修正；保存交期或转单时回写订单行')" />
        </template>
      </el-table-column>
      <el-table-column :label="tt('客户')" prop="客户" min-width="160" show-overflow-tooltip />
      <el-table-column :label="tt('客户等级')" prop="客户等级" width="90" />
      <el-table-column :label="tt('型号')" prop="型号" width="120" show-overflow-tooltip />
      <el-table-column :label="tt('重点管控')" prop="重点管控" width="90" />
      <el-table-column :label="tt('客户订单号')" prop="客户订单号" width="120" show-overflow-tooltip />
      <el-table-column :label="tt('需求数量')" prop="需求数量" width="100" align="right" />
      <el-table-column :label="tt('已排产数量')" width="105" align="right">
        <template #default="{ row }">
          <span :class="{ 'oc-blue': Number(row.已排产数量) > 0 }">{{ row.已排产数量 }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('已采购数量')" width="105" align="right">
        <template #default="{ row }">
          <span :class="{ 'oc-orange': Number(row.已采购数量) > 0 }">{{ row.已采购数量 }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('剩余数量')" width="100" align="right" fixed="right">
        <template #default="{ row }">
          <span class="oc-strong">{{ row.剩余数量 }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('本次转单数量')" width="125" fixed="right">
        <template #default="{ row }">
          <el-input-number v-model="row.生单数量" :min="0" :max="Number(row.剩余数量)" :controls="false" size="small" style="width: 100%" />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'

const keyword = ref('')
const loading = ref(false)
const rows = ref([])
const checked = ref([])
const tableRef = ref(null)
const s = ref({})

/** 行内修改过交期(与原始值比对)的行 */
const dateChanged = computed(() => rows.value.filter((r) => r.交货日期 && r.交货日期 !== r.交货日期原始))

async function loadPending() {
  loading.value = true
  try {
    const res = await request.post('/px/orderConvert/pending', { keyword: keyword.value })
    rows.value = (res.data || []).map((r) => ({
      ...r,
      交货日期: r.交货日期 || '',
      交货日期原始: r.交货日期 || '',
      生单数量: Number(r.剩余数量) || 0,
      rowKey: `${r.订单号}#${r['行id']}`,
    }))
    checked.value = []
    tableRef.value?.clearSelection?.()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('查询失败'))
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await request.post('/px/orderConvert/stats', {})
    s.value = res.data || {}
  } catch { /* 汇总失败不阻断列表 */ }
}

function loadAll() { loadPending(); loadStats() }
function onCheck(r) { checked.value = r }

/** 保存交期:把行内修正的预计交货日期回写销售订单行 */
async function saveDates() {
  const list = dateChanged.value
  if (!list.length) return
  try {
    const res = await request.post('/px/orderConvert/saveDates', {
      rows: list.map((r) => ({ 订单号: r.订单号, 行id: r['行id'], 交货日期: r.交货日期 })),
    })
    ElMessage.success(tt('交期已保存') + '：' + (res.data?.['更新行数'] ?? 0) + tt('行'))
    loadAll()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('保存失败'))
  }
}

async function toManu() {
  await convert('toManu', '转工单', 'MANU_ORDER')
}
async function toPurchase() {
  await convert('toPurchase', '转采购单', 'PU_REQ')
}

async function convert(api, label, gotoPanel) {
  const list = (checked.value || []).filter((r) => Number(r.生单数量) > 0)
  if (!list.length) { ElMessage.warning(tt('请先勾选要结转的订单行')); return }
  const qty = list.reduce((a, r) => a + Number(r.生单数量 || 0), 0)
  try {
    await ElMessageBox.confirm(
      `${tt('确认将选中的')} ${list.length} ${tt('行')}（${tt('合计')} ${qty}）${tt(label)}？`,
      tt('订单结转'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') },
    )
  } catch { return }
  try {
    const res = await request.post(`/px/orderConvert/${api}`, {
      rows: list.map((r) => ({
        订单号: r.订单号,
        行id: r['行id'],
        生单数量: Number(r.生单数量) || undefined,
        交货日期: r.交货日期 && r.交货日期 !== r.交货日期原始 ? r.交货日期 : undefined,
      })),
    })
    const d = res.data || {}
    const failed = d['失败行'] || []
    try {
      await ElMessageBox.confirm(
        `${tt('已生成')} ${d['生成张数']} ${tt('张')}：${(d['编号清单'] || []).join('、')}`
        + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''),
        tt('订单结转') + '·' + tt(label),
        { confirmButtonText: tt('前往查看'), cancelButtonText: tt('留在本页') },
      )
      window.location.hash = `#/panelx/list/${gotoPanel}`
    } catch { /* 留在本页 */ }
    loadAll()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('转单失败'))
  }
}

onMounted(loadAll)
</script>

<style scoped>
.oc-page { padding: 10px 14px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #f9f9f9; overflow: hidden; }
.oc-summary { background: #1e6fb8; color: #fff; padding: 8px 12px; border-radius: 4px; font-size: 13px; line-height: 1.6; }
.oc-sep { opacity: .8; }
.oc-bar { margin: 0; background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 6px 10px 0; }
.oc-strong { font-weight: 600; color: #303133; }
.oc-dim { color: #909399; font-size: 12px; }
.oc-blue { color: #1e6fb8; font-weight: 600; }
.oc-orange { color: #e6a23c; font-weight: 600; }
:deep(.oc-date-dirty .el-input__wrapper) { box-shadow: 0 0 0 1px #f56c6c inset; }
</style>
