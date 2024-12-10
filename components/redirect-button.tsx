'use client'


export function RedirectButton() {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "https://clients.bandsoffads.com/portal/page/ai-actors"
  
  return (
    <div className="flex flex-col gap-2 items-center justify-center h-[100vh]">
      <a 
        href={portalUrl}
        className="inline-flex items-center justify-center rounded-md text-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-12 px-8"
      >
        Go to AI Actors Portal
      </a>
    </div>
  )
}