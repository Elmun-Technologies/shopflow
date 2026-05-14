import { SetMetadata, createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "roles";
export const Roles = (...roles: Array<"OWNER" | "MANAGER" | "OPERATOR" | "READONLY">) =>
  SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  sub: string;
  tenantId: string;
  role: "OWNER" | "MANAGER" | "OPERATOR" | "READONLY";
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | null => {
  const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthUser }>();
  return req.auth ?? null;
});

export const TenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string | null => {
  const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthUser }>();
  return req.auth?.tenantId ?? null;
});
