import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** 一次性探针:把门禁强度档位写进指定账套的 yj_panel.config(验证开关用,验完必须还原 block/pass)。 */
public class SetGateProbe {
    public static void main(String[] a) {
        String db = a[0], mode = a[1], legacy = a.length > 2 ? a[2] : "pass";
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true", "yinjia", "Yinjia@2026"));
        int n = jdbc.update(
            "UPDATE dbo.yj_panel SET config = N'{\"inspGate\":\"' + ? + N'\",\"inspGateLegacy\":\"' + ? + N'\"}'"
          + " WHERE panel_code = N'QC_FIRST_INSP'", mode, legacy);
        System.out.println(db + " inspGate=" + mode + " inspGateLegacy=" + legacy + " → 更新 " + n + " 行");
    }
}
