<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       数据记录表 7 张文书面板(RecordSheetPanels)——按《04数据记录表.xlsx》一比一复刻
       覆盖:碱性/矿化/抑菌/阻垢性能/RO保护/浸泡安全/压降、精度
       配置驱动:recordSheetConfigs.js;整页共用一套列网格(cfg.grid=Excel 原表列宽),
       报告头/条件区/数据表竖线全页对齐;数据键=字段 label(中文)
       特例块:碱性原水水质条 / 浸泡安全(浸泡液用量+仪器检出限) / 矿化(4 指标块+散点图)
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="record-sheet rsp-sheet">
    <!-- ═══ 页签(规格书多页结构:封面/修订与范围/检验要求/关键物料/包装运输) ═══ -->
    <div v-if="pageList.length" class="rsp-pages">
      <div
        v-for="(pg, pi) in pageList"
        :key="'pg' + pi"
        class="rsp-page-tab"
        :class="{ active: activePage === pi }"
        @click="activePage = pi"
      >{{ tt(pg.title) }}</div>
    </div>

    <!-- ═══ 报告头(report 版式,仅封面页):公司名 | 文档编号 + 大标题 | 信息块;规格书=文档式封面 ═══ -->
    <table v-if="!isPlain && activePage === 0" class="rs-t rs-head-t" :style="{ width: gridW + 'px' }">
      <colgroup><col v-for="(w, i) in effGrid" :key="'hc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <!-- 规格书文档式封面:按《C-95-33 伊可普高品质功能炭棒规格书》设计图逐像素复刻
             (设计画布 708×1173px,内层全部坐标=设计像素,由 --cok=gridW/708 等比缩放)
             公司左上 | 大标题居中偏右(设计图标题中心 367.5/708)| 6 条字段线 | 窄居中签名表 -->
        <template v-if="cfg.cover">
          <tr><td :colspan="nCols" class="rsp-cover-td">
            <div class="rsp-cover-page" :style="{ height: coverPageH + 'px', '--cok': coverK, '--cvy': coverVy }">
              <div class="rsp-cover-company">惠州市银嘉环保科技有限公司</div>
              <div class="rsp-cover-title">{{ tt(cfg.staticTitle || '产品规格书') }}</div>
              <div v-for="(fd, fi) in cfg.cover.fields" :key="'cf' + fi" class="rsp-cover-line" :style="{ top: coverLineTop(fi) }">
                <span class="rsp-cover-label">{{ tt(fd.label) }}：</span>
                <el-input v-if="editable" v-model="head[fd.key]" size="small" class="rsp-cover-input" :maxlength="fd.max || 200" @input="emit('dirty')" />
                <span v-else class="rsp-cover-val">{{ head[fd.key] || '' }}</span>
              </div>
              <table class="rsp-sign-t">
                <colgroup><col v-for="(w, i) in coverSignW" :key="'cw' + i" :style="{ width: w + 'px' }" /></colgroup>
                <tbody>
                  <tr>
                    <th v-for="(sg, si) in cfg.cover.sign" :key="'sh' + si" class="rsp-sign-th">{{ tt(sg.label) }}</th>
                  </tr>
                  <tr>
                    <td v-for="(sg, si) in cfg.cover.sign" :key="'sd' + si" class="rsp-sign-td">
                      <el-input v-if="editable" v-model="head[sg.key]" size="small" class="rsp-sign-input" maxlength="100" @input="emit('dirty')" />
                      <span v-else class="rsp-cover-val">{{ head[sg.key] || '' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td></tr>
        </template>
        <!-- 标准报告头(其它文书面板) -->
        <template v-else>
        <tr>
          <td class="rs-td rs-company-cell" :colspan="nCols - 1">惠州市银嘉环保科技有限公司</td>
          <td class="rs-td rs-docno">
            <el-input v-if="editable" v-model="head['文档编号']" size="small" maxlength="30" class="rs-docno-input" @input="emit('dirty')" />
            <template v-else>{{ head['文档编号'] || head['单据编号'] || cfg.docNoDefault || 'YJ-PD-01' }}</template>
          </td>
        </tr>
        <tr>
          <td class="rs-td rs-topic-cell" :colspan="infoSpan ? effHead.title : nCols" :rowspan="infoSpan || 1">
            <el-input v-if="editable && !derivedTitle" v-model="head['测试主题']" size="small" class="rs-topic-input" :placeholder="tt(cfg.titlePlaceholder)" @input="emit('dirty')" />
            <span v-else class="rs-topic">{{ derivedTitle || head['测试主题'] || tt(cfg.titlePlaceholder) }}</span>
          </td>
          <template v-if="infoSpan">
            <td class="rs-td rs-info-label" :colspan="effHead.infoLabel">{{ tt(effInfo[0].label) }}</td>
            <td class="rs-td rs-info-value" :colspan="effHead.infoValue">
              <el-select v-if="editable && effInfo[0].type === 'select'" v-model="head[effInfo[0].key]" size="small" :clearable="false" @change="emit('dirty')">
                <el-option v-for="o in selectOptions(effInfo[0].key)" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <el-input v-else-if="editable" v-model="head[effInfo[0].key]" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
              <template v-else>{{ head[effInfo[0].key] || '' }}</template>
            </td>
          </template>
        </tr>
        <template v-if="infoSpan > 1">
          <tr v-for="ii in infoSpan - 1" :key="'hi' + ii">
            <td class="rs-td rs-info-label" :colspan="effHead.infoLabel">{{ tt(effInfo[ii].label) }}</td>
            <td class="rs-td rs-info-value" :colspan="effHead.infoValue">
              <el-select v-if="editable && effInfo[ii].type === 'select'" v-model="head[effInfo[ii].key]" size="small" :clearable="false" @change="emit('dirty')">
                <el-option v-for="o in selectOptions(effInfo[ii].key)" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <el-input v-else-if="editable" v-model="head[effInfo[ii].key]" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
              <template v-else>{{ head[effInfo[ii].key] || '' }}</template>
            </td>
          </tr>
        </template>
        </template>
      </tbody>
    </table>

    <!-- ═══ 条件区(共享网格:标签=第1列,值跨其余列;与数据表竖线对齐;按页归属渲染) ═══ -->
    <table v-for="(sec, si) in cfg.sections" v-show="pageOf(sec) === activePage" :key="'sec' + si" class="rs-t" :style="{ width: secW(sec) + 'px' }">
      <colgroup><col v-for="(w, i) in secCols(sec)" :key="'sc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <tr v-if="sec.bar"><td :colspan="secCols(sec).length" class="rs-sectionbar">{{ tt(sec.bar) }}</td></tr>

        <!-- 文档式行(规格书 P4 章节:6.包装方式/7.运输要求/8.存储环境 无表格线) -->
        <template v-if="sec.doc">
          <tr v-for="(row, ri) in sec.rows" :key="'dl' + ri">
            <td :colspan="secCols(sec).length" class="rsp-doccell">
              <div class="rsp-docrow">
                <span class="rsp-doclabel">{{ tt(row.label) }}：</span>
                <el-input v-if="editable" v-model="head[row.key]" type="textarea" :autosize="{ minRows: row.area ? 2 : 1, maxRows: 8 }" size="small" class="rsp-docinput" :maxlength="row.max || 2000" @input="emit('dirty')" />
                <span v-else class="rsp-docval rsp-pre">{{ head[row.key] || '' }}</span>
                <span v-if="editable" class="rsp-lib-pick" @click.stop="openSectionLib(row)">⌄ {{ tt('标准库') }}</span>
              </div>
            </td>
          </tr>
        </template>

        <!-- 键值对行(产品基本信息/检验计划信息行):pairs=[{label,key,type,vspan,cells}] 逐格铺网格 -->
        <template v-for="(row, ri) in sec.rows" v-if="!sec.doc" :key="'pr' + ri">
          <tr v-if="row.pairs">
            <template v-for="(pair, pi) in row.pairs" :key="'p' + pi">
              <td class="rs-td rs-label" :colspan="pair.lspan || 1" :rowspan="pair.rowspan || 1">{{ tt(pair.label) }}</td>
              <template v-if="pair.cells">
                <td v-for="(c, ci) in pair.cells" :key="'pc' + ci" class="rs-td" :colspan="ci === pair.cells.length - 1 ? (pair.vspan || 1) : 1" :rowspan="pair.rowspan || 1">
                  <el-input v-if="editable" v-model="head[c.key]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" />
                  <span v-else class="rs-txt">{{ head[c.key] || '' }}</span>
                </td>
              </template>
              <td v-else class="rs-td" :colspan="pair.vspan || 1" :rowspan="pair.rowspan || 1">
                <el-select v-if="editable && pair.type === 'select'" v-model="head[pair.key]" size="small" :clearable="false" @change="emit('dirty')">
                  <el-option v-for="o in selectOptions(pair.key)" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <el-input v-else-if="editable && pair.type === 'text'" v-model="head[pair.key]" size="small" :maxlength="pair.max || 300" class="rs-t-in" @input="emit('dirty')" />
                <el-input v-else-if="editable" v-model="head[pair.key]" type="textarea" :autosize="{ minRows: 1, maxRows: 8 }" size="small" :maxlength="pair.max || 2000" class="rs-t-in" @input="emit('dirty')" />
                <span v-else class="rs-txt">{{ head[pair.key] || '' }}</span>
              </td>
            </template>
          </tr>

          <!-- 单元格网格行(成型工艺:产品基本信息两行式/工序阶段块/列标题行)——
               cell = {label|key/fixed, type, span, rowspan, cap(灰表头样式弱化) } 逐格铺 sec.cols -->
          <tr v-else-if="row.grid">
            <template v-for="(c, ci) in row.grid" :key="'g' + ci">
              <td v-if="c.label" class="rs-td rs-label" :colspan="c.span || 1" :rowspan="c.rowspan || 1"
                  :style="c.cap ? 'background:#9c9c9c;color:#fff;font-weight:600;font-size:12.5px' : ''">{{ tt(c.label) }}</td>
              <td v-else class="rs-td" :colspan="c.span || 1" :rowspan="c.rowspan || 1">
                <el-select v-if="editable && c.type === 'select'" v-model="head[c.key]" size="small" :clearable="false" @change="emit('dirty')">
                  <el-option v-for="o in selectOptions(c.key)" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <el-input v-else-if="editable && c.key" v-model="head[c.key]" size="small" :maxlength="c.max || 2000" :placeholder="c.ph ? tt(c.ph) : ''" class="rs-t-in" @input="emit('dirty')" />
                <span v-else class="rs-txt">{{ head[c.key] || c.fixed || '' }}</span>
              </td>
            </template>
          </tr>

          <!-- 工序阶段行(成型工艺):左端 stage 纵向合并 + 参数键值对(可两对) -->
          <tr v-else-if="sec.stage">
            <td v-if="row.stage" class="rs-td rs-label rsp-stage" :rowspan="stageSpan(sec, ri)" :colspan="2">{{ tt(row.stage) }}</td>
            <td class="rs-td rs-label">{{ tt(row.label) }}</td>
            <td class="rs-td" :colspan="row.label2 ? 2 : 5">
              <el-input v-if="editable" v-model="head[row.key]" size="small" :maxlength="row.max || 500" class="rs-t-in" @input="emit('dirty')" />
              <span v-else class="rs-txt">{{ head[row.key] || '' }}</span>
            </td>
            <template v-if="row.label2">
              <td class="rs-td rs-label">{{ tt(row.label2) }}</td>
              <td class="rs-td" colspan="2">
                <el-input v-if="editable" v-model="head[row.key2]" size="small" :maxlength="row.max2 || 500" class="rs-t-in" @input="emit('dirty')" />
                <span v-else class="rs-txt">{{ head[row.key2] || '' }}</span>
              </td>
            </template>
          </tr>

          <!-- 常规单标签行 -->
          <tr v-else>
            <td class="rs-td rs-label">{{ tt(row.label) }}</td>
            <!-- 多值单元格(如 阻垢 特殊配方 1#/2#/3#,Excel B:D/E:G/H:K 合并) -->
            <template v-if="row.cells">
              <td v-for="c in row.cells" :key="c.key" class="rs-td" :colspan="c.span || 1">
                <el-input v-if="editable" v-model="head[c.key]" size="small" maxlength="100" class="rs-t-in" :placeholder="c.ph || ''" @input="emit('dirty')" />
                <span v-else class="rs-txt">{{ head[c.key] || '' }}</span>
              </td>
            </template>
            <td v-else class="rs-td" :colspan="nCols - 1">
              <el-input v-if="editable && row.type === 'text'" v-model="head[row.key]" size="small" :maxlength="row.max || 300" class="rs-t-in" @input="emit('dirty')" />
              <el-input v-else-if="editable" v-model="head[row.key]" type="textarea" :autosize="{ minRows: row.tall ? 3 : 1, maxRows: 12 }" size="small" :maxlength="row.max || 2000" class="rs-t-in" @input="emit('dirty')" />
              <span v-else class="rs-txt" :class="{ 'rsp-pre': row.tall }">{{ head[row.key] || '' }}</span>
            </td>
          </tr>
        </template>

        <!-- 特例:碱性 原水水质条件(6 指标格按 Excel C:D/E/F:H/I:J/K:L/M:N 跨网格列) -->
        <template v-if="sec.waterStrip">
          <tr>
            <td class="rs-td rs-label rsp-water-label" rowspan="2">{{ tt('原水水质条件') }}</td>
            <td class="rs-td rsp-water-zone" :colspan="nCols - 1">
              <table class="rs-inner">
                <colgroup><col v-for="(w, i) in cfg.grid.slice(1)" :key="'wc' + i" :style="{ width: w + 'px' }" /></colgroup>
                <tbody>
                  <tr>
                    <td v-for="(cs, i) in cfg.waterColspans" :key="'wn' + i" :colspan="cs" class="rs-ind-name">{{ tt(waterNames[i]) }}</td>
                  </tr>
                  <tr>
                    <td v-for="(cs, i) in cfg.waterColspans" :key="'wv' + i" :colspan="cs" class="rs-water-val">
                      <template v-if="i < 3">
                        <el-select v-if="editable" v-model="head[waterKeys[i]]" size="small" :clearable="false" @change="emit('dirty')"><el-option v-for="o in selectOptions(waterKeys[i])" :key="o.value" :label="o.label" :value="o.value" /></el-select>
                        <template v-else>{{ head[waterKeys[i]] || '' }}</template>
                      </template>
                      <template v-else>
                        <el-input v-if="editable" v-model="head[waterKeys[i]]" size="small" class="rs-c-in" @input="emit('dirty')" />
                        <span v-else class="rs-txt">{{ head[waterKeys[i]] || '' }}</span>
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>

        <!-- 特例:浸泡安全 浸泡液用量 + 测试用仪器/检出限(值3/检出限跨2列,Excel F:G) -->
        <template v-if="sec.soakBlocks">
          <tr>
            <td class="rs-td rs-label rsp-water-label" rowspan="2">{{ tt('浸泡液用量') }}</td>
            <td class="rs-td rs-label">{{ tt('炭棒尺寸') }}</td>
            <td v-for="(cs, i) in cfg.soakColspans" :key="'sv' + i" class="rs-td" :colspan="cs">
              <el-input v-if="editable" v-model="head[soakSizeKeys[i]]" size="small" maxlength="60" class="rs-t-in" @input="emit('dirty')" />
              <span v-else class="rs-txt">{{ head[soakSizeKeys[i]] || '' }}</span>
            </td>
          </tr>
          <tr>
            <td class="rs-td rs-label">{{ tt('浸泡液用量（ml）') }}</td>
            <td v-for="(cs, i) in cfg.soakColspans" :key="'sv2' + i" class="rs-td" :colspan="cs">
              <el-input v-if="editable" v-model="head[soakVolKeys[i]]" size="small" maxlength="60" class="rs-t-in" @input="emit('dirty')" />
              <span v-else class="rs-txt">{{ head[soakVolKeys[i]] || '' }}</span>
            </td>
          </tr>
          <tr>
            <td class="rs-td rs-label rsp-water-label" rowspan="5">{{ tt('测试用仪器/检出限') }}</td>
            <td class="rs-th">{{ tt('测试项目') }}</td>
            <td class="rs-th">{{ tt('仪器名称') }}</td>
            <td class="rs-th">{{ tt('品牌型号') }}</td>
            <td class="rs-th" :colspan="cfg.soakColspans[2]">{{ tt('检出限') }}</td>
          </tr>
          <tr v-for="it in soakInstrumentRows" :key="it.name">
            <td class="rs-td rsp-item-name">{{ tt(it.name) }}</td>
            <td class="rs-td"><el-input v-if="editable" v-model="head[it.keys[0]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head[it.keys[0]] || '' }}</span></td>
            <td class="rs-td"><el-input v-if="editable" v-model="head[it.keys[1]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head[it.keys[1]] || '' }}</span></td>
            <td class="rs-td" :colspan="cfg.soakColspans[2]"><el-input v-if="editable" v-model="head[it.keys[2]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><span v-else class="rs-txt">{{ head[it.keys[2]] || '' }}</span></td>
          </tr>
        </template>
      </tbody>
    </table>

    <!-- ═══ 数据记录表(共享网格;支持子头行+两级表头;矿化 4 指标块各带散点图;按页归属渲染) ═══ -->
    <div v-for="(dt, di) in cfg.dataTables" v-show="pageOf(dt) === activePage" :key="'dt' + di" class="rsp-dt-wrap" :class="{ 'with-chart': dt.charts }">
      <div class="rsp-dt-table">
        <table class="rs-t rs-dt" :class="{ 'rsp-design-t': dt.design }" :style="{ width: (dtOwnsWidth(dt) ? (dt.design ? dtW(dt) * designK(dt) : dtW(dt)) : isPlain ? plainW(dt) : gridW) + 'px' }">
          <colgroup>
            <template v-if="isPlain || dtOwnsWidth(dt)">
              <col v-for="(c, i) in visCols(dt)" :key="'dc' + i" :style="{ width: ((c.w || 100) * (dt.design ? designK(dt) : 1)).toFixed(1) + 'px' }" />
            </template>
            <template v-else>
              <col v-for="(w, i) in effGrid" :key="'dc' + i" :style="{ width: w + 'px' }" />
            </template>
            <col v-if="editable" style="width:0" />
          </colgroup>
          <tbody>
            <!-- plain 版式:标题条 + 副标题行(测试项目：/设备名称：/仪器名称/型号：) -->
            <tr v-if="isPlain">
              <td :colspan="totalSpan(dt)" class="rsp-plain-title">{{ tt(cfg.plainTitle) }}</td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
            <tr v-if="isPlain && cfg.subtitle">
              <td :colspan="totalSpan(dt)" class="rsp-subtitle-row" :class="{ right: cfg.subtitle.align === 'right' }">
                <span class="rsp-sub-label">{{ tt(cfg.subtitle.label) }}</span>
                <el-select v-if="editable && cfg.subtitle.type === 'select'" v-model="head[cfg.subtitle.key]" size="small" class="rsp-sub-ctl" :clearable="false" @change="emit('dirty')">
                  <el-option v-for="o in variantOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <el-input v-else-if="editable" v-model="head[cfg.subtitle.key]" size="small" maxlength="100" class="rsp-sub-ctl" @input="emit('dirty')" />
                <span v-else class="rsp-sub-value">{{ head[cfg.subtitle.key] || '' }}</span>
              </td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
            <!-- report 版式带变体时:变体切换行(如 申请单类型) -->
            <tr v-if="!isPlain && cfg.variantKey">
              <td :colspan="2" class="rsp-subtitle-row rsp-left">
                <span class="rsp-sub-label">{{ tt(variantLabel) }}</span>
                <el-select v-if="editable" v-model="head[cfg.variantKey]" size="small" class="rsp-sub-ctl" :clearable="false" @change="emit('dirty')">
                  <el-option v-for="o in variantOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <span v-else class="rsp-sub-value">{{ head[cfg.variantKey] || '' }}</span>
              </td>
              <td :colspan="Math.max(1, totalSpan(dt) - 2)" class="rsp-subtitle-row rsp-quiet"></td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
            <!-- 页面级标题(规格书修订记录:设计图为居中大标题,非格式区条) -->
            <tr v-if="dt.pageTitle" :class="{ 'rsp-design': dt.design }">
              <td :colspan="totalSpan(dt)" class="rsp-page-title" :style="designTitleStyle(dt)">{{ tt(dt.pageTitle) }}</td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
            <tr v-if="dt.bar && !dt.pageTitle">
              <td :colspan="totalSpan(dt)" class="rs-sectionbar">
                <span style="display:inline-flex;align-items:center;gap:12px;justify-content:center;width:100%">
                  <span>{{ tt(dt.bar) }}</span>
                  <span v-if="dt.lib && editable" class="rs-lib-btn" @click.stop="openLib(dt)">⧉ {{ tt('从标准库勾选') }}</span>
                </span>
              </td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
            <tr v-if="dt.subHeads">
              <td v-for="(sh, shi) in spreadSubHeads(dt)" :key="'sh' + shi" :colspan="sh.span" class="rs-subhead">{{ tt(sh.label) }}</td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
            <!-- 分组式设计表头(检验项目及标准:检验项目跨 组/子项目 两列,单行表头) -->
            <tr v-if="dt.design?.groupCol" class="rs-grp rsp-design">
              <th class="rs-th" :style="designThStyle(dt)">{{ tt('序号') }}</th>
              <th class="rs-th" :style="designThStyle(dt)" colspan="2">{{ tt('检验项目') }}</th>
              <th class="rs-th" :style="designThStyle(dt)">{{ tt('检验要求') }}</th>
              <th class="rs-th" :style="designThStyle(dt)">{{ tt('检验方法') }}</th>
              <th class="rs-th" :style="designThStyle(dt)">{{ tt('检验依据') }}</th>
              <th v-if="editable" class="rs-th-op"></th>
            </tr>
            <template v-else>
              <tr class="rs-grp" :class="{ 'rsp-design': dt.design }">
                <template v-for="(g, gi) in headerRow1(dt)" :key="'h1' + gi">
                  <th v-if="g.kind === 'plain'" class="rs-th" :style="designThStyle(dt)" :rowspan="g.rowspan" :colspan="g.span > 1 ? g.span : undefined">{{ tt(g.label) }}</th>
                  <th v-else-if="g.kind === 'group'" class="rs-th" :style="designThStyle(dt)" :colspan="g.span">{{ tt(g.label) }}</th>
                </template>
                <th v-if="editable" class="rs-th-op" :rowspan="hasGroup(dt) ? 2 : 1"></th>
              </tr>
              <tr v-if="hasGroup(dt)" class="rs-grp2">
                <th v-for="c in groupCols(dt)" :key="'h2' + c.key" class="rs-th" :colspan="(c.span || 1) > 1 ? c.span : undefined">{{ tt(c.label) }}</th>
              </tr>
            </template>
            <!-- 分组式数据行(检验项目及标准:序号/组跨行,子项目列,要求/方法/依据可编辑) -->
            <template v-if="dt.design?.groupCol">
              <tr v-for="r in designGroupRows(dt)" :key="r.key" class="rsp-design">
                <td class="rs-td" :style="designTdStyle(dt, 'seq')" :rowspan="r.groupFirst ? r.group.count : undefined">{{ r.groupFirst ? r.seq : '' }}</td>
                <td class="rs-td" :style="designTdStyle(dt, 'item')" :rowspan="r.groupFirst ? r.group.count : undefined" :colspan="r.standalone ? 2 : 1">{{ r.groupFirst ? tt(r.group.label) : '' }}</td>
                <td v-if="!r.standalone" class="rs-td" :style="designTdStyle(dt, 'item')">{{ tt(r.sub || '') }}</td>
                <td class="rs-td" :style="designTdStyle(dt, 'req')">
                  <el-input v-if="editable" v-model="r.row['检验要求']" type="textarea" :autosize="{ minRows: 1, maxRows: 12 }" size="small" class="rs-t-in rsp-area-left" @input="emit('dirty')" />
                  <span v-else class="rs-txt rsp-cell rsp-pre">{{ r.row['检验要求'] || ' / ' }}</span>
                </td>
                <td class="rs-td" :style="designTdStyle(dt, 'method')">
                  <el-input v-if="editable" v-model="r.row['检验方法']" type="textarea" :autosize="{ minRows: 1, maxRows: 12 }" size="small" class="rs-t-in rsp-area-left" @input="emit('dirty')" />
                  <span v-else class="rs-txt rsp-cell rsp-pre">{{ r.row['检验方法'] || ' / ' }}</span>
                </td>
                <td class="rs-td" :style="designTdStyle(dt, 'basis')">
                  <el-input v-if="editable" v-model="r.row['检验依据']" type="textarea" :autosize="{ minRows: 1, maxRows: 12 }" size="small" class="rs-t-in rsp-area-left" @input="emit('dirty')" />
                  <span v-else class="rs-txt rsp-cell rsp-pre">{{ r.row['检验依据'] || ' / ' }}</span>
                </td>
                <td v-if="editable" class="rs-td-op"><span class="rs-op-add" @click="addRow(dt)">＋</span><span class="rs-op-del" @click="removeRow(r.row)">×</span></td>
              </tr>
            </template>
            <tr v-else v-for="(row, i) in rowsOf(dt)" :key="row.id ?? ('new' + di + '-' + i)" :class="{ 'rsp-design': dt.design }">
              <td v-for="c in visCols(dt)" :key="c.key" class="rs-td" :style="designTdStyle(dt)" :colspan="(c.span || 1) > 1 ? c.span : undefined">
                <el-input v-if="editable && c.area" v-model="row[c.key]" type="textarea" :autosize="{ minRows: 2, maxRows: 10 }" size="small" class="rs-t-in" :style="designInputStyle(dt)" @input="emit('dirty')" />
                <el-input v-else-if="editable" v-model="row[c.key]" size="small" class="rs-c-in" :style="designInputStyle(dt)" @input="emit('dirty')" />
                <span v-else class="rs-txt rsp-cell">{{ row[c.key] || ' / ' }}</span>
              </td>
              <td v-if="editable" class="rs-td-op"><span class="rs-op-add" @click="addRow(dt)">＋</span><span class="rs-op-del" @click="removeRow(row)">×</span></td>
            </tr>
            <tr v-if="!rowsOf(dt).length">
              <td :colspan="totalSpan(dt)" class="rs-empty">—</td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
            <!-- 合计行(成型配方:比例/含量/设计添加量数值求和) -->
            <tr v-if="dt.totalCols && rowsOf(dt).length">
              <td class="rs-td rsp-total" colspan="2">{{ tt('合计') }}</td>
              <td v-for="(c, ci) in visCols(dt).slice(2)" :key="'tt' + ci" class="rs-td rsp-total" :colspan="(c.span || 1) > 1 ? c.span : undefined">
                {{ totalOf(dt, c.key) || '' }}
              </td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
            <!-- 页脚须知(仪器使用记录表) -->
            <tr v-if="dt.footerNote">
              <td :colspan="totalSpan(dt)" class="rsp-footnote">{{ tt(dt.footerNote) }}</td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
          </tbody>
        </table>
        <div v-if="editable" class="rs-add" :style="{ width: (isPlain ? plainW(dt) : (dtOwnsWidth(dt) ? (dt.design ? dtW(dt) * designK(dt) : dtW(dt)) : gridW)) + 'px' }" @click="addRow(dt)">＋ {{ tt('新增数据记录行') }}</div>
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

    <!-- ═══ 表尾文档式章节行(规格书第4页:5.关键物料列表数据表之后跟 6-8 章节) ═══ -->
    <table v-for="(sec, si) in cfg.tailDocSections || []" v-show="pageOf(sec) === activePage" :key="'tds' + si" class="rs-t" :style="{ width: gridW + 'px' }">
      <colgroup><col v-for="(w, i) in secCols(sec)" :key="'tdc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <tr v-for="(row, ri) in sec.rows" :key="'tdr' + ri">
          <td :colspan="secCols(sec).length" class="rsp-doccell">
            <div class="rsp-docrow">
              <span class="rsp-doclabel">{{ tt(row.label) }}：</span>
              <el-input v-if="editable" v-model="head[row.key]" type="textarea" :autosize="{ minRows: row.area ? 2 : 1, maxRows: 8 }" size="small" class="rsp-docinput" :maxlength="row.max || 2000" @input="emit('dirty')" />
              <span v-else class="rsp-docval rsp-pre">{{ head[row.key] || '' }}</span>
              <span v-if="editable" class="rsp-lib-pick" @click.stop="openSectionLib(row)">⌄ {{ tt('标准库') }}</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 表尾区(成型配方:配料要求——数据表之后) ═══ -->
    <table v-for="(sec, si) in cfg.tailSections || []" :key="'ts' + si" class="rs-t" :style="{ width: gridW + 'px' }">
      <colgroup><col v-for="(w, i) in effGrid" :key="'tc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <tr><td :colspan="nCols" class="rs-sectionbar">{{ tt(sec.bar) }}</td></tr>
        <tr v-for="(row, ri) in sec.rows" :key="'tr' + ri">
          <td class="rs-td rs-label">{{ tt(row.label) }}</td>
          <td class="rs-td" :colspan="nCols - 1">
            <el-input v-if="editable && row.type === 'text'" v-model="head[row.key]" size="small" :maxlength="row.max || 300" class="rs-t-in" @input="emit('dirty')" />
            <el-input v-else-if="editable" v-model="head[row.key]" type="textarea" :autosize="{ minRows: 1, maxRows: 8 }" size="small" :maxlength="row.max || 2000" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head[row.key] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 结论区(共享网格;Excel 无结论区的表不渲染) ═══ -->
    <table v-if="cfg.conclusion" class="rs-t" :style="{ width: gridW + 'px' }">
      <colgroup><col v-for="(w, i) in cfg.grid" :key="'cc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <tr><td :colspan="nCols" class="rs-sectionbar">{{ tt(cfg.conclusion.bar) }}</td></tr>
        <tr>
          <td class="rs-td rs-conclusion" :colspan="nCols">
            <el-input v-if="editable" v-model="head[cfg.conclusion.key]" type="textarea" :autosize="{ minRows: 2, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <span v-else class="rs-txt">{{ head[cfg.conclusion.key] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 标准库勾选弹窗(规格书检验要求:分组标准库;出货检验计划必测项+型式项:扁平表格) ═══ -->
    <el-dialog v-model="libVisible" :title="tt('检验项目标准库')" width="880px" append-to-body>
      <template v-if="libRows.length && Array.isArray(libRows[0].subs)">
        <el-scrollbar max-height="520">
          <div v-for="(g, gi) in libRows" :key="'lg' + gi" class="lib-group">
            <div class="lib-group-name">{{ tt(g.name) }}</div>
            <div class="lib-group-subs">
              <el-checkbox
                v-for="(s, si) in g.subs"
                :key="'ls' + gi + '-' + si"
                :model-value="libChecked.includes(gi + ':' + si)"
                @change="(v) => toggleLib(gi + ':' + si, !!v)"
              >
                <span class="lib-sub-name">{{ s.name ? tt(s.name) : tt('（项目）') }}</span>
                <span class="lib-sub-req">{{ (s.req || '').split('\n')[0].slice(0, 26) }}</span>
              </el-checkbox>
            </div>
          </div>
        </el-scrollbar>
        <div class="lib-custom">
          <div class="lib-custom-title">{{ tt('补充自定义检验项') }}({{ tt('存入后长期可用') }})</div>
          <div class="lib-custom-form">
            <el-input v-model="libCGroup" size="small" :placeholder="tt('检验项目(组名)')" />
            <el-input v-model="libCSub" size="small" :placeholder="tt('子项目(可空)')" />
            <el-input v-model="libCReq" size="small" type="textarea" :rows="2" :placeholder="tt('检验要求')" />
            <el-input v-model="libCMethod" size="small" :placeholder="tt('检验方法')" />
            <el-input v-model="libCBasis" size="small" :placeholder="tt('检验依据')" />
            <el-button size="small" type="primary" @click="addCustomTestLib">{{ tt('存入标准库') }}</el-button>
          </div>
        </div>
      </template>
      <el-table
        v-else
        :data="libRows"
        size="small"
        border
        max-height="480"
        @selection-change="(sel) => (libChecked = sel)"
      >
        <el-table-column type="selection" width="42" />
        <el-table-column prop="控制项目" :label="tt('控制项目')" min-width="110" />
        <el-table-column prop="质量控制内容" :label="tt('质量控制内容')" min-width="110" />
        <el-table-column prop="检测仪器" :label="tt('检测仪器、工具')" min-width="100" />
        <el-table-column prop="控制标准及要求" :label="tt('控制标准及要求')" min-width="220" />
        <el-table-column prop="检验" :label="tt('检验')" width="60" />
        <el-table-column prop="检测频率" :label="tt('检测频率')" min-width="90" />
        <el-table-column prop="检验内容" :label="tt('检验内容')" min-width="140" />
        <el-table-column prop="控制方法" :label="tt('控制方法')" min-width="90" />
      </el-table>
      <template #footer>
        <el-button @click="libVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="confirmLib">{{ tt('追加选中项') }}({{ libChecked.length }})</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 章节标准库(yj_std_lib,lib=spec.section):点击填入 / 自行补充 / 删除 ═══ -->
    <el-dialog v-model="secLibVisible" :title="tt('章节标准库') + ' · ' + tt(secLibLabel)" width="720px" append-to-body>
      <div class="sec-lib-list">
        <div v-for="e in secLibRows" :key="e.id" class="sec-lib-item" @click="applySectionLib(e.content)">
          <div class="sec-lib-text">{{ e.content }}</div>
          <span class="sec-lib-del" @click.stop="removeSectionLib(e)">✕</span>
        </div>
        <div v-if="!secLibRows.length" class="sec-lib-empty">{{ tt('暂无条目，可在下方补充') }}</div>
      </div>
      <div class="sec-lib-add">
        <el-input v-model="secLibDraft" type="textarea" :rows="3" :placeholder="tt('新条目(默认带入当前值，编辑后存入)')" />
        <el-button type="primary" @click="addSectionLib">{{ tt('存入标准库') }}</el-button>
      </div>
      <template #footer>
        <el-button @click="secLibVisible = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { tt } from '@/i18n'
import { ElMessage } from 'element-plus'
import request from '@/core/request'
import { recordSheetConfigs } from './recordSheetConfigs'

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  panelCode: { type: String, required: true },
})
const emit = defineEmits(['dirty'])

const cfg = computed(() => recordSheetConfigs[props.panelCode] || null)
const isPlain = computed(() => cfg.value?.headMode === 'plain')

/** 动态列变体:按头字段值解析(加标水经 variantOptions 映射/委托单直取),缺省第一个变体 */
const activeVariant = computed(() => {
  const vs = cfg.value?.variants
  if (!vs) return null
  const val = props.head?.[cfg.value.variantKey]
  if (val) {
    if (vs[val]) return { name: val, ...vs[val] }
    const opt = (cfg.value.variantOptions || []).find((o) => o.value === val)
    if (opt && vs[opt.variant]) return { name: opt.variant, ...vs[opt.variant] }
  }
  const first = Object.keys(vs)[0]
  return { name: first, ...vs[first] }
})
const variantOptions = computed(() => {
  if (cfg.value?.variantOptions) return cfg.value.variantOptions.map((o) => ({ value: o.value, label: o.value }))
  return selectOptions(cfg.value?.variantKey)
})
const variantLabel = computed(() => (cfg.value?.variantKey || '') + (cfg.value?.variantKey ? '：' : ''))

const effGrid = computed(() => activeVariant.value?.grid || cfg.value?.grid || [])
const effHead = computed(() => activeVariant.value?.head || cfg.value?.head || {})
const nCols = computed(() => effGrid.value.length)
/** 网格总宽:所有表格显式用这个宽度,列分界线全页严格一致(数据表编辑态另加 60px 操作列) */
const gridW = computed(() => effGrid.value.reduce((s, w) => s + w, 0))

/* ── 规格书文档式封面(设计图 708×1173 逐像素复刻):内层坐标=设计像素,由 --cok 等比缩放 ──
   测量自《C-95-33 伊可普高品质功能炭棒规格书》(设计图): 公司 y19..38 / 标题 y191..239 /
   6 字段行 x≈173..177,行距 67px / 签名表 x132..604,y990..1112,列宽 143/157/172 */
const COVER_W = 708
const COVER_H = 1173
const coverK = computed(() => gridW.value / COVER_W)
/** 封面高度 = 真实 A4(210×297mm):设计画布 1173/708≈1.657 比 A4(1.414)长,按画布高等比
 *  会在打印时溢出到第二页;纵向位置/行高用独立缩放 coverVy 压入 A4 高度,横向(字号/列宽)仍用 coverK */
const coverPageH = computed(() => Math.round(gridW.value * (297 / 210)))
const coverVy = computed(() => coverPageH.value / COVER_H)
/** 字段行顶部(设计 px,行高 46 → ink 中心 482.5/549.5/617/683/750/817.5 = 设计墨迹中心) */
const COVER_LINE_TOPS = [460, 527, 594, 660, 727, 795]
function coverLineTop(i) {
  const y = COVER_LINE_TOPS[i] ?? (COVER_LINE_TOPS[0] + i * 67)
  return (y * coverVy.value).toFixed(1) + 'px'
}
const COVER_SIGN_W = [143, 157, 172] // x 132..275..432..604 (设计图实测)
const coverSignW = COVER_SIGN_W

/** 报告头右侧信息块(数据记录表=密级/适用范围/测试负责人/报告编号;委托单=文件管理人/密级/文件使用范围) */
const DEFAULT_INFO = [
  { label: '密级', key: '密级', type: 'select' },
  { label: '适用范围', key: '适用范围', type: 'select' },
  { label: '测试负责人', key: '测试负责人', type: 'text' },
  { label: '报告编号', key: '报告编号', type: 'text' },
]
const effInfo = computed(() => {
  const info = cfg.value?.info
  if (info === undefined) return DEFAULT_INFO
  return info
})
const infoSpan = computed(() => effInfo.value.length)

/** 报告头大标题:静态/前缀+头字段派生(规格书=产品规格书·名称,委托单=类型+'-测试申请单'),否则为 测试主题 输入 */
const derivedTitle = computed(() => {
  if (cfg.value?.staticTitle) return cfg.value.staticTitle
  if (cfg.value?.titleFromKey) {
    const v = props.head?.[cfg.value.titleFromKey] || cfg.value.titlePlaceholder || ''
    if (v || !cfg.value.titlePlaceholder) return (cfg.value.titlePrefix || '') + v + (cfg.value.titleSuffix || '')
  }
  return null
})

// ── 多页结构(规格书):页签切换,各区块按 page 归属渲染 ──
const activePage = ref(0)
const pageList = computed(() => cfg.value?.pages || [])
function pageOf(block) {
  return block.page ?? 0
}
watch(() => props.panelCode, () => { activePage.value = 0 })

/** plain 版式表格列宽与总宽(无全页网格,列宽取 col.w) */
function plainCols(dt) {
  return colsOf(dt)
}
function plainW(dt) {
  return colsOf(dt).reduce((s, c) => s + (c.w || 100), 0)
}
function colsOf(dt) {
  return activeVariant.value?.cols || dt.cols || []
}

// ── 标准库勾选(规格书检验要求 26 组分组标准库 / 出货检验计划 必测项+型式项) ──
const libVisible = ref(false)
const libChecked = ref([])
const libRows = ref([])
async function openLib(dt) {
  libTargetDt.value = dt
  const lib = dt.lib
  if (Array.isArray(lib)) {
    // 出货检验计划:内置两套标准库
    libRows.value = lib
  } else if (cfg.value?.testLib) {
    // 规格书检验项目:内置分组 + yj_std_lib 自定义项合并(可自行补充,不写死)
    const base = JSON.parse(JSON.stringify(cfg.value.testLib))
    try {
      const res = await request.get('/stdlib/list', { params: { lib: 'spec.test' } })
      for (const r of res?.data || []) {
        let c = {}
        try { c = JSON.parse(r.content) } catch { c = {} }
        let g = base.find((x) => x.name === r.item)
        if (!g) { g = { name: r.item, subs: [] }; base.push(g) }
        g.subs.push({ name: c.sub || '', req: c.req || '', method: c.method || '', basis: c.basis || '' })
      }
    } catch { /* 标准库接口不可用则仅内置 */ }
    libRows.value = base
  } else {
    libRows.value = []
  }
  libChecked.value = []
  libVisible.value = true
}
/** 分组标准库勾选(键=组下标:子项下标);扁平表格走 el-table selection-change */
function toggleLib(key, on) {
  const i = libChecked.value.indexOf(key)
  if (on && i < 0) libChecked.value = [...libChecked.value, key]
  else if (!on && i >= 0) libChecked.value = libChecked.value.filter((k) => k !== key)
}
const libTargetDt = ref(null)
// 自定义检验项补充(存 yj_std_lib,长期可用)
const libCGroup = ref('')
const libCSub = ref('')
const libCReq = ref('')
const libCMethod = ref('')
const libCBasis = ref('')
async function addCustomTestLib() {
  const group = libCGroup.value.trim()
  if (!group || !libCReq.value.trim()) {
    ElMessage.warning(tt('请填写检验项目与检验要求'))
    return
  }
  try {
    await request.post('/stdlib/add', {
      lib: 'spec.test',
      item: group,
      content: JSON.stringify({ sub: libCSub.value.trim(), req: libCReq.value.trim(), method: libCMethod.value.trim(), basis: libCBasis.value.trim() }),
    })
    ElMessage.success(tt('已存入标准库'))
    libCGroup.value = ''
    libCSub.value = ''
    libCReq.value = ''
    libCMethod.value = ''
    libCBasis.value = ''
    await openLib(libTargetDt.value)
  } catch (e) {
    ElMessage.error(tt('保存失败'))
  }
}
function confirmLib() {
  const dt = libTargetDt.value
  if (!dt) return
  const arr = touch()
  const grouped = libRows.value.length && Array.isArray(libRows.value[0].subs)
  if (grouped) {
    for (const key of libChecked.value) {
      const [gi, si] = key.split(':').map(Number)
      const g = libRows.value[gi]
      const s = g && g.subs[si]
      if (!g || !s) continue
      arr.push({
        '表区': dt.filterVal,
        '检验项目': s.name ? g.name + '·' + s.name : g.name,
        '检验要求': s.req || '',
        '检验方法': s.method || '',
        '检验依据': s.basis || '',
      })
    }
  } else {
    for (const row of libChecked.value) {
      arr.push(dt.filterKey ? { [dt.filterKey]: dt.filterVal, ...row } : { ...row })
    }
  }
  libChecked.value = []
  libVisible.value = false
  emit('dirty')
}

/** 数据表列宽是否自持(列带 w 时数据表用自己的 colgroup,与全页网格解耦——出货检验计划/规格书) */
function dtOwnsWidth(dt) {
  return visCols(dt).some((c) => c.w)
}
function dtW(dt) {
  return visCols(dt).reduce((s, c) => s + (c.w || 100), 0)
}

// ── 像素级还原(dt.design):配置为设计图像素单位,按 k = 网格宽 / 可见列设计宽 等比缩放 ──
function designK(dt) {
  if (!dt.design) return 1
  const w = visCols(dt).reduce((s, c) => s + (c.w || 100), 0)
  return w ? gridW.value / w : 1
}
function dpx(dt, v) {
  return Math.round(v * designK(dt))
}
function designTitleStyle(dt) {
  if (!dt.design) return null
  const d = dt.design
  return {
    fontSize: dpx(dt, d.titleSize || 21) + 'px',
    letterSpacing: '0',
    padding: `${dpx(dt, d.titleTop || 14)}px 0 ${dpx(dt, d.titleGap || 16)}px`,
  }
}
function designThStyle(dt) {
  if (!dt.design) return null
  const d = dt.design
  return { height: dpx(dt, d.headerH || 22) + 'px', fontSize: dpx(dt, d.fontSize || 11) + 'px', background: '#fff', color: '#333' }
}
function designTdStyle(dt, alignKey) {
  if (!dt.design) return null
  const d = dt.design
  const alignMap = { seq: 'center', item: 'center', sub: 'center', req: 'left', method: 'left', basis: 'left' }
  const style = { fontSize: dpx(dt, d.fontSize || 11) + 'px', textAlign: alignMap[alignKey] || 'center' }
  if (d.rowH) style.height = dpx(dt, d.rowH) + 'px'
  return style
}
function designInputStyle(dt) {
  if (!dt.design) return null
  return { fontSize: dpx(dt, dt.design.fontSize || 11) + 'px', textAlign: 'center' }
}

// ── 分组式设计表(检验项目及标准):行按「组·子项」前缀分组,组跨行、序号按组编号 ──
function designGroupRows(dt) {
  const out = []
  let g = null
  for (const row of rowsOf(dt)) {
    const label = row['检验项目'] || ''
    const dot = label.indexOf('·')
    const gLabel = dot >= 0 ? label.slice(0, dot) : label
    const sub = dot >= 0 ? label.slice(dot + 1) : ''
    if (!g || g.label !== gLabel) {
      g = { label: gLabel, count: 0, seq: out.filter((x) => x.groupFirst).length + 1 }
    }
    g.count++
    out.push({ key: 'gr' + out.length, row, group: g, groupFirst: g.count === 1, sub, standalone: dot < 0, seq: g.seq })
  }
  return out
}

// ── 键值对行(产品基本信息等):pair {label,key,type,vspan,cells:[{key}](多值格,如炭棒规格3格)} ──
function pairCells(pair) {
  const out = [{ kind: 'label', label: pair.label }]
  if (pair.cells) for (const c of pair.cells) out.push({ kind: 'value', key: c.key })
  else out.push({ kind: 'value', key: pair.key })
  return out
}

// ── 条件区列格式:sec.cols 自定义(工序/检验格数据),缺省沿用面板网格 ──
function secCols(sec) {
  return sec.cols || effGrid.value
}
function secW(sec) {
  return secCols(sec).reduce((s, w) => s + w, 0)
}

// ── 工序阶段行:行左端 stage 单元格纵向合并(Excel A 列 灌料/烧结/脱模…) ──
function stageSpan(sec, ri) {
  let n = 1
  for (let i = ri + 1; i < sec.rows.length && !sec.rows[i].stage; i++) n++
  return n
}

// ── 合计行(成型配方):对指定列求数值和 ──
function totalOf(dt, key) {
  const sum = rowsOf(dt).reduce((s, r) => {
    const v = parseFloat(r[key])
    return Number.isFinite(v) ? s + v : s
  }, 0)
  return sum ? String(Math.round(sum * 10000) / 10000) : ''
}

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
function selectOptions(key) {
  const f = fieldMap.value.get(key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// 碱性原水水质条:6 指标名与字段键(前3个 √/× 下拉,后3个文本)
const waterNames = ['自来水', '超纯水', 'RO纯水（水效水+RO机）', 'PH', 'TDS', '水温']
const waterKeys = ['原水自来水', '原水超纯水', '原水RO纯水', '原水PH', '原水TDS', '水温']

// 浸泡安全:浸泡液用量块 + 仪器/检出限 4 行(PH/TDS/浊度/重金属)
const soakSizeKeys = ['炭棒尺寸（1）', '炭棒尺寸（2）', '炭棒尺寸（3）']
const soakVolKeys = ['浸泡液用量（1）ml', '浸泡液用量（2）ml', '浸泡液用量（3）ml']
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
  return colsOf(dt).filter((c) => !c.hiddenCol)
}
function groupCols(dt) {
  return visCols(dt).filter((c) => c.group)
}
function hasGroup(dt) {
  return groupCols(dt).length > 0
}
/** 可见列的总跨度(网格列数口径) */
function totalSpan(dt) {
  return visCols(dt).reduce((s, c) => s + (c.span || 1), 0)
}
/** 一级表头:非 group 列(rowspan=2 仅当有两级表头);group 列合并为一条(colspan=成员跨度之和) */
function headerRow1(dt) {
  const out = []
  for (const c of visCols(dt)) {
    if (!c.group) {
      out.push({ kind: 'plain', label: c.label, span: c.span || 1, rowspan: hasGroup(dt) ? 2 : 1 })
    } else if (!out.length || out[out.length - 1].kind !== 'group' || out[out.length - 1].label !== c.group) {
      out.push({ kind: 'group', label: c.group, span: c.span || 1 })
    } else {
      out[out.length - 1].span += c.span || 1
    }
  }
  return out
}
/** 子头行(碱性:口感测试/离子分析):按网格列跨度铺 colspan */
function spreadSubHeads(dt) {
  const total = totalSpan(dt)
  const out = []
  let used = 0
  for (const sh of dt.subHeads || []) {
    const span = Math.min(sh.span, total - used)
    if (span > 0) out.push({ label: sh.label, span })
    used += span
  }
  return out
}
/** 行集:矿化按 指标 / 规格书按 表区 分块(filterKey+filterVal);其余全量 */
function rowsOf(dt) {
  if (dt.filterKey) return items.value.filter((r) => (r[dt.filterKey] || '') === dt.filterVal)
  if (!dt.metric) return items.value
  return items.value.filter((r) => (r['指标'] || '') === dt.metric)
}
function addRow(dt) {
  const row = dt.filterKey ? { [dt.filterKey]: dt.filterVal } : {}
  if (dt.metric) row['指标'] = dt.metric
  if (cfg.value?.autoSeq) row['序号'] = String(touch().length + 1)
  touch().push(row)
  emit('dirty')
}
function removeRow(row) {
  const arr = touch()
  const i = arr.indexOf(row)
  if (i >= 0) arr.splice(i, 1)
  emit('dirty')
}

// 明细预置(seedRows):进入草稿编辑且明细为空时自动带出标准行(浸泡安全 17 项卫生项目/组装工艺 20 道工序)
// 监听含 head 对象本身:cur 整体替换(单据加载)时也会触发,避免预填丢失
watch(() => [props.editable, props.head], ([v]) => {
  if (!v || !cfg.value?.seedRows) return
  if (!props.head || !props.head['单据编号']) return
  const arr = touch()
  if (arr.length) return
  for (const row of cfg.value.seedRows) {
    arr.push({ ...row })
  }
})

// 章节默认值(规格书 7.运输要求/8.存储环境 通用文案):进入草稿编辑且字段为空时预填
watch(() => [props.editable, props.head], ([v]) => {
  if (!v || !cfg.value?.sectionDefaults) return
  if (!props.head || !props.head['单据编号']) return
  for (const [k, val] of Object.entries(cfg.value.sectionDefaults)) {
    if (props.head[k] === undefined || props.head[k] === null || String(props.head[k]).trim() === '') {
      props.head[k] = val
    }
  }
})

// ── 章节标准库(yj_std_lib,lib=spec.section):1-3/6-8 章节内容可勾选示例、可自行补充 ──
const secLibVisible = ref(false)
const secLibRows = ref([])
const secLibLabel = ref('')
const secLibKey = ref('')
const secLibDraft = ref('')
async function openSectionLib(row) {
  secLibKey.value = row.key
  secLibLabel.value = row.label
  secLibDraft.value = props.head?.[row.key] || ''
  secLibVisible.value = true
  await loadSectionLib()
}
async function loadSectionLib() {
  try {
    const res = await request.get('/stdlib/list', { params: { lib: 'spec.section', item: secLibLabel.value } })
    secLibRows.value = res?.data || []
  } catch (e) {
    secLibRows.value = []
  }
}
function applySectionLib(content) {
  if (!props.head) return
  props.head[secLibKey.value] = content
  emit('dirty')
  secLibVisible.value = false
}
async function addSectionLib() {
  const text = (secLibDraft.value || '').trim()
  if (!text) return
  try {
    await request.post('/stdlib/add', { lib: 'spec.section', item: secLibLabel.value, content: text })
    ElMessage.success(tt('已存入标准库'))
    secLibDraft.value = ''
    await loadSectionLib()
  } catch (e) {
    ElMessage.error(tt('保存失败'))
  }
}
async function removeSectionLib(entry) {
  try {
    await request.post('/stdlib/remove', { id: entry.id })
    await loadSectionLib()
  } catch (e) {
    ElMessage.error(tt('删除失败'))
  }
}

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
/* ═══ 纸张/表基础(与功能性滤效同一视觉语言;宽度=网格列宽总和,竖线全页对齐) ═══ */
.record-sheet {
  width: fit-content;
  margin: 16px auto 26px;
  background: #fff;
  font-size: 14px;
  color: #222;
}
.rs-t {
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
  width: 90%;
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
.rs-topic-input :deep(.el-input__inner) {
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #333;
  text-align: center;
  height: 40px;
}
.rs-info-label {
  background: #d9d9d9;
  text-align: center;
  font-size: 13px;
  padding: 6px 4px;
}
.rs-info-value {
  font-size: 13px;
  padding: 4px 8px;
}
.rs-info-value :deep(.el-select) {
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

/* ═══ 页面级标题(规格书修订记录:设计图居中大标题,无表格线) ═══ */
.rsp-page-title {
  border: none !important;
  color: #1f2d3d;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: 6px;
  padding: 16px 0 12px;
  text-align: center;
}

/* ═══ 像素级还原数据表(dt.design):单元格垂直居中,输入/文本随单元格字号 ═══ */
.rsp-design-t .rs-td,
.rsp-design-t .rs-th {
  padding: 0 4px;
  text-align: center;
  vertical-align: middle;
}
.rsp-design-t .rs-th {
  font-weight: 400;
}
.rsp-design-t .el-input__inner,
.rsp-design-t .el-textarea__inner {
  font-size: inherit !important;
  text-align: center;
}

/* 分组式设计单元格(检验项目及标准):要求/方法/依据 左对齐多行文本 */
.rsp-area-left .el-textarea__inner {
  text-align: left;
}

/* 标准库勾选(分组) */
.lib-group {
  margin-bottom: 6px;
}
.lib-group-name {
  background: #f5f7fa;
  border-left: 3px solid #d3a6a9;
  font-weight: 600;
  padding: 4px 8px;
}
.lib-group-subs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 18px;
  padding: 6px 8px;
}
.lib-sub-name {
  font-weight: 600;
}
.lib-sub-req {
  color: #909399;
  font-size: 12px;
  margin-left: 4px;
}

/* 自定义检验项补充表单 */
.lib-custom {
  border-top: 1px dashed #dcdfe6;
  margin-top: 10px;
  padding-top: 8px;
}
.lib-custom-title {
  color: #606266;
  font-size: 12.5px;
  margin-bottom: 6px;
}
.lib-custom-form {
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.lib-custom-form .el-input,
.lib-custom-form .el-textarea {
  width: 200px;
}

/* 章节标准库 */
.rsp-lib-pick {
  align-self: center;
  border: 1px solid #8fb4e0;
  border-radius: 3px;
  color: #0d5bd3;
  cursor: pointer;
  flex: none;
  font-size: 12px;
  padding: 1px 6px;
  white-space: nowrap;
}
.rsp-lib-pick:hover {
  background: #ecf2fb;
}
.sec-lib-list {
  max-height: 320px;
  overflow: auto;
}
.sec-lib-item {
  align-items: flex-start;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  padding: 6px 8px;
}
.sec-lib-item:hover {
  background: #f5f7fa;
  border-color: #c6e2ff;
}
.sec-lib-text {
  flex: 1;
  font-size: 13px;
  white-space: pre-wrap;
}
.sec-lib-del {
  color: #f56c6c;
  cursor: pointer;
  flex: none;
  font-size: 12px;
}
.sec-lib-empty {
  color: #909399;
  font-size: 13px;
  padding: 8px;
}
.sec-lib-add {
  align-items: flex-end;
  display: flex;
  gap: 8px;
  margin-top: 10px;
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
}
.rs-water-val {
  text-align: center;
}
.rs-water-val :deep(.el-select) {
  width: 64px;
}
.rsp-item-name {
  text-align: center;
  font-size: 13.5px;
}
.rsp-stage {
  font-weight: 600;
  font-size: 14px;
  vertical-align: middle;
}
.rsp-total {
  text-align: center;
  font-weight: 600;
  color: #333;
  background: #f2f2f2;
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
/* 操作列无边框浮动:＋/× 按钮悬浮于网格右缘之外,不占表格边框——编辑态全页右边缘仍对齐网格 */
.rs-th-op {
  width: 0;
  min-width: 0;
  overflow: visible;
}
.rs-th-op,
.rs-td-op,
.rsp-op-pad {
  border: none !important;
  background: transparent !important;
  padding: 4px 2px;
}
.rs-td-op {
  text-align: center;
  white-space: nowrap;
  overflow: visible;
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

/* ═══ 页签(规格书多页) ═══ */
.rsp-pages {
  display: flex;
  gap: 2px;
  margin-bottom: 8px;
  justify-content: center;
}
.rsp-page-tab {
  padding: 5px 18px;
  border: 1px solid #b7c9dd;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: #e8eef5;
  color: #33517a;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.rsp-page-tab:hover {
  background: #dde8f2;
}
.rsp-page-tab.active {
  background: #fff;
  color: #1c4f8a;
  font-weight: 700;
  border-color: #8fb4e0;
}

/* ═══ 规格书文档式封面:设计图 708×1173 逐像素复刻(内层全部 calc 设计px × var(--cok)) ═══ */
.rsp-cover-td {
  border: none !important;
  padding: 0 !important;
  vertical-align: top;
}
/* 页面画布:按网格宽等比缩放到设计图宽度(708) */
.rsp-cover-page {
  position: relative;
  width: 100%;
  background: #fff;
  overflow: hidden;
}
/* 公司名:微软雅黑 15.5pt(设计图墨迹 y19..38,x15..295) */
.rsp-cover-company {
  position: absolute;
  left: calc(15px * var(--cok));
  top: calc(15px * var(--cvy));
  font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;
  font-size: calc(20.7px * var(--cok));
  line-height: 1;
  color: #000;
  white-space: nowrap;
}
/* 大标题:宋体 35.5pt + 字距-1pt,中心 x=367.5/708(设计图实测 51.9%,非画布正中) */
.rsp-cover-title {
  position: absolute;
  left: calc(367.5px * var(--cok));
  transform: translateX(-50%);
  top: calc(191px * var(--cvy));
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: calc(47.3px * var(--cok));
  font-weight: 400;
  letter-spacing: calc(-1.33px * var(--cok));
  color: #111;
  line-height: 1;
  white-space: nowrap;
  text-align: center;
}
/* 字段行:宋体 23.5pt,行距 67px,标签起点 x=173;标签内嵌空格(名 称/编  号/版  本/日  期)自然流 → 冒号/值随行自动落位 */
.rsp-cover-line {
  position: absolute;
  left: calc(173px * var(--cok));
  display: flex;
  align-items: center;
  height: calc(46px * var(--cvy));
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: calc(31.3px * var(--cok));
  color: #1a1a1a;
  white-space: nowrap;
}
.rsp-cover-label {
  flex: none;
  white-space: pre;
  line-height: 1;
}
.rsp-cover-input {
  flex: 1;
  height: calc(46px * var(--cvy));
}
.rsp-cover-input :deep(.el-input__inner) {
  font-size: calc(31.3px * var(--cok));
  font-family: 'SimSun', 'Songti SC', serif;
  line-height: calc(46px * var(--cvy));
  padding: 0;
}
.rsp-cover-val {
  font-size: calc(31.3px * var(--cok));
  line-height: 1;
}/* 签名表:设计图 x132..604(宽 473),y990..1112(高 123);表头 59px,表体 63px;2px 黑边框 */
.rsp-sign-t {
  position: absolute;
  left: calc(132px * var(--cok));
  top: calc(990px * var(--cvy));
  width: calc(473px * var(--cok));
  border-collapse: collapse;
  table-layout: fixed;
}
.rsp-sign-t th,
.rsp-sign-t td {
  border: calc(1.5px * var(--cok)) solid #000;
}
.rsp-sign-th {
  height: calc(44px * var(--cvy));
  font-size: calc(16px * var(--cok));
  font-weight: 400;
  font-family: 'SimSun', 'Songti SC', serif;
  color: #111;
  padding: 0 4px;
  text-align: center;
  vertical-align: middle;
}
.rsp-sign-td {
  height: calc(48px * var(--cvy));
  padding: 0 8px;
  text-align: center;
  vertical-align: middle;
  /* 填写值字号缩小(16→12 设计px):正常长度(如 陈秀丽/2026/06/24)不出框,超长自动换行 */
  font-size: calc(12px * var(--cok));
  font-family: 'SimSun', 'Songti SC', serif;
  word-break: break-all;
}
.rsp-sign-input :deep(.el-input__inner) {
  text-align: center;
  font-size: calc(12px * var(--cok));
  line-height: 1.5;
}
/* 只读态值沿用 .rsp-cover-val(封面大字段 31.3px)会出框,签名格内覆盖为小字号 */
.rsp-sign-td .rsp-cover-val {
  font-size: calc(12px * var(--cok));
  line-height: 1.4;
}

/* ═══ 文档式章节行(规格书 P4) ═══ */
.rsp-doccell {
  border: none !important;
  padding: 4px 0 4px 16px !important;
  font-size: 14px;
}
/* flex 布局放内层容器:display:flex 直接挂 td 会破坏表格盒模型(fixed 布局下单元格塌缩,输入框只剩 4×1px 点不中) */
.rsp-docrow {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.rsp-doclabel {
  flex: none;
  min-width: 130px;
  font-family: 'SimSun', 'Songti SC', serif;
  color: #333;
}
.rsp-docinput {
  flex: 1;
}
/* 编辑态给可见填写线:全局无边框样式会吞掉可填感知(1-3/6-8 章节行) */
.rsp-doccell :deep(.el-textarea__inner) {
  border-bottom: 1px solid #9c9c9c;
  min-height: 22px;
  padding: 0 2px;
}
.rsp-docval {
  font-family: 'SimSun', 'Songti SC', serif;
}

/* ═══ 标准库勾选按钮 ═══ */
.rs-lib-btn {
  font-size: 12px;
  color: #0d5bd3;
  border: 1px solid #8fb4e0;
  border-radius: 3px;
  padding: 1px 8px;
  background: #f4f9ff;
  cursor: pointer;
  user-select: none;
}
.rs-lib-btn:hover {
  background: #e8f2ff;
}

/* ═══ plain 版式:标题条 + 副标题行 + 页脚须知 ═══ */
.rsp-plain-title {
  border: 1px solid #7f7f7f;
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #333;
  text-align: center;
  padding: 8px 10px;
  background: #fff;
}
.rsp-subtitle-row {
  border: 1px solid #7f7f7f;
  border-top: none;
  padding: 4px 10px;
  font-size: 14px;
  text-align: left;
}
.rsp-subtitle-row.right {
  text-align: right;
}
.rsp-sub-label {
  font-weight: 600;
  color: #333;
  margin-right: 6px;
}
.rsp-sub-ctl {
  width: 240px;
  vertical-align: middle;
}
.rsp-sub-value {
  color: #222;
}
.rsp-left {
  text-align: left !important;
}
.rsp-quiet {
  background: #fff;
}
.rsp-footnote {
  border: 1px solid #7f7f7f;
  border-top: none;
  text-align: left;
  font-size: 12px;
  color: #444;
  white-space: pre-line;
  line-height: 1.8;
  padding: 8px 12px;
  background: #fff;
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
  flex: none;
}
.rsp-chart {
  flex: none;
  width: 520px;
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
    /* 打印适配:宽度 100%(≈733px@8mm页边距)下固定高度封面(1123px)会溢出到第二页,整体 0.92 缩入一页 */
    zoom: 0.92 !important;
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
  /* 打印为纯文书:页签条不打印;格式区条(4.检验标准/5.关键物料列表等)去背景色 */
  body.approval-printing .rsp-pages {
    display: none !important;
  }
  body.approval-printing .rs-sectionbar {
    background: transparent !important;
  }
  @page {
    margin: 8mm;
  }
}
</style>
