<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       功能性滤效 数据记录表(RD_FILTER_EFF)——按《04数据记录表.xlsx》一比一复刻
       真实表格列对齐:报告头表(公司名|YJ-PD-01、主题+信息块4行) →
       区块表(标签170|值A|值B:1.基本信息/2.测试条件/4.数据结论)→ 数据记录表(分组表头)
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="record-sheet">
    <!-- ═══ 报告头 ═══ -->
    <table class="rs-t rs-head-t">
      <colgroup><col style="width:auto" /><col style="width:300px" /></colgroup>
      <tbody>
        <tr>
          <td class="rs-td rs-company-cell">惠州市银嘉环保科技有限公司</td>
          <td class="rs-td rs-docno">
            <el-input v-if="editable" v-model="head['文档编号']" size="small" maxlength="30" class="rs-docno-input" @input="emit('dirty')" />
            <template v-else>{{ head['文档编号'] || head['单据编号'] || 'YJ-PD-01' }}</template>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-topic-cell" rowspan="4">
            <el-input v-if="editable" v-model="head['测试主题']" size="small" class="rs-topic-input" @input="emit('dirty')" />
            <span v-else class="rs-topic">{{ head['测试主题'] || '' }}</span>
          </td>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('密级') }}</span>
              <span class="rs-ivalue">
                <el-select v-if="editable" v-model="head['密级']" size="small" :clearable="false" @change="emit('dirty')">
                  <el-option v-for="o in selectOptions('密级')" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <template v-else>{{ head['密级'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('适用范围') }}</span>
              <span class="rs-ivalue">
                <el-select v-if="editable" v-model="head['适用范围']" size="small" :clearable="false" @change="emit('dirty')">
                  <el-option v-for="o in selectOptions('适用范围')" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <template v-else>{{ head['适用范围'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('测试负责人') }}</span>
              <span class="rs-ivalue">
                <el-input v-if="editable" v-model="head['测试负责人']" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
                <template v-else>{{ head['测试负责人'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('测试编号') }}</span>
              <span class="rs-ivalue">
                <el-input v-if="editable" v-model="head['测试编号']" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
                <template v-else>{{ head['测试编号'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 1.基本信息 ═══ -->
    <table class="rs-t">
      <colgroup><col style="width:170px" /><col style="width:auto" /><col style="width:auto" /></colgroup>
      <tbody>
        <tr><td colspan="3" class="rs-sectionbar">{{ tt('1.基本信息') }}</td></tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试目的/背景') }}</td>
          <td class="rs-td" colspan="2">
            <el-input v-if="editable" v-model="head['测试目的/背景']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试目的/背景'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('规格') }}</td>
          <td class="rs-td" colspan="2">
            <el-input v-if="editable" v-model="head['规格']" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['规格'] || '' }}</span>
          </td>
        </tr>
        <tr class="rs-row-mid">
          <td class="rs-td rs-label">{{ tt('样品配方') }}</td>
          <td class="rs-td">
            <el-input v-if="editable" v-model="head['样品配方']" type="textarea" :autosize="{ minRows: 1, maxRows: 8 }" size="small" maxlength="300" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['样品配方'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('样品信息') }}</td>
          <td class="rs-td">
            <el-input v-if="editable" v-model="head['样品信息1']" type="textarea" :autosize="{ minRows: 3, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['样品信息1'] || '' }}</span>
          </td>
          <td class="rs-td">
            <el-input v-if="editable" v-model="head['样品信息2']" type="textarea" :autosize="{ minRows: 3, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['样品信息2'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试要求') }}</td>
          <td class="rs-td" colspan="2">
            <el-input v-if="editable" v-model="head['测试要求']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试要求'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试标准') }}</td>
          <td class="rs-td" colspan="2">
            <el-input v-if="editable" v-model="head['测试标准']" size="small" maxlength="300" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试标准'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试时间') }}</td>
          <td class="rs-td" colspan="2">
            <el-input v-if="editable" v-model="head['测试时间']" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试时间'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('本次实验目的') }}</td>
          <td class="rs-td" colspan="2">
            <el-input v-if="editable" v-model="head['本次实验目的']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['本次实验目的'] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 2.测试条件 ═══ -->
    <table class="rs-t">
      <colgroup><col style="width:170px" /><col style="width:auto" /><col style="width:auto" /></colgroup>
      <tbody>
        <tr><td colspan="3" class="rs-sectionbar">{{ tt('2.测试条件') }}</td></tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试装置及编号') }}</td>
          <td class="rs-td">
            <el-input v-if="editable" v-model="head['测试装置及编号1']" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试装置及编号1'] || '' }}</span>
          </td>
          <td class="rs-td">
            <el-input v-if="editable" v-model="head['测试装置及编号2']" size="small" maxlength="200" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试装置及编号2'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('加标方式') }}</td>
          <td class="rs-td" colspan="2">
            <el-input v-if="editable" v-model="head['加标方式']" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['加标方式'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('冲水方式') }}</td>
          <td class="rs-td" colspan="2">
            <el-input v-if="editable" v-model="head['冲水方式']" type="textarea" :autosize="{ minRows: 3, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['冲水方式'] || '' }}</span>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-label">{{ tt('测试用仪器/检出限') }}</td>
          <td class="rs-td" colspan="2">
            <el-input v-if="editable" v-model="head['测试用仪器/检出限']" size="small" maxlength="500" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['测试用仪器/检出限'] || '' }}</span>
          </td>
        </tr>
        <!-- 原水水质条件:左侧标签跨两行,右侧内嵌 指标名行 + 值行 -->
        <tr>
          <td class="rs-td rs-label rs-water-label" rowspan="2">{{ tt('原水水质条件') }}</td>
          <td class="rs-td rs-water-zone" colspan="2">
            <table class="rs-inner">
              <tbody>
                <tr>
                  <td class="rs-ind-name">{{ tt('自来水') }}</td>
                  <td class="rs-ind-name">{{ tt('纯水') }}</td>
                  <td class="rs-ind-name">{{ tt('超纯水') }}</td>
                  <td class="rs-ind-name">{{ tt('PH') }}</td>
                  <td class="rs-ind-name">{{ tt('TDS') }}</td>
                  <td class="rs-ind-name narrow">{{ tt('缸内自来水VOC浓度') }}</td>
                  <td class="rs-ind-name">{{ tt('自来水加氯浓度') }}</td>
                  <td class="rs-ind-name">{{ tt('水温℃') }}</td>
                </tr>
                <tr>
                  <td class="rs-water-val"><el-select v-if="editable" v-model="head['原水自来水']" size="small" :clearable="false" @change="emit('dirty')"><el-option v-for="o in selectOptions('原水自来水')" :key="o.value" :label="o.label" :value="o.value" /></el-select><template v-else>{{ head['原水自来水'] || '' }}</template></td>
                  <td class="rs-water-val"><el-select v-if="editable" v-model="head['原水纯水']" size="small" :clearable="false" @change="emit('dirty')"><el-option v-for="o in selectOptions('原水纯水')" :key="o.value" :label="o.label" :value="o.value" /></el-select><template v-else>{{ head['原水纯水'] || '' }}</template></td>
                  <td class="rs-water-val"><el-select v-if="editable" v-model="head['原水超纯水']" size="small" :clearable="false" @change="emit('dirty')"><el-option v-for="o in selectOptions('原水超纯水')" :key="o.value" :label="o.label" :value="o.value" /></el-select><template v-else>{{ head['原水超纯水'] || '' }}</template></td>
                  <td class="rs-water-val"><el-input v-if="editable" v-model="head['原水PH']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['原水PH'] || '' }}</span></td>
                  <td class="rs-water-val"><el-input v-if="editable" v-model="head['原水TDS']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['原水TDS'] || '' }}</span></td>
                  <td class="rs-water-val"><el-input v-if="editable" v-model="head['缸内自来水VOC浓度']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['缸内自来水VOC浓度'] || '' }}</span></td>
                  <td class="rs-water-val"><el-input v-if="editable" v-model="head['自来水加氯浓度']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['自来水加氯浓度'] || '' }}</span></td>
                  <td class="rs-water-val"><el-input v-if="editable" v-model="head['水温']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['水温'] || '' }}</span></td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 3.数据记录表 ═══ -->
    <table class="rs-t rs-dt">
      <colgroup>
        <col style="width:130px" /><col style="width:96px" /><col style="width:80px" />
        <col style="width:110px" /><col style="width:110px" />
        <col style="width:96px" />
        <col style="width:96px" /><col style="width:96px" />
        <col style="width:96px" /><col style="width:96px" />
        <col style="width:110px" />
        <col v-if="editable" style="width:60px" />
      </colgroup>
      <tbody>
        <tr><td colspan="12" class="rs-sectionbar">{{ tt('3.数据记录表') }}</td></tr>
        <tr class="rs-grp">
          <th class="rs-th" rowspan="2">{{ tt('冲水时间') }}</th>
          <th class="rs-th" rowspan="2">{{ tt('累计进水（L）') }}</th>
          <th class="rs-th" rowspan="2">{{ tt('水温（℃）') }}</th>
          <th class="rs-th" colspan="2">{{ tt('取样前样品：压力（PSI)/流速（L/min）') }}</th>
          <th class="rs-th" rowspan="2">{{ tt('原水含量（ug/L）') }}</th>
          <th class="rs-th" colspan="2">{{ tt('出水含量（ug/L）') }}</th>
          <th class="rs-th" colspan="2">{{ tt('去除率%') }}</th>
          <th class="rs-th" rowspan="2">{{ tt('测试时间') }}</th>
          <th v-if="editable" class="rs-th rs-th-op" rowspan="2"></th>
        </tr>
        <tr class="rs-grp2">
          <th class="rs-th">样品1</th><th class="rs-th">样品2</th>
          <th class="rs-th">样品1</th><th class="rs-th">样品2</th>
          <th class="rs-th">样品1</th><th class="rs-th">样品2</th>
        </tr>
        <tr v-for="(row, i) in items" :key="row.id ?? ('new' + i)">
          <td class="rs-td"><el-input v-if="editable" v-model="row['冲水时间']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['冲水时间'] || ' / ' }}</span></td>
          <td class="rs-td"><el-input v-if="editable" v-model="row['累计进水（L）']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['累计进水（L）'] || ' / ' }}</span></td>
          <td class="rs-td"><el-input v-if="editable" v-model="row['水温（℃）']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['水温（℃）'] || ' / ' }}</span></td>
          <td class="rs-td"><el-input v-if="editable" v-model="row['压力（PSI)样品1']" size="small" class="rs-c-in" placeholder="压力" @input="emit('dirty')" /><span v-else class="rs-txt">{{ combo(row, '压力（PSI)样品1', '流速（L/min)样品1') }}</span></td>
          <td class="rs-td"><el-input v-if="editable" v-model="row['流速（L/min)样品1']" size="small" class="rs-c-in" placeholder="流速" @input="emit('dirty')" /><span v-else class="rs-txt">{{ combo(row, '压力（PSI)样品2', '流速（L/min)样品2') }}</span></td>
          <td class="rs-td"><el-input v-if="editable" v-model="row['原水含量（ug/L）5号缸']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['原水含量（ug/L）5号缸'] || ' / ' }}</span></td>
          <td class="rs-td"><el-input v-if="editable" v-model="row['出水含量（ug/L）样品1']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['出水含量（ug/L）样品1'] || ' / ' }}</span></td>
          <td class="rs-td"><el-input v-if="editable" v-model="row['出水含量（ug/L）样品2']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['出水含量（ug/L）样品2'] || ' / ' }}</span></td>
          <td class="rs-td"><el-input v-if="editable" v-model="row['去除率%样品1']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['去除率%样品1'] || ' / ' }}</span></td>
          <td class="rs-td"><el-input v-if="editable" v-model="row['去除率%样品2']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['去除率%样品2'] || ' / ' }}</span></td>
          <td class="rs-td"><el-input v-if="editable" v-model="row['测试时间']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ row['测试时间'] || ' / ' }}</span></td>
          <td v-if="editable" class="rs-td rs-td-op"><span class="rs-op-add" @click="addRow(i)">＋</span><span class="rs-op-del" @click="removeRow(i)">×</span></td>
        </tr>
        <tr v-if="!items.length"><td colspan="12" class="rs-empty">—</td></tr>
      </tbody>
    </table>
    <div v-if="editable" class="rs-add" @click="addRow(-1)">＋ {{ tt('新增数据记录行') }}</div>

    <!-- ═══ 4.数据结论 ═══ -->
    <table class="rs-t">
      <tbody>
        <tr><td colspan="3" class="rs-sectionbar">{{ tt('4.数据结论') }}</td></tr>
        <tr>
          <td class="rs-td rs-conclusion" colspan="3">
            <el-input v-if="editable" v-model="head['数据结论']" type="textarea" :autosize="{ minRows: 2, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head['数据结论'] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
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

/** 取样前组合显示:流速 / 压力(复刻 Excel "1.93/61.1") */
function combo(row, pKey, fKey) {
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
/* ═══ 纸张/表基础 ═══ */
.record-sheet {
  width: 1180px;
  max-width: 100%;
  margin: 16px auto 26px;
  background: #fff;
  font-size: 14px;
  color: #222;
}
.rs-t {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.rs-t :deep(.el-input__wrapper),
.rs-t :deep(.el-input__wrapper.is-focus),
.rs-t :deep(.el-textarea__inner),
.rs-t :deep(.el-textarea__inner:focus) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0;
}
.rs-t :deep(.el-input__inner),
.rs-t :deep(.el-textarea__inner) {
  font-size: 13.5px;
  line-height: 1.6;
  padding: 0;
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

/* ═══ 报告头 ═══ */
.rs-company-cell {
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 17px;
  color: #333;
  padding: 7px 14px !important;
}
.rs-docno {
  text-align: right;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-weight: 600;
  font-style: italic;
  font-size: 14px;
  padding: 6px 14px !important;
  vertical-align: middle;
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
  display: block;
  text-align: center;
}
.rs-topic-input {
  width: 90%;
}
.rs-info-cell {
  padding: 0 !important;
  vertical-align: top !important;
}
.rs-irow {
  display: flex;
  border-bottom: 1px solid #7f7f7f;
  min-height: 34px;
}
.rs-irow:last-child {
  border-bottom: none;
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
  border-top: none;
  color: #333;
  font-size: 14px;
  font-weight: 700;
  padding: 5px 10px;
  text-align: center;
}
.rs-t > tbody > tr:first-child .rs-sectionbar {
  border-top: 1px solid #7f7f7f;
}

/* ═══ 测试条件 ═══ */
.rs-inner {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}
.rs-inner td {
  border-left: 1px solid #7f7f7f;
  border-top: 1px solid #7f7f7f;
  border-bottom: 1px solid #7f7f7f;
}
.rs-inner tr:first-child td {
  border-top: none;
}
.rs-inner td:last-child {
  border-right: none;
}
.rs-water-zone {
  padding: 0 !important;
}
.rs-row-mid {
  height: 130px;
}
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
  padding: 6px 4px;
  vertical-align: middle;
  line-height: 1.35;
  word-break: break-all;
}
.rs-th-op {
  min-width: 60px;
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
  padding: 14px 0 !important;
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
