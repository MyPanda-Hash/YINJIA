package com.yinjia.mes.ocr;

/** OCR 网关调用失败(移植自 light-mes)。 */
public class OcrGatewayException extends Exception {

    public OcrGatewayException(String message) {
        super(message);
    }

    public OcrGatewayException(String message, Throwable cause) {
        super(message, cause);
    }
}
