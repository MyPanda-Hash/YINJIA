package com.yinjia.mes.tools;

import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.io.File;
import java.io.FileInputStream;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * E2E:直接读库,用 prod_insp.jrxml 导出一张真实销售出库单的出厂检验报告 PDF。
 * 不依赖 Spring 上下文(避开改 运行中应用),JDBC 直连正式库 HSDZ_MES。
 */
public class ProdInspE2E {

    static final String U = "\\u5b58\\u8d27\\u7f16\\u7801"; // 占位防误用

    public static void main(String[] args) throws Exception {
        String docNo = args.length > 0 ? args[0] : null;
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=true;trustServerCertificate=true";
        String user = System.getenv("YINJIA_SQL_USER");
        String pass = System.getenv("YINJIA_SQL_PASS");
        if (user == null || pass == null) { System.out.println("NEED_ENV"); return; }

        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (java.sql.Connection c = DriverManager.getConnection(url, user, pass)) {
            JdbcTemplate jdbc = new JdbcTemplate(new org.springframework.jdbc.datasource.SingleConnectionDataSource(c, true));
            if (docNo == null) {
                List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT TOP 1 h.[\u5355\u636e\u7f16\u53f7] AS no, COUNT(l.id) AS lines"
                    + " FROM bd_sale_out h JOIN bl_sale_out l ON l.[\u5355\u636e\u7f16\u53f7]=h.[\u5355\u636e\u7f16\u53f7]"
                    + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND ISNULL(l.asp_cancel,'N')<>'Y'"
                    + " GROUP BY h.[\u5355\u636e\u7f16\u53f7] ORDER BY lines DESC");
                if (rows.isEmpty()) { System.out.println("NO_DOC"); return; }
                docNo = String.valueOf(rows.get(0).get("no"));
            }
            System.out.println("DOC_NO=" + docNo);

            // 头
            Map<String, Object> head = jdbc.queryForMap(
                "SELECT * FROM bd_sale_out WHERE [\u5355\u636e\u7f16\u53f7] = ?", docNo);
            System.out.println("HEAD_KEYS=" + head.size());

            // 明细
            List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT * FROM bl_sale_out WHERE [\u5355\u636e\u7f16\u53f7] = ? AND ISNULL(asp_cancel,'N')<>'Y'", docNo);
            System.out.println("LINES=" + lines.size());
            if (lines.isEmpty()) { System.out.println("NO_LINES"); return; }

            Map<String, Object> first = lines.get(0);
            System.out.println("LINE0_HEAD=" + first.get("\u5b58\u8d27\u7f16\u7801") + " | keys=" + first.keySet().size());

            // ⚠ detail band 会按数据源行数重复 —— 出厂检验报告是"一份报告",只喂首行
            List<Map<String, Object>> oneRow = new java.util.ArrayList<>();
            oneRow.add(first);
            System.out.println("FEED_ROWS=" + oneRow.size() + " (原始明细 " + lines.size() + " 行)");

            // 参数(照 ReportService.headParams 口径)
            java.util.Map<String, Object> params = new java.util.LinkedHashMap<>(head);
            params.put("\u5355\u636e\u7f16\u53f7", docNo);
            params.put("\u6253\u5370\u65f6\u95f4", java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
            params.put("\u516c\u53f8", "\u60e0\u5dde\u5e02\u94f6\u5609\u73af\u4fdd\u79d1\u6280\u6709\u9650\u516c\u53f8");

            String jrxml = "D:\\workspace\\yinjia\\backend\\src\\main\\resources\\reports\\prod_insp.jrxml";
            JasperReport report = JasperCompileManager.compileReport(
                new FileInputStream(jrxml));
            JasperPrint print = JasperFillManager.fillReport(report, params,
                new JRMapCollectionDataSource((java.util.Collection) lines));
            String out = "D:\\workspace\\yinjia\\tools\\archive\\_insp-report\\prod_insp-e2e.pdf";
            byte[] pdf = JasperExportManager.exportReportToPdf(print);
            java.nio.file.Files.write(java.nio.file.Paths.get(out), pdf);
            System.out.println("PDF=" + out);
            System.out.println("PDF_BYTES=" + new File(out).length());
            System.out.println("PDF_PAGES=" + print.getPages().size());
        }
    }
}
