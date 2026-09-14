import { useCallback, useEffect, useRef, useState } from 'react';
import { FetchTikTokConnection, ValidateTikTokDestination } from '../Lib/TikTokConnection.js';

export function useTikTokConnection() {
    const [Connections, SetConnections] = useState([]);
    const [Loading, SetLoading] = useState(true);
    const [Busy, SetBusy] = useState(false);
    const [ErrorText, SetErrorText] = useState('');
    const [Checks, SetChecks] = useState({});
    const Controller = useRef(null);
    const Running = useRef(false);
    const Load = useCallback(async Signal => {
        const Data = await FetchTikTokConnection('/api/TikTokConnection', undefined, Signal);
        if (!Array.isArray(Data.Connections)) throw new Error('Invalid connection response.');
        if (!Signal.aborted) SetConnections(Data.Connections);
    }, []);
    useEffect(() => {
        const Current = new AbortController(); Controller.current = Current;
        FetchTikTokConnection('/api/TikTokConnection', undefined, Current.signal)
            .then(Data => {
                if (!Array.isArray(Data.Connections)) throw new Error('Invalid connection response.');
                if (!Current.signal.aborted) SetConnections(Data.Connections);
            }).catch(Failure => { if (!Current.signal.aborted) SetErrorText(Failure.message); })
            .finally(() => { if (!Current.signal.aborted) SetLoading(false); });
        return () => Current.abort();
    }, []);
    async function Run(Action, GrantID, Dataset) {
        const Signal = Controller.current?.signal;
        if (!Signal || Signal.aborted || Running.current) return;
        Running.current = true; SetBusy(true); SetErrorText('');
        if (Action === 'CheckData') SetChecks(Previous => ({ ...Previous, [`${GrantID}:${Dataset}`]: null }));
        try {
            if (Action === 'Refresh') await Load(Signal);
            else if (Action === 'Connect') {
                if (window.location.origin !== 'https://www.hghsejahtera.my') throw new Error('Connect from https://www.hghsejahtera.my after server setup.');
                const Data = await FetchTikTokConnection('/api/TikTokConnect', {}, Signal);
                if (!Signal.aborted) window.location.assign(ValidateTikTokDestination(Data.URL));
            } else {
                const Data = await FetchTikTokConnection('/api/TikTokConnection', { Action, GrantID, Dataset }, Signal);
                if (!Signal.aborted && Action === 'CheckData') SetChecks(Previous => ({ ...Previous, [`${GrantID}:${Dataset}`]: Data.Result }));
                if (!Signal.aborted) await Load(Signal);
            }
        } catch (Failure) { if (!Signal.aborted) SetErrorText(Failure.message); }
        finally { Running.current = false; if (!Signal.aborted) SetBusy(false); }
    }
    return { Connections, Loading, Busy, ErrorText, Checks, Run };
}
