// Exercises the Phase 1 auth surface end to end against a running backend.
//
// The suite makes more than 5 login calls, so the BACKEND must be started with
// the auth throttle relaxed or those calls come back 429 and the failures look
// like auth bugs:
//
//   AUTH_THROTTLE_LIMIT=100 node dist/main.js
//   npm run test:e2e:auth
//
// Setting AUTH_THROTTLE_LIMIT for this process alone does nothing — the limit
// is read by the server, not the client.
const API = 'http://localhost:3000';

let throttleHit = false;

let pass = 0,
  fail = 0;

function check(label, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ' -> ' + detail : ''}`);
  }
}

const uniquePhone = () => '010' + String(Date.now()).slice(-8);

// Minimal cookie jar: keeps each actor's session separate.
function jar() {
  const cookies = {};
  return {
    header: () =>
      Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    absorb: (res) => {
      const raw = res.headers.getSetCookie?.() ?? [];
      for (const line of raw) {
        const [pair] = line.split(';');
        const idx = pair.indexOf('=');
        cookies[pair.slice(0, idx)] = pair.slice(idx + 1);
      }
    },
  };
}

async function call(method, path, { body, cookieJar } = {}) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (cookieJar) {
    const c = cookieJar.header();
    if (c) headers.Cookie = c;
  }
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (cookieJar) cookieJar.absorb(res);
  if (res.status === 429) throttleHit = true;
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
}

(async () => {
  const adminJar = jar();
  const studentJar = jar();

  console.log('\n1. Admin signs in with a phone number');
  const adminLogin = await call('POST', '/auth/login', {
    body: {
      phone: process.env.ADMIN_PHONE ?? '01044175784',
      password: process.env.ADMIN_PASSWORD ?? 'ChangeMe_Local_8chars',
    },
    cookieJar: adminJar,
  });
  check('admin login succeeds', adminLogin.status === 200, `HTTP ${adminLogin.status}`);
  check('role is admin', adminLogin.json?.data?.user?.role === 'admin');

  console.log('\n2. Student registers and is signed in');
  // Registered per run rather than assumed to exist. Step 5 rotates this
  // student's password, so a fixed account authenticates on the first run and
  // returns 401 on every run after it — and the cascade of failures downstream
  // reads like an auth defect rather than a stale fixture.
  const studentPhone = uniquePhone();
  const studentLogin = await call('POST', '/auth/register', {
    body: {
      name: 'طالب الاختبار',
      phone: studentPhone,
      // Step 4 searches for the parent's number in canonical form, so this one
      // has to be known rather than random.
      parentPhone: '01098765432',
      grade: 'sec3',
      password: 'Student123',
    },
    cookieJar: studentJar,
  });
  check('student registers and is signed in', studentLogin.status === 201, `HTTP ${studentLogin.status}`);
  const studentId = studentLogin.json?.data?.user?.id;

  console.log('\n3. Role enforcement');
  const studentHitsAdmin = await call('GET', '/admin/students', { cookieJar: studentJar });
  check('student is refused /admin/students', studentHitsAdmin.status === 403, `HTTP ${studentHitsAdmin.status}`);

  const adminHitsAdmin = await call('GET', '/admin/students', { cookieJar: adminJar });
  check('admin can list students', adminHitsAdmin.status === 200, `HTTP ${adminHitsAdmin.status}`);

  console.log('\n4. Teacher searches by phone (the way he actually looks people up)');
  const byPhone = await call('GET', `/admin/students?q=${studentPhone}`, { cookieJar: adminJar });
  check('search by local phone finds the student', (byPhone.json?.data ?? []).length >= 1);
  const byParent = await call('GET', '/admin/students?q=201098765432', { cookieJar: adminJar });
  check('search by parent phone finds the student', (byParent.json?.data ?? []).length >= 1);

  console.log('\n5. Admin resets a student password (the real reset path)');
  const reset = await call('POST', `/auth/admin/students/${studentId}/reset-password`, {
    body: { newPassword: 'NewPass2026' },
    cookieJar: adminJar,
  });
  check('reset succeeds', reset.status === 200, `HTTP ${reset.status}`);

  const oldPw = await call('POST', '/auth/login', { body: { phone: studentPhone, password: 'Student123' } });
  check('old password no longer works', oldPw.status === 401, `HTTP ${oldPw.status}`);

  const newPw = await call('POST', '/auth/login', { body: { phone: studentPhone, password: 'NewPass2026' } });
  check('new password works', newPw.status === 200, `HTTP ${newPw.status}`);

  console.log('\n6. Student cannot reset anyone (including themselves) via the admin route');
  const studentTriesReset = await call('POST', `/auth/admin/students/${studentId}/reset-password`, {
    body: { newPassword: 'Hacked12345' },
    cookieJar: studentJar,
  });
  check('student is refused', studentTriesReset.status === 403, `HTTP ${studentTriesReset.status}`);

  console.log('\n7. Audit trail recorded the reset, identified by phone');
  const audit = await call('GET', '/admin/audit-log?action=user.admin_reset_password', { cookieJar: adminJar });
  const entry = audit.json?.data?.[0];
  check('audit entry exists', !!entry);
  const adminPhone = adminLogin.json?.data?.user?.phone;
  check('audit names the admin by phone', entry?.adminPhone === adminPhone, String(entry?.adminPhone));
  check(
    'audit body does NOT contain the new password',
    entry ? !JSON.stringify(entry.body ?? {}).includes('NewPass2026') : false,
  );

  // Two separate defences guard login, and only the first is observable from
  // one IP: the per-IP throttler (5/min) fires long before the per-account
  // lockout (5 failures) can be reached. That ordering is correct — the
  // throttler stops one machine hammering, the lockout stops a *distributed*
  // attack the throttler cannot see — but it means a single-IP test can only
  // assert the throttler. The lockout path is verified separately by seeding
  // loginAttempts to threshold-1 and sending one request.
  // Only meaningful against a server running the production throttle limit.
  // The functional assertions above need more than 5 login calls, so this
  // suite is normally run with AUTH_THROTTLE_LIMIT raised — in which case the
  // throttle is exercised by its own run rather than silently passing here.
  const relaxed = Number(process.env.AUTH_THROTTLE_LIMIT ?? 5) > 10;
  console.log('\n8. Rapid wrong passwords are throttled per IP');
  if (relaxed) {
    console.log('  SKIP  throttle relaxed for this run (AUTH_THROTTLE_LIMIT=' + process.env.AUTH_THROTTLE_LIMIT + ')');
  } else {
    let throttled = false;
    for (let i = 0; i < 8; i++) {
      const r = await call('POST', '/auth/login', { body: { phone: studentPhone, password: 'WrongPass123' } });
      if (r.status === 429) throttled = true;
    }
    check('brute force is throttled (429)', throttled);
  }

  console.log(`\n${pass} passed, ${fail} failed`);

  if (fail && throttleHit) {
    console.log(
      '\n!  Some requests came back 429, so the backend is enforcing the production\n' +
        '   auth throttle (5/min). Restart it with the limit raised and re-run:\n\n' +
        '     AUTH_THROTTLE_LIMIT=100 node dist/main.js\n\n' +
        '   Those failures are the rate limiter working, not auth defects.',
    );
  }

  process.exit(fail ? 1 : 0);
})();
