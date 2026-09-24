<!-- ScheduleBoard.vue — 排产工作台(实现总结 V1.0 §5 三段式;2026-09-23 纠偏还原,用户拍板:
     「产线×班别骨架」范式移步 工单排产 WorkOrderBoard.vue,本页回归 调度台=判断+排入+撤销。
     池=已审核·未指派产线;双击行=单笔排入,勾选+顶部参数=批量同线;撤销回池(换线=撤销+重排);
     回执含产线 当日负荷/日产能/超载提示——只提示不拦截(排产人工拍板)。 -->
<template>
  <div class="sb-page">
    <!-- 顶部参数区 -->
    <div class="sb-params">
      <span class="sb-title">{{ tt('排产参数') }}</span>
      <span class="sb-p">{{ tt('生产线') }}
        <el-select v-model="param.line" filterable style="width: 220px" :placeholder="tt('选择生产线')">
          <el-option v-for="l in lines" :key="l.生产线" :value="l.生产线"
                     :label="`${l.生产线} · ${tt('今日负荷')}${num(l.今日负荷)}/${tt('日产能')}${num(l.日产能)}`" />
        </el-select>
      </span>
      <span class="sb-p">{{ tt('排产班组') }}
        <el-select v-model="param.team" clearable filterable style="width: 130px">
          <el-option v-for="t in teams" :key="t" :label="t" :value="t" />
        </el-select>
      </span>
      <span class="sb-p">{{ tt('预开工日') }}<el-date-picker v-model="param.start" type="date" value-format="YYYY-MM-DD" style="width: 135px" /></span>
      <span class="sb-p">{{ tt('预完工日') }}<el-date-picker v-model="param.due" type="date" value-format="YYYY-MM-DD" style="width: 135px" /></span>
      <span class="sb-p">{{ tt('排产数量') }}（{{ tt('空=全排') }}）
        <el-input-number v-model="param.qty" :min="0" :controls="false" size="small" style="width: 110px" />
      </span>
    </div>

    <!-- 过滤区 + 统计条 -->
    <el-form inline class="sb-bar" @submit.prevent>
      <el-form-item :label="tt('客户')">
        <el-select v-model="customer" clearable filterable style="width: 200px" @change="loadAll">
          <el-option v-for="c in customers" :key="c" :label="c" :value="c" />
        </el-select>
      </el-form-item>
      <el-form-item :label="tt('关键字')">
        <el-input v-model="keyword" :placeholder="tt('订单号 / 加工单号 / 产品 / 品名')" clearable style="width: 250px" @keyup.enter="loadAll" />
      </el-form-item>
      <el-button type="primary" @click="loadAll">{{ tt('查询') }}</el-button>
      <el-button :loading="loading" @click="loadAll">{{ tt('刷新') }}</el-button>
      <el-button type="success" :disabled="!checked.length" @click="assign(checked)">{{ tt('批量排入勾选') }}（{{ checked.length }}）</el-button>
      <span class="sb-stats">
        {{ tt('待排产') }}（{{ s['待排产笔数'] ?? 0 }}{{ tt('笔') }}）；{{ tt('今日排产') }}（{{ s['今日排产']?.张数 ?? 0 }}{{ tt('张') }}/{{ num(s['今日排产']?.数量) }}{{ tt('件') }}）；{{ tt('总未完成量') }} {{ num(s['总未完成量']) }}
      </span>
    </el-form>

    <!-- ① 待排产池 -->
    <div class="sb-block">
      <div class="sb-head"><span class="sb-block-title">① {{ tt('待排产') }}</span><span class="sb-dim">{{ tt('双击行即排入该单') }}</span></div>
      <el-table ref="poolTable" :data="pool" size="small" border height="300" empty-text="" row-key="rowKey"
                @selection-change="onCheck" @row-dblclick="assignOne">
        <el-table-column type="selection" width="42" reserve-selection />
        <el-table-column :label="tt('客户等级')" prop="客户等级" width="90" fixed />
        <el-table-column :label="tt('客户')" prop="客户" min-width="150" fixed show-overflow-tooltip />
        <el-table-column :label="tt('客户订单号')" prop="客户订单号" width="140" show-overflow-tooltip />
        <el-table-column :label="tt('加工单号')" prop="加工单号" width="150" show-overflow-tooltip />
        <el-table-column :label="tt('单据日期')" prop="单据日期" width="100" />
        <el-table-column :label="tt('产品编号')" prop="产品编号" width="110" show-overflow-tooltip />
        <el-table-column :label="tt('品名')" prop="品名" min-width="150" show-overflow-tooltip />
        <el-table-column :label="tt('型号')" prop="型号" width="120" show-overflow-tooltip />
        <el-table-column :label="tt('单位')" prop="单位" width="60" />
        <el-table-column :label="tt('混料批次号')" prop="混料批次号" width="110" show-overflow-tooltip />
        <el-table-column :label="tt('重点管控')" prop="重点管控" width="85" />
        <el-table-column :label="tt('需求数量')" prop="需求数量" width="95" align="right" />
        <el-table-column :label="tt('排产数量')" prop="排产数量" width="95" align="right" />
        <el-table-column :label="tt('每箱数量')" prop="每箱数量" width="90" align="right" />
        <el-table-column :label="tt('工序交期')" prop="工序交期" width="100" />
        <el-table-column :label="tt('交期紧迫度')" width="100" align="right">
          <template #default="{ row }"><span :class="urgent(row.交期紧迫度)">{{ row.交期紧迫度 ?? '-' }}</span></template>
        </el-table-column>
        <el-table-column :label="tt('本次排产数量')" width="130" fixed="right">
          <template #default="{ row }">
            <el-input-number v-model="row.本次数量" :min="0" :controls="false" size="small" style="width: 100%" />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- ②③ 今日已排产(可切全部) + 撤销 -->
    <div class="sb-block">
      <div class="sb-head">
        <span class="sb-block-title">② {{ mode === 'today' ? tt('今日已排产') : tt('全部已排产') }}</span>
        <el-switch v-model="allMode" :active-text="tt('全部')" @change="loadToday" />
        <div class="sb-actions">
          <el-button size="small" type="danger" plain :disabled="!checkedToday.length" @click="unassign">
            {{ tt('撤销排产') }}（{{ checkedToday.length }}）
          </el-button>
        </div>
      </div>
      <el-table ref="todayTable" :data="todayRows" size="small" border height="240" empty-text="" row-key="加工单号"
                @selection-change="onCheckToday">
        <el-table-column type="selection" width="42" />
        <el-table-column :label="tt('生产线')" prop="生产线" width="110" fixed />
        <el-table-column :label="tt('排产班组')" prop="排产班组" width="100" fixed />
        <el-table-column :label="tt('加工单号')" prop="加工单号" width="150" />
        <el-table-column :label="tt('生产状态')" prop="生产状态" width="90" />
        <el-table-column :label="tt('排产数量')" prop="排产数量" width="95" align="right" />
        <el-table-column :label="tt('每箱数量')" prop="每箱数量" width="90" align="right" />
        <el-table-column :label="tt('箱数')" prop="箱数" width="80" align="right" />
        <el-table-column :label="tt('需求数量')" prop="需求数量" width="95" align="right" />
        <el-table-column :label="tt('入库数量')" prop="入库数量" width="95" align="right" />
        <el-table-column :label="tt('余量')" prop="余量" width="85" align="right" />
        <el-table-column :label="tt('预开工日')" prop="预开工日" width="105" />
        <el-table-column :label="tt('预完工日')" prop="预完工日" width="105" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'

const keyword = ref('')
const customer = ref('')
const loading = ref(false)
const pool = ref([])
const checked = ref([])
const poolTable = ref(null)
const todayRows = ref([])
const checkedToday = ref([])
const allMode = ref(false)
const s = ref({})
const lines = ref([])
const teams = ref([])
const param = reactive({ line: '', team: '', start: '', due: new Date().toISOString().slice(0, 10), qty: null })
const mode = computed(() => (allMode.value ? 'all' : 'today'))
const customers = computed(() => [...new Set(pool.value.map((r) => r.客户).filter(Boolean))].sort())

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '' }
function urgent(v) {
  const n = Number(v)
  if (v === null || v === undefined || v === '' || Number.isNaN(n)) return ''
  if (n < 0) return 'sb-late'
  if (n <= 7) return 'sb-near'
  return ''
}

async function loadPool() {
  loading.value = true
  try {
    const res = await request.post('/px/scheduleBoard/pending', { keyword: keyword.value, 客户: customer.value })
    pool.value = (res.data || []).map((r) => ({
      ...r,
      本次数量: null,
      rowKey: `${r.加工单号}#${r['行id']}`,
    }))
    checked.value = []
    poolTable.value?.clearSelection?.()
  } catch (e) { err(e, '查询失败') } finally { loading.value = false }
}

async function loadStats() {
  try {
    const res = await request.post('/px/scheduleBoard/stats', {})
    s.value = res.data || {}
    lines.value = s.value['产线'] || []
    teams.value = s.value['班组'] || []
  } catch { /* 统计失败不阻断 */ }
}

async function loadToday() {
  try {
    const res = await request.post('/px/scheduleBoard/today', { mode: mode.value, keyword: keyword.value })
    todayRows.value = res.data || []
    checkedToday.value = []
  } catch (e) { err(e, '查询失败') }
}

function loadAll() { loadPool(); loadStats(); loadToday() }
function onCheck(r) { checked.value = r }
function onCheckToday(r) { checkedToday.value = r }

/** 行参数 = 顶部参数 + 行内覆盖(生产线/本次数量) */
function rowParams(r) {
  return {
    加工单号: r.加工单号, 行id: r['行id'],
    生产线: param.line || undefined,
    排产班组: param.team || undefined,
    预开工日: param.start || undefined,
    预完工日: param.due || undefined,
    排产数量: Number(r.本次数量) || param.qty || undefined,
    顶部生产线: param.line || undefined,
  }
}

async function assign(rows) {
  const list = rows || []
  if (!param.line) { ElMessage.warning(tt('请先在顶部选择生产线')); return }
  try {
    await ElMessageBox.confirm(`${tt('确认将选中的')} ${list.length} ${tt('张加工单排入')}「${param.line}」？`,
      tt('排产工作台'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.post('/px/scheduleBoard/assign', { rows: list.map(rowParams) })
    const d = res.data || {}
    const rc = (d['产线回执'] || []).map((l) => `${l.生产线}:${tt('今日负荷')}${num(l.今日负荷)}/${tt('日产能')}${num(l.日产能)}${l.提示 === '超载' ? ' ⚠' + tt('超载') : ''}`).join('；')
    const failed = d['失败行'] || []
    try {
      await ElMessageBox.alert(
        `${tt('已排产')} ${d['排产张数']} ${tt('张')}${failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''}${rc ? `<br/><b>${rc}</b>` : ''}`,
        tt('排产回执'), { dangerouslyUseHTMLString: true, confirmButtonText: tt('知道了') })
    } catch { /* 回执关闭 */ }
    loadAll()
  } catch (e) { err(e, '排产失败') }
}

function assignOne(row) { assign([row]) }

async function unassign() {
  const list = checkedToday.value
  if (!list.length) return
  try {
    await ElMessageBox.confirm(`${tt('确认撤销选中的')} ${list.length} ${tt('张加工单的排产')}(撤销后回到待排产池;换线=撤销+重排)？`,
      tt('撤销排产'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.post('/px/scheduleBoard/unassign', { rows: list.map((r) => ({ 加工单号: r.加工单号 })) })
    const d = res.data || {}
    const failed = d['失败行'] || []
    ElMessage.success(`${tt('已撤销')} ${d['撤销张数']} ${tt('张')}` + (failed.length ? `（${tt('跳过')} ${failed.length}）` : ''))
    loadAll()
  } catch (e) { err(e, '撤销失败') }
}

function err(e, f) { ElMessage.error(e?.response?.data?.message || tt(f)) }

onMounted(loadAll)
</script>

<style scoped>
.sb-page { padding: 10px 14px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #f9f9f9; overflow: auto; }
.sb-params { display: flex; align-items: center; gap: 14px; padding: 8px 10px; background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; flex-wrap: wrap; }
.sb-title { font-weight: 600; color: #116a5b; }
.sb-p { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #606266; }
.sb-bar { margin: 0; background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 6px 10px 0; }
.sb-stats { margin-left: auto; font-size: 12px; color: #116a5b; font-weight: 600; }
.sb-block { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; }
.sb-head { display: flex; align-items: center; gap: 12px; padding: 6px 10px; border-bottom: 1px solid #e4e7ed; }
.sb-block-title { font-weight: 600; font-size: 13px; color: #303133; }
.sb-dim { font-size: 12px; color: #909399; }
.sb-actions { margin-left: auto; }
.sb-late { color: #f56c6c; font-weight: 600; }
.sb-near { color: #e6a23c; font-weight: 600; }
</style>
