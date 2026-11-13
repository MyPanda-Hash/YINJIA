// QFixDraftStatus.java —— 探针副作用修复:把被探针改成「已作废」的测试草稿恢复成「草稿」
// 只动 bd_pu_order.单据状态 与 作废相关留痕(测试库、且仅当当前状态=已作废才改)
import java.sql.*;

public class QFixDraftStatus {
    public static void main(String[] a) throws Exception {
        String db = a[0], no = a[1];
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026")) {
            // 先看当前行有哪些"状态/作废"相关列
            StringBuilder cols = new StringBuilder();
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_pu_order') "
                         + "AND (c.name LIKE N'%状态%' OR c.name LIKE N'%作废%' OR c.name LIKE N'%ERP%' OR c.name LIKE N'%审核%') ORDER BY c.column_id")) {
                while (r.next()) cols.append(r.getString(1)).append(" | ");
            }
            System.out.println("相关列: " + cols);

            String before = null;
            try (PreparedStatement ps = c.prepareStatement("SELECT 单据状态 FROM bd_pu_order WHERE 单据编号 = ?")) {
                ps.setString(1, no);
                try (ResultSet r = ps.executeQuery()) { if (r.next()) before = r.getString(1); }
            }
            System.out.println("当前状态: " + before);
            if (!"已作废".equals(before)) { System.out.println("不是已作废,不改"); return; }

            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE bd_pu_order SET 单据状态 = N'草稿' WHERE 单据编号 = ? AND 单据状态 = N'已作废'")) {
                ps.setString(1, no);
                System.out.println("恢复行数: " + ps.executeUpdate());
            }
            // yj_doc_status 里若有该单的 canceled 行,一并清掉(草稿本不该有状态行)
            try (PreparedStatement ps = c.prepareStatement(
                    "DELETE FROM yj_doc_status WHERE doc_no = ? AND RTRIM(panel_code) = 'PU_ORDER'")) {
                ps.setString(1, no);
                System.out.println("清 yj_doc_status: " + ps.executeUpdate());
            } catch (SQLException e) {
                System.out.println("(yj_doc_status 跳过: " + e.getMessage() + ")");
            }
        }
    }
}
