'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { generateUploadUrl } from '@/app/actions/s3-upload'
import { useAudioUpload } from '@/contexts/audio-upload-context'
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { X } from "lucide-react"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['audio/mp3', 'audio/wav', 'audio/mpeg']

export function AudioUpload() {
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)
    const { audioUrl, setAudioUrl } = useAudioUpload()
    const { toast } = useToast()

    const validateAudioDuration = (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            const audio = new Audio()
            audio.addEventListener('loadedmetadata', () => {
                resolve(audio.duration <= 60) // 60 seconds max
            })
            audio.src = URL.createObjectURL(file)
        })
    }

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0]
        
        if (!file) return

        console.log("file.type",file.type)

        if (!ALLOWED_TYPES.includes(file.type)) {
            toast({
                variant: "destructive",
                title: "Invalid file type",
                description: "Please upload an MP3 or WAV file"
            })
            return
        }

        if (file.size > MAX_FILE_SIZE) {
            toast({
                variant: "destructive",
                title: "File too large",
                description: "Maximum file size is 5MB"
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
                setAudioUrl(fileUrl)
                setIsUploading(false)
                toast({
                    title: "Upload complete",
                    description: "Your audio file has been uploaded successfully"
                })
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
    }, [setAudioUrl, toast])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'audio/mp3': ['.mp3'],
            'audio/wav': ['.wav'],
            'audio/mpeg': ['.mp3']
        },
        maxFiles: 1,
        disabled: isUploading
    })

    const removeAudio = () => {
        setAudioUrl(null)
        setUploadProgress(0)
    }

    return (
        <div className="flex flex-col gap-4">
            {!audioUrl && (
                <div
                    {...getRootProps()}
                    className={`
                        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                        transition-colors duration-200 ease-in-out
                        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                        ${isUploading ? 'pointer-events-none opacity-50' : ''}
                    `}
                >
                    <input {...getInputProps()} />
                    {isDragActive ? (
                        <p>Drop the audio file here...</p>
                    ) : (
                        <div className="space-y-2">
                            <p>Drag & drop an audio file here, or click to select</p>
                            <p className="text-sm text-gray-500">
                                MP3 or WAV, max 5MB, max 1 minute
                            </p>
                        </div>
                    )}
                </div>
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
                <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium">Uploaded Audio</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={removeAudio}
                            className="text-red-500 hover:text-red-700"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <audio controls className="w-full">
                        <source src={audioUrl} type="audio/mpeg" />
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}
        </div>
    )
} 