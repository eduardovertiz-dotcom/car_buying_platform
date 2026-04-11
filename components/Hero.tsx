"use client";

import Link from "next/link";


/* ✅ NAVBAR (NOT EXPORTED) */
export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/95 backdrop-blur-md">
      <div className="max-w-[1240px] mx-auto px-6 lg:px-8">
        <nav className="flex items-center justify-between h-[72px]">
          <Link href="/" className="flex items-center gap-3">
            <img src="/MexGuardian_logo.png" alt="MexGuardian logo" className="h-6 w-auto" />
            <span className="text-[15px] font-semibold text-white">
              MexGuardian
            </span>
          </Link>

          <div className="flex items-center gap-8">
            <Link href="#how-it-works" className="hidden md:block text-[14px] text-[var(--foreground-muted)] hover:text-white transition-colors">
              How it works
            </Link>
            <Link href="#pricing" className="hidden md:block text-[14px] text-[var(--foreground-muted)] hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/transactions" className="hidden md:block text-[14px] text-[var(--foreground-muted)] hover:text-white transition-colors">
              Login
            </Link>

            {/* 🔥 BUTTON */}
            <Link
              href="/#pricing"
              className="bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Start verification</span>
            </Link>
          </div>
        </nav>
      </div>
      <div className="h-px bg-white/[0.06]" />
    </header>
  );
}

/* ✅ HERO (MAIN EXPORT) */
export default function Hero() {
  return (
    <>
      <Navbar />

      <section className="md:min-h-screen flex flex-col md:flex-row md:items-center overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="w-full max-w-6xl mx-auto px-6 lg:pl-10 lg:pr-0 flex flex-col md:flex-row md:items-center">

          {/* TEXT */}
          <div className="w-full md:w-5/12">

            <h1
              className="font-semibold text-white tracking-tight leading-[1.1]"
              style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)" }}
            >
              You don&apos;t just buy the car.<br />
              <span className="text-[var(--accent)]">You inherit the problem.</span>
            </h1>

            <p className="text-[16px] text-[var(--foreground-muted)] leading-relaxed max-w-xl mt-4">
              In Mexico, liens, unpaid fines, cloned VINs, and falsified documents transfer with the vehicle.
              MexGuardian verifies what&apos;s real before you pay.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-6">

              {/* 🔥 BUTTON */}
              <Link
                href="/#pricing"
                className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-[15px] font-semibold rounded-lg px-5 py-3 hover:opacity-90 transition-opacity"
              >
                Start my verification →
              </Link>

              <Link
                href="#how-it-works"
                className="text-[15px] text-[var(--foreground-muted)] hover:text-white transition-colors"
              >
                See how it works →
              </Link>
            </div>

          </div>

          {/* IMAGE */}
          <div className="hidden md:flex w-7/12 items-center pl-6 -mr-32">
            <img
              src="/hero_image.png"
              alt="MexGuardian vehicle verification"
              className="w-full object-contain"
            />
          </div>

        </div>
      </section>
    </>
  );
}
