// QCheckFinal.java —— 收尾对账:探针是否留下痕迹(测试库)
import java.sql.*;

public class QCheckFinal {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_TEST";
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026");
             Statement s = c.createStatement()) {
            System.out.println("== 探针碰过的 4 张单现状 ==");
            try (ResultSet r = s.executeQuery("SELECT 单据编号, 单据状态 FROM bd_pu_order WHERE 单据编号 IN "
                    + "(N'PO-2026-11-0015',N'PO-2026-11-0016',N'PO-2026-11-0017',N'PO-2026-11-0018') ORDER BY 单据编号")) {
                while (r.next()) System.out.println("  " + r.getString(1) + " = " + r.getString(2));
            }
            System.out.println("== 哨兵残留 ==");
            try (ResultSet r = s.executeQuery("SELECT COUNT(*) FROM bl_pu_order WHERE 折扣单价 LIKE N'SENTINEL%'")) {
                if (r.next()) System.out.println("  行数 = " + r.getInt(1));
            }
            System.out.println("== 临时账号残留 ==");
            try (ResultSet r = s.executeQuery("SELECT COUNT(*) FROM yj_user WHERE username LIKE 'zz_fv_%'")) {
                if (r.next()) System.out.println("  行数 = " + r.getInt(1));
            }
            System.out.println("== 角色视图残留 ==");
            try (ResultSet r = s.executeQuery("SELECT COUNT(*) FROM yj_field_view")) {
                if (r.next()) System.out.println("  行数 = " + r.getInt(1));
            }
            System.out.println("== 采购入库/采购订单 必填现状 ==");
            try (ResultSet r = s.executeQuery("SELECT RTRIM(panel_code), label, required FROM yj_field "
                    + "WHERE RTRIM(panel_code) IN ('PURCHASE_IN','PU_ORDER') AND place LIKE '%detail%' "
                    + "AND label IN (N'单价',N'仓库') ORDER BY 1,2")) {
                while (r.next()) System.out.println("  " + r.getString(1) + " / " + r.getString(2) + " required=" + r.getInt(3));
            }
        }
    }
}
