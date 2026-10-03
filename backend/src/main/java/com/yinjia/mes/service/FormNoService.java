package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 单号服务:沿用旧系统 s_allno 号池(前缀-yyyy-MM-4位序号,如 PG-2026-09-0001)。
 * 号池 ny 列存 yyyy-MM(与历史横杠格式单据的月份段一致,续号按 前缀+月份 连续);
 * 旧紧凑格式历史行(前缀+yyMMdd,ny=yyMMdd)因 ny/dh 形态不同天然隔离,互不串号。
 */
@Service
public class FormNoService {

    private final JdbcTemplate jdbc;

    public FormNoService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 生成下一个单号(写入 s_allno 留痕,与旧系统一致) */
    public String next(String prefix, String user) {
        String ny = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
        Integer maxSeq = jdbc.queryForObject(
                "SELECT MAX(CAST(RIGHT(dh, 4) AS int)) FROM s_allno WHERE lb = ? AND ny = ? AND dh LIKE ?",
                Integer.class, prefix, ny, prefix + "-" + ny + "-%");
        int seq = (maxSeq == null ? 0 : maxSeq) + 1;
        String no;
        do {
            no = prefix + "-" + ny + "-" + String.format("%04d", seq);
            seq++;
        } while (exists(no));
        jdbc.update("INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel) VALUES (?,?,?,?,?,GETDATE(),'N')",
                "0", no, prefix, ny, user == null ? "admin" : user);
        return no;
    }

    /** 预览下一个单号(不消耗号池;新建表单默认值展示用) */
    public String preview(String prefix) {
        String ny = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
        Integer maxSeq = jdbc.queryForObject(
                "SELECT MAX(CAST(RIGHT(dh, 4) AS int)) FROM s_allno WHERE lb = ? AND ny = ? AND dh LIKE ?",
                Integer.class, prefix, ny, prefix + "-" + ny + "-%");
        return prefix + "-" + ny + "-" + String.format("%04d", (maxSeq == null ? 0 : maxSeq) + 1);
    }

    private boolean exists(String no) {
        // 2026-09-30:原为 `... UNION SELECT TOP 1 inh_no FROM inh WHERE inh_no = ?` —— inh 已由遗留纺织表
        // 重建为 MES 入库流水表,inh_no 列不存在,该 UNION 使**每次生成单号**都抛
        // 「列名 'inh_no' 无效」(error 207)⇒ 新增/保存任何单据都 500(实测复现见
        // tools/archive/_probe-formno-inh-no.cjs)。此处改读重建后的 单据编号,保持"单号不与流水冲突"的原意;
        // 纺织老数据已导出 tools/archive/_stock-flow-backup-20260930.csv,其单号不再进号池,
        // 而 s_allno.dh 分支仍是号池内的唯一性判据。
        List<String> rows = jdbc.query(
                "SELECT TOP 1 dh FROM s_allno WHERE dh = ? UNION SELECT TOP 1 单据编号 FROM inh WHERE 单据编号 = ?",
                (rs, i) -> rs.getString(1), no, no);
        return !rows.isEmpty();
    }
}
