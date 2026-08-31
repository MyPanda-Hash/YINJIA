package com.yinjia.mes.ocr;

import java.util.List;
import java.util.Map;

/** 扫描填单结果(移植自 light-mes):白名单字段供用户确认后填入。 */
public record OcrScanResponse(
        String requestId,
        Map<String, Object> header,
        Map<String, List<Map<String, Object>>> detail,
        List<Map<String, Object>> matches,
        List<String> warnings) {
}
