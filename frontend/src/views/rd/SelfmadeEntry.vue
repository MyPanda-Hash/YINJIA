<template>
  <!-- 自制料·制程记录录入（2026-11-19 用户口径：版式照 Excel —— **横行表**）：
       一行 = 一个子批次；材料名 / 主批次 / 录入人 三列在左侧**纵向合并**（rowspan），
       与《新建 XLS 工作表.xls》的「制程记录录入」页签一致。
       子批次自动 = 主批次-N（1~10 行）；流程卡/配料表为附件格（图片或文件，可点开）；
       无审批、可修改。保存后可用「打印二维码」（内容 = 材料名 + 主批次）。 -->
  <div class="sme-page">
    <div class="sme-top">
      <div class="sme-bar">
        <el-input v-model="head['单据编号']" class="sme-no" readonly size="small" placeholder="单据编号" />
        <el-date-picker v-model="head['单据日期']" type="date" value-format="YYYY-MM-DD" size="small" class="sme-date" :clearable="false" />
        <el-button size="small" @click="createNew">{{ tt('新增') }}</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="save">{{ tt('保存') }}</el-button>
        <el-button size="small" :disabled="!head['单据编号']" @click="removeDoc">{{ tt('删除') }}</el-button>
        <span class="sme-tip">{{ tt('子批次自动生成，最少 1 行最多 10 行') }}</span>
      </div>
      <!-- 二维码（2026-11-19 用户口径：「二维码位置就放在录入人上边也就是右上角」）：
           内容 = 材料名 + 主批次；材料名/主批次一填就自动生成，也可点「生成二维码」刷新；
           保存后可打印，交仓库入库。 -->
      <div class="sme-qrbox">
        <div class="sme-qr-title">{{ tt('二维码（材料名+主批次）') }}</div>
        <img v-if="qr.dataUrl" :src="qr.dataUrl" class="sme-qr-img" alt="QR" />
        <div v-else class="sme-qr-empty">{{ tt('填材料名和主批次后自动生成') }}</div>
        <div class="sme-qr-text">{{ qrText || '—' }}</div>
        <div class="sme-qr-ops">
          <el-button size="small" link type="primary" @click="makeQr">{{ tt('生成二维码') }}</el-button>
          <el-button size="small" link type="primary" :disabled="!qr.dataUrl" @click="printQr">{{ tt('打印') }}</el-button>
        </div>
      </div>
    </div>

    <table class="sme-table">
      <colgroup>
        <col style="width:150px"><col style="width:120px"><col style="width:130px">
        <col style="width:220px"><col style="width:200px"><col><col style="width:110px">
      </colgroup>
      <thead>
        <tr>
          <th>{{ tt('材料名') }}</th><th>{{ tt('主批次') }}</th><th>{{ tt('子批次') }}</th>
          <th>{{ tt('流程卡') }}</th><th>{{ tt('配料表') }}</th><th>{{ tt('异常情况描述') }}</th><th>{{ tt('录入人') }}</th>
          <!-- 第 8 列 = 删行按钮位（Excel 没有这一列，但录入需要；留窄列让表头与表体对齐） -->
          <th class="sme-op"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="row.__k">
          <!-- 左侧三列合并（与 Excel 一致：一张单一个材料/主批次/录入人） -->
          <td v-if="i === 0" :rowspan="rows.length" class="sme-merge">
            <el-input v-model="head['材料名']" size="small" :placeholder="tt('如 BK1-D/10')" @input="renumber" />
          </td>
          <td v-if="i === 0" :rowspan="rows.length" class="sme-merge">
            <el-input v-model="head['主批次']" size="small" :placeholder="tt('如 261025')" @input="renumber" />
          </td>
          <td class="sme-sub">{{ row['子批次'] }}</td>
          <td>
            <FileAttachCell
              v-if="row.id && head['单据编号']" :panel-code="'RD_SELFMADE'" :doc-no="head['单据编号']"
              :field-key="`流程卡-${row.id}`" :model-value="String(row['流程卡'] || '')"
              hide-when-empty @update:model-value="(v) => { row['流程卡'] = v }"
            />
            <span v-else class="sme-hint">{{ tt('保存后可上传') }}</span>
          </td>
          <td>
            <FileAttachCell
              v-if="row.id && head['单据编号']" :panel-code="'RD_SELFMADE'" :doc-no="head['单据编号']"
              :field-key="`配料表-${row.id}`" :model-value="String(row['配料表'] || '')"
              hide-when-empty @update:model-value="(v) => { row['配料表'] = v }"
            />
            <span v-else class="sme-hint">{{ tt('保存后可上传') }}</span>
          </td>
          <td><el-input v-model="row['异常情况描述']" size="small" type="textarea" :rows="1" :maxlength="1000" /></td>
          <td v-if="i === 0" :rowspan="rows.length" class="sme-merge">
            <el-input v-model="head['录入人']" size="small" />
          </td>
          <td v-if="rows.length > 1" class="sme-op"><span class="sme-del no-print" @click="removeRow(i)">✕</span></td>
        </tr>
      </tbody>
    </table>
    <div class="sme-add no-print" @click="addRow">＋ {{ tt('新增子批次') }}（{{ rows.length }} / 10）</div>

  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import request from '@/core/request'
import FileAttachCell from '@/core/views/FileAttachCell.vue'
import QRCode from 'qrcode'

const head = reactive({ 单据编号: '', 单据日期: new Date().toISOString().slice(0, 10), 材料名: '', 主批次: '', 录入人: '练庆文' })
const rows = ref([])
const saving = ref(false)
const qr = reactive({ dataUrl: '', text: '' })
let seq = 0
const newRow = () => ({ __k: ++seq, id: null, 序号: '', 子批次: '', 流程卡: '', 配料表: '', 异常情况描述: '' })

/** 子批次由行序推导：主批次-N（用户口径：自动生成，不手填） */
function renumber() {
  const base = String(head['主批次'] || '').trim()
  rows.value.forEach((r, i) => { r['序号'] = String(i + 1); r['子批次'] = base ? `${base}-${i + 1}` : String(i + 1) })
}

function addRow() {
  if (rows.value.length >= 10) { ElMessage.warning(tt('子批次最多 10 个')); return }
  rows.value.push(newRow()); renumber()
}
function removeRow(i) { rows.value.splice(i, 1); if (!rows.value.length) addRow(); renumber() }

async function load(no) {
  const res = await request.post('/px/queryFormDataList', { panelCode: 'RD_SELFMADE', keyword: no || '', pageNo: 1, pageSize: 1 })
  const row = ((res?.data?.list) || [])[0]
  if (!row) { rows.value = []; addRow(); return false }
  head['单据编号'] = row['单据编号'] || ''
  head['单据日期'] = row['单据日期'] || head['单据日期']
  head['材料名'] = row['材料名'] || ''
  head['主批次'] = row['主批次'] || ''
  head['录入人'] = row['录入人'] || '练庆文'
  const items = (row.detail && row.detail.items) || []
  rows.value = items.length
    ? items.map((it) => ({ ...newRow(), ...it, __k: ++seq }))
    : [newRow()]
  renumber()
  return true
}

async function createNew() {
  try {
    const res = await request.post('/px/callButton', { panelCode: 'RD_SELFMADE', buttonName: '新增', formData: {}, buttonParam: {} })
    const no = res?.data?.编号 || res?.data?.单据编号 || ''
    await load(no)
  } catch (e) { ElMessage.error(tt('新增失败：') + (e?.response?.data?.message || e?.message || '')) }
}

async function save() {
  if (!String(head['材料名'] || '').trim()) { ElMessage.warning(tt('请先填写材料名')); return }
  if (!String(head['主批次'] || '').trim()) { ElMessage.warning(tt('请先填写主批次')); return }
  saving.value = true
  try {
    const payload = { ...head, detail: { items: rows.value.map((r) => ({ id: r.id ?? undefined, 序号: r['序号'], 子批次: r['子批次'], 流程卡: r['流程卡'] || '', 配料表: r['配料表'] || '', 异常情况描述: r['异常情况描述'] || '' })) } }
    const res = await request.post('/px/callButton', { panelCode: 'RD_SELFMADE', buttonName: '保存', formData: payload, buttonParam: {} })
    const no = res?.data?.编号 || head['单据编号']
    await load(no)   // 重新拉取拿回行 id（附件格要靠 id 做锚点）
    ElMessage.success(tt('已保存'))
  } catch (e) {
    ElMessage.error(tt('保存失败：') + (e?.response?.data?.message || e?.message || ''))
  } finally { saving.value = false }
}

async function removeDoc() {
  try { await ElMessageBox.confirm(tt('确定删除这张单吗？'), tt('删除确认'), { type: 'warning' }) } catch (e) { return }
  try {
    await request.post('/px/callButton', { panelCode: 'RD_SELFMADE', buttonName: '删除', formData: { 编号: head['单据编号'] }, buttonParam: {} })
    ElMessage.success(tt('已删除')); await createNew()
  } catch (e) { ElMessage.error(tt('删除失败：') + (e?.response?.data?.message || e?.message || '')) }
}

/** 二维码文本 = 材料名 + 主批次（用户口径） */
const qrText = computed(() => `${head['材料名'] || ''} ${head['主批次'] || ''}`.trim())

/** 生成/刷新二维码（材料名 + 主批次都填了才有意义） */
async function makeQr() {
  const text = qrText.value
  qr.text = text
  if (!text) { qr.dataUrl = ''; return }
  qr.dataUrl = await QRCode.toDataURL(text, { width: 240, margin: 1 })
}

// 材料名/主批次一变就自动重生成（用户要求"生成二维码的功能"，这里做到不用手点也对）
watch(qrText, () => { makeQr() })
function printQr() {
  const w = window.open('', '_blank', 'width=420,height=520'); if (!w) return
  w.document.write(`<html><body style="text-align:center;font-family:sans-serif"><img src="${qr.dataUrl}" style="width:240px"/><div style="margin-top:8px">${qr.text}</div></body></html>`)
  w.document.close(); w.focus(); w.print()
}

onMounted(async () => {
  const any = await load('')
  if (!any) rows.value = [newRow()]
  renumber()
})
</script>

<style scoped>
.sme-page { padding: 16px; background: #fff; }
.sme-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.sme-qrbox { width: 152px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 8px; text-align: center; flex: none; }
.sme-qr-title { font-size: 11px; color: #606266; margin-bottom: 3px; }
.sme-qrbox .sme-qr-img { width: 112px; height: 112px; }
.sme-qr-empty { width: 112px; height: 112px; margin: 0 auto; display: flex; align-items: center; justify-content: center; border: 1px dashed #dcdfe6; border-radius: 4px; color: #bfbfbf; font-size: 12px; padding: 8px; }
.sme-qr-text { font-size: 12px; color: #222; margin-top: 4px; word-break: break-all; }
.sme-qr-ops { margin-top: 2px; }
.sme-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.sme-no { width: 190px; } .sme-date { width: 150px; }
.sme-tip { font-size: 12px; color: #909399; }
.sme-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.sme-table th, .sme-table td { border: 1px solid #8a8a8a; padding: 4px 6px; font-size: 13px; vertical-align: middle; }
.sme-table th { background: #f2f4f6; font-weight: 600; }
.sme-merge { background: #fafafa; vertical-align: top; }
.sme-merge :deep(.el-input) { width: 100%; }
.sme-sub { text-align: center; color: #222; }
.sme-hint { font-size: 12px; color: #bfbfbf; }
.sme-op { width: 34px; text-align: center; }
.sme-del { color: #c45656; cursor: pointer; }
.sme-add { margin-top: 6px; border: 1px dashed #b7d2ee; background: #fbfdff; color: #2b6cb0; text-align: center; padding: 8px; cursor: pointer; font-size: 13px; }
.sme-qr { text-align: center; } .sme-qr-img { width: 200px; height: 200px; }
</style>
