import { TextEncoder } from "util";

export const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
export const REFRESH_TOKEN_SECRET = new TextEncoder().encode(process.env.REFRESH_TOKEN_SECRET!);