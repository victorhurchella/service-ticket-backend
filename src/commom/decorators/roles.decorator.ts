import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Array<'ASSOCIATE' | 'MANAGER'>) =>
  SetMetadata(ROLES_KEY, roles);
