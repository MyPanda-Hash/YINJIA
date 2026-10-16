import java.sql.*;

/** 只读:看某张制程检验单的明细(测量值1..10 / 格数)。用法:_q_zc_detail <单据编号> */
public class _q_zc_detail {
    public static void main(String[] a) throws Exception {
        String no = a.length > 0 ? a[0] : "ZC-2026-10-0016";
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true",
                "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            ResultSet h = st.executeQuery("SELECT [单据编号],[单据状态],ISNULL(asp_cancel,'N') AS cancel FROM qc_proc_insp_head WHERE [单据编号]=N'" + no + "'");
            System.out.println("-- 单头 " + no);
            while (h.next()) System.out.println("   " + h.getString(1) + " | 状态=" + h.getString(2) + " | cancel=" + h.getString(3));
            ResultSet rs = st.executeQuery(
                "SELECT id, ISNULL(表区,N'') , ISNULL(检验项目,N''), 格数,"
              + " 测量值1,测量值2,测量值3,测量值4,测量值5,测量值6,测量值7,测量值8,测量值9,测量值10,"
              + " ISNULL(asp_cancel,'N') FROM qc_proc_insp_detail WHERE [单据编号]=N'" + no + "' ORDER BY id");
            System.out.println("-- 明细");
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 4; i <= 13; i++) sb.append(rs.getObject(i)).append(" | ");
                System.out.println("   id=" + rs.getLong(1) + " 表区=" + rs.getString(2) + " 项目=" + rs.getString(3)
                        + " 格数=" + rs.getObject(4) + " || " + sb + " cancel=" + rs.getString(14));
            }
        }
    }
}
