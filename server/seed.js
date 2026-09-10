/**
 * Seed Script — creates two accounts if they don't already exist:
 *   1. vijayadmin@gmail.com   → role: ADMIN      password: 12345678
 *   2. vijaysruvary@gmail.com → role: SURVEYER    password: 12345678
 *
 * Run: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

const SEED_USERS = [
  {
    name:     'Vijay Admin',
    email:    'vijayadmin@gmail.com',
    password: '12345678',
    role:     'ADMIN',
  },
  {
    name:           'Vijay Surveyer',
    email:          'vijaysruvary@gmail.com',
    password:       '12345678',
    role:           'SURVEYER',
    surveyerId:     'SVR-SEED-001',
    surveyerStatus: 'ACTIVE',
  },
];

async function seed() {
  console.log('\n🌱  Starting seed script…\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB\n');

  for (const u of SEED_USERS) {
    const exists = await User.findOne({ email: u.email });

    if (exists) {
      console.log(`⚠️   ${u.email} already exists — skipping`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(u.password, 10);

    await User.create({
      name:           u.name,
      email:          u.email,
      password:       hashedPassword,
      role:           u.role,
      authProvider:   'LOCAL',
      surveyerId:     u.surveyerId     || undefined,
      surveyerStatus: u.surveyerStatus || null,
    });

    console.log(`✅  Created: ${u.email}  (role: ${u.role})`);
  }

  console.log('\n🎉  Seed complete!\n');
  console.log('─────────────────────────────────────────');
  console.log('  Admin   → vijayadmin@gmail.com   / 12345678');
  console.log('  Surveyer→ vijaysruvary@gmail.com / 12345678');
  console.log('─────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
