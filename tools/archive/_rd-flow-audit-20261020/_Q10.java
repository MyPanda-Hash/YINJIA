import java.sql.*;

/** 只读:为什么测试账套 FourDocAudit 缺 qc_return 的 4 个 ERP 列 —— 查脚本登记 + 列是否存在 + 差异。 */
public class _Q10 {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
            String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
            try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
                System.out.println("== " + db + " ==");
                q(c, "脚本登记", "SELECT ISNULL(CONVERT(varchar(19), applied_at, 120),'(未登记)') + ' ' + ISNULL(script_name,'-') FROM yj_schema_log WHERE script_name LIKE N'%qcreturn-erp%' OR script_name LIKE N'%fourdoc%' ORDER BY script_name");
                q(c, "qc_return ERP 列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_return') AND name IN (N'是否已转ERP',N'ERP单号',N'转ERP操作人',N'转ERP时间') ORDER BY name");
                q(c, "qc_return 列数", "SELECT CAST(COUNT(*) AS varchar) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_return')");
                q(c, "yj_field 四单偏离(qc_return)", "SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RETURN'");
            }
        }
    }

    static void q(Connection c, String label, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            boolean any = false;
            while (rs.next()) { any = true; System.out.println("  " + label + ": " + rs.getString(1)); }
            if (!any) System.out.println("  " + label + ": (空)");
        } catch (SQLException e) {
            System.out.println("  " + label + ": ERR " + e.getMessage());
        }
    }
}
