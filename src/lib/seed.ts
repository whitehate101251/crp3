// This file can be used for seeding via Node.js
// For development, use the API endpoint: POST /api/seed

import { hash } from "bcryptjs";

export const SEED_USERS = [
  {
    username: "admin",
    name: "Project Admin",
    password: "admin123",
    role: "ADMIN",
  },
  {
    username: "si1",
    name: "Rahul Site Incharge",
    password: "si123",
    role: "SITE_INCHARGE",
  },
  {
    username: "foreman1",
    name: "Mahesh Foreman",
    password: "foreman123",
    role: "FOREMAN",
  },
];

export async function getSeedUsersWithHashes() {
  return Promise.all(
    SEED_USERS.map(async (user) => ({
      ...user,
      password_hash: await hash(user.password, 10),
    }))
  );
}
