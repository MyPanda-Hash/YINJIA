import java.sql.*;

/** 校验 migrate-gen-wh-bin-prefill-20261113.sql 在两账套的落地情况(只读)。 */
public class ChkMig {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                    + ";encrypt=false;loginTimeout=10", "yinjia", "Yinjia@2026")) {
                StringBuilder sb = new StringBuilder("=== " + db + " ===");
                for (String t : new String[]{"sl_recv_detail", "qc_insp_detail"}) {
                    for (String col : new String[]{"仓位编码", "仓位名称", "仓位id"}) {
                        try (Statement s = c.createStatement();
                             ResultSet r = s.executeQuery("SELECT COL_LENGTH('" + t + "',N'" + col + "')")) {
                            r.next();
                            sb.append("\n  ").append(t).append('.').append(col).append(" = ").append(r.getObject(1));
                        }
                    }
                }
                try (Statement s = c.createStatement();
                     ResultSet r = s.executeQuery("SELECT panel_code, label, visible, hidden, col_name, ref_filter "
                             + "FROM yj_field WHERE label IN (N'仓位',N'仓位名称',N'仓位id',N'仓库',N'仓库代码') AND place=N'detail' "
                             + "AND panel_code IN (N'QC_RECV',N'QC_INSP') ORDER BY panel_code, seq")) {
                    while (r.next()) {
                        sb.append("\n  ").append(r.getString(1)).append(" | ").append(r.getString(2))
                                .append(" | vis=").append(r.getInt(3)).append(" hidden=").append(r.getInt(4))
                                .append(" col=").append(r.getString(5)).append(" filter=").append(r.getString(6));
                    }
                }
                System.out.println(sb);
            }
        }
    }
}
