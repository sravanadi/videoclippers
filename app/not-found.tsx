import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
      <h1 className="text-4xl font-bold mb-2">404 - Page Not Found</h1>
      <p className="text-slate-400 mb-6">The requested resource could not be found.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-sm font-medium transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
