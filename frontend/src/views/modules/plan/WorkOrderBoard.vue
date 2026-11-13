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
     `DayPlanSpread.mergeReported` 向今天及以后重排,前端只负责显示。 -->
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
         shortInfo.count = 0 ⇒ 整条不渲染(老后端/老数据自然降级,不出假提示)。 -->
    <div v-if="shortInfo.count" class="wb-short-bar" :title="shortTitle">
      <span class="wb-short-main">
        {{ tt('历史未完成') }} {{ shortInfo.count }} {{ tt('处') }} · {{ tt('合计欠产') }} {{ num(shortInfo.qty) }}
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
          <el-table :data="schedRows" size="small" border height="100%" empty-text=""
                    @selection-change="(r) => (checkedSched = r)">
            <el-table-column type="selection" width="42" />
            <!-- 按量流转·逐道明细(2026-11-12 方案A):一行只显示"当前工序",后道必须展开才看得到;
                 展开区渲染后端给的「工序流转明细」,只读。 -->
            <el-table-column type="expand" width="30">
              <template #default="{ row }">
                <div class="wb-flow-box">
                  <div class="wb-flow-title">{{ tt('工序流转明细') }}（{{ tt('按量流转:上一道报多少,下一道最多做多少') }}）</div>
                  <table class="wb-flow-tbl">
                    <thead>
                      <tr>
                        <th>{{ tt('工序') }}</th>
                        <th class="num">{{ tt('换算率') }}</th>
                        <th class="num">{{ tt('计划量') }}</th>
                        <th class="num">{{ tt('可加工量') }}</th>
                        <th class="num">{{ tt('已审完工') }}</th>
                        <th class="num">{{ tt('待报量') }}</th>
                        <th class="num">{{ tt('待流入量') }}</th>
                        <th>{{ tt('状态') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(f, i) in (row.工序流转明细 || [])" :key="i" :class="{ 'is-cur': f.当前 }">
                        <td>{{ tt(f.工序) }}</td>
                        <td class="num">{{ flowNum(f.换算率) }}</td>
                        <td class="num">{{ flowNum(f.计划量) }}</td>
                        <td class="num">{{ flowNum(f.可加工量) }}</td>
                        <td class="num">{{ flowNum(f.已审完工) }}</td>
                        <td class="num">{{ flowNum(f.待报量) }}</td>
                        <td class="num" :class="{ 'wb-flow-gap': Number(f.待流入量 || 0) > 0 }">{{ flowNum(f.待流入量) }}</td>
                        <td>{{ tt(f.状态) }}</td>
                      </tr>
                      <tr v-if="!(row.工序流转明细 || []).length">
                        <td colspan="9" class="empty">{{ tt('该工单行没有工序台账(没预排产)') }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </el-table-column>
            <!-- ══════════ 冻结区(2026-11-08 用户口径)══════════
                 用户原话:「排单界面物产品编码、产品规格、订单数量,显示在前面冻结,方便看。……进行修改还需要
                 考虑当前冻结后如何显示其他的信息对其他信息进行处理要如何实现。」
                 做法 = 把行身份拆成两块,按 el-table 的 fixed 列**声明在前即渲染在最左**:
                   ① 工单身份:勾选 / 工单号 / 客户(原有冻结,保留);
                   ② 产品身份:**产品编码 / 产品规格 / 订单数量**(新增冻结,宽度收到 110/120/84 —— 表格列已
                      30+ 列,冻结区一宽会挤掉滚动区;长值一律走 show-overflow-tooltip/title,不靠拉宽列)。
                 其余列(工单行号/排产日期/客户PO/产品名称/单位/批号/重点管控/日期列/工序/统计…)留在**横向滚动区**,
                 滚到右边看日期/报工时左侧始终能看到"哪张工单、哪个产品、订单要多少";原来夹在滚动区里的
                 「物料编码/规格型号/需求数量」三列随即删除(**位置前移,不复制**,避免同一信息出现两次)。
                 ⚠ 订单数量 = plang.xq_sl(需求数量/本次转单量;2026-11-08 起备品场景可大于销售订单数量),
                   表头 tooltip 写清,免得与旁边的「排产数量」混。 -->
            <el-table-column :label="tt('工单号')" prop="加工单号" width="140" fixed />
            <el-table-column :label="tt('产品编码')" prop="物料编码" width="110" fixed show-overflow-tooltip />
            <el-table-column :label="tt('产品规格')" prop="规格型号" width="120" fixed show-overflow-tooltip />
            <el-table-column prop="需求数量" width="84" align="right" fixed>
              <template #header>
                <span :title="tt('订单数量 = 本行需求数量(本次转单量);备品场景可大于销售订单数量')">{{ tt('订单数量') }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('客户')" prop="客户" min-width="110" fixed show-overflow-tooltip />
            <!-- ── 以下为横向滚动区(不冻结)── -->
            <el-table-column :label="tt('工单行号')" prop="工单行号" width="90" sortable />
            <el-table-column :label="tt('排产日期')" prop="排产日期" width="95" />
            <el-table-column :label="tt('客户PO')" prop="客户PO" width="110" show-overflow-tooltip />
            <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="140" show-overflow-tooltip />
            <el-table-column :label="tt('单位')" prop="单位" width="55" />
            <el-table-column :label="tt('批号')" prop="批号" width="100" show-overflow-tooltip />
            <el-table-column :label="tt('重点管控')" prop="重点管控" width="80" />
            <!-- 排产日期(2026-10-31):就地改「开工日 / 计划完工日」—— 双击进 date-picker;
                 后端同步 plang + plang_pc + 工序台账区间(用户口径「该日期要同步吧」)。 -->
            <el-table-column :label="tt('开工日期')" prop="开工日期" width="105">
              <template #default="{ row }">
                <span class="dp-date-cell" :title="tt('双击可改排产日期')"
                      @dblclick="openQuick(row, planToday)">{{ row.开工日期 || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('计划完工日期')" prop="计划完工日期" width="115">
              <template #default="{ row }">
                <span class="dp-date-cell" :title="tt('双击可改排产日期')"
                      @dblclick="openQuick(row, planToday)">{{ row.计划完工日期 || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('实际完工日期')" prop="实际完工日期" width="105" />
            <!-- 本线排产数量(2026-11-11 用户口径):本页一行 = 一张工单行在**当前产线**做**当前工序**,
                 所以「排产数量」列要看的是**本线要排/要做的量** = 排产数量 × 该道换算率
                 (= 该行当前工序的台账计划数量,接口既有字段 `当前工序计划量`)。
                 成品口径的排产数量 pl_sl 仍由接口返回,供打印/切单/未交量/领料使用 —— 本列不改任何数据。 -->
            <el-table-column prop="本线排产数量" width="110" align="right">
              <template #header>
                <span :title="tt('本线排产数量 = 排产数量 × 该工序自己的换算率(取该行当前工序的台账计划数量);成品口径请用左侧「订单数量」')">{{ tt('本线排产数量') }}</span>
              </template>
              <!-- 后端 scheduled() 已返回同值别名 本线排产数量;老服务/老数据取不到时回退既有字段 当前工序计划量 -->
              <template #default="{ row }">{{ num(row['本线排产数量'] ?? row['当前工序计划量']) }}</template>
            </el-table-column>
            <el-table-column :label="tt('入库数量')" prop="入库数量" width="90" align="right" />
            <!-- 工序口径(2026-11-12 用户口径「这些数据完成需要放在前面…放在工序那边」):
                 工序块从左到右读成一条链 ——
                 当前工序 → 本道计划量 → 本道已做 → 上道工序/上道已做 → 能做多少 → 还能报 → 还缺。
                 上道工序/上道完工量从原来的"日期列后面"前移到这里;未交量属整单口径,留在原位不动。 -->
            <el-table-column :label="tt('当前工序')" prop="当前工序" width="95" sortable>
              <template #default="{ row }">{{ row.当前工序 ? tt(row.当前工序) : '-' }}</template>
            </el-table-column>
            <el-table-column :label="tt('当前工序计划量')" prop="当前工序计划量" width="120" align="right" />
            <el-table-column :label="tt('当前工序完工量')" prop="当前工序完工量" width="120" align="right" />
            <el-table-column :label="tt('上道工序')" prop="上道工序" width="95">
              <template #default="{ row }">{{ row.上道工序 ? tt(row.上道工序) : '-' }}</template>
            </el-table-column>
            <el-table-column width="110" align="right">
              <template #header>
                <span :title="tt('上道完工量 = 上一道已审核报工数(上一道自己的计量单位,不折算);换算率不同时,本道能做多少看「可加工量」')">{{ tt('上道完工量') }}</span>
              </template>
              <template #default="{ row }">{{ flowNum(row.上道完工量) }}</template>
            </el-table-column>
            <!-- 按量流转(2026-11-12,只读展示):可加工量(= 上一道流下来、本道现在最多能做多少) /
                 待报量(还能报) / 待流入量(还等上一道)。上道做了多少看上面前移的「上道完工量」。 -->
            <el-table-column width="100" align="right">
              <template #header>
                <span :title="tt('可加工量 = 上一道流下来的量(已按换算率折到本道单位),也就是本道现在最多能做多少')">{{ tt('可加工量') }}</span>
              </template>
              <template #default="{ row }">{{ flowNum(row.当前工序可加工量) }}</template>
            </el-table-column>
            <el-table-column width="92" align="right">
              <template #header>
                <span :title="tt('待报量 = 可加工量 − 本工序已审报工(本道还能报多少)')">{{ tt('待报量') }}</span>
              </template>
              <template #default="{ row }">{{ flowNum(row.当前工序待报量) }}</template>
            </el-table-column>
            <el-table-column width="100" align="right">
              <template #header>
                <span :title="tt('待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)')">{{ tt('待流入量') }}</span>
              </template>
              <template #default="{ row }">
                <span :class="{ 'wb-flow-gap': Number(row.当前工序待流入量 || 0) > 0 }">{{ flowNum(row.当前工序待流入量) }}</span>
              </template>
            </el-table-column>
            <!-- 日排产(2026-10-29):直接长在现有明细表里(不新增表格/块),紧跟工序完工口径。
                 每个日期格都可填计划(含今天以前的日期 —— 用户口径「23~28 号填不了」);
                 格下方小灰字 = 该天已审核报工量(含手机端),只读。 -->
            <el-table-column :label="tt('交期紧迫度')" prop="交期紧迫度" width="90" align="right" />
            <el-table-column :label="tt('7天需交付')" prop="7天需交付" width="92" align="right" />
            <el-table-column :label="tt('15天需交付')" prop="15天需交付" width="96" align="right" />
            <el-table-column :label="tt('大于15天需交付')" prop="大于15天需交付" width="112" align="right" />
            <el-table-column :label="tt('7天已排')" prop="7天已排" width="88" align="right" />
            <el-table-column :label="tt('15天已排')" prop="15天已排" width="92" align="right" />
            <el-table-column :label="tt('大于15天已排')" prop="大于15天已排" width="108" align="right" />
            <!-- 日期列(2026-10-31;2026-11-13 改「原计划/报工」两数):列头多一行「该线当天 已排/日产能」
                 ——产能只显示、不拦截录入。超产能只把列头标红(不弹窗、不改数、不禁填);
                 未配产能(档案日产能 0/空)写"未配",不判超载。
                 列分段:今天列标「今」+ 浅蓝底;过去列灰底 = 历史对照段;
                 格内 = **原计划/报工**(例 715/15;没报工只显示计划;当天已结束且原计划>0没报工 =
                 `原计划/0`);日期 < 今天且报工 < 原计划 ⇒ 该格标红(short),顶部另有红色汇总条。 -->
            <el-table-column v-for="d in planDates" :key="d" width="88" align="center"
                             :label-class-name="'dp-col-' + dayColState(d, planToday)"
                             :class-name="'dp-col-' + dayColState(d, planToday)">
              <template #header>
                <div class="dp-head" :class="{ over: isOverDay(d), past: dayColState(d, planToday) === 'past' }"
                     :title="dayHeadTitle">
                  <div class="dp-date">{{ d.slice(5) }}<span v-if="isToday(d, planToday)" class="dp-today">{{ tt('今') }}</span></div>
                  <div v-if="lineCap > 0" class="dp-cap" :title="tt('该线当天已排/日产能')">
                    {{ qtyText(dayTotal[d]) }}/{{ qtyText(lineCap) }}
                  </div>
                  <div v-else class="dp-cap unset" :title="tt('产线档案未配日产能,不做超载提示')">{{ tt('未配产能') }}</div>
                </div>
              </template>
              <template #default="{ row }">
                <el-input-number v-if="qtyEdit === qtyKey(row, d)" v-model="qtyDraft" size="small"
                                 :controls="false" :min="0" class="dp-input" autofocus
                                 @blur="commitQty(row, d)" @keyup.enter="commitQty(row, d)" @keyup.esc="cancelQtyEdit" />
                <!-- 区间外(开工日~计划完工日之外)且当天无计划/原计划/实报:画「/」——这一天不归本行排
                     (2026-11-01 用户口径;例:开工日改成 11-02 后,11-01 的格子要画斜杠) -->
                <span v-else-if="isOutCell(row, d)" class="dp-out"
                      :title="tt('不在本行排产区间(开工日~计划完工日)内')">/</span>
                <span v-else class="dp-plan"
                      :class="{ manual: isManual(row, d), actual: cell(row, d).hasActual, short: cell(row, d).short > 0 }"
                      :title="dayTitle(row, d)" @click="startQtyEdit(row, d)">
                  {{ cell(row, d).text }}<span v-if="isManual(row, d)" class="dp-hand"
                    :class="{ over: Number(row.超分配 || 0) > 0 }" :title="overTitle(row)">{{ tt('手') }}</span>
                </span>
              </template>
            </el-table-column>
            <!-- 成品口径:未交量 = 排产数量 − 入库数量(此前误减工序口径报工量 ⇒ 换算率 >1 时出负数)
                 ⚠ 2026-11-12 用户口径:未交量是**整张工单**的口径,不属于工序块 ⇒ 保持原位(日期列之后),
                   不随「上道工序/上道完工量」一起前移到工序列。 -->
            <el-table-column :label="tt('未交量')" prop="未交量" width="85" align="right" />
            <!-- 「余量」列已隐藏(2026-11-08 用户口径「直接隐藏吧」):它是「本工单行需求 − 本行订单占用」
                 (form_flow_link SO→PLANG)的口径 —— 新口径下需求=转单量、占用链也写同一个数,余量恒为 0
                 (正式库实测 399 行里 397 行为 0),与「当前工序还剩多少未生产」无关、极易误读;
                 后台字段照旧返回,只是界面不再展示。要看"还剩多少":用左侧「未交量」(排产−入库)
                 或「当前工序计划量/当前工序完工量」。要恢复:把下面这行放开即可。 -->
            <!-- <el-table-column :label="tt('余量')" prop="余量" width="80" align="right" /> -->
            <el-table-column :label="tt('操作员')" prop="操作员" width="80" />
            <el-table-column :label="tt('备注')" prop="备注" min-width="100" show-overflow-tooltip />
            <el-table-column :label="tt('领料单号')" prop="领料单号" width="120" show-overflow-tooltip />
            <el-table-column :label="tt('入库单号')" prop="入库单号" width="120" show-overflow-tooltip />
            <el-table-column :label="tt('结案')" width="70">
              <template #default="{ row }">
                <span :class="row.结案 === 'Y' ? 'wb-closed' : ''">{{ row.结案 === 'Y' ? tt('已结案') : '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="tt('结案人')" prop="结案人" width="80" />
            <el-table-column :label="tt('结案时间')" prop="结案时间" width="130" />
            <el-table-column :label="tt('打印人')" prop="打印人" width="80" />
            <el-table-column :label="tt('打印时间')" prop="打印时间" width="130" />
            <el-table-column :label="tt('打印次数')" prop="打印次数" width="80" align="right" />
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { printWorkTaskSheet, printSchedPlanSheet, pickPlanSheetRows, planSheetPrintDates, PLAN_SHEET_DEFAULT_DAYS } from '@/business/print-formats'
import { Setting } from '@element-plus/icons-vue'
import { tt } from '@/i18n'
import WorkOrderTraceDialog from './WorkOrderTraceDialog.vue'
import ScheduleQuickEditDialog from './ScheduleQuickEditDialog.vue'
import { qtyText, isOverCapacity, dayColState, isToday, isPast, isOutOfPlanRange,
  dayCellView, historyShortfalls, shortfallTotals } from '@/business/dayPlan'
import { fetchDayPlan, saveDayPlan } from '@/business/dayPlanApi'
import { useUserStore } from '@/stores/user'
import { canDo as canDoPerm, canDoAny } from '@core/auth/panelAccess'

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

function select(l) {
  sel.line = l.生产线
  loadScheduled().then(() => loadDayPlan())
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

/** 页签(未完工/已完工/全部)变化:排产明细 + 日排产一起换 */
function onScope() {
  loadScheduled().then(() => loadDayPlan())
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
  const rowsToPrint = rows.map((r) => ({
    单据编号: r.加工单号,
    公司代码: r.公司代码 || '', 工单行号: r.工单行号, // 工单二维码=公司代码@工单号@1000+工单行号(2026-10-09 规则改版)
    是否重点管控产品: r.重点管控 || '',
    商品编码: r.物料编码 || '',
    商品名称: r.产品名称 || '',
    规格型号: r.规格型号 || '',
    订单数量: r.需求数量,
    成型折算后数量: r.行来源 === '本线工序' ? (r.本线排产数量 ?? r.当前工序计划量 ?? r.排产数量) : r.排产数量,
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

onMounted(() => {
  loadAll()
  // 外部跳入(生产加工单列表「追溯」):?trace=工单号 直开追溯弹窗
  const q = new URLSearchParams(location.hash.split('?')[1] || '')
  const tno = q.get('trace')
  if (tno) setTimeout(() => openTrace(tno), 600)
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
/* 按量流转·逐道明细(展开行) */
.wb-flow-box { padding: 8px 12px 10px 12px; background: #fafbfc; }
.wb-flow-title { font-size: 12px; color: #909399; margin-bottom: 6px; }
.wb-flow-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
.wb-flow-tbl th, .wb-flow-tbl td { border: 1px solid #ebeef5; padding: 4px 8px; text-align: left; }
.wb-flow-tbl th { background: #f5f7fa; color: #606266; font-weight: 600; }
.wb-flow-tbl td.num, .wb-flow-tbl th.num { text-align: right; font-variant-numeric: tabular-nums; }
.wb-flow-tbl tr.is-cur td { background: #eef6ff; font-weight: 600; }
.wb-flow-tbl td.empty { text-align: center; color: #909399; }
.wb-trace-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.wb-trace-no { font-size: 16px; font-weight: 700; color: #1e6fb8; }
.wb-trace-desc { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: #606266; background: #fdf6ec; border: 1px solid #f5dab1; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; }
.wb-trace-block { margin-bottom: 12px; }
.wb-trace-block .wb-block-title { display: block; border-left: 3px solid #1e6fb8; padding-left: 8px; margin-bottom: 6px; }
.wb-trace-sub { font-size: 12px; color: #909399; margin: 6px 0 4px; }
</style>
