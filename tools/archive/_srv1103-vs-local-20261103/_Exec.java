import java.io.*;
import java.sql.*;
/** 执行任意 DDL/DML(sa 权限):java _Exec.java <库名> <SQL> */
public class _Exec {
    public static void main(String[] a) throws Exception {
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + a[0]
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=15;queryTimeout=1800";
        try (Connection c = DriverManager.getConnection(url, "sa", "Yinjia@2026");
             Statement st = c.createStatement()) {
            boolean hasRs = st.execute(a[1]);
            if (hasRs) {
                try (ResultSet rs = st.getResultSet()) {
                    ResultSetMetaData m = rs.getMetaData();
                    while (rs.next()) { StringBuilder sb = new StringBuilder();
                        for (int i = 1; i <= m.getColumnCount(); i++) { if (i>1) sb.append(" | "); sb.append(rs.getString(i)); }
                        out.println(sb); }
                }
            }
            out.println("RESULT: EXEC-OK");
        }
    }
}
