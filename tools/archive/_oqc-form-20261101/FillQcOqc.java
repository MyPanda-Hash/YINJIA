import java.io.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.*;
import java.sql.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

import net.sf.jasperreports.engine.*;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;
import net.sf.jasperreports.engine.export.JRPdfExporter;
import net.sf.jasperreports.engine.export.ooxml.JRXlsxExporter;
import net.sf.jasperreports.export.*;
import net.sf.jasperreports.engine.design.*;

/**
 * FillQcOqc —— 出厂检验报告(QC_OQC_REPORT)模板的本机渲染验证器(工具,不是产品代码)。
 *
 * <p>模拟 ReportService 通用分支的真实取数契约(2026-11-01 版 ReportService.export() else 分支):
 * <pre>
 *   JasperFillManager.fillReport(compile(tpl), headParams(doc, docNo), new JRMapCollectionDataSource(detailRows))
 * </pre>
 * 参数 = 头字段 label(中文名);数据源每行 = 明细字段 label(中文名)。
 * 头表 qc_oqc_head / 行表 qc_oqc_detail 的物理列名与 yj_field.label 一致,只有日期要按
 * QueryService.dateWallText 的口径转成 'yyyy-MM-dd' 文本(与线上一致)。
 *
 * <p>用法:
 * <pre>
 *   java FillQcOqc.java &lt;jrxml&gt; &lt;单据编号&gt; &lt;输出前缀&gt; [--rows N] [--blank] [--xlsx]
 * </pre>
 * 数据默认读测试账套 HSDZ_MES_TEST(Lead 已在里面生成 OQC-2026-11-0001 / OQC-2026-11-0002),
 * 可用 -Doqc.db=HSDZ_MES 覆盖。
 */
public class FillQcOqc {
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
    static final String DB = System.getProperty("oqc.db", "HSDZ_MES_TEST");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";

    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("usage: FillQcOqc.java <jrxml> <单据编号> <outPrefix> [--rows N] [--blank] [--xlsx]");
            System.exit(2);
        }
        String jrxmlPath = args[0];
        String docNo = args[1];
        String outPrefix = args[2];
        Integer limit = null;
        Integer repeat = null;
        boolean blank = false;
        boolean xlsx = false;
        for (int i = 3; i < args.length; i++) {
            if ("--rows".equals(args[i]) && i + 1 < args.length) limit = Integer.parseInt(args[++i]);
            else if ("--repeat".equals(args[i]) && i + 1 < args.length) repeat = Integer.parseInt(args[++i]);
            else if ("--blank".equals(args[i])) blank = true;
            else if ("--xlsx".equals(args[i])) xlsx = true;
            else throw new IllegalArgumentException("unknown arg: " + args[i]);
        }

        Map<String, Object> params = new LinkedHashMap<>();
        List<Map<String, ?>> rows = new ArrayList<>();
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            loadHead(c, docNo, params);
            loadDetail(c, docNo, rows);
        }
        if (rows.isEmpty()) throw new IllegalStateException("单据没有明细行: " + docNo);
        if (limit != null && limit < rows.size()) rows = new ArrayList<>(rows.subList(0, limit));
        if (repeat != null && repeat > 1) {
            // 压测分页:把明细整体重复 N 遍(序号重编),用于验证表格跨页时行/边框连续、页眉页脚正确
            List<Map<String, ?>> base = new ArrayList<>(rows);
            List<Map<String, ?>> all = new ArrayList<>();
            for (int k = 0; k < repeat; k++) {
                int no = 0;
                for (Map<String, ?> r : base) {
                    Map<String, Object> m = new LinkedHashMap<>(r);
                    m.put("序号", ++no);
                    all.add(m);
                }
            }
            rows = all;
        }
        if (blank) {
            List<Map<String, ?>> cleared = new ArrayList<>();
            for (Map<String, ?> r : rows) {
                Map<String, Object> m = new LinkedHashMap<>();
                for (Map.Entry<String, ?> e : r.entrySet()) m.put(e.getKey(), e.getValue() instanceof String ? "" : null);
                cleared.add(m);
            }
            rows = cleared;
        }
        params.put("打印时间", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));

        System.out.println("[params] 单据编号=" + params.get("单据编号")
                + " 客户名称=" + params.get("客户名称")
                + " 产品编码=" + params.get("产品编码")
                + " 生产数量=" + params.get("生产数量")
                + " 生产日期=" + params.get("生产日期")
                + " 检测日期=" + params.get("检测日期")
                + " 检验结论=" + params.get("检验结论")
                + " 备注=" + params.get("备注"));
        System.out.println("[rows] " + rows.size() + " 行");

        JasperReport report = JasperCompileManager.compileReport(jrxmlPath);
        JasperPrint print = JasperFillManager.fillReport(report, params, new JRMapCollectionDataSource(rows));
        System.out.println("[fill] pages=" + print.getPages().size());

        exportPdf(print, outPrefix + ".pdf");
        if (xlsx) exportXlsx(print, outPrefix + ".xlsx");
    }

    // ==================== 取数(与 QueryService.loadOneDoc 同口径) ====================

    static void loadHead(Connection c, String docNo, Map<String, Object> params) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM qc_oqc_head WHERE 单据编号 = ?")) {
            ps.setString(1, docNo);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw new IllegalStateException("qc_oqc_head 没有单据: " + docNo);
                ResultSetMetaData md = rs.getMetaData();
                for (int i = 1; i <= md.getColumnCount(); i++) {
                    String label = md.getColumnLabel(i);
                    int type = md.getColumnType(i);
                    Object v = rs.getObject(i);
                    if (v != null && (type == Types.DATE || type == Types.TIMESTAMP)) {
                        // QueryService.dateWallText: 日期字段 → 'yyyy-MM-dd'(文本),见 ReportService 契约
                        if (v instanceof java.sql.Timestamp ts) v = ts.toLocalDateTime().toLocalDate().toString();
                        else if (v instanceof java.sql.Date d) v = d.toLocalDate().toString();
                        else v = LocalDate.parse(String.valueOf(v)).toString();
                    }
                    params.put(label, v);
                }
            }
        }
        // 单据状态:QueryService 会从 yj_doc_status 带出,这里只做等价取值(模板暂未用,但保持契约完整)
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT TOP 1 单据编号 FROM yj_doc_status WHERE panel_code = N'QC_OQC_REPORT' AND doc_no = ?")) {
            ps.setString(1, docNo);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) params.putIfAbsent("单据状态", "已保存");
            }
        } catch (SQLException ignore) {
            // yj_doc_status 结构差异不影响渲染
        }
    }

    static void loadDetail(Connection c, String docNo, List<Map<String, ?>> rows) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT * FROM qc_oqc_detail WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY 行号")) {
            ps.setString(1, docNo);
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData md = rs.getMetaData();
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    for (int i = 1; i <= md.getColumnCount(); i++) {
                        String label = md.getColumnLabel(i);
                        int type = md.getColumnType(i);
                        Object v;
                        if (type == Types.DECIMAL || type == Types.NUMERIC) {
                            v = rs.getBigDecimal(i);
                        } else if (type == Types.INTEGER || type == Types.SMALLINT || type == Types.TINYINT) {
                            int n = rs.getInt(i);
                            v = rs.wasNull() ? null : Integer.valueOf(n);
                        } else if (type == Types.BIT || type == Types.BOOLEAN) {
                            boolean b = rs.getBoolean(i);
                            v = rs.wasNull() ? null : Boolean.valueOf(b);
                        } else if (type == Types.DATE || type == Types.TIMESTAMP) {
                            Object raw = rs.getObject(i);
                            v = raw == null ? null : String.valueOf(raw).substring(0, 10);
                        } else {
                            v = rs.getString(i);
                        }
                        m.put(label, v);
                    }
                    rows.add(m);
                }
            }
        }
    }

    // ==================== 导出 ====================

    static void exportPdf(JasperPrint print, String out) throws JRException {
        JRPdfExporter ex = new JRPdfExporter();
        ex.setExporterInput(new SimpleExporterInput(print));
        ex.setExporterOutput(new SimpleOutputStreamExporterOutput(out));
        SimplePdfExporterConfiguration cfg = new SimplePdfExporterConfiguration();
        cfg.setCreatingBatchModeBookmarks(true);
        ex.setConfiguration(cfg);
        ex.exportReport();
        System.out.println("[written] " + out + " (" + new File(out).length() + " bytes)");
    }

    static void exportXlsx(JasperPrint print, String out) throws JRException {
        JRXlsxExporter ex = new JRXlsxExporter();
        ex.setExporterInput(new SimpleExporterInput(print));
        ex.setExporterOutput(new SimpleOutputStreamExporterOutput(out));
        SimpleXlsxReportConfiguration cfg = new SimpleXlsxReportConfiguration();
        cfg.setDetectCellType(true);
        cfg.setOnePagePerSheet(false);
        ex.setConfiguration(cfg);
        ex.exportReport();
        System.out.println("[written] " + out + " (" + new File(out).length() + " bytes)");
    }
}
