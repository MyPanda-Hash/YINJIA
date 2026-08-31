package com.yinjia.mes.ocr;

/** OCR 服务级失败(移植自 light-mes,映射业务码 503)。 */
public class OcrServiceException extends RuntimeException {

    public OcrServiceException(String message) {
        super(message);
    }

    public OcrServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
