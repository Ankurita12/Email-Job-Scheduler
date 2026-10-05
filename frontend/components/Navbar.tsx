import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/dashboard" className="font-bold">
          ReachInbox Scheduler
        </Link>
        <div className="flex gap-4 text-sm">
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/compose" className="hover:underline">
            Compose
          </Link>
          <Link href="/upload" className="hover:underline">
            CSV Upload
          </Link>
        </div>
      </div>
    </nav>
  );
}
