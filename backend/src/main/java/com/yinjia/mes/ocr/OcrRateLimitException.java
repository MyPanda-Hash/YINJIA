package com.yinjia.mes.ocr;

/** OCR 限流(移植自 light-mes,映射业务码 429)。 */
public class OcrRateLimitException extends RuntimeException {

    public OcrRateLimitException(String message) {
        super(message);
    }
}
