'use client';

import { useAccount } from 'wagmi';
import { useDikeRegistry } from '@/hooks/useDikeRegistry';
import WalletConnect from '@/components/WalletConnect';
import CreditOverview from '@/components/dashboard/CreditOverview';
import CreditHistoryTimeline from '@/components/dashboard/CreditHistoryTimeline';
import CreditHistoryTable from '@/components/CreditHistoryTable';
import ProtocolComparisonDemo from '@/components/ProtocolComparisonDemo';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useEffect, useState } from 'react';

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const { summary, outstandingDebt, isLoading, error, getUserEvents, getCreditEvent, isReady } = useDikeRegistry(address);

  const [mounted, setMounted] = useState(false);
  const [detailedEvents, setDetailedEvents] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch detailed events for Timeline without relying exclusively on CreditHistoryTable
  useEffect(() => {
    async function fetchEvents() {
      if (!isReady || !address) return;
      try {
        const eventIds = await getUserEvents(address);
        const eventPromises = eventIds.map(async (id) => {
          const evt = await getCreditEvent(id);
          if (evt) {
            const EVENT_TYPES: Record<number, string> = {
              0: 'BORROW',
              1: 'REPAY_ON_TIME',
              2: 'REPAY_LATE',
              3: 'DEFAULT',
            };
            return {
              eventId: Number(id),
              amount: evt.amount,
              eventType: EVENT_TYPES[evt.eventType] || 'UNKNOWN',
              timestamp: Number(evt.timestamp)
            };
          }
          return null;
        });
        const resolved = (await Promise.all(eventPromises)).filter(Boolean);
        setDetailedEvents(resolved);
      } catch { }
    }
    fetchEvents();
  }, [address, isReady, getUserEvents, getCreditEvent]);

  if (!mounted) return null;

  const isWrongNetwork = isConnected && chainId !== 102031; // Creditcoin testnet

  const onTimeRepayments = summary?.onTimeRepayments ?? BigInt(0);
  const eventCount = summary?.totalEvents ?? BigInt(0);
  const eventCountNum = Number(eventCount);
  const onTimeRepaymentsNum = Number(onTimeRepayments);
  // Calculate onTimeRatio safely derived on the frontend only
  const onTimeRatio = eventCountNum > 0 ? (onTimeRepaymentsNum / eventCountNum) : 0;

  const summaryData = {
    totalBorrowed: summary?.totalBorrowed ?? BigInt(0),
    totalRepaid: summary?.totalRepaid ?? BigInt(0),
    outstandingDebt: outstandingDebt ?? BigInt(0),
    onTimeRepayments,
    defaults: summary?.defaults ?? BigInt(0),
    eventCount,
    onTimeRatio,
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">

        {/* Page Header */}
        <div className="border-b border-gray-800 pb-8">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
            DIKE — Decentralized Credit Footprint Infrastructure
          </h2>
          <p className="text-gray-400 mb-6">Your portable on-chain credit history, verified across chains.</p>
          <div className="flex flex-col sm:flex-row gap-6 text-sm font-mono text-gray-400">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-neutral-800 text-gray-200 text-xs font-bold">1</span>
              <span>Borrow anywhere</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-neutral-800 text-gray-200 text-xs font-bold">2</span>
              <span>Repay on-time</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-neutral-800 text-gray-200 text-xs font-bold">3</span>
              <span>Build portable reputation</span>
            </div>
          </div>
        </div>

        {/* State 1: Disconnected */}
        {!address && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-gray-800 rounded-xl bg-neutral-900">
            <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h2 className="text-xl font-medium tracking-tight text-gray-200 mb-2">Cross-Chain Credit Attestation</h2>
            <p className="text-gray-500 max-w-md mb-8">
              Connect your secure wallet to view normalized lending events mapped sequentially from external EVM chains securely onto Creditcoin.
            </p>
            <div className="mt-8">
              <WalletConnect />
            </div>
          </div>
        )}

        {/* State 2: Connected Dashboard */}
        {address && (
          <div className="space-y-8">
            {isWrongNetwork && (
              <div className="p-6 bg-yellow-950/20 border border-yellow-900/50 rounded-xl">
                <h3 className="text-sm font-medium text-yellow-500 uppercase tracking-widest mb-2">Network Warning</h3>
                <p className="text-sm text-yellow-400">Please switch to Creditcoin Testnet to view DIKE profile.</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="h-10 w-1 bg-blue-500/80" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Connected Identity</p>
                <p className="text-sm font-mono text-gray-200">{address}</p>
              </div>
            </div>

            {isLoading && (
              <div className="space-y-8 animate-pulse">
                <div>
                  <div className="h-6 w-48 bg-neutral-800 rounded mb-4" />
                  <div className="w-full h-48 bg-neutral-900 rounded-xl border border-gray-800" />
                </div>
                <div className="pt-8">
                  <div className="h-6 w-64 bg-neutral-800 rounded mb-4" />
                  <div className="w-full h-64 bg-neutral-900 rounded-xl border border-gray-800" />
                </div>
              </div>
            )}

            {error && (
              <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-xl">
                <h3 className="text-sm font-medium text-red-500 uppercase tracking-widest mb-2">Connection Error</h3>
                <p className="text-sm text-red-400">Failed to load credit data.</p>
              </div>
            )}

            {!isLoading && !error && (
              <>
                <CreditOverview {...summaryData} />
                <CreditHistoryTimeline events={detailedEvents} />
                <CreditHistoryTable address={address} />
                <ProtocolComparisonDemo {...summaryData} />
              </>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
