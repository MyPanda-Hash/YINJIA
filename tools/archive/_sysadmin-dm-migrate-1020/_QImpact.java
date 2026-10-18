import java.sql.*;

/**
 * _QImpact.java — 被挡住的 5 个脚本,其目标对象在库里到底存不存在(判断实际损失)。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_sysadmin-dm-migrate-1020\_QImpact.java HSDZ_MES
 */
public class _QImpact {
    static Connection c;
    static int q(String sql, Object... a) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < a.length; i++) ps.setObject(i + 1, a[i]);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return rs.getInt(1); }
        }
    }
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                + ";encrypt=false;trustServerCertificate=true");
        System.out.println("===== " + db + " 被挡脚本的实际影响 =====");

        System.out.println("--- ① migrate-dc-platform:bs_dc_* 表 ---");
        String[] dcTables = { "bs_dc_device", "bs_dc_sample", "bs_dc_alarm", "bs_dc_status_log",
                "bs_dc_gateway", "bs_dc_rule", "bs_dc_group", "bs_dc_engineer" };
        int exist = 0;
        for (String t : dcTables) {
            int n = q("SELECT COUNT(*) FROM sys.objects WHERE object_id=OBJECT_ID(?)", "dbo." + t);
            if (n > 0) exist++;
            System.out.println("  " + String.format("%-20s", t) + (n > 0 ? "存在" : "【缺失】"));
        }
        System.out.println("  合计存在 " + exist + "/" + dcTables.length);

        System.out.println("--- ② migrate-dc-gateway-apikey:bs_dc_gateway.api_key ---");
        System.out.println("  bs_dc_gateway 表: " + (q("SELECT COUNT(*) FROM sys.objects WHERE object_id=OBJECT_ID(N'dbo.bs_dc_gateway')") > 0 ? "存在" : "【缺失】"));
        System.out.println("  api_key 列: " + (q("SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.bs_dc_gateway') AND name=N'api_key'") > 0 ? "存在" : "【缺失】"));

        System.out.println("--- ③ migrate-stock-balance-warn:v_stock_balance.预警数量 ---");
        System.out.println("  v_stock_balance: " + (q("SELECT COUNT(*) FROM sys.objects WHERE object_id=OBJECT_ID(N'dbo.v_stock_balance')") > 0 ? "存在" : "【缺失】"));
        System.out.println("  预警数量 列: " + (q("SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.v_stock_balance') AND name=N'预警数量'") > 0 ? "存在" : "【缺失】"));

        System.out.println("--- ④ migrate-proc-process-samples:七张生产单据是否有单据 ---");
        String[][] panels = {
            { "DAY_REPORT", "生产日报表" }, { "FEED_CONFIRM", "投料确认单" }, { "MIX_RECORD", "物料混合记录" },
            { "GRAN_RECORD", "造粒记录" }, { "WH_RECORD", "无黑处理登记" }, { "PACK_CONFIRM", "封箱确认" },
            { "PROD_ABN", "生产异常处理单" } };
        for (String[] p : panels) {
            Integer n = null;
            try {
                n = q("SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = ?", p[0]);
            } catch (Exception e) { n = -1; }
            System.out.println("  " + String.format("%-14s %-12s", p[0], p[1]) + " yj_doc_status 行数=" + n);
        }

        System.out.println("--- ⑤ migrate-proc-process-refs:那 10 张面板的参照字段数 ---");
        String[] procPanels = { "DAY_REPORT", "FEED_CONFIRM", "MIX_RECORD", "GRAN_RECORD", "WH_RECORD",
                "PACK_CONFIRM", "PROD_ABN", "WO_REPORT", "WO_COMPLETION_LIST", "WO_REPORT_LIST" };
        for (String p : procPanels) {
            int refs = q("SELECT COUNT(*) FROM yj_field WHERE panel_code=? AND data_type=N'参照'", p);
            int fields = q("SELECT COUNT(*) FROM yj_field WHERE panel_code=?", p);
            System.out.println("  " + String.format("%-18s", p) + " 字段=" + String.format("%-4d", fields) + " 参照=" + refs);
        }
        c.close();
    }
}
