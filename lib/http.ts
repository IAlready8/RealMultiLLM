import { NextResponse } from 'next/server'

type ErrorCode =
  | 'unauthorized'
  | 'bad_request'
  | 'too_many_requests'
  | 'internal_error'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init)
}

export function jsonError(code: ErrorCode, message: string, details?: any, status = 400) {
  return NextResponse.json({ success: false, error: { code, message, details } }, { status })
}

export const unauthorized = (message = 'Unauthorized', details?: any) =>
  jsonError('unauthorized', message, details, 401)

export const badRequest = (message = 'Bad Request', details?: any) =>
  jsonError('bad_request', message, details, 400)

export const tooManyRequests = (message = 'Rate limit exceeded', details?: any) =>
  jsonError('too_many_requests', message, details, 429)

export const internalError = (message = 'Internal Server Error', details?: any) =>
  jsonError('internal_error', message, details, 500)

type RetryableFetchOptions = RequestInit & {
  retries?: number
  retryDelayMs?: number
}

function isRetryableStatus(status: number): boolean {
  return [408, 425, 429, 500, 502, 503, 504].includes(status)
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export async function fetchWithRetry(input: string | URL, init: RetryableFetchOptions = {}): Promise<Response> {
  const { retries = 2, retryDelayMs = 250, ...requestInit } = init
  let attempt = 0
  let lastError: unknown

  while (attempt <= retries) {
    try {
      const response = await fetch(input, requestInit)
      if (!response.ok && attempt < retries && isRetryableStatus(response.status)) {
        await delay(retryDelayMs * Math.max(1, attempt + 1))
        attempt += 1
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt >= retries) {
        break
      }
      await delay(retryDelayMs * Math.max(1, attempt + 1))
      attempt += 1
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }

  throw new Error('fetchWithRetry failed without providing an error instance')
}
