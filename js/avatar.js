/**
 * NOVA Space Observatory — Shared Avatar & Agency Logo Component (js/avatar.js)
 * Strict 2px corners, 1px hairline border, monospace fallback, dark background, zero emoji.
 * High-DPI srcset, explicit width/height, lazy loading, async decoding, graceful onerror fallback.
 */

export const AVATAR_PALETTE = [
  '#5cc8ff', // NOVA Cyan
  '#a78bfa', // NOVA Violet
  '#2dd4bf', // NOVA Teal
  '#fbbf24', // NOVA Amber
  '#38bdf8', // NOVA Sky
  '#ec4899', // NOVA Rose
  '#34d399', // NOVA Emerald
  '#c084fc'  // NOVA Purple
];

export const SIZES = {
  xs: { px: 20, s1: 32, s2: 64 },
  sm: { px: 28, s1: 32, s2: 64 },
  md: { px: 40, s1: 64, s2: 128 },
  lg: { px: 64, s1: 64, s2: 128 },
  xl: { px: 120, s1: 128, s2: 256 }
};

export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function hashNickname(nick) {
  if (!nick) return 0;
  let hash = 0;
  const str = String(nick).trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getColor(nick) {
  if (!nick) return AVATAR_PALETTE[0];
  const h = hashNickname(nick);
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function getInitials(nick) {
  if (!nick) return 'O';
  const clean = String(nick).replace(/^@+/, '').trim();
  return clean ? clean.charAt(0).toUpperCase() : 'O';
}

export function getAgencyInitials(agency) {
  if (!agency) return 'GEN';
  const raw = agency.brand_initials || agency.logo_initials || agency.short_code || agency.code || agency.slug || 'GEN';
  return String(raw).toUpperCase().slice(0, 4);
}

export function resolveSize(sizeName) {
  return SIZES[sizeName] || SIZES.md;
}

/**
 * Generates a stable /media URL with optional cache-buster timestamp
 */
export function buildUserAvatarUrl(user, sizeNum = 64) {
  if (!user || (!user.id && !user.user_id)) return null;
  const uid = user.id || user.user_id;
  let url = `/media/avatar/${encodeURIComponent(uid)}?s=${sizeNum}`;
  const v = user.avatar_updated_at || user.updated_at;
  if (v) {
    try {
      const ts = typeof v === 'number' ? Math.floor(v) : Math.floor(new Date(v).getTime() / 1000);
      if (!isNaN(ts) && ts > 0) url += `&v=${ts}`;
    } catch (e) {}
  }
  return url;
}

export function buildAgencyLogoUrl(agency, sizeNum = 64) {
  if (!agency) return null;
  const slug = agency.slug || (agency.code ? agency.code.toLowerCase() : 'general');
  let url = `/media/agency/${encodeURIComponent(slug)}/logo?s=${sizeNum}`;
  const v = agency.logo_updated_at || agency.updated_at;
  if (v) {
    try {
      const ts = typeof v === 'number' ? Math.floor(v) : Math.floor(new Date(v).getTime() / 1000);
      if (!isNaN(ts) && ts > 0) url += `&v=${ts}`;
    } catch (e) {}
  }
  return url;
}

/**
 * Global onerror fallback handler for avatar images
 */
export function handleImgError(img) {
  if (!img || img.__fallbackHandled) return;
  img.__fallbackHandled = true;

  const nick = img.getAttribute('data-nickname') || '';
  const initial = getInitials(nick);
  const color = img.getAttribute('data-color') || getColor(nick);
  const sizeCls = img.getAttribute('data-size-class') || 'nova-avatar--md';

  const span = document.createElement('span');
  span.className = `nova-avatar ${sizeCls} nova-avatar--default`;
  span.style.setProperty('--avatar-accent', color);
  span.style.borderColor = color;
  span.style.color = color;
  span.textContent = initial;

  if (img.parentNode) {
    img.parentNode.replaceChild(span, img);
  }
}

/**
 * Global onerror fallback handler for agency logo images
 */
export function handleAgencyImgError(img) {
  if (!img || img.__fallbackHandled) return;
  img.__fallbackHandled = true;

  const code = img.getAttribute('data-initials') || 'GEN';
  const sizeCls = img.getAttribute('data-size-class') || 'nova-avatar--md';

  const span = document.createElement('span');
  span.className = `nova-avatar ${sizeCls} nova-avatar--agency-badge`;
  span.textContent = code;

  if (img.parentNode) {
    img.parentNode.replaceChild(span, img);
  }
}

/**
 * Renders User Avatar component
 * @param {Object} user - User object with id, nickname, avatar_url, avatar_color, role, etc.
 * @param {Object} [options] - Options: size ('xs','sm','md','lg','xl'), statusDot, curatorBadge, link, alt, className
 * @returns {string} HTML string
 */
export function render(user, options = {}) {
  const u = user || {};
  const nick = u.nickname || u.author_nickname || (u.author && u.author.nickname) || 'observer';
  const initial = getInitials(nick);
  const sizeKey = options.size || 'md';
  const sizeCfg = resolveSize(sizeKey);
  const color = u.avatar_color || (u.author && u.author.avatar_color) || getColor(nick);
  const extraClass = options.className ? ` ${options.className}` : '';
  const altText = options.alt || `Avatar of @${escapeHTML(nick)}`;

  const hasAvatar = Boolean(
    u.has_avatar !== false &&
    (u.avatar_url || (u.author && u.author.avatar_url) || u.avatar_key || u.id || (u.author && u.author.id))
  );

  let avatarInner = '';
  if (hasAvatar && (u.id || (u.author && u.author.id))) {
    const targetUser = u.id ? u : u.author;
    const src1x = buildUserAvatarUrl(targetUser, sizeCfg.s1);
    const src2x = buildUserAvatarUrl(targetUser, sizeCfg.s2);

    avatarInner = `
      <img class="nova-avatar nova-avatar--${sizeKey}${extraClass}"
           src="${src1x}"
           srcset="${src1x} 1x, ${src2x} 2x"
           width="${sizeCfg.px}"
           height="${sizeCfg.px}"
           alt="${altText}"
           loading="lazy"
           decoding="async"
           data-nickname="${escapeHTML(nick)}"
           data-color="${escapeHTML(color)}"
           data-size-class="nova-avatar--${sizeKey}"
           onerror="window.NovaAvatar ? window.NovaAvatar.handleImgError(this) : null" />
    `;
  } else {
    avatarInner = `
      <span class="nova-avatar nova-avatar--${sizeKey} nova-avatar--default${extraClass}"
            style="--avatar-accent: ${color}; border-color: ${color}; color: ${color};"
            role="img"
            aria-label="${altText}">
        ${initial}
      </span>
    `;
  }

  const isCurator = (u.role === 'curator' || (u.author && u.author.role === 'curator'));
  const showCuratorBadge = options.curatorBadge && isCurator;
  const showStatusDot = options.statusDot === true;

  let html = `
    <span class="nova-avatar-wrap">
      ${avatarInner}
      ${showStatusDot ? '<span class="nova-avatar-status-dot" title="Observer Online"></span>' : ''}
      ${showCuratorBadge ? '<span class="nova-avatar-curator-badge">CURATOR</span>' : ''}
    </span>
  `;

  if (options.link) {
    const linkUrl = `/u/${encodeURIComponent(nick)}`;
    html = `<a href="${linkUrl}" class="nova-avatar-wrap" aria-label="@${escapeHTML(nick)} Profile">${html}</a>`;
  }

  return html.trim();
}

/**
 * Renders Agency Logo / Initials Badge component
 * @param {Object} agency - Agency object with slug, code, logo_url, has_logo, initials, etc.
 * @param {Object} [options] - Options: size ('xs','sm','md','lg','xl'), link, alt, className
 * @returns {string} HTML string
 */
export function renderAgency(agency, options = {}) {
  const ag = agency || {};
  const sizeKey = options.size || 'md';
  const sizeCfg = resolveSize(sizeKey);
  const initials = getAgencyInitials(ag);
  const slug = ag.slug || (ag.code ? ag.code.toLowerCase() : 'general');
  const extraClass = options.className ? ` ${options.className}` : '';
  const altText = options.alt || `Logo of ${escapeHTML(ag.name || initials)}`;

  const hasLogo = Boolean(
    ag.has_logo !== false &&
    (ag.logo_url || ag.logo_key)
  );

  let logoInner = '';
  if (hasLogo) {
    const src1x = buildAgencyLogoUrl(ag, sizeCfg.s1);
    const src2x = buildAgencyLogoUrl(ag, sizeCfg.s2);

    logoInner = `
      <img class="nova-avatar nova-avatar--${sizeKey} nova-avatar--agency${extraClass}"
           src="${src1x}"
           srcset="${src1x} 1x, ${src2x} 2x"
           width="${sizeCfg.px}"
           height="${sizeCfg.px}"
           alt="${altText}"
           loading="lazy"
           decoding="async"
           data-initials="${escapeHTML(initials)}"
           data-size-class="nova-avatar--${sizeKey}"
           onerror="window.NovaAvatar ? window.NovaAvatar.handleAgencyImgError(this) : null" />
    `;
  } else {
    logoInner = `
      <span class="nova-avatar nova-avatar--${sizeKey} nova-avatar--agency-badge${extraClass}"
            role="img"
            aria-label="${altText}">
        ${escapeHTML(initials)}
      </span>
    `;
  }

  let html = `<span class="nova-avatar-wrap">${logoInner}</span>`;
  if (options.link) {
    html = `<a href="/agency/${encodeURIComponent(slug)}" class="nova-avatar-wrap" aria-label="${escapeHTML(ag.name || initials)} Channel">${html}</a>`;
  }
  return html.trim();
}

/**
 * Creates a DOM element from render HTML
 */
export function create(userOrAgency, options = {}, isAgency = false) {
  const html = isAgency ? renderAgency(userOrAgency, options) : render(userOrAgency, options);
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild;
}

const NovaAvatar = {
  render,
  renderAgency,
  create,
  getColor,
  getInitials,
  getAgencyInitials,
  buildUserAvatarUrl,
  buildAgencyLogoUrl,
  handleImgError,
  handleAgencyImgError,
  PALETTE: AVATAR_PALETTE,
  SIZES
};

if (typeof window !== 'undefined') {
  window.NovaAvatar = NovaAvatar;
  window.Avatar = NovaAvatar;
}

export default NovaAvatar;
