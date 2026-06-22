import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';
import './NewsPage.css';

const SOURCE_COLORS = {
  'Data Centre Dynamics':       '#0ea5e9',
  'Data Centre Magazine':       '#8b5cf6',
  'BizClik Media — Data Centre':'#06b6d4',
  'ITPro — Data Centre':        '#f59e0b',
  'ComputerWeekly — Data Centre':'#10b981',
  'The Register — Data Centre': '#ef4444',
  'DatacenterKnowledge':        '#6366f1',
};

function sourceColor(source) {
  return SOURCE_COLORS[source] || '#64748b';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NewsPage() {
  const navigate = useNavigate();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('all');
  const [saved, setSaved]     = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('savedNews') || '[]')); }
    catch { return new Set(); }
  });
  const [showSaved, setShowSaved] = useState(false);

  function toggleSave(e, id) {
    e.preventDefault();
    e.stopPropagation();
    setSaved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('savedNews', JSON.stringify([...next]));
      return next;
    });
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return; }

    api.get('/api/news')
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const sources = ['all', ...new Set(items.map(i => i.source))].slice(0, 8);
  const filtered = showSaved
    ? items.filter(i => saved.has(i.id))
    : filter === 'all' ? items : items.filter(i => i.source === filter);

  if (loading) return <div className="news-page"><Navbar /><p className="news-loading">Loading news...</p></div>;
  if (error)   return <div className="news-page"><Navbar /><p className="news-error">Error: {error}</p></div>;

  return (
    <div className="news-page">
      <Navbar />
      <div className="news-body">
        <div className="news-header">
          <div>
            <h1>Industry News</h1>
            <p className="news-subtitle">Latest news from the events industry</p>
          </div>
        </div>

        {/* Source filter */}
        <div className="news-filters">
          <button
            className={`news-filter-btn ${showSaved ? 'active saved-active' : ''}`}
            onClick={() => { setShowSaved(true); setFilter('all'); }}
          >
            🔖 Saved {saved.size > 0 && <span className="news-saved-count">{saved.size}</span>}
          </button>
          {sources.map(s => (
            <button
              key={s}
              className={`news-filter-btn ${!showSaved && filter === s ? 'active' : ''}`}
              onClick={() => { setFilter(s); setShowSaved(false); }}
              style={!showSaved && filter === s && s !== 'all' ? {
                background: sourceColor(s) + '20',
                color: sourceColor(s),
                borderColor: sourceColor(s) + '40',
              } : {}}
            >
              {s === 'all' ? 'All sources' : s}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="news-empty">
            <p>No news items yet — check back soon.</p>
          </div>
        ) : (
          <div className="news-grid">
            {filtered.map(item => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-card"
              >
                {item.imageUrl && (
                  <div className="news-card-image">
                    <img src={item.imageUrl} alt="" loading="lazy" />
                  </div>
                )}
                <div className="news-card-body">
                  <div className="news-card-meta">
                    <span
                      className="news-source"
                      style={{ color: sourceColor(item.source) }}
                    >
                      {item.source}
                    </span>
                    <div className="news-card-meta-right">
                      <span className="news-time">{timeAgo(item.publishedAt)}</span>
                      <button
                        className={`news-bookmark-btn ${saved.has(item.id) ? 'saved' : ''}`}
                        onClick={e => toggleSave(e, item.id)}
                        title={saved.has(item.id) ? 'Remove bookmark' : 'Save article'}
                      >
                        {saved.has(item.id) ? '🔖' : '📎'}
                      </button>
                    </div>
                  </div>
                  <h3 className="news-card-title">{item.title}</h3>
                  {item.summary && (
                    <p className="news-card-summary">{item.summary}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
