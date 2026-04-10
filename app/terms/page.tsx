import Link from "next/link";
import { Navbar } from "@/components/Hero";

export const metadata = {
  title: "Terms of Service — MexGuardian",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-medium text-white mt-10 mb-3">{title}</h2>
      <p className="text-sm md:text-base text-[var(--foreground-muted)] leading-relaxed">{children}</p>
    </div>
  );
}

export default function TermsPage() {
  return (
    <>
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">

        <Link href="/" className="inline-block text-sm text-gray-400 hover:text-white transition-colors mb-8">
          ← Back to home
        </Link>

        <h1 className="text-3xl md:text-4xl font-semibold text-white mb-3">
          Terms of Service
        </h1>
        <p className="text-sm text-[var(--foreground-muted)] mb-8">Last updated: April 2026</p>

        <p className="text-sm md:text-base text-[var(--foreground-muted)] leading-relaxed">
          By using MexGuardian, you agree to the following terms.
        </p>

        <Section title="Service description">
          MexGuardian provides structured verification tools to help evaluate used vehicle purchases by analyzing available data.
        </Section>

        <Section title="No guarantee">
          We do not guarantee the accuracy or completeness of information, or that a transaction is safe. All results are informational only.
        </Section>

        <Section title="User responsibility">
          You are responsible for reviewing outputs and making final decisions before completing any transaction.
        </Section>

        <Section title="Limitation of liability">
          MexGuardian is not liable for financial loss, fraud, or third-party actions. Use of the service is at your own risk.
        </Section>

        <Section title="Third-party data">
          We rely on external data sources and are not responsible for inaccuracies or delays.
        </Section>

        <Section title="Payments">
          Fees are one-time and non-refundable once verification has begun.
        </Section>

        <Section title="Acceptable use">
          You agree not to misuse the platform or submit false information.
        </Section>

        <Section title="Contact">
          <a href="mailto:support@mexguardian.com" className="hover:text-white transition-colors">
            support@mexguardian.com
          </a>
        </Section>

        <Section title="Changes">
          We may update these terms at any time. Continued use implies acceptance.
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
