<template>
  <!-- 自制料制程记录查询（2026-11-19 用户口径，《记录查询界面》）：
       条件 = 材料名 + 批次起止；结果列 = 主批次/子批次/流程卡/配料表/异常情况描述/录入人/录入日期。
       支持导出 Excel 与打印；每行可打印二维码（内容 = 材料名 + 主批次，交仓库入库用）。 -->
  <div class="smq-page">
    <header class="smq-head">
      <h1 class="smq-title">{{ tt('自制功能料制程记录查询') }}</h1>
    </header>

    <div class="smq-bar">
      <!-- 字段查询（2026-11-19 用户口径）：「查询可以根据字段内容进行查询，字段加入主批次、材料名」 -->
      <el-select v-model="q.field" class="smq-in-sm2" size="default" :placeholder="tt('字段')">
        <el-option v-for="f in FIELDS" :key="f" :label="tt(f)" :value="f" />
      </el-select>
      <el-input v-model="q.keyword" class="smq-in" clearable :placeholder="tt('关键字（片段）')" />
      <span class="smq-label">{{ tt('批次起止') }}</span>
      <el-input v-model="q.batchFrom" class="smq-in smq-in-sm" clearable :placeholder="tt('起')" />
      <span class="smq-dash">~</span>
      <el-input v-model="q.batchTo" class="smq-in smq-in-sm" clearable :placeholder="tt('止')" />
      <el-button type="primary" :loading="loading" @click="load">{{ tt('查询') }}</el-button>
      <el-button :disabled="!rows.length" @click="exportExcel">{{ tt('导出 Excel') }}</el-button>
    </div>

    <section v-if="denied" class="smq-card smq-denied">{{ tt('没有自制料面板的查看权限') }}</section>
    <section v-else class="smq-card">
      <!-- 合并单元格（2026-11-19 用户口径：「主批次合并，录入人、材料名、打印二维码合并」）：
         el-table 的 span-method 按「同一张单（单据编号）」把这几列纵向合并。 -->
      <el-table :data="rows" size="small" border max-height="560" v-loading="loading" :span-method="mergeSpan">
        <!-- 列序照 Excel《记录查询界面》：主批次 | 子批次 | 流程卡 | 配料表 | 异常 | 录入人，
             其后是本系统补充的 材料名 / 录入日期 / 二维码 -->
        <el-table-column prop="主批次" :label="tt('主批次')" width="130" />
        <el-table-column prop="子批次" :label="tt('子批次')" width="140" />
        <!-- 附件格可点开预览（2026-11-19 用户口径）：只读 FileAttachCell。
             附件清单由后端 selfmadeRows 统一解析（行 id 本单/跨单 → 序号 → 文件名 → 字段名单行兜底），
             前端不再自己猜锚点 —— 历史单据保存换号后，附件可能还挂在旧单号下。
             清单为空但列里存着文件名时，**保留文件名文本**（2026-11-20 用户报障：不能把已有信息藏成「—」），
             点击提示「仅记录文件名，原文件未入库」；真没有才显示「—」。 -->
        <el-table-column :label="tt('流程卡')" width="150">
          <template #default="{ row }">
            <FileAttachCell
              v-if="attachList(row, '流程卡').length" :panel-code="'RD_SELFMADE'" :doc-no="row['单据编号']"
              :field-key="row['明细id'] ? `流程卡-${row['明细id']}` : '流程卡'" :attachments="attachList(row, '流程卡')"
              :can-edit="false"
            />
            <span
              v-else-if="legacyText(row, '流程卡')" class="smq-file smq-legacy"
              @click="showLegacyOnly(row, '流程卡')"
            >{{ legacyText(row, '流程卡') }}</span>
            <span v-else class="smq-file">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="tt('配料表')" width="150">
          <template #default="{ row }">
            <FileAttachCell
              v-if="attachList(row, '配料表').length" :panel-code="'RD_SELFMADE'" :doc-no="row['单据编号']"
              :field-key="row['明细id'] ? `配料表-${row['明细id']}` : '配料表'" :attachments="attachList(row, '配料表')"
              :can-edit="false"
            />
            <span
              v-else-if="legacyText(row, '配料表')" class="smq-file smq-legacy"
              @click="showLegacyOnly(row, '配料表')"
            >{{ legacyText(row, '配料表') }}</span>
            <span v-else class="smq-file">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="异常情况描述" :label="tt('异常情况描述')" min-width="180" show-overflow-tooltip />
        <el-table-column prop="录入人" :label="tt('录入人')" width="100" />
        <el-table-column prop="材料名" :label="tt('材料名')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="录入日期" :label="tt('录入日期')" width="110" align="center" />
        <el-table-column :label="tt('二维码')" width="100" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showQr(row)">{{ tt('打印二维码') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="!loading && !rows.length" class="smq-empty">{{ tt('没有符合条件的记录') }}</p>
    </section>

    <el-dialog v-model="qr.open" :title="tt('二维码')" width="320px">
      <div class="smq-qr">
        <img v-if="qr.dataUrl" :src="qr.dataUrl" alt="QR" class="smq-qr-img" />
        <p class="smq-qr-text">{{ qr.text }}</p>
      </div>
      <template #footer>
        <el-button size="small" @click="qr.open = false">{{ tt('关闭') }}</el-button>
        <el-button size="small" type="primary" @click="printQr">{{ tt('打印') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import request from '@/core/request'
import QRCode from 'qrcode'
import FileAttachCell from '@/core/views/FileAttachCell.vue'

const rows = ref([])
const loading = ref(false)
const denied = ref(false)
const FIELDS = ['主批次', '材料名', '子批次', '异常情况描述', '录入人', '单据日期']
const q = reactive({ name: '', batchFrom: '', batchTo: '', field: '主批次', keyword: '' })
const qr = reactive({ open: false, dataUrl: '', text: '' })

/**
 * 查询页附件清单（后端 selfmadeRows 已按「行 id 本单/跨单 → 序号 → 文件名 → 字段名」解析好）。
 * 键 = 字段名 + '附件'；没有清单时返回空数组。
 */
function attachList(row, field) {
  const list = row?.[`${field}附件`]
  return Array.isArray(list) ? list : []
}
/**
 * 列里存的文件名文本（2026-11-20 用户报障）：
 * 附件行没解析出来时，**不能把列里已有的文件名也藏成「—」** —— 保留文本至少让人知道上传过什么；
 * 点击由 showLegacyOnly 提示「仅记录文件名，原文件未入库」。
 */
function legacyText(row, field) {
  if (attachList(row, field).length) return ''
  return String(row?.[field] || '').trim()
}
/** legacy 文本点击：说明只有文件名、原文件没入库（不假装能预览） */
function showLegacyOnly(row, field) {
  const names = legacyText(row, field)
  ElMessageBox.alert(
    `${tt('仅记录文件名，原文件未入库')}：${names}`,
    tt('提示'),
    { type: 'info', confirmButtonText: tt('知道了') },
  )
}
/** 导出/展示用：优先用解析出的真实附件名，旧数据没有清单时退回表内文件名串 */
function fileNamesOf(row, field) {
  const names = attachList(row, field).map((a) => a?.fileName).filter(Boolean).join('、')
  return names || String(row?.[field] || '')
}

/** 合并列（索引按当前列序）：0 主批次 / 5 录入人 / 6 材料名 / 8 二维码 */
const MERGE_COLS = [0, 5, 6, 8]
/** 按「单据编号」把行分组（一张单 = 一个主批次），得到每组的首行下标 → 行数 */
const groupSpans = computed(() => {
  const map = {}
  rows.value.forEach((r, i) => {
    const k = String(r['单据编号'] || '') + '|' + String(r['主批次'] || '') + '|' + String(r['材料名'] || '')
    if (!map[k]) map[k] = { start: i, count: 0 }
    map[k].count += 1
  })
  const startOf = {}
  const countOf = {}
  Object.values(map).forEach((g) => { startOf[g.start] = g.count; countOf[g.start] = g.count })
  return { startOf, countOf }
})
function mergeSpan({ rowIndex, columnIndex }) {
  if (!MERGE_COLS.includes(columnIndex)) return [1, 1]
  const { startOf, countOf } = groupSpans.value
  const count = countOf[rowIndex]
  if (!count) return [0, 0]              // 非组首行：隐藏该格（被上一行的 rowspan 覆盖）
  return [count, 1]
}

async function load() {
  loading.value = true
  denied.value = false
  try {
    const res = await request.get('/px/selfmadeQuery', { params: { name: q.name, batchFrom: q.batchFrom, batchTo: q.batchTo, field: q.field, keyword: q.keyword } })
    rows.value = Array.isArray(res?.data) ? res.data : []
  } catch (e) {
    denied.value = true
    rows.value = []
  } finally {
    loading.value = false
  }
}

async function exportExcel() {
  const XLSX = await import('xlsx')
  const aoa = [[tt('主批次'), tt('子批次'), tt('材料名'), tt('流程卡'), tt('配料表'), tt('异常情况描述'), tt('录入人'), tt('录入日期')]]
  for (const r of rows.value) {
    aoa.push([r['主批次'] || '', r['子批次'] || '', r['材料名'] || '', fileNamesOf(r, '流程卡'), fileNamesOf(r, '配料表'), r['异常情况描述'] || '', r['录入人'] || '', r['录入日期'] || ''])
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '自制料制程记录')
  XLSX.writeFile(wb, `自制料制程记录-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/** 二维码内容 = 材料名 + 主批次（用户口径：「二维码是由材料名和主批次号生成」） */
async function showQr(row) {
  const text = `${row['材料名'] || ''} ${row['主批次'] || ''}`.trim()
  qr.text = text
  qr.dataUrl = await QRCode.toDataURL(text, { width: 240, margin: 1 })
  qr.open = true
}

function printQr() {
  const w = window.open('', '_blank', 'width=420,height=520')
  if (!w) return
  w.document.write(`<html><head><title>QR</title></head><body style="text-align:center;font-family:sans-serif">
    <img src="${qr.dataUrl}" style="width:240px"/><div style="margin-top:8px;font-size:14px">${qr.text}</div>
    </body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

onMounted(load)
</script>

<style scoped>
.smq-page { padding: 16px; }
.smq-title { margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #222; }
.smq-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.smq-label { font-size: 13px; color: #606266; }
.smq-in { width: 200px; }
.smq-in-sm { width: 110px; }
.smq-in-sm2 { width: 130px; }
.smq-dash { color: #909399; }
.smq-card { border: 1px solid #f0f0f0; border-radius: 6px; padding: 12px; }
.smq-denied { padding: 24px; text-align: center; color: #909399; }
.smq-empty { margin: 16px 0 0; text-align: center; color: #909399; font-size: 13px; }
.smq-file { font-size: 12px; color: #909399; }
/* legacy 文件名：可点，但只给提示（原文件没入库，不能假装可预览） */
.smq-legacy { color: #1d6fd1; cursor: pointer; text-decoration: underline dotted; word-break: break-all; }
.smq-legacy:hover { color: #0a58ca; }
.smq-qr { text-align: center; }
.smq-qr-img { width: 200px; height: 200px; }
.smq-qr-text { margin: 8px 0 0; font-size: 13px; color: #222; }
</style>
