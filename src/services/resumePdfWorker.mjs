import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_PAGES = 10;
const MAX_TEXT_LENGTH = 16000;
process.once('message', async (data) => {
  const task = getDocument({ data, isEvalSupported: false, stopAtErrors: true, verbosity: 0 });
  let text = '';
  try {
    const pdf = await task.promise;
    for (let number = 1; number <= Math.min(pdf.numPages, MAX_PAGES); number++) {
      const page = await pdf.getPage(number);
      const { items } = await page.getTextContent();
      for (const item of items) {
        if (typeof item.str !== 'string') continue;
        text += item.str.replace(/\s+/g, ' ') + (item.hasEOL ? '\n' : ' ');
        if (text.length >= MAX_TEXT_LENGTH) break;
      }
      page.cleanup();
      if (text.length >= MAX_TEXT_LENGTH) break;
      text += '\n\n';
    }
  } finally {
    await task.destroy();
  }
  process.send(text.slice(0, MAX_TEXT_LENGTH));
});
