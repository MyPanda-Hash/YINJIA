<!-- OrderConvert.vue — 订单结转·发单工作台(《订单结转实现方案-V1.0》2026-09-22)
     定位:发单调度台——判断+生成单据+跳转;生成的加工单/采购申请是标准面板单据,后续按面板↔面板流转。
     防重复:行级占用链(剩余=需求−已排产−已采购),转满自动消失,删下游草稿自动回现;不改销售订单状态。

     2026-10-06 用户口径(显示问题修复):
       ①左上角加**日期查询**:默认「单日 = 今天」,可切 近3/7/14/30 天;
         —— 此前无日期条件,一进页面就把**全部历史**待结转行拉回来,数据一多页面卡死(用户报障原文);
       ②**今天没有待结转数据时弹窗询问**是否跳到最近有数据的一天(不静默跳转;取消则停在当天,空表给近路按钮);
       ③列表**分页**(默认 100/页),几千行也不会一次全渲染;勾选跨页保留(row-key + reserve-selection);
       ④汇总条「当前数据笔数」随日期/关键字口径联动(未结转汇总仍是全量积压,口径不变)。

     2026-10-29 用户口径(本轮):
       ①左上角日期查询由「单日/近N天档位」改为**日期范围选择**(daterange,自带今日/本周/本月/近7天/近30天/上月快捷档,
         默认 [今天,今天] 保住"打开只看一天"的口径;后端 dateFrom/dateTo 不变);
       ②工具栏加**「列设置」**:勾选决定表格显示哪些列(如不想看「客户订单号」就取消勾选),
         复用系统级列设置实现 useReportColumns + /px/reportColumnSettings(panelCode=ORDER_CONVERT,刷新后仍生效);
       ③「型号」列旁新增**「产品名称」**列(订单行 存货名称,与订单资料堆叠格同源);
       ④「订单资料」右侧新增**「物料编码」**单列(订单行 存货编码;堆叠格小字保留,列可随列设置显隐)。 -->
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

    <!-- 工具栏:左上角日期范围查询(2026-10-29 用户口径:由「单日/近N天档位」改成**日期范围选择**)
         + 查询条件 + 动作 + 列设置(显/隐) -->
    <el-form inline class="oc-bar" @submit.prevent>
      <el-form-item :label="tt('日期范围')">
        <el-date-picker v-model="datePick" type="daterange" unlink-panels value-format="YYYY-MM-DD"
                        size="small" class="oc-daterange" :clearable="false"
                        :start-placeholder="tt('开始日期')" :end-placeholder="tt('结束日期')"
                        :shortcuts="dateShortcuts" @change="onQuery" />
      </el-form-item>
      <el-form-item :label="tt('查询条件')">
        <el-input v-model="keyword" :placeholder="tt('订单号 / 客户 / 物料')" clearable style="width: 200px" @keyup.enter="onQuery" />
      </el-form-item>
      <el-button type="primary" @click="onQuery">{{ tt('查询') }}</el-button>
      <el-button :loading="loading" @click="onQuery">{{ tt('刷新') }}</el-button>
      <!-- 页面级权限(2026-10-16):保存交期=页面面板「修改交期」动作词(date),
           选路线/转工单=「转工单」(convert);无该词的角色不显示按钮,后端同口径 403。 -->
      <el-button v-if="canDates" type="danger" plain :disabled="!dateChanged.length" @click="saveDates">
        {{ tt('保存交期') }}（{{ dateChanged.length }}）
      </el-button>
      <el-button v-if="canConvert" :disabled="!checked.length" @click="openRouteDialog">{{ tt('选择工艺路线') }}（{{ checked.length }}）</el-button>
      <el-button v-if="canConvert" type="success" :disabled="!checked.length" @click="toManu">{{ tt('转工单') }}（{{ checked.length }}）</el-button>
      <!-- 列设置(2026-10-29 用户口径「什么查看什么不查看」):勾选决定表格显示哪些列,
           与报表栏目设置同一套后端持久化(/px/reportColumnSettings,panelCode=ORDER_CONVERT) -->
      <el-button plain @click="openDialog">{{ tt('列设置') }}</el-button>
      <span class="oc-count">{{ tt('共有数据') }}: <b>{{ rows.length }}</b> {{ tt('条') }}</span>
    </el-form>

    <!-- 待结转表(分页渲染:一页最多 pageSize 行,数据再多也不卡) -->
    <div class="oc-table">
      <el-table ref="tableRef" :data="pagedRows" size="small" border height="100%" row-key="rowKey" v-loading="loading"
                @selection-change="onCheck">
        <el-table-column type="selection" width="42" reserve-selection />
        <el-table-column :label="tt('订单资料')" width="240" fixed>
          <template #default="{ row }">
            <div class="oc-strong">{{ row.订单号 }}</div>
            <div class="oc-dim">{{ row.物料编码 }}</div>
            <div class="oc-dim">{{ row.品名 }}</div>
          </template>
        </el-table-column>
        <!-- 物料编码单列(2026-10-29 用户口径「当前表格列还应该增加有物料编码」):
             订单行 存货编码;「订单资料」堆叠格里仍保留小字(紧凑识别用),本列可随「列设置」显隐/单独看 -->
        <el-table-column v-if="colVisible('物料编码')" :label="tt('物料编码')" prop="物料编码" width="130" show-overflow-tooltip />
        <el-table-column v-if="colVisible('行号')" :label="tt('行号')" prop="行号" width="70" />
        <el-table-column v-if="colVisible('下单日期')" :label="tt('下单日期')" prop="下单日期" width="100" />
        <el-table-column :label="tt('交货日期')" width="150" fixed="left">
          <template #default="{ row }">
            <el-date-picker v-model="row.交货日期" type="date" value-format="YYYY-MM-DD" size="small"
                            style="width: 130px" :class="{ 'oc-date-dirty': row.交货日期 !== row.交货日期原始 }"
                            :disabled="!canDates"
                            :title="tt('同步交期常与创建日期雷同，可在此修正；保存交期或转单时回写订单行')" />
          </template>
        </el-table-column>
        <el-table-column v-if="colVisible('客户')" :label="tt('客户')" prop="客户" min-width="160" show-overflow-tooltip />
        <el-table-column v-if="colVisible('客户等级')" :label="tt('客户等级')" prop="客户等级" width="90" />
        <!-- 产品名称(2026-10-29 用户口径「在当前的型号旁边增加产品名称」):取订单行 存货名称,
             与「订单资料」堆叠格里的小字同源;单列后可随「列设置」显隐 -->
        <el-table-column v-if="colVisible('产品名称')" :label="tt('产品名称')" prop="产品名称" width="170" show-overflow-tooltip />
        <el-table-column v-if="colVisible('型号')" :label="tt('型号')" prop="型号" width="120" show-overflow-tooltip />
        <el-table-column v-if="colVisible('重点管控')" :label="tt('重点管控')" prop="重点管控" width="90" />
        <el-table-column v-if="colVisible('客户订单号')" :label="tt('客户订单号')" prop="客户订单号" width="120" show-overflow-tooltip />
        <el-table-column v-if="colVisible('需求数量')" :label="tt('需求数量')" prop="需求数量" width="100" align="right" />
        <el-table-column v-if="colVisible('已排产数量')" :label="tt('已排产数量')" width="105" align="right">
          <template #default="{ row }">
            <span :class="{ 'oc-blue': Number(row.已排产数量) > 0 }">{{ row.已排产数量 }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('剩余数量')" width="100" align="right" fixed="right">
          <template #default="{ row }">
            <span class="oc-strong">{{ row.剩余数量 }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('工艺路线')" width="180" fixed="right">
          <template #default="{ row }">
            <!-- 用户口径(2026-10-05):**在订单结转处选择工序路线** —— 预填产品绑定,可逐行改;
                 转单时原样带入工单(plang.工艺路线),之后排产/详情一律按这条路线解释"走到哪一步"。
                 2026-10-16 用户口径「工艺路线需要被审核完成后才能被使用」:未审核的路线标红 + 行内提示，
                 转工单按钮对含未审核路线的行一并禁用(后端同口径拒绝)。
                 2026-10-25 条39:预填优先级=上次>绑定(applyRouteDefaults 整行写入);按上次带出的行
                 加「上次」小标,tooltip 带出来源工单+日期。
                 2026-10-29 增族兜底:同物料没历史时按「同品名同规格」的兄弟编码带出,小标写「同规格上次」,
                 与单物料的「上次」区分开(两者 tooltip 文案不同)。 -->
            <span :class="row.工艺路线 && row.路线审核状态 === '已审核' ? 'oc-blue' : 'oc-warn'"
                  :title="routeAuditTip(row)">{{ row.工艺路线 || '-' }}</span>
            <div v-if="row.路线来源 === 'last'" class="oc-last">{{ tt('上次') }}</div>
            <div v-else-if="row.路线来源 === 'spec'" class="oc-last">{{ tt('同规格上次') }}</div>
          </template>
        </el-table-column>
        <el-table-column :label="tt('本次转单数量')" width="125" fixed="right">
          <template #default="{ row }">
            <el-input-number v-model="row.生单数量" :min="0" :max="Number(row.剩余数量)" :controls="false" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <!-- 空表提示:所选区间确实没有待结转单 —— 给"跳到最近有数据的一天"/"看近7天"两条近路
             (打开页面时的跳转是**弹窗询问**,用户点了「留在本日」才落到这里) -->
        <template #empty>
          <div class="oc-empty">
            <span>{{ tt('该日期范围没有待结转数据') }}</span>
            <el-button v-if="latestDay && !latestInRange" link type="primary" @click="jumpToLatest">
              {{ tt('跳到最近有数据的一天') }} {{ latestDay }}
            </el-button>
            <el-button link type="primary" @click="quickNear(7)">{{ tt('看近7天') }}</el-button>
          </div>
        </template>
      </el-table>

    <!-- 工艺路线选择弹窗(2026-10-05 用户口径:路线多时下拉不现实 ⇒ 弹窗;支持编码/名称过滤,列出工序序列) -->
    <el-dialog v-model="routeDialog" :title="tt('选择工艺路线')" width="660px" append-to-body>
      <el-input v-model="routeKw" :placeholder="tt('编码 / 名称')" clearable style="width: 220px; margin-bottom: 8px" />
      <div class="oc-route-note">{{ tt('仅「已审核」的工艺路线可用于转工单（未审核的路线置灰，需先在「基础设置→工艺路线」完成审核）') }}</div>
      <el-table :data="routeFiltered" size="small" border height="330" highlight-current-row
                @current-change="(r) => (routePick = r)" @row-dblclick="applyRoute" :row-class-name="routeRowCls">
        <el-table-column :label="tt('编码')" prop="编码" width="140" />
        <el-table-column :label="tt('名称')" prop="名称" width="170" show-overflow-tooltip />
        <el-table-column :label="tt('工序序列')" prop="工序序列" min-width="220" show-overflow-tooltip />
        <el-table-column :label="tt('工序数')" prop="工序数" width="80" align="right" />
        <el-table-column :label="tt('审核状态')" width="100" align="center">
          <template #default="{ row }">
            <span :class="row.审核状态 === '已审核' ? 'oc-blue' : 'oc-warn'">{{ tt(row.审核状态 || '未审核') }}</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <span class="oc-route-tip">{{ tt('将对勾选的') }} {{ checked.length }} {{ tt('行应用该路线(双击行亦可)') }}</span>
        <el-button @click="routeDialog = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :disabled="!routePick || routePick.审核状态 !== '已审核'" @click="applyRoute">{{ tt('确定') }}</el-button>
      </template>
    </el-dialog>

    <!-- 列设置弹窗(2026-10-29):通用组件,显隐草稿由 useReportColumns 持有,
         保存走 /px/reportColumnSettings(panelCode=ORDER_CONVERT),刷新后仍按保存的显隐渲染。
         关闭/取消 = 丢弃未保存的勾选(回到后端已保存那份),否则"取消"后表格已经被改了 -->
    <ColumnSettingsDialog :model-value="columnVisible" :columns="columnDraft"
                          @update:model-value="onColumnDialogToggle"
                          @toggle="onColToggle" @reset="resetDraft" @save="saveColumns" />
    </div>

    <div class="oc-pager">
      <!-- size="small" 取代布尔 small(2026-10-19):布尔值在 Element Plus 3.0 会废弃 -->
      <el-pagination size="small" background layout="total, sizes, prev, pager, next, jumper"
                     :total="rows.length" v-model:current-page="pageNo" v-model:page-size="pageSize"
                     :page-sizes="[50, 100, 200, 500]" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { canDo } from '@core/auth/panelAccess'
import { useReportColumns } from '@core/report/useReportColumns'
import { PRESETS, presetRange } from '@core/dashboard/dateRange'
import ColumnSettingsDialog from '@core/views/ColumnSettingsDialog.vue'
import { applyRouteDefaults } from '@/business/routeDefaults'

/**
 * 页面级权限(2026-10-16):本页挂页面面板 ORDER_CONVERT
 * (可见/查询/修改交期/转工单,词表见后端 PagePanelRegistry)。
 * 无权限的按钮直接不显示;后端 /px/orderConvert/* 按同一份 perms 复核。
 */
const user = useUserStore()
const canDates = computed(() => canDo(user, 'ORDER_CONVERT', 'date'))
const canConvert = computed(() => canDo(user, 'ORDER_CONVERT', 'convert'))

const keyword = ref('')
const loading = ref(false)
const pageNo = ref(1)
const pageSize = ref(100)
/** 可选工艺路线(弹窗选择,2026-10-05):来自 bs_route,含工序序列 */
const routeOptions = ref([])
const routeDialog = ref(false)
const routeKw = ref('')
const routePick = ref(null)
const routeFiltered = computed(() => routeOptions.value.filter((r) =>
  !routeKw.value || String(r.编码 || '').includes(routeKw.value) || String(r.名称 || '').includes(routeKw.value)))
async function loadRoutes() {
  try { routeOptions.value = (await request.post('/px/processTask/routes', {})).data || [] } catch { routeOptions.value = [] }
}
function openRouteDialog() { routePick.value = null; routeKw.value = ''; routeDialog.value = true }
/** 行样式:未审核的工艺路线整行置灰(2026-10-16) */
function routeRowCls({ row }) { return row.审核状态 === '已审核' ? '' : 'oc-row-warn' }
/** 把弹窗里选中的路线应用到**勾选行**(批量;未勾选则不动) */
function applyRoute() {
  const rt = routePick.value
  if (!rt) return
  // 未审核的路线不给应用(2026-10-16 用户口径「工艺路线需要被审核完成后才能被使用」)
  if (rt.审核状态 !== '已审核') {
    ElMessage.warning(tt('该工艺路线尚未审核，不能用于转工单；请先在「基础设置→工艺路线」完成审核') + '：' + rt.编码)
    return
  }
  for (const r of checked.value) { r.工艺路线 = rt.编码; r.路线审核状态 = '已审核' }
  ElMessage.success(`${tt('已为')} ${checked.value.length} ${tt('行设置工艺路线')} ${rt.编码}`)
  routeDialog.value = false
}
const rows = ref([])
const checked = ref([])
const tableRef = ref(null)
const s = ref({})

/** 行内修改过交期(与原始值比对)的行 */
const dateChanged = computed(() => rows.value.filter((r) => r.交货日期 && r.交货日期 !== r.交货日期原始))

// ── 表格列设置「什么查看什么不查看」(2026-10-29 用户口径)────────────────────────────
// 复用系统级实现:useReportColumns(列显隐 + 后端持久化 /px/reportColumnSettings,panelCode=ORDER_CONVERT)。
// 弹窗里只放**可隐藏列**;以下列永远显示(它们是本页的操作与判断依据,隐藏后按钮点不了/看不出为何不能转单):
//   选择框 / 订单资料 / 交货日期(可就地改) / 剩余数量 / 工艺路线(必选) / 本次转单数量(必填)。
const COLUMNS = [
  '物料编码', '行号', '下单日期', '客户', '客户等级', '产品名称', '型号', '重点管控', '客户订单号', '需求数量', '已排产数量',
]
const {
  columnVisible, columnDraft, visibleProps,
  openDialog, saveDialog, cancelDialog, init: initColumns, resetDraft,
} = useReportColumns(ref('ORDER_CONVERT'), computed(() => COLUMNS), rows)

/** 某列当前是否显示(读取后端已保存的显隐;未保存过 = 全部显示) */
function colVisible(prop) { return visibleProps.value.includes(prop) }
/** 勾选/取消勾选:只改草稿,点弹窗「保存」才落后端 */
function onColToggle({ prop, visible }) {
  const col = columnDraft.value.find((c) => c.prop === prop)
  if (col) col.visible = visible
}
/**
 * 弹窗开/关:关(取消按钮或右上角 X)= **丢弃未保存的勾选**,回到后端已保存那份。
 * 不这么做的话,草稿即生效(visibleProps 从草稿派生)⇒ 点「取消」列也已经被改掉了。
 */
function onColumnDialogToggle(open) {
  if (open) { columnVisible.value = true; return }
  cancelDialog()
}
/** 保存列设置(后端按 panelCode 存一份,刷新/换浏览器都生效;失败如实提示,不谎报「已保存」) */
async function saveColumns() {
  const ok = await saveDialog()
  if (ok) ElMessage.success(tt('已保存'))
  else ElMessage.warning(tt('保存失败'))
}

// ── 日期范围查询(2026-10-29 用户口径:左上角由「单日/近N天档位」改为**日期范围选择**) ──
// 本地日期算,不走 UTC,避免时区把"今天"算偏一天;默认 [今天, 今天],与旧「默认单日=今天」口径一致。
const pad2 = (n) => String(n).padStart(2, '0')
const fmtDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const todayStr = () => fmtDay(new Date())
function parseDay(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }
/** 日期 ±n 天(yyyy-MM-dd 进、同格式出) */
function shiftDay(day, n) { const d = parseDay(day); d.setDate(d.getDate() + n); return fmtDay(d) }

/** 日期框绑定值:['开始','结束'](value-format=YYYY-MM-DD) */
const datePick = ref([todayStr(), todayStr()])

/** 生效区间(含端点):两值兜底成合法日期 + 反序自动交换(用户先点结束日后点开始日不丢条件) */
const range = computed(() => {
  const a = String((datePick.value || [])[0] || '').slice(0, 10)
  const b = String((datePick.value || [])[1] || '').slice(0, 10)
  const from = /^\d{4}-\d{2}-\d{2}$/.test(a) ? a : todayStr()
  const to = /^\d{4}-\d{2}-\d{2}$/.test(b) ? b : from
  return from <= to ? { from, to } : { from: to, to: from }
})
const rangeText = computed(() => (range.value.from === range.value.to ? range.value.from : `${range.value.from} ~ ${range.value.to}`))

/** 日期框内的快捷档(今日/本周/本月/近7天/近30天/上月;文案走 tt,复用看板同一份 PRESETS) */
const dateShortcuts = computed(() => PRESETS.map((p) => ({
  text: tt(p.label),
  value: () => { const r = presetRange(p.key); return [parseDay(r.from), parseDay(r.to)] },
})))

/** 当前页数据(前端分页:渲染行数封顶,勾选跨页保留) */
const pagedRows = computed(() => {
  const start = (pageNo.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})

function queryBody() {
  return { keyword: keyword.value, dateFrom: range.value.from, dateTo: range.value.to }
}

async function loadPending() {
  loading.value = true
  try {
    const res = await request.post('/px/orderConvert/pending', queryBody())
    rows.value = (res.data || []).map((r) => ({
      ...r,
      交货日期: r.交货日期 || '',
      交货日期原始: r.交货日期 || '',
      生单数量: Number(r.剩余数量) || 0,
      rowKey: `${r.订单号}#${r['行id']}`,
    }))
    // 条39「转工单带上次工艺路线」(2026-10-25 定稿方案 v2):
    // 整行写入语义(冷读#1 拍板)= 每行按 default=上次(须 ∈ bs_route 候选)>绑定>空 **计算后整行写入**;
    // 此刻行刚由后端返回,无用户编辑可覆盖。routeSet 取自 routeOptions(bs_route 编码集合),
    // loadRoutes 失败 ⇒ routeSet 空 ⇒ 「上次」静默不预填(保守失效无害:绑定预填仍在,页面照常)。
    const routeSet = new Set(routeOptions.value.map((r) => String(r?.编码 ?? '').trim()).filter(Boolean))
    applyRouteDefaults(rows.value, routeSet)
    pageNo.value = 1
    checked.value = []
    tableRef.value?.clearSelection?.()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('查询失败'))
  } finally {
    loading.value = false
  }
}

/** 汇总条:body 缺省=当前日期/关键字口径(「最新下单日期」无论带不带条件都返回 = 全体待结转行里最近的下单日) */
async function loadStats(body) {
  try {
    const res = await request.post('/px/orderConvert/stats', body || queryBody())
    s.value = res.data || {}
  } catch { /* 汇总失败不阻断列表 */ }
}

/** 最近有数据的一天(后端 stats.最新下单日期;空=一条待结转都没有) */
const latestDay = computed(() => String(s.value['最新下单日期'] || '').slice(0, 10))
/** 最近有数据的一天是否已落在当前查询区间内(在窗口里就不必再提示跳转) */
const latestInRange = computed(() => !!latestDay.value && latestDay.value >= range.value.from && latestDay.value <= range.value.to)

async function loadAll() { await Promise.all([loadPending(), loadStats()]) }
/** 日期范围/关键字变动:回第一页重查(页面默认只查一天,改范围即查) */
function onQuery() { pageNo.value = 1; loadAll() }
/** 「看近N天」:以最近有数据的一天为结束日往前数(当天没数据时也能看到数据,旧口径保留) */
function quickNear(n) {
  const end = latestDay.value || todayStr()
  datePick.value = [shiftDay(end, -(n - 1)), end]
  onQuery()
}
/** 跳到最近有数据的一天(空表近路按钮;与打开页面时的弹窗同一个动作) */
function jumpToLatest() { if (!latestDay.value) return; datePick.value = [latestDay.value, latestDay.value]; onQuery() }

/**
 * 打开页面时当前日期范围里没有待结转数据 → **弹窗询问**是否跳到最近有数据的一天
 * (2026-10-06 用户口径:不要静默跳转;用户点「留在本日」就停在当前区间,空表里另给近路按钮)。
 * 只在首帧调用一次;用户后续自己改日期/刷新不再打扰。
 */
async function askJumpToLatest() {
  if (rows.value.length) return
  const latest = latestDay.value
  // 最近有数据的一天若已在当前区间里,就没必要再问"要不要跳过去"(空表是关键字过滤等其它原因)
  if (!latest || latestInRange.value) return
  try {
    await ElMessageBox.confirm(
      // 标点用半角(与仓库既有组合文案一致:`${tt('生成子工单')}?`),否则英语界面会出现全角「，？」
      `${rangeText.value} ${tt('没有待结转数据')}, ${tt('跳到最近有数据的一天')} ${latest}?`,
      tt('没有数据'), { confirmButtonText: tt('跳转'), cancelButtonText: tt('留在本日'), type: 'info' },
    )
  } catch { return }   // 取消:停在所选区间(空表 + 近路按钮)
  datePick.value = [latest, latest]
  await loadAll()
}
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
  await convert('toManu', '转工单')
}

/** 工艺路线列的气泡提示(2026-10-16:未审核 → 说明为什么不能转工单;
 *  2026-10-25 条39:按上次带出的行追加 来源工单+日期,让用户知道默认值从哪来、可改;
 *  2026-10-29 增族兜底来源:同物料上次 vs 同品名同规格族,文案分开写清口径) */
function routeAuditTip(row) {
  const src = row.路线来源单 ? `\n${row.路线来源单}${row.路线来源日期 ? ' · ' + row.路线来源日期 : ''}` : ''
  const from = row.路线来源 === 'spec'
    ? `\n${tt('按同品名同规格产品上次转单带出，可改')}${src}`
    : row.路线来源 === 'last'
      ? `\n${tt('按同物料上次转单带出，可改')}${src}`
      : ''
  const st = row.路线审核状态
  if (st === '已审核') return row.工艺路线 + from
  if (st === '未选择') return tt('未选择工艺路线，不能转工单')
  return `${row.工艺路线 || ''}\n${tt('该工艺路线未审核，不能转工单；请先在「基础设置→工艺路线」完成审核')}` + from
}

async function convert(api, label) {
  const list = (checked.value || []).filter((r) => Number(r.生单数量) > 0)
  if (!list.length) { ElMessage.warning(tt('请先勾选要结转的订单行')); return }
  // 未选择工艺路线 = 不能转工单(2026-10-05 用户口径):先提示缺失行,直接拦住
  const noRoute = list.filter((r) => !r['工艺路线'])
  if (noRoute.length) {
    ElMessage.warning(tt('有') + ' ' + noRoute.length + ' ' + tt('行未选择工艺路线,不能转工单;请先点工具栏「选择工艺路线」指定') + '：' + noRoute.slice(0, 5).map((r) => r['订单号'] + '#' + r['行号']).join('、'))
    return
  }
  // 🔴 工艺路线必须审核完成后才能被使用(2026-10-16 用户口径):
  //   前端先拦一层(勾了未审核路线的行不给转)，后端 createFromOrderLine.requireRouteAudited 同口径兜底。
  //   只提示、不自动跳过 —— 用户需要知道是"审核"这件事卡住，而不是数量/日期。
  const noAudit = list.filter((r) => r['路线审核状态'] !== '已审核')
  if (noAudit.length) {
    ElMessage.warning(tt('有') + ' ' + noAudit.length + ' '
      + tt('行所选工艺路线尚未审核，不能转工单;请先在「基础设置→工艺路线」对该路线提交审批并通过') + '：'
      + noAudit.slice(0, 5).map((r) => `${r['订单号']}#${r['行号']}(${r['工艺路线']})`).join('、'))
    return
  }
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
        // 转单必须带工艺路线(2026-10-05:后端硬校验;此前漏传被拦「未选择工艺路线」)
        工艺路线: r['工艺路线'] || undefined,
        交货日期: r.交货日期 && r.交货日期 !== r.交货日期原始 ? r.交货日期 : undefined,
      })),
    })
    const d = res.data || {}
    const failed = d['失败行'] || []
    // 2026-10-11 用户拍板:结转只弹首道「确认转工单」框,结果不再弹窗——轻提示带出即可;
    // 新工单即落 plang 入快速排产待排产池(该池已改新单置顶),本页刷新后转满行自动消失
    ElMessage({
      type: 'success',
      message: `${tt('已生成')} ${d['生成张数']} ${tt('张')}：${(d['编号清单'] || []).join('、')}`
        + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''),
      duration: 5000,
      showClose: true,
    })
    loadAll()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('转单失败'))
  }
}

onMounted(async () => {
  // 条39(2026-10-25):先等路线档案到位再拉待结转行 —— applyRouteDefaults 要用 routeOptions
  // 做「上次 ∈ bs_route」候选校验;fire-and-forget 会跟 loadPending 竞态(慢时首屏全部按绑定预填)。
  // loadRoutes 自带 catch:失败 ⇒ routeOptions=[] ⇒ routeSet 空 ⇒ 「上次」静默不预填(页面照常)。
  // 列设置(2026-10-29)同样先应用已保存的显隐,首帧就按用户口径渲染(失败=全部显示,不阻断)。
  await Promise.all([loadRoutes(), initColumns()])
  // 首帧:默认日期范围 = 今天(口径与旧「单日=今天」一致,只是控件换成范围选择)并直接查;
  // 当前区间没有待结转数据时**弹窗询问**是否跳到最近有数据的一天(2026-10-06 用户口径:不静默跳转)。
  // 之前更早的写法是"不带条件拉全量":数据一多,进页面就卡死(同日用户报障)。
  datePick.value = [todayStr(), todayStr()]
  await loadAll()
  await askJumpToLatest()
})
</script>

<style scoped>
.oc-page { padding: 10px 14px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #f9f9f9; overflow: hidden; }
.oc-summary { background: #1e6fb8; color: #fff; padding: 8px 12px; border-radius: 4px; font-size: 13px; line-height: 1.6; }
.oc-sep { opacity: .8; }
.oc-bar { margin: 0; background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 6px 10px 0; }
/* 日期范围选择(2026-10-29):两个日期框 + 分隔符,约 250px */
.oc-daterange { width: 260px; }
.oc-count { margin-left: 12px; color: #606266; font-size: 12px; }
.oc-table { flex: 1; min-height: 0; }
.oc-pager { display: flex; justify-content: flex-end; }
.oc-empty { color: #909399; font-size: 13px; }
.oc-strong { font-weight: 600; color: #303133; }
.oc-dim { color: #909399; font-size: 12px; }
.oc-blue { color: #1e6fb8; font-weight: 600; }
.oc-orange { color: #e6a23c; font-weight: 600; }
/* 未审核的工艺路线(2026-10-16 用户口径「审核完成后才能被使用」):红字提示 */
.oc-warn { color: #f56c6c; font-weight: 600; }
/* 条39(2026-10-25):工艺路线按「上次」带出的小标 */
.oc-last { font-size: 11px; color: #e6a23c; line-height: 1.4; }
.oc-route-note { margin-bottom: 6px; font-size: 12px; color: #e6a23c; }
/* 路线弹窗里未审核的行:整行置灰，且不给选中 */
:deep(.oc-row-warn) { color: #c0c4cc; background: #fafafa; }
:deep(.oc-row-warn.el-table__row--current) { background: #fdf6ec; }
:deep(.oc-date-dirty .el-input__wrapper) { box-shadow: 0 0 0 1px #f56c6c inset; }
</style>
