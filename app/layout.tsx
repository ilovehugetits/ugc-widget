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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "pkrioaabaa");
            `
          }}
        />
      </head>
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