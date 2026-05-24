import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clean existing records (avoid duplicate constraints during local seeds)
  await prisma.review.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.offer.deleteMany();

  console.log('🧹 Cleaned existing records.');

  // 2. Create Default Admin & Customer Accounts
  const adminPasswordHash = await bcrypt.hash('AdminSecure2026!', 12);
  const customerPasswordHash = await bcrypt.hash('CustomerSecure2026!', 12);

  const adminUser = await prisma.user.create({
    data: {
      name: 'CPhones Admin',
      email: 'admin@cphones.co.tz',
      phone: '+255 700 000 000',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      name: 'Salim Ally',
      email: 'salim@cphones.co.tz',
      phone: '+255 712 345 678',
      passwordHash: customerPasswordHash,
      role: 'CUSTOMER',
    },
  });

  console.log(`👤 Created user accounts:`);
  console.log(`   - Admin:    ${adminUser.email} (Password: AdminSecure2026!)`);
  console.log(`   - Customer: ${customerUser.email} (Password: CustomerSecure2026!)`);

  // 3. Create Core E-Commerce Categories
  const categoryPhones = await prisma.category.create({
    data: {
      name: 'Phones',
      slug: 'phones',
      icon: 'smartphone',
    },
  });

  const categoryLaptops = await prisma.category.create({
    data: {
      name: 'Laptops',
      slug: 'laptops',
      icon: 'laptop',
    },
  });

  const categoryAccessories = await prisma.category.create({
    data: {
      name: 'Accessories',
      slug: 'accessories',
      icon: 'headphones',
    },
  });

  console.log('🏷️  Created core categories.');

  // 4. Create Premium Products
  // 4.1 iPhone 15 Pro Max
  const iphone = await prisma.product.create({
    data: {
      name: 'iPhone 15 Pro Max',
      slug: 'iphone-15-pro-max',
      description: 'The ultimate iPhone featuring a strong titanium design, the innovative Action button, the powerful A17 Pro chip, and a 5x Telephoto camera.',
      brand: 'Apple',
      categoryId: categoryPhones.id,
      price: 3400000, // 3,400,000 TZS
      comparePrice: 3600000,
      stockQty: 25,
      images: [
        '/images/products/prod_iphone_15.png'
      ].join(','),
      specs: JSON.stringify({
        Screen: '6.7 inches Super Retina XDR OLED',
        Processor: 'Apple A17 Pro (3 nm)',
        Camera: '48MP Main + 12MP Telephoto + 12MP Ultrawide',
        Battery: '4441 mAh',
        OS: 'iOS 17'
      }),
      isFeatured: true,
      variants: {
        create: [
          { name: '256GB Titanium Blue', sku: 'IP15PM-256-TB', price: 3400000, stockQty: 15 },
          { name: '512GB Natural Titanium', sku: 'IP15PM-512-NT', price: 3900000, stockQty: 10 }
        ]
      }
    }
  });

  // 4.2 Samsung S24 Ultra
  await prisma.product.create({
    data: {
      name: 'Galaxy S24 Ultra',
      slug: 'galaxy-s24-ultra',
      description: 'Welcome to the era of mobile AI. With Galaxy S24 Ultra in your hands, you can unleash whole new levels of creativity, productivity, and possibility.',
      brand: 'Samsung',
      categoryId: categoryPhones.id,
      price: 3200000, // 3,200,000 TZS
      comparePrice: 3500000,
      stockQty: 20,
      images: [
        '/images/products/prod_s24_ultra.png'
      ].join(','),
      specs: JSON.stringify({
        Screen: '6.8 inches Dynamic LTPO AMOLED 2X',
        Processor: 'Snapdragon 8 Gen 3 for Galaxy',
        Camera: '200MP Main + 50MP Telephoto + 10MP Telephoto + 12MP Ultrawide',
        Battery: '5000 mAh',
        OS: 'Android 14, One UI 6.1'
      }),
      isFeatured: true,
      variants: {
        create: [
          { name: '256GB Titanium Gray', sku: 'S24U-256-TG', price: 3200000, stockQty: 12 },
          { name: '512GB Titanium Black', sku: 'S24U-512-TB', price: 3600000, stockQty: 8 }
        ]
      }
    }
  });

  // 4.3 MacBook Pro 14 M3
  await prisma.product.create({
    data: {
      name: 'MacBook Pro 14 M3',
      slug: 'macbook-pro-14-m3',
      description: 'The 14-inch MacBook Pro blasts forward with M3, an incredibly advanced chip that brings serious speed and capability.',
      brand: 'Apple',
      categoryId: categoryLaptops.id,
      price: 4800000, // 4,800,000 TZS
      comparePrice: 5200000,
      stockQty: 8,
      images: [
        '/images/products/prod_macbook_pro.png'
      ].join(','),
      specs: JSON.stringify({
        Screen: '14.2 inches Liquid Retina XDR',
        Processor: 'Apple M3 Chip',
        RAM: '8GB Unified Memory',
        Storage: '512GB SSD',
        OS: 'macOS Sonoma'
      }),
      isFeatured: true,
      variants: {
        create: [
          { name: '8GB RAM 512GB Space Gray', sku: 'MBP14M3-8-512-SG', price: 4800000, stockQty: 5 },
          { name: '16GB RAM 512GB Silver', sku: 'MBP14M3-16-512-SL', price: 5400000, stockQty: 3 }
        ]
      }
    }
  });

  // 4.4 Dell XPS 13
  await prisma.product.create({
    data: {
      name: 'Dell XPS 13 Core Ultra',
      slug: 'dell-xps-13-core-ultra',
      description: 'Stunning premium design crafted from CNC machined aluminum. Experience outstanding productivity with the new Intel Core Ultra processors.',
      brand: 'Dell',
      categoryId: categoryLaptops.id,
      price: 3800000, // 3,800,000 TZS
      comparePrice: 4100000,
      stockQty: 6,
      images: [
        '/images/products/prod_dell_xps.png'
      ].join(','),
      specs: JSON.stringify({
        Screen: '13.4 inches FHD+ InfinityEdge Display',
        Processor: 'Intel Core Ultra 7 155H',
        RAM: '16GB LPDDR5x',
        Storage: '512GB NVMe SSD',
        OS: 'Windows 11 Home'
      }),
      isFeatured: false,
      variants: {
        create: [
          { name: '16GB RAM 512GB SSD Platinum', sku: 'XPS13-16-512-PL', price: 3800000, stockQty: 6 }
        ]
      }
    }
  });

  // 4.5 AirPods Pro 2
  await prisma.product.create({
    data: {
      name: 'AirPods Pro (2nd Generation)',
      slug: 'airpods-pro-2nd-gen',
      description: 'Features up to 2x more Active Noise Cancellation than the previous generation, plus Adaptive Audio and Personalized Spatial Audio.',
      brand: 'Apple',
      categoryId: categoryAccessories.id,
      price: 650000, // 650,000 TZS
      comparePrice: 750000,
      stockQty: 40,
      images: [
        '/images/products/prod_airpods_pro.png'
      ].join(','),
      specs: JSON.stringify({
        Audio: 'Custom high-excursion Apple driver, personalized spatial audio',
        Connectivity: 'Bluetooth 5.3',
        Sensors: 'Dual beamforming microphones, inward-facing microphone',
        Battery: 'Up to 6 hours listening time per charge'
      }),
      isFeatured: true
    }
  });

  // 4.6 Galaxy Buds 2 Pro
  const buds = await prisma.product.create({
    data: {
      name: 'Galaxy Buds 2 Pro',
      slug: 'galaxy-buds-2-pro',
      description: 'Experience studio-quality sound from your earbuds. 24-bit Hi-Fi audio ensures crystal clear, high-resolution acoustics.',
      brand: 'Samsung',
      categoryId: categoryAccessories.id,
      price: 450000, // 450,000 TZS
      comparePrice: 500000,
      stockQty: 30,
      images: [
        '/images/products/prod_galaxy_buds.png'
      ].join(','),
      specs: JSON.stringify({
        Audio: 'Custom 2-way coaxial speaker, intelligent ANC',
        Connectivity: 'Bluetooth 5.3',
        Sensors: '3 High SNR Microphones, Voice Pickup Unit',
        Battery: 'Up to 5 hours listening time (ANC on)'
      }),
      isFeatured: false
    }
  });

  console.log('💻 Seeding products completed.');

  // 5. Create Homepage Slideshow Banners
  await prisma.banner.createMany({
    data: [
      {
        title: 'Upgrade to Titanium',
        imageUrl: '/images/banners/banner_iphone.png',
        link: '/products/iphone-15-pro-max',
        position: 1,
      },
      {
        title: 'MacBook Pro Supercharged by M3',
        imageUrl: '/images/banners/banner_macbook.png',
        link: '/products/macbook-pro-14-m3',
        position: 2,
      },
    ],
  });

  console.log('🖼️  Created promo banners.');

  // 6. Create Flash Offer Campaign
  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);

  await prisma.offer.create({
    data: {
      title: 'Msimu wa Mvua Flash Sale',
      description: 'Rainy season offers! Enjoy 15% discount on iPhone 15 Pro Max and Galaxy Buds 2 Pro.',
      discountPercent: 15,
      productIds: [iphone.id, buds.id].join(','),
      startDate: now,
      endDate: nextWeek,
      isActive: true,
    },
  });

  console.log('⚡ Created flash offer campaigns.');

  // 7. Add Initial Customer Review
  await prisma.review.create({
    data: {
      productId: iphone.id,
      userId: customerUser.id,
      rating: 5,
      title: 'Best Phone Ever!',
      body: 'Nimeinunua kutoka CPhones Dar es Salaam, huduma yao ni nzuri sana na simu ni ya kiwango cha juu. Titanium frame ipo imara sana na picha zina ubora wa ajabu!',
    },
  });

  console.log('⭐ Seeded initial customer reviews.');
  console.log('✅ Seeding database successful!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
