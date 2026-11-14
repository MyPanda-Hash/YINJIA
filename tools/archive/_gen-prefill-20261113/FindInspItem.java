import java.sql.*;

/** 一次性取证:找一个「来料检验=是」的商品编码(用于验证 暂收→来料检验单 这条分支)。 */
public class FindInspItem {
    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;loginTimeout=10",
                "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT TOP 5 LTRIM(RTRIM(存货编码)) AS code, 存货名称, 来料检验 FROM bs_inv "
                     + "WHERE LTRIM(RTRIM(ISNULL(来料检验,N''))) IN (N'是', N'Y', N'1') AND ISNULL(asp_cancel,'N') <> 'Y'")) {
            while (rs.next()) System.out.println(rs.getString(1) + " | " + rs.getString(2) + " | " + rs.getString(3));
        }
    }
}
