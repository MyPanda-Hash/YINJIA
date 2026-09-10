<!-- QrPrintDialog.vue — 二维码批量打印弹窗(材料/工单/产品三类码)
     用法: <QrPrintDialog v-model="qrVisible" :items="qrItems" :title="qrTitle" />
     items: [{ code: 'M-001-20260910001', label: '炭棒 × 批号 20260910001' }] -->
<template>
  <el-dialog v-model="visible" :title="tt('打印二维码')" width="680px" append-to-body @opened="generate">
    <div class="qr-toolbar">
      <el-button size="small" @click="print">{{ tt('打印') }}</el-button>
      <span class="qr-count">{{ items.length }} {{ tt('张') }}</span>
    </div>
    <div ref="printArea" class="qr-grid">
      <div v-for="(item, i) in items" :key="i" class="qr-cell">
        <canvas :ref="el => canvases[i] = el" class="qr-canvas"></canvas>
        <div class="qr-code">{{ item.code }}</div>
        <div class="qr-label">{{ item.label }}</div>
      </div>
    </div>
    <div v-if="!items.length" class="qr-empty">{{ tt('暂无二维码') }}</div>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import QRCode from 'qrcode'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  title: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const visible = ref(false)
const printArea = ref(null)
const canvases = ref([])

watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

async function generate() {
  await nextTick()
  for (let i = 0; i < props.items.length; i++) {
    const canvas = canvases.value[i]
    if (!canvas || !props.items[i]?.code) continue
    await QRCode.toCanvas(canvas, props.items[i].code, {
      width: 120,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
  }
}

function print() {
  const area = printArea.value
  if (!area) return
  const win = window.open('', '_blank', 'width=600,height=800')
  win.document.write(`
    <html><head><title>${props.title || 'QR Codes'}</title>
    <style>
      body { font-family: sans-serif; padding: 10mm; }
      .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
      .qr-cell { text-align: center; border: 1px solid #ccc; padding: 3mm; page-break-inside: avoid; }
      .qr-canvas { width: 25mm; height: 25mm; }
      .qr-code { font-size: 8pt; font-family: monospace; margin-top: 1mm; }
      .qr-label { font-size: 7pt; color: #666; margin-top: 0.5mm; }
      @media print { .no-print { display: none; } }
    </style></head><body>${area.innerHTML}</body></html>
  `)
  win.document.close()
  win.onload = () => { win.print(); win.close() }
}
</script>

<style scoped>
.qr-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.qr-count { font-size: 13px; color: #6b7280; }
.qr-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  max-height: 60vh;
  overflow-y: auto;
}
.qr-cell {
  text-align: center;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px;
}
.qr-canvas { width: 100px; height: 100px; }
.qr-code { font-size: 11px; font-family: monospace; margin-top: 4px; word-break: break-all; }
.qr-label { font-size: 10px; color: #9ca3af; margin-top: 2px; }
.qr-empty { color: #9ca3af; text-align: center; padding: 30px 0; font-size: 13px; }
</style>
