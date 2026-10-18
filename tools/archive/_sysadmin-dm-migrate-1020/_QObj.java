import java.sql.*;

/**
 * _QObj.java — 完工明细相关的对象/元数据到底缺哪些(面板、视图、字段、授权)。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_sysadmin-dm-migrate-1020\_QObj.java HSDZ_MES
 */
public class _QObj {
    static Connection c;
    static String s(String sql, Object... a) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < a.length; i++) ps.setObject(i + 1, a[i]);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? String.valueOf(rs.getObject(1)) : "-"; }
        }
    }
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                + ";encrypt=false;trustServerCertificate=true");
        System.out.println("===== " + db + " =====");
        System.out.println("  scjl 表              : " + s("SELECT CASE WHEN OBJECT_ID(N'dbo.scjl','U') IS NULL THEN N'缺失' ELSE N'存在' END"));
        System.out.println("  v_wo_completion_detail: " + s("SELECT CASE WHEN OBJECT_ID(N'dbo.v_wo_completion_detail','V') IS NULL THEN N'缺失' ELSE N'存在' END"));
        System.out.println("  yj_panel 行          : " + s("SELECT COUNT(*) FROM yj_panel WHERE panel_code=N'WO_COMPLETION_LIST'"));
        System.out.println("  yj_field 行          : " + s("SELECT COUNT(*) FROM yj_field WHERE panel_code=N'WO_COMPLETION_LIST'"));
        System.out.println("  yj_role_panel 行     : " + s("SELECT COUNT(*) FROM yj_role_panel WHERE panel_code=N'WO_COMPLETION_LIST'"));
        System.out.println("--- 同类报表面板(WO_REPORT_LIST)对照 ---");
        System.out.println("  WO_REPORT_LIST 面板/字段/授权: "
                + s("SELECT COUNT(*) FROM yj_panel WHERE panel_code=N'WO_REPORT_LIST'") + " / "
                + s("SELECT COUNT(*) FROM yj_field WHERE panel_code=N'WO_REPORT_LIST'") + " / "
                + s("SELECT COUNT(*) FROM yj_role_panel WHERE panel_code=N'WO_REPORT_LIST'"));
        System.out.println("--- 菜单/看板仍然引用(前端)而库里没有的接口表现 ---");
        c.close();
    }
}
