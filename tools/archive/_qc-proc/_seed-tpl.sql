SET NOCOUNT ON;
MERGE yj_report_template AS t USING (VALUES (N'qc_proc_insp', N'QC_PROC_INSP', N'制程检验记录表', N'<?xml version="1.0" encoding="UTF-8"?>
<!--
  制程检验记录表报表模板(QC_PROC_INSP / qc_proc_insp_head + qc_proc_insp_detail,2026-10-12)
  ============================================================================
  版式来源:用户截图「制程检验」页签(《生产相关品质检验.xlsx》第 2 个页签)。
  结构与截图一致,分上下两块:
    ① 制程检验组:表头 7 列(检验时间|客户名称|产品编码|型号(mm)|批号|抽检总量|结果判断)
       表体 3 组 —— 外观(端盖两头|管身两侧|按项目填充) / 尺寸(5 格) / 出货重量(5 格)
    ② 出货检验功能性测试组:客户名称|产品编码|型号(mm)|批号|检验人员|产线常规功能性结果|结果判断
       表体 —— 检验要求 | 检验方法(截图注明「自动填充出货检验计划表」)

  ⚠ 数据契约(ReportService):
    · $P{...} = 头字段标量 headParams 按 yj_field.label 下发 + 单据编号/打印时间后端补;
    · $F{...} = 明细行(detailRows),字段名 = yj_field.label。
  ⚠ JR 6.x XSD 排版坑(与 so_order/sl_recv 同套):
    · 样式集中声明;<box><pen/></box> 写法;band 必须包在分节元素里;
    · textAlignment/verticalAlignment 只作 textElement 属性;isStretchWithOverflow 已废弃,用 textAdjust。
  ⚠ band 顺序(严格):title → pageHeader → columnHeader → detail → columnFooter → pageFooter → lastPageFooter → summary → noData
-->
<jasperReport xmlns="http://jasperreports.sourceforge.net/jasperreports"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
              xsi:schemaLocation="http://jasperreports.sourceforge.net/jasperreports http://jasperreports.sourceforge.net/xsd/jasperreport.xsd"
              name="qc_proc_insp" language="java" columnCount="1"
              pageWidth="842" pageHeight="595" orientation="Landscape"
              columnWidth="758" leftMargin="42" rightMargin="42" topMargin="30" bottomMargin="30"
              whenNoDataType="AllSectionsNoDetail"
              uuid="a7f3c1d8-52e9-4b06-9c14-8d2f6a0b7e31">

  <property name="net.sf.jasperreports.awt.ignore.missing.font" value="false"/>
  <property name="net.sf.jasperreports.default.font.name" value="NotoSansSC"/>
  <property name="net.sf.jasperreports.export.xlsx.detect.cell.type" value="true"/>

  <!-- ======================= 样式(与 so_order / sl_recv 同套) ======================= -->
  <style name="base" isDefault="true" fontName="NotoSansSC" fontSize="9"/>
  <style name="cell" style="base" hAlign="Left" vAlign="Middle">
    <box padding="2">
      <pen lineWidth="0.5" lineColor="#8A8A8A"/>
    </box>
  </style>
  <style name="cellC" style="cell" hAlign="Center"/>
  <style name="th" style="cell" isBold="true" hAlign="Center" mode="Opaque" backcolor="#EFEFEF"/>
  <style name="bandTitle" style="base" fontSize="11" isBold="true" hAlign="Center" vAlign="Middle"
         mode="Opaque" backcolor="#DCE6F1">
    <box padding="2">
      <pen lineWidth="0.5" lineColor="#8A8A8A"/>
    </box>
  </style>
  <style name="notice" style="base" fontSize="10" isBold="true" hAlign="Center" vAlign="Middle"
         mode="Opaque" backcolor="#FFFF00">
    <box padding="2">
      <pen lineWidth="0.5" lineColor="#8A8A8A"/>
    </box>
  </style>
  <style name="company" style="base" fontSize="16" isBold="true" hAlign="Center" vAlign="Bottom"/>
  <style name="docTitle" style="base" fontSize="15" isBold="true" hAlign="Center" vAlign="Middle"/>
  <style name="meta" style="base" fontSize="9" vAlign="Middle"/>
  <style name="metaR" style="meta" hAlign="Right"/>
  <style name="gridLabel" style="base" isBold="true" vAlign="Middle"/>
  <style name="gridValue" style="base" vAlign="Middle"/>
  <style name="pager" style="base" vAlign="Middle"/>
  <style name="pagerR" style="pager" hAlign="Right"/>
  <style name="sign" style="base" fontSize="9" vAlign="Middle"/>
  <style name="small" style="cell" fontSize="8"/>

  <!-- 小字号单元格(表头/数据行用;字体大小必须在 style 里,不能写在 reportElement 上) -->
  <style name="th6" style="th" fontSize="6"/>
  <style name="th7" style="th" fontSize="7"/>
  <style name="th8" style="th" fontSize="8"/>
  <style name="c6" style="cellC" fontSize="6"/>
  <style name="c7" style="cellC" fontSize="7"/>
  <style name="c8" style="cellC" fontSize="8"/>
  <style name="l7" style="cell" fontSize="7"/>
  <style name="l8" style="cell" fontSize="8"/>

  <!-- ======================= 参数(头字段) ======================= -->
  <parameter name="单据编号" class="java.lang.String" isForPrompting="false"/>
  <parameter name="单据日期" class="java.util.Date" isForPrompting="false"/>
  <parameter name="检验时间" class="java.lang.String" isForPrompting="false"/>
  <parameter name="检验类别" class="java.lang.String" isForPrompting="false"/>
  <parameter name="工单号" class="java.lang.String" isForPrompting="false"/>
  <parameter name="报工单号" class="java.lang.String" isForPrompting="false"/>
  <parameter name="工序" class="java.lang.String" isForPrompting="false"/>
  <parameter name="批次号" class="java.lang.String" isForPrompting="false"/>
  <parameter name="客户名称" class="java.lang.String" isForPrompting="false"/>
  <parameter name="产品编码" class="java.lang.String" isForPrompting="false"/>
  <parameter name="产品名称" class="java.lang.String" isForPrompting="false"/>
  <parameter name="规格型号" class="java.lang.String" isForPrompting="false"/>
  <parameter name="生产线" class="java.lang.String" isForPrompting="false"/>
  <parameter name="生产车间" class="java.lang.String" isForPrompting="false"/>
  <parameter name="报工数量" class="java.math.BigDecimal" isForPrompting="false"/>
  <parameter name="抽检总量" class="java.math.BigDecimal" isForPrompting="false"/>
  <parameter name="检验数量" class="java.math.BigDecimal" isForPrompting="false"/>
  <parameter name="检验员" class="java.lang.String" isForPrompting="false"/>
  <parameter name="检验日期" class="java.util.Date" isForPrompting="false"/>
  <parameter name="总结论" class="java.lang.String" isForPrompting="false"/>
  <parameter name="检验方案" class="java.lang.String" isForPrompting="false"/>
  <parameter name="文件编码" class="java.lang.String" isForPrompting="false"/>
  <parameter name="执行标准" class="java.lang.String" isForPrompting="false"/>
  <parameter name="处理方式" class="java.lang.String" isForPrompting="false"/>
  <parameter name="单据状态" class="java.lang.String" isForPrompting="false"/>
  <parameter name="审核人" class="java.lang.String" isForPrompting="false"/>
  <parameter name="审核时间" class="java.util.Date" isForPrompting="false"/>
  <parameter name="打印时间" class="java.lang.String" isForPrompting="false"/>
  <!-- 三个表区的汇总结果:报表填充前由 ReportService 按 表区 归并明细后下发 -->
  <parameter name="外观结果" class="java.lang.String" isForPrompting="false"/>
  <parameter name="尺寸结果" class="java.lang.String" isForPrompting="false"/>
  <parameter name="重量结果" class="java.lang.String" isForPrompting="false"/>
  <!-- 尺寸/重量各 5 格:填充前把「多值字符串」按 "/" 拆成 5 个值(见 ReportService.splitParts) -->
  <parameter name="尺寸_1" class="java.lang.String" isForPrompting="false"/>
  <parameter name="尺寸_2" class="java.lang.String" isForPrompting="false"/>
  <parameter name="尺寸_3" class="java.lang.String" isForPrompting="false"/>
  <parameter name="尺寸_4" class="java.lang.String" isForPrompting="false"/>
  <parameter name="尺寸_5" class="java.lang.String" isForPrompting="false"/>
  <parameter name="重量_1" class="java.lang.String" isForPrompting="false"/>
  <parameter name="重量_2" class="java.lang.String" isForPrompting="false"/>
  <parameter name="重量_3" class="java.lang.String" isForPrompting="false"/>
  <parameter name="重量_4" class="java.lang.String" isForPrompting="false"/>
  <parameter name="重量_5" class="java.lang.String" isForPrompting="false"/>
  <parameter name="公司名称" class="java.lang.String" isForPrompting="false">
    <defaultValueExpression><![CDATA["惠州市银嘉环保科技有限公司"]]></defaultValueExpression>
  </parameter>

  <!-- ======================= 字段(明细行) ======================= -->
  <field name="表区" class="java.lang.String"/>
  <field name="行号" class="java.lang.Integer"/>
  <field name="检验项目" class="java.lang.String"/>
  <field name="检验要求" class="java.lang.String"/>
  <field name="检验方法" class="java.lang.String"/>
  <field name="抽检量" class="java.math.BigDecimal"/>
  <field name="实测数值" class="java.lang.String"/>
  <field name="单项判定" class="java.lang.String"/>
  <field name="不合格应对措施" class="java.lang.String"/>
  <field name="结果判断" class="java.lang.String"/>

  <!-- ======================= ① 制程检验组(band: title) =======================
       照截图:「黄底提示 + 7 固定列 + 外观(3子列)/尺寸(5格)/出货重量(5格) + 结果判断」
       列宽经 calc.mjs 精确计算,合计 758pt = columnWidth。 -->
  <title>
    <band height="160">
      <!-- 公司 + 标题:放在 title 最上方(title 在所有 band 之前渲染) -->
      <textField>
        <reportElement style="company" x="0" y="0" width="758" height="20"/>
        <textFieldExpression><![CDATA[$P{公司名称}]]></textFieldExpression>
      </textField>
      <textField>
        <reportElement style="docTitle" x="0" y="20" width="758" height="20"/>
        <textFieldExpression><![CDATA["制程检验记录表"]]></textFieldExpression>
      </textField>
      <!-- 元信息行 -->
      <textField isBlankWhenNull="true">
        <reportElement style="meta" x="0" y="40" width="380" height="10"/>
        <textFieldExpression><![CDATA["检验类别/工序：" + ($P{检验类别} == null ? "" : $P{检验类别}) + ($P{工序} == null ? "" : " / " + $P{工序})]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="metaR" x="380" y="40" width="378" height="10"/>
        <textFieldExpression><![CDATA["编号：" + ($P{单据编号} == null ? "" : $P{单据编号}) + "    日期：" + ($P{单据日期} == null ? "" : new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.CHINA).format($P{单据日期}))]]></textFieldExpression>
      </textField>

      <!-- ① 制程检验组:黄底提示 + 表头 + 数据行(整体下移 40) -->
      <staticText>
        <reportElement style="notice" x="0" y="52" width="758" height="16"/>
        <text><![CDATA[以下检验项目对应系统上的检查频率，1PCS/一个生产批次才进行测试]]></text>
      </staticText>

      <!-- 组标题行 y=18 高 14 -->
      <staticText><reportElement style="th8" x="390" y="70" width="66" height="14" /><text><![CDATA[外观]]></text></staticText>
      <staticText><reportElement style="th8" x="456" y="70" width="131" height="14" /><text><![CDATA[尺寸]]></text></staticText>
      <staticText><reportElement style="th8" x="587" y="70" width="131" height="14" /><text><![CDATA[出货重量]]></text></staticText>

      <!-- 固定 7 列表头(y=18..66,跨两行) -->
      <staticText><reportElement style="th8" x="0" y="70" width="50" height="48" /><text><![CDATA[检验时间]]></text></staticText>
      <staticText><reportElement style="th8" x="50" y="70" width="66" height="48" /><text><![CDATA[客户名称]]></text></staticText>
      <staticText><reportElement style="th8" x="116" y="70" width="58" height="48" /><text><![CDATA[产品编码]]></text></staticText>
      <staticText><reportElement style="th8" x="174" y="70" width="64" height="48" /><text><![CDATA[型号（mm)]]></text></staticText>
      <staticText><reportElement style="th8" x="238" y="70" width="56" height="48" /><text><![CDATA[批号]]></text></staticText>
      <staticText><reportElement style="th8" x="294" y="70" width="96" height="48" /><text><![CDATA[抽检总量]]></text></staticText>

      <!-- 外观 3 子列(y=32..66) -->
      <staticText><reportElement style="th6" x="390" y="84" width="22" height="34" /><text><![CDATA[端盖两头]]></text></staticText>
      <staticText><reportElement style="th6" x="412" y="84" width="22" height="34" /><text><![CDATA[管身两侧]]></text></staticText>
      <staticText><reportElement style="th6" x="434" y="84" width="22" height="34" /><text><![CDATA[按项目填充]]></text></staticText>

      <!-- 尺寸 / 出货重量 占位表头(y=32..66) -->
      <staticText><reportElement style="th7" x="456" y="84" width="131" height="34" /><text><![CDATA[按照尺寸检验项目填充]]></text></staticText>
      <staticText><reportElement style="th7" x="587" y="84" width="131" height="34" /><text><![CDATA[按照重量检验项目填充]]></text></staticText>

      <staticText><reportElement style="th8" x="718" y="70" width="40" height="48" /><text><![CDATA[结果判断]]></text></staticText>

      <!-- 数据行 y=66 高 34 -->
      <textField isBlankWhenNull="true">
        <reportElement style="c8" x="0" y="118" width="50" height="34" />
        <textFieldExpression><![CDATA[$P{检验时间} == null ? ($P{单据日期} == null ? "" : new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.CHINA).format($P{单据日期})) : $P{检验时间}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="l7" x="50" y="118" width="66" height="34" />
        <textFieldExpression><![CDATA[$P{客户名称}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="c8" x="116" y="118" width="58" height="34" />
        <textFieldExpression><![CDATA[$P{产品编码}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="c7" x="174" y="118" width="64" height="34" />
        <textFieldExpression><![CDATA[$P{规格型号}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="c8" x="238" y="118" width="56" height="34" />
        <textFieldExpression><![CDATA[$P{批次号}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="c8" x="294" y="118" width="96" height="34" />
        <textFieldExpression><![CDATA[$P{抽检总量} == null ? "" : new java.text.DecimalFormat("#,##0.###").format($P{抽检总量})]]></textFieldExpression>
      </textField>

      <!-- 外观 3 格:整组放一个汇总值(端盖/管身/其余 已拼成一串),跨 3 格显示 -->
      <textField isBlankWhenNull="true" textAdjust="StretchHeight">
        <reportElement style="c6" x="390" y="118" width="66" height="34"/>
        <textFieldExpression><![CDATA[$P{外观结果}]]></textFieldExpression>
      </textField>

      <!-- 尺寸 5 格:后端把「外径 44.5/44.6/... 内径 ... 长度 ...」的多值串按 / 拆成 5 格 -->
      <textField isBlankWhenNull="true"><reportElement style="c6" x="456" y="118" width="26" height="34"/><textFieldExpression><![CDATA[$P{尺寸_1}]]></textFieldExpression></textField>
      <textField isBlankWhenNull="true"><reportElement style="c6" x="482" y="118" width="26" height="34"/><textFieldExpression><![CDATA[$P{尺寸_2}]]></textFieldExpression></textField>
      <textField isBlankWhenNull="true"><reportElement style="c6" x="508" y="118" width="26" height="34"/><textFieldExpression><![CDATA[$P{尺寸_3}]]></textFieldExpression></textField>
      <textField isBlankWhenNull="true"><reportElement style="c6" x="534" y="118" width="26" height="34"/><textFieldExpression><![CDATA[$P{尺寸_4}]]></textFieldExpression></textField>
      <textField isBlankWhenNull="true"><reportElement style="c6" x="560" y="118" width="27" height="34"/><textFieldExpression><![CDATA[$P{尺寸_5}]]></textFieldExpression></textField>

      <!-- 出货重量 5 格 -->
      <textField isBlankWhenNull="true"><reportElement style="c6" x="587" y="118" width="26" height="34"/><textFieldExpression><![CDATA[$P{重量_1}]]></textFieldExpression></textField>
      <textField isBlankWhenNull="true"><reportElement style="c6" x="613" y="118" width="26" height="34"/><textFieldExpression><![CDATA[$P{重量_2}]]></textFieldExpression></textField>
      <textField isBlankWhenNull="true"><reportElement style="c6" x="639" y="118" width="26" height="34"/><textFieldExpression><![CDATA[$P{重量_3}]]></textFieldExpression></textField>
      <textField isBlankWhenNull="true"><reportElement style="c6" x="665" y="118" width="26" height="34"/><textFieldExpression><![CDATA[$P{重量_4}]]></textFieldExpression></textField>
      <textField isBlankWhenNull="true"><reportElement style="c6" x="691" y="118" width="27" height="34"/><textFieldExpression><![CDATA[$P{重量_5}]]></textFieldExpression></textField>

      <textField isBlankWhenNull="true">
        <reportElement style="c8" x="718" y="118" width="40" height="34" />
        <textFieldExpression><![CDATA[$P{总结论}]]></textFieldExpression>
      </textField>
    </band>
  </title>
  <!-- 页眉:公司/标题/元信息已移到 title band(否则会重复渲染两遍) -->
  <pageHeader>
    <band height="1"/>
  </pageHeader>
  <!-- ======================= ② 出货检验功能性测试组(band: columnHeader / detail) =======================
       截图:表头 客户名称|产品编码|型号(mm)|批号|检验人员|产线常规功能性结果|结果判断
             表体 检验要求 | 检验方法(注明「自动填充出货检验计划表」) -->
  <columnHeader>
    <band height="54">
      <staticText>
        <reportElement style="bandTitle" x="0" y="0" width="758" height="16"/>
        <text><![CDATA[出货检验功能性测试]]></text>
      </staticText>

      <staticText><reportElement style="th7" x="0" y="18" width="60" height="36" /><text><![CDATA[客户名称]]></text></staticText>
      <staticText><reportElement style="th7" x="60" y="18" width="56" height="36" /><text><![CDATA[产品编码]]></text></staticText>
      <staticText><reportElement style="th7" x="116" y="18" width="56" height="36" /><text><![CDATA[型号（mm)]]></text></staticText>
      <staticText><reportElement style="th7" x="172" y="18" width="62" height="36" /><text><![CDATA[批号]]></text></staticText>
      <staticText><reportElement style="th7" x="234" y="18" width="86" height="18"/><text><![CDATA[检验人员：]]></text></staticText>
      <staticText><reportElement style="th6" x="234" y="36" width="86" height="18"/><text><![CDATA[]]></text></staticText>
      <staticText><reportElement style="th6" x="320" y="18" width="150" height="36"/><text><![CDATA[以下检验要求自动填充出货检验计划表]]></text></staticText>
      <staticText><reportElement style="th6" x="470" y="18" width="150" height="36"/><text><![CDATA[以下检验方法自动填充出货检验计划表]]></text></staticText>
      <staticText><reportElement style="th7" x="620" y="18" width="76" height="36"/><text><![CDATA[产线常规功能性结果]]></text></staticText>
      <staticText><reportElement style="th7" x="696" y="18" width="62" height="36"/><text><![CDATA[结果判断]]></text></staticText>
    </band>
  </columnHeader>

  <!-- 功能性测试行:每行 = 一条检验要求 + 检验方法。
       ⚠ 数据源必须用 $P{主数据源}(后端已过滤成「表区=功能性测试」的行),
         否则 detail 会把外观/尺寸/重量的明细也逐行渲染一遍(11 行而不是 4 行)。 -->
  <detail>
    <band height="20">
      <textField isBlankWhenNull="true">
        <reportElement style="l7" x="0" y="0" width="60" height="20"/>
        <textFieldExpression><![CDATA[$P{客户名称}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="c7" x="60" y="0" width="56" height="20"/>
        <textFieldExpression><![CDATA[$P{产品编码}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="c7" x="116" y="0" width="56" height="20"/>
        <textFieldExpression><![CDATA[$P{规格型号}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="c7" x="172" y="0" width="62" height="20"/>
        <textFieldExpression><![CDATA[$P{批次号}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="c7" x="234" y="0" width="86" height="20"/>
        <textFieldExpression><![CDATA[$P{检验员}]]></textFieldExpression>
      </textField>

      <!-- 检验要求(F)| 检验方法(G)= 截图两列 -->
      <textField isBlankWhenNull="true" textAdjust="StretchHeight">
        <reportElement style="l7" x="320" y="0" width="150" height="20"/>
        <textFieldExpression><![CDATA[$F{检验要求}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true" textAdjust="StretchHeight">
        <reportElement style="l7" x="470" y="0" width="150" height="20"/>
        <textFieldExpression><![CDATA[$F{检验方法}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="c7" x="620" y="0" width="76" height="20"/>
        <textFieldExpression><![CDATA[$F{实测数值}]]></textFieldExpression>
      </textField>
      <textField isBlankWhenNull="true">
        <reportElement style="c7" x="696" y="0" width="62" height="20"/>
        <textFieldExpression><![CDATA[$F{单项判定}]]></textFieldExpression>
      </textField>
    </band>
  </detail>
  <pageFooter>
    <band height="30">
      <textField>
        <reportElement style="pager" x="0" y="0" width="200" height="12"/>
        <textFieldExpression><![CDATA["第 " + $V{PAGE_NUMBER} + " 页"]]></textFieldExpression>
      </textField>
      <textField>
        <reportElement style="pagerR" x="558" y="0" width="200" height="12"/>
        <textFieldExpression><![CDATA["打印时间：" + $P{打印时间}]]></textFieldExpression>
      </textField>
      <staticText>
        <reportElement style="sign" x="0" y="14" width="60" height="14"/>
        <text><![CDATA[检验员：]]></text>
      </staticText>
      <textField isBlankWhenNull="true">
        <reportElement style="sign" x="60" y="14" width="130" height="14"/>
        <textFieldExpression><![CDATA[$P{检验员}]]></textFieldExpression>
      </textField>
      <staticText>
        <reportElement style="sign" x="260" y="14" width="50" height="14"/>
        <text><![CDATA[审核：]]></text>
      </staticText>
      <textField isBlankWhenNull="true">
        <reportElement style="sign" x="310" y="14" width="130" height="14"/>
        <textFieldExpression><![CDATA[$P{审核人}]]></textFieldExpression>
      </textField>
      <staticText>
        <reportElement style="sign" x="500" y="14" width="50" height="14"/>
        <text><![CDATA[批准：]]></text>
      </staticText>
      <staticText>
        <reportElement style="sign" x="550" y="14" width="208" height="14"/>
        <text><![CDATA[]]></text>
      </staticText>
    </band>
  </pageFooter>
</jasperReport>
', N'按《生产相关品质检验.xlsx》制程检验页签版式(2026-10-12)', N'admin'))
  AS s(template_code, panel_code, name, jrxml_text, remark, update_by)
ON t.template_code=s.template_code
WHEN MATCHED THEN UPDATE SET panel_code=s.panel_code, name=s.name, jrxml_text=s.jrxml_text,
  enabled='Y', remark=s.remark, update_by=s.update_by, update_at=SYSDATETIME()
WHEN NOT MATCHED THEN INSERT (template_code, panel_code, name, jrxml_text, enabled, remark, create_by, update_by)
  VALUES (s.template_code, s.panel_code, s.name, s.jrxml_text, 'Y', s.remark, s.update_by, s.update_by);
