import type { Metadata } from "next";
export const metadata: Metadata = { title: "Privacy policy" };
export default function Privacy() {
  return (
    <main id="main" className="privacy">
      <div>
        <h1>FolioForge privacy policy</h1>
        <p>Last updated: 4 November 2026.</p>
        <h2>Local processing and guest use</h2>
        <p>
          PDF and image processing runs on your device. You do not need a
          FolioForge account. FolioForge does not upload documents to its
          servers, use document analytics, or persist working files in browser
          storage. Closing the workspace releases its references to working
          files; browser memory management controls reclamation. Files you
          download to your device remain until you delete them.
        </p>
        <h2>Optional Google Drive</h2>
        <p>
          Enabling Drive loads Google Identity Services and the official Google
          Picker. Google receives browser and sign-in information under its own
          policies. FolioForge requests only the drive.file permission, allowing
          access to files you select or create with the app. The app does not
          request access to your entire Drive. It reads an account-specific
          Drive permission identifier to keep upload retries separate between
          accounts; this identifier stays in memory.
        </p>
        <p>
          Files you open transfer directly from Google to browser memory.
          Processing remains local. Save result transfers the chosen output
          directly to Google Drive as a new file in My Drive. FolioForge
          servers, analytics, and logs receive neither document contents nor
          OAuth access tokens. Google stores your saved files and can access
          them under its policies; this feature does not provide end-to-end
          encryption.
        </p>
        <h2>Retention and control</h2>
        <p>
          Access tokens and upload recovery state are kept in memory, not
          localStorage, sessionStorage, cookies, or a FolioForge database.
          Disconnect, navigation away from the tool, and reload clear the
          workspace connection. Disconnect does not revoke Google authorization
          or delete files. A cancelled transfer may already have completed
          remotely. Check your Drive before saving again after leaving the
          workspace.
        </p>
        <p>
          Remove FolioForge from{" "}
          <a href="https://myaccount.google.com/connections">
            Google Account connections
          </a>{" "}
          to revoke permission. Delete stored files directly in Google Drive and
          downloaded files on your device. You can continue using device tools
          without Drive.
        </p>
        <h2>Hosting and contact</h2>
        <p>
          Our hosting provider receives ordinary website requests, including
          network metadata such as IP address and browser headers. FolioForge
          includes no analytics or advertising scripts. Google’s services are
          governed by{" "}
          <a href="https://policies.google.com/privacy">
            Google’s privacy policy
          </a>
          .
        </p>
        <p>
          For privacy questions, contact the maintainer through{" "}
          <a href="https://github.com/AvishShair/folioforge">
            the FolioForge repository
          </a>
          . Do not post private documents or credentials in public issues.
        </p>
      </div>
    </main>
  );
}
