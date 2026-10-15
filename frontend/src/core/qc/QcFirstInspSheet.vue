<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       首件检验单(QC_FIRST_INSP)—— 纸张式记录表 · **样品 × 测试项目矩阵**

       版式一比一照《炭棒成型车间首件检验记录表》(用户 2026-10-15 给的图片):
         报告头   : 表单管理人 / 密级 / 使用范围(右上三格,头字段)
         大标题   : 炭棒成型车间首件检验记录表
         抬头行   : 产品编号 | 产品型号 | 生产日期 | 组别(单据级,四对)
         两级表头 : 第一级 = 分组(表观及脱粉 / 尺寸及重量 / 强度 / 浊度及压降)
                    第二级 = 测试项目(炭棒表观状态 / 炭棒外径mm / … )
                    左上角斜线格 = 「测试项目 ╲ 样品序号」
         标准行   : 每个测试项目该填的标准(来自《成型工艺清单》RD_MOLD_PROC)
         数据区   : 1#..8# 八个样品,一格 = 该样品的该测试项目实测值
         相关要求 : 图片底部那 6 条(第 3/4/6 条按业务文案原样带出)
         表尾     : 检验结果 | 检验人

       ⚠ 用户口径(2026-10-15 第二轮):「测试项目需要可新增,也就是新增列即可」
         ⇒ 每个测试项目 = **一列**(列模型纯函数在 core/qc/firstInspCols.js,有单测);
           加列 = 写 1 行「标准」+ 8 行「样品」的长表行,表结构一分不动。
           列头可改名/删列/改分组/改标准;减列会先确认(填过数据的列提示会一起清掉)。

       ⚠ 表观及脱粉那两列**不是数字格**(图片里是"无粘模/轻微粘模/严重粘模"这种勾选),
         这里按可勾的选项渲染;其余列是文本录入格(图片里那些 "/" 是"本格无需填写"的占位)。
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="fi-sheet">
    <!-- ① 报告头右上信息三格(表单管理人/密级/使用范围)
         ⚠ 2026-10-16 用户口径(截图红框)「当前上面这一部分均不能填写需要实现变为可填写的实现」:
           原实现是纯文本 `<span>{{ head[...] }}</span>`,而这 4 个抬头字段当时**库里根本没有**
           (既非头表列、也无 yj_field 登记)⇒ 永远空白且无处可填。现已在 migrate-first-insp.sql
           第 J 段补上列 + yj_field 登记,这里按可填格子渲染(草稿态可填、只读态显示文本)。 -->
    <div class="fi-topbar">
      <table class="fi-info"><tbody>
        <tr v-for="f in INFO_FIELDS" :key="f.key">
          <th>{{ tt(f.label) }}</th>
          <td>
            <el-select
              v-if="editable && !isLocked(f.key) && f.options"
              v-model="head[f.key]"
              size="small"
              clearable
              class="fi-cell"
              :placeholder="tt('请选择')"
              @change="emit('dirty')"
            >
              <el-option v-for="o in f.options" :key="o" :label="tt(o)" :value="o" />
            </el-select>
            <el-input
              v-else-if="editable && !isLocked(f.key)"
              v-model="head[f.key]"
              size="small"
              class="fi-cell"
              maxlength="50"
              @input="emit('dirty')"
            />
            <span v-else>{{ head[f.key] || '' }}</span>
          </td>
        </tr>
      </tbody></table>
    </div>

    <!-- ② 大标题 -->
    <div class="fi-titlerow"><div class="fi-title">{{ tt('炭棒成型车间首件检验记录表') }}</div></div>

    <!-- ③ 抬头四对:全部可填(产品编号/产品型号 支持参照或手填;生产日期用日期选择;组别取生产线) -->
    <table class="fi-head"><tbody><tr>
      <template v-for="f in HEAD_FIELDS" :key="f.key">
        <th>{{ tt(f.label) }}</th>
        <td>
          <el-date-picker
            v-if="editable && !isLocked(f.key) && f.date"
            v-model="head[f.key]"
            type="date"
            size="small"
            value-format="YYYY-MM-DD"
            class="fi-cell"
            :placeholder="tt('选择日期')"
            @change="emit('dirty')"
          />
          <el-input
            v-else-if="editable && !isLocked(f.key)"
            v-model="head[f.key]"
            size="small"
            class="fi-cell"
            maxlength="200"
            @input="emit('dirty')"
          />
          <span v-else>{{ headText(f) }}</span>
        </td>
      </template>
    </tr></tbody></table>

    <!-- ④ 两级表头 + 标准行 + 1#..8# 数据区 -->
    <table class="fi-grid">
      <colgroup>
        <col style="width: 96px" />
        <col v-for="c in columns" :key="c.key" />
        <col v-if="editable" style="width: 40px" />
      </colgroup>
      <thead>
        <tr>
          <!-- 左上角斜线格:测试项目 ╲ 样品序号 -->
          <th rowspan="2" class="corner">
            <span class="corner-a">{{ tt('测试项目') }}</span>
            <span class="corner-b">{{ tt('样品序号') }}</span>
          </th>
          <th v-for="g in groups" :key="'g-' + g" :colspan="groupCols(g).length" class="group">{{ tt(g) }}</th>
          <th v-if="editable" rowspan="2" class="col-op no-print">
            <span class="fi-addcol" :title="tt('新增一个测试项目（即新增一列）')" @click="addTestItem()">＋</span>
          </th>
        </tr>
        <tr>
          <template v-for="g in groups" :key="'h-' + g">
            <th v-for="c in groupCols(g)" :key="c.key" class="col-head">
              <template v-if="editable">
                <el-input
                  :model-value="c.label"
                  size="small"
                  class="fi-colname"
                  :title="tt('点这里改测试项目名')"
                  @update:model-value="v => renameColumn(c, v)"
                />
                <!-- 分组可选(图片上四个分组是固定的;新增的列默认落最后一组,要挪就点这里) -->
                <el-select
                  :model-value="c.group"
                  size="small"
                  class="fi-colgroup"
                  :title="tt('这一列归到哪个分组')"
                  @update:model-value="v => setColumnGroup(c, v)"
                >
                  <el-option v-for="g2 in GROUP_ORDER" :key="g2" :label="tt(g2)" :value="g2" />
                </el-select>
                <span class="fi-coldel no-print" :title="tt('删除本列')" @click="removeCol(c)">×</span>
              </template>
              <template v-else>{{ c.label }}<small v-if="c.unit">({{ c.unit }})</small></template>
            </th>
          </template>
        </tr>
      </thead>
      <tbody>
        <!-- 标准行:来自《成型工艺清单》;可改(工艺清单没维护时品质自己补) -->
        <tr class="standard-row">
          <th class="rowlabel">{{ tt('标准') }}</th>
          <td v-for="c in columns" :key="c.key">
            <el-input
              v-if="editable"
              :model-value="c.standard"
              size="small"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 6 }"
              class="fi-cell"
              @update:model-value="v => setStandard(c, v)"
            />
            <span v-else class="fi-stdtext">{{ c.standard || '/' }}</span>
          </td>
          <td v-if="editable" class="col-op no-print"></td>
        </tr>
        <!-- 数据区:1#..8# -->
        <tr v-for="sample in samples" :key="sample" class="sample-row">
          <th class="rowlabel">{{ sample }}#</th>
          <td v-for="c in columns" :key="c.key" :class="{ 'is-check': isCheckCol(c) }">
            <!-- 表观及脱粉:勾选式(无粘模/轻微粘模/严重粘模 …)。
                 ⚠ 按图片:这两列只给 1#、2# 勾选项(相关要求第 1 条「表观及脱粉项目测试后记录2支样品数据」),
                   3#..8# 打 `/`；isCheckCol 只管格子底色,要不要给选项另判 sample <= CHECK_SAMPLES。 -->
            <template v-if="isCheckCol(c)">
              <div v-if="editable && sample <= CHECK_SAMPLES" class="fi-checks">
                <span v-for="o in checkOptions(c)" :key="o" class="fi-check">
                  <span
                    class="fi-box"
                    :class="{ on: isChecked(sample, c, o) }"
                    @click="toggleCheck(sample, c, o)"
                  >{{ isChecked(sample, c, o) ? '☑' : '□' }}</span>
                  <span class="fi-check-txt" @click="toggleCheck(sample, c, o)">{{ tt(o) }}</span>
                </span>
              </div>
              <span v-else class="fi-checktext">{{ cellText(sample, c) || '/' }}</span>
            </template>
            <!-- 其余列:文本录入格 -->
            <template v-else>
              <el-input
                v-if="editable"
                :model-value="cellText(sample, c)"
                size="small"
                class="fi-cell"
                @update:model-value="v => setMeasured(sample, c, v)"
              />
              <span v-else>{{ cellText(sample, c) || '/' }}</span>
            </template>
          </td>
          <td v-if="editable" class="col-op no-print"></td>
        </tr>
        <!-- 一列都没有:提示怎么开始 -->
        <tr v-if="!columns.length">
          <td :colspan="1 + (editable ? 1 : 0)" class="fi-empty">
            {{ editable
              ? tt('暂无测试项目，点表头右上角「＋」新增一列；也可以用工具栏「取成型工艺清单」按产品带入')
              : tt('暂无测试项目') }}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ⑤ 相关要求(图片底部 6 条) -->
    <div class="fi-requirements">
      <b>{{ tt('相关要求') }}：</b>
      <ol>
        <li>{{ tt('表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，炭棒强度测试2支样品，浊度及压降测试记录2支样品。') }}</li>
        <li>{{ tt('鉴于胚棒为初步测量确认，测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；挤压强度及压降按表显数据记录。') }}</li>
        <li>{{ tt('检测标准依据炭棒工艺配方管控清单（如产品同时有要求浊度和压降两项测试，可先测试初始浊度后再进行压降测试）。') }}</li>
        <li>{{ tt('炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。') }}</li>
        <li>{{ tt('测试样品需保留至本班次生产完成。') }}</li>
        <li>{{ tt('C-95客户相关产品脱模后立马进行首件检验。') }}</li>
      </ol>
    </div>

    <!-- ⑥ 表尾:检验结果 | 检验人 -->
    <table class="fi-foot"><tbody><tr>
      <th>{{ tt('检验结果') }}</th>
      <td>
        <el-input v-if="editable" v-model="head['总结论']" size="small" class="fi-cell" @input="emit('dirty')" />
        <span v-else>{{ head['总结论'] || '' }}</span>
      </td>
      <th>{{ tt('检验人') }}</th>
      <td>{{ head['检验员'] || '' }}</td>
    </tr></tbody></table>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tt } from '@/i18n'
import {
  columnsOf, groupsOf, addColumn, removeColumn, updateColumn,
  columnHasContent, ensureItems, ROW_STANDARD, ROW_SAMPLE, GROUP_ORDER,
  seedDefaultColumns,
} from './firstInspCols.js'

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty'])

/** 本地版本号:明细数组/行可能被面板 markRaw 处理(非响应式),push/splice 后不会触发重渲染 */
const bump = ref(0)

const items = computed(() => {
  bump.value // ← 建立依赖:变更后强制重算并触发重渲染
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})

/**
 * 新建草稿的**兜底铺列**:图片上的 10 个测试项目一打开就在(用户口径「把这些先填充进去就可以了,
 * 不需要空着什么都没有」)。只在"可编辑 + 明细一行都没有"时动手,铺完标脏让用户保存。
 * ⚠ 后端报工自动出单/点「取成型工艺清单」时**已经**按工艺清单铺过(那时能带出标准),这里是
 *   "还没选产品 / 产品还没有工艺清单"那一刻的兜底 —— 已有列就一行不动(seedDefaultColumns 幂等)。
 */
watch(
  () => [props.editable, props.head?.['单据编号'], items.value.length],
  () => {
    if (!props.editable || items.value.length) return
    const n = seedDefaultColumns(props.head)
    if (n) { bump.value++; emit('dirty') }
  },
  { immediate: true },
)
const columns = computed(() => {
  bump.value
  // ⚠ 必须**按分组排好**再渲染:表头第一级是分组(colspan = 本组列数),表体一格一列。
  //   若表体按"录入先后"平铺、表头按"分组先后"归并,两行的列就对不上 —— 截图实测抓到的就是这个:
  //   第二列的分组名没处长(并在第一组里)、表体的格子整体右移一格。
  //   ⇒ 列序 = groupsOf 的组序 × 组内列序,表头与表体共用这一个数组。
  const cols = columnsOf(items.value)
  return groupsOf(cols).flatMap((g) => cols.filter((c) => c.group === g))
})
const groups = computed(() => groupsOf(columns.value))
const groupCols = (g) => columns.value.filter((c) => c.group === g)
const samples = [1, 2, 3, 4, 5, 6, 7, 8]
/**
 * 表观/脱粉这两列**只给前 2 个样品勾选项** —— 图片里 3#..8# 的这两格是 `/`,
 * 依据是纸面"相关要求"第 1 条「表观及脱粉项目测试后记录2支样品数据」。
 * 其余列(尺寸/重量/强度/浊度/压降)八个样品都录(第 1 条同样说了要录 2 支,但图片上它们 8# 都给了录入格)。
 */
const CHECK_SAMPLES = 2

/**
 * 纸张右上信息三格(图片上那三行)。数据键 = yj_field 的 col_name(与后端列同名)。
 * 密级/使用范围 给下拉候选(与成型工艺清单 RD_MOLD_PROC 同一套口径,见 migrate-first-insp.sql 第 J 段)。
 */
const INFO_FIELDS = [
  { key: '表单管理人', label: '表单管理人' },
  { key: '密级', label: '密级', options: ['保密', '内部', '公开'] },
  { key: '使用范围', label: '使用范围', options: ['炭棒成型车间', '工艺科/成型车间', '工程技术中心', '银嘉内部', '公司内'] },
]

/**
 * 抬头四对(图片上那一行)。**纸面标签 → 数据键**的映射:
 *   产品编号 → 产品编码(报工带出的产品编号就是它)
 *   产品型号 → 规格型号(报工带出的规格;没有再退回产品名称,纸面不空)
 *   生产日期 → 生产日期(第 J 段新加的独立字段;空则回落到检验日期/单据日期,见 headDates)
 *   组别     → 生产线(纸面「组别」= 产线/车间口径)
 */
const HEAD_FIELDS = [
  { key: '产品编码', label: '产品编号' },
  { key: '规格型号', label: '产品型号' },
  { key: '生产日期', label: '生产日期', date: true },
  { key: '生产线', label: '组别' },
]

/** 只读判定:该字段在 yj_field 里登记成不可编辑(未登记 ≠ 锁定,与其它纸张同口径) */
function isLocked(key) {
  const f = (props.fields || []).find((x) => (x.dataName || x.name || x.code) === key)
  return !!f && (f.editable === false || f.editable === 0)
}

/**
 * 只读态取值:生产日期这一格给**回落链** —— 老单据(第 J 段加字段之前生成的)没这个值,
 * 直接显示会空白(图片上这里是有日期的);按 生产日期 → 检验日期 → 单据日期 依次回落。
 * 可填态不用它(v-model 直绑真实字段,填什么存什么)。
 */
function headText(f) {
  if (f.key === '生产日期') return head['生产日期'] || head['检验日期'] || head['单据日期'] || ''
  if (f.key === '规格型号') return head['规格型号'] || head['产品名称'] || ''
  return head[f.key] || ''
}

/** 这一列的「定义行」(标准行)与某样品的行 —— 行不存在时按需补出来(老单据/手填列) */
function rowOf(sample, col) {
  const want = sample === null ? ROW_STANDARD : ROW_SAMPLE
  const found = items.value.find((r) => String(r['行类型']) === want
    && String(r['检验列'] || r['检验项目'] || '') === col.key
    && (sample === null || String(r['样品序号']) === `${sample}#`))
  if (found) return found
  const arr = ensureItems(props.head)
  const next = {
    表区: '首件检验',
    行类型: want,
    样品序号: sample === null ? '标准' : `${sample}#`,
    检验列: col.key,
    检验项目: col.label,
    项目分组: col.group,
    标准: sample === null ? String(col.standard || '') : '',
    实测数值: '',
    结果判断: '',
    行号: arr.reduce((m, r) => Math.max(m, Number(r?.['行号']) || 0), 0) + 1,
    备注: '',
  }
  arr.push(next)
  return next
}

function cellText(sample, c) {
  return String(rowOf(sample, c)['实测数值'] ?? '')
}
function setMeasured(sample, c, v) {
  rowOf(sample, c)['实测数值'] = String(v ?? '')
  bump.value++
  emit('dirty')
}
function setStandard(c, v) {
  rowOf(null, c)['标准'] = String(v ?? '')
  bump.value++
  emit('dirty')
}
function renameColumn(c, v) {
  const label = String(v ?? '')
  updateColumn(props.head, c.key, { label })
  bump.value++
  emit('dirty')
}
/** 把某列挪到另一个分组(图片上四个分组是固定的;新增列默认落最后一组) */
function setColumnGroup(c, g) {
  updateColumn(props.head, c.key, { group: g })
  bump.value++
  emit('dirty')
}

/** 新增一个测试项目 = 新增一列(用户口径:「测试项目需要可新增,也就是新增列即可」) */
function addTestItem() {
  if (!props.editable) return
  const r = addColumn(props.head, {})
  bump.value++
  emit('dirty')
  ElMessage.success(`${tt('已新增一列')}：${r.label}${tt('，请在列头改成要测的项目名')}`)
}
/** 删列:填过数据的先确认(会连同标准行与 8 个样品行一起清掉) */
async function removeCol(c) {
  if (!props.editable) return
  if (columnHasContent(items.value, c.key)) {
    try {
      await ElMessageBox.confirm(
        `${tt('删除本列将连同已填内容一起清空')}（${c.label}），${tt('确定删除吗？')}`,
        tt('删除本列'),
        { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
      )
    } catch { return /* 取消 */ }
  }
  removeColumn(props.head, c.key)
  bump.value++
  emit('dirty')
}

/* ── 表观及脱粉两列:勾选式(图片上是"无粘模(均匀)/轻微粘模(粗糙)/严重粘模(脱皮)"这类) ── */
const CHECK_COLS = ['appearance', 'depowder']
const CHECK_OPTIONS = {
  appearance: ['无粘模（均匀）', '轻微粘模（粗糙）', '严重粘模（脱皮）'],
  depowder: ['无明显脱粉', '轻微脱粉', '严重脱粉'],
}
function isCheckCol(c) {
  // 按列名认(自定义列不误判),key 只作兜底
  return /表观状态|表观|粘模/.test(c.label) || /脱粉/.test(c.label) || CHECK_COLS.includes(c.key)
}
function checkOptions(c) {
  if (/脱粉/.test(c.label) || c.key === 'depowder') return CHECK_OPTIONS.depowder
  return CHECK_OPTIONS.appearance
}
function isChecked(sample, c, option) {
  return cellText(sample, c).split(/[、,，;；]/).map((s) => s.trim()).includes(option)
}
function toggleCheck(sample, c, option) {
  if (!props.editable) return
  const cur = cellText(sample, c).split(/[、,，;；]/).map((s) => s.trim()).filter(Boolean)
  const i = cur.indexOf(option)
  if (i >= 0) cur.splice(i, 1)
  else cur.push(option)
  setMeasured(sample, c, cur.join('、'))
}
</script>

<style scoped>
.fi-sheet {
  background: #fff;
  border: 1px solid #8a8a8a;
  max-width: 1560px;
  min-width: 980px;
  margin: 14px auto 24px;
  color: #222;
  font-size: 13.5px;
}
/* 报告头右上信息三格 */
.fi-topbar {
  display: flex;
  justify-content: flex-end;
}
.fi-info {
  border-collapse: collapse;
  table-layout: fixed;
  width: 380px;
}
.fi-info th,
.fi-info td {
  border: 1px solid #8a8a8a;
  padding: 5px 8px;
  font-size: 13px;
}
.fi-info th {
  background: #f2f2f2;
  font-weight: 600;
  width: 130px;
  text-align: center;
}
.fi-titlerow {
  text-align: center;
  padding: 6px 0 10px;
}
.fi-title {
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 27px;
  font-weight: 700;
  letter-spacing: 3px;
}
/* 纸张四张表共用一套框线 */
.fi-head,
.fi-grid,
.fi-foot {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.fi-head th,
.fi-head td,
.fi-grid th,
.fi-grid td,
.fi-foot th,
.fi-foot td {
  border: 1px solid #8a8a8a;
  padding: 5px 6px;
  text-align: center;
  vertical-align: middle;
}
.fi-head th,
.fi-foot th {
  background: #f2f2f2;
  font-weight: 600;
}
.fi-head td {
  text-align: left;
}
/* 两级表头 */
.fi-grid thead .corner {
  position: relative;
  background: #e8e8e8;
  height: 62px;
}
.corner-a,
.corner-b {
  position: absolute;
  font-weight: 600;
  font-size: 12.5px;
}
.corner-a {
  top: 6px;
  right: 8px;
}
.corner-b {
  bottom: 6px;
  left: 8px;
}
.fi-grid thead .group {
  background: #e0e0e0;
  font-weight: 600;
  font-size: 14.5px;
  height: 30px;
}
.fi-grid thead .col-head {
  background: #d9d9d9;
  font-weight: 600;
  min-height: 34px;
  position: relative;
  padding-right: 16px;
}
.col-head small {
  font-size: 11px;
  font-weight: 500;
}
/* 列头里的改名输入:纸上观感(无边框),悬停才显边框 */
.fi-colname :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  padding: 0 2px;
}
.fi-colname :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #b7c7dd inset;
}
.fi-colname :deep(.el-input__inner) {
  text-align: center;
  font-weight: 600;
  font-size: 13px;
  height: 22px;
}
/* 列头下的分组选择:小号淡墨(不与列名抢视线),悬停该列头才显形。
   ⚠ 不能只靠 :hover 显形 —— 探针要点它、触摸屏也没有 hover;故用 opacity 过渡而非 display,
     元素始终可点(点得到、测得到),只是不刺眼。 */
.fi-colgroup {
  opacity: 0.35;
  transition: opacity 0.12s;
}
.col-head:hover .fi-colgroup {
  opacity: 1;
}
.fi-colgroup :deep(.el-select__wrapper) {
  box-shadow: none;
  background: transparent;
  min-height: 18px;
  padding: 0 2px;
}
.fi-colgroup :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #b7c7dd inset;
}
.fi-colgroup :deep(.el-select__selected-item) {
  font-size: 11px;
  font-weight: 400;
  color: #666;
  justify-content: center;
}
.fi-coldel {
  position: absolute;
  top: 1px;
  right: 2px;
  cursor: pointer;
  color: #b23;
  font-size: 13px;
  line-height: 1;
}
.fi-addcol {
  display: inline-block;
  width: 22px;
  height: 22px;
  line-height: 20px;
  border: 1px solid #8a8a8a;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 15px;
}
.fi-addcol:hover {
  background: #eef6fe;
  border-color: #1f5fa8;
  color: #1f5fa8;
}
/* 行标签列 */
.rowlabel {
  background: #f2f2f2;
  font-weight: 600;
}
/* 标准行 */
.standard-row td {
  background: #f7f7f7;
  vertical-align: top;
  min-height: 40px;
}
.fi-stdtext {
  display: inline-block;
  width: 100%;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}
/* 数据区 */
.sample-row td {
  height: 56px;
}
.sample-row td.is-check {
  text-align: left;
  padding: 4px 6px;
}
.fi-checks {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.fi-check {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12.5px;
  line-height: 1.45;
  cursor: pointer;
  white-space: nowrap;
}
.fi-box {
  color: #666;
  font-size: 13px;
}
.fi-box.on {
  color: #1f5fa8;
}
.fi-checktext {
  font-size: 12.5px;
}
.fi-empty {
  height: 64px;
  color: #909399;
}
.col-op {
  background: #fafafa;
}
/* 格内直编:去边框,白纸观感 */
.fi-cell {
  width: 100%;
}
.fi-cell :deep(.el-input__wrapper),
.fi-cell :deep(.el-textarea__inner),
.fi-cell :deep(.el-input__wrapper.is-focus),
.fi-cell :deep(.el-textarea__inner:focus) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0 2px;
}
.fi-cell :deep(.el-input__inner),
.fi-cell :deep(.el-textarea__inner) {
  text-align: center;
  font-size: 13px;
}
.standard-row .fi-cell :deep(.el-textarea__inner) {
  text-align: left;
}
/* 相关要求 + 表尾 */
.fi-requirements {
  padding: 8px 12px;
  border-top: none;
  line-height: 1.65;
  font-size: 12.5px;
}
.fi-requirements ol {
  margin: 2px 0 0 20px;
  padding: 0;
}
.fi-foot th {
  width: 96px;
}
.fi-foot td {
  text-align: left;
  height: 38px;
}
.fi-foot td:nth-child(3) {
  width: 96px;
  text-align: center;
}
</style>
