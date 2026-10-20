<template>
  <el-dialog v-model="visibleModel" :title="props.title || tt('材料二维码标签')" width="720px" append-to-body class="qr-label-dlg" @opened="renderQr">
    <div class="qr-label-toolbar">
      <span class="qr-label-tip">{{ props.tip || tt('二维码 = 物料编码|批号@数量（扫描后可解析出入库与追溯信息），每行物料一张标签') }}</span>
      <el-button size="small" type="primary" @click="print">{{ tt('打印') }}</el-button>
    </div>
    <div class="qr-label-grid" ref="gridRef">
      <div v-for="(lb, i) in labels" :key="i" class="qr-label-card">
        <img v-if="lb.qr" :src="lb.qr" class="qr-label-img" />
        <div class="qr-label-info">
          <div class="qr-label-line strong">{{ lb.code }}</div>
          <div class="qr-label-line">{{ lb.name }}</div>
          <div v-if="lb.lot" class="qr-label-line">LOT {{ lb.lot }}</div>
          <!-- 仓库/供应商/仓位(2026-10-18):**有值才显示** —— 半成品三者皆无、成品无供应商、材料无仓位(实测全空) -->
          <div v-if="lb.warehouse" class="qr-label-line">{{ tt('仓库') }} {{ lb.warehouse }}</div>
          <div v-if="lb.supplier" class="qr-label-line">{{ tt('供应商') }} {{ lb.supplier }}</div>
          <div v-if="lb.bin" class="qr-label-line">{{ tt('仓位') }} {{ lb.bin }}</div>
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
 * 数据源:暂收单明细行(物料编码/名称/批号/数量/单位)/采购订单明细行(无批号,供应商贴码);
 * 二维码内容 = `物料编码|批号@数量`(2026-09-28 用户口径加 @数量;批号空→无批号段,数量空→无@段;
 * 工单/产品二维码经 qrText 覆盖,不受默认拼接影响)。
 * 打印(2026-10-20 改):走**页面内打印通道** `@core/panel/printChannel`,与商品/仓位标识卡、
 *   采购单据、面板单据打印**同一条路**——不弹窗、不在子窗口里 print。
 *   旧写法(子窗口 document.write + window.print)与主页面同源共用渲染进程,打印预览/虚拟打印机一卡,
 *   主页面跟着僵死(现场「打印后卡死、刷新无效」),故整条弹窗打印路已废弃。
 */
import { ref, computed } from 'vue'
import { ElDialog, ElButton, ElMessage } from 'element-plus'
import QRCode from 'qrcode'
import { tt } from '@/i18n'
import { printInPage } from '@/core/panel/printChannel'

const props = defineProps({
  modelValue: Boolean,
  /** [{code, name, lot, qty, unit, doc, qrText?}] */
  labels: { type: Array, default: () => [] },
  /** 标题/提示可覆盖(工单二维码标签等复用本对话框) */
  title: { type: String, default: '' },
  tip: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const visibleModel = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const gridRef = ref(null)

async function renderQr() {
  for (const lb of props.labels) {
    if (!lb.qr && lb.code) {
      // @数量段(2026-09-28):数量空则整段省略;批号空则无 |批号 段 —— 供应商在采购订单打码即 编码@数量
      const qtySuffix = lb.qty == null || lb.qty === '' ? '' : '@' + lb.qty
      const text = lb.qrText || (lb.lot ? `${lb.code}|${lb.lot}${qtySuffix}` : `${lb.code}${qtySuffix}`)
      try { lb.qr = await QRCode.toDataURL(text, { width: 160, margin: 1, errorCorrectionLevel: 'M' }) }
      catch { /* 单张失败不影响其余 */ }
    }
  }
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
/** 打印层样式:选择器一律收在 `#yj-print-host` 下(页面内打印与主界面共用一个文档,别被全局样式串味) */
const PRINT_CSS = '@page{size:A4;margin:8mm}'
  + '#yj-print-host{font-family:system-ui,"Microsoft YaHei",sans-serif;color:#222}'
  + '#yj-print-host .qrg{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}'
  + '#yj-print-host .card{display:flex;gap:10px;padding:8px;border:1px solid #999;border-radius:4px;'
  + 'page-break-inside:avoid;break-inside:avoid}'
  + '#yj-print-host .card img{width:84px;height:84px}'
  + '#yj-print-host .info{display:flex;flex-direction:column;justify-content:center;min-width:0}'
  + '#yj-print-host .l{font-size:12px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '#yj-print-host .strong{font-weight:600;font-size:14px}'
  + '#yj-print-host .dim{color:#666}'
function print() {
  // 空值不出行:批号空不写 LOT;仓库/供应商/仓位没有就不印(2026-10-18 用户口径)
  const lineOf = (label, val) => (val ? `<div class="l">${esc(label)} ${esc(val)}</div>` : '')
  const cards = props.labels.filter((l) => l.qr).map((l) => `<div class="card"><img src="${l.qr}"/>
    <div class="info"><div class="l strong">${esc(l.code)}</div><div class="l">${esc(l.name)}</div>
    ${lineOf('LOT', l.lot)}${lineOf(tt('仓库'), l.warehouse)}${lineOf(tt('供应商'), l.supplier)}${lineOf(tt('仓位'), l.bin)}
    <div class="l dim">${esc(l.qty)} ${esc(l.unit)} · ${esc(l.doc)}</div></div></div>`).join('')
  if (!cards) return ElMessage.warning(tt('当前单据没有可打印的明细行（或行缺少批号，请先保存）'))
  // 2026-10-20:与商品/仓位标识卡、采购单据、面板单据打印同一条出纸通道(页面内打印层),
  //   不再开子窗口 —— 那条路会把主页面一起拖死(见 printChannel.js 头部说明)。
  if (!printInPage(props.title || tt('材料二维码标签'), '<style>' + PRINT_CSS + '</style><div class="qrg">' + cards + '</div>')) {
    ElMessage.error(tt('打印失败'))
  }
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
