'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <h2 className="text-xl font-bold mb-4">Coach Jacob needs a breather.</h2>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        Something broke on our end. Give it another shot.
      </p>
      <button
        onClick={reset}
        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition"
      >
        Try Again
      </button>
    </div>
  )
}
