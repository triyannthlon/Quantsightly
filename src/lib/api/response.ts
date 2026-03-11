import { NextResponse } from "next/server";

export type ApiSuccess<T = undefined> = { success: true; data?: T; };

export type ApiError = { success: false; error: string; };

export type ApiResponse<T = undefined> = ApiSuccess<T> | ApiError;

/************** jsonSuccess *****/
export function jsonSuccess<T = undefined>(data?: T, init?: ResponseInit)
                {//jsonSuccess

                return NextResponse.json<ApiResponse<T>>({ success: true, data }, init);

                }//jsonSuccess


/************** jsonError *****/
export function jsonError(error: string, status = 400, init?: ResponseInit)
                {//jsonError

                return NextResponse.json<ApiResponse>({ success: false, error }, { status, ...init });

                }//jsonError
