import { useEffect, useState } from 'react';
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

export default function EventForum({ eventId, rsvpStatus }) {
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [content, setContent]   = useState('');
  const [linkUrl, setLinkUrl]   = useState('');
  const [showLink, setShowLink] = useState(false);
  const [posting, setPosting]   = useState(false);
  const [postError, setPostError] = useState(null);

  const currentUserId   = localStorage.getItem('userId');
  const currentUserRole = localStorage.getItem('role');
  const canPost = rsvpStatus === 'going' || rsvpStatus === 'interested';

  useEffect(() => {
    api.get(`/api/events/${eventId}/posts`)
      .then(setPosts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventId]);

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
          <textarea
            className="ef-composer-input"
            placeholder="Share a question, tip, or update about this event..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
          />
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
          {canPost
            ? 'No posts yet — start the conversation!'
            : 'No posts yet.'}
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
              <p className="ef-post-content">{post.content}</p>
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
