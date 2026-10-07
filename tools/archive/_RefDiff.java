import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.*;

/**
 * _RefDiff.java — 逐字段对照「当前库(污染后)」与「快照库 HSDZ_MES_RESTORE(污染前)」的参照源,产出修复清单。
 *   对齐键 = 位置档位(表头系 H / 明细系 D) + 中文标签 —— seq 随版式演进会变,不能按 seq 比;
 *   同名标签在表头与明细各有一行,必须分开对齐,故不用 label 单键。
 * 用法(在 tools/ 下): java -cp lib\mssql-jdbc.jar archive\_RefDiff.java [当前库] [快照库] [输出文件]
 */
public class _RefDiff {
    static final String[] PANELS = {"QC_RECV", "QC_INSP", "QC_RETURN", "PURCHASE_IN"};
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    record R(String label, String place, String refPanel, String refField, String displayField, String type) {
        String key() {
            return (place.contains("detail") ? "D" : "H") + "|" + label;
        }
    }

    static List<R> load(Connection c, String panel) throws SQLException {
        List<R> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT label, place, ISNULL(ref_panel,'') rp, ISNULL(ref_field,'') rf, ISNULL(display_field,'') df, data_type "
                        + "FROM yj_field WHERE panel_code=? ORDER BY seq, id")) {
            ps.setString(1, panel);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(new R(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6)));
                }
            }
        }
        return out;
    }

    public static void main(String[] a) throws Exception {
        String cur = a.length > 0 ? a[0] : "HSDZ_MES";
        String ref = a.length > 1 ? a[1] : "HSDZ_MES_RESTORE";
        Path out = Path.of(a.length > 2 ? a[2] : "archive/_refdiff.out");
        StringBuilder sb = new StringBuilder();
        sb.append("# 参照源修复清单(now=").append(cur).append(" ← snapshot=").append(ref).append(")\n\n");
        try (Connection cc = conn(cur); Connection cr = conn(ref)) {
            for (String p : PANELS) {
                List<R> cm = load(cc, p), rm = load(cr, p);
                Map<String, R> byKey = new HashMap<>(), byLabel = new HashMap<>();
                for (R r : rm) {
                    byKey.putIfAbsent(r.key(), r);
                    byLabel.putIfAbsent(r.label(), r);
                }
                List<String> hit = new ArrayList<>(), miss = new ArrayList<>();
                for (R c : cm) {
                    if (!"参照".equals(c.type())) continue;
                    boolean suspect = "GFDA".equals(c.refPanel()) && !c.label().contains("供应商");
                    if (!suspect) continue;
                    R s = byKey.get(c.key());
                    if (s == null) s = byLabel.get(c.label());
                    if (s == null) {
                        miss.add(String.format("  %-16s %-14s | now=GFDA.mc        | 快照无此字段(快照后新增)",
                                c.place(), c.label()));
                    } else {
                        hit.add(String.format("  %-16s %-16s | now=GFDA.%-8s | snapshot=%s.%s -> %s",
                                c.place(), c.label(), c.refField(), s.refPanel(), s.refField(), s.displayField()));
                    }
                }
                if (!hit.isEmpty()) {
                    sb.append("## ").append(p).append(" —— 可在快照找到正确值(").append(hit.size()).append(")\n");
                    hit.forEach(l -> sb.append(l).append('\n'));
                    sb.append('\n');
                }
                if (!miss.isEmpty()) {
                    sb.append("## ").append(p).append(" —— 快照无对应字段,需另定(").append(miss.size()).append(")\n");
                    miss.forEach(l -> sb.append(l).append('\n'));
                    sb.append('\n');
                }
            }
        }
        Files.writeString(out, sb.toString(), StandardCharsets.UTF_8);
        System.out.println("[ok] " + out.toAbsolutePath());
    }

    static Connection conn(String db) throws SQLException {
        return DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true", "yinjia", PASS);
    }
}
