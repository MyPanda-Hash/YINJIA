package com.yinjia.mes.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * 批号取号器:批号 = 入库日期(yyyymmdd) + 3位流水,源自 yj_lot_seq(日期, 当前流水)。
 * 二维码 = 物料编码+批号(取代产品流动标识卡,总流程图备注)。
 * 原子性:UPDATE ... OUTPUT 原子自增;并发首插由主键兜底(DuplicateKeyException 忽略重试)。
 * 流水按日重置;超过 999 时格式自然扩为 4 位(退化可接受,业务量远达不到)。
 */
@Service
public class LotSeqService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

    private final JdbcTemplate jdbc;

    public LotSeqService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 取当天下一个批号(yyyymmddNNN)。 */
    @Transactional
    public String next() {
        String day = LocalDate.now().format(DAY);
        try {
            jdbc.update("IF NOT EXISTS (SELECT 1 FROM yj_lot_seq WHERE 日期 = ?) INSERT INTO yj_lot_seq (日期, 当前流水) VALUES (?, 0)", day, day);
        } catch (DuplicateKeyException race) {
            // 并发首插竞态:另一事务已插入,忽略
        }
        Integer seq = jdbc.queryForObject(
                "UPDATE yj_lot_seq SET 当前流水 = 当前流水 + 1 OUTPUT INSERTED.当前流水 WHERE 日期 = ?",
                Integer.class, day);
        return day + String.format("%03d", seq == null ? 1 : seq);
    }
}
