<!-- DateRangeQuery.vue — 通用「日期范围查询」控件(2026-11-09 从「订单结转」页抽出,订单结转/生产工单两页共用)
     用户口径(2026-11-09):这两个页面的日期范围要用**同一个控件实现**,不要各写一套 ——
     否则一边改快捷档/一边改清空口径,两页看同一天的数据都会不一样。
     口径(本组件只负责控件本身,不掺业务):
       · 单控件 daterange(unlink-panels)+ 快捷档 = 今日/本周/本月/近 7 天/近 30 天/上月,
         快捷档复用看板「时间区间」同一份 PRESETS(文案走 tt,不新增 i18n 词条);
       · value-format=YYYY-MM-DD,清空时统一抛 [] 而不是 null(v-model 侧永远是数组,调用页少写一层兜底);
       · **反序由调用页自行处理**(用户先点结束日、再点开始日时会拿到反序数组;先交换还是回退默认值
         属于各页自己的查询口径,放这里会让两页悄悄分叉,所以本组件原样抛出、不纠正);
       · clearable 默认 false:订单结转「打开就只看今天、总得有个区间」;生产工单要「清空=查全量」⇒ 由调用页传 true。
     样式:宽度由 `width` prop 指定(默认 260px,两页同宽);并且必须带 `flex: 0 0 auto` ——
     el-date-picker 的根元素同时是 `.el-input__wrapper`(Element Plus 给它 `flex-grow:1`),
     放在生产工单页的 flex 查询行里会把 260px 撑成 296px(2026-11-09 实测),两页就不等宽了。
     宽度**不要**用本组件的 scoped class 写死:验收实测 scoped `.drq-picker{width:...}` 命中不了
     el-date-picker 的根元素(生产工单页控件被拉成 402px)。 -->
<template>
  <el-date-picker
    :model-value="modelValue"
    type="daterange"
    unlink-panels
    value-format="YYYY-MM-DD"
    size="small"
    :style="{ width, flex: '0 0 auto' }"
    :clearable="clearable"
    :start-placeholder="tt('开始日期')"
    :end-placeholder="tt('结束日期')"
    :shortcuts="shortcuts"
    @update:model-value="onInput"
    @change="onChange"
  />
</template>

<script setup>
import { computed } from 'vue'
import { tt } from '@/i18n'
import { PRESETS, presetRange } from '@core/dashboard/dateRange'

defineProps({
  /** 值形如 ['YYYY-MM-DD','YYYY-MM-DD'];允许 null/[](清空后 ElDatePicker 抛 null,本组件归一成数组) */
  modelValue: { type: Array, default: () => [] },
  /** 是否允许清空:默认 false(订单结转口径=总有查询区间);生产工单「清空=查全量」时传 true */
  clearable: { type: Boolean, default: false },
  /** 控件宽度(两页统一 260px = 两个 YYYY-MM-DD 框 + 分隔符放得下;要调就改这里,别去 CSS 里写 scoped 类) */
  width: { type: String, default: '260px' },
})
const emit = defineEmits(['update:modelValue', 'change'])

/**
 * 快捷档:与看板「时间区间」共用同一份 PRESETS(今日/本周/本月/近7天/近30天/上月)。
 * value 必须交 Date 对象给 ElDatePicker,这里按**本地时区** new Date(y, m-1, d) 构造 ——
 * 不能用 new Date('YYYY-MM-DD'):那按 UTC 解析,东八区会退到前一天(快捷档点出来就错一天)。
 */
function parseDay(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
const shortcuts = computed(() => PRESETS.map((p) => ({
  text: tt(p.label),
  value: () => { const r = presetRange(p.key); return [parseDay(r.from), parseDay(r.to)] },
})))

/** 清空 ⇒ null,统一成 [];其余情况原样抛出,不替调用页做交换/兜底(见文件头「反序由调用页自行处理」) */
function onInput(v) { emit('update:modelValue', v || []) }
function onChange(v) { emit('change', v || []) }
</script>
