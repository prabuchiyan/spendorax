import { useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

const getActiveRouteName = (state) => {
  if (!state) return null;
  const route = state.routes[state.index];
  if (route.state) {
    return getActiveRouteName(route.state);
  }
  return route.name;
};

export default function useExitConfirmation({ navigationRef, rootRouteNames = ['Dashboard'], enabled = Platform.OS === 'android' } = {}) {
  const [visible, setVisible] = useState(false);

  const showDialog = () => setVisible(true);
  const hideDialog = () => setVisible(false);

  useEffect(() => {
    if (!enabled || !navigationRef) return undefined;

    const onBackPress = () => {
      if (visible) {
        hideDialog();
        return true;
      }

      if (!navigationRef.isReady?.()) {
        return false;
      }

      const state = navigationRef.getRootState?.();
      const activeRouteName = getActiveRouteName(state);
      if (rootRouteNames.includes(activeRouteName)) {
        showDialog();
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [enabled, navigationRef, visible, rootRouteNames]);

  return {
    visible,
    showDialog,
    hideDialog,
  };
}
