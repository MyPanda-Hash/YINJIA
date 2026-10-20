import java.io.*;
import java.sql.*;
import java.util.*;

/**
 * 只读全库扫描 v2(2026-10-19):只看**头表**,按各自的自然键找重复/孤儿/演示残留。
 */
public class _Scan2 {
    static PrintStream out;
    static Connection c;
    static final String MARK = "wo-flow-20261018";

    public static void main(String[] a) throws Exception {
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10", "yinjia", "Yinjia@2026");
        out.println("== DB " + db + " ==");

        section("A. 头表：自然键是否重复（未作废行）");
        List<String> heads = strings("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES"
                + " WHERE TABLE_TYPE='BASE TABLE'"
                + "   AND (TABLE_NAME LIKE 'bd\\_%' ESCAPE '\\' OR TABLE_NAME LIKE 'qc\\_%\\_head' ESCAPE '\\')"
                + " ORDER BY TABLE_NAME");
        for (String t : heads) {
            String key = hasCol(t, "单据编号") ? "单据编号" : (hasCol(t, "合同号") ? "合同号" : null);
            if (key == null || !hasCol(t, "asp_cancel")) continue;
            Integer dupRows = scalarInt("SELECT COUNT(*) FROM dbo.[" + t + "] WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " AND [" + key + "] IN (SELECT [" + key + "] FROM dbo.[" + t + "] WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " GROUP BY [" + key + "] HAVING COUNT(*)>1)");
            Integer all = scalarInt("SELECT COUNT(*) FROM dbo.[" + t + "] WHERE ISNULL(asp_cancel,'N')<>'Y'");
            if (dupRows != null && dupRows > 0) {
                out.println(String.format("[重复] %-22s 键=%-8s 总行 %-5s 重复 %s 行", t, key, all, dupRows));
                for (String[] r : rows("SELECT TOP 3 [" + key + "], COUNT(*) FROM dbo.[" + t + "]"
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY [" + key + "] HAVING COUNT(*)>1"
                        + " ORDER BY COUNT(*) DESC"))
                    out.println("        例: " + r[0] + " × " + r[1]);
            }
        }

        section("B. plang：工单号+行号 重复（本次问题的本体）");
        out.println("  未作废行总数: " + scalarInt("SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'"));
        out.println("  「工单号+行号」重复组数: " + scalarInt(
                "SELECT COUNT(*) FROM (SELECT pl_no, ISNULL(pl_xc,0) x FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'"
                        + " GROUP BY pl_no, ISNULL(pl_xc,0) HAVING COUNT(*)>1) x"));
        out.println("  重复行数: " + scalarInt(
                "SELECT COUNT(*) FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " AND EXISTS (SELECT 1 FROM dbo.plang q WHERE q.pl_no=p.pl_no"
                        + "   AND ISNULL(q.pl_xc,0)=ISNULL(p.pl_xc,0) AND q.id<>p.id AND ISNULL(q.asp_cancel,'N')<>'Y')"));
        for (String[] r : rows("SELECT TOP 8 pl_no, COUNT(*) AS n, COUNT(DISTINCT ISNULL(khdm,N'')) AS 客户数 FROM dbo.plang"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY pl_no, ISNULL(pl_xc,0) HAVING COUNT(*)>1 ORDER BY COUNT(DISTINCT ISNULL(khdm,N'')) DESC, COUNT(*) DESC"))
            out.println("     " + r[0] + " 重复 " + r[1] + " 行（不同客户 " + r[2] + " 个）");

        section("C. 演示造数标记 asp_user1='" + MARK + "' 落在哪些表");
        for (String t : strings("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS"
                + " WHERE COLUMN_NAME='asp_user1' GROUP BY TABLE_NAME ORDER BY TABLE_NAME")) {
            if (!isTable(t)) continue;
            Integer n = scalarInt("SELECT COUNT(*) FROM dbo.[" + t + "] WHERE asp_user1='" + MARK + "'");
            if (n != null && n > 0) out.println(String.format("  %-34s %d 行", t, n));
        }

        section("D. 组装成品检验单：按「工单号+行号」一对多（会串到别行）");
        out.println("  组数: " + scalarInt("SELECT COUNT(*) FROM (SELECT 工单号, ISNULL(工单行号,0) x"
                + " FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'"
                + " GROUP BY 工单号, ISNULL(工单行号,0) HAVING COUNT(*)>1) x"));
        for (String[] r : rows("SELECT TOP 5 工单号, ISNULL(工单行号,0) AS x, COUNT(*) AS n, MIN(单据编号) AS 例"
                + " FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'"
                + " GROUP BY 工单号, ISNULL(工单行号,0) HAVING COUNT(*)>1 ORDER BY COUNT(*) DESC"))
            out.println("     " + r[0] + "#" + r[1] + " × " + r[2] + "（例 " + r[3] + "）");

        section("E. 头/明细一致性（抽样）");
        out.println("  产成品入库单无有效明细: " + scalarInt("SELECT COUNT(*) FROM dbo.bd_finish_in h"
                + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND NOT EXISTS (SELECT 1 FROM dbo.bl_finish_in d"
                + "   WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y')") + " 张");
        out.println("  组装成品检验单无有效明细: " + scalarInt("SELECT COUNT(*) FROM dbo.qc_asm_insp_head h"
                + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND NOT EXISTS (SELECT 1 FROM dbo.qc_asm_insp_detail d"
                + "   WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y')") + " 张");
        out.println("  已审核但无单据状态行(入库单): " + scalarInt("SELECT COUNT(*) FROM dbo.bd_finish_in h"
                + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status s"
                + "   WHERE s.panel_code='FINISH_IN' AND s.doc_no=h.[单据编号])") + " 张");

        section("F. 报工行 slcj：工单行号/产线 是否有外部脏值");
        out.println("  未作废报工行: " + scalarInt("SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y'"));
        out.println("  生产线='0' 或 空: " + scalarInt("SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y'"
                + " AND ISNULL(scx,N'') IN (N'', N'0')"));
        out.println("  报工单号为空(外部直写指纹): " + scalarInt("SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y'"
                + " AND ISNULL(报工单号,N'')=N''"));
        c.close();
    }

    static boolean isTable(String t) {
        Integer n = scalarInt("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='" + t + "' AND TABLE_TYPE='BASE TABLE'");
        return n != null && n > 0;
    }

    static boolean hasCol(String t, String col) {
        Integer n = scalarInt("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='" + t + "' AND COLUMN_NAME='" + col + "'");
        return n != null && n > 0;
    }

    static void section(String s) { out.println("\n---- " + s + " ----"); }

    static List<String> strings(String sql) {
        List<String> l = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) l.add(rs.getString(1));
        } catch (SQLException e) { out.println("[SQL失败] " + e.getMessage()); }
        return l;
    }

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
