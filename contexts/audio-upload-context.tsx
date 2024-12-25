'use client'

import { createContext, useContext, useState } from 'react'

interface AudioUploadContextType {
    audioUrl: string | null
    setAudioUrl: (url: string | null) => void
}

const AudioUploadContext = createContext<AudioUploadContextType | undefined>(undefined)

export function AudioUploadProvider({ children }: { children: React.ReactNode }) {
    const [audioUrl, setAudioUrl] = useState<string | null>(null)

    return (
        <AudioUploadContext.Provider value={{ audioUrl, setAudioUrl }}>
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