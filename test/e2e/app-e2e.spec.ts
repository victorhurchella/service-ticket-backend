import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { makeApp } from '../utils';
import { login } from '../utils/api/auth.util';
import {
  autoProcessCsv,
  countByStatus,
  exportPendingCsv,
  importCsv,
  parseCsv,
} from '../utils/api/csv.util';
import { createAndApproveTickets } from '../utils/api/tickets.util';

describe('E2E - Service Ticket System', () => {
  let app: INestApplication;
  let associate: { access_token: string; user: { id: string } };
  let manager: { access_token: string; user: { id: string } };

  beforeAll(async () => {
    app = await makeApp();

    associate = await login(app, 'associate@example.com', 'Password123!');
    manager = await login(app, 'manager@example.com', 'Password123!');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Flow: Create → elevate severity → edit in REVIEW → approve ticket → PENDING', () => {
    let testData: any = {};

    it('should draft a ticket', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${associate.access_token}`)
        .send({
          title: 'User error when try login',
          description: 'Error 500 on authenticate',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          severity: 'MEDIUM',
          aiSuggestedSeverity: 'LOW',
        })
        .expect(201);

      testData = { ticket: createRes.body };
      expect(testData.ticket.status).toBe('DRAFT');
      expect(testData.ticket.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    });

    it('should elevate severity by manager', async () => {
      const reviewUp = await request(app.getHttpServer())
        .patch(`/tickets/${testData.ticket.id}/review`)
        .set('Authorization', `Bearer ${manager.access_token}`)
        .send({
          action: 'CHANGE_SEVERITY',
          newSeverity: 'HIGH',
          severityChangeReason: 'High impact in authentication flow',
        })
        .expect(200);

      expect(reviewUp.body.status).toBe('REVIEW');
      expect(reviewUp.body.severity).toBe('HIGH');
    });

    it('should back to DRAFT when associate changes ticket title in REVIEW', async () => {
      const editRes = await request(app.getHttpServer())
        .patch(`/tickets/${testData.ticket.id}`)
        .set('Authorization', `Bearer ${associate.access_token}`)
        .send({ title: 'Login fail (reproduced)' })
        .expect(200);

      expect(editRes.body.status).toBe('DRAFT');
      expect(editRes.body.title).toContain('(reproduced)');
    });

    it('should go to PENDING when manager approve', async () => {
      const approve = await request(app.getHttpServer())
        .patch(`/tickets/${testData.ticket.id}/review`)
        .set('Authorization', `Bearer ${manager.access_token}`)
        .send({ action: 'APPROVE' })
        .expect(200);

      expect(approve.body.status).toBe('PENDING');
    });

    it('should return ticket on list by PENDING type', async () => {
      const listPending = await request(app.getHttpServer())
        .get('/tickets?status=PENDING')
        .set('Authorization', `Bearer ${manager.access_token}`)
        .expect(200);

      expect(
        listPending.body.items.some(
          (ticket: any) => ticket.id === testData.ticket.id,
        ),
      ).toBe(true);
    });
  });

  describe('Rule: Managers cannot review their own tickets.', () => {
    let testData: any = {};

    it('should draft a ticket as a manager', async () => {
      const ticketResponse = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${manager.access_token}`)
        .send({
          title: 'Manager ticket test',
          description: 'Manager creator cannot review',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          severity: 'LOW',
        })
        .expect(201);

      testData = { ticket: ticketResponse.body };
    });

    it('should elevate severity by manager', async () => {
      const reviewUp = await request(app.getHttpServer())
        .patch(`/tickets/${testData.ticket.id}/review`)
        .set('Authorization', `Bearer ${manager.access_token}`)
        .send({
          action: 'CHANGE_SEVERITY',
          newSeverity: 'HIGH',
          severityChangeReason: 'High impact in authentication flow',
        })
        .expect(403);

      expect(reviewUp.body.message).toBe('Manager cannot review own ticket');
    });
  });

  describe('Rule: Allow soft delete only before PENDING status', () => {
    it('should draft and soft delete a ticket', async () => {
      const ticket = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${associate.access_token}`)
        .send({
          title: 'Apagar rascunho',
          description: 'Deve permitir soft delete',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          severity: 'EASY',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tickets/${ticket.body.id}`)
        .set('Authorization', `Bearer ${associate.access_token}`)
        .expect(200);
    });

    it('should fail when try soft delete a PENDING ticket', async () => {
      const ticket = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${associate.access_token}`)
        .send({
          title: 'Não pode apagar',
          description: 'Após PENDING não pode deletar',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          severity: 'MEDIUM',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/tickets/${ticket.body.id}/review`)
        .set('Authorization', `Bearer ${manager.access_token}`)
        .send({ action: 'APPROVE' })
        .expect(200);

      const del = await request(app.getHttpServer())
        .delete(`/tickets/${ticket.body.id}`)
        .set('Authorization', `Bearer ${associate.access_token}`)
        .expect(400);

      expect(del.body.message).toContain(
        'Cannot delete ticket with status >= PENDING',
      );
    });
  });

  describe('CSV: Export PENDING → Auto-process (endpoint) → Import (update only status)', () => {
    const ticketsToCreate = 6;
    let createdIds: string[] = [];
    let exportedCsv: string = '';
    let processedCsv: string = '';

    it('should draft and approve N tickets to PENDING', async () => {
      createdIds = await createAndApproveTickets(
        app,
        associate.access_token,
        manager.access_token,
        ticketsToCreate,
        'CSV ticket',
      );
      expect(createdIds.length).toEqual(ticketsToCreate);
    });

    it('should export PENDING as CSV', async () => {
      exportedCsv = await exportPendingCsv(app, manager.access_token);
      expect(exportedCsv).toContain('ticket_number');

      const rows = parseCsv(exportedCsv);
      const exportedIds = new Set(rows.map(r => r.id));
      const allPresent = createdIds.every(id => exportedIds.has(id));
      expect(allPresent).toBe(true);
    });

    it('should auto-process the CSV using the API', async () => {
      processedCsv = await autoProcessCsv(
        app,
        manager.access_token,
        exportedCsv,
      );

      const processedRows = parseCsv(processedCsv);
      expect(processedRows.length).toBeGreaterThanOrEqual(createdIds.length);

      const dist = countByStatus(processedRows);
      expect(dist.PENDING + dist.OPEN + dist.CLOSED).toEqual(
        processedRows.length,
      );
    });

    it('should import the processed CSV and update only status', async () => {
      const processedRows = parseCsv(processedCsv);

      const ourRows = processedRows.filter(r => createdIds.includes(r.id));
      const ourDist = countByStatus(ourRows);

      const result = await importCsv(app, manager.access_token, processedCsv);

      expect(result.totalRows).toEqual(processedRows.length);

      expect(result.updatedCount).toBeGreaterThanOrEqual(
        ourDist.OPEN + ourDist.CLOSED,
      );
      expect(result.skippedCount + result.updatedCount).toEqual(
        result.totalRows,
      );
    });

    it('should reflect the exact distribution for our N tickets after import', async () => {
      const listBy = async (status: 'PENDING' | 'OPEN' | 'CLOSED') => {
        const res = await request(app.getHttpServer())
          .get(`/tickets?status=${status}&pageSize=200`)
          .set('Authorization', `Bearer ${manager.access_token}`)
          .expect(200);
        return new Set(res.body.items.map((t: any) => t.id) as string[]);
      };

      const setPending = await listBy('PENDING');
      const setOpen = await listBy('OPEN');
      const setClosed = await listBy('CLOSED');

      const processedRows = parseCsv(processedCsv);
      const ourRows = processedRows.filter(r => createdIds.includes(r.id));
      const ourDist = countByStatus(ourRows);

      const gotPending = createdIds.filter(id => setPending.has(id)).length;
      const gotOpen = createdIds.filter(id => setOpen.has(id)).length;
      const gotClosed = createdIds.filter(id => setClosed.has(id)).length;

      expect(gotPending).toEqual(ourDist.PENDING);
      expect(gotOpen).toEqual(ourDist.OPEN);
      expect(gotClosed).toEqual(ourDist.CLOSED);
      expect(gotPending + gotOpen + gotClosed).toEqual(createdIds.length);
    });
  });

  describe('Automation: run-now (MANAGER) and nightly (CRON_SECRET)', () => {
    const N = 3;
    let createdIds: string[] = [];

    it('should draft and approve N tickets to PENDING (reused helper)', async () => {
      createdIds = await createAndApproveTickets(
        app,
        associate.access_token,
        manager.access_token,
        N,
        'Auto ticket',
      );
      expect(createdIds.length).toEqual(N);
    });

    it('should run automation by a manager request', async () => {
      const rn = await request(app.getHttpServer())
        .post('/automation/run-now')
        .set('Authorization', `Bearer ${manager.access_token}`)
        .expect(201);

      expect(rn.body).toHaveProperty('exportedCount');
      expect(rn.body).toHaveProperty('processedDistribution');
      expect(rn.body).toHaveProperty('importResult');
    });

    it('should run automation by a nightly routine (cron)', async () => {
      const ns = await request(app.getHttpServer())
        .post('/automation/nightly')
        .set('x-cron-secret', process.env.CRON_SECRET || 'e2e-cron-secret')
        .expect(201);

      expect(ns.body).toHaveProperty('exportedCount');
    });

    it('should return 401 when try run nightly routine without secret', async () => {
      await request(app.getHttpServer())
        .post('/automation/nightly')
        .expect(401);
    });
  });
});
