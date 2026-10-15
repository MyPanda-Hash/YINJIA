import java.sql.*;

/** 完工明细 wgsj null/一致性核查(两账套)。 */
public class _ProbeWgsjNull {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            Connection c = DriverManager.getConnection(
                    "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026");
            Statement s = c.createStatement();
            System.out.println("========== " + db + " ==========");
            ResultSet r = s.executeQuery("SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL(wgzt,'N')='Y' AND ISNULL(asp_cancel,'N')<>'Y'");
            r.next(); System.out.println("已完工未作废行数 = " + r.getInt(1));
            r = s.executeQuery("SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL(wgzt,'N')='Y' AND ISNULL(asp_cancel,'N')<>'Y' AND wgsj IS NULL");
            r.next(); System.out.println("  其中 wgsj 为空 = " + r.getInt(1));
            r = s.executeQuery("SELECT COUNT(*) FROM dbo.scjl WHERE wgsj IS NOT NULL AND ISNULL(wgzt,'N')<>'Y'");
            r.next(); System.out.println("未完工但有 wgsj = " + r.getInt(1));
            r = s.executeQuery("SELECT COUNT(*) FROM dbo.scjl WHERE wgsj IS NOT NULL AND (ISNULL(asp_cancel,'N')='Y')");
            r.next(); System.out.println("作废但有 wgsj = " + r.getInt(1));
            // wgsj 与报工单审核时间(shsj)比对
            r = s.executeQuery("SELECT COUNT(*) FROM dbo.scjl s JOIN dbo.yj_doc_status d"
                    + " ON d.panel_code='WO_REPORT' AND d.doc_no=s.[报工单号]"
                    + " WHERE ISNULL(s.wgzt,'N')='Y' AND s.wgsj IS NOT NULL AND d.shsj IS NOT NULL"
                    + "   AND ABS(DATEDIFF(SECOND, s.wgsj, d.shsj)) > 2");
            r.next(); System.out.println("wgsj 与 报工单审核时间 差>2秒 = " + r.getInt(1));
            r = s.executeQuery("SELECT TOP 5 s.id, s.[报工单号], CONVERT(varchar(19),s.wgsj,120) wgsj,"
                    + " CONVERT(varchar(19),d.shsj,120) shsj, CONVERT(varchar(19),s.asp_time1,120) asp1,"
                    + " CONVERT(varchar(19),s.asp_time2,120) asp2"
                    + " FROM dbo.scjl s LEFT JOIN dbo.yj_doc_status d ON d.panel_code='WO_REPORT' AND d.doc_no=s.[报工单号]"
                    + " WHERE ISNULL(s.wgzt,'N')='Y' ORDER BY s.id DESC");
            while (r.next())
                System.out.printf("  id=%d %s wgsj=%s shsj=%s asp1=%s asp2=%s%n",
                        r.getInt(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5), r.getString(6));
            // 视图行数
            r = s.executeQuery("SELECT COUNT(*) FROM dbo.v_wo_completion_detail");
            r.next(); System.out.println("v_wo_completion_detail 行数 = " + r.getInt(1));
            c.close();
        }
    }
}
