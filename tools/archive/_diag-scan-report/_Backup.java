import java.sql.*;

/** 一次性:用 sa 备份指定库到容器数据目录(路径由参数给),不打印口令。
 *  用法: YINJIA_SA_PASS=... java _Backup <库名> <容器内路径> */
public class _Backup {
    public static void main(String[] a) throws Exception {
        String db = a[0];
        String path = a[1];
        String pass = System.getenv("YINJIA_SA_PASS");
        if (pass == null || pass.isBlank()) { System.out.println("NO_SA_PASS"); System.exit(2); }
        String url = "jdbc:sqlserver://127.0.0.1:1433;encrypt=false;trustServerCertificate=true;loginTimeout=15";
        try (Connection c = DriverManager.getConnection(url, "sa", pass);
             Statement st = c.createStatement()) {
            st.setQueryTimeout(1800);
            st.execute("BACKUP DATABASE [" + db + "] TO DISK = N'" + path + "' WITH FORMAT, INIT, NAME = N'" + db
                    + " pre-migrate 20261018'");
            System.out.println("BACKUP_OK " + db);
        } catch (SQLException e) {
            System.out.println("BACKUP_FAIL " + db + " : " + e.getErrorCode() + " " + e.getMessage());
            System.exit(1);
        }
    }
}
