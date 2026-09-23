export default function ApiState({ resource, label }) {
  return (
    <section className="card">
      {resource.error ? (
        <>
          <p className="recommendation-error" role="alert">Unable to load {label}. {resource.error}</p>
          <button className="complete-button" type="button" onClick={resource.retry}>Retry</button>
        </>
      ) : <p role="status">Loading {label}…</p>}
    </section>
  )
}
