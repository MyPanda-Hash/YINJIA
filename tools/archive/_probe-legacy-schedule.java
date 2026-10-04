import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * 只读探针(2026-10,一次性):旧排产看板/报表族(bd_manu_order 系视图 + 在册面板)
 * 与现役 plang 数据面的对照,回答「这些遗留物是否影响现在的生产流程」。
 *
 * 只 SELECT,不写任何业务数据;结果落 UTF-8 文件(控制台 GBK 会乱码)。
 * 账号从环境变量取(不落盘):YINJIA_SQL_USER(默认 yinjia) / YINJIA_SQL_PASS / YINJIA_SQL_DB(默认 HSDZ_MES)。
 * 运行(仓库根):
 *   $env:YINJIA_SQL_PASS=...; java -cp tools\lib\mssql-jdbc.jar tools\archive\_probe-legacy-schedule.java
 */
public class ProbeLegacySchedule {

    /** 每条独立执行、独立容错:一条列名错不再连坐整批 */
    static final String[][] Q = {
        {"① 两套数据面规模 + ★交叉重叠", ""
            + "SELECT N'bd_manu_order 总行' k, CAST(COUNT(*) AS nvarchar(20)) v FROM bd_manu_order"
            + " UNION ALL SELECT N'bl_manu_order 总行', CAST(COUNT(*) AS nvarchar(20)) FROM bl_manu_order"
            + " UNION ALL SELECT N'plang 总行', CAST(COUNT(*) AS nvarchar(20)) FROM plang"
            + " UNION ALL SELECT N'plang 未排产(scx空)', CAST(COUNT(*) AS nvarchar(20)) FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(scx,N'')=N''"
            + " UNION ALL SELECT N'plang 已排产(scx非空)', CAST(COUNT(*) AS nvarchar(20)) FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(scx,N'')<>N''"
            + " UNION ALL SELECT N'plang_pc 排产薄记录', CAST(COUNT(*) AS nvarchar(20)) FROM plang_pc"
            + " UNION ALL SELECT N'★同号重叠 plang.pl_no ∩ bd.合同号', CAST(COUNT(DISTINCT p.pl_no) AS nvarchar(20)) FROM plang p WHERE EXISTS (SELECT 1 FROM bd_manu_order b WHERE b.[合同号]=p.pl_no)"},

        {"② 切 plang 之后 bd 表还在不在长(分叉生单证据)", ""
            + "SELECT N'bd 转单留痕 asp_time1 最新' k, CONVERT(nvarchar(20), MAX(asp_time1), 120) v FROM bd_manu_order"
            + " UNION ALL SELECT N'bd 单据日期 最新', CONVERT(nvarchar(20), MAX([单据日期]), 120) FROM bd_manu_order"
            + " UNION ALL SELECT N'★bd 2026-09-26 之后新建(asp_time1)', CAST(COUNT(*) AS nvarchar(20)) FROM bd_manu_order WHERE asp_time1 >= '2026-09-26'"
            + " UNION ALL SELECT N'★bd 2026-09-26 之后(单据日期)', CAST(COUNT(*) AS nvarchar(20)) FROM bd_manu_order WHERE [单据日期] >= '2026-09-26'"
            + " UNION ALL SELECT N'bd 已结案(Y)', CAST(COUNT(*) AS nvarchar(20)) FROM bd_manu_order WHERE ISNULL([结案],'N')='Y'"
            + " UNION ALL SELECT N'plang 已结案(T/Y)', CAST(COUNT(*) AS nvarchar(20)) FROM plang WHERE ISNULL(ja,'N') IN ('T','Y')"
            + " UNION ALL SELECT N'bd 工单号样例', (SELECT TOP 1 [合同号] FROM bd_manu_order ORDER BY [合同号] DESC)"
            + " UNION ALL SELECT N'plang 工单号样例', (SELECT TOP 1 pl_no FROM plang ORDER BY pl_no DESC)"},

        {"③ 打印留痕:谁真的记上了", ""
            + "SELECT N'plang 打印次数>0 行' k, CAST(COUNT(*) AS nvarchar(20)) v FROM plang WHERE ISNULL(asp_print,0)>0"
            + " UNION ALL SELECT N'bd 打印次数>0 行', CAST(COUNT(*) AS nvarchar(20)) FROM bd_manu_order WHERE ISNULL([打印次数],0)>0"
            + " UNION ALL SELECT N'plang 打印人(去重)', CAST(COUNT(DISTINCT [打印人]) AS nvarchar(20)) FROM plang WHERE ISNULL([打印人],N'')<>N''"
            + " UNION ALL SELECT N'plang 打印时间 最新', CONVERT(nvarchar(20), MAX([打印时间]), 120) FROM plang"},

        {"④ 在册面板族各视图行数(=点进菜单会看到什么)", ""
            + "SELECT N'v_manu_schedule(生产排产·菜单下线)' k, CAST(COUNT(*) AS nvarchar(20)) v FROM v_manu_schedule"
            + " UNION ALL SELECT N'v_line_load(产线排产负荷·菜单在售)', CAST(COUNT(*) AS nvarchar(20)) FROM v_line_load"
            + " UNION ALL SELECT N'v_wo_kit(工单齐套表·菜单在售)', CAST(COUNT(*) AS nvarchar(20)) FROM v_wo_kit"
            + " UNION ALL SELECT N'v_manu_order_detail(生产工单明细表·菜单在售)', CAST(COUNT(*) AS nvarchar(20)) FROM v_manu_order_detail"
            + " UNION ALL SELECT N'v_manu_order_stats(生产工单统计表·菜单在售)', CAST(COUNT(*) AS nvarchar(20)) FROM v_manu_order_stats"
            + " UNION ALL SELECT N'v_wo_schedule(排单计划·菜单下线)', CAST(COUNT(*) AS nvarchar(20)) FROM v_wo_schedule"
            + " UNION ALL SELECT N'v_wo_kit 工单号 ∩ plang(★0=看不见 plang)', CAST(COUNT(DISTINCT k.[工单号]) AS nvarchar(20)) FROM v_wo_kit k WHERE EXISTS (SELECT 1 FROM plang p WHERE p.pl_no=k.[工单号])"
            + " UNION ALL SELECT N'v_wo_kit 工单号 ∩ bd', CAST(COUNT(DISTINCT k.[工单号]) AS nvarchar(20)) FROM v_wo_kit k WHERE EXISTS (SELECT 1 FROM bd_manu_order b WHERE b.[合同号]=k.[工单号])"},

        {"④b v_line_load 列名(看负荷列长什么样)", ""
            + "SELECT c.name k, CAST(c.column_id AS nvarchar(10)) v FROM sys.columns c WHERE c.object_id=OBJECT_ID('v_line_load') ORDER BY c.column_id"},

        {"④c v_line_load 负荷行数(非档案清单行)", ""
            + "SELECT N'总行' k, CAST(COUNT(*) AS nvarchar(20)) v FROM v_line_load"
            + " UNION ALL SELECT N'今日负荷>0 行', CAST(COUNT(*) AS nvarchar(20)) FROM v_line_load WHERE ISNULL([今日负荷],0)>0"},

        {"⑤ 报工/回填是否还挂 bd 系(应全为 scjl/plang)", ""
            + "SELECT N'scjl 报工行' k, CAST(COUNT(*) AS nvarchar(20)) v FROM scjl"
            + " UNION ALL SELECT N'wo_progress 行(遗留)', CAST(COUNT(*) AS nvarchar(20)) FROM wo_progress"
            + " UNION ALL SELECT N'plang 已回写入库单号(rk_no)', CAST(COUNT(*) AS nvarchar(20)) FROM plang WHERE ISNULL(rk_no,N'')<>N''"
            + " UNION ALL SELECT N'plang 已回写领料单号(ll_no2)', CAST(COUNT(*) AS nvarchar(20)) FROM plang WHERE ISNULL(ll_no2,N'')<>N''"
            + " UNION ALL SELECT N'plang 有完工日期(cp_date2)', CAST(COUNT(*) AS nvarchar(20)) FROM plang WHERE cp_date2 IS NOT NULL"},

        {"⑥ 元数据在册(面板/权限行/字段数)", ""
            + "SELECT p.panel_code + N' │ ' + p.panel_name + N' │ 视图=' + ISNULL(p.line_table,N'-') k, CAST((SELECT COUNT(*) FROM yj_field f WHERE f.panel_code=p.panel_code) AS nvarchar(10)) + N' 字段' v"
            + " FROM yj_panel p WHERE p.panel_code IN ('MANU_ORDER','MANU_SCHEDULE','WO_ORDER','WO_SCHEDULE','LINE_LOAD','LINE_CAP','WO_KIT','MANU_ORDER_DETAIL','MANU_ORDER_STATS') ORDER BY p.panel_code"},

        {"⑦ ★分叉生单的 5 张 bd 单现状(死单?)", ""
            + "SELECT b.[合同号] + N' │ ' + CONVERT(nvarchar(10), b.[单据日期], 120) + N' │ 产线=' + ISNULL(b.[生产线],N'无')"
            + " + N' │ 结案=' + ISNULL(b.[结案],N'N') + N' │ 状态=' + ISNULL((SELECT TOP 1 CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废'"
            + "   WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止' WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END"
            + "   FROM yj_doc_status s WHERE s.panel_code='MANU_ORDER' AND s.doc_no=b.[合同号]), N'无状态行') k,"
            + " N'进 plang? ' + CASE WHEN EXISTS (SELECT 1 FROM plang p WHERE p.pl_no=b.[合同号]) THEN N'是' ELSE N'否' END v"
            + " FROM bd_manu_order b WHERE b.asp_time1 >= '2026-09-26' ORDER BY b.asp_time1"},

        {"⑧ ★占用链:MANU_ORDER 通道还占着多少订单行(挡不挡订单结转)", ""
            + "SELECT N'MANU_ORDER 通道 ACTIVE 占用行' k, CAST(COUNT(*) AS nvarchar(20)) v FROM form_flow_link WHERE target_panel_code='MANU_ORDER' AND link_status='ACTIVE'"
            + " UNION ALL SELECT N'MANU_ORDER 通道 ACTIVE 占用总量', CAST(ISNULL(SUM(linked_quantity),0) AS nvarchar(20)) FROM form_flow_link WHERE target_panel_code='MANU_ORDER' AND link_status='ACTIVE'"
            + " UNION ALL SELECT N'PLANG 通道 ACTIVE 占用行', CAST(COUNT(*) AS nvarchar(20)) FROM form_flow_link WHERE target_panel_code='PLANG' AND link_status='ACTIVE'"
            + " UNION ALL SELECT N'MANU_ORDER 占用指向的单(bd 存在?)', CAST(COUNT(*) AS nvarchar(20)) FROM form_flow_link l WHERE l.target_panel_code='MANU_ORDER' AND l.link_status='ACTIVE'"
            + "   AND EXISTS (SELECT 1 FROM bd_manu_order b WHERE b.[合同号]=l.target_form_no)"},

        {"⑥c WO_/KIT 系面板授权行(0=普通用户看不到)", ""
            + "SELECT panel_code k, CAST(COUNT(*) AS nvarchar(10)) + N' 行授权' v FROM yj_role_panel"
            + " WHERE panel_code LIKE 'WO[_]%' OR panel_code LIKE '%KIT%' GROUP BY panel_code ORDER BY panel_code"},

        {"⑥b 旧排产族授权角色行数", ""
            + "SELECT rp.panel_code k, CAST(COUNT(*) AS nvarchar(10)) + N' 行授权' v FROM yj_role_panel rp"
            + " WHERE rp.panel_code IN ('MANU_ORDER','MANU_SCHEDULE','WO_ORDER','WO_SCHEDULE','LINE_LOAD','WO_KIT','MANU_ORDER_DETAIL','MANU_ORDER_STATS') GROUP BY rp.panel_code ORDER BY rp.panel_code"}
    };

    public static void main(String[] args) throws Exception {
        String db = env("YINJIA_SQL_DB", "HSDZ_MES");
        String user = env("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv("YINJIA_SQL_PASS");
        String out = "tools/archive/_probe-legacy-schedule." + db + ".out.txt";
        if (pass == null || pass.isBlank()) { System.out.println("缺少 YINJIA_SQL_PASS"); return; }
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (PrintWriter w = new PrintWriter(out, StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(url, user, pass);
             Statement st = c.createStatement()) {
            w.println("=== 账套 " + db + " · 只读探针(旧排产看板/报表族 vs plang) ===");
            for (String[] q : Q) {
                w.println();
                w.println("── " + q[0] + " " + "-".repeat(Math.max(0, 60 - q[0].length())));
                try (ResultSet rs = st.executeQuery(q[1])) {
                    while (rs.next()) w.printf("%-46s %s%n", rs.getString(1), rs.getString(2));
                } catch (Exception e) {
                    w.println("[查询失败] " + e.getMessage());
                }
            }
        }
        System.out.println("written: " + out);
    }

    static String env(String k, String d) {
        String v = System.getenv(k);
        return v == null || v.isBlank() ? d : v;
    }
}
