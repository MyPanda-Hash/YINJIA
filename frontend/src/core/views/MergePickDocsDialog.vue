<!-- MergePickDocsDialog.vue — 「合单生单 · 选单」弹窗(2026-11-24 用户口径)

     【用户原话】
       「和单生单添加一个弹窗选择,不再是勾选了,而是点击合单生单弹出一个窗口,这个窗口可以选择单据,
        选择单据后,加入到现在的合单生单页面。然后又删除按钮,可以删除掉不需要单据的明细。也可以重新添加,
        在合单生单页面多一个选择单据的按钮,选择后单据明细会添加进来,已经有的明细就只补没有的就行。
        参考金蝶erp选单的设计逻辑。」

     【在本流程里的位置】
       ① 采购订单列表 → 点「合单生单」→ **本弹窗**(选单)→ 确定 → 打开合单页面(GenerateLinesDialog,merge);
       ② 合单页面里再点「选择单据」→ 还是本弹窗 → 确定 → 只把**还没加入的明细行**补进合单页面。
       金蝶口味的要点:只列**已审核**且**还有未送数量**的源单(服务端 /px/voucherFlow/sources 已按此过滤)、
       勾选即选单、**同一供应商**才能合(混了别家当场拦,不让用户抱着幻想点到"确定合单生单"才发现)。

     【数据来源为什么不是 queryFormDataList】
       选单要能看出"这张订单还剩多少可送",否则用户只能凭单号猜。/px/voucherFlow/sources 返的是
       已审核 + 行级剩余(剩余数量/可送上限)的同一份口径,与生单页面、后端校验完全同源。 -->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('选择采购订单')"
    width="1080px"
    top="4vh"
    class="mpd-dialog"
    append-to-body
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="onOpen"
  >
    <div class="mpd">
      <!-- 顶部:查询条件 + 口径提示 -->
      <div class="mpd-bar">
        <span class="mpd-chip">{{ tt('来源单据') }}: {{ sourceName || tt('采购订单') }}</span>
        <span class="mpd-chip">{{ tt('可送数量') }} > 0 · {{ tt('已审核') }}</span>
        <span v-if="lockSupplier" class="mpd-chip mpd-lock">
          {{ tt('只能选同一供应商的采购订单') }}: {{ lockSupplier }}
          <el-button v-if="!supplier" link type="primary" size="small" @click="clearLock">{{ tt('清除') }}</el-button>
        </span>
        <el-input v-model="keyword" size="small" style="width: 150px" clearable
                  :placeholder="tt('单据编号')" @keyup.enter="load(1)" @clear="load(1)" />
        <!-- 供应商可手打片段:合单必须同一家,先按供应商收窄才找得到"两张同家的单"。
             服务端「供应商」是参照字段(默认等值),片段搜索靠控制键 `_fuzzy`(= 该字段按 LIKE) -->
        <el-input v-if="!lockSupplier" v-model="supplierKw" size="small" style="width: 160px" clearable
                  :placeholder="tt('供应商')" @keyup.enter="load(1)" @clear="load(1)" />
        <el-date-picker v-model="dateFrom" size="small" type="date" value-format="YYYY-MM-DD"
                        :placeholder="tt('开始日期')" style="width: 130px" clearable @change="load(1)" />
        <span class="mpd-between">-</span>
        <el-date-picker v-model="dateTo" size="small" type="date" value-format="YYYY-MM-DD"
                        :placeholder="tt('结束日期')" style="width: 130px" clearable @change="load(1)" />
        <el-button size="small" type="primary" :loading="loading" @click="load(1)">{{ tt('查询') }}</el-button>
      </div>

      <!-- 表:勾一张加入一张(已加入的置灰,不重复选) -->
      <el-table ref="tableRef" v-loading="loading" :data="rows" row-key="__no" size="small" border height="420"
                :empty-text="tt('没有可加入的已审核采购订单')" @selection-change="onSel" @row-click="onRowClick">
        <el-table-column type="selection" width="42" :selectable="selectableRow" />
        <el-table-column :label="tt('序号')" width="52" align="center">
          <template #default="{ $index }">{{ (pageNo - 1) * pageSize + $index + 1 }}</template>
        </el-table-column>
        <el-table-column :label="tt('单据编号')" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ noOf(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('单据日期')" width="110">
          <template #default="{ row }">{{ dateOf(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('供应商')" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ supplierOf(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('行数')" width="70" align="right">
          <template #default="{ row }">{{ itemsOf(row).length }}</template>
        </el-table-column>
        <el-table-column :label="tt('可送数量')" width="100" align="right">
          <template #default="{ row }">{{ remainOf(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('状态')" width="96" align="center">
          <template #default="{ row }">
            <el-tag v-if="addedOf(row)" size="small" type="info">{{ tt('已添加') }}</el-tag>
            <el-tag v-else size="small" type="success">{{ tt('可加入') }}</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页(服务端按页取;/px/voucherFlow/sources 的 totalSize 是本页过滤后的条数,
           所以这里只说「本页 N 条」,不编一个跨页的假总数) -->
      <div class="mpd-pager">
        <span class="mpd-sum">{{ tt('本页') }} <b>{{ rows.length }}</b> {{ tt('条记录') }}</span>
        <el-button size="small" :disabled="pageNo <= 1 || loading" @click="load(pageNo - 1)">{{ tt('上一页') }}</el-button>
        <span class="mpd-page-no">{{ pageNo }}</span>
        <el-button size="small" :disabled="rows.length < pageSize || loading" @click="load(pageNo + 1)">{{ tt('下一页') }}</el-button>
      </div>
    </div>

    <template #footer>
      <span class="mpd-picked">
        {{ tt('已选') }} <b>{{ picked.length }}</b> {{ tt('张单据') }}
      </span>
      <el-button @click="close">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!picked.length" @click="confirm">{{ tt('加入合单') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'

const engine = usePanelRuntime()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 来源面板(合单这一条链路恒为采购订单) */
  sourcePanel: { type: String, default: 'PU_ORDER' },
  /** 目标面板(送料暂收单):服务端按它校验选单权限 */
  targetPanel: { type: String, default: '' },
  /** 来源明细键(与选单接口同一份契约) */
  sourceKey: { type: String, default: 'items' },
  /** 来源面板显示名(不传就按「采购订单」) */
  sourceName: { type: String, default: '' },
  /**
   * 已经在合单页面上的单据号:列表里标「已添加」。
   * ⚠ 仍然**可选** —— 再选一次只会补进"页面上还没有的明细行"(去重在合单页面按 lineKey 做),
   * 这样"删错了一行 → 再选同一张单"能把那一行补回来,正是用户口径里的「也可以重新添加」。
   */
  addedNos: { type: Array, default: () => [] },
  /** 已加入单据的供应商:一旦有值就锁死,只列这一家的订单(合单只允许同一供应商) */
  supplier: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const PAGE_SIZE = 20
const pageSize = PAGE_SIZE
const tableRef = ref(null)
const loading = ref(false)
const rows = ref([])
const picked = ref([])
const pageNo = ref(1)
const keyword = ref('')
/** 供应商片段(未锁定时可用):服务端按 `_fuzzy` 走 LIKE */
const supplierKw = ref('')
const dateFrom = ref('')
const dateTo = ref('')
/** 本次勾选的供应商(父组件还没锁定时由第一次勾选锁定,金蝶选单是同一套「选了这家就只剩这家」) */
const chosenSupplier = ref('')

/** 真正生效的供应商锁定:父组件给了就用父组件的(合单页面已有单据),否则用本次勾选出来的 */
const lockSupplier = computed(() => String(props.supplier || chosenSupplier.value || '').trim())

const addedSet = computed(() => new Set((props.addedNos || []).map(String)))

function noOf(row) { return String(row?.['编号'] || row?.['单据编号'] || row?.['单号'] || '') }
function supplierOf(row) { return String(row?.['供应商'] || row?.['供应商编码'] || '').trim() }
function dateOf(row) { return String(row?.['单据日期'] || row?.['日期'] || '').slice(0, 10) }
function addedOf(row) { return addedSet.value.has(noOf(row)) }

/** 来源明细行(服务端 /px/voucherFlow/sources 放在 detail.items,已按剩余量过滤) */
function itemsOf(row) {
  const detail = row?.detail
  if (!detail || typeof detail !== 'object') return []
  const key = Object.keys(detail).find((k) => Array.isArray(detail[k]))
  return key ? detail[key] : []
}
/** 这张订单还能送多少(行级剩余量合计)—— 一眼判断值不值得加入 */
function remainOf(row) {
  const sum = itemsOf(row).reduce((s, it) => s + Number(it?.['剩余数量'] ?? 0), 0)
  return Math.round(sum * 100) / 100
}

/**
 * 行能不能勾:**只受供应商锁定限制**。
 *
 * 已在合单页面上的单**照样能勾**(状态列标「已添加」)—— 用户口径「也可以重新添加……
 * 已经有的明细就只补没有的行」正是靠这条生效:删掉的行可以再选回来,已在页面上的行不会被重复加。
 */
function selectableRow(row) {
  return !lockSupplier.value || supplierOf(row) === lockSupplier.value
}

function onSel(sel) {
  picked.value = sel
  // 父组件没锁定供应商时,用第一张勾选的单锁定(勾了 A 家,别家的行自动不可勾)
  if (!props.supplier) {
    if (!sel.length) chosenSupplier.value = ''
    else chosenSupplier.value = supplierOf(sel[0])
  }
}
function clearLock() {
  chosenSupplier.value = ''
  picked.value = []
  load(1)
}

/**
 * 点整行也能勾(2026-11-13 用户口径「所有多选弹窗都点行即可」)——
 * 只点那颗小方框太窄,金蝶选单也是整行点一下就打勾。
 * ⚠ 点复选框本身不再翻一次(否则勾了立刻被切回去,与 RefPickDialog 同一条排他判据)。
 */
function onRowClick(row, column, event) {
  const t = event?.target
  if (t && typeof t.closest === 'function' && t.closest('.el-checkbox, .el-table-column--selection')) return
  if (!selectableRow(row)) return
  const on = !(picked.value || []).some((r) => noOf(r) === noOf(row))
  tableRef.value?.toggleRowSelection(row, on)
}

async function load(page = 1) {
  pageNo.value = page || 1
  loading.value = true
  try {
    const condition = {}
    if (lockSupplier.value) {
      condition['供应商'] = lockSupplier.value
    } else if (String(supplierKw.value || '').trim()) {
      condition['供应商'] = String(supplierKw.value).trim()
      // 参照字段默认等值匹配;手打片段要 LIKE ⇒ 显式声明该字段按模糊走(见 QueryService `_fuzzy`)
      condition['_fuzzy'] = '供应商'
    }
    const kw = String(keyword.value || '').trim()
    if (kw) condition['单据编号'] = kw
    if (dateFrom.value) condition['开始日期'] = dateFrom.value
    if (dateTo.value) condition['结束日期'] = dateTo.value
    const res = await engine.purchaseFlowSources({
      sourcePanel: props.sourcePanel,
      targetPanel: props.targetPanel,
      sourceKey: props.sourceKey,
      condition,
      pageNo: pageNo.value,
      pageSize,
    })
    rows.value = (res?.list || []).map((r) => ({ ...r, __no: noOf(r) }))
    picked.value = []
    // 重新查询 = 重新开始:上一轮勾选锁出来的供应商不能继续压着新的查询条件
    // (否则「先点了 A 家 → 再按 B 家搜」会被旧锁顶掉,列表永远是 A 家)
    if (!props.supplier) chosenSupplier.value = ''
  } catch (e) {
    rows.value = []
    picked.value = []
    ElMessage.error(engine.errMsg(e) || tt('候选单据加载失败'))
  } finally {
    loading.value = false
  }
}

function onOpen() {
  keyword.value = ''
  supplierKw.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  chosenSupplier.value = ''
  picked.value = []
  pageNo.value = 1
  load(1)
}

function close() { emit('update:modelValue', false) }

function confirm() {
  // 已加入合单的单据**也允许再选**(用户口径「也可以重新添加……已有的明细只补没有的」):
  // 具体补哪些行由合单页面按 lineKey 去重,这里只做"至少勾了一张 / 同一供应商"两道闸。
  const picks = picked.value || []
  if (!picks.length) { ElMessage.warning(tt('请先勾选要加入合单的采购订单')); return }
  // 合单只允许同一供应商(金蝶选单也是必须先按往来单位筛)。
  // 锁定生效时列表里已经全是这一家,这里只兜"父组件没锁 + 用户一次勾了多家"的那种。
  const suppliers = [...new Set(picks.map(supplierOf).filter(Boolean))]
  if (suppliers.length > 1) {
    ElMessage.warning(`${tt('合单生单只能选同一供应商的采购订单，当前勾了')}：${suppliers.join('、')}`)
    return
  }
  emit('confirm', { nos: picks.map(noOf), supplier: suppliers[0] || '', rows: picks })
  close()
}
</script>

<style scoped>
.mpd { display: flex; flex-direction: column; gap: 8px; }
.mpd-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12.5px; color: #46586e; }
.mpd-chip { background: #f2f6fa; border: 1px solid #e1e8f0; border-radius: 4px; padding: 2px 8px; }
/* 供应商锁定:用主色描边,让"本次只能选这一家"一眼可见 */
.mpd-lock { background: #eef6ff; border-color: #b9d7f5; color: #1e6fb8; display: inline-flex; align-items: center; gap: 4px; }
.mpd-between { color: #909399; }
.mpd-pager { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #46586e; }
.mpd-sum { margin-right: auto; }
.mpd-page-no { min-width: 24px; text-align: center; font-weight: 600; }
.mpd-picked { float: left; line-height: 32px; font-size: 12.5px; color: #46586e; }
.mpd-dialog :deep(.el-table__body-wrapper tbody tr) { cursor: pointer; }
</style>
