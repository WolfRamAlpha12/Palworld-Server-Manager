"use client";

export function NeedServer() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Select a server</h1>
          <p>
            Add a Tailscale host on the Servers page, then pick it in the
            sidebar switcher.
          </p>
        </div>
      </div>
      <div className="panel empty">No server selected.</div>
    </>
  );
}
