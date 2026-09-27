'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Cpu,
  ChevronDown,
  ChevronUp,
  Info,
  TrendingUp,
  TrendingDown,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { MLPredictionResult } from '@/lib/ml-engine';
import { getHealthCategoryBg } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RiskBadge } from '@/components/risk-badge';

interface MLPredictionCardProps {
  prediction: MLPredictionResult | null;
}

const CATEGORY_PROGRESS_COLORS: Record<string, string> = {
  Critical: 'bg-danger',
  Weak: 'bg-warning',
  Moderate: 'bg-amber-500',
  Healthy: 'bg-primary',
  Excellent: 'bg-emerald-500',
};

export function MLPredictionCard({ prediction }: MLPredictionCardProps) {
  const [showFeatureDetails, setShowFeatureDetails] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  if (!prediction) {
    return null;
  }

  if (!prediction.hasSufficientData) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">ML Financial Archetype</CardTitle>
          </div>
          <CardDescription>
            Explainable ML classifier using 10 financial features
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const {
    modelVersion,
    predictedCategory,
    spendingRisk,
    confidence,
    classProbabilities,
    topPositiveFactors,
    topRiskFactors,
    allFeatureContributions,
  } = prediction;

  const categories: Array<keyof typeof classProbabilities> = [
    'Critical',
    'Weak',
    'Moderate',
    'Healthy',
    'Excellent',
  ];

  return (
    <Card className="relative overflow-hidden border border-border shadow-sm">
      {/* Top Accent Gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-emerald-500" />

      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  ML Financial Archetype
                </CardTitle>
                <Badge variant="outline" className="text-[11px] font-medium border-border/80">
                  Model v1.0
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Explainable ML classifier using 10 financial features
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-1 shrink-0">
            <Badge variant="secondary" className="text-xs font-normal py-1 px-2.5 w-fit">
              Top Class Likelihood: <strong className="ml-1 text-foreground font-semibold">{confidence}%</strong>
            </Badge>
            <span className="text-[10px] text-muted-foreground max-w-[260px] sm:text-right leading-tight">
              Model&apos;s highest calculated class likelihood among 5 archetypes.
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Prediction & Top Likelihood Banner */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              ML Predicted Financial Archetype
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-semibold',
                  getHealthCategoryBg(predictedCategory)
                )}
              >
                {predictedCategory}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Archetype matching your current financial profile ({confidence}% top class likelihood).
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Top Class Likelihood
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {confidence}%
              </span>
              <span className="text-xs text-muted-foreground">highest class likelihood</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              This is the model&apos;s highest calculated class likelihood among the five financial archetypes. It is not a probability of a future financial outcome.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Predicted Spending Risk
            </p>
            <div className="mt-2 flex items-center gap-2">
              <RiskBadge level={spendingRisk} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Rule-based evaluation from downside probability mass and debt-to-income.
            </p>
          </div>
        </div>

        {/* Clear Explanation of Prediction Meaning & Scope */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-foreground/85 leading-relaxed space-y-2">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Info className="h-4 w-4 shrink-0" />
            <span>Understanding Your ML Prediction</span>
          </div>
          <p>
            The model estimates which financial-health archetype most closely matches your <strong>CURRENT</strong> financial profile.
          </p>
          <p className="text-muted-foreground text-[11px] pt-0.5">
            <strong className="text-foreground">What the model does not predict:</strong> The model does not predict future income, future wealth, stock prices, market returns, or guaranteed financial outcomes.
          </p>
        </div>

        {/* Multi-Class Probability Distribution */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between text-xs font-medium gap-1">
            <span className="text-muted-foreground">Multi-Class Probability Distribution</span>
            <span className="text-[11px] text-muted-foreground font-mono">
              Total: 100% (Selected: {predictedCategory} at {confidence}%)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {categories.map((cat) => {
              const probPercent = Math.round(classProbabilities[cat] * 100);
              const isWinner = cat === predictedCategory;
              return (
                <div
                  key={cat}
                  className={`rounded-lg border p-2.5 text-center transition-all ${
                    isWinner
                      ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20 col-span-2 sm:col-span-1'
                      : 'border-border/50 bg-background/50'
                  }`}
                >
                  <div className="text-[11px] font-medium truncate text-muted-foreground">
                    {cat}
                  </div>
                  <div
                    className={`mt-1 text-sm font-bold ${
                      isWinner ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {probPercent}%
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        CATEGORY_PROGRESS_COLORS[cat] || 'bg-primary'
                      }`}
                      style={{ width: `${Math.max(4, probPercent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            The archetype with the highest class likelihood ({predictedCategory}) becomes the selected ML prediction.
          </p>
        </div>

        {/* Top Influencing Factors (Strengths & Risks) */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Positive Factors */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span>Key Resilient Drivers (Strengths)</span>
            </div>
            {topPositiveFactors.length > 0 ? (
              <ul className="space-y-2.5">
                {topPositiveFactors.map((factor) => (
                  <li key={factor.key} className="text-xs text-muted-foreground">
                    <div className="flex items-center justify-between font-medium text-foreground">
                      <span>{factor.name}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {factor.rawFormatted}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {factor.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No dominant positive outliers currently observed in the feature set.
              </p>
            )}
          </div>

          {/* Risk Factors */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
              <TrendingDown className="h-4 w-4 shrink-0" />
              <span>Primary Vulnerability Areas (Risks)</span>
            </div>
            {topRiskFactors.length > 0 ? (
              <ul className="space-y-2.5">
                {topRiskFactors.map((factor) => (
                  <li key={factor.key} className="text-xs text-muted-foreground">
                    <div className="flex items-center justify-between font-medium text-foreground">
                      <span>{factor.name}</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">
                        {factor.rawFormatted}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {factor.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                All features are currently within stable, non-critical benchmark ranges.
              </p>
            )}
          </div>
        </div>

        {/* Feature Details & Methodology Toggles */}
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFeatureDetails(!showFeatureDetails)}
              className="text-xs font-medium"
            >
              <Cpu className="mr-1.5 h-3.5 w-3.5" />
              {showFeatureDetails ? 'Hide Feature Breakdown' : 'View All 10 Model Features'}
              {showFeatureDetails ? (
                <ChevronUp className="ml-1 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMethodology(!showMethodology)}
              className="text-xs font-medium"
            >
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              {showMethodology ? 'Hide Model Explanation' : 'How the ML model works'}
              {showMethodology ? (
                <ChevronUp className="ml-1 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Feature Breakdown Section */}
          {showFeatureDetails && (
            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Feature Breakdown</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The 10 normalized features used by the ML archetype classifier.
                </p>
              </div>

              {/* Explanatory Legend */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px] bg-background/80 p-3 rounded-lg border border-border/50 text-muted-foreground">
                <div>
                  <strong className="text-foreground">Recorded Value:</strong> Actual value from your financial records.
                </div>
                <div>
                  <strong className="text-foreground">Weight:</strong> Predefined importance assigned to this feature in the current ML model.
                </div>
                <div>
                  <strong className="text-foreground">Normalized:</strong> The feature converted to a comparable model scale.
                </div>
                <div>
                  <strong className="text-foreground">Impact:</strong> Whether the feature contributes positively or negatively to the current profile classification.
                </div>
              </div>

              {/* Note on weights */}
              <p className="text-[11px] text-muted-foreground italic">
                Note: Feature weights are predefined parameters of the current model; they are not learned from a large real-world customer training dataset.
              </p>

              {/* Desktop Table: Hidden on small screens */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[560px]">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th className="pb-2.5 font-medium">Feature</th>
                      <th className="pb-2.5 font-medium">Recorded Value</th>
                      <th className="pb-2.5 font-medium">Weight</th>
                      <th className="pb-2.5 font-medium">Normalized</th>
                      <th className="pb-2.5 font-medium">Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {allFeatureContributions.map((fc) => (
                      <tr key={fc.key} className="hover:bg-muted/40">
                        <td className="py-2.5 font-medium text-foreground">{fc.name}</td>
                        <td className="py-2.5 font-mono">{fc.rawFormatted}</td>
                        <td className="py-2.5 font-mono text-muted-foreground">
                          {(fc.weight * 100).toFixed(0)}%
                        </td>
                        <td className="py-2.5 font-mono text-muted-foreground">
                          {fc.normalizedValue.toFixed(2)}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              fc.impact === 'positive'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : fc.impact === 'negative'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {fc.impact}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Feature Cards: Visible only on mobile screens */}
              <div className="block md:hidden space-y-2.5">
                {allFeatureContributions.map((fc) => (
                  <div
                    key={fc.key}
                    className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-foreground">{fc.name}</span>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          fc.impact === 'positive'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : fc.impact === 'negative'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {fc.impact}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1.5 text-[11px] border-t border-border/40">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Recorded</span>
                        <span className="font-mono font-medium text-foreground">{fc.rawFormatted}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Weight</span>
                        <span className="font-mono text-muted-foreground">{(fc.weight * 100).toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Normalized</span>
                        <span className="font-mono text-muted-foreground">{fc.normalizedValue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model Methodology & How It Works Section */}
          {showMethodology && (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4 text-xs leading-relaxed">
              <div className="flex items-center gap-2 font-semibold text-primary text-sm">
                <Sparkles className="h-4 w-4" />
                <span>How the ML model works</span>
              </div>

              <p className="text-muted-foreground">
                Explainable ML classifier comparing your current financial profile with five financial-health archetypes.
              </p>

              {/* 6 Step Process */}
              <div className="space-y-2 bg-background/70 rounded-lg p-3.5 border border-border/50">
                <h5 className="font-semibold text-foreground text-xs">Model Pipeline</h5>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                  <li>
                    <strong className="text-foreground">Feature Extraction:</strong> 10 financial features are extracted from the user&apos;s financial records.
                  </li>
                  <li>
                    <strong className="text-foreground">Normalization:</strong> Features are normalized to a comparable scale.
                  </li>
                  <li>
                    <strong className="text-foreground">Distance Computation:</strong> Weighted Euclidean distance measures similarity to each financial archetype.
                  </li>
                  <li>
                    <strong className="text-foreground">Radial Basis Function (RBF):</strong> An RBF transformation converts distance into model scores.
                  </li>
                  <li>
                    <strong className="text-foreground">Softmax Probabilities:</strong> Softmax converts those scores into a class probability distribution.
                  </li>
                  <li>
                    <strong className="text-foreground">Prediction Selection:</strong> The archetype with the highest class likelihood becomes the selected ML prediction.
                  </li>
                </ol>
              </div>

              {/* Mathematical Formulation */}
              <div className="space-y-2 bg-background/70 rounded-lg p-3.5 border border-border/50">
                <h5 className="font-semibold text-foreground text-xs">Technical Formulas</h5>
                <p className="text-[11px] text-muted-foreground">
                  Architecture: Weighted Euclidean distance + RBF transformation + Softmax probability (Internal Model ID: <code className="font-mono text-foreground font-semibold">{modelVersion}</code>)
                </p>
                <div className="grid gap-2.5 sm:grid-cols-3 pt-1">
                  <div className="rounded border border-border/60 bg-muted/40 p-2.5">
                    <span className="text-[11px] font-medium text-foreground block">Weighted Euclidean Distance</span>
                    <code className="font-mono text-[11px] text-primary block mt-1">
                      d_k = √(Σ w_j(x_j − c_k,j)²)
                    </code>
                  </div>
                  <div className="rounded border border-border/60 bg-muted/40 p-2.5">
                    <span className="text-[11px] font-medium text-foreground block">RBF Transformation</span>
                    <code className="font-mono text-[11px] text-primary block mt-1">
                      z_k = −γd_k
                    </code>
                  </div>
                  <div className="rounded border border-border/60 bg-muted/40 p-2.5">
                    <span className="text-[11px] font-medium text-foreground block">Softmax Probability</span>
                    <code className="font-mono text-[11px] text-primary block mt-1">
                      P(k) = exp(z_k) / Σ exp(z_m)
                    </code>
                  </div>
                </div>
              </div>

              {/* System Roles & Distinctions */}
              <div className="space-y-2 bg-background/70 rounded-lg p-3.5 border border-border/50">
                <h5 className="font-semibold text-foreground text-xs">System Architecture &amp; Role Clarity</h5>
                <ul className="grid gap-1.5 sm:grid-cols-2 text-[11px] text-muted-foreground">
                  <li>
                    <strong className="text-foreground">Health Score:</strong> Deterministic 0–100 rubric across 5 weighted pillars.
                  </li>
                  <li>
                    <strong className="text-foreground">ML Archetype:</strong> Machine learning/statistical archetype classification.
                  </li>
                  <li>
                    <strong className="text-foreground">Spending Risk:</strong> Rule-based behavioral risk classification.
                  </li>
                  <li>
                    <strong className="text-foreground">Financial Forecast:</strong> Deterministic mathematical projection.
                  </li>
                  <li>
                    <strong className="text-foreground">Recommendations:</strong> Rule-based financial guidance.
                  </li>
                  <li>
                    <strong className="text-foreground">Market Insights:</strong> External live market-data retrieval.
                  </li>
                </ul>
              </div>

              <p className="pt-2 text-[11px] text-muted-foreground/80 italic border-t border-primary/10">
                WealthIQ ML predictions are explainable classifications comparing your current profile with benchmark archetypes. The model does not predict future income, future wealth, stock prices, market returns, or guaranteed financial outcomes.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
