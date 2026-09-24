import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.*;
import java.util.*;

/** 一次性探针:导出新系统生产管理域表结构(bd_/bl_ manu/dispatch、wo_*、day_report)与新系统 v_* 视图定义。只读。 */
public class _RefDump2 {
    static StringBuilder out = new StringBuilder();
    static void p(String s) { out.append(s).append("\n"); }
    static void q(Statement st, String title, String sql) throws SQLException {
        p(""); p("==== " + title + " ====");
        try (ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData md = rs.getMetaData();
            int n = md.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) { if (i > 1) h.append(" | "); h.append(md.getColumnLabel(i)); }
            p(h.toString());
            int rows = 0;
            while (rs.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    if (i > 1) b.append(" | ");
                    String v = rs.getString(i);
                    if (v != null) v = v.replace("\r", " ").replace("\n", " ");
                    b.append(v);
                }
                p(b.toString()); rows++;
            }
            p("-- " + rows + " rows");
        }
    }

    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=8";
        Path dir = Paths.get("tools/archive/_ref-dump");
        Files.createDirectories(dir);
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            try (Statement st = c.createStatement()) {
                out = new StringBuilder();
                p("# 新系统生产管理域表结构(参考库口径落地)");
                String[] tables = {
                    "bd_manu_order","bl_manu_order","bd_dispatch","bl_dispatch",
                    "wo_order","wo_progress","wo_report","wo_stage_report","wo_material_pick","wo_line_stock",
                    "day_report","day_report_detail"
                };
                for (String t : tables) {
                    q(st, "TABLE " + t,
                      "SELECT c.name, TYPE_NAME(c.system_type_id)+CASE WHEN TYPE_NAME(c.system_type_id) IN ('varchar','nvarchar','char','nchar','varbinary') THEN '('+CASE WHEN c.max_length=-1 THEN 'max' ELSE CAST(c.max_length AS varchar)+'' END+')' WHEN TYPE_NAME(c.system_type_id) IN ('decimal','numeric') THEN '('+CAST(c.precision AS varchar)+','+CAST(c.scale AS varchar)+')' ELSE '' END AS typ, c.is_nullable, c.is_identity, ISNULL(REPLACE(REPLACE(CONVERT(varchar(400),ep.value),CHAR(13),' '),CHAR(10),' '),'') AS cmt "
                    + "FROM sys.columns c LEFT JOIN sys.extended_properties ep ON ep.class=1 AND ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description' "
                    + "WHERE c.object_id=OBJECT_ID(N'dbo." + t + "') ORDER BY c.column_id");
                }
                Files.write(dir.resolve("05-new-prod-tables.txt"), out.toString().getBytes(StandardCharsets.UTF_8));

                out = new StringBuilder();
                p("# 新系统生产相关视图定义");
                String[] views = {"v_manu_schedule","v_manu_order_detail","v_manu_order_stats","v_dispatch_detail","v_dispatch_stats","v_wo_schedule","v_wo_kit","v_lot_trace"};
                for (String v : views) {
                    q(st, "VIEW " + v, "SELECT m.definition AS [def] FROM sys.sql_modules m WHERE m.object_id=OBJECT_ID(N'dbo." + v + "')");
                    p(""); p("----");
                }
                Files.write(dir.resolve("06-new-prod-views.txt"), out.toString().getBytes(StandardCharsets.UTF_8));
            }
            System.out.println("dump2 done");
        }
    }
}
