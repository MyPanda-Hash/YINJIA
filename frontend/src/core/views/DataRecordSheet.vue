<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       功能性滤效 数据记录表(RD_FILTER_EFF)——按《04数据记录表.xlsx》一比一复刻(网格表版式)
       报告头(公司名|YJ-PD-01、主题+信息块4行)→ 1.基本信息 → 2.测试条件(原水水质双行)
       → 3.数据记录表(分组表头) → 4.数据结论;粉条区块标题/灰底标签列
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="record-sheet">
    <!-- ═══ 报告头 ═══ -->
    <div class="rs-hrow">
      <div class="rs-td rs-company-cell">惠州市银嘉环保科技有限公司</div>
      <div class="rs-td rs-docno">
        <el-input v-if="editable" v-model="head['文档编号']" size="small" maxlength="30" class="rs-docno-input" @input="emit('dirty')" />
        <template v-else>{{ head['文档编号'] || head['单据编号'] || 'YJ-PD-01' }}</template>
      </div>
    </div>
    <div class="rs-hrow">
      <div class="rs-td rs-topic-cell">
        <el-input v-if="editable" v-model="head['测试主题']" size="small" class="rs-topic-input" @input="emit('dirty')" />
        <span v-else class="rs-topic">{{ head['测试主题'] || '' }}</span>
      </div>
      <div class="rs-td rs-info">
        <div v-for="row in infoRows" :key="row.key" class="rs-irow">
          <span class="rs-ilabel">{{ tt(row.label) }}</span>
          <span class="rs-ivalue">
            <el-select v-if="editable && row.type === 'select'" v-model="head[row.key]" size="small" :clearable="false" @change="emit('dirty')">
              <el-option v-for="o in selectOptions(row.key)" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-input v-else-if="editable" v-model="head[row.key]" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
            <template v-else>{{ head[row.key] || '' }}</template>
          </span>
        </div>
      </div>
    </div>

    <!-- ═══ 1.基本信息 ═══ -->
    <div class="rs-sectionbar">{{ tt('1.基本信息') }}</div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('测试目的/背景') }}</div>
      <div class="rs-td">
        <el-input v-if="editable" v-model="head['测试目的/背景']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['测试目的/背景'] || '' }}</span>
      </div>
      <div class="rs-td">&nbsp;</div>
    </div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('规格') }}</div>
      <div class="rs-td">
        <el-input v-if="editable" v-model="head['规格']" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['规格'] || '' }}</span>
      </div>
      <div class="rs-td">&nbsp;</div>
    </div>
    <div class="rs-trow rs-trow-mid">
      <div class="rs-td rs-label">{{ tt('样品配方') }}</div>
      <div class="rs-td">&nbsp;</div>
      <div class="rs-td">&nbsp;</div>
    </div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('样品信息') }}</div>
      <div class="rs-td">
        <el-input v-if="editable" v-model="head['样品信息1']" type="textarea" :autosize="{ minRows: 3, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['样品信息1'] || '' }}</span>
      </div>
      <div class="rs-td">
        <el-input v-if="editable" v-model="head['样品信息2']" type="textarea" :autosize="{ minRows: 3, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['样品信息2'] || '' }}</span>
      </div>
    </div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('测试要求') }}</div>
      <div class="rs-td">
        <el-input v-if="editable" v-model="head['测试要求']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['测试要求'] || '' }}</span>
      </div>
      <div class="rs-td">&nbsp;</div>
    </div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('测试标准') }}</div>
      <div class="rs-td">
        <el-input v-if="editable" v-model="head['测试标准']" size="small" maxlength="300" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['测试标准'] || '' }}</span>
      </div>
      <div class="rs-td">&nbsp;</div>
    </div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('测试时间') }}</div>
      <div class="rs-td">
        <el-input v-if="editable" v-model="head['测试时间']" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['测试时间'] || '' }}</span>
      </div>
      <div class="rs-td">&nbsp;</div>
    </div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('本次实验目的') }}</div>
      <div class="rs-td">
        <el-input v-if="editable" v-model="head['本次实验目的']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['本次实验目的'] || '' }}</span>
      </div>
      <div class="rs-td">&nbsp;</div>
    </div>

    <!-- ═══ 2.测试条件 ═══ -->
    <div class="rs-sectionbar">{{ tt('2.测试条件') }}</div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('测试装置及编号') }}</div>
      <div class="rs-td">
        <el-input v-if="editable" v-model="head['测试装置及编号1']" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['测试装置及编号1'] || '' }}</span>
      </div>
      <div class="rs-td">
        <el-input v-if="editable" v-model="head['测试装置及编号2']" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['测试装置及编号2'] || '' }}</span>
      </div>
    </div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('加标方式') }}</div>
      <div class="rs-td" colspan="2">
        <el-input v-if="editable" v-model="head['加标方式']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['加标方式'] || '' }}</span>
      </div>
      <div class="rs-td" style="display: none"></div>
    </div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('冲水方式') }}</div>
      <div class="rs-td" colspan="2">
        <el-input v-if="editable" v-model="head['冲水方式']" type="textarea" :autosize="{ minRows: 3, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['冲水方式'] || '' }}</span>
      </div>
      <div class="rs-td" style="display: none"></div>
    </div>
    <div class="rs-trow">
      <div class="rs-td rs-label">{{ tt('测试用仪器/检出限') }}</div>
      <div class="rs-td" colspan="2">
        <el-input v-if="editable" v-model="head['测试用仪器/检出限']" size="small" maxlength="500" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['测试用仪器/检出限'] || '' }}</span>
      </div>
      <div class="rs-td" style="display: none"></div>
    </div>
    <!-- 原水水质条件:指标名行 + 值行 -->
    <div class="rs-trow">
      <div class="rs-td rs-label rs-water-label">{{ tt('原水水质条件') }}</div>
      <div class="rs-td rs-ind-name">{{ tt('自来水') }}</div>
      <div class="rs-td rs-ind-name">{{ tt('纯水') }}</div>
      <div class="rs-td rs-ind-name">{{ tt('超纯水') }}</div>
      <div class="rs-td rs-ind-name">{{ tt('PH') }}</div>
      <div class="rs-td rs-ind-name">{{ tt('TDS') }}</div>
      <div class="rs-td rs-ind-name narrow">{{ tt('缸内自来水VOC浓度') }}</div>
      <div class="rs-td rs-ind-name">{{ tt('自来水加氯浓度') }}</div>
      <div class="rs-td rs-ind-name">{{ tt('水温℃') }}</div>
    </div>
    <div class="rs-trow">
      <div class="rs-td rs-water-val">
        <el-select v-if="editable" v-model="head['原水自来水']" size="small" :clearable="false" @change="emit('dirty')">
          <el-option v-for="o in selectOptions('原水自来水')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <template v-else>{{ head['原水自来水'] || '' }}</template>
      </div>
      <div class="rs-td rs-water-val">
        <el-select v-if="editable" v-model="head['原水纯水']" size="small" :clearable="false" @change="emit('dirty')">
          <el-option v-for="o in selectOptions('原水纯水')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <template v-else>{{ head['原水纯水'] || '' }}</template>
      </div>
      <div class="rs-td rs-water-val">
        <el-select v-if="editable" v-model="head['原水超纯水']" size="small" :clearable="false" @change="emit('dirty')">
          <el-option v-for="o in selectOptions('原水超纯水')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <template v-else>{{ head['原水超纯水'] || '' }}</template>
      </div>
      <div class="rs-td rs-water-val"><el-input v-if="editable" v-model="head['原水PH']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['原水PH'] || '' }}</span></div>
      <div class="rs-td rs-water-val"><el-input v-if="editable" v-model="head['原水TDS']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['原水TDS'] || '' }}</span></div>
      <div class="rs-td rs-water-val"><el-input v-if="editable" v-model="head['缸内自来水VOC浓度']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['缸内自来水VOC浓度'] || '' }}</span></div>
      <div class="rs-td rs-water-val"><el-input v-if="editable" v-model="head['自来水加氯浓度']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['自来水加氯浓度'] || '' }}</span></div>
      <div class="rs-td rs-water-val"><el-input v-if="editable" v-model="head['水温']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['水温'] || '' }}</span></div>
    </div>

    <!-- ═══ 3.数据记录表 ═══ -->
    <div class="rs-sectionbar">{{ tt('3.数据记录表') }}</div>
    <div class="rs-throw">
      <div class="rs-th">{{ tt('冲水时间') }}</div>
      <div class="rs-th">{{ tt('累计进水（L）') }}</div>
      <div class="rs-th">{{ tt('水温（℃）') }}</div>
      <div class="rs-th rs-th-g">{{ tt('取样前样品：压力（PSI)/流速（L/min）') }}</div>
      <div class="rs-th">{{ tt('原水含量（ug/L）') }}</div>
      <div class="rs-th rs-th-g">{{ tt('出水含量（ug/L）') }}</div>
      <div class="rs-th rs-th-g">{{ tt('去除率%') }}</div>
      <div class="rs-th">{{ tt('测试时间') }}</div>
      <div v-if="editable" class="rs-th rs-th-op"></div>
    </div>
    <div class="rs-throw">
      <div class="rs-th rs-th-sub"></div>
      <div class="rs-th rs-th-sub"></div>
      <div class="rs-th rs-th-sub"></div>
      <div class="rs-th-block">
        <div class="rs-th-left">{{ tt('样品1') }}</div>
        <div class="rs-th-right">{{ tt('样品2') }}</div>
      </div>
      <div class="rs-th rs-th-sub"></div>
      <div class="rs-th-block">
        <div class="rs-th-left">{{ tt('样品1') }}</div>
        <div class="rs-th-right">{{ tt('样品2') }}</div>
      </div>
      <div class="rs-th-block">
        <div class="rs-th-left">{{ tt('样品1') }}</div>
        <div class="rs-th-right">{{ tt('样品2') }}</div>
      </div>
      <div class="rs-th rs-th-sub"></div>
      <div v-if="editable" class="rs-th rs-th-sub rs-th-op"></div>
    </div>
    <div v-for="(row, i) in items" :key="row.id ?? ('new' + i)" class="rs-trow">
      <div class="rs-td"><el-input v-if="editable" v-model="row['冲水时间']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['冲水时间'] || ' / ' }}</span></div>
      <div class="rs-td"><el-input v-if="editable" v-model="row['累计进水（L）']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['累计进水（L）'] || ' / ' }}</span></div>
      <div class="rs-td"><el-input v-if="editable" v-model="row['水温（℃）']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['水温（℃）'] || ' / ' }}</span></div>
      <div class="rs-td">
        <div class="rs-combo">
          <el-input v-if="editable" v-model="row['压力（PSI)样品1']" size="small" class="rs-c-in q" placeholder="压力" @input="emit('dirty')" />
          <span v-else class="rs-txt">{{ displayCombo(row, '压力（PSI)样品1', '流速（L/min)样品1') }}</span>
        </div>
      </div>
      <div class="rs-td">
        <div class="rs-combo">
          <el-input v-if="editable" v-model="row['流速（L/min)样品1']" size="small" class="rs-c-in q" placeholder="流速" @input="emit('dirty')" />
          <span v-else class="rs-txt">{{ displayCombo(row, '压力（PSI)样品2', '流速（L/min)样品2') }}</span>
        </div>
      </div>
      <div class="rs-td"><el-input v-if="editable" v-model="row['原水含量（ug/L）5号缸']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['原水含量（ug/L）5号缸'] || ' / ' }}</span></div>
      <div class="rs-td"><el-input v-if="editable" v-model="row['出水含量（ug/L）样品1']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['出水含量（ug/L）样品1'] || ' / ' }}</span></div>
      <div class="rs-td"><el-input v-if="editable" v-model="row['出水含量（ug/L）样品2']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['出水含量（ug/L）样品2'] || ' / ' }}</span></div>
      <div class="rs-td"><el-input v-if="editable" v-model="row['去除率%样品1']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['去除率%样品1'] || ' / ' }}</span></div>
      <div class="rs-td"><el-input v-if="editable" v-model="row['去除率%样品2']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['去除率%样品2'] || ' / ' }}</span></div>
      <div class="rs-td"><el-input v-if="editable" v-model="row['测试时间']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['测试时间'] || ' / ' }}</span></div>
      <div v-if="editable" class="rs-td rs-td-op">
        <span class="rs-op-add" :title="tt('新增一行')" @click="addRow(i)">＋</span>
        <span class="rs-op-del" :title="tt('删除该行')" @click="removeRow(i)">×</span>
      </div>
    </div>
    <div v-if="!items.length" class="rs-trow rs-trow-empty">
      <div class="rs-td rs-empty rs-empty-span">{{ tt('—') }}</div>
    </div>
    <div v-if="editable" class="rs-add" @click="addRow(-1)">＋ {{ tt('新增数据记录行') }}</div>

    <!-- ═══ 4.数据结论 ═══ -->
    <div class="rs-sectionbar">{{ tt('4.数据结论') }}</div>
    <div class="rs-trow">
      <div class="rs-td rs-conclusion">
        <el-input v-if="editable" v-model="head['数据结论']" type="textarea" :autosize="{ minRows: 2, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
        <span v-else class="rs-txt">{{ head['数据结论'] || '' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { tt } from '@/i18n'

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
function selectOptions(key) {
  const f = fieldMap.value.get(key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

/** 报告头信息块 */
const infoRows = [
  { label: '密级', key: '密级', type: 'select' },
  { label: '适用范围', key: '适用范围', type: 'select' },
  { label: '测试负责人', key: '测试负责人', type: 'input' },
  { label: '测试编号', key: '测试编号', type: 'input' },
]

/** 取样前组合显示:流速 / 压力(复刻 Excel "1.93/61.1") */
function displayCombo(row, pKey, fKey) {
  const p = row[pKey] || ''
  const f = row[fKey] || ''
  if (!p && !f) return ' / '
  return `${f}/${p}`
}

const items = computed(() => {
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})
function touch() {
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  return d.items
}
function addRow(i) {
  const arr = touch()
  if (i >= 0) arr.splice(i + 1, 0, {})
  else arr.push({})
  emit('dirty')
}
function removeRow(i) {
  const d = props.head.detail
  if (d && Array.isArray(d.items)) d.items.splice(i, 1)
  emit('dirty')
}
</script>

<style scoped>
/* ═══ 纸张 ═══ */
.record-sheet {
  width: 1180px;
  max-width: 100%;
  margin: 16px auto 26px;
  background: #fff;
  font-size: 14px;
  color: #222;
}
/* 填写控件去边框(白纸) */
.record-sheet :deep(.el-input__wrapper),
.record-sheet :deep(.el-input__wrapper.is-focus),
.record-sheet :deep(.el-textarea__inner),
.record-sheet :deep(.el-textarea__inner:focus) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0;
}
.record-sheet :deep(.el-input__inner),
.record-sheet :deep(.el-textarea__inner) {
  font-size: 13.5px;
  line-height: 1.6;
  padding: 0;
}

/* ═══ 网格骨架(display:table) ═══ */
.record-sheet {
  display: table;
  border-collapse: collapse;
}
.rs-hrow,
.rs-trow {
  display: table-row;
}
.rs-throw {
  display: table-row;
}
.rs-throw .rs-th,
.rs-hrow .rs-td,
.rs-trow .rs-td {
  display: table-cell;
}
.rs-trow-mid {
  height: 130px;
}
.rs-trow-empty {
  height: 40px;
}
.rs-td {
  border: 1px solid #7f7f7f;
  padding: 4px 8px;
  vertical-align: middle;
  background: #fff;
}
.rs-label {
  background: #d9d9d9;
  color: #333;
  text-align: center;
  width: 170px;
  min-width: 170px;
  font-weight: 500;
}
.rs-txt {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.7;
}
.rs-t-in {
  width: 100%;
}
.rs-c-in {
  width: 100%;
}
.rs-c-in.q {
  width: 118px;
}

/* ═══ 报告头 ═══ */
.rs-company-cell {
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 17px;
  color: #333;
  padding: 7px 14px !important;
}
.rs-docno {
  width: 300px;
  min-width: 300px;
  text-align: right;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-weight: 600;
  font-style: italic;
  font-size: 14px;
  padding: 6px 14px !important;
}
.rs-docno-input {
  width: 160px;
}
.rs-docno-input :deep(.el-input__inner) {
  text-align: right;
  font-style: italic;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
}
.rs-topic-cell {
  padding: 12px 14px 14px 30px !important;
  vertical-align: middle;
}
.rs-topic {
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #333;
}
.rs-topic-input {
  width: 520px;
}
.rs-info {
  padding: 0 !important;
  vertical-align: top !important;
}
.rs-irow {
  display: flex;
}
.rs-irow + .rs-irow {
  border-top: 1px solid #7f7f7f;
}
.rs-ilabel {
  width: 90px;
  flex: none;
  background: #d9d9d9;
  text-align: center;
  font-size: 13px;
  padding: 5px 4px;
  border-right: 1px solid #7f7f7f;
}
.rs-ivalue {
  flex: 1;
  padding: 5px 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
}
.rs-ivalue :deep(.el-select) {
  width: 100%;
}

/* ═══ 区块粉条 ═══ */
.rs-sectionbar {
  background: #f9dfe2;
  border: 1px solid #7f7f7f;
  border-bottom: none;
  color: #333;
  font-size: 14px;
  font-weight: 700;
  padding: 5px 10px;
  text-align: center;
}

/* ═══ 测试条件 ═══ */
.rs-water-label {
  vertical-align: middle;
}
.rs-ind-name {
  text-align: center;
  font-size: 13px;
  color: #333;
  min-width: 86px;
}
.rs-ind-name.narrow {
  min-width: 120px;
}
.rs-water-val {
  text-align: center;
  min-width: 86px;
}
.rs-water-val :deep(.el-select) {
  width: 64px;
}

/* ═══ 数据记录表 ═══ */
.rs-th {
  border: 1px solid #7f7f7f;
  background: #9c9c9c;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  padding: 6px 6px;
  vertical-align: middle;
  min-width: 100px;
}
.rs-th-g {
  min-width: 210px;
  font-size: 12px;
  line-height: 1.35;
}
.rs-th-op {
  min-width: 60px;
}
.rs-th-block {
  display: table-cell;
  border: 1px solid #7f7f7f;
  background: #9c9c9c;
  color: #fff;
  padding: 0;
}
.rs-th-block .rs-th-left,
.rs-th-block .rs-th-right {
  display: inline-block;
  width: 50%;
  text-align: center;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 4px;
  box-sizing: border-box;
}
.rs-th-block .rs-th-right {
  border-left: 1px solid #7f7f7f;
}
.rs-th-sub {
  border-top: none;
}
.rs-combo {
  display: flex;
  gap: 6px;
  align-items: center;
}
.rs-td-op {
  text-align: center;
  white-space: nowrap;
}
.rs-op-add,
.rs-op-del {
  display: inline-block;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  margin: 0 3px;
}
.rs-op-add {
  color: #0d5bd3;
}
.rs-op-del {
  color: #c0392b;
}
.rs-empty {
  text-align: center;
  color: #98a4b3;
}
.rs-empty-span {
  border-left: none;
  border-right: none;
}
.rs-add {
  margin: 8px 0 2px;
  padding: 5px 10px;
  border: 1px dashed #8fb4e0;
  border-radius: 4px;
  background: #f4f9ff;
  color: #1c4f8a;
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  user-select: none;
}
.rs-add:hover {
  background: #e8f2ff;
  border-style: solid;
}
.rs-conclusion {
  padding: 10px 14px !important;
}
</style>
