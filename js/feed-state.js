/**
 * NOVA Space Observatory — Unified Client Feed Store (js/feed-state.js)
 * Single source of truth for rendered dispatches, active filters,
 * optimistic updates, live polling updates, and dependent widget synchronization.
 */

export class FeedState {
  constructor() {
    this.posts = [];
    this.pendingNewPosts = [];
    this.activeFilters = {
      tab: 'global', // 'global' | 'following'
      category: 'All', // 'All' | 'Planets' | etc.
      sort: 'new', // 'new' | 'hot' | 'top'
      agency: '', // agency slug
      search: ''
    };
    this.layout = localStorage.getItem('nova_feed_layout') || (window.innerWidth >= 1600 ? 'grid' : 'list');
    if (!['list', 'grid', 'compact'].includes(this.layout)) {
      this.layout = 'grid';
    }
    this.postsToday = 0;
    this.subscribers = new Set();
    this.followedAgencies = new Set();
    this.currentUser = null;
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.notify('user_updated', user);
  }

  setFollowedAgencies(slugsOrIds) {
    this.followedAgencies = new Set(slugsOrIds);
    this.notify('followed_agencies_updated', this.followedAgencies);
  }

  setFilter(key, value) {
    if (this.activeFilters[key] === value) return;
    this.activeFilters[key] = value;
    this.notify('filter_changed', { key, value, filters: { ...this.activeFilters } });
  }

  setLayout(layout) {
    if (!['list', 'grid', 'compact'].includes(layout)) return;
    this.layout = layout;
    try {
      localStorage.setItem('nova_feed_layout', layout);
    } catch (e) {}
    this.notify('layout_changed', { layout });
  }

  setPosts(posts) {
    this.posts = [...posts];
    this.notify('posts_loaded', { posts: this.posts });
  }

  getPosts() {
    return this.posts;
  }

  matchesFilters(post, customFilters = null) {
    const filters = customFilters || this.activeFilters;

    // 1. Tab filter (following)
    if (filters.tab === 'following') {
      const isAuthor = this.currentUser && (
        String(post.user_id) === String(this.currentUser.id) ||
        (post.author && String(post.author.id) === String(this.currentUser.id))
      );
      const followsAg = post.user_follows_agency ||
        (post.agency && post.agency.is_following) ||
        this.followedAgencies.has(post.agency_slug || (post.agency && post.agency.slug));

      if (!isAuthor && !followsAg) {
        return false;
      }
    }

    // 2. Agency filter
    if (filters.agency) {
      const postSlug = (post.agency_slug || (post.agency && post.agency.slug) || '').toLowerCase();
      if (postSlug !== filters.agency.toLowerCase()) {
        return false;
      }
    }

    // 3. Category / Topic filter
    if (filters.category && filters.category !== 'All') {
      const postCat = (post.topic || post.category || '').toLowerCase();
      if (postCat !== filters.category.toLowerCase()) {
        return false;
      }
    }

    // 4. Search query
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      const title = (post.title || '').toLowerCase();
      const body = (post.body || '').toLowerCase();
      const author = (post.author_nickname || (post.author && post.author.nickname) || '').toLowerCase();
      if (!title.includes(q) && !body.includes(q) && !author.includes(q)) {
        return false;
      }
    }

    return true;
  }

  getVisiblePosts() {
    const filtered = this.posts.filter(p => this.matchesFilters(p));

    // Sort order:
    // If sort is 'hot' or 'top', session new posts (_isSessionNew) stay pinned at the top for this session!
    const sessionNew = filtered.filter(p => p._isSessionNew);
    const regular = filtered.filter(p => !p._isSessionNew);

    let sortedRegular = regular;
    if (this.activeFilters.sort === 'top') {
      sortedRegular = [...regular].sort((a, b) => {
        const scoreA = (a.score || a.likes_count || 0) * 2 + (a.comment_count || a.comments_count || 0);
        const scoreB = (b.score || b.likes_count || 0) * 2 + (b.comment_count || b.comments_count || 0);
        return scoreB - scoreA;
      });
    } else if (this.activeFilters.sort === 'hot') {
      sortedRegular = [...regular].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime() || 0;
        const timeB = new Date(b.created_at).getTime() || 0;
        const hoursA = Math.max(0.1, (Date.now() - timeA) / 3600000);
        const hoursB = Math.max(0.1, (Date.now() - timeB) / 3600000);
        const hotA = ((a.score || a.likes_count || 0) * 2 + (a.comment_count || a.comments_count || 0) + 1) / (1 + hoursA);
        const hotB = ((b.score || b.likes_count || 0) * 2 + (b.comment_count || b.comments_count || 0) + 1) / (1 + hoursB);
        return hotB - hotA;
      });
    } else {
      // 'new' sort
      sortedRegular = [...regular].sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    return [...sessionNew, ...sortedRegular];
  }

  addPostOptimistic(post) {
    post._isSessionNew = true;
    const exists = this.posts.some(p => p.id === post.id);
    if (!exists) {
      this.posts.unshift(post);
    }
    const matches = this.matchesFilters(post);

    this.notify('post_added_optimistic', { post, matches });
    return { matches, post };
  }

  addPendingUpdates(newPosts) {
    const existingIds = new Set([...this.posts.map(p => p.id), ...this.pendingNewPosts.map(p => p.id)]);
    const genuinelyNew = newPosts.filter(p => !existingIds.has(p.id) && this.matchesFilters(p));
    if (genuinelyNew.length === 0) return 0;

    this.pendingNewPosts.push(...genuinelyNew);
    this.notify('pending_updates_count', { count: this.pendingNewPosts.length, pending: this.pendingNewPosts });
    return this.pendingNewPosts.length;
  }

  flushPendingUpdates() {
    if (this.pendingNewPosts.length === 0) return [];
    const flushed = [...this.pendingNewPosts];
    flushed.forEach(p => { p._isSessionNew = true; });
    this.pendingNewPosts = [];

    const existingIds = new Set(this.posts.map(p => p.id));
    const toPrepend = flushed.filter(p => !existingIds.has(p.id));
    this.posts.unshift(...toPrepend);

    this.notify('pending_flushed', { posts: toPrepend });
    return toPrepend;
  }

  updatePostStats(updates) {
    if (!updates) return;
    const list = Array.isArray(updates) ? updates : Object.entries(updates).map(([id, s]) => ({ id: Number(id), ...s }));
    if (list.length === 0) return;
    const changed = [];
    list.forEach(u => {
      const p = this.posts.find(post => post.id === u.id);
      if (p) {
        let hasChange = false;
        const newScore = u.score !== undefined ? u.score : u.likes_count;
        if (newScore !== undefined && p.score !== newScore) {
          p.score = newScore;
          p.likes_count = newScore;
          hasChange = true;
        }
        const newComments = u.comment_count !== undefined ? u.comment_count : u.comments_count;
        if (newComments !== undefined && p.comment_count !== newComments) {
          p.comment_count = newComments;
          p.comments_count = newComments;
          hasChange = true;
        }
        if (u.user_liked !== undefined) {
          p.user_liked = u.user_liked;
          p.viewer_vote = u.viewer_vote !== undefined ? u.viewer_vote : (u.user_liked ? 1 : 0);
          hasChange = true;
        }
        if (hasChange) changed.push(p);
      }
    });

    if (changed.length > 0) {
      this.notify('stats_updated', { updates: list, changed });
    }
  }

  updateStats(stats) {
    this.updatePostStats(stats);
  }

  likePostOptimistic(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return null;
    const prevLiked = !!post.user_liked;
    post.user_liked = !prevLiked;
    post.viewer_vote = post.user_liked ? 1 : 0;
    post.likes_count = Math.max(0, (post.likes_count || 0) + (post.user_liked ? 1 : -1));
    post.score = post.likes_count;
    this.notify('post_liked', { post, postId });
    return post;
  }

  deletePost(postId) {
    const idx = this.posts.findIndex(p => p.id === postId);
    let deleted = null;
    if (idx !== -1) {
      deleted = this.posts.splice(idx, 1)[0];
    }
    this.pendingNewPosts = this.pendingNewPosts.filter(p => p.id !== postId);
    this.notify('post_deleted', { postId, deleted });
    return deleted;
  }

  addComment(postId, comment) {
    const post = this.posts.find(p => p.id === postId);
    if (post) {
      if (!Array.isArray(post.comments)) post.comments = [];
      post.comments.push(comment);
      post.comments_count = (post.comments_count || 0) + 1;
      post.comment_count = post.comments_count;
      this.notify('comment_added', { post, postId, comment });
    }
  }

  getLatestPostId() {
    if (this.posts.length === 0) return 0;
    return Math.max(...this.posts.map(p => p.id || 0));
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  notify(event, data) {
    this.subscribers.forEach(fn => {
      try {
        fn(event, data);
      } catch (err) {
        console.error('[FeedState] Subscriber error:', err);
      }
    });
  }
}

export const feedState = new FeedState();
if (typeof window !== 'undefined') {
  window.feedState = feedState;
}
