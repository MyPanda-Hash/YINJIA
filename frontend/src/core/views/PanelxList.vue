<template>
  <div class="panelx-list" @click="closeCtx">
    <!-- ══════════ ① 顶部工具栏（T+ 灰条 + 单据翻页）══════════ -->
    <div v-if="!isApprovalDoc" class="tools">
      <button type="button" class="toolbar-query-btn" :title="tt('按表头字段查询单据')" @click.stop="openQueryDialog">
        <el-icon><Search /></el-icon>
        <span>{{ tt('查询') }}</span>
      </button>
      <!-- 库存状况:仓库下拉(按仓库编码精确过滤,字典改名不影响绑定) -->
      <el-select
        v-if="panelCode === 'STOCK_STATUS'"
        v-model="stockWh"
        class="wh-filter"
        size="small"
        clearable
        filterable
        :placeholder="tt('全部仓库')"
        @change="onStockWhChange"
      >
        <el-option v-for="w in warehouseOptions" :key="w.code" :label="`${w.name}（${w.code}）`" :value="w.code" />
      </el-select>
      <button v-if="panelCode === 'STOCK_STATUS'" type="button" class="toolbar-query-btn" @click.stop="openStockAdd">
        <el-icon><Plus /></el-icon>
        <span>{{ tt('新增库存') }}</span>
      </button>
      <div class="tb-group" v-for="(g, gi) in toolbarGroups" :key="'g' + gi">
        <span class="tb-main" :class="{ disabled: isDisabled(btnName(g)) }" @click="onButton(btnName(g))">
          <span class="act-name">{{ tt(g.name) }}</span>
        </span>
        <span v-if="actsOf(g).length > 1" class="tb-caret" @click.stop="toggleGroup(gi)">▼</span>
        <div v-if="openGroup === gi" class="tb-menu">
          <!-- 下拉排除主按钮（组按钮=第一个 action，下拉只列其余动作，避免「审核」重复） -->
          <div class="ctx-item" :class="{ disabled: isDisabled(a) }" v-for="a in dropItems(g)" :key="a" @click="onGroupAction(a)">{{ tt(a) }}</div>
        </div>
      </div>
      <!-- 对外正式报表:后端 JasperReports 模板(IT 维护版式:公司抬头+页眉页脚+页码)。
           该面板在 reports/report-templates.properties 里登记了模板才出现 —— 没有模板时前端完全无感 -->
      <span
        v-if="reportTemplates.length || user.isAdmin"
        class="tb-main"
        :title="tt('服务端正式报表：含公司抬头、页眉页脚与页码')"
        @click.stop="reportVisible = true"
      >
        <span class="act-name">{{ tt('导出报表') }}</span>
      </span>
      <div class="tools-right">
        <template v-if="reportMode">
          <span class="doc-chip">{{ panelName }}</span>
          <span class="report-count">{{ tt('共') }} {{ total }} {{ tt('条') }}</span>
          <span class="page-btn" :title="tt('首页')" @click="reportPage(1)">◁</span>
          <span class="page-btn" :title="tt('上一页')" @click="reportPage(query.pageNo - 1)">◀</span>
          <span class="page-no">{{ pageText(query.pageNo, reportPageCount, '页') }}</span>
          <span class="page-btn" :title="tt('下一页')" @click="reportPage(query.pageNo + 1)">▶</span>
          <span class="page-btn" :title="tt('末页')" @click="reportPage(reportPageCount)">▷</span>
        </template>
        <template v-else>
          <span class="doc-chip">{{ tt('单据：') }}{{ cur['编号'] || cur['单据编号'] || '-' }}</span>
          <span v-if="cur['类别']" class="doc-cat">{{ tt(cur['类别']) }}</span>
          <span v-if="cur['单据状态']" class="doc-status" :class="cur['单据状态']">{{ tt(cur['单据状态']) }}</span>
          <template v-if="!singleDocMode">
            <span class="page-btn" :title="tt('首页')" @click="pageFirst">◁</span>
            <span class="page-btn" :title="tt('上一张')" @click="page(-1)">◀</span>
            <span class="page-no">{{ pageText(curNo, total, '张') }}</span>
            <span class="page-btn" :title="tt('下一张')" @click="page(1)">▶</span>
            <span class="page-btn" :title="tt('末页')" @click="pageLast">▷</span>
          </template>
        </template>
      </div>
    </div>

    <!-- 报表沿用配置查询字段；单据页显示当前单据表头，草稿态原地编辑。
         查询弹窗/级联面板(收发存/台账/库存状况):查询条件只在弹窗(级联下拉),不显示内联区 -->
    <div v-if="reportMode && !reportQueryDialog && !isCascadePanel" class="fields udl-fields">
      <div class="field" v-for="qr in queryFields" :key="qr.dataName">
        <label :class="{ req: qr.isRequired }">{{ qr.displayName || tt(qr.dataName) }}</label>
        <div v-if="qType(qr) === 'ref' && refModeMap[qr.dataName] === 'select'" class="query-ref-select">
          <el-select
            v-model="condition[qr.dataName]"
            clearable filterable remote allow-create default-first-option
            :remote-method="(kw) => loadRefSelectOptions(qr, qr.dataName, kw)"
            :loading="refSelectData[qr.dataName]?.loading"
            :placeholder="qr.placeholder || tt('输入搜索')"
            style="width: 100%"
            @change="search"
            @clear="search"
            @focus="checkRefMode(qr, qr.dataName)"
          >
            <el-option v-for="o in (refSelectData[qr.dataName]?.options || [])" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </div>
        <div v-else-if="qType(qr) === 'ref'" class="query-ref">
          <el-input
            :model-value="condition[qr.dataName] || ''"
            readonly
            clearable
            :placeholder="qr.placeholder || '请选择'"
            @click="openQueryRef(qr, 'page')"
            @clear="clearQueryRef(qr, 'page')"
          />
          <el-button :icon="Search" title="打开参照" @click="openQueryRef(qr, 'page')" />
        </div>
        <el-select
          v-else-if="qType(qr) === 'select'"
          v-model="condition[qr.dataName]"
          clearable
          filterable
          :placeholder="qr.placeholder || ''"
          @change="search"
        >
          <el-option v-for="o in qOptions(qr)" :key="o.value" :label="o.label ?? o.value" :value="o.value" />
        </el-select>
        <el-date-picker
          v-else-if="qType(qr) === 'date'"
          v-model="condition[qr.dataName]"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="qr.placeholder || '选择日期'"
          @change="search"
        />
        <el-input v-else v-model="condition[qr.dataName]" :placeholder="qr.placeholder || ''" @keyup.enter="search" clearable @clear="search" />
      </div>
    </div>
    <!-- 文书式面板:完整纸张居中 + 功能按钮右侧竖排(不按表头/表中/表尾三段式) -->
    <template v-else-if="isApprovalDoc">
      <div class="approval-layout">
        <ProgressControlSheet
          v-if="panelCode === 'RD_PROGRESS'"
          ref="approvalSheetRef"
          :head="cur" :fields="headerFields" :editable="draftEditable"
          @dirty="markInlineDirty"
          @open-sheets="openDataSheets"
        />
        <DataRecordSheet
          v-else-if="panelCode === 'RD_FILTER_EFF'"
          ref="approvalSheetRef"
          :head="cur" :fields="sheetAllFields" :editable="draftEditable"
          @dirty="markInlineDirty"
          @refresh-config="onFieldEditRefresh"
        />
        <!-- 数据记录表其余 7 张(配置驱动:碱性/矿化/抑菌/阻垢性能/RO保护/浸泡安全/压降精度) -->
        <RecordSheetPanels
          v-else-if="isRecordSheetPanel"
          ref="approvalSheetRef"
          :head="cur" :fields="sheetAllFields" :editable="draftEditable" :panel-code="panelCode"
          @dirty="markInlineDirty"
          @refresh-config="onFieldEditRefresh"
        />
        <DocSheet v-else ref="approvalSheetRef" :head="cur" :fields="headerFields" :editable="draftEditable" :config="docSheetConfig" :panel-code="panelCode" :audited="curDocStatus === '已审核' || curDocStatus === '已归档'" :user="{ realName: user.realName, isAdmin: user.isAdmin, userName: user.userName }" @dirty="markInlineDirty" @term-changed="onTermChanged" />
        <!-- 项目实施计划:阶段进度面板(与文书面板并列,结构化10阶段+完成按钮) -->

        <div class="approval-side" :class="{ collapsed: sideCollapsed }">
          <div class="as-side-title" @click="sideCollapsed = !sideCollapsed">
            <span v-if="!sideCollapsed">{{ tt(panelName) }}</span>
            <span class="as-side-toggle">{{ sideCollapsed ? '◀' : '▶' }}</span>
          </div>
          <template v-if="!sideCollapsed">
            <div class="as-side-status-row">
              <span v-if="cur['单据状态']" class="doc-status" :class="cur['单据状态']" :title="cur['单据状态']">{{ tt(cur['单据状态']) }}</span>
              <span v-else class="doc-status none">—</span>
            </div>
            <div class="as-side-pager">
              <span class="page-btn" :title="tt('最前一张')" @click="pageFirst">◁</span>
              <span class="page-btn" :title="tt('上一张')" @click="page(-1)">◀</span>
              <span class="page-no">{{ pageText(curNo, total, '') }}</span>
              <span class="page-btn" :title="tt('下一张')" @click="page(1)">▶</span>
              <span class="page-btn" :title="tt('最后一张')" @click="pageLast">▷</span>
            </div>
            <!-- ═══ 模糊搜索态:字段+内容条件行 → 查找 → 结果清单(点行即切换查看) ═══ -->
            <div v-if="fuzzyMode" class="fuzzy-panel">
              <div class="fuzzy-head">
                <span>{{ tt('模糊搜索') }}</span>
                <span class="fuzzy-back" :title="tt('返回')" @click="closeFuzzy">↩</span>
              </div>
              <div v-for="(row, fi) in fuzzyRows" :key="'fz' + fi" class="fuzzy-row">
                <el-select v-model="row.field" size="small" filterable :placeholder="tt('字段')" class="fuzzy-field">
                  <el-option-group v-for="g in fuzzyFieldGroups" :key="g.label" :label="g.label">
                    <el-option v-for="o in g.options" :key="o.value" :label="o.label" :value="o.value" />
                  </el-option-group>
                </el-select>
                <el-input
                  v-model="row.value"
                  size="small"
                  class="fuzzy-value"
                  :placeholder="tt('内容')"
                  @keyup.enter="runFuzzySearch"
                />
                <span class="fuzzy-del" :title="tt('删除该条件')" @click="removeFuzzyRow(fi)">×</span>
              </div>
              <div class="fuzzy-btns">
                <span class="as-side-btn" @click="addFuzzyRow">{{ tt('添加条件') }}</span>
                <span class="as-side-btn primary" @click="runFuzzySearch">{{ tt('查找') }}</span>
              </div>
              <div v-if="fuzzySearched" class="fuzzy-result">
                <div class="fuzzy-result-head">{{ tt('结果') }}：{{ total }} {{ tt('张') }}</div>
                <div
                  v-for="r in fuzzyResultRows"
                  :key="r.no"
                  class="fuzzy-result-row"
                  :class="{ on: r.no === curDocNo }"
                  @click="openFuzzyResult(r)"
                >
                  <span class="fz-no">{{ r.no }}</span>
                  <span class="fz-meta">{{ r.date }} {{ tt(r.status) }}</span>
                </div>
                <div v-if="!fuzzyResultRows.length" class="fuzzy-empty">{{ tt('未找到匹配单据') }}</div>
              </div>
            </div>
            <!-- ═══ 单据预览查找态:全量单据卡片(编号/状态/日期+关键摘要字段),点击即跳转,档案查看效果 ═══ -->
            <div v-else-if="previewMode" class="fuzzy-panel">
              <div class="fuzzy-head">
                <span>{{ tt('单据预览查找') }}</span>
                <span class="fuzzy-back" :title="tt('返回')" @click="closeDocPreview">↩</span>
              </div>
              <el-input
                v-model="previewKw"
                size="small"
                clearable
                :placeholder="tt('输入编号或任意内容快速筛选')"
                class="preview-kw"
              />
              <div class="preview-cards">
                <div
                  v-for="c in previewCards"
                  :key="c.no"
                  class="preview-card"
                  :class="{ on: c.no === curDocNo }"
                  @click="openPreviewCard(c)"
                >
                  <div class="pc-head">
                    <span class="pc-no">{{ c.no }}</span>
                    <span v-if="c.status" class="doc-status" :class="c.status">{{ tt(c.status) }}</span>
                  </div>
                  <div class="pc-date">{{ c.date }}</div>
                  <div v-for="(f, i) in c.fields" :key="i" class="pc-field">
                    <span class="pc-label">{{ tt(f.label) }}</span>
                    <span class="pc-value">{{ f.value }}</span>
                  </div>
                  <div v-if="!c.fields.length" class="pc-none">{{ tt('（无摘要字段）') }}</div>
                </div>
                <div v-if="!previewCards.length" class="fuzzy-empty">{{ tt('未找到匹配单据') }}</div>
              </div>
            </div>
            <div v-else class="as-side-btns">
              <div class="as-side-section">{{ tt('查找') }}</div>
              <!-- 查询单据:编号模糊(单据编号/文档编号) + 首次归档时间区间(所有文件面板) -->
              <div class="as-side-btn" @click="docQueryVisible = true">{{ tt('查询单据') }}</div>
              <!-- 模糊搜索:字段+内容(表头/明细/全部字段)多条件 AND,命中一张直接跳转,多张列清单 -->
              <div class="as-side-btn" @click="openFuzzy">{{ tt('模糊搜索') }}</div>
              <!-- 单据预览:全量单据卡片化预览(关键信息摘要),快速分辨并跳转——文件档案查看效果 -->
              <div class="as-side-btn" @click="openDocPreview">{{ tt('单据预览') }}</div>
              <div class="as-side-section">{{ tt('单据操作') }}</div>
              <!-- 删除组:整单删除;下拉含管理员删除审批(通过/驳回);删除申请中出「撤回删除申请」(卡死单据出口) -->
              <div class="as-side-del danger" v-if="isApprovalDoc">
                <div class="as-side-btn-row">
                  <div class="as-side-btn" style="flex: 1" @click="onSideAction('删除')">{{ tt('删除') }}</div>
                  <div class="as-side-caret" :title="tt('更多操作')" @click.stop="openDelMenu = !openDelMenu">▼</div>
                </div>
                <!-- 删除申请中:申请提交后无人审批会卡死(不可编辑也无审批入口)——发起人本人或审批人可撤回 -->
                <div v-if="curDocStatus === '删除申请中'" class="as-side-btn" @click="pickDelAction('撤回删除申请')">{{ tt('撤回删除申请') }}</div>
                <div v-if="openDelMenu" class="as-side-menu" @click.stop>
                  <div class="as-side-menu-item danger" @click="pickDelAction('删除')">{{ tt('删除') }}（{{ tt('整单删除') }}）</div>
                  <template v-if="canApproveHere()">
                    <div class="as-side-menu-item danger" @click="pickDelAction('删除审批通过')">{{ tt('删除审批通过') }}</div>
                    <div class="as-side-menu-item danger" @click="pickDelAction('删除审批驳回')">{{ tt('删除审批驳回') }}</div>
                  </template>
                </div>
              </div>
              <!-- 规格书两级分发:已分配单展示归属;非 责任人∪总负责人∪管理员 只读 -->
              <div v-if="panelCode === 'RD_SPEC_DOC' && specDocAssign?.hasAssign"
                   style="font-size:12px;color:#606266;line-height:1.7;padding:2px 0 6px;border-bottom:1px dashed #dcdfe6;margin-bottom:4px">
                <div>{{ tt('责任人') }}：{{ specDocAssign.ownerName || specDocAssign.owner }}<span v-if="specAssignBlocked">（{{ tt('只读') }}）</span></div>
                <div>{{ tt('总负责人') }}：{{ specDocAssign.supervisorName || specDocAssign.supervisor || tt('未落实') }}</div>
              </div>
              <!-- 审批组:品质单据等标准流文书面板(草稿需显式提交审批;审批通过/驳回需审批权限;审批情况公开) -->
              <template v-if="isStandardFlowSheet">
                <div class="as-side-btn" :class="{ disabled: isDisabled('提交审批') }" @click="onSideAction('提交审批')">{{ tt('提交审批') }}</div>
                <template v-if="canApproveHere()">
                  <div class="as-side-btn" :class="{ disabled: isDisabled('审批通过') }" @click="onSideAction('审批通过')">{{ tt('审批通过') }}</div>
                  <div class="as-side-btn" :class="{ disabled: isDisabled('审批驳回') }" @click="onSideAction('审批驳回')">{{ tt('审批驳回') }}</div>
                  <div class="as-side-btn" :class="{ disabled: isDisabled('弃审') }" @click="onSideAction('弃审')">{{ tt('弃审') }}</div>
                </template>
                <div class="as-side-btn" @click="onSideAction('审批情况')">{{ tt('审批情况') }}</div>
              </template>
              <!-- 修改组:归档后申请修改(管理员审批进入修改态);修改态出「提交审批」,审批中出管理员审批;修改申请中出「撤回修改申请」;修改记录弹窗(滚动3条) -->
              <div class="as-side-del" v-if="isDocArchivePanel">
                <div class="as-side-btn-row">
                  <div class="as-side-btn" style="flex: 1" :class="{ disabled: !canModifyReq }" @click="pickModAction('申请修改')">{{ tt('申请修改') }}</div>
                  <div class="as-side-caret" :title="tt('更多操作')" @click.stop="openModMenu = !openModMenu">▼</div>
                </div>
                <div v-if="curDocStatus === '修改中'" class="as-side-btn" @click="pickModAction('提交审批')">{{ tt('提交审批') }}</div>
                <!-- 修改申请中:同删除申请,卡死时由发起人本人或审批人撤回 -->
                <div v-if="curDocStatus === '修改申请中'" class="as-side-btn" @click="pickModAction('撤回修改申请')">{{ tt('撤回修改申请') }}</div>
                <div v-if="openModMenu" class="as-side-menu flip-up" @click.stop>
                  <template v-if="canApproveHere()">
                    <template v-if="curDocStatus === '修改申请中'">
                      <div class="as-side-menu-item" @click="pickModAction('修改审批通过')">{{ tt('修改审批通过') }}</div>
                      <div class="as-side-menu-item" @click="pickModAction('修改审批驳回')">{{ tt('修改审批驳回') }}</div>
                    </template>
                    <template v-else-if="curDocStatus === '审批中'">
                      <div class="as-side-menu-item" @click="pickModAction('审批通过')">{{ tt('审批通过') }}</div>
                      <div class="as-side-menu-item" @click="pickModAction('审批驳回')">{{ tt('审批驳回') }}</div>
                    </template>
                  </template>
                  <div class="as-side-menu-item" @click="pickModAction('审批情况')">{{ tt('审批情况') }}</div>
                </div>
              </div>
              <div class="as-side-btn" v-if="isDocArchivePanel" @click="openModifyLog">{{ tt('修改记录') }}</div>
              <div class="as-side-section">{{ tt('文档输出') }}</div>
              <!-- 打印:独立按钮(与导出分离;导出走格式选择 PDF/Excel) -->
              <div v-if="isApprovalDoc" class="as-side-btn" @click="printApprovalSheet">{{ tt('打印') }}</div>
              <!-- 对外正式报表:后端 JasperReports 模板(IT 维护版式:公司抬头+页眉页脚+页码)。
                   该面板在 reports/report-templates.properties 里登记了模板才出现 —— 没有模板时前端完全无感 -->
              <div v-if="reportTemplates.length || user.isAdmin" class="as-side-btn" @click="reportVisible = true">{{ tt('导出报表') }}</div>
              <!-- 产品开发下发:仅产品信息表;归档后可点;下发过则置灰显示「已下发」 -->
              <div
                class="as-side-btn"
                v-if="panelCode === 'RD_PROD_INFO'"
                :class="{ disabled: !canDevDispatch || devDispatch.dispatched }"
                :title="devDispatch.dispatched ? tt('该产品已下发到下游面板') : (canDevDispatch ? tt('把该产品下发到下游 5 个文件面板') : tt('仅已归档的产品信息表可下发'))"
                @click="onDevDispatch"
              >{{ devDispatch.dispatched ? tt('已下发') : tt('产品开发') }}</div>
              <!-- 规格书两级分发(第二级):已下发产品出现;仅总负责人/管理员可用,负责人未落实(挂起)时置灰 -->
              <div
                class="as-side-btn"
                v-if="panelCode === 'RD_PROD_INFO' && devDispatch.dispatched"
                :class="{ disabled: !canSpecDispatch }"
                :title="canSpecDispatch ? tt('把该产品的规格书单据分发给责任人填写')
                  : (devDispatch.supervisorResolved ? tt('仅总负责人或管理员可分发规格书') : tt('产品信息表「责任人」未匹配到启用账号，任务挂起'))"
                @click="openSpecAssign"
              >{{ tt('规格书分发') }}</div>
              <template v-for="(g, gi) in approvalSideGroups" :key="'sg' + gi">
                <div
                  class="as-side-btn"
                  :class="{ disabled: isDisabled(btnName(g)) }"
                  @click="onSideAction(btnName(g))"
                >{{ tt(btnName(g)) }}</div>
                <div
                  v-for="a in dropItems(g)"
                  :key="a"
                  class="as-side-btn sub"
                  :class="{ disabled: isDisabled(a) }"
                  @click="onSideAction(a)"
                >{{ tt(a) }}</div>
              </template>
            </div>
          </template>
        </div>
      </div>
    </template>
    <div v-if="reportMode" class="report-body" v-loading="loading">
      <div class="report-heading">
        <strong>{{ panelName }}</strong>
        <span>{{ reportPeriod }}</span>
      </div>
      <el-table
        class="report-table"
        :data="reportList"
        border
        stripe
        size="small"
        height="100%"
        show-summary
        :summary-method="sumMethod"
        empty-text="暂无符合条件的数据"
        @row-click="(row) => (current = row)"
      >
        <el-table-column type="index" :label="tt('序号')" width="58" fixed="left" :index="(i) => (query.pageNo - 1) * query.pageSize + i + 1" />
        <template v-for="column in reportColumnTree" :key="column.label">
          <el-table-column v-if="column.children" :label="tt(column.label)" align="center">
            <el-table-column
              v-for="child in column.children"
              :key="child.prop"
              :prop="child.prop"
              :min-width="child.width"
              :align="child.align"
              show-overflow-tooltip
            >
              <template #header>
                <div class="report-col-container">
                  <span class="report-col-title">{{ tt(child.label) }}</span>
                  <span class="report-col-operator" :class="{ 'has-sort': reportSortOn(child.prop) }">
                    <span class="report-col-sorter"
                          :class="{on: reportSortOn(child.prop)}"
                          :title="tt('点击排序：升序 → 降序 → 取消')"
                          @click.stop="cycleReportSort(child.prop)">{{ reportSortCaret(child.prop) }}</span>
                    <span v-if="hasDistinctValues(child.prop)"
                          class="report-col-filter"
                          :class="{on: reportCols.isFiltered(child.prop)}"
                          @click.stop="openFilterAt(child.prop, $event)">
                      <el-icon><Filter /></el-icon>
                    </span>
                  </span>
                </div>
              </template>
            </el-table-column>
          </el-table-column>
          <el-table-column
            v-else
            :prop="column.prop"
            :min-width="column.width"
            :align="column.align"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <template v-if="isStockStatus && column.prop === '预警数量'">
                <el-input-number
                  v-if="warnEdit.id === row.id"
                  ref="warnEditRef"
                  v-model="warnEdit.value"
                  :controls="false"
                  :min="0"
                  :precision="0"
                  size="small"
                  class="warn-input"
                  @keyup.enter="saveWarnEdit"
                  @keyup.esc="warnEdit.id = null"
                  @blur="saveWarnEdit"
                />
                <span v-else class="warn-editable" :title="tt('点击修改预警数量，留空使用默认阈值50')" @click="startWarnEdit(row)">{{ row['预警数量'] == null || row['预警数量'] === '' ? '—' : row['预警数量'] }}</span>
              </template>
              <span v-else>{{ row[column.prop] }}</span>
            </template>
            <template #header>
              <div class="report-col-container">
                <span class="report-col-title">{{ tt(column.label) }}</span>
                <span class="report-col-operator" :class="{ 'has-sort': reportSortOn(column.prop) }">
                  <span class="report-col-sorter"
                        :class="{on: reportSortOn(column.prop)}"
                        :title="tt('点击排序：升序 → 降序 → 取消')"
                        @click.stop="cycleReportSort(column.prop)">{{ reportSortCaret(column.prop) }}</span>
                  <span v-if="hasDistinctValues(column.prop)"
                        class="report-col-filter"
                        :class="{on: reportCols.isFiltered(column.prop)}"
                        @click.stop="openFilterAt(column.prop, $event)">
                    <el-icon><Filter /></el-icon>
                  </span>
                </span>
              </div>
            </template>
          </el-table-column>
        </template>
      </el-table>
    </div>


    <!-- !isApprovalDoc:文书式面板(RD 全系)只走上方纸张分支,单据卡片(含表头字段条)整体不渲染——
         9357460 拆分报表链时此排除丢失,曾致 RD 每个面板纸张下方多出一条全空表头 -->
    <template v-else-if="!isApprovalDoc">
      <!-- 单据卡片:左「单据选择」栏(送料暂收单等启用,对齐 PANDA 左停靠选择列表) + 右侧表头/明细 -->
      <div class="doc-rail-layout" :class="{ 'rail-on': !!docRailCfg && !railCollapsed }">
        <DocSelectRail
          v-if="docRailCfg"
          :title="docRailCfg.title"
          :columns="docRailCfg.columns"
          :rows="list"
          :current-no="railCurNo"
          :collapsed="railCollapsed"
          @select="onRailSelect"
          @toggle="railCollapsed = !railCollapsed"
        />
        <div class="doc-rail-main">
          <div class="fields header-fields udl-fields" :class="{ 'is-draft': draftEditable }">
      <div class="field" v-for="field in headerEditFields" :key="headerFieldKey(field)">
        <label :class="{ req: field.isRequired }">{{ headerFieldLabel(field) }}</label>
        <template v-if="draftEditable">
          <div v-if="isRefSelect(field)" class="query-ref-select">
            <el-select
              v-model="cur[headerFieldKey(field)]"
              clearable filterable remote allow-create default-first-option
              :disabled="headerFieldLocked(field)"
              @change="(v) => onHeaderRefSelectChange(field, v)"
              :remote-method="(kw) => loadRefSelectOptions(field, headerFieldKey(field), kw)"
              :loading="refSelectData[headerFieldKey(field)]?.loading"
              :placeholder="tt('输入搜索')"
              style="width: 100%"
              @focus="checkRefMode(field, headerFieldKey(field))"
            >
              <!-- 编码型参照(refField≠displayField):候选列表与选中态都显示存值(编码),按名称挑选走 display 同名字段 -->
              <el-option
                v-for="o in (refSelectData[headerFieldKey(field)]?.options || [])"
                :key="o.value"
                :label="refShowsCode(field) ? o.value : o.label"
                :value="o.value"
              />
            </el-select>
          </div>
          <div v-else-if="isReferenceField(field)" class="query-ref">
            <el-input
              :model-value="headerRefText(field)"
              readonly
              :disabled="headerFieldLocked(field)"
              placeholder="请选择"
              @click="openHeaderRef(field)"
            />
            <el-button
              :icon="Search"
              title="打开参照"
              :disabled="headerFieldLocked(field)"
              @click="openHeaderRef(field)"
            />
          </div>
          <div v-else-if="isSelectField(field) && dictModeOf(field, headerFieldKey(field)) === 'dialog'" class="query-ref">
            <el-input
              :model-value="cur[headerFieldKey(field)]"
              readonly
              :disabled="headerFieldLocked(field)"
              :placeholder="tt('请选择')"
              @click="openDictPick(field)"
            />
            <el-button
              :icon="Search"
              :title="tt('选择')"
              :disabled="headerFieldLocked(field)"
              @click="openDictPick(field)"
            />
          </div>
          <el-select
            v-else-if="isSelectField(field)"
            v-model="cur[headerFieldKey(field)]"
            :disabled="headerFieldLocked(field)"
            clearable
            filterable
            allow-create
            @change="markInlineDirty"
          >
            <el-option v-for="option in fieldOptions(field)" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <el-date-picker
            v-else-if="isDateField(field)"
            v-model="cur[headerFieldKey(field)]"
            :disabled="headerFieldLocked(field)"
            type="date"
            value-format="YYYY-MM-DD"
            @change="markInlineDirty"
          />
          <el-input-number
            v-else-if="isNumberField(field)"
            v-model="cur[headerFieldKey(field)]"
            :disabled="headerFieldLocked(field)"
            :controls="false"
            @change="markInlineDirty"
          />
          <el-switch
            v-else-if="isBooleanField(field)"
            v-model="cur[headerFieldKey(field)]"
            :disabled="headerFieldLocked(field)"
            @change="markInlineDirty"
          />
          <el-input
            v-else
            v-model="cur[headerFieldKey(field)]"
            :disabled="headerFieldLocked(field)"
            @change="markInlineDirty"
          />
        </template>
        <div v-else class="field-readonly" :title="String(cur[headerFieldKey(field)] ?? '')">
          {{ formatFieldValue(field, cur[headerFieldKey(field)]) }}
        </div>
      </div>
    </div>

    <!-- 附件区:头表保留附件1..附件6 列位,页面单格聚合呈现,上传按序占第一个空余列位
         (单号键兜底:label=单号 的面板如来料三单/送料暂收单,数据键只有 编号/单号) -->
    <div v-if="attachFields.length && curDocNo" class="attach-strip">
      <span class="attach-strip-label">{{ tt('附件') }}</span>
      <div class="attach-slot">
        <FileAttachCell
          :panel-code="panelCode"
          :doc-no="curDocNo"
          :slots="attachKeys"
          :values="attachValues"
          :can-edit="draftEditable"
          @change="applyAttachSlots"
        />
      </div>
    </div>

    <!-- ═══ 打印专用版式(屏幕隐藏,打印时经 body.doc-printing 激活):宽明细单据 A4 纸面优化层——
         表头紧凑四列网格 + table-layout:fixed 百分比列宽 + 宽表列合并(名称/型号、合格/不良)
         + thead 跨页自动重复;@page 横向/纵向由 prepareDocPrint 动态注入 ═══ -->
    <div v-if="docPrintEnabled" class="doc-print" aria-hidden="true">
      <div class="dp-title">{{ tt(panelName) }}</div>
      <div class="dp-head">
        <div v-for="f in docPrintHead" :key="headerFieldKey(f)" class="dp-pair">
          <span class="dp-label">{{ tt(headerFieldLabel(f)) }}：</span>
          <span class="dp-value">{{ formatFieldValue(f, cur[headerFieldKey(f)]) }}</span>
        </div>
      </div>
      <table class="dp-table">
        <colgroup>
          <col v-for="(c, i) in docPrintCols" :key="i" :style="{ width: c.pct + '%' }" />
        </colgroup>
        <thead>
          <tr><th v-for="(c, i) in docPrintCols" :key="i">{{ c.title }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, ri) in docPrintRows" :key="ri">
            <td v-for="(c, ci) in docPrintCols" :key="ci">{{ c.text(r, ri) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!isApprovalDoc" class="body" :class="{ 'draft-body': draftEditable }" v-loading="loading && !isBomMasterPanel">
      <!-- ══════════ 物料清单专用：父件表格 + 子件表格联动（BOM/BOM_FWD/BOM_REV） ══════════ -->
      <BomMasterDetail
        v-if="isBomMasterPanel"
        ref="bomMasterRef"
        :rows="bomMasterRows"
        :fields="bomMasterFields"
        :document-no="cur['编号'] || ''"
        :reverse="panelCode === 'BOM_REV'"
        :editable="panelCode === 'BOM' && draftEditable"
        :loading="loading"
        @update:rows="onBomRowsUpdate"
      />
      <template v-else>
      <!-- ══════════ ③b 主表预览表格（配置 mainTable 时显示：主表字段列，点行切换当前单据，明细联动） -->
      <div v-if="mainGrid" class="main-grid">
        <div class="dt-head">
          <span class="dt-tab on">{{ mainGrid.label }}</span>
          <span class="dt-ics">
            <span class="dt-ic" :title="tt('点行切换当前单据')">{{ tt('定位') }}</span>
          </span>
        </div>
        <el-table :data="mainRows" border size="small" :row-class-name="mainRowCls" @row-click="onMainRowClick" @row-dblclick="openMaintain">
          <el-table-column type="index" :label="tt('序号')" width="60" align="center" :index="(i) => i + 1" />
          <el-table-column v-for="c in mainCols" :key="c" :prop="c" :label="tt(c)" min-width="110" show-overflow-tooltip>
            <template #header>
              <div class="col-hdr" :class="{ filtering: hasColFilter(c) }" @click.stop="toggleColFilter(c)">
                <span>{{ tt(c) }}</span>
                <span
                  class="col-hdr-sort"
                  :class="{ on: isSortOn(mainSort, c) }"
                  :title="tt('点击排序：升序 → 降序 → 取消')"
                  @click.stop="cycleSort(mainSort, c)"
                >{{ sortCaret(mainSort, c) }}</span>
                <span v-if="hasColFilter(c)" class="col-hdr-tag" @click.stop="clearColFilter(c)" :title="tt('清除')">{{ colFilterText[c] }} ×</span>
                <el-icon v-else class="col-hdr-ic"><Search /></el-icon>
              </div>
              <el-input v-if="filterColProp === c" v-model="colFilterText[c]" size="small" :placeholder="tt('筛选...')" clearable class="col-filter-inp" @click.stop @clear="clearColFilter(c)" @keyup.escape="clearColFilter(c)" />
            </template>
          </el-table-column>
        </el-table>
      </div>
      <!-- ══════════ ③ 表中 · 明细区块（配置驱动：区块内多页签，同 T+）══════════ -->
      <div class="detail" v-for="b in blocks" :key="b.id">
        <div v-if="isApproved" class="approved-stamp">{{ tt('已审批') }}</div>
        <div class="dt-head">
          <span v-for="it in headItems(b)" :key="it.kind + it.key" class="dt-tab" :class="{ on: isOn(b, it) }" @click="switchTab(b, it)">{{ tt(it.label) }}</span>
          <span v-if="b.id === 'B' && activeTab(b).key === 'materials' && selectedProduct" class="filter-hint">{{ tt('当前产品：') }}{{ selectedProduct }} {{ tt('的 BOM 子件') }}</span>
          <span class="dt-ics">
            <el-button v-if="detailEditable(b)" size="small" type="primary" :icon="Plus" @click="addInlineDetailRow(b)">{{ tt('新增数据') }}</el-button>
            <span class="dt-ic" v-for="ic in b.isMain ? iconA : iconB" :key="ic" @click="onIcon(ic, b)">{{ tt(ic) }}</span>
          </span>
        </div>
        <!-- 档案大表分页器:数据全量在内存(保存语义不变),DOM 只渲染当前页;
             形态=总数+每页条数(默认100)+左右箭头+输入跳页,不带数字页码按钮 -->
        <div v-if="singleDocMode && archTotal(b) > ARCH_SIZE_OPTS[0]" class="arch-pager">
          <el-pagination
            small background
            v-model:page-size="archPageSize"
            layout="total, sizes, prev, next, jumper"
            :page-sizes="ARCH_SIZE_OPTS"
            :total="archTotal(b)"
            :current-page="archCurPage(b)"
            @size-change="onArchSizeChange"
            @current-change="(p) => (archPage = p)"
          />
        </div>
        <el-table
          :data="pagedBlockRows(b)"
          :height="tableH(b)"
          border
          size="small"
          :show-summary="tabView(b, activeTab(b)) !== 'summary'"
          :summary-method="(p) => sumMethodFor(b, p)"
          :sum-text="tt('合计')"
          :row-class-name="(o) => rowCls(o, b)"
          @selection-change="(r) => (delSel = r)"
          @row-contextmenu="(row, col, ev) => onCtx(ev, row, b)"
          @cell-dblclick="(row, col, cell, ev) => onDetailCellDblclick(row, col, ev, b)"
          @row-click="(row) => onRowClick(row, b)"
          @click.capture="(e) => onTableClick(b, e)"
          @scroll.capture="(e) => onArchScroll(e, b)"
        >
          <el-table-column v-if="delMode && b.isMain" type="selection" width="45" fixed="left" />
          <!-- 物料二维码标签(勾选即打):自管勾选集(跨页保留),与删除模式的 selection 列互不相干;
               表头复选框=本页全选。行键=qrLabelKey 列(存货编码),空编码行禁勾 -->
          <el-table-column v-if="qrKey && b.isMain" width="40" fixed="left" align="center">
            <template #header>
              <el-checkbox
                :model-value="qrPageAllChecked(b)"
                :indeterminate="qrPageSomeChecked(b)"
                :title="tt('本页全选')"
                @change="(v) => qrTogglePage(b, v)"
              />
            </template>
            <template #default="{ row }">
              <el-checkbox
                :model-value="qrSel.has(qrRowKey(row))"
                :disabled="!qrRowKey(row)"
                @change="() => qrToggleRow(row)"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-for="c in archCols(b)"
            :key="c.prop"
            :prop="c.prop"
            :label="c.label"
            :width="archColW(b, c)"
            :min-width="archColW(b, c) ? undefined : c.width"
            :align="c.align"
            :show-overflow-tooltip="!detailEditable(b)"
          >
            <template #header>
              <div class="col-hdr" :class="{ filtering: hasColFilter(c.prop) }" @click.stop="toggleColFilter(c.prop)">
                <span class="col-hdr-text" :class="{ req: c.field?.isRequired }">{{ c.label }}</span>
                <span
                  class="col-hdr-sort"
                  :class="{ on: isSortOn(blockSortOf(b), c.prop) }"
                  :title="tt('点击排序：升序 → 降序 → 取消')"
                  @click.stop="cycleSort(blockSortOf(b), c.prop)"
                >{{ sortCaret(blockSortOf(b), c.prop) }}</span>
                <span v-if="hasColFilter(c.prop)" class="col-hdr-tag" @click.stop="clearColFilter(c.prop)" :title="tt('清除筛选')">{{ colFilterText[c.prop] }} ×</span>
                <el-icon v-else class="col-hdr-ic"><Search /></el-icon>
              </div>
              <el-input
                v-if="filterColProp === c.prop"
                v-model="colFilterText[c.prop]"
                size="small"
                :placeholder="tt('筛选...')"
                clearable
                class="col-filter-inp"
                @click.stop
                @clear="clearColFilter(c.prop)"
                @keyup.escape="clearColFilter(c.prop)"
              />
            </template>
            <template #default="{ row }">
              <!-- 列懒渲染:视口外列只出空占位(表头保留撑宽),滚动进入视口再产出内容 -->
              <span v-if="!archColVisible(b, c)" class="col-lazy-empty"></span>
              <template v-else>
              <template v-if="archEditable(b) && !row._placeholder">
                <span v-if="c.field.computed" class="inline-computed-value">{{ formatFieldValue(c.field, row[c.prop]) }}</span>
                <!-- 档案页参照列同样懒挂载(2026-09-16):大数据档案每行常驻参照编辑器是 DOM 膨胀主源之一;
                     单据页行数少,保持常驻(点即选)不变 -->
                <div v-else-if="isReferenceField(c.field) && (!singleDocMode.value || isActiveCell(row, b, c.prop))" class="inline-ref-editor" :class="{ active: isActiveDetailRefRow(row, b, c.prop) }">
                  <el-input
                    :model-value="formatFieldValue(c.field, row[c.prop])"
                    readonly
                    :title="detailRefTrigger(c.field) === 'dblclick' ? tt('双击选择存货') : tt('点击选择')"
                    @click="openClickDetailRef(c.field, row, b)"
                  />
                  <el-icon v-if="detailRefTrigger(c.field) === 'dblclick' && isActiveDetailRefRow(row, b, c.prop)" class="list-ref-icon"><Search /></el-icon>
                </div>
                <span v-else-if="isReferenceField(c.field)" class="cell-lazy" :title="tt('点击编辑')" @click="activateCell(row, b, c.prop)">{{ formatFieldValue(c.field, row[c.prop]) }}</span>
                <!-- 编辑器懒渲染:仅激活单元格挂载编辑控件,其余单元格显示纯文本,
                     避免大数据量面板(如数据字典 210 行)每格常驻编辑器导致 DOM 膨胀 -->
                <template v-else-if="isActiveCell(row, b, c.prop)">
                  <el-select
                    v-if="isSelectField(c.field)"
                    v-model="row[c.prop]"
                    :disabled="c.field.computed"
                    filterable
                    clearable
                    allow-create
                    @change="onInlineDetailChange(activeTab(b).key, row, c.field)"
                  >
                    <el-option v-for="option in fieldOptions(c.field)" :key="option.value" :label="option.label" :value="option.value" />
                  </el-select>
                  <el-date-picker
                    v-else-if="isDateField(c.field)"
                    v-model="row[c.prop]"
                    :disabled="c.field.computed"
                    type="date"
                    value-format="YYYY-MM-DD"
                    @change="onInlineDetailChange(activeTab(b).key, row, c.field)"
                  />
                  <el-input-number
                    v-else-if="isNumberField(c.field)"
                    v-model="row[c.prop]"
                    :disabled="c.field.computed"
                    :controls="false"
                    @change="onInlineDetailChange(activeTab(b).key, row, c.field)"
                  />
                  <el-switch
                    v-else-if="isBooleanField(c.field)"
                    v-model="row[c.prop]"
                    :disabled="c.field.computed"
                    @change="onInlineDetailChange(activeTab(b).key, row, c.field)"
                  />
                  <el-input
                    v-else
                    v-model="row[c.prop]"
                    :disabled="c.field.computed"
                    @change="onInlineDetailChange(activeTab(b).key, row, c.field)"
                  />
                </template>
                <span v-else class="cell-lazy" @click="activateCell(row, b, c.prop)">{{ formatFieldValue(c.field, row[c.prop]) }}</span>
              </template>
              <span v-else-if="c.prop === '材料编码' && activeTab(b).key === 'materials'" class="mat-cell">
                <span>{{ tt(row[c.prop] ?? '') }}</span>
                <span v-if="hasSubBom(row[c.prop])" class="mat-star" :title="tt('该材料有下级子件 BOM，点击行查看')">*</span>
              </span>
              <span v-else>{{ tt(row[c.prop] ?? '') }}</span>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </div>
      </template>

    </div>

    <!-- ══════════ ④ 表尾（固定在页面底部，滚动明细时始终可见；备注 + 审核行）══════════ -->
    <div v-if="showFooter" class="footer">
      <div class="remark">
        <label>{{ tt('备注') }}</label>
        <el-input v-model="remarkText" size="small" placeholder="" :disabled="!draftEditable" />
      </div>
      <div class="footer-hr"></div>
      <div class="audit-line">
        <span>{{ tt('制单人：') }}{{ cur['制单人'] || cur['发起人编号'] || '' }}</span>
        <span>{{ tt('审核人：') }}{{ cur['审核人'] || '' }}</span>
        <span>{{ tt('审核日期：') }}{{ cur['审核日期'] || '' }}</span>
        <span>{{ tt('审核时间：') }}{{ cur['审核时间'] || '' }}</span>
        <span>{{ tt('打印次数：') }}{{ cur['打印次数'] ?? 0 }}</span>
        <span>{{ tt('创建时间：') }}{{ cur['创建时间'] || '' }}</span>
        <span>{{ tt('审核意见：') }}{{ cur['审核意见'] || '-' }}</span>
      </div>
    </div>
        </div>
      </div>
    </template>


    <!-- ══════════ 表格右键菜单（对齐真实 T+ 明细右键）══════════ -->
    <div v-if="ctx.visible" class="ctx-menu" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }">
      <div class="ctx-item" v-for="it in ctxItems" :key="it" @click="onCtxItem(it)">{{ tt(it) }}</div>
    </div>

    <!-- 未保存离开守卫(规范 §6.2):同步拦截路由,模板弹窗三态 -->
    <el-dialog v-model="leaveVisible" :title="tt('未保存提示')" width="420px" append-to-body :close-on-click-modal="false" @close="onLeaveDialogClose">
      <span>{{ leaveQuestion }}</span>
      <template #footer>
        <el-button @click="onLeaveChoice('stay')">{{ tt('取消') }}</el-button>
        <el-button @click="onLeaveChoice('discard')">{{ tt('不保存') }}</el-button>
        <el-button type="primary" @click="onLeaveChoice('save')">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <RefPickDialog v-model="queryRefVisible" :field="queryRefField" mode="query" @confirm="onQueryRefConfirm" />
    <RefPickDialog v-model="headerRefVisible" :field="headerRefField" mode="header" @confirm="onHeaderRefConfirm" />
    <RefPickDialog v-model="detailRefVisible" :field="detailRefPick?.field" mode="detail" @confirm="onDetailRefConfirm" />

    <!-- 下拉框字段弹窗模式(>20 条):字典项搜索选择 -->
    <el-dialog v-model="dictPickVisible" :title="tt('选择') + '：' + (dictPickField ? headerFieldLabel(dictPickField) : '')" width="440px" append-to-body :close-on-click-modal="false">
      <el-input v-model="dictPickKeyword" :placeholder="tt('输入搜索')" clearable class="dict-pick-search" />
      <div class="dict-pick-list">
        <div v-for="(o, i) in dictPickOptions" :key="i" class="dict-pick-item" @click="onDictPick(o)">
          {{ o.label }}
        </div>
        <el-empty v-if="!dictPickOptions.length" :description="tt('暂无数据')" :image-size="50" />
      </div>
      <template #footer>
        <el-button @click="clearDictPick">{{ tt('清空') }}</el-button>
        <el-button type="primary" @click="dictPickVisible = false">{{ tt('取消') }}</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="queryDialogVisible" :title="tt('查询')" width="760px" append-to-body destroy-on-close class="header-query-dialog" @open="loadPlans" @close="onQueryDialogClose">
      <!-- 查询方案:下拉调用 + 保存 + 维护 -->
      <div class="query-plan-bar">
        <span class="plan-label">{{ tt('查询方案') }}</span>
        <el-select
          v-model="selectedPlan"
          :placeholder="tt('选择方案')"
          clearable
          filterable
          size="small"
          class="plan-select"
          @change="(v) => v && applyPlan(v)"
        >
          <el-option v-for="p in queryPlans" :key="p.name" :value="p.name" :label="p.name">
            <span class="plan-option-name">{{ p.name }}</span>
            <span class="plan-option-meta">{{ planSummary(p) }}</span>
          </el-option>
        </el-select>
        <el-button size="small" type="primary" plain @click="saveCurrentPlan">{{ tt('保存方案') }}</el-button>
        <el-button size="small" @click="planManageVisible = true">{{ tt('方案维护') }}</el-button>
      </div>
      <div class="query-dialog-fields">
        <!-- 查询弹窗面板(T+):单个「单据日期」区间控件(日期段必填的统一入口) -->
        <div v-if="reportQueryDialog" class="query-dialog-field">
          <label class="req-label">{{ tt('单据日期') }}<span class="req-star">*</span></label>
          <el-date-picker
            v-model="rqdRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            :range-separator="tt('至')"
            :start-placeholder="tt('开始日期')"
            :end-placeholder="tt('结束日期')"
            style="width: 100%"
          />
        </div>
        <!-- 级联面板:仓库/存货联动下拉(选项=对应视图真实组合,互相约束);台账必填,状况表选填 -->
        <template v-if="isCascadePanel">
          <div class="query-dialog-field">
            <label :class="{ 'req-label': rqdFieldRequired({ dataName: '仓库' }) }">{{ tt('仓库') }}<span v-if="rqdFieldRequired({ dataName: '仓库' })" class="req-star">*</span></label>
            <el-select v-model="queryDraft['仓库']" filterable clearable :loading="ledgerOptsLoading" style="width:100%" @change="onLedgerWhChange">
              <el-option v-for="w in ledgerWhOptions" :key="w" :label="w" :value="w" />
            </el-select>
          </div>
          <div class="query-dialog-field">
            <label :class="{ 'req-label': rqdFieldRequired({ dataName: '存货' }) }">{{ tt('存货') }}<span v-if="rqdFieldRequired({ dataName: '存货' })" class="req-star">*</span></label>
            <el-select v-model="queryDraft['存货']" filterable clearable :loading="ledgerOptsLoading" style="width:100%" @change="onLedgerItemChange">
              <el-option v-for="i in ledgerItemOptions" :key="i" :label="i" :value="i" />
            </el-select>
          </div>
        </template>
        <div v-for="field in queryDialogFields" :key="headerFieldKey(field)" class="query-dialog-field">
          <label :class="{ 'req-label': rqdFieldRequired(field) }">
            {{ headerFieldLabel(field) }}<span v-if="rqdFieldRequired(field)" class="req-star">*</span>
          </label>
          <div v-if="isReferenceField(field)" class="query-ref">
            <el-input
              :model-value="queryDraft[headerFieldKey(field)] ?? ''"
              readonly
              clearable
              placeholder="请选择"
              @click="openQueryRef(field, 'dialog')"
              @clear="clearQueryRef(field, 'dialog')"
            />
            <el-button :icon="Search" title="打开参照" @click="openQueryRef(field, 'dialog')" />
          </div>
          <el-select v-else-if="isSelectField(field)" v-model="queryDraft[headerFieldKey(field)]" clearable filterable allow-create>
            <el-option v-for="option in fieldOptions(field)" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <el-date-picker v-else-if="isDateField(field)" v-model="queryDraft[headerFieldKey(field)]" type="date" value-format="YYYY-MM-DD" />
          <el-input-number v-else-if="isNumberField(field)" v-model="queryDraft[headerFieldKey(field)]" :controls="false" />
          <el-select v-else-if="isBooleanField(field)" v-model="queryDraft[headerFieldKey(field)]" clearable>
            <el-option label="是" :value="true" />
            <el-option label="否" :value="false" />
          </el-select>
          <el-input v-else v-model="queryDraft[headerFieldKey(field)]" clearable @keyup.enter="applyHeaderQuery" />
        </div>
      </div>
      <!-- 高级筛选:字段(单据全部字段)+ 运算符 + 值,点击查询执行前端过滤 -->
      <div class="adv-filter-section">
        <div class="adv-filter-head">
          <span class="adv-filter-title">{{ tt('高级筛选') }}</span>
          <el-button size="small" text type="primary" :icon="Plus" @click="addAdvFilter">{{ tt('添加条件') }}</el-button>
        </div>
        <div v-for="(f, i) in advFilters" :key="i" class="adv-filter-row">
          <el-select v-model="f.field" filterable :placeholder="tt('字段')" class="adv-field" size="small">
            <el-option v-for="fd in advFilterFields" :key="fd" :label="tt(fd)" :value="fd" />
          </el-select>
          <el-select v-model="f.op" class="adv-op" size="small">
            <el-option v-for="op in ADV_OPS" :key="op.value" :label="tt(op.label)" :value="op.value" />
          </el-select>
          <el-input
            v-if="f.op !== 'empty' && f.op !== 'notEmpty'"
            v-model="f.value"
            :placeholder="tt('值')"
            class="adv-value"
            size="small"
            clearable
            @keyup.enter="applyHeaderQuery"
          />
          <span v-else class="adv-value adv-no-value"></span>
          <el-button link type="danger" size="small" @click="removeAdvFilter(i)">✕</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="resetHeaderQuery">{{ tt('重置') }}</el-button>
        <el-button @click="queryDialogVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :icon="Search" @click="applyHeaderQuery">{{ tt('查询') }}</el-button>
      </template>
    </el-dialog>

    <!-- 查询方案维护:列表管理(调用/更新/重命名/删除) -->
    <el-dialog v-model="planManageVisible" :title="tt('方案维护')" width="560px" append-to-body>
      <div v-if="!queryPlans.length" class="plan-empty">{{ tt('暂无保存的查询方案') }}</div>
      <div v-for="p in queryPlans" :key="p.name" class="plan-row">
        <div class="plan-info">
          <div class="plan-name">{{ p.name }}</div>
          <div class="plan-meta">{{ planSummary(p) }} · {{ p.updatedAt }}</div>
        </div>
        <div class="plan-ops">
          <el-button link type="primary" size="small" @click="applyPlan(p.name); planManageVisible = false">{{ tt('调用') }}</el-button>
          <el-button link type="primary" size="small" @click="updatePlan(p.name)">{{ tt('更新') }}</el-button>
          <el-button link size="small" @click="renamePlan(p.name)">{{ tt('重命名') }}</el-button>
          <el-button link type="danger" size="small" @click="deletePlan(p.name)">{{ tt('删除') }}</el-button>
        </div>
      </div>
    </el-dialog>
    <NewVoucherDialog v-model:visible="newVisible" :panelCode="panelCode" :panel-name="panelName" @saved="onNewSaved" />
    <SubBomDialog v-model="subBomVisible" :material="subBomMaterial" :bom="subBomBom" />
    <ImportDialog v-model="impVisible" :fields="impFields" :target-label="impLabel" @imported="onImported" />
    <ApprovalHistoryDialog v-model="approvalVisible" :panelCode="panelCode" :formNo="approvalNo" />
    <!-- 修改记录弹窗:滚动3条(字段变化/补充/清空 + 明细变化摘要) -->
    <!-- ═══ 项目进度查询:该项目的数据记录表单据(点项目编号弹出;多张先选取再查看,单张直接查看) ═══ -->
    <el-dialog v-model="dataSheetsVisible" :title="tt('数据记录表单据') + ' · ' + dataSheetsCode" width="1240px" top="4vh" append-to-body>
      <div v-loading="dataSheetsLoading">
        <div v-if="!dataSheetsLoading && !dataSheetsRows.length" class="mod-log-empty">
          {{ tt('该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）') }}
        </div>
        <!-- ① 选取列表(多张时先选后看) -->
        <el-table
          v-else-if="!dsActive"
          :data="dataSheetsRows" size="small" border max-height="480"
          row-class-name="ds-sel-row" @row-click="selectDataSheet"
        >
          <el-table-column prop="panelName" :label="tt('数据记录表')" min-width="150" />
          <el-table-column prop="docNo" :label="tt('单据编号')" min-width="130" />
          <el-table-column prop="docDate" :label="tt('单据日期')" width="110" align="center" />
          <el-table-column :label="tt('单据状态')" width="120" align="center">
            <template #default="{ row }">
              <span class="doc-status" :class="row.status">{{ tt(row.status) }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="tt('操作')" width="90" align="center">
            <template #default>
              <span class="ds-jump">{{ tt('查看') }} →</span>
            </template>
          </el-table-column>
        </el-table>
        <!-- ② 查看视图(选取后渲染;返回列表可再选,多张时胶囊可快捷切换) -->
        <template v-else>
          <div class="ds-viewbar">
            <span class="ds-back" @click="dsActive = null">← {{ tt('返回列表') }}</span>
            <span v-if="dataSheetsRows.length > 1" class="ds-switch">
              <span
                v-for="r in dataSheetsRows"
                :key="r.panelCode + r.docNo"
                class="ds-pill"
                :class="{ on: dsActive.panelCode === r.panelCode && dsActive.docNo === r.docNo }"
                @click="selectDataSheet(r)"
              >{{ tt(r.panelName) }} {{ r.docNo }}</span>
            </span>
          </div>
          <div class="ds-doc-wrap" v-loading="dsActive.loading">
            <DataRecordSheet
              v-if="dsActive.doc && dsActive.panelCode === 'RD_FILTER_EFF'"
              :head="dsActive.doc" :fields="dsActive.headerFields" :editable="false"
            />
            <RecordSheetPanels
              v-else-if="dsActive.doc"
              :head="dsActive.doc" :fields="dsActive.allFields" :editable="false" :panel-code="dsActive.panelCode"
            />
            <div v-else class="mod-log-empty">{{ tt('加载中…') }}</div>
          </div>
        </template>
      </div>
      <template #footer>
        <el-button @click="dataSheetsVisible = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 文书面板导出:格式选择(打印按钮独立,导出走这里:PDF/Excel) ═══ -->
    <el-dialog v-model="exportFmtVisible" :title="tt('选择导出格式')" width="380px" append-to-body>
      <div class="efmt-list">
        <div class="efmt-item" @click="exportSheetPdf">
          <span class="efmt-ico">📄</span>
          <div class="efmt-txt">
            <div class="efmt-name">{{ tt('导出 PDF') }}</div>
            <div class="efmt-desc">{{ tt('按纸张实际尺寸单页生成，直接下载，无需打印机') }}</div>
          </div>
        </div>
        <div class="efmt-item" @click="exportSheetExcel">
          <span class="efmt-ico">📊</span>
          <div class="efmt-txt">
            <div class="efmt-name">{{ tt('导出 Excel（.xlsx）') }}</div>
            <div class="efmt-desc">{{ tt('头字段键值 + 各明细页签全字段全数据，不受纸张限制') }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="exportFmtVisible = false">{{ tt('取消') }}</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 对外正式报表(后端 JasperReports 模板):业务只选格式,版式由 IT 的 .jrxml 决定 ═══ -->
    <el-dialog v-model="reportVisible" :title="tt('导出报表')" width="460px" append-to-body>
      <div v-if="reportTemplates.length" class="rpt-tpl-row">
        <span class="rpt-tpl-label">{{ tt('报表模板') }}</span>
        <el-select v-model="selectedReportCode" size="default" style="flex:1" :placeholder="tt('选择报表模板')">
          <el-option v-for="t in reportTemplates" :key="t.code" :label="t.name" :value="t.code" />
        </el-select>
      </div>
      <div v-else class="rpt-tpl-empty">{{ tt('该面板暂无报表模板，可点下方「模板管理」上传') }}</div>
      <div class="efmt-list">
        <div class="efmt-item" @click="downloadReport('pdf')">
          <span class="efmt-ico">📄</span>
          <div class="efmt-txt">
            <div class="efmt-name">{{ tt('导出 PDF') }}</div>
            <div class="efmt-desc">{{ tt('服务端正式报表：含公司抬头、页眉页脚与页码') }}</div>
          </div>
        </div>
        <div class="efmt-item" @click="previewServerReport">
          <span class="efmt-ico">🖨</span>
          <div class="efmt-txt">
            <div class="efmt-name">{{ tt('打印预览') }}</div>
            <div class="efmt-desc">{{ tt('在浏览器新窗口内打开 PDF，可直接打印') }}</div>
          </div>
        </div>
        <div class="efmt-item" @click="downloadReport('xlsx')">
          <span class="efmt-ico">📊</span>
          <div class="efmt-txt">
            <div class="efmt-name">{{ tt('导出 Excel（.xlsx）') }}</div>
            <div class="efmt-desc">{{ tt('报表数据行 + 页眉信息，可在 Excel 里直接编辑') }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button v-if="user.isAdmin" type="primary" link @click="openManage">{{ tt('模板管理') }}</el-button>
        <el-button @click="reportVisible = false">{{ tt('取消') }}</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 报表模板管理(仅管理员;ADR-0002) ═══ -->
    <el-dialog v-model="manageVisible" :title="tt('报表模板管理')" width="780px" append-to-body>
      <div class="rpt-mg-toolbar">
        <el-button type="primary" size="small" @click="uploadFormVisible = true">{{ tt('上传模板') }}</el-button>
        <span class="rpt-mg-tip">{{ tt('模板为 .jrxml（Jaspersoft Studio 制作）；字段中文名须与面板字段标签一致；上传即生效') }}</span>
      </div>
      <el-table :data="manageList" size="small" border height="320">
        <el-table-column prop="code" :label="tt('编码')" width="140" />
        <el-table-column prop="name" :label="tt('名称')" width="140" />
        <el-table-column prop="panelCode" :label="tt('绑定面板')" width="150" />
        <el-table-column :label="tt('状态')" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? tt('启用') : tt('停用') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updateBy" :label="tt('更新')" width="130" />
        <el-table-column :label="tt('操作')" min-width="150">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="previewTpl(row)">{{ tt('预览') }}</el-button>
            <el-button size="small" link :type="row.enabled ? 'warning' : 'success'" @click="toggleTpl(row)">{{ row.enabled ? tt('停用') : tt('启用') }}</el-button>
            <el-button size="small" link type="danger" @click="removeTpl(row)">{{ tt('删除') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="manageVisible = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="uploadFormVisible" :title="tt('上传模板')" width="520px" append-to-body>
      <div class="rpt-up-row"><span class="rpt-up-label">{{ tt('模板文件') }}</span>
        <input ref="rptFileRef" type="file" accept=".jrxml,.xml" @change="onRptFile" /></div>
      <div class="rpt-up-row"><span class="rpt-up-label">{{ tt('模板编码') }}</span>
        <el-input v-model="uploadForm.templateCode" size="small" style="width:260px" placeholder="小写字母/数字/下划线,如 so_order" /></div>
      <div class="rpt-up-row"><span class="rpt-up-label">{{ tt('报表名称') }}</span>
        <el-input v-model="uploadForm.name" size="small" style="width:260px" /></div>
      <div class="rpt-up-row"><span class="rpt-up-label">{{ tt('绑定面板') }}</span>
        <el-input v-model="uploadForm.panelCode" size="small" style="width:260px" /></div>
      <div class="rpt-up-row"><span class="rpt-up-label">{{ tt('备注') }}</span>
        <el-input v-model="uploadForm.remark" size="small" style="width:260px" /></div>
      <template #footer>
        <el-button @click="uploadFormVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">{{ tt('上传并启用') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="modifyLogVisible" :title="tt('修改记录') + ' · ' + modifyLogNo" width="720px" append-to-body>
      <div v-if="!modifyLogRecords.length" class="mod-log-empty">{{ tt('暂无修改记录') }}</div>
      <div v-else class="mod-log-list">
        <div v-for="(r, ri) in modifyLogRecords" :key="ri" class="mod-log-card">
          <div v-if="!r.rearchiveAt" class="mod-log-open">{{ tt('修改进行中——内容随保存实时更新，再归档审批后定格') }}</div>
          <div class="mod-log-head">
            <span class="mod-log-seq">{{ tt('第') }} {{ modifyLogRecords.length - ri }} {{ tt('次修改') }}</span>
            <span>{{ tt('申请') }}：{{ r.applyBy || '-' }} {{ r.applyAt || '' }}</span>
            <span>{{ tt('修改审批') }}：{{ r.approveBy || '-' }} {{ r.approveAt || '' }}</span>
            <span>{{ tt('再归档') }}：{{ r.rearchiveBy || '-' }} {{ r.rearchiveAt || tt('未归档') }}</span>
          </div>
          <table v-if="(r.changes || []).length" class="mod-log-table">
            <thead><tr><th style="width:70px">{{ tt('类型') }}</th><th style="width:140px">{{ tt('字段') }}</th><th>{{ tt('原内容') }}</th><th>{{ tt('新内容') }}</th></tr></thead>
            <tbody>
              <tr v-for="(c, ci) in r.changes" :key="ci">
                <td><span class="mod-kind" :class="String(c.kind)">{{ tt(String(c.kind)) }}</span></td>
                <td>{{ c.label }}</td>
                <td class="mod-old">{{ c.old || '—' }}</td>
                <td class="mod-new">{{ c.new || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="mod-log-nodata">{{ tt('本次修改未变更头字段') }}</div>
          <div v-if="r.changeMeta && (r.changeMeta.addedRows || r.changeMeta.removedRows || r.changeMeta.changedRows)" class="mod-log-meta">
            {{ tt('明细变化') }}：{{ tt('新增') }} {{ r.changeMeta.addedRows || 0 }} {{ tt('行') }} / {{ tt('删除') }} {{ r.changeMeta.removedRows || 0 }} {{ tt('行') }} / {{ tt('修改') }} {{ r.changeMeta.changedRows || 0 }} {{ tt('行') }}
            <span v-if="(r.changeMeta.addedSamples || []).length">（{{ tt('新增') }}：{{ r.changeMeta.addedSamples.join('、') }}{{ (r.changeMeta.addedRows || 0) > (r.changeMeta.addedSamples || []).length ? ' …' : '' }}）</span>
            <span v-if="(r.changeMeta.removedSamples || []).length">（{{ tt('删除') }}：{{ r.changeMeta.removedSamples.join('、') }}{{ (r.changeMeta.removedRows || 0) > (r.changeMeta.removedSamples || []).length ? ' …' : '' }}）</span>
          </div>
        </div>
      </div>
    </el-dialog>
    <!-- 规格书分发弹窗(两级分发第二级):总负责人把已有规格书单逐张绑定责任人(2026-09-12 改口径,不按种类建单) -->
    <el-dialog v-model="specAssignVisible" :title="tt('规格书分发') + (specAssignStateData?.productName ? ' · ' + specAssignStateData.productName : '')" width="640px" append-to-body>
      <div class="dq-form">
        <div class="dq-row" style="margin-bottom:6px">
          <span class="dq-label">{{ tt('总负责人') }}</span>
          <span>{{ specAssignStateData?.supervisorName || specAssignStateData?.supervisor || tt('产品信息表「责任人」未匹配到启用账号，任务挂起') }}</span>
        </div>
        <div v-if="(specAssignStateData?.assigns || []).length" class="mod-log-meta" style="margin-bottom:8px">
          {{ tt('已分发规格书') }}：{{ specAssignStateData.assigns.length }} {{ tt('张') }}
        </div>
        <table v-if="(specAssignStateData?.assigns || []).length" class="mod-log-table" style="margin-bottom:10px">
          <thead><tr><th>{{ tt('单据编号') }}</th><th>{{ tt('规格书种类') }}</th><th>{{ tt('责任人') }}</th><th style="width:70px">{{ tt('单据状态') }}</th></tr></thead>
          <tbody>
            <tr v-for="a in specAssignStateData.assigns" :key="a['单据编号']">
              <td>{{ a['单据编号'] }}</td>
              <td>{{ a['规格书种类'] }}</td>
              <td>{{ a.ownerName || a['责任人'] }}</td>
              <td>{{ tt(String(a.status)) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-for="(row, ri) in specAssignRows" :key="ri" class="dq-row" style="align-items:center">
          <span class="dq-label">{{ tt('新增分发') }}</span>
          <el-select v-model="row['编号']" style="flex:1" filterable :placeholder="tt('请选择规格书单据')">
            <el-option v-for="d in specDocsAvail" :key="d['单据编号']" :label="specDocLabel(d)" :value="d['单据编号']" />
          </el-select>
          <el-select v-model="row['责任人']" style="flex:1" filterable :placeholder="tt('请选择责任人')">
            <el-option v-for="u in specAssignUsers" :key="u.userName" :label="`${u.realName}（${u.userName}）`" :value="u.userName" />
          </el-select>
          <span style="cursor:pointer;color:#f56c6c;padding:0 4px" @click="specAssignRows.splice(ri, 1)">×</span>
        </div>
        <!-- 分发过的单据不再重复分发:候选=未分配单据(服务端过滤)−本弹窗已选;没有候选只留提示 -->
        <div v-if="specDocsAvail.length" class="as-side-btn" style="display:inline-block" @click="specAssignRows.push({ '编号': '', '责任人': '' })">+ {{ tt('新增分发') }}</div>
        <div v-else class="mod-log-meta">{{ tt('该产品暂无可分发的规格书单据') }}</div>
      </div>
      <template #footer>
        <el-button @click="specAssignVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="specAssignBusy" @click="submitSpecAssign">{{ tt('分发') }}</el-button>
      </template>
    </el-dialog>
    <!-- 查询单据弹窗(文件面板):编号模糊(单据编号/文档编号) + 首次归档时间区间 -->
    <el-dialog v-model="docQueryVisible" :title="tt('查询单据')" width="480px" append-to-body>
      <div class="dq-form">
        <div class="dq-row">
          <span class="dq-label">{{ tt('编号') }}</span>
          <el-input v-model="docQueryNo" clearable :placeholder="tt('单据编号/文档编号模糊匹配')" @keyup.enter="applyDocQuery" />
        </div>
        <div class="dq-row">
          <span class="dq-label">{{ tt('归档时间') }}</span>
          <el-date-picker v-model="docQueryRange" type="daterange" value-format="YYYY-MM-DD" :start-placeholder="tt('起')" :end-placeholder="tt('止')" style="width: 100%" />
        </div>
        <div class="dq-tip">{{ tt('按首次归档时间过滤；草稿未归档不计入区间') }}</div>
      </div>
      <template #footer>
        <el-button @click="clearDocQuery">{{ tt('清空') }}</el-button>
        <el-button type="primary" @click="applyDocQuery">{{ tt('查询') }}</el-button>
      </template>
    </el-dialog>
    <!-- 新增库存弹窗(库存状况):存货/仓库按编码校验基础档案,期初现存量+预警数量 -->
    <el-dialog v-model="stockAddVisible" :title="tt('新增库存')" width="460px" append-to-body>
      <div class="dq-form">
        <div class="dq-row">
          <span class="dq-label">{{ tt('存货编码') }}</span>
          <el-input v-model="stockAddForm['存货编码']" :placeholder="tt('基础档案·存货中的编码，如 CL001')" />
        </div>
        <div class="dq-row">
          <span class="dq-label">{{ tt('仓库') }}</span>
          <el-select v-model="stockAddForm['仓库']" style="width: 100%" filterable :placeholder="tt('选择仓库（基础档案·仓库）')">
            <el-option v-for="w in warehouseOptions" :key="w.code" :label="`${w.name}（${w.code}）`" :value="w.code" />
          </el-select>
        </div>
        <div class="dq-row">
          <span class="dq-label">{{ tt('批号') }}</span>
          <el-input v-model="stockAddForm['批号']" :placeholder="tt('可留空')" />
        </div>
        <div class="dq-row">
          <span class="dq-label">{{ tt('入库日期') }}</span>
          <el-date-picker v-model="stockAddForm['入库日期']" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </div>
        <div class="dq-row">
          <span class="dq-label">{{ tt('现存量') }}</span>
          <el-input-number v-model="stockAddForm['现存量']" :min="0" :precision="2" style="width: 100%" />
        </div>
        <div class="dq-row">
          <span class="dq-label">{{ tt('预警数量') }}</span>
          <el-input-number v-model="stockAddForm['预警数量']" :min="0" :precision="0" style="width: 100%" :placeholder="tt('留空使用默认阈值50')" />
        </div>
      </div>
      <template #footer>
        <el-button @click="stockAddVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :loading="stockAdding" @click="submitStockAdd">{{ tt('确定') }}</el-button>
      </template>
    </el-dialog>
    <SelectVoucherDialog v-model="selVisible" :panelCode="panelCode" :config="selCfg" @generated="onSelGenerated" />
    <QrLabelDialog v-model="qrVisible" :labels="qrLabels" />
    <DetailMaintainDialog v-model="maintainVisible" :panel-code="panelCode" :row="maintainRow" @saved="onMaintainSaved" />
    <VoucherFormDialog v-model="formVisible" :panel-code="formPanel || panelCode" :code="formCode" @saved="onFormSaved" />
    <ScanFillDialog
      v-model="scanVisible"
      :panel-code="panelCode"
      :panel-name="panelName"
      :header-fields="headerFields"
      :detail-tabs="cfgCache?.detail?.tabs || []"
      @apply="onScanApply"
    />

    <!-- 表格列自定义(排序/栏名/显隐) -->
    <el-dialog v-model="colPrefVisible" title="表格调整" width="520px" append-to-body :close-on-click-modal="false">
      <div class="col-pref-tip">拖动或用箭头调整列顺序;勾选=显示;栏名可改。
        <span class="col-pref-count">总 {{ colPrefRows.length }} 列 / 显示 {{ colPrefRows.filter(r => r.visible).length }}</span>
      </div>
      <div class="col-pref-list">
        <div v-for="(item, idx) in colPrefRows" :key="item.label" class="col-pref-row" draggable="true"
             @dragstart="colDragIdx = idx" @dragover.prevent @drop="onColDrop(idx)">
          <div class="cp-drag" title="拖动排序">⋮⋮</div>
          <div class="cp-order">
            <el-button link size="small" :disabled="idx === 0" @click="moveCol(idx, -1)">▲</el-button>
            <el-button link size="small" :disabled="idx === colPrefRows.length - 1" @click="moveCol(idx, 1)">▼</el-button>
          </div>
          <el-checkbox v-model="item.visible" class="cp-vis" />
          <div class="cp-label">{{ item.label }}</div>
          <el-input v-model="item.alias" class="cp-alias" size="small" :placeholder="item.label" clearable />
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="colPrefVisible = false">取消</el-button>
        <el-button size="small" @click="resetColPrefs">恢复默认</el-button>
        <el-button type="primary" size="small" :loading="colPrefSaving" @click="saveColPrefs">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量转ERP:显示已审核+未转ERP的单据,勾选后批量推送 -->
    <el-dialog v-model="batchErpVisible" :title="tt('批量转ERP')" width="600px" append-to-body :close-on-click-modal="false">
      <div class="col-pref-tip">{{ tt('以下为已审核且未转入ERP的单据，勾选后点击"开始转ERP"') }}</div>
      <el-table :data="batchErpList" size="small" border max-height="400" @selection-change="(val) => (batchErpSel = val)">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="单据编号" :label="tt('单据编号')" width="160" />
        <el-table-column prop="单据日期" :label="tt('单据日期')" width="110" />
        <el-table-column prop="partner" :label="tt('供应商/客户')" />
        <el-table-column :label="tt('状态')" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.result === 'ok'" type="success" size="small">{{ row.erpBillNo || '成功' }}</el-tag>
            <el-tag v-else-if="row.result === 'skip'" type="info" size="small">已转</el-tag>
            <el-tag v-else-if="row.result === 'fail'" type="danger" size="small">{{ tt('失败') }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button size="small" @click="batchErpVisible = false">{{ tt('关闭') }}</el-button>
        <el-button type="primary" size="small" :loading="batchErpLoading" :disabled="!batchErpSel.length" @click="doBatchErp">
          {{ tt('开始转ERP') }} ({{ batchErpSel.length }})
        </el-button>
      </template>
    </el-dialog>

    <!-- 表头字段自定义(表头调整:排序/栏名/显隐,与表格调整同款交互) -->
    <el-dialog v-model="headPrefVisible" :title="tt('表头调整')" width="520px" append-to-body :close-on-click-modal="false">
      <div class="col-pref-tip">{{ tt('拖动或用箭头调整字段顺序;勾选=显示;栏名可改。') }}
        <span class="col-pref-count">{{ tt('总') }} {{ headPrefRows.length }} {{ tt('个') }} / {{ tt('显示') }} {{ headPrefRows.filter(r => r.visible).length }}</span>
      </div>
      <div class="col-pref-list">
        <div v-for="(item, idx) in headPrefRows" :key="item.label" class="col-pref-row" draggable="true"
             @dragstart="headDragIdx = idx" @dragover.prevent @drop="onHeadDrop(idx)">
          <div class="cp-drag" :title="tt('拖动排序')">⋮⋮</div>
          <div class="cp-order">
            <el-button link size="small" :disabled="idx === 0" @click="moveHead(idx, -1)">▲</el-button>
            <el-button link size="small" :disabled="idx === headPrefRows.length - 1" @click="moveHead(idx, 1)">▼</el-button>
          </div>
          <el-checkbox v-model="item.visible" class="cp-vis" />
          <div class="cp-label">{{ item.label }}</div>
          <el-input v-model="item.alias" class="cp-alias" size="small" :placeholder="item.label" clearable />
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="headPrefVisible = false">{{ tt('取消') }}</el-button>
        <el-button size="small" @click="resetHeadPrefs">{{ tt('恢复默认') }}</el-button>
        <el-button type="primary" size="small" :loading="headPrefSaving" @click="saveHeadPrefs">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <!-- ══════════ 报表表头筛选面板(teleport 到 body,按列头位置定位) ══════════ -->
    <teleport to="body">
      <div v-if="reportFilterVisible"
           class="report-filter-panel"
           :style="{ left: reportFilterX + 'px', top: reportFilterY + 'px' }"
           @click.stop>
        <div class="filter-panel-header">{{ tt('筛选') }}</div>
        <div class="filter-panel-body">
          <el-checkbox-group v-model="reportCols.headerFilters[reportFilterProp]">
            <el-checkbox v-for="v in reportCols.distinctValues(reportFilterProp)"
                         :key="String(v)" :value="v" class="filter-panel-item">
              <span class="filter-panel-text">
                {{ v === '' || v == null ? tt('（空）') : v }}
              </span>
            </el-checkbox>
          </el-checkbox-group>
        </div>
        <div class="filter-panel-footer">
          <el-button size="small"
                     @click="reportCols.clearFilter(reportFilterProp)">{{ tt('清除') }}</el-button>
          <el-button size="small" type="primary"
                     @click="reportFilterVisible = false">{{ tt('确定') }}</el-button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, onDeactivated, watch, nextTick, markRaw, toRaw } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Filter, Plus, Search } from '@element-plus/icons-vue'
import { useTabsStore } from '@/stores/tabs'
import { useUserStore } from '@/stores/user'
import { useLocaleStore } from '@/stores/locale'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { ensureScanFillAction } from '@core/button-groups'
import { PROGRESS_COLUMNS } from '@core/progress/progressColumns'
import { applyDocDefaults, todayStr } from '@core/panel/docDefaults'
import QrLabelDialog from '@/business/components/QrLabelDialog.vue'
import StagePanel from '@/business/components/StagePanel.vue'
import request from '@core/request'
import { useReportColumns } from '@core/report/useReportColumns'
import { ALL_FIELDS, buildFuzzyQuery } from '@core/search/fuzzyQuery'
import { nextSortState, sortRows } from '@core/sort/rowSort'
import { applyRefCarry, refConfigOf, refShowsCode } from '@core/ref/refCarry'
import RefPickDialog from './RefPickDialog.vue'
import NewVoucherDialog from './NewVoucherDialog.vue'
import ApprovalHistoryDialog from './ApprovalHistoryDialog.vue'
import SelectVoucherDialog from './SelectVoucherDialog.vue'
import DocSelectRail from './DocSelectRail.vue'
import SubBomDialog from './SubBomDialog.vue'
import BomMasterDetail from './BomMasterDetail.vue'
import DocSheet from './DocSheet.vue'
import FileAttachCell from './FileAttachCell.vue'
import ProgressControlSheet from './ProgressControlSheet.vue'
import DataRecordSheet from './DataRecordSheet.vue'
import RecordSheetPanels from './RecordSheetPanels.vue'
import { recordSheetConfigs } from './recordSheetConfigs'
import { approvalSheetCfg, planSheetCfg, qcSheetCfgs } from './docSheetConfigs'
import ImportDialog from './ImportDialog.vue'
import DetailMaintainDialog from './DetailMaintainDialog.vue'
import VoucherFormDialog from './VoucherFormDialog.vue'
import ScanFillDialog from './ScanFillDialog.vue'

const engine = usePanelRuntime()
const route = useRoute()
const router = useRouter()
const tabs = useTabsStore()
const user = useUserStore()
const localeStore = useLocaleStore()

// 语言热切换:仅重拉面板配置(字段标签/面板名/列别名随 Accept-Language 更新),
// 不重拉数据——分页、滚动、弹窗、筛选、展开状态全部保留。
watch(() => localeStore.locale, async () => {
  if (!panelCode.value || invalidPanel.value) return
  try {
    cfgCache.value = null
    await loadCrg()
  } catch { /* 配置重拉失败保持现状 */ }
})

const panelCode = computed(() => route.params.panelCode)
const operationName = computed(() => route.meta.operationName || route.query.operationName || '新增流程')
const invalidPanel = computed(() => !panelCode.value || panelCode.value === 'undefined')

// 物料清单维护和正反向查询统一使用父件/子件主从视图；仅 BOM 草稿开放编辑。
const isBomMasterPanel = computed(() => ['BOM', 'BOM_FWD', 'BOM_REV'].includes(String(panelCode.value)))
// 立项申请表/项目实施计划/项目进度查询/数据记录表(功能性滤效+其余7张)+实验室使用记录表4张:文件类文书式特例面板
const RECORD_SHEET_PANELS = Object.keys(recordSheetConfigs)
const isApprovalDoc = computed(() => ['RD_APPROVAL', 'RD_PLAN', 'RD_PROGRESS', 'RD_FILTER_EFF', ...RECORD_SHEET_PANELS, ...Object.keys(qcSheetCfgs)].includes(String(panelCode.value)))
const isRecordSheetPanel = computed(() => RECORD_SHEET_PANELS.includes(String(panelCode.value)))
const docSheetConfig = computed(() => qcSheetCfgs[panelCode.value] || (panelCode.value === 'RD_PLAN' ? planSheetCfg : approvalSheetCfg))
const bomMasterRows = computed(() => {
  if (panelCode.value === 'BOM') return cur.value?.detail?.['children'] || []
  return list.value || [] // BOM_FWD/BOM_REV：后端返回的展平行（父件-子件对）
})
const bomMasterFields = computed(() => (
  (cfgCache.value?.detail?.tabs || []).find((tab) => tab.key === 'children')?.fields || []
))
const bomMasterRef = ref(null)

function onBomRowsUpdate(rows) {
  if (panelCode.value !== 'BOM' || !draftEditable.value) return
  if (!cur.value.detail) cur.value.detail = {}
  cur.value.detail.children = rows
}

const query = reactive({ keyword: '', pageNo: 1, pageSize: 20 })
const condition = reactive({})
const list = ref([])
const total = ref(0)
const loading = ref(false)
const current = ref(null)
const queryFields = ref([])
const gridTabs = ref([])
const groups = ref([])
const panelName = ref('')
const cfgCache = ref(null)
const queryRefVisible = ref(false)
const queryRefField = ref(null)
const queryRefContext = ref('page')
const queryDialogVisible = ref(false)
const queryDraft = reactive({})
const headerRefVisible = ref(false)
const headerRefField = ref(null)
const detailRefVisible = ref(false)
const detailRefPick = ref(null)
const detailRefSaving = ref(false)
const inlineSaving = ref(false)
// ---- 列头点击筛选(所有表格) ----
const colFilterText = reactive({})   // { [colProp]: 'filter text' }
const filterColProp = ref(null)      // 当前打开筛选输入的列 prop

function toggleColFilter(prop) {
  if (filterColProp.value === prop) {
    filterColProp.value = null
  } else {
    filterColProp.value = prop
    if (colFilterText[prop] === undefined) colFilterText[prop] = ''
  }
}

function clearColFilter(prop) {
  colFilterText[prop] = ''
  filterColProp.value = null
}

function hasColFilter(prop) {
  return !!(colFilterText[prop] && String(colFilterText[prop]).trim())
}

/** 对行数组应用列筛选 */
function applyColFilters(rows, cols) {
  let out = rows
  for (const c of cols) {
    const kw = colFilterText[c.prop]
    if (kw && String(kw).trim()) {
      const k = String(kw).toLowerCase()
      out = out.filter((row) => String(row[c.prop] ?? '').toLowerCase().includes(k))
    }
  }
  return out
}

// ---- 高级筛选(查询弹窗):字段 + 匹配运算符 + 值,前端过滤主表/明细行 ----
const ADV_OPS = [
  { value: 'contains', label: '包含' },
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'ge', label: '大于等于' },
  { value: 'le', label: '小于等于' },
  { value: 'empty', label: '为空' },
  { value: 'notEmpty', label: '不为空' },
]
const advFilters = ref([])

/** 可筛选字段:表头 + 查询字段 + 明细各页签字段(中文键去重,选项显示译名)。 */
const advFilterFields = computed(() => {
  const seen = new Set()
  const out = []
  const push = (label) => { if (label && !seen.has(label)) { seen.add(label); out.push(label) } }
  queryFields.value.forEach((f) => push(headerFieldKey(f)))
  headerEditFields.value.forEach((f) => push(headerFieldKey(f)))
  ;(cfgCache.value?.detail?.tabs || []).forEach((t) => (t.fields || []).forEach((f) => push(f.dataName)))
  return out
})

function addAdvFilter() {
  advFilters.value.push({ field: advFilterFields.value[0] || '', op: 'contains', value: '' })
}

function removeAdvFilter(i) {
  advFilters.value.splice(i, 1)
}

/** 单条条件匹配:数值可比较时按数值(忽略千分位),否则按字符串;包含不区分大小写。 */
function advMatch(row, f) {
  const str = row[f.field] === undefined || row[f.field] === null ? '' : String(row[f.field]).trim()
  const val = String(f.value ?? '').trim()
  if (f.op === 'empty') return str === ''
  if (f.op === 'notEmpty') return str !== ''
  if (!val) return true
  if (f.op === 'contains') return str.toLowerCase().includes(val.toLowerCase())
  if (f.op === 'eq') return str === val
  if (f.op === 'ne') return str !== val
  const a = parseFloat(str.replace(/,/g, ''))
  const b = parseFloat(val.replace(/,/g, ''))
  const [x, y] = Number.isFinite(a) && Number.isFinite(b) ? [a, b] : [str, val]
  if (f.op === 'gt') return x > y
  if (f.op === 'lt') return x < y
  if (f.op === 'ge') return x >= y
  if (f.op === 'le') return x <= y
  return true
}

/** 应用全部有效高级筛选条件(AND 组合);空条件(未填值)不参与过滤。 */
function applyAdvFilters(rows) {
  const active = advFilters.value.filter((f) => f.field && (f.op === 'empty' || f.op === 'notEmpty' || String(f.value ?? '').trim() !== ''))
  if (!active.length) return rows
  return rows.filter((row) => active.every((f) => advMatch(row, f)))
}

// ---- 表格列自定义(排序/栏名/显隐) ----
const colPrefVisible = ref(false)
const colPrefSaving = ref(false)
const colPrefRows = ref([])

// ── 批量转ERP ──
const batchErpVisible = ref(false)
const batchErpList = ref([])
const batchErpSel = ref([])
const batchErpLoading = ref(false)

async function openBatchErp() {
  try {
    const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '查询可转ERP', formData: {}, buttonParam: {} })
    batchErpList.value = (res?.list || []).map((r) => ({ ...r, result: '' }))
    batchErpSel.value = []
    batchErpVisible.value = true
    if (!batchErpList.value.length) ElMessage.info('暂无已审核且未转ERP的单据')
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'))
  }
}

async function doBatchErp() {
  if (!batchErpSel.value.length) return
  batchErpLoading.value = true
  let ok = 0, skip = 0, fail = 0
  for (const row of batchErpSel.value) {
    try {
      const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '转ERP', formData: { 编号: row.单据编号, 单据编号: row.单据编号 }, buttonParam: {} })
      if (res?.message?.includes('已转入ERP')) { row.result = 'skip'; skip++ }
      else { row.result = 'ok'; row.erpBillNo = res?.ERP单号 || ''; ok++ }
    } catch { row.result = 'fail'; fail++ }
  }
  batchErpLoading.value = false
  ElMessage.success(`批量转ERP完成: 成功${ok} 跳过${skip} 失败${fail}`)
  await load()
}
const colDragIdx = ref(-1)

function openColPrefs() {
  const gridTab = gridTabs.value?.[0]
  const aliases = gridTab?.columnAliases || {}
  const allFields = cfgCache.value?.detail?.tabs?.[0]?.fields || []
  const visibleCols = new Set(gridTab?.columns || [])
  colPrefRows.value = allFields.map((f) => {
    const label = f.dataName || f.name || f.code
    return { label, alias: aliases[label] || f.displayName || '', visible: visibleCols.has(label) }
  })
  colPrefVisible.value = true
}

function moveCol(idx, dir) {
  const rows = colPrefRows.value
  const target = idx + dir
  if (target < 0 || target >= rows.length) return
  const tmp = rows[idx]
  rows[idx] = rows[target]
  rows[target] = tmp
}

function onColDrop(idx) {
  const from = colDragIdx.value
  if (from < 0 || from === idx) return
  const rows = colPrefRows.value
  const item = rows.splice(from, 1)[0]
  rows.splice(idx, 0, item)
  colDragIdx.value = -1
}

async function saveColPrefs() {
  colPrefSaving.value = true
  try {
    await engine.saveColumnPrefs({
      panelCode: panelCode.value,
      columns: colPrefRows.value.map((r) => ({ label: r.label, alias: r.alias || '', visible: !!r.visible })),
    })
    ElMessage.success('表格调整已保存')
    colPrefVisible.value = false
    cfgCache.value = null
    await load()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '保存失败')
  } finally {
    colPrefSaving.value = false
  }
}

function resetColPrefs() {
  colPrefRows.value.forEach((r) => { r.alias = ''; r.visible = true })
  ElMessage.info('已恢复默认(需保存生效)')
}

// ---- 表头字段自定义(表头调整:排序/栏名/显隐,与表格调整同款交互;显隐 hidden+visible 同开同关) ----
const headPrefVisible = ref(false)
const headPrefSaving = ref(false)
const headPrefRows = ref([])
const headDragIdx = ref(-1)

function openHeadPrefs() {
  const fields = cfgCache.value?.dataSchema?.fields || []
  if (!fields.length) return ElMessage.warning(tt('该面板没有可调整的表头字段'))
  headPrefRows.value = fields.map((f) => ({
    label: f.dataName || f.name || f.code,
    alias: f.displayName || '',
    visible: f.hidden !== true && f.visible !== false,
  }))
  headPrefVisible.value = true
}

function moveHead(idx, dir) {
  const rows = headPrefRows.value
  const target = idx + dir
  if (target < 0 || target >= rows.length) return
  const tmp = rows[idx]
  rows[idx] = rows[target]
  rows[target] = tmp
}

function onHeadDrop(idx) {
  const from = headDragIdx.value
  if (from < 0 || from === idx) return
  const rows = headPrefRows.value
  const item = rows.splice(from, 1)[0]
  rows.splice(idx, 0, item)
  headDragIdx.value = -1
}

async function saveHeadPrefs() {
  headPrefSaving.value = true
  try {
    await engine.saveHeaderPrefs({
      panelCode: panelCode.value,
      columns: headPrefRows.value.map((r) => ({ label: r.label, alias: r.alias || '', visible: !!r.visible })),
    })
    ElMessage.success(tt('表头调整已保存'))
    headPrefVisible.value = false
    cfgCache.value = null
    await load()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('保存失败'))
  } finally {
    headPrefSaving.value = false
  }
}

function resetHeadPrefs() {
  headPrefRows.value.forEach((r) => { r.alias = ''; r.visible = true })
  ElMessage.info(tt('已恢复默认(需保存生效)'))
}
// ---- 参照字段动态模式(≤20 下拉 / >20 弹窗):缓存计数 + 下拉选项 ----
// 数据量跨越阈值时(增删档案后)由 refreshRefModes 重新判定,模式随之切换。
const refModeMap = reactive({})      // fieldKey -> 'dialog' | 'select'
const refSelectData = reactive({})   // fieldKey -> { options: [], loading: bool }
const REF_DROPDOWN_THRESHOLD = 20

async function checkRefMode(field, fieldKey) {
  if (refModeMap[fieldKey]) return refModeMap[fieldKey]
  refModeMap[fieldKey] = 'dialog' // 默认弹窗,异步判定后可能切下拉
  try {
    const count = await engine.refRowCount(field)
    // 少量数据(≤20)用下拉轻快;大量数据(>20)用弹窗带搜索定位(仅表头/查询区;明细单元格恒弹窗)
    refModeMap[fieldKey] = count > REF_DROPDOWN_THRESHOLD ? 'dialog' : 'select'
    if (refModeMap[fieldKey] === 'select') await loadRefSelectOptions(field, fieldKey, '')
  } catch (e) { /* 保持弹窗 */ }
  return refModeMap[fieldKey]
}

/** 数据变化后重新判定全部参照字段模式(清空缓存计数,按最新数据量切换下拉/弹窗)。 */
async function refreshRefModes() {
  const all = [...(queryFields.value || []), ...(headerFields.value || [])].filter(isReferenceField)
  const validKeys = new Set(all.map((f) => headerFieldKey(f)))
  Object.keys(refModeMap).forEach((k) => { if (!validKeys.has(k)) delete refModeMap[k] })
  await Promise.all(all.map((f) => {
    const key = headerFieldKey(f)
    delete refModeMap[key]
    return checkRefMode(f, key)
  }))
}

// ---- 下拉框字段双模(≤20 下拉 / >20 弹窗):options 内嵌于面板配置,按数量直接判定 ----
const dictModeMap = reactive({}) // fieldKey -> 'dialog' | 'select'

function dictModeOf(field, fieldKey) {
  if (!dictModeMap[fieldKey]) {
    dictModeMap[fieldKey] = fieldOptions(field).length > REF_DROPDOWN_THRESHOLD ? 'dialog' : 'select'
  }
  return dictModeMap[fieldKey]
}

/** 面板切换时清理上个面板的字典模式缓存(同名字段如「业务类型」在不同面板数量可能不同)。 */
function resetDictModes() {
  Object.keys(dictModeMap).forEach((k) => delete dictModeMap[k])
}

// 字典弹窗选择(>20 条):搜索 + 列表点击回填
const dictPickVisible = ref(false)
const dictPickField = ref(null)
const dictPickKeyword = ref('')
const dictPickOptions = computed(() => {
  const field = dictPickField.value
  if (!field) return []
  const kw = dictPickKeyword.value.trim().toLowerCase()
  const opts = fieldOptions(field)
  if (!kw) return opts
  return opts.filter((o) =>
    String(o.label).toLowerCase().includes(kw) || String(o.value).toLowerCase().includes(kw))
})

function openDictPick(field) {
  if (!draftEditable.value || headerFieldLocked(field)) return
  dictPickField.value = field
  dictPickKeyword.value = ''
  dictPickVisible.value = true
}

function onDictPick(option) {
  const field = dictPickField.value
  if (field) {
    cur.value[headerFieldKey(field)] = option.value
    markInlineDirty()
  }
  dictPickVisible.value = false
  dictPickField.value = null
}

function clearDictPick() {
  const field = dictPickField.value
  if (field) {
    cur.value[headerFieldKey(field)] = ''
    markInlineDirty()
  }
  dictPickVisible.value = false
  dictPickField.value = null
}

async function loadRefSelectOptions(field, fieldKey, keyword) {
  if (!refSelectData[fieldKey]) refSelectData[fieldKey] = reactive({ options: [], loading: false })
  refSelectData[fieldKey].loading = true
  try {
    refSelectData[fieldKey].options = await engine.refSelectOptions(field, keyword)
  } catch (e) {
    refSelectData[fieldKey].options = []
  } finally {
    refSelectData[fieldKey].loading = false
  }
}

function isRefSelect(field) {
  return isReferenceField(field) && refModeMap[headerFieldKey(field)] === 'select'
}

/** 草稿表头下拉选中带回:与表头参照弹窗同口径,按 refMap 把选中项源数据行的其他字段整串回填。
 *  allow-create 自由输入/清空时无源行,跳过映射只标记脏(不动已填字段,与弹窗取消一致)。 */
function onHeaderRefSelectChange(field, v) {
  const key = headerFieldKey(field)
  const opt = (refSelectData[key]?.options || []).find((o) => o.value === v)
  if (opt?.row) {
    applyRefCarry(cur.value, opt.row, refConfigOf(field), key)
  }
  markInlineDirty()
}

const reportMode = computed(() => cfgCache.value?.metadata?.report === true || cfgCache.value?.metadata?.panelCategory === '报表')
// ── 报表查询弹窗(T+ 同款,收发存汇总/库存台账):与「查询」按钮共用同一个弹窗 ──
// 字段:单据日期(区间控件,必填) + 仓库/存货(参照;台账必填单一仓库+单一存货,汇总选填)
// 进入态差异:①未完成过查询就关闭(✕/取消)=退出页面 ②必填项校验(applyHeaderQuery)。
const reportQueryDialog = computed(() => cfgCache.value?.metadata?.reportQueryDialog === true)
// 级联查询面板:仓库/存货下拉互相约束(台账=联动+必填;库存状况表=联动+选填,快照无日期)
const isCascadePanel = computed(() => ['STOCK_LEDGER', 'STOCK_BALANCE'].includes(panelCode.value))
const rqdDone = ref(false) // 本面板本轮是否已通过弹窗查询(未过弹窗前拦截一切列表加载)
const rqdRange = ref([])   // 单据日期区间 [开始, 结束](YYYY-MM-DD)
/** 台账:仓库/存货必填(单选一个仓库的一种存货);汇总:仅单据日期必填 */
function rqdFieldRequired(field) {
  if (!reportQueryDialog.value) return false
  if (panelCode.value === 'STOCK_LEDGER' && ['仓库', '存货'].includes(headerFieldKey(field))) return true
  return false
}
// 台账联动选项:仓库/存货下拉互相约束(选项=后端 v_stock_ledger 真实组合)
const ledgerWhOptions = ref([])
const ledgerItemOptions = ref([])
const ledgerOptsLoading = ref(false)
async function loadLedgerRefOptions({ keepWh = true, keepItem = true } = {}) {
  ledgerOptsLoading.value = true
  try {
    const res = await engine.callButton({
      panelCode: panelCode.value, buttonName: '台账联动选项',
      formData: { 仓库: queryDraft['仓库'] || '', 存货: queryDraft['存货'] || '' }, buttonParam: {},
    })
    ledgerWhOptions.value = res?.仓库列表 || []
    ledgerItemOptions.value = res?.存货列表 || []
    // 约束收紧后当前值可能不再合法:清掉无效侧(保持用户已选且仍合法的那侧)
    if (!keepWh && queryDraft['仓库'] && !ledgerWhOptions.value.includes(queryDraft['仓库'])) delete queryDraft['仓库']
    if (!keepItem && queryDraft['存货'] && !ledgerItemOptions.value.includes(queryDraft['存货'])) delete queryDraft['存货']
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'))
  } finally {
    ledgerOptsLoading.value = false
  }
}
function onLedgerWhChange() { loadLedgerRefOptions({ keepWh: true, keepItem: false }) } // 换仓→存货按新仓收敛
function onLedgerItemChange() { loadLedgerRefOptions({ keepWh: false, keepItem: true }) } // 换存货→仓库按新存货收敛
/** 弹窗关闭:查询弹窗面板在未完成过一次查询时,关闭(✕/取消)即退出页面(对齐 T+ 报表交互) */
function onQueryDialogClose() {
  if (reportQueryDialog.value && !rqdDone.value) router.push('/dashboard')
}
// YINJIA 适配:单单据面板(基础档案)只有一张虚拟单,隐藏单据切换按钮(◁◀ 第X/Y张 ▶▷)
const singleDocMode = computed(() => cfgCache.value?.metadata?.singleDoc === true)
const reportPageCount = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)))
const reportPeriod = computed(() => {
  const start = condition['开始日期']
  const end = condition['结束日期']
  if (start && end) return `${start} - ${end}`
  if (start) return `${start} 起`
  if (end) return `截至 ${end}`
  return tt('当前业务数据')
})
const reportColumns = computed(() => gridTabs.value[0]?.columns || [])
// ── 报表表头筛选与排序补丁:栏目显隐 / 表头筛选 / 升降序 / 后端持久化 ──
const reportCols = useReportColumns(panelCode, reportColumns, list)
const reportList = reportCols.sortedRows          // 排序+筛选后的报表数据(模板顶层引用以自动解包)
const reportFilterVisible = ref(false)             // 筛选面板显示状态(本地驱动,配合 teleport 定位)
const reportFilterProp = ref('')                   // 当前筛选的字段名
const reportFilterX = ref(0)
const reportFilterY = ref(0)

function hasDistinctValues(prop) {
  return reportCols.distinctValues(prop).length > 1
}

function openFilterAt(prop, event) {
  const rect = event.currentTarget.getBoundingClientRect()
  reportFilterX.value = rect.left
  reportFilterY.value = rect.bottom + 4
  if (!Array.isArray(reportCols.headerFilters[prop])) reportCols.headerFilters[prop] = []
  reportFilterProp.value = prop
  reportFilterVisible.value = true
}

function closeFilterPanel(e) {
  if (!reportFilterVisible.value) return
  if (e.target.closest('.report-filter-panel')) return
  if (e.target.closest('.report-col-filter')) return
  reportFilterVisible.value = false
}

onMounted(() => document.addEventListener('click', closeFilterPanel))
onUnmounted(() => document.removeEventListener('click', closeFilterPanel))

const reportColumnTree = computed(() => {
  const groups = gridTabs.value[0]?.columnGroups || []
  const owner = new Map()
  for (const group of groups) for (const column of group.columns || []) owner.set(column, group)
  const emitted = new Set()
  const out = []
  for (const column of reportColumns.value
          .filter((name) => reportCols.visibleProps.value.includes(name))) {
    const group = owner.get(column)
    if (group) {
      if (emitted.has(group.label)) continue
      emitted.add(group.label)
      out.push({
        label: group.label,
        children: (group.columns || []).filter((name) => reportCols.visibleProps.value.includes(name)).map(reportLeaf),
      })
    } else {
      out.push(reportLeaf(column))
    }
  }
  return out
})
const toolbarGroups = computed(() => (groups.value || []).map((group) => {
  const actions = actsOf(group).filter((action) => action !== '查询' && action !== '查找')
  const name = ['查询', '查找'].includes(group.name) ? (actions[0] || group.name) : group.name
  return { ...group, name, actions }
}).filter((group) => actsOf(group).length))
// 文书式面板右侧栏:过滤无意义动作(选单/生单/复制/表格调整 对无明细文书无作用;审批流程本面板不启用)
const APPROVAL_SIDE_EXCLUDE = ['选单', '生单', '复制', '表格调整', '表头调整', '审核', '提交审批', '审批通过', '审批驳回', '审批情况', '弃审', '刷新', '退出'] // 刷新/退出在文书侧栏体验差(刷新整页重载/退出关闭页签),2026-09-14 移除
// 删除组单独渲染(带下拉:删除=整单删除;管理员含 删除审批通过/驳回)
const openDelMenu = ref(false)

// ---------- 修改组(文书归档面板):归档后申请修改(管理员审批进入修改态)+ 修改记录(滚动3条) ----------
// 面板集合真源 = 后端 ButtonService.DOC_ARCHIVE_PANELS,经面板配置 metadata.docArchive 下发;
// 2026-09-11 从产品文件 7 面板放开到全部保存即归档面板(实验室 4/数据记录表 8/立项申请/实施计划等),
// 前端不再维护清单——新文书面板在后端登记即自动获得修改闭环。

/** 审批权限:管理员,或角色对该面板勾了审批(approvePanels,后端 can_approve 口径) */
function canApproveHere() {
  const ap = user.approvePanels || []
  return user.isAdmin || ap.includes('*') || ap.includes(String(panelCode.value))
}

// ---------- 文件面板查询单据:编号模糊(单据编号/文档编号) + 首次归档时间区间 ----------
const docQueryVisible = ref(false)
const docQueryNo = ref('')
const docQueryRange = ref(null)

// ---------- 库存状况:仓库下拉(_ckdm 按仓库编码精确过滤;dm_ck 字典改名不影响绑定) ----------
const stockWh = ref('')
const warehouseOptions = ref([])
const isStockStatus = computed(() => String(panelCode.value) === 'STOCK_STATUS')
watch(isStockStatus, async (v) => {
  if (!v || warehouseOptions.value.length) return
  try {
    const res = await request.get('/base/warehouse/list')
    warehouseOptions.value = res?.data || []
  } catch {
    warehouseOptions.value = []
  }
}, { immediate: true })
function onStockWhChange(v) {
  if (v) condition['_ckdm'] = v
  else delete condition['_ckdm']
  search()
}

// ---------- 新增库存(库存状况):存货/仓库按编码绑定基础档案,期初现存量+预警数量 ----------
const stockAddVisible = ref(false)
const stockAdding = ref(false)
const stockAddForm = reactive({ 存货编码: '', 仓库: '', 批号: '', 入库日期: '', 现存量: 0, 预警数量: null })
function openStockAdd() {
  stockAddForm['存货编码'] = ''
  stockAddForm['仓库'] = ''
  stockAddForm['批号'] = ''
  stockAddForm['入库日期'] = todayStr()
  stockAddForm['现存量'] = 0
  stockAddForm['预警数量'] = 50
  stockAddVisible.value = true
}
async function submitStockAdd() {
  stockAdding.value = true
  try {
    await engine.callButton({
      panelCode: 'STOCK_STATUS',
      buttonName: '新增库存',
      formData: { ...stockAddForm, 预警数量: stockAddForm['预警数量'] ?? '' },
      buttonParam: {},
    })
    ElMessage.success(tt('库存已新增'))
    stockAddVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('新增失败'))
  } finally {
    stockAdding.value = false
  }
}

// ---------- 预警数量行内编辑(库存状况):点击变输入框,回车/失焦保存,Esc 取消 ----------
const warnEdit = reactive({ id: null, value: null })
const warnEditRef = ref(null)
watch(() => warnEdit.id, async (v) => {
  if (v == null) return
  await nextTick()
  const el = warnEditRef.value
  if (el && typeof el.focus === 'function') el.focus()
})
function startWarnEdit(row) {
  warnEdit.id = row.id
  warnEdit.value = row['预警数量'] == null || row['预警数量'] === '' ? null : Number(row['预警数量'])
}
async function saveWarnEdit() {
  if (warnEdit.id == null) return
  const id = warnEdit.id
  const val = warnEdit.value
  warnEdit.id = null
  try {
    await engine.callButton({
      panelCode: 'STOCK_STATUS',
      buttonName: '更新预警数量',
      formData: { id, 预警数量: val == null ? '' : String(val) },
      buttonParam: {},
    })
    const row = (reportList.value || list.value).find((r) => r.id === id)
    if (row) row['预警数量'] = val == null ? null : val
    ElMessage.success(tt('预警数量已更新'))
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('更新失败'))
    load()
  }
}

async function applyDocQuery() {
  condition['_docNo'] = docQueryNo.value || ''
  const r = docQueryRange.value || []
  condition['_archFrom'] = r[0] || ''
  condition['_archTo'] = r[1] || ''
  docQueryVisible.value = false
  query.pageNo = 1
  curIdx.value = 0
  await load()
  if (!list.value.length) {
    // 零匹配:自动恢复全部单据,避免停留在空白视图
    delete condition['_docNo']
    delete condition['_archFrom']
    delete condition['_archTo']
    ElMessage.warning(tt('未查询到匹配单据，已恢复全部单据'))
    await load()
    return
  }
  const firstNo = list.value[0]?.['单据编号'] || list.value[0]?.['编号'] || ''
  ElMessage.success(`${tt('查询到')} ${total.value} ${tt('张')}，${tt('已跳转到')}：${firstNo}`)
}

function clearDocQuery() {
  docQueryNo.value = ''
  docQueryRange.value = null
  delete condition['_docNo']
  delete condition['_archFrom']
  delete condition['_archTo']
  docQueryVisible.value = false
  search()
}

// ---------- 文书侧栏「模糊搜索」:字段+内容(可加多条件 AND) → 查找 → 单条跳转/多条出清单 ----------
// 复用现有查询:具体字段 → condition[字段](后端 LIKE '%值%';明细字段走 EXISTS 行匹配),
// 「全部字段」→ keyword(后端在表头+明细全部字段 OR 模糊)。零后端改动。
const fuzzyMode = ref(false)
const fuzzyRows = ref([{ field: '', value: '' }])
const fuzzySearched = ref(false)
const fuzzyApplied = ref(null) // 生效中的条件 {condition, keyword, valid}
let fuzzyPrevPageSize = null
const curDocNo = computed(() => String(cur.value?.['单据编号'] || cur.value?.['编号'] || ''))

/** 字段下拉:全部字段 / 表头字段 / 明细字段(值=字段中文标签,后端按标签映射列) */
const fuzzyFieldGroups = computed(() => {
  const cfg = cfgCache.value
  const header = (headerFields.value || []).map((f) => headerFieldKey(f)).filter(Boolean)
  const seen = new Set(header)
  const detail = []
  for (const tab of cfg?.detail?.tabs || []) {
    for (const f of tab.fields || []) {
      const key = f.dataName || f.code
      if (!key || seen.has(key) || f.hidden) continue
      seen.add(key)
      detail.push(key)
    }
  }
  const groups = [{ label: tt('全部字段'), options: [{ value: ALL_FIELDS, label: tt('任意字段') }] }]
  if (header.length) groups.push({ label: tt('表头字段'), options: header.map((k) => ({ value: k, label: tt(k) })) })
  if (detail.length) groups.push({ label: tt('明细字段'), options: detail.map((k) => ({ value: k, label: tt(k) })) })
  return groups
})

/** 结果清单:直接取当前已加载列表(查找后列表本身就是命中集合) */
const fuzzyResultRows = computed(() => (list.value || []).map((row) => ({
  no: String(row['单据编号'] || row['编号'] || ''),
  date: String(row['单据日期'] || ''),
  status: String(row['单据状态'] || ''),
  row,
})))

function openFuzzy() {
  fuzzyMode.value = true
  if (!fuzzyRows.value.length) fuzzyRows.value = [{ field: '', value: '' }]
}
function addFuzzyRow() {
  fuzzyRows.value.push({ field: '', value: '' })
}
function removeFuzzyRow(index) {
  fuzzyRows.value.splice(index, 1)
  if (!fuzzyRows.value.length) addFuzzyRow()
}
async function closeFuzzy() {
  fuzzyMode.value = false
  fuzzyRows.value = [{ field: '', value: '' }]
  fuzzySearched.value = false
  fuzzyApplied.value = null
  if (fuzzyPrevPageSize) { query.pageSize = fuzzyPrevPageSize; fuzzyPrevPageSize = null }
  query.pageNo = 1
  curIdx.value = 0
  await load()
}
async function runFuzzySearch() {
  const built = buildFuzzyQuery(fuzzyRows.value)
  if (!built.valid) {
    ElMessage.warning(tt('请先填写字段和内容'))
    return
  }
  if (fuzzyPrevPageSize === null) fuzzyPrevPageSize = query.pageSize
  fuzzyApplied.value = built
  query.pageSize = 200 // 模糊搜索一次取够,结果清单要能列全
  query.pageNo = 1
  curIdx.value = 0
  await load()
  fuzzySearched.value = true
  if (!total.value) {
    ElMessage.warning(tt('未找到匹配单据'))
    return
  }
  if (total.value === 1) {
    ElMessage.success(`${tt('已跳转到')}：${fuzzyResultRows.value[0]?.no || ''}`)
    return
  }
  ElMessage.success(`${tt('找到')} ${total.value} ${tt('张单据')}，${tt('点清单切换查看')}`)
}
/** 点结果行 = 切换当前单据(走既有离开守卫:草稿未保存会提示) */
async function openFuzzyResult(r) {
  const index = list.value.indexOf(r.row)
  if (index >= 0) await guardDocSwitch(index)
}
// ---------- 文书侧栏「单据预览查找」:全量单据卡片(编号/状态/日期+前4个非空业务字段摘要) ----------
// 与模糊搜索同源取数(pageSize 拉到 200 一次取全),关键字客户端筛选;点卡片即跳转,文件档案查看效果。零后端改动。
const previewMode = ref(false)
const previewKw = ref('')
let previewPrevPageSize = null
/** 摘要字段剔除清单:系统列与阶段明细列不进卡片 */
const PREVIEW_SKIP = new Set(['单据编号', '编号', '单据日期', '单据状态', '文档编号', '文件管理人', '密级', '文件使用范围', '备注', '打印时间', '公司名称'])
function previewFieldsOf(row) {
  const out = []
  for (const f of headerFields.value || []) {
    if (out.length >= 4) break
    const key = headerFieldKey(f)
    if (!key || PREVIEW_SKIP.has(key) || /^阶段\d+/.test(key)) continue
    const v = row[key]
    if (v == null || String(v).trim() === '') continue
    const s = String(v).replace(/\s+/g, ' ').trim()
    if (!s) continue
    out.push({ label: key, value: s.length > 42 ? s.slice(0, 42) + '…' : s })
  }
  return out
}
const previewCards = computed(() => (list.value || []).map((row) => {
  const no = String(row['单据编号'] || row['编号'] || '')
  const fields = previewFieldsOf(row)
  const kw = previewKw.value.trim().toLowerCase()
  const hit = !kw || no.toLowerCase().includes(kw) || fields.some((x) => x.value.toLowerCase().includes(kw))
  return { no, date: String(row['单据日期'] || ''), status: String(row['单据状态'] || ''), fields, hit, row }
}).filter((c) => c.hit))
async function openDocPreview() {
  if (fuzzyMode.value) { // 与模糊搜索互斥:模糊条件失效,pageSize 直接接管
    fuzzyMode.value = false
    fuzzySearched.value = false
    fuzzyApplied.value = null
    fuzzyPrevPageSize = null
  }
  previewMode.value = true
  previewKw.value = ''
  if (previewPrevPageSize === null) previewPrevPageSize = query.pageSize
  query.pageSize = 200
  query.pageNo = 1
  curIdx.value = 0
  await load()
}
async function closeDocPreview() {
  previewMode.value = false
  previewKw.value = ''
  if (previewPrevPageSize !== null) { query.pageSize = previewPrevPageSize; previewPrevPageSize = null }
  query.pageNo = 1
  curIdx.value = 0
  await load()
}
async function openPreviewCard(c) {
  const index = list.value.indexOf(c.row)
  if (index >= 0) await guardDocSwitch(index)
}
/** 文书归档面板(保存即归档):修改闭环按钮组的显隐开关,真源后端 metadata.docArchive */
const isDocArchivePanel = computed(() => !!cfgCache.value?.metadata?.docArchive)
/** 品质单据等标准流文书面板:非文件类(保存不自动提交审批),侧栏需显式审批动作组 */
const isStandardFlowSheet = computed(() => Object.prototype.hasOwnProperty.call(qcSheetCfgs, String(panelCode.value)))
const openModMenu = ref(false)
const curDocStatus = computed(() => String(cur.value?.['单据状态'] || ''))
// 规格书两级分发(2026-09-12):已分配单仅 责任人∪总负责人∪管理员 可编辑,其他人可见只读
const specDocAssign = ref(null)
const specAssignBlocked = computed(() => !!(specDocAssign.value?.hasAssign)
  && !user.isAdmin
  && user.account !== specDocAssign.value?.owner
  && user.account !== specDocAssign.value?.supervisor)
const canModifyReq = computed(() => ['已归档', '已审核'].includes(curDocStatus.value) && !specAssignBlocked.value)
const modifyLogVisible = ref(false)
const modifyLogRecords = ref([])
const modifyLogNo = ref('')

// ── 产品开发下发(2026-09-09):仅产品信息表;归档后可用;按产品编号下发过则置灰「已下发」 ──
const devDispatch = reactive({ productCode: '', dispatched: false, busy: false, supervisor: '', supervisorName: '', supervisorResolved: false })
const canDevDispatch = computed(() => panelCode.value === 'RD_PROD_INFO' && curDocStatus.value === '已归档')
async function loadDevDispatchState() {
  if (panelCode.value !== 'RD_PROD_INFO') {
    devDispatch.productCode = ''
    devDispatch.dispatched = false
    devDispatch.supervisor = ''
    devDispatch.supervisorName = ''
    devDispatch.supervisorResolved = false
    return
  }
  const no = cur.value?.['单据编号'] || ''
  if (!no) {
    devDispatch.productCode = ''
    devDispatch.dispatched = false
    devDispatch.supervisor = ''
    devDispatch.supervisorName = ''
    devDispatch.supervisorResolved = false
    return
  }
  try {
    const res = await engine.rdDevButtonState(no)
    devDispatch.productCode = res?.productCode || ''
    devDispatch.dispatched = !!res?.dispatched
    // 总负责人(=产品信息表「责任人」→账号;后端懒重解:产品信息改好人后这里即补挂)
    devDispatch.supervisor = res?.supervisor || ''
    devDispatch.supervisorName = res?.supervisorName || ''
    devDispatch.supervisorResolved = !!res?.supervisorResolved
  } catch (e) {
    devDispatch.productCode = ''
    devDispatch.dispatched = false
    devDispatch.supervisor = ''
    devDispatch.supervisorName = ''
    devDispatch.supervisorResolved = false
  }
}
async function onDevDispatch() {
  if (!canDevDispatch.value || devDispatch.dispatched || devDispatch.busy) return
  devDispatch.busy = true
  try {
    await onButton('产品开发')
    await loadDevDispatchState()
  } finally {
    devDispatch.busy = false
  }
}

// ── 规格书两级分发(2026-09-12):总负责人按 种类+责任人 批量建规格书草稿单 ──
const canSpecDispatch = computed(() => user.isAdmin || (!!devDispatch.supervisor && user.account === devDispatch.supervisor))
const specAssignVisible = ref(false)
const specAssignStateData = ref(null)
const specAssignRows = ref([])
const specAssignUsers = ref([])
const specAssignBusy = ref(false)
/** 可分配候选单 = 服务端 docs(存活且未分配的单据) − 本弹窗各行已选(分发过的不再重复分发) */
const specDocsAvail = computed(() => {
  const picked = new Set(specAssignRows.value.map((r) => String(r['编号'] || '').trim()).filter(Boolean))
  return (specAssignStateData.value?.docs || []).filter((d) => !picked.has(d['单据编号']))
})
/** 候选单下拉展示:单据编号 · 种类(有则附) · 状态 */
const specDocLabel = (d) => {
  const kind = d['规格书种类'] ? ` · ${d['规格书种类']}` : ''
  return `${d['单据编号']}${kind} · ${tt(String(d.status))}`
}
/** 规格书单据编辑闸门:随面板/当前单据加载分配状态(无分配=历史单,不受封锁) */
async function loadSpecDocAssign() {
  if (panelCode.value !== 'RD_SPEC_DOC') { specDocAssign.value = null; return }
  const no = cur.value?.['单据编号'] || ''
  if (!no) { specDocAssign.value = null; return }
  try { specDocAssign.value = await engine.specAssignDoc(no) } catch { specDocAssign.value = null }
}
async function openSpecAssign() {
  if (!canSpecDispatch.value) return
  if (!devDispatch.productCode) await loadDevDispatchState()
  try {
    const [state, users] = await Promise.all([
      engine.specAssignState(devDispatch.productCode),
      request.get('/sys/user/list').then((r) => r?.data || []),
    ])
    specAssignStateData.value = state
    specAssignUsers.value = (Array.isArray(users) ? users : []).filter((u) => String(u.enabled) !== '0' && u.userName)
    specAssignRows.value = [{ '编号': '', '责任人': '' }]
    specAssignVisible.value = true
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'))
  }
}
async function submitSpecAssign() {
  const assigns = specAssignRows.value
    .map((r) => ({ '编号': String(r['编号'] || '').trim(), '责任人': String(r['责任人'] || '').trim() }))
    .filter((r) => r['编号'] || r['责任人'])
  if (!assigns.length) return ElMessage.warning(tt('请选择规格书单据') + ' / ' + tt('请选择责任人'))
  if (assigns.some((r) => !r['编号'])) return ElMessage.warning(tt('请选择规格书单据'))
  if (assigns.some((r) => !r['责任人'])) return ElMessage.warning(tt('请选择责任人'))
  specAssignBusy.value = true
  try {
    const res = await engine.callButton({
      panelCode: 'RD_PROD_INFO',
      buttonName: '规格书分发',
      formData: { 编号: cur.value?.['单据编号'], assigns },
      buttonParam: {},
    })
    const n = (res?.assigned || assigns).length
    ElMessage.success(tt('分发成功，已分配 {n} 张规格书').replace('{n}', String(n)))
    specAssignVisible.value = false
    specAssignStateData.value = await engine.specAssignState(devDispatch.productCode)
    specAssignRows.value = []
    await load()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('操作失败'))
  } finally {
    specAssignBusy.value = false
  }
}

function pickModAction(action) {
  openModMenu.value = false
  onSideAction(action)
}

function safeParseJson(s) {
  try { return JSON.parse(s) } catch { return null }
}

async function openModifyLog() {
  if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
  const no = current.value['编号'] || current.value['单据编号'] || ''
  try {
    const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '修改记录', formData: { 编号: no }, buttonParam: {} })
    modifyLogNo.value = no
    modifyLogRecords.value = (res?.records || []).map((r) => ({
      ...r,
      changes: typeof r.changes === 'string' ? (safeParseJson(r.changes) || []) : (r.changes || []),
      changeMeta: typeof r.changeMeta === 'string' ? (safeParseJson(r.changeMeta) || {}) : (r.changeMeta || {}),
    }))
    modifyLogVisible.value = true
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'))
  }
}
const approvalSideGroups = computed(() => toolbarGroups.value
  .map((g) => ({
    ...g,
    actions: (g.actions || []).filter((a) => !APPROVAL_SIDE_EXCLUDE.includes(a)
      // 单单据面板(项目进度查询 RD_PROGRESS):全部数据都进同一张单据,不提供「新增」入口
      && !(singleDocMode.value && (a === '新增' || a === '新增流程' || a === '新建'))),
  }))
  .filter((g) => (g.actions || []).length && !(g.actions || []).includes('删除')))
const headerFields = computed(() => {
  const fields = (cfgCache.value?.dataSchema?.fields || []).filter((field) => !field.hidden)
  const names = cfgCache.value?.metadata?.panelPageDto?.formPages?.[0]?.fieldNames
  if (!names) return fields
  const ordered = String(names).split(',').map((name) => name.trim()).filter(Boolean)
  const byName = new Map(fields.map((field) => [headerFieldKey(field), field]))
  return ordered.map((name) => byName.get(name)).filter(Boolean)
})
/** 附件类表头字段不进表头网格:单独「附件」区渲染,载入单据后常驻上传/查看 */
const attachFields = computed(() => (headerFields.value || []).filter((f) => f.dataType === '附件'))
const headerEditFields = computed(() => (headerFields.value || []).filter((f) => f.dataType !== '附件'))
/** 头表附件列位键(附件1..附件6):页面单格聚合,上传按序占第一个空余列位 */
const attachKeys = computed(() => attachFields.value.map((f) => headerFieldKey(f)))
const attachValues = computed(() => Object.fromEntries(attachKeys.value.map((k) => [k, cur.value[k] || ''])))
function applyAttachSlots(map) {
  Object.entries(map || {}).forEach(([k, v]) => { cur.value[k] = v })
}
/** RecordSheetPanels 专用:表头字段 + 明细字段(数据表列的 alias 从明细字段元数据取) */
const sheetAllFields = computed(() => {
  const header = headerFields.value || []
  const detail = cfgCache.value?.detail?.tabs?.[0]?.fields || []
  return [...header, ...detail]
})
const queryDialogFields = computed(() => {
  const fields = reportMode.value ? queryFields.value : headerEditFields.value
  return fields.filter((field) => headerFieldKey(field) !== '备注')
    // 级联面板(台账/库存状况):仓库/存货改用联动下拉(互相约束),不走通用参照控件
    .filter((field) => !(isCascadePanel.value && ['仓库', '存货'].includes(headerFieldKey(field))))
})
const draftEditable = computed(() => {
  if (reportMode.value || ['BOM_FWD', 'BOM_REV'].includes(String(panelCode.value))) return false
  // 规格书已分配:非 责任人∪总负责人∪管理员 只读(服务端三个入口同口径强制,这里提前置灰)
  if (specAssignBlocked.value) return false
  const st = cur.value?.['单据状态']
  if (st === '草稿') return true
  // 修改态(文件类:申请修改经管理员审批通过):可编辑,保存不再自动归档,走再审批
  if (st === '修改中') return true
  // 档案/单单据面板（存货档案、员工、部门、工艺路线等）：启用/停用状态列表页同样内联可编辑（2026-08-24）
  if ((cfgCache.value?.metadata?.singleDoc || cfgCache.value?.metadata?.panelCategory === '设置') && (st === '启用' || st === '停用')) return true
  return false
})
const newVisible = ref(false)
const approvalVisible = ref(false)
const approvalNo = ref('')
const selVisible = ref(false)
const impVisible = ref(false)
const impFields = ref([])
const impLabel = ref('明细')
const scanVisible = ref(false)
const selCfg = ref(null)
// 材料二维码标签(品检分流链:暂收单行 打印标签)
const qrVisible = ref(false)
const qrLabels = ref([])

function openQrLabels() {
  const rows = current.value?.detail?.items || []
  const doc = current.value?.['单据编号'] || current.value?.['编号'] || ''
  qrLabels.value = rows
    .filter((r) => r['批号'])
    .map((r) => ({ code: r['物料编码'], name: r['物料名称'], lot: r['批号'], qty: r['暂收数量'], unit: r['单位'], doc, qr: '' }))
  if (!qrLabels.value.length) {
    ElMessage.warning(tt('当前单据明细行均无批号——请先保存(保存时自动取批号)后再打印'))
    return
  }
  qrVisible.value = true
}

function selectConfigFor(action = '选单') {
  const cfg = cfgCache.value || {}
  const configs = cfg.selectConfigs || {}
  if (configs[action]) return configs[action]
  if (action === '选单') return cfg.selectConfig || Object.values(configs)[0]
  return null
}
const delMode = ref(false)
const delSel = ref([])

// 产成品→材料联动：当前选中产成品（列表页单据流览内点击产成品明细行）
const selectedProduct = ref(null)
const selectedBomCodes = ref([])

// 材料下级 BOM（红 * + 弹窗）：存货编码 → 物料清单 BOM 面板 children 子件行
const subBomMap = ref({})
const subBomVisible = ref(false)
const subBomMaterial = ref(null)
const subBomBom = ref([])

// ---------- 明细维护弹窗（主表双击行打开：在弹窗内维护该单明细，新增/删除/保存） ----------
const maintainVisible = ref(false)
const maintainRow = ref(null)
function openMaintain(row) {
  if (!row || row._placeholder) return
  maintainRow.value = row
  maintainVisible.value = true
}
function onMaintainSaved() {
  load()
}

// ---------- 单据浏览器：翻页切单据 ----------
const curIdx = ref(0)
const cur = computed(() => {
  const l = list.value
  if (!l.length) return {}
  return l[Math.min(curIdx.value, l.length - 1)]
})
const curNo = computed(() => (list.value.length ? Math.min(curIdx.value, list.value.length - 1) + 1 : 0))

// 产品开发下发按钮状态:随面板/当前单据变化刷新(必须在 cur 定义之后,immediate 会在 setup 时立即求值)
// 规格书分配状态(编辑闸门)同批加载:RD_SPEC_DOC 单据打开即取分配,决定只读与否
watch(() => [panelCode.value, cur.value?.['单据编号']], () => { loadDevDispatchState(); loadSpecDocAssign() }, { immediate: true })

// 文书默认值:文书面板的「新增」= directAdd 建一张空白草稿(库端 saved='N'),此时 draftEditable 为真,
// 本 watch 生效。锁定字段(申请立项人/负责人)只在「本次新增且尚未保存过」时带出——用 isFreshAddedDoc()
// 判定(跨刷新可靠),绝不在打开既有单据时改它,否则弃审后再打开会把申请人改成操作人(冒名)。
// 默认值真源见 core/panel/docDefaults.js
// 注意:watch getter 在 setup 时立即求值,必须位于 draftEditable/cur 定义之后
watch(
  () => [isApprovalDoc.value, draftEditable.value, cur.value?.['单据编号']],
  () => {
    if (!isApprovalDoc.value || !draftEditable.value || !cur.value) return
    applyDocDefaults(panelCode.value, cur.value, user, { isNew: isFreshAddedDoc(), today: todayStr() })
  },
)

watch(cur, (v) => {
  current.value = v
  markSavedSnapshot() // 基线快照跟随当前单据:静默切单后不重打会快照错位,导致后续误判"有未保存修改"
  detailRefVisible.value = false
  detailRefPick.value = null
  // 产成品→材料联动：默认不选中（点击产成品明细行才过滤材料明细），切换单据时重置
  if (selectedProduct.value) {
    selectedProduct.value = null
    selectedBomCodes.value = []
  }
})

/** 面板内切单守卫(翻页/点行):当前单有未保存修改时弹三态窗,干净则直切 */
async function guardDocSwitch(nextIdx) {
  if (nextIdx === curIdx.value) return
  if (guardAsking) return // 弹窗进行中:忽略后续切单动作,防绕过弹窗
  if (!hasUnsavedChanges()) { curIdx.value = nextIdx; return }
  guardAsking = true
  pendingLeave.value = null
  pendingAction = async () => { curIdx.value = Math.min(nextIdx, Math.max(0, list.value.length - 1)) }
  askUnsavedLeave()
}

/** 翻页动作守卫(含跨页):脏时弹三态窗,选择后执行原翻页逻辑 */
async function guardPageAction(run) {
  if (guardAsking) return // 弹窗进行中:忽略后续动作,防绕过弹窗
  if (!hasUnsavedChanges()) { await run(); return }
  guardAsking = true
  pendingLeave.value = null
  pendingAction = run
  askUnsavedLeave()
}

// ═══ 左侧「单据选择」栏(对齐 PANDA 暂收入库单选择):按面板启用,点行切换右侧当前单据 ═══
// 值=该单据左栏的中间列(重要字段);首列单号/次列日期/末列审核状态由下方组装兜底(键含各单据别名);
// 中间列支持字符串(行键)或列对象(derive 派生列,如采购入库的 ERP 状态)
const DOC_RAIL_PANELS = {
  SL_RECV: ['供应商', '部门'],        // 送料暂收单
  QC_INSP: ['供应商', '部门'],        // 来料检验单
  QC_RETURN: ['供应商', '部门'],      // 暂收退料单
  PU_ORDER: ['供应商'],          // 采购订单(币种列 2026-09-16 按用户口径删)
  PURCHASE_IN: ['供应商', {        // 采购入库单(入库类别列 2026-09-16 按用户口径换成 ERP 转入状态)
    label: 'ERP单', align: 'center', tag: true,
    // 已转=转ERP成功才有(ERP单号成功回填/弃审清空;是否已转ERP 未入 yj_field 不随行下发,作首选信号)
    derive: (row) => (String(row?.['是否已转ERP'] ?? '') === '是' || String(row?.['ERP单号'] ?? '').trim() !== '' ? '已转' : '未转'),
  }],
}
const docRailCfg = computed(() => {
  const middles = DOC_RAIL_PANELS[panelCode.value]
  if (!middles) return null
  const columns = [
    { label: '单号', keys: ['编号', '单据编号', '单号'], align: 'left', no: true },
    { label: '日期', keys: ['日期', '单据日期'], align: 'left' },
    ...middles.map((m) => (typeof m === 'string' ? { label: m, keys: [m], align: 'left' } : m)),
    { label: '审核状态', keys: ['单据状态'], align: 'center', tag: true },
  ]
  return { title: (panelName.value || '') + tt('选择'), columns }
})
const railCollapsed = ref(false)
const railCurNo = computed(() => {
  const c = cur.value || {}
  return String(c['编号'] || c['单据编号'] || c['单号'] || '')
})
function onRailSelect(idx) {
  guardPageAction(async () => { curIdx.value = idx })
}

async function page(delta) {
  const l = list.value
  if (!l.length) return
  const nxt = curIdx.value + delta
  if (nxt >= 0 && nxt < l.length) {
    await guardDocSwitch(nxt)
    return
  }
  if (delta > 0 && l.length < total.value) {
    await guardPageAction(async () => { query.pageNo += 1; await load(); curIdx.value = 0 })
    return
  }
  if (delta < 0 && query.pageNo > 1) {
    await guardPageAction(async () => { query.pageNo -= 1; await load(); curIdx.value = list.value.length - 1 })
    return
  }
  // 边界翻页（第 1 张点上一张/末张点下一张/仅 1 张）:动作为空,但当前草稿未保存仍需弹守卫——
  // 否则「新增后落在第 1 张点翻页」永远不触发提示(规范 §6.2);干净单据保持原样无感直过
  await guardPageAction(async () => {})
}

async function pageFirst() {
  if (!list.value.length) return
  await guardPageAction(async () => { if (query.pageNo > 1) { query.pageNo = 1; await load() } curIdx.value = 0 })
}

async function pageLast() {
  if (!list.value.length) return
  const lastPage = Math.max(1, Math.ceil(total.value / query.pageSize))
  await guardPageAction(async () => { if (query.pageNo < lastPage) { query.pageNo = lastPage; await load() } curIdx.value = list.value.length - 1 })
}

// ══════════ 明细区块模型（配置驱动，见 docs/frontend/前端面板设计.md）══════════
// 视图状态：view[blockId + ':tab'] = 当前页签 key；view[blockId + ':' + tabKey + ':view'] = 'detail' | 'summary'
const view = reactive({})
const blocks = computed(() => buildBlocks(cfgCache.value))

// ══════════ 主表预览表格（mainTable 配置，如工艺路线主表；点行切换当前单据，下方明细联动）══════════
const mainGrid = computed(() => {
  const tp = cfgCache.value?.metadata?.panelPageDto?.tablePages?.[0]
  return tp?.mainTable || null
})
const mainCols = computed(() => (mainGrid.value?.columns || []).filter((c) => c !== '序号'))
// ── 表头点击排序(2026-09-09 通用规则):每张表格自己一个排序状态,单键排序(点别的列覆盖前一列),升→降→取消 ──
// 明细块按 块id:页签 分别记状态;主表预览独立一份;报表沿用 reportCols.sort(后端持久化那套不动)。
const mainSort = reactive({ prop: '', order: '' })
const blockSorts = reactive({})
function blockSortOf(b) {
  const key = `${b.id}:${activeTab(b)?.key || ''}`
  if (!blockSorts[key]) blockSorts[key] = { prop: '', order: '' }
  return blockSorts[key]
}
/** 点击角标:升 → 降 → 取消(状态对象就地更新) */
function cycleSort(state, prop) {
  const next = nextSortState(state, prop)
  state.prop = next.prop
  state.order = next.order
}
/** 视图排序:占位行不参与;按字段类型选比较器;不改行数据、不改原数组 */
function sortViewRows(rows, state) {
  if (!state || !state.prop || !state.order) return rows
  return sortRows(rows.filter((r) => !r._placeholder), {
    prop: state.prop, order: state.order, field: fieldDefOf(state.prop),
  })
}
function sortCaret(state, prop) {
  if (!state || state.prop !== prop || !state.order) return '⇅'
  return state.order === 'asc' ? '▲' : '▼'
}
function isSortOn(state, prop) {
  return !!state && state.prop === prop && !!state.order
}
function resetTableSorts() {
  mainSort.prop = ''
  mainSort.order = ''
  Object.keys(blockSorts).forEach((key) => delete blockSorts[key])
}
// 报表表头沿用同一循环口径(底层仍是 reportCols.sort,栏目设置的后端持久化不变)
function cycleReportSort(prop) {
  const next = nextSortState(reportCols.sort, prop)
  reportCols.setSort(next.prop, next.order)
}
function reportSortCaret(prop) {
  if (reportCols.sort.prop !== prop || !reportCols.sort.order) return '⇅'
  return reportCols.sort.order === 'asc' ? '▲' : '▼'
}
function reportSortOn(prop) {
  return reportCols.sort.prop === prop && !!reportCols.sort.order
}
// 主表固定 5 行（不足补占位，与明细区一致）
const mainRows = computed(() => {
  const l = list.value
  if (!l.length) return []
  const filtered = applyAdvFilters(applyColFilters(l.map((r) => r), mainCols.value.map((c) => ({ prop: c }))))
  // 排序在取前 5 行之前:排序后看到的是"本页该字段前 5 条",而不是"前 5 条里再排"
  const rows = sortViewRows(filtered, mainSort).slice(0, 5)
  while (rows.length < 5) rows.push({ _placeholder: true })
  return rows
})
async function onMainRowClick(row) {
  const i = list.value.indexOf(row)
  if (i >= 0) await guardDocSwitch(i)
}
function mainRowCls({ row }) {
  if (row._placeholder) return 'ph-row'
  return row === cur.value ? 'row-cur' : ''
}

function buildBlocks(cfg) {
  if (!cfg) return []
  const tp = cfg.metadata?.panelPageDto?.tablePages?.[0]
  const gt = tp?.gridTabs || []
  const tabs = cfg.detail?.tabs || []
  const out = []
  const mkTab = (key, label, cols, summaryItems, sumLabel, hasSummary, columnAliases) => ({ key, label, cols, summaryItems, sumLabel, hasSummary, columnAliases })
  /** 从字段定义构造列别名(dataName→displayName),补 gridTabs 未覆盖的页签。 */
  const aliasesOfFields = (fields) => {
    const m = {}
    for (const f of fields || []) {
      if (f.displayName && f.dataName && f.displayName !== f.dataName) m[f.dataName] = f.displayName
    }
    return m
  }
  // A 区：优先 gridTabs[0]，其次 detail.tabs[0]（页签 = 明细 + 汇总）
  const first = tabs[0]
  const mainCols = gt[0]?.columns || (first ? (first.fields || []).filter((f) => !f.hidden).map((f) => f.dataName) : [])
  if (mainCols.length) {
    const sumItems = first?.summaryItems || []
    const label = gt[0]?.label || first?.label || '明细'
    const hasSummary = !!(gt.length > 1 && gt[1]?.summary) || sumItems.length > 0
    // 列别名:gridTabs.columnAliases(后端按 locale 供给)优先,detail 字段 displayName 兜底
    const mainAliases = { ...aliasesOfFields(first?.fields), ...(gt[0]?.columnAliases || {}) }
    out.push({
      id: 'A', isMain: true,
      tabs: [mkTab(first?.key || 'items', label, mainCols, sumItems, gt[1]?.label || (sumItems.length ? label + '汇总' : ''), hasSummary, mainAliases)],
    })
  }
  // B 区：detail.tabs[1..n] 合并为一个区块、页签内切换（同 T+：材料明细/工序明细共区块）
  const rest = tabs.slice(1).map((t) => {
    const cols = (t.fields || []).filter((f) => !f.hidden).map((f) => f.dataName)
    return cols.length ? mkTab(t.key, t.label, cols, t.summaryItems || [], t.summaryItems?.length ? t.label + '汇总' : '', !!(t.summaryItems?.length), aliasesOfFields(t.fields)) : null
  }).filter(Boolean)
  if (rest.length) out.push({ id: 'B', isMain: false, tabs: rest })
  return out
}

function activeTab(b) {
  const k = view[b.id + ':tab']
  return b.tabs.find((t) => t.key === k) || b.tabs[0]
}

function tabView(b, t) {
  return view[b.id + ':' + t.key + ':view'] === 'summary' ? 'summary' : 'detail'
}

// 页签头条目：明细页签 + 汇总页签 依次展开
function headItems(b) {
  const out = []
  for (const t of b.tabs) {
    out.push({ kind: 'tab', key: t.key, label: t.label })
    if (t.hasSummary) out.push({ kind: 'sum', key: t.key, label: t.sumLabel })
  }
  return out
}

function isOn(b, item) {
  const cur = activeTab(b)
  if (cur.key !== item.key) return false
  return item.kind === 'sum' ? tabView(b, cur) === 'summary' : tabView(b, cur) !== 'summary'
}

function switchTab(b, item) {
  view[b.id + ':tab'] = item.key
  view[b.id + ':' + item.key + ':view'] = item.kind === 'sum' ? 'summary' : 'detail'
}

// 明细数据：单据类取 cur.detail[block.key]；平铺类（档案/报表）把当前行当明细
function detailRows(b) {
  const d = cur.value.detail
  if (d && Array.isArray(d[b.key])) return d[b.key]
  if ((b.cols || []).some((c) => cur.value[c] !== undefined)) return [cur.value]
  return []
}

const KNOWN_NUM = ['数量', '实收数量', '报工数量', '合格数量', '不合格数量', '工价', '计时/计件金额', '金额', '含税金额', '含税单价', '单价', '税额', '现存量', '需用数量', '损耗数量', '计划数量', '累计领用数量', '齐套数量(主)', '累计汇报套数(工序单位)', '总重', '单重', '委外金额', '委外税额', '委外含税金额', '换算率', '可报工数量', '累计汇报数量']

function numericCols(rows, b) {
  const fromItems = (b.summaryItems || []).map((it) => it.field)
  const known = (b.cols || []).filter((c) => KNOWN_NUM.includes(c) && rows.every((r) => Number.isFinite(Number(r[c]))))
  return [...new Set([...fromItems, ...known])].filter((c) => (b.cols || []).includes(c))
}

function groupKeyOf(b) {
  return b.keyField || ['存货编码', '产品编码', '材料编码', '存货名称', '产品名称', '材料名称'].find((k) => (b.cols || []).includes(k)) || (b.cols || [])[0] || '编号'
}

// 汇总：按 编码/名称 分组 + 合计行（对齐 T+ 汇总页签）
function summaryRows(rows, b) {
  if (!rows.length) return []
  const keyField = groupKeyOf(b)
  const numeric = numericCols(rows, b)
  const group = new Map()
  for (const r of rows) {
    const k = r[keyField] || '(空)'
    if (!group.has(k)) {
      // 先剔除汇总字段再复制首行，避免分组行把首行原值又累加一次（翻倍 bug）
      const base = { ...r }
      for (const c of numeric) delete base[c]
      group.set(k, base)
    }
    const g = group.get(k)
    for (const c of numeric) g[c] = (g[c] || 0) + num(r[c])
  }
  const out = [...group.values()]
  const total = {}
  for (const c of numeric) total[c] = Math.round(rows.reduce((a, r) => a + num(r[c]), 0) * 100) / 100
  out.push({ [keyField]: '合计', ...total })
  return out
}

// 所有表格固定展示 5 行：不足补空占位行（{_placeholder:true}），超出 5 行鼠标滚动（见 docs/frontend/前端面板设计.md）
const MIN_ROWS = 5
const ROW_H = 31
const HEAD_H = 32
const FOOT_H = 32

function blockData(b) {
  const t = activeTab(b)
  let rows = detailRows(t)
  // 产成品→材料联动过滤：点产成品行后，材料明细只显示该产品的 BOM 子件（子件BOM 优先，材料编码兜底）
  if (t.key === 'materials' && selectedProduct.value) {
    const byBom = rows.filter((m) => m['子件BOM'] === selectedProduct.value)
    if (byBom.length) rows = byBom
    else {
      const byCode = rows.filter((m) => selectedBomCodes.value.includes(m['材料编码']))
      if (byCode.length) rows = byCode
    }
  }
  return tabView(b, t) === 'summary' ? summaryRows(rows, t) : rows
}

function blockRows(b) {
  const filtered = applyAdvFilters(applyColFilters(blockData(b).map((r) => r), blockCols(b)))
  // 视图排序(不改行数据):占位行在排序之后补,不参与比较
  const out = sortViewRows(filtered, blockSortOf(b))
  while (out.length < MIN_ROWS) out.push({ _placeholder: true })
  return out
}

// ═══ 档案大表分页渲染(2026-09-16):数据全量驻留内存(保存语义"缺席行=已删除"不变),
// DOM 只渲染当前页 —— 商品等几千行×几十列的档案页全量渲染会把 DOM 撑到十几万格导致整页卡死;
// 全部 singleDoc 档案面板(INV/KHDA/GFDA/EMP/WH/PARTNER/DEPT/UOM/REGION/ZDGL…)走同一通道自动生效。
// 分页器形态(用户口径):总数 + 每页条数下拉(默认100) + 左右箭头 + 输入跳页(不要数字页码按钮) ═══
const archPageSize = ref(50)
const ARCH_SIZE_OPTS = [50, 100, 200, 500]
const archPage = ref(1)
function onArchSizeChange() { archPage.value = 1 } // 换每页条数后回首页

// ═══ 物料二维码标签(勾选即打,2026-09-16):存货档案工具栏「二维码标签」按行勾选 → 80×80mm 标签 PDF。
// 勾选集自管(Set 换新触发响应式),跨页/跨筛选保留;行键 = 后端 metadata.qrLabelKey(存货编码),
// 同码行勾一个即代表该码(二维码内容相同;库里同码多行由后端查重守卫报错拦截) ═══
const qrSel = ref(new Set())
const qrKey = computed(() => cfgCache.value?.metadata?.qrLabelKey || '')
function qrRowKey(row) { return String(row?.[qrKey.value] ?? '').trim() }
function qrToggleRow(row) {
  const k = qrRowKey(row)
  if (!k) return
  const s = new Set(qrSel.value)
  if (s.has(k)) s.delete(k)
  else s.add(k)
  qrSel.value = s
}
function qrVisibleRows(b) { return pagedBlockRows(b).filter((r) => !r._placeholder) }
function qrPageAllChecked(b) {
  const rows = qrVisibleRows(b)
  return rows.length > 0 && rows.every((r) => qrSel.value.has(qrRowKey(r)))
}
function qrPageSomeChecked(b) {
  const rows = qrVisibleRows(b)
  return !qrPageAllChecked(b) && rows.some((r) => qrSel.value.has(qrRowKey(r)))
}
function qrTogglePage(b, on) {
  const s = new Set(qrSel.value)
  for (const r of qrVisibleRows(b)) {
    const k = qrRowKey(r)
    if (!k) continue
    if (on) s.add(k)
    else s.delete(k)
  }
  qrSel.value = s
}
/** 预览二维码标签:确认 → POST /report/qr-label(blob)→ 新窗口内打开 PDF(浏览器查看器可直接打印/另存)。
 *  2026-09-17 由直接下载改为预览优先,对齐「导出报表→打印预览」形态;失败体是 JSON,须按文本解析 message(如重复编码明细) */
async function exportQrLabels() {
  const codes = [...qrSel.value]
  if (!codes.length) return ElMessage.warning(tt('请先勾选要导出的商品'))
  try {
    await ElMessageBox.confirm(
      tt('已选 {n} 个商品，预览二维码标签？').replace('{n}', codes.length),
      tt('二维码标签'),
      { type: 'info', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
    )
  } catch { return }
  const win = window.open('', '_blank') // 先开窗口:await 之后再开会被浏览器判弹窗拦截
  const loading = ElMessage({ message: tt('正在生成标签…'), duration: 0 })
  try {
    const blob = await request.post('/report/qr-label', { codes }, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    if (win) win.location.href = url
    else ElMessage.warning(tt('浏览器拦截了新窗口，请允许弹出窗口'))
    ElMessage.success(tt('已打开标签预览，可直接打印或另存为 PDF'))
  } catch (e) {
    if (win) win.close()
    ElMessage.error(await qrBlobErrMsg(e) || tt('标签生成失败'))
  } finally {
    loading.close()
  }
}
/** blob 响应的错误体解析:失败时响应是 JSON(ApiResult),按 Blob.text() 读出 message 后展示 */
async function qrBlobErrMsg(e) {
  const data = e?.response?.data
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text())?.message || '' } catch { /* 非 JSON 走兜底 */ }
  }
  return e?.response?.data?.message || e?.message || ''
}
/** 档案行非响应化(2026-09-16 四期,入口卡顿主因):几千行×几十列被 Vue 深度代理
 *  (首次全量过滤/排序/快照访问 ≈29 万属性走 proxy get)是"点进页面转圈"的最大开销源(实测单一 4.4s 长任务)。
 *  将档案明细数组与行 markRaw 后,读取零代理;写入(编辑/带回/新增)经 markInlineDirty
 *  统一 bump archVersion 驱动视图与计算刷新——所有写路径本就必须置脏(守卫语义),天然闭环。
 *  ⚠ markRaw 必须打在原始对象上:打在 reactive 代理上无效(标记不落 target)。
 *  load 侧在赋给 list.value 之前处理(对象必然是原始的);本函数兜底带 ref 替换/追加的场景,经 toRaw 取原件。 */
const archVersion = ref(0)
function normalizeArchRaw() {
  if (!singleDocMode.value) return
  const doc = toRaw(cur.value || {})
  const detail = doc?.detail
  if (!detail) return
  let touched = false
  for (const rows of Object.values(detail)) {
    if (!Array.isArray(rows)) continue
    if (!rows.__v_skip) { markRaw(rows); touched = true }
    for (const r of rows) if (r && typeof r === 'object' && !r.__v_skip) { markRaw(r); touched = true }
  }
  if (touched) archVersion.value++
}
/** 载入的档案文档在进入响应式系统前预打 raw 标记(load 赋值 list.value 之前调用) */
function markArchListRaw(docs) {
  if (!singleDocMode.value || !Array.isArray(docs)) return
  const doc = docs[0]
  const detail = doc?.detail
  if (!detail) return
  for (const rows of Object.values(detail)) {
    if (!Array.isArray(rows)) continue
    markRaw(rows)
    for (const r of rows) if (r && typeof r === 'object') markRaw(r)
  }
}
/** 档案行计算缓存:一次响应式变更只过滤+排序一遍 —— 此前 archTotal/pagedBlockRows/sumMethodFor/
 *  分页器/表格高度各自调 blockRows,每次渲染对几千行重复跑 4~5 遍过滤+排序,交互卡顿主因之一 */
const archRowsMap = computed(() => {
  const m = {}
  if (!singleDocMode.value) return m
  void archVersion.value // 档案行 markRaw 后值变化无响应依赖,以版本号驱动重算(markInlineDirty/load 时 bump)
  const detail = cur.value?.detail
  if (detail) void Object.keys(detail).length
  for (const b of blocks.value) m[b.id] = blockRows(b)
  return m
})
function archRows(b) { return singleDocMode.value ? (archRowsMap.value[b.id] ?? blockRows(b)) : blockRows(b) }
function archTotal(b) { return archRows(b).filter((r) => !r._placeholder).length }
/** 档案列/列宽计算缓存(2026-09-16 三期):blockCols 内含 fieldDefOf 线性扫描,此前每次渲染
 *  被调 1(v-for)+N(archColW 逐列)次,商品 75 列 ≈ 5800 次字段扫描;缓存后一次变更只构建一遍 */
const archColsMap = computed(() => {
  const m = {}
  if (!singleDocMode.value) return m
  for (const b of blocks.value) {
    const cols = blockCols(b)
    const widths = new Map()
    if (cols.length <= ARCH_FIT_MAX_COLS && detailW.value) {
      const avail = detailW.value - (delMode.value ? 47 : 0)
      const sum = cols.reduce((a, x) => a + (Number(x.width) || 100), 0)
      const raw = cols.map((x) => Math.max(48, Math.round(((Number(x.width) || 100) / sum) * avail)))
      // 最小列宽钳制可能让合计偏离容器宽:差额多退少补全落到最宽列,保证恰好铺满
      const diff = avail - raw.reduce((a, v) => a + v, 0)
      if (diff !== 0) {
        const idx = raw.indexOf(Math.max(...raw))
        raw[idx] = Math.max(48, raw[idx] + diff)
      }
      cols.forEach((x, i) => widths.set(x.prop, raw[i]))
    }
    m[b.id] = { cols, widths }
  }
  return m
})
function archCols(b) { return singleDocMode.value ? (archColsMap.value[b.id]?.cols ?? blockCols(b)) : blockCols(b) }
/** 档案块可编辑性缓存:模板每格 v-if 原先调 detailEditable(b)(多层 computed 链)×3750 格;
 *  缓存后每块一次,状态变化经 computed 依赖自动刷新 */
const archEditableMap = computed(() => {
  const m = {}
  if (!singleDocMode.value) return m
  for (const b of blocks.value) m[b.id] = detailEditable(b)
  return m
})
function archEditable(b) { return singleDocMode.value ? (archEditableMap.value[b.id] ?? detailEditable(b)) : detailEditable(b) }
/** 列懒渲染(2026-09-16 五期):超宽档案(列>16 走横向滚动,如商品 75 列/表宽 7532px vs 视口 1042px)
 *  只渲染视口±半屏内的列内容,视口外列渲染空占位(表头保留撑住列宽与滚动条)——
 *  首渲染从 3750 格降到 ~1000 格,翻页同理;横向滚动时按需补渲染。
 *  响应式行/列缓存已在位,这里只控制 default 插槽是否产出内容。 */
const archViewport = reactive({ left: -1, w: 1042, expand: false })
const COL_LAZY_MIN = ARCH_FIT_MAX_COLS + 1
// 两段渲染:首帧只出窄窗口(视口+0.3屏)快速见内容,120ms 后扩到常规窗口(±半屏)补齐,
// 把 75 列首渲染的长任务拆成两段短任务,页面更早可交互
let colExpandTimer = 0
function scheduleColExpand() {
  archViewport.expand = false
  clearTimeout(colExpandTimer)
  colExpandTimer = setTimeout(() => { archViewport.expand = true }, 120)
}
watch(panelCode, scheduleColExpand)
// 查询弹窗面板(收发存/台账):切换面板重置(重新进入需再过条件弹窗)
watch(panelCode, () => {
  rqdDone.value = false
  rqdRange.value = []
  ledgerWhOptions.value = []
  ledgerItemOptions.value = []
})
onMounted(scheduleColExpand)
function archLazyOn(b) { return singleDocMode.value && archCols(b).length >= COL_LAZY_MIN }
let colLazyRaf = 0
function onArchScroll(e, b) {
  if (!archLazyOn(b)) return
  const el = e.target
  if (!el || el.scrollWidth <= el.clientWidth) return
  if (colLazyRaf) return
  colLazyRaf = requestAnimationFrame(() => {
    colLazyRaf = 0
    archViewport.left = el.scrollLeft
    archViewport.w = el.clientWidth || 1042
  })
}
function archColVisible(b, c) {
  if (!archLazyOn(b)) return true
  const cols = archCols(b)
  const widths = archColsMap.value[b.id]?.widths
  let x = 0
  for (const k of cols) {
    const w = widths?.get(k.prop) ?? Number(k.width) ?? 100
    if (k.prop === c.prop) {
      const base = Math.max(0, archViewport.left)
      const head = archViewport.left < 0 ? 0.3 : 0.5
      const tail = archViewport.left < 0 ? 0.3 : 1
      const win = archViewport.expand ? { head: 0.5, tail: 1.5 } : { head, tail }
      return x + w >= base - archViewport.w * win.head && x <= base + archViewport.w * win.tail
    }
    x += w
  }
  return true
}
function archCurPage(b) { return Math.min(archPage.value, Math.max(1, Math.ceil(archTotal(b) / archPageSize.value))) }
function pagedBlockRows(b) {
  const rows = archRows(b)
  if (!singleDocMode.value) return rows
  const real = rows.filter((r) => !r._placeholder)
  if (real.length <= archPageSize.value) return rows
  const start = (archCurPage(b) - 1) * archPageSize.value
  return real.slice(start, start + archPageSize.value)
}
/** 档案分页时合计行仍按全量行计算,不随当前页截断;
 *  合计值走 archSums 缓存(全量行×数值列只算一遍)——此前每次翻页 el-table 重算合计,
 *  对 3850行×75列 做 ~28 万次 Number(),是翻页卡顿主因 */
const archSumsMap = computed(() => {
  const m = {}
  if (!singleDocMode.value) return m
  for (const b of blocks.value) {
    const sums = {}
    for (const c of archCols(b)) {
      const f = c.field
      if (f && (f.dataType === '小数' || f.dataType === '整数')) {
        let acc = 0
        let has = false
        for (const r of archRows(b)) {
          if (r._placeholder) continue
          const v = Number(r[c.prop])
          if (Number.isFinite(v)) { acc += v; has = true }
        }
        sums[c.prop] = has ? Math.round(acc * 100) / 100 : ''
      }
    }
    m[b.id] = sums
  }
  return m
})
function sumMethodFor(b, p) {
  const sums = singleDocMode.value ? archSumsMap.value[b.id] : null
  if (!sums) return sumMethod(p)
  const { columns } = p
  const out = []
  columns.forEach((col, i) => { out[i] = i === 0 ? tt('合计') : (sums[col.property] ?? '') })
  return out
}
/** 档案列铺满边框(2026-09-16):列数可容纳(≤ARCH_FIT_MAX_COLS)时按原列宽比例把容器宽度
 *  分配为像素列宽(EP 列宽不支持百分比,parseWidth 会吞掉 %),表格恒等于容器宽、无横向滚动;
 *  列过多(如商品 75 列)返回 undefined,保持像素宽+横向滚动。宽度随窗口缩放自动重算。 */
const ARCH_FIT_MAX_COLS = 16
const detailW = ref(0)
const bodyH = ref(0)
function measureDetailW() {
  const el = document.querySelector('.panelx-list .detail')
  detailW.value = el ? el.clientWidth - 2 /*左右边框*/ : 0
  const body = document.querySelector('.panelx-list .body')
  bodyH.value = body ? body.clientHeight : 0
}
let detailRO = null
onMounted(() => {
  nextTick(measureDetailW)
  // ResizeObserver 监听根容器:窗口缩放/侧栏拖拽等一切布局变化都触发重测(比 window.resize 可靠)
  const root = document.querySelector('.panelx-list')
  if (root && window.ResizeObserver) {
    detailRO = new ResizeObserver(() => measureDetailW())
    detailRO.observe(root)
  }
  window.addEventListener('resize', measureDetailW)
})
onUnmounted(() => { detailRO?.disconnect(); window.removeEventListener('resize', measureDetailW) })
watch(loading, () => !loading.value && nextTick(measureDetailW))
function archColW(b, c) {
  if (!singleDocMode.value) return undefined
  return archColsMap.value[b.id]?.widths.get(c.prop) // 列宽缓存一次构建(含铺满/多退少补),逐列读取 O(1)
}

function tableH(b) {
  const hasFooter = tabView(b, activeTab(b)) !== 'summary'
  // 档案页(2026-09-16):表格高度填充 .body 可用高度(到表尾备注区为止,不越过)——
  // 固定 5 行高在小数据时下方大片空白,大数据时又只有 5 行视口
  if (singleDocMode.value && bodyH.value) {
    const pagerH = archTotal(b) > ARCH_SIZE_OPTS[0] ? 40 : 0
    return Math.max(HEAD_H + MIN_ROWS * ROW_H + (hasFooter ? FOOT_H : 0), bodyH.value - 8 - 2 - 33 - pagerH - 10)
  }
  return HEAD_H + MIN_ROWS * ROW_H + (hasFooter ? FOOT_H : 0)
}

function blockCols(b) {
  const t = activeTab(b)
  const aliases = t.columnAliases || {}
  return (t.cols || []).map((c) => {
    const f = fieldDefOf(c)
    return {
      prop: c,
      label: aliases[c] || tt(c),
      field: f,
      width: colW(f),
      align: f.dataType === '小数' || f.dataType === '整数' ? 'right' : 'left',
    }
  })
}

const showFooter = computed(() => {
  // 文书式面板(立项申请):不按表头/表中/表尾三段式,页脚(备注+审核行)整体隐藏
  if (isApprovalDoc.value) return false
  const cfg = cfgCache.value
  return cfg?.metadata?.panelCategory === '单据' || (cfg?.detail?.tabs || []).length > 0
})

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function sumMethod({ columns, data }) {
  const sums = []
  // 占位行不参与合计
  const real = (data || []).filter((r) => !r._placeholder)
  columns.forEach((col, i) => {
    if (i === 0) {
      sums[i] = tt('合计')
      return
    }
    // 只对「小数/整数」类型的字段求和：纯数字文本（身份证号/手机号/编码）不参与合计
    const f = fieldDefOf(col.property)
    const isNumeric = f && (f.dataType === '小数' || f.dataType === '整数')
    // NaN 过滤:三段式台账的期初/期末合成行大量缺键(Number(undefined)=NaN),
    // 旧行为 every(isFinite) 会因一行的缺失清空整列合计(合计消失的根因)
    const vals = real.map((r) => Number(r[col.property])).filter((v) => Number.isFinite(v))
    if (!isNumeric || !vals.length) { sums[i] = ''; return }
    // 台账三段式:期初列合计=首值(期初),期末列合计=末值(期末结存);累计值求和无意义
    if (panelCode.value === 'STOCK_LEDGER' && String(col.property || '').startsWith('期初')) {
      sums[i] = vals[0]
      return
    }
    if (panelCode.value === 'STOCK_LEDGER' && String(col.property || '').startsWith('期末')) {
      sums[i] = vals[vals.length - 1]
      return
    }
    sums[i] = Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100
  })
  return sums
}

// 审批流：当前单据已审批 → 表格左上角「已审批」角标；已审批明细行浅绿底色
// 判据统一(2026-09-11):后端 QueryService 只产 '已通过'(shr 非空)/'审批中',历史数据里也有 '已审批',
// 两值都认;禁止各处再手写单值比较(口径见 CONTEXT.md「已审批判据」)。
const APPROVED_STATUS_VALUES = ['已审批', '已通过']
const isApproved = computed(() => cur.value && APPROVED_STATUS_VALUES.includes(cur.value['审批状态']))

function rowCls({ row }, b) {
  if (row._placeholder) return 'ph-row'
  if (b && b.id === 'A' && row['产品编码'] && row['产品编码'] === selectedProduct.value) return 'prod-selected'
  if (APPROVED_STATUS_VALUES.includes(row['审批状态'])) return 'row-approved'
  return ['产品编码', '材料编码', '存货编码', '存货名称', '产品名称', '材料名称'].some((k) => row[k] === '合计') ? 'sum-row' : ''
}

// ---------- 明细表格列宽（按字段类型推算，横向滚动同 T+） ----------
function colW(f) {
  const t = f.dataType || '文本'
  if (t === '是否') return 74
  if (t === '图片') return 56
  if (t === '小数' || t === '整数') return 104
  if (t === '日期' || t === '日期时间') return 136
  const n = f.label || f.dataName || ''
  return n.length <= 2 ? 96 : Math.min(Math.max(n.length * 16 + 30, 96), 220)
}

// ---------- 明细右键/图标操作（作用于当前活动区块） ----------
const ctxItems = ['定位', '复制到剪贴板', '从剪贴板粘贴', '另存为EXCEL模板', '批量修改', '销售订单查询', '存货中心', '更多']
const iconA = ['☑ Ctrl+V列粘贴', '定位', '复制到剪贴板', '从剪贴板粘贴', '另存为EXCEL模板', '批量修改', '销售订单查询', '存货中心', '更多▼']
const iconB = ['现存量提取', '定位', '复制到剪贴板', '从剪贴板粘贴', '另存为EXCEL模板', '批量修改', '更多▼']

const ctxBlock = ref(null)
const ctx = reactive({ visible: false, x: 0, y: 0, row: null })

const activeCols = computed(() => (ctxBlock.value ? blockCols(ctxBlock.value) : []))
const activeData = computed(() => (ctxBlock.value ? blockData(ctxBlock.value) : []))

function onCtx(ev, row, b) {
  ev.preventDefault()
  ev.stopPropagation()
  ctxBlock.value = b
  ctx.row = row
  ctx.x = ev.clientX
  ctx.y = ev.clientY
  ctx.visible = true
}

function closeCtx() {
  ctx.visible = false
  openGroup.value = -1
  openDelMenu.value = false
}

// ---------- 审批按钮权限（提交审批/审批情况公开；审批通过/驳回需角色审批权限） ----------
const APPROVE_ACTIONS = ['审批通过', '审批驳回']
function filterGroups(raw) {
  const canApprove = user.isAdmin || user.approvePanels.includes(panelCode.value)
  if (canApprove) return raw
  return (raw || [])
    .map((g) => ({ ...g, actions: (g.actions || g.items || []).filter((a) => !APPROVE_ACTIONS.includes(a)) }))
    .filter((g) => (g.actions || []).length > 0)
}

// ---------- 工具栏分组（配置 {name, actions}：主按钮=第一个 action，actions>1 显示 ▼ 下拉） ----------
const openGroup = ref(-1)
function actsOf(g) {
  return g.actions || g.items || []
}
// 下拉项 = 除主按钮（第一个 action）外的其余动作（2026-08-20：避免下拉与组按钮重复）
function dropItems(g) {
  return actsOf(g).slice(1)
}
function btnName(g) {
  return actsOf(g)[0] || g.name
}
function toggleGroup(gi) {
  openGroup.value = openGroup.value === gi ? -1 : gi
}
function onGroupAction(a) {
  openGroup.value = -1
  // 2026-08-25：灰按钮（如草稿态「生成XX」）点击不执行、不弹提示
  if (isDisabled(a)) return
  onButton(a)
}

// 文书面板右侧操作栏:默认展开,可收纳(收起为窄条,点击标题切换)
const sideCollapsed = ref(false)
// ══════════ 文书式面板:导出 = 整张文书打印/存PDF(浏览器原生,所见即所得) ══════════
const approvalSheetRef = ref(null)
/** 删除组下拉动作:收起菜单后走统一入口(删除带整单确认) */
function pickDelAction(a) {
  openDelMenu.value = false
  onSideAction(a)
}
function onSideAction(a) {
  // 导出:文书面板=选择格式导出(PDF/Excel 分离,打印按钮独立);控制列表=完整 Excel(全字段+全数据)
  if (isApprovalDoc.value && a === '导出') {
    exportFmtVisible.value = true
    return
  }
  // 删除确认与整单语义统一在 onButton(isApprovalDoc 分支)处理
  if (isDisabled(a)) return
  onButton(a)
}

// ── 文书面板导出:格式选择(PDF / Excel);打印为独立按钮不经过这里 ──
const exportFmtVisible = ref(false)
/** 导出 PDF:浏览器内直接生成 .pdf 下载,不弹打印对话框/无需打印机。
 *  页面尺寸=纸张实际尺寸单页输出(不套 A4)。截图用 modern-screenshot(SVG foreignObject,
 *  无 iframe 克隆)——根治 html2canvas 的 "Unable to find element in cloned iframe"。
 *  宽表(压降/精度等 ~1300px)整张不截的关键:**离屏克隆 + 按纸宽强制布局**——
 *  根节点 max-width:100% 在窄窗下 computed width 被压缩,直接截原元素时 foreignObject
 *  里的克隆树仍按窄宽排版(画布再宽也只排半张);克隆体显式定宽+去 max-width 再截,一次到位。 */
async function exportSheetPdf() {
  exportFmtVisible.value = false
  // $el 在 dev 下可能是 fragment 注释锚点(组件含多个 append-to-body 弹窗)——不是元素时按纸张根类名兜底
  const el0 = approvalSheetRef.value?.$el
  const el = el0 instanceof HTMLElement && el0.offsetWidth > 0 ? el0 : document.querySelector(
    '.approval-layout .record-sheet, .approval-layout .approval-sheet, .approval-layout .progress-sheet')
  if (!el || !(el instanceof HTMLElement)) return ElMessage.warning(tt('未找到可导出的单据'))
  const loadingMsg = ElMessage({ message: tt('正在生成 PDF…'), duration: 0 })
  let holder = null
  try {
    const [{ domToPng }, { jsPDF }] = await Promise.all([import('modern-screenshot'), import('jspdf')])
    await nextTick()
    // 纸宽=scrollWidth(max-width:100% 压缩 offsetWidth 时,内容横向溢出,scrollWidth 才是整张纸)
    const w0 = Math.max(el.scrollWidth, el.offsetWidth)
    holder = document.createElement('div')
    holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${w0}px;background:#ffffff;`
    const clone = el.cloneNode(true)
    clone.style.width = w0 + 'px'
    clone.style.maxWidth = 'none'
    clone.style.overflow = 'visible'
    holder.appendChild(clone)
    document.body.appendChild(holder)
    // 双 raf:等克隆体按全宽完成重排再量高(窄窗换行多,原元素高度偏大;全宽布局高度才是纸高)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const h0 = Math.max(clone.scrollHeight, clone.offsetHeight, el.scrollHeight)
    const scale = 2
    const dataUrl = await domToPng(clone, {
      scale,
      backgroundColor: '#ffffff',
      width: w0,
      height: h0,
      // 隐藏编辑态元素(字段编辑/标准库/终止横幅等),与打印口径一致
      filter: (node) => !(node instanceof HTMLElement && node.classList?.contains?.('no-print')),
    })
    // 页面尺寸用 mm + 自算 96dpi 换算(1px=25.4/96mm):jsPDF 的 px 单位换算因子与 CSS 不一致,
    // 会标出 598×980mm 巨页、内容只占一部分(边框缩成发丝看不见)——mm 直算保证页面=纸张真实物理尺寸
    const MM = 25.4 / 96
    const pw = w0 * MM
    const ph = h0 * MM
    const pdf = new jsPDF({ orientation: pw > ph ? 'l' : 'p', unit: 'mm', format: [pw, ph], compress: true })
    pdf.addImage(dataUrl, 'PNG', 0, 0, pw, ph)
    const no = cur.value?.['单据编号'] || cur.value?.['编号'] || ''
    pdf.save(`${panelName.value}-${no || '导出'}.pdf`)
    ElMessage.success(tt('已导出') + ' PDF')
  } catch (e) {
    console.error('pdf-export failed', e)
    ElMessage.error(tt('导出失败'))
  } finally {
    if (holder) holder.remove()
    loadingMsg.close()
  }
}
/** 导出 Excel(.xlsx):当前单据 头字段键值 + 各明细页签(全字段全数据,不受纸张限制);控制列表走专属导出 */
async function exportSheetExcel() {
  exportFmtVisible.value = false
  if (panelCode.value === 'RD_PROGRESS') {
    const sheet = approvalSheetRef.value
    if (sheet && typeof sheet.exportProgressExcel === 'function') {
      try {
        sheet.exportProgressExcel()
        ElMessage.success(tt('已导出') + ' Excel')
      } catch (e) {
        console.error('progress-excel-export failed', e)
        ElMessage.error(tt('导出失败'))
      }
      return
    }
  }
  try {
    const XLSX = await import('xlsx')
    const head = cur.value || {}
    const no = head['单据编号'] || head['编号'] || ''
    const name = String(panelName.value || panelCode.value)
    const aoa = [
      [`${name}${no ? '　' + no : ''}`],
      [`惠州市银嘉环保科技有限公司　　单据编号：${no || ''}　　单据状态：${tt(String(head['单据状态'] || ''))}`],
      [],
    ]
    // 头字段键值(显示名=别名优先)
    const sysKeys = new Set(['编号', '单据状态', 'saved', 'detail', '审核人', '审核时间', '审批状态', '提交人', '提交时间'])
    for (const f of headerFields.value || []) {
      const k = headerFieldKey(f)
      if (sysKeys.has(k)) continue
      aoa.push([headerFieldLabel(f) || k, String(head[k] ?? '')])
    }
    aoa.push([])
    // 各明细页签(全字段全数据;隐藏列略)
    const tabs = cfgCache.value?.detail?.tabs || []
    for (const t of tabs) {
      const rows = (head?.detail?.[t.key]) || []
      if (!Array.isArray(rows) || !rows.length) continue
      const cols = (t.fields || []).filter((f) => !f.hidden && (f.dataName || f.code))
      aoa.push([`${t.label || t.key}（${rows.length} ${tt('行')}）`])
      aoa.push(cols.map((f) => f.displayName || f.dataName || f.code))
      for (const r of rows) aoa.push(cols.map((f) => String(r[f.dataName || f.code] ?? '')))
      aoa.push([])
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 24 }, { wch: 36 }, { wch: 18 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, (name || '单据').slice(0, 28))
    XLSX.writeFile(wb, `${name}-${no || '导出'}.xlsx`)
    ElMessage.success(tt('已导出') + ' Excel')
  } catch (e) {
    ElMessage.error(tt('导出失败'))
  }
}
async function printApprovalSheet() {
  if (!approvalSheetRef.value) return
  // 打印样式(approval-printing):只打印文书纸张,隐藏侧栏/其它页面元素
  document.body.classList.add('approval-printing')
  const restore = () => {
    document.body.classList.remove('approval-printing')
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  // 等样式生效后调打印预览(用户可另存为 PDF 或打印)
  setTimeout(() => window.print(), 150)
}

// ══════════ 单据打印版式(2026-09-15):宽明细表 A4 纸面优化 ══════════
// 标准单据面板打印不再直出屏幕 DOM(el-table 固定列宽,字段一多打印必然横向截断),
// 改走 .doc-print 纯表格打印层:数据与 A 区同源(同 tab/同过滤排序),仅版式为打印优化。
const docPrintEnabled = computed(() => {
  if (isApprovalDoc.value || reportMode.value || isBomMasterPanel.value) return false
  return (cfgCache.value?.detail?.tabs || []).length > 0
})
const docPrintBlock = computed(() => blocks.value.find((b) => b.isMain) || blocks.value[0] || null)
const docPrintHead = computed(() => (headerEditFields.value || []).filter((f) => !f.hidden))
const docPrintRows = computed(() => {
  const b = docPrintBlock.value
  if (!b) return []
  return blockRows(b).filter((r) => !r._placeholder)
})
// 宽表列合并对(两列同时存在才合并;如 来料检验单 物料名称/型号、合格数量/不良数量)
const DOC_PRINT_MERGE_PAIRS = [['物料名称', '型号'], ['合格数量', '不良数量']]
/** 列宽基准(按中文列名关键词,与界面语言无关);打印前归一化为百分比 */
function dpBaseW(prop) {
  if (/序号/.test(prop)) return 4
  if (/描述|备注/.test(prop)) return 12
  if (/编码|代码|单号/.test(prop)) return 8
  if (/名称/.test(prop)) return 10
  if (/型号|规格/.test(prop)) return 7
  if (/日期/.test(prop)) return 7
  if (/金额|税额|总额/.test(prop)) return 6
  if (/数量|箱数|合格|不良/.test(prop)) return 5.5
  if (/单价|折扣|税率/.test(prop)) return 5
  return 6
}
const docPrintCols = computed(() => {
  const b = docPrintBlock.value
  if (!b) return []
  const cols = blockCols(b)
  const props = cols.map((c) => c.prop)
  const consumed = new Set()
  const out = [{ title: tt('序号'), base: 4, text: (_r, i) => String(i + 1) }]
  for (const c of cols) {
    if (consumed.has(c.prop)) continue
    const pair = DOC_PRINT_MERGE_PAIRS.find(([x, y]) => x === c.prop && props.includes(y))
    if (pair) {
      const cy = cols.find((z) => z.prop === pair[1])
      consumed.add(pair[1])
      out.push({
        title: c.label + ' / ' + cy.label,
        base: dpBaseW(c.prop) + dpBaseW(cy.prop),
        text: (r) => [r[c.prop], r[cy.prop]]
          .map((v) => (v ?? '') === '' ? '' : String(v))
          .filter((s) => s !== '')
          .join(' / '),
      })
      continue
    }
    out.push({ title: c.label, base: dpBaseW(c.prop), text: (r) => formatFieldValue(c.field, r[c.prop]) })
  }
  const total = out.reduce((s, c) => s + c.base, 0) || 1
  for (const c of out) c.pct = Math.round((c.base / total) * 1000) / 10
  return out
})
/** 打印前置:挂 body 样式 + 注入 @page 规则(列数≥8 横向,否则纵向;@page 不响应类选择器,只能动态注入) */
function prepareDocPrint() {
  document.body.classList.add('doc-printing')
  const wide = docPrintCols.value.length >= 8
  let st = document.getElementById('doc-print-page')
  if (!st) {
    st = document.createElement('style')
    st.id = 'doc-print-page'
    document.head.appendChild(st)
  }
  st.textContent = wide
    ? '@page { size: A4 landscape; margin: 9mm 8mm; }'
    : '@page { size: A4 portrait; margin: 12mm 10mm; }'
}
function onBeforePrintDoc() {
  // Ctrl+P 直打印也要走打印版式(beforeprint 在快照前同步触发)
  if (docPrintEnabled.value) prepareDocPrint()
}
function onAfterPrintDoc() {
  document.body.classList.remove('doc-printing')
}

// ══════════ 对外正式报表(后端 JasperReports 模板;IT 做版式,业务只选单据/格式) ══════════
// 与上面的「导出」不是一回事:上面是浏览器内基于当前屏幕纸张生成(所见即所得),
// 这里是后端按 IT 维护的 .jrxml 重新排版(A4 + 公司抬头 + 页眉页脚 + 页码),用于对外正式文件。
const reportTemplates = ref([])
const reportVisible = ref(false)

/** 该面板有没有服务端报表模板(模板表 reports/report-templates.properties 决定)——有才显示入口 */
async function loadReportTemplates() {
  try {
    const res = await request.get('/report/templates', { params: { panelCode: panelCode.value } })
    reportTemplates.value = Array.isArray(res?.data) ? res.data : []
  } catch (e) {
    reportTemplates.value = [] // 报表是增量能力,取不到就当没有,不影响面板本身
  }
}

// ══════════ 模板选择 + 报表模板管理(仅管理员;ADR-0002) ══════════
const selectedReportCode = ref('')
watch(reportTemplates, (list) => {
  if (!list?.length) { selectedReportCode.value = ''; return }
  if (!list.some((t) => t.code === selectedReportCode.value)) selectedReportCode.value = list[0].code
}, { immediate: true })

const manageVisible = ref(false)
const manageList = ref([])
const uploadFormVisible = ref(false)
const uploading = ref(false)
const uploadForm = ref({ templateCode: '', name: '', panelCode: '', remark: '' })
let uploadJrxml = ''

function openManage() {
  manageVisible.value = true
  loadManageList()
}
async function loadManageList() {
  try {
    const res = await request.get('/report/templates', { params: { all: true } })
    manageList.value = Array.isArray(res?.data) ? res.data : []
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('加载模板列表失败'))
  }
}
function onRptFile(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    uploadJrxml = String(ev.target.result || '')
    const base = file.name.replace(/\.(jrxml|xml)$/i, '')
    if (!uploadForm.value.templateCode) {
      uploadForm.value.templateCode = base.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '')
    }
    if (!uploadForm.value.name) uploadForm.value.name = base
  }
  reader.readAsText(file, 'utf-8')
}
async function submitUpload() {
  const f = uploadForm.value
  if (!uploadJrxml) return ElMessage.warning(tt('请先选择 .jrxml 模板文件'))
  if (!f.templateCode || !f.name || !f.panelCode) return ElMessage.warning(tt('编码/名称/绑定面板不能为空'))
  uploading.value = true
  try {
    await request.post('/report/templates', { templateCode: f.templateCode, panelCode: f.panelCode, name: f.name, remark: f.remark, jrxml: uploadJrxml })
    ElMessage.success(tt('模板已上传并启用'))
    uploadFormVisible.value = false
    uploadForm.value = { templateCode: '', name: '', panelCode: panelCode.value, remark: '' }
    uploadJrxml = ''
    await loadManageList()
    await loadReportTemplates()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('上传失败'))
  } finally {
    uploading.value = false
  }
}
async function toggleTpl(row) {
  try {
    await request.put(`/report/templates/${row.id}/enabled`, null, { params: { enabled: row.enabled ? 'N' : 'Y' } })
    await loadManageList()
    await loadReportTemplates()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('操作失败'))
  }
}
async function removeTpl(row) {
  try {
    await ElMessageBox.confirm(`确认删除模板「${row.name}」？删除后不可恢复。`, tt('删除确认'), { type: 'warning' })
  } catch { return }
  try {
    await request.delete(`/report/templates/${row.id}`)
    ElMessage.success(tt('已删除'))
    await loadManageList()
    await loadReportTemplates()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('删除失败'))
  }
}
function previewTpl(row) {
  const no = curDocNo.value
  if (!no) return ElMessage.warning(tt('请先在列表勾选一张单据（预览用其数据渲染）'))
  request.get('/report/export', {
    params: { code: row.code, panelCode: row.panelCode, docNo: no, format: 'pdf', disposition: 'inline' },
    responseType: 'blob',
  }).then((blob) => {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }).catch((e) => ElMessage.error(engine.errMsg(e) || tt('预览失败')))
}
/** 取报表字节(Blob);失败由调用方提示 */
function fetchReportBlob(fmt) {
  return request.get('/report/export', {
    params: {
      code: selectedReportCode.value || reportTemplates.value[0]?.code,
      panelCode: panelCode.value,
      docNo: curDocNo.value,
      format: fmt,
    },
    responseType: 'blob',
  })
}

/** 下载报表:PDF / Excel(.xlsx),文件名由后端 Content-Disposition 给,这里按同口径命名 */
async function downloadReport(fmt) {
  const no = curDocNo.value
  if (!no) return ElMessage.warning(tt('未找到可导出的单据'))
  reportVisible.value = false
  const loading = ElMessage({ message: tt('正在生成报表…'), duration: 0 })
  try {
    const blob = await fetchReportBlob(fmt)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportTemplates.value.find((t) => t.code === selectedReportCode.value)?.name || '报表'}-${no}.${fmt === 'xlsx' ? 'xlsx' : 'pdf'}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    ElMessage.success(tt('已导出') + ' ' + (fmt === 'xlsx' ? 'Excel' : 'PDF'))
  } catch (e) {
    ElMessage.error(tt('报表生成失败'))
  } finally {
    loading.close()
  }
}

/** 打印预览:先同步开窗口占位(否则 await 之后新窗口会被浏览器拦截),拿到 PDF 再指向它 */
async function previewServerReport() {
  const no = curDocNo.value
  if (!no) return ElMessage.warning(tt('未找到可导出的单据'))
  reportVisible.value = false
  const win = window.open('', '_blank')
  const loading = ElMessage({ message: tt('正在生成报表…'), duration: 0 })
  try {
    const blob = await fetchReportBlob('pdf')
    const url = URL.createObjectURL(blob)
    if (win) win.location.href = url
    else ElMessage.warning(tt('浏览器拦截了新窗口，请允许弹出窗口'))
  } catch (e) {
    if (win) win.close()
    ElMessage.error(tt('报表生成失败'))
  } finally {
    loading.close()
  }
}

async function copyActive() {
  const cols = activeCols.value
  const rows = (activeData.value || []).filter((r) => !r._placeholder)
  const text = cols.map((c) => c.label).join('\t') + '\n' + rows.map((r) => cols.map((c) => r[c.prop] ?? '').join('\t')).join('\n')
  try {
    await navigator.clipboard.writeText(text)
  } catch (e) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  ElMessage.success(`已复制 ${rows.length} 行到剪贴板`)
}

function exportActive() {
  const cols = activeCols.value
  const rows = (activeData.value || []).filter((r) => !r._placeholder)
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n\t]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const csv = '\ufeff' + cols.map((c) => esc(c.label)).join(',') + '\n' + rows.map((r) => cols.map((c) => esc(r[c.prop])).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${panelCode.value}-${ctxBlock.value?.id || 'list'}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出 ' + a.download)
}

async function onIcon(it, b) {
  ctxBlock.value = b
  if (it === '复制到剪贴板') {
    copyActive()
    return
  }
  if (it === '另存为EXCEL模板') {
    exportActive()
    return
  }
  if (it === '现存量提取') {
    try {
      const count = await engine.fillCurrentStock(blockData(b))
      ElMessage.success(`已按库存状况表刷新 ${count} 行现存量`)
    } catch (error) {
      ElMessage.error(engine.errMsg(error) || '现存量提取失败')
    }
    return
  }
  ElMessage.info(`演示环境暂未实现「${it}」，界面与 T+ 保持一致`)
}

async function onCtxItem(it) {
  const row = ctx.row
  ctx.visible = false
  if (!row) return
  if (it === '定位') {
    ElMessage.success('已定位：' + (row['产品编码'] || row['材料编码'] || row['存货编码'] || row['工序编码'] || row['编号'] || ''))
    return
  }
  if (it === '复制到剪贴板') {
    copyActive()
    return
  }
  if (it === '另存为EXCEL模板') {
    exportActive()
    return
  }
  ElMessage.info(`演示环境暂未实现「${it}」，界面与 T+ 保持一致`)
}

// ---------- 查询区 ----------
function fieldDefOf(col) {
  const cfg = cfgCache.value
  const r = (cfg?.dataSchema?.fields || []).find((x) => x.dataName === col)
  if (r) return r
  for (const tab of cfg?.detail?.tabs || []) {
    const dr = (tab.fields || []).find((x) => x.dataName === col)
    if (dr) return dr
  }
  return { dataName: col, dataType: '文本', options: [] }
}

function headerFieldKey(field) {
  return field.code || field.dataName
}

function headerFieldLabel(field) {
  // 显示层翻译(tt):en 时按中文原文查 biz 词典;数据键(headerFieldKey)不受影响
  return tt(field.name || field.label || field.displayName || field.dataName || field.code)
}

function fieldType(field) {
  return field?.dataType || '文本'
}

function isReferenceField(field) {
  return fieldType(field) === '参照' && !!(field?.refPanel || field?.ref?.panel)
}

function isSelectField(field) {
  return fieldType(field) === '下拉框'
}

function isDateField(field) {
  return ['日期', '日期时间', '时间', 'DATE', 'DateTime', 'Date'].includes(fieldType(field))
}

function isNumberField(field) {
  return ['小数', '整数', 'Decimal', 'Long', 'Integer', 'Double'].includes(fieldType(field))
}

function isBooleanField(field) {
  return ['是否', 'Boolean', 'BOOL'].includes(fieldType(field))
}

function fieldOptions(field) {
  return (field?.options || engine.fieldOptions(field || {}) || []).map((option) => (
    typeof option === 'object'
      ? { value: option.value ?? option.label, label: option.label ?? option.value }
      : { value: option, label: option }
  ))
}

function formatFieldValue(field, value) {
  if (value === undefined || value === null || value === '') return ''
  if (isBooleanField(field)) return value ? '是' : '否'
  return String(value)
}

function headerFieldLocked(field) {
  const key = headerFieldKey(field)
  // readonly:元数据 editable=0 → buildMeta 下发 readonly(文书锁定字段 申请立项人/负责人 在此列)
  return !!field.computed || !!field.autoCode || !!field.readonly
    || ['编号', '单据状态', '创建时间', '更新时间', '发起人编号'].includes(key)
}

function headerRefText(field) {
  return formatFieldValue(field, cur.value[headerFieldKey(field)])
}

function openHeaderRef(field) {
  if (!draftEditable.value || headerFieldLocked(field)) return
  headerRefField.value = field
  headerRefVisible.value = true
}

function onHeaderRefConfirm(rows) {
  const field = headerRefField.value
  const source = rows?.[0]
  if (!field || !source || !draftEditable.value) return
  const key = headerFieldKey(field)
  const ref = refConfigOf(field)
  const refField = ref.field || ref.refField || key
  cur.value[key] = source[refField] ?? ''
  applyRefCarry(cur.value, source, ref, key)
  headerRefVisible.value = false
  headerRefField.value = null
  markInlineDirty() // 表头参照带回 = 未保存修改
}

function detailTabDefOf(key) {
  return (cfgCache.value?.detail?.tabs || []).find((tab) => tab.key === key) || null
}

function detailEditable(b) {
  return draftEditable.value && !!b && tabView(b, activeTab(b)) !== 'summary'
}

function detailRefTrigger(field) {
  return field?.refTrigger || field?.trigger || 'click'
}

function isActiveDetailRefRow(row, b, prop) {
  const pick = detailRefPick.value
  return detailRefVisible.value && !!pick && pick.row === row && pick.tabKey === activeTab(b).key && pick.field?.dataName === prop
}

// ---------- 明细单元格编辑器懒渲染(2026-09-08) ----------
// 只给「当前激活的单元格」挂载编辑控件,其余单元格渲染纯文本。
// 动因:数据字典 210 行 × 6 列 = 1260 个常驻编辑器(含 el-select 全部选项 3165 个 option 节点),
// DOM 达 1.85 万节点、首屏 2.1s,表现为点击后面板长时间白屏。
const activeCell = ref(null)
function isActiveCell(row, b, prop) {
  const a = activeCell.value
  return !!a && a.row === row && a.tabKey === activeTab(b).key && a.prop === prop
}
function activateCell(row, b, prop) {
  if (!detailEditable(b) || row?._placeholder) return
  const a = activeCell.value
  if (a && a.row === row && a.tabKey === activeTab(b).key && a.prop === prop) return
  activeCell.value = { row, tabKey: activeTab(b).key, prop }
}
function deactivateCell() {
  activeCell.value = null
}

function openDetailReference(field, row, b) {
  if (!detailEditable(b) || !isReferenceField(field) || field.computed || row?._placeholder) return
  detailRefPick.value = {
    field,
    row,
    tabKey: activeTab(b).key,
    documentNo: cur.value['编号'],
    created: false,
  }
  detailRefVisible.value = true
}

function openClickDetailRef(field, row, b) {
  if (detailRefTrigger(field) === 'click') openDetailReference(field, row, b)
}

function onDetailCellDblclick(row, column, event, b) {
  const field = fieldDefOf(column?.property)
  if (detailEditable(b) && isReferenceField(field) && detailRefTrigger(field) === 'dblclick') {
    event?.stopPropagation?.()
    if (!row?._placeholder) openDetailReference(field, row, b)
    return
  }
  if (draftEditable.value) return
  if (!row?._placeholder) openForm(cur.value)
}

function newDetailRow(tabKey) {
  const row = {}
  for (const field of detailTabDefOf(tabKey)?.fields || []) {
    if (field.dataType === '小数' || field.dataType === '整数') row[field.dataName] = field.defaultValue ?? 0
    else if (field.dataType === '是否') row[field.dataName] = field.defaultValue ?? false
    else row[field.dataName] = field.defaultValue ?? ''
  }
  return row
}

function addInlineDetailRow(b) {
  if (!detailEditable(b)) return
  const tabKey = activeTab(b).key
  if (!cur.value.detail) cur.value.detail = {}
  const rows = cur.value.detail[tabKey] || (cur.value.detail[tabKey] = [])
  // 排序激活时先清排序:新行落在数据末尾,避免"插到已排好的中间"的错觉
  const state = blockSortOf(b)
  if (state.order) { state.prop = ''; state.order = '' }
  rows.push(newDetailRow(tabKey))
  archPage.value = Math.ceil(rows.length / archPageSize.value) // 档案分页:新行在末尾,跳到末页立即可见
  markInlineDirty() // 新增明细行 = 未保存修改
}

function primaryDetailRefField(b) {
  if (!detailEditable(b)) return null
  const columns = new Set(activeTab(b).cols || [])
  const fields = (detailTabDefOf(activeTab(b).key)?.fields || []).filter((field) => (
    columns.has(field.dataName) && isReferenceField(field) && !field.computed
  ))
  return fields.find((field) => ['产品编码', '存货编码', '材料编码'].includes(field.dataName)) || fields[0] || null
}

function openBlankDetailRow(b) {
  const field = primaryDetailRefField(b)
  if (!field) return
  const tabKey = activeTab(b).key
  if (!cur.value.detail) cur.value.detail = {}
  const rows = cur.value.detail[tabKey] || (cur.value.detail[tabKey] = [])
  const row = newDetailRow(tabKey)
  rows.push(row)
  detailRefPick.value = {
    field,
    row,
    tabKey,
    documentNo: cur.value['编号'],
    created: true,
  }
  detailRefVisible.value = true
}

function discardCreatedDetailRefRow(pick) {
  if (!pick?.created) return
  const rows = cur.value.detail?.[pick.tabKey]
  if (!Array.isArray(rows)) return
  const index = rows.indexOf(pick.row)
  if (index >= 0) rows.splice(index, 1)
}

async function onInlineDetailChange(tabKey, row, field) {
  markInlineDirty() // 明细单元格任何值变更 → 未保存离开守卫置脏
  calculateDetailRow(tabKey, row)
  if (['存货编码', '存货名称', '产品编码', '产品名称', '材料编码', '材料名称', '仓库', '预出仓库', '出库仓库'].includes(field?.dataName)) {
    try { await engine.fillCurrentStock(row) } catch (error) { ElMessage.error(engine.errMsg(error) || '现存量刷新失败') }
  }
}

function applyDetailReference(target, field, source) {
  const refField = field.refField || field.field
  target[field.dataName] = source[refField]
  for (const map of field.refMap || field.map || []) {
    if (map && source[map.from] !== undefined) target[map.to || map.from] = source[map.from]
  }
}

function calculateDetailRow(tabKey, row) {
  const tab = detailTabDefOf(tabKey)
  if (!tab?.calc?.length) return
  const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
  for (const rule of tab.calc) {
    let expression = String(rule.formula || '')
    const names = [...new Set(expression.match(/[^\s+\-*/()]+/g) || [])]
      .filter((name) => !/^\d+(?:\.\d+)?$/.test(name))
      .sort((a, b) => b.length - a.length)
    for (const name of names) expression = expression.split(name).join(String(numeric(row[name])))
    if (!/^[\d.\s+\-*/()]+$/.test(expression)) continue
    let value
    try { value = Function(`"use strict"; return (${expression})`)() } catch (error) { value = 0 }
    if (!Number.isFinite(value)) value = 0
    if (rule.round != null) value = engine.roundDecimal(value, rule.round)
    row[rule.target] = value
  }
}

function currentFormData(detail) {
  const head = { ...cur.value }
  delete head.detail
  delete head['编号']
  delete head['单据状态']
  delete head['创建时间']
  delete head['更新时间']
  delete head['发起人编号']
  return { ...head, 编号: cur.value['编号'], detail }
}

function emptyFieldValue(value) {
  return value === undefined || value === null || String(value).trim() === ''
}

function validateInlineDraft() {
  if (panelCode.value === 'BOM' && bomMasterRef.value) {
    const validation = bomMasterRef.value.validate()
    if (validation) return validation
  }
  for (const field of headerFields.value) {
    const key = headerFieldKey(field)
    if (field.isRequired && emptyFieldValue(cur.value[key])) {
      // 系统字段:单据日期默认今天、单据编号由后端自动生成、规格书种类为页签分类(旧草稿可能为空)
      if (key === '单据日期') {
        cur.value[key] = todayStr()
        continue
      }
      if (key === '单据编号' || key === '规格书种类') continue
      return `${headerFieldLabel(field)}不能为空`
    }
  }
  for (const tab of cfgCache.value?.detail?.tabs || []) {
    // BOM 面板:子件关系由 BomMasterDetail.validate 校验(锚点行 子件编码='' 合法),跳过通用逐行校验
    if (panelCode.value === 'BOM' && tab.key === 'children') continue
    const rows = cur.value.detail?.[tab.key] || []
    if (tab.isRequired && !rows.length) return `请至少添加一行${tab.label || '明细'}`
    for (let index = 0; index < rows.length; index++) {
      for (const field of tab.fields || []) {
        if (field.isRequired && emptyFieldValue(rows[index][field.dataName])) {
          return `${tab.label || '明细'}第 ${index + 1} 行${field.dataName}不能为空`
        }
      }
    }
  }
  return ''
}

async function saveInlineDraft(buttonName = '保存', { silent = false, skipValidation = false } = {}) {
  if (!draftEditable.value || inlineSaving.value) return false
  const validation = validateInlineDraft()
  if (validation) {
    ElMessage.warning(validation)
    // 文书面板(RecordSheetPanels/DocSheet/DataRecordSheet):自动定位缺失字段(翻页/滚动/闪烁);仅必填触发
    if (approvalSheetRef.value?.focusField) {
      const label = validation.replace(/第\s*\d+\s*行/g, '').match(/^(.+?)不能为空/)?.[1] || ''
      approvalSheetRef.value.focusField(String(label).trim())
    }
    return false
  }
  for (const tab of cfgCache.value?.detail?.tabs || []) {
    for (const row of cur.value.detail?.[tab.key] || []) calculateDetailRow(tab.key, row)
  }
  inlineSaving.value = true
  const documentNo = cur.value['编号']
  try {
    await engine.callButton({
      panelCode: panelCode.value,
      buttonName,
      formData: currentFormData({ ...(cur.value.detail || {}) }),
      buttonParam: {},
    })
    await load()
    const index = list.value.findIndex((item) => item['编号'] === documentNo)
    if (index >= 0) curIdx.value = index
    if (!silent) ElMessage.success(`「${buttonName}」成功`)
    inlineDirtyFlag.value = false
    freshAdded.value = false
    freshAddedNo.value = ''
    clearFreshDraft(documentNo)
    return true
  } catch (error) {
    ElMessage.error(engine.errMsg(error) || '保存失败')
    return false
  } finally {
    inlineSaving.value = false
  }
}

/** BOM 展开：产品明细行带出材料明细（从 BOM 面板 children 按父件编码取子件，对齐表单页 loadBomFor） */
async function expandBomMaterials(detail, productRows) {
  const matTab = (cfgCache.value?.detail?.tabs || []).find((t) => t.key === 'materials')
  if (!matTab) return
  try {
    const res = await engine.queryFormDataList({ panelCode: 'BOM', condition: {}, pageNo: 1, pageSize: 100 })
    const bom = []
    for (const d of res.list || []) {
      for (const it of (d.detail && d.detail.children) || []) {
        if (!String(it['子件编码'] || '').trim()) continue // 锚点行(暂无子件的父件占位)不参与展开
        const parent = String(it['父件编码'] || '')
        if (!parent || !productRows.some((r) => String(r['产品编码'] || '') === parent)) continue
        bom.push({
          材料编码: it['子件编码'],
          材料名称: it['子件名称'],
          规格型号: it['规格型号'] || '',
          计量单位: it['子件计量单位'] || '件',
          定额需用数量: it['定额数量'] ?? 0,
          '损耗率%': it['损耗率%'] ?? 0,
          parent,
        })
      }
    }
    if (!bom.length) return
    const mats = detail.materials || (detail.materials = [])
    const existing = new Set(mats.map((m) => m['材料编码'] + ':' + m['子件BOM']))
    for (const b of bom) {
      const key = b['材料编码'] + ':' + b.parent
      if (existing.has(key)) continue
      const row = newDetailRow('materials')
      row['材料编码'] = b['材料编码']
      row['材料名称'] = b['材料名称']
      row['规格型号'] = b['规格型号']
      row['计量单位'] = b['计量单位']
      row['定额需用数量'] = b['定额需用数量']
      row['损耗率%'] = b['损耗率%']
      row['子件BOM'] = b.parent
      mats.push(row)
      existing.add(key)
    }
  } catch (e) {
    // BOM 查询失败不阻塞参照导入
  }
}

async function onDetailRefConfirm(selectedRows) {
  const pick = detailRefPick.value
  if (!pick || !selectedRows?.length || detailRefSaving.value) return
  // 草稿判定仅适用于单据式面板(有 单据状态=草稿 语义);
  // singleDoc 档案长表格面板(如 项目/基础档案)状态为 启用/停用,行始终可编辑,不做该判定。
  if (cfgCache.value?.metadata?.singleDoc !== true
      && (cur.value['编号'] !== pick.documentNo || cur.value['单据状态'] !== '草稿')) {
    detailRefVisible.value = false
    ElMessage.warning('当前单据已切换或不再是草稿，请重新选择')
    return
  }

  const detail = {}
  for (const [key, value] of Object.entries(cur.value.detail || {})) {
    detail[key] = Array.isArray(value) ? value.map((row) => ({ ...row })) : value
  }
  const sourceRows = cur.value.detail?.[pick.tabKey] || []
  const targetRows = detail[pick.tabKey] || (detail[pick.tabKey] = [])
  const targetIndex = pick.row ? sourceRows.indexOf(pick.row) : -1
  const changedRows = []
  let offset = 0
  if (targetIndex >= 0) {
    applyDetailReference(targetRows[targetIndex], pick.field, selectedRows[0])
    calculateDetailRow(pick.tabKey, targetRows[targetIndex])
    changedRows.push(targetRows[targetIndex])
    offset = 1
  }
  for (let index = offset; index < selectedRows.length; index++) {
    const row = newDetailRow(pick.tabKey)
    applyDetailReference(row, pick.field, selectedRows[index])
    calculateDetailRow(pick.tabKey, row)
    targetRows.push(row)
    changedRows.push(row)
  }

  await engine.fillCurrentStock(changedRows)

  // BOM 展开：产品明细选产品 → 从 BOM 面板 children 带出材料明细（与表单页 loadBomFor 一致）
  if (pick.tabKey === 'products' && pick.field.dataName === '产品编码') {
    await expandBomMaterials(detail, targetRows)
  }

  detailRefSaving.value = true
  try {
    await engine.callButton({
      panelCode: panelCode.value,
      buttonName: '保存',
      formData: currentFormData(detail),
      buttonParam: {},
    })
    detailRefVisible.value = false
    const documentNo = pick.documentNo
    await load()
    const currentIndex = list.value.findIndex((item) => item['编号'] === documentNo)
    if (currentIndex >= 0) curIdx.value = currentIndex
    ElMessage.success(`已导入 ${selectedRows.length} 条存货并保存`)
  } catch (error) {
    discardCreatedDetailRefRow(pick)
    ElMessage.error(engine.errMsg(error) || '存货导入保存失败')
  } finally {
    detailRefSaving.value = false
    detailRefPick.value = null
  }
}

/** 页码文案(语序适配:中文 第x/y张;英文 No. x of y) */
function pageText(cur, total, unit) {
  const zh = String(localStorage.getItem("mes_locale") || "zh-CN").startsWith("zh")
  return zh ? `第 ${cur}/${total} ${unit}` : `${unit === "张" ? "No." : "Page"} ${cur} / ${total}`
}

function qType(qr) {
  const t = qr.dataType || fieldDefOf(qr.dataName).dataType || '文本'
  if (t === '参照') return 'ref'
  if (t === '下拉框') return 'select'
  if (t === '日期' || t === '日期时间') return 'date'
  return 'input'
}

function openQueryDialog() {
  Object.keys(queryDraft).forEach((key) => delete queryDraft[key])
  Object.assign(queryDraft, condition)
  // 弹窗面板:单据日期区间从当前条件回填(重开弹窗保留上次区间);级联面板加载联动选项
  if (reportQueryDialog.value) {
    rqdRange.value = condition['开始日期'] && condition['结束日期'] ? [condition['开始日期'], condition['结束日期']] : []
  }
  if (isCascadePanel.value) loadLedgerRefOptions()
  queryDialogVisible.value = true
}

function openQueryRef(qr, context = 'page') {
  queryRefField.value = qr
  queryRefContext.value = context
  queryRefVisible.value = true
}

function clearQueryRef(qr, context = 'page') {
  const key = headerFieldKey(qr)
  if (context === 'dialog') {
    delete queryDraft[key]
    return
  }
  delete condition[key]
  search()
}

function onQueryRefConfirm(rows) {
  const field = queryRefField.value
  const row = rows?.[0]
  if (!field || !row) return
  const ref = field.ref && typeof field.ref === 'object' ? field.ref : field
  const valueField = ref.field || ref.refField || ref.display || ref.displayField || headerFieldKey(field)
  const target = queryRefContext.value === 'dialog' ? queryDraft : condition
  target[headerFieldKey(field)] = row[valueField] ?? ''
  queryRefVisible.value = false
  queryRefField.value = null
  if (queryRefContext.value === 'page') search()
}

function applyHeaderQuery() {
  // 查询弹窗面板:单据日期(区间)必填;台账加验 仓库/存货 必填(单一仓库的一种存货)
  if (reportQueryDialog.value) {
    const [ds, de] = rqdRange.value || []
    if (!ds || !de) {
      ElMessage.warning(tt('请填写单据日期'))
      return
    }
    if (panelCode.value === 'STOCK_LEDGER' && (!queryDraft['仓库'] || !queryDraft['存货'])) {
      ElMessage.warning(tt('库存台账需选择一个仓库和一种存货'))
      return
    }
    queryDraft['开始日期'] = ds
    queryDraft['结束日期'] = de
  }
  Object.keys(condition).forEach((key) => delete condition[key])
  for (const [key, value] of Object.entries(queryDraft)) {
    if (value !== undefined && value !== null && String(value) !== '') condition[key] = value
  }
  rqdDone.value = true // 已通过弹窗查询(此后关闭弹窗不再退页)
  queryDialogVisible.value = false
  search()
}

// ---- 查询方案:保存当前条件(表头+高级筛选)为命名方案,供下次调用/维护 ----
const planManageVisible = ref(false)
const selectedPlan = ref('')
const queryPlans = ref([])

function plansKey() {
  return `mes_query_plans_${panelCode.value}`
}
function loadPlans() {
  try {
    queryPlans.value = JSON.parse(localStorage.getItem(plansKey()) || '[]')
  } catch { queryPlans.value = [] }
}
function persistPlans() {
  try { localStorage.setItem(plansKey(), JSON.stringify(queryPlans.value)) } catch { /* ignore */ }
}

/** 将当前弹窗条件(表头草稿 + 高级筛选)存为方案。 */
async function saveCurrentPlan() {
  const adv = advFilters.value.filter((f) => f.field && (f.op === 'empty' || f.op === 'notEmpty' || String(f.value ?? '').trim() !== ''))
  const cond = {}
  for (const [k, v] of Object.entries(queryDraft)) {
    if (v !== undefined && v !== null && String(v) !== '') cond[k] = v
  }
  if (!adv.length && !Object.keys(cond).length) {
    ElMessage.warning(tt('当前没有可保存的查询条件'))
    return
  }
  try {
    const { value } = await ElMessageBox.prompt(tt('请输入方案名称'), tt('保存查询方案'), {
      confirmButtonText: tt('保存'), cancelButtonText: tt('取消'),
      inputValidator: (v) => (v && v.trim() ? true : tt('方案名称不能为空')),
    })
    const name = String(value).trim()
    const exists = queryPlans.value.find((p) => p.name === name)
    const plan = { name, condition: { ...cond }, advFilters: JSON.parse(JSON.stringify(adv)), updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') }
    if (exists) Object.assign(exists, plan)
    else queryPlans.value.push(plan)
    persistPlans()
    selectedPlan.value = name
    ElMessage.success(tt('查询方案已保存'))
  } catch { /* 取消 */ }
}

/** 调用方案:填充表头草稿与高级筛选(不自动执行,由用户点击查询)。 */
function applyPlan(name) {
  const plan = queryPlans.value.find((p) => p.name === name)
  if (!plan) return
  Object.keys(queryDraft).forEach((k) => delete queryDraft[k])
  Object.assign(queryDraft, plan.condition || {})
  advFilters.value = JSON.parse(JSON.stringify(plan.advFilters || []))
}

/** 维护操作:更新(以当前弹窗条件覆盖同名方案)/重命名/删除。 */
function updatePlan(name) {
  const plan = queryPlans.value.find((p) => p.name === name)
  if (!plan) return
  const adv = advFilters.value.filter((f) => f.field && (f.op === 'empty' || f.op === 'notEmpty' || String(f.value ?? '').trim() !== ''))
  const cond = {}
  for (const [k, v] of Object.entries(queryDraft)) {
    if (v !== undefined && v !== null && String(v) !== '') cond[k] = v
  }
  plan.condition = cond
  plan.advFilters = JSON.parse(JSON.stringify(adv))
  plan.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
  persistPlans()
  ElMessage.success(tt('查询方案已更新'))
}
async function renamePlan(name) {
  const plan = queryPlans.value.find((p) => p.name === name)
  if (!plan) return
  try {
    const { value } = await ElMessageBox.prompt(tt('请输入方案名称'), tt('重命名方案'), {
      confirmButtonText: tt('确定'), cancelButtonText: tt('取消'),
      inputValue: plan.name,
      inputValidator: (v) => (v && v.trim() ? true : tt('方案名称不能为空')),
    })
    plan.name = String(value).trim()
    if (selectedPlan.value === name) selectedPlan.value = plan.name
    persistPlans()
  } catch { /* 取消 */ }
}
function deletePlan(name) {
  const idx = queryPlans.value.findIndex((p) => p.name === name)
  if (idx >= 0) queryPlans.value.splice(idx, 1)
  if (selectedPlan.value === name) selectedPlan.value = ''
  persistPlans()
}
function planSummary(plan) {
  const parts = []
  const condKeys = Object.keys(plan.condition || {})
  if (condKeys.length) parts.push(condKeys.slice(0, 3).join('、') + (condKeys.length > 3 ? ` …×${condKeys.length}` : ''))
  if ((plan.advFilters || []).length) parts.push(`${tt('高级筛选')}×${plan.advFilters.length}`)
  return parts.join(' + ') || '-'
}

function resetHeaderQuery() {
  Object.keys(queryDraft).forEach((key) => delete queryDraft[key])
  Object.keys(condition).forEach((key) => delete condition[key])
  rqdRange.value = [] // 弹窗面板:单据日期区间一并重置
  advFilters.value = []
  query.keyword = ''
  queryDialogVisible.value = false
  search()
}

const qOptCache = new Map()
function qOptions(qr) {
  const key = panelCode.value + '|' + qr.dataName
  if (!qOptCache.has(key)) qOptCache.set(key, (qr.options || engine.fieldOptions(qr)).map((o) => typeof o === 'object' ? o : ({ value: o, label: o })))
  return qOptCache.get(key)
}

function reportLeaf(column) {
  const field = fieldDefOf(column)
  const numeric = field.dataType === '小数' || field.dataType === '整数'
  return { prop: column, label: column, width: colW(field), align: numeric ? 'right' : 'left' }
}

async function reportPage(pageNo) {
  const target = Math.max(1, Math.min(pageNo, reportPageCount.value))
  if (target === query.pageNo) return
  query.pageNo = target
  await load()
}

function exportReport() {
  const columns = reportColumns.value
  const esc = (value) => {
    const text = String(value ?? '')
    return /[",\n\t]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
  }
  const csv = '\ufeff' + columns.map(esc).join(',') + '\n' + list.value.map((row) => columns.map((column) => esc(row[column])).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${panelName.value}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出当前页 ' + list.value.length + ' 条数据')
}

/** 单据明细导出:当前 A 区活动页签(明细/汇总视图均可)导出 CSV(PANDA 打印组·导出) */
function exportDetail() {
  const blk = blocks.value.find((b) => b.id === 'A')
  if (!blk) return ElMessage.warning('该面板无可导出的明细')
  const tab = activeTab(blk)
  const cols = blockCols(blk)
  const rows = blockData(blk)
  if (!rows.length) return ElMessage.warning('当前单据无明细可导出')
  const esc = (value) => {
    const text = String(value ?? '')
    return /[",\n\t]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
  }
  const csv = '﻿' + cols.map(esc).join(',') + '\n'
    + rows.map((row) => cols.map((col) => esc(row[col])).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${panelName.value}-${current.value?.['编号'] || current.value?.['单据编号'] || ''}-${tab.label || '明细'}.csv`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出明细 ' + rows.length + ' 行')
}

// 底部备注（可编辑，绑定当前单据）
const remarkText = computed({
  get: () => cur.value['备注'] ?? '',
  set: (v) => {
    if (cur.value && Object.keys(cur.value).length) cur.value['备注'] = v
  },
})

// ---------- 配置与按钮 ----------
async function loadCrg() {
  if (cfgCache.value) return cfgCache.value
  const cfg = await engine.getPanelConfig(panelCode.value)
  cfgCache.value = cfg
  const tp = cfg?.metadata?.panelPageDto?.tablePages?.[0]
  panelName.value = cfg?.metadata?.panelName || panelCode.value
  // 页面标题 = 真实面板名（路由 meta.title 是通用占位，配置加载后覆盖）
  document.title = panelName.value + ' · YINJIA-MES'
  // 页签标题同步（生单直接跳转/页签替换后显示真实面板名）
  const curTab = tabs.tabs.find((x) => x.path === route.path)
  if (curTab) curTab.title = panelName.value
  queryFields.value = tp?.queryFields || []
  // 参照字段动态模式检查(≤20 弹窗,>20 下拉):并行判定全部参照字段
  const allRefFields = [...(queryFields.value || []), ...(headerFields.value || [])].filter(isReferenceField)
  for (const rf of allRefFields) checkRefMode(rf, headerFieldKey(rf))
  // 面板可配置每页条数（如档案类大列表 pageSize=100），未配置时保持默认 20
  if (tp?.pageSize && query.pageSize !== tp.pageSize) {
    query.pageSize = tp.pageSize
    query.pageNo = 1
  }
  gridTabs.value = tp?.gridTabs || []
  groups.value = filterGroups(ensureScanFillAction(
    cfg?.metadata?.buttonGroups,
    cfg?.metadata,
  ))
  return cfg
}

function isDisabled(action) {
  const st = current.value?.['单据状态']
  const map = {
    新增: false, // 单单据面板新增按钮不置灰
    删除: !current.value,
    审核: !current.value || st !== '草稿',
    弃审: !current.value || st !== '已审核',
    中止执行: !current.value || !['已审核', '生产中', '已完工'].includes(st),
    整单中止: !current.value || !['已审核', '生产中', '已完工'].includes(st),
    草稿: !current.value || st !== '已中止',
    取消中止: !current.value || st !== '已中止',
    修改: !current.value || !['已审核', '生产中', '已完工'].includes(st),
    审批情况: false,
    提交审批: !current.value || (st !== '草稿' && st !== '修改中'),
    审批通过: !current.value || st !== '审批中',
    审批驳回: !current.value || st !== '审批中',
   驳回审批: !current.value || st !== '审批中',
    // 卡死单据出口(2026-09-11):撤回删除/修改申请仅在对应申请态可点
    撤回删除申请: !current.value || st !== '删除申请中',
    撤回修改申请: !current.value || st !== '修改申请中',
    保存: !draftEditable.value || inlineSaving.value,
    保存为草稿: !draftEditable.value || inlineSaving.value,
    保存新增: !draftEditable.value || inlineSaving.value,
    扫描填单: reportMode.value,
    // PANDA 工具栏动作(列表页语义)
    复制: !current.value,            // 整单复制=另存为一张新草稿
    放弃: false,                     // 丢弃内联草稿修改,恢复最近一次保存
    打印: false, 预览: false, 导出: false,
    发送邮件: false, 退出: false, 表格调整: false, 分类管理: false, 表头调整: false,
    二维码标签: false, // 档案工具栏动作:是否可点由前端勾选数提示兜底,不按单据状态置灰
  }
  // 灰色占位动作(后端 metadata.disabledActions:选单无流转来源/生单无实现链路)恒置灰,点击忽略
  if (map[action] === undefined && (cfgCache.value?.metadata?.disabledActions || []).includes(action)) {
    return true
  }
  // 2026-08-25：所有「生成XX」生单按钮统一仅已审核/生产中可用（对齐 T+：已审核才能选择生单）
  if (map[action] === undefined && action.startsWith('生成')) {
    return !current.value || !['已审核', '生产中'].includes(st)
  }
  return map[action] === true
}

// 2026-08-20：双击明细行/修改按钮改为面板弹窗打开表单（不再跳新页签）；无编号（新增兜底）仍走页签
const formVisible = ref(false)
const formCode = ref('')
// 弹窗面板：双击=当前面板；选单生成=生成的目标面板（可跨面板）
const formPanel = ref('')
function openForm(row) {
  if (row && row['编号']) {
    formCode.value = row['编号']
    formVisible.value = true
    return
  }
  const q = { operationName: operationName.value }
  if (row && row['编号']) q.code = row['编号']
  const no = row ? row['单据编号'] || row['锭号'] || row['编号'] : ''
  const title = row ? `${panelName.value}-${no}` : `${panelName.value}-新增`
  router.push({ path: `/panelx/form/${panelCode.value}`, query: q })
  tabs.open({ path: `/panelx/form/${panelCode.value}`, title, query: q })
}
function onFormSaved() {
  formVisible.value = false
  formPanel.value = ''
  load()
}

// 直接新增：调后端保存（空表头）创建最新草稿单（autoCode 编号 + 单据日期=当天自动填入），
// 刷新列表并定位到新单，在列表页直接内联填写（不跳转表单页/不弹新增弹窗）。
// 流程规范：新增时当前页面未保存的内容直接剔除,不弹确认——
//   新增未保存过的占位单 → 撤回(防垃圾空单残留);已保存单据的未保存修改 → 随 load 放弃。
async function directAdd() {
  try {
    const formData = {}
    const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '保存', formData, buttonParam: {} })
    const no = res && (res['编号'] || res.formNo)
    if (!no) return ElMessage.error('新增失败：未返回单据编号')
    // 标记必须先立:下面的 load() 刷新列表时 cur 就可能切到这张新草稿,文书默认值 watch 在
    // await 期间就会跑;标记晚设会被 isFreshAddedDoc() 判成 false,锁定字段(申请立项人/负责人)就带不出来
    freshAdded.value = true // 本次新增尚未成功保存过：离开守卫「不保存」时据此撤回整单
    freshAddedNo.value = no // 撤回只允许命中这张新建单
    markFreshDraft(no) // 持久化标记：刷新/重进后守卫仍能识别并撤回这张草稿
    await load() // 刷新列表
    // 定位到新单:列表按单据号排序,新单号不一定排在首位(如存在 WW-/旧格式单号时 WO 新单不在第 1 位),
    // 必须按编号精确定位,否则新增后仍显示旧单,看起来像"新增复制了当前页面的内容"
    const idx = list.value.findIndex((item) => item['编号'] === no)
    curIdx.value = idx >= 0 ? idx : 0
    markSavedSnapshot()
    ElMessage.success(`已新增 ${panelName.value}-${no}，请在列表页填写并保存`)
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '新增失败')
  }
}

// ============ 未保存离开守卫（开发规范 2026-09-01） ============
// 草稿态内联编辑存在未保存修改时离开本页（菜单切换/页签关闭/后退）弹窗三态：
// - 保存 → 走「保存」按钮路径(saveInlineDraft)落库后放行
// - 不保存 → 新增未保存过的撤回整单（走「删除」按钮路径：软删作废，
//   yj_doc_status.cancel_by/cancel_at 留痕 + form_flow_link 占用释放）；
//   修改既有草稿的仅放弃修改（不删单）
// - 取消(关闭弹窗) → 留在本页
// 实现：路由守卫【同步】return false 拦截，弹窗在守卫之外(普通交互流程)弹出，
// 选择完成后置 leaveConfirmed 再发起导航放行——避开在导航守卫内 await 弹窗的
// 竞态(hash 已改/页签已关导致体验异常)。另挂 beforeunload 兜底刷新/关窗提醒。

const savedSnapshot = ref('')
const freshAdded = ref(false)
const freshAddedNo = ref('') // freshAdded 绑定的单据编号:撤回只允许命中这张单,防止 cur 漂移后误撤既有单据
/** 当前单据是否为「本次新增且尚未成功保存过」的草稿(freshAdded 且编号匹配,防 cur 漂移误判) */
function isFreshAddedDoc() {
  if (!freshAdded.value) return false
  if (!freshAddedNo.value) return true
  if (cur.value?.['编号'] === freshAddedNo.value) return true
  // 库端标记(directAdd 占位=库存 saved=N;保存/保存为草稿后=Y):跨刷新/跨会话/跨浏览器可靠
  return cur.value?.['saved'] === 'N'
}
// ---- 新增草稿标记的持久化(2026-09-09 补齐):刷新/重进后离开守卫仍能识别并撤回这张草稿 ----
const FRESH_DRAFT_KEY = 'mes_fresh_draft'
function markFreshDraft(documentNo) {
  try {
    sessionStorage.setItem(FRESH_DRAFT_KEY, JSON.stringify({ panel: panelCode.value, no: String(documentNo || '') }))
  } catch { /* 存储不可用则退化为仅内存标记 */ }
}
function clearFreshDraft(documentNo) {
  try {
    const raw = sessionStorage.getItem(FRESH_DRAFT_KEY)
    if (!raw) return
    let saved = null
    try { saved = JSON.parse(raw) } catch { saved = null }
    if (!documentNo || !saved || String(saved.no || '') === String(documentNo)) {
      sessionStorage.removeItem(FRESH_DRAFT_KEY)
    }
  } catch { /* ignore */ }
}
function restoreFreshDraft() {
  try {
    const raw = sessionStorage.getItem(FRESH_DRAFT_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    if (saved && saved.panel === panelCode.value && saved.no) {
      freshAdded.value = true
      freshAddedNo.value = String(saved.no)
    }
  } catch { /* ignore */ }
}
/** 变更钩子置脏(表头/明细控件 @change;对真实交互可靠)——快照对比作兜底 */
const inlineDirtyFlag = ref(false)
function markInlineDirty() {
  if (draftEditable.value) inlineDirtyFlag.value = true
  normalizeArchRaw() // 档案行 raw 写入不触发响应式:统一在此 markRaw 新行/新数组并 bump 版本驱动视图刷新
}

/** 终止审批动作后(申请终止/审批/撤回):重载列表刷新单据状态(终止审批中/已终止) */
async function onTermChanged() {
  await load()
}

// ── 项目进度查询:点项目编号 → 该项目的数据记录表单据(8 面板按文档编号关联;弹窗内就地只读渲染,不跳转) ──
const dataSheetsVisible = ref(false)
const dataSheetsLoading = ref(false)
const dataSheetsRows = ref([])
const dataSheetsCode = ref('')
const dsActive = ref(null) // 当前展示的单据 {panelCode,panelName,docNo,doc,headerFields,allFields,loading}
const dsCfgCache = new Map() // panelCode → 面板配置(字段元数据;会话内缓存)
async function openDataSheets(row) {
  const K = Object.fromEntries(PROGRESS_COLUMNS.map((c) => [c.label, c.key]))
  const code = String(row?.[K['项目编号']] || '').trim()
  if (!code) return ElMessage.warning(tt('该行未填项目编号，无法关联数据记录表'))
  dataSheetsCode.value = code
  dataSheetsVisible.value = true
  dataSheetsLoading.value = true
  dataSheetsRows.value = []
  dsActive.value = null
  try {
    const res = await request.get('/px/progress/dataSheets', { params: { code } })
    dataSheetsRows.value = res?.data || []
    // 单张:直接进入查看;多张:先出选取列表,选中后再查看
    if (dataSheetsRows.value.length === 1) await selectDataSheet(dataSheetsRows.value[0])
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || tt('查询失败'))
  } finally {
    dataSheetsLoading.value = false
  }
}
/** 载入一张单据到弹窗(面板配置缓存 + getFormDescriptor 头明细拼回行模型) */
async function selectDataSheet(r) {
  if (!r?.panelCode || !r?.docNo) return
  dsActive.value = { ...r, loading: true, doc: null, headerFields: [], allFields: [] }
  try {
    let cfg = dsCfgCache.get(r.panelCode)
    if (!cfg) {
      const c = await request.get('/px/getPanelConfig', { params: { panelCode: r.panelCode } })
      cfg = c?.data || {}
      dsCfgCache.set(r.panelCode, cfg)
    }
    const d = await request.get('/px/getFormDescriptor', { params: { panelCode: r.panelCode, code: r.docNo } })
    // 响应体 data → {data: 头字段labels, detailData: {items}, ...};拼回行模型(head + detail.items)
    const payload = d?.data || {}
    const doc = { ...(payload.data || {}), detail: payload.detailData || {} }
    const headerFields = cfg?.dataSchema?.fields || []
    const allFields = [...headerFields, ...((cfg?.detail?.tabs?.[0]?.fields) || [])]
    dsActive.value = { ...r, loading: false, doc, headerFields, allFields }
  } catch (e) {
    dsActive.value = { ...r, loading: false, doc: null, headerFields: [], allFields: [] }
    ElMessage.error(engine.errMsg(e) || tt('查询失败'))
  }
}
/** 字段编辑保存后刷新面板配置(yj_field 别名随配置接口重新下发) */
async function onFieldEditRefresh() {
  cfgCache.value = null
  await load()
}

/** 记录"已保存"基线快照（load 完成/保存成功后调用） */
function markSavedSnapshot() {
  try {
    savedSnapshot.value = cur.value ? JSON.stringify(guardFormData()) : ''
  } catch {
    savedSnapshot.value = ''
  }
}

/** 守卫对比数据:在表单数据上剔除附件列位键——附件格挂载后异步回写头列位
 *  (AttachmentService 聚合值落表单,晚于载入快照),属服务端值同步而非用户编辑,
 *  不剔除会把带附件面板(QC_INSP/SL_RECV 等)的载入误判成未保存,守卫永远误弹。 */
function guardFormData() {
  const data = currentFormData(cur.value.detail || {})
  for (const k of attachKeys.value) delete data[k]
  return data
}

/** 当前是否存在未保存修改（草稿态且 变更钩子置脏/新增未保存/基线为空白草稿 或 相对基线有变化）。
 * directAdd 新建且尚未保存过的草稿即使零修改也算未保存：否则「新增后未填写直接离开」
 * 不触发守卫弹窗，空草稿永久残留（规范 §6.2「不保存→撤回整单」依赖本判定）。 */
function hasUnsavedChanges() {
  if (!draftEditable.value || !cur.value) return false
  if (inlineDirtyFlag.value || isFreshAddedDoc()) return true
  try {
    return JSON.stringify(guardFormData()) !== savedSnapshot.value
  } catch { return false }
}

/** 取消离开时页签可能已被 TabsBar 关闭，补回当前页签 */
function restoreCurrentTab() {
  try { tabs.open({ path: route.fullPath, title: panelName.value }) } catch { /* 页签兜底失败不阻断 */ }
}

// ---- 离开守卫：同步拦截 → 守卫外弹窗 → 选择后放行 ----
const pendingLeave = ref(null)   // 被拦截的目标路由(选择后跳转)
let pendingAction = null          // 被拦截的面板内动作(翻页/点行切单,选择后执行)
const leaveConfirmed = ref(false) // 弹窗已决：放行下一次(由本组件发起的)导航
let guardAsking = false          // 弹窗进行中防重入

onBeforeRouteLeave((to) => {
  if (leaveConfirmed.value) { leaveConfirmed.value = false; return true }
  if (guardAsking) return false // 弹窗进行中:拦截一切导航(三态选择后由 onLeaveChoice 放行)
  if (!hasUnsavedChanges()) { pendingLeave.value = null; return true }
  pendingLeave.value = to
  guardAsking = true
  nextTick(() => askUnsavedLeave()) // 守卫拦截后弹模板确认框
  return false
})

const leaveVisible = ref(false)
let leaveChoiceHandled = false    // onLeaveChoice 已处理置 false 的弹窗,@close 兜底跳过

/** 弹窗问句:新建未保存/基线为空白草稿走「尚未保存」文案(提示不保存将撤回),有修改的走「有修改」 */
const leaveQuestion = computed(() => (
  isFreshAddedDoc() && !inlineDirtyFlag.value
    ? tt('当前草稿尚未保存，是否保存？（不保存将撤回该单）')
    : tt('当前单据有未保存的修改，是否保存？')
))

/** 守卫拦截后弹出模板确认框(命令式 ElMessageBox 在导航守卫上下文中不渲染,改用模板弹窗) */
function askUnsavedLeave() {
  leaveChoiceHandled = false
  leaveVisible.value = true
}

/** ESC/右上角 × 关闭弹窗(未做三态选择)= 留在本页:必须复位守卫状态,否则后续导航/切单被永久拦截 */
function onLeaveDialogClose() {
  if (leaveChoiceHandled) { leaveChoiceHandled = false; return }
  if (!guardAsking) return
  guardAsking = false
  pendingLeave.value = null
  pendingAction = null
  restoreCurrentTab()
}

/** 离开守卫三态选择:save=按保存按钮落库;discard=撤回新增/放弃修改;stay=留在本页 */
async function onLeaveChoice(choice) {
  leaveChoiceHandled = true
  leaveVisible.value = false
  const to = pendingLeave.value
  if (choice === 'stay') {
    guardAsking = false
    pendingLeave.value = null
    restoreCurrentTab()
    return
  }
  if (choice === 'save') {
    const saved = await saveInlineDraft('保存', { silent: true })
    if (!saved) { guardAsking = false; pendingLeave.value = null; restoreCurrentTab(); return }
  } else if (isFreshAddedDoc()) {
    // 不保存 + 新建未保存过或基线为空白草稿 → 撤回整单(走「删除」按钮路径:按开发规范留痕+释放占用)。
    // 有修改的既有草稿(基线含实质数据)不走此分支:仅放弃修改,保留单据(避免误删已填写内容)
    const withdrawNo = cur.value['编号']
    try {
      await engine.callButton({ panelCode: panelCode.value, buttonName: '删除', formData: { 编号: withdrawNo }, buttonParam: {} })
      ElMessage.success(`已撤回新增：${withdrawNo}`)
      clearFreshDraft(withdrawNo)
      await load() // 撤回后重载列表(挂起的切单/翻页动作据此定位)
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '撤回新增失败，请手动删除草稿')
      guardAsking = false
      pendingLeave.value = null
      restoreCurrentTab()
      return
    }
  }
  freshAdded.value = false
  freshAddedNo.value = ''
  inlineDirtyFlag.value = false
  guardAsking = false
  pendingLeave.value = null
  const action = pendingAction
  pendingAction = null
  if (action) {
    // 面板内动作(翻页/点行切单):load 时的快照对应切换前的单据,切换后必须重打
    // 基线快照,否则快照错位导致恒脏(误弹守卫/beforeunload 卡死)
    await action()
    markSavedSnapshot()
    return
  }
  leaveConfirmed.value = true
  if (to) router.push(typeof to === 'string' ? to : (to.fullPath || to.path))
}

// 刷新/关闭浏览器兜底：未保存时浏览器原生确认
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges()) { e.preventDefault(); e.returnValue = '' }
  })
}

async function onButton(action) {
  // 2026-08-25：灰按钮（disabled）点击直接忽略，不执行、不弹提示（如草稿态「生成XX」生单按钮）
  if (isDisabled(action)) return
  if (APPROVE_ACTIONS.includes(action) && !user.isAdmin && !user.approvePanels.includes(panelCode.value)) {
    return ElMessage.warning('当前角色无审批权限')
  }
  if (action === '扫描填单') {
    scanVisible.value = true
    return
  }
  // 批量转ERP:弹窗显示已审核+未转的单据,勾选后批量推送
  if (action === '批量转ERP') {
    openBatchErp()
    return
  }
  // 材料二维码标签打印(品检分流链):本地拦截,数据源=当前暂收单明细行
  if (action === '打印标签') {
    openQrLabels()
    return
  }
  // 工单二维码(计划层):单产品工单一张标签,二维码=工单号(扫码报工/领料入口)
  if (action === '打印工单二维码') {
    const cur = current.value || {}
    const no = cur['单据编号'] || cur['编号'] || ''
    if (!no) return ElMessage.warning('请先选择一张工单')
    qrLabels.value = [{
      code: no, name: cur['产品名称'] || '', lot: '', qty: cur['订单数量'], unit: cur['单位'] || '',
      doc: `交期 ${cur['交期'] || '-'}`, qr: '',
    }]
    qrVisible.value = true
    return
  }
  // 产品二维码(成型后):二维码=产品编码|产品批号;批号由后端按需取号(一次生成终身复用)
  if (action === '打印产品二维码') {
    const cur = current.value || {}
    const no = cur['单据编号'] || cur['编号'] || ''
    if (!no) return ElMessage.warning('请先选择一张工单')
    try {
      const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '生成产品批号', formData: { 编号: no }, buttonParam: {} })
      const lot = res?.['产品批号']
      if (!lot) throw new Error('未返回产品批号')
      await load()
      const fresh = list.value.find((r) => (r['单据编号'] || r['编号']) === no) || cur
      qrLabels.value = [{
        code: fresh['产品编码'] || cur['产品编码'] || '', name: fresh['产品名称'] || cur['产品名称'] || '',
        lot, qty: fresh['订单数量'] ?? cur['订单数量'], unit: fresh['单位'] || cur['单位'] || '',
        doc: `工单 ${no} · 交期 ${fresh['交期'] || cur['交期'] || '-'}`, qr: '',
      }]
      qrVisible.value = true
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '生成产品批号失败')
    }
    return
  }
  if (action === '查询' || action === '查找') {
    // 查询弹窗面板(T+ 收发存):查询按钮重开条件弹窗,而非直接刷新
  if (reportQueryDialog.value) { openQueryDialog(); return }
    search()
    return
  }
  if (action === '导出') {
    // 报表=整表 CSV;单据=当前明细页签 CSV(PANDA 打印组/委外更多 的导出)
    if (reportMode.value) exportReport()
    else exportDetail()
    return
  }
  if (action === '打印' || action === '预览') {
    if (docPrintEnabled.value) prepareDocPrint()
    window.print()
    return
  }
  if (action === '恢复') {
    await load()
    ElMessage.success('已恢复为最近一次保存的数据')
    return
  }
  if (reportMode.value && action === '发送邮件') {
    ElMessage.info('报表邮件发送需先配置企业邮箱服务')
    return
  }
  if (action === '退出') {
    router.push('/dashboard')
    return
  }
  // 放弃(列表页):丢弃内联草稿修改,恢复最近一次保存的数据
  if (action === '放弃') {
    if (draftEditable.value) {
      await load()
      ElMessage.success('已放弃未保存的修改')
    } else {
      ElMessage.info('当前没有未保存的修改')
    }
    return
  }
  // 复制(列表页):整单复制为一张新草稿(表头+明细,去掉编号/状态/行 id)
  if (action === '复制') {
    if (!current.value) return ElMessage.warning('请先选择一行数据')
    if (cfgCache.value?.metadata?.singleDoc) return ElMessage.info('档案面板不支持整单复制')
    const srcNo = current.value['编号'] || current.value['单据编号']
    try {
      const fd = await engine.getFormDescriptor({ panelCode: panelCode.value, code: srcNo })
      const head = { ...(fd.data || {}) }
      delete head['编号']; delete head['单据状态']
      const detail = {}
      for (const [key, rows] of Object.entries(fd.detailData || {})) {
        if (!Array.isArray(rows)) continue
        detail[key] = rows.map((row) => {
          const copy = { ...row }
          delete copy.id; delete copy.__id; delete copy.__no
          return copy
        })
      }
      const res = await engine.callButton({
        panelCode: panelCode.value, buttonName: '保存', formData: { ...head, detail }, buttonParam: {},
      })
      ElMessage.success('已复制为新草稿：' + (res['编号'] || ''))
      await load()
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '复制失败')
    }
    return
  }
  if (action === '导入') {
    // Excel 导入：识别 A 区主明细字段，导入后追加行并自动保存
    const blk = blocks.value.find((x) => x.id === 'A')
    const tab = blk ? activeTab(blk) : null
    if (!tab) return ElMessage.warning('该面板无明细可导入')
    // 字段定义取自面板配置 detail.tabs（blocks 的 tab 只有列名 cols）；档案面板无明细 tab → 用 dataSchema.fields
    const tabDef = (cfgCache.value?.detail?.tabs || []).find((t) => t.key === tab.key)
    const fields = (tabDef && tabDef.fields && tabDef.fields.length)
      ? tabDef.fields
      : (cfgCache.value?.dataSchema?.fields || [])
    impFields.value = (fields || []).filter((f) => !f.hidden)
    impLabel.value = tab.label || '明细'
    impVisible.value = true
    return
  }
  // 选单通用化：任意 选X 动作且配置有 selectConfig 即走选单（对齐 PanelxForm 的通用分支）
  if (action === '选单' || action.startsWith('选')) {
    const sc = selectConfigFor(action)
    if (sc) {
      // 选单通用化：列表页内嵌小弹窗勾选已审核源单据，确定后生成目标单据并打开表单（对齐 T+ 选单生单语义，不再跳转「新增」页面）
      selCfg.value = sc
      selVisible.value = true
      return
    }
    ElMessage.info('演示环境暂未实现「选单」，界面与 T+ 保持一致')
    return
  }
  if (action === '新增' || action === '新建' || action === '新增流程') {
    if (cfgCache.value?.metadata?.singleDoc && current.value && current.value['编号']) {
      // 档案/单单据面板（存货档案、员工、部门等）：直接在当前单据页填写（列表页已内联可编辑），不弹新增弹窗
      ElMessage.info('请在下方列表页直接填写并保存')
      return
    }
    // 统一直接新增（2026-08-24 全量生效）：后端创建一张最新草稿单（autoCode 编号 + 单据日期=当天填入表头），
    // 刷新列表并定位到新单，在列表页内联填写（不再弹新增弹窗、不跳转表单页）。
    // 流程规范：新增时当前未保存内容直接剔除,不弹确认(directAdd 内部静默撤回占位单)
    await directAdd()
    return
  }
  if (action === '修改') {
    if (!current.value) return ElMessage.warning('请先选择一行数据')
    openForm(current.value)
    return
  }
  if (['保存', '保存为草稿', '保存新增'].includes(action) && draftEditable.value) {
    if (action === '保存为草稿') {
      // 暂存:不校验(未完成的数据也可落库)
      await saveInlineDraft(action, { skipValidation: true })
      return
    }
    if (action === '保存新增') {
      // 保存当前单据(执行校验) → 成功后自动新增一页
      if (await saveInlineDraft('保存')) await directAdd()
      return
    }
    await saveInlineDraft(action)
    return
  }
  if (action === '刷新') {
    load()
    return
  }
  if (action === '表格调整') {
    openColPrefs()
    return
  }
  if (action === '表头调整') {
    openHeadPrefs()
    return
  }
  if (action === '分类管理') {
    // 客户/供应商档案 → 对应分类面板(金蝶同款:分类不占导航,从档案工具栏进)
    const target = cfgCache.value?.metadata?.classifyPanel
    const title = cfgCache.value?.metadata?.classifyTitle || target
    if (!target) return ElMessage.warning(tt('该面板没有可管理的分类'))
    const targetPath = `/panelx/list/${target}`
    router.push(targetPath)
    tabs.open({ path: targetPath, title: tt(title) })
    return
  }
  if (action === '二维码标签') {
    // 存货档案勾选即打:勾行→80×80mm 标签 PDF(二维码=存货编码);未勾选只提示,不生成
    exportQrLabels()
    return
  }
  // 文件类面板(文书式):「删除」= 整单删除(草稿直接作废;已归档提交删除申请,管理员审批)
  if (isApprovalDoc.value && (action === '删除' || action === '删除单据')) {
    if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))
    const no = current.value['编号'] || current.value['单据编号'] || ''
    try {
      await ElMessageBox.confirm(
        `${tt('确定删除整张单据？')}（${tt('草稿')}${tt('直接作废')}；${tt('已归档')}${tt('需管理员审批通过后删除')}）`,
        tt('删除确认'),
        { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') },
      )
    } catch (e) {
      return
    }
    try {
      const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '删除', formData: { 编号: no }, buttonParam: {} })
      ElMessage.success(res?.['单据状态'] === '删除申请中' ? `${no} 删除申请已提交，待管理员审核` : `${no} 已删除`)
      delMode.value = false
      delSel.value = []
      load()
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '删除失败')
    }
    return
  }
  if (action === '删除单据') {
    if (!current.value) return ElMessage.warning('请先选择一行数据')
    const no = current.value['编号'] || current.value['单据编号'] || ''
    try {
      await ElMessageBox.confirm('确认删除整张单据 ' + no + '？该操作不可恢复。', '删除单据确认', { type: 'warning' })
    } catch (e) {
      return
    }
    try {
      await engine.deleteForms({ panelCode: panelCode.value, rowCodes: [no] })
      ElMessage.success('单据已删除：' + no)
      delMode.value = false
      delSel.value = []
      load()
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '删除失败')
    }
    return
  }
  if (action === '删除') {
    if (!current.value) return ElMessage.warning('请先选择一行数据')
    if (!delMode.value) {
      delMode.value = true
      ElMessage.info('已进入删除模式：勾选要删除的行，再点「删除」确认；点「刷新」或翻页取消')
      return
    }
    if (!delSel.value.length) return ElMessage.warning('请先勾选要删除的行')
    try {
      await ElMessageBox.confirm('确认删除勾选的 ' + delSel.value.length + ' 行明细？', '删除确认', { type: 'warning' })
    } catch (e) {
      return
    }
    try {
      // 勾选删除：从当前单据对应明细中移除所选行（按对象引用匹配）
      const blk = blocks.value.find((x) => x.isMain)
      const tab = blk ? activeTab(blk) : null
      const key = tab ? tab.key : 'items'
      const items = cur.value.detail && Array.isArray(cur.value.detail[key]) ? cur.value.detail[key] : []
      const remain = items.filter((it) => !delSel.value.includes(it))
      const head = { ...cur.value }
      delete head.detail
      delete head['编号']
      delete head['单据状态']
      delete head['创建时间']
      delete head['更新时间']
      delete head['发起人编号']
      await engine.callButton({
        panelCode: panelCode.value,
        buttonName: '保存',
        formData: { ...head, 编号: cur.value['编号'], detail: { ...(cur.value.detail || {}), [key]: remain } },
        buttonParam: {},
      })
      ElMessage.success('已删除 ' + delSel.value.length + ' 行')
      delMode.value = false
      delSel.value = []
      load()
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '删除失败')
    }
    return
  }
  if (['中止执行', '整单中止', '草稿', '取消中止', '提交审批', '审批通过', '驳回审批'].includes(action)) {
    if (!current.value) return ElMessage.warning('请先选择一行数据')
  }
  // 人工审核：确认弹窗 + 审核意见（选填）；审核人取当前登录人（后端从 JWT 取）
  let auditOpinion = ''
  if (action === '审核') {
    if (!current.value) return ElMessage.warning('请先选择一行数据')
    // 已审核过的单据不允许再次审核，也不允许补填审批意见
    if (current.value['单据状态'] !== '草稿') return ElMessage.warning('仅草稿状态可审核，已审核单据不允许再次审核')
    const no = current.value['编号'] || current.value['单据编号'] || ''
    try {
      const { value } = await ElMessageBox.prompt(
        '单据：' + no + '（当前状态：' + (current.value['单据状态'] || '') + '）',
        '人工审核确认',
        { confirmButtonText: '确认审核', cancelButtonText: '取消', inputType: 'textarea', inputPlaceholder: '审核意见（选填）' }
      )
      auditOpinion = value || ''
    } catch (e) {
      return
    }
  } else if (action === '弃审') {
    if (!current.value) return ElMessage.warning('请先选择一行数据')
    if (current.value['单据状态'] !== '已审核') return ElMessage.warning('仅已审核状态可弃审')
    try {
      await ElMessageBox.confirm('确认弃审该单据？弃审后需重新审核。', '弃审确认', { type: 'warning' })
    } catch (e) {
      return
    }
  }
  try {
    // 审批流：提交审批/审批通过（确认+意见）、审批驳回（意见必填）、审批情况（历史弹窗）
    let approvalOpinion = ''
    if (action === '提交审批' || action === '审批通过') {
      if (!current.value) return ElMessage.warning('请先选择一行数据')
      // 提交审批:草稿或修改态(文件类申请修改经审批)可提交;审批通过仅审批中
      if (action === '提交审批') {
        if (!['草稿', '修改中'].includes(current.value['单据状态'])) return ElMessage.warning('仅草稿或修改中状态可提交审批')
      } else if (current.value['单据状态'] !== '审批中') {
        return ElMessage.warning('仅审批中状态可审批通过')
      }
      const no = current.value['编号'] || current.value['单据编号'] || ''
      try {
        const { value } = await ElMessageBox.prompt(
          '单据：' + no + '（当前状态：' + (current.value['单据状态'] || '') + '）',
          action + '确认',
          { confirmButtonText: '确认' + action, cancelButtonText: '取消', inputType: 'textarea', inputPlaceholder: action === '审批通过' ? '审批意见（选填）' : '提交说明（选填）' }
        )
        approvalOpinion = value || ''
      } catch (e) {
        return
      }
    } else if (action === '审批驳回') {
      if (!current.value) return ElMessage.warning('请先选择一行数据')
      if (current.value['单据状态'] !== '审批中') return ElMessage.warning('仅审批中状态可审批驳回')
      const no = current.value['编号'] || current.value['单据编号'] || ''
      try {
        const { value } = await ElMessageBox.prompt(
          '单据：' + no + '（当前状态：审批中）\n驳回必须填写审批意见',
          '审批驳回确认',
          { confirmButtonText: '确认驳回', cancelButtonText: '取消', inputType: 'textarea', inputPlaceholder: '驳回原因（必填）', inputValidator: (v) => (v && v.trim() ? true : '驳回必须填写审批意见') }
        )
        approvalOpinion = value || ''
      } catch (e) {
        return
      }
    } else if (action === '审批情况') {
      if (!current.value) return ElMessage.warning('请先选择一行数据')
      approvalNo.value = current.value['编号'] || current.value['单据编号'] || ''
      approvalVisible.value = true
      return
    }
    const actionDocumentNo = current.value?.['编号'] || current.value?.['单据编号'] || ''
    // 列表页草稿是前端内联编辑态；审核/提交审批前必须先落库，否则状态刷新后会显示数据库中的旧空明细。
    if (['审核', '提交审批'].includes(action) && draftEditable.value) {
      const saved = await saveInlineDraft('保存', { silent: true })
      if (!saved) return
    }
    const res = await engine.callButton({
      panelCode: panelCode.value,
      buttonName: action,
      formData: current.value ? { 编号: current.value['编号'], ...(auditOpinion !== '' ? { 审核意见: auditOpinion } : {}), ...(approvalOpinion !== '' ? { 审批意见: approvalOpinion } : {}) } : {},
      buttonParam: {},
    })
    if (res?.gotoPanel) {
      // 推式生单：直接跳转到目标面板列表页（不新开标签页），新生成的单据按创建时间倒序显示在第一张（草稿内联可编辑）
      ElMessage.success(`已生成${res.gotoPanel === 'MANU_ORDER' ? '生产加工单' : res.gotoPanel}：${res['编号']}，请在列表页继续填写`)
      const targetPath = `/panelx/list/${res.gotoPanel}`
      tabs.close(route.path) // 关闭当前源面板页签（页签被目标面板替换）
      router.push(targetPath)
      tabs.open({ path: targetPath, title: res.gotoPanel })
      return
    }
    ElMessage.success(`「${action}」执行成功`)
    await load()
    const actionIndex = list.value.findIndex((item) => (
      (item['编号'] || item['单据编号'] || item['锭号']) === actionDocumentNo
    ))
    if (actionIndex >= 0) curIdx.value = actionIndex
  } catch (e) {
    const msg = engine.errMsg(e) || '按钮执行失败'
    if (msg.includes('演示环境暂未实现')) ElMessage.info(msg)
    else ElMessage.error(msg)
  }
}

async function onScanApply(payload) {
  if (!draftEditable.value) {
    try {
      const created = await engine.callButton({ panelCode: panelCode.value, buttonName: '保存', formData: {}, buttonParam: {} })
      const documentNo = created?.['编号'] || created?.formNo
      if (!documentNo) throw new Error('未返回单据编号')
      await load()
      const index = list.value.findIndex((row) => row['编号'] === documentNo)
      curIdx.value = index >= 0 ? index : 0
    } catch (error) {
      ElMessage.error(engine.errMsg(error) || '新建草稿失败')
      return
    }
  }

  const fields = new Map(headerFields.value.map((field) => [headerFieldKey(field), field]))
  for (const [key, value] of Object.entries(payload?.header || {})) {
    const field = fields.get(key)
    if (!field || field.hidden || field.computed || field.autoCode || headerFieldLocked(field)) continue
    cur.value[key] = value
  }

  if (!cur.value.detail) cur.value.detail = {}
  const tabMap = new Map((cfgCache.value?.detail?.tabs || []).map((tab) => [tab.key, tab]))
  for (const [tabKey, rows] of Object.entries(payload?.detail || {})) {
    const tab = tabMap.get(tabKey)
    if (!tab || !Array.isArray(rows)) continue
    const writable = new Set((tab.fields || []).filter((field) => !field.hidden && !field.computed).map((field) => field.dataName))
    const recognizedRows = rows.map((row) => Object.fromEntries(
      Object.entries(row || {}).filter(([key]) => writable.has(key)),
    ))
    cur.value.detail[tabKey] = payload?.detailMode === 'append'
      ? [...(cur.value.detail[tabKey] || []), ...recognizedRows]
      : recognizedRows
    for (const row of cur.value.detail[tabKey]) calculateDetailRow(tabKey, row)
  }
  ElMessage.success('识别数据已填入草稿，请核对后保存')
}

async function load() {
  delMode.value = false
  delSel.value = []
  archPage.value = 1 // 档案分页随每次载入回到首页
  if (invalidPanel.value) {
    ElMessage.error('面板编号无效，请从菜单重新进入')
    return
  }
  await loadCrg() // 配置先行(弹窗门依赖 metadata.reportQueryDialog)
  if (reportQueryDialog.value && !rqdDone.value) {
    loading.value = false
    list.value = []
    total.value = 0
    openQueryDialog() // 与「查询」按钮同一个弹窗(格式一致)
    return
  }
  loading.value = true
  try {
    loadReportTemplates() // 服务端报表入口(该面板有模板才显示;不阻塞列表)
    const params = { panelCode: panelCode.value, condition: { ...condition }, pageNo: query.pageNo, pageSize: query.pageSize }
    // 模糊搜索生效中:叠加字段条件(后端 AND)与「全部字段」关键字
    if (fuzzyApplied.value?.valid) {
      Object.assign(params.condition, fuzzyApplied.value.condition || {})
      if (!query.keyword && fuzzyApplied.value.keyword) params.keyword = fuzzyApplied.value.keyword
    }
    if (query.keyword) params.keyword = query.keyword
    const res = await engine.queryFormDataList(params)
    markArchListRaw(res.list) // 档案:进入响应式系统前 markRaw 明细行(赋值后打在代理上无效)
    list.value = res.list || []
    total.value = res.totalSize || 0
    if (curIdx.value >= list.value.length) curIdx.value = 0
    // 2026-08-25：?focus=单号 定位（选单/生单从表单页跳转过来时直接显示目标单据）
    const focus = route.query.focus
    if (focus) {
      const fi = list.value.findIndex((r) => (r['编号'] || r['单据编号'] || r['锭号']) === String(focus))
      if (fi >= 0) curIdx.value = fi
      router.replace({ path: route.path, query: { ...route.query, focus: undefined } })
    }
    // 参照字段模式跟随最新数据量(增删档案跨越 20 条阈值时下拉↔弹窗自动切换)
    refreshRefModes()
    markSavedSnapshot() // 未保存离开守卫的基线快照（载入即干净；保存成功也会经此刷新）
    inlineDirtyFlag.value = false
    restoreFreshDraft() // 刷新/重进后恢复「本次新增未保存草稿」标记,守卫仍可撤回
  } catch (e) {
    const msg = engine.errMsg(e) || '加载失败'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

function search() {
  query.pageNo = 1
  curIdx.value = 0
  load()
}

function reset() {
  Object.keys(condition).forEach((k) => delete condition[k])
  query.keyword = ''
  if (isStockStatus.value) stockWh.value = ''
  search()
}

function onNewSaved() {
  load()
}

function onSelGenerated(generated) {
  const first = generated && generated[0]
  const finish = () => {
    if (first) {
      // 2026-08-25：选单生成后不再弹窗，直接定位到列表页新选入单据（一屏一单流览）
      const idx = list.value.findIndex((r) => (r['编号'] || r['单据编号'] || r['锭号']) === first.no)
      curIdx.value = idx >= 0 ? idx : 0
    }
  }
  load().then(finish)
}

// Excel 导入完成：单据面板追加到当前单明细并保存；档案面板（无明细 tab）逐行新建档案
async function onImported(rows) {
  const hasDetailTabs = (cfgCache.value?.detail?.tabs || []).length > 0
  if (!hasDetailTabs) {
    // 档案类（EMP/DEPT/WH…）：Excel 每行 = 一条新档案
    ElMessage.success('已解析 ' + rows.length + ' 行，正在逐条建档…')
    let ok = 0
    try {
      for (const r of rows) {
        await engine.callButton({ panelCode: panelCode.value, buttonName: '保存', formData: { ...r }, buttonParam: {} })
        ok++
      }
      ElMessage.success('已导入 ' + ok + ' 条档案')
    } catch (e) {
      ElMessage.error(engine.errMsg(e) || '第 ' + (ok + 1) + ' 条导入失败')
    }
    load()
    return
  }
  const blk = blocks.value.find((x) => x.id === 'A')
  const tab = blk ? activeTab(blk) : null
  const key = tab ? tab.key : 'items'
  if (!cur.value.detail || !Array.isArray(cur.value.detail[key])) {
    if (!cur.value.detail) cur.value.detail = {}
    cur.value.detail[key] = []
  }
  for (const r of rows) cur.value.detail[key].push(r)
  ElMessage.success('已导入 ' + rows.length + ' 行，正在保存…')
  try {
    const head = { ...cur.value }
    delete head.detail
    delete head['编号']
    delete head['单据状态']
    delete head['创建时间']
    delete head['更新时间']
    delete head['发起人编号']
    await engine.callButton({
      panelCode: panelCode.value,
      buttonName: '保存',
      formData: { ...head, 编号: cur.value['编号'], detail: { ...cur.value.detail } },
      buttonParam: {},
    })
    ElMessage.success('导入并保存成功')
    load()
  } catch (e) {
    ElMessage.error(engine.errMsg(e) || '保存失败')
  }
}

// 存货（INV）面板：单击行 → 打开 BOM 管理弹窗（勾选存货添加子件、可多级下钻）
function onRowClick(row, b) {
  if (row?._placeholder && detailEditable(b)) {
    openBlankDetailRow(b)
    return
  }
  // 材料明细：点材料行 → 该材料有下级 BOM 则弹窗展示其子件
  if (b && b.id === 'B' && activeTab(b).key === 'materials' && row && row['材料编码'] && hasSubBom(row['材料编码'])) {
    openSubBom(row)
    return
  }
  // 产成品→材料联动：MANU_ORDER 等单据点产成品明细行 → 材料明细只显示其 BOM 子件
  if (b && b.id === 'A' && row && row['产品编码'] && row['产品编码'] !== selectedProduct.value) {
    selectProduct(row['产品编码'])
    return
  }
  // 存货（INV）面板为纯存货管理（2026-08-25：BOM 关系维护已迁移至物料清单面板，存货行点击不再弹 BOM 管理）
  if (panelCode.value === 'INV') return
}

// 捕获阶段监听：点产成品明细行任意单元格（含固定列/控件）都触发联动
async function onTableClick(b, e) {
  if (!b || !e || !e.target || !e.target.closest) return
  const t = activeTab(b)
  // 材料明细：点材料行 → 该材料有下级 BOM 则弹窗展示其子件
  if (b.id === 'B' && t.key === 'materials') {
    const tr = e.target.closest('tr')
    if (!tr) return
    const body = tr.closest('.el-table__body-wrapper') || tr.closest('.el-table__fixed-body-wrapper')
    const rows = body ? [...body.querySelectorAll('tbody tr')] : []
    const idx = rows.indexOf(tr)
    const row = detailRows(t)[idx]
    if (row && row['材料编码'] && hasSubBom(row['材料编码'])) openSubBom(row)
    return
  }
  if (b.id !== 'A') return
  if (t.key !== 'products') return
  const tr = e.target.closest('tr')
  if (!tr) return
  const body = tr.closest('.el-table__body-wrapper') || tr.closest('.el-table__fixed-body-wrapper')
  const rows = body ? [...body.querySelectorAll('tbody tr')] : []
  const idx = rows.indexOf(tr)
  const row = detailRows(t)[idx]
  if (!row || !row['产品编码']) return
  selectProduct(row['产品编码'])
}

// 材料下级 BOM 映射（BOM 面板 children：父件编码 → 子件行）；材料编码行右上角显示红 *，点击行弹窗查看
async function loadSubBomMap() {
  try {
    const res = await engine.queryFormDataList({ panelCode: 'BOM', condition: {}, pageNo: 1, pageSize: 100 })
    const map = {}
    for (const d of res.list || []) {
      for (const it of (d.detail && d.detail.children) || []) {
        if (!String(it['子件编码'] || '').trim()) continue // 锚点行不参与
        const parent = it['父件编码']
        if (!parent) continue
        if (!map[parent]) map[parent] = []
        map[parent].push({
          材料编码: it['子件编码'],
          材料名称: it['子件名称'],
          规格型号: it['规格型号'] || '',
          计量单位: it['子件计量单位'] || '件',
          定额需用数量: it['定额数量'] ?? 0,
          '损耗率%': it['损耗率%'] ?? 0,
        })
      }
    }
    subBomMap.value = map
  } catch (err) {}
}

function hasSubBom(code) {
  const b = subBomMap.value[code]
  return Array.isArray(b) && b.length > 0
}

function openSubBom(row) {
  const code = row['材料编码']
  subBomMaterial.value = row
  subBomBom.value = (subBomMap.value[code] || []).map((r) => ({ ...r }))
  subBomVisible.value = true
}

// 选中产成品：行高亮 + 材料明细联动（物料清单 BOM 面板 children → 子件编码集合；2026-08-25 原 INV _bom 已迁移）
async function selectProduct(code) {
  selectedProduct.value = code
  selectedBomCodes.value = []
  try {
    const res = await engine.queryFormDataList({ panelCode: 'BOM', condition: {}, pageNo: 1, pageSize: 200 })
    const codes = []
    for (const d of res.list || []) {
      for (const it of (d.detail && d.detail.children) || []) {
        if (String(it['父件编码']) !== code) continue
        if (it['子件编码']) codes.push(String(it['子件编码']))
      }
    }
    selectedBomCodes.value = codes
  } catch (err) {
    // 查询失败按 子件BOM 标记兜底
  }
}

watch(
  () => [panelCode.value, operationName.value],
  () => {
    scanVisible.value = false
    // 2026-08-20：关闭页签/切走时 panelCode 变 undefined——不触发加载（避免「面板编号无效」误报）
    if (!panelCode.value || panelCode.value === 'undefined') return
    cfgCache.value = null
    qrSel.value = new Set() // 二维码标签勾选集随面板清空(行键属于上一个档案)
    resetDictModes()
    resetTableSorts() // 切面板清排序(同一面板内保留:切单据/翻页/查询都在)
    // 切面板退出模糊搜索态并清条件(条件字段属于上一个面板)
    fuzzyMode.value = false
    fuzzyRows.value = [{ field: '', value: '' }]
    fuzzySearched.value = false
    fuzzyApplied.value = null
    fuzzyPrevPageSize = null
    qOptCache.clear()
    Object.keys(condition).forEach((key) => delete condition[key])
    Object.keys(queryDraft).forEach((key) => delete queryDraft[key])
    query.keyword = ''
    queryFields.value = []
    gridTabs.value = []
    queryRefVisible.value = false
    queryRefField.value = null
    queryDialogVisible.value = false
    headerRefVisible.value = false
    headerRefField.value = null
    detailRefVisible.value = false
    detailRefPick.value = null
    curIdx.value = 0
    search()
  }
)

watch(detailRefVisible, (visible) => {
  if (!visible && !detailRefSaving.value) {
    discardCreatedDetailRefRow(detailRefPick.value)
    detailRefPick.value = null
  }
})

watch(headerRefVisible, (visible) => {
  if (!visible) headerRefField.value = null
})

watch(queryRefVisible, (visible) => {
  if (!visible) queryRefField.value = null
})

// 快捷入口「新增单据」（?new=1）统一走直接新增（不弹窗）；singleDoc 无单据时兜底弹窗新建
let newQueryHandled = false
async function handleNewQuery() {
  if (newQueryHandled) return
  if (cfgCache.value?.metadata?.singleDoc && current.value && current.value['编号']) {
    newQueryHandled = true
    ElMessage.info('请在下方列表页直接填写并保存')
    return
  }
  if (cfgCache.value?.metadata?.singleDoc) {
    newQueryHandled = true
    newVisible.value = true
    return
  }
  newQueryHandled = true
  await directAdd()
}
watch(
  () => route.query.new,
  (v) => {
    if (v) handleNewQuery()
  }
)
watch(cfgCache, (cfg) => {
  // 配置加载完成后处理初始 ?new=1（此时才能判断 singleDoc）
  if (cfg && route.query.new) handleNewQuery()
})

onMounted(() => {
  document.addEventListener('click', closeCtx)
  document.addEventListener('contextmenu', closeCtx)
  // 单据打印版式:Ctrl+P 直打印同样走 .doc-print 层;打印结束还原屏幕
  window.addEventListener('beforeprint', onBeforePrintDoc)
  window.addEventListener('afterprint', onAfterPrintDoc)
  loadSubBomMap() // 材料下级 BOM 映射（红 * 标记 + 点击行弹窗）
  if (invalidPanel.value) {
    router.replace('/panelx/list/MANU_ORDER')
    return
  }
  // 从「我的桌面 · 产品开发」矩阵跳转:带 ?docNo= 直接定位到该单据
  const jumpDocNo = route.query.docNo
  if (jumpDocNo) {
    docQueryNo.value = String(jumpDocNo)
    condition['_docNo'] = String(jumpDocNo)
    router.replace({ path: route.path, query: { ...route.query, docNo: undefined } })
  }
  load()
})

onDeactivated(() => {
  // keep-alive 切离时关闭弹窗（防止 append-to-body 弹窗残留）
  newVisible.value = false
  queryDialogVisible.value = false
  queryRefVisible.value = false
  queryRefField.value = null
  headerRefVisible.value = false
  headerRefField.value = null
  detailRefVisible.value = false
  detailRefPick.value = null
  impVisible.value = false
  scanVisible.value = false
  maintainVisible.value = false
  selVisible.value = false
})

onUnmounted(() => {
  document.removeEventListener('click', closeCtx)
  document.removeEventListener('contextmenu', closeCtx)
  window.removeEventListener('beforeprint', onBeforePrintDoc)
  window.removeEventListener('afterprint', onAfterPrintDoc)
  document.body.classList.remove('doc-printing')
})
</script>

<style scoped>
.panelx-list {
  font-size: 13px;
  color: #333;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

/* ═══════ ① 顶部工具栏（T+ 灰条）═══════ */
.tools {
  background: #f5f7fa;
  border-bottom: 1px solid #d0d7e3;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.toolbar-query-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: stretch;
  min-width: 64px;
  padding: 0 12px;
  border: 0;
  border-right: 1px solid #c8ced8;
  background: transparent;
  color: #263548;
  font: inherit;
  cursor: pointer;
}
/* 库存状况:仓库下拉(工具栏内嵌) */
.wh-filter {
  width: 190px;
  align-self: stretch;
  margin: 3px 8px;
}
/* 预警数量行内编辑 */
.warn-editable {
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 3px;
}
.warn-editable:hover {
  background: #eff6ff;
  color: #1d4ed8;
}
.warn-input {
  width: 90px;
}
.toolbar-query-btn:hover {
  background: #e7eef8;
  color: #2f4d75;
}
.tb-group {
  display: inline-flex;
  align-items: center;
  position: relative;
  border: 1px solid #c9cfdb;
  border-radius: 3px;
  overflow: visible;
  margin-right: 4px;
  background: #fff;
}
.tb-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 3000;
  min-width: 160px;
  background: #fff;
  border: 1px solid #d0d7e3;
  border-radius: 4px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
  padding: 4px 0;
  max-height: 360px;
  overflow: auto;
}
.tb-main {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  user-select: none;
}
.tb-main:hover {
  color: #2f4d75;
  background: #f0f5ff;
}
.tb-main.disabled {
  color: #b3b9c4;
  cursor: not-allowed;
}
.tb-caret {
  display: inline-flex;
  align-items: center;
  padding: 0 5px;
  font-size: 12px;
  border-left: 1px solid #c9cfdb;
  color: #555;
  cursor: pointer;
}
.act-sc {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}
.tools-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.doc-chip {
  font-size: 12px;
  color: #46586e;
  font-weight: 600;
  margin-right: 6px;
}
.doc-status {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 8px;
  margin-right: 6px;
}
.doc-cat {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 8px;
  margin-right: 6px;
  color: #7c3aed;
  border: 1px solid #ddd6fe;
  background: #f5f3ff;
}
.doc-status.已审核,
.doc-status.已完工 {
  color: #16a34a;
  border: 1px solid #bbe6c4;
  background: #f0fdf4;
}
.doc-status.生产中,
.doc-status.审批中 {
  color: #2f4d75;
  border: 1px solid #bcd2f5;
  background: #f0f6ff;
}
.doc-status.草稿 {
  color: #d97706;
  border: 1px solid #f3d9a6;
  background: #fffaf0;
}
.doc-status.已归档 {
  color: #6b7280;
  border: 1px solid #d1d5db;
  background: #f3f4f6;
}
.doc-status.删除申请中 {
  color: #b91c1c;
  border: 1px solid #f3c1c1;
  background: #fef2f2;
}
.doc-status.已终止 {
  color: #b91c1c;
  border: 1px solid #f3c1c1;
  background: #fef2f2;
  font-weight: 600;
}
.doc-status.终止审批中（立项人）,
.doc-status.终止审批中（管理员） {
  color: #2f4d75;
  border: 1px solid #bcd2f5;
  background: #f0f6ff;
}
.doc-status.修改申请中 {
  color: #b45309;
  border: 1px solid #f3d9a6;
  background: #fffbeb;
}
.doc-status.修改中 {
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
}
/* 修改记录弹窗 */
.mod-log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow: auto;
}
.mod-log-card {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px 12px;
}
.mod-log-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}
.mod-log-seq {
  font-weight: 600;
  color: #374151;
}
.mod-log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.mod-log-table th,
.mod-log-table td {
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  text-align: left;
  vertical-align: top;
  word-break: break-all;
}
.mod-log-table th {
  background: #f3f4f6;
  font-weight: 500;
}
.mod-old {
  color: #9ca3af;
}
.mod-new {
  color: #111827;
}
.mod-kind {
  display: inline-block;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
}
.mod-kind.变化 {
  color: #1d4ed8;
  background: #eff6ff;
}
.mod-kind.补充 {
  color: #047857;
  background: #ecfdf5;
}
.mod-kind.清空 {
  color: #b45309;
  background: #fffbeb;
}
.mod-log-empty,
.mod-log-nodata {
  color: #9ca3af;
  font-size: 13px;
  padding: 8px 0;
}
/* 数据记录表单据弹窗:选取列表(行可点) + 查看视图顶栏(返回列表/胶囊快捷切换) + 纸张滚动区 */
/* 导出格式选择弹窗 */
.efmt-list { display: flex; flex-direction: column; gap: 8px; }
.efmt-item {
  display: flex; align-items: center; gap: 12px;
  border: 1px solid #d4e4f1; border-radius: 6px; padding: 10px 14px;
  cursor: pointer; background: #fff;
}
.efmt-item:hover { background: #f0f7ff; border-color: #8fb4e0; }
.efmt-ico { font-size: 22px; }
.efmt-name { font-size: 14px; font-weight: 600; color: #1e5a8a; }
.efmt-desc { font-size: 12px; color: #8ba6bd; margin-top: 2px; }
.ds-back {
  color: #2f4d75;
  cursor: pointer;
  font-size: 13px;
  flex: none;
}
.ds-back:hover { text-decoration: underline; }
.ds-viewbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.ds-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ds-pill {
  border: 1px solid #bcd2f5;
  background: #f0f6ff;
  color: #46586e;
  border-radius: 12px;
  padding: 2px 12px;
  font-size: 12.5px;
  cursor: pointer;
  user-select: none;
}
.ds-pill:hover { background: #e2efff; }
.ds-pill.on {
  background: #1c4f8a;
  color: #fff;
  border-color: #1c4f8a;
}
.ds-jump {
  color: #2f4d75;
  font-size: 12.5px;
  cursor: pointer;
}
:deep(.el-table .ds-sel-row) { cursor: pointer; }
.ds-doc-wrap {
  max-height: 68vh;
  overflow: auto;
  border: 1px solid #e4edf5;
  border-radius: 4px;
  padding: 8px 8px 16px;
  background: #f6f8fa;
}
.mod-log-meta {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}
.mod-log-open {
  margin-bottom: 8px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #1d4ed8;
  background: #eff6ff;
}
/* 查询单据弹窗 */
.dq-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dq-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dq-label {
  flex: none;
  width: 64px;
  font-size: 13px;
  color: #374151;
  text-align: right;
}
.dq-tip {
  font-size: 12px;
  color: #9ca3af;
  padding-left: 74px;
}
.page-btn {
  width: 24px;
  height: 24px;
  line-height: 22px;
  text-align: center;
  border: 1px solid #c9cfdb;
  background: #fff;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: #333;
}
.page-btn:hover {
  border-color: #0d5bd3;
  color: #2f4d75;
}
.page-no {
  padding: 0 6px;
  font-size: 12px;
  color: #555;
}
.report-count {
  color: #64748b;
  font-size: 12px;
  padding-right: 6px;
}

/* ═══════ 文书式面板:纸张自适应 + 右侧收纳式操作栏(系统风格,与单据头对齐) ═══════ */
.approval-layout {
  display: flex;
  align-items: flex-start;
  min-height: 560px;
  padding-right: 0;
}
.approval-layout :deep(.approval-sheet),
.approval-layout :deep(.progress-sheet) {
  flex: 1;
  min-width: 0;
}
.approval-side {
  position: sticky;
  top: 16px;
  flex: none;
  width: 176px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  overflow-x: hidden;
  background: #fff;
  border: 1px solid #e2e6ec;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(52, 64, 84, 0.04), 0 4px 14px rgba(52, 64, 84, 0.06);
  padding: 0;
  display: flex;
  flex-direction: column;
  z-index: 20;
  transition: width 0.2s ease;
}
.approval-side.collapsed {
  width: 34px;
}
.as-side-title {
  background: #f5f6f8;
  color: #3d4756;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid #e2e6ec;
  user-select: none;
}
.approval-side.collapsed .as-side-title {
  padding: 9px 0;
  justify-content: center;
}
.as-side-toggle {
  font-size: 10px;
  color: #7a869c;
}
.approval-side.collapsed .as-side-title .as-side-toggle {
  font-size: 11px;
}
.as-side-status-row {
  display: flex;
  justify-content: center;
  padding: 9px 12px 4px;
}
.as-side-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px 11px;
  border-bottom: 1px solid #e5ecf5;
}
.approval-side .page-btn {
  border-radius: 6px;
  border-color: #cfdced;
  background: #fff;
  color: #44608a;
}
.approval-side .page-btn:hover {
  border-color: #b9c9dc;
  background: #f2f6fa;
}
.as-side-btns {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px;
}
.as-side-btn {
  display: block;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid #e2e6ec;
  border-radius: 4px;
  background: #fff;
  color: #46586e;
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}
.as-side-btn:hover {
  background: #f2f6fa;
  border-color: #b9c9dc;
  color: #2f4d75;
}
.as-side-btn.sub {
  background: transparent;
  border: none;
  color: #6b7a8d;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
}
.as-side-btn.sub:hover {
  background: #f2f6fa;
}
.as-side-btn.disabled {
  color: #b9c2ce;
  border-color: #e4ebf3;
  background: #f4f6f9;
  cursor: not-allowed;
}
.as-side-btn.disabled:hover {
  color: #b9c2ce;
  border-color: #e4ebf3;
  background: #f4f6f9;
}
/* 删除组 + 下拉 */
.as-side-del {
  position: relative;
}
.as-side-btn-row {
  display: flex;
  gap: 5px;
  align-items: stretch;
}
.as-side-caret {
  width: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dfe3ea;
  border-radius: 6px;
  background: #fff;
  color: #46586e;
  cursor: pointer;
  user-select: none;
  font-size: 9px;
  box-shadow: 0 1px 3px rgba(28, 79, 138, 0.1);
  transition: all 0.15s ease;
}
.as-side-caret:hover {
  border-color: #b9c9dc;
  color: #2f4d75;
  background: #f2f6fa;
}
.as-side-menu {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  min-width: 156px;
  background: #fff;
  border: 1px solid #e2e6ec;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(52, 64, 84, 0.12);
  z-index: 30;
  padding: 5px;
}
.as-side-menu-item {
  padding: 8px 12px;
  font-size: 12.5px;
  color: #46586e;
  cursor: pointer;
  border-radius: 6px;
  white-space: nowrap;
  transition: background 0.12s ease;
}
.as-side-menu-item:hover {
  background: #f2f6fa;
}

/* ═══════ ② 表头字段区（label 在上、输入在下）═══════ */
.fields {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid #e5e9f0;
  background: #fff;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.field label {
  font-size: 12px;
  color: #444;
  white-space: nowrap;
}
.field label.req::before {
  content: '*';
  color: #ff0033;
  margin-right: 2px;
}
.col-hdr-text.req::before {
  content: '*';
  color: #ff0033;
  margin-right: 2px;
  font-weight: bold;
}
.field :deep(.el-input),
.field :deep(.el-select),
.field :deep(.el-date-editor),
.field :deep(.el-input-number) {
  width: 160px;
}
.field :deep(.el-input__wrapper),
.field :deep(.el-select__wrapper) {
  min-height: 26px;
  padding: 1px 8px;
}
.field :deep(.el-input__inner) {
  height: 24px;
  line-height: 24px;
  font-size: 13px;
}
.query-ref {
  display: flex;
  width: 192px;
  gap: 4px;
}
.query-ref :deep(.el-input) {
  width: 160px;
}
.query-ref :deep(.el-button) {
  width: 28px;
  min-height: 26px;
  padding: 0;
}
.dict-pick-search {
  margin-bottom: 8px;
}
.dict-pick-list {
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
  border-radius: 4px;
}
.dict-pick-item {
  padding: 7px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid var(--el-border-color-lighter, #f0f2f5);
  transition: background 0.15s;
}
.dict-pick-item:last-child {
  border-bottom: none;
}
.dict-pick-item:hover {
  background: var(--el-color-primary-light-9, #ecf5ff);
}
.field-readonly {
  width: 160px;
  min-height: 26px;
  padding: 4px 8px;
  border: 1px solid #d8dde6;
  background: #f7f8fa;
  color: #3f4b5c;
  font-size: 13px;
  line-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-fields.is-draft {
  background: #fbfdff;
}
/* 附件区:表头下方独立一行,附件格常驻上传/查看(锁定单据只读) */
.attach-strip {
  display: flex;
  align-items: flex-start;
  gap: 6px 14px;
  flex-wrap: wrap;
  padding: 6px 14px 4px;
  border-top: 1px dashed #e4e7ed;
  background: #fbfdff;
}
.attach-strip-label {
  flex: 0 0 auto;
  padding-top: 8px;
  font-size: 13px;
  color: #606266;
}
.attach-slot {
  flex: 1 1 auto;
  min-width: 240px;
}
.query-dialog-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
  max-height: 520px;
  overflow-y: auto;
  padding: 2px 4px 4px;
}
/* 高级筛选(查询弹窗):条件构建器 */
.query-plan-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(17, 106, 91, 0.06);
}
.plan-label {
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
  flex: none;
}
.plan-select {
  width: 220px;
}
.plan-option-name {
  margin-right: 8px;
}
.plan-option-meta {
  color: #9ca3af;
  font-size: 12px;
}
.plan-empty {
  color: #9ca3af;
  text-align: center;
  padding: 28px 0;
}
.plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.plan-row:last-child {
  border-bottom: none;
}
.plan-name {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.plan-meta {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}
.plan-ops {
  flex: none;
  display: flex;
  gap: 2px;
}
.dark .query-plan-bar { background: rgba(255, 255, 255, 0.05); }
.dark .plan-name { color: #ddd; }
.adv-filter-section {
  margin-top: 14px;
  border-top: 1px dashed var(--t-border-light, #e5e7eb);
  padding-top: 10px;
}
.adv-filter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.adv-filter-title {
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
}
.adv-filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 110px minmax(0, 1.2fr) 28px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.adv-no-value {
  height: 24px;
  border-bottom: 1px dashed #d1d5db;
}
.dark .adv-filter-section { border-color: #3a3b42; }
.dark .adv-filter-title { color: #bbb; }
.query-dialog-field {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.query-dialog-field > label {
  overflow: hidden;
  color: #4b5563;
  font-size: 13px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 查询弹窗必填标记(单据日期/台账仓库存货) */
.query-dialog-field > label .req-star {
  color: #ff0033;
  margin-left: 2px;
  font-weight: bold;
}
.query-dialog-field :deep(.el-input),
.query-dialog-field :deep(.el-select),
.query-dialog-field :deep(.el-date-editor),
.query-dialog-field :deep(.el-input-number),
.query-dialog-field .query-ref {
  width: 100%;
}
.query-dialog-field .query-ref :deep(.el-input) {
  width: auto;
  flex: 1;
}

/* ═══════ ③ 明细区块 ═══════ */
.body {
  flex: 1;
  padding: 8px 10px 0;
  min-height: 0;
}
/* ═══ 左侧「单据选择」栏布局(送料暂收单等;rail 未启用时为透明直通容器) ═══
   2:8 严格分栏:grid 定列,minmax 保极窄屏下左栏最低 200px 仍可见 */
.doc-rail-layout {
  flex: 1;
  min-height: 0;
  /* flex 行:左栏按自身宽度(可拖拽,flex-shrink:0)占位,右栏 flex:1 自适应 ——
     不能用 grid 百分比列:左栏元素宽度与列宽不一致时右栏内容会压进左栏(交叉),且百分比列违背"不按比例缩放" */
  display: flex;
  align-items: stretch;
}
.doc-rail-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.report-body {
  flex: 1;
  min-height: 420px;
  padding: 0 10px 10px;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
}
.report-heading {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 4px;
  color: #1f2937;
}
.report-heading strong {
  font-size: 16px;
  font-weight: 600;
}
.report-heading span {
  color: #64748b;
  font-size: 12px;
}
.report-table {
  flex: 1;
  min-height: 360px;
  background: #fff;
}
:deep(.report-table th.el-table__cell) {
  background: #f3f6fa;
  color: #27364a;
  font-weight: 600;
  padding: 7px 0;
}
:deep(.report-table td.el-table__cell) {
  padding: 5px 0;
}
:deep(.report-table .el-table__footer-wrapper td) {
  background: #f8fafc;
  color: #1f2937;
}
.detail {
  border: 1px solid #d7dce5;
  margin-bottom: 8px;
  background: #fff;
  position: relative;
}
/* 档案大表分页器:右对齐贴在明细表头上沿 */
.arch-pager {
  display: flex;
  justify-content: flex-end;
  padding: 3px 8px 5px;
  border-bottom: 1px solid var(--t-border-light, #edf1ef);
}
.approved-stamp {
  position: absolute;
  top: 3px;
  left: 6px;
  z-index: 9;
  transform: rotate(-12deg);
  color: #16a34a;
  border: 2px solid #16a34a;
  border-radius: 4px;
  padding: 0 10px;
  font-size: 14px;
  font-weight: 700;
  background: rgba(240, 253, 244, 0.92);
  pointer-events: none;
  letter-spacing: 3px;
  box-shadow: 0 1px 3px rgba(22, 163, 74, 0.25);
}
.dt-head {
  display: flex;
  align-items: center;
  background: #f5f7fa;
  border-bottom: 1px solid #d0d7e3;
  min-height: 30px;
  padding: 0 6px;
}
.dt-tab {
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  color: #333;
  border-right: 1px solid #d0d7e3;
  user-select: none;
  position: relative;
}
.dt-tab:hover {
  color: #2f4d75;
}
.dt-tab.on {
  background: #fff;
  color: #2f4d75;
  font-weight: 700;
  border: 1px solid #ccc;
  border-bottom-color: #fff;
  top: 1px;
}
.dt-ics {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 4px;
}
.dt-ic {
  font-size: 12px;
  color: #555;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.dt-ic:hover {
  color: #2f4d75;
}
.mat-cell {
  position: relative;
  display: inline-block;
  width: 100%;
}
.inline-ref-editor {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}
.inline-ref-editor :deep(.el-input) {
  width: 100%;
}
.inline-computed-value {
  display: block;
  min-height: 30px;
  padding: 6px 8px;
  overflow: hidden;
  color: #556171;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inline-ref-editor.active :deep(.el-input__wrapper) {
  padding-right: 24px;
  box-shadow: 0 0 0 1px #4b74a6 inset;
}
/* 懒渲染单元格:未激活时显示纯文本,点击后挂载编辑控件 */
.detail :deep(.el-table td .cell-lazy) {
  display: block;
  min-height: 24px;
  padding: 3px 6px;
  overflow: hidden;
  border-radius: 3px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}
.detail :deep(.el-table td .cell-lazy:hover) {
  background: #f2f6ff;
  box-shadow: inset 0 0 0 1px #c7d8f5;
}
.list-ref-icon {
  position: absolute;
  right: 7px;
  top: 50%;
  z-index: 2;
  width: 12px;
  height: 12px;
  transform: translateY(-50%);
  font-size: 12px;
  color: #4b74a6;
  pointer-events: none;
}
.detail :deep(.el-table td .el-input),
.detail :deep(.el-table td .el-select),
.detail :deep(.el-table td .el-date-editor),
.detail :deep(.el-table td .el-input-number) {
  width: 100%;
}
.detail :deep(.el-table td .el-input__wrapper),
.detail :deep(.el-table td .el-select__wrapper) {
  min-height: 30px;
  border-radius: 0;
  box-shadow: 0 1px 2px rgba(52, 64, 84, 0.04), 0 4px 14px rgba(52, 64, 84, 0.06);
  background: transparent;
}
.detail :deep(.el-table td .el-input.is-disabled .el-input__wrapper),
.detail :deep(.el-table td .el-input-number.is-disabled .el-input__wrapper),
.detail :deep(.el-table td .el-select__wrapper.is-disabled),
.detail :deep(.el-table td .el-textarea.is-disabled .el-textarea__inner) {
  --el-disabled-bg-color: transparent;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
}
.detail :deep(.el-table td .el-input.is-disabled .el-input__inner),
.detail :deep(.el-table td .el-input-number.is-disabled .el-input__inner) {
  color: #556171;
  -webkit-text-fill-color: #556171;
}
:global(.panelx-list .draft-body .detail .el-input.is-disabled .el-input__wrapper),
:global(.panelx-list .draft-body .detail .el-input-number.is-disabled .el-input__wrapper),
:global(.panelx-list .draft-body .detail .el-select__wrapper.is-disabled),
:global(.panelx-list .draft-body .detail .el-textarea.is-disabled .el-textarea__inner) {
  --el-disabled-bg-color: transparent;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
}
.detail :deep(.el-table td .el-input__wrapper:hover),
.detail :deep(.el-table td .el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #aab8ca inset;
}
.detail :deep(.el-table td .el-input-number .el-input__wrapper) {
  padding: 1px 8px;
}
.detail :deep(.el-table td .el-switch) {
  margin-left: 8px;
}
.mat-star {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #e60000;
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
}
.filter-hint {
  font-size: 12px;
  color: #2f4d75;
  margin-right: 8px;
}
:deep(.prod-selected > td.el-table__cell) {
  background: #fff !important;
}
:deep(.prod-selected > td.el-table__cell:first-child) {
  box-shadow: inset 3px 0 #7a9abe;
}
:deep(.el-table th.el-table__cell) {
  background: #f7f9fc;
  color: #333;
  font-weight: 600;
}
:deep(.el-table th .cell) {
  white-space: nowrap;
}
/* 固定 5 行：所有数据行统一 31px 高（含空占位行，占位行不渲染成矮行） */
:deep(.el-table .el-table__body td) {
  height: 31px;
  padding: 0;
  vertical-align: middle;
}
:deep(.el-table .el-table__footer-wrapper .cell) {
  font-weight: 600;
}
:deep(.el-table .sum-row td) {
  background: #f7f9fc;
  font-weight: 600;
}

/* ═══════ ④ 表尾固定条（sticky 底部：滚动明细时始终可见）═══════ */
.footer {
  position: sticky;
  bottom: 0;
  z-index: 20;
  background: #fff;
  border-top: 1px solid #d0d7e3;
  box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

/* ═══════ 表尾：备注 + 分隔线 + 审核行 ═══════ */
.remark {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #fff;
}
.remark label {
  font-size: 12px;
  color: #444;
  white-space: nowrap;
}
.remark :deep(.el-input) {
  flex: 1;
  max-width: 620px;
}
.footer-hr {
  border-top: 1px solid #ccc;
  margin: 0 12px;
  background: #fff;
}
.audit-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 28px;
  padding: 8px 12px 12px;
  font-size: 12px;
  color: #555;
  background: #fff;
}

/* ═══════ 右键菜单 ═══════ */
.ctx-menu {
  position: fixed;
  z-index: 3000;
  min-width: 150px;
  background: #fff;
  border: 1px solid #d0d7e3;
  border-radius: 4px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
  padding: 4px 0;
}
.ctx-item {
  padding: 6px 14px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  user-select: none;
}
.ctx-item:hover {
  background: #f0f5ff;
  color: #2f4d75;
}
/* 2026-08-25：灰按钮下拉项（如草稿态「生成XX」）视觉置灰 */
.ctx-item.disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}
.ctx-item.disabled:hover {
  background: transparent;
  color: #c0c4cc;
}
:deep(.el-table .row-approved td) { background: #f0fdf4 !important; }
.main-grid { margin-bottom: 10px; }
.main-grid .dt-head { margin-bottom: 4px; }
.main-grid .dt-head .dt-tab.on { cursor: default; }
:deep(.main-grid .el-table .row-cur td) { background: #eaf4fe !important; }
:deep(.main-grid .el-table .ph-row td) { height: 31px; }

@media print {
  .tools,
  .fields,
  .footer,
  .ctx-menu {
    display: none !important;
  }
  .panelx-list,
  .report-body {
    display: block;
    min-height: 0;
    padding: 0;
    background: #fff;
  }
  .report-table {
    height: auto !important;
  }
}

/* ═══════ 单据打印版式(2026-09-15):宽明细表 A4 纸面优化 ═══════
   屏幕上 .doc-print 恒隐藏;打印时 body.doc-printing 激活并隐藏 A 区表单。
   策略:表头四列网格(替代一列多行) / table-layout:fixed + colgroup 百分比列宽 /
   长文本 word-break 换行 / thead table-header-group 跨页重复 / tr break-inside 禁拆。 */
.doc-print {
  display: none;
}
@media print {
  body.doc-printing .doc-print {
    display: block !important;
  }
  body.doc-printing .body,
  body.doc-printing .attach-strip,
  body.doc-printing .approval-side {
    display: none !important;
  }
  body.doc-printing .panelx-list {
    display: block;
    min-height: 0;
    padding: 0;
    background: #fff;
  }
}
.doc-print .dp-title {
  text-align: center;
  font: bold 17px/1.5 'SimHei', 'Microsoft YaHei', sans-serif;
  letter-spacing: 2px;
  margin: 1mm 0 2.5mm;
}
/* 表头:紧凑四列网格(标签:值 成对),替代屏幕上一字段一行 */
.doc-print .dp-head {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.8mm 5mm;
  border: 1.2px solid #000;
  padding: 1.6mm 2.5mm;
  margin-bottom: 2.5mm;
}
.doc-print .dp-pair {
  display: flex;
  min-width: 0;
  font: 11px/1.6 'SimSun', 'NSimSun', serif;
}
.doc-print .dp-label {
  flex: none;
}
.doc-print .dp-value {
  font-weight: 600;
  word-break: break-all;
}
/* 明细表:固定布局+百分比列宽(colgroup);长文本自动换行 */
.doc-print .dp-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font: 10.5px/1.45 'SimSun', 'NSimSun', serif;
}
.doc-print .dp-table th,
.doc-print .dp-table td {
  border: 1px solid #333;
  padding: 1mm 1.4mm;
  vertical-align: top;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.doc-print .dp-table th {
  background: #eee;
  text-align: center;
  font-weight: bold;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
/* 分页:表头每页重复;行不跨页截断 */
.doc-print .dp-table thead {
  display: table-header-group;
}
.doc-print .dp-table tbody tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

@media (max-width: 780px) {
  .query-dialog-fields {
    grid-template-columns: 1fr;
  }
}

/* ═══════ 移动端适配（≤768px）：触控尺寸 / 单列查询 / 表格横向滚动 ═══════ */
@media (max-width: 768px) {
  /* ① 顶部工具栏：允许换行、触控高度 ≥32px、按钮文字不溢出 */
  .tools {
    row-gap: 6px;
    padding: 6px 8px;
  }
  .toolbar-query-btn {
    min-height: 32px;
    padding: 0 10px;
  }
  .tb-group {
    min-height: 32px;
  }
  .tb-main {
    min-height: 32px;
    padding: 6px 10px;
    max-width: 132px;
  }
  .tb-main .act-name {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tb-caret {
    min-height: 32px;
  }
  .tb-menu {
    min-width: 140px;
    max-height: 300px;
  }

  /* ② 右上分页区：独占一行、可换行、字号 12px 防挤压 */
  .tools-right {
    flex: 1 1 100%;
    margin-left: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
    row-gap: 4px;
    font-size: 12px;
  }
  .page-btn {
    width: 30px;
    height: 30px;
    line-height: 28px;
  }

  /* ③ 查询弹窗字段：多列变单列、label 在上控件在下、间距 10px */
  .query-dialog-fields {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .query-dialog-field {
    grid-template-columns: 1fr;
    align-items: stretch;
    gap: 10px;
  }
  .query-dialog-field > label {
    text-align: left;
  }

  /* ④ 表格容器：不裁剪、不压缩，列宽溢出交给 el-table 内部横向滚动 */
  .report-body,
  .main-grid,
  .detail {
    min-width: 0;
    max-width: 100%;
  }
  .dt-head {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  :deep(.el-table .el-table__body td) {
    height: 38px;
  }
  .detail :deep(.el-table td .el-input__wrapper),
  .detail :deep(.el-table td .el-select__wrapper) {
    min-height: 34px;
  }

  /* ⑤ 表尾审计信息区：字号 12px、允许换行 */
  .footer {
    font-size: 12px;
  }
  .remark {
    flex-wrap: wrap;
  }
  .remark :deep(.el-input) {
    min-width: 160px;
  }
  .audit-line {
    gap: 6px 12px;
    padding: 8px 10px 10px;
  }

  /* ⑥ 右键菜单：最小宽度与字号适配触屏 */
  .ctx-menu {
    min-width: 130px;
    max-width: 80vw;
    font-size: 13px;
  }
  .ctx-item {
    padding: 8px 12px;
    font-size: 13px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
/* 模糊搜索态(文书侧栏) */
.fuzzy-panel { display: flex; flex-direction: column; gap: 6px; padding: 4px 0 4px 2px; }
.fuzzy-head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; font-weight: 600; color: #303133; padding: 0 2px 2px;
}
.fuzzy-back { cursor: pointer; color: #909399; font-size: 13px; }
.fuzzy-back:hover { color: #409eff; }
.fuzzy-row { display: flex; align-items: center; gap: 4px; }
.fuzzy-field { width: 92px; flex: none; }
.fuzzy-value { flex: 1; min-width: 0; }
.fuzzy-del {
  flex: none; width: 16px; text-align: center; cursor: pointer;
  color: #c0c4cc; font-size: 14px; line-height: 1;
}
.fuzzy-del:hover { color: #f56c6c; }
.fuzzy-btns { display: flex; gap: 6px; }
.fuzzy-btns .as-side-btn { flex: 1; }
.fuzzy-btns .as-side-btn.primary { background: #409eff; color: #fff; border-color: #409eff; }
.fuzzy-result { margin-top: 4px; border-top: 1px dashed #e4e7ed; padding-top: 6px; }
.fuzzy-result-head { font-size: 12px; color: #606266; margin-bottom: 4px; }
.fuzzy-result-row {
  display: flex; align-items: baseline; justify-content: space-between; gap: 6px;
  padding: 3px 4px; border-radius: 3px; cursor: pointer; font-size: 12px;
}
.fuzzy-result-row:hover { background: #f0f6ff; }
.fuzzy-result-row.on { background: #eaf4fe; font-weight: 600; }
.fz-no { color: #303133; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fz-meta { color: #909399; font-size: 11px; white-space: nowrap; }
.fuzzy-empty { font-size: 12px; color: #909399; padding: 4px; }
/* 列头点击筛选 */
.col-hdr {
  display: inline-flex; align-items: center; gap: 3px;
  cursor: pointer; user-select: none; font-size: 12px;
}
.col-hdr:hover .col-hdr-ic { color: #409eff; }
.col-hdr.filtering { color: #409eff; font-weight: 600; }
.col-hdr-ic { font-size: 12px; color: #c0c4cc; transition: color 0.15s; }
/* 列头点击排序角标:⇅ 未排序(淡) / ▲ 升序 / ▼ 降序 */
.col-hdr-sort {
  font-size: 10px; line-height: 1; color: #c8ccd4;
  cursor: pointer; padding: 0 1px; transition: color 0.15s;
}
.col-hdr:hover .col-hdr-sort { color: #9aa3af; }
.col-hdr-sort:hover { color: #409eff; }
.col-hdr-sort.on { color: #409eff; font-weight: 700; }
.col-hdr-tag {
  font-size: 10px; color: #fff; background: #409eff;
  border-radius: 8px; padding: 0 5px; line-height: 16px;
  white-space: nowrap; max-width: 60px; overflow: hidden; text-overflow: ellipsis;
}
.col-filter-inp { margin-top: 2px; width: 100%; }
.col-filter-inp .el-input__inner { font-size: 12px; padding: 0 6px; height: 24px; }

/* 表格列自定义对话框 */
.col-pref-tip { font-size: 12px; color: #888; margin-bottom: 10px; }
.col-pref-count { margin-left: 8px; padding: 1px 8px; border-radius: 8px; background: #e8f4ff; color: #409eff; font-weight: 500; }
.col-pref-list { max-height: 400px; overflow-y: auto; border: 1px solid #e8ecf1; border-radius: 4px; }
.col-pref-row {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-bottom: 1px solid #f0f0f0; cursor: grab;
}
.col-pref-row:last-child { border-bottom: none; }
.col-pref-row:hover { background: #f7f9fc; }
.cp-drag { cursor: grab; color: #ccc; font-size: 14px; user-select: none; }
.cp-drag:active { cursor: grabbing; }
.cp-order { display: flex; flex-direction: column; gap: 0; }
.cp-order .el-button { padding: 0; height: 16px; font-size: 10px; }
.cp-vis { margin-right: 2px; }
.cp-label { flex: 1; font-size: 13px; color: #333; min-width: 80px; }
.cp-alias { width: 140px; }
.cp-alias .el-input__inner { font-size: 12px; }

/* ══════════ 报表表头筛选与排序补丁 ══════════ */
/* ---- 表头排序和筛选图标 ---- */
.report-col-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  position: relative;
}
.report-col-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.report-col-operator {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  flex: none;
  margin-left: 4px;
  opacity: 0;
  transition: opacity .15s;
}
.report-col-container:hover .report-col-operator {
  opacity: 1;
}
/* 排序生效时角标常显(否则父级 opacity:0 会把已排序标记也一起藏掉) */
.report-col-operator.has-sort {
  opacity: 1;
}
.report-col-operator .on {
  opacity: 1;
}
.report-col-sorter {
  font-size: 9px;
  color: #bfbfbf;
  cursor: pointer;
  line-height: 1;
  padding: 0 1px;
}
.report-col-sorter:hover {
  color: #1677ff;
}
.report-col-sorter.on {
  color: #1677ff;
}
.report-col-filter {
  font-size: 12px;
  color: #bfbfbf;
  cursor: pointer;
  margin-left: 2px;
  display: inline-flex;
  align-items: center;
}
.report-col-filter .el-icon {
  font-size: 12px;
}
.report-col-filter:hover {
  color: #1677ff;
}
.report-col-filter.on {
  color: #1677ff;
}
/* ---- 筛选面板 ---- */
.report-filter-panel {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 6px 16px rgba(0,0,0,.08);
  min-width: 160px;
  max-width: 220px;
}
.filter-panel-header {
  padding: 8px 12px 6px;
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #f0f0f0;
}
.filter-panel-body {
  max-height: 240px;
  overflow-y: auto;
  padding: 6px 12px;
}
.filter-panel-item {
  display: flex !important;
  margin-left: 0 !important;
  height: 26px;
}
.filter-panel-text {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.filter-panel-footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid #f0f0f0;
}
/* ── 侧栏高级灰调新增块(导航合并/分组标题/危险警示/菜单防溢出) ── */
.as-side-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px 6px;
}
.as-side-nav .doc-status.none { color: #c2cad3; }
.as-side-section {
  font-size: 11px;
  letter-spacing: 2px;
  color: #9aa5b3;
  padding: 8px 2px 1px;
  border-bottom: 1px dashed #e6eaef;
  margin-bottom: 5px;
  user-select: none;
}
.as-side-btn.primary {
  background: #3d5a80;
  border-color: #3d5a80;
  color: #fff;
}
.as-side-btn.primary:hover {
  background: #46688f;
  border-color: #46688f;
  color: #fff;
}
.as-side-del.danger .as-side-btn {
  color: #a85c5c;
  border-color: #e2cdcd;
}
.as-side-del.danger .as-side-btn:hover {
  background: #faf3f3;
  border-color: #cf9f9f;
  color: #934b4b;
}
.as-side-del.danger .as-side-caret {
  color: #a85c5c;
  border-color: #e2cdcd;
}
.as-side-menu-item.danger {
  color: #934b4b;
}
.as-side-menu-item.danger:hover {
  background: #faf3f3;
}
.as-side-del .as-side-menu.flip-up {
  top: auto;
  bottom: calc(100% + 5px);
}
/* 侧栏导航一行五键:紧凑尺寸 */
.as-side-nav { padding: 8px 8px 6px; gap: 3px; }
.as-side-nav .doc-status { flex: 1; min-width: 0; max-width: 52px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; justify-content: center; }
.as-side-nav .as-side-pager { display: flex; align-items: center; gap: 2px; flex: none; }
.as-side-nav .page-btn { width: 17px; min-width: 17px; height: 20px; line-height: 18px; padding: 0; font-size: 9px; border-radius: 4px; }
.as-side-nav .page-no { min-width: 26px; text-align: center; font-size: 11px; color: #46586e; }
/* 侧栏状态栏独立居中 + 翻页器居中(2026-09-14) */
.as-side-status-row { display: flex; justify-content: center; padding: 9px 12px 2px; }
.as-side-status-row .doc-status.none { color: #c2cad3; }
.as-side-pager { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 4px 10px 10px; border-bottom: none; }
/* 暗色主题跟随 */
.dark .approval-side { background: #26282e; border-color: #3a3b42; box-shadow: none; }
.dark .as-side-title { background: #2c2e34; color: #d6d9de; border-bottom-color: #3a3b42; }
.dark .as-side-btn { background: transparent; border-color: #4a4c55; color: #c8cdd6; }
.dark .as-side-btn:hover { background: #33363e; border-color: #6b7280; color: #e6e9ee; }
.dark .as-side-btn.primary { background: #3d5a80; border-color: #3d5a80; color: #fff; }
.dark .as-side-btn.primary:hover { background: #46688f; }
.dark .as-side-btn.sub { color: #9aa3af; }
.dark .as-side-section { color: #77808c; border-bottom-color: #3a3b42; }
.dark .as-side-caret { background: transparent; border-color: #4a4c55; color: #c8cdd6; }
.dark .as-side-menu { background: #2c2e34; border-color: #3a3b42; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4); }
.dark .as-side-menu-item { color: #c8cdd6; }
.dark .as-side-menu-item:hover { background: #33363e; }
.dark .preview-card { background: #26282e; border-color: #3a3b42; }
.dark .preview-card.on { background: #2c3440; border-color: #5b8bc4; }
.dark .pc-no { color: #9ec3e8; }
.dark .pc-date { color: #6f7a86; }
.dark .pc-value { color: #c8cdd6; }
.dark .pc-label { color: #77808c; }
.dark .fuzzy-panel { background: #26282e; border-color: #3a3b42; }
.dark .fuzzy-head { color: #c8cdd6; }
.dark .fuzzy-result-row .fz-no { color: #9ec3e8; }

/* ── 导出报表:模板选择 + 模板管理(ADR-0002) ── */
.rpt-tpl-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.rpt-tpl-label { flex: none; font-size: 13px; color: #5a7a99; }
.rpt-tpl-empty { font-size: 12px; color: #b0b8c1; background: #f7f9fb; border: 1px dashed #d9e2ea; border-radius: 4px; padding: 8px 12px; margin-bottom: 10px; }
.rpt-mg-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.rpt-mg-tip { font-size: 12px; color: #9aa8b5; }
.rpt-up-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.rpt-up-label { flex: none; width: 70px; text-align: right; font-size: 13px; color: #5a7a99; }
/* ── 单据预览查找(文书侧栏,文件档案查看效果) ── */
.preview-kw { margin: 4px 0 6px; }
.preview-cards { max-height: 520px; overflow: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 2px; }
.preview-card {
  border: 1px solid #d9e2ea; border-radius: 6px; background: #fff;
  padding: 6px 8px; cursor: pointer; transition: border-color .15s, box-shadow .15s;
}
.preview-card:hover { border-color: #7fb0dd; box-shadow: 0 1px 4px rgba(30, 90, 138, .12); }
.preview-card.on { border-color: #1e5a8a; background: #f0f7ff; }
.pc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
.pc-no { font-weight: 600; font-size: 13px; color: #1e5a8a; word-break: break-all; }
.pc-date { font-size: 11px; color: #9aa8b5; margin-bottom: 3px; }
.pc-field { display: flex; gap: 6px; font-size: 12px; line-height: 18px; min-width: 0; }
.pc-label { flex: none; color: #8ba6bd; }
.pc-label::after { content: '：'; }
.pc-value { color: #444; word-break: break-all; min-width: 0; }
.pc-none { font-size: 11px; color: #c2ccd4; font-style: italic; }</style>
