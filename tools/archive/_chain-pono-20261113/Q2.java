import java.sql.*;

/** 只读:特采单头 qc_tc_in 是否有 采购单号/采购订单号 列,以及 yj_field 是否登记(隐藏链路列)。 */
public class Q2 {
    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10",
                "yinjia", "Yinjia@2026")) {
            System.out.println("== qc_tc_in 里 采购/订单 相关列 ==");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT c.name, ty.name FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
                         + "WHERE c.object_id=OBJECT_ID('qc_tc_in') AND (c.name LIKE N'%采购%' OR c.name LIKE N'%订单%')")) {
                while (r.next()) System.out.println("  " + r.getString(1) + " (" + r.getString(2) + ")");
            }
            System.out.println("== yj_field QC_TC_IN 里 采购/订单/批次/检验 相关 ==");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT label, col_name, place, seq, visible, hidden FROM yj_field "
                         + "WHERE panel_code='QC_TC_IN' AND (label LIKE N'%采购%' OR col_name LIKE N'%采购%' OR label LIKE N'%检验单%' "
                         + "OR label LIKE N'%退料%' OR label LIKE N'%批次%') ORDER BY place, seq")) {
                while (r.next()) System.out.println("  " + r.getString(1) + " → " + r.getString(2) + " [" + r.getString(3)
                        + "] seq=" + r.getInt(4) + " vis=" + r.getInt(5) + " hid=" + r.getInt(6));
            }
            System.out.println("== qc_insp_detail 是否已有 采购单号(上一轮迁移) ==");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT COL_LENGTH('qc_insp_detail','采购单号')")) {
                r.next();
                System.out.println("  qc_insp_detail.采购单号 = " + r.getObject(1));
            }
        }
    }
}
