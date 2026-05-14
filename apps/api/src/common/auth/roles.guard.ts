import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ROLES_KEY, type AuthUser } from "./auth.decorators.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Array<AuthUser["role"]>>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthUser }>();
    if (!req.auth) return false;
    if (!required.includes(req.auth.role)) {
      throw new ForbiddenException(`Role ${req.auth.role} is not permitted for this action`);
    }
    return true;
  }
}
