const fs = require('node:fs/promises');
const path = require('node:path');
const { fork } = require('node:child_process');
const { MAX_RESUME_SIZE_BYTES } = require('../middleware/resumeUpload');

async function extractResumeText(filePath) {
  const file = await fs.open(filePath, 'r');
  let data;
  try {
    const { size } = await file.stat();
    if (!size || size > MAX_RESUME_SIZE_BYTES) return '';
    data = new Uint8Array(await file.readFile());
  } finally {
    await file.close();
  }

  // An isolated process contains crashes in the parser's native dependencies.
  const parser = fork(path.join(__dirname, 'resumePdfWorker.mjs'), {
    execArgv: ['--max-old-space-size=128'],
    env: {},
    serialization: 'advanced',
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  let timeout;
  try {
    const extracted = await new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('PDF extraction timed out.')), 7000);
      parser.once('message', resolve);
      parser.once('error', reject);
      parser.once('exit', () => reject(new Error('PDF extraction stopped.')));
      parser.send(data, (error) => { if (error) reject(error); });
    });
    const text = extracted
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, ' ')
      .replace(/(?:\+?1[ .-]?)?(?:\(\d{3}\)|\b\d{3})[ .-]?\d{3}[ .-]?\d{4}\b/g, ' ')
      .split('\n').map((line) => line.replace(/ {2,}/g, ' ').trim()).join('\n')
      .replace(/\n{3,}/g, '\n\n').trim();
    return (text.match(/\p{L}/gu) || []).length >= 20 ? text : '';
  } finally {
    clearTimeout(timeout);
    parser.kill();
  }
}

module.exports = { extractResumeText };
