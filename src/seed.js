const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/maintenance_checklist_development";

// ── Seed data (edit seed-data.json to customise — no code changes needed) ──

const seedData = require(path.join(__dirname, "seed-data.json"));

// ── Inline schemas (avoid coupling to the global mongoose connection) ────────

const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ["admin", "staff", "supervisor"], required: true },
    isActive:     { type: Boolean, default: true },
    panelName:    { type: String, default: null },
  },
  { timestamps: true }
);

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seedUsers(conn) {
  const User = conn.model("User", userSchema);

  for (const u of seedData.users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await User.findOneAndUpdate(
      { email: u.email },
      {
        name:         u.name,
        email:        u.email,
        passwordHash,
        role:         u.role,
        isActive:     u.isActive ?? true,
        panelName:    u.panelName ?? null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${u.role.padEnd(12)} ${u.email}  (active: ${u.isActive ?? true})`);
  }
}

async function seedDatabase(uri, label) {
  // eslint-disable-next-line no-console
  console.log(`\nConnecting to ${label}...`);
  const conn = await mongoose.createConnection(uri).asPromise();

  await seedUsers(conn);

  await conn.close();
  // eslint-disable-next-line no-console
  console.log(`Seed complete for ${label}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await seedDatabase(MONGO_URI, "database");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
