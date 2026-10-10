'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { WealthIQLogo } from '@/components/wealthiq-logo';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  Shield,
  Activity,
  Layers,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-black selection:text-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <WealthIQLogo variant="full" size="md" theme="light" href="/" />

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-black"
            >
              Sign In
            </Link>
            <Button
              asChild
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral-800 active:scale-[0.98]"
            >
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm mb-8">
            <Sparkles className="h-3.5 w-3.5 text-slate-900" />
            <span>Deterministic Ratios &amp; Smart Categorization</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] max-w-4xl mx-auto">
            Financial clarity,{' '}
            <span className="text-slate-500">
              without the guesswork.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            WealthIQ tracks your real income, expenses, debts, and investments to generate a transparent Financial Health Score, next-month expense forecasts, and smart transaction categorization.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              asChild
              className="w-full sm:w-auto rounded-full bg-black px-7 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral-800 active:scale-[0.98]"
            >
              <Link href="/register" className="inline-flex items-center gap-2">
                <span>Start Your Analysis</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="w-full sm:w-auto rounded-full border-slate-300 bg-white px-7 py-3 text-sm font-medium text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:text-black"
            >
              <Link href="/login">Sign In</Link>
            </Button>
          </div>

          <div className="mt-5 text-xs text-slate-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Private &amp; self-contained. No credit card required.</span>
          </div>
        </div>
      </section>

      {/* Core Capabilities Grid */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Designed for financial precision
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            Transparent deterministic models paired with verified machine learning for Indian transactions.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900">
                {feature.icon}
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture Pipeline Section */}
      <section className="relative border-y border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              System Pipeline
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              How WealthIQ analyzes your wealth
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Every metric traces back to verifiable mathematical formulas and calibrated models.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {pipelineSteps.map((step, idx) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                    {idx + 1}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {step.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy and Verification */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 shadow-sm flex flex-col sm:flex-row items-center gap-6 justify-between">
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <Lock className="h-3.5 w-3.5" />
              <span>Strict Privacy Isolation</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Your financial records stay your own
            </h3>
            <p className="text-xs text-slate-600 max-w-xl">
              WealthIQ never shares data or logs transaction narration content. All calculations execute locally or within isolated serverless endpoints.
            </p>
          </div>
          <Button
            asChild
            className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 shrink-0"
          >
            <Link href="/register">Get Started</Link>
          </Button>
        </div>
      </section>

      {/* Educational Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <DisclaimerBanner
          dismissible={false}
          text="WealthIQ is an educational personal finance project. It is not professional financial or investment advice. All scores and projections are intended for educational purposes only."
        />
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <WealthIQLogo variant="compact" size="sm" theme="light" href="/" />
            <span className="text-xs text-slate-500">— Personal Wealth Architecture</span>
          </div>
          <p className="text-xs text-slate-500">
            Educational AI Project. Not financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    title: '5-Pillar Health Score',
    description:
      'Transparent 0–100 score evaluating savings rate, expense burden, debt obligations, emergency runway, and asset investments.',
    icon: <Activity className="h-5 w-5" />,
  },
  {
    title: 'Smart Transaction Classifier v2',
    description:
      'Calibrated machine learning and contextual Indian banking rules automatically suggest accurate expense categories for Swiggy, Zomato, UPI, and bills.',
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    title: 'Deterministic Forecasting',
    description:
      'Multi-horizon 36-month net worth trajectories and multi-tier run-rate estimations built on verified statistical moving averages.',
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    title: 'Unified Wealth Ledger',
    description:
      'Comprehensive tracking across income streams, recurring expenses, fixed deposits, debts, and diversified asset portfolios.',
    icon: <Layers className="h-5 w-5" />,
  },
];

const pipelineSteps = [
  {
    title: 'Record Financial Data',
    description:
      'Log monthly income, expense items, bank fixed deposits, debt balances, and investments through clean, responsive forms with smart auto-suggestions.',
  },
  {
    title: 'Deterministic Ratios',
    description:
      'The engine computes exact financial health ratios: debt-to-income, expense ratio, discretionary burden, and emergency fund months.',
  },
  {
    title: 'Actionable Forecasting',
    description:
      'Simulate 36-month compound net worth growth under varying savings scenarios and view next-month expense benchmarks.',
  },
];
