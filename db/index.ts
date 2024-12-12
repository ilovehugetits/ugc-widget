import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.ENV === 'dev' ? process.env.DATABASE_URL_DEV! : process.env.DATABASE_URL!

const client = postgres(connectionString, {
    max: 1,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : undefined
})

export const db = drizzle(client, { schema })