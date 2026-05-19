import { db } from "../db/index.js";
import { users, userRoles } from "../db/schema.js";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log("\n🚀 DCA Events Platform - Initial Setup\n");

  // Check if admins already exist
  const existingAdmins = await db.query.userRoles.findMany({
    where: (ur) => ur.role === "admin",
  });

  if (existingAdmins && existingAdmins.length > 0) {
    console.log("✅ System already initialized with admin users.\n");
    rl.close();
    process.exit(0);
  }

  console.log("No administrators found. Let's set up your system admin accounts.\n");

  const admins = [];
  let addMore = true;

  while (addMore) {
    const email = await question("Enter admin email address: ");
    const name = await question("Enter admin name: ");

    admins.push({ email, name });

    const another = await question("Add another admin? (y/n): ");
    addMore = another.toLowerCase() === "y";
  }

  // Create or update users and assign admin role
  for (const admin of admins) {
    const existingUser = await db.query.users.findFirst({
      where: (u) => u.email === admin.email,
    });

    let userId;
    if (existingUser) {
      userId = existingUser.id;
      console.log(`✓ User ${admin.email} already exists`);
    } else {
      // Create user with placeholder LinkedIn ID
      const newUser = await db
        .insert(users)
        .values({
          email: admin.email,
          name: admin.name,
          linkedinId: `admin-${Date.now()}-${Math.random()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      userId = newUser[0].id;
      console.log(`✓ Created user ${admin.email}`);
    }

    // Assign admin role
    const existingRole = await db.query.userRoles.findFirst({
      where: (ur) => ur.userId === userId,
    });

    if (!existingRole) {
      await db.insert(userRoles).values({
        userId,
        role: "admin",
        createdAt: new Date(),
      });
      console.log(`✓ Assigned admin role to ${admin.email}`);
    }
  }

  console.log("\n✅ Setup complete! Your system is ready to use.\n");
  rl.close();
  process.exit(0);
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  rl.close();
  process.exit(1);
});
