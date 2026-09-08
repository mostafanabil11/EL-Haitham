// Phase 3 end to end: purchase request -> WhatsApp -> confirm -> code ->
// redeem -> access. Plus the concurrency case that would cost real money.
//
// Run the backend with the throttle relaxed, since the suite makes more than
// 5 code-redemption attempts:
//
//   AUTH_THROTTLE_LIMIT=200 REDEEM_THROTTLE_LIMIT=200 node dist/main.js
//   npm run test:e2e:commerce
const API = 'http://localhost:3000';

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

function jar() {
  const cookies = {};
  return {
    header: () =>
      Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    absorb: (res) => {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(';');
        const i = pair.indexOf('=');
        cookies[pair.slice(0, i)] = pair.slice(i + 1);
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
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const uniquePhone = () => '010' + String(Date.now()).slice(-8);

async function newStudent(name) {
  const j = jar();
  const phone = uniquePhone();
  const r = await call('POST', '/auth/register', {
    body: {
      name,
      phone,
      parentPhone: '01098765432',
      grade: 'sec3',
      password: 'Student123',
    },
    cookieJar: j,
  });
  if (r.status !== 201) throw new Error(`register failed: ${r.status} ${JSON.stringify(r.json)}`);
  return { jar: j, phone, id: r.json.data.user.id };
}

(async () => {
  const admin = jar();
  const adminLogin = await call('POST', '/auth/login', {
    body: { phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD },
    cookieJar: admin,
  });
  if (adminLogin.status !== 200) throw new Error('admin login failed — check ADMIN_PHONE/ADMIN_PASSWORD');

  const catalog = await call('GET', '/catalog/lectures?grade=sec3');
  const lecture = catalog.json.data[0];
  console.log(`\nUsing lecture: ${lecture.titleAr} (${lecture.priceMinorUnits / 100} EGP)\n`);

  // ---------------------------------------------------------------
  console.log('1. Student starts a purchase, gets a WhatsApp link with a request number');
  const buyer = await newStudent('طالب الشراء');
  const req = await call('POST', '/purchase-requests', {
    body: { targetKind: 'lecture', targetId: lecture._id },
    cookieJar: buyer.jar,
  });
  check('request created', req.status === 201, `HTTP ${req.status}`);
  const requestNumber = req.json?.data?.requestNumber;
  // R-YYMM-NNNN. The year matters: without it September 2026 and September
  // 2027 produce the same number, and requestNumber is uniquely indexed.
  check('request number is R-YYMM-NNNN', /^R-\d{4}-\d{4}$/.test(requestNumber ?? ''), requestNumber);
  check('WhatsApp link carries the request number',
    decodeURIComponent(req.json?.data?.whatsappUrl ?? '').includes(requestNumber ?? 'x'));

  console.log('\n2. Tapping buy again reuses the same request instead of stacking duplicates');
  const req2 = await call('POST', '/purchase-requests', {
    body: { targetKind: 'lecture', targetId: lecture._id },
    cookieJar: buyer.jar,
  });
  check('same request number returned', req2.json?.data?.requestNumber === requestNumber);

  // ---------------------------------------------------------------
  console.log('\n3. Teacher confirms payment — one click mints the code');
  const queue = await call('GET', '/admin/purchase-requests?status=pending', { cookieJar: admin });
  const pending = queue.json.data.find((r) => r.requestNumber === requestNumber);
  check('request is in the pending queue', !!pending);

  const confirm = await call('POST', `/admin/purchase-requests/${pending._id}/confirm`, {
    body: {},
    cookieJar: admin,
  });
  check('confirm succeeds', confirm.status === 200, `HTTP ${confirm.status}`);
  const code = confirm.json?.data?.code;
  check('a code was issued', /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code ?? ''), code);
  check('code avoids confusable characters (0 O I 1 L)', !/[0OIL1]/.test(code ?? 'O'));
  check('reply message contains the code', (confirm.json?.data?.whatsappMessage ?? '').includes(code));

  console.log('\n4. Double-confirming must not issue a second code for one payment');
  const confirmAgain = await call('POST', `/admin/purchase-requests/${pending._id}/confirm`, {
    body: {},
    cookieJar: admin,
  });
  check('second confirm refused', confirmAgain.status === 400, `HTTP ${confirmAgain.status}`);

  // ---------------------------------------------------------------
  console.log('\n5. Access before redeeming');
  let mine = await call('GET', '/enrollments/mine', { cookieJar: buyer.jar });
  check('student has no lectures yet', (mine.json?.data ?? []).length === 0);

  console.log('\n6. Redeeming — including sloppy input (lowercase, no dashes)');
  const sloppy = code.toLowerCase().replace(/-/g, '');
  const redeem = await call('POST', '/access-codes/redeem', {
    body: { code: sloppy },
    cookieJar: buyer.jar,
  });
  check('redeem accepts normalized input', redeem.status === 200, `HTTP ${redeem.status} ${redeem.json?.message}`);

  mine = await call('GET', '/enrollments/mine', { cookieJar: buyer.jar });
  check('lecture now appears in the dashboard', (mine.json?.data ?? []).length === 1);
  check('enrollment has an expiry', !!mine.json?.data?.[0]?.expiresAt);

  console.log('\n7. The same student re-redeeming gets a clear message, not a crash');
  const again = await call('POST', '/access-codes/redeem', { body: { code }, cookieJar: buyer.jar });
  check('refused with 409', again.status === 409, `HTTP ${again.status}`);
  check('message says THEY already used it', (again.json?.message ?? '').includes('استخدمت'), again.json?.message);

  console.log('\n8. A different student trying the used code is told it belongs to someone else');
  const other = await newStudent('طالب آخر');
  const stolen = await call('POST', '/access-codes/redeem', { body: { code }, cookieJar: other.jar });
  check('refused with 409', stolen.status === 409, `HTTP ${stolen.status}`);
  check('message distinguishes "another account"', (stolen.json?.message ?? '').includes('حساب آخر'), stolen.json?.message);

  console.log('\n9. Bad input is rejected before touching the database');
  const malformed = await call('POST', '/access-codes/redeem', {
    body: { code: 'OOOO-IIII-LLLL' },
    cookieJar: other.jar,
  });
  check('confusable-only code refused as malformed', malformed.status === 400, `HTTP ${malformed.status}`);

  const notFound = await call('POST', '/access-codes/redeem', {
    body: { code: 'ABCD-EFGH-JKMN' },
    cookieJar: other.jar,
  });
  check('well-formed but unknown code -> 404', notFound.status === 404, `HTTP ${notFound.status}`);

  // ---------------------------------------------------------------
  console.log('\n10. ⭐ CONCURRENCY: 8 students redeem ONE code simultaneously');
  const batch = await call('POST', '/admin/access-codes/generate', {
    body: { targetKind: 'lecture', targetId: lecture._id, count: 1, batchId: 'RACE-TEST' },
    cookieJar: admin,
  });
  const raceCode = batch.json.data.codes[0];

  const racers = [];
  for (let i = 0; i < 8; i++) racers.push(await newStudent(`متسابق ${i}`));

  // Fired without awaiting in between, so they land on the server together.
  const results = await Promise.all(
    racers.map((r) => call('POST', '/access-codes/redeem', { body: { code: raceCode }, cookieJar: r.jar })),
  );

  const winners = results.filter((r) => r.status === 200);
  console.log(`     statuses: ${results.map((r) => r.status).join(', ')}`);
  check('exactly ONE redemption succeeded', winners.length === 1, `${winners.length} succeeded`);
  check('the other 7 were all refused', results.filter((r) => r.status !== 200).length === 7);

  // The decisive assertion: enrollments, not HTTP responses. A race that let
  // two students in would show up here even if both got a 200.
  let enrolledCount = 0;
  for (const r of racers) {
    const m = await call('GET', '/enrollments/mine', { cookieJar: r.jar });
    if ((m.json?.data ?? []).length > 0) enrolledCount++;
  }
  check('exactly ONE student actually gained access', enrolledCount === 1, `${enrolledCount} have access`);

  // ---------------------------------------------------------------
  console.log('\n11. Revoking a redeemed code does NOT strip the paid-for access');
  const codeList = await call('GET', '/admin/access-codes?batchId=RACE-TEST', { cookieJar: admin });
  const raceDoc = codeList.json.data.find((c) => c.code === raceCode);
  const revoked = await call('POST', `/admin/access-codes/${raceDoc._id}/revoke`, { body: {}, cookieJar: admin });
  check('revoke succeeds', revoked.status === 200);

  const winnerIndex = results.findIndex((r) => r.status === 200);
  if (winnerIndex === -1) {
    check('student who paid keeps their lecture', false, 'no winner — earlier race assertion failed');
  } else {
    const stillHas = await call('GET', '/enrollments/mine', { cookieJar: racers[winnerIndex].jar });
    check('student who paid keeps their lecture', (stillHas.json?.data ?? []).length === 1);
  }

  console.log('\n12. Students cannot reach admin commerce routes');
  const sneak = await call('GET', '/admin/access-codes', { cookieJar: buyer.jar });
  check('student refused /admin/access-codes', sneak.status === 403, `HTTP ${sneak.status}`);
  const sneak2 = await call('POST', '/admin/access-codes/generate', {
    body: { targetKind: 'lecture', targetId: lecture._id, count: 100 },
    cookieJar: buyer.jar,
  });
  check('student cannot mint codes', sneak2.status === 403, `HTTP ${sneak2.status}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('\nSUITE ERROR:', e.message);
  process.exit(1);
});
