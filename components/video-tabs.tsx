'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VideoGrid } from "@/components/video-grid"
import { CreateForm } from "@/components/create-form"
import { useState } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Props {
  getVideos: (userId: string) => Promise<any[]>
  userId: string
  videosLeft: number
}

export function VideoTabs({ getVideos, userId, videosLeft }: Props) {
  const [activeTab, setActiveTab] = useState("videos")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="flex flex-col-reverse md:flex-row gap-y-4 items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="videos">All Videos</TabsTrigger>
          <TabsTrigger value="create">Create Video</TabsTrigger>
        </TabsList>
        
        <div className="flex items-center gap-4">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="px-6 py-2 border-[1.5px] border-[#0069d9] bg-transparent text-[#0069d9] text-center text-[0.9rem] transition-all bg-[#E5E5E5] rounded-[6px] cursor-pointer">
                  {videosLeft} videos left
                </div>
              </TooltipTrigger>
              <TooltipContent className="p-4 px-5 text-sm max-w-64 flex flex-col">
                <p>Need more? Click below to purchase additional credits.</p>
                <a href="https://clients.bandsoffads.com/portal/subscriptions" target="_blank" className="font-semibold mt-2 text-[#0069d9]">Buy More Credits</a>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <TabsContent value="videos">
        <VideoGrid 
          getVideos={() => getVideos(userId)}
          onCreateClick={() => setActiveTab("create")}
        />
      </TabsContent>

      <TabsContent value="create" className="bg-white rounded-[6px]">
        <CreateForm 
          onBackClick={() => setActiveTab("videos")}
        />
      </TabsContent>
    </Tabs>
  )
} 