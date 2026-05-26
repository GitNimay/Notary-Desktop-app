import { ReactNode, useEffect, useState, useCallback } from "react";
import { Menu, X, HelpCircle, Copy, Phone } from "lucide-react"; // Import necessary icons for the modal
import { Sidebar } from "./Sidebar";

const DESKTOP_BREAKPOINT = 768;

export function Layout({ children }: { children: ReactNode }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= DESKTOP_BREAKPOINT);
  const [showSupportModal, setShowSupportModal] = useState(false); // State for the support modal

  useEffect(() => {
    const handleResize = () => {
      const nextIsDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      setIsDesktop(nextIsDesktop);

      if (nextIsDesktop) {
        setIsMobileSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleOpenSupportModal = useCallback(() => {
    setShowSupportModal(true);
  }, []);

  return (
    <div className="bg-surface text-on-surface min-h-screen antialiased print:block print:min-h-0 print:overflow-visible print:bg-white">
      {!isDesktop && isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[3px] transition-opacity md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="print:hidden">
        <Sidebar
          isOpen={isDesktop ? true : isMobileSidebarOpen}
          setIsOpen={setIsMobileSidebarOpen}
          isDesktop={isDesktop}
          onOpenSupportModal={handleOpenSupportModal} // Pass the setter to Sidebar
        />
      </div>

      <div className="relative flex min-h-screen flex-col transition-[padding] duration-300 ease-out md:pl-[4.75rem] print:block print:min-h-0 print:overflow-visible print:pl-0">
        <header className="sticky top-0 z-20 flex shrink-0 items-center gap-4 border-b border-outline-variant/10 bg-surface/88 px-4 py-4 backdrop-blur-xl md:hidden no-print">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest/90 p-2.5 text-primary shadow-sm transition-colors hover:bg-surface-container-high"
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button>
        </header>

        <div className="app-scroll flex-1 print:overflow-visible">
          {children}
        </div>
      </div>

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-2xl w-full max-w-md flex flex-col items-center gap-4">
            <div className="flex justify-between items-center w-full">
              <h3 className="font-headline text-xl font-bold text-on-surface">Contact Support</h3>
              <button onClick={() => setShowSupportModal(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="w-full space-y-4 mt-4">
              <div className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg">
                <Phone size={20} className="text-primary" />
                <div className="flex-1">
                  <p className="font-label text-xs uppercase tracking-wider text-on-surface-variant">Developer Contact</p>
                  <p className="font-body text-base text-on-surface font-medium">+91 95455 56045</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText('+91 95455 56045')} className="text-on-surface-variant hover:text-primary transition-colors" title="Copy phone number"><Copy size={16} /></button>
              </div>
              <div className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg">
                <HelpCircle size={20} className="text-secondary" />
                <div className="flex-1">
                  <p className="font-label text-xs uppercase tracking-wider text-on-surface-variant">Email</p>
                  <p className="font-body text-base text-on-surface font-medium">hackathon746@gmail.com</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText('hackathon746@gmail.com')} className="text-on-surface-variant hover:text-secondary transition-colors" title="Copy email address"><Copy size={16} /></button>
              </div>
            </div>
            <button onClick={() => setShowSupportModal(false)} className="mt-4 w-full px-6 py-3 bg-primary text-on-primary rounded-xl font-body font-bold hover:opacity-90 transition-opacity">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
