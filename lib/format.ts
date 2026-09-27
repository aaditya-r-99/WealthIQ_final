// ============================================================
// WealthIQ formatting utilities
// ============================================================

export function formatCurrency(value: number, currency = 'INR'): string {
  const safeValue = isNaN(value) || value === null || value === undefined ? 0 : value;
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(safeValue);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(safeValue);
}

export function formatNumber(value: number, decimals = 0): string {
  const safeValue = isNaN(value) || value === null || value === undefined ? 0 : value;
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(safeValue);
}

export function formatPercent(value: number, decimals = 1): string {
  const safeValue = isNaN(value) || value === null || value === undefined ? 0 : value;
  return `${(safeValue * 100).toFixed(decimals)}%`;
}

export function formatPercentRaw(value: number, decimals = 1): string {
  const safeValue = isNaN(value) || value === null || value === undefined ? 0 : value;
  return `${safeValue.toFixed(decimals)}%`;
}

export function formatEmergencyFundMonths(months: number): string {
  const safeMonths = isNaN(months) || months === null || months === undefined ? 0 : months;
  if (safeMonths < 1) {
    return '< 1 month';
  }
  const rounded = Math.round(safeMonths * 10) / 10;
  if (rounded === 1) {
    return '1 month';
  }
  return `${rounded} months`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getHealthCategoryColor(category: string): string {
  switch (category) {
    case 'Excellent':
      return 'text-success';
    case 'Healthy':
      return 'text-success';
    case 'Moderate':
      return 'text-warning';
    case 'Weak':
      return 'text-warning';
    case 'Critical':
      return 'text-danger';
    default:
      return 'text-muted-foreground';
  }
}

export function getHealthCategoryBg(category: string): string {
  switch (category) {
    case 'Excellent':
      return 'bg-success/10 text-success border-success/20';
    case 'Healthy':
      return 'bg-success/10 text-success border-success/20';
    case 'Moderate':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'Weak':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'Critical':
      return 'bg-danger/10 text-danger border-danger/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'Low':
      return 'bg-success/10 text-success border-success/20';
    case 'Medium':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'High':
      return 'bg-danger/10 text-danger border-danger/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-success';
  if (score >= 75) return 'text-success';
  if (score >= 60) return 'text-warning';
  if (score >= 40) return 'text-warning';
  return 'text-danger';
}

export function getScoreBg(score: number): string {
  if (score >= 75) return 'bg-success';
  if (score >= 60) return 'bg-warning';
  if (score >= 40) return 'bg-warning';
  return 'bg-danger';
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'High':
      return 'bg-danger/10 text-danger border-danger/20';
    case 'Medium':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'Low':
      return 'bg-success/10 text-success border-success/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}
