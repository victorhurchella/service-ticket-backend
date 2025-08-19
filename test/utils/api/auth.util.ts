import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function login(
  app: INestApplication,
  email: string,
  password: string,
) {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  return res.body as {
    access_token: string;
    user: { id: string; email: string; role: string };
  };
}
