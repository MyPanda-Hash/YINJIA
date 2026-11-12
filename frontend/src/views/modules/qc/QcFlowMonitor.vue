<!--
  QcFlowMonitor.vue — 「品质流程监控」(2026-11-12)

  用户口径:「流程监控:从送料->检验单->入库。为品质做一个流程监控的面版,可以知道每个单据的状态,
  和跳转,如果没有对应面版的权限就无法跳转过去。这种看板类似,而且参考检验目录,主要要显示物料批号和物料编码。」

  一行 = 送料暂收单的一条物料行(= 一个来料批次),与「待检验目录」同粒度;每行右侧是
  **送料暂收单 → 来料检验单 → 采购入库单** 三个节点,每个节点显示 单号 + 单据状态 + 日期(+ 检验/入库数量)。

  跳转(用户口径里的第二条硬要求):点节点 = `/panelx/list/<目标面板>?docNo=<单号>` 定位那张单;
  **没有该面板查看权时只提示、不发路由** —— 判定走 `canViewPanel`(与导航/我的桌面/单据间跳转同一真源),
  后端各面板还有 requirePanelView 兜底。故节点上直接给锁标记,别让人点了才发现没权限。

  视觉沿用「生产工序进度看板 WOrkOrderProgressBoard」那套浅色系统风(白卡片 + #ebeef5 边框 + 系统色),
  不做深色大屏。看板/列表双视图(列表给需要复制单号/横向对比的场景)。

  数据:POST /px/qcFlow/list(只读;后端 QcFlowService 现算,状态真源 yj_doc_status)。
  页面级虚拟面板 QC_FLOW(定义见后端 PagePanelRegistry)⇒ 不进 flatMenus 自动路由,菜单/路由显式注册。
  自动刷新(60s)在 onDeactivated / onBeforeUnmount 必须清定时器(配合 PortalLayout 的 keep-alive)。
-->
<template>
  <div class="qcf-page">
    <!-- ===== ① 工具条 ===== -->
    <div class="qcf-toolbar">
      <div class="qcf-head">
        <span class="qcf-title">{{ tt('品质流程监控') }}</span>
        <span class="qcf-clock">{{ nowText }}</span>
        <span class="qcf-datatime">{{ tt('数据时间') }}<em>{{ dataTime || '-' }}</em></span>
      </div>
      <div class="qcf-controls">
        <el-radio-group v-model="viewMode" size="small" class="qcf-view">
          <el-radio-button value="board">{{ tt('看板') }}</el-radio-button>
          <el-radio-button value="list">{{ tt('列表') }}</el-radio-button>
        </el-radio-group>
        <el-select v-model="stateFilter" size="small" class="qcf-sel" @change="reload">
          <el-option v-for="o in STATE_OPTIONS" :key="o.value" :label="tt(o.label)" :value="o.value" />
        </el-select>
        <el-checkbox v-model="onlyInspect" size="small" class="qcf-only" @change="reload">{{ tt('仅需检验') }}</el-checkbox>
        <!-- 已转ERP 的批次默认隐藏(用户口径 2026-11-12);勾上就把它们显示回来,节点照常可点开 -->
        <el-checkbox v-model="showHidden" size="small" class="qcf-only" @change="reload">
          {{ tt('显示已隐藏') }}<template v-if="stat.hidden"> ({{ stat.hidden }})</template>
        </el-checkbox>
        <el-input v-model="keyword" size="small" clearable class="qcf-kw"
                  :placeholder="tt('搜索单号、物料编码、物料批号或供应商')"
                  @keyup.enter="reload" @clear="reload" />
        <el-button size="small" type="primary" :loading="loading" class="qcf-refresh" @click="reload">
          <el-icon><Refresh /></el-icon>
          <span>{{ tt('刷新') }}</span>
        </el-button>
        <span class="qcf-auto">
          <el-switch v-model="autoRefresh" size="small" />
          <span class="qcf-auto-label">{{ tt('自动刷新') }}</span>
          <em v-if="autoRefresh">{{ tt('每 60 秒') }}</em>
        </span>
      </div>
    </div>

    <!-- ===== ② 汇总条 ===== -->
    <div class="qcf-stats">
      <span class="qcf-stat"><em>{{ tt('批次行数') }}</em><b>{{ stat.total }}</b></span>
      <span class="qcf-stat is-undone"><em>{{ tt('未完成') }}</em><b>{{ stat.undone }}</b></span>
      <span class="qcf-stat is-done"><em>{{ tt('已完成') }}</em><b>{{ stat.done }}</b></span>
      <span class="qcf-stat is-wait"><em>{{ tt('需检验') }}</em><b>{{ stat.needInsp }}</b></span>
      <span class="qcf-stat is-wait"><em>{{ tt('待检验') }}</em><b>{{ stat.waitInsp }}</b></span>
      <span class="qcf-stat is-bad"><em>{{ tt('待退货') }}</em><b>{{ stat.waitRet }}</b></span>
      <span class="qcf-stat is-warn"><em>{{ tt('待特采') }}</em><b>{{ stat.waitTc }}</b></span>
      <span class="qcf-stat is-wait"><em>{{ tt('待入库') }}</em><b>{{ stat.waitIn }}</b></span>
      <span class="qcf-stat is-bad"><em>{{ tt('异常') }}</em><b>{{ stat.bad }}</b></span>
      <span v-if="stat.hidden" class="qcf-stat is-muted"><em>{{ tt('已隐藏') }}</em><b>{{ stat.hidden }}</b></span>
      <span class="qcf-legend">
        <i class="lg lg-done">{{ tt('绿=已审核/已完成') }}</i>
        <i class="lg lg-doing">{{ tt('蓝=待办') }}</i>
        <i class="lg lg-warn">{{ tt('橙=审批中') }}</i>
        <i class="lg lg-void">{{ tt('红=作废/不合格') }}</i>
      </span>
      <span class="qcf-tip">{{ tt('点节点跳转到对应单据；没有该面板权限时不可跳转') }}</span>
    </div>

    <el-alert v-if="error && rows.length" class="qcf-alert" type="error" :closable="false" show-icon
              :title="`${tt('加载失败')}: ${error}`" />

    <!-- ===== ③ 看板视图 ===== -->
    <section v-if="viewMode === 'board'" class="qcf-board">
      <header class="qcf-grid qcf-grid-head">
        <span>{{ tt('物料批号与物料编码') }}</span>
        <span>{{ tt('供应商与采购订单') }}</span>
        <span class="qcf-head-flow"
              :title="tt('金蝶同步导入的采购入库单没有 MES 来源单号，只能按批号推定匹配；推不到就显示未生成')">
          {{ tt('送料 → 检验 → 入库') }}
        </span>
        <span>{{ tt('当前环节') }}</span>
      </header>
      <div class="qcf-grid-body" v-loading="loading">
        <div v-if="error && !rows.length" class="qcf-state">
          <el-icon class="qcf-state-ic"><WarningFilled /></el-icon>
          <p class="qcf-state-title">{{ tt('加载失败') }}</p>
          <p class="qcf-state-sub">{{ error }}</p>
          <el-button size="small" plain @click="reload">{{ tt('重试') }}</el-button>
        </div>
        <div v-else-if="!loading && !rows.length" class="qcf-state">
          <el-icon class="qcf-state-ic"><Tickets /></el-icon>
          <p class="qcf-state-title">{{ tt('没有符合条件的批次') }}</p>
          <p class="qcf-state-sub">{{ tt('调整筛选条件后重试') }}</p>
        </div>
        <div v-for="row in rows" :key="rowKey(row)" class="qcf-grid qcf-grid-row">
          <!-- ① 物料批号 / 物料编码(用户点名要显示的两列,排第一) -->
          <div class="qcf-cell">
            <div class="qcf-batch-row">
              <span class="qcf-batch" :class="{ 'is-empty': !row['物料批号'] }"
                    :title="row['物料批号'] || tt('未填批号')">{{ row['物料批号'] || tt('未填批号') }}</span>
              <span v-if="!row['需检验']" class="qcf-skip">{{ tt('免检') }}</span>
              <span v-if="row['异常']" class="qcf-abn">{{ tt('异常') }}</span>
            </div>
            <div class="qcf-prod" :title="row['物料名称']">{{ row['物料名称'] || '-' }}</div>
            <div class="qcf-kv" :title="row['物料编码']">
              {{ tt('物料编码') }}: <em class="qcf-code">{{ row['物料编码'] || '-' }}</em>
            </div>
            <div class="qcf-kv qcf-ellipsis" :title="row['规格型号']">
              <template v-if="row['规格型号']">{{ tt('规格') }}: <em>{{ row['规格型号'] }}</em> · </template>
              {{ tt('数量') }}: <em>{{ num(row['来料数量']) }} {{ row['计量单位'] || '' }}</em>
              <template v-if="row['检测物料类别']"> · {{ row['检测物料类别'] }}</template>
            </div>
          </div>
          <!-- ② 供应商 / 采购订单 -->
          <div class="qcf-cell">
            <div class="qcf-cust" :title="row['供应商']">{{ row['供应商'] || '-' }}</div>
            <div class="qcf-kv qcf-ellipsis" :title="poText(row)">
              {{ tt('采购订单') }}: <em>{{ poText(row) || '-' }}</em>
            </div>
            <div v-if="row['来料性质']" class="qcf-kv qcf-ellipsis">
              {{ tt('来料性质') }}: <em>{{ row['来料性质'] }}</em>
            </div>
          </div>
          <!-- ③ 流程:主链 送料→检验→入库 + 不合格分支 退回→特采(点节点跳该单据;无权限不可跳) -->
          <div class="qcf-cell qcf-flow">
            <div class="qcf-lane">
              <template v-for="(s, i) in chainOf(row).main" :key="s.key">
                <span v-if="i" class="qcf-arrow" aria-hidden="true">→</span>
                <div class="qcf-node" :class="['is-' + s.state, { 'is-link': s.no && canOpen(s.panel) }]"
                     :title="nodeTitle(s)" role="button" tabindex="0"
                     @click.stop="openDoc(s.panel, s.no)"
                     @keydown.enter.prevent="openDoc(s.panel, s.no)"
                     @keydown.space.prevent="openDoc(s.panel, s.no)">
                  <span class="qcf-node-name">{{ tt(s.name) }}</span>
                  <span v-if="s.no" class="qcf-node-no" :title="s.no">{{ s.no }}</span>
                  <!-- 没有单据时,「未生成 / 免检」在这一个位置说一次就够(不再重复挂徽标) -->
                  <span v-else class="qcf-node-no is-empty">{{ s.state === 'skip' ? tt('免检') : tt('未生成') }}</span>
                  <span class="qcf-node-meta">
                    <em v-if="s.no" class="qcf-badge" :class="'tone-' + s.tone">{{ tt(s.status) }}</em>
                    <i v-if="s.date">{{ s.date }}</i>
                  </span>
                  <span v-if="s.qty" class="qcf-node-qty" :title="s.qtyTitle">{{ s.qty }}</span>
                  <span v-if="s.no && !canOpen(s.panel)" class="qcf-lock" :title="tt('无查看该面板的权限')">
                    <el-icon><Lock /></el-icon>
                  </span>
                </div>
              </template>
            </div>
            <!-- 不合格分支:只在「有退回/特采单」或「检验判了不合格」时出现,全合格批次不占版面 -->
            <div v-if="chainOf(row).showNg" class="qcf-lane qcf-lane-ng">
              <span class="qcf-lane-tag">{{ tt('不合格') }}</span>
              <template v-for="(s, i) in chainOf(row).ng" :key="s.key">
                <span v-if="i" class="qcf-arrow" aria-hidden="true">→</span>
                <div class="qcf-node is-ng" :class="['is-' + s.state, { 'is-link': s.no && canOpen(s.panel) }]"
                     :title="nodeTitle(s)" role="button" tabindex="0"
                     @click.stop="openDoc(s.panel, s.no)"
                     @keydown.enter.prevent="openDoc(s.panel, s.no)"
                     @keydown.space.prevent="openDoc(s.panel, s.no)">
                  <span class="qcf-node-name">{{ tt(s.name) }}</span>
                  <span v-if="s.no" class="qcf-node-no" :title="s.no">{{ s.no }}</span>
                  <span v-else class="qcf-node-no is-empty">{{ tt('未生成') }}</span>
                  <span class="qcf-node-meta">
                    <em v-if="s.no" class="qcf-badge" :class="'tone-' + s.tone">{{ tt(s.status) }}</em>
                    <i v-if="s.date">{{ s.date }}</i>
                  </span>
                  <span v-if="s.no && !canOpen(s.panel)" class="qcf-lock" :title="tt('无查看该面板的权限')">
                    <el-icon><Lock /></el-icon>
                  </span>
                </div>
              </template>
            </div>
          </div>
          <!-- ④ 当前环节 / 停留天数 -->
          <div class="qcf-cell qcf-stage">
            <span class="qcf-stage-tag" :class="'tone-' + stageTone(row)">{{ tt(row['当前环节'] || '-') }}</span>
            <div v-if="row['当前环节'] !== '完成'" class="qcf-days">
              {{ tt('停留') }} <b :class="{ hot: Number(row['停留天数'] || 0) >= 7 }">{{ row['停留天数'] || 0 }}</b> {{ tt('天') }}
            </div>
            <div v-if="row['检验结论']" class="qcf-verdict" :class="'tone-' + verdictTone(row)">
              {{ tt('检验') }} {{ tt(row['检验结论']) }}
            </div>
            <div v-if="Number(row['已隐藏'] || 0) === 1" class="qcf-hidden-tag">{{ tt('已转ERP') }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== ④ 列表视图 ===== -->
    <section v-else class="qcf-list">
      <div class="qcf-table-wrap">
        <el-table :data="rows" size="small" border height="100%" class="qcf-table" :row-key="rowKey">
          <template #empty>
            <div class="qcf-list-empty">
              <p class="qcf-list-empty-title">{{ error ? tt('加载失败') : tt('没有符合条件的批次') }}</p>
              <p class="qcf-list-empty-sub">{{ error || tt('调整筛选条件后重试') }}</p>
              <el-button v-if="error" size="small" plain @click="reload">{{ tt('重试') }}</el-button>
            </div>
          </template>
          <el-table-column :label="tt('物料批号')" width="140">
            <template #default="{ row }">
              <span class="qcf-l-strong">{{ row['物料批号'] || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="tt('物料编码')" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row['物料编码'] || '-' }}</template>
          </el-table-column>
          <el-table-column :label="tt('物料名称')" min-width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ row['物料名称'] || '-' }}</template>
          </el-table-column>
          <el-table-column :label="tt('供应商')" min-width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ row['供应商'] || '-' }}</template>
          </el-table-column>
          <el-table-column :label="tt('数量')" width="86" align="right">
            <template #default="{ row }">{{ num(row['来料数量']) }}</template>
          </el-table-column>
          <el-table-column :label="tt('送料暂收单')" min-width="140">
            <template #default="{ row }">
              <a class="qcf-link" :title="nodeTitleOf(row, 'recv')" @click.stop="openDoc('QC_RECV', row['送料暂收单号'])">
                {{ row['送料暂收单号'] || '-' }}
              </a>
              <el-tag size="small" effect="light" :type="tagType(row['送料状态'])" class="qcf-l-tag">
                {{ tt(row['送料状态'] || '草稿') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="tt('来料检验单')" min-width="130">
            <template #default="{ row }">
              <a v-if="row['检验单号']" class="qcf-link" :title="nodeTitleOf(row, 'insp')"
                 @click.stop="openDoc('QC_INSP', row['检验单号'])">{{ row['检验单号'] }}</a>
              <span v-else class="qcf-l-sub">{{ row['需检验'] ? tt('待检验') : tt('免检') }}</span>
              <el-tag v-if="row['检验单号']" size="small" effect="light" :type="tagType(row['检验状态'])" class="qcf-l-tag">
                {{ tt(row['检验状态'] || '草稿') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="tt('采购入库单')" min-width="140">
            <template #default="{ row }">
              <a v-if="row['入库单号']" class="qcf-link" :title="nodeTitleOf(row, 'in')"
                 @click.stop="openDoc('PURCHASE_IN', row['入库单号'])">{{ row['入库单号'] }}</a>
              <span v-else class="qcf-l-sub">{{ tt('待入库') }}</span>
              <el-tag v-if="row['入库单号']" size="small" effect="light" :type="tagType(row['入库状态'])" class="qcf-l-tag">
                {{ tt(row['入库状态'] || '草稿') }}
              </el-tag>
              <div v-if="row['入库匹配方式'] && row['入库匹配方式'] !== '来源单号'" class="qcf-l-sub">
                {{ tt(row['入库匹配方式']) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="tt('当前环节')" width="134" align="center">
            <template #default="{ row }">
              <el-tag size="small" effect="light" :type="stageTagType(row)">{{ tt(row['当前环节'] || '-') }}</el-tag>
              <!-- 不合格分支的单号挂在这里(列表列宽已排满,不再单开一列压出横向滚动) -->
              <div v-if="row['退货单号']" class="qcf-l-sub">
                <a class="qcf-link" :title="nodeTitleOf(row, 'ret')"
                   @click.stop="openDoc('QC_RETURN', row['退货单号'])">{{ tt('退货') }} {{ row['退货单号'] }}</a>
              </div>
              <div v-if="row['特采单号']" class="qcf-l-sub">
                <a class="qcf-link" :title="nodeTitleOf(row, 'tc')"
                   @click.stop="openDoc('QC_TC_IN', row['特采单号'])">{{ tt('特采') }} {{ row['特采单号'] }}</a>
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="tt('停留天数')" width="84" align="right">
            <template #default="{ row }">
              <span v-if="row['当前环节'] === '完成'" class="qcf-l-sub">-</span>
              <span v-else :class="{ 'qcf-days-hot': Number(row['停留天数'] || 0) >= 7 }">{{ row['停留天数'] || 0 }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, Refresh, Tickets, WarningFilled } from '@element-plus/icons-vue'
import request from '@core/request'
import { canViewPanel } from '@core/auth/panelAccess'
import { FLOW_PANELS, STATUS_TONE, buildChain, jumpTarget, poText, tagTypeOf } from '@core/qc/qcFlow'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'

defineOptions({ name: 'QcFlowMonitor' })

/** 后端只读接口(契约见 QcFlowController:请求体所有条件可空) */
const API_LIST = '/px/qcFlow/list'
const AUTO_REFRESH_MS = 60 * 1000

/** 状态筛选:值与后端约定一致 */
const STATE_OPTIONS = [
  { value: '未完成', label: '未完成' },
  { value: '待检验', label: '待检验' },
  { value: '待退货', label: '待退货' },
  { value: '待特采', label: '待特采' },
  { value: '待入库', label: '待入库' },
  { value: '异常', label: '异常' },
  { value: '已完成', label: '已完成' },
  { value: '全部', label: '全部' },
]

/**
 * 单据状态 → 展示档位、三节点时态、跳转目标判定全部收在 @core/qc/qcFlow(纯函数,有单测),
 * 本组件只负责取数 + 渲染 + 提示,不在这里另写一套判定。
 */
const router = useRouter()
const user = useUserStore()

const viewMode = ref('board')
const stateFilter = ref('未完成')
const keyword = ref('')
const onlyInspect = ref(false)
const showHidden = ref(false)
const autoRefresh = ref(true)
const rows = ref([])
const summary = ref({})
const dataTime = ref('')
const loading = ref(false)
const error = ref('')
const nowText = ref('')

let loadSeq = 0
let refreshTimer = 0
let clockTimer = 0
let firstActivate = true

/** 面板码 → 中文名(提示文案用,数据键口径见 qcFlow.FLOW_PANELS) */
const PANEL_NAME = Object.fromEntries(Object.values(FLOW_PANELS).map((p) => [p.code, p.name]))

/** 能不能跳到目标面板:与导航/我的桌面/单据间跳转同一真源(canViewPanel) */
function canOpen(panel) {
  return canViewPanel({ isAdmin: user.isAdmin, visiblePanels: user.visiblePanels }, panel)
}

/**
 * 点节点跳转(用户口径:「可以知道每个单据的状态,和跳转,如果没有对应面版的权限就无法跳转过去」)。
 * 没有权限时**只提示不发路由** —— 别让人跳进去吃一个空白面板/403。
 */
function openDoc(panel, no) {
  const target = jumpTarget({ isAdmin: user.isAdmin, visiblePanels: user.visiblePanels }, panel, no)
  if (!target.ok) {
    if (target.reason === 'no-permission') {
      ElMessage.warning(`${tt('无查看该面板的权限')}:${tt(PANEL_NAME[panel] || panel)}`)
    }
    return
  }
  router.push({ path: target.path, query: target.query })
}

function reload() {
  load()
}

/** 取数:silent=true 时不清空旧数据、不弹 loading(自动刷新用,尽量不打断观看) */
async function load(opts = {}) {
  const silent = opts && opts.silent === true
  const seq = ++loadSeq
  if (!silent) loading.value = true
  error.value = ''
  // 上限直接取后端最大值(800):正式库整条链才 502 行,全量铺开才不会出现
  // 「批次行数 300 但实际有 447 条未完成」这种静默截断;行数见汇总条,与界面一致。
  const payload = { 状态: stateFilter.value, limit: 800 }
  const kw = keyword.value.trim()
  if (kw) payload.keyword = kw
  if (onlyInspect.value) payload['仅需检验'] = true
  if (showHidden.value) payload['含已隐藏'] = true
  try {
    const res = await request.post(API_LIST, payload)
    if (seq !== loadSeq) return
    if (!res || res.code !== 200) throw new Error(res?.message || tt('请求失败'))
    const data = res.data || {}
    rows.value = Array.isArray(data['行']) ? data['行'] : []
    summary.value = data['汇总'] || {}
    dataTime.value = data['数据时间'] || ''
  } catch (e) {
    if (seq !== loadSeq) return
    const msg = e?.response?.data?.message || e?.message || tt('请求失败')
    error.value = msg
    if (!silent) {
      rows.value = []
      summary.value = {}
    }
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

/** 汇总口径:后端「汇总」优先,缺字段时按当前行就地算(空数据时显示 0 而不是空白) */
const stat = computed(() => {
  const s = summary.value || {}
  const list = rows.value || []
  const count = (k, fn) => Number(s[k] ?? list.filter(fn).length) || 0
  const total = Number(s['行数'] ?? list.length) || 0
  return {
    total,
    undone: count('未完成', (r) => r?.['当前环节'] !== '完成' && !r?.['异常']),
    done: count('已完成', (r) => r?.['当前环节'] === '完成'),
    // 需检验行数 = 总行数 − 免检行数(后端「汇总.免检」现成口径,不在前端另算一遍)
    needInsp: Math.max(0, total - count('免检', (r) => !Number(r?.['需检验'] || 0))),
    waitInsp: count('待检验', (r) => r?.['当前环节'] === '检验'),
    waitRet: count('待退货', (r) => r?.['当前环节'] === '退货'),
    waitTc: count('待特采', (r) => r?.['当前环节'] === '特采'),
    waitIn: count('待入库', (r) => r?.['当前环节'] === '入库'),
    bad: count('异常', (r) => !!r?.['异常']),
    // 已隐藏条数由后端单独数(默认查询里根本不含它们,前端口径算不出来)
    hidden: Number(s['已隐藏'] ?? 0) || 0,
  }
})

function rowKey(row) {
  if (!row) return ''
  return String(row['行id'] ?? `${row['送料暂收单号'] || ''}#${row['物料编码'] || ''}`)
}

/**
 * 主链(送料 / 检验 / 入库)+ 不合格分支(退回 / 特采)节点,并给节点补数量副标:
 * 检验给 合格/不合格,入库给 实收,退货给 退货数量,特采给 不合格品数量。
 * 时态与状态文案由 @core/qc/qcFlow.buildChain 定,这里只补 quantities 与 tt 文案。
 */
function chainOf(row) {
  const chain = buildChain(row)
  const insp = inspQty(row)
  const inNo = String(row?.['入库单号'] || '').trim()
  const retQty = row?.['退货数量']
  const tcQty = row?.['特采数量']
  return {
    ...chain,
    main: chain.main.map((s) => {
      if (s.key === 'insp') return { ...s, qty: insp, qtyTitle: inspQtyTitle(row) }
      if (s.key === 'in') {
        return { ...s, qty: inNo ? `${tt('实收')} ${num(row?.['实收数量'])}` : '', qtyTitle: inQtyTitle(row) }
      }
      return s
    }),
    ng: chain.ng.map((s) => {
      if (s.key === 'ret') return { ...s, qty: retQty != null ? `${tt('退货')} ${num(retQty)}` : '' }
      if (s.key === 'tc') return { ...s, qty: tcQty != null ? `${tt('特采')} ${num(tcQty)}` : '' }
      return s
    }),
  }
}

function inspQty(row) {
  const submitted = row?.['送检数量']
  if (submitted == null) return ''
  const hasOk = row?.['合格数量'] != null
  const hasNg = row?.['不合格数量'] != null
  // 检验单开了但还没填合格/不合格(草稿或旧数据)⇒ 只报送检量,别把 0 说成"合格 0"
  if (!hasOk && !hasNg) return `${tt('送检')} ${num(submitted)}`
  const ng = num(row?.['不合格数量'])
  return `${tt('合格')} ${num(row?.['合格数量'])}${ng > 0 ? ` / ${tt('不合格')} ${ng}` : ''}`
}

function inspQtyTitle(row) {
  return `${tt('送检数量')} ${num(row?.['送检数量'])} · ${tt('合格数量')} ${num(row?.['合格数量'])}` +
    ` · ${tt('不合格数量')} ${num(row?.['不合格数量'])}`
}

function inQtyTitle(row) {
  if (!row?.['入库单号']) return ''
  const how = row?.['入库匹配方式'] ? ` · ${tt('匹配方式')}: ${tt(row['入库匹配方式'])}` : ''
  return `${tt('实收数量')} ${num(row?.['实收数量'])}${how}`
}

function nodeTitle(s) {
  if (!s.no) return s.state === 'skip' ? tt('该物料免检，不需要来料检验') : tt('该环节还没有单据')
  return canOpen(s.panel) ? `${tt('点击跳转到')} ${tt(PANEL_NAME[s.panel])}` : `${tt('无查看该面板的权限')}:${tt(PANEL_NAME[s.panel])}`
}

/** 列表视图里某个节点的 title(同一套提示口径) */
function nodeTitleOf(row, key) {
  if (key === 'recv') return nodeTitle({ no: row?.['送料暂收单号'], panel: 'QC_RECV' })
  if (key === 'insp') return nodeTitle({ no: row?.['检验单号'], panel: 'QC_INSP' })
  if (key === 'ret') return nodeTitle({ no: row?.['退货单号'], panel: 'QC_RETURN' })
  if (key === 'tc') return nodeTitle({ no: row?.['特采单号'], panel: 'QC_TC_IN' })
  return nodeTitle({ no: row?.['入库单号'], panel: 'PURCHASE_IN' })
}

function stageTone(row) {
  const stage = String(row?.['当前环节'] || '')
  if (row?.['异常']) return 'void'
  if (stage === '完成') return 'done'
  if (stage === '退货') return 'void'
  if (stage === '特采') return 'warn'
  if (stage === '检验') return 'warn'
  if (stage === '入库') return 'draft'
  return 'doing'
}

function stageTagType(row) {
  return tagTypeOf(stageTone(row))
}

function verdictTone(row) {
  const v = String(row?.['检验结论'] || '')
  // 部分不合格(同批既有合格又有不合格)用橙色:要人去看,但不像"整批报废"那样红
  if (v === '部分不合格') return 'warn'
  if (v === '不合格') return 'void'
  if (v === '合格') return 'done'
  return 'draft'
}

/** 列表里单据状态徽标(已审核绿 / 草稿蓝 / 审批中橙 / 作废红) */
function tagType(status) {
  return tagTypeOf(STATUS_TONE[status] || STATUS_TONE['草稿'])
}

/** 数字显示:整数千分位;小数保留 2 位(与看板其余数量列同口径) */
function num(v) {
  const n = Number(v || 0)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? n.toLocaleString('en-US') : String(Math.round(n * 100) / 100)
}

function tickClock() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  nowText.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function startTimers() {
  stopTimers()
  tickClock()
  clockTimer = window.setInterval(tickClock, 1000)
  if (autoRefresh.value) refreshTimer = window.setInterval(() => load({ silent: true }), AUTO_REFRESH_MS)
}

/** 卸载/切走/关自动刷新都要清干净 —— 否则 keep-alive 下定时器会在后台一直跑 */
function stopTimers() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer)
    refreshTimer = 0
  }
  if (clockTimer) {
    window.clearInterval(clockTimer)
    clockTimer = 0
  }
}

watch(autoRefresh, () => startTimers())

onMounted(() => {
  load()
  startTimers()
})

onActivated(() => {
  startTimers()
  if (firstActivate) {
    firstActivate = false
    return
  }
  load({ silent: true })
})

onDeactivated(stopTimers)
onBeforeUnmount(stopTimers)
</script>

<style scoped>
/* ===== 页面骨架:与现有模块页一致(浅灰底 + 白卡片 + 8px 间距) ===== */
.qcf-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 460px;
  box-sizing: border-box;
  padding: 10px 14px;
  overflow: hidden;
  background: #f9f9f9;
}

/* ===== ① 工具条 ===== */
.qcf-toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}
.qcf-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}
.qcf-title {
  color: #303133;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}
.qcf-clock,
.qcf-datatime {
  color: #909399;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.qcf-datatime em {
  margin-left: 4px;
  color: #606266;
  font-style: normal;
}
.qcf-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.qcf-sel {
  width: 104px;
}
/* 「仅需检验」勾选框:与旁边的下拉/输入同高,字比正文小一号 */
.qcf-only {
  font-size: 12px;
}
.qcf-only :deep(.el-checkbox__label) {
  font-size: 12px;
}
.qcf-kw {
  width: 260px;
}
.qcf-auto {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #606266;
  font-size: 12px;
  white-space: nowrap;
}
.qcf-auto em {
  color: #909399;
  font-style: normal;
}

/* ===== ② 汇总条 ===== */
.qcf-stats {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  padding: 8px 14px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
.qcf-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.qcf-stat em {
  color: #909399;
  font-size: 12px;
  font-style: normal;
}
.qcf-stat b {
  color: #303133;
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.qcf-stat.is-undone b {
  color: #e6a23c;
}
.qcf-stat.is-done b {
  color: #67c23a;
}
.qcf-stat.is-wait b {
  color: #409eff;
}
.qcf-stat.is-bad b {
  color: #f56c6c;
}
.qcf-stat.is-warn b {
  color: #e6a23c;
}
.qcf-stat.is-muted b {
  color: #909399;
}
.qcf-legend {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.qcf-legend .lg {
  color: #909399;
  font-size: 12px;
  font-style: normal;
}
.qcf-legend .lg::before {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 4px;
  border-radius: 50%;
  background: #c0c4cc;
  vertical-align: middle;
  content: '';
}
.qcf-legend .lg-done::before {
  background: #67c23a;
}
.qcf-legend .lg-doing::before {
  background: #409eff;
}
.qcf-legend .lg-warn::before {
  background: #e6a23c;
}
.qcf-legend .lg-void::before {
  background: #f56c6c;
}
.qcf-tip {
  margin-left: auto;
  color: #a3aab6;
  font-size: 12px;
}
.qcf-alert {
  flex: none;
}

/* ===== ③ 看板:白卡片 + 浅灰表头 + 行分隔线 ===== */
.qcf-board {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}
/* 4 列:批号/物料 250 | 供应商/采购订单 170 | 流程三节点 flex(≥300) | 环节 120
   1392 CSS 宽(内容约 1146):固定 540 + 间距 36 ⇒ 流程列拿到 ~570,三个节点(每个 ≤150)+ 两个箭头放得下。 */
.qcf-grid {
  display: grid;
  grid-template-columns: 250px 170px minmax(300px, 1fr) 120px;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
}
.qcf-grid-head {
  flex: none;
  height: 38px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  color: #606266;
  font-size: 12px;
  font-weight: 600;
}
.qcf-head-flow {
  padding-left: 2px;
}
.qcf-grid-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
.qcf-grid-row {
  min-height: 104px;
  padding: 8px 14px;
  border-bottom: 1px solid #f0f2f3;
}
.qcf-grid-row:last-child {
  border-bottom: none;
}
.qcf-grid-row:hover {
  background: #fafcff;
}
.qcf-cell {
  min-width: 0;
}

/* ① 批号 + 物料 */
.qcf-batch-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.qcf-batch {
  min-width: 0;
  overflow: hidden;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qcf-batch.is-empty {
  color: #c0c4cc;
  font-weight: 400;
}
.qcf-skip,
.qcf-abn {
  flex: none;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}
.qcf-skip {
  background: #f4f4f5;
  color: #909399;
}
.qcf-abn {
  background: #fef0f0;
  color: #f56c6c;
}
.qcf-prod {
  margin-top: 2px;
  overflow: hidden;
  color: #606266;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qcf-kv {
  margin-top: 3px;
  overflow: hidden;
  color: #909399;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qcf-kv em {
  color: #606266;
  font-style: normal;
}
.qcf-code {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2px;
}
.qcf-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ② 供应商 */
.qcf-cust {
  display: -webkit-box;
  overflow: hidden;
  color: #303133;
  font-size: 13px;
  line-height: 1.35;
  word-break: break-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* ③ 流程:主链一行 + 不合格分支一行 */
.qcf-flow {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.qcf-lane {
  display: flex;
  align-items: stretch;
  gap: 2px;
  min-width: 0;
}
/* 不合格分支:比主链矮一号、左缩进一点,一眼能看出是"另一条路" */
.qcf-lane-ng {
  align-items: center;
  padding-left: 6px;
  border-left: 2px dashed #fbc4c4;
  margin-left: 4px;
}
.qcf-lane-tag {
  flex: none;
  padding: 0 5px;
  margin-right: 2px;
  border-radius: 9px;
  background: #fef0f0;
  color: #f56c6c;
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
}
.qcf-arrow {
  flex: none;
  align-self: center;
  color: #c0c4cc;
  font-size: 12px;
  line-height: 1;
}
.qcf-node {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 0;
  max-width: 168px;
  padding: 5px 8px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #fafafa;
  outline: none;
}
.qcf-lane-ng .qcf-node {
  padding: 4px 7px;
  max-width: 150px;
}
.qcf-node.is-link {
  cursor: pointer;
}
.qcf-node.is-link:hover,
.qcf-node.is-link:focus-visible {
  border-color: #a0cfff;
  background: #f5f9ff;
}
/* 节点底色按时态:已审=浅绿 / 待办=浅蓝 / 审批中=浅橙 / 作废=浅红 / 未生成=灰 */
.qcf-node.is-done {
  border-color: #d1edc4;
  background: #f6fdf2;
}
.qcf-node.is-doing {
  border-color: #c6e2ff;
  background: #f4f9ff;
}
.qcf-node.is-warn {
  border-color: #f5dab1;
  background: #fffaf2;
}
.qcf-node.is-void {
  border-color: #fbc4c4;
  background: #fff6f6;
}
.qcf-node.is-todo,
.qcf-node.is-skip {
  border-style: dashed;
  background: #fafafa;
}
.qcf-node-name {
  overflow: hidden;
  color: #909399;
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qcf-node-no {
  overflow: hidden;
  color: #303133;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qcf-node.is-link .qcf-node-no {
  color: #409eff;
}
.qcf-node-no.is-empty {
  color: #c0c4cc;
  font-weight: 400;
}
.qcf-node-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.qcf-node-meta i {
  color: #909399;
  font-size: 10px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.qcf-node-qty {
  overflow: hidden;
  color: #606266;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qcf-badge {
  flex: none;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  font-style: normal;
  line-height: 16px;
  white-space: nowrap;
  background: #f4f4f5;
  color: #909399;
}
.qcf-badge.tone-done {
  background: #f0f9eb;
  color: #67c23a;
}
.qcf-badge.tone-draft {
  background: #ecf5ff;
  color: #409eff;
}
.qcf-badge.tone-warn {
  background: #fdf6ec;
  color: #e6a23c;
}
.qcf-badge.tone-void {
  background: #fef0f0;
  color: #f56c6c;
}
.qcf-lock {
  position: absolute;
  top: 4px;
  right: 4px;
  color: #c0c4cc;
  font-size: 11px;
  line-height: 1;
}

/* ④ 当前环节 */
.qcf-stage {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-start;
}
.qcf-stage-tag {
  display: inline-block;
  padding: 0 7px;
  border-radius: 10px;
  background: #f4f4f5;
  color: #909399;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}
.qcf-stage-tag.tone-done {
  background: #f0f9eb;
  color: #67c23a;
}
.qcf-stage-tag.tone-doing {
  background: #ecf5ff;
  color: #409eff;
}
.qcf-stage-tag.tone-draft {
  background: #ecf5ff;
  color: #409eff;
}
.qcf-stage-tag.tone-warn {
  background: #fdf6ec;
  color: #e6a23c;
}
.qcf-stage-tag.tone-void {
  background: #fef0f0;
  color: #f56c6c;
}
.qcf-days {
  color: #909399;
  font-size: 11px;
  white-space: nowrap;
}
.qcf-days b {
  color: #606266;
  font-variant-numeric: tabular-nums;
}
.qcf-days b.hot {
  color: #f56c6c;
}
.qcf-verdict {
  font-size: 11px;
  white-space: nowrap;
}
.qcf-verdict.tone-done {
  color: #67c23a;
}
.qcf-verdict.tone-void {
  color: #f56c6c;
}
.qcf-verdict.tone-draft {
  color: #e6a23c;
}
.qcf-verdict.tone-warn {
  color: #e6a23c;
}
/* 已转ERP 的批次(只有在勾了「显示已隐藏」时才看得见) */
.qcf-hidden-tag {
  padding: 0 6px;
  border-radius: 9px;
  background: #f4f4f5;
  color: #909399;
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
}

/* 空 / 错状态 */
.qcf-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.qcf-state-ic {
  color: #c0c4cc;
  font-size: 34px;
}
.qcf-state-title {
  margin: 0;
  color: #909399;
  font-size: 14px;
}
.qcf-state-sub {
  margin: 0;
  color: #c0c4cc;
  font-size: 12px;
}

/* ===== ④ 列表视图 ===== */
.qcf-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}
.qcf-table-wrap {
  flex: 1;
  min-height: 0;
}
.qcf-table {
  width: 100%;
}
.qcf-link {
  color: #409eff;
  cursor: pointer;
  text-decoration: none;
}
.qcf-link:hover {
  text-decoration: underline;
}
.qcf-l-tag {
  margin-left: 6px;
}
.qcf-l-strong {
  color: #303133;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.qcf-l-sub {
  display: block;
  color: #909399;
  font-size: 11px;
}
.qcf-days-hot {
  color: #f56c6c;
  font-weight: 600;
}
.qcf-list-empty {
  padding: 18px 0;
  color: #909399;
}
.qcf-list-empty-title {
  margin: 0 0 4px;
  font-size: 14px;
}
.qcf-list-empty-sub {
  margin: 0 0 8px;
  font-size: 12px;
}

/* 窄屏:≤1440 收紧间距;≤1024 纵向堆叠(不横向溢出) */
@media (max-width: 1440px) {
  .qcf-grid {
    grid-template-columns: 230px 160px minmax(260px, 1fr) 110px;
    gap: 8px;
    padding: 0 10px;
  }
  .qcf-grid-row {
    padding: 8px 10px;
  }
  .qcf-kw {
    width: 210px;
  }
}
@media (max-width: 1024px) {
  .qcf-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding: 10px 12px;
  }
  .qcf-grid-head {
    display: none;
  }
  .qcf-grid-row {
    min-height: 0;
    padding: 10px 12px;
  }
  .qcf-kw {
    width: 160px;
  }
}
</style>
