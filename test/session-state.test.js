const assert = require('node:assert/strict');
const { before, describe, test } = require('node:test');

describe('Shared session request lifecycle', () => {
  let createSessionResolver;
  const user = { id: 7, name: 'Account QA', email: 'account@example.test' };
  before(async () => { ({ createSessionResolver } = await import('../src/pages/assets/session-state.mjs')); });

  test('initialization distinguishes loading from anonymous and authenticated state', async () => {
    let complete;
    const resolver = createSessionResolver(() => new Promise((resolve) => { complete = resolve; }));
    assert.equal(resolver.state.status, 'idle');
    const pending = resolver.resolve();
    assert.equal(resolver.state.status, 'loading');
    await Promise.resolve();
    complete({ user });
    assert.equal(await pending, user);
    assert.equal(resolver.state.status, 'authenticated');
  });

  test('concurrent checks and repeated forced retries send one request while pending', async () => {
    let complete;
    let calls = 0;
    const resolver = createSessionResolver(() => {
      calls += 1;
      return new Promise((resolve) => { complete = resolve; });
    });
    const first = resolver.resolve();
    assert.equal(resolver.resolve({ force: true }), first);
    assert.equal(resolver.resolve({ force: true }), first);
    await Promise.resolve();
    assert.equal(calls, 1);
    complete({ user });
    await first;
    assert.equal(await resolver.resolve(), user);
    assert.equal(calls, 1);
  });

  test('registration status failure can retry successfully without another login', async () => {
    let calls = 0;
    const resolver = createSessionResolver(async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('Service unavailable'), { status: 503 });
      return { user };
    });
    await assert.rejects(resolver.resolve(), /Service unavailable/);
    assert.equal(resolver.state.status, 'error');
    const retry = resolver.resolve({ force: true });
    assert.equal(resolver.state.status, 'loading');
    assert.equal(await retry, user);
    assert.equal(calls, 2);
    assert.equal(resolver.state.status, 'authenticated');
  });

  test('repeated failure remains retryable and does not become an anonymous session', async () => {
    let calls = 0;
    const resolver = createSessionResolver(async () => {
      calls += 1;
      throw new Error('Connection unavailable');
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await assert.rejects(resolver.resolve({ force: true }), /Connection unavailable/);
      assert.equal(resolver.state.status, 'error');
    }
    assert.equal(calls, 3);
  });

  test('failed revalidation preserves the last verified identity without claiming success', async () => {
    let fail = false;
    const resolver = createSessionResolver(async () => {
      if (fail) throw new Error('Temporary outage');
      return { user };
    });
    await resolver.resolve();
    fail = true;
    await assert.rejects(resolver.resolve({ force: true }), /Temporary outage/);
    assert.equal(resolver.state.status, 'error');
    assert.equal(resolver.state.user, user);
  });

  test('explicit anonymous responses and unauthorized/forbidden sessions resolve to login state', async () => {
    const anonymous = createSessionResolver(async () => ({ user: null }));
    assert.equal(await anonymous.resolve(), null);
    assert.equal(anonymous.state.status, 'unauthenticated');
    for (const status of [401, 403]) {
      const resolver = createSessionResolver(async () => { throw Object.assign(new Error('Not authorized'), { status }); });
      assert.equal(await resolver.resolve(), null);
      assert.equal(resolver.state.status, 'unauthenticated');
    }
  });

  test('missing or malformed account responses fail safely instead of pretending the user logged out', async () => {
    for (const data of [null, {}, { user: {} }, { user: { ...user, id: '7' } }, { user: { ...user, id: 0 } }, { user: { ...user, name: '' } }]) {
      const resolver = createSessionResolver(async () => data);
      await assert.rejects(resolver.resolve(), /could not be checked/);
      assert.equal(resolver.state.status, 'error');
    }
  });

  test('account changes reset cached identity and require a new authoritative check', async () => {
    let current = { user: null };
    let calls = 0;
    const resolver = createSessionResolver(async () => { calls += 1; return current; });
    assert.equal(await resolver.resolve(), null);
    current = { user };
    resolver.reset();
    assert.equal(resolver.state.status, 'idle');
    assert.equal(await resolver.resolve(), user);
    assert.equal(calls, 2);
  });
});
