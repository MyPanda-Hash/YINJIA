<!-- WorkOrderBoard.vue — 工单排产(2026-09-23 纠偏,替代「生产排产」平铺看板,参考旧系统工单排产页)
     产线骨架:左侧=生产线档案**全部线**(与基础资料对应,停用线标记可查看);选中线 → 右侧正在运行的工单明细
     (未完工/已完工/全部);勾选已排 → 批量调线(启用线)/转领料(默认 BOM×排产数量 生成领料单草稿,2026-10-14)。
     无班别维度(用户拍板)。开线管理已按用户拍板去除(2026-09-24):本页只做 按线查看+调线+转领料,不含待排产池(排产入口单一=排产工作台)。 -->
<template>
  <div class="wb-page">
    <!-- 顶部:开工日期 + 汇总条 -->
    <div class="wb-top">
      <span class="wb-title">{{ tt('工单排产') }}</span>
      <span class="wb-p">{{ tt('开工日期') }}
        <el-date-picker v-model="day" type="date" value-format="YYYY-MM-DD" style="width: 135px" @change="loadAll" />
      </span>
      <!-- 刷新(2026-10-17 用户口径):本页此前只有切开工日期才会重新取数,而左侧骨架/明细/汇总
           都依赖别处(快速排产排入、生产工单结案、报工)的写入 —— 加一个手动刷新按钮,
           一次重取 骨架+按线明细+汇总条 三处(与快速排产页「刷新」同口径,只读查看,归「可见」动作)。 -->
      <el-button size="small" :loading="loading" @click="loadAll">{{ tt('刷新') }}</el-button>
      <span class="wb-stats">
        {{ tt('待排产') }}（{{ s['待排产笔数'] ?? 0 }}{{ tt('笔') }}）；{{ tt('今日排产') }}（{{ s['今日排产']?.张数 ?? 0 }}{{ tt('张') }}/{{ num(s['今日排产']?.数量) }}{{ tt('件') }}）；{{ tt('总未完成量') }} {{ num(s['总未完成量']) }}
      </span>
      <!-- 产能可见(2026-10-31 用户口径「产能只显示、不拦截」):全部启用线今天「已排>日产能」的汇总。
           只提示 —— 不弹窗、不改数、不禁填。 -->
      <span class="wb-over" :class="{ hot: overLineCount > 0 }">
        {{ tt('今日超载') }} {{ overLineCount }} {{ tt('条线') }}<template v-if="overQty > 0">，{{ tt('合计超') }} {{ num(overQty) }}</template>
      </span>
    </div>

    <div class="wb-body">
      <!-- 左:各线 未交量(=基础资料生产线档案,含停用) -->
      <div class="wb-left">
        <div class="wb-left-head">{{ tt('工序/工艺') }} / {{ tt('生产线') }}</div>
        <!-- 按工序/工艺分组(2026-10-05,依《新系统产线命名.xlsx》):分发维度=生产线,功能分组=成型/切炭/组装 -->
        <template v-for="g in lineGroups" :key="g.车间">
          <div class="wb-shop-group">{{ tt(g.车间) }}<span class="wb-shop-cnt">{{ g.lines.length }}</span></div>
          <div v-for="l in g.lines" :key="l.生产线" class="wb-line"
               :class="{ active: sel.line === l.生产线, off: l.停用 }" @click="select(l)">
            <div class="wb-line-name">
              {{ l.生产线 }}
              <span v-if="l.停用" class="wb-tag off-line">{{ tt('停用') }}</span>
            </div>
            <div class="wb-line-row">
              <span class="wb-qty">{{ num(l.未交量) }}</span>
              <!-- 今日已排/日产能(2026-10-31):只显示、不拦截;未配产能的线明确写"未配",不显示 0 -->
              <span v-if="Number(l.日产能 || 0) > 0" class="wb-daycap"
                    :class="{ over: l.今日余量 != null && Number(l.今日余量) < 0 }"
                    :title="tt('今日已排/日产能/今日余量')">
                {{ num(l.今日已排) }}/{{ num(l.日产能) }}
              </span>
              <span v-else class="wb-daycap unset" :title="tt('产线档案未配日产能')">{{ tt('未配产能') }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- 右:选中线正在运行的工单明细 -->
      <div class="wb-main">
        <div class="wb-ctx">
          <span class="wb-ctx-label">{{ tt('生产线') }}：<b>{{ sel.line || tt('（点击左侧选择）') }}</b>
            <span v-if="shop" class="wb-shop">{{ tt('当前车间') }}：{{ shop }}</span>
          </span>
          <span class="wb-ctx-stats">
            {{ tt('排产数量') }} {{ num(selQty) }}　|　{{ tt('未完工量') }} {{ num(selOutstanding) }}
          </span>
        </div>

        <div class="wb-block">
          <div class="wb-head">
            <span class="wb-block-title">{{ tt('排产明细') }}——{{ sel.line || '-' }}</span>
            <el-radio-group v-model="scope" size="small" @change="onScope">
              <el-radio-button value="未完工">{{ tt('未完工') }}</el-radio-button>
              <el-radio-button value="已完工">{{ tt('已完工') }}</el-radio-button>
              <el-radio-button value="全部">{{ tt('全部') }}</el-radio-button>
            </el-radio-group>
            <div class="wb-actions">
              <!-- 日排产(2026-10-29):只保留「保存日排产」;日期列由后端按数据生成
                   (2026-10-30 用户口径「把当前这个按日期均摊的功能删除,没啥用」⇒ 均摊按钮与弹窗已删除) -->
              <el-button v-if="canDayPlan" size="small" type="success" plain :disabled="planDirtyCount === 0" @click="savePlan">
                {{ tt('保存日排产') }}（{{ planDirtyCount }}）
              </el-button>
              <el-button v-if="canDo('unclose')" size="small" type="danger" plain :disabled="!checkedSched.length" @click="unclose">
                {{ tt('取消结案') }}（{{ checkedSched.length }}）
              </el-button>
              <el-button size="small" type="primary" plain :disabled="checkedSched.length !== 1" @click="openTrace">
                {{ tt('追溯') }}
              </el-button>
              <el-dropdown v-if="canDo('print')" split-button size="small" type="success" plain :disabled="!checkedSched.length"
                           @click="printTask('成型生产任务单')" @command="printTask">
                {{ tt('打印工单') }}（{{ checkedSched.length }}）
                <template #dropdown>
                  <el-dropdown-item command="成型生产任务单">{{ tt('成型生产任务单') }}</el-dropdown-item>
                  <el-dropdown-item command="切炭生产任务单">{{ tt('切炭生产任务单') }}</el-dropdown-item>
                  <el-dropdown-item command="组装生产任务单">{{ tt('组装生产任务单') }}</el-dropdown-item>
                </template>
              </el-dropdown>
              <el-button v-if="canDo('transfer')" size="small" type="warning" plain :disabled="!checkedSched.length" @click="openReassign">
                {{ tt('调拨') }}（{{ checkedSched.length }}）
              </el-button>
              <el-button v-if="canDo('revoke')" size="small" plain :disabled="!checkedSched.length" @click="doTransferRevoke">
                {{ tt('撤回调拨') }}
              </el-button>
              <!-- 「转领料」已随 MES 自建 BOM 下架移除(2026-10-04):它按 默认BOM×排产数量 生成领料单草稿,
                   数据源 bs_bom 与后端 /px/scheduleBoard/toPicking 端点同期删除 ⇒ 按钮一并撤掉 -->
            </div>
          </div>
          <el-table :data="schedRows" size="small" border height="100%" empty-text=""
                    @selection-change="(r) => (checkedSched = r)">
            <el-table-column type="selection" width="42" />
            <el-table-column :label="tt('工单号')" prop="加工单号" width="150" fixed />
            <el-table-column :label="tt('工单行号')" prop="工单行号" width="90" sortable />
            <el-table-column :label="tt('客户')" prop="客户" min-width="130" fixed show-overflow-tooltip />
            <el-table-column :label="tt('排产日期')" prop="排产日期" width="95" />
            <el-table-column :label="tt('客户PO')" prop="客户PO" width="110" show-overflow-tooltip />
            <el-table-column :label="tt('物料编码')" prop="物料编码" width="110" show-overflow-tooltip />
            <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="140" show-overflow-tooltip />
            <el-table-column :label="tt('规格型号')" prop="规格型号" width="110" show-overflow-tooltip />
            <el-table-column :label="tt('单位')" prop="单位" width="55" />
            <el-table-column :label="tt('批号')" prop="批号" width="100" show-overflow-tooltip />
            <el-table-column :label="tt('重点管控')" prop="重点管控" width="80" />
            <el-table-column :label="tt('开工日期')" prop="开工日期" width="95" />
            <el-table-column :label="tt('计划完工日期')" prop="计划完工日期" width="105" />
            <el-table-column :label="tt('实际完工日期')" prop="实际完工日期" width="105" />
            <el-table-column :label="tt('排产数量')" prop="排产数量" width="90" align="right" />
            <el-table-column :label="tt('需求数量')" prop="需求数量" width="90" align="right" />
            <el-table-column :label="tt('入库数量')" prop="入库数量" width="90" align="right" />
            <!-- 工序口径:当前工序 = 该行**现在该做的工序**(预排台账位置;在切炭线就显示切炭),
                 旁边给「上道工序 + 上道完工量」= 来料量(上一道已审报工量) -->
            <el-table-column :label="tt('当前工序')" prop="当前工序" width="95" sortable>
              <template #default="{ row }">{{ row.当前工序 ? tt(row.当前工序) : '-' }}</template>
            </el-table-column>
            <el-table-column :label="tt('当前工序计划量')" prop="当前工序计划量" width="120" align="right" />
            <el-table-column :label="tt('当前工序完工量')" prop="当前工序完工量" width="120" align="right" />
            <!-- 日排产(2026-10-29):直接长在现有明细表里(不新增表格/块),紧跟工序完工口径。
                 每个日期格都可填计划(含今天以前的日期 —— 用户口径「23~28 号填不了」);
                 格下方小灰字 = 该天已审核报工量(含手机端),只读。 -->
            <el-table-column :label="tt('交期紧迫度')" prop="交期紧迫度" width="90" align="right" />
            <el-table-column :label="tt('7天需交付')" prop="7天需交付" width="92" align="right" />
            <el-table-column :label="tt('15天需交付')" prop="15天需交付" width="96" align="right" />
            <el-table-column :label="tt('大于15天需交付')" prop="大于15天需交付" width="112" align="right" />
            <el-table-column :label="tt('7天已排')" prop="7天已排" width="88" align="right" />
            <el-table-column :label="tt('15天已排')" prop="15天已排" width="92" align="right" />
            <el-table-column :label="tt('大于15天已排')" prop="大于15天已排" width="108" align="right" />
            <!-- 日期列(2026-10-31):列头多一行「该线当天 已排/日产能」——产能只显示、不拦截录入。
                 超产能只把列头标红(不弹窗、不改数、不禁填);未配产能(档案日产能 0/空)写"未配",不判超载。 -->
            <el-table-column v-for="d in planDates" :key="d" width="88" align="right">
              <template #header>
                <div class="dp-head" :class="{ over: isOverDay(d) }">
                  <div class="dp-date">{{ d.slice(5) }}</div>
                  <div v-if="lineCap > 0" class="dp-cap" :title="tt('该线当天已排/日产能')">
                    {{ qtyText(dayTotal[d]) }}/{{ qtyText(lineCap) }}
                  </div>
                  <div v-else class="dp-cap unset" :title="tt('产线档案未配日产能,不做超载提示')">{{ tt('未配产能') }}</div>
                </div>
              </template>
              <template #default="{ row }">
                <el-input-number v-if="canDayPlan" v-model="row.日计划[d]" size="small"
                                 :controls="false" :min="0" class="dp-input" @change="markCell(row, d)" />
                <span v-else>{{ qtyText((row.日计划 || {})[d]) }}</span>
                <div v-if="(row.日报工 || {})[d]" class="dp-act" :title="tt('当天已审核报工量')">
                  {{ qtyText(row.日报工[d]) }}
                </div>
              </template>
            </el-table-column>
            <!-- 分配完整性(2026-10-31 用户口径「允许只排一部分,但把还差多少摆出来」):
                 未分配量 = 工序计划量 − Σ日计划;只提示,不拦保存、不逼一次排完。 -->
            <el-table-column :label="tt('未分配量')" width="96" align="right">
              <template #default="{ row }">
                <span v-if="unplanned(row) != null" :class="{ 'dp-warn': unplanned(row) > 0 }"
                      :title="tt('已分') + ' ' + qtyText(row.计划合计 || 0) + ' / ' + tt('计划合计') + ' ' + qtyText(row.工序计划量 || 0)">
                  {{ qtyText(unplanned(row)) }}
                </span>
                <span v-else class="dp-unset">-</span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('上道工序')" prop="上道工序" width="95">
              <template #default="{ row }">{{ row.上道工序 ? tt(row.上道工序) : '-' }}</template>
            </el-table-column>
            <el-table-column :label="tt('上道完工量')" prop="上道完工量" width="110" align="right" />
            <!-- 成品口径:未交量 = 排产数量 − 入库数量(此前误减工序口径报工量 ⇒ 换算率 >1 时出负数) -->
            <el-table-column :label="tt('未交量')" prop="未交量" width="85" align="right" />
            <el-table-column :label="tt('余量')" prop="余量" width="80" align="right" />
            <el-table-column :label="tt('操作员')" prop="操作员" width="80" />
            <el-table-column :label="tt('备注')" prop="备注" min-width="100" show-overflow-tooltip />
            <el-table-column :label="tt('领料单号')" prop="领料单号" width="120" show-overflow-tooltip />
            <el-table-column :label="tt('入库单号')" prop="入库单号" width="120" show-overflow-tooltip />
            <el-table-column :label="tt('结案')" width="70">
              <template #default="{ row }">
                <span :class="row.结案 === 'Y' ? 'wb-closed' : ''">{{ row.结案 === 'Y' ? tt('已结案') : '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('结案人')" prop="结案人" width="80" />
            <el-table-column :label="tt('结案时间')" prop="结案时间" width="130" />
            <el-table-column :label="tt('打印人')" prop="打印人" width="80" />
            <el-table-column :label="tt('打印时间')" prop="打印时间" width="130" />
            <el-table-column :label="tt('打印次数')" prop="打印次数" width="80" align="right" />
            <el-table-column :label="tt('生产状态')" prop="生产状态" width="90" fixed="right" />
          </el-table>
        </div>
      </div>
    </div>

    <!-- 调拨弹窗(9.29 批次②;2026-10-29 收口「调拨只能调拨到当前工序的产线中」;
         2026-10-30 排版:改**两列表单**(标签定宽右对齐 + 控件一列对齐 + 行距 14px),
         不再把标签和下拉挨着摆 —— 原先 inline-flex 各写各的宽度,标签一长一短就挤成一团 -->
    <el-dialog v-model="raVisible" :title="tt('工单调拨')" width="520px" append-to-body>
      <div class="ra-form">
        <div class="ra-row">
          <span class="ra-label">{{ tt('当前工序') }}</span>
          <div class="ra-value">
            <b>{{ raOps.length ? raOps.map((x) => tt(x)).join(' / ') : tt('判不出') }}</b>
            <span v-if="raLimited" class="ra-hint">{{ tt('只能调拨到本工序的产线') }}</span>
          </div>
        </div>
        <div class="ra-row">
          <span class="ra-label">{{ tt('目标车间') }}</span>
          <el-select v-model="raShop" class="ra-ctl" filterable clearable :disabled="!raShops.length"
                     @change="raLine = ''">
            <el-option v-for="x in raShops" :key="x" :label="x" :value="x" />
          </el-select>
        </div>
        <div class="ra-row">
          <span class="ra-label">{{ tt('目标生产线') }}</span>
          <el-select v-model="raLine" class="ra-ctl" filterable :disabled="!raLines.length"
                     :placeholder="tt('请选择目标生产线')">
            <el-option v-for="x in raLines" :key="x.生产线"
                       :label="x.生产线 + (x.生产车间 ? '·' + x.生产车间 : '')" :value="x.生产线" />
          </el-select>
        </div>
        <div class="ra-row">
          <span class="ra-label">{{ tt('调拨原因') }}</span>
          <el-input v-model="raReason" class="ra-ctl" :placeholder="tt('选填')" />
        </div>
        <div v-if="raTip" class="ra-row">
          <span class="ra-label"></span>
          <div class="ra-tip">{{ raTip }}</div>
        </div>
      </div>
      <div class="ra-note">{{ tt('调拨写入轨迹(工单追溯可见);「撤回调拨」可把产线调回原线') }}</div>
      <template #footer>
        <el-button @click="raVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :disabled="!raCan || !raLine" @click="doTransfer">{{ tt('确认调拨') }}</el-button>
      </template>
    </el-dialog>

    <!-- 工单详情·追溯:共用组件 WorkOrderTraceDialog(2026-10-05;生产工单页也原地挂同一个) -->
    <WorkOrderTraceDialog v-model="traceVisible" :code="traceNo" :行id="traceRowId" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { printWorkTaskSheet } from '@/business/print-formats'
import { tt } from '@/i18n'
import WorkOrderTraceDialog from './WorkOrderTraceDialog.vue'
import { qtyText, isOverCapacity, unplannedQty } from '@/business/dayPlan'
import { fetchDayPlan, saveDayPlan } from '@/business/dayPlanApi'
import { useUserStore } from '@/stores/user'
import { canDo as canDoPerm, canDoAny } from '@core/auth/panelAccess'

/**
 * 页面级动作权限(2026-10-16):页面面板 WORK_ORDER_BOARD
 * (可见/查询/调拨/撤回调拨/取消结案/打印;词表见后端 PagePanelRegistry)。
 * 未授权的按钮不渲染;「追溯」是只读查看,归「可见」不另设动作。
 */
const permUser = useUserStore()
const canDo = (word) => canDoPerm(permUser, 'WORK_ORDER_BOARD', word)

const day = ref(new Date().toISOString().slice(0, 10))
const lineSummary = ref([])
const sel = reactive({ line: '' })
const scope = ref('未完工')
const schedRows = ref([])
const checkedSched = ref([])
const s = ref({})
/** 刷新按钮 loading(2026-10-17):loadAll 期间置真,避免连点 */
const loading = ref(false)

const raVisible = ref(false)
const raLine = ref('')
const raShop = ref('')
const raReason = ref('')
/** 选中行的当前工序(去重;2026-10-29 调拨候选由服务端按它算) */
const raOps = ref([])
/** 服务端给的可选车间 / 候选产线(只含当前工序的线) */
const raShops = ref([])
const raLinesAll = ref([])
/** 可调拨 = 服务端判定"有共同合法目标";提示原文(后端中文业务话术,与 err() 一样原样显示,不走 tt) */
const raCan = ref(false)
const raTip = ref('')
/** 至少一行有固定归口车间 ⇒ 显示"只能调到本工序的产线"的提示 */
const raLimited = ref(false)
// 车间只是候选线的二级过滤(车间是产线的属性);候选线已由 /transferTargets 按当前工序算好
const raLines = computed(() => raLinesAll.value.filter((l) => !raShop.value || l.生产车间 === raShop.value))

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
function err(e, f) { ElMessage.error(e?.response?.data?.message || tt(f)) }

const selQty = computed(() => schedRows.value.reduce((a, r) => a + Number(r.排产数量 || 0), 0))
/** 左侧按工序/工艺两级分组(2026-10-05):第1级=成型/切炭/组装,第2级=产线分组(成型下 烧结/X烧结) */
const lineGroups = computed(() => {
  const m = new Map()
  for (const l of lineSummary.value) {
    const k = l.产线分组 ? `${l.生产车间}·${l.产线分组}` : (l.生产车间 || '未归类')
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(l)
  }
  return [...m.entries()].map(([车间, lines]) => ({ 车间, lines }))
})
// 当前账号的车间(9.29 批次③):由 linesSummary 的产线车间反推(账号车间 = 其可见线的车间;不受限账号为多值 → 不显示)
const shop = computed(() => {
  const set = [...new Set(lineSummary.value.map((l) => l.生产车间).filter(Boolean))]
  return set.length === 1 ? set[0] : ''
})
// 未完工量=Σ未交量(**成品口径**:排产−入库,2026-10-07 起);旧数据无未交量字段时回退余量
const selOutstanding = computed(() => schedRows.value.reduce((a, r) => a + (r.未交量 !== undefined ? Number(r.未交量 || 0) : Number(r.余量 || 0)), 0))
// 产能可见(2026-10-31 用户口径「产能只显示、不拦截;不影响实际排产量」):
//   顶部汇总 = 全部启用线今天「已排 > 日产能」的条数与合计超额(/stats 实时算,不落表)。
const overLineCount = computed(() => Number(s.value['今日超载线数'] || 0))
const overQty = computed(() => Number(s.value['今日超额合计'] || 0))

function select(l) {
  sel.line = l.生产线
  loadScheduled().then(() => loadDayPlan())
}

async function loadSummary() {
  try {
    const res = await request.post('/px/scheduleBoard/linesSummary', { 开工日期: day.value })
    lineSummary.value = res.data || []
    if (sel.line && !lineSummary.value.some((x) => x.生产线 === sel.line)) {
      sel.line = ''; schedRows.value = []
    }
  } catch (e) { err(e, '查询失败') }
}

async function loadScheduled() {
  if (!sel.line) { schedRows.value = []; return }
  try {
    const res = await request.post('/px/scheduleBoard/scheduled', { 生产线: sel.line, scope: scope.value })
    // 日期列(2026-10-29):先给每行挂上空的日计划/日报工,模板里的 v-model 才有可写路径
    schedRows.value = (res.data || []).map((r) => ({ ...r, 日计划: {}, 日报工: {} }))
  } catch (e) { err(e, '查询失败') }
}

async function loadStats() {
  try {
    const res = await request.post('/px/scheduleBoard/stats', {})
    s.value = res.data || {}
  } catch { /* 统计失败不阻断 */ }
}

// ───────── 日排产(2026-10-29):直接长在排产明细表的日期列 ─────────
// 用户口径:「在当前的表格内容处插入当前设定的日排产数量,修改需要针对当前生产工单和工单排产中都要实现」
//   ⇒ 不新增表格/块。窗口内**每一天都可填计划**(含今天以前的日期);格下方小字=当天已审核报工量;
//     「保存日排产」落库。2026-10-30:「按完工日期均摊」已按用户口径删除,只保留手工逐格填 + 保存。
const planDates = ref([])
const planToday = ref('')
/** 待保存的改动:key = 行id|日期 */
const planDirty = reactive(new Map())
const planDirtyCount = computed(() => planDirty.size)
const canDayPlan = computed(() => canDoAny(permUser, ['WORK_ORDER_BOARD', 'WORK_ORDER_LIST'], 'dayplan'))
// ── 产能可见(2026-10-31,用户口径「产能只显示、不拦截;不影响实际排产量」)──────────────
//   lineCap  = 产线档案 bs_prod_line.日产能(0/空 = 未配产能 ⇒ 不判超载);
//   dayTotal = 该线每天已排合计(后端按 plang.scx 当前归属算,不分页签);
//   超产能**只标红列头** —— 不弹窗、不改数、不禁填,与「保存日排产」的既有校验无关。
const lineCap = ref(0)
const dayTotal = ref({})

/** 该日期是否超产能(只用于列头标红;产能 <= 0 视为未配,不判) */
function isOverDay(d) { return isOverCapacity(dayTotal.value[d], lineCap.value) }

/** 未分配量 = 工序计划量 − Σ日计划;返回 null 表示取不到工序计划量(界面显示 "-") */
function unplanned(row) { return unplannedQty(row && row.工序计划量, row && row.计划合计) }

async function loadDayPlan() {
  if (!sel.line) { planDates.value = []; planToday.value = ''; lineCap.value = 0; dayTotal.value = {}; planDirty.clear(); return }
  try {
    const data = await fetchDayPlan({ 生产线: sel.line, scope: scope.value })
    planDates.value = data['日期'] || []
    planToday.value = data['今天'] || ''
    lineCap.value = Number(data['产线产能'] || 0)
    dayTotal.value = data['每日已排'] || {}
    const byId = new Map()
    for (const p of data['行'] || []) byId.set(String(p['行id']), p)
    for (const row of schedRows.value) {
      const p = byId.get(String(row.行id))
      row.工序日 = p ? p['工序'] : (row.当前工序 || '')
      row.日计划 = { ...((p && p['日计划']) || {}) }
      row.日报工 = { ...((p && p['日报工']) || {}) }
      row._原计划 = { ...row.日计划 }
      // 纸表口径的整行汇总(交期/紧迫度/7天·15天·大于15天 需求与已排)+ 工序计划量(分配完整性用)
      //   —— 由后端算,前端只显示
      if (p) {
        for (const k of ['交期', '交期紧迫度', '需求数量', '排产数量',
          '7天需交付', '15天需交付', '大于15天需交付',
          '7天已排', '15天已排', '大于15天已排', '计划合计', '完工合计', '工序计划量']) row[k] = p[k]
      }
    }
    planDirty.clear()
  } catch (e) { err(e, '查询失败') }
}

/** 单元格改动 → 记入待保存(与加载时的原值比较,改回原值则移出) */
function markCell(row, d) {
  const v = Number(row.日计划[d] || 0)
  const o = Number((row._原计划 || {})[d] || 0)
  const key = `${row.行id}|${d}`
  if (v === o) { planDirty.delete(key); return }
  planDirty.set(key, {
    工单行id: row.行id,
    工序: row.工序日 || row.当前工序 || '',
    生产线: row.生产线 || sel.line,
    计划日期: d,
    计划数量: v,
  })
}

async function savePlan() {
  const cells = [...planDirty.values()]
  if (!cells.length) { ElMessage.info(tt('没有需要保存的改动')); return }
  try {
    const d = await saveDayPlan(cells)
    ElMessage.success(`${tt('日排产已保存')}（${d['保存格数'] ?? 0}）`)
    await loadDayPlan()
  } catch (e) { err(e, '保存失败') }
}

// ⚠ 2026-10-30 用户口径「把当前这个按日期均摊的功能删除,没啥用」:
//   原「按完工日期均摊」(DayPlanSplitDialog + openSplit/applySplit)已整体删除,
//   日计划只由用户在日期列里逐格填写 → 点「保存日排产」落库。

/** 页签(未完工/已完工/全部)变化:排产明细 + 日排产一起换 */
function onScope() {
  loadScheduled().then(() => loadDayPlan())
}

async function loadAll() {
  // 刷新按钮的 loading(2026-10-17):三个请求各自内部吞异常(不阻断其余取数),
  // 故 Promise.all 只会全部成功 ⇒ finally 收口即可。
  loading.value = true
  try {
    await Promise.all([loadSummary(), loadScheduled(), loadStats()])
    await loadDayPlan()
  } finally { loading.value = false }
}

/**
 * 打开调拨弹窗(2026-10-29 收口):先问服务端「这些行的当前工序能去哪些线」——
 * 与 /transfer 的守卫同一处口径(ProcessTaskService.currentProcess + lineScope),
 * 前端不再用整条产线档案拼下拉(旧写法能把切炭单调到成型线)。
 */
async function openReassign() {
  if (!checkedSched.value.length) return
  const rows = checkedSched.value.map((r) => ({ 工单号: r.加工单号, 行id: r.行id, 工单行号: r.工单行号, 批次号: r.批次号 }))
  raLine.value = ''; raShop.value = ''; raReason.value = ''
  raOps.value = []; raShops.value = []; raLinesAll.value = []; raCan.value = false; raTip.value = ''; raLimited.value = false
  raVisible.value = true
  try {
    const res = await request.post('/px/scheduleBoard/transferTargets', { rows })
    const d = res.data || {}
    raOps.value = d['工序'] || []
    raLinesAll.value = d['产线'] || []
    raShops.value = d['车间'] || []
    raLimited.value = (d['逐行'] || []).some((x) => x['应进车间'])
    raCan.value = d['可调拨'] !== false && raLinesAll.value.length > 0
    raTip.value = d['提示'] || ''
    if (raShops.value.length === 1) raShop.value = raShops.value[0]
  } catch (e) {
    raCan.value = false
    raTip.value = e?.response?.data?.message || '调拨候选加载失败'
  }
}

// ── 取消结案(旧系统 ProSchedList 同名按钮):回退到已审核、不锁死;走 MANU_ORDER「取消结案」按钮(ManuCloseHandler) ──
async function unclose() {
  const rows = checkedSched.value.filter((r) => r.结案 === 'Y')
  if (!rows.length) { ElMessage.warning(tt('选中工单中没有已结案的')); return }
  try {
    await ElMessageBox.confirm(`${tt('确认取消选中的')} ${rows.length} ${tt('张工单的结案')}？(${tt('取消后回到已审核,可继续排产/报工')})`,
      tt('取消结案'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  const failed = []
  let done = 0
  for (const r of rows) {
    try {
      // ⚠ 行级(2026-10-15):本页的行来自 plang(参考库),取消结案必须落 plang 的**那一行** ——
      //   原来走 MANU_ORDER 按钮 → ManuCloseHandler → bd_manu_order,而 plang 单轨后该表已无本单
      //   (实测只剩 13 行历史 MO 单)⇒ 点了没反应/改错表。改调 /px/workOrderList/close(与生产工单
      //   列表页同一落点同一行键:公司代码+工单号+工单行号+批次号)。
      await request.post('/px/workOrderList/close', {
        结案: false,
        rows: [{ 公司代码: r.公司代码, 工单号: r.加工单号, 工单行号: r.工单行号, 批次号: r.批次号 }],
      })
      done++
    } catch (e) { failed.push(`${r.加工单号}${r.工单行号 != null ? ' 行' + r.工单行号 : ''}:${e?.response?.data?.message || e?.message || tt('操作失败')}`) }
  }
  if (done) ElMessage.success(`${tt('已取消结案')} ${done} ${tt('张')}` + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''))
  if (failed.length && !done) ElMessage.error(failed[0])
  loadScheduled()
  loadSummary()
}

// ── 追溯(= 工单详情,2026-10-05):**弹窗抽成共用组件 WorkOrderTraceDialog**(生产工单页也原地挂同一个,
//    用户口径「在生产工单也可以这样查看,不是跳转到工单排产」)。本页只负责:置单号 + 打开。
const traceVisible = ref(false)
const traceNo = ref('')
/** 追溯的工单行id(plang.id):同工单号可有多行/多批次,不带它会把别的行数据混进来(2026-10-15) */
const traceRowId = ref(null)

function openTrace(noParam) {
  const obj = typeof noParam === 'string' ? null : noParam
  const no = typeof noParam === 'string' ? noParam : (noParam?.['工单号'] || checkedSched.value[0]?.加工单号)
  if (!no) return
  traceNo.value = no
  traceRowId.value = obj?.['行id'] ?? checkedSched.value[0]?.['行id'] ?? null
  traceVisible.value = true
}

// ── 打印工单(两模板可选,2026-09-27):成型/组装生产任务单 = 行表直打;打印留痕 printStamp ──
//    ⚠ 2026-10-14 「生产投料单」模板下线:物料行全部来自自建 BOM(/px/workOrderBom → bs_bom),
//      随 MES 自建 BOM 功能整体删除,前端已无替代数据源。
async function printTask(mode) {
  const rows = checkedSched.value
  if (!rows.length) return
  const rowsToPrint = rows.map((r) => ({
    单据编号: r.加工单号,
    公司代码: r.公司代码 || '', 工单行号: r.工单行号, // 工单二维码=公司代码@工单号@1000+工单行号(2026-10-09 规则改版)
    是否重点管控产品: r.重点管控 || '',
    商品编码: r.物料编码 || '',
    商品名称: r.产品名称 || '',
    规格型号: r.规格型号 || '',
    订单数量: r.需求数量,
    成型折算后数量: r.排产数量,
    计划完工日期: r.计划完工日期 || '',
    批号: r.批号 || '', 物料编码: r.物料编码 || '',
    排产数量: r.排产数量, 生产线: r.生产线 || sel.line || '',
  }))
  // 纸面不印打印日期/制单人/线体(2026-10-21 用户口径)⇒ 无选项要传
  const okPrint = await printWorkTaskSheet(mode, rowsToPrint)
  if (!okPrint) return
  try {
    // 行级留痕(2026-10-15):带 行id + 公司代码 + 批次号,后端按 plang.id 精确定位(原只传加工单号,
    //   而后端打的是 bd_manu_order ⇒ plang 单轨后留痕落空)
    await request.post('/px/scheduleBoard/printStamp', {
      rows: rows.map((r) => ({ 加工单号: r.加工单号, 行id: r.行id, 公司代码: r.公司代码, 工单行号: r.工单行号, 批次号: r.批次号 })),
    })
  } catch (e) { /* 留痕失败不阻断打印 */ }
  ElMessage.success(tt('已发送打印') + ' ' + rows.length + ' ' + tt('张'))
  loadScheduled()
}

/**
 * 调拨(9.29 批次②;2026-10-29 收口):勾选已排工单 → 目标产线(**只能是当前工序的线**)+ 原因 →
 * 写 `wo_transfer_log` 轨迹。下拉来自 /transferTargets;服务端还会逐行复核(不信任前端)。
 */
async function doTransfer() {
  if (!raCan.value) { ElMessage.warning(tt('没有可调拨的目标产线')); return }
  if (!raLine.value) { ElMessage.warning(tt('请选择目标生产线')); return }
  // 行级(2026-10-15):必须带 行id —— 同工单多行同批次号时,(工单号+批次号) 无法唯一定位;
  //   后端 WorkOrderTransferService 优先按 行id 精确到行(缺 行id 才退回整单/批次)
  const rows = checkedSched.value.map((r) => ({ 工单号: r.加工单号, 行id: r.行id, 工单行号: r.工单行号, 批次号: r.批次号 }))
  try {
    await ElMessageBox.confirm(`${tt('确认调拨')} ${rows.length} ${tt('张工单')} → ${raLine.value}？`, tt('工单调拨'),
      { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.post('/px/scheduleBoard/transfer', {
      rows, 目标生产线: raLine.value, 目标车间: raShop.value || undefined, 原因: raReason.value || undefined,
    })
    const d = res.data || {}
    const failed = d['失败行'] || []
    ElMessage.success(`${tt('已调拨')} ${d['调拨张数']} ${tt('张')} → ${d['目标']}`
      + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''))
    raVisible.value = false
    loadScheduled()
    loadSummary()
  } catch (e) { err(e, '调拨失败') }
}

/** 撤回调拨:按工单最后一条生效轨迹把产线调回原线(轨迹标撤销,留痕不删) */
async function doTransferRevoke() {
  // 行级(2026-10-15):带 行id —— 撤回只撤**该行**的最后一条轨迹(不带则撤整单最后一条,可能撤错行)
  const rows = checkedSched.value.map((r) => ({ 工单号: r.加工单号, 行id: r.行id, 工单行号: r.工单行号, 批次号: r.批次号 }))
  if (!rows.length) return
  try {
    await ElMessageBox.confirm(`${tt('撤回调拨')} ${rows.length} ${tt('张工单')}？(${tt('调回原产线,轨迹留痕')})`,
      tt('撤回调拨'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消'), type: 'warning' })
  } catch { return }
  try {
    const res = await request.post('/px/scheduleBoard/transferRevoke', { rows })
    const d = res.data || {}
    const failed = d['失败行'] || []
    ElMessage.success(`${tt('已撤回')} ${d['撤回张数']} ${tt('张')}`
      + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''))
    loadScheduled()
    loadSummary()
  } catch (e) { err(e, '撤回调拨失败') }
}

// ── 「转领料」已随 MES 自建 BOM 下架移除(2026-10-04) ──
//    原实现:勾选已排工单 → 按默认 BOM×排产数量 生成材料出库单草稿(后端 /px/scheduleBoard/toPicking
//    + ScheduleBoardService.toPicking + BOM 表 bs_bom,均已同期删除)。领料单改为在「材料出库单」面板手工
//    新增/选单;若日后要恢复自动带料,需先有新的用料来源(如金蝶 BOM 接口)。
//    **2026-10-07 补**:生产工单列表页新增「转领料单」(WorkOrderList.vue + /px/workOrderList/toPicking,
//    由原「打印领料单」改来)——只转单头(加工单号=工单号)、明细仍由仓库在材料出库单里补,故本页不重复造入口。
//    **2026-10-18 补**:口径改为「先排产后领料」——本页(排产)是领料的前置:转领料单要求该工单行
//    已排入产线(scx 非空)且排产数量>0;同一工单行可开多张领料单(见 WorkOrderPickingService)。

onMounted(() => {
  loadAll()
  // 外部跳入(生产加工单列表「追溯」):?trace=工单号 直开追溯弹窗
  const q = new URLSearchParams(location.hash.split('?')[1] || '')
  const tno = q.get('trace')
  if (tno) setTimeout(() => openTrace(tno), 600)
})
</script>

<style scoped>
.wb-page { padding: 10px 14px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #f9f9f9; }
.wb-top { display: flex; align-items: center; gap: 14px; padding: 8px 12px; background: #1e6fb8; color: #fff; border-radius: 4px; }
.wb-title { font-weight: 600; }
.wb-top .wb-stats { margin-left: auto; font-weight: 600; }
.wb-p { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #606266; }
.wb-body { display: flex; gap: 8px; flex: 1; min-height: 0; }
.wb-left { width: 210px; flex: none; background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; overflow: auto; }
.wb-left-head { padding: 8px 10px; font-weight: 600; font-size: 13px; color: #116a5b; border-bottom: 1px solid #e4e7ed; }
.wb-line { padding: 6px 10px; border-bottom: 1px dashed #ebeef5; cursor: pointer; }
.wb-line:hover { background: #f5f7fa; }
.wb-line.active { background: #e6f3ef; }
.wb-line.off .wb-line-name { color: #909399; }
.wb-line-name { font-size: 12px; color: #303133; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.wb-line-sub { font-size: 11px; color: #909399; }
.wb-line-row { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
.wb-tag { font-size: 11px; padding: 0 6px; border-radius: 3px; cursor: pointer; }
.wb-tag.open { background: #67c23a; color: #fff; }
.wb-tag.closed { background: #f56c6c; color: #fff; }
.wb-tag.off-line { background: #909399; color: #fff; cursor: default; }
.wb-qty { font-weight: 600; color: #303133; font-size: 12px; }
.wb-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.wb-ctx { display: flex; align-items: center; gap: 14px; padding: 8px 10px; background: #eef6ff; border: 1px solid #b3d4f5; border-radius: 4px; flex-wrap: wrap; }
.wb-ctx-label { font-size: 13px; color: #606266; }
.wb-shop-group { padding: 6px 10px 2px; font-size: 12px; font-weight: 600; color: #116a5b; background: #f5f7fa; display: flex; justify-content: space-between; }
.wb-shop-cnt { color: #909399; font-weight: 400; }
.wb-shop { margin-left: 12px; font-size: 12px; color: #e6a23c; font-weight: 600; }
/* 调拨弹窗的"不可调拨/无候选线"提示(2026-10-29):后端中文原样显示,前端只给颜色 */
.wb-warn { color: #f56c6c; font-weight: 600; }
/* ── 调拨弹窗两列表单(2026-10-30 用户报障「排列有问题,不要把表格挤在一起」)──
   旧写法每行都是 inline-flex + 标签自然宽度 + 固定 220px 控件:标签一长一短,控件起点参差,
   行与行只靠相邻 div 的默认间距 ⇒ 看起来挤成一团。改成:标签定宽 84px 右对齐、控件 flex:1 同一起点、
   行间距 14px;有提示时单独占一行(与控件左缘对齐)。 */
.ra-form { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px 8px; }
.ra-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ra-label { flex: 0 0 84px; text-align: right; font-size: 13px; line-height: 1.5; color: #606266; }
.ra-value { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; color: #303133; }
.ra-ctl { flex: 1; width: 100%; min-width: 0; }
.ra-hint { font-size: 12px; font-weight: 600; color: #e6a23c; }
.ra-tip { flex: 1; min-width: 0; font-size: 12px; font-weight: 600; line-height: 1.6; color: #f56c6c; }
.ra-note { margin-top: 6px; padding-top: 10px; border-top: 1px dashed #ebeef5; font-size: 12px; line-height: 1.6; color: #909399; }
.wb-ctx-stats { margin-left: auto; font-size: 12px; color: #1e6fb8; font-weight: 600; }
.wb-block { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; flex: 1; min-height: 0; display: flex; flex-direction: column; }
/* 日排产日期列(2026-10-29):格内输入计划,格下小灰字=该天已审核报工量 */
.dp-done { color: #909399; }
.dp-input { width: 72px; }
.dp-act { font-size: 11px; color: #909399; line-height: 1.1; }
/* ── 产能可见(2026-10-31 用户口径「产能只显示、不拦截」)──
   列头两行:日期 + 该线当天「已排/日产能」;超产能只标红,不弹窗、不改数、不禁填。
   未配产能(档案日产能 0/空)写"未配",不参与超载判定。 */
.wb-over { margin-left: 12px; font-size: 12px; color: #fff; opacity: .85; }
.wb-over.hot { color: #ffe58f; font-weight: 700; opacity: 1; }
.wb-daycap { font-size: 11px; color: #909399; }
.wb-daycap.over { color: #f56c6c; font-weight: 700; }
.wb-daycap.unset { color: #c0c4cc; }
.dp-head { line-height: 1.15; }
.dp-date { font-weight: 600; color: #303133; }
.dp-cap { font-size: 10px; color: #909399; font-weight: 400; }
.dp-head.over .dp-date, .dp-head.over .dp-cap { color: #f56c6c; font-weight: 700; }
.dp-cap.unset { color: #c0c4cc; }
.dp-warn { color: #e6a23c; font-weight: 600; }
.dp-unset { color: #c0c4cc; }
.wb-head { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-bottom: 1px solid #e4e7ed; flex-wrap: wrap; }
.wb-block-title { font-weight: 600; font-size: 13px; color: #303133; }
.wb-actions { margin-left: auto; }
.wb-closed { color: #f56c6c; font-weight: 600; }
.wb-trace-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.wb-trace-no { font-size: 16px; font-weight: 700; color: #1e6fb8; }
.wb-trace-desc { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: #606266; background: #fdf6ec; border: 1px solid #f5dab1; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; }
.wb-trace-block { margin-bottom: 12px; }
.wb-trace-block .wb-block-title { display: block; border-left: 3px solid #1e6fb8; padding-left: 8px; margin-bottom: 6px; }
.wb-trace-sub { font-size: 12px; color: #909399; margin: 6px 0 4px; }
</style>
