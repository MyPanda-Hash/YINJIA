import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.Map;

/** 只读探针:看门禁留痕是否真的落进 yj_usage_log(预警放行 / 强制开单)。 */
public class UsageLogProbe {
    public static void main(String[] a) {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true", "yinjia", "Yinjia@2026"));
        System.out.println("--- " + db + " 最近 6 条「检验单门禁」留痕 ---");
        for (Map<String,Object> r : jdbc.queryForList(
            "SELECT TOP 6 user_name, panel_name, action_name, doc_no, ip, created_at, 工单行号 FROM dbo.yj_usage_log"
          + " WHERE action_name LIKE N'%门禁%' ORDER BY id DESC"))
            System.out.println(r);
    }
}
