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

export const subscriptionLimits = pgTable('subscription_limits', {
    subscriptionId: integer('subscription_id').primaryKey(),  // External subscription ID
    maxVideos: integer('max_videos').notNull()
})

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    externalId: varchar('external_id', { length: 255 }).notNull().unique(), // Parent system user ID
    videoLimit: integer('video_limit').notNull().default(10),
    email: varchar('email', { length: 255 }),
    name: varchar('name', { length: 255 }),
    membershipStart: timestamp('membership_start'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const actors = pgTable('actors', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    previewVideo: text('preview_video').notNull(),
    sourceVideo: text('source_video').notNull(),
    thumbnail: text('thumbnail').notNull(),
    categories: text('categories').array().notNull().default([]),
    status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, published, deleted
    displayOrder: integer('display_order').notNull().default(0),
    voiceId: varchar('voice_id', { length: 255 }),
    actorId: varchar('actor_id', { length: 255 }),
    provider: varchar('provider', { length: 20 }).notNull().default('lipdub'), // lipdub, captions
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const videos = pgTable('videos', {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: varchar('job_id', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('queued'),
    originalUrl: text('original_url'),
    videoUrl: text('video_url'),
    thumbnailUrl: text('thumbnail_url'),
    script: text('script').notNull(),
    actorId: uuid('actor_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    provider: varchar('provider', { length: 50 }), // 'lipdub' or 'captions'
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()   
})

export const backofficeUsers = pgTable('backoffice_users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
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