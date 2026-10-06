<!-- OrderConvert.vue — 订单结转·发单工作台(《订单结转实现方案-V1.0》2026-09-22)
     定位:发单调度台——判断+生成单据+跳转;生成的加工单/采购申请是标准面板单据,后续按面板↔面板流转。
     防重复:行级占用链(剩余=需求−已排产−已采购),转满自动消失,删下游草稿自动回现;不改销售订单状态。

     2026-10-06 用户口径(显示问题修复):
       ①左上角加**日期查询**:默认「单日」= 最近有数据的那一天(后端 stats.最新下单日期),可切 近3/7/14/30 天;
         —— 此前无日期条件,一进页面就把**全部历史**待结转行拉回来,数据一多页面卡死(用户报障原文);
       ②列表**分页**(默认 100/页),几千行也不会一次全渲染;勾选跨页保留(row-key + reserve-selection);
       ③汇总条「当前数据笔数」随日期/关键字口径联动(未结转汇总仍是全量积压,口径不变)。 -->
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

    <!-- 工具栏:左上角日期查询(默认单日)+ 查询条件 + 动作 -->
    <el-form inline class="oc-bar" @submit.prevent>
      <el-form-item :label="tt(dateMode === 'day' ? '日期' : '截止日期')">
        <el-select v-model="dateMode" size="small" class="oc-mode" @change="onQuery" :title="tt('单日只看一天;近几日=以所选日期为截止日往前数')">
          <el-option :label="tt('单日')" value="day" />
          <el-option v-for="n in NEAR_DAYS" :key="n" :label="tt('近' + n + '天')" :value="String(n)" />
        </el-select>
        <el-date-picker v-model="anchor" type="date" value-format="YYYY-MM-DD" size="small" class="oc-date"
                        :clearable="false" :placeholder="tt('日期')" @change="onQuery" />
        <!-- 生效区间回显:单日模式下日期框本身就是区间,不再重复显示;近N天才需要把窗口写出来 -->
        <span v-if="dateMode !== 'day'" class="oc-range">{{ rangeText }}</span>
      </el-form-item>
      <el-form-item :label="tt('查询条件')">
        <el-input v-model="keyword" :placeholder="tt('订单号 / 客户 / 物料')" clearable style="width: 200px" @keyup.enter="onQuery" />
      </el-form-item>
      <el-button type="primary" @click="onQuery">{{ tt('查询') }}</el-button>
      <el-button :loading="loading" @click="onQuery">{{ tt('刷新') }}</el-button>
      <el-button type="danger" plain :disabled="!dateChanged.length" @click="saveDates">
        {{ tt('保存交期') }}（{{ dateChanged.length }}）
      </el-button>
      <el-button :disabled="!checked.length" @click="openRouteDialog">{{ tt('选择工艺路线') }}（{{ checked.length }}）</el-button>
      <el-button type="success" :disabled="!checked.length" @click="toManu">{{ tt('转工单') }}（{{ checked.length }}）</el-button>
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
        <el-table-column :label="tt('行号')" prop="行号" width="70" />
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
        <el-table-column :label="tt('剩余数量')" width="100" align="right" fixed="right">
          <template #default="{ row }">
            <span class="oc-strong">{{ row.剩余数量 }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('工艺路线')" width="180" fixed="right">
          <template #default="{ row }">
            <!-- 用户口径(2026-10-05):**在订单结转处选择工序路线** —— 预填产品绑定(否则默认 GY-CB-STD),可逐行改;
                 转单时原样带入工单(plang.工艺路线),之后排产/详情一律按这条路线解释"走到哪一步"。 -->
            <span :class="{ 'oc-blue': !!row.工艺路线 }" :title="row.工艺路线">{{ row.工艺路线 || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('本次转单数量')" width="125" fixed="right">
          <template #default="{ row }">
            <el-input-number v-model="row.生单数量" :min="0" :max="Number(row.剩余数量)" :controls="false" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <!-- 空表提示:默认单日,该日可能确实没有待结转单 —— 给一条"切近7天"的近路 -->
        <template #empty>
          <div class="oc-empty">
            <span>{{ tt('该日期范围没有待结转数据') }}</span>
            <el-button v-if="dateMode === 'day'" link type="primary" @click="quickNear(7)">{{ tt('看近7天') }}</el-button>
          </div>
        </template>
      </el-table>

    <!-- 工艺路线选择弹窗(2026-10-05 用户口径:路线多时下拉不现实 ⇒ 弹窗;支持编码/名称过滤,列出工序序列) -->
    <el-dialog v-model="routeDialog" :title="tt('选择工艺路线')" width="660px" append-to-body>
      <el-input v-model="routeKw" :placeholder="tt('编码 / 名称')" clearable style="width: 220px; margin-bottom: 8px" />
      <el-table :data="routeFiltered" size="small" border height="330" highlight-current-row
                @current-change="(r) => (routePick = r)" @row-dblclick="applyRoute">
        <el-table-column :label="tt('编码')" prop="编码" width="140" />
        <el-table-column :label="tt('名称')" prop="名称" width="170" show-overflow-tooltip />
        <el-table-column :label="tt('工序序列')" prop="工序序列" min-width="220" show-overflow-tooltip />
        <el-table-column :label="tt('工序数')" prop="工序数" width="80" align="right" />
      </el-table>
      <template #footer>
        <span class="oc-route-tip">{{ tt('将对勾选的') }} {{ checked.length }} {{ tt('行应用该路线(双击行亦可)') }}</span>
        <el-button @click="routeDialog = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :disabled="!routePick" @click="applyRoute">{{ tt('确定') }}</el-button>
      </template>
    </el-dialog>
    </div>

    <div class="oc-pager">
      <el-pagination small background layout="total, sizes, prev, pager, next, jumper"
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

/** 近N天档位(用户口径:默认单日,可切近几日) */
const NEAR_DAYS = [3, 7, 14, 30]

const keyword = ref('')
const loading = ref(false)
const dateMode = ref('day')   // 'day'=单日;'3'/'7'/'14'/'30'=近N天(anchor 为截止日)
const anchor = ref('')        // 单日=查询的那一天;近N天=截止日;空=按今天兜底
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
/** 把弹窗里选中的路线应用到**勾选行**(批量;未勾选则不动) */
function applyRoute() {
  const rt = routePick.value
  if (!rt) return
  for (const r of checked.value) r.工艺路线 = rt.编码
  ElMessage.success(`${tt('已为')} ${checked.value.length} ${tt('行设置工艺路线')} ${rt.编码}`)
  routeDialog.value = false
}
const rows = ref([])
const checked = ref([])
const tableRef = ref(null)
const s = ref({})

/** 行内修改过交期(与原始值比对)的行 */
const dateChanged = computed(() => rows.value.filter((r) => r.交货日期 && r.交货日期 !== r.交货日期原始))

// ── 日期查询:单日 / 近N天(本地日期算,不走 UTC,避免时区把"今天"算偏一天) ──
const pad2 = (n) => String(n).padStart(2, '0')
const fmtDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const todayStr = () => fmtDay(new Date())
function parseDay(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }

/** 当前查询区间(含端点):单日=锚点当天;近N天= [锚点−(N−1), 锚点] */
const range = computed(() => {
  const to = anchor.value || todayStr()
  const n = dateMode.value === 'day' ? 1 : (Number(dateMode.value) || 1)
  const end = parseDay(to)
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (n - 1))
  return { from: fmtDay(start), to }
})
const rangeText = computed(() => (range.value.from === range.value.to ? range.value.from : `${range.value.from} ~ ${range.value.to}`))

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
    pageNo.value = 1
    checked.value = []
    tableRef.value?.clearSelection?.()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || tt('查询失败'))
  } finally {
    loading.value = false
  }
}

/** 汇总条:body 缺省=当前日期/关键字口径;onMounted 首帧传 {} 拿全量口径(含「最新下单日期」锚点) */
async function loadStats(body) {
  try {
    const res = await request.post('/px/orderConvert/stats', body || queryBody())
    s.value = res.data || {}
  } catch { /* 汇总失败不阻断列表 */ }
}

function loadAll() { loadPending(); loadStats() }
/** 日期档位/锚点/关键字变动:回第一页重查(2026-10-06 起页面默认只查一天,切档即查) */
function onQuery() { pageNo.value = 1; loadAll() }
function quickNear(n) { dateMode.value = String(n); onQuery() }
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

async function convert(api, label) {
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
  loadRoutes()
  // 首帧:不带日期条件问一次汇总 → 用「最新下单日期」当默认锚点(最近有数据的那一天),
  // 再按单日拉列表。以前是无条件全量:数据一多,进页面就卡死(2026-10-06 用户报障)。
  await loadStats({})
  anchor.value = s.value['最新下单日期'] || todayStr()
  loadAll()
})
</script>

<style scoped>
.oc-page { padding: 10px 14px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #f9f9f9; overflow: hidden; }
.oc-summary { background: #1e6fb8; color: #fff; padding: 8px 12px; border-radius: 4px; font-size: 13px; line-height: 1.6; }
.oc-sep { opacity: .8; }
.oc-bar { margin: 0; background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; padding: 6px 10px 0; }
.oc-mode { width: 108px; }
.oc-date { width: 138px; margin-left: 6px; }
.oc-range { margin-left: 8px; color: #909399; font-size: 12px; }
.oc-count { margin-left: 12px; color: #606266; font-size: 12px; }
.oc-table { flex: 1; min-height: 0; }
.oc-pager { display: flex; justify-content: flex-end; }
.oc-empty { color: #909399; font-size: 13px; }
.oc-strong { font-weight: 600; color: #303133; }
.oc-dim { color: #909399; font-size: 12px; }
.oc-blue { color: #1e6fb8; font-weight: 600; }
.oc-orange { color: #e6a23c; font-weight: 600; }
:deep(.oc-date-dirty .el-input__wrapper) { box-shadow: 0 0 0 1px #f56c6c inset; }
</style>
