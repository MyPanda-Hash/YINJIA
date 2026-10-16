package com.yinjia.mes.tools;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** 核对本次新增标签的 en 译名是否齐备。 */
public class I18nCheck {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        StringBuilder sb = new StringBuilder("### 新增标签 en 译名核对\n");
        String[] keys = {"制程检验单", "制程检验记录表", "表区", "检验要求", "单项判定",
                         "抽检总量", "结果判断", "检验时间", "检验类别", "检验方法", "不合格应对措施",
                         "首件检验", "制程检验", "外观", "尺寸", "重量", "功能性测试"};
        try (Connection c = DriverManager.getConnection(url,
                System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {
            int missing = 0;
            for (String k : keys) {
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT scope, text FROM yj_translation WHERE ref_key=? AND locale='en'")) {
                    ps.setString(1, k);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            sb.append("  OK  ").append(k).append(" -> ").append(rs.getString("scope"))
                              .append(" / ").append(rs.getString("text")).append("\n");
                        } else {
                            sb.append("  MISS ").append(k).append(" -> 缺 en\n");
                            missing++;
                        }
                    }
                }
            }
            sb.append("\n缺失=").append(missing).append(" / ").append(keys.length).append("\n");
        }
        Files.write(Paths.get("D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\i18n.txt"),
                sb.toString().getBytes(StandardCharsets.UTF_8));
        System.out.println("WROTE");
    }
}
