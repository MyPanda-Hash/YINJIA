<!-- ProductImportDialog.vue — 勾选商品档案(INV)批量带入明细(2026-10-21,物料清单 WLBOM 首用) -->
<!--
  用户口径(2026-10-21):「把填写物料清单的内容可以通过点击新增数据的下拉栏:导入商品数据,
  然后勾选商品里面的数据进行一个批量导入」。

  数据源 = 商品档案 INV(yj_panel.mode=archive,line_table=bs_inv)。本组件只做**取数 + 勾选**,
  勾完把**商品档案原始行**原样 emit 出去,由调用方(明细页签所属面板)自己决定写哪几列 ——
  面板之间的字段映射(INV 存货编码 → WLBOM 子件代码 …)属于业务口径,不该硬编码在弹窗里,
  否则第二个面板想复用时得剖开这个文件。
-->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('导入商品数据')"
    width="min(920px, 94vw)"
    append-to-body
    @update:model-value="close"
  >
    <div class="pi-tip">
      {{ tt('从商品档案勾选存货，确定后逐行追加到明细') }}
      <br />
      {{ tt('导入后不自动保存，请点「保存」后生效') }}
    </div>

    <div class="pi-bar">
      <el-input
        v-model="keyword"
        :placeholder="tt('搜索存货编码或名称')"
        :prefix-icon="Search"
        clearable
        size="small"
        class="pi-key"
      />
      <span class="pi-sel">{{ tt('已选') }} <b>{{ selected.length }}</b> {{ tt('项') }}</span>
      <el-button link size="small" :disabled="!selected.length" @click="clearSelection">{{ tt('清空选择') }}</el-button>
      <span class="pi-grow" />
      <el-button size="small" :icon="Refresh" :loading="loading" @click="load(true)">{{ tt('刷新') }}</el-button>
    </div>

    <!-- 分页是**本地**分页:商品档案走 QueryService.queryArchive,该分支按"档案全量返回"契约
         **忽略 pageSize**(一次就是全部几万行上限的表),所以翻页/筛选都不必再打后端,
         换页零延迟、筛选随敲随出。⚠ 代价是首次打开要拉一次全表(生产 bs_inv 3,917 行 × 113 列),
         故加了 TTL 缓存,短时间内反复开关不重复拉(见 load)。
         row-key=__rk(reserve-selection 跨页保留勾选的前提,与 RefPickDialog 同款)。
         ⚠ 勾选**不做**跨筛选保留以外的特殊处理:筛选清空后勾选集合仍按行对象保留 ——
         这正是"先搜 A 勾两条,再搜 B 勾一条,一起带入"的用法。 -->
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="pageRows"
      row-key="__rk"
      height="380"
      border
      size="small"
      :empty-text="loading ? tt('加载中') : tt('没有匹配的商品')"
      @selection-change="(r) => (selected = r)"
    >
      <el-table-column type="selection" width="45" reserve-selection />
      <el-table-column prop="存货编码" :label="tt('存货编码')" width="150" show-overflow-tooltip />
      <el-table-column prop="存货名称" :label="tt('存货名称')" min-width="200" show-overflow-tooltip />
      <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="180" show-overflow-tooltip />
      <el-table-column prop="计量单位" :label="tt('计量单位')" width="100" />
    </el-table>

    <div v-if="error" class="pi-err">{{ error }}</div>

    <div v-if="filtered.length > pageSize" class="pi-pager">
      <el-pagination
        small
        background
        v-model:page-size="pageSize"
        v-model:current-page="pageNo"
        layout="total, sizes, prev, next, jumper"
        :page-sizes="[50, 100, 200]"
        :total="filtered.length"
      />
    </div>

    <template #footer>
      <el-button @click="close">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!selected.length" @click="confirm">
        {{ tt('确定') }}<template v-if="selected.length">（{{ tt('带入') }} {{ selected.length }} {{ tt('行') }}）</template>
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import { queryFormDataList } from '@/business/engine'
import { invRowsOf } from '@core/panel/invCarry'

const props = defineProps({
  modelValue: Boolean,
})
const emit = defineEmits(['update:modelValue', 'confirm'])

/** 商品档案面板编码(QueryService 按它取 bs_inv) */
const INV_PANEL = 'INV'
/** 全表缓存时长:同一会话里反复开关弹窗不该反复拉 4 MB(原因见模板里 queryArchive 的注释) */
const CACHE_TTL = 120_000

const rows = ref([])
const keyword = ref('')
const pageNo = ref(1)
const pageSize = ref(50)
const selected = ref([])
const loading = ref(false)
const error = ref('')
const tableRef = ref(null)

/** 模块级缓存(不是组件级):弹窗是 v-model 开关,关掉组件实例就没了,组件内 ref 留不住 */
let cache = { at: 0, rows: [] }

/** 关键字过滤:只认存货编码/存货名称两列(用户口径就是"勾选商品里面的数据")。
 *  档案行的 keyword **不在**这里用 —— 后端 keyword 是"本面板全部字段 LIKE",
 *  会连 规格型号/备注/助记码 一起命中,筛选口径与用户预期不一致。 */
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return rows.value
  return rows.value.filter((r) => String(r['存货编码'] ?? '').toLowerCase().includes(kw)
    || String(r['存货名称'] ?? '').toLowerCase().includes(kw))
})

const pageRows = computed(() => {
  const start = (pageNo.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

watch(keyword, () => { pageNo.value = 1 })   // 换关键字回第一页,否则停在越界空白页

watch(() => props.modelValue, (v) => {
  if (!v) return
  keyword.value = ''
  pageNo.value = 1
  clearSelection()
  load()
})

/**
 * 取商品档案行。
 *
 * pageSize 只是"表明意图"(与 RecipeCalcDialog/invCarry 同口径):档案分支按保存语义
 * 必须全量返回,写 100 也不会被采纳 —— 别以为写了 100 就只拉 100 行。
 * 行形状统一走 invRowsOf:档案面板的明细键 = yj_panel.detail_key(服务器上是 detail.inv,
 * 本地开发库退化成 detail.items),写死 detail.items 会在服务器上恒空(2026-10-16 踩过)。
 */
async function load(force = false) {
  if (!force && cache.rows.length && Date.now() - cache.at < CACHE_TTL) {
    rows.value = cache.rows
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await queryFormDataList({ panelCode: INV_PANEL, condition: {}, pageNo: 1, pageSize: 100 })
    // __rk:el-table 跨页保留勾选要靠稳定 row-key,行对象本身没有主键(存货编码理论唯一但不保证)
    const list = invRowsOf(res).map((r, i) => ({ ...r, __rk: 'r' + i }))
    cache = { at: Date.now(), rows: list }
    rows.value = list
    clearSelection()
  } catch (e) {
    // 失败要**说出来**(权限被拒时后端是 200 + code 403,静默会变成"空表格没数据"的假象)
    error.value = (e && (e.response?.data?.message || e.message)) || tt('加载商品档案失败')
    rows.value = []
  } finally {
    loading.value = false
  }
}

function clearSelection() {
  selected.value = []
  tableRef.value?.clearSelection?.()
}

function close() {
  emit('update:modelValue', false)
}

function confirm() {
  if (!selected.value.length) return
  // 传档案原始行(含本行所有 INV 列),字段映射交给调用方
  emit('confirm', selected.value.map((r) => ({ ...r })))
  close()
}
</script>

<style scoped>
.pi-tip {
  font-size: 12px;
  color: #666;
  line-height: 1.7;
  margin-bottom: 10px;
}
.pi-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.pi-key {
  width: 260px;
}
.pi-grow {
  flex: 1 1 auto;
}
.pi-sel {
  font-size: 13px;
  color: #1c4f8a;
}
.pi-err {
  margin-top: 8px;
  font-size: 12px;
  color: #b91c1c;
}
.pi-pager {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}
</style>
