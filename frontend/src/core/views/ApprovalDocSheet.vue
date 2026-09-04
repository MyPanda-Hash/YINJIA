<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       立项申请表(二三级项目)——文书式面板特例(RD_APPROVAL)
       版式严格对齐《立项申请表(二三级项目)》原图:
       ① 顶部条:公司名(斜体)| YJ-XS002(右上,竖线分隔)
       ② 标题行:蓝色大标题(左区居中)| 信息表(文件管理人/密级/文件使用范围)
       ③ 内容区:序号列(蓝底)+ 项目名(蓝底)+ 填写区(左上角可写字数)+ 点状虚线装饰列
       ④ 底部签名:申请立项人 / 申请立项日期(蓝底标签 + 值区)
       单据编号/单据日期(引擎流水号,原图为空白模板无此行,打印必需)置于内容表首行。
       数据键全部为字段 label;保存/审批/导出复用引擎既有逻辑,本组件只负责呈现与置脏。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="approval-sheet">
    <!-- ① 顶部条 -->
    <div class="as-topbar">
      <div class="as-company">惠州市银嘉环保科技有限公司</div>
      <div class="as-docno">YJ-XS002</div>
    </div>

    <!-- ② 标题行:大标题 + 右上信息表 -->
    <div class="as-title-row">
      <div class="as-title">{{ tt('立项申请表') }}（{{ tt('二三级项目') }}）</div>
      <div class="as-info-table">
        <div class="as-info-row">
          <span class="as-info-label">{{ tt('文件管理人') }}</span>
          <span class="as-info-value">
            <el-input
              v-if="editable"
              v-model="head['文件管理人']"
              size="small"
              maxlength="50"
              class="as-cell-input"
              @input="emit('dirty')"
            />
            <template v-else>{{ head['文件管理人'] || '' }}</template>
          </span>
        </div>
        <div class="as-info-row">
          <span class="as-info-label">{{ tt('密级') }}</span>
          <span class="as-info-value">
            <el-select
              v-if="editable"
              v-model="head['密级']"
              size="small"
              class="as-cell-input"
              :clearable="false"
              @change="emit('dirty')"
            >
              <el-option v-for="o in selectOptions('密级')" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <template v-else>{{ head['密级'] || '' }}</template>
          </span>
        </div>
        <div class="as-info-row">
          <span class="as-info-label">{{ tt('文件使用范围') }}</span>
          <span class="as-info-value">
            <el-select
              v-if="editable"
              v-model="head['文件使用范围']"
              size="small"
              class="as-cell-input"
              :clearable="false"
              @change="emit('dirty')"
            >
              <el-option v-for="o in selectOptions('文件使用范围')" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <template v-else>{{ head['文件使用范围'] || '' }}</template>
          </span>
        </div>
      </div>
    </div>

    <!-- ③ 内容表 -->
    <div class="as-table">
      <!-- 单据信息行(引擎流水单号,原图空白模板无此行) -->
      <div class="as-info-line">
        <span class="as-doc-info">
          {{ tt('单据编号') }}：{{ head['单据编号'] || '' }}
        </span>
        <span class="as-doc-info">
          {{ tt('单据日期') }}：
          <el-date-picker
            v-if="editable"
            v-model="head['单据日期']"
            type="date"
            value-format="YYYY-MM-DD"
            size="small"
            class="as-date"
            :clearable="false"
            @change="emit('dirty')"
          />
          <template v-else>{{ head['单据日期'] || '' }}</template>
        </span>
      </div>

      <div class="as-row" v-for="sec in sections" :key="sec.key" :style="{ height: sec.h + 'px' }">
        <div class="as-no">{{ sec.num }}</div>
        <div class="as-name">{{ tt(sec.label) }}</div>
        <div class="as-fill">
          <!-- 可写字数仅编辑态右上角浅灰标识;只读/打印态不出现 -->
          <div v-if="editable && sec.max" class="as-limit" :title="tt('可写') + sec.max + tt('字')">{{ sec.max }}{{ tt('字') }}</div>
          <el-input
            v-if="editable && sec.kind === 'input'"
            v-model="head[sec.key]"
            type="text"
            :maxlength="sec.max || 50"
            :style="{ height: (sec.h - 14) + 'px' }"
            class="as-fill-input"
            @input="emit('dirty')"
          />
          <el-input
            v-else-if="editable"
            v-model="head[sec.key]"
            type="textarea"
            :rows="sec.h > 90 ? 4 : 2"
            :maxlength="sec.max"
            class="as-fill-input as-fill-area"
            resize="none"
            @input="emit('dirty')"
          />
          <div v-else class="as-ro-text">{{ head[sec.key] || '' }}</div>
        </div>
        <div class="as-deco"></div>
      </div>

      <!-- ④ 底部签名(对齐原图:申请立项人 蓝格=序号列+项目名列 202px;两半按原图 53/47) -->
      <div class="as-sign-row">
        <div class="as-sign-half as-sign-h1">
          <div class="as-sign-cell as-sign-c1">{{ tt('申请立项人') }}</div>
          <div class="as-sign-val">
            <el-input
              v-if="editable"
              v-model="head['申请立项人']"
              size="small"
              maxlength="50"
              class="as-cell-input"
              @input="emit('dirty')"
            />
            <template v-else>{{ head['申请立项人'] || '' }}</template>
          </div>
        </div>
        <div class="as-sign-half as-sign-h2">
          <div class="as-sign-cell as-sign-c2">{{ tt('申请立项日期') }}</div>
          <div class="as-sign-val">
            <el-date-picker
              v-if="editable"
              v-model="head['申请立项日期']"
              type="date"
              value-format="YYYY-MM-DD"
              size="small"
              class="as-date"
              :clearable="false"
              @change="emit('dirty')"
            />
            <template v-else>{{ head['申请立项日期'] || '' }}</template>
          </div>
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

/** 内容区行定义:num 序号 / label 字段标签(即数据键) / max 可写字数(0=不限,无标识;
 *  标识仅编辑态右上角浅灰小字,只读/打印不出现) / h 行高(对齐原图模板) / kind 控件类型 */
const sections = [
  { num: '一', label: '客户名', key: '客户名', max: 0, h: 47, kind: 'input' },
  { num: '二', label: '立项背景', key: '立项背景', max: 250, h: 96, kind: 'textarea' },
  { num: '三', label: '机型及应用位置', key: '机型及应用位置', max: 50, h: 58, kind: 'textarea' },
  { num: '四', label: '滤芯/炭棒规格或结构', key: '滤芯/炭棒规格或结构', max: 100, h: 71, kind: 'textarea' },
  { num: '五', label: '项目开发目标', key: '项目开发目标', max: 250, h: 155, kind: 'textarea' },
  { num: '六', label: '项目输出', key: '项目输出', max: 100, h: 97, kind: 'textarea' },
  { num: '七', label: '开发周期要求', key: '开发周期要求', max: 50, h: 45, kind: 'textarea' },
  { num: '八', label: '其它要求', key: '其它要求', max: 250, h: 132, kind: 'textarea' },
]

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))

function selectOptions(key) {
  const f = fieldMap.value.get(key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}
</script>

<style scoped>
/* ═══ 纸张主体 ═══ */
.approval-sheet {
  width: 940px;
  max-width: 100%;
  margin: 16px auto 26px;
  background: #fff;
  border: 1px solid #8a8a8a;
  font-size: 14px;
  color: #222;
}
.approval-sheet :deep(.as-cell-input) {
  width: 100%;
}
.approval-sheet :deep(.as-date) {
  width: 132px;
}
/* 输入控件去边框:保持原版表格线条(编辑/聚焦均无提示线) */
.approval-sheet :deep(.el-input__wrapper),
.approval-sheet :deep(.el-select__wrapper),
.approval-sheet :deep(.el-input__wrapper.is-focus),
.approval-sheet :deep(.el-select__wrapper.is-focused),
.approval-sheet :deep(.el-date-editor .el-input__wrapper),
.approval-sheet :deep(.el-date-editor .el-input__wrapper.is-focus),
.approval-sheet :deep(.el-textarea__inner) {
  box-shadow: none !important;
  border: none;
  background: transparent;
}
.approval-sheet :deep(.el-input__inner),
.approval-sheet :deep(.el-textarea__inner) {
  font-size: 14px;
  padding: 0;
}

/* ═══ ① 顶部条:公司名 | YJ-XS002 ═══ */
.as-topbar {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
  height: 40px;
}
.as-company {
  flex: 1;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 17px;
  color: #333;
  padding: 7px 12px 0;
}
.as-docno {
  width: 250px;
  flex: none;
  border-left: 1px solid #8a8a8a;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 14px;
  color: #333;
  text-align: right;
  padding: 8px 14px 0;
}

/* ═══ ② 标题行:大标题 + 信息表 ═══ */
.as-title-row {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
  min-height: 84px;
}
.as-title {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 30px;
  font-weight: 600;
  color: #1f5fa8;
  letter-spacing: 3px;
}
.as-info-table {
  width: 250px;
  flex: none;
  border-left: 1px solid #8a8a8a;
  display: flex;
  flex-direction: column;
}
.as-info-row {
  display: flex;
  flex: 1;
}
.as-info-row + .as-info-row {
  border-top: 1px solid #c9c9c9;
}
.as-info-label {
  width: 100px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 13px;
  color: #1f5fa8;
}
.as-info-value {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 8px;
  border-left: 1px solid #c9c9c9;
  font-size: 13px;
}

/* ═══ ③ 内容表 ═══ */
.as-table {
  border-top: none;
}
.as-info-line {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
  padding: 5px 12px;
  font-size: 13px;
}
.as-doc-info {
  flex: 1;
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.as-doc-info + .as-doc-info {
  padding-left: 20px;
}
.as-row {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
}
.as-no {
  width: 52px;
  flex: none;
  background: #29b8f0;
  color: #fff;
  font-size: 15px;
  display: flex;
  align-items: center;
  padding: 0 0 0 10px;
}
.as-name {
  width: 150px;
  flex: none;
  background: #29b8f0;
  color: #fff;
  font-size: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  text-align: center;
}
.as-fill {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 3px 6px;
}
.as-limit {
  position: absolute;
  top: 4px;
  right: 9px;
  font-size: 11px;
  line-height: 1;
  color: #b7bfca;
}
.as-fill-input {
  flex: 1;
}
.as-fill-area :deep(.el-textarea__inner) {
  line-height: 1.7;
}
.as-ro-text {
  flex: 1;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  padding: 2px 4px;
}
.as-deco {
  width: 245px;
  flex: none;
  border-left: 3px dotted #9a9a9a;
}

/* ═══ ④ 底部签名 ═══ */
.as-sign-row {
  display: flex;
  min-height: 54px;
}
.as-sign-half {
  display: flex;
}
.as-sign-h1 {
  flex: 0 0 53%;
}
.as-sign-h2 {
  flex: 1;
  border-left: 1px solid #8a8a8a;
}
.as-sign-cell {
  flex: none;
  background: #29b8f0;
  color: #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  text-align: center;
}
/* 申请立项人 蓝格与上部 序号列(52) + 项目名列(150) 对齐 */
.as-sign-c1 {
  width: 202px;
}
/* 申请立项日期 白底蓝字(与上部信息表标签一致) */
.as-sign-c2 {
  width: 150px;
  background: #fff;
  color: #1f5fa8;
}
.as-sign-val {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 10px;
  min-height: 50px;
}
</style>
