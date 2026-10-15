import java.sql.*;
import java.util.*;

/** 只读取证:制程检验单明细表的「测量值N」物理列 / yj_field 登记 / 存量格数分布。 */
public class _q_qcproc_meas {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true",
                "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            System.out.println("== " + db + " ==");
            System.out.println("-- 物理列(测量值/格数/实测/判定 相关)");
            ResultSet rs = st.executeQuery(
                "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE"
              + " FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_proc_insp_detail'"
              + " AND (COLUMN_NAME LIKE N'%测量值%' OR COLUMN_NAME LIKE N'%实测%' OR COLUMN_NAME LIKE N'%格数%'"
              + "      OR COLUMN_NAME LIKE N'%判定%') ORDER BY COLUMN_NAME");
            while (rs.next()) System.out.println("   " + rs.getString(1) + "  " + rs.getString(2)
                    + " len=" + rs.getObject(3) + " p=" + rs.getObject(4) + " s=" + rs.getObject(5));
            System.out.println("-- yj_field(QC_PROC_INSP,测量值/格数)");
            rs = st.executeQuery("SELECT col_name, label, data_type, place, seq, visible, hidden FROM yj_field"
                    + " WHERE panel_code=N'QC_PROC_INSP' AND (col_name LIKE N'%测量值%' OR col_name LIKE N'%格数%')"
                    + " ORDER BY seq, col_name");
            while (rs.next()) System.out.println("   " + rs.getString(1) + " | " + rs.getString(2) + " | "
                    + rs.getString(3) + " | " + rs.getString(4) + " | seq=" + rs.getInt(5)
                    + " | visible=" + rs.getInt(6) + " hidden=" + rs.getInt(7));
            System.out.println("-- 存量 格数 分布");
            rs = st.executeQuery("SELECT ISNULL(格数,-1) AS n, COUNT(*) FROM qc_proc_insp_detail"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL(格数,-1) ORDER BY 1");
            while (rs.next()) System.out.println("   格数=" + rs.getInt(1) + " 行数=" + rs.getInt(2));
            System.out.println("-- 明细行数 / 最大已填测量值");
            rs = st.executeQuery("SELECT COUNT(*) FROM qc_proc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'");
            rs.next(); System.out.println("   存活明细行=" + rs.getInt(1));
        }
    }
}
