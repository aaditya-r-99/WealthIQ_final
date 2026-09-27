'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { WealthIQLogo } from '@/components/wealthiq-logo';
import {
  Brain,
  TrendingUp,
  Shield,
  PieChart,
  Target,
  Lightbulb,
  BarChart3,
  ArrowRight,
  Check,
  Calculator,
  Database,
  Sparkles,
  LineChart as LineChartIcon,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <WealthIQLogo variant="full" size="md" href="/" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              AI-Powered Financial Health Analysis
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Understand Your Financial Health.
              <br />
              <span className="text-primary">Make Smarter Decisions.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              WealthIQ analyzes your income, expenses, savings, debt, and
              investments to produce a comprehensive Financial Health Score,
              spending risk classification, forecasts, and personalized
              recommendations.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">
                  Start Your Analysis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free for educational use. No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* What is Financial Health */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              What is Financial Health?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Financial health is the state of your personal financial life. It
              considers how well you manage income, control spending, save for
              the future, handle debt, and invest for growth. WealthIQ brings
              all these dimensions together into a single, clear picture.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need to understand your finances
          </h2>
          <p className="mt-4 text-muted-foreground">
            From basic ratios to machine learning forecasts, WealthIQ covers
            every dimension of your financial life.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">How WealthIQ Works</h2>
            <p className="mt-4 text-muted-foreground">
              A structured pipeline from raw financial data to AI-powered insights.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, idx) => (
              <div key={step.title} className="relative">
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {idx + 1}
                  </div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                {idx < steps.length - 1 && (
                  <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-border lg:block">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Capabilities */}
      <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Built with real AI, not just formulas
          </h2>
          <p className="mt-4 text-muted-foreground">
            WealthIQ clearly separates traditional calculations, rule-based
            logic, machine learning, and generative AI — so you always know
            what produces each result.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {aiCapabilities.map((cap) => (
            <div
              key={cap.title}
              className="flex gap-4 rounded-xl border border-border bg-card p-6"
            >
              <div className="shrink-0">
                <div className="inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  {cap.icon}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {cap.tag}
                </span>
                <h3 className="mt-1 text-lg font-semibold">{cap.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {cap.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <DisclaimerBanner
            dismissible={false}
            text="WealthIQ is an educational AI project built for a college Artificial Intelligence course. It is not professional financial advice. All scores, predictions, and recommendations are for educational and learning purposes only. Always consult a qualified financial advisor before making financial decisions."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold">WealthIQ</span>
              <span className="text-sm text-muted-foreground">
                — Educational AI Project
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Not professional financial advice. For educational use only.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    title: 'Financial Health Score',
    description:
      'Transparent 0–100 score based on five weighted financial pillars and predefined benchmarks.',
    icon: <Target className="h-6 w-6" />,
  },
  {
    title: 'Spending Risk Classification',
    description:
      'Machine learning model that classifies your spending pattern as Low, Medium, or High risk based on financial behavior.',
    icon: <Shield className="h-6 w-6" />,
  },
  {
    title: 'Financial Forecasting',
    description:
      'Regression-based projections of your future savings and net worth based on historical financial patterns.',
    icon: <TrendingUp className="h-6 w-6" />,
  },
  {
    title: 'Personalized Recommendations',
    description:
      'A recommendation engine that ranks actionable suggestions by priority, severity, and financial impact.',
    icon: <Lightbulb className="h-6 w-6" />,
  },
  {
    title: 'FD Comparison',
    description:
      'Compare fixed deposit rates across banks based on tenure, interest, and your liquidity preferences.',
    icon: <PieChart className="h-6 w-6" />,
  },
  {
    title: 'Market Insights',
    description:
      'Educational stock market insights including 52-week-high distance analysis and technical indicators.',
    icon: <BarChart3 className="h-6 w-6" />,
  },
];

const steps = [
  {
    title: 'Enter Your Financial Data',
    description:
      'Input your income, expenses, savings, debts, investments, and fixed deposits through guided forms.',
  },
  {
    title: 'Feature Engineering',
    description:
      'We calculate savings rate, expense ratio, debt-to-income, emergency fund coverage, and net worth.',
  },
  {
    title: 'AI Analysis',
    description:
      'Machine learning models classify your financial health and spending risk, and forecast your future.',
  },
  {
    title: 'Get Insights & Recommendations',
    description:
      'Receive a clear health score, ranked recommendations, and AI-generated explanations of your results.',
  },
];

const aiCapabilities = [
  {
    tag: 'Traditional Calculations',
    title: 'Financial Ratio Engine',
    description:
      'Deterministic formulas for savings rate, expense ratio, debt-to-income, emergency fund coverage, and net worth. These are standard financial calculations, not AI.',
    icon: <Calculator className="h-6 w-6" />,
  },
  {
    tag: 'Rule-Based Expert System',
    title: 'Recommendation Engine',
    description:
      'Domain-informed rules analyze your financial ratios and generate ranked, prioritized recommendations with severity scores.',
    icon: <Lightbulb className="h-6 w-6" />,
  },
  {
    tag: 'Machine Learning',
    title: 'Health & Risk Classification',
    description:
      'Trained scikit-learn models (Random Forest, Logistic Regression) classify your financial health category and spending risk level.',
    icon: <Brain className="h-6 w-6" />,
  },
  {
    tag: 'Regression / Forecasting',
    title: 'Financial Forecast',
    description:
      'Regression models project your future savings and net worth based on historical patterns. Forecasts are estimates, not guarantees.',
    icon: <LineChartIcon className="h-6 w-6" />,
  },
  {
    tag: 'Recommendation System',
    title: 'Ranked Suggestions',
    description:
      'A ranking system sorts recommendations by priority, severity, and financial impact to surface the most important actions first.',
    icon: <Target className="h-6 w-6" />,
  },
  {
    tag: 'Generative AI',
    title: 'LLM Explanation Layer',
    description:
      'A large language model translates structured results into clear, natural-language explanations. The LLM does not calculate metrics or replace ML models.',
    icon: <Sparkles className="h-6 w-6" />,
  },
];
