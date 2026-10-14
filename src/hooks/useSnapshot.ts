import {useCallback, useEffect, useRef, useState} from 'react';
import {getSessionToken, invoke} from '../api';
import type {Snapshot} from '../model';

// A slower response must never replace a newer request or another session.
export default function useSnapshot() {
  const [data, setData] = useState<Snapshot>();
  const sequence = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; sequence.current++; };
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    const session = getSessionToken();
    const snapshot = await invoke<Snapshot>('snapshot');
    if (mounted.current && request === sequence.current && session === getSessionToken()) {
      setData(snapshot);
    }
  }, []);
  return {data, refresh};
}
