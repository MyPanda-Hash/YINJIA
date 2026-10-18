/**
 * _QVerify.java — 直接对 SQL 验「库存台账/收发存汇总」的查询口径(不经 JDK/服务重启)
 *
 * 目的是在服务端无法重启时也能证明后端改动**生成的 SQL 口径**是对的:
 * 用与 QueryService#appendWhItemFilter 相同的判据拼 WHERE,分别对
 *   ① 名称 + 编码(弹窗正常路径) ② 只送名称(旧 bug 现场) ③ 只送编码
 * 三种 condition 取数,并与 v_stock_ledger / v_stock_summary 的真相行数对照。
 *
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_QVerify.java [HSDZ_MES]
 */
import java.sql.*;

public class _QVerify {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true")) {
            String whCode = "CP-02", whName = "成品B仓", itemCode = "A-48-19", itemName = "PP复合阻垢炭棒/滤芯";
            System.out.println("== v_stock_ledger(" + db + ") ==");
            q(c, "理论上限(该组合全部行)", "SELECT COUNT(*) FROM v_stock_ledger WHERE RTRIM(仓库编码)=? AND RTRIM(存货编码)=?",
                    whCode, itemCode);
            q(c, "① 名称+编码 ⇒ 比编码列(弹窗正常路径)",
                    "SELECT COUNT(*) FROM v_stock_ledger WHERE RTRIM(仓库编码)=? AND RTRIM(存货编码)=?", whCode, itemCode);
            q(c, "② 只送名称 ⇒ 退化按名称精确等值(修复后口径)",
                    "SELECT COUNT(*) FROM v_stock_ledger WHERE RTRIM(仓库)=? AND RTRIM(存货)=?", whName, itemName);
            q(c, "③ 旧 bug 现场(名称被当编码比)必然 0 行",
                    "SELECT COUNT(*) FROM v_stock_ledger WHERE RTRIM(仓库编码)=? AND RTRIM(存货编码)=?", whName, itemName);
            q(c, "④ 名称精确等值不会串仓(成品B仓 vs 半成品仓)",
                    "SELECT COUNT(*) FROM v_stock_ledger WHERE RTRIM(仓库)=N'成品仓'", new Object[0]);
            System.out.println("== v_stock_summary(" + db + ") ==");
            q(c, "① 编码精确", "SELECT COUNT(*) FROM v_stock_summary WHERE RTRIM(仓库编码)=? AND RTRIM(存货编码)=?",
                    whCode, itemCode);
            q(c, "② 名称精确", "SELECT COUNT(*) FROM v_stock_summary WHERE RTRIM(仓库)=? AND RTRIM(存货)=?",
                    whName, itemName);
        }
    }

    static void q(Connection c, String label, String sql, Object... args) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                System.out.println("  " + label + " = " + rs.getInt(1));
            }
        }
    }
}
