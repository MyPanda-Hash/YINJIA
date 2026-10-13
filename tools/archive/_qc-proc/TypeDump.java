package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** 导出 qc_proc_insp_head/detail 的物理列类型,供模板声明正确的 parameter class。 */
public class TypeDump {
    static BufferedWriter w;

    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\types.txt";
        try (BufferedWriter bw = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8)) {
            w = bw;
            try (Connection c = DriverManager.getConnection(url,
                    System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {
                p("### qc_proc_insp_head");
                q(c, "SELECT c.name AS 列名, t.name AS SQL类型 FROM sys.columns c"
                    + " JOIN sys.types t ON t.user_type_id=c.user_type_id"
                    + " WHERE c.object_id=OBJECT_ID('dbo.qc_proc_insp_head') ORDER BY c.column_id");
                p("\n### qc_proc_insp_detail");
                q(c, "SELECT c.name AS 列名, t.name AS SQL类型 FROM sys.columns c"
                    + " JOIN sys.types t ON t.user_type_id=c.user_type_id"
                    + " WHERE c.object_id=OBJECT_ID('dbo.qc_proc_insp_detail') ORDER BY c.column_id");
            }
        }
        System.out.println("WROTE " + out);
    }

    static void p(String s) throws Exception { w.write(s); w.write("\n"); }

    static void q(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            p("  列名 | SQL类型");
            while (rs.next()) p("  " + rs.getString(1) + " | " + rs.getString(2));
        } catch (Exception e) { p("  ERR: " + e.getMessage()); }
    }
}
