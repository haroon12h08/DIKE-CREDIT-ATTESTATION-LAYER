import TopNav from './TopNav';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="min-h-screen bg-black text-white">
            {/* Fixed Top Nav */}
            <TopNav />

            {/* Below the nav: sidebar + main */}
            <div className="flex pt-16 min-h-screen">
                {/* Sidebar — hidden on mobile, visible md+ */}
                <Sidebar />

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto bg-black min-w-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
