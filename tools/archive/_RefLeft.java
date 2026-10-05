import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;

/** _RefLeft.java — 两账套:列出=仍指向 GFDA 且非供应商语义的参照字段(应为 0) */
public class _RefLeft {
    public static void main(String[] a) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            sb.append("## ").append(db).append('\n');
            try (Connection c = DriverManager.getConnection(
                    "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true",
                    "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
                int n = 0;
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT panel_code, place, seq, label, ref_panel, ref_field, display_field FROM yj_field "
                                + "WHERE panel_code IN ('QC_RECV','QC_INSP','SL_RECV') AND data_type=N'参照' "
                                + "AND ref_panel='GFDA' AND label NOT LIKE N'%供应商%' ORDER BY panel_code, place, seq")) {
                    while (rs.next()) {
                        n++;
                        sb.append(String.format("   残留 %-10s %-14s %-4d %-12s -> %s.%s -> %s%n",
                                rs.getString(1), rs.getString(2), rs.getInt(3), rs.getString(4),
                                rs.getString(5), rs.getString(6), rs.getString(7)));
                    }
                }
                sb.append("   越界残留 = ").append(n).append("(应为 0)\n");
                sb.append("   -- 四单参照字段现状 --\n");
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT panel_code, COUNT(*) total, SUM(CASE WHEN ref_panel='GFDA' THEN 1 ELSE 0 END) gfda FROM yj_field "
                                + "WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN') AND data_type=N'参照' "
                                + "GROUP BY panel_code ORDER BY panel_code")) {
                    while (rs.next()) sb.append(String.format("   %-12s 参照 %d 个,其中 GFDA %d%n", rs.getString(1), rs.getInt(2), rs.getInt(3)));
                }
            } catch (Exception e) {
                sb.append("   [ERR] ").append(e.getMessage()).append('\n');
            }
            sb.append('\n');
        }
        Path out = Path.of("archive/_refleft.out");
        Files.writeString(out, sb.toString(), StandardCharsets.UTF_8);
        System.out.println("[ok] " + out.toAbsolutePath());
    }
}
