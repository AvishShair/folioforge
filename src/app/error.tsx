"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main id="main" className="tool-page">
      <h1>This workspace could not load.</h1>
      <p>
        Try again, or refresh the page. Files are not uploaded or saved by
        FolioForge.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
