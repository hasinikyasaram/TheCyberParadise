import { NextResponse } from 'next/server';

export const UNIFORM_NOT_FOUND_MESSAGE = 'Shipment not found';

export function notFoundResponse(message: string = UNIFORM_NOT_FOUND_MESSAGE) {
  return NextResponse.json(
    {
      error: 'NOT_FOUND',
      message,
    },
    { status: 404 }
  );
}

export function unauthorizedResponse(message: string = 'Authentication required') {
  return NextResponse.json(
    {
      error: 'UNAUTHORIZED',
      message,
    },
    { status: 401 }
  );
}

export function forbiddenResponse(message: string = 'Permission denied') {
  return NextResponse.json(
    {
      error: 'FORBIDDEN',
      message,
    },
    { status: 403 }
  );
}

export function badRequestResponse(message: string, details?: unknown) {
  return NextResponse.json(
    {
      error: 'BAD_REQUEST',
      message,
      ...(details ? { details } : {}),
    },
    { status: 400 }
  );
}

export function internalErrorResponse(message: string = 'An internal error occurred') {
  return NextResponse.json(
    {
      error: 'INTERNAL_SERVER_ERROR',
      message,
    },
    { status: 500 }
  );
}
