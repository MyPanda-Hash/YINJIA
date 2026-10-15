import java.sql.*;

/** 一次性探针:逐条试跑自检 SQL,定位语法错误。 */
public class Q4 {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String[] stmts = {
            "DECLARE @bad int = 0; "
              + "IF EXISTS (SELECT 1 FROM (VALUES (N'qc_mold_insp_detail'), (N'qc_cut_insp_detail'), (N'qc_asm_insp_detail')) AS t(v) "
              + "WHERE COL_LENGTH(N'dbo.' + v, N'检验要求') IS NULL) SET @bad = @bad + 1; SELECT @bad AS f1;",
            "DECLARE @bad int = 0; "
              + "IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') "
              + "AND col_name = N'检验要求' AND place LIKE N'%detail%') < 3 SET @bad = @bad + 1; SELECT @bad AS f2;",
            "DECLARE @bad int = 0; "
              + "IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') "
              + "AND col_name = N'检查频率' AND data_type = N'下拉框' AND ISNULL(dict_sql, N'') <> N'') < 3 SET @bad = @bad + 1; SELECT @bad AS f3;",
            "DECLARE @bad int = 0; "
              + "IF (SELECT COUNT(*) FROM sys.extended_properties ep WHERE ep.name = N'MS_Description' AND ep.class = 1 AND ep.minor_id > 0 "
              + "AND ((ep.major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail') AND ep.minor_id IN (COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), N'检验要求', 'ColumnId'), COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), N'检查频率', 'ColumnId'))))) < 6 "
              + "SET @bad = @bad + 1; SELECT @bad AS f4;",
            "DECLARE @bad int = 0; "
              + "IF (SELECT COUNT(*) FROM qc_asm_insp_detail) = 0 AND (SELECT COUNT(*) FROM qc_mold_insp_detail) = 0 "
              + "AND (SELECT COUNT(*) FROM qc_cut_insp_detail) = 0 PRINT N'[WARN] 三张明细表当前均为 0 行'; SELECT @bad AS f6;"
        };
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (int i = 0; i < stmts.length; i++) {
                try (Statement st = c.createStatement()) {
                    boolean hasRs = st.execute(stmts[i]);
                    System.out.println("[OK " + (i + 1) + "] hasRs=" + hasRs);
                    if (hasRs) {
                        try (ResultSet rs = st.getResultSet()) {
                            while (rs.next()) System.out.println("     -> " + rs.getString(1));
                        }
                    }
                } catch (SQLException e) {
                    System.out.println("[ERR " + (i + 1) + "] " + e.getMessage());
                }
            }
        }
    }
}
