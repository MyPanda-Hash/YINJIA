<template>
  <!-- ═══════════════════════════════════════════════════════════════════════════
       从送样登记表选择检验项目 —— 检验委托单「检验类别」格的数据来源弹窗

       契约唯一真源:docs/design/检验委托单-首版.md §4.2。
       数据源 = 送样登记表面板 SAMPLE_REG(档案 archive 面板,一张虚拟单承载整档 44 行检测目录),
       取数走现役列表接口 POST /px/queryFormDataList:
         · 请求 { panelCode:'SAMPLE_REG', keyword:'', condition:{}, pageNo:1, pageSize:500 }
         · 返回 { list:[一张虚拟单据] } ⇒ 目录行在 list[0].detail.<明细键>,
           不是 list 本身(档案面板的明细键 = yj_panel.detail_key,可能是 items 也可能是
           LOWER(panel_code),故两种都认;口径同 @core/panel/detailRows)。
       弹窗只负责"挑"和"映射成行表对象",去重/重排/汇总由纸面(InspCommissionSheet)做。
       加载失败 / 无权限:弹窗内给中文提示 + 空表,不抛异常、不往控制台打错误。
       ═══════════════════════════════════════════════════════════════════════════ -->
  <el-dialog
    :model-value="modelValue"
    :title="tt('从送样登记表选择检验项目')"
    width="1100px"
    top="6vh"
    append-to-body
    :close-on-click-modal="false"
    class="scp-dialog"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <div class="scp-tip">
      {{ tt('勾选要带入检验委托单的检测项目；带入后按「检测元素」去重追加，已带入过的项目不会重复追加。') }}
    </div>

    <div class="scp-bar">
      <el-input
        v-model="keyword"
        size="small"
        clearable
        class="scp-kw"
        :placeholder="tt('搜索 检测元素 / 测试方法 / 检测标准')"
      />
      <span class="scp-count">
        {{ tt('共') }} {{ rows.length }} {{ tt('项') }}
        <template v-if="picked.length">· {{ tt('已选') }} {{ picked.length }} {{ tt('项') }}</template>
      </span>
    </div>

    <div v-if="loadError" class="scp-err">{{ loadError }}</div>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="filtered"
      size="small"
      border
      height="420"
      row-key="__rk"
      class="scp-table"
      @selection-change="(rows) => (picked = rows)"
    >
      <el-table-column type="selection" width="42" reserve-selection />
      <el-table-column :label="tt('检测元素')" prop="检测元素" width="116" show-overflow-tooltip />
      <el-table-column :label="tt('内部检出限')" prop="内部检出限" width="110" show-overflow-tooltip />
      <el-table-column :label="tt('检测误差')" prop="检测误差" width="88" show-overflow-tooltip />
      <el-table-column :label="tt('测试方法')" prop="测试方法" width="96" show-overflow-tooltip />
      <el-table-column :label="tt('测试周期')" prop="测试周期" width="88" show-overflow-tooltip />
      <el-table-column :label="tt('收费（一个样/元）')" prop="收费（一个样/元）" width="116" align="right" />
      <el-table-column :label="tt('检测标准')" prop="检测标准" min-width="190" show-overflow-tooltip />
      <el-table-column :label="tt('检测标准备注')" prop="检测标准备注" min-width="150" show-overflow-tooltip />
      <template #empty>
        <span class="scp-empty">{{ loading ? tt('加载中…') : loadError || tt('暂无目录数据') }}</span>
      </template>
    </el-table>

    <template #footer>
      <span class="scp-picked">
        <template v-if="picked.length">{{ tt('已选') }} {{ picked.length }} {{ tt('项') }}：{{ pickedNames }}</template>
        <template v-else>{{ tt('尚未选择') }}</template>
      </span>
      <el-button @click="close">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!picked.length || loading" @click="confirm">
        {{ tt('带入选中项') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { tt } from '@/i18n'
import request from '@core/request'

const props = defineProps({
  /** v-model:弹窗开/关 */
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

/** 目录来源面板码(送样登记表) */
const PANEL_CODE = 'SAMPLE_REG'
/** 前端搜索命中的列(契约 §4.2:检测元素 / 测试方法 / 检测标准) */
const SEARCH_KEYS = ['检测元素', '测试方法', '检测标准']
/** 目录行 → 检验委托单行表对象的键(= 行表 yj_field.label;「收费」的 label 带单位,见 §3.3) */
const ROW_KEYS = ['检测元素', '内部检出限', '检测误差', '测试方法', '测试周期', '收费（一个样/元）', '检测标准', '检测标准备注']
/** 「收费」可能出现的两种键(目录是档案面板,历史/新库都认) */
const FEE_KEYS = ['收费（一个样/元）', '收费']

const rows = ref([])
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const picked = ref([])
const tableRef = ref(null)

/** 已选项目的名字摘要(底部提示用) */
const pickedNames = computed(() => {
  const names = []
  for (const r of picked.value) {
    const v = String(r?.['检测元素'] ?? '').trim()
    if (v && !names.includes(v)) names.push(v)
  }
  return names.join('、')
})

/** 前端搜索:命中 检测元素 / 测试方法 / 检测标准 任一列(不区分大小写、子串) */
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return rows.value
  return rows.value.filter((r) => SEARCH_KEYS.some((k) => String(r?.[k] ?? '').toLowerCase().includes(kw)))
})

/**
 * 从列表接口返回里剥出目录行。
 * 档案面板返回的是「一张虚拟单据」:list[0].detail.<明细键>(键可能是 items,也可能是
 * panel_code 小写)—— 依次兜底,任何一步拿不到就给空数组(不抛异常)。
 * 兼容 { data: {...} } 与直接 {...} 两种包装(不同环境的拦截器/网关行为不一致)。
 */
function catalogRowsOf(res) {
  const data = res?.data && typeof res.data === 'object' ? res.data : res
  const list = Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : []
  const doc = list[0]
  const detail = doc && typeof doc === 'object' ? doc.detail : null
  if (!detail || typeof detail !== 'object') return []
  if (Array.isArray(detail.items)) return detail.items
  for (const v of Object.values(detail)) if (Array.isArray(v)) return v
  return []
}

/** 取某一行的收费文本(两种键都认) */
function feeOf(row) {
  for (const k of FEE_KEYS) {
    const v = String(row?.[k] ?? '').trim()
    if (v) return v
  }
  return ''
}

/** 目录行 → 行表对象(键 = 行表 label;不改目录行本身) */
function toDetailRow(src) {
  const row = {}
  for (const k of ROW_KEYS) row[k] = String(src?.[k] ?? '')
  row['收费（一个样/元）'] = feeOf(src)
  return row
}

/** 失败文案:按 HTTP 状态给人话(无权限/面板不存在/其它) */
function errorText(err) {
  const status = err?.response?.status
  if (status === 401 || status === 403) return tt('没有查看送样登记表的权限，请联系管理员授权')
  if (status === 404) return tt('送样登记表面板不存在（SAMPLE_REG），请检查面板是否已发布')
  return tt('送样登记表目录加载失败，请关闭弹窗后重试')
}

/** 每次打开都重新拉一次目录(目录会被人改;缓存会看到旧项) */
async function load() {
  loading.value = true
  loadError.value = ''
  keyword.value = ''
  picked.value = []
  rows.value = []
  try {
    const res = await request.post('/px/queryFormDataList', {
      panelCode: PANEL_CODE,
      keyword: '',
      condition: {},
      pageNo: 1,
      pageSize: 500,
    })
    const list = catalogRowsOf(res)
    // __rk = 勾选行的稳定键(el-table 的 row-key;行本身没有 id 时不至于串选)
    rows.value = list.map((r, i) => ({ ...r, __rk: String(i) }))
  } catch (e) {
    rows.value = []
    loadError.value = errorText(e)
  } finally {
    loading.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}

/** 带入选中项:交给纸面去重/重排/汇总(这里只做映射与关闭) */
function confirm() {
  const checked = Array.isArray(picked.value) ? picked.value.slice() : []
  if (!checked.length) return
  emit('confirm', checked.map(toDetailRow))
  close()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) load()
  },
)
</script>

<style scoped>
.scp-tip {
  font-size: 12.5px;
  color: #8ba6bd;
  line-height: 1.6;
  margin-bottom: 8px;
}
.scp-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.scp-kw {
  width: 320px;
}
.scp-count {
  font-size: 12.5px;
  color: #606266;
}
.scp-err {
  margin-bottom: 8px;
  padding: 6px 10px;
  border: 1px solid #f3d19e;
  border-radius: 4px;
  background: #fdf6ec;
  color: #b88230;
  font-size: 12.5px;
  line-height: 1.5;
}
.scp-empty {
  font-size: 12.5px;
  color: #a8b6c4;
}
.scp-picked {
  float: left;
  max-width: 62%;
  font-size: 12.5px;
  color: #606266;
  line-height: 32px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
