import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.*;
import java.util.*;

/**
 * 一次性探针:导出 HSDZ_MES(参考库同源)生产管理相关内容。
 * 产物写入 tools/archive/_ref-dump/:
 *   01-table-structure.txt  生产相关表完整列结构(类型/可空/默认/中文注明)
 *   02-view-definitions.txt 全部旧系统视图(View-Star / VIEW-Star)定义
 *   03-counts-samples.txt   行数与关键样本
 * 只读,不写库。
 */
public class _RefDump {
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
                // ── 01 表结构 ──
                out = new StringBuilder();
                p("# 参考库(同源 HSDZ_MES)生产管理相关表结构");
                String[] tables = {
                    "plang","plang_pc","scjl","scpc","scjd","scjd_ls","scrb","scrb_bs","wbgd",
                    "gxgs","gszl","gssp","mate","mate_jtsh","jrhz","jrhz_ls","cpfpmx",
                    "fgjl","fgjl_ls","fgjlhz","pd_zzp","pd_zzphistory","pd_zzprq",
                    "dm_gx","dm_gz","dm_dbzsd","dh","pjjl","pjjl_sz","kucun","zc","s_allno"
                };
                for (String t : tables) {
                    q(st, "TABLE " + t,
                      "SELECT c.name, TYPE_NAME(c.system_type_id)+CASE WHEN TYPE_NAME(c.system_type_id) IN ('varchar','nvarchar','char','nchar','varbinary') THEN '('+CASE WHEN c.max_length=-1 THEN 'max' ELSE CAST(c.max_length AS varchar)+'' END+')' WHEN TYPE_NAME(c.system_type_id) IN ('decimal','numeric') THEN '('+CAST(c.precision AS varchar)+','+CAST(c.scale AS varchar)+')' ELSE '' END AS typ, c.is_nullable, ISNULL(dc.definition,'') AS dflt, c.is_identity, ISNULL(REPLACE(REPLACE(CONVERT(varchar(400),ep.value),CHAR(13),' '),CHAR(10),' '),'') AS cmt "
                    + "FROM sys.columns c LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id LEFT JOIN sys.extended_properties ep ON ep.class=1 AND ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description' "
                    + "WHERE c.object_id=OBJECT_ID(N'dbo." + t + "') ORDER BY c.column_id");
                }
                Files.write(dir.resolve("01-table-structure.txt"), out.toString().getBytes(StandardCharsets.UTF_8));

                // ── 02 视图定义(旧系统 View*/VIEW*;排除新系统 v_*) ──
                out = new StringBuilder();
                p("# 旧系统视图定义(参考库逻辑实现载体)");
                List<String> views = new ArrayList<>();
                try (ResultSet rs = st.executeQuery(
                        "SELECT name FROM sys.views WHERE name NOT LIKE 'v[_]%' AND is_ms_shipped=0 ORDER BY name")) {
                    while (rs.next()) views.add(rs.getString(1));
                }
                for (String v : views) {
                    q(st, "VIEW " + v, "SELECT m.definition AS [def] FROM sys.sql_modules m WHERE m.object_id=OBJECT_ID(N'dbo." + v + "')");
                    p(""); p("----");
                }
                Files.write(dir.resolve("02-view-definitions.txt"), out.toString().getBytes(StandardCharsets.UTF_8));

                // ── 03 行数与样本 ──
                out = new StringBuilder();
                p("# 行数与样本");
                q(st, "生产相关表行数",
                  "SELECT t.name, SUM(p.rows) AS rows FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN(0,1) "
                + "WHERE t.name IN ('plang','plang_pc','scjl','scpc','scjd','scjd_ls','scrb','scrb_bs','wbgd','gxgs','gszl','gssp','mate','mate_jtsh','jrhz','jrhz_ls','cpfpmx','fgjl','fgjl_ls','fgjlhz','pd_zzp','pd_zzphistory','pd_zzprq','dm_gx','dm_gz','dm_dbzsd','dh','pjjl','pjjl_sz','kucun','zc','s_allno') GROUP BY t.name ORDER BY t.name");
                q(st, "SCGL 生产管理权限屏(SRC=permission)",
                  "SELECT MODULE1, RW, COUNT(*) AS n FROM permission WHERE GROP='SCGL' GROUP BY MODULE1, RW ORDER BY MODULE1");
                q(st, "dm_gx lb 分布",
                  "SELECT lb, COUNT(*) AS n FROM dm_gx GROUP BY lb ORDER BY lb");
                q(st, "dm_gx SCX 生产线",
                  "SELECT dm, mc FROM dm_gx WHERE lb='SCX' ORDER BY dm");
                q(st, "s_allno 号池(生产相关)",
                  "SELECT TOP 40 * FROM s_allno ORDER BY 1");
                q(st, "样本 plang TOP 3", "SELECT TOP 3 * FROM plang ORDER BY 1 DESC");
                q(st, "样本 plang_pc TOP 3", "SELECT TOP 3 * FROM plang_pc ORDER BY 1 DESC");
                q(st, "样本 scjl TOP 3", "SELECT TOP 3 * FROM scjl ORDER BY 1 DESC");
                q(st, "样本 gxgs TOP 5", "SELECT TOP 5 * FROM gxgs");
                q(st, "样本 scpc TOP 3", "SELECT TOP 3 * FROM scpc ORDER BY 1 DESC");
                q(st, "样本 wbgd TOP 3", "SELECT TOP 3 * FROM wbgd ORDER BY 1 DESC");
                Files.write(dir.resolve("03-counts-samples.txt"), out.toString().getBytes(StandardCharsets.UTF_8));
            }
            System.out.println("dump done -> " + dir.toAbsolutePath());
        }
    }
}
