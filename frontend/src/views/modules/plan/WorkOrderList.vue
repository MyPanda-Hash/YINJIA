<!-- WorkOrderList.vue — 生产工单(2026-09-26 用户拍板:纯查询页,数据=参考库工单表 plang)
     顶部 日期范围 + 单框模糊搜索(工单号/物料/客户/产品 多列 OR);按钮条 结案/取消结案/切单/排产/撤回切单/打印工单(勾选多个=批量)/导出/刷新;
     产线筛选 + 未完工/已完工/追溯;明细大表(勾选)。打印工单=勾选行直打+留痕;结案走 plang 专属端点。
     转领料单按钮已下架(2026-11-05 用户口径:「把当前这个转领料单的按钮删除,记得把权限设置中的也去除掉,
     不需要删除当前的工单和领料的实现,只需要完成对这个按钮的去除即可」)——
     前端入口已删;组织架构「角色与面板权限」矩阵列已由 PagePanelRegistry.WORK_ORDER_LIST_ACTIONS 去掉;
     库里 yj_role_panel 的 picking 授权词由 migrate-drop-wol-picking-perm-20261105.sql 清理。
     **后端实现原样保留**:/px/workOrderList/toPicking + WorkOrderPickingService(含回写)不动,
     端点闸门仍认 picking 词(见 PanelPermissionService.BUTTON_PERMS_OVERRIDE 的说明);
     领料单改由「材料出库单」面板手工建单,审核出库后照旧回写工单「领料单号」(ManuWritebackService)。
     取数窗口:默认预填最近 15 天(2026-10-05 用户口径,防单据累积后卡),清空日期范围=查全量。
      2026-11-09 用户口径:①日期范围控件换成与「订单结转」同一个实现(`@core/ui/DateRangeQuery`:单框
      daterange + 快捷档,宽度收紧到 240px);②大日期范围改为**滚动加载**:首屏 50 行(按当前显示顺序
      从上到下),向下滚到接近底部再追加 50 行,底部状态条显示「已加载 x / y 条」(可点击继续加载),
      到底显示「已全部加载」。原来一次渲染全部行(实测 399 行 × 119 列 ≈ 4.7 万单元格,主线程阻塞 15 秒+、
      页面无响应)。行数据始终全部在内存 ⇒ 勾选、导出、结案/切单/打印等原能力不变。 -->
<template>
  <div class="wol-page">
    <!-- 查询行:日期范围 + 单框模糊搜索
         2026-11-09 用户口径:日期范围改为与「订单结转」页**同一个控件实现**(DateRangeQuery:
         单框 daterange + 今日/本周/本月/近7天/近30天/上月快捷档),不再用两个独立日期框。
         选完日期即查(与订单结转同口径),回车/点「查找」同样按新区间查询并回第 1 页。 -->
    <div class="wol-query">
      <span class="wol-lb">{{ tt('日期范围') }}</span>
      <DateRangeQuery v-model="datePick" clearable @change="onQuery" />
      <span class="wol-lb" style="margin-left: 12px">{{ tt('模糊搜索') }}</span>
      <el-input v-model="qText" size="small" style="width: 220px" :placeholder="tt('输入查询条件...')" clearable @keyup.enter="onQuery" />
      <el-button size="small" type="success" @click="onQuery">{{ tt('查找') }}</el-button>
      <span class="wol-count">{{ tt('共有数据') }}: <b>{{ rows.length }}</b> {{ tt('条') }}</span>
    </div>

    <!-- 按钮条(2026-09-28 用户拍板:生产工单=纯汇总视图——数据只由订单结转产生,排产唯一入口=快速排产;
         撤排产按钮防中间节点误操作;保留 查询/筛选/打印/结案留痕)
         页面级权限(2026-10-16):本页挂页面面板 WORK_ORDER_LIST
         (可见/查询/打印/结案/切单/导出/排产;词表见后端 PagePanelRegistry),
         无该动作词的角色不显示按钮 —— 此前本页连列表接口都没有校验(登录即可读全部工单/客户/数量)。
         2026-11-05:「转领料单」按钮下架(picking 词已从矩阵动作集移除),后端实现保留。 -->
    <div class="wol-btns">
      <el-button v-if="canDo('close')" size="small" type="success" plain @click="onClose(true)" :disabled="!checked.length">{{ tt('结案') }}</el-button>
      <el-button v-if="canDo('close')" size="small" type="success" plain @click="onClose(false)" :disabled="!checked.length">{{ tt('取消结案') }}</el-button>
      <!-- 结案回正(2026-10-18):把「手机端小程序/参考库直连库误写成已结案」的行改回未结案。
           判据=MES 自己的结案口径(入库≥排产 + 组装成品检验已审核),只动不满足条件的行。 -->
      <el-button v-if="canDo('close')" size="small" type="danger" plain @click="onCloseHeal">{{ tt('结案回正') }}</el-button>
      <!-- 切单(9.29 生产管理批次①,2026-10-05):勾选一张在产工单 → 输入切出数量 → 子工单(新工单号);
           撤回切单 = 子单无报工/入库/领料时可还原父单数量(WorkOrderSplitService.split/unsplit) -->
      <el-button v-if="canDo('split')" size="small" type="warning" plain @click="openSplit" :disabled="!checked.length && !currentRow">{{ tt('切单') }}</el-button>
      <!-- 工单排产(2026-10-30 用户口径):勾 1 行 = 原内嵌快速排产单行流程;勾 N 行 = 仍打开内嵌
           快速排产页(①池收敛成勾选的行并默认全选)→「批量排产」= 多个工单排入同一组产线、数量逐行算。
           已排产/已结案/已完工的行先点名跳过。
           「排产」与快速排产页同一个动作词 assign —— 两处任一授予即可(与后端 requireButtonAny 同口径) -->
      <el-button v-if="canSchedule" size="small" type="success" plain :disabled="!checked.length && !currentRow" @click="openSchedule">{{ tt('排产') }}</el-button>
      <el-button v-if="canDo('split')" size="small" plain @click="onUnsplit" :disabled="!checked.length && !currentRow">{{ tt('撤回切单') }}</el-button>
      <el-dropdown v-if="canDo('print')" split-button size="small" type="primary" @click="doPrintTask('成型生产任务单')" @command="doPrintTask"
                   :disabled="!checked.length && !currentRow">
        {{ tt('打印工单') }}
        <template #dropdown>
          <el-dropdown-item command="成型生产任务单">{{ tt('成型生产任务单') }}</el-dropdown-item>
          <el-dropdown-item command="切炭生产任务单">{{ tt('切炭生产任务单') }}</el-dropdown-item>
          <el-dropdown-item command="组装生产任务单">{{ tt('组装生产任务单') }}</el-dropdown-item>
        </template>
      </el-dropdown>
      <el-button v-if="canDo('recipe')" size="small" type="warning" plain @click="openMixingRecipe" :disabled="!checked.length && !currentRow">{{ tt('获取混料配方') }}</el-button>
      <el-button v-if="canDo('export')" size="small" type="primary" @click="exportCsv">{{ tt('导出') }}</el-button>
      <!-- 刷新 = 按当前条件重查并回第 1 页(2026-11-09 与订单结转同口径;翻页只切渲染页,不重查) -->
      <el-button size="small" @click="onQuery">{{ tt('刷新') }}</el-button>
      <!-- 日排产(2026-10-29):表格内的日期列 —— 列由后端按数据生成。
           2026-10-31 用户口径「**当前不需要手填,能自动算就可以了**」⇒ 「保存日排产」按钮已撤(含均摊弹窗),
           日期格改为<b>只读</b>:计划由后端按「工序计划量 ÷ 开工日→交期」自动均摊算出。 -->
    </div>

    <!-- 产线筛选条 -->
    <div class="wol-line">
      <span class="wol-lb">{{ tt('生产线') }}:</span>
      <el-select v-model="lineFilter" size="small" clearable filterable style="width: 170px" :placeholder="tt('全部产线')" @change="load">
        <el-option v-for="l in lines" :key="l.v" :label="l.t" :value="l.v" />
      </el-select>
      <span class="wol-lb" style="margin-left: 10px">{{ tt('产线代号') }}:</span>
      <el-input v-model="lineCode" size="small" style="width: 120px" readonly />
      <span class="wol-lb" style="margin-left: auto">{{ tt('筛选') }}:</span>
      <el-radio-group v-model="stateFilter" size="small" @change="applyFilter">
        <el-radio-button value="">{{ tt('全部') }}</el-radio-button>
        <el-radio-button value="未完工">{{ tt('未完工') }}</el-radio-button>
        <el-radio-button value="已完工">{{ tt('已完工') }}</el-radio-button>
      </el-radio-group>
      <el-button size="small" plain style="margin-left: 10px" @click="openTrace" :disabled="!currentRow">{{ tt('追溯') }}</el-button>
    </div>

    <!-- 历史欠产汇总条(2026-11-13 用户口径「当天结束后未完成会进行提示」)───────────────
         日期格标红之外,页面再给一行红色汇总:处数 + 合计欠产,悬停看逐行逐日明细(不弹窗)。
         口径 = 当前筛选后的行集 `filtered`(与页签/产线筛选一致;不是滚动渲染的 visibleRows,
         所以滚动加载时数字不跳);后端未返回「原计划」时 historyShortfalls 回空 ⇒ 整条不渲染。 -->
    <div v-if="shortInfo.count" class="wol-short" :title="shortTitle">
      <span class="wol-short-main">{{ tt('历史未完成') }} {{ shortInfo.count }} {{ tt('处') }} · {{ tt('合计欠产') }} {{ qtyText(shortInfo.qty) }}</span>
      <span class="wol-short-tip">{{ tt('标红格 = 当天已结束但报工未达原计划(汇总含未显示为列的日期)') }}</span>
    </div>

    <!-- 明细大表(2026-11-09 用户口径 2.0:滚动加载 —— 首屏 50 行,向下滚动时再追加下一批) -->
    <el-table :data="visibleRows" border size="small" class="wol-table" height="100%"
              @selection-change="(r) => (checked = r)" @current-change="(r) => (currentRow = r)" ref="tableRef"
              highlight-current-row row-key="rowKey">
      <el-table-column type="selection" width="40" fixed="left" reserve-selection />
      <!-- 按量流转·逐道明细(2026-11-12 方案A):一行只显示"当前工序",后道(如装箱 可加工1000/待流入4000)
           必须展开才看得到 —— 展开区直接渲染后端给的「工序流转明细」,只读。
           ⚠ 不能加 fixed:固定列的展开内容会被压成列宽,只剩前两列可见(实测)。 -->
      <el-table-column type="expand" width="34">
        <template #default="{ row }">
          <div class="wol-flow-box">
            <div class="wol-flow-title">{{ tt('工序流转明细') }}（{{ tt('按量流转:上一道报多少,下一道最多做多少') }}）</div>
            <table class="wol-flow-tbl">
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
                  <td class="num" :class="{ 'wol-flow-gap': Number(f.待流入量 || 0) > 0 }">{{ flowNum(f.待流入量) }}</td>
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
      <el-table-column :label="tt('公司代码')" prop="公司代码" width="90" show-overflow-tooltip />
      <el-table-column :label="tt('工单号')" prop="加工单号" width="150" sortable show-overflow-tooltip>
        <template #default="{ row }">
          <!-- 点工单号 = 打开工单排产的追溯(=工单详情:工序进度+时间线+血缘)
               underline 用字符串值(2026-10-19):布尔值在 Element Plus 3.0 会废弃,控制台会刷弃用警告 -->
          <el-link type="primary" underline="never" @click="openTrace(row)">{{ row['工单号'] }}</el-link>
        </template>
      </el-table-column>
      <el-table-column :label="tt('工单行号')" prop="行号" width="90" sortable />
      <el-table-column :label="tt('批次号')" prop="批次号" width="100" sortable />
      <el-table-column :label="tt('源工单号')" prop="源工单号" width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ row.源工单号 || '-' }}</template>
      </el-table-column>
      <el-table-column :label="tt('拆分序号')" prop="拆分序号" width="85" align="right">
        <template #default="{ row }">{{ row.拆分序号 ?? '-' }}</template>
      </el-table-column>
      <el-table-column :label="tt('工单日期')" prop="单据日期" width="100" sortable />
      <el-table-column :label="tt('转单时间')" prop="转单时间" width="140" sortable show-overflow-tooltip />
      <el-table-column :label="tt('物料编码')" prop="物料编码" width="130" show-overflow-tooltip />
      <el-table-column :label="tt('产品名称')" prop="产品名称" min-width="180" show-overflow-tooltip />
      <el-table-column :label="tt('规格型号')" prop="规格型号" min-width="160" show-overflow-tooltip />
      <el-table-column :label="tt('客户')" prop="客户" min-width="120" show-overflow-tooltip />
      <el-table-column :label="tt('订单号')" prop="订单号" width="150" show-overflow-tooltip />
      <el-table-column :label="tt('订单行号')" prop="订单行号" width="90" align="right" />
      <el-table-column :label="tt('生产线')" prop="生产线" width="110" show-overflow-tooltip />
      <el-table-column :label="tt('需求数量')" prop="需求数量" width="100" align="right" sortable />
      <el-table-column :label="tt('转单数量')" prop="排产数量" width="95" align="right" />
      <el-table-column :label="tt('入库数量')" prop="入库数量" width="90" align="right" />
      <!-- 「余量」列已隐藏(2026-11-08 用户口径「直接隐藏吧」):该列 = 本工单行需求 − 本行订单占用
           (form_flow_link SO→PLANG 的 linked_quantity) —— 新口径(需求=转单量、占用链也写同一个数)下恒为 0,
           正式库实测 399 行里 397 行为 0;有值时也只是"占用链没记全"的数据异常信号,与「当前工序还剩多少
           未生产」无关、极易误读。后台字段照旧返回,界面不再展示(CSV 导出同步去掉)。
           要看"还剩多少":用「工序进度」列(当前工序完工量/计划量),或工单排产页的「未交量」(排产−入库)。
           要恢复:把下面这行放开即可。 -->
      <!-- <el-table-column :label="tt('余量')" prop="余量" width="90" align="right" /> -->
      <!-- 领料单号(2026-10-18):一张工单可对应多张领料单,列里是逗号分隔的全部已审核单号 —— 加宽便于直接看 -->
      <el-table-column :label="tt('领料单号')" prop="领料单号" width="200" show-overflow-tooltip />
      <el-table-column :label="tt('成型配方')" width="170" show-overflow-tooltip>
        <template #default="{ row }">{{ row['成型配方单号'] || '-' }}{{ row['成型配方版本'] ? ` / ${row['成型配方版本']}` : '' }}</template>
      </el-table-column>
      <el-table-column :label="tt('打印人')" prop="打印人" width="90" />
      <el-table-column :label="tt('打印时间')" prop="打印时间" width="140" />
      <el-table-column :label="tt('当前工序')" width="100" sortable prop="当前工序">
        <template #default="{ row }">
          <span :class="{ 'wol-closed': row.当前工序 === '组装' }">{{ row.当前工序 ? tt(row.当前工序) : '-' }}</span>
        </template>
      </el-table-column>
      <!-- 日排产(2026-10-29):直接长在现有明细表里(不新增表格/块),位置即用户截图标红处
           (「当前工序」之后、「工序进度」之前)。每个日期格都可改计划(含今天以前的日期);
           格下方小字 = 该天已审核报工量(含手机端),只读。 -->
      <!-- 排产日期(2026-10-31):双击弹出「排产快速调整」,在那里集中改 数量/开工日/完工日
           (后端同步 plang + plang_pc + 当前工序台账区间 —— 用户口径「该日期要同步吧」)。 -->
      <el-table-column :label="tt('计划开工日期')" prop="计划开工日期" width="112">
        <template #default="{ row }">
          <span class="dp-date-cell" :title="tt('双击可改排产日期')"
                @dblclick="openQuick(row, planToday)">{{ row.计划开工日期 || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('计划完工日期')" prop="计划完工日期" width="112">
        <template #default="{ row }">
          <span class="dp-date-cell" :title="tt('双击可改排产日期')"
                @dblclick="openQuick(row, planToday)">{{ row.计划完工日期 || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('交期紧迫度')" prop="交期紧迫度" width="90" align="right" />
      <el-table-column :label="tt('7天需交付')" prop="7天需交付" width="92" align="right" />
      <el-table-column :label="tt('15天需交付')" prop="15天需交付" width="96" align="right" />
      <el-table-column :label="tt('大于15天需交付')" prop="大于15天需交付" width="112" align="right" />
      <el-table-column :label="tt('7天已排')" prop="7天已排" width="88" align="right" />
      <el-table-column :label="tt('15天已排')" prop="15天已排" width="92" align="right" />
      <el-table-column :label="tt('大于15天已排')" prop="大于15天已排" width="108" align="right" />
      <!-- ⚠ 2026-10-31 用户口径「格子里两个数堆在一起分不清谁是谁」:
           上方计划量/ 下方报工量(只读,加「实」标识 + 绿色);列头「今」标今天、过去列灰底。
           ⚠ 二次修正(「不要这样在右下角显示」):计划与报工两行**居中对齐**。
           ⚠ 三次修正(「当前不需要手填,能自动算就可以了」):格子默认只读,自动均摊。
           ⚠ 五次修正(「还是改成弹窗」):**双击日期格 → 弹「排产快速调整」**,在那里集中改
             数量/开工日/完工日(生产工单页不带调线)。人工指定的格子带「手」角标。 -->
      <!-- 日排产日期列(2026-11-09 性能重写):渲染期只读**预计算好的格子模型**(row.__dp[i]),
           不再在每帧里对 83 个日期列逐格跑 dayCell/dayTitle/isOutCell(那些函数含日期解析+tt() 翻译,
           全量时单次重渲就要数秒;见 buildRowDayCells 注释)。
           列头也用预计算的 planCols(短日期/今天标记/过去列底色一次算好)。 -->
      <el-table-column v-for="c in planCols" :key="c.d" :label="c.short" width="82" align="center"
                       :label-class-name="'dp-col-' + c.state"
                       :class-name="'dp-col-' + c.state">
        <template #header>
          <div class="dp-head" :class="c.state" :title="dayHeadTitle">
            <span class="dp-date">{{ c.short }}</span>
            <span v-if="c.isToday" class="dp-today">{{ tt('今') }}</span>
          </div>
        </template>
        <template #default="{ row }">
          <el-input-number v-if="qtyEdit === qtyKey(row, c.d)" v-model="qtyDraft" size="small"
                           :controls="false" :min="0" class="dp-input" autofocus
                           @blur="commitQty(row, c.d)" @keyup.enter="commitQty(row, c.d)" @keyup.esc="cancelQtyEdit" />
          <!-- 区间外(开工日~计划完工日之外)且当天无计划/实报:画「/」——
               这一天不归本行排(2026-11-01 用户口径;例:开工日改成 11-02 后,11-01 的格子要画斜杠) -->
          <span v-else-if="row.__dp[c.i].out" class="dp-out" :title="outCellTitle">/</span>
          <span v-else class="dp-plan" :class="row.__dp[c.i].cls"
                :title="row.__dp[c.i].title" @click="startQtyEdit(row, c.d)">
            {{ row.__dp[c.i].text }}<span v-if="row.__dp[c.i].manual" class="dp-hand"
                :class="{ over: row.__dp[c.i].over }"
                :title="row.__dp[c.i].manualTitle">{{ tt('手') }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('工序进度')" width="120" align="right">
        <template #default="{ row }">
          <span v-if="row.当前工序">{{ num(row.当前工序完工量) }}/{{ num(row.当前工序计划量) }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <!-- 按量流转(2026-11-12,只读展示):上道完工量(上一道自己的报工数) → 可加工量(本道能做多少)
           → 待报量(还能报) → 待流入量(还等上一道流下来)。
           口径与报工页/追溯同源(后端 ProcessFlow.enrichRowFlow);这里只显示,不参与任何判定。 -->
      <el-table-column width="110" align="right">
        <template #header>
          <span :title="tt('上道完工量 = 上一道已审核报工数(上一道自己的计量单位,不折算);换算率不同时,本道能做多少看「可加工量」')">{{ tt('上道完工量') }}</span>
        </template>
        <template #default="{ row }">{{ flowNum(row.上道完工量) }}</template>
      </el-table-column>
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
          <span :class="{ 'wol-flow-gap': Number(row.当前工序待流入量 || 0) > 0 }">{{ flowNum(row.当前工序待流入量) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('生产状态')" prop="生产状态" width="90" fixed="right">
        <template #default="{ row }">
          <span :class="{ 'wol-closed': row.生产状态 === '完工' }">{{ tt(row.生产状态) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tt('结案')" width="96" fixed="right">
        <template #default="{ row }">
          <span :class="{ 'wol-closed': row.结案 === 'Y' }">{{ row.结案 === 'Y' ? tt('已结案') : '-' }}</span>
          <!-- 结案异常(2026-10-18 加,2026-10-19 收口):ja 是外部程序也能直接写的列(手机端小程序/参考库直连库)。
               判据 = 「入库<排产」—— MES 两条结案路径(手工结案/自动结案)都要求入库≥排产,
               所以入库没达标却写着结案的,一定是库外写的。与后端 PlangClose.anomaly / closeAudit / 巡检同源。 -->
          <el-tooltip v-if="row.结案异常 === 'Y'"
                      :content="tt('该行写着已结案，但入库数量没达到排产数量 —— MES 的两条结案路径都要求入库≥排产，所以这行不是 MES 结的（通常是手机端小程序/参考库直连写库）。可用「结案回正」一键改回未结案')"
                      placement="top">
            <el-tag size="small" type="danger" effect="plain" style="margin-left:4px">{{ tt('结案异常') }}</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <!-- 滚动加载状态条(2026-11-09 用户口径 2.0:不要分页,改为「向下滚动才加载下一批」)
         数据一次查询已在前端内存(后端列表 ~330ms,不是瓶颈;卡的是 el-table 一次渲染全部行),
         所以「加载」= 继续渲染下一批,按当前显示顺序从上到下:首屏 50 行,滚近底部追加 50 行。
         渲染本表一页的成本不低(列多:基础 36 + 日排产日期列,全量时 119 列),所以批次不敢再大;
         到底后显示「已全部加载」。这里的提示也可点击(不滚轮/无滚动的场景也能继续加载)。 -->
    <div class="wol-loadmore" :class="{ 'is-end': !hasMore }">
      <span v-if="loadingMore" class="wol-lm-busy">{{ tt('加载中…') }}</span>
      <span v-else-if="hasMore" class="wol-lm-more" @click="loadMore">
        {{ tt('已加载') }} {{ visibleRows.length }} / {{ filtered.length }} {{ tt('条') }} ·
        {{ tt('向下滚动加载更多') }} <i class="wol-lm-arrow">↓</i>
      </span>
      <span v-else class="wol-lm-end">{{ tt('已全部加载') }} {{ filtered.length }} {{ tt('条') }}</span>
    </div>

    <!-- 工单排产弹窗(2026-10-05 用户口径):**内嵌快速排产页面本身**。
         单行:按「工单号+工单行号」收敛 ⇒ 只显示这一行;
         多行(2026-10-30):按「行id列表」把①池收敛成勾选的这些行并默认全选,勾多行点「批量排产」。 -->
    <el-dialog v-model="schedVisible" :title="schedTitle" width="94%" top="4vh" append-to-body destroy-on-close
               @closed="load">
      <div style="height: 76vh; overflow: hidden">
        <ScheduleBoard :工单号="schedNo" :工单行号="schedXc" :行id列表="schedIds" :工单号列表="schedNos" embedded />
      </div>
    </el-dialog>

    <!-- 工单详情·追溯(与工单排产同一组件,原地打开;2026-10-05) -->
    <WorkOrderTraceDialog v-model="traceVisible" :code="traceNo" :行id="traceRowId" />

    <!-- 排产快速调整(2026-10-31):双击日期格弹出;本页不出「调线」块(用户口径 A) -->
    <ScheduleQuickEditDialog v-model="quickVisible" :row="quickRow" :date="quickDate"
                             :line="quickRow.生产线 || ''" @saved="afterQuickSaved" />

    <!-- 获取当前工单行的研发配方并保存投料快照 -->
    <el-dialog v-model="mixingVisible" :title="tt('获取混料配方')" width="760px" append-to-body :close-on-click-modal="false">
      <div v-if="mixingData" class="wol-split">
        <div class="wol-split-row"><span>{{ tt('工单号') }} / {{ tt('工单行号') }}</span><b>{{ mixingData['工单号'] }} #{{ mixingData['工单行号'] }}</b></div>
        <div class="wol-split-row"><span>{{ tt('产品名称') }}</span><span>{{ mixingData['产品名称'] }} ({{ mixingData['产品编号'] }})</span></div>
        <div class="wol-split-row"><span>{{ tt('配方单号') }}</span><span>{{ mixingData['配方单号'] }} / {{ mixingData['配方版本'] || '-' }} ({{ tt(mixingData['配方状态']) }})</span></div>
        <div class="wol-split-row"><span>{{ tt('混料数量') }} ({{ tt('支') }})</span>
          <el-input-number v-model="mixingQty" :min="0.0001" :precision="4" :controls="false" size="small" style="width:180px" @change="previewMixing" />
        </div>
        <el-table :data="mixingData['配方行'] || []" size="small" border max-height="360">
          <el-table-column prop="序号" :label="tt('序号')" width="60" />
          <el-table-column prop="物料种类" :label="tt('物料种类')" width="105" />
          <el-table-column prop="物料编号" :label="tt('物料编号')" width="125" />
          <el-table-column prop="物料名称" :label="tt('物料名称')" min-width="140" />
          <el-table-column :label="tt('配料比')" width="100" align="right"><template #default="{ row }">{{ row['配料比'] == null ? '-' : (Number(row['配料比']) * 100).toFixed(3) + '%' }}</template></el-table-column>
          <el-table-column prop="单支物料含量" :label="tt('单支物料含量')" width="120" align="right" />
          <el-table-column prop="计划用量" :label="tt('计划用量')" width="120" align="right" />
        </el-table>
        <div v-if="mixingData['已有快照']" class="wol-split-tip">{{ tt('该工单行已有混料配方快照；确认后将以当前研发配方重新获取。') }}</div>
      </div>
      <template #footer>
        <el-button @click="mixingVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="mixingLoading" @click="saveMixingRecipe">{{ tt('确认获取') }}</el-button>
      </template>
    </el-dialog>

    <!-- 切单弹窗:可切上限 = 排产数量 − max(已入库, 各工序已完工报工最大值);子单取新工单号 -->
    <el-dialog v-model="splitVisible" :title="tt('切单')" width="440px" append-to-body>
      <div v-if="splitInfo" class="wol-split">
        <div class="wol-split-row"><span>{{ tt('工单号') }}</span><b>{{ splitInfo['工单号'] }}#{{ splitInfo['工单行号'] }}</b></div>
        <div class="wol-split-row"><span>{{ tt('产品名称') }}</span><span>{{ splitInfo['产品名称'] }} {{ splitInfo['规格型号'] }}</span></div>
        <div class="wol-split-row"><span>{{ tt('生产线') }}</span><span>{{ splitInfo['生产线'] || '-' }}</span></div>
        <div class="wol-split-row"><span>{{ tt('排产数量') }}</span><b>{{ num(splitInfo['排产数量']) }}</b></div>
        <div class="wol-split-row"><span>{{ tt('入库数量') }}</span><span>{{ num(splitInfo['入库数量']) }}</span></div>
        <div class="wol-split-row"><span>{{ tt('已完工报工') }}</span><span>{{ num(splitInfo['已完工报工']) }}</span></div>
        <div class="wol-split-row"><span>{{ tt('已切出') }}</span><span>{{ num(splitInfo['已切出数量']) }}</span></div>
        <div class="wol-split-row hl"><span>{{ tt('可切上限') }}</span><b>{{ num(splitInfo['可切上限']) }}</b></div>
        <div class="wol-split-row"><span>{{ tt('切出数量') }}</span>
          <el-input-number v-model="splitQty" :min="0" :max="Number(splitInfo['可切上限']) || 0"
                           :controls="false" size="small" style="width: 140px" />
        </div>
        <el-checkbox v-model="splitInherit">{{ tt('继承产线/班组/交期') }}</el-checkbox>
        <div class="wol-split-tip">{{ tt('子工单取新工单号,可独立报工、打印;撤回切单可还原父单数量(子单无报工/入库/领料时)') }}</div>
      </div>
      <template #footer>
        <el-button @click="splitVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="splitLoading" @click="doSplit">{{ tt('确认切单') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, onDeactivated, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@core/request'
import { tt } from '@/i18n'
import DateRangeQuery from '@core/ui/DateRangeQuery.vue'
import { printWorkTaskSheet } from '@/business/print-formats'
import WorkOrderTraceDialog from './WorkOrderTraceDialog.vue'
import ScheduleQuickEditDialog from './ScheduleQuickEditDialog.vue'
import ScheduleBoard from './ScheduleBoard.vue'
import { qtyText, dayColState, isToday, isPast, dayCellView, historyShortfalls, shortfallTotals, isOutOfPlanRange } from '@/business/dayPlan'
import { fetchDayPlan, saveDayPlan } from '@/business/dayPlanApi'
import { useUserStore } from '@/stores/user'
import { canDo as canDoPerm, canDoAny } from '@core/auth/panelAccess'

/**
 * 页面级动作权限(2026-10-16):页面面板 WORK_ORDER_LIST
 * (可见/查询/打印/结案/切单/导出/排产;词表见后端 PagePanelRegistry)。
 * 「排产」与快速排产页共用 assign 词 —— 两处任一授予即可(后端 requireButtonAny 同口径)。
 * 「查找/刷新/追溯」是只读查看,归「可见」,不另设动作。
 * 2026-11-05:原「转领料单」按钮已下架 ⇒ 矩阵不再下发 picking 词,本页无需再判它(后端端点保留)。
 */
const permUser = useUserStore()
const canDo = (word) => canDoPerm(permUser, 'WORK_ORDER_LIST', word)
const canSchedule = computed(() => canDoAny(permUser, ['WORK_ORDER_LIST', 'SCHEDULE_BOARD'], 'assign'))

/** 路由:applyRouteKeyword 用 route 读 keyword、router.replace 清查询串 */
const router = useRouter()
const route = useRoute()

/** 待定位的工单行id(2026-11-08):生产工序进度看板点行跳进来时带 ?focus=<行id>,加载完成后再定位 */
const focusPending = ref('')

/**
 * 从我的桌面「单据入口」点最近工单跳进来(2026-10-18):/prod/plan/workOrderList?keyword=<工单号>
 * 把关键词填进单框搜索,并**清空日期窗** —— 默认只查最近 15 天,而入口列的是最近 7 张工单,
 * 若目标工单早于窗口(或别人先改过日期)就会"跳进来却看不到那张单"。
 *
 * 2026-11-08 扩展:生产工序进度看板点行跳进来时还带 ?focus=<工单行id>(plang.id)。
 * 一并摘掉 keyword/focus(用完即摘,keep-alive 再次切回时不该被旧值复写),focus 由
 * {@link applyRouteFocus} 在 load() 完成后定位(高亮该行 + 自动打开该行追溯)。
 */
function applyRouteKeyword() {
  const kw = String(route.query.keyword ?? '').trim()
  const focus = String(route.query.focus ?? '').trim()
  if (focus) focusPending.value = focus
  if (!kw && !focus) return false
  if (kw) {
    qText.value = kw
    // 清空日期范围 = 不按日期过滤(2026-11-09 换 daterange 控件后,`[]` 即「清空」语义)
    datePick.value = []
  }
  // 用完即摘(?focus 同款口径):keep-alive 再次切回时不该被旧关键词复写
  if (route.query.keyword !== undefined || route.query.focus !== undefined) {
    router.replace({ path: route.path, query: { ...route.query, keyword: undefined, focus: undefined } })
  }
  return !!kw
}

/**
 * 按 ?focus=<工单行id> 定位(2026-11-08):等 load() 完成、行已在内存后,
 * 设当前行(高亮)+ 滚动到可视区 + 自动打开该行「工单详情·追溯」。
 * 只认**行id**(plang.id):同工单号可多行,按单号定位会指错行(2026-10-15 口径)。
 */
async function applyRouteFocus() {
  const id = String(focusPending.value || '').trim()
  if (!id) return
  focusPending.value = ''
  const row = rows.value.find((r) => String(r.行id) === id)
  if (!row) return
  // 滚动加载(2026-11-09):目标行可能还没进首屏 ⇒ 先把 visibleCount 扩到能覆盖它(按批对齐),否则行不在 DOM 里;
  // 被「未完工/已完工」筛掉时先清筛选,保证跳进来能看到目标行。
  if (!filtered.value.some((r) => String(r.行id) === id)) stateFilter.value = ''
  const idx = filtered.value.findIndex((r) => String(r.行id) === id)
  if (idx >= 0) {
    const need = Math.ceil((idx + 1) / LOAD_BATCH) * LOAD_BATCH
    if (visibleCount.value < need) visibleCount.value = Math.min(need, filtered.value.length)
  }
  await nextTick()
  bindTableScroll()
  tableRef.value?.setCurrentRow?.(row)
  currentRow.value = row
  // 表格 fixed 列 + 虚拟滚动都不保证行在视口内:直接找 current-row 的 tr 滚到中间
  const tr = tableRef.value?.$el?.querySelector?.('.el-table__body tr.current-row')
  tr?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  openTrace(row)
}

const rows = ref([])
const checked = ref([])
const currentRow = ref(null)
/** 表格引用:刷新后清勾选用(2026-10-05 修「撤回切单后卡在请先勾选」的 bug) */
const tableRef = ref(null)
const lines = ref([])
const lineFilter = ref('')
const lineCode = ref('')
const stateFilter = ref('')
/**
 * 默认取数窗口 = 最近 15 天(2026-10-05 用户口径:单据一多就卡,默认不拉全量)。
 * 进页面时预填「今天-14 ~ 今天」(含今天共 15 天);**清空日期范围即查全量**。
 * 注意:日期串按本机时区拼(不用 toISOString —— UTC 下东八区 00:00~08:00 会退一天)。
 *
 * 2026-11-09:日期范围控件换成与「订单结转」页同一个实现(`@core/ui/DateRangeQuery`,
 * 单框 daterange + 快捷档)。绑定值是 ['开始','结束'](YYYY-MM-DD);`[]`/null = 不按日期过滤。
 */
const DEFAULT_WINDOW_DAYS = 15
const datePick = ref([])
/** 生效区间(含端点):反序自动交换(先点结束日再点开始日不丢条件);清空/半截 = 不带日期条件 */
const queryRange = computed(() => {
  const a = String((datePick.value || [])[0] || '').slice(0, 10)
  const b = String((datePick.value || [])[1] || '').slice(0, 10)
  const re = /^\d{4}-\d{2}-\d{2}$/
  if (!re.test(a) || !re.test(b)) return { from: '', to: '' }
  return a <= b ? { from: a, to: b } : { from: b, to: a }
})
const qText = ref('')
// 切单(9.29 批次①):弹窗状态 + 预览(可切上限)
const splitVisible = ref(false)
const splitLoading = ref(false)
const splitInfo = ref(null)
const splitQty = ref(0)
const splitInherit = ref(true)
const mixingVisible = ref(false)
const mixingLoading = ref(false)
const mixingData = ref(null)
const mixingTarget = ref(null)
const mixingQty = ref(0)
/** 工单详情·追溯(2026-10-05):与工单排产同一组件,本页原地打开 */
const traceVisible = ref(false)
const traceNo = ref('')
/** 追溯的工单行id(plang.id):行级口径必需(2026-10-15) */
const traceRowId = ref(null)
/** 工单排产弹窗(2026-10-05 用户口径):带**这一行**的快速排产(单行) */
const schedVisible = ref(false)
const schedNo = ref('')
/** 弹窗要预筛的工单行号(2026-10-15):带上它 ⇒ 快速排产只出这一行,而不是同工单所有行 */
const schedXc = ref(null)
/** 多行批量排产(2026-10-30):勾选的行 id / 工单号 —— 带给内嵌快速排产页收敛①池与②已排产 */
const schedIds = ref([])
const schedNos = ref([])
const schedTitle = computed(() => (schedIds.value.length > 1 ? tt('批量排产（快速排产）') : tt('工单排产（快速排产）')))
/**
 * 工单排产入口(2026-10-30 用户口径改版):
 *   · 勾 1 行 = 原流程:内嵌快速排产按「工单号#行号」收敛,再点「排产」逐道选线;
 *   · 勾 N 行 = 仍打开**内嵌快速排产页**(复用原页面,不新建页面):①池收敛成这 N 行并默认全选,
 *     点「批量排产」= 多个工单排入同一组产线,排产数量逐行按各行自己算。
 * 先在前端点名排除不可排的行(已排产/已结案/已完工),避免打开后才发现行在池子里凭空消失。
 */
function openSchedule() {
  // 只认**当前列表里还在的**勾选行(表格开了 reserve-selection,已消失的行会留在 checked 里,同切单口径)
  const alive = (checked.value || []).filter((x) => rows.value.some((r) => String(r.行id) === String(x.行id)))
  const cur = currentRow.value && rows.value.some((r) => String(r.行id) === String(currentRow.value.行id)) ? currentRow.value : null
  const list = alive.length ? alive : (cur ? [cur] : [])
  if (!list.length) { ElMessage.warning(tt('请先勾选要排产的工单')); return }

  const bad = []
  const ok = []
  for (const r of list) {
    const key = `${r['工单号']}${r['工单行号'] != null ? '#' + r['工单行号'] : ''}`
    if (String(r['生产线'] || '').trim()) bad.push(`${key}（${tt('已排产')}：${r['生产线']}）`)
    else if (r['结案'] === 'Y') bad.push(`${key}（${tt('已结案')}）`)
    else if (r['生产状态'] === '完工') bad.push(`${key}（${tt('已完工')}）`)
    else ok.push(r)
  }
  if (bad.length) ElMessage.warning(`${tt('以下工单行不能排产，已跳过')}：${bad.join('、')}`)
  if (!ok.length) return

  if (ok.length === 1) {
    const r = ok[0]
    schedIds.value = []
    schedNos.value = []
    schedNo.value = r['工单号']
    // 行级(用户口径「工单号+工单行号确定当前唯一工单」):把行号一并带给弹窗内的快速排产,
    //   否则弹窗只按工单号筛 ⇒ 同工单其它行也一起列出来(用户报障场景)
    schedXc.value = r['工单行号'] ?? null
    schedVisible.value = true
    return
  }
  // 多行:关键字表达不了多张单 ⇒ 不预置 keyword,改把 行id/工单号 列表交给内嵌页收敛
  schedNo.value = ''
  schedXc.value = null
  schedIds.value = ok.map((r) => r['行id']).filter((x) => x != null)
  schedNos.value = [...new Set(ok.map((r) => r['工单号']).filter(Boolean))]
  schedVisible.value = true
}

const filtered = computed(() => rows.value.filter((r) => {
  if (stateFilter.value === '未完工' && r.生产状态 === '完工') return false
  if (stateFilter.value === '已完工' && r.生产状态 !== '完工') return false
  return true
}))

/**
 * 滚动加载(2026-11-09 用户口径 2.0,取代上一版分页):**不要分页,向下滚动才加载下一批**。
 *
 * 根因回顾:原来把查询到的**全部行**一次性交给 el-table 渲染(实测全量 399 行 × 119 列 ≈ 4.7 万单元格,
 * 主线程阻塞 15 秒以上、页面完全无响应)。数据本身一次查询就回(后端 ~330ms,不是瓶颈),卡的是渲染,
 * 所以这里做「增量渲染」:先渲染前 50 行(当前显示顺序 = 后端返回顺序,从上到下),滚到接近底部再追加 50 行。
 * 行数据始终全部在内存里 ⇒ 跨页/跨批勾选(reserve-selection)、导出、结案/切单/打印等原能力不变。
 *
 * 为什么一批 50:本表列数极多(基础 36 列 + 数据驱动的日排产日期列,全量时 119 列),验收实测
 * 50 行一批的渲染成本已到 ~2 秒长任务量级;批次再大就会重新变成"滚动一下卡几秒"。
 */
const LOAD_BATCH = 50
const visibleCount = ref(LOAD_BATCH)
/** 正在追加下一批(渲染是同步长任务,用 flag + nextTick 防同一轮滚动事件重复触发) */
const loadingMore = ref(false)
/** 表格当前渲染的行:按显示顺序取前 visibleCount 条 */
const visibleRows = computed(() => filtered.value.slice(0, visibleCount.value))
/** 还有没渲染的行(底部提示/滚动追加的判据) */
const hasMore = computed(() => visibleCount.value < filtered.value.length)

/** 表格内部纵向滚动容器(Element Plus 的 el-scrollbar__wrap):绑定/解绑都从这里拿 */
let scrollWrap = null
/** 离底部多少 px 内触发下一批(160 ≈ 5 行,提前一点让滚动手感不断档) */
const SCROLL_TRIGGER_PX = 160

function onTableScroll(e) {
  const el = e.target
  if (!el || el.scrollTop + el.clientHeight < el.scrollHeight - SCROLL_TRIGGER_PX) return
  loadMore()
}
/** 下一批(幂等:loadingMore/到底 时直接返回;点击底部提示也能触发) */
function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  visibleCount.value = Math.min(filtered.value.length, visibleCount.value + LOAD_BATCH)
  // DOM 落地后立刻放开:追加后内容变长、滚动位置不再在底部,不会同一手势重复触发;
  // ⚠ 不要用 setTimeout 复位 —— 浏览器后台标签页会节流定时器,会卡在「加载中…」不再继续(2026-11-09 实测踩过)。
  nextTick(() => { loadingMore.value = false })
}
/** 重置为「首屏一批」并把表格滚回顶部(查询/筛选变化时用) */
function resetScrollLoad() {
  visibleCount.value = LOAD_BATCH
  loadingMore.value = false
  nextTick(() => { if (scrollWrap) scrollWrap.scrollTop = 0 })
}
/** 绑定表格内部滚动监听(表格 body 的 wrap 元素在数据/列变化时通常复用,变了就重绑) */
function bindTableScroll() {
  const el = tableRef.value?.$el?.querySelector?.('.el-table__body-wrapper .el-scrollbar__wrap') || null
  if (el === scrollWrap) return
  unbindTableScroll()
  scrollWrap = el
  scrollWrap?.addEventListener('scroll', onTableScroll, { passive: true })
}
function unbindTableScroll() {
  if (!scrollWrap) return
  scrollWrap.removeEventListener('scroll', onTableScroll)
  scrollWrap = null
}
/** 状态筛选变化:回到首屏一批(2026-11-09 修复:原来 @change 挂的 applyFilter 根本没定义) */
function applyFilter() { resetScrollLoad() }
/**
 * 查询/重查(日期范围变化、模糊搜索、查找、刷新):回到首屏一批再取数。
 * 动作后(结案/切单/打印/排产弹窗关闭)的 load() 保留已加载的批数,避免用户滚了半天被弹回首屏。
 */
function onQuery() { resetScrollLoad(); load() }

function num(v) { const n = Number(v || 0); return n ? n.toFixed(2).replace(/\.?0+$/, '') : '0' }
/** 按量流转字段展示(2026-11-12):后端没给数(未排产/无台账)显示 '-'，0 也要显示 0(缺口 0 有意义) */
function flowNum(v) { return (v === null || v === undefined || v === '') ? '-' : num(v) }
function err(e, f) { ElMessage.error(e?.response?.data?.message || tt(f)) }

// ───────── 日排产(2026-10-29):直接长在本页明细表的日期列 ─────────
// 用户口径:「生产工单中需要能实现对后面日期的排产量设定……在当前的表格内容处插入当前设定的
// 日排产数量,修改需要针对当前生产工单和工单排产中都要实现」⇒ 不新增表格/块,窗口内每天一列。
// 2026-10-31 口径演进:①自动算(工序计划量 ÷ 开工日→交期);②**双击弹出「排产快速调整」**,
//   在那里集中改 当天数量(人工指定/恢复自动)、计划开工日、预定完成日;
//   改过的那天存 wo_day_plan 当「人工指定」,其余天按剩余量重摊(守恒);
//   格下方绿色小字 = 当天已审核报工量(只读对照)。
// 数据接口与工单排产同一套(/px/scheduleBoard/dayPlan/*),两页行为一致。
const planDates = ref([])
const planToday = ref('')
/** 「日排产」权(改当天数量/日期):两页任一授予即可 */
const canDayPlan = computed(() => canDoAny(permUser, ['WORK_ORDER_LIST', 'WORK_ORDER_BOARD'], 'dayplan'))
/** 排产快速调整弹窗(生产工单页不带「调线」块 —— 用户口径 A:该页不需要调线) */
const quickVisible = ref(false)
const quickRow = ref({})
const quickDate = ref('')
function openQuick(row, d) {
  quickRow.value = row
  quickDate.value = d || planToday.value
  quickVisible.value = true
}
/** 弹窗保存后:整表重拉(数量/日期/产线都可能变),日计划后端会重算 */
function afterQuickSaved() { load() }

function isManual(row, d) { return ((row.人工指定 || {})[d] ?? null) != null }
function overTitle(row) {
  const over = Number(row.超分配 || 0)
  return over > 0 ? `${tt('人工指定')} · ${tt('超分配')} ${qtyText(over)}` : tt('人工指定')
}

/**
 * 双击改数量时的**预填值 / 保存前比较值** = 计划值(2026-11-13)。
 *
 * <p>格内显示的是「原计划/报工」两个数,但可编辑的只有**计划那一本账** ⇒ 预填与 before 比较
 * 都必须用它(否则会预填成报工数,或把「显示文字变了」误判成用户改过数量)。
 * 优先级:人工指定(手填过) ∪ 日计划(今天及以后的重摊值) ∪ 原计划(基线)。
 */
function planEditValue(row, d) {
  const v = row.人工指定?.[d] ?? row.日计划?.[d] ?? row.原计划?.[d] ?? 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
/** 本行排产区间(开工日~计划完工日)之外的空白格:画「/」(2026-11-01 用户口径,
 *  例:开工日改成 11-02 后,11-01 那格要画 /)。
 *  有计划/实报/人工指定的格子照旧显示数字;2026-11-13 起**原计划>0 也不画「/」**
 *  (历史基线落在排产区间外时仍要摆出来,否则欠产格子会被斜杠吞掉)。 */
function isOutCell(row, d) {
  const p = Number((row.日计划 || {})[d] || 0)
  const a = Number((row.日报工 || {})[d] || 0)
  const b = Number((row.原计划 || {})[d] || 0)
  if (p > 0 || a > 0 || b > 0) return false
  return isOutOfPlanRange(d, row.计划开工日期 || '', row.计划完工日期 || '')
}
/**
 * 格 tooltip(2026-11-13 新口径,与「工单排产」页同文案):
 *   · 当天已结束且报工未达原计划(short>0)⇒ 点明欠多少 + 「未完成量已并入后续日期重排」;
 *   · 有报工 ⇒ `原计划 X · 报工数 Y`(与格内两数一致);
 *   · 没报工 ⇒ `计划 X`(今天及以后的重摊值);
 *   · 空格(没有原计划/计划/报工)只留编辑提示。
 * 文案一律 tt()(显示层),数字走 qtyText;入参是 {@link dayCellView} 的返回,避免一格算两遍。
 */
function dayTitle(v) {
  const hint = tt('双击直接填当天数量;清空恢复自动')
  if (!v.planText && !v.actualText) return hint
  if (v.short > 0) {
    return `${tt('当天未完成')} · ${tt('原计划')} ${v.planText} · ${tt('报工数')} ${v.actualText || '0'}`
      + ` · ${tt('欠产')} ${qtyText(v.short)} · ${tt('未完成量已并入后续日期重排')}`
  }
  if (v.hasActual) {
    return (v.planText ? `${tt('原计划')} ${v.planText} · ` : '') + `${tt('报工数')} ${v.actualText} · ${hint}`
  }
  return `${tt('计划')} ${v.planText} · ${hint}`
}

/**
 * 列头/空格的固定文案:翻译一次即可(原实现每个格子都调 tt())。
 * 2026-11-13 新口径:格内两数怎么读、原计划怎么来、标红什么意思,都写在列头 tooltip 里。
 */
const dayHeadTitle = computed(() => tt('格内:原计划/报工;原计划 = 工序计划量按 开工日→交期 均摊(不扣报工、历史也保留);标红 = 当天已结束未达成'))
const outCellTitle = computed(() => tt('不在本行排产区间(开工日~计划完工日)内'))

/** 悬停明细最多列多少条(超出只写「… 共 N 处」—— 不弹窗,别让 tooltip 长到拉不到底) */
const SHORT_TITLE_MAX = 15
/**
 * 历史欠产汇总(2026-11-13 用户口径「当天结束后未完成会进行提示」;与「工单排产」页同口径)。
 *
 * <p>统计 = **当前筛选后的行集 `filtered`** 里「日期 < 今天 且 报工 < 原计划」的格子 ——
 * 与页面上「未完工/已完工」页签、产线筛选保持一致(用户看到哪批行,提示就只算哪批);
 * 用 `filtered` 而不是滚动加载中的 `visibleRows` ⇒ 向下滚动追加行时汇总数不会跳。
 *
 * <p>判定/合计都来自 {@link historyShortfalls} + {@link shortfallTotals}(business/dayPlan.js,
 * 有单测),本页只做显示。后端没返回「原计划」⇒ 明细为空 ⇒ count=0 ⇒ 整条不渲染
 * (5173 + 旧 8090 的过渡态,不出假提示)。
 *
 * <p>性能:只随 行集合/日计划/今天 变化重算(computed 缓存),与表格滚动渲染无关。
 */
const shortInfo = computed(() => {
  const items = historyShortfalls(filtered.value, planToday.value)
  const { count, qty } = shortfallTotals(items)
  return { count, qty, items }
})
/** 汇总条的悬停明细:每行 `工单号#行号 · 日期 · 原计划 X / 报工数 Y · 欠产 Z`(最多 15 行) */
const shortTitle = computed(() => {
  const items = shortInfo.value.items
  if (!items.length) return ''
  const lines = [tt('历史未完成明细')]
  for (const it of items.slice(0, SHORT_TITLE_MAX)) {
    const r = it.row || {}
    // 行标签 = 工单号#工单行号(与快速排产弹窗、追溯弹窗同一把行键;缺行号时只写工单号)
    const no = `${r['工单号'] ?? ''}${r['工单行号'] != null ? '#' + r['工单行号'] : ''}`
    lines.push(`${no} · ${it.date} · ${tt('原计划')} ${qtyText(it.plan)} / ${tt('报工数')} ${qtyText(it.actual) || '0'} · ${tt('欠产')} ${qtyText(it.short)}`)
  }
  if (items.length > SHORT_TITLE_MAX) lines.push(`… ${tt('共')} ${items.length} ${tt('处')}`)
  return lines.join('\n')
})

/**
 * 日排产列(渲染用,预计算):短日期 + 今天标记 + 过去/今天底色状态。
 * 原来在模板里逐列调 dayColState/isToday(83 列 × 每次重渲),现在随 planDates/planToday 一次算好。
 */
const planCols = computed(() => {
  const today = planToday.value
  return planDates.value.map((d, i) => ({
    d, i, short: d.slice(5), isToday: isToday(d, today), state: dayColState(d, today),
  }))
})

/**
 * 一行 × 全部日期的格子模型(2026-11-09 性能关键)。
 *
 * 原实现每个日期格在**每一帧**里都要跑 dayCell + isOutCell + dayTitle + qtyText + 多次 tt():
 * 83 个日期列 × 每行 × 每次重渲 —— 验收 profile 实测「追加 50 行」的重渲里这类函数/日期解析占大头,
 * 且耗时随总行数线性增长(50→100 行 patch 2.7s、100→150 行 5.2s)。现在改为**数据加载时算一次**,
 * 渲染期只读 row.__dp[i] 的普通属性。
 */
function buildRowDayCells(row) {
  const dates = planDates.value
  const cells = new Array(dates.length)
  const over = Number(row.超分配 || 0) > 0
  const manualTitle = overTitle(row)
  const today = planToday.value
  const plan = row.日计划 || {}
  const done = row.日报工 || {}
  const base = row.原计划 || {}
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i]
    // 2026-11-13:格内两数「原计划/报工」+ 历史欠产判定 —— 口径集中在 dayCellView
    // (past 才判欠产:今天还没结束,白天的正常进度不能被标红)
    const v = dayCellView(plan[d], done[d], base[d], isPast(d, today))
    const manual = isManual(row, d)
    cells[i] = {
      out: isOutCell(row, d),
      text: v.text,
      planText: v.planText,
      actualText: v.actualText,
      short: v.short,
      cls: { manual, actual: v.hasActual, short: v.short > 0 },
      title: dayTitle(v),
      manual,
      over,
      manualTitle,
    }
  }
  return cells
}

/** 格内直接填(2026-10-31 用户口径「直接填写这个就行」):双击变输入框,回车/失焦保存,Esc 取消 */
const qtyEdit = ref('')
const qtyDraft = ref(0)
function qtyKey(row, d) { return `${row.行id}|${d}` }
function startQtyEdit(row, d) {
  if (!canDayPlan.value) return
  qtyEdit.value = qtyKey(row, d)
  // 预填 = **计划值**(2026-11-13):格内显示的是「原计划/报工」,不能拿显示数/报工数当预填
  qtyDraft.value = planEditValue(row, d) || undefined
}
function cancelQtyEdit() { qtyEdit.value = ''; qtyDraft.value = 0 }
async function commitQty(row, d) {
  if (qtyEdit.value !== qtyKey(row, d)) return
  const v = Number(qtyDraft.value || 0)
  // 与预填同一把尺子(planEditValue):只按"计划那本账"判断用户到底改没改
  const before = planEditValue(row, d)
  qtyEdit.value = ''
  if (v === before) return
  try {
    const r = await saveDayPlan([{ 工单行id: row.行id, 工序: row.工序日 || row.当前工序 || '',
      生产线: row.生产线 || '', 计划日期: d, 计划数量: v }])
    const o = (r['超分配'] || []).find((x) => String(x['工单行id']) === String(row.行id))
    if (o) ElMessage.warning(`${tt('人工指定已超出工序计划量')}: ${qtyText(o['超出'])}${tt('(只提示,不拦保存)')}`)
    await loadDayPlan()
  } catch (e) { err(e, '保存失败') }
}

/**
 * 把日排产接口返回的「日期列 / 今天 / 每行日计划」写进给定的行对象。
 *
 * 2026-11-09:抽成纯函数的原因见 {@link load} —— 它要在**给 rows 赋值之前**就把日计划并进去,
 * 让整表只渲染一次;就地改某天(commitQty)之后的刷新仍走 {@link loadDayPlan}(改内存行)。
 */
function applyDayPlan(rowsList, data) {
  planDates.value = (data && data['日期']) || []
  planToday.value = (data && data['今天']) || ''
  const byId = new Map()
  for (const p of (data && data['行']) || []) byId.set(String(p['行id']), p)
  for (const row of rowsList) {
    const p = byId.get(String(row.行id))
    row.工序日 = p ? p['工序'] : (row.当前工序 || '')
    row.日计划 = { ...((p && p['日计划']) || {}) }
    row.日报工 = { ...((p && p['日报工']) || {}) }
    // 2026-11-13:原计划 = 后端新给的「基线」账(工序计划量按 开工日→交期 均摊,不扣报工、历史也保留);
    // 老后端没有这个字段 ⇒ {} ⇒ dayCellView 退回单数显示、汇总条不出现(优雅降级)。
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
    // 日排产格子模型:加载时算一次,渲染期只读属性(见 buildRowDayCells 注释)
    row.__dp = buildRowDayCells(row)
  }
}

/** 就地刷新当前列表的日排产(改某天数量/改排产日期后用):只改内存行,不重查工单列表 */
async function loadDayPlan() {
  if (!rows.value.length) { planDates.value = []; planToday.value = ''; return }
  try {
    const data = await fetchDayPlan({ 行id列表: rows.value.map((r) => r.行id).filter((x) => x != null) })
    applyDayPlan(rows.value, data)
  } catch (e) { err(e, '查询失败') }
}

// ⚠ 2026-10-31 最终口径:日计划默认由系统自动均摊,只允许「就地改某一天」(其余天按剩余量重摊);
//   不再有「全量手填 + 保存日排产」那套入口(2026-10-30 删掉的均摊弹窗也不恢复)。

async function load() {  try {
    const cond = {}
    // 日期区间(2026-11-09:来自 daterange 控件;两端都有值才作为条件,清空 = 查全量)
    const rg = queryRange.value
    if (rg.from) cond['日期从'] = rg.from
    if (rg.to) cond['日期到'] = rg.to
    if (qText.value.trim()) cond['keyword'] = qText.value.trim()
    if (lineFilter.value) cond['生产线'] = lineFilter.value
    const res = await request.post('/px/workOrderList', cond)
    const list = (res.data || []).map((r) => ({
      ...r,
      rowKey: String(r.行id ?? (r.工单号 + '#' + r.工单行号)),
      日计划: {}, 日报工: {}, 原计划: {},
    }))
    // 2026-11-09 性能修复(验收 FAIL #4b):**先取日排产、把日期列+每行日计划并进还没上屏的行对象,
    //   最后才给 rows 赋值** ⇒ 整表只渲染 1 次。
    //   原实现是「赋值 rows(首次渲染 36 列)→ 再 loadDayPlan:先加 30+ 个日排产列(整表重渲)→
    //   再逐行写日计划(又重渲)」,大范围全量时 100 行 × 119 列要整表重渲 3 次、主线程 10 秒+。
    //   日排产取不到时只少「日排产」相关列,不阻断工单列表本身。
    if (list.length) {
      const ids = list.map((r) => r.行id).filter((x) => x != null)
      if (ids.length) {
        try { applyDayPlan(list, await fetchDayPlan({ 行id列表: ids })) } catch { applyDayPlan(list, null) }
      } else {
        applyDayPlan(list, null)
      }
    } else {
      applyDayPlan([], null)
    }
    rows.value = list
    // 2026-10-05 修复:刷新后清掉旧勾选 —— reserve-selection 会保留"已从列表消失的行"的勾选(且无法手动取消),
    // 造成切单/撤回切单永久提示「请先勾选一张工单」。
    checked.value = []
    currentRow.value = null
    tableRef.value?.clearSelection?.()
    applyLineMeta()
    // 2026-11-09 滚动加载:结果变少时把已加载批数夹回总数(保留用户已滚到的进度,不回退首屏);
    // 渲染完成后拿到新的表格滚动容器并重绑监听(列数量变化时 el-table 可能重建 body,旧 wrap 会失效)。
    visibleCount.value = Math.max(LOAD_BATCH, Math.min(visibleCount.value, filtered.value.length))
    await nextTick()
    bindTableScroll()
  } catch (e) { err(e, '查询失败') }
}

async function loadLines() {
  try {
    const res = await request.post('/px/scheduleBoard/linesSummary', { 开工日期: new Date().toISOString().slice(0, 10) })
    lines.value = [...new Map((res.data || []).map((x) => [x['生产线'], { v: x['生产线'], t: x['生产线'] + (x['生产车间'] ? '·' + x['生产车间'] : '') }])).values()]
  } catch { /* 不阻断 */ }
}

function applyLineMeta() {
  const l = lines.value.map((x) => x.v)
  for (const r of rows.value) if (!r.生产线) r.生产线 = ''
  lineCode.value = lineFilter.value ? (lines.value.find((x) => x.v === lineFilter.value)?.t.split('·')[1] || '') : ''
  void l
}

// 排产写入口已撤(2026-09-28 用户拍板):生产工单=纯汇总视图,数据只由订单结转产生;
// 排产/改数量/换线 → 一律走「快速排产」唯一入口(/px/scheduleBoard/assign)。

/** 结案回正(2026-10-18):外部程序(手机端小程序/参考库)直连库把工单写成已结案时,一键改回未结案。
 *  先体检(只读)拿到行数再确认;判据与后端 WorkOrderCloseGuard 同一份,只动"入库<排产且没有已审检验单"的行。 */
async function onCloseHeal() {
  let n = 0
  try {
    const audit = await request.post('/px/workOrderList/closeAudit', {})
    if (audit.status !== 200) return
    n = (audit.data || []).length
  } catch (e) { err(e, '结案体检失败'); return }
  if (!n) { ElMessage.success(tt('没有需要回正的结案行')); return }
  try {
    await ElMessageBox.confirm(
      `${tt('把外部程序误写成「已结案」的工单改回未结案')}（${n} ${tt('行')}）?`,
      tt('结案回正'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消'), type: 'warning' })
  } catch { return }
  try {
    const res = await request.post('/px/workOrderList/closeHeal', {})
    if (res.status === 200) {
      ElMessage.success(`${tt('已回正')} ${res.data?.['回正行数'] ?? 0} ${tt('行')}`)
      load()
    }
  } catch (e) { err(e, '结案回正失败') }
}

async function onClose(close) {
  const nos = [...new Set(checked.value.map((r) => r.工单号))]
  if (!nos.length) return
  try {
    await ElMessageBox.confirm(
      `${tt('确认')} ${close ? tt('结案') : tt('取消结案')} ${nos.length} ${tt('张工单')}?`,
      tt(close ? '结案' : '取消结案'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  try {
    const res = await request.post('/px/workOrderList/close', {
      结案: close,
      rows: checked.value.map((r) => ({ 公司代码: r.公司代码, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号 })),
    })
    if (res.status === 200) { ElMessage.success(tt('操作成功')); load() }
  } catch (e) { err(e, '操作失败') }
}

/**
 * 打印工单(两模板可选,2026-09-27):勾选行直打,打印留痕回写 plang。
 *   成型生产任务单/组装生产任务单 = 行表任务单(横版,列见截图版式)。
 * ⚠ 2026-10-14 「生产投料单」模板下线:它的物料行全部来自自建 BOM
 *   (/px/workOrderBom → bs_bom),随 MES 自建 BOM 功能整体删除,前端已无替代数据源。
 */
async function doPrintTask(mode) {
  const src = checked.value.length ? checked.value : (currentRow.value ? [currentRow.value] : [])
  if (!src.length) { ElMessage.warning(tt('请先勾选要打印的工单')); return }
  try {
    // 成型任务单的数量 = **按工艺路线换算后的成型工序量**(2026-10-05 用户口径:
    // 「成型打印的任务单就是需要根据换算进行的…不需要显示换算率,显示换算后的数量即可」)。
    // 换算因子 = 该**工单行**成型工序的计划量 ÷ **该行**计划合计(即累计换算率),再按该行的排产数量摊算;
    // 取不到(未绑路线/无换算)时退回排产数量,不影响既有打印。
    // ⚠ 2026-10-15 改**按行**(用户口径「工单号+工单行号确定当前唯一工单,各个工单的进程、
    //   流程追溯都这样实现,都需要这两个进行确定」):原来只传 工单号 ⇒ 后端返回**整单**计划合计,
    //   而同一工单**不同行的工艺路线/排产数量可以不同**(实测 GD-2026-10-0002:行2/3/4 与行1/5/6/7/8
    //   路线不同)⇒ 整单因子套到每一行,打印出的成型数量是错的。现逐行取该行自己的合计与成型量,
    //   因子按 `工单号#行id` 存。
    const fkey = (r) => `${r.工单号}#${r.行id}`
    const factor = {}
    if (mode === '成型生产任务单') {
      await Promise.all(src.map(async (r) => {
        try {
          const d = (await request.post('/px/processTask/detail', { 工单号: r.工单号, 工单行id: r.行id })).data || {}
          const total = Number(d['计划合计'] || 0)
          const st = (d['工序步骤'] || []).find((x) => x['工序'] === '成型')
          const q = Number(st?.['计划量'] || 0)
          if (total > 0 && q > 0) factor[fkey(r)] = q / total
        } catch { /* 取不到就退回排产数量 */ }
      }))
    }
    const rowsToPrint = src.map((r) => ({
      单据编号: r.工单号,
      公司代码: r.公司代码 || '', 工单行号: r.工单行号, // 工单二维码=公司代码@工单号@1000+工单行号(2026-10-09 规则改版)
      是否重点管控产品: r.重点管控 || '',
      商品编码: r.物料编码 || '',
      商品名称: r.产品名称 || '',
      规格型号: r.规格型号 || '',
      订单数量: r.需求数量,
      // 成型任务单:换算后的数量(出货口 = **该行**排产数量 × 该行累计换算率,如 3 倍 → 80 变 240)
      成型折算后数量: factor[fkey(r)] ? Math.round(Number(r.排产数量 || 0) * factor[fkey(r)] * 10000) / 10000 : r.排产数量,
      计划完工日期: r.计划完工日期 || '',
      批号: r.批号 || '', 物料编码: r.物料编码 || '',
      排产数量: r.排产数量, 生产线: r.生产线 || lineFilter.value || '',
    }))
    // 纸面不印打印日期/制单人/线体(2026-10-21 用户口径)⇒ 无选项要传
    const okPrint = await printWorkTaskSheet(mode, rowsToPrint)
    if (okPrint) {
      await request.post('/px/workOrderList/printStamp', {
        rows: src.map((r) => ({ 公司代码: r.公司代码, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号 })),
      })
    }
    load()
  } catch (e) { err(e, '打印失败') }
}

// 「转领料单」前端入口已下架(2026-11-05 用户口径,原 toPicking() 函数同步删除)。
// 后端实现原样保留:/px/workOrderList/toPicking + WorkOrderPickingService(含 ManuWritebackService 回写);
// 端点仍按 picking 词做闸门(PanelPermissionService.BUTTON_PERMS_OVERRIDE 保留该词映射)。
// 领料单改由「材料出库单」面板手工建单,审核出库后照旧回写工单「领料单号」。

/** 切单(9.29 批次①):勾选/当前行必须恰为一张工单 → 后端预览可切上限 → 弹窗输入切出数量 */
function splitTarget() {
  // 2026-10-05 修复「撤回切单后一直提示请勾选一个工单」:表格开了 reserve-selection,
  // 被撤回的子单行已从列表消失、但勾选状态仍留在 checked 里(且无法取消)→ checked.length≠1 永久卡死。
  // 口径:只认**当前列表里还在的**选中行(按 行id);没有则退回当前行(currentRow)。
  const alive = (checked.value || []).filter((x) => rows.value.some((r) => String(r.行id) === String(x.行id)))
  const cur = currentRow.value && rows.value.some((r) => String(r.行id) === String(currentRow.value.行id)) ? currentRow.value : null
  const list = alive.length ? alive : (cur ? [cur] : [])
  if (list.length !== 1) {
    ElMessage.warning(list.length === 0 ? tt('请先勾选一张工单')
      : `${tt('请只勾选一张工单')}（${tt('当前已勾选')} ${list.length} ${tt('张')}）`)
    return null
  }
  return list[0]
}

function openMixingRecipe() {
  const alive = (checked.value || []).filter((x) => rows.value.some((r) => String(r.行id) === String(x.行id)))
  const cur = currentRow.value && rows.value.some((r) => String(r.行id) === String(currentRow.value.行id)) ? currentRow.value : null
  const list = alive.length ? alive : (cur ? [cur] : [])
  if (list.length !== 1) { ElMessage.warning(list.length ? tt('请只勾选一张工单') : tt('请先勾选一张工单')); return }
  mixingTarget.value = list[0]
  mixingQty.value = Number(list[0].排产数量 || list[0].需求数量 || 0)
  previewMixing()
}

async function previewMixing() {
  if (!mixingTarget.value) return
  try {
    const r = mixingTarget.value
    const res = await request.post('/px/workOrderList/recipe', {
      工单号: r.工单号, 行id: r.行id, 混料数量: Number(mixingQty.value || 0),
    })
    mixingData.value = res.data || null
    mixingVisible.value = true
  } catch (e) { err(e, '配方读取失败') }
}

async function saveMixingRecipe() {
  if (!mixingTarget.value || !(Number(mixingQty.value) > 0)) { ElMessage.warning(tt('混料数量必须大于0')); return }
  mixingLoading.value = true
  try {
    const r = mixingTarget.value
    const res = await request.post('/px/workOrderList/mixing', {
      工单号: r.工单号, 行id: r.行id, 混料数量: Number(mixingQty.value),
    })
    mixingData.value = res.data || mixingData.value
    ElMessage.success(`${tt('混料配方获取成功')}：${mixingData.value?.['配方单号'] || ''}`)
    mixingVisible.value = false
    await load()
  } catch (e) { err(e, '混料配方获取失败') } finally { mixingLoading.value = false }
}

async function openSplit() {
  const r = splitTarget()
  if (!r) return
  try {
    const res = await request.post('/px/workOrderList/splitPreview', {
      行id: r.行id, 工单号: r.工单号, 工单行号: r.工单行号, 批次号: r.批次号,
    })
    splitInfo.value = res.data || {}
    splitQty.value = 0
    splitVisible.value = true
  } catch (e) { err(e, '切单失败') }
}

async function doSplit() {
  if (!splitInfo.value) return
  const q = Number(splitQty.value) || 0
  if (q <= 0) { ElMessage.warning(tt('请输入切出数量')); return }
  try {
    await ElMessageBox.confirm(
      `${tt('确认从')} ${splitInfo.value['工单号']} ${tt('切出')} ${num(q)} ${tt('生成子工单')}?`,
      tt('切单'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消') })
  } catch { return }
  splitLoading.value = true
  try {
    const res = await request.post('/px/workOrderList/split', {
      行id: splitInfo.value['行id'], 工单号: splitInfo.value['工单号'], 工单行号: splitInfo.value['工单行号'],
      批次号: splitInfo.value['批次号'], 切出数量: q, 继承排产: splitInherit.value,
    })
    const d = res.data || {}
    splitVisible.value = false
    ElMessage.success(`${tt('已生成子工单')} ${d['子工单号']}（${tt('切出')} ${num(d['切出数量'])}）`)
    load()
  } catch (e) { err(e, '切单失败') } finally { splitLoading.value = false }
}

/** 撤回切单:仅「切出来的子工单」可撤回;后端再校验无报工/入库/领料/结案/再切分 */
async function onUnsplit() {
  const r = splitTarget()
  if (!r) return
  if (!r.源工单号) { ElMessage.warning(tt('该工单不是切出的子工单,无需撤回')); return }
  try {
    await ElMessageBox.confirm(
      `${tt('撤回切单')} ${r.工单号}?${tt('将还原父工单')} ${r.源工单号} ${tt('的数量')}`,
      tt('撤回切单'), { confirmButtonText: tt('确认'), cancelButtonText: tt('取消'), type: 'warning' })
  } catch { return }
  try {
    // 两把键都带上(标识 = 工单号 + 工单行号):后端优先 行id,缺了按 (工单号+行号) 反查
    const res = await request.post('/px/workOrderList/unsplit', { 行id: r.行id, 工单号: r.工单号, 工单行号: r.工单行号 })
    const d = res.data || {}
    ElMessage.success(`${tt('已撤回')} ${d['子工单号']}，${tt('父工单')} ${d['父工单号']} ${tt('还原')} ${num(d['还原数量'])}`)
    load()
  } catch (e) { err(e, '撤回切单失败') }
}

function openTrace(row) {
  // 工单详情·追溯(2026-10-05):与工单排产**同一个弹窗组件**,本页原地打开(用户口径「不是跳转到工单排产」)。
  // 行级口径(2026-10-15):必须把**工单行id**一起传下去 —— 同工单号可有多行/多批次,
  //   只传单号会把别的行的报工/检验数据一起带出来(用户报障)。
  const src = row || currentRow.value || checked.value[0]
  const no = src?.['工单号']
  if (!no) return
  traceNo.value = no
  traceRowId.value = src?.['行id'] ?? null
  traceVisible.value = true
}

function exportCsv() {
  // 2026-11-08:「余量」列已隐藏(口径无业务意义,见模板内注释)⇒ 导出表头同步去掉,避免出现界面没有的列
  const head = ['公司代码', '工单号', '工单行号', '批次号', '单据日期', '转单时间', '物料编码', '产品名称', '规格型号', '客户', '订单号', '订单行号', '生产线', '需求数量', '转单数量', '入库数量', '领料单号', '打印人', '打印时间', '生产状态', '结案']
  const csv = '\ufeff' + [head.join(',')]
    .concat(filtered.value.map((r) => head.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `工单排产列表-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

/** 本机时区的 yyyy-MM-dd(偏移 n 天;n=0 为今天) */
function dayStr(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(async () => {
  // 从桌面「单据入口」带 keyword 进来优先(否则按默认 15 天窗口取数)
  const routed = applyRouteKeyword()
  if (!routed && !(datePick.value || []).length) {
    // 已填过值(如热更重挂)不覆盖用户输入;daterange 绑定值 = [开始, 结束]
    datePick.value = [dayStr(-(DEFAULT_WINDOW_DAYS - 1)), dayStr(0)]
  }
  await load()
  loadLines()
  // 生产工序进度看板点行跳进来(?focus=行id):定位该行并自动打开追溯
  await applyRouteFocus()
})

/**
 * 切回本页签时**重新取数**(2026-10-14,与「快速排产」页同一口径 —— 两处必须一致)。
 *
 * 根因:`PortalLayout` 的 `<router-view>` 外有 `<keep-alive>`,本页被缓存 ⇒ 在「快速排产」排产/撤销后
 * 切回本页,列表仍显示上一次的产线/生产状态(本页的「排产」是弹窗内嵌快速排产,关弹窗会 load,
 * 但**别人改的**排产状态不会自动反映)。现每次切回都重拉列表。
 *
 * ⚠ 只认**切回**(首次 activate 跳过):首次挂载已由 onMounted 取数。
 */
let firstActivate = true
onActivated(async () => {
  if (firstActivate) { firstActivate = false; return }
  // 桌面入口/看板再次跳进来(路由 keyword/focus 变了)也要落到那笔单:keep-alive 缓存下 onMounted 不会再跑
  const routed = applyRouteKeyword()
  if (routed) {
    await load()
    loadLines()
    await applyRouteFocus()
    return
  }
  await load()
  await applyRouteFocus()
})

/**
 * keep-alive 下 append-to-body 弹窗不会随页面切走而隐藏(2026-11-08 实测):
 * 从「生产工序进度看板」点行跳进来会自动打开「工单详情·追溯」,若用户直接切到别的页签,
 * 该弹窗会浮在新页面上挡住点击(其它页面也是同一机制,但只有本页会**自动**打开弹窗)。
 * ⇒ 切出本页时收起追溯弹窗;只关追溯,不改其它弹窗的既有行为。
 * 2026-11-09 滚动加载:切出时解绑表格滚动监听(keep-alive 下 DOM 被摘走,别留着悬空监听)。
 */
onDeactivated(() => { traceVisible.value = false; unbindTableScroll() })
onBeforeUnmount(() => unbindTableScroll())
</script>

<style scoped>
.wol-page { padding: 8px 12px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; background: #fff; overflow: auto; }
.wol-query, .wol-btns, .wol-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wol-query { padding: 6px 0; border-bottom: 1px solid #eee; }
.wol-lb { font-size: 13px; color: #606266; }
.wol-sep { color: #909399; }
.wol-count { margin-left: auto; font-size: 13px; color: #303133; }
/* 历史欠产汇总条(2026-11-13):当天已结束但报工未达原计划 ⇒ 一行红色汇总;悬停看逐条明细(不弹窗) */
.wol-short { flex: none; display: flex; align-items: center; gap: 10px; padding: 4px 10px;
  border: 1px solid #fde2e2; background: #fef0f0; border-radius: 4px; }
.wol-short-main { color: #f56c6c; font-size: 13px; font-weight: 700; cursor: help; }
.wol-short-tip { color: #909399; font-size: 12px; }
.wol-table { flex: 1; min-height: 0; }
/* 滚动加载状态条(2026-11-09):表格下方一行小字,不参与表格高度分配;可点击继续加载 */
.wol-loadmore {
  flex: none; display: flex; align-items: center; justify-content: center;
  min-height: 22px; font-size: 12px; color: #909399;
}
.wol-lm-more { cursor: pointer; color: #1e6fb8; }
.wol-lm-more:hover { text-decoration: underline; }
.wol-lm-arrow { font-style: normal; font-weight: 700; margin-left: 2px; }
.wol-lm-busy { color: #e6a23c; }
.wol-loadmore.is-end { color: #c0c4cc; }
/* 日排产日期列(2026-10-29;2026-10-31:自动均摊 + 双击就地改):上=当天计划,下=当天已审核报工量 */
.dp-plan { color: #303133; font-weight: 600; line-height: 1.2; cursor: text; }
/* 2026-10-31 融合显示:当天有报工 ⇒ 格子里显示的是**实际完成数**(绿色);没报工显示计划(深色) */
.dp-plan.actual { color: #529b2e; }
/* 2026-11-01:本行排产区间(开工日~计划完工日)之外的空白格画「/」——
   一眼看出那一天**不归本行排**(例:开工日改成 11-02 后,11-01 就是斜杠,而不是空着像漏排) */
.dp-out { color: #c0c4cc; font-weight: 400; line-height: 1.2; user-select: none; }
.dp-input { width: 66px; }
/* 人工指定过的格子加粗变色 + 「手」角标;超分配时角标标红(只提示,不拦保存) */
.dp-plan.manual { color: #b88230; }
/* 2026-11-13:当天已结束且报工未达原计划 ⇒ 整格标红加粗(历史欠产)。
   放在 .actual/.manual 之后:红要压过「绿=有报工」「橙=人工指定」,一眼扫出欠产格 */
.dp-plan.short { color: #f56c6c; font-weight: 700; }
.dp-hand { margin-left: 2px; padding: 0 2px; font-size: 10px; font-weight: 700; color: #fff;
  background: #e6a23c; border-radius: 3px; vertical-align: top; }
.dp-hand.over { background: #f56c6c; }
.dp-input { width: 66px; }
/* 2026-10-31:就地改排产日期(双击计划开工日/计划完工日) */
.dp-date-cell { cursor: text; }
.dp-date-cell:hover { color: #1e6fb8; text-decoration: underline dotted; }
/* 2026-10-31:格内两个数分清 —— 计划(深色,可编辑) / 报工(绿色 + 「实」标,只读)*/
.dp-act { font-size: 11px; color: #529b2e; line-height: 1.1; }
.dp-act-lb { margin-right: 1px; font-weight: 700; }
/* 日期列分段:今天列标「今」+ 浅蓝底;过去列 = 历史对照段,灰底(只影响显示,照样可填)*/
.dp-head { line-height: 1.15; }
.dp-head.past .dp-date { color: #909399; font-weight: 500; }
.dp-head.today .dp-date { color: #1e6fb8; }
.dp-today { margin-left: 2px; font-size: 10px; font-weight: 700; color: #1e6fb8; }
:deep(th.dp-col-past), :deep(td.dp-col-past) { background: #f5f6f8; }
:deep(th.dp-col-today), :deep(td.dp-col-today) { background: #eef6ff; }
.wol-closed { color: #f56c6c; font-weight: 600; }
/* 按量流转「待流入量」>0 = 还在等上一道流下来,标红提示 */
.wol-flow-gap { color: #e6a23c; font-weight: 600; }
/* 按量流转·逐道明细(展开行) */
.wol-flow-box { padding: 8px 12px 10px 12px; background: #fafbfc; }
.wol-flow-title { font-size: 12px; color: #909399; margin-bottom: 6px; }
.wol-flow-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
.wol-flow-tbl th, .wol-flow-tbl td { border: 1px solid #ebeef5; padding: 4px 8px; text-align: left; }
.wol-flow-tbl th { background: #f5f7fa; color: #606266; font-weight: 600; }
.wol-flow-tbl td.num, .wol-flow-tbl th.num { text-align: right; font-variant-numeric: tabular-nums; }
.wol-flow-tbl tr.is-cur td { background: #eef6ff; font-weight: 600; }
.wol-flow-tbl td.empty { text-align: center; color: #909399; }
.wol-split { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.wol-split-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.wol-split-row > span:first-child { color: #909399; }
.wol-split-row.hl b { color: #e6a23c; font-size: 15px; }
.wol-split-tip { color: #909399; font-size: 12px; line-height: 1.5; border-top: 1px dashed #ebeef5; padding-top: 8px; }
</style>
