import java.sql.*;
import java.nio.file.*;

/** 只读探针:导出四个库存视图的完整定义到文件(供整理《库存表清单》用) */
public class Qv {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
    static final String OUT = System.getProperty("out", "C:/INCER/YINJIA-MES/_scratch");

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            for (String v : new String[]{"v_stock_movement", "v_stock_balance", "v_stock_ledger", "v_stock_summary"}) {
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID(?)")) {
                    ps.setString(1, "dbo." + v);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            String def = rs.getString(1);
                            Path p = Path.of(OUT, v + ".sql");
                            Files.writeString(p, def, java.nio.charset.StandardCharsets.UTF_8);
                            System.out.println(v + " -> " + p + " (" + def.length() + " chars)");
                        } else {
                            System.out.println(v + " -> (定义取不到)");
                        }
                    }
                }
            }
        }
    }
}
