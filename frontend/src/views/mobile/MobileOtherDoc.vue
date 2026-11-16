<!--
  MobileOtherDoc.vue — 「手机扫码 · 其他领料 / 其他退料」的单据明细页(2026-11-16 第三轮)

  【用户口径(原话)】
  「点击进明细界面再打印,前端设计可以和生产领料一致。只是功能不同,
    补打印就不要扫码了,就查询补打印就可以。」

  所以本页 = 生产领料单据页(MobilePickDoc)的**同款形态**:
    列表页点一行 → 进这里看抬头 + 明细 → 在这里点「打印」出纸(补打印也走这里)。
  功能差别只有一条:本页**不扫码核销、不改数量**,只读 + 打印。

  【为什么打印放在明细页而不是列表行上】
  现场补打之前总要核一眼"这张是不是我要的那张"(物料、数量、批号对不对)——
  在列表上直接打,打错了纸就废了;进来看清明细再打,才是他们要的动线。

  【二维码为什么还在纸上】
  纸面右上角的 `YJSLIP:…` 码是单据身份(与「其他领料/其他退料」一一对应),
  仍然印;但**手机端不再靠扫码补打印** —— 用户明确要"查询补打印",
  扫一次码还得对准纸,不如直接查单号快。
-->
<template>
  <div class="mod">
    <div class="mod-top">
      <el-button text size="small" class="mod-back" @click="back">‹ {{ tt('返回') }}</el-button>
      <span class="mod-title">{{ tt(titleText) }}</span>
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
      <section class="mod-card">
        <div class="mod-kv"><span>{{ tt('单据编号') }}</span><b class="mono">{{ data['单据编号'] }}</b></div>
        <div class="mod-kv"><span>{{ tt('单据状态') }}</span><b>{{ tt(data['单据状态'] || '—') }}</b></div>
        <div class="mod-kv"><span>{{ tt('单据日期') }}</span><b>{{ data['单据日期'] || '—' }}</b></div>
        <div class="mod-kv">
          <span>{{ tt(isReturn ? '领用人' : '部门') }}</span>
          <b>{{ data['部门'] || '—' }}</b>
        </div>
        <div class="mod-kv"><span>{{ tt('创建人') }}</span><b>{{ data['创建人'] || '—' }}</b></div>
        <div class="mod-kv">
          <span>{{ tt('数量合计') }}</span>
          <b class="num">{{ fmt(data['数量合计']) }}</b>
        </div>
      </section>

      <section class="mod-card">
        <div class="mod-sec">
          <span>{{ tt('明细') }}</span>
          <span class="mod-sec-num">{{ rows.length }}</span>
        </div>
        <div class="mod-line mod-line-head">
          <span class="mod-c-name">{{ tt('材料名称') }}</span>
          <span class="mod-c-spec">{{ tt('规格') }}</span>
          <span class="mod-c-wh">{{ tt('仓库') }}</span>
          <span class="mod-c-qty">{{ tt('数量') }}</span>
        </div>
        <div v-for="(r, i) in rows" :key="i" class="mod-line">
          <span class="mod-c-name">
            <b>{{ r['材料名称'] }}</b>
            <i>{{ r['物料编码'] || '—' }} · {{ tt('批号') }} {{ r['批号'] || tt('无批次') }}</i>
          </span>
          <span class="mod-c-spec">{{ r['规格'] || '—' }} · {{ r['单位'] }}</span>
          <span class="mod-c-wh">{{ r['仓库'] || '—' }}</span>
          <span class="mod-c-qty">{{ fmt(r['实发数量']) }}</span>
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
import { ref, computed, onMounted } from 'vue'
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

const loading = ref(false)
const printing = ref(false)
const errText = ref('')
const okText = ref('')
const data = ref(null)
const rows = computed(() => (Array.isArray(data.value?.['明细']) ? data.value['明细'] : []))

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

onMounted(load)
</script>

<style scoped>
.mod { max-width: 900px; padding: 12px 16px 26px; }
.mod-top { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.mod-title { font-size: 17px; font-weight: 600; }
.mod-back, .mod-print-top { padding: 4px 8px; }
.mod-print-top { margin-left: auto; }
.mod-alert { margin-bottom: 10px; }
.mod-empty { padding: 40px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mod-card { border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; }
.mod-kv { display: flex; align-items: baseline; gap: 10px; padding: 4px 0; font-size: 13px; }
.mod-kv > span { flex: none; width: 72px; color: var(--el-text-color-secondary); }
.mod-kv > b { font-weight: 500; word-break: break-all; }
.mod-kv .num { font-variant-numeric: tabular-nums; }
.mod-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 6px; }
.mod-sec-num { display: inline-block; min-width: 20px; text-align: center; padding: 0 6px; border-radius: 10px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; }
.mod-line { display: flex; align-items: baseline; gap: 10px; padding: 7px 0; border-bottom: 1px dashed var(--el-border-color-lighter); font-size: 13px; }
.mod-line:last-child { border-bottom: 0; }
.mod-line-head { font-size: 12px; color: var(--el-text-color-secondary); border-bottom: 1px solid var(--el-border-color-lighter); }
.mod-c-name { flex: 1 1 38%; min-width: 0; display: flex; flex-direction: column; }
.mod-c-name > b { font-weight: 500; word-break: break-all; }
.mod-c-name > i { font-style: normal; margin-top: 2px; font-size: 11px; color: var(--el-text-color-secondary); word-break: break-all; }
.mod-c-spec { flex: 1 1 22%; min-width: 0; color: var(--el-text-color-secondary); word-break: break-all; }
.mod-c-wh { flex: 0 0 78px; color: var(--el-text-color-secondary); word-break: break-all; }
.mod-c-qty { flex: 0 0 56px; text-align: right; font-variant-numeric: tabular-nums; }
.mod-foot { display: flex; }
.mod-foot :deep(.el-button) { flex: 1; }
</style>
