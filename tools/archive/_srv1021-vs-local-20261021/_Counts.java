import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;

/** 两个库的对象计数对照(只读)。用法: _Counts.java <库A> <库B> */
public class _Counts {
    public static void main(String[] a) throws Exception {
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=master;encrypt=false;trustServerCertificate=true";
        String dbA = a[0], dbB = a[1];
        String[] metrics = {
            "表", "SELECT COUNT(*) FROM sys.tables",
            "视图", "SELECT COUNT(*) FROM sys.views",
            "列", "SELECT COUNT(*) FROM sys.columns",
            "存储过程", "SELECT COUNT(*) FROM sys.procedures",
            "触发器", "SELECT COUNT(*) FROM sys.triggers",
            "主键", "SELECT COUNT(*) FROM sys.key_constraints WHERE type='PK'",
            "唯一约束", "SELECT COUNT(*) FROM sys.key_constraints WHERE type='UQ'",
            "外键", "SELECT COUNT(*) FROM sys.foreign_keys",
            "CHECK约束", "SELECT COUNT(*) FROM sys.check_constraints",
            "默认约束", "SELECT COUNT(*) FROM sys.default_constraints",
            "索引", "SELECT COUNT(*) FROM sys.indexes WHERE index_id>0",
            "扩展属性", "SELECT COUNT(*) FROM sys.extended_properties",
            "同义词", "SELECT COUNT(*) FROM sys.synonyms",
            "序列", "SELECT COUNT(*) FROM sys.sequences",
            "yj_panel", "SELECT COUNT(*) FROM dbo.yj_panel",
            "yj_field", "SELECT COUNT(*) FROM dbo.yj_field",
            "yj_translation", "SELECT COUNT(*) FROM dbo.yj_translation",
            "yj_locale", "SELECT COUNT(*) FROM dbo.yj_locale",
            "yj_schema_log", "SELECT COUNT(*) FROM dbo.yj_schema_log",
            "yj_role_panel", "SELECT COUNT(*) FROM dbo.yj_role_panel",
            "yj_user", "SELECT COUNT(*) FROM dbo.yj_user",
            "permission", "SELECT COUNT(*) FROM dbo.permission",
        };
        try (Connection c = DriverManager.getConnection(url, "sa", "Yinjia@2026");
             Statement st = c.createStatement()) {
            out.printf("%-16s %12s %12s %10s%n", "指标", dbA, dbB, "差(B-A)");
            for (int i = 0; i < metrics.length; i += 2) {
                String label = metrics[i], sql = metrics[i + 1];
                long va = num(st, "USE [" + dbA + "]; " + sql);
                long vb = num(st, "USE [" + dbB + "]; " + sql);
                out.printf("%-16s %12d %12d %10d%s%n", label, va, vb, vb - va,
                        (va != vb ? "   <-- 不同" : ""));
            }
        }
    }
    static long num(Statement st, String sql) {
        try (ResultSet rs = st.executeQuery(sql)) { return rs.next() ? rs.getLong(1) : -1; }
        catch (SQLException e) { return -999999; }
    }
}
