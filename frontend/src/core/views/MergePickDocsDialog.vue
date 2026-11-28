<!-- MergePickDocsDialog.vue — 「合单生单 · 选单」弹窗(2026-11-24 用户口径,2026-11-28 按金蝶式明细行改版)

     【用户原话】
       「和单生单添加一个弹窗选择,不再是勾选了,而是点击合单生单弹出一个窗口,这个窗口可以选择单据,
        选择单据后,加入到现在的合单生单页面。然后又删除按钮,可以删除掉不需要单据的明细。也可以重新添加,
        在合单生单页面多一个选择单据的按钮,选择后单据明细会添加进来,已经有的明细就只补没有的就行。
        参考金蝶erp选单的设计逻辑。」

     【2026-11-28 客户口径·本次改版】
       「客户反馈物料罗列在一起,不好看是总共有哪些物料,改成和金蝶一样,一个单据,多个物料分行罗列出来。」+ 截图红框
       ⇒ 原来一张单一行、物料挤在一格里拼成「M2-D胶粉、M3-D胶粉」(还只显示前两个),看不出这张单到底有哪些物料。
         现在改成金蝶选单的样子:**一张单占一组行,组内一行一个物料**(单据编号/日期/供应商/行数/状态 用
         合并单元格纵向覆盖这一组的每一行),每行各自带 行号 / 物料编码 / 物料名称 / 规格型号 / 单位 / 数量 / 剩余数量。
         ⇒ 勾选仍是**按单据**(勾一格 = 这张单的全部明细;逐行勾选不是这套流程的语义:
            合单页面才是按行挑的,那里有行级勾选与数量)。

     【在本流程里的位置】
       ① 采购订单列表 → 点「合单生单」→ **本弹窗**(选单)→ 确定 → 打开合单页面(GenerateLinesDialog,merge);
       ② 合单页面里再点「选择单据」→ 还是本弹窗 → 确定 → 只把**还没加入的明细行**补进合单页面。
       金蝶口味的要点:只列**已审核**且**还有未送数量**的源单(服务端 /px/voucherFlow/sources 已按此过滤)、
       勾选即选单、**同一供应商**才能合(勾了第一张就把列表收窄到这一家,不是把别家涂灰)。

     【状态列(客户 2026-11-28 追问「可加入表达什么,还有别的状态吗」)】
       · 可加入     = 服务端已放行的候选(已审核 + 这单里还有未送量/超送额度),且它的明细**一条都不在**合单页面上;
       · 部分已添加 = 它的明细**有一部分**已经在合单页面上(通常是从合单页面删掉了几行,再选回来补);
       · 已添加     = 它的明细**全部**已经在合单页面上(此时再选不会重复加,只会提示"无需重复添加")。
       其余状态(未审核 / 已关闭作废 / 已全部送完且超送额度用尽 / 别家供应商)**根本不进这张列表**,
       所以列表里看不到它们 —— 这不是漏了状态,而是服务端选单口径只放"还能送的单"。

     【两轮用户补充】
       · 2026-11-24 一轮:「勾选后一个后只出现同一供应商」⇒ 第一次勾选即锁供应商并**重查**(服务端收窄),
         列表里干脆不出现别家;全部取消勾选则自动解除锁定。
       · 「支持模糊搜索」⇒ 顶部关键字走服务端 broad-OR(单号 / 供应商 / 物料编码 / 物料名称都能命中),
         与列表页搜索框同一口径;锁定后仍可在这家的范围内继续模糊筛。

     【数据来源为什么不是 queryFormDataList】
       选单要能看出"这张订单还剩多少可送",否则用户只能凭单号猜。/px/voucherFlow/sources 返的是
       已审核 + 行级剩余(剩余数量/可送上限)的同一份口径,与生单页面、后端校验完全同源。 -->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="tt('选择采购订单')"
    width="96vw"
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
        <span v-if="lockSupplier" class="mpd-tip">{{ tt('列表已只显示这一家的单据，可用关键字继续模糊搜索') }}</span>
        <!-- 关键字:模糊搜索(单号 / 供应商 / 物料编码 / 物料名称 都能命中) —— 与列表页搜索框同一口径,
             勾了第一张单后这里就在"这一家"的范围里继续模糊筛 -->
        <el-input v-model="keyword" size="small" style="width: 210px" clearable
                  :placeholder="tt('关键字：单号/供应商/物料')" @keyup.enter="load(1)" @clear="load(1)" />
        <!-- 供应商可手打片段(还没锁定时):合单必须同一家,先按供应商收窄才找得到"两张同家的单"。
             服务端「供应商」是参照字段(默认等值),片段搜索靠控制键 `_fuzzy`(= 该字段按 LIKE) -->
        <el-input v-if="!lockSupplier" v-model="supplierKw" size="small" style="width: 150px" clearable
                  :placeholder="tt('供应商')" @keyup.enter="load(1)" @clear="load(1)" />
        <el-date-picker v-model="dateFrom" size="small" type="date" value-format="YYYY-MM-DD"
                        :placeholder="tt('开始日期')" style="width: 130px" clearable @change="load(1)" />
        <span class="mpd-between">-</span>
        <el-date-picker v-model="dateTo" size="small" type="date" value-format="YYYY-MM-DD"
                        :placeholder="tt('结束日期')" style="width: 130px" clearable @change="load(1)" />
        <el-button size="small" type="primary" :loading="loading" @click="load(1)">{{ tt('查询') }}</el-button>
      </div>

      <!-- 表:一张单据占一组行,组内**一行一个物料**(2026-11-28 客户口径「和金蝶一样,一个单据,多个物料分行」) -->
      <div class="mpd-hint">{{ tt('选单加入合单：已加入的明细只补还没进来的行，不会重复') }}
        · {{ tt('灰显的明细行已经在合单页面里') }}</div>
      <el-table ref="tableRef" v-loading="loading" :data="flatRows" row-key="__key" size="small" border height="470"
                :empty-text="tt('没有可加入的已审核采购订单')" :span-method="spanMethod"
                :row-class-name="rowClassName" @row-click="onRowClick">
        <!-- 勾选按**单据**合并成一格(勾它 = 这张单的全部明细);表头那颗是本页全选 -->
        <el-table-column width="38" align="center">
          <template #header>
            <el-checkbox :model-value="pageAll" :indeterminate="pageSome" :disabled="!selectableDocs.length"
                         :title="tt('全选本页可加入的单据')" @change="(v) => toggleAllPage(v)" />
          </template>
          <template #default="{ row }">
            <el-checkbox :model-value="isDocPicked(row.__no)" :disabled="!selectableRow(row.__doc)"
                         :title="tt('把这张单据的全部明细加入合单')"
                         @change="(v) => toggleDoc(row.__doc, v)" />
          </template>
        </el-table-column>
        <el-table-column :label="tt('序号')" width="36" align="center">
          <template #default="{ row }">{{ (pageNo - 1) * pageSize + row.__idx + 1 }}</template>
        </el-table-column>
        <el-table-column :label="tt('单据编号')" min-width="104" show-overflow-tooltip>
          <template #default="{ row }">{{ row.__no }}</template>
        </el-table-column>
        <el-table-column :label="tt('单据日期')" width="86">
          <template #default="{ row }">{{ dateOf(row.__doc) }}</template>
        </el-table-column>
        <el-table-column :label="tt('供应商')" min-width="96" show-overflow-tooltip>
          <template #default="{ row }">{{ supplierOf(row.__doc) }}</template>
        </el-table-column>
        <!-- 这里数的是**可送行数**(服务端已把"已送完且超送额度用尽"的行滤掉),不是订单总行数 -->
        <el-table-column :label="tt('可送行数')" width="58" align="right">
          <template #default="{ row }">{{ docLineCount(row.__doc) }}</template>
        </el-table-column>
        <!-- 明细:一行一个物料 -->
        <el-table-column :label="tt('行号')" width="40" align="center">
          <template #default="{ row }">{{ lineNo(row) }}</template>
        </el-table-column>
        <el-table-column :label="tt('物料编码')" min-width="90" show-overflow-tooltip>
          <template #default="{ row }">{{ lineText(row, CODE_KEYS) }}</template>
        </el-table-column>
        <el-table-column :label="tt('物料名称')" min-width="98" show-overflow-tooltip>
          <template #default="{ row }">{{ lineText(row, NAME_KEYS) }}</template>
        </el-table-column>
        <el-table-column :label="tt('规格型号')" min-width="74" show-overflow-tooltip>
          <template #default="{ row }">{{ lineText(row, SPEC_KEYS) }}</template>
        </el-table-column>
        <el-table-column :label="tt('单位')" width="44" align="center">
          <template #default="{ row }">{{ lineText(row, UNIT_KEYS) }}</template>
        </el-table-column>
        <el-table-column :label="tt('数量')" width="62" align="right">
          <template #default="{ row }">{{ lineNum(row, '数量') }}</template>
        </el-table-column>
        <!-- 剩余 = 这行还能送多少(生单页面预填的就是它);剩余 0 但还有超送额度 → 标黄说明 -->
        <el-table-column :label="tt('剩余数量')" width="66" align="right">
          <template #default="{ row }">
            <span :class="{ 'mpd-over': overOnly(row) }" :title="overOnly(row) ? tt('已送完，仍可超送') : ''">
              {{ lineNum(row, '剩余数量') }}
            </span>
          </template>
        </el-table-column>
        <!-- 状态(2026-11-28 客户口径「为什么会出现两个状态,一个状态就够了」):
             两列合并成**一列**、按行判,优先级:
               已完成 = 金蝶侧该行已收满(未入库 0)⇒ 这行不能再生单(拿它生单转ERP 必被金蝶拒);
               已添加 = 这一行已经在合单页面上(再选不会重复加);
               可加入 = 还没进合单,可以勾/补进来。 -->
        <el-table-column :label="tt('状态')" width="86" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.__line && row.__line.已完成" size="small" type="info">{{ tt('已完成') }}</el-tag>
            <el-tag v-else-if="isLineAdded(row)" size="small" type="success">{{ tt('已添加') }}</el-tag>
            <el-tag v-else size="small">{{ tt('可加入') }}</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页(服务端按页取;/px/voucherFlow/sources 的 totalSize 是本页过滤后的条数,
           所以这里只说「本页 N 条」,不编一个跨页的假总数) -->
      <div class="mpd-pager">
        <span class="mpd-sum">{{ tt('本页') }} <b>{{ rows.length }}</b> {{ tt('张单据') }} ·
          <b>{{ flatRows.length }}</b> {{ tt('明细行') }}</span>
        <el-button size="small" :disabled="pageNo <= 1 || loading" @click="load(pageNo - 1)">{{ tt('上一页') }}</el-button>
        <span class="mpd-page-no">{{ pageNo }}</span>
        <el-button size="small" :disabled="rows.length < pageSize || loading" @click="load(pageNo + 1)">{{ tt('下一页') }}</el-button>
      </div>
    </div>

    <template #footer>
      <span class="mpd-picked">
        {{ tt('已选') }} <b>{{ pickedNos.length }}</b> {{ tt('张单据') }}
      </span>
      <el-button @click="close">{{ tt('取消') }}</el-button>
      <el-button type="primary" :disabled="!pickedNos.length" @click="confirm">{{ tt('加入合单') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'

const engine = usePanelRuntime()

/**
 * 明细字段候选键:**数据键,永不翻译**(ADR-0001)。
 * 各来源面板对同一件事叫法不同(采购订单行的单位叫「单位」,别的面板叫「计量单位」),
 * 写死一个键的后果就是整列空(2026-11-28 实测:写「计量单位」时单位列全是「-」)。
 */
const CODE_KEYS = ['物料编码', '存货编码', '产品编码']
const NAME_KEYS = ['物料名称', '存货名称', '产品名称']
const SPEC_KEYS = ['规格型号', '规格']
const UNIT_KEYS = ['单位', '计量单位']

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
   * 已经在合单页面上的单据号:没有行级信息时按它整体标「已添加」。
   * ⚠ 仍然**可选** —— 再选一次只会补进"页面上还没有的明细行"(去重在合单页面按 lineKey 做),
   * 这样"删错了一行 → 再选同一张单"能把那一行补回来,正是用户口径里的「也可以重新添加」。
   */
  addedNos: { type: Array, default: () => [] },
  /**
   * 已经在合单页面上的**明细行键**(2026-11-28,`单号#行id`):
   * 有了它才能把状态分到「可加入 / 部分已添加 / 已添加」,并把已加入的那几行灰显
   * (用户看到的"这行已经在里面了,再加只会补没进来的")。
   */
  addedLineKeys: { type: Array, default: () => [] },
  /** 已加入单据的供应商:一旦有值就锁死,只列这一家的订单(合单只允许同一供应商) */
  supplier: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const PAGE_SIZE = 20
const pageSize = PAGE_SIZE
const tableRef = ref(null)
const loading = ref(false)
/** 服务端返回的候选单据(每张单一行,`detail.items` 是它还剩可送量的明细行) */
const rows = ref([])
/** 本次勾选的单据号(勾选是**按单据**的,明细行在合单页面才逐行挑) */
const pickedNos = ref([])
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
const addedKeySet = computed(() => new Set((props.addedLineKeys || []).map(String)))

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
function docLineCount(row) { return itemsOf(row).length }

/** 明细行键:`单号#行id`(服务端 `_lineKey`;缺了就按同一套约定现拼,保证和合单页面的 lineKey 对得上) */
function lineKeyOf(row, item) {
  const k = String(item?.['_lineKey'] || '').trim()
  if (k) return k
  const id = item?.id
  return id === null || id === undefined ? '' : `${noOf(row)}#${id}`
}

/**
 * 表格数据:一张单据拆成 N 行(N = 该单的明细行数),组内第一行带 `__span = N`,
 * 其余行 `__span = 0` —— 配合 spanMethod 把单据级那几列纵向合并成一格(金蝶的合并单元格)。
 */
const flatRows = computed(() => {
  const out = []
  rows.value.forEach((row, idx) => {
    const no = noOf(row)
    const items = itemsOf(row)
    if (!items.length) {
      // 理论上服务端不会下发没有剩余行的单;真遇到就按"一张单一次"展示,不要让整行消失
      out.push({ __key: `${no}#__doc`, __doc: row, __no: no, __line: null, __lineKey: '', __span: 1, __idx: idx })
      return
    }
    items.forEach((it, i) => {
      out.push({
        __key: `${no}#${i}`,
        __doc: row,
        __no: no,
        __line: it,
        __lineKey: lineKeyOf(row, it),
        __span: i === 0 ? items.length : 0,
        __idx: idx,
      })
    })
  })
  return out
})

/** 单据级列(选择/序号/单据编号/单据日期/供应商/行数/状态)纵向合并;明细列不合并 */
const SPAN_COLS = new Set([0, 1, 2, 3, 4, 5, 13])
function spanMethod({ row, columnIndex }) {
  if (!SPAN_COLS.has(columnIndex)) return undefined
  const n = Number(row?.__span || 0)
  return n > 0 ? { rowspan: n, colspan: 1 } : { rowspan: 0, colspan: 0 }
}

/** 明细格取值:按候选键顺序取第一个有值的(各面板字段名不同) */
function lineText(row, keys) {
  const it = row?.__line || {}
  for (const k of keys) {
    const v = it[k]
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v)
  }
  return '-'
}
function lineNum(row, key) {
  const v = row?.__line ? row.__line[key] : ''
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : String(v)
}
/** 行号在库里是 decimal(`1.0000`),这里按整数显示(客户要的是"第几行",不是小数) */
function lineNo(row) {
  const v = row?.__line ? row.__line['行号'] : ''
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  return Number.isFinite(n) ? String(Math.round(n)) : String(v)
}
/** 剩余 0 但还有超送额度:这行照样能收(标黄说明,别让人以为"没得送了") */
function overOnly(row) {
  const it = row?.__line
  if (!it) return false
  return Number(it['剩余数量'] || 0) <= 0.000001 && Number(it['可送上限'] || 0) > 0.000001
}

/** 这一行是不是已经在合单页面上了(有行键就按行判,没有就退回按单据判) */
function isLineAdded(row) {
  if (row?.__lineKey) return addedKeySet.value.has(String(row.__lineKey))
  return addedOf(row?.__doc)
}
function rowClassName({ row }) { return isLineAdded(row) ? 'mpd-added-line' : '' }

/**
 * 这张单里**还能加**的明细(2026-11-28:金蝶已收满的行标「已完成」,不再作为可加入明细)。
 *
 * <p>状态列已按行展示(已完成 / 已添加 / 可加入),单据级"部分已添加"不再单独出一列
 * —— 客户口径「为什么会出现两个状态,一个状态就够了」。
 */
function usableLinesOf(doc) {
  return itemsOf(doc).filter((it) => !it.已完成)
}

/**
 * 行能不能勾:**只受供应商锁定限制**。
 *
 * 已在合单页面上的单**照样能勾**(状态列标「已添加」)—— 用户口径「也可以重新添加……
 * 已经有的明细就只补没有的行」正是靠这条生效:删掉的行可以再选回来,已在页面上的行不会被重复加。
 */
function selectableRow(row) {
  if (!lockSupplier.value || supplierOf(row) === lockSupplier.value) return usableLinesOf(row).length > 0
  return false
}
const selectableDocs = computed(() => rows.value.filter(selectableRow))
function isDocPicked(no) { return pickedNos.value.includes(String(no)) }
const pageAll = computed(() => selectableDocs.value.length > 0
  && selectableDocs.value.every((d) => isDocPicked(noOf(d))))
const pageSome = computed(() => !pageAll.value && selectableDocs.value.some((d) => isDocPicked(noOf(d))))

/**
 * 勾/取消勾一张单据(2026-11-24 用户口径「勾选了一个后只出现同一供应商」)。
 *
 * 口径:
 *   · 勾了**第一张单** ⇒ 把供应商锁成这一家,并且**重新查询(服务端收窄)** —— 不是把别家涂灰,
 *     而是干脆不列出来(列表里只剩同一供应商);
 *   · 锁定后仍可继续勾(同一家的其他单),不会再触发查询(只在供应商变化时查一次);
 *   · 全部取消勾选 ⇒ 解除锁定、恢复全量候选(相当于自动点一次「清除」)。
 */
function toggleDoc(doc, on) {
  if (!selectableRow(doc)) return
  const no = noOf(doc)
  const cur = new Set(pickedNos.value)
  if (on) cur.add(no)
  else cur.delete(no)
  pickedNos.value = [...cur]
  if (props.supplier) return
  if (!cur.size) {
    if (chosenSupplier.value) { chosenSupplier.value = ''; load(1) }
    return
  }
  const sup = supplierOf(doc)
  if (sup && sup !== chosenSupplier.value) {
    chosenSupplier.value = sup
    // keepPicked:重新查询后把刚勾的那张保住(不 keep 会"勾了一下就没了")
    load(1, { keepPicked: true })
  }
}

/** 表头全选:只勾**本页可勾**的单据;未锁供应商时按第一张单的供应商收窄(合单只允许同一家) */
function toggleAllPage(on) {
  if (!on) {
    pickedNos.value = []
    if (!props.supplier && chosenSupplier.value) { chosenSupplier.value = ''; load(1) }
    return
  }
  const list = selectableDocs.value
  if (!list.length) return
  const sup = lockSupplier.value || supplierOf(list[0])
  pickedNos.value = list.filter((d) => !sup || supplierOf(d) === sup).map(noOf)
  if (!props.supplier && sup && sup !== chosenSupplier.value) {
    chosenSupplier.value = sup
    load(1, { keepPicked: true })
  }
}

function clearLock() {
  chosenSupplier.value = ''
  pickedNos.value = []
  load(1)
}

/**
 * 点整行也能勾(2026-11-13 用户口径「所有多选弹窗都点行即可」)——
 * 只点那颗小方框太窄,金蝶选单也是整行点一下就打勾。
 * ⚠ 点复选框本身不再翻一次(否则勾了立刻被切回去,与 RefPickDialog 同一条排他判据)。
 */
function onRowClick(row, column, event) {
  const t = event?.target
  if (t && typeof t.closest === 'function' && t.closest('.el-checkbox')) return
  if (!selectableRow(row?.__doc)) return
  toggleDoc(row.__doc, !isDocPicked(row.__no))
}

async function load(page = 1, opts = {}) {
  const keepPicked = opts.keepPicked === true
  const keepNos = keepPicked ? [...pickedNos.value] : []
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
    if (dateFrom.value) condition['开始日期'] = dateFrom.value
    if (dateTo.value) condition['结束日期'] = dateTo.value
    const res = await engine.purchaseFlowSources({
      sourcePanel: props.sourcePanel,
      targetPanel: props.targetPanel,
      sourceKey: props.sourceKey,
      // 关键字走服务端 broad-OR(单号/供应商/物料名都能命中),不再只按单号查
      keyword: String(keyword.value || '').trim(),
      condition,
      pageNo: pageNo.value,
      pageSize,
    })
    rows.value = (res?.list || []).map((r) => ({ ...r, __no: noOf(r) }))
    // 重新查询 = 重新开始:上一轮勾选锁出来的供应商不能继续压着新的查询条件
    // (否则「先点了 A 家 → 再按 B 家搜」会被旧锁顶掉,列表永远是 A 家);
    // 但"锁定后为了只显示同一供应商"那一次重查要保住当前勾选,故 keepPicked 时不解除。
    if (!props.supplier && !keepPicked) chosenSupplier.value = ''
    const onPage = new Set(rows.value.map(noOf))
    pickedNos.value = keepNos.filter((no) => onPage.has(no)
      && selectableRow(rows.value.find((r) => noOf(r) === no)))
  } catch (e) {
    rows.value = []
    pickedNos.value = []
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
  pickedNos.value = []
  pageNo.value = 1
  load(1)
}

function close() { emit('update:modelValue', false) }

function confirm() {
  // 已加入合单的单据**也允许再选**(用户口径「也可以重新添加……已有的明细只补没有的」):
  // 具体补哪些行由合单页面按 lineKey 去重,这里只做"至少勾了一张 / 同一供应商"两道闸。
  const picks = pickedNos.value.map((no) => rows.value.find((r) => noOf(r) === no)).filter(Boolean)
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
.mpd-tip { color: #8b9893; }
.mpd-hint { font-size: 12px; color: #8b9893; }
.mpd-pager { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #46586e; }
.mpd-sum { margin-right: auto; }
.mpd-page-no { min-width: 24px; text-align: center; font-weight: 600; }
.mpd-picked { float: left; line-height: 32px; font-size: 12.5px; color: #46586e; }
/* 剩余 0 但还能超送:标黄,别让人以为是"这行没得送了" */
.mpd-over { color: #b88230; font-weight: 600; }
.mpd-dialog :deep(.el-table__body-wrapper tbody tr) { cursor: pointer; }
/* 已在合单页面里的明细行淡显(提示:加入时只会补没进来的行) */
.mpd-dialog :deep(.el-table__body .mpd-added-line > td) { color: #9aa4b0; background: #fafbfc; }
</style>
