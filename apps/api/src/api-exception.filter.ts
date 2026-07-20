import { API_HEADERS, apiErrorSchema, type ApiError } from "@merchant/contracts";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

type HttpResponse = {
  json(body: ApiError): unknown;
  setHeader(name: string, value: string): void;
  status(statusCode: number): HttpResponse;
};

type HttpRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getRequestId(request: HttpRequest) {
  const header = request.headers?.[API_HEADERS.requestId];
  return typeof header === "string" && header.trim().length > 0
    ? header.slice(0, 100)
    : `req_${crypto.randomUUID()}`;
}

export function mapExceptionToApiError(exception: unknown, requestId: string) {
  const statusCode =
    exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
  const response = exception instanceof HttpException ? exception.getResponse() : undefined;
  const responseRecord = isRecord(response) ? response : undefined;
  const responseCode = responseRecord?.code;
  const responseMessage = responseRecord?.message;
  const responseDetails = responseRecord?.details;
  const code =
    typeof responseCode === "string" && /^[A-Z][A-Z0-9_.-]*$/.test(responseCode)
      ? responseCode
      : `HTTP_${statusCode}`;
  const message =
    statusCode >= 500
      ? "Terjadi kesalahan internal."
      : typeof response === "string"
        ? response
        : typeof responseMessage === "string"
          ? responseMessage
          : "Request tidak dapat diproses.";
  const body = apiErrorSchema.parse({
    code,
    message,
    requestId,
    ...(isRecord(responseDetails) ? { details: responseDetails } : {}),
  });

  return { body, statusCode };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequest>();
    const response = context.getResponse<HttpResponse>();
    const requestId = getRequestId(request);
    const error = mapExceptionToApiError(exception, requestId);

    response.setHeader(API_HEADERS.requestId, requestId);
    response.status(error.statusCode).json(error.body);
  }
}
