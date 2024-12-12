import { VideoTabs } from "@/components/video-tabs"
import { getAuthParams, createUserIfNotExists } from "@/lib/auth"
import { db } from "@/db"
import { users, videos } from "@/db/schema"
import { eq, and, not, asc } from "drizzle-orm"
import { Video } from "@/components/video-grid"

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function getVideos(userId: string) {
  'use server'
  
  try {
    const userVideos = await db.select({
      id: videos.id,
      cdnUrl: videos.cdnUrl,
      thumbnailUrl: videos.thumbnailUrl,
      name: videos.name,
      createdAt: videos.createdAt,
      status: videos.status,
      actorId: videos.actorId
    })
      .from(videos)
      .where(
        and(
          eq(videos.userId, userId),
          not(eq(videos.status, 'deleted'))
        )
      )
      .orderBy(asc(videos.createdAt))
    
    return userVideos as Video[]
  } catch (error) {
    console.error('Error fetching videos:', error)
    return []
  }
}

export default async function VideosPage(props: Props) {
  const searchParams = await props.searchParams;
  const { userId: externalId, name, email } = await getAuthParams(searchParams)

  if (!externalId) {
    return null
  }

  // Get user info
  let user = await db.query.users.findFirst({
    where: eq(users.externalId, externalId)
  })

  if (!user) {
    // Create user if not exists
    user = await createUserIfNotExists({
      externalId,
      name,
      email,
      subscriptions: searchParams.subscription ? [searchParams.subscription as string] : undefined
    })
  }

  const videoCount = await db.select({ count: videos.id })
    .from(videos)
    .where(
      and(
        eq(videos.userId, user.id),
        not(eq(videos.status, 'deleted'))
      )
    )
    .execute()

  const videosLeft = user.videoLimit - Number(videoCount?.length || 0)

  return (
    <div className="flex gap-2 flex-col max-w-[1440px] mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between">
        <div className="font-semibold text-[1.53rem] text-[#00254d] flex items-center gap-3">
          AI UGC Video Creator
        </div>
      </div>

      <VideoTabs 
        getVideos={getVideos}
        userId={user.id}
        videosLeft={videosLeft}
      />
    </div>
  )
}