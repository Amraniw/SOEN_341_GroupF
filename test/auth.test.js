const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const bcrypt = require('bcrypt');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');

const validUser = {
  name: 'Taylor Student',
  email: 'taylor@example.com',
  password: 'DemoPass123',
};

describe('Feature 1: User registration and login', () => {
  let app;
  let database;

  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database);
  });

  beforeEach(async () => {
    await database.run('DELETE FROM users');
  });

  after(async () => {
    await database.close();
  });

  test('1. valid user registration succeeds', async () => {
    const response = await request(app).post('/api/register').send(validUser);

    assert.equal(response.status, 201);
    assert.equal(response.body.message, 'Registration successful.');
    assert.equal(response.body.user.name, validUser.name);
    assert.equal(response.body.user.email, validUser.email);
  });

  test('2. a registered user is stored in SQLite', async () => {
    await request(app).post('/api/register').send(validUser).expect(201);

    const storedUser = await database.get(
      'SELECT name, email FROM users WHERE email = ?',
      validUser.email
    );

    assert.deepEqual(storedUser, {
      name: validUser.name,
      email: validUser.email,
    });
  });

  test('3. duplicate email registration fails, regardless of letter case', async () => {
    await request(app).post('/api/register').send(validUser).expect(201);

    const response = await request(app)
      .post('/api/register')
      .send({ ...validUser, email: 'TAYLOR@EXAMPLE.COM' });

    assert.equal(response.status, 409);
    assert.equal(response.body.error, 'An account with this email already exists.');
  });

  test('4. missing required registration fields fail', async () => {
    const requests = [
      undefined,
      { email: validUser.email, password: validUser.password },
      { name: validUser.name, password: validUser.password },
      { name: validUser.name, email: validUser.email },
    ];

    for (const body of requests) {
      const pendingRequest = request(app).post('/api/register');
      const response = body === undefined ? await pendingRequest : await pendingRequest.send(body);
      assert.equal(response.status, 400);
    }
  });

  test('5. invalid registration email fails', async () => {
    const response = await request(app)
      .post('/api/register')
      .send({ ...validUser, email: 'not-an-email' });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Please provide a valid email address.');
  });

  test('6. password is stored as a bcrypt hash, never as plaintext', async () => {
    await request(app).post('/api/register').send(validUser).expect(201);

    const storedUser = await database.get(
      'SELECT password_hash FROM users WHERE email = ?',
      validUser.email
    );

    assert.notEqual(storedUser.password_hash, validUser.password);
    assert.match(storedUser.password_hash, /^\$2[aby]\$/);
    assert.equal(await bcrypt.compare(validUser.password, storedUser.password_hash), true);
  });

  test('7. correct email and password login succeeds', async () => {
    await request(app).post('/api/register').send(validUser).expect(201);

    const response = await request(app).post('/api/login').send({
      email: validUser.email,
      password: validUser.password,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.message, 'Login successful.');
    assert.equal(response.body.user.email, validUser.email);
  });

  test('8. wrong password login fails', async () => {
    await request(app).post('/api/register').send(validUser).expect(201);

    const response = await request(app).post('/api/login').send({
      email: validUser.email,
      password: 'WrongPassword123',
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Invalid email or password.');
  });

  test('9. nonexistent email login fails', async () => {
    const response = await request(app).post('/api/login').send({
      email: 'missing@example.com',
      password: validUser.password,
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Invalid email or password.');
  });

  test('10. API responses never expose passwords or password hashes', async () => {
    const registrationResponse = await request(app)
      .post('/api/register')
      .send(validUser)
      .expect(201);

    const loginResponse = await request(app)
      .post('/api/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);

    for (const response of [registrationResponse, loginResponse]) {
      assert.equal(response.body.user.password, undefined);
      assert.equal(response.body.user.password_hash, undefined);
      assert.equal(JSON.stringify(response.body).includes(validUser.password), false);
    }
  });
});
