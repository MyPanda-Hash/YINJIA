import java.sql.*;

/** 只读探针:看 yj_doc_status 有没有打印相关列;同时找现成的"打印流水"表。 */
public class Q5 {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("--- yj_doc_status columns ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                     + "WHERE TABLE_NAME='yj_doc_status' ORDER BY ORDINAL_POSITION")) {
                StringBuilder sb = new StringBuilder();
                while (rs.next()) sb.append(rs.getString(1)).append(", ");
                System.out.println(sb);
            }
            System.out.println("--- tables like %print% / %label% ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
                     + "WHERE TABLE_TYPE='BASE TABLE' AND (TABLE_NAME LIKE '%print%' OR TABLE_NAME LIKE '%label%') "
                     + "ORDER BY TABLE_NAME")) {
                while (rs.next()) System.out.println(rs.getString(1));
            }
        }
    }
}
