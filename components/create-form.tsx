'use client'

import { useState, useEffect, useCallback } from 'react'
import { FaPlay } from 'react-icons/fa'
import { useToast } from "@/hooks/use-toast"
import { actors } from '@/db/schema'
import { getActors, createVideo, generateScript, generateAudioPreview } from "@/app/actions"
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
import { Slider } from "@/components/ui/slider";
import { useRateLimit } from "@/hooks/use-rate-limit"
import { useTabContext } from './video-tabs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AudioUpload } from "./audio-upload"
import { useAudioUpload } from "@/contexts/audio-upload-context"

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

type ScriptStyle = {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
};

const SCRIPT_STYLES: ScriptStyle[] = [
    {
        id: 'regular',
        name: 'Regular',
        description: 'A straightforward, professional presentation of your product',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 6h8M8 12h8M8 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        )
    },
    {
        id: 'storytelling',
        name: 'Storytelling',
        description: 'An engaging narrative that connects emotionally with viewers',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 6.5c2.5-3 7.5-3 7.5-3s0 5-2.5 8M12 6.5C9.5 3.5 4.5 3.5 4.5 3.5s0 5 2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 6.5V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        )
    },
    {
        id: 'casual',
        name: 'Casual',
        description: 'A relaxed, friendly tone that feels more personal',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            </svg>
        )
    }
];

export function CreateForm({ onBackClick }: Props) {
    const [activeActor, setActiveActor] = useState<string | null>(null)
    const [selectedActor, setSelectedActor] = useState<string | null>(null)
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const { setActiveTab } = useTabContext()

    const [formData, setFormData] = useState({
        name: '',
        script: '',
        productInfo: '',
        productDesc: ''
    })

    const [audioSettings, setAudioSettings] = useState({
        stability: 0.1,
        similarity: 0.3,
        style: 0.2
    });
    const [previewAudio, setPreviewAudio] = useState<string | null>(null);

    const { canMakeRequest, incrementRequestCount } = useRateLimit('audio_preview', 20);

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
        mutationFn: async (data: typeof formData & { actorId: string, audioUrl?: string }) => {
            const searchParams = new URLSearchParams(window.location.search)
            const userId = searchParams.get('user_id')
            const hash = searchParams.get('hash')
            const userName = searchParams.get('name')
            const userEmail = searchParams.get('email')

            if (!userId || !hash) {
                throw new Error('Missing authentication parameters')
            }

            return createVideo({
                name: data.name,
                script: data.script,
                actorId: data.actorId,
                userId,
                hash,
                userName: userName || '',
                userEmail: userEmail || '',
                audioUrl: data.audioUrl
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] })

            toast({
                title: "Video creation started.",
                description: "Your video will be ready in 3-7 minutes."
            })

            setActiveTab("videos")
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
        mutationFn: async (data: {
            productInfo: string;
            productDesc: string;
            style: string;
        }) => {
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

    const generatePreviewMutation = useMutation({
        mutationFn: async () => {
            if (!formData.script || !selectedActor) {
                throw new Error('Script and actor selection are required');
            }

            const audioStream = await generateAudioPreview(
                formData.script,
                actors.find(a => a.id === selectedActor)?.voiceId || '',
                audioSettings
            );

            return audioStream;
        },
        onSuccess: (audioStream) => {
            const audioUrl = `data:audio/mpeg;base64,${audioStream}`;
            setPreviewAudio(audioUrl);
            incrementRequestCount();
            toast({ title: "Audio preview generated successfully" });
        },
        onError: (error) => {
            toast({
                variant: "destructive",
                title: "Failed to generate audio preview",
                description: error instanceof Error ? error.message : "Please try again later."
            });
        }
    });

    const handleGeneratePreview = () => {
        if (!selectedActor) {
            toast({
                variant: "destructive",
                title: "Actor selection required",
                description: "Please select an actor before generating preview"
            });
            return;
        }

        if (!formData.script.trim()) {
            toast({
                variant: "destructive",
                title: "Script is required",
                description: "Please enter a script before generating preview"
            });
            return;
        }

        if (!canMakeRequest) {
            toast({
                variant: "destructive",
                title: "Rate limit exceeded",
                description: "You can only generate 10 previews per hour"
            });
            return;
        }

        generatePreviewMutation.mutate();
    };

    useEffect(() => {
        return () => {
            if (previewAudio) {
                URL.revokeObjectURL(previewAudio);
            }
        };
    }, [previewAudio]);

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
            productDesc: formData.productDesc,
            style: selectedStyle
        })
    }

    const [activeInputTab, setActiveInputTab] = useState<"script" | "audio">("script")
    const { audioUrl } = useAudioUpload()

    const handleSubmit = () => {
        if (!formData.name || !selectedActor) {
            toast({
                variant: "destructive",
                title: "Please fill all required fields"
            })
            return
        }

        if (activeInputTab === "script" && !formData.script) {
            toast({
                variant: "destructive",
                title: "Please enter a script"
            })
            return
        }

        if (activeInputTab === "audio" && !audioUrl) {
            toast({
                variant: "destructive",
                title: "Please upload an audio file"
            })
            return
        }

        createMutation.mutate({
            ...formData,
            actorId: selectedActor,
            audioUrl: activeInputTab === "audio" ? audioUrl || undefined : undefined
        })
    }

    const [selectedStyle, setSelectedStyle] = useState<string>('regular');

    // Add this state to track hover timer
    const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null)

    // Add new state to track if video was activated by hover
    const [isHoverActivated, setIsHoverActivated] = useState(false)

    // Add these handlers for hover events
    const handleActorHover = useCallback((actorName: string) => {
        const timer = setTimeout(() => {
            setActiveActor(actorName)
            setIsHoverActivated(true)  // Mark that this was activated by hover
        }, 500)

        setHoverTimer(timer)
    }, [])

    // Update handleActorHoverEnd to only clear activeActor if it was hover-activated
    const handleActorHoverEnd = useCallback(() => {
        if (hoverTimer) {
            clearTimeout(hoverTimer)
            setHoverTimer(null)
        }
        if (isHoverActivated) {
            setActiveActor(null)
            setIsHoverActivated(false)
        }
    }, [hoverTimer, isHoverActivated])

    // Update the click handler to set isHoverActivated to false
    const handlePlayClick = (actorName: string) => {
        setActiveActor(actorName)
        setIsHoverActivated(false)  // Mark that this was activated by click
    }

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            if (hoverTimer) {
                clearTimeout(hoverTimer)
            }
        }
    }, [hoverTimer])

    return (
        <TooltipProvider>
            <div className="h-full overflow-hidden grid grid-cols-1 md:grid-cols-12">
                {/* Left side - Form */}
                <div className="flex-1 w-full flex flex-col justify-between order-last md:order-first p-6 py-5 gap-5 col-span-6">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-black mb-1">
                                Name <span className="text-red-500">*</span>
                            </label>
                            <Input
                                value={formData.name}
                                placeholder="Enter video name..."
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.slice(0, 100) }))}
                                className="pr-40 font-medium text-[#64748B] placeholder:text-[#64748B] placeholder:opacity-80"
                            />
                        </div>

                        <Tabs value={activeInputTab} onValueChange={(value) => setActiveInputTab(value as "script" | "audio")}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="script">Script</TabsTrigger>
                                <TabsTrigger value="audio">Upload Audio</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="script" className="space-y-4">
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
                                    <div className="flex items-center justify-end mt-1 absolute -bottom-6 right-0">
                                        <div className="text-[13px] font-medium text-[#9C9C9C]">
                                            <span className="text-[#565656]">{formData.script.length}</span>/1000
                                        </div>
                                    </div>
                                </div>

                                {/* Audio Settings Section */}
                                {activeInputTab === "script" && (
                                    <div className="flex flex-col gap-1">
                                        <label className="font-semibold text-black">Audio Settings</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Left Column - Sliders */}
                                            <div className="flex flex-col gap-4">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between">
                                                        <div className="flex items-center gap-1">
                                                            <label className="text-xs text-gray-600">Stability</label>
                                                            <Tooltip delayDuration={0}>
                                                                <TooltipTrigger asChild>
                                                                    <svg className="w-3.5 h-3.5 text-gray-500 cursor-pointer" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-[200px] text-xs">
                                                                    Adjusts how stable the voice sounds. Lower values make speech more dynamic and expressive, while higher values keep it more consistent and monotone.
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                        <span className="text-xs text-gray-600">{audioSettings.stability.toFixed(1)}</span>
                                                    </div>
                                                    <Slider
                                                        value={[audioSettings.stability]}
                                                        min={0.1}
                                                        max={1.0}
                                                        step={0.1}
                                                        onValueChange={([value]) => setAudioSettings(prev => ({ ...prev, stability: value }))}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between">
                                                        <div className="flex items-center gap-1">
                                                            <label className="text-xs text-gray-600">Similarity</label>
                                                            <Tooltip delayDuration={0}>
                                                                <TooltipTrigger asChild>
                                                                    <svg className="w-3.5 h-3.5 text-gray-500 cursor-pointer" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-[200px] text-xs">
                                                                    Controls how closely the generated voice matches the selected actor's original tone and pronunciation. Lower values allow more creative freedom, while higher values prioritize accuracy.
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                        <span className="text-xs text-gray-600">{audioSettings.similarity.toFixed(1)}</span>
                                                    </div>
                                                    <Slider
                                                        value={[audioSettings.similarity]}
                                                        min={0.1}
                                                        max={1.0}
                                                        step={0.1}
                                                        onValueChange={([value]) => setAudioSettings(prev => ({ ...prev, similarity: value }))}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between">
                                                        <div className="flex items-center gap-1">
                                                            <label className="text-xs text-gray-600">Style</label>
                                                            <Tooltip delayDuration={0}>
                                                                <TooltipTrigger asChild>
                                                                    <svg className="w-3.5 h-3.5 text-gray-500 cursor-pointer" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-[200px] text-xs">
                                                                    Influences the emotional style and delivery of the speech. A higher value creates more expressive and stylized speech, while lower values sound more neutral.
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                        <span className="text-xs text-gray-600">{audioSettings.style.toFixed(1)}</span>
                                                    </div>
                                                    <Slider
                                                        value={[audioSettings.style]}
                                                        min={0.1}
                                                        max={1.0}
                                                        step={0.1}
                                                        onValueChange={([value]) => setAudioSettings(prev => ({ ...prev, style: value }))}
                                                    />
                                                </div>
                                            </div>

                                            {/* Right Column - Audio Preview */}
                                            <div className="flex flex-col items-center justify-center border rounded-lg p-4">
                                                {generatePreviewMutation.isPending ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                                                        <p className="text-sm text-gray-600">Generating preview...</p>
                                                    </div>
                                                ) : previewAudio ? (
                                                    <div className="w-full space-y-4">
                                                        <audio controls className="w-full" src={previewAudio}>
                                                            Your browser does not support the audio element.
                                                        </audio>
                                                        <Tooltip delayDuration={0}>
                                                            <TooltipTrigger asChild>
                                                                <div className="w-full">
                                                                    <Button
                                                                        onClick={handleGeneratePreview}
                                                                        disabled={generatePreviewMutation.isPending || !formData.script.trim() || !selectedActor}
                                                                        className="w-full mt-2 bg-[#046AD4] text-white rounded-lg hover:bg-[#0069d9] font-medium"
                                                                    >
                                                                        Generate Preview
                                                                    </Button>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {!selectedActor
                                                                    ? "Please select an actor first"
                                                                    : !formData.script.trim()
                                                                        ? "Please write a script first"
                                                                        : "Generate audio preview"}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="text-sm text-gray-600 text-center mb-2">
                                                            {filteredActors.find(actor => actor.id === selectedActor)?.name}
                                                        </div>
                                                        <div className="text-sm text-gray-500 text-center">
                                                            Generate a preview to hear your script
                                                        </div>
                                                        <Tooltip delayDuration={0}>
                                                            <TooltipTrigger asChild>
                                                                <div className="w-full">
                                                                    <Button
                                                                        onClick={handleGeneratePreview}
                                                                        disabled={generatePreviewMutation.isPending || !formData.script.trim() || !selectedActor}
                                                                        className="w-full mt-2 bg-[#046AD4] text-white rounded-lg hover:bg-[#0069d9] font-medium"
                                                                    >
                                                                        Generate Preview
                                                                    </Button>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {!selectedActor
                                                                    ? "Please select an actor first"
                                                                    : !formData.script.trim()
                                                                        ? "Please write a script first"
                                                                        : "Generate audio preview"}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="audio">
                                <AudioUpload />
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="flex items-center gap-3">
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <div>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={
                                            !selectedActor || 
                                            !formData.name.trim() || 
                                            (activeInputTab === "script" && !formData.script.trim()) ||
                                            (activeInputTab === "audio" && !audioUrl) ||
                                            createMutation.isPending
                                        }
                                        className="w-[120px] bg-[#046AD4] h-14 hover:bg-[#0069d9] rounded-[8px] font-normal"
                                        size="big"
                                    >
                                        {createMutation.isPending ? "Creating..." : "Create"}
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                {createMutation.isPending
                                    ? "Creating your video..."
                                    : !selectedActor
                                        ? "Please select an actor"
                                        : !formData.name.trim()
                                            ? "Please enter a video name"
                                            : activeInputTab === "script" && !formData.script.trim()
                                                ? "Please write a script"
                                                : activeInputTab === "audio" && !audioUrl
                                                    ? "Please upload an audio file"
                                                    : null}
                            </TooltipContent>
                        </Tooltip>
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

                <div className="flex flex-col w-full md:border-l-[1.5px] px-6 pt-5 pb-0 w-full flex-1 h-[86.1vh] col-span-6 relative">
                    <div className="gap-2 hidden top-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 mb-2">
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

                    <div className="overflow-y-auto flex-1 rounded-t-[8px]">
                        <div className="gap-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 pb-4">
                            {filteredActors.map(actor => (
                                <div
                                    key={actor.id}
                                    className={`transition-all overflow-hidden aspect-[5/7] h-max group rounded-[8px] relative flex flex-col ${selectedActor === actor.id ? 'border-[3px] border-[#0069d9]' : ''}`}
                                    onMouseEnter={() => handleActorHover(actor.name)}
                                    onMouseLeave={handleActorHoverEnd}
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
                                                onClick={() => handlePlayClick(actor.name)}
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
                                                                <div className="flex cursor-pointer text-xs font-medium items-center justify-center px-1.5 py-0.5 rounded bg-yellow-600 text-white">
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
                                                            <div className="flex cursor-pointer text-xs font-medium items-center justify-center px-1.5 py-0.5 rounded bg-yellow-600 text-white">
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
                            {/* Style Selection */}
                            <div className="mb-6">
                                <div className="text-lg text-[#565656] font-medium mb-3">Script Style</div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {SCRIPT_STYLES.map((style) => (
                                        <div
                                            key={style.id}
                                            onClick={() => setSelectedStyle(style.id)}
                                            className={`
                                            cursor-pointer p-4 rounded-lg border-2 transition-all
                                            ${selectedStyle === style.id
                                                    ? 'border-[#046AD4] bg-[#046AD4]/5'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                }
                                        `}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`
                                                ${selectedStyle === style.id ? 'text-[#046AD4]' : 'text-gray-500'}
                                            `}>
                                                    {style.icon}
                                                </div>
                                                <div className="font-medium">{style.name}</div>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {style.description}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

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
            </div>
        </TooltipProvider>
    )
}