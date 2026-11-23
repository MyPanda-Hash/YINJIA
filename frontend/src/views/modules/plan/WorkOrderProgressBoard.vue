<!--
  WorkOrderProgressBoard.vue — 「生产工序进度看板」(2026-11-08)

  用户口径(2026-11-08 修正):参考图「仅作为参考样式,实际设计风格按照当前的系统实现创建」
   ⇒ 只借参考图的**信息结构**(一行=一张工单行、右侧各道工序的环形/圆点进度、
      工单号/客户/产品/计划数/完工信息这些字段),视觉一律按当前系统既有页面
      (工单排产 WorkOrderBoard / 快速排产 ScheduleBoard / 我的桌面)的浅色 Element Plus 设计语言:
      白底 + 浅灰卡片(#f5f7fa)+ 1px #ebeef5 边框 + 系统色 #67c23a 绿 / #409eff 蓝 / #909399 灰。
      没有深蓝大屏、没有网格光晕、没有发光数字。

  两种视图(用户拍板两种都做,都走浅色系统风):
    · 看板(board,默认):浅色表格式行,每行右侧 = 该行各道工序的环形进度
      (环上工序名 / 环内百分比 / 环下完工量·计划量;已完成绿、进行中蓝、未开始灰,当前工序浅蓝底+蓝描边);
    · 列表(list):现有 el-table 风格,「生产进度」列 = 工序圆点链(同色系,tooltip 给工序 完工量/计划量)。

  🔴 2026-11-08 追加(用户口径:「为当前的看板内容进行增加,产品编码,产品规格,就是把当前生产工单
  主要属性添加进去」):看板改 6 列 —— ①生产工单(号/状态/行号/当前工序/生产线/订单号) ②客户(+客户代码)
  ③产品(名称 + 「产品编码: …」「规格型号: …」显式标签) ④数量(计划数量+生产单位 / 需求·入库·余量)
  ⑤交期(计划完工(主)/计划开工/批次号有值才显示) ⑥完工信息(环形进度不变);
  列表视图同步补 客户/订单号/当前工序/需求数量/入库数量/余量/计划完工日期 列(el-table 允许横向滚动)。

  🔴 2026-11-08 第4轮(用户口径:「生产进度条工单,进行到哪一步,那个环节会提示品质进行检验。
  订单完成状态合格绿色不合格红色」):应检工序(成型/组装)环形进度下加检验徽标(橙=待检验/待审核、
  绿=合格 ✓、红=不合格 ✗、灰=需检;悬停列出检验单号/类型/状态/结论);行内生产状态 tag 旁加质检徽标 +
  「待品质检验: 成型 / 组装」橙色提示(当前工序在待检清单里时加底色);已完工/已结案行的生产状态 tag
  按质检结果着色(合格绿 / 不合格红 / 待检验橙);汇总条加「待品质检验 N 行」;列表视图加「质检状态」列,
  工序圆点链的应检工序点加检验标记(tooltip 带检验状态)。接口未返回检验字段时全部静默降级(不显示、不报错)。

  整行可点击 → /prod/plan/workOrderList?keyword=工单号&focus=行id
  (由生产工单页定位该行并打开追溯,见 WorkOrderList 的 focus 处理)。

  数据:POST /px/workOrderProgress/list(只读;后端 WorkOrderProgressService 复用追溯的
  ProcessTaskService.stepsSummary 口径)。前端只管展示,不写死工序名/工序数量 ——
  「工序步骤」由后端按每行工艺路线给全(3~4 道),工序名走 tt() 显示。
  页面级约束:样式 scoped;所有显示文案走 tt();自动刷新(60s)在 onDeactivated /
  onBeforeUnmount 必须清定时器(配合 PortalLayout 的 keep-alive)。
-->
<template>
  <div class="wpb-page">
    <!-- ===== ① 工具条:标题 + 时钟 + 数据时间 + 视图切换 + 状态/产线筛选 + 搜索 + 刷新 + 自动刷新 ===== -->
    <div class="wpb-toolbar">
      <div class="wpb-head">
        <span class="wpb-title">{{ tt('生产工序进度看板') }}</span>
        <span class="wpb-clock">{{ nowText }}</span>
        <span class="wpb-datatime">
          {{ tt('数据时间') }}<em>{{ dataTime || '-' }}</em>
        </span>
      </div>
      <div class="wpb-controls">
        <el-radio-group v-model="viewMode" size="small" class="wpb-view">
          <el-radio-button value="board">{{ tt('看板') }}</el-radio-button>
          <el-radio-button value="list">{{ tt('列表') }}</el-radio-button>
        </el-radio-group>
        <el-select v-model="statusFilter" size="small" class="wpb-sel" @change="reload">
          <el-option v-for="o in STATUS_OPTIONS" :key="o.value" :label="tt(o.label)" :value="o.value" />
        </el-select>
        <!-- 2026-11-23 用户口径「增加未检验的筛选，然后能看到需要检验和没有检验的」:
             与生产状态分开的第二筛选(全部检验/未检验/已检验)；未检验=待检验+检验中(含缺检)，
             已检验=合格/不合格；无需检验不进这两个桶。 -->
        <el-select v-model="qcFilter" size="small" class="wpb-sel wpb-sel-qc" @change="reload">
          <el-option v-for="o in QC_OPTIONS" :key="o.value" :label="tt(o.label)" :value="o.value" />
        </el-select>
        <el-select v-model="lineFilter" size="small" clearable filterable class="wpb-sel wpb-sel-line"
                   :placeholder="tt('全部生产线')" @change="reload">
          <el-option v-for="l in lineOptions" :key="l" :label="l" :value="l" />
        </el-select>
        <el-input v-model="keyword" size="small" clearable class="wpb-kw"
                  :placeholder="tt('工单号 / 客户 / 产品 关键字')" @keyup.enter="reload" @clear="reload" />
        <el-button size="small" type="primary" :loading="loading" class="wpb-refresh" @click="reload">
          <el-icon><Refresh /></el-icon>
          <span>{{ tt('刷新') }}</span>
        </el-button>
        <span class="wpb-auto">
          <el-switch v-model="autoRefresh" size="small" />
          <span class="wpb-auto-label">{{ tt('自动刷新') }}</span>
          <em v-if="autoRefresh">{{ tt('每 60 秒') }}</em>
        </span>
      </div>
    </div>

    <!-- ===== ② 汇总条(与现有看板页的汇总条同款浅灰底) ===== -->
    <div class="wpb-stats">
      <span class="wpb-stat">
        <em>{{ tt('工单行数') }}</em><b>{{ stat.total }}</b>
      </span>
      <span class="wpb-stat is-undone">
        <em>{{ tt('未完工行数') }}</em><b>{{ stat.undone }}</b>
      </span>
      <span class="wpb-stat is-done">
        <em>{{ tt('已完工行数') }}</em><b>{{ stat.done }}</b>
      </span>
      <span class="wpb-stat is-avg">
        <em>{{ tt('平均进度') }}</em><b>{{ stat.avg }}<i>%</i></b>
      </span>
      <!-- 2026-11-08 第4轮:待品质检验行数(取接口 汇总.待检验行数;旧接口无该字段时按行内 待检验工序 兜底) -->
      <span class="wpb-stat is-qc">
        <em>{{ tt('待品质检验') }}</em><b>{{ stat.qcWaiting }}<i>{{ tt('行') }}</i></b>
      </span>
      <span class="wpb-legend">
        <i class="lg lg-done">{{ tt('绿=已完成') }}</i>
        <i class="lg lg-doing">{{ tt('蓝=进行中') }}</i>
        <i class="lg lg-idle">{{ tt('灰=未开始') }}</i>
      </span>
      <!-- 2026-11-13(契约 §5):汇总条右侧提示改成「行 / 工序 / 检验标记」三处可点的完整说明 -->
      <span class="wpb-tip">{{ tt('点击行可跳转到生产工单并定位该工单；点击工序跳转到该工序排产，点击检验标记打开检验单') }}</span>
    </div>

    <!-- 刷新失败但仍有旧数据:保留数据,顶部给一条可读提示(既有数据不清空) -->
    <el-alert v-if="error && rows.length" class="wpb-alert" type="error" :closable="false" show-icon
              :title="`${tt('加载失败')}: ${error}`" />

    <!-- ===== ③ 看板视图:浅色表格式行 + 环形工序进度(6 列:工单/客户/产品/数量/交期/完工信息) ===== -->
    <section v-if="viewMode === 'board'" class="wpb-board">
      <header class="wpb-grid wpb-grid-head">
        <span>{{ tt('生产工单') }}</span>
        <span>{{ tt('客户') }}</span>
        <span>{{ tt('产品') }}</span>
        <span>{{ tt('数量') }}</span>
        <span>{{ tt('交期') }}</span>
        <span class="wpb-head-ops">
          {{ tt('完工信息') }}<em>{{ tt('完工量/计划量') }}</em>
        </span>
      </header>
      <div class="wpb-grid-body" v-loading="loading">
        <div v-if="error && !rows.length" class="wpb-state">
          <el-icon class="wpb-state-ic"><WarningFilled /></el-icon>
          <p class="wpb-state-title">{{ tt('加载失败') }}</p>
          <p class="wpb-state-sub">{{ error }}</p>
          <el-button size="small" plain @click="reload">{{ tt('重试') }}</el-button>
        </div>
        <div v-else-if="!loading && !rows.length" class="wpb-state">
          <el-icon class="wpb-state-ic"><Tickets /></el-icon>
          <p class="wpb-state-title">{{ tt('没有符合条件的工单行') }}</p>
          <p class="wpb-state-sub">{{ tt('调整筛选条件后重试') }}</p>
        </div>
        <div v-for="row in rows" :key="rowKey(row)" class="wpb-grid wpb-grid-row"
             role="button" tabindex="0" :title="tt('点击查看工单详情')"
             @click="openRow(row)"
             @keydown.enter.prevent="openRow(row)"
             @keydown.space.prevent="openRow(row)">
          <!-- ① 生产工单:工单号 + 生产状态 / 工单行号 + 当前工序 / 生产线 / 订单号(带 #行号) -->
          <div class="wpb-cell">
            <div class="wpb-no-row">
              <span class="wpb-no" :title="row['工单号']">{{ row['工单号'] || '-' }}</span>
              <!-- 已完工/已结案行的生产状态 tag 按质检结果着色(合格绿/不合格红/待检验橙),见 metaOf() -->
              <span class="wpb-status" :class="'tone-' + metaOf(row).tone">{{ tt(metaOf(row).label) }}</span>
              <!-- 行级质检徽标(2026-11-08 第4轮):生产状态 tag 旁 -->
              <span v-if="qcBadgeText(row)" class="wpb-qc" :class="'tone-' + qcTone(row)">{{ qcBadgeText(row) }}</span>
            </div>
            <div class="wpb-meta-line">
              <span class="wpb-pill">{{ tt('工单行号') }} {{ row['工单行号'] ?? '-' }}</span>
              <span class="wpb-cur">{{ tt('当前工序') }}: {{ row['当前工序'] ? tt(row['当前工序']) : '-' }}</span>
            </div>
            <div v-if="row['生产线']" class="wpb-meta-line wpb-ellipsis" :title="row['生产线']">
              {{ tt('生产线') }}: {{ row['生产线'] }}
            </div>
            <div v-if="row['订单号']" class="wpb-meta-line wpb-ellipsis" :title="orderText(row)">
              {{ tt('订单号') }}: {{ orderText(row) }}
            </div>
            <!-- 品质提示(2026-11-08 第4轮):走到应检工序时提示品质去检验;当前工序就在待检清单里时加底色更醒目
                 2026-11-13(契约 §4):提示条本身可点 → 打开第一条待检验/待审核且有单据的工序的检验单;
                 整行点击行为不变,所以这里必须 stop(否则会连带跳生产工单) -->
            <div v-if="pendingOps(row).length" class="wpb-qc-hint is-clickable"
                 :class="{ hot: pendingHot(row) }" role="button" tabindex="0"
                 :title="`${tt('待品质检验')}: ${pendingOpsText(row)} · ${tt('点击查看检验单')}`"
                 @click.stop="onQcHintClick(row)"
                 @keydown.enter.stop.prevent="onQcHintClick(row)"
                 @keydown.space.stop.prevent="onQcHintClick(row)">
              {{ tt('待品质检验') }}: {{ pendingOpsText(row) }}
            </div>
          </div>
          <!-- ② 客户:名称 + 客户代码 -->
          <div class="wpb-cell">
            <div class="wpb-cust" :title="row['客户']">{{ row['客户'] || '-' }}</div>
            <div v-if="row['客户代码']" class="wpb-kv wpb-ellipsis" :title="row['客户代码']">{{ row['客户代码'] }}</div>
          </div>
          <!-- ③ 产品:名称 + 产品编码 / 规格型号(显式标签,用户点名要加) -->
          <div class="wpb-cell">
            <div class="wpb-prod" :title="row['产品名称']">{{ row['产品名称'] || '-' }}</div>
            <div class="wpb-kv wpb-ellipsis" :title="row['产品编码']">
              {{ tt('产品编码') }}: <em>{{ row['产品编码'] || '-' }}</em>
            </div>
            <div class="wpb-kv wpb-ellipsis" :title="row['规格型号']">
              {{ tt('规格型号') }}: <em>{{ row['规格型号'] || '-' }}</em>
            </div>
          </div>
          <!-- ④ 数量:计划数量(主)/ 需求·入库·余量 / 生产单位 -->
          <div class="wpb-cell">
            <div class="wpb-qty-row">
              <b class="wpb-qty">{{ num(row['计划数量']) }}</b>
              <span v-if="row['生产单位']" class="wpb-unit">{{ row['生产单位'] }}</span>
            </div>
            <div class="wpb-kv">{{ tt('需求数量') }}: <em>{{ num(row['需求数量']) }}</em></div>
            <div class="wpb-kv">{{ tt('入库数量') }}: <em>{{ num(row['入库数量']) }}</em></div>
            <!-- 「余量」已隐藏(2026-11-08 用户口径「当前的看板也有这个也隐藏了」):该口径是
                 本工单行需求 − 本行订单占用(form_flow_link SO→PLANG),新口径下恒为 0
                 (正式库 399 行里 397 行为 0)、与"当前工序还剩多少未生产"无关,极易误读;
                 要看剩余请用本卡⑥的工序环形进度/完工量,或生产工单页的工序进度。要恢复:放开下面一行。 -->
            <!-- <div class="wpb-kv">{{ tt('余量') }}: <em :class="remainClass(row)">{{ num(row['余量']) }}</em></div> -->
          </div>
          <!-- ⑤ 交期:计划完工日期(主)/ 计划开工日期 / 批次号(有值时) -->
          <div class="wpb-cell">
            <div class="wpb-date" :title="row['计划完工日期']">{{ row['计划完工日期'] || '-' }}</div>
            <div class="wpb-kv wpb-ellipsis" :title="row['计划开工日期']">
              {{ tt('计划开工日期') }}: <em>{{ row['计划开工日期'] || '-' }}</em>
            </div>
            <div v-if="row['批次号']" class="wpb-kv wpb-ellipsis" :title="row['批次号']">
              {{ tt('批次号') }}: <em>{{ row['批次号'] }}</em>
            </div>
          </div>
          <!-- ⑥ 完工信息:该行各道工序的环形进度(4 道时允许 wrap,不横向溢出)
               2026-11-13(契约 §3.1/§3.2):环可点 → 该工序排产;环下检验徽标可点 → 该工序检验单 -->
          <div class="wpb-cell wpb-ops">
            <template v-if="stepsOf(row).length">
              <WoProgressRing v-for="(s, i) in stepsOf(row)" :key="i" :step="s" :size="ringSize"
                              @step-click="onStepClick(row, $event)"
                              @insp-click="onInspClick(row, $event)" />
            </template>
            <span v-else class="wpb-ops-empty">{{ tt('未排产') }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== ④ 列表视图:现有 el-table 风格 + 工序圆点链 ===== -->
    <section v-else class="wpb-list">
      <div class="wpb-table-wrap">
        <el-table :data="rows" size="small" border height="100%" class="wpb-table" :row-key="rowKey"
                  :row-class-name="rowClass" @row-click="openRow">
          <template #empty>
            <div class="wpb-list-empty">
              <p class="wpb-list-empty-title">{{ error ? tt('加载失败') : tt('没有符合条件的工单行') }}</p>
              <p class="wpb-list-empty-sub">{{ error || tt('调整筛选条件后重试') }}</p>
              <el-button v-if="error" size="small" plain @click="reload">{{ tt('重试') }}</el-button>
            </div>
          </template>
          <el-table-column :label="tt('工单编号')" min-width="170">
            <template #default="{ row }">
              <div class="wpb-l-no">{{ row['工单号'] || '-' }}</div>
              <div class="wpb-l-sub">{{ tt('工单行号') }} {{ row['工单行号'] ?? '-' }}</div>
            </template>
          </el-table-column>
          <el-table-column :label="tt('工单状态')" width="90" align="center">
            <template #default="{ row }">
              <!-- 已完工/已结案行按质检结果着色:合格绿/不合格红/待检验橙(用户口径「订单完成状态合格绿色不合格红色」) -->
              <el-tag size="small" effect="light" :type="tagType(row)">{{ tt(metaOf(row).label) }}</el-tag>
            </template>
          </el-table-column>
          <!-- 质检状态(2026-11-08 第4轮):合格绿/不合格红/待检验·检验中橙/无需检验灰 -->
          <el-table-column :label="tt('质检状态')" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="qcStatus(row)" size="small" effect="light" :type="qcTagType(row)">{{ tt(qcStatus(row)) }}</el-tag>
              <span v-else class="wpb-l-sub">-</span>
            </template>
          </el-table-column>
          <!-- 2026-11-08 追加:生产工单主要属性(客户/订单号/当前工序/需求·入库·余量/计划完工) -->
          <el-table-column :label="tt('客户')" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row['客户'] || '-' }}</template>
          </el-table-column>
          <el-table-column :label="tt('订单号')" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ orderText(row) || '-' }}</template>
          </el-table-column>
          <el-table-column :label="tt('当前工序')" width="100" align="center">
            <template #default="{ row }">{{ row['当前工序'] ? tt(row['当前工序']) : '-' }}</template>
          </el-table-column>
          <el-table-column :label="tt('生产进度')" min-width="300">
            <template #default="{ row }">
              <!-- 2026-11-13(契约 §3.1/§3.2):圆点 → 该工序排产;右上角检验小点 → 该工序检验单 -->
              <WoProgressChain :steps="stepsOf(row)"
                               @step-click="onStepClick(row, $event)"
                               @insp-click="onInspClick(row, $event)" />
            </template>
          </el-table-column>
          <el-table-column :label="tt('产品编号')" prop="产品编码" width="110" show-overflow-tooltip />
          <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="160" show-overflow-tooltip />
          <el-table-column :label="tt('产品规格')" prop="规格型号" min-width="140" show-overflow-tooltip />
          <el-table-column :label="tt('计划数')" width="96" align="right">
            <template #default="{ row }">{{ num(row['计划数量']) }}</template>
          </el-table-column>
          <el-table-column :label="tt('需求数量')" width="100" align="right">
            <template #default="{ row }">{{ num(row['需求数量']) }}</template>
          </el-table-column>
          <el-table-column :label="tt('入库数量')" width="100" align="right">
            <template #default="{ row }">{{ num(row['入库数量']) }}</template>
          </el-table-column>
          <!-- 「余量」列已隐藏(2026-11-08 用户口径,口径说明见卡片区注释);要恢复:放开下面 5 行 -->
          <!--
          <el-table-column :label="tt('余量')" width="100" align="right">
            <template #default="{ row }">
              <span :class="remainClass(row)">{{ num(row['余量']) }}</span>
            </template>
          </el-table-column>
          -->
          <el-table-column :label="tt('计划完工日期')" width="120" align="center">
            <template #default="{ row }">{{ row['计划完工日期'] || '-' }}</template>
          </el-table-column>
        </el-table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Tickets, WarningFilled } from '@element-plus/icons-vue'
import request from '@core/request'
import { tt } from '@/i18n'
import WoProgressRing from './WoProgressRing.vue'
import WoProgressChain from './WoProgressChain.vue'

defineOptions({ name: 'WorkOrderProgressBoard' })

/** 后端只读接口(契约见 task:请求体所有条件可空) */
const API_LIST = '/px/workOrderProgress/list'
/** 产线下拉复用快速排产页的汇总接口;取不到不阻塞(失败静默) */
const API_LINES = '/px/scheduleBoard/linesSummary'
const AUTO_REFRESH_MS = 60 * 1000

/** 状态筛选:值与后端约定一致(未完工/已完工/全部) */
const STATUS_OPTIONS = [
  { value: '未完工', label: '未完工' },
  { value: '已完工', label: '已完工' },
  { value: '全部', label: '全部' },
]

/** 检验状态筛选(2026-11-23):'全部检验' 不下发;其余原样给后端 检验状态。 */
const QC_OPTIONS = [
  { value: '全部', label: '全部检验' },
  { value: '未检验', label: '未检验' },
  { value: '已检验', label: '已检验' },
]

/**
 * 生产状态 → 展示档位。后端行上的「生产状态」是四态+结案:
 * 未排产 / 未完工 / 在产 / 完工 / 已结案;「完工」按用户口径显示成「已完工」。
 * tone 同时给看板状态胶囊与列表 el-tag 用(一个来源,避免两处配色漂移)。
 */
const STATUS_META = {
  未排产: { tone: 'info', label: '未排产', tag: 'info' },
  未完工: { tone: 'warn', label: '未完工', tag: 'warning' },
  在产: { tone: 'doing', label: '在产', tag: 'primary' },
  完工: { tone: 'done', label: '已完工', tag: 'success' },
  已结案: { tone: 'muted', label: '已结案', tag: 'info' },
}

/* ===== 检验类型 → 面板码(2026-11-13 契约 §3.2:唯一映射,只写这一处) =====
   键 = 后端下发的检验类型显示名(数据键中文,不随语言变化,故不包 tt());
   值 = 面板引擎面板码。「出货检验表观」2026-11-11 前叫「组装成品检验」,两个名字都认。 */
const INSP_PANEL_BY_TYPE = {
  首件检验: 'QC_FIRST_INSP',
  制程检验: 'QC_PROC_INSP',
  出货检验表观: 'QC_ASM_INSP',
  组装成品检验: 'QC_ASM_INSP',
}
/** 检验类型显示名 → 面板码;不在映射内返回 ''(调用方按「暂无检验单」静默处理,不猜面板) */
function panelCodeOf(inspType) {
  const type = String(inspType || '').trim()
  return INSP_PANEL_BY_TYPE[type] || ''
}

const router = useRouter()

const viewMode = ref('board') // 默认看板(两种视图都保留,用户拍板)
const statusFilter = ref('未完工')
const qcFilter = ref('全部')
const lineFilter = ref('')
const keyword = ref('')
const autoRefresh = ref(true) // 看板常态 = 开着自动刷新;切走/卸载时清定时器

const rows = ref([])
const summary = ref({})
const dataTime = ref('')
const loading = ref(false)
const error = ref('')
const lines = ref([])
const nowText = ref('')
/**
 * 环形进度尺寸(2026-11-08 追加主属性后看板改 6 列,完工信息列变窄):
 * 1392 CSS 宽(内容 1146)时完工信息列约 290px,4 道工序环必须放得下 ⇒ 窄屏用 60;
 * 宽屏(≥1600)回到 72。按窗口宽度切换,resize 时同步(见 onMounted/onBeforeUnmount)。
 */
const ringSize = ref(72)

let loadSeq = 0 // 丢弃过期响应(连点筛选/自动刷新与手动刷新并发时)
let refreshTimer = 0
let clockTimer = 0
let firstActivate = true // keep-alive 首次挂载时 onMounted 已取数,避免 onActivated 再取一次

/** 本机日期(YYYY-MM-DD,用于产线汇总接口的开工日期;不走 toISOString 免 UTC 退一天) */
function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function reload() {
  load()
}

/** 取数:silent=true 时不清空旧数据、不弹 loading(自动刷新用,尽量不打断观看) */
async function load(opts = {}) {
  const silent = opts && opts.silent === true
  const seq = ++loadSeq
  if (!silent) loading.value = true
  error.value = ''
  const payload = { 状态: statusFilter.value, limit: 300 }
  if (qcFilter.value && qcFilter.value !== '全部') payload['检验状态'] = qcFilter.value
  const kw = keyword.value.trim()
  if (kw) payload.keyword = kw
  if (lineFilter.value) payload['生产线'] = lineFilter.value
  try {
    const res = await request.post(API_LIST, payload)
    if (seq !== loadSeq) return
    if (!res || res.code !== 200) throw new Error(res?.message || tt('请求失败'))
    const data = res.data || {}
    rows.value = Array.isArray(data['行']) ? data['行'] : []
    summary.value = data['汇总'] || {}
    dataTime.value = data['数据时间'] || ''
  } catch (e) {
    if (seq !== loadSeq) return
    const msg = e?.response?.data?.message || e?.message || tt('请求失败')
    error.value = msg
    if (!silent) {
      rows.value = []
      summary.value = {}
    }
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

/** 产线下拉:复用 /px/scheduleBoard/linesSummary;失败静默(不阻塞看板),再用数据里的产线兜底 */
async function loadLines() {
  try {
    const res = await request.post(API_LINES, { 开工日期: todayStr() })
    const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
    const names = [...new Set(data.map((x) => x?.['生产线']).filter(Boolean))]
    if (names.length) lines.value = names
  } catch {
    /* 产线清单只用于筛选:取不到就不给下拉项,页面照常按状态/关键字查 */
  }
}

/** 下拉选项:接口给的产线优先;取不到时用当前数据里出现过的产线兜底(仍可筛选) */
const lineOptions = computed(() => {
  if (lines.value.length) return lines.value
  return [...new Set(rows.value.map((r) => r?.['生产线']).filter(Boolean))]
})

/** 汇总口径:后端「汇总」优先,缺字段时按当前行就地算(空数据时显示 0 而不是空白) */
const stat = computed(() => {
  const s = summary.value || {}
  const list = rows.value || []
  const isDone = (r) => String(r?.['生产状态'] || '').includes('完工')
  const total = Number(s['行数'] ?? list.length) || 0
  const undone = Number(s['未完工行数'] ?? list.filter((r) => !isDone(r)).length) || 0
  const done = Number(s['已完工行数'] ?? list.filter(isDone).length) || 0
  const avg = Number(s['平均进度'] ?? 0) || 0
  // 2026-11-08 第4轮:待品质检验行数(旧接口无 待检验行数 字段时按行内 待检验工序 兜底)
  const qcWaiting = Number(s['待检验行数'] ?? list.filter((r) => pendingOps(r).length).length) || 0
  return { total, undone, done, avg: Math.round(avg * 10) / 10, qcWaiting }
})

/** 表格/列表行 key:行id 是行级唯一键;没有 id 时退化到 工单号#行号 */
function rowKey(row) {
  if (!row) return ''
  return String(row['行id'] ?? `${row['工单号'] || ''}#${row['工单行号'] ?? 0}`)
}

function stepsOf(row) {
  const s = row?.['工序步骤']
  return Array.isArray(s) ? s : []
}

/* ===== 质检(2026-11-08 第4轮新增;接口字段缺失时全部静默降级,不显示徽标、不报错) ===== */

/** 行级质检状态:合格|不合格|待检验|检验中|无需检验;缺字段返回 '' */
function qcStatus(row) {
  return String(row?.['质检状态'] || '').trim()
}

/** 质检状态 → 颜色档位(done 绿 / danger 红 / warn 橙);无需检验/缺失返回 '' */
function qcTone(row) {
  const s = qcStatus(row)
  if (s === '合格') return 'done'
  if (s === '不合格') return 'danger'
  if (s === '待检验' || s === '检验中') return 'warn'
  return ''
}

/** 行级质检徽标文案:只需显示合格/不合格/待检验/检验中;无需检验与缺字段不显示 */
function qcBadgeText(row) {
  const s = qcStatus(row)
  return s === '合格' || s === '不合格' || s === '待检验' || s === '检验中' ? tt(s) : ''
}

/** 列表「质检状态」列的 el-tag 类型 */
function qcTagType(row) {
  const s = qcStatus(row)
  if (s === '合格') return 'success'
  if (s === '不合格') return 'danger'
  if (s === '待检验' || s === '检验中') return 'warning'
  return 'info'
}

/** 已完工 / 已结案的行(用户口径:这类行的状态色按质检结果走 合格绿 / 不合格红 / 待检验橙) */
function isFinishedRow(row) {
  const st = String(row?.['生产状态'] || '')
  return st.includes('完工') || st.includes('结案') || row?.['结案'] === 'Y'
}

function metaOf(row) {
  const st = String(row?.['生产状态'] || '').trim()
  const meta = STATUS_META[st] || (st.includes('完工') ? STATUS_META['完工'] : STATUS_META['未完工'])
  const qc = qcTone(row)
  // 已完工/已结案行:状态 tag 跟着质检结果着色(合格绿 / 不合格红 / 待检验橙),文案仍是生产状态
  if (qc && isFinishedRow(row)) return { ...meta, tone: qc }
  return meta
}

function tagType(row) {
  const meta = metaOf(row)
  const qc = qcTone(row)
  // el-tag 的类型词与 tone 不同名(tone-done ↔ success)
  if (qc && isFinishedRow(row)) return qc === 'done' ? 'success' : qc === 'danger' ? 'danger' : 'warning'
  return meta.tag
}

/** 行级待检验工序(数组;缺字段返回空数组) */
function pendingOps(row) {
  const v = row?.['待检验工序']
  return Array.isArray(v) ? v.filter(Boolean) : []
}

/** 待检验工序显示文本(工序名走 tt,分隔用 /) */
function pendingOpsText(row) {
  return pendingOps(row).map((x) => tt(x)).join(' / ')
}

/** 当前工序是否就在待检验清单里 —— 是则品质提示加底色、更醒目 */
function pendingHot(row) {
  const cur = String(row?.['当前工序'] || '').trim()
  return !!cur && pendingOps(row).includes(cur)
}

/** 订单号展示:有订单行号时追加 #N(用户口径:「订单号(有订单行号时 #N)」) */
function orderText(row) {
  const no = String(row?.['订单号'] || '').trim()
  if (!no) return ''
  const line = row?.['订单行号']
  const hasLine = line !== null && line !== undefined && String(line).trim() !== ''
  return hasLine ? `${no} #${line}` : no
}

/** 余量着色:>0 常规(系统正文色),=0 灰色,<0 系统警告色(与生产工单列表口径一致) */
function remainClass(row) {
  const v = Number(row?.['余量'] || 0)
  if (v > 0) return 'wpb-remain'
  if (v < 0) return 'wpb-remain is-neg'
  return 'wpb-remain is-zero'
}

/** 环尺寸跟随窗口宽度:窄屏(1392)要保证 4 道工序环不换行占两排 */
function syncRingSize() {
  ringSize.value = (window.innerWidth || 1920) >= 1600 ? 72 : 60
}

/** 整行点击:跳到生产工单列表,带 工单号 关键字 + 行id 定位(生产工单页负责滚动/弹追溯) */
function openRow(row) {
  const no = row?.['工单号']
  if (!no) return
  router.push({
    path: '/prod/plan/workOrderList',
    query: { keyword: String(no), focus: String(row['行id'] ?? '') },
  })
}

/* ===== 工序 / 检验单点击跳转(2026-11-13,契约 CONTRACT.md §3.1/§3.2/§4) =====
   子组件只发事件(step-click / insp-click),判定与提示全部在这里做:
     · 点工序 → 未排产/未到达就只提示;否则跳工单排产页并定位该工单行的该道工序;
     · 点检验徽标/待检验提示 → 选一张检验单跳面板引擎列表(applyDocNoQuery 定位到该单)。
   全部字段按「缺失即静默降级」处理:step.生产线 空就回退 row.生产线,不抛错、不显示 undefined。 */

/** 待处理(优先跳这张)的检验单据状态 */
const INSP_PENDING_STATES = ['草稿', '审批中']
/** 算「品质待处理」的工序检验状态 */
const QC_PENDING_STATES = ['待检验', '待审核']
/** 检验单号比较:纯数字按数值比(避免 '9' > '10' 的字典序错),否则按自然序比较 */
const inspNoCollator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
function compareInspDocNo(a, b) {
  const x = String(a?.['检验单号'] ?? '').trim()
  const y = String(b?.['检验单号'] ?? '').trim()
  if (x !== '' && y !== '') {
    const nx = Number(x)
    const ny = Number(y)
    if (Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny
  }
  return inspNoCollator.compare(x, y)
}

/** 工序的检验单据数组(接口未给 / 结构不对时返回空数组,界面静默降级) */
function inspDocsOf(step) {
  const docs = step?.['检验']?.['单据']
  return Array.isArray(docs) ? docs.filter((d) => d && typeof d === 'object') : []
}

/**
 * 选哪张检验单:优先「单据状态 ∈ {草稿,审批中}」的待处理单,没有则取检验单号最大的那张。
 * 无单据返回 null。
 */
function pickInspDoc(step) {
  const docs = inspDocsOf(step)
  if (!docs.length) return null
  const pending = docs.filter((d) => INSP_PENDING_STATES.includes(String(d?.['单据状态'] || '').trim()))
  const pool = pending.length ? pending : docs
  return pool.slice().sort((a, b) => compareInspDocNo(b, a))[0]
}

/** 检验单的检验类型显示名:单据自带优先,缺失回退 step.检验.类型[0](字段不全时静默) */
function inspTypeOf(doc, step) {
  const type = String(doc?.['检验类型'] || '').trim()
  if (type) return type
  const list = step?.['检验']?.['类型']
  return Array.isArray(list) && list.length ? String(list[0] || '').trim() : ''
}

/** 打开某道工序的检验单:选单 → 检验类型映射面板码 → /panelx/list/<面板码>?docNo=<单号> */
function openInspDoc(step) {
  const doc = pickInspDoc(step)
  const no = String(doc?.['检验单号'] ?? '').trim()
  // 单据缺失、单号缺失、检验类型不在契约映射内:都按「暂无检验单」提示,不盲目打开错面板
  const panelCode = panelCodeOf(inspTypeOf(doc, step))
  if (!doc || !no || !panelCode) {
    ElMessage.warning(tt('该工序暂无检验单'))
    return
  }
  router.push(`/panelx/list/${panelCode}?docNo=${encodeURIComponent(no)}`)
}

/**
 * 点工序(看板环 / 列表圆点):按契约 §4 判定
 *   ① 未排产 或 行.生产线 为空 → 该工单未进行排产
 *   ② 完工量<=0 且 待审量<=0(进度 0% 且没有草稿报工) → 该工序未到达
 *   ③ 否则跳 /prod/plan/workOrderBoard?line&wo&rowid&op
 */
function onStepClick(row, step) {
  if (!step || typeof step !== 'object') return
  const prodStatus = String(row?.['生产状态'] || '').trim()
  const rowLine = String(row?.['生产线'] || '').trim()
  if (prodStatus === '未排产' || !rowLine) {
    ElMessage.warning(tt('该工单未进行排产'))
    return
  }
  if (Number(step['完工量'] || 0) <= 0 && Number(step['待审量'] || 0) <= 0) {
    ElMessage.warning(tt('该工序未到达'))
    return
  }
  // step.生产线 由后端新增,暂未就绪或为空时回退 行.生产线(静默降级,不出现 undefined)
  const line = String(step['生产线'] || '').trim() || rowLine
  router.push({
    path: '/prod/plan/workOrderBoard',
    query: {
      line,
      wo: String(row?.['工单号'] ?? ''),
      rowid: String(row?.['行id'] ?? ''),
      op: String(step['工序'] ?? ''),
    },
  })
}

/** 点检验徽标(环下徽标 / 列表圆点右上角小点):有单按 §3.2 跳,无单提示 */
function onInspClick(row, step) {
  openInspDoc(step)
}

/**
 * 点行级「待品质检验: 成型 / 组装」提示条(契约 §4 最后一条):
 * 打开第一条「检验状态 ∈ {待检验,待审核} 且 有单据」的工序的检验单;一条都没有则提示。
 */
function onQcHintClick(row) {
  const hit = stepsOf(row).find((s) => {
    const state = String(s?.['检验']?.['状态'] || '').trim()
    return QC_PENDING_STATES.includes(state) && inspDocsOf(s).length > 0
  })
  if (!hit) {
    ElMessage.warning(tt('该工序暂无检验单'))
    return
  }
  openInspDoc(hit)
}

/** 列表模式 el-table 行样式(整行可点击) */
function rowClass() {
  return 'wpb-row-clickable'
}

/** 数字显示:整数千分位;非整数保留 2 位(数量单位是件,报表里也这么显示) */
function num(v) {
  const n = Number(v || 0)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? n.toLocaleString('en-US') : String(Math.round(n * 100) / 100)
}

/** 顶部时钟(看板固定信息:现在几点 + 数据是什么时候取的) */
function tickClock() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  nowText.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function startTimers() {
  stopTimers()
  tickClock()
  clockTimer = window.setInterval(tickClock, 1000)
  if (autoRefresh.value) {
    refreshTimer = window.setInterval(() => load({ silent: true }), AUTO_REFRESH_MS)
  }
}

/** 卸载/切走/关自动刷新都要清干净 —— 否则 keep-alive 下定时器会在后台一直跑 */
function stopTimers() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer)
    refreshTimer = 0
  }
  if (clockTimer) {
    window.clearInterval(clockTimer)
    clockTimer = 0
  }
}

watch(autoRefresh, () => startTimers())

onMounted(() => {
  syncRingSize()
  window.addEventListener('resize', syncRingSize)
  load()
  loadLines()
  startTimers()
})

/** keep-alive:页面切回来 → 重启定时器,并静默对齐一次数据;首次激活不重复取数 */
onActivated(() => {
  syncRingSize()
  startTimers()
  if (firstActivate) {
    firstActivate = false
    return
  }
  load({ silent: true })
})

onDeactivated(stopTimers)
onBeforeUnmount(() => {
  stopTimers()
  window.removeEventListener('resize', syncRingSize)
})
</script>

<style scoped>
/* ===== 页面骨架:与现有模块页一致(浅灰底 + 白卡片 + 8px 间距) ===== */
.wpb-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 460px;
  box-sizing: border-box;
  padding: 10px 14px;
  overflow: hidden;
  background: #f9f9f9;
}

/* ===== ① 工具条(同 ScheduleBoard .sb-bar / WorkOrderList .wol-query 的浅色卡片) ===== */
.wpb-toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}
.wpb-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}
.wpb-title {
  color: #303133;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}
.wpb-clock,
.wpb-datatime {
  color: #909399;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.wpb-datatime em {
  margin-left: 4px;
  color: #606266;
  font-style: normal;
}
.wpb-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.wpb-sel {
  width: 104px;
}
.wpb-sel-line {
  width: 150px;
}
.wpb-kw {
  width: 220px;
}
.wpb-auto {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #606266;
  font-size: 12px;
  white-space: nowrap;
}
.wpb-auto em {
  color: #909399;
  font-style: normal;
}

/* ===== ② 汇总条(浅灰卡片) ===== */
.wpb-stats {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 22px;
  padding: 8px 14px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
.wpb-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.wpb-stat em {
  color: #909399;
  font-size: 12px;
  font-style: normal;
}
.wpb-stat b {
  color: #303133;
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.wpb-stat b i {
  margin-left: 1px;
  font-size: 11px;
  font-style: normal;
}
.wpb-stat.is-undone b {
  color: #e6a23c;
}
.wpb-stat.is-done b {
  color: #67c23a;
}
.wpb-stat.is-avg b {
  color: #409eff;
}
/* 待品质检验 N 行(2026-11-08 第4轮):有量时橙色提醒;数字与「行」留一点间距(英文行数复数更清晰) */
.wpb-stat.is-qc b {
  color: #e6a23c;
}
.wpb-stat.is-qc b i {
  margin-left: 3px;
}
.wpb-legend {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.wpb-legend .lg {
  color: #909399;
  font-size: 12px;
  font-style: normal;
}
.wpb-legend .lg::before {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 4px;
  border-radius: 50%;
  background: #c0c4cc;
  vertical-align: middle;
  content: '';
}
.wpb-legend .lg-done::before {
  background: #67c23a;
}
.wpb-legend .lg-doing::before {
  background: #409eff;
}
.wpb-legend .lg-idle::before {
  background: #c0c4cc;
}
.wpb-tip {
  margin-left: auto;
  color: #a3aab6;
  font-size: 12px;
}

.wpb-alert {
  flex: none;
}

/* ===== ③ 看板视图:白卡片 + 浅灰表头 + 行分隔线 ===== */
.wpb-board {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}
/* 表头/行共用列宽(2026-11-08 追加生产工单主要属性后 = 6 列;第4轮加行级质检徽标后工单列 +10):
   生产工单 220 / 客户 110 / 产品 minmax(170,1.1fr) / 数量 150 / 交期 130 / 完工信息 minmax(290,1.2fr)
   —— 1392 CSS 宽(内容 1146):1146 − 20(页/卡片内边距) − 40(8px×5 间距) = 1086 可分配;
   固定列 220+110+150+130=610,两列 flex 最低 170+290=460 ≤ 1086 ⇒ 不横向溢出;
   1920 下两列 flex 吃掉多余宽度(环与数字右置,不挤)。
   工单列留 220:英文界面「工单号 + Not scheduled/Unfinished + 质检徽标」贴一行也不把单号挤成省略号。 */
.wpb-grid {
  display: grid;
  grid-template-columns: 220px 110px minmax(170px, 1.1fr) 150px 130px minmax(290px, 1.2fr);
  align-items: center;
  gap: 12px;
  padding: 0 14px;
}
.wpb-grid-head {
  flex: none;
  height: 38px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  color: #606266;
  font-size: 12px;
  font-weight: 600;
}
.wpb-head-ops {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.wpb-head-ops em {
  color: #909399;
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
}
.wpb-grid-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
.wpb-grid-row {
  min-height: 112px;
  padding: 8px 14px;
  border-bottom: 1px solid #f0f2f3;
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease;
}
.wpb-grid-row:last-child {
  border-bottom: none;
}
.wpb-grid-row:hover,
.wpb-grid-row:focus-visible {
  background: #f5f9ff;
}
.wpb-cell {
  min-width: 0;
}
.wpb-no-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.wpb-no {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wpb-meta-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  min-width: 0;
  color: #909399;
  font-size: 11px;
}
.wpb-cur {
  color: #409eff;
  white-space: nowrap;
}
.wpb-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wpb-pill {
  padding: 0 6px;
  border-radius: 10px;
  background: #f4f4f5;
  color: #909399;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}
.wpb-status {
  flex: none;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}
.wpb-status.tone-done {
  background: #f0f9eb;
  color: #67c23a;
}
.wpb-status.tone-doing {
  background: #ecf5ff;
  color: #409eff;
}
.wpb-status.tone-warn {
  background: #fdf6ec;
  color: #e6a23c;
}
.wpb-status.tone-info,
.wpb-status.tone-muted {
  background: #f4f4f5;
  color: #909399;
}
/* 不合格红(2026-11-08 第4轮):已完工/已结案行按质检结果着色时用 */
.wpb-status.tone-danger {
  background: #fef0f0;
  color: #f56c6c;
}
/* 行级质检徽标:生产状态 tag 旁(合格绿 / 不合格红 / 待检验·检验中橙) */
.wpb-qc {
  flex: none;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}
.wpb-qc.tone-done {
  background: #f0f9eb;
  color: #67c23a;
}
.wpb-qc.tone-danger {
  background: #fef0f0;
  color: #f56c6c;
}
.wpb-qc.tone-warn {
  background: #fdf6ec;
  color: #e6a23c;
}
/* 品质提示:待品质检验: 成型 / 组装;当前工序就在待检清单里时加底色更醒目 */
.wpb-qc-hint {
  margin-top: 4px;
  overflow: hidden;
  color: #e6a23c;
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 2026-11-13(契约 §4):提示条可点 → 打开该工序检验单;cursor + 轻量 hover(只有下划线,
   不加底色块/动画,保持浅色系统风) */
.wpb-qc-hint.is-clickable {
  cursor: pointer;
}
.wpb-qc-hint.is-clickable:hover {
  color: #cf9236;
  text-decoration: underline;
}
.wpb-qc-hint.hot {
  padding: 0 4px;
  border-radius: 3px;
  background: #fdf6ec;
  font-weight: 600;
}
.wpb-cust {
  display: -webkit-box;
  overflow: hidden;
  color: #606266;
  font-size: 13px;
  line-height: 1.35;
  word-break: break-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.wpb-prod {
  overflow: hidden;
  color: #303133;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 产品编码 / 规格型号 / 需求·入库·余量 / 计划开工·批次号 的「标签: 值」小字行 */
.wpb-kv {
  margin-top: 4px;
  overflow: hidden;
  color: #909399;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wpb-kv em {
  color: #606266;
  font-style: normal;
}
/* 计划数量主数字 + 生产单位 */
.wpb-qty-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}
.wpb-qty {
  color: #303133;
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.wpb-unit {
  overflow: hidden;
  color: #909399;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 交期列:计划完工日期(主)/ 计划开工日期、批次号(小字) */
.wpb-date {
  color: #303133;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
/* 余量着色:>0 常规,=0 灰色,<0 系统警告色 */
.wpb-remain.is-zero {
  color: #c0c4cc;
}
.wpb-remain.is-neg {
  color: #e6a23c;
}
.wpb-ops {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 4px;
}
.wpb-ops-empty {
  color: #c0c4cc;
  font-size: 12px;
}

/* 空 / 错状态(居中铺在看板区域内) */
.wpb-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.wpb-state-ic {
  color: #c0c4cc;
  font-size: 34px;
}
.wpb-state-title {
  margin: 0;
  color: #909399;
  font-size: 14px;
}
.wpb-state-sub {
  margin: 0;
  color: #c0c4cc;
  font-size: 12px;
}

/* ===== ④ 列表视图:现有 el-table 风格 ===== */
.wpb-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}
.wpb-table-wrap {
  flex: 1;
  min-height: 0;
}
.wpb-table {
  width: 100%;
}
:deep(.el-table__row.wpb-row-clickable) {
  cursor: pointer;
}
.wpb-l-no {
  color: #303133;
  font-weight: 600;
}
.wpb-l-sub {
  margin-top: 2px;
  color: #909399;
  font-size: 11px;
}
.wpb-list-empty {
  padding: 18px 0;
  color: #909399;
}
.wpb-list-empty-title {
  margin: 0 0 4px;
  color: #909399;
  font-size: 14px;
}
.wpb-list-empty-sub {
  margin: 0 0 8px;
  font-size: 12px;
}

/* 窄屏(笔记本/平板预览):6 列列宽保持不变(1392 CSS 宽实测可放下),只收紧间距;
   ≤1024 直接纵向堆叠,保证任何宽度都不横向溢出 */
/* 窄屏(笔记本/平板预览):6 列列宽保持不变(1392 CSS 宽实测可放下),只收紧间距;
   行保持上下 8px 内边距(环下多了检验徽标,别让内容贴着行分隔线);
   ≤1024 直接纵向堆叠,保证任何宽度都不横向溢出 */
@media (max-width: 1440px) {
  .wpb-grid {
    grid-template-columns: 220px 110px minmax(170px, 1.1fr) 150px 130px minmax(290px, 1.2fr);
    gap: 8px;
    padding: 0 10px;
  }
  /* 行共用 .wpb-grid 的横向间距,但上下要留 8px(上面的 .wpb-grid padding 会把行内边距清成 0) */
  .wpb-grid-row {
    padding: 8px 10px;
  }
  .wpb-qty {
    font-size: 16px;
  }
}
@media (max-width: 1024px) {
  .wpb-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding: 10px 12px;
  }
  .wpb-grid-head {
    display: none;
  }
  .wpb-grid-row {
    min-height: 0;
    padding: 10px 12px;
  }
  .wpb-kw {
    width: 160px;
  }
}
</style>
