export default function DashboardLoading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading workspace">
      <aside className="route-loading-sidebar">
        <span className="route-loading-logo" />
        {Array.from({ length: 8 }).map((_, index) => <span className="route-loading-nav" key={index} />)}
      </aside>
      <main className="route-loading-main">
        <div className="route-loading-top" />
        <div className="route-loading-content">
          <span className="route-loading-title" />
          <div className="route-loading-metrics">
            {Array.from({ length: 4 }).map((_, index) => <span key={index} />)}
          </div>
          <span className="route-loading-panel" />
        </div>
      </main>
    </div>
  );
}
