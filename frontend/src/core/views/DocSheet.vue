<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       文件类文书面板(DocSheet):按 config 渲染《立项申请表》/《项目实施计划》等纸面版式
       config 见 docSheetConfigs.js:
       ① 顶部条:公司名(斜体)| 文档编号(可编辑)
       ② 标题行:大标题(左区居中)| 信息表(文件管理人/密级/文件使用范围)
       ③ 内容区:序号列(蓝底)+ 项目名(蓝底)+ 填写区(可写字数标识)+ 可选点状虚线装饰列
       ④ 底部签名:signCells(蓝格标签 + 值区)
       数据键全部为字段 label;保存/审批/导出复用引擎既有逻辑,本组件只负责呈现与置脏。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="approval-sheet">
    <!-- ① 顶部条 -->
    <div class="as-topbar">
      <div class="as-company">惠州市银嘉环保科技有限公司</div>
      <div class="as-docno">
        <el-input
          v-if="editable"
          v-model="head['文档编号']"
          size="small"
          maxlength="30"
          class="as-docno-input"
          @input="emit('dirty')"
        />
        <template v-else>{{ head['文档编号'] || 'YJ-XS002' }}</template>
      </div>
    </div>

    <!-- ② 标题行:大标题 + 右上信息表 -->
    <div class="as-title-row">
      <div class="as-title">{{ tt(config.titlePart1) }}（{{ tt(config.titlePart2) }}）{{ tt(config.titlePart3) }}</div>
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
      <!-- 单字段行 / 多子区行 -->
      <template v-for="(row, ri) in config.rows" :key="row.key || row.label">
        <div v-if="!row.subs" class="as-row" :style="{ height: row.h + 'px' }">
          <div class="as-no">{{ row.num }}</div>
          <div class="as-name">{{ tt(row.label) }}</div>
          <div class="as-fill">
            <div v-if="row.hint" class="as-hint">{{ tt(row.hint) }}</div>
            <el-input
              v-if="editable && row.kind === 'input'"
              v-model="head[row.key]"
              type="text"
              :maxlength="row.max || 50"
              :style="{ height: (row.h - 14) + 'px' }"
              class="as-fill-input"
              @input="emit('dirty')"
            />
            <el-input
              v-else-if="editable"
              v-model="head[row.key]"
              type="textarea"
              :rows="row.h > 90 ? 4 : 2"
              :maxlength="row.max || 2000"
              class="as-fill-input as-fill-area"
              resize="none"
              @input="emit('dirty')"
            />
            <div v-else class="as-ro-text">{{ head[row.key] || '' }}</div>
          </div>
          <div v-if="config.deco" class="as-deco"></div>
        </div>

        <!-- 多子区行:如 测试方案(条件/方法/标准) -->
        <div v-else class="as-row" :style="{ height: row.h + 'px' }">
          <div class="as-no">{{ row.num }}</div>
          <div class="as-name">{{ tt(row.label) }}</div>
          <div class="as-fill as-fill-multi">
            <div v-for="(sub, si) in row.subs" :key="sub.key" class="as-sub" :class="{ first: si === 0 }">
              <div class="as-sub-label">{{ tt(sub.label) }}：{{ sub.max }}{{ tt('字') }}</div>
              <el-input
                v-if="editable"
                v-model="head[sub.key]"
                type="textarea"
                :maxlength="sub.max"
                rows="2"
                class="as-fill-input as-fill-area"
                resize="none"
                @input="emit('dirty')"
              />
              <div v-else class="as-ro-text">{{ head[sub.key] || '' }}</div>
            </div>
          </div>
          <div v-if="config.deco" class="as-deco"></div>
        </div>
      </template>

      <!-- ④ 底部签名(如 申请立项人/申请立项日期、负责人/编制日期) -->
      <div class="as-sign-row">
        <div v-for="(c, ci) in config.signCells" :key="c.key" class="as-sign-pair" :style="{ flex: c.flex }">
          <div class="as-sign-cell" :class="{ 'white-shell': c.white }" :style="{ width: c.w + 'px' }">{{ tt(c.label) }}</div>
          <div class="as-sign-val">
            <el-input
              v-if="editable && c.type === 'text'"
              v-model="head[c.key]"
              size="small"
              maxlength="50"
              class="as-cell-input"
              @input="emit('dirty')"
            />
            <el-date-picker
              v-else-if="editable"
              v-model="head[c.key]"
              type="date"
              value-format="YYYY-MM-DD"
              size="small"
              class="as-date"
              :clearable="false"
              @change="emit('dirty')"
            />
            <template v-else>{{ head[c.key] || '' }}</template>
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
  config: { type: Object, required: true },
})
const emit = defineEmits(['dirty'])

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

/* ═══ ① 顶部条:公司名 | 文档编号 ═══ */
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
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
}
.as-docno-input {
  width: 130px;
}
.as-docno-input :deep(.el-input__inner) {
  text-align: right;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 14px;
  padding: 0;
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
.as-hint {
  font-size: 14px;
  color: #333;
  line-height: 20px;
  padding-left: 2px;
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
  width: 250px;
  flex: none;
  border-left: 3px dotted #9a9a9a;
}
/* 多子区行:如 测试方案(条件/方法/标准) */
.as-fill-multi {
  padding: 0 6px;
}
.as-sub {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 2px 4px;
}
.as-sub + .as-sub {
  border-top: 1px solid #c9c9c9;
}
.as-sub-label {
  font-size: 14px;
  color: #333;
  line-height: 20px;
}

/* ═══ ④ 底部签名 ═══ */
.as-sign-row {
  display: flex;
  min-height: 54px;
}
.as-sign-pair {
  display: flex;
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
/* 白底蓝字标签(如 申请立项日期 自定义) */
.as-sign-cell.white-shell {
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

<!-- 打印/导出整张文书:只保留文书纸张,隐藏布局菜单/侧栏/其它页面元素 -->
<style>
@media print {
  body.approval-printing .portal {
    visibility: hidden;
  }
  body.approval-printing .topbar,
  body.approval-printing .func-zone,
  body.approval-printing .tabsbar,
  body.approval-printing .help-panel,
  body.approval-printing .nav-mask,
  body.approval-printing .approval-side,
  body.approval-printing .tools {
    display: none !important;
  }
  body.approval-printing .portal-body,
  body.approval-printing .portal-main,
  body.approval-printing .portal-content,
  body.approval-printing .panelx-list,
  body.approval-printing .approval-layout {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
    padding-right: 0 !important;
    margin: 0 !important;
  }
  body.approval-printing .approval-sheet {
    visibility: visible !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    border: 1px solid #8a8a8a !important;
    box-shadow: none !important;
  }
  /* 强制打印背景色(蓝底标签/序号列),否则浏览器打印默认丢弃背景 */
  body.approval-printing .approval-sheet,
  body.approval-printing .approval-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  /* 控件图标(下拉箭头/日历)不打印,输出与原版线条一致 */
  body.approval-printing .approval-sheet svg {
    display: none !important;
  }
  @page {
    margin: 8mm;
  }
}
</style>
