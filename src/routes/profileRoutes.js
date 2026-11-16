const express = require('express');
const multer = require('multer');
const { requireSameOrigin } = require('../middleware/requireSameOrigin');
const { createAuthenticateUser } = require('../middleware/authenticateUser');

// The account name and email stay in users; a profile adds professional details.
const PROFILE_FIELDS = [
  { name: 'headline', label: 'Professional headline', maxLength: 120, required: true },
  { name: 'location', label: 'Location', maxLength: 100 },
  { name: 'phone', label: 'Phone number', maxLength: 30 },
  { name: 'summary', label: 'Professional summary', maxLength: 1000 },
  { name: 'skills', label: 'Skills', maxLength: 500 },
  { name: 'education', label: 'Education', maxLength: 1000 },
  { name: 'experience', label: 'Work experience', maxLength: 1500 },
  { name: 'website', label: 'Portfolio or website', maxLength: 200 },
];

const PROFILE_SELECT = `
  SELECT headline, location, phone, summary, skills, education, experience,
         website, created_at, updated_at
  FROM profiles
  WHERE user_id = ?`;

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return /^\+?[\d\s().-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15;
}

function isValidWebsite(website) {
  try {
    const url = new URL(website);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.');
  } catch {
    return false;
  }
}

function readProfile(body) {
  if (typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'The profile must be sent as a JSON object.' };
  }

  const fieldNames = PROFILE_FIELDS.map(({ name }) => name);
  if (Object.keys(body).some((key) => !fieldNames.includes(key))) {
    return { error: 'The profile contains unsupported information.' };
  }

  const profile = {};
  for (const { name, label, maxLength, required } of PROFILE_FIELDS) {
    const value = body[name] ?? '';
    if (typeof value !== 'string') {
      return { error: `${label} must be text.` };
    }

    profile[name] = value.trim();
    if (required && !profile[name]) {
      return { error: `${label} is required.` };
    }

    if (profile[name].length > maxLength) {
      return { error: `${label} must be ${maxLength} characters or fewer.` };
    }
  }

  if (profile.phone && !isValidPhone(profile.phone)) {
    return { error: 'Please provide a valid phone number.' };
  }

  if (profile.website && !isValidWebsite(profile.website)) {
    return { error: 'Please provide a website address that starts with http:// or https://.' };
  }

  return { profile };
}

function toPublicProfile(row) {
  return {
    headline: row.headline,
    location: row.location,
    phone: row.phone,
    summary: row.summary,
    skills: row.skills,
    education: row.education,
    experience: row.experience,
    website: row.website,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createProfileRouter(database) {
  const router = express.Router();
  const authenticateUser = createAuthenticateUser(database);

  router.use(authenticateUser);
  const picturesReady = () => database.exec(`CREATE TABLE IF NOT EXISTS profile_pictures (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mime TEXT NOT NULL, image BLOB NOT NULL
  )`);
  const pictureUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 } }).single('picture');
  router.get('/picture', async (req, res, next) => {
    try {
      await picturesReady();
      const row = await database.get('SELECT mime, image FROM profile_pictures WHERE user_id = ?', req.authenticatedUser.id);
      res.set('Cache-Control', 'no-store');
      if (!row) return res.sendStatus(404);
      return res.set('Content-Type', row.mime).set('X-Content-Type-Options', 'nosniff').send(row.image);
    } catch (error) { return next(error); }
  });
  router.post('/picture', (req, res, next) => {
    // A custom header prevents cross-origin simple form submissions. Browsers
    // must preflight this request, and this app grants no cross-origin access.
    if (req.get('X-Profile-Picture') !== '1') return res.status(403).json({ error: 'Use the profile photo uploader.' });
    return next();
  }, (req, res, next) => {
    pictureUpload(req, res, async (error) => {
      if (error) return res.status(400).json({ error: 'Choose one JPG or PNG image under 2 MB.' });
      const bytes = req.file?.buffer;
      const png = bytes && bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg = bytes && bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
      if (!png && !jpeg) return res.status(400).json({ error: 'Choose a valid JPG or PNG image under 2 MB.' });
      try {
        await picturesReady();
        await database.run('INSERT INTO profile_pictures (user_id, mime, image) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET mime = excluded.mime, image = excluded.image', req.authenticatedUser.id, png ? 'image/png' : 'image/jpeg', bytes);
        return res.json({ message: 'Profile picture saved.' });
      } catch (caught) { return next(caught); }
    });
  });
  router.delete('/picture', requireSameOrigin, async (req, res, next) => {
    try { await picturesReady(); await database.run('DELETE FROM profile_pictures WHERE user_id = ?', req.authenticatedUser.id); return res.json({ message: 'Profile picture removed.' }); }
    catch (error) { return next(error); }
  });

  router.get('/', async (request, response, next) => {
    try {
      const profile = await database.get(PROFILE_SELECT, request.authenticatedUser.id);
      return response.json({ profile: profile ? toPublicProfile(profile) : null });
    } catch (error) {
      return next(error);
    }
  });

  // PUT replaces the whole profile: it creates the row the first time and
  // updates the same row afterwards. Omitted optional fields are saved empty.
  router.put('/', async (request, response, next) => {
    const { profile, error } = readProfile(request.body || {});
    if (error) {
      return response.status(400).json({ error });
    }

    try {
      const userId = request.authenticatedUser.id;
      const existing = await database.get('SELECT user_id FROM profiles WHERE user_id = ?', userId);

      await database.run(
        `INSERT INTO profiles (user_id, headline, location, phone, summary, skills, education, experience, website)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           headline = excluded.headline,
           location = excluded.location,
           phone = excluded.phone,
           summary = excluded.summary,
           skills = excluded.skills,
           education = excluded.education,
           experience = excluded.experience,
           website = excluded.website,
           updated_at = CURRENT_TIMESTAMP`,
        userId,
        profile.headline,
        profile.location,
        profile.phone,
        profile.summary,
        profile.skills,
        profile.education,
        profile.experience,
        profile.website
      );

      const saved = await database.get(PROFILE_SELECT, userId);
      return response.status(existing ? 200 : 201).json({
        message: existing ? 'Profile updated successfully.' : 'Profile created successfully.',
        profile: toPublicProfile(saved),
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createProfileRouter };
