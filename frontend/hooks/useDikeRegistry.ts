import { useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { DIKE_REGISTRY_ABI } from '@/lib/abi/DikeRegistry';
import { Address } from 'viem';

const DIKE_ADDRESS = process.env.NEXT_PUBLIC_DIKE_ADDRESS as Address;

export function useDikeRegistry(address?: Address) {
    const publicClient = usePublicClient();
    const isReady = !!publicClient && !!DIKE_ADDRESS;

    const getCreditSummary = useCallback(
        async (userAddress: string) => {
            try {
                if (!publicClient || !DIKE_ADDRESS) throw new Error('Client or Contract Address missing');
                const data = await publicClient.readContract({
                    address: DIKE_ADDRESS,
                    abi: DIKE_REGISTRY_ABI,
                    functionName: 'getCreditSummary',
                    args: [userAddress as Address],
                });

                return {
                    totalBorrowed: data[0],
                    totalRepaid: data[1],
                    defaults: data[2],
                    onTimeRepayments: data[3],
                    lateRepayments: data[4],
                    totalEvents: data[5],
                    onTimeRatio: data[6],
                    defaultRate: data[7]
                };
            } catch (error: any) {
                return null;
            }
        },
        [publicClient]
    );

    const getUserEvents = useCallback(
        async (userAddress: string) => {
            try {
                if (!publicClient || !DIKE_ADDRESS) throw new Error('Client or Contract Address missing');
                const data = await publicClient.readContract({
                    address: DIKE_ADDRESS,
                    abi: DIKE_REGISTRY_ABI,
                    functionName: 'getUserEvents',
                    args: [userAddress as Address],
                });
                return data as readonly bigint[];
            } catch (error: any) {
                return [];
            }
        },
        [publicClient]
    );

    const getOutstandingDebt = useCallback(
        async (userAddress: string) => {
            try {
                if (!publicClient || !DIKE_ADDRESS) throw new Error('Client or Contract Address missing');
                const data = await publicClient.readContract({
                    address: DIKE_ADDRESS,
                    abi: DIKE_REGISTRY_ABI,
                    functionName: 'getOutstandingDebt',
                    args: [userAddress as Address],
                });
                return data as bigint;
            } catch (error: any) {
                return BigInt(0);
            }
        },
        [publicClient]
    );

    const ownerOf = useCallback(
        async (tokenId: bigint) => {
            try {
                if (!publicClient || !DIKE_ADDRESS) throw new Error('Client or Contract Address missing');
                const data = await publicClient.readContract({
                    address: DIKE_ADDRESS,
                    abi: DIKE_REGISTRY_ABI,
                    functionName: 'ownerOf',
                    args: [tokenId],
                });
                return data as Address;
            } catch (error: any) {
                return null;
            }
        },
        [publicClient]
    );

    const getCreditEvent = useCallback(
        async (eventId: bigint) => {
            try {
                if (!publicClient || !DIKE_ADDRESS) throw new Error('Client or Contract Address missing');
                const data = await publicClient.readContract({
                    address: DIKE_ADDRESS,
                    abi: DIKE_REGISTRY_ABI,
                    functionName: 'getCreditEvent',
                    args: [eventId],
                });
                return data as { subject: Address; amount: bigint; timestamp: bigint; eventType: number; referenceHash: string };
            } catch (error: any) {
                return null;
            }
        },
        [publicClient]
    );

    const { data: queryData, isLoading, error } = useQuery({
        queryKey: ['dikeData', address],
        queryFn: async () => {
            if (!address) throw new Error("Address is required");
            const [summary, events, outstandingDebt] = await Promise.all([
                getCreditSummary(address),
                getUserEvents(address),
                getOutstandingDebt(address)
            ]);
            return { summary, events, outstandingDebt };
        },
        enabled: !!address && isReady,
    });

    return {
        summary: queryData?.summary || null,
        events: queryData?.events || [],
        outstandingDebt: queryData?.outstandingDebt || BigInt(0),
        isLoading,
        error,
        getCreditSummary,
        getUserEvents,
        getCreditEvent,
        getOutstandingDebt,
        ownerOf,
        isReady
    };
}
