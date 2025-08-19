import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      Array<'ASSOCIATE' | 'MANAGER'>
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: 'ASSOCIATE' | 'MANAGER' };

    return !!user && required.includes(user.role!);
  }
}
