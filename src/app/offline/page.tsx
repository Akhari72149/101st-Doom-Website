import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

export const metadata = {
  title: "Offline",
  description: "The 101st Doom Battalion website is temporarily unavailable.",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-16">
      <section className="w-full max-w-xl border border-[#00ff66]/35 bg-[#000a06]/95 p-6 sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center border border-[#00ff66]/35 bg-[#00ff66]/10 text-[#00ff66]">
          <WifiOff size={26} aria-hidden="true" />
        </div>
        <p className="mt-7 text-xs font-bold uppercase text-[#00ff66]">Connection unavailable</p>
        <h1 className="mt-2 text-2xl font-bold uppercase text-white sm:text-3xl">Website offline</h1>
        <p className="mt-4 leading-7 text-[#9ab5a8]">
          The website cannot be reached right now. Check your connection or wait for the current deployment to finish, then try again.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex items-center gap-2 border border-[#00ff66] bg-[#00ff66] px-5 py-3 text-sm font-bold uppercase text-black transition-colors hover:bg-[#8dffb9]"
        >
          <RefreshCw size={17} aria-hidden="true" />
          Try again
        </Link>
      </section>
    </main>
  );
}
