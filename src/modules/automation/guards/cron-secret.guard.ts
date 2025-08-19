import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const header = (req.headers['x-cron-secret'] ||
      req.headers['X-Cron-Secret']) as string | null;

    const auth = req.headers.authorization as string | null;

    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new UnauthorizedException('CRON_SECRET not configured');
    }

    const bearer = auth?.startsWith('Bearer ')
      ? auth.slice('Bearer '.length)
      : null;

    if (header === secret || bearer === secret) return true;

    throw new UnauthorizedException('Invalid cron secret');
  }
}
