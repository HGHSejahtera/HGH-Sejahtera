import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';

// For MVP, we use memory or simply point to Supabase if we have the connection string.
// We will configure a mock Database string or Supabase adapter.
// Using dummy config for now.

export const auth = betterAuth({
    database: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres",
    emailAndPassword: {
        enabled: true
    },
    plugins: [
        username()
    ],
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: "Staff" // Founder, Manager, Staff, Agent
            },
            staffId: {
                type: "string",
                required: false
            },
            displayName: {
                type: "string",
                required: true
            },
            pinHash: {
                type: "string",
                required: false
            }
        }
    }
});
