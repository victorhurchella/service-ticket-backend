import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function createAndApproveTickets(
  app: INestApplication,
  associateToken: string,
  managerToken: string,
  count: number,
  titlePrefix = 'Ticket',
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const create = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${associateToken}`)
      .send({
        title: `${titlePrefix} ${i + 1}`,
        description: 'Auto generated for tests',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        severity: 'LOW',
      })
      .expect(201);

    const id = create.body.id as string;

    await request(app.getHttpServer())
      .patch(`/tickets/${id}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ action: 'APPROVE' })
      .expect(200);

    ids.push(id);
  }
  return ids;
}
