<!--
  MobileReturnList.vue — 手机扫码 · 生产退料(2026-11-18 独立成页)

  【用户口径(原话)】
  「我还想生产退料独立出来,就是已经领料且审核的领料单据,来扫码退料。其实就是独立出来一个面版,
   让生产领料不用负责那么多功能,操作也方便。」

  ⇒ 本页 = 生产领料的退料部分**整块搬出来**:
    ① 上面列出「已完成 + 材料出库单已审核」的领料单(没审批的不能退:库存还没扣,退了等于凭空加库存);
    ② 选中一张 → 扫物料码 → 看这一项还能退多少(= 已领 − 已退)→ 填数量 → 加入本次退料清单;
    ③ 提交 → 生成一张**生产退料单**(业务类型「生产退料」)。

  数据全部走既有接口(/px/mobilePick/returnables、returnScan、submitReturn),
  本页只负责把"查单 → 扫码 → 提交"这条动线摆顺,不重复实现退料规则。

  ⚠ 生产领料单据页里的退料入口已同时删除 —— 退料只有这一个入口,现场不用再记"去哪退"。
-->
<template>
  <div class="mr">
    <div class="mr-head">
      <span class="mr-title">{{ tt('生产退料') }}</span>
      <span class="mr-sub">{{ tt('只列已领料且材料出库单已审核的单据；扫物料码 → 填退料数量 → 提交生成生产退料单') }}</span>
    </div>

    <div v-if="errText" class="mr-err">{{ errText }}</div>
    <div v-if="okText" class="mr-ok">{{ okText }}</div>

    <!-- ① 可退单据列表 -->
    <section class="mr-card">
      <div class="mr-sec">
        <span>{{ tt('可退单据') }}</span>
        <span class="mr-sec-num">{{ list.length }}</span>
        <el-button text size="small" class="mr-refresh" :loading="loading" @click="load">{{ tt('刷新') }}</el-button>
      </div>
      <div class="mr-row">
        <el-input
          v-model="keyword"
          :placeholder="tt('领料单号 / 工单号 / 产品名称')"
          size="large"
          clearable
          @keyup.enter="load"
        />
        <el-button type="primary" size="large" :loading="loading" @click="load">{{ tt('查询') }}</el-button>
      </div>

      <div v-if="!list.length" class="mr-empty">{{ tt('没有可退的领料单（需要先领料、且材料出库单被仓管审核）') }}</div>
      <div
        v-for="d in list"
        :key="d.id"
        class="mr-doc"
        :class="{ 'is-cur': cur && cur.id === d.id }"
        @click="select(d)"
      >
        <div class="mr-doc-l1">
          <span class="mr-doc-no mono">{{ d.领料单号 }}</span>
          <span class="mr-tag">{{ tt(d.领料类型 || '组装') }}</span>
          <span class="mr-doc-can num">{{ tt('可退') }} {{ fmtQty(d.可退数量) }}</span>
        </div>
        <div class="mr-doc-l2">
          <span>{{ d.工单号 }}<i v-if="d.工单行号"> #{{ d.工单行号 }}</i></span>
          <span>{{ d.产品名称 || d.产品编号 || '—' }}</span>
        </div>
        <div class="mr-doc-l3">
          <span>{{ tt('已领') }} {{ fmtQty(d.已领数量) }}</span>
          <span>{{ tt('已退') }} {{ fmtQty(d.已退数量) }}</span>
          <span>{{ tt('可退项数') }} {{ d.可退项数 || 0 }}</span>
          <!-- 显式按钮:手机上比"整行点"更好按,也避免整行点击被内部元素吃掉 -->
          <el-button text size="small" class="mr-pick" type="primary" @click.stop="select(d)">
            {{ cur && cur.id === d.id ? tt('已选中') : tt('选这张退料') }}
          </el-button>
        </div>
      </div>
    </section>

    <!-- ② 退料作业 -->
    <section v-if="cur" class="mr-card">
      <div class="mr-sec">
        <span>{{ tt('退料作业') }}</span>
        <span class="mr-cur-no mono">{{ cur.领料单号 }}</span>
      </div>

      <div class="mr-row">
        <el-input
          v-model="matText"
          :placeholder="tt('扫物料码或输入物料编码')"
          size="large"
          clearable
          @keyup.enter="scan"
        />
        <el-button size="large" :loading="scanning" @click="scan">{{ tt('查询') }}</el-button>
      </div>

      <div v-if="mat" class="mr-mat">
        <div class="mr-mat-main">
          <div class="mr-mat-name">{{ mat.名称 || mat.编码 }}</div>
          <div class="mr-mat-meta">
            {{ mat.编码 }} · {{ mat.规格 || '—' }} · {{ mat.单位 || '—' }}
            · {{ tt('已领') }} {{ fmtQty(mat.已领数量) }} / {{ tt('已退') }} {{ fmtQty(mat.已退数量) }}
          </div>
        </div>
        <div class="mr-mat-can">
          <b class="num">{{ fmtQty(mat.可退数量) }}</b>
          <span>{{ tt('本次可退') }}</span>
        </div>
      </div>

      <div v-if="mat" class="mr-qty">
        <span class="mr-qty-lab">{{ tt('退料数量') }}</span>
        <el-input-number v-model="qty" :min="0" :max="Number(mat.可退数量) || 0" :precision="4" :step="1" size="large" />
        <span class="mr-qty-unit">{{ mat.单位 || '' }}</span>
        <el-button type="primary" size="large" :disabled="!canAdd" @click="addLine">{{ tt('加入本次退料') }}</el-button>
      </div>

      <div class="mr-lines">
        <div class="mr-lines-head">
          <span>{{ tt('本次退料') }}</span>
          <span class="mr-sec-num">{{ lines.length }}</span>
        </div>
        <div v-if="!lines.length" class="mr-empty">{{ tt('还没有扫码加入的物料') }}</div>
        <div v-for="(l, i) in lines" :key="l.code" class="mr-line">
          <div class="mr-line-main">
            <span class="mr-line-name">{{ l.name || l.code }}</span>
            <span class="mr-line-meta">{{ l.code }} · {{ l.spec || '—' }}</span>
          </div>
          <span class="mr-line-qty num">-{{ fmtQty(l.qty) }} {{ l.unit }}</span>
          <el-button text type="danger" size="small" @click="removeLine(i)">{{ tt('移除') }}</el-button>
        </div>
      </div>

      <div class="mr-foot">
        <el-button size="large" @click="resetWork">{{ tt('清空') }}</el-button>
        <el-button type="warning" size="large" :loading="submitting" :disabled="!lines.length" @click="submit">
          {{ tt('提交退料') }}
        </el-button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import request from '@core/request'
import { fmtQty, round4 } from '@/business/mobilePick'

const route = useRoute()

const loading = ref(false)
const scanning = ref(false)
const submitting = ref(false)
const errText = ref('')
const okText = ref('')

const keyword = ref('')
const list = ref([])
const cur = ref(null)          // 选中的领料单(台账行)
const matText = ref('')
const mat = ref(null)          // 扫到的物料(可退量等)
const qty = ref(0)
const lines = ref([])          // 本次要退的 [{code,name,spec,unit,qty,can}]

const canAdd = computed(() => {
  if (!mat.value) return false
  const n = round4(qty.value)
  return n > 0 && n <= round4(Number(mat.value.可退数量) || 0)
})

const errMsgOf = (e) => e?.response?.data?.message || e?.message || ''
function clearMsg() { errText.value = ''; okText.value = '' }

/** 可退单据(已完成 + 材料出库单已审核) */
async function load() {
  loading.value = true
  clearMsg()
  try {
    const res = await request.get('/px/mobilePick/returnables', { params: { keyword: keyword.value.trim() } })
    const d = res.data?.data || res.data || {}
    list.value = Array.isArray(d.list) ? d.list : []
    // 选中的那张如果已经不在列表里(退完/被作废),清掉作业区
    if (cur.value && !list.value.some((x) => x.id === cur.value.id)) resetWork()
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询可退单据失败')
  } finally {
    loading.value = false
  }
}

function select(d) {
  if (cur.value && cur.value.id === d.id) return
  // ⚠ must keep the doc: resetWork(false) clears cur —— 早先这里传了 false,
  //   结果点行后作业区根本不出现(2026-11-18 实测)。
  cur.value = d
  resetWork(true)
}

/** 清空作业区(keepDoc=false 时连选中的单据一起清) */
function resetWork(keepDoc = true) {
  matText.value = ''
  mat.value = null
  qty.value = 0
  lines.value = []
  errText.value = ''
  okText.value = ''
  if (!keepDoc) cur.value = null
}

/** 扫物料码:后端按「已领 − 已退」算本次可退 */
async function scan() {
  clearMsg()
  mat.value = null
  const code = String(matText.value || '').trim()
  if (!code) { errText.value = tt('请先扫描或输入物料编码'); return }
  scanning.value = true
  try {
    const res = await request.post('/px/mobilePick/returnScan', { id: cur.value.id, code })
    const d = res.data?.data || res.data || {}
    mat.value = d
    qty.value = Number(d.可退数量) || 0
  } catch (e) {
    errText.value = errMsgOf(e) || tt('查询可退数量失败')
  } finally {
    scanning.value = false
  }
}

function addLine() {
  if (!canAdd.value || !mat.value) return
  const code = String(mat.value.编码 || '').trim()
  const n = round4(qty.value)
  const exist = lines.value.find((l) => l.code === code)
  if (exist) {
    const total = round4(exist.qty + n)
    if (total > round4(Number(mat.value.可退数量) || 0)) { errText.value = tt('超过可退数量'); return }
    lines.value = lines.value.map((l) => (l.code === code ? { ...l, qty: total } : l))
  } else {
    lines.value = [...lines.value, {
      code, name: mat.value.名称, spec: mat.value.规格, unit: mat.value.单位, qty: n,
    }]
  }
  matText.value = ''
  mat.value = null
  qty.value = 0
}

function removeLine(i) {
  const next = lines.value.slice()
  next.splice(i, 1)
  lines.value = next
}

/** 提交:一张退料单可以一次退多项 */
async function submit() {
  if (!lines.value.length || !cur.value) return
  const total = lines.value.reduce((s, l) => s + round4(l.qty), 0)
  try {
    await ElMessageBox.confirm(
      `${tt('将退')} ${lines.value.length} ${tt('项物料,合计')} ${fmtQty(total)}。${tt('提交后生成一张生产退料单并入库,库存会增加。确定提交?')}`,
      tt('退料确认'),
      { confirmButtonText: tt('确定退料'), cancelButtonText: tt('取消'), type: 'warning' },
    )
  } catch { return }
  submitting.value = true
  clearMsg()
  try {
    const res = await request.post('/px/mobilePick/submitReturn', {
      id: cur.value.id,
      items: lines.value.map((l) => ({ code: l.code, qty: round4(l.qty) })),
    })
    const d = res.data?.data || res.data || {}
    const no = String(d.退料单号 || '').trim()
    okText.value = `${tt('退料成功')}${no ? '：' + no : ''}`
    ElMessage.success(okText.value)
    resetWork()
    await load()
  } catch (e) {
    errText.value = errMsgOf(e) || tt('退料失败')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  // 从「生产领料」单据页跳过来时带 ?no=领料单号 ⇒ 直接把那张单查出来并选中
  const no = String(route.query.no || '').trim()
  if (no) keyword.value = no
  await load()
  if (no) {
    const hit = list.value.find((d) => String(d.领料单号 || '').trim() === no)
    if (hit) select(hit)
  }
})
</script>

<style scoped>
.mr { max-width: 900px; padding: 14px 16px 26px; }
.mr-head { margin-bottom: 12px; }
.mr-title { font-size: 18px; font-weight: 600; }
.mr-sub { display: block; margin-top: 4px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.mr-err, .mr-ok { margin-bottom: 10px; padding: 8px 10px; border-radius: 4px; font-size: 13px; }
.mr-err { color: var(--el-color-danger); background: var(--el-color-danger-light-9); }
.mr-ok { color: var(--el-color-success); background: var(--el-color-success-light-9); }
.mr-card { border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; }
.mr-sec { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 8px; }
.mr-sec-num { display: inline-block; min-width: 20px; text-align: center; padding: 0 6px; border-radius: 10px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; }
.mr-refresh { margin-left: auto; }
.mr-row { display: flex; gap: 10px; }
.mr-row :deep(.el-input) { flex: 1; }
.mr-empty { padding: 16px 0; text-align: center; font-size: 13px; color: var(--el-text-color-secondary); }
.mr-doc { padding: 9px 8px; border-bottom: 1px dashed var(--el-border-color-lighter); border-radius: 4px; cursor: pointer; }
.mr-doc:hover { background: var(--el-fill-color-lighter); }
.mr-doc.is-cur { background: var(--el-color-primary-light-9); }
.mr-doc-l1 { display: flex; align-items: center; gap: 8px; }
.mr-doc-no { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.mr-tag { padding: 0 6px; border-radius: 8px; font-size: 11px; background: var(--el-fill-color); color: var(--el-text-color-regular); }
.mr-doc-can { margin-left: auto; font-size: 13px; color: var(--el-color-warning); }
.mr-doc-l2, .mr-doc-l3 { margin-top: 3px; display: flex; gap: 12px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mr-cur-no { font-size: 13px; color: var(--el-text-color-regular); }
.mr-mat { display: flex; align-items: center; gap: 12px; margin-top: 10px; padding: 8px 10px; background: var(--el-fill-color-lighter); border-radius: 4px; }
.mr-mat-main { flex: 1; min-width: 0; }
.mr-mat-name { font-size: 14px; font-weight: 500; }
.mr-mat-meta { margin-top: 2px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mr-mat-can { text-align: right; flex: none; }
.mr-mat-can b { font-size: 20px; color: var(--el-color-warning); }
.mr-mat-can span { display: block; font-size: 11px; color: var(--el-text-color-secondary); }
.mr-qty { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.mr-qty-lab { font-size: 13px; color: var(--el-text-color-regular); flex: none; }
.mr-qty-unit { font-size: 13px; color: var(--el-text-color-secondary); min-width: 24px; }
.mr-lines { margin-top: 14px; }
.mr-lines-head { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 6px; }
.mr-line { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px dashed var(--el-border-color-lighter); }
.mr-line-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mr-line-name { font-size: 14px; }
.mr-line-meta { font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all; }
.mr-line-qty { font-size: 14px; color: var(--el-color-warning); font-variant-numeric: tabular-nums; }
.mr-foot { display: flex; gap: 10px; margin-top: 14px; }
.mr-foot :deep(.el-button) { flex: 1; }
@media (max-width: 480px) {
  .mr-qty { flex-wrap: wrap; }
  .mr-qty :deep(.el-input-number) { width: 120px; }
}
</style>
