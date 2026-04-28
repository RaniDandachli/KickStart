import type { Href, Router } from 'expo-router';

import { moneyChallengesHref } from '@/lib/tabRoutes';

/**
 * When opening a route inside another tab’s stack (e.g. Home → Profile/add-funds), this keeps that
 * tab’s index screen under the target so Back returns to the tab (You), not the first tab (Home).
 * @see https://docs.expo.dev/router/reference/linking/#withanchor
 */
export const crossTabPushOptions = { withAnchor: true } as const;

export function pushCrossTab(router: Router, href: Href) {
  router.push(href, crossTabPushOptions);
}

export const ROUTES = {
  home: '/(app)/(tabs)' as const,
  profileTab: '/(app)/(tabs)/profile' as const,
  playTab: '/(app)/(tabs)/play' as const,
  tournamentsTab: '/(app)/(tabs)/tournaments' as const,
  get moneyChallengesTab(): ReturnType<typeof moneyChallengesHref> {
    return moneyChallengesHref();
  },
  prizesTab: '/(app)/(tabs)/prizes' as const,
};

/** If there is no stack history (e.g. cold deep link), jump to a safe tab root instead of leaving the tab navigator. */
export function safeBack(router: Router, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
