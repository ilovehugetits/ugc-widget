'use client'

import { useState } from 'react'
import { FaPlay } from 'react-icons/fa'
import { useToast } from "@/hooks/use-toast"
import { actors } from '@/db/schema'
import { getActors, createVideo, generateScript } from "@/app/actions"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'

type ActorWithoutRelations = Omit<typeof actors.$inferSelect, 'videos'>

interface Props {
    onBackClick: () => void
}

const categoryEmojis: { [key: string]: string } = {
    'Living Room': '🏠',
    'Car': '🚗',
    'Kitchen': '🍴',
    'Outside': '🌳',
    'Sitting': '🪑',
    'Outdoor': '🌻',
    'Gym': '💪',
    'Coffee': '☕',
    'Pets': '🐕',
    'Laptop': '💻',
    'Book': '📚',
    'Office': '💼',
    'Microphone': '🎤',
    'Walking': '🚶',
    'Bedroom': '🛌',
    'Standing': '🧍',
    'Bathroom': '🚽',
}

export function CreateForm({ onBackClick }: Props) {
    const [activeActor, setActiveActor] = useState<string | null>(null)
    const [selectedActor, setSelectedActor] = useState<string | null>(null)
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const { toast } = useToast()
    const queryClient = useQueryClient()

    const [formData, setFormData] = useState({
        name: '',
        script: '',
        productInfo: '',
        productDesc: ''
    })

    // Fetch actors using server action
    const { data: actors = [] } = useQuery<ActorWithoutRelations[]>({
        queryKey: ['actors'],
        queryFn: getActors
    })

    const actorCategories = [...new Set(actors.flatMap(actor => {
        if (typeof actor.categories === 'string') {
            try {
                return JSON.parse(actor.categories)
            } catch {
                return []
            }
        }

        return actor.categories || []
    }))]
        .filter(category =>
            category &&
            category != "All" &&
            typeof category === 'string'
        )
        .sort();

    // Filter actors based on selected categories
    const filteredActors = actors.filter(actor => {
        if (selectedCategories.length === 0) {
            return true; // Show all actors if no categories are selected
        }

        const actorCats = typeof actor.categories === 'string'
            ? JSON.parse(actor.categories)
            : actor.categories || [];

        // Check if any selected category matches the actor's categories
        return selectedCategories.some(category =>
            actorCats.includes(category)
        );
    });

    // Create video mutation
    const createMutation = useMutation({
        mutationFn: async (data: typeof formData & { actorId: string }) => {
            const searchParams = new URLSearchParams(window.location.search)
            const userId = searchParams.get('user_id')
            const hash = searchParams.get('hash')

            if (!userId || !hash) {
                throw new Error('Missing authentication parameters')
            }

            return createVideo({
                name: data.name,
                script: data.script,
                actorId: data.actorId,
                userId,
                hash
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] })
            const videosButton = document.querySelector('[value="videos"]') as HTMLButtonElement
            videosButton?.click()
            toast({
                title: "Video creation started.",
                description: "Your video will be ready in 3-7 minutes."
            })
        },
        onError: () => {
            toast({
                variant: "destructive",
                title: "Failed to create video",
                description: "Please try again later."
            })
        }
    })

    // Generate script mutation
    const generateScriptMutation = useMutation({
        mutationFn: async (data: { productInfo: string; productDesc: string }) => {
            return generateScript(data)
        },
        onSuccess: (data) => {
            setFormData(prev => ({ ...prev, script: data }))
            setIsModalOpen(false)
            toast({ title: "Script generated successfully" })
        },
        onError: () => {
            toast({
                variant: "destructive",
                title: "Failed to generate script",
                description: "Please try again later."
            })
        }
    })

    const handleGenerateScript = () => {
        if (!formData.productInfo.trim()) {
            toast({
                variant: "destructive",
                title: "Please enter product information"
            })
            return
        }

        generateScriptMutation.mutate({
            productInfo: formData.productInfo,
            productDesc: formData.productDesc
        })
    }

    const handleSubmit = () => {
        if (!formData.name || !formData.script || !selectedActor) {
            toast({
                variant: "destructive",
                title: "Please fill all required fields"
            })
            return
        }

        createMutation.mutate({
            ...formData,
            actorId: selectedActor
        })
    }

    return (
        <TooltipProvider>
            <div className="min-h-[75vh] md:max-h-[75vh] md:h-[75vh] overflow-hidden grid grid-cols-1 md:grid-cols-12">
                {/* Left side - Form */}
                <div className="flex-1 w-full flex flex-col justify-between p-6 py-5 gap-5 col-span-6">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-black mb-1">Name</label>
                            <Input
                                value={formData.name}
                                placeholder="Enter video name..."
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.slice(0, 100) }))}
                                className="pr-40 font-medium text-[#64748B] placeholder:text-[#64748B] placeholder:opacity-80"
                            />
                        </div>

                        <div className="flex flex-col gap-1 relative">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-black">Script</label>
                                <Button
                                    onClick={() => setIsModalOpen(true)}
                                    variant="outline"
                                    className="px-2 h-auto !py-1 text-[#64748B] rounded hover:text-white hover:bg-[#64748B] text-xs"
                                >
                                    Generate With AI
                                </Button>
                            </div>
                            <Textarea
                                value={formData.script}
                                onChange={(e) => {
                                    const filteredValue = e.target.value.replace(/[™©®]/g, '');
                                    setFormData(prev => ({ 
                                        ...prev, 
                                        script: filteredValue.slice(0, 1000) 
                                    }));
                                }}
                                placeholder="Type your script here..."
                                className="min-h-[200px] font-medium text-[#64748B] placeholder:text-[#64748B] placeholder:opacity-80"
                            />
                            <div className="flex items-center justify-end mt-1">
                                <div className="text-[13px] font-medium text-[#9C9C9C]">
                                    <span className="text-[#565656]">{formData.script.length}</span>/1000
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handleSubmit}
                            disabled={createMutation.isPending}
                            className="w-[120px] bg-[#046AD4] h-14 hover:bg-[#0069d9] rounded-[8px] font-normal"
                            size="big"
                        >
                            {createMutation.isPending ? "Creating..." : "Create"}
                        </Button>
                        <Button
                            onClick={onBackClick}
                            variant="outline"
                            className="w-[120px] h-14 rounded-[8px] font-normal border-gray-600 hover:bg-gray-600 hover:text-white text-gray-600"
                            size="big"
                        >
                            Back
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col w-full border-l-[1.5px] p-6 py-5 w-full flex-1 h-[75vh] min-h-[75vh] max-h-[75vh] col-span-6 relative">
                    <div className="gap-2 top-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 mb-2">
                        <div className="font-medium text-[16px] text-[#565656] col-span-2">Categories:</div>
                        <div className="col-span-2 mb-2 lg:col-span-3 md:col-span-2 sm:col-span-3 flex gap-2 items-center flex-wrap">
                            {actorCategories.filter(category => category != 'All ').filter(category => category != 'All').map((category) => (
                                <div
                                    key={category}
                                    onClick={() => {
                                        setActiveActor(null)
                                        setSelectedCategories(prev =>
                                            prev.includes(category)
                                                ? prev.filter(c => c !== category)
                                                : [...prev, category]
                                        )
                                    }}
                                    className={`cursor-pointer px-3 py-1 rounded-full text-sm font-medium transition-all ${selectedCategories.includes(category)
                                        ? 'bg-[#046AD4] text-white'
                                        : 'bg-[#F4F4F4] text-[#727272] hover:bg-[#046AD4] hover:bg-opacity-10'
                                        }`}
                                >
                                    {categoryEmojis[category] || '🏷️'} {category}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="scrollBar overflow-y-auto flex-1">
                        <div className="gap-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
                            {filteredActors.map(actor => (
                                <div
                                    key={actor.id}
                                    className="transition-all overflow-hidden aspect-[5/7] h-max group rounded-[8px] relative flex flex-col"
                                >
                                    {activeActor === actor.name ? (
                                        <video
                                            className="w-full h-full object-cover"
                                            src={actor.url}
                                            autoPlay
                                            controls
                                        />
                                    ) : (
                                        <>
                                            <Image
                                                src={actor.thumbnail}
                                                alt={actor.name}
                                                className="w-full h-full object-cover"
                                                width={200}
                                                height={200}
                                            />
                                            <div
                                                className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center cursor-pointer"
                                                onClick={() => setActiveActor(actor.name)}
                                            >
                                                <FaPlay className="text-white text-2xl" />
                                            </div>
                                        </>
                                    )}

                                    {activeActor === actor.name ? (
                                        <div className="absolute left-0 top-0 px-3 py-2.5 w-full flex gap-1 flex-col flex-wrap">
                                            <div className="text-white line-clamp-2 font-medium text-[14px]">
                                                {actor.name}
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                {actor.lipDubActorId && (
                                                    <div className="flex">
                                                        <Tooltip delayDuration={0}>
                                                            <TooltipTrigger asChild>
                                                                <div className="flex cursor-pointer text-sm font-medium items-center justify-center px-2 rounded bg-yellow-600 text-white">
                                                                    PRO
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="mb-4 w-64 p-4 text-sm">
                                                                <p>Pro actors deliver higher-quality outputs with more refined performances.</p>
                                                                <p className="mt-2 font-semibold">Note: Processing may take slightly longer.</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="absolute left-0 bottom-0 p-2 px-3 w-full">
                                                <div className="text-white line-clamp-2 font-medium text-[14px]">
                                                    {actor.name}
                                                </div>
                                            </div>
                                            {actor.lipDubActorId && (
                                                <div className="absolute left-0 top-0 p-3">
                                                    <Tooltip delayDuration={0}>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex cursor-pointer text-sm font-medium items-center justify-center px-2 rounded bg-yellow-600 text-white">
                                                                PRO
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="mb-4 w-64 p-4 text-sm">
                                                            <p>Pro actors deliver higher-quality outputs with more refined performances.</p>
                                                            <p className="mt-2 font-semibold">Note: Processing may take slightly longer.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div
                                        className="absolute right-3 top-2.5 text-white cursor-pointer transition-all"
                                        onClick={() => setSelectedActor(actor.id)}
                                    >
                                        {selectedActor === actor.id ? (
                                            <svg className="shadow-xl" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M10 0C4.48622 0 0 4.48622 0 10C0 15.5138 4.48622 20 10 20C15.5138 20 20 15.5138 20 10C20 4.48622 15.5138 0 10 0ZM15.589 7.36842L9.198 13.7093C8.82206 14.0852 8.22055 14.1103 7.81955 13.7343L4.43609 10.6516C4.03509 10.2757 4.01003 9.64912 4.3609 9.24812C4.73684 8.84712 5.36341 8.82206 5.76441 9.198L8.44612 11.6541L14.1604 5.93985C14.5614 5.53885 15.188 5.53885 15.589 5.93985C15.99 6.34085 15.99 6.96742 15.589 7.36842Z" fill="white" />
                                            </svg>
                                        ) : (
                                            <svg className="shadow-xl" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <rect x="0.8" y="0.8" width="18.4" height="18.4" rx="9.2" stroke="white" strokeWidth="1.6" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Script Generation Modal */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="sm:max-w-[624px] p-0 !rounded-[16px]">
                        <DialogHeader className="border-b border-[#E2E8F0] p-6 pb-5">
                            <DialogTitle className="flex items-center gap-3">
                                <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M7.65387 4.65964L8.34213 6.57102C9.10669 8.69239 10.7772 10.3629 12.8986 11.1275L14.81 11.8157C14.9822 11.8783 14.9822 12.1226 14.81 12.1843L12.8986 12.8726C10.7772 13.6371 9.10669 15.3076 8.34213 17.429L7.65387 19.3404C7.5913 19.5127 7.34702 19.5127 7.28531 19.3404L6.59704 17.429C5.83249 15.3076 4.16196 13.6371 2.04059 12.8726L0.129211 12.1843C-0.0430703 12.1217 -0.0430703 11.8774 0.129211 11.8157L2.04059 11.1275C4.16196 10.3629 5.83249 8.69239 6.59704 6.57102L7.28531 4.65964C7.34702 4.4865 7.5913 4.4865 7.65387 4.65964Z" fill="url(#paint0_linear_14_482)" />
                                    <path d="M16.2577 0.0662125L16.6065 1.0339C16.9939 2.10787 17.8399 2.95385 18.9139 3.34127L19.8816 3.69011C19.969 3.72183 19.969 3.84525 19.8816 3.87697L18.9139 4.22581C17.8399 4.61323 16.9939 5.45921 16.6065 6.53318L16.2577 7.50087C16.226 7.5883 16.1025 7.5883 16.0708 7.50087L15.722 6.53318C15.3346 5.45921 14.4886 4.61323 13.4146 4.22581L12.4469 3.87697C12.3595 3.84525 12.3595 3.72183 12.4469 3.69011L13.4146 3.34127C14.4886 2.95385 15.3346 2.10787 15.722 1.0339L16.0708 0.0662125C16.1025 -0.0220708 16.2268 -0.0220708 16.2577 0.0662125Z" fill="url(#paint1_linear_14_482)" />
                                    <defs>
                                        <linearGradient id="paint0_linear_14_482" x1="0" y1="11.9997" x2="14.9392" y2="11.9997" gradientUnits="userSpaceOnUse">
                                            <stop stopColor="#4776E6" />
                                            <stop offset="1" stopColor="#8E54E9" />
                                        </linearGradient>
                                        <linearGradient id="paint1_linear_14_482" x1="12.3813" y1="3.78322" x2="19.9471" y2="3.78322" gradientUnits="userSpaceOnUse">
                                            <stop stopColor="#4776E6" />
                                            <stop offset="1" stopColor="#8E54E9" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                Generate AI Script
                            </DialogTitle>
                        </DialogHeader>

                        <div className="px-6 pb-6">
                            <div className="text-lg text-[#565656] font-medium mb-1.5">Product Name</div>
                            <Input
                                type="text"
                                placeholder="Enter product title..."
                                value={formData.productInfo}
                                onChange={(e) => setFormData(prev => ({ ...prev, productInfo: e.target.value }))}
                                className="mb-4"
                            />

                            <div className="text-lg text-[#565656] font-medium mb-1.5">Product Description</div>
                            <Textarea
                                placeholder="Enter product description..."
                                value={formData.productDesc}
                                onChange={(e) => setFormData(prev => ({ ...prev, productDesc: e.target.value }))}
                                className="mb-4"
                                rows={5}
                            />

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-[184px] border-red-600 text-red-600 font-normal hover:bg-red-600 hover:text-white rounded-[6px]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleGenerateScript}
                                    disabled={generateScriptMutation.isPending}
                                    className="w-[184px] bg-[#046AD4] hover:bg-[#0069d9] font-normal gap-2 rounded-[6px]"
                                >
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <g clipPath="url(#clip0_14_504)">
                                            <path d="M14 4.00001C14 2.8954 14.8954 2 16 2C14.8955 2 14 1.10457 14 0C14 1.10454 13.1046 2 12 2C13.1045 2 14 2.89537 14 4.00001Z" fill="white" />
                                            <path d="M14.5 6C14.5 6.82841 13.8284 7.5 13 7.5C13.8284 7.5 14.5 8.17158 14.5 8.99999C14.5 8.17154 15.1716 7.5 16 7.5C15.1715 7.50003 14.5 6.82845 14.5 6Z" fill="white" />
                                            <path d="M6.99999 5.99998C6.99999 4.34312 8.34312 2.99999 9.99998 2.99999C8.34312 2.99999 6.99999 1.65686 6.99999 0C6.99999 1.65686 5.65686 2.99999 4 2.99999C5.65686 2.99999 6.99999 4.34315 6.99999 5.99998Z" fill="white" />
                                            <path d="M11 3L0 14L2 16L13 5L11 3ZM9.29297 6.20704L10.707 4.79299L11.207 5.293L9.79297 6.70704L9.29297 6.20704Z" fill="white" />
                                        </g>
                                        <defs>
                                            <clipPath id="clip0_14_504">
                                                <rect width="16" height="16" fill="white" />
                                            </clipPath>
                                        </defs>
                                    </svg>
                                    {generateScriptMutation.isPending ? 'Generating...' : 'Generate AI Script'}
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>

                <style jsx>{`
        .scrollBar::-webkit-scrollbar {
          width: 9px;
        }
        .scrollBar::-webkit-scrollbar-track {
          background: #F4F4F4;
          border-radius: 10px;
        }
        .scrollBar::-webkit-scrollbar-thumb {
          background: #0C5EB3;
          border-radius: 10px;
        }
      `}</style>
            </div>
        </TooltipProvider>
    )
}