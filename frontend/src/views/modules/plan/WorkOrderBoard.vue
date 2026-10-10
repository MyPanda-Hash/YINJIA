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
      <span class="wb-stats">
        {{ tt('待排产') }}（{{ s['待排产笔数'] ?? 0 }}{{ tt('笔') }}）；{{ tt('今日排产') }}（{{ s['今日排产']?.张数 ?? 0 }}{{ tt('张') }}/{{ num(s['今日排产']?.数量) }}{{ tt('件') }}）；{{ tt('总未完成量') }} {{ num(s['总未完成量']) }}
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
            <el-radio-group v-model="scope" size="small" @change="loadScheduled">
              <el-radio-button value="未完工">{{ tt('未完工') }}</el-radio-button>
              <el-radio-button value="已完工">{{ tt('已完工') }}</el-radio-button>
              <el-radio-button value="全部">{{ tt('全部') }}</el-radio-button>
            </el-radio-group>
            <div class="wb-actions">
              <el-button size="small" type="danger" plain :disabled="!checkedSched.length" @click="unclose">
                {{ tt('取消结案') }}（{{ checkedSched.length }}）
              </el-button>
              <el-button size="small" type="primary" plain :disabled="checkedSched.length !== 1" @click="openTrace">
                {{ tt('追溯') }}
              </el-button>
              <el-dropdown split-button size="small" type="success" plain :disabled="!checkedSched.length"
                           @click="printTask('成型生产任务单')" @command="printTask">
                {{ tt('打印工单') }}（{{ checkedSched.length }}）
                <template #dropdown>
                  <el-dropdown-item command="成型生产任务单">{{ tt('成型生产任务单') }}</el-dropdown-item>
                  <el-dropdown-item command="组装生产任务单">{{ tt('组装生产任务单') }}</el-dropdown-item>
                </template>
              </el-dropdown>
              <el-button size="small" type="warning" plain :disabled="!checkedSched.length" @click="openReassign">
                {{ tt('调拨') }}（{{ checkedSched.length }}）
              </el-button>
              <el-button size="small" plain :disabled="!checkedSched.length" @click="doTransferRevoke">
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

    <!-- 调拨弹窗(9.29 批次②):车间 → 产线 两级目标;写 wo_transfer_log 轨迹,可撤回(调回原线、轨迹留痕) -->
    <el-dialog v-model="raVisible" :title="tt('工单调拨')" width="430px" append-to-body>
      <div class="wb-p">{{ tt('目标车间') }}
        <el-select v-model="raShop" filterable clearable style="width: 210px" @change="raLine = ''">
          <el-option v-for="x in shops" :key="x.车间" :label="x.车间 + '（' + x.产线数 + '）'" :value="x.车间" />
        </el-select>
      </div>
      <div class="wb-p">{{ tt('目标生产线') }}
        <el-select v-model="raLine" filterable style="width: 210px">
          <el-option v-for="x in raLines" :key="x.生产线"
                     :label="x.生产线 + (x.生产车间 ? '·' + x.生产车间 : '')" :value="x.生产线" />
        </el-select>
      </div>
      <div class="wb-p">{{ tt('调拨原因') }}
        <el-input v-model="raReason" size="small" style="width: 210px" :placeholder="tt('选填')" />
      </div>
      <div class="wb-p wb-dim">{{ tt('调拨写入轨迹(工单追溯可见);「撤回调拨」可把产线调回原线') }}</div>
      <template #footer>
        <el-button @click="raVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="doTransfer">{{ tt('确认调拨') }}</el-button>
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
import { useUserStore } from '@/stores/user'

const day = ref(new Date().toISOString().slice(0, 10))
const lineSummary = ref([])
const sel = reactive({ line: '' })
const scope = ref('未完工')
const schedRows = ref([])
const checkedSched = ref([])
const s = ref({})

const raVisible = ref(false)
const raLine = ref('')
const raShop = ref('')
const raReason = ref('')
const shops = ref([])
// 调拨目标=启用线(停用线不可再排/调入);选了车间则只看该车间的线(车间是产线的属性)
const raLines = computed(() => lineSummary.value
  .filter((l) => !l.停用 && (!raShop.value || l.生产车间 === raShop.value))
  .map((l) => ({ 生产线: l.生产线, 生产车间: l.生产车间 })))

/** 车间下拉(启用产线的车间去重 + 该车间产线数) */
async function loadShops() {
  try {
    const res = await request.post('/px/scheduleBoard/workshops', {})
    shops.value = res.data || []
  } catch { /* 不阻断 */ }
}

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

function select(l) {
  sel.line = l.生产线
  loadScheduled()
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
    schedRows.value = res.data || []
  } catch (e) { err(e, '查询失败') }
}

async function loadStats() {
  try {
    const res = await request.post('/px/scheduleBoard/stats', {})
    s.value = res.data || {}
  } catch { /* 统计失败不阻断 */ }
}

function loadAll() { loadSummary(); loadScheduled(); loadStats() }

function openReassign() {
  if (!checkedSched.value.length) return
  raLine.value = sel.line
  raShop.value = lineSummary.value.find((l) => l.生产线 === sel.line)?.生产车间 || ''
  raReason.value = ''
  loadShops()
  raVisible.value = true
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
  const okPrint = await printWorkTaskSheet(mode, rowsToPrint, { line: sel.line || '', preparedBy: useUserStore().realName })
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

/** 调拨(9.29 批次②):勾选已排工单 → 目标产线(可按车间收敛)+ 原因 → 写 `wo_transfer_log` 轨迹 */
async function doTransfer() {
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
.wb-ctx-stats { margin-left: auto; font-size: 12px; color: #1e6fb8; font-weight: 600; }
.wb-block { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; flex: 1; min-height: 0; display: flex; flex-direction: column; }
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
