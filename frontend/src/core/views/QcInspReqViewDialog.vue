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
    <template v-else-if="groups.length">
      <div class="req-view-sub">
        {{ tt('物料编号') }}：<b>{{ code }}</b>
        <span class="req-view-count">（{{ tt('共 {n} 行').replace('{n}', String(totalRows)) }}）</span>
        <span v-if="unknownRows" class="req-view-warn">{{ tt('另有 {n} 行物料类别不在检验要求模板中').replace('{n}', String(unknownRows)) }}</span>
      </div>
      <QcInspReqSheet
        :head="viewHead"
        :editable="false"
        panel-code="QC_INSP_REQ"
        :show-toolbar="false"
        :tab-keys="tabKeys"
      />
    </template>
    <div v-else class="req-view-tip">{{ tt('该物料未维护来料检验要求') }}</div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('关闭') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import request from '@/core/request'
import { tt } from '@/i18n'
import QcInspReqSheet from './QcInspReqSheet.vue'
import { lookupReqGroups, normCode, reqTabKeysOf } from '@core/qc/qcInspReqLookup'

/** 来料检验要求面板码(档案式:整表一张虚拟单,行在 detail.items) */
const REQ_PANEL = 'QC_INSP_REQ'

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

const groups = computed(() => lookupReqGroups(rows.value, code.value))
const tabKeys = computed(() => reqTabKeysOf(groups.value))
/** 嵌入的表格只喂"落在配置页签上"的行(配置外类别另行提示,不让它悄悄消失) */
const viewHead = computed(() => ({
  detail: { items: groups.value.filter((g) => g.tab).flatMap((g) => g.rows) },
}))
const unknownRows = computed(() => groups.value.filter((g) => !g.tab).reduce((n, g) => n + g.rows.length, 0))
/** 命中行总数(含配置外类别,如实计数) */
const totalRows = computed(() => groups.value.reduce((n, g) => n + g.rows.length, 0))

/** 打开即取数(档案面板一次全量,量小:实测 78 行;取回后按物料编号精确过滤) */
watch(
  () => [props.modelValue, code.value],
  async ([open]) => {
    if (!open) return
    if (!code.value) { rows.value = []; return }
    loading.value = true
    loadError.value = ''
    try {
      const res = await request.post('/px/queryFormDataList', {
        panelCode: REQ_PANEL,
        condition: { 物料编号: code.value },
        pageNo: 1,
        pageSize: 1,
      })
      const doc = res?.data?.list?.[0]
      rows.value = Array.isArray(doc?.detail?.items) ? doc.detail.items : []
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
</style>
