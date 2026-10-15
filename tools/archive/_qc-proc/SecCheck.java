package com.yinjia.mes.tools;
import java.nio.charset.StandardCharsets; import java.nio.file.*; import java.sql.*;
public class SecCheck {
  public static void main(String[] a) throws Exception {
    String url="jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
    StringBuilder sb=new StringBuilder();
    try(Connection c=DriverManager.getConnection(url,System.getenv("YINJIA_SQL_USER"),System.getenv("YINJIA_SQL_PASS"))){
      ResultSet rs=c.createStatement().executeQuery(
        "SELECT label,data_type,ISNULL(dict_sql,'') AS dict FROM yj_field WHERE panel_code='QC_PROC_INSP' AND col_name='表区'");
      while(rs.next()) sb.append("表区: data_type=").append(rs.getString("data_type")).append(" dict=").append(rs.getString("dict")).append("\n");
      rs=c.createStatement().executeQuery(
        "SELECT 表区,COUNT(*) AS n FROM qc_proc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 表区");
      while(rs.next()) sb.append("现用表区值: ").append(rs.getString(1)).append(" (").append(rs.getInt(2)).append("行)\n");
    }
    Files.write(Paths.get("D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\sector.txt"),sb.toString().getBytes(StandardCharsets.UTF_8));
    System.out.println("WROTE");
  }
}
