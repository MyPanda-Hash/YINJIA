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
-->
<template>
  <div class="mo-scan">
    <div class="mo-head">
      <div class="mo-title">{{ tt(titleText) }}</div>
      <div class="mo-sub">{{ tt(subText) }}</div>
    </div>

    <div class="mo-scanbar">
      <el-input
        ref="scanInput"
        v-model="scanText"
        :placeholder="tt('扫描或输入物料码（存货编码|批号）')"
        clearable
        size="large"
        @keyup.enter="onScan"
      >
        <template #append>
          <el-button :loading="probing" @click="onScan">{{ tt('查询') }}</el-button>
        </template>
      </el-input>
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
      <div
        v-for="(c, i) in candidates"
        :key="i"
        class="mo-cand"
        :class="{ picked: i === candIndex }"
        @click="candIndex = i"
      >
        <div class="mo-cand-main">
          <div class="mo-cand-name">{{ c['存货名称'] || c['存货编码'] }}</div>
          <div class="mo-cand-meta">{{ c['存货编码'] }} · {{ c['规格型号'] || '—' }} · {{ c['计量单位'] || '—' }}</div>
          <div class="mo-cand-meta">
            {{ tt('仓库') }}：{{ c['仓库'] || c['仓库编码'] || '—' }} · {{ tt('批号') }}：{{ c['批号'] || tt('无批次') }}
          </div>
        </div>
        <div class="mo-cand-stock">
          <div class="mo-stock-num">{{ fmt(c['现存量']) }}</div>
          <div class="mo-stock-cap">{{ tt('可用量') }}</div>
        </div>
      </div>

      <!-- 退料且库存里没有这个物料时:仓库必须手选(否则不知道退回哪个仓) -->
      <div v-if="needWarehouse" class="mo-wh">
        <span class="mo-qty-label">{{ tt('退到仓库') }}</span>
        <el-select v-model="warehouseCode" :placeholder="tt('请选择仓库')" size="large" filterable class="mo-wh-sel">
          <el-option v-for="w in warehouses" :key="w.code" :label="w.name" :value="w.code" />
        </el-select>
      </div>

      <div class="mo-qty">
        <span class="mo-qty-label">{{ tt('本次数量') }}</span>
        <el-input-number v-model="qty" :min="0" :precision="2" :step="1" size="large" />
        <span class="mo-qty-unit">{{ current?.['计量单位'] || '' }}</span>
        <el-button type="primary" size="large" :disabled="!canAdd" @click="addLine">{{ tt('加入清单') }}</el-button>
      </div>
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

    <!-- 补打印(2026-11-16):扫单据二维码,或手输单号 —— 纸质单丢了/没打出来时用 -->
    <div class="mo-reprint">
      <div class="mo-list-head">
        <span>{{ tt('补打印') }}</span>
        <span class="mo-reprint-hint">{{ tt('扫单据上的二维码，或直接输入单号') }}</span>
      </div>
      <div class="mo-reprint-row">
        <el-input
          v-model="printNo"
          :placeholder="tt('扫码或输入单号（如 OO-2026-11-0005）')"
          clearable
          size="large"
          @keyup.enter="reprint"
        />
        <el-button size="large" :loading="printing" @click="reprint">{{ tt('补打印') }}</el-button>
      </div>
      <el-alert v-if="printMsg" :title="printMsg" type="info" :closable="false" show-icon class="mo-print-msg" />
    </div>
  </div>
</template>

<script setup>
/**
 * side: 'pick' = 其他领料(其他出库单) / 'ret' = 其他退料(生产退料单)
 * 由路由 props 注入(见 router/index.js 两条静态路由),不在这里猜。
 */
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { tt } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { queryFormDataList, callButton, errMsg } from '@/business/engine'
import { parseBarcode, matchPickRows } from '@/business/scanPick'
import {
  SIDE_RET, isRet, panelOfSide, titleOfSide, checkQty, mergeLine, buildForm,
  doneMessageKey,
} from '@/business/scanOther'
import { parseSlipQr } from '@/business/slipPrint'
import { printSlip } from '@/business/slipPrintFlow'

const props = defineProps({
  side: { type: String, default: 'pick' },
})

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
const saving = ref(false)
const errText = ref('')
const candidates = ref([])
const candIndex = ref(0)
const qty = ref(1)
const lines = ref([])
const lastDoc = ref('')
const lastMsg = ref('')

// 打印(2026-11-16):提交即打印 + 补打印。kind 决定纸面标题与派单类型(见 business/slipPrint.js)
const printing = ref(false)
const printNo = ref('')
const printMsg = ref('')
const slipKind = computed(() => (isReturn.value ? 'OTHER_RET' : 'OTHER_PICK'))

// 退料兜底:库存里没有该物料时,仓库要手选
const warehouses = ref([])
const warehouseCode = ref('')

const current = computed(() => candidates.value[candIndex.value] || null)
const needWarehouse = computed(() => !!current.value && !current.value['仓库'] && !current.value['仓库编码'])
const canAdd = computed(() => {
  if (!current.value) return false
  if (needWarehouse.value && !warehouseCode.value) return false
  return checkQty(props.side, qty.value, Number(current.value['现存量'])).ok
})

onMounted(() => nextTick(() => scanInput.value?.focus?.()))

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
  'no-warehouse': tt('请选择退到哪个仓库'),
  'no-docno': tt('请扫描单据二维码或输入单号'),
}[reason] || '')

/** 扫/回车:解析码 → 按存货编码查 STOCK_PICK(批号级可用量) */
async function onScan() {
  errText.value = ''
  lastDoc.value = ''
  candidates.value = []
  candIndex.value = 0
  // 先认**单据二维码**(YJSLIP:…):扫错地方了也要能用 —— 扫单据码就当补打印
  if (parseSlipQr(scanText.value)) {
    printNo.value = scanText.value
    scanText.value = ''
    await reprint()
    return
  }
  const parsed = parseBarcode(scanText.value)
  if (!parsed.ok) {
    errText.value = reasonText(parsed.reason)
    return
  }
  probing.value = true
  try {
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
      qty.value = isReturn.value ? 1 : (Number(hits[0]['现存量']) || 1)
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
    warehouseCode.value = ''
  } catch (e) {
    errText.value = errMsg(e) || tt('查询可用量失败')
  } finally {
    probing.value = false
  }
}

/** 退料兜底态需要仓库下拉:仓库档案(WH)只拉一次 */
async function loadWarehouses() {
  if (warehouses.value.length) return
  try {
    const res = await queryFormDataList({ panelCode: 'WH', pageNo: 1, pageSize: 300 })
    warehouses.value = archiveRows(res, 'wh')
      .map((w) => ({ code: String(w['仓库编码'] || '').trim(), name: String(w['仓库名称'] || w['仓库编码'] || '').trim() }))
      .filter((w) => w.code)
  } catch {
    warehouses.value = []
  }
}

function addLine() {
  const c = current.value
  if (!c) return
  // 手选仓库时把它盖到候选项上(后续合键/落库都按这个仓)
  const cand = needWarehouse.value
    ? { ...c, 仓库编码: warehouseCode.value, 仓库: (warehouses.value.find((w) => w.code === warehouseCode.value) || {}).name || '' }
    : c
  if (needWarehouse.value && !cand['仓库编码']) {
    errText.value = reasonText('no-warehouse')
    return
  }
  const res = mergeLine(lines.value, cand, qty.value, props.side)
  if (!res.ok) {
    errText.value = reasonText(res.reason)
    return
  }
  lines.value = res.lines
  scanText.value = ''
  candidates.value = []
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
  errText.value = ''
  warehouseCode.value = ''
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

/** 补打印:扫码(优先按码里的种类)或手输单号(按当前页的种类) */
async function reprint() {
  const raw = String(printNo.value || '').trim()
  if (!raw) {
    errText.value = reasonText('no-docno')
    return
  }
  const slip = parseSlipQr(raw)
  const kind = slip?.kind || slipKind.value
  const no = slip?.docNo || raw
  await doPrint(kind, no, 'mobileOther.reprint')
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
.mo-scan { max-width: 900px; padding: 14px 16px 26px; }
.mo-head { margin-bottom: 12px; }
.mo-title { font-size: 18px; font-weight: 600; }
.mo-sub { margin-top: 4px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.mo-scanbar { margin-bottom: 12px; }
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
.mo-wh { display: flex; align-items: center; gap: 10px; padding: 12px; border-top: 1px solid var(--el-border-color-lighter); }
.mo-wh-sel { flex: 1; min-width: 0; }
.mo-qty { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--el-fill-color-lighter); }
.mo-qty-label { font-size: 13px; color: var(--el-text-color-regular); flex: none; }
.mo-qty-unit { font-size: 13px; color: var(--el-text-color-secondary); min-width: 24px; }
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
.mo-reprint { margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--el-border-color-lighter); }
.mo-reprint-hint { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); }
.mo-reprint-row { display: flex; gap: 10px; }
.mo-reprint-row :deep(.el-input) { flex: 1; }
.mo-print-msg { margin-top: 10px; }
@media (max-width: 480px) {
  .mo-qty { flex-wrap: wrap; }
  .mo-qty :deep(.el-input-number) { width: 120px; }
}
</style>
