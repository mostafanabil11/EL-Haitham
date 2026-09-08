// Phase 4: does the enrollment gate actually hold?
//
// This suite is written from the attacker's side. Every check asks whether
// paid content can be reached without paying — by an anonymous visitor, by a
// signed-in student who bought nothing, and by a student who bought a
// *different* lecture.
//
//   AUTH_THROTTLE_LIMIT=200 REDEEM_THROTTLE_LIMIT=200 node dist/main.js
//   npm run test:e2e:learn
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
    header: () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
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
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (cookieJar) cookieJar.absorb(res);
  return { status: res.status, json: await res.json().catch(() => null) };
}

let seq = 0;
async function newStudent(name) {
  const j = jar();
  const phone = '011' + String(Date.now() + seq++).slice(-8);
  const r = await call('POST', '/auth/register', {
    body: { name, phone, parentPhone: '01098765432', grade: 'sec3', password: 'Student123' },
    cookieJar: j,
  });
  if (r.status !== 201) throw new Error(`register failed: ${r.status}`);
  return { jar: j, phone, id: r.json.data.user.id };
}

(async () => {
  const admin = jar();
  await call('POST', '/auth/login', {
    body: { phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD },
    cookieJar: admin,
  });

  const catalog = await call('GET', '/catalog/lectures?grade=sec3');
  const paidLecture = catalog.json.data[1];   // no free preview
  const previewLecture = catalog.json.data[0]; // has a free preview
  console.log(`\nPaid lecture   : ${paidLecture.titleAr}`);
  console.log(`Preview lecture: ${previewLecture.titleAr}\n`);

  // ---------------------------------------------------------------
  console.log('1. Anonymous visitor');
  const anon = await call('GET', `/learn/lectures/${paidLecture.slug}`);
  check('can read the outline', anon.status === 200, `HTTP ${anon.status}`);
  check('hasAccess is false', anon.json?.data?.hasAccess === false);

  const anonItems = anon.json?.data?.items ?? [];
  const lockedAnon = anonItems.filter((i) => !i.unlocked);
  check('paid items are marked locked', lockedAnon.length > 0);
  check('locked items expose NO contentHtml', lockedAnon.every((i) => i.contentHtml === null));
  check('locked items expose NO attachments', lockedAnon.every((i) => (i.attachments ?? []).length === 0));
  check(
    'no videoAssetId anywhere in the payload',
    !JSON.stringify(anon.json).includes('videoAssetId'),
  );

  console.log('\n2. Anonymous visitor tries to mint a playback ticket for a paid item');
  const lockedId = lockedAnon[0]?.id;
  const anonTicket = await call('POST', `/learn/items/${lockedId}/playback`);
  check('refused with 403', anonTicket.status === 403, `HTTP ${anonTicket.status}`);
  check('no URL returned', !anonTicket.json?.data?.url);

  // ---------------------------------------------------------------
  console.log('\n3. Signed-in student who has bought nothing');
  const freeloader = await newStudent('طالب بدون اشتراك');
  const fl = await call('GET', `/learn/lectures/${paidLecture.slug}`, { cookieJar: freeloader.jar });
  check('hasAccess is false', fl.json?.data?.hasAccess === false);
  const flTicket = await call('POST', `/learn/items/${lockedId}/playback`, { cookieJar: freeloader.jar });
  check('playback refused with 403', flTicket.status === 403, `HTTP ${flTicket.status}`);

  console.log('\n4. ...and cannot forge progress to fake completion');
  const flProgress = await call('POST', '/learn/progress', {
    body: { itemId: lockedId, positionSeconds: 3000 },
    cookieJar: freeloader.jar,
  });
  check('progress refused with 403', flProgress.status === 403, `HTTP ${flProgress.status}`);

  // ---------------------------------------------------------------
  console.log('\n5. Free preview IS playable without any account');
  const prev = await call('GET', `/learn/lectures/${previewLecture.slug}`);
  const freeItem = (prev.json?.data?.items ?? []).find((i) => i.isFreePreview);
  check('a free item exists and is unlocked', !!freeItem && freeItem.unlocked);
  const prevTicket = await call('POST', `/learn/items/${freeItem.id}/playback`);
  check('anonymous playback ticket granted', prevTicket.status === 200, `HTTP ${prevTicket.status}`);
  check('watermark present even for anonymous', !!prevTicket.json?.data?.watermark?.text);

  // ---------------------------------------------------------------
  console.log('\n6. Paying student gets in');
  const buyer = await newStudent('طالب مشترك');
  const gen = await call('POST', '/admin/access-codes/generate', {
    body: { targetKind: 'lecture', targetId: paidLecture._id, count: 1, batchId: 'LEARN-TEST' },
    cookieJar: admin,
  });
  const code = gen.json.data.codes[0];
  const redeemed = await call('POST', '/access-codes/redeem', { body: { code }, cookieJar: buyer.jar });
  check('redeem succeeded', redeemed.status === 200, `HTTP ${redeemed.status}`);

  const paid = await call('GET', `/learn/lectures/${paidLecture.slug}`, { cookieJar: buyer.jar });
  check('hasAccess is true', paid.json?.data?.hasAccess === true);
  check('all items unlocked', (paid.json?.data?.items ?? []).every((i) => i.unlocked));

  const paidItemId = paid.json.data.items[0].id;
  const ticket = await call('POST', `/learn/items/${paidItemId}/playback`, { cookieJar: buyer.jar });
  check('playback ticket granted', ticket.status === 200, `HTTP ${ticket.status}`);

  console.log('\n7. The watermark carries THIS student, not a generic label');
  const wm = ticket.json?.data?.watermark?.text ?? '';
  check('watermark contains the student name', wm.includes('طالب مشترك'), wm);
  // Registration was given the local form, and that is exactly what the
  // watermark should show back — 01… is what a student recognises as their
  // own number, and recognising it is the entire deterrent.
  check('watermark contains their phone', wm.includes(buyer.phone), `${wm} (want ${buyer.phone})`);

  // ---------------------------------------------------------------
  console.log('\n8. Buying lecture A must not unlock lecture B');
  const otherLecture = catalog.json.data[2];
  const cross = await call('GET', `/learn/lectures/${otherLecture.slug}`, { cookieJar: buyer.jar });
  check('no access to the other lecture', cross.json?.data?.hasAccess === false);
  const crossLocked = (cross.json?.data?.items ?? []).find((i) => !i.unlocked);
  if (crossLocked) {
    const crossTicket = await call('POST', `/learn/items/${crossLocked.id}/playback`, { cookieJar: buyer.jar });
    check('playback on the other lecture refused', crossTicket.status === 403, `HTTP ${crossTicket.status}`);
  } else {
    check('playback on the other lecture refused', true, 'other lecture is all free preview');
  }

  // ---------------------------------------------------------------
  console.log('\n9. Progress records, and cannot be scrubbed to completion');
  await call('POST', '/learn/progress', { body: { itemId: paidItemId, positionSeconds: 60 }, cookieJar: buyer.jar });
  // Two independent defences, and both are worth asserting separately.
  // First: an absurd value never reaches the service — the DTO caps
  // positionSeconds at 12 hours, so this is rejected as malformed input.
  const absurd = await call('POST', '/learn/progress', {
    body: { itemId: paidItemId, positionSeconds: 999999 },
    cookieJar: buyer.jar,
  });
  check('absurd position rejected by validation', absurd.status === 400, `HTTP ${absurd.status}`);

  // Second, and the realistic attack: a plausible jump to near the end of the
  // video, which validation would happily accept. furthestSeconds must only
  // advance by a believable amount per report, or dragging the scrub bar
  // marks the lecture complete.
  const jump = await call('POST', '/learn/progress', {
    body: { itemId: paidItemId, positionSeconds: 3000 },
    cookieJar: buyer.jar,
  });
  check(
    'scrubbing forward is clamped',
    (jump.json?.data?.furthestSeconds ?? 1e9) < 300,
    String(jump.json?.data?.furthestSeconds),
  );
  check('lecture not marked complete by scrubbing', jump.json?.data?.completed === false);

  const resumed = await call('GET', `/learn/lectures/${paidLecture.slug}`, { cookieJar: buyer.jar });
  const prog = resumed.json.data.items.find((i) => i.id === paidItemId)?.progress;
  check('resume position was stored', (prog?.lastPositionSeconds ?? 0) > 0, JSON.stringify(prog));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('\nSUITE ERROR:', e.message);
  process.exit(1);
});
