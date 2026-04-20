"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransaction } from "@/context/TransactionContext";
import { getSteps } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { stepEngineCopy } from "@/lib/i18n/stepEngine";

export default function Header({ plan }: { plan: "39" | "69" | null }) {
  const pathname = usePathname();
  const lang = (pathname.startsWith('/es') ? 'es' : 'en') as 'en' | 'es';
  const t = stepEngineCopy[lang];
  const { transaction, goToStep } = useTransaction();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(lang === 'es' ? '/es/login' : '/login');
  }
  const { isDecisionMade } = useTransaction();
  const steps = getSteps(plan);
  const currentStepIndex = steps.findIndex(
    (s) => s.key === transaction.current_step
  );

  const stepLabelMap: Record<string, string> = {
    upload: t.steps.upload,
    check: t.steps.check,
    analyze: t.steps.analyze,
    verify: t.steps.verify,
    complete: t.steps.complete,
  };

  return (
    <header className="border-b border-[var(--border)] px-6 py-4">
      <div className="max-w-[680px] mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-0.5">
              {t.panels.step} {currentStepIndex + 1} {t.panels.of} {steps.length}
            </p>
            <p className="text-[var(--foreground)] font-semibold">
              {stepLabelMap[steps[currentStepIndex]?.key] ?? steps[currentStepIndex]?.label}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--foreground-muted)]">
              {transaction.vehicle.year} {transaction.vehicle.make}{" "}
              {transaction.vehicle.model}
            </p>
            <div className="flex items-center justify-end gap-4 mt-0.5">
              <p className="text-xs text-[var(--foreground-muted)]">
                {transaction.checklist_progress}% {t.panels.percentComplete}
              </p>
              <button
                onClick={handleLogout}
                className="text-xs text-[var(--foreground)] hover:underline cursor-pointer transition-colors"
              >
                {t.panels.logout}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {steps.map((step, i) => (
            <div key={step.key} className="flex-1">
              <div
                className={`h-1 w-full rounded-full transition-colors duration-300 ${
                  i === currentStepIndex
                    ? "bg-[#B4531A]"
                    : i < currentStepIndex
                    ? "bg-white/20"
                    : "bg-[var(--border)]"
                }`}
              />
            </div>
          ))}
        </div>

        <div className={`flex justify-between mt-1.5 transition-opacity ${isDecisionMade ? "pointer-events-none opacity-50" : ""}`}>
          {steps.map((step, i) => {
            const isCompleted = i < currentStepIndex;
            const isCurrent = i === currentStepIndex;
            const label = stepLabelMap[step.key] ?? step.label;
            return isCompleted && !isDecisionMade ? (
              <button
                key={step.key}
                onClick={() => goToStep(step.key)}
                className="text-[10px] uppercase tracking-wider transition-colors duration-300 text-[var(--foreground-muted)] hover:text-white cursor-pointer"
              >
                {label}
              </button>
            ) : (
              <p
                key={step.key}
                className={`text-[10px] uppercase tracking-wider transition-colors duration-300 ${
                  isCurrent ? "text-[#B4531A]" : "text-[var(--border)]"
                }`}
              >
                {label}
              </p>
            );
          })}
        </div>
      </div>
    </header>
  );
}
