import type { HTMLAttributes, ReactNode } from "react";

type StepState = "complete" | "current" | "upcoming";

export interface StepperStep {
  description?: ReactNode;
  id: string;
  title: ReactNode;
}

export interface StepperProps extends HTMLAttributes<HTMLOListElement> {
  currentStep: number;
  steps: StepperStep[];
}

const stateClasses: Record<StepState, { connector: string; marker: string; text: string }> = {
  complete: {
    connector: "bg-[var(--hs-primary)]",
    marker: "border-[var(--hs-primary)] bg-[var(--hs-primary)] text-white",
    text: "text-[var(--hs-text)]",
  },
  current: {
    connector: "bg-[var(--hs-border)]",
    marker: "border-[var(--hs-primary)] bg-[var(--hs-soft-blue)] text-[var(--hs-primary-deep)]",
    text: "text-[var(--hs-primary-deep)]",
  },
  upcoming: {
    connector: "bg-[var(--hs-border)]",
    marker: "border-[var(--hs-border)] bg-[var(--hs-surface)] text-[var(--hs-muted)]",
    text: "text-[var(--hs-muted)]",
  },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getStepState(index: number, currentStep: number): StepState {
  if (index < currentStep) {
    return "complete";
  }

  if (index === currentStep) {
    return "current";
  }

  return "upcoming";
}

export function Stepper({ className, currentStep, steps, ...props }: StepperProps) {
  return (
    <ol className={cn("flex w-full items-start", className)} {...props}>
      {steps.map((step, index) => {
        const state = getStepState(index, currentStep);
        const isLast = index === steps.length - 1;

        return (
          <li className="flex min-w-0 flex-1 items-start" key={step.id}>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center">
                <span
                  aria-current={state === "current" ? "step" : undefined}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                    stateClasses[state].marker,
                  )}
                >
                  {state === "complete" ? "\u2713" : index + 1}
                </span>
                {!isLast ? <span className={cn("mx-2 h-px flex-1", stateClasses[state].connector)} /> : null}
              </div>
              <div className="mt-2 pr-4">
                <div className={cn("text-sm font-medium", stateClasses[state].text)}>{step.title}</div>
                {step.description ? <div className="mt-1 text-xs leading-5 text-[var(--hs-muted)]">{step.description}</div> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
