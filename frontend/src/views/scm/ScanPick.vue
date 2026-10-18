<!--
  ScanPick.vue — 扫码领料(2026-10-18)

  【为什么有这个页面】
  用户在「材料出库单」里选存货会看到「没有库存」:那是库存状况表按(物料,仓库)聚合、
  且此前只回填前 500 行造成的(已另修 fillCurrentStock)。仓库作业真正关心的是
  **批号级可用量**(kucun 三键:物料/仓库/批号 → 视图 v_stock_pick,只出有货的行)。
  条码管理三个面板的标签码内容固定为 `存货编码|批号`,于是「扫一下标签 → 按批号查可用量
  → 组单」就是最贴合现场的领料路径。

  【界面取舍】
  目的:仓管拿扫码枪/手机扫标签直接领料,不碰商品面板。
  受众:仓库作业员,站着扫、手快,一屏看关键信息。
  先扫什么:顶部扫码框(进页自动聚焦,回车即提交),结果卡紧跟在下面。
  基调:工具、密、静;不套装饰性卡片,数字用等宽感,可用量是唯一强调项。
  记忆点:扫一下就把「这批还有多少」怼到眼前,够数才让加入。
  约束:Element Plus;所有文案走 tt();375 宽下不横向滚动;输入/按钮命中区 ≥40px。

  【建单】
  确认若干行后调 /px/callButton(panelCode=MATERIAL_OUT, buttonName=保存) 生成**草稿**,
  单据编号由后端 FormNoService 生成(前端留空),之后照常走审核链。
-->
<template>
  <div class="scan-pick">
    <div class="sp-head">
      <div class="sp-title">{{ tt('扫码领料') }}</div>
      <div class="sp-sub">{{ tt('扫标签（存货编码|批号）→ 核对批号级可用量 → 加入清单 → 生成材料出库单草稿') }}</div>
    </div>

    <div class="sp-scan">
      <el-input
        ref="scanInput"
        v-model="scanText"
        :placeholder="tt('扫描或输入条码（存货编码|批号）')"
        clearable
        size="large"
        @keyup.enter="onScan"
      >
        <template #append>
          <el-button :loading="probing" @click="onScan">{{ tt('查询') }}</el-button>
        </template>
      </el-input>
    </div>

    <el-alert v-if="errText" :title="errText" type="warning" :closable="false" show-icon class="sp-alert" />

    <div v-if="candidates.length" class="sp-card">
      <div v-for="(c, i) in candidates" :key="i" class="sp-cand" :class="{ picked: i === candIndex }" @click="candIndex = i">
        <div class="sp-cand-main">
          <div class="sp-cand-name">{{ c['存货名称'] || c['存货编码'] }}</div>
          <div class="sp-cand-meta">
            {{ c['存货编码'] }} · {{ c['规格型号'] || '—' }} · {{ c['计量单位'] || '—' }}
          </div>
          <div class="sp-cand-meta">
            {{ tt('仓库') }}：{{ c['仓库'] || c['仓库编码'] }} · {{ tt('批号') }}：{{ c['批号'] || tt('无批次') }}
          </div>
        </div>
        <div class="sp-cand-stock">
          <div class="sp-stock-num">{{ fmt(c['现存量']) }}</div>
          <div class="sp-stock-cap">{{ tt('可用量') }}</div>
        </div>
      </div>

      <div class="sp-qty">
        <span class="sp-qty-label">{{ tt('本次领用') }}</span>
        <el-input-number v-model="qty" :min="0" :precision="2" :step="1" size="large" />
        <span class="sp-qty-unit">{{ current?.['计量单位'] || '' }}</span>
        <el-button type="primary" size="large" :disabled="!canAdd" @click="addLine">{{ tt('加入清单') }}</el-button>
      </div>
    </div>

    <div class="sp-list">
      <div class="sp-list-head">
        <span>{{ tt('领料清单') }}</span>
        <span class="sp-list-count">{{ lines.length }}</span>
      </div>
      <el-empty v-if="!lines.length" :description="tt('还没有扫码加入的物料')" :image-size="70" />
      <div v-for="(l, i) in lines" :key="i" class="sp-line">
        <div class="sp-line-main">
          <span class="sp-line-name">{{ l.name }}</span>
          <span class="sp-line-meta">{{ l.code }} · {{ l.batch || tt('无批次') }} · {{ l.warehouse }}</span>
        </div>
        <div class="sp-line-qty">{{ fmt(l.qty) }} {{ l.uom }}</div>
        <el-button text type="danger" size="small" @click="lines.splice(i, 1)">{{ tt('移除') }}</el-button>
      </div>
    </div>

    <div class="sp-foot">
      <el-button size="large" @click="reset">{{ tt('清空') }}</el-button>
      <el-button type="primary" size="large" :loading="saving" :disabled="!lines.length" @click="submit">
        {{ tt('生成材料出库单') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { queryFormDataList, callButton, errMsg } from '@/business/engine'
import { parseBarcode, matchPickRows, checkPickQty, buildMaterialOutForm } from '@/business/scanPick'

const scanText = ref('')
const scanInput = ref(null)
const probing = ref(false)
const saving = ref(false)
const errText = ref('')
const candidates = ref([])
const candIndex = ref(0)
const qty = ref(1)
const lines = ref([])

const current = computed(() => candidates.value[candIndex.value] || null)
const canAdd = computed(() => !!current.value && checkPickQty({ qty: qty.value, available: Number(current.value['现存量']) }).ok)

onMounted(() => nextTick(() => scanInput.value?.focus?.()))

const fmt = (n) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)
}

const reasonText = (reason) => ({
  empty: tt('请扫描或输入条码'),
  'no-code': tt('条码格式不对：应为「存货编码|批号」'),
  'too-many': tt('这个不是条码管理里的标签（码内容应为 存货编码|批号）'),
  'no-match': tt('这批货目前没有可用库存（按批号查）'),
  'no-qty': tt('领用数量要大于 0'),
  'no-stock': tt('该批号可用量为 0'),
  exceed: tt('领用数量超过了该批号的可用量'),
}[reason] || '')

/** 扫码/回车:解析码 → 按批号查 STOCK_PICK → 给出候选 */
async function onScan() {
  errText.value = ''
  candidates.value = []
  candIndex.value = 0
  const parsed = parseBarcode(scanText.value)
  if (!parsed.ok) {
    errText.value = reasonText(parsed.reason)
    return
  }
  probing.value = true
  try {
    const res = await queryFormDataList({
      panelCode: 'STOCK_PICK',
      // ⚠ 只按「存货编码」查,不带批号过滤:条码派生的批号(20261014001)与 kucun 实际批号
      //   (SX-20261007 / 空)对不上,带批号查会一行都查不到(实测 849 个材料码全空)。
      //   批号交回 matchPickRows 做「同批号优先」排序用。
      condition: { 存货编码: parsed.code },
      pageNo: 1,
      pageSize: 50,
    })
    const hits = matchPickRows(res.list || [], parsed)
    if (!hits.length) {
      errText.value = reasonText('no-match')
      return
    }
    candidates.value = hits
    // 默认领用数量 = 该批号在第一处仓库的可用量(大多数场景一次领完)
    qty.value = Number(hits[0]['现存量']) || 1
  } catch (e) {
    errText.value = errMsg(e) || tt('查询可用量失败')
  } finally {
    probing.value = false
  }
}

/** 加入清单:同(编码,批号,仓库)合并数量,避免重复行 */
function addLine() {
  const c = current.value
  if (!c) return
  const check = checkPickQty({ qty: qty.value, available: Number(c['现存量']) })
  if (!check.ok) {
    errText.value = reasonText(check.reason)
    return
  }
  const key = [c['存货编码'], c['批号'], c['仓库编码'] || c['仓库']].map((x) => String(x || '').trim()).join('|')
  const exist = lines.value.find((l) => l.key === key)
  const n = Number(qty.value)
  if (exist) {
    const total = Math.round((exist.qty + n) * 10000) / 10000
    if (Math.round(total * 10000) > Math.round(Number(c['现存量']) * 10000)) {
      errText.value = reasonText('exceed')
      return
    }
    exist.qty = total
  } else {
    lines.value.push({
      key,
      code: String(c['存货编码'] || '').trim(),
      name: String(c['存货名称'] || '').trim(),
      uom: String(c['计量单位'] || '').trim(),
      batch: String(c['批号'] || '').trim(),
      warehouse: String(c['仓库'] || c['仓库编码'] || '').trim(),
      qty: n,
      price: Number(c['结存单价']) || 0,
    })
  }
  scanText.value = ''
  candidates.value = []
  errText.value = ''
  nextTick(() => scanInput.value?.focus?.())
}

function reset() {
  lines.value = []
  scanText.value = ''
  candidates.value = []
  errText.value = ''
}

/** 生成材料出库单草稿(单据编号交给后端) */
async function submit() {
  saving.value = true
  try {
    const warehouse = lines.value.length && lines.value.every((l) => l.warehouse === lines.value[0].warehouse)
      ? lines.value[0].warehouse
      : ''
    const formData = buildMaterialOutForm(lines.value, { warehouse })
    await callButton({ panelCode: 'MATERIAL_OUT', buttonName: '保存', formData })
    ElMessage.success(tt('已生成材料出库单草稿，请到材料出库单里审核'))
    reset()
  } catch (e) {
    errText.value = errMsg(e) || tt('生成材料出库单失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.scan-pick { max-width: 900px; padding: 16px 20px 28px; }
.sp-head { margin-bottom: 14px; }
.sp-title { font-size: 18px; font-weight: 600; }
.sp-sub { margin-top: 4px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.sp-scan { margin-bottom: 12px; }
.sp-alert { margin-bottom: 12px; }
.sp-card { border: 1px solid var(--el-border-color-light); border-radius: 6px; overflow: hidden; margin-bottom: 14px; }
.sp-cand { display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--el-border-color-lighter); }
.sp-cand:last-of-type { border-bottom: 0; }
.sp-cand.picked { background: var(--el-color-primary-light-9); }
.sp-cand-main { flex: 1; min-width: 0; }
.sp-cand-name { font-size: 14px; font-weight: 500; }
.sp-cand-meta { margin-top: 2px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.sp-cand-stock { text-align: right; flex: none; }
.sp-stock-num { font-size: 20px; font-weight: 600; color: var(--el-color-primary); font-variant-numeric: tabular-nums; }
.sp-stock-cap { font-size: 11px; color: var(--el-text-color-secondary); }
.sp-qty { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--el-fill-color-lighter); }
.sp-qty-label { font-size: 13px; color: var(--el-text-color-regular); }
.sp-qty-unit { font-size: 13px; color: var(--el-text-color-secondary); min-width: 24px; }
.sp-list { margin-bottom: 14px; }
.sp-list-head { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 6px; }
.sp-list-count { display: inline-block; min-width: 20px; text-align: center; padding: 0 6px; border-radius: 10px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; }
.sp-line { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--el-border-color-lighter); }
.sp-line-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sp-line-name { font-size: 13px; }
.sp-line-meta { font-size: 11px; color: var(--el-text-color-secondary); word-break: break-all; }
.sp-line-qty { font-size: 13px; font-variant-numeric: tabular-nums; }
.sp-foot { display: flex; gap: 10px; justify-content: flex-end; }
@media (max-width: 480px) {
  .scan-pick { padding: 12px; }
  .sp-cand { align-items: flex-start; }
  .sp-qty { flex-wrap: wrap; }
  .sp-foot { flex-direction: column-reverse; }
  .sp-foot .el-button { width: 100%; }
}
</style>
