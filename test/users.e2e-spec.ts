// test/users.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    prisma = app.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/users (POST)', () => {
    it('should create a user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'e2e-test@example.com',
          name: 'E2E Test User',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.email).toBe('e2e-test@example.com');
        });
    });

    it('should fail with invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'invalid-email',
          name: 'Test',
        })
        .expect(400);
    });
  });
});
