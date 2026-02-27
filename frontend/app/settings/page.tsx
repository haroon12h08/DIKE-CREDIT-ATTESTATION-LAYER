import DashboardLayout from '@/components/layout/DashboardLayout';

export default function DashboardPage() {
    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="border-b border-gray-800 pb-8 mb-8">
                    <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
                        Settings
                    </h2>
                    <p className="text-gray-400">Manage your DIKE profile preferences.</p>
                </div>
                <div className="py-16 text-center text-gray-500 border border-gray-800 border-dashed rounded-xl">
                    Settings configuration coming soon.
                </div>
            </div>
        </DashboardLayout>
    );
}
