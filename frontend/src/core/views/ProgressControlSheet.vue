<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       产品开发二三四级项目控制列表(RD_PROGRESS)——文件类文书面板
       版式对齐原图:公司头/右上文档编号/蓝色大标题/右上信息区(密级、使用范围)/
       项目定级原则说明段/主从控制大表(项目(一/二级)|项目名称 + 子项目行,可增删)
       项目名称可手填或选择项目实施计划(选中自动带回实施计划同名字段)
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="progress-sheet">
    <!-- ① 顶部条 -->
    <div class="ps-topbar">
      <div class="ps-company">惠州市银嘉环保科技有限公司</div>
      <div class="ps-docno">
        <el-input
          v-if="editable"
          v-model="head['文档编号']"
          size="small"
          maxlength="30"
          class="ps-docno-input"
          @input="emit('dirty')"
        />
        <template v-else>{{ head['文档编号'] || 'YJ-XS002' }}</template>
      </div>
    </div>

    <!-- ② 标题行:大标题 + 右上信息区(密级/使用范围) -->
    <div class="ps-title-row">
      <div class="ps-title">{{ tt('产品开发二三四级项目控制列表') }}</div>
      <div class="ps-info-table">
        <div class="ps-info-row">
          <span class="ps-info-label">{{ tt('密级') }}</span>
          <span class="ps-info-value">
            <el-select
              v-if="editable"
              v-model="head['密级']"
              size="small"
              class="ps-cell-input"
              :clearable="false"
              @change="emit('dirty')"
            >
              <el-option v-for="o in selectOptions('密级')" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <template v-else>{{ head['密级'] || '' }}</template>
          </span>
        </div>
        <div class="ps-info-row">
          <span class="ps-info-label">{{ tt('文件使用范围') }}</span>
          <span class="ps-info-value">
            <el-select
              v-if="editable"
              v-model="head['文件使用范围']"
              size="small"
              class="ps-cell-input"
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

    <!-- ③ 项目定级原则说明段(打印/导出保留,原图固定文本) -->
    <div class="ps-principle">{{ tt('项目定级原则') }}：1. 二级项目=形成B级客户或该产品一年内有望给经济收益、对应技术产品有重大推广价值、部分对客户新品有重大影响的项目；2. 三级项目=针对小批量订单或客户有较大需求、能够为下一年下半年带来显著收益的项目；3. 四级项目=单机项目（型试验单）。</div>

    <!-- ⑤ 主从控制表 -->
    <div class="ps-scroll">
      <table class="ps-table">
        <thead>
          <tr>
            <th class="c-level">{{ tt('项目(一/二级)') }}</th>
            <th class="c-name">{{ tt('项目名称') }}</th>
            <th class="c-sub">{{ tt('子项目/尺寸') }}</th>
            <th class="c-remark">{{ tt('说明') }}</th>
            <th class="c-content">{{ tt('内容') }}</th>
            <th class="c-grade">{{ tt('项目级') }}</th>
            <th class="c-owner">{{ tt('项目负责') }}</th>
            <th class="c-progress">{{ tt('实施进度') }}</th>
            <th class="c-mile">{{ tt('里程完成') }}</th>
            <th class="c-status">{{ tt('状态') }}</th>
            <th class="c-tester">{{ tt('测试员') }}</th>
            <th class="c-approve">{{ tt('谁来批准') }}</th>
            <th class="c-inspect">{{ tt('谁来检验') }}</th>
            <th class="c-reason">{{ tt('未批准原因') }}</th>
            <th v-if="editable" class="c-op"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in items" :key="row.id ?? ('new' + i)" :class="{ 'grp-first': i === 0 }">
            <td class="c-level">
              <span v-if="i > 0" class="ps-cell-text">{{ head['项目(一/二级)'] || '' }}</span>
              <el-select
                v-else-if="editable"
                v-model="head['项目(一/二级)']"
                size="small"
                :clearable="false"
                @change="emit('dirty')"
              >
                <el-option v-for="o in selectOptions('项目(一/二级)')" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <span v-else class="ps-cell-text">{{ head['项目(一/二级)'] || '' }}</span>
            </td>
            <td class="c-name">
              <el-select
                v-if="i === 0 && editable"
                v-model="head['项目名称']"
                filterable
                allow-create
                default-first-option
                clearable
                size="small"
                :loading="refLoading"
                @change="onPickProject"
                @input="emit('dirty')"
              >
                <el-option v-for="o in refOptions" :key="o" :label="o" :value="o" />
              </el-select>
              <span v-else-if="i === 0" class="ps-cell-text">{{ head['项目名称'] || '' }}</span>
            </td>
            <td class="c-sub">
              <el-input v-if="editable" v-model="row['子项目/尺寸']" size="small" class="ps-cell-input" maxlength="100" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['子项目/尺寸'] || '' }}</span>
            </td>
            <td class="c-remark">
              <el-input v-if="editable" v-model="row['说明']" size="small" class="ps-cell-input" maxlength="200" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['说明'] || '' }}</span>
            </td>
            <td class="c-content">
              <el-input v-if="editable" v-model="row['内容']" size="small" class="ps-cell-input" maxlength="500" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['内容'] || '' }}</span>
            </td>
            <td class="c-grade">
              <el-input v-if="editable" v-model="row['项目级']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['项目级'] || '' }}</span>
            </td>
            <td class="c-owner">
              <el-input v-if="editable" v-model="row['项目负责']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['项目负责'] || '' }}</span>
            </td>
            <td class="c-progress">
              <el-input v-if="editable" v-model="row['实施进度']" size="small" class="ps-cell-input" maxlength="200" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['实施进度'] || '' }}</span>
            </td>
            <td class="c-mile">
              <el-select v-if="editable" v-model="row['里程完成']" size="small" :clearable="true" @change="emit('dirty')">
                <el-option v-for="o in selectOptions('里程完成')" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <span v-else class="ps-cell-text">{{ row['里程完成'] || '' }}</span>
            </td>
            <td class="c-status">
              <el-select v-if="editable" v-model="row['状态']" size="small" :clearable="true" @change="emit('dirty')">
                <el-option v-for="o in selectOptions('状态')" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <span v-else class="ps-cell-text">{{ row['状态'] || '' }}</span>
            </td>
            <td class="c-tester">
              <el-input v-if="editable" v-model="row['测试员']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['测试员'] || '' }}</span>
            </td>
            <td class="c-approve">
              <el-input v-if="editable" v-model="row['谁来批准']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['谁来批准'] || '' }}</span>
            </td>
            <td class="c-inspect">
              <el-input v-if="editable" v-model="row['谁来检验']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['谁来检验'] || '' }}</span>
            </td>
            <td class="c-reason">
              <el-input v-if="editable" v-model="row['未批准原因']" size="small" class="ps-cell-input" maxlength="200" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['未批准原因'] || '' }}</span>
            </td>
            <td v-if="editable" class="c-op">
              <span class="ps-del" :title="tt('删除该子项目')" @click="removeItem(i)">×</span>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td :colspan="editable ? 15 : 14" class="ps-empty">{{ tt('暂无子项目，点击下方按钮新增') }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="editable" class="ps-add" @click="addItem">＋ {{ tt('新增子项目') }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

const engine = usePanelRuntime()

/** 子项目行(来自当前单据 detail.items;新增行无 id,保存后由引擎写入) */
const items = computed(() => {
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
function selectOptions(key) {
  const f = fieldMap.value.get(key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// ---------- 项目名称:填选实施计划项目(≤200 条选项;选中带回实施计划同名字段) ----------
const refOptions = ref([])
const refRows = ref([])
const refLoading = ref(false)
async function loadRefOptions() {
  if (refOptions.value.length) return
  refLoading.value = true
  try {
    const res = await engine.queryFormDataList({ panelCode: 'RD_PLAN', condition: {}, pageNo: 1, pageSize: 200 })
    const rows = res.list || []
    refRows.value = rows
    refOptions.value = rows.map((r) => r['项目名称']).filter(Boolean)
  } catch (e) {
    /* 实施计划未就绪时静默 */
  } finally {
    refLoading.value = false
  }
}
onMounted(loadRefOptions)
watch(() => props.editable, (v) => { if (v) loadRefOptions() })

/** 选项目实施计划项目:带回同名字段(项目定级/测试内容/…),覆盖当前 head 对应键 */
function onPickProject(v) {
  const row = refRows.value.find((r) => r['项目名称'] === v)
  if (row) {
    const keys = ['项目定级', '测试内容', '测试产品打样要求', '测试目标', '测试条件', '测试方法', '测试标准']
    for (const k of keys) {
      if (row[k] != null && row[k] !== '') props.head[k] = row[k]
    }
  }
  emit('dirty')
}

// ---------- 子项目行增删 ----------
function addItem() {
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  d.items.push({})
  emit('dirty')
}
function removeItem(i) {
  const d = props.head.detail
  if (d && Array.isArray(d.items)) d.items.splice(i, 1)
  emit('dirty')
}
</script>

<style scoped>
/* ═══ 纸张主体(宽表格,原图纵横向扩展) ═══ */
.progress-sheet {
  width: 1240px;
  max-width: 100%;
  margin: 16px auto 26px;
  background: #fff;
  border: 1px solid #8a8a8a;
  font-size: 13px;
  color: #222;
}
.progress-sheet :deep(.ps-cell-input) {
  width: 100%;
}
.progress-sheet :deep(.ps-cell-input .el-input__wrapper),
.progress-sheet :deep(.ps-select-row .el-select__wrapper),
.progress-sheet :deep(.ps-info-table .el-select__wrapper) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  min-height: 22px;
  padding: 0 2px;
}
.progress-sheet :deep(.ps-cell-input .el-input__inner) {
  font-size: 13px;
  padding: 0;
}
.progress-sheet :deep(.ps-info-table .el-select__wrapper),
.progress-sheet :deep(.ps-select-row .el-select__wrapper) {
  border: 1px solid #c8d6e5;
  background: #fff;
  min-height: 24px;
}

/* ═══ ① 顶部条 ═══ */
.ps-topbar {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
  height: 40px;
}
.ps-company {
  flex: 1;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 17px;
  color: #333;
  padding: 7px 12px 0;
}
.ps-docno {
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
}
.ps-docno-input {
  width: 130px;
}
.ps-docno-input :deep(.el-input__inner) {
  text-align: right;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 14px;
  padding: 0;
}

/* ═══ ② 标题行 + 信息区 ═══ */
.ps-title-row {
  display: flex;
  border-bottom: 1px solid #8a8a8a;
  min-height: 60px;
}
.ps-title {
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
.ps-info-table {
  width: 250px;
  flex: none;
  border-left: 1px solid #8a8a8a;
  display: flex;
  flex-direction: column;
}
.ps-info-row {
  display: flex;
  flex: 1;
}
.ps-info-row + .ps-info-row {
  border-top: 1px solid #c9c9c9;
}
.ps-info-label {
  width: 100px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 13px;
  color: #1f5fa8;
}
.ps-info-value {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 8px;
  border-left: 1px solid #c9c9c9;
  font-size: 13px;
}

/* ═══ ④ 原则说明段(浅粉底) ═══ */
.ps-principle {
  padding: 6px 14px;
  background: #fdeef0;
  border-bottom: 1px solid #8a8a8a;
  font-size: 12.5px;
  line-height: 1.6;
  color: #6b3a3a;
}

/* ═══ ⑤ 控制表 ═══ */
.ps-scroll {
  overflow-x: auto;
}
.ps-table {
  width: 100%;
  min-width: 1480px;
  border-collapse: collapse;
  table-layout: fixed;
}
.ps-table th,
.ps-table td {
  border: 1px solid #9a9a9a;
  padding: 3px 5px;
  vertical-align: middle;
  font-size: 12.5px;
}
.ps-table th {
  background: #b9dbf8;
  color: #1f5fa8;
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
  text-decoration: underline;
}
.ps-table td {
  background: #fff;
  height: 24px;
}
.ps-table tr:hover td {
  background: #f7fbff;
}
.c-level { width: 70px; }
.c-name { width: 150px; }
.c-sub { width: 120px; }
.c-remark { width: 130px; }
.c-content { width: 150px; }
.c-grade { width: 70px; }
.c-owner { width: 78px; }
.c-progress { width: 150px; }
.c-mile { width: 78px; }
.c-status { width: 96px; }
.c-tester { width: 76px; }
.c-approve { width: 76px; }
.c-inspect { width: 76px; }
.c-reason { width: 140px; }
.c-op { width: 30px; text-align: center; }
.ps-cell-text {
  display: inline-block;
  width: 100%;
  word-break: break-all;
}
.ps-del {
  display: inline-block;
  color: #c0392b;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
}
.ps-del:hover {
  color: #e74c3c;
  font-weight: 700;
}
.ps-empty {
  text-align: center;
  color: #98a4b3;
  padding: 18px 0 !important;
}
.ps-add {
  margin: 6px 8px;
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
.ps-add:hover {
  background: #e8f2ff;
  border-style: solid;
}
</style>

<!-- 打印整张:只保留纸张 -->
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
  body.approval-printing .progress-sheet {
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
  body.approval-printing .progress-sheet,
  body.approval-printing .progress-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .progress-sheet svg {
    display: none !important;
  }
  body.approval-printing .ps-add,
  body.approval-printing .ps-del {
    display: none !important;
  }
  /* 打印按纸张自适应(取消固定宽表),字号压缩 */
  body.approval-printing .ps-scroll {
    overflow: visible !important;
  }
  body.approval-printing .ps-table {
    min-width: 100% !important;
  }
  body.approval-printing .ps-table th,
  body.approval-printing .ps-table td {
    font-size: 11px !important;
    padding: 2px 4px !important;
  }
  @page {
    margin: 8mm;
  }
}
</style>
