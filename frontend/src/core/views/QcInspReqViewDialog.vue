<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       来料检验要求·按物料查看(只读弹窗)
       用途:检验数据记录(QC_INSP_REC)录/看报告时,按本单「物料编码」直接看该物料的
             来料检验要求(QC_INSP_REQ)内容 —— 用户口径(2026-09-23):
             「检验数据记录要根据物料编码能够查看来料检验要求相关物料的信息」。
       匹配:物料编码 ↔ 物料编号 两侧 trim 后精确相等(见 @core/qc/qcInspReqLookup)。
       呈现:表格本体直接复用维护面板的 QcInspReqSheet(只读 + 隐藏工具栏 + 只显示命中页签),
             一处维护两处显示;弹窗自己只负责取数、空态与提示。
       ═══════════════════════════════════════════════════════════════════ -->
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="1100px"
    top="6vh"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <div v-if="loading" class="req-view-tip">{{ tt('查询中…') }}</div>
    <div v-else-if="loadError" class="req-view-tip err">{{ loadError }}</div>
    <template v-else-if="sections.length">
      <div class="req-view-sub">
        {{ tt('物料编号') }}：<b>{{ code }}</b>
        <span class="req-view-count">（{{ tt('共 {n} 行').replace('{n}', String(totalRows)) }}）</span>
        <!-- 归不进现役页签的行(物料类别已下线/脏值):现在**照样渲染成「{类别} · 未归类」只读页签**,
             这里只说清有几行、是什么类别 —— 提示与显示必须一致,不能"只计数不显示"(2026-11-06) -->
        <span v-if="orphanCount" class="req-view-warn">{{
          tt('另有 {n} 行物料类别不在检验要求模板中（{cats}），已按「未归类」页签显示')
            .replace('{n}', String(orphanCount))
            .replace('{cats}', orphanCats.join('、'))
        }}</span>
      </div>
      <!-- 两个面板各一段:要求可能维护在「来料检验要求」(固定 7 张表)或「来料检验要求(系列)」(10 张自定义表) -->
      <div v-for="sec in sections" :key="sec.panelCode" class="req-view-sec">
        <div v-if="sections.length > 1" class="req-view-sec-title">
          {{ tt(sec.panelName) }}
          <span class="req-view-count">（{{ tt('共 {n} 行').replace('{n}', String(sec.rows.length)) }}）</span>
        </div>
        <QcInspReqSheet
          :head="sec.head"
          :editable="false"
          :panel-code="sec.panelCode"
          :show-toolbar="false"
          :tab-keys="sec.tabKeys"
          :extra-tabs="sec.extras"
        />
      </div>
    </template>
    <div v-else class="req-view-tip">{{ tt('该物料未维护来料检验要求') }}</div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('关闭') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { tt } from '@/i18n'
import QcInspReqSheet from './QcInspReqSheet.vue'
import { fetchReqRowsOfPanel, fetchExtOverview } from '@core/qc/qcInspReqApi'
import { lookupReqGroups, normCode, orphanColsOf, orphanGroupsOf, reqTabKeysOf } from '@core/qc/qcInspReqLookup'
import { qcInspReqTabs, tabsOfPanel, QC_INSP_REQ_PANEL as PANEL_A, QC_INSP_REQ_SERIES_PANEL as PANEL_B } from './qcInspReqConfig'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 本单的物料编码(检验数据记录抬头);空则不应打开弹窗 */
  materialCode: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const code = computed(() => normCode(props.materialCode))
const title = computed(() => tt('来料检验要求') + (code.value ? ' · ' + code.value : ''))

const rows = ref([])
const loading = ref(false)
const loadError = ref('')
/** 两个面板的页签集(全自定义面板由物料类别词典决定) */
const seriesTabs = ref([])

/** 面板名(标题只在两个面板都有命中时才显示,单一命中时不啰嗦) */
const PANEL_NAMES = { [PANEL_A]: '来料检验要求', [PANEL_B]: '来料检验要求(系列)' }

/**
 * 每段 = 一个面板。行分两类:
 *   · 归页签(groups 里 tab 非空)—— 按页签正常显示;
 *   · **归不进本面板页签**(tab=null,物料类别已下线/脏值/词典没取回)—— 2026-11-06 起不再"只计数"，
 *     而是单独成「{类别} · 未归类」只读页签照样显示内容(用户不需要的"看不见"比"看起来脏"严重得多)。
 * 注意判据是**按面板**算的:某行挂 炭粉 却存在固定表(qc_insp_req)里,旧算法按两面板页签并集判会当"已知",
 * 结果两个面板都不渲染它 —— 也一并由本段逻辑收口。
 */
const sections = computed(() => {
  const panels = [
    { panelCode: PANEL_A, tabs: qcInspReqTabs },
    { panelCode: PANEL_B, tabs: tabsOfPanel(PANEL_B, seriesTabs.value) },
  ]
  const out = []
  for (const p of panels) {
    const mine = rows.value.filter((r) => String(r?.['__panel'] || '') === p.panelCode)
    const groups = lookupReqGroups(mine, code.value, p.tabs)
    const hitRows = groups.filter((g) => g.tab).flatMap((g) => g.rows)
    const extras = orphanGroupsOf(groups).map((g) => orphanTabOf(g))
    if (!hitRows.length && !extras.length) continue
    const all = [...hitRows, ...extras.flatMap((e) => e.rows)]
    out.push({
      panelCode: p.panelCode,
      panelName: PANEL_NAMES[p.panelCode],
      rows: all,
      extras,
      tabKeys: reqTabKeysOf(groups),
      head: { detail: { items: all } },
    })
  }
  return out
})
/** 未归类行的只读页签:key=物料类别原文(空类别='' ⇒ 与行上的空值精确相等,仍能分流),
 *  标题走 tt('{c} · 未归类'),列按行自身字段名(orphanColsOf,与带入的兜底列同源) */
function orphanTabOf(g) {
  const label = g.key ? tt(g.key) : tt('未填写物料类别')
  return {
    key: g.key,
    label,
    title: tt('{c} · 未归类').replace('{c}', label),
    cols: orphanColsOf(g.rows),
    rows: g.rows,
    orphan: true,
  }
}
/** 未归类行总数 / 涉及的物料类别(供提示说明"是哪一类归不进去") */
const orphanCount = computed(() => sections.value.reduce((n, s) => n + s.extras.reduce((m, e) => m + e.rows.length, 0), 0))
const orphanCats = computed(() => {
  const out = []
  for (const s of sections.value) {
    for (const e of s.extras) {
      const c = e.key || tt('未填写物料类别')
      if (!out.includes(c)) out.push(c)
    }
  }
  return out
})
/** 命中行总数 = 两个面板取回的全部行(含未归类行 —— 它们现在也显示在「未归类」页签里) */
const totalRows = computed(() => rows.value.length)

/** 打开即取数:两个面板各取一次(档案面板一次全量,量小),行上打 __panel 标签便于分段显示。
 *  取数走 @core/qc/qcInspReqApi(与检验报告的「带入检验要求」同一入口,两处所见必须一致) */
watch(
  () => [props.modelValue, code.value],
  async ([open]) => {
    if (!open) return
    if (!code.value) { rows.value = []; seriesTabs.value = []; return }
    loading.value = true
    loadError.value = ''
    try {
      const [rowsA, rowsB, ovB] = await Promise.all([
        fetchReqRowsOfPanel(PANEL_A, code.value),
        fetchReqRowsOfPanel(PANEL_B, code.value),
        fetchExtOverview(PANEL_B),
      ])
      seriesTabs.value = ovB.tabs
      rows.value = [
        ...rowsA.map((r) => ({ ...r, __panel: PANEL_A })),
        ...rowsB.map((r) => ({ ...r, __panel: PANEL_B })),
      ]
    } catch (e) {
      rows.value = []
      loadError.value = e?.response?.data?.msg || e?.message || String(e)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.req-view-tip {
  padding: 26px 4px;
  text-align: center;
  color: #8a94a6;
  font-size: 13px;
}
.req-view-tip.err {
  color: #c0392b;
}
.req-view-sub {
  padding: 0 4px 8px;
  font-size: 13px;
  color: #444;
}
.req-view-count {
  color: #8a94a6;
}
.req-view-warn {
  margin-left: 10px;
  color: #c08a00;
}
/* 两个面板分段显示(只有一个面板命中时不显示段标题) */
.req-view-sec + .req-view-sec {
  margin-top: 12px;
  border-top: 1px dashed #dbe6f3;
  padding-top: 8px;
}
.req-view-sec-title {
  padding: 0 4px 6px;
  font-size: 13px;
  font-weight: 600;
  color: #1c4f8a;
}
</style>
