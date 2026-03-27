import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import {
  ClassEntity,
  ClassDocument,
} from '../src/classes/schemas/class.schema';
import { UserRole } from '../src/common/enums/role.enum';
import { UserStatus } from '../src/common/enums/user-status.enum';

describe('Sessions & Attendance API (e2e)', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let teacherId: string;
  let studentId: string;
  let classId: string;
  let secondClassId: string;
  let sessionId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    process.env.MONGODB_URI = uri;
    process.env.JWT_SECRET = 'test-secret';
    process.env.REFRESH_JWT_SECRET = 'test-refresh';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.REFRESH_EXPIRES_IN = '7d';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Seed test users
    const userModel = app.get<typeof mongoose.Model<UserDocument>>(
      getModelToken(User.name),
    );
    const classModel = app.get<typeof mongoose.Model<ClassDocument>>(
      getModelToken(ClassEntity.name),
    );

    const password = 'Test123!';
    const users = await userModel.create([
      {
        name: 'Admin User',
        email: 'admin@sessions-test.com',
        passwordHash: await bcrypt.hash(password, 10),
        role: UserRole.Admin,
        status: UserStatus.Active,
      },
      {
        name: 'Teacher User',
        email: 'teacher@sessions-test.com',
        passwordHash: await bcrypt.hash(password, 10),
        role: UserRole.Teacher,
        status: UserStatus.Active,
      },
      {
        name: 'Student User',
        email: 'student@sessions-test.com',
        passwordHash: await bcrypt.hash(password, 10),
        role: UserRole.Student,
        status: UserStatus.Active,
      },
      {
        name: 'Teacher 2 User',
        email: 'teacher2@sessions-test.com',
        passwordHash: await bcrypt.hash(password, 10),
        role: UserRole.Teacher,
        status: UserStatus.Active,
      },
    ]);

    teacherId = users[1]._id.toString();
    studentId = users[2]._id.toString();

    // Create a class
    const classDoc = await classModel.create({
      name: 'Test Class',
      subject: 'Math',
      teacherId: users[1]._id,
      studentIds: [users[2]._id],
    });
    classId = classDoc._id.toString();

    const secondClassDoc = await classModel.create({
      name: 'Conflict Class',
      subject: 'Physics',
      teacherId: users[3]._id,
      studentIds: [users[2]._id],
    });
    secondClassId = secondClassDoc._id.toString();

    // Login and get tokens
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@sessions-test.com', password: 'Test123!' });
    adminToken = adminLogin.body.accessToken;

    const teacherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'teacher@sessions-test.com', password: 'Test123!' });
    teacherToken = teacherLogin.body.accessToken;

    const studentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'student@sessions-test.com', password: 'Test123!' });
    studentToken = studentLogin.body.accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
  });

  describe('Sessions', () => {
    describe('POST /sessions', () => {
      it('should create a session as teacher', async () => {
        const now = new Date();
        const startTime = new Date(now.getTime() + 86400000).toISOString(); // Tomorrow
        const endTime = new Date(
          now.getTime() + 86400000 + 5400000,
        ).toISOString(); // +1.5 hours

        const res = await request(app.getHttpServer())
          .post('/sessions')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            classId: classId,
            startTime: startTime,
            endTime: endTime,
            type: 'regular',
            note: 'Buổi học số 1',
          })
          .expect(201);

        expect(res.body.classId).toBe(classId);
        expect(res.body.status).toBe('pending');
        sessionId = res.body._id;
      });

      it('should create session as admin', async () => {
        const now = new Date();
        const startTime = new Date(now.getTime() + 172800000).toISOString(); // Day after tomorrow
        const endTime = new Date(
          now.getTime() + 172800000 + 5400000,
        ).toISOString();

        const res = await request(app.getHttpServer())
          .post('/sessions')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            classId: classId,
            startTime: startTime,
            endTime: endTime,
            type: 'exam',
            note: 'Buổi kiểm tra',
          })
          .expect(201);

        expect(res.body.type).toBe('exam');
      });

      it('should reject session creation for students', async () => {
        const now = new Date();
        const startTime = new Date(now.getTime() + 259200000).toISOString();
        const endTime = new Date(
          now.getTime() + 259200000 + 5400000,
        ).toISOString();

        await request(app.getHttpServer())
          .post('/sessions')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            classId: classId,
            startTime: startTime,
            endTime: endTime,
          })
          .expect(403);
      });
    });

    describe('GET /sessions', () => {
      it('should list sessions', async () => {
        const res = await request(app.getHttpServer())
          .get('/sessions')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
      });

      it('should list sessions with classId filter', async () => {
        const res = await request(app.getHttpServer())
          .get(`/sessions?classId=${classId}`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        res.body.forEach((s: any) => {
          expect(s.classId).toBe(classId);
        });
      });
    });

    // Note: GET /sessions/:id endpoint doesn't exist in the controller
    describe('PATCH /sessions/:id', () => {
      it('should update session as admin', async () => {
        // First create a session
        const now = new Date();
        const startTime = new Date(now.getTime() + 400000000).toISOString();
        const endTime = new Date(
          now.getTime() + 400000000 + 5400000,
        ).toISOString();

        const createRes = await request(app.getHttpServer())
          .post('/sessions')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            classId: classId,
            startTime: startTime,
            endTime: endTime,
            type: 'regular',
          })
          .expect(201);

        const res = await request(app.getHttpServer())
          .patch(`/sessions/${createRes.body._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            note: 'Updated note',
            status: 'approved',
          })
          .expect(200);

        expect(res.body.note).toBe('Updated note');
        expect(res.body.status).toBe('approved');
      });
    });

    describe('POST /sessions/:id/cancel-and-makeup', () => {
      it('should block in strict mode when students conflict', async () => {
        const now = new Date();
        const originalStart = new Date(now.getTime() + 500000000);
        const originalEnd = new Date(originalStart.getTime() + 5400000);
        const conflictStart = new Date(now.getTime() + 560000000);
        const conflictEnd = new Date(conflictStart.getTime() + 5400000);

        const originalSession = await request(app.getHttpServer())
          .post('/sessions')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            classId,
            startTime: originalStart.toISOString(),
            endTime: originalEnd.toISOString(),
            type: 'regular',
          })
          .expect(201);

        await request(app.getHttpServer())
          .post('/sessions')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            classId: secondClassId,
            startTime: conflictStart.toISOString(),
            endTime: conflictEnd.toISOString(),
            type: 'regular',
          })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/sessions/${originalSession.body._id}/cancel-and-makeup`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            reason: 'Teacher absent',
            makeupStartTime: conflictStart.toISOString(),
            makeupEndTime: conflictEnd.toISOString(),
            policy: 'block_all',
          })
          .expect(400);
      });

      it('should allow create with manual resolution policy', async () => {
        const now = new Date();
        const originalStart = new Date(now.getTime() + 700000000);
        const originalEnd = new Date(originalStart.getTime() + 5400000);
        const conflictStart = new Date(now.getTime() + 760000000);
        const conflictEnd = new Date(conflictStart.getTime() + 5400000);

        const originalSession = await request(app.getHttpServer())
          .post('/sessions')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            classId,
            startTime: originalStart.toISOString(),
            endTime: originalEnd.toISOString(),
            type: 'regular',
          })
          .expect(201);

        await request(app.getHttpServer())
          .post('/sessions')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            classId: secondClassId,
            startTime: conflictStart.toISOString(),
            endTime: conflictEnd.toISOString(),
            type: 'regular',
          })
          .expect(201);

        const res = await request(app.getHttpServer())
          .post(`/sessions/${originalSession.body._id}/cancel-and-makeup`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            reason: 'Holiday reschedule',
            makeupStartTime: conflictStart.toISOString(),
            makeupEndTime: conflictEnd.toISOString(),
            policy: 'allow_with_manual_resolution',
          })
          .expect(201);

        expect(res.body.previewOnly).toBe(false);
        expect(res.body.report.policyDecision.requiresManualResolution).toBe(
          true,
        );

        const originalAfter = await request(app.getHttpServer())
          .get(`/sessions/${originalSession.body._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(originalAfter.body.status).toBe('cancelled');
      });
    });
  });

  describe('Attendance', () => {
    describe('POST /attendance', () => {
      it('should mark attendance as teacher', async () => {
        const res = await request(app.getHttpServer())
          .post('/attendance')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            sessionId: sessionId,
            studentId: studentId,
            status: 'present',
          })
          .expect(201);

        expect(res.body.sessionId).toBe(sessionId);
        expect(res.body.studentId).toBe(studentId);
        expect(res.body.status).toBe('present');
      });

      it('should mark late attendance', async () => {
        const userModel = app.get<typeof mongoose.Model<UserDocument>>(
          getModelToken(User.name),
        );
        const newStudent = await userModel.create({
          name: 'Another Student',
          email: 'another@sessions-test.com',
          passwordHash: await bcrypt.hash('Test123!', 10),
          role: UserRole.Student,
          status: UserStatus.Active,
        });

        const res = await request(app.getHttpServer())
          .post('/attendance')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            sessionId: sessionId,
            studentId: newStudent._id.toString(),
            status: 'late',
            note: 'Đến muộn 10 phút',
          })
          .expect(201);

        expect(res.body.status).toBe('late');
        expect(res.body.note).toBe('Đến muộn 10 phút');
      });

      it('should reject attendance marking by students', async () => {
        await request(app.getHttpServer())
          .post('/attendance')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            sessionId: sessionId,
            studentId: studentId,
            status: 'present',
          })
          .expect(403);
      });
    });

    describe('GET /attendance', () => {
      it('should list attendance by session', async () => {
        const res = await request(app.getHttpServer())
          .get(`/attendance?sessionId=${sessionId}`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        res.body.forEach((a: any) => {
          expect(a.sessionId).toBe(sessionId);
        });
      });

      it('should list attendance by student', async () => {
        const res = await request(app.getHttpServer())
          .get(`/attendance?studentId=${studentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        res.body.forEach((a: any) => {
          expect(a.studentId).toBe(studentId);
        });
      });
    });

    describe('PATCH /attendance/:id', () => {
      it('should update attendance status', async () => {
        // First get attendance record
        const listRes = await request(app.getHttpServer())
          .get(`/attendance?sessionId=${sessionId}&studentId=${studentId}`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(200);

        if (listRes.body.length > 0) {
          const attendanceId = listRes.body[0]._id;
          const res = await request(app.getHttpServer())
            .patch(`/attendance/${attendanceId}`)
            .set('Authorization', `Bearer ${teacherToken}`)
            .send({
              status: 'absent',
              note: 'Vắng không phép',
            })
            .expect(200);

          expect(res.body.status).toBe('absent');
        }
      });
    });
  });
});
