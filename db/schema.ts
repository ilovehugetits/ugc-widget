import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    integer,
    text,
    jsonb,
} from 'drizzle-orm/pg-core'

import { relations } from 'drizzle-orm'

// export const videoStatusEnum = pgEnum('video_status', [
//     'queued',
//     'processing',
//     'completed',
//     'failed',
//     'deleted'
// ])

export const subscriptionLimits = pgTable('subscription_limits', {
    subscriptionId: integer('subscription_id').primaryKey(),  // External subscription ID
    maxVideos: integer('max_videos').notNull()
})

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    externalId: varchar('external_id', { length: 255 }).notNull().unique(), // Parent system user ID
    videoLimit: integer('video_limit').notNull().default(10),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastActivityAt: timestamp('last_activity_at'),
    email: varchar('email', { length: 255 }),
    name: varchar('name', { length: 255 })
})

// Actors table
export const actors = pgTable('actors', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    url: text('url').notNull(), // Preview video URL
    voiceId: varchar('voice_id', { length: 255 }).notNull(), // ElevenLabs voice ID
    originalUrl: text('original_url').notNull(), // Original source video URL
    thumbnail: text('thumbnail').notNull(),
    categories: text('categories').array().notNull().default([]),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    displayOrder: integer('display_order').notNull().default(0),
    lipDubActorId: integer('lipdub_actor_id'), // For PRO quality videos
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const videos = pgTable('videos', {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: varchar('job_id', { length: 255 }).notNull().unique(), // External job ID for video processing
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('queued'),
    originalUrl: text('original_url'), // Original processed video URL
    cdnUrl: text('cdn_url'), // CDN URL after upload to DigitalOcean Spaces
    thumbnailUrl: text('thumbnail_url'),
    script: text('script').notNull(), // Video script content
    actorId: uuid('actor_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    processingService: varchar('processing_service', { length: 50 }), // 'synclabs' or 'lipdub'
    processingMetadata: jsonb('processing_metadata').$type<{
        syncId?: string;
        lipDubGenerateId?: number;
        audioId?: string;
        errorMessage?: string;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at')
})

export const backofficeUsers = pgTable('backoffice_users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(), // Hashed password
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at')
})

export const usersRelations = relations(users, ({ many }) => ({
    videos: many(videos)
}))

export const actorsRelations = relations(actors, ({ many }) => ({
    videos: many(videos)
}))

export const videosRelations = relations(videos, ({ one }) => ({
    actor: one(actors, {
        fields: [videos.actorId],
        references: [actors.id],
    }),
    user: one(users, {
        fields: [videos.userId],
        references: [users.id],
    })
}))

export const subscriptionLimitsSeedData = [
    { subscriptionId: 29, maxVideos: 10 },
    { subscriptionId: 52, maxVideos: 10 },
    { subscriptionId: 67, maxVideos: 3 },
    { subscriptionId: 68, maxVideos: 10 },
    { subscriptionId: 69, maxVideos: 25 }
]