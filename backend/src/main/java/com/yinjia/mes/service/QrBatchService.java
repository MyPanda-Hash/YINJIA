package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 二维码批号服务:全系统统一批号生成(yyyymmdd+3位流水)。
 * 三类码共用一张注册表:
 * - 材料二维码 = 物料编码 + 批号 (来源:采购入库)
 * - 工单二维码 = 工单号(合同号)   (来源:MANU_ORDER)
 * - 产品二维码 = 产品编码 + 批号  (来源:成型/切炭报工)
 */
@Service
public class QrBatchService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private final JdbcTemplate jdbc;

    public QrBatchService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 生成一个新批号(yyyymmdd+3位流水,线程安全,同日递增) */
    @Transactional
    public String nextBatchNo(String itemCode, String sourceType, String sourceNo, String user) {
        String dateStr = LocalDate.now().format(DATE_FMT);
        // 同日最大流水(行锁防并发)
        Integer maxSeq = jdbc.queryForObject(
                "SELECT ISNULL(MAX(seq), 0) FROM qr_batch_registry WITH (UPDLOCK, HOLDLOCK) WHERE biz_date = CAST(? AS date)",
                Integer.class, LocalDate.now().toString());
        int seq = (maxSeq == null ? 0 : maxSeq) + 1;
        String batchNo = dateStr + String.format("%03d", seq);
        jdbc.update("INSERT INTO qr_batch_registry (batch_no, biz_date, seq, item_code, source_type, source_no, created_by) VALUES (?,?,?,?,?,?,?)",
                batchNo, LocalDate.now(), seq, itemCode, sourceType, sourceNo, user);
        return batchNo;
    }

    /** 批量生成批号(连续流水) */
    @Transactional
    public List<String> nextBatchNos(int count, String itemCode, String sourceType, String sourceNo, String user) {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < count; i++) out.add(nextBatchNo(itemCode, sourceType, sourceNo, user));
        return out;
    }

    /** 组装材料二维码内容 = 物料编码 + 批号 */
    public String materialQr(String itemCode, String batchNo) {
        return itemCode + "-" + batchNo;
    }

    /** 组装产品二维码内容 = 产品编码 + 批号 */
    public String productQr(String productCode, String batchNo) {
        return productCode + "-" + batchNo;
    }

    /** 按来源单据查已注册的批号 */
    public List<Map<String, Object>> findBySource(String sourceType, String sourceNo) {
        return jdbc.queryForList(
                "SELECT batch_no, item_code, source_type, source_no, created_by, created_at FROM qr_batch_registry"
                        + " WHERE source_type = ? AND source_no = ? AND batch_no IS NOT NULL ORDER BY seq",
                sourceType, sourceNo);
    }

    /** 按日期区间查批号(打印界面) */
    public List<Map<String, Object>> findByDateRange(String fromDate, String toDate) {
        return jdbc.queryForList(
                "SELECT r.batch_no, r.item_code, r.source_type, r.source_no, r.created_by, r.created_at,"
                        + " ISNULL(i.[存货名称], ISNULL(b.[父件名称], '')) AS item_name"
                        + " FROM qr_batch_registry r"
                        + " LEFT JOIN bs_inv i ON r.item_code = i.[存货编码]"
                        + " LEFT JOIN bs_bom b ON r.item_code = b.[父件编码] AND ISNULL(b.asp_cancel,'N')<>'Y'"
                        + " WHERE r.biz_date BETWEEN ? AND ?"
                        + " ORDER BY r.biz_date, r.seq",
                fromDate, toDate);
    }
}
