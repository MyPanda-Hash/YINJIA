<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       产品开发二三四级项目控制列表(RD_PROGRESS)——文件类文书面板
       版式对齐原图:公司头/右上文档编号/蓝色大标题/右上信息区(密级、使用范围)/
       项目定级原则说明段/主从控制大表(项目等级|项目名称 + 子项目行,可增删)
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
            <th class="c-level">{{ tt('项目等级') }}</th>
            <th class="c-name">{{ tt('项目名称') }}</th>
            <th class="c-sub">{{ tt('子项目/尺寸') }}</th>
            <th class="c-remark">{{ tt('项目编号') }}</th>
            <th class="c-content">{{ tt('内容') }}</th>
            <th class="c-grade">{{ tt('项目发起人') }}</th>
            <th class="c-owner">{{ tt('项目负责人') }}</th>
            <th class="c-progress">{{ tt('立项日期') }}</th>
            <th class="c-mile">{{ tt('预计完成日期') }}</th>
            <th class="c-status">{{ tt('状态') }}</th>
            <th class="c-tester">{{ tt('测试情况') }}</th>
            <th class="c-approve">{{ tt('技术目标达成') }}</th>
            <th class="c-inspect">{{ tt('是否市场转化') }}</th>
            <th class="c-reason">{{ tt('未转换原因') }}</th>
            <th v-if="editable" class="c-op"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in items" :key="row.id ?? ('new' + i)">
            <td v-if="isLevelHead(i)" class="c-level" :rowspan="levelSpan(i)">
              <el-select
                v-if="editable"
                :model-value="row['项目等级']"
                size="small"
                :clearable="false"
                @change="changeGroupLevel(i, $event)"
              >
                <el-option v-for="o in selectOptions('项目等级')" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <span v-else class="ps-level-block">{{ row['项目等级'] || '' }}</span>
            </td>
            <td v-if="isGroupHead(i)" class="c-name" :rowspan="groupSpan(i)">
              <el-select
                v-if="editable"
                :model-value="row['项目名称']"
                filterable
                allow-create
                default-first-option
                clearable
                size="small"
                :loading="refLoading"
                @change="changeGroupName(i, $event)"
              >
                <el-option v-for="o in refOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <span v-else class="ps-cell-text ps-name-block">{{ row['项目名称'] || '' }}</span>
            </td>
            <td class="c-sub">
              <el-input v-if="editable" v-model="row['子项目/尺寸']" size="small" class="ps-cell-input" maxlength="100" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['子项目/尺寸'] || '' }}</span>
            </td>
            <td class="c-remark">
              <el-input v-if="editable" v-model="row['项目编号']" size="small" class="ps-cell-input" maxlength="200" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['项目编号'] || '' }}</span>
            </td>
            <td class="c-content">
              <el-input v-if="editable" v-model="row['内容']" size="small" class="ps-cell-input" maxlength="500" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['内容'] || '' }}</span>
            </td>
            <td class="c-grade">
              <el-input v-if="editable" v-model="row['项目发起人']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['项目发起人'] || '' }}</span>
            </td>
            <td class="c-owner">
              <el-input v-if="editable" v-model="row['项目负责人']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['项目负责人'] || '' }}</span>
            </td>
            <td class="c-progress">
              <el-input v-if="editable" v-model="row['立项日期']" size="small" class="ps-cell-input" maxlength="200" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['立项日期'] || '' }}</span>
            </td>
            <td class="c-mile">
              <el-input v-if="editable" v-model="row['预计完成日期']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['预计完成日期'] || '' }}</span>
            </td>
            <td class="c-status">
              <el-input v-if="editable" v-model="row['状态']" size="small" class="ps-cell-input" maxlength="100" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['状态'] || '' }}</span>
            </td>
            <td class="c-tester">
              <el-input v-if="editable" v-model="row['测试情况']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['测试情况'] || '' }}</span>
            </td>
            <td class="c-approve">
              <el-input v-if="editable" v-model="row['技术目标达成']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['技术目标达成'] || '' }}</span>
            </td>
            <td class="c-inspect">
              <el-input v-if="editable" v-model="row['是否市场转化']" size="small" class="ps-cell-input" maxlength="50" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['是否市场转化'] || '' }}</span>
            </td>
            <td class="c-reason">
              <el-input v-if="editable" v-model="row['未转换原因']" size="small" class="ps-cell-input" maxlength="200" @input="emit('dirty')" />
              <span v-else class="ps-cell-text">{{ row['未转换原因'] || '' }}</span>
            </td>
            <td v-if="editable" class="c-op">
              <span class="ps-addrow" :title="tt('在该项目后新增子项目')" @click="insertAfter(i)">＋</span>
              <span class="ps-del" :title="tt('删除该子项目')" @click="removeItem(i)">×</span>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td :colspan="editable ? 15 : 14" class="ps-empty">{{ tt('暂无子项目，点击下方按钮新增') }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="editable" class="ps-addbar">
        <div class="ps-add" @click="openAddProject">＋ {{ tt('新增项目') }}</div>
      </div>
    </div>

    <!-- 新增项目弹窗:选等级 + 项目名称(手填/选项目实施计划项目,选项带实施计划单据号,选中导入相关信息) -->
    <el-dialog v-model="dlgVisible" :title="tt('新增项目')" width="400px" append-to-body>
      <div class="ps-dlg-row">
        <span class="ps-dlg-label">{{ tt('项目等级') }}</span>
        <el-select v-model="dlgLevel" size="default" :clearable="false" style="width: 220px">
          <el-option v-for="o in selectOptions('项目等级')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </div>
      <div class="ps-dlg-row">
        <span class="ps-dlg-label">{{ tt('项目名称') }}</span>
        <el-select
          v-model="dlgName"
          filterable
          allow-create
          default-first-option
          clearable
          size="default"
          style="width: 220px"
          :loading="refLoading"
        >
          <el-option v-for="o in refOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </div>
      <div class="ps-dlg-tip">{{ tt('下拉可选择项目实施计划项目（含其实施计划单号），选中后自动导入实施计划相关信息；也可直接输入新项目名称。') }}</div>
      <template #footer>
        <el-button @click="dlgVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="confirmAddProject">{{ tt('确定') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
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
    // 选项:项目名称（实施计划单号,如 LXB2609040001）
    refOptions.value = rows
      .filter((r) => r['项目名称'])
      .map((r) => ({ value: r['项目名称'], label: `${r['项目名称']}（${r['单据编号'] || r['编号'] || ''}）` }))
  } catch (e) {
    /* 实施计划未就绪时静默 */
  } finally {
    refLoading.value = false
  }
}
onMounted(loadRefOptions)
watch(() => props.editable, (v) => { if (v) loadRefOptions() })

// ---------- 项目(组)/子项目 行增删 ----------
/** 组首行:与上一行项目名称不同(或首行) → 显示 项目名称/层级 输入,否则并入上一组 */
function isGroupHead(i) {
  if (i <= 0) return true
  return items.value[i]?.['项目名称'] !== items.value[i - 1]?.['项目名称']
}
/** 等级头行:只读态相邻同级合并为一个"项目等级"块 */
function isLevelHead(i) {
  if (i <= 0) return true
  const lv = items.value[i]?.['项目等级']
  if (!lv) return true
  return items.value[i - 1]?.['项目等级'] !== lv
}
/** 相邻同级行数(等级合并块) */
function levelSpan(i) {
  if (!isLevelHead(i)) return 0
  const lv = items.value[i]?.['项目等级']
  if (!lv) return 1
  let n = 1
  while (i + n < items.value.length && items.value[i + n]?.['项目等级'] === lv) n++
  return n
}
/** 组内行数(名称列 rowspan 合并铺满整组;空名称新组不合并) */
function groupSpan(i) {
  if (!isGroupHead(i)) return 0
  const name = items.value[i]?.['项目名称']
  if (!name) return 1
  let n = 1
  while (i + n < items.value.length && items.value[i + n]?.['项目名称'] === name) n++
  return n
}
/** 组首行名称变更:同步组内同名行 + 选实施计划项目带回同名字段 */
function changeGroupName(i, v) {
  const row = items.value[i]
  const old = row['项目名称']
  row['项目名称'] = v
  let j = i + 1
  while (j < items.value.length && items.value[j]['项目名称'] === old) {
    items.value[j]['项目名称'] = v
    j++
  }
  const found = refRows.value.find((r) => r['项目名称'] === v)
  if (found) {
    const keys = ['项目定级', '测试内容', '测试产品打样要求', '测试目标', '测试条件', '测试方法', '测试标准']
    for (const k of keys) {
      if (found[k] != null && found[k] !== '') props.head[k] = found[k]
    }
  }
  emit('dirty')
}
/** 同步组内层级(组首行层级变更时) */
function changeGroupLevel(i, v) {
  const row = items.value[i]
  row['项目等级'] = v
  for (let j = i + 1; j < items.value.length && items.value[j]?.['项目名称'] === row['项目名称']; j++) {
    items.value[j]['项目等级'] = v
  }
  emit('dirty')
}
/** 新增项目:点击按钮弹窗(选等级 + 项目名称 手填/选实施计划项目),自动归入对应等级块 */
const dlgVisible = ref(false)
const dlgName = ref('')
const dlgLevel = ref('二级')
function openAddProject() {
  dlgName.value = ''
  dlgLevel.value = '二级'
  dlgVisible.value = true
}
function confirmAddProject() {
  const name = String(dlgName.value || '').trim()
  if (!name) {
    ElMessage.warning(tt('请填写项目名称'))
    return
  }
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  const lv = dlgLevel.value || '二级'
  const row = { '项目名称': name, '项目等级': lv }
  let idx = -1
  for (let i = d.items.length - 1; i >= 0; i--) {
    if (d.items[i]['项目等级'] === lv) { idx = i; break }
  }
  if (idx >= 0) d.items.splice(idx + 1, 0, row)
  else d.items.push(row)
  // 选实施计划项目:自动导入实施计划相关信息(项目定级/测试内容/…)
  const found = refRows.value.find((r) => r['项目名称'] === name)
  if (found) {
    const keys = ['项目定级', '测试内容', '测试产品打样要求', '测试目标', '测试条件', '测试方法', '测试标准']
    for (const k of keys) {
      if (found[k] != null && found[k] !== '') props.head[k] = found[k]
    }
  }
  dlgVisible.value = false
  emit('dirty')
}
/** 在当前子项目后插入同组新子项目(复制所属项目名称/层级) */
function insertAfter(i) {
  const d = props.head.detail
  if (!Array.isArray(d.items)) return
  const src = d.items[i] || {}
  d.items.splice(i + 1, 0, { '项目名称': src['项目名称'], '项目等级': src['项目等级'] })
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
  table-layout: auto;
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
.c-level { min-width: 100px; }
.c-name { min-width: 150px; }
/* 项目名称合并块:铺满组内子项目行,浅蓝底,文字居中(对齐原图) */
.ps-table td.c-name {
  background: #d9ecfb;
  color: #1f5fa8;
  vertical-align: middle;
  text-align: center;
}
.ps-name-block {
  display: inline-block;
  width: 100%;
  font-size: 16px;
  font-weight: 600;
  word-break: break-all;
}
/* 项目等级合并块:同级归入同一等级目录只显示一次,深灰蓝底白字,放大居中 */
.ps-table td.c-level {
  background: #7890ab;
  color: #fff;
  vertical-align: middle;
  text-align: center;
}
.ps-level-block {
  display: inline-block;
  width: 100%;
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
  word-break: keep-all;
}
/* 编辑态等级块内下拉底色透明(与块色调和),选中文字完整显示 */
.ps-table td.c-level :deep(.el-select__wrapper) {
  background: transparent;
  box-shadow: none !important;
  border: none;
}
.ps-table td.c-level :deep(.el-select__selected-item) {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  overflow: visible;
}
/* 新增项目条(弹窗入口) */
.ps-addbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 6px 8px;
}
/* 新增项目弹窗 */
.ps-dlg-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.ps-dlg-label {
  width: 72px;
  text-align: right;
  color: #333;
  font-weight: 600;
}
.ps-dlg-tip {
  font-size: 12px;
  color: #8a97a6;
  line-height: 1.5;
}
.c-sub { min-width: 120px; }
.c-remark { min-width: 130px; }
.c-content { min-width: 150px; }
.c-grade { min-width: 70px; }
.c-owner { min-width: 78px; }
.c-progress { min-width: 150px; }
.c-mile { min-width: 110px; }
.c-status { min-width: 96px; }
.c-tester { min-width: 76px; }
.c-approve { min-width: 76px; }
.c-inspect { min-width: 76px; }
.c-reason { min-width: 140px; }
.c-op { min-width: 30px; text-align: center; }
/* 长文本列:按内容自适应但设上限,超出自动换行,不被列栏盖住 */
.ps-table td.c-remark,
.ps-table td.c-content,
.ps-table td.c-status,
.ps-table td.c-tester,
.ps-table td.c-reason,
.ps-table td.c-progress {
  max-width: 240px;
}
.ps-table td.c-status {
  max-width: 210px;
}
.ps-table td.c-reason {
  max-width: 170px;
}
.ps-table td.c-remark {
  max-width: 170px;
}
.ps-cell-text {
  display: inline-block;
  width: 100%;
  word-break: break-all;
}
.ps-addrow {
  display: inline-block;
  color: #0d5bd3;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
  margin-right: 4px;
}
.ps-addrow:hover {
  font-weight: 700;
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
  /* 打印按纸张自适应:14 列均分页宽,小字号可断行,避免右侧字段被裁切 */
  body.approval-printing .ps-scroll {
    overflow: visible !important;
  }
  body.approval-printing .ps-table {
    min-width: 100% !important;
    table-layout: fixed !important;
  }
  body.approval-printing .ps-table th,
  body.approval-printing .ps-table td {
    width: auto !important;
    font-size: 10px !important;
    padding: 1px 2px !important;
    word-break: break-all !important;
    white-space: normal !important;
    height: auto !important;
    line-height: 1.3 !important;
  }
  body.approval-printing .ps-cell-text,
  body.approval-printing .ps-table .el-input__inner,
  body.approval-printing .ps-table .el-textarea__inner {
    font-size: 10px !important;
  }
  body.approval-printing .ps-company,
  body.approval-printing .ps-title {
    font-size: 22px !important;
  }
  @page {
    margin: 8mm;
  }
}
</style>
