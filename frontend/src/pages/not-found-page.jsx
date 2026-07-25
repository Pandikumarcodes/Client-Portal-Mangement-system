import { Link } from "react-router";
export function NotFoundPage() {
  return (
    <section className="auth-layout">
      <article className="auth-card not-found">
        <h1>Page not found</h1>
        <p>That page does not exist.</p>
        <Link to="/">Return home</Link>
      </article>
    </section>
  );
}
