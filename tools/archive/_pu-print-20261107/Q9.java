import java.sql.*;

/** 一次性清理:删掉本次复验产生的打印记录(参数为单号;不碰用户自己打的单)。 */
public class Q9 {
    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.out.println("用法: Q9.java <db> <MP单号> [更多单号...]");
            return;
        }
        String db = args[0];
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        StringBuilder in = new StringBuilder();
        for (int i = 1; i < args.length; i++) {
            if (in.length() > 0) in.append(',');
            in.append('\'').append(args[i].replace("'", "''")).append('\'');
        }
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            int lines, heads;
            try (Statement st = c.createStatement()) {
                lines = st.executeUpdate("DELETE FROM bl_pu_print WHERE [单据编号] IN (" + in + ")");
            }
            try (Statement st = c.createStatement()) {
                heads = st.executeUpdate("DELETE FROM bd_pu_print WHERE [单据编号] IN (" + in + ")");
            }
            System.out.println(db + " cleaned lines=" + lines + " heads=" + heads);
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT [单据编号] FROM bd_pu_print ORDER BY id")) {
                StringBuilder left = new StringBuilder();
                while (rs.next()) left.append(rs.getString(1)).append(' ');
                System.out.println(db + " remaining heads: " + (left.length() == 0 ? "(none)" : left.toString().trim()));
            }
        }
    }
}
