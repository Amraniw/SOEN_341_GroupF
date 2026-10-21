const assert = require('node:assert/strict');
const { before, describe, test } = require('node:test');

describe('Shared job navigation context', () => {
  let navigation;
  before(async () => { navigation = await import('../src/pages/assets/job-context.mjs'); });

  test('shell context follows the URL for direct entry and refresh', () => {
    for (const path of ['/jobs/', '/jobs/12', '/jobs/index.html']) {
      assert.equal(navigation.jobsBasePath(path), '/jobs/');
    }
    for (const path of ['/workspace/jobs', '/workspace/jobs/', '/workspace/jobs/12', '/workspace/jobs/index.html', '/Workspace/Jobs/12']) {
      assert.equal(navigation.jobsBasePath(path), '/workspace/jobs/');
    }
    assert.equal(navigation.isWorkspaceJobs('/workspace/jobs-unrelated'), false);
  });

  test('details and return links retain both context and complete search criteria', () => {
    const filters = { q: 'software & data', location: 'Montreal', category: 'software-engineering' };
    const query = 'q=software+%26+data&location=Montreal&category=software-engineering';
    for (const path of ['/jobs/', '/workspace/jobs/']) {
      assert.equal(navigation.jobUrl(73, filters, path), `${path}73?${query}`);
      assert.equal(navigation.jobsUrl(filters, `${path}73`), `${path}?${query}`);
      assert.deepEqual(navigation.searchState(`?${query}`), filters);
    }
  });

  test('normalization and reset do not introduce context query flags', () => {
    assert.deepEqual(navigation.searchState('?q=+SOFTWARE++&location=+Montreal+&category=SOFTWARE-ENGINEERING'), {
      q: 'SOFTWARE', location: 'Montreal', category: 'software-engineering',
    });
    assert.equal(navigation.jobsUrl({ q: '', location: '', category: '' }, '/workspace/jobs/73'), '/workspace/jobs/');
    assert.equal(navigation.jobUrl('12/unsafe', {}, '/jobs/'), '/jobs/12%2Funsafe');
  });

  test('sign-in can restore workspace searches while rejecting unsafe return destinations', () => {
    const origin = 'https://careerconnect.example';
    assert.equal(navigation.workspaceReturnPath('/workspace/jobs/73?q=software', origin), '/workspace/jobs/73?q=software');
    assert.equal(navigation.workspaceReturnPath('/resume/index.html', origin), '/resume/index.html');
    assert.equal(navigation.workspaceReturnPath('/applications/index.html', origin), '/applications/index.html');
    for (const unsafe of ['https://other.example/workspace/jobs/', '//other.example/workspace/jobs/', 'javascript:alert(1)', 'http://[', '/workspace/jobs/../../outside', '/jobs/', '/workspace/jobs-unrelated']) {
      assert.equal(navigation.workspaceReturnPath(unsafe, origin), '/dashboard/index.html');
    }
  });
});
