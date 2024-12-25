import '@/app/globals.css'
import { QueryProvider } from '@/providers/query-provider'
import { cn } from '@/lib/utils'
import { Inter } from 'next/font/google'

import { Toaster } from "@/components/ui/toaster"
import { AudioUploadProvider } from "@/contexts/audio-upload-context"

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'UGC Video Creator',
  description: 'Create AI-powered UGC videos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className='h-full'>
      <body className={cn(inter.className, "antialiased bg-white h-full")}>
        <AudioUploadProvider>
          <QueryProvider>
            <main className="max-w-[1440px] mx-auto h-full">
              {children}
            </main>
            <Toaster />
          </QueryProvider>
        </AudioUploadProvider>
      </body>
    </html>
  )
}