<!--
  MobileOtherScan.vue — 「手机扫码 · 其他领料 / 其他退料」(2026-11-16)

  【用户口径(原话)】
  「手机端再做一个其他领料和其他退料,其他领料关联其他入库单,其他退料就还是按生产退料来。
   其他领料和退料都是直接扫物料二维码进行的。扫完几个二维码后,可以点提交。
   就生成了,之后重新扫就是另一个单据了」

  三问确认后落定的口径:
    ① 其他领料 → **其他出库单 OTHER_OUT**(扣库存;原话里的「其他入库单」是口误);
    ② 其他退料 → **生产退料单 MATERIAL_RET**,业务类型仍写「生产退料」;
    ③ 页面只要「扫码 + 提交」,不做已提交列表 —— 提交成功就把清单清空,**接着扫就是另一张单**。

  【一个组件两个入口】
  side 由路由 props 固定(pick = 其他领料 / ret = 其他退料),两个菜单叶子指向同一页面,
  只是落的单据不同 —— 免得把「扫物料 → 加清单 → 提交」这套交互复制两份、以后改一处漏一处。

  【为什么扫物料码就能建单(不需要工单)】
  这两页是「随手领 / 随手退」:现场手上有什么料就扫什么,不按 BOM、不挂工单。
  所以物料是否可领只由**库存**决定(领料不得超过该 物料+仓库+批号 的现存量),
  退料没有上限(退的是手上这批货,没有"已领多少"可比)。

  【落库走通用面板引擎,不新写后端】
  /px/callButton(panelCode=OTHER_OUT|MATERIAL_RET, buttonName=保存) —— 与扫码领料
  (views/scm/ScanPick.vue)完全同一条路:保存 = 提交为**待审核**单据,真正的过账仍在
  「其他出库单 / 生产退料单」里由仓管审核,本页不碰库存数字。

  【其他退料的仓库由现场选(2026-11-19)】
  用户口径:「手机扫码的其他退料,改为可以选择退料的仓库。」
  ⇒ 扫到物料后**不论库存里有没有这个料**都出「退到仓库」下拉:默认带库存行所在的仓,
   现场可改成别的仓(退的是手上这批货,不一定要回原仓);改过一次后**粘住**,
   后面连扫的几条都退到同一个仓(一次退好几条到同仓是常态),提交/清空后复位。
  其他领料**不给选**:领料只能从有货的仓出,仓库以库存行为准。
-->
<template>
  <div class="mo-scan">
    <!-- 2026-11-18:头部与「生产领料 / 生产退料」同一套(标题 + 接口地址 + 说明) -->
    <div class="mo-top">
      <div class="mo-head">
        <span class="mo-title">{{ tt(titleText) }}</span>
        <span v-if="baseUrl" class="mo-base" :title="baseUrl">{{ baseUrl }}</span>
      </div>
      <span class="mo-sub">{{ tt(subText) }}</span>
    </div>

    <div class="mo-scanbar">
      <el-input
        ref="scanInput"
        v-model="scanText"
        :placeholder="tt('扫描或输入物料码（存货编码|批号）')"
        clearable
        size="large"
        @keyup.enter="onScan"
      />
      <el-button size="large" :loading="probing" @click="onScan">{{ tt('查询') }}</el-button>
      <!-- 相机扫码(2026-11-17 用户口径「其他领料和其他退料没有扫码按钮」):
           与生产领料/扫码混料同一条原生桥 window.YjNative.scan();网页版没有桥就不显示这颗按钮 -->
      <el-button v-if="nativeScan" size="large" :loading="scanning" @click="scanMaterial">
        {{ tt('扫码') }}
      </el-button>
    </div>

    <el-alert v-if="errText" :title="errText" type="warning" :closable="false" show-icon class="mo-alert" />

    <el-alert
      v-if="lastDoc"
      :title="lastMsg"
      type="success"
      :closable="false"
      show-icon
      class="mo-alert"
    />

    <div v-if="candidates.length" class="mo-card">
      <!-- ══════════ 领料:批次勾选(2026-11-28)══════════
           用户口径:「扫码出库是需要连带出批次号。可勾选,按勾选的批次号再进行自动填入和排序,
           自动填入数量,按顺序扣批次号。并且把 PC0000 放在最上面」
           · 扫物料码 ⇒ 列出该物料**全部批次**(PC0000 最前,其余按批号日期先进先出);
           · 勾上哪些批次,本次数量就只在这几批里按顺序扣;一批不够自动落到下一批;
           · 勾选不够本次数量 ⇒ 提示「还差 X」,可再勾别的批次(不硬拦,库存以金蝶为准)。 -->
      <template v-if="!isReturn && selRows.length">
        <!-- 物料抬头:批次表只列批号,把「这是什么料」摆一行,现场不用回头看扫码框 -->
        <div class="mo-mat">
          <span class="mo-mat-name">{{ current?.['存货名称'] || current?.['存货编码'] || '' }}</span>
          <span class="mo-mat-meta">
            {{ current?.['存货编码'] || '' }} · {{ current?.['规格型号'] || '—' }} · {{ current?.['计量单位'] || '—' }}
          </span>
        </div>
        <div class="mo-batch-head">
          <el-checkbox
            :model-value="batchAllOn === true"
            :indeterminate="batchAllOn === 'indeterminate'"
            :title="tt('全选')"
            @change="onBatchCheckAll"
          />
          <span class="mo-bh-lot">{{ tt('批号') }}</span>
          <span class="mo-bh-wh">{{ tt('仓库') }}</span>
          <span class="mo-bh-avail">{{ tt('可用') }}</span>
          <span class="mo-bh-qty">{{ tt('本次') }}</span>
        </div>
        <div
          v-for="(b, i) in selRows"
          :key="i"
          class="mo-batch-row"
          :class="{ 'is-checked': b.checked, 'is-scanned': b.scanned }"
        >
          <el-checkbox :model-value="b.checked" @change="(v) => onBatchCheck(i, v)" />
          <span class="mo-bh-lot">
            <span class="mono">{{ b.lot || tt('无批次') }}</span>
            <span v-if="isDefaultLot(b.lot)" class="mo-batch-default" :title="tt('默认批（金蝶不分批商品的批号）')">
              {{ tt('默认批') }}
            </span>
            <span v-if="b.scanned" class="mo-batch-scan">{{ tt('扫到') }}</span>
          </span>
          <span class="mo-bh-wh">{{ b.warehouse || '—' }}</span>
          <span class="mo-bh-avail num">{{ fmt(b.avail) }}</span>
          <span class="mo-bh-qty num">{{ b.qty > 0 ? fmt(b.qty) : '—' }}</span>
        </div>
        <div class="mo-batch-tip">{{ tt('勾选的批次按顺序自动填入本次数量（PC0000 最先）') }}</div>
      </template>

      <!-- ══════════ 退料:候选批次卡(点一行选中,数量按这一批算)══════════ -->
      <template v-else>
        <div
          v-for="(c, i) in candidates"
          :key="i"
          class="mo-cand"
          :class="{ picked: i === candIndex }"
          @click="pickCand(i)"
        >
          <div class="mo-cand-main">
            <div class="mo-cand-name">{{ c['存货名称'] || c['存货编码'] }}</div>
            <div class="mo-cand-meta">{{ c['存货编码'] }} · {{ c['规格型号'] || '—' }} · {{ c['计量单位'] || '—' }}</div>
            <div class="mo-cand-meta">
              {{ tt(isReturn ? '库存仓' : '仓库') }}：{{ c['仓库'] || c['仓库编码'] || '—' }} · {{ tt('批号') }}：{{ c['批号'] || tt('无批次') }}
            </div>
          </div>
          <div class="mo-cand-stock">
            <div class="mo-stock-num">{{ fmt(c['现存量']) }}</div>
            <div class="mo-stock-cap">{{ tt('可用量') }}</div>
          </div>
        </div>
      </template>

      <!-- 退料到哪个仓(2026-11-19 用户口径「手机扫码的其他退料,改为可以选择退料的仓库」):
           库存里查得到就默认它所在的仓,现场随时可改成别的仓 —— 退的是手上这批货,
           不一定回原仓(如退到原料不良品仓)。其他领料不显示这一栏:领料只能从有货的仓出。 -->
      <div v-if="showWh" class="mo-wh">
        <span class="mo-qty-label">{{ tt('退到仓库') }}</span>
        <el-select
          v-model="warehouseCode"
          :placeholder="tt('请选择仓库')"
          size="large"
          filterable
          class="mo-wh-sel"
          @change="markWhTouched"
        >
          <el-option v-for="w in whOptions" :key="w.code" :label="w.name" :value="w.code" />
        </el-select>
        <span v-if="!whOptions.length" class="mo-wh-hint">{{ tt('仓库档案没加载出来，请返回重进') }}</span>
      </div>

      <div class="mo-qty">
        <span class="mo-qty-label">{{ isReturn ? tt('本次数量') : tt('本次出库数量') }}</span>
        <el-input-number v-model="qty" :min="0" :precision="2" :step="1" size="large" @change="onQtyChange" />
        <span class="mo-qty-unit">{{ current?.['计量单位'] || '' }}</span>
        <el-button type="primary" size="large" :disabled="!canAdd" @click="addLine">{{ tt('加入清单') }}</el-button>
      </div>
      <!-- 2026-11-26 用户口径:库存只提示不拦截(真实库存以金蝶为准,MES 现存量随时会被同步抹平/回填) -->
      <div v-if="qtyWarn" class="mo-qty-hint">{{ qtyWarn }}</div>
    </div>

    <div class="mo-list">
      <div class="mo-list-head">
        <span>{{ tt(listTitle) }}</span>
        <span class="mo-list-count">{{ lines.length }}</span>
      </div>
      <el-empty v-if="!lines.length" :description="tt('还没有扫码加入的物料')" :image-size="70" />
      <div v-for="(l, i) in lines" :key="l.key" class="mo-line">
        <div class="mo-line-main">
          <span class="mo-line-name">{{ l.name }}</span>
          <span class="mo-line-meta">{{ l.code }} · {{ l.batch || tt('无批次') }} · {{ l.warehouse || '—' }}</span>
        </div>
        <div class="mo-line-qty">{{ fmt(l.qty) }} {{ l.uom }}</div>
        <el-button text type="danger" size="small" @click="removeLine(i)">{{ tt('移除') }}</el-button>
      </div>
    </div>

    <div class="mo-foot">
      <el-button size="large" @click="reset">{{ tt('清空') }}</el-button>
      <el-button type="primary" size="large" :loading="saving" :disabled="!lines.length" @click="submit">
        {{ tt('提交') }}
      </el-button>
    </div>

    <!-- 历史单据 + 查询(2026-11-16 第二轮「显示历史单据,扫码相当于查询」;
         第三轮用户口径:「点击进明细界面再打印……补打印就不要扫码了,就查询补打印就可以」)
         ⇒ 列表只负责**查 + 点进去**;打印移到明细页(MobileOtherDoc),不再有行内按钮、也不再扫码补打。 -->
    <section class="mo-hist">
      <div class="mo-list-head">
        <span>{{ tt('查询单据') }}</span>
        <el-button text size="small" :loading="listLoading" @click="loadList">{{ tt('刷新') }}</el-button>
      </div>
      <div class="mo-hist-row">
        <el-input
          v-model="keyword"
          :placeholder="tt('输入单号或关键字查询')"
          clearable
          size="large"
          @keyup.enter="onQuery"
        />
        <el-button size="large" :loading="listLoading" @click="onQuery">{{ tt('查询') }}</el-button>
      </div>
      <div class="mo-hist-hint">{{ tt('点单据进明细页，在那里打印或补打印') }}</div>
      <el-alert v-if="printMsg" :title="printMsg" type="info" :closable="false" show-icon class="mo-print-msg" />

      <div v-for="g in groups" :key="g.key" class="mo-grp">
        <div class="mo-grp-head" @click="toggleGroup(g.key)">
          <span class="mo-grp-title">{{ tt(g.title) }}</span>
          <span class="mo-grp-num">{{ g.items.length }}</span>
          <span class="mo-grp-arrow" :class="{ open: openGroups[g.key] }">›</span>
        </div>
        <template v-if="openGroups[g.key]">
          <div v-if="!g.items.length" class="mo-empty">{{ tt('没有单据') }}</div>
          <div
            v-for="d in g.items"
            :key="d.单据编号"
            class="mo-doc"
            :class="{ hit: d.单据编号 === located }"
            @click="openDoc(d.单据编号)"
          >
            <div class="mo-doc-l1">
              <span class="mo-doc-no mono">{{ d.单据编号 }}</span>
              <span class="mo-doc-state">{{ tt(d.单据状态) }}</span>
              <span class="mo-doc-arrow">›</span>
            </div>
            <div class="mo-doc-l2">
              <span>{{ d.单据日期 || '—' }}</span>
              <span>{{ tt('行数') }} {{ d.行数 || 0 }} · {{ tt('数量') }} {{ fmt(d.数量合计) }}</span>
            </div>
            <div class="mo-doc-l3">
              <span>{{ d.部门 || '—' }}</span>
              <span>{{ d.创建人 || '' }} {{ d.创建时间 || '' }}</span>
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup>
/**
 * side: 'pick' = 其他领料(其他出库单) / 'ret' = 其他退料(生产退料单)
 * 由路由 props 注入(见 router/index.js 两条静态路由),不在这里猜。
 */
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { queryFormDataList, callButton, errMsg } from '@/business/engine'
import { parseBarcode, matchPickRows } from '@/business/scanPick'
import { makeBatchRows } from '@/business/scanCode'
import { isDefaultLot, checkAll, allCheckedState, round4 } from '@/business/batchAlloc'
import { allocateScannedFirst, reallocate } from '@/business/mobilePick'
import {
  SIDE_RET, isRet, panelOfSide, titleOfSide, checkQty, mergeLine, buildForm,
  doneMessageKey, toWarehouseOptions, defaultWarehouseCode, withWarehouse,
} from '@/business/scanOther'
import { printSlip } from '@/business/slipPrintFlow'
import { focusScanNow } from '@/business/scanFocus'
import { scanOnce, hasNativeScan } from '@/business/nativeScan'
import request from '@core/request'

const props = defineProps({
  side: { type: String, default: 'pick' },
})

/** 原生相机扫码(只在壳里出现,判据与其他手机扫码页一致:壳注入了 window.YjNative.scan) */
const nativeScan = hasNativeScan()
/** 接口地址(与生产领料/退料顶部同一行只读展示;网页版没有壳就为空) */
const baseUrl = (() => {
  try { return (window.YjNative && window.YjNative.getBaseUrl && window.YjNative.getBaseUrl()) || '' } catch { return '' }
})()

// 经手人/领用人 = 当前登录人(单头那一栏不该空着,现场出问题要能追到人)
const userStore = useUserStore()

const isReturn = computed(() => isRet(props.side))
const titleText = computed(() => titleOfSide(props.side))
const listTitle = computed(() => (isReturn.value ? '其他退料清单' : '其他领料清单'))
const subText = computed(() => (isReturn.value
  ? '扫物料码 → 核对仓库/批号 → 加入清单 → 提交生成生产退料单;提交后接着扫就是另一张单'
  : '扫物料码 → 核对可用量 → 加入清单 → 提交生成其他出库单;提交后接着扫就是另一张单'))

const scanInput = ref(null)
const scanText = ref('')
const probing = ref(false)
const scanning = ref(false)         // 相机扫码进行中(与页面里 probing 区分:一个是查库存,一个是开相机)
const saving = ref(false)
const errText = ref('')
const candidates = ref([])
/**
 * 领料侧的**批次勾选行**(2026-11-28 用户口径「扫码出库是需要连带出批次号。可勾选,
 * 按勾选的批次号再进行自动填入和排序,自动填入数量,按顺序扣批次号。并且把 PC0000 放在最上面」)。
 *
 * <p>与 `candidates` 的关系:候选行还是同一批库存行(`v_stock_pick` 的 物料×仓库×批号),
 * 但页面用它渲染成**可勾选表** —— checked 决定这次从哪几批出,qty 是按顺序自动填出来的量。
 * 退料侧不勾选(退的是手上这批货),仍走原来的候选卡 + 点选。
 */
const selRows = ref([])
const candIndex = ref(0)
const qty = ref(1)
const lines = ref([])
const lastDoc = ref('')
const lastMsg = ref('')

// 打印(2026-11-16):提交即打印;补打印在**明细页**(MobileOtherDoc)里做。kind 决定纸面标题与派单类型
const printing = ref(false)
const printMsg = ref('')
const slipKind = computed(() => (isReturn.value ? 'OTHER_RET' : 'OTHER_PICK'))

// 历史单据(2026-11-16 第二轮):查询框 + 按状态分组的列表;点一行进明细页
const keyword = ref('')
const listLoading = ref(false)
const docs = ref([])
const located = ref('')                 // 刚提交/刚查到的那张单(高亮)
const openGroups = ref({ 待审核: true, 已审核: true, 已作废: false })
const router = useRouter()

/**
 * 列表分组:待审核(含草稿) / 已审核 / 已作废 —— 空组不显示(已作废除外,永远留一格)。
 * 与「生产领料」的「未完成 / 已完成」同一形态(那边按业务阶段,这边按单据状态)。
 */
const groups = computed(() => {
  const bucket = { 待审核: [], 已审核: [], 已作废: [] }
  for (const d of docs.value) {
    const k = d['单据状态'] === '已作废' ? '已作废' : (d['单据状态'] === '已审核' ? '已审核' : '待审核')
    bucket[k].push(d)
  }
  return ['待审核', '已审核', '已作废']
    .map((k) => ({ key: k, title: k, items: bucket[k] }))
    .filter((g) => g.items.length || g.key === '已作废')
})

// 仓库下拉(2026-11-19:其他退料改成"退到哪个仓由现场选",不再是库存没命中时的兜底)
const warehouses = ref([])
const warehouseCode = ref('')
// 现场是否亲手选过仓库(选过就"粘住":同一批料连着扫,都退到同一个仓,不再被库存行的仓刷新)
const whTouched = ref(false)

const current = computed(() => candidates.value[candIndex.value] || null)
/**
 * 「退到仓库」这一栏什么时候出现。
 *
 * <p>2026-11-19 用户口径「手机扫码的其他退料,改为可以选择退料的仓库」:
 * 其他退料**库存命中也照样可改**(退的是手上这批货,不一定回原仓),故 ret 一律显示;
 * 其他领料保持原样 —— 只有库存行本身没有仓库时才需要手选(领料只能从有货的仓出)。
 */
const showWh = computed(() => {
  if (!current.value) return false
  if (isReturn.value) return true
  return !current.value['仓库'] && !current.value['仓库编码']
})
/** 下拉项:停用仓已排掉;默认仓若落在停用仓里也要能显示(否则下拉是空的) */
const whOptions = computed(() => {
  const list = warehouses.value.slice()
  const code = String(warehouseCode.value || '').trim()
  if (code && !list.some((w) => w.code === code)) list.push({ code, name: whNameOf(code) })
  return list
})
const canAdd = computed(() => {
  if (!current.value) return false
  if (isReturn.value) {
    if (showWh.value && !warehouseCode.value) return false
    return checkQty(props.side, qty.value, Number(current.value['现存量'])).ok
  }
  // 领料:至少要有一批被自动填上数量才能加入清单
  return selRows.value.some((b) => round4(b.qty) > 0)
})

/** 表头「全选批次」勾选框状态 */
const batchAllOn = computed(() => allCheckedState(selRows.value))
/** 领料:已按勾选分配到各批次的合计 */
const pickAllocated = computed(() => round4(selRows.value.reduce((s, b) => s + round4(b.qty), 0)))
/** 领料:本次数量还没被勾选批次覆盖的缺口 */
const pickShortage = computed(() => round4(Math.max(0, (Number(qty.value) || 0) - pickAllocated.value)))

/**
 * 库存提示(2026-11-26 用户口径「移动端给提示就行不拦截」)。
 *
 * <p>超过可用量 / 该批号可用量为 0 时只给一句话,不挡「加入清单」也不挡提交 ——
 * 真实库存以金蝶为准,MES 的现存量随时会被同步抹平或回填,拿它做硬闸会让现场"有货却领不出去"。
 * 硬拦只剩「数量 ≤ 0」那一种(拦的是输错,不是库存)。
 */
const qtyWarn = computed(() => {
  if (!current.value) return ''
  // 领料:勾选批次的可用量不够本次数量 ⇒ 提示还差多少(不硬拦,库存以金蝶为准)
  if (!isReturn.value) {
    if (pickShortage.value > 0) {
      return `${tt('勾选批次的可用量不够')},${tt('还差')} ${fmt(pickShortage.value)} ${current.value['计量单位'] || ''}`
        + ` — ${tt('可再勾选别的批次')}`
    }
    return ''
  }
  const c = checkQty(props.side, qty.value, Number(current.value['现存量']))
  if (!c.warn) return ''
  return c.reason === 'exceed'
    ? tt('超过当前可用量（MES 库存以金蝶为准，仍可加入清单）')
    : tt('该批号可用量为 0（MES 库存以金蝶为准，仍可加入清单）')
})

onMounted(() => {
  nextTick(() => scanInput.value?.focus?.())
  // 进页就把历史单据拉出来(生产领料同样是"上面查询、下面列单")
  loadList()
  // 其他退料一进来就把仓库档拉好:选仓是主流程的一部分,不能等"库存没命中"才拉
  if (isReturn.value) loadWarehouses()
})

const fmt = (n) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)
}

/**
 * 取档案类面板(mode=archive)的行。
 *
 * <p>档案面板按「类别」分组返回:`data.list = [{ 编号, 状态, detail:{ inv:[行…] } }]`,
 * 行埋在 detail[表别名] 里,不是平表那种 `data.list = [行…]`。这里把各组摊平;
 * 顺带兼容平表形态(万一以后改成 flat,不至于又白屏)。
 *
 * @param {object} res queryFormDataList 返回的 data
 * @param {string} alias detail 里的数组键(inv / wh)
 */
function archiveRows(res, alias) {
  const out = []
  for (const g of (res?.list || [])) {
    const arr = g?.detail?.[alias]
    if (Array.isArray(arr)) out.push(...arr)
    else if (g && g['存货编码'] !== undefined) out.push(g)   // 平表兜底
  }
  return out
}

const reasonText = (reason) => ({
  empty: tt('请扫描或输入物料码'),
  'no-code': tt('条码格式不对：应为「存货编码|批号」'),
  'too-many': tt('这个不是条码管理里的标签（码内容应为 存货编码|批号）'),
  'no-match': tt(isReturn.value ? '没找到这个物料：请核对物料编码' : '这个物料目前没有可用库存'),
  'no-qty': tt('数量要大于 0'),
  'no-stock': tt('该批号可用量为 0'),
  exceed: tt('数量超过了该批号的可用量'),
  'no-cand': tt('请先扫码选中一个物料'),
  'no-batch': tt('请先勾选要出库的批次'),
  'no-warehouse': tt('请选择退到哪个仓库'),
  'no-docno': tt('请扫描单据二维码或输入单号'),
}[reason] || '')

/**
 * 相机扫物料码(2026-11-17 新增,用户口径「其他领料和其他退料没有扫码按钮」)。
 *
 * <p>调用与生产领料 / 扫码混料**完全同一条**:business/nativeScan 的 {@link scanOnce}
 * → 壳里 `window.YjNative.scan()` → 回传 `window.__yjScanResult(code, ok)`。
 * 扫到就把码填进输入框并立刻查库存,等于"扫一次 = 查一次",不额外多点一次「查询」。
 */
async function scanMaterial() {
  errText.value = ''
  scanning.value = true
  try {
    const r = await scanOnce()
    if (!r.ok) {
      if (r.reason !== 'cancelled') errText.value = scanErrText(r)
      return
    }
    scanText.value = r.text
    await onScan()
  } finally {
    scanning.value = false
    focusScanNow(() => scanInput.value, { delay: 150 })
  }
}

/** 扫码失败原因 → 现场看得懂的话(与其他手机扫码页同一套文案) */
function scanErrText(r) {
  const map = {
    denied: tt('未授予相机权限，请在系统设置里开启后重试'),
    'not-native': tt('当前环境不支持相机扫码'),
    timeout: tt('扫码超时，请重试或改用输入框'),
    empty: tt('没有扫到内容'),
  }
  return map[r.reason] || (tt('扫码失败：') + (r.message || ''))
}

/** 扫/回车:解析码 → 按存货编码查 STOCK_PICK(批号级可用量) */
async function onScan() {
  errText.value = ''
  lastDoc.value = ''
  candidates.value = []
  candIndex.value = 0
  selRows.value = []
  // 本页的扫码框**只认物料码**(2026-11-16 第三轮:补打印改走查询,不再扫单据码)
  const parsed = parseBarcode(scanText.value)
  if (!parsed.ok) {
    errText.value = reasonText(parsed.reason)
    return
  }
  probing.value = true
  try {
    // 退料的仓库下拉必须就绪(退料 = 选仓 + 扫码);进页那次没拉到就这里再补一次
    if (isReturn.value && !warehouses.value.length) await loadWarehouses()
    // ⚠ 只按「存货编码」查,不带批号 —— 标签批号与 kucun 实际批号常常对不上,
    //   带批号会把可用行全查空(2026-10-18 实测 849 个材料码全空)。批号只用于排序优先。
    const res = await queryFormDataList({
      panelCode: 'STOCK_PICK',
      condition: { 存货编码: parsed.code },
      pageNo: 1,
      pageSize: 50,
    })
    const hits = matchPickRows(res.list || [], parsed)
    if (hits.length) {
      candidates.value = hits
      candIndex.value = 0
      syncWarehouse()
      if (isReturn.value) {
        qty.value = 1
        return
      }
      // 领料(2026-11-28):把该物料**全部批次**列成可勾选表 —— PC0000 最前,其余按批号日期先进先出;
      // 码里带批号的那一批标「扫到」并优先扣。默认数量 = 第一批的可用量(与旧行为一致)。
      selRows.value = makeBatchRows(hits, parsed.batch)
      qty.value = Number(selRows.value[0]?.avail) || 1
      autoSelectBatches()
      return
    }
    if (!isReturn.value) {
      errText.value = reasonText('no-match')
      return
    }
    // 退料:库存里没有这料也要能退(退的是手上这批) ⇒ 查商品档案补名称/规格/单位
    await loadWarehouses()
    // ⚠ 档案类面板(INV/WH, mode=archive)返回的是**分组**结构:
    //   data.list = [{ 编号:'商品', detail:{ inv:[…] } }, …] —— 行在 detail.inv 里,
    //   不是平表那种 data.list = [行…]。2026-11-16 实测踩过:按 res.list[0] 取会拿到分组头,
    //   名称/规格/单位全是 undefined,界面只剩「· — · —」。
    const inv = await queryFormDataList({
      panelCode: 'INV',
      keyword: parsed.code,
      pageNo: 1,
      pageSize: 50,
    })
    const invRows = archiveRows(inv, 'inv').filter((r) => String(r['存货编码'] || '').trim() === parsed.code)
    const hit = invRows[0]
    if (!hit) {
      errText.value = reasonText('no-match')
      return
    }
    candidates.value = [{
      存货编码: hit['存货编码'],
      存货名称: hit['存货名称'],
      规格型号: hit['规格型号'],
      计量单位: hit['计量单位'],
      仓库: '',
      仓库编码: '',
      批号: parsed.batch,
      现存量: 0,
      结存单价: 0,
    }]
    qty.value = 1
    syncWarehouse()
  } catch (e) {
    errText.value = errMsg(e) || tt('查询可用量失败')
  } finally {
    probing.value = false
    // PDA 连扫(2026-11-16):扫完一条(命中/没命中都算)光标回到扫码框,好接着扫下一条
    focusScanNow(() => scanInput.value, { delay: 120 })
  }
}

/**
 * 「退到仓库」下拉默认值(2026-11-19)。
 *
 * <p>规则:库存里查得到 ⇒ 默认它所在的仓;查不到 ⇒ 空,逼现场选。
 * 但**现场亲手选过就粘住** —— 退料多半一次退好几条到同一个仓(如全退到原料不良品仓),
 * 每扫一条都把下拉刷回库存仓,等于逼人每条都重新选一次。
 */
function syncWarehouse() {
  if (!isReturn.value) return
  if (whTouched.value) return
  warehouseCode.value = defaultWarehouseCode(current.value)
}

/** 现场改了下拉:从此按他的选择走,不再被库存行覆盖 */
function markWhTouched() {
  whTouched.value = true
}

/** 仓库编码 → 显示名(档案里没有就用候选行自带的名称兜底,再不行显示编码) */
function whNameOf(code) {
  const key = String(code || '').trim()
  const hit = warehouses.value.find((w) => w.code === key)
  if (hit) return hit.name
  const c = current.value
  if (c && String(c['仓库编码'] || '').trim() === key && c['仓库']) return String(c['仓库']).trim()
  return key
}

/** 点候选行:切到这一行,仓库默认值跟着这一行走(除非现场已经手选过) */
function pickCand(i) {
  candIndex.value = i
  syncWarehouse()
}

/** 仓库档案(WH):其他退料一进页就拉,退料兜底时也用它;只拉一次 */
async function loadWarehouses() {
  if (warehouses.value.length) return
  try {
    const res = await queryFormDataList({ panelCode: 'WH', pageNo: 1, pageSize: 300 })
    warehouses.value = toWarehouseOptions(archiveRows(res, 'wh'))
  } catch {
    warehouses.value = []
  }
}

/**
 * 领料:扫到物料后的**默认勾选** —— 按顺序勾到够本次数量为止(不够就有货的全勾),
 * 码里带批号 ⇒ 那一批最先扣(与生产领料同一套,见 business/batchAlloc)。
 */
function autoSelectBatches() {
  const r = allocateScannedFirst(selRows.value, qty.value)
  selRows.value = r.rows
}

/** 领料:数量 / 勾选变了 → **保留现场勾选**按顺序重算(不再自动勾回) */
function recalcBatches() {
  const firstLot = String((selRows.value.find((b) => b.scanned) || {}).lot || '').trim()
  const r = reallocate(selRows.value, qty.value, { firstLot })
  selRows.value = r.rows
}

/** 本次数量变化(领料 = 总量,退料 = 这一行的数量) */
function onQtyChange() {
  if (isReturn.value) return
  recalcBatches()
}

/** 勾 / 取消勾某一批 */
function onBatchCheck(i, on) {
  const next = selRows.value.slice()
  if (!next[i]) return
  next[i] = { ...next[i], checked: !!on }
  selRows.value = next
  recalcBatches()
}

/** 表头全选 / 全不选 */
function onBatchCheckAll(on) {
  selRows.value = checkAll(selRows.value, !!on)
  recalcBatches()
}

function addLine() {
  // ── 领料(2026-11-28):勾了几批就按顺序拆成几行,一次扫一条物料全部落进清单 ──
  if (!isReturn.value) {
    const alloc = selRows.value.filter((b) => round4(b.qty) > 0)
    if (!alloc.length) {
      errText.value = reasonText('no-batch')
      return
    }
    let next = lines.value
    for (const b of alloc) {
      const res = mergeLine(next, b.row, b.qty, props.side)
      if (!res.ok) {
        errText.value = reasonText(res.reason)
        return
      }
      next = res.lines
    }
    lines.value = next
    clearScan()
    return
  }
  // ── 退料:仍按选中的那一行走(退的是手上这批货,不存在多批分摊)──
  const c = current.value
  if (!c) return
  // 退料的仓库以现场选择为准(合键/落库都按这个仓)
  if (showWh.value && !warehouseCode.value) {
    errText.value = reasonText('no-warehouse')
    return
  }
  const cand = showWh.value
    ? withWarehouse(c, { code: warehouseCode.value, name: whNameOf(warehouseCode.value) })
    : c
  const res = mergeLine(lines.value, cand, qty.value, props.side)
  if (!res.ok) {
    errText.value = reasonText(res.reason)
    return
  }
  lines.value = res.lines
  clearScan()
}

/** 加完一条 / 提交后:清掉扫码区(下一条直接扫) */
function clearScan() {
  scanText.value = ''
  candidates.value = []
  candIndex.value = 0
  selRows.value = []
  errText.value = ''
  nextTick(() => scanInput.value?.focus?.())
}

function removeLine(i) {
  const next = lines.value.slice()
  next.splice(i, 1)
  lines.value = next
}

function reset() {
  lines.value = []
  scanText.value = ''
  candidates.value = []
  candIndex.value = 0
  selRows.value = []
  errText.value = ''
  // 清空 = 开始另一张单:带着上一张选的仓进去只会把货记错仓,一并复位
  warehouseCode.value = ''
  whTouched.value = false
  nextTick(() => scanInput.value?.focus?.())
}

/**
 * 打一张单:优先发打印站点,没电脑在线就退回浏览器打印层。
 *
 * <p>打印**永远不该让业务回滚**(会话已经落库了),失败只提示、不抛。
 *
 * @param {string} kind OTHER_PICK|OTHER_RET(扫到别的种类的码时以码里的 kind 为准)
 * @param {string} no 单号
 * @param {string} source 来源标记(便于「自动打印」页看是谁发的)
 */
async function doPrint(kind, no, source) {
  printing.value = true
  printMsg.value = ''
  try {
    const r = await printSlip({ kind, docNo: no, source })
    if (r.ok && r.mode === 'station') {
      printMsg.value = `${tt('已发送到打印电脑')}${r.docNo ? '：' + r.docNo : ''}`
    } else if (r.ok) {
      printMsg.value = `${tt('已调用本机打印')}${r.docNo ? '：' + r.docNo : ''}`
    } else {
      printMsg.value = `${tt('打印失败')}${r.docNo ? '：' + r.docNo : ''}${r.message ? ' · ' + r.message : ''}`
    }
    return r
  } finally {
    printing.value = false
  }
}

/**
 * 历史单据(2026-11-16 第二轮):只列**本页自己开的单**。
 *
 * <p>为什么不列整张面板:其他出库单里还有 ERP 同步来的 `QTCK-*`,而其他退料与生产退料
 * 又落在同一张 `MATERIAL_RET` 上 —— 不筛的话现场翻半天找不到自己刚提交的那张。
 * 后端按**备注前缀**筛(建单时写死的「扫码其他领料(移动端)」/「扫码其他退料(移动端)」)。
 */
async function loadList() {
  listLoading.value = true
  try {
    const res = await request.post('/px/slip/list', {
      面板: panelOfSide(props.side),
      备注前缀: isReturn.value ? '扫码其他退料' : '扫码其他领料',
      关键字: String(keyword.value || '').trim(),
    })
    const d = res.data?.data || res.data || {}
    docs.value = Array.isArray(d.list) ? d.list : []
  } catch (e) {
    errText.value = errMsg(e) || tt('查询单据失败')
  } finally {
    listLoading.value = false
  }
}

/**
 * 查询:按单号/关键字查(2026-11-16 第三轮用户口径「补打印就不要扫码了,就查询补打印就可以」)。
 *
 * <p>⚠ 本页**不再解析单据二维码**:扫码补打印那条路撤掉了 —— 现场更常用的是直接敲单号,
 * 纸上的 `YJSLIP` 码仍印(单据身份),但手机端不靠它。
 */
async function onQuery() {
  located.value = ''
  await loadList()
}

function toggleGroup(key) {
  openGroups.value = { ...openGroups.value, [key]: !openGroups.value[key] }
}

/** 点一行 → 单据明细页(在那里看明细、点「打印」出纸) */
function openDoc(no) {
  const base = isReturn.value ? 'MOBILE_OTHER_RET' : 'MOBILE_OTHER_PICK'
  router.push({ path: `/panelx/list/${base}/doc`, query: { no: String(no || '').trim() } })
}

/** 提交:保存(= 提交为待审核)一张单据;成功即清空,接着扫就是新单 */
async function submit() {
  if (!lines.value.length) return
  saving.value = true
  errText.value = ''
  try {
    const panelCode = panelOfSide(props.side)
    const formData = buildForm(props.side, lines.value, { operator: userStore.realName || userStore.account })
    const res = await callButton({ panelCode, buttonName: '保存', formData })
    const no = res?.编号 || res?.单据编号 || res?.docNo || ''
    lastDoc.value = String(no || '')
    // 提示语走 tt(键) + 单号:整句带单号的动态串查不到译名,英文界面会漏中文
    lastMsg.value = tt(doneMessageKey(props.side)) + (lastDoc.value ? '：' + lastDoc.value : '')
    ElMessage.success(lastMsg.value)
    reset()
    // 刚提交的那张要立刻出现在下面的历史里(现场习惯:交完瞄一眼有没有进)
    located.value = lastDoc.value
    keyword.value = ''
    await loadList()
    // 🔴 提交即打印(2026-11-16 用户口径「这3个都是在提交的时候打印的」)
    if (lastDoc.value) await doPrint(slipKind.value, lastDoc.value, 'mobileOther.submit')
  } catch (e) {
    errText.value = errMsg(e) || tt(isReturn.value ? '生成生产退料单失败' : '生成其他出库单失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* 2026-11-18:版面口径与「生产领料」(MobilePickList.vue) 一致 —— 灰底 + 48px 顶栏 + 卡片 */
.mo-scan {
  box-sizing: border-box; width: 100%; max-width: 1180px; margin: 0 auto;
  padding: 0 0 16px; background: var(--el-bg-color-page); min-height: calc(100vh - 130px);
}
.mo-top {
  display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 12px;
  background: var(--el-bg-color); border-bottom: 1px solid var(--el-border-color-lighter);
}
.mo-head { display: flex; flex-direction: column; min-width: 0; }
.mo-title { font-size: 16px; font-weight: 600; }
.mo-base {
  max-width: 42vw; font-size: 11px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mo-sub {
  flex: 1; min-width: 0; margin-left: 4px; font-size: 12px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* 扫码行(2026-11-17 与生产领料/扫码混料对齐):输入框 + 查询 + 扫码 同一行,44px 命中区 */
.mo-scanbar {
  display: flex; align-items: center; gap: 8px; margin: 10px 12px 0; padding: 12px;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mo-scanbar :deep(.el-input) { flex: 1; min-width: 0; }
.mo-scanbar :deep(.el-input__wrapper) { min-height: 44px; }
.mo-scanbar :deep(.el-input__inner) { font-size: 16px; }   /* 16px 以下 iOS 会自动放大 */
.mo-scanbar :deep(.el-button) { height: 44px; min-width: 64px; flex: none; }
.mo-alert { margin-bottom: 12px; }
.mo-card { border: 1px solid var(--el-border-color-light); border-radius: 6px; overflow: hidden; margin-bottom: 14px; }
.mo-cand { display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--el-border-color-lighter); }
.mo-cand:last-of-type { border-bottom: 0; }
.mo-cand.picked { background: var(--el-color-primary-light-9); }
.mo-cand-main { flex: 1; min-width: 0; }
.mo-cand-name { font-size: 14px; font-weight: 500; }
.mo-cand-meta { margin-top: 2px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mo-cand-stock { text-align: right; flex: none; }
.mo-stock-num { font-size: 20px; font-weight: 600; color: var(--el-color-primary); font-variant-numeric: tabular-nums; }
.mo-stock-cap { font-size: 11px; color: var(--el-text-color-secondary); }
/* 批次勾选表(2026-11-28 扫码出库):PC0000 最前、按顺序扣;一行 44px 命中区 */
.mo-mat { display: flex; align-items: baseline; gap: 8px; padding: 10px 12px; background: var(--el-fill-color-lighter); border-bottom: 1px solid var(--el-border-color-lighter); }
.mo-mat-name { font-size: 14px; font-weight: 600; }
.mo-mat-meta { font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mo-batch-head, .mo-batch-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 12px;
}
.mo-batch-head { background: var(--el-fill-color-light); color: var(--el-text-color-secondary); }
.mo-batch-row { border-top: 1px solid var(--el-border-color-lighter); font-size: 13px; }
.mo-batch-row.is-checked { background: var(--el-color-primary-light-9); }
.mo-batch-row.is-scanned { box-shadow: inset 3px 0 0 var(--el-color-warning); }
.mo-bh-lot { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; word-break: break-all; }
.mo-bh-wh { flex: none; width: 66px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mo-bh-avail { flex: none; width: 56px; text-align: right; font-variant-numeric: tabular-nums; }
.mo-bh-qty { flex: none; width: 62px; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.mo-batch-default {
  flex: none; padding: 0 4px; border-radius: 3px; font-size: 10px;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary);
}
.mo-batch-scan {
  flex: none; padding: 0 4px; border-radius: 3px; font-size: 10px;
  background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2);
}
.mo-batch-tip { padding: 6px 12px 10px; font-size: 11px; color: var(--el-text-color-secondary); }
.mo-wh { display: flex; align-items: center; gap: 10px; padding: 12px; border-top: 1px solid var(--el-border-color-lighter); }
.mo-wh-sel { flex: 1; min-width: 0; }
.mo-wh-hint { flex: none; font-size: 12px; color: var(--el-color-warning); }
.mo-qty { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--el-fill-color-lighter); }
.mo-qty-label { font-size: 13px; color: var(--el-text-color-regular); flex: none; }
.mo-qty-unit { font-size: 13px; color: var(--el-text-color-secondary); min-width: 24px; }
/* 库存提示(2026-11-26):只是提醒,不挡操作 —— 颜色用 warning,不带红色/禁用态 */
.mo-qty-hint { padding: 6px 12px 0; font-size: 12px; line-height: 1.5; color: var(--el-color-warning); }
.mo-list { margin-bottom: 14px; }
.mo-list-head { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 6px; }
.mo-list-count { display: inline-block; min-width: 20px; text-align: center; padding: 0 6px; border-radius: 10px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; }
.mo-line { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--el-border-color-lighter); }
.mo-line-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mo-line-name { font-size: 14px; }
.mo-line-meta { font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mo-line-qty { font-size: 14px; font-variant-numeric: tabular-nums; }
.mo-foot { display: flex; gap: 10px; }
.mo-foot :deep(.el-button) { flex: 1; }
.mo-hist { margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--el-border-color-lighter); }
.mo-hist-row { display: flex; gap: 10px; }
.mo-hist-row :deep(.el-input) { flex: 1; }
.mo-hist-hint { margin-top: 6px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.mo-print-msg { margin-top: 10px; }
.mo-grp { margin-top: 14px; }
.mo-grp-head { display: flex; align-items: center; gap: 8px; padding: 8px 0; cursor: pointer; border-bottom: 1px solid var(--el-border-color-lighter); }
.mo-grp-title { font-size: 14px; font-weight: 600; }
.mo-grp-num { display: inline-block; min-width: 20px; text-align: center; padding: 0 6px; border-radius: 10px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; }
.mo-grp-arrow { margin-left: auto; color: var(--el-text-color-secondary); transition: transform 0.15s; }
.mo-grp-arrow.open { transform: rotate(90deg); }
.mo-empty { padding: 14px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mo-doc { padding: 10px 8px; border-bottom: 1px dashed var(--el-border-color-lighter); border-radius: 4px; cursor: pointer; }
.mo-doc:hover { background: var(--el-fill-color-lighter); }
.mo-doc.hit { background: var(--el-color-primary-light-9); }
.mo-doc-l1 { display: flex; align-items: center; gap: 8px; }
.mo-doc-no { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.mo-doc-state { margin-left: auto; font-size: 12px; padding: 0 6px; border-radius: 8px; background: var(--el-fill-color); color: var(--el-text-color-regular); }
.mo-doc-arrow { color: var(--el-text-color-secondary); font-size: 15px; }
.mo-doc-l2, .mo-doc-l3 { margin-top: 3px; display: flex; gap: 12px; font-size: 12px; color: var(--el-text-color-secondary); }
.mo-doc-l3 { word-break: break-all; }
@media (max-width: 480px) {
  .mo-qty { flex-wrap: wrap; }
  .mo-qty :deep(.el-input-number) { width: 120px; }
  /* 手机竖屏也不换行(输入框 + 查询 + 扫码一行),只收紧按钮内边距给输入框留宽度 */
  .mo-scanbar :deep(.el-button) { min-width: 56px; padding: 8px 10px; }
}
</style>
