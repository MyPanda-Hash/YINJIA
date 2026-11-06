import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;
import java.util.*;

/**
 * 全量结构指纹对比(只读):两个库逐类对象取全属性快照,再双向求差。
 *
 * 用法: java _StructDiff.java <库A> <库B> [--skip-bak]
 *   A = 服务器备份还原库(HSDZ_MES_SRV1021)  B = 本地库(HSDZ_MES)
 *   --skip-bak: 忽略 _bak_ 前缀表(本地临时备份表,不算真实结构差异)
 *
 * 对比类别:表 / 列(类型·长度·精度·可空·标识·计算·排序规则)/ 默认约束 /
 *          索引(键序·唯一·包含列·过滤)/ 主键唯一键 / CHECK / 触发器 / 视图 / 过程 /
 *          扩展属性(MS_Description 等)
 *
 * 实现要点:表达式与 FROM 子句分开传,外层统一 COLLATE DATABASE_DEFAULT ——
 * sys 目录视图是 Latin1_General_CI_AS_KS_WS、用户表是 Chinese_PRC_CI_AS,
 * 直接 CONCAT 会报 "Cannot resolve collation conflict"。
 */
public class _StructDiff {
    static final String BASE = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";
    static PrintStream out;
    static boolean skipBak;

    public static void main(String[] a) throws Exception {
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String dbA = a[0], dbB = a[1];
        skipBak = a.length > 2 && a[2].equals("--skip-bak");

        LinkedHashMap<String, TreeSet<String>> sa = snapshot(dbA);
        LinkedHashMap<String, TreeSet<String>> sb = snapshot(dbB);

        int total = 0;
        for (String cat : sa.keySet()) {
            TreeSet<String> x = new TreeSet<>(sa.get(cat));
            TreeSet<String> y = new TreeSet<>(sb.get(cat));
            TreeSet<String> onlyA = new TreeSet<>(x); onlyA.removeAll(y);
            TreeSet<String> onlyB = new TreeSet<>(y); onlyB.removeAll(x);
            if (skipBak) {
                onlyA.removeIf(s -> s.contains("._bak_"));
                onlyB.removeIf(s -> s.contains("._bak_"));
            }
            out.println();
            out.println("=== " + cat + " ===  A(" + dbA + ")=" + x.size() + "  B(" + dbB + ")=" + y.size()
                    + "  | 仅A(服务器) " + onlyA.size() + "  仅B(本地) " + onlyB.size());
            int n = 0;
            for (String s : onlyA) { out.println("  [仅A/服务器] " + s); if (++n > 500) { out.println("  ...截断"); break; } }
            n = 0;
            for (String s : onlyB) { out.println("  [仅B/本地]   " + s); if (++n > 500) { out.println("  ...截断"); break; } }
            total += onlyA.size() + onlyB.size();
        }
        out.println();
        out.println("TOTAL-DIFF-LINES=" + total);
        out.println(total == 0 ? "RESULT: IDENTICAL" : "RESULT: DIFF");
    }

    static LinkedHashMap<String, TreeSet<String>> snapshot(String db) throws Exception {
        LinkedHashMap<String, TreeSet<String>> m = new LinkedHashMap<>();
        try (Connection c = DriverManager.getConnection(String.format(BASE, db), "sa", "Yinjia@2026");
             Statement st = c.createStatement()) {

            m.put("表", collect(st,
                "CONCAT(SCHEMA_NAME(t.schema_id),'.',t.name)",
                "FROM sys.tables t"));

            m.put("列", collect(st,
                "CONCAT(SCHEMA_NAME(t.schema_id),'.',t.name,'.',c.name,' | ',ty.name,"
              + "CASE WHEN ty.name IN ('nvarchar','nchar') AND c.max_length>0 THEN '('+CAST(c.max_length/2 AS varchar(10))+')' "
              + "     WHEN ty.name IN ('varchar','char','varbinary','binary') AND c.max_length>0 THEN '('+CAST(c.max_length AS varchar(10))+')' "
              + "     WHEN ty.name IN ('decimal','numeric') THEN '('+CAST(c.precision AS varchar(10))+','+CAST(c.scale AS varchar(10))+')' "
              + "     WHEN ty.name IN ('datetime2','time','datetimeoffset') THEN '('+CAST(c.scale AS varchar(10))+')' "
              + "     ELSE '' END,"
              + "' | null=',c.is_nullable,' | ident=',c.is_identity,' | computed=',c.is_computed,"
              + "' | coll=',ISNULL(c.collation_name,''))",
                "FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id "
              + "JOIN sys.types ty ON ty.user_type_id=c.user_type_id"));

            m.put("默认约束", collect(st,
                "CONCAT(SCHEMA_NAME(t.schema_id),'.',t.name,'.',c.name,' | ',dc.name,' = ',dc.definition)",
                "FROM sys.default_constraints dc JOIN sys.tables t ON t.object_id=dc.parent_object_id "
              + "JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id"));

            m.put("索引", collect(st,
                "CONCAT(SCHEMA_NAME(t.schema_id),'.',t.name,' | ',i.name,' | ',i.type_desc,"
              + "' | uniq=',i.is_unique,' | pk=',i.is_primary_key,' | uq=',i.is_unique_constraint,"
              + "' | keys=',ISNULL(STUFF((SELECT ','+CAST(ic2.column_id AS varchar(10))+':'+c2.name "
              + "            FROM sys.index_columns ic2 JOIN sys.columns c2 ON c2.object_id=ic2.object_id AND c2.column_id=ic2.column_id "
              + "            WHERE ic2.object_id=i.object_id AND ic2.index_id=i.index_id AND ic2.is_included_column=0 "
              + "            ORDER BY ic2.key_ordinal FOR XML PATH('')),1,1,''),''),"
              + "' | incl=',ISNULL(STUFF((SELECT ','+c3.name FROM sys.index_columns ic3 JOIN sys.columns c3 ON c3.object_id=ic3.object_id AND c3.column_id=ic3.column_id "
              + "            WHERE ic3.object_id=i.object_id AND ic3.index_id=i.index_id AND ic3.is_included_column=1 "
              + "            ORDER BY ic3.index_column_id FOR XML PATH('')),1,1,''),''),"
              + "' | filter=',ISNULL(i.filter_definition,''))",
                "FROM sys.indexes i JOIN sys.tables t ON t.object_id=i.object_id WHERE i.index_id>0"));

            m.put("主键/唯一键", collect(st,
                "CONCAT(SCHEMA_NAME(t.schema_id),'.',t.name,' | ',kc.name,' | ',kc.type_desc,' | ',"
              + "ISNULL(STUFF((SELECT ','+c2.name FROM sys.index_columns ic "
              + " JOIN sys.columns c2 ON c2.object_id=ic.object_id AND c2.column_id=ic.column_id "
              + " WHERE ic.object_id=kc.parent_object_id AND ic.index_id=kc.unique_index_id "
              + " ORDER BY ic.key_ordinal FOR XML PATH('')),1,1,''),''))",
                "FROM sys.key_constraints kc JOIN sys.tables t ON t.object_id=kc.parent_object_id"));

            m.put("CHECK约束", collect(st,
                "CONCAT(SCHEMA_NAME(t.schema_id),'.',t.name,' | ',cc.name,' | ',cc.definition,"
              + "' | disabled=',cc.is_disabled)",
                "FROM sys.check_constraints cc JOIN sys.tables t ON t.object_id=cc.parent_object_id"));

            m.put("触发器", collect(st,
                "CONCAT(SCHEMA_NAME(t.schema_id),'.',t.name,' | ',tr.name,' | disabled=',tr.is_disabled,"
              + "' | ',CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(tr.object_id)),2))",
                "FROM sys.triggers tr JOIN sys.tables t ON t.object_id=tr.parent_id"));

            m.put("视图", collect(st,
                "CONCAT(SCHEMA_NAME(v.schema_id),'.',v.name,' | ',"
              + "CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(v.object_id)),2),"
              + "' | len=',LEN(OBJECT_DEFINITION(v.object_id)))",
                "FROM sys.views v"));

            m.put("存储过程", collect(st,
                "CONCAT(SCHEMA_NAME(p.schema_id),'.',p.name,' | ',"
              + "CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(p.object_id)),2))",
                "FROM sys.procedures p"));

            m.put("扩展属性", collect(st,
                "CONCAT(ep.class_desc,' | ',SCHEMA_NAME(o.schema_id),'.',o.name,"
              + "CASE WHEN ep.minor_id>0 THEN '.'+(SELECT c.name FROM sys.columns c WHERE c.object_id=ep.major_id AND c.column_id=ep.minor_id) ELSE '' END,"
              + "' | ',ep.name,' = ',CAST(ep.value AS nvarchar(4000)))",
                "FROM sys.extended_properties ep JOIN sys.objects o ON o.object_id=ep.major_id "
              + "LEFT JOIN sys.schemas s ON s.schema_id=o.schema_id"));
        }
        return m;
    }

    /** expr 与 from/where 子句分开传;外层统一 COLLATE DATABASE_DEFAULT 消除排序规则冲突。 */
    static TreeSet<String> collect(Statement st, String expr, String rest) throws SQLException {
        TreeSet<String> s = new TreeSet<>();
        String sql = "SELECT CAST((" + expr + ") AS nvarchar(4000)) COLLATE DATABASE_DEFAULT AS k " + rest;
        try (ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) { String v = rs.getString(1); if (v != null) s.add(v); }
        }
        return s;
    }
}
