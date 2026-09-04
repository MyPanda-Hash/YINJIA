<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       数据记录表 7 张文书面板(RecordSheetPanels)——按《04数据记录表.xlsx》一比一复刻
       覆盖:碱性/矿化/抑菌/阻垢性能/RO保护/浸泡安全/压降、精度
       配置驱动:recordSheetConfigs.js(sections 条件区 + dataTables 两级表头 + conclusion)
       特例块:碱性原水水质条 / 浸泡安全(浸泡液用量+仪器检出限) / 矿化(4 指标块+散点图)
       数据键全部为字段 label(中文);保存/审批/打印复用引擎既有逻辑
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="record-sheet rsp-sheet">
    <!-- ═══ 报告头:公司名 | 文档编号 ═══ -->
    <table class="rs-t rs-head-t">
      <colgroup><col style="width:auto" /><col style="width:300px" /></colgroup>
      <tbody>
        <tr>
          <td class="rs-td rs-company-cell">惠州市银嘉环保科技有限公司</td>
          <td class="rs-td rs-docno">
            <el-input v-if="editable" v-model="head['文档编号']" size="small" maxlength="30" class="rs-docno-input" @input="emit('dirty')" />
            <template v-else>{{ head['文档编号'] || head['单据编号'] || 'YJ-PD-01' }}</template>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-topic-cell" rowspan="4">
            <el-input v-if="editable" v-model="head['测试主题']" size="small" class="rs-topic-input" :placeholder="tt(cfg.titlePlaceholder)" @input="emit('dirty')" />
            <span v-else class="rs-topic">{{ head['测试主题'] || cfg.titlePlaceholder }}</span>
          </td>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('密级') }}</span>
              <span class="rs-ivalue">
                <el-select v-if="editable" v-model="head['密级']" size="small" :clearable="false" @change="emit('dirty')">
                  <el-option v-for="o in selectOptions('密级')" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <template v-else>{{ head['密级'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('适用范围') }}</span>
              <span class="rs-ivalue">
                <el-select v-if="editable" v-model="head['适用范围']" size="small" :clearable="false" @change="emit('dirty')">
                  <el-option v-for="o in selectOptions('适用范围')" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <template v-else>{{ head['适用范围'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('测试负责人') }}</span>
              <span class="rs-ivalue">
                <el-input v-if="editable" v-model="head['测试负责人']" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
                <template v-else>{{ head['测试负责人'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-info-cell">
            <div class="rs-irow">
              <span class="rs-ilabel">{{ tt('报告编号') }}</span>
              <span class="rs-ivalue">
                <el-input v-if="editable" v-model="head['报告编号']" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
                <template v-else>{{ head['报告编号'] || '' }}</template>
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 条件区(1.基本信息 / 2.测试条件 / 3.测试对象信息…) ═══ -->
    <table v-for="(sec, si) in cfg.sections" :key="'sec' + si" class="rs-t">
      <colgroup><col style="width:170px" /><col style="width:auto" /><col style="width:auto" /></colgroup>
      <tbody>
        <tr><td colspan="3" class="rs-sectionbar">{{ tt(sec.bar) }}</td></tr>
        <tr v-for="(row, ri) in sec.rows" :key="'r' + ri">
          <td class="rs-td rs-label">{{ tt(row.label) }}</td>
          <!-- 多值单元格(如 阻垢 特殊配方 1#/2#/3#) -->
          <template v-if="row.cells">
            <td v-for="(c, ci) in row.cells" :key="c.key" class="rs-td" :colspan="ci === row.cells.length - 1 ? 4 - row.cells.length : 1">
              <el-input v-if="editable" v-model="head[c.key]" size="small" maxlength="100" class="rs-t-in" :placeholder="c.ph || ''" @input="emit('dirty')" />
              <span v-else class="rs-txt">{{ head[c.key] || '' }}</span>
            </td>
          </template>
          <td v-else class="rs-td" colspan="2">
            <el-input v-if="editable && row.type === 'text'" v-model="head[row.key]" size="small" :maxlength="row.max || 300" class="rs-t-in" @input="emit('dirty')" />
            <el-input v-else-if="editable" v-model="head[row.key]" type="textarea" :autosize="{ minRows: row.tall ? 3 : 1, maxRows: 12 }" size="small" :maxlength="row.max || 2000" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt" :class="{ 'rsp-pre': row.tall }">{{ head[row.key] || '' }}</span>
          </td>
        </tr>

        <!-- 特例:碱性 原水水质条件(6 指标条) -->
        <template v-if="sec.waterStrip">
          <tr>
            <td class="rs-td rs-label rsp-water-label" rowspan="2">{{ tt('原水水质条件') }}</td>
            <td class="rs-td rsp-water-zone" colspan="2">
              <table class="rs-inner">
                <tbody>
                  <tr>
                    <td class="rs-ind-name">{{ tt('自来水') }}</td>
                    <td class="rs-ind-name">{{ tt('超纯水') }}</td>
                    <td class="rs-ind-name">{{ tt('RO纯水（水效水+RO机）') }}</td>
                    <td class="rs-ind-name">{{ tt('PH') }}</td>
                    <td class="rs-ind-name">{{ tt('TDS') }}</td>
                    <td class="rs-ind-name">{{ tt('水温') }}</td>
                  </tr>
                  <tr>
                    <td class="rs-water-val"><el-select v-if="editable" v-model="head['原水自来水']" size="small" :clearable="false" @change="emit('dirty')"><el-option v-for="o in selectOptions('原水自来水')" :key="o.value" :label="o.label" :value="o.value" /></el-select><template v-else>{{ head['原水自来水'] || '' }}</template></td>
                    <td class="rs-water-val"><el-select v-if="editable" v-model="head['原水超纯水']" size="small" :clearable="false" @change="emit('dirty')"><el-option v-for="o in selectOptions('原水超纯水')" :key="o.value" :label="o.label" :value="o.value" /></el-select><template v-else>{{ head['原水超纯水'] || '' }}</template></td>
                    <td class="rs-water-val"><el-select v-if="editable" v-model="head['原水RO纯水']" size="small" :clearable="false" @change="emit('dirty')"><el-option v-for="o in selectOptions('原水RO纯水')" :key="o.value" :label="o.label" :value="o.value" /></el-select><template v-else>{{ head['原水RO纯水'] || '' }}</template></td>
                    <td class="rs-water-val"><el-input v-if="editable" v-model="head['原水PH']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['原水PH'] || '' }}</span></td>
                    <td class="rs-water-val"><el-input v-if="editable" v-model="head['原水TDS']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['原水TDS'] || '' }}</span></td>
                    <td class="rs-water-val"><el-input v-if="editable" v-model="head['水温']" size="small" class="rs-c-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['水温'] || '' }}</span></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>

        <!-- 特例:浸泡安全 浸泡液用量 + 测试用仪器/检出限 -->
        <template v-if="sec.soakBlocks">
          <tr>
            <td class="rs-td rs-label rsp-water-label" rowspan="2">{{ tt('浸泡液用量') }}</td>
            <td class="rs-td rs-label rsp-thin">{{ tt('炭棒尺寸') }}</td>
            <td class="rs-td"><el-input v-if="editable" v-model="head['炭棒尺寸（1）']" size="small" maxlength="60" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['炭棒尺寸（1）'] || '' }}</span></td>
            <td class="rs-td"><el-input v-if="editable" v-model="head['炭棒尺寸（2）']" size="small" maxlength="60" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['炭棒尺寸（2）'] || '' }}</span></td>
            <td class="rs-td"><el-input v-if="editable" v-model="head['炭棒尺寸（3）']" size="small" maxlength="60" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['炭棒尺寸（3）'] || '' }}</span></td>
          </tr>
          <tr>
            <td class="rs-td rs-label rsp-thin">{{ tt('浸泡液用量（ml）') }}</td>
            <td class="rs-td"><el-input v-if="editable" v-model="head['浸泡液用量（1）ml']" size="small" maxlength="60" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['浸泡液用量（1）ml'] || '' }}</span></td>
            <td class="rs-td"><el-input v-if="editable" v-model="head['浸泡液用量（2）ml']" size="small" maxlength="60" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['浸泡液用量（2）ml'] || '' }}</span></td>
            <td class="rs-td"><el-input v-if="editable" v-model="head['浸泡液用量（3）ml']" size="small" maxlength="60" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head['浸泡液用量（3）ml'] || '' }}</span></td>
          </tr>
          <tr>
            <td class="rs-td rs-label rsp-water-label" rowspan="5">{{ tt('测试用仪器/检出限') }}</td>
            <td class="rs-th rsp-thin">{{ tt('测试项目') }}</td>
            <td class="rs-th">{{ tt('仪器名称') }}</td>
            <td class="rs-th">{{ tt('品牌型号') }}</td>
            <td class="rs-th">{{ tt('检出限') }}</td>
          </tr>
          <tr v-for="it in soakInstrumentRows" :key="it.name">
            <td class="rs-td rsp-item-name">{{ tt(it.name) }}</td>
            <td class="rs-td"><el-input v-if="editable" v-model="head[it.keys[0]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head[it.keys[0]] || '' }}</span></td>
            <td class="rs-td"><el-input v-if="editable" v-model="head[it.keys[1]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head[it.keys[1]] || '' }}</span></td>
            <td class="rs-td"><el-input v-if="editable" v-model="head[it.keys[2]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head[it.keys[2]] || '' }}</span></td>
          </tr>
        </template>
      </tbody>
    </table>

    <!-- ═══ 数据记录表(支持子头行 + 两级表头;矿化 4 指标块各带散点图) ═══ -->
    <div v-for="(dt, di) in cfg.dataTables" :key="'dt' + di" class="rsp-dt-wrap" :class="{ 'with-chart': dt.charts }">
      <div class="rsp-dt-table">
        <table class="rs-t rs-dt">
          <colgroup>
            <col v-for="c in visCols(dt)" :key="c.key" :style="{ width: c.w + 'px' }" />
            <col v-if="editable" style="width:60px" />
          </colgroup>
          <tbody>
            <tr v-if="dt.bar"><td :colspan="visCols(dt).length + (editable ? 1 : 0)" class="rs-sectionbar">{{ tt(dt.bar) }}</td></tr>
            <tr v-if="dt.subHeads">
              <td v-for="(sh, shi) in spreadSubHeads(dt)" :key="'sh' + shi" :colspan="sh.span" class="rs-subhead">{{ tt(sh.label) }}</td>
              <td v-if="editable" class="rs-subhead"></td>
            </tr>
            <tr class="rs-grp">
              <template v-for="(g, gi) in headerRow1(dt)" :key="'h1' + gi">
                <th v-if="g.kind === 'plain'" class="rs-th" rowspan="2">{{ tt(g.label) }}</th>
                <th v-else-if="g.kind === 'group'" class="rs-th" :colspan="g.span">{{ tt(g.label) }}</th>
              </template>
              <th v-if="editable" class="rs-th rs-th-op" rowspan="2"></th>
            </tr>
            <tr v-if="hasGroup(dt)" class="rs-grp2">
              <th v-for="c in groupCols(dt)" :key="'h2' + c.key" class="rs-th">{{ tt(c.label) }}</th>
            </tr>
            <tr v-for="(row, i) in rowsOf(dt)" :key="row.id ?? ('new' + di + '-' + i)">
              <td v-for="c in visCols(dt)" :key="c.key" class="rs-td">
                <el-input v-if="editable && c.area" v-model="row[c.key]" type="textarea" :autosize="{ minRows: 2, maxRows: 10 }" size="small" class="rs-t-in" @input="emit('dirty')" />
                <el-input v-else-if="editable" v-model="row[c.key]" size="small" class="rs-c-in" @input="emit('dirty')" />
                <span v-else class="rs-txt rsp-cell">{{ row[c.key] || ' / ' }}</span>
              </td>
              <td v-if="editable" class="rs-td rs-td-op"><span class="rs-op-add" @click="addRow(dt)">＋</span><span class="rs-op-del" @click="removeRow(row)">×</span></td>
            </tr>
            <tr v-if="!rowsOf(dt).length"><td :colspan="visCols(dt).length + (editable ? 1 : 0)" class="rs-empty">—</td></tr>
          </tbody>
        </table>
        <div v-if="editable" class="rs-add" @click="addRow(dt)">＋ {{ tt('新增数据记录行') }}</div>
      </div>
      <!-- 矿化:Excel 原表右侧 4 张散点图(RO出水/浸泡30min/煮沸晾凉 × 累计流量) -->
      <div v-if="dt.charts" class="rsp-chart">
        <svg :viewBox="`0 0 ${CW} ${CH}`" class="rsp-chart-svg" preserveAspectRatio="xMidYMid meet">
          <text :x="CW / 2" y="16" text-anchor="middle" class="rsp-chart-title">{{ tt(dt.metric) }}-{{ tt('累计流量曲线') }}</text>
          <g v-for="(gl, gi) in chartOf(dt).gridH" :key="'gh' + gi">
            <line :x1="chartOf(dt).ml" :y1="gl.y" :x2="CW - chartOf(dt).mr" :y2="gl.y" class="rsp-gridline" />
            <text :x="chartOf(dt).ml - 6" :y="gl.y + 4" text-anchor="end" class="rsp-tick">{{ gl.label }}</text>
          </g>
          <g v-for="(gv, gi) in chartOf(dt).gridV" :key="'gv' + gi">
            <line :x1="gv.x" :y1="chartOf(dt).mt" :x2="gv.x" :y2="CH - chartOf(dt).mb" class="rsp-gridline" />
            <text :x="gv.x" :y="CH - chartOf(dt).mb + 16" text-anchor="middle" class="rsp-tick">{{ gv.label }}</text>
          </g>
          <polyline v-for="(s, si) in chartOf(dt).series" :key="'s' + si" :points="s.pts.map((p) => p.join(',')).join(' ')" fill="none" :stroke="s.color" stroke-width="1.6" />
          <g v-for="(s, si) in chartOf(dt).series" :key="'m' + si">
            <circle v-for="(p, pi) in s.pts" :key="pi" :cx="p[0]" :cy="p[1]" r="2.6" :fill="s.color" />
          </g>
          <g :transform="`translate(${chartOf(dt).ml}, ${CH - 12})`">
            <g v-for="(s, si) in chartOf(dt).series" :key="'lg' + si" :transform="`translate(${si * 118}, 0)`">
              <rect width="14" height="3" y="-4" :fill="s.color" />
              <text x="19" y="0" class="rsp-legend">{{ tt(s.name) }}</text>
            </g>
          </g>
          <text v-if="!chartOf(dt).hasData" :x="CW / 2" :y="CH / 2" text-anchor="middle" class="rsp-nodata">{{ tt('暂无数据') }}</text>
        </svg>
      </div>
    </div>

    <!-- ═══ 结论区(Excel 无结论区的表不渲染) ═══ -->
    <table v-if="cfg.conclusion" class="rs-t">
      <tbody>
        <tr><td colspan="3" class="rs-sectionbar">{{ tt(cfg.conclusion.bar) }}</td></tr>
        <tr>
          <td class="rs-td rs-conclusion" colspan="3">
            <el-input v-if="editable" v-model="head[cfg.conclusion.key]" type="textarea" :autosize="{ minRows: 2, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head[cfg.conclusion.key] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { tt } from '@/i18n'
import { recordSheetConfigs } from './recordSheetConfigs'

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  panelCode: { type: String, required: true },
})
const emit = defineEmits(['dirty'])

const cfg = computed(() => recordSheetConfigs[props.panelCode] || null)

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
function selectOptions(key) {
  const f = fieldMap.value.get(key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// 浸泡安全:仪器/检出限 4 行(PH/TDS/浊度/重金属)固定检测项目名 + 3 个可编辑字段
const soakInstrumentRows = [
  { name: 'PH', keys: ['仪器名称（PH）', '品牌型号（PH）', '检出限（PH）'] },
  { name: 'TDS', keys: ['仪器名称（TDS）', '品牌型号（TDS）', '检出限（TDS）'] },
  { name: '浊度', keys: ['仪器名称（浊度）', '品牌型号（浊度）', '检出限（浊度）'] },
  { name: '重金属', keys: ['仪器名称（重金属）', '品牌型号（重金属）', '检出限（重金属）'] },
]

const items = computed(() => {
  const d = props.head?.detail
  return d && Array.isArray(d.items) ? d.items : []
})
function touch() {
  const d = props.head.detail || (props.head.detail = {})
  if (!Array.isArray(d.items)) d.items = []
  return d.items
}

// ── 数据记录表渲染 ──
function visCols(dt) {
  return dt.cols.filter((c) => !c.hiddenCol)
}
function groupCols(dt) {
  return visCols(dt).filter((c) => c.group)
}
function hasGroup(dt) {
  return groupCols(dt).length > 0
}
/** 一级表头:非 group 列(rowspan=2);group 列合并为一条(colspan=n) */
function headerRow1(dt) {
  const out = []
  for (const c of visCols(dt)) {
    if (!c.group) {
      out.push({ kind: 'plain', label: c.label, key: c.key })
    } else if (!out.length || out[out.length - 1].kind !== 'group' || out[out.length - 1].label !== c.group) {
      out.push({ kind: 'group', label: c.group, span: 1 })
    } else {
      out[out.length - 1].span += 1
    }
  }
  return out
}
/** 子头行(碱性:口感测试/离子分析):按 cols 顺序铺 colspan */
function spreadSubHeads(dt) {
  const total = visCols(dt).length
  const out = []
  let used = 0
  for (const sh of dt.subHeads || []) {
    const span = Math.min(sh.span, total - used)
    if (span > 0) out.push({ label: sh.label, span })
    used += span
  }
  return out
}
/** 行集:矿化按 指标 字段分块;其余全量 */
function rowsOf(dt) {
  if (!dt.metric) return items.value
  return items.value.filter((r) => (r['指标'] || '') === dt.metric)
}
function addRow(dt) {
  const row = dt.metric ? { 指标: dt.metric } : {}
  touch().push(row)
  emit('dirty')
}
function removeRow(row) {
  const arr = touch()
  const i = arr.indexOf(row)
  if (i >= 0) arr.splice(i, 1)
  emit('dirty')
}

// 浸泡安全:进入草稿编辑且明细为空时,自动带出 GB/T17219 标准 17 项卫生项目(Excel 原表预填)
watch(() => props.editable, (v) => {
  if (!v || !cfg.value?.seedRows) return
  const arr = touch()
  if (arr.length) return
  for (const [no, name, req] of cfg.value.seedRows) {
    arr.push({ 序号: no, 项目: name, 卫生要求: req })
  }
})

// ── 矿化散点图(Excel 原表 4 张 XY 散点图:3 系列 × 累计流量) ──
const CW = 380
const CH = 250
const SERIES = [
  { name: 'RO出水', color: '#4472c4', key: 'RO出水' },
  { name: '浸泡30min', color: '#ed7d31', key: '浸泡30min' },
  { name: '浸泡30min煮沸晾凉', color: '#70ad47', key: '浸泡30min煮沸晾凉' },
]
function chartOf(dt) {
  const ml = 52, mr = 14, mt = 26, mb = 46
  const rows = rowsOf(dt)
  const pts = []
  for (const s of SERIES) {
    const ps = rows
      .map((r) => ({ x: parseFloat(r['累计流量L']), y: parseFloat(r[s.key]) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    pts.push(ps)
  }
  const all = pts.flat()
  const hasData = all.length > 0
  let minX = 0, maxX = 10, minY = 0, maxY = 10
  if (hasData) {
    minX = Math.min(...all.map((p) => p.x))
    maxX = Math.max(...all.map((p) => p.x))
    minY = Math.min(...all.map((p) => p.y))
    maxY = Math.max(...all.map((p) => p.y))
    if (minX === maxX) maxX = minX + 1
    if (minY === maxY) maxY = minY + 1
  }
  const px = (x) => ml + ((x - minX) / (maxX - minX)) * (CW - ml - mr)
  const py = (y) => CH - mb - ((y - minY) / (maxY - minY)) * (CH - mt - mb)
  const fmt = (n) => (Math.abs(n) >= 1000 ? Math.round(n).toString() : String(Math.round(n * 100) / 100))
  const gridH = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    y: CH - mb - r * (CH - mt - mb),
    label: fmt(minY + r * (maxY - minY)),
  }))
  const gridV = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    x: ml + r * (CW - ml - mr),
    label: fmt(minX + r * (maxX - minX)),
  }))
  return {
    ml, mr, mt, mb, hasData,
    gridH, gridV,
    series: SERIES.map((s, i) => ({ name: s.name, color: s.color, pts: pts[i].map((p) => [px(p.x), py(p.y)]) })),
  }
}
</script>

<style scoped>
/* ═══ 纸张/表基础(与功能性滤效同一视觉语言) ═══ */
.record-sheet {
  width: 1180px;
  max-width: 100%;
  margin: 16px auto 26px;
  background: #fff;
  font-size: 14px;
  color: #222;
}
.rs-t {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.rs-t :deep(.el-input__wrapper),
.rs-t :deep(.el-input__wrapper.is-focus),
.rs-t :deep(.el-textarea__inner),
.rs-t :deep(.el-textarea__inner:focus) {
  box-shadow: none !important;
  border: none;
  background: transparent;
  padding: 0;
}
.rs-t :deep(.el-input__inner),
.rs-t :deep(.el-textarea__inner) {
  font-size: 13.5px;
  line-height: 1.6;
  padding: 0;
}
.rs-td {
  border: 1px solid #7f7f7f;
  padding: 4px 8px;
  vertical-align: middle;
  background: #fff;
}
.rs-label {
  background: #d9d9d9;
  color: #333;
  text-align: center;
  font-weight: 500;
}
.rs-txt {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.7;
}
.rsp-pre {
  display: block;
  min-height: 60px;
}
.rs-t-in,
.rs-c-in {
  width: 100%;
}

/* ═══ 报告头 ═══ */
.rs-company-cell {
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-style: italic;
  font-size: 17px;
  color: #333;
  padding: 7px 14px !important;
}
.rs-docno {
  text-align: right;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
  font-weight: 600;
  font-style: italic;
  font-size: 14px;
  padding: 6px 14px !important;
  vertical-align: middle;
}
.rs-docno-input {
  width: 160px;
}
.rs-docno-input :deep(.el-input__inner) {
  text-align: right;
  font-style: italic;
  font-family: 'KaiTi', 'STKaiti', 'SimSun', serif;
}
.rs-topic-cell {
  padding: 12px 14px 14px 30px !important;
  vertical-align: middle;
}
.rs-topic {
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #333;
  display: block;
  text-align: center;
}
.rs-topic-input {
  width: 90%;
}
.rs-info-cell {
  padding: 0 !important;
  vertical-align: top !important;
}
.rs-irow {
  display: flex;
  border-bottom: 1px solid #7f7f7f;
  min-height: 34px;
}
.rs-irow:last-child {
  border-bottom: none;
}
.rs-ilabel {
  width: 90px;
  flex: none;
  background: #d9d9d9;
  text-align: center;
  font-size: 13px;
  padding: 5px 4px;
  border-right: 1px solid #7f7f7f;
}
.rs-ivalue {
  flex: 1;
  padding: 5px 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
}
.rs-ivalue :deep(.el-select) {
  width: 100%;
}

/* ═══ 区块粉条 ═══ */
.rs-sectionbar {
  background: #f9dfe2;
  border: 1px solid #7f7f7f;
  border-top: none;
  color: #333;
  font-size: 14px;
  font-weight: 700;
  padding: 5px 10px;
  text-align: center;
}
.rs-t > tbody > tr:first-child .rs-sectionbar {
  border-top: 1px solid #7f7f7f;
}

/* ═══ 条件区特例 ═══ */
.rs-inner {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}
.rs-inner td {
  border-left: 1px solid #7f7f7f;
  border-top: 1px solid #7f7f7f;
  border-bottom: 1px solid #7f7f7f;
}
.rs-inner tr:first-child td {
  border-top: none;
}
.rs-inner td:last-child {
  border-right: none;
}
.rsp-water-zone {
  padding: 0 !important;
}
.rsp-water-label {
  vertical-align: middle;
}
.rs-ind-name {
  text-align: center;
  font-size: 13px;
  color: #333;
  min-width: 86px;
}
.rs-water-val {
  text-align: center;
  min-width: 86px;
}
.rs-water-val :deep(.el-select) {
  width: 64px;
}
.rsp-thin {
  width: 150px;
}
.rsp-item-name {
  text-align: center;
  font-size: 13.5px;
}

/* ═══ 数据记录表 ═══ */
.rs-th {
  border: 1px solid #7f7f7f;
  background: #9c9c9c;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  padding: 6px 4px;
  vertical-align: middle;
  line-height: 1.35;
  word-break: break-all;
  white-space: pre-line;
}
.rs-subhead {
  border: 1px solid #7f7f7f;
  background: #d0cece;
  color: #333;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  padding: 5px 6px;
}
.rs-th-op {
  min-width: 60px;
}
.rs-td-op {
  text-align: center;
  white-space: nowrap;
}
.rs-op-add,
.rs-op-del {
  display: inline-block;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  margin: 0 3px;
}
.rs-op-add {
  color: #0d5bd3;
}
.rs-op-del {
  color: #c0392b;
}
.rs-empty {
  text-align: center;
  color: #98a4b3;
  padding: 14px 0 !important;
}
.rs-add {
  margin: 8px 0 2px;
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
.rs-add:hover {
  background: #e8f2ff;
  border-style: solid;
}
.rs-conclusion {
  padding: 10px 14px !important;
}
.rsp-cell {
  display: block;
  min-height: 20px;
}

/* ═══ 矿化:表+图并排(复刻 Excel 表格在左、散点图在右) ═══ */
.rsp-dt-wrap {
  margin-bottom: 6px;
}
.rsp-dt-wrap.with-chart {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.rsp-dt-wrap.with-chart .rsp-dt-table {
  flex: 0 0 56%;
  min-width: 0;
}
.rsp-chart {
  flex: 1;
  min-width: 0;
  border: 1px solid #b7b7b7;
  background: #fff;
  padding: 6px 4px 2px;
}
.rsp-chart-svg {
  width: 100%;
  display: block;
}
.rsp-chart-title {
  font-size: 13px;
  fill: #333;
  font-weight: 600;
}
.rsp-gridline {
  stroke: #d9d9d9;
  stroke-width: 1;
}
.rsp-tick {
  font-size: 10.5px;
  fill: #666;
}
.rsp-legend {
  font-size: 11px;
  fill: #444;
}
.rsp-nodata {
  font-size: 13px;
  fill: #98a4b3;
}
</style>

<!-- 打印/导出整张文书:只保留文书纸张,隐藏布局菜单/侧栏/其它页面元素 -->
<style>
@media print {
  body.approval-printing .rsp-sheet {
    visibility: visible !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
  }
  body.approval-printing .rsp-sheet,
  body.approval-printing .rsp-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body.approval-printing .rsp-sheet svg {
    display: none !important;
  }
  body.approval-printing .rsp-dt-wrap.with-chart {
    display: block !important;
  }
  body.approval-printing .rs-add,
  body.approval-printing .rs-op-add,
  body.approval-printing .rs-op-del {
    display: none !important;
  }
  @page {
    margin: 8mm;
  }
}
</style>
