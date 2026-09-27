function createAuthenticateUser(database) {
  return async function authenticateUser(request, response, next) {
    try {
      const userId = request.session?.userId;

      if (!Number.isInteger(userId)) {
        return response.status(401).json({ error: 'Authentication required.' });
      }

      const user = await database.get(
        'SELECT id, name, email FROM users WHERE id = ?',
        userId
      );

      if (!user) {
        request.session = null;
        return response.status(401).json({ error: 'Authentication required.' });
      }

      request.authenticatedUser = user;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createAuthenticateUser };
