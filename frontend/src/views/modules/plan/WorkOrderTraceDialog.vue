<!-- WorkOrderTraceDialog.vue — 工单详情 · 追溯(2026-10-05 抽成共用组件)
     用户口径:「工单详情和追溯放在一起,以工单排产里的追溯为基座」+「在生产工单页也要能这样查看,不是跳转过去」。
     ⇒ 本组件 = **唯一实现**,工单排产页与生产工单页各挂一次(原地打开,不跳转)。
     内容:头 + 工序进度(按该工单工艺路线的步骤条)+ 流转时间线 + 调拨轨迹 + 排产/完工/入库/领料 + 父子单血缘。
     数据:只读 —— /px/scheduleBoard/trace(头/时间线/轨迹/各段) + /px/processTask/detail(工序进度)。
     可撤回:删组件 + 去掉两处引用即回滚(不写任何业务数据)。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('工单详情 · 追溯')" width="92%" top="4vh" append-to-body
             @update:model-value="(v) => emit('update:modelValue', v)">
    <template v-if="trace">
      <div class="wb-trace-head">
        <span class="wb-trace-no">{{ trace['头']?.['加工单号'] || code }}</span>
        <span class="wb-tag" :class="trace['头']?.['单据状态'] === '已审核' ? 'open' : 'closed'">{{ trace['头']?.['单据状态'] }}</span>
        <span v-if="trace['头']?.['结案'] === 'Y'" class="wb-tag off-line">{{ tt('已结案') }}</span>
        <!-- 行级口径(2026-10-15 用户报障「同工单号不同行号显示了之前的数据」):把"看的是哪一行/哪一批"
             摆在最显眼处;未传行 id 时口径=整单,提示用户点行上的追溯。 -->
        <span v-if="trace['头']?.['工单行号']" class="wb-tag wb-tag-line">{{ tt('工单行号') }} {{ trace['头']?.['工单行号'] }}</span>
        <span v-if="trace['头']?.['批次号']" class="wb-tag wb-tag-line">{{ tt('批次号') }} {{ trace['头']?.['批次号'] }}</span>
        <span class="wb-trace-scope">{{ tt('追溯口径') }}：{{ tt(trace['头']?.['追溯口径'] || '整单') }}</span>
      </div>
      <div v-if="trace['口径说明']" class="wb-trace-scope-line">{{ trace['口径说明'] }}</div>
      <div class="wb-trace-desc">
        <span>{{ tt('产品') }}: {{ trace['头']?.['产品编码'] }} {{ trace['头']?.['产品名称'] }}</span>
        <span>{{ tt('规格型号') }}: {{ trace['头']?.['规格型号'] || '-' }}</span>
        <span>{{ tt('客户') }}: {{ trace['头']?.['客户'] || '-' }}</span>
        <span>{{ tt('客户订单号') }}: {{ trace['头']?.['客户订单号'] || '-' }}</span>
        <span>{{ tt('批号') }}: {{ trace['头']?.['批号'] || '-' }}</span>
        <span>{{ tt('生产线') }}: {{ trace['头']?.['生产线'] || tt('未排产') }}</span>
        <span>{{ tt('排产数量') }}: {{ num(trace['头']?.['排产数量']) }}</span>
        <span>{{ tt('入库数量') }}: {{ num(trace['头']?.['入库数量']) }}</span>
        <span>{{ tt('余量') }}: {{ num(trace['头']?.['余量']) }}</span>
      </div>

      <!-- 工序进度:按该工单**工艺路线**渲染的步骤条 -->
      <div v-if="prog" class="wb-trace-block">
        <div class="wb-block-title">
          {{ tt('工序进度') }}
          <span class="wb-trace-sub" style="display: inline; margin-left: 8px">
            {{ tt('工艺路线') }}: {{ prog['表头']?.['工艺路线'] || '-' }}
            ｜ {{ tt('计划数量') }}: {{ num(prog['计划合计']) }}
            ｜ {{ tt('产出') }}: {{ num(prog['产出']) }}（{{ num(prog['表头']?.['进度']) }}%）
            <span v-if="prog['当前工序']">｜ {{ tt('当前工序') }}: {{ tt(prog['当前工序']) }}</span>
            <span v-else>｜ {{ tt('未开工') }}</span>
          </span>
        </div>
        <!-- 步骤状态按**每道工序自己的完成度**着色(2026-10-05 用户口径:未完成/已完成不能同色):
             已完工=绿(success) / 进行中=蓝(process) / 未开始=灰(wait);完成量同时显示 x/计划量 -->
        <el-steps :active="Number(prog['已完成步骤数'] || 0)" align-center finish-status="success">
          <el-step v-for="s in (prog['工序步骤'] || [])" :key="s['工序']" :title="tt(s['工序'])"
                   :status="s['状态'] === '已完工' ? 'success' : (s['状态'] === '进行中' ? 'process' : 'wait')"
                   :description="`${num(s['完工量'])}/${num(s['计划量'])}` + (s['报工单数'] ? `（${s['报工单数']}${tt('单')}）` : '')" />
        </el-steps>
        <div class="wb-trace-sub">
          {{ tt('绿=已完工') }} ｜ {{ tt('蓝=进行中') }} ｜ {{ tt('灰=未开始') }}（{{ tt('工序进度') }}）
        </div>
        <div v-if="!(prog['工序步骤'] || []).length" class="wb-trace-sub">{{ tt('该工单还没有工序进度') }}</div>
      </div>

      <div class="wb-trace-block">
        <div class="wb-block-title">{{ tt('流转时间线') }}</div>
        <el-table :data="trace['时间线']" size="small" border max-height="180">
          <el-table-column :label="tt('步骤')" prop="步骤" width="140" />
          <el-table-column :label="tt('操作人')" prop="操作人" width="140" />
          <el-table-column :label="tt('时间')" prop="时间" min-width="160" />
        </el-table>
      </div>

      <!-- 调拨轨迹(9.29 批次②):每次调拨一行,撤销的也留痕(状态列区分) -->
      <div v-if="(trace['调拨轨迹'] || []).length" class="wb-trace-block">
        <div class="wb-block-title">{{ tt('调拨轨迹') }}</div>
        <el-table :data="trace['调拨轨迹']" size="small" border max-height="180">
          <el-table-column :label="tt('时间')" prop="时间" width="140" />
          <el-table-column :label="tt('从生产线')" prop="从生产线" width="110" />
          <el-table-column :label="tt('从车间')" prop="从车间" width="110" />
          <el-table-column :label="tt('到生产线')" prop="到生产线" width="110" />
          <el-table-column :label="tt('到车间')" prop="到车间" width="110" />
          <el-table-column :label="tt('数量')" prop="数量" width="85" align="right" />
          <el-table-column :label="tt('原因')" prop="原因" min-width="120" show-overflow-tooltip />
          <el-table-column :label="tt('操作人')" prop="操作人" width="90" />
          <el-table-column :label="tt('状态')" prop="状态" width="80" />
          <el-table-column :label="tt('撤销人')" prop="撤销人" width="90" />
          <el-table-column :label="tt('撤销时间')" prop="撤销时间" width="140" />
        </el-table>
      </div>

      <div class="wb-trace-block">
        <div class="wb-block-title">{{ tt('排产数据') }}</div>
        <el-table :data="trace['排产数据']" size="small" border max-height="180">
          <el-table-column :label="tt('生产线')" prop="生产线" width="110" />
          <el-table-column :label="tt('排产数量')" prop="排产数量" width="90" align="right" />
          <el-table-column :label="tt('需求数量')" prop="需求数量" width="90" align="right" />
          <el-table-column :label="tt('入库数量')" prop="入库数量" width="90" align="right" />
          <el-table-column :label="tt('余量')" prop="余量" width="80" align="right" />
          <el-table-column :label="tt('计划开工日')" prop="计划开工日" width="100" />
          <el-table-column :label="tt('工序交期')" prop="工序交期" width="100" />
          <el-table-column :label="tt('生产状态')" prop="生产状态" width="90" />
        </el-table>
      </div>

      <div class="wb-trace-block">
        <div class="wb-block-title">{{ tt('完工数据') }}</div>
        <el-table :data="trace['完工数据']" size="small" border max-height="160" :empty-text="tt('暂无报工')">
          <el-table-column :label="tt('工序')" prop="工序" min-width="120" />
          <el-table-column :label="tt('计划数量')" prop="计划数量" width="100" align="right" />
          <el-table-column :label="tt('完成数量')" prop="完成数量" width="100" align="right" />
          <el-table-column :label="tt('报工人')" prop="报工人" width="120" />
          <el-table-column :label="tt('报工时间')" prop="报工时间" width="150" />
        </el-table>
        <div class="wb-trace-sub">{{ tt('入库单据') }}（{{ (trace['入库单据'] || []).length }}）</div>
        <el-table :data="trace['入库单据']" size="small" border max-height="140" :empty-text="tt('暂无入库')">
          <el-table-column :label="tt('入库单号')" prop="单据编号" width="170" />
          <el-table-column :label="tt('单据日期')" prop="单据日期" width="100" />
          <el-table-column :label="tt('入库类别')" prop="入库类别" width="110" />
          <el-table-column :label="tt('经手人')" prop="经手人" width="110" />
          <el-table-column :label="tt('备注')" prop="备注" min-width="120" />
        </el-table>
      </div>

      <!-- 质检段(2026-10-14 用户口径「工单结束要能对上成品检验单」):三类工序检验单 + 应检/已检/缺检汇总。
           成型 CX / 切炭 QT / 组装成品 ZJ 由**报工审核**自动出单;混料/装箱不出单 ⇒ 应检只看这三道。
           单据状态/结论等值:状态是数据键(中文原样),结论是显示值(走 tt)。 -->
      <div class="wb-trace-block">
        <div class="wb-block-title">
          {{ tt('质检数据') }}
          <span class="wb-trace-sub" style="display: inline; margin-left: 8px">
            {{ tt('应检工序') }}: {{ ops(trace['质检汇总']?.['应检工序']) }}
            ｜ {{ tt('已检工序') }}: {{ ops(trace['质检汇总']?.['已检工序']) }}
            ｜ {{ tt('缺检工序') }}: {{ ops(trace['质检汇总']?.['缺检工序']) }}
            ｜ {{ tt('检验单数') }}: {{ trace['质检汇总']?.['检验单数'] ?? 0 }}
            ｜ {{ tt('结论') }}: {{ tt(trace['质检汇总']?.['结论'] || '-') }}
          </span>
        </div>
        <el-table :data="trace['质检数据'] || []" size="small" border max-height="200" :empty-text="tt('暂无检验单')">
          <el-table-column :label="tt('检验单号')" prop="检验单号" width="150" />
          <el-table-column :label="tt('工序')" prop="工序" width="80" />
          <el-table-column :label="tt('单据状态')" prop="单据状态" width="90" />
          <el-table-column :label="tt('总结论')" prop="总结论" width="90" />
          <el-table-column :label="tt('送检数量')" prop="送检数量" width="95" align="right" />
          <el-table-column :label="tt('检验数量')" prop="检验数量" width="95" align="right" />
          <el-table-column :label="tt('合格数量')" prop="合格数量" width="95" align="right" />
          <el-table-column :label="tt('不合格数量')" prop="不合格数量" width="100" align="right" />
          <el-table-column :label="tt('检验员')" prop="检验员" width="90" />
          <el-table-column :label="tt('检验日期')" prop="检验日期" width="100" />
          <el-table-column :label="tt('批次号')" prop="批次号" width="120" show-overflow-tooltip />
          <el-table-column :label="tt('报工单号')" prop="报工单号" width="140" show-overflow-tooltip />
          <el-table-column :label="tt('处理方式')" prop="处理方式" min-width="140" show-overflow-tooltip />
          <el-table-column :label="tt('下游单号')" prop="下游单号" width="140" show-overflow-tooltip />
        </el-table>
        <div class="wb-trace-sub">
          {{ tt('三类工序检验单由报工审核自动生成；混料/装箱不出检验单') }}
        </div>
      </div>

      <div class="wb-trace-block">
        <div class="wb-block-title">{{ tt('领料数据') }}</div>
        <el-table :data="trace['领料数据']" size="small" border max-height="180" :empty-text="tt('暂无领料')">
          <el-table-column :label="tt('领料单号')" prop="领料单号" width="170" />
          <el-table-column :label="tt('领料日期')" prop="领料日期" width="100" />
          <el-table-column :label="tt('材料编码')" prop="材料编码" width="120" show-overflow-tooltip />
          <el-table-column :label="tt('材料名称')" prop="材料名称" min-width="140" show-overflow-tooltip />
          <el-table-column :label="tt('规格型号')" prop="规格型号" width="110" show-overflow-tooltip />
          <el-table-column :label="tt('单位')" prop="单位" width="55" />
          <el-table-column :label="tt('数量')" prop="数量" width="90" align="right" />
          <el-table-column :label="tt('批号')" prop="批号" width="110" />
        </el-table>
      </div>

      <!-- 血缘(切单父子):追溯原有口径 -->
      <div v-if="(trace['父工单'] || []).length || (trace['子工单'] || []).length" class="wb-trace-block">
        <div class="wb-block-title">{{ tt('血缘') }}</div>
        <el-table v-if="(trace['父工单'] || []).length" :data="trace['父工单']" size="small" border>
          <el-table-column :label="tt('父工单')" prop="工单号" width="160" />
          <el-table-column :label="tt('工单行号')" prop="工单行号" width="90" align="right" />
          <el-table-column :label="tt('排产数量')" prop="排产数量" width="100" align="right" />
          <el-table-column :label="tt('拆分序号')" prop="拆分序号" width="90" align="right" />
        </el-table>
        <el-table v-if="(trace['子工单'] || []).length" :data="trace['子工单']" size="small" border style="margin-top:6px">
          <el-table-column :label="tt('子工单')" prop="工单号" width="160" />
          <el-table-column :label="tt('工单行号')" prop="工单行号" width="90" align="right" />
          <el-table-column :label="tt('排产数量')" prop="排产数量" width="100" align="right" />
          <el-table-column :label="tt('状态')" prop="状态" width="90" />
        </el-table>
      </div>
    </template>
    <div v-else class="wb-trace-sub">{{ tt('加载中…') }}</div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import request from '@core/request'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  code: { type: String, default: '' },
  /** 工单行id(plang.id)—— 追溯**必须**带它:同工单号可有多行/多批次,只按单号取会把别的行的数据带进来
   *  (2026-10-15 用户报障)。不传=整单口径(后端会在「头.追溯口径」里标注)。 */
  行id: { type: [Number, String], default: null },
})
const emit = defineEmits(['update:modelValue'])
const trace = ref(null)
const prog = ref(null)
const num = (v) => { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
/** 工序名数组 → 显示串(逐项过 tt,空则 '-'):成型/切炭/组装 三个工序名在词典里,英文界面随语言切换 */
const ops = (arr) => (arr || []).map((x) => tt(x)).join(' / ') || '-'

async function load() {
  const no = props.code
  if (!no) return
  trace.value = null
  prog.value = null
  try {
    const rowId = props.行id === '' || props.行id === null || props.行id === undefined ? undefined : props.行id
    const [t, p] = await Promise.all([
      request.post('/px/scheduleBoard/trace', { 工单号: no, 工单行id: rowId }),
      request.post('/px/processTask/detail', { 工单号: no }).catch(() => ({ data: null })),
    ])
    trace.value = t.data || {}
    prog.value = p?.data || null
  } catch { trace.value = {} }
}
watch(() => [props.modelValue, props.code, props.行id], ([v]) => { if (v) load() })
</script>

<style scoped>
.wb-trace-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
/* 行级口径标识(2026-10-15):行号/批次胶囊 + 右侧口径 + 下方一段口径说明 */
.wb-tag-line { background: #eef6ff; color: #1e6fb8; border: 1px solid #b9d8f5; border-radius: 10px; padding: 1px 8px; font-size: 12px; }
.wb-trace-scope { font-size: 12px; color: #606266; margin-left: auto; }
.wb-trace-scope-line { font-size: 12px; color: #909399; background: #f4f4f5; border-radius: 4px; padding: 5px 10px; margin-bottom: 8px; }
.wb-trace-no { font-size: 16px; font-weight: 700; color: #1e6fb8; }
.wb-trace-desc { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: #606266; background: #fdf6ec; border: 1px solid #f5dab1; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; }
.wb-trace-block { margin-bottom: 12px; }
.wb-trace-block .wb-block-title { display: block; border-left: 3px solid #1e6fb8; padding-left: 8px; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: #303133; }
.wb-trace-sub { font-size: 12px; color: #909399; margin: 6px 0 4px; }
</style>
