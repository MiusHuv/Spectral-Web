import React, { useState, useEffect } from 'react';
import { cacheService, cacheWarmingService } from '../../services/cacheService';
import { apiClient } from '../../services/api';
import './CacheMonitor.css';

interface CacheMonitorProps {
  isVisible: boolean;
  onClose: () => void;
}

interface BackendCacheStats {
  cache_stats: {
    system_overall: {
      overall_hit_rate: number;
      total_requests: number;
      cache_efficiency: string;
    };
    multi_level_cache: {
      overall: {
        hit_rate: number;
        total_hits: number;
        total_misses: number;
      };
      l1_cache: {
        size: number;
        max_size: number;
        hit_rate: number;
      };
      l2_cache: {
        size: number;
        max_size: number;
        hit_rate: number;
      };
    };
    recommendations?: Array<{
      type: string;
      priority: string;
      message: string;
      suggested_actions: string[];
    }>;
  };
}

const CacheMonitor: React.FC<CacheMonitorProps> = ({ isVisible, onClose }) => {
  const [frontendStats, setFrontendStats] = useState<any>(null);
  const [backendStats, setBackendStats] = useState<BackendCacheStats | null>(null);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get frontend cache stats
      const frontendCacheStats = cacheService.getStats();
      const frontendOptimization = cacheService.getOptimizationSuggestions();
      
      setFrontendStats(frontendCacheStats);
      setOptimizationSuggestions(frontendOptimization);

      // Get backend cache stats
      try {
        const response = await fetch('/api/cache/stats');
        if (response.ok) {
          const backendData = await response.json();
          setBackendStats(backendData);
        }
      } catch (backendError) {
        console.warn('Failed to fetch backend cache stats:', backendError);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cache statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const warmCache = async () => {
    setIsLoading(true);
    try {
      // Warm frontend cache
      await cacheWarmingService.executeStrategies();

      // Warm backend cache
      try {
        await fetch('/api/cache/warming', { method: 'POST' });
      } catch (backendError) {
        console.warn('Failed to warm backend cache:', backendError);
      }

      // Refresh stats after warming
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to warm cache');
    } finally {
      setIsLoading(false);
    }
  };

  const clearCache = () => {
    cacheService.clear();
    fetchStats();
  };

  useEffect(() => {
    if (isVisible) {
      fetchStats();
    }
  }, [isVisible]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && isVisible) {
      interval = setInterval(fetchStats, 5000); // Refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, isVisible]);

  if (!isVisible) return null;

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

  return (
    <div className="cache-monitor-overlay">
      <div className="cache-monitor">
        <div className="cache-monitor-header">
          <h3>Cache Performance Monitor</h3>
          <div className="cache-monitor-controls">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <button onClick={fetchStats} disabled={isLoading}>
              Refresh
            </button>
            <button onClick={warmCache} disabled={isLoading}>
              Warm Cache
            </button>
            <button onClick={clearCache}>
              Clear Cache
            </button>
            <button onClick={onClose} className="close-button">
              ×
            </button>
          </div>
        </div>

        {error && (
          <div className="cache-monitor-error">
            Error: {error}
          </div>
        )}

        {isLoading && (
          <div className="cache-monitor-loading">
            Loading cache statistics...
          </div>
        )}

        {frontendStats && (
          <div className="cache-section">
            <h4>Frontend Cache (Multi-Level)</h4>
            <div className="cache-stats-grid">
              <div className="cache-stat-card">
                <h5>Overall Performance</h5>
                <div className="stat-item">
                  <span>Hit Rate:</span>
                  <span className={`stat-value ${frontendStats.overall.hitRate > 0.7 ? 'good' : 'warning'}`}>
                    {formatPercentage(frontendStats.overall.hitRate)}
                  </span>
                </div>
                <div className="stat-item">
                  <span>Total Requests:</span>
                  <span>{formatNumber(frontendStats.overall.totalRequests)}</span>
                </div>
              </div>

              <div className="cache-stat-card">
                <h5>L1 Cache (Fast)</h5>
                <div className="stat-item">
                  <span>Size:</span>
                  <span>{frontendStats.l1.size} / {frontendStats.l1.maxSize}</span>
                </div>
                <div className="stat-item">
                  <span>Hit Rate:</span>
                  <span className={`stat-value ${frontendStats.l1.hitRate > 0.8 ? 'good' : 'warning'}`}>
                    {formatPercentage(frontendStats.l1.hitRate)}
                  </span>
                </div>
                <div className="stat-item">
                  <span>Utilization:</span>
                  <span className={`stat-value ${(frontendStats.l1.size / frontendStats.l1.maxSize) > 0.9 ? 'warning' : 'good'}`}>
                    {formatPercentage(frontendStats.l1.size / frontendStats.l1.maxSize)}
                  </span>
                </div>
              </div>

              <div className="cache-stat-card">
                <h5>L2 Cache (Large)</h5>
                <div className="stat-item">
                  <span>Size:</span>
                  <span>{frontendStats.l2.size} / {frontendStats.l2.maxSize}</span>
                </div>
                <div className="stat-item">
                  <span>Hit Rate:</span>
                  <span className={`stat-value ${frontendStats.l2.hitRate > 0.6 ? 'good' : 'warning'}`}>
                    {formatPercentage(frontendStats.l2.hitRate)}
                  </span>
                </div>
                <div className="stat-item">
                  <span>Utilization:</span>
                  <span>{formatPercentage(frontendStats.l2.size / frontendStats.l2.maxSize)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {backendStats && (
          <div className="cache-section">
            <h4>Backend Cache</h4>
            <div className="cache-stats-grid">
              <div className="cache-stat-card">
                <h5>System Overall</h5>
                <div className="stat-item">
                  <span>Hit Rate:</span>
                  <span className={`stat-value ${backendStats.cache_stats.system_overall.overall_hit_rate > 0.7 ? 'good' : 'warning'}`}>
                    {formatPercentage(backendStats.cache_stats.system_overall.overall_hit_rate)}
                  </span>
                </div>
                <div className="stat-item">
                  <span>Total Requests:</span>
                  <span>{formatNumber(backendStats.cache_stats.system_overall.total_requests)}</span>
                </div>
                <div className="stat-item">
                  <span>Efficiency:</span>
                  <span className={`stat-value ${backendStats.cache_stats.system_overall.cache_efficiency === 'excellent' ? 'good' : 'warning'}`}>
                    {backendStats.cache_stats.system_overall.cache_efficiency}
                  </span>
                </div>
              </div>

              {backendStats.cache_stats.multi_level_cache && (
                <div className="cache-stat-card">
                  <h5>Backend Multi-Level</h5>
                  <div className="stat-item">
                    <span>L1 Size:</span>
                    <span>{backendStats.cache_stats.multi_level_cache.l1_cache.size} / {backendStats.cache_stats.multi_level_cache.l1_cache.max_size}</span>
                  </div>
                  <div className="stat-item">
                    <span>L2 Size:</span>
                    <span>{backendStats.cache_stats.multi_level_cache.l2_cache.size} / {backendStats.cache_stats.multi_level_cache.l2_cache.max_size}</span>
                  </div>
                  <div className="stat-item">
                    <span>Combined Hit Rate:</span>
                    <span>{formatPercentage(backendStats.cache_stats.multi_level_cache.overall.hit_rate)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {optimizationSuggestions && optimizationSuggestions.suggestions.length > 0 && (
          <div className="cache-section">
            <h4>Optimization Suggestions</h4>
            <div className="suggestions-list">
              {optimizationSuggestions.suggestions.map((suggestion: any, index: number) => (
                <div key={index} className={`suggestion-item priority-${suggestion.priority}`}>
                  <div className="suggestion-header">
                    <span className="suggestion-type">{suggestion.type.replace(/_/g, ' ')}</span>
                    <span className={`suggestion-priority priority-${suggestion.priority}`}>
                      {suggestion.priority}
                    </span>
                  </div>
                  <div className="suggestion-message">{suggestion.message}</div>
                  {suggestion.actions && (
                    <div className="suggestion-actions">
                      <strong>Suggested actions:</strong>
                      <ul>
                        {suggestion.actions.map((action: string, actionIndex: number) => (
                          <li key={actionIndex}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {optimizationSuggestions && optimizationSuggestions.hotKeys.length > 0 && (
          <div className="cache-section">
            <h4>Hot Keys (Most Accessed)</h4>
            <div className="hot-keys-list">
              {optimizationSuggestions.hotKeys.slice(0, 5).map((hotKey: any, index: number) => (
                <div key={index} className="hot-key-item">
                  <span className="hot-key-name">{hotKey.key}</span>
                  <span className="hot-key-frequency">{hotKey.frequency} accesses</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CacheMonitor;