import java.sql.*;
import java.util.*;

/** 只读:查清在册成型报工(scjl 工序=成型)到底锚到哪一行工单行 —— 门禁判据的取数可靠性取证。 */
public class AnchorProbe {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("== " + db + " ==");
            show(c, "报工行(scjl 工序=成型)",
                    "SELECT id, [报工单号] AS rep, gldh AS wo, ISNULL(gxdm,N'') AS op, ISNULL(sl,0) AS qty,"
                  + " ISNULL(gd_id,0) AS gd_id, ISNULL([工单行号],0) AS xc, ISNULL([批次号],N'') AS batch,"
                  + " ISNULL(wgzt,'N') AS wgzt, ISNULL(asp_cancel,'N') AS cancel FROM dbo.scjl WHERE gxdm = N'成型'");
            show(c, "plang_pc 薄记录(被上面那条报工指向的)",
                    "SELECT pc.id AS pcid, pc.plang_id, pc.pl_no, ISNULL(pc.pl_xc,0) AS xc, ISNULL(pc.[批次号],N'') AS batch,"
                  + " ISNULL(pc.asp_cancel,'N') AS cancel FROM dbo.plang_pc pc"
                  + " WHERE pc.id IN (SELECT gd_id FROM dbo.scjl WHERE gxdm = N'成型' AND ISNULL(gd_id,0) > 0)");
            show(c, "对应 plang 行",
                    "SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.dm,N'') AS dm, ISNULL(p.pl_sl,0) AS pl_sl,"
                  + " ISNULL(p.[批次号],N'') AS batch, ISNULL(p.[工艺路线],N'') AS route,"
                  + " ISNULL(p.[当前工序],N'') AS cur, ISNULL(p.[完工状态],N'') AS done, ISNULL(p.ja,'N') AS ja,"
                  + " ISNULL(p.asp_cancel,'N') AS cancel FROM dbo.plang p"
                  + " WHERE p.id IN (SELECT pc.plang_id FROM dbo.plang_pc pc"
                  + "   WHERE pc.id IN (SELECT gd_id FROM dbo.scjl WHERE gxdm = N'成型' AND ISNULL(gd_id,0) > 0))");
            show(c, "该工单所有行(看是不是锚到了别的行)",
                    "SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.[批次号],N'') AS batch,"
                  + " ISNULL(p.asp_cancel,'N') AS cancel FROM dbo.plang p"
                  + " WHERE p.pl_no IN (SELECT gldh FROM dbo.scjl WHERE gxdm = N'成型') ORDER BY p.pl_no, p.pl_xc");
            show(c, "plang_pc.plang_id=1127 在 plang 里存在吗 / plang 范围",
                    "SELECT (SELECT COUNT(*) FROM dbo.plang WHERE id=1127) AS 存在1127,"
                  + " (SELECT MAX(id) FROM dbo.plang) AS plang最大id,"
                  + " (SELECT COUNT(*) FROM dbo.plang) AS plang行数,"
                  + " (SELECT COUNT(*) FROM dbo.plang_pc) AS pc行数,"
                  + " (SELECT COUNT(*) FROM dbo.plang_pc pc WHERE NOT EXISTS"
                  + "   (SELECT 1 FROM dbo.plang p WHERE p.id = pc.plang_id)) AS pc悬空行");
            show(c, "GD-2026-10-0007 的 plang_pc 行",
                    "SELECT pc.id AS pcid, pc.plang_id, pc.pl_no, ISNULL(pc.pl_xc,0) AS xc,"
                  + " ISNULL(pc.scx,N'') AS scx, ISNULL(pc.asp_cancel,'N') AS cancel FROM dbo.plang_pc pc"
                  + " WHERE pc.pl_no = N'GD-2026-10-0007'");
            show(c, "wo_process_line 台账(预排/落实状态)",
                    "SELECT 工单号, ISNULL(工单行id,0) AS rowid, ISNULL(工序,N'') AS op, ISNULL(工序序,0) AS seq,"
                  + " ISNULL(计划数量,0) AS [plan], ISNULL(状态,N'') AS st, ISNULL(计划生产线,N'') AS planline,"
                  + " ISNULL(实际生产线,N'') AS outline FROM dbo.wo_process_line"
                  + " WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 工单号, ISNULL(工序序,999)");
        }
    }

    static void show(Connection c, String title, String sql) {
        System.out.println("--- " + title + " ---");
        try (Statement st = c.createStatement(); ResultSet r = st.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) h.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
            System.out.println(h);
            while (r.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) b.append(i > 1 ? " | " : "").append(r.getString(i));
                System.out.println(b);
            }
        } catch (SQLException e) {
            System.out.println("[SQL 失败] " + e.getMessage());
        }
    }
}
