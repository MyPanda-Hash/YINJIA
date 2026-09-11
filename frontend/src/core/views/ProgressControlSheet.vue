<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       产品开发二三四级项目控制列表(RD_PROGRESS)——文件类文书面板
       版式对齐原图:公司头/右上文档编号/蓝色大标题/右上信息区(密级、使用范围)/
       项目定级原则说明段/主从控制大表(项目等级|项目名称 + 子项目行,可增删)
       项目名称可手填或选择项目实施计划(选中自动带回实施计划同名字段)
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="progress-sheet">
    <!-- ① 顶部条 -->
    <div class="ps-topbar">
      <div class="ps-company">惠州市银嘉环保科技有限公司</div>
      <div class="ps-docno">
        <el-input
          v-if="editable"
          v-model="head['文档编号']"
          size="small"
          maxlength="30"
          class="ps-docno-input"
          @input="emit('dirty')"
        />
        <template v-else>{{ head['文档编号'] || 'YJ-XS002' }}</template>
      </div>
    </div>

    <!-- ② 标题行:大标题 + 右上信息区(密级/使用范围) -->
    <div class="ps-title-row">
      <div class="ps-title">{{ tt('产品开发二三四级项目控制列表') }}</div>
      <div class="ps-info-table">
        <div class="ps-info-row">
          <span class="ps-info-label">{{ tt('密级') }}</span>
          <span class="ps-info-value">
            <el-select
              v-if="editable"
              v-model="head['密级']"
              size="small"
              class="ps-cell-input"
              :clearable="false"
              @change="emit('dirty')"
            >
              <el-option v-for="o in selectOptions('密级')" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <template v-else>{{ head['密级'] || '' }}</template>
          </span>
        </div>
        <div class="ps-info-row">
          <span class="ps-info-label">{{ tt('文件使用范围') }}</span>
          <span class="ps-info-value">
            <el-select
              v-if="editable"
              v-model="head['文件使用范围']"
              size="small"
              class="ps-cell-input"
              :clearable="false"
              @change="emit('dirty')"
            >
              <el-option v-for="o in selectOptions('文件使用范围')" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <template v-else>{{ head['文件使用范围'] || '' }}</template>
          </span>
        </div>
      </div>
    </div>

    <!-- ③ 项目定级原则说明段(打印/导出保留,原图固定文本) -->
    <div class="ps-principle">{{ tt('项目定级原则') }}：1. 二级项目=形成B级客户或该产品一年内有望给经济收益、对应技术产品有重大推广价值、部分对客户新品有重大影响的项目；2. 三级项目=针对小批量订单或客户有较大需求、能够为下一年下半年带来显著收益的项目；3. 四级项目=单机项目（型试验单）。</div>

    <!-- ⑤ 主从控制表 -->
    <div class="ps-scroll">
      <table class="ps-table">
        <thead>
          <tr>
            <th class="c-level">{{ tt('项目等级') }}</th>
            <th class="c-name">{{ tt('项目名称') }}</th>
            <th class="c-sub">{{ tt('子项目/尺寸') }}</th>
            <th class="c-remark">{{ tt('项目编号') }}</th>
            <th class="c-content">{{ tt('内容') }}</th>
            <th class="c-grade">{{ tt('项目发起人') }}</th>
            <th class="c-owner">{{ tt('项目负责人') }}</th>
            <th class="c-progress">{{ tt('立项日期') }}</th>
            <th class="c-mile">{{ tt('预计完成日期') }}</th>
            <th class="c-status">{{ tt('状态') }}</th>
            <th class="c-tester">{{ tt('测试情况') }}</th>
            <th class="c-approve">{{ tt('技术目标达成') }}</th>
            <th class="c-inspect">{{ tt('是否市场转化') }}</th>
            <th class="c-reason">{{ tt('未转换原因') }}</th>
            <th v-if="editable" class="c-op"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in items" :key="row.id ?? ('new' + i)">
            <td v-if="isLevelHead(i)" class="c-level" :rowspan="levelSpan(i)">
              <el-select
                v-if="editable"
                :model-value="row[K['项目等级']]"
                size="small"
                :clearable="false"
                @change="changeGroupLevel(i, $event)"
              >
                <el-option v-for="o in selectOptions('项目层级')" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <span v-else class="ps-level-block">{{ row[K['项目等级']] || '' }}</span>
            </td>
            <td v-if="isGroupHead(i)" class="c-name" :rowspan="groupSpan(i)">
              <el-select
                v-if="editable"
                :model-value="row[K['项目名称']]"
                filterable
                allow-create
                default-first-option
                clearable
                size="small"
                :loading="refLoading"
                @change="changeGroupName(i, $event)"
              >
                <el-option v-for="o in refOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <span v-else class="ps-cell-text ps-name-block">{{ row[K['项目名称']] || '' }}</span>
            </td>
            <td class="c-sub">
              <el-input v-if="editable" v-model="row[K['子项目/尺寸']]" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" class="ps-cell-input" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row[K['子项目/尺寸']] || '' }}</span>
            </td>
            <td class="c-remark">
              <!-- 项目编号(=立项申请文档编号):点击查该项目全部数据记录表单据(测试/功能性等可多张) -->
              <div v-if="row[K['项目编号']]" class="ps-code-cell">
                <el-input v-if="editable" v-model="row[K['项目编号']]" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" class="ps-cell-input" @input="emit('dirty')" />
                <span v-else class="ps-cell-text">{{ row[K['项目编号']] }}</span>
                <span class="ps-code-link no-print" :title="tt('查看该项目的数据记录表单据')" @click.stop="emit('open-sheets', row)">📄</span>
              </div>
              <template v-else>
                <el-input v-if="editable" v-model="row[K['项目编号']]" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" class="ps-cell-input" @input="emit('dirty')" />
                <span v-else class="ps-cell-text">{{ row[K['项目编号']] || '' }}</span>
              </template>
            </td>
            <td class="c-content">
              <el-input v-if="editable" v-model="row[K['内容']]" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="ps-cell-input" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row[K['内容']] || '' }}</span>
            </td>
            <td class="c-grade">
              <el-input v-if="editable" v-model="row[K['项目发起人']]" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row[K['项目发起人']] || '' }}</span>
            </td>
            <td class="c-owner">
              <el-input v-if="editable" v-model="row[K['项目负责人']]" size="small" class="ps-cell-input" maxlength="100" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row[K['项目负责人']] || '' }}</span>
            </td>
            <td class="c-progress">
              <el-input v-if="editable" v-model="row[K['立项日期']]" size="small" class="ps-cell-input" maxlength="200" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row[K['立项日期']] || '' }}</span>
            </td>
            <td class="c-mile">
              <el-input v-if="editable" v-model="row[K['预计完成日期']]" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row[K['预计完成日期']] || '' }}</span>
            </td>
            <td class="c-status">
              <!-- 状态=按实施计划阶段自动派生(只读):点它看阶段计划与完成情况 -->
              <span
                v-if="progressText(row)"
                class="ps-status-tag"
                :class="progressToneOf(row)"
                :title="tt('点击查看阶段计划')"
                @click="openStageDialog(row)"
              >{{ progressText(row) }}</span>
              <span v-else class="ps-cell-text">—</span>
            </td>
            <td class="c-tester">
              <el-input v-if="editable" v-model="row[K['测试情况']]" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="ps-cell-input" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row[K['测试情况']] || '' }}</span>
            </td>
            <td class="c-approve">
              <el-input v-if="editable" v-model="row[K['技术目标达成']]" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row[K['技术目标达成']] || '' }}</span>
            </td>
            <td class="c-inspect">
              <el-input v-if="editable" v-model="row[K['是否市场转化']]" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row[K['是否市场转化']] || '' }}</span>
            </td>
            <td class="c-reason">
              <el-input v-if="editable" v-model="row[K['未转换原因']]" type="textarea" :autosize="{ minRows: 1, maxRows: 5 }" size="small" class="ps-cell-input" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row[K['未转换原因']] || '' }}</span>
            </td>
            <td v-if="editable" class="c-op">
              <span class="ps-addrow" :title="tt('在该项目后新增子项目')" @click="insertAfter(i)">＋</span>
              <span class="ps-del" :title="tt('删除该子项目')" @click="removeItem(i)">×</span>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td :colspan="editable ? 15 : 14" class="ps-empty">{{ tt('暂无子项目，点击下方按钮新增') }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="editable" class="ps-addbar">
        <div class="ps-add" @click="openAddProject">＋ {{ tt('新增项目') }}</div>
        <div class="ps-add" @click="syncStageProgress">⟳ {{ tt('同步阶段进度') }}</div>
        <div class="ps-add" @click="pickImportFile">⬆ {{ tt('导入Excel') }}</div>
        <span class="ps-addbar-tip">{{ tt('导入Excel列与面板一致（项目等级/项目名称/子项目尺寸/项目编号/内容/项目发起人/项目负责人/立项日期/预计完成日期/状态/测试情况/技术目标达成/是否市场转化/未转换原因），导入后自动追加子项目行，请保存入库。') }}</span>
        <input ref="fileRef" type="file" accept=".xlsx,.xls" style="display: none" @change="importExcelFile" />
      </div>
    </div>

    <!-- 新增项目弹窗:选等级 + 项目名称(手填/选项目实施计划项目,选项带实施计划单据号,选中导入相关信息) -->
    <el-dialog v-model="dlgVisible" :title="tt('新增项目')" width="400px" append-to-body>
      <div class="ps-dlg-row">
        <span class="ps-dlg-label">{{ tt('项目等级') }}</span>
        <el-select v-model="dlgLevel" size="default" :clearable="false" style="width: 220px">
          <el-option v-for="o in selectOptions('项目层级')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </div>
      <div class="ps-dlg-row">
        <span class="ps-dlg-label">{{ tt('项目名称') }}</span>
        <el-select
          v-model="dlgName"
          filterable
          allow-create
          default-first-option
          clearable
          size="default"
          style="width: 220px"
          :loading="refLoading"
        >
          <el-option v-for="o in refOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </div>
      <div class="ps-dlg-row ps-dlg-row-top">
        <span class="ps-dlg-label">{{ tt('子项目/尺寸') }}</span>
        <el-input
          v-model="dlgSub"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 3 }"
          size="default"
          style="width: 220px"
          maxlength="200"
          :placeholder="tt('必填')"
        />
      </div>
      <div class="ps-dlg-tip">{{ tt('下拉可选择项目实施计划项目（含其实施计划单号），选中后自动导入实施计划相关信息；也可直接输入新项目名称。') }}</div>
      <template #footer>
        <el-button @click="dlgVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="confirmAddProject">{{ tt('确定') }}</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 阶段计划弹窗(点状态列打开,只读):实施计划的阶段 + 完成/未完成/逾期 ═══ -->
    <el-dialog v-model="stageDlgVisible" :title="tt('项目阶段计划')" width="900px" append-to-body>
      <div class="psd-head">
        <span>{{ tt('项目名称') }}：<b>{{ stageDlgName }}</b></span>
        <span v-if="stageDlgPlan">{{ tt('实施计划') }}：{{ stageDlgPlan.planNo }}</span>
      </div>
      <template v-if="stageDlgStages.length">
        <div class="psd-sum">
          <span class="ps-status-tag" :class="progressToneOf(stageDlgRow)">{{ statusText(stageDlgSummary) }}</span>
          <span>{{ tt('已完成') }} {{ stageDlgSummary.done }} · {{ tt('未完成') }} {{ stageDlgSummary.total - stageDlgSummary.done }}<template v-if="stageDlgSummary.overdue"> · {{ tt('逾期') }} {{ stageDlgSummary.overdue }}</template></span>
          <span v-if="stageDlgSummary.next" class="psd-next">
            {{ tt('下一阶段') }}：{{ tt('阶段') }}{{ stageDlgSummary.next.no }} {{ stageDlgSummary.next.content }}<template v-if="stageDlgSummary.next.due">（{{ tt('计划完成') }} {{ stageDueText(stageDlgSummary.next.due) }}）</template>
          </span>
        </div>
        <el-table :data="stageDlgStages" size="small" border max-height="420" class="psd-table">
          <el-table-column type="index" :label="tt('序号')" width="52" align="center" />
          <el-table-column prop="content" :label="tt('计划内容')" min-width="240" show-overflow-tooltip />
          <el-table-column :label="tt('计划开始')" width="104" align="center">
            <template #default="{ row }">{{ stageDueText(row.start) }}</template>
          </el-table-column>
          <el-table-column :label="tt('计划完成')" width="104" align="center">
            <template #default="{ row }">{{ stageDueText(row.due) }}</template>
          </el-table-column>
          <el-table-column :label="tt('实际完成')" width="104" align="center">
            <template #default="{ row }">{{ stageDueText(row.actual) }}</template>
          </el-table-column>
          <el-table-column prop="owner" :label="tt('责任人')" width="96" />
          <el-table-column :label="tt('状态')" width="92" align="center">
            <template #default="{ row }">
              <span class="ps-status-tag" :class="stageBadgeTone(row)">{{ stageBadgeText(row) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </template>
      <div v-else class="psd-empty">
        <template v-if="stageDlgPlan">{{ tt('该实施计划尚未录入阶段内容') }}</template>
        <template v-else>{{ tt('未找到同名项目实施计划，请先在项目实施计划中录入阶段') }}</template>
      </div>
      <template #footer>
        <el-button @click="stageDlgVisible = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { pickStages, stageRowState, statusLabel, STATUS_TOKENS, statusTone, summarizeStages } from '@core/progress/stageProgress'
import * as XLSX from 'xlsx'
import { PROGRESS_COLUMNS, readCell } from '@core/progress/progressColumns'

/**
 * 界面显示名 → 落库数据键 的映射(唯一真源见 progressColumns.js)。
 *
 * 表头仍显示业务名称,但写进 detail 行的 **键** 必须是 RD_PROGRESS 的元数据列名,
 * 否则后端 ButtonService.labelsToCols(def.fields(), item) 会按元数据把它过滤掉,
 * 值保存后就消失(自动导入写的「预计完成日期」「项目负责人」就是这么丢的)。
 */
const K = Object.fromEntries(PROGRESS_COLUMNS.map((c) => [c.label, c.key]))

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty', 'open-sheets'])

const engine = usePanelRuntime()

/** 子项目行(来自当前单据 detail.items;新增行无 id,保存后由引擎写入) */
const items = computed(() => {
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
function selectOptions(key) {
  const f = fieldMap.value.get(key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// ---------- 项目名称:填选实施计划项目(≤200 条选项;选中带回实施计划同名字段+阶段进度) ----------
const refOptions = ref([])
const refRows = ref([])
const refLoading = ref(false)
const planStageMap = ref({}) // 项目名称 → {planNo, head, stages, summary}
/** 今天(YYYY-MM-DD):逾期判定基准 */
function todayStr() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
async function loadRefOptions() {
  if (refOptions.value.length) return
  refLoading.value = true
  try {
    const res = await engine.queryFormDataList({ panelCode: 'RD_PLAN', condition: {}, pageNo: 1, pageSize: 200 })
    const rows = res.list || []
    refRows.value = rows
    // 选项:项目名称（实施计划单号）;同时按阶段进度口径(共用 core/progress 纯函数)提取阶段与汇总
    const stageMap = {}
    const today = todayStr()
    refOptions.value = rows
      .filter((r) => r[K['项目名称']])
      .map((r) => {
        const stages = pickStages(r)
        const summary = summarizeStages(stages, today)
        const planNo = r['单据编号'] || r['编号'] || ''
        const prev = stageMap[r[K['项目名称']]]
        // 同名多张实施计划:取最新一张(列表按单据编号倒序,先到的即最新)
        if (!prev) stageMap[r[K['项目名称']]] = { planNo, head: r, stages, summary, 负责人: r['负责人'] || '' }
        return { value: r[K['项目名称']], label: `${r[K['项目名称']]}（${planNo}）` }
      })
    planStageMap.value = stageMap
    applyDerivedStatus()
  } catch (e) {
    /* 实施计划未就绪时静默 */
  } finally {
    refLoading.value = false
  }
}
onMounted(loadRefOptions)
watch(() => props.editable, (v) => { if (v) loadRefOptions() })

// ---------- 状态列 = 阶段进度自动派生(只读) ----------
/** 状态文案:逐词 tt() 组句,数字由界面拼(便于多语言) */
function statusText(summary) {
  if (!summary) return tt(STATUS_TOKENS.no_plan)
  if (summary.state === 'none') return tt(STATUS_TOKENS.none)
  if (summary.state === 'not_started') return `${tt(STATUS_TOKENS.not_started)} 0/${summary.total}`
  if (summary.state === 'done') return `${tt(STATUS_TOKENS.done)} ${summary.done}/${summary.total}`
  const base = `${tt(STATUS_TOKENS.doing)} ${summary.done}/${summary.total}`
  return summary.overdue > 0 ? `${base} · ${tt(STATUS_TOKENS.overdue)} ${summary.overdue}` : base
}
/** 该行的实施计划(按项目名称关联;同名多张取最新) */
function planOf(row) {
  const name = String(row?.[K['项目名称']] || '').trim()
  return name ? planStageMap.value[name] || null : null
}
function progressText(row) {
  const name = String(row?.[K['项目名称']] || '').trim()
  if (!name) return ''
  const plan = planStageMap.value[name]
  if (!plan) return Object.keys(planStageMap.value).length ? tt(STATUS_TOKENS.no_plan) : ''
  return statusText(plan.summary)
}
function progressToneOf(row) {
  const plan = planOf(row)
  return plan ? statusTone(plan.summary) : 'idle'
}
/** 载入/刷新把派生状态写回行模型:列表、导出、保存入库口径一致 */
function applyDerivedStatus() {
  const rows = items.value || []
  if (!rows.length || !Object.keys(planStageMap.value).length) return
  for (const row of rows) {
    const name = String(row?.[K['项目名称']] || '').trim()
    if (!name) continue
    const plan = planStageMap.value[name]
    if (plan) row[K['状态']] = statusLabel(plan.summary)
  }
}
watch(items, () => applyDerivedStatus(), { deep: false })

// ---------- 点状态 → 阶段计划弹窗(只读) ----------
const stageDlgVisible = ref(false)
const stageDlgName = ref('')
const stageDlgRow = ref(null)
function openStageDialog(row) {
  const name = String(row?.[K['项目名称']] || '').trim()
  if (!name) {
    ElMessage.warning(tt('请先填写项目名称'))
    return
  }
  stageDlgName.value = name
  stageDlgRow.value = row
  stageDlgVisible.value = true
}
const stageDlgPlan = computed(() => planStageMap.value[stageDlgName.value] || null)
const stageDlgStages = computed(() => (stageDlgPlan.value ? stageDlgPlan.value.stages : []))
const stageDlgSummary = computed(() => (stageDlgPlan.value ? stageDlgPlan.value.summary : null))
const stageDlgToday = computed(() => todayStr())
function stageBadgeTone(stage) {
  return stageRowState(stage, stageDlgToday.value)
}
function stageBadgeText(stage) {
  const state = stageBadgeTone(stage)
  if (state === 'done') return tt('已完成')
  if (state === 'overdue') return tt('逾期')
  return tt('进行中')
}
function stageDueText(due) {
  return String(due || '').replace(/\//g, '-') || '—'
}
/** 项目预计完成日期 = 最后一个有内容的阶段的计划完成(缺则取实际完成最大值) */
function planDueDate(plan) {
  if (!plan) return ''
  const pick = (key) => (plan.stages || [])
    .map((s) => String(s[key] || '').replace(/\//g, '-'))
    .filter(Boolean)
    .sort()
  const dues = pick('due')
  if (dues.length) return dues[dues.length - 1]
  const actuals = pick('actual')
  return actuals.length ? actuals[actuals.length - 1] : ''
}

// ---------- 项目(组)/子项目 行增删 ----------/** 组首行:与上一行项目名称不同(或首行) → 显示 项目名称/层级 输入,否则并入上一组 */
function isGroupHead(i) {
  if (i <= 0) return true
  return items.value[i]?.[K['项目名称']] !== items.value[i - 1]?.[K['项目名称']]
}
/** 等级头行:只读态相邻同级合并为一个"项目等级"块 */
function isLevelHead(i) {
  if (i <= 0) return true
  const lv = items.value[i]?.[K['项目等级']]
  if (!lv) return true
  return items.value[i - 1]?.[K['项目等级']] !== lv
}
/** 相邻同级行数(等级合并块) */
function levelSpan(i) {
  if (!isLevelHead(i)) return 0
  const lv = items.value[i]?.[K['项目等级']]
  if (!lv) return 1
  let n = 1
  while (i + n < items.value.length && items.value[i + n]?.[K['项目等级']] === lv) n++
  return n
}
/** 组内行数(名称列 rowspan 合并铺满整组;空名称新组不合并) */
function groupSpan(i) {
  if (!isGroupHead(i)) return 0
  const name = items.value[i]?.[K['项目名称']]
  if (!name) return 1
  let n = 1
  while (i + n < items.value.length && items.value[i + n]?.[K['项目名称']] === name) n++
  return n
}
/** 组首行名称变更:同步组内同名行 + 选实施计划项目带回同名字段 */
function changeGroupName(i, v) {
  const row = items.value[i]
  const old = row[K['项目名称']]
  row[K['项目名称']] = v
  let j = i + 1
  while (j < items.value.length && items.value[j][K['项目名称']] === old) {
    items.value[j][K['项目名称']] = v
    j++
  }
  const found = refRows.value.find((r) => r[K['项目名称']] === v)
  if (found) {
    const keys = ['项目定级', '测试内容', '测试产品打样要求', '测试目标', '测试条件', '测试方法', '测试标准']
    for (const k of keys) {
      if (found[k] != null && found[k] !== '') props.head[k] = found[k]
    }
  }
  emit('dirty')
}
/** 同步组内层级(组首行层级变更时) */
function changeGroupLevel(i, v) {
  const row = items.value[i]
  row[K['项目等级']] = v
  for (let j = i + 1; j < items.value.length && items.value[j]?.[K['项目名称']] === row[K['项目名称']]; j++) {
    items.value[j][K['项目等级']] = v
  }
  emit('dirty')
}
/** 新增项目:点击按钮弹窗(选等级 + 项目名称 手填/选实施计划项目),自动归入对应等级块 */
const dlgVisible = ref(false)
const dlgName = ref('')
const dlgLevel = ref('二级')
/** 子项目/尺寸:明细必填项,新增时就一起填,否则整张单据保存会被校验拦下 */
const dlgSub = ref('')
function openAddProject() {
  dlgName.value = ''
  dlgLevel.value = '二级'
  dlgSub.value = ''
  dlgVisible.value = true
}
function confirmAddProject() {
  const name = String(dlgName.value || '').trim()
  if (!name) {
    ElMessage.warning(tt('请填写项目名称'))
    return
  }
  const sub = String(dlgSub.value || '').trim()
  if (!sub) {
    // 子项目/尺寸 是明细必填项:这里拦住并说清楚,免得点了保存才被后端拒绝
    ElMessage.warning(tt('请填写子项目/尺寸'))
    return
  }
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  const lv = dlgLevel.value || '二级'
  const row = { [K['项目名称']]: name, [K['项目等级']]: lv, [K['子项目/尺寸']]: sub }
  let idx = -1
  for (let i = d.items.length - 1; i >= 0; i--) {
    if (d.items[i][K['项目等级']] === lv) { idx = i; break }
  }
  if (idx >= 0) d.items.splice(idx + 1, 0, row)
  else d.items.push(row)
  // 选实施计划项目:自动导入实施计划相关信息(项目定级/测试内容/…)
  const found = refRows.value.find((r) => r[K['项目名称']] === name)
  if (found) {
    const keys = ['项目定级', '测试内容', '测试产品打样要求', '测试目标', '测试条件', '测试方法', '测试标准']
    for (const k of keys) {
      if (found[k] != null && found[k] !== '') props.head[k] = found[k]
    }
  }
  // 自动导入阶段进度到「状态」列(与状态列同一口径:core/progress 纯函数)
  const plan = planStageMap.value[name]
  if (plan) {
    row[K['状态']] = statusLabel(plan.summary)
    const due = planDueDate(plan)
    if (due) row[K['预计完成日期']] = due
    if (plan.负责人) row[K['项目负责人']] = plan.负责人
  }
  dlgVisible.value = false
  emit('dirty')
}
/** 在当前子项目后插入同组新子项目(复制所属项目名称/层级) */

/** 同步阶段进度:遍历所有子项目行,从实施计划阶段数据刷新「状态」「预计完成日期」「项目负责人」 */
function syncStageProgress() {
  const d = props.head.detail
  if (!d || !Array.isArray(d.items) || !d.items.length) {
    ElMessage.warning(tt('暂无子项目可同步'))
    return
  }
  let updated = 0
  for (const row of d.items) {
    const name = row[K['项目名称']]
    if (!name) continue
    const stage = planStageMap.value[name]
    if (!stage) continue
    row[K['状态']] = statusLabel(stage.summary)
    const due = planDueDate(stage)
    if (due) row[K['预计完成日期']] = due
    if (stage.负责人) row[K['项目负责人']] = stage.负责人
    updated++
  }
  if (updated > 0) {
    ElMessage.success(tt('已同步') + ` ${updated} ` + tt('个子项目的阶段进度') + tt('，请保存入库'))
    emit('dirty')
  } else {
    ElMessage.warning(tt('未找到与实施计划匹配的项目(请确认项目名称一致)'))
  }
}

function insertAfter(i) {
  const d = props.head.detail
  if (!Array.isArray(d.items)) return
  const src = d.items[i] || {}
  d.items.splice(i + 1, 0, { [K['项目名称']]: src[K['项目名称']], [K['项目等级']]: src[K['项目等级']] })
  emit('dirty')
}
function removeItem(i) {
  const d = props.head.detail
  if (d && Array.isArray(d.items)) d.items.splice(i, 1)
  emit('dirty')
}

/** 导入 Excel(模板 14 列):解析后追加子项目行到当前控制列表 */
const fileRef = ref(null)
function pickImportFile() {
  fileRef.value?.click()
}
function importExcelFile(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const d = props.head.detail || (props.head.detail = {})
      if (!Array.isArray(d.items)) d.items = []
      let added = 0
      for (const r of rows) {
        const name = String(readCell(r, '项目名称') || '').trim()
        if (!name) continue
        const item = {}
        // Excel 表头是"显示名",落库键取 PROGRESS_COLUMNS 的 key(见 progressColumns.js)
        for (const col of PROGRESS_COLUMNS) {
          const v = readCell(r, col.label)
          if (v === undefined || v === null || v === '') continue
          item[col.key] = String(v)
        }
        item[K['项目名称']] = name
        if (!item[K['项目等级']]) item[K['项目等级']] = '二级'
        d.items.push(item)
        added++
      }
      if (!added) {
        ElMessage.warning(tt('未识别到有效数据（请确认首行为面板列头且含项目名称）'))
        return
      }
      ElMessage.success(`${tt('已导入')} ${added} ${tt('行，请保存入库')}`)
      emit('dirty')
    } catch (err) {
      ElMessage.error(tt('导入失败') + '：' + (err.message || ''))
    }
  }
  reader.readAsArrayBuffer(file)
}

/** 导出 Excel:面板块信息 + 全部字段列 + 全部数据行(内容完整,不受列宽/纸张限制) */function exportProgressExcel() {
  const head = props.head || {}
  const rows = (head.detail && Array.isArray(head.detail.items) ? head.detail.items : [])
  const title = '产品开发二三四级项目控制列表'
  const info = `惠州市银嘉环保科技有限公司　　文档编号：${head['文档编号'] || 'YJ-XS002'}　　密级：${head['密级'] || ''}　　使用范围：${head['文件使用范围'] || ''}　　单据编号：${head['单据编号'] || ''}`
  // 表头=显示名(label);取数=落库键(key);列宽也用同一份定义(见 progressColumns.js)
  const header = PROGRESS_COLUMNS.map((c) => c.label)
  const data = rows.map((r) => PROGRESS_COLUMNS.map((c) => r[c.key]))
  const aoa = [[title], [info], [], header, ...data]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = PROGRESS_COLUMNS.map((c) => ({ wch: c.width }))
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } }]
  // 表头加粗 + 数据单元格自动换行
  const cols = header.length
  for (let c = 0; c < cols; c++) {
    const cell = ws[{ r: 3, c }]
    if (cell) cell.s = { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true }, fill: { fgColor: { rgb: 'D9ECFB' } } }
  }
  for (let r = 4; r < aoa.length; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = ws[{ r, c }]
      if (cell) cell.s = { alignment: { vertical: 'top', wrapText: true } }
    }
  }
  const c0 = ws[{ r: 0, c: 0 }]
  if (c0) c0.s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } }
  const c1 = ws[{ r: 1, c: 0 }]
  if (c1) c1.s = { font: { sz: 10, color: { rgb: '666666' } }, alignment: { horizontal: 'left' } }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
  XLSX.writeFile(wb, `${title}-${head['单据编号'] || head['文档编号'] || '导出'}.xlsx`)
}

defineExpose({ exportProgressExcel })
</script>

<style scoped>
/* ═══ 纸张主体(宽表格,原图纵横向扩展) ═══ */
.progress-sheet {
  width: calc(100vw - 300px);
  min-width: 900px;
  max-width: 1760px;
  margin: 16px auto 26px;
  background: #fff;
  border: 1px solid #8a8a8a;
  font-size: 13px;
  color: #222;
}
.progress-sheet :deep(.ps-cell-input) {
  width: 100%;
}
/* 填写控件去边框:白纸观感,内容直接写在格子内(聚焦亦无框) */
.progress-sheet :deep(.el-input__wrapper),
.progress-sheet :deep(.el-input__wrapper.is-focus),
.progress-sheet :deep(.el-textarea__inner),
.progress-sheet :deep(.el-textarea__inner:focus) {
  box-shadow: none !important;
  border: none;
  background: transparent;
}
.progress-sheet :deep(.el-input__inner),
.progress-sheet :deep(.el-textarea__inner) {
  font-size: 13px;
  padding: 0;
  line-height: 1.6;
}
.progress-sheet :deep(.ps-info-table .el-select__wrapper),
.progress-sheet :deep(.ps-select-row .el-select__wrapper) {
  border: 1px solid #c8d6e5;
  background: #fff;
  min-height: 24px;
}

/* ═══ ① 顶部条 ═══ */
.ps-topbar {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
  height: 40px;
}
.ps-company {
  flex: 1;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 17px;
  color: #333;
  padding: 7px 12px 0;
}
.ps-docno {
  width: 250px;
  flex: none;
  border-left: 1px solid #8a8a8a;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 14px;
  color: #333;
  text-align: right;
  padding: 8px 14px 0;
  display: flex;
  justify-content: flex-end;
}
.ps-docno-input {
  width: 130px;
}
.ps-docno-input :deep(.el-input__inner) {
  text-align: right;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 14px;
  padding: 0;
}

/* ═══ ② 标题行 + 信息区 ═══ */
.ps-title-row {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
  min-height: 60px;
}
.ps-title {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 30px;
  font-weight: 600;
  color: #1f5fa8;
  letter-spacing: 3px;
}
.ps-info-table {
  width: 250px;
  flex: none;
  border-left: 1px solid #8a8a8a;
  display: flex;
  flex-direction: column;
}
.ps-info-row {
  display: flex;
  flex: 1;
}
.ps-info-row + .ps-info-row {
  border-top: 1px solid #c9c9c9;
}
.ps-info-label {
  width: 100px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 13px;
  color: #1f5fa8;
}
.ps-info-value {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 8px;
  border-left: 1px solid #c9c9c9;
  font-size: 13px;
}

/* ═══ ④ 原则说明段(浅粉底) ═══ */
.ps-principle {
  padding: 6px 14px;
  background: #fdeef0;
  border-bottom: 1px solid #8a8a8a;
  font-size: 12.5px;
  line-height: 1.6;
  color: #6b3a3a;
}

/* ═══ ⑤ 控制表 ═══ */
.ps-scroll {
  overflow: auto;
  max-height: calc(100vh - 320px);
  min-height: 220px;
}
.ps-table {
  width: 100%;
  min-width: 1480px;
  border-collapse: collapse;
  table-layout: auto;
}
.ps-table th,
.ps-table td {
  border: 1px solid #9a9a9a;
  padding: 3px 5px;
  vertical-align: middle;
  font-size: 12.5px;
}
.ps-table th {
  position: sticky;
  top: 0;
  z-index: 3;
  background: #b9dbf8;
  color: #1f5fa8;
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
  text-decoration: underline;
}
.ps-table td {
  background: #fff;
  height: 24px;
}
.ps-table tr:hover td {
  background: #f7fbff;
}
.c-level { min-width: 70px; }
.c-name { min-width: 160px; }
/* 项目名称合并块:铺满组内子项目行,浅蓝底,文字居中(对齐原图) */
.ps-table td.c-name {
  background: #d9ecfb;
  color: #1f5fa8;
  vertical-align: middle;
  text-align: center;
}
.ps-name-block {
  display: inline-block;
  width: 100%;
  font-size: 16px;
  font-weight: 600;
  word-break: break-all;
}
/* 项目等级合并块:同级归入同一等级目录只显示一次,深灰蓝底白字,放大居中 */
.ps-table td.c-level {
  background: #7890ab;
  color: #fff;
  vertical-align: middle;
  text-align: center;
}
.ps-level-block {
  display: inline-block;
  width: 100%;
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
  word-break: keep-all;
}
/* 编辑态等级块内下拉底色透明(与块色调和),选中文字完整显示 */
.ps-table td.c-level :deep(.el-select__wrapper) {
  background: transparent;
  box-shadow: none !important;
  border: none;
}
.ps-table td.c-level :deep(.el-select__selected-item) {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  overflow: visible;
}
/* 新增项目条(弹窗入口) */
.ps-addbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin: 6px 8px;
}
.ps-addbar-tip {
  font-size: 11px;
  color: #8a97a6;
  line-height: 1.4;
}
/* 新增项目弹窗 */
.ps-dlg-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.ps-dlg-row-top { align-items: flex-start; }
.ps-dlg-label {
  width: 72px;
  text-align: right;
  color: #333;
  font-weight: 600;
}
.ps-dlg-tip {
  font-size: 12px;
  color: #8a97a6;
  line-height: 1.5;
}
.c-sub { min-width: 140px; }
.c-remark { min-width: 90px; }
.c-content { min-width: 300px; }
.c-grade { min-width: 90px; }
.c-owner { min-width: 110px; }
.c-progress { min-width: 110px; }
.c-mile { min-width: 120px; }
.c-status { min-width: 300px; }
.c-tester { min-width: 200px; }
.c-approve { min-width: 90px; }
.c-inspect { min-width: 90px; }
.c-reason { min-width: 120px; }
.c-op { min-width: 30px; text-align: center; }
/* 长文本列:按内容自适应但设上限,超出自动换行,不被列栏盖住 */
.ps-table td.c-remark,
.ps-table td.c-content,
.ps-table td.c-status,
.ps-table td.c-tester,
.ps-table td.c-reason,
.ps-table td.c-progress {
  max-width: 240px;
}
.ps-table td.c-status {
  max-width: 210px;
}
.ps-table td.c-reason {
  max-width: 170px;
}
.ps-table td.c-remark {
  max-width: 170px;
}
/* 项目编号格:文本+查单图标(打印隐藏;点开该项目的数据记录表单据清单) */
.ps-code-cell {
  display: flex;
  align-items: flex-start;
  gap: 2px;
}
.ps-code-cell .ps-cell-input { flex: 1; }
.ps-code-link {
  flex: none;
  cursor: pointer;
  font-size: 12px;
  line-height: 18px;
  opacity: 0.45;
}
.ps-code-link:hover { opacity: 1; }
@media print { .ps-code-link { display: none !important; } }
.ps-cell-text {
  display: inline-block;
  width: 100%;
  word-break: break-all;
}
/* 状态列:阶段进度标签(可点击查看阶段计划) */
.ps-status-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 9px;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid transparent;
}
.ps-status-tag.idle { background: #f2f3f5; color: #909399; border-color: #e4e7ed; }
.ps-status-tag.doing { background: #eaf4fe; color: #1677ff; border-color: #b9dcff; }
.ps-status-tag.overdue { background: #fff4e6; color: #b26a00; border-color: #ffd9a8; }
.ps-status-tag.done { background: #e8f7ee; color: #1a7f37; border-color: #b7e3c6; }
.ps-status-tag:hover { filter: brightness(0.96); }
/* 阶段计划弹窗 */
.psd-head { display: flex; gap: 18px; align-items: baseline; margin-bottom: 8px; font-size: 13px; color: #303133; }
.psd-sum { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; font-size: 12px; color: #606266; }
.psd-next { color: #1677ff; }
.psd-table :deep(.el-table__cell) { font-size: 12px; }
.psd-empty { padding: 18px 4px; color: #909399; font-size: 13px; }
.ps-addrow {
  display: inline-block;
  color: #0d5bd3;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
  margin-right: 4px;
}
.ps-addrow:hover {
  font-weight: 700;
}
.ps-del {
  display: inline-block;
  color: #c0392b;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
}
.ps-del:hover {
  color: #e74c3c;
  font-weight: 700;
}
.ps-empty {
  text-align: center;
  color: #98a4b3;
  padding: 18px 0 !important;
}
.ps-add {
  margin: 6px 8px;
  padding: 5px 10px;
  border: 1px dashed #8fb4e0;
  border-radius: 4px;
  background: #f4f9ff;
  color: #1c4f8a;
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  user-select: none;
}
.ps-add:hover {
  background: #e8f2ff;
  border-style: solid;
}
</style>

<!-- 打印整张:只保留纸张 -->
<style>
@media print {
  body.approval-printing .portal {
    visibility: hidden;
  }
  body.approval-printing .topbar,
  body.approval-printing .func-zone,
  body.approval-printing .tabsbar,
  body.approval-printing .help-panel,
  body.approval-printing .nav-mask,
  body.approval-printing .approval-side,
  body.approval-printing .tools {
    display: none !important;
  }
  body.approval-printing .portal-body,
  body.approval-printing .portal-main,
  body.approval-printing .portal-content,
  body.approval-printing .panelx-list,
  body.approval-printing .approval-layout {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
    padding-right: 0 !important;
    margin: 0 !important;
  }
  body.approval-printing .progress-sheet {
    visibility: visible !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    border: 1px solid #8a8a8a !important;
    box-shadow: none !important;
  }
  body.approval-printing .progress-sheet,
  body.approval-printing .progress-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .progress-sheet svg {
    display: none !important;
  }
  body.approval-printing .ps-add,
  body.approval-printing .ps-del {
    display: none !important;
  }
  /* 打印按纸张自适应:14 列均分页宽,小字号可断行,避免右侧字段被裁切 */
  body.approval-printing .ps-scroll {
    overflow: visible !important;
    max-height: none !important;
  }
  body.approval-printing .ps-table {
    min-width: 100% !important;
    table-layout: fixed !important;
  }
  body.approval-printing .ps-table th,
  body.approval-printing .ps-table td {
    width: auto !important;
    font-size: 10px !important;
    padding: 1px 2px !important;
    word-break: break-all !important;
    white-space: normal !important;
    height: auto !important;
    line-height: 1.3 !important;
  }
  body.approval-printing .ps-cell-text,
  body.approval-printing .ps-table .el-input__inner,
  body.approval-printing .ps-table .el-textarea__inner {
    font-size: 10px !important;
  }
  body.approval-printing .ps-company,
  body.approval-printing .ps-title {
    font-size: 22px !important;
  }
  @page {
    margin: 8mm;
  }
}
</style>
