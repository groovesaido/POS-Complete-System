import { useState } from "react";
import ContactDialog from "../components/ContactDialog";

/**
 * License Expired Screen
 *
 * Shown when a license has expired and cannot be used.
 * Provides instructions to renew and contact support.
 */
export default function LicenseExpired() {
  const [showContactDialog, setShowContactDialog] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Expired icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 border-2 border-red-400/50 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            License Expired
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">
            Your subscription has ended. Please renew to continue using
            Bythebuzz POS.
          </p>

          <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider font-medium">
              To renew your license
            </p>
            <ol className="text-left text-gray-700 dark:text-gray-300 text-sm space-y-3">
              <li className="flex gap-2">
                <span className="text-red-500 dark:text-red-400 shrink-0 font-medium">
                  1.
                </span>
                <span>
                  <button
                    onClick={() => setShowContactDialog(true)}
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer inline font-medium"
                  >
                    Contact us
                  </button>{" "}
                  to purchase a renewal
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 dark:text-red-400 shrink-0 font-medium">
                  2.
                </span>
                <span>We will guide you through the process</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 dark:text-red-400 shrink-0 font-medium">
                  3.
                </span>
                <span>
                  After payment we will then renew your subscription in a matter
                  of seconds
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 dark:text-red-400 shrink-0 font-medium">
                  4.
                </span>
                <span>We will then send you a message of confirmation</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 dark:text-red-400 shrink-0 font-medium">
                  5.
                </span>
                <span>Click Check again to proceed</span>
              </li>
            </ol>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm text-center cursor-pointer"
          >
            Check again
          </button>
        </div>

        <ContactDialog show={showContactDialog} onClose={() => setShowContactDialog(false)} />
      </div>
    </div>
  );
}
