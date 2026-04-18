"use client";

import Link from "next/link";
import Image from "next/image";


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

      <section className="overflow-hidden pt-20 pb-20 md:pt-36 md:pb-36">
        <div className="w-full max-w-6xl mx-auto px-6 lg:pl-10 lg:pr-0 grid lg:grid-cols-[48%_52%] items-center">

          {/* TEXT */}
          <div className="max-w-xl pr-8">

            <h1
              className="max-w-2xl font-semibold text-white tracking-tight leading-[1.1]"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}
            >
              Don&apos;t get scammed when buying a car in Mexico.
            </h1>

            <p className="max-w-lg text-white/75 leading-relaxed mt-4">
              Verify the vehicle, the seller, and the risk before you pay.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-6">

              {/* 🔥 BUTTON */}
              <Link
                href="/#pricing"
                className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-[15px] font-semibold rounded-lg px-5 py-3 hover:opacity-90 transition-opacity"
              >
                Start verification
              </Link>

              <Link
                href="#how-it-works"
                className="text-[15px] text-[var(--foreground-muted)] hover:text-white transition-colors"
              >
                See how it works →
              </Link>
            </div>

            <div className="flex flex-col gap-1.5 mt-6">
              <p className="text-sm text-[var(--foreground-muted)]/80">✔ Avoid inheriting debts, fines, or legal issues</p>
              <p className="text-sm text-[var(--foreground-muted)]/80">✔ Verify who actually owns the vehicle</p>
            </div>

          </div>

          {/* IMAGE */}
          <div className="hidden md:flex items-center pl-6 -mr-32 relative w-full h-full">
            {/* Desktop */}
            <Image
              src="/hero_desktop_ok.png"
              alt="MexGuardian vehicle verification"
              width={1600}
              height={900}
              className="hidden md:block w-full h-auto object-contain lg:scale-125 lg:translate-x-6 brightness-110 contrast-110"
              priority
            />
          </div>

          {/* Mobile */}
          <Image
            src="/hero_mobile.png"
            alt="MexGuardian vehicle verification"
            width={800}
            height={1200}
            className="block md:hidden w-full h-auto object-contain"
            priority
          />

        </div>
      </section>
    </>
  );
}
