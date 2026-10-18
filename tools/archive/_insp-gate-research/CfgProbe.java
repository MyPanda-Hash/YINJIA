import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.Map;

public class CfgProbe {
    public static void main(String[] a) {
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true", "yinjia", "Yinjia@2026"));
        System.out.println("--- 有 config 的面板(非空) ---");
        for (Map<String,Object> r : jdbc.queryForList(
            "SELECT panel_code, CONVERT(nvarchar(max), config) AS cfg FROM dbo.yj_panel WHERE ISNULL(CONVERT(nvarchar(max),config),'')<>'' ORDER BY panel_code"))
            System.out.println(r);
        System.out.println("--- 三个检验面板的 config ---");
        for (Map<String,Object> r : jdbc.queryForList(
            "SELECT panel_code, ISNULL(CONVERT(nvarchar(max), config),'') AS cfg FROM dbo.yj_panel WHERE panel_code IN (N'QC_FIRST_INSP',N'QC_PROC_INSP',N'QC_ASM_INSP')"))
            System.out.println(r);
        System.out.println("--- yj_usage_log 列 ---");
        for (Map<String,Object> r : jdbc.queryForList(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_usage_log' ORDER BY ORDINAL_POSITION"))
            System.out.println(r);
    }
}
