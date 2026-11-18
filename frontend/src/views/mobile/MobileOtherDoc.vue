<!--
  MobileOtherDoc.vue — 「手机扫码 · 其他领料 / 其他退料」的单据明细页(2026-11-16 建,2026-11-18 第三轮改版)

  【用户口径(原话)】
  · 第三轮(2026-11-16):「点击进明细界面再打印,前端设计可以和生产领料一致。只是功能不同,
    补打印就不要扫码了,就查询补打印就可以。」
  · 本轮(2026-11-18):「还有其他领料和其他退料的单据和明细的显示信息(就是物料编码,名称,
    规格型号等字段)要和生产领料一样,现在的单据表头和各行明细的信息太少了。仿照生产领料来写。」

  【所以本页 = 生产领料单据页(MobilePickDoc)的同款形态】
    抬头:单据编号 / 状态 / 日期 / 业务类型 / 部门(退料=领用人) / 经手人 / (仓库、工单号、来源单号)
          / 审核人 / 创建人 / 创建时间 / 行数 / 数量合计 / 金额合计 / 备注
    明细:名称 + 「物料编码 · 规格型号 · 计量单位 · 批号 · 仓库」逐项成行(与生产领料同一个 dl 版式),
          右侧「数量 + 单位」,有金额时再给一行金额。
  功能差别只有一条:本页**不扫码核销、不改数量**,只读 + 打印。

  【数据从哪来】
  后端 `POST /px/slip/rows`(OtherSlipController)。2026-11-18 起它同时返回
  ① **纸面**要的键(材料名称/规格/单位/请领数量/实发数量/备注)—— 打印代理读这几个;
  ② **本页**要的键(物料编码/名称/规格型号/计量单位/批号/仓库/数量/单价/金额/明细备注 + 抬头各栏)。
  两边口径一次取全,页面不再自己拼字段。

  【二维码为什么还在纸上】
  纸面右上角的 `YJSLIP:…` 码是单据身份,仍然印(2026-11-16 第三轮已改回不印码,此注释保留说明历史);
  手机端不再靠扫码补打印 —— 用户明确要"查询补打印"。
-->
<template>
  <div class="mod">
    <div class="mod-top">
      <span class="mod-back" @click="back">‹</span>
      <div class="mod-head">
        <span class="mod-title">{{ data?.['单据编号'] || tt(titleText) }}</span>
        <span class="mod-sub2">
          {{ data?.['业务类型'] || '' }}<i v-if="data?.['工单号']"> · {{ data['工单号'] }}</i>
        </span>
      </div>
      <span class="mod-state" :class="{ done: isAudited }">{{ tt(data?.['单据状态'] || '—') }}</span>
      <el-button
        text
        size="small"
        class="mod-print-top"
        :loading="printing"
        :disabled="!ready"
        @click="doPrint"
      >{{ tt('打印') }}</el-button>
    </div>

    <el-alert v-if="errText" :title="errText" type="warning" :closable="false" show-icon class="mod-alert" />
    <el-alert v-if="okText" :title="okText" type="success" :closable="false" show-icon class="mod-alert" />

    <div v-if="loading" class="mod-empty">{{ tt('加载中') }}</div>
    <div v-else-if="!ready" class="mod-empty">{{ tt('没有指定单据：请从列表点进来') }}</div>

    <template v-else>
      <!-- 抬头:与「生产领料」抬头同一套字段口径(缺值显示 —,不省略行) -->
      <section class="mod-card">
        <div class="mod-kv"><span>{{ tt('单据编号') }}</span><b class="mono">{{ data['单据编号'] || '—' }}</b></div>
        <div class="mod-kv">
          <span>{{ tt('单据状态') }}</span>
          <b :class="{ ok: isAudited }">{{ tt(data['单据状态'] || '—') }}</b>
        </div>
        <div class="mod-kv"><span>{{ tt('单据日期') }}</span><b>{{ data['单据日期'] || '—' }}</b></div>
        <div class="mod-kv"><span>{{ tt('业务类型') }}</span><b>{{ data['业务类型'] || '—' }}</b></div>
        <div class="mod-kv">
          <span>{{ tt(isReturn ? '领用人' : '部门') }}</span>
          <b>{{ data['部门'] || '—' }}</b>
        </div>
        <!-- 其他领料的部门在建单时是空的(只写经手人),这两栏分开显示,别互相顶替 -->
        <div class="mod-kv"><span>{{ tt('经手人') }}</span><b>{{ data['经手人'] || data['部门'] || '—' }}</b></div>
        <div v-if="data['仓库']" class="mod-kv"><span>{{ tt('仓库') }}</span><b>{{ data['仓库'] }}</b></div>
        <div v-if="data['工单号']" class="mod-kv"><span>{{ tt('工单号') }}</span><b class="mono">{{ data['工单号'] }}</b></div>
        <div v-if="data['来源单号']" class="mod-kv"><span>{{ tt('来源单号') }}</span><b class="mono">{{ data['来源单号'] }}</b></div>
        <div class="mod-kv"><span>{{ tt('审核人') }}</span><b>{{ data['审核人'] || '—' }}</b></div>
        <div class="mod-kv"><span>{{ tt('创建人') }}</span><b>{{ data['创建人'] || '—' }}</b></div>
        <div class="mod-kv"><span>{{ tt('创建时间') }}</span><b>{{ data['创建时间'] || '—' }}</b></div>
        <div class="mod-kv"><span>{{ tt('行数') }}</span><b class="num">{{ rows.length }}</b></div>
        <div class="mod-kv"><span>{{ tt('数量合计') }}</span><b class="num">{{ fmt(data['数量合计']) }}</b></div>
        <div v-if="amountTotal > 0" class="mod-kv">
          <span>{{ tt('金额合计') }}</span><b class="num">{{ fmt(amountTotal) }}</b>
        </div>
        <div v-if="data['备注']" class="mod-kv"><span>{{ tt('备注') }}</span><b>{{ data['备注'] }}</b></div>
      </section>

      <!-- 明细:每行摊开「物料编码 / 规格型号 / 计量单位 / 批号 / 仓库」——与生产领料明细行同一个版式 -->
      <section class="mod-card">
        <div class="mod-sec">
          <span>{{ tt('明细') }}</span>
          <span class="mod-sec-num">{{ rows.length }}</span>
        </div>
        <div v-if="!rows.length" class="mod-empty">{{ tt('没有明细') }}</div>
        <div v-for="(r, i) in rows" :key="i" class="mod-line">
          <span class="mod-line-dot"></span>
          <div class="mod-line-main">
            <div class="mod-line-name">{{ r['名称'] || r['材料名称'] || r['物料编码'] }}</div>
            <dl class="mod-line-fields">
              <div><dt>{{ tt('物料编码') }}</dt><dd class="mono">{{ r['物料编码'] || '—' }}</dd></div>
              <div><dt>{{ tt('规格型号') }}</dt><dd>{{ r['规格型号'] || r['规格'] || '—' }}</dd></div>
              <div><dt>{{ tt('计量单位') }}</dt><dd>{{ r['计量单位'] || r['单位'] || '—' }}</dd></div>
              <div><dt>{{ tt('批号') }}</dt><dd>{{ r['批号'] || tt('无批次') }}</dd></div>
              <div><dt>{{ tt('仓库') }}</dt><dd>{{ r['仓库'] || '—' }}</dd></div>
              <div v-if="r['明细备注']"><dt>{{ tt('明细备注') }}</dt><dd>{{ r['明细备注'] }}</dd></div>
            </dl>
          </div>
          <div class="mod-line-qty">
            <div class="mod-q-row">
              <span class="mod-q-lab">{{ tt('数量') }}</span>
              <b class="num">{{ fmt(qtyOf(r)) }}</b>
              <i>{{ r['计量单位'] || r['单位'] }}</i>
            </div>
            <div v-if="amountOf(r) > 0" class="mod-q-row">
              <span class="mod-q-lab">{{ tt('金额') }}</span>
              <b class="num">{{ fmt(amountOf(r)) }}</b>
            </div>
          </div>
        </div>
      </section>

      <div class="mod-foot">
        <el-button type="primary" size="large" :loading="printing" @click="doPrint">{{ tt('打印') }}</el-button>
      </div>
    </template>
  </div>
</template>

<script setup>
/**
 * side: 'pick' = 其他领料(其他出库单) / 'ret' = 其他退料(生产退料单)
 * 单号从路由 query 取(?no=OO-…),由列表页点行时带过来。
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { tt } from '@/i18n'
import { isRet, titleOfSide } from '@/business/scanOther'
import { fetchSlipData, printSlip } from '@/business/slipPrintFlow'

const props = defineProps({
  side: { type: String, default: 'pick' },
})

const route = useRoute()
const router = useRouter()

const isReturn = computed(() => isRet(props.side))
// 纸面标题带「单」字(其他领料单 / 其他退料单),与打印出来的一致
const titleText = computed(() => `${titleOfSide(props.side)}单`)

const docNo = computed(() => String(route.query.no || '').trim())
const slipKind = computed(() => (isReturn.value ? 'OTHER_RET' : 'OTHER_PICK'))
const ready = computed(() => !!docNo.value && !!data.value)
const isAudited = computed(() => data.value?.['单据状态'] === '已审核')

const loading = ref(false)
const printing = ref(false)
const errText = ref('')
const okText = ref('')
const data = ref(null)
const rows = computed(() => (Array.isArray(data.value?.['明细']) ? data.value['明细'] : []))

/** 金额合计:后端给了就用,没给(老接口)就按明细自己加 */
const amountTotal = computed(() => {
  const v = Number(data.value?.['金额合计'])
  if (Number.isFinite(v) && v > 0) return v
  return rows.value.reduce((s, r) => s + amountOf(r), 0)
})

/** 一行数量:新接口给「数量」,老接口只有「实发数量」 */
function qtyOf(r) {
  const v = Number(r?.['数量'] ?? r?.['实发数量'])
  return Number.isFinite(v) ? v : 0
}

/*** 一行金额(单价×数量),后端给了「金额」就用 */
function amountOf(r) {
  const a = Number(r?.['金额'])
  if (Number.isFinite(a) && a !== 0) return a
  const p = Number(r?.['单价'])
  return Number.isFinite(p) ? p * qtyOf(r) : 0
}

const fmt = (n) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)
}

async function load() {
  if (!docNo.value) return
  loading.value = true
  errText.value = ''
  try {
    data.value = await fetchSlipData({ kind: slipKind.value, docNo: docNo.value })
  } catch (e) {
    errText.value = e?.response?.data?.message || e?.message || tt('取单据明细失败')
  } finally {
    loading.value = false
  }
}

/** 打印(补打印也走这里):优先发打印站点,没有电脑在线就退回浏览器打印层 */
async function doPrint() {
  if (!ready.value) return
  printing.value = true
  okText.value = ''
  errText.value = ''
  try {
    const r = await printSlip({ kind: slipKind.value, docNo: docNo.value, source: 'mobileOther.doc' })
    if (r.ok && r.mode === 'station') okText.value = `${tt('已发送到打印电脑')}：${docNo.value}`
    else if (r.ok) okText.value = `${tt('已调用本机打印')}：${docNo.value}`
    else errText.value = `${tt('打印失败')}：${docNo.value}${r.message ? ' · ' + r.message : ''}`
  } finally {
    printing.value = false
  }
}

function back() {
  router.push(isReturn.value ? '/panelx/list/MOBILE_OTHER_RET' : '/panelx/list/MOBILE_OTHER_PICK')
}

/**
 * 切单:vue-router 对同一路由页**复用组件实例**,只改 `?no=` 不会重跑 onMounted
 * (生产领料/混料/生产退料三页都踩过同一个坑)⇒ 必须 watch 单号重新取数,
 * 否则从列表再点另一张单,页面还是上一张。
 */
watch(docNo, (v, old) => {
  if (v === old) return
  data.value = null
  okText.value = ''
  load()
})

onMounted(load)
</script>

<style scoped>
.mod { box-sizing: border-box; width: 100%; max-width: 900px; margin: 0 auto; padding: 0 12px 26px; }
/* 顶栏:与生产领料同一个形态(返回 + 标题/副标题 + 状态 + 刷新位) */
.mod-top {
  display: flex; align-items: center; gap: 8px; padding: 8px 0 10px;
  border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 12px;
}
.mod-back { font-size: 22px; line-height: 1; padding: 0 6px; cursor: pointer; color: var(--el-text-color-regular); }
.mod-head { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mod-title { font-size: 16px; font-weight: 600; word-break: break-all; }
.mod-sub2 { margin-top: 1px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mod-state {
  flex: none; padding: 1px 8px; border-radius: 10px; font-size: 12px;
  background: var(--el-fill-color); color: var(--el-text-color-regular);
}
.mod-state.done { background: var(--el-color-success-light-9); color: var(--el-color-success-dark-2); }
.mod-print-top { padding: 4px 8px; }
.mod-alert { margin-bottom: 10px; }
.mod-empty { padding: 40px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }

/* 卡片 / 抬头字段对:与 MobilePickDoc 的 .mp-card / .mp-kv 同口径 */
.mod-card {
  border: 1px solid var(--el-border-color-light); border-radius: 6px;
  padding: 10px 12px; margin-bottom: 12px; background: var(--el-bg-color);
}
.mod-kv { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; font-size: 13px; }
.mod-kv > span { width: 76px; flex: none; color: var(--el-text-color-secondary); }
.mod-kv > b { font-weight: 500; min-width: 0; word-break: break-all; }
.mod-kv > b.ok { color: var(--el-color-success); }
.mod-kv .num { font-variant-numeric: tabular-nums; }
.mod-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 6px; }
.mod-sec-num {
  display: inline-block; min-width: 20px; text-align: center; padding: 0 6px; border-radius: 10px;
  background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px;
}

/* 明细行:名称 + 逐项字段(dl) + 右侧数量 —— 与生产领料明细行一模一样 */
.mod-line {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 9px 0; border-bottom: 1px dashed var(--el-border-color-lighter);
}
.mod-line:last-child { border-bottom: 0; }
.mod-line-dot { flex: none; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: var(--el-color-primary-light-5); }
.mod-line-main { flex: 1; min-width: 0; }
.mod-line-name { font-size: 14px; font-weight: 500; word-break: break-all; }
.mod-line-fields { margin: 4px 0 0; padding: 0; }
.mod-line-fields > div { display: grid; grid-template-columns: 68px 1fr; gap: 6px; line-height: 1.5; }
.mod-line-fields dt { margin: 0; font-size: 11px; color: var(--el-text-color-secondary); }
.mod-line-fields dd { margin: 0; font-size: 12px; color: var(--el-text-color-regular); word-break: break-all; }
.mod-line-qty { flex: none; min-width: 96px; display: grid; gap: 1px; font-size: 14px; font-weight: 600; }
.mod-q-row { display: flex; align-items: baseline; justify-content: flex-end; gap: 4px; line-height: 1.35; }
.mod-q-row > b { font-weight: 600; font-variant-numeric: tabular-nums; }
.mod-q-lab { font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }
.mod-line-qty i { font-style: normal; font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }
.mono { font-family: ui-monospace, Consolas, monospace; }
.mod-foot { display: flex; }
.mod-foot :deep(.el-button) { flex: 1; }
</style>
