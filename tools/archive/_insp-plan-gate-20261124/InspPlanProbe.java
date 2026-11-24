import java.sql.*;

/** 只读摸底:三张计划表/入库明细/面板字段 的列与样本值(2026-11-24,口径改造前)。 */
public class InspPlanProbe {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        try (Connection c = DriverManager.getConnection(String.format(URL, db), USER, PASS)) {
            System.out.println("== DB " + db + " ==");
            cols(c, "rd_insp_plan_head");
            cols(c, "rd_insp_plan_detail");
            cols(c, "rd_mold_proc_head");
            cols(c, "rd_mold_proc_detail");
            cols(c, "bl_finish_in");
            cols(c, "bd_finish_in");
            dump(c, "SELECT TOP 8 [检测频率], COUNT(*) AS n FROM dbo.rd_insp_plan_detail"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY [检测频率] ORDER BY n DESC");
            dump(c, "SELECT COUNT(DISTINCT h.[产品编号]) AS 有计划产品数,"
                    + " (SELECT COUNT(DISTINCT h2.[产品编号]) FROM dbo.rd_insp_plan_head h2"
                    + "   JOIN dbo.rd_insp_plan_detail d2 ON d2.[单据编号]=h2.[单据编号]"
                    + "   WHERE ISNULL(h2.asp_cancel,'N')<>'Y' AND ISNULL(d2.asp_cancel,'N')<>'Y'"
                    + "     AND d2.[检测频率] LIKE N'%1PCS%') AS 有1PCS产品数,"
                    + " (SELECT COUNT(DISTINCT h3.[产品编号]) FROM dbo.rd_insp_plan_head h3"
                    + "   JOIN dbo.rd_insp_plan_detail d3 ON d3.[单据编号]=h3.[单据编号]"
                    + "   WHERE ISNULL(h3.asp_cancel,'N')<>'Y' AND ISNULL(d3.asp_cancel,'N')<>'Y'"
                    + "     AND d3.[检测频率] LIKE N'%1%') AS 有百分号产品数"
                    + " FROM dbo.rd_insp_plan_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'");
            dump(c, "SELECT TOP 5 [产品编号] FROM dbo.rd_mold_proc_head WHERE ISNULL(asp_cancel,'N')<>'Y'");
            dump(c, "SELECT COUNT(*) AS 成型清单产品数 FROM (SELECT DISTINCT [产品编号] FROM dbo.rd_mold_proc_head"
                    + "  WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([产品编号],N'')<>N'') t");
            dump(c, "SELECT panel_code, label, col_name, seq, visible, hidden, place, data_type, width"
                    + " FROM dbo.yj_field WHERE panel_code=N'FINISH_IN' ORDER BY seq, id");
            dump(c, "SELECT panel_code, label, col_name, seq, visible FROM dbo.yj_field"
                    + " WHERE panel_code=N'INV' AND (label LIKE N'%过程%' OR col_name LIKE N'%过程%')");
            dump(c, "SELECT COUNT(*) AS 勾了过程检验的商品数 FROM dbo.bs_inv WHERE ISNULL([是否过程检验],0)=1");
        }
    }

    static void cols(Connection c, String t) throws SQLException {
        System.out.println("-- " + t);
        try (PreparedStatement p = c.prepareStatement(
                "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS"
                        + " WHERE TABLE_NAME=? ORDER BY ORDINAL_POSITION")) {
            p.setString(1, t);
            try (ResultSet r = p.executeQuery()) {
                StringBuilder sb = new StringBuilder();
                int n = 0;
                while (r.next()) {
                    n++;
                    sb.append(r.getString(1)).append(':').append(r.getString(2));
                    if (!"YES".equals(r.getString(3))) sb.append('!');
                    sb.append("  ");
                    if (sb.length() > 4000) { System.out.println("   " + sb); sb.setLength(0); }
                }
                System.out.println("   (" + n + ") " + sb);
            }
        } catch (Exception e) {
            System.out.println("   [skip] " + e.getMessage());
        }
    }

    static void dump(Connection c, String sql) {
        System.out.println("-- " + sql.replaceAll("\\s+", " ").substring(0, Math.min(90, sql.length())) + " ...");
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = m.getColumnCount(), rows = 0;
            while (r.next() && rows < 40) {
                rows++;
                StringBuilder sb = new StringBuilder("   ");
                for (int i = 1; i <= n; i++) sb.append(m.getColumnLabel(i)).append('=').append(r.getString(i)).append(" | ");
                System.out.println(sb);
            }
            if (rows == 0) System.out.println("   (0 行)");
        } catch (Exception e) {
            System.out.println("   [ERR] " + e.getMessage());
        }
    }
}
