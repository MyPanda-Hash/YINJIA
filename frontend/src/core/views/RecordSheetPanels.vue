<template>
  <!-- ═══════════════════════════════════════════════════════════════════
       数据记录表 7 张文书面板(RecordSheetPanels)——按《04数据记录表.xlsx》一比一复刻
       覆盖:碱性/矿化/抑菌/阻垢性能/RO保护/浸泡安全/压降、精度
       配置驱动:recordSheetConfigs.js;整页共用一套列网格(cfg.grid=Excel 原表列宽),
       报告头/条件区/数据表竖线全页对齐;数据键=字段 label(中文)
       特例块:碱性原水水质条 / 浸泡安全(浸泡液用量+仪器检出限) / 矿化(4 指标块+散点图)
       ═══════════════════════════════════════════════════════════════════ -->
  <div ref="rootEl" class="record-sheet rsp-sheet">
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

    <!-- ═══ 报告头(report 版式):公司名 | 文档编号 + 大标题 | 信息块;规格书=文档式封面
         渲染条件 = 「本页是 report 版式」且「本页要报告头」(见 showReportHead / effPlain):
           · 单页面板 / 普通多页面板:报告头只在第 1 页(历史行为,如规格书的封面);
           · 被并入同一张单后仍是独立一张单据的那页(成型配方页 / 组装BOM表页)声明
             pages[i].showHead=true,于是第 2 页也能有自己的报告头 —— 它本来就是另一张单据的表头。 ═══ -->
    <table v-if="!effPlain && showReportHead" class="rs-t rs-head-t" :style="{ width: gridW + 'px' }">
      <colgroup><col v-for="(w, i) in effGrid" :key="'hc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <!-- 规格书文档式封面:按《规格书细分.xlsx》「封面（产品信息）」sheet 逐行复刻
             (设计画布 767×794px = 该 sheet 列宽/行高折算,内层坐标=设计像素,由 --cok 等比缩放)
             公司左上 + 编号右上 | 大标题居中 | 9 行「标签列|值列」定宽表格 | 底部三栏签字 -->
        <template v-if="cfg.cover">
          <tr><td :colspan="nCols" class="rsp-cover-td">
            <div class="rsp-cover-page" :style="{ height: coverPageH + 'px', '--cok': coverK, '--cvy': coverVy }">
              <!-- 公司名与标题**分带**渲染(top 由常量给出):同带会因水平重叠而互相压字 -->
              <div class="rsp-cover-company"
                   :style="{ top: (COVER_COMPANY_TOP * coverVy) + 'px', height: (COVER_COMPANY_H * coverVy) + 'px' }">惠州市银嘉环保科技有限公司</div>
              <!-- 编号格(第 ① 带**右端**):设计原文就是「公司左上 + 编号右上」——
                   此前只渲染了公司名,右上角编号格整个漏了,用户看不到"对应的产品编号"
                   (2026-09-30 报障)。与公司名同带、右对齐,边距取与左端对称的 44px。
                   ⚠ 取的是 cfg.coverDocNoKey(= 字段「产品编号」,**不是**「编号」):
                     旧键名「编号」被引擎当**单据标识**用 —— 后端 QueryService.loadDocs 拿单据编号
                     覆盖它、ButtonService.save 又把它当单号取走,所以那格一直显示 DEMO-SD-002 这类
                     单据号而不是产品编号。字段已在 2026-09-30 改名为「产品编号」
                     (tools/migrate-rd-specdoc-prodno-2026-09-30.sql),旧键从此只表示单据标识。 -->
              <div v-if="coverDocNoKey" class="rsp-cover-docno"
                   :style="{ top: (COVER_COMPANY_TOP * coverVy) + 'px', height: (COVER_COMPANY_H * coverVy) + 'px' }">
                <!-- 标识文案跟键走(2026-10-19 用户口径「产品规格书右上角的编号名称改为产品编号」):
                     规格书这个格绑的是 coverDocNoKey='产品编号',却一直印「编号：」—— 用户看到的
                     就是「编号： 00011」,读不出这是产品编号。绑编号/文档编号的面板仍显示「编号：」。 -->
                <span class="rsp-cover-docno-lb">{{ tt(coverDocNoLabel) }}</span>
                <!-- 引用产品信息表(2026-10-21 用户口径):
                     「产品规格书的产品编号做成引用产品信息表的产品编号的弹窗,可用带入对应的产品信息表
                      的填写的数据,引用过的就显示已开发,一个产品信息表对应一个产品规格书,不能多次引用,
                      弹窗的信息是最新的产品信息表在最上面」。
                     只在**本面板声明了 prodPick 配置**时才变成引用控件(RD_SPEC_DOC 是当前的唯一一家);
                     其它封面面板(没有 prodPick)保持原输入框,行为一字不变。
                     为什么这里不再给 el-input:用户要的是"引用",手工敲产品编号会绕过
                     「一个产品信息表只能对应一张规格书」这条规则(敲了也不校验)。 -->
                <!-- 2026-10-28 用户口径②「原来的产品编号的位置改为自动生成的单据编号，现在的单据编号
                     不是看不到吗？」⇒ 该格改绑「单据编号」(引擎自动号 SD-…),不再放 prodPick 引用控件;
                     产品编号本身已移进下方封面字段表第一行(引用能力跟着搬过去,仍可弹产品信息表)。 -->
                <span class="rsp-cover-docno-val">{{ head[coverDocNoKey] || '—' }}</span>
              </div>
              <div class="rsp-cover-title"
                   :style="{ top: (COVER_TITLE_TOP * coverVy) + 'px', height: (COVER_TITLE_H * coverVy) + 'px' }">{{ tt(cfg.staticTitle || '产品规格书') }}</div>
              <!-- 字段表 + 签字栏:外层负责**水平居中**,内层 inline-block 负责**按内容定宽**。
                   ⚠ 不要让外层用 width:max-content:它里面还有 width:100% 的签字表,
                     两者构成**循环依赖**(父宽取自子宽、子宽又取自父宽),
                     实测会把整块布局塌成空 —— 表格边框在、文字全部不渲染。
                     正解:外层只管居中;内层 display:inline-block 由内容撑开(表内单元格 nowrap),
                     签字表 width:100% 跟随内层 ⇒ 两表同宽、左右边界对齐。 -->
              <div class="rsp-cover-block" :style="{ top: coverLineTop(0) }">
                <div class="rsp-cover-blockin">
                  <!-- 9 行字段表:两列由浏览器按内容定宽(auto + nowrap),故不会"字比列宽、压到值格上" -->
                  <table class="rsp-cover-fields">
                    <tbody>
                      <tr v-for="(fd, fi) in cfg.cover.fields" :key="'cf' + fi">
                        <td class="rsp-cover-lb" :class="{ 'rs-focus': isFocus(fd.key) }">{{ tt(fd.label) }}</td>
                        <td class="rsp-cover-vl">
                          <!-- 产品编号行(2026-10-28 用户口径①):值格 = **引用产品信息表**的控件,
                               与原来右上角那个 prodPick 是同一套(点击弹窗、带回数据、已引用的不可再选)。
                               为什么保留引用而不是给文本框:用户明确「引用还是可以引用的」,而且手敲编号
                               会绕过「一个产品信息表只能对应一张规格书」这条硬规则(敲了也不校验)。 -->
                          <div v-if="editable && prodPickCfg && fd.key === prodPickCfg.targetKey"
                               class="rsp-cover-docno-pick rsp-cover-vl-pick"
                               :class="{ 'rs-focus': isFocus(fd.key) }" :title="tt('点击选择')"
                               @click.stop="openProdPick">
                            <span class="rsp-cover-docno-val">{{ head[fd.key] || tt('点击选择') }}</span>
                            <!-- 产品开发状态角标(与纸面其它参照格同一套口径:未开发/已开发) -->
                            <span v-if="devStatus && devKey === fd.key" class="rs-dev-badge" :class="devStatus === '已开发' ? 'done' : 'none'">{{ tt(devStatus) }}</span>
                            <el-icon class="rs-ref-ico"><Search /></el-icon>
                          </div>
                          <el-input v-else-if="editable" v-model="head[fd.key]" size="small" class="rsp-cover-input" :class="{ 'rs-focus': isFocus(fd.key) }" :maxlength="fd.max || 200" @input="emit('dirty')" />
                          <span v-else class="rsp-cover-val">{{ head[fd.key] || '' }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <!-- 签字栏:width:100% 跟随 .rsp-cover-blockin ⇒ 与字段表同宽。
                       margin-top = 签字栏顶 − 字段表底(由常量算出,不写死 85px)。
                       ⚠ 行数 2026-09-30 由 9 改 **8**:原第一行「编  号」已移到封面右上角渲染
                         (设计原文本就是「公司左上 + 编号右上」),字段表少了这一行。
                         此处跟着改,签字栏与字段表的间距(设计 85px)才不会多出一行的空档;
                         想当然地"上移字段表"会同时顶掉标题带,反而破坏四段相接。 -->
                  <table class="rsp-sign-t"
                         :style="{ marginTop: ((COVER_SIGN_TOP - COVER_GRID_TOP - COVER_ROWS * COVER_ROW_H) * coverVy) + 'px' }">
                    <colgroup>
                      <col v-for="(w, i) in coverSignW" :key="'cw' + i" :style="{ width: w }" />
                    </colgroup>
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
              </div>
            </div>
          </td></tr>
        </template>
        <!-- 标准报告头(其它文书面板) -->
        <template v-else>
        <!-- 报告头第 1 行「公司名格 | 编号格」的分列**照设计原表**:公司名格占
             title+infoLabel 列、编号格占末尾 head.noSpan 列,两格之间/右侧的空列按 head.noGapSpan 留白
             (设计里那列没并进任何一格)。head.noSpan === 0 = 设计与实现**都是同一格含两段文字**
             (阻垢性能 A1:J1 / 浸泡安全 B2:G2):公司名靠左、编号靠右排在同一格里。
             三个跨度都由模板算(companySpan/docnoSpan/gapLeftSpan/gapRightSpan),合计恒 = nCols。 -->
        <tr>
          <td v-if="companySpan > 0" class="rs-td rs-company-cell" :colspan="companySpan">{{ COMPANY_NAME }}</td>
          <td v-if="gapLeftSpan > 0" class="rs-td" :colspan="gapLeftSpan"></td>
          <td v-if="docnoSpan > 0" class="rs-td rs-docno" :colspan="docnoSpan">
            <!-- ⚠ 同格版式的排排坐必须落在**内层 div** 上:给 <td> 加 display:flex 会让它不再是
                 table-cell(浏览器另生匿名格包住它,colspan 随之失效 —— 实测 colspan=10 的格子只剩
                 一列宽、公司名与编号挤成两行)。缺省(非 rs-onecell)时这层 div 就是普通块级,
                 与改造前逐字等价。 -->
            <div class="rs-docno-in" :class="{ 'rs-onecell': sameCellDocno }">
              <!-- 同格版式:公司名与编号同处一格(设计一格含两段文字),公司名内联在编号左边 -->
              <span v-if="sameCellDocno" class="rs-company-inline">{{ COMPANY_NAME }}</span>
              <!-- 文档编号(纸张右上角那一格)。前置标识「编号：」**由 head.docnoPrefix 决定**:
                   设计原表的原值都是裸编号(碱性 N2=" YJ-PD-01"、功能性滤效 K2="YJ-PD-01"…),
                   故缺省 false = 按设计显示裸值;哪个面板要标识(或非纸面场景要提示)就在它的 head 里写 true。 -->
              <!-- 受控表单编号(逐页常量,如测试申请单的 YJ-RIR001 / YJ-XS002):
                   设计里这一格是**表单固定值**不是单据号 ⇒ 渲染常量文本、不给输入框(见 docNoStatic 注释) -->
              <div v-if="docNoStatic" class="rs-docno-wrap">
                <span v-if="docnoPrefix" class="rs-docno-prefix">{{ tt('编号：') }}</span>
                <span class="rs-docno-static">{{ docNoStatic }}</span>
              </div>
              <div v-else-if="editable && isRefKey('文档编号')" class="rs-ref-ctl" :title="tt('点击选择')" @click="openProdRef('文档编号')">
                <span v-if="docnoPrefix" class="rs-docno-prefix">{{ tt('编号：') }}</span>
                <span class="rs-ref-text" :class="{ 'rs-docno-empty': !head['文档编号'] }">{{ head['文档编号'] || tt('点击选择') }}</span>
                <el-icon class="rs-ref-ico"><Search /></el-icon>
              </div>
              <!-- 文档类面板(编号字段=文档编号):编号由人填,给输入框 -->
              <div v-else-if="editable && docNoKey === '文档编号'" class="rs-docno-wrap">
                <span v-if="docnoPrefix" class="rs-docno-prefix">{{ tt('编号：') }}</span>
                <!-- 提示词口径(2026-10-28 用户口径「编号的占位背景提示词会让人误会是固定的一个编号」):
                     带前缀时原先写的是**前缀本身**(`'编号：'`)⇒ 左侧黑字「编号：」与框里灰字一模一样,
                     读起来像"这里已经印好一个编号了"。改成「请输入编号」= 明确这是**要你填**的空格;
                     不带前缀的 7 张裸编号设计表仍用字段名(docNoKey)做提示,它们没有前缀可重复。 -->
                <el-input v-model="head[docNoKey]" size="small" maxlength="30" class="rs-docno-input" :placeholder="tt(docnoPrefix ? '请输入编号' : docNoKey)" @input="emit('dirty')" />
              </div>
              <!-- 单据类面板(编号字段=单据编号):号是后端「新增」时自动生成的,只读显示 ——
                   给输入框既没意义又会被误改(打印/预览还必须看得见号) -->
              <!-- 只读兜底口径(2026-10-28 用户口径「会让人误会是固定的一个编号在这边」):
                   原先末尾还挂着写死的 'YJ-PD-01' —— 一张**还没发号**的单在屏幕上印出假编号。
                   cfg.docNoDefault 保留(那是设计纸面的样板号,打印空白模板要用),
                   两者都取不到时显示「—」= 明确"这里还没有号",不再编造。 -->
              <template v-else><span v-if="docnoPrefix" class="rs-docno-prefix">{{ tt('编号：') }}</span>{{ head[docNoKey] || cfg.docNoDefault || '—' }}</template>
            </div>
          </td>
          <td v-if="gapRightSpan > 0" class="rs-td" :colspan="gapRightSpan"></td>
        </tr>
        <tr>
          <!-- 大标题格。cfg.titleKey(2026-10-16 用户口径):这一格不用印死的表单名,而做成**字段输入框**
               —— 产品信息表左上角原印「产品信息表」,改为「产品名称」填写框(留空 + 灰字提示词),
               因为产品名称是下游 4 张文件靠「产品编号」参照带回的源头(见 PanelConfigService.buildRefMap)。
               只读态显示该字段的值;值为空时回落到印死的表单名,老单据观感不变。
               高亮:cfg.titleKey 也进 pageOfKeyIn(第 0 页),校验缺必填时这格会闪 rs-focus。 -->
          <td class="rs-td rs-topic-cell" :class="{ 'rs-focus': cfg.titleKey && isFocus(cfg.titleKey) }"
              :colspan="infoSpan ? effHead.title : nCols" :rowspan="infoSpan || 1">
            <el-input v-if="editable && cfg.titleKey" v-model="head[cfg.titleKey]" size="small" class="rs-topic-input"
                      :placeholder="tt(cfg.titleKeyPh || cfg.titleKey)" @input="emit('dirty')" />
            <el-input v-else-if="editable && !derivedTitle" v-model="head['测试主题']" size="small" class="rs-topic-input" :placeholder="tt(cfg.titlePlaceholder)" @input="emit('dirty')" />
            <!-- 大标题:静态页标题(pages[i].staticTitle / cfg.staticTitle)**走 tt()** ——
                 规格书/成型工艺清单/组装/测试申请单这些静态标题在 locales 里都有译名,
                 而派生标题(titleFromKey 拼出来的如"开发性-测试申请单")是**数据+后缀**,
                 不能整串丢进 tt()(会机翻出一堆无意义词条),故只翻静态标题这一支。 -->
            <span v-else class="rs-topic">{{ (cfg.titleKey ? head[cfg.titleKey] : '') || (effStaticTitle ? tt(effStaticTitle) : (derivedTitle || head['测试主题'] || tt(cfg.titlePlaceholder))) }}</span>
          </td>
          <template v-if="infoSpan">
            <td class="rs-td rs-info-label" :colspan="effHead.infoLabel">{{ tt(effInfo[0].label) }}</td>
            <td class="rs-td rs-info-value" :colspan="effHead.infoValue">
              <!-- readonly(2026-10-28):报告头里由系统带入的格(产品信息表 编辑人 / 组装工艺清单 表单管理人)
                   只显示值、不出控件 —— 值由前端监视器与后端保存回写,放开手填会被下一次保存覆盖 -->
              <el-select v-if="editable && !effInfo[0].readonly && effInfo[0].type === 'select'" v-model="head[effInfo[0].key]" size="small" :clearable="false" @change="emit('dirty')">
                <el-option v-for="o in selectOptions(effInfo[0].key)" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <el-input v-else-if="editable && !effInfo[0].readonly" v-model="head[effInfo[0].key]" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
              <template v-else>{{ head[effInfo[0].key] || '' }}</template>
            </td>
          </template>
        </tr>
        <template v-if="infoSpan > 1">
          <tr v-for="ii in infoSpan - 1" :key="'hi' + ii">
            <td class="rs-td rs-info-label" :colspan="effHead.infoLabel">{{ tt(effInfo[ii].label) }}</td>
            <td class="rs-td rs-info-value" :colspan="effHead.infoValue">
              <!-- readonly 同上:系统带入的格只显示值 -->
              <el-select v-if="editable && !effInfo[ii].readonly && effInfo[ii].type === 'select'" v-model="head[effInfo[ii].key]" size="small" :clearable="false" @change="emit('dirty')">
                <el-option v-for="o in selectOptions(effInfo[ii].key)" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <el-input v-else-if="editable && !effInfo[ii].readonly" v-model="head[effInfo[ii].key]" size="small" maxlength="80" class="rs-c-in" @input="emit('dirty')" />
              <template v-else>{{ head[effInfo[ii].key] || '' }}</template>
            </td>
          </tr>
        </template>
        </template>
      </tbody>
    </table>

    <!-- ═══ 条件区(共享网格:标签=第1列,值跨其余列;与数据表竖线对齐;按页归属渲染) ═══
         ⚠ 本循环只渲染**数据表锚点之前(含锚点)**的章节;锚点之后的章节由下面第二段循环渲染,
           目的是让数据表能夹在两者之间(设计第 4 页:物料表紧跟「1.关键物料列表」)。
           没有锚点的面板 ⇒ isAtOrBeforeTableAnchor 恒 true ⇒ 第二段为空、行为与以前完全一致。 -->
    <table v-for="(sec, si) in cfg.sections" v-show="isAtOrBeforeTableAnchor(sec) && pageOf(sec) === activePage" :key="'sec' + si" class="rs-t" :style="{ width: secW(sec) + 'px' }">
      <colgroup><col v-for="(w, i) in secCols(sec)" :key="'sc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <tr v-if="sec.bar"><td :colspan="secCols(sec).length" class="rs-sectionbar">
          <span style="display:inline-flex;align-items:center;gap:12px;justify-content:center;width:100%">
            <span>{{ tt(sec.bar) }}</span>
            <!-- 从商品引用:本节后面紧跟的表要它时挂在本节标题行上(2026-09-20 引入,
                 2026-10-21 起数据源由 WLBOM 物料清单改为**商品档案**)
                 —— 规格书第 4 页「1.关键物料列表」那张表**故意没有 bar 行**(标题由本节出),
                    按钮挂在表上永远渲染不出来;挂到标题行才出现在用户眼前。 -->
            <span v-if="materialPickAt(sec) && editable" class="rs-tool no-print"
                  :title="tt('从商品档案引用(按 所属类别/存货编码/存货名称/规格型号 逐项收窄后勾选)')"
                  @click.stop="openMaterialPick(materialPickAt(sec))">
              <el-icon><Collection /></el-icon>{{ tt(materialPickLabelOf(sec)) }}
            </span>
            <span v-if="si === (cfg.sections || []).length - 1 && !(cfg.dataTables || []).length" class="rs-tool no-print" @click.stop="openFieldEdit"><el-icon><EditPen /></el-icon>{{ tt('字段编辑') }}</span>
          </span>
        </td></tr>

        <!-- 文档式行(规格书 P4 章节:2.炭棒处理要求/3.包装方式/4.出货检验报告/5.运输要求/6.存储环境 无表格线;
             1.关键物料列表 只有 bar、rows 为空 —— 表体由 dataTables 渲染在 sections 之后) -->
        <template v-if="sec.doc">
          <tr v-for="(row, ri) in sec.rows" :key="'dl' + ri">
            <td :colspan="secCols(sec).length" class="rsp-doccell">
              <div class="rsp-docrow" :class="{ 'rs-focus': isFocus(row.key) }">
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
              <td class="rs-td rs-label" :class="{ 'rs-focus': isPairFocus(pair) }" :colspan="pair.lspan || 1" :rowspan="pair.rowspan || 1">{{ tt(pair.label) }}</td>
              <template v-if="pair.cells">
                <td v-for="(c, ci) in pair.cells" :key="'pc' + ci" class="rs-td" :class="{ 'rs-focus': isFocus(c.key) }" :colspan="ci === pair.cells.length - 1 ? (pair.vspan || 1) : 1" :rowspan="pair.rowspan || 1">
                  <el-input v-if="editable" v-model="head[c.key]" size="small" maxlength="120" class="rs-t-in" :placeholder="c.ph ? tt(c.ph) : ''" @input="emit('dirty')" />
                  <AnnotatedText v-else class="rs-txt" :text="head[c.key] || ''" :field-key="String(c.key || '')" />
                </td>
              </template>
              <td v-else class="rs-td" :class="{ 'rs-focus': isFocus(pair.key) }" :colspan="pair.vspan || 1" :rowspan="pair.rowspan || 1">
                <div v-if="editable && isRefKey(pair.key)" class="rs-ref-ctl" :title="tt('点击选择')" @click="openProdRef(pair.key)">
                  <span class="rs-ref-text">{{ head[pair.key] || tt('点击选择') }}</span>
                  <span v-if="devStatus && devKey === pair.key" class="rs-dev-badge" :class="devStatus === '已开发' ? 'done' : 'none'">{{ tt(devStatus) }}</span>
                  <el-icon class="rs-ref-ico"><Search /></el-icon>
                </div>
                <template v-else-if="editable && pair.type === 'select'">
                  <!-- 标准库型字段(产品信息表的 产品形态 即此):选项来自**可维护库** yj_std_lib,
                       stdLibOf 取的是后端 fieldSpec 下发的 stdLib 编码(yj_field.dict_sql 存库编码)。
                       故 filterable + allow-create:既能选库里的预设,也能直接敲一个新值;
                       旁挂「⧉ 标准库维护」入口(StdLibManager:新增/编辑/停用/恢复启用)。
                       与上面 row.grid 分支的标准库字段(成型工艺的 烧结炉参数/配料要求等)同一套机制、
                       同一套接口 —— 两个分支各写一遍是因为单元格结构不同,不是两套字典。 -->
                  <el-select v-model="head[pair.key]" size="small" :clearable="false"
                             :filterable="!!stdLibOf(pair.key)" :allow-create="!!stdLibOf(pair.key)" default-first-option
                             @change="emit('dirty')">
                    <el-option v-for="o in selectOptions(pair.key)" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                  <span v-if="stdLibOf(pair.key)" class="rs-lib-btn no-print"
                        @click.stop="openStdLib(stdLibOf(pair.key))">⧉ {{ tt('标准库维护') }}</span>
                </template>
                <!-- 附件字段(如 产品信息表·客户图纸或规格书):上传/点击查看/删除;打印只见文件名。
                     ⚠ **不能写成 `editable && pair.type === 'file'`**(2026-10-16 用户报障
                     「产品信息表上传的附件保存之后不能查看」):普通用户「保存」后单据转「审批中」
                     ⇒ editable=false ⇒ 整格不渲染,附件名退化成纯文本,连上传者本人都点不开。
                     现在无条件渲染:可编辑=能上传/删除;只读=只能点开查看/下载(后端 requirePanelView 把关)。 -->
                <FileAttachCell
                  v-else-if="pair.type === 'file'"
                  :panel-code="panelCode"
                  :doc-no="head['单据编号'] || ''"
                  :field-key="pair.key"
                  :model-value="head[pair.key] || ''"
                  :can-edit="editable"
                  hide-when-empty
                  @update:model-value="(v) => { head[pair.key] = v }"
                />
                <el-input v-else-if="editable && pair.type === 'text'" v-model="head[pair.key]" size="small" :maxlength="pair.max || 300" class="rs-t-in" :placeholder="pair.ph ? tt(pair.ph) : ''" @input="emit('dirty')" />
                <el-input v-else-if="editable" v-model="head[pair.key]" type="textarea" :autosize="{ minRows: 1, maxRows: 8 }" size="small" :maxlength="pair.max || 2000" class="rs-t-in" @input="emit('dirty')" />
                <AnnotatedText v-else class="rs-txt" :text="head[pair.key] || ''" :field-key="String(pair.key || '')" />
              </td>
            </template>
          </tr>

          <!-- 单元格网格行(成型工艺:产品基本信息两行式/工序阶段块/列标题行)——
               cell = {label|key/fixed, type, span, rowspan, cap(灰表头样式弱化), ro(只读展示)} 逐格铺 sec.cols
               row.h = 该行**最小行高**(2026-10-16:产品变更申请单表头空白时被压得很扁,
               用户口径「不要压这么扁,适当拉长看起来协调一点」⇒ 配置可给行高,内容多了仍自由撑开)
               cell.ro = 该格只读展示(2026-10-16 用户口径「表头…这个字段怎么能修改了」:
               系统自己管的字段(单据编号/申请人之类)在纸面上不该给输入框 ——
               yj_field.editable=0 不敢全库照用(产品信息表的产品编号/名称就靠纸面录入),
               故由**配置逐格**声明,零波及面) -->
          <tr v-else-if="row.grid" :style="row.h ? { height: row.h + 'px' } : null">
            <template v-for="(c, ci) in row.grid" :key="'g' + ci">
              <td v-if="c.label" class="rs-td rs-label" :colspan="c.span || 1" :rowspan="c.rowspan || 1"
                  :style="c.cap ? 'background:#9c9c9c;color:#fff;font-weight:600;font-size:12.5px' : ''">
                <span>{{ tt(effColLabel(c.label, c.label)) }}</span>
              </td>
              <td v-else class="rs-td" :class="{ 'rs-focus': isFocus(c.key) }" :colspan="c.span || 1" :rowspan="c.rowspan || 1">
                <div v-if="editable && isRefKey(c.key)" class="rs-ref-ctl" :title="tt('点击选择')" @click="openProdRef(c.key)">
                  <span class="rs-ref-text">{{ head[c.key] || tt('点击选择') }}</span>
                  <span v-if="devStatus && devKey === c.key" class="rs-dev-badge" :class="devStatus === '已开发' ? 'done' : 'none'">{{ tt(devStatus) }}</span>
                  <el-icon class="rs-ref-ico"><Search /></el-icon>
                </div>
                <template v-else-if="editable && c.type === 'select'">
                  <!-- 标准库型字段(成型工艺的 烧结炉参数/烧结时间调速器参数/冷却参数设置):
                       选项来自可维护库,故 filterable+allow-create —— 能选预设也能直接敲新值
                       (设计口径「下拉选择项 + 选择后同时支持再次修改」);旁挂标准库维护入口。 -->
                  <el-select v-model="head[c.key]" size="small" :clearable="false"
                             :placeholder="c.ph ? tt(c.ph) : ''"
                             :filterable="!!stdLibOf(c.key)" :allow-create="!!stdLibOf(c.key)" default-first-option
                             @change="emit('dirty')">
                    <el-option v-for="o in selectOptions(c.key)" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                  <span v-if="stdLibOf(c.key)" class="rs-lib-btn no-print" @click.stop="openStdLib(stdLibOf(c.key))">⧉ {{ tt('标准库维护') }}</span>
                </template>
                <template v-else-if="editable && c.type === 'checks'">
                  <!-- 复选格(变更申请单 YJ-QR-130):「性质」□变更 □新增(c.single=单选语义)、
                       「变更文件」□成型工艺清单 □组装工艺清单 □规格书 □出货检验计划表(多选)。
                       存储口径 = **顿号分隔的文本**(与 rd_change_head.变更文件 一致,后端按 contains 判定);
                       不新增字段类型,纸面上就是几个方框。 -->
                  <span class="rs-checks">
                    <el-checkbox
                      v-for="o in (c.options || [])"
                      :key="o"
                      :model-value="checkList(head[c.key]).includes(o)"
                      @change="toggleCheck(c.key, o, !!c.single)"
                    >{{ tt(o) }}</el-checkbox>
                  </span>
                </template>
                <template v-else-if="editable && c.key && !c.ro">
                  <el-input v-if="c.area" v-model="head[c.key]" type="textarea" :autosize="{ minRows: c.rows || 1, maxRows: 6 }" size="small" :maxlength="c.max || 2000" :placeholder="c.ph ? tt(c.ph) : ''" class="rs-t-in" @input="emit('dirty')" />
                  <el-input v-else v-model="head[c.key]" size="small" :maxlength="c.max || 2000" :placeholder="c.ph ? tt(c.ph) : ''" class="rs-t-in" @input="emit('dirty')" />
                  <!-- 标准库型字段但版式要文本框(配料要求/热压要求):文本可自由改 + ⌄标准库 选预设 -->
                  <span v-if="stdLibOf(c.key)" class="rsp-lib-pick" @click.stop="openSectionLib(c)">⌄ {{ tt('标准库') }}</span>
                </template>
                <!-- 变更文件(只读态/审批后):勾选的文件渲染成**跳转入口**(2026-10-19 用户口径:
                     勾了哪些,审批后按本单「产品编号」给出对应文件的入口;点击开页签并按 docNo 定位)。
                     只读态才出现;编辑态仍是上面的复选框。 -->
                <span v-else-if="!editable && c.type === 'checks' && c.link && checkList(head[c.key]).length" class="rs-file-links no-print">
                  <el-button v-for="o in checkList(head[c.key])" :key="o" link type="primary" size="small"
                             @click.stop="openLinkedFile(c, o)">{{ tt(o) }}</el-button>
                </span>
                <AnnotatedText v-else class="rs-txt" :text="head[c.key] || c.fixed || ''" :field-key="String(c.key || '')" />
              </td>
            </template>
          </tr>

          <!-- 工序阶段行(成型工艺):左端 stage 纵向合并 + 参数键值对(可两对) -->
          <tr v-else-if="sec.stage">
            <td v-if="row.stage" class="rs-td rs-label rsp-stage" :rowspan="stageSpan(sec, ri)" :colspan="2">{{ tt(row.stage) }}</td>
            <td class="rs-td rs-label">{{ tt(row.label) }}</td>
            <td class="rs-td" :colspan="row.label2 ? 2 : 5">
              <el-input v-if="editable" v-model="head[row.key]" size="small" :maxlength="row.max || 500" class="rs-t-in" @input="emit('dirty')" />
              <AnnotatedText v-else class="rs-txt" :text="head[row.key] || ''" :field-key="String(row.key || '')" />
            </td>
            <template v-if="row.label2">
              <td class="rs-td rs-label">{{ tt(row.label2) }}</td>
              <td class="rs-td" colspan="2">
                <el-input v-if="editable" v-model="head[row.key2]" size="small" :maxlength="row.max2 || 500" class="rs-t-in" @input="emit('dirty')" />
                <AnnotatedText v-else class="rs-txt" :text="head[row.key2] || ''" :field-key="String(row.key2 || '')" />
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
                <AnnotatedText v-else class="rs-txt" :text="head[c.key] || ''" :field-key="String(c.key || '')" />
              </td>
            </template>
            <td v-else class="rs-td" :colspan="nCols > 1 ? nCols - 1 : 1">
              <!-- 参照字段(plain 版式也支持:2026-09-11 组装工艺清单头补「产品编号」→ 参照产品信息表;
                   此前这一支只渲染纯输入框,参照字段在 plain 版式里点不开弹窗) -->
              <div v-if="editable && isRefKey(row.key)" class="rs-ref-ctl" :title="tt('点击选择')" @click="openProdRef(row.key)">
                <span class="rs-ref-text">{{ head[row.key] || tt('点击选择') }}</span>
                <span v-if="devStatus && devKey === row.key" class="rs-dev-badge" :class="devStatus === '已开发' ? 'done' : 'none'">{{ tt(devStatus) }}</span>
                <el-icon class="rs-ref-ico"><Search /></el-icon>
              </div>
              <el-input v-else-if="editable && row.type === 'text'" v-model="head[row.key]" size="small" :maxlength="row.max || 300" class="rs-t-in" @input="emit('dirty')" />
              <el-input v-else-if="editable" v-model="head[row.key]" type="textarea" :autosize="{ minRows: row.tall ? 3 : 1, maxRows: 12 }" size="small" :maxlength="row.max || 2000" class="rs-t-in" @input="emit('dirty')" />
              <AnnotatedText v-else class="rs-txt" :class="{ 'rsp-pre': row.tall }" :text="head[row.key] || ''" :field-key="String(row.key || '')" />
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
                        <AnnotatedText v-else class="rs-txt" :text="head[waterKeys[i]] || ''" :field-key="String(waterKeys[i] || '')" />
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
              <AnnotatedText v-else class="rs-txt" :text="head[soakSizeKeys[i]] || ''" :field-key="String(soakSizeKeys[i] || '')" />
            </td>
          </tr>
          <tr>
            <td class="rs-td rs-label">{{ tt('浸泡液用量（ml）') }}</td>
            <td v-for="(cs, i) in cfg.soakColspans" :key="'sv2' + i" class="rs-td" :colspan="cs">
              <el-input v-if="editable" v-model="head[soakVolKeys[i]]" size="small" maxlength="60" class="rs-t-in" @input="emit('dirty')" />
              <AnnotatedText v-else class="rs-txt" :text="head[soakVolKeys[i]] || ''" :field-key="String(soakVolKeys[i] || '')" />
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
            <td class="rs-td"><el-input v-if="editable" v-model="head[it.keys[0]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><AnnotatedText v-else class="rs-txt" :text="head[it.keys[0]] || ''" :field-key="String(it.keys[0] || '')" /></td>
            <td class="rs-td"><el-input v-if="editable" v-model="head[it.keys[1]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><AnnotatedText v-else class="rs-txt" :text="head[it.keys[1]] || ''" :field-key="String(it.keys[1] || '')" /></td>
            <td class="rs-td" :colspan="cfg.soakColspans[2]"><el-input v-if="editable" v-model="head[it.keys[2]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><AnnotatedText v-else class="rs-txt" :text="head[it.keys[2]] || ''" :field-key="String(it.keys[2] || '')" /></td>
          </tr>
        </template>
      </tbody>
    </table>

    <!-- ═══ 数据记录表(共享网格;按页归属渲染)═══
         ⚠ 本段**只此一份**,夹在循环 A 与循环 B 之间 ⇒ 表格紧贴其锚点章节之后。
           两次踩坑记在这,别退回:
             · v-if 与 v-for 同元素引用 dt ⇒ 编译成 _ctx.dt ⇒ 每次渲染抛 TypeError ⇒ 整面板白屏;
             · 把表块克隆进 sections 循环 ⇒ 每章节克隆一份(实测 8 份、7 份 display:none),
               且克隆块仍排在所有 sections 之后 ⇒ 表格照样落在末尾。 -->
    <div v-for="(dt, di) in cfg.dataTables" v-show="pageOf(dt) === activePage" :key="'dt' + di" class="rsp-dt-wrap" :class="{ 'with-chart': dt.charts }">
      <div class="rsp-dt-table">
        <table class="rs-t rs-dt" :class="{ 'rsp-design-t': dt.design }" :style="{ width: (dtOwnsWidth(dt) ? (dt.design ? dtW(dt) * designK(dt) : dtW(dt)) : effPlain ? plainW(dt) : gridW) + 'px' }">
          <colgroup>
            <template v-if="effPlain || dtOwnsWidth(dt)">
              <col v-for="(c, i) in visCols(dt)" :key="'dc' + i" :style="{ width: ((c.w || 100) * (dt.design ? designK(dt) : 1)).toFixed(1) + 'px' }" />
            </template>
            <template v-else>
              <col v-for="(w, i) in effGrid" :key="'dc' + i" :style="{ width: w + 'px' }" />
            </template>
            <col v-if="editable" style="width:0" />
          </colgroup>
          <tbody>
            <!-- plain 版式:标题条 + 副标题行(测试项目：/设备名称：/仪器名称/型号：) -->
            <tr v-if="effPlain">
              <td :colspan="totalSpan(dt)" class="rsp-plain-title">{{ tt(plainTitleOf) }}</td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
            <tr v-if="effPlain && cfg.subtitle">
              <td :colspan="totalSpan(dt)" class="rsp-subtitle-row" :class="{ right: cfg.subtitle.align === 'right' }">
                <span class="rsp-sub-label">{{ tt(cfg.subtitle.label) }}</span>
                <el-select v-if="editable && cfg.subtitle.type === 'select'" v-model="head[cfg.subtitle.key]" size="small" class="rsp-sub-ctl" :clearable="false" filterable allow-create default-first-option @change="emit('dirty')">
                  <el-option v-for="o in subtitleOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <!-- 标准库字段:条目可维护(打印时隐藏,纸张上不出现"标准库"字样) -->
                <span v-if="editable && cfg.subtitle.type === 'select' && stdLibOf(cfg.subtitle.key)" class="rs-lib-btn no-print" @click.stop="openStdLib(stdLibOf(cfg.subtitle.key))">⧉ {{ tt('标准库维护') }}</span>
                <el-input v-else-if="editable" v-model="head[cfg.subtitle.key]" size="small" maxlength="100" class="rsp-sub-ctl" @input="emit('dirty')" />
                <span v-else class="rsp-sub-value">{{ head[cfg.subtitle.key] || '' }}</span>
              </td>
              <td v-if="editable" class="rsp-op-pad"></td>
            </tr>
            <!-- report 版式带变体时:变体切换行(如 申请单类型)。
                 dt.noVariant 用于「变体字段已在条件区有一格」的表(组装工艺清单:工艺形态 在产品基本信息区),
                 否则同一字段会在一页里出现两次。
                 占列数见 variantSpan():2 列在 16 列网格里会把「申请单类型：内部委托 ▼」挤成两行。 -->
            <tr v-if="!effPlain && cfg.variantKey && !dt.noVariant">
              <td :colspan="variantSpan(dt)" class="rsp-subtitle-row rsp-left">
                <span class="rsp-sub-label">{{ tt(variantLabel) }}</span>
                <el-select v-if="editable" v-model="head[cfg.variantKey]" size="small" class="rsp-sub-ctl" :clearable="false" filterable allow-create default-first-option @change="emit('dirty')">
                  <el-option v-for="o in variantOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <span v-if="editable && stdLibOf(cfg.variantKey)" class="rs-lib-btn no-print" @click.stop="openStdLib(stdLibOf(cfg.variantKey))">⧉ {{ tt('标准库维护') }}</span>
                <span v-else class="rsp-sub-value">{{ head[cfg.variantKey] || '' }}</span>
              </td>
              <td :colspan="Math.max(1, totalSpan(dt) - variantSpan(dt))" class="rsp-subtitle-row rsp-quiet"></td>
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
                  <span v-if="dt.recipeCalc && editable" class="rs-tool no-print" @click.stop="openRecipeCalc(dt)">
                    <el-icon><Odometer /></el-icon>{{ tt('配方计算') }}
                  </span>
                  <!-- 手动导入规格书数据(组装BOM表 ← 规格书「1.关键物料列表」):
                       自动带入之外留的手动入口 —— 未提交审批之前可以反复尝试、规格书后补通过后重试。
                       按钮文案来自配置(autoFillSpec.manual),只有配了它的表才出现。 -->
                  <span
                    v-if="editable && cfg.autoFillSpec?.manual && autoFillTargetDt(cfg.autoFillSpec) === dt"
                    class="rs-lib-btn"
                    @click.stop="onSpecImportClick"
                  >⤓ {{ tt(cfg.autoFillSpec.manual) }}</span>
                  <!-- 规格书变动:单子填完之后规格书又变了 ⇒ 就地表态并可一键按规格书更新 -->
                  <span
                    v-if="specDriftState && editable && cfg.autoFillSpec && autoFillTargetDt(cfg.autoFillSpec) === dt"
                    class="rs-lib-btn rs-drift-btn"
                    :title="specDriftText"
                    @click.stop="autoFillFromSpec(props.head[cfg.autoFillSpec.fromKey], cfg.autoFillSpec)"
                  >⚠ {{ specDriftText }}</span>
                  <span v-if="di === fieldEditAt" class="rs-tool no-print" @click.stop="openFieldEdit"><el-icon><EditPen /></el-icon>{{ tt('字段编辑') }}</span>
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
                  <th v-if="g.kind === 'plain'" class="rs-th" :style="designThStyle(dt)" :rowspan="g.rowspan" :colspan="g.span > 1 ? g.span : undefined">{{ tt(effColLabel(g.key || g.label, g.label)) }}<span v-if="editable && libOfCol(g.key)" class="rs-lib-pick" :title="tt('维护该列的标准库下拉内容')" @click.stop="openStdLib(libOfCol(g.key))">⌄</span></th>
                  <th v-else-if="g.kind === 'group'" class="rs-th" :style="designThStyle(dt)" :colspan="g.span">{{ tt(g.label) }}</th>
                </template>
                <th v-if="editable" class="rs-th-op" :rowspan="hasGroup(dt) ? 2 : 1"></th>
              </tr>
              <tr v-if="hasGroup(dt)" class="rs-grp2">
                <th v-for="c in groupCols(dt)" :key="'h2' + c.key" class="rs-th" :colspan="(c.span || 1) > 1 ? c.span : undefined">{{ tt(effColLabel(c.key, c.label)) }}</th>
              </tr>
            </template>
            <!-- 分组式数据行(检验项目及标准:序号/组跨行,子项目列,要求/方法/依据可编辑)
                 ⚠ 序号/组名两格**只能在组首行渲染**(2026-10-16 用户报障「检验项目下面和检验要求下面有空白格」):
                 它们带 rowspan 占住整组,后续行若照样输出空 &lt;td&gt;,浏览器会把本行的 子项目/要求/方法/依据
                 依次**右移两列**——于是子项目列、检验要求列看着空白,而「除余氯寿命」跑到检验方法列、
                 「寿命920L，全程加标」跑到检验依据列。行首两格必须由 rowspan 覆盖,不能重复输出。 -->
            <template v-if="dt.design?.groupCol">
              <tr v-for="r in designGroupRows(dt)" :key="r.key" class="rsp-design">
                <template v-if="r.groupFirst">
                  <td class="rs-td" :style="designTdStyle(dt, 'seq')" :rowspan="r.group.count">{{ r.seq }}</td>
                  <td class="rs-td" :style="designTdStyle(dt, 'item')" :rowspan="r.group.count" :colspan="r.standalone ? 2 : 1">{{ tt(r.group.label) }}</td>
                </template>
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
            <tr v-else v-for="(row, i) in rowsOf(dt)" :key="row.id ?? ('new' + di + '-' + i)" :class="{ 'rsp-design': dt.design }" :style="dt.rowH ? { height: dt.rowH + 'px' } : null">
              <td v-for="c in visCols(dt)" :key="c.key" class="rs-td" :class="{ 'rsp-locked': isLockedCell(dt, row, c) }" :style="designTdStyle(dt)" :colspan="(c.span || 1) > 1 ? c.span : undefined">
                <el-input v-if="cellEditable(dt, row, c) && c.area" v-model="row[c.key]" type="textarea" :autosize="{ minRows: 2, maxRows: 10 }" size="small" class="rs-t-in" :style="designInputStyle(dt)" @input="emit('dirty')" />
                <!-- 下拉列(配置 c.type='select'):配方表「物料种类」用它 —— 自由文本会让引擎
                     静默认不出、把折算料当比例算(见 core/mold/materialKinds.js 注释)。
                     filterable+allow-create:预设档案类别(2026-10-15 起五个,含「折算物料」),
                     新增类别也能直接敲(口径由工艺科定) -->
                <el-select
                  v-else-if="cellEditable(dt, row, c) && c.type === 'select'"
                  v-model="row[c.key]"
                  size="small"
                  filterable
                  allow-create
                  default-first-option
                  class="rs-c-in"
                  :style="designInputStyle(dt)"
                  @change="emit('dirty')"
                >
                  <el-option v-for="o in colOptions(c)" :key="o" :label="tt(o)" :value="o" />
                </el-select>
                <!-- 物料编号列(c.type='inv-code'):商品档案**远程模糊筛选**(2026-10-16 用户口径
                     「输入 Y 或者 003 时模糊搜索到含这些数字字母的」,例 YJ-LL-003)。
                     口径与配方计算弹窗同一套(见 core/panel/invCarry.js invSearchRequest):
                       · 打字才联网(debounce 300ms),**空关键字一个请求都不发** —— 服务端 keyword 是
                         「本面板所有字段 LIKE %kw%」的 OR,空关键字等于不过滤:档案分支不吃 pageSize,
                         会把整份 bs_inv(生产上几千行×113 列)拉回来;
                       · 候选 = invSearchOptions(编码+名称子串、大小写无关、去重、封顶 50 项),
                         下拉里显示「编码 — 名称」,选中写进单据的是**编码**;
                       · 用 el-autocomplete 而不是 el-select:输入框本身就是值 ⇒ **档案里没有的新编码
                         照样能手打**(el-select + allow-create 实测会吞:EP 只在"创建项"被选中时才落值,
                         手打后直接点别处 = 输入丢失;而"手打新编码"是必须保留的例外通道);
                       · trigger-on-focus=false:点一下空格子不发请求(与"空关键字不发"同一条口径)。
                     选中/手打后:onInvCodePick / onInvCodeChange → onDetailTextCommit 带出 物料名称+物料种类。 -->
                <el-autocomplete
                  v-else-if="cellEditable(dt, row, c) && c.type === 'inv-code'"
                  v-model="row[c.key]"
                  size="small"
                  class="rs-c-in rs-inv-sel"
                  :style="designInputStyle(dt)"
                  value-key="value"
                  :debounce="300"
                  :trigger-on-focus="false"
                  :fetch-suggestions="(q, cb) => fetchInvCodes(row, q, cb)"
                  popper-class="rs-inv-popper"
                  :title="invOptHint(row)"
                  @select="(item) => onInvCodePick(row, c.key, item)"
                  @change="onInvCodeChange(row, c.key)"
                >
                  <!-- 下拉里显示「编码 — 名称」(写进单据的仍是编码本身) -->
                  <template #default="{ item }">
                    <span class="rs-inv-opt">{{ item.label }}</span>
                  </template>
                </el-autocomplete>
                <!-- 日期/时间列:控件种类由 **yj_field.data_type** 决定(不在这里写死列名),
                     口径见 core/panel/sheetDateCells.js —— 2026-10-07 起实验室 11 张记录表的
                     使用日期/测试日期/日期/期望完成日期/预计完成日期 都是「日期」,起止时间是「时间区间」。
                     ⚠ 绑定用 :model-value + @update:model-value(不是 v-model):历史值认不出来时
                     (如「待定」「333」)控件空着但**不回写**,库里原值不会被清掉。 -->
                <el-date-picker
                  v-else-if="cellEditable(dt, row, c) && cellKind(c) === 'date'"
                  :model-value="controlValue('date', row[c.key])"
                  type="date"
                  value-format="YYYY-MM-DD"
                  size="small"
                  class="rs-c-in rs-date-in"
                  :style="designInputStyle(dt)"
                  :placeholder="tt('选择日期')"
                  @update:model-value="(v) => setCellValue(row, c, v)"
                />
                <el-date-picker
                  v-else-if="cellEditable(dt, row, c) && cellKind(c) === 'datetime'"
                  :model-value="controlValue('datetime', row[c.key])"
                  type="datetime"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  size="small"
                  class="rs-c-in rs-date-in"
                  :style="designInputStyle(dt)"
                  @update:model-value="(v) => setCellValue(row, c, v)"
                />
                <el-time-picker
                  v-else-if="cellEditable(dt, row, c) && cellKind(c) === 'time'"
                  :model-value="controlValue('time', row[c.key])"
                  value-format="HH:mm"
                  format="HH:mm"
                  size="small"
                  class="rs-c-in rs-date-in"
                  :style="designInputStyle(dt)"
                  @update:model-value="(v) => setCellValue(row, c, v)"
                />
                <!-- 起止时间:一格区间控件,落库仍是 'HH:mm-HH:mm' 文本(纸面版式与旧值格式不变)。
                     开始/结束占位符交给 Element 的 locale(应用切语言时同步),不新增词条 -->
                <el-time-picker
                  v-else-if="cellEditable(dt, row, c) && cellKind(c) === 'time-range'"
                  :model-value="controlValue('time-range', row[c.key])"
                  is-range
                  range-separator="-"
                  value-format="HH:mm"
                  format="HH:mm"
                  size="small"
                  class="rs-c-in rs-range-in"
                  :style="designInputStyle(dt)"
                  @update:model-value="(v) => setCellValue(row, c, v)"
                />
                <el-input v-else-if="cellEditable(dt, row, c)" v-model="row[c.key]" size="small" class="rs-c-in" :style="designInputStyle(dt)" @input="emit('dirty')" @change="onDetailTextCommit(row, c.key)" />
                <span v-else class="rs-txt rsp-cell" :title="isLockedCell(dt, row, c) ? tt('非本部门栏目（只读）') : ''">{{ cellText(cellKind(c), row[c.key]) || ' / ' }}</span>
              </td>
              <td v-if="editable && !dt.fixedRows" class="rs-td-op"><span class="rs-op-add" @click="addRow(dt)">＋</span><span class="rs-op-del" @click="removeRow(row)">×</span></td>
            </tr>
            <tr v-if="!rowsOf(dt).length">
              <td :colspan="totalSpan(dt)" class="rs-empty">—</td>
              <td v-if="editable && !dt.fixedRows" class="rsp-op-pad"></td>
            </tr>
            <!-- 合计行(成型配方:比例/含量/设计添加量数值求和)——「合计」格跨度跟首列跨度走(13 格配方表首列 No. 占 1 格) -->
            <tr v-if="dt.totalCols && rowsOf(dt).length">
              <td class="rs-td rsp-total" :colspan="visCols(dt)[0]?.span || 1">{{ tt('合计') }}</td>
              <td v-for="(c, ci) in visCols(dt).slice(1)" :key="'tt' + ci" class="rs-td rsp-total" :colspan="(c.span || 1) > 1 ? c.span : undefined">
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
        <div v-if="editable && !dt.fixedRows" class="rs-add" :style="{ width: (effPlain ? plainW(dt) : (dtOwnsWidth(dt) ? (dt.design ? dtW(dt) * designK(dt) : dtW(dt)) : gridW)) + 'px' }" @click="addRow(dt)">＋ {{ tt('新增数据记录行') }}</div>
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

    <table v-for="(sec, si) in cfg.sections" v-show="!isAtOrBeforeTableAnchor(sec) && pageOf(sec) === activePage" :key="'secB' + si" class="rs-t" :style="{ width: secW(sec) + 'px' }">
      <colgroup><col v-for="(w, i) in secCols(sec)" :key="'sc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <tr v-if="sec.bar"><td :colspan="secCols(sec).length" class="rs-sectionbar">
          <span style="display:inline-flex;align-items:center;gap:12px;justify-content:center;width:100%">
            <span>{{ tt(sec.bar) }}</span>
            <!-- 从商品引用(同 220 行那处;数据源 2026-10-21 起 = 商品档案 INV) -->
            <span v-if="materialPickAt(sec) && editable" class="rs-tool no-print"
                  :title="tt('从商品档案引用(按 所属类别/存货编码/存货名称/规格型号 逐项收窄后勾选)')"
                  @click.stop="openMaterialPick(materialPickAt(sec))">
              <el-icon><Collection /></el-icon>{{ tt(materialPickLabelOf(sec)) }}
            </span>
            <span v-if="si === (cfg.sections || []).length - 1 && !(cfg.dataTables || []).length" class="rs-tool no-print" @click.stop="openFieldEdit"><el-icon><EditPen /></el-icon>{{ tt('字段编辑') }}</span>
          </span>
        </td></tr>

        <!-- 文档式行(规格书 P4 章节:2.炭棒处理要求/3.包装方式/4.出货检验报告/5.运输要求/6.存储环境 无表格线;
             1.关键物料列表 只有 bar、rows 为空 —— 表体由 dataTables 渲染在 sections 之后) -->
        <template v-if="sec.doc">
          <tr v-for="(row, ri) in sec.rows" :key="'dl' + ri">
            <td :colspan="secCols(sec).length" class="rsp-doccell">
              <div class="rsp-docrow" :class="{ 'rs-focus': isFocus(row.key) }">
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
              <td class="rs-td rs-label" :class="{ 'rs-focus': isPairFocus(pair) }" :colspan="pair.lspan || 1" :rowspan="pair.rowspan || 1">{{ tt(pair.label) }}</td>
              <template v-if="pair.cells">
                <td v-for="(c, ci) in pair.cells" :key="'pc' + ci" class="rs-td" :class="{ 'rs-focus': isFocus(c.key) }" :colspan="ci === pair.cells.length - 1 ? (pair.vspan || 1) : 1" :rowspan="pair.rowspan || 1">
                  <el-input v-if="editable" v-model="head[c.key]" size="small" maxlength="120" class="rs-t-in" :placeholder="c.ph ? tt(c.ph) : ''" @input="emit('dirty')" />
                  <AnnotatedText v-else class="rs-txt" :text="head[c.key] || ''" :field-key="String(c.key || '')" />
                </td>
              </template>
              <td v-else class="rs-td" :class="{ 'rs-focus': isFocus(pair.key) }" :colspan="pair.vspan || 1" :rowspan="pair.rowspan || 1">
                <div v-if="editable && isRefKey(pair.key)" class="rs-ref-ctl" :title="tt('点击选择')" @click="openProdRef(pair.key)">
                  <span class="rs-ref-text">{{ head[pair.key] || tt('点击选择') }}</span>
                  <span v-if="devStatus && devKey === pair.key" class="rs-dev-badge" :class="devStatus === '已开发' ? 'done' : 'none'">{{ tt(devStatus) }}</span>
                  <el-icon class="rs-ref-ico"><Search /></el-icon>
                </div>
                <template v-else-if="editable && pair.type === 'select'">
                  <!-- 标准库型字段(产品信息表的 产品形态 即此):选项来自**可维护库** yj_std_lib,
                       stdLibOf 取的是后端 fieldSpec 下发的 stdLib 编码(yj_field.dict_sql 存库编码)。
                       故 filterable + allow-create:既能选库里的预设,也能直接敲一个新值;
                       旁挂「⧉ 标准库维护」入口(StdLibManager:新增/编辑/停用/恢复启用)。
                       与上面 row.grid 分支的标准库字段(成型工艺的 烧结炉参数/配料要求等)同一套机制、
                       同一套接口 —— 两个分支各写一遍是因为单元格结构不同,不是两套字典。 -->
                  <el-select v-model="head[pair.key]" size="small" :clearable="false"
                             :filterable="!!stdLibOf(pair.key)" :allow-create="!!stdLibOf(pair.key)" default-first-option
                             @change="emit('dirty')">
                    <el-option v-for="o in selectOptions(pair.key)" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                  <span v-if="stdLibOf(pair.key)" class="rs-lib-btn no-print"
                        @click.stop="openStdLib(stdLibOf(pair.key))">⧉ {{ tt('标准库维护') }}</span>
                </template>
                <!-- 附件字段(如 产品信息表·客户图纸或规格书):上传/点击查看/删除;打印只见文件名。
                     ⚠ **不能写成 `editable && pair.type === 'file'`**(2026-10-16 用户报障
                     「产品信息表上传的附件保存之后不能查看」):普通用户「保存」后单据转「审批中」
                     ⇒ editable=false ⇒ 整格不渲染,附件名退化成纯文本,连上传者本人都点不开。
                     现在无条件渲染:可编辑=能上传/删除;只读=只能点开查看/下载(后端 requirePanelView 把关)。 -->
                <FileAttachCell
                  v-else-if="pair.type === 'file'"
                  :panel-code="panelCode"
                  :doc-no="head['单据编号'] || ''"
                  :field-key="pair.key"
                  :model-value="head[pair.key] || ''"
                  :can-edit="editable"
                  hide-when-empty
                  @update:model-value="(v) => { head[pair.key] = v }"
                />
                <el-input v-else-if="editable && pair.type === 'text'" v-model="head[pair.key]" size="small" :maxlength="pair.max || 300" class="rs-t-in" :placeholder="pair.ph ? tt(pair.ph) : ''" @input="emit('dirty')" />
                <el-input v-else-if="editable" v-model="head[pair.key]" type="textarea" :autosize="{ minRows: 1, maxRows: 8 }" size="small" :maxlength="pair.max || 2000" class="rs-t-in" @input="emit('dirty')" />
                <AnnotatedText v-else class="rs-txt" :text="head[pair.key] || ''" :field-key="String(pair.key || '')" />
              </td>
            </template>
          </tr>

          <!-- 单元格网格行(成型工艺:产品基本信息两行式/工序阶段块/列标题行)——
               cell = {label|key/fixed, type, span, rowspan, cap(灰表头样式弱化), ro(只读展示)} 逐格铺 sec.cols
               row.h = 该行**最小行高**(2026-10-16:产品变更申请单表头空白时被压得很扁,
               用户口径「不要压这么扁,适当拉长看起来协调一点」⇒ 配置可给行高,内容多了仍自由撑开)
               cell.ro = 该格只读展示(2026-10-16 用户口径「表头…这个字段怎么能修改了」:
               系统自己管的字段(单据编号/申请人之类)在纸面上不该给输入框 ——
               yj_field.editable=0 不敢全库照用(产品信息表的产品编号/名称就靠纸面录入),
               故由**配置逐格**声明,零波及面) -->
          <tr v-else-if="row.grid" :style="row.h ? { height: row.h + 'px' } : null">
            <template v-for="(c, ci) in row.grid" :key="'g' + ci">
              <td v-if="c.label" class="rs-td rs-label" :colspan="c.span || 1" :rowspan="c.rowspan || 1"
                  :style="c.cap ? 'background:#9c9c9c;color:#fff;font-weight:600;font-size:12.5px' : ''">
                <span>{{ tt(effColLabel(c.label, c.label)) }}</span>
              </td>
              <td v-else class="rs-td" :class="{ 'rs-focus': isFocus(c.key) }" :colspan="c.span || 1" :rowspan="c.rowspan || 1">
                <div v-if="editable && isRefKey(c.key)" class="rs-ref-ctl" :title="tt('点击选择')" @click="openProdRef(c.key)">
                  <span class="rs-ref-text">{{ head[c.key] || tt('点击选择') }}</span>
                  <span v-if="devStatus && devKey === c.key" class="rs-dev-badge" :class="devStatus === '已开发' ? 'done' : 'none'">{{ tt(devStatus) }}</span>
                  <el-icon class="rs-ref-ico"><Search /></el-icon>
                </div>
                <template v-else-if="editable && c.type === 'select'">
                  <!-- 标准库型字段(成型工艺的 烧结炉参数/烧结时间调速器参数/冷却参数设置):
                       选项来自可维护库,故 filterable+allow-create —— 能选预设也能直接敲新值
                       (设计口径「下拉选择项 + 选择后同时支持再次修改」);旁挂标准库维护入口。 -->
                  <el-select v-model="head[c.key]" size="small" :clearable="false"
                             :placeholder="c.ph ? tt(c.ph) : ''"
                             :filterable="!!stdLibOf(c.key)" :allow-create="!!stdLibOf(c.key)" default-first-option
                             @change="emit('dirty')">
                    <el-option v-for="o in selectOptions(c.key)" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                  <span v-if="stdLibOf(c.key)" class="rs-lib-btn no-print" @click.stop="openStdLib(stdLibOf(c.key))">⧉ {{ tt('标准库维护') }}</span>
                </template>
                <template v-else-if="editable && c.type === 'checks'">
                  <!-- 复选格(变更申请单 YJ-QR-130):「性质」□变更 □新增(c.single=单选语义)、
                       「变更文件」□成型工艺清单 □组装工艺清单 □规格书 □出货检验计划表(多选)。
                       存储口径 = **顿号分隔的文本**(与 rd_change_head.变更文件 一致,后端按 contains 判定);
                       不新增字段类型,纸面上就是几个方框。 -->
                  <span class="rs-checks">
                    <el-checkbox
                      v-for="o in (c.options || [])"
                      :key="o"
                      :model-value="checkList(head[c.key]).includes(o)"
                      @change="toggleCheck(c.key, o, !!c.single)"
                    >{{ tt(o) }}</el-checkbox>
                  </span>
                </template>
                <template v-else-if="editable && c.key && !c.ro">
                  <el-input v-if="c.area" v-model="head[c.key]" type="textarea" :autosize="{ minRows: c.rows || 1, maxRows: 6 }" size="small" :maxlength="c.max || 2000" :placeholder="c.ph ? tt(c.ph) : ''" class="rs-t-in" @input="emit('dirty')" />
                  <el-input v-else v-model="head[c.key]" size="small" :maxlength="c.max || 2000" :placeholder="c.ph ? tt(c.ph) : ''" class="rs-t-in" @input="emit('dirty')" />
                  <!-- 标准库型字段但版式要文本框(配料要求/热压要求):文本可自由改 + ⌄标准库 选预设 -->
                  <span v-if="stdLibOf(c.key)" class="rsp-lib-pick" @click.stop="openSectionLib(c)">⌄ {{ tt('标准库') }}</span>
                </template>
                <!-- 变更文件(只读态/审批后):勾选的文件渲染成**跳转入口**(2026-10-19 用户口径:
                     勾了哪些,审批后按本单「产品编号」给出对应文件的入口;点击开页签并按 docNo 定位)。
                     只读态才出现;编辑态仍是上面的复选框。 -->
                <span v-else-if="!editable && c.type === 'checks' && c.link && checkList(head[c.key]).length" class="rs-file-links no-print">
                  <el-button v-for="o in checkList(head[c.key])" :key="o" link type="primary" size="small"
                             @click.stop="openLinkedFile(c, o)">{{ tt(o) }}</el-button>
                </span>
                <AnnotatedText v-else class="rs-txt" :text="head[c.key] || c.fixed || ''" :field-key="String(c.key || '')" />
              </td>
            </template>
          </tr>

          <!-- 工序阶段行(成型工艺):左端 stage 纵向合并 + 参数键值对(可两对) -->
          <tr v-else-if="sec.stage">
            <td v-if="row.stage" class="rs-td rs-label rsp-stage" :rowspan="stageSpan(sec, ri)" :colspan="2">{{ tt(row.stage) }}</td>
            <td class="rs-td rs-label">{{ tt(row.label) }}</td>
            <td class="rs-td" :colspan="row.label2 ? 2 : 5">
              <el-input v-if="editable" v-model="head[row.key]" size="small" :maxlength="row.max || 500" class="rs-t-in" @input="emit('dirty')" />
              <AnnotatedText v-else class="rs-txt" :text="head[row.key] || ''" :field-key="String(row.key || '')" />
            </td>
            <template v-if="row.label2">
              <td class="rs-td rs-label">{{ tt(row.label2) }}</td>
              <td class="rs-td" colspan="2">
                <el-input v-if="editable" v-model="head[row.key2]" size="small" :maxlength="row.max2 || 500" class="rs-t-in" @input="emit('dirty')" />
                <AnnotatedText v-else class="rs-txt" :text="head[row.key2] || ''" :field-key="String(row.key2 || '')" />
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
                <AnnotatedText v-else class="rs-txt" :text="head[c.key] || ''" :field-key="String(c.key || '')" />
              </td>
            </template>
            <td v-else class="rs-td" :colspan="nCols > 1 ? nCols - 1 : 1">
              <!-- 参照字段(plain 版式也支持:2026-09-11 组装工艺清单头补「产品编号」→ 参照产品信息表;
                   此前这一支只渲染纯输入框,参照字段在 plain 版式里点不开弹窗) -->
              <div v-if="editable && isRefKey(row.key)" class="rs-ref-ctl" :title="tt('点击选择')" @click="openProdRef(row.key)">
                <span class="rs-ref-text">{{ head[row.key] || tt('点击选择') }}</span>
                <span v-if="devStatus && devKey === row.key" class="rs-dev-badge" :class="devStatus === '已开发' ? 'done' : 'none'">{{ tt(devStatus) }}</span>
                <el-icon class="rs-ref-ico"><Search /></el-icon>
              </div>
              <el-input v-else-if="editable && row.type === 'text'" v-model="head[row.key]" size="small" :maxlength="row.max || 300" class="rs-t-in" @input="emit('dirty')" />
              <el-input v-else-if="editable" v-model="head[row.key]" type="textarea" :autosize="{ minRows: row.tall ? 3 : 1, maxRows: 12 }" size="small" :maxlength="row.max || 2000" class="rs-t-in" @input="emit('dirty')" />
              <AnnotatedText v-else class="rs-txt" :class="{ 'rsp-pre': row.tall }" :text="head[row.key] || ''" :field-key="String(row.key || '')" />
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
                        <AnnotatedText v-else class="rs-txt" :text="head[waterKeys[i]] || ''" :field-key="String(waterKeys[i] || '')" />
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
              <AnnotatedText v-else class="rs-txt" :text="head[soakSizeKeys[i]] || ''" :field-key="String(soakSizeKeys[i] || '')" />
            </td>
          </tr>
          <tr>
            <td class="rs-td rs-label">{{ tt('浸泡液用量（ml）') }}</td>
            <td v-for="(cs, i) in cfg.soakColspans" :key="'sv2' + i" class="rs-td" :colspan="cs">
              <el-input v-if="editable" v-model="head[soakVolKeys[i]]" size="small" maxlength="60" class="rs-t-in" @input="emit('dirty')" />
              <AnnotatedText v-else class="rs-txt" :text="head[soakVolKeys[i]] || ''" :field-key="String(soakVolKeys[i] || '')" />
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
            <td class="rs-td"><el-input v-if="editable" v-model="head[it.keys[0]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><AnnotatedText v-else class="rs-txt" :text="head[it.keys[0]] || ''" :field-key="String(it.keys[0] || '')" /></td>
            <td class="rs-td"><el-input v-if="editable" v-model="head[it.keys[1]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><AnnotatedText v-else class="rs-txt" :text="head[it.keys[1]] || ''" :field-key="String(it.keys[1] || '')" /></td>
            <td class="rs-td" :colspan="cfg.soakColspans[2]"><el-input v-if="editable" v-model="head[it.keys[2]]" size="small" maxlength="120" class="rs-t-in" @input="emit('dirty')" /><AnnotatedText v-else class="rs-txt" :text="head[it.keys[2]] || ''" :field-key="String(it.keys[2] || '')" /></td>
          </tr>
        </template>
      </tbody>
    </table>

    <!-- ═══ 表尾文档式章节行(规格书第4页:5.关键物料列表数据表之后跟 6-8 章节) ═══ -->
    <table v-for="(sec, si) in cfg.tailDocSections || []" v-show="pageOf(sec) === activePage" :key="'tds' + si" class="rs-t" :style="{ width: gridW + 'px' }">
      <colgroup><col v-for="(w, i) in secCols(sec)" :key="'tdc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <tr v-for="(row, ri) in sec.rows" :key="'tdr' + ri">
          <td :colspan="secCols(sec).length" class="rsp-doccell">
            <div class="rsp-docrow" :class="{ 'rs-focus': isFocus(row.key) }">
              <span class="rsp-doclabel">{{ tt(row.label) }}：</span>
              <el-input v-if="editable" v-model="head[row.key]" type="textarea" :autosize="{ minRows: row.area ? 2 : 1, maxRows: 8 }" size="small" class="rsp-docinput" :maxlength="row.max || 2000" @input="emit('dirty')" />
              <span v-else class="rsp-docval rsp-pre">{{ head[row.key] || '' }}</span>
              <span v-if="editable" class="rsp-lib-pick" @click.stop="openSectionLib(row)">⌄ {{ tt('标准库') }}</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 表尾区(成型配方:配料要求——数据表之后;多页签面板按 page 归属渲染) ═══ -->
    <table v-for="(sec, si) in cfg.tailSections || []" v-show="pageOf(sec) === activePage" :key="'ts' + si" class="rs-t" :style="{ width: gridW + 'px' }">
      <colgroup><col v-for="(w, i) in effGrid" :key="'tc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <tr><td :colspan="nCols" class="rs-sectionbar">{{ tt(sec.bar) }}</td></tr>
        <tr v-for="(row, ri) in sec.rows" :key="'tr' + ri" :style="row.h ? { height: row.h + 'px' } : null">
          <!-- 表尾**网格行**(2026-10-16 用户报障「产品变更申请表这个位置的格子有点窄,竖向加长到 1.5 倍」)——
               尾段原先只认旧式 { label, key } 单键行:RD_CHANGE 那种 { h, grid:[…] } 会被渲染成
               「一个空标签格(row.label 为 undefined)+ 一个大格(head[undefined])」,高度掉到自然行高
               (实测 31px),配置里写的 h(74/92) 完全不起作用 —— 用户看到的"扁格子"就是这个。
               现补齐与 sections **同款**的网格渲染(逐格 label/值/area/select/checks/file + row.h 最小行高);
               旧式单键行仍走下面那支(成型配方「配料要求」等面板一字不动)。
               ⚠ 与上面 sections 的网格行是**同一套格语义**,改一边要同步另一边(源契约测试已钉)。 -->
          <template v-if="row.grid">
            <template v-for="(c, ci) in row.grid" :key="'tg' + ci">
              <td v-if="c.label" class="rs-td rs-label" :colspan="c.span || 1" :rowspan="c.rowspan || 1"
                  :style="c.cap ? 'background:#9c9c9c;color:#fff;font-weight:600;font-size:12.5px' : ''">
                <span>{{ tt(effColLabel(c.label, c.label)) }}</span>
              </td>
              <td v-else class="rs-td" :class="{ 'rs-focus': isFocus(c.key) }" :colspan="c.span || 1" :rowspan="c.rowspan || 1">
                <template v-if="editable && c.type === 'select'">
                  <el-select v-model="head[c.key]" size="small" :clearable="false"
                             :placeholder="c.ph ? tt(c.ph) : ''"
                             :filterable="!!stdLibOf(c.key)" :allow-create="!!stdLibOf(c.key)" default-first-option
                             @change="emit('dirty')">
                    <el-option v-for="o in selectOptions(c.key)" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                  <span v-if="stdLibOf(c.key)" class="rs-lib-btn no-print" @click.stop="openStdLib(stdLibOf(c.key))">⧉ {{ tt('标准库维护') }}</span>
                </template>
                <template v-else-if="editable && c.type === 'checks'">
                  <span class="rs-checks">
                    <el-checkbox
                      v-for="o in (c.options || [])"
                      :key="o"
                      :model-value="checkList(head[c.key]).includes(o)"
                      @change="toggleCheck(c.key, o, !!c.single)"
                    >{{ tt(o) }}</el-checkbox>
                  </span>
                </template>
                <template v-else-if="editable && c.key && !c.ro">
                  <el-input v-if="c.area" v-model="head[c.key]" type="textarea" :autosize="{ minRows: c.rows || 1, maxRows: 6 }" size="small" :maxlength="c.max || 2000" :placeholder="c.ph ? tt(c.ph) : ''" class="rs-t-in" @input="emit('dirty')" />
                  <el-input v-else v-model="head[c.key]" size="small" :maxlength="c.max || 2000" :placeholder="c.ph ? tt(c.ph) : ''" class="rs-t-in" @input="emit('dirty')" />
                </template>
                <!-- 变更文件(只读态/审批后):勾选的文件渲染成**跳转入口**(2026-10-19 用户口径:
                     勾了哪些,审批后按本单「产品编号」给出对应文件的入口;点击开页签并按 docNo 定位)。
                     只读态才出现;编辑态仍是上面的复选框。 -->
                <span v-else-if="!editable && c.type === 'checks' && c.link && checkList(head[c.key]).length" class="rs-file-links no-print">
                  <el-button v-for="o in checkList(head[c.key])" :key="o" link type="primary" size="small"
                             @click.stop="openLinkedFile(c, o)">{{ tt(o) }}</el-button>
                </span>
                <AnnotatedText v-else class="rs-txt" :text="head[c.key] || c.fixed || ''" :field-key="String(c.key || '')" />
              </td>
            </template>
          </template>
          <template v-else>
            <td class="rs-td rs-label" :class="{ 'rs-focus': isFocus(row.key) }">{{ tt(row.label) }}</td>
            <td class="rs-td" :class="{ 'rs-focus': isFocus(row.key) }" :colspan="nCols - 1">
              <el-input v-if="editable && row.type === 'text'" v-model="head[row.key]" size="small" :maxlength="row.max || 300" class="rs-t-in" @input="emit('dirty')" />
              <el-input v-else-if="editable" v-model="head[row.key]" type="textarea" :autosize="{ minRows: row.rows || 1, maxRows: 8 }" size="small" :maxlength="row.max || 2000" class="rs-t-in" @input="emit('dirty')" />
              <AnnotatedText v-else class="rs-txt" :text="head[row.key] || ''" :field-key="String(row.key || '')" />
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 表尾静态表(cfg.tailTables:设计纸面上的固定附录,只读、不落库、不进单据) ═══
         用例 = 测试申请单页 0 的「国标浸泡安全指标可测试列表」(设计 sheet 内部1 第 37 行起 17 行)。
         单元值**按原文渲染**(国家标准指标 / 仪器型名属事实内容,与 RD_SOAK 明细行同一口径不翻译);
         标题(bar)与列标签走 tt()。宽度取本表自己的列宽之和并居中(设计里它比整页窄)。 -->
    <table
      v-for="(tt2, ti) in tailTablesOfPage"
      :key="'tt' + ti"
      class="rs-t rs-tail-table"
      :style="{ width: tailTableW(tt2) + 'px' }"
    >
      <colgroup><col v-for="(c, i) in tt2.cols" :key="'tc2' + i" :style="{ width: (c.w || 120) + 'px' }" /></colgroup>
      <tbody>
        <tr v-if="tt2.bar"><td :colspan="tt2.cols.length" class="rs-sectionbar">{{ tt(tt2.bar) }}</td></tr>
        <tr>
          <th v-for="c in tt2.cols" :key="'th2' + c.key" class="rs-th">{{ tt(c.label) }}</th>
        </tr>
        <tr v-for="(row, ri) in tt2.rows" :key="'tr2' + ri">
          <td v-for="c in tt2.cols" :key="'td2' + c.key" class="rs-td" :class="{ 'rsp-center': c.align === 'center' }">
            <span class="rs-txt rsp-cell">{{ row[c.key] || '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 只读台账页(pages[i].ledger):把本面板**全部单据**的表头摘要列成一张纸面表格 ═══
         用例 = 测试申请单页 2「委托测试汇总表」(设计 sheet 汇总表)。
         数据源 = POST /px/queryFormDataList(面板自身列表接口,与左侧选单栏同一份真源),只读、不落库。
         ⚠ 口径:它是**派生视图**而非单据的一页 —— 换单/翻页/筛选都不影响它的内容(列的是全量单据)。 -->
    <div v-if="ledgerCfg" class="rsp-ledger" :style="{ width: ledgerW + 'px' }">
      <table class="rs-t rs-ledger-t" :style="{ width: ledgerW + 'px' }">
        <colgroup><col v-for="(c, i) in ledgerCfg.cols" :key="'lc' + i" :style="{ width: (c.w || 120) + 'px' }" /></colgroup>
        <tbody>
          <tr v-if="ledgerCfg.title"><td :colspan="ledgerCfg.cols.length" class="rsp-page-title">{{ tt(ledgerCfg.title) }}</td></tr>
          <tr>
            <th v-for="c in ledgerCfg.cols" :key="'lh' + c.label" class="rs-th">{{ tt(c.label) }}</th>
          </tr>
          <!-- 设计第 8 行:分类/状态 两格写着可选取值(内部/外部、测试中/已完成/已审核) —— 照纸面保留 -->
          <tr v-if="ledgerCfg.cols.some((c) => c.hint)" class="rsp-ledger-hint">
            <td v-for="c in ledgerCfg.cols" :key="'lhh' + c.label" class="rs-td">{{ c.hint ? tt(c.hint) : '' }}</td>
          </tr>
          <tr v-for="(row, ri) in ledgerRows" :key="'lr' + ri">
            <td v-for="c in ledgerCfg.cols" :key="'lc' + c.label" class="rs-td" :class="{ 'rsp-center': c.align === 'center' }">
              <span class="rs-txt rsp-cell">{{ ledgerCell(c, row, ri) }}</span>
            </td>
          </tr>
          <tr v-if="ledgerLoading">
            <td :colspan="ledgerCfg.cols.length" class="rs-empty">{{ tt('加载中…') }}</td>
          </tr>
          <tr v-else-if="!ledgerRows.length">
            <td :colspan="ledgerCfg.cols.length" class="rs-empty">{{ tt('暂无申请单') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══ 结论区(共享网格;Excel 无结论区的表不渲染) ═══ -->
    <table v-if="cfg.conclusion" class="rs-t" :style="{ width: gridW + 'px' }">
      <colgroup><col v-for="(w, i) in cfg.grid" :key="'cc' + i" :style="{ width: w + 'px' }" /></colgroup>
      <tbody>
        <tr><td :colspan="nCols" class="rs-sectionbar">{{ tt(cfg.conclusion.bar) }}</td></tr>
        <tr>
          <td class="rs-td rs-conclusion" :colspan="nCols">
            <el-input v-if="editable" v-model="head[cfg.conclusion.key]" type="textarea" :autosize="{ minRows: 2, maxRows: 12 }" size="small" class="rs-t-in" @input="emit('dirty')" />
            <AnnotatedText v-else class="rs-txt" :text="head[cfg.conclusion.key] || ''" :field-key="String(cfg.conclusion.key || '')" />
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ 标准库勾选弹窗(规格书检验项目:分组库;出货检验计划:必测项+型式项扁平表;
             组装工艺:4 变体整表替换) ═══ -->
    <el-dialog v-model="libVisible" :title="tt(libDialogTitle)" width="880px" append-to-body>
      <!-- 变体库:本弹窗只提供「选一条→替换」,条目正文的编辑在「标准库维护」——
           这句通用提示里的「勾选一条可编辑」对它不成立,故不显示(见 isAsmProcLib) -->
      <div v-if="!isAsmProcLib" class="lib-tip">{{ tt('库条目均可维护：勾选一条可「编辑」，✕ 停用、↩ 恢复启用；改库只影响以后的勾选，已录入单据不变。') }}</div>
      <!-- 组装工艺 4 变体:一变体一条目,勾选即整表替换 -->
      <template v-if="libTargetDt && libTargetDt.lib === 'asm.proc'">
        <div class="lib-tip">{{ tt('选一个变体：该变体的一整套工序会替换本表当前内容（不是追加）。可在此「停用」整条；要改工序内容请到「标准库维护」。') }}</div>
        <el-table
          :data="libRows"
          size="small"
          border
          max-height="480"
          highlight-current-row
          :row-class-name="({ row }) => (row.off ? 'lib-row-off' : '')"
          @current-change="(row) => (libChecked = row && !row.off ? [row] : [])"
        >
          <el-table-column width="42">
            <template #default="{ row }">
              <el-radio :model-value="libChecked[0] && libChecked[0].item" :value="row.item" :disabled="row.off" @change="() => (libChecked = row.off ? [] : [row])"><span /></el-radio>
            </template>
          </el-table-column>
          <el-table-column prop="item" :label="tt('变体')" width="160">
            <template #default="{ row }">{{ row.name + (row.off ? '（' + tt('已停用') + '）' : '') }}</template>
          </el-table-column>
          <el-table-column :label="tt('工序数')" width="90" align="right">
            <template #default="{ row }">{{ row.n }}</template>
          </el-table-column>
          <el-table-column :label="tt('工序一览')" min-width="360">
            <template #default="{ row }">{{ (row.rows || []).map((r) => r['工序']).join(' / ') }}</template>
          </el-table-column>
        </el-table>
      </template>
      <template v-else-if="libRows.length && Array.isArray(libRows[0].subs)">
        <el-scrollbar max-height="520">
          <div v-for="(g, gi) in libRows" :key="'lg' + gi" class="lib-group">
            <div class="lib-group-name">{{ tt(g.name) }}</div>
            <div class="lib-group-subs">
              <div v-for="(s, si) in g.subs" :key="'ls' + gi + '-' + si" class="lib-sub-item" :class="{ 'lib-sub-item-off': s.off }">
                <el-checkbox
                  :model-value="libChecked.includes(gi + ':' + si)"
                  :disabled="s.off"
                  @change="(v) => toggleLib(gi + ':' + si, !!v)"
                >
                  <span class="lib-sub-name" :class="{ 'lib-sub-name-off': s.off }">{{ (s.name ? tt(s.name) : tt('（项目）')) + (s.off ? '（' + tt('已停用') + '）' : '') }}</span>
                  <span class="lib-sub-req">{{ String(s.req || '').split('\n')[0].slice(0, 26) }}</span>
                </el-checkbox>
                <span v-if="s.dbId && !s.off" class="lib-sub-del" :title="tt('停用')" @click.stop="stopLibRow(s.dbId)">✕</span>
                <span v-if="s.off" class="lib-sub-undo" :title="tt('恢复启用')" @click.stop="enableLibRow(s.dbId)">↩</span>
                <span v-if="s.dbId" class="lib-sub-destroy" :title="tt('彻底删除')" @click.stop="destroyLibRow(s.dbId)">🗑</span>
              </div>
            </div>
          </div>
        </el-scrollbar>
        <div class="lib-custom">
          <div class="lib-custom-title">{{ tt('补充自定义检验项') }}({{ tt('存入后长期可用') }})</div>
          <div class="lib-custom-form">
            <el-input v-model="libCGroup" size="small" :readonly="!!libCEditId" :title="libCEditId ? tt('组名是条目的归属(item_code)，编辑接口不改它；要换组请新建条目') : ''" :placeholder="tt('检验项目(组名)')" />
            <el-input v-model="libCSub" size="small" :placeholder="tt('子项目(可空)')" />
            <!-- 长文本字段自适应:autosize 随内容增高(编辑带入长值不再挤在 2 行小框里),宽度加宽 -->
            <el-input v-model="libCReq" size="small" type="textarea" :autosize="{ minRows: 2, maxRows: 10 }" class="lib-wide" :placeholder="tt('检验要求')" />
            <el-input v-model="libCMethod" size="small" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" class="lib-wide" :placeholder="tt('检验方法')" />
            <el-input v-model="libCBasis" size="small" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" class="lib-wide" :placeholder="tt('检验依据')" />
            <el-button size="small" type="primary" @click="addCustomTestLib">{{ libCEditId ? tt('保存修改') : tt('存入标准库') }}</el-button>
            <el-button v-if="libCEditId" size="small" @click="cancelEditTestLib">{{ tt('取消编辑') }}</el-button>
          </div>
        </div>
      </template>
      <el-table
        v-else
        :data="libRows"
        size="small"
        border
        max-height="480"
        :row-class-name="({ row }) => (row.off ? 'lib-row-off' : '')"
        @selection-change="(sel) => (libChecked = sel.filter((r) => !r.off))"
      >
        <el-table-column type="selection" width="42" :selectable="(row) => !row.off" />
        <!-- 分组列(必测项/型式检验):单表形态下两类条目同库,没有这一列就分不清谁是谁。
             值来自条目正文的 group(yj_std_lib.item_code),不是明细字段 ⇒ 不参与落库投影 -->
        <el-table-column v-if="libTargetDt?.libGroupKey" :label="tt('分组')" width="90" align="center">
          <template #default="{ row }">{{ tt(flatGroupOf(row)) }}</template>
        </el-table-column>
        <el-table-column prop="控制项目" :label="tt('控制项目')" min-width="110">
          <template #default="{ row }">{{ row['控制项目'] + (row.off ? '（' + tt('已停用') + '）' : '') }}</template>
        </el-table-column>
        <el-table-column prop="质量控制内容" :label="tt('质量控制内容')" min-width="110" />
        <el-table-column prop="检测仪器" :label="tt('检测仪器、工具')" min-width="100" />
        <el-table-column prop="控制标准及要求" :label="tt('控制标准及要求')" min-width="220" />
        <el-table-column prop="检验" :label="tt('检验')" width="60" />
        <el-table-column prop="检测频率" :label="tt('检测频率')" min-width="90" />
        <el-table-column prop="检验内容" :label="tt('检验内容')" min-width="140" />
        <el-table-column prop="控制方法" :label="tt('控制方法')" min-width="90" />
        <el-table-column v-if="hasDbFlat" :label="tt('操作')" width="80" align="center">
          <template #default="{ row }">
            <span v-if="row.dbId && !row.off" class="lib-sub-del" :title="tt('停用')" @click.stop="stopLibRow(row.dbId)">✕</span>
            <span v-else-if="row.off" class="lib-sub-undo" :title="tt('恢复启用')" @click.stop="enableLibRow(row.dbId)">↩</span>
            <span v-if="row.dbId" class="lib-sub-destroy" :title="tt('彻底删除')" @click.stop="destroyLibRow(row.dbId)">🗑</span>
          </template>
        </el-table-column>
      </el-table>
      <!-- 出货检验计划:自定义补充表单(扁平结构)。变体库没有这 7 个字段,排除(见 isAsmProcLib) -->
      <div v-if="!isGroupedLib && !isAsmProcLib" class="lib-custom">
        <div class="lib-custom-title">{{ tt('补充自定义检验项') }}({{ tt('存入后长期可用') }})</div>
        <div class="lib-custom-form">
          <!-- 分组(必测项/型式检验):这一格就是条目在库里的 item_code,不是明细字段。
               单表形态没有表区可推 ⇒ 必须让用户选/填一个(空值后端直接 400)。
               allow-create:选项随 yj_field.options 走,新分组名不必先去维护字段选项 -->
          <el-select
            v-if="libTargetDt?.libGroupKey"
            v-model="libFGroup"
            size="small"
            filterable
            allow-create
            default-first-option
            :placeholder="tt('分组')"
            style="width:120px"
          >
            <el-option v-for="o in selectOptions(libTargetDt.libGroupKey)" :key="o.value" :label="tt(o.label)" :value="o.value" />
          </el-select>
          <el-input v-model="libFControl" size="small" :placeholder="tt('控制项目')" />
          <el-input v-model="libFQuality" size="small" :placeholder="tt('质量控制内容')" />
          <el-input v-model="libFInstrument" size="small" :placeholder="tt('检测仪器、工具')" />
          <!-- 长文本字段自适应:autosize 随内容增高,宽度加宽 -->
          <el-input v-model="libFStandard" size="small" type="textarea" :autosize="{ minRows: 2, maxRows: 10 }" class="lib-wide" :placeholder="tt('控制标准及要求')" />
          <el-input v-model="libFFrequency" size="small" :placeholder="tt('检测频率')" />
          <el-input v-model="libFContent" size="small" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" class="lib-wide" :placeholder="tt('检验内容')" />
          <el-input v-model="libFMethod" size="small" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" class="lib-wide" :placeholder="tt('控制方法')" />
          <el-button size="small" type="primary" @click="addCustomFlatLib">{{ libFEditId ? tt('保存修改') : tt('存入标准库') }}</el-button>
          <el-button v-if="libFEditId" size="small" @click="cancelEditFlatLib">{{ tt('取消编辑') }}</el-button>
        </div>
      </div>
      <template #footer>
        <el-button :disabled="!canEditLibEntry" @click="editLibEntry">{{ tt('编辑') }}</el-button>
        <el-button @click="libVisible = false">{{ tt('取消') }}</el-button>
        <!-- 变体库是**整表替换**而非逐条追加(confirmLib),按钮文案要跟着语义走,
             否则写着「追加」实为「清空本表区再灌入」,用户按下去才发现原来的行没了 -->
        <el-button type="primary" @click="confirmLib">{{ isAsmProcLib ? tt('替换本表内容') : tt('追加选中项') }}({{ libChecked.length }})</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 从商品引用(数据源 = 商品档案 INV → bs_inv,2026-10-21 用户口径)═══
         用户原话:「把规格书的从物料清单引用进行一个修改,首先是把引用的数据内容改为引用商品里面的数据,
         弹窗可以通过上面那些信息来索引数据,然后勾选填写进去,**每进行一个字段的填写,其他选项就可以
         对应的范围缩小**,方便查找」。
         ⇒ 顶部四栏 = 商品列表的四列(所属类别 / 存货编码 / 存货名称 / 规格型号),四栏互为筛选项:
           选了「所属类别」,另外三栏的候选就只剩这一类里的值(纯函数见 @core/panel/goodsPick.js)。
         ⇒ 勾选后按 物料编码←存货编码 / 物料名称←存货名称 / 规格参数←规格型号 / 备注←商品备注 落行。 -->
    <el-dialog v-model="matPickVisible" :title="tt(matPickTitle)" width="900px" append-to-body>
      <div class="gp-bar">
        <div v-for="f in matPickFacets" :key="f.key" class="gp-filter">
          <span class="gp-filter-label">{{ tt(f.key) }}</span>
          <el-select
            v-model="matPickFilters[f.key]"
            size="small"
            filterable
            clearable
            :placeholder="tt('全部')"
            class="gp-filter-select"
          >
            <el-option v-for="v in f.values" :key="v" :label="v" :value="v" />
          </el-select>
          <span v-if="f.more" class="gp-more">{{ tt('还有 {n} 项，输入关键字筛选').replace('{n}', String(f.more)) }}</span>
        </div>
        <el-button size="small" text @click="resetMatPickFilters">{{ tt('清空筛选') }}</el-button>
      </div>
      <el-table v-loading="matPickLoading" :data="matPickFiltered" size="small" border max-height="420"
                row-key="__k" @selection-change="onMatPickSelection">
        <el-table-column type="selection" width="42" />
        <el-table-column prop="所属类别" :label="tt('所属类别')" width="130" show-overflow-tooltip />
        <el-table-column prop="存货编码" :label="tt('存货编码')" width="150" show-overflow-tooltip />
        <el-table-column prop="存货名称" :label="tt('存货名称')" min-width="230" show-overflow-tooltip />
        <el-table-column prop="规格型号" :label="tt('规格型号')" min-width="190" show-overflow-tooltip />
        <el-table-column prop="计量单位" :label="tt('计量单位')" width="90" align="center" />
        <el-table-column prop="备注" :label="tt('备注')" min-width="140" show-overflow-tooltip />
      </el-table>
      <div style="color:#909399;font-size:12px;margin-top:6px">{{ matPickHint }}</div>
      <template #footer>
        <el-button @click="matPickVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="confirmMaterialPick">{{ tt('引用') }}({{ matPickChecked.length }})</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 封面「产品编号」← 产品信息表(RD_PROD_INFO)引用弹窗 ═══
         用户口径见 recordSheetConfigs.js 的 prodPick 注释。三点与通用参照弹窗不同:
           ① 不按 单据状态 过滤(通用链强制"已审核",而产品信息表多是草稿/已归档 ⇒ 会全空);
           ② 已引用的产品编号**画在这里就选不了**(点它只提示,不选中);
           ③ 列表按 单据日期/单据编号 倒序 —— 「最新的产品信息表在最上面」。 -->
    <el-dialog v-model="prodPickVisible" :title="tt('引用产品信息表')" width="800px" append-to-body>
      <div class="pp-toolbar">
        <el-input v-model="prodPickKeyword" size="small" clearable style="width:260px"
                  :placeholder="tt('搜索产品编号/产品名称')" />
        <span class="pp-tip">{{ tt('数据源：产品信息表；按最新在前排序') }}</span>
      </div>
      <div class="pp-body">
        <el-table v-loading="prodPickLoading" :data="prodPickFiltered" size="small" border max-height="400"
                  row-key="__pk" :row-class-name="prodPickRowClass" @row-click="onProdPickRowClick">
          <el-table-column v-for="c in prodPickCols" :key="c.key" :prop="c.key" :label="tt(c.label)"
                           :width="c.w" :min-width="c.min" show-overflow-tooltip />
          <el-table-column :label="tt('状态')" width="104" align="center" fixed="right">
            <template #default="{ row }">
              <span class="rs-dev-badge" :class="row.__used ? 'done' : 'none'">{{ row.__used ? tt('已开发') : tt('可引用') }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pp-foot">{{ prodPickHint }}</div>
      <template #footer>
        <el-button @click="prodPickVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" :disabled="!prodPickRow" @click="confirmProdPick">{{ tt('确定') }}</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 章节标准库(yj_std_lib,lib=spec.section) ═══ -->
    <el-dialog v-model="secLibVisible" :title="tt('章节标准库') + ' · ' + tt(secLibLabel)" width="760px" append-to-body>
      <StdLibManager ref="secLibRef" :lib="secLibLib" :item="secLibItem" :add-item="secLibItem" pickable :show-add="false" @pick="applySectionLib" />
      <div class="sec-lib-add">
        <el-input v-model="secLibDraft" type="textarea" :rows="3" :placeholder="tt('新条目(默认带入当前值，编辑后存入)')" />
        <el-button type="primary" @click="addSectionLib">{{ tt('存入标准库') }}</el-button>
      </div>
      <template #footer>
        <el-button @click="secLibVisible = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>

    <!-- ═══ 字段编辑(数据记录表/成型工艺):列名/显隐 可改,应对复杂测试环境 ═══ -->
    <el-dialog v-model="fieldEditVisible" :title="tt('字段编辑')" width="620px" append-to-body>
      <div class="fe-list">
        <div v-for="(row, idx) in fieldEditRows" :key="idx" class="fe-row">
          <span class="fe-key" :title="row.key">{{ row.key }}</span>
          <span class="fe-label">{{ row.label }}</span>
          <el-input
            :model-value="row.alias"
            @update:model-value="(v) => { row.alias = v }"
            size="small"
            :placeholder="row.label"
            clearable
            class="fe-alias"
          />
          <el-checkbox :model-value="row.visible" @update:model-value="(v) => { row.visible = v }" class="fe-vis" />
        </div>
      </div>
      <div style="margin-top:8px;color:#909399;font-size:12px">{{ tt('留空=沿用原名;修改全局生效(所有用户共享)') }}</div>
      <template #footer>
        <el-button @click="fieldEditVisible = false">{{ tt('取消') }}</el-button>
        <el-button type="primary" @click="saveFieldEdit">{{ tt('保存') }}</el-button>
      </template>
    </el-dialog>
    <!-- 标准库维护(可增/可编辑/可停用/可恢复启用;打印时隐藏) -->
    <el-dialog v-model="stdLibVisible" :title="tt('标准库维护') + ' · ' + tt(stdLibName)" width="680px" append-to-body>
      <StdLibManager :lib="stdLibCode" @changed="onStdLibChanged" />
      <template #footer>
        <el-button @click="stdLibVisible = false">{{ tt('关闭') }}</el-button>
      </template>
    </el-dialog>


    <!-- ═══ 配方计算(成型工艺清单:弹窗里录配方表物料行 → 算 → 写回页 1 与页 2 配方表;输入不落库) ═══ -->
    <RecipeCalcDialog v-model="recipeCalcVisible" :head="head" :rows="recipeCalcRows" @applied="onRecipeApplied" />

    <!-- ═══ 参照选择(产品编号 -> 产品信息表):确认后按 refMap 带回 产品名称 等 ═══ -->
    <RefPickDialog v-model="prodRefVisible" :field="prodRefField" mode="header" :owner-panel="panelCode" @confirm="onProdRefConfirm" />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, nextTick } from 'vue'
import { tt } from '@/i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import request from '@/core/request'
import { recordSheetConfigs } from './recordSheetConfigs'
import { pageOfKeyIn, pageOfLabelIn } from './recordSheetFocus'
import { productCodeWithSuffix, rawProductCode } from '@core/panel/productCodeSuffix.js'
import { sectionLibText } from './sectionLibText'
import { toCanonical, toSpecSub, toInspRow, toContentJson, emptyEntry } from '@/core/panel/testItemLib'
import { docNoKeyOf } from '@/core/panel/sheetDocNo'
import { sumKeepScale } from '@/core/panel/sumTotals'
import { groupRows, stampGroup } from '@/core/panel/recordGroup'
import { specCarryFailure, specDrift, specCarryRequest, specNotApprovedTip, specDriftEnabled, headFromSpecDetail, specCarryRows, detailRowsOf } from '@/core/insp/specCarry'
import RefPickDialog from './RefPickDialog.vue'
import StdLibManager from './StdLibManager.vue'
import FileAttachCell from './FileAttachCell.vue'
// 纸面只读值格:按「标注笔/橡皮擦」的标注切段着色(屏幕与打印同一套 DOM ⇒ 打印带色)
import AnnotatedText from './AnnotatedText.vue'
import RecipeCalcDialog from './RecipeCalcDialog.vue'
// 只读台账页(委托测试汇总表)的单元格取值:抽成纯函数便于 node --test 直接断言
import { ledgerCell as ledgerCellOf } from '@/core/panel/ledgerCols'
// 日期/时间格:控件种类按 yj_field.data_type 决定,取值归一同上(纯函数 + 单测)
import { cellKindOf, cellText, controlValue, controlToStored } from '@/core/panel/sheetDateCells'
// 选「产品编号」→ 炭棒规格三窄格的回填口径(三个独立字段优先,整串回退;纯函数 + 单测)
import { carbonSpecFrom } from '@/core/panel/carbonSpec'
// 明细「物料编号 ↔ 物料名称」按商品档案 INV 双向带出(唯一命中才带出;纯函数 + 单测)
import { INV_CARRY, INV_PANEL, invCarryPair, invRowsOf, invSearchRequest, pickInvCarry, pickInvKind } from '@/core/panel/invCarry'
import { GOODS_FACETS, facetValues, matchGoods, goodsToDetail } from '@/core/panel/goodsPick'
// 商品档案候选生成(编码+名称子串匹配、去重、封顶 OPTION_CAP 项)—— 与配方计算弹窗同一套纯函数
import { OPTION_CAP, invSearchOptions } from '@/core/mold/recipeRows'

/** 标准库型下拉列(2026-10-19:出货检验计划表的「检查频率」)——options 来自 yj_std_lib,可在弹窗里维护 */
const stdLibOpts = ref({})   // { libCode: [content, ...] }(复用下方既有 stdLibVisible/stdLibCode)
const STD_LIB_CODES = ['INSP_FREQ']

function colOptions(c) {
  if (c && c.stdLib && stdLibOpts.value[c.stdLib]) return stdLibOpts.value[c.stdLib]
  return (c && c.options) || []
}

/** 该列绑定的标准库编码(表头 ⌄ 维护入口用) */
function libOfCol(key) {
  const t = recordSheetConfigs[props.panelCode]
  if (!t) return ''
  for (const dt of t.dataTables || []) {
    const hit = (dt.cols || []).find((c) => c.key === key && c.stdLib)
    if (hit) return hit.stdLib
  }
  return ''
}

async function loadStdLibs() {
  for (const lib of STD_LIB_CODES) {
    try {
      const res = await request.get('/stdlib/list', { params: { lib, all: 1 } })
      const rows = (res?.data ?? res ?? []).filter((r) => r.enabled !== 0 && r.enabled !== false)
      const opts = []
      for (const r of rows) {
        const v = typeof r.content === 'string' ? r.content.trim() : ''
        if (v && !opts.includes(v)) opts.push(v)
      }
      stdLibOpts.value = { ...stdLibOpts.value, [lib]: opts }
    } catch (e) {
      /* 标准库不可用时退化为空候选(仍可手输,allow-create) */
    }
  }
}

const props = defineProps({
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  panelCode: { type: String, required: true },
  // 行级编辑门禁(产品变更申请单「部门评审意见」):当前账号可填的纸面部门行清单 ——
  // 由面板配置 metadata.changeDepts 下发(服务端按 yj_user.dept_id → yj_change_dept 算),
  // deptLockAll = 管理员豁免(可代填任何部门行)。两者只影响**界面**,服务端另有强制还原。
  myDeptRows: { type: Array, default: () => [] },
  deptLockAll: { type: Boolean, default: false },
})
// open-file:变更文件勾选项的跳转入口(2026-10-19)。本组件只管"查出该文件对应哪张单",
// 真正开页签交给 PanelxList(它持有 tabs store 与面板元数据)。
const emit = defineEmits(['dirty', 'refresh-config', 'open-file'])

const cfg = computed(() => recordSheetConfigs[props.panelCode] || null)
// 纸张右上「编号：」格绑哪个键 —— 文档类面板=文档编号,单据类面板=单据编号(写死文档编号会让
// 单据类面板编辑期间那格永远空白;见 @/core/panel/sheetDocNo 的说明)
const docNoKey = computed(() => docNoKeyOf(props.head))
// 版式:'report' | 'plain'——面板级值是缺省,多页签面板可按页覆盖(见 effPlain)

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
/** 该字段是不是标准库字段:是则返回标准库编码(后端 fieldSpec 下发的 stdLib),否则空串 */
function stdLibOf(key) {
  const f = (props.fields || []).find((x) => (x.dataName || x.code) === key)
  return f && f.dataType === '标准库' ? (f.stdLib || '') : ''
}

/** 列的控件种类('date'/'datetime'/'time'/'time-range'/'text'):查该列在 yj_field 里的 data_type
 *  ⇒ 加日期下拉**只改元数据**,不必回这张 1600 行的版式文件逐列写 type */
function cellKind(c) {
  const f = (props.fields || []).find((x) => (x.dataName || x.code) === c?.key)
  return cellKindOf(f?.dataType)
}

/** 日期/时间控件回值 → 写回行(区间合成文本),并置脏交给父级保存 */
function setCellValue(row, c, picked) {
  row[c.key] = controlToStored(cellKind(c), picked)
  emit('dirty')
}

// ---------- 明细「物料编号 ↔ 物料名称(+物料种类)」按商品档案带出(2026-10-14,2026-10-16 补种类) ----------
// 用户报障「输入物料编号无法自动录入对应物料名称、输入物料名称无法自动录入对应物料编号」。
// 2026-10-16 用户口径:「手动填写物料编码应该带出对应的物料类别以及物料名称,把填写框的物料种类的
// 下拉框改为普通文本框」—— 类别(物料种类)同样由这里带出,下拉已撤(见 recordSheetConfigs 配方表列)。
// 这三列在 yj_field 里是**普通文本、没有参照**(ref_panel 为空),所以照参照那条路走不通,
// 这里在**失焦/回车**(@change,不是 @input —— 否则每敲一个字发一次请求)按值查商品档案 INV。
// 口径全在 core/panel/invCarry.js:唯一命中才带出,查不到/多条 ⇒ 静默不动(用户手输的编码可能还没建档)。
// 生效范围由该明细表是否**同时**有 物料编号/物料名称 两列决定(库里只有成型工艺清单「配方表」两列齐全)。
const invCarryKeys = computed(() => {
  for (const dt of cfg.value?.dataTables || []) {
    const pair = invCarryPair(dt.cols)
    if (pair) return pair
  }
  return null
})

async function onDetailTextCommit(row, key) {
  if (!invCarryKeys.value?.includes(key)) return
  const typed = String(row[key] ?? '').trim()
  if (!typed) return
  const other = key === '物料编号' ? '物料名称' : '物料编号'
  try {
    // condition 用「档案列 label」(存货编码/存货名称);后端对普通文本字段走 LIKE,
    // 只是把结果收窄,精确与否由 pickInvCarry 在本地全等判定(见该文件头注②)。
    const res = await request.post('/px/queryFormDataList', {
      panelCode: INV_PANEL,
      condition: { [INV_CARRY[key].match]: typed },
      pageNo: 1,
      pageSize: 50,
    })
    const d = res?.data
    const rows = invRowsOf(d)
    const value = pickInvCarry(rows, key, typed)
    // 物料种类:2026-10-16 增补 —— 用户口径「手动填写物料编码应该带出对应的物料类别以及物料名称」。
    // 原先只写对侧那一格,于是页 2 那格里 物料名称 有值、物料种类 一直空着(用户截图即此)。
    // 规则与对侧格不同:这格**人手填过就不动**(料位分组是工艺员的判断,见 pickInvKind 注释)。
    const kind = pickInvKind(rows, key, typed, row['物料种类'])
    if (!value && !kind) return // 查不到 / 多条命中 / 对侧为空 / 类别认不出 ⇒ 一个格都不动,也不提示
    if (value) row[other] = value
    if (kind) row['物料种类'] = kind
    emit('dirty')
  } catch (e) {
    /* 无权限/网络异常都按「档案里没有」处理:保持用户输入,不弹错(与参照链路同款兜底) */
  }
}

/* ── 物料编号:商品档案远程模糊筛选(2026-10-16 用户口径)────────────────────────
   原话:「物料编号可以在填写的时候模糊筛选下拉显示提供选择,比如 YJ-LL-003,
          可以在输入 Y 或者 003 时模糊搜索到含这些数字字母的」。
   判据全在纯函数里(有单测):请求体 = invCarry.invSearchRequest(空关键字返回 null ⇒ 连请求都不发),
   候选 = recipeRows.invSearchOptions(编码+名称子串、大小写无关、去重、封顶 OPTION_CAP 项)。这里只管接线。

   控件选 el-autocomplete 而不是 el-select(2026-10-16 活体实测踩过):el-select + allow-create 在
   "打一个档案里没有的新编码、然后直接点别处"时会**把输入丢掉**(EP 只在"创建项"被选中时才落值);
   而"手打新编码"是这条链上必须保留的例外通道。autocomplete 的输入框本身**就是值**,候选只是建议。

   命中总数按**行对象**存(Map<行对象, {matched}>,靠 invOptsTick 触发重渲染 —— 行对象是稳定引用,
   行号键会在加行/删行后错位;配方计算弹窗是行号键,所以它加删行要 resetRowOptions)。 */
const INV_OPTS = new Map()          // 行对象 → { matched } 命中总数(>OPTION_CAP 时挂在 title 上提示继续输入)
const INV_PICKED = new Map()        // 行对象 → 刚从下拉里选中的值(随后的 blur change 不重复带出)
const invOptsTick = ref(0)
function setInvOpts(row, val) { INV_OPTS.set(row, val); invOptsTick.value++ }
/** 候选被上限截断时的提示(挂在控件 title 上:继续输入就能缩小) */
function invOptHint(row) {
  void invOptsTick.value
  const r = INV_OPTS.get(row)
  return r && r.matched > OPTION_CAP
    ? tt('共 {n} 条命中，继续输入可缩小范围').replace('{n}', String(r.matched))
    : ''
}
/**
 * 打字即筛:交给 el-autocomplete 的回调(它自己 debounce 300ms、自己管下拉开合与"加载中")。
 * 空关键字直接回空数组(一个请求都不发);读不到档案也回空数组 —— 只剩手打,不阻断录入。
 */
async function fetchInvCodes(row, q, cb) {
  const req = invSearchRequest(q)
  if (!req) { cb([]); return }
  try {
    const res = await request.post('/px/queryFormDataList', req)
    const hits = invSearchOptions(invRowsOf(res?.data), '物料编号', q)
    setInvOpts(row, { matched: hits.matched })
    cb(hits.options)          // [{ value: 编码, label: '编码 — 名称' }]
  } catch (e) {
    cb([])
  }
}
/** 从下拉里选中:记下这次的值(紧随其后的 blur change 不必再查一次),并按档案带出对侧值 */
function onInvCodePick(row, key, item) {
  const picked = item?.value ?? item
  if (picked !== undefined && picked !== null) row[key] = String(picked)
  INV_PICKED.set(row, String(picked ?? '').trim())
  emit('dirty')
  onDetailTextCommit(row, key)
}
/** 手打/失焦:置脏;刚在下拉里选过的那次已经带出过,不重复查 */
function onInvCodeChange(row, key) {
  emit('dirty')
  const v = String(row[key] ?? '').trim()
  if (INV_PICKED.get(row) === v) { INV_PICKED.delete(row); return }
  onDetailTextCommit(row, key)
}

/** 副标题下拉的选项:优先取字段元数据的 options(标准库字段即标准库条目),退回变体选项 */
const subtitleOptions = computed(() => {
  const key = cfg.value?.subtitle?.key
  if (!key) return []
  const o = selectOptions(key)
  return o.length ? o : variantOptions.value
})

// ---------- 标准库维护(实验室 4 张表的 测试项目/申请单类型/设备名称/仪器名称-型号) ----------
// 列表/新增/编辑/停用/恢复启用都在共用组件 StdLibManager 里(勾选→编辑按钮→行内改),
// 这里只负责决定打开哪个库、以及改完刷新下拉选项。
const stdLibVisible = ref(false)
const stdLibCode = ref('')
const stdLibName = ref('')

function openStdLib(lib) {
  if (!lib) return
  stdLibCode.value = lib
  stdLibName.value = cfg.value?.subtitle?.label ? String(cfg.value.subtitle.label).replace(/[：:]\s*$/, '') : lib
  stdLibVisible.value = true
}

/** 标准库条目变了:刷新字段选项,新增/改名立刻反映到下拉(不影响已录入单据的文本) */
function onStdLibChanged() {
  emit('refresh-config')
  loadStdLibs()   // 2026-10-19:标准库型下拉列(检查频率)立刻用上新条目
}

// ── 多页结构(规格书 / 成型工艺清单+成型配方 / 组装工艺清单+组装BOM表):页签切换,各区块按 page 归属渲染 ──
// activePage 必须先于 effGrid/effPlain 声明:它们按当前页解析 pages[i] 的 grid/headMode(见下)。
const activePage = ref(0)

/** 当前页签的配置块(pages 里的声明;单页面板为空) */
const activePageMeta = computed(() => cfg.value?.pages?.[activePage.value] || null)
/** 生效网格 —— 每页各自一套列宽(2026-09-11):
 *  多页签面板允许按页声明 pages[i].grid,两张单据版式本就不同(成型工艺清单 11 列 A..K /
 *  成型配方 13 列 / 组装BOM表 4 列 130·390·130·390),共用一个网格会把其中一页的列宽挤变形。
 *  退化顺序:本页 pages[i].grid → 变体 grid → 面板 grid。页面未声明 grid 时与改造前逐字等价。 */
const effGrid = computed(() => activePageMeta.value?.grid || activeVariant.value?.grid || cfg.value?.grid || [])
/** 报告头布局:页声明可覆盖(title 跨列数等),与 grid/headMode 同一套按页退化 */
const effHead = computed(() => ({ ...(activeVariant.value?.head || cfg.value?.head || {}), ...(activePageMeta.value?.head || {}) }))
/** 生效版式:'report'(报告头)| 'plain'(标题条登记表)——同样支持按页声明(页各按原貌渲染)。
 *  退化顺序:本页 pages[i].headMode / pages[i].plain → 变体 headMode → 面板 headMode。 */
const effPlain = computed(() => {
  if (activePageMeta.value?.plain) return true
  const m = activePageMeta.value?.headMode || activeVariant.value?.headMode || cfg.value?.headMode
  return m === 'plain'
})
/** 本页是否渲染报告头。
 *  · 本页声明 showHead:true → 渲染(被并入同一张单、但原本是独立单据的那页);
 *  · 本页声明 showHead:false → 不渲染;
 *  · 未声明 → 退回历史行为「只有第 1 页有报告头」(规格书封面、各单页面板都靠这条保持原样零影响)。
 *  只有「成型配方 / 组装BOM表」两页需要「非首页也有自己的报告头」,按页声明即可,不必猜。 */
const showReportHead = computed(() => {
  const m = activePageMeta.value
  if (m && m.showHead === true) return true
  if (m && m.showHead === false) return false
  return activePage.value === 0
})
const nCols = computed(() => effGrid.value.length)
/** 网格总宽:所有表格显式用这个宽度,列分界线全页严格一致(数据表编辑态另加 60px 操作列) */
const gridW = computed(() => effGrid.value.reduce((s, w) => s + w, 0))
/** 报告头左侧公司名(7 张数据记录表 + 其它文书面板的纸面首行文字,逐张一致;尾随空格不计) */
const COMPANY_NAME = '惠州市银嘉环保科技有限公司'
/** 报告头第 1 行「公司名格 | 编号格」的分列 —— 优先按**设计原表的 !merges**显式切分:
 *    head.noSpan     编号格占末尾几列(碱性设计 N2=1 列、压降 L2=1 列…);
 *                    **0 = 编号与公司名同一格**(阻垢性能 A1:J1、浸泡安全 B2:G2 —— 一格含两段文字);
 *    head.noGapSpan  设计里没并进公司名/编号任一格的空列数(RO保护 J2、压降 K2 在两格之间;
 *                    阻垢性能 K1 在同格版式的右侧)—— 并进任何一格都会把竖线挪到设计之外的位置;
 *    head.docnoPrefix 编号前是否渲染「编号：」标识 —— 逐张核对过设计的面板(7 张数据记录表)
 *                    设计原值都是**裸编号**,故它们显式写 false;**未写 = 保留原有「编号：」标识**
 *                    (改造前是 23 个面板统一带标识,没核过设计的面板不该被顺手改掉纸面观感)。
 *  不写 head.noSpan = 退回下面的动态算法(未按设计逐张核对的面板维持原样,零影响)。 */
const sameCellDocno = computed(() => effHead.value.noSpan === 0)
const noGapSpan = computed(() => Math.max(0, Math.floor(Number(effHead.value.noGapSpan) || 0)))
const gapLeftSpan = computed(() => (sameCellDocno.value ? 0 : noGapSpan.value))
const gapRightSpan = computed(() => (sameCellDocno.value ? noGapSpan.value : 0))
const docnoPrefix = computed(() => effHead.value.docnoPrefix !== false)

/**
 * 本页纸张右上角「编号」格的**受控表单编号常量**(pages[i].docNoStatic)。
 *
 * 【为什么需要它】测试申请单的纸面右上角那一格填的是**表单编号**(内部委托 YJ-RIR001 /
 * 销售端 YJ-XS002,设计原表两侧不同),不是这张单的单据号 —— 单据号由后端「新增」自动发
 * (DT 前缀),在汇总表页与左侧选单栏出现。两种号混在一个格子里会让人以为 YJ-RIR001 可改。
 * 声明了它 ⇒ 该格渲染这段常量文本(编辑态与只读态一致),与头字段解耦。
 * 未声明 pages[i].docNoStatic 的面板逐字不变(仍按 head[docNoKey] || docNoDefault)。
 */
const docNoStatic = computed(() => String(activePageMeta.value?.docNoStatic || ''))

/** 右上角编号格占末尾几列:末尾列宽不足时向左并列凑到 ≥160px——
 *  现有最长编号 YJ-AB-SAMPLE-1 实测 98px,加参照图标/间距约 145px;
 *  只并列不改列宽,全页竖线位置不变(并掉的列整列被编号格覆盖)。
 *  ⚠ 这是**没按设计核过**的面板(未声明 head.noSpan)的兜底:它按列宽湊,凑出来的位置
 *  未必等于纸面(如碱性纸面 12/1,凑出来是 11/2)。纸面切分已核过的面板请写 head.noSpan。 */
const DOCNO_MIN_W = 160
const dynamicDocnoSpan = computed(() => {
  const g = effGrid.value || []
  if (g.length < 2) return 1
  let sum = 0
  let k = 0
  for (let i = g.length - 1; i >= 1; i--) {
    sum += g[i]
    k += 1
    if (sum >= DOCNO_MIN_W) break
  }
  return Math.min(k, g.length - 1)
})
const docnoSpan = computed(() => {
  const n = nCols.value
  // 同格版式:整格从第 1 列跨到空列之前(阻垢性能 11−1=10、浸泡安全 6−0=6)
  if (sameCellDocno.value) return Math.max(1, n - gapRightSpan.value)
  const explicit = Number(effHead.value.noSpan)
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, n - 1)
  return dynamicDocnoSpan.value
})
/** 公司名格占几列 = 总列数 − 两段留白 − 编号格(同格版式时不出公司名格 ⇒ 0) */
const companySpan = computed(() => Math.max(0, nCols.value - gapLeftSpan.value - docnoSpan.value - gapRightSpan.value))

/* ── 规格书文档式封面(设计画布 767×794,内层坐标=设计像素,由 --cok 等比缩放) ──
   几何改为按《规格书细分.xlsx》「封面（产品信息）」sheet 的**行高/列宽**折算 —— 设计像素 = 磅 × 4/3:
     列  B=71 C=92.7 D=97.3 E=97.3   ⇒ 标签列 71、值区 287.3(设计 C7:D7 合并)
     行  B5=33 B6=60 B7..B15=46 B16=40 B17=33 B18=33
   公司/编号 与标题各有自己的行高(33 / 60),字段 7 行等宽等高(46),版本 1 行,签字 2 行 —— 
   与设计逐行对应。⚠ 旧版取自设计图 PNG 的 708×1173 画布:那版封面把标签做成**流式**
   「标签：值」两端撑开(flex),标签宽度随文字长短变 ⇒ **冒号与值列参差不齐**,
   与设计的「标签列定宽 + 值列定宽」表格不是一回事(用户 2026-09-18 明确要求按本设计重排)。 */
const COVER_W = 767
const COVER_H = 794
/** 字体(设计像素):标签列与值列同号(设计正文 20.5pt) */
const COVER_LABEL_FONT = 27.3
const COVER_CELL_PAD = 6
/**
 * 列宽**交给浏览器按内容算**(标签/值都 nowrap + table-layout:auto)。
 *
 * 为什么不再手算像素:第一版按「最长标签字数 × 字号 + 内边距」算标签列,给到 178px,
 * 而「客户项目名称」6 字 @27.3px 理论需 175.8px —— **只有 2px 余量**。
 * 真实字体渲染宽度略大于 1em(宋体常见 ~1.05em),且 `table-layout:fixed` 下单元格
 * **不会因内容变宽**,于是 nowrap 的文字直接溢出压到右侧值格上 = 用户看到的**字段重叠**。
 * ⇒ 正解是让浏览器测量(nowrap 撑开单元格),不再猜像素;
 *   同一份 cover.fields,所有行的标签列自然等宽 ⇒ 值列左边界仍然逐行对齐。
 * 仅保留内边距作为"最小留白"。
 */
/** ── 封面竖向分段(设计像素)──
 *  四段**必须首尾相接、互不重叠**,不能共带:
 *    ① 公司名行   y 25..58   (设计 B5,33px)
 *    ② 大标题行   y 58..106  (设计 B6 带;高 48 由 ①③ 反推 —— 见下)
 *    ③ 字段表     y 106 起   (设计 B7..B15,9 行 × 46 = 到 520)
 *    ④ 签字栏     y 605 起   (设计 B17/B18,2 行 × 33 = 到 671)
 *
 *  ⚠ 2026-09-18 连踩两次,记下来别再犯:
 *    · 第一次:公司名与标题**都放 top:25 / 高 33** ⇒ 同一带。公司名占 x44..313、
 *      居中标题(3 字 × 47.3 = 186px)占 x268..499,**水平重叠 45px** ⇒
 *      标题压住公司名末尾的「司」(用户报「产品规格书压到公司名」)。
 *    · 第二次:把标题下移后**凭感觉**给了 60px 高 ⇒ 标题带 52..112 又同时压住
 *      公司名(底 58)与字段表(顶 106),各溢出 6px。
 *    ⇒ 正解是**把 4 段当分区算,首尾相接**:标题带高 = 106 − 58 = 48,不手填。
 *      断言见 tools/archive/_probe-spec-cover.cjs(四段两两不重叠、且不留空档)。 */
const COVER_COMPANY_TOP = 25
const COVER_COMPANY_H = 33
/** 标题带起点 = 公司带终点(相接,不留缝不重叠) */
const COVER_TITLE_TOP = COVER_COMPANY_TOP + COVER_COMPANY_H
/** 字段表顶(设计 B7 起点),也是标题带终点 */
const COVER_GRID_TOP = 106
/** 标题带高 = 字段表顶 − 标题带起点(由分区反推,不凭感觉填) */
const COVER_TITLE_H = COVER_GRID_TOP - COVER_TITLE_TOP
/** 封面字段表**行数**(签字栏间距按它算)。
 *  2026-09-30 由 9 改 8:原第一行「编  号」曾移到封面右上角编号格。
 *  🔴 **2026-10-28 由 8 改回 9**:产品编号按用户口径①移进字段表(与产品类别同款大表格),
 *     右上角那格改显示**自动单据编号** —— 两者各占一格,不再是同一件事。
 *  ⚠ 改这个数就够,不用动 COVER_GRID_TOP/COVER_SIGN_TOP —— 字段表仍从设计 B7 的 y 起排,
 *    行数变化由签字栏 margin-top 自动吸收(见模板里那句 marginTop 注释)。 */
const COVER_ROWS = 9
/** 字段表行高(设计 B7..B15 等距 46px) */
const COVER_ROW_H = 46
/** 签字栏顶(设计 B17);三栏列宽按设计 B17..D17 比例 92.7:97.3:97.3 */
const COVER_SIGN_TOP = 605
const coverK = computed(() => gridW.value / COVER_W)
/** 封面高度 = 真实 A4(210×297mm):设计画布 1173/708≈1.657 比 A4(1.414)长,按画布高等比
 *  会在打印时溢出到第二页;纵向位置/行高用独立缩放 coverVy 压入 A4 高度,横向(字号/列宽)仍用 coverK
 *  −cfg.coverTailReserve:与封面**同页**、渲染在封面之下那块的预留高度。
 *   2026-09-30 规格书第 0 页的下挂三行章节块已按用户要求删除 ⇒ 该值改为 0,整页给封面;
 *   若日后又在封面下加内容,必须把预留加回来(否则那块会被挤到第二页)。 */
const coverPageH = computed(() => Math.round(gridW.value * (297 / 210)) - (cfg.value?.coverTailReserve || 0))
const coverVy = computed(() => coverPageH.value / COVER_H)
/** 封面右上角「编号」格绑哪个数据键(面板声明 cfg.coverDocNoKey;未声明的封面面板不渲染该格)。
 *  ⚠ 必须是**字段名**(如「产品编号」),不能是引擎的**单据标识键**「编号」——
 *    后者会被 QueryService.loadDocs 的单据号覆盖(见 recordSheetConfigs.js 的封面注释)。 */
const coverDocNoKey = computed(() => String(cfg.value?.coverDocNoKey || ''))
/**
 * 封面右上角编号格的**标识文案**(带冒号,直接喂 tt())。
 * 2026-10-28 用户口径②:该格从「产品编号」改绑「单据编号」⇒ 文案跟着换,
 * 否则会印着「产品编号：SD-2026-10-0001」这种张冠李戴的字。
 * 未声明的封面面板不渲染该格,回落到「编号：」只为兜底。
 */
const coverDocNoLabel = computed(() => {
  const k = coverDocNoKey.value
  if (k === '单据编号') return '单据编号：'
  if (k === '产品编号') return '产品编号：'
  return '编号：'
})
/** 字段行顶部(设计 px):等宽等高,由行号推出(不再手写坐标表 —— 加行不用改这里) */
function coverLineTop(i) {
  return ((COVER_GRID_TOP + i * COVER_ROW_H) * coverVy.value).toFixed(1) + 'px'
}
/**
 * 封面只读值的字号档位(2026-10-15 引入,**2026-10-21 停用**)。
 *
 * 原委:当时值列是 nowrap + table-layout:auto,长文本会把整张字段表横向顶宽出画布,
 * 画布 overflow:hidden 直接切掉,所以只能逐档降字号把内容压进一行。
 *
 * 停用原因(用户 2026-10-21 口径:「宽度固定下来,数据太长就直接换行」):
 * 现在表已改成 table-layout:fixed + 值列固定 76% 宽 + 格内换行 ⇒ 长文本不再撑宽,
 * 也就不必把字压到 9.5px(那样反而看不清)。行高由 CSS 表格的 height 下限自动增长,
 * 签字栏在文档流里跟着下移,不会被盖住。
 *
 * 函数保留为「恒返回空串」而不是直接删掉,是为了让历史调用点/外部引用不炸;
 * 模板里的类名绑定已一并去掉,所以实际没有任何视觉效果。
 */
function coverValClass() {
  return ''
}
/** 签字栏三栏:与字段表**同宽同居中**(两表共用 CSS 的居中规则 + var(--coverw) 宽度),
 *  故左/右边界天然对齐。三栏之间按设计 B17..D17 的比例 92.7:97.3:97.3 分配(百分比)。 */
const COVER_SIGN_COLS = [92.7, 97.3, 97.3]
const coverSignW = COVER_SIGN_COLS.map((w, _i, arr) => {
  const sum = arr.reduce((a, b) => a + b, 0)
  return ((w / sum) * 100).toFixed(2) + '%'
})

/** 报告头右侧信息块(数据记录表=密级/适用范围/测试负责人/报告编号/**审核人**;
 *  委托单=文件管理人/密级/文件使用范围)。
 *  ⚠ 2026-09-30 加「审核人」:需求《产品开发系统需求汇总.xlsx》sheet「数据记录表」第 1 条
 *    ——「都需要审核人(秀丽)」。纸面印「审核人」,**数据键是「表单审核人」**:
 *    字段名若叫「审核人」会被 ButtonService.save() 的 `body.remove("审核人")` 静默丢弃
 *    (那是 yj_doc_status.shr 的虚拟字段),QC_INSP_REC 当年踩过同一个坑,故两处同款命名。
 *    落库列走**备用列池**的 备用1(零 DDL),见 tools/migrate-rd-datarec-reviewer-2026-09-30.sql。 */
const DEFAULT_INFO = [
  { label: '密级', key: '密级', type: 'select' },
  { label: '适用范围', key: '适用范围', type: 'select' },
  { label: '测试负责人', key: '测试负责人', type: 'text' },
  { label: '报告编号', key: '报告编号', type: 'text' },
  { label: '审核人', key: '表单审核人', type: 'text' },
]
const effInfo = computed(() => {
  // 多页签面板可按页声明 pages[i].info:被并入的页各有各的信息块(含**空数组=无信息块**,
  // 如组装BOM表原版 info:[])——页声明优先,未声明才退面板级,再退默认四件套。
  // 修复:BOM 页未声明时误回退默认信息块,大标题被挤进第一列(130px)错位。
  const m = activePageMeta.value
  if (m && m.info !== undefined) return m.info
  const info = cfg.value?.info
  if (info === undefined) return DEFAULT_INFO
  return info
})
const infoSpan = computed(() => effInfo.value.length)

/** 报告头大标题:静态/前缀+头字段派生(规格书=产品规格书·名称,委托单=类型+'-测试申请单'),否则为 测试主题 输入。
 *  多页签面板可按页声明 pages[i].staticTitle —— 被并入同一张单的两页本是**两张单据**,
 *  各有各的标题(如 炭棒工艺管控清单 / 炭棒配方管控清单),不能共用一个 staticTitle。 */
const effStaticTitle = computed(() => activePageMeta.value?.staticTitle || cfg.value?.staticTitle || null)
const derivedTitle = computed(() => {
  if (effStaticTitle.value) return effStaticTitle.value
  if (cfg.value?.titleFromKey) {
    const v = props.head?.[cfg.value.titleFromKey] || cfg.value.titlePlaceholder || ''
    if (v || !cfg.value.titlePlaceholder) return (cfg.value.titlePrefix || '') + v + (cfg.value.titleSuffix || '')
  }
  return null
})

// ── 多页结构(规格书 / 成型工艺清单+成型配方 / 组装工艺清单+组装BOM表):页签切换,各区块按 page 归属渲染 ──
// (activePage 本体在文件上方声明,effGrid/effPlain 依赖它)
const pageList = computed(() => cfg.value?.pages || [])
function pageOf(block) {
  return block.page ?? 0
}
/**
 * 「字段编辑」按钮挂在哪张数据表上。
 * 原写法写死 `di === 0`,但第 0 张表未必有 bar 行 —— 用 pageTitle 出居中大标题的表
 * (规格书修订记录页、组装工艺清单的修订记录页)整行 `<tr v-if="dt.bar && !dt.pageTitle">` 都不渲染,
 * 按钮就跟着一起消失,整张单再也进不去字段编辑。改成挂在**第一张真的会画 bar 行的表**上。
 */
const fieldEditAt = computed(() => {
  const dts = cfg.value?.dataTables || []
  const i = dts.findIndex((d) => d.bar && !d.pageTitle)
  return i < 0 ? 0 : i
})

/**
 * 本节是否属于「数据表锚点之前(含锚点)」那一段 —— 用于把章节拆成表前/表后两段渲染。
 *
 * 为什么需要:模板里数据表是**另起一段**渲染在 sections 之后的,单靠顺序挪不动它,
 * 而设计第 4 页要求物料表夹在「1.关键物料列表」与「2.炭棒处理要求」之间。
 * 于是把章节拆两段:循环 A(true)+ 数据表 + 循环 B(false),表自然落在锚点节之后。
 * 锚点 = 某张表的 tablesAfterBar 等于某节的 bar(同页)。
 * 无任何锚点的面板 ⇒ 恒 true ⇒ 循环 B 为空、表仍排在所有章节之后 = 原行为不变。
 */
function isAtOrBeforeTableAnchor(sec) {
  const c = cfg.value || {}
  const anchored = (c.dataTables || []).filter((d) => d.tablesAfterBar)
  if (!anchored.length) return true
  const samePage = (c.sections || []).filter((s) => pageOf(s) === pageOf(sec))
  let lastAnchor = -1
  samePage.forEach((s, i) => {
    if (anchored.some((d) => d.tablesAfterBar === s.bar && pageOf(d) === pageOf(s))) lastAnchor = i
  })
  if (lastAnchor < 0) return true
  return samePage.indexOf(sec) <= lastAnchor
}

/**
 * 本节标题行要挂「从物料清单引用」按钮吗(2026-09-20;2026-10-13 随 WLBOM 数据源恢复)。
 * 判据:本节的 bar 是某张 dataTable 的 tablesAfterBar 锚点,且那张表声明了 materialPick
 * 且**它自己没有 bar 行** —— 有 bar 的按钮已经渲染在表格的 bar 行上,别挂两处。
 * 为什么需要:规格书第 4 页「1.关键物料列表」的表故意没有 bar(标题由本节出,加了会重复标题),
 * 原先按钮只认 dt.bar ⇒ 那张表上配了 materialPick 也永远渲染不出来(用户报「加上这个功能」即此)。
 */
function materialPickAt(sec) {
  const c = cfg.value || {}
  if (!sec || !sec.bar) return null
  return (c.dataTables || []).find((d) =>
    d.materialPick && !d.bar && d.tablesAfterBar === sec.bar && pageOf(d) === pageOf(sec)) || null
}

/**
 * 「从…引用」按钮的**文案** —— 由表的 `materialPickLabel` 决定,缺省仍是「从商品引用」。
 *
 * 为什么可配:同一个取数机制(商品档案 INV)在不同单据上的业务说法不一样 ——
 *   规格书第 4 页叫「从商品引用」;
 *   产品信息表新版「三、产品BOM表」设计要求写「直接导入采购物料清单」(2026-10-29 设计图右侧批注)。
 * 只改纸面上的字,不动取数源、不动落点映射。
 */
function materialPickLabelOf(sec) {
  const dt = materialPickAt(sec)
  return (dt && dt.materialPickLabel) || '从商品引用'
}
/** 弹窗标题跟随按钮文案(同一张表的按钮叫「直接导入采购物料清单」,弹窗标题却写「从商品引用」会很割裂) */
const matPickTitle = computed(() => {
  const dt = matPickTargetDt.value
  return (dt && dt.materialPickLabel) || '从商品引用'
})

watch(() => props.panelCode, () => { activePage.value = 0; loadStdLibs() }, { immediate: true })

// ── 表尾静态表(cfg.tailTables)与只读台账页(pages[i].ledger) ──
/** 本页要渲染的静态附表(设计纸面上的固定附录;不落库、不进单据) */
const tailTablesOfPage = computed(() => (cfg.value?.tailTables || []).filter((t) => pageOf(t) === activePage.value))
/** 静态附表自己的宽度 = 各列宽之和(设计里它比整页窄,故不铺满网格,由 .rs-tail-table 居中) */
function tailTableW(t) {
  return (t.cols || []).reduce((s, c) => s + (c.w || 120), 0)
}

/** 当前页的台账配置(pages[i].ledger);无则整块不渲染 */
const ledgerCfg = computed(() => activePageMeta.value?.ledger || null)
const ledgerW = computed(() => (ledgerCfg.value?.cols || []).reduce((s, c) => s + (c.w || 120), 0))
const ledgerRows = ref([])
const ledgerLoading = ref(false)

/**
 * 台账取数:走面板自身列表接口(与左侧「单据选择」栏 / 列表页同一份真源),
 * 一次取 pageSize 条表头摘要(默认 200;后端本接口不限 pageSize,见 PxController.queryFormDataList)。
 * ⚠ request 的响应拦截器已解一层 ⇒ res 是 ApiResult,数据在 res.data。
 */
async function loadLedger() {
  const lg = ledgerCfg.value
  if (!lg) return
  ledgerLoading.value = true
  try {
    const res = await request.post('/px/queryFormDataList', {
      panelCode: props.panelCode,
      condition: {},
      pageNo: 1,
      pageSize: lg.pageSize || 200,
    })
    const data = res?.data || res || {}
    ledgerRows.value = Array.isArray(data.list) ? data.list : []
  } catch {
    ledgerRows.value = [] // 取数失败只留空表(台账是只读附属视图,不该挡住单据本身)
  } finally {
    ledgerLoading.value = false
  }
}

/**
 * 台账某一格的显示值 —— 规则见 core/panel/ledgerCols.js(纯函数,单测直接钉住:
 * seq 行号 / keys 按序回退 / map 显示映射 / 取不到即空串)。
 */
const ledgerCell = ledgerCellOf

// 台账只在「切到台账页 / 换面板 / 换单(载入或保存后单据号变化)」时重取 —— 不跟随每一下击键
watch(
  [activePage, () => props.panelCode, () => props.head?.['单据编号'], () => props.head?.['编号']],
  () => {
    if (ledgerCfg.value) loadLedger()
    else ledgerRows.value = []
  },
)

// ── 复选格(变更申请单):顿号分隔文本 ⇄ 勾选态 ──
/**
 * 文本 → 勾选项数组(顿号/逗号/分号/空格都当分隔符;空值=没勾)。
 * 与后端 ButtonService/changeHead 的判定同一口径(后端用的是 contains,故顺序无关)。
 */
function checkList(v) {
  return String(v ?? '').split(/[、,，;；\s]+/).map((s) => s.trim()).filter(Boolean)
}

/**
 * 勾选的文件 → 跳转入口(2026-10-19 用户口径:「勾选哪些面板,保存审批之后就会根据选择的
 *  产品编号出现对应的文件跳转入口」)。
 *
 * 做法:只读态点某个已勾选项 → 用本单「产品编号」去该面板查单据(doc 面板列表行自带单据编号)
 *   → emit('open-file') 交给 PanelxList 开页签(带 ?docNo= 定位到那张单)。
 *   **查不到就说不查不到**,不跳一张空列表让用户自己找。
 *   面板映射来自 recordSheetConfigs 里该格的 `link`(见 RD_CHANGE 的「变更文件」)。
 */
async function openLinkedFile(c, label) {
  const panel = c && c.link ? c.link[label] : ''
  if (!panel) return
  // ⚠ 2026-10-27:成型工艺清单的 产品编号 带 -tb 后缀(见 core/panel/productCodeSuffix.js),
  //   而**下游单据存的是原始编号** ⇒ 反查前必须剥掉后缀,否则永远匹配不到(表现为"该产品还没有该文件")。
  const prodNo = rawProductCode(props.head['产品编号'])
  if (!prodNo) {
    ElMessage.warning(tt('本单还没有产品编号，无法定位对应的文件'))
    return
  }
  try {
    const res = await request.post('/px/queryFormDataList', {
      panelCode: panel, condition: { 产品编号: prodNo }, pageNo: 1, pageSize: 5,
    })
    const list = (res && res.data && res.data.list) || []
    const no = list.length
      ? String(list[0]['单据编号'] || list[0]['编号'] || list[0]['文档编号'] || '')
      : ''
    if (!no) {
      ElMessage.warning(tt('该产品还没有「{file}」，请先新建').replace('{file}', tt(label)))
      return
    }
    emit('open-file', { panel, docNo: no, label })
  } catch (e) {
    ElMessage.error(tt('打开文件失败'))
  }
}

/** 勾选态 → 文本(顿号分隔;不勾就写空串 —— 注意本引擎"空串=不改动",要清空得靠后端还原口径) */
function toggleCheck(key, opt, single) {
  const cur = checkList(props.head?.[key])
  let next
  if (single) next = cur.includes(opt) ? [] : [opt]
  else next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]
  props.head[key] = next.join('、')
  emit('dirty')
}

// ── 行级编辑门禁(变更申请单「部门评审意见」)──
/**
 * 某张明细表的某一行该不该锁:dt.lockKey 声明"按哪一列判部门"(如 '部门')时,
 * 只有 props.myDeptRows(服务端按账号部门算出来的可填部门行)里的行才可编;
 * 管理员(deptLockAll)豁免;声明了 dt.lockCols 时只有这些列可编(表区/部门/签字/日期 一律不可编)。
 * ⚠ 只影响界面:服务端 ButtonService.gateChangeDetail 另有强制还原,双保险。
 */
function rowLocked(dt, row) {
  if (!dt || !dt.lockKey) return false
  if (props.deptLockAll) return false
  return !props.myDeptRows.includes(String(row?.[dt.lockKey] ?? '').trim())
}

/** 单元格可否编辑:表可编 + 行不属于锁 + (声明了 lockCols 时)列在放行清单里 */
function cellEditable(dt, row, c) {
  if (!props.editable) return false
  if (rowLocked(dt, row)) return false
  if (dt.lockCols && !dt.lockCols.includes(c.key)) return false
  return true
}

/** 该格是否"因为不是本部门"被锁(给个灰底 + tooltip,免得用户以为坏了) */
function isLockedCell(dt, row, c) {
  return props.editable && rowLocked(dt, row) && !(dt.lockCols && !dt.lockCols.includes(c.key))
}

// ── 校验定位(供 PanelxList 保存校验调用):翻到字段所在页 + 滚动 + 高亮 ──
/**
 * 校验失败时被点名的**字段数据键**(= yj_field.label,中文);模板据此给该格打 rs-focus。
 * 空串 = 无高亮。注意是**键**不是纸面文案:同名字段两者可能不同(版  本 / 物料名),
 * 用文案去比模板里的 key 会全落空 —— 这正是 2026-10-13 这次改造的核心。
 */
const focusKey = ref('')
/** 定位查询只在本组件内做(document 里可能同时存在别的文书面板实例,查全局会闪错格子) */
const rootEl = ref(null)
/**
 * 高亮自动熄灭的定时器(模块级:重复调用先 clear,避免多次校验叠出一堆定时器)。
 * clearFocusOf 记住"上一次那处高亮属于哪个实例"—— 同一页面可能同时挂着两个文书面板
 * (PanelxList 的主表单 + 单据选择栏),被新一次定位抢占时要把上一处的高亮清掉,
 * 否则上个实例的 focusKey 会永久留着(它的定时器已被 clear)。
 */
let focusTimer = null
let clearFocusOf = null
/** 该数据键此刻是否是高亮目标(模板绑定用) */
function isFocus(key) { return !!key && focusKey.value === String(key) }
/** 键值对行的标签格:整对里任意一格(key 或 cells 的某一格)命中即高亮标签 */
function isPairFocus(pair) {
  if (!pair) return false
  return isFocus(pair.key) || (pair.cells || []).some((c) => isFocus(c.key))
}

/** 数据键 → 所在页签页码(找不到 -1);判据见 recordSheetFocus.js(单向真源,带单测) */
function pageOfKey(key) { return pageOfKeyIn(cfg.value, key) }
/** 纸面文案 → 所在页签页码(找不到 null);仅供只拿得到 message 文案的旧路径兼容 */
function pageOfLabel(label) { return pageOfLabelIn(cfg.value, label) }

/**
 * 滚动到高亮格;配置里没有可高亮的格子时,回退按纸面文案找标签格闪一下(旧行为,别丢)。
 * v-show 隐藏的其它页签也在 DOM 里,故只在**可见**元素里找。
 */
function scrollToFocus() {
  const root = rootEl.value
  if (!root) return
  const visible = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length)
  const hit = [...root.querySelectorAll('.rs-focus')].filter(visible)[0]
  if (hit) {
    hit.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  const label = focusKey.value
  const all = [...root.querySelectorAll('td.rs-label, td.rsp-cover-lb, .rsp-cover-lb, td.rs-td, th')].filter(visible)
  const el = all.find((e) => (e.textContent || '').trim() === label)
    || [...root.querySelectorAll('td.rs-label, td.rsp-cover-lb, .rsp-cover-lb')].filter(visible)
      .find((e) => (e.textContent || '').includes(label))
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('field-blink')
    setTimeout(() => el.classList.remove('field-blink'), 3200)
  }
}

/**
 * 翻页 + 定位高亮该字段(约 3 秒后自动熄灭);返回是否定位成功。
 * 入参优先按**数据键**解析(与模板绑定同一判据),键找不到页时回退按纸面文案找页。
 * 定位失败(该字段在纸面配置里根本没渲染)返回 false —— 调用方不得据此改变校验/保存行为。
 */
async function focusField(key) {
  const name = String(key ?? '').trim()
  if (!name) return false
  let target = pageOfKey(name)
  if (target < 0) target = pageOfLabel(name)
  if (target === null || target < 0) return false
  // 抢占上一次定位:清掉它的定时器与高亮(可能是另一个组件实例的高亮)
  if (focusTimer) { clearTimeout(focusTimer); focusTimer = null }
  clearFocusOf?.()
  if (pageList.value.length) activePage.value = target
  focusKey.value = name
  clearFocusOf = () => { focusKey.value = '' }
  await nextTick()
  scrollToFocus()
  focusTimer = setTimeout(() => { focusKey.value = ''; focusTimer = null; clearFocusOf = null }, 3000)
  return true
}
defineExpose({
  focusField,
  pageOfKey,
  // 多页导出用(2026-10-28):整份文书导出「所有页面」时,由 PanelxList 逐页切页签再截图。
  //   pageCount  = 本面板页签数(单页 = 1);
  //   pageTitles = 页签标题(仅诊断用);
  //   activePage / setActivePage = 读当前页 / 切到第 i 页(0 基)。
  pageCount: computed(() => Math.max(1, pageList.value.length)),
  pageTitles: computed(() => pageList.value.map((p) => String(p?.title || ''))),
  activePage,
  setActivePage: (i) => { activePage.value = Math.max(0, Math.min(pageList.value.length - 1, Number(i) || 0)) },
})

/** plain 版式表格列宽与总宽(无全页网格,列宽取 col.w) */
function plainCols(dt) {
  return colsOf(dt)
}
/** plain 版式标题条文字:多页签面板配数组(按 activePage 取,缺省回退第 0 个),单页面板配字符串。
 *  变体可各自声明 plainTitle(组装工艺清单 4 个变体:裸棒/机器包布/复合半成品/成品 各有各的设计标题),
 *  优先级:变体 > 面板(数组/pages 归一后仍是面板级)。 */
const plainTitleOf = computed(() => {
  const v = activeVariant.value?.plainTitle
  if (v) return v
  const t = cfg.value?.plainTitle
  if (Array.isArray(t)) return t[activePage.value] ?? t[0] ?? ''
  return t || ''
})
function plainW(dt) {
  // 本页声明了自己的网格时以网格总宽为准(组装BOM表页:物料清单/修订记录按 130·390·130·390 铺满纸张);
  // 未声明网格的 plain 面板(实验室各表、组装工艺清单页)仍按列宽之和,与改造前一致。
  if (activePageMeta.value?.grid) return gridW.value
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
  const flat = Array.isArray(lib)
  // ── 第三态:组装工艺 4 变体库(lib='asm.proc')──────────────────────────────
  // 一变体一条目(item_code=变体名),content={v:1,rows:[{工序,工序控制内容,管控要求,检查比例}]}。
  // 与另两态的区别:**勾选即"整表替换"**(选中一个变体,把该表区的行换成它的 rows),
  // 而不是"逐条追加到已有行"。种子见 tools/gen/gen-asm-proc-lib.cjs。
  if (lib === 'asm.proc') {
    const res = await request.get('/stdlib/list', { params: { lib: 'asm.proc', all: 1 } }).catch(() => null)
    const rows = (res?.data || []).map((r) => {
      let parsed = null
      try { parsed = JSON.parse(r.content) } catch { parsed = null }
      const list = Array.isArray(parsed?.rows) ? parsed.rows : []
      return { item: r.item, name: r.item, rows: list, n: list.length, seq: r.seq, dbId: r.id, off: Number(r.enabled) === 0 }
    })
    // ⚠ StdLibController.list 的 SQL 是 `ORDER BY item_code, seq, id` ⇒ 单条 item_code 时退回**字母序**,
    //   设计 sheet 的业务序(裸棒→机器包布→复合半成品→成品)会丢。按 seq 在前端重排(seq 已随响应下发)。
    rows.sort((a, b) => (Number(a.seq ?? 9999) - Number(b.seq ?? 9999)) || String(a.item).localeCompare(String(b.item)))
    // 兜底:库里一条都没有(未跑种子的环境)⇒ 用内置常量(无 dbId ⇒ 不可维护,跑种子后即全量可维护)
    libRows.value = rows.length
      ? rows.filter((r) => r.rows.length)
      : [{ item: '(内置)', name: '(内置)', rows: JSON.parse(JSON.stringify(dt.seedRows || [])), n: (dt.seedRows || []).length, dbId: null, off: false }]
    libChecked.value = []
    resetLibEdit()
    libVisible.value = true
    return
  }
  if (flat || cfg.value?.testLib) {
    // 检验项目标准库 = yj_std_lib **唯一真源**(内置 26 组/48 子项+必测/型式种子见
    // tools/gen/gen-testlib-seed.cjs;**两个面板各用各的库,互不相通**:规格书(分组形态)读写
    // spec.test,出货检验计划表(扁平形态)读写 insp.plan 且只取本表区(item_code)的条目)。
    // all=1 连停用条目一起取回:停用条目灰显划线、不可勾选、可「恢复启用」——
    // 与 StdLibManager 同款维护能力(编辑/停用/恢复启用),改库不污染已录入单据。
    const res = await request.get('/stdlib/list', {
      // insp.plan **整库取回**(不传 item):单表形态下必测项/型式检验同表,两边都能挑;
      //   分组名由条目正文的 group 承载,落明细时写回 libGroupKey 那一列(见 flatGroupOf/confirmLib)。
      //   旧版这里传 dt.filterVal 按表区过滤 —— 现行设计没有表区,传空串会退化成"整库"但也可能被
      //   将来加回的过滤语义误伤,索性不传。
      // spec.test 同样整库取回,组名由正文 group 承载。
      params: flat ? { lib: 'insp.plan', all: 1 } : { lib: 'spec.test', all: 1 },
    }).catch(() => null)
    const rows = res?.data || []
    if (rows.length) {
      if (flat) {
        // 出货检验计划表(扁平):规范结构 → 固定的 10 个中文键,一一对列名。
        // 分组名(必测项/型式检验)**不在**这 10 个键里(它是 item_code,不是明细字段),
        // 由 __entry.group 承载 ⇒ 勾选落明细时靠 flatGroupOf() 取回,写进 libGroupKey 那列。
        // __entry 挂原规范结构:平表表单只有 7 个字段,编辑保存时以 __entry 打底,
        // 否则条目里不合格应对措施/取样方式等本表单没有的列会被空串覆盖(丢数据);
        // confirmLib 落明细前会重新投影成 10 键,__entry 不会进单据。
        libRows.value = rows.map((r) => {
          const e = toCanonical(r.content, r.item)
          return { ...toInspRow(e), __entry: e, dbId: r.id, off: Number(r.enabled) === 0 }
        })
      } else {
        // 规格书(分组):组名取自规范结构的 group(旧 item_code 兜底);组序沿用内置常量的
        // 既有顺序(Excel 业务序),库里的新组缀后;停用条目同入组(off:checkbox 禁用+划线+可恢复)。
        const order = (cfg.value.testLib || []).map((g) => g.name)
        const groups = []
        const grpOf = (name) => {
          let g = groups.find((x) => x.name === name)
          if (!g) { g = { name, subs: [] }; groups.push(g) }
          return g
        }
        for (const r of rows) {
          const e = toCanonical(r.content, r.item)
          grpOf(e.group || r.item).subs.push({ ...toSpecSub(e), __entry: e, dbId: r.id, off: Number(r.enabled) === 0 })
        }
        groups.sort((a, b) => {
          const ia = order.indexOf(a.name); const ib = order.indexOf(b.name)
          return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib)
        })
        libRows.value = groups
      }
    } else {
      // 兜底:库里一条都没有(未跑种子的环境)才用内置常量展示(无 dbId → 不可编辑/停用,跑种子后即全量可维护)
      libRows.value = flat ? [...lib] : JSON.parse(JSON.stringify(cfg.value.testLib))
    }
  } else {
    libRows.value = []
  }
  libChecked.value = []
  resetLibEdit()
  libVisible.value = true
}
/** 分组标准库勾选(键=组下标:子项下标);扁平表格走 el-table selection-change */
function toggleLib(key, on) {
  const i = libChecked.value.indexOf(key)
  if (on && i < 0) libChecked.value = [...libChecked.value, key]
  else if (!on && i >= 0) libChecked.value = libChecked.value.filter((k) => k !== key)
}
/** 标准库弹窗标题:三种库各自说明用途(原来固定写「检验项目标准库」,对组装工艺变体库是误导) */
const libDialogTitle = computed(() => {
  const lib = libTargetDt.value?.lib
  if (lib === 'asm.proc') return '关键控制清单标准库'
  if (Array.isArray(lib)) return '检验项目标准库'
  return '检验项目标准库'
})
const libTargetDt = ref(null)
// ── 勾选 → 编辑 → 表单带入 → 保存修改(POST /stdlib/update) ──
// 两种形态各有一套表单,分别记一个"正在编辑的条目 id":非 null 即处于「保存修改」态。
// 条目全部来自 yj_std_lib(内置已种子入库)→ 有 dbId 一律可编辑;
// 仅"未跑种子环境的内置常量兜底"行没有 dbId,不可维护。
const libCEditId = ref(null) // 分组形态(规格书):子项表单
const libCEditEntry = ref(null) // 正在编辑条目的规范结构(保存时打底,含表单没有的字段)
const libCGroup = ref('')
const libCSub = ref('')
const libCReq = ref('')
const libCMethod = ref('')
const libCBasis = ref('')
const libFEditId = ref(null) // 扁平形态(出货检验计划):平表表单
const libFEditEntry = ref(null)
// 扁平形态的分组名 = 本条目在 yj_std_lib 里的 item_code(必测项/型式检验)。
// 【为什么要单独一格】设计重排后本表是**一张表**(没有 filterKey/filterVal),
//   分组名没了现成的来源:条目列表要按它过滤、新增条目要按它落 item_code
//   (StdLibController.add 对空 item 直接 400)。条目行自己带着这个值(见 libGroupKey),
//   表单一格跟着走,编辑时从条目回填、新增时手选/手输。
const libFGroup = ref('')
/** 扁平库的分组名(item_code):表单值优先,其次回落到表区(仍用 filterVal 的旧面板) */
function flatItem() {
  return (libFGroup.value || libTargetDt.value?.filterVal || '').trim()
}
/** 「补充自定义检验项」表单里分组格的初始值:libGroupKey 的选项取第一个,取不到退回表区 */
function flatDefaultGroup() {
  const key = libTargetDt.value?.libGroupKey
  if (key) {
    const o = selectOptions(key)[0]
    if (o) return o.value
  }
  return libTargetDt.value?.filterVal || ''
}
/** 扁平库某条目的分组名(必测项/型式检验):条目正文的 group 优先(库条目挂在 __entry 上),
 *  退回行上的 libGroupKey 列(未跑种子时的内置兜底常量就是这么写的)。 */
function flatGroupOf(row) {
  return String(row?.__entry?.group || row?.[libTargetDt.value?.libGroupKey] || row?.group || '').trim()
}
const libFControl = ref('')
const libFQuality = ref('')
const libFInstrument = ref('')
const libFStandard = ref('')
const libFFrequency = ref('')
const libFContent = ref('')
const libFMethod = ref('')
/** 恰好勾选 1 条、且该条目是库里的条目(dbId;种子入库后含原内置 26 组/48 子项)才可编辑 */
function oneEditableChecked() {
  if (libChecked.value.length !== 1) return null
  const it = libChecked.value[0]
  // 变体库:弹窗里的编辑器只有"分组/扁平"两种形态,都不认 rows 结构 ⇒ 不给编辑(见 isAsmProcLib)
  if (isAsmProcLib.value) return null
  if (isGroupedLib.value) {
    const key = String(it)
    if (!/^\d+:\d+$/.test(key)) return null
    const s = libRows.value[Number(key.split(':')[0])]?.subs?.[Number(key.split(':')[1])]
    return s && s.dbId ? s : null
  }
  return it && it.dbId ? it : null
}
const canEditLibEntry = computed(() => !!oneEditableChecked())
function editLibEntry() {
  const e = oneEditableChecked()
  if (!e) {
    ElMessage.warning(tt('请先勾选一条要编辑的条目'))
    return
  }
  // 打底用的规范结构:取行上挂的原规范结构(__entry),没有再从投影值反推(老数据兜底)。
  // 注意不能写 toCanonical(JSON.stringify(row),''):它只挑规范键,custom/dbId/__entry 会被丢掉,
  // 于是「表单没显示的字段」就没人保了。
  const snap = { ...toCanonical(JSON.stringify(e), ''), ...(e.__entry || {}) }
  const c = toCanonical(snap, '')
  if (isGroupedLib.value) {
    libCGroup.value = c.group || libTargetDt.value?.filterVal || ''
    libCSub.value = c.name
    libCReq.value = c.req
    libCMethod.value = c.method
    libCBasis.value = c.basis
    libCEditId.value = e.dbId
    libCEditEntry.value = snap
  } else {
    libFControl.value = c.name
    libFQuality.value = c.quality
    libFInstrument.value = c.instrument
    libFStandard.value = c.req
    libFFrequency.value = c.freq
    libFContent.value = c.content
    libFMethod.value = c.method
    // 分组名回填:条目正文的 group(规范结构),退回表区 —— 保存时 item_code 就用它,
    // 不给则条目会被 /stdlib/update 之外的路径改名(新增才是改名点,这里是保原值)
    libFGroup.value = c.group || libTargetDt.value?.filterVal || ''
    libFEditId.value = e.dbId
    libFEditEntry.value = snap
  }
  ElMessage.info(tt('已带入表单，改完点「保存修改」'))
}
function resetLibEdit() {
  libCEditId.value = null
  libFEditId.value = null
  libCEditEntry.value = null
  libFEditEntry.value = null
  libCGroup.value = ''
  libCSub.value = ''
  libCReq.value = ''
  libCMethod.value = ''
  libCBasis.value = ''
  libFControl.value = ''
  libFQuality.value = ''
  libFInstrument.value = ''
  libFStandard.value = ''
  libFFrequency.value = ''
  libFContent.value = ''
  libFMethod.value = ''
  libFGroup.value = flatDefaultGroup()
}
function cancelEditTestLib() {
  resetLibEdit()
  ElMessage.info(tt('已取消编辑'))
}
function cancelEditFlatLib() {
  resetLibEdit()
  ElMessage.info(tt('已取消编辑'))
}
// 自定义检验项补充(存 yj_std_lib,长期可用);编辑态下改为保存修改
async function addCustomTestLib() {
  const group = libCGroup.value.trim()
  if (!group || !libCReq.value.trim()) {
    ElMessage.warning(tt('请填写检验项目与检验要求'))
    return
  }
  // 编辑时以条目原规范结构打底(子项表单没有的字段原样保留),新增时空字段留空
  const content = toContentJson({
    ...(libCEditId.value ? (libCEditEntry.value || emptyEntry()) : emptyEntry()),
    group,
    name: libCSub.value.trim(),
    req: libCReq.value.trim(),
    method: libCMethod.value.trim(),
    basis: libCBasis.value.trim(),
  })
  try {
    if (libCEditId.value) {
      await request.post('/stdlib/update', { id: libCEditId.value, content })
      ElMessage.success(tt('已保存修改'))
    } else {
      await request.post('/stdlib/add', { lib: 'spec.test', item: group, content })
      ElMessage.success(tt('已存入标准库'))
    }
    resetLibEdit()
    await openLib(libTargetDt.value)
  } catch (e) {
    ElMessage.error(tt('保存失败'))
  }
}
/** 停用条目(✕,软删可恢复):与 StdLibManager 同款;只影响以后的勾选候选,已录入单据不变 */
async function stopLibRow(dbId) {
  if (!dbId) return
  try {
    await request.post('/stdlib/remove', { id: dbId })
    ElMessage.success(tt('已停用该条目'))
    await openLib(libTargetDt.value)
  } catch (e) {
    ElMessage.error(tt('操作失败'))
  }
}
/** 恢复启用停用条目(↩) */
async function enableLibRow(dbId) {
  if (!dbId) return
  try {
    await request.post('/stdlib/enable', { id: dbId })
    ElMessage.success(tt('已恢复启用'))
    await openLib(libTargetDt.value)
  } catch (e) {
    ElMessage.error(tt('操作失败'))
  }
}
/** 彻底删除条目(🗑 物理删,与「停用」相对):确认后不可恢复;已录入单据存的是内容文本,不受影响 */
async function destroyLibRow(dbId) {
  if (!dbId) return
  try {
    await ElMessageBox.confirm(tt('彻底删除该条目？不可恢复，已录入单据不受影响。'), tt('彻底删除'),
      { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') })
  } catch { return /* 取消 */ }
  try {
    await request.post('/stdlib/destroy', { id: dbId })
    ElMessage.success(tt('已彻底删除'))
    await openLib(libTargetDt.value)
  } catch (e) {
    ElMessage.error(tt('删除失败'))
  }
}

// ── 出货检验计划:自定义补充(扁平结构) ──
const isGroupedLib = computed(() => libRows.value.length > 0 && Array.isArray(libRows.value[0]?.subs))
const hasDbFlat = computed(() => libRows.value.some((r) => r.dbId))
/**
 * 组装工艺 4 变体库(第三态)。
 *
 * ⚠ 这一态**既不是**分组库(spec.test,行上有 subs)**也不是**扁平库(insp.plan)——
 *   它的条目正文是 `{v:1,rows:[{工序,工序控制内容,管控要求,检查比例}]}`。
 *   两处必须按它排除,否则会套用扁平库那套 7 个字段(控制项目/质量控制内容/…):
 *     ① 弹窗里会多出一整块「补充自定义检验项」表单 —— 字段名与本库毫不相干,
 *        点「存入标准库」还会把条目写进 **insp.plan**;
 *     ② 「编辑」会把该行喂给扁平编辑器(扁平键在变体条目上全取不到 ⇒ 显示空表单),
 *        再点「保存修改」就 POST /stdlib/update **用扁平 content 覆盖掉变体的 rows** ——
 *        整套工序没了。所以下面 oneEditableChecked() 对该库直接返回 null(编辑按钮置灰),
 *        条目的增删改走「标准库维护」(StdLibManager,它把正文当字符串原样往返)。
 */
const isAsmProcLib = computed(() => libTargetDt.value?.lib === 'asm.proc')
/** 平表表单 → 规范结构:编辑时以条目原规范结构打底(保住列上没显示的字段),新增时空字段留空 */
function flatContent() {
  return toContentJson({
    ...(libFEditId.value ? (libFEditEntry.value || emptyEntry()) : emptyEntry()),
    // 组名 = 该条目在库里的 item_code(必测项/型式检验);检验固定 IQC
    group: flatItem(),
    name: libFControl.value.trim(),
    quality: libFQuality.value.trim(),
    instrument: libFInstrument.value.trim(),
    req: libFStandard.value.trim(),
    inspect: 'IQC',
    freq: libFFrequency.value.trim(),
    content: libFContent.value.trim(),
    method: libFMethod.value.trim(),
  })
}
async function addCustomFlatLib() {
  const control = libFControl.value.trim()
  if (!control || !libFStandard.value.trim()) {
    ElMessage.warning(tt('请填写控制项目与控制标准'))
    return
  }
  // item 为空后端直接 400(StdLibController.add 校验 lib/item/content 三者非空)——
  // 旧版靠 filterVal 兜着,本面板没有表区了 ⇒ 分组格必须选/填一个
  const item = flatItem()
  if (!item) {
    ElMessage.warning(tt('请先选择分组'))
    return
  }
  // 与规格书同一套规范结构,但**各存各的库**:出货检验计划表写 insp.plan(item=分组名)
  const content = flatContent()
  try {
    if (libFEditId.value) {
      await request.post('/stdlib/update', { id: libFEditId.value, content })
      ElMessage.success(tt('已保存修改'))
    } else {
      await request.post('/stdlib/add', { lib: 'insp.plan', item, content })
      ElMessage.success(tt('已存入标准库'))
    }
    resetLibEdit()
    await openLib(libTargetDt.value)
  } catch (e) {
    ElMessage.error(tt('保存失败'))
  }
}
function confirmLib() {
  const dt = libTargetDt.value
  if (!dt) return
  const arr = touch()
  // ── 组装工艺 4 变体:勾选一个变体 ⇒ 把本表区的行**整表替换**成该变体的 rows ──
  // 语义与另两态不同(那两态是"逐条追加"):变体是一整套工序,混着用没有意义。
  if (dt.lib === 'asm.proc') {
    const picked = libChecked.value[0]
    if (picked && picked.rows && picked.rows.length) {
      const key = dt.filterKey || '表区'
      const val = dt.filterVal
      // 只替换本表区的行(同面板多表区共表时不能动别的表区)
      for (let i = arr.length - 1; i >= 0; i--) {
        if (String(arr[i][key] || '') === String(val || '')) arr.splice(i, 1)
      }
      for (const r of picked.rows) arr.push({ ...r, [key]: val })
      // 同时把变体名写进头皮字段(产品形态),使 variantKey/variants 也跟着切
      if (cfg.value?.variantKey && cfg.value.variants?.[picked.item]) {
        props.head[cfg.value.variantKey] = picked.item
      }
    }
    libChecked.value = []
    libVisible.value = false
    emit('dirty')
    return
  }
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
      // 只把行投影成规范的 10 个中文键落进明细——否则 custom/dbId 会跟着 spread 存进单据
      // (保存链路只剥 id/__id/__no,认不出这两个键,会当成业务字段留在库里)
      const proj = toInspRow(toCanonical(row, ''))
      const out = dt.filterKey ? { [dt.filterKey]: dt.filterVal, ...proj } : { ...proj }
      // 分组名(必测项/型式检验)随勾选带回明细:toInspRow 的 10 个键里没有它 ⇒ 不会被 proj 盖掉;
      // 但配置若把 libGroupKey 指到一个 proj **已有**的键上,就是配置错了 —— 那种情况下宁可保留
      // proj 的值(条目正文的真实内容)也不让分组名去覆盖,故先判 undefined 再写。
      const grp = flatGroupOf(row)
      if (dt.libGroupKey && grp && out[dt.libGroupKey] === undefined) out[dt.libGroupKey] = grp
      arr.push(out)
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

/**
 * 变体切换行(申请单类型)占前几列。
 * 原来写死 2 列:在 16 列网格里「申请单类型：内部委托 ▼」被挤成两行(页面 0 实测),
 * 而宽网格前几列本就窄。给到 6 列(不超过总列数-1,右侧留一格静默填充)。
 * ⚠ 目前只有 测试申请单(RD_DOM_TEST)走 report + variantKey 这条路;
 *   plain 版式的面板走 subtitle(不受影响)。
 */
function variantSpan(dt) {
  return Math.max(2, Math.min(6, totalSpan(dt) - 1))
}function dtW(dt) {
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
// 位数跟本列明细走(2026-10-03 口径,见 @core/panel/sumTotals):原先固定收敛到 4 位,
// 明细若写 5~6 位(库内确有 scale=6 的列)合计仍会少位。
function totalOf(dt, key) {
  const sum = sumKeepScale(rowsOf(dt).map((r) => r[key]))
  return sum ? String(sum) : ''
}

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])))
/**
 * 下拉选项。
 * ⚠ 2026-10-28「标准库启用后下拉仍是『无数据』」的根因就在口径不一致:
 *   stdLibOf/cellKind 用 `find`(取**第一条**同名定义 ⇒ 表头那条「标准库」),
 *   而这里原先用 fieldMap(**后写覆盖** ⇒ 明细里同名字段「文本、无 options」)——
 *   于是同一个格子上「标准库维护」按钮在、下拉却是空的。
 * 现在统一成:优先取**带 options 的那条**同名定义,其次第一条。
 *   (同名字段改名是根治,见 migrate-record-group-relabel-20261028.sql;这里只是兜底。)
 */
function selectOptions(key) {
  const list = props.fields || []
  const withOpts = list.find((x) => (x.dataName || x.code) === key
    && Array.isArray(x.options) && x.options.length)
  const f = withOpts || list.find((x) => (x.dataName || x.code) === key)
  const opts = f?.options || []
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// ── 参照字段(产品编号等 -> 产品信息表):点击单元格弹参照,确认后按 refMap 带回(产品名称等) ──
function isRefKey(key) {
  if (!key) return false
  const f = fieldMap.value.get(key)
  return !!(f && f.refPanel)
}
const prodRefVisible = ref(false)
const prodRefKey = ref('')
const prodRefField = computed(() => fieldMap.value.get(prodRefKey.value) || null)

// ── 产品开发状态角标(2026-09-09):本面板的产品键已下发时,在单元格标注 未开发 / 已开发 ──
const DEV_PANEL_CODES = ['RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_SPEC_DOC', 'RD_INSP_PLAN']
const devStatus = ref('')
const devKey = computed(() => {
  for (const k of ['产品编号', '编号']) {
    if (fieldMap.value.has(k) && isRefKey(k)) return k
  }
  return ''
})
watch(
  () => [props.panelCode, devKey.value ? props.head[devKey.value] : ''],
  async () => {
    // ⚠ 2026-10-27:成型工艺清单的产品编号带 -tb,而 rd_dev_task 存的是原始编号 ⇒ 剥后缀再查
    const code = devKey.value ? rawProductCode(props.head[devKey.value]) : ''
    if (!code || !DEV_PANEL_CODES.includes(props.panelCode)) {
      devStatus.value = ''
      return
    }
    try {
      const res = await request.post('/px/rdDev/annotate', { panelCode: props.panelCode, productCodes: [code] })
      const map = res?.data?.data || res?.data || {}
      devStatus.value = map[code] || ''
    } catch (e) {
      devStatus.value = ''
    }
  },
  { immediate: true }
)
function openProdRef(key) {
  if (!props.editable || !isRefKey(key)) return
  prodRefKey.value = key
  prodRefVisible.value = true
}
function onProdRefConfirm(rows) {
  const f = prodRefField.value
  const source = rows?.[0]
  if (!f || !source) return
  const refField = f.refField || f.dataName
  // 2026-10-27 用户口径(1027系统使用-产品工艺文件问题点待改善 #2):
  //   「【成型工艺清单页】点击选择产品编号之后,在产品编号后面自动添加 -tb 编号后缀」——
  //   只对**成型工艺清单的「产品编号」这一格**生效;其它面板、其它参照格保持原样。
  //
  // ⚠ 为什么写进值本身而不是只在纸面显示后缀:用户明确说「加在产品编号本身」。
  //   后果与配套(都已落实,缺一条就会查不到数据):
  //     ① 本面板的「产品编号」从此是 00011-tb 形态,**下游一律按原始编号查询** ——
  //        前端三处反查先过 rawProductCode();后端两处 SQL 同时认两种形态
  //        (FirstInspItems / WorkOrderRecipeService,见两处注释);
  //     ② 重复点参照时不能叠成 00011-tb-tb ⇒ productCodeWithSuffix 内部先剥一层再拼。
  //   历史单据(无后缀)不报错:所有读取方都接受两种形态。
  //
  // ⚠ 必须显式判 `prodRefKey === '产品编号'`:本面板还有别的**参照**格(生产车间→DEPT 等),
  //   2026-10-27 起 产品管控类型/外观要求(产品形态)也改成参照 RD_PROD_INFO ——
  //   不判就会把 `-tb` 拼到「重点产品」「包布」这种值后面,直接写坏数据。
  props.head[prodRefKey.value] = prodRefKey.value === '产品编号'
    ? productCodeWithSuffix(source[refField], props.panelCode)
    : (source[refField] ?? '')
  for (const m of f.refMap || []) {
    if (m && source[m.from] !== undefined) props.head[m.to || m.from] = source[m.from]
  }
  // 炭棒规格回填:成型面板 炭棒规格1/2/3 三窄格(外：/内：/长： 前缀区分数值)。
  // 取值口径见 core/panel/carbonSpec.js(三个独立字段优先,「炭棒尺寸」整串逐格回退;
  // 空的不写 —— 半截的 `外：` 不许落格)。只在有这三个格的成型工艺面板上动手。
  for (const [k, v] of Object.entries(carbonSpecFrom(source, fieldMap.value.has('炭棒规格1')))) {
    props.head[k] = v
  }
  prodRefVisible.value = false
  emit('dirty')
  // 「自动填充规格书」:面板块若配了 autoFillSpec 且本次选中的就是它的 fromKey(产品编号),
  // 紧接着按该编号拉规格书内容回填 —— 用户点「确定」后不用再点第二下按钮。
  const afs = cfg.value?.autoFillSpec
  if (afs && prodRefKey.value === afs.fromKey) autoFillFromSpec(props.head[afs.fromKey], afs)
}

/** 该面板承载 autoFillSpec.detail 落点的明细表。
 *  两段式:先找**同时含全部落点键**的表,再退回「含第一个 to 键的表」,最后才是第一张表。
 *  ⚠ 为什么要有第一段:成型工艺清单(RD_MOLD_PROC)的修订记录表与配方表**共用一张行表**,
 *    修订记录表里也有『序号』—— 只按"含任意一个落点键"找,配方表那三列会被写进修订记录区。
 *    单表区面板(出货检验计划表/组装BOM表)两段结果相同,行为一字不变。 */
function autoFillTargetDt(afs) {
  const want = (afs.detail || []).map((m) => m.to)
  const tables = cfg.value?.dataTables || []
  return tables.find((dt) => want.length && want.every((k) => (dt.cols || []).some((c) => c.key === k)))
    || tables.find((dt) => (dt.cols || []).some((c) => want.includes(c.key)))
    || tables[0] || null
}

/**
 * 自动填充规格书 —— 「自动填充规格书」就是这条路径:
 *   选定产品编号 → 取该产品对应**规格书**(RD_SPEC_DOC)的某个表区明细 → 回填。
 *   三条链共用本函数(差异全部在配置里,见 core/insp/specCarry.js 头注):
 *     · 出货检验计划表 ← 规格书「检验项目及检验标准」(表区 '检验要求',端点 /px/specByProduct);
 *     · 组装工艺清单「组装BOM表」← 规格书「1.关键物料列表」(表区 '物料清单',端点 /px/specByProductForAsm);
 *     · 成型工艺清单 ← 规格书「检验要求」(写进 跌落要求/强度要求kgf/压降标准kpa 与尺寸四格),
 *       端点 /px/specByProductForMold
 *       —— ⚠ 2026-10-15 口径变更:原先它还带页 2 配方表的物料行(靠 detailSource 取
 *       payload['物料清单']),用户改口「配方表的数据是在配方计算器里面填写数据然后填入单据的」
 *       ⇒ 那段撤掉;配方表的行改在**配方计算弹窗**里录(见本文件 onRecipeApplied)。
 *
 * 【为什么走后端端点而不是通用查询】规格书的 编号(=产品键)在通用链路里被
 *   QueryService.loadDocs 用单据编号覆盖掉了(详见该处注释),getFormDescriptor /
 *   queryFormDataList 都取不到真值。该端点另开一条直读 head/detail 的路。
 *
 * 【填充口径】
 *   表头:按 head[] 逐格写(客户项目名称/产品功能类别/产品整体尺寸 ← 规格书等价列);
 *   明细:整表替换 —— 本表的检验项/BOM 行就是规格书的那些行,逐条追加会越填越长;
 *   兜底:defaults 里的固定值(如不合格应对措施三段式)**只填空格**,不覆盖已录内容。
 *   命中多张规格书时(matched>1)只取最新一张,末尾提示按哪一张填的,不让用户猜。
 *
 * 【审批门禁】规格书没填写提交审批完(草稿/审批中/…)时后端一个格都不带回,这里只把
 *   payload.reason 翻成人话:not_approved ⇒ 按该链自己的措辞提示(afs.notApprovedTip)。
 */
async function autoFillFromSpec(code, afs) {
  const key = afs?.fromKey
  // ⚠ 2026-10-27:成型工艺清单的产品编号带 -tb 后缀,而规格书是按**原始产品编号**分发的
  //   ⇒ 取规格书前必须剥后缀,否则一律返回 found=false(用户看到"该产品编号还没有对应的规格书")。
  const val = rawProductCode(code)
  if (!key || !val || !props.editable) return
  // 明细落点:没配 detail 的链(部分面板只做表头格带入,见 autoFillSpec.headFromDetail)
  // **不认**明细表 —— 否则 autoFillTargetDt 会退回到第一张表,把它整表替换成按空映射生成的空行。
  const detailMap = afs.detail || []
  const dt = detailMap.length ? autoFillTargetDt(afs) : null
  const req = specCarryRequest(val, afs)
  let payload = null
  try {
    const res = await request.get(req.url, { params: req.params })
    // request.js 的响应拦截器已 (res) => res.data ⇒ 这里拿到的是 ApiResult {code,message,data}
    payload = res?.data ?? res ?? null
  } catch (e) {
    ElMessage.warning(tt('取规格书失败，请手工填写'))
    return
  }
  if (!payload || !payload.found) {
    // 门禁口径见 core/insp/specCarry.js:规格书必须填写并提交审批完,否则一个格都不带入
    const fail = specCarryFailure(payload)
    if (fail && fail.kind === 'not_approved') {
      ElMessage.warning(tt(specNotApprovedTip(afs))
        .replace('{no}', fail.specNo || '')
        .replace('{st}', fail.status || tt('未知')))
      return
    }
    ElMessage.info(tt('该产品编号还没有对应的规格书，请先分发规格书后再来引用'))
    return
  }
  const rows = Array.isArray(payload.items) ? payload.items : []
  // 明细落点的行 = 规格书本表区的行(payload.items)。原按 detailSource 取第二段的写法已随
  // 2026-10-15 口径变更撤掉(配方行改在配方计算弹窗里录);纯函数+单测在 core/insp/specCarry.js。
  const srcRows = detailMap.length ? specCarryRows(payload) : []
  // ⚠ 行的构造走纯函数 detailRowsOf(有单测):它的 indexWhenEmpty 负责「规格书那格是空的就用行号兜底」
  //   —— 规格书的 `序号` 不落库,直接搬会得到一整列空白(2026-10-16 用户报障,见该函数注释)。
  const filled = detailMap.length ? detailRowsOf(afs, srcRows).map((row) => {
    if (dt?.filterKey) row[dt.filterKey] = dt.filterVal
    return row
  }) : []

  const cur = dt ? rowsOf(dt) : []
  if (cur.length) {
    try {
      await ElMessageBox.confirm(
        tt('本表已有 {n} 行，改用规格书 {no} 的 {m} 行内容替换？').replace('{n}', String(cur.length)).replace('{no}', payload.单据编号 || '').replace('{m}', String(filled.length)),
        tt('自动填充规格书'),
        { type: 'warning', confirmButtonText: tt('替换'), cancelButtonText: tt('取消') },
      )
    } catch (e) {
      return // 用户选了「取消」:保留原行
    }
  }

  // 表头逐格回填(空值不回填,免得把已录内容清成空白)
  for (const m of afs.head || []) {
    const v = payload[m.from]
    if (v !== undefined && v !== null && String(v).trim() !== '') props.head[m.to] = String(v)
  }
  // 表头格 ← 规格书**明细**按「检验项目」名匹配(成型工艺清单 检验要求区那四格,见
  // autoFillSpec.headFromDetail)。headFromSpecDetail 只吐出**真取到值**的键 ⇒
  // 规格书里没有该检验项目的那一格**保持不动**(不清空、不写空串)。纯函数+单测在 core/insp/specCarry.js。
  for (const [k, v] of Object.entries(headFromSpecDetail(afs, rows))) props.head[k] = v
  if (dt && filled.length) {
    // 兜底固定值(设计 F9 模板行的三段应对措施)逐行填空格 —— 是**明细**字段,不动表头
    for (const row of filled) {
      for (const [k, v] of Object.entries(afs.defaults || {})) {
        if (!String(row[k] ?? '').trim()) row[k] = v
      }
    }
    const arr = touch()
    if (dt.filterKey) {
      // 多表区共用一张行表:只换本表区的行,别的表区原样留着
      const kept = arr.filter((r) => String(r[dt.filterKey] || '') !== String(dt.filterVal || ''))
      arr.splice(0, arr.length, ...kept, ...filled)
    } else {
      arr.splice(0, arr.length, ...filled)
    }
  }
  prodRefVisible.value = false
  emit('dirty')
  const more = Number(payload.matched) > 1 ? tt('（该产品有多张规格书，按最新的填）') : ''
  ElMessage.success(tt('已按规格书 {no} 自动填充').replace('{no}', payload.单据编号 || '') + more)
  // 刚按规格书填过 ⇒ 与规格书一致,把"变动"提示清掉
  specDriftState.value = null
}

/**
 * 手动导入规格书数据(组装BOM表)。
 * 用户口径(2026-10-13):「在还没有提交审批之前都是可以尝试导入规格书数据的」——
 * 所以除了「选完产品编号自动带入」,这张表还留一个可以反复点的手动入口:
 * 规格书后补审批通过之后、或第一次没填产品编号时,重试不用重开单据。
 * 入口只在配了 autoFillSpec.manual(按钮文案)的表上渲染,与自动路径走同一个 autoFillFromSpec。
 */
function onSpecImportClick() {
  const afs = cfg.value?.autoFillSpec
  if (!afs || !props.editable) return
  const code = String(props.head?.[afs.fromKey] ?? '').trim()
  if (!code) {
    ElMessage.warning(tt('请先选择产品编号，再导入规格书数据'))
    return
  }
  autoFillFromSpec(code, afs)
}

/* ── 规格书变动提示(2026-09-21 用户口径:「规格书变动就提示当前出货检验」)──────────────
   单子填完之后规格书又变了(同张改了内容 / 出了新版本),打开这张出货检验计划表时要看得见
   "与规格书不一致",并能一键按规格书更新。判据 = core/insp/specCarry.specDrift(只比内容不比单号)。 */
const specDriftState = ref(null)   // { specNo, added[], removed[], changed[], drifted }
let specDriftCheckedKey = ''       // 同一次载入只查一次(表头每次编辑都会触发 watch,不能每次都打接口)
let specDriftCheckedHead = null    // 记表头对象:对象换了=重新载入了(重开同一张单也要重查,不能只看单据号)

/** 按当前明细 + 规格书算差异(取规格书走与自动填充同一个受门禁保护的口径) */
async function checkSpecDrift() {
  const afs = cfg.value?.autoFillSpec
  // 该链不参与变动比对时直接跳过:组装BOM表的明细是物料行,比的是检验项目的 要求/方法 —— 比了只会误报
  if (!afs || !props.editable || !specDriftEnabled(afs)) return
  const dt = autoFillTargetDt(afs)
  const code = String(props.head?.[afs.fromKey] ?? '').trim()
  if (!dt || !code) { specDriftState.value = null; return }
  try {
    const req = specCarryRequest(code, afs)
    const res = await request.get(req.url, { params: req.params })
    const payload = res?.data ?? res ?? null
    if (!payload || !payload.found) { specDriftState.value = null; return }
    const specRows = (Array.isArray(payload.items) ? payload.items : []).map((r) => ({
      检验项目: r['检验项目'], 检验要求: r['检验要求'], 检验方法: r['检验方法'],
    }))
    const drift = specDrift(specRows, rowsOf(dt))
    specDriftState.value = drift.drifted
      ? { ...drift, specNo: payload.单据编号 || '', specVersion: payload['版本'] || props.head?.['版本号'] || '' }
      : null
  } catch {
    specDriftState.value = null   // 读不到就不提示(不打扰),但绝不假装"一致"
  }
}

/** 变动提示文案(挂在表头条上,与「从标准库勾选」同一排动作) */
const specDriftText = computed(() => {
  const d = specDriftState.value
  if (!d) return ''
  const parts = []
  if (d.added.length) parts.push(tt('规格书新增') + ' ' + d.added.join('、'))
  if (d.removed.length) parts.push(tt('规格书已删') + ' ' + d.removed.join('、'))
  if (d.changed.length) parts.push(tt('规格书已改') + ' ' + d.changed.map((c) => `${c.item}(${c.fields.join('/')})`).join('、'))
  return tt('规格书已变动') + '：' + parts.join('；') + tt(' —— 点这里按规格书更新')
})

// ── 字段编辑(数据记录表):列名可改,应对复杂测试环境 ──
/**
 * 动态列头标签:优先取后端 yj_field 的 alias/displayName,缺省回退配置硬编码 label。
 *
 * @param {string} key      字段键(dataName = yj_field.label = col_name)
 * @param {string} fallback 配置里写死的纸面文案
 *
 * 🔴 2026-10-27 修复(#3「产品管控类型」改名不生效):
 *   grid 的**标签格**传进来的是 `c.label`(纯纸面文案),而 `fieldMap` 是按 `dataName`
 *   (= 物理列名)建的索引 ⇒ `fieldMap.get('产品管控类型')` 取不到那条字段,于是直接回退纸面文案,
 *   yj_field.alias 白设。
 *   "外观要求/产品形态" 之所以早就生效,是因为它作为**值格**走的是 `c.key`(= dataName),恰好对得上。
 *   修法:按 dataName 取不到时,再用 label 反查一次(col_name 与 label 可能不同,如 alias 改过名的族)。
 *   只在 label 命中**唯一**一条时才用,避免"两个字段共用文案"时张冠李戴。
 */
const fieldsByLabel = computed(() => {
  const m = new Map()
  for (const f of props.fields || []) {
    const lb = String(f.label || '').trim()
    if (!lb || lb === String(f.dataName || '')) continue
    // 同一 label 出现两次(脏数据)就不认,免得把 A 的别名显示到 B 上
    m.set(lb, m.has(lb) ? null : f)
  }
  return m
})
function effColLabel(key, fallback) {
  const f = fieldMap.value.get(key) || fieldsByLabel.value.get(String(key || '').trim()) || null
  return f?.displayName || f?.alias || fallback || key
}

const fieldEditVisible = ref(false)
const fieldEditRows = ref([])
function openFieldEdit() {
  const rows = []
  const seen = new Set()
  const push = (key, label) => {
    if (!key || seen.has(key)) return
    seen.add(key)
    const f = fieldMap.value.get(key)
    rows.push({
      key,
      colName: f?.name || f?.code || key,
      label,
      alias: f?.displayName || '',
      originalAlias: f?.displayName || '',
      visible: f ? !f.hidden : true,
    })
  }
  // 数据表列
  for (const dt of cfg.value?.dataTables || []) {
    for (const c of dt.cols || []) {
      if (c.hiddenCol) continue
      push(c.key, c.label)
    }
  }
  // section 网格字段(成型工艺清单等:标签行/值行的 key 与 label)
  for (const sec of [...(cfg.value?.sections || []), ...(cfg.value?.tailSections || [])]) {
    for (const row of sec.rows || []) {
      if (row.grid) {
        for (const c of row.grid) {
          if (c.label) push(c.label, c.label)
          if (c.key && c.key !== c.label) push(c.key, c.key)
        }
      } else if (row.label && row.key) {
        push(row.key, row.label)
      } else if (row.label) {
        push(row.label, row.label)
      }
      if (row.label2) push(row.label2, row.label2)
    }
  }
  fieldEditRows.value = rows
  fieldEditVisible.value = true
}
async function saveFieldEdit() {
  // 只发送有变更的行(避免空 alias 批量覆盖已有别名 + seq 重排副作用)
  const changed = fieldEditRows.value.filter((r) => r.alias !== (r.originalAlias || ''))
  if (!changed.length) {
    fieldEditVisible.value = false
    return
  }
  try {
    const res = await request.post('/px/saveColumnPrefs', {
      panelCode: props.panelCode,
      columns: changed.map((r) => ({
        label: r.colName,
        alias: r.alias || '',
        visible: !!r.visible,
      })),
    })
    if (res && res.code && res.code !== 200) {
      ElMessage.error(res.message || tt('保存失败'))
      return
    }
    ElMessage.success(tt('字段编辑已保存'))
    fieldEditVisible.value = false
    emit('refresh-config')
  } catch (e) {
    ElMessage.error(tt('保存失败'))
  }
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
      out.push({ kind: 'plain', label: c.label, key: c.key, span: c.span || 1, rowspan: hasGroup(dt) ? 2 : 1 })
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
/**
 * 「一组一行」的分组维度(2026-10-28 用户口径):
 *   「把这三张表按测试项目、设备名称、仪器名称这些下拉来切数据表填写…一张单据可填写的内容就多一些,
 *    而不是不同项目、仪器、设备都要新建一张单」。
 * 声明在 recordSheetConfigs 面板级:
 *   groupBy: { headKey: 头上下拉的字段 label, detailKey: 行上标组归属的字段 label }
 * 规则(纯函数在 core/panel/recordGroup.js,有单测):切换下拉只改**显示哪些行**,
 * 其它组的行仍留在 head.detail.items 里,保存时整体提交。
 */
const groupBy = computed(() => cfg.value?.groupBy || null)
/** 当前下拉值(未选 = 空串 ⇒ 不过滤,保持改造前观感) */
function currentGroupValue() {
  const g = groupBy.value
  if (!g?.headKey) return ''
  const v = props.head?.[g.headKey]
  return v === undefined || v === null ? '' : String(v).trim()
}
/** 行集:矿化按 指标 / 规格书按 表区 分块(filterKey+filterVal);分组面板再按当前下拉过滤;其余全量 */
function rowsOf(dt) {
  let list = items.value
  if (dt.filterKey) list = list.filter((r) => (r[dt.filterKey] || '') === dt.filterVal)
  else if (dt.metric) list = list.filter((r) => (r['指标'] || '') === dt.metric)
  const g = groupBy.value
  if (g?.detailKey) list = groupRows(list, g.detailKey, currentGroupValue())
  return list
}
function addRow(dt) {
  const row = dt.filterKey ? { [dt.filterKey]: dt.filterVal } : {}
  if (dt.metric) row['指标'] = dt.metric
  // 新行必须带上当前下拉值:否则它会飘在"空组"里,切到别组就看不见、重开也可能归错组
  const g = groupBy.value
  if (g?.detailKey) stampGroup(row, g.detailKey, currentGroupValue())
  // 序号自动编:dataTables 里声明 autoSeqBar 的表(成型配方表)按**本表区**已有行数续编。
  // 原来只认面板级 cfg.autoSeq 且用全表 touch().length 计数——多表区共用一张明细表时
  // 会串号(配方行数被工序/BOM 行数带偏),故改为按表区过滤后计数。
  if (dt.autoSeqBar || cfg.value?.autoSeq) row['序号'] = String(rowsOf(dt).length + 1)
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

/**
 * 旧行归组(2026-10-28):改造前录的明细行没有分组列值 ⇒ 打开时归到**当前下拉那一组**。
 * 不这么做的话,老单据的行会漂在"空组"里 —— 切到别的设备/仪器/项目再切回来才看得见,
 * 用户会以为数据丢了。只在可编辑态补(已审批的单不该被前端改内容),已有值的行一律不动。
 * ⚠ 只监听 head **对象引用**(加载/换单),不监听 head[headKey]:切下拉时不能再把空值行归到新组。
 */
watch(() => [props.editable, props.head], ([v]) => {
  if (!v) return
  const g = groupBy.value
  if (!g?.detailKey) return
  const cur = currentGroupValue()
  if (!cur) return
  const rows = items.value
  if (!Array.isArray(rows) || !rows.length) return
  for (const row of rows) stampGroup(row, g.detailKey, cur)
})

/**
 * 「按表预铺空行」的记账(`单据编号::表区键::表区值` → 已铺过)。
 * 只活在组件实例内:关掉单据再打开、或刷新页面会重来 —— 那时库里若已有行,
 * `rowsOf(dt).length` 那道闸会先拦住,不会重复铺。见下方 blankRows watch 注释。
 */
const blankRowsSeeded = new Set()

/**
 * 按**单张数据表**预铺空行(dt.blankRows)。
 *
 * 2026-10-27 用户口径(1027系统使用-产品工艺文件问题点待改善 #8):
 *   「炭棒配方管控清单页面:配方表默认填充 10 行表格。」
 *   用户另确认「没有的留空就行」⇒ 铺的是**空行**,不编造物料/比例。
 *
 * 【为什么不能用上面的 seedRows】seedRows 是**面板级**的("整个面板明细为空就铺"),
 *   而成型工艺清单(RD_MOLD_PROC)里有**两张**逻辑表共用一张行表:
 *   修订记录 + 配方表(靠 filterKey='表区' 分块)。用 seedRows 会在修订记录页也铺 10 行,
 *   而用户只要配方表那 10 行。
 *
 * 口径(每条都踩过坑才写成这样):
 *   ① 只铺**本表区为空**时才铺 —— 已有配方行(含从旧单带出来的)一行动都不动;
 *   ② 行只带分块键 + 序号,其余列留空(用户口径"没有的留空");
 *   ③ 序号按 addRow 同一口径续编(1..10),与之后手动「+ 添加」衔接得上;
 *   ④ 空行走普通明细保存路径,后端 upsert 会照常落库 —— 纸面与库一致,不是"只在界面上假装有 10 行"。
 */
watch(() => [props.editable, props.head, cfg.value], ([v]) => {
  const tables = cfg.value?.dataTables || []
  if (!v || !tables.length) return
  if (!props.head || !props.head['单据编号']) return
  for (const dt of tables) {
    const want = Number(dt.blankRows) || 0
    if (want <= 0) continue
    // ① 本表区已有行 ⇒ 不铺(绝不能把用户已录的配方冲掉,也不能重复铺成 20 行)
    if (rowsOf(dt).length) continue
    // ①b 同一张单只铺一次:本 watch 的依赖含 cfg(配置刷新会重入),
    //     而空行落进 touch() 后 rowsOf 仍可能读到 0 行(行还没被 items 认领的瞬间)⇒ 用单据号+表区记账。
    //     不改这个键,用户手动删光 10 行后也不会被"贴心"地补回来(那不是用户要的)。
    const memoKey = `${props.head['单据编号']}::${dt.filterKey || ''}::${dt.filterVal || ''}`
    if (blankRowsSeeded.has(memoKey)) continue
    blankRowsSeeded.add(memoKey)
    const arr = touch()
    for (let i = 1; i <= want; i++) {
      const row = dt.filterKey ? { [dt.filterKey]: dt.filterVal } : {}
      // ③ 序号续编(与 addRow 同口径:本表区已有行数 + 1)
      if (dt.autoSeqBar || cfg.value?.autoSeq) row['序号'] = String(i)
      arr.push(row)
    }
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

/**
 * 规格书变动检查:可编辑单据载入后查一次。
 * ⚠ 去重按「表头对象 + 单据编号|产品编号」:表头每次编辑都会触发这个 watch,不按对象去重就会
 *   每敲一个字打一次接口;而**重开同一张单**时表头是新的对象 ⇒ 必须重查(否则改版提示永远不刷新)。
 */
watch(
  () => [props.editable, props.head, cfg.value?.autoFillSpec ? props.head?.[cfg.value.autoFillSpec.fromKey] : ''],
  async ([v, head, code]) => {
    if (!v || !cfg.value?.autoFillSpec || !head || !head['单据编号'] || !code) { specDriftState.value = null; return }
    const key = `${head['单据编号']}|${code}`
    if (key === specDriftCheckedKey && head === specDriftCheckedHead) return
    specDriftCheckedKey = key
    specDriftCheckedHead = head
    await checkSpecDrift()
  },
  { immediate: true },
)

// ── 从商品引用(数据源 = 商品档案 INV → bs_inv;2026-10-21 用户口径)──
// 用户原话:「把规格书的从物料清单引用进行一个修改,首先是把引用的数据内容改为引用商品里面的数据,
//   弹窗可以通过上面那些信息来索引数据,然后勾选填写进去,每进行一个字段的填写,其他选项就可以
//   对应的范围缩小,方便查找」。
// 形状:商品是**档案型面板**(mode=archive)⇒ 返回「一张虚拟单」,3917 行挂在 detail.inv。
//   剥形状**不在这里另写一份**:走 invCarry.js 的 invRowsOf(它已经踩过"本地 items / 上线 detail.inv"
//   的坑,见该文件头),本文件只做级联筛选与落行,规则全在 @core/panel/goodsPick.js(有单测)。
const matPickVisible = ref(false)
const matPickLoading = ref(false)
const matPickRows = ref([])
const matPickChecked = ref([])
const matPickTargetDt = ref(null)
/** 四栏筛选值(键 = 商品面板的列名;空串 = 不筛) */
const matPickFilters = reactive(Object.fromEntries(GOODS_FACETS.map((k) => [k, ''])))
function onMatPickSelection(sel) {
  matPickChecked.value = sel || []
}
function resetMatPickFilters() {
  for (const k of GOODS_FACETS) matPickFilters[k] = ''
}
/** 每栏的候选值 —— 按**其它三栏**的当前条件收窄(用户要的"范围缩小"),capped 见 goodsPick.FACET_CAP */
const matPickFacets = computed(() => GOODS_FACETS.map((k) => ({ key: k, ...facetValues(matPickRows.value, k, matPickFilters) })))
/** 表格数据 = 四栏 AND 之后的结果 */
const matPickFiltered = computed(() => matchGoods(matPickRows.value, matPickFilters))
const matPickHint = computed(() => {
  if (matPickLoading.value) return tt('加载中…')
  const all = matPickRows.value.length
  const hit = matPickFiltered.value.length
  if (!all) return tt('商品档案里还没有数据')
  const base = hit === all
    ? tt('共 {n} 条商品；勾选后点「引用」，按 存货编码/名称/规格型号 带进本表').replace('{n}', String(all))
    : tt('筛选后 {m} / {n} 条；勾选后点「引用」带进本表').replace('{m}', String(hit)).replace('{n}', String(all))
  return base + (matPickChecked.value.length ? tt('；已选 {c} 条').replace('{c}', String(matPickChecked.value.length)) : '')
})
async function openMaterialPick(dt) {
  matPickTargetDt.value = dt
  matPickChecked.value = []
  matPickRows.value = []
  resetMatPickFilters()
  matPickVisible.value = true
  matPickLoading.value = true
  try {
    // 档案型面板不吃 pageSize(必须全量返回,见 QueryService.queryArchive 注释);
    // 不带 keyword ⇒ 一次拿全 3917 行,级联筛选全在本地做(打开弹窗一次,之后零请求)。
    const res = await request.post('/px/queryFormDataList', { panelCode: INV_PANEL, condition: {}, pageNo: 1, pageSize: 20 })
    const rows = invRowsOf(res?.data ?? res)
    matPickRows.value = rows.map((r, i) => ({ ...r, __k: `${r?.['存货编码'] || ''}#${i}` }))
  } catch (e) {
    matPickRows.value = []
    ElMessage.error(tt('取商品档案失败'))
  } finally {
    matPickLoading.value = false
  }
}
/**
 * 确认引用:把勾中的商品行**追加**到目标表的明细数组。
 * 映射(纯函数 goodsToDetail,已单测):物料编码←存货编码 / 物料名称←存货名称 /
 *   规格参数←规格型号 / 备注←商品备注(有内容才带,空备注不覆盖已有人手写的内容)。
 *   数量**不带**:商品档案没有用量口径,凭空填 1 会变成错误数据。
 * 表区 ← filterVal('物料清单') 由 addRow 负责(规格书全部明细共用 rd_spec_doc_detail,
 *   不写这个分区值这些行会掉进"没有表认领"的桶,界面上永不显示)。
 * 落行**复用表格自带的 addRow**(与界面「＋」同一条已验证路径,避免两条写行路径再次漂移)。
 */
function confirmMaterialPick() {
  const dt = matPickTargetDt.value
  if (!dt) return
  const colKeys = (dt.cols || []).map((c) => c.key)
  const existCodes = rowsOf(dt).map((r) => String(r['物料编码'] || '').trim()).filter(Boolean)
  const { rows: picked, skipped } = goodsToDetail(matPickChecked.value, existCodes, colKeys)
  let added = 0
  for (const p of picked) {
    addRow(dt)
    const rows = rowsOf(dt)
    const row = rows[rows.length - 1]
    if (!row) continue
    // 序号:按本表区已有行数续编(addRow 只在 dt.autoSeqBar / cfg.autoSeq 时才设,这张表没配)
    if (colKeys.includes('序号')) row['序号'] = String(rows.length)
    // 落点列名按目标表实际列名落(两套叫法并存:规格书=物料编码/规格参数,产品信息表BOM=物料编号/尺寸规格)
    for (const k of ['物料编码', '物料编号', '物料名称', '规格参数', '尺寸规格', '备注']) {
      if (k in p) row[k] = p[k]
    }
    added++
  }
  matPickChecked.value = []
  matPickVisible.value = false
  emit('dirty')
  ElMessage.success(tt('已引用 {n} 行').replace('{n}', added)
    + (skipped ? tt('(跳过重复 {n} 行)').replace('{n}', skipped) : ''))
}

// ── 封面「产品编号」← 产品信息表(RD_PROD_INFO)引用弹窗(2026-10-21)──
/**
 * 为什么单开一个弹窗、不复用通用参照链(RefPickDialog + engine.queryRefRows):
 *   ① 通用链在「参照面板配了审批按钮」时会自动追加 `单据状态=已审核`(见 business/engine.js
 *      queryRefRows 的那段注释),而产品信息表现行数据是「草稿/已归档/已通过」⇒ 弹窗会一条都出不来;
 *   ② 通用链只有勾选框,没法表达「已引用 ⇒ 该行不可选」(用户口径:一个产品信息表只对应一张规格书);
 *   ③ 通用链按参照面板列表顺序出数,而用户要求「最新的产品信息表在最上面」。
 * 取数**不新增后端端点**,两段都走已有 POST /px/queryFormDataList:
 *   · 候选   = 产品信息表单据列表 —— 单据面板的列表行**带全部表头字段**(实测回
 *              产品编号/产品名称/单据日期/产品类别/客户料号/产品整体尺寸/主要性能描述…),
 *              正是要带回封面的那一整份数据;
 *   · 已引用 = 规格书单据列表里的 产品编号 集合(列表接口自身已按 asp_cancel 过滤作废行,
 *              故拿到的就是"未作废的引用")。
 * 字段/列/映射全部读配置(recordSheetConfigs.js 的 RD_SPEC_DOC.prodPick),这里只负责取数与落值。
 */
const prodPickCfg = computed(() => cfg.value?.prodPick || null)
const prodPickVisible = ref(false)
const prodPickLoading = ref(false)
const prodPickRows = ref([])
const prodPickKeyword = ref('')
/** 当前高亮待引用的那一行(用户口径是"一个对应一个",故选单行,不用勾选框) */
const prodPickRow = ref(null)
const prodPickCols = computed(() => prodPickCfg.value?.columns || [])
const prodPickFiltered = computed(() => {
  const kw = String(prodPickKeyword.value || '').trim().toLowerCase()
  if (!kw) return prodPickRows.value
  const keys = prodPickCols.value.map((c) => c.key)
  return prodPickRows.value.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(kw)))
})
const prodPickHint = computed(() => {
  const all = prodPickRows.value
  if (prodPickLoading.value) return tt('加载中…')
  if (!all.length) return tt('产品信息表里还没有可引用的产品编号')
  const used = all.filter((r) => r.__used).length
  return tt('共 {n} 条，其中 {m} 条已开发（不可再引用）')
    .replace('{n}', String(all.length)).replace('{m}', String(used))
})
/** 单据面板列表接口的返回形状统一在这里剥一层(list 可能在 res.data 或 res.data.list) */
function listOfRes(res) {
  const data = res?.data || res || {}
  return Array.isArray(data.list) ? data.list : []
}
/** 本单自己的单据号 —— "已引用"判据必须**排除本单**:
 *  打开一张已有规格书时,它自己的产品编号当然已被引用,不排除就会把自己也标成已开发。
 *  (注:键名按面板声明各不同:规格书/单据面板是「单据编号」,文档面板是「编号」) */
function currentDocNo() {
  return String(props.head?.['单据编号'] ?? props.head?.['编号'] ?? '').trim()
}
/** 最新在前:先按 单据日期 倒序,同日再按 单据编号 倒序兜底
 *  (单据编号里带日期段,PI-2026-10-0004 这类零填充串字典序即时间序)。
 *  为什么用 localeCompare 而不是 <:两边都可能是空串(草稿单据),直接比会出现 NaN/undefined 序。 */
function prodPickSort(a, b) {
  const byDate = String(b['单据日期'] ?? '').localeCompare(String(a['单据日期'] ?? ''))
  if (byDate) return byDate
  return String(b['单据编号'] ?? '').localeCompare(String(a['单据编号'] ?? ''))
}
function prodPickRowClass({ row }) {
  if (row?.__used) return 'pp-row-used'
  if (row && prodPickRow.value && row.__pk === prodPickRow.value.__pk) return 'pp-row-picked'
  return ''
}
async function openProdPick() {
  const pp = prodPickCfg.value
  if (!pp || !props.editable) return
  prodPickKeyword.value = ''
  prodPickRow.value = null
  prodPickRows.value = []
  prodPickVisible.value = true
  prodPickLoading.value = true
  try {
    const [candRes, usedRes] = await Promise.all([
      request.post('/px/queryFormDataList', {
        panelCode: pp.fromPanel || 'RD_PROD_INFO', condition: {}, pageNo: 1, pageSize: 500,
      }),
      request.post('/px/queryFormDataList', {
        panelCode: pp.usedPanel || props.panelCode, condition: {}, pageNo: 1, pageSize: 1000,
      }),
    ])
    const self = currentDocNo()
    const key = pp.targetKey || '产品编号'
    const used = new Set()
    for (const r of listOfRes(usedRes)) {
      const code = String(r?.[key] ?? '').trim()
      if (!code) continue
      if (self && String(r?.['单据编号'] ?? '').trim() === self) continue // 本单自己的引用不算"被别人引用"
      used.add(code)
    }
    // 没填产品编号的产品信息表**引用不了**(没有键可带),直接不出现在候选里
    const rows = listOfRes(candRes)
      .filter((r) => String(r?.[key] ?? '').trim())
      .map((r, i) => ({ ...r, __pk: String(i), __used: used.has(String(r[key]).trim()) }))
    rows.sort(prodPickSort)
    prodPickRows.value = rows
  } catch (e) {
    prodPickRows.value = []
    ElMessage.error(tt('取产品信息表失败'))
  } finally {
    prodPickLoading.value = false
  }
}
/** 行点击:已开发的行只提示、不选中("不能多次引用"这条规则要在点击处就拦住,而不是等按确定) */
function onProdPickRowClick(row) {
  if (!row) return
  if (row.__used) {
    ElMessage.warning(tt('该产品编号已经引用过产品规格书，不能再引用'))
    return
  }
  prodPickRow.value = row
}
/**
 * 确认引用:按 prodPick.map 逐项写回封面,空值**不回填**(同 autoFillSpec 口径 ——
 * 拿空串去冲掉已录内容等于丢数据),最后提示带入了多少项,让用户知道成不成功。
 */
function confirmProdPick() {
  const pp = prodPickCfg.value
  const row = prodPickRow.value
  if (!pp || !row) return
  if (row.__used) {
    ElMessage.warning(tt('该产品编号已经引用过产品规格书，不能再引用'))
    return
  }
  const key = pp.targetKey || '产品编号'
  let filled = 0
  for (const m of pp.map || []) {
    const v = row[m.from]
    if (v === undefined || v === null || String(v).trim() === '') continue
    props.head[m.to || m.from] = String(v)
    filled++
  }
  // 产品编号是**键**,即使配置里忘了写进 map 也必须落值(不然后续一律按它取数)
  const code = String(row[key] ?? '').trim()
  if (code && String(props.head[key] ?? '') !== code) {
    props.head[key] = code
    filled++
  }
  prodPickVisible.value = false
  prodPickRow.value = null
  emit('dirty')
  ElMessage.success(tt('已引用产品信息表 {no}，带入 {n} 项')
    .replace('{no}', String(row['单据编号'] ?? '')).replace('{n}', String(filled)))
}

// ---------- 配方计算(成型工艺清单:弹窗里录配方表物料行 → 算 → 写回页 1 与页 2 配方表) ----------
// 口径见 CONTEXT.md「配方计算器」与 docs/adr/0004:公式固定(与设计器 exe 逐位一致)、
// 弹窗输入不落库不打印,只有回填进单据字段的值随单据保存。逻辑全在 core/mold/,这里只负责把行喂给它。
// ⚠ 2026-10-15 用户口径变更:配方表的物料行**在弹窗里录**(原来从规格书带入 / 页 2 手填),
//   故弹窗回填时明细是**整表替换本表区**,由 onRecipeApplied 完成(与「按规格书自动填充」同一套替换口径)。
const recipeCalcVisible = ref(false)
const recipeCalcRows = ref([])
const recipeCalcDt = ref(null)
function openRecipeCalc(dt) {
  recipeCalcDt.value = dt
  recipeCalcRows.value = rowsOf(dt)
  recipeCalcVisible.value = true
}
/** 弹窗算完:把弹窗里那份物料行整表换掉本表区的旧行(页 2 原来是空的也能一次写入) */
function onRecipeApplied(payload) {
  const dt = recipeCalcDt.value
  const rows = Array.isArray(payload?.rows) ? payload.rows : []
  if (dt) {
    const arr = touch()
    if (dt.filterKey) for (const r of rows) r[dt.filterKey] = dt.filterVal
    const kept = dt.filterKey
      ? arr.filter((r) => String(r[dt.filterKey] || '') !== String(dt.filterVal || ''))
      : []
    arr.splice(0, arr.length, ...kept, ...rows)
  }
  emit('dirty')
}

// ── 章节标准库(yj_std_lib,lib=spec.section):1-3/6-8 章节内容可勾选示例、可自行补充 ──
// 列表维护(增/编/停用/恢复)交给 StdLibManager;本处保留「多行新增」框与「勾选→填入」到当前章节字段
const secLibVisible = ref(false)
const secLibRef = ref(null)
const secLibLabel = ref('')
const secLibKey = ref('')
const secLibDraft = ref('')
// 章节/模板标准库弹窗的库与条目:由 openSectionLib 按字段声明决定(见该函数注释)
const secLibLib = ref('spec.section')
const secLibItem = ref('')
async function openSectionLib(row) {
  secLibKey.value = row.key
  // grid 单元格没有 label(那是标签格才有),退回 key,免得弹窗标题空着
  secLibLabel.value = row.label || row.key || ''
  // 库与条目按**字段自己声明的标准库**走(成型工艺的 配料要求/热压要求);
  // 没声明库的老调用方(规格书章节)保持原样:spec.section + 条目名=章节名。
  const lib = stdLibOf(row.key)
  secLibLib.value = lib || 'spec.section'
  secLibItem.value = lib ? '默认' : (row.label || row.key || '')
  secLibDraft.value = props.head?.[row.key] || ''
  secLibVisible.value = true
}
function applySectionLib(content) {
  if (!props.head) return
  props.head[secLibKey.value] = sectionLibText(content)
  emit('dirty')
  secLibVisible.value = false
}
async function addSectionLib() {
  const text = (secLibDraft.value || '').trim()
  if (!text) return
  // ⚠ 库与条目名必须取自本弹窗当前字段声明的标准库(openSectionLib 决定),**不能写死 spec.section**:
  //   成型工艺的 配料要求(mold.batching)/热压要求(mold.hotpress) 等字段用的是各自的库,
  //   写死会把条目塞进 spec.section ⇒ 弹窗(绑 secLibLib)与预设列表里**一条也看不到** = 「新增无效」。
  //   规格书章节字段没有自己的库,secLibLib/secLibItem 退化为 spec.section + 章节名,与改前逐字等价。
  const lib = secLibLib.value || 'spec.section'
  const item = secLibItem.value || secLibLabel.value
  try {
    await request.post('/stdlib/add', { lib, item, content: text })
    ElMessage.success(tt('已存入标准库'))
    secLibDraft.value = ''
    await secLibRef.value?.load()
  } catch (e) {
    ElMessage.error(tt('保存失败'))
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
/* 校验定位闪烁:琥珀高亮约3秒(保存必填缺失时跳转提示) */
@keyframes rsFieldBlink {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 0 3px rgba(250, 173, 20, 0.55); background: #ffe58f; }
}
.field-blink {
  animation: rsFieldBlink 0.65s ease-in-out 5;
  outline: 2px solid #faad14;
  outline-offset: -2px;
}
/**
 * 校验定位高亮(2026-10-13):保存被必填拦下时,自动翻到缺失字段所在页并把该格标红约 3 秒。
 * 为什么不用 field-blink:那个是**命令式**加的类(按纸面文案找 DOM),纸面文案与数据键不同就找不到;
 * 这个是**数据驱动**的(模板按 focusKey === 数据键 绑定),与翻页判据同一真源。
 * 尺寸零影响:只用 outline/box-shadow/background-color —— 不用 border(会撑开盒子、
 * 把纸面网格与列宽顶歪,规格书是 1:1 复刻版式)。
 * transition 只列具体属性(项目红线:禁 transition: all)。
 */
@keyframes rsFocusPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 108, 108, 0); }
  50% { box-shadow: 0 0 0 4px rgba(245, 108, 108, 0.35); }
}
.rs-focus {
  outline: 2px solid #f56c6c;
  outline-offset: -2px;
  background-color: #fef0f0;
  transition: background-color 0.2s ease, outline-color 0.2s ease;
  animation: rsFocusPulse 1s ease-in-out 3;
}
.rs-focus :deep(.el-input__wrapper),
.rs-focus :deep(.el-textarea__inner),
.rs-focus :deep(.el-select__wrapper) {
  box-shadow: 0 0 0 1px #f56c6c inset;
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
/**
 * 规格书章节行(1.适用范围 / 2.整体规格参数 / 3.产品主要性能)的**只读值**不能是 60px 高。
 * 2026-09-21 用户口径:「归档之后这三个字段之间间隔太远」。实测(探针 _probe-spec-docrow.cjs):
 * 只读态每行 = rsp-pre 的 min-height 60px + td 上下 padding 4px ⇒ 三行章节块 **202px**,
 * 而《规格书细分.xlsx》「页面-产品信息」里这一整块只有 **87px**;同一行在**编辑态**是 22px 的填写线
 * (见下面 .rsp-doccell :deep(.el-textarea__inner) 的 min-height:22px)。
 * 这里把 doc 行的只读值拉回与编辑态同高 —— 编辑时看到的行距就是打印出来的行距。
 * ⚠ 只覆盖 .rsp-docval:.rsp-pre 的其它用处(检验要求/方法/依据、row.tall 的长文本格)
 *   仍需要 60px 的可打印块高,不能一起改掉。
 */
.rsp-docval.rsp-pre {
  min-height: 22px;
}
/**
 * 日期/时间/区间格:控件宽度必须**收口在单元格里**(2026-10-28 用户报障
 * 「仪器使用记录表的起止时间显示位置异常」:值挤在格子左上角、下方一条空白带、右边把邻列顶歪)。
 *
 * 【根因有**两层**,缺任一层都修不好】
 *   ① 特异性:Element Plus 写死了
 *        .el-date-editor.el-input, .el-date-editor.el-input__wrapper { width: var(--el-date-editor-width) }
 *        .el-date-editor--daterange, .el-date-editor--timerange { --el-date-editor-width: 350px }
 *        .el-date-editor(默认)                                   { --el-date-editor-width: 220px }
 *      都是 0,2,0 —— 只在 `.rs-date-in` 上写 width:100%(0,1,0) 压不住。
 *   ② scoped 作用域:el-date-picker 的根 div.el-date-editor **没有拿到本组件的 data-v-* 属性**
 *      (实测该元素只有 class/tabindex),所以任何 `.rs-range-in[data-v-x]` 形态的规则**永不命中**。
 *      原来的 `.rs-date-in{...}` / `.rs-range-in{...}` 全是死代码,控件始终是 350px/220px 默认宽,
 *      在 120px/110px 的纸面格子里向右溢出(活体实测溢出 239px / 119px)。
 *   ⇒ 唯一正解:`.rs-td :deep(...)`,编译成 `.rs-td[data-v-x] .el-date-editor.rs-range-in`
 *     (祖先 .rs-td 有 data-v,后代不受作用域限制)。钉子见 recordSheetDateCellWidth.test.js。
 */
.rs-td :deep(.el-date-editor.rs-date-in),
.rs-td :deep(.el-date-editor.rs-range-in) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0 4px;
}
/* 日期格:Element 默认左右 11px 内边距会把 '2026-10-07' 挤成省略号,这里归零并居中 */
.rs-td :deep(.rs-date-in .el-input__inner) {
  padding: 0;
  text-align: center;
}
/*
 * 日期格同样不显示日历图标:110px 的格子扣掉图标 20px 后输入框只剩 65px,
 * 而 '2026-10-28' 实测需要 69px ⇒ 被裁成 '2026-10-2'(会看错日期,比省 20px 严重)。
 * 隐藏后输入框 85px,日期完整;点击输入框本身即可打开日期面板,图标只是装饰。
 */
.rs-td :deep(.rs-date-in .el-input__prefix) {
  display: none;
}
/* 区间格:120px 的格子装不下默认 0 10px 内边距 + 两个 39% 宽的输入 */
.rs-td :deep(.el-date-editor.rs-range-in) {
  padding: 0 2px;
}
/* 两个 HH:mm 按剩余宽度**平分**(flex:1),min-width:0 防止输入框固有宽度下限把格子重新撑开 */
.rs-td :deep(.rs-range-in .el-range-input) {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  font-size: inherit;
  text-align: center;
}
/* 分隔符定宽,不参与平分(Element 默认给 separator flex:1,会白白吃掉半个格子) */
.rs-td :deep(.rs-range-in .el-range-separator) {
  flex: none;
  padding: 0 1px;
  font-size: inherit;
}
/*
 * 纸面小格子里**不显示时钟图标**:120px 的格子扣掉图标占的 20px 后,
 * 两个 HH:mm 各只剩 31px ⇒ 实测 '06:14' 被裁成 '06:1'(活体截图)。
 * 隐藏后每个输入回到 39px,5 个字符(≈35px)完整显示。
 * 不影响选择能力:el-date-picker 的整个控件区域都可以点开面板,图标只是装饰。
 */
.rs-td :deep(.rs-range-in .el-range__icon) {
  display: none;
}
/* 纸面格内控件一律铺满格子(文本/下拉/自动完成) */
.rs-t-in,
.rs-c-in {
  width: 100%;
}
/* 参照单元格(产品编号 -> 产品信息表):拟态输入框,点击弹参照 */
.rs-ref-ctl {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 24px;
  padding: 0 4px;
  border: 1px dashed #b9c0c8;
  border-radius: 3px;
  cursor: pointer;
  background: #fafbfc;
}
.rs-ref-ctl:hover {
  border-color: var(--el-color-primary, #409eff);
  background: #f0f6ff;
}
.rs-ref-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: #333;
}
.rs-ref-ico {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-color-primary, #409eff);
}
/* 产品开发状态角标 */
.rs-dev-badge {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 7px;
  font-size: 11px;
  line-height: 16px;
}
.rs-dev-badge.none { background: #fff2e0; color: #b26a00; }
.rs-dev-badge.done { background: #e6f4ea; color: #1a7f37; }

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
/* 受控表单编号常量(逐页,如 YJ-RIR001/YJ-XS002):与只读编号同字号,
   不可编辑 ⇒ 不用输入框的灰底,保持纸面观感 */
.rs-docno-static {
  font-style: normal;
  white-space: nowrap;
}
/* 「编号：」前置标识:23 个面板共用的纸张右上角逐格标签。
   用 flex 让标识与输入框/参照控件同排,标识不缩、值区自适应。 */
.rs-docno-wrap {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.rs-docno-prefix {
  white-space: nowrap;
  font-style: normal;
  font-weight: 600;
}
/* 同格版式(head.noSpan === 0,阻垢性能/浸泡安全):设计是**一格含两段文字** ——
   公司名与编号排在同一格的一行里,公司名靠左、编号靠右。编号块(参照控件/输入框/裸值)
   占满剩余宽度,内部仍各自右对齐。
   ⚠ flex 加在 .rs-docno **内层** div 上,不能加在 <td> 上(见模板注释:td 脱离 table-cell 会丢 colspan)。 */
.rs-onecell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.rs-company-inline {
  flex: none;
  font-size: 17px;
  font-weight: 400;
  color: #333;
}
.rs-onecell > .rs-docno-wrap,
.rs-onecell > .rs-ref-ctl {
  flex: 1 1 auto;
  min-width: 0;
}
.rs-docno-empty {
  color: #b6bcc6;
  font-style: normal;
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

/* ═══ 区块条(cream gray)══════════════════════════════════════════
   原为粉色 #f9dfe2(偏暖红)。2026-09-18 用户口径改为「奶油灰类似的高级色」:
   取 #ECEAE3 —— 暖调(红>绿>蓝的温和梯度)、低饱和、高明度,与纸张白 #fff
   只拉开一档明度差(不做成明显色块),与区块条既有边框 #7f7f7f/正文 #333 对比度充足。
   同一色值必须与 DataRecordSheet.vue 的 .rs-sectionbar 保持一致(两张纸是一族)。 */
.rs-sectionbar {
  background: #ECEAE3;
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

/* ═══ 表尾静态附表(cfg.tailTables:纸面固定附录,只读) ═══
   宽度取自表自己的列宽(比整页窄)⇒ 居中摆放,与设计里它缩进一列的位置观感一致 */
.rs-tail-table {
  margin: 10px auto 0;
}

/* ═══ 只读台账页(pages[i].ledger:委托测试汇总表) ═══ */
.rsp-ledger {
  margin: 0 auto;
}
.rsp-ledger-hint .rs-td {
  color: #909399;
  font-size: 12px;
  padding: 2px 6px;
  background: #fafafa;
}
.rsp-center {
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
/* 条目维护标识:停用(✕,灰显划线可恢复)/恢复启用(↩)——与 StdLibManager 同款维护 */
.lib-sub-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.lib-sub-item-off .el-checkbox {
  opacity: 0.55;
}
.lib-sub-name-off {
  color: #a8b6c4;
  text-decoration: line-through;
}
.lib-sub-del {
  color: #f56c6c;
  cursor: pointer;
  font-size: 12px;
  margin-left: 2px;
  padding: 0 2px;
}
.lib-sub-del:hover {
  background: #fef0f0;
  border-radius: 2px;
}

/* 检验项目库补充表单 + 停用行(扁平表格灰显划线) */
.lib-tip { font-size: 12px; color: #8ba6bd; margin-bottom: 8px; line-height: 1.6; }
.lib-sub-undo {
  color: #67c23a;
  cursor: pointer;
  font-size: 12px;
  margin-left: 2px;
}
.lib-sub-undo:hover {
  color: #529b2e;
}
.lib-sub-destroy {
  color: #c0c4cc;
  cursor: pointer;
  font-size: 11px;
  margin-left: 2px;
}
.lib-sub-destroy:hover {
  color: #f56c6c;
}
:deep(.lib-row-off) {
  color: #a8b6c4;
  text-decoration: line-through;
}
:deep(.lib-row-off td) {
  background: #fafbfc !important;
}
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
/* 长文本编辑域:加宽 + 自适应高度(autosize);换行不断词 */
.lib-custom-form .lib-wide {
  width: 460px;
}
.lib-custom-form .lib-wide .el-textarea__inner {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
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

/* 字段编辑弹窗列表(普通 v-for,不用 el-table 避免响应性问题) */
.fe-list {
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 4px 0;
}
.fe-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-bottom: 1px solid #f0f0f0;
}
.fe-row:last-child {
  border-bottom: none;
}
.fe-key {
  flex: none;
  width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: #606266;
}
.fe-label {
  flex: none;
  width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: #909399;
}
.fe-alias {
  flex: 1;
  min-width: 120px;
}
.fe-vis {
  flex: none;
}

/* 字段编辑按钮样式已并入全局 .rs-tool(2026-10-17 三个纸面小入口统一成一种样式,见 styles/index.css) */

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
/* 复选格(变更申请单 性质/变更文件):方框横排,不撑破单元格 */
.rs-checks {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  align-items: center;
  min-height: 24px;
}
.rs-checks :deep(.el-checkbox) {
  margin-right: 0;
  height: 22px;
}
/* 非本部门栏目(行级门禁):灰底 + 灰字,提示"这行不是你的" */
.rsp-locked {
  background: #f5f7fa;
  color: #909399;
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
/* 公司名(第 ① 带):位置/高度由模板绑定 COVER_COMPANY_TOP/H 给出,此处只放外观 */
.rsp-cover-company {
  position: absolute;
  left: calc(44px * var(--cok));
  display: flex;
  align-items: center;
  font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;
  font-size: calc(20.7px * var(--cok));
  line-height: 1;
  color: #000;
  white-space: nowrap;
}
/* 编号格(第 ① 带**右端**):位置/高度由模板绑定 COVER_COMPANY_TOP/H 给出(与公司名同带)。
   设计原文即「公司左上 + 编号右上」,故右端边距取与公司名左端对称的 44px。
   字号取 15px(公司名 20.7px 的下一档):既比公司名弱一级,又保证「编号：DEMO-B-001」这类
   10 位编号在一行内看得清。横向只随 coverK 缩放(与字号同一套比例),不做纵向拉伸。 */
.rsp-cover-docno {
  position: absolute;
  right: calc(44px * var(--cok));
  display: flex;
  align-items: center;
  gap: calc(2px * var(--cok));
  font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;
  font-size: calc(15px * var(--cok));
  line-height: 1;
  color: #000;
  white-space: nowrap;
}
.rsp-cover-docno-lb { flex: none; }
.rsp-cover-docno-val { font-variant-numeric: tabular-nums; }
/* 编辑态输入框:宽度按设计 px 缩放,不随内容跳动(避免值长短变化把整格左右晃) */
.rsp-cover-docno-in { width: calc(170px * var(--cok)); flex: none; }
.rsp-cover-docno-in :deep(.el-input__wrapper) { padding: 0 calc(4px * var(--cok)); }
.rsp-cover-docno-in :deep(.el-input__inner) {
  height: calc(22px * var(--cok));
  font-size: calc(15px * var(--cok));
  font-variant-numeric: tabular-nums;
}
/* 封面「产品编号」的引用控件(2026-10-21):观感沿用纸面其它参照格(虚线框 + 右侧放大镜),
   但尺寸全部按封面 --cok 缩放 —— 封面整页是按 A4 等比缩放的画布,和纸内表格用的
   24px/12.5px 那套不是同一个坐标系,直接搬会把公司名那一带顶掉。
   宽度给下限而不定死:产品编号 00011/PI-2026-10-0002 长短差很大,定死会来回跳。 */
.rsp-cover-docno-pick {
  display: flex;
  align-items: center;
  gap: calc(4px * var(--cok));
  min-width: calc(126px * var(--cok));
  height: calc(22px * var(--cok));
  padding: 0 calc(4px * var(--cok));
  border: 1px dashed #b9c0c8;
  border-radius: calc(3px * var(--cok));
  background: #fafbfc;
  cursor: pointer;
}
.rsp-cover-docno-pick:hover {
  border-color: var(--el-color-primary, #409eff);
  background: #f0f6ff;
}
/* 产品编号搬进封面字段表后(2026-10-28),引用控件改用**整格宽**、去掉右上角那套固定尺寸:
   右上角是窄带里的独立控件(定 min-width 防抖),值格里则应铺满单元格,与其它行的输入框观感一致。 */
.rsp-cover-vl-pick {
  width: 100%;
  min-width: 0;
  justify-content: space-between;
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: calc(27.3px * var(--cok));
}
/* 引用产品信息表弹窗(2026-10-21):提示行/表体/底注三段的排布,与文件里其它弹窗同款 */
.pp-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.pp-tip { font-size: 12px; color: #909399; }
/* 从商品引用弹窗(2026-10-21):四栏筛选横排在一行(空间不够自动换行),每栏一个标签 + 下拉。
   没有这段样式时 .gp-filter 是块级元素 ⇒ 四个下拉各占一整行,弹窗又高又难扫。 */
.gp-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 10px;
}
.gp-filter { display: flex; align-items: center; gap: 6px; }
.gp-filter-label { font-size: 12px; color: #606266; white-space: nowrap; }
.gp-filter-select { width: 190px; }
.gp-more { font-size: 11px; color: #c0c4cc; }
.pp-foot { margin-top: 6px; font-size: 12px; color: #909399; }
/* 行的三种态:已开发(不可选,压灰)/ 当前待引用(高亮)/ 普通。
   ⚠ 必须走 .pp-body :deep(...) —— el-table 的行由组件自己渲染,拿不到本组件的
   data-v 属性,直接写 .pp-row-used 在 scoped 样式里永远命中(踩过这个坑)。 */
.pp-body :deep(.pp-row-used) { color: #a8abb2; cursor: not-allowed; }
.pp-body :deep(.pp-row-used:hover > td) { background: transparent !important; }
.pp-body :deep(.pp-row-picked > td) {
  background: #ecf5ff !important;
  box-shadow: inset 0 0 0 9999px rgba(64, 158, 255, 0.06);
}
/* 大标题(第 ② 带):位置/高度由模板绑定 COVER_TITLE_TOP/H 给出。
   设计里公司名与标题是**上下两行**(B5 / B6);早期误把两者放同一条带
   ⇒ 居中标题(3 字 × 47.3 = 186px,占 x268..499)压住公司名(x44..313)末尾 45px。
   标题水平居中于画布中线。 */
.rsp-cover-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: calc(47.3px * var(--cok));
  font-weight: 400;
  letter-spacing: calc(-1.33px * var(--cok));
  color: #111;
  line-height: 1;
  white-space: nowrap;
}
/* 字段表 + 签字栏的**居中定位层**:只负责水平居中,不管宽度 */
.rsp-cover-block {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
/* **按内容定宽层**:inline-block 由内容撑开(表内单元格 nowrap),
   签字表 width:100% 跟随它 ⇒ 两表同宽。
   ⚠ 这里(以及 .rsp-cover-block)都**不要**用 width:max-content:
     与子元素的 width:100% 构成循环依赖,会把整块塌成空(边框在、文字不渲染)。 */
.rsp-cover-blockin {
  display: inline-block;
}
/* 字段表:两列**由内容定宽**(table-layout:auto + 标签 nowrap)。
   ⚠ 三条纪律,别退回:
   ① 不要再给固定列宽 —— 手算像素总有余量不足的风险(曾给标签列 178px,而「客户项目名称」
      实际渲染约 176px+,仅 2px 余量 ⇒ 字压到值格上 = 用户看到的**字段重叠**);
   ② 标签必须 nowrap,否则浏览器为省宽度把标签折行,行高变化破坏"9 行等高"的版式;
   ③ 整表的居中由外层 .rsp-cover-block 负责,本表不要自己再定位/居中。 */
.rsp-cover-fields {
  border-collapse: collapse;
  /* 2026-10-21 用户口径:「有一些数据写太长了之后产品规格书这个面板就会撑得很宽,
     应该是宽度固定下来,数据太长就直接换行」。
     ⚠ 第一版写成 table-layout:fixed + 标签列 24% / 值列 76%,**结果标签和值重叠**
       (用户看到「产品类别」压着「测试」):封面容器实测只有 ~397px,不是设计稿的 767px
       (画布按 A4 等比缩放后,字段表所在块的可用宽更窄),24% ≈ 95px 装不下 27px 字号的
       「客户项目名称」(≈164px),而标签是 nowrap ⇒ 直接溢出压到值格里。
     正解:**保持 table-layout:auto**(标签列按最宽标签内容自适应,永不重叠),
       只给值列 width:100% —— 剩余宽度它全吃掉,配合格内换行就不会再撑宽整张表。
       这是表格里「一列自适应、一列吃剩余」的经典写法,不依赖容器绝对宽度。 */
  table-layout: auto;
  width: 100%;
  /* 2026-10-28 用户口径③「把产品规格书的表格做宽一点点，现在看起来有一点窄了」:
     此前整表宽度**只由内容撑开**(inline-block 父层),而封面容器实测比设计画布窄得多
     ⇒ 内容一短表就跟着缩,看着窄。给一个下限(设计值,随 --cok 缩放)把表撑到设计比例;
     ⚠ 不用 width 写死,仍是 min-width —— 内容更宽时照旧自适应,不会反过来压窄标签。
     ⚠ 保持 table-layout:auto(见上方注释:fixed + 百分比会把标签压到值格上)。 */
  min-width: calc(620px * var(--cok));
}
/* 行高 = 设计 B7..B15 的 46 设计px(9 行等高)。table 上设 height 对行不生效,必须设在 tr 上。
   ⚠ 这里 height 在 CSS 表格里是**下限**(内容更高时行会长高)—— 换行后行变高是预期行为,
   签字栏跟着字段表往下走(同一文档流),不会被盖住。 */
.rsp-cover-fields tr {
  height: calc(46px * var(--cvy));
}
.rsp-cover-lb,
.rsp-cover-vl {
  border: calc(1.4px * var(--cok)) solid #000;
  vertical-align: middle;
  padding: 0 calc(8px * var(--cok));
}
/* 标签列:居中(设计 B 列即居中);**宽度由内容决定**(auto 布局),nowrap 保证标签不折行。
   ⚠ 不要在这里写百分比宽度 —— 容器宽度会随画布缩放变化,写死必重叠。 */
.rsp-cover-lb {
  text-align: center;
  font-family: 'SimSun', 'Songti SC', serif;
  font-size: calc(27.3px * var(--cok));
  color: #111;
  white-space: nowrap;
}
/* 值列:吃掉标签列之外的剩余宽度;**长文本在格内换行**,不再横向撑开整张表 */
.rsp-cover-vl {
  width: 100%;
  text-align: left;
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}
.rsp-cover-input {
  width: 100%;
  height: calc(38px * var(--cvy));
}
/* 编辑态封面输入框:覆盖 size=small 的 24px 内高(35px 字在 24px 盒里会被削成半截字),
   并去掉 wrapper 默认左右 11px 内边距与灰边(只读态是纯 span 无边框,编辑态同口径) */
.rsp-cover-input :deep(.el-input__wrapper) {
  padding: 0;
  box-shadow: none;
  background: transparent;
  border-radius: 0;
}
.rsp-cover-input :deep(.el-input__inner) {
  height: calc(38px * var(--cvy));
  font-size: calc(27.3px * var(--cok));
  font-family: 'SimSun', 'Songti SC', serif;
  line-height: calc(38px * var(--cvy));
  padding: 0;
}
/* 只读值:设计正文 宋体 20.5pt ≈ 27.3 设计px(与标签列同号) */
.rsp-cover-val {
  font-size: calc(27.3px * var(--cok));
  line-height: 1.15;
  font-family: 'SimSun', 'Songti SC', serif;
  color: #1a1a1a;
}
/**
 * 只读值的字号档位 **已于 2026-10-21 停用**(见 coverValClass 注释):
 * 封面改成固定列宽 + 格内换行后,长文本不再撑宽画布,也就不必把字压到 9.5px。
 * 这里只保留一个通用兜底:极端长串也保证在格内折行,不允许溢出单元格。
 */
.rsp-cover-val {
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}
.rsp-cover-val.rsp-cv-1 { font-size: calc(20px * var(--cok)); }
.rsp-cover-val.rsp-cv-2 { font-size: calc(15px * var(--cok)); }
.rsp-cover-val.rsp-cv-3 { font-size: calc(11px * var(--cok)); }
.rsp-cover-val.rsp-cv-4 {
  font-size: calc(9.5px * var(--cok));
  line-height: 1.12;
}
/* 签名表:width:100% 跟随 .rsp-cover-blockin ⇒ 与字段表同宽、左右边界对齐;
   与字段表之间的垂直间隔 = margin-top,由模板按 COVER_SIGN_TOP/ROW_H 算出(设计 y520→y605 = 85px),
   不要在这里写死 85px —— 与常量分开两处会漂移。 */
.rsp-sign-t {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  position: relative;
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
.rsp-sign-input :deep(.el-input__wrapper) {
  padding: 0 2px;
  box-shadow: none;
  background: transparent;
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
.mp-kids {
  padding: 4px 8px 4px 32px;
  background: #fafbfc;
}
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
/* 规格书变动:警示色 + 可换行(文案里有项目清单,窄屏不能撑破表头) */
.rs-drift-btn {
  color: #b88230;
  border-color: #e6c07a;
  background: #fdf6ec;
  max-width: 100%;
  white-space: normal;
  line-height: 1.5;
  text-align: left;
}
.rs-drift-btn:hover {
  background: #faecd8;
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

/* 标准库型列的表头维护入口(2026-10-19 检查频率下拉) */
.rs-lib-pick { margin-left: 4px; color: #2f6bff; cursor: pointer; font-weight: 700; }
.rs-lib-pick:hover { text-decoration: underline; }
</style>

<!-- 打印/导出整张文书:只保留文书纸张,隐藏布局菜单/侧栏/其它页面元素 -->
<style>
/* 标准库维护入口:屏幕可见,打印不出现(纸张上不留"标准库"字样) */
.no-print { }
@media print { .no-print, .rs-lib-btn { display: none !important; } }
.stdlib-tip { font-size: 12px; color: #8ba6bd; margin-bottom: 8px; line-height: 1.6; }
.stdlib-add { display: flex; gap: 8px; margin-bottom: 10px; }
.stdlib-list { max-height: 320px; overflow: auto; border: 1px solid #e4edf5; border-radius: 4px; }
.stdlib-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #f0f4f8; font-size: 13px; }
.stdlib-item:last-child { border-bottom: none; }
.stdlib-item-text { flex: 1; word-break: break-all; }
.stdlib-del { cursor: pointer; color: #c45656; padding: 0 4px; font-size: 16px; line-height: 1; }
.stdlib-empty { padding: 18px; text-align: center; color: #a8b6c4; font-size: 13px; }
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
  body.approval-printing .rs-op-del,
  body.approval-printing .rs-tool,
  body.approval-printing .rsp-lib-pick,
  body.approval-printing .rs-lib-btn,
  /* 产品开发状态角标(未开发/已开发)属界面辅助信息,打印/导出不出现 */
  body.approval-printing .rs-dev-badge {
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
  /* 兜底:不经「打印」按钮直接 Ctrl+P 时,同样不打印产品开发状态角标 */
  .rs-dev-badge {
    display: none !important;
  }
}
</style>
