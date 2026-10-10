<!-- WorkOrderList.vue — 生产工单(2026-09-26 用户拍板:纯查询页,数据=参考库工单表 plang)
     顶部 日期范围 + 单框模糊搜索(工单号/物料/客户/产品 多列 OR);按钮条 结案/取消结案/切单/排产/撤回切单/打印工单(勾选多个=批量)/转领料单/导出/刷新;
     产线筛选 + 未完工/已完工/追溯;明细大表(勾选)。打印工单=勾选行直打+留痕;结案走 plang 专属端点。
     转领料单(2026-10-07 用户拍板:原「打印领料单」改为转单)=勾选工单 → 按工单号生成「材料出库单(领料单)」
     草稿(加工单号=工单号;**明细留空由仓库补**,系统内已无 BOM/配方数据可自动展开),审核出库后自动回写工单领料单号。
     取数窗口:默认预填最近 15 天(2026-10-05 用户口径,防单据累积后卡),清空日期框=查全量。 -->
<template>
  <div class="wol-page">
    <!-- 查询行:日期范围 + 单框模糊搜索 -->
    <div class="wol-query">
      <span class="wol-lb">{{ tt('日期范围') }}</span>
      <el-date-picker v-model="dateFrom" type="date" value-format="YYYY-MM-DD" size="small" style="width: 130px" />
      <span class="wol-sep">-</span>
      <el-date-picker v-model="dateTo" type="date" value-format="YYYY-MM-DD" size="small" style="width: 130px" />
      <span class="wol-lb" style="margin-left: 12px">{{ tt('模糊搜索') }}</span>
      <el-input v-model="qText" size="small" style="width: 220px" :placeholder="tt('输入查询条件...')" clearable @keyup.enter="load" />
      <el-button size="small" type="success" @click="load">{{ tt('查找') }}</el-button>
      <span class="wol-count">{{ tt('共有数据') }}: <b>{{ rows.length }}</b> {{ tt('条') }}</span>
    </div>

    <!-- 按钮条(2026-09-28 用户拍板:生产工单=纯汇总视图——数据只由订单结转产生,排产唯一入口=快速排产;
         撤排产按钮防中间节点误操作;保留 查询/筛选/打印/结案留痕) -->
    <div class="wol-btns">
      <el-button size="small" type="success" plain @click="onClose(true)" :disabled="!checked.length">{{ tt('结案') }}</el-button>
      <el-button size="small" type="success" plain @click="onClose(false)" :disabled="!checked.length">{{ tt('取消结案') }}</el-button>
      <!-- 切单(9.29 生产管理批次①,2026-10-05):勾选一张在产工单 → 输入切出数量 → 子工单(新工单号);
           撤回切单 = 子单无报工/入库/领料时可还原父单数量(WorkOrderSplitService.split/unsplit) -->
      <el-button size="small" type="warning" plain @click="openSplit" :disabled="!checked.length && !currentRow">{{ tt('切单') }}</el-button>
      <!-- 工单排产弹窗(2026-10-05 用户口径):只带当前这一张工单的快速排产 -->
      <el-button size="small" type="success" plain :disabled="(!checked.length && !currentRow) || Number((checked[0] || currentRow || {})['生产线'] ? 1 : 0) === 1" @click="openSchedule">{{ tt('排产') }}</el-button>
      <el-button size="small" plain @click="onUnsplit" :disabled="!checked.length && !currentRow">{{ tt('撤回切单') }}</el-button>
      <el-dropdown split-button size="small" type="primary" @click="doPrintTask('成型生产任务单')" @command="doPrintTask"
                   :disabled="!checked.length && !currentRow">
        {{ tt('打印工单') }}
        <template #dropdown>
          <el-dropdown-item command="成型生产任务单">{{ tt('成型生产任务单') }}</el-dropdown-item>
          <el-dropdown-item command="组装生产任务单">{{ tt('组装生产任务单') }}</el-dropdown-item>
        </template>
      </el-dropdown>
      <el-button size="small" @click="toPicking" :disabled="!checked.length">{{ tt('转领料单') }}</el-button>
      <el-button size="small" type="primary" @click="exportCsv">{{ tt('导出') }}</el-button>
      <el-button size="small" @click="load">{{ tt('刷新') }}</el-button>
    </div>

    <!-- 产线筛选条 -->
    <div class="wol-line">
      <span class="wol-lb">{{ tt('生产线') }}:</span>
      <el-select v-model="lineFilter" size="small" clearable filterable style="width: 170px" :placeholder="tt('全部产线')" @change="load">
        <el-option v-for="l in lines" :key="l.v" :label="l.t" :value="l.v" />
      </el-select>
      <span class="wol-lb" style="margin-left: 10px">{{ tt('产线代号') }}:</span>
      <el-input v-model="lineCode" size="small" style="width: 120px" readonly />
      <span class="wol-lb" style="margin-left: auto">{{ tt('筛选') }}:</span>
      <el-radio-group v-model="stateFilter" size="small" @change="applyFilter">
        <el-radio-button value="">{{ tt('全部') }}</el-radio-button>
        <el-radio-button value="未完工">{{ tt('未完工') }}</el-radio-button>
        <el-radio-button value="已完工">{{ tt('已完工') }}</el-radio-button>
      </el-radio-group>
      <el-button size="small" plain style="margin-left: 10px" @click="openTrace" :disabled="!currentRow">{{ tt('追溯') }}</el-button>
    </div>

    <!-- 明细大表 -->
    <el-table :data="paged" border size="small" class="wol-table" height="100%"
              @selection-change="(r) => (checked = r)" @current-change="(r) => (currentRow = r)" ref="tableRef"
              highlight-current-row row-key="rowKey">
      <el-table-column type="selection" width="40" fixed="left" reserve-selection />
      <el-table-column :label="tt('公司代码')" prop="公司代码" width="90" show-overflow-tooltip />
      <el-table-column :label="tt('工单号')" prop="加工单号" width="150" sortable show-overflow-tooltip>
        <template #default="{ row }">
          <!-- 点工单号 = 打开工单排产的追溯(=工单详情:工序进度+时间线+血缘) -->
          <el-link type="primary" :underline="false" @click="openTrace(row)">{{ row['工单号'] }}</el-link>
        </template>
      </el-table-column>
      <el-table-column :label="tt('工单行号')" prop="行号" width="90" sortable />
      <el-table-column :label="tt('批次号')" prop="批次号" width="100" sortable />
      <el-table-column :label="tt('源工单号')" prop="源工单号" width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ row.源工单号 || '-' }}</template>
      </el-table-column>
      <el-table-column :label="tt('拆分序号')" prop="拆分序号" width="85" align="right">
        <template #default="{ row }">{{ row.拆分序号 ?? '-' }}</template>
      </el-table-column>
      <el-table-column :label="tt('工单日期')" prop="单据日期" width="100" sortable />
      <el-table-column :label="tt('转单时间')" prop="转单时间" width="140" sortable show-overflow-tooltip />
      <el-table-column :label="tt('物料编码')" prop="物料编码" width="130" show-overflow-tooltip />
      <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="180" show-overflow-tooltip />
      <el-table-column :label="tt('规格型号')" prop="规格型号" min-width="160" show-overflow-tooltip />
      <el-table-column :label="tt('客户')" prop="客户" min-width="120" show-overflow-tooltip />
      <el-table-column :label="tt('生产线')" prop="生产线" width="110" show-overflow-tooltip />
      <el-table-column :label="tt('需求数量')" prop="需求数量" width="100" align="right" sortable />
      <el-table-column :label="tt('转单数量')" prop="排产数量" width="95" align="right" />
      <el-table-column :label="tt('入库数量')" prop="入库数量" width="90" align="right" />
      <el-table-column :label="tt('余量')" prop="余量" width="90" align="right" />
      <el-table-column :label="tt('领料单号')" prop="领料单号" width="150" show-overflow-tooltip />
      <el-table-column :label="tt('打印人')" prop="打印人" width="90" />
      <el-table-column :label="tt('打印时间')" prop="打印时间" width="140" />
      <el-table-column :label="tt('当前工序')" width="100" sortable prop="当前工序">
        <template #default="{ row }">
          <span :class="{ 'wol-closed': row.当前工序 === '组装' }">{{ row.当前工序 ? tt(row.当前工序) : '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('工序进度')" width="120" align="right">
        <template #default="{ row }">
          <span v-if="row.当前工序">{{ num(row.当前工序完工量) }}/{{ num(row.当前工序计划量) }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('生产状态')" prop="生产状态" width="90" fixed="right">
        <template #default="{ row }">
          <span :class="{ 'wol-closed': row.生产状态 === '完工' }">{{ tt(row.生产状态) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('结案')" width="70" fixed="right">
        <template #default="{ row }">
          <span :class="{ 'wol-closed': row.结案 === 'Y' }">{{ row.结案 === 'Y' ? tt('已结案') : '-' }}</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 工单排产弹窗(2026-10-05 用户口径):**内嵌快速排产页面本身**,用工单号筛选 ⇒ 只显示当前工单 -->
    <el-dialog v-model="schedVisible" :title="tt('工单排产（快速排产）')" width="94%" top="4vh" append-to-body destroy-on-close
               @closed="load">
      <div style="height: 76vh; overflow: hidden">
        <ScheduleBoard :工单号="schedNo" embedded />
      </div>
    </el-dialog>

    <!-- 工单详情·追溯(与工单排产同一组件,原地打开;2026-10-05) -->
    <WorkOrderTraceDialog v-model="traceVisible" :code="traceNo" :行id="traceRowId" />

    <!-- 切单弹窗:可切上限 = 排产数量 − max(已入库, 各工序已完工报工最大值);子单取新工单号 -->
    <el-dialog v-model="splitVisible" :title="tt('切单')" width="440px" append-to-body>
      <div v-if="splitInfo" class="wol-split">
        <div class="wol-split-row"><span>{{ tt('工单号') }}</span><b>{{ splitInfo['工单号'] }}#{{ splitInfo['工单行号'] }}</b></div>
        <div class="wol-split-row"><span>{{ tt('产品名称') }}</span><span>{{ splitInfo['产品名称'] }} {{ splitInfo['规格型号'] }}</span></div>
        <div class="wol-split-row"><span>{{ tt('生产线') }}</span><span>{{ splitInfo['生产线'] || '-' }}</span></div>
        <div class="wol-split-row"><span>{{ tt('排产数量') }}</span><b>{{ num(splitInfo['排产数量']) }}</b></div>
        <div class="wol-split-row"><span>{{ tt('入库数量') }}</span><span>{{ num(splitInfo['入库数量']) }}</span></div>
        <div class="wol-split-row"><span>{{ tt('已完工报工') }}</span><span>{{ num(splitInfo['已完工报工']) }}</span></div>
        <div class="wol-split-row"><span>{{ tt('已切出') }}</span><span>{{ num(splitInfo['已切出数量']) }}</span></div>
        <div class="wol-split-row hl"><span>{{ tt('可切上限') }}</span><b>{{ num(splitInfo['可切上限']) }}</b></div>
        <div class="wol-split-row"><span>{{ tt('切出数量') }}</span>
          <el-input-number v-model="splitQty" :min="0" :max="Number(splitInfo['可切上限']) || 0"
                           :controls="false" size="small" style="width: 140px" />
        </div>
        <el-checkbox v-model="splitInherit">{{ tt('继承产线/班组/交期') }}</el-checkbox>
        <div class="wol-split-tip">{{ tt('子工单取新工单号,可独立报工、打印;撤回切单可还原父单数量(子单无报工/入库/领料时)') }}</div>
      </div>
      <template #footer>
        <el-button @click="splitVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="splitLoading" @click="doSplit">{{ tt('确认切单') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { printWorkTaskSheet } from '@/business/print-formats'
import WorkOrderTraceDialog from './WorkOrderTraceDialog.vue'
import ScheduleBoard from './ScheduleBoard.vue'
import { useUserStore } from '@/stores/user'
import { useTabsStore } from '@/stores/tabs'

/** 转领料单生成后跳「材料出库单」用(与其它页 gotoPanel 同一范式:tabs.open + router.push) */
const router = useRouter()
const tabs = useTabsStore()

const rows = ref([])
const checked = ref([])
const currentRow = ref(null)
/** 表格引用:刷新后清勾选用(2026-10-05 修「撤回切单后卡在请先勾选」的 bug) */
const tableRef = ref(null)
const lines = ref([])
const lineFilter = ref('')
const lineCode = ref('')
const stateFilter = ref('')
/**
 * 默认取数窗口 = 最近 15 天(2026-10-05 用户口径:单据一多就卡,默认不拉全量)。
 * 进页面时预填「今天-14 ~ 今天」(含今天共 15 天);**清空两个日期即查全量**。
 * 注意:日期串按本机时区拼(不用 toISOString —— UTC 下东八区 00:00~08:00 会退一天)。
 */
const DEFAULT_WINDOW_DAYS = 15
const dateFrom = ref('')
const dateTo = ref('')
const qText = ref('')
// 切单(9.29 批次①):弹窗状态 + 预览(可切上限)
const splitVisible = ref(false)
const splitLoading = ref(false)
const splitInfo = ref(null)
const splitQty = ref(0)
const splitInherit = ref(true)
/** 工单详情·追溯(2026-10-05):与工单排产同一组件,本页原地打开 */
const traceVisible = ref(false)
const traceNo = ref('')
/** 追溯的工单行id(plang.id):行级口径必需(2026-10-15) */
const traceRowId = ref(null)
/** 工单排产弹窗(2026-10-05 用户口径):只带当前这一张工单的快速排产 */
const schedVisible = ref(false)
const schedNo = ref('')
function openSchedule() {
  const r = (checked.value.length === 1 ? checked.value[0] : currentRow.value) || checked.value[0]
  if (!r) { ElMessage.warning(tt('请先勾选一张工单')); return }
  if (r['生产线']) { ElMessage.warning(`${tt('该工单已排产')}(${r['生产线']})，${tt('不能重复排入;换线请先撤销排产')}`); return }
  schedNo.value = r['工单号']
  schedVisible.value = true
}

const filtered = computed(() => rows.value.filter((r) => {
  if (stateFilter.value === '未完工' && r.生产状态 === '完工') return false
  if (stateFilter.value === '已完工' && r.生产状态 !== '完工') return false
  return true
}))
const paged = computed(() => filtered.value)

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
function err(e, f) { ElMessage.error(e?.response?.data?.message || tt(f)) }

async function load() {  try {
    const cond = {}
    if (dateFrom.value) cond['日期从'] = dateFrom.value
    if (dateTo.value) cond['日期到'] = dateTo.value
    if (qText.value.trim()) cond['keyword'] = qText.value.trim()
    if (lineFilter.value) cond['生产线'] = lineFilter.value
    const res = await request.post('/px/workOrderList', cond)
    rows.value = (res.data || []).map((r) => ({ ...r, rowKey: String(r.行id ?? (r.工单号 + '#' + r.工单行号)) }))
    // 2026-10-05 修复:刷新后清掉旧勾选 —— reserve-selection 会保留"已从列表消失的行"的勾选(且无法手动取消),
    // 造成切单/撤回切单永久提示「请先勾选一张工单」。
    checked.value = []
    currentRow.value = null
    tableRef.value?.clearSelection?.()
    applyLineMeta()
  } catch (e) { err(e, '查询失败') }
}

async function loadLines() {
  try {
    const res = await request.post('/px/scheduleBoard/linesSummary', { 开工日期: new Date().toISOString().slice(0, 10) })
    lines.value = [...new Map((res.data || []).map((x) => [x['生产线'], { v: x['生产线'], t: x['生产线'] + (x['生产车间'] ? '·' + x['生产车间'] : '') }])).values()]
  } catch { /* 不阻断 */ }
}

function applyLineMeta() {
  const l = lines.value.map((x) => x.v)
  for (const r of rows.value) if (!r.生产线) r.生产线 = ''
  lineCode.value = lineFilter.value ? (lines.value.find((x) => x.v === lineFilter.value)?.t.split('·')[1] || '') : ''
  void l
}

// 排产写入口已撤(2026-09-28 用户拍板):生产工单=纯汇总视图,数据只由订单结转产生;
// 排产/改数量/换线 → 一律走「快速排产」唯一入口(/px/scheduleBoard/assign)。

async function onClose(close) {
  const nos = [...new Set(checked.value.map((r) => r.工单号))]
  if (!nos.length) return
  try {
    await ElMessageBox.confirm(
      `${tt('确认')} ${close ? tt('结案') : tt('取消结案')} ${nos.length} ${tt('张工单')}?`,
      tt(close ? '结案' : '取消结案'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.post('/px/workOrderList/close', {
      结案: close,
      rows: checked.value.map((r) => ({ 公司代码: r.公司代码, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号 })),
    })
    if (res.status === 200) { ElMessage.success(tt('操作成功')); load() }
  } catch (e) { err(e, '操作失败') }
}

/**
 * 打印工单(两模板可选,2026-09-27):勾选行直打,打印留痕回写 plang。
 *   成型生产任务单/组装生产任务单 = 行表任务单(横版,列见截图版式)。
 * ⚠ 2026-10-14 「生产投料单」模板下线:它的物料行全部来自自建 BOM
 *   (/px/workOrderBom → bs_bom),随 MES 自建 BOM 功能整体删除,前端已无替代数据源。
 */
async function doPrintTask(mode) {
  const src = checked.value.length ? checked.value : (currentRow.value ? [currentRow.value] : [])
  if (!src.length) { ElMessage.warning(tt('请先勾选要打印的工单')); return }
  try {
    // 成型任务单的数量 = **按工艺路线换算后的成型工序量**(2026-10-05 用户口径:
    // 「成型打印的任务单就是需要根据换算进行的…不需要显示换算率,显示换算后的数量即可」)。
    // 换算因子 = 该工单成型工序的计划量 ÷ 工单计划合计(即累计换算率),再按**行**的排产数量摊算;
    // 取不到(未绑路线/无换算)时退回排产数量,不影响既有打印。
    const factor = {}
    if (mode === '成型生产任务单') {
      await Promise.all([...new Set(src.map((r) => r.工单号))].map(async (no) => {
        try {
          const d = (await request.post('/px/processTask/detail', { 工单号: no })).data || {}
          const total = Number(d['计划合计'] || 0)
          const st = (d['工序步骤'] || []).find((x) => x['工序'] === '成型')
          const q = Number(st?.['计划量'] || 0)
          if (total > 0 && q > 0) factor[no] = q / total
        } catch { /* 取不到就退回排产数量 */ }
      }))
    }
    const rowsToPrint = src.map((r) => ({
      单据编号: r.工单号,
      公司代码: r.公司代码 || '', 工单行号: r.工单行号, // 工单二维码=公司代码@工单号@1000+工单行号(2026-10-09 规则改版)
      是否重点管控产品: r.重点管控 || '',
      商品编码: r.物料编码 || '',
      商品名称: r.产品名称 || '',
      规格型号: r.规格型号 || '',
      订单数量: r.需求数量,
      // 成型任务单:换算后的数量(出货口 = 该行排产数量 × 累计换算率,如 3 倍 → 80 变 240)
      成型折算后数量: factor[r.工单号] ? Math.round(Number(r.排产数量 || 0) * factor[r.工单号] * 10000) / 10000 : r.排产数量,
      计划完工日期: r.计划完工日期 || '',
      批号: r.批号 || '', 物料编码: r.物料编码 || '',
      排产数量: r.排产数量, 生产线: r.生产线 || lineFilter.value || '',
    }))
    const okPrint = await printWorkTaskSheet(mode, rowsToPrint, { line: lineFilter.value || '', preparedBy: useUserStore().realName })
    if (okPrint) {
      await request.post('/px/workOrderList/printStamp', {
        rows: src.map((r) => ({ 公司代码: r.公司代码, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号 })),
      })
    }
    load()
  } catch (e) { err(e, '打印失败') }
}

/**
 * 转领料单(2026-10-07 用户拍板:原「打印领料单」改为转单,打印入口不再保留)。
 * 勾选工单行 → 逐个生成「材料出库单(领料单)」草稿:单据头挂 加工单号=工单号 + **工单行号**
 * (审核出库后后端 ManuWritebackService 按行回写工单「领料单号」,本页该列随之逐行点亮)。
 * ⚠ **标识 = 工单号 + 工单行号**(用户口径 2026-10-15:「就是当前的工单号加工单行号作为标识,
 *   每个独立进行」+「工单号+工单行号 就为当前的**一个新的单**的模式」):
 *   **一个标识 ⇒ 一张新领料单**;plang 里同一标识可能有多个物理行(同订单行分批转单,批次号不同),
 *   按用户口径它们是同一个标识 ⇒ 只转一张(故计数/去重都用 (工单号,工单行号),**不是** 行id)。
 * ⚠ **明细留空**:MES 自建 BOM 已下架(2026-10-04),配方/工艺清单表全空、遗留 mate 是光缆旧数据,
 *   系统内没有可自动展开的材料来源 ⇒ 材料行由仓库在材料出库单面板按实发补填。
 * 后端守卫:未排产(排产数量 0)/已结案 不给转;该标识已有未审核领料单时拒绝
 *   (见 WorkOrderPickingService,守卫按 (加工单号,工单行号) 判)。
 */
async function toPicking() {
  // 只认**当前列表里还在的**勾选行(表格开了 reserve-selection,已消失的行会留在 checked 里,同切单口径)
  const alive = (checked.value || []).filter((x) => rows.value.some((r) => String(r.行id) === String(x.行id)))
  if (!alive.length) { ElMessage.warning(tt('请先勾选一张工单')); return }
  // 计数按**标识**去重(标识 = 工单号 + 工单行号;同标识的多物理行只算一个、只转一张)
  const keys = [...new Set(alive.map((r) => `${r.工单号}#${r.工单行号}`))]
  try {
    await ElMessageBox.confirm(
      `${tt('确认为选中的')} ${keys.length} ${tt('个工单行转领料单')}?`,
      tt('转领料单'),
      { confirmButtonText: tt('确认'), cancelButtonText: tt('取消'), type: 'warning' })
  } catch { return }
  try {
    const res = await request.post('/px/workOrderList/toPicking', {
      rows: alive.map((r) => ({ 公司代码: r.公司代码, 工单号: r.工单号, 行id: r.行id, 工单行号: r.工单行号, 批次号: r.批次号 })),
    })
    const d = res.data || {}
    const list = d['单号清单'] || []
    ElMessage.success(`${tt('已生成领料单')} ${list.join('、')}（${tt('材料明细请在材料出库单里补填,审核后自动回写工单领料单号')}）`)
    if ((d['失败行'] || []).length) ElMessage.warning(`${tt('未转成功')}：${d['失败行'].join('; ')}`)
    load()
    // 生成后可直接去材料出库单补材料明细(不强制:也可稍后自己进面板)
    try {
      await ElMessageBox.confirm(
        tt('领料单已生成,现在去「材料出库单」补材料明细吗?'),
        tt('转领料单'),
        { confirmButtonText: tt('去补明细'), cancelButtonText: tt('稍后'), type: 'success' })
    } catch { return }
    const path = '/panelx/list/MATERIAL_OUT'
    router.push(path)
    tabs.open({ path, title: '材料出库单' })
  } catch (e) { err(e, '转领料单失败') }
}

/** 切单(9.29 批次①):勾选/当前行必须恰为一张工单 → 后端预览可切上限 → 弹窗输入切出数量 */
function splitTarget() {
  // 2026-10-05 修复「撤回切单后一直提示请勾选一个工单」:表格开了 reserve-selection,
  // 被撤回的子单行已从列表消失、但勾选状态仍留在 checked 里(且无法取消)→ checked.length≠1 永久卡死。
  // 口径:只认**当前列表里还在的**选中行(按 行id);没有则退回当前行(currentRow)。
  const alive = (checked.value || []).filter((x) => rows.value.some((r) => String(r.行id) === String(x.行id)))
  const cur = currentRow.value && rows.value.some((r) => String(r.行id) === String(currentRow.value.行id)) ? currentRow.value : null
  const list = alive.length ? alive : (cur ? [cur] : [])
  if (list.length !== 1) {
    ElMessage.warning(list.length === 0 ? tt('请先勾选一张工单')
      : `${tt('请只勾选一张工单')}（${tt('当前已勾选')} ${list.length} ${tt('张')}）`)
    return null
  }
  return list[0]
}

async function openSplit() {
  const r = splitTarget()
  if (!r) return
  try {
    const res = await request.post('/px/workOrderList/splitPreview', {
      行id: r.行id, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号,
    })
    splitInfo.value = res.data || {}
    splitQty.value = 0
    splitVisible.value = true
  } catch (e) { err(e, '切单失败') }
}

async function doSplit() {
  if (!splitInfo.value) return
  const q = Number(splitQty.value) || 0
  if (q <= 0) { ElMessage.warning(tt('请输入切出数量')); return }
  try {
    await ElMessageBox.confirm(
      `${tt('确认从')} ${splitInfo.value['工单号']} ${tt('切出')} ${num(q)} ${tt('生成子工单')}?`,
      tt('切单'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  splitLoading.value = true
  try {
    const res = await request.post('/px/workOrderList/split', {
      行id: splitInfo.value['行id'], 工单号: splitInfo.value['工单号'], 工单行号: splitInfo.value['工单行号'],
      批次号: splitInfo.value['批次号'], 切出数量: q, 继承排产: splitInherit.value,
    })
    const d = res.data || {}
    splitVisible.value = false
    ElMessage.success(`${tt('已生成子工单')} ${d['子工单号']}（${tt('切出')} ${num(d['切出数量'])}）`)
    load()
  } catch (e) { err(e, '切单失败') } finally { splitLoading.value = false }
}

/** 撤回切单:仅「切出来的子工单」可撤回;后端再校验无报工/入库/领料/结案/再切分 */
async function onUnsplit() {
  const r = splitTarget()
  if (!r) return
  if (!r.源工单号) { ElMessage.warning(tt('该工单不是切出的子工单,无需撤回')); return }
  try {
    await ElMessageBox.confirm(
      `${tt('撤回切单')} ${r.工单号}?${tt('将还原父工单')} ${r.源工单号} ${tt('的数量')}`,
      tt('撤回切单'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消'), type: 'warning' })
  } catch { return }
  try {
    // 两把键都带上(标识 = 工单号 + 工单行号):后端优先 行id,缺了按 (工单号+行号) 反查
    const res = await request.post('/px/workOrderList/unsplit', { 行id: r.行id, 工单号: r.工单号, 工单行号: r.工单行号 })
    const d = res.data || {}
    ElMessage.success(`${tt('已撤回')} ${d['子工单号']}，${tt('父工单')} ${d['父工单号']} ${tt('还原')} ${num(d['还原数量'])}`)
    load()
  } catch (e) { err(e, '撤回切单失败') }
}

function openTrace(row) {
  // 工单详情·追溯(2026-10-05):与工单排产**同一个弹窗组件**,本页原地打开(用户口径「不是跳转到工单排产」)。
  // 行级口径(2026-10-15):必须把**工单行id**一起传下去 —— 同工单号可有多行/多批次,
  //   只传单号会把别的行的报工/检验数据一起带出来(用户报障)。
  const src = row || currentRow.value || checked.value[0]
  const no = src?.['工单号']
  if (!no) return
  traceNo.value = no
  traceRowId.value = src?.['行id'] ?? null
  traceVisible.value = true
}

function exportCsv() {
  const head = ['公司代码', '工单号', '工单行号', '批次号', '单据日期', '转单时间', '物料编码', '产品名称', '规格型号', '客户', '生产线', '需求数量', '转单数量', '入库数量', '余量', '领料单号', '打印人', '打印时间', '生产状态', '结案']
  const csv = '\ufeff' + [head.join(',')]
    .concat(filtered.value.map((r) => head.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `工单排产列表-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

/** 本机时区的 yyyy-MM-dd(偏移 n 天;n=0 为今天) */
function dayStr(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(() => {
  // 默认只取最近 15 天(可在日期框上清空 → 全量);已填过值(如热更重挂)不覆盖用户输入
  if (!dateFrom.value && !dateTo.value) {
    dateFrom.value = dayStr(-(DEFAULT_WINDOW_DAYS - 1))
    dateTo.value = dayStr(0)
  }
  load(); loadLines()
})
</script>

<style scoped>
.wol-page { padding: 8px 12px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #fff; overflow: auto; }
.wol-query, .wol-btns, .wol-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wol-query { padding: 6px 0; border-bottom: 1px solid #eee; }
.wol-lb { font-size: 13px; color: #606266; }
.wol-sep { color: #909399; }
.wol-count { margin-left: auto; font-size: 13px; color: #303133; }
.wol-table { flex: 1; min-height: 0; }
.wol-closed { color: #f56c6c; font-weight: 600; }
.wol-split { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.wol-split-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.wol-split-row > span:first-child { color: #909399; }
.wol-split-row.hl b { color: #e6a23c; font-size: 15px; }
.wol-split-tip { color: #909399; font-size: 12px; line-height: 1.5; border-top: 1px dashed #ebeef5; padding-top: 8px; }
</style>
