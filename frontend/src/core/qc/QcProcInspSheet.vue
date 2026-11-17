<template>
  <!-- ═══════════════════════════════════════════════════════════════════════════
       出货检验单功能(面板 QC_PROC_INSP)—— 纸张式受控记录表 **按图2 整页重写**
       《出货检验功能记录表》YJ-QR-154(设计契约:docs/design/出货检验功能记录表-表样改造.md
       §二 数据模型 / §三 前端表样,2026-11-11 用户口径「将当前的出货检验列表的格式修改为图2
       所示的形式。表格内的信息填写按照图中各个表格形式进行」)。

       版式(自上而下):
         纸头 : 标题「出货检验功能记录表」居中 + 右上「表单编号：YJ-QR-154」
         抬头 : 3 行 × 2 组 —— 单据编号|检测周期 / 产品编码|工单号 / 产品型号|抽检方案
                (印刷标签 产品型号 ← head['规格型号'],抽检方案 ← head['检验方案'];检测周期=后端派生只读)
         「检验明细」区块带 + 三个动作(＋新增检验项 / ⧉带入检验项目 / ＋添加批次)
         矩阵 : 检验项目 | 检验方法 | 检验要求 + **每个内部批次一组两列**(批次号 | 本批结果判断)
         表尾 : 2 行 × 2 组 —— 检验人|检验结论 / 审核人|处理意见

       ⚠ 数据模型(设计决策,不建子表):一行 = (检验项目 × 内部批次),摊在**同一张**
         `qc_proc_insp_detail` 行表里:
           · 行字段「内部批次」= 该行所属批次;「结果判断」= 该批次该项目的判定;
           · 头表「内部批次清单」= 英文逗号分隔的批次列顺序(先加批次、后带入检验项目也不丢列);
           · 旧单(清单空 + 行上无 内部批次)⇒ 渲染**单批次列**,批号 = head['批次号'] || '本批',
             结果取行「结果判断」;草稿首次编辑时由 normalizeRows() 回填清单与各行批次。
       ⚠ 检验要求/检验方法**写穿**同项目的所有批次行(避免"改了一个批次、别的批次还是旧值");
         检验项目同理(它是行的身份键)。改批次号 = 改清单项 + 该批所有行的「内部批次」。
       ⚠ 带入检验项目(PanelxList.applyInspItems)写进的新行**没有** 内部批次/结果判断 ⇒ 本组件的
         规范化兜底(ensureNormalized)会在首次编辑时按当前批次清单把每一项复制成 N 行;
         展示层对"还没匹配到批次行的项目"照样按第一个批次行显示 检验要求/检验方法,不丢内容。
       ⚠ 只在**用户真正编辑时**才规范化:打开单据时绝不改内存里的 head(否则 PanelxList 的
         「未保存修改」基线快照会判定为脏,切单/翻页每次都弹未保存提示 —— 2026-10-21 同类事故)。
       ⚠ 导出 Excel 版式在 `core/qc/qcProcInspExport.js`(纯函数 + 单测,与本纸张同版式);
         本组件只做 aoa_to_sheet + writeFile。入口 = 面板右侧「文档输出 → 导出」→ 导出 Excel,
         PanelxList 按面板码 QC_PROC_INSP 路由到本组件 defineExpose 的 exportProcInspExcel。
       ⚠ 所有中文显示层文案一律 tt('…')(AGENTS 多语言强制规范);数据键(合格/不合格/允收/批次号
         这类**存储值**)原样显示,不翻译。
       ⚠ 打印:根类名必须保持 `qr-sheet`(PanelxList 的纸张截图/printToPDF 选择器 + 本组件末尾的
         visibility 白名单都按它挑纸),改类名 = 点「打印」出空白页(2026-10-21 事故)。
       ═══════════════════════════════════════════════════════════════════════════ -->
  <div class="qr-sheet" :class="{ 'is-editing': editable }">
    <!-- ① 纸头:标题居中 + 右上表单编号(图2;表单编号是受控表单号,固定印刷不翻译数字部分) -->
    <div class="qr-paper-head">
      <div class="qr-title">{{ tt(props.title || PROC_INSP_TITLE) }}</div>
      <div class="qr-formno">{{ tt('表单编号') }}：{{ props.formCode || PROC_INSP_FORM_CODE }}</div>
    </div>

    <!-- ② 抬头 3 行 × 2 组「标签|值」
         · 单据编号(系统发号,元数据 editable=0 ⇒ 只读)/ 检测周期(后端派生虚拟字段,恒只读)
         · 产品编码 / 工单号
         · 产品型号(落库键 规格型号)/ 抽检方案(落库键 检验方案,后端默认「出货控制计划执行」可改) -->
    <table class="qr-head-table">
      <colgroup>
        <col class="qr-head-label-col" />
        <col />
        <col class="qr-head-label-col" />
        <col />
      </colgroup>
      <tbody>
        <tr v-for="(pair, ri) in HEAD_ROWS" :key="'h' + ri">
          <template v-for="cell in pair" :key="cell.key">
            <th class="qr-label">{{ tt(cell.label) }}</th>
            <td class="qr-value">
              <el-input
                v-if="canEditHead(cell)"
                v-model="head[cell.key]"
                size="small"
                class="qr-cell-input"
                maxlength="200"
                @input="emit('dirty')"
              />
              <span v-else class="qr-cell-text">{{ headText(cell.key) }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ③ 「检验明细」区块带 + 三个动作(打印时整体不进纸:no-print)
         ⧉带入检验项目仍走 emit('open-items') 由 PanelxList 打开 QcInspPlanDialog(链路不变) -->
    <div class="qr-band">
      <span class="qr-band-title">{{ tt('检验明细') }}</span>
      <span v-if="editable" class="qr-band-acts no-print">
        <span class="qr-band-act" @click="addItem()">＋ {{ tt('新增检验项') }}</span>
        <span class="qr-band-act" @click="emit('open-items')">⧉ {{ tt('带入检验项目') }}</span>
        <span class="qr-band-act" @click="addBatch()">＋ {{ tt('添加批次') }}</span>
      </span>
    </div>

    <!-- ④ 检验明细矩阵
         列 = 检验项目 | 检验方法 | 检验要求 | 每批「批次号 + 本批结果判断」
         · 批次号:表头格内可改名(改 = 清单项 + 该批所有行 内部批次 一起改),体内按行印批次号;
           可删批次(表头小 ×;仅剩一个批次时不给删 —— 矩阵至少要有一列)
         · 第 4 个 action 列(删检验项)只在 editable 出现,打印隐藏(.c-op.no-print)
         · 屏上列多时表格按 min-width 撑开 + 外层横向滚动;打印收回纸宽(见末尾 @media print) -->
    <div class="qr-grid-scroll">
      <table class="qr-grid" :style="{ minWidth: gridMinWidth }">
        <colgroup>
          <col v-for="(w, ci) in colWidths" :key="'col' + ci" :style="{ width: w }" />
        </colgroup>
        <thead>
          <tr>
            <th>{{ tt('检验项目') }}</th>
            <th>{{ tt('检验方法') }}</th>
            <th>{{ tt('检验要求') }}</th>
            <template v-for="(b, bi) in batches" :key="'hb' + bi">
              <th class="c-batchname">
                <div class="qr-batch-head">
                  <span class="qr-batch-label">{{ tt('批次号') }}</span>
                  <div class="qr-batch-edit">
                    <el-input
                      v-if="editable"
                      :model-value="batchDraftOf(bi)"
                      size="small"
                      class="qr-cell-input qr-batch-input"
                      maxlength="60"
                      @update:model-value="(v) => onBatchInput(bi, v)"
                      @change="onBatchCommit(bi)"
                      @blur="onBatchCommit(bi)"
                    />
                    <span
                      v-if="editable && batches.length > 1"
                      class="qr-batch-del no-print"
                      :title="tt('删除批次')"
                      @click="deleteBatch(bi)"
                    >×</span>
                  </div>
                </div>
              </th>
              <th class="c-result">{{ tt('本批结果判断') }}</th>
            </template>
            <th v-if="editable" class="c-op no-print"></th>
          </tr>
        </thead>
        <tbody>
          <!-- 空表:可编辑态给下一步指引,只读态只说没有(只读单上不该出现"去点按钮"这种指引) -->
          <tr v-if="!groups.length">
            <td :colspan="colspanAll" class="c-empty">
              {{ editable
                ? tt('暂无检验项，点右上「⧉带入检验项目」或「＋新增检验项」开始')
                : tt('暂无检验项') }}
            </td>
          </tr>
          <!-- 一行 = 一个检验项目;每个批次两格(批次号 | 本批结果判断) -->
          <tr v-for="(g, gi) in groups" :key="g.key">
            <td class="c-item">
              <el-input
                v-if="editable"
                :model-value="g.name"
                size="small"
                class="qr-cell-input"
                maxlength="200"
                @update:model-value="(v) => setItemField(g, '检验项目', v)"
              />
              <span v-else class="qr-cell-text">{{ groupCell(g, '检验项目') }}</span>
            </td>
            <td class="c-mtd">
              <el-input
                v-if="editable"
                :model-value="groupCell(g, '检验方法')"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 12 }"
                size="small"
                class="qr-cell-input qr-cell-wrap"
                maxlength="1000"
                @update:model-value="(v) => setItemField(g, '检验方法', v)"
              />
              <span v-else class="qr-cell-text">{{ groupCell(g, '检验方法') }}</span>
            </td>
            <td class="c-req">
              <el-input
                v-if="editable"
                :model-value="groupCell(g, '检验要求')"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 12 }"
                size="small"
                class="qr-cell-input qr-cell-wrap"
                maxlength="500"
                @update:model-value="(v) => setItemField(g, '检验要求', v)"
              />
              <span v-else class="qr-cell-text">{{ groupCell(g, '检验要求') }}</span>
            </td>
            <template v-for="(b, bi) in batches" :key="'b' + bi">
              <!-- 每批两列(图2):「批次号」列体 = **录入对应结果**(多行文本,落库「实测数值」;
                   批号本身只写在表头格,不在每一行重复印 —— 图2 的橙色格就是这块) -->
              <td class="c-batchtext">
                <el-input
                  v-if="editable"
                  :model-value="cellResultText(g, b)"
                  type="textarea"
                  :autosize="{ minRows: 1, maxRows: 6 }"
                  size="small"
                  class="qr-cell-input qr-cell-wrap"
                  maxlength="200"
                  @update:model-value="(v) => setResultText(g, b, v)"
                />
                <span v-else class="qr-cell-text">{{ cellResultText(g, b) }}</span>
              </td>
              <td class="c-result">
                <!-- 「结果判断」= 存储数据键(合格/不合格),选项取 yj_field 下拉下发;没有 options 时
                     用契约兜底 合格/不合格。老单历史值可能是自由文本 ⇒ 追加成临时 option,不吞原值。 -->
                <el-select
                  v-if="editable && resultOptions(g, b).length"
                  :model-value="cellValue(g, b)"
                  size="small"
                  clearable
                  class="qr-cell-input"
                  @change="(v) => setResult(g, b, v)"
                >
                  <el-option v-for="o in resultOptions(g, b)" :key="o" :label="o" :value="o" />
                </el-select>
                <el-input
                  v-else-if="editable"
                  :model-value="cellValue(g, b)"
                  size="small"
                  class="qr-cell-input"
                  maxlength="20"
                  @update:model-value="(v) => setResult(g, b, v)"
                />
                <span v-else class="qr-cell-text">{{ cellValue(g, b) }}</span>
              </td>
            </template>
            <td v-if="editable" class="c-op no-print">
              <span class="qr-row-del" :title="tt('删除检验项')" @click="removeItem(g)">×</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ⑤ 表尾 2 行 × 2 组(图2):
         检验人(head['检验员'],元数据可填)/ 检验结论(head['总结论'],下拉 合格|不合格)
         审核人(**表单审核人**,docDefaults 默认冯敏、可改;空值回退审批流虚拟字段「审核人」)/
         处理意见(head['处理方式'],下拉 允收|合格|不合格|报废 + allow-create 手填) -->
    <table class="qr-foot-table">
      <colgroup>
        <col class="qr-foot-label-col" />
        <col />
        <col class="qr-foot-label-col" />
        <col />
      </colgroup>
      <tbody>
        <tr>
          <th class="qr-label">{{ tt('检验人') }}</th>
          <td class="qr-value">
            <el-input
              v-if="canEditHead(FOOT_KEYS.inspector)"
              v-model="head['检验员']"
              size="small"
              class="qr-cell-input"
              maxlength="50"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ headText('检验员') }}</span>
          </td>
          <th class="qr-label">{{ tt('检验结论') }}</th>
          <td class="qr-value">
            <el-select
              v-if="canEditHead(FOOT_KEYS.summary)"
              v-model="head['总结论']"
              size="small"
              clearable
              class="qr-cell-input"
              :placeholder="tt('请选择')"
              @change="emit('dirty')"
            >
              <el-option v-for="o in summaryOptions" :key="o" :label="o" :value="o" />
            </el-select>
            <span v-else class="qr-cell-text">{{ headText('总结论') }}</span>
          </td>
        </tr>
        <tr>
          <th class="qr-label">{{ tt('审核人') }}</th>
          <td class="qr-value">
            <el-input
              v-if="canEditHead(FOOT_KEYS.reviewer)"
              v-model="head['表单审核人']"
              size="small"
              class="qr-cell-input"
              maxlength="50"
              :placeholder="tt('表单审核人')"
              @input="emit('dirty')"
            />
            <span v-else class="qr-cell-text">{{ headText('表单审核人') || headText('审核人') }}</span>
          </td>
          <th class="qr-label">
            {{ tt('处理意见') }}
            <span
              v-if="canEditHead(FOOT_KEYS.disposal) && canMaintainOptions"
              class="qr-opt-mgr no-print"
              :title="tt('维护处理意见选项')"
              @click="openOptManager"
            >⚙</span>
          </th>
          <td class="qr-value">
            <el-select
              v-if="canEditHead(FOOT_KEYS.disposal)"
              v-model="head['处理方式']"
              size="small"
              clearable
              filterable
              allow-create
              default-first-option
              class="qr-cell-input"
              :title="tt('可下拉选择；也可以直接输入新的处理意见后回车（会自动加入选项库）')"
              :placeholder="tt('请选择')"
              @change="onDisposalChange"
            >
              <el-option v-for="o in disposalOptions" :key="o" :label="o" :value="o" />
            </el-select>
            <span v-else class="qr-cell-text">{{ headText('处理方式') }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 处理意见「选项库」维护弹窗(2026-11-11 用户口径:弹窗形式更好维护) -->
    <el-dialog
      v-model="optManagerVisible"
      :title="tt('处理意见选项维护')"
      width="460px"
      append-to-body
      class="qr-opt-dialog"
    >
      <div class="qr-opt-hint">{{ tt('仅「出货检验单功能」使用，改动只影响本面板（历史单据已填的值不受影响）') }}</div>
      <div class="qr-opt-list">
        <div v-for="(o, i) in optDraft" :key="'o' + i" class="qr-opt-row">
          <!-- 选项文本按多行域渲染(2026-11-11 用户口径「这个字数过多时需要换行」):
               单行 el-input 不会折行,长文本会把格子撑破/被截断;textarea + autosize 让它在
               1~5 行之间自动长高并正常换行(上限 200 字,只防极端值;旧版 30 字限制已按用户口径去掉)。 -->
          <el-input
            v-model="optDraft[i]"
            type="textarea"
            size="small"
            :autosize="{ minRows: 1, maxRows: 5 }"
            maxlength="200"
            resize="none"
            class="qr-opt-input"
            :placeholder="tt('请输入选项内容')"
          />
          <span class="qr-opt-del" :title="tt('删除')" @click="removeOptRow(i)">×</span>
        </div>
      </div>
      <span class="qr-opt-add" @click="addOptRow">＋ {{ tt('新增选项') }}</span>
      <template #footer>
        <el-button size="small" @click="optManagerVisible = false">{{ tt('取消') }}</el-button>
        <el-button size="small" type="primary" :loading="optSaving" @click="saveOptManager">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { tt } from '@/i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { appendFieldOption, saveFieldOptions } from '@/business/engine'
import { useUserStore } from '@/stores/user'
import {
  batchListOf,
  buildProcInspExport,
  PROC_INSP_EMPTY_BATCH,
  PROC_INSP_FORM_CODE,
  PROC_INSP_TITLE,
} from '@/core/qc/qcProcInspExport.js'

const props = defineProps({
  /** 当前单据(列表行:表头字段平铺 + detail.items 明细) */
  head: { type: Object, required: true },
  /** 面板代号:本组件由「出货检验单功能(QC_PROC_INSP)」与「出货检验表观(QC_ASM_INSP)」共用。
   *  只影响 ①选项库维护接口带的 panelCode ②权限判定;版式/字段完全同一套。 */
  panelCode: { type: String, default: 'QC_PROC_INSP' },
  /** 纸面标题(中文原文,渲染时走 tt)。功能单=出货检验功能记录表;表观单=出货检验表观(2026-11-12 用户口径)。 */
  title: { type: String, default: '出货检验功能记录表' },
  /** 右上角表单编号(用户口径「沿用原来的表单编号」⇒ 两张单都用 YJ-QR-154)。 */
  formCode: { type: String, default: 'YJ-QR-154' },
  /** 「录入对应结果」落在哪个明细字段:功能单=实测数值(历史数据在这列);
   *  表观单(原组装成品检验单)历史数据在「检验结果」列 ⇒ 由挂载方指定,免得老单看起来全是空。 */
  resultTextField: { type: String, default: '实测数值' },
  /** 表头字段元数据(yj_field 下发,已过滤 hidden) */
  fields: { type: Array, default: () => [] },
  /** 明细字段元数据(yj_field 下发;纸面只消费「下拉框」的 options,如「结果判断」合格/不合格) */
  detailFields: { type: Array, default: () => [] },
  /** 草稿态才可填;只读态(已审核/归档/无权限/标注模式)全部渲染成纯文本 */
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty', 'open-items'])

/** 「⚙ 维护处理意见选项」入口的权限:与后端 perm.requireFieldConfig 同源 ——
 *  管理员,或该面板在角色里勾了「自定义字段」(fieldPanels)。没权限的人不显示入口,
 *  免得点了才发现 403(后端仍然兜底校验,前端只是提前隐藏)。 */
const user = useUserStore()
const canMaintainOptions = computed(() => {
  if (user.isAdmin) return true
  return Array.isArray(user.fieldPanels) && user.fieldPanels.includes(props.panelCode)
})

/** 抬头 3 行 × 2 组(图2):label = 印刷标签,key = 单据头数据键。
 *  `readonly: true` 的两处不是元数据能表达的:检测周期是后端派生虚拟字段(库里没有列);
 *  单据编号在元数据里本来就是 editable=0(readonly 下发),这里不重复声明。 */
const HEAD_ROWS = [
  [{ key: '编号', label: '单据编号' }, { key: '检测周期', label: '检测周期', readonly: true }],
  [{ key: '产品编码', label: '产品编码' }, { key: '工单号', label: '工单号' }],
  [{ key: '规格型号', label: '产品型号' }, { key: '检验方案', label: '抽检方案' }],
]
/** 表尾 4 组的可编辑判定(传对象给 canEditHead,保持一处判定逻辑) */
const FOOT_KEYS = {
  inspector: { key: '检验员' },
  summary: { key: '总结论' },
  reviewer: { key: '表单审核人' },
  disposal: { key: '处理方式' },
}
/** 下拉兜底选项(元数据没下发 options 时用;存储数据键,不翻译) */
const RESULT_FALLBACK = ['合格', '不合格']
const SUMMARY_FALLBACK = ['合格', '不合格']
const DISPOSAL_FALLBACK = ['允收', '合格', '不合格', '报废']

/** 本地版本号:明细数组/行可能被面板 markRaw(非响应式),push/splice/写值后不会触发重渲染
 *  ⇒ 用它在组件内**强制刷新**(不依赖面板内部机制)。 */
const bump = ref(0)

/** 明细行(= 一行一个「检验项目 × 内部批次」) */
const items = computed(() => {
  bump.value // ← 建立依赖:变更后强制重算并触发重渲染
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

/** 取(必要时创建)明细数组 —— 新建单据 head.detail 可能是 {} 或 {tabs:[…]} 而**没有 items**。 */
function ensureItems() {
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  return d.items
}

const fieldMap = computed(() => new Map((props.fields || []).map((f) => [f.dataName, f])))
const detailFieldMap = computed(() => new Map((props.detailFields || []).map((f) => [f.dataName, f])))

/* ────────────────────────────── 行分组(一个检验项目一组) ────────────────────────────── */

/** 行 → 分组身份:
 *  · DB 里来的行没有本地身份 ⇒ 按「检验项目」文本分组(同名同项目 = 一组,数据模型如此);
 *  · 本组件「＋新增检验项」造的行会给一个内存 token(WeakMap,**不写进行对象**,不会被
 *    JSON.stringify 带进"未保存修改"快照、也不会跟着明细提交给后端)——
 *    否则连点两次「＋新增检验项」(两个都还没填名字)会被同名的空串塌成一组。
 *  ⚠ 行对象可能被 markRaw,WeakMap 照样能用(它按对象引用记,与响应式无关)。 */
// ⚠ 2026-11-11 实机 bug:原来用 WeakMap<行对象, token> 记身份 —— 但 props.head 可能是 reactive
//   代理:addItem 里 set 的是**当时的对象引用**,渲染时 groups 拿到的可能是代理(或反过来),
//   WeakMap 查不到 ⇒ 连点「＋新增检验项」产生的两个空名字行都退化成 'n:' 键、被塌成**同一组**
//   (实测:明细 items 3 行、groups 只剩 1 组)。改用 **Symbol 键**直接挂在行上:
//   ① 经代理读照样拿得到;② Symbol 键不会被 Object.keys/展开/JSON.stringify 带走 ⇒
//   不进"未保存修改"快照、也不随明细提交给后端(与原来的设计约束一致)。
const ROW_TOKEN = Symbol('qcProcInspRowToken')
let tokenSeq = 0
function tokenOf(row) {
  return row && typeof row === 'object' ? row[ROW_TOKEN] : undefined
}
function setToken(row, token) {
  if (row && typeof row === 'object' && token) row[ROW_TOKEN] = token
}
function groupKeyOf(row) {
  const token = tokenOf(row)
  if (token) return 't:' + token
  return 'n:' + String(row?.['检验项目'] ?? '')
}

/** 检验项目分组:按明细数组顺序把**连续的**同一个项目行收成一组(顺序 = 数据顺序,
 *  不做排序;保存时数组顺序原样落库)。 */
const groups = computed(() => {
  bump.value
  const out = []
  let cur = null
  for (const row of items.value) {
    if (!row || typeof row !== 'object') continue
    const key = groupKeyOf(row)
    if (!cur || cur.key !== key) {
      cur = { key, name: String(row['检验项目'] ?? ''), rows: [] }
      out.push(cur)
    }
    cur.rows.push(row)
  }
  // 名字以下面渲染时取「首个有值的行」为准(手工新增的空名字组填了字要立刻显示)
  for (const g of out) {
    const named = g.rows.find((r) => String(r?.['检验项目'] ?? '').trim())
    if (named) g.name = String(named['检验项目'])
  }
  return out
})

/** 规范化/编辑后 computed 会重算出新的 group 对象 —— 按"是否含同一批行对象"找回最新那一组。 */
function liveGroup(group) {
  if (!group) return group
  const rows = group.rows || []
  return groups.value.find((g) => g.rows.some((r) => rows.includes(r))) || group
}

/** 组内某列的值(检验项目/检验方法/检验要求在组内各批次行上应写穿同值;取首个非空兜底) */
function groupCell(group, key) {
  const g = liveGroup(group)
  if (!g) return ''
  for (const r of g.rows) {
    const v = r?.[key]
    if (v !== undefined && v !== null && String(v) !== '') return String(v)
  }
  return ''
}

/** 组内「有没有填过东西」(删项目要不要弹确认看它) */
function groupHasContent(group) {
  return group.rows.some((r) => ['检验项目', '检验要求', '检验方法', '结果判断']
    .some((k) => String(r?.[k] ?? '').trim()))
}

/* ────────────────────────────── 批次列(内部批次清单) ────────────────────────────── */

function splitBatchCsv(v) {
  // 英文逗号是设计口径;顺手兼容中文逗号/分号(历史/手填数据里常见)
  return String(v ?? '').split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)
}
function uniqueNames(list) {
  const out = []
  for (const raw of list || []) {
    const name = String(raw ?? '').trim()
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}
function csvOf(list) {
  return uniqueNames(list).join(',')   // 头表「内部批次清单」= 英文逗号分隔(设计 §二)
}
/** 旧单单批次列的批号兜底:头「批次号」空则「本批」(与导出模块 PROC_INSP_EMPTY_BATCH 同一口径) */
function legacyBatchName() {
  return String(props.head?.['批次号'] ?? '').trim() || PROC_INSP_EMPTY_BATCH
}

/** 批次列清单(有序):头「内部批次清单」优先 → 明细行上出现过的「内部批次」(兜底,保证不藏行)
 *  → 都没有则旧单单批次列。 */
const batches = computed(() => {
  bump.value
  const csv = splitBatchCsv(props.head?.['内部批次清单'])
  const onRows = items.value.map((r) => String(r?.['内部批次'] ?? '').trim())
  const merged = uniqueNames([...csv, ...onRows])
  if (merged.length) return merged
  return [legacyBatchName()]
})

/** 旧单判定:清单空 **且** 所有行都没 内部批次 ⇒ 单批次列,结果取行「结果判断」。 */
const legacyMode = computed(() => {
  bump.value
  if (splitBatchCsv(props.head?.['内部批次清单']).length) return false
  return !items.value.some((r) => String(r?.['内部批次'] ?? '').trim())
})

/** 组 × 批次 → 该单元格对应的明细行(一行 = 项目 × 批次) */
function cellRow(group, batch) {
  const g = liveGroup(group)
  if (!g) return null
  if (legacyMode.value) return g.rows[0] || null
  const name = String(batch ?? '').trim()
  return g.rows.find((r) => String(r?.['内部批次'] ?? '').trim() === name) || null
}
/** 单元格「结果判断」值(空值统一成空串) */
function cellValue(group, batch) {
  return String(cellRow(group, batch)?.['结果判断'] ?? '')
}
/** 单元格「录入对应结果」值(图2:每批第一列 = 录入结果文本,落库「实测数值」;空值统一成空串) */
function cellResultText(group, batch) {
  return String(cellRow(group, batch)?.[props.resultTextField] ?? '')
}

/* ────────────────────────────── 规范化(草稿首次编辑时回填) ────────────────────────────── */

/** 造一行「某批次」的副本:除 结果判断/实测数值/内部批次 外的字段照抄项目首行
 *  (检验要求/方法写穿口径;实测数值属"该批次这一个格"的结果,新批次必须从空开始)
 *  ⚠ **必须丢掉 id**:后端 upsert 的口径是「有 id = UPDATE,无 id = INSERT」——
 *    复制行若带着原行的 id,两个批次会先后 UPDATE 同一行,最后只剩一行(2026-11-11 实测:
 *    12 行提交、库里只剩 6 行且全是后一个批次)。新行的 行号 也按规范化序列重新发号,
 *    否则同项目各批次行号相同,列表页/报表的排序会漂。 */
function cloneRowForBatch(base, batch) {
  const row = {}
  for (const k of Object.keys(base || {})) {
    if (k === 'id') continue
    if (k === '结果判断' || k === '实测数值' || k === '检验结果' || k === '内部批次' || k === '行号' || k.startsWith('_')) continue
    row[k] = base[k]
  }
  if (!('表区' in row)) row['表区'] = ''
  row['行号'] = ++rowNoSeq
  row['内部批次'] = batch
  row['结果判断'] = ''
  return row
}

/** 规范化期间的发号器(每次 normalizeRows 起点 = 当前最大行号) */
let rowNoSeq = 0

/** 下一个行号(新行排在末尾;列表页也按 行号 排) */
function nextRowNo() {
  return items.value.reduce((m, r) => Math.max(m, Number(r?.['行号']) || 0), 0) + 1
}

/** 需不需要规范化(便宜检查,避免每次敲键都重建数组):
 *  ① 头「内部批次清单」与当前批次列不一致;② 有行没有 内部批次;③ 有项目缺某个批次的行。 */
function needsNormalize() {
  const list = batches.value
  if (!list.length) return false
  if (String(props.head?.['内部批次清单'] ?? '') !== csvOf(list)) return true
  for (const row of items.value) {
    if (!String(row?.['内部批次'] ?? '').trim()) return true
  }
  for (const g of groups.value) {
    for (const b of list) {
      if (!g.rows.some((r) => String(r?.['内部批次'] ?? '').trim() === b)) return true
    }
  }
  return false
}

/**
 * 规范化明细(可编辑草稿**首次编辑时**执行;只改内存、发 dirty 由调用方做):
 *  ① 回填头「内部批次清单」;
 *  ② 没 内部批次 的行(旧单 / 「带入检验项目」造的行)归到第一列批次;
 *  ③ 每个检验项目 × 每个批次都要有一行 —— 缺的按项目首行复制出来(结果留空);
 *  ④ 清单外的批次行(理论上不该有)原样保留在组尾,不丢数据。
 *  ⚠ 绝不删除任何已有行(重复行/孤儿行都保留),避免规范化把用户数据弄丢。
 *  ⚠ `listOverride` 用于「刚改了清单、computed 还没重算」的场景(addBatch):不加这个参数,
 *    这里会读到**旧的** batches 缓存把新批次写回去(实测 bug:加了批次又消失)。
 */
function normalizeRows(listOverride) {
  if (!props.editable) return
  const arr = ensureItems()
  rowNoSeq = arr.reduce((m, r) => Math.max(m, Number(r?.['行号']) || 0), 0)
  const list = (Array.isArray(listOverride) && listOverride.length ? listOverride : batches.value).slice()
  const csv = csvOf(list)
  if (String(props.head?.['内部批次清单'] ?? '') !== csv) props.head['内部批次清单'] = csv
  for (const row of arr) {
    if (row && typeof row === 'object' && !String(row['内部批次'] ?? '').trim()) row['内部批次'] = list[0]
  }
  const out = []
  let i = 0
  while (i < arr.length) {
    const base = arr[i]
    if (!base || typeof base !== 'object') { out.push(base); i++; continue }
    const key = groupKeyOf(base)
    let j = i + 1
    while (j < arr.length && arr[j] && typeof arr[j] === 'object' && groupKeyOf(arr[j]) === key) j++
    const rows = arr.slice(i, j)
    const byBatch = new Map()      // 批次 → 该批的行(先到先得)
    const extra = []               // 同批次重复行 / 清单外批次行:原样保留
    for (const row of rows) {
      const b = String(row['内部批次'] ?? '').trim()
      if (byBatch.has(b)) extra.push(row)
      else byBatch.set(b, row)
    }
    const token = tokenOf(base)
    for (const b of list) {
      const hit = byBatch.get(b)
      if (hit) { out.push(hit); continue }
      const row = cloneRowForBatch(base, b)
      if (token) setToken(row, token)   // 复制出来的行仍属于同一项目
      out.push(row)
    }
    for (const row of extra) out.push(row)
    i = j
  }
  arr.splice(0, arr.length, ...out)
  bump.value++
}

/** 编辑前先保证数据已规范化(只在 editable 且真的缺结构时才重建,平时是几次数组遍历) */
function ensureNormalized() {
  if (!props.editable) return
  if (needsNormalize()) normalizeRows()
}

/* ────────────────────────────── 写操作(全部 emit('dirty')) ────────────────────────────── */

/** 抬头输入值文本 */
function headText(key) {
  const v = props.head?.[key]
  return v === undefined || v === null ? '' : String(v)
}

/** 只读判定:后端契约 —— yj_field.editable=0 在 dataSchema 里下发的是 **`readonly:true`**
 *  (PanelConfigService.fieldSpec:`if (!f.editable()) m.put("readonly", true)`)。
 *  未登记 ≠ 锁定(与其它纸张同口径)。 */
function isLockedKey(key) {
  const f = fieldMap.value.get(key)
  return !!f && (f.readonly === true || f.editable === false || f.editable === 0)
}
/** 抬头格可填?cell.readonly = 代码级只读(检测周期等派生字段,库里没列) */
function canEditHead(cell) {
  if (!cell || cell.readonly) return false
  return props.editable && !isLockedKey(cell.key)
}

/** 项目级字段(检验项目/检验方法/检验要求)写入:**写穿同项目所有批次行** */
function setItemField(group, key, v) {
  if (!props.editable) return
  ensureNormalized()
  const g = liveGroup(group)
  if (!g) return
  const val = String(v ?? '')
  for (const row of g.rows) row[key] = val
  bump.value++
  emit('dirty')
}

/** 某单元格(项目 × 批次)的「录入对应结果」写入(落库「实测数值」;图2 每批第一列)
 *  与结果判断同一套兜底:规范化后理论上一行不缺,缺了临时补一行,不丢用户刚录入的结果。 */
function setResultText(group, batch, v) {
  if (!props.editable) return
  ensureNormalized()
  const g = liveGroup(group)
  if (!g) return
  let row = cellRow(g, batch)
  if (!row) {
    row = cloneRowForBatch(g.rows[0], batch)
    const token = tokenOf(g.rows[0])
    if (token) setToken(row, token)
    ensureItems().push(row)
  }
  row[props.resultTextField] = String(v ?? '')
  bump.value++
  emit('dirty')
}

/** 某单元格(项目 × 批次)的结果判断写入 */
function setResult(group, batch, v) {
  if (!props.editable) return
  ensureNormalized()
  const g = liveGroup(group)
  if (!g) return
  let row = cellRow(g, batch)
  if (!row) {
    // 规范化后理论上一行不缺;兜底:临时补一行,不丢用户刚选的判定
    row = cloneRowForBatch(g.rows[0], batch)
    const token = tokenOf(g.rows[0])
    if (token) setToken(row, token)
    ensureItems().push(row)
  }
  row['结果判断'] = String(v ?? '')
  bump.value++
  emit('dirty')
}

/** ＋新增检验项:每个批次各加一行(保证矩阵每格都有落点) */
function addItem() {
  if (!props.editable) return
  ensureNormalized()
  const list = batches.value.slice()
  let rowNo = nextRowNo()
  const token = 'g' + (++tokenSeq)
  const arr = ensureItems()
  for (const b of list) {
    const row = {
      表区: '',
      行号: rowNo++,
      检验项目: '',
      检验要求: '',
      检验方法: '',
      内部批次: b,
      结果判断: '',
    }
    setToken(row, token)
    arr.push(row)
  }
  bump.value++
  emit('dirty')
}

/** 删除检验项(删该项目的**所有**批次行;填过内容的先确认) */
async function removeItem(group) {
  if (!props.editable || !group) return
  const g = liveGroup(group)
  if (groupHasContent(g)) {
    try {
      await ElMessageBox.confirm(
        tt('删除该项目将清除其所有批次的记录，确定删除吗？'), tt('删除检验项'),
        { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
      )
    } catch { return /* 取消 */ }
  }
  const kill = new Set(g.rows)
  const arr = ensureItems()
  for (let i = arr.length - 1; i >= 0; i--) {
    if (kill.has(arr[i])) arr.splice(i, 1)
  }
  bump.value++
  emit('dirty')
}

/** 批次里有没有已填的判定(删批次要不要弹确认看它) */
function batchHasData(name) {
  const key = String(name ?? '').trim()
  return items.value.some((r) => String(r?.['内部批次'] ?? '').trim() === key
    && String(r?.['结果判断'] ?? '').trim())
}

/** 默认新批次名(数据值,不翻译;紧随现有批次数顺延,避开重名) */
function newBatchName(list) {
  let n = list.length + 1
  while (list.includes('新批次' + n)) n++
  return '新批次' + n
}

/** ＋添加批次:清单追加一个批次 + 给每个检验项目各补一行(结果空) */
function addBatch() {
  if (!props.editable) return
  ensureNormalized()
  const list = batches.value.slice()
  const name = newBatchName(list)
  const nextList = [...list, name]
  props.head['内部批次清单'] = csvOf(nextList)
  // 清单刚改、batches computed 可能还没重算 ⇒ 把新清单**显式**交给规范化,免得读回旧缓存
  normalizeRows(nextList)
  batchDrafts.value = {}
  bump.value++
  emit('dirty')
}

/** 删除批次:删清单项 + 该批所有行(只读单/仅剩一个批次时不给删) */
async function deleteBatch(idx) {
  if (!props.editable) return
  const list = batches.value.slice()
  if (list.length <= 1) {
    ElMessage.warning(tt('至少保留一个批次'))
    return
  }
  const name = list[idx]
  if (batchHasData(name)) {
    try {
      await ElMessageBox.confirm(
        tt('删除批次将清空该批次所有判定结果，确定删除吗？'), tt('删除批次'),
        { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
      )
    } catch { return /* 取消 */ }
  }
  ensureNormalized()
  list.splice(idx, 1)
  props.head['内部批次清单'] = csvOf(list)
  const key = String(name ?? '').trim()
  const arr = ensureItems()
  for (let i = arr.length - 1; i >= 0; i--) {
    if (String(arr[i]?.['内部批次'] ?? '').trim() === key) arr.splice(i, 1)
  }
  batchDrafts.value = {}
  bump.value++
  emit('dirty')
}

/* 批次号改名:表头格内直接改 —— 输入过程中先放本地草稿(允许暂时为空/半截字符),
   提交(change/blur)时才写回清单与所有行,避免边打字边把列名改成空串导致整列消失。 */
const batchDrafts = ref({})
function batchDraftOf(idx) {
  const draft = batchDrafts.value[idx]
  return draft === undefined ? (batches.value[idx] ?? '') : draft
}
function onBatchInput(idx, v) {
  batchDrafts.value[idx] = String(v ?? '')
}
function onBatchCommit(idx) {
  const draft = batchDrafts.value[idx]
  if (draft === undefined) return
  delete batchDrafts.value[idx]
  const oldName = batches.value[idx]
  const name = String(draft ?? '').trim()
  if (!name) {
    ElMessage.warning(tt('批次号不能为空'))
    bump.value++
    return
  }
  if (name === oldName) { bump.value++; return }
  if (batches.value.some((b, i) => i !== idx && b === name)) {
    ElMessage.warning(tt('批次号重复'))
    bump.value++
    return
  }
  ensureNormalized()
  const list = batches.value.slice()
  list[idx] = name
  props.head['内部批次清单'] = csvOf(list)
  for (const row of items.value) {
    if (String(row?.['内部批次'] ?? '').trim() === oldName) row['内部批次'] = name
  }
  bump.value++
  emit('dirty')
}

/* ────────────────────────────── 下拉选项 ────────────────────────────── */

/** 字段下拉选项:yj_field dataType='下拉框' 且下发 options 时才用,否则用契约兜底。
 *  options 是**存储数据键**(合格/不合格/允收/报废),渲染不做 tt() 翻译。 */
function optionsOf(mapRef, key, fallback) {
  const f = mapRef.value.get(key) || fieldMap.value.get(key)
  if (f && f.dataType === '下拉框' && Array.isArray(f.options) && f.options.length) return f.options.slice()
  return fallback.slice()
}
/** 把"不在选项里的历史值"临时追加成 option —— 老单的 结果判断/总结论/处理方式 可能是自由文本,
 *  直接 el-select 会显示成空白把原值吞掉(用户报障口径)。 */
function withCurrentOption(options, current) {
  const cur = String(current ?? '')
  if (cur && !options.includes(cur)) options.push(cur)
  return options
}
/** 单元格「结果判断」的选项(逐格取:不同批次可能有不同的历史值) */
function resultOptions(group, batch) {
  return withCurrentOption(
    optionsOf(detailFieldMap, '结果判断', RESULT_FALLBACK),
    cellValue(group, batch),
  )
}
const summaryOptions = computed(() => withCurrentOption(
  optionsOf(fieldMap, '总结论', SUMMARY_FALLBACK), props.head?.['总结论'],
))
const disposalOptions = computed(() => withCurrentOption(
  (() => {
    const opts = (disposalBase.value || optionsOf(fieldMap, '处理方式', DISPOSAL_FALLBACK)).slice()
    for (const v of disposalExtra.value) if (!opts.includes(v)) opts.push(v)
    return opts
  })(),
  props.head?.['处理方式'],
))
/** 处理意见(处理方式)的「选项库」本会话增量:用户手输新意见 → 追加到 yj_field.dict_sql(服务端持久化)
 *  + 本地立即出现(不必刷新)。2026-11-11 用户口径「选择库可自动增加处理意见」——
 *  只靠 el-select 的 allow-create 只作用于当前浏览器会话、下次打开就没了,所以这里要落库。 */
const disposalExtra = ref([])
/** 处理意见变更:新增值(选项库里没有的)= 手输的新意见 ⇒ 调后端加进选项库(失败静默,不阻断保存) */
function onDisposalChange(v) {
  const val = String(v ?? '').trim()
  const base = optionsOf(fieldMap, '处理方式', DISPOSAL_FALLBACK)
  if (val && !base.includes(val) && !disposalExtra.value.includes(val)) {
    disposalExtra.value = [...disposalExtra.value, val]
    appendFieldOption({ panelCode: props.panelCode, label: '处理方式', option: val }).catch(() => { /* 选项库失败不影响保存 */ })
  }
  emit('dirty')
}

/* ────────────────────── 处理意见「选项库」维护弹窗(2026-11-11) ────────────────────── */

/** 选项库基线:默认取字段元数据下发的 options(元数据没下发时用兜底清单);
 *  弹窗保存成功后写这里 ⇒ 当前页面立刻用新清单,不必等面板重载配置。 */
const disposalBase = ref(null)
/** 弹窗状态:草稿清单(字符串数组)+ 保存中 */
const optManagerVisible = ref(false)
const optDraft = ref([])
const optSaving = ref(false)
/** 打开维护弹窗:用当前有效选项(基线 ∪ 本会话新增 ∪ 本单当前值)做草稿 */
function openOptManager() {
  const base = disposalBase.value || optionsOf(fieldMap, '处理方式', DISPOSAL_FALLBACK)
  const list = [...base]
  for (const v of disposalExtra.value) if (!list.includes(v)) list.push(v)
  const cur = String(props.head?.['处理方式'] ?? '').trim()
  if (cur && !list.includes(cur)) list.push(cur)   // 本单的当前值也编进草稿,避免"一打开就丢"
  optDraft.value = list
  optManagerVisible.value = true
}
function addOptRow() { optDraft.value = [...optDraft.value, ''] }
function removeOptRow(idx) { optDraft.value = optDraft.value.filter((_, i) => i !== idx) }
/** 保存:整份清单交给后端(可增/删/改名/排序);失败给出原因、不关弹窗 */
async function saveOptManager() {
  if (optSaving.value) return
  const cleaned = []
  for (const raw of optDraft.value) {
    const v = String(raw ?? '').trim()
    if (!v) continue
    if (v.length > 200) { ElMessage.warning(tt('选项内容不能超过200个字')); return }
    if (!cleaned.includes(v)) cleaned.push(v)
  }
  if (!cleaned.length) { ElMessage.warning(tt('至少保留一个选项')); return }
  optSaving.value = true
  try {
    const ok = await saveFieldOptions({ panelCode: props.panelCode, label: '处理方式', options: cleaned })
    if (!ok) { ElMessage.error(tt('选项维护失败')); return }
    disposalBase.value = cleaned
    disposalExtra.value = []
    optManagerVisible.value = false
    ElMessage.success(tt('选项已保存'))
  } catch (e) {
    ElMessage.error(tt('选项维护失败'))
  } finally {
    optSaving.value = false
  }
}

/* ────────────────────────────── 列宽(动态批次列) ────────────────────────────── */

/** 空表提示行要跨的列数(3 项目列 + 每批 2 列 + 操作列) */
const colspanAll = computed(() => 3 + batches.value.length * 2 + (props.editable ? 1 : 0))

/**
 * 列宽(百分比 ⇒ 屏幕与打印同一套,打印不会因为列多被裁)。
 *
 * 【2026-11-17 用户口径】「把检验方法列调宽,检验要求调小」——截图里检验方法列只有 ~139px,
 * 一段「将炭棒水平放置在水压平压板上…」被压成 7 行、字号挤成一团;而检验要求列 322px 里
 * 多数是「≥48g」「目视」这种短句,wch 也印证同一方向(导出侧 qcProcInspExport.js:
 * 检验项目 14 / 检验方法 40 / 检验要求 34 —— 方法本来就该比要求宽)。
 *
 * 口径:**检验方法 30% / 检验要求 14%(批次 3 个时 13%、4 个以上 12%)** / 检验项目 9%,
 * 批次列照旧平分余量。方法拿到要求让出的绝大部分宽度,不再被压成一行一个字。
 *   · 旧值 检验方法 12% / 检验要求 32%(n≤2) —— 方法比要求窄 20 个百分点,是这次报障的根因;
 *   · 检验项目 11%→9%:它是「*外观」「*整休尺寸(内PP棉)」这类短标签,让出宽度给方法;
 *   · 批次多时(n≥3)要求列同步收紧,不把批次列挤到放不下输入框。
 */
const colWidths = computed(() => {
  const n = Math.max(batches.value.length, 1)
  const opPct = props.editable ? 3.5 : 0
  const itemPct = 9           // 检验项目(短标签「*外观」「≥48g」这类)
  const mtdPct = 30           // 检验方法(长文本,本次调宽:12% → 30%)
  const reqPct = n <= 2 ? 14 : n === 3 ? 13 : 12   // 检验要求(短句居多,本次调小:32% → 14%)
  const pairTotal = Math.max(100 - itemPct - mtdPct - reqPct - opPct, n * 6)
  const pairPct = pairTotal / n
  const out = [itemPct + '%', mtdPct + '%', (100 - itemPct - mtdPct - opPct - pairTotal).toFixed(2) + '%']
  for (let i = 0; i < n; i++) {
    // 每个批次两列各占一半:批次号列要放得下「批次号」小标签 + 改名输入框 + 删除 ×
    out.push((pairPct * 0.5).toFixed(2) + '%', (pairPct * 0.5).toFixed(2) + '%')
  }
  if (props.editable) out.push(opPct + '%')
  return out
})
/** 屏幕最小宽(列多时不把字挤没,外层 .qr-grid-scroll 出横向滚动;打印时收回纸宽)。
 *  每批至少 ~240px(两列)+ 三个项目列 ~360px,否则批次号表头格放不下「标签+输入框+×」。 */
const gridMinWidth = computed(() => `${360 + batches.value.length * 240 + (props.editable ? 36 : 0)}px`)

/* ────────────────────────────── 导出 Excel(版式单一真源在 qcProcInspExport.js) ────────────────────────────── */

/**
 * 导出的是**当前这张纸**(出货检验功能记录表),不是列表页那套数据导出。
 * 版式(标题 + 右上表单编号 / 副标题 / 抬头 3 行 / 「检验明细」矩阵按批次展开 / 表尾 2 行)由
 * `core/qc/qcProcInspExport.js` 的纯函数给(有单测钉死),这里只做 aoa_to_sheet + 列宽 + 合并 + writeFile。
 * 入口:面板右侧「文档输出 → 导出」→ PanelxList.exportSheetExcel 按面板码路由到本函数。
 */
async function exportProcInspExcel() {
  const XLSX = await import('xlsx')
  const head = props.head || {}
  // 批次列:头清单优先;再并上"行上出现过但清单没写"的批次(与本纸张显示的列完全一致)
  const batchNames = uniqueNames([...batchListOf(head), ...batches.value])
  const detailRows = groups.value.map((g) => {
    const verdicts = {}
    const texts = {}
    for (const b of batchNames) {
      verdicts[b] = cellValue(g, b)
      texts[b] = cellResultText(g, b)
    }
    return {
      检验项目: groupCell(g, '检验项目'),
      检验方法: groupCell(g, '检验方法'),
      检验要求: groupCell(g, '检验要求'),
      实测数值: texts,
      结果: verdicts,
    }
  })
  const headPairs = HEAD_ROWS.map((pair) => pair.map((cell) => ({
    label: tt(cell.label),
    value: headText(cell.key),
  })))
  const foot = [
    { label: tt('检验人'), value: headText('检验员') },
    { label: tt('检验结论'), value: headText('总结论') },
    { label: tt('审核人'), value: headText('表单审核人') || headText('审核人') },
    { label: tt('处理意见'), value: headText('处理方式') },
  ]
  const subtitle = [
    tt('惠州市银嘉环保科技有限公司'),
    `${tt('单据编号')}：${headText('编号')}`,
    `${tt('单据状态')}：${tt(headText('单据状态'))}`,
  ].join('　　')
  const { aoa, cols, merges } = buildProcInspExport({
    title: tt(props.title || PROC_INSP_TITLE),
    subtitle,
    formCode: props.formCode || PROC_INSP_FORM_CODE,
    // 标签文字也走词条:英文界面导出的区块标题/表单编号标签跟着变
    // (列头「检验项目/检验方法/检验要求/批次号/本批结果判断」按受控表单印刷文字保持中文,由导出模块定义)
    formCodeLabel: tt('表单编号'),
    detailTitle: tt('检验明细'),
    headPairs,
    batches: batchNames,
    rows: detailRows,
    foot,
  })
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  // ⚠ xlsx 社区版 0.18.5 只把 !cols / !merges 写进 .xlsx,单元格样式(.s)落不进去(见导出模块头部取证)
  ws['!cols'] = cols
  ws['!merges'] = merges
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, tt(PROC_INSP_TITLE).slice(0, 28))
  XLSX.writeFile(wb, `${tt(PROC_INSP_TITLE)}-${headText('编号') || PROC_INSP_FORM_CODE}.xlsx`)
}

defineExpose({ exportProcInspExcel })
</script>

<style scoped>
/* ── 纸张本体(沿用出货检验单原来的白纸/蓝格观感;边框/底色用固定色,打印件颜色不受皮肤影响) ── */
.qr-sheet {
  background: #fff;
  border: 1px solid #d7dce5;
  padding: 10px 12px 14px;
  margin: 0 6px 8px;
  color: #222;
  font-size: 12px;
  /* 批次列多时纸张不能被内容撑宽(弹性布局下 min-width:auto 会按 min-content 撑开 ⇒ 右侧批次列
     被裁在视口外、又没有滚动条);这里允许收缩,超宽由内部 .qr-grid-scroll 横向滚动消化 */
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.qr-sheet *,
.qr-sheet *::before,
.qr-sheet *::after {
  box-sizing: border-box;
}
/* 纸头:标题居中 + 表单编号右上(同一块,编号绝对定位到右侧) */
.qr-paper-head {
  position: relative;
  margin: 2px 0 10px;
  padding-right: 150px;
}
.qr-title {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 3px;
  color: #1f4e79;
}
.qr-formno {
  position: absolute;
  right: 0;
  bottom: 2px;
  font-size: 12px;
  color: #1f4e79;
  white-space: nowrap;
}
/* 抬头 / 表尾:2 组「标签|值」× 4 列 */
.qr-head-table,
.qr-foot-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
  table-layout: fixed;
}
.qr-head-label-col,
.qr-foot-label-col {
  width: 96px;
}
.qr-label {
  border: 1px solid #b8cfe6;
  background: #dce9f5;
  font-weight: 600;
  color: #1f4e79;
  text-align: center;
  padding: 3px 6px;
  white-space: nowrap;
}
.qr-value {
  border: 1px solid #b8cfe6;
  padding: 1px 4px;
  text-align: left;
  background: #fff;
  word-break: break-all;
}
/* 分区带(「检验明细」+ 动作):标题与动作放同一行居中,窄屏自动换行
   (原实现动作绝对定位到右侧,面板一窄就压到标题上 —— 2026-11-11 实测) */
.qr-band {
  margin-top: -1px;
  border: 1px solid #b8cfe6;
  background: #cfe0f2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px 14px;
  padding: 3px 8px;
  font-size: 13px;
  font-weight: 700;
  color: #1f4e79;
}
.qr-band-acts {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
/* 动作文字走项目主色(皮肤切换跟着变),纸张格子本身保持印刷色 */
.qr-band-act {
  font-size: 12px;
  font-weight: 400;
  color: var(--t-primary, #2b6cb0);
  cursor: pointer;
  white-space: nowrap;
}
.qr-band-act:hover {
  text-decoration: underline;
}
/* 明细矩阵:屏上列多时横向滚动(打印收回纸宽) */
.qr-grid-scroll {
  overflow-x: auto;
  margin-top: -1px;
  max-width: 100%;
}
.qr-grid {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  font-size: 12px;
}
.qr-grid th,
.qr-grid td {
  border: 1px solid #b8cfe6;
  padding: 3px 4px;
  text-align: center;
  vertical-align: middle;
  word-break: break-all;
}
.qr-grid thead th {
  background: #dce9f5;
  color: #1f4e79;
  font-weight: 600;
  white-space: normal;
}
.qr-grid th.c-result {
  background: #e8f1fa;
  font-weight: 600;
}
/* 批次号表头格:标签 + 改名输入框 + 删除小 × */
.c-batchname {
  padding: 2px 3px !important;
}
.qr-batch-head {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1px;
}
.qr-batch-label {
  white-space: nowrap;
  font-size: 11px;
}
.qr-batch-edit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
}
.qr-batch-input {
  flex: 1 1 auto;
  min-width: 0;
}
.qr-batch-input :deep(.el-input__inner) {
  font-size: 11px;
}
.qr-batch-del {
  flex: none;
  font-weight: 700;
  color: var(--t-badge, #f56c6c);
  cursor: pointer;
  padding: 0 1px;
  line-height: 1;
}
/* 明细各列:要求/方法左对齐(文字长),批次号与结果居中 */
.qr-grid td.c-mtd,
.qr-grid td.c-req {
  text-align: left;
  vertical-align: top;
  line-height: 17px;
}
.qr-grid td.c-item {
  text-align: center;
  vertical-align: top;
}
.qr-grid td.c-batchtext {
  color: #1f4e79;
  background: #fbfdff;
  word-break: break-all;
}
.qr-grid td.c-result {
  text-align: center;
}
.c-op {
  width: 34px;
  padding: 2px !important;
}
.qr-row-del {
  font-weight: 700;
  color: var(--t-badge, #f56c6c);
  cursor: pointer;
  padding: 0 2px;
}
.c-empty {
  color: #8a94a0;
  padding: 12px 0;
  text-align: center;
}
/* 输入控件:方角、贴合单元格(以格子边框为唯一框) */
.qr-cell-input :deep(.el-input__wrapper),
.qr-cell-input :deep(.el-textarea__inner) {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
}
.qr-cell-input :deep(.el-input__wrapper) {
  padding: 0 2px;
}
.qr-cell-input :deep(.el-input__wrapper:hover),
.qr-cell-input :deep(.el-input__wrapper.is-focus),
.qr-cell-input :deep(.el-textarea__inner:hover),
.qr-cell-input :deep(.el-textarea__inner:focus) {
  box-shadow: none;
  background: #f2f8ff;
}
.qr-cell-input :deep(.el-input__inner) {
  height: 20px;
  line-height: 20px;
}
/* 下拉(结果判断):控件观感与同格输入框一致 —— 无边框、贴合格线 */
.qr-cell-input :deep(.el-select__wrapper) {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  padding: 0 2px;
  min-height: 20px;
}
.qr-cell-input :deep(.el-select__wrapper:hover),
.qr-cell-input :deep(.el-select__wrapper.is-focused) {
  background: #f2f8ff;
  box-shadow: none;
}
.qr-cell-input :deep(.el-select__selected-item),
.qr-cell-input :deep(.el-select__placeholder) {
  font-size: 12px;
  line-height: 20px;
}
.qr-grid td.c-result .qr-cell-input :deep(.el-select__placeholder) {
  text-align: center;
}
.qr-grid td.c-mtd .qr-cell-input :deep(.el-input__inner),
.qr-grid td.c-req .qr-cell-input :deep(.el-input__inner) {
  text-align: left;
}
.qr-cell-wrap :deep(.el-textarea__inner) {
  text-align: left;
  padding: 2px;
  line-height: 18px;
  resize: none;
  font-family: inherit;
}
.qr-cell-text {
  display: inline-block;
  min-height: 18px;
  white-space: pre-wrap;
  text-align: left;
  width: 100%;
}
.qr-grid td.c-item .qr-cell-text,
.qr-grid td.c-result .qr-cell-text,
.qr-grid td.c-batchtext .qr-cell-text {
  text-align: center;
}
/* 表尾(检验人|检验结论 / 审核人|处理意见)与抬头同一套格子 */
.qr-foot-table {
  margin-top: -1px;
}
.qr-foot-table .qr-value {
  padding: 2px 4px;
}
/* 只读态:值文本按词换行,不横向滚动 */
.qr-grid td .qr-cell-text {
  word-break: break-word;
}

/* ── 处理意见「选项库」维护(2026-11-11 用户口径:弹窗形式更好维护) ── */
.qr-label .qr-opt-mgr {
  margin-left: 4px;
  cursor: pointer;
  color: var(--el-color-primary, #116a5b);
  font-size: 13px;
  font-weight: 400;
}
.qr-label .qr-opt-mgr:hover { text-decoration: underline; }
.qr-opt-hint { font-size: 12px; line-height: 1.5; color: #8b9893; margin-bottom: 10px; }
.qr-opt-list { max-height: 260px; overflow-y: auto; }
.qr-opt-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
/* 多行域:宽度铺满、内部自动换行(长串也按字符断行,不横向溢出) */
.qr-opt-input { flex: 1 1 auto; min-width: 0; }
.qr-opt-input :deep(.el-textarea__inner) {
  white-space: pre-wrap;
  word-break: break-all;
  overflow-wrap: anywhere;
  line-height: 1.5;
}
.qr-opt-del { flex: none; cursor: pointer; color: #c0392b; font-size: 16px; line-height: 1; padding: 6px 4px 0; }
.qr-opt-add {
  display: inline-block;
  margin-top: 4px;
  color: var(--el-color-primary, #116a5b);
  cursor: pointer;
  font-size: 13px;
}
</style>

<!-- ══════════════════════════════════════════════════════════════════════════
     打印整张:只保留纸张(与首件检验单 / 检验数据记录表 / 检验目录 同口径)
     ══════════════════════════════════════════════════════════════════════════
     🔴 2026-10-21 修 —— 此前本组件**没有**这段,点「打印」出来是**空白页**:
        公共打印样式(DocSheet.vue 的非 scoped 块)把 `body.approval-printing .portal` 整体
        `visibility: hidden`,再逐个 whitelist 纸张根类名 —— 名单里没有 `.qr-sheet`
        ⇒ print 媒体下 `.qr-sheet` 的 computed visibility = hidden(实测)。
     ⚠ 与首件同一套写法(visibility 白名单 + 定位到左上 + 收窄表格 + 打印字号);
       本纸是竖向 A4(表样本身是竖的),列多时按百分比列宽自动收,不裁切。
     ⚠ 不要用 `display:none` 藏别的东西(同页可能还挂着别的面板,keep-alive),只藏操作栏。 -->
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
  body.approval-printing .tools,
  body.approval-printing .doc-select-rail {
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
  body.approval-printing .qr-sheet {
    visibility: visible !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    margin: 0 !important;
    border: 1px solid #8a8a8a !important;
    box-shadow: none !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .qr-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  /* 屏上"列多靠 min-width 撑开 + 横向滚动";打印必须收回纸宽,不能裁掉右半张 */
  body.approval-printing .qr-grid-scroll {
    overflow: visible !important;
  }
  body.approval-printing .qr-grid {
    min-width: 0 !important;
    width: 100% !important;
    table-layout: fixed !important;
    font-size: 9px !important;
  }
  body.approval-printing .qr-head-table,
  body.approval-printing .qr-foot-table {
    font-size: 9px !important;
  }
  body.approval-printing .qr-grid th,
  body.approval-printing .qr-grid td,
  body.approval-printing .qr-head-table th,
  body.approval-printing .qr-head-table td,
  body.approval-printing .qr-foot-table th,
  body.approval-printing .qr-foot-table td {
    font-size: 9px !important;
    padding: 1px 2px !important;
    height: auto !important;
    line-height: 1.25 !important;
  }
  body.approval-printing .qr-title {
    font-size: 17px !important;
    letter-spacing: 2px !important;
  }
  body.approval-printing .qr-formno {
    font-size: 9px !important;
  }
  body.approval-printing .qr-paper-head {
    padding-right: 120px !important;
  }
  body.approval-printing .qr-band {
    font-size: 10px !important;
  }
  /* 只要横排正常断行,不要一字一行 */
  body.approval-printing .qr-grid td.c-mtd,
  body.approval-printing .qr-grid td.c-req {
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: anywhere !important;
    writing-mode: horizontal-tb !important;
  }
  body.approval-printing .qr-grid td.c-mtd .qr-cell-wrap,
  body.approval-printing .qr-grid td.c-req .qr-cell-wrap,
  body.approval-printing .qr-grid td.c-mtd .el-textarea__inner,
  body.approval-printing .qr-grid td.c-req .el-textarea__inner {
    writing-mode: horizontal-tb !important;
    white-space: pre-wrap !important;
    word-break: normal !important;
    overflow-wrap: anywhere !important;
    width: 100% !important;
  }
  /* 录入框在纸上要像"印好的格子":去边框/底色,文字同正文 */
  body.approval-printing .qr-sheet .el-input__inner,
  body.approval-printing .qr-sheet .el-textarea__inner {
    font-size: 9px !important;
    height: auto !important;
    line-height: 1.25 !important;
  }
  body.approval-printing .qr-sheet .el-input__wrapper,
  body.approval-printing .qr-sheet .el-textarea__inner {
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 !important;
  }
  /* 明细下拉(结果判断 合格/不合格):纸上只印选中的值,不印下拉箭头/边框 */
  body.approval-printing .qr-sheet .el-select__wrapper {
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 !important;
    min-height: 0 !important;
  }
  body.approval-printing .qr-sheet .el-select__caret,
  body.approval-printing .qr-sheet .el-select__suffix {
    display: none !important;
  }
  /* 占位提示词「请选择」不该印在纸上(EP 2.14:空值时 .el-select__placeholder.is-transparent);
     选中值那个 placeholder **没有** is-transparent,只藏占位、别把真值一起藏了 */
  body.approval-printing .qr-sheet .el-select__placeholder.is-transparent {
    visibility: hidden !important;
  }
  body.approval-printing .qr-sheet .el-select__selected-item,
  body.approval-printing .qr-sheet .el-select__placeholder {
    font-size: 9px !important;
    line-height: 1.25 !important;
  }
  /* 编辑态才有的东西(新增项/添加批次/删批次/删除列)不进纸 */
  body.approval-printing .qr-sheet .no-print,
  body.approval-printing .qr-sheet .c-op {
    display: none !important;
  }
  @page {
    size: A4 portrait;
    margin: 8mm;
  }
}


</style>
