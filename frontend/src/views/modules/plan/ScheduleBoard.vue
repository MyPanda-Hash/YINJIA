<!-- ScheduleBoard.vue — 排产工作台(实现总结 V1.0 §5 三段式;2026-09-23 纠偏还原,用户拍板:
     「产线×班别骨架」范式移步 工单排产 WorkOrderBoard.vue,本页回归 调度台=判断+排入+撤销。
     2026-10-07 用户口径:排产改为**工序路线排线** —— 勾选一张工单 → 「排产」→ 弹窗里按工艺路线
     逐道选线(人工选,一次选好全程线;计划数量只读)→ 首道线写 plang.scx/plang_pc,全路线写预排台账
     wo_process_line;前道报工完工审核后自动转序到下一道的线。撤销排产会同时作废台账。
     (原「顶部选线 + 批量排入」入口与 排产班组/预开工/预完工/排产数量 参数随之移除:班组移入弹窗。) -->
<template>
  <div class="sb-page">

    <!-- 过滤区 + 统计条 -->
    <el-form inline class="sb-bar" @submit.prevent>
      <el-form-item :label="tt('客户')">
        <el-select v-model="customer" clearable filterable style="width: 200px" @change="loadAll">
          <el-option v-for="c in customers" :key="c" :label="c" :value="c" />
        </el-select>
      </el-form-item>
      <el-form-item :label="tt('关键字')">
        <el-input v-model="keyword" :placeholder="tt('订单号 / 加工单号 / 产品 / 品名;只要某一行可写 工单号#行号')" clearable style="width: 250px" @keyup.enter="loadAll" />
      </el-form-item>
      <el-button type="primary" @click="loadAll">{{ tt('查询') }}</el-button>
      <el-button :loading="loading" @click="loadAll">{{ tt('刷新') }}</el-button>
      <!-- 2026-10-07 用户口径:排产时**一次把整条工艺路线的线选好**(弹窗逐道选线,人工选)。
           2026-10-16 权限:排产=页面面板「排产」动作词(assign);快速排产页与生产工单页两个入口
           任一授予即可(与后端 requireButtonAny 同口径)。 -->
      <el-button v-if="canAssign" type="success" :disabled="checked.length !== 1" @click="openPlan(checked[0])">
        {{ tt('排产') }}
      </el-button>
      <span class="sb-stats">
        <b v-if="s['车间']" class="sb-shop">{{ tt('当前车间') }}：{{ s['车间'] }}</b>
        {{ tt('待排产') }}（{{ s['待排产笔数'] ?? 0 }}{{ tt('笔') }}）；{{ tt('今日排产') }}（{{ s['今日排产']?.张数 ?? 0 }}{{ tt('张') }}/{{ num(s['今日排产']?.数量) }}{{ tt('件') }}）；{{ tt('总未完成量') }} {{ num(s['总未完成量']) }}
      </span>
    </el-form>

    <!-- 车间账号:待排产池仅计划组可见(池内工单未指派产线 ⇒ 无车间判据),此处给出口径提示 -->
    <el-alert v-if="s['待排产池受限']" type="info" :closable="false" show-icon
              :title="tt('本账号按工序/工艺过滤：待排产池仅计划组可见，下方只显示本工序产线的已排工单')" />

    <!-- ① 待排产池 -->
    <div class="sb-block">
      <div class="sb-head"><span class="sb-block-title">① {{ tt('待排产') }}</span><span class="sb-dim">{{ tt('勾选一张工单 → 点「排产」→ 按工艺路线逐道选线(双击行同效)') }}</span></div>
      <el-table ref="poolTable" :data="pool" size="small" border height="300" empty-text="" row-key="rowKey"
                @selection-change="onCheck" @row-dblclick="planOne">
        <el-table-column type="selection" width="42" reserve-selection />
        <el-table-column :label="tt('客户')" prop="客户" min-width="150" fixed show-overflow-tooltip />
        <el-table-column :label="tt('客户订单号')" prop="客户订单号" width="140" show-overflow-tooltip />
        <el-table-column :label="tt('加工单号')" prop="加工单号" width="150" show-overflow-tooltip />
        <el-table-column :label="tt('工单行号')" prop="工单行号" width="90" sortable />
        <el-table-column :label="tt('批次号')" prop="批次号" width="100" sortable />
        <el-table-column :label="tt('单据日期')" prop="单据日期" width="100" />
        <el-table-column :label="tt('产品编号')" prop="产品编号" width="110" show-overflow-tooltip />
        <el-table-column :label="tt('品名')" prop="品名" min-width="150" show-overflow-tooltip />
        <el-table-column :label="tt('型号')" prop="型号" width="120" show-overflow-tooltip />
        <el-table-column :label="tt('单位')" prop="单位" width="60" />
        <el-table-column :label="tt('重点管控')" prop="重点管控" width="85" />
        <el-table-column :label="tt('需求数量')" prop="需求数量" width="95" align="right" />
        <el-table-column :label="tt('排产数量')" prop="排产数量" width="95" align="right" />
        <el-table-column :label="tt('工序交期')" prop="工序交期" width="100" />
        <el-table-column :label="tt('交期紧迫度')" width="100" align="right">
          <template #default="{ row }"><span :class="urgent(row.交期紧迫度)">{{ row.交期紧迫度 ?? '-' }}</span></template>
        </el-table-column>
      </el-table>
    </div>

    <!-- ②③ 今日已排产(可切全部) + 撤销 -->
    <div class="sb-block">
      <div class="sb-head">
        <span class="sb-block-title">② {{ mode === 'today' ? tt('今日已排产') : tt('全部已排产') }}</span>
        <el-switch v-model="allMode" :active-text="tt('全部')" @change="loadToday" />
        <div class="sb-actions">
          <!-- 改线(2026-10-07):已排产工单重开排线弹窗改后续各道的预排线(首道线锁定) -->
          <el-button v-if="canAssign" size="small" type="primary" plain :disabled="checkedToday.length !== 1" @click="openPlan(checkedToday[0], true)">
            {{ tt('预排线') }}
          </el-button>
          <el-button v-if="canUnassign" size="small" type="danger" plain :disabled="!checkedToday.length" @click="unassign">
            {{ tt('撤销排产') }}（{{ checkedToday.length }}）
          </el-button>
        </div>
      </div>
      <!-- ② 已排产 的本地筛选(2026-10-28 用户口径:「除去「全部」这个筛选外,还需要增加其他筛选 ——
           增加模糊搜索查看当前的已排产内容」)。
           纯前端过滤:数据已整表在手(今日几十行 / 全部四百余行),输入即时出结果,不往返服务端;
           与顶部①的「关键字/客户」互不相干(那两个只筛待排产池)。 -->
      <div class="sb-filters">
        <el-input v-model="todayKw" size="small" clearable class="sb-f-kw"
                  :placeholder="tt('加工单号 / 行号 / 批次号 / 产品 / 品名 / 型号 / 产线 / 班组(空格分词,全部命中)')"
                  @input="onTodayFilter" @clear="onTodayFilter" />
        <el-select v-model="todayLine" size="small" clearable class="sb-f-sel" :placeholder="tt('生产线')" @change="onTodayFilter">
          <el-option v-for="x in todayLineOpts" :key="x" :label="x" :value="x" />
        </el-select>
        <el-select v-model="todayStatus" size="small" clearable class="sb-f-sel" :placeholder="tt('生产状态')" @change="onTodayFilter">
          <el-option v-for="x in todayStatusOpts" :key="x" :label="x" :value="x" />
        </el-select>
        <span class="sb-dim">{{ tt('显示') }} {{ filteredToday.length }} / {{ todayRows.length }} {{ tt('行') }}</span>
        <el-button v-if="todayFiltering" size="small" link type="primary" @click="clearTodayFilter">{{ tt('清空筛选') }}</el-button>
      </div>
      <!-- row-key 必须**唯一到行**(2026-10-07 修:此前用 加工单号 ⇒ 同一工单多行时勾一条会全勾) -->
      <el-table ref="todayTable" :data="filteredToday" size="small" border height="240" empty-text="" row-key="rowKey"
                @selection-change="onCheckToday">
        <el-table-column type="selection" width="42" />
        <el-table-column :label="tt('生产线')" prop="生产线" width="110" fixed />
        <el-table-column :label="tt('排产班组')" prop="排产班组" width="100" fixed />
        <el-table-column :label="tt('加工单号')" prop="加工单号" width="130" />
        <el-table-column :label="tt('工单行号')" prop="工单行号" width="90" sortable />
        <el-table-column :label="tt('批次号')" prop="批次号" width="90" sortable />
        <!-- 产品 / 品名 / 型号(2026-10-21 用户口径「快速排产看不到已排单的型号,需要增加对应的产品
             还有规格型号」):与上面①待排产池的列同名同值(产品编号/品名/型号),同一屏上下口径一致。
             加这三列后整套列宽做了一轮收紧(加工单号 150→130、数量列 95→85、日期列 105→90、
             计划线 240→220…,表宽 1502→1717px),让 1920 屏可视区(1674px)仍能一眼看到计划线;
             窄屏仍可横向拖动。列宽别随手加大 —— 加过去就要从别处挪回来。 -->
        <el-table-column :label="tt('产品编号')" prop="产品编号" width="100" show-overflow-tooltip />
        <el-table-column :label="tt('品名')" prop="品名" min-width="130" show-overflow-tooltip />
        <el-table-column :label="tt('型号')" prop="型号" width="120" show-overflow-tooltip />
        <el-table-column :label="tt('生产状态')" prop="生产状态" width="80" />
        <el-table-column :label="tt('排产数量')" prop="排产数量" width="85" align="right" />
        <el-table-column :label="tt('需求数量')" prop="需求数量" width="85" align="right" />
        <el-table-column :label="tt('入库数量')" prop="入库数量" width="80" align="right" />
        <el-table-column :label="tt('余量')" prop="余量" width="75" align="right" />
        <el-table-column :label="tt('预开工日')" prop="预开工日" width="90" />
        <el-table-column :label="tt('预完工日')" prop="预完工日" width="90" />
        <el-table-column :label="tt('计划线')" prop="计划线" min-width="220" show-overflow-tooltip />
      </el-table>
    </div>

    <!-- 工序路线排线弹窗(2026-10-07):排产时一次选好整条路线的线 -->
    <ProcessRoutePlanDialog v-model="planVisible" :加工单号="planRow['加工单号'] || ''"
                            :行id="planRow['行id'] ?? null" :工单行号="planRow['工单行号'] || ''"
                            :批次号="planRow['批次号'] || ''" :已排产="planLocked" @changed="loadAll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { canDo, canDoAny } from '@core/auth/panelAccess'
import ProcessRoutePlanDialog from './ProcessRoutePlanDialog.vue'
import { filterScheduled, isFiltering } from '@/business/scheduleFilter'

/**
 * 页面级权限(2026-10-16):本组件**两处挂载** —— 快速排产页(/prod/plan/scheduleBoard)与其
 * 在生产工单页里弹出的内嵌版;两处的动作词口径与后端 requireButtonAny 一致:
 *   · 排产/预排线 = 快速排产「排产」∪ 生产工单「排产」(assign);
 *   · 撤销排产   = 只认快速排产「撤销排产」(unassign,后端同口径)。
 */
const user = useUserStore()
const canAssign = computed(() => canDoAny(user, ['SCHEDULE_BOARD', 'WORK_ORDER_LIST'], 'assign'))
const canUnassign = computed(() => canDo(user, 'SCHEDULE_BOARD', 'unassign'))

/** 内嵌/筛选(2026-10-05 用户口径):生产工单页把"快速排产页面本身"弹出来,并只筛当前工单;
 *  2026-10-15 补「工单行号」—— 用户口径「工单号+工单行号确定当前唯一工单」:
 *  从生产工单页点「排产」时,弹窗必须只出**那一行**,不能把同工单所有行都列出来。
 *  ⚠ 生产工单页的「排产」**一次只允许勾一行**(勾多行会先提示),所以这里只需单行入参;
 *    曾经加过的「限定行id 列表」(为支持多选)已按用户口径回退。 */
const props = defineProps({
  '工单号': { type: String, default: '' },
  '工单行号': { type: [Number, String], default: null },
  embedded: { type: Boolean, default: false },
})

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
  } catch { /* 统计失败不阻断 */ }
}

async function loadToday() {
  try {
    // 2026-10-28:② 有了自己的筛选条 ⇒ 顶部①的「关键字」不再连带筛②(两个域各管各的,免得
    //   "在①里打了个关键字,②莫名其妙只剩几行")。**内嵌模式例外**(生产工单页弹出本组件时,
    //   目的就是只看那一张工单的已排行,必须继续按预置单号收敛)。
    const kw = props.embedded ? keyword.value : ''
    const res = await request.post('/px/scheduleBoard/today', { mode: mode.value, keyword: kw })
    // 行唯一键:同一工单可能有多行(多工单行/多批次)⇒ 用 加工单号#工单行号#批次号(否则勾一条会全勾)
    todayRows.value = (res.data || []).map((r, i) => ({
      ...r,
      rowKey: `${r['加工单号']}#${r['工单行号'] ?? ''}#${r['批次号'] ?? ''}#${i}`,
    }))
    checkedToday.value = []
  } catch (e) { err(e, '查询失败') }
}

function loadAll() { loadPool(); loadStats(); loadToday() }
function onCheck(r) { checked.value = r }
function onCheckToday(r) { checkedToday.value = r }

// ───────── ② 已排产 的本地筛选(2026-10-28) ─────────
// 用户口径:「除去「全部」这个筛选外,还需要增加其他筛选实现 —— 增加模糊搜索查看当前的已排产内容」。
// 规则与边界全在纯函数 business/scheduleFilter.js(带单测),本组件只存状态 + 渲染:
//   · 关键字按空格分词,每个词都要命中任一列(不分大小写);生产线/生产状态为精确等值,三者叠加;
//   · 纯前端过滤(整表已在手),输入即时出结果,不往返服务端。
// ⚠ 顶部①的「关键字/客户」只管待排产池(loadToday 非内嵌时不再带 keyword,见上面的注释)。
const todayKw = ref('')
const todayLine = ref('')
const todayStatus = ref('')
const todayLineOpts = computed(() => [...new Set(todayRows.value.map((r) => r['生产线']).filter(Boolean))].sort())
const todayStatusOpts = computed(() => [...new Set(todayRows.value.map((r) => r['生产状态']).filter(Boolean))])
const filteredToday = computed(() => filterScheduled(todayRows.value, {
  keyword: todayKw.value, line: todayLine.value, status: todayStatus.value,
}))
const todayFiltering = computed(() => isFiltering({
  keyword: todayKw.value, line: todayLine.value, status: todayStatus.value,
}))
/** 改了筛选就把勾选清掉:否则会「勾上了看不见的行」,撤销/预排线按看不见的行执行 */
function onTodayFilter() {
  checkedToday.value = []
  todayTable.value?.clearSelection?.()
}
function clearTodayFilter() {
  todayKw.value = ''
  todayLine.value = ''
  todayStatus.value = ''
  onTodayFilter()
}


// ───────── 工序路线排线(2026-10-07):排产 = 一次把整条工艺路线的线选好 ─────────
const planVisible = ref(false)
const planRow = ref({})
const planLocked = ref(false)
/** 打开排线弹窗:锁定时=改线(已排产,首道线锁定) */
function openPlan(row, locked) {
  if (!row) { ElMessage.warning(tt('请先勾选一张工单')); return }
  planRow.value = { ...row }
  planLocked.value = !!locked || !!row['生产线']
  planVisible.value = true
}
function planOne(row) { openPlan(row, false) }

async function unassign() {
  const list = checkedToday.value
  if (!list.length) return
  // 撤销**按工单行**(标识 = 工单号 + 工单行号,用户口径 2026-10-15「这两个确定当前唯一工单」):
  //   勾哪一行撤销哪一行,同工单其它行不动;该行预排线同时作废。
  //   两把键都带上:后端优先 行id,缺了还能按 (加工单号 + 工单行号) 反查(不会误退成整单撤销)
  const targets = list.map((r) => ({ 加工单号: r['加工单号'], 行id: r['行id'], 工单行号: r['工单行号'] })).filter((x) => x['加工单号'])
  const labels = list.map((r) => `${r['加工单号']}${r['工单行号'] != null ? ' 行' + r['工单行号'] : ''}`)
  try {
    await ElMessageBox.confirm(`${tt('确认撤销选中的')} ${targets.length} ${tt('行排产')}(${tt('撤销后回到待排产池;换线=撤销+重排;该行预排线同时作废')})？\n${labels.join('、')}`,
      tt('撤销排产'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.post('/px/scheduleBoard/unassign', { rows: targets })
    const d = res.data || {}
    const failed = d['失败行'] || []
    ElMessage.success(`${tt('已撤销')} ${d['撤销张数']} ${tt('行')}` + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''))
    loadAll()
  } catch (e) { err(e, '撤销失败') }
}

function err(e, f) { ElMessage.error(e?.response?.data?.message || tt(f)) }

/**
 * 切回本页签时**重新取数**(2026-10-14 用户报障「在生产工单处排产后,快速排产里该条单据不会切换为已排产」)。
 *
 * 根因:`PortalLayout` 的 `<router-view>` 外有 `<keep-alive>`,本页实例被缓存 ⇒ 在别的页面
 * (生产工单→排产 / 工单排产 / 撤销排产)改完排产状态后再切回本页,**不会**重新取数,只有手点「刷新」才变
 * —— 于是同一张工单在「生产工单」已是已排产、在「快速排产」的①待排产池里却还挂着(两处不一致)。
 * 现与生产工单页(关弹窗即 load)同口径:每次切回都拉一次 pool/stats/today。
 *
 * ⚠ 只认**切回**(首次 activate 跳过);首次挂载已由 onMounted 取数,避免同一屏发两遍请求。
 * ⚠ 内嵌用法(生产工单页弹窗里的本组件)不在 keep-alive 里,onActivated 不触发,行为不变。
 */
let firstActivate = true
onActivated(() => {
  if (firstActivate) { firstActivate = false; return }
  loadAll()
})

onMounted(() => {
  // 内嵌模式(2026-10-05 用户口径):生产工单页弹出"快速排产页面本身",预置单框搜索 ⇒ 只显示当前工单。
  // 2026-10-15:带了**工单行号**时预置成「工单号#行号」标识形式 ⇒ **只显示这一行**
  //   (用户报障「勾选单一工单号+行号的一条单据,同样会显示全部相同工单号的行」;
  //    后端 pending 支持该形式,见 ScheduleBoardService.parseWoLineKey)。
  if (props['工单号']) {
    const xc = props['工单行号']
    keyword.value = (xc === null || xc === undefined || xc === '') ? props['工单号'] : `${props['工单号']}#${xc}`
  }
  loadAll()
})
</script>

<style scoped>
.sb-page { padding: 10px 14px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #f9f9f9; overflow: auto; }
.sb-title { font-weight: 600; color: #116a5b; }
.sb-p { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #606266; }
.sb-bar { margin: 0; background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 6px 10px 0; }
.sb-stats { margin-left: auto; font-size: 12px; color: #116a5b; font-weight: 600; }
.sb-shop { color: #e6a23c; margin-right: 10px; }
.sb-block { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; }
.sb-head { display: flex; align-items: center; gap: 12px; padding: 6px 10px; border-bottom: 1px solid #e4e7ed; }
.sb-block-title { font-weight: 600; font-size: 13px; color: #303133; }
.sb-dim { font-size: 12px; color: #909399; }
.sb-actions { margin-left: auto; }
/* ② 已排产 的本地筛选条(2026-10-28) */
.sb-filters { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid #f0f2f3; flex-wrap: wrap; }
.sb-f-kw { width: 320px; }
.sb-f-sel { width: 130px; }
.sb-late { color: #f56c6c; font-weight: 600; }
.sb-near { color: #e6a23c; font-weight: 600; }
</style>
