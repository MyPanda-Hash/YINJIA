package com.yinjia.mes.tools;

import net.sf.jasperreports.engine.*;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;

import java.io.FileInputStream;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * E2E:直接读库,按 ReportService 的口径(头参数 + 明细行 + 表区归并)导出制程检验记录表 PDF。
 * 不依赖 Spring 上下文,JDBC 直连。
 */
public class ProcInspE2E {
    public static void main(String[] args) throws Exception {
        String docNo = args.length > 0 ? args[0] : "ZC-2026-10-0001";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\qc_proc_insp-e2e.pdf";

        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(url,
                System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            // ① 头(照 headParams:所有标量字段转 String 下发)
            Map<String, Object> params = new LinkedHashMap<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT * FROM qc_proc_insp_head WHERE 单据编号=?")) {
                ps.setString(1, docNo);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) { System.out.println("NO_HEAD"); return; }
                    ResultSetMetaData m = rs.getMetaData();
                    for (int i = 1; i <= m.getColumnCount(); i++) {
                        Object v = rs.getObject(i);
                        String k = m.getColumnLabel(i);
                        if (v == null) continue;
                        if (v instanceof java.sql.Date d) params.put(k, d.toString());
                        else if (v instanceof java.sql.Timestamp) continue;
                        else if (v instanceof Number) params.put(k, String.valueOf(v));
                        else params.put(k, String.valueOf(v).trim());
                    }
                }
            }
            params.put("单据编号", docNo);
            params.put("打印时间", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
            System.out.println("HEAD_PARAMS=" + params.size());

            // ② 明细(照 detailRows:Map<label, value>)
            List<Map<String, Object>> rows = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT * FROM qc_proc_insp_detail WHERE 单据编号=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id")) {
                ps.setString(1, docNo);
                try (ResultSet rs = ps.executeQuery()) {
                    ResultSetMetaData m = rs.getMetaData();
                    while (rs.next()) {
                        Map<String, Object> r = new LinkedHashMap<>();
                        for (int i = 1; i <= m.getColumnCount(); i++) {
                            Object v = rs.getObject(i);
                            if (v == null) continue;
                            if (v instanceof Number n) r.put(m.getColumnLabel(i), n);
                            else r.put(m.getColumnLabel(i), String.valueOf(v).trim());
                        }
                        rows.add(r);
                    }
                }
            }
            System.out.println("DETAIL_ROWS=" + rows.size());

            // ③ 按表区归并(照 ReportService.joinSector)
            for (String[] sp : new String[][]{{"外观", "外观结果"}, {"尺寸", "尺寸结果"}, {"重量", "重量结果"}}) {
                StringBuilder sb = new StringBuilder();
                for (Map<String, Object> r : rows) {
                    String sec = r.get("表区") == null ? "" : String.valueOf(r.get("表区")).trim();
                    if (!sp[0].equals(sec)) continue;
                    String item = str(r.get("检验项目")), val = str(r.get("实测数值")), judge = str(r.get("单项判定"));
                    String one = item;
                    if (!val.isEmpty()) one = one.isEmpty() ? val : one + ":" + val;
                    if (!judge.isEmpty()) one = one.isEmpty() ? judge : one + "(" + judge + ")";
                    if (one.isEmpty()) continue;
                    if (sb.length() > 0) sb.append(" · ");
                    sb.append(one);
                }
                params.put(sp[1], sb.toString());
                System.out.println("  " + sp[1] + " = " + sb);
            }

            // ③b 尺寸/重量各 5 格:把该表区实测值按 / 摊平成 5 个(照 ReportService.splitParts)
            for (String[] sp : new String[][]{{"尺寸", "尺寸"}, {"重量", "重量"}}) {
                List<String> parts = new ArrayList<>();
                for (Map<String, Object> r : rows) {
                    if (!sp[0].equals(str(r.get("表区")))) continue;
                    String v = str(r.get("实测数值"));
                    if (v.isEmpty()) continue;
                    for (String pp : v.split("[/、,，\\s]+")) {
                        String t = pp.trim();
                        if (!t.isEmpty()) parts.add(t);
                        if (parts.size() >= 5) break;
                    }
                    if (parts.size() >= 5) break;
                }
                for (int i = 0; i < 5; i++) {
                    params.put(sp[1] + "_" + (i + 1), i < parts.size() ? parts.get(i) : "");
                }
                System.out.println("  " + sp[1] + "_1..5 = " + parts);
            }

            // ④ 填充 + 导出
            String jrxml = "D:\\workspace\\yinjia\\backend\\src\\main\\resources\\reports\\qc_proc_insp.jrxml";
            JasperReport report = JasperCompileManager.compileReport(new FileInputStream(jrxml));
            // detail 只喂「表区=功能性测试」的行(照 ReportService 口径)
            List<Map<String, Object>> fnRows = new ArrayList<>();
            for (Map<String, Object> r : rows) {
                if ("功能性测试".equals(str(r.get("表区")))) fnRows.add(r);
            }
            System.out.println("FUNC_ROWS=" + fnRows.size());
            JasperPrint print = JasperFillManager.fillReport(report, params,
                    new JRMapCollectionDataSource((Collection) fnRows));
            Files.write(Paths.get(out), JasperExportManager.exportReportToPdf(print));
            System.out.println("PDF=" + out);
            System.out.println("PDF_BYTES=" + Files.size(Paths.get(out)));
            System.out.println("PDF_PAGES=" + print.getPages().size());
        }
    }

    static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }
}
