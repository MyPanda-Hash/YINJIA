import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;

/** 通用只读查询器: java _Q.java <库> "<SQL>" — 打印结果集(制表符分隔)。 */
public class _Q {
    public static void main(String[] a) throws Exception {
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + a[0] + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "sa", "Yinjia@2026");
             Statement st = c.createStatement()) {
            boolean rs0 = st.execute(a[1]);
            while (true) {
                if (rs0) {
                    try (ResultSet rs = st.getResultSet()) {
                        ResultSetMetaData m = rs.getMetaData();
                        StringBuilder h = new StringBuilder();
                        for (int i = 1; i <= m.getColumnCount(); i++) h.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
                        out.println(h);
                        out.println("----------------------------------------");
                        while (rs.next()) {
                            StringBuilder sb = new StringBuilder();
                            for (int i = 1; i <= m.getColumnCount(); i++) {
                                String v = rs.getString(i);
                                sb.append(i > 1 ? " | " : "").append(v == null ? "<NULL>" : v.trim());
                            }
                            out.println(sb);
                        }
                    }
                }
                if (!st.getMoreResults() && st.getUpdateCount() == -1) break;
                rs0 = st.getMoreResults();
            }
        }
    }
}
