import java.sql.*;
import java.util.*;

/** 库存报表三面版取数耗时探针(只读)。用法:java -cp lib\mssql-jdbc.jar Probe.java */
public class Probe {
    static String URL = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=15";

    public static void main(String[] a) throws Exception {
        String user = a.length > 0 ? a[0] : "yinjia";
        String pass = a.length > 1 ? a[1] : "Yinjia@2026";
        try (Connection c = DriverManager.getConnection(URL, user, pass)) {
            c.setAutoCommit(true);
            String[] views = {"v_stock_balance", "v_stock_ledger", "v_stock_summary", "kucun"};
            for (String v : views) {
                time(c, "COUNT " + v, "SELECT COUNT(*) FROM " + v + " t WHERE ISNULL(t.asp_cancel,'N')<>'Y'");
            }
            for (String v : views) {
                time(c, "PAGE50 " + v, "SELECT t.id FROM " + v + " t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.id DESC OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY");
            }
            for (String v : views) {
                time(c, "RECOMPILE-PAGE50 " + v, "SELECT t.id FROM " + v + " t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.id DESC OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY OPTION (RECOMPILE)");
            }
            // 重放(第二次同一条,看是否命中坏计划)
            for (String v : views) {
                time(c, "PAGE50-AGAIN " + v, "SELECT t.id FROM " + v + " t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.id DESC OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY");
            }
        }
    }

    static void time(Connection c, String label, String sql) {
        long t0 = System.currentTimeMillis();
        long n = -1;
        String err = null;
        try (Statement st = c.createStatement()) {
            st.setQueryTimeout(300);
            try (ResultSet rs = st.executeQuery(sql)) {
                n = 0;
                while (rs.next()) n++;
            }
        } catch (Exception e) {
            err = e.getMessage();
            if (err != null && err.length() > 120) err = err.substring(0, 120);
        }
        System.out.printf("%-28s %7d ms  rows=%d %s%n", label, System.currentTimeMillis() - t0, n, err == null ? "" : "ERR=" + err);
    }
}
