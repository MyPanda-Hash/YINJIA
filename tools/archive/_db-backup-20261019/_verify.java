import java.sql.*;

/** 只读校验:对最近一次备份文件跑 RESTORE VERIFYONLY(证明 .bak 可恢复,不是坏文件)。 */
public class _verify {
    public static void main(String[] a) throws Exception {
        String bak = a.length > 0 ? a[0] : "C:\\SQLBackup\\YINJIA-MES\\HSDZ_MES_TEST_manual_20261019-224814.bak";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=master;encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            st.execute("RESTORE VERIFYONLY FROM DISK = N'" + bak.replace("'", "''") + "' WITH CHECKSUM");
            System.out.println("[OK] RESTORE VERIFYONLY 通过:" + bak + " 可恢复(checksum 一致)");
        }
    }
}
