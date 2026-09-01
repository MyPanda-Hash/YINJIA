package com.yinjia.mes.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 报表栏目设置:report_column_settings 表按面板编码存 JSON
 * ({columns:[{prop,label,visible}],sort:{prop,order}}),全部用户共享。
 * 报表表头筛选与排序补丁的后端持久化层(JDBC,对齐本项目无 ORM 的风格)。
 */
@Service
public class ReportColumnSettingsService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public ReportColumnSettingsService(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** 按面板编码读取设置(无记录或 JSON 损坏返回空 Map) */
    @SuppressWarnings({"unchecked", "rawtypes"})
    public Map<String, Object> load(String panelCode) {
        List<String> rows = jdbc.query(
                "SELECT settings FROM report_column_settings WHERE panel_code = ?",
                (rs, i) -> rs.getString(1), panelCode);
        if (rows.isEmpty()) return Map.of();
        try {
            return json.readValue(rows.get(0), Map.class);
        } catch (Exception e) {
            return Map.of();
        }
    }

    /** 保存设置(存在则更新,不存在则插入) */
    public void save(String panelCode, Map<String, Object> settings) {
        String value;
        try {
            value = json.writeValueAsString(settings);
        } catch (Exception e) {
            throw new IllegalStateException("报表栏目设置序列化失败", e);
        }
        String user = currentUser();
        int updated = jdbc.update(
                "UPDATE report_column_settings SET settings = ?, update_by = ?, update_time = SYSDATETIME() WHERE panel_code = ?",
                value, user, panelCode);
        if (updated == 0) {
            jdbc.update("INSERT INTO report_column_settings (panel_code, settings, update_by) VALUES (?,?,?)",
                    panelCode, value, user);
        }
    }

    private String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }
}
