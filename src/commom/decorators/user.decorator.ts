import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface ICurrentUser {
  id: string;
  role: Role;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();

    return req.user as ICurrentUser;
  },
);
