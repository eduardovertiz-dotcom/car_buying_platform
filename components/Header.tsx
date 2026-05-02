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
            <p className="text-[11px] text-[var(--foreground-muted)] tracking-wide mb-0.5">
              {t.panels.step} {currentStepIndex + 1} {t.panels.of} {steps.length}
            </p>
            <p className="text-[var(--foreground)] font-semibold">
              {stepLabelMap[steps[currentStepIndex]?.key] ?? steps[currentStepIndex]?.label}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--foreground-muted)]">
              {transaction.vehicle?.year} {transaction.vehicle?.make}{" "}
              {transaction.vehicle?.model}
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

        <div className={`flex items-center justify-center gap-0 transition-opacity ${isDecisionMade ? "pointer-events-none opacity-50" : ""}`}>
          {steps.map((step, i) => {
            const isCompleted = i < currentStepIndex;
            const isCurrent = i === currentStepIndex;
            const label = stepLabelMap[step.key] ?? step.label;
            const isLast = i === steps.length - 1;

            const circleContent = isCompleted ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <span className="text-[10px] font-medium leading-none">{i + 1}</span>
            );

            const circle = isCompleted && !isDecisionMade ? (
              <button
                key={step.key}
                onClick={() => goToStep(step.key)}
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-full bg-[#B4531A] flex items-center justify-center text-white opacity-60 group-hover:opacity-100 transition-opacity">
                  {circleContent}
                </div>
                <span className="text-[10px] text-[var(--foreground-muted)] group-hover:text-[var(--foreground)] transition-colors capitalize">
                  {label}
                </span>
              </button>
            ) : (
              <div key={step.key} className="flex flex-col items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${
                  isCurrent
                    ? "bg-[#B4531A] text-white"
                    : isCompleted
                    ? "bg-[#B4531A] text-white opacity-60"
                    : "bg-[var(--border)] text-[var(--foreground-muted)]"
                }`}>
                  {circleContent}
                </div>
                <span className={`text-[10px] transition-colors duration-300 capitalize ${
                  isCurrent
                    ? "text-[#B4531A] font-medium"
                    : isCompleted
                    ? "text-[var(--foreground-muted)]"
                    : "text-[var(--border)]"
                }`}>
                  {label}
                </span>
              </div>
            );

            return (
              <div key={step.key} className="flex items-start flex-1">
                <div className="flex flex-col items-center">
                  {circle}
                </div>
                {!isLast && (
                  <div className={`flex-1 h-px mt-3 transition-colors duration-300 ${
                    i < currentStepIndex
                      ? "bg-[#B4531A] opacity-40"
                      : "bg-[var(--border)]"
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
