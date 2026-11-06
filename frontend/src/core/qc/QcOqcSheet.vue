<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       出厂检验报告(QC_OQC_REPORT)—— 纸张式受控记录表

       版式一比一照受控表单 **c-95-12 / YJ-QR-05/A1**(原件两页图与逐格结构:
       tools/archive/_oqc-form-20261101/form-1.png / form-2.png / docx_dump.txt):
         纸头   : AGPLUS logo + 公司名 + 通栏横线
         标题   : 「出厂检验报告」居中,右侧「编制日期:<单据日期>」
         抬头   : 客户名|报告编号 / 产品名称|产品规格 / 生产日期|生产量 / 检测日期|AQL
                  / 产品编码(整行) —— 4 列网格
         主表   : 7 列 = 序号|检验项目|检验要求|抽样标准|抽检量|结果|判定
                  行 = head.detail.items(出厂检验报告由销售出库生成时按出货检验计划铺满)
         表尾   : 检验结论 / 备注(都在**同一张主表**里,label 跨前 2 列、值跨后 5 列 ⇒ 列宽天然对齐)
         卫生安全: 按《生活饮用水输配水设备及防护材料卫生安全评价规范》的 15 行静态表
                  (结果列统一印「见型式检验报告」,只读)
         签署   : 检验员(编制) / 审核(一级审批人) / 批准(超级管理员) + 表单编号 YJ-QR-05/A1

       ⚠ 用户口径(2026-11-01 07:28):「我是说当前的出厂检验报告实现当前和首件检验单相同的
         形式」—— 即本面板和 QC_FIRST_INSP 一样:整页 A4 纸居中、左侧单据选择栏、右侧按钮竖栏,
         纸上直接填;不再是「表头字段 + 17 列明细表格」的数据页。
         服务端 Jasper 版式(reports/qc_oqc.jrxml)**保留不动**,只用于「导出报表 → PDF/Excel」
         与「导出」弹窗(PanelxList 对 QC_OQC_REPORT 的 PDF/Excel 一律改走服务端报表)。

       ⚠ 用户口径(2026-11-04):「去除红框内页脚内容」—— 页脚(地址/网址/邮箱/电话)整块删除;
         签署三格按两级审批落值:检验员=编制(提交审批时后端自动写提交人、只读)、
         审核=一级审批人(head['审核人'])、批准=超级管理员(head['审批人'],二级审批通过才落值)。

       ⚠ 用户口径(2026-11-06):「产品编码无法填写;除去下拉框/日期控件与审批处外都能填写」——
         · 抬头「产品编码」由硬编码只读 span 改为**草稿态可填**(canEdit('产品编码'));
         · 报告编号(单据编号)保持只读(系统发号;元数据 editable=0 ⇒ readonly:true 自动生效);
         · 检验员/审核/批准 属审批区,恒只读;其余抬头 9 格 / 主表 7 列(序号除外)/
           检验结论 / 备注 / 卫生安全 15 行结果格,草稿态全部可填。
         · isLocked 修成同时认 `readonly:true`(后端 yj_field.editable=0 的下发口径),否则
           "该只读的能改、该能填的看着像只读"两种毛病同时存在。

       ⚠ 写法照 QcFirstInspSheet.vue:defineProps({ head, fields, editable }) +
         defineEmits(['dirty'])、明细行取 props.head.detail.items、v-model 直绑 +
         @input=emit('dirty')。明细行可能是 markRaw(非响应式)⇒ 改值后 bump++ 强制重渲。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="oqc-sheet" :class="{ 'is-editing': editable }">
    <!-- ① 纸头:logo + 公司名 + 通栏横线
         ⚠ logo 图(backend reports/logo_agplus.jpg)本身已含「AGPLUS 银嘉 / The Power For Better Water」,
           所以这里只补英文主体名 + 中文公司名,不要再重复那句 slogan(否则纸上出现两遍)。 -->
    <div class="oqc-letterhead">
      <img class="oqc-logo" :src="logoUrl" alt="AGPLUS" />
      <div class="oqc-brand">
        <div class="oqc-brand-en">AGplus Technologies Pte Ltd.</div>
        <div class="oqc-brand-cn">{{ tt('惠州市银嘉环保科技有限公司') }}</div>
      </div>
    </div>
    <div class="oqc-rule"></div>

    <!-- ② 大标题 + 编制日期(原件:标题居中,「编制日期」在标题右下角) -->
    <div class="oqc-title">{{ tt('出厂检验报告') }}</div>
    <div class="oqc-made">{{ tt('编制日期') }}：{{ head['单据日期'] || '' }}</div>

    <!-- ③ 抬头 9 格:4 列网格(标签|值 成对) + 产品编码整行
         列宽取原件 twips(694+1182 / 1008+2202 / 1125+884 / 3411+663 = 16.79% / 28.74% / 17.98% / 36.49%),
         与主表的 7 列**同源** ⇒ 上下两张表的外框与中间列线对得上。
         可编辑(草稿态):客户名称/产品名称/规格型号/生产日期/生产数量/检测日期/AQL/**产品编码**;
         单据编号(报告编号)恒只读(编号由系统发号;字段元数据 editable=0 下发 readonly:true),
         审核/批准两格在签署行恒只读(审批流落值)。 -->
    <table class="oqc-head">
      <colgroup>
        <col style="width: 16.79%" />
        <col style="width: 28.74%" />
        <col style="width: 17.98%" />
        <col style="width: 36.49%" />
      </colgroup>
      <tbody>
        <tr v-for="(pair, ri) in HEAD_ROWS" :key="'h' + ri">
          <template v-for="cell in pair" :key="cell.key">
            <th>{{ tt(cell.label) }}</th>
            <td>
              <el-date-picker
                v-if="canEditCell(cell) && cell.type === 'date'"
                v-model="head[cell.key]"
                type="date"
                size="small"
                value-format="YYYY-MM-DD"
                class="oqc-cell"
                :placeholder="tt('选择日期')"
                @change="emit('dirty')"
              />
              <el-input-number
                v-else-if="canEditCell(cell) && cell.type === 'number'"
                v-model="head[cell.key]"
                size="small"
                :controls="false"
                :min="0"
                class="oqc-cell oqc-cell-num"
                @change="emit('dirty')"
              />
              <el-input
                v-else-if="canEditCell(cell)"
                v-model="head[cell.key]"
                size="small"
                class="oqc-cell"
                maxlength="100"
                @input="emit('dirty')"
              />
              <span v-else class="oqc-ro">{{ head[cell.key] ?? '' }}</span>
            </td>
          </template>
        </tr>
        <!-- 产品编码整行:2026-11-06 用户报障「产品编码无法填写」——
             原实现是硬编码只读 span(注释说"由销售出库行带入"),但用户口径要求草稿态可填;
             现在按字段元数据 canEdit('产品编码') 渲染输入框(yj_field.editable=1),只读态仍显文本。
             ⚠ 这一格**不是**审批/发号格,别再写死成只读。 -->
        <tr>
          <th>{{ tt('产品编码') }}</th>
          <td colspan="3">
            <el-input
              v-if="canEdit('产品编码')"
              v-model="head['产品编码']"
              size="small"
              class="oqc-cell"
              maxlength="100"
              @input="emit('dirty')"
            />
            <span v-else class="oqc-ro">{{ head['产品编码'] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ④ 主表:7 列 = 序号|检验项目|检验要求|抽样标准|抽检量|结果|判定
         列宽取原件 twips(694/1182/3210/1125/884/3411/663 = 6.21% / 10.58% / 28.74% /
         10.07% / 7.91% / 30.54% / 5.94%),百分比口径 ⇒ 打印纸宽变化时比例不变、不会裁切。
         行 = head.detail.items;序号只读,其余六列草稿态可填(多行文本用 textarea 自适应高度,
         长文本换行、行高随内容长、整行天然等高、边框连续)。
         检验结论/备注也用**同一张表**的 colspan 行(label 跨前 2 列 = 序号+检验项目,
         值跨后 5 列)⇒ 与主表列线严格对齐,不用第二张表去凑宽度。 -->
    <table class="oqc-grid">
      <colgroup>
        <col v-for="c in COLUMNS" :key="c.key" :style="{ width: c.width }" />
      </colgroup>
      <thead>
        <tr>
          <th v-for="c in COLUMNS" :key="c.key">{{ tt(c.label) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in items" :key="row.id ?? row['行号'] ?? i">
          <td
            v-for="c in COLUMNS"
            :key="c.key"
            :style="{ textAlign: c.align, verticalAlign: c.top ? 'top' : 'middle' }"
          >
            <!-- 序号:只读(数据里就带序号;老数据没有就按行序兜底) -->
            <template v-if="c.readonly">{{ row[c.key] ?? i + 1 }}</template>
            <el-input
              v-else-if="editable"
              :model-value="row[c.key] ?? ''"
              :type="c.multiline ? 'textarea' : 'text'"
              :autosize="c.multiline ? { minRows: 1 } : undefined"
              size="small"
              class="oqc-cell"
              @update:model-value="(v) => setCell(row, c.key, v)"
            />
            <span v-else class="oqc-ro">{{ row[c.key] ?? '' }}</span>
          </td>
        </tr>
        <!-- 一条明细都没有(新建的空草稿):可编辑态给出下一步提示,只读态只说没有 ——
             只读单上不该出现"去点生成"这种操作指引(那时按钮根本不可用) -->
        <tr v-if="!items.length">
          <td colspan="7" class="oqc-empty">
            {{ editable
              ? tt('暂无检验项目（可在销售出库单点「生成出厂检验报告」按出货检验计划带入）')
              : tt('暂无检验项目') }}
          </td>
        </tr>
        <!-- 检验结论(label 跨 2 列 + 值跨 5 列;原件居中对齐) -->
        <tr class="oqc-sum-row">
          <th colspan="2">{{ tt('检验结论') }}</th>
          <td colspan="5" class="oqc-center">
            <el-input
              v-if="editable"
              :model-value="head['检验结论'] ?? ''"
              size="small"
              class="oqc-cell"
              maxlength="200"
              @update:model-value="(v) => setHead('检验结论', v)"
            />
            <span v-else class="oqc-ro">{{ head['检验结论'] || '' }}</span>
          </td>
        </tr>
        <!-- 备注(同构;多行自动撑高) -->
        <tr class="oqc-remark-row">
          <th colspan="2">{{ tt('备注') }}</th>
          <td colspan="5" class="oqc-left">
            <el-input
              v-if="editable"
              :model-value="head['备注'] ?? ''"
              type="textarea"
              :autosize="{ minRows: 2 }"
              size="small"
              class="oqc-cell"
              @update:model-value="(v) => setHead('备注', v)"
            />
            <span v-else class="oqc-ro">{{ head['备注'] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ⑤ 卫生安全块 + 签署(整体不拆页:打印时给 .oqc-tail 加 break-inside:avoid) -->
    <div class="oqc-tail">
      <div class="oqc-hygiene">
        <div class="oqc-hygiene-title">{{ tt('按《生活饮用水输配水设备及防护材料卫生安全评价规范》') }}</div>
        <table class="oqc-hygiene-table">
          <colgroup>
            <col style="width: 26.13%" />
            <col style="width: 52.14%" />
            <col style="width: 21.73%" />
          </colgroup>
          <thead>
            <tr>
              <th>{{ tt('项目') }}</th>
              <th>{{ tt('卫生要求') }}</th>
              <th>{{ tt('结果') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in HYGIENE_ROWS" :key="h.key">
              <td class="oqc-center">{{ tt(h.item) }}</td>
              <td class="oqc-center">{{ tt(h.requirement) }}</td>
              <!-- 结果列(2026-11-01 用户口径「这些红框内容要能填写」):草稿态可填,落 qc_oqc_head.卫生_<项目>;
                   只读态显示已填值。空 = 未录 = **格内空白**(2026-11-01 09:24 用户口径「空白的就可以」:
                   不再显示「填写」占位文字,和纸质表单一样留空白格) -->
              <td class="oqc-center">
                <el-input
                  v-if="canEdit(h.key)"
                  :model-value="head[h.key] ?? ''"
                  size="small"
                  class="oqc-cell oqc-hygiene-input"
                  maxlength="50"
                  @update:model-value="(v) => setHead(h.key, v)"
                />
                <span v-else class="oqc-ro">{{ head[h.key] || '' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ⑥ 签署行(2026-11-04 用户口径:检验员=编制 / 审核=一级审批人 / 批准=超级管理员):
            检验员 : **编制格**。canEdit 分支保留(与其它纸张同构),但 yj_field 已由后端迁移
                     (tools/migrate-oqc-twolevel-20261104.sql)置 editable=0 ⇒ 实际只读;
                     值由后端「提交审批」那一刻自动写提交人,纸面不接收手改。
            审核   : 一级审批通过的人(head['审核人'],后端按审批状态下发,只读)。
            批准   : 超级管理员(head['审批人'],二级审批通过才落值,不再是空线)。
            右下角是受控表单编号。 -->
      <div class="oqc-sign">
        <div class="oqc-sign-row">
          <span class="oqc-sign-item">
            {{ tt('检验员') }}：
            <!-- 元数据 editable=0 ⇒ 实际只读;后端「提交审批」时写提交人(编制) -->
            <el-input
              v-if="canEdit('检验员')"
              v-model="head['检验员']"
              size="small"
              class="oqc-cell oqc-sign-input"
              maxlength="30"
              @input="emit('dirty')"
            />
            <span v-else class="oqc-sign-val">{{ head['检验员'] || '' }}</span>
          </span>
          <span class="oqc-sign-item">
            {{ tt('审 核') }}：<span class="oqc-sign-val">{{ head['审核人'] || '' }}</span>
          </span>
          <span class="oqc-sign-item">
            {{ tt('批 准') }}：<span class="oqc-sign-val">{{ head['审批人'] || '' }}</span>
          </span>
        </div>
        <div class="oqc-form-no">YJ-QR-05/A1</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { tt } from '@/i18n'
// 抬头商标:与后端服务端报表(reports/logo_agplus.jpg)同一张图,拷进 assets 由 vite 打包
import logoUrl from '@/assets/logo_agplus.jpg'

const props = defineProps({
  /** 当前单据(列表行:表头字段平铺 + detail.items 明细) */
  head: { type: Object, required: true },
  /** 该面板的表头字段元数据(yj_field 下发:用于判 locked/editable;与 QcFirstInspSheet 同口径) */
  fields: { type: Array, default: () => [] },
  /** 草稿态才可填;只读态(已审核/归档/无权限/标注模式)全部渲染成纯文本 */
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

/** 本地版本号:明细行可能被面板 markRaw(非响应式),改值后不会触发重渲染 ⇒ 自增它强制重算 */
const bump = ref(0)

const items = computed(() => {
  bump.value // ← 建立依赖:改值后强制重算并触发重渲染
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

/** 抬头 4 行 × 2 对(标签 → 数据键);AQL 不是中文,标签按原件原样 */
const HEAD_ROWS = [
  [{ key: '客户名称', label: '客户名' }, { key: '单据编号', label: '报告编号', readonly: true }],
  [{ key: '产品名称', label: '产品名称' }, { key: '规格型号', label: '产品规格' }],
  [{ key: '生产日期', label: '生产日期', type: 'date' }, { key: '生产数量', label: '生产量', type: 'number' }],
  [{ key: '检测日期', label: '检测日期', type: 'date' }, { key: 'AQL', label: 'AQL' }],
]

/**
 * 主表 7 列(列宽 = 原件 twips 占比)。
 * `multiline` 的列用 textarea + autosize(不设 maxRows ⇒ 长文本整段撑高,打印不截字);
 * 单行短字段(抽样标准/抽检量/判定)用 input。
 */
const COLUMNS = [
  { key: '序号', label: '序号', width: '6.21%', align: 'center', readonly: true },
  { key: '检验项目', label: '检验项目', width: '10.58%', align: 'center', multiline: true },
  { key: '检验要求', label: '检验要求', width: '28.74%', align: 'left', multiline: true, top: true },
  { key: '抽样标准', label: '抽样标准', width: '10.07%', align: 'center' },
  { key: '抽检量', label: '抽检量', width: '7.91%', align: 'center' },
  { key: '结果', label: '结果', width: '30.54%', align: 'center', multiline: true },
  { key: '判定', label: '判定', width: '5.94%', align: 'center' },
]

/**
 * 卫生安全 15 行(纸面内容固定;卫生要求文字照受控表单第二页)。
 * 结果列 = **手填**(2026-11-01 用户口径「这些红框内容要能填写」):每行一个头表字段
 * `卫生_<项目>`(qc_oqc_head 上 15 个可空文本列,yj_field 已登记、hidden=1 只作数据管道),
 * 草稿态渲染成输入框、只读态显示已填值;空 = 未录(留空,不再固定印「见型式检验报告」)。
 */
const HYGIENE_ROWS = [
  { key: '卫生_浑浊度', item: '浑浊度', requirement: '增加量≤0.2NTU' },
  { key: '卫生_臭和味', item: '臭和味', requirement: '浸泡后水无异臭、异味' },
  { key: '卫生_肉眼可见物', item: '肉眼可见物', requirement: '浸泡后水不产生任何肉眼可见的碎片杂物等' },
  { key: '卫生_PH', item: 'PH', requirement: '改变量≤0.5' },
  { key: '卫生_溶解性总固体', item: '溶解性总固体', requirement: '/' },
  { key: '卫生_耗氧量', item: '耗氧量（以O2计）', requirement: '增加量≤1 mg/L' },
  { key: '卫生_砷', item: '砷', requirement: '增加量≤0.001 mg/L' },
  { key: '卫生_铬', item: '铬', requirement: '增加量≤0.005 mg/L' },
  { key: '卫生_铝', item: '铝', requirement: '增加量≤0.02 mg/L' },
  { key: '卫生_铅', item: '铅', requirement: '增加量≤0.001 mg/L' },
  { key: '卫生_汞', item: '汞', requirement: '增加量≤0.0001 mg/L' },
  { key: '卫生_铁', item: '铁', requirement: '增加量≤0.06 mg/L' },
  { key: '卫生_锰', item: '锰', requirement: '增加量≤0.02 mg/L' },
  { key: '卫生_铜', item: '铜', requirement: '增加量≤0.2 mg/L' },
  { key: '卫生_锌', item: '锌', requirement: '增加量≤0.2 mg/L' },
]

/** 只读判定:该字段在 yj_field 里登记成不可编辑(未登记 ≠ 锁定,与其它纸张同口径)。
 *  ⚠ 2026-11-06:后端契约 —— yj_field.editable=0 在 dataSchema 里下发的是 **`readonly:true`**
 *    (PanelConfigService.fieldSpec:`if (!f.editable()) m.put("readonly", true)`),不是 editable:false;
 *    原实现只判 editable===false/0 ⇒ 恒 false(死代码),单据编号/检验员等"本该只读"的格子仍可改。
 *    现在同时认 readonly / editable 两种口径。 */
function isLocked(key) {
  const f = (props.fields || []).find((x) => (x.dataName || x.name || x.code) === key)
  return !!f && (f.readonly === true || f.editable === false || f.editable === 0)
}
function canEdit(key) {
  return props.editable && !isLocked(key)
}
/** 抬头格是否可填:字段元数据可编辑 **且** 该格不声明只读(报告编号=系统发号,恒只读;
 *  产品编码草稿态可填 —— 2026-11-06 用户报障「产品编码无法填写」)。 */
function canEditCell(cell) {
  return !cell?.readonly && canEdit(cell?.key)
}

/** 表头字段改动:直绑 + 置脏 */
function setHead(key, v) {
  props.head[key] = v
  emit('dirty')
}
/** 明细格改动:行对象可能是 markRaw ⇒ 写值后 bump++,否则界面不会跟着变 */
function setCell(row, key, v) {
  if (!row) return
  row[key] = String(v ?? '')
  bump.value++
  emit('dirty')
}
</script>

<style scoped>
/* ── 纸张本体:A4 竖向 96dpi ≈ 794px,内宽 794-2×24 ≈ 746px(= 原件表格 558pt ≈ 744.6px) ── */
.oqc-sheet {
  width: 794px;
  max-width: 100%;
  box-sizing: border-box;
  margin: 14px auto 24px;
  padding: 20px 24px 14px;
  background: #fff;
  border: 1px solid #b8b8b8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  color: #222;
  font-size: 13px;
  font-family: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif;
}
.oqc-sheet *,
.oqc-sheet *::before,
.oqc-sheet *::after {
  box-sizing: border-box;
}

/* ── 纸头 ── */
.oqc-letterhead {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}
.oqc-logo {
  width: 164px;
  height: 36px;
  object-fit: contain;
  flex: none;
}
.oqc-brand {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-bottom: 2px;
  min-width: 0;
}
.oqc-brand-en {
  font-size: 10.5px;
  color: #555;
  letter-spacing: 0.2px;
}
.oqc-brand-cn {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  letter-spacing: 1px;
}
.oqc-rule {
  height: 1.6px;
  background: #333;
  margin-top: 6px;
}

/* ── 标题 + 编制日期 ── */
.oqc-title {
  margin: 18px 0 2px;
  text-align: center;
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 27px;
  font-weight: 700;
  letter-spacing: 4px;
}
.oqc-made {
  text-align: right;
  font-size: 12.5px;
  margin: 0 2px 8px 0;
}

/* ── 三张表共用一套框线(与首件检验单同色 #8A8A8A) ── */
.oqc-head,
.oqc-grid,
.oqc-hygiene-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.oqc-head th,
.oqc-head td,
.oqc-grid th,
.oqc-grid td,
.oqc-hygiene-table th,
.oqc-hygiene-table td {
  border: 1px solid #8a8a8a;
  padding: 3px 5px;
  font-size: 13px;
  line-height: 1.35;
  word-break: break-word;
}
.oqc-head th,
.oqc-grid thead th,
.oqc-hygiene-table th,
.oqc-grid tbody th {
  font-weight: 600;
  text-align: center;
}
/* 抬头标签格与主表表头给极浅底色:屏幕上区分「标签/值」,打印仍按原件白纸出(见打印块) */
.oqc-head th {
  background: #f7f7f7;
}
.oqc-grid thead th,
.oqc-hygiene-table thead th {
  background: #f2f2f2;
}
/* 表头字号比表体小一号:英文(en)下窄列(检验项目 79px / 抽检量 59px / 判定 44px)放不下
   13px 的 Inspection/Sample 这类长词,会断成 "Inspectio n" —— 12px + 只在词边界换行即可;
   判定列最窄(44px),左右内边距再收到 2px,英文 "Judge" 才整词放得下(否则 "Judg e") */
.oqc-grid thead th {
  font-size: 12px;
  word-break: normal;
  overflow-wrap: break-word;
  padding-left: 2px;
  padding-right: 2px;
}
.oqc-head td {
  text-align: left;
}

/* ── 主表 ── */
.oqc-grid tbody td {
  min-height: 30px;
}
.oqc-grid tbody tr {
  height: 32px;
}
/* 检验结论/备注行:label 格与普通 td 一样居中 + 加粗 */
.oqc-grid .oqc-sum-row th,
.oqc-grid .oqc-remark-row th {
  background: #f7f7f7;
}
.oqc-center {
  text-align: center;
}
/* 卫生安全「结果」格(2026-11-01 可填写):输入框铺满格宽、居中;屏上 12px,打印收到 10px(见打印块) */
.oqc-hygiene-input {
  width: 100%;
}
.oqc-hygiene-input :deep(.el-input__inner) {
  text-align: center;
  font-size: 12px;
  height: 24px;
  line-height: 24px;
}
.oqc-left {
  text-align: left;
}
.oqc-ro {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.35;
}
.oqc-empty {
  height: 64px;
  color: #909399;
  text-align: center;
}

/* ── 卫生安全块 ── */
.oqc-hygiene {
  margin-top: 10px;
}
.oqc-hygiene-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  padding-left: 2px;
}
.oqc-hygiene-table td {
  height: 22px;
}

/* ── 签署行 ── */
.oqc-sign {
  margin: 14px 4px 0;
}
.oqc-sign-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  flex-wrap: wrap;
}
.oqc-sign-item {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  margin-right: 26px;
}
.oqc-sign-val {
  min-width: 72px;
  display: inline-block;
  text-align: center;
  /* 检验员(编制)/审核/批准三格都是「签在线上」:留空时也画一条线,纸上不会出现一个没有落笔处的空位 */
  border-bottom: 1px solid #666;
  padding: 0 6px;
  transform: translateY(-1px);
}
.oqc-sign-input {
  width: 110px;
}
.oqc-form-no {
  margin-top: 10px;
  text-align: right;
  font-size: 12.5px;
  color: #333;
  letter-spacing: 0.5px;
}

/* ── 格内直编:去边框、白纸观感(照 QcFirstInspSheet 的 .fi-cell 口径) ── */
.oqc-cell {
  width: 100%;
}
.oqc-cell :deep(.el-input__wrapper),
.oqc-cell :deep(.el-input__wrapper.is-focus),
.oqc-cell :deep(.el-input__wrapper:hover) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0 2px;
  min-height: 22px;
}
.oqc-cell :deep(.el-input__inner) {
  height: 22px;
  font-size: 13px;
  text-align: center;
}
/* 抬高/列对齐:检验要求与备注的控件文字左对齐(单元格 text-align 由列定义给) */
.oqc-cell :deep(.el-textarea__inner) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 1px 2px;
  min-height: 20px;
  font-size: 13px;
  line-height: 1.35;
  resize: none;
  text-align: inherit;
  font-family: inherit;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.oqc-cell :deep(.el-textarea__inner):hover {
  box-shadow: none !important;
}
/* 抬头格里的控件必须收在格子里(日期选择器自带 220px 默认宽,不收口会顶出格线) */
.oqc-head td .oqc-cell,
.oqc-head td :deep(.el-date-editor.el-input),
.oqc-head td :deep(.el-date-editor .el-input__wrapper),
.oqc-head td :deep(.el-input-number) {
  width: 100%;
  min-width: 0;
}
.oqc-head td :deep(.el-input-number .el-input__inner) {
  text-align: left;
}
/* 签署格的输入框:纸面观感 + 下划线 */
.oqc-sign-input :deep(.el-input__wrapper) {
  box-shadow: none !important;
  border-bottom: 1px solid #666;
  border-radius: 0;
  padding: 0 2px;
}
.oqc-sign-input :deep(.el-input__inner) {
  text-align: center;
}
/* 只读态的日期格/文本格:value 是纯文本,左对齐 */
.oqc-head td .oqc-ro {
  text-align: left;
}
</style>

<!-- 打印整张:只保留纸张(与首件检验单同一套白名单机制)
     ⚠ 2026-10-17 实测:公共打印样式(DocSheet.vue 的非 scoped 块)把
       `body.approval-printing .portal` 整体 visibility:hidden,再逐个 whitelist 纸张根类名;
       本纸的 `.oqc-sheet` **不在名单里** ⇒ 点「打印」出来是一张空白页。**这段必须写**。
     ⚠ 与首件检验单不同的是:这张纸是**连续两页**(主表 15 行 + 卫生安全块 + 签署),
       所以**不能用 position:absolute**(离屏定位的多页内容在打印分页时会被裁/叠),
       改为静态流式 + 把上溯各级容器 display:block/overflow:visible/padding:0,
       由浏览器按 A4 自然分页;行级 break-inside:avoid 保证一行不被劈两半,
       表尾整块(.oqc-tail)不拆页。 -->
<style>
@media print {
  /* ⚠ index.html 给 html 预置了底色(`html { background:#f0f2f3 }`,防加载闪白)——
     打印时不清掉,纸面内容结束后剩下的整块「页面余量」会被刷成灰底(实测第 2 页下半页)。
     打印一律白纸。 */
  html,
  body,
  body.approval-printing {
    background: #fff !important;
  }
  body.approval-printing {
    margin: 0 !important;
  }
  body.approval-printing .portal {
    visibility: hidden;
    display: block !important;
    height: auto !important;
    padding: 0 !important;
  }
  body.approval-printing .topbar,
  body.approval-printing .leftnav,
  body.approval-printing .func-zone,
  body.approval-printing .tabsbar,
  body.approval-printing .help-panel,
  body.approval-printing .nav-mask,
  body.approval-printing .approval-side,
  body.approval-printing .doc-select-rail,
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
    min-height: 0 !important;
    overflow: visible !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  body.approval-printing .oqc-sheet {
    visibility: visible !important;
    position: static !important;
    top: auto !important;
    left: auto !important;
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    color: #000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .oqc-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  /* 纸张收字号:10px 表体,行高按内容自适应(不写 height,否则长行会被截) */
  body.approval-printing .oqc-head th,
  body.approval-printing .oqc-head td,
  body.approval-printing .oqc-grid th,
  body.approval-printing .oqc-grid td,
  body.approval-printing .oqc-hygiene-table th,
  body.approval-printing .oqc-hygiene-table td {
    font-size: 10px !important;
    padding: 1px 3px !important;
    height: auto !important;
    line-height: 1.3 !important;
  }
  body.approval-printing .oqc-grid tbody tr {
    height: auto !important;
  }
  /* 卫生安全「结果」输入框(2026-11-01 可填写):打印时与表体同字号、去掉控件高度/内边距,
     否则 24px 高的 el-input 会把这一列撑得比纸面其它格高一截;输入框里的值照常打印 */
  body.approval-printing .oqc-hygiene-table .el-input__inner {
    font-size: 10px !important;
    height: auto !important;
    min-height: 0 !important;
    line-height: 1.3 !important;
    padding: 0 !important;
    text-align: center !important;
  }
  body.approval-printing .oqc-hygiene-input .el-input__wrapper {
    box-shadow: none !important;
    padding: 0 !important;
    background: transparent !important;
  }
  body.approval-printing .oqc-title {
    font-size: 20px !important;
    letter-spacing: 3px !important;
    margin: 8px 0 2px !important;
  }
  body.approval-printing .oqc-logo {
    width: 132px !important;
    height: 29px !important;
  }
  body.approval-printing .oqc-brand-en,
  body.approval-printing .oqc-brand-cn,
  body.approval-printing .oqc-made,
  body.approval-printing .oqc-hygiene-title,
  body.approval-printing .oqc-sign-row,
  body.approval-printing .oqc-form-no {
    font-size: 9.5px !important;
  }
  /* 屏幕上的浅底色在纸上淡到几乎看不见:原件本来就是白纸,打印统一白底(更接近受控表单) */
  body.approval-printing .oqc-head th,
  body.approval-printing .oqc-grid thead th,
  body.approval-printing .oqc-grid tbody th,
  body.approval-printing .oqc-hygiene-table thead th {
    background: #f3f3f3 !important;
  }
  /* 行不拆页:明细一行、卫生安全一行都整行落到下一页(浏览器自然分页) */
  body.approval-printing .oqc-grid tr,
  body.approval-printing .oqc-hygiene-table tr {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  /* 表尾(卫生安全 + 签署)整块不拆页 */
  body.approval-printing .oqc-tail {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  /* 输入控件里的占位词不该印在纸上 */
  body.approval-printing .oqc-sheet input::placeholder,
  body.approval-printing .oqc-sheet textarea::placeholder {
    color: transparent !important;
  }
  /* 日期选择器的日历图标/数字加减控件不是纸面内容(Element Plus 的日期图标挂在 prefix 上) */
  body.approval-printing .oqc-sheet .el-input__suffix,
  body.approval-printing .oqc-sheet .el-input__prefix,
  body.approval-printing .oqc-sheet .el-input-number__decrease,
  body.approval-printing .oqc-sheet .el-input-number__increase {
    display: none !important;
  }
  /* 弹窗(append-to-body,不在 .portal 里)**不跟着 .portal 一起隐藏** ⇒ 开着弹窗按打印会把它印上去 */
  body.approval-printing .el-overlay,
  body.approval-printing .el-message-box__wrapper,
  body.approval-printing .el-message,
  body.approval-printing .el-picker__popper {
    display: none !important;
  }
  @page {
    size: A4 portrait;
    margin: 8mm;
  }
}
</style>
