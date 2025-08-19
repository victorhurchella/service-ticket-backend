import type { INestApplication } from '@nestjs/common';
import nock from 'nock';
import request from 'supertest';

import { makeApp } from '../utils';
import { login } from '../utils/api/auth.util';

describe('E2E - AI Module', () => {
  describe('Heuristic fallback (without OPENAI_API_KEY)', () => {
    let app: INestApplication;
    let associate: { access_token: string };

    beforeAll(async () => {
      delete process.env.OPENAI_API_KEY;
      app = await makeApp();

      const auth = await login(app, 'associate@example.com', 'Password123!');
      associate = { access_token: auth.access_token };
    });

    afterAll(async () => {
      await app.close();

      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should returns valid severity from heuristic (source=HEURISTIC)', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/severity-suggestion')
        .set('Authorization', `Bearer ${associate.access_token}`)
        .send({
          title: 'Checkout failing in production',
          description: 'Customers see HTTP 500 when paying with credit card',
        })
        .expect(201);

      expect(['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'EASY']).toContain(
        res.body.severity,
      );
      expect(res.body.source).toBe('HEURISTIC');
      expect(res.body.model).toBeNull();
    });
  });

  describe('OpenAI provider (mocked with nock)', () => {
    let app: INestApplication;
    let associate: { access_token: string };

    const OPENAI_HOST = 'https://api.openai.com';
    const OPENAI_PATH = '/v1/chat/completions';

    beforeAll(async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      process.env.OPENAI_BASE_URL = `${OPENAI_HOST}${OPENAI_PATH}`;

      nock.disableNetConnect();
      nock.enableNetConnect('127.0.0.1');

      nock(OPENAI_HOST)
        .post(OPENAI_PATH)
        .reply(200, { choices: [{ message: { content: 'HIGH' } }] });

      app = await makeApp();
      const auth = await login(app, 'associate@example.com', 'Password123!');
      associate = { access_token: auth.access_token };
    });

    afterEach(() => {
      if (!nock.isDone()) {
        nock.cleanAll();
      }
    });

    afterAll(async () => {
      await app.close();
      nock.enableNetConnect();
    });

    it('should uses LLM when key is set (source=LLM) and maps response to enum', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/severity-suggestion')
        .set('Authorization', `Bearer ${associate.access_token}`)
        .send({
          title: 'Ticket title',
          description: 'Ticket description',
        })
        .expect(201);

      expect(res.body.source).toBe('LLM');
      expect(res.body.model).toBeTruthy();
      expect(res.body.severity).toBe('HIGH');
    });

    it('should can map different LLM outputs (VERY_HIGH)', async () => {
      nock(OPENAI_HOST)
        .post(OPENAI_PATH, body => {
          expect(body.model).toBe(process.env.OPENAI_MODEL);
          expect(body.messages?.[0]?.role).toBe('system');
          return true;
        })
        .reply(200, {
          choices: [{ message: { content: 'VERY_HIGH' } }],
        });

      const res = await request(app.getHttpServer())
        .post('/ai/severity-suggestion')
        .set('Authorization', `Bearer ${associate.access_token}`)
        .send({
          title: 'Major incident',
          description: 'Production is down for all customers',
        })
        .expect(201);

      expect(res.body.source).toBe('LLM');
      expect(res.body.severity).toBe('VERY_HIGH');
    });

    it('should falls back to heuristic if OpenAI errors', async () => {
      nock(OPENAI_HOST)
        .post(OPENAI_PATH, body => {
          expect(body.model).toBe(process.env.OPENAI_MODEL);
          expect(body.messages?.[0]?.role).toBe('system');
          return true;
        })
        .reply(500, { error: 'boom' });

      const res = await request(app.getHttpServer())
        .post('/ai/severity-suggestion')
        .set('Authorization', `Bearer ${associate.access_token}`)
        .send({
          title: 'Auth failures',
          description:
            'Users cannot login; payment is also failing intermittently',
        })
        .expect(201);

      expect(res.body.source).toBe('HEURISTIC');
      expect(['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'EASY']).toContain(
        res.body.severity,
      );
    });
  });
});
