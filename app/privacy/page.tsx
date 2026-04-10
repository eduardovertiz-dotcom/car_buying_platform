import Link from "next/link";
import { Navbar } from "@/components/Hero";

export const metadata = {
  title: "Privacy Policy — MexGuardian",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-medium text-white mt-10 mb-3">{title}</h2>
      <p className="text-sm md:text-base text-[var(--foreground-muted)] leading-relaxed">{children}</p>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">

        <Link href="/" className="inline-block text-sm text-gray-400 hover:text-white transition-colors mb-8">
          ← Back to home
        </Link>

        <h1 className="text-3xl md:text-4xl font-semibold text-white mb-3">
          Privacy Policy
        </h1>
        <p className="text-sm text-[var(--foreground-muted)] mb-8">Last updated: April 2026</p>

        <p className="text-sm md:text-base text-[var(--foreground-muted)] leading-relaxed">
          MexGuardian provides structured verification tools for used car purchases in Mexico. We are committed to protecting your privacy and handling your data responsibly.
        </p>

        <Section title="Information we collect">
          We collect only the information necessary to provide our service, including vehicle details, transaction data, documents you upload, and basic usage data.
        </Section>

        <Section title="How we use your information">
          Your data is used to perform verification checks, generate risk assessments, and improve the product. We do not sell your personal data.
        </Section>

        <Section title="Data sharing">
          We may share limited data with verification providers and infrastructure services strictly to deliver the product.
        </Section>

        <Section title="Data security">
          We use industry-standard practices to protect your information. No system is completely secure, but we take reasonable measures to safeguard data.
        </Section>

        <Section title="Data retention">
          We retain data only as long as necessary to provide the service. You may request deletion at any time.
        </Section>

        <Section title="Contact">
          <a href="mailto:support@mexguardian.com" className="hover:text-white transition-colors">
            support@mexguardian.com
          </a>
        </Section>

        <Section title="Changes">
          We may update this policy periodically. Continued use of the service implies acceptance.
        </Section>

      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-[var(--foreground-muted)]">© 2026 MexGuardian. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
