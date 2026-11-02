import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 诊断探针:按 GO 分批执行一个迁移脚本,逐批打印 OK/FAIL(失败的打印该批首行),
 * 用来定位 DbSync 只报「Invalid column name '档'」却不说是哪一批的问题。
 * 用法(在 tools 目录): java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar archive/_mergecheck-20261029/_BatchProbe.java <脚本相对路径> [只跑前N批]
 */
public class _BatchProbe {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";user=yinjia;password=" + pass + ";encrypt=false;trustServerCertificate=true";
        String sql = Files.readString(Paths.get(a[0]), StandardCharsets.UTF_8);
        int limit = a.length > 1 ? Integer.parseInt(a[1]) : Integer.MAX_VALUE;
        List<String> batches = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : sql.split("\r?\n", -1)) {
            if (line.trim().matches("(?i)GO(\\s+\\d+)?")) { batches.add(cur.toString()); cur.setLength(0); }
            else cur.append(line).append('\n');
        }
        batches.add(cur.toString());
        try (Connection c = DriverManager.getConnection(url); Statement st = c.createStatement()) {
            st.execute("SET NOEXEC OFF");
            int i = 0;
            for (String b : batches) {
                i++;
                if (b.trim().isEmpty()) continue;
                if (i > limit) { System.out.println("-- 停在第 " + limit + " 批(未执行第 " + i + " 批) --"); break; }
                String head = b.trim().split("\r?\n")[0];
                try {
                    st.execute(b);
                    System.out.println("[OK]   batch " + i + "   " + head);
                } catch (SQLException e) {
                    System.out.println("[FAIL] batch " + i + "   " + head);
                    System.out.println("       " + e.getMessage());
                    break;
                }
            }
        }
    }
}
