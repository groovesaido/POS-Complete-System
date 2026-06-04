const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Create default users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const cashierPassword = await bcrypt.hash('cashier123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'System Admin',
      username: 'admin',
      email: 'admin@pos.com',
      password: adminPassword,
      role: 'admin',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { username: 'cashier' },
    update: {},
    create: {
      name: 'John Cashier',
      username: 'cashier',
      email: 'cashier@pos.com',
      password: cashierPassword,
      role: 'cashier',
      status: 'active',
    },
  });

  // Create sample categories
  const categories = [
    { name: 'Beverages', description: 'Drinks and beverages' },
    { name: 'Food', description: 'Food items and snacks' },
    { name: 'Electronics', description: 'Electronic devices and accessories' },
    { name: 'Clothing', description: 'Apparel and accessories' },
    { name: 'Stationery', description: 'Office and school supplies' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  // Create sample products
  const catBeverages = await prisma.category.findUnique({ where: { name: 'Beverages' } });
  const catFood = await prisma.category.findUnique({ where: { name: 'Food' } });
  const catElectronics = await prisma.category.findUnique({ where: { name: 'Electronics' } });
  const catClothing = await prisma.category.findUnique({ where: { name: 'Clothing' } });
  const catStationery = await prisma.category.findUnique({ where: { name: 'Stationery' } });

  const products = [
    { name: 'Coca Cola 500ml', sku: 'BEV001', barcode: '1000001', costPrice: 0.80, sellingPrice: 1.50, quantity: 100, reorderLevel: 20, categoryId: catBeverages.id },
    { name: 'Water Bottle 1L', sku: 'BEV002', barcode: '1000002', costPrice: 0.30, sellingPrice: 1.00, quantity: 150, reorderLevel: 30, categoryId: catBeverages.id },
    { name: 'Orange Juice', sku: 'BEV003', barcode: '1000003', costPrice: 1.20, sellingPrice: 2.50, quantity: 60, reorderLevel: 15, categoryId: catBeverages.id },
    { name: 'Coffee Latte', sku: 'BEV004', barcode: '1000004', costPrice: 1.00, sellingPrice: 3.50, quantity: 40, reorderLevel: 10, categoryId: catBeverages.id },
    { name: 'Iced Tea', sku: 'BEV005', barcode: '1000005', costPrice: 0.60, sellingPrice: 1.80, quantity: 80, reorderLevel: 20, categoryId: catBeverages.id },
    { name: 'Potato Chips', sku: 'FOOD001', barcode: '2000001', costPrice: 0.50, sellingPrice: 1.20, quantity: 200, reorderLevel: 40, categoryId: catFood.id },
    { name: 'Chocolate Bar', sku: 'FOOD002', barcode: '2000002', costPrice: 0.70, sellingPrice: 1.50, quantity: 120, reorderLevel: 30, categoryId: catFood.id },
    { name: 'Sandwich', sku: 'FOOD003', barcode: '2000003', costPrice: 2.00, sellingPrice: 4.50, quantity: 30, reorderLevel: 10, categoryId: catFood.id },
    { name: 'Cookies Pack', sku: 'FOOD004', barcode: '2000004', costPrice: 1.00, sellingPrice: 2.00, quantity: 90, reorderLevel: 20, categoryId: catFood.id },
    { name: 'Energy Bar', sku: 'FOOD005', barcode: '2000005', costPrice: 0.80, sellingPrice: 1.80, quantity: 75, reorderLevel: 15, categoryId: catFood.id },
    { name: 'USB Cable', sku: 'ELEC001', barcode: '3000001', costPrice: 2.00, sellingPrice: 5.00, quantity: 50, reorderLevel: 10, categoryId: catElectronics.id },
    { name: 'Phone Case', sku: 'ELEC002', barcode: '3000002', costPrice: 3.00, sellingPrice: 8.00, quantity: 35, reorderLevel: 10, categoryId: catElectronics.id },
    { name: 'Mouse Pad', sku: 'ELEC003', barcode: '3000003', costPrice: 1.50, sellingPrice: 4.00, quantity: 45, reorderLevel: 15, categoryId: catElectronics.id },
    { name: 'T-Shirt', sku: 'CLTH001', barcode: '4000001', costPrice: 5.00, sellingPrice: 12.00, quantity: 60, reorderLevel: 15, categoryId: catClothing.id },
    { name: 'Cap', sku: 'CLTH002', barcode: '4000002', costPrice: 3.00, sellingPrice: 8.00, quantity: 40, reorderLevel: 10, categoryId: catClothing.id },
    { name: 'Notebook A5', sku: 'STAT001', barcode: '5000001', costPrice: 1.00, sellingPrice: 2.50, quantity: 100, reorderLevel: 25, categoryId: catStationery.id },
    { name: 'Pen Pack', sku: 'STAT002', barcode: '5000002', costPrice: 1.50, sellingPrice: 3.00, quantity: 80, reorderLevel: 20, categoryId: catStationery.id },
    { name: 'Marker Set', sku: 'STAT003', barcode: '5000003', costPrice: 2.00, sellingPrice: 4.50, quantity: 50, reorderLevel: 15, categoryId: catStationery.id },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }

  // Create default settings
  const settings = [
    { key: 'store_name', value: 'My POS Store' },
    { key: 'store_phone', value: '+254700000000' },
    { key: 'store_email', value: 'info@mystore.com' },
    { key: 'store_address', value: '123 Main Street, Nairobi' },
    { key: 'tax_rate', value: '16' },
    { key: 'currency', value: 'KES' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('Seed data created successfully!');
  console.log('Default Admin: username=admin, password=admin123');
  console.log('Default Cashier: username=cashier, password=cashier123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
