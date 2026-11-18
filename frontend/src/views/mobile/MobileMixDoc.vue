<!--
  MobileMixDoc.vue — 手机扫码 · **混料单明细**(2026-11-18 第四轮新增)

  【用户口径(原话)】
  「扫码混料,应该和生产领料一样也是跳转到单据的明细里面再开始扫物料码,解锁对应的物料码,
   然后根据连接电子秤的取数,点击确认。再扫其他的物料解锁,根据电子秤再确认。
   全部物料确认完毕后,才可以提交。设计要和生产领料一致。不要独立的去设计。
   前端和功能与生产领料只有一点小区别。」

  ⇒ 本页 = 「生产领料单」{@code MobilePickDoc.vue} 的**同一套版面与交互**:
    · 顶部:‹ 返回 + 单据标识 + 状态 + 刷新;
    · 抬头卡:工单号/产品/物料编码/规格型号/计量单位/生产线/单号/进度;
    · 扫码卡:扫物料码 → **解锁**该项(只有扫到本单清单里的料才放数量框)→
      「确认」写入 → 重新锁回扫码状态 → 再扫下一个;
    · 明细卡:每行 应投 / 实投(带标签、各占一行);
    · 底栏:全部确认完毕才点得亮「提交并打印」。

  【与生产领料的三点小区别(其余一模一样)】
  ① **数量来自电子秤**:解锁时默认填「台车电子秤」的当前读数(手输兜底),还多一颗「取秤」重新抓读数;
  ② 明细右侧是 **应投 / 实投**(领料是 需求 / 已领),因为混料是"该投多少 vs 秤上实际多少";
  ③ 底栏是「提交并打印」(用户口径「整单保存。保存后自动打印」),领料是「提交转材料出库单」。

  【两种入口,同页两种模式】
  · 未完成(`?wo=工单号&line=行号`):取 `/px/mix/task` → 可扫料/确认/撤回/提交;
  · 已完成(`?docNo=PL…`):取 `/px/mix/doc` → **只读** + 「补打印」(用户口径「保留单据,
    重新扫码后进入可以补打印」),不给任何扫码与提交控件。
-->
<template>
  <div class="mp">
    <div class="mp-top">
      <span class="mp-back" @click="goBack">‹</span>
      <div class="mp-head">
        <!-- 标题:已保存的单就是那张混料单号;未完成时还没有单号(提交才生成)⇒ 标题只写「混料单」,
             把工单号 + 行号放副标题,与生产领料单的抬头层级一致 -->
        <span class="mp-title">{{ readOnly ? (head.单号 || tt('混料单')) : tt('混料单') }}</span>
        <span class="mp-sub2">{{ head.工单号 }}<i v-if="head.工单行号"> #{{ head.工单行号 }}</i></span>
      </div>
      <span class="mp-state" :class="{ done: readOnly }">{{ readOnly ? tt('已完成') : tt('未完成') }}</span>
      <!-- 刷新:秤/别人改的状态/打印次数都靠它拉最新(与生产领料单同一个理由) -->
      <el-button class="mp-refresh" size="small" :loading="loading" @click="refreshDoc">
        {{ tt('刷新') }}
      </el-button>
    </div>

    <div v-if="errText" class="mp-err mp-err-top">{{ errText }}</div>
    <div v-if="okText" class="mp-ok mp-err-top">{{ okText }}</div>

    <!-- 只读提示:已保存的混料单只做核对与补打印 -->
    <div v-if="readOnly" class="mp-ro">
      {{ tt('已提交的混料单只能查看与补打印;要再配一锅请回「扫码混料」扫工单码重新开一张') }}
    </div>

    <!-- 抬头 -->
    <section class="mp-card">
      <div class="mp-kv"><span>{{ tt('工单号') }}</span><b>{{ head.工单号 || '—' }}<i v-if="head.工单行号"> #{{ head.工单行号 }}</i></b></div>
      <div class="mp-kv"><span>{{ tt('产品') }}</span><b>{{ head.产品名称 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('物料编码') }}</span><b class="mono">{{ head.产品编码 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('规格型号') }}</span><b>{{ head.规格型号 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('计量单位') }}</span><b>{{ head.计量单位 || '—' }}</b></div>
      <div class="mp-kv"><span>{{ tt('生产线') }}</span><b>{{ head.生产线 || '—' }}</b></div>
      <div v-if="!readOnly" class="mp-kv"><span>{{ tt('排产数量') }}</span><b class="num">{{ fmtQty(head.排产数量) }}</b></div>
      <!-- 未完成时还没有本锅单号(提交才生成),这里显示的是**这张工单行上一锅**已保存的号 -->
      <div class="mp-kv">
        <span>{{ readOnly ? tt('混料单号') : tt('上次混料单') }}</span>
        <b class="mono">{{ head.单号 || (readOnly ? '—' : tt('未生成')) }}</b>
      </div>
      <div class="mp-kv">
        <span>{{ tt('混料进度') }}</span>
        <b class="num" :class="{ ok: progress.ok }">{{ progress.done }} / {{ progress.total }}</b>
      </div>
    </section>

    <!-- 扫码区:只在未完成(可作业)时出现;已保存的单整块不渲染 -->
    <section v-if="!readOnly" class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('扫物料码 · 确认投料') }}</span>
        <span v-if="cur" class="mp-sec-ok">{{ cur.编码 }}</span>
      </div>

      <!-- 电子秤(与生产领料的唯一硬件差别):读数稳定才认,取不到就手输 -->
      <div class="mp-scale" :class="{ live: scaleOk }">
        <div class="mp-scale-main">
          <span class="mp-scale-label">{{ tt('台车电子秤') }}</span>
          <span class="mp-scale-num">{{ scaleText }}</span>
          <span class="mp-scale-hint">{{ scaleHint }}</span>
        </div>
        <el-button size="small" :loading="scaleLoading" @click="takeScale">{{ tt('取秤') }}</el-button>
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

      <!-- 解锁区:扫到本单清单里的料才出现;「确认」写入或「取消」之后重新锁定 -->
      <template v-if="cur">
        <div class="mp-mat">
          <div class="mp-mat-main">
            <div class="mp-mat-name">{{ cur.名称 || cur.编码 }}</div>
            <div class="mp-mat-meta">
              {{ cur.编码 }} · {{ cur.规格 || '—' }} · {{ cur.单位 || '—' }}
              · {{ tt('应投') }} {{ fmtQty(cur.应投) }} · {{ tt('已投') }} {{ fmtQty(cur.实投) }}
            </div>
          </div>
          <div class="mp-mat-stock">
            <b class="num">{{ fmtQty(cur.待投) }}</b>
            <span>{{ tt('待投') }}</span>
          </div>
        </div>
        <div class="mp-row mp-qty">
          <span class="mp-qty-label">{{ tt('实投重量') }}</span>
          <el-input-number
            v-model="curQty"
            :min="0"
            :precision="4"
            :step="0.1"
            size="large"
            controls-position="right"
          />
          <span class="mp-qty-unit">{{ cur.单位 || '' }}</span>
          <el-button type="primary" size="large" :loading="saving" :disabled="!(curQty > 0)" @click="saveQty">
            {{ tt('确认') }}
          </el-button>
          <el-button size="large" @click="cancelLock">{{ tt('取消') }}</el-button>
        </div>
      </template>

      <div v-if="!cur" class="mp-hint">
        {{ tt('扫物料码解锁:只有本单混料物料清单里的料才能确认;数量默认取电子秤读数,可手改') }}
      </div>
      <div v-else class="mp-hint">
        {{ tt('确认后重新锁回扫码状态,再扫下一个物料;全部确认完毕才可提交') }}
      </div>
    </section>

    <!-- 明细 -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('混料明细') }}</span>
        <span class="mp-sec-num">{{ rows.length }}</span>
      </div>
      <div v-if="!rows.length" class="mp-empty">
        {{ readOnly
          ? tt('没有明细')
          : tt('该产品在「混料物料清单」里还没有维护用料,请先在 数据建模 → 物料及价格 → 混料物料清单 维护,或归档烧结工艺清单/X烧结工艺清单') }}
      </div>
      <div
        v-for="r in rows"
        :key="r.行号 + r.编码"
        class="mp-line"
        :class="{ 'is-cur': cur && cur.编码 === r.编码, 'is-ro': readOnly }"
        @click="!readOnly && pickRow(r)"
      >
        <span class="mp-line-dot" :class="{ on: r.实投 > 0 }"></span>
        <div class="mp-line-main">
          <div class="mp-line-name">{{ r.名称 || r.编码 }}</div>
          <dl class="mp-line-fields">
            <div><dt>{{ tt('物料编码') }}</dt><dd>{{ r.编码 || '—' }}</dd></div>
            <div><dt>{{ tt('规格型号') }}</dt><dd>{{ r.规格 || '—' }}</dd></div>
            <div><dt>{{ tt('计量单位') }}</dt><dd>{{ r.单位 || '—' }}</dd></div>
            <template v-if="r.批号"><div><dt>{{ tt('批号') }}</dt><dd>{{ r.批号 }}</dd></div></template>
            <template v-if="readOnly && r.比例"><div><dt>{{ tt('添加比例') }}</dt><dd>{{ r.比例 }}</dd></div></template>
          </dl>
        </div>
        <!-- 应投 / 实投 各带标签、各占一行(与生产领料单的 需求 / 已领 同一写法) -->
        <div class="mp-line-qty">
          <div class="mp-q-row">
            <span class="mp-q-lab">{{ tt('应投') }}</span>
            <b class="num">{{ r.应投 > 0 ? fmtQty(r.应投) : '—' }}</b>
            <i>{{ r.单位 }}</i>
          </div>
          <div class="mp-q-row" :class="{ ok: r.实投 > 0, zero: !(r.实投 > 0) }">
            <span class="mp-q-lab">{{ tt('实投') }}</span>
            <b class="num">{{ fmtQty(r.实投) }}</b>
            <i>{{ r.单位 }}</i>
          </div>
        </div>
      </div>
    </section>

    <!-- 底栏:未完成 = 提交并打印(全部确认才可点);已完成 = 补打印 -->
    <div class="mp-foot">
      <template v-if="readOnly">
        <el-button type="primary" size="large" :loading="printing" @click="reprint">
          {{ tt('补打印') }}
        </el-button>
      </template>
      <template v-else>
        <div v-if="!progress.ok" class="mp-foot-note">
          {{ tt('还有') }} {{ progress.missing.length }} {{ tt('项物料没有确认,确认完才能提交') }}
        </div>
        <el-button
          type="primary"
          size="large"
          class="mp-foot-btn"
          :loading="submitting"
          :disabled="!progress.ok"
          @click="submit"
        >
          {{ tt('提交并打印') }}
        </el-button>
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * 混料单明细页(2026-11-18 第四轮)。
 *
 * 版面、类名、交互刻意与 {@code MobilePickDoc.vue} **逐段对齐**(用户口径「设计要和生产领料一致,
 * 不要独立的去设计」)——改这一页的样式/排版时,请顺手对齐那一页,别让两个手机作业页越长越不像。
 *
 * 纯逻辑(行模型/进度判据/确认覆盖/秤值校验/纸面载荷)全在 {@code business/mixScan.js}。
 */
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import { errMsg } from '@/business/engine'
import { parseBarcode } from '@/business/scanPick'
import {
  toMixRows,
  toSavedRows,
  mixProgress,
  applyConfirm,
  buildScanPayload,
  scaleReadingOf,
  checkScaleReading,
} from '@/business/mixScan'
import { printSlip } from '@/business/slipPrintFlow'
import { scanOnce, hasNativeScan } from '@/business/nativeScan'
import { focusScanNow } from '@/business/scanFocus'

const route = useRoute()
const router = useRouter()

const nativeScan = hasNativeScan()

/**
 * 单据标识 —— ⚠ 必须**响应式**(与 MobilePickDoc 同一个坑)。
 *
 * <p>vue-router 对同一路由页复用组件实例:从 A 单返回、再点 B 单进来时 onMounted 不重跑。
 * 写成 `const x = Number(route.query.line)` 就只会取到第一次的值,页面永远停在第一张单上。
 */
const woNo = computed(() => String(route.query.wo || '').trim())
const lineNo = computed(() => Number(route.query.line) || 0)
const docNo = computed(() => String(route.query.docNo || '').trim())
/** 已保存的单据(只读 + 补打印)= 带了 docNo */
const readOnly = computed(() => !!docNo.value)

const loading = ref(false)
const matInput = ref(null)
const matText = ref('')
const matLoading = ref(false)
const saving = ref(false)
const submitting = ref(false)
const printing = ref(false)

const errText = ref('')
const okText = ref('')
/**
 * 跨「提交 → 跳到只读视图」这一次路由切换的提示(打印结果等)。
 *
 * <p>为什么要它:提交成功后 {@code router.replace} 到 {@code ?docNo=…},watch 会把提示条清空,
 * 现场就看不到「已调用本机打印 / 已发送到打印电脑」这句 —— 而打印恰是提交后最需要人手确认的一件事。
 */
let carriedMsg = ''

/** 抬头(未完成 / 只读两种来源统一成这一份键) */
const head = ref({})
const rows = ref([])
/** 解锁中的物料(扫到本单清单里的料才非空) */
const cur = ref(null)
const curQty = ref(0)

/** 电子秤实时读数 */
const scaleVal = ref(0)
const scaleOk = ref(false)
const scaleLoading = ref(false)
const prevScale = ref(null)
let scaleTimer = null

const progress = computed(() => mixProgress(rows.value))
const scaleText = computed(() => (scaleVal.value > 0 ? `${fmtQty(scaleVal.value)} kg` : '—'))
const scaleHint = computed(() => {
  if (scaleOk.value) return tt('读数稳定，可取值')
  if (scaleVal.value <= 0) return tt('等待称重')
  return tt('读数跳动中')
})

function fmtQty(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)
}

function clearMsg() { errText.value = ''; okText.value = '' }
function errMsgOf(e) { return errMsg(e) || e?.response?.data?.message || e?.message || '' }

function goBack() { router.push('/panelx/list/MOBILE_MIX_SCAN') }

onMounted(() => {
  load()
  nextTick(() => matInput.value?.focus?.())
  if (!readOnly.value) startScalePolling()
})

/**
 * keep-alive 下从列表页回来时实例是旧的(与生产领料同一个坑):
 * 首次挂载已加载过,这里跳过;之后再激活都重拉一遍(别人可能已提交/打印)。
 */
let activatedOnce = false
onActivated(() => {
  if (!activatedOnce) { activatedOnce = true; return }
  load()
  if (!readOnly.value) {
    if (!scaleTimer) startScalePolling()
  } else {
    stopScalePolling()
  }
})

onDeactivated(() => { stopScalePolling() })
onBeforeUnmount(() => { stopScalePolling() })

/** 切单 / 切模式时彻底重拉(并把扫码区的临时状态清干净) */
watch([woNo, lineNo, docNo], () => {
  head.value = {}
  rows.value = []
  softReset()
  if (readOnly.value) stopScalePolling()
  else if (!scaleTimer) startScalePolling()
  load()
  nextTick(() => matInput.value?.focus?.())
})

/** 清掉扫码区与解锁态的临时状态 */
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

/**
 * 取数:
 * · 未完成 → `/px/mix/task`(抬头 + 混料物料清单的应投 + 已确认实投);
 * · 已保存 → `/px/mix/doc`(纸面口径的抬头 + 明细),整页只读。
 */
async function load() {
  clearMsg()
  try {
    if (readOnly.value) {
      const res = await request.get('/px/mix/doc', { params: { docNo: docNo.value } })
      const d = res.data?.data || res.data || {}
      head.value = {
        单号: String(d.单据编号 || docNo.value),
        工单号: String(d.工单号 || ''),
        工单行号: Number(d.工单行号) || 0,
        产品名称: String(d.产品名称 || ''),
        产品编码: String(d.产品编号 || ''),
        生产线: String(d.车间 || ''),
        排产数量: 0,
      }
      rows.value = toSavedRows(d.明细)
      // 规格型号 / 计量单位:纸面没有这两列,从明细第一行取(与生产领料单抬头同口径,缺就显示 —)
      head.value.规格型号 = rows.value[0]?.规格 || ''
      head.value.计量单位 = rows.value[0]?.单位 || ''
      // 提交后带过来的提示(打印结果):见 carriedMsg 注释
      if (carriedMsg) { okText.value = carriedMsg; carriedMsg = '' }
      return
    }
    if (!woNo.value) { errText.value = tt('没有指定单据:请从「扫码混料」列表点进来'); return }
    const res = await request.get('/px/mix/task', { params: { orderNo: woNo.value, lineNo: lineNo.value } })
    const d = res.data?.data || res.data || {}
    head.value = {
      单号: String(d.上次单号 || ''),
      工单号: String(d.工单号 || woNo.value),
      工单行号: Number(d.工单行号) || lineNo.value,
      产品名称: String(d.产品名称 || ''),
      产品编码: String(d.产品编码 || ''),
      规格型号: String(d.规格型号 || ''),
      计量单位: String(d.计量单位 || ''),
      生产线: String(d.生产线 || ''),
      排产数量: Number(d.排产数量) || 0,
      工单行id: Number(d.工单行id) || 0,
    }
    rows.value = toMixRows(d.明细)
  } catch (e) {
    errText.value = errMsgOf(e) || tt('加载单据失败')
  }
}

/**
 * 扫物料码 → **解锁**该项(与生产领料的 `/px/mobilePick/scanMaterial` 同位)。
 *
 * <p>输入框里可能是三种形态,统一交给 {@link parseBarcode} 归一:
 * `存货编码|批号`(纸面条码)、`公司代码@存货编码@批号`(材料仓条码)、或**裸编码**(手输/PDA)。
 *
 * <p>后端按《混料物料清单》(bs_mix_bom)校验:不在本单清单里的料直接拒绝并列出应投的编码,不解锁;
 * 命中则把数量框放出来,数量**默认填电子秤读数**(取不到稳定值就留 0,由人取秤或手输)。
 */
async function scanMaterial() {
  const raw = String(matText.value || '').trim()
  clearMsg()
  cur.value = null
  if (!raw) { errText.value = tt('请先扫描或输入物料编码'); return }
  if (readOnly.value) return
  const p = parseBarcode(raw)
  if (!p.ok) { errText.value = tt('这个码里没有物料编码'); return }
  matLoading.value = true
  try {
    const res = await request.post('/px/mix/scanMaterial', {
      工单号: woNo.value, 工单行号: lineNo.value, 物料编号: p.code,
    })
    const d = res.data?.data || res.data || {}
    cur.value = {
      编码: String(d.物料编号 || p.code),
      名称: String(d.物料名称 || ''),
      规格: String(d.规格型号 || ''),
      单位: String(d.单位 || ''),
      应投: Number(d.应投) || 0,
      实投: Number(d.实投) || 0,
      待投: Number(d.待投) || 0,
      批号: String(d.物料批次 || p.batch || ''),
    }
    // 数量默认取秤(现场口径「根据连接电子秤的取数,点击确认」);秤没稳定值就留 0 等人取秤/手输
    curQty.value = scaleOk.value && scaleVal.value > 0 ? scaleVal.value : 0
    if (curQty.value > 0) okText.value = `${tt('已取秤')}: ${fmtQty(curQty.value)} ${cur.value.单位 || ''}`
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询物料失败')
  } finally {
    matLoading.value = false
    focusScanNow(() => matInput.value, { delay: 120 })
  }
}

/** 相机扫到码:先落进输入框,再走同一条解锁路径(码里的批号由 parseBarcode 拆出来) */
function applyScan(code) {
  matText.value = String(code || '').trim()
  scanMaterial()
}

/** 调起原生相机(没有壳/没有 YjNative.scan 时这颗按钮根本不显示) */
async function scanInto() {
  const r = await scanOnce({ formats: ['CODE_128', 'CODE_39', 'EAN_13', 'QR_CODE'] })
  if (!r.ok) {
    if (r.reason !== 'cancelled') errText.value = tt('没有识别到二维码,请重试;也可以直接用扫码枪扫进输入框')
    return
  }
  applyScan(r.text)
}

/**
 * 确认:把数量框里的秤值**写入**该项(后端覆盖写入,不累加)。
 *
 * 与生产领料的「写入」同一动作,只是数量来自电子秤:
 * 写入成功后重新拉一次单据(进度/明细由服务端给,避免界面与库里两套数)。
 */
async function saveQty() {
  if (!cur.value || !(curQty.value > 0)) return
  saving.value = true
  clearMsg()
  try {
    const body = buildScanPayload({
      order: head.value,
      line: cur.value,
      qty: curQty.value,
      batch: cur.value.批号,
    })
    await request.post('/px/mix/scan', body)
    const applied = applyConfirm(rows.value, { code: cur.value.编码, qty: curQty.value, batch: cur.value.批号 })
    // 提示文案先算好:下面 load() 会清空提示条(它自带 clearMsg),所以要在**之后**再写回去
    const msg = applied.ok && applied.exceed
      ? `${tt('已确认')} ${cur.value.编码} · ${tt('超出应投')} ${fmtQty(-applied.line.待投)}`
      : `${tt('已确认')} ${cur.value.编码} · ${fmtQty(curQty.value)} ${cur.value.单位 || ''}`
    matText.value = ''
    cur.value = null
    curQty.value = 0
    // 服务端为准:重拉一次(进度/待投/批次全跟着库走)
    await load()
    okText.value = progress.value.ok ? tt('全部物料已确认,可以提交') : msg
    nextTick(() => matInput.value?.focus?.())
  } catch (e) {
    errText.value = errMsgOf(e) || tt('确认失败')
  } finally {
    saving.value = false
    focusScanNow(() => matInput.value, { delay: 180 })
  }
}

/** 取消本次解锁并**重新锁定**回到扫码状态(与生产领料同一个动作) */
function cancelLock() {
  matText.value = ''
  cur.value = null
  curQty.value = 0
  clearMsg()
  nextTick(() => matInput.value?.focus?.())
}

/** 点明细行:只高亮提示"请扫该物料的码",**不解锁**(与生产领料同一条口径) */
function pickRow(r) {
  if (readOnly.value) return
  okText.value = `${tt('请扫物料码')}: ${r.编码}${r.名称 ? ' · ' + r.名称 : ''}`
}

/**
 * 提交(整单保存)+ 自动打印。
 *
 * 用户口径「全部物料确认完毕后,才可以提交」—— 按钮按 progress.ok 置灰,后端 `saveDoc`
 * 还会按混料物料清单再校一遍(界面隐藏从来不是安全边界)。
 */
async function submit() {
  if (readOnly.value || !progress.value.ok) return
  // 与「生产领料」的提交同一道确认:这是会落库出纸的动作,不给一次明确的"确定提交"太容易误触
  try {
    await ElMessageBox.confirm(
      tt('提交后生成一张混料单并自动打印,本单不能再修改。确定提交?'),
      tt('提交确认'),
      { confirmButtonText: tt('确定提交'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return }
  submitting.value = true
  clearMsg()
  try {
    const res = await request.post('/px/mix/save', {
      工单号: woNo.value,
      工单行号: lineNo.value,
    })
    const saved = res.data?.data || res.data || {}
    const no = String(saved['单据编号'] || '').trim()
    if (!no) throw new Error(tt('保存后没有拿到混料单号'))
    ElMessage.success(tt('提交成功') + ':' + no)
    okText.value = tt('提交成功') + ':' + no
    // 保存后自动打印(用户口径「保存后自动打印」)—— 打印失败不撤销单据
    await doPrint(no, 'mobileMix.submit')
    // 切到只读视图看这张已提交的单(再配一锅回列表重扫工单);打印结果跟着带过去
    carriedMsg = okText.value
    router.replace({ path: '/panelx/list/MOBILE_MIX_SCAN/doc', query: { docNo: no } })
  } catch (e) {
    errText.value = errMsgOf(e) || tt('提交失败')
  } finally {
    submitting.value = false
  }
}

/**
 * 打一张混料单:优先发打印站点(MIX_SLIP),没电脑在线就退回浏览器打印层。
 *
 * 打印**永远不该让业务回滚**(单据已经存了),失败只提示;成功则让后端累加打印次数,
 * 这样"补打印"列表里能看出这张单已经出过几张纸。
 */
async function doPrint(no, source) {
  const docNumber = String(no || '').trim()
  if (!docNumber) return null
  printing.value = true
  try {
    const r = await printSlip({ kind: 'MIX', docNo: docNumber, source })
    if (r.ok) request.post('/px/mix/printed', { 单据编号: docNumber }).catch(() => {})
    okText.value = r.ok
      ? `${r.mode === 'station' ? tt('已发送到打印电脑') : tt('已调用本机打印')}：${docNumber}`
      : `${tt('打印失败')}：${docNumber}${r.message ? ' · ' + r.message : ''}`
    return r
  } finally {
    printing.value = false
  }
}

/** 只读模式:补打印(已保存的单据一直在库里,不做任何数据改动,只加打印次数) */
async function reprint() {
  await doPrint(docNo.value || head.value.单号, 'mobileMix.reprint')
  await load()
}

// ═══════════ 电子秤(与生产领料的唯一硬件差别) ═══════════

/** 取一次秤值填进数量框(操作工按秤上的读数走,不用手工抄) */
async function takeScale() {
  scaleLoading.value = true
  try {
    const v = await readScale()
    if (!(v > 0)) {
      errText.value = tt('取不到稳定的秤读数:请确认电子秤已连接,或直接在数量框里手输')
      return
    }
    curQty.value = v
    okText.value = `${tt('已取秤')}: ${fmtQty(v)}`
  } finally {
    scaleLoading.value = false
  }
}

/**
 * 读一次秤,返回可用数量(取不到稳定值返回 0)。
 *
 * 手输为什么必须有(2026-10-21 教训):台车秤离线/故障时若硬要读数,现场当场卡死;
 * 而且验证阶段常常没有秤硬件。
 */
async function readScale() {
  try {
    const res = await request.get('/dc/monitor')
    const reading = scaleReadingOf(res?.data || res)
    if (!reading) return 0
    const chk = checkScaleReading(reading, prevScale.value)
    prevScale.value = reading
    scaleVal.value = reading.value > 0 ? reading.value : 0
    scaleOk.value = chk.ok
    return chk.ok ? chk.value : 0
  } catch {
    scaleOk.value = false
    return 0
  }
}

function startScalePolling() {
  stopScalePolling()
  readScale()
  scaleTimer = setInterval(readScale, 2000)
}

function stopScalePolling() {
  if (scaleTimer) clearInterval(scaleTimer)
  scaleTimer = null
}
</script>

<style scoped>
/* 版面与「生产领料单」(MobilePickDoc.vue)**逐条对齐**:同一组卡片、同一套行高与命中区。
   改这里时请顺手看一眼那一页,两个手机作业页不该越长越不像。 */
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
.mp-kv > b i { font-style: normal; color: var(--el-text-color-secondary); }

/* 电子秤卡(与「扫码混料」列表页的秤卡同一形态:左边读数、右边取秤) */
.mp-scale {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin-bottom: 10px; padding: 8px 10px; border-radius: 6px;
  background: var(--el-fill-color-lighter); border-left: 3px solid var(--el-color-warning);
}
.mp-scale.live { border-left-color: var(--el-color-success); }
.mp-scale-main { display: flex; align-items: baseline; gap: 8px; flex: 1; min-width: 0; flex-wrap: wrap; }
.mp-scale-label { font-size: 12px; color: var(--el-text-color-secondary); white-space: nowrap; }
.mp-scale-num { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
.mp-scale-hint { font-size: 11px; color: var(--el-text-color-secondary); white-space: nowrap; }

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

.mp-line {
  position: relative;
  display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 4px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter); cursor: pointer;
}
.mp-line:last-child { border-bottom: 0; }
.mp-line.is-cur { background: var(--el-color-primary-light-9); border-radius: 6px; }
.mp-line.is-ro { cursor: default; }
.mp-line-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--el-border-color); }
.mp-line-dot.on { background: var(--el-color-success); }
.mp-line-main { flex: 1; min-width: 0; }
.mp-line-name { font-size: 14px; }
/* 明细行的字段对:编码/规格型号/单位各占一行,标签灰、值黑(与生产领料单同一套) */
.mp-line-fields { margin: 4px 0 0; padding: 0; }
.mp-line-fields > div { display: grid; grid-template-columns: 68px 1fr; gap: 6px; line-height: 1.5; }
.mp-line-fields dt { margin: 0; font-size: 11px; color: var(--el-text-color-secondary); }
.mp-line-fields dd { margin: 0; font-size: 12px; color: var(--el-text-color-regular); word-break: break-all; }
.mp-line-qty { flex: none; min-width: 104px; display: grid; gap: 1px; font-size: 14px; font-weight: 600; }
.mp-q-row { display: flex; align-items: baseline; justify-content: flex-end; gap: 4px; line-height: 1.35; }
.mp-q-row > b { font-weight: 600; font-variant-numeric: tabular-nums; }
.mp-q-row.ok > b { color: var(--el-color-success); }
.mp-q-row.zero > b { color: var(--el-text-color-placeholder); }
.mp-q-lab { font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }
.mp-line-qty i { font-style: normal; font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }


.mp-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.6; }
.mp-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; }
.num { font-variant-numeric: tabular-nums; }

/* 只读提示条(与生产领料单同一写法) */
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
  display: flex; flex-direction: column; gap: 8px;
  margin: 12px 12px 0; padding: 10px 12px;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mp-foot-note { font-size: 12px; color: var(--el-color-warning-dark-2); line-height: 1.5; }
.mp-foot :deep(.el-button) { height: 46px; margin: 0; }
.mp-foot-btn { width: 100%; }

@media (max-width: 480px) {
  .mp { padding: 0 0 22px; }
  .mp-qty :deep(.el-input-number) { width: 118px; }
  .mp-row :deep(.el-button) { min-width: 56px; padding: 8px 10px; }
}
</style>
