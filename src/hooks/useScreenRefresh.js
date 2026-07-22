import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export default function useScreenRefresh(refreshFn, deps = []) {
  useFocusEffect(
    useCallback(() => {
      refreshFn();
    }, deps)
  );
}
