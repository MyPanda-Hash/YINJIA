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
  <div class="mp">
    <div class="mp-top">
      <span class="mp-back" @click="goBack">‹</span>
      <div class="mp-head">
        <span class="mp-title">{{ doc.领料单号 || tt('领料单据') }}</span>
        <span class="mp-sub2">{{ doc.工单号 }}<i v-if="doc.工单行号"> #{{ doc.工单行号 }}</i></span>
      </div>
      <span class="mp-state" :class="{ done: isDone }">{{ doc.状态 }}</span>
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
    <section v-if="!readOnly" class="mp-card" :class="{ dim: isDone && !returnMode }">
      <div class="mp-sec">
        <span>{{ isDone ? (returnMode ? tt('扫物料码 · 退料') : tt('扫物料码 · 领料')) : tt('扫物料码') }}</span>
        <span v-if="cur" class="mp-sec-ok">{{ cur.编码 }}</span>
        <span v-if="isDone" class="mp-sec-note">{{ returnMode ? tt('退料模式') : tt('这张单已完成,可点「开始退料」') }}</span>
      </div>

      <!-- 已完成 + 非退料模式:引导到(退料 → 生成其他入库单) -->
      <div v-if="isDone && !returnMode" class="mp-retire-cta">
        <span>{{ tt('这张领料单已完成并过账。如需退料,点下面的按钮开始扫码退料,提交后生成其他入库单。') }}</span>
        <el-button type="primary" size="large" @click="startReturn">{{ tt('开始退料') }}</el-button>
      </div>

      <template v-else>
        <!-- 扫物料码解锁(2026-10-30 用户口径:「只有扫了对应物料的编码才能解锁填入,填入后要重新锁定」)
             ⇒ 扫码框常驻;数量输入框**只有扫到物料后才出现**,写完/取消后重新锁定 -->
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
      </template>

      <div v-if="!cur && !(isDone && !returnMode)" class="mp-hint">
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
      </div>
      <div v-if="!rows.length" class="mp-empty">{{ tt('没有明细') }}</div>
      <div
        v-for="r in rows"
        :key="r.行号"
        class="mp-line"
        :class="{ 'is-cur': cur && cur.编码 === r.编码, 'is-ret': returnMode && qtyOf(r.编码) > 0, 'is-ro': rowLocked }"
        @click="!rowLocked && pickRow(r)"
      >
        <span class="mp-line-dot" :class="{ on: r.数量 > 0 }"></span>
        <div class="mp-line-main">
          <div class="mp-line-name">{{ r.名称 || r.编码 }}</div>
          <div class="mp-line-meta">
            {{ r.编码 }} · {{ r.规格 || '—' }}
            <template v-if="r.批号"> · {{ r.批号 }}</template>
            <template v-if="r.BOM用量 > 0"> · {{ tt('BOM') }} {{ fmtQty(r.BOM用量) }}</template>
            <template v-if="returnMode"> · {{ tt('可退') }} {{ fmtQty(canReturnOf(r)) }}</template>
          </div>
        </div>
        <span v-if="returnMode" class="mp-line-qty num is-ret">
          {{ qtyOf(r.编码) > 0 ? '-' + fmtQty(qtyOf(r.编码)) : '—' }} <i>{{ r.单位 }}</i>
        </span>
        <span v-else class="mp-line-qty num">{{ fmtQty(r.数量) }} <i>{{ r.单位 }}</i></span>
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
        <el-button v-else type="primary" size="large" @click="startReturn">{{ tt('开始退料') }}</el-button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, nextTick, ref } from 'vue'
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

const docId = Number(route.query.id) || 0

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
const cur = ref(null)
const curQty = ref(0)
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
  window.__yjScanResult = (code, ok) => { if (ok && code) applyScan(code) }
  loadDoc()
  nextTick(() => matInput.value?.focus?.())
})

onBeforeUnmount(() => {
  try { delete window.__yjScanResult } catch { /* ignore */ }
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

async function loadDoc() {
  if (!docId) { errText.value = tt('没有指定单据:请从生产领料列表点进来'); return }
  clearMsg()
  try {
    const res = await request.get('/px/mobilePick/doc', { params: { id: docId } })
    const d = res.data?.data || res.data || {}
    doc.value = d
    wo.value = d.工单 || {}
    pickRows.value = (d.领料明细 || []).map(normalize)
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

/** 点明细行 = 直接把那一行加载到扫码区 */
function pickRow(r) {
  matText.value = r.编码
  scanMaterial(r.批号)
}

/** 扫物料码 → 后端校验并回可用量/可退量 */
async function scanMaterial(scanBatch) {
  const code = String(matText.value || '').trim()
  clearMsg()
  cur.value = null
  batchRows.value = []
  if (!code) { errText.value = tt('请先扫描或输入物料编码'); return }
  matLoading.value = true
  try {
    if (returnMode.value) {
      // ── 退料:问后端"这个料还能退多少"
      const res = await request.post('/px/mobilePick/returnScan', { id: docId, code })
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
      id: docId, code, batch: String(scanBatch || '').trim(), side: 'pick',
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
      id: docId, side: 'pick', code: cur.value.编码, qty: round4(curQty.value), batches,
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
function startReturn() {  if (!isDone.value) { errText.value = tt('这张单还没提交完成,不能退料'); return }
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
    const res = await request.post('/px/mobilePick/submitReturn', { id: docId, items })
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
    const res = await request.post('/px/mobilePick/reprint', { id: docId })
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
    const res = await request.post('/px/mobilePick/submit', { id: docId })
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
.mp-line-meta { margin-top: 2px; font-size: 11px; color: var(--el-text-color-secondary); word-break: break-all; }
.mp-line-qty { flex: none; min-width: 84px; text-align: right; font-size: 14px; font-weight: 600; }
.mp-line-qty.is-ret { color: var(--el-color-warning-dark-2); }
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
}
</style>
