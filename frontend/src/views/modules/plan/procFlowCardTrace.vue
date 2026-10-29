<!--
  procFlowCardTrace.vue — 单卡追溯抽屉内容(2026-10-29,工序流程追踪卡页签③)

  【口径】docs/design/工序流程追踪卡-V1.0.md §5「页签③批次追溯 → 点卡片 → 追溯抽屉」:
    工序进度 + 报工记录 + 照片墙 + 「工单追溯」按钮(展开 /procCard/trace 返回的 `工单追溯`,
    即 ScheduleBoardService.trace 的只读结果,**不重复实现**工单追溯)。

  【为什么工单追溯段用「通用渲染」】`工单追溯` 是现役工单追溯接口的原样返回
    (头/时间线/排产数据/完工数据/入库单据/质检数据/领料数据/子工单/父工单/调拨轨迹/家族汇总/家族清单),
    键名归后端所有:这里**按数组动态出列**(取前 20 个键当表头),既不会因为后端加字段就空白,
    也不用在前端复制一份工单追溯的字段清单。未识别的键落到「其他字段」原文块 —— 排查时不丢信息。

  【照片从哪来】/procCard/trace 的契约里没有照片段(只有 卡/工序进度/报工记录/工单追溯),
    所以本组件**另拉一次 /procCard/detail** 取 照片 映射(同卡号);detail 失败不影响追溯主体。
-->
<template>
  <div class="pft" v-loading="loading">
    <div v-if="loadErr" class="pft-err">{{ loadErr }}</div>

    <!-- 卡头 -->
    <div v-if="card" class="pft-card">
      <div class="pft-card-head">
        <span class="pft-cardno">{{ card.卡号 || cardNo }}</span>
        <el-tag size="small" :type="cardStatusType(card.卡状态)">{{ tt(card.卡状态 || '录入中') }}</el-tag>
      </div>
      <div class="pft-kv">
        <div><span>{{ tt('大批次号') }}</span><b>{{ card.大批次号 || '-' }}</b></div>
        <div><span>{{ tt('小批次号') }}</span><b>{{ card.小批次号 || '-' }}</b></div>
        <div><span>{{ tt('工单号') }}</span><b>{{ card.工单号 || '-' }}<template v-if="card.工单行号 != null"> #{{ card.工单行号 }}</template></b></div>
        <div><span>{{ tt('产品编码') }}</span><b>{{ card.产品编码 || '-' }}</b></div>
        <div><span>{{ tt('产品名称') }}</span><b>{{ card.产品名称 || '-' }}</b></div>
        <div><span>{{ tt('规格型号') }}</span><b>{{ card.规格型号 || '-' }}</b></div>
        <div><span>{{ tt('计划数量') }}</span><b class="num">{{ fmtNum(card.计划数量) }}</b></div>
        <div><span>{{ tt('生产线') }}</span><b>{{ card.生产线 || '-' }}</b></div>
        <div><span>{{ tt('确认人') }}</span><b>{{ card.确认人 || '-' }}</b></div>
        <div><span>{{ tt('确认时间') }}</span><b>{{ rmtTime(card.确认时间) }}</b></div>
        <div class="pft-kv-wide"><span>{{ tt('备注') }}</span><b>{{ card.备注 || '-' }}</b></div>
      </div>
    </div>

    <!-- 工序进度 + 照片墙 -->
    <div class="pft-sec">
      <div class="pft-sec-title">{{ tt('工序进度') }}</div>
      <div v-if="!ops.length" class="pft-empty">{{ tt('暂无数据') }}</div>
      <div v-for="op in ops" :key="op.id ?? op.工序序" class="pft-op">
        <div class="pft-op-head">
          <b>{{ op.工序序 }}. {{ tt(op.工序) }}</b>
          <el-tag size="small" :type="statusTagType(op.状态)">{{ tt(op.状态 || '未开始') }}</el-tag>
          <span class="pft-op-pct">{{ fmtNum(op.已报工) }} / {{ fmtNum(op.计划数量) }}</span>
        </div>
        <div class="pft-op-bar"><i :style="{ width: opPct(op) + '%' }"></i></div>
        <div class="pft-op-meta">
          <span>{{ tt('待审核') }} {{ fmtNum(op.待审核) }}</span>
          <span>{{ tt('完成时间') }} {{ rmtTime(op.完成时间) }}</span>
          <span>{{ tt('报工人') }} {{ op.报工人 || '-' }}</span>
        </div>
        <procFlowCardPhotos :photos="photosOf(photoMap, op.工序序)" :seq="op.工序序" :card-no="cardNo" :can-edit="false" />
      </div>
    </div>

    <!-- 报工记录 -->
    <div class="pft-sec">
      <div class="pft-sec-title">{{ tt('报工记录') }}</div>
      <el-table v-if="reports.length" :data="reports" size="small" border max-height="260" class="pft-table">
        <el-table-column :label="tt('报工单号')" prop="报工单号" min-width="150" show-overflow-tooltip />
        <el-table-column :label="tt('工序')" min-width="80">
          <template #default="{ row }">{{ tt(row.工序) }}</template>
        </el-table-column>
        <el-table-column :label="tt('报工数量')" width="90" align="right">
          <template #default="{ row }">{{ fmtNum(row.报工数量) }}</template>
        </el-table-column>
        <el-table-column :label="tt('报工人')" prop="报工人" width="90" />
        <el-table-column :label="tt('状态')" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.完工状态 === 'Y' ? 'success' : 'warning'">
              {{ row.完工状态 === 'Y' ? tt('已审核') : tt('待审核') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="tt('单据日期')" width="150">
          <template #default="{ row }">{{ rmtTime(row.单据日期) }}</template>
        </el-table-column>
      </el-table>
      <div v-else class="pft-empty">{{ tt('暂无数据') }}</div>
    </div>

    <!-- 工单追溯(只读,复用 ScheduleBoardService.trace) -->
    <div class="pft-sec">
      <div class="pft-sec-title">
        <span>{{ tt('工单追溯') }}</span>
        <el-button size="small" type="primary" plain :disabled="!woTrace" @click="showWo = !showWo">
          {{ showWo ? tt('收起') : tt('展开') }}
        </el-button>
      </div>
      <div v-if="!woTrace" class="pft-empty">{{ tt('没有工单追溯数据') }}</div>
      <template v-else-if="showWo">
        <div class="pft-kv">
          <div v-for="(v, k) in woHead" :key="k">
            <span>{{ tt(String(k)) }}</span>
            <b>{{ v === '' || v == null ? '-' : v }}</b>
          </div>
        </div>
        <!-- 已知数组段:动态列表头(后端起名字,前端不写死字段清单) -->
        <div v-for="seg in woSegs" :key="seg.key" class="pft-seg">
          <div class="pft-seg-title">{{ tt(seg.key) }} <i>{{ seg.rows.length }}</i></div>
          <el-table :data="seg.rows" size="small" border max-height="240" class="pft-table">
            <el-table-column
              v-for="col in seg.cols"
              :key="col"
              :label="tt(col)"
              :prop="col"
              min-width="90"
              show-overflow-tooltip
            />
          </el-table>
        </div>
        <!-- 未识别的键:原文兜底(排查时不丢信息;正常情况不会出现) -->
        <div v-if="woExtra" class="pft-seg">
          <div class="pft-seg-title">{{ tt('其他字段') }}</div>
          <pre class="pft-json">{{ woExtra }}</pre>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { tt } from '@/i18n'
import procFlowCardPhotos from './procFlowCardPhotos.vue'
import {
  cardStatusType, errText, fmtNum, opPct, photosOf, procCardApi, rmtTime, statusTagType,
} from './procFlowCardApi'

const props = defineProps({
  /** 卡号(点卡片时由页面传入) */
  cardNo: { type: String, default: '' },
})

const loading = ref(false)
const loadErr = ref('')
const traceData = ref(null)
const photoMap = ref({})
/** 「工单追溯」默认收起:一段信息量很大,先让人看工序进度/报工记录 */
const showWo = ref(false)

const card = computed(() => traceData.value?.卡 || null)
const ops = computed(() => (Array.isArray(traceData.value?.工序进度) ? traceData.value.工序进度 : []))
const reports = computed(() => (Array.isArray(traceData.value?.报工记录) ? traceData.value.报工记录 : []))
const woTrace = computed(() => traceData.value?.工单追溯 || null)
const woHead = computed(() => (woTrace.value?.头 && typeof woTrace.value.头 === 'object' ? woTrace.value.头 : {}))

/** 已知的数组段(工单追溯的既有结构;不在此列的数组也会被自动收进「其他数组」) */
const KNOWN_ARRAYS = ['时间线', '排产数据', '完工数据', '入库单据', '质检数据', '领料数据', '子工单', '父工单', '调拨轨迹', '家族清单']

/** 动态列:取该段所有行键的并集(最多 20 列,防超宽表格) */
function colsOf(rows) {
  const cols = []
  for (const r of rows) {
    for (const k of Object.keys(r || {})) if (!cols.includes(k)) cols.push(k)
    if (cols.length >= 20) break
  }
  return cols.slice(0, 20)
}

/** 工单追溯里要渲染的数组段:已知顺序优先,其余数组随后(后端加段自动出现) */
const woSegs = computed(() => {
  const src = woTrace.value || {}
  const keys = [...KNOWN_ARRAYS.filter((k) => Array.isArray(src[k])), ...Object.keys(src).filter((k) => Array.isArray(src[k]) && !KNOWN_ARRAYS.includes(k))]
  return keys
    .map((key) => ({ key, rows: src[key].slice(0, 200) }))
    .filter((s) => s.rows.length)
    .map((s) => ({ ...s, cols: colsOf(s.rows) }))
})

/** 剩下的非数组/非头键:原文兜底展示(不明结构不猜,原样给出便于排查) */
const woExtra = computed(() => {
  const src = woTrace.value || {}
  const out = {}
  for (const [k, v] of Object.entries(src)) {
    if (k === '头' || Array.isArray(v)) continue
    out[k] = v
  }
  return Object.keys(out).length ? JSON.stringify(out, null, 2) : ''
})

async function load() {
  const no = String(props.cardNo || '').trim()
  traceData.value = null
  photoMap.value = {}
  loadErr.value = ''
  showWo.value = false
  if (!no) return
  loading.value = true
  try {
    // 追溯主体:卡/工序进度/报工记录/工单追溯(契约 §3.9)
    traceData.value = await procCardApi.trace({ 卡号: no })
    // 工单追溯的字段归后端所有:先打一条调试日志,界面按通用结构渲染(不写死键名)
    if (traceData.value?.工单追溯) console.debug('[PROC_FLOW_CARD] 工单追溯', traceData.value.工单追溯)
  } catch (e) {
    loadErr.value = errText(e, '查询追溯数据失败')
  }
  // 照片墙数据不在追溯契约里 ⇒ 另取 /detail 的 照片 段;失败只影响照片,不报错打断
  try {
    const d = await procCardApi.detail({ 卡号: no })
    photoMap.value = d?.照片 || {}
  } catch { /* 照片拿不到就不显示,不影响追溯主体 */ }
  loading.value = false
}

watch(() => props.cardNo, load, { immediate: true })
</script>

<style scoped>
.pft { display: flex; flex-direction: column; gap: 12px; padding-bottom: 12px; }
.pft-err {
  padding: 8px 10px; border-radius: 6px; font-size: 12px;
  background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2);
}
.pft-card { border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 10px; }
.pft-card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pft-cardno { font-size: 15px; font-weight: 600; word-break: break-all; }
.pft-kv {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px 10px; margin-top: 8px; font-size: 12px;
}
@media (min-width: 900px) { .pft-kv { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.pft-kv > div { display: flex; gap: 6px; min-width: 0; }
.pft-kv > div.pft-kv-wide { grid-column: 1 / -1; }
.pft-kv span { flex: none; color: var(--el-text-color-secondary); }
.pft-kv b { font-weight: 500; min-width: 0; word-break: break-all; }

.pft-sec { border-top: 1px dashed var(--el-border-color-lighter); padding-top: 10px; }
.pft-sec-title {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 8px; font-size: 13px; font-weight: 600;
}
.pft-sec-title .el-button { margin-left: auto; }
.pft-empty { padding: 14px 0; text-align: center; font-size: 12px; color: var(--el-text-color-secondary); }

.pft-op {
  padding: 8px 10px; margin-bottom: 8px;
  border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.pft-op-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; }
.pft-op-pct { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.pft-op-bar { height: 4px; margin: 6px 0; border-radius: 2px; background: var(--el-fill-color); overflow: hidden; }
.pft-op-bar > i { display: block; height: 100%; background: var(--el-color-success); }
.pft-op-meta {
  display: flex; flex-wrap: wrap; gap: 4px 14px;
  margin-bottom: 6px; font-size: 11px; color: var(--el-text-color-secondary);
}

.pft-table { width: 100%; }
.pft-seg { margin-top: 10px; }
.pft-seg-title { margin-bottom: 4px; font-size: 12px; color: var(--el-text-color-regular); }
.pft-seg-title i {
  font-style: normal; margin-left: 4px; padding: 0 5px;
  border-radius: 8px; background: var(--el-fill-color); font-size: 11px;
}
.pft-json {
  max-height: 260px; overflow: auto; margin: 0; padding: 8px 10px;
  border-radius: 6px; background: var(--el-fill-color-lighter);
  font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-all;
}
.num { font-variant-numeric: tabular-nums; }
</style>
