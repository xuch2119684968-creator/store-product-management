import type { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
      } & JwtPayload;
    }
  }
}

export {};
