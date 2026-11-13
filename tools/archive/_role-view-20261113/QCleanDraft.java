// QCleanDraft.java —— 删掉探针误建的草稿(测试库,按单号精确删头+行;只删测试账号刚才建的)
import java.sql.*;

public class QCleanDraft {
    public static void main(String[] a) throws Exception {
        String db = a[0];
        String[] nos = java.util.Arrays.copyOfRange(a, 1, a.length);
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026")) {
            for (String no : nos) {
                String status = null;
                try (PreparedStatement ps = c.prepareStatement("SELECT 单据状态 FROM bd_pu_order WHERE 单据编号 = ?")) {
                    ps.setString(1, no);
                    try (ResultSet r = ps.executeQuery()) { if (r.next()) status = r.getString(1); }
                }
                if (status == null) { System.out.println(no + " 不存在,跳过"); continue; }
                if (!"草稿".equals(status)) { System.out.println(no + " 状态=" + status + ",不是草稿 → 拒绝删除"); continue; }
                try (PreparedStatement ps = c.prepareStatement("DELETE FROM bl_pu_order WHERE 单据编号 = ?")) {
                    ps.setString(1, no);
                    int n = ps.executeUpdate();
                    try (PreparedStatement ps2 = c.prepareStatement("DELETE FROM bd_pu_order WHERE 单据编号 = ? AND 单据状态 = N'草稿'")) {
                        ps2.setString(1, no);
                        int m = ps2.executeUpdate();
                        System.out.println(no + " 删除: 头 " + m + " 行, 明细 " + n + " 行");
                    }
                }
            }
        }
    }
}
