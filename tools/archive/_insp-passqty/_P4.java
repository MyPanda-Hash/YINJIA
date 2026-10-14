package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** _P4: 制程检验单 QC_PROC_INSP 结构(是否同样有 报工/检验/合格/不合格 数量列)。 */
public class _P4 {
    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_insp-passqty\\_p4.txt";
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            p(w, "=== ① qc_proc_insp 表清单 ===");
            q(w, c, "SELECT name FROM sys.tables WHERE name LIKE N'qc_proc_insp%' ORDER BY name");

            p(w, "\n=== ② qc_proc_insp_head 数量列 ===");
            q(w, c, "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS"
                    + " WHERE TABLE_NAME LIKE N'qc_proc_insp%' AND (COLUMN_NAME LIKE N'%数量%' OR COLUMN_NAME LIKE N'%总量%'"
                    + " OR COLUMN_NAME LIKE N'%合格%' OR COLUMN_NAME LIKE N'%不合格%')"
                    + " ORDER BY TABLE_NAME, ORDINAL_POSITION");

            p(w, "\n=== ③ QC_PROC_INSP yj_field 全量 ===");
            q(w, c, "SELECT col_name, label, place, seq, visible, hidden, editable, data_type"
                    + " FROM yj_field WHERE panel_code=N'QC_PROC_INSP' ORDER BY place, seq");

            p(w, "\n=== ④ qc_proc_insp_head 数据 ===");
            q(w, c, "SELECT COUNT(*) AS 单数 FROM dbo.qc_proc_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'");
        }
    }

    static void q(BufferedWriter w, Connection c, String sql) throws Exception {
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) h.append(m.getColumnLabel(i)).append('\t');
            w.write(h.toString()); w.newLine();
            int n = 0;
            while (rs.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) b.append(rs.getString(i)).append('\t');
                w.write(b.toString()); w.newLine(); n++;
            }
            w.write("-- " + n + " row(s)"); w.newLine();
        }
        w.flush();
    }

    static void p(BufferedWriter w, String s) throws Exception { w.write(s); w.newLine(); w.flush(); }
}
