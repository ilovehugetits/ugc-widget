'use client'

import { useState, useEffect, useCallback } from 'react'
import { FaPlay } from 'react-icons/fa'

import { BsQuestionCircleFill as FaQuestionCircle } from "react-icons/bs";

import { MdOutlineCheck } from "react-icons/md";

import { useToast } from "@/hooks/use-toast"
import { actors } from '@/db/schema'
import { getActors, createVideo, generateScript, generateAudioPreview, getAvailableVideoLimit } from "@/app/actions"
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

// lucide
import { LucideArrowLeft, LucideArrowRight } from 'lucide-react'
import { Search, Filter } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import Link from 'next/link';
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
    const [step, setStep] = useState<number>(0)
    const [activeActor, setActiveActor] = useState<string | null>(null)
    const [selectedActor, setSelectedActor] = useState<string | null>(null)
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [nextButtonLoading, setNextButtonLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const { toast } = useToast()
    const queryClient = useQueryClient()
    const { setActiveTab } = useTabContext()

    const { data: actors = [] } = useQuery<ActorWithoutRelations[]>({
        queryKey: ['actors'],
        queryFn: getActors
    })

    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

    // Now filteredActors can access searchQuery and selectedFilter
    const filteredActors = actors.filter(actor => {
        // First filter by search query
        const matchesSearch = actor.name.toLowerCase().includes(searchQuery.toLowerCase())

        // Then filter by selected categories
        const matchesCategory = selectedCategories.length === 0 || (
            actor.categories && (selectedCategories.some(cat => (actor.categories as unknown as string[]).includes(cat))
            )
        )

        return matchesSearch && matchesCategory
    });

    const [formData, setFormData] = useState({
        name: '',
        script: '',
        productInfo: '',
        productDesc: ''
    })

    const [audioSettings, setAudioSettings] = useState({
        stability: 0.5,
        similarity: 0.5,
        style: 0.1
    });

    const [previewAudio, setPreviewAudio] = useState<string | null>(null);

    const { canMakeRequest, incrementRequestCount } = useRateLimit('audio_preview', 20);

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
                audioUrl: data.audioUrl,
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
    const { audioUrl, audioDuration } = useAudioUpload()

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
        }, 1000)

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

    // Add new state for validation errors
    const [errors, setErrors] = useState<{
        script?: string;
        actor?: string;
        audio?: string;
        name?: string;
    }>({});

    // Update validation function
    const validateStep = (currentStep: number): boolean => {
        setErrors({}); // Clear previous errors
        let isValid = true;

        switch (currentStep) {
            case 0: // Script step
                if (!formData.script.trim()) {
                    setErrors(prev => ({ ...prev, script: "Please enter a script" }));
                    isValid = false;
                } else if (formData.script.length > 1000) {
                    setErrors(prev => ({ ...prev, script: "Script must be under 1000 characters" }));
                    isValid = false;
                }
                break;

            case 1: // Avatar step
                if (!selectedActor) {
                    setErrors(prev => ({ ...prev, actor: "Please select an avatar" }));
                    isValid = false;
                }
                break;

            case 2: // Audio step
                if (activeInputTab === "script" && !previewAudio) {
                    setErrors(prev => ({ ...prev, audio: "Please generate an audio preview" }));
                    isValid = false;
                } else if (activeInputTab === "audio" && !audioUrl) {
                    setErrors(prev => ({ ...prev, audio: "Please upload an audio file" }));
                    isValid = false;
                }
                break;

            case 3: // Review step
                if (!formData.name.trim()) {
                    setErrors(prev => ({ ...prev, name: "Please enter a video name" }));
                    isValid = false;
                }
                break;
        }

        return isValid;
    };

    const togglePricingModal = () => {
        setIsPricingModalOpen(true);
    }

    const handleNext = async () => {
        if (validateStep(step)) {
            if (step == 1) {
                setNextButtonLoading(true);
                const limit = await getAvailableVideoLimit();
                setNextButtonLoading(false);
                if (limit <= 0) {
                    togglePricingModal();
                    // toast({
                    //     variant: "destructive",
                    //     title: "You have reached your video limit. Please upgrade your subscription to create more videos."
                    // });
                    return;
                }
            }

            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step === 0) {
            onBackClick();
        } else {
            setStep(step - 1);
        }
    };

    useEffect(() => {
        setPreviewAudio(null);
    }, [selectedActor])

    // Update the CategoriesDropdown component
    const CategoriesDropdown = () => {
        const [isOpen, setIsOpen] = useState(false)

        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                const dropdown = document.getElementById('category-dropdown');
                if (dropdown && !dropdown.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            };

            if (isOpen) {
                document.addEventListener('click', handleClickOutside);
            }

            return () => {
                document.removeEventListener('click', handleClickOutside);
            };
        }, [isOpen]);

        return (
            <div className="relative">
                <Button
                    variant="outline"
                    onClick={() => setIsOpen(!isOpen)}
                    className="h-full w-full py-4 md:py-3.5 w-11 flex items-center justify-center border-gray-200 hover:bg-gray-50"
                    title="Filter by category"
                >
                    <Filter className="h-4 w-4 text-gray-600" />
                </Button>

                {isOpen && (
                    <div
                        id="category-dropdown"
                        className="absolute z-10 mt-1 w-[300px] right-0 rounded-lg bg-white shadow-lg border border-gray-200 py-2"
                    >
                        <div className="px-3 py-2 border-b border-gray-100">
                            <div className="text-sm font-medium text-gray-700">Filter by category</div>
                            {selectedCategories.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                    {selectedCategories.length} selected
                                </div>
                            )}
                        </div>
                        <div className="max-h-[320px] overflow-auto px-2">
                            {actorCategories.filter(category => category != "All ").map((category) => (
                                <div
                                    key={category}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-md cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent event bubbling
                                        if (selectedCategories.includes(category)) {
                                            setSelectedCategories(prev => prev.filter(cat => cat !== category))
                                        } else {
                                            setSelectedCategories(prev => [...prev, category])
                                        }
                                    }}
                                >
                                    <Checkbox
                                        id={`category-${category}`}
                                        checked={selectedCategories.includes(category)}
                                        onCheckedChange={(checked: boolean) => {
                                            if (checked) {
                                                setSelectedCategories(prev => [...prev, category])
                                            } else {
                                                setSelectedCategories(prev =>
                                                    prev.filter(cat => cat !== category)
                                                )
                                            }
                                        }}
                                    />
                                    <label
                                        htmlFor={`category-${category}`}
                                        className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                                    >
                                        {categoryEmojis[category] || ''} {category}
                                    </label>
                                </div>
                            ))}
                        </div>
                        {selectedCategories.length > 0 && (
                            <div className="border-t mt-2 pt-2 px-2 flex justify-between items-center">
                                <span className="text-sm text-gray-500 px-3">
                                    {selectedCategories.length} selected
                                </span>
                                <Button
                                    variant="ghost"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCategories([]);
                                    }}
                                    className="text-sm h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    Clear all
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className='flex flex-col items-center justify-center gap-4 w-full px-4 lg:px-0 mx-auto'>
                {step === 0 && (
                    <div className='bg-white w-full rounded-lg p-6 border border-gray-200'>
                        <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4'>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-1">What would you like your avatar to say?</h2>
                                <p className="text-sm text-gray-600">Write or generate a script to get started</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 0 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>1</div>
                                        <span className={`text-sm font-medium ${step >= 0 ? "text-blue-600" : "text-gray-400"}`}>Script</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 1 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>2</div>
                                        <span className={`text-sm font-medium ${step >= 1 ? "text-blue-600" : "text-gray-400"}`}>Avatar</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>3</div>
                                        <span className={`text-sm font-medium ${step >= 2 ? "text-blue-600" : "text-gray-400"}`}>Audio</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 3 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>4</div>
                                        <span className={`text-sm font-medium ${step >= 3 ? "text-blue-600" : "text-gray-400"}`}>Review</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 relative">
                            <div className='relative'>
                                <Textarea
                                    value={formData.script}
                                    onChange={(e) => {
                                        const filteredValue = e.target.value.replace(/[™©®]/g, '');
                                        setFormData(prev => ({
                                            ...prev,
                                            script: filteredValue.slice(0, 1000)
                                        }));
                                        setErrors(prev => ({ ...prev, script: undefined })); // Clear error on change
                                    }}
                                    placeholder="Type your script here..."
                                    className={`min-h-[320px] resize-none ${errors.script ? 'border-red-500' : ''}`}
                                />

                                <div className="absolute bottom-10 right-0 m-2 mx-4 flex items-center gap-4">
                                    <div className="text-[13px] font-medium text-[#9C9C9C]">
                                        <span className={`${formData.script.length >= 1000 ? 'text-red-500' : 'text-[#565656]'}`}>
                                            {formData.script.length}
                                        </span>/1000
                                    </div>

                                </div>
                                <div className="mt-2 flex items-center justify-end gap-4">
                                    <Button
                                        onClick={() => setIsModalOpen(true)}
                                        variant="outline"
                                        className="transition-all h-8 px-3 cursor-pointer bg-transparent border border-[#64748B] text-[#64748B] rounded hover:text-white hover:bg-[#64748B] text-xs flex items-center gap-2"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <g clipPath="url(#clip0_14_504)">
                                                <path d="M14 4.00001C14 2.8954 14.8954 2 16 2C14.8955 2 14 1.10457 14 0C14 1.10454 13.1046 2 12 2C13.1045 2 14 2.89537 14 4.00001Z" fill="currentColor" />
                                                <path d="M14.5 6C14.5 6.82841 13.8284 7.5 13 7.5C13.8284 7.5 14.5 8.17158 14.5 8.99999C14.5 8.17154 15.1716 7.5 16 7.5C15.1715 7.50003 14.5 6.82845 14.5 6Z" fill="currentColor" />
                                                <path d="M6.99999 5.99998C6.99999 4.34312 8.34312 2.99999 9.99998 2.99999C8.34312 2.99999 6.99999 1.65686 6.99999 0C6.99999 1.65686 5.65686 2.99999 4 2.99999C5.65686 2.99999 6.99999 4.34315 6.99999 5.99998Z" fill="currentColor" />
                                                <path d="M11 3L0 14L2 16L13 5L11 3ZM9.29297 6.20704L10.707 4.79299L11.207 5.293L9.79297 6.70704L9.29297 6.20704Z" fill="currentColor" />
                                            </g>
                                            <defs>
                                                <clipPath id="clip0_14_504">
                                                    <rect width="16" height="16" fill="white" />
                                                </clipPath>
                                            </defs>
                                        </svg>
                                        Generate With AI
                                    </Button>
                                </div>
                            </div>
                            {errors.script && (
                                <p className="text-sm text-red-500 mt-2">{errors.script}</p>
                            )}
                        </div>

                        <div className="bg-blue-50 rounded-lg p-4">
                            <h3 className="font-medium text-blue-900 mb-2">Writing Tips</h3>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>• Keep sentences clear and conversational</li>
                                <li>• Aim for 100-150 words per minute</li>
                                <li>• Include pauses for natural delivery</li>
                            </ul>
                        </div>
                    </div>
                )}
                {step === 1 && (
                    <div className='bg-white w-full rounded-lg p-6 border border-gray-200'>
                        <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4'>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose your avatar</h2>
                                <p className="text-sm text-gray-600">Select an avatar that best represents your brand</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 0 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>1</div>
                                        <span className={`text-sm font-medium ${step >= 0 ? "text-blue-600" : "text-gray-400"}`}>Script</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 1 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>2</div>
                                        <span className={`text-sm font-medium ${step >= 1 ? "text-blue-600" : "text-gray-400"}`}>Avatar</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>3</div>
                                        <span className={`text-sm font-medium ${step >= 2 ? "text-blue-600" : "text-gray-400"}`}>Audio</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 3 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>4</div>
                                        <span className={`text-sm font-medium ${step >= 3 ? "text-blue-600" : "text-gray-400"}`}>Review</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 space-y-4">
                            <div className="flex sm:flex-row gap-4">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <Input
                                        placeholder="Search avatars..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 w-full"
                                    />
                                </div>
                                <div className="w-fit">
                                    <CategoriesDropdown />
                                </div>
                            </div>

                            <div className="text-sm text-gray-600">
                                Showing {filteredActors.length} {filteredActors.length === 1 ? 'avatar' : 'avatars'}
                            </div>
                        </div>

                        <div className="gap-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 max-h-[45vh] lg:grid-cols-6 sm:max-h-[55vh] lg:max-h-[68vh] overflow-y-auto">
                            {filteredActors.map(actor => (
                                <div
                                    key={actor.id}
                                    className={`transition-all overflow-hidden aspect-[5/7] h-max group rounded-[8px] relative flex flex-col ${selectedActor === actor.id ? 'border-[3px] border-[#0069d9]' : ''}`}
                                    onMouseEnter={() => handleActorHover(actor.name)}
                                    onMouseLeave={handleActorHoverEnd}
                                    onClick={() => setSelectedActor(actor.id)}
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
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent triggering parent's onClick
                                                    handlePlayClick(actor.name);
                                                    setSelectedActor(actor.id);
                                                }}
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
                                        </div>
                                    ) : (
                                        <>
                                            <div className="absolute left-0 bottom-0 p-2 px-3 w-full">
                                                <div className="text-white line-clamp-2 font-medium text-[14px]">
                                                    {actor.name}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div
                                        className="absolute right-3 top-2.5 text-white cursor-pointer transition-all"
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent triggering parent's onClick
                                            setSelectedActor(actor.id);
                                        }}
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
                        {errors.actor && (
                            <p className="text-sm text-red-500 mt-4">{errors.actor}</p>
                        )}
                    </div>
                )}
                {step === 2 && (
                    <div className='bg-white w-full rounded-lg p-6 border border-gray-200'>
                        <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4'>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-1">Configure audio settings</h2>
                                <p className="text-sm text-gray-600">Adjust the voice settings or upload your own audio</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 0 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>1</div>
                                        <span className={`text-sm font-medium ${step >= 0 ? "text-blue-600" : "text-gray-400"}`}>Script</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 1 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>2</div>
                                        <span className={`text-sm font-medium ${step >= 1 ? "text-blue-600" : "text-gray-400"}`}>Avatar</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>3</div>
                                        <span className={`text-sm font-medium ${step >= 2 ? "text-blue-600" : "text-gray-400"}`}>Audio</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 3 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>4</div>
                                        <span className={`text-sm font-medium ${step >= 3 ? "text-blue-600" : "text-gray-400"}`}>Review</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Tabs value={activeInputTab} onValueChange={(value) => setActiveInputTab(value as "script" | "audio")}>
                            <div className='flex flex-col md:flex-row items-center'>
                                <TabsList className="grid grid-cols-2">
                                    <TabsTrigger value="script">AI Voice</TabsTrigger>
                                    <TabsTrigger value="audio">Upload Audio</TabsTrigger>
                                </TabsList>
                            </div>



                            <TabsContent value="script">
                                <div className="flex flex-col gap-1 relative">
                                    <div className="flex items-center justify-end mt-1 absolute -bottom-6 right-0">
                                        <div className="text-[13px] font-medium text-[#9C9C9C]">
                                            <span className="text-[#565656]">{formData.script.length}</span>/1000
                                        </div>
                                    </div>
                                </div>

                                {activeInputTab === "script" && (
                                    <div className="flex flex-col gap-1 mt-4">
                                        <label className="font-semibold text-black">Audio Settings</label>
                                        <div className="grid grid-cols-2 gap-4">
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
                                                        onValueChange={([value]: [number]) => setAudioSettings(prev => ({ ...prev, stability: value }))}
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
                                                        onValueChange={([value]: [number]) => setAudioSettings(prev => ({ ...prev, similarity: value }))}
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
                                                        onValueChange={([value]: [number]) => setAudioSettings(prev => ({ ...prev, style: value }))}
                                                    />
                                                </div>
                                            </div>

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
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className='flex items-center justify-start mt-4'>
                                            <Button
                                                onClick={handleGeneratePreview}
                                                disabled={generatePreviewMutation.isPending || !formData.script.trim() || !selectedActor}
                                                className="mt-2 bg-[#046AD4] text-white rounded-lg hover:bg-[#0069d9] font-medium"
                                            >
                                                Generate Preview
                                            </Button>
                                        </div>

                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="audio">
                                <AudioUpload />
                            </TabsContent>
                        </Tabs>
                        {errors.audio && (
                            <p className="text-sm text-red-500 mt-4">{errors.audio}</p>
                        )}
                    </div>
                )}
                {step === 3 && (
                    <div className='bg-white w-full rounded-lg p-6 border border-gray-200'>
                        <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4'>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-1">Review and create</h2>
                                <p className="text-sm text-gray-600">Review your settings and create your video</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 0 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>1</div>
                                        <span className={`text-sm font-medium ${step >= 0 ? "text-blue-600" : "text-gray-400"}`}>Script</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 1 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>2</div>
                                        <span className={`text-sm font-medium ${step >= 1 ? "text-blue-600" : "text-gray-400"}`}>Avatar</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>3</div>
                                        <span className={`text-sm font-medium ${step >= 2 ? "text-blue-600" : "text-gray-400"}`}>Audio</span>
                                    </div>
                                    <div className={`h-[2px] w-8 ${step >= 3 ? "bg-blue-600" : "bg-gray-200"}`} />
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 3 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>4</div>
                                        <span className={`text-sm font-medium ${step === 3 ? "text-blue-600" : "text-gray-400"}`}>Review</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Left side - Actor thumbnail */}
                            <div className="w-full md:w-[200px] lg:w-[220px] flex-shrink-0">
                                <div className="aspect-[9/16] relative rounded-lg overflow-hidden">
                                    {selectedActor && (
                                        <Image
                                            src={filteredActors.find(a => a.id === selectedActor)?.thumbnail || ''}
                                            alt="Selected actor"
                                            className="object-cover w-full h-full"
                                            width={240}
                                            height={427}
                                        />
                                    )}
                                </div>
                                <div className="mt-2 text-center text-sm font-medium text-gray-700">
                                    {filteredActors.find(a => a.id === selectedActor)?.name}
                                </div>
                            </div>

                            {/* Right side - Video details */}
                            <div className="flex-1 space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Video Name</label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => {
                                            setFormData(prev => ({ ...prev, name: e.target.value.slice(0, 100) }));
                                            setErrors(prev => ({ ...prev, name: undefined })); // Clear error on change
                                        }}
                                        placeholder="Enter video name..."
                                        className={`mt-1 ${errors.name ? 'border-red-500' : ''}`}
                                    />
                                    {errors.name && (
                                        <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                                    )}
                                </div>

                                {activeInputTab === "script" && (
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Script</label>
                                        <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                                            <p className="text-sm text-gray-600 whitespace-pre-wrap max-h-[100px] overflow-y-auto">
                                                {formData.script}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className='min-w-[100px]'>
                                        <label className="text-sm font-medium text-gray-700">Input Type</label>
                                        <div className="mt-1 text-sm text-gray-600">
                                            {activeInputTab === "script" ? "AI Voice" : "Custom Audio"}
                                        </div>
                                    </div>

                                    <div className='min-w-[150px]'>
                                        <label className="text-sm font-medium text-gray-700">Estimated Duration</label>
                                        <div className="mt-1 text-sm text-gray-600">
                                            {activeInputTab === "script"
                                                ? `~${Math.ceil((formData.script.split(' ').length / 150) * 60)} seconds`
                                                :
                                                // the length of the audio
                                                audioDuration ? `${Math.ceil(audioDuration)} seconds` : "0 seconds"
                                            }
                                        </div>
                                    </div>
                                </div>
                                {activeInputTab === "script" && (
                                    <div className='w-1/2'>
                                        <label className="text-sm font-medium text-gray-700">Audio Preview</label>
                                        <div className="mt-1">
                                            {previewAudio && (
                                                <audio controls className="w-full">
                                                    <source src={previewAudio} type="audio/mpeg" />
                                                </audio>
                                            )}
                                        </div>
                                    </div>
                                )}


                            </div>
                        </div>
                    </div>
                )}

                <div className='flex items-center w-full justify-between gap-4 mb-4'>
                    <Button
                        variant='outline'
                        className='text-sm'
                        onClick={handleBack}
                    >
                        <LucideArrowLeft size={16} />
                        Back
                    </Button>
                    {step < 3 && (
                        <Button
                            onClick={handleNext}
                            disabled={nextButtonLoading}
                            className='flex items-center gap-2 px-4 text-sm bg-[#151924] hover:bg-[#1a1e27]'
                        >
                            {nextButtonLoading ? (
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Loading...
                                </div>
                            ) : (
                                <>
                                    Next <LucideArrowRight size={16} />
                                </>
                            )}
                        </Button>
                    )}

                    {step === 3 && (
                        <Button
                            onClick={handleSubmit}
                            disabled={!formData.name.trim() || createMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {createMutation.isPending ? (
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Creating...
                                </div>
                            ) : (
                                "Create Video"
                            )}
                        </Button>
                    )}
                </div>
            </div>

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

            <Dialog open={isPricingModalOpen} onOpenChange={setIsPricingModalOpen}>
                <DialogContent className="p-0 !rounded-[16px] max-w-6xl">
                    <DialogHeader className="border-b border-[#E2E8F0] p-6 pb-5">
                        <DialogTitle className="flex items-center gap-3">
                            You need to choose a plan to continue
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch mb-8">
                            {/* Lite Plan */}
                            <div className="flex-1 bg-white rounded-2xl shadow-sm border-2 border-[#E2E8F0] hover:border-[#0B529C] transition-all duration-300 hover:translate-y-[-10px] flex flex-col p-6 min-w-[260px] max-w-[340px]">
                                <div className="text-lg font-semibold mb-2">Lite</div>
                                <div className="flex items-end mb-2">
                                    <span className="text-[48px] font-[800] text-[#1a1f36]">$47</span>
                                    <span className="text-base text-gray-500 mb-3.5 font-medium">/month</span>
                                </div>
                                <div className="text-gray-500 text-sm mb-4">Start creating AI-powered video ads with basic features</div>
                                <div className="font-semibold text-[#0A529C] text-sm mb-3 border-b border-[#e5e7eb] pb-1.5">Instant AI Video Creator</div>
                                <ul className="mb-6 space-y-2 text-sm">
                                    <li className="flex items-center gap-2 font-medium"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>3 Videos Per Month</li>
                                    <li className="flex items-center gap-2 font-medium"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>AI Realistic Actors</li>
                                    <li className="flex items-center gap-2 font-medium"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Available In 29 Languages</li>
                                    <li className="flex items-center gap-2 font-medium"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Export Without Watermark</li>
                                    <li className="flex items-center gap-2 font-medium"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>AI Script Generation</li>
                                </ul>
                                <Link href="https://clients.bandsoffads.com/order/15KPYD/portal">
                                    <Button className="mt-auto w-full rounded-md bg-[#0A529C] hover:bg-[#084380]">Get Started</Button>
                                </Link>
                            </div>
                            {/* Growth Plan */}
                            <div className="flex-1 bg-white rounded-2xl shadow-sm border-2 border-[#E2E8F0] hover:border-[#0B529C] transition-all duration-300 hover:translate-y-[-10px] flex flex-col p-6 min-w-[260px] max-w-[340px] relative scale-105 z-10">
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#0B529C] text-white text-xs font-semibold px-4 py-1 rounded-full shadow">Most Popular</div>
                                <div className="text-lg font-semibold mb-2">Growth</div>
                                <div className="flex items-end mb-2">
                                    <span className="text-[48px] font-[800] text-[#1a1f36]">$67</span>
                                    <span className="text-base text-gray-500 mb-3.5 font-medium">/month</span>
                                </div>
                                <div className="text-gray-500 text-sm mb-4">The full solution combining our AI video creation with BandsOffAds VIP benefits</div>
                                <div className="font-semibold text-[#0A529C] mb-3 text-sm font-medium border-b border-[#e5e7eb] pb-1.5 ">Instant AI Video Creator</div>
                                <ul className="mb-4 space-y-2 text-sm">
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>10 Videos Per Month</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>AI Realistic Actors</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Available In 29 Languages</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Export Without Watermark</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>AI Script Generation</li>
                                </ul>
                                <div className="font-semibold text-[#0A529C] text-sm pb-1.5 mb-4 border-b border-[#e5e7eb] flex items-center gap-1">BandsOffAds VIP Benefits
                                    <span className="ml-1 cursor-pointer" title="Exclusive benefits for Growth & Elite plans.">
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <FaQuestionCircle />
                                            </TooltipTrigger>
                                            <TooltipContent className='w-56 border-none shadow-none rounded-2xl bg-[#1a1f36] text-white p-3 px-4'>
                                                <p className='text-sm font-medium'>BandsOffAds VIP Benefits apply to all the done for you ad packages under the DFY tab on the left hand side as well as a few other bonuses.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </span>
                                </div>
                                <ul className="mb-6 space-y-2 text-sm">
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>50% OFF DFY Videos</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>24 Hour Delivery + Revisions</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Product Research Vault</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Description Generator</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Adcopy Wizard</li>
                                </ul>
                                <Link href="https://clients.bandsoffads.com/order/LD1RED/portal">
                                    <Button className="mt-auto w-full rounded-md bg-[#0A529C] hover:bg-[#084380]">Get Started</Button>
                                </Link>
                            </div>
                            {/* Elite Plan */}
                            <div className="flex-1 bg-white rounded-2xl shadow-sm border-2 border-[#E2E8F0] hover:border-[#0B529C] transition-all duration-300 hover:translate-y-[-10px] flex flex-col p-6 min-w-[260px] max-w-[340px]">
                                <div className="text-lg font-semibold mb-2">Elite</div>
                                <div className="flex items-end mb-2">
                                    <span className="text-[48px] font-[800] text-[#1a1f36]">$127</span>
                                    <span className="text-base text-gray-500 mb-3.5 font-medium">/month</span>
                                </div>
                                <div className="text-gray-500 text-sm mb-4">Everything in Lite & Growth as well as priority service delivery on all services</div>
                                <div className="font-semibold text-[#0A529C] mb-3 text-sm font-medium border-b border-[#e5e7eb] pb-1.5">Instant AI Video Creator</div>
                                <ul className="mb-4 space-y-2 text-sm">
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>25 Videos Per Month</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>AI Realistic Actors</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Available In 29 Languages</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Export Without Watermark</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>AI Script Generation</li>
                                </ul>
                                <div className="font-semibold text-[#0A529C] text-sm pb-1.5 mb-4 border-b border-[#e5e7eb] flex items-center gap-1">BandsOffAds VIP Benefits
                                    <span className="ml-1 cursor-pointer" title="Exclusive benefits for Growth & Elite plans.">
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <FaQuestionCircle />
                                            </TooltipTrigger>
                                            <TooltipContent className='w-56 border-none shadow-none rounded-2xl bg-[#1a1f36] text-white p-3 px-4'>
                                                <p className='text-sm font-medium'>BandsOffAds VIP Benefits apply to all the done for you ad packages under the DFY tab on the left hand side as well as a few other bonuses.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </span>
                                </div>
                                <ul className="mb-6 space-y-2 text-sm">
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>50% OFF DFY Videos</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>24 Hour Delivery + Revisions</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Product Research Vault</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Description Generator</li>
                                    <li className="flex items-center gap-2"><span className="text-[#0B529C] text-xl"><MdOutlineCheck /></span>Adcopy Wizard</li>
                                </ul>
                                <Link href="https://clients.bandsoffads.com/order/XOY3KD/portal">
                                    <Button className="mt-auto w-full rounded-md bg-[#0A529C] hover:bg-[#084380]">Get Started</Button>
                                </Link>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setIsPricingModalOpen(false)}
                                className="w-[184px] border-red-600 text-red-600 font-normal hover:bg-red-600 hover:text-white rounded-[6px]"
                            >
                                Cancel
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    )
}