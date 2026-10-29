import java.sql.*;

/**
 * _VerifySupplierStandalone.java —— 核查「供应商账号独立成表」(2026-10-25)
 *
 * 用户口径:「供应商配置的账号不属于用户账号,单独一个表吧」
 *
 * 逐项打印并给出 PASS/FAIL(全部 PASS 才返回 0):
 *   01 yj_supplier_account 有 password_hash / real_name 两列
 *   02 yj_user 里**没有**任何供应商账号的镜像行
 *   03 启用中的供应商账号**都有**口令(否则登不进)
 *   04 供应商账号与内部账号**不重名**(登录入口唯一,不制造歧义)
 *
 * 用法(在 tools 目录):
 *   set YINJIA_SQL_PASS=...
 *   java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive/_VerifySupplierStandalone.java HSDZ_MES
 */
public class _VerifySupplierStandalone {
    static int fail = 0;

    static void check(String name, boolean ok, String detail) {
        System.out.println("  " + (ok ? "[PASS] " : "[FAIL] ") + name + (detail == null || detail.isEmpty() ? "" : " — " + detail));
        if (!ok) fail++;
    }

    static String s(ResultSet rs, String col) throws SQLException {
        String v = rs.getString(col);
        return v == null ? "" : v;
    }

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("=== 供应商账号独立成表核查 @" + db + " ===");

            // 01 两列存在
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.yj_supplier_account')"
                   + " AND name IN (N'password_hash', N'real_name')")) {
                rs.next();
                check("01 yj_supplier_account 有 password_hash / real_name", rs.getInt(1) == 2, "命中列数=" + rs.getInt(1));
            }

            // 02 无 yj_user 镜像行
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT COUNT(*) FROM dbo.yj_supplier_account a JOIN dbo.yj_user u ON u.username = a.username")) {
                rs.next();
                int n = rs.getInt(1);
                check("02 yj_user 里没有供应商账号镜像行", n == 0, "镜像行=" + n);
            }

            // 03 启用账号都有口令
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT COUNT(*) FROM dbo.yj_supplier_account"
                   + " WHERE enabled = '1' AND (password_hash IS NULL OR password_hash = N'')")) {
                rs.next();
                int n = rs.getInt(1);
                check("03 启用中的账号都有口令", n == 0, "无口令=" + n);
            }

            // 04 不与内部账号重名
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT COUNT(*) FROM dbo.yj_supplier_account a WHERE EXISTS"
                   + " (SELECT 1 FROM dbo.yj_user u WHERE u.username = a.username)")) {
                rs.next();
                int n = rs.getInt(1);
                check("04 供应商账号与内部账号不重名", n == 0, "重名=" + n);
            }

            // 列数(文档《数据库表清单》要登记真实列数)
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.yj_supplier_account')")) {
                rs.next();
                System.out.println("\n  yj_supplier_account 列数 = " + rs.getInt(1));
            }

            // 明细
            System.out.println("\n  账号明细:");            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT username, supplier_code, enabled,"
                   + " CASE WHEN password_hash IS NULL OR password_hash = N'' THEN N'无' ELSE N'有' END AS pwd,"
                   + " ISNULL(real_name, N'') AS rn, ISNULL(phone, N'') AS ph FROM dbo.yj_supplier_account ORDER BY username")) {
                boolean any = false;
                while (rs.next()) {
                    any = true;
                    System.out.printf("    %-16s %-12s enabled=%s 口令=%s 姓名=%s 电话=%s%n",
                            s(rs, "username"), s(rs, "supplier_code"), s(rs, "enabled"),
                            s(rs, "pwd"), s(rs, "rn"), s(rs, "ph"));
                }
                if (!any) System.out.println("    (无供应商账号)");
            }
        }
        System.out.println(fail == 0 ? "\nRESULT: PASS" : "\nRESULT: FAIL-" + fail);
        System.exit(fail == 0 ? 0 : 1);
    }
}
