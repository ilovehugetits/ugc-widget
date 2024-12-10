import { getAuthParams } from '@/lib/auth'
import { RedirectButton } from '@/components/redirect-button'

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function HomePage(props: Props) {
    const searchParams = await props.searchParams;
    const { userId, hash, subscription } = await getAuthParams(searchParams)

    if (!userId || !hash) {
        return <RedirectButton/>
    }

    const params = new URLSearchParams()
    params.set('user_id', userId)
    params.set('hash', hash)
    if (subscription) {
        params.set('subscription', subscription)
    }
}