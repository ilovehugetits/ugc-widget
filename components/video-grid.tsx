// components/video-grid.tsx
'use client'

import { useState } from 'react'
import { FaPlay, FaEllipsisV } from 'react-icons/fa'
import { useToast } from "@/hooks/use-toast"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useQuery, useMutation } from '@tanstack/react-query'
import { deleteVideo } from "@/app/actions"
import axios from 'axios'

import {
    Download,
    Trash,
    FileText,
    Copy,
    Check
} from 'lucide-react';

export interface Video {
    id: string
    videoUrl: string
    thumbnailUrl: string
    name: string
    createdAt: Date
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'deleted'
    actorId: string
    script?: string
}

interface Props {
    getVideos: () => Promise<Video[]>
    onCreateClick: () => void
}

export function VideoGrid({ getVideos, onCreateClick }: Props) {
    const [activeVideo, setActiveVideo] = useState<string | null>(null)
    const [videoToDelete, setVideoToDelete] = useState<string | null>(null)
    const [scriptToView, setScriptToView] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const { toast } = useToast()

    const { data: videos = [], refetch } = useQuery<Video[]>({
        queryKey: ['videos'],
        queryFn: getVideos,
        refetchInterval: 10000
    })

    const deleteMutation = useMutation({
        mutationFn: async (videoId: string) => {
            const result = await deleteVideo(videoId)
            if (!result.success) {
                throw new Error(result.error || 'Failed to delete video')
            }
        },
        onSuccess: () => {
            refetch()
            toast({
                title: "Video deleted successfully"
            })
            setVideoToDelete(null)
        },
        onError: (error) => {
            toast({
                variant: "destructive",
                title: "Failed to delete video",
                description: error instanceof Error ? error.message : "Please try again later."
            })
        }
    })

    const handleThumbnailClick = (videoId: string, status: string) => {
        if (status === 'completed') {
            setActiveVideo(videoId)
        }
    }

    const handleDownloadClick = async (url: string, jobId: string) => {
        try {
            const response = await axios.get(url, {
                responseType: 'blob'
            })
            const blob = new Blob([response.data], { type: 'video/mp4' })
            const downloadUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = `video_${jobId}.mp4`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(downloadUrl)
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Download failed",
                description: "Please try again later."
            })
        }
    }

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy text:', err)
        }
    }

    if (videos.length === 0) {
        return (
            <div className="gap-3 w-full grid lg:grid-cols-5 md:grid-cols-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5">
                <div
                    onClick={onCreateClick}
                    className="aspect-[9/16] cursor-pointer group overflow-hidden bg-[#046AD4] bg-opacity-5 rounded-xl relative border-[1.5px] border-[#046AD44D] flex items-center justify-center"
                >
                    <div className='text-center'>
                        <svg className="text-[#046AD4] text-4xl mb-2 mx-auto" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 24C11.6892 24 11.3911 23.8765 11.1714 23.6568C10.9516 23.437 10.8281 23.1389 10.8281 22.8281V1.17188C10.8281 0.861074 10.9516 0.563003 11.1714 0.343234C11.3911 0.123465 11.6892 0 12 0C12.3108 0 12.6089 0.123465 12.8286 0.343234C13.0484 0.563003 13.1719 0.861074 13.1719 1.17188V22.8281C13.1719 23.1389 13.0484 23.437 12.8286 23.6568C12.6089 23.8765 12.3108 24 12 24Z" fill="#046AD4" />
                            <path d="M22.8281 13.1719H1.17188C0.861074 13.1719 0.563003 13.0484 0.343234 12.8286C0.123465 12.6089 0 12.3108 0 12C0 11.6892 0.123465 11.3911 0.343234 11.1714C0.563003 10.9516 0.861074 10.8281 1.17188 10.8281H22.8281C23.1389 10.8281 23.437 10.9516 23.6568 11.1714C23.8765 11.3911 24 11.6892 24 12C24 12.3108 23.8765 12.6089 23.6568 12.8286C23.437 13.0484 23.1389 13.1719 22.8281 13.1719Z" fill="#046AD4" />
                        </svg>

                        <div className='text-[#046AD4] font-semibold select-none'>Create New</div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="gap-3 w-full grid lg:grid-cols-5 md:grid-cols-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5">
                {videos.reverse().map(video => (
                    <div key={video.id} className="group overflow-hidden rounded-xl relative">
                        <div className="aspect-[9/16] relative">
                            {activeVideo === video.id ? (
                                <video
                                    className="aspect-[4/6] w-full h-full rounded-xl"
                                    src={video.videoUrl.includes("https://") ? video.videoUrl : "https://" + video.videoUrl}
                                    autoPlay
                                    controls
                                />
                            ) : (
                                <>
                                    <img
                                        src={video.thumbnailUrl || 'https://ugc-storage.sfo3.digitaloceanspaces.com/thumbnail/default-thumb.jpg'}
                                        alt="Video thumbnail"
                                        className="aspect-[4/6] w-full h-full object-cover rounded-xl"
                                    />
                                    <div
                                        className="absolute inset-0 bg-black rounded-xl bg-opacity-50 flex items-center justify-center cursor-pointer"
                                        onClick={() => handleThumbnailClick(video.id, video.status)}
                                    >
                                        {video.status === 'completed' ? (
                                            <div className="flex flex-col bg-white/20 rounded-full h-12 w-12 backdrop-blur-sm items-center justify-center">
                                                <FaPlay className="text-white h-5 h-5 pl-0.5" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="text-white text-xl leading-6 text-center font-semibold px-4 mb-1">
                                                    Generating Video..
                                                </div>
                                                <div className="text-sm px-4 text-white text-center text-opacity-80">
                                                    This may take 3-7 minutes. You can close this tab and return later.
                                                </div>
                                                <div className="w-3/4 mt-4 bg-gray-200 rounded-full h-2 dark:bg-gray-700 overflow-hidden">
                                                    <div className="bg-[#0069d9] h-2 rounded-full loading-bar"></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                            <div className="absolute z-50 right-2 top-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            className="h-7 w-7 bg-white/20 hover:bg-white/20 text-white hover:text-neutral-200 rounded-lg backdrop-blur-sm"
                                        >
                                            <FaEllipsisV className='text-xs !h-3.5 !size-2' size={6}/>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                        {video.status === 'completed' && (
                                            <DropdownMenuItem
                                                onClick={() => handleDownloadClick(video.videoUrl, video.id)}
                                                className="cursor-pointer text-sm"
                                            >
                                                <Download className="h-4 w-4 mr-1.5" />
                                                Download
                                            </DropdownMenuItem>
                                        )}
                                        {video.script && (
                                            <DropdownMenuItem
                                                onClick={() => setScriptToView(video.script || '')}
                                                className="cursor-pointer text-sm"
                                            >
                                                <FileText className="h-4 w-4 mr-1.5" />
                                                View Script
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                            onClick={() => setVideoToDelete(video.id)}
                                            className="cursor-pointer text-sms text-destructive focus:text-destructive"
                                        >
                                            <Trash className="h-4 w-4 mr-1.5" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        <div className="text-center w-full mt-2">
                            <div className="text-[#727272] text-[15px] font-medium line-clamp-1">
                                {video.name.charAt(0).toUpperCase() + video.name.slice(1)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={!!scriptToView} onOpenChange={() => setScriptToView(null)}>
                <DialogContent className="sm:max-w-[525px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span>Video Script</span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 gap-1.5"
                                onClick={() => scriptToView && handleCopy(scriptToView)}
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4" />
                                        <span>Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4" />
                                        <span>Copy</span>
                                    </>
                                )}
                            </Button>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                            {scriptToView}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setScriptToView(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!videoToDelete} onOpenChange={() => setVideoToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this video?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVideoToDelete(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => videoToDelete && deleteMutation.mutate(videoToDelete)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
        .loading-bar {
          width: 50%;
          animation: loading 1.5s ease-in-out infinite;
        }
      `}</style>
        </>
    )
}