import { db } from '@/db'
import { users, subscriptionLimits } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
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
    const { externalId, subscriptions: _userSubscriptions = [], email, name } = params

    const userSubscriptions = JSON.parse(_userSubscriptions[0]);

    const existingUser = await db.query.users.findFirst({
        where: eq(users.externalId, externalId)
    })

    if (existingUser) {
        return existingUser
    }

    let videoLimit = 0

    if (userSubscriptions.length > 0) {
        const subIds = userSubscriptions.map(Number).filter((id: number) => !isNaN(id))
        const subscriptions = await db.select()
            .from(subscriptionLimits)
            .where(inArray(subscriptionLimits.subscriptionId, subIds))

        if (subscriptions.length > 0) {
            videoLimit = Math.max(...subscriptions.map(s => s.maxVideos))
        }
    }

    const [newUser] = await db.insert(users).values({
        externalId,
        videoLimit,
        email,
        name,
        membershipStart: new Date()
    }).returning()

    return newUser
}

export async function validateAuth(params: SearchParamsType): Promise<boolean> {
    const { user_id, hash } = params

    if (!user_id || !hash) {
        return false
    }

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