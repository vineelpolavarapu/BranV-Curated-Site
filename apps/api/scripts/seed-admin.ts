/**
 * Seeds an initial admin user. Per PRD §4.3, admins are CLI-seeded only —
 * there is no admin self-registration.
 *
 * Usage:
 *   pnpm seed:admin <email> <password>
 *   pnpm seed:admin                       # uses ADMIN_EMAIL / ADMIN_PASSWORD env
 *
 * The created admin will be ACTIVE, email-verified, with totpEnabled=false.
 * They MUST complete 2FA setup on first login before doing anything else
 * (enforced by TwoFactorGuard).
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import * as argon2 from 'argon2';
import { PrismaClient, UserRole } from '@prisma/client';

// Load .env from monorepo root first, then api-local override.
loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

async function main() {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? '')
    .toLowerCase()
    .trim();
  const password = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    console.error('Usage: pnpm seed:admin <email> <password>');
    console.error('   or set ADMIN_EMAIL and ADMIN_PASSWORD env vars');
    process.exit(2);
  }
  if (password.length < 12) {
    console.error('Admin password must be at least 12 characters.');
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: UserRole.ADMIN,
        emailVerifiedAt: new Date(),
      },
      create: {
        email,
        passwordHash,
        role: UserRole.ADMIN,
        emailVerifiedAt: new Date(),
      },
    });
    console.log('');
    console.log('Admin user provisioned:');
    console.log(`  id    : ${user.id}`);
    console.log(`  email : ${user.email}`);
    console.log(`  role  : ${user.role}`);
    console.log('');
    console.log('Next: sign in at /admin/login. You will be prompted to set');
    console.log('up 2FA before you can access any admin route.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Failed to seed admin:', err);
  process.exit(1);
});
