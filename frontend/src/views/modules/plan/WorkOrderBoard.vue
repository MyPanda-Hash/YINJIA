<!-- WorkOrderBoard.vue — 工单排产(2026-09-23 纠偏,替代「生产排产」平铺看板,参考旧系统工单排产页)
     产线骨架:左侧=生产线档案**全部线**(与基础资料对应,停用线标记可查看);选中线 → 右侧正在运行的工单明细
     (未完工/已完工/全部);勾选已排 → 批量调线(启用线)/转领料(默认 BOM×排产数量 生成领料单草稿,2026-10-14)。
     无班别维度(用户拍板)。开线管理已按用户拍板去除(2026-09-24):本页只做 按线查看+调线+转领料,不含待排产池(排产入口单一=排产工作台)。
     2026-11-12(用户报障「左侧边栏显示的数量和…本线排产数量…当前工序报工数量没有任何关联」):
     左侧每线主数字从**成品口径** 未交量(排产−入库)改为**本线排产数量**,并加「已报 · 未完工」次行;
     顶部统计三项同步改工序口径 —— 三处与右侧「未完工」页签明细同源(详见左栏注释)。
     2026-11-13(用户口径「增加一个原计划量/报工数,当天结束后未完成会进行提示」):
     日期格从「一个数」改成**原计划/报工**两数(例 715/15);日期 < 今天且报工 < 原计划 ⇒ 该格标红,
     页面顶部再给一行红色汇总(处数 + 合计欠产,悬停看明细),不弹窗。未完成的量由后端
     `DayPlanSpread.mergeReported` 向今天及以后重排,前端只负责显示。
     2026-11-13(契约 tools/archive/_wo-progress-click-20261113/CONTRACT.md §3.1):新增**深链定位** ——
     从「生产工序进度看板」点某道工序跳来(?line&wo&rowid&op):按 line 选线 → 定位该工单行
     (浅蓝底高亮 + 滚到表格中间)→ 上下文区提示「已定位:工单号#行号 · 工序」;
     参数用完即摘(router.replace),keep-alive 再次跳入靠 watch(route.query)/onActivated 重新定位。
     2026-11-14(用户口径「删除掉这个工序流转明细,这个作用不明显还很丑,除非有其他方法」):
     **展开行那道 8 列大表整体删除**;同样的数字收进「当前工序」格的悬停提示
     (business/woFlowChain.js;当前工序标 ▶、深链定位的那道标 ★),平时看不见,要看鼠标停一下;
     全工序进度仍看「生产工序进度看板」的环/圆点链。
     2026-11-18(用户口径「为当前的工单排产处也增加列设置。让用户可以调整当前查看的列和不查看的列」):
     明细表加**列设置** —— 列定义搬进 business/woBoardColumns.js(冻结区顺序锁定、日期列组用伪列统管),
     表格改为按列设置草稿渲染(显隐 + 顺序),持久化复用系统级 useReportColumns + /px/reportColumnSettings
     (panelCode=WORK_ORDER_BOARD);锁定列 = 选择框 / 工单号 / 生产状态。 -->
<template>
  <div class="wb-page">
    <!-- 顶部:开工日期 + 汇总条 -->
    <div class="wb-top">
      <span class="wb-title">{{ tt('工单排产') }}</span>
      <span class="wb-p">{{ tt('开工日期') }}
        <el-date-picker v-model="day" type="date" value-format="YYYY-MM-DD" style="width: 135px" @change="loadAll" />
      </span>
      <!-- 刷新(2026-10-17 用户口径):本页此前只有切开工日期才会重新取数,而左侧骨架/明细/汇总
           都依赖别处(快速排产排入、生产工单结案、报工)的写入 —— 加一个手动刷新按钮,
           一次重取 骨架+按线明细+汇总条 三处(与快速排产页「刷新」同口径,只读查看,归「可见」动作)。 -->
      <el-button size="small" :loading="loading" @click="loadAll">{{ tt('刷新') }}</el-button>
      <span class="wb-stats">
        {{ tt('待排产') }}（{{ s['待排产笔数'] ?? 0 }}{{ tt('笔') }}）；{{ tt('今日排产') }}（{{ s['今日排产']?.张数 ?? 0 }}{{ tt('张') }}/{{ num(s['今日排产']?.数量) }}{{ tt('件') }}）；{{ tt('总未完成量') }} {{ num(s['总未完成量']) }}
      </span>
      <!-- 产能可见(2026-10-31 用户口径「产能只显示、不拦截」):全部启用线今天「已排>日产能」的汇总。
           只提示 —— 不弹窗、不改数、不禁填。 -->
      <span class="wb-over" :class="{ hot: overLineCount > 0 }">
        {{ tt('今日超载') }} {{ overLineCount }} {{ tt('条线') }}<template v-if="overQty > 0">，{{ tt('合计超') }} {{ num(overQty) }}</template>
      </span>
    </div>

    <!-- 历史欠产汇总条(2026-11-13 用户口径「当天结束后未完成会进行提示」)───────────────
         口径 = 当前选线「未完工/已完工/全部」页签明细里,日期 < 今天 且 报工 < 原计划 的格子合计;
         不弹窗:一条红色汇总 + 悬停看逐条明细(:title,最多 15 行)。后端没返回「原计划」时
         shortInfo.count = 0 ⇒ 整条不渲染(老后端/老数据自然降级,不出假提示)。
         ⚠ 2026-11-13 用户反馈「两天的计划量是 1067…应该是计划量-实际报工数量」—— 用户把单个
         欠产数误读成了计划合计(实际两天原计划 834+833=1667、报工 600、欠产 1067)⇒
         提示改成**三数并列**:`原计划 1667 − 报工数 600 = 欠产 1067`,算式自证,不再只放一个数。 -->
    <div v-if="shortInfo.count" class="wb-short-bar" :title="shortTitle">
      <span class="wb-short-main">
        {{ tt('历史未完成') }} {{ shortInfo.count }} {{ tt('处') }} ·
        {{ tt('原计划') }} {{ num(shortInfo.plan) }} − {{ tt('报工数') }} {{ num(shortInfo.actual) }}
        = {{ tt('欠产') }} {{ num(shortInfo.qty) }}
      </span>
      <span class="wb-short-hint">{{ tt('标红格 = 当天已结束但报工未达原计划(汇总含未显示为列的日期)') }}</span>
    </div>

    <div class="wb-body">
      <!-- 左:各线「本线排产数量」+「已报/未完工」次行(2026-11-12 用户报障)───────────────────────
           原话:「左侧边栏显示的数量和当前的生产线排产数量(本线排产数量)和当前工序报工数量没有任何关联」。
           原因:主数字原先是**成品口径** 未交量(= 排产 − 入库),与右侧明细的工序口径毫无关系 ⇒
           出现「左侧该线 0、右侧明细 5421 / 报工 1100」这种自相矛盾的现场。
           现改为与右侧「未完工」页签明细**同一批行**的合计(接口 linesSummary 新增 3 个数字字段):
             主数字 = 本线排产数量(字段暂缺 ⇒ 回退成品口径 未交量,不显示空白/NaN)
             次行   = 已报完工量 · 本线未完工量(两个字段都缺 ⇒ 整行隐藏,不占高度)
           左侧是产线骨架,口径固定按「未完工」页签,不随右侧页签切换(右侧切「已完工/全部」时只有顶部统计变)。 -->
      <div class="wb-left">
        <div class="wb-left-head">{{ tt('工序/工艺') }} / {{ tt('生产线') }}</div>
        <!-- 按工序/工艺分组(2026-10-05,依《新系统产线命名.xlsx》):分发维度=生产线,功能分组=成型/切炭/组装 -->
        <template v-for="g in lineGroups" :key="g.车间">
          <div class="wb-shop-group">{{ tt(g.车间) }}<span class="wb-shop-cnt">{{ g.lines.length }}</span></div>
          <div v-for="l in g.lines" :key="l.生产线" class="wb-line"
               :class="{ active: sel.line === l.生产线, off: l.停用 }" @click="select(l)">
            <div class="wb-line-name">
              {{ l.生产线 }}
              <span v-if="l.停用" class="wb-tag off-line">{{ tt('停用') }}</span>
            </div>
            <div class="wb-line-row">
              <span class="wb-qty" :title="tt('本线排产数量(该线「未完工」页签明细合计,与右侧顶部统计同源)')">{{ num(lineQty(l)) }}</span>
              <!-- 今日已排/日产能(2026-10-31):只显示、不拦截;未配产能的线明确写"未配",不显示 0 -->
              <span v-if="Number(l.日产能 || 0) > 0" class="wb-daycap"
                    :class="{ over: l.今日余量 != null && Number(l.今日余量) < 0 }"
                    :title="tt('今日已排/日产能/今日余量')">
                {{ num(l.今日已排) }}/{{ num(l.日产能) }}
              </span>
              <span v-else class="wb-daycap unset" :title="tt('产线档案未配日产能')">{{ tt('未配产能') }}</span>
            </div>
            <!-- 次行(2026-11-12):本线已报完工量 · 本线未完工量,与主数字同一批行(11px 灰字,210px 栏内单行省略) -->
            <div v-if="lineFlowText(l)" class="wb-line-sub"
                 :title="tt('已报完工量·本线未完工量(本线排产−已报,按「未完工」页签口径)')">{{ lineFlowText(l) }}</div>
          </div>
        </template>
      </div>

      <!-- 右:选中线正在运行的工单明细 -->
      <div class="wb-main">
        <div class="wb-ctx">
          <span class="wb-ctx-label">{{ tt('生产线') }}：<b>{{ sel.line || tt('（点击左侧选择）') }}</b>
            <span v-if="shop" class="wb-shop">{{ tt('当前车间') }}：{{ shop }}</span>
          </span>
          <!-- 深链定位提示(2026-11-13,契约 CONTRACT.md §3.1):从「生产工序进度看板」点某道工序跳来时
               显示「已定位:工单号#行号 · 工序」,让用户知道为什么停在这一行;参数用完即摘,
               提示只留到切产线/切片签/刷新(那些动作会 clearFocus) -->
          <span v-if="focusTip" class="wb-focus-tip" :title="focusTip">{{ focusTip }}</span>
          <!-- 顶部统计(2026-11-12 改口径):三项全是**工序口径** = 右侧「未完工」页签明细行合计,
               与左侧每线数字同源(选中哪条线,左侧该线主数字 = 这里的「本线排产数量」)。
               成品口径的未交量(排产−入库)不再冒充「未完工量」,只在 tooltip 里报合计供对账。 -->
          <span class="wb-ctx-stats" :title="ctxStatsTitle">
            {{ tt('本线排产数量') }} {{ num(selQty) }}　|　{{ tt('已报完工量') }} {{ num(selDone) }}　|　{{ tt('未完工量') }} {{ num(selRemaining) }}
          </span>
        </div>

        <div class="wb-block">
          <div class="wb-head">
            <span class="wb-block-title">{{ tt('排产明细') }}——{{ sel.line || '-' }}</span>
            <el-radio-group v-model="scope" size="small" @change="onScope">
              <el-radio-button value="未完工">{{ tt('未完工') }}</el-radio-button>
              <el-radio-button value="已完工">{{ tt('已完工') }}</el-radio-button>
              <el-radio-button value="全部">{{ tt('全部') }}</el-radio-button>
            </el-radio-group>
            <!-- 列设置(2026-11-18 用户口径「增加列设置,让用户可以调整当前查看的列和不查看的列」):
                 勾选决定这张明细表显示哪些列、拖动/▲▼ 调整列顺序;与订单结转、生产工单·列表共用系统级实现
                 (useReportColumns + /px/reportColumnSettings,panelCode=WORK_ORDER_BOARD),保存后刷新仍生效。
                 注意它是**全用户共享**的一份设置(后端按面板存一行),不是各人各一份。 -->
            <el-button size="small" plain @click="openDialog">{{ tt('列设置') }}</el-button>
            <div class="wb-actions">
              <!-- 日排产(2026-10-29):日期列由后端按数据生成。
                   2026-10-31 用户口径「**当前不需要手填,能自动算就可以了**」⇒ 「保存日排产」按钮已撤,
                   日期格改**只读**:计划 = 工序计划量按「开工日→交期」自动均摊(DayPlanSpread)。 -->
              <el-button v-if="canDo('unclose')" size="small" type="danger" plain :disabled="!checkedSched.length" @click="unclose">
                {{ tt('取消结案') }}（{{ checkedSched.length }}）
              </el-button>
              <el-button size="small" type="primary" plain :disabled="checkedSched.length !== 1" @click="openTrace">
                {{ tt('追溯') }}
              </el-button>
              <el-dropdown v-if="canDo('print')" split-button size="small" type="success" plain :disabled="!checkedSched.length"
                           @click="printTask('成型生产任务单')" @command="printTask">
                {{ tt('打印工单') }}（{{ checkedSched.length }}）
                <template #dropdown>
                  <el-dropdown-item command="成型生产任务单">{{ tt('成型生产任务单') }}</el-dropdown-item>
                  <el-dropdown-item command="切炭生产任务单">{{ tt('切炭生产任务单') }}</el-dropdown-item>
                  <el-dropdown-item command="组装生产任务单">{{ tt('组装生产任务单') }}</el-dropdown-item>
                </template>
              </el-dropdown>
              <el-button v-if="canDo('transfer')" size="small" type="warning" plain :disabled="!checkedSched.length" @click="openReassign">
                {{ tt('调拨') }}（{{ checkedSched.length }}）
              </el-button>
              <el-button v-if="canDo('revoke')" size="small" plain :disabled="!checkedSched.length" @click="doTransferRevoke">
                {{ tt('撤回调拨') }}
              </el-button>
              <!-- 排单计划纸表(2026-10-31 用户口径「需要能打出这样的报表形式,就在当前工单排产处实现,
                   这样就不需要根据那个产线进行处理了」):整张纸表出纸。
                   2026-11-03 用户口径「**不是点击排单计划把目前生产线的所有单据打印,而是选择勾选几个打印几个**」
                   ⇒ 只出勾选行(勾 0 张按钮置灰,与「打印工单」同一套勾选;表头全选 = 整条产线)。
                   2026-11-04 用户口径「**当前在不同的工序产线显示的这个工序名称也要不同**」
                   ⇒ 纸表标题/车间列头跟选中产线的 生产车间 走(切炭车间排单计划 / 组装车间排单计划…)。 -->
              <el-button v-if="canDo('print')" size="small" type="warning" plain
                         :disabled="!checkedSched.length"
                         :title="tt('勾选工单后打印排单计划,只打印勾选的工单')"
                         @click="printPlanSheet">
                {{ tt('排单计划') }}（{{ checkedSched.length }}）
              </el-button>
              <!-- 打印设置(2026-11-05 客户口径:「打印就显示 3 天或 3~4 天,这样子我们自己可以去设置」):
                   小设置按钮 → 改默认打印天数(1~10),存本机(按账号),只影响日期列数量,不影响取数。 -->
              <el-button v-if="canDo('print')" size="small" plain class="wb-print-set"
                         :title="tt('排单计划打印设置(默认打印天数)')" @click="openPrintSet">
                <el-icon><Setting /></el-icon>
              </el-button>
              <!-- 「转领料」已随 MES 自建 BOM 下架移除(2026-10-04):它按 默认BOM×排产数量 生成领料单草稿,
                   数据源 bs_bom 与后端 /px/scheduleBoard/toPicking 端点同期删除 ⇒ 按钮一并撤掉 -->
            </div>
          </div>
          <!-- ⚠ 深链定位(2026-11-13,契约 §3.1)给表格留了两个绑定,别删:
               ref=schedTable   → 定位后从表格内部 .el-table__body 找高亮行做 scrollIntoView
               :row-class-name  → 命中的行挂 .wb-focus-row(浅蓝底 + 左侧 3px 蓝边)
               (:row-key 只用来让 el-table 认行身份 —— 同号工单行多批时不串行;此前它还喂
                expand-row-keys,2026-11-14 展开区删除后已无此用途) -->
          <!-- 点整行即勾选(2026-11-17 用户口径「不需要只选择一定要点那个小方框,而是可以点击这一行来选择」):
               row-click 翻转勾选;行内日排产格(.dp-plan,点它是就地改当天数量)与复选框本身不翻
               (判据 business/rowSelect.js)。 -->
          <el-table ref="schedTable" :data="schedRows" size="small" border height="100%" empty-text=""
                    :row-key="rowKeyOf" :row-class-name="rowClassName"
                    @row-click="onRowClick"
                    @selection-change="(r) => (checkedSched = r)">
            <el-table-column type="selection" width="42" />
            <!-- 工单号(锁定常显·冻结左):「工单号#工单行号」是本页的行身份 —— 隐藏后勾选、追溯、
                 打印都对不上号,所以它**不进列设置**(与「生产工单·列表」同一口径)。 -->
            <el-table-column :label="tt('工单号')" prop="加工单号" width="140" fixed />
            <!-- ══════════ 可调整列(2026-11-18 用户口径「为当前的工单排产处也增加列设置。
                 让用户可以调整当前查看的列和不查看的列」)══════════
                 显隐与顺序都由「列设置」决定 ⇒ 这里按 renderCols 的**草稿顺序**渲染(草稿即预览,
                 点弹窗「保存」才落库,panelCode=WORK_ORDER_BOARD,与订单结转/生产工单列表同一套持久化)。
                 列定义(宽/对齐/排序/溢出省略/表头 tooltip/冻结)集中在 business/woBoardColumns.js,
                 本模板只负责"这一列的格子怎么画"(按 col.prop 分支)与日期列(数据驱动)的整组渲染。
                 锁定列:选择框 / 工单号 / 生产状态(两端固定)—— 它们是行身份与页签判据,隐藏后按钮点不了、
                 也看不出为什么不能操作,故不进列设置。
                 冻结区(产品编码/产品规格/订单数量/客户)= 2026-11-08 用户口径「显示在前面冻结,方便看」,
                 顺序锁定、只能显隐(WO_BOARD_COLUMNS 的 frozen,弹窗里带锁)。 -->
            <el-table-column v-for="col in renderCols" :key="col.prop"
                             :prop="col.key || col.prop" :label="col.date ? '' : tt(col.label || col.prop)"
                             :width="col.width" :min-width="col.minWidth" :align="col.align"
                             :sortable="!!col.sortable" :show-overflow-tooltip="!!col.showOverflow"
                             :fixed="col.fixed"
                             :label-class-name="col.date ? 'dp-col-' + dayColState(col.date, planToday) : undefined"
                             :class-name="col.date ? 'dp-col-' + dayColState(col.date, planToday) : undefined">
              <template #header>
                <!-- 日期列头(2026-10-31;2026-11-13 改「原计划/报工」两数):多一行「该线当天 已排/日产能」
                     —— 产能只显示、不拦截录入。超产能只把列头标红(不弹窗、不改数、不禁填);
                     未配产能(档案日产能 0/空)写"未配",不判超载。 -->
                <div v-if="col.date" class="dp-head"
                     :class="{ over: isOverDay(col.date), past: dayColState(col.date, planToday) === 'past' }"
                     :title="dayHeadTitle">
                  <div class="dp-date">{{ col.date.slice(5) }}<span v-if="isToday(col.date, planToday)" class="dp-today">{{ tt('今') }}</span></div>
                  <div v-if="lineCap > 0" class="dp-cap" :title="tt('该线当天已排/日产能')">
                    {{ qtyText(dayTotal[col.date]) }}/{{ qtyText(lineCap) }}
                  </div>
                  <div v-else class="dp-cap unset" :title="tt('产线档案未配日产能,不做超载提示')">{{ tt('未配产能') }}</div>
                </div>
                <!-- 其余列:表头 tooltip(口径说明)与标签都在列定义里,这里只统一渲染 -->
                <span v-else :title="col.headerTip ? tt(col.headerTip) : null">{{ tt(col.label || col.prop) }}</span>
              </template>
              <template #default="{ row }">
                <!-- ① 日排产日期格(数据驱动,整组显隐由列设置里的伪列「日排产日期列」控制):
                     区间外画「/」;点了就地改当天数量(双击/单击皆可);格内 `原计划/报工` 两数。 -->
                <template v-if="col.date">
                  <el-input-number v-if="qtyEdit === qtyKey(row, col.date)" v-model="qtyDraft" size="small"
                                   :controls="false" :min="0" class="dp-input" autofocus
                                   @blur="commitQty(row, col.date)" @keyup.enter="commitQty(row, col.date)" @keyup.esc="cancelQtyEdit" />
                  <!-- 区间外(开工日~计划完工日之外)且当天无计划/原计划/实报:画「/」——这一天不归本行排
                       (2026-11-01 用户口径;例:开工日改成 11-02 后,11-01 的格子要画斜杠) -->
                  <span v-else-if="isOutCell(row, col.date)" class="dp-out"
                        :title="tt('不在本行排产区间(开工日~计划完工日)内')">/</span>
                  <span v-else class="dp-plan"
                        :class="{ manual: isManual(row, col.date), actual: cell(row, col.date).hasActual, short: cell(row, col.date).short > 0 }"
                        :title="dayTitle(row, col.date)" @click="startQtyEdit(row, col.date)">
                    {{ cell(row, col.date).text }}<span v-if="isManual(row, col.date)" class="dp-hand"
                      :class="{ over: Number(row.超分配 || 0) > 0 }" :title="overTitle(row)">{{ tt('手') }}</span>
                  </span>
                </template>
                <!-- ② 排产日期就地改(2026-10-31):双击进 date-picker,同步 plang + plang_pc + 工序台账区间 -->
                <span v-else-if="col.cell === 'planDate'" class="dp-date-cell" :title="tt('双击可改排产日期')"
                      @dblclick="openQuick(row, planToday)">{{ row[col.key || col.prop] || '-' }}</span>
                <!-- ③ 本线排产数量(2026-11-11):后端已返回同值别名;老服务/老数据取不到时回退既有字段 -->
                <span v-else-if="col.cell === 'lineQty'">{{ num(row['本线排产数量'] ?? row['当前工序计划量']) }}</span>
                <!-- 当前工序(2026-11-14):悬停 = 该行逐道工序的计划量/已审完工/可加工量/待流入量 -->
                <span v-else-if="col.cell === 'process'" :title="col.prop === '当前工序' ? flowTip(row) : null">{{ row[col.key || col.prop] ? tt(row[col.key || col.prop]) : '-' }}</span>
                <!-- 按量流转(2026-11-12,只读展示):上道完工量 → 可加工量 → 待报量 → 待流入量(>0 标橙) -->
                <span v-else-if="col.cell === 'flowNum'">{{ flowNum(row[col.key || col.prop]) }}</span>
                <span v-else-if="col.cell === 'flowGap'"
                      :class="{ 'wb-flow-gap': Number(row[col.key || col.prop] || 0) > 0 }">{{ flowNum(row[col.key || col.prop]) }}</span>
                <!-- 需交付三桶:值走 num() 显式渲染,0 要显示 0(2026-11-15 实测:prop 默认渲染 0 会出空格) -->
                <span v-else-if="col.cell === 'num'">{{ num(row[col.key || col.prop]) }}</span>
                <!-- 结案(2026-10-18):'Y' 显示「已结案」,其余显示 '-' -->
                <span v-else-if="col.cell === 'closed'" :class="row.结案 === 'Y' ? 'wb-closed' : ''">{{ row.结案 === 'Y' ? tt('已结案') : '-' }}</span>
                <span v-else>{{ row[col.key || col.prop] }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('生产状态')" prop="生产状态" width="90" fixed="right" />
          </el-table>
        </div>
      </div>
    </div>

    <!-- 排单计划打印设置(2026-11-05):默认打印天数 —— 客户要"打印就显示 3 天/3~4 天,自己可设" -->
    <el-dialog v-model="printSetVisible" :title="tt('排单计划打印设置')" width="380px" append-to-body>
      <el-form label-width="116px" class="wb-print-set-form">
        <el-form-item :label="tt('默认打印天数')">
          <el-input-number v-model="printDaysDraft" :min="1" :max="10" size="small" />
          <div class="wb-print-set-hint">
            {{ tt('纸表日期列 = 勾选行「最早日期」起 N 天(中间没计划的格子留空);默认 3 天。') }}
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="printSetVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="savePrintSet">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <!-- 列设置弹窗(2026-11-18):通用组件 @core/views/ColumnSettingsDialog.vue —— 显隐**与列顺序**草稿由
         useReportColumns 持有,保存走 /px/reportColumnSettings(panelCode=WORK_ORDER_BOARD),刷新后仍按
         保存的显隐/顺序渲染。排序:拖动行(⠿)换位 + ▲▼ 微调;冻结区的 4 列带锁(order 固定,只能显隐)。
         关闭/取消 = 丢弃未保存的勾选与顺序(回到后端已保存那份),否则"取消"后表格已经被改了。
         列表里的伪列「日排产日期列」= 整组日期列的显隐开关 + 插入点(日期列本身不进列设置)。 -->
    <ColumnSettingsDialog :model-value="columnVisible" :columns="dialogColumns"
                          @update:model-value="onColumnDialogToggle"
                          @toggle="onColToggle" @pin="onColPin" @move="onColMove" @reorder="onColReorder"
                          @reset="resetDraft" @save="saveColumns" />

    <!-- 调拨弹窗(9.29 批次②;2026-10-29 收口「调拨只能调拨到当前工序的产线中」;
         2026-10-30 排版:改**两列表单**(标签定宽右对齐 + 控件一列对齐 + 行距 14px),
         不再把标签和下拉挨着摆 —— 原先 inline-flex 各写各的宽度,标签一长一短就挤成一团 -->
    <el-dialog v-model="raVisible" :title="tt('工单调拨')" width="520px" append-to-body>
      <div class="ra-form">
        <div class="ra-row">
          <span class="ra-label">{{ tt('当前工序') }}</span>
          <div class="ra-value">
            <b>{{ raOps.length ? raOps.map((x) => tt(x)).join(' / ') : tt('判不出') }}</b>
            <span v-if="raLimited" class="ra-hint">{{ tt('只能调拨到本工序的产线') }}</span>
          </div>
        </div>
        <div class="ra-row">
          <span class="ra-label">{{ tt('目标车间') }}</span>
          <el-select v-model="raShop" class="ra-ctl" filterable clearable :disabled="!raShops.length"
                     @change="raLine = ''">
            <el-option v-for="x in raShops" :key="x" :label="x" :value="x" />
          </el-select>
        </div>
        <div class="ra-row">
          <span class="ra-label">{{ tt('目标生产线') }}</span>
          <el-select v-model="raLine" class="ra-ctl" filterable :disabled="!raLines.length"
                     :placeholder="tt('请选择目标生产线')">
            <el-option v-for="x in raLines" :key="x.生产线"
                       :label="x.生产线 + (x.生产车间 ? '·' + x.生产车间 : '')" :value="x.生产线" />
          </el-select>
        </div>
        <div class="ra-row">
          <span class="ra-label">{{ tt('调拨原因') }}</span>
          <el-input v-model="raReason" class="ra-ctl" :placeholder="tt('选填')" />
        </div>
        <div v-if="raTip" class="ra-row">
          <span class="ra-label"></span>
          <div class="ra-tip">{{ raTip }}</div>
        </div>
      </div>
      <div class="ra-note">{{ tt('调拨写入轨迹(工单追溯可见);「撤回调拨」可把产线调回原线') }}</div>
      <template #footer>
        <el-button @click="raVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :disabled="!raCan || !raLine" @click="doTransfer">{{ tt('确认调拨') }}</el-button>
      </template>
    </el-dialog>

    <!-- 工单详情·追溯:共用组件 WorkOrderTraceDialog(2026-10-05;生产工单页也原地挂同一个) -->
    <WorkOrderTraceDialog v-model="traceVisible" :code="traceNo" :行id="traceRowId" />

    <!-- 排产快速调整(2026-10-31):双击日期格弹出;本页带「调线」块(复用调拨,带轨迹可撤回) -->
    <ScheduleQuickEditDialog v-model="quickVisible" :row="quickRow" :date="quickDate" :line="sel.line"
                             support-transfer @saved="afterQuickSaved" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onActivated, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { printWorkTaskSheet, printSchedPlanSheet, pickPlanSheetRows, planSheetPrintDates, PLAN_SHEET_DEFAULT_DAYS, moldPlanQty } from '@/business/print-formats'
import { Setting } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import WorkOrderTraceDialog from './WorkOrderTraceDialog.vue'
import ScheduleQuickEditDialog from './ScheduleQuickEditDialog.vue'
import { qtyText, isOverCapacity, dayColState, isToday, isPast, isOutOfPlanRange,
  dayCellView, historyShortfalls, shortfallTotals } from '@/business/dayPlan'
// 逐道工序的悬停提示文本(2026-11-14:原「工序流转明细」展开区删除后,数字收到「当前工序」格)
import { flowChainTip } from '@/business/woFlowChain'
import { toggleRowOnRowClick } from '@/business/rowSelect'
import { fetchDayPlan, saveDayPlan } from '@/business/dayPlanApi'
import { useUserStore } from '@/stores/user'
import { canDo as canDoPerm, canDoAny } from '@core/auth/panelAccess'
// 列设置(2026-11-18):列定义/渲染列序在 business/woBoardColumns.js(纯函数,带单测);
// 显隐+顺序的持久化走系统级 useReportColumns → /px/reportColumnSettings(panelCode=WORK_ORDER_BOARD)。
import { WO_BOARD_COLUMNS, WO_BOARD_FROZEN_PROPS, WO_BOARD_DEFAULT_PINS, DAY_PLAN_COL_PROP, boardColumnProps, boardRenderColumns, clampToScrollZone } from '@/business/woBoardColumns'
import { useReportColumns } from '@core/report/useReportColumns'
import { columnPinOf, normalizePin } from '@core/report/reportColumnSettings'
import ColumnSettingsDialog from '@core/views/ColumnSettingsDialog.vue'

/**
 * 页面级动作权限(2026-10-16):页面面板 WORK_ORDER_BOARD
 * (可见/查询/调拨/撤回调拨/取消结案/打印;词表见后端 PagePanelRegistry)。
 * 未授权的按钮不渲染;「追溯」是只读查看,归「可见」不另设动作。
 */
const permUser = useUserStore()
const canDo = (word) => canDoPerm(permUser, 'WORK_ORDER_BOARD', word)

const day = ref(new Date().toISOString().slice(0, 10))
const lineSummary = ref([])
const sel = reactive({ line: '' })
const scope = ref('未完工')
const schedRows = ref([])
const checkedSched = ref([])
const s = ref({})
/** 刷新按钮 loading(2026-10-17):loadAll 期间置真,避免连点 */
const loading = ref(false)

// ── 排单计划打印设置(2026-11-05 客户口径:「打印就显示 3 天或 3~4 天,这样子我们自己可以去设置」)──
//   只影响日期列数量(默认 3 天,1~10);按登录账号存 localStorage,刷新/重开浏览器仍生效。
const PLAN_DAYS_KEY = 'yj.planSheet.printDays'
const printDays = ref(PLAN_SHEET_DEFAULT_DAYS)
const printDaysDraft = ref(PLAN_SHEET_DEFAULT_DAYS)
const printSetVisible = ref(false)
function printDaysKey() { return PLAN_DAYS_KEY + '.' + (permUser.account || 'default') }
function readPrintDays() {
  try {
    const v = Number(localStorage.getItem(printDaysKey()))
    return Number.isFinite(v) && v >= 1 && v <= 10 ? Math.trunc(v) : PLAN_SHEET_DEFAULT_DAYS
  } catch { return PLAN_SHEET_DEFAULT_DAYS }
}
function openPrintSet() { printDaysDraft.value = printDays.value; printSetVisible.value = true }
function savePrintSet() {
  const v = Math.min(Math.max(Math.trunc(Number(printDaysDraft.value) || PLAN_SHEET_DEFAULT_DAYS), 1), 10)
  printDays.value = v
  try { localStorage.setItem(printDaysKey(), String(v)) } catch { /* 隐私模式忽略 */ }
  printSetVisible.value = false
  ElMessage.success(tt('已保存') + '：' + tt('排单计划') + ' ' + v + ' ' + tt('天'))
}
printDays.value = readPrintDays()

const raVisible = ref(false)
const raLine = ref('')
const raShop = ref('')
const raReason = ref('')
/** 选中行的当前工序(去重;2026-10-29 调拨候选由服务端按它算) */
const raOps = ref([])
/** 服务端给的可选车间 / 候选产线(只含当前工序的线) */
const raShops = ref([])
const raLinesAll = ref([])
/** 可调拨 = 服务端判定"有共同合法目标";提示原文(后端中文业务话术,与 err() 一样原样显示,不走 tt) */
const raCan = ref(false)
const raTip = ref('')
/** 至少一行有固定归口车间 ⇒ 显示"只能调到本工序的产线"的提示 */
const raLimited = ref(false)
// 车间只是候选线的二级过滤(车间是产线的属性);候选线已由 /transferTargets 按当前工序算好
const raLines = computed(() => raLinesAll.value.filter((l) => !raShop.value || l.生产车间 === raShop.value))

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
/** 按量流转字段展示(2026-11-12):没数显示 '-'，0 照显示(缺口 0 有意义) */
function flowNum(v) { return (v === null || v === undefined || v === '') ? '-' : num(v) }
/**
 * 左侧每线**主数字**(2026-11-12):= 接口新字段「本线排产数量」(该线「未完工」页签明细行的计划量合计)。
 * 字段暂缺(后端未升级/联调中)⇒ 回退成品口径「未交量」,绝不渲染空白或 NaN。
 */
function lineQty(l) {
  const v = l['本线排产数量']
  return (v === undefined || v === null || v === '') ? l['未交量'] : v
}
/**
 * 左侧每线**次行**文案「已报 X · 未完工 Y」(2026-11-12):X=本线已报完工量、Y=本线未完工量,
 * 与主数字同一批行;两个字段都缺 ⇒ 返回空串 ⇒ 模板整行不渲染(不留一条 0/0 的假数据)。
 */
function lineFlowText(l) {
  const parts = []
  const done = l['本线已报完工量']
  const left = l['本线未完工量']
  if (done !== undefined && done !== null && done !== '') parts.push(`${tt('已报')} ${num(done)}`)
  if (left !== undefined && left !== null && left !== '') parts.push(`${tt('未完工')} ${num(left)}`)
  return parts.join(' · ')
}
function err(e, f) { ElMessage.error(e?.response?.data?.message || tt(f)) }

// 本线排产数量合计(2026-11-11 用户口径「顶部合计同步按本线量算」):
//   与本页「本线排产数量」列同源 = 当前工序台账计划数量(= 排产数量 × 该道换算率)。
//   ⚠ 跨工序相加口径不同(成型件 + 装箱件),只在同工序/同车间内看这个合计才有意义。
//   2026-11-12:它同时是左侧每线主数字的口径(接口 linesSummary 的 本线排产数量 = 同一批行合计),
//   ⇒ 选中线时「左侧该线数字 = 顶部这里」;成品口径(Σ 未交量)见 selOutstanding(只进 tooltip)。
const selQty = computed(() => schedRows.value.reduce((a, r) => a + Number((r.本线排产数量 ?? r.当前工序计划量) || 0), 0))
/** 本线已报完工量合计(2026-11-12):与左侧次行同源 = 同一批「未完工」页签行,Σ 当前工序完工量 */
const selDone = computed(() => schedRows.value.reduce((a, r) => a + Number(r['当前工序完工量'] || 0), 0))
/** 本线未完工量合计(2026-11-12):**逐行** max(本线排产 − 已报, 0) 再相加 ——
 *  先加后减会把"某行超报"的富余抵掉别行的缺口,与左侧按行汇总的数字对不上。 */
const selRemaining = computed(() => schedRows.value.reduce((a, r) => {
  const plan = Number(r['本线排产数量'] ?? r['当前工序计划量'] ?? 0)
  const done = Number(r['当前工序完工量'] || 0)
  return a + Math.max(plan - done, 0)
}, 0))
/** 左侧按工序/工艺两级分组(2026-10-05):第1级=成型/切炭/组装,第2级=产线分组(成型下 烧结/X烧结) */
const lineGroups = computed(() => {
  const m = new Map()
  for (const l of lineSummary.value) {
    const k = l.产线分组 ? `${l.生产车间}·${l.产线分组}` : (l.生产车间 || '未归类')
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(l)
  }
  return [...m.entries()].map(([车间, lines]) => ({ 车间, lines }))
})
// 当前账号的车间(9.29 批次③):由 linesSummary 的产线车间反推(账号车间 = 其可见线的车间;不受限账号为多值 → 不显示)
const shop = computed(() => {
  const set = [...new Set(lineSummary.value.map((l) => l.生产车间).filter(Boolean))]
  return set.length === 1 ? set[0] : ''
})
// 未交量合计 = Σ未交量(**成品口径**:排产−入库,2026-10-07 起);旧数据无未交量字段时回退余量。
//   ⚠ 2026-11-12 口径纠偏:它**不再**充当顶部「未完工量」—— 顶部「未完工量」改按工序口径(selRemaining,
//     与右侧明细/左侧每线同源);本值只进顶部统计的 tooltip,用来对账"成品口径还欠多少"。
const selOutstanding = computed(() => schedRows.value.reduce((a, r) => a + (r.未交量 !== undefined ? Number(r.未交量 || 0) : Number(r.余量 || 0)), 0))
/** 顶部统计 tooltip(2026-11-12):说清这是**工序口径**(与右侧明细表格同源),并交代成品口径未交量合计 */
const ctxStatsTitle = computed(() => [
  tt('工序口径:与右侧明细表格同源(当前页签下选中线的行合计;「未完工」页签时与左侧每线数字一致)'),
  tt('本线已报完工量') + ' = Σ' + tt('当前工序完工量') + '；'
    + tt('本线未完工量') + ' = Σmax(' + tt('本线排产数量') + '−' + tt('当前工序完工量') + ',0)',
  tt('成品口径的未交量合计') + ' = ' + num(selOutstanding.value),
].join('\n'))
// 产能可见(2026-10-31 用户口径「产能只显示、不拦截;不影响实际排产量」):
//   顶部汇总 = 全部启用线今天「已排 > 日产能」的条数与合计超额(/stats 实时算,不落表)。
const overLineCount = computed(() => Number(s.value['今日超载线数'] || 0))
const overQty = computed(() => Number(s.value['今日超额合计'] || 0))

/** 选中一条产线:重取该线排产明细 + 日计划(既有行为不变)。
 *  2026-11-13 深链定位要复用同一条路径 ⇒ 返回 Promise(模板点击忽略返回值,深链里 await 它再定位行);
 *  同时清掉上一次的定位高亮/提示(用户主动切线 = 不再"定位在某行")。 */
function select(l) {
  clearFocus()
  sel.line = l.生产线
  return loadScheduled().then(() => loadDayPlan())
}

async function loadSummary() {
  try {
    const res = await request.post('/px/scheduleBoard/linesSummary', { 开工日期: day.value })
    lineSummary.value = res.data || []
    if (sel.line && !lineSummary.value.some((x) => x.生产线 === sel.line)) {
      sel.line = ''; schedRows.value = []
    }
  } catch (e) { err(e, '查询失败') }
}

async function loadScheduled() {
  if (!sel.line) { schedRows.value = []; return }
  try {
    const res = await request.post('/px/scheduleBoard/scheduled', { 生产线: sel.line, scope: scope.value })
    // 日期列(2026-10-29):先给每行挂上空的日计划/日报工,模板里的 v-model 才有可写路径
    schedRows.value = (res.data || []).map((r) => ({ ...r, 日计划: {}, 日报工: {} }))
  } catch (e) { err(e, '查询失败') }
}

async function loadStats() {
  try {
    const res = await request.post('/px/scheduleBoard/stats', {})
    s.value = res.data || {}
  } catch { /* 统计失败不阻断 */ }
}

// ───────── 日排产(2026-10-29):直接长在排产明细表的日期列 ─────────
// 用户口径:「在当前的表格内容处插入当前设定的日排产数量,修改需要针对当前生产工单和工单排产中都要实现」
//   ⇒ 不新增表格/块。2026-10-31 口径演进:①自动均摊(工序计划量 ÷ 开工日→交期);
//   ②**双击当天数量可改** —— 改过的那天存 wo_day_plan 当「人工指定」,其余天按剩余量重摊(守恒),
//   清空 = 恢复自动;格下方 = 当天已审核报工量。
const planDates = ref([])
const planToday = ref('')

// ───────── 列设置(2026-11-18 用户口径「为当前的工单排产处也增加列设置。让用户可以调整当前查看的列和
//   不查看的列」)────────────────────────────────────────────────────────────────────────────
// 三件事分开放,避免这块又长成本页的第二个"大杂烩":
//   ① 列定义 + 渲染列序(boardRenderColumns)= 纯数据/纯函数,business/woBoardColumns.js(带单测);
//   ② 显隐/顺序的存储 = 系统级 useReportColumns + /px/reportColumnSettings(panelCode=WORK_ORDER_BOARD,
//      与订单结转、生产工单·列表同一套;后端按面板存一行 ⇒ 全用户共享一份设置);
//   ③ 本页只留弹窗事件(改草稿)与保存提示 —— 弹窗 UI 是通用组件 ColumnSettingsDialog(C4:列调整只有一套实现)。
const BOARD_COL_PROPS = boardColumnProps()
const {
  columnVisible, columnDraft,
  openDialog, saveDialog, cancelDialog, init: initColumns, resetDraft,
} = useReportColumns(ref('WORK_ORDER_BOARD'), computed(() => BOARD_COL_PROPS), schedRows)

/** 表格实际渲染的列序:冻结区(顺序锁定)在前 → 滚动区按草稿顺序,日期组在伪列位置整组展开 */
const renderCols = computed(() => boardRenderColumns(columnDraft.value, WO_BOARD_COLUMNS, planDates.value))

/** 弹窗里的列草稿:冻结区 4 列带 locked(只能显隐,顺序固定),其余可拖动/▲▼/改固定位置
 *  (2026-11-18 用户口径「列设置增加可以对列固定位置」);`pin` 是**生效值**(设置没存过就用默认冻结区)。 */
const dialogColumns = computed(() => columnDraft.value
  .map((c) => ({
    ...c,
    locked: WO_BOARD_FROZEN_PROPS.includes(c.prop),
    pseudo: c.prop === DAY_PLAN_COL_PROP,
    pin: columnPinOf(c, WO_BOARD_DEFAULT_PINS),
  })))

/** 勾选/取消勾选:只改草稿,点弹窗「保存」才落后端 */
function onColToggle({ prop, visible }) {
  const col = columnDraft.value.find((c) => c.prop === prop)
  if (col) col.visible = visible
}
/** 改固定位置(只改草稿):冻结列恒固定左侧,不参与;其余列可固定左/右/取消固定 */
function onColPin({ prop, pin }) {
  if (WO_BOARD_FROZEN_PROPS.includes(prop)) return
  const col = columnDraft.value.find((c) => c.prop === prop)
  if (col) col.pin = normalizePin(pin)
}
/** ▲/▼ 微调列顺序(只改草稿):delta=-1 上移/靠左,+1 下移/靠右;冻结列顺序锁定 ⇒ 直接忽略 */
function onColMove({ prop, delta }) {
  if (WO_BOARD_FROZEN_PROPS.includes(prop)) return
  const arr = columnDraft.value
  const i = arr.findIndex((c) => c.prop === prop)
  if (i < 0) return
  const j = clampToScrollZone(arr, i + (Number(delta) || 0))
  if (j === i) return
  const [moved] = arr.splice(i, 1)
  arr.splice(j, 0, moved)
}
/** 拖动换位(下标基于草稿全量数组,只改草稿):冻结列不参与,滚动列不会被拖进冻结区 */
function onColReorder({ from, to }) {
  const arr = columnDraft.value
  const a = Number(from)
  const b = Number(to)
  if (!Number.isInteger(a) || !Number.isInteger(b)) return
  if (a < 0 || b < 0 || a >= arr.length || b >= arr.length || a === b) return
  if (WO_BOARD_FROZEN_PROPS.includes(arr[a].prop)) return
  const target = clampToScrollZone(arr, b)
  if (target === a) return
  const [moved] = arr.splice(a, 1)
  arr.splice(target, 0, moved)
}
/**
 * 弹窗开/关:关(取消按钮或右上角 X)= **丢弃未保存的勾选与顺序**,回到后端已保存那份。
 * 不这么做的话,草稿即生效(renderCols 从草稿派生)⇒ 点「取消」列也已经被改掉了。
 */
function onColumnDialogToggle(open) {
  if (open) { columnVisible.value = true; return }
  cancelDialog()
}
/** 保存列设置(失败如实提示,不谎报「已保存」) */
async function saveColumns() {
  const ok = await saveDialog()
  if (ok) ElMessage.success(tt('已保存'))
  else ElMessage.warning(tt('保存失败'))
}
/** 「日排产」权(改当天数量/日期):两页任一授予即可;没权限时格内不给编辑 */
const canDayPlan = computed(() => canDoAny(permUser, ['WORK_ORDER_LIST', 'WORK_ORDER_BOARD'], 'dayplan'))
// ── 历史欠产汇总(2026-11-13 用户口径「当天结束后未完成会进行提示」)──────────────────
//   判定全部在 business/dayPlan.js(historyShortfalls 只数 日期 < 今天 的格子,与格内 short 同口径);
//   这里只做「当前页签明细行」的合计与 tooltip 文案。
//   ⚠ 后端没返回 row.原计划(老 jar/该日不在原计划区间)⇒ items 为空 ⇒ 汇总条 v-if 自然不渲染。
const shortItems = computed(() => historyShortfalls(schedRows.value, planToday.value))
const shortInfo = computed(() => shortfallTotals(shortItems.value))
/** 顶部汇总条悬停明细:每行「工单号#行号 · 日期 · 原计划 X / 报工数 Y · 欠产 Z」,最多 15 行 */
const shortTitle = computed(() => {
  const MAX = 15
  const lines = [tt('历史未完成明细')]
  for (const x of shortItems.value.slice(0, MAX)) {
    const no = x.row['加工单号'] ?? x.row['工单号'] ?? ''
    const ln = x.row['工单行号']
    lines.push(`${no}${ln != null && ln !== '' ? '#' + ln : ''} · ${x.date} · `
      + `${tt('原计划')} ${qtyText(x.plan)} / ${tt('报工数')} ${qtyText(x.actual) || '0'} · ${tt('欠产')} ${qtyText(x.short)}`)
  }
  const rest = shortItems.value.length - MAX
  if (rest > 0) lines.push(`… ${tt('共')} ${shortItems.value.length} ${tt('处')}`)
  return lines.join('\n')
})
/** 日期列头 tooltip(2026-11-13 新口径:`原计划/报工` 两数 + 标红含义) */
const dayHeadTitle = computed(() =>
  tt('格内:原计划/报工;原计划 = 工序计划量按 开工日→交期 均摊(不扣报工、历史也保留);标红 = 当天已结束未达成'))
// ── 产能可见(2026-10-31,用户口径「产能只显示、不拦截;不影响实际排产量」)──────────────
//   lineCap  = 产线档案 bs_prod_line.日产能(0/空 = 未配产能 ⇒ 不判超载);
//   dayTotal = 该线每天已排合计(后端按 plang.scx 当前归属算,不分页签;含人工指定);
//   超产能**只标红列头** —— 不弹窗、不改数、不禁填。
const lineCap = ref(0)
const dayTotal = ref({})
/** 排产快速调整弹窗(2026-10-31):双击日期格弹出;本页带「调线」块(复用调拨) */
const quickVisible = ref(false)
const quickRow = ref({})
const quickDate = ref('')
function openQuick(row, d) {
  quickRow.value = row
  quickDate.value = d || planToday.value
  quickVisible.value = true
}
/** 弹窗保存后:重拉排产明细 + 日计划(数量/日期/产线都可能变) */
function afterQuickSaved() { loadScheduled().then(() => loadDayPlan()) }

function isManual(row, d) { return ((row.人工指定 || {})[d] ?? null) != null }
function overTitle(row) {
  const over = Number(row.超分配 || 0)
  return over > 0 ? `${tt('人工指定')} · ${tt('超分配')} ${qtyText(over)}` : tt('人工指定')
}

/**
 * 日期格显示模型(2026-11-13 用户口径):`原计划/报工` 两数(例 715/15),判定口径全在
 * business/dayPlan.js 的 dayCellView(两页共用,单测覆盖):
 *   有报工 ⇒ 原计划/报工;没报工 ⇒ 计划;已结束且原计划>0没报工 ⇒ 原计划/0(short=整格欠产);
 *   short 只在 日期 < 今天 时 > 0(今天还没结束,不判欠产)。
 * ⚠ 后端没返回「原计划」(老 jar)⇒ baseline 为空 ⇒ dayCellView 自动退回单数显示,不显示假数据。
 * ⚠ planToday 在 script setup 里是 ref:script 内取 .value(模板自动解包,别在模板里传 planToday)。
 */
function cell(row, d) {
  return dayCellView((row.日计划 || {})[d], (row.日报工 || {})[d], (row.原计划 || {})[d],
    isPast(d, planToday.value))
}
/** 本行排产区间(开工日~计划完工日)之外的空白格:画「/」(2026-11-01 用户口径,
 *  例:开工日改成 11-02 后,11-01 那格要画 /)。有计划/原计划/实报/人工指定的格子照旧显示数字
 *  (2026-11-13:加「原计划」—— 历史日期计划已不在 日计划 里,但原计划基线还在,不能画杠)。 */
function isOutCell(row, d) {
  const p = Number((row.日计划 || {})[d] || 0)
  const a = Number((row.日报工 || {})[d] || 0)
  const b = Number((row.原计划 || {})[d] || 0)
  if (p > 0 || a > 0 || b > 0) return false
  return isOutOfPlanRange(d, row.计划开工日期 || '', row.计划完工日期 || '')
}
/** 格 tooltip(2026-11-13 新口径):欠产时把「当天未完成 · 原计划/报工/欠产 · 已并入后续重排」写全;
 *  有报工/有计划时给 原计划 + 报工 + 编辑提示;空格只留编辑提示。 */
function dayTitle(row, d) {
  const v = cell(row, d)
  if (v.short > 0) {
    return `${tt('当天未完成')} · ${tt('原计划')} ${v.planText} · ${tt('报工数')} ${v.actualText || '0'}`
      + ` · ${tt('欠产')} ${qtyText(v.short)} · ${tt('未完成量已并入后续日期重排')}`
  }
  if (v.hasActual) {
    // 基线缺失(老后端/该日不在原计划区间)⇒ dayCellView 只返回报工数(planText 为空)⇒ 文案也只写报工,
    // 不能拿"今天起还要做多少"冒充原计划(2026-11-13 口径:降级只显示单数,不造对照)。
    const hint = tt('双击直接填当天数量;清空恢复自动')
    return (v.planText ? `${tt('原计划')} ${v.planText} · ` : '') + `${tt('报工数')} ${v.actualText} · ${hint}`
  }
  if (v.text) return `${tt('计划')} ${v.text} · ${tt('双击直接填当天数量;清空恢复自动')}`
  return tt('双击直接填当天数量;清空恢复自动')
}

/**
 * 双击改数量的「计划值」(2026-11-13,两处共用:编辑框预填 + commitQty 的 before 比较)。
 * 口径 = 人工指定 ▸ 日计划 ▸ 原计划 ▸ 0。
 * ⚠ 不能用格内显示值:格内是 `原计划/报工` 两数,拿显示值当 before 会把「没改」误判成「改成了报工数」,
 *   一失焦就把人工指定写成报工数(例:格内 715/15,预填 15 ⇒ 人工指定被写成 15)。
 */
function planEditValue(row, d) {
  const v = (row.人工指定 || {})[d] ?? (row.日计划 || {})[d] ?? (row.原计划 || {})[d] ?? 0
  return Number(v || 0)
}

/** 格内直接填(2026-10-31 用户口径「直接填写这个就行」):双击变输入框,回车/失焦保存,Esc 取消 */
const qtyEdit = ref('')
const qtyDraft = ref(0)
function qtyKey(row, d) { return `${row.行id}|${d}` }
function startQtyEdit(row, d) {
  if (!canDayPlan.value) return
  qtyEdit.value = qtyKey(row, d)
  qtyDraft.value = planEditValue(row, d) || undefined
}
function cancelQtyEdit() { qtyEdit.value = ''; qtyDraft.value = 0 }
async function commitQty(row, d) {
  if (qtyEdit.value !== qtyKey(row, d)) return
  const v = Number(qtyDraft.value || 0)
  const before = planEditValue(row, d)
  qtyEdit.value = ''
  if (v === before) return
  try {
    const r = await saveDayPlan([{ 工单行id: row.行id, 工序: row.工序日 || row.当前工序 || '',
      生产线: row.生产线 || sel.line, 计划日期: d, 计划数量: v }])
    const o = (r['超分配'] || []).find((x) => String(x['工单行id']) === String(row.行id))
    if (o) ElMessage.warning(`${tt('人工指定已超出工序计划量')}: ${qtyText(o['超出'])}${tt('(只提示,不拦保存)')}`)
    await loadDayPlan()
  } catch (e) { err(e, '保存失败') }
}

/** 该日期是否超产能(只用于列头标红;产能 <= 0 视为未配,不判) */
function isOverDay(d) { return isOverCapacity(dayTotal.value[d], lineCap.value) }

async function loadDayPlan() {
  if (!sel.line) { planDates.value = []; planToday.value = ''; lineCap.value = 0; dayTotal.value = {}; return }
  try {
    const data = await fetchDayPlan({ 生产线: sel.line, scope: scope.value })
    planDates.value = data['日期'] || []
    planToday.value = data['今天'] || ''
    lineCap.value = Number(data['产线产能'] || 0)
    dayTotal.value = data['每日已排'] || {}
    const byId = new Map()
    for (const p of data['行'] || []) byId.set(String(p['行id']), p)
    for (const row of schedRows.value) {
      const p = byId.get(String(row.行id))
      row.工序日 = p ? p['工序'] : (row.当前工序 || '')
      row.日计划 = { ...((p && p['日计划']) || {}) }
      row.日报工 = { ...((p && p['日报工']) || {}) }
      // 原计划基线(2026-11-13):工序计划量按「开工日→交期」全量均摊,不扣报工、历史日期也保留 ——
      //   日期格的 `原计划/报工` 与顶部欠产汇总都用它。老后端没这个字段 ⇒ 空对象 ⇒ 自动降级单数显示。
      row.原计划 = { ...((p && p['原计划']) || {}) }
      row.人工指定 = { ...((p && p['人工指定']) || {}) }
      row.超分配 = p ? Number(p['超分配'] || 0) : 0
      row.工序计划量 = p ? Number(p['工序计划量'] || 0) : 0
      // 纸表口径的整行汇总(交期/紧迫度/7天·15天·大于15天 需求与已排)—— 由后端算,前端只显示
      if (p) {
        for (const k of ['交期', '交期紧迫度', '需求数量', '排产数量',
          '7天需交付', '15天需交付', '大于15天需交付',
          '7天已排', '15天已排', '大于15天已排', '计划合计', '完工合计',
          // 排产区间(画斜杠用):与后端摊分日计划同一份开工/完工日期
          '计划开工日期', '计划完工日期']) row[k] = p[k]
      }
    }
  } catch (e) { err(e, '查询失败') }
}

// ⚠ 2026-10-31 最终口径:日计划默认由系统自动均摊,只允许「就地改某一天」(其余天按剩余量重摊);
//   不再有「全量手填 + 保存日排产」那套入口。

/** 页签(未完工/已完工/全部)变化:排产明细 + 日排产一起换(顺带清掉深链定位痕迹:换了页签行集就变了) */
function onScope() {
  clearFocus()
  loadScheduled().then(() => loadDayPlan())
}

// ───────── 深链定位(2026-11-13,契约 CONTRACT.md §3.1)──────────────────────────────
// 来源:「生产工序进度看板」点某道工序跳过来 ——
//   /prod/plan/workOrderBoard?line=<生产线>&wo=<工单号>&rowid=<行id>&op=<工序>
// 本页做四件事:
//   ① loadSummary() 后按 line **精确匹配** linesSummary 的生产线 → select(该线)(复用既有 select:
//      loadScheduled + loadDayPlan),不另写一套取数;
//   ② 定位行:行id 精确匹配 rowid 优先,其次 加工单号===wo(有行号时再按 工单行号 收窄);
//   ③ 命中:该行高亮(.wb-focus-row)+ scrollIntoView 居中 + 上下文区提示「已定位:工单号#行号 · 工序」;
//      (2026-11-14 起不再自动展开任何表格 —— 原「工序流转明细」展开区已删除,
//       定位的那道工序标在「当前工序」格的悬停提示里,见 flowTip)
//   ④ 参数**用完即摘**(router.replace 只删这 4 个 key),避免 keep-alive 回到本页被旧参数反复复写;
//      同一页面再次从看板点别的工序进来(只变 query 不重新挂载)⇒ watch(route.query) 重新定位。
//   ⚠ 找不到行 / 该线不在 linesSummary:ElMessage.warning + 摘参数后照常可用(不白屏、不死循环);
//     其中「行在别处页签」(看板切了已完工/全部才点的工序)会先切本页既有的「全部」页签再找一次,
//     真正不存在才 warning(见 consumeFocus 里第 ② 步的注释)。
const route = useRoute()
const router = useRouter()
/** 深链 query 键(契约 §3.1 只这四个) */
const FOCUS_KEYS = ['line', 'wo', 'rowid', 'op']
/** 可选兜底:契约没定义行号参数,但发送端若顺带带上 行号/rowno,定位多个同号工单行时用它收窄 */
const FOCUS_ROWNO_KEYS = ['行号', 'rowno']
/** 本页路径(hash 路由,route.path 不含 '#');keep-alive 缓存实例里靠它判断这次路由变化是不是本页 */
const SELF_PATH = '/prod/plan/workOrderBoard'
/** 高亮行的 row-key 值(空 = 无高亮) */
const focusKey = ref('')
/** 深链定位的那道工序(2026-11-14 起:不再展开任何表格,只在「当前工序」悬停提示里标 ★) */
const focusOp = ref('')
/** 上下文区提示文案,如「已定位:WO001#2 · 成型」 */
const focusTip = ref('')
/** 竞态计数:连续跳入/连点时只让最后一次定位生效,前一次 await 的结果作废 */
let focusSeq = 0
/** 正在消费的参数指纹:keep-alive 下 onActivated 与 watch(route.query) 会在同一 tick 各触发一次,
 *  同一个目标只消费一次(否则同一次跳入会白跑两遍取数/两遍定位) */
let focusInflight = ''
/** 排产明细表(定位后从它的 DOM 里找高亮行滚到中间) */
const schedTable = ref(null)

/**
 * 点整行 = 勾选/取消勾选(2026-11-17 用户口径「不需要只选择一定要点那个小方框,而是可以点击这一行来选择」)。
 * <p>判据在 @/business/rowSelect.js:复选框自己那一下不重复处理,**行内日排产格 .dp-plan 不翻**
 * (点那一格是就地改当天计划数量,顺手翻勾选会让人以为点错了),其余单元格点了即翻。</p>
 */
function onRowClick(row, column, event) {
  toggleRowOnRowClick(schedTable.value, row, event, { extra: '.dp-plan' })
}

/**
 * 行身份 key(2026-11-13):`:row-key` 依赖它,**必须唯一** ——
 * 正常行 = 行id(plang.id);极端情况下缺 行id 时用 工单号|行号|批次号 兜底,
 * 否则多行共用 'undefined' 会让 el-table 把不同行当成同一行(勾选/高亮串行)。
 */
function rowKeyOf(r) {
  if (r && r.行id !== undefined && r.行id !== null && r.行id !== '') return String(r.行id)
  return [r?.加工单号 ?? r?.工单号 ?? '', r?.工单行号 ?? '', r?.批次号 ?? ''].join('|')
}
/** 定位行的行级高亮类(只影响样式,不动数据/勾选) */
function rowClassName({ row }) {
  return focusKey.value && rowKeyOf(row) === focusKey.value ? 'wb-focus-row' : ''
}
/**
 * 「当前工序」格的悬停提示(2026-11-14):原「工序流转明细」展开表删除后,逐道工序的
 * 计划量/已审完工/可加工量/待流入量收到这里 —— 每行一道工序,当前工序带 ▶、深链定位的带 ★。
 * 没有工序台账(没预排产)返回空串 ⇒ title 为空,不弹空提示。
 */
function flowTip(row) {
  return flowChainTip(row && row.工序流转明细, { t: tt, fmt: flowNum, focusOp: focusOp.value })
}
/** 清掉定位痕迹(切产线/切片签/重新定位前调用) */
function clearFocus() {
  focusKey.value = ''
  focusOp.value = ''
  focusTip.value = ''
}
/** 取这条路由 query 里的深链参数(空串/undefined 一律视为没传) */
function focusQueryOf(q) {
  const out = {}
  for (const k of [...FOCUS_KEYS, ...FOCUS_ROWNO_KEYS]) {
    const v = q?.[k]
    if (v !== undefined && v !== null && String(v) !== '') out[k] = Array.isArray(v) ? String(v[0] ?? '') : String(v)
  }
  return out
}
function hasFocusQuery(q) {
  return FOCUS_KEYS.some((k) => {
    const v = q?.[k]
    return v !== undefined && v !== null && String(v) !== ''
  })
}
/** 当前路由是否就是本页(keep-alive 下 route 会变成别的页,不能拿别的页的 query 来定位) */
function onThisPage() {
  return String(route.path || '').replace(/\/+$/, '') === SELF_PATH
}
/** 用完即摘:只删这四个(可选的兜底行号一起删),其余 query(如 ?trace=)原样保留;
 *  用 replace 不新增历史记录 —— 免得用户按「后退」又回到带深链参数的地址来回触发。 */
function stripFocusQuery() {
  const q = { ...route.query }
  let dirty = false
  for (const k of [...FOCUS_KEYS, ...FOCUS_ROWNO_KEYS]) {
    if (k in q) { delete q[k]; dirty = true }
  }
  if (!dirty) return
  try { router.replace({ path: route.path, query: q })?.catch?.(() => { /* 重复导航忽略 */ }) } catch { /* 忽略 */ }
}
/** 在已取到的 schedRows 里定位目标行:rowid 精确优先,其次 加工单号(+行号) */
function findFocusRow(q) {
  const rows = schedRows.value || []
  if (q.rowid !== undefined) {
    const hit = rows.find((r) => String(r.行id) === String(q.rowid))
    if (hit) return hit
  }
  if (q.wo !== undefined) {
    const same = rows.filter((r) => String(r.加工单号 ?? r.工单号 ?? '') === String(q.wo))
    if (same.length === 1) return same[0]
    const ln = q['行号'] ?? q['rowno']
    if (same.length > 1 && ln !== undefined) {
      const hit = same.find((r) => String(r.工单行号 ?? '') === String(ln))
      if (hit) return hit
    }
  }
  return null
}
/** 把高亮行滚到表格可视区中间(容器 = 表格自己的滚动区 .el-scrollbar__wrap) */
function scrollToFocusRow() {
  const root = schedTable.value?.$el
  if (!root || !focusKey.value) return
  const tr = root.querySelector('.el-table__body tr.wb-focus-row')
    || root.querySelector('tbody tr.wb-focus-row')
  if (!tr || typeof tr.scrollIntoView !== 'function') return
  try { tr.scrollIntoView({ block: 'center', inline: 'nearest' }) } catch { /* 老浏览器忽略 */ }
}
/** 表格重排会把行位置挪一点 ⇒ nextTick 滚一次,下一帧再校正一次(幂等,不循环) */
function scheduleScroll() {
  nextTick(() => {
    scrollToFocusRow()
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => scrollToFocusRow())
  })
}
/**
 * 消费深链参数并定位(幂等:没有深链参数直接返回,所以 watch/onActivated/onMounted 都可安全调用)。
 * 顺序:摘参数 → 骨架就绪 → 按 line 选线 → 定位行 → 高亮/提示/滚动。
 */
async function consumeFocus() {
  if (!hasFocusQuery(route.query)) return
  const q = focusQueryOf(route.query)
  // 同一目标去重(keep-alive 激活 + query 变化会同 tick 各触发一次,只消费一次)
  const sig = JSON.stringify(q)
  if (focusInflight === sig) return
  focusInflight = sig
  const seq = ++focusSeq
  try {
    clearFocus()
    // 用完即摘:先摘再定位 ⇒ 后面的取数/渲染过程中即使发生路由变化,也不会再拿到这份旧参数;
    //   摘完 route.query 变化会再触发一次 watch,但那时已无深链参数 ⇒ 直接 return(不会递归)
    stripFocusQuery()
    // ① 骨架(产线列表)就绪才谈得上「按 line 选线」;onMounted 已 loadAll 时这里不重复请求
    if (!(lineSummary.value || []).length) await loadSummary()
    if (seq !== focusSeq) return
    const findLine = () => (lineSummary.value || []).find((l) => String(l.生产线) === q.line)
    let target = q.line ? findLine() : null
    // keep-alive 缓存实例里的骨架可能已过期(别处新建/启用/改名产线)⇒ 先重取一次骨架再判"找不到"
    if (!target) {
      await loadSummary()
      if (seq !== focusSeq) return
      target = q.line ? findLine() : null
    }
    if (!target) {
      // 该线不在 linesSummary(停用线被过滤/换账套/产线名改过):提示后放弃,页面照常可用
      ElMessage.warning(tt('未在工单排产中找到该工单行'))
      return
    }
    // ② 选中该线(既有 select:loadScheduled + loadDayPlan),等明细落地再找行
    await select(target)
    if (seq !== focusSeq) return
    let row = findFocusRow(q)
    // 页签口径差异(2026-11-13):生产工序进度看板自己也有「未完工/已完工/全部」筛选,从它的「已完工/全部」
    //   点工序跳来时会指到**已完工**的工单行,而本页默认停在「未完工」页签 ⇒ 明细里根本没有那一行。
    //   这时不给 warning(那会像"功能坏了"),先切到**既有「全部」页签**(纯查看动作,不改任何数据)再找一次;
    //   仍未命中才 warning。契约 §3.1 的 happy path 不受影响(未完工页签里能命中就不会走这里)。
    if (!row && scope.value !== '全部') {
      scope.value = '全部'
      await select(target)
      if (seq !== focusSeq) return
      row = findFocusRow(q)
    }
    if (!row) {
      ElMessage.warning(tt('未在工单排产中找到该工单行'))
      return
    }
    // ③ 高亮 + 上下文提示 + 滚到中间(2026-11-14:不再展开「工序流转明细」;
    //    q.op 只用于提示文案与「当前工序」悬停提示里的 ★ 标记)
    focusKey.value = rowKeyOf(row)
    focusOp.value = q.op || ''
    const no = row.加工单号 ?? row.工单号 ?? q.wo ?? ''
    const ln = row.工单行号
    let tip = tt('已定位') + '：' + no + (ln !== undefined && ln !== null && ln !== '' ? '#' + ln : '')
    if (q.op) tip += ' · ' + tt(q.op)
    focusTip.value = tip
    scheduleScroll()
  } finally {
    if (seq === focusSeq) focusInflight = ''
  }
}

async function loadAll() {
  // 刷新按钮的 loading(2026-10-17):三个请求各自内部吞异常(不阻断其余取数),
  // 故 Promise.all 只会全部成功 ⇒ finally 收口即可。
  loading.value = true
  try {
    await Promise.all([loadSummary(), loadScheduled(), loadStats()])
    await loadDayPlan()
  } finally { loading.value = false }
}

/**
 * 打开调拨弹窗(2026-10-29 收口):先问服务端「这些行的当前工序能去哪些线」——
 * 与 /transfer 的守卫同一处口径(ProcessTaskService.currentProcess + lineScope),
 * 前端不再用整条产线档案拼下拉(旧写法能把切炭单调到成型线)。
 */
async function openReassign() {
  if (!checkedSched.value.length) return
  const rows = checkedSched.value.map((r) => ({ 工单号: r.加工单号, 行id: r.行id, 工单行号: r.工单行号, 批次号: r.批次号 }))
  raLine.value = ''; raShop.value = ''; raReason.value = ''
  raOps.value = []; raShops.value = []; raLinesAll.value = []; raCan.value = false; raTip.value = ''; raLimited.value = false
  raVisible.value = true
  try {
    const res = await request.post('/px/scheduleBoard/transferTargets', { rows })
    const d = res.data || {}
    raOps.value = d['工序'] || []
    raLinesAll.value = d['产线'] || []
    raShops.value = d['车间'] || []
    raLimited.value = (d['逐行'] || []).some((x) => x['应进车间'])
    raCan.value = d['可调拨'] !== false && raLinesAll.value.length > 0
    raTip.value = d['提示'] || ''
    if (raShops.value.length === 1) raShop.value = raShops.value[0]
  } catch (e) {
    raCan.value = false
    raTip.value = e?.response?.data?.message || '调拨候选加载失败'
  }
}

// ── 取消结案(旧系统 ProSchedList 同名按钮):回退到已审核、不锁死;走 MANU_ORDER「取消结案」按钮(ManuCloseHandler) ──
async function unclose() {
  const rows = checkedSched.value.filter((r) => r.结案 === 'Y')
  if (!rows.length) { ElMessage.warning(tt('选中工单中没有已结案的')); return }
  try {
    await ElMessageBox.confirm(`${tt('确认取消选中的')} ${rows.length} ${tt('张工单的结案')}？(${tt('取消后回到已审核,可继续排产/报工')})`,
      tt('取消结案'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  const failed = []
  let done = 0
  for (const r of rows) {
    try {
      // ⚠ 行级(2026-10-15):本页的行来自 plang(参考库),取消结案必须落 plang 的**那一行** ——
      //   原来走 MANU_ORDER 按钮 → ManuCloseHandler → bd_manu_order,而 plang 单轨后该表已无本单
      //   (实测只剩 13 行历史 MO 单)⇒ 点了没反应/改错表。改调 /px/workOrderList/close(与生产工单
      //   列表页同一落点同一行键:公司代码+工单号+工单行号+批次号)。
      await request.post('/px/workOrderList/close', {
        结案: false,
        rows: [{ 公司代码: r.公司代码, 工单号: r.加工单号, 工单行号: r.工单行号, 批次号: r.批次号 }],
      })
      done++
    } catch (e) { failed.push(`${r.加工单号}${r.工单行号 != null ? ' 行' + r.工单行号 : ''}:${e?.response?.data?.message || e?.message || tt('操作失败')}`) }
  }
  if (done) ElMessage.success(`${tt('已取消结案')} ${done} ${tt('张')}` + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''))
  if (failed.length && !done) ElMessage.error(failed[0])
  loadScheduled()
  loadSummary()
}

// ── 追溯(= 工单详情,2026-10-05):**弹窗抽成共用组件 WorkOrderTraceDialog**(生产工单页也原地挂同一个,
//    用户口径「在生产工单也可以这样查看,不是跳转到工单排产」)。本页只负责:置单号 + 打开。
const traceVisible = ref(false)
const traceNo = ref('')
/** 追溯的工单行id(plang.id):同工单号可有多行/多批次,不带它会把别的行数据混进来(2026-10-15) */
const traceRowId = ref(null)

function openTrace(noParam) {
  const obj = typeof noParam === 'string' ? null : noParam
  const no = typeof noParam === 'string' ? noParam : (noParam?.['工单号'] || checkedSched.value[0]?.加工单号)
  if (!no) return
  traceNo.value = no
  traceRowId.value = obj?.['行id'] ?? checkedSched.value[0]?.['行id'] ?? null
  traceVisible.value = true
}

// ── 排单计划纸表(2026-10-31 起;2026-11-04 标题/车间列头按工序产线动态) ──
//   2026-11-01 口径「一个产线打印的排单计划只存在当前的产线东西内容」⇒ 取数带当前选中产线;
//   2026-11-03 口径「不是把当前产线的所有单据打印,而是勾选几个打印几个」⇒ 出纸前按**勾选行**过滤;
//   2026-11-04 口径「**当前在不同的工序产线显示的这个工序名称也要不同**」⇒ 纸表标题与车间列头
//     跟着本次所打产线的 生产车间 走(成型车间排单计划 / 切炭车间排单计划 / 组装车间排单计划…),
//     不再写死「成型」。取不到唯一车间(未选线且混打多工序)时由 print-formats 退回通用「排单计划」。
//   ⚠ 过滤放在前端做:接口仍按 (scope, 产线) 取数,不新增入参 —— 这是纯出纸选择交互,
//     不值得为它改后端 jar(8090 现役实例不重启也能在 5173 上验到)。
async function printPlanSheet() {
  const picked = checkedSched.value
  if (!picked.length) { ElMessage.warning(tt('请先勾选要打印的工单')); return }
  try {
    // 2026-11-01 用户口径「一个产线打印的排单计划只存在当前的产线东西内容」:
    //   带了产线 ⇒ 只取这条线;没选线(左侧未点)⇒ 退回全部产线(不让人打出一张空表)
    const res = await request.post('/px/scheduleBoard/planSheet',
      { scope: scope.value, 生产线: sel.line || undefined })
    const d = res.data || {}
    // 2026-11-03:只出勾选行(勾几张打几张);过滤是纯函数,单测在 print-formats.test.js
    const rows = pickPlanSheetRows(d['行'], picked.map((r) => r.行id))
    if (!rows.length) { ElMessage.warning(tt('没有可打印的排产行')); return }
    // 2026-11-05 客户口径:「打印的就显示 3 天或 3~4 天,这样子我们自己可以去设置」⇒
    //   起点 = 勾选行日计划里最早的日期,往后**只印 N 天**(N=右上设置按钮里的默认天数,1~10);
    //   不再印"最前→最后"的超长表(日期一多 A4 上只能压成 5~7mm,表头/数字都挤坏)。
    const dates = planSheetPrintDates(rows, d['今天'] || '', printDays.value)
    // 2026-11-04:纸表「工序名称」= 本次产线的 生产车间(车间是产线的属性,bs_prod_line.生产车间);
    //   左侧选了线就用该线的车间,没选线则交给 print-formats 从勾选行的工序里推导唯一值。
    const shop = lineSummary.value.find((l) => l.生产线 === (sel.line || rows[0]?.['生产线']))?.生产车间 || ''
    await printSchedPlanSheet(rows, d['日期'] || [], { today: d['今天'] || '', days: printDays.value, dates, shop })
  } catch (e) { err(e, '打印失败') }
}

// ── 打印工单(两模板可选,2026-09-27):成型/组装生产任务单 = 行表直打;打印留痕 printStamp ──
//    ⚠ 2026-10-14 「生产投料单」模板下线:物料行全部来自自建 BOM(/px/workOrderBom → bs_bom),
//      随 MES 自建 BOM 功能整体删除,前端已无替代数据源。
async function printTask(mode) {
  const rows = checkedSched.value
  if (!rows.length) return
  // 成型生产任务单的「成型折算后数量」(2026-11-15 用户截图报障):原来直接印 排产数量(成品口径)
  //   ⇒ 成型换算率 0.5 的单印出 50,应为 25。现按统一函数 moldPlanQty 取**成型工序计划量**
  //   (与生产工单页同一实现;取不到 detail 时用 当前工序计划量 / 排产数量 逐级回退)。
  const moldQty = {}
  if (mode === '成型生产任务单') {
    await Promise.all(rows.map(async (r) => {
      try {
        const d = (await request.post('/px/processTask/detail', { 工单号: r['加工单号'], 工单行id: r['行id'] })).data || {}
        moldQty[r['行id']] = moldPlanQty(r, d)
      } catch { moldQty[r['行id']] = moldPlanQty(r, null) }
    }))
  }
  const rowsToPrint = rows.map((r) => ({
    单据编号: r.加工单号,
    公司代码: r.公司代码 || '', 工单行号: r.工单行号, // 工单二维码=公司代码@工单号@1000+工单行号(2026-10-09 规则改版)
    是否重点管控产品: r.重点管控 || '',
    商品编码: r.物料编码 || '',
    商品名称: r.产品名称 || '',
    规格型号: r.规格型号 || '',
    订单数量: r.需求数量,
    成型折算后数量: moldQty[r['行id']] ?? moldPlanQty(r, null),
    计划完工日期: r.计划完工日期 || '',
    批号: r.批号 || '', 物料编码: r.物料编码 || '',
    排产数量: r.行来源 === '本线工序' ? (r.本线排产数量 ?? r.排产数量) : r.排产数量, 生产线: r.生产线 || sel.line || '',
    工序: r.当前工序 || '',
  }))
  // 纸面不印打印日期/制单人/线体(2026-10-21 用户口径)⇒ 无选项要传
  const okPrint = await printWorkTaskSheet(mode, rowsToPrint)
  if (!okPrint) return
  try {
    // 行级留痕(2026-10-15):带 行id + 公司代码 + 批次号,后端按 plang.id 精确定位(原只传加工单号,
    //   而后端打的是 bd_manu_order ⇒ plang 单轨后留痕落空)
    await request.post('/px/scheduleBoard/printStamp', {
      rows: rows.map((r) => ({ 加工单号: r.加工单号, 行id: r.行id, 公司代码: r.公司代码, 工单行号: r.工单行号, 批次号: r.批次号 })),
    })
  } catch (e) { /* 留痕失败不阻断打印 */ }
  ElMessage.success(tt('已发送打印') + ' ' + rows.length + ' ' + tt('张'))
  loadScheduled()
}

/**
 * 调拨(9.29 批次②;2026-10-29 收口):勾选已排工单 → 目标产线(**只能是当前工序的线**)+ 原因 →
 * 写 `wo_transfer_log` 轨迹。下拉来自 /transferTargets;服务端还会逐行复核(不信任前端)。
 */
async function doTransfer() {
  if (!raCan.value) { ElMessage.warning(tt('没有可调拨的目标产线')); return }
  if (!raLine.value) { ElMessage.warning(tt('请选择目标生产线')); return }
  // 行级(2026-10-15):必须带 行id —— 同工单多行同批次号时,(工单号+批次号) 无法唯一定位;
  //   后端 WorkOrderTransferService 优先按 行id 精确到行(缺 行id 才退回整单/批次)
  const rows = checkedSched.value.map((r) => ({ 工单号: r.加工单号, 行id: r.行id, 工单行号: r.工单行号, 批次号: r.批次号 }))
  try {
    await ElMessageBox.confirm(`${tt('确认调拨')} ${rows.length} ${tt('张工单')} → ${raLine.value}？`, tt('工单调拨'),
      { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.post('/px/scheduleBoard/transfer', {
      rows, 目标生产线: raLine.value, 目标车间: raShop.value || undefined, 原因: raReason.value || undefined,
    })
    const d = res.data || {}
    const failed = d['失败行'] || []
    ElMessage.success(`${tt('已调拨')} ${d['调拨张数']} ${tt('张')} → ${d['目标']}`
      + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''))
    raVisible.value = false
    loadScheduled()
    loadSummary()
  } catch (e) { err(e, '调拨失败') }
}

/** 撤回调拨:按工单最后一条生效轨迹把产线调回原线(轨迹标撤销,留痕不删) */
async function doTransferRevoke() {
  // 行级(2026-10-15):带 行id —— 撤回只撤**该行**的最后一条轨迹(不带则撤整单最后一条,可能撤错行)
  const rows = checkedSched.value.map((r) => ({ 工单号: r.加工单号, 行id: r.行id, 工单行号: r.工单行号, 批次号: r.批次号 }))
  if (!rows.length) return
  try {
    await ElMessageBox.confirm(`${tt('撤回调拨')} ${rows.length} ${tt('张工单')}？(${tt('调回原产线,轨迹留痕')})`,
      tt('撤回调拨'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消'), type: 'warning' })
  } catch { return }
  try {
    const res = await request.post('/px/scheduleBoard/transferRevoke', { rows })
    const d = res.data || {}
    const failed = d['失败行'] || []
    ElMessage.success(`${tt('已撤回')} ${d['撤回张数']} ${tt('张')}`
      + (failed.length ? `（${tt('跳过')} ${failed.length}：${failed[0]}）` : ''))
    loadScheduled()
    loadSummary()
  } catch (e) { err(e, '撤回调拨失败') }
}

// ── 「转领料」已随 MES 自建 BOM 下架移除(2026-10-04) ──
//    原实现:勾选已排工单 → 按默认 BOM×排产数量 生成材料出库单草稿(后端 /px/scheduleBoard/toPicking
//    + ScheduleBoardService.toPicking + BOM 表 bs_bom,均已同期删除)。领料单改为在「材料出库单」面板手工
//    新增/选单;若日后要恢复自动带料,需先有新的用料来源(如金蝶 BOM 接口)。
//    **2026-10-07 补**:生产工单列表页新增「转领料单」(WorkOrderList.vue + /px/workOrderList/toPicking,
//    由原「打印领料单」改来)——只转单头(加工单号=工单号)、明细仍由仓库在材料出库单里补,故本页不重复造入口。
//    **2026-10-18 补**:口径改为「先排产后领料」——本页(排产)是领料的前置:转领料单要求该工单行
//    已排入产线(scx 非空)且排产数量>0;同一工单行可开多张领料单(见 WorkOrderPickingService)。

// ── 挂载 / keep-alive 激活 / 路由 query 变化:三条入口都走同一个幂等的 consumeFocus ──────────
//   ⚠ 本页在 PortalLayout 里被 <keep-alive :max="20"> 按 route.path 缓存 ⇒ 从别的页签切回来、
//     或从「生产工序进度看板」再次点工序进来(同一个 path 只变 query)**不会重新挂载**,
//     所以必须有 watch(route.query) 与 onActivated 兜住,只在 onMounted 里做会漏掉后续跳入。
/** 首次 onActivated 紧接着 onMounted 触发(深链的活由 onMounted 负责)⇒ 跳过它,避免同一次进入跑两遍 */
let firstActivated = true

onMounted(async () => {
  // 外部跳入(生产加工单列表「追溯」):?trace=工单号 直开追溯弹窗
  //   ⚠ 必须在下面 await 之前同步读:深链的 stripFocusQuery 会 router.replace 重写 query
  const q = new URLSearchParams(location.hash.split('?')[1] || '')
  const tno = q.get('trace')
  // 列设置(2026-11-18):**先把后端保存的显隐/顺序应用上**,再取数渲染 —— 否则首帧按全列闪一下,
  //   列多的表还会明显重排一次。initColumns 自带缓存/异常兜底(读不到 = 全部可见,与旧行为一致)。
  await initColumns()
  // 先跑完既有首屏取数(骨架+明细+统计+日计划),再消费深链 —— 深链要按 line 选线并定位行,
  // 必须等 linesSummary 落地;反过来则会与 loadAll 的取数互相覆盖。
  await loadAll()
  await consumeFocus()
  if (tno) setTimeout(() => openTrace(tno), 600)
})

onActivated(() => {
  if (firstActivated) { firstActivated = false; return }
  consumeFocus()
})

watch(() => route.query, () => {
  // keep-alive 缓存实例:切到别的页签时 route 已变成那页,不能拿它的 query 来定位本页
  if (!onThisPage()) return
  consumeFocus()
})
</script>

<style scoped>
.wb-page { padding: 10px 14px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #f9f9f9; }
.wb-top { display: flex; align-items: center; gap: 14px; padding: 8px 12px; background: #1e6fb8; color: #fff; border-radius: 4px; }
.wb-title { font-weight: 600; }
.wb-top .wb-stats { margin-left: auto; font-weight: 600; }
.wb-p { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #606266; }
/* 历史欠产汇总条(2026-11-13 用户口径「当天结束后未完成会进行提示」):浅红底/红边/红字,
   与页面现有块(4px 圆角、8px 行距)同风格;只占一行、放不下时整块换行,不横向撑破版面。
   hint 灰字说明「标红格」的含义;明细在 :title 里(悬停看,不弹窗)。 */
.wb-short-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 14px;
  padding: 6px 12px; background: #fef0f0; border: 1px solid #fbc4c4; border-radius: 4px;
  color: #f56c6c; font-size: 12px; line-height: 1.5; cursor: help; }
.wb-short-main { font-weight: 700; }
.wb-short-hint { color: #909399; }
.wb-body { display: flex; gap: 8px; flex: 1; min-height: 0; }
.wb-left { width: 210px; flex: none; background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; overflow: auto; }
.wb-left-head { padding: 8px 10px; font-weight: 600; font-size: 13px; color: #116a5b; border-bottom: 1px solid #e4e7ed; }
.wb-line { padding: 6px 10px; border-bottom: 1px dashed #ebeef5; cursor: pointer; }
.wb-line:hover { background: #f5f7fa; }
.wb-line.active { background: #e6f3ef; }
.wb-line.off .wb-line-name { color: #909399; }
.wb-line-name { font-size: 12px; color: #303133; font-weight: 600; display: flex; align-items: center; gap: 6px; }
/* 左侧行次行「已报 X · 未完工 Y」(2026-11-12):11px 灰字;左栏固定 210px ⇒ 单行省略,
   长数字(如 12345)也不换行、不横向撑破;字段缺失时模板整行不渲染 */
.wb-line-sub { margin-top: 1px; font-size: 11px; color: #909399; line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 左侧行:主数字(=本线排产数量) + 今日已排/日产能小标签;窄栏放不下时换行,不溢出 */
.wb-line-row { display: flex; align-items: center; justify-content: space-between; gap: 2px 6px; flex-wrap: wrap; margin-top: 2px; }
.wb-tag { font-size: 11px; padding: 0 6px; border-radius: 3px; cursor: pointer; }
.wb-tag.open { background: #67c23a; color: #fff; }
.wb-tag.closed { background: #f56c6c; color: #fff; }
.wb-tag.off-line { background: #909399; color: #fff; cursor: default; }
.wb-qty { font-weight: 600; color: #303133; font-size: 12px; font-variant-numeric: tabular-nums; }
.wb-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.wb-ctx { display: flex; align-items: center; gap: 14px; padding: 8px 10px; background: #eef6ff; border: 1px solid #b3d4f5; border-radius: 4px; flex-wrap: wrap; }
.wb-ctx-label { font-size: 13px; color: #606266; }
.wb-shop-group { padding: 6px 10px 2px; font-size: 12px; font-weight: 600; color: #116a5b; background: #f5f7fa; display: flex; justify-content: space-between; }
.wb-shop-cnt { color: #909399; font-weight: 400; }
.wb-shop { margin-left: 12px; font-size: 12px; color: #e6a23c; font-weight: 600; }
/* 调拨弹窗的"不可调拨/无候选线"提示(2026-10-29):后端中文原样显示,前端只给颜色 */
.wb-warn { color: #f56c6c; font-weight: 600; }
/* ── 调拨弹窗两列表单(2026-10-30 用户报障「排列有问题,不要把表格挤在一起」)──
   旧写法每行都是 inline-flex + 标签自然宽度 + 固定 220px 控件:标签一长一短,控件起点参差,
   行与行只靠相邻 div 的默认间距 ⇒ 看起来挤成一团。改成:标签定宽 84px 右对齐、控件 flex:1 同一起点、
   行间距 14px;有提示时单独占一行(与控件左缘对齐)。 */
.ra-form { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px 8px; }
.ra-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ra-label { flex: 0 0 84px; text-align: right; font-size: 13px; line-height: 1.5; color: #606266; }
.ra-value { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; color: #303133; }
.ra-ctl { flex: 1; width: 100%; min-width: 0; }
.ra-hint { font-size: 12px; font-weight: 600; color: #e6a23c; }
.ra-tip { flex: 1; min-width: 0; font-size: 12px; font-weight: 600; line-height: 1.6; color: #f56c6c; }
.ra-note { margin-top: 6px; padding-top: 10px; border-top: 1px dashed #ebeef5; font-size: 12px; line-height: 1.6; color: #909399; }
/* 顶部「本线排产数量 | 已报完工量 | 未完工量」(2026-11-12 改工序口径):整块不拆行,
   放不下时由 .wb-ctx 的 flex-wrap 整块换到第二行;窗口再窄才内部省略(不横向撑出滚动条);
   cursor:help 提示有 tooltip(成品口径未交量合计) */
.wb-ctx-stats { margin-left: auto; font-size: 12px; color: #1e6fb8; font-weight: 600; white-space: nowrap;
  cursor: help; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.wb-block { background: #fff; border: 1px solid #e4e7ed; border-radius: 4px; flex: 1; min-height: 0; display: flex; flex-direction: column; }
/* 日排产日期列(2026-10-29;2026-10-31:自动均摊 + 双击就地改):上=当天计划,下=当天已审核报工量 */
.dp-plan { color: #303133; font-weight: 600; line-height: 1.2; cursor: text; }
/* 2026-10-31 融合显示:当天有报工 ⇒ 绿色(2026-11-13 起格内是 `原计划/报工` 两数,整格标绿);
   没报工显示计划(深色) */
.dp-plan.actual { color: #529b2e; }
/* 2026-11-01:本行排产区间(开工日~计划完工日)之外的空白格画「/」——
   一眼看出那一天**不归本行排**(例:开工日改成 11-02 后,11-01 就是斜杠,而不是空着像漏排) */
.dp-out { color: #c0c4cc; font-weight: 400; line-height: 1.2; user-select: none; }
.dp-input { width: 66px; }
/* 人工指定过的格子加粗变色 + 「手」角标;超分配时角标标红(只提示,不拦保存) */
.dp-plan.manual { color: #b88230; }
/* 2026-11-13 历史欠产:日期 < 今天 且 报工 < 原计划 ⇒ 整格红色加粗。
   放在 .actual / .manual **之后**(同优先级靠后生效),保证「既有报工又欠产」的格子是红色而不是绿色/橙色。 */
.dp-plan.short { color: #f56c6c; font-weight: 700; }
.dp-hand { margin-left: 2px; padding: 0 2px; font-size: 10px; font-weight: 700; color: #fff;
  background: #e6a23c; border-radius: 3px; vertical-align: top; }
.dp-hand.over { background: #f56c6c; }
.dp-input { width: 66px; }
/* 2026-10-31:就地改排产日期(双击开工日/计划完工日) */
.dp-date-cell { cursor: text; }
.dp-date-cell:hover { color: #1e6fb8; text-decoration: underline dotted; }
/* 2026-10-31:格内两个数分清 —— 计划(深色,可编辑) / 报工(绿色 + 「实」标,只读)*/
.dp-act { font-size: 11px; color: #529b2e; line-height: 1.1; }
.dp-act-lb { margin-right: 1px; font-weight: 700; }
/* 日期列分段:今天列标「今」+ 浅蓝底;过去列 = 历史对照段,灰底(只影响显示,照样可填)*/
.dp-today { margin-left: 2px; font-size: 10px; font-weight: 700; color: #1e6fb8; }
.dp-head.past .dp-date { color: #909399; font-weight: 500; }
:deep(th.dp-col-past), :deep(td.dp-col-past) { background: #f5f6f8; }
:deep(th.dp-col-today), :deep(td.dp-col-today) { background: #eef6ff; }
/* ── 产能可见(2026-10-31 用户口径「产能只显示、不拦截」)──
   列头两行:日期 + 该线当天「已排/日产能」;超产能只标红,不弹窗、不改数、不禁填。
   未配产能(档案日产能 0/空)写"未配",不参与超载判定。 */
.wb-over { margin-left: 12px; font-size: 12px; color: #fff; opacity: .85; }
.wb-over.hot { color: #ffe58f; font-weight: 700; opacity: 1; }
.wb-daycap { font-size: 11px; color: #909399; }
.wb-daycap.over { color: #f56c6c; font-weight: 700; }
.wb-daycap.unset { color: #c0c4cc; }
.dp-head { line-height: 1.15; }
.dp-date { font-weight: 600; color: #303133; }
.dp-cap { font-size: 10px; color: #909399; font-weight: 400; }
.dp-head.over .dp-date, .dp-head.over .dp-cap { color: #f56c6c; font-weight: 700; }
.dp-cap.unset { color: #c0c4cc; }
.dp-warn { color: #e6a23c; font-weight: 600; }
.dp-unset { color: #c0c4cc; }
.wb-head { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-bottom: 1px solid #e4e7ed; flex-wrap: wrap; }
.wb-block-title { font-weight: 600; font-size: 13px; color: #303133; }
.wb-actions { margin-left: auto; }
.wb-print-set { padding: 5px 7px; }
.wb-print-set-form { padding-top: 4px; }
.wb-print-set-hint { margin-top: 6px; font-size: 12px; line-height: 1.6; color: #909399; }
.wb-closed { color: #f56c6c; font-weight: 600; }
/* 按量流转「待流入量」>0 = 还在等上一道流下来,标橙提示 */
.wb-flow-gap { color: #e6a23c; font-weight: 600; }
/* 按量流转·逐道明细的展开行样式(2026-11-14 用户口径删除,数字改到「当前工序」悬停提示):
   已随 <el-table-column type="expand"> 一并撤掉,别再把 .wb-flow-box/.wb-flow-tbl 找回来 */
.wb-trace-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.wb-trace-no { font-size: 16px; font-weight: 700; color: #1e6fb8; }
.wb-trace-desc { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: #606266; background: #fdf6ec; border: 1px solid #f5dab1; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; }
.wb-trace-block { margin-bottom: 12px; }
.wb-trace-block .wb-block-title { display: block; border-left: 3px solid #1e6fb8; padding-left: 8px; margin-bottom: 6px; }
.wb-trace-sub { font-size: 12px; color: #909399; margin: 6px 0 4px; }

/* ── 深链定位(2026-11-13,契约 CONTRACT.md §3.1)──────────────────────────────────
   从「生产工序进度看板」点某道工序跳过来时,告诉用户"定位到哪一行、哪一道工序":
   ① 上下文区一枚小提示(与上下文条同色系,不抢眼);② 命中行浅蓝底 + 左侧 3px 蓝边。
   (2026-11-14 展开区删除后,原 ③「展开区里定位那道工序再标一次」不再存在;
    那道工序改为在「当前工序」悬停提示里打 ★,见 business/woFlowChain.js)
   全部是静态样式(不用发光动画):截图/打印稳定,也符合本页"信息为主"的风格。 */
.wb-focus-tip { padding: 1px 8px; background: #ecf5ff; border: 1px solid #b3d4f5; border-radius: 3px;
  font-size: 12px; font-weight: 600; color: #1e6fb8; white-space: nowrap; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; }
/* 命中行:选择器要压过 el-table 自带的 hover-row / current-row / striped 底色(那些带 2~3 个类),
   故这里同时写 :hover 与 .hover-row 两条;固定列(sticky)与滚动区在同一张 table 里,行类一并生效。 */
:deep(.el-table__body tr.wb-focus-row > td.el-table__cell),
:deep(.el-table__body tr.wb-focus-row:hover > td.el-table__cell),
:deep(.el-table__body tr.wb-focus-row.hover-row > td.el-table__cell) { background-color: #ecf5ff; }
:deep(.el-table__body tr.wb-focus-row > td.el-table__cell:first-child) { box-shadow: inset 3px 0 0 #409eff; }
</style>
