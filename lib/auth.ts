import { db } from '@/db'
import { users, subscriptionLimits } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createHash } from './crypto'

type SearchParamsType = { [key: string]: string | string[] | undefined }

export async function getAuthParams(searchParams: SearchParamsType) {
    const userId = searchParams.user_id as string | undefined
    const hash = searchParams.hash as string | undefined
    const subscription = searchParams.subscription as string | undefined
    const email = searchParams.email as string | undefined
    const name = searchParams.name as string | undefined

    return {
        userId,
        hash,
        subscription,
        email,
        name
    }
}

export async function createUserIfNotExists(params: {
    externalId: string,
    subscriptions?: string[],
    email?: string,
    name?: string
}) {
    const { externalId, subscriptions = [], email, name } = params

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
        where: eq(users.externalId, externalId)
    })

    if (existingUser) {
        return existingUser
    }

    // Find highest video limit from subscriptions
    let videoLimit = 0 // Default limit
    if (subscriptions.length > 0) {
        const subIds = subscriptions.map(Number).filter(id => !isNaN(id))
        if (subIds.length > 0) {
            const limits = await db.select()
                .from(subscriptionLimits)
                .where(eq(subscriptionLimits.subscriptionId, subIds[0]))

            if (limits.length > 0) {
                videoLimit = Math.max(...limits.map(l => l.maxVideos))
            }
        }
    }

    // Create new user
    const [newUser] = await db.insert(users).values({
        externalId,
        videoLimit,
        email,
        name,
        lastActivityAt: new Date()
    }).returning()

    return newUser
}

export async function validateAuth(params: SearchParamsType): Promise<boolean> {
    const { user_id, hash } = params

    if (!user_id || !hash) {
        return false
    }

    // Hash doğrulaması yap
    const secretKey = process.env.AUTH_SECRET_KEY!
    const expectedHash = await createHash(user_id as string, secretKey)
    
    return hash === expectedHash
}

export async function withAuthParams(url: string, searchParams: SearchParamsType) {
    const { userId, hash, subscription } = await getAuthParams(searchParams)

    if (!userId || !hash) return url

    const params = new URLSearchParams()
    params.set('user_id', userId)
    params.set('hash', hash)
    if (subscription) {
        params.set('subscription', subscription)
    }

    return `${url}?${params.toString()}`
}