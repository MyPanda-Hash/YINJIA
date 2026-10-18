import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * _QChain.java — 迁移链 vs yj_schema_log 逐条对账:找出「排在失败脚本之后、因而永远轮不到」的脚本。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_sysadmin-dm-migrate-1020\_QChain.java HSDZ_MES
 */
public class _QChain {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

        List<String> chain = new ArrayList<>();
        for (String line : Files.readAllLines(Paths.get("db-migrations.txt"))) {
            String t = line.trim();
            if (t.isEmpty() || t.startsWith("#") || t.startsWith("--")) continue;
            if (t.endsWith(".sql")) chain.add(t);
        }
        Map<String, java.time.LocalDateTime> logged = new LinkedHashMap<>();
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT script_name, applied_at FROM yj_schema_log")) {
            while (rs.next()) {
                Timestamp ts = rs.getTimestamp(2);
                logged.put(rs.getString(1), ts == null ? null : ts.toLocalDateTime());
            }
        }

        String blocker = "migrate-sysadmin-panels-to-dm-20261018.sql";
        int bi = chain.indexOf(blocker);
        System.out.println("===== " + db + " =====");
        System.out.println("链上共 " + chain.size() + " 条;阻塞脚本位置 = " + (bi < 0 ? "未在链上" : ("第 " + (bi + 1) + " 条")));
        System.out.println("已登记 " + logged.size() + " 条");

        int notLogged = 0;
        List<String> after = new ArrayList<>();
        for (int i = 0; i < chain.size(); i++) {
            String s = chain.get(i);
            if (!logged.containsKey(s)) {
                notLogged++;
                if (bi >= 0 && i > bi) after.add(s);
            }
        }
        System.out.println("链上未登记总数 = " + notLogged);
        System.out.println("--- 排在阻塞脚本之后、且未登记的(这些才是被挡住的) ---");
        if (after.isEmpty()) System.out.println("  (0 —— 没有任何脚本被挡住)");
        else for (String s : after) System.out.println("  " + s);

        System.out.println("--- 链上排它之前的未登记(与本次失败无关) ---");
        int before = 0;
        for (int i = 0; bi >= 0 && i < bi; i++) {
            String s = chain.get(i);
            if (!logged.containsKey(s)) { before++; System.out.println("  " + s); }
        }
        if (before == 0) System.out.println("  (0)");

        System.out.println("--- 链上重复登记(同名出现多次) ---");
        Map<String, Integer> cnt = new LinkedHashMap<>();
        for (String s : chain) cnt.merge(s, 1, Integer::sum);
        int dup = 0;
        for (var e : cnt.entrySet()) if (e.getValue() > 1) { dup++; System.out.println("  " + e.getKey() + " × " + e.getValue()); }
        if (dup == 0) System.out.println("  (0)");
    }
}
