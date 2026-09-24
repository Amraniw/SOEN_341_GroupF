const express = require('express');
const bcrypt = require('bcrypt');

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validateEmail(email) {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Password is required.';
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  if (Buffer.byteLength(password, 'utf8') > 72) {
    return 'Password must be 72 bytes or fewer.';
  }

  return null;
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  };
}

function createAuthRouter(database) {
  const router = express.Router();

  router.post('/register', async (request, response, next) => {
    try {
      const body = request.body || {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = normalizeEmail(body.email);
      const { password } = body;

      if (!name) {
        return response.status(400).json({ error: 'Name is required.' });
      }

      if (name.length > 100) {
        return response.status(400).json({ error: 'Name must be 100 characters or fewer.' });
      }

      if (!email) {
        return response.status(400).json({ error: 'Email is required.' });
      }

      if (!validateEmail(email)) {
        return response.status(400).json({ error: 'Please provide a valid email address.' });
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        return response.status(400).json({ error: passwordError });
      }

      const existingUser = await database.get(
        'SELECT id FROM users WHERE email = ?',
        email
      );

      if (existingUser) {
        return response.status(409).json({ error: 'An account with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      let result;
      try {
        result = await database.run(
          'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
          name,
          email,
          passwordHash
        );
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          return response.status(409).json({ error: 'An account with this email already exists.' });
        }
        throw error;
      }

      const newUser = await database.get(
        'SELECT id, name, email, created_at FROM users WHERE id = ?',
        result.lastID
      );

      return response.status(201).json({
        message: 'Registration successful.',
        user: toPublicUser(newUser),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/login', async (request, response, next) => {
    try {
      const body = request.body || {};
      const email = normalizeEmail(body.email);
      const { password } = body;

      if (!email) {
        return response.status(400).json({ error: 'Email is required.' });
      }

      if (!validateEmail(email)) {
        return response.status(400).json({ error: 'Please provide a valid email address.' });
      }

      if (typeof password !== 'string' || password.length === 0) {
        return response.status(400).json({ error: 'Password is required.' });
      }

      const user = await database.get(
        'SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?',
        email
      );

      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return response.status(401).json({ error: 'Invalid email or password.' });
      }

      request.session = { userId: user.id };

      return response.status(200).json({
        message: 'Login successful.',
        user: toPublicUser(user),
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
