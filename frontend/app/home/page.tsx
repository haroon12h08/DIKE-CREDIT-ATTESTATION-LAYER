import DashboardLayout from '@/components/layout/DashboardLayout';

export default function HomePage() {
    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="border-b border-gray-800 pb-8 mb-8">
                    <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
                        Home
                    </h2>
                    <p className="text-gray-400">Welcome to DIKE infrastructure.</p>
                </div>
                <div className="py-16 text-center text-gray-500 border border-gray-800 border-dashed rounded-xl">
                    Home landing view coming soon.
                </div>
            </div>
        </DashboardLayout>
    );
}
