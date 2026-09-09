<template>
  <el-dialog v-model="visibleModel" :title="tt('材料二维码标签')" width="720px" append-to-body class="qr-label-dlg" @opened="renderQr">
    <div class="qr-label-toolbar">
      <span class="qr-label-tip">{{ tt('二维码 = 物料编码|批号（扫描后可解析出入库与追溯信息），每行物料一张标签') }}</span>
      <el-button size="small" type="primary" @click="print">{{ tt('打印') }}</el-button>
    </div>
    <div class="qr-label-grid" ref="gridRef">
      <div v-for="(lb, i) in labels" :key="i" class="qr-label-card">
        <img v-if="lb.qr" :src="lb.qr" class="qr-label-img" />
        <div class="qr-label-info">
          <div class="qr-label-line strong">{{ lb.code }}</div>
          <div class="qr-label-line">{{ lb.name }}</div>
          <div v-if="lb.lot" class="qr-label-line">LOT {{ lb.lot }}</div>
          <div class="qr-label-line dim">{{ lb.qty }} {{ lb.unit }} · {{ lb.doc }}</div>
        </div>
      </div>
      <div v-if="!labels.length" class="qr-label-empty">{{ tt('当前单据没有可打印的明细行（或行缺少批号，请先保存）') }}</div>
    </div>
  </el-dialog>
</template>

<script setup>
/**
 * QrLabelDialog — 材料二维码标签打印(品检分流链 #3)
 * 数据源:暂收单明细行(物料编码/名称/批号/数量/单位);二维码内容 = `物料编码|批号`。
 * 打印:对话框内打印样式(@media print 只显示标签网格),调用 window.print()。
 */
import { ref, computed } from 'vue'
import { ElDialog, ElButton } from 'element-plus'
import QRCode from 'qrcode'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: Boolean,
  /** [{code, name, lot, qty, unit, doc}] */
  labels: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])
const visibleModel = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const gridRef = ref(null)

async function renderQr() {
  for (const lb of props.labels) {
    if (!lb.qr && lb.code) {
      const text = lb.lot ? `${lb.code}|${lb.lot}` : String(lb.code)
      try { lb.qr = await QRCode.toDataURL(text, { width: 160, margin: 1, errorCorrectionLevel: 'M' }) }
      catch { /* 单张失败不影响其余 */ }
    }
  }
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function print() {
  const cards = props.labels.filter((l) => l.qr).map((l) => `<div class="card"><img src="${l.qr}"/>
    <div class="info"><div class="l strong">${esc(l.code)}</div><div class="l">${esc(l.name)}</div>
    <div class="l">LOT ${esc(l.lot)}</div><div class="l dim">${esc(l.qty)} ${esc(l.unit)} · ${esc(l.doc)}</div></div></div>`).join('')
  const w = window.open('', '_blank', 'width=820,height=640')
  if (!w) return
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>材料二维码标签</title><style>'
    + 'body{font-family:system-ui,"Microsoft YaHei",sans-serif;margin:14px;color:#222}'
    + '.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}'
    + '.card{display:flex;gap:10px;padding:8px;border:1px solid #999;border-radius:4px;page-break-inside:avoid;break-inside:avoid}'
    + '.card img{width:84px;height:84px}'
    + '.info{display:flex;flex-direction:column;justify-content:center;min-width:0}'
    + '.l{font-size:12px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.strong{font-weight:600;font-size:14px}.dim{color:#666}'
    + '@page{margin:8mm}'
    + '</style></head><body><div class="grid">' + cards + '</div>'
    + '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print()},150)}</scr' + 'ipt></body></html>')
  w.document.close()
}
</script>

<style scoped>
.qr-label-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.qr-label-tip { color: var(--el-text-color-secondary); font-size: 12px; }
.qr-label-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; max-height: 60vh; overflow: auto; }
.qr-label-card { display: flex; gap: 10px; padding: 8px; border: 1px solid var(--el-border-color); border-radius: 4px; }
.qr-label-img { width: 84px; height: 84px; }
.qr-label-info { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-width: 0; }
.qr-label-line { font-size: 12px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qr-label-line.strong { font-weight: 600; font-size: 14px; }
.qr-label-line.dim { color: var(--el-text-color-secondary); }
.qr-label-empty { grid-column: 1 / -1; color: var(--el-text-color-secondary); padding: 24px; text-align: center; }
</style>
