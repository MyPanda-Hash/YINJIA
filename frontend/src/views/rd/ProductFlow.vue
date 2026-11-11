<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       产品文件流程管控(2026-11-11 用户口径):
         「再用设计库设计一个和项目流程管控面板一样的流程查看功能的面板去专门查看产品文件的
           流程管控，就是和产品信息表以及下面 4 个面板对应的流程」

       与 ProjectFlow.vue(项目流程管控)同一套版式语言:KPI 卡片 → 检索条 → 清单表(展开=时间轴)。
       区别只在"流程"是什么:这边一条 = 一个产品开发包 = 产品信息表 + 4 张受控文件。
       只读:数据全部来自 /px/rdDevOverview(与「产品文件列表·流程全览」「项目进度查询·开发产品」
       同一份事实),本页不写库、不触发审批。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="pfl-page">
    <header class="pfl-head">
      <div>
        <h1 class="pfl-title">{{ tt('产品文件流程管控') }}</h1>
        <p class="pfl-sub">
          {{ tt('按产品看这份开发包走到哪一步：产品信息表 + 4 张受控文件，哪一步还没建单、哪一步卡在开发中') }}
        </p>
      </div>
      <p class="pfl-source">
        {{ tt('数据来源：产品信息表与 4 个文件面板的实时单据状态，本页只读不改单') }}
      </p>
    </header>

    <section class="pfl-kpis">
      <article v-for="k in kpiCards" :key="k.key" class="pfl-kpi">
        <span class="pfl-kpi-label">{{ tt(k.label) }}</span>
        <strong class="pfl-kpi-num" :class="'tone-' + k.tone">{{ k.value }}</strong>
        <span class="pfl-kpi-hint">{{ tt(k.hint) }}</span>
      </article>
    </section>

    <div class="pfl-bar">
      <el-input
        v-model="keyword"
        class="pfl-search"
        clearable
        :placeholder="tt('输入产品编号 / 产品名称 / 立项文档编号（支持片段）')"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-checkbox v-model="onlyOpen">{{ tt('只看未完成') }}</el-checkbox>
      <el-button type="primary" :loading="loading" @click="load">{{ tt('刷新') }}</el-button>
      <span class="pfl-tip">{{ tt('展开行看 5 步时间轴') }}</span>
    </div>

    <section v-if="denied" class="pfl-card pfl-denied">
      {{ tt('没有查看产品进度数据的权限（需要「项目进度查询」或「产品文件列表」的查看权）') }}
    </section>

    <section v-else class="pfl-card">
      <div class="pfl-card-head">
        <h2 class="pfl-card-title">{{ tt('流程清单') }}</h2>
        <span class="pfl-card-hint">{{ tt('共') }} {{ shown.length }} {{ tt('条') }}</span>
      </div>
      <el-table
        :data="shown"
        row-key="产品编号"
        size="small"
        border
        class="pfl-table"
        :empty-text="tt('没有符合条件的产品')"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="pfl-flow">
              <p class="pfl-headline" :class="nextOf(row) ? 'is-stuck' : 'is-done'">
                {{ nextOf(row) ? tt('卡在') + '：' + tt(nextOf(row).label) : tt('5 步已全部完成') }}
              </p>
              <ol class="pfl-steps">
                <li v-for="(st, i) in stepsOf(row)" :key="st.key + i" class="pfl-step" :class="'is-' + st.tone">
                  <span class="pfl-step-idx">{{ i + 1 }}</span>
                  <div class="pfl-step-body">
                    <span class="pfl-step-name">{{ tt(st.label) }}</span>
                    <span class="pfl-step-no">{{ st.docNo || '—' }}</span>
                    <!-- 处理人（2026-11-11）:产品信息表=填写并提交审批的人;规格书=二级负责人;
                         成型/组装/出货=签核后分发的负责人。空着只显示"—",不编造 -->
                    <span class="pfl-step-owner" :title="tt('处理人')">{{ tt('处理人') }}<b>{{ st.owner || '—' }}</b></span>
                  </div>
                  <span class="pfl-step-state">{{ tt(st.state || (st.tone === 'none' ? '未开始' : '')) }}</span>
                  <span v-if="st.reaudited" class="pfl-step-flag">{{ tt('待重走') }}</span>
                </li>
              </ol>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="产品编号" :label="tt('产品编号')" width="132" />
        <el-table-column prop="产品名称" :label="tt('产品名称')" min-width="180" show-overflow-tooltip />
        <el-table-column prop="立项文档编号" :label="tt('立项文档编号')" width="160" show-overflow-tooltip />
        <el-table-column :label="tt('进度')" width="96" align="right">
          <template #default="{ row }">
            <span class="pfl-num">{{ progressOf(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('状态')" width="132">
          <template #default="{ row }">
            <span class="pfl-chip" :class="'is-' + statusToneOf(row)">{{ tt(statusTextOf(row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('下一步')" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="nextOf(row)">{{ tt(nextOf(row).label) }}</span>
            <span v-else class="pfl-done">{{ tt('已完成') }}</span>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { tt } from '@/i18n'
import { Search } from '@element-plus/icons-vue'
import request from '@/core/request'
import {
  STEP_STATE, filterFlowRows, flowKpisOf, flowStatusOf, flowStepsOf, nextStepOf,
} from '@/core/prod/productFlow'

const rows = ref([])
const loading = ref(false)
const denied = ref(false)
const keyword = ref('')
const onlyOpen = ref(false)

const shown = computed(() => filterFlowRows(rows.value, keyword.value, onlyOpen.value))

const kpiCards = computed(() => {
  const k = flowKpisOf(rows.value)
  return [
    { key: 'total', label: '产品数', value: k.total, tone: 'total', hint: '已下发开发的产品' },
    { key: 'done', label: '已开发完毕', value: k.done, tone: 'done', hint: '5 步全部完成' },
    { key: 'doing', label: '进行中', value: k.doing, tone: 'doing', hint: '至少一份文件在建/已归档' },
    { key: 'none', label: '未开工', value: k.none, tone: 'none', hint: '4 份文件一份都没起' },
  ]
})

function stepsOf(row) { return flowStepsOf(row) }
function nextOf(row) { return nextStepOf(flowStepsOf(row)) }

/** 进度 = 已完成的步骤数 / 5（产品信息表也算一步） */
function progressOf(row) {
  const steps = flowStepsOf(row)
  const done = steps.filter((s) => s.tone === STEP_STATE.done).length
  return `${done}/${steps.length}`
}

/** 整包状态：与 KPI 同一个函数（core/prod/productFlow.flowStatusOf），不在这里另判一次 */
function statusToneOf(row) { return flowStatusOf(row) }
function statusTextOf(row) {
  const t = flowStatusOf(row)
  return t === STEP_STATE.done ? '已开发完毕' : (t === STEP_STATE.doing ? '进行中' : '未开工')
}

async function load() {
  loading.value = true
  denied.value = false
  try {
    const res = await request.get('/px/rdDevOverview')
    const list = (res && res.data && res.data.products) || []
    rows.value = list.filter((r) => String(r?.['产品编号'] || '').trim() !== '')
  } catch (e) {
    rows.value = []
    denied.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<style scoped>
/* 版式语言与 ProjectFlow.vue 一致：浅底、白卡片、1px 边框、无阴影；
   间距 8 的倍数；数字列 tabular-nums（这里只有"进度"是数字列）。 */
.pfl-page { padding: 20px 24px 32px; background: #f5f7fa; min-height: 100%; box-sizing: border-box; }
.pfl-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 16px; }
.pfl-title { margin: 0 0 6px; font-size: 20px; line-height: 28px; font-weight: 600; color: #1f2d3d; }
.pfl-sub { margin: 0; font-size: 13px; line-height: 20px; color: #5c6b7a; }
.pfl-source { margin: 0; font-size: 12px; color: #8a97a5; max-width: 360px; text-align: right; }

.pfl-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
.pfl-kpi { background: #fff; border: 1px solid #e4e8ee; border-radius: 6px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.pfl-kpi-label { font-size: 12px; color: #8a97a5; }
.pfl-kpi-num { font-size: 24px; line-height: 32px; font-weight: 600; color: #1f2d3d; font-variant-numeric: tabular-nums; }
.pfl-kpi-num.tone-done { color: #2f6f4e; }
.pfl-kpi-num.tone-doing { color: #1e5a8a; }
.pfl-kpi-num.tone-none { color: #8a97a5; }
.pfl-kpi-hint { font-size: 12px; color: #a8b3bf; }

.pfl-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.pfl-search { width: 320px; }
.pfl-tip { font-size: 12px; color: #8a97a5; }

.pfl-card { background: #fff; border: 1px solid #e4e8ee; border-radius: 6px; }
.pfl-denied { padding: 32px; text-align: center; color: #8a97a5; font-size: 13px; }
.pfl-card-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #eef1f5; }
.pfl-card-title { margin: 0; font-size: 14px; font-weight: 600; color: #1f2d3d; }
.pfl-card-hint { font-size: 12px; color: #8a97a5; }
.pfl-num { font-variant-numeric: tabular-nums; color: #5c6b7a; }
.pfl-done { color: #2f6f4e; }

.pfl-chip { display: inline-block; padding: 0 8px; line-height: 22px; border-radius: 11px; font-size: 12px; border: 1px solid transparent; }
.pfl-chip.is-done { color: #2f6f4e; background: #eef7f1; border-color: #cfe7d9; }
.pfl-chip.is-doing { color: #1e5a8a; background: #eff6fd; border-color: #cfe2f5; }
.pfl-chip.is-none { color: #8a97a5; background: #f5f7fa; border-color: #e4e8ee; }

/* 展开区 = 5 步时间轴（左竖线 + 圆点，与项目流程管控同款） */
.pfl-flow { padding: 12px 16px 8px 40px; background: #fafbfc; }
.pfl-headline { margin: 0 0 12px; font-size: 13px; }
.pfl-headline.is-stuck { color: #a0641a; }
.pfl-headline.is-done { color: #2f6f4e; }
.pfl-steps { list-style: none; margin: 0; padding: 0 0 0 18px; border-left: 1px dashed #d8e0e8; }
.pfl-step { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 13px; }
.pfl-step-idx {
  flex: none; width: 18px; height: 18px; margin-left: -27px; border-radius: 50%;
  background: #fff; border: 1px solid #d8e0e8; color: #8a97a5;
  font-size: 11px; line-height: 16px; text-align: center;
}
.pfl-step.is-done .pfl-step-idx { border-color: #2f6f4e; color: #2f6f4e; }
.pfl-step.is-doing .pfl-step-idx { border-color: #1e5a8a; color: #1e5a8a; }
.pfl-step-body { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.pfl-step-name { font-weight: 500; color: #1f2d3d; }
.pfl-step-no { font-size: 12px; color: #8a97a5; }
.pfl-step-owner { font-size: 12px; color: #8a97a5; }
.pfl-step-owner b { margin-left: 4px; font-weight: 500; color: #1f2d3d; }
.pfl-step-state { margin-left: auto; font-size: 12px; color: #5c6b7a; }
.pfl-step-flag { margin-left: 8px; padding: 0 6px; line-height: 18px; border-radius: 9px; background: #fdf3e7; color: #a0641a; font-size: 11px; }

@media (max-width: 1100px) {
  .pfl-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pfl-head { flex-direction: column; align-items: flex-start; }
  .pfl-source { text-align: left; max-width: none; }
}
</style>
