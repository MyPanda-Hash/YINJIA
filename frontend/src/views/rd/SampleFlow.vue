<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       样品进度跟踪（2026-11-18 用户口径，Excel #9）
         「设置类似产品文件列表的进度展示，提取样品单编号、客户名称、下单日期、
           审核人、确认人，字段填充列标题；列标题加一项进度描述……销售填写申请单之后
           可到此列表查询样品进展，可以看到到几级审核了」

       只读:数据来自 /px/sampleFlow（头表 + yj_doc_status），本页不写库、不触发审批。
       版式与 /rd/productFlow（产品文件流程管控）同一套语言:KPI → 检索条 → 清单表。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="sfl-page">
    <header class="sfl-head">
      <div>
        <h1 class="sfl-title">{{ tt('样品进度跟踪') }}</h1>
        <p class="sfl-sub">
          {{ tt('按外部开发样品单看进展：谁提交、审到第几级、谁在等确认，一屏看完') }}
        </p>
      </div>
      <p class="sfl-source">
        {{ tt('数据来源：样品单头信息与审批状态实时计算，本页只读不改单') }}
      </p>
    </header>

    <section class="sfl-kpis">
      <article v-for="k in kpiCards" :key="k.key" class="sfl-kpi">
        <span class="sfl-kpi-label">{{ tt(k.label) }}</span>
        <strong class="sfl-kpi-num" :class="'tone-' + k.tone">{{ k.value }}</strong>
        <span class="sfl-kpi-hint">{{ tt(k.hint) }}</span>
      </article>
    </section>

    <div class="sfl-bar">
      <el-select v-model="field" class="sfl-field" :placeholder="tt('字段')">
          <el-option v-for="f in SAMPLE_FLOW_FIELDS" :key="f" :label="tt(f)" :value="f" />
        </el-select>
        <el-input
        v-model="keyword"
        class="sfl-search"
        clearable
        :placeholder="tt('输入样品单编号 / 客户名称 / 审核人 / 进度描述（支持片段）')"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button type="primary" :loading="loading" @click="load">{{ tt('查询') }}</el-button>
      <span class="sfl-tip">{{ tt('到几级审核看「当前节点」列') }}</span>
    </div>

    <section v-if="denied" class="sfl-card sfl-denied">
      {{ tt('没有查看样品进度数据的权限（需要「外部-开发样品」的查看权）') }}
    </section>

    <section v-else class="sfl-card">
      <div class="sfl-card-head">
        <h2 class="sfl-card-title">{{ tt('样品单清单') }}</h2>
        <span class="sfl-card-hint">{{ tt('共') }} {{ shown.length }} {{ tt('条') }}</span>
      </div>
      <el-table :data="shown" row-key="单据编号" size="small" border v-loading="loading" max-height="560" @row-click="openDoc" row-class-name="sf-row-click">
        <el-table-column prop="单据编号" :label="tt('样品单编号')" width="170" fixed />
        <el-table-column prop="客户名称" :label="tt('客户名称')" min-width="140" show-overflow-tooltip />
        <el-table-column prop="单据日期" :label="tt('下单日期')" width="110" align="center" />
        <el-table-column prop="审核人" :label="tt('审核人')" min-width="150" show-overflow-tooltip />
        <el-table-column prop="确认人" :label="tt('确认人')" min-width="150" show-overflow-tooltip />
        <el-table-column :label="tt('当前节点')" width="112" align="center">
          <template #default="{ row }">
            <span class="sfl-node" :class="'node-' + nodeOf(row)">{{ tt(nodeTextOf(row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="进度描述" :label="tt('进度描述')" min-width="220" show-overflow-tooltip />
      </el-table>
      <p v-if="!loading && !shown.length" class="sfl-empty">
        {{ tt('暂无样品单；在「外部-开发样品」新增后会出现在这里') }}
      </p>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { tt } from '@/i18n'
import { SAMPLE_FLOW_FIELDS } from '@/core/progress/sampleFlow'
import { Search } from '@element-plus/icons-vue'
import request from '@/core/request'
import { useRouter } from 'vue-router'
import { filterSampleRows, sampleKpisOf, sampleNodeOf, sampleNodeText } from '@/core/progress/sampleFlow'

const rows = ref([])
const router = useRouter()
const loading = ref(false)
const denied = ref(false)
const keyword = ref('')
/** 字段查询（2026-11-19 用户口径） */
const field = ref('全部字段')

const shown = computed(() => filterSampleRows(rows.value, { field: field.value, keyword: keyword.value }))

const kpiCards = computed(() => {
  const k = sampleKpisOf(rows.value)
  return [
    { key: 'total', label: '样品单总数', value: k.total, tone: 'total', hint: '不含已作废' },
    { key: 'l1', label: '待一级审核', value: k.l1, tone: 'l1', hint: '等审核人处理' },
    { key: 'l2', label: '待二级确认', value: k.l2, tone: 'l2', hint: '等确认人签核' },
    { key: 'done', label: '已完成', value: k.done, tone: 'done', hint: '已审核归档' },
  ]
})

const nodeOf = (row) => sampleNodeOf(row)
const nodeTextOf = (row) => sampleNodeText(row)

async function load() {
  loading.value = true
  denied.value = false
  try {
    const res = await request.get('/px/sampleFlow')
    rows.value = Array.isArray(res?.data) ? res.data : []
  } catch (e) {
    // 403 = 没有该面板查看权：给一句明确说明，不留空白页
    denied.value = true
    rows.value = []
  } finally {
    loading.value = false
  }
}

/** 整行可点：跳到对应样品单（用户口径：每个样品信息都应该可以查看） */
function openDoc(row) {
  const no = String(row?.['样品单编号'] || row?.['单据编号'] || '').trim()
  if (!no) return
  router.push({ path: '/panelx/list/RD_SAMPLE_EXT', query: { focus: no } })
}

onMounted(load)
</script>

<style scoped>
.sfl-page { padding: 16px; }
.sfl-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 12px; }
.sfl-title { margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #222; }
.sfl-sub { margin: 0; font-size: 13px; color: #666; line-height: 1.6; }
.sfl-source { margin: 0; font-size: 12px; color: #909399; white-space: nowrap; }
.sfl-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
.sfl-kpi { border: 1px solid #f0f0f0; border-radius: 6px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
.sfl-kpi-label { font-size: 12px; color: #666; }
.sfl-kpi-num { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; color: #222; }
.sfl-kpi-num.tone-l1 { color: #d46b08; }
.sfl-kpi-num.tone-l2 { color: #0958d9; }
.sfl-kpi-num.tone-done { color: #389e0d; }
.sfl-kpi-hint { font-size: 12px; color: #909399; }
.sfl-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.sfl-search { max-width: 460px; }
.sfl-tip { font-size: 12px; color: #909399; }
.sfl-card { border: 1px solid #f0f0f0; border-radius: 6px; padding: 12px; }
.sfl-card-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; }
.sfl-card-title { margin: 0; font-size: 14px; font-weight: 600; color: #222; }
.sfl-card-hint { font-size: 12px; color: #909399; }
.sfl-denied { padding: 24px; color: #909399; text-align: center; }
.sfl-empty { margin: 16px 0 0; text-align: center; color: #909399; font-size: 13px; }
.sfl-node { display: inline-block; padding: 0 8px; border-radius: 10px; font-size: 12px; line-height: 20px; background: #f5f5f5; color: #595959; }
.sfl-node.node-l1 { background: #fff7e6; color: #d46b08; }
.sfl-node.node-l2 { background: #e6f4ff; color: #0958d9; }
.sfl-node.node-done { background: #f6ffed; color: #389e0d; }
.sfl-node.node-void { background: #f5f5f5; color: #bfbfbf; }
@media (max-width: 768px) {
  .sfl-head { flex-direction: column; gap: 6px; }
  .sfl-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sfl-source { white-space: normal; }
}
.sf-row-click { cursor: pointer; }
.sfl-field { width: 130px; margin-right: 8px; }
</style>
