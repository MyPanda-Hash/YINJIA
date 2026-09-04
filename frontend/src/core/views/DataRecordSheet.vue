<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       功能性滤效 数据记录表(RD_FILTER_EFF)——按《04数据记录表.xlsx》一比一复刻
       报告头(公司名+测试主题 | 右上文档编号+密级/适用范围/测试负责人/测试编号)
       → 1.基本信息 → 2.测试条件(含原水水质勾选+水质指标行) → 3.数据记录表(分组表头动态行)
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="record-sheet">
    <!-- ═══ 报告头 ═══ -->
    <div class="rs-head">
      <div class="rs-left">
        <div class="rs-company">惠州市银嘉环保科技有限公司</div>
        <div class="rs-topic">
          <el-input
            v-if="editable"
            v-model="head['测试主题']"
            size="small"
            class="rs-topic-input"
            placeholder=""
            @input="emit('dirty')"
          />
          <template v-else>{{ head['测试主题'] || '' }}</template>
        </div>
      </div>
      <div class="rs-right">
        <div class="rs-docno">
          <el-input
            v-if="editable"
            v-model="head['文档编号']"
            size="small"
            maxlength="30"
            class="rs-docno-input"
            @input="emit('dirty')"
          />
          <template v-else>{{ head['文档编号'] || head['单据编号'] || 'YJ-PD-01' }}</template>
        </div>
        <div class="rs-info">
          <div class="rs-info-row">
            <span class="rs-info-label">{{ tt('密级') }}</span>
            <span class="rs-info-value">
              <el-select v-if="editable" v-model="head['密级']" size="small" :clearable="false" @change="emit('dirty')">
                <el-option v-for="o in selectOptions('密级')" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <template v-else>{{ head['密级'] || '' }}</template>
            </span>
          </div>
          <div class="rs-info-row">
            <span class="rs-info-label">{{ tt('适用范围') }}</span>
            <span class="rs-info-value">
              <el-select v-if="editable" v-model="head['适用范围']" size="small" :clearable="false" @change="emit('dirty')">
                <el-option v-for="o in selectOptions('适用范围')" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <template v-else>{{ head['适用范围'] || '' }}</template>
            </span>
          </div>
          <div class="rs-info-row">
            <span class="rs-info-label">{{ tt('测试负责人') }}</span>
            <span class="rs-info-value">
              <el-input v-if="editable" v-model="head['测试负责人']" size="small" maxlength="50" @input="emit('dirty')" />
              <template v-else>{{ head['测试负责人'] || '' }}</template>
            </span>
          </div>
          <div class="rs-info-row">
            <span class="rs-info-label">{{ tt('测试编号') }}</span>
            <span class="rs-info-value">
              <el-input v-if="editable" v-model="head['测试编号']" size="small" maxlength="60" @input="emit('dirty')" />
              <template v-else>{{ head['测试编号'] || '' }}</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 1.基本信息 ═══ -->
    <div class="rs-section">{{ tt('1.基本信息') }}</div>
    <div class="rs-form">
      <div class="rs-row">
        <label>{{ tt('测试目的/背景') }}</label>
        <div class="rs-val">
          <el-input v-if="editable" v-model="head['测试目的/背景']" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" class="rs-input" @input="emit('dirty')" />
          <span v-else class="rs-text">{{ head['测试目的/背景'] || '' }}</span>
        </div>
      </div>
      <div class="rs-row">
        <label>{{ tt('规格') }}</label>
        <div class="rs-val">
          <el-input v-if="editable" v-model="head['规格']" size="small" class="rs-input" maxlength="200" @input="emit('dirty')" />
          <span v-else class="rs-text">{{ head['规格'] || '' }}</span>
        </div>
      </div>
      <div class="rs-row">
        <label>{{ tt('样品配方') }}</label>
        <div class="rs-val">
          <el-input v-if="editable" v-model="head['样品配方']" size="small" class="rs-input" maxlength="300" @input="emit('dirty')" />
          <span v-else class="rs-text">{{ head['样品配方'] || '' }}</span>
        </div>
      </div>
      <div class="rs-row">
        <label>{{ tt('样品信息') }}</label>
        <div class="rs-val rs-dual">
          <div class="rs-cell">
            <el-input v-if="editable" v-model="head['样品信息1']" type="textarea" :autosize="{ minRows: 3, maxRows: 10 }" size="small" class="rs-input" @input="emit('dirty')" />
            <span v-else class="rs-text">{{ head['样品信息1'] || '' }}</span>
          </div>
          <div class="rs-cell">
            <el-input v-if="editable" v-model="head['样品信息2']" type="textarea" :autosize="{ minRows: 3, maxRows: 10 }" size="small" class="rs-input" @input="emit('dirty')" />
            <span v-else class="rs-text">{{ head['样品信息2'] || '' }}</span>
          </div>
        </div>
      </div>
      <div class="rs-row">
        <label>{{ tt('测试要求') }}</label>
        <div class="rs-val">
          <el-input v-if="editable" v-model="head['测试要求']" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" class="rs-input" @input="emit('dirty')" />
          <span v-else class="rs-text">{{ head['测试要求'] || '' }}</span>
        </div>
      </div>
      <div class="rs-row">
        <label>{{ tt('测试标准') }}</label>
        <div class="rs-val">
          <el-input v-if="editable" v-model="head['测试标准']" size="small" class="rs-input" maxlength="300" @input="emit('dirty')" />
          <span v-else class="rs-text">{{ head['测试标准'] || '' }}</span>
        </div>
      </div>
      <div class="rs-row">
        <label>{{ tt('测试时间') }}</label>
        <div class="rs-val">
          <el-input v-if="editable" v-model="head['测试时间']" size="small" class="rs-input" maxlength="200" @input="emit('dirty')" />
          <span v-else class="rs-text">{{ head['测试时间'] || '' }}</span>
        </div>
      </div>
      <div class="rs-row">
        <label>{{ tt('本次实验目的') }}</label>
        <div class="rs-val">
          <el-input v-if="editable" v-model="head['本次实验目的']" type="textarea" :autosize="{ minRows: 1, maxRows: 5 }" size="small" class="rs-input" @input="emit('dirty')" />
          <span v-else class="rs-text">{{ head['本次实验目的'] || '' }}</span>
        </div>
      </div>
    </div>

    <!-- ═══ 2.测试条件 ═══ -->
    <div class="rs-section">{{ tt('2.测试条件') }}</div>
    <div class="rs-form">
      <div class="rs-row">
        <label>{{ tt('测试装置及编号') }}</label>
        <div class="rs-val rs-dual">
          <div class="rs-cell">
            <el-input v-if="editable" v-model="head['测试装置及编号1']" size="small" class="rs-input" maxlength="200" @input="emit('dirty')" />
            <span v-else class="rs-text">{{ head['测试装置及编号1'] || '' }}</span>
          </div>
          <div class="rs-cell">
            <el-input v-if="editable" v-model="head['测试装置及编号2']" size="small" class="rs-input" maxlength="200" @input="emit('dirty')" />
            <span v-else class="rs-text">{{ head['测试装置及编号2'] || '' }}</span>
          </div>
        </div>
      </div>
      <div class="rs-row">
        <label>{{ tt('加标方式') }}</label>
        <div class="rs-val">
          <el-input v-if="editable" v-model="head['加标方式']" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" class="rs-input" @input="emit('dirty')" />
          <span v-else class="rs-text">{{ head['加标方式'] || '' }}</span>
        </div>
      </div>
      <div class="rs-row">
        <label>{{ tt('冲水方式') }}</label>
        <div class="rs-val">
          <el-input v-if="editable" v-model="head['冲水方式']" type="textarea" :autosize="{ minRows: 3, maxRows: 10 }" size="small" class="rs-input" @input="emit('dirty')" />
          <span v-else class="rs-text">{{ head['冲水方式'] || '' }}</span>
        </div>
      </div>
      <div class="rs-row">
        <label>{{ tt('测试用仪器/检出限') }}</label>
        <div class="rs-val">
          <el-input v-if="editable" v-model="head['测试用仪器/检出限']" size="small" class="rs-input" maxlength="500" @input="emit('dirty')" />
          <span v-else class="rs-text">{{ head['测试用仪器/检出限'] || '' }}</span>
        </div>
      </div>
      <!-- 原水水质条件:水源勾选 + 水质指标格(复刻 Excel 两行网格) -->
      <div class="rs-row rs-row-water">
        <label>{{ tt('原水水质条件') }}</label>
        <div class="rs-val rs-water">
          <span v-for="src in waterSources" :key="src.key" class="rs-water-src">
            <span class="rs-water-name">{{ tt(src.label) }}</span>
            <el-select v-if="editable" v-model="head[src.key]" size="small" :clearable="false" @change="emit('dirty')">
              <el-option v-for="o in selectOptions('原水自来水')" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <span v-else>{{ head[src.key] || '' }}</span>
          </span>
          <span class="rs-water-src">
            <span class="rs-water-name">{{ tt('PH') }}</span>
            <el-input v-if="editable" v-model="head['原水PH']" size="small" class="rs-cell-input s" @input="emit('dirty')" />
            <span v-else class="rs-text">{{ head['原水PH'] || '' }}</span>
          </span>
          <span class="rs-water-src">
            <span class="rs-water-name">{{ tt('TDS') }}</span>
            <el-input v-if="editable" v-model="head['原水TDS']" size="small" class="rs-cell-input s" @input="emit('dirty')" />
            <span v-else class="rs-text">{{ head['原水TDS'] || '' }}</span>
          </span>
          <span class="rs-water-src">
            <span class="rs-water-name">{{ tt('缸内自来水VOC浓度') }}</span>
            <el-input v-if="editable" v-model="head['缸内自来水VOC浓度']" size="small" class="rs-cell-input m" @input="emit('dirty')" />
            <span v-else class="rs-text">{{ head['缸内自来水VOC浓度'] || '' }}</span>
          </span>
          <span class="rs-water-src">
            <span class="rs-water-name">{{ tt('自来水加氯浓度') }}</span>
            <el-input v-if="editable" v-model="head['自来水加氯浓度']" size="small" class="rs-cell-input m" @input="emit('dirty')" />
            <span v-else class="rs-text">{{ head['自来水加氯浓度'] || '' }}</span>
          </span>
          <span class="rs-water-src">
            <span class="rs-water-name">{{ tt('水温℃') }}</span>
            <el-input v-if="editable" v-model="head['水温']" size="small" class="rs-cell-input s" @input="emit('dirty')" />
            <span v-else class="rs-text">{{ head['水温'] || '' }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- ═══ 3.数据记录表 ═══ -->
    <div class="rs-section">{{ tt('3.数据记录表') }}</div>
    <div class="rs-table-wrap">
      <table class="rs-table">
        <thead>
          <tr>
            <template v-for="(g, gi) in recordCols" :key="gi">
              <th v-if="g.cols.length > 1" :colspan="g.cols.length" class="rs-th-g">{{ tt(g.label) }}</th>
              <th v-else :rowspan="2" class="rs-th-g">{{ tt(g.label) }}</th>
            </template>
            <th v-if="editable" :rowspan="2" class="rs-th-g rs-th-op"></th>
          </tr>
          <tr>
            <template v-for="(g, gi) in recordCols" :key="'s' + gi">
              <th v-if="g.cols.length > 1" v-for="c in g.cols" :key="c.key">{{ tt(c.label) }}</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in items" :key="row.id ?? ('new' + i)">
            <td v-for="(g, gi) in recordCols" :key="gi">
              <template v-if="g.cols.length > 1">
                <span v-for="c in g.cols" :key="c.key" class="rs-td-cell">
                  <el-input v-if="editable" v-model="row[c.key]" size="small" class="rs-cell-input" @input="emit('dirty')" />
                  <span v-else class="rs-text">{{ row[c.key] || '' }}</span>
                </span>
              </template>
              <template v-else>
                <el-input v-if="editable" v-model="row[g.cols[0].key]" size="small" class="rs-cell-input" @input="emit('dirty')" />
                <span v-else class="rs-text">{{ row[g.cols[0].key] || '' }}</span>
              </template>
            </td>
            <td v-if="editable" class="rs-td-op">
              <span class="rs-addrow" :title="tt('新增一行')" @click="addRow(i)">＋</span>
              <span class="rs-del" :title="tt('删除该行')" @click="removeRow(i)">×</span>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td :colspan="editable ? recordCols.length + 1 : recordCols.length" class="rs-empty">{{ tt('暂无数据记录，点击下方按钮新增') }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="editable" class="rs-add" @click="addRow(-1)">＋ {{ tt('新增数据记录行') }}</div>
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

/** 原水水质水源勾选(复刻 Excel) */
const waterSources = [
  { label: '自来水', key: '原水自来水' },
  { label: '纯水', key: '原水纯水' },
  { label: '超纯水', key: '原水超纯水' },
]

/** 数据记录表列(分组表头,复刻 Excel 表头结构) */
const recordCols = [
  { label: '冲水时间', cols: [{ key: '冲水时间' }] },
  { label: '累计进水（L）', cols: [{ key: '累计进水（L）' }] },
  { label: '水温（℃）', cols: [{ key: '水温（℃）' }] },
  {
    label: '取样前样品：压力（PSI)/流速（L/min）', cols: [
      { key: '压力（PSI)样品1', label: '压力（PSI)样品1' },
      { key: '压力（PSI)样品2', label: '压力（PSI)样品2' },
      { key: '流速（L/min)样品1', label: '流速（L/min)样品1' },
      { key: '流速（L/min)样品2', label: '流速（L/min)样品2' },
    ],
  },
  { label: '原水含量（ug/L）', cols: [{ key: '原水含量（ug/L）5号缸', label: '5号缸' }] },
  {
    label: '出水含量（ug/L）', cols: [
      { key: '出水含量（ug/L）样品1', label: '样品1' },
      { key: '出水含量（ug/L）样品2', label: '样品2' },
    ],
  },
  {
    label: '去除率%', cols: [
      { key: '去除率%样品1', label: '样品1' },
      { key: '去除率%样品2', label: '样品2' },
    ],
  },
  { label: '测试时间', cols: [{ key: '测试时间' }] },
]

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
  width: 980px;
  max-width: 100%;
  margin: 16px auto 26px;
  background: #fff;
  border: 1px solid #8a8a8a;
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
  font-size: 14px;
  line-height: 1.7;
  padding: 0;
}
.record-sheet :deep(.rs-info-value .el-select__wrapper) {
  box-shadow: none !important;
  border: 1px solid #c8d6e5;
  border-radius: 2px;
  background: #fff;
  min-height: 24px;
}

/* ═══ 报告头 ═══ */
.rs-head {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
}
.rs-left {
  flex: 1;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rs-company {
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 18px;
  color: #333;
}
.rs-topic {
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 22px;
  font-weight: 700;
  color: #1f5fa8;
}
.rs-topic-input {
  width: 420px;
}
.rs-right {
  width: 320px;
  flex: none;
  border-left: 1px solid #8a8a8a;
  display: flex;
  flex-direction: column;
}
.rs-docno {
  text-align: right;
  padding: 8px 14px 2px;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 14px;
  height: 28px;
}
.rs-docno-input {
  width: 150px;
}
.rs-docno-input :deep(.el-input__inner) {
  text-align: right;
  font-style: italic;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
}
.rs-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.rs-info-row {
  display: flex;
  flex: 1;
}
.rs-info-row + .rs-info-row {
  border-top: 1px solid #c9c9c9;
}
.rs-info-label {
  width: 100px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 13px;
  color: #1f5fa8;
}
.rs-info-value {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 8px;
  border-left: 1px solid #c9c9c9;
  font-size: 13px;
  min-height: 30px;
}
.rs-info-value :deep(.el-select) {
  width: 100%;
}

/* ═══ 区块标题 ═══ */
.rs-section {
  padding: 7px 14px 3px;
  font-size: 15px;
  font-weight: 700;
  color: #222;
}

/* ═══ 表单行 ═══ */
.rs-form {
  padding: 0 14px 8px;
}
.rs-row {
  display: flex;
  align-items: flex-start;
  border-bottom: 1px solid #d5d5d5;
  padding: 5px 0;
}
.rs-row > label {
  width: 160px;
  flex: none;
  font-size: 13.5px;
  font-weight: 600;
  color: #1f5fa8;
  padding-top: 2px;
}
.rs-val {
  flex: 1;
  min-width: 0;
  padding-left: 8px;
}
.rs-text {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.7;
}
.rs-dual {
  display: flex;
  gap: 18px;
}
.rs-cell {
  flex: 1;
  min-width: 0;
}
.rs-input {
  width: 100%;
}
/* 原水水质行 */
.rs-row-water {
  align-items: center;
}
.rs-water {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: center;
}
.rs-water-src {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
}
.rs-water-name {
  color: #444;
  white-space: nowrap;
}
.rs-water-src :deep(.el-select) {
  width: 62px;
}
.rs-cell-input {
  width: 90px;
}
.rs-cell-input.s {
  width: 60px;
}
.rs-cell-input.m {
  width: 100px;
}

/* ═══ 数据记录表 ═══ */
.rs-table-wrap {
  padding: 0 14px 10px;
  overflow-x: auto;
}
.rs-table {
  width: 100%;
  min-width: 1180px;
  border-collapse: collapse;
  table-layout: auto;
}
.rs-table th,
.rs-table td {
  border: 1px solid #9a9a9a;
  padding: 2px 4px;
  font-size: 12px;
  vertical-align: middle;
}
.rs-table th {
  background: #eef4fc;
  color: #1f5fa8;
  font-weight: 600;
  text-align: center;
}
.rs-th-g {
  line-height: 1.4;
}
.rs-th-op {
  width: 56px;
}
.rs-td-cell {
  display: inline-block;
  width: 49%;
  min-width: 96px;
  vertical-align: top;
}
.rs-td-cell + .rs-td-cell::before {
  content: '|';
  position: absolute;
}
.rs-td-cell {
  position: relative;
}
.rs-td-cell + .rs-td-cell {
  width: 50%;
}
.rs-td-cell + .rs-td-cell > :deep(.el-input) {
  padding-left: 6px;
}
.rs-text {
  word-break: break-all;
}
.rs-td-op {
  text-align: center;
  white-space: nowrap;
}
.rs-empty {
  text-align: center;
  color: #98a4b3;
  padding: 14px 0 !important;
}
.rs-add {
  margin: 6px 0 4px;
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
.rs-addrow {
  display: inline-block;
  color: #0d5bd3;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  margin-right: 5px;
}
.rs-addrow:hover {
  font-weight: 700;
}
.rs-del {
  display: inline-block;
  color: #c0392b;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
}
.rs-del:hover {
  color: #e74c3c;
  font-weight: 700;
}
</style>
