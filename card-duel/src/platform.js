// 아티팩트 런타임(window.claude) 연결. 어떤 기능이든 없으면 null로 두고 그 기능만 끈다.
export async function connectPlatform() {
  const c = typeof window !== 'undefined' ? window.claude : null;
  const use = async (name) => {
    try {
      return c && typeof c.use === 'function' ? await c.use(name) : null;
    } catch {
      return null;
    }
  };
  const [db, room, user] = await Promise.all([use('db'), use('room'), use('user')]);
  let me = { id: null, name: '', avatarUrl: '', color: '#7d8bb0', isOwner: false, canEdit: false };
  let canWrite = null;
  if (user) {
    try {
      me = await user.me();
    } catch {
      /* 읽기는 실패하지 않지만 혹시 몰라 기본값 유지 */
    }
    try {
      canWrite = await user.can('data.write');
    } catch {
      canWrite = null;
    }
  }
  return { db, room, user, me, canWrite };
}

// 사람 이름/아바타는 저장하지 않고, 화면에 그릴 때마다 profiles()로 받아온다(캐시는 런타임이 해줌)
export async function resolveProfiles(user, ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!user || !uniq.length) return {};
  try {
    return await user.profiles(uniq);
  } catch {
    return {};
  }
}
