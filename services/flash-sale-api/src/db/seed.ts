/**
 * The seed data.
 *
 * The names are invented. One product is deliberately scarce, so the
 * concurrency behaviour can be demonstrated.
 *
 * Running the seed is safe: it replaces the products and clears the orders,
 * which is what the demo needs between runs.
 */
import { loadConfig, loadLocalEnv } from '@gip/service-core';

import { buildApp } from '../app.ts';
import { migrate } from './migrate.ts';
import { orders, products } from './schema.ts';

const PRODUCTS = [
  {
    name: 'Aurora Desk Lamp',
    description: 'A warm, dimmable lamp with a brushed brass arm.',
    priceCents: 4_900,
    stock: 25,
  },
  {
    name: 'Meridian Travel Mug',
    description: 'Double-walled steel, keeps coffee hot for six hours.',
    priceCents: 2_800,
    stock: 40,
  },
  {
    name: 'Solstice Backpack',
    description: 'Waxed canvas with a laptop sleeve and rain cover.',
    priceCents: 12_500,
    stock: 8,
  },
  {
    name: 'Nimbus Wireless Charger',
    description: 'A 15W pad with a fabric finish.',
    priceCents: 3_200,
    stock: 60,
  },
  {
    // Deliberately scarce, for the concurrency demonstration.
    name: 'Limited Edition Field Watch',
    description: 'Fifty pieces only. The one product built for the flash sale.',
    priceCents: 39_900,
    stock: 10,
  },
  {
    name: 'Vertex Mechanical Keyboard',
    description: 'A compact board with hot-swap switches.',
    priceCents: 18_500,
    stock: 15,
  },
];

async function seed(): Promise<void> {
  loadLocalEnv();

  const config = loadConfig(process.env, { schema: 'flash_sale', requireJwt: 'none' });

  await migrate({ connectionString: config.databaseUrl, schema: config.schema });

  const app = await buildApp({ config });
  try {
    // The orders are cleared first, because they reference the products. The
    // products are cleared too: seeding twice must not leave two copies of
    // every product, which is what happened before this was fixed.
    await app.db.delete(orders);
    await app.db.delete(products);

    // The insert goes through the query builder rather than raw SQL: a
    // schema name is an identifier and cannot be passed as a parameter.
    for (const product of PRODUCTS) {
      await app.db.insert(products).values(product);
    }

    console.log(`[seed] ${PRODUCTS.length} products seeded into ${config.schema}`);
  } finally {
    await app.close();
  }
}

seed().catch((error) => {
  console.error('[seed] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
