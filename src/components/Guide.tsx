import { GUIDE } from "./guide-content";

export function Guide(p: { onBack: () => void }) {
  return (
    <section className="stack prose">
      <h1>Guide</h1>
      <nav aria-label="Guide sections" className="toc">
        {GUIDE.map((s) => (
          <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            {s.heading}
          </a>
        ))}
      </nav>
      {GUIDE.map((s) => (
        <section key={s.id} id={s.id} className="guide-sec" aria-labelledby={`${s.id}-h`}>
          <h2 id={`${s.id}-h`}>{s.heading}</h2>
          {s.intro && <p>{s.intro}</p>}
          {s.steps && (
            <ol className="steps">
              {s.steps.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          )}
          {s.bullets && (
            <ul>
              {s.bullets.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <button className="btn primary big" onClick={p.onBack}>
        Back to start
      </button>
    </section>
  );
}
