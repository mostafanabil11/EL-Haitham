/**
 * Creates (or repairs) the single teacher account.
 *
 * There is deliberately no API route that can grant `role: 'admin'` — the only
 * way to become one is to run this script with shell access to the deployment,
 * which is a much smaller attack surface than any endpoint, however well
 * guarded. Safe to run repeatedly: it updates the existing admin's password
 * rather than creating a second one.
 *
 *   ADMIN_PHONE=01012345678 ADMIN_PASSWORD='...' npm run bootstrap:admin
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { UserSchema, User } from '../src/auth/schemas/user.schema';
import { normalizeEgyptianPhone } from '../src/common/utils/phone.util';

async function main() {
  const uri = process.env.MONGODB_URI;
  const rawPhone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'المدرس';

  if (!uri) throw new Error('MONGODB_URI is not set');
  if (!rawPhone) throw new Error('ADMIN_PHONE is not set');
  if (!password) throw new Error('ADMIN_PASSWORD is not set');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  const phone = normalizeEgyptianPhone(rawPhone);
  if (!phone) throw new Error(`ADMIN_PHONE "${rawPhone}" is not a valid Egyptian mobile number`);

  await mongoose.connect(uri);
  const userModel = mongoose.model(User.name, UserSchema);

  const hashed = await bcrypt.hash(password, 10);
  const existing = await userModel.findOne({ phone });

  if (existing) {
    existing.set({
      password: hashed,
      role: 'admin',
      isActive: true,
      loginAttempts: 0,
      lockedUntil: null,
      // Every existing session is dropped, so running this to recover a
      // forgotten password also cuts off anyone already signed in as admin.
      sessions: [],
    });
    await existing.save();
    console.log(`✅ Updated existing admin: ${phone}`);
  } else {
    await userModel.create({
      name,
      phone,
      // The schema requires a parent phone for students; the teacher has no
      // parent, so it mirrors their own number rather than holding a fake one.
      parentPhone: phone,
      password: hashed,
      role: 'admin',
      email: process.env.ADMIN_EMAIL || null,
      isPhoneVerified: true,
    });
    console.log(`✅ Created admin: ${phone}`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Bootstrap failed:', error.message);
  process.exit(1);
});
