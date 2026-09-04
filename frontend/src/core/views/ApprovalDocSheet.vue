<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       立项申请表(二三级项目)——文书式面板特例(RD_APPROVAL)
       版式对齐《立项申请表(二三级项目)》模板:公司名 + 文档编号、
       右上信息区(单据编号/单据日期/文件管理人/密级/文件使用范围)、
       8 项内容区(蓝底序号列 + 填写区 + 可写字数列),底部签名区。
       数据键全部为字段 label(与面板引擎 dataName 一致),保存/审批/导出
       复用引擎既有逻辑,本组件只负责呈现与置脏。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="approval-sheet">
    <!-- ① 公司头 + 文档编号 -->
    <div class="as-head">
      <div class="as-company">惠州市银嘉环保科技有限公司</div>
      <div class="as-doc-no">{{ tt('文档编号') }}：YJ-XS002</div>
    </div>
    <div class="as-title">{{ tt('立项申请表') }}（{{ tt('二三级项目') }}）</div>

    <!-- ② 右上信息区:单据信息 + 文件属性 -->
    <div class="as-info">
      <div class="as-info-row">
        <label>{{ tt('单据编号') }}</label>
        <span class="as-info-val">{{ head['单据编号'] || '' }}</span>
        <label>{{ tt('单据日期') }}</label>
        <span class="as-info-val">
          <el-date-picker
            v-if="editable"
            v-model="head['单据日期']"
            type="date"
            value-format="YYYY-MM-DD"
            size="small"
            style="width: 130px"
            :clearable="false"
            @change="emit('dirty')"
          />
          <template v-else>{{ head['单据日期'] || '' }}</template>
        </span>
      </div>
      <div class="as-info-row">
        <label>{{ tt('文件管理人') }}</label>
        <span class="as-info-val">
          <el-input
            v-if="editable"
            v-model="head['文件管理人']"
            size="small"
            maxlength="50"
            style="width: 120px"
            :clearable="false"
            @input="emit('dirty')"
          />
          <template v-else>{{ head['文件管理人'] || '' }}</template>
        </span>
        <label>{{ tt('密级') }}</label>
        <span class="as-info-val">
          <el-select
            v-if="editable"
            v-model="head['密级']"
            size="small"
            style="width: 90px"
            :clearable="false"
            @change="emit('dirty')"
          >
            <el-option v-for="o in selectOptions('密级')" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <template v-else>{{ head['密级'] || '' }}</template>
        </span>
        <label>{{ tt('文件使用范围') }}</label>
        <span class="as-info-val">
          <el-select
            v-if="editable"
            v-model="head['文件使用范围']"
            size="small"
            style="width: 110px"
            :clearable="false"
            @change="emit('dirty')"
          >
            <el-option v-for="o in selectOptions('文件使用范围')" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <template v-else>{{ head['文件使用范围'] || '' }}</template>
        </span>
      </div>
    </div>

    <!-- ③ 内容区:8 项一~八 -->
    <div class="as-table">
      <div class="as-row as-head-row">
        <div class="as-label as-head-cell">{{ tt('序号') }}/{{ tt('项目名称') }}</div>
        <div class="as-body as-head-cell">{{ tt('填写内容') }}</div>
        <div class="as-count as-head-cell">{{ tt('可写字数') }}</div>
      </div>
      <div class="as-row" v-for="sec in sections" :key="sec.key">
        <div class="as-label">{{ sec.num }}、{{ tt(sec.label) }}</div>
        <div class="as-body">
          <el-input
            v-if="editable && sec.kind === 'input'"
            v-model="head[sec.key]"
            type="text"
            :maxlength="sec.max"
            :clearable="false"
            resize="none"
            @input="emit('dirty')"
          />
          <el-input
            v-else-if="editable"
            v-model="head[sec.key]"
            type="textarea"
            :rows="sec.rows"
            :maxlength="sec.max"
            resize="none"
            @input="emit('dirty')"
          />
          <div v-else class="as-ro-text">{{ head[sec.key] || '' }}</div>
        </div>
        <div class="as-count">
          <div class="as-count-limit">{{ tt('可写') }}{{ sec.max }}{{ tt('字') }}</div>
          <div class="as-count-cur">{{ len(sec.key) }}/{{ sec.max }}</div>
        </div>
      </div>

      <!-- ④ 底部签名区 -->
      <div class="as-row as-sign-row">
        <div class="as-sign-cell">
          <span class="as-sign-label">{{ tt('申请立项人') }}</span>
          <el-input
            v-if="editable"
            v-model="head['申请立项人']"
            size="small"
            maxlength="50"
            style="width: 160px"
            @input="emit('dirty')"
          />
          <span v-else class="as-sign-val">{{ head['申请立项人'] || '' }}</span>
        </div>
        <div class="as-sign-cell">
          <span class="as-sign-label">{{ tt('申请立项日期') }}</span>
          <el-date-picker
            v-if="editable"
            v-model="head['申请立项日期']"
            type="date"
            value-format="YYYY-MM-DD"
            size="small"
            style="width: 130px"
            :clearable="false"
            @change="emit('dirty')"
          />
          <span v-else class="as-sign-val">{{ head['申请立项日期'] || '' }}</span>
        </div>
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

/** 内容区行定义:num 序号 / label 字段标签(即数据键) / max 可写字数 / kind 控件类型 / rows 行高 */
const sections = [
  { num: '一', label: '客户名', key: '客户名', max: 50, kind: 'input', rows: 1 },
  { num: '二', label: '立项背景', key: '立项背景', max: 250, kind: 'textarea', rows: 8 },
  { num: '三', label: '机型及应用位置', key: '机型及应用位置', max: 50, kind: 'textarea', rows: 3 },
  { num: '四', label: '滤芯/炭棒规格或结构', key: '滤芯/炭棒规格或结构', max: 100, kind: 'textarea', rows: 5 },
  { num: '五', label: '项目开发目标', key: '项目开发目标', max: 250, kind: 'textarea', rows: 8 },
  { num: '六', label: '项目输出', key: '项目输出', max: 100, kind: 'textarea', rows: 5 },
  { num: '七', label: '开发周期要求', key: '开发周期要求', max: 50, kind: 'textarea', rows: 3 },
  { num: '八', label: '其它要求', key: '其它要求', max: 250, kind: 'textarea', rows: 8 },
]

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))

function selectOptions(key) {
  const f = fieldMap.value.get(key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

function len(key) {
  const v = props.head?.[key]
  return v == null ? 0 : String(v).length
}
</script>

<style scoped>
.approval-sheet {
  width: 920px;
  max-width: 100%;
  margin: 14px auto 22px;
  padding: 18px 26px 14px;
  background: #fff;
  border: 1px solid #b5b5b5;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  font-size: 14px;
}

/* ① 公司头 + 文档编号 */
.as-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 2px solid #2f5c9e;
  padding-bottom: 6px;
}
.as-company {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #1c3d6e;
}
.as-doc-no {
  font-size: 13px;
  color: #555;
}
.as-title {
  text-align: center;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 3px;
  padding: 8px 0 6px;
}

/* ② 右上信息区 */
.as-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  margin-bottom: 6px;
}
.as-info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.as-info-row label {
  color: #444;
  font-weight: 600;
  white-space: nowrap;
}
.as-info-row label::after {
  content: '：';
}
.as-info-val {
  min-width: 40px;
  color: #222;
  white-space: nowrap;
}

/* ③ 内容区表格 */
.as-table {
  border: 1px solid #9a9a9a;
}
.as-row {
  display: flex;
  border-bottom: 1px solid #9a9a9a;
}
.as-row:last-child {
  border-bottom: none;
}
.as-head-row {
  background: #eef4fc;
  font-weight: 600;
  color: #33475c;
}
.as-head-cell {
  padding: 6px 10px;
}
.as-label {
  width: 210px;
  flex: none;
  background: #2f9bf0;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.as-body {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
}
.as-body :deep(.el-textarea__inner),
.as-body :deep(.el-input__wrapper) {
  border: 1px solid #c8d6e5;
  background: #fcfdff;
  font-size: 14px;
  line-height: 1.6;
}
.as-ro-text {
  min-height: 22px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  color: #222;
  padding: 2px 0;
}
.as-count {
  width: 118px;
  flex: none;
  border-left: 1px dashed #b8c6d5;
  background: #f4f8fd;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: #5b7289;
  font-size: 12px;
}
.as-count-limit {
  font-weight: 600;
}
.as-count-cur {
  color: #2f9bf0;
  font-weight: 600;
}

/* ④ 签名区 */
.as-sign-row {
  background: #fbfcfe;
}
.as-sign-cell {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
}
.as-sign-cell + .as-sign-cell {
  border-left: 1px solid #9a9a9a;
}
.as-sign-label {
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}
.as-sign-label::after {
  content: '：';
}
.as-sign-val {
  color: #222;
}
</style>
