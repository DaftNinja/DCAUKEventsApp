import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import './EventForum.css';

function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Avatar({ user }) {
  const initials = user.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';
  return user.avatarUrl
    ? <img src={user.avatarUrl} alt={user.name} className="ef-avatar" />
    : <div className="ef-avatar ef-avatar-initials">{initials}</div>;
}

function renderContent(text) {
  const parts = text.split(/(@[A-Za-z][A-Za-z0-9]*(?:\s[A-Za-z][A-Za-z0-9]*)?)/);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="ef-mention">{part}</span>
      : part
  );
}

export default function EventForum({ eventId, rsvpStatus }) {
  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [content, setContent]     = useState('');
  const [linkUrl, setLinkUrl]     = useState('');
  const [showLink, setShowLink]   = useState(false);
  const [posting, setPosting]     = useState(false);
  const [postError, setPostError] = useState(null);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery]       = useState('');
  const [mentionResults, setMentionResults]   = useState([]);
  const [mentionActive, setMentionActive]     = useState(false);
  const [mentionIndex, setMentionIndex]       = useState(0);
  const [mentionStart, setMentionStart]       = useState(null); // cursor pos of the @
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  const currentUserId   = localStorage.getItem('userId');
  const currentUserRole = localStorage.getItem('role');
  const canPost = rsvpStatus === 'going' || rsvpStatus === 'interested';

  useEffect(() => {
    api.get(`/api/events/${eventId}/posts`)
      .then(setPosts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMentionActive(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleContentChange(e) {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setContent(val);

    // Find if cursor is inside an @mention — look backwards from cursor
    const textBefore = val.slice(0, pos);
    const atMatch = textBefore.match(/@([A-Za-z][A-Za-z0-9 ]*)$/);

    if (atMatch) {
      const query = atMatch[1];
      const atPos = textBefore.lastIndexOf('@');
      setMentionStart(atPos);
      setMentionQuery(query);
      setMentionIndex(0);

      // Debounce search
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (query.length === 0) {
          setMentionResults([]);
          setMentionActive(false);
          return;
        }
        try {
          const results = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
          setMentionResults(results);
          setMentionActive(results.length > 0);
        } catch {
          setMentionActive(false);
        }
      }, 150);
    } else {
      setMentionActive(false);
      setMentionResults([]);
    }
  }

  function insertMention(user) {
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const before = content.slice(0, mentionStart);
    const after  = content.slice(pos);
    const inserted = `@${user.name} `;
    const newContent = before + inserted + after;
    setContent(newContent);
    setMentionActive(false);
    setMentionResults([]);

    // Restore focus and move cursor to after the inserted mention
    setTimeout(() => {
      ta.focus();
      const newPos = before.length + inserted.length;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  }

  function handleKeyDown(e) {
    if (!mentionActive) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(i => Math.min(i + 1, mentionResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (mentionResults[mentionIndex]) {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
      }
    } else if (e.key === 'Escape') {
      setMentionActive(false);
    }
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const newPost = await api.post(`/api/events/${eventId}/posts`, {
        content: content.trim(),
        linkUrl: linkUrl.trim() || undefined,
      });
      setPosts(prev => [newPost, ...prev]);
      setContent('');
      setLinkUrl('');
      setShowLink(false);
    } catch (err) {
      setPostError(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(postId) {
    try {
      await api.delete(`/api/events/${eventId}/posts/${postId}`);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  }

  return (
    <div className="ef-section">
      <div className="ef-header">
        <h3 className="ef-title">💬 Discussion</h3>
        <span className="ef-count">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</span>
      </div>

      {/* Composer */}
      {canPost ? (
        <form className="ef-composer" onSubmit={handlePost}>
          <div className="ef-composer-wrap" ref={dropdownRef}>
            <textarea
              ref={textareaRef}
              className="ef-composer-input"
              placeholder="Share a question, tip, or update… Use @Name to mention someone"
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              rows={3}
            />
            {/* @mention dropdown */}
            {mentionActive && mentionResults.length > 0 && (
              <div className="ef-mention-dropdown">
                {mentionResults.map((user, i) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`ef-mention-option ${i === mentionIndex ? 'active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); insertMention(user); }}
                  >
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt={user.name} className="ef-mention-avatar" />
                      : <div className="ef-mention-avatar ef-mention-initials">{user.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                    }
                    <div className="ef-mention-info">
                      <span className="ef-mention-name">{user.name}</span>
                      {user.headline && <span className="ef-mention-headline">{user.headline}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {showLink && (
            <input
              type="url"
              className="ef-link-input"
              placeholder="Add a link (optional) — https://..."
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
            />
          )}
          {postError && <p className="ef-post-error">{postError}</p>}
          <div className="ef-composer-actions">
            <button
              type="button"
              className="ef-link-btn"
              onClick={() => setShowLink(f => !f)}
            >
              🔗 {showLink ? 'Remove link' : 'Add link'}
            </button>
            <button
              type="submit"
              className="ef-post-btn"
              disabled={posting || !content.trim()}
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      ) : (
        <div className="ef-locked">
          <p>RSVP as Going or Interested to join the discussion.</p>
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <p className="ef-loading">Loading discussion...</p>
      ) : posts.length === 0 ? (
        <p className="ef-empty">
          {canPost ? 'No posts yet — start the conversation!' : 'No posts yet.'}
        </p>
      ) : (
        <div className="ef-posts">
          {posts.map(post => (
            <div key={post.id} className="ef-post">
              <div className="ef-post-header">
                <Avatar user={post.author} />
                <div className="ef-post-author">
                  <span className="ef-post-name">{post.author.name}</span>
                  {post.author.headline && (
                    <span className="ef-post-headline">{post.author.headline}</span>
                  )}
                </div>
                <span className="ef-post-time">{timeAgo(post.createdAt)}</span>
                {(post.author.id === currentUserId || currentUserRole === 'admin') && (
                  <button
                    className="ef-post-delete"
                    onClick={() => handleDelete(post.id)}
                    title="Delete post"
                  >×</button>
                )}
              </div>
              <p className="ef-post-content">{renderContent(post.content)}</p>
              {post.linkUrl && (
                <a
                  href={post.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ef-post-link"
                >
                  🔗 {post.linkUrl}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
