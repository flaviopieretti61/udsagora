import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1) Categorie socio
  const categories = [
    { code: 'ORDINARIO', name: 'Ordinario' },
    { code: 'BCC', name: 'BCC' },
    { code: 'CONIUGE', name: 'Coniuge' },
    { code: 'GIOVANI', name: 'Giovani' },
  ];
  for (const c of categories) {
    await prisma.memberCategory.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
  }
  console.log(`[seed] categorie socio: ${categories.length}`);

  // 2) Anno accademico corrente
  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const label = `${year}/${year + 1}`;
  const ay = await prisma.academicYear.upsert({
    where: { label },
    update: {},
    create: {
      label,
      startDate: new Date(`${year}-09-01`),
      endDate: new Date(`${year + 1}-08-31`),
      active: true,
    },
  });
  console.log(`[seed] anno accademico attivo: ${ay.label}`);

  // 3) Utente admin iniziale
  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'cambiami';
  const adminName = process.env.ADMIN_NAME ?? 'Amministratore';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { username: adminUsername },
    update: { fullName: adminName, role: 'ADMIN', active: true, passwordHash },
    create: {
      username: adminUsername,
      fullName: adminName,
      passwordHash,
      role: 'ADMIN',
      active: true,
    },
  });
  console.log(`[seed] admin: ${adminUsername} (password da .env o default)`);

  console.log('[seed] completato.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
