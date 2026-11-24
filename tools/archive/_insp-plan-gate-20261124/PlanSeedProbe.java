import java.sql.*;
import java.util.*;

/** 为「生成计划单 + 成型工艺清单」摸底:订单结转待结转产品、两个计划面板的字段与样例行。 */
public class PlanSeedProbe {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        try (Connection c = DriverManager.getConnection(String.format(URL, db), USER, PASS)) {
            System.out.println("== " + db + " ==");
            System.out.println("-- 订单结转:待结转行里的产品(剩余>0,前 20)");
            q(c, "SELECT TOP 20 LTRIM(RTRIM(l.[存货编码])) AS 存货编码, MAX(ISNULL(l.[存货名称],N'')) AS 名称,"
                    + " COUNT(*) AS 行数, SUM(ISNULL(l.[数量],0)) AS 数量"
                    + " FROM bd_so_order o JOIN bl_so_order l ON l.[单据编号]=o.[单据编号]"
                    + " WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(o.asp_cancel,'N')<>'Y'"
                    + " GROUP BY LTRIM(RTRIM(l.[存货编码])) ORDER BY 行数 DESC");
            System.out.println("-- 两个计划面板");
            q(c, "SELECT panel_code, panel_name, head_table, line_table, prefix, config FROM yj_panel"
                    + " WHERE panel_code IN (N'RD_INSP_PLAN', N'RD_MOLD_PROC')");
            System.out.println("-- RD_INSP_PLAN 必填/关键字段");
            q(c, "SELECT label, col_name, place, seq, required, data_type FROM yj_field"
                    + " WHERE panel_code=N'RD_INSP_PLAN' AND (required=1 OR place LIKE N'%header%') ORDER BY seq, id");
            System.out.println("-- RD_MOLD_PROC 必填/关键字段");
            q(c, "SELECT label, col_name, place, seq, required, data_type FROM yj_field"
                    + " WHERE panel_code=N'RD_MOLD_PROC' AND (required=1 OR place LIKE N'%header%') ORDER BY seq, id");
            System.out.println("-- 已有出货检验计划样例(1 张头 + 前 6 行明细)");
            q(c, "SELECT TOP 1 * FROM dbo.rd_insp_plan_head WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC");
            q(c, "SELECT TOP 6 [单据编号],[序号],[控制项目],[控制标准及要求],[检测频率],[检验内容],[检验类别],[表区]"
                    + " FROM dbo.rd_insp_plan_detail WHERE [单据编号] IN (SELECT TOP 1 单据编号 FROM dbo.rd_insp_plan_head"
                    + "   WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC) ORDER BY id");
            System.out.println("-- 已有成型工艺清单样例(1 张头)");
            q(c, "SELECT TOP 1 [单据编号],[单据日期],[产品编号],[产品名称],[版本号],[密级],[工序]"
                    + " FROM dbo.rd_mold_proc_head WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([产品编号],N'')<>N''"
                    + " ORDER BY id DESC");
            System.out.println("-- 号池 prefix 样例");
            q(c, "SELECT TOP 6 * FROM dbo.s_allno WHERE prefix IN (N'JYJH',N'CX') OR prefix LIKE N'%JH%' ORDER BY prefix");
        }
    }

    static void q(Connection c, String sql) {
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = m.getColumnCount(), rows = 0;
            while (r.next() && rows < 30) {
                rows++;
                StringBuilder sb = new StringBuilder("   ");
                for (int i = 1; i <= n; i++) {
                    String v = r.getString(i);
                    if (v != null && v.length() > 60) v = v.substring(0, 60) + "…";
                    sb.append(m.getColumnLabel(i)).append('=').append(v).append(" | ");
                }
                System.out.println(sb);
            }
            if (rows == 0) System.out.println("   (0 行)");
        } catch (Exception e) {
            System.out.println("   [ERR] " + e.getMessage());
        }
    }
}
