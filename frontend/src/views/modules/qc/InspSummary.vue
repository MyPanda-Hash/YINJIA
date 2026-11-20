<!--
  InspSummary.vue — 「样品检验汇总表」(2026-11-17)

  用户口径:「为当前的样品检验增加汇总表,能够查看到一天或者一周,送好多个样品,测试啥的总表。
  要按一个时间范围,去导出有多少人送了啥样品测试啥,安排检测工作。」

  形态(用户确认三项):
    ① 样品检验下的**独立页面**(不进通用单据面板);
    ② 视角 = 按送样人 + 按委托单/样品(一单一行,列出该单要测的项目);
    ③ 本期不做「安排人/计划日期」等可写字段 —— 导出 Excel 拿去线下排班。

  数据:POST /px/inspSummary/summary(后端 InspSummaryService,只读)。
    行源 = 检验委托单头 qc_insp_commission_head × 行 qc_insp_commission_detail,
    状态真源 yj_doc_status(与列表页/品质流程监控同一口径);默认不含已作废/已中止的单。
  权限:页面级虚拟面板 INSP_SUMMARY(定义见 PagePanelRegistry);
    后端 requirePanelView 兜底;导出按钮按 pagePerms 的 export 词显隐(canDo)。
-->
<template>
  <div class="iss-page">
    <!-- ===== ① 工具条 ===== -->
    <div class="iss-toolbar">
      <div class="iss-head">
        <span class="iss-title">{{ tt('样品检验汇总表') }}</span>
        <span class="iss-datatime">{{ tt('数据时间') }}<em>{{ dataTime || '-' }}</em></span>
      </div>

      <div class="iss-controls">
        <el-radio-group v-model="quick" size="small" class="iss-quick" @change="onQuickChange">
          <el-radio-button value="today">{{ tt('今天') }}</el-radio-button>
          <el-radio-button value="week">{{ tt('本周') }}</el-radio-button>
          <el-radio-button value="month">{{ tt('本月') }}</el-radio-button>
          <el-radio-button value="lastMonth">{{ tt('上月') }}</el-radio-button>
          <el-radio-button value="custom">{{ tt('自定义') }}</el-radio-button>
        </el-radio-group>

        <!-- 日期区间:宽度只给两个日期 + 至 + 图标(2026-11-17 用户口径「太长了,能显示完全即可」)。
             ⚠ 必须内联 width/flex:Element Plus 的 .el-range-editor 自带宽度,且工具条是 flex 行
             (不写 flex:none 会被拉伸到 460px,只剩 250px 的类样式根本压不住)。 -->
        <el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          size="small"
          class="iss-range"
          style="width: 272px; flex: none"
          :range-separator="tt('至')"
          :start-placeholder="tt('开始日期')"
          :end-placeholder="tt('结束日期')"
          @change="onRangeChange"
        />

        <el-input v-model="sender" size="small" clearable class="iss-kw" :placeholder="tt('送样人')"
                  @keyup.enter="search" @clear="search" />
        <el-select v-model="status" size="small" class="iss-status" @change="search">
          <el-option v-for="o in STATUS_OPTIONS" :key="o.value" :label="tt(o.label)" :value="o.value" />
        </el-select>
        <el-input v-model="keyword" size="small" clearable class="iss-kw" :placeholder="tt('单号 / 样品 / 检测项目')"
                  @keyup.enter="search" @clear="search" />

        <el-button size="small" type="primary" :loading="loading" @click="search">
          <el-icon><Search /></el-icon>
          <span>{{ tt('查询') }}</span>
        </el-button>
        <el-button size="small" :disabled="loading" @click="reset">{{ tt('重置') }}</el-button>
        <!-- 2026-11-20 用户口径:「能够勾选检验委托单行,导出 Excel 时能够选择所需的行」。
             勾选状态在工具条回显条数,并提供一键清除(只导所选时按钮文案同步变成「导出所选」)。 -->
        <span v-if="selectedNos.length" class="iss-picked">
          {{ tt('已选') }} <b>{{ selectedNos.length }}</b> {{ tt('张委托单') }}
          <el-button link type="primary" size="small" class="iss-picked-clear" @click="clearSelection">
            {{ tt('清除选择') }}
          </el-button>
        </span>
        <el-button v-if="canExport" size="small" type="success" plain :disabled="loading || !hasData" class="iss-export" @click="exportExcel">
          <el-icon><Download /></el-icon>
          <span>{{ exportLabel }}</span>
        </el-button>
      </div>
    </div>

    <!-- ===== ② 汇总条 ===== -->
    <div class="iss-stats">
      <span class="iss-stat"><em>{{ tt('送样人数') }}</em><b>{{ stat['送样人数'] ?? 0 }}</b></span>
      <span class="iss-stat"><em>{{ tt('送样单数') }}</em><b>{{ stat['送样单数'] ?? 0 }}</b></span>
      <span class="iss-stat is-item"><em>{{ tt('检测项目项次') }}</em><b>{{ stat['检测项目项次'] ?? 0 }}</b></span>
      <span class="iss-stat is-fee"><em>{{ tt('收费合计') }}</em><b>{{ money(stat['收费合计']) }}</b></span>
      <span class="iss-stat is-done"><em>{{ tt('已审核单数') }}</em><b>{{ stat['已审核单数'] ?? 0 }}</b></span>
      <span class="iss-stat is-wait"><em>{{ tt('待检单数') }}</em><b>{{ stat['待检单数'] ?? 0 }}</b></span>
      <span class="iss-tip">{{ tt('统计口径：检验委托单的「单据日期」；默认不含已作废/已中止的单') }}</span>
    </div>

    <el-alert v-if="error && hasData" class="iss-alert" type="error" :closable="false" show-icon
              :title="`${tt('加载失败')}: ${error}`" />

    <!-- ===== ③ 两个视角 ===== -->
    <section class="iss-body">
      <el-tabs v-model="tab" class="iss-tabs">
        <el-tab-pane name="sender">
          <template #label>
            <span>{{ tt('按送样人') }}<em v-if="senders.length"> ({{ senders.length }})</em></span>
          </template>
          <!-- 2026-11-20 第二轮用户口径「按送样人也要能勾选」:
               勾一个送样人 = 该送样人的全部委托单进导出;展开后的委托单还能逐张勾/取消。
               两张表与展开子表共用同一份勾选真源 selectedNos,换页签不会"看起来丢了勾选"。 -->
          <el-table ref="senderTableRef" :data="senders" v-loading="loading" border stripe size="small" row-key="送样人"
                    class="iss-table" :empty-text="emptyText" @selection-change="onSenderSelection">
            <el-table-column type="selection" width="44" fixed :label="tt('选择')" />
            <el-table-column type="expand" width="56" :label="tt('展开')">
              <template #default="{ row }">
                <div class="iss-expand">
                  <div class="iss-expand-title">{{ tt('该送样人的委托单') }}</div>
                  <el-table :ref="(el) => bindSubTable(row['送样人'], el)"
                            :data="docsOfSender(row['送样人'])" border size="small" class="iss-subtable"
                            row-key="单据编号"
                            @select="(sel) => onSubSelection(row['送样人'], sel)"
                            @select-all="(sel) => onSubSelection(row['送样人'], sel)">
                    <el-table-column type="selection" width="40" :label="tt('选择')" />
                    <el-table-column prop="单据日期" :label="tt('单据日期')" width="110" />
                    <el-table-column :label="tt('单据编号')" width="150">
                      <template #default="{ row: d }">
                        <el-link type="primary" :underline="false" @click="openDoc(d['单据编号'])">{{ d['单据编号'] }}</el-link>
                      </template>
                    </el-table-column>
                    <el-table-column prop="样品名称" :label="tt('样品名称')" min-width="140" show-overflow-tooltip />
                    <el-table-column prop="样品类别" :label="tt('样品型号/规格')" width="110" />
                    <el-table-column prop="样品数量" :label="tt('样品数量')" width="100" />
                    <el-table-column prop="检测项目数" :label="tt('检测项目数')" width="100" align="right" />
                    <el-table-column prop="检测项目" :label="tt('检测项目')" min-width="220" show-overflow-tooltip />
                    <el-table-column :label="tt('收费合计')" width="110" align="right">
                      <template #default="{ row: d }">{{ money(d['合计收费']) }}</template>
                    </el-table-column>
                    <el-table-column :label="tt('单据状态')" width="100" align="center">
                      <template #default="{ row: d }">
                        <el-tag size="small" :type="statusTag(d['单据状态'])">{{ tt(d['单据状态']) }}</el-tag>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="送样人" :label="tt('送样人')" min-width="120" fixed />
            <el-table-column prop="送样单数" :label="tt('送样单数')" width="110" align="right" sortable />
            <el-table-column prop="检测项目项次" :label="tt('检测项目项次')" width="132" align="right" sortable />
            <el-table-column prop="涉及样品" :label="tt('涉及样品')" min-width="220" show-overflow-tooltip />
            <el-table-column prop="检测项目" :label="tt('检测项目')" min-width="260" show-overflow-tooltip />
            <el-table-column prop="已审核单数" :label="tt('已审核单数')" width="110" align="right" />
            <el-table-column prop="待检单数" :label="tt('待检单数')" width="100" align="right" />
            <el-table-column :label="tt('收费合计')" width="130" align="right" prop="收费合计" sortable>
              <template #default="{ row }">{{ money(row['收费合计']) }}</template>
            </el-table-column>
            <el-table-column prop="最近送样日期" :label="tt('最近送样日期')" width="140" sortable />
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="doc">
          <template #label>
            <span>{{ tt('按委托单/样品') }}<em v-if="docs.length"> ({{ docs.length }})</em></span>
          </template>
          <el-table ref="docTableRef" :data="docs" v-loading="loading" border stripe size="small" row-key="单据编号"
                    class="iss-table" :empty-text="emptyText" @selection-change="onDocSelection">
            <!-- 勾选列(2026-11-20):勾中的委托单 = 导出 Excel 的「所需的行」;不勾 = 导全部(原行为) -->
            <el-table-column type="selection" width="44" fixed :label="tt('选择')" />
            <el-table-column type="expand" width="56" :label="tt('展开')">
              <template #default="{ row }">
                <div class="iss-expand">
                  <div class="iss-expand-title">
                    {{ tt('检测项目明细') }}
                    <span v-if="row['检验项目及要求']" class="iss-expand-req">{{ tt('检验项目及要求') }}：{{ row['检验项目及要求'] }}</span>
                  </div>
                  <el-table :data="row['明细'] || []" border size="small" class="iss-subtable">
                    <el-table-column prop="行号" :label="tt('行号')" width="70" />
                    <el-table-column prop="检测元素" :label="tt('检测元素')" min-width="150" />
                    <el-table-column prop="测试方法" :label="tt('测试方法')" min-width="110" />
                    <el-table-column prop="测试周期" :label="tt('测试周期')" min-width="220" show-overflow-tooltip />
                    <el-table-column :label="tt('收费（一个样/元）')" width="140" align="right">
                      <template #default="{ row: it }">{{ money(it['收费']) }}</template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="单据日期" :label="tt('单据日期')" width="120" sortable />
            <el-table-column :label="tt('单据编号')" width="150" fixed>
              <template #default="{ row }">
                <el-link type="primary" :underline="false" @click="openDoc(row['单据编号'])">{{ row['单据编号'] }}</el-link>
              </template>
            </el-table-column>
            <el-table-column prop="送样人" :label="tt('送样人')" min-width="110" />
            <el-table-column prop="委托单位" :label="tt('委托单位')" width="110" />
            <el-table-column prop="样品名称" :label="tt('样品名称')" min-width="160" show-overflow-tooltip />
            <el-table-column prop="样品类别" :label="tt('样品型号/规格')" width="120" />
            <el-table-column prop="样品数量" :label="tt('样品数量')" width="100" />
            <el-table-column prop="检测项目数" :label="tt('检测项目数')" width="120" align="right" sortable />
            <el-table-column prop="检测项目" :label="tt('检测项目')" min-width="260" show-overflow-tooltip />
            <el-table-column prop="测试方法" :label="tt('测试方法')" min-width="130" show-overflow-tooltip />
            <el-table-column :label="tt('收费合计')" width="130" align="right" prop="合计收费" sortable>
              <template #default="{ row }">{{ money(row['合计收费']) }}</template>
            </el-table-column>
            <el-table-column :label="tt('单据状态')" width="110" align="center" prop="单据状态" sortable>
              <template #default="{ row }">
                <el-tag size="small" :type="statusTag(row['单据状态'])">{{ tt(row['单据状态']) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="审核人" :label="tt('审核人')" width="100" />
            <el-table-column prop="审核时间" :label="tt('审核时间')" width="150" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download, Search } from '@element-plus/icons-vue'
import request from '@core/request'
import { canDo, canViewPanel } from '@core/auth/panelAccess'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'

defineOptions({ name: 'InspSummary' })

/** 后端只读接口(契约见 InspSummaryController:请求体条件全可选,日期缺省=今天) */
const API_SUMMARY = '/px/inspSummary/summary'
const PANEL = 'INSP_SUMMARY'
const DOC_PANEL = 'INSP_COMMISSION'

const STATUS_OPTIONS = [
  { value: '全部', label: '全部' },
  { value: '草稿', label: '草稿' },
  { value: '审批中', label: '审批中' },
  { value: '已审核', label: '已审核' },
  { value: '已作废', label: '已作废' },
  { value: '已中止', label: '已中止' },
]

const router = useRouter()
const user = useUserStore()

const quick = ref('week')
const range = ref([])
const sender = ref('')
const status = ref('全部')
const keyword = ref('')
const tab = ref('sender')
const loading = ref(false)
const error = ref('')
const dataTime = ref('')
const stat = ref({})
const senders = ref([])
const docs = ref([])
const docTableRef = ref(null)
const senderTableRef = ref(null)
/** 展开行里的委托单子表:按送样人登记 table 实例(勾选同步用,不参与渲染) */
const subTables = new Map()
/**
 * 导出用的**唯一勾选真源**(2026-11-20 第二轮用户口径「按送样人也要能勾选」)。
 *
 * 三处入口最终都归一到这一份「单据编号」集合:
 *   · 「按送样人」表勾一个送样人 = 他的全部委托单;
 *   · 展开后的「该送样人的委托单」子表还能逐张勾/取消;
 *   · 「按委托单/样品」表照旧逐张勾。
 * 换页签/展开别的送样人时,三张表的勾选框都由 syncTables() 按真源重画 —— 不会出现
 * "在这边勾了、切过去又看不到"的假象。不勾 = 全部(原行为)。
 */
const selectedNos = ref([])
/** 程序化 toggleRowSelection 也会触发 selection-change ⇒ 同步期间必须静默,否则递归 */
let syncing = false

const hasData = computed(() => senders.value.length > 0 || docs.value.length > 0)
const emptyText = computed(() => {
  if (loading.value) return tt('加载中…')
  const [s, e] = range.value || []
  // 空态带上当前区间:用户看到 0 行时先能确认「查的是哪一段」,不用去猜为什么刚审的单不在这
  return s && e ? `${tt('当前时间范围内没有送样记录')}（${s} ~ ${e}）` : tt('暂无数据')
})
const canExport = computed(() => canDo({ isAdmin: user.isAdmin, pagePerms: user.pagePerms }, PANEL, 'export'))
/** 导出按钮文案:勾了单就说清「只导所选」,避免用户以为还是导全部 */
const exportLabel = computed(() => (selectedNos.value.length
  ? `${tt('导出所选 Excel')} (${selectedNos.value.length})`
  : tt('导出 Excel')))

function pad(n) {
  return String(n).padStart(2, '0')
}
function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** 周一为一周第一天(国内口径) */
function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const off = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - off)
  return x
}
function rangeOf(kind, now = new Date()) {
  if (kind === 'today') return [ymd(now), ymd(now)]
  if (kind === 'week') return [ymd(mondayOf(now)), ymd(now)]
  if (kind === 'month') return [`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, ymd(now)]
  if (kind === 'lastMonth') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    return [ymd(first), ymd(last)]
  }
  return [ymd(now), ymd(now)]
}

/** 快捷区间:点一下即设定并查询(自定义=保留用户自己选的日期,手点查询) */
function onQuickChange(v) {
  if (v === 'custom') return
  range.value = rangeOf(v)
  search()
}
function onRangeChange(v) {
  if (!v || v.length !== 2) return
  quick.value = 'custom'
}

async function load() {
  if (!range.value || range.value.length !== 2) range.value = rangeOf('week')
  clearSelection()          // 每次重新查询都清勾选:所选行必须属于当前结果集,避免导出到看不见的单
  loading.value = true
  error.value = ''
  try {
    const res = await request.post(API_SUMMARY, {
      日期起: range.value[0],
      日期止: range.value[1],
      送样人: sender.value.trim(),
      单据状态: status.value,
      keyword: keyword.value.trim(),
    })
    if (!res || res.code !== 200) throw new Error(res?.message || tt('请求失败'))
    const data = res.data || {}
    stat.value = data['汇总'] || {}
    senders.value = Array.isArray(data['按送样人']) ? data['按送样人'] : []
    docs.value = Array.isArray(data['按单据']) ? data['按单据'] : []
    dataTime.value = data['数据时间'] || ''
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || tt('请求失败')
    error.value = msg
    stat.value = {}
    senders.value = []
    docs.value = []
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

function search() {
  load()
}

function reset() {
  quick.value = 'week'
  range.value = rangeOf('week')
  sender.value = ''
  status.value = '全部'
  keyword.value = ''
  tab.value = 'sender'
  load()
}

/** 「按委托单/样品」表勾选变化:它是全量视角 ⇒ 直接以它为准 */
function onDocSelection(rows) {
  if (syncing) return
  applySelection((rows || []).map((r) => r['单据编号']), { type: 'doc' })
}

/**
 * 「按送样人」表勾选变化:把"送样人整体状态"对齐到表上 —— 勾了 = 他名下单全进,取消 = 全出。
 *
 * <p>不用"上一次勾选"做增量(2026-11-20 实测表头取消全选时增量会算空),而是逐送样人比
 * **真源现状**:这次勾了他但没全进 ⇒ 补齐;**取消了他且当前是全进** ⇒ 全出;
 * 只勾了部分单的送样人(在展开子表里单独勾的)不动 —— 这样"取消全选"永远能把全进的清掉。</p>
 */
function onSenderSelection(rows) {
  if (syncing) return
  const pickedNames = new Set((rows || []).map((r) => r['送样人']))
  const next = new Set(selectedNos.value)
  for (const s of senders.value) {
    const name = s['送样人']
    const nos = nosOfSender(name)
    if (!nos.length) continue
    const fullyOn = nos.every((n) => next.has(n))
    if (pickedNames.has(name) && !fullyOn) nos.forEach((n) => next.add(n))
    else if (!pickedNames.has(name) && fullyOn) nos.forEach((n) => next.delete(n))
  }
  applySelection([...next], { type: 'sender' })
}

/** 展开子表勾选变化:该送样人的单整体换成本次子表的选择,不影响别的送样人 */
function onSubSelection(name, rows) {
  if (syncing) return
  const next = new Set(selectedNos.value)
  nosOfSender(name).forEach((n) => next.delete(n))
  for (const r of rows || []) if (r['单据编号']) next.add(r['单据编号'])
  applySelection([...next], { type: 'sub', name })
}

/** 子表实例登记(展开时绑定 / 收起时解除);展开那一拍表格还没挂完,下一帧再回显勾选 */
function bindSubTable(name, el) {
  if (!el) {
    subTables.delete(name)
    return
  }
  subTables.set(name, el)
  nextTick(() => {
    const set = new Set(selectedNos.value)
    syncing = true
    try {
      for (const d of docsOfSender(name)) if (set.has(d['单据编号'])) el.toggleRowSelection?.(d, true)
    } finally {
      syncing = false
    }
  })
}

/**
 * 把勾选真源重画到三张表(程序化 toggle ⇒ 期间 syncing=true 屏蔽各自的 change 事件)。
 *
 * @param origin 本次用户操作来源({type:'doc'|'sender'|'sub', name?}):
 *               来源表**自己**不动 —— 它已经被用户点过、状态是对的;再 clear+toggle 一遍会把
 *               Element 内部的表头全选态搞乱(实测"取消全选"点不动,2026-11-20)。
 */
function syncTables(origin = null) {
  const set = new Set(selectedNos.value)
  syncing = true
  try {
    if (!origin || origin.type !== 'doc') {
      const dT = docTableRef.value
      if (dT) {
        dT.clearSelection?.()
        for (const d of docs.value) if (set.has(d['单据编号'])) dT.toggleRowSelection?.(d, true)
      }
    }
    const sT = senderTableRef.value
    if (sT) {
      if (!origin || origin.type !== 'sender') {
        sT.clearSelection?.()
        for (const s of senders.value) {
          const nos = nosOfSender(s['送样人'])
          if (nos.length && nos.every((n) => set.has(n))) sT.toggleRowSelection?.(s, true)
        }
      }
    }
    for (const [name, t] of subTables) {
      if (origin && origin.type === 'sub' && origin.name === name) continue
      t.clearSelection?.()
      for (const d of docsOfSender(name)) if (set.has(d['单据编号'])) t.toggleRowSelection?.(d, true)
    }
  } finally {
    syncing = false
  }
}

/** 设定勾选真源并同步三张表 */
function applySelection(nos, origin = null) {
  selectedNos.value = [...new Set((nos || []).filter(Boolean))]
  syncTables(origin)
}

/** 清除勾选(工具条与查询前置都调它;表实例不在时只清状态) */
function clearSelection() {
  selectedNos.value = []
  syncing = true
  try {
    docTableRef.value?.clearSelection?.()
    senderTableRef.value?.clearSelection?.()
    for (const t of subTables.values()) t.clearSelection?.()
  } finally {
    syncing = false
  }
}

function money(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function docsOfSender(name) {
  return docs.value.filter((d) => d['送样人'] === name)
}

/** 某送样人名下的委托单号(勾送样人 = 勾他这些单) */
function nosOfSender(name) {
  return docsOfSender(name).map((d) => d['单据编号']).filter(Boolean)
}

function statusTag(s) {
  if (s === '已审核') return 'success'
  if (s === '审批中') return 'warning'
  if (s === '已作废' || s === '已中止') return 'info'
  return ''
}

/** 点单号 = 跳检验委托单并定位那张单(没有该面板查看权时只提示,与品质流程监控同口径) */
function openDoc(no) {
  const code = String(no || '').trim()
  if (!code) return
  if (!canViewPanel({ isAdmin: user.isAdmin, visiblePanels: user.visiblePanels }, DOC_PANEL)) {
    ElMessage.warning(tt('无查看该面板的权限'))
    return
  }
  router.push({ path: `/panelx/list/${DOC_PANEL}`, query: { docNo: code } })
}

/**
 * 导出「送检信息汇总表」(.xlsx,单 sheet;表头与用户 2026-11-17 给的纸表一致,
 * 是否接收/是否检测/数据或报告输出 三列是 Excel 下拉)。
 *
 * 由服务端 POI 生成(POST /px/inspSummary/export):SheetJS 社区版写不出 Excel 数据验证(下拉),
 * 而 POI 是后端既有依赖 ⇒ 版式与下拉都收在服务端一份,前端只负责下载。
 */
async function exportExcel() {
  if (!hasData.value) return
  const loading = ElMessage({ message: tt('正在生成 Excel…'), duration: 0 })
  // 勾了单 ⇒ 只导所选(后端按「单据编号」精确过滤);没勾 ⇒ 导当前查询结果全部(原行为不变)
  const picked = selectedNos.value.slice()
  const body = {
    日期起: range.value[0],
    日期止: range.value[1],
    送样人: sender.value.trim(),
    单据状态: status.value,
    keyword: keyword.value.trim(),
  }
  if (picked.length) body.单据编号 = picked
  try {
    const blob = await request.post('/px/inspSummary/export', body, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `送检信息汇总表_${(range.value[0] || '').replace(/-/g, '')}-${(range.value[1] || '').replace(/-/g, '')}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    ElMessage.success(picked.length
      ? `${tt('已导出')} ${picked.length} ${tt('张委托单')}`
      : tt('已导出'))
  } catch (e) {
    ElMessage.error(await blobErrorMessage(e) || tt('导出失败'))
  } finally {
    loading.close()
  }
}

/** blob 响应的错误体解析:失败时后端回 JSON(ApiResult),按 Blob.text() 读出 message */
async function blobErrorMessage(e) {
  const data = e?.response?.data
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text())?.message || '' } catch { /* 非 JSON 走兜底 */ }
  }
  return e?.response?.data?.message || e?.message || ''
}

onMounted(() => {
  range.value = rangeOf('week')
  load()
})
</script>

<style scoped>
.iss-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 18px;
  min-height: 100%;
  background: #f5f7fa;
  box-sizing: border-box;
}
.iss-toolbar,
.iss-stats,
.iss-body {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}
.iss-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}
.iss-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.iss-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.iss-datatime {
  font-size: 12px;
  color: #909399;
}
.iss-datatime em {
  font-style: normal;
  color: #606266;
  margin-left: 4px;
}
.iss-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.iss-range {
  width: 272px;
}
.iss-kw {
  width: 150px;
}
.iss-status {
  width: 110px;
}
/* 勾选回显:紧跟导出按钮左侧,靠 .iss-export 的 margin-left:auto 一起贴右 */
.iss-picked {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #606266;
}
.iss-picked b {
  color: #409eff;
  font-weight: 600;
}
.iss-picked-clear {
  padding: 0;
}
.iss-export {
  margin-left: auto;
}
.iss-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
  padding: 10px 14px;
}
.iss-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: #909399;
}
.iss-stat b {
  font-size: 18px;
  color: #303133;
  font-weight: 600;
}
.iss-stat.is-item b {
  color: #409eff;
}
.iss-stat.is-fee b {
  color: #e6a23c;
}
.iss-stat.is-done b {
  color: #67c23a;
}
.iss-stat.is-wait b {
  color: #f56c6c;
}
.iss-tip {
  margin-left: auto;
  font-size: 12px;
  color: #c0c4cc;
}
.iss-alert {
  margin: 0;
}
.iss-body {
  padding: 4px 14px 14px;
  flex: 1;
  min-height: 0;
}
.iss-tabs :deep(.el-tabs__header) {
  margin-bottom: 8px;
}
.iss-table {
  width: 100%;
}
/* 表头排序:文字与排序箭头必须同一行(2026-11-17 用户报障「检验项目数的排序按钮和文字不在同一行」)。
   Element Plus 表头 .cell 是 block,列宽不足时 caret 会折到第二行 ⇒ 列宽已按内容加宽,
   这里再加 nowrap 兜底(英文/长译名也不折)。 */
.iss-table :deep(.el-table__header .cell) {
  white-space: nowrap;
}
.iss-table :deep(.el-table__header .caret-wrapper) {
  flex: none;
}
.iss-expand {
  padding: 8px 12px;
  background: #fafbfc;
}
.iss-expand-title {
  font-size: 12px;
  color: #606266;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.iss-expand-req {
  color: #909399;
  font-weight: normal;
}
.iss-subtable {
  width: 100%;
}
</style>
