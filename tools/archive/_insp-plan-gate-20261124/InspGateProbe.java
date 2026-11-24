import java.sql.*;
import java.util.*;

/**
 * 只读验收:按新判据(2026-11-24)列出「每个在用产品会出哪几张过程检验单」。
 * 判据与 ProcessInspPlanGate 一一对应(首件=成型工艺清单、功能=计划含1PCS、表观=计划含1%)。
 */
public class InspGateProbe {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        int limit = a.length > 1 ? Integer.parseInt(a[1]) : 25;
        try (Connection c = DriverManager.getConnection(String.format(URL, db), USER, PASS)) {
            System.out.println("== " + db + " 产品 → 会出哪几张过程检验单 ==");
            // 取「近一年有工单行」的产品,更贴近现场
            String sql = "SELECT TOP " + limit + " LTRIM(RTRIM(p.dm)) AS code, COUNT(*) AS 工单行数"
                    + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.dm,N'')<>N''"
                    + " GROUP BY LTRIM(RTRIM(p.dm)) ORDER BY 工单行数 DESC";
            List<String[]> rows = new ArrayList<>();
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
                while (r.next()) rows.add(new String[]{r.getString(1), r.getString(2)});
            }
            System.out.printf("%-16s %-8s %-6s %-6s %-6s %s%n", "产品编码", "工单行", "首件", "功能", "表观", "依据");
            int nFirst = 0, nFunc = 0, nLook = 0, nNone = 0;
            for (String[] row : rows) {
                String code = row[0];
                boolean first = hasMold(c, code);
                boolean func = planFreq(c, code, "1PCS");
                boolean look = planFreq(c, code, "1%");
                if (first) nFirst++;
                if (func) nFunc++;
                if (look) nLook++;
                if (!first && !func && !look) nNone++;
                System.out.printf("%-16s %-8s %-6s %-6s %-6s %s%n", code, row[1],
                        first ? "是" : "-", func ? "是" : "-", look ? "是" : "-", basis(first, func, look));
            }
            System.out.println("-- 合计 " + rows.size() + " 个产品:首件 " + nFirst + " / 功能 " + nFunc
                    + " / 表观 " + nLook + " / 都不出 " + nNone);
        }
    }

    static String basis(boolean f, boolean fu, boolean l) {
        List<String> b = new ArrayList<>();
        if (f) b.add("成型工艺清单");
        if (fu) b.add("计划1PCS");
        if (l) b.add("计划1%");
        return b.isEmpty() ? "无(不出单/入库不拦)" : String.join("+", b);
    }

    static boolean hasMold(Connection c, String code) throws SQLException {
        try (PreparedStatement p = c.prepareStatement(
                "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.rd_mold_proc_head h"
                        + " WHERE LTRIM(RTRIM(ISNULL(h.[产品编号],N'')))=? AND ISNULL(h.asp_cancel,'N')<>'Y')"
                        + " THEN 1 ELSE 0 END")) {
            p.setString(1, code);
            try (ResultSet r = p.executeQuery()) { return r.next() && r.getInt(1) == 1; }
        }
    }

    static boolean planFreq(Connection c, String code, String mark) throws SQLException {
        String plan;
        try (PreparedStatement p = c.prepareStatement(
                "SELECT TOP 1 h.[单据编号] FROM dbo.rd_insp_plan_head h"
                        + " WHERE LTRIM(RTRIM(ISNULL(h.[产品编号],N'')))=? AND ISNULL(h.asp_cancel,'N')<>'Y'"
                        + " ORDER BY h.id DESC")) {
            p.setString(1, code);
            try (ResultSet r = p.executeQuery()) { plan = r.next() ? r.getString(1) : null; }
        }
        if (plan == null) return false;
        try (PreparedStatement p = c.prepareStatement(
                "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.rd_insp_plan_detail d WHERE d.[单据编号]=?"
                        + " AND ISNULL(d.asp_cancel,'N')<>'Y'"
                        + " AND CHARINDEX(?, UPPER(ISNULL(d.[检测频率],N'')))>0) THEN 1 ELSE 0 END")) {
            p.setString(1, plan);
            p.setString(2, mark.toUpperCase());
            try (ResultSet r = p.executeQuery()) { return r.next() && r.getInt(1) == 1; }
        }
    }
}
