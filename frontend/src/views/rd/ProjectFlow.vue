<template>
  <div class="pf-page">
    <header class="pf-head">
      <div class="pf-head-main">
        <h1 class="pf-title">{{ tt('项目流程管控') }}</h1>
        <p class="pf-sub">
          {{ tt('按立项申请单号查这条项目走到哪一步：哪个环节还没审批、哪个环节该谁动手、单据建了内容有没有开始填') }}
        </p>
      </div>
      <p class="pf-source">
        {{ tt('数据来源：立项申请 / 实施方案 / 审批留痕 / 项目进度查询实时计算，本页只读不改单') }}
      </p>
    </header>

    <section class="pf-kpis">
      <article v-for="k in kpiCards" :key="k.key" class="pf-kpi">
        <span class="pf-kpi-label">{{ tt(k.label) }}</span>
        <strong class="pf-kpi-num" :class="'tone-' + k.tone">{{ k.value }}</strong>
        <span class="pf-kpi-hint">{{ tt(k.hint) }}</span>
      </article>
    </section>

    <div class="pf-bar">
      <el-input
        v-model="keyword"
        class="pf-search"
        clearable
        :placeholder="tt('输入项目编号或立项单号（支持片段），如 YJ-RD-2026 / LXA-2026-10')"
        @keyup.enter="load"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button type="primary" :loading="loading" @click="load">{{ tt('查询') }}</el-button>
      <el-checkbox v-model="onlyOpen">{{ tt('只看未完成') }}</el-checkbox>
      <span class="pf-tip">{{ tt('展开行可看 10 步时间轴') }}</span>
    </div>

    <section class="pf-card">
      <div class="pf-card-head">
        <h2 class="pf-card-title">{{ tt('流程清单') }}</h2>
        <span class="pf-card-hint">{{ tt('共') }} {{ rows.length }} {{ tt('条') }}</span>
      </div>
      <el-table
        :data="rows"
        row-key="approvalNo"
        :empty-text="tt('没有符合条件的立项申请')"
        size="small"
        border
        class="pf-table"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="pf-flow">
              <p class="pf-headline" :class="row.flow.canceled ? 'is-cancel' : row.flow.currentKey ? 'is-stuck' : 'is-done'">
                {{ flowText(row.flow) }}
              </p>
              <ol class="pf-steps">
                <li v-for="(st, i) in row.flow.steps" :key="st.key" class="pf-step" :class="'is-' + st.state">
                  <span class="pf-step-idx">{{ i + 1 }}</span>
                  <div class="pf-step-body">
                    <div class="pf-step-row">
                      <span class="pf-step-name">{{ tt(st.name) }}</span>
                      <el-tag size="small" :type="tagType(st.state)" effect="plain">
                        {{ tt(stateText(st.state)) }}
                      </el-tag>
                      <el-tag v-if="st.warn" size="small" type="danger" effect="plain">{{ tt('状态待核') }}</el-tag>
                      <span v-if="st.at" class="pf-step-at">{{ st.at }}</span>
                      <span v-if="st.actor" class="pf-step-actor">{{ st.actor }}</span>
                    </div>
                    <p v-if="st.detail" class="pf-step-detail">{{ tt(st.detail) }}</p>
                  </div>
                </li>
              </ol>
              <dl class="pf-meta">
                <div><dt>{{ tt('立项文档编号') }}</dt><dd>{{ row.approvalDocNo || '-' }}</dd></div>
                <div><dt>{{ tt('申请立项人') }}</dt><dd>{{ row.initiator || '-' }}</dd></div>
                <div><dt>{{ tt('实施计划单号') }}</dt><dd>{{ row.flow.planNo || '-' }}</dd></div>
                <div><dt>{{ tt('最后动作') }}</dt><dd>{{ row.flow.lastActionAt || '-' }}</dd></div>
                <div><dt>{{ tt('进度查询行') }}</dt><dd>{{ (row.progressRows || []).join('；') || '-' }}</dd></div>
              </dl>
            </div>
          </template>
        </el-table-column>
        <!-- 第一列 = 立项申请的**项目编号**(= 文档编号,如 YJ-RD-2026-001)。
             2026-10-30 用户口径「流程管控的立项申请编号应该是立项申请的项目编号来关联」:
             原先直出 approvalNo(引擎自动生成的单据编号 LXA-2026-10-0032),与用户日常找项目
             用的号对不上。老单文档编号可能为空 ⇒ 退回单据编号,否则整列空白。 -->
        <el-table-column :label="tt('项目编号')" width="180">
          <template #default="{ row }">
            <span class="pf-no">{{ row.approvalDocNo || row.approvalNo }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('项目名称')" min-width="160">
          <template #default="{ row }">
            <span class="pf-name">{{ row.projectName || '-' }}</span>
            <span v-if="row.customer" class="pf-muted"> {{ row.customer }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="wide" :label="tt('项目定级')" width="90">
          <template #default="{ row }">{{ row.level || '-' }}</template>
        </el-table-column>
        <el-table-column :label="tt('当前环节')" min-width="190">
          <template #default="{ row }">
            <span v-if="row.flow.canceled" class="pf-badge is-cancel">{{ tt('已弃审/作废') }}</span>
            <span v-else-if="!row.flow.currentKey" class="pf-badge is-done">{{ tt('已完成') }}</span>
            <span v-else class="pf-cur">
              <span class="pf-cur-no">{{ row.flow.steps.findIndex((s) => s.key === row.flow.currentKey) + 1 }}/10</span>
              <span class="pf-cur-name">{{ tt(row.flow.currentName) }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column v-if="wide" :label="tt('待办人')" width="150">
          <template #default="{ row }">
            <span v-if="row.flow.pendingWith.name">{{ row.flow.pendingWith.name }}</span>
            <span v-else class="pf-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column v-if="wide" :label="tt('停留天数')" width="100" align="right">
          <template #default="{ row }">
            <span v-if="!row.flow.currentKey" class="pf-muted">-</span>
            <span v-else :class="row.flow.stuckDays >= 7 ? 'pf-stuck' : ''">{{ row.flow.stuckDays }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="wide" :label="tt('进度')" width="130">
          <template #default="{ row }">
            <div class="pf-progress">
              <span class="pf-progress-txt">{{ row.flow.doneCount }}/{{ row.flow.total }}</span>
              <el-progress
                :percentage="Math.round((row.flow.doneCount / row.flow.total) * 100)"
                :show-text="false"
                :stroke-width="6"
                :color="row.flow.doneCount === row.flow.total ? '#1f8a5b' : '#537786'"
              />
            </div>
          </template>
        </el-table-column>
        <!-- 「一句话状态」不再单独成列:它与「当前环节 / 待办人 / 停留天数」三列重复,
             挤在 1440 宽度里会把最后一列裁掉(实测右侧被切)。一句话状态只留在展开行顶部。 -->
      </el-table>
      <p v-if="truncated" class="pf-foot-tip">
        {{ tt('记录超过 200 条，只显示最近 200 张立项申请；请用单号缩小范围') }}
      </p>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import { apiQueryRdFlow } from '@/business/rdFlowApi'
import { buildFlow } from '@/core/rd/flowStages'

const keyword = ref('')
const onlyOpen = ref(false)
const loading = ref(false)
const projects = ref([])
const names = ref({})
const truncated = ref(false)
/** 窄屏(≤768)只留 4 列:编号 / 项目 / 当前环节 / 一句话状态 —— 否则 el-table 会横向溢出(375 实测 397>375) */
const wide = ref(true)

function syncWidth() {
  wide.value = typeof window === 'undefined' ? true : window.innerWidth > 768
}

/** 当前时刻:判定"停留天数"用(格式与后端 CONVERT 120 对齐,精确到秒即可) */
function nowText() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 每条项目 = 后端事实 + 纯函数算出的流程 */
const decorated = computed(() =>
  projects.value.map((p) => ({ ...p, flow: buildFlow(p, names.value, nowText()) })),
)

/** 表格行:勾了「只看未完成」就滤掉已走完的 */
const rows = computed(() =>
  onlyOpen.value ? decorated.value.filter((r) => r.flow.currentKey) : decorated.value,
)

const kpiCards = computed(() => {
  const list = decorated.value
  const open = list.filter((r) => r.flow.currentKey)
  const slow = open.filter((r) => r.flow.stuckDays >= 7)
  return [
    { key: 'total', label: '在册立项', value: list.length, tone: 'primary', hint: '本次查询到的立项申请' },
    { key: 'open', label: '未走完', value: open.length, tone: open.length ? 'warn' : 'ok', hint: '至少还差一个环节' },
    { key: 'slow', label: '超 7 天没动', value: slow.length, tone: slow.length ? 'bad' : 'ok', hint: '停留 ≥7 天的在办项目' },
    { key: 'done', label: '已进进度查询', value: list.filter((r) => !r.flow.currentKey).length, tone: 'ok', hint: '10 个环节全部完成' },
  ]
})

function tagType(state) {
  if (state === 'done') return 'success'
  if (state === 'active') return 'warning'
  return 'info'
}

function stateText(state) {
  if (state === 'done') return '已完成'
  if (state === 'active') return '进行中'
  return '未开始'
}

/** 一句话状态:i18n 友好 —— 中文原句由 flowStages 产出(供单测断言),显示时按片段过 tt() */
function flowText(flow) {
  if (flow.canceled) return `${tt('已弃审/作废，退回')}「${tt(flow.currentName || '草稿')}」`
  if (!flow.currentKey) return `${tt('全部完成')}（${flow.doneCount}/${flow.total}）`
  let out = `${tt('卡在：')}${tt(flow.currentName)}`
  if (flow.pendingWith.name) out += `，${tt('待办：')}${flow.pendingWith.name}`
  if (flow.stuckDays > 0) out += `，${tt('已停留')} ${flow.stuckDays} ${tt('天')}`
  return out
}

async function load() {
  loading.value = true
  try {
    const data = await apiQueryRdFlow(keyword.value.trim())
    projects.value = data.projects || []
    names.value = data.names || {}
    truncated.value = !!data.truncated
  } catch (e) {
    ElMessage.error(e?.message || tt('加载项目流程失败'))
    projects.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  syncWidth()
  window.addEventListener('resize', syncWidth)
  load()
})

onBeforeUnmount(() => window.removeEventListener('resize', syncWidth))
</script>

<style scoped>
.pf-page {
  --pf-ok: #1f8a5b;
  --pf-warn: #b87816;
  --pf-bad: #b94d3f;
  --pf-ic: #537786;
  padding: 14px 16px 24px;
  min-width: 0;
  color: var(--t-text-1);
}
.pf-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
}
.pf-head-main { min-width: 0; }
.pf-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--t-text-1); }
.pf-sub { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--t-text-3); }
.pf-source {
  margin: 0;
  flex: 1 1 320px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--t-text-3);
  text-align: right;
}
.pf-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.pf-kpi {
  min-width: 0;
  padding: 10px 12px;
  background: var(--t-card-bg);
  border: 1px solid var(--t-border);
  border-radius: 6px;
}
.pf-kpi-label { display: block; font-size: 12px; color: var(--t-text-3); }
.pf-kpi-num {
  display: block;
  margin-top: 2px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--t-text-1);
}
.pf-kpi-num.tone-primary { color: var(--t-primary); }
.pf-kpi-num.tone-ok { color: var(--pf-ok); }
.pf-kpi-num.tone-warn { color: var(--pf-warn); }
.pf-kpi-num.tone-bad { color: var(--pf-bad); }
.pf-kpi-hint { display: block; margin-top: 2px; font-size: 11px; color: var(--t-text-3); }
.pf-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.pf-bar :deep(.el-button) { min-height: 40px; }
.pf-search { width: 300px; max-width: 100%; }
.pf-search :deep(.el-input__wrapper) { min-height: 40px; }
.pf-tip { font-size: 12px; color: var(--t-text-3); }
.pf-card {
  min-width: 0;
  padding: 10px 12px 12px;
  background: var(--t-card-bg);
  border: 1px solid var(--t-border);
  border-radius: 6px;
}
.pf-card-head {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.pf-card-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--t-primary); }
.pf-card-hint { font-size: 12px; color: var(--t-text-3); }
.pf-name { font-weight: 600; }
/* 项目编号(文档编号):等宽数字更易逐位核对,与单据编号的观感区分开 */
.pf-no { font-variant-numeric: tabular-nums; letter-spacing: 0.2px; }
.pf-muted { color: var(--t-text-3); font-size: 12px; }
.pf-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 18px;
}
.pf-badge.is-done { color: var(--pf-ok); background: rgba(31, 138, 91, 0.1); }
.pf-badge.is-cancel { color: var(--pf-bad); background: rgba(185, 77, 63, 0.1); }
.pf-cur { display: inline-flex; gap: 6px; align-items: baseline; min-width: 0; }
.pf-cur-no {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--pf-warn);
  border: 1px solid rgba(184, 120, 22, 0.4);
  border-radius: 9px;
  padding: 0 6px;
}
.pf-cur-name { font-weight: 600; }
.pf-stuck { color: var(--pf-bad); font-weight: 700; }
.pf-progress { display: flex; gap: 6px; align-items: center; }
.pf-progress-txt { font-size: 12px; color: var(--t-text-3); font-variant-numeric: tabular-nums; }
.pf-progress :deep(.el-progress) { flex: 1; margin: 0; }
.pf-line { font-size: 12px; color: var(--t-text-2); }
.pf-line.is-done { color: var(--pf-ok); }
.pf-line.is-cancel { color: var(--pf-bad); }
.pf-foot-tip { margin: 8px 0 0; font-size: 12px; color: var(--pf-warn); }

/* 展开行:10 步时间轴 */
.pf-flow { padding: 4px 8px 8px 40px; white-space: normal; word-break: break-word; }
.pf-headline { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.pf-headline.is-stuck { color: var(--pf-warn); }
.pf-headline.is-done { color: var(--pf-ok); }
.pf-headline.is-cancel { color: var(--pf-bad); }
.pf-steps { margin: 0; padding: 0; list-style: none; }
.pf-step { display: flex; gap: 8px; padding: 5px 0; border-left: 2px solid var(--t-border); padding-left: 10px; }
.pf-step.is-done { border-left-color: rgba(31, 138, 91, 0.5); }
.pf-step.is-active { border-left-color: var(--pf-warn); background: rgba(184, 120, 22, 0.04); }
.pf-step-idx {
  flex: 0 0 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: var(--t-text-3);
  border: 1px solid var(--t-border);
  font-variant-numeric: tabular-nums;
}
.pf-step.is-done .pf-step-idx { color: #fff; background: var(--pf-ok); border-color: var(--pf-ok); }
.pf-step.is-active .pf-step-idx { color: #fff; background: var(--pf-warn); border-color: var(--pf-warn); }
.pf-step-body { min-width: 0; flex: 1; }
.pf-step-row { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
.pf-step-name { font-size: 13px; font-weight: 600; }
.pf-step-at { font-size: 12px; color: var(--t-text-3); font-variant-numeric: tabular-nums; }
.pf-step-actor { font-size: 12px; color: var(--t-text-2); }
.pf-step-detail { margin: 2px 0 0; font-size: 12px; line-height: 1.5; color: var(--t-text-3); }
.pf-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 24px;
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px dashed var(--t-border);
}
.pf-meta div { display: flex; gap: 6px; min-width: 0; }
.pf-meta dt { font-size: 12px; color: var(--t-text-3); }
.pf-meta dd { margin: 0; font-size: 12px; color: var(--t-text-2); }

@media (max-width: 768px) {
  .pf-source { text-align: left; }
  .pf-search { width: 100%; }
  /* 窄屏:表格列宽合计 > 视口(el-table 内部横向滚动),展开行若不限宽,
     整句会被表格虚拟宽度撑着、在可视区右缘被裁掉 —— 这里把片段宽度钉在视口内让它换行。 */
  .pf-flow { padding-left: 8px; max-width: calc(100vw - 56px); }
}
</style>
