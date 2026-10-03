import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * 表使用面审计探针(只读;任务产物,见 docs/plans/*表*.md)。
 *
 * 用途:把「库里有什么表」与「项目/面板实际用到哪些表」两面对上,产出确定性 CSV,
 * 供人工判定「哪些表留下、哪些表是导入数据库包带进来的孤儿」。
 *
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar archive\_TableAudit.java <outDir> [dbName]
 * 输出(UTF-8,逗号分隔,首行表头):
 *   objects.csv     每张表/视图:类型、列数、行数、是否有备用列、备用列数、中文注明
 *   panels.csv      每个面板:编码/名称/模式/模块/头表/行表
 *   fieldcols.csv   面板字段:(面板,列名,place) 去重计数
 *   spares.csv      每张有备用列的表:备用列数、已绑定数
 */
public class _TableAudit {

    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        Path out = Path.of(args.length > 0 ? args[0] : "_table-audit");
        String db = args.length > 1 ? args[1] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        Files.createDirectories(out);
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, USER, PASS)) {
            System.out.println("[connected] " + c.getCatalog());
            // 1) 对象总览(row_count 用 COUNT_BIG 逐表实测:yinjia 账号无 VIEW DATABASE STATE,
            //    sys.dm_db_partition_stats / sys.partitions 均取不到)
            try (BufferedWriter w = Files.newBufferedWriter(out.resolve("objects.csv"), StandardCharsets.UTF_8)) {
                w.write("name,kind,col_count,row_count,spare_cols,ms_description\n");
                String sql =
                    "SELECT o.name, CASE o.type WHEN 'U' THEN 'TABLE' ELSE 'VIEW' END AS kind, "
                  + " (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id=o.object_id) AS col_count, "
                  + " (SELECT COUNT(*) FROM sys.columns c2 WHERE c2.object_id=o.object_id AND c2.name LIKE N'备用%') AS spare_cols, "
                  + " ISNULL(CAST((SELECT ep.value FROM sys.extended_properties ep WHERE ep.major_id=o.object_id "
                  + "      AND ep.minor_id=0 AND ep.name='MS_Description') AS nvarchar(4000)), N'') AS ms_description "
                  + "FROM sys.objects o WHERE o.type IN ('U','V') AND o.is_ms_shipped=0 ORDER BY o.type, o.name";
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                    java.util.List<String[]> rows = new java.util.ArrayList<>();
                    while (rs.next()) {
                        rows.add(new String[]{ rs.getString(1), rs.getString(2), String.valueOf(rs.getInt(3)),
                                               String.valueOf(rs.getInt(4)), rs.getString(5) });
                    }
                    int n = 0;
                    for (String[] r : rows) {
                        long rc = -1;
                        if ("TABLE".equals(r[1])) {
                            try (Statement st2 = c.createStatement();
                                 ResultSet rs2 = st2.executeQuery("SELECT COUNT_BIG(*) FROM [" + r[0].replace("]", "]]") + "]")) {
                                if (rs2.next()) rc = rs2.getLong(1);
                            }
                        }
                        w.write(csv(r[0]) + "," + r[1] + "," + r[2] + "," + rc + "," + r[3] + "," + csv(r[4]) + "\n");
                        if (++n % 100 == 0) System.out.println("  counted " + n + "/" + rows.size());
                    }
                }
            }
            // 2) 面板
            try (BufferedWriter w = Files.newBufferedWriter(out.resolve("panels.csv"), StandardCharsets.UTF_8)) {
                w.write("panel_code,panel_name,mode,category,module_group,head_table,line_table\n");
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT panel_code,panel_name,mode,ISNULL(category,''),ISNULL(module_group,''),"
                      + "ISNULL(head_table,''),ISNULL(line_table,'') FROM yj_panel ORDER BY panel_code")) {
                    while (rs.next()) {
                        StringBuilder sb = new StringBuilder();
                        for (int i = 1; i <= 7; i++) { if (i > 1) sb.append(','); sb.append(csv(rs.getString(i))); }
                        w.write(sb.append('\n').toString());
                    }
                }
            }
            // 3) 面板字段 -> 表:按 (面板, place) 汇总列名(ref_panel=参照目标面板,参与「活的面板」推导)
            try (BufferedWriter w = Files.newBufferedWriter(out.resolve("fieldcols.csv"), StandardCharsets.UTF_8)) {
                w.write("panel_code,place,col_name,data_type,visible,hidden,ref_panel\n");
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT panel_code,ISNULL(place,''),col_name,ISNULL(data_type,''),"
                      + "ISNULL(CAST(visible AS int),-1),ISNULL(CAST(hidden AS int),-1),ISNULL(RTRIM(ref_panel),'') "
                      + "FROM yj_field WHERE col_name IS NOT NULL ORDER BY panel_code,place,seq")) {
                    while (rs.next()) {
                        StringBuilder sb = new StringBuilder();
                        for (int i = 1; i <= 7; i++) { if (i > 1) sb.append(','); sb.append(csv(rs.getString(i))); }
                        w.write(sb.append('\n').toString());
                    }
                }
            }
            // 4) 备用列占用
            try (BufferedWriter w = Files.newBufferedWriter(out.resolve("spares.csv"), StandardCharsets.UTF_8)) {
                w.write("table_name,spare_cols,bound_cols\n");
                // 绑定判定:yj_field 行按 place 落到面板的 head_table / line_table,取 (表,列) 去重
                String boundSql =
                    "SELECT t.name, COUNT(DISTINCT c.name), COUNT(DISTINCT b.col_name) FROM sys.tables t "
                  + "JOIN sys.columns c ON c.object_id=t.object_id AND c.name LIKE N'备用%' "
                  + "LEFT JOIN (SELECT CASE WHEN f.place='header' THEN p.head_table ELSE p.line_table END AS tbl, "
                  + "                  f.col_name FROM yj_field f JOIN yj_panel p ON p.panel_code=f.panel_code "
                  + "           WHERE f.col_name LIKE N'备用%') b ON b.tbl=t.name "
                  + "GROUP BY t.name ORDER BY t.name";
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(boundSql)) {
                    while (rs.next()) {
                        w.write(csv(rs.getString(1)) + "," + rs.getInt(2) + "," + rs.getInt(3) + "\n");
                    }
                }
            }
            // 5) 视图/存储过程 -> 基表依赖(判断「视图在用 ⇒ 其基表也在用」)
            try (BufferedWriter w = Files.newBufferedWriter(out.resolve("deps.csv"), StandardCharsets.UTF_8)) {
                w.write("referencing,referencing_kind,referenced\n");
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT OBJECT_NAME(d.referencing_id), o.type, d.referenced_entity_name "
                      + "FROM sys.sql_expression_dependencies d JOIN sys.objects o ON o.object_id=d.referencing_id "
                      + "WHERE d.referenced_entity_name IS NOT NULL ORDER BY 1,3")) {
                    while (rs.next()) {
                        w.write(csv(rs.getString(1)) + "," + rs.getString(2) + "," + csv(rs.getString(3)) + "\n");
                    }
                }
            }
            // 6) 角色-面板授权(判定「面板是否在运营」:无人授权 = 已下架)
            try (BufferedWriter w = Files.newBufferedWriter(out.resolve("granted.csv"), StandardCharsets.UTF_8)) {
                w.write("role_code,panel_code,perms\n");
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT r.role_code, rp.panel_code, ISNULL(CAST(rp.perms AS nvarchar(200)),'') "
                      + "FROM yj_role_panel rp JOIN yj_role r ON r.id=rp.role_id ORDER BY 1,2")) {
                    while (rs.next()) {
                        w.write(csv(rs.getString(1)) + "," + csv(rs.getString(2)) + "," + csv(rs.getString(3)) + "\n");
                    }
                }
            }
            // 7) 参照目标面板(yj_field.ref_panel):被在用面板当参照源的面板同样是「活的面板」
            try (BufferedWriter w = Files.newBufferedWriter(out.resolve("refpanels.csv"), StandardCharsets.UTF_8)) {
                w.write("ref_panel,referencing_panels\n");
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT RTRIM(ref_panel) AS rp, COUNT(DISTINCT RTRIM(panel_code)) FROM yj_field "
                      + "WHERE ref_panel IS NOT NULL AND RTRIM(ref_panel) <> '' GROUP BY RTRIM(ref_panel) ORDER BY 1")) {
                    while (rs.next()) {
                        w.write(csv(rs.getString(1)) + "," + rs.getInt(2) + "\n");
                    }
                }
            }
            // 8) 缺 en 译名的字段标签(DbNormAudit 09 项的口径;带 hex 便于核对尾空格)
            try (BufferedWriter w = Files.newBufferedWriter(out.resolve("misslabels.csv"), StandardCharsets.UTF_8)) {
                w.write("label,hex,panels\n");
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT f.label, CONVERT(varchar(400), CONVERT(varbinary(200), f.label), 2) AS hex, "
                      + "MIN(RTRIM(f.panel_code)) FROM yj_field f WHERE NOT EXISTS (SELECT 1 FROM yj_translation t "
                      + "WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en') GROUP BY f.label, "
                      + "CONVERT(varchar(400), CONVERT(varbinary(200), f.label), 2)")) {
                    while (rs.next()) w.write(csv(rs.getString(1)) + "," + rs.getString(2) + "," + csv(rs.getString(3)) + "\n");
                }
            }
            // 9) 视图定义原文(供「哪些视图引用了某表」做词边界精确匹配 ——
            //    SQL 里 LIKE '%名字%' 会被 dm_wz/dm_wzbacord 这类前缀误配,只有拿定义文本才判得准)
            try (BufferedWriter w = Files.newBufferedWriter(out.resolve("viewdefs.tsv"), StandardCharsets.UTF_8)) {
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT o.name, ISNULL(OBJECT_DEFINITION(o.object_id), N'') FROM sys.views o ORDER BY o.name")) {
                    while (rs.next()) {
                        w.write(rs.getString(1).replace('\t', ' ') + "\t"
                              + rs.getString(2).replace('\r', ' ').replace('\n', ' ').replace('\t', ' ') + "\n");
                    }
                }
            }
            System.out.println("[done] " + out.toAbsolutePath());
        }
    }

    static String csv(String s) {
        if (s == null) return "";
        String t = s.replace("\"", "\"\"").replace("\r", " ").replace("\n", " ");
        return "\"" + t + "\"";
    }
}
