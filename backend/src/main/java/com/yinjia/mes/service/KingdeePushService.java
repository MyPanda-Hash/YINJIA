package com.yinjia.mes.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 金蝶云·星辰推送服务(转ERP按钮)——纯 Java 实现,无 Node 子进程,部署包自包含。
 *
 * 认证(与 deploy/kingdee-client.mjs 同算法,SigTest 已验证逐字节一致):
 *   app_signature = Base64( hex( HMAC-SHA256(key=appSecret, msg=appKey) ) )
 *   X-Api-Signature = Base64( hex( HMAC-SHA256(key=clientSecret, 签名原文) ) )
 *   签名原文 = METHOD\n enc(path)\n 排序参数(值双重URL编码)\n x-api-nonce:N\n x-api-timestamp:T\n
 *
 * 传输用 HttpURLConnection(按原始字符串发送 URL,不重编码——Java HttpClient 的
 * URI 规范化会被金蝶网关拒签,实测 HttpURLConnection 通过)。
 *
 * 凭证来源(优先级): ① Spring 配置 kingdee.push.*(服务器: jar旁 config/application-*.properties
 * 或环境变量) → ② 兜底 deploy/push/config.json(本地联调,gitignored)。
 *
 * 授权模式:配置了 outerInstanceId 时走动态授权(真实账套,appSecret 24h 官方轮换,
 * 每次取新 token 前自动刷新 appKey/appSecret/domain,与 deploy/kingdee-client.mjs 同算法);
 * 未配置时用静态 appKey/appSecret(仅沙箱等特殊联调场景)。
 */
@Service
public class KingdeePushService {
    private static final Logger log = LoggerFactory.getLogger(KingdeePushService.class);
    private static final String API_BASE = "https://api.kingdee.com";
    private static final String TOKEN_PATH = "/jdyconnector/app_management/kingdee_auth_token";
    private static final String AUTH_PATH = "/jdyconnector/app_management/push_app_authorize";
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ObjectMapper json = new ObjectMapper();
    private final JdbcTemplate jdbc;

    @Value("${kingdee.push.clientId:}")
    private String clientId;
    @Value("${kingdee.push.clientSecret:}")
    private String clientSecret;
    @Value("${kingdee.push.outerInstanceId:}")
    private String outerInstanceId;
    @Value("${kingdee.push.appKey:}")
    private String appKey;
    @Value("${kingdee.push.appSecret:}")
    private String appSecret;
    @Value("${kingdee.push.domain:https://tf.jdy.com}")
    private String domain;

    private String cachedToken;
    private long tokenExpiresAt;

    public KingdeePushService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 凭证兜底:Spring 未配置时读 deploy/push/config.json(本地联调用;服务器用外部配置不经过这里) */
    private synchronized void ensureCreds() {
        if (clientId != null && !clientId.isBlank()) return;
        try {
            File f = new File(System.getProperty("user.dir") + File.separator
                    + "deploy" + File.separator + "push" + File.separator + "config.json");
            if (!f.isFile()) throw new IllegalStateException(
                    "金蝶凭证未配置:请设置 kingdee.push.*(Spring配置/环境变量)或提供 deploy/push/config.json");
            JsonNode k = json.readTree(Files.readString(f.toPath(), StandardCharsets.UTF_8)).path("kingdee");
            clientId = k.path("clientId").asText("");
            clientSecret = k.path("clientSecret").asText("");
            outerInstanceId = k.path("outerInstanceId").asText("");
            appKey = k.path("appKey").asText("");
            appSecret = k.path("appSecret").asText("");
            if (k.hasNonNull("domain") && !k.path("domain").asText("").isBlank()) domain = k.path("domain").asText();
        } catch (Exception e) {
            throw new IllegalStateException("读取金蝶凭证失败: " + e.getMessage(), e);
        }
    }

    // ══════════ 业务入口 ══════════

    public Map<String, Object> pushDocument(String panelCode, String docNo, String operator) throws Exception {
        boolean isPur = "PURCHASE_IN".equals(panelCode);
        String headTable = isPur ? "bd_purchase_in" : "bd_sale_out";
        String lineTable = isPur ? "bl_purchase_in" : "bl_sale_out";

        Map<String, Object> head = jdbc.queryForMap(
                "SELECT * FROM " + headTable + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", docNo);

        // ① 是否已转ERP = 是 → 直接提示(防多次点击)
        String pushed = String.valueOf(head.getOrDefault("是否已转ERP", ""));
        if ("是".equals(pushed)) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("是否已转ERP", "是");
            out.put("ERP单号", String.valueOf(head.getOrDefault("ERP单号", "")));
            out.put("message", "该单据已转入ERP，不可重复转入");
            return out;
        }

        // ② 状态校验(从 yj_doc_status 状态机取,与 UI 显示一致)
        String auditUser = null;
        try {
            auditUser = jdbc.queryForObject(
                    "SELECT shr FROM yj_doc_status WHERE panel_code = ? AND doc_no = ? AND shr IS NOT NULL",
                    String.class, panelCode, docNo);
        } catch (Exception ignored) {}
        if (auditUser == null) throw new RuntimeException("仅已审核(审批通过)单据可转ERP");

        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT * FROM " + lineTable + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", docNo);
        if (lines.isEmpty()) throw new RuntimeException("单据无明细行，不可转ERP");

        // ③ 行仓库编码:空的从 bs_wh 查
        for (Map<String, Object> line : lines) {
            Object stockCode = line.get("仓库编码");
            if (stockCode == null || String.valueOf(stockCode).isBlank()) {
                Object stockName = line.get("仓库");
                if (stockName == null || String.valueOf(stockName).isBlank()) stockName = line.get("仓库名称");
                if (stockName != null && !String.valueOf(stockName).isBlank()) {
                    try {
                        String code = jdbc.queryForObject(
                                "SELECT 仓库编码 FROM bs_wh WHERE 仓库名称 = ?", String.class, String.valueOf(stockName).trim());
                        if (code != null) line.put("仓库编码", code);
                    } catch (Exception ignored) {}
                }
            }
        }

        // ④ 构建金蝶 body(平铺;不传 bill_no → 金蝶自动生成编号,MES 编号放备注追溯)
        ObjectNode body = json.createObjectNode();
        body.put("bill_date", str(head.get("单据日期")));
        body.put("trans_type", "2");
        String remark = str(head.get("备注"));
        body.put("remark", (remark.isEmpty() ? "" : remark) + " [MES:" + docNo + "]");
        if (isPur) body.put("supplier_number", str(head.get("供应商编码")));
        else body.put("customer_number", str(head.get("客户编码")));

        ArrayNode entities = body.putArray("material_entity");
        int rowNo = 0;
        for (Map<String, Object> line : lines) {
            rowNo++;
            ObjectNode e = entities.addObject();
            e.put("material_number", str(line.get("存货编码")));
            e.put("qty", num(line, isPur ? "实收数量" : "数量"));
            e.put("price", num(line, isPur ? "单价" : "售价"));
            String model = str(line.get("规格型号")); if (!model.isEmpty()) e.put("material_model", model);
            double cess = num(line, "税率%"); if (cess != 0) e.put("cess", cess);
            // 计量单位(保存接口要 unit_id=金蝶单位ID,报错文案里的"unit"即此):行上"单位id"列
            // → 当前账套单位主数据(measure_unit)按名称换ID。单位ID按账套各不同(bs_uom 存的是
            // 读入账套的ID,跨账套复用会静默错单位),按当前凭证实时拉取 → 测试/真实套切换零改动
            String unit = str(line.get("计量单位"));
            String unitId = str(line.get("单位id"));
            if (unitId.isEmpty() && !unit.isEmpty()) unitId = str(unitMap().get(unit));
            if (unitId.isEmpty()) throw new RuntimeException(
                    "第" + rowNo + "行计量单位[" + unit + "]在当前账套金蝶单位档案中无对应ID,无法转ERP"
                            + (unit.isEmpty() ? "(行上未填计量单位)" : ""));
            e.put("unit_id", unitId);
            // 仓库编码:行级 > 头级 > 默认正品仓(金蝶要求非服务商品必须录入仓库)
            String stock = str(line.get("仓库编码")); if (stock.isEmpty()) stock = str(head.get("仓库编码"));
            if (stock.isEmpty()) stock = "CK00001";
            e.put("stock_number", stock);
            String batch = str(line.get("批号")); if (!batch.isEmpty()) e.put("batch_no", batch);
        }

        // ⑤ 推送(纯 Java HTTP)
        String apiPath = isPur ? "/jdy/v2/scm/pur_inbound" : "/jdy/v2/scm/sal_out_bound";
        JsonNode res = postJson(apiPath, body);
        if (res.path("errcode").asInt(-1) != 0) {
            String err = res.path("description_cn").asText(res.path("description").asText(res.toString()));
            throw new RuntimeException("金蝶接口失败: " + err);
        }
        String erpBillNo = "";
        JsonNode map = res.path("data").path("id_number_map");
        if (map.isObject()) {
            Iterator<JsonNode> it = map.elements();
            if (it.hasNext()) erpBillNo = it.next().asText("");
        }
        if (erpBillNo.isBlank()) throw new RuntimeException("金蝶未返回单号");

        // ⑥ 回写 MES(是否已转ERP=是 + 金蝶生成的ERP单号 + 操作人 + 时间)
        String now = LocalDateTime.now().format(FMT);
        jdbc.update("UPDATE " + headTable + " SET 是否已转ERP = N'是', ERP单号 = ?, 转ERP操作人 = ?, 转ERP时间 = ? WHERE 单据编号 = ?",
                erpBillNo, operator, now, docNo);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("是否已转ERP", "是");
        out.put("ERP单号", erpBillNo);
        out.put("转ERP操作人", operator);
        out.put("转ERP时间", now);
        out.put("message", "已成功转入金蝶ERP，ERP单号: " + erpBillNo + "（请在金蝶界面审核）");
        return out;
    }

    // ══════════ 计量单位解析(按当前账套动态拉取) ══════════

    private static final String UNIT_LIST_PATH = "/jdy/v2/bd/measure_unit";
    private Map<String, String> unitIdByName;
    private long unitCacheAt;

    /**
     * 当前账套的 计量单位名称→金蝶单位ID 缓存(22h,随 token 生命周期量级)。
     * 单位ID按账套各不同(米=8 是读入账套的ID,测试套里 id=8 可能是别的单位),
     * 切换测试/真实账套后自动按新凭证重拉,无需改代码或本地档案。
     */
    private synchronized Map<String, String> unitMap() throws Exception {
        ensureCreds(); // 凭证先行:本方法可能先于 getToken() 被调用(推送流程④),Spring 未配时须先装 config.json,否则 clientSecret 为空 → SecretKeySpec "Empty key"
        if (unitIdByName != null && System.currentTimeMillis() - unitCacheAt < 22 * 3600_000L) return unitIdByName;
        Map<String, String> m = new HashMap<>();
        for (int page = 1; page <= 10; page++) {
            Map<String, String> params = new TreeMap<>();
            params.put("page", String.valueOf(page));
            params.put("page_size", "200");
            String[] tn = timestampNonce();
            String url = API_BASE + UNIT_LIST_PATH + "?" + qs(params, false);
            Map<String, String> headers = baseHeaders(tn);
            headers.put("X-Api-Signature", apiSignature("GET", UNIT_LIST_PATH, params, tn[1], tn[0]));
            headers.put("app-token", getToken());
            headers.put("X-GW-Router-Addr", domain);
            JsonNode res = http("GET", url, headers, null);
            if (res.path("errcode").asLong(-1) != 0) {
                throw new RuntimeException("获取金蝶计量单位列表失败: "
                        + res.path("description").asText(res.toString()));
            }
            JsonNode rows = res.path("data").path("rows");
            int n = 0;
            if (rows.isArray()) {
                for (JsonNode r : rows) {
                    String nm = r.path("name").asText("");
                    if (!nm.isBlank()) m.put(nm, r.path("id").asText(""));
                    n++;
                }
            }
            if (n < 200) break;
        }
        if (m.isEmpty()) throw new RuntimeException("金蝶计量单位列表为空(账套无单位档案?)");
        unitIdByName = m;
        unitCacheAt = System.currentTimeMillis();
        log.info("金蝶计量单位档案已加载({}个,按当前账套,缓存22h)", m.size());
        return m;
    }

    // ══════════ HTTP(原始字节控制) ══════════

    private synchronized String getToken() throws Exception {
        ensureCreds();
        if (cachedToken != null && System.currentTimeMillis() < tokenExpiresAt) return cachedToken;
        boolean dyn = outerInstanceId != null && !outerInstanceId.isBlank();
        if (dyn) fetchAuthorization();
        JsonNode body = requestToken();
        if (body.path("errcode").asLong(-1) != 0) {
            // 1030002006: 授权密钥校验失败(appSecret 已 24h 轮换)→ 动态授权下重取授权信息再试一次
            if (dyn && body.path("errcode").asLong(-1) == 1030002006L) {
                fetchAuthorization();
                body = requestToken();
            }
            if (body.path("errcode").asLong(-1) != 0) {
                throw new RuntimeException("获取app-token失败: " + body.path("description").asText(body.toString()));
            }
        }
        cachedToken = body.path("data").path("app-token").asText("");
        if (cachedToken.isBlank()) throw new RuntimeException("app-token响应缺少字段");
        tokenExpiresAt = System.currentTimeMillis() + 22 * 3600_000L;
        log.info("金蝶 app-token 已获取(缓存22h)");
        return cachedToken;
    }

    private JsonNode requestToken() throws Exception {
        String appSignature = Base64.getEncoder().encodeToString(
                hex(hmacSha256(appSecret, appKey)).getBytes(StandardCharsets.UTF_8));
        Map<String, String> params = new TreeMap<>();
        params.put("app_key", appKey);
        params.put("app_signature", appSignature);
        String[] tn = timestampNonce(); // tn[0]=时间戳 tn[1]=随机数
        String qsSingle = qs(params, false);  // URL 用单次编码
        String url = API_BASE + TOKEN_PATH + "?" + qsSingle;
        Map<String, String> headers = baseHeaders(tn);
        headers.put("X-Api-Signature", apiSignature("GET", TOKEN_PATH, params, tn[1], tn[0]));
        headers.put("X-GW-Router-Addr", domain);
        return http("GET", url, headers, null);
    }

    /**
     * 动态授权(与 deploy/kingdee-client.mjs fetchAuthorization 同算法):
     * 凭 outerInstanceId 调 push_app_authorize 取当前 appKey/appSecret/domain。
     * 真实账套 appSecret 官方 24h 轮换,不能写死,须每次取新 token 前刷新;
     * 响应 data 为数组,取 status=1 的授权记录(无则首条),兼容 errcode/code 两种格式。
     */
    private void fetchAuthorization() throws Exception {
        Map<String, String> params = new TreeMap<>();
        params.put("outerInstanceId", outerInstanceId);
        String[] tn = timestampNonce();
        String url = API_BASE + AUTH_PATH + "?" + qs(params, false);
        Map<String, String> headers = baseHeaders(tn);
        headers.put("X-Api-Signature", apiSignature("POST", AUTH_PATH, params, tn[1], tn[0]));
        headers.put("X-GW-Router-Addr", domain);
        JsonNode res = http("POST", url, headers, "{}".getBytes(StandardCharsets.UTF_8));
        boolean ok = res.path("errcode").asLong(-1) == 0 || res.path("code").asLong(-1) == 200;
        if (!ok) {
            String err = res.toString();
            throw new RuntimeException("主动获取授权失败: " + (err.length() > 300 ? err.substring(0, 300) : err));
        }
        JsonNode data = res.path("data");
        JsonNode hit = null;
        if (data.isArray()) {
            for (JsonNode x : data) {
                if ("1".equals(x.path("status").asText(""))) { hit = x; break; }
            }
            if (hit == null && !data.isEmpty()) hit = data.get(0);
        }
        if (hit == null || hit.path("appKey").asText("").isBlank() || hit.path("appSecret").asText("").isBlank())
            throw new RuntimeException("授权信息响应中缺少 appKey/appSecret");
        appKey = hit.path("appKey").asText();
        appSecret = hit.path("appSecret").asText();
        String d = hit.path("domain").asText("");
        if (!d.isBlank()) domain = d;
        log.info("金蝶动态授权已刷新(appKey={}, 24h轮换自动适配)", appKey);
    }

    private JsonNode postJson(String path, ObjectNode bodyObj) throws Exception {
        ensureCreds();
        String token = getToken();
        String[] tn = timestampNonce(); // tn[0]=时间戳 tn[1]=随机数
        Map<String, String> headers = baseHeaders(tn);
        headers.put("X-Api-Signature", apiSignature("POST", path, new TreeMap<>(), tn[1], tn[0]));
        headers.put("app-token", token);
        headers.put("X-GW-Router-Addr", domain);
        return http("POST", API_BASE + path, headers, json.writeValueAsString(bodyObj).getBytes(StandardCharsets.UTF_8));
    }

    /** HttpURLConnection:URL 字符串原样发送(不重编码);含错误响应体回读 */
    private JsonNode http(String method, String urlStr, Map<String, String> headers, byte[] body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(60000);
        conn.setInstanceFollowRedirects(false);
        for (Map.Entry<String, String> h : headers.entrySet()) conn.setRequestProperty(h.getKey(), h.getValue());
        if (body != null) {
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Length", String.valueOf(body.length));
            try (OutputStream os = conn.getOutputStream()) { os.write(body); }
        }
        int status = conn.getResponseCode();
        InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
        String text;
        if (is == null) text = "";
        else { ByteArrayOutputStream buf = new ByteArrayOutputStream(); is.transferTo(buf); text = buf.toString(StandardCharsets.UTF_8); }
        conn.disconnect();
        if (text.isBlank()) throw new RuntimeException("金蝶接口空响应(HTTP " + status + ")");
        return json.readTree(text);
    }

    // ══════════ 签名与编码(与 kingdee-client.mjs 逐字节对齐) ══════════

    private Map<String, String> baseHeaders(String[] tn) {
        Map<String, String> h = new LinkedHashMap<>();
        h.put("Content-Type", "application/json");
        h.put("X-Api-ClientID", clientId);
        h.put("X-Api-Auth-Version", "2.0");
        h.put("X-Api-TimeStamp", tn[0]);
        h.put("X-Api-Nonce", tn[1]);
        h.put("X-Api-SignHeaders", "X-Api-TimeStamp,X-Api-Nonce");
        return h;
    }

    /** JavaScript encodeURIComponent 等价(URLEncoder 差异修正: + → %20, %7E → ~) */
    private String enc(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8").replace("+", "%20").replace("%7E", "~");
        } catch (java.io.UnsupportedEncodingException e) { throw new RuntimeException(e); }
    }

    /** 查询串(参数名 ASCII 排序;doubleEnc=true 双重编码用于签名原文,false 单次用于 URL) */
    private String qs(Map<String, String> params, boolean doubleEnc) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : new TreeMap<>(params).entrySet()) {
            if (sb.length() > 0) sb.append('&');
            String v = doubleEnc ? enc(enc(e.getValue())) : enc(e.getValue());
            sb.append(e.getKey()).append('=').append(v);
        }
        return sb.toString();
    }

    private String[] timestampNonce() {
        return new String[]{
                String.valueOf(System.currentTimeMillis()),
                String.valueOf(new Random().nextInt(2147483646) + 1)
        };
    }

    /** API 签名:HMAC→hex(小写)→Base64(hex字符串);原文=METHOD\n enc(path)\n 双编码QS\n nonce行\n ts行\n(尾换行必须有) */
    private String apiSignature(String method, String path, Map<String, String> params, String nonce, String timestamp)
            throws Exception {
        String plain = method.toUpperCase() + "\n"
                + enc(path) + "\n"
                + qs(params, true) + "\n"
                + "x-api-nonce:" + nonce + "\n"
                + "x-api-timestamp:" + timestamp + "\n";
        return Base64.getEncoder().encodeToString(
                hex(hmacSha256(clientSecret, plain)).getBytes(StandardCharsets.UTF_8));
    }

    // ══════════ 工具 ══════════

    private String str(Object v) { return v == null ? "" : String.valueOf(v).trim(); }
    private double num(Map<String, Object> row, String key) {
        Object v = row.get(key);
        if (v == null) return 0;
        try { return Double.parseDouble(String.valueOf(v)); } catch (NumberFormatException e) { return 0; }
    }
    private byte[] hmacSha256(String key, String message) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
    }
    private String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
