import java.sql.*;
import java.util.*;

/** Probe2 — 复刻后端 queryFlat 的两条 SQL(COUNT / 分页,均带 OPTION(RECOMPILE)),
 *  通过 sp_executesql 参数化执行,多轮计时,观察稳定性。用法:java -cp lib\mssql-jdbc.jar Probe2.java */
public class Probe2 {
    static final String URL = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=15";

    public static void main(String[] a) throws Exception {
        String user = a.length > 0 ? a[0] : "yinjia";
        String pass = a.length > 1 ? a[1] : "Yinjia@2026";
        Map<String, String> cols = new LinkedHashMap<>();
        cols.put("v_stock_balance", "SELECT t.id AS __id, t.[仓库编码], t.[仓库名称], t.[存货编码], t.[存货名称], t.[规格型号], t.[单位], t.[现存量], t.[结存金额] FROM v_stock_balance t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.id DESC OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY");
        cols.put("v_stock_ledger", "SELECT t.id AS __id, t.[仓库编码], t.[仓库名称], t.[存货编码], t.[存货名称], t.[单据日期], t.[单据类型], t.[收入数量], t.[发出数量], t.[结存数量] FROM v_stock_ledger t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.id ASC OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY");
        cols.put("v_stock_summary", "SELECT t.id AS __id, t.[仓库编码], t.[仓库名称], t.[存货编码], t.[存货名称], t.[期次], t.[期初数量], t.[本期收入数量], t.[本期发出数量], t.[期末数量] FROM v_stock_summary t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.id DESC OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY");
        try (Connection c = DriverManager.getConnection(URL, user, pass)) {
            c.setAutoCommit(true);
            for (int round = 1; round <= 3; round++) {
                System.out.println("---- round " + round + " ----");
                for (Map.Entry<String, String> e : cols.entrySet()) {
                    String v = e.getKey();
                    run(c, "COUNT(recomp) " + v, "SELECT COUNT(*) FROM " + v + " t WHERE ISNULL(t.asp_cancel,'N')<>'Y'", true);
                    run(c, "PAGE(recomp)  " + v, e.getValue(), true);
                    run(c, "PAGE(nohint)  " + v, e.getValue(), false);
                }
            }
            System.out.println("---- 无 hint 的单列分页(对照) ----");
            for (String v : cols.keySet()) {
                run(c, "PAGE1COL(nohint) " + v, "SELECT t.id FROM " + v + " t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.id DESC OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY", false);
            }
        }
    }

    static void run(Connection c, String label, String sql, boolean recomp) {
        String s = recomp ? sql + " OPTION (RECOMPILE)" : sql;
        long t0 = System.currentTimeMillis();
        long n = -1;
        String err = null;
        try (PreparedStatement ps = c.prepareStatement(s)) {
            ps.setQueryTimeout(300);
            try (ResultSet rs = ps.executeQuery()) {
                n = 0;
                while (rs.next()) n++;
            }
        } catch (Exception ex) {
            err = ex.getMessage();
            if (err != null && err.length() > 100) err = err.substring(0, 100);
        }
        System.out.printf("  %-34s %7d ms rows=%d %s%n", label, System.currentTimeMillis() - t0, n, err == null ? "" : "ERR=" + err);
    }
}
