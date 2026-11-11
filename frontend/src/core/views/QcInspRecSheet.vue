<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       来料品质·检验数据记录(QC_INSP_REC)—— 纸张式检验报告(YJ-QR-96)
       版式一比一照《品质资料 2026.09.19.xlsx》「检验数据记录模版」页签:
       标题「检验报告」/ 抬头四对(物料名称·检验日期 …) / 分区「检验结果」
       表体四列(检验项·检测标准·检测结果·单项判定) / 检验结论·处理意见 / 检验人·审核人
       呈现方式与项目进度查询同族:纸张 + 右侧竖排操作栏(PanelxList approval-layout 提供)
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="qc-rec-sheet">
    <!-- ① 标题(右侧带来料检验单号链接,2026-10-19 用户口径 task 6「检验报告右边带来料检验单单号的链接」:
         报告由检验单生单时自动建,「来料检验单号」在建单那一刻落库(QcCatalogService.createInspRecord),
         这里只负责把它渲染成一条可点的链接 —— 点它切到该检验单并定位;打印不出现(no-print)。 -->
    <div class="qr-titlerow">
      <div class="qr-title">{{ tt('检验报告') }}</div>
      <div v-if="inspNo" class="qr-doclink no-print" :title="tt('跳转到该来料检验单')" @click="gotoInsp">
        ⧉ {{ tt('来料检验单') }} {{ inspNo }}
      </div>
    </div>

    <!-- ② 抬头(四行 × 标签/值 两对,对齐原表 B|C:D|E|F:I) -->
    <table class="qr-head-table">
      <colgroup>
        <col class="fc-label" />
        <col class="fc-v1" />
        <col class="fc-label2" />
        <col class="fc-v2" />
      </colgroup>
      <tbody>
        <tr v-for="(pair, ri) in QC_INSP_REC_HEAD_ROWS" :key="'h' + ri">
          <template v-for="cell in pair" :key="cell.key">
            <th class="qr-label">{{ tt(cell.label) }}</th>
            <!-- 物料编码的值格:编码 右侧跟「检验要求」查看链接 —— 2026-09-23
                 用户口径「把检验要求的链接放在右边物料编码后面」;纸面打印不出现(no-print) -->
            <td class="qr-value" :class="{ 'qr-value-code': cell.key === '物料编码' }">
              <!-- 商品参照(2026-10-09 用户口径:「物料名称和物料编码要关联商品,并且要两个一并填入」):
                   两列都是参照 商品档案(INV)的字段 ⇒ 点格子弹参照,选一条商品后
                   主字段写 refField,再按 refMap 整串带回 —— 存货编码↔物料名称 的同义映射
                   让**两个字段一次填齐**(映射由后端 buildRefMap 现算,前端不硬编码列名)。
                   与 DataRecordSheet/RecordSheetPanels 的参照单元格同款:拟态输入框,点击即选。 -->
              <div
                v-if="editable && !cell.locked && isRefKey(cell.key)"
                class="qr-ref-ctl"
                :title="tt('点击选择')"
                @click="openRefPick(cell.key)"
              >
                <span class="qr-ref-text" :class="{ 'is-empty': !head[cell.key] }">{{ head[cell.key] || tt('点击选择') }}</span>
                <el-icon class="qr-ref-ico no-print"><Search /></el-icon>
              </div>
              <el-date-picker
                v-else-if="isDateField(cell.key) && editable && !cell.locked"
                v-model="head[cell.key]"
                type="date"
                value-format="YYYY-MM-DD"
                size="small"
                class="qr-cell-input"
                :placeholder="tt('选择日期')"
                @change="emit('dirty')"
              />
              <el-input
                v-else-if="editable && !cell.locked"
                v-model="head[cell.key]"
                size="small"
                class="qr-cell-input"
                maxlength="200"
                @input="emit('dirty')"
              />
              <!-- locked 字段(物料批次=回填批次号)即便在草稿态也只显示文本,不允许手填 -->
              <span v-else class="qr-cell-text">{{ head[cell.key] || '' }}</span>
              <span
                v-if="cell.key === '物料编码'"
                class="qr-lib-btn no-print"
                :title="tt('按物料编码查看来料检验要求相关内容')"
                @click="openReqView"
              >⧉ {{ tt('检验要求') }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ③ 分区标题:检验结果(右侧「带入检验要求」= 按本单物料编码从品质管理 > 来料检验要求
         把「检验项(上方的列名) / 检测标准(下方该列的数据)」补进表体;只补缺失项,已填内容不动) -->
    <div class="qr-section">
      {{ tt('检验结果') }}
      <span
        v-if="editable"
        class="qr-lib-btn no-print qr-carry-btn"
        :title="tt('按物料编码从来料检验要求带入检验项与检测标准（只补缺失项，已填的检测结果不动）')"
        @click="carryFromReq()"
      >⧉ {{ carrying ? tt('带入中…') : tt('带入检验要求') }}</span>
    </div>

    <!-- ④ 表体:检验项 | 检测标准 | 检测结果(固定五格) | 单项判定 -->
    <table class="qr-table">
      <thead>
        <!-- 检测结果 = 固定五格(2026-11-11 用户口径「检验结果改为固定五格」):
             表头两行 —— 第一行「检测结果」跨 5 列,第二行 1..5 标出第几格;
             格子数据键 = 结果1..结果5(见 @core/qc/qcInspRecColumns 的 QC_INSP_REC_RESULT_KEYS) -->
        <tr>
          <th class="c-item" rowspan="2">
            {{ tt('检验项') }}<span v-if="isRequired(K.ITEM)" class="qr-req" :title="tt('必填')">*</span>
            <span
              v-if="editable"
              class="qr-lib-btn no-print"
              :title="tt('检验项来自数据库选择，可在此维护')"
              @click="openStdLib()"
            >⧉ {{ tt('标准库维护') }}</span>
          </th>
          <th class="c-std" rowspan="2">{{ tt('检测标准') }}</th>
          <th class="c-result" colspan="5">{{ tt('检测结果') }}</th>
          <!-- 单项判定必填(2026-11-11 用户口径) -->
          <th class="c-judge" rowspan="2">
            {{ tt('单项判定') }}<span v-if="isRequired(K.JUDGE)" class="qr-req" :title="tt('必填')">*</span>
          </th>
          <th v-if="editable" class="c-op" rowspan="2"></th>
        </tr>
        <tr>
          <th v-for="(k, gi) in RESULT_KEYS" :key="'rh' + k" class="c-res">{{ gi + 1 }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in items" :key="row.id ?? ('new' + i)">
          <td class="c-item" :title="row[K.ITEM] || ''">
            <el-select
              v-if="editable"
              v-model="row[K.ITEM]"
              size="small"
              filterable
              clearable
              allow-create
              default-first-option
              class="qr-cell-input"
              :placeholder="tt('请选择')"
              @change="emit('dirty')"
            >
              <el-option v-for="o in itemOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <span v-else class="qr-cell-text">{{ row[K.ITEM] || '' }}</span>
          </td>
          <td class="c-std" :title="row[K.STD] || ''">
            <!-- 检测标准(2026-11-11 用户口径):源文本里本来就可能有**硬换行**(Excel Alt+Enter →
                 char(10)/char(13)),而这一格原来是单行 el-input —— 换行显示不出来、超宽还被截断,
                 于是同一份数据"草稿态一行、审核后多行",看着像带入不一致。现在:
                 · 编辑态 = 多行 textarea(自动增高 1~6 行),硬换行按原样断行;
                 · 只读态 = 保留换行的 span(.qr-pre = white-space: pre-wrap);
                 · 两态都挂 tooltip:内容超过格高/格宽时,光标停上去看全文;
                 · maxlength 500 → 1000(物理列是 nvarchar(1000),原来编辑一下就会被截到 500 字)。 -->
            <el-tooltip
              v-if="editable"
              :content="row[K.STD] || ''"
              placement="top-start"
              popper-class="qc-std-tip"
              :disabled="!row[K.STD]"
              :show-after="400"
            >
              <el-input
                v-model="row[K.STD]"
                type="textarea"
                :autosize="{ minRows: 1, maxRows: 6 }"
                size="small"
                class="qr-cell-input qr-std-input"
                maxlength="1000"
                @input="emit('dirty')"
              />
            </el-tooltip>
            <el-tooltip
              v-else
              :content="row[K.STD] || ''"
              placement="top-start"
              popper-class="qc-std-tip"
              :disabled="!row[K.STD]"
              :show-after="300"
            >
              <span class="qr-cell-text qr-pre">{{ row[K.STD] || '' }}</span>
            </el-tooltip>
          </td>
          <td v-for="k in RESULT_KEYS" :key="'r' + k" class="c-res" :title="row[k] || ''">
            <el-input
              v-if="editable"
              v-model="row[k]"
              size="small"
              class="qr-cell-input"
              maxlength="200"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ row[k] || '' }}</span>
          </td>
          <td class="c-judge" :title="row[K.JUDGE] || ''">
            <el-select
              v-if="editable"
              v-model="row[K.JUDGE]"
              size="small"
              clearable
              class="qr-cell-input"
              :placeholder="tt('请选择')"
              @change="emit('dirty')"
            >
              <el-option v-for="o in judgeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <span v-else class="qr-cell-text">{{ row[K.JUDGE] || '' }}</span>
          </td>
          <td v-if="editable" class="c-op">
            <span class="qr-addrow" :title="tt('在该行后新增一行')" @click="insertAfter(i)">＋</span>
            <span class="qr-del" :title="tt('删除该行')" @click="removeItem(i)">×</span>
          </td>
        </tr>
        <tr v-if="!items.length">
          <td :colspan="editable ? 9 : 8" class="qr-empty">{{ tt('暂无检验项，点击下方按钮新增') }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="editable" class="qr-addbar">
      <div class="qr-add" @click="addItem">＋ {{ tt('新增检验项') }}</div>
    </div>

    <!-- ⑤ 表尾(2026-11-11 用户口径:按模板排成**两行两对** ——
         左「检验人 / 审核人」、右「检验结论 / 处理意见」):
           检验人 | 值 | 检验结论 | 值
           审核人 | 值 | 处理意见 | 值
         处理意见 = 标准库(qc.insp_disposal,可维护、可自定义输入);检验结论/处理意见必填(★)。 -->
    <table class="qr-foot-table">
      <colgroup>
        <col class="fc-label" />
        <col class="fc-v1" />
        <col class="fc-label2" />
        <col class="fc-v2" />
      </colgroup>
      <tbody>
        <tr v-for="(pair, ri) in QC_INSP_REC_FOOT_ROWS" :key="'fr' + ri">
          <template v-for="cell in pair" :key="cell.key">
            <th class="qr-label">
              {{ tt(cell.label) }}<span v-if="isRequired(cell.key)" class="qr-req" :title="tt('必填')">*</span>
              <!-- 检验结论 / 处理意见:都是标准库(2026-11-11 两轮口径),各自带维护入口 -->
              <span
                v-if="editable && cell.key === VERDICT_KEY"
                class="qr-lib-btn no-print"
                :title="tt('检验结论候选来自标准库，可在此维护')"
                @click="openStdLib(VERDICT_LIB, '检验结论')"
              >⧉ {{ tt('标准库维护') }}</span>
              <span
                v-else-if="editable && cell.key === DISPOSAL_KEY"
                class="qr-lib-btn no-print"
                :title="tt('处理意见候选来自标准库，可在此维护')"
                @click="openStdLib(DISPOSAL_LIB, '处理意见')"
              >⧉ {{ tt('标准库维护') }}</span>
            </th>
            <td class="qr-value">
              <!-- 处理意见:标准库下拉(与检验项同一套:选现成条目,也能敲新词)。
                   2026-11-11 用户口径「不需要先写样例,自己手动填写就行」 ⇒ 库先清空,
                   候选为空时直接输入即可落库,想沉淀再用「⧉ 标准库维护」加条目。 -->
              <el-select
                v-if="editable && cell.key === DISPOSAL_KEY"
                v-model="head[cell.key]"
                size="small"
                filterable
                allow-create
                default-first-option
                class="qr-cell-input qr-verdict-sel"
                :placeholder="tt('直接输入处理意见')"
                @change="emit('dirty')"
              >
                <el-option v-for="o in disposalOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <!-- 检验结论:标准库下拉(2026-11-11 第二轮:只要 合格/不合格,没有特采;
                   老单上的历史值不在候选里也能照原样回显 —— allow-create + 值直显) -->
              <el-select
                v-else-if="editable && cell.key === VERDICT_KEY"
                v-model="head[cell.key]"
                size="small"
                filterable
                allow-create
                default-first-option
                clearable
                class="qr-cell-input qr-verdict-sel"
                :placeholder="tt('请选择')"
                @change="emit('dirty')"
              >
                <el-option v-for="o in verdictOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <el-input
                v-else-if="editable && !cell.locked"
                v-model="head[cell.key]"
                size="small"
                class="qr-cell-input"
                maxlength="50"
                @input="emit('dirty')"
              />
              <!-- 空值提示带 title:说清"这格记的是谁、什么时候写、之后会不会变" -->
              <span v-else class="qr-cell-text qr-sign" :title="signHint(cell)">{{ signText(cell) }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- 标准库维护(检验项 / 处理意见各一套,可增删改;与项目记录表同一组件) -->
    <el-dialog v-model="stdLibVisible" :title="tt('标准库维护') + ' · ' + tt(stdLibTitle)" width="680px" append-to-body>
      <StdLibManager :lib="stdLibCode" @changed="onStdLibChanged" />
      <template #footer>
        <el-button @click="stdLibVisible = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>

    <!-- 来料检验要求·按本单物料编码查看(只读;内容取自品质管理 > 来料检验要求)。
         弹窗里也带「⧉ 带入检验要求」(2026-11-06 用户口径):保存后(仍是草稿)可带入,
         提交审批/审核后置灰并给出原因,弃审退回草稿后自动恢复。 -->
    <QcInspReqViewDialog
      v-model="reqViewVisible"
      :material-code="materialCode"
      :can-carry="editable"
      :carrying="carrying"
      :blocked-hint="carryBlockedHint"
      @carry="onDialogCarry"
    />

    <!-- 商品参照(物料名称 / 物料编码 → 商品档案 INV):勾一条商品确定后,两个字段一并填入 -->
    <RefPickDialog v-model="refPickVisible" :field="refPickField" mode="header" @confirm="onRefConfirm" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import { errMsg } from '@core/panel-engine'
import StdLibManager from './StdLibManager.vue'
import QcInspReqViewDialog from './QcInspReqViewDialog.vue'
import RefPickDialog from './RefPickDialog.vue'
import { applyRefCarry, refConfigOf } from '@core/ref/refCarry'
import { fetchReqRows, fetchExtOverview, QC_INSP_REQ_PANEL, QC_INSP_REQ_SERIES_PANEL } from '@core/qc/qcInspReqApi'
import { carryPlan } from '@core/qc/qcInspReqCarry'
import { qcInspReqTabs, tabsOfPanel } from './qcInspReqConfig'
import {
  QC_INSP_REC_HEAD_ROWS,
  QC_INSP_REC_FOOT_ROWS,
  QC_INSP_REC_RESULT_KEYS,
  QC_INSP_REC_DISPOSAL_LIB,
  QC_INSP_REC_VERDICT_LIB,
  QC_INSP_ITEM_LIB,
} from '@core/qc/qcInspRecColumns'

/** 表体数据键(与 qc_insp_rec_detail 物理列同名) */
const K = Object.freeze({
  ITEM: '检验项',
  STD: '检测标准',
  JUDGE: '单项判定',
})

/** 检测结果 = **固定五格**(2026-11-11 用户口径):结果1..结果5,一格一个实测值。
 *  键与次序只有一处真源(@core/qc/qcInspRecColumns 的 QC_INSP_REC_RESULT_KEYS),
 *  纸面渲染、导出、迁移脚本三处必须一致 —— 少一格就会有一个值无处落库。 */
const RESULT_KEYS = QC_INSP_REC_RESULT_KEYS

/** 检验结论(表尾右列第 1 行):2026-11-11 第二轮起改为**标准库**(qc.insp_verdict:合格/不合格) */
const VERDICT_KEY = '检验结论'
const VERDICT_LIB = QC_INSP_REC_VERDICT_LIB
/** 处理意见(表尾右列第 2 行,2026-11-11 起是**标准库**下拉;必填) */
const DISPOSAL_KEY = '处理意见'
const DISPOSAL_LIB = QC_INSP_REC_DISPOSAL_LIB

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty', 'refresh-config'])

/** 检验项明细行(来自当前单据 detail.items;新增行无 id,保存后由引擎写入) */
const items = computed(() => {
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
function optionsOf(key) {
  const f = fieldMap.value.get(key)
  return (f?.options || []).map((o) => (typeof o === 'object'
    ? { value: o.value ?? o.label, label: o.label ?? o.value }
    : { value: o, label: o }))
}
/** 该格是否必填(取元数据的 isRequired —— 面板配置里 yj_field.required 就下发达一字段;
 *  纸面显示 ★,服务端保存/提交时由 ButtonService.ensureRequiredFilled 强制) */
function isRequired(key) {
  const f = fieldMap.value.get(key)
  return !!(f && (f.isRequired || f.required))
}
/** 检验项候选:来自标准库 qc.insp_item(原表「检验项为数据库选择」) */
const itemOptions = computed(() => optionsOf(K.ITEM))
/** 单项判定:下拉(合格/不合格),字典值=中文数据键 */
const judgeOptions = computed(() => optionsOf(K.JUDGE))
/** 检验结论候选:来自标准库 qc.insp_verdict(2026-11-11 第二轮:只要 合格 / 不合格,没有特采),
 *  条目在「⧉ 标准库维护」里增删;`allow-create` 让老单上的历史值仍能回显/再选 */
const verdictOptions = computed(() => optionsOf(VERDICT_KEY))
/** 处理意见候选:来自标准库 qc.insp_disposal(2026-11-11 用户口径「处理意见做成标准库的形式」),
 *  条目在「⧉ 标准库维护」里增删;同样允许敲新词(allow-create) */
const disposalOptions = computed(() => optionsOf(DISPOSAL_KEY))

/* ── 来料检验单号链接(2026-10-19 用户口径 task 6)──
   报告建单时落了「来料检验单号」(QcCatalogService.createInspRecord),这里只做跳转:
   与检验目录的「↗ 跳转到该检验单」同一套做法(router.push + ?docNo= 定位)。 */
const inspNo = computed(() => String(props.head?.['来料检验单号'] ?? '').trim())
function gotoInsp() {
  if (!inspNo.value) return
  router.push({ path: '/panelx/list/QC_INSP', query: { docNo: inspNo.value } })
}

function isDateField(key) {
  return String(fieldMap.value.get(key)?.dataType || '') === '日期'
}

/* ── 商品参照(物料名称 / 物料编码 → 商品档案 INV,2026-10-09 用户口径)──
   用户口径:「检验数据记录的物料名称和物料编码要关联商品,并且要两个一并填入。」
   两列在 yj_field 里是**参照 INV** 的字段(物料编码→存货编码 / 物料名称→存货名称),
   配置里带 refPanel/refField/displayField 与 refMap(与 DataRecordSheet 的「文档编号」同形态),
   这里只按配置开弹窗、写主字段、按 refMap 整串带回 —— 不在前端硬编码面板名/列名。
   带回后两列**同时有值**:两列互为对方的 refMap 目标(见后端 PanelConfigService.buildRefMap
   的同义词表 存货编码→物料编码、存货名称→物料名称),一侧写值即把另一侧填上。 */
function isRefKey(key) {
  if (!key) return false
  const f = fieldMap.value.get(key)
  return !!(f && f.refPanel)
}
const refPickVisible = ref(false)
const refPickKey = ref('')
const refPickField = computed(() => fieldMap.value.get(refPickKey.value) || null)
function openRefPick(key) {
  if (!props.editable || !isRefKey(key)) return
  refPickKey.value = key
  refPickVisible.value = true
}
/** 参照确认:主字段写 refField 的原始值(物料编码存编码 / 物料名称存名称),
 *  再按 refMap 把选中商品的其他映射字段整串带回(其中就包含**配对的那一列**)。 */
function onRefConfirm(rows) {
  const f = refPickField.value
  const src = rows?.[0]
  if (!f || !src) return
  const key = refPickKey.value
  props.head[key] = src[f.refField || f.dataName] ?? ''
  applyRefCarry(props.head, src, refConfigOf(f), key)
  refPickVisible.value = false
  emit('dirty')
}

/**
 * 签名行取值(只读态):
 * · 检验人(锁定)——**空值**时显示一句说明,说清它到底是什么时候写的、记的是谁;
 * · 审核人(原表「固定:冯敏」)——落库键是 表单审核人;单据真审核后另有虚拟键 审核人(=yj_doc_status.shr)兜底。
 *
 * 【2026-11-06 用户口径:行为不改,只把说明文字说清】
 *   原模板写的是「账号登录人自动生成」,容易被读成"保存时会按真正的填表人生成"——不是。
 *   实际规则(见 @core/panel/docDefaults 的 LOCKED_PERSON 与 ButtonService 的编制格名单):
 *     · 只在「新增那一刻」按**当前登录账号**写入;
 *     · 之后任何保存/编辑/审批都**不改**它(该格 yj_field.editable=0,后端也不回写);
 *     · 不是从新增建出来的草稿(或新增后没保存就断了)会一直是空,保存也不会补 ——
 *       所以看到的这串字是「空值说明」而不是数据。
 *   想改成"保存时写当前登录人/提交时写提交人",要另开任务改口径(见 2026-11-06 的讨论记录)。
 */
function signText(cell) {
  const v = headVal(cell.key) || (cell.auditKey ? headVal(cell.auditKey) : '')
  if (v) return v
  return cell.locked ? tt('新增时按登录人生成') : ''
}
/** 空值格的悬停说明(把规则一次讲全,避免再被理解成"保存时才生成") */
function signHint(cell) {
  if (!cell.locked) return ''
  if (headVal(cell.key)) return tt('新增时按登录账号填入，之后不再随保存变更')
  return tt('这格在「新增」那一刻按登录账号填入，之后不再随保存/编辑变更；不是从新增建出的草稿会一直为空')
}
function headVal(key) {
  const v = props.head?.[key]
  return v === undefined || v === null ? '' : String(v)
}

/** 行增删(与检验目录同款 ＋/× 操作) */
/** 新建行的空白骨架:**把必填列显式建成空串**(2026-11-11)。
 *  服务端 ensureDetailRequiredFilled 只校验「载荷里带了这一键」的行 —— 空对象{} 会整行跳过,
 *  于是「单项判定必填」对新增/带入出来的行形同虚设。这里先把键建出来,空值照样被拦。 */
function blankRow() {
  return { [K.ITEM]: '', [K.STD]: '', [K.JUDGE]: '' }
}
function insertAfter(i) {
  const d = props.head.detail
  if (!d || !Array.isArray(d.items)) return
  d.items.splice(i + 1, 0, blankRow())
  emit('dirty')
}
function removeItem(i) {
  const d = props.head.detail
  if (d && Array.isArray(d.items)) d.items.splice(i, 1)
  emit('dirty')
}
function addItem() {
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  d.items.push(blankRow())
  emit('dirty')
}

/** 标准库维护:改完让面板重拉一次配置(选项随之刷新) */
const stdLibVisible = ref(false)
/** 当前维护的是哪一个标准库(检验项 qc.insp_item / 处理意见 qc.insp_disposal) */
const stdLibCode = ref(QC_INSP_ITEM_LIB)
const stdLibTitle = ref('检验项')
function openStdLib(lib = QC_INSP_ITEM_LIB, title = '检验项') {
  stdLibCode.value = lib
  stdLibTitle.value = title
  stdLibVisible.value = true
}
function onStdLibChanged() {
  emit('refresh-config')
}

/**
 * 按「物料编码」查看来料检验要求(2026-09-23 用户口径)。
 * 只读弹窗按物料编号精确匹配品质管理 > 来料检验要求里的行;本单没填物料编码时先提示再拦。
 */
const reqViewVisible = ref(false)
const materialCode = computed(() => String(props.head?.['物料编码'] ?? '').trim())
function openReqView() {
  if (!materialCode.value) {
    ElMessage.warning(tt('请先填写物料编码'))
    return
  }
  reqViewVisible.value = true
}

/** 单据当前状态(草稿/审批中/已审核…)—— 用来解释「为什么现在不能带入」 */
const docStatusText = computed(() => String(props.head?.['单据状态'] ?? '').trim())
/** 不可带入的具体原因:按状态说清下一步该做什么(比通用文案有用,现场不用再问) */
const carryBlockedHint = computed(() => {
  const st = docStatusText.value
  if (st === '审批中' || st === '待二级审批' || st === '会签中') {
    return tt('该单正在审批，审批中不可带入；请先驳回或弃审退回草稿再带入')
  }
  if (st === '已审核' || st === '已归档' || st === '已生效') {
    return tt('该单已审核，不可带入；请先点「弃审」退回草稿再带入')
  }
  if (st === '修改申请中' || st === '删除申请中') {
    return tt('该单正在申请修改，审批通过退回「修改中」后才可带入')
  }
  if (st === '已作废' || st === '已中止') return tt('该单已作废/中止，不可带入')
  return tt('仅草稿或修改中可带入')
})

/** 弹窗里的「带入检验要求」:表头那个按钮的同一个动作;真带进来了才关弹窗,让用户直接看到表体 */
async function onDialogCarry() {
  const n = await carryFromReq()
  if (n > 0) reqViewVisible.value = false
}

/**
 * 按物料编码把「来料检验要求」的检验项与检测标准带进表体(2026-10-04 用户口径):
 *   「根据物料编码能够在来料检验要求找到对应的行;检验项就是上面的检验项目,
 *     检验标准就是下面对应的数据。」
 * 即:要求表里**列名(表头)= 检验项目**、**该列在命中行里的数据 = 检测标准**,
 * 逐列拆成本报告的两列(算法在 @core/qc/qcInspReqCarry,纯函数有单测)。
 * 合并口径:只补缺失项 —— 已有的检验项一律保留,检测结果/单项判定绝不覆盖,重复点击幂等。
 * @param {{silent?: boolean}} opts silent=true 时(自动带入)不弹「无需带入」这类打扰提示
 * @returns {Promise<number>} 实际补进来的行数
 */
const carrying = ref(false)
async function carryFromReq(opts = {}) {
  const code = materialCode.value
  if (!code) {
    if (!opts.silent) ElMessage.warning(tt('请先填写物料编码'))
    return 0
  }
  if (carrying.value) return 0
  carrying.value = true
  try {
    // 两个面板一起带:要求可能维护在 QC_INSP_REQ(7 张固定表)或 QC_INSP_REQ_SERIES(10 张系列表);
    // 动态字段(每张表各自的自定义列)与页签全集一并取,否则界面上看得到的自定义列带不进来。
    const [rows, ovA, ovB] = await Promise.all([
      fetchReqRows(code),
      fetchExtOverview(QC_INSP_REQ_PANEL),
      fetchExtOverview(QC_INSP_REQ_SERIES_PANEL),
    ])
    const extFields = [...ovA.fields, ...ovB.fields]
    const tabs = [...qcInspReqTabs, ...tabsOfPanel(QC_INSP_REQ_SERIES_PANEL, ovB.tabs)]
    const plan = carryPlan(rows, code, items.value, extFields, tabs)
    // 抬头两项(文件编码/检验依据):按物料编码带入,纸面不可修改 ——
    // 要求表没填的项**不动**(保留报告原值/默认 YJ-QR-96 / YJ-Q-30)
    let headChanged = 0
    for (const [k, v] of Object.entries(plan.head || {})) {
      if (v && String(props.head[k] ?? '') !== String(v)) { props.head[k] = v; headChanged++ }
    }
    if (!plan.entries.length) {
      if (headChanged) emit('dirty')
      else if (!opts.silent) ElMessage.warning(tt('来料检验要求里没有该物料的检验数据，无法带入'))
      return headChanged
    }
    if (!plan.add.length) {
      if (headChanged) emit('dirty')
      if (!opts.silent) {
        ElMessage.info(headChanged
          ? tt('已按来料检验要求更新文件编码与检验依据')
          : tt('检验项已与来料检验要求一致，无需带入'))
      }
      return headChanged
    }
    const d = props.head.detail || (props.head.detail = {})
    if (!Array.isArray(d.items)) d.items = []
    // 逐列落成行:检验项=表头列名,检测标准=该列数据;结果/判定留空等人填
    // (单项判定显式建空串:必填校验只认"带了这一键"的行,不建键等于放行)
    for (const e of plan.add) d.items.push({ [K.ITEM]: e.检验项, [K.STD]: e.检测标准, [K.JUDGE]: '' })
    emit('dirty')
    ElMessage.success(tt('已按来料检验要求带入 {n} 项检验项').replace('{n}', String(plan.add.length)))
    return plan.add.length
  } catch (e) {
    if (!opts.silent) ElMessage.error(errMsg(e) || tt('带入检验要求失败'))
    return 0
  } finally {
    carrying.value = false
  }
}

/**
 * 物料编码填好后自动带入(2026-10-04):仅当**报告表体还没有检验项行**时触发;
 * 已有行(哪怕只有一行)一律不自动改 —— 想补走「带入检验要求」按钮,口径一致(只补缺失项)。
 * 去抖 600ms:物料编码是逐字符输入的,没必要也不能每敲一下就去查一次;
 * 半截编码不精确匹配任何物料(见 matchReqRowsByMaterial),所以中途不会带错内容。
 */
const AUTO_CARRY_DELAY = 600
let autoCarryTimer = 0
watch(materialCode, (code) => {
  if (autoCarryTimer) { clearTimeout(autoCarryTimer); autoCarryTimer = 0 }
  if (!props.editable || !code) return
  autoCarryTimer = setTimeout(() => {
    autoCarryTimer = 0
    // 到点了再确认一次:这 600ms 里可能已经手工加了行 / 单据被切走成了只读
    if (!props.editable || items.value.length) return
    void carryFromReq({ silent: true })
  }, AUTO_CARRY_DELAY)
})
onBeforeUnmount(() => { if (autoCarryTimer) clearTimeout(autoCarryTimer) })

/**
 * 从检验目录「新增检验」跳进来时,把批次/物料预填到**新建的空报告**上
 * (路由 query: prefillBatch/prefillMaterial)。只在单据还空着时填一次,已录入内容一律不动。
 */
const route = useRoute()
/** 跳到关联单据(来料检验单链接用,2026-10-19 task 6):与检验目录的 ↗ 跳转同款 */
const router = useRouter()
const prefilled = ref(false)
watch(
  () => [props.editable, props.head?.['单据编号'], props.head?.['物料批次']],
  () => {
    if (prefilled.value || !props.editable) return
    const q = route.query || {}
    const batch = String(q.prefillBatch || '').trim()
    if (!batch) return
    const d = props.head?.detail
    const hasRows = !!(d && Array.isArray(d.items) && d.items.length)
    if (props.head['物料批次'] || hasRows) {
      prefilled.value = true // 已有内容:不是新建空单,不预填
      return
    }
    props.head['物料批次'] = batch
    const mat = String(q.prefillMaterial || '').trim()
    if (mat) props.head['物料名称'] = mat
    prefilled.value = true
    emit('dirty')
  },
  { immediate: true },
)
</script>

<style scoped>
/* ═══ 纸张主体(与检验目录同宽同观感) ═══ */
.qc-rec-sheet {
  width: calc(100vw - 300px);
  min-width: 760px;
  max-width: 1400px;
  margin: 16px auto 26px;
  background: #fff;
  border: 1px solid #8a8a8a;
  font-size: 13px;
  color: #222;
}
/* 格内直编:去边框,白纸观感 */
.qc-rec-sheet :deep(.qr-cell-input) {
  width: 100%;
}
.qc-rec-sheet :deep(.el-input__wrapper),
.qc-rec-sheet :deep(.el-input__wrapper.is-focus),
.qc-rec-sheet :deep(.el-textarea__inner),
.qc-rec-sheet :deep(.el-textarea__inner:focus),
.qc-rec-sheet :deep(.el-select__wrapper),
.qc-rec-sheet :deep(.el-select__wrapper.is-focused) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0 2px;
}
.qc-rec-sheet :deep(.el-input__inner),
.qc-rec-sheet :deep(.el-textarea__inner),
.qc-rec-sheet :deep(.el-select__selected-item) {
  font-size: 13px;
  padding: 0;
  line-height: 1.6;
}

/* ═══ 标题 ═══ */
.qr-titlerow {
  border-bottom: 1px solid #8a8a8a;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;   /* 标题右侧「来料检验单号」链接的定位基准(2026-10-19 task 6) */
}
.qr-title {
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 28px;
  font-weight: 600;
  color: #1f5fa8;
  letter-spacing: 6px;
}
/* 标题右侧「来料检验单号」链接(2026-10-19 task 6):绝对定位贴标题行右端,
   不参与居中排版(标题始终居中),窄窗时自动省略号;打印不出现(.no-print 由全局样式隐藏)。 */
.qr-doclink {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  max-width: 42%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: #1f5fa8;
  cursor: pointer;
  user-select: none;
}
.qr-doclink:hover {
  text-decoration: underline;
}
/* 检验结论下拉(2026-10-19 task 2):格内铺满、高度与其它整宽格一致 */
.qr-verdict-sel {
  width: 100%;
}

/* ═══ 抬头 / 表尾 ═══ */
.qr-head-table,
.qr-foot-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.qr-head-table th,
.qr-head-table td,
.qr-foot-table th,
.qr-foot-table td {
  border: 1px solid #9a9a9a;
  padding: 3px 6px;
  vertical-align: middle;
  font-size: 12.5px;
}
.qr-label {
  background: #eef6fe;
  color: #1f5fa8;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}
/* 必填标记(2026-11-11:检验结论 / 处理意见 / 单项判定必填) */
.qr-req {
  color: #c0392b;
  font-weight: 700;
  margin-left: 2px;
}
/* 整张纸共用一套列宽(与原表 B|C:D|E|F:I 同节奏):
   标签列 20% / 值列 30% / 标签列 20% / 值列 30%;表尾「检验结论/处理意见」值格跨后三列铺到表格右缘 */
.qr-head-table col.fc-label,
.qr-foot-table col.fc-label { width: 20%; }
.qr-head-table col.fc-v1,
.qr-foot-table col.fc-v1 { width: 30%; }
.qr-head-table col.fc-label2,
.qr-foot-table col.fc-label2 { width: 20%; }
.qr-head-table col.fc-v2,
.qr-foot-table col.fc-v2 { width: 30%; }
.qr-value-wide {
  vertical-align: top;
}
.qr-value {
  background: #fff;
  height: 26px;
}
.qr-cell-text {
  display: inline-block;
  width: 100%;
  word-break: break-all;
}
/* 保留源文本里的硬换行(2026-11-11):检验要求里的多段标准带 char(10)/char(13),
   默认 white-space:normal 会把它们折成空格,导致"审核后断行位置和源表不一致" */
.qr-pre {
  white-space: pre-wrap;
}
/* 检测标准改成多行输入后:去掉 textarea 自带的 resize 手柄(版面里不该出现),
   行高与只读态一致(1.6),超 6 行在格内滚动 + 悬停 tooltip 看全文 */
.qr-std-input :deep(.el-textarea__inner) {
  resize: none;
  min-height: 20px !important;
}
/* 商品参照单元格(物料名称/物料编码):拟态输入框 —— 点整格即弹参照,未填时给占位提示。
   与 DataRecordSheet/RecordSheetPanels 的参照格同观感(纸面上仍是"一格值",不带边框)。 */
.qr-ref-ctl {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 20px;
  cursor: pointer;
}
.qr-ref-ctl:hover .qr-ref-text {
  color: #1677ff;
}
.qr-ref-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 未选商品时的占位文案(弱化,与真实值的墨色区分开) */
.qr-ref-text.is-empty {
  color: #a8abb2;
}
.qr-ref-ico {
  flex: none;
  color: #1677ff;
  font-size: 13px;
}
.qr-sign {
  font-weight: 600;
  color: #1f5fa8;
}

/* ═══ 分区标题 ═══ */
.qr-section {
  position: relative;
  border-top: 1px solid #8a8a8a;
  border-bottom: 1px solid #8a8a8a;
  background: #d9ecfb;
  color: #1f5fa8;
  font-weight: 600;
  text-align: center;
  padding: 4px 0;
  letter-spacing: 2px;
}
/* 「带入检验要求」挂在分区条右端(标题仍居中:按钮绝对定位不参与居中计算);
   纸面打印不出现(no-print) */
.qr-carry-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  letter-spacing: 0;
  font-weight: 400;
}

/* ═══ 表体 ═══ */
.qr-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.qr-table th,
.qr-table td {
  border: 1px solid #9a9a9a;
  padding: 3px 6px;
  vertical-align: middle;
  font-size: 12.5px;
  word-break: break-all;
}
.qr-table th {
  background: #b9dbf8;
  color: #1f5fa8;
  font-weight: 600;
  text-align: center;
}
.qr-table td {
  background: #fff;
  min-height: 24px;
}
.qr-table tr:hover td {
  background: #f7fbff;
}
.c-item { width: 20%; }
.c-std { width: 24%; }
/* 「检测结果」= 固定五格:表头第一行跨 5 列(42%),第二行 1..5 每格 8.4% */
.c-result { width: 42%; }
.c-res { width: 8.4%; }
.c-judge { width: 14%; }
.c-op { width: 46px; text-align: center; }
/* 五格是窄格(约 8.4%),缩一缩左右内边距,数字/短文本不会被挤掉 */
.qr-table th.c-res,
.qr-table td.c-res { padding-left: 2px; padding-right: 2px; }
.qr-lib-btn {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 400;
  color: #1677ff;
  cursor: pointer;
  white-space: nowrap;
}
.qr-lib-btn:hover { text-decoration: underline; }
/* 物料编码值格:编码(或编码输入框)+ 右侧「检验要求」链接 同行排布,链接紧跟编码后面 */
.qr-value-code {
  display: flex;
  align-items: center;
  gap: 2px;
}
.qr-value-code .qr-cell-input {
  flex: 1;
  width: auto;
  min-width: 0;
}
/* 物料编码格改成商品参照后,值区是 .qr-ref-ctl:与「检验要求」链接同排,值区自适应、链接不缩 */
.qr-value-code .qr-ref-ctl {
  flex: 1;
  width: auto;
  min-width: 0;
}
.qr-empty {
  text-align: center;
  color: #98a4b3;
  padding: 16px 0 !important;
}

/* ═══ 增行条 / 行操作 ═══ */
.qr-addbar {
  display: flex;
  gap: 8px;
  margin: 6px 8px;
}
.qr-add {
  padding: 5px 10px;
  border: 1px dashed #8fb4e0;
  border-radius: 4px;
  background: #f4f9ff;
  color: #1c4f8a;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.qr-add:hover {
  background: #e8f2ff;
  border-style: solid;
}
.qr-addrow {
  display: inline-block;
  color: #0d5bd3;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
  margin-right: 4px;
}
.qr-del {
  display: inline-block;
  color: #c0392b;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
}
</style>

<!-- 检测标准的悬停全文(2026-11-11):这一格可能几百字,Element 的 tooltip 默认不限宽,
     会把提示拉成一条横贯全屏的长条 —— 这里限宽 + 换行(内容里的硬换行也照原样断) -->
<style>
.qc-std-tip.el-popper {
  max-width: 460px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  font-size: 12.5px;
  /* 纸面是白底表格,提示必须实底深色,否则半透明叠在文字上看不清 */
  background: #1f2937;
  color: #fff;
  border: 1px solid #374151;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
}
.qc-std-tip.el-popper .el-popper__arrow::before {
  background: #1f2937;
  border-color: #374151;
}
</style>

<!-- 打印整张:只保留纸张(与项目进度查询/检验目录同口径) -->
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
  body.approval-printing .qc-rec-sheet {
    visibility: visible !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    border: 1px solid #8a8a8a !important;
    box-shadow: none !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .qc-rec-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .qr-table th,
  body.approval-printing .qr-table td,
  body.approval-printing .qr-head-table th,
  body.approval-printing .qr-head-table td,
  body.approval-printing .qr-foot-table th,
  body.approval-printing .qr-foot-table td {
    font-size: 10px !important;
    padding: 1px 3px !important;
  }
  body.approval-printing .qr-addbar,
  body.approval-printing .qr-lib-btn,
  body.approval-printing .qr-ref-ico {
    display: none !important;
  }
  /* 行操作列(＋/×)是屏幕上的编辑入口,纸面不该出现(2026-11-11 做「检测结果固定五格」时
     顺带把这一列从打印里摘掉:五格已经占满版面,再留一列空操作格会挤窄格子) */
  body.approval-printing .c-op {
    display: none !important;
  }
  @page {
    margin: 8mm;
  }
}
</style>
