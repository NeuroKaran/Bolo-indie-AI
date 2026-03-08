import { useState, useEffect } from 'react';
import { ArrowLeft, Users, MessageSquare, Clock, TrendingUp, Globe, AlertCircle, Activity, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

/**
 * Admin Dashboard — Hidden monitoring panel (Ctrl+Shift+A)
 * Shows real multi-user analytics from Supabase DB
 */
export default function AdminDashboard({ onBack }) {
    const [stats, setStats] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    const [languageStats, setLanguageStats] = useState([]);
    const [dailyUsage, setDailyUsage] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Total users
            const { count: totalUsers } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            // Total prompts
            const { count: totalPrompts } = await supabase
                .from('prompts')
                .select('*', { count: 'exact', head: true });

            // Today's active users
            const today = new Date().toISOString().slice(0, 10);
            const { data: todayLogs } = await supabase
                .from('usage_logs')
                .select('user_id')
                .gte('created_at', `${today}T00:00:00`)
                .limit(1000);
            const activeToday = new Set(todayLogs?.map(l => l.user_id) || []).size;

            // Average latencies
            const { data: latencyData } = await supabase
                .from('usage_logs')
                .select('event_type, stt_latency_ms, llm_latency_ms')
                .in('event_type', ['stt_call', 'llm_call'])
                .order('created_at', { ascending: false })
                .limit(100);

            const sttLatencies = (latencyData || []).filter(l => l.stt_latency_ms).map(l => l.stt_latency_ms);
            const llmLatencies = (latencyData || []).filter(l => l.llm_latency_ms).map(l => l.llm_latency_ms);
            const avgStt = sttLatencies.length > 0 ? Math.round(sttLatencies.reduce((a, b) => a + b, 0) / sttLatencies.length) : 0;
            const avgLlm = llmLatencies.length > 0 ? Math.round(llmLatencies.reduce((a, b) => a + b, 0) / llmLatencies.length) : 0;

            // Error rates
            const { count: sttErrors } = await supabase
                .from('usage_logs')
                .select('*', { count: 'exact', head: true })
                .eq('event_type', 'stt_error');
            const { count: sttTotal } = await supabase
                .from('usage_logs')
                .select('*', { count: 'exact', head: true })
                .in('event_type', ['stt_call', 'stt_error']);
            const sttSuccessRate = sttTotal > 0 ? Math.round(((sttTotal - (sttErrors || 0)) / sttTotal) * 100) : 100;

            setStats({
                totalUsers: totalUsers || 0,
                totalPrompts: totalPrompts || 0,
                activeToday,
                avgSttLatency: avgStt,
                avgLlmLatency: avgLlm,
                sttSuccessRate,
            });

            // Language distribution
            const { data: langData } = await supabase
                .from('usage_logs')
                .select('language_code')
                .not('language_code', 'is', null)
                .limit(500);

            const langCounts = {};
            (langData || []).forEach(l => {
                const lang = l.language_code || 'unknown';
                langCounts[lang] = (langCounts[lang] || 0) + 1;
            });
            const sortedLangs = Object.entries(langCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([code, count]) => ({ code, count }));
            setLanguageStats(sortedLangs);

            // Daily usage (last 7 days)
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().slice(0, 10);
                const { count } = await supabase
                    .from('prompts')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', `${dateStr}T00:00:00`)
                    .lt('created_at', `${dateStr}T23:59:59`);
                days.push({
                    date: dateStr,
                    label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
                    count: count || 0,
                });
            }
            setDailyUsage(days);

            // Recent activity
            const { data: recent } = await supabase
                .from('usage_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(15);
            setRecentActivity(recent || []);

            setLastRefresh(new Date());
        } catch (err) {
            console.error('[Admin] Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const maxDailyCount = Math.max(...dailyUsage.map(d => d.count), 1);

    const LANG_LABELS = {
        'unknown': 'Auto-detect',
        'hi-IN': 'Hindi',
        'en-IN': 'English',
        'bn-IN': 'Bengali',
        'ta-IN': 'Tamil',
        'te-IN': 'Telugu',
        'kn-IN': 'Kannada',
        'ml-IN': 'Malayalam',
        'mr-IN': 'Marathi',
        'gu-IN': 'Gujarati',
        'pa-IN': 'Punjabi',
    };

    const EVENT_LABELS = {
        'stt_call': '🗣️ STT Call',
        'stt_error': '❌ STT Error',
        'llm_call': '🧠 LLM Call',
        'prompt_generated': '✨ Prompt Generated',
    };

    const LANG_COLORS = ['#FF9933', '#FF6F00', '#E65100', '#BF360C', '#4CAF50', '#2196F3', '#9C27B0', '#FF5722'];

    return (
        <div className="admin-dashboard">
            {/* Header */}
            <div className="admin-header">
                <button className="btn btn-secondary btn-sm" onClick={onBack}>
                    <ArrowLeft size={16} /> Back
                </button>
                <h1 className="admin-title">📊 Bolo Admin Dashboard</h1>
                <div className="admin-refresh">
                    <span className="admin-refresh-time">
                        Updated {lastRefresh.toLocaleTimeString('en-IN')}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={fetchDashboardData} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                    </button>
                </div>
            </div>

            {loading && !stats ? (
                <div className="admin-loading">
                    <div className="spinner" />
                    <p>Loading dashboard data...</p>
                </div>
            ) : (
                <>
                    {/* Overview Cards */}
                    <div className="admin-cards">
                        <div className="admin-card">
                            <div className="admin-card-icon"><Users size={20} /></div>
                            <div className="admin-card-value">{stats?.totalUsers || 0}</div>
                            <div className="admin-card-label">Total Users</div>
                        </div>
                        <div className="admin-card">
                            <div className="admin-card-icon"><MessageSquare size={20} /></div>
                            <div className="admin-card-value">{stats?.totalPrompts || 0}</div>
                            <div className="admin-card-label">Total Prompts</div>
                        </div>
                        <div className="admin-card">
                            <div className="admin-card-icon"><Activity size={20} /></div>
                            <div className="admin-card-value">{stats?.activeToday || 0}</div>
                            <div className="admin-card-label">Active Today</div>
                        </div>
                        <div className="admin-card">
                            <div className="admin-card-icon"><TrendingUp size={20} /></div>
                            <div className="admin-card-value">{stats?.sttSuccessRate || 100}%</div>
                            <div className="admin-card-label">STT Success Rate</div>
                        </div>
                    </div>

                    {/* Middle Row — Charts */}
                    <div className="admin-charts-row">
                        {/* Daily Usage Bar Chart */}
                        <div className="admin-panel">
                            <h3 className="admin-panel-title">
                                <Clock size={16} /> Prompts — Last 7 Days
                            </h3>
                            <div className="admin-bar-chart">
                                {dailyUsage.map(day => (
                                    <div key={day.date} className="admin-bar-col">
                                        <div className="admin-bar-value">{day.count}</div>
                                        <div className="admin-bar-wrapper">
                                            <div
                                                className="admin-bar"
                                                style={{ height: `${(day.count / maxDailyCount) * 100}%` }}
                                            />
                                        </div>
                                        <div className="admin-bar-label">{day.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Language Distribution */}
                        <div className="admin-panel">
                            <h3 className="admin-panel-title">
                                <Globe size={16} /> Language Distribution
                            </h3>
                            <div className="admin-lang-list">
                                {languageStats.length > 0 ? languageStats.map((lang, i) => {
                                    const total = languageStats.reduce((a, b) => a + b.count, 0);
                                    const pct = Math.round((lang.count / total) * 100);
                                    return (
                                        <div key={lang.code} className="admin-lang-item">
                                            <span className="admin-lang-name">
                                                {LANG_LABELS[lang.code] || lang.code}
                                            </span>
                                            <div className="admin-lang-bar-wrapper">
                                                <div
                                                    className="admin-lang-bar"
                                                    style={{
                                                        width: `${pct}%`,
                                                        backgroundColor: LANG_COLORS[i % LANG_COLORS.length],
                                                    }}
                                                />
                                            </div>
                                            <span className="admin-lang-pct">{pct}%</span>
                                        </div>
                                    );
                                }) : (
                                    <p className="admin-empty">No language data yet</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row — Latency & Activity */}
                    <div className="admin-charts-row">
                        {/* Latency Monitor */}
                        <div className="admin-panel">
                            <h3 className="admin-panel-title">
                                <AlertCircle size={16} /> Latency Monitor
                            </h3>
                            <div className="admin-latency-grid">
                                <div className="admin-latency-item">
                                    <div className="admin-latency-label">STT Avg</div>
                                    <div className={`admin-latency-value ${(stats?.avgSttLatency || 0) > 3000 ? 'slow' : 'fast'}`}>
                                        {stats?.avgSttLatency || 0}ms
                                    </div>
                                    <div className="admin-latency-indicator">
                                        {(stats?.avgSttLatency || 0) < 2000 ? '🟢 Fast' :
                                            (stats?.avgSttLatency || 0) < 4000 ? '🟡 OK' : '🔴 Slow'}
                                    </div>
                                </div>
                                <div className="admin-latency-item">
                                    <div className="admin-latency-label">LLM Avg</div>
                                    <div className={`admin-latency-value ${(stats?.avgLlmLatency || 0) > 5000 ? 'slow' : 'fast'}`}>
                                        {stats?.avgLlmLatency || 0}ms
                                    </div>
                                    <div className="admin-latency-indicator">
                                        {(stats?.avgLlmLatency || 0) < 3000 ? '🟢 Fast' :
                                            (stats?.avgLlmLatency || 0) < 6000 ? '🟡 OK' : '🔴 Slow'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="admin-panel">
                            <h3 className="admin-panel-title">
                                <Activity size={16} /> Recent Activity
                            </h3>
                            <div className="admin-activity-feed">
                                {recentActivity.length > 0 ? recentActivity.map(event => (
                                    <div key={event.id} className="admin-activity-item">
                                        <span className="admin-activity-event">
                                            {EVENT_LABELS[event.event_type] || event.event_type}
                                        </span>
                                        <span className="admin-activity-time">
                                            {new Date(event.created_at).toLocaleTimeString('en-IN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                )) : (
                                    <p className="admin-empty">No activity yet</p>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
