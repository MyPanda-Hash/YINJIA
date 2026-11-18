<!--
  MobileReturnDoc.vue — 手机扫码 · **生产退料单明细**(2026-11-18 第四轮新增)

  【用户口径(原话)】
  「生产退料也要扫码到明细行再扫物料码退料,要和(扫码混料一样)对齐生产领料。」

  ⇒ 本页 = 「生产领料单」{@code MobilePickDoc.vue} / 「混料单明细」{@code MobileMixDoc.vue} 的
    **同一套版面与交互**(顶部返回/单据号/状态/刷新 → 抬头卡 → 扫码解锁卡 → 明细卡 → 底栏提交):
    · 扫物料码 = **解锁对应的明细行**(后端 {@code /returnScan} 校验它在领料单里、回可退量);
    · 数量默认 = 可退(整项退,可改),点「确认」记到**那一行**上;
    · 再扫下一个物料、再确认;底栏「提交退料」把本次所有项一次生成**一张生产退料单**并出纸。

  【与「生产领料」的唯一差别(业务性质决定)】
  领料要**每行都有数量**才能提交(整单领齐);退料是**部分退** —— 没打算退的料不填就行,
  提交闸门 = 本次退料合计 > 0(见 business/mobileReturn.js 的 returnProgress 注释)。

  【为什么"确认"不逐笔落库】
  退料的落库单位是一整张生产退料单(bl_material_ret + wo_pick_return 台账),后端没有"退料草稿行"
  这张表;逐项确认先记在页面上,提交时一次交给 {@code /submitReturn}。这与领料逐行写库是不同层的东西。
-->
<template>
  <div class="mp">
    <div class="mp-top">
      <span class="mp-back" @click="goBack">‹</span>
      <div class="mp-head">
        <span class="mp-title">{{ doc.领料单号 || tt('退料单据') }}</span>
        <span class="mp-sub2">{{ doc.工单号 }}<i v-if="doc.工单行号"> #{{ doc.工单行号 }}</i></span>
      </div>
      <span class="mp-state" :class="{ done: returnable }">{{ returnable ? tt('可退料') : tt('不可退') }}</span>
      <el-button class="mp-refresh" size="small" :loading="loading" @click="refreshDoc">{{ tt('刷新') }}</el-button>
    </div>

    <div v-if="errText" class="mp-err mp-err-top">{{ errText }}</div>
    <div v-if="okText" class="mp-ok mp-err-top">{{ okText }}</div>

    <!-- 不能退的原因(说清"为什么"和"该找谁",别让人猜) -->
    <div v-if="!loading && !returnable" class="mp-ro">{{ notReturnableReason }}</div>

    <!-- 抬头 -->
    <section class="mp-card">
      <div class="mp-kv"><span>{{ tt('工单号') }}</span><b>{{ doc.工单号 || '—' }}<i v-if="doc.工单行号"> #{{ doc.工单行号 }}</i></b></div>
      <div class="mp-kv"><span>{{ tt('产品') }}</span><b>{{ doc.产品名称 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('物料编码') }}</span><b class="mono">{{ doc.产品编号 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('规格型号') }}</span><b>{{ wo.规格型号 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('计量单位') }}</span><b>{{ wo.计量单位 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('生产线') }}</span><b>{{ wo.生产线 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('领料单号') }}</span><b class="mono">{{ doc.领料单号 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('领料类型') }}</span><b>{{ tt(doc.领料类型 || '组装') }}</b></div>
      <div class="mp-kv">
        <span>{{ tt('退料单号') }}</span>
        <b class="mono" :class="{ 'is-back': hasReturn }">
          {{ hasReturn ? doc.退料单号 : '—' }}
          <span v-if="hasReturn" class="mp-flag">{{ tt('含退料') }}</span>
        </b>
        <!-- 补打印:退过料就能补打那张生产退料单(与生产领料单的补打印同一动作) -->
        <el-button
          v-if="hasReturn"
          text
          size="small"
          :loading="printing"
          class="mp-back-print"
          @click="reprintBackSlip"
        >{{ tt('补打印') }}</el-button>
      </div>
      <div class="mp-kv">
        <span>{{ tt('本次退料') }}</span>
        <b class="num" :class="{ ok: progress.ok }">{{ progress.done }} {{ tt('项') }} / {{ fmtQty(progress.totalQty) }}</b>
      </div>
    </section>

    <!-- 扫码区:只在可退时出现 -->
    <section v-if="returnable" class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('扫物料码 · 退料') }}</span>
        <span v-if="cur" class="mp-sec-ok">{{ cur.编码 }}</span>
      </div>

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

      <!-- 解锁区:扫到本单里的料才出现;「确认」或「取消」之后重新锁定 -->
      <template v-if="cur">
        <div class="mp-mat">
          <div class="mp-mat-main">
            <div class="mp-mat-name">{{ cur.名称 || cur.编码 }}</div>
            <div class="mp-mat-meta">
              {{ cur.编码 }} · {{ cur.规格 || '—' }} · {{ cur.单位 || '—' }}
              · {{ tt('已领') }} {{ fmtQty(cur.已领数量) }} / {{ tt('已退') }} {{ fmtQty(cur.已退数量) }}
            </div>
          </div>
          <div class="mp-mat-stock">
            <b class="num">{{ fmtQty(cur.可退数量) }}</b>
            <span>{{ tt('本次可退') }}</span>
          </div>
        </div>
        <div class="mp-row mp-qty">
          <span class="mp-qty-label">{{ tt('退料数量') }}</span>
          <el-input-number
            v-model="curQty"
            :min="0"
            :max="Number(cur.可退数量) || 0"
            :precision="4"
            :step="1"
            size="large"
            controls-position="right"
          />
          <span class="mp-qty-unit">{{ cur.单位 || '' }}</span>
          <el-button type="warning" size="large" :disabled="!(curQty > 0)" @click="confirmLine">
            {{ tt('确认') }}
          </el-button>
          <el-button size="large" @click="cancelLock">{{ tt('取消') }}</el-button>
        </div>
      </template>

      <div v-if="!cur" class="mp-hint">
        {{ tt('扫物料码解锁:只有这张领料单里的物料才能退;数量默认填可退数量,可改') }}
      </div>
      <div v-else class="mp-hint">
        {{ tt('确认后重新锁回扫码状态,再扫下一个物料;没打算退的料不用扫') }}
      </div>
    </section>

    <!-- 明细 -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('领料明细') }}</span>
        <span class="mp-sec-num">{{ rows.length }}</span>
      </div>
      <div v-if="!rows.length" class="mp-empty">{{ tt('没有明细') }}</div>
      <div
        v-for="r in rows"
        :key="r.行号 + r.编码"
        class="mp-line"
        :class="{ 'is-cur': cur && cur.编码 === r.编码, 'is-ret': r.本次退 > 0 }"
        @click="returnable && pickRow(r)"
      >
        <span class="mp-line-dot" :class="{ on: r.本次退 > 0 }"></span>
        <div class="mp-line-main">
          <div class="mp-line-name">{{ r.名称 || r.编码 }}</div>
          <dl class="mp-line-fields">
            <div><dt>{{ tt('物料编码') }}</dt><dd>{{ r.编码 || '—' }}</dd></div>
            <div><dt>{{ tt('规格型号') }}</dt><dd>{{ r.规格 || '—' }}</dd></div>
            <div><dt>{{ tt('计量单位') }}</dt><dd>{{ r.单位 || '—' }}</dd></div>
            <template v-if="r.批号"><div><dt>{{ tt('批号') }}</dt><dd>{{ r.批号 }}</dd></div></template>
          </dl>
        </div>
        <!-- 已领 / 已退 / 本次退:三行都带标签(与生产领料单的 需求 / 已领 同一写法) -->
        <div class="mp-line-qty">
          <div class="mp-q-row">
            <span class="mp-q-lab">{{ tt('已领') }}</span>
            <b class="num">{{ r.已领 > 0 ? fmtQty(r.已领) : '—' }}</b>
            <i>{{ r.单位 }}</i>
          </div>
          <div class="mp-q-row" :class="{ zero: !(r.已退 > 0) }">
            <span class="mp-q-lab">{{ tt('已退') }}</span>
            <b class="num">{{ fmtQty(r.已退) }}</b>
            <i>{{ r.单位 }}</i>
          </div>
          <div class="mp-q-row" :class="{ ok: r.本次退 > 0, zero: !(r.本次退 > 0) }">
            <span class="mp-q-lab">{{ tt('本次退') }}</span>
            <b class="num">{{ r.本次退 > 0 ? '-' + fmtQty(r.本次退) : '—' }}</b>
            <i>{{ r.单位 }}</i>
          </div>
        </div>
      </div>
    </section>

    <!-- 底栏:清空本次 + 提交退料(合计 > 0 才可点) -->
    <div class="mp-foot">
      <el-button size="large" :disabled="!progress.ok" @click="clearAll">{{ tt('清空本次') }}</el-button>
      <el-button
        type="warning"
        size="large"
        class="mp-foot-btn"
        :loading="submitting"
        :disabled="!progress.ok"
        @click="submit"
      >
        {{ tt('提交退料') }}{{ progress.totalQty > 0 ? ' (' + fmtQty(progress.totalQty) + ')' : '' }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
/**
 * 生产退料单明细页(2026-11-18 第四轮)。
 *
 * 版面、类名、交互刻意与 {@code MobilePickDoc.vue} / {@code MobileMixDoc.vue} **逐段对齐**
 * (用户口径「要和(扫码混料一样)对齐生产领料」)—— 改这一页的排版时请顺手对齐那两页。
 *
 * 纯逻辑(行模型 / 确认覆盖 / 提交闸门)在 {@code business/mobileReturn.js}。
 * 接口全部复用既有退料链路(不新增后端端点):
 *   GET  /px/mobilePick/doc?id=           抬头 + 领料明细(带 已退数量)
 *   GET  /px/mobilePick/locate?woNo=LL-…  按领料单号反查台账 id(从生产领料跳过来时用)
 *   POST /px/mobilePick/returnScan        扫物料码 → 本次可退量(只校验、不落库)
 *   POST /px/mobilePick/submitReturn      提交 → 生成**生产退料单(草稿)**,等仓管审核才入账
 */
import { computed, nextTick, onActivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { errMsg } from '@/business/engine'
import { parseBarcode } from '@/business/scanPick'
import { fmtQty } from '@/business/mobilePick'
import { toReturnRows, applyReturn, clearReturnQty, returnProgress } from '@/business/mobileReturn'
import { printSlip } from '@/business/slipPrintFlow'
import { scanOnce, hasNativeScan } from '@/business/nativeScan'
import { focusScanNow } from '@/business/scanFocus'

const route = useRoute()
const router = useRouter()

const nativeScan = hasNativeScan()

/**
 * 单据标识 —— 必须**跟着路由走**(与 MobilePickDoc / MobileMixDoc 同一个坑)。
 *
 * <p>🔴 2026-11-18 用户报障:「生产退料扫组装的二维码和混料的二维码都是跳到混料的明细」。
 * 根因就在这一行:原来写成 `const docId = ref(Number(route.query.id) || 0)`,只在**第一次挂载**
 * 取一次值;而 vue-router 对同一路由页**复用组件实例** —— 从列表/扫码再进另一张单时只改
 * `query.id`,组件不重建、onMounted 不重跑、`watch(docId)` 也不会触发
 * ⇒ 页面永远停在**第一次打开的那张单**(先开过混料,之后扫组装看到的还是混料)。
 * 修法与那两页一致:用 computed 跟随 query,watch 它重新取数。
 *
 * <p>两种入口:列表页点进来带 {@code ?id=}(台账主键);从「生产领料」的已完成单点
 * 「去生产退料」带 {@code ?no=领料单号} —— 后者先按单号反查 id(结果放 idFromNo,
 * 以 query.id 为准,免得 replace 之后又触发一次重载)。
 */
const idFromNo = ref(0)
const docId = computed(() => Number(route.query.id) || idFromNo.value || 0)
const docNoParam = computed(() => String(route.query.no || '').trim())

const loading = ref(false)
const matInput = ref(null)
const matText = ref('')
const matLoading = ref(false)
const submitting = ref(false)
const printing = ref(false)
const errText = ref('')
const okText = ref('')
/** 跨「提交 → 刷新」保留的提示(打印结果等) */
let carriedMsg = ''

const doc = ref({})
const wo = ref({})
const rows = ref([])
/** 解锁中的物料 */
const cur = ref(null)
const curQty = ref(0)

const progress = computed(() => returnProgress(rows.value))
const hasReturn = computed(() => !!(doc.value.退料单号 && String(doc.value.退料单号).trim()))

/**
 * 能不能退:领料单**已完成** + 材料出库单**已被仓管审核**(库存才真扣了) + 还有可退量。
 *
 * <p>与后端 {@code requireReturnable} 同一判据,这里只是别让人点了才被拒;
 * 真正的闸门在服务端(拿令牌直接调接口照样被拦)。
 */
const returnable = computed(() => String(doc.value.状态 || '') === '已完成'
  && doc.value.出库已审批 === true
  && !!(doc.value.领料单号 && String(doc.value.领料单号).trim())
  && rows.value.some((r) => r.可退 > 0))

const notReturnableReason = computed(() => {
  if (!doc.value.领料单号) return tt('没有指定单据:请从「生产退料」列表点进来')
  if (String(doc.value.状态 || '') !== '已完成') {
    return tt('这张领料单还没完成:请先把料领完并提交,提交之后才能对已领的料退料')
  }
  if (doc.value.出库已审批 !== true) {
    return tt('材料出库单还没审批,暂时不能退料:请先让仓管在「材料出库单」里审核通过(审核才扣库存)')
  }
  return tt('这张单的料已经全部退完了,没有可退的物料')
})

function clearMsg() { errText.value = ''; okText.value = '' }
function errMsgOf(e) { return errMsg(e) || e?.response?.data?.message || e?.message || '' }

function goBack() { router.push('/panelx/list/MOBILE_RETURN') }

onMounted(() => {
  load()
  nextTick(() => matInput.value?.focus?.())
})

/** keep-alive 回来时重拉(别人可能又退过料/仓管刚审批) */
let activatedOnce = false
onActivated(() => {
  if (!activatedOnce) { activatedOnce = true; return }
  load()
})

/**
 * 切单:vue-router 复用实例只改 query.id ⇒ 必须 watch **computed 的 docId**(不是 ref),
 * 否则从列表再扫/再点另一张单时页面不换(2026-11-18 报障的直接原因)。
 */
watch(docId, () => { softReset(); load() })

function softReset() {
  matText.value = ''
  cur.value = null
  curQty.value = 0
  clearMsg()
}

async function refreshDoc() {
  loading.value = true
  try {
    await load()
    if (!errText.value) {
      okText.value = tt('已刷新')
      setTimeout(() => { if (okText.value === tt('已刷新')) okText.value = '' }, 1500)
    }
  } finally {
    loading.value = false
  }
}

/** 按领料单号反查台账 id(从「生产领料」的已完成单跳过来时只有单号) */
async function resolveIdByNo() {
  const no = docNoParam.value
  if (!no) return
  try {
    const res = await request.get('/px/mobilePick/locate', { params: { woNo: no } })
    const d = res.data?.data || res.data || {}
    if (d.found && Number(d.id) > 0) {
      idFromNo.value = Number(d.id)
      // 地址栏补上 id,刷新页面就不用再反查(换成 ?id= 后 docId 的取值不变 ⇒ 不会二次重载)
      router.replace({ path: '/panelx/list/MOBILE_RETURN/doc', query: { id: String(idFromNo.value) } })
      return
    }
    errText.value = tt('没有找到这张领料单') + ` (${no})`
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询失败')
  }
}

/**
 * 取数:抬头 + 领料明细(每行带 已退数量,可退 = 已领 − 已退)。
 *
 * <p>⚠ 提交后要**重拉**:已退数量、退料单号都由服务端按台账现算,不重拉界面就还停在旧数上。
 */
async function load() {
  if (!docId.value && docNoParam.value) { await resolveIdByNo(); if (!docId.value) return }
  if (!docId.value) {
    errText.value = tt('没有指定单据:请从「生产退料」列表点进来')
    return
  }
  clearMsg()
  try {
    const res = await request.get('/px/mobilePick/doc', { params: { id: docId.value } })
    const d = res.data?.data || res.data || {}
    doc.value = d
    wo.value = d.工单 || {}
    // 本次退料在重新取数后要保留(提交前反复刷新的场景),按物料编码回填
    const prev = new Map(rows.value.map((r) => [r.编码, r.本次退]))
    rows.value = toReturnRows(d.领料明细).map((r) => ({ ...r, 本次退: prev.get(r.编码) || 0 }))
    if (carriedMsg) { okText.value = carriedMsg; carriedMsg = '' }
  } catch (e) {
    errText.value = errMsgOf(e) || tt('加载单据失败')
  }
}

/**
 * 扫物料码 → **解锁**该项(与生产领料的 scanMaterial、混料的 scanMaterial 同位)。
 *
 * <p>后端 `/returnScan` 校验:物料必须在这张领料单里(扫错料直接拒绝)、并回本次可退量;
 * 解锁后数量默认填可退(现场多半整项退),可改。
 */
async function scanMaterial() {
  const raw = String(matText.value || '').trim()
  clearMsg()
  cur.value = null
  if (!raw) { errText.value = tt('请先扫描或输入物料编码'); return }
  if (!returnable.value) return
  const p = parseBarcode(raw)
  if (!p.ok) { errText.value = tt('这个码里没有物料编码'); return }
  matLoading.value = true
  try {
    const res = await request.post('/px/mobilePick/returnScan', { id: docId.value, code: p.code })
    const d = res.data?.data || res.data || {}
    cur.value = {
      编码: String(d.编码 || p.code),
      名称: String(d.名称 || ''),
      规格: String(d.规格 || ''),
      单位: String(d.单位 || ''),
      已领数量: Number(d.已领数量) || 0,
      已退数量: Number(d.已退数量) || 0,
      可退数量: Number(d.可退数量) || 0,
    }
    // 默认填可退(整项退),现场可改小
    curQty.value = cur.value.可退数量
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询可退数量失败')
  } finally {
    matLoading.value = false
    focusScanNow(() => matInput.value, { delay: 120 })
  }
}

/** 相机扫码:落进输入框再走同一条解锁路径 */
async function scanInto() {
  const r = await scanOnce({ formats: ['CODE_128', 'CODE_39', 'EAN_13', 'QR_CODE'] })
  if (!r.ok) {
    if (r.reason !== 'cancelled') errText.value = tt('没有识别到二维码,请重试;也可以直接用扫码枪扫进输入框')
    return
  }
  matText.value = r.text
  await scanMaterial()
}

/** 确认:把数量记到该明细行(覆盖),然后重新锁回扫码状态 */
function confirmLine() {
  if (!cur.value) return
  const r = applyReturn(rows.value, { code: cur.value.编码, qty: curQty.value })
  if (!r.ok) {
    errText.value = r.reason === 'over'
      ? `${tt('超过可退数量')}:${tt('这次可退')} ${fmtQty(cur.value.可退数量)}`
      : tt('退料数量必须大于 0')
    return
  }
  okText.value = `${tt('已记下')} ${cur.value.编码} · ${tt('退料')} ${fmtQty(curQty.value)} ${cur.value.单位 || ''}`
  matText.value = ''
  cur.value = null
  curQty.value = 0
  focusScanNow(() => matInput.value, { delay: 80 })
}

/** 取消本次解锁并重新锁定 */
function cancelLock() {
  matText.value = ''
  cur.value = null
  curQty.value = 0
  clearMsg()
  nextTick(() => matInput.value?.focus?.())
}

/** 点明细行:只提示"请扫该物料的码",不解锁(与生产领料/混料同一条口径) */
function pickRow(r) {
  if (!returnable.value) return
  okText.value = `${tt('请扫物料码')}: ${r.编码}${r.名称 ? ' · ' + r.名称 : ''}`
}

/** 清空本次(已领/已退/可退不动) */
function clearAll() {
  clearReturnQty(rows.value)
  clearMsg()
  okText.value = tt('已清空本次退料')
}

/**
 * 提交:本次填了数量的所有行 → **一张生产退料单**。
 *
 * <p>🔴 2026-11-18 用户口径「生产退料单怎么自动审批了,所有生成的单都要是草稿状态」——
 * 后端 submitReturn 只建**草稿**,库存要等仓管在「生产退料单」面板点「审核」才加回来;
 * 所以确认框必须把这件事说清楚(否则现场会以为"点了提交库存就该变")。
 * 提交后照旧自动补打印那张单。
 */
async function submit() {
  if (!progress.value.ok || !docId.value) return
  const p0 = progress.value
  try {
    await ElMessageBox.confirm(
      `${tt('将退')} ${p0.done} ${tt('项物料,合计')} ${fmtQty(p0.totalQty)}。`
      + tt('提交后生成生产退料单(草稿),要等仓管审核后库存才会增加。确定提交?'),
      tt('退料确认'),
      { confirmButtonText: tt('确定退料'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return }
  submitting.value = true
  clearMsg()
  try {
    const res = await request.post('/px/mobilePick/submitReturn', { id: docId.value, items: p0.items })
    const d = res.data?.data || res.data || {}
    const no = String(d.退料单号 || '').trim()
    const successMsg = tt('退料成功') + (no ? '：' + no : '')
    ElMessage.success(successMsg)
    okText.value = successMsg
    clearReturnQty(rows.value)
    // 提交即出纸(纸面 = 生产退料单,与「生产领料」的补打印同一版式)
    if (no) await printBackSlip(no)
    // 重拉是把已退数量/退料单号换成服务端的最新值 —— 但 load() 会清提示条,
    // 所以把"成功 + 打印结果"接住再写回去(打印失败的红字同样保留)。
    carriedMsg = okText.value || successMsg
    const printErr = errText.value
    await load()
    if (printErr) errText.value = printErr
  } catch (e) {
    errText.value = errMsgOf(e) || tt('退料失败')
  } finally {
    submitting.value = false
    focusScanNow(() => matInput.value, { delay: 180 })
  }
}

/**
 * 打一张**生产退料单**纸面报表(与「生产领料」的补打印同一条链路)。
 *
 * <p>打印是次要动作:失败只提示,绝不影响已经入账的退料。
 */
async function printBackSlip(no) {
  const docNo = String(no || '').trim()
  if (!docNo) return
  printing.value = true
  try {
    const r = await printSlip({ kind: 'MAT_RET', docNo, source: 'mobileReturn.doc' })
    if (r.ok && r.mode === 'station') okText.value = `${tt('已发送到打印电脑')}：${docNo}`
    else if (r.ok) okText.value = `${tt('已调用本机打印')}：${docNo}`
    else errText.value = `${tt('打印失败')}：${docNo}${r.message ? ' · ' + r.message : ''}`
  } finally {
    printing.value = false
  }
}

/** 补打印:抬头「退料单号」旁那颗按钮(多次退料时取最后一号,与生产领料同一口径) */
async function reprintBackSlip() {
  const raw = String(doc.value?.退料单号 || '')
  const no = raw.split(',').map((s) => s.trim()).filter(Boolean).pop() || ''
  if (!no) { errText.value = tt('这张单还没有退料单号'); return }
  clearMsg()
  await printBackSlip(no)
}
</script>

<style scoped>
/* 版面与「生产领料单」/「混料单明细」**逐条对齐**:同一组卡片、同一套行高与命中区。 */
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
.mp-refresh { flex: none; margin-left: 6px; }

.mp-card {
  margin: 10px 12px 0; padding: 12px;
  background: var(--el-bg-color); border-radius: 8px; border: 1px solid var(--el-border-color-lighter);
}
.mp-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; flex-wrap: wrap; }
.mp-sec-ok { font-size: 11px; font-weight: 400; color: var(--el-color-success); }
.mp-sec-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; font-weight: 400;
}

.mp-row { display: flex; align-items: center; gap: 8px; }
.mp-row :deep(.el-input), .mp-row :deep(.el-input-number) { flex: 1; min-width: 0; }
.mp-row :deep(.el-button) { height: 44px; min-width: 64px; margin-left: 0; }
.mp-row :deep(.el-input__wrapper) { min-height: 44px; }
.mp-row :deep(.el-input__inner) { font-size: 16px; }   /* 16px 以下 iOS 会自动放大 */

.mp-qty { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.mp-qty-label { flex: none; font-size: 13px; color: var(--el-text-color-regular); }
.mp-qty :deep(.el-input-number) { flex: none; width: 140px; }
.mp-qty-unit { flex: none; min-width: 24px; font-size: 13px; color: var(--el-text-color-secondary); }
.mp-qty :deep(.el-button) { flex: 1 1 88px; }

.mp-kv { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; font-size: 13px; }
.mp-kv > span { width: 76px; flex: none; color: var(--el-text-color-secondary); }
.mp-kv > b { font-weight: 500; min-width: 0; word-break: break-all; }
.mp-kv > b.ok { color: var(--el-color-success); }
.mp-kv > b.is-back { color: var(--el-color-warning-dark-2); }
.mp-kv > b i { font-style: normal; color: var(--el-text-color-secondary); }
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
.mp-mat-stock b { display: block; font-size: 20px; color: var(--el-color-warning); }
.mp-mat-stock span { font-size: 11px; color: var(--el-text-color-secondary); }

.mp-line {
  display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 4px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter); cursor: pointer;
}
.mp-line:last-child { border-bottom: 0; }
.mp-line.is-cur { background: var(--el-color-primary-light-9); border-radius: 6px; }
.mp-line.is-ret { background: var(--el-color-warning-light-9); border-radius: 6px; }
.mp-line-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--el-border-color); }
.mp-line-dot.on { background: var(--el-color-warning); }
.mp-line-main { flex: 1; min-width: 0; }
.mp-line-name { font-size: 14px; }
.mp-line-fields { margin: 4px 0 0; padding: 0; }
.mp-line-fields > div { display: grid; grid-template-columns: 68px 1fr; gap: 6px; line-height: 1.5; }
.mp-line-fields dt { margin: 0; font-size: 11px; color: var(--el-text-color-secondary); }
.mp-line-fields dd { margin: 0; font-size: 12px; color: var(--el-text-color-regular); word-break: break-all; }
.mp-line-qty { flex: none; min-width: 108px; display: grid; gap: 1px; font-size: 14px; font-weight: 600; }
.mp-q-row { display: flex; align-items: baseline; justify-content: flex-end; gap: 4px; line-height: 1.35; }
.mp-q-row > b { font-weight: 600; font-variant-numeric: tabular-nums; }
.mp-q-row.ok > b { color: var(--el-color-warning-dark-2); }
.mp-q-row.zero > b { color: var(--el-text-color-placeholder); }
.mp-q-lab { font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }
.mp-line-qty i { font-style: normal; font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }

.mp-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.6; }
.mp-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; }
.num { font-variant-numeric: tabular-nums; }

.mp-ro {
  margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5;
  background: var(--el-color-info-light-9); color: var(--el-color-info-dark-2);
}
.mp-err, .mp-ok {
  margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5;
}
.mp-err { background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); }
.mp-ok { background: var(--el-color-success-light-9); color: var(--el-color-success-dark-2); }

.mp-foot {
  display: flex; gap: 10px; align-items: stretch;
  margin: 12px 12px 0; padding: 10px 12px;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mp-foot :deep(.el-button) { height: 46px; margin: 0; }
.mp-foot-btn { flex: 1; }

@media (max-width: 480px) {
  .mp { padding: 0 0 22px; }
  .mp-qty :deep(.el-input-number) { width: 118px; }
  .mp-row :deep(.el-button) { min-width: 56px; padding: 8px 10px; }
}
</style>
