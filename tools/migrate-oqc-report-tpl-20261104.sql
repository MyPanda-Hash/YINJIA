/* migrate-oqc-report-tpl-20261104.sql(2026-11-04):出厂检验报告(QC_OQC_REPORT)**报表模板入库**。
 *
 * 任务来源:task-3「出厂检验报告报表:去页脚/签署落值 + 模板入库迁移(导出报表设定)」。
 * 用户 2026-11-04 口径:
 *   ① 报表模板 backend/src/main/resources/reports/qc_oqc.jrxml 去掉页脚里的公司地址/网址/邮箱/电话
 *      那一行(红框内容);
 *   ② 签署行 审核/批准 由静态下划线改为按头字段值落值(审核人=一级审批人,审批人=超级管理员/二级);
 *   ③ 把该模板「设定」进导出报表机制:写入 yj_report_template(DB 优先,模板管理可见),
 *      彻底避免「没设定时回落到通用错误格式」。
 *
 * 本 SQL 的 XML 正文由 tools/archive/_gen-oqc-tpl-sql.mjs 从
 *   backend/src/main/resources/reports/qc_oqc.jrxml
 * 逐字节生成(仅做 T-SQL 单引号转义),**勿手改本文件**;改版式请改 .jrxml 后重跑生成器。
 * 仓库 .jrxml 是部署源(新装/兜底),库内行是运行源(DB 优先,立即生效),两者必须同源。
 *
 * 幂等:MERGE on template_code(N'qc_oqc');两账套(HSDZ_MES / HSDZ_MES_TEST)均执行。
 * 源文件:31292 字符(LF 归一后),单引号 4 处(已按 T-SQL 规则转义)。
 * 行尾:DbSync 按行切批再以 LF 重组 ⇒ 库内 jrxml_text 为 LF;本文件正文也按 LF 生成,
 *   自检 LEN 期望值 = 31292(若拿工作区 CRLF 检出后的文件长度比,会多出每行一个 CR —— 本机实测 +440)。
 *
 * 🔴 **INSERT 分支也必须写 update_at**(ADR-0002 踩坑记录,制程检验记录表改版时实测):
 *   ReportService.compile() 的编译缓存判据含 update_at;库里模板行 update_at 为 NULL 时,
 *   进程一旦编译过一次(哪怕编译的是 classpath 旧模板),此后改库不生效(实测导出字节都不变)。
 *   所以两条分支都写 SYSDATETIME(),让 update_at 非空、缓存按它/正文哈希失效。
 */

MERGE yj_report_template AS t
USING (VALUES (N'qc_oqc', N'QC_OQC_REPORT', N'出厂检验报告', N'<?xml version="1.0" encoding="UTF-8"?>
<!-- ============================================================================
     qc_oqc.jrxml — 出厂检验报告(QC_OQC_REPORT,2026-11-01)
     受控表单:c-95-12,表单编号 YJ-QR-05/A1(用户原件见 tools/archive/_oqc-form-20261101/)
     ============================================================================
     取数(ReportService 通用分支,**不改 Java**):
       JasperFillManager.fillReport(compile(tpl), headParams(doc, docNo),
                                    new JRMapCollectionDataSource(detailRows))
       · 参数 = 头字段 label(中文名):单据编号/单据日期/客户名称/产品编码/产品名称/规格型号/
         批次号/生产日期/生产数量/检测日期/AQL/检验员/审核人/审批人/检验结论/备注 + 打印时间;
         日期字段经 QueryService.dateWallText 已是 ''yyyy-MM-dd'' 文本,生产数量是 BigDecimal。
       · 数据源字段 = 明细 label:序号/检验项目/检验要求/检验方法/抽样标准/抽检量/测量值1..5/
         结果/判定/数据来源/来源项目名/是否手填/行号。抽样标准/抽检量为手填,当前可能为 NULL。
       · 参数 class 一律 java.lang.Object(原始值可能是 String/BigDecimal,Object 最稳)。
     ============================================================================
     版式(照原件 A4 纵向;列宽 = 原件 twips/20 四舍五入到整磅;原内容宽 558.45pt → 558pt):
       ① title 带 = 首页全部抬头:AGPLUS logo + 公司名 + 横线 + 标题 + 编制日期(单据日期)
          + 抬头 9 格(客户名/报告编号/产品名称/产品规格/生产日期/生产量/检测日期/AQL/产品编码)
          + 主表 7 列表头(序号|检验项目|检验要求|抽样标准|抽检量|结果|判定;只在第 1 页打,与原件一致)
       ② pageHeader 带 = 第 2 页起的页眉(logo + 公司名 + 横线),printWhenExpression=PAGE_NUMBER>1;
          首页抬头在 title 带里,故首页不重复(实测:band 的 printWhenExpression=false 不占高度)
       ③ detail 带 = 明细逐行;检验要求/结果长文本 textAdjust="StretchHeight" 自动撑高,
          全行 7 格 stretchType="RelativeToTallestObject" 等高对齐(边框连续成表);splitType=Prevent 整行不拆
       ④ group reportTail(表达式 Boolean.TRUE,效果=表尾一次)= groupFooter 里一整套表尾:
          检验结论+备注 / 卫生安全 15 项表 / 签署行(检验员=编制、审核=一级审批人、批准=二级审批人;
          三格全按头字段动态落值,空则印下划线占位) + YJ-QR-05/A1。
          为什么不用 summary：JR 6.21 里 summary 单独起页时**不打印 pageHeader**(实测),第 2 页会丢 logo 页眉;
          groupFooter 起的续页会正常打印页眉,与原件第 2 页一致。
       ⑤ pageFooter 带 = 打印时间 + 页码(第 X 页 / 共 Y 页 紧邻,不拉到纸两端)。
          2026-11-04 用户口径:去掉红框内的页脚内容 ⇒ 原「公司地址/网址/邮箱/电话」整行删除,
          打印时间与页码上移到 band 顶部 y=0;band 高度保持 90 不变(避免整单分页变化)。
     卫生安全表:项目/卫生要求为静态文字;**结果列 = qc_oqc_head.卫生_<项目> 15 个可填列**
       (2026-11-01 用户口径「这些红框内容要能填写」;空=未录,纸面留空,不把样张里的 0.12/1.79/ND 假值充数)。
     数据行为空(如尚未录入实测值)时各格留空,不打印 null。
     ============================================================================ -->
<jasperReport xmlns="http://jasperreports.sourceforge.net/jasperreports"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
              xsi:schemaLocation="http://jasperreports.sourceforge.net/jasperreports http://jasperreports.sourceforge.net/xsd/jasperreport.xsd"
              name="qc_oqc" language="java" columnCount="1"
              pageWidth="595" pageHeight="842" orientation="Portrait"
              columnWidth="559" leftMargin="18" rightMargin="18" topMargin="0" bottomMargin="0"
              whenNoDataType="AllSectionsNoDetail"
              uuid="b7e4c1a2-9f3d-4e6b-8c1d-2a5f7e9b0c31">

  <property name="net.sf.jasperreports.awt.ignore.missing-font" value="false"/>
  <property name="net.sf.jasperreports.default.font.name" value="NotoSansSC"/>
  <property name="net.sf.jasperreports.export.xlsx.detect.cell.type" value="true"/>

  <!-- 样式:字号/对齐/边框集中定义(笔宽 0.5,与原件 0.48pt 线一致) -->
  <style name="base" isDefault="true" fontName="NotoSansSC" fontSize="9"/>
  <!-- 抬头 9 格:12pt 左对齐;padding 0 + 左内边距 5(原件单元格左边距约 5pt) -->
  <style name="gridLabel" style="base" fontSize="12" hAlign="Left" vAlign="Middle">
    <box padding="0" leftPadding="5"><pen lineWidth="0.5"/></box>
  </style>
  <style name="gridValue" style="base" fontSize="12" hAlign="Left" vAlign="Middle">
    <box padding="0" leftPadding="5"><pen lineWidth="0.5"/></box>
  </style>
  <!-- 主表:表头 11pt 居中;数据格 11pt,padding 1(单行行高约 16~17pt,贴近原件 16.1pt) -->
  <style name="th" style="base" fontSize="11" hAlign="Center" vAlign="Middle">
    <box padding="2"><pen lineWidth="0.5"/></box>
  </style>
  <style name="cell" style="base" fontSize="11" hAlign="Center" vAlign="Middle">
    <box padding="1"><pen lineWidth="0.5"/></box>
  </style>
  <style name="cellL" style="cell" hAlign="Left">
    <box padding="1" leftPadding="4"><pen lineWidth="0.5"/></box>
  </style>
  <!-- 结论 / 备注 -->
  <style name="conclLabel" style="base" fontSize="11" hAlign="Center" vAlign="Middle">
    <box padding="1"><pen lineWidth="0.5"/></box>
  </style>
  <style name="conclValue" style="base" fontSize="11" hAlign="Center" vAlign="Middle">
    <box padding="1"><pen lineWidth="0.5"/></box>
  </style>
  <style name="noteValue" style="base" fontSize="11" hAlign="Left" vAlign="Top">
    <box padding="2" leftPadding="5"><pen lineWidth="0.5"/></box>
  </style>
  <!-- 卫生安全表:12pt -->
  <style name="sqHead" style="base" fontSize="12" hAlign="Center" vAlign="Middle">
    <box padding="0"><pen lineWidth="0.5"/></box>
  </style>
  <style name="sqCell" style="base" fontSize="12" hAlign="Center" vAlign="Middle">
    <box padding="0"><pen lineWidth="0.5"/></box>
  </style>
  <!-- 无边框文字 -->
  <style name="company" style="base" fontSize="12" vAlign="Middle"/>
  <style name="docTitle" style="base" fontSize="22" hAlign="Center" vAlign="Middle"/>
  <style name="metaR" style="base" fontSize="12" hAlign="Right" vAlign="Middle"/>
  <style name="sectTitle" style="base" fontSize="12" hAlign="Left" vAlign="Middle"/>
  <style name="sign" style="base" fontSize="12" hAlign="Left" vAlign="Middle"/>
  <style name="signR" style="base" fontSize="12" hAlign="Right" vAlign="Middle"/>
  <style name="pager" style="base" fontSize="9" hAlign="Left" vAlign="Middle" forecolor="#555555"/>
  <style name="pagerR" style="pager" hAlign="Right"/>

  <!-- 参数 = 头字段 label(中文名,ReportService.headParams 原样下发)
       class 用 Object:日期已被 QueryService 转成 String(''yyyy-MM-dd''),生产数量是 BigDecimal,
       BigDecimal 用 textField 的 pattern 格式化,其余用 String.valueOf 输出。 -->
  <parameter name="单据编号" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="单据日期" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="客户名称" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="产品编码" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="产品名称" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="规格型号" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="批次号" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="生产日期" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="生产数量" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="检测日期" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="AQL" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="出库单号" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="成品检验单号" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="首件检验单号" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="制程检验单号" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="检验员" class="java.lang.Object" isForPrompting="false"/>
  <!-- 两级审批签署值(2026-11-04):审核人 = 一级审批通过的人,审批人 = 二级批准(超级管理员)。
       ReportService.headParams 把全部头字段 label 转为参数 ⇒ yj_field 注册这两列后自动有值;
       未提交/未审批时为空 ⇒ 下方签署行印下划线占位。
       (参数名必须与 yj_field.label 完全一致,否则取不到值。) -->
  <parameter name="审核人" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="审批人" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="检验结论" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="备注" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="单据状态" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「浑浊度」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_浑浊度" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「臭和味」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_臭和味" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「肉眼可见物」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_肉眼可见物" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「PH」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_PH" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「溶解性总固体」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_溶解性总固体" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「耗氧量」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_耗氧量" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「砷」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_砷" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「铬」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_铬" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「铝」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_铝" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「铅」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_铅" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「汞」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_汞" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「铁」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_铁" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「锰」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_锰" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「铜」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_铜" class="java.lang.Object" isForPrompting="false"/>
  <!-- 卫生安全「锌」结果(2026-11-01 起可填写,手工录入;空=未录,纸面留空) -->
  <parameter name="卫生_锌" class="java.lang.Object" isForPrompting="false"/>
  <parameter name="打印时间" class="java.lang.Object" isForPrompting="false"/>

  <!-- 数据源字段 = 明细 label(中文名;ReportService.detailRows 原样下发) -->
  <field name="序号" class="java.lang.Integer"/>
  <field name="检验项目" class="java.lang.String"/>
  <field name="检验要求" class="java.lang.String"/>
  <field name="抽样标准" class="java.lang.String"/>
  <field name="抽检量" class="java.lang.String"/>
  <field name="结果" class="java.lang.String"/>
  <field name="判定" class="java.lang.String"/>

  <group name="reportTail">
    <groupExpression><![CDATA[Boolean.TRUE]]></groupExpression>
    <groupFooter>
  <band height="377" splitType="Prevent">
        <staticText><reportElement style="conclLabel" x="0" y="0" width="94" height="18"/><text><![CDATA[检验结论]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="conclValue" x="94" y="0" width="464" height="18"/>
          <textFieldExpression><![CDATA[$P{检验结论} == null ? "" : String.valueOf($P{检验结论})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="conclLabel" x="0" y="18" width="94" height="18" stretchType="RelativeToTallestObject"/><text><![CDATA[备注]]></text></staticText>
        <textField textAdjust="StretchHeight" isBlankWhenNull="true">
          <reportElement style="noteValue" x="94" y="18" width="464" height="18" stretchType="RelativeToTallestObject"/>
          <textFieldExpression><![CDATA[$P{备注} == null ? "" : String.valueOf($P{备注})]]></textFieldExpression>
        </textField>
        <staticText>
          <reportElement style="sectTitle" x="51" y="38" width="440" height="17"/>
          <text><![CDATA[按《生活饮用水输配水设备及防护材料卫生安全评价规范》]]></text>
        </staticText>
  
        <!-- 表头(列宽 = 原件 twips/20:2453/4894/2039 → 123/245/102,左边界 46) -->
        <staticText><reportElement style="sqHead" x="46" y="69" width="123" height="18"/><text><![CDATA[项目]]></text></staticText>
        <staticText><reportElement style="sqHead" x="169" y="69" width="245" height="18"/><text><![CDATA[卫生要求]]></text></staticText>
        <staticText><reportElement style="sqHead" x="414" y="69" width="102" height="18"/><text><![CDATA[结果]]></text></staticText>
  
        <!-- 15 行(项目/卫生要求静态;结果取 $P{卫生_<项目>},空则留空 —— 2026-11-01 起可填写) -->
        <staticText><reportElement style="sqCell" x="46" y="87" width="123" height="16"/><text><![CDATA[浑浊度]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="87" width="245" height="16"/><text><![CDATA[增加量≤0.2NTU]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="87" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_浑浊度} == null ? "" : String.valueOf($P{卫生_浑浊度})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="103" width="123" height="16"/><text><![CDATA[臭和味]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="103" width="245" height="16"/><text><![CDATA[浸泡后水无异臭、异味]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="103" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_臭和味} == null ? "" : String.valueOf($P{卫生_臭和味})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="119" width="123" height="16"/><text><![CDATA[肉眼可见物]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="119" width="245" height="16"/><text><![CDATA[浸泡后水不产生任何肉眼可见的碎片杂物等]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="119" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_肉眼可见物} == null ? "" : String.valueOf($P{卫生_肉眼可见物})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="135" width="123" height="16"/><text><![CDATA[PH]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="135" width="245" height="16"/><text><![CDATA[改变量≤0.5]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="135" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_PH} == null ? "" : String.valueOf($P{卫生_PH})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="151" width="123" height="16"/><text><![CDATA[溶解性总固体]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="151" width="245" height="16"/><text><![CDATA[/]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="151" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_溶解性总固体} == null ? "" : String.valueOf($P{卫生_溶解性总固体})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="167" width="123" height="16"/><text><![CDATA[耗氧量（以O2计）]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="167" width="245" height="16"/><text><![CDATA[增加量≤1 mg/L]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="167" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_耗氧量} == null ? "" : String.valueOf($P{卫生_耗氧量})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="183" width="123" height="16"/><text><![CDATA[砷]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="183" width="245" height="16"/><text><![CDATA[增加量≤0.001 mg/L]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="183" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_砷} == null ? "" : String.valueOf($P{卫生_砷})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="199" width="123" height="16"/><text><![CDATA[铬]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="199" width="245" height="16"/><text><![CDATA[增加量≤0.005 mg/L]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="199" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_铬} == null ? "" : String.valueOf($P{卫生_铬})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="215" width="123" height="16"/><text><![CDATA[铝]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="215" width="245" height="16"/><text><![CDATA[增加量≤0.02 mg/L]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="215" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_铝} == null ? "" : String.valueOf($P{卫生_铝})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="231" width="123" height="16"/><text><![CDATA[铅]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="231" width="245" height="16"/><text><![CDATA[增加量≤0.001 mg/L]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="231" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_铅} == null ? "" : String.valueOf($P{卫生_铅})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="247" width="123" height="16"/><text><![CDATA[汞]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="247" width="245" height="16"/><text><![CDATA[增加量≤0.0001 mg/L]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="247" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_汞} == null ? "" : String.valueOf($P{卫生_汞})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="263" width="123" height="16"/><text><![CDATA[铁]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="263" width="245" height="16"/><text><![CDATA[增加量≤0.06 mg/L]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="263" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_铁} == null ? "" : String.valueOf($P{卫生_铁})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="279" width="123" height="16"/><text><![CDATA[锰]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="279" width="245" height="16"/><text><![CDATA[增加量≤0.02 mg/L]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="279" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_锰} == null ? "" : String.valueOf($P{卫生_锰})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="295" width="123" height="16"/><text><![CDATA[铜]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="295" width="245" height="16"/><text><![CDATA[增加量≤0.2 mg/L]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="295" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_铜} == null ? "" : String.valueOf($P{卫生_铜})]]></textFieldExpression>
        </textField>
        <staticText><reportElement style="sqCell" x="46" y="311" width="123" height="16"/><text><![CDATA[锌]]></text></staticText>
        <staticText><reportElement style="sqCell" x="169" y="311" width="245" height="16"/><text><![CDATA[增加量≤0.2 mg/L]]></text></staticText>
        <textField isBlankWhenNull="true">
          <reportElement style="sqCell" x="414" y="311" width="102" height="16"/>
          <textFieldExpression><![CDATA[$P{卫生_锌} == null ? "" : String.valueOf($P{卫生_锌})]]></textFieldExpression>
        </textField>
        <!-- 签署行(2026-11-04 用户口径):检验员=编制(提交审批时后端自动写提交人,元数据 editable=0 ⇒ 只读)、
             审核=一级审批人、批准=超级管理员(二级通过才落值);空(未提交/未审批)印下划线占位。
             三格都是头字段动态落值,参数见上方 $P{检验员}/$P{审核人}/$P{审批人}。 -->
        <textField>
          <reportElement style="sign" x="51" y="329" width="186" height="17"/>
          <textFieldExpression><![CDATA["检验员：" + ($P{检验员} == null || String.valueOf($P{检验员}).isBlank() ? "________________" : String.valueOf($P{检验员}))]]></textFieldExpression>
        </textField>
        <textField>
          <reportElement style="sign" x="237" y="329" width="162" height="17"/>
          <textFieldExpression><![CDATA["审核：" + ($P{审核人} == null || String.valueOf($P{审核人}).isBlank() ? "________________" : String.valueOf($P{审核人}))]]></textFieldExpression>
        </textField>
        <textField>
          <reportElement style="sign" x="399" y="329" width="159" height="17"/>
          <textFieldExpression><![CDATA["批准：" + ($P{审批人} == null || String.valueOf($P{审批人}).isBlank() ? "________________" : String.valueOf($P{审批人}))]]></textFieldExpression>
        </textField>
        <textField>
          <reportElement style="signR" x="418" y="360" width="78" height="17"/>
          <textFieldExpression><![CDATA["YJ-QR-05/A1"]]></textFieldExpression>
        </textField>
      </band>
    </groupFooter>
  </group>

  <!-- ========================= ① 首页抬头(仅第 1 页) ========================= -->
  <title>
    <band height="224">
      <image scaleImage="RetainShape" onErrorType="Blank">
        <reportElement x="51" y="37" width="129" height="29"/>
        <imageExpression><![CDATA[net.sf.jasperreports.engine.util.JRResourcesUtil.findClassLoaderResource("reports/logo_agplus.jpg", java.lang.Thread.currentThread().getContextClassLoader())]]></imageExpression>
      </image>
      <textField>
        <reportElement style="company" x="185" y="53" width="374" height="16"/>
        <textFieldExpression><![CDATA["AGplus Technologies Pte Ltd.   惠州市银嘉环保科技有限公司"]]></textFieldExpression>
      </textField>
      <line>
        <reportElement x="49" y="69" width="439" height="1"/>
        <graphicElement><pen lineWidth="0.6" lineColor="#333333"/></graphicElement>
      </line>

      <textField>
        <reportElement style="docTitle" x="0" y="75" width="558" height="28"/>
        <textFieldExpression><![CDATA["出厂检验报告"]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="metaR" x="0" y="105" width="487" height="16"/>
        <textFieldExpression><![CDATA["编制日期：" + ($P{单据日期} == null ? "" : String.valueOf($P{单据日期}))]]></textFieldExpression>
      </textField>

      <!-- 抬头 9 格:行高 16(原件 16.1pt);列边界 = 主表列宽累计 94/254/354 -->
      <!-- R0 客户名 | 报告编号 -->
      <staticText><reportElement style="gridLabel" x="0" y="123" width="94" height="16"/><text><![CDATA[客户名]]></text></staticText>
      <textField isBlankWhenNull="true"><reportElement style="gridValue" x="94" y="123" width="160" height="16"/><textFieldExpression><![CDATA[$P{客户名称} == null ? "" : String.valueOf($P{客户名称})]]></textFieldExpression></textField>
      <staticText><reportElement style="gridLabel" x="254" y="123" width="100" height="16"/><text><![CDATA[报告编号]]></text></staticText>
      <textField isBlankWhenNull="true"><reportElement style="gridValue" x="354" y="123" width="204" height="16"/><textFieldExpression><![CDATA[$P{单据编号} == null ? "" : String.valueOf($P{单据编号})]]></textFieldExpression></textField>
      <!-- R1 产品名称 | 产品规格 -->
      <staticText><reportElement style="gridLabel" x="0" y="139" width="94" height="16"/><text><![CDATA[产品名称]]></text></staticText>
      <textField isBlankWhenNull="true"><reportElement style="gridValue" x="94" y="139" width="160" height="16"/><textFieldExpression><![CDATA[$P{产品名称} == null ? "" : String.valueOf($P{产品名称})]]></textFieldExpression></textField>
      <staticText><reportElement style="gridLabel" x="254" y="139" width="100" height="16"/><text><![CDATA[产品规格]]></text></staticText>
      <textField isBlankWhenNull="true"><reportElement style="gridValue" x="354" y="139" width="204" height="16"/><textFieldExpression><![CDATA[$P{规格型号} == null ? "" : String.valueOf($P{规格型号})]]></textFieldExpression></textField>
      <!-- R2 生产日期 | 生产量 -->
      <staticText><reportElement style="gridLabel" x="0" y="155" width="94" height="16"/><text><![CDATA[生产日期]]></text></staticText>
      <textField isBlankWhenNull="true"><reportElement style="gridValue" x="94" y="155" width="160" height="16"/><textFieldExpression><![CDATA[$P{生产日期} == null ? "" : String.valueOf($P{生产日期})]]></textFieldExpression></textField>
      <staticText><reportElement style="gridLabel" x="254" y="155" width="100" height="16"/><text><![CDATA[生产量]]></text></staticText>
      <textField isBlankWhenNull="true" pattern="#,##0.####"><reportElement style="gridValue" x="354" y="155" width="204" height="16"/><textFieldExpression><![CDATA[$P{生产数量}]]></textFieldExpression></textField>
      <!-- R3 检测日期 | AQL -->
      <staticText><reportElement style="gridLabel" x="0" y="171" width="94" height="16"/><text><![CDATA[检测日期]]></text></staticText>
      <textField isBlankWhenNull="true"><reportElement style="gridValue" x="94" y="171" width="160" height="16"/><textFieldExpression><![CDATA[$P{检测日期} == null ? "" : String.valueOf($P{检测日期})]]></textFieldExpression></textField>
      <staticText><reportElement style="gridLabel" x="254" y="171" width="100" height="16"/><text><![CDATA[AQL]]></text></staticText>
      <textField isBlankWhenNull="true"><reportElement style="gridValue" x="354" y="171" width="204" height="16"/><textFieldExpression><![CDATA[$P{AQL} == null ? "" : String.valueOf($P{AQL})]]></textFieldExpression></textField>
      <!-- R4 产品编码(整行合并:label 2 列 + value 6 列) -->
      <staticText><reportElement style="gridLabel" x="0" y="187" width="94" height="16"/><text><![CDATA[产品编码]]></text></staticText>
      <textField isBlankWhenNull="true"><reportElement style="gridValue" x="94" y="187" width="464" height="16"/><textFieldExpression><![CDATA[$P{产品编码} == null ? "" : String.valueOf($P{产品编码})]]></textFieldExpression></textField>

      <staticText><reportElement style="th" x="0" y="203" width="35" height="21"/><text><![CDATA[序号]]></text></staticText>
      <staticText><reportElement style="th" x="35" y="203" width="59" height="21"/><text><![CDATA[检验项目]]></text></staticText>
      <staticText><reportElement style="th" x="94" y="203" width="160" height="21"/><text><![CDATA[检验要求]]></text></staticText>
      <staticText><reportElement style="th" x="254" y="203" width="56" height="21"/><text><![CDATA[抽样标准]]></text></staticText>
      <staticText><reportElement style="th" x="310" y="203" width="44" height="21"/><text><![CDATA[抽检量]]></text></staticText>
      <staticText><reportElement style="th" x="354" y="203" width="171" height="21"/><text><![CDATA[结果]]></text></staticText>
      <staticText><reportElement style="th" x="525" y="203" width="33" height="21"/><text><![CDATA[判定]]></text></staticText>
    
    </band>
  </title>

  <!-- ============ ② 第 2 页起的页眉(logo/公司名/横线),首页在 title 带里 ============ -->
  <pageHeader>
    <band height="72">
      <printWhenExpression><![CDATA[$V{PAGE_NUMBER}.intValue() > 1]]></printWhenExpression>
      <image scaleImage="RetainShape" onErrorType="Blank">
        <reportElement x="51" y="37" width="129" height="29"/>
        <imageExpression><![CDATA[net.sf.jasperreports.engine.util.JRResourcesUtil.findClassLoaderResource("reports/logo_agplus.jpg", java.lang.Thread.currentThread().getContextClassLoader())]]></imageExpression>
      </image>
      <textField>
        <reportElement style="company" x="185" y="53" width="374" height="16"/>
        <textFieldExpression><![CDATA["AGplus Technologies Pte Ltd.   惠州市银嘉环保科技有限公司"]]></textFieldExpression>
      </textField>
      <line>
        <reportElement x="49" y="69" width="439" height="1"/>
        <graphicElement><pen lineWidth="0.6" lineColor="#333333"/></graphicElement>
      </line>
    </band>
  </pageHeader>

  <!-- ============ ③ 主表静态表头(每页重复;列宽 = 原件 twips/20) ============ -->

  <!-- ======= ④ 数据行(逐行来自数据源;长文本撑高,整行等高,边框连续) ======= -->
  <detail>
    <band height="17" splitType="Prevent">
      <textField textAdjust="StretchHeight" isBlankWhenNull="true">
        <reportElement style="cell" x="0" y="0" width="35" height="17" stretchType="RelativeToTallestObject"/>
        <textFieldExpression><![CDATA[$F{序号} == null ? "" : String.valueOf($F{序号})]]></textFieldExpression>
      </textField>
      <textField textAdjust="StretchHeight" isBlankWhenNull="true">
        <reportElement style="cell" x="35" y="0" width="59" height="17" stretchType="RelativeToTallestObject"/>
        <textFieldExpression><![CDATA[$F{检验项目} == null ? "" : $F{检验项目}]]></textFieldExpression>
      </textField>
      <textField textAdjust="StretchHeight" isBlankWhenNull="true">
        <reportElement style="cellL" x="94" y="0" width="160" height="17" stretchType="RelativeToTallestObject"/>
        <textFieldExpression><![CDATA[$F{检验要求} == null ? "" : $F{检验要求}]]></textFieldExpression>
      </textField>
      <textField textAdjust="StretchHeight" isBlankWhenNull="true">
        <reportElement style="cell" x="254" y="0" width="56" height="17" stretchType="RelativeToTallestObject"/>
        <textFieldExpression><![CDATA[$F{抽样标准} == null ? "" : $F{抽样标准}]]></textFieldExpression>
      </textField>
      <textField textAdjust="StretchHeight" isBlankWhenNull="true">
        <reportElement style="cell" x="310" y="0" width="44" height="17" stretchType="RelativeToTallestObject"/>
        <textFieldExpression><![CDATA[$F{抽检量} == null ? "" : $F{抽检量}]]></textFieldExpression>
      </textField>
      <textField textAdjust="StretchHeight" isBlankWhenNull="true">
        <reportElement style="cell" x="354" y="0" width="171" height="17" stretchType="RelativeToTallestObject"/>
        <textFieldExpression><![CDATA[$F{结果} == null ? "" : $F{结果}]]></textFieldExpression>
      </textField>
      <textField textAdjust="StretchHeight" isBlankWhenNull="true">
        <reportElement style="cell" x="525" y="0" width="33" height="17" stretchType="RelativeToTallestObject"/>
        <textFieldExpression><![CDATA[$F{判定} == null ? "" : $F{判定}]]></textFieldExpression>
      </textField>
    </band>
  </detail>

  <!-- ============ ⑥ 页脚:打印时间 + 页码(2026-11-04 用户口径:去掉红框内的地址/网址/邮箱/电话行) ============ -->
  <pageFooter>
    <!-- 地址行整行删除后,时间/页码上移到 band 顶部 y=0;band 高度保持 90(旧版带高)⇒ 不改变整单分页。 -->
    <band height="90">
      <textField isBlankWhenNull="true">
        <reportElement style="pager" x="51" y="0" width="300" height="13"/>
        <textFieldExpression><![CDATA["打印时间：" + ($P{打印时间} == null ? "" : String.valueOf($P{打印时间}))]]></textFieldExpression>
      </textField>
      <!-- 页码 = 两个紧邻字段拼成「第 X 页 / 共 Y 页」:左边一个 evaluationTime=Now(当前页)、
           右边一个 evaluationTime=Report(总页数);交界点都在 x=444(左字段右对齐、右字段左对齐),
           不再像旧写法 x=278 / x=418 那样被撑到纸张左右两端 -->
      <textField evaluationTime="Now">
        <reportElement style="pagerR" x="400" y="0" width="44" height="13"/>
        <textFieldExpression><![CDATA["第 " + $V{PAGE_NUMBER} + " 页"]]></textFieldExpression>
      </textField>
      <textField evaluationTime="Report">
        <reportElement style="pager" x="444" y="0" width="114" height="13"/>
        <textFieldExpression><![CDATA[" / 共 " + $V{PAGE_NUMBER} + " 页"]]></textFieldExpression>
      </textField>
    </band>
  </pageFooter>

</jasperReport>
',
              N'受控表单 c-95-12 / YJ-QR-05/A1;2026-11-04:无地址页脚、审核/批准落值'))
      AS s(template_code, panel_code, name, jrxml_text, remark)
   ON t.template_code = s.template_code
WHEN MATCHED THEN UPDATE SET panel_code = s.panel_code, name = s.name, jrxml_text = s.jrxml_text,
     remark = s.remark, enabled = N'Y', update_by = N'migration', update_at = SYSDATETIME()
WHEN NOT MATCHED THEN INSERT (template_code, panel_code, name, jrxml_text, enabled, remark, create_by, update_by, update_at)
     VALUES (s.template_code, s.panel_code, s.name, s.jrxml_text, N'Y', s.remark, N'migration', N'migration', SYSDATETIME());
GO

/* 自检(RAISERROR 16 ⇒ DbSync 判失败、不写 yj_schema_log):
   行数=1 / panel_code 正确 / LEN(jrxml_text)=源文件长度(库内与仓库同源)/
   含 审核人、审批人 两个参数片段 / **不含 water-agplus**(去页脚生效) / update_at 非空 / enabled=Y */
DECLARE @bad int = 0;
IF (SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'qc_oqc') <> 1 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_report_template WHERE template_code = N'qc_oqc' AND panel_code <> N'QC_OQC_REPORT') SET @bad = @bad + 1;
IF (SELECT LEN(jrxml_text) FROM yj_report_template WHERE template_code = N'qc_oqc') <> 31292 SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_oqc') NOT LIKE N'%<parameter name="审核人" class="java.lang.Object" isForPrompting="false"/>%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_oqc') NOT LIKE N'%<parameter name="审批人" class="java.lang.Object" isForPrompting="false"/>%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_oqc') LIKE N'%water-agplus%' SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'qc_oqc' AND update_at IS NULL) <> 0 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_report_template WHERE template_code = N'qc_oqc' AND enabled <> N'Y') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'出厂检验报告模板入库自检失败(bad=%d)', 16, 1, @bad);
ELSE PRINT N'出厂检验报告模板已入库(库内 = 仓库 .jrxml;update_at 非空 ⇒ 编译缓存会失效)';
GO
