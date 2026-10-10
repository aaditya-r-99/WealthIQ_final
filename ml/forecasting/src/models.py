"""
Forecasting Models & Baseline Implementations
WealthIQ — Phase 10 Offline Forecasting Benchmark

All models strictly take past history y_1 ... y_t and return 1-step-ahead forecast y_{t+1}.
Non-negative output clipping is applied across all models.
"""

import numpy as np
from scipy.optimize import minimize
from sklearn.linear_model import Ridge

class BaseForecaster:
    def __init__(self, name: str):
        self.name = name

    def predict(self, history: np.ndarray, dates: list[str] = None) -> float:
        raise NotImplementedError


class NaiveForecaster(BaseForecaster):
    """Next month equals the previous month's spending: y_{t+1} = y_t"""
    def __init__(self):
        super().__init__("Naive (Last Month)")

    def predict(self, history: np.ndarray, dates: list[str] = None) -> float:
        if len(history) == 0:
            return 0.0
        return float(max(0.0, history[-1]))


class SimpleMovingAverageForecaster(BaseForecaster):
    """Three-month simple moving average: y_{t+1} = 1/3 * sum(y_{t-2..t})"""
    def __init__(self, window: int = 3):
        super().__init__(f"{window}M Simple Moving Average")
        self.window = window

    def predict(self, history: np.ndarray, dates: list[str] = None) -> float:
        if len(history) == 0:
            return 0.0
        w = min(self.window, len(history))
        return float(max(0.0, np.mean(history[-w:])))


class ExponentialMovingAverageForecaster(BaseForecaster):
    """Six-month exponentially weighted moving average with alpha = 0.5"""
    def __init__(self, alpha: float = 0.5):
        super().__init__(f"6M EWMA (alpha={alpha})")
        self.alpha = alpha

    def predict(self, history: np.ndarray, dates: list[str] = None) -> float:
        n = len(history)
        if n == 0:
            return 0.0
        # Consider up to 6 months of history
        w = min(6, n)
        subset = history[-w:]
        ewma = subset[0]
        for val in subset[1:]:
            ewma = self.alpha * val + (1.0 - self.alpha) * ewma
        return float(max(0.0, ewma))


class SeasonalNaiveForecaster(BaseForecaster):
    """Seasonal naive forecast using same month of previous year (m = 12)"""
    def __init__(self, season: int = 12):
        super().__init__(f"Seasonal Naive ({season}M)")
        self.season = season

    def predict(self, history: np.ndarray, dates: list[str] = None) -> float:
        n = len(history)
        if n == 0:
            return 0.0
        if n >= self.season:
            return float(max(0.0, history[-self.season]))
        # Fallback to naive if fewer than 12 months available
        return float(max(0.0, history[-1]))


class RidgeLagForecaster(BaseForecaster):
    """Ridge regression with 3 lagged spending features and rolling 3M mean"""
    def __init__(self, lags: int = 3, alpha: float = 1.0):
        super().__init__(f"Ridge Lag Regression (Lags={lags}, alpha={alpha})")
        self.lags = lags
        self.alpha = alpha

    def _build_features(self, series: np.ndarray, dates: list[str] = None):
        X, y = [], []
        n = len(series)
        for i in range(self.lags, n):
            lag_feats = list(series[i - self.lags : i][::-1])  # [y_{i-1}, y_{i-2}, y_{i-3}]
            roll_mean = np.mean(series[i - self.lags : i])
            # Month of year cyclical features if dates provided
            if dates and len(dates) == n:
                m_num = int(dates[i].split("-")[1])
                sin_m = np.sin(2 * np.pi * m_num / 12)
                cos_m = np.cos(2 * np.pi * m_num / 12)
                feats = lag_feats + [roll_mean, sin_m, cos_m]
            else:
                feats = lag_feats + [roll_mean]
            X.append(feats)
            y.append(series[i])
        return np.array(X), np.array(y)

    def predict(self, history: np.ndarray, dates: list[str] = None) -> float:
        n = len(history)
        # Need at least lags + 2 observations to train
        if n < self.lags + 2:
            return float(max(0.0, np.mean(history[-min(3, n):])))

        X_train, y_train = self._build_features(history, dates)
        if len(X_train) == 0:
            return float(max(0.0, history[-1]))

        model = Ridge(alpha=self.alpha, fit_intercept=True)
        model.fit(X_train, y_train)

        # Build feature vector for step n (to predict n+1)
        latest_lags = list(history[-self.lags:][::-1])
        roll_mean = np.mean(history[-self.lags:])
        if dates and len(dates) >= n:
            # Predict next month number
            last_m = int(dates[n - 1].split("-")[1])
            next_m = 1 if last_m == 12 else (last_m + 1)
            sin_m = np.sin(2 * np.pi * next_m / 12)
            cos_m = np.cos(2 * np.pi * next_m / 12)
            next_feats = np.array([latest_lags + [roll_mean, sin_m, cos_m]])
        else:
            next_feats = np.array([latest_lags + [roll_mean]])

        pred = model.predict(next_feats)[0]
        return float(max(0.0, pred))


class HoltWintersForecaster(BaseForecaster):
    """
    Holt-Winters exponential smoothing:
    - Additive trend + seasonality when history >= 24 months
    - Holt's linear trend when history < 24 months
    """
    def __init__(self, season: int = 12):
        super().__init__(f"Holt-Winters Smoothing (m={season})")
        self.season = season

    def predict(self, history: np.ndarray, dates: list[str] = None) -> float:
        n = len(history)
        if n < 3:
            return float(max(0.0, history[-1] if n > 0 else 0.0))

        m = self.season
        if n < 2 * m:
            # Holt's linear trend model (level + slope)
            def loss(params):
                alpha, beta = params
                l, b = history[0], history[1] - history[0]
                sse = 0.0
                for t in range(1, n):
                    y_hat = l + b
                    sse += (history[t] - y_hat) ** 2
                    l_new = alpha * history[t] + (1.0 - alpha) * (l + b)
                    b = beta * (l_new - l) + (1.0 - beta) * b
                    l = l_new
                return sse

            res = minimize(loss, [0.3, 0.1], bounds=[(0.01, 0.99), (0.01, 0.99)], method="L-BFGS-B")
            alpha, beta = res.x
            l, b = history[0], history[1] - history[0]
            for t in range(1, n):
                l_new = alpha * history[t] + (1.0 - alpha) * (l + b)
                b = beta * (l_new - l) + (1.0 - beta) * b
                l = l_new
            return float(max(0.0, l + b))
        else:
            # Full Additive Holt-Winters with Annual Seasonality
            def loss(params):
                alpha, beta, gamma = params
                l = np.mean(history[:m])
                b = (history[m] - history[0]) / m
                s = list(history[:m] - l)
                sse = 0.0
                for t in range(m, n):
                    y_hat = l + b + s[t % m]
                    sse += (history[t] - y_hat) ** 2
                    l_new = alpha * (history[t] - s[t % m]) + (1.0 - alpha) * (l + b)
                    b_new = beta * (l_new - l) + (1.0 - beta) * b
                    s[t % m] = gamma * (history[t] - l_new) + (1.0 - gamma) * s[t % m]
                    l, b = l_new, b_new
                return sse

            res = minimize(
                loss,
                [0.3, 0.1, 0.2],
                bounds=[(0.01, 0.99), (0.01, 0.99), (0.01, 0.99)],
                method="L-BFGS-B",
            )
            alpha, beta, gamma = res.x
            l = np.mean(history[:m])
            b = (history[m] - history[0]) / m
            s = list(history[:m] - l)
            for t in range(m, n):
                l_new = alpha * (history[t] - s[t % m]) + (1.0 - alpha) * (l + b)
                b_new = beta * (l_new - l) + (1.0 - beta) * b
                s[t % m] = gamma * (history[t] - l_new) + (1.0 - gamma) * s[t % m]
                l, b = l_new, b_new

            pred = l + b + s[n % m]
            return float(max(0.0, pred))
