<template>
  <div class="panelx-list" @click="closeCtx">
    <!-- ══════════ ① 顶部工具栏（T+ 灰条 + 单据翻页）══════════ -->
    <div class="tools">
      <button type="button" class="toolbar-query-btn" :title="tt('按表头字段查询单据')" @click.stop="openQueryDialog">
        <el-icon><Search /></el-icon>
        <span>{{ tt('查询') }}</span>
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

    <!-- 报表沿用配置查询字段；单据页显示当前单据表头，草稿态原地编辑。 -->
    <div v-if="reportMode" class="fields udl-fields">
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
    <div v-else class="fields header-fields udl-fields" :class="{ 'is-draft': draftEditable }">
      <div class="field" v-for="field in headerFields" :key="headerFieldKey(field)">
        <label :class="{ req: field.isRequired }">{{ headerFieldLabel(field) }}</label>
        <template v-if="draftEditable">
          <div v-if="isRefSelect(field)" class="query-ref-select">
            <el-select
              v-model="cur[headerFieldKey(field)]"
              clearable filterable remote allow-create default-first-option
              :disabled="headerFieldLocked(field)"
              @change="markInlineDirty"
              :remote-method="(kw) => loadRefSelectOptions(field, headerFieldKey(field), kw)"
              :loading="refSelectData[headerFieldKey(field)]?.loading"
              :placeholder="tt('输入搜索')"
              style="width: 100%"
              @focus="checkRefMode(field, headerFieldKey(field))"
            >
              <el-option v-for="o in (refSelectData[headerFieldKey(field)]?.options || [])" :key="o.value" :label="o.label" :value="o.value" />
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
                  <span class="report-col-operator">
                    <span class="report-col-sorter"
                          :class="{on: reportCols.sort.prop===child.prop && reportCols.sort.order==='asc'}"
                          @click.stop="reportCols.setSort(child.prop,'asc')">▲</span>
                    <span class="report-col-sorter"
                          :class="{on: reportCols.sort.prop===child.prop && reportCols.sort.order==='desc'}"
                          @click.stop="reportCols.setSort(child.prop,'desc')">▼</span>
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
            <template #header>
              <div class="report-col-container">
                <span class="report-col-title">{{ tt(column.label) }}</span>
                <span class="report-col-operator">
                  <span class="report-col-sorter"
                        :class="{on: reportCols.sort.prop===column.prop && reportCols.sort.order==='asc'}"
                        @click.stop="reportCols.setSort(column.prop,'asc')">▲</span>
                  <span class="report-col-sorter"
                        :class="{on: reportCols.sort.prop===column.prop && reportCols.sort.order==='desc'}"
                        @click.stop="reportCols.setSort(column.prop,'desc')">▼</span>
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

    <div v-else class="body" :class="{ 'draft-body': draftEditable }" v-loading="loading && !isBomMasterPanel">
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
        <el-table
          :data="blockRows(b)"
          :height="tableH(b)"
          border
          size="small"
          :show-summary="tabView(b, activeTab(b)) !== 'summary'"
          :summary-method="sumMethod"
          :sum-text="tt('合计')"
          :row-class-name="(o) => rowCls(o, b)"
          @selection-change="(r) => (delSel = r)"
          @row-contextmenu="(row, col, ev) => onCtx(ev, row, b)"
          @cell-dblclick="(row, col, cell, ev) => onDetailCellDblclick(row, col, ev, b)"
          @row-click="(row) => onRowClick(row, b)"
          @click.capture="(e) => onTableClick(b, e)"
        >
          <el-table-column v-if="delMode && b.isMain" type="selection" width="45" fixed="left" />
          <el-table-column
            v-for="c in blockCols(b)"
            :key="c.prop"
            :prop="c.prop"
            :label="c.label"
            :min-width="c.width"
            :align="c.align"
            :show-overflow-tooltip="!detailEditable(b)"
          >
            <template #header>
              <div class="col-hdr" :class="{ filtering: hasColFilter(c.prop) }" @click.stop="toggleColFilter(c.prop)">
                <span class="col-hdr-text">{{ c.label }}</span>
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
              <template v-if="detailEditable(b) && !row._placeholder">
                <span v-if="c.field.computed" class="inline-computed-value">{{ formatFieldValue(c.field, row[c.prop]) }}</span>
                <div v-else-if="isReferenceField(c.field)" class="inline-ref-editor" :class="{ active: isActiveDetailRefRow(row, b, c.prop) }">
                  <el-input
                    :model-value="formatFieldValue(c.field, row[c.prop])"
                    readonly
                    :title="detailRefTrigger(c.field) === 'dblclick' ? tt('双击选择存货') : tt('点击选择')"
                    @click="openClickDetailRef(c.field, row, b)"
                  />
                  <el-icon v-if="detailRefTrigger(c.field) === 'dblclick' && isActiveDetailRefRow(row, b, c.prop)" class="list-ref-icon"><Search /></el-icon>
                </div>
                <el-select
                  v-else-if="isSelectField(c.field)"
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
              <span v-else-if="c.prop === '材料编码' && activeTab(b).key === 'materials'" class="mat-cell">
                <span>{{ tt(row[c.prop] ?? '') }}</span>
                <span v-if="hasSubBom(row[c.prop])" class="mat-star" :title="tt('该材料有下级子件 BOM，点击行查看')">*</span>
              </span>
              <span v-else>{{ tt(row[c.prop] ?? '') }}</span>
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

    <!-- ══════════ 表格右键菜单（对齐真实 T+ 明细右键）══════════ -->
    <div v-if="ctx.visible" class="ctx-menu" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }">
      <div class="ctx-item" v-for="it in ctxItems" :key="it" @click="onCtxItem(it)">{{ tt(it) }}</div>
    </div>

    <!-- 未保存离开守卫(规范 §6.2):同步拦截路由,模板弹窗三态 -->
    <el-dialog v-model="leaveVisible" :title="tt('未保存提示')" width="420px" append-to-body :close-on-click-modal="false">
      <span>{{ tt('当前单据有未保存的修改，是否保存？') }}</span>
      <template #footer>
        <el-button @click="onLeaveChoice('stay')">{{ tt('取消') }}</el-button>
        <el-button @click="onLeaveChoice('discard')">{{ tt('不保存') }}</el-button>
        <el-button type="primary" @click="onLeaveChoice('save')">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>

    <RefPickDialog v-model="queryRefVisible" :field="queryRefField" mode="query" @confirm="onQueryRefConfirm" />
    <RefPickDialog v-model="headerRefVisible" :field="headerRefField" mode="header" @confirm="onHeaderRefConfirm" />
    <RefPickDialog v-model="detailRefVisible" :field="detailRefPick?.field" mode="detail" @confirm="onDetailRefConfirm" />
    <el-dialog v-model="queryDialogVisible" :title="tt('查询')" width="760px" append-to-body destroy-on-close class="header-query-dialog" @open="loadPlans">
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
        <div v-for="field in queryDialogFields" :key="headerFieldKey(field)" class="query-dialog-field">
          <label>{{ headerFieldLabel(field) }}</label>
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
    <SelectVoucherDialog v-model="selVisible" :panelCode="panelCode" :config="selCfg" @generated="onSelGenerated" />
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
      <div class="col-pref-tip">拖动或用箭头调整列顺序;勾选=显示;栏名可改。</div>
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
import { ref, reactive, computed, onMounted, onUnmounted, onDeactivated, watch, nextTick } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Filter, Plus, Search } from '@element-plus/icons-vue'
import { useTabsStore } from '@/stores/tabs'
import { useUserStore } from '@/stores/user'
import { useLocaleStore } from '@/stores/locale'
import { tt } from '@/i18n'
import { usePanelRuntime } from '@core/panel-runtime'
import { ensureScanFillAction } from '@core/button-groups'
import { useReportColumns } from '@core/report/useReportColumns'
import RefPickDialog from './RefPickDialog.vue'
import NewVoucherDialog from './NewVoucherDialog.vue'
import ApprovalHistoryDialog from './ApprovalHistoryDialog.vue'
import SelectVoucherDialog from './SelectVoucherDialog.vue'
import SubBomDialog from './SubBomDialog.vue'
import BomMasterDetail from './BomMasterDetail.vue'
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
  headerFields.value.forEach((f) => push(headerFieldKey(f)))
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

const reportMode = computed(() => cfgCache.value?.metadata?.report === true || cfgCache.value?.metadata?.panelCategory === '报表')
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
const headerFields = computed(() => {
  const fields = (cfgCache.value?.dataSchema?.fields || []).filter((field) => !field.hidden)
  const names = cfgCache.value?.metadata?.panelPageDto?.formPages?.[0]?.fieldNames
  if (!names) return fields
  const ordered = String(names).split(',').map((name) => name.trim()).filter(Boolean)
  const byName = new Map(fields.map((field) => [headerFieldKey(field), field]))
  return ordered.map((name) => byName.get(name)).filter(Boolean)
})
const queryDialogFields = computed(() => {
  const fields = reportMode.value ? queryFields.value : headerFields.value
  return fields.filter((field) => headerFieldKey(field) !== '备注')
})
const draftEditable = computed(() => {
  if (reportMode.value || ['BOM_FWD', 'BOM_REV'].includes(String(panelCode.value))) return false
  const st = cur.value?.['单据状态']
  if (st === '草稿') return true
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

watch(cur, (v) => {
  current.value = v
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
  if (!hasUnsavedChanges() || guardAsking) { curIdx.value = nextIdx; return }
  guardAsking = true
  pendingLeave.value = null
  pendingAction = async () => { curIdx.value = Math.min(nextIdx, Math.max(0, list.value.length - 1)) }
  askUnsavedLeave()
}

/** 翻页动作守卫(含跨页):脏时弹三态窗,选择后执行原翻页逻辑 */
async function guardPageAction(run) {
  if (!hasUnsavedChanges() || guardAsking) { await run(); return }
  guardAsking = true
  pendingLeave.value = null
  pendingAction = run
  askUnsavedLeave()
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
  }
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
// 主表固定 5 行（不足补占位，与明细区一致）
const mainRows = computed(() => {
  const l = list.value
  if (!l.length) return []
  const filtered = applyAdvFilters(applyColFilters(l.map((r) => r), mainCols.value.map((c) => ({ prop: c }))))
  const rows = filtered.slice(0, 5)
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
  const out = filtered
  while (out.length < MIN_ROWS) out.push({ _placeholder: true })
  return out
}

function tableH(b) {
  const hasFooter = tabView(b, activeTab(b)) !== 'summary'
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
    const vals = real.map((r) => Number(r[col.property]))
    sums[i] = isNumeric && vals.length && vals.every((v) => Number.isFinite(v)) ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : ''
  })
  return sums
}

// 审批流：当前单据已审批 → 表格左上角「已审批」角标；已审批明细行浅绿底色
const isApproved = computed(() => cur.value && cur.value['审批状态'] === '已审批')

function rowCls({ row }, b) {
  if (row._placeholder) return 'ph-row'
  if (b && b.id === 'A' && row['产品编码'] && row['产品编码'] === selectedProduct.value) return 'prod-selected'
  if (row['审批状态'] === '已审批') return 'row-approved'
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
  return !!field.computed || !!field.autoCode || ['编号', '单据状态', '创建时间', '更新时间', '发起人编号'].includes(key)
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
  const ref = field.ref && typeof field.ref === 'object' ? field.ref : field
  const refField = ref.field || ref.refField || key
  cur.value[key] = source[refField] ?? ''
  for (const map of ref.map || ref.refMap || []) {
    if (map && source[map.from] !== undefined) cur.value[map.to || map.from] = source[map.from]
  }
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
  rows.push(newDetailRow(tabKey))
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
    if (field.isRequired && emptyFieldValue(cur.value[headerFieldKey(field)])) {
      return `${headerFieldLabel(field)}不能为空`
    }
  }
  for (const tab of cfgCache.value?.detail?.tabs || []) {
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

async function saveInlineDraft(buttonName = '保存', { silent = false } = {}) {
  if (!draftEditable.value || inlineSaving.value) return false
  const validation = validateInlineDraft()
  if (validation) {
    ElMessage.warning(validation)
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
  if (cur.value['编号'] !== pick.documentNo || cur.value['单据状态'] !== '草稿') {
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
  Object.keys(condition).forEach((key) => delete condition[key])
  for (const [key, value] of Object.entries(queryDraft)) {
    if (value !== undefined && value !== null && String(value) !== '') condition[key] = value
  }
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
    提交审批: !current.value || st !== '草稿',
    审批通过: !current.value || st !== '审批中',
    审批驳回: !current.value || st !== '审批中',
   驳回审批: !current.value || st !== '审批中',
    保存: !draftEditable.value || inlineSaving.value,
    保存为草稿: !draftEditable.value || inlineSaving.value,
    保存新增: !draftEditable.value || inlineSaving.value,
    扫描填单: reportMode.value,
    // PANDA 工具栏动作(列表页语义)
    复制: !current.value,            // 整单复制=另存为一张新草稿
    放弃: false,                     // 丢弃内联草稿修改,恢复最近一次保存
    打印: false, 预览: false, 导出: false,
    发送邮件: false, 退出: false, 表格调整: false,
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
async function directAdd() {
  try {
    const res = await engine.callButton({ panelCode: panelCode.value, buttonName: '保存', formData: {}, buttonParam: {} })
    const no = res && (res['编号'] || res.formNo)
    if (!no) return ElMessage.error('新增失败：未返回单据编号')
    await load() // 刷新列表（新单按创建时间倒序置顶）
    curIdx.value = 0 // 定位到最新单据，草稿状态列表页可直接填写
    freshAdded.value = true // 本次新增尚未成功保存过：离开守卫「不保存」时据此撤回整单
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
/** 变更钩子置脏(表头/明细控件 @change;对真实交互可靠)——快照对比作兜底 */
const inlineDirtyFlag = ref(false)
function markInlineDirty() { if (draftEditable.value) inlineDirtyFlag.value = true }

/** 记录"已保存"基线快照（load 完成/保存成功后调用） */
function markSavedSnapshot() {
  try {
    savedSnapshot.value = cur.value ? JSON.stringify(currentFormData(cur.value.detail || {})) : ''
  } catch { savedSnapshot.value = '' }
}

/** 当前是否存在未保存修改（草稿态且 变更钩子置脏 或 表头/明细相对基线有变化） */
function hasUnsavedChanges() {
  if (!draftEditable.value || !cur.value) return false
  if (inlineDirtyFlag.value) return true
  try {
    return JSON.stringify(currentFormData(cur.value.detail || {})) !== savedSnapshot.value
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
  if (!hasUnsavedChanges() || guardAsking) { pendingLeave.value = null; return true }
  pendingLeave.value = to
  guardAsking = true
  nextTick(() => askUnsavedLeave()) // 守卫拦截后弹模板确认框
  return false
})

const leaveVisible = ref(false)

/** 守卫拦截后弹出模板确认框(命令式 ElMessageBox 在导航守卫上下文中不渲染,改用模板弹窗) */
function askUnsavedLeave() {
  leaveVisible.value = true
}

/** 离开守卫三态选择:save=按保存按钮落库;discard=撤回新增/放弃修改;stay=留在本页 */
async function onLeaveChoice(choice) {
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
  } else if (freshAdded.value && cur.value?.['编号']) {
    // 不保存 + 本次新增未保存过 → 撤回整单(走「删除」按钮路径:按开发规范留痕+释放占用)
    try {
      await engine.callButton({ panelCode: panelCode.value, buttonName: '删除', formData: { 编号: cur.value['编号'] }, buttonParam: {} })
      ElMessage.success(`已撤回新增：${cur.value['编号']}`)
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
  if (action === '查询' || action === '查找') {
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
    // 刷新列表并定位到新单，在列表页内联填写（不再弹新增弹窗、不跳转表单页）
    return await directAdd()
  }
  if (action === '修改') {
    if (!current.value) return ElMessage.warning('请先选择一行数据')
    openForm(current.value)
    return
  }
  if (['保存', '保存为草稿', '保存新增'].includes(action) && draftEditable.value) {
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
      const need = action === '提交审批' ? '草稿' : '审批中'
      if (current.value['单据状态'] !== need) return ElMessage.warning(action === '提交审批' ? '仅草稿状态可提交审批' : '仅审批中状态可审批通过')
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
  if (invalidPanel.value) {
    ElMessage.error('面板编号无效，请从菜单重新进入')
    return
  }
  loading.value = true
  try {
    await loadCrg()
    const params = { panelCode: panelCode.value, condition: { ...condition }, pageNo: query.pageNo, pageSize: query.pageSize }
    if (query.keyword) params.keyword = query.keyword
    const res = await engine.queryFormDataList(params)
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
  loadSubBomMap() // 材料下级 BOM 映射（红 * 标记 + 点击行弹窗）
  if (invalidPanel.value) {
    router.replace('/panelx/list/MANU_ORDER')
    return
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
.toolbar-query-btn:hover {
  background: #e7eef8;
  color: #0d5bd3;
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
  color: #0d5bd3;
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
  color: #1c4f8a;
  font-weight: 600;
  margin-right: 6px;
}
.doc-status {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
  margin-right: 6px;
}
.doc-cat {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
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
  color: #0d5bd3;
  border: 1px solid #bcd2f5;
  background: #f0f6ff;
}
.doc-status.草稿 {
  color: #d97706;
  border: 1px solid #f3d9a6;
  background: #fffaf0;
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
  color: #0d5bd3;
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
  border-radius: 10px;
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
  color: #0d5bd3;
}
.dt-tab.on {
  background: #fff;
  color: #0d5bd3;
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
  color: #0d5bd3;
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
  box-shadow: none;
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
  color: #0d5bd3;
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
  color: #0d5bd3;
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
/* 列头点击筛选 */
.col-hdr {
  display: inline-flex; align-items: center; gap: 3px;
  cursor: pointer; user-select: none; font-size: 12px;
}
.col-hdr:hover .col-hdr-ic { color: #409eff; }
.col-hdr.filtering { color: #409eff; font-weight: 600; }
.col-hdr-ic { font-size: 12px; color: #c0c4cc; transition: color 0.15s; }
.col-hdr-tag {
  font-size: 10px; color: #fff; background: #409eff;
  border-radius: 8px; padding: 0 5px; line-height: 16px;
  white-space: nowrap; max-width: 60px; overflow: hidden; text-overflow: ellipsis;
}
.col-filter-inp { margin-top: 2px; width: 100%; }
.col-filter-inp .el-input__inner { font-size: 12px; padding: 0 6px; height: 24px; }

/* 表格列自定义对话框 */
.col-pref-tip { font-size: 12px; color: #888; margin-bottom: 10px; }
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
</style>
