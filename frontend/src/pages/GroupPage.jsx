import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';
import './GroupPage.css';

function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Avatar({ user, size = 36 }) {
  const initials = user.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name} className="gpage-avatar" style={{ width: size, height: size }} />;
  }
  return (
    <div className="gpage-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

export default function GroupPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem('userId');
  const currentUserRole = localStorage.getItem('role');

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  // Post form
  const [postContent, setPostContent] = useState('');
  const [postLink, setPostLink] = useState('');
  const [postLinkTitle, setPostLinkTitle] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState(null);
  const [showAttach, setShowAttach] = useState(false);

  useEffect(() => {
    api.get(`/api/groups/${slug}`)
      .then(setGroup)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleToggleMembership() {
    setJoining(true);
    try {
      if (group.isMember) {
        await api.delete(`/api/groups/${slug}/join`);
        setGroup(g => ({ ...g, isMember: false, memberCount: g.memberCount - 1,
          members: g.members.filter(m => m.id !== currentUserId) }));
      } else {
        await api.post(`/api/groups/${slug}/join`);
        setGroup(g => ({ ...g, isMember: true, memberCount: g.memberCount + 1 }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setJoining(false);
    }
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!postContent.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const newPost = await api.post(`/api/groups/${slug}/posts`, {
        content:   postContent.trim(),
        linkUrl:   postLink.trim()      || undefined,
        linkTitle: postLinkTitle.trim() || undefined,
      });
      setGroup(g => ({ ...g, posts: [newPost, ...g.posts] }));
      setPostContent('');
      setPostLink('');
      setPostLinkTitle('');
      setShowAttach(false);
    } catch (err) {
      setPostError(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleDeletePost(postId) {
    try {
      await api.delete(`/api/groups/${slug}/posts/${postId}`);
      setGroup(g => ({ ...g, posts: g.posts.filter(p => p.id !== postId) }));
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  }

  if (loading) return <div className="gpage-page"><Navbar /><p className="gpage-loading">Loading...</p></div>;
  if (error)   return <div className="gpage-page"><Navbar /><p className="gpage-error">Error: {error}</p></div>;
  if (!group)  return null;

  return (
    <div className="gpage-page">
      <Navbar showBack backTo="/groups" backLabel="← Groups" />

      {/* Hero */}
      <div className="gpage-hero">
        {group.imageUrl && <img src={group.imageUrl} alt={group.name} className="gpage-hero-img" />}
        <div className="gpage-hero-content">
          <h1>{group.name}</h1>
          {group.description && <p>{group.description}</p>}
          <div className="gpage-hero-meta">
            <span>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</span>
            <button
              className={`gpage-join-btn ${group.isMember ? 'joined' : ''}`}
              onClick={handleToggleMembership}
              disabled={joining}
            >
              {joining ? '...' : group.isMember ? '✓ Member' : 'Join group'}
            </button>
          </div>
        </div>
      </div>

      <div className="gpage-layout">

        {/* Main — post feed */}
        <div className="gpage-main">

          {/* Post composer */}
          {group.isMember && (
            <div className="gpage-composer">
              <form onSubmit={handlePost}>
                <textarea
                  className="gpage-composer-input"
                  placeholder="Share something with the group..."
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  rows={3}
                />

                {showAttach && (
                  <div className="gpage-composer-extras">
                    <input
                      type="url"
                      placeholder="Link URL (optional)"
                      value={postLink}
                      onChange={e => setPostLink(e.target.value)}
                      className="gpage-composer-field"
                    />
                    <input
                      type="text"
                      placeholder="Link title (optional)"
                      value={postLinkTitle}
                      onChange={e => setPostLinkTitle(e.target.value)}
                      className="gpage-composer-field"
                    />
                  </div>
                )}

                {postError && <p className="gpage-post-error">{postError}</p>}

                <div className="gpage-composer-actions">
                  <button
                    type="button"
                    className="gpage-attach-btn"
                    onClick={() => setShowAttach(f => !f)}
                  >
                    🔗 Add link
                  </button>
                  <button
                    type="submit"
                    className="gpage-post-btn"
                    disabled={posting || !postContent.trim()}
                  >
                    {posting ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Posts */}
          {group.posts.length === 0 ? (
            <div className="gpage-empty-posts">
              <p>{group.isMember ? 'No posts yet — be the first to share something.' : 'Join the group to see and post updates.'}</p>
            </div>
          ) : (
            <div className="gpage-posts">
              {group.posts.map(post => (
                <div key={post.id} className="gpage-post">
                  <div className="gpage-post-header">
                    <Avatar user={post.author} />
                    <div className="gpage-post-author">
                      <span className="gpage-post-name">{post.author.name}</span>
                      {post.author.headline && (
                        <span className="gpage-post-headline">{post.author.headline}</span>
                      )}
                    </div>
                    <span className="gpage-post-time">{timeAgo(post.createdAt)}</span>
                    {(post.author.id === currentUserId || currentUserRole === 'admin') && (
                      <button
                        className="gpage-post-delete"
                        onClick={() => handleDeletePost(post.id)}
                        title="Delete post"
                      >×</button>
                    )}
                  </div>

                  <p className="gpage-post-content">{post.content}</p>

                  {post.linkUrl && (
                    <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className="gpage-post-link">
                      <span className="gpage-post-link-icon">🔗</span>
                      <span>{post.linkTitle || post.linkUrl}</span>
                    </a>
                  )}

                  {post.attachmentUrl && (
                    <a href={post.attachmentUrl} target="_blank" rel="noopener noreferrer" className="gpage-post-attachment">
                      📎 {post.attachmentName || 'Attachment'}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — members */}
        <aside className="gpage-sidebar">
          <div className="gpage-sidebar-card">
            <h3 className="gpage-sidebar-title">Members ({group.memberCount})</h3>
            <div className="gpage-members-list">
              {group.members.slice(0, 20).map(member => (
                <div key={member.id} className="gpage-member-row">
                  <Avatar user={member} size={32} />
                  <div className="gpage-member-info">
                    <span className="gpage-member-name">{member.name}</span>
                    {member.company && <span className="gpage-member-co">{member.company}</span>}
                  </div>
                </div>
              ))}
              {group.memberCount > 20 && (
                <p className="gpage-members-more">+{group.memberCount - 20} more</p>
              )}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
