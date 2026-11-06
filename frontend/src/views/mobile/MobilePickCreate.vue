<!--
  MobilePickCreate.vue — 手机扫码 · 生成工单领料/退料单(开单工作台,2026-10-30)

  【为什么是独立一页】(用户 2026-10-30 第二轮口径)
  「还有少了一个『生成工单领料/退料单』这个面版,这个面版的功能和生成领料是有区别的(不是一个面版),
    重新分析需求」+ 三问确认:
    ① 定位 = **电脑上的开单工作台**(可扫多张工单**批量生成**、列表看已生成的单);
    ② 职责 = **只管生单**,生完引导到「生产领料」去领;
    ③ 菜单顺序 = 本页排在「生产领料」**之前**。

  ⇒ 本页不做领料:只做「扫工单 → 一对领料/退料单 → 自动打二维码」,
    领料核销与提交都在 /panelx/list/MOBILE_PICK。

  【批量口径】(为什么不是"整批成功或整批失败")
  现场是一沓工单码挨个扫。中间难免有一张 BOM 没维护、或行号对不上 ——
  整批事务回滚会把前面已经开好的单一起撤掉,现场只会说"扫了半天全没了"。
  ⇒ 逐张独立生成、失败的**点名列出原因**,成功的照常出现在结果里(后端 create/batch 同口径)。

  【规范】与 MobilePickList.vue 同一套视觉语言:44px 命中区、无装饰动画、文案走 tt()。
-->
<template>
  <div class="mp">
    <div class="mp-top">
      <div class="mp-head">
        <span class="mp-title">{{ tt('生成工单领料/退料单') }}</span>
        <span v-if="baseUrl" class="mp-base" :title="baseUrl">{{ baseUrl }}</span>
      </div>
      <span class="mp-sub">{{ tt('扫工单生单 → 自动打印工单二维码') }}</span>
      <!-- 刷新(2026-11-01):keep-alive 下"已开单/未开单"不会自己更新,靠它拉最新 -->
      <el-button class="mp-refresh" size="small" :loading="listLoading" @click="refreshAll">
        {{ tt('刷新') }}
      </el-button>
    </div>

    <div v-if="errText" class="mp-err mp-err-top">{{ errText }}</div>
    <div v-if="okText" class="mp-ok mp-err-top">{{ okText }}</div>

    <!-- ① 扫工单(连续扫:扫一张进队列,点「生成」批量建) -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('扫工单') }}</span>
        <span v-if="queue.length" class="mp-sec-num">{{ queue.length }}</span>
      </div>
      <div class="mp-row">
        <el-input
          ref="woInput"
          v-model="woText"
          :placeholder="tt('扫工单码或输入工单号')"
          size="large"
          clearable
          @keyup.enter="addQueue"
        />
        <el-button size="large" @click="addQueue">{{ tt('添加') }}</el-button>
        <el-button v-if="nativeScan" size="large" @click="scanInto">{{ tt('扫码') }}</el-button>
      </div>
      <div class="mp-hint">
        {{ tt('按工单行的产品取《组装BOM表》,生成一张领料单和一张退料单(退料数量默认 0),并自动打印一次工单二维码') }}
      </div>
      <!-- 2026-11-05 用户口径:「只要扫码一个按钮,然后扫码界面变成勾选确认就可以了,因为生成保持批量生成」。
           ⇒ 不再单独放「扫多张」:扫码按钮直接进**多选确认**界面(勾选 → 确定 → 一起进待生成队列)。 -->
      <div v-if="nativeMultiScan" class="mp-hint">
        {{ tt('「扫码」可一次扫多个工单码:按纸面顺序列出、勾选后确定,它们会一起进下面的待生成队列,再点「批量生成」逐张建单') }}
      </div>

      <!-- 待生成队列 -->
      <div v-if="queue.length" class="mp-queue">
        <div class="mp-queue-head">
          <span>{{ tt('待生成') }} {{ queue.length }}</span>
          <span class="mp-queue-clear" @click="queue = []">{{ tt('清空') }}</span>
        </div>
        <div v-for="(q, i) in queue" :key="i" class="mp-queue-row">
          <span class="mp-queue-no mono">{{ q.woNo }}</span>
          <span class="mp-queue-line">{{ q.line > 0 ? '#' + q.line : tt('全部行') }}</span>
          <span class="mp-queue-del" @click="queue.splice(i, 1)">{{ tt('删除') }}</span>
        </div>
      </div>

      <div class="mp-row mp-gen">
        <el-checkbox v-model="autoPrint" size="large">{{ tt('生成后自动打印工单二维码') }}</el-checkbox>
        <el-button
          type="primary"
          size="large"
          :loading="genLoading"
          :disabled="!canGenerate"
          @click="generateBatch"
        >
          {{ queue.length > 1 ? tt('批量生成') + ' (' + queue.length + ')' : tt('生成') }}
        </el-button>
      </div>
    </section>

    <!-- ② 本次生成结果 -->
    <section v-if="results.length || failures.length" class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('生成结果') }}</span>
        <span class="mp-sec-ok" v-if="results.length">{{ tt('成功') }} {{ results.length }}</span>
        <span class="mp-sec-warn" v-if="failures.length">{{ tt('失败') }} {{ failures.length }}</span>
      </div>

      <div v-for="r in results" :key="'ok' + r.工单号 + r.工单行号" class="mp-res is-ok">
        <div class="mp-res-l1">
          <span class="mp-res-wo">{{ r.工单号 }}<i v-if="r.工单行号"> #{{ r.工单行号 }}</i></span>
          <!-- 2026-11-06:已存在的单不再"跳过不打印",而是**按原单重打一次** -->
          <span class="mp-res-tag">{{ r.重复 ? tt('已存在·已打印') : tt('已生成') }}</span>
        </div>
        <div class="mp-res-l2 mono">{{ r.领料单号 || '—' }}</div>
      </div>

      <div v-for="(f, i) in failures" :key="'bad' + i" class="mp-res is-bad">
        <div class="mp-res-l1">
          <span class="mp-res-wo">{{ f.工单号 }}<i v-if="f.工单行号"> #{{ f.工单行号 }}</i></span>
          <span class="mp-res-tag is-bad">{{ tt('失败') }}</span>
        </div>
        <div class="mp-res-l2">{{ f.原因 }}</div>
      </div>
    </section>

    <!-- ③ 工单开单状态(2026-10-30 第三轮:本面板**只看工单**,不看单据)
         用户口径:「生成工单领料/退料单和生产领料功能都重叠了,给我区分开来」+
         确认「彻底切干净:生单只看工单、领料只看单据」。
         ⇒ 这里列的是**工单**(按工单号/产品查),每行显示"这张工单开了没有",
           而不是领料单列表 —— 单据列表在「生产领料」面板里,本页不重复。 -->
    <section class="mp-card">
      <div class="mp-sec">
        <span>{{ tt('工单开单状态') }}</span>
        <span class="mp-sec-note">{{ tt('只显示工单,单据请到「生产领料」查') }}</span>
      </div>
      <div class="mp-row">
        <el-input
          v-model="keyword"
          :placeholder="tt('工单号 / 产品名称')"
          size="large"
          clearable
          @keyup.enter="loadWoStatus"
        />
        <el-button size="large" :loading="listLoading" @click="loadWoStatus">{{ tt('查询') }}</el-button>
      </div>

      <div v-if="!woList.length" class="mp-empty">{{ tt('没有查到工单') }}</div>

      <!-- 未开单(2026-10-30:与「生产领料」的未完成/已完成同款分组,各自可展开收起) -->
      <div class="mp-grp-head" @click="openTodo = !openTodo">
        <span class="mp-grp-title">{{ tt('未开单') }}</span>
        <span class="mp-grp-num">{{ woTodo.length }}</span>
        <span class="mp-grp-arrow" :class="{ open: openTodo }">›</span>
      </div>
      <template v-if="openTodo">
        <div v-if="!woTodo.length" class="mp-empty">{{ tt('没有未开单的工单') }}</div>
        <div
          v-for="w in woTodo"
          :key="'t' + w.工单号 + '#' + w.工单行号"
          class="mp-wo-row"
        >
          <div class="mp-wo-l1">
            <span class="mp-wo-no">{{ w.工单号 }}<i> #{{ w.工单行号 }}</i></span>
            <span class="mp-wo-tag" :class="tagClass(w)">{{ tagText(w) }}</span>
          </div>
          <div class="mp-wo-l2">
            <span class="mp-wo-p">{{ w.产品名称 || w.产品编号 || '—' }}</span>
            <span class="mp-wo-qty">{{ tt('排产') }} {{ fmtQty(w.排产数量) }}</span>
          </div>
          <!-- 未开单同样列出 物料编码/规格型号/计量单位(与已开单一致,2026-11-04) -->
          <div class="mp-wo-l2b">
            <span><i>{{ tt('物料编码') }}</i>{{ w.产品编号 || '—' }}</span>
            <span><i>{{ tt('规格型号') }}</i>{{ w.产品规格 || '—' }}</span>
            <span><i>{{ tt('计量单位') }}</i>{{ w.产品单位 || '—' }}</span>
          </div>
        </div>
      </template>

      <!-- 已开单:可点开看明细(只读) -->
      <div class="mp-grp-head" @click="openCreated = !openCreated">
        <span class="mp-grp-title">{{ tt('已开单') }}</span>
        <span class="mp-grp-num">{{ woCreated.length }}</span>
        <span class="mp-grp-arrow" :class="{ open: openCreated }">›</span>
      </div>
      <template v-if="openCreated">
        <div v-if="!woCreated.length" class="mp-empty">{{ tt('还没有已开单的工单') }}</div>
        <div
          v-for="w in woCreated"
          :key="'c' + w.工单号 + '#' + w.工单行号"
          class="mp-wo-row is-done is-click"
          @click="openDoc(w)"
        >
          <div class="mp-wo-l1">
            <span class="mp-wo-no">{{ w.工单号 }}<i> #{{ w.工单行号 }}</i></span>
            <span class="mp-wo-tag" :class="tagClass(w)">{{ tagText(w) }}</span>
          </div>
          <div class="mp-wo-l2">
            <span class="mp-wo-p">{{ w.产品名称 || w.产品编号 || '—' }}</span>
            <span class="mp-wo-qty">{{ tt('排产') }} {{ fmtQty(w.排产数量) }}</span>
          </div>
          <!-- 🔴 2026-11-04 用户口径:「外面的信息不够,没有物料编码单位名称规格型号,但是明细是有的」。
               列表原来只显示产品名称 + 排产数量,编码/规格/单位要等点开明细才看得到;
               这里补一行:产品编号 · 规格型号 · 计量单位(缺值显示 —,不留空)。 -->
          <div class="mp-wo-l2b">
            <span><i>{{ tt('物料编码') }}</i>{{ w.产品编号 || '—' }}</span>
            <span><i>{{ tt('规格型号') }}</i>{{ w.产品规格 || '—' }}</span>
            <span><i>{{ tt('计量单位') }}</i>{{ w.产品单位 || '—' }}</span>
          </div>
          <div class="mp-wo-l3">
            <span class="mono">{{ w.领料单号 }}</span>
            <span class="mp-wo-prog">{{ tt('已领') }} {{ w.已领项数 || 0 }}/{{ w.物料项数 || 0 }}</span>
            <span class="mp-wo-more">{{ tt('看明细') }} ›</span>
          </div>
        </div>
      </template>
    </section>

    <!-- 底栏:本面板的终点就是"生单完成";去领料是另一个面板的事 -->
    <div class="mp-foot">
      <el-button size="large" :disabled="!results.length && !failures.length" @click="clearAll">
        {{ tt('清空结果') }}
      </el-button>
      <el-button size="large" @click="loadWoStatus">{{ tt('刷新开单状态') }}</el-button>
    </div>

    <!-- 看明细抽屉(2026-10-30 用户口径:「点击生成的明细就直接到生产领料那边去了,想回来查看非常不方便」)
         ⇒ 不再跳转到「生产领料」的单据页,改为**就地弹抽屉**:看完关掉,还停在开单工作台原位,
           不必再点菜单回来。抽屉里只读(与详情页 readOnly 同一口径:不让在这一页领料/退料)。 -->
    <el-drawer
      v-model="detailOpen"
      :title="detail.领料单号 || tt('领料明细')"
      direction="rtl"
      :size="drawerSize"
      class="mp-dv-drawer"
      :destroy-on-close="true"
    >
      <div v-if="detailLoading" class="mp-empty">{{ tt('加载中') }}</div>
      <template v-else>
        <!-- 🔴 2026-11-04 用户口径:「生产领料和生成生产领料这两个面板的**主物料**都没有标明
             物料编码和规格型号和计量单位,信息不完全」。
             ⇒ 抬头补上主物料(工单行产品)的编码 / 规格型号 / 计量单位,与明细行同一口径:
               物料编码取台账快照(生单那一刻的产品编号),规格型号与单位取工单行(plang.gg/jldw)。
               缺值一律显示 —,不省略整行(否则看着像"没这个信息")。 -->
        <div class="mp-dv-head">
          <div class="mp-kv"><span>{{ tt('工单号') }}</span><b>{{ detail.工单号 }}<i v-if="detail.工单行号"> #{{ detail.工单行号 }}</i></b></div>
          <div class="mp-kv"><span>{{ tt('产品') }}</span><b>{{ detail.产品名称 || '—' }}</b></div>
          <div class="mp-kv"><span>{{ tt('物料编码') }}</span><b class="mono">{{ detail.产品编号 || '—' }}</b></div>
          <div class="mp-kv"><span>{{ tt('规格型号') }}</span><b>{{ detailWo.规格型号 || '—' }}</b></div>
          <div class="mp-kv"><span>{{ tt('计量单位') }}</span><b>{{ detailWo.计量单位 || '—' }}</b></div>
          <div class="mp-kv"><span>{{ tt('状态') }}</span><b :class="{ ok: String(detail.状态) === '已完成' }">{{ detail.状态 }}</b></div>
          <div class="mp-kv"><span>{{ tt('领料进度') }}</span><b>{{ detail.已领项数 || 0 }} / {{ detail.物料项数 || 0 }}</b></div>
          <div v-if="detail.退料单号" class="mp-kv"><span>{{ tt('退料单号') }}</span><b>{{ detail.退料单号 }}</b></div>
        </div>
        <div class="mp-dv-title">{{ tt('领料明细') }}</div>
        <div v-if="!(detail.领料明细 || []).length" class="mp-empty">{{ tt('没有明细') }}</div>
        <!-- 🔴 2026-11-04 用户口径:「表头是要带物料编码和规格型号和计量单位的,信息不完全」。
             原来是「名称 + 编码·规格·仓库 一行小字 + 右侧 已领/需求」,手机上看不清编码与规格;
             改成:名称/数量一行,下面三行标签对(物料编码 / 规格型号 / 计量单位),再加仓库。 -->
        <div v-for="r in (detail.领料明细 || [])" :key="r.行号" class="mp-dv-line">
          <div class="mp-dv-main">
            <div class="mp-dv-name">{{ r.名称 || r.编码 }}</div>
            <dl class="mp-dv-fields">
              <div><dt>{{ tt('物料编码') }}</dt><dd>{{ r.编码 || '—' }}</dd></div>
              <div><dt>{{ tt('规格型号') }}</dt><dd>{{ r.规格 || '—' }}</dd></div>
              <div><dt>{{ tt('计量单位') }}</dt><dd>{{ r.单位 || '—' }}</dd></div>
              <div v-if="r.仓库"><dt>{{ tt('仓库') }}</dt><dd>{{ r.仓库 }}</dd></div>
            </dl>
          </div>
          <div class="mp-dv-qty">
            <!-- 🔴 2026-11-04 用户口径:「需求数量在明细里面没有写清楚,在外面就有」。
                 原来这里是 "0/100 支"(裸数字 + 斜杠),抽屉里又没有"已领/需求"列头 ⇒ 两个数字
                 谁是谁全靠猜。改成两行各带标签:需求 x 支 / 已领 y 支。 -->
            <div class="mp-q-row">
              <span class="mp-q-lab">{{ tt('需求') }}</span>
              <b class="num">{{ r.BOM用量 > 0 ? fmtQty(r.BOM用量) : '—' }}</b>
              <i>{{ r.单位 }}</i>
            </div>
            <div class="mp-q-row" :class="{ ok: r.BOM用量 > 0 && Number(r.数量) >= Number(r.BOM用量) }">
              <span class="mp-q-lab">{{ tt('已领') }}</span>
              <b class="num">{{ fmtQty(r.数量) }}</b>
              <i>{{ r.单位 }}</i>
            </div>
          </div>
        </div>
        <div class="mp-dv-note">{{ tt('只读查看:领料与退料请到「生产领料」里操作') }}</div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import request from '@core/request'
import { tt } from '@/i18n'
import { parseWorkOrderCode } from '@/business/scanCode'
import { printWoQr } from '@/business/print-formats'
import { queueToPrintStation, PRINT_TYPE_PICK_SLIP } from '@/business/printStation'

const router = useRouter()

const woInput = ref(null)
const woText = ref('')
const queue = ref([])
const autoPrint = ref(true)
const genLoading = ref(false)
const results = ref([])
const failures = ref([])
const keyword = ref('')
const listLoading = ref(false)
const errText = ref('')
const okText = ref('')

/**
 * 工单开单状态列表(2026-10-30 第三轮:本面板**只看工单**)。
 * 每行 = 一条工单行 + 它开了没有;不列领料单,单据在「生产领料」面板看。
 */
const woList = ref([])

/** 明细抽屉(就地查看,不跳页 —— 见 openDoc 注释) */
const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref({})

/**
 * 抽屉抬头用的工单行信息(2026-11-04)。
 *
 * <p>`/px/mobilePick/doc` 除了台账字段,还下发一个 `工单` 子对象(plang 那一行的
 * 产品名称 / 规格型号 / 计量单位 / 生产线 / 排产数量)。主物料的规格型号与计量单位
 * 就在这个子对象里 —— 抬头要显示它们,数据源不能换成明细行(明细是子件)。
 */
const detailWo = computed(() => detail.value.工单 || {})

/**
 * 看明细抽屉的宽度(2026-11-04)。
 *
 * <p>🔴 原来写死 `size="620px"` —— 手机屏宽才 375~430px,抽屉比屏幕还宽,
 * 内容被挤到屏外、右侧数量看不全,就是用户报的「电脑端正常但手机端显示异常」。
 * 改成:手机(≤640px)占满屏宽,桌面仍 620px;监听 resize 以免旋转/切窗口后不更新。
 */
const winW = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)
const drawerSize = computed(() => (winW.value <= 640 ? '100%' : '620px'))
function onWinResize() { winW.value = window.innerWidth }

const nativeScan = typeof window !== 'undefined' && !!(window.YjNative && window.YjNative.scan)
/** 多选扫码(2026-11-05):只有新版 APK 才有 scanMulti;旧 APK / 浏览器里不显示这个按钮 */
const nativeMultiScan = typeof window !== 'undefined' && !!(window.YjNative && window.YjNative.scanMulti)
const baseUrl = (() => {
  try { return (window.YjNative && window.YjNative.getBaseUrl && window.YjNative.getBaseUrl()) || '' } catch { return '' }
})()

const canGenerate = computed(() => queue.value.length > 0 && !genLoading.value)

/** 分组展开状态(与「生产领料」的未完成/已完成同款:默认展开未开单、收起已开单) */
const openTodo = ref(true)
const openCreated = ref(false)

/**
 * 拆成两组(2026-10-30 用户口径:「把开单和未开单分成两个状态,和生产领料的已完成和未完成一样」)。
 *
 * <p>判据 = 有没有台账行(已开单)。开不了单的(未排产/已结案)仍留在"未开单"组里,
 * 靠行上的红标签说明原因 —— 不单独塞第三组,否则分组会随业务原因越裂越多。
 */
const woTodo = computed(() => (woList.value || []).filter((w) => !w.已开单))
const woCreated = computed(() => (woList.value || []).filter((w) => w.已开单))

function clearMsg() { errText.value = ''; okText.value = '' }
function errMsgOf(e) { return e?.response?.data?.message || e?.message || '' }

/**
 * 点开工单行 → **就地弹抽屉看明细**(2026-10-30 第二轮修正)。
 *
 * <p>用户报障:「点击生成的明细就直接到生产领料那边去了,想回来查看非常不方便」——
 * 原来这里是 `router.push('/panelx/list/MOBILE_PICK/doc?...')`,一跳走就离开了开单工作台,
 * 看完还得重新点菜单回来、重新查一次。
 *
 * <p>⇒ 改成抽屉:关掉即回到原位,列表状态与滚动位置都不丢。
 * 抽屉里**只读**(不提供扫码/数量/提交/退料):这一页的职责到"生单"为止,
 * 领料与退料去「生产领料」—— 与 readOnly 详情页同一口径。
 */
async function openDoc(w) {
  const id = w && w.台账id
  if (!id) return
  detail.value = { 工单号: w.工单号, 工单行号: w.工单行号, 领料明细: [] }
  detailOpen.value = true
  detailLoading.value = true
  clearMsg()
  try {
    const res = await request.get('/px/mobilePick/doc', { params: { id } })
    detail.value = res.data?.data || res.data || {}
  } catch (e) {
    errText.value = errMsgOf(e) || tt('加载单据失败')
    detailOpen.value = false
  } finally {
    detailLoading.value = false
  }
}
function fmtQty(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000)
}

/** 工单行的开单标签 */
function tagText(w) {
  if (w.异常) return w.异常
  if (!w.已开单) return tt('未开单')
  return String(w.状态 || '') === '已完成' ? tt('已完成') : tt('已开单')
}
function tagClass(w) {
  if (w.异常) return 'is-bad'
  if (!w.已开单) return 'is-todo'
  return String(w.状态 || '') === '已完成' ? 'is-done' : 'is-open'
}

function clearAll() {
  results.value = []
  failures.value = []
  clearMsg()
}

onMounted(() => {
  nextTick(() => woInput.value?.focus?.())
  bindScan()
  loadWoStatus()
  window.addEventListener('resize', onWinResize)
})

/** 本页的扫码回调(具名,便于按引用撤销别人的绑定) */
function onScanResult(code, ok) { if (ok && code) applyScan(code) }

/**
 * 多选扫码回调(2026-11-05):原生一次带回多个码 → 逐个解析成「工单号 + 行号」进待生成队列。
 *
 * <p>用户口径:「生成工单领料和退料单这个界面的扫码能不能支持多选,可以多个订单
 * 生成一对一的领料单」—— 这里只负责**排队**;真正建单仍是后面的「批量生成」
 * (后端 `/create/batch` 逐张独立生成,失败的点名,不会整批回滚)。
 *
 * <p>重复的(同工单号+行号已在队列里)静默跳过,并报一声"跳过了几张"。
 */
function onScanMultiResult(codes) {
  const list = Array.isArray(codes) ? codes : []
  clearMsg()
  if (!list.length) return
  let added = 0
  let skipped = 0
  for (const raw of list) {
    const p = parseWorkOrderCode(String(raw || '').trim())
    if (!p.ok) { skipped++; continue }
    const dup = queue.value.some((q) => q.woNo === p.wo && q.line === (Number(p.line) || 0))
    if (dup) { skipped++; continue }
    queue.value.push({ woNo: p.wo, line: Number(p.line) || 0 })
    added++
  }
  woText.value = ''
  if (added) {
    okText.value = `${tt('已加入')} ${added} ${tt('张工单')}${skipped ? ' · ' + tt('跳过') + ' ' + skipped : ''}`
  } else {
    errText.value = tt('没有可加入的工单码')
  }
  nextTick(() => woInput.value?.focus?.())
}

function bindScan() {
  if (typeof window !== 'undefined') {
    window.__yjScanResult = onScanResult
    window.__yjScanResultMulti = onScanMultiResult
  }
}

/**
 * 回到本页时自动重拉(2026-11-01)。
 *
 * <p>keep-alive 会保留实例:从生产领料页返回时「已开单/未开单」还是旧的分组,
 * 刚生成过单据的工单仍显示在"未开单"里。首次挂载已由 mounted 加载,这里跳过。
 *
 * <p>🔴 2026-11-02:激活时必须重新绑定本页回调 —— 三个手机页共用一个
 * `window.__yjScanResult` 槽,旧页面的回调留着会让本页扫码走错解析逻辑。
 */
let activatedOnce = false
onActivated(() => {
  bindScan()
  if (!activatedOnce) { activatedOnce = true; return }
  loadWoStatus()
})

onDeactivated(() => {
  try {
    if (window.__yjScanResult === onScanResult) delete window.__yjScanResult
    if (window.__yjScanResultMulti === onScanMultiResult) delete window.__yjScanResultMulti
  } catch { /* ignore */ }
})

onBeforeUnmount(() => {
  try {
    if (window.__yjScanResult === onScanResult) delete window.__yjScanResult
    if (window.__yjScanResultMulti === onScanMultiResult) delete window.__yjScanResultMulti
  } catch { /* ignore */ }
  window.removeEventListener('resize', onWinResize)
})

/** 刷新按钮:重拉工单列表并清提示 */
async function refreshAll() {
  errText.value = ''
  okText.value = ''
  await loadWoStatus()
  okText.value = tt('已刷新')
}

/**
 * 扫码(2026-11-05 用户口径:「只要扫码一个按钮,然后扫码界面变成勾选确认就可以了,
 * 因为生成保持批量生成」)。
 *
 * <p>⇒ 这一个按钮统一走**多选确认**:新版 APK 调 `scanMulti()`(扫码页里勾选 → 确定,
 * 可一次带回多个工单码);老 APK 没有这个能力就退回单码 `scan()`,行为与以前一致。
 */
function scanInto() {
  const yj = (typeof window !== 'undefined') ? window.YjNative : null
  if (!yj || (typeof yj.scanMulti !== 'function' && typeof yj.scan !== 'function')) {
    errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入')
    return
  }
  try {
    if (typeof yj.scanMulti === 'function') yj.scanMulti()
    else yj.scan()
  } catch { errText.value = tt('调不起相机,请改用输入框扫码枪或手工输入') }
}

/** 扫到的工单码 → 解析工单号 + 行号 → 进队列 */
function applyScan(code) {
  const p = parseWorkOrderCode(String(code || '').trim())
  if (!p.ok) { errText.value = tt('这个码里没有工单号'); return }
  woText.value = p.wo
  addQueue(p.line)
}

/**
 * 加入待生成队列。
 *
 * 同一工单行重复扫只留一条(现场扫重了不该开两次)——
 * 真正的防重复还有服务端唯一约束兜底(台账 UX_wo_pick_doc_wo)。
 */
function addQueue(line) {
  const woNo = String(woText.value || '').trim()
  clearMsg()
  if (!woNo) { errText.value = tt('请先扫描或输入工单号'); return }
  const ln = Number(line) || 0
  const dup = queue.value.some((q) => q.woNo === woNo && q.line === ln)
  if (dup) {
    // 重复扫同一张:不报错,但提示一声(现场常连续扫,静默会让人以为没扫上)
    okText.value = tt('这张工单已在待生成列表里')
  } else {
    queue.value.push({ woNo, line: ln })
  }
  woText.value = ''
  nextTick(() => woInput.value?.focus?.())
}

/** 批量生成:逐张提交,成功的进结果列表,失败的带原因留在失败列表 */
async function generateBatch() {
  if (!canGenerate.value) return
  genLoading.value = true
  clearMsg()
  results.value = []
  failures.value = []
  try {
    const res = await request.post('/px/mobilePick/create/batch', {
      items: queue.value.map((q) => ({ woNo: q.woNo, line: q.line })),
      // 打印载荷由后端给;这里传 true 表示"要自动打印"
      打印: autoPrint.value,
    })
    const d = res.data?.data || res.data || {}
    results.value = Array.isArray(d.成功) ? d.成功 : []
    failures.value = Array.isArray(d.失败) ? d.失败 : []
    queue.value = []

    if (results.value.length) {
      // 已开过单的那几张:不生单、但按原单重打(2026-11-06 用户口径)
      const dupN = results.value.filter((r) => r.重复).length
      okText.value = `${tt('成功')} ${d.成功数 || results.value.length}`
        + (dupN > 0 ? ' · ' + tt('已开过单的按原单重打') + ' ' + dupN : '')
        + ((d.失败数 || 0) > 0 ? ' · ' + tt('失败') + ' ' + d.失败数 : '')
      if (autoPrint.value) await autoPrintAll()
    } else if (failures.value.length) {
      errText.value = `${tt('全部失败')}:${failures.value[0].原因 || ''}`
    }
    await loadWoStatus()
  } catch (e) {
    errText.value = errMsgOf(e) || tt('生成失败')
  } finally {
    genLoading.value = false
  }
}

/**
 * 生单后自动打印(用户口径「在生成生产领料单的时候自动打印一次」)。
 *
 * 优先发给「自动打印」站点电脑;没有在线站点就退回本机打印层。
 * **逐张打印、失败不阻断** —— 单已经建好了,现场可以在单据里重打。
 *
 * <p>🔴 2026-11-06 用户口径:「现在扫码后已存在的领料单,是不在打印的。但是现在是需要给他打印,
 * 只是不生成领料单」⇒ **已存在的单也打**(后端会把那张已存在单据的打印载荷一起回给你),
 * 跳过条件只剩"没有打印载荷"(例如关掉了自动打印)。
 */
async function autoPrintAll() {
  for (const r of results.value) {
    if (!r.打印) continue
    try {
      const queued = await queueToPrintStation({ ...r.打印, 类型: PRINT_TYPE_PICK_SLIP, 来源: 'mobilePick.create' })
      if (!(queued && queued.online)) await printWoQr(r.打印)
    } catch {
      // 打印失败只在控制台账:生单本身已成功
      console.warn('工单二维码自动打印失败(单据已生成,可在单据里重打)')
    }
  }
}

/**
 * 工单开单状态(本面板唯一的列表)。
 *
 * 与「生产领料」的区别:**这里一行是工单**,回答"这张工单开了没有";
 * 那边一行是**单据**,回答"这张单领到哪了"。两个面板各看各的,不重复。
 */
async function loadWoStatus() {
  listLoading.value = true
  try {
    const res = await request.get('/px/mobilePick/create/woStatus', {
      params: { keyword: String(keyword.value || '').trim() || undefined },
    })
    const d = res.data?.data || res.data || {}
    woList.value = Array.isArray(d.list) ? d.list : []
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询失败')
  } finally {
    listLoading.value = false
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
/* 刷新按钮:右上角固定 */
.mp-refresh { flex: none; }
.mp-title { font-size: 16px; font-weight: 600; }
.mp-head { display: flex; flex-direction: column; min-width: 0; }
.mp-base {
  max-width: 42vw; font-size: 11px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mp-sub { flex: 1; min-width: 0; margin-left: 4px; font-size: 12px; color: var(--el-text-color-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.mp-card {
  margin: 10px 12px 0; padding: 12px;
  background: var(--el-bg-color); border-radius: 8px; border: 1px solid var(--el-border-color-lighter);
}
.mp-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.mp-sec-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; font-weight: 400;
}
.mp-sec-ok { font-size: 11px; font-weight: 400; color: var(--el-color-success); }
.mp-sec-warn { font-size: 11px; font-weight: 400; color: var(--el-color-danger); }

.mp-row { display: flex; align-items: center; gap: 8px; }
.mp-row :deep(.el-input) { flex: 1; min-width: 0; }
.mp-row :deep(.el-button) { height: 44px; min-width: 64px; margin-left: 0; }
.mp-row :deep(.el-input__wrapper) { min-height: 44px; }
.mp-row :deep(.el-input__inner) { font-size: 16px; }

.mp-gen { margin-top: 10px; flex-wrap: wrap; }
.mp-gen :deep(.el-button) { flex: 0 0 auto; min-width: 120px; }

.mp-hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }

/* 待生成队列 */
.mp-queue { margin-top: 10px; border-top: 1px dashed var(--el-border-color-lighter); }
.mp-queue-head {
  display: flex; align-items: center; gap: 8px; padding: 8px 0 4px;
  font-size: 12px; color: var(--el-text-color-secondary);
}
.mp-queue-clear { margin-left: auto; color: var(--el-color-danger); cursor: pointer; }
.mp-queue-row { display: flex; align-items: center; gap: 8px; min-height: 40px; border-bottom: 1px dashed var(--el-border-color-lighter); }
.mp-queue-row:last-child { border-bottom: 0; }
.mp-queue-no { flex: 1; min-width: 0; font-size: 13px; }
.mp-queue-line { flex: none; font-size: 12px; color: var(--el-text-color-secondary); }
.mp-queue-del { flex: none; padding: 0 4px; font-size: 13px; color: var(--el-color-danger); cursor: pointer; }

/* 生成结果 */
.mp-res {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 8px;
  padding: 8px 0; border-top: 1px solid var(--el-border-color-lighter);
}
.mp-res:first-of-type { border-top: 0; }
.mp-res-l1 { display: flex; align-items: center; gap: 8px; min-width: 0; }
.mp-res-wo { font-size: 14px; font-weight: 600; }
.mp-res-wo i { font-style: normal; color: var(--el-text-color-secondary); font-weight: 400; }
.mp-res-tag { padding: 0 6px; border-radius: 4px; font-size: 11px; background: var(--el-color-success-light-8); color: var(--el-color-success-dark-2); }
.mp-res-tag.is-bad { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.mp-res-l2 { font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; grid-column: 1; }
.mp-res.is-bad .mp-res-l2 { color: var(--el-color-danger); }
.mp-res :deep(.el-button) { grid-column: 2; grid-row: 1 / span 2; align-self: center; }

/* 分组 + 单据行 */
.mp-grp-head { display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; user-select: none; border-top: 1px dashed var(--el-border-color-lighter); }
.mp-grp-title { font-size: 14px; font-weight: 600; }
.mp-grp-num {
  min-width: 20px; padding: 0 6px; border-radius: 10px; text-align: center;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px;
}
.mp-grp-arrow {
  margin-left: auto; font-size: 18px; line-height: 1; color: var(--el-text-color-secondary);
  transform: rotate(90deg); transition: transform .15s ease;
}
.mp-grp-arrow.open { transform: rotate(-90deg); }

.mp-doc { padding: 8px 0; border-top: 1px solid var(--el-border-color-lighter); cursor: pointer; }
.mp-doc:active { background: var(--el-fill-color-lighter); }
.mp-doc.is-done { opacity: .82; }
.mp-doc-l1 { display: flex; align-items: baseline; gap: 8px; }
.mp-doc-no { font-size: 14px; font-weight: 600; }
.mp-doc-prog { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.mp-doc-l2 { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; font-size: 12px; }
.mp-doc-l2 i { font-style: normal; color: var(--el-text-color-secondary); }
.mp-doc-p { flex: 1; min-width: 0; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 工单开单状态行(2026-10-30 第三轮:本面板只看工单) */
.mp-wo-row { padding: 8px 0; border-top: 1px solid var(--el-border-color-lighter); }
.mp-wo-row:first-of-type { border-top: 0; }
.mp-wo-row.is-done { opacity: .86; }
.mp-wo-row.is-click { cursor: pointer; }
.mp-wo-row.is-click:active { background: var(--el-fill-color-lighter); border-radius: 6px; }
.mp-wo-l1 { display: flex; align-items: center; gap: 8px; }
.mp-wo-no { font-size: 14px; font-weight: 600; }
.mp-wo-no i { font-style: normal; font-weight: 400; color: var(--el-text-color-secondary); }
.mp-wo-tag { margin-left: auto; padding: 0 6px; border-radius: 4px; font-size: 11px; white-space: nowrap; }
.mp-wo-tag.is-todo { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.mp-wo-tag.is-open { background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2); }
.mp-wo-tag.is-done { background: var(--el-color-success-light-8); color: var(--el-color-success-dark-2); }
.mp-wo-tag.is-bad  { background: var(--el-color-danger-light-9);  color: var(--el-color-danger); }
.mp-wo-l2 { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; font-size: 12px; }
.mp-wo-p { flex: 1; min-width: 0; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-wo-qty { flex: none; color: var(--el-text-color-placeholder); font-variant-numeric: tabular-nums; }
/* 产品编码/规格型号/单位那一行(2026-11-04):手机窄屏用 flex-wrap 自动换行,不挤成横向滚动 */
.mp-wo-l2b { display: flex; flex-wrap: wrap; gap: 2px 12px; margin-top: 2px; font-size: 11px; color: var(--el-text-color-secondary); }
.mp-wo-l2b > span { display: inline-flex; align-items: baseline; gap: 3px; min-width: 0; max-width: 100%; }
.mp-wo-l2b > span > i { font-style: normal; flex: none; color: var(--el-text-color-placeholder); }
.mp-wo-l3 { display: flex; align-items: baseline; gap: 8px; margin-top: 3px; font-size: 12px; }
.mp-wo-l3 .mono { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.mp-wo-prog { flex: none; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.mp-wo-more { flex: none; margin-left: auto; color: var(--el-color-primary); font-size: 12px; }

/* 明细抽屉(就地查看,不跳页) */
.mp-dv-head { margin-bottom: 12px; }
/* 抬头字段对(2026-11-04):原来 .mp-kv 没有布局样式,一排 `<div><span>标签</span><b>值</b></div>`
   在块级里首尾相连,读出「工单号GD-2026-10-0241 #4」这种标签黏着值的句子。
   改成两列网格:标签 76px 灰、值自适应换行 —— 与「生产领料」详情页同一口径。 */
.mp-kv { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 8px; align-items: baseline; padding: 2px 0; font-size: 13px; }
.mp-kv > span { color: var(--el-text-color-secondary); }
.mp-kv > b { font-weight: 500; min-width: 0; word-break: break-all; }
.mp-kv > b.ok { color: var(--el-color-success); }
.mp-kv > b i { font-style: normal; font-weight: 400; color: var(--el-text-color-secondary); }
.mp-dv-title { margin: 10px 0 6px; font-size: 13px; font-weight: 600; }
.mp-dv-line {
  display: flex; align-items: center; gap: 10px; padding: 8px 0;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.mp-dv-main { flex: 1; min-width: 0; }
.mp-dv-name { font-size: 14px; }
/* 明细字段对(2026-11-04):物料编码 / 规格型号 / 计量单位 各占一行,不再挤成一行小字 */
.mp-dv-fields { margin: 4px 0 0; padding: 0; }
.mp-dv-fields > div { display: grid; grid-template-columns: 68px 1fr; gap: 6px; line-height: 1.5; }
.mp-dv-fields dt { margin: 0; font-size: 11px; color: var(--el-text-color-secondary); }
.mp-dv-fields dd { margin: 0; font-size: 12px; color: var(--el-text-color-regular); word-break: break-all; }
/* 手机:抽屉占满屏宽(原 620px 在 375px 屏上必然溢出,这就是"手机端显示异常") */
@media (max-width: 640px) {
  :deep(.mp-dv-drawer) { width: 100% !important; max-width: 100% !important; }
  .mp-dv-line { align-items: flex-start; }
  .mp-dv-qty { font-size: 13px; }
}
/* 需求 / 已领 两行(2026-11-04):标签 + 右对齐等宽数字 + 小字单位,两行纵向对齐 */
.mp-dv-qty { flex: none; display: grid; gap: 1px; min-width: 104px; font-size: 14px; }
.mp-q-row { display: flex; align-items: baseline; justify-content: flex-end; gap: 4px; line-height: 1.35; }
.mp-q-row > b { font-weight: 600; font-variant-numeric: tabular-nums; }
.mp-q-row.ok > b { color: var(--el-color-success); }
.mp-q-lab { font-size: 11px; color: var(--el-text-color-secondary); }
.mp-dv-qty i { font-style: normal; font-size: 11px; color: var(--el-text-color-secondary); }
.mp-dv-note { margin-top: 16px; font-size: 12px; color: var(--el-text-color-secondary); }

.mp-empty { padding: 18px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; }

.mp-err, .mp-ok { margin: 10px 12px 0; padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5; }
.mp-err { background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); }
.mp-ok { background: var(--el-color-success-light-9); color: var(--el-color-success-dark-2); }

.mp-foot {
  display: flex; gap: 10px; margin: 12px 12px 0; padding: 10px 12px;
  margin-top: auto;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
}
.mp-foot :deep(.el-button) { flex: 1; height: 46px; margin: 0; }

/* 电脑端:左边开单、右边已生成的单(开单工作台主要在电脑上用) */
@media (min-width: 900px) {
  .mp { display: grid; grid-template-columns: minmax(0, 480px) minmax(0, 1fr); gap: 12px; align-items: start; }
  .mp-top, .mp-err, .mp-ok, .mp-foot { grid-column: 1 / -1; }
  .mp-card { margin: 0 0 12px; }
}
</style>
