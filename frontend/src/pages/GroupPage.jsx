import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../api';
import './GroupPage.css';

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

export default function GroupPage() {
  const { slug } = useParams();
  const navigate  = useNavigate();
  const [group, setGroup]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState(null);
  const currentUserId   = localStorage.getItem('userId');
  const currentUserRole = localStorage.getItem('role');

  useEffect(() => {
    api.get(`/api/groups/${slug}`)
      .then(setGroup)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleJoin() {
    await api.post(`/api/groups/${slug}/join`);
    setGroup(g => ({ ...g, isMember: true, memberCount: g.memberCount + 1 }));
  }

  async function handleLeave() {
    await api.delete(`/api/groups/${slug}/join`);
    setGroup(g => ({ ...g, isMember: false, memberCount: Math.max(0, g.memberCount - 1) }));
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const newPost = await api.post(`/api/groups/${slug}/posts`, { content: content.trim() });
      setGroup(g => ({ ...g, posts: [newPost, ...g.posts] }));
      setContent('');
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

  if (loading) return <div className="group-page"><Navbar /><p className="gp-loading">Loading...</p></div>;
  if (error)   return <div className="group-page"><Navbar /><p className="gp-error">Error: {error}</p></div>;
  if (!group)  return <div className="group-page"><Navbar /><p className="gp-error">Group not found</p></div>;

  return (
    <div className="group-page">
      <Navbar showBack backTo="/groups" backLabel="← Groups" />
      <div className="gp-content">
        {/* Header */}
        <div className="gp-header">
          <div>
            <h1 className="gp-title">{group.name}</h1>
            {group.description && <p className="gp-description">{group.description}</p>}
            <p className="gp-meta">{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</p>
          </div>
          {group.isMember ? (
            <button className="gp-btn leave" onClick={handleLeave}>Leave group</button>
          ) : (
            <button className="gp-btn join" onClick={handleJoin}>Join group</button>
          )}
        </div>

        <div className="gp-body">
          {/* Posts feed */}
          <div className="gp-feed">
            {group.isMember && (
              <form className="gp-composer" onSubmit={handlePost}>
                <textarea
                  className="gp-composer-input"
                  placeholder="Share something with the group..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={3}
                />
                {postError && <p className="gp-post-error">{postError}</p>}
                <div className="gp-composer-footer">
                  <button type="submit" className="gp-post-btn" disabled={posting || !content.trim()}>
                    {posting ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </form>
            )}

            {group.posts.length === 0 ? (
              <p className="gp-empty">
                {group.isMember ? 'No posts yet — be the first to post!' : 'No posts yet. Join to participate.'}
              </p>
            ) : (
              <div className="gp-posts">
                {group.posts.map(post => (
                  <div key={post.id} className="gp-post">
                    <div className="gp-post-header">
                      {post.author.avatarUrl
                        ? <img src={post.author.avatarUrl} alt={post.author.name} className="gp-avatar" />
                        : <div className="gp-avatar gp-initials">
                            {post.author.name?.split(' ').map(n => n[0]).join('').slice(0,2) || '?'}
                          </div>
                      }
                      <div className="gp-post-author">
                        <span className="gp-author-name">{post.author.name}</span>
                        {post.author.headline && <span className="gp-author-headline">{post.author.headline}</span>}
                      </div>
                      <span className="gp-post-time">{timeAgo(post.createdAt)}</span>
                      {(post.author.id === currentUserId || currentUserRole === 'admin') && (
                        <button className="gp-post-delete" onClick={() => handleDeletePost(post.id)} title="Delete">×</button>
                      )}
                    </div>
                    <p className="gp-post-content">{post.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Members sidebar */}
          <div className="gp-sidebar">
            <h3 className="gp-sidebar-title">Members</h3>
            <div className="gp-members">
              {group.members.map(m => (
                <div key={m.id} className="gp-member">
                  {m.avatarUrl
                    ? <img src={m.avatarUrl} alt={m.name} className="gp-member-avatar" />
                    : <div className="gp-member-avatar gp-initials">
                        {m.name?.split(' ').map(n => n[0]).join('').slice(0,2) || '?'}
                      </div>
                  }
                  <div className="gp-member-info">
                    <span className="gp-member-name">{m.name}</span>
                    {m.company && <span className="gp-member-company">{m.company}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
