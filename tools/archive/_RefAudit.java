import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.*;

/**
 * _RefAudit.java — 参照完整性体检:逐条 ref_panel/ref_field,核对目标面板是否存在同名字段(label/dataName),
 * 并按运行期返回行键(见 _probe-ref-keys.ps1)判定 ref_field/display_field 能否取值。
 * 用法(在 tools/ 下): java -cp lib\mssql-jdbc.jar archive\_RefAudit.java [库名] [输出文件]
 */
public class _RefAudit {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        Path out = Path.of(a.length > 1 ? a[1] : "archive/_refaudit.out");
        StringBuilder sb = new StringBuilder();
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true",
                "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {

            // 目标面板的 label 集合(按 label 与 col_name 两种口径)
            Map<String, Set<String>> byLabel = new HashMap<>(), byCol = new HashMap<>();
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT panel_code, label, col_name FROM yj_field")) {
                while (rs.next()) {
                    byLabel.computeIfAbsent(rs.getString(1), k -> new HashSet<>()).add(rs.getString(2));
                    byCol.computeIfAbsent(rs.getString(1), k -> new HashSet<>()).add(rs.getString(3));
                }
            }
            Set<String> panels = new HashSet<>();
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT panel_code FROM yj_panel")) {
                while (rs.next()) panels.add(rs.getString(1));
            }

            int total = 0, badPanel = 0, badField = 0, badDisplay = 0;
            sb.append("# 参照完整性体检 db=").append(db).append("\n\n");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT panel_code, place, seq, label, ref_panel, ref_field, display_field FROM yj_field "
                            + "WHERE data_type = N'参照' AND ISNULL(ref_panel,'') <> '' ORDER BY panel_code, place, seq")) {
                while (rs.next()) {
                    total++;
                    String pc = rs.getString(1), rp = rs.getString(5), rf = rs.getString(6), df = rs.getString(7);
                    List<String> issues = new ArrayList<>();
                    if (!panels.contains(rp)) issues.add("目标面板不存在");
                    else {
                        Set<String> L = byLabel.getOrDefault(rp, Set.of()), C = byCol.getOrDefault(rp, Set.of());
                        if (rf != null && !L.contains(rf) && !C.contains(rf)) issues.add("ref_field 在目标面板无同名字段: " + rf);
                        if (df != null && !df.isEmpty() && !L.contains(df) && !C.contains(df)) issues.add("display_field 在目标面板无同名字段: " + df);
                    }
                    if (issues.isEmpty()) continue;
                    if (issues.stream().anyMatch(s -> s.startsWith("目标面板"))) badPanel++;
                    else {
                        if (issues.stream().anyMatch(s -> s.startsWith("ref_field"))) badField++;
                        if (issues.stream().anyMatch(s -> s.startsWith("display_field"))) badDisplay++;
                    }
                    sb.append(String.format("%-12s %-14s %-4d %-14s -> %-10s %-14s %-14s | %s%n",
                            pc, rs.getString(2), rs.getInt(3), rs.getString(4), rp, rf, df, String.join("; ", issues)));
                }
            }
            sb.append("\n合计参照字段 ").append(total).append(" 条;异常:面板 ").append(badPanel)
                    .append("、ref_field ").append(badField).append("、display_field ").append(badDisplay).append('\n');
            Files.writeString(out, sb.toString(), StandardCharsets.UTF_8);
            System.out.printf("[ok] %s  total=%d badPanel=%d badRefField=%d badDisplay=%d%n", out.toAbsolutePath(), total, badPanel, badField, badDisplay);
        }
    }
}
