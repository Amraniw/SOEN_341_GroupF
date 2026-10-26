const { createAuthenticateUser } = require('./authenticateUser');

function createAuthorizeRecruiter(database) {
  const authenticateUser = createAuthenticateUser(database);

  return function authorizeRecruiter(request, response, next) {
    return authenticateUser(request, response, () => {
      if (request.authenticatedUser.role !== 'recruiter') {
        return response.status(403).json({ error: 'Recruiter access required.' });
      }

      return next();
    });
  };
}

module.exports = { createAuthorizeRecruiter };
