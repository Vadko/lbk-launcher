// Recorded from https://steamcommunity.com/achievements/620 and /400, trimmed to a few achievements.
const PORTAL2_ICONS =
  'https://shared.akamai.steamstatic.com/community_assets/images/apps/620';

const portal2Achievement = (
  internal_key: number,
  api: string,
  name: string,
  description: string
) => ({
  internal_key,
  api_name: `ACH.${api}`,
  name,
  description,
  hidden: false,
  archived: false,
  icon_achieved: `${PORTAL2_ICONS}/${api}.jpg`,
  icon_unachieved: `${PORTAL2_ICONS}/${api}_BW.jpg`,
  groupid: 2,
});

const portal2Schema = {
  appid: 620,
  language: 'english',
  groups: [
    {
      id: 2,
      name: 'Single Player',
      archived: false,
      ispublic: true,
      developeronly: false,
      dlcappid: 0,
      order: 0,
      achievements: [
        portal2Achievement(
          1,
          'SURVIVE_CONTAINER_RIDE',
          'Wake Up Call',
          'Survive the manual override'
        ),
        portal2Achievement(2, 'WAKE_UP', 'You Monster', 'Reunite with GLaDOS'),
        portal2Achievement(
          3,
          'LASER',
          'Undiscouraged',
          'Complete the first Thermal Discouragement Beam test'
        ),
      ],
    },
  ],
  schema_hash: 3207947195,
  schema_version: 1108170007,
};

const portalSchema = {
  appid: 400,
  language: 'english',
  groups: [
    {
      id: 0,
      name: '',
      archived: false,
      ispublic: true,
      developeronly: false,
      dlcappid: 0,
      order: 0,
      achievements: [
        {
          internal_key: 0,
          api_name: 'PORTAL_GET_PORTALGUNS',
          name: 'Lab Rat',
          description:
            'Acquire the fully powered Aperture Science Handheld Portal Device.',
          hidden: false,
          archived: false,
          icon_achieved:
            'https://shared.fastly.steamstatic.com/community_assets/images/apps/400/portal_getportalguns.jpg',
          icon_unachieved:
            'https://shared.fastly.steamstatic.com/community_assets/images/apps/400/portal_getportalguns_bw.jpg',
          groupid: 0,
        },
      ],
    },
  ],
  schema_hash: 324021597,
  schema_version: 34,
};

const dehydrated = (queryKey: unknown[], data: unknown) => ({
  queryKey,
  queryHash: JSON.stringify(queryKey),
  state: {
    data,
    dataUpdateCount: 1,
    dataUpdatedAt: 1792378885039,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isInvalidated: false,
    status: 'success',
    fetchStatus: 'idle',
  },
});

export const steamCommunityAchievements = {
  portal2Schema,
  portalSchema,
  // window.SSR.renderContext.queryData of the global page: React Query's dehydrated state as JSON.
  queryData: JSON.stringify({
    mutations: [],
    queries: [
      dehydrated(['AOWarningCookie'], null),
      dehydrated(['achievements', 620, 'schema'], portal2Schema),
      dehydrated(['StoreItem', 'app_620', 'default_info'], {
        appid: 620,
        name: 'Portal 2',
      }),
      dehydrated(['achievements', 620, 'globalpercentages'], {
        percentages: { 1: 74, 2: 64.69999694824219, 3: 62.599998474121094 },
      }),
    ],
  }),
};
