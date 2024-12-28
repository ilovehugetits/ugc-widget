'use client'

import { createContext, useContext, useState } from 'react'

interface AudioUploadContextType {
    audioUrl: string | null
    setAudioUrl: (url: string | null) => void
    audioDuration: number | null
    setAudioDuration: (duration: number | null) => void
}

const AudioUploadContext = createContext<AudioUploadContextType | undefined>(undefined)

export function AudioUploadProvider({ children }: { children: React.ReactNode }) {
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [audioDuration, setAudioDuration] = useState<number | null>(null)
    return (
        <AudioUploadContext.Provider value={{ audioUrl, setAudioUrl, audioDuration, setAudioDuration }}>
            {children}
        </AudioUploadContext.Provider>
    )
}

export function useAudioUpload() {
    const context = useContext(AudioUploadContext)
    if (context === undefined) {
        throw new Error('useAudioUpload must be used within an AudioUploadProvider')
    }
    return context
} 