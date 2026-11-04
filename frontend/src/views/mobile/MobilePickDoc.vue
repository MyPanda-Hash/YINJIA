<!--
  MobilePickDoc.vue — 手机扫码 · 生产领料单据详情(2026-10-30 第三轮改版)

  【两种状态,两套动作】
  · **未完成**(还没领完/没提交):扫物料码 → 填领料数量 → 全部领完才能「提交转材料出库单」;
  · **已完成**(已审核过账):这张单变成"可退料"的凭据 —— 扫物料码 → 填**退料**数量 → 提交退料,
    每次退料生成一张**带退料标志的其他入库单**(库存加回来),可分多次退。

  【用户口径】
  第三轮(本轮):「退料直接在生产领料界面。可以点开已完成的生产领料数据再次进行扫码。
    这样就可以来退料了。然后退料的单据做一个退料的标志。」
    确认:① 只有**已完成**能退;② 累计可退 = 已领 − 已退,可分多次;③ 单据头加「退料」标志列;
    ④ 领料单**保持已完成**(写着含退料即可)。
  第一轮(领料部分):「扫的是物料码,如果对应的物料码存在,就可以填写领料数量
    (数量可以随意填写,只要仓库数量足够,多少都可以),批次处理也保留之前的」

  【为什么不再有「退料页签」】
  上一版生单时就预建一张 0 数量的退料单草稿,所以页面要两个页签并排看。
  现在退料是**按需产生**的(退多少生多少),没有"待填的退料单"要看 ——
  页签取消,退料直接在"已完成"的同一张明细上做(勾选要退的行 → 填数量 → 提交退料)。
-->
<template>
  <div class="mp" :class="{ 'is-readonly': readOnly }">
    <div class="mp-top">
      <span class="mp-back" @click="goBack">‹</span>
      <div class="mp-head">
        <span class="mp-title">{{ doc.领料单号 || tt('领料单据') }}</span>
        <span class="mp-sub2">{{ doc.工单号 }}<i v-if="doc.工单行号"> #{{ doc.工单行号 }}</i></span>
      </div>
      <span class="mp-state" :class="{ done: isDone }">{{ doc.状态 }}</span>
      <!-- 刷新(2026-11-01):仓管审批、别处退料之后,这张单的状态要靠它拉最新 -->
      <el-button class="mp-refresh" size="small" :loading="loading" @click="refreshDoc">
        {{ tt('刷新') }}
      </el-button>
    </div>

    <div v-if="errText" class="mp-err mp-err-top">{{ errText }}</div>
    <div v-if="okText" class="mp-ok mp-err-top">{{ okText }}</div>

    <!-- 只读提示(2026-10-30:从开单工作台点进来,只能看不能操作) -->
    <div v-if="readOnly" class="mp-ro">
      {{ tt('只读查看:领料与退料请到「生产领料」里操作') }}
    </div>

    <!-- 抬头 -->
    <section class="mp-card">
      <div class="mp-kv"><span>{{ tt('工单号') }}</span><b>{{ doc.工单号 }}<i v-if="doc.工单行号"> #{{ doc.工单行号 }}</i></b></div>
      <div class="mp-kv"><span>{{ tt('产品') }}</span><b>{{ doc.产品名称 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('规格') }}</span><b>{{ wo.规格型号 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('生产线') }}</span><b>{{ wo.生产线 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('领料单号') }}</span><b class="mono">{{ doc.领料单号 || '—' }}</b></div>
      <!-- 退料标志(2026-10-30 第三轮):退过料就把退料单号列出来,一眼看到"这张含退料" -->
      <div class="mp-kv">
        <span>{{ tt('退料单号') }}</span>
        <b class="mono" :class="{ 'is-back': hasReturn }">
          {{ hasReturn ? doc.退料单号 : '—' }}
          <span v-if="hasReturn" class="mp-flag">{{ tt('含退料') }}</span>
        </b>
      </div>
      <div class="mp-kv">
        <span>{{ tt('领料进度') }}</span>
        <b class="num" :class="{ ok: progress.ok }">{{ progress.done }} / {{ progress.total }}</b>
      </div>
    </section>

    <!-- 扫码区:未完成=扫料领料;已完成=扫料退料(生成其他入库单)
         ⚠ 只读模式下(从开单工作台点进来)整块**不渲染**:那里只看明细,不做任何操作 -->
    <section v-if="!readOnly" class="mp-card">
      <div class="mp-sec">
        <!-- 已完成 = 退料(生成其他入库单);未完成 = 领料。标题跟着状态走,不让人误会 -->
        <span>{{ isDone ? (outAudited ? tt('扫物料码 · 退料') : tt('扫物料码')) : tt('扫物料码 · 领料') }}</span>
        <span v-if="cur" class="mp-sec-ok">{{ cur.编码 }}</span>
        <span v-if="isDone && outAudited" class="mp-sec-note">{{ tt('这张单已完成:扫码即退料,提交后生成其他入库单') }}</span>
        <span v-if="isDone && !outAudited" class="mp-sec-note">{{ tt('待仓管审批材料出库单,审批通过后才能退料') }}</span>
      </div>

      <!-- 已完成但材料出库单还没审批:还没扣库存,这时不能扫码退料 -->
      <div v-if="isDone && !outAudited" class="mp-hint">
        {{ tt('这张单已提交,材料出库单正在等仓管审批。审批通过(库存扣减)之后,再来这里扫码退料。') }}
      </div>

        <!-- 已完成的单**直接进退料模式**(loadDoc 里按状态设 returnMode=true)——
             用户口径「已完成的进去扫码应该是其他入库才对」,不再需要先点一次「开始退料」。
             扫物料码解锁:数量框只有扫到物料后才出现,写入/取消后重新锁定。
             ⚠ 2026-11-01:扫码区**始终显示**,未审批时"扫了再提示为什么不能退"
               (上一版整块隐藏,用户报障「扫码…没有了」)。 -->
        <div class="mp-row">
          <el-input
            ref="matInput"
            v-model="matText"
            :placeholder="tt('扫物料码或输入物料编码')"
            size="large"
            clearable
            @keyup.enter="scanMaterial"
          />
          <el-button size="large" :loading="matLoading" @click="scanMaterial">{{ tt('查询') }}</el-button>
          <el-button v-if="nativeScan" size="large" @click="scanInto">{{ tt('扫码') }}</el-button>
        </div>

        <div v-if="cur" class="mp-mat">
          <div class="mp-mat-main">
            <div class="mp-mat-name">{{ cur.名称 || cur.编码 }}</div>
            <div class="mp-mat-meta">
              {{ cur.编码 }} · {{ cur.规格 || '—' }} · {{ cur.单位 || '—' }}
              <template v-if="!returnMode && cur.BOM用量 > 0"> · {{ tt('需求') }} {{ fmtQty(cur.BOM用量) }}</template>
              <template v-if="returnMode"> · {{ tt('已领') }} {{ fmtQty(cur.已领数量) }} / {{ tt('已退') }} {{ fmtQty(cur.已退数量) }}</template>
            </div>
          </div>
          <div class="mp-mat-stock">
            <b class="num">{{ fmtQty(cur.上限) }}</b>
            <span>{{ returnMode ? tt('本次可退') : tt('可用总量') }}</span>
          </div>
        </div>

        <!-- 解锁区(2026-10-30):扫到物料才出现;「写入」或「取消」后**重新锁定**回到扫码 -->
        <template v-if="cur">
          <div class="mp-row mp-qty">
            <span class="mp-qty-label">{{ returnMode ? tt('退料数量') : tt('领用数量') }}</span>
            <el-input-number
              v-model="curQty"
              :min="0"
              :max="cur.上限"
              :precision="4"
              :step="1"
              size="large"
              controls-position="right"
              @change="onQtyChange"
            />
            <span class="mp-qty-unit">{{ cur.单位 || '' }}</span>
            <el-button type="primary" size="large" :loading="saving" :disabled="!(curQty > 0)" @click="saveQty">
              {{ tt('写入') }}
            </el-button>
            <el-button size="large" @click="cancelLock">{{ tt('取消') }}</el-button>
          </div>

          <!-- 批次:领料沿用先进先出拆批;退料按原领料批号回退 -->
          <div v-if="batchRows.length && !returnMode" class="mp-batches">
            <div class="mp-batches-head">
              <span class="mp-bh-lot">{{ tt('批号') }}</span>
              <span class="mp-bh-wh">{{ tt('仓库') }}</span>
              <span class="mp-bh-avail">{{ tt('可用') }}</span>
              <span class="mp-bh-qty">{{ tt('本次') }}</span>
            </div>
            <div
              v-for="(b, i) in batchRows"
              :key="i"
              class="mp-batch-row"
              :class="{ 'is-checked': b.qty > 0, 'is-scanned': b.scanned }"
            >
              <span class="mp-bh-lot">
                <span class="mp-batch-lot" :class="{ mono: !!b.lot }">{{ b.lot || tt('无批次') }}</span>
                <span v-if="b.scanned" class="mp-batch-scan">{{ tt('扫到') }}</span>
              </span>
              <span class="mp-bh-wh">{{ b.warehouse || '—' }}</span>
              <span class="mp-bh-avail num">{{ fmtQty(b.avail) }}</span>
              <span class="mp-bh-qty num">{{ b.qty > 0 ? fmtQty(b.qty) : '—' }}</span>
            </div>
            <div v-if="shortage > 0" class="mp-warn">
              {{ tt('库存不够') }}:{{ tt('还差') }} {{ fmtQty(shortage) }} {{ cur.单位 }}
            </div>
            <div v-else-if="nonFifo" class="mp-warn">{{ tt('当前不是先进先出,已写进明细备注') }}</div>
          </div>
        </template>

      <div v-if="!cur" class="mp-hint">
        {{ isDone
          ? tt('扫物料码:只有这张单里有的物料才能退,数量按「已领 − 已退」限制')
          : tt('扫物料码:物料存在才能填数量;数量可随意填,只要仓库数量足够') }}
      </div>
    </section>

    <!-- 明细 -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ returnMode ? tt('选择要退的物料') : tt('领料明细') }}</span>
        <span class="mp-sec-num">{{ rows.length }}</span>
        <!-- 列头(2026-10-30 用户口径「这里应该加个 已领/需求」):
             两侧数字各自有含义,不写列头会让人以为"0"是需求没填 -->
        <span v-if="!returnMode" class="mp-sec-note mp-colhint">
          {{ tt('已领') }} / {{ tt('需求') }}
        </span>
      </div>
      <div v-if="!rows.length" class="mp-empty">{{ tt('没有明细') }}</div>
      <div
        v-for="r in rows"
        :key="r.行号"
        class="mp-line"
        :class="{ 'is-cur': (cur && cur.编码 === r.编码) || (curRow && curRow.编码 === r.编码), 'is-ret': returnMode && qtyOf(r.编码) > 0, 'is-ro': rowLocked }"
        @click="!rowLocked && pickRow(r)"
      >
        <span class="mp-line-dot" :class="{ on: r.数量 > 0 }"></span>
        <div class="mp-line-main">
          <div class="mp-line-name">{{ r.名称 || r.编码 }}</div>
          <!-- 🔴 2026-11-04 用户口径:「表头是要带物料编码和规格型号和计量单位的,信息不完全」。
               原来是「编码 · 规格 · 批号」挤成一行小字,手机上一挤就看不全;改成三行标签对,
               编码/规格型号/单位各自成列,缺值显示 — (不省略行,避免看着像"没这个信息")。 -->
          <dl class="mp-line-fields">
            <div><dt>{{ tt('物料编码') }}</dt><dd>{{ r.编码 || '—' }}</dd></div>
            <div><dt>{{ tt('规格型号') }}</dt><dd>{{ r.规格 || '—' }}</dd></div>
            <div><dt>{{ tt('计量单位') }}</dt><dd>{{ r.单位 || '—' }}</dd></div>
            <template v-if="r.批号"><div><dt>{{ tt('批号') }}</dt><dd>{{ r.批号 }}</dd></div></template>
            <template v-if="returnMode"><div><dt>{{ tt('可退') }}</dt><dd>{{ fmtQty(canReturnOf(r)) }}</dd></div></template>
          </dl>
        </div>
        <!-- 退料:本次要退多少 -->
        <span v-if="returnMode" class="mp-line-qty num is-ret">
          {{ qtyOf(r.编码) > 0 ? '-' + fmtQty(qtyOf(r.编码)) : '—' }} <i>{{ r.单位 }}</i>
        </span>
        <!-- 领料:已领 / 需求(BOM 用量)。之前只显示单个"0",看不出还差多少 —— 用户 2026-10-30 报障 -->
        <span v-else class="mp-line-qty num" :class="{ ok: r.BOM用量 > 0 && r.数量 >= r.BOM用量, zero: !(r.数量 > 0) }">
          {{ fmtQty(r.数量) }}<span class="mp-sep">/</span>{{ r.BOM用量 > 0 ? fmtQty(r.BOM用量) : '—' }}
          <i>{{ r.单位 }}</i>
        </span>
      </div>
    </section>

    <!-- 底栏(只读模式下不渲染:这里没有可操作的东西) -->
    <div v-if="!readOnly" class="mp-foot">
      <template v-if="returnMode">
        <el-button size="large" @click="cancelReturn">{{ tt('退出退料') }}</el-button>
        <el-button
          type="warning"
          size="large"
          :loading="submittingReturn"
          :disabled="returnTotal <= 0"
          @click="submitReturn"
        >
          {{ tt('提交退料') }}{{ returnTotal > 0 ? ' (' + fmtQty(returnTotal) + ')' : '' }}
        </el-button>
      </template>
      <template v-else>
        <el-button size="large" :loading="printing" @click="reprint">{{ tt('打印二维码') }}</el-button>
        <el-button
          v-if="!isDone"
          type="primary"
          size="large"
          :loading="submitting"
          :disabled="!progress.ok"
          @click="submit"
        >
          {{ tt('提交转材料出库单') }}
        </el-button>
        <!-- 已完成单:分两种状态(2026-11-01)
             提交只生成**待审批**的材料出库单,库存要等仓管审批才扣;
             未审批时不能退料(退了等于凭空把料退进仓库),所以这里不给按钮,只提示等审批。 -->
        <el-button v-else-if="!outAudited" type="info" size="large" disabled>
          {{ tt('待仓管审批材料出库单') }}
        </el-button>
        <el-button v-else type="primary" size="large" @click="startReturn">{{ tt('开始退料') }}</el-button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { parseMaterialCode } from '@/business/scanCode'
import { makeBatchRows, allocateScannedFirst, allocateForQty, pickProgress, fmtQty, round4, isNonFifo } from '@/business/mobilePick'
import { printWoQr } from '@/business/print-formats'
import { queueToPrintStation } from '@/business/printStation'

const route = useRoute()
const router = useRouter()

/**
 * 单据主键 —— ⚠ 必须是**响应式**的(2026-10-30 修)。
 *
 * <p>原来写成 `const docId = Number(route.query.id) || 0`,只在组件**首次挂载**时取一次值。
 * 而 vue-router 对**同一个路由页**复用同一个组件实例:从列表先点 C01、返回、再点 F01 时,
 * 组件不会重建、onMounted 不重跑 ⇒ 页面永远停在第一张单的数据上。
 *
 * <p>用户 2026-10-30 报障「已完成的单据点开还是未完成,扫码应该是其他入库才对」正是这个:
 * 之前打开过一张未完成的单,再点已完成的单,看到的还是那张未完成的
 * (状态显示未完成、0/3、扫码走的是领料分支)。
 *
 * <p>修法:改成 computed 跟随 route.query.id,并在下方 watch 它重新加载。
 */
const docId = computed(() => Number(route.query.id) || 0)

/**
 * 只读模式(2026-10-30 用户口径:「还有明细里面只能看不能操作」)。
 *
 * <p>从「生成工单领料/退料单」点进来时带 {@code readOnly=1} —— 那一页是**开单工作台**,
 * 它的职责到"生单"为止;点开明细只是**看一眼开了什么**,领料/退料要在「生产领料」里做。
 * 只读模式下:扫码区、数量输入、提交/退料按钮全部不渲染,只剩抬头 + 明细。
 *
 * <p>⚠ 这只是**界面层**的约束。真正的写权限仍由后端按 MOBILE_PICK 的 pick/submit 词判定,
 * 拿令牌直接调接口照样要被拦 —— 界面隐藏从来不是安全边界。
 */
const readOnly = computed(() => String(route.query.readOnly || '') === '1')

/**
 * 明细行是否不可点(2026-10-30 用户口径「明细里面只能看不能操作」+「已完成的进去是要生成其他入库单」)。
 *
 * <p>三种情况都不可点:
 *   ① 只读模式(从开单工作台点进来);
 *   ② 这张单**已完成** —— 领料明细已是过账历史,点一行就往扫码区装料是错的;
 *      已完成单要动就只能走「开始退料」(退料 → 生成其他入库单);
 *   ③ 正在退料模式里点的那一行仍可点(否则退料没法按行选)。
 */
const rowLocked = computed(() => readOnly.value || (isDone.value && !returnMode.value))
const doc = ref({})
const wo = ref({})
const pickRows = ref([])

const matInput = ref(null)
const matText = ref('')
const matLoading = ref(false)
/** 整页加载态(刷新按钮用) */
const loading = ref(false)
const cur = ref(null)
const curQty = ref(0)
/** 被点中的明细行(只用于高亮与提示,不解锁 —— 见 pickRow 注释) */
const curRow = ref(null)
const batchRows = ref([])
const saving = ref(false)
const submitting = ref(false)
const printing = ref(false)
const errText = ref('')
const okText = ref('')

/**
 * 退料模式(2026-10-30 第三轮)。
 * 只有**已完成**的单能进;进去后扫物料码走 /returnScan,写入的是"本次退多少",
 * 逐项累加到 {@link #returnQty}(不落库,提交时一次性生成退料单)。
 */
const returnMode = ref(false)
/** 本次要退的: { 物料编码: 数量 } */
const returnQty = ref({})
const submittingReturn = ref(false)

const nativeScan = typeof window !== 'undefined' && !!(window.YjNative && window.YjNative.scan)

const isDone = computed(() => String(doc.value.状态 || '') === '已完成')

/**
 * 材料出库单是否已被仓管审批(2026-11-01)。
 *
 * 提交只生成**待审批**的材料出库单,库存要等仓管在「材料出库单」里审核才扣;
 * 未审批就退料 = 凭空把料退进仓库,所以这个状态决定底部给「开始退料」还是「待仓管审批」。
 * 后端同样有硬闸门(requireReturnable),这里只是别让人点了才被拒。
 */
const outAudited = computed(() => doc.value.出库已审批 === true)
/** 这张单是否含退料(抬头「退料单号」非空 = 退过料) */
/**
 * 这张单是否含退料(抬头「含退料」徽标 + 退料单号)。
 *
 * <p>🔴 2026-10-30 修正:**只有"已完成"的单才谈得上退料**。
 * 退料是提交过账**之后**的后续动作(见 submitReturn 的 requireReturnable 闸门);
 * 一张**未完成**的单不可能退过料。之前这里只看"退料单号非空",于是:
 * <ul>
 *   <li>第一版遗留的"生单时预建的空退料单"(OI-2026-10-0005)残留在台账上,
 *       让未完成的 LL-2026-10-0007 顶着「含退料」徽标 —— 用户 2026-10-30 截图报障的正是这个;</li>
 *   <li>已作废的退料单也可能还写着单号。</li>
 * </ul>
 * ⇒ 判据加上"必须已完成";遗留脏数据由 migrate-wo-pick-return-cleanup-20261030.sql 清理。
 */
const hasReturn = computed(() => isDone.value
  && !!(doc.value.退料单号 && String(doc.value.退料单号).trim()))
const progress = computed(() => pickProgress(pickRows.value))
const rows = computed(() => pickRows.value)
const shortage = computed(() => round4((Number(curQty.value) || 0) - batchRows.value.reduce((s, b) => s + round4(b.qty), 0)))
const nonFifo = computed(() => isNonFifo(batchRows.value))
/** 本次退料合计 */
const returnTotal = computed(() => round4(Object.values(returnQty.value).reduce((s, v) => s + (Number(v) || 0), 0)))

function qtyOf(code) { return round4(returnQty.value[code] || 0) }

/**
 * 该物料还能退多少 = 已领 − 已退(已退数量由后端按退料台账算过,存在行上的 已退数量)。
 * 未退过的行没有 已退数量 字段 ⇒ 按 0。
 */
function canReturnOf(r) {
  return round4(Math.max(0, (Number(r.数量) || 0) - (Number(r.已退数量) || 0)))
}

function clearMsg() { errText.value = ''; okText.value = '' }
function errMsgOf(e) { return e?.response?.data?.message || e?.message || '' }

function goBack() { router.push('/panelx/list/MOBILE_PICK') }

onMounted(() => {
  bindScan()
  loadDoc()
  nextTick(() => matInput.value?.focus?.())
})

/** 本页的扫码回调(具名,便于按引用撤销别人的绑定) */
function onScanResult(code, ok) { if (ok && code) applyScan(code) }

function bindScan() {
  if (typeof window !== 'undefined') window.__yjScanResult = onScanResult
}

/**
 * 回到本页时自动重拉(2026-11-01)。
 *
 * <p>keep-alive 会保留实例,从别处回来时 onMounted 不再执行;
 * 而"仓管批了没""别处退了多少"都是**外部**改的状态,不重拉就一直是旧的。
 * 首次挂载已由 mounted 加载,这里跳过以免开页面发两次请求。
 *
 * <p>🔴 2026-11-02:激活时**必须重新绑定本页的扫码回调**。全局只有一个
 * `window.__yjScanResult` 槽,三个手机页都会覆盖它;从明细返回列表时
 * 若是本页的回调还留在槽里,列表页扫工单码会被按"物料"找 ⇒ 报"找不到"。
 */
let activatedOnce = false
onActivated(() => {
  bindScan()
  if (!activatedOnce) { activatedOnce = true; return }
  loadDoc()
})

/**
 * 切换单据时重新加载(2026-10-30 修)。
 *
 * <p>vue-router 复用同一路由页的组件实例 ⇒ 只改 query.id 不会重跑 onMounted。
 * 不监听的话,从已完成单切到另一张单,页面还停在上一张的**状态与明细**上
 * (用户看到「已完成的点开还是未完成」就是它)。
 *
 * <p>切单时必须把**页面内临时状态**一起清掉:扫码框、解锁的数量框、批次、退料模式与待退数量、
 * 提示条 —— 否则会把这些属于"上一张单"的东西带进新单据,比数据没刷新更危险。
 */
watch(docId, () => {
  doc.value = {}
  wo.value = {}
  pickRows.value = []
  softReset()
  returnMode.value = false
  returnQty.value = {}
  loadDoc()
  nextTick(() => matInput.value?.focus?.())
})

/** 清掉扫码区与解锁态的临时状态(切单 / 提交后都用它) */
function softReset() {
  matText.value = ''
  cur.value = null
  curRow.value = null
  batchRows.value = []
  curQty.value = 0
  clearMsg()
}

onDeactivated(() => {
  try { if (window.__yjScanResult === onScanResult) delete window.__yjScanResult } catch { /* ignore */ }
})

onBeforeUnmount(() => {
  try { if (window.__yjScanResult === onScanResult) delete window.__yjScanResult } catch { /* ignore */ }
})

function scanInto() {
  if (!(window.YjNative && typeof window.YjNative.scan === 'function')) {
    errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入')
    return
  }
  try { window.YjNative.scan() } catch { errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入') }
}

function applyScan(code) {
  const p = parseMaterialCode(code)
  if (!p.ok) { errText.value = tt('这个码里没有物料编码'); return }
  matText.value = p.code
  scanMaterial(p.batch)
}

/**
 * 刷新按钮:重拉这张单(状态、进度、明细、是否已审批全都更新)。
 *
 * <p>为什么需要(2026-11-01 用户口径「手机端应该有一个刷新按钮,不然会出现旧缓存没跟新状态问题」):
 * PortalLayout 用 keep-alive 缓存页面,从别处回到这张单时实例是旧的;
 * 而"材料出库单有没有被仓管审批"这种状态**是别人在另一台电脑上改的**,
 * 不主动重拉就永远看不到 —— 用户会以为"我明明审批了,手机还说没审批"。
 */
async function refreshDoc() {
  loading.value = true
  try {
    await loadDoc()
    if (!errText.value) {
      okText.value = tt('已刷新')
      setTimeout(() => { if (okText.value === tt('已刷新')) okText.value = '' }, 1500)
    }
  } finally {
    loading.value = false
  }
}

async function loadDoc() {
  if (!docId.value) { errText.value = tt('没有指定单据:请从生产领料列表点进来'); return }
  clearMsg()
  try {
    const res = await request.get('/px/mobilePick/doc', { params: { id: docId.value } })
    const d = res.data?.data || res.data || {}
    doc.value = d
    wo.value = d.工单 || {}
    pickRows.value = (d.领料明细 || []).map(normalize)

    // 已完成单:进页面**直接就是退料模式**(2026-10-30 用户口径
    // 「已完成的进去扫码应该是其他入库才对」)。
    //   原来要先点一下「开始退料」才切模式,而完成态下扫码框默认走的是**领料**分支 ——
    //   用户直接扫就会调错接口(scanMaterial side='pick'),像是"还能领料"。
    //   领料只应发生在**未完成**的单上;已完成 = 已过账,之后只能退(生成其他入库单)。
    // 🔴 2026-11-01:只有「已完成 **且** 材料出库单已被仓管审批」才自动进退料模式。
    //   提交只生成待审批的出库单,库存还没扣;这时进退料等于凭空退料进仓。
    const done = String(d.状态 || '') === '已完成'
    if (done && d.出库已审批 === true) {
      returnMode.value = true
      returnQty.value = {}
    } else {
      returnMode.value = false
      returnQty.value = {}
    }
  } catch (e) {
    errText.value = errMsgOf(e) || tt('加载单据失败')
  }
}

function normalize(l) {
  const q = Number(l?.数量) || 0
  return {
    行号: String(l?.行号 ?? ''),
    编码: String(l?.编码 ?? '').trim(),
    名称: String(l?.名称 ?? '').trim(),
    规格: String(l?.规格 ?? '').trim(),
    单位: String(l?.单位 ?? '').trim(),
    仓库: String(l?.仓库 ?? '').trim(),
    仓库编码: String(l?.仓库编码 ?? '').trim(),
    数量: round4(q),
    批号: String(l?.批号 ?? '').trim(),
    明细备注: String(l?.明细备注 ?? '').trim(),
    BOM用量: Number(l?.BOM用量) || 0,
    已退数量: round4(l?.已退数量 || 0),
  }
}

/**
 * 点明细行 = **只做提示,不解锁**(2026-10-30 用户报障:
 * 「电脑端点击就可以添加领料了」—— 原来这里直接 `matText = 编码; scanMaterial()`,
 * 等于**点一下就把料"扫"进去了**,绕过了"必须扫物料码才解锁"的口径)。
 *
 * <p>现在:点一行只把它**高亮**(让人看清是哪个料),并提示"请扫物料码",
 * 解锁仍然只能靠扫物料码 / 扫码枪录码。手机上点行还有意义(看信息),
 * 电脑上点行不会误触发带料。
 */
function pickRow(r) {
  if (rowLocked.value) return
  curRow.value = r
  okText.value = `${tt('请扫物料码')}: ${r.编码}${r.名称 ? ' · ' + r.名称 : ''}`
}

/** 扫物料码 → 后端校验并回可用量/可退量 */
async function scanMaterial(scanBatch) {
  const code = String(matText.value || '').trim()
  clearMsg()
  cur.value = null
  batchRows.value = []
  if (!code) { errText.value = tt('请先扫描或输入物料编码'); return }
  // 🔴 2026-11-01 用户报障「扫码…没有了」的修正:
  //   上一版把「已完成但材料出库单未审批」时的**扫码区整块隐藏**了 ——
  //   业务上没错(未审批不能退料),但现场看到的是"扫码框凭空消失",像是功能坏了。
  //   改成:扫码区**一直显示**,扫了再明确告诉他为什么现在不能退。
  if (isDone.value && !outAudited.value) {
    errText.value = tt('材料出库单还没审批,暂时不能退料:请先让仓管在「材料出库单」里审核通过')
    return
  }
  matLoading.value = true
  try {
    if (returnMode.value) {
      // ── 退料:问后端"这个料还能退多少"
      const res = await request.post('/px/mobilePick/returnScan', { id: docId.value, code })
      const d = res.data?.data || res.data || {}
      if (!(Number(d.可退数量) > 0)) {
        throw new Error(`${tt('这个物料已经退完了')}({{ already }} ${tt('已领')} ${fmtQty(d.已领数量)},${tt('已退')} ${fmtQty(d.已退数量)})`.replace('{{ already }}', ''))
      }
      cur.value = {
        编码: d.编码, 名称: d.名称, 规格: d.规格, 单位: d.单位,
        上限: Number(d.可退数量) || 0,
        已领数量: Number(d.已领数量) || 0,
        已退数量: Number(d.已退数量) || 0,
        BOM用量: 0,
      }
      // 默认填满可退数量(现场多半是整项退),用户可改
      curQty.value = cur.value.上限
      returnQty.value = { ...returnQty.value, [code]: curQty.value }
      return
    }

    // ── 领料:问库存与批次
    const res = await request.post('/px/mobilePick/scanMaterial', {
      id: docId.value, code, batch: String(scanBatch || '').trim(), side: 'pick',
    })
    const d = res.data?.data || res.data || {}
    cur.value = {
      编码: d.编码, 名称: d.名称, 规格: d.规格, 单位: d.单位,
      上限: Number(d.允许上限) || 0,
      BOM用量: Number(d.BOM用量) || 0,
      当前数量: Number(d.当前数量) || 0,
      已领数量: 0, 已退数量: 0,
    }
    batchRows.value = makeBatchRows(Array.isArray(d.批次) ? d.批次 : [], String(scanBatch || '').trim())
    // 默认领用数量(2026-10-30 用户口径:「默认数量根据领料单需要的数量来」):
    //   ① 这一行已经填过数量 ⇒ 沿用(续领时不要把已填的冲掉);
    //   ② 否则取 **BOM 需求用量**(生单时写在明细备注里,后端解析成 BOM用量 下发);
    //   ③ 需求为 0(历史单/备注里没写)⇒ 退回库存上限,至少不是 0。
    // 都按上限夹住 —— 需求超过库存时只能领到库存那么多。
    const need = cur.value.BOM用量 > 0 ? cur.value.BOM用量 : cur.value.上限
    const preset = cur.value.当前数量 > 0 ? cur.value.当前数量 : need
    curQty.value = round4(Math.min(Math.max(0, preset), cur.value.上限))
    onQtyChange(curQty.value)
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询物料失败')
  } finally {
    matLoading.value = false
  }
}

/** 领料:数量变化 → 重算拆批(沿用先进先出) */
function onQtyChange(v) {
  if (returnMode.value) {
    // 退料:不拆批(按原领料批号回退),只更新本次退料表
    if (cur.value) {
      const q = round4(Math.min(Math.max(0, Number(v) || 0), cur.value.上限))
      returnQty.value = { ...returnQty.value, [cur.value.编码]: q }
      curQty.value = q
    }
    return
  }
  const need = round4(Number(v) || 0)
  const scanned = batchRows.value.some((b) => b.scanned)
  const r = scanned ? allocateScannedFirst(batchRows.value, need) : allocateForQty(batchRows.value, need)
  batchRows.value = r.rows
}

/** 写入(领料:落库;退料:只是记在本次退料表里,提交时才落库) */
async function saveQty() {
  if (!cur.value || !(curQty.value > 0)) return
  if (returnMode.value) {
    okText.value = `${tt('已记下')} ${cur.value.编码} · ${tt('退料')} ${fmtQty(curQty.value)} ${cur.value.单位}`
    matText.value = ''
    cur.value = null
    curQty.value = 0
    nextTick(() => matInput.value?.focus?.())
    return
  }
  saving.value = true
  clearMsg()
  try {
    const batches = batchRows.value
      .filter((b) => round4(b.qty) > 0)
      .map((b) => ({ 批号: b.lot, 仓库: b.warehouse, 仓库编码: b.warehouseCode, 数量: round4(b.qty) }))
    const res = await request.post('/px/mobilePick/setQty', {
      id: docId.value, side: 'pick', code: cur.value.编码, qty: round4(curQty.value), batches,
    })
    const d = res.data?.data || res.data || {}
    pickRows.value = (d.领料明细 || []).map(normalize)
    doc.value = { ...doc.value, 物料项数: d.物料项数, 已领项数: d.已领项数 }
    okText.value = progress.value.ok
      ? tt('全部明细已领完,可以提交')
      : `${tt('已写入')} ${cur.value.编码} · ${tt('还剩')} ${progress.value.missing.length} ${tt('项未领')}`
    matText.value = ''
    cur.value = null
    batchRows.value = []
    curQty.value = 0
    nextTick(() => matInput.value?.focus?.())
  } catch (e) {
    errText.value = errMsgOf(e) || tt('写入数量失败')
  } finally {
    saving.value = false
  }
}

/**
 * 取消本次填写并**重新锁定**回到扫码状态(2026-10-30 用户口径
 * 「只有扫了对应物料的编码才能解锁填入,填入后要重新锁定」)。
 *
 * 与「写入」后的清空是同一套动作;写成一个函数,免得两处各写一遍后渐渐不一致。
 */
function cancelLock() {
  // ⚠ 先记下编码再清 cur —— 清空后就取不到了(第一次写这里时前后顺序反了)
  const code = cur.value ? cur.value.编码 : ''
  if (returnMode.value && code) {
    // 退料模式:本次记下的也一并撤掉(用户按"取消"就是不想要了)
    const next = { ...returnQty.value }
    delete next[code]
    returnQty.value = next
  }
  matText.value = ''
  cur.value = null
  batchRows.value = []
  curQty.value = 0
  clearMsg()
  nextTick(() => matInput.value?.focus?.())
}

/** 进入退料模式 */
function startReturn() {
  if (!isDone.value) { errText.value = tt('这张单还没提交完成,不能退料'); return }
  // 材料出库单还没被仓管审批 ⇒ 库存没扣,不能退(后端 requireReturnable 同样拦)
  if (!outAudited.value) { errText.value = tt('材料出库单还没审批,不能退料:请先让仓管审核'); return }
  returnMode.value = true
  returnQty.value = {}
  clearMsg()
  nextTick(() => matInput.value?.focus?.())
}

function cancelReturn() {
  returnMode.value = false
  returnQty.value = {}
  cur.value = null
  matText.value = ''
  curQty.value = 0
  clearMsg()
}

/**
 * 提交退料:本次选中的所有物料一次生成**一张**退料单(其他入库单,带退料标志)并审核入账。
 */
async function submitReturn() {
  const items = Object.entries(returnQty.value)
    .map(([code, qty]) => ({ code, qty: round4(qty) }))
    .filter((x) => x.qty > 0)
  if (!items.length) return
  try {
    await ElMessageBox.confirm(
      `${tt('将退')} ${items.length} ${tt('项物料,合计')} ${fmtQty(returnTotal.value)}。`
      + tt('提交后生成一张带「退料」标志的其他入库单并入库,库存会增加。确定提交?'),
      tt('退料确认'),
      { confirmButtonText: tt('确定退料'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return }
  submittingReturn.value = true
  clearMsg()
  try {
    const res = await request.post('/px/mobilePick/submitReturn', { id: docId.value, items })
    const d = res.data?.data || res.data || {}
    okText.value = d.说明 || `${tt('退料成功')}:${d.退料单号}`
    ElMessage.success(tt('退料成功'))
    returnMode.value = false
    returnQty.value = {}
    cur.value = null
    matText.value = ''
    await loadDoc()
  } catch (e) {
    errText.value = errMsgOf(e) || tt('退料失败')
  } finally {
    submittingReturn.value = false
  }
}

/** 打印工单二维码:优先发打印站点,没在线站点就用本机打印层 */
async function reprint() {
  printing.value = true
  clearMsg()
  try {
    const res = await request.post('/px/mobilePick/reprint', { id: docId.value })
    const payload = (res.data?.data || res.data || {}).打印 || {}
    const queued = await queueToPrintStation({ ...payload, 来源: 'mobilePick.doc' })
    if (queued && queued.online) { okText.value = tt('已发送到打印电脑'); return }
    await printWoQr(payload)
  } catch (e) {
    errText.value = errMsgOf(e) || tt('打印失败')
  } finally {
    printing.value = false
  }
}

/** 提交领料:全部领完 → 审核 → 材料出库单过账 */
async function submit() {
  if (!progress.value.ok || isDone.value) return
  try {
    await ElMessageBox.confirm(
      tt('提交后领料单会审核过账成材料出库单。确定提交?'),
      tt('提交确认'),
      { confirmButtonText: tt('确定提交'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return }
  submitting.value = true
  clearMsg()
  try {
    const res = await request.post('/px/mobilePick/submit', { id: docId.value })
    const d = res.data?.data || res.data || {}
    doc.value = { ...doc.value, 状态: d.状态 || '已完成' }
    ElMessage.success(tt('已提交:材料出库单已生成'))
    okText.value = d.说明 || tt('已提交')
    await loadDoc()
  } catch (e) {
    errText.value = errMsgOf(e) || tt('提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.mp {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 0 16px;
  background: var(--el-bg-color-page);
  min-height: calc(100vh - 130px);
}
.mp * { box-sizing: border-box; }

.mp-top {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 8px;
  height: 48px; padding: 0 12px;
  background: var(--el-bg-color); border-bottom: 1px solid var(--el-border-color-lighter);
}
.mp-back {
  flex: none; width: 28px; font-size: 24px; line-height: 1;
  color: var(--el-text-color-regular); cursor: pointer; user-select: none;
}
.mp-head { display: flex; flex-direction: column; min-width: 0; }
.mp-title { font-size: 16px; font-weight: 600; }
.mp-sub2 { font-size: 11px; color: var(--el-text-color-secondary); }
.mp-sub2 i { font-style: normal; color: var(--el-text-color-placeholder); }
.mp-state {
  margin-left: auto; padding: 0 8px; border-radius: 4px; font-size: 12px;
  background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2);
}
.mp-state.done { background: var(--el-color-success-light-8); color: var(--el-color-success-dark-2); }
/* 刷新按钮:右上角固定,不参与挤压 */
.mp-refresh { flex: none; margin-left: 6px; }

.mp-card {
  margin: 10px 12px 0; padding: 12px;
  background: var(--el-bg-color); border-radius: 8px; border: 1px solid var(--el-border-color-lighter);
}
.mp-card.dim { opacity: .6; }
.mp-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; flex-wrap: wrap; }
.mp-sec-ok { font-size: 11px; font-weight: 400; color: var(--el-color-success); }
.mp-sec-note { font-size: 11px; font-weight: 400; color: var(--el-color-warning-dark-2); }
.mp-sec-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; font-weight: 400;
}

.mp-row { display: flex; align-items: center; gap: 8px; }
.mp-row :deep(.el-input), .mp-row :deep(.el-input-number) { flex: 1; min-width: 0; }
.mp-row :deep(.el-button) { height: 44px; min-width: 64px; margin-left: 0; }
.mp-row :deep(.el-input__wrapper) { min-height: 44px; }
.mp-row :deep(.el-input__inner) { font-size: 16px; }

.mp-qty { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.mp-qty-label { flex: none; font-size: 13px; color: var(--el-text-color-regular); }
.mp-qty :deep(.el-input-number) { flex: none; width: 130px; }
.mp-qty-unit { flex: none; min-width: 24px; font-size: 13px; color: var(--el-text-color-secondary); }
.mp-qty :deep(.el-button) { flex: 1 1 96px; }

.mp-kv { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; font-size: 13px; }
.mp-kv > span { width: 76px; flex: none; color: var(--el-text-color-secondary); }
.mp-kv > b { font-weight: 500; min-width: 0; word-break: break-all; }
.mp-kv > b.ok { color: var(--el-color-success); }
.mp-kv > b.is-back { color: var(--el-color-warning-dark-2); }
.mp-kv > b i { font-style: normal; color: var(--el-text-color-secondary); }

/* 退料标志(2026-10-30 第三轮):抬头「退料单号」后面的小徽标 */
.mp-flag {
  margin-left: 6px; padding: 0 6px; border-radius: 4px; font-size: 11px; font-weight: 400;
  background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2);
}

.mp-mat {
  display: flex; align-items: center; gap: 10px;
  margin-top: 10px; padding: 10px; border-radius: 6px; background: var(--el-fill-color-lighter);
}
.mp-mat-main { flex: 1; min-width: 0; }
.mp-mat-name { font-size: 14px; font-weight: 600; }
.mp-mat-meta { margin-top: 2px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mp-mat-stock { flex: none; text-align: right; }
.mp-mat-stock b { display: block; font-size: 20px; color: var(--el-color-primary); }
.mp-mat-stock span { font-size: 11px; color: var(--el-text-color-secondary); }

.mp-batches { margin-top: 10px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; overflow: hidden; }
.mp-batches-head, .mp-batch-row { display: flex; align-items: center; gap: 6px; padding: 6px 8px; font-size: 12px; }
.mp-batches-head { background: var(--el-fill-color-light); color: var(--el-text-color-secondary); }
.mp-batch-row { border-top: 1px solid var(--el-border-color-lighter); font-size: 13px; }
.mp-batch-row.is-checked { background: var(--el-color-primary-light-9); }
.mp-batch-row.is-scanned { box-shadow: inset 3px 0 0 var(--el-color-warning); }
.mp-bh-lot { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; }
.mp-batch-lot { min-width: 0; word-break: break-all; }
.mp-batch-scan {
  flex: none; padding: 0 4px; border-radius: 3px; font-size: 10px;
  background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2);
}
.mp-bh-wh { flex: none; width: 62px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-bh-avail { flex: none; width: 52px; text-align: right; }
.mp-bh-qty { flex: none; width: 62px; text-align: right; font-weight: 600; }

.mp-line {
  display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 4px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter); cursor: pointer;
}
.mp-line:last-child { border-bottom: 0; }
.mp-line.is-cur { background: var(--el-color-primary-light-9); border-radius: 6px; }
.mp-line.is-ret { background: var(--el-color-warning-light-9); border-radius: 6px; }
.mp-line.is-ro { cursor: default; }   /* 只读模式:明细行不可点 */
.mp-line-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--el-border-color); }
.mp-line-dot.on { background: var(--el-color-success); }
.mp-line-main { flex: 1; min-width: 0; }
.mp-line-name { font-size: 14px; }
/* 明细行的字段对(2026-11-04):编码/规格型号/单位各占一行,标签灰、值黑。
   手机屏窄,用 grid 两列(标签 68px 固定 + 值自适应),值过长自动换行不溢出。 */
.mp-line-fields { margin: 4px 0 0; padding: 0; }
.mp-line-fields > div { display: grid; grid-template-columns: 68px 1fr; gap: 6px; line-height: 1.5; }
.mp-line-fields dt { margin: 0; font-size: 11px; color: var(--el-text-color-secondary); }
.mp-line-fields dd { margin: 0; font-size: 12px; color: var(--el-text-color-regular); word-break: break-all; }
.mp-line-qty { flex: none; min-width: 84px; text-align: right; font-size: 14px; font-weight: 600; }
.mp-line-qty.is-ret { color: var(--el-color-warning-dark-2); }
.mp-line-qty.ok { color: var(--el-color-success); }
.mp-line-qty.zero { color: var(--el-text-color-placeholder); }
.mp-sep { margin: 0 1px; color: var(--el-text-color-placeholder); font-weight: 400; }
.mp-colhint { margin-left: auto; }
.mp-line-qty i { font-style: normal; font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }

/* 已完成单的退料引导 */
.mp-retire-cta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mp-retire-cta span { flex: 1 1 200px; min-width: 0; font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.5; }
.mp-retire-cta :deep(.el-button) { flex: 0 0 auto; height: 44px; }

.mp-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mp-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.mp-warn { margin-top: 6px; padding: 6px 8px; font-size: 12px; color: var(--el-color-warning-dark-2); background: var(--el-color-warning-light-9); border-radius: 4px; }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; }
.num { font-variant-numeric: tabular-nums; }

/* 只读提示条(2026-10-30) */
.mp-ro {
  margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5;
  background: var(--el-color-info-light-9); color: var(--el-color-info-dark-2);
}
.mp-err, .mp-ok { margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5; }
.mp-err { background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); }
.mp-ok { background: var(--el-color-success-light-9); color: var(--el-color-success-dark-2); }

.mp-foot {
  display: flex; gap: 10px; margin: 12px 12px 0; padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  margin-top: auto;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mp-foot :deep(.el-button) { flex: 1; height: 46px; margin: 0; }

@media (min-width: 900px) {
  .mp { display: grid; grid-template-columns: minmax(0, 460px) minmax(0, 1fr); gap: 12px; align-items: start; }
  .mp-top, .mp-err, .mp-ok, .mp-foot { grid-column: 1 / -1; }
  .mp-card { margin: 0 0 12px; }

  /* 只读模式(2026-10-30):从开单工作台点进来时**没有扫码区**,
     两栏布局会把左栏整块留空(用户报障「排版有问题」)⇒ 改单栏、收窄居中,
     抬头与明细上下排,和一张单据的阅读顺序一致。 */
  .mp.is-readonly { grid-template-columns: minmax(0, 1fr); max-width: 860px; }
  .mp.is-readonly .mp-top,
  .mp.is-readonly .mp-ro,
  .mp.is-readonly .mp-err,
  .mp.is-readonly .mp-ok { grid-column: 1 / -1; }
}
</style>
