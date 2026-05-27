import { Layout } from "../components/layout/Layout";
import {
  ArrowUpRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  FilePlus2,
  FileText,
  Folder,
  Loader2,
  PencilLine,
  Search,
  TrendingUp,
} from "lucide-react";

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { auth } from "../firebaseAuth";
import { db } from "../firebaseDb";

function cleanName(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function getFirstName(user: User | null) {
  const displayName = cleanName(user?.displayName);
  if (displayName) {
    return displayName.split(" ")[0];
  }

  const emailName = user?.email?.split("@")[0] || "";
  const firstToken = emailName.split(/[._+\-\d]+/).find(Boolean);
  if (!firstToken) {
    return "there";
  }

  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function Dashboard() {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    total: 0,
    today: 0,
    month: 0
  });
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{label: string, count: number, percentage: number, date: string}[]>([]);

  const openDocumentInNewTab = (documentUrl?: string, documentId?: string) => {
    if (!documentUrl && !documentId) return;
    const targetUrl = documentUrl
      ? documentUrl
      : `/documents/new?docId=${encodeURIComponent(documentId ?? "")}`;
    const anchor = document.createElement("a");
    anchor.href = targetUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  };

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "documents"), orderBy("createdAt", "desc"));
        const qs = await getDocs(q);
        
        const now = new Date();
        const todayKey = getLocalDateKey(now);
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let total = 0;
        let today = 0;
        let month = 0;
        
        // Setup empty 7-day map with stable YYYY-MM-DD keys
        const last7DaysMap = new Map<string, number>();
        const last7Days: Date[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = getLocalDateKey(d);
          last7DaysMap.set(key, 0);
          last7Days.push(d);
        }

        const formattedDocsList: any[] = [];

        qs.docs.forEach(docSnap => {
          const data = docSnap.data();
          const createdAt = data.createdAt ? data.createdAt.toDate() : null;
          
          total++;
          if (createdAt) {
            const docDateKey = getLocalDateKey(createdAt);
            if (docDateKey === todayKey) today++;
            if (createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear) month++;
            
            if (last7DaysMap.has(docDateKey)) {
               last7DaysMap.set(docDateKey, last7DaysMap.get(docDateKey)! + 1);
            }
          }

          // Keep only the 5 most recent documents (query already sorted by createdAt desc)
          if (formattedDocsList.length < 5) {
            const firstPerson = data.persons?.[0];
            let clientName = data.clientName ? data.clientName : (firstPerson ? firstPerson.name : "Unknown Client");
            formattedDocsList.push({
               id: docSnap.id,
               client: clientName,
               date: createdAt ? createdAt.toLocaleDateString() : "Unknown",
               status: data.pdfUrl ? "COMPLETED" : "DRAFT",
               srNo: data.srNo,
               pdfUrl: data.pdfUrl
            });
          }
        });

        // Compute max for chart scaling
        const maxCount = Math.max(1, ...Array.from(last7DaysMap.values()));
        const finalChartData = last7Days.map((dayDate) => {
           const dayKey = getLocalDateKey(dayDate);
           const count = last7DaysMap.get(dayKey) ?? 0;
           const dayLabel = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
           
           return {
             date: dayKey,
             label: dayLabel,
             count: count,
             percentage: Math.max((count / maxCount) * 100, 2) // Ensure at least 2% height for empty days so bar is visible
           };
        });

        setMetrics({ total, today, month });
        setChartData(finalChartData);
        setRecentDocs(formattedDocsList);
        
      } catch (error) {
        console.error("Dashboard Fetch Error", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const weeklyTotal = chartData.reduce((sum, day) => sum + day.count, 0);
  const peakDay = chartData.reduce(
    (top, day) => (day.count > top.count ? day : top),
    { label: "-", count: 0, percentage: 0, date: "" }
  );
  const completedRecent = recentDocs.filter((doc) => doc.status === "COMPLETED").length;
  const draftRecent = recentDocs.filter((doc) => doc.status === "DRAFT").length;

  const metricCards = [
    {
      label: "Total Docs",
      value: metrics.total,
      helper: "Complete archive",
      icon: Folder,
      tone: "text-primary bg-primary/8 border-primary/10",
    },
    {
      label: "Today's Total",
      value: metrics.today,
      helper: "Entered today",
      icon: CalendarDays,
      tone: "text-secondary bg-secondary/10 border-secondary/10",
    },
    {
      label: "This Month",
      value: metrics.month,
      helper: "Month to date",
      icon: Calendar,
      tone: "text-tertiary bg-tertiary/10 border-tertiary/10",
    },
  ];

  return (
    <Layout>
      <main className="flex-1 overflow-y-auto bg-surface-container-low/45 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Welcome back, {getFirstName(user)}</p>
              <h1 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight text-on-surface md:text-5xl">My Dashboard</h1>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <Link
                to="/documents"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-5 font-body text-sm font-semibold text-on-surface shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface"
              >
                <Search size={17} />
                Browse Records
              </Link>
              <Link
                to="/documents/new"
                className="gradient-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-body text-sm font-bold uppercase tracking-[0.12em] text-on-primary shadow-[0_18px_34px_-24px_rgba(10,10,10,0.55)] transition-all hover:-translate-y-0.5 hover:opacity-90"
              >
                <FilePlus2 size={17} />
                New Document
              </Link>
            </div>
          </section>

          {isLoading ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-on-surface-variant editorial-shadow">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="font-body text-sm font-bold uppercase tracking-[0.16em]">Syncing Live Data...</p>
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {metricCards.map((metric) => (
                      <div
                        key={metric.label}
                        className="group rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 editorial-shadow transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_18px_46px_-36px_rgba(10,10,10,0.55)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-label text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">{metric.label}</p>
                            <p className="mt-3 font-headline text-4xl font-bold leading-none text-on-surface">{metric.value.toLocaleString()}</p>
                          </div>
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${metric.tone}`}>
                            <metric.icon size={20} />
                          </span>
                        </div>
                        <div className="mt-6 flex items-center justify-between gap-3 border-t border-outline-variant/15 pt-4">
                          <span className="font-body text-sm text-on-surface-variant">{metric.helper}</span>
                          <ArrowUpRight size={16} className="text-on-surface-variant transition-colors group-hover:text-primary" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 editorial-shadow md:p-6">
                    <div className="flex flex-col gap-4 border-b border-outline-variant/15 pb-5 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <TrendingUp size={19} className="text-primary" />
                          <h2 className="font-headline text-2xl font-bold text-on-surface">Weekly Notarization Growth</h2>
                        </div>
                        <p className="mt-1 font-body text-sm text-on-surface-variant">Entry volume across the last seven days.</p>
                      </div>
                      <div className="rounded-xl bg-surface-container-low px-4 py-3 text-right">
                        <p className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Peak day</p>
                        <p className="font-body text-sm font-semibold text-on-surface">{peakDay.label} / {peakDay.count} docs</p>
                      </div>
                    </div>

                    <div className="relative mt-6 h-72 overflow-hidden rounded-xl bg-surface-container-low p-4">
                      <div className="absolute inset-x-4 bottom-14 top-5 flex flex-col justify-between opacity-60">
                        <span className="h-px bg-outline-variant/60" />
                        <span className="h-px bg-outline-variant/45" />
                        <span className="h-px bg-outline-variant/35" />
                        <span className="h-px bg-outline-variant/25" />
                      </div>

                      <div className="relative z-10 flex h-full items-stretch justify-between gap-2">
                        {chartData.map((day) => (
                          <div key={day.date} className="group flex min-w-0 flex-1 flex-col">
                            <div className="flex min-h-0 flex-1 items-end">
                              <div
                                className={`relative mx-auto w-full max-w-12 rounded-t-xl border transition-all duration-500 group-hover:brightness-95 ${
                                  day.count > 0
                                    ? "border-primary/10 bg-gradient-to-t from-primary to-chart-3"
                                    : "border-outline-variant/40 bg-surface-container-highest"
                                }`}
                                style={{ height: `${day.percentage}%` }}
                              >
                                <div className="pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-inverse-surface px-3 py-1.5 font-body text-xs font-bold text-inverse-on-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                  {day.count} Docs
                                </div>
                              </div>
                            </div>
                            <span className="mt-3 text-center font-label text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                              {day.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest editorial-shadow">
                    <div className="flex flex-col gap-4 border-b border-outline-variant/15 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
                      <div>
                        <h2 className="font-headline text-2xl font-bold text-on-surface">Recent Documents</h2>
                        <p className="mt-1 font-body text-sm text-on-surface-variant">Five latest records, ready to open.</p>
                      </div>
                      <Link
                        to="/documents"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-low px-4 py-2.5 font-body text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                      >
                        Open All
                        <ArrowUpRight size={15} />
                      </Link>
                    </div>

                    <div className="divide-y divide-outline-variant/15">
                      {recentDocs.length === 0 ? (
                        <div className="p-10 text-center">
                          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface-variant">
                            <FileText size={22} />
                          </div>
                          <h3 className="font-headline text-xl font-bold text-on-surface">No recent documents</h3>
                          <p className="mt-2 font-body text-sm text-on-surface-variant">Newly created drafts and completed documents will appear here.</p>
                        </div>
                      ) : (
                        recentDocs.map((doc) => (
                          <button
                            type="button"
                            key={doc.id}
                            className="group grid w-full grid-cols-1 items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-container-low md:grid-cols-[minmax(0,1fr)_8rem_7rem] md:px-6"
                            onClick={() => openDocumentInNewTab(doc.pdfUrl, doc.id)}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary">
                                  <FileText size={18} />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-body text-sm font-semibold text-on-surface transition-colors group-hover:text-primary">
                                    {doc.client}
                                  </p>
                                  <p className="mt-0.5 truncate font-label text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                                    {doc.srNo ? `Sr: ${doc.srNo}` : doc.id}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <span className="font-label text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant md:text-right">{doc.date}</span>
                            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 font-label text-[10px] font-bold uppercase tracking-[0.14em] md:ml-auto ${
                              doc.status === "DRAFT"
                                ? "bg-outline/15 text-on-surface-variant"
                                : "bg-primary/10 text-primary"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${doc.status === "DRAFT" ? "bg-on-surface-variant" : "bg-primary"}`} />
                              {doc.status}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 editorial-shadow">
                    <div className="flex items-center justify-between">
                      <h2 className="font-headline text-xl font-bold text-on-surface">Today</h2>
                      <span className="rounded-full bg-primary/10 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Live</span>
                    </div>
                    <div className="mt-5 rounded-2xl bg-primary p-5 text-on-primary">
                      <p className="font-label text-[11px] font-bold uppercase tracking-[0.16em] text-on-primary/70">Documents entered</p>
                      <p className="mt-3 font-headline text-5xl font-bold leading-none">{metrics.today.toLocaleString()}</p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-surface-container-low p-4">
                        <p className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">7 days</p>
                        <p className="mt-2 font-headline text-2xl font-bold text-on-surface">{weeklyTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-surface-container-low p-4">
                        <p className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Best</p>
                        <p className="mt-2 font-headline text-2xl font-bold text-on-surface">{peakDay.label}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 editorial-shadow">
                    <h2 className="font-headline text-xl font-bold text-on-surface">Work Status</h2>
                    <div className="mt-5 space-y-3">
                      <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <CheckCircle2 size={17} />
                          </span>
                          <span className="font-body text-sm font-semibold text-on-surface">Completed</span>
                        </div>
                        <span className="font-headline text-xl font-bold text-on-surface">{completedRecent}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-outline/15 text-on-surface-variant">
                            <PencilLine size={17} />
                          </span>
                          <span className="font-body text-sm font-semibold text-on-surface">Drafts</span>
                        </div>
                        <span className="font-headline text-xl font-bold text-on-surface">{draftRecent}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 editorial-shadow">
                    <div>
                      <h2 className="font-headline text-xl font-bold text-on-surface">Quick Actions</h2>
                      <p className="mt-1 font-body text-sm text-on-surface-variant">Common paths for document work.</p>
                    </div>
                    <div className="mt-5 space-y-2">
                      <Link to="/documents/new" className="flex items-center justify-between rounded-xl bg-surface-container-low p-4 font-body text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high">
                        New document
                        <ArrowUpRight size={15} />
                      </Link>
                      <Link to="/clients" className="flex items-center justify-between rounded-xl bg-surface-container-low p-4 font-body text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high">
                        Client directory
                        <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  </div>
                </aside>
              </section>
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}
