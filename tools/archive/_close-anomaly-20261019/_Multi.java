import java.io.*;
import java.sql.*;

/** 只读:执行一段多语句 SQL 并**逐段打印所有结果集**(_Exec 只打第一段)。用法: _Multi <db> "<sql>" */
public class _Multi {
    public static void main(String[] a) throws Exception {
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + a[0]
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10;queryTimeout=600";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            boolean has = st.execute(a[1]);
            int idx = 0;
            while (true) {
                if (has) {
                    try (ResultSet rs = st.getResultSet()) {
                        ResultSetMetaData m = rs.getMetaData();
                        int n = m.getColumnCount();
                        StringBuilder h = new StringBuilder();
                        for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
                        out.println(h);
                        int rows = 0;
                        while (rs.next() && rows < 300) {
                            StringBuilder b = new StringBuilder();
                            for (int i = 1; i <= n; i++) b.append(rs.getString(i)).append(i < n ? " | " : "");
                            out.println(b);
                            rows++;
                        }
                        out.println("(" + rows + " 行)");
                    }
                } else {
                    int uc = st.getUpdateCount();
                    if (uc == -1) break;
                }
                has = st.getMoreResults();
                idx++;
            }
        }
    }
}
