#!/usr/bin/env node
/**
 * 生成 prod_insp.jrxml(出厂检验报告 2026-10-12,表单编号 YJ-QR-05/A1)
 * 中文全部写成 \uXXXX:沙箱管道会破坏 CJK,转义后本文件全 ASCII,由 Node 解码落 UTF-8。
 * 运行: node tools/archive/_insp-report/gen.mjs
 */
import fs from "node:fs";

const u = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

const T = {
  company:     "\\u516c\\u53f8",
  companyName: "\\u60e0\\u5dde\\u5e02\\u94f6\\u5609\\u73af\\u4fdd\\u79d1\\u6280\\u6709\\u9650\\u516c\\u53f8",
  title:       "\\u51fa\\u5382\\u68c0\\u9a8c\\u62a5\\u544a",
  rptNo:       "\\u62a5\\u544a\\u7f16\\u53f7",
  compileDate: "\\u7f16\\u5236\\u65e5\\u671f",
  customer:    "\\u5ba2\\u6237",
  docNo:       "\\u5355\\u636e\\u7f16\\u53f7",
  docDate:     "\\u5355\\u636e\\u65e5\\u671f",
  printTime:   "\\u6253\\u5370\\u65f6\\u95f4",
  prodName:    "\\u4ea7\\u54c1\\u540d\\u79f0",
  prodSpec:    "\\u4ea7\\u54c1\\u89c4\\u683c",
  prodCode:    "\\u4ea7\\u54c1\\u7f16\\u7801",
  prodDate:    "\\u751f\\u4ea7\\u65e5\\u671f",
  prodQty:     "\\u751f\\u4ea7\\u6570\\u91cf",
  inspDate:    "\\u68c0\\u6d4b\\u65e5\\u671f",
  seq:         "\\u5e8f\\u53f7",
  inspItem:    "\\u68c0\\u9a8c\\u9879\\u76ee",
  inspReq:     "\\u68c0\\u9a8c\\u8981\\u6c42",
  sampleStd:   "\\u62bd\\u6837\\u6807\\u51c6",
  sampleQty:   "\\u62bd\\u68c0\\u91cf",
  result:      "\\u7ed3\\u679c",
  verdict:     "\\u5224\\u5b9a",
  conclusion:  "\\u68c0\\u9a8c\\u7ed3\\u8bba",
  qualified:   "\\u5408\\u683c",
  noteText:    "\\u5907\\u6ce8",
  inspector:   "\\u68c0\\u9a8c\\u5458",
  reviewer:    "\\u5ba1\\u6838",
  approver:    "\\u6279\\u51c6",
  invName:     "\\u5b58\\u8d27\\u540d\\u79f0",
  invCode:     "\\u5b58\\u8d27\\u7f16\\u7801",
  spec:        "\\u89c4\\u683c\\u578b\\u53f7",
  qty:         "\\u6570\\u91cf",
  uom:         "\\u8ba1\\u91cf\\u5355\\u4f4d",
};
const K = {};
for (const [k, v] of Object.entries(T)) K[k] = u(v);

const OUT = "D:\\workspace\\yinjia\\backend\\src\\main\\resources\\reports\\prod_insp.jrxml";

const NOTE = u("\\u6d4b\\u8bd5\\u73af\\u5883\\uff1a\\u6e29\\u5ea624\\u2103 \\u6e7f\\u5ea6\\uff1a48%\\uff1b"
  + "\\u6d4b\\u8bd5\\u6837\\u672c\\u8d85\\u8fc75\\u4e2a\\u65f6\\uff0c\\u586b\\u51995\\u4e2a\\u6570\\u636e\\uff0c"
  + "\\u8bb0\\u5f55\\u6570\\u636e\\u65f6\\u9009\\u62e9\\u504f\\u9ad8\\u79bb\\u6807\\u51c6\\u6700\\u8fdc\\u7684\\u6570\\u636e\\u8fdb\\u884c\\u8bb0\\u5f55");

export { K, OUT, NOTE };

// ═══ XML 头部:根元素 + 样式 + 参数 ═══
const HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!-- prod_insp.jrxml \u51fa\u5382\u68c0\u9a8c\u62a5\u544a(2026-10-12,\u8868\u5355\u7f16\u53f7 YJ-QR-05/A1)
     \u53d6\u6570:ReportService.headParams(\u5934\u5b57\u6bb5\u2192\u53c2\u6570) + detailRows(\u660e\u7ec6\u884c\u2192\u5b57\u6bb5),
     \u5b57\u6bb5\u540d=yj_field.label\u3002\u6392\u7248\u89c4\u7ea6\u540c so_order.jrxml(\u6837\u5f0f\u96c6\u4e2d/\u5c5e\u6027\u5f52\u5c5e/box/\u5206\u8282\u5305 band) -->
<jasperReport xmlns="http://jasperreports.sourceforge.net/jasperreports"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
              xsi:schemaLocation="http://jasperreports.sourceforge.net/jasperreports http://jasperreports.sourceforge.net/xsd/jasperreport.xsd"
              name="prod_insp" language="java" columnCount="1"
              pageWidth="595" pageHeight="842" orientation="Portrait"
              columnWidth="539" leftMargin="28" rightMargin="28" topMargin="28" bottomMargin="28"
              whenNoDataType="AllSectionsNoDetail"
              uuid="1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d">

  <property name="net.sf.jasperreports.awt.ignore.missing-font" value="false"/>
  <property name="net.sf.jasperreports.default.font.name" value="NotoSansSC"/>
  <property name="net.sf.jasperreports.export.xlsx.detect.cell.type" value="true"/>

  <style name="base" isDefault="true" fontName="NotoSansSC" fontSize="9"/>
  <style name="cell" style="base" hAlign="Left" vAlign="Middle">
    <box padding="2"><pen lineWidth="0.5" lineColor="#8A8A8A"/></box>
  </style>
  <style name="cellC" style="cell" hAlign="Center"/>
  <style name="cellR" style="cell" hAlign="Right"/>
  <style name="th" style="cell" isBold="true" hAlign="Center" mode="Opaque" backcolor="#EFEFEF"/>
  <style name="itemC" style="cellC" isBold="true"/>
  <style name="cellS" style="base" fontSize="8" hAlign="Left" vAlign="Middle">
    <box padding="2"><pen lineWidth="0.5" lineColor="#8A8A8A"/></box>
  </style>
  <style name="cellSC" style="cellS" hAlign="Center"/>
  <style name="company" style="base" fontSize="13" isBold="true" hAlign="Center" vAlign="Bottom"/>
  <style name="docTitle" style="base" fontSize="20" isBold="true" hAlign="Center" vAlign="Middle"/>
  <style name="meta" style="base" fontSize="9" vAlign="Middle"/>
  <style name="metaR" style="meta" hAlign="Right"/>
  <style name="gridLabel" style="base" isBold="true" vAlign="Middle"/>
  <style name="gridValue" style="base" vAlign="Middle"/>
  <style name="conclusion" style="base" fontSize="11" isBold="true" hAlign="Left" vAlign="Middle"/>
  <style name="note" style="base" fontSize="8" vAlign="Top"/>
  <style name="sign" style="base" fontSize="9" vAlign="Middle"/>
  <style name="footerNote" style="base" fontSize="7" forecolor="#666666" vAlign="Middle"/>
  <style name="pager" style="base" fontSize="8" vAlign="Middle"/>
  <style name="pagerR" style="pager" hAlign="Right"/>

  <parameter name="${K.docNo}" class="java.lang.String" isForPrompting="false"/>
  <parameter name="${K.docDate}" class="java.util.Date" isForPrompting="false"/>
  <parameter name="${K.customer}" class="java.lang.String" isForPrompting="false"/>
  <parameter name="${K.printTime}" class="java.lang.String" isForPrompting="false"/>
  <parameter name="${K.company}" class="java.lang.String" isForPrompting="false">
    <defaultValueExpression><![CDATA["${K.companyName}"]]></defaultValueExpression>
  