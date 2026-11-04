import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="tool-page">
      <h1>That tool isn’t here.</h1>
      <p>Find the right PDF or image tool in the toolkit.</p>
      <Link href="/#tools" className="button primary">
        Browse tools
      </Link>
    </main>
  );
}
