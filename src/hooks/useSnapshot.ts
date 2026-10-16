import {useCallback, useEffect, useRef, useState} from 'react';
import {getSessionToken, invoke} from '../api';
import type {Snapshot} from '../model';

// Retain unchanged flat rows so catalog indexes and memoized cards survive cart refreshes.
function shareRows<T extends object>(previous:T[]|undefined,next:T[]):T[]{
 if(!previous)return next;
 let identical=previous.length===next.length;
 const rows=next.map((row,index)=>{
  const old=previous[index];
  const keys=Object.keys(row) as (keyof T)[];
  if(old&&keys.length===Object.keys(old).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(old,key)&&Object.is(old[key],row[key])))return old;
  identical=false;
  return row;
 });
 return identical?previous:rows;
}

// A slower response must never replace a newer request or another session.
export default function useSnapshot() {
  const [data, setData] = useState<Snapshot>();
  const sequence = useRef(0);
  const accepted = useRef<{session:ReturnType<typeof getSessionToken>;snapshot:Snapshot}|undefined>(undefined);
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
      const cached=accepted.current;
      const previous=cached&&cached.session===session?cached.snapshot:undefined;
      const shared:Snapshot={...snapshot,
        products:shareRows(previous?.products,snapshot.products),
        common_products:snapshot.common_products?shareRows(previous?.common_products,snapshot.common_products):undefined,
        aliases:shareRows(previous?.aliases,snapshot.aliases),
        frequencies:shareRows(previous?.frequencies,snapshot.frequencies),
        settings:shareRows(previous?.settings,snapshot.settings),
        lines:shareRows(previous?.lines,snapshot.lines),
        customers:shareRows(previous?.customers,snapshot.customers),
        ledger:shareRows(previous?.ledger,snapshot.ledger),
        repayments:shareRows(previous?.repayments,snapshot.repayments),
        movements:shareRows(previous?.movements,snapshot.movements),
        cuts:shareRows(previous?.cuts,snapshot.cuts),
        // SaleHistory uses this reference to reload arbitrary historical filters.
        // A refund or reprint can affect a sale outside the recent snapshot window.
        sales:snapshot.sales,
        shift:shareRows(previous?.shift,snapshot.shift),
        stats:shareRows(previous?.stats,snapshot.stats),
        pending:shareRows(previous?.pending,snapshot.pending),
        expiry_alerts:shareRows(previous?.expiry_alerts,snapshot.expiry_alerts),
      };
      // Polling unchanged data must not redraw every open workspace.
      const unchanged=previous&&Object.keys(shared).length===Object.keys(previous).length&&(Object.keys(shared) as (keyof Snapshot)[]).every(key=>Object.is(shared[key],previous[key]));
      const next=unchanged?previous:shared;
      accepted.current={session,snapshot:next};
      setData(next);
    }
  }, []);
  return {data, refresh};
}
