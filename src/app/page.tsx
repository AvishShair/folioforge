import { ArrowUpRight, ShieldCheck, Zap, Fingerprint } from "lucide-react";
import { ToolCatalog } from "@/components/catalog";
export default function Home() {
  return (
    <main id="main">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A little less file friction</p>
          <h1>
            Your files.
            <br />
            <span>New possibilities.</span>
          </h1>
          <p>
            Thoughtful tools for PDFs and images. Everything happens in your
            browser, with your files staying yours.
          </p>
          <a className="button primary" href="#tools">
            Find your tool <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="paper paper-back">
            <span>FOLIO / 02</span>
            <div className="paper-image" />
            <i />
            <i />
          </div>
          <div className="paper paper-front">
            <span>ROOM TO CREATE</span>
            <strong>
              Good things
              <br />
              come together.
            </strong>
            <div className="paper-line" />
            <p>
              Documents. Images.
              <br />A fresh perspective.
            </p>
            <span className="paper-bottom">FolioForge ↗</span>
          </div>
          <div className="art-caption">A workspace for what’s next.</div>
        </div>
      </section>
      <div className="benefits">
        <span>
          <ShieldCheck />
          Files stay on your device
        </span>
        <span>
          <Zap />
          No account. No waiting room.
        </span>
        <span>
          <Fingerprint />
          No tracking or uploads
        </span>
      </div>
      <ToolCatalog />
      <section id="privacy" className="privacy">
        <ShieldCheck size={40} />
        <div>
          <p className="eyebrow">Private by design</p>
          <h2>
            Your documents don’t
            <br />
            need a round trip.
          </h2>
          <p>
            FolioForge processes files locally using your browser. No document
            uploads, no cloud storage, and no accounts. Close the tab and your
            working files are gone.
          </p>
          <p className="muted">
            Your browser’s memory sets the limits: 50 MB per file, 150 MB per
            job, and 32 megapixels per image.
          </p>
        </div>
      </section>
      <section className="faq">
        <h2>A few useful answers.</h2>
        {[
          [
            "Are my files uploaded anywhere?",
            "No. Document contents stay in browser memory. The app downloads its code and PDF rendering assets, but sends no files to a server.",
          ],
          [
            "Does compression always make an image smaller?",
            "No. Size depends on the source, output format, and quality. We show the actual change, including increases. PNG quality is lossless and does not use the JPEG quality slider.",
          ],
          [
            "Can I edit password-protected PDFs?",
            "Encrypted PDFs are not supported. Start with an unlocked copy. PDF edits may invalidate digital signatures and may not preserve complex interactive features.",
          ],
          [
            "What browsers can I use?",
            "Use a recent Chrome, Edge, Firefox, or Safari. Codec support and memory vary by device. Large jobs may work better on a desktop.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
