package com.yinjia.mes.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 金蝶云·星辰沙箱推送服务(转ERP按钮)。
 * 所有金蝶 API 调用通过 Node.js 子进程(deploy/push/_push-one.mjs)执行——
 * 签名/编码已验证一致但 Java HttpClient URI 规范化与网关有差异,Node 客户端实测可靠。
 */
@Service
public class KingdeePushService {
    private static final Logger log = LoggerFactory.getLogger(KingdeePushService.class);
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ObjectMapper json = new ObjectMapper();
    private final JdbcTemplate jdbc;

    public KingdeePushService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 推送采购入库/销售出库到金蝶沙箱。
     * @param panelCode PURCHASE_IN 或 SALE_OUT
     * @param docNo 单据编号
     * @param operator 操作人(当前登录用户)
     * @return { ERP单号, 转ERP操作人, 转ERP时间, message }
     */
    public Map<String, Object> pushDocument(String panelCode, String docNo, String operator) throws Exception {
        boolean isPur = "PURCHASE_IN".equals(panelCode);
        String headTable = isPur ? "bd_purchase_in" : "bd_sale_out";
        String lineTable = isPur ? "bl_purchase_in" : "bl_sale_out";

        // 1. 校验
        Map<String, Object> head = jdbc.queryForMap(
                "SELECT * FROM " + headTable + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", docNo);
        String status = String.valueOf(head.get("单据状态"));
        if (!"已审核".equals(status)) throw new RuntimeException("仅已审核单据可转ERP，当前状态: " + status);
        Object existingErpNo = head.get("ERP单号");
        if (existingErpNo != null && !String.valueOf(existingErpNo).isBlank())
            throw new RuntimeException("该单据已转ERP(ERP单号: " + existingErpNo + ")，不可重复转入");

        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT * FROM " + lineTable + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", docNo);
        if (lines.isEmpty()) throw new RuntimeException("单据无明细行，不可转ERP");

        // 2. 行仓库编码:空的从 bs_wh 查
        for (Map<String, Object> line : lines) {
            Object stockCode = line.get("仓库编码");
            if (stockCode == null || String.valueOf(stockCode).isBlank()) {
                Object stockName = line.get("仓库");
                if (stockName != null && !String.valueOf(stockName).isBlank()) {
                    try {
                        String code = jdbc.queryForObject(
                                "SELECT 仓库编码 FROM bs_wh WHERE 仓库名称 = ?", String.class, String.valueOf(stockName).trim());
                        if (code != null) line.put("仓库编码", code);
                    } catch (Exception ignored) {}
                }
            }
        }

        // 3. 构建 stdin JSON 传给 Node 脚本
        ObjectNode input = json.createObjectNode();
        input.put("panelCode", panelCode);
        input.put("docNo", docNo);
        input.put("operator", operator);
        input.set("head", json.valueToTree(head));
        input.set("lines", json.valueToTree(lines));
        String stdinJson = json.writeValueAsString(input);

        // 4. 调 Node 子进程推送
        String workDir = System.getProperty("user.dir") + File.separator + "deploy" + File.separator + "push";
        Process p = new ProcessBuilder("node", "_push-one.mjs")
                .directory(new File(workDir))
                .redirectErrorStream(false).start();
        p.getOutputStream().write(stdinJson.getBytes(StandardCharsets.UTF_8));
        p.getOutputStream().close();

        StringBuilder stdout = new StringBuilder();
        try (var reader = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) stdout.append(line);
        }
        if (!p.waitFor(60, java.util.concurrent.TimeUnit.SECONDS)) {
            p.destroyForcibly();
            throw new RuntimeException("转ERP超时(60秒)");
        }

        JsonNode result = json.readTree(stdout.toString());
        if (!result.path("ok").asBoolean(false)) {
            throw new RuntimeException("金蝶接口失败: " + result.path("error").asText("未知错误"));
        }

        // 5. 回写 MES
        String erpBillNo = result.path("erpBillNo").asText(docNo);
        String now = LocalDateTime.now().format(FMT);
        jdbc.update("UPDATE " + headTable + " SET ERP单号 = ?, 转ERP操作人 = ?, 转ERP时间 = ? WHERE 单据编号 = ?",
                erpBillNo, operator, now, docNo);

        // 6. 返回
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ERP单号", erpBillNo);
        out.put("转ERP操作人", operator);
        out.put("转ERP时间", now);
        out.put("message", "已成功转入金蝶ERP，ERP单号: " + erpBillNo + "（请在金蝶界面审核）");
        return out;
    }
}
