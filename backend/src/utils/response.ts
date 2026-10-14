import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface ApiMeta {
  request_id?: string;
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
  [key: string]: any;
}

export function successResponse(res: Response, data: any, meta: ApiMeta = {}, statusCode = 200) {
  const requestId = res.locals.requestId || `req_${uuidv4().substring(0, 8)}`;
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
    meta: {
      request_id: requestId,
      ...meta
    }
  });
}

export function errorResponse(res: Response, code: string, message: string, details: any = null, statusCode = 400) {
  const requestId = res.locals.requestId || `req_${uuidv4().substring(0, 8)}`;
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message,
      details
    },
    meta: {
      request_id: requestId
    }
  });
}
