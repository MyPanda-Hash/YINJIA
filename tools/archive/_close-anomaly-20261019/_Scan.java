import java.io.*;
import java.sql.*;
import java.util.*;

/**
 * 只读全库扫描(2026-10-19):找「同号双客户/重复键/孤儿明细/演示造数残留」同类问题。
 * 用法: java ... _Scan HSDZ_MES
 */
public class _Scan {
    static PrintStream out;
    static Connection c;
    static final String MARK = "wo-flow-20261018";

    public static void main(String[] a) throws Exception {
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10", "yinjia", "Yinjia@2026");
        out.println("== DB " + db + " ==");

        section("A. 带「单据编号/单号」列的**头表**里,未作废行是否有重复键");
        List<String[]> heads = rows(
                "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS"
                        + " WHERE COLUMN_NAME IN (N'单据编号', N'单号', N'加工单号')"
                        + "   AND TABLE_NAME NOT LIKE '%_detail' AND TABLE_NAME NOT LIKE '%明细%'"
                        + " ORDER BY TABLE_NAME, COLUMN_NAME");
        for (String[] h : heads) {
            String t = h[0], col = h[1];
            if (!hasCol(t, "asp_cancel")) continue;
            String where = " WHERE ISNULL(asp_cancel,'N')<>'Y'";
            Integer dupGroups = scalarInt("SELECT COUNT(*) FROM (SELECT [" + col + "] FROM dbo.[" + t + "]"
                    + where + " GROUP BY [" + col + "] HAVING COUNT(*)>1) x");
            Integer dupRows = scalarInt("SELECT COUNT(*) FROM dbo.[" + t + "]" + where
                    + " AND [" + col + "] IN (SELECT [" + col + "] FROM dbo.[" + t + "]" + where
                    + " GROUP BY [" + col + "] HAVING COUNT(*)>1)");
            Integer all = scalarInt("SELECT COUNT(*) FROM dbo.[" + t + "]" + where);
            if (dupGroups != null && dupGroups > 0) {
                out.println(String.format("[重复] %s.%s : 总行 %s,重复键 %s 组 / %s 行",
                        t, col, all, dupGroups, dupRows));
                for (String[] r : rows("SELECT TOP 3 [" + col + "] AS k, COUNT(*) AS n FROM dbo.[" + t + "]"
                        + where + " GROUP BY [" + col + "] HAVING COUNT(*)>1 ORDER BY COUNT(*) DESC"))
                    out.println("        例: " + r[0] + " × " + r[1]);
            }
        }

        section("B. 明细表里有「单据编号」但头表找不到(孤儿)");
        List<String[]> details = rows(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME=N'单据编号'"
                        + "   AND (TABLE_NAME LIKE 'bl\\_%' ESCAPE '\\' OR TABLE_NAME LIKE '%\\_detail' ESCAPE '\\')"
                        + " GROUP BY TABLE_NAME ORDER BY TABLE_NAME");
        for (String[] d : details) {
            String t = d[0];
            String head = headOf(t);
            if (head == null || !tableExists(head)) continue;
            if (!hasCol(t, "asp_cancel")) continue;
            Integer orphan = scalarInt("SELECT COUNT(*) FROM dbo.[" + t + "] d"
                    + " WHERE ISNULL(d.asp_cancel,'N')<>'Y'"
                    + "   AND NOT EXISTS (SELECT 1 FROM dbo.[" + head + "] h WHERE h.[单据编号]=d.[单据编号])");
            if (orphan != null && orphan > 0) out.println("[孤儿] " + t + " → " + head + " : " + orphan + " 行");
        }

        section("C. 演示造数标记 asp_user1='" + MARK + "' 落在哪些表");
        for (String[] t : rows("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS"
                + " WHERE COLUMN_NAME='asp_user1' GROUP BY TABLE_NAME ORDER BY TABLE_NAME")) {
            String tb = t[0];
            Integer n = scalarInt("SELECT COUNT(*) FROM dbo.[" + tb + "] WHERE asp_user1='" + MARK + "'");
            if (n != null && n > 0) out.println(String.format("  %-32s %d 行", tb, n));
        }

        section("D. 组装成品检验单:按「工单号+行号」是否一对多(会串到别行)");
        Integer multi = scalarInt("SELECT COUNT(*) FROM (SELECT 工单号, ISNULL(工单行号,0) x"
                + " FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'"
                + " GROUP BY 工单号, ISNULL(工单行号,0) HAVING COUNT(*)>1) x");
        out.println("  「工单号+行号」有多张检验单的组数: " + multi);
        for (String[] r : rows("SELECT TOP 5 工单号, ISNULL(工单行号,0) AS x, COUNT(*) AS n, MIN(单据编号) AS 例"
                + " FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'"
                + " GROUP BY 工单号, ISNULL(工单行号,0) HAVING COUNT(*)>1 ORDER BY COUNT(*) DESC"))
            out.println("     " + r[0] + "#" + r[1] + " × " + r[2] + "（例 " + r[3] + "）");

        section("E. 关键单据的「状态】与「下游事实」是否自相矛盾(抽样)");
        // 入库单已审核但明细实收=0 / 明细存在但头作废
        Integer fiBad = scalarInt("SELECT COUNT(*) FROM dbo.bd_finish_in h WHERE ISNULL(h.asp_cancel,'N')<>'Y'"
                + " AND NOT EXISTS (SELECT 1 FROM dbo.bl_finish_in d WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y')");
        out.println("  产成品入库单无有效明细: " + fiBad + " 张");
        Integer qcBad = scalarInt("SELECT COUNT(*) FROM dbo.qc_asm_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'"
                + " AND NOT EXISTS (SELECT 1 FROM dbo.qc_asm_insp_detail d WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y')");
        out.println("  组装成品检验单无有效明细: " + qcBad + " 张");
        c.close();
    }

    static String headOf(String t) {
        if (t.startsWith("bl_")) return "bd_" + t.substring(3);
        if (t.endsWith("_detail")) return t.substring(0, t.length() - 7) + "_head";
        return null;
    }

    static boolean hasCol(String t, String col) {
        Integer n = scalarInt("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='" + t
                + "' AND COLUMN_NAME='" + col + "'");
        return n != null && n > 0;
    }

    static boolean tableExists(String t) { return hasCol(t, "单据编号"); }

    static void section(String s) { out.println("\n---- " + s + " ----"); }

    static List<String[]> rows(String sql) {
        List<String[]> l = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            int n = rs.getMetaData().getColumnCount();
            while (rs.next()) {
                String[] r = new String[n];
                for (int i = 0; i < n; i++) r[i] = rs.getString(i + 1);
                l.add(r);
            }
        } catch (SQLException e) { out.println("[SQL失败] " + e.getMessage()); }
        return l;
    }

    static Integer scalarInt(String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            return rs.next() ? rs.getInt(1) : null;
        } catch (SQLException e) { return null; }
    }
}
