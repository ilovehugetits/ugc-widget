import { NextResponse } from 'next/server'
import { createUserIfNotExists } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET(request: Request) {
    const headersList = await headers();
    const externalId = headersList.get('x-user-external-id')
    const hash = headersList.get('x-user-hash')
    const subscription = headersList.get('x-user-subscription')

    if (!externalId || !hash) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const user = await createUserIfNotExists({
            externalId,
            subscriptions: subscription ? [subscription] : undefined
        })

        return NextResponse.json({
            userId: user.id,
            externalId: user.externalId,
            hash,
            subscription
        })
    } catch (error) {
        console.error('Error in auth API:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
} 