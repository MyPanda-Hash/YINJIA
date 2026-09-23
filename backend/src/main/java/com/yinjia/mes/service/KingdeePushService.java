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
    /**
     * 是否允许把单据推进**真实账套**。默认 false = 只允许推测试沙箱。
     * 判定依据沿用本项目凭证约定(见类注释):outerInstanceId 非空 ⇒ 动态授权 ⇒ **真实账套**;
     * 留空 ⇒ 静态 appKey/appSecret ⇒ 测试沙箱。真实账套需显式开启本开关才放行,
     * 防"配置误指向正式账套 + 随手点转ERP"把测试/演示单据写进正式账(2026-09-20 用户口径)。
     */
    @Value("${kingdee.push.allowProd:false}")
    private boolean allowProd;

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

    /**
     * 推送前**账套守卫**(在发任何 HTTP 之前执行,失败即拒,不会写任何单据):
     * 本项目凭证约定 outerInstanceId 非空 = 真实账套;默认只允许测试沙箱(静态 appKey/appSecret)。
     * 命中真实账套且未显式开启 {@code kingdee.push.allowProd=true} → 直接拒绝并给出可操作提示。
     */
    private void assertPushTargetAllowed() {
        ensureCreds(); // 只读本地配置,不联网
        boolean realAccount = outerInstanceId != null && !outerInstanceId.isBlank();
        // 每次转ERP 都留一条目标账套日志(可审计:哪次推送打到了哪个账套)
        log.info("转ERP 目标账套 = {}(clientId={}, domain={})",
                realAccount ? "真实账套" : "测试沙箱", maskId(clientId), domain);
        if (realAccount && !allowProd) {
            throw new IllegalStateException("已拒绝转ERP:当前金蝶凭证指向**真实账套**(outerInstanceId="
                    + maskId(outerInstanceId) + "),本功能默认只允许推测试沙箱,以免测试单据写进正式账。"
                    + "确认要推真实账套时,请显式配置 kingdee.push.allowProd=true 后重试");
        }
    }

    /** 只留前缀的脱敏(用于日志/报错文案,避免把账套标识打全) */
    private static String maskId(String s) {
        if (s == null || s.isBlank()) return "(空)";
        String t = s.trim();
        return t.length() <= 6 ? t.charAt(0) + "***" : t.substring(0, 6) + "…";
    }

    // ══════════ 业务入口 ══════════

    public Map<String, Object> pushDocument(String panelCode, String docNo, String operator) throws Exception {
        assertPushTargetAllowed(); // 守卫先行:真实账套未开启 allowProd 时,连 token 都不取
        boolean isPur = "PURCHASE_IN".equals(panelCode);
        // 采购订单直推(2026-09-23):作为**金蝶采购订单**落到目标账套(用户口径:测试沙箱的采购订单里);
        // 与入库单推送互不影响 —— 订单推 pur_order,入库单推 pur_inbound(后者带 src 挂回订单)。
        boolean isOrder = "PU_ORDER".equals(panelCode);
        String headTable = isOrder ? "bd_pu_order" : isPur ? "bd_purchase_in" : "bd_sale_out";
        String lineTable = isOrder ? "bl_pu_order" : isPur ? "bl_purchase_in" : "bl_sale_out";

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

        // ②b 采购订单直推的查重:目标账套已存在**同号**采购订单则拒绝 —— 订单是下游单据的源头,
        //     重复落一张会造成两边各一张、源单关联错乱(同步进来的订单本身就带金蝶号,天然会命中此守卫)
        if (isOrder && resolvePoRefs(docNo) != null) {
            throw new RuntimeException("目标账套已存在同号采购订单[" + docNo + "],不重复推送"
                    + "(如确需重推:先在金蝶删除该订单并弃审本单清标记后再转)");
        }

        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT * FROM " + lineTable + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", docNo);
        if (lines.isEmpty()) throw new RuntimeException("单据无明细行，不可转ERP");

        // ③ 行仓库编码:空的从 bs_wh 解析(2026-09-23:采购入库/销售出库的明细仓库由「参照选仓库」
        //    录入,值可能只落在 仓库名称 或 仓库 上;两者都按「名称或编码」匹配 bs_wh)
        //    采购订单不推仓库(订单无入库语义,仓档不全的账套反而拒单),跳过
        if (!isOrder) for (Map<String, Object> line : lines) {
            Object stockCode = line.get("仓库编码");
            if (stockCode != null && !String.valueOf(stockCode).isBlank()) continue;
            String raw = str(line.get("仓库名称"));
            if (raw.isEmpty()) raw = str(line.get("仓库"));
            if (raw.isEmpty()) continue;
            try {
                List<String> hit = jdbc.queryForList(
                        "SELECT 仓库编码 FROM bs_wh WHERE 仓库名称 = ? OR 仓库编码 = ?", String.class, raw, raw);
                if (!hit.isEmpty()) line.put("仓库编码", hit.get(0));
            } catch (Exception ignored) {}
        }

        // ④ 构建金蝶 body(平铺;不传 bill_no → 金蝶自动生成编号,MES 编号放备注追溯)
        ObjectNode body = json.createObjectNode();
        body.put("bill_date", str(head.get("单据日期")));
        if (!isOrder) body.put("trans_type", "2"); // 入库/出库单的业务类型;采购订单无此项
        String remark = str(head.get("备注"));
        body.put("remark", (remark.isEmpty() ? "" : remark) + " [MES:" + docNo + "]");
        if (isPur || isOrder) body.put("supplier_number", str(head.get("供应商编码")));
        else body.put("customer_number", str(head.get("客户编码")));

        ArrayNode entities = body.putArray("material_entity");
        // 来源单引用(金蝶行级 src_* 族):采购入库单带 采购订单号 → 金蝶按来源订单挂联
        // 2026-09-20 补全为金蝶自身的完整关联写法(真实账套实测:带源单的行 6 个键齐全):
        //   src_bill_no(订单号)+ src_bill_type_id/number(常量 pur_bill_order)+ src_bill_type_name(采购订单)
        //   + src_seq(采购订单行号=订单分录序号)+ src_inter_id/src_entry_id(订单单据id/分录id,按单号向金蝶解析)。
        // 沙箱实测(359220)补充的关键事实:**带上 src_bill_type_id 后金蝶会真的校验来源单** ——
        //   订单号在目标账套不存在时整单被拒("单据X的源单''已被删除"),而旧代码只发 src_bill_no+type_name
        //   时金蝶静默忽略该引用(落库后 src_bill_no 为空)。
        // 因此口径:**解析到订单才推源单组**;解析不到(订单不在该账套/号写错/账套配错)则整组不推、
        //   按无来源单的普通入库单推送,并在返回消息里明确提示,避免"账套里没有该订单 → 转ERP 直接失败"。
        String poNo = str(head.get("采购订单号"));
        String linkWarning = "";
        PoRefs poRefs = null;
        if (isPur && poNo.isEmpty()) {
            log.warn("采购入库单[{}]头上无采购订单号:本次转ERP 不带金蝶源单关联(src_bill_no/src_seq),"
                    + "金蝶侧显示为无来源单的普通入库单", docNo);
        } else if (isPur) {
            poRefs = resolvePoRefs(poNo);
            if (poRefs == null) {
                linkWarning = "；注意:金蝶账套内未找到采购订单[" + poNo + "],本次未挂来源单(请核对账套/订单号,"
                        + "或先在金蝶补建该订单后重审再转)";
                log.warn("采购入库单[{}] 未挂来源单:金蝶账套内无采购订单[{}]", docNo, poNo);
            }
        }
        boolean linkSrc = isPur && poRefs != null;
        // 采购订单直推的字段口径:订单行叫 物料编码/数量/单价/单位;入库行叫 存货编码/实收数量/单价/计量单位
        String matKey = isOrder ? "物料编码" : "存货编码";
        String qtyKey = isPur ? "实收数量" : "数量";
        String priceKey = isPur || isOrder ? "单价" : "售价";
        String unitKey = isOrder ? "单位" : "计量单位";
        int rowNo = 0;
        for (Map<String, Object> line : lines) {
            rowNo++;
            ObjectNode e = entities.addObject();
            String materialNo = str(line.get(matKey));
            e.put("material_number", materialNo);
            // 商品ID:挂来源单时必须与源单分录一致(金蝶按 material_id 比对),故按存货编码解析后一并传;
            // 解析不到不阻断(无来源单的普通入库单靠 material_number 即可),仅在挂联场景下报错提示
            String materialId = materialNo.isEmpty() ? "" : str(materialMap().get(materialNo));
            if (materialId.isEmpty()) {
                log.warn("采购入库单[{}]第{}行存货编码[{}]在当前账套金蝶商品档案中无对应ID:不传 material_id",
                        docNo, rowNo, materialNo);
            } else {
                e.put("material_id", materialId);
            }
            // 采购订单接口(pur_order)的 proto 校验比入库单严:qty/price/cess 按**字符串**收
            // (实测:数字型 price 报 "proto: invalid value for string type: 0.39");
            // 入库/出库接口照旧收数字,两类单据分开发。
            if (isOrder) {
                e.put("qty", plainDecimal(num(line, qtyKey)));
                e.put("price", plainDecimal(num(line, priceKey)));
                double cessO = num(line, "税率%"); if (cessO != 0) e.put("cess", plainDecimal(cessO));
            } else {
                e.put("qty", num(line, qtyKey));
                e.put("price", num(line, priceKey));
                double cess = num(line, "税率%"); if (cess != 0) e.put("cess", cess);
            }
            String model = str(line.get("规格型号")); if (!model.isEmpty()) e.put("material_model", model);
            // 计量单位(保存接口要 unit_id=金蝶单位ID,报错文案里的"unit"即此):行上"单位id"列
            // → 当前账套单位主数据(measure_unit)按名称换ID。单位ID按账套各不同(bs_uom 存的是
            // 读入账套的ID,跨账套复用会静默错单位),按当前凭证实时拉取 → 测试/真实套切换零改动
            String unit = str(line.get(unitKey));
            String unitId = str(line.get("单位id"));
            // 采购订单直推:行上"单位id"是**当初同步来源账套**的ID,跨账套会静默错单位 ——
            // 先按名称在当前凭证账套解析(unitMap),解析不到再退行上ID(与入库单的顺序相反,原因同上注释)
            if (isOrder && !unit.isEmpty()) {
                String resolved = str(unitMap().get(unit));
                if (!resolved.isEmpty()) unitId = resolved;
            }
            if (unitId.isEmpty() && !unit.isEmpty()) unitId = str(unitMap().get(unit));
            if (unitId.isEmpty() && !unit.isEmpty()) {
                // 单位缓存 22h:目标账套刚补建了单位(如沙箱补「张」)而缓存还是旧的 → 强制失效重拉一次,
                // 免去"补了单位还要重启后端"(2026-09-23 沙箱实测踩坑:补建后重试仍报无对应ID)
                unitIdByName = null;
                unitId = str(unitMap().get(unit));
            }
            if (unitId.isEmpty()) throw new RuntimeException(
                    "第" + rowNo + "行计量单位[" + unit + "]在当前账套金蝶单位档案中无对应ID,无法转ERP"
                            + (unit.isEmpty() ? "(行上未填计量单位)" : ""));
            e.put("unit_id", unitId);
            // 仓库编码:行级 > 头级 > 默认正品仓(金蝶要求非服务商品必须录入仓库);
            // 落到默认仓时打日志 —— 否则"单据没录仓库"会被静默推成 CK00001,账面上看不出来。
            // 采购订单不推仓库(订单无入库语义)
            if (!isOrder) {
                String stock = str(line.get("仓库编码")); if (stock.isEmpty()) stock = str(head.get("仓库编码"));
                if (stock.isEmpty()) {
                    stock = "CK00001";
                    log.warn("单据[{}]第{}行无行级/头级仓库编码,已按默认正品仓 CK00001 推送,请核对单据仓库", docNo, rowNo);
                }
                e.put("stock_number", stock);
            }
            String batch = str(line.get("批号")); if (!batch.isEmpty() && !isOrder) e.put("batch_no", batch);
            // 来源单:行级 src_bill_no=采购订单号(同单全部行带同一订单号;订单号与采购订单号同义)
            // src_seq=该行对应的采购订单行号(采购订单行 行号,沿 订单→暂收→检验→入库 逐站带下来)
            // 仅当订单在金蝶解析到(linkSrc)才推整组;src_seq 必须在订单确有该分录时才推,
            // 否则金蝶会因"源单分录不存在"整单被拒(用分录映射当白名单)。
            if (linkSrc) {
                if (materialId.isEmpty()) {
                    throw new RuntimeException("第" + rowNo + "行存货编码[" + materialNo + "]在当前账套金蝶商品档案中无对应ID,"
                            + "无法挂来源单(采购订单[" + poNo + "]):请核对商品档案或账套后重试");
                }
                e.put("src_bill_no", poNo);
                e.put("src_bill_type_id", "pur_bill_order");
                e.put("src_bill_type_number", "pur_bill_order");
                e.put("src_bill_type_name", "采购订单");
                e.put("src_inter_id", poRefs.billId());
                Integer srcSeq = intOf(lineColumn(line, "源单行号", "采购订单行号"));
                if (srcSeq == null) {
                    log.warn("采购入库单[{}]第{}行无采购订单行号:该行不带 src_seq(金蝶侧按订单号挂单,不定位到具体行)", docNo, rowNo);
                } else {
                    String entryId = poRefs.entryIdBySeq().get(srcSeq);
                    if (entryId == null) {
                        log.warn("采购入库单[{}]第{}行 采购订单行号[{}] 在采购订单[{}]分录中不存在:该行不带 src_seq/src_entry_id",
                                docNo, rowNo, srcSeq, poNo);
                    } else {
                        e.put("src_seq", srcSeq);
                        e.put("src_entry_id", entryId);
                    }
                }
            }
        }

        // ⑤ 推送(纯 Java HTTP)
        String apiPath = isOrder ? "/jdy/v2/scm/pur_order"
                : isPur ? "/jdy/v2/scm/pur_inbound" : "/jdy/v2/scm/sal_out_bound";
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
        out.put("message", "已成功转入金蝶ERP，ERP单号: " + erpBillNo + "（请在金蝶界面审核）" + linkWarning);
        return out;
    }

    // ══════════ 计量单位解析(按当前账套动态拉取) ══════════

    private static final String UNIT_LIST_PATH = "/jdy/v2/bd/measure_unit";
    private static final String PO_LIST_PATH = "/jdy/v2/scm/pur_order";
    private static final String PO_DETAIL_PATH = "/jdy/v2/scm/pur_order_detail";

    /** 采购订单金蝶内部引用(src_inter_id=单据id;src_entry_id=按分录 seq 查分录id) */
    private record PoRefs(String billId, Map<Integer, String> entryIdBySeq) {}

    /** 采购订单引用缓存(单号→引用;转ERP 为低频操作,进程内缓存即可;失败不缓存以便重试) */
    private final Map<String, PoRefs> poRefsCache = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * 按采购订单号向金蝶解析 订单单据id + 各分录id(推送 src_inter_id/src_entry_id 用)。
     * 列表接口支持 bill_no 精确过滤(实测:pur_order?bill_no=YJ-20260916-02 返回单条),
     * 详情接口 material_entity[].{seq,id} 即 分录序号→分录id。
     * 解析不到(如订单在金蝶不存在/网络异常)返回 null:调用方只推 src_bill_no/type/seq,不阻塞转ERP。
     */
    private PoRefs resolvePoRefs(String poNo) {
        if (poNo == null || poNo.isBlank()) return null;
        PoRefs cached = poRefsCache.get(poNo);
        if (cached != null) return cached;
        try {
            Map<String, String> lp = new TreeMap<>();
            lp.put("page", "1"); lp.put("page_size", "10"); lp.put("bill_no", poNo);
            JsonNode rows = kingdeeGet(PO_LIST_PATH, lp).path("rows");
            String billId = "";
            if (rows.isArray()) {
                for (JsonNode r : rows) {
                    if (poNo.equals(r.path("bill_no").asText(""))) { billId = r.path("id").asText(""); break; }
                }
            }
            if (billId.isEmpty()) {
                log.warn("金蝶账套内未找到采购订单[{}]:本次转ERP 只推 src_bill_no/src_bill_type_*/src_seq,不带 src_inter_id/src_entry_id", poNo);
                return null;
            }
            Map<String, String> dp = new TreeMap<>();
            dp.put("id", billId);
            JsonNode entries = kingdeeGet(PO_DETAIL_PATH, dp).path("material_entity");
            Map<Integer, String> bySeq = new HashMap<>();
            if (entries.isArray()) {
                for (JsonNode e : entries) {
                    int seq = e.path("seq").asInt(-1);
                    String eid = e.path("id").asText("");
                    if (seq > 0 && !eid.isEmpty()) bySeq.put(seq, eid);
                }
            }
            PoRefs out = new PoRefs(billId, bySeq);
            poRefsCache.put(poNo, out);
            log.info("金蝶采购订单[{}] 源单引用已解析:单据id={} 分录 {} 条", poNo, billId, bySeq.size());
            return out;
        } catch (Exception e) {
            log.warn("解析金蝶采购订单[{}]内部id 失败({}):本次转ERP 不带 src_inter_id/src_entry_id,其余字段照推",
                    poNo, e.getMessage());
            return null;
        }
    }

    /** 金蝶 GET(签名 + app-token,与计量单位拉取同款);返回 data 节点,errcode!=0 抛业务异常 */
    private JsonNode kingdeeGet(String path, Map<String, String> params) throws Exception {
        ensureCreds();
        String[] tn = timestampNonce();
        String url = API_BASE + path + "?" + qs(params, false);
        Map<String, String> headers = baseHeaders(tn);
        headers.put("X-Api-Signature", apiSignature("GET", path, params, tn[1], tn[0]));
        headers.put("app-token", getToken());
        headers.put("X-GW-Router-Addr", domain);
        JsonNode res = http("GET", url, headers, null);
        long code = res.path("errcode").asLong(-1);
        if (code != 0) {
            throw new RuntimeException("金蝶接口失败(" + code + "): " + res.path("description").asText(res.toString()));
        }
        return res.path("data");
    }

    /** 宽松取整(采购订单行号列是文本:"3"/"3.0" 都能取;非数字返回 null) */
    private static Integer intOf(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) return null;
        try {
            return (int) Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 数值 → 干净的十进制字符串(去尾零、不用科学计数):pur_order 接口的 qty/price/cess 按字符串收 */
    private static String plainDecimal(double d) {
        if (d == 0) return "0";
        return java.math.BigDecimal.valueOf(d).stripTrailingZeros().toPlainString();
    }

    /**
     * 行取值:本服务的行来自 `SELECT * FROM bl_xxx`,键是**物理列名**(不是面板标签)。
     * 采购订单行号在库里的列名是 源单行号(面板标签为「采购订单行号」,见 migrate-po-chain-link.sql),
     * 故按列名优先、标签兜底取值 —— 2026-09-20 沙箱实测踩坑:只按标签取会恒 null,
     * src_seq 静默丢失(日志出现"该行不带 src_seq")。
     */
    private static Object lineColumn(Map<String, Object> line, String... names) {
        for (String n : names) {
            Object v = line.get(n);
            if (v != null && !String.valueOf(v).isBlank()) return v;
        }
        return null;
    }

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

    private static final String MATERIAL_LIST_PATH = "/jdy/v2/bd/material";
    /** 商品档案分页上限(真实账套约数千商品,200/页 → 30 页足够;超出仅告警不阻塞) */
    private static final int MATERIAL_MAX_PAGES = 30;
    private Map<String, String> materialIdByNumber;
    private long materialCacheAt;

    /**
     * 当前账套的 存货编码→金蝶商品ID 缓存(22h)。
     * 为什么必须传 material_id:采购入库**挂来源单**时金蝶按 material_id 与源单分录比对,
     * 只传 material_number 会被判 `materialid_id：null 跟源单的数据不一致`(2026-09-20 沙箱实测);
     * 商品ID同样按账套各不同(与单位ID 同理),故按当前凭证实时拉取,测试/真实套切换零改动。
     * 列表接口不支持 number 精确过滤(实测传 number 返回的仍是首页),故整册分页拉取后建索引。
     */
    private synchronized Map<String, String> materialMap() throws Exception {
        ensureCreds();
        if (materialIdByNumber != null && System.currentTimeMillis() - materialCacheAt < 22 * 3600_000L) return materialIdByNumber;
        Map<String, String> m = new HashMap<>();
        int page = 0;
        for (; page < MATERIAL_MAX_PAGES; page++) {
            JsonNode rows = kingdeeGet(MATERIAL_LIST_PATH,
                    Map.of("page", String.valueOf(page + 1), "page_size", "200")).path("rows");
            int n = 0;
            if (rows.isArray()) {
                for (JsonNode r : rows) {
                    String no = r.path("number").asText("");
                    if (!no.isBlank()) m.put(no, r.path("id").asText(""));
                    n++;
                }
            }
            if (n < 200) break;
        }
        if (m.isEmpty()) throw new RuntimeException("金蝶商品档案为空(账套无商品?)");
        materialIdByNumber = m;
        materialCacheAt = System.currentTimeMillis();
        log.info("金蝶商品档案已加载({}个,{}页,按当前账套,缓存22h)", m.size(), page + 1);
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
