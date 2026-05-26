import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  HelpCircle, // Added HelpCircle for the support button
  Settings,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebaseAuth";
import { cn } from "../../lib/utils";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isDesktop: boolean; // Keep isDesktop prop
  onOpenSupportModal: () => void; // New prop to open the support modal
}

const links = [ // Keep links array
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/documents", icon: FileText, label: "Documents" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ isOpen, setIsOpen, isDesktop, onOpenSupportModal }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = isDesktop ? isHovered : true;

  const handleNavigationClick = () => {
    if (!isDesktop) {
      setIsOpen(false);
    }
  };

  const handleLogout = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOut(auth);
      setIsOpen(false);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to sign out.", error);
      setIsSigningOut(false);
    }
  };

  return (
    <nav
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsHovered(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsHovered(false);
        }
      }}
      className={cn(
        "fixed inset-y-0 left-0 z-40 p-2 transition-[width,transform] duration-300 ease-out",
        isDesktop ? "translate-x-0" : isOpen ? "translate-x-0" : "-translate-x-full",
        isDesktop ? (isExpanded ? "w-56" : "w-[4.75rem]") : "w-[16rem] max-w-[calc(100vw-1rem)]"
      )}
      aria-label="Primary navigation"
    >
      <div className="sidebar-shell flex h-full flex-col overflow-hidden rounded-2xl">
        {!isDesktop && (
          <div className="flex justify-end border-b border-outline-variant/50 px-3 py-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className={cn("px-3 pt-3", !isExpanded && "px-2")}>
          <Link
            to="/documents/new"
            onClick={handleNavigationClick}
            title={!isExpanded ? "New document" : ""}
            className={cn(
              "group flex items-center rounded-xl border border-outline-variant/70 bg-surface-container-lowest text-on-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:bg-white hover:shadow-md active:translate-y-0 active:scale-[0.98]",
              isExpanded ? "gap-2.5 px-3 py-2.5" : "mx-auto h-10 w-10 justify-center"
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-on-surface transition-colors duration-200 group-hover:bg-surface-container">
              <Plus size={17} />
            </span>
            {isExpanded && (
              <span className="truncate font-body text-sm font-semibold text-on-surface">New Document</span>
            )}
          </Link>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-4", !isExpanded && "px-2")}>
          {isExpanded && (
            <p className="px-2 font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              Workspace
            </p>
          )}

          <ul className="mt-2 space-y-1">
            {links.map((link) => {
              const isActive = location.pathname === link.to || (link.to !== "/" && location.pathname.startsWith(link.to));

              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={handleNavigationClick}
                    title={!isExpanded ? link.label : ""}
                    className={cn(
                      "group flex items-center rounded-xl transition-all duration-200",
                      isExpanded ? "gap-2.5 px-2 py-2" : "mx-auto h-10 w-10 justify-center",
                      isActive
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center justify-center rounded-lg transition-all duration-200",
                        isExpanded ? "h-8 w-8" : "h-8 w-8",
                        isActive
                          ? "bg-white/12 text-on-primary"
                          : "bg-surface-container-lowest text-on-surface group-hover:bg-white"
                      )}
                    >
                      <link.icon size={17} />
                    </span>

                    {isExpanded && (
                      <span className={cn("min-w-0 truncate font-body text-sm font-medium", isActive ? "text-on-primary" : "text-on-surface")}>
                        {link.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={cn("border-t border-outline-variant/50 px-3 py-3", !isExpanded && "px-2")}>
          {isExpanded && (
            <p className="px-2 pb-2 font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              Session
            </p>
          )}

          {/* Support Button */}
          <button
            type="button"
            onClick={onOpenSupportModal}
            title={!isExpanded ? "Contact Developer: +91 95455 56045" : ""} // Tooltip for collapsed state
            className={cn(
              "group flex w-full items-center rounded-xl text-tertiary transition-all duration-200 hover:bg-tertiary/8", // Using tertiary color for support
              isExpanded ? "gap-2.5 px-2 py-2" : "mx-auto h-10 w-10 justify-center"
            )}
          >
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", isExpanded && "bg-tertiary/8")}> {/* Icon */}
              <HelpCircle size={17} />
            </span>
            {isExpanded && (
              <span className="min-w-0 truncate text-left font-body text-sm font-medium">
                Support
              </span>
            )}
          </button>

          {/* Spacer for visual separation if needed, or just rely on button margins */}
          {isExpanded && <div className="h-2"></div>}

          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            title={!isExpanded ? "Logout" : ""}
            className={cn(
              "group flex w-full items-center rounded-xl text-error transition-all duration-200 hover:bg-error/8 disabled:cursor-not-allowed disabled:opacity-70",
              isExpanded ? "gap-2.5 px-2 py-2" : "mx-auto h-10 w-10 justify-center"
            )}
          >
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", isExpanded && "bg-error/8")}>
              {isSigningOut ? <Loader2 size={17} className="animate-spin" /> : <LogOut size={17} />}
            </span>

            {isExpanded && (
              <span className="min-w-0 truncate text-left font-body text-sm font-medium">
                {isSigningOut ? "Signing out..." : "Logout"}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
