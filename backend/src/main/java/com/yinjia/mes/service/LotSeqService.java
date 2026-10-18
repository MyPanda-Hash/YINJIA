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
    public String next() {
        return next(LocalDate.now());
    }

    /**
     * 取指定日期的下一个批号(yyyymmddNNN)。
     *
     * <p>为什么要带日期:采购入库单/产成品入库单的批号按**单据日期**取号(用户 2026-10-18 口径
     * 「新加的真实数据就按日期加三位流水来」),而这些单据的单据日期可以是补录的历史日期 ——
     * 一律用今天取号会写出与单据日期不符的批号。
     */
    @Transactional
    public String next(LocalDate day0) {
        String day = (day0 == null ? LocalDate.now() : day0).format(DAY);
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
