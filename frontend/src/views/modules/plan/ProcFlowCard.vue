<!--
  ProcFlowCard.vue — 工序流程追踪卡(2026-10-29,生产计划 → 工序流程追踪卡,面板码 PROC_FLOW_CARD)

  【口径来源】docs/design/工序流程追踪卡-V1.0.md(唯一基线):
    · §1.1 不新造批次体系:大批次号 = **生产批次号**(日期形态;plang.[批次号]→plang_pc→scjl,
      都取不到时按工单日期推定、批次来源标注);小批次 = 一个工单行,
      小批次号 = <工单号>-<工单行号>;一张卡 = 一个小批次,卡号 LZK-<小批次号>;
    · §1.4 完成情况**只读现算**(已报工/待审核/状态/完成时间/报工人全来自 /detail),
      本页不自己算完成量、不落冗余;
    · §1.5 卡状态只有「录入中/已完成」;「确认完成」由服务端强校验前置;
    · §5 三个页签:① 录入(选批次 → 选小批次 → 逐道工序照片)② 卡片列表(按产品物料查)
      ③ 批次追溯(汇总 + 卡片 + 卡 → 追溯抽屉 → 工单追溯)。

  【结构】本文件只放「页面骨架 + 三页签的取数/选择逻辑」;卡面、照片墙、卡片表、追溯抽屉
    各自拆成同目录 procFlowCard*.vue(超 1200 行红线前先拆,规范 C1),页面因此可读、可测。

  【权限】页面级虚拟面板 PROC_FLOW_CARD(后端 PagePanelRegistry:view/query/entry/confirm):
    路由守卫拦 view;本页只做**入口显隐** —— 无 entry 隐藏「创建流程卡/上传/删除照片/保存备注」,
    无 confirm 隐藏「确认完成/退回录入中」;后端是真闸门(403 由拦截器统一处理)。
    写法与 WorkOrderList/MobilePick 一致:canDo(user, code, word)。

  【后端未就绪时的行为】所有请求都经 `errText()` 兜底:404/500 只弹 ElMessage(带状态码),
    不白屏;空数据一律显式空态文案。
-->
<template>
  <div class="pfc">
    <el-tabs v-model="tab" class="pfc-tabs" @tab-change="onTabChange">
      <!-- ═══════════ ① 录入:大批次 → 小批次(工单行)→ 卡面 ═══════════ -->
      <el-tab-pane :label="tt('录入')" name="entry">
        <div class="pfc-bar">
          <span class="pfc-lb">{{ tt('大批次') }}</span>
          <el-select
            v-model="batchNo"
            size="small"
            filterable
            clearable
            :loading="batchesLoading"
            :placeholder="tt('选择批次号')"
            class="pfc-batch"
            @change="loadLines"
          >
            <el-option
              v-for="b in batches"
              :key="b['批次号']"
              :label="`${b['批次号']}（${b['行数']} ${tt('行')}）`"
              :value="b['批次号']"
            />
          </el-select>
          <el-input
            v-model="batchKw"
            size="small"
            clearable
            class="pfc-kw"
            :placeholder="tt('批次号关键字')"
            @keyup.enter="loadBatches"
          />
          <el-button size="small" type="primary" :loading="batchesLoading" @click="loadBatches">{{ tt('查询') }}</el-button>
          <el-input
            v-model="lineKw"
            size="small"
            clearable
            class="pfc-kw"
            :placeholder="tt('筛选工单号/产品')"
            @keyup.enter="loadLines"
          />
          <el-button size="small" :loading="linesLoading" @click="loadLines">{{ tt('刷新') }}</el-button>
        </div>

        <div class="pfc-split">
          <!-- 小批次(工单行)表 -->
          <div class="pfc-list" v-loading="linesLoading">
            <el-table
              :data="lines"
              size="small"
              border
              highlight-current-row
              row-key="工单行id"
              max-height="60vh"
              :empty-text="batchNo ? tt('该批次下没有工单行') : tt('请先选择大批次')"
              @row-click="pickLine"
            >
              <el-table-column :label="tt('工单号')" prop="工单号" min-width="132" show-overflow-tooltip />
              <el-table-column :label="tt('行号')" prop="工单行号" width="62" align="right" />
              <el-table-column :label="tt('产品编码')" prop="产品编码" min-width="104" show-overflow-tooltip />
              <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="150" show-overflow-tooltip />
              <el-table-column :label="tt('规格型号')" prop="规格型号" min-width="120" show-overflow-tooltip />
              <el-table-column :label="tt('计划数量')" width="90" align="right">
                <template #default="{ row }">{{ fmtNum(row['计划数量']) }}</template>
              </el-table-column>
              <el-table-column :label="tt('当前工序')" width="90">
                <template #default="{ row }">{{ row['当前工序'] ? tt(row['当前工序']) : '-' }}</template>
              </el-table-column>
              <el-table-column :label="tt('卡号')" min-width="140" show-overflow-tooltip>
                <template #default="{ row }">
                  <span :class="{ 'pfc-muted': !row['卡号'] }">{{ row['卡号'] || tt('未建卡') }}</span>
                </template>
              </el-table-column>
              <el-table-column :label="tt('卡状态')" width="86">
                <template #default="{ row }">
                  <el-tag v-if="row['卡状态']" size="small" :type="cardStatusType(row['卡状态'])">{{ tt(row['卡状态']) }}</el-tag>
                  <span v-else class="pfc-muted">-</span>
                </template>
              </el-table-column>
              <el-table-column :label="tt('照片')" prop="照片数" width="62" align="right" />
            </el-table>
          </div>

          <!-- 右侧(窄屏在下方)卡面编辑区 -->
          <div class="pfc-detail" v-loading="detailLoading">
            <div v-if="!pickedLine" class="pfc-empty">{{ tt('请先在左侧选择工单行') }}</div>

            <div v-else-if="pickedLine['卡号'] && !detail && !detailLoading" class="pfc-empty">
              <div>{{ tt('流程卡详情加载失败') }}</div>
              <el-button size="small" style="margin-top: 8px" @click="loadDetail(pickedLine['卡号'])">{{ tt('重试') }}</el-button>
            </div>

            <!-- 未建卡:显示该工单行摘要 + 创建流程卡 -->
            <div v-else-if="!pickedLine['卡号']" class="pfc-linecard">
              <div class="pfc-linecard-no">
                {{ pickedLine['工单号'] }}<span class="pfc-tag">#{{ pickedLine['工单行号'] }}</span>
              </div>
              <div class="pfc-kv">
                <div><span>{{ tt('产品编码') }}</span><b>{{ pickedLine['产品编码'] || '-' }}</b></div>
                <div><span>{{ tt('产品名称') }}</span><b>{{ pickedLine['产品名称'] || '-' }}</b></div>
                <div><span>{{ tt('规格型号') }}</span><b>{{ pickedLine['规格型号'] || '-' }}</b></div>
                <div><span>{{ tt('计划数量') }}</span><b class="num">{{ fmtNum(pickedLine['计划数量']) }}</b></div>
                <div><span>{{ tt('生产线') }}</span><b>{{ pickedLine['生产线'] || '-' }}</b></div>
                <div><span>{{ tt('批次号') }}</span><b>{{ batchNo || '-' }}</b></div>
              </div>
              <div class="pfc-create">
                <el-button v-if="canEntry" type="primary" size="large" :loading="creating" @click="createCard">
                  {{ tt('创建流程卡') }}
                </el-button>
                <span v-else class="pfc-hint">{{ tt('没有录入权限,请联系管理员授予「工序流程追踪卡·录入照片」') }}</span>
              </div>
              <div class="pfc-hint">{{ tt('建卡后即可逐道工序上传照片;一张卡对应一个小批次') }}</div>
            </div>

            <!-- 已建卡:卡面(工序卡 + 照片墙 + 备注 + 动作) -->
            <procFlowCardEditor
              v-else
              :detail="detail"
              :can-entry="canEntry"
              :can-confirm="canConfirm"
              @reload="loadDetail(pickedLine['卡号'])"
            />
          </div>
        </div>
      </el-tab-pane>

      <!-- ═══════════ ② 卡片列表:按产品物料查 ═══════════ -->
      <el-tab-pane :label="tt('卡片列表')" name="list">
        <div class="pfc-bar">
          <el-input v-model="filters['产品编码']" size="small" clearable class="pfc-kw-sm" :placeholder="tt('产品编码')" @keyup.enter="loadList(true)" />
          <el-input v-model="filters['产品名称']" size="small" clearable class="pfc-kw-sm" :placeholder="tt('产品名称')" @keyup.enter="loadList(true)" />
          <el-input v-model="filters['规格型号']" size="small" clearable class="pfc-kw-sm" :placeholder="tt('规格型号')" @keyup.enter="loadList(true)" />
          <el-input v-model="filters['工单号']" size="small" clearable class="pfc-kw-sm" :placeholder="tt('工单号')" @keyup.enter="loadList(true)" />
          <el-input v-model="filters['批次号']" size="small" clearable class="pfc-kw-sm" :placeholder="tt('批次号')" @keyup.enter="loadList(true)" />
          <el-select v-model="filters['卡状态']" size="small" clearable class="pfc-kw-sm" :placeholder="tt('卡状态')">
            <el-option v-for="s in statusOptions" :key="s" :label="tt(s)" :value="s" />
          </el-select>
          <el-date-picker v-model="filters['日期从']" type="date" size="small" value-format="YYYY-MM-DD" class="pfc-date" :placeholder="tt('日期从')" />
          <span class="pfc-sep">-</span>
          <el-date-picker v-model="filters['日期到']" type="date" size="small" value-format="YYYY-MM-DD" class="pfc-date" :placeholder="tt('日期到')" />
          <el-button size="small" type="primary" :loading="listLoading" @click="loadList(true)">{{ tt('查询') }}</el-button>
          <el-button size="small" @click="loadList(true)">{{ tt('刷新') }}</el-button>
        </div>
        <procFlowCardTable :rows="listRows" :loading="listLoading" @row-click="openCardDrawer" />
        <div class="pfc-page">
          <el-pagination
            v-model:current-page="pageNo"
            v-model:page-size="pageSize"
            :page-sizes="[20, 50, 100, 200]"
            :total="total"
            size="small"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="loadList(false)"
            @size-change="loadList(true)"
          />
        </div>
      </el-tab-pane>

      <!-- ═══════════ ③ 批次追溯:批次汇总 + 卡片 + 卡 → 追溯 ═══════════ -->
      <el-tab-pane :label="tt('批次追溯')" name="trace">
        <div class="pfc-bar">
          <span class="pfc-lb">{{ tt('批次号') }}</span>
          <el-select
            v-model="traceBatchNo"
            size="small"
            filterable
            allow-create
            default-first-option
            clearable
            :loading="batchesLoading"
            :placeholder="tt('选择或输入批次号')"
            class="pfc-batch"
            @change="loadBatchTrace"
          >
            <el-option v-for="b in batches" :key="b['批次号']" :label="b['批次号']" :value="b['批次号']" />
          </el-select>
          <el-button size="small" type="primary" :loading="traceLoading" @click="loadBatchTrace">{{ tt('查询') }}</el-button>
          <el-button size="small" @click="loadBatches">{{ tt('刷新') }}</el-button>
        </div>

        <div v-if="!traceData" class="pfc-empty">{{ tt('请选择批次号查询该批次的流程卡') }}</div>
        <template v-else>
          <!-- 汇总:卡数/产品数/计划量 + 各工序完成量 -->
          <div class="pfc-sum">
            <div class="pfc-stat"><b>{{ summary['卡数'] ?? traceCards.length }}</b><span>{{ tt('卡数') }}</span></div>
            <div class="pfc-stat"><b>{{ summary['产品数'] ?? '-' }}</b><span>{{ tt('产品数') }}</span></div>
            <div class="pfc-stat"><b>{{ fmtNum(summary['计划数量']) }}</b><span>{{ tt('计划数量') }}</span></div>
          </div>
          <div class="pfc-sum-ops">
            <div class="pfc-sec-title">{{ tt('各工序完成量') }}</div>
            <el-table :data="summary['工序汇总'] || []" size="small" border :empty-text="tt('暂无数据')" max-height="240">
              <el-table-column :label="tt('工序')" min-width="90">
                <template #default="{ row }">{{ tt(row['工序']) }}</template>
              </el-table-column>
              <el-table-column :label="tt('计划量')" width="110" align="right">
                <template #default="{ row }">{{ fmtNum(row['计划量']) }}</template>
              </el-table-column>
              <el-table-column :label="tt('已报工')" width="110" align="right">
                <template #default="{ row }">{{ fmtNum(row['已报工']) }}</template>
              </el-table-column>
              <el-table-column :label="tt('卡片数')" width="90" align="right">
                <template #default="{ row }">{{ fmtNum(row['卡片数']) }}</template>
              </el-table-column>
            </el-table>
          </div>
          <procFlowCardTable :rows="traceCards" :loading="traceLoading" @row-click="openTraceDrawer" />
        </template>
      </el-tab-pane>
    </el-tabs>

    <!-- 页签②行点击:只读卡面详情抽屉 -->
    <el-drawer v-model="cardDrawer" :title="tt('流程卡详情')" :size="drawerSize" destroy-on-close>
      <div v-loading="drawerLoading" style="min-height: 120px">
        <procFlowCardEditor v-if="drawerDetail" :detail="drawerDetail" readonly />
        <div v-else-if="!drawerLoading" class="pfc-empty">{{ tt('暂无数据') }}</div>
      </div>
    </el-drawer>

    <!-- 页签③卡片点击:追溯抽屉(工序进度 + 报工记录 + 照片墙 + 工单追溯) -->
    <el-drawer v-model="traceDrawer" :title="tt('卡片追溯')" :size="drawerSize" destroy-on-close>
      <procFlowCardTrace v-if="traceCardNo" :card-no="traceCardNo" />
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { useUserStore } from '@/stores/user'
import procFlowCardEditor from './procFlowCardEditor.vue'
import procFlowCardTable from './procFlowCardTable.vue'
import procFlowCardTrace from './procFlowCardTrace.vue'
import { canDoCard, cardStatusType, errText, fmtNum, procCardApi } from './procFlowCardApi'

const userStore = useUserStore()
/**
 * 页面动作词(与后端 PanelPermissionService 同源):
 *  · entry   = 建卡 / 上传删除照片 / 保存卡备注
 *  · confirm = 确认完成 / 退回录入中
 * 路由守卫已拦 view;拿不到权限时**一律不显示入口**(宁可少按钮,也不要点出一个 403)。
 */
const canEntry = computed(() => canDoCard(userStore, 'entry'))
const canConfirm = computed(() => canDoCard(userStore, 'confirm'))

const tab = ref('entry')

/* ── ① 录入 ───────────────────────────────────────────── */
const batches = ref([])
const batchesLoading = ref(false)
const batchKw = ref('')
const batchNo = ref('')
const lines = ref([])
const linesLoading = ref(false)
const lineKw = ref('')
const pickedLine = ref(null)
const detail = ref(null)
const detailLoading = ref(false)
const creating = ref(false)

/**
 * 大批次列表(契约 §3.2)。首次进来默认选最近一个批次(列表按批次号倒序由后端给),
 * 省掉"先选批次"这一步;清空关键字再查 = 全量。
 */
async function loadBatches() {
  batchesLoading.value = true
  try {
    batches.value = (await procCardApi.batches({ 关键字: batchKw.value.trim() })) || []
    if (!batchNo.value && batches.value.length) {
      batchNo.value = batches.value[0]['批次号'] || ''
      await loadLines()
    }
  } catch (e) {
    batches.value = []
    ElMessage.error(errText(e, '查询批次失败'))
  } finally {
    batchesLoading.value = false
  }
}

/** 某批次下的工单行(小批次候选,契约 §3.3);刷新后按 工单行id 保持选中 */
async function loadLines() {
  if (!batchNo.value) { lines.value = []; pickedLine.value = null; detail.value = null; return }
  linesLoading.value = true
  try {
    lines.value = (await procCardApi.lines({ 批次号: batchNo.value, 关键字: lineKw.value.trim() })) || []
    const keepId = pickedLine.value?.['工单行id']
    const keep = keepId == null ? null : lines.value.find((x) => String(x['工单行id']) === String(keepId))
    pickedLine.value = keep || null
    detail.value = null
    if (keep?.['卡号']) await loadDetail(keep['卡号'])
  } catch (e) {
    lines.value = []
    pickedLine.value = null
    detail.value = null
    ElMessage.error(errText(e, '查询小批次失败'))
  } finally {
    linesLoading.value = false
  }
}

/** 点行 = 选中该小批次;已建卡则直接加载卡详情(契约 §3.5) */
async function pickLine(row) {
  if (!row) return
  pickedLine.value = row
  detail.value = null
  if (row['卡号']) await loadDetail(row['卡号'])
}

/** 卡详情(完成情况后端现算);顺手把卡号/卡状态/照片数同步回小批次表 */
async function loadDetail(cardNo) {
  if (!cardNo) { detail.value = null; return }
  detailLoading.value = true
  try {
    detail.value = await procCardApi.detail({ 卡号: cardNo })
    syncLineCard()
  } catch (e) {
    detail.value = null
    ElMessage.error(errText(e, '查询卡详情失败'))
  } finally {
    detailLoading.value = false
  }
}

function syncLineCard() {
  const h = detail.value?.头
  if (!h) return
  const apply = (row) => {
    if (!row) return
    row['卡号'] = h['卡号'] || row['卡号']
    row['卡状态'] = h['卡状态'] || row['卡状态']
    row['照片数'] = h['照片数'] ?? row['照片数']
  }
  apply(pickedLine.value)
  const hit = lines.value.find((x) => String(x['工单行id']) === String(h['工单行id']))
  apply(hit)
}

/** 创建流程卡(契约 §3.4:幂等,data 同 /detail)—— 无 entry 词的账号看不到按钮 */
async function createCard() {
  const row = pickedLine.value
  if (!row) return
  creating.value = true
  try {
    const d = await procCardApi.create({ 工单行id: row['工单行id'], 备注: '' })
    const cardNo = d?.['头']?.['卡号'] || d?.['卡号'] || ''
    if (cardNo) await loadDetail(cardNo)
    else if (d?.['头']) { detail.value = d; syncLineCard() }
    ElMessage.success(`${tt('已创建流程卡')}${cardNo ? ': ' + cardNo : ''}`)
  } catch (e) {
    ElMessage.error(errText(e, '创建流程卡失败'))
  } finally {
    creating.value = false
  }
}

/* ── ② 卡片列表 ───────────────────────────────────────── */
const filters = reactive({
  产品编码: '', 产品名称: '', 规格型号: '', 工单号: '', 批次号: '', 卡状态: '', 日期从: '', 日期到: '',
})
const listRows = ref([])
const listLoading = ref(false)
const listLoaded = ref(false)
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(50)
const statusOptions = ref(['录入中', '已完成'])

/** 卡片分页查询(契约 §3.7);入参可空,分页用 pageNo/pageSize */
async function loadList(resetPage) {
  if (resetPage) pageNo.value = 1
  listLoading.value = true
  try {
    const d = await procCardApi.list({ ...filters, pageNo: pageNo.value, pageSize: pageSize.value })
    listRows.value = d?.['行'] || []
    total.value = Number(d?.['总行数'] || 0)
    listLoaded.value = true
  } catch (e) {
    listRows.value = []
    total.value = 0
    ElMessage.error(errText(e, '查询卡片列表失败'))
  } finally {
    listLoading.value = false
  }
}

/* 抽屉:页签②看卡面(只读)、页签③看追溯 */
const cardDrawer = ref(false)
const drawerDetail = ref(null)
const drawerLoading = ref(false)
const traceDrawer = ref(false)
const traceCardNo = ref('')

/** 抽屉宽度:窄屏铺满(手机上别只给半屏),桌面 780px */
const isNarrow = ref(typeof window !== 'undefined' ? window.matchMedia('(max-width: 899px)').matches : false)
const drawerSize = computed(() => (isNarrow.value ? '96%' : '780px'))
const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 899px)') : null
const onMq = (e) => { isNarrow.value = e.matches }

async function openCardDrawer(row) {
  if (!row?.['卡号']) return
  cardDrawer.value = true
  drawerDetail.value = null
  drawerLoading.value = true
  try {
    drawerDetail.value = await procCardApi.detail({ 卡号: row['卡号'] })
  } catch (e) {
    ElMessage.error(errText(e, '查询卡详情失败'))
  } finally {
    drawerLoading.value = false
  }
}

/* ── ③ 批次追溯 ───────────────────────────────────────── */
const traceBatchNo = ref('')
const traceLoading = ref(false)
const traceData = ref(null)
const traceCards = computed(() => traceData.value?.['卡片'] || [])
const summary = computed(() => traceData.value?.['汇总'] || {})

/** 批次追溯(契约 §3.8:汇总 + 卡片);点卡片 → 追溯抽屉 */
async function loadBatchTrace() {
  const no = String(traceBatchNo.value || '').trim()
  if (!no) { traceData.value = null; return }
  traceLoading.value = true
  try {
    traceData.value = await procCardApi.batchTrace({ 批次号: no })
  } catch (e) {
    traceData.value = null
    ElMessage.error(errText(e, '查询批次追溯失败'))
  } finally {
    traceLoading.value = false
  }
}

function openTraceDrawer(row) {
  const no = row?.['卡号']
  if (!no) { ElMessage.warning(tt('该行没有卡号')); return }
  traceCardNo.value = no
  traceDrawer.value = true
}

/* ── 页签切换:懒加载(不在首屏就把三个页签的接口全打一遍) ── */
function onTabChange(name) {
  if (name === 'list' && !listLoaded.value) loadList(true)
  if (name === 'trace' && !traceBatchNo.value && batchNo.value) {
    // 页签①已选的批次直接带过来,少一步重复选择
    traceBatchNo.value = batchNo.value
    loadBatchTrace()
  }
}

/** 页面选项(卡状态等,契约 §3.1);接口不可用不影响页面(保留内置两态) */
async function loadMeta() {
  try {
    const m = await procCardApi.meta()
    const states = m?.['卡状态']
    if (Array.isArray(states) && states.length) statusOptions.value = states
  } catch { /* meta 拿不到不阻断 */ }
}

onMounted(() => {
  loadMeta()
  loadBatches()
  mq?.addEventListener?.('change', onMq)
})

onBeforeUnmount(() => {
  mq?.removeEventListener?.('change', onMq)
})
</script>

<style scoped>
.pfc { padding: 6px 10px 12px; height: 100%; box-sizing: border-box; overflow: auto; background: #fff; }
.pfc-tabs :deep(.el-tabs__header) { margin: 0 0 8px; }

/* 查询/动作条:窄屏自动换行,控件高度 ≥40px(手机上点得中) */
.pfc-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.pfc-lb { flex: none; font-size: 12px; color: var(--el-text-color-regular); }
.pfc-batch { width: 200px; }
.pfc-kw { width: 140px; }
.pfc-kw-sm { width: 132px; }
.pfc-date { width: 130px; }
.pfc-sep { font-size: 12px; color: var(--el-text-color-secondary); }
@media (max-width: 899px) {
  .pfc-batch, .pfc-kw, .pfc-kw-sm, .pfc-date { width: calc(50% - 4px); }
  .pfc-bar :deep(.el-button) { min-height: 40px; }
  .pfc-bar :deep(.el-input__wrapper) { min-height: 40px; }
}

/* 双栏:窄屏单列(列表在上、卡面在下),≥900px 左列表右卡面(契约 §5) */
.pfc-split { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-items: start; }
@media (min-width: 900px) {
  .pfc-split { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
  .pfc-list { position: sticky; top: 0; }
}
.pfc-list, .pfc-detail { min-width: 0; }
.pfc-detail {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 10px;
  background: var(--el-bg-color);
}

.pfc-empty { padding: 30px 12px; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.pfc-muted { color: var(--el-text-color-placeholder); }
.pfc-hint { font-size: 11px; color: var(--el-text-color-secondary); }
.pfc-tag {
  margin-left: 6px; padding: 0 6px; border-radius: 4px; font-size: 11px;
  background: var(--el-fill-color); color: var(--el-text-color-regular);
}

.pfc-linecard { display: flex; flex-direction: column; gap: 10px; }
.pfc-linecard-no { font-size: 15px; font-weight: 600; }
.pfc-kv {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 10px;
  padding: 8px 10px; border-radius: 6px; background: var(--el-fill-color-lighter); font-size: 12px;
}
@media (min-width: 900px) { .pfc-kv { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.pfc-kv > div { display: flex; gap: 6px; min-width: 0; }
.pfc-kv span { flex: none; color: var(--el-text-color-secondary); }
.pfc-kv b { font-weight: 500; min-width: 0; word-break: break-all; }
.pfc-create { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pfc-create :deep(.el-button) { min-height: 40px; }

/* 页签③ 汇总卡 + 工序汇总 */
.pfc-sum { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.pfc-stat {
  flex: 1 1 110px; padding: 8px 12px; border-radius: 8px;
  background: var(--el-fill-color-lighter); border: 1px solid var(--el-border-color-lighter);
}
.pfc-stat b { display: block; font-size: 20px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.pfc-stat span { font-size: 11px; color: var(--el-text-color-secondary); }
.pfc-sum-ops { margin-bottom: 10px; }
.pfc-sec-title { margin-bottom: 6px; font-size: 13px; font-weight: 600; }

.pfc-page { display: flex; justify-content: flex-end; padding-top: 8px; }
@media (max-width: 899px) { .pfc-page { justify-content: center; } }
.num { font-variant-numeric: tabular-nums; }
</style>
