import { db } from '@db';

async function main() {
  let user = await db.user.upsert({
    where: { username: 'demo-user' },
    update: {},
    create: { username: 'demo-user', settings: { create: {} } }
  });
  await db.session.upsert({
    where: { id: 'demo-session-fixed-token-123456789' },
    update: {},
    create: { userId: user.id, id: 'demo-session-fixed-token-123456789' }
  });
  console.log('Created demo user');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
