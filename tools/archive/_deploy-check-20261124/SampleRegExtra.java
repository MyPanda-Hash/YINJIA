import java.sql.*;

/**
 * SampleRegExtra.java — 本地演练「内部检测目录新增行」用的小工具(只动 ZZ 测试行)。
 *
 *   java ... SampleRegExtra.java add    插入 2 行 ZZ 测试行(序号 55/56,模拟生产新增项目)
 *   java ... SampleRegExtra.java dump   打印可见行(序号|检测元素)
 *   java ... SampleRegExtra.java del    删除 ZZ 测试行(清理,必做)
 */
public class SampleRegExtra {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";

    public static void main(String[] a) throws Exception {
        String mode = a.length > 0 ? a[0] : "dump";
        try (Connection c = DriverManager.getConnection(URL, "yinjia", "Yinjia@2026")) {
            try (Statement st = c.createStatement()) {
                if ("add".equals(mode)) {
                    int n = st.executeUpdate("INSERT INTO dbo.qc_sample_reg ([序号],[检测元素],asp_cancel) VALUES "
                            + "(55, N'ZZ测试甲', N'N'), (56, N'ZZ测试乙', N'N')");
                    System.out.println("inserted=" + n);
                } else if ("del".equals(mode)) {
                    int n = st.executeUpdate("DELETE FROM dbo.qc_sample_reg WHERE [检测元素] LIKE N'ZZ测试%'");
                    System.out.println("deleted=" + n);
                }
                if (!"del".equals(mode)) {
                    try (ResultSet r = st.executeQuery(
                            "SELECT [序号],[检测元素] FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel,N'N')<>N'Y' "
                          + "ORDER BY ISNULL([序号],9999), id")) {
                        int cnt = 0;
                        while (r.next()) {
                            cnt++;
                            System.out.printf("%3s | %s%n", r.getObject(1), r.getString(2));
                        }
                        System.out.println("visible=" + cnt);
                    }
                }
            }
        }
    }
}
