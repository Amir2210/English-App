export default function Loading() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-surface-container-highest border-t-primary rounded-full animate-spin" />
        <p className="font-hebrew text-on-surface-variant font-medium animate-pulse">טוען...</p>
      </div>
    </div>
  );
}
