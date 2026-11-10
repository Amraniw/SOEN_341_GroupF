const express = require('express');
const { createAuthenticateUser } = require('../middleware/authenticateUser');
const { requireSameOrigin } = require('../middleware/requireSameOrigin');
const { publicNotification } = require('../domain/notifications');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const COLUMNS = 'id, type, title, message, link, created_at, read_at';

function readListQuery(query) {
  if (Object.keys(query).some((key) => !['limit', 'unread'].includes(key))) {
    return { error: 'Unsupported notification parameter.' };
  }
  let limit = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    if (typeof query.limit !== 'string' || !/^[1-9]\d{0,2}$/.test(query.limit) || Number(query.limit) > MAX_LIMIT) {
      return { error: `limit must be a whole number from 1 to ${MAX_LIMIT}.` };
    }
    limit = Number(query.limit);
  }
  if (query.unread !== undefined && query.unread !== 'true') {
    return { error: 'unread must be true when provided.' };
  }
  return { limit, unreadOnly: query.unread === 'true' };
}

function createNotificationRouter(database) {
  const router = express.Router();
  const authenticateUser = createAuthenticateUser(database);

  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  router.use(authenticateUser, requireSameOrigin);

  async function unreadCount(userId) {
    const row = await database.get(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL',
      userId
    );
    return row.count;
  }

  function rejectFields(request, response) {
    if (request.body && Object.keys(request.body).length) {
      response.status(400).json({ error: 'This request does not accept any fields.' });
      return true;
    }
    return false;
  }

  router.get('/', async (request, response, next) => {
    const { limit, unreadOnly, error } = readListQuery(request.query);
    if (error) return response.status(400).json({ error });

    try {
      const userId = request.authenticatedUser.id;
      const rows = await database.all(
        `SELECT ${COLUMNS} FROM notifications
         WHERE user_id = ? ${unreadOnly ? 'AND read_at IS NULL' : ''}
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT ?`,
        userId,
        limit
      );
      const counts = await database.get(
        `SELECT COUNT(*) AS total, COALESCE(SUM(read_at IS NULL), 0) AS unread
         FROM notifications WHERE user_id = ?`,
        userId
      );
      return response.json({
        items: rows.map(publicNotification),
        total: counts.total,
        unreadCount: counts.unread,
      });
    } catch (caught) {
      return next(caught);
    }
  });

  router.get('/unread-count', async (request, response, next) => {
    try {
      return response.json({ unreadCount: await unreadCount(request.authenticatedUser.id) });
    } catch (caught) {
      return next(caught);
    }
  });

  router.post('/read-all', async (request, response, next) => {
    if (rejectFields(request, response)) return undefined;
    try {
      const userId = request.authenticatedUser.id;
      const result = await database.run(
        'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL',
        userId
      );
      return response.json({ updated: result.changes, unreadCount: await unreadCount(userId) });
    } catch (caught) {
      return next(caught);
    }
  });

  router.patch('/:id/read', async (request, response, next) => {
    if (!/^[1-9]\d*$/.test(request.params.id) || !Number.isSafeInteger(Number(request.params.id))) {
      return response.status(400).json({ error: 'Choose a valid notification.' });
    }
    if (rejectFields(request, response)) return undefined;

    try {
      const userId = request.authenticatedUser.id;
      const id = Number(request.params.id);
      const result = await database.run(
        'UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND user_id = ?',
        id,
        userId
      );
      if (!result.changes) {
        return response.status(404).json({ error: 'This notification could not be found.' });
      }
      const row = await database.get(
        `SELECT ${COLUMNS} FROM notifications WHERE id = ? AND user_id = ?`,
        id,
        userId
      );
      return response.json({ notification: publicNotification(row), unreadCount: await unreadCount(userId) });
    } catch (caught) {
      return next(caught);
    }
  });

  return router;
}

module.exports = { createNotificationRouter };
