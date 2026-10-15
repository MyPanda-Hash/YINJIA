<template>
  <div class="fi-sheet">
    <div class="fi-title">{{ tt('炭棒成型车间首件检验记录表') }}</div>
    <table class="fi-head"><tbody><tr>
      <th>{{ tt('产品编号') }}</th><td>{{ head['产品编码'] || '' }}</td>
      <th>{{ tt('产品型号') }}</th><td>{{ head['规格型号'] || head['产品名称'] || '' }}</td>
      <th>{{ tt('生产日期') }}</th><td>{{ head['生产日期'] || head['检验日期'] || head['单据日期'] || '' }}</td>
      <th>{{ tt('组别') }}</th><td>{{ head['生产线'] || head['生产车间'] || '' }}</td>
    </tr></tbody></table>
    <table class="fi-grid">
      <thead>
        <tr>
          <th rowspan="2" class="sample-col">{{ tt('样品序号') }}</th>
          <th v-for="g in groups" :key="g" :colspan="groupCols(g).length" class="group">{{ tt(g) }}</th>
        </tr>
        <tr>
          <template v-for="g in groups" :key="'h-' + g">
            <th v-for="c in groupCols(g)" :key="c.key" class="col-head">{{ tt(c.label) }}<small v-if="c.unit">({{ c.unit }})</small></th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr class="standard-row"><th>{{ tt('标准') }}</th><td v-for="c in columns" :key="c.key" class="standard">{{ c.standard }}</td></tr>
        <tr v-for="sample in samples" :key="sample" class="sample-row">
          <th>{{ sample }}#</th>
          <td v-for="c in columns" :key="c.key">
            <el-input v-if="editable" :model-value="cell(sample, c)['实测数值']" size="small" class="fi-input" @update:model-value="v => setMeasured(sample, c, v)" />
            <span v-else>{{ cell(sample, c)['实测数值'] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="fi-requirements"><b>{{ tt('相关要求') }}：</b><ol><li>{{ tt('表观及脱粉项目测试后记录2支样品数据') }}。</li><li>{{ tt('尺寸及重量、强度、浊度及压降按成型工艺清单标准执行') }}。</li><li>{{ tt('检验结果不符合标准时应立即停止生产并隔离产品') }}。</li></ol></div>
    <table class="fi-foot"><tbody><tr><th>{{ tt('检验结果') }}</th><td><el-input v-if="editable" v-model="head['总结论']" @input="emit('dirty')" /><span v-else>{{ head['总结论'] || '' }}</span></td><th>{{ tt('检验人') }}</th><td>{{ head['检验员'] || '' }}</td></tr></tbody></table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { tt } from '@/i18n'
const props = defineProps({ head: { type: Object, required: true }, fields: { type: Array, default: () => [] }, editable: { type: Boolean, default: false } })
const emit = defineEmits(['dirty'])
const detail = computed(() => Array.isArray(props.head?.detail?.items) ? props.head.detail.items : [])
const columns = computed(() => {
  const map = new Map()
  for (const r of detail.value) {
    const key = String(r['检验列'] || r['检验项目'] || '').trim()
    if (!key || map.has(key)) continue
    map.set(key, { key, label: r['检验项目'] || key, group: r['项目分组'] || groupOf(key), standard: r['标准'] || r['检验要求'] || '', unit: unitOf(key) })
  }
  return [...map.values()]
})
const groups = computed(() => [...new Set(columns.value.map(c => c.group))])
const groupCols = (g) => columns.value.filter(c => c.group === g)
const samples = [1, 2, 3, 4, 5, 6, 7, 8]
function groupOf(key) { if (/表观|脱粉/.test(key)) return '表观及脱粉'; if (/外径|内径|长度|重量/.test(key)) return '尺寸及重量'; if (/跌落|挤压|强度/.test(key)) return '强度'; return '浊度及压降' }
function unitOf(key) { if (/外径|内径|长度/.test(key)) return 'mm'; if (/重量/.test(key)) return 'g'; if (/浊度/.test(key)) return 'NTU'; if (/压降/.test(key)) return 'kPa'; return '' }
function setMeasured(sample, col, value) { cell(sample, col)['实测数值'] = value; emit('dirty') }
function cell(sample, col) {
  const row = detail.value.find(r => String(r['行类型']) === '样品' && String(r['样品序号']) === `${sample}#` && r['检验列'] === col.key)
  if (row) return row
  const d = props.head.detail || (props.head.detail = {}); if (!Array.isArray(d.items)) d.items = []
  const next = { 表区: '首件检验', 行类型: '样品', 样品序号: `${sample}#`, 检验列: col.key, 检验项目: col.label, 项目分组: col.group, 标准: '', 实测数值: '', 结果判断: '', 行号: sample }
  d.items.push(next); return next
}
</script>

<style scoped>
.fi-sheet{background:#fff;border:1px solid #777;max-width:1500px;min-width:900px;margin:14px auto;padding:0;color:#222;font-size:14px}.fi-title{text-align:center;font:600 30px SimSun,serif;padding:26px;border-bottom:1px solid #777}.fi-head,.fi-grid,.fi-foot{width:100%;border-collapse:collapse;table-layout:fixed}.fi-head th,.fi-head td,.fi-grid th,.fi-grid td,.fi-foot th,.fi-foot td{border:1px solid #777;padding:7px;text-align:center;vertical-align:middle}.fi-head th,.fi-foot th{background:#eee;font-weight:500}.fi-head td{text-align:left}.fi-grid .group{background:#ddd;font-weight:500;font-size:16px}.fi-grid .col-head{background:#ddd;height:42px}.col-head small{font-size:11px}.sample-col{width:90px}.standard-row th,.standard-row td{background:#ddd;min-height:48px}.standard{text-align:left!important;white-space:pre-wrap;word-break:break-word}.sample-row{height:62px}.sample-row th{font-weight:500}.fi-input{width:100%}.fi-input :deep(.el-input__wrapper){box-shadow:none;border:0;background:transparent}.fi-requirements{padding:10px 14px;line-height:1.7;border-bottom:1px solid #777}.fi-requirements ol{margin:3px 0 0 20px;padding:0}.fi-foot th{width:110px}.fi-foot td{text-align:left;height:42px}.fi-foot :deep(.el-input__wrapper){box-shadow:none;border:0}
</style>
