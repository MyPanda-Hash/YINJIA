import java.sql.*;
import java.util.*;

/** 只读探针：本地两账套 yj_schema_log 现状 + 未登记迁移清单（2026-11-24 合并验证用）。 */
public class DbProbe {
    static final String[] DBS = {"HSDZ_MES", "HSDZ_MES_TEST"};

    public static void main(String[] a) throws Exception {
        String url0 = "jdbc:sqlserver://127.0.0.1:1433;encrypt=false;trustServerCertificate=true";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        List<String> scripts = java.nio.file.Files.readAllLines(java.nio.file.Path.of("tools/db-migrations.txt"));
        LinkedHashSet<String> want = new LinkedHashSet<>();
        for (String raw : scripts) {
            String s = raw.replace("\uFEFF", "").trim();
            if (s.isEmpty() || s.startsWith("#")) continue;
            int sp = s.indexOf(' ');
            if (sp > 0) s = s.substring(0, sp);
            if (s.endsWith(".sql")) want.add(s);
        }
        System.out.println("迁移链登记脚本数: " + want.size());
        for (String db : DBS) {
            try (Connection c = DriverManager.getConnection(url0 + ";databaseName=" + db, user, pass)) {
                System.out.println("\n===== " + db + " =====");
                try (Statement st = c.createStatement()) {
                    try (ResultSet rs = st.executeQuery(
                            "SELECT COUNT(*), CONVERT(varchar(19), MAX(applied_at), 120) FROM yj_schema_log")) {
                        rs.next();
                        System.out.println("yj_schema_log 行数=" + rs.getInt(1) + "  MAX(applied_at)=" + rs.getString(2));
                    } catch (SQLException e) {
                        System.out.println("yj_schema_log 不存在/不可读: " + e.getMessage());
                    }
                    Set<String> have = new HashSet<>();
                    try (ResultSet rs = st.executeQuery("SELECT script_name FROM yj_schema_log")) {
                        while (rs.next()) have.add(rs.getString(1).trim());
                    } catch (SQLException ignore) {}
                    List<String> missing = new ArrayList<>();
                    for (String s : want) if (!have.contains(s)) missing.add(s);
                    System.out.println("链上未登记: " + missing.size() + " 条");
                    for (String s : missing) System.out.println("  PENDING " + s);
                    // 关键对象探针
                    try (ResultSet rs = st.executeQuery(
                            "SELECT ISNULL(OBJECT_ID('dbo.qc_bhc_cp'),0), ISNULL(OBJECT_ID('dbo.qc_bhc_cp_detail'),0), "
                          + "ISNULL(COL_LENGTH('dbo.bl_finish_in',N'生产数量'),-1), ISNULL(COL_LENGTH('dbo.qc_bhc',N'批次号'),-1)")) {
                        rs.next();
                        System.out.println("对象: qc_bhc_cp=" + rs.getObject(1) + " qc_bhc_cp_detail=" + rs.getObject(2)
                                + " bl_finish_in.生产数量=" + rs.getObject(3) + " qc_bhc.批次号=" + rs.getObject(4));
                    }
                    try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM yj_panel")) {
                        rs.next(); System.out.println("yj_panel 行数=" + rs.getInt(1));
                    } catch (SQLException ignore) {}
                    try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM yj_field")) {
                        rs.next(); System.out.println("yj_field 行数=" + rs.getInt(1));
                    } catch (SQLException ignore) {}
                }
            }
        }
    }
}
