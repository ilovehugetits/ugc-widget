'use client'

import { useCallback, useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { generateUploadUrl } from '@/app/actions/s3-upload'
import { useAudioUpload } from '@/contexts/audio-upload-context'
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Trash2, Mic, Square } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['audio/mp3', 'audio/wav', 'audio/mpeg', 'video/mp4']
const MAX_DURATION = 60 // 60 seconds

export function AudioUpload() {
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)
    const { audioUrl, setAudioUrl, setAudioDuration } = useAudioUpload()
    const { toast } = useToast()
    const [isRecording, setIsRecording] = useState(false)
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const [activeTab, setActiveTab] = useState<string>("upload")
    const recordingStartTimeRef = useRef<number | null>(null)
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

    const validateAudioDuration = (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            // For recorded audio, we already know the duration
            if (file.name === 'recorded-audio.wav' && recordingStartTimeRef.current) {
                const duration = (Date.now() - recordingStartTimeRef.current) / 1000
                setAudioDuration(duration)
                console.log('Recorded audio duration:', duration)
                resolve(duration <= MAX_DURATION)
                return
            }

            // For uploaded files
            const audio = new Audio()
            let resolved = false

            audio.addEventListener('loadedmetadata', () => {
                if (!resolved) {
                    resolved = true
                    setAudioDuration(audio.duration)
                    console.log('Uploaded audio duration:', audio.duration)
                    resolve(audio.duration <= MAX_DURATION)
                }
            })

            // Fallback for cases where loadedmetadata might not fire
            audio.addEventListener('error', () => {
                if (!resolved) {
                    resolved = true
                    console.error('Error loading audio duration')
                    resolve(false)
                }
            })

            audio.src = URL.createObjectURL(file)
        })
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []
            recordingStartTimeRef.current = Date.now()

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' })
                setRecordedBlob(audioBlob)
                
                // Convert blob to file for upload
                const file = new File([audioBlob], 'recorded-audio.wav', { type: 'audio/wav' })
                
                // Validate and upload the recorded file
                const isValidDuration = await validateAudioDuration(file)
                console.log('isValidDuration', isValidDuration)
                if (!isValidDuration) {
                    toast({
                        variant: "destructive",
                        title: "Audio too long",
                        description: "Maximum duration is 1 minute"
                    })
                    return
                }

                handleFileUpload(file)
            }

            // Start recording
            mediaRecorder.start(1000) // Record in 1-second chunks
            setIsRecording(true)

            // Set up timer to stop recording at MAX_DURATION
            recordingTimerRef.current = setTimeout(() => {
                if (isRecording && mediaRecorderRef.current) {
                    stopRecording()
                    toast({
                        title: "Recording stopped",
                        description: "Maximum recording duration reached"
                    })
                }
            }, MAX_DURATION * 1000)

        } catch (error) {
            console.error('Error accessing microphone:', error)
            toast({
                variant: "destructive",
                title: "Microphone Error",
                description: "Could not access your microphone. Please check permissions."
            })
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
            setIsRecording(false)
            
            // Clear the recording timer
            if (recordingTimerRef.current) {
                clearTimeout(recordingTimerRef.current)
                recordingTimerRef.current = null
            }
        }
    }

    const handleFileUpload = async (file: File) => {
        if (file.size > MAX_FILE_SIZE) {
            toast({
                variant: "destructive",
                title: "File too large",
                description: "Maximum file size is 5MB"
            })
            return
        }

        setIsUploading(true)
        try {
            const { uploadUrl, fileUrl } = await generateUploadUrl(file.type)

            const xhr = new XMLHttpRequest()
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const progress = (event.loaded / event.total) * 100
                    setUploadProgress(progress)
                }
            })

            xhr.upload.addEventListener('load', () => {
                setTimeout(() => {
                    setAudioUrl(fileUrl)
                    setIsUploading(false)
                    toast({
                        title: "Upload complete",
                        description: "Your audio file has been uploaded successfully"
                    })
                }, 2500)
            })

            xhr.open('PUT', uploadUrl)
            xhr.setRequestHeader('Content-Type', file.type)
            xhr.setRequestHeader('x-amz-acl', 'public-read')
            xhr.send(file)
        } catch (error) {
            console.error('Upload error:', error)
            setIsUploading(false)
            toast({
                variant: "destructive",
                title: "Upload failed",
                description: "Please try again later"
            })
        }
    }

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0]
        if (!file) return

        if (!ALLOWED_TYPES.includes(file.type)) {
            toast({
                variant: "destructive",
                title: "Invalid file type",
                description: "Please upload an MP3, WAV, or MP4 file"
            })
            return
        }

        const isValidDuration = await validateAudioDuration(file)
        if (!isValidDuration) {
            toast({
                variant: "destructive",
                title: "Audio too long",
                description: "Maximum duration is 1 minute"
            })
            return
        }

        handleFileUpload(file)
    }, [toast])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'audio/mp3': ['.mp3'],
            'audio/wav': ['.wav'],
            'audio/mpeg': ['.mp3'],
            'video/mp4': ['.mp4']
        },
        maxFiles: 1,
        disabled: isUploading
    })

    const removeAudio = () => {
        setAudioUrl(null)
        setUploadProgress(0)
        setRecordedBlob(null)
    }

    return (
        <div className="flex flex-col gap-4">
            {!audioUrl && !isUploading && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload">Upload File</TabsTrigger>
                        <TabsTrigger value="record">Record Audio</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload">
                        <div
                            {...getRootProps()}
                            className={`
                                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                                transition-colors duration-200 ease-in-out
                                ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                            `}
                        >
                            <input {...getInputProps()} />
                            {isDragActive ? (
                                <p>Drop the audio file here...</p>
                            ) : (
                                <div className="space-y-2">
                                    <p>Drag & drop an audio file here, or click to select</p>
                                    <p className="text-sm text-gray-500">
                                        MP3, WAV, or MP4, max 5MB, max 1 minute
                                    </p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="record">
                        <div className="border-2 rounded-lg p-8 text-center">
                            <div className="space-y-4">
                                <Button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    variant={isRecording ? "destructive" : "default"}
                                    className="w-full"
                                >
                                    {isRecording ? (
                                        <>
                                            <Square className="h-4 w-4 mr-2" />
                                            Stop Recording
                                        </>
                                    ) : (
                                        <>
                                            <Mic className="h-4 w-4 mr-2" />
                                            Start Recording
                                        </>
                                    )}
                                </Button>
                                {isRecording && (
                                    <p className="text-sm text-red-500">Recording in progress...</p>
                                )}
                                <p className="text-sm text-gray-500">
                                    Maximum recording duration is 1 minute
                                </p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            )}

            {isUploading && (
                <div className="space-y-2">
                    <Progress value={uploadProgress} />
                    <p className="text-sm text-center text-gray-500">
                        Uploading... {Math.round(uploadProgress)}%
                    </p>
                </div>
            )}

            {audioUrl && !isUploading && (
                <div className="flex flex-row items-center gap-4">
                    <audio controls className="w-full">
                        <source src={audioUrl} type="audio/mpeg" />
                        Your browser does not support the audio element.
                    </audio>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeAudio}
                        className="text-red-500 hover:text-red-700"
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                </div>
            )}
        </div>
    )
} 