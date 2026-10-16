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
    <!-- 相关要求(纸面底部那 6 条)里**必须让人看见**的两条,做成纸张顶部提醒条 —— 只读态也显示,
         打印/导出一样带出来(它们本身就是要贴在单上的处置要求):
           · 第 6 条 C-95 客户相关产品:脱模后立马进行首件检验(判据 = 表头「客户代码」,出单时从工单带入);
           · 第 4 条 表观严重粘模/明显脱粉:马上停止生产 + 已生产的产品暂时隔离标示(红色)。 -->
    <div v-if="c95Notice || stopLineNotice" class="fi-alerts">
      <div v-if="c95Notice" class="fi-alert is-warn">
        ⚠ {{ tt('C-95客户相关产品脱模后立马进行首件检验。') }}
      </div>
      <div v-if="stopLineNotice" class="fi-alert is-danger">
        ⚠ {{ tt('炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。') }}
      </div>
    </div>
    <!-- 顶栏 = 右上信息三格 + 大标题(同一块,标题在这块空白里居中)
         ① 报告头右上信息三格(表单管理人/密级/使用范围)
         ⚠ 2026-10-16 用户口径(截图红框)「当前上面这一部分均不能填写需要实现变为可填写的实现」:
           原实现是纯文本 `<span>{{ head[...] }}</span>`,而这 4 个抬头字段当时**库里根本没有**
           (既非头表列、也无 yj_field 登记)⇒ 永远空白且无处可填。现已在 migrate-first-insp.sql
           第 J 段补上列 + yj_field 登记,这里按可填格子渲染(草稿态可填、只读态显示文本)。
         ⚠ 2026-10-16 第二轮用户口径(截图红框)「让当前的红框内容居于空白位置中央」:
           原实现里标题是紧跟信息三格之后的普通块 ⇒ 顶部空一大片、标题贴着「产品编号」那一行。
           现:标题**绝对居中于整块顶栏**(横向 = 整张纸正中,与纸质表单一致;纵向 = 顶栏空白正中)。 -->
    <div class="fi-header">
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

      <!-- ② 大标题(不参与右栏排布;纵横向都以顶栏为参照居中) -->
      <div class="fi-title">{{ tt('炭棒成型车间首件检验记录表') }}</div>
    </div>

    <!-- ③ 抬头四对:全部可填(产品编号/产品型号 支持参照或手填;生产日期用日期选择;组别取生产线)
         ⚠ 生产日期那一格给**固定宽 240px**(用户口径 2026-10-16 第五轮「增长当前生产日期框体长度
           让当前控件不会超出距离」):日期控件自带 220px 默认宽,格子按 `table-layout:fixed` 平摊时
           只有 ~150px ⇒ 控件会顶出格线、压到「组别」上。其余各列照旧平摊。 -->
    <table class="fi-head"><tbody><tr>
      <template v-for="f in HEAD_FIELDS" :key="f.key">
        <th>{{ tt(f.label) }}</th>
        <td :style="f.date ? { width: '240px' } : null">
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

    <!-- ④ 两级表头 + 标准行 + 1#..8# 数据区
         ⚠ 2026-10-16 第五轮(用户口径「修复当前红框会因为过多列而挤压的问题,当前实现可以拉滚动条移动」):
           列多(自由新增测试项目)时**不再把每列压扁**,而是给表格一个最小宽度、外面套一层横向滚动容器
           ⇒ 列宽保住 120px,不够就拉滚动条(打印时不裁切,见 .fi-grid-scroll 的 @media print)。 -->
    <div class="fi-grid-scroll">
    <table class="fi-grid" :style="{ minWidth: gridMinWidth }">
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
        <!-- 数据区:1#..8#(⚠ 相关要求第 1 条:每个测试项目只记录 2 支样品 ⇒ 只有 1#/2# 可填,
             3#..8# 打 `/` 且不可录;老单据里这几行已填过的值照原样显示,不吞数据) -->
        <tr v-for="sample in samples" :key="sample" class="sample-row">
          <th class="rowlabel">{{ sample }}#</th>
          <td v-for="c in columns" :key="c.key" :class="{ 'is-check': isCheckCol(c) }">
            <!-- 表观及脱粉:勾选式(无粘模/轻微粘模/严重粘模 …),同样只给 1#、2#。 -->
            <template v-if="isCheckCol(c)">
              <div v-if="editable && sample <= SAMPLE_LIMIT" class="fi-checks">
                <span v-for="o in checkOptions(c)" :key="o" class="fi-check">
                  <span
                    class="fi-box"
                    :class="{ on: isChecked(sample, c, o) }"
                    @click="toggleCheck(sample, c, o)"
                  >{{ isChecked(sample, c, o) ? '☑' : '□' }}</span>
                  <span
                    class="fi-check-txt"
                    :class="{ 'is-stop': stopOption(o) && isChecked(sample, c, o) }"
                    @click="toggleCheck(sample, c, o)"
                  >{{ tt(o) }}</span>
                </span>
              </div>
              <span v-else class="fi-checktext" :title="sample > SAMPLE_LIMIT ? tt('按相关要求：每个测试项目只记录 2 支样品（1#、2#）') : ''">
                {{ cellText(sample, c) || '/' }}
              </span>
            </template>
            <!-- 其余列:文本录入格(1#/2#);3#..8# 只读 -->
            <template v-else>
              <el-input
                v-if="editable && sample <= SAMPLE_LIMIT"
                :model-value="cellText(sample, c)"
                size="small"
                class="fi-cell"
                :title="precisionHint(c)"
                @update:model-value="v => setMeasured(sample, c, v)"
                @change="() => normalizePrecision(sample, c)"
              />
              <span v-else :title="sample > SAMPLE_LIMIT ? tt('按相关要求：每个测试项目只记录 2 支样品（1#、2#）') : ''">
                {{ cellText(sample, c) || '/' }}
              </span>
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
    </div>

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
 * 相关要求第 1 条:「表观及脱粉项目测试后记录2支样品数据，炭棒尺寸及重量相关项目测试后记录2支样品数据，
 *   炭棒强度测试2支样品，浊度及压降测试记录2支样品。」
 * ⇒ **每个测试项目都只记录 2 支样品**,纸面保留 1#..8# 八行(版式照图纸),但只有 1#/2# 可录,
 *   3#..8# 打 `/`(图片上那排斜杠就是这个意思);老单据里 3#..8# 已填过的值照原样只读显示,不吞数据。
 */
const SAMPLE_LIMIT = 2

/**
 * 相关要求第 2 条:「…测试数据记录精度规定如下：炭棒内外径、长度及重量保留小数点后1位；
 *   挤压强度及压降按表显数据记录。」
 * ⇒ 按列名认规则(自定义列同规则生效):
 *   · oneDecimal   —— 内外径/长度/重量:失焦(或回车)时按 0.1 取整并提示(不在打字过程中抢值);
 *   · asDisplayed  —— 挤压强度/压降:表显多少记多少,**不取整**(列头给提示)。
 */
function precisionOf(c) {
  const t = `${c.label || ''} ${c.key || ''}`
  if (/外径|内径|长度|重量/.test(t)) return 'oneDecimal'
  if (/挤压强度|压降/.test(t)) return 'asDisplayed'
  return ''
}
/** 录入格的 title 提示(按本列的精度规则给) */
function precisionHint(c) {
  const rule = precisionOf(c)
  if (rule === 'oneDecimal') return tt('按相关要求：内外径、长度及重量保留小数点后1位')
  if (rule === 'asDisplayed') return tt('按表显数据记录（不取整）')
  return ''
}
/** 一位小数:失焦时取整并提示;非纯数值(如 `/`、`≤0.5` 这类手写口径)一律不碰 */
function normalizePrecision(sample, c) {
  if (precisionOf(c) !== 'oneDecimal') return
  const raw = String(cellText(sample, c) ?? '').trim()
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return
  const n = Number(raw)
  if (!Number.isFinite(n)) return
  const fixed = n.toFixed(1)
  if (fixed === raw) return
  setMeasured(sample, c, fixed)
  if (Number(fixed) !== n) {
    ElMessage.warning(tt('按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）')
      .replace('{a}', raw).replace('{b}', fixed))
  }
}

/**
 * 相关要求第 4 条:「炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。」
 * ⇒ 这两个勾选项一旦记录:勾的当下弹一次红色警示,纸张顶部**常驻红色横幅**(只读态/打印件一样带),
 *   选项文字标红(见 .fi-check-txt.is-stop)。刻意**不代填**「检验结果」—— 结论由品质据实填。
 */
const STOP_OPTIONS = ['严重粘模（脱皮）', '严重脱粉']
const stopOption = (o) => STOP_OPTIONS.includes(o)
const stopLineNotice = computed(() => {
  bump.value
  // ⚠ 直接扫明细行,别用 isChecked()(它经 rowOf 会**顺手补行** —— computed 里改数据是隐患)
  return (props.head?.detail?.items || []).some((r) => String(r?.['实测数值'] ?? '')
    .split(/[、,，;；]/).map((x) => x.trim()).some((x) => STOP_OPTIONS.includes(x)))
})

/**
 * 相关要求第 6 条:「C-95客户相关产品脱模后立马进行首件检验。」
 * C-95 是**客户代码**(dm_kh.dm;出单时从工单行带入 head['客户代码'],见 ButtonService.firstInspGenerate);
 * 老单据 / 手工建的单只有客户名称或产品编码时,退而在这几个字段里找 "C-95"/"C95"(词边界,别误命中 ABC95)。
 */
const C95_KEYS = ['客户代码', '客户名称', '产品编码', '产品名称', '规格型号']
const c95Notice = computed(() => C95_KEYS
  .some((k) => /(^|[^A-Za-z0-9])C-?95([^0-9]|$)/i.test(String(props.head?.[k] || ''))))

/**
 * 数据区表格的**最小宽度**(列多时不挤压,超出就横向拉滚动条)。
 * 用户口径(2026-10-16 第五轮):「修复当前红框会因为过多列而挤压的问题,当前实现可以拉滚动条移动」
 * ⇒ 行标签 96 + 每个测试项目列 120 + (可编辑时的)操作列 40;表格 `width:100%` 照旧 ——
 *   容器够宽就铺满、不够宽就按这个最小宽出滚动条(`table-layout:fixed` 下每列 ≈120px)。
 */
const COL_MIN_WIDTH = 120
const gridMinWidth = computed(() => {
  const cols = Math.max(1, columns.value.length)
  return `${96 + cols * COL_MIN_WIDTH + (props.editable ? 40 : 0)}px`
})

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
  const data = props.head || {}
  if (f.key === '生产日期') return data['生产日期'] || data['检验日期'] || data['单据日期'] || ''
  if (f.key === '规格型号') return data['规格型号'] || data['产品名称'] || ''
  return data[f.key] || ''
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
  const turningOn = i < 0                                  // 这一步是"勾上"还是"取消"
  if (i >= 0) cur.splice(i, 1)
  else cur.push(option)
  setMeasured(sample, c, cur.join('、'))
  // 相关要求第 4 条:勾上「严重粘模（脱皮）」/「严重脱粉」⇒ 当场红色警示(纸张顶部同时挂常驻红幅)
  if (turningOn && stopOption(option)) {
    ElMessageBox.alert(
      tt('炭棒表观出现严重粘模或明显脱粉情况，需马上停止生产，已生产的产品暂时隔离标示（红色）。'),
      tt('相关要求'),
      { type: 'error', confirmButtonText: tt('确定') },
    ).catch(() => { /* 关掉即可,不阻断录入 */ })
  }
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
/* 相关要求提醒条(纸张顶部;只读态与打印件一样带出来) */
.fi-alerts {
  display: flex;
  flex-direction: column;
}
.fi-alert {
  padding: 5px 10px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid;
}
.fi-alert.is-warn {
  background: #fff7e6;
  border-color: #f0c36d;
  color: #8a6d3b;
}
.fi-alert.is-danger {
  background: #fdecea;
  border-color: #e6a19a;
  color: #b3261e;
}
/* 数据区滚动容器(2026-10-16 第五轮):列多时不挤压 —— 表格按 gridMinWidth 撑开,这里出横向滚动条。
   ⚠ 打印/导出时不能裁切:滚动容器打印时退回可见(表格保持最小宽,由打印机分页)。 */
.fi-grid-scroll {
  overflow-x: auto;
}
@media print {
  .fi-grid-scroll {
    overflow: visible;
  }
}
/* 顶栏(右上信息三格 + 大标题)
   ⚠ 2026-10-16 第二轮用户口径(截图红框)「让当前的红框内容居于空白位置中央」:
     标题**绝对定位于整块顶栏**并两向居中 —— 横向仍以**整张纸**为参照(与纸质表单一致,不受右侧
     380px 信息三格挤压),纵向落在这块空白的正中央。
     padding-bottom 顶住标题行原来的高度(6+31+10 = 47px):标题一旦脱离文档流就撑不高顶栏了,
     少这一段会把下面的抬头四对整体往上提,纸张版式就跟着动。 */
.fi-header {
  position: relative;
  padding-bottom: 47px;
}
.fi-topbar {
  display: flex;
  justify-content: flex-end;
}
.fi-info {
  border-collapse: collapse;
  table-layout: fixed;
  width: 380px;
  /* 标题绝对定位后横向上会压过信息三格那一行的范围(窄屏才可能真重叠);
     这里让信息三格**盖在标题之上**并自带白底,任何时候都读得到、点得着。 */
  position: relative;
  z-index: 1;
  background: #fff;
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
.fi-title {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 标题只是一行字,别挡住右上三格的输入框/下拉(它横向上确实覆盖到那一行) */
  pointer-events: none;
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
/* 相关要求第 4 条:严重粘模 / 严重脱粉 一旦勾上,选项文字标红 */
.fi-check-txt.is-stop {
  color: #b3261e;
  font-weight: 600;
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
/* 抬头格子里的控件必须**收在格子里**(2026-10-16 第五轮用户口径「生产日期的控件不要超出当前框体」):
   日期选择器自带 220px 默认宽(`--el-date-editor-width`),格子按 fixed 布局平摊时放不下就会顶出格线。
   这里用更高特异性把 root 宽度按 100% 收口(生产日期那格另给了 240px 固定宽,所以控件也不憋屈)。 */
.fi-head td .fi-cell {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.fi-head td :deep(.el-date-editor.el-input),
.fi-head td :deep(.el-date-editor .el-input__wrapper) {
  width: 100%;
  box-sizing: border-box;
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
