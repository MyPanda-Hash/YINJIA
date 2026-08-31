package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 单号服务:沿用旧系统 s_allno 号池(前缀+yyMMdd+4位序号,如 RK2608290001)。
 */
@Service
public class FormNoService {

    private final JdbcTemplate jdbc;

    public FormNoService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 生成下一个单号(写入 s_allno 留痕,与旧系统一致) */
    public String next(String prefix, String user) {
        String ny = LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        Integer maxSeq = jdbc.queryForObject(
                "SELECT MAX(CAST(RIGHT(dh, 4) AS int)) FROM s_allno WHERE lb = ? AND ny = ? AND LEN(dh) >= 10",
                Integer.class, prefix, ny);
        int seq = (maxSeq == null ? 0 : maxSeq) + 1;
        String no;
        do {
            no = prefix + ny + String.format("%04d", seq);
            seq++;
        } while (exists(no));
        jdbc.update("INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel) VALUES (?,?,?,?,?,GETDATE(),'N')",
                "0", no, prefix, ny, user == null ? "admin" : user);
        return no;
    }

    /** 预览下一个单号(不消耗号池;新建表单默认值展示用) */
    public String preview(String prefix) {
        String ny = LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        Integer maxSeq = jdbc.queryForObject(
                "SELECT MAX(CAST(RIGHT(dh, 4) AS int)) FROM s_allno WHERE lb = ? AND ny = ? AND LEN(dh) >= 10",
                Integer.class, prefix, ny);
        return prefix + ny + String.format("%04d", (maxSeq == null ? 0 : maxSeq) + 1);
    }

    private boolean exists(String no) {
        List<String> rows = jdbc.query(
                "SELECT TOP 1 dh FROM s_allno WHERE dh = ? UNION SELECT TOP 1 inh_no FROM inh WHERE inh_no = ?",
                (rs, i) -> rs.getString(1), no, no);
        return !rows.isEmpty();
    }
}
