import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.Map;

public class ScjlProbe {
    public static void main(String[] a) {
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true", "yinjia", "Yinjia@2026"));
        for (Map<String,Object> r : jdbc.queryForList(
            "SELECT id, gldh, gxdm, ISNULL([工单行号],0) AS xc, gd_id, ISNULL([批次号],N'') AS batch,"
          + " ISNULL(sl,0) AS sl, ISNULL(wgzt,'') AS wgzt, ISNULL(asp_cancel,'') AS cx FROM dbo.scjl ORDER BY id"))
            System.out.println(r);
    }
}
