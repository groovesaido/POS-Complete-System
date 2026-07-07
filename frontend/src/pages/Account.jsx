import { useState } from "react";
import { useLicense } from "../contexts/LicenseContext";
import ContactDialog from "../components/ContactDialog";

export default function Account() {
  const [showContactDialog, setShowContactDialog] = useState(false);
  const { licenseDetails } = useLicense();

  const daysLeft = licenseDetails?.daysLeft ?? 0;
  const plan = licenseDetails?.plan || "standard";
  const expiryDate = licenseDetails?.expiresAt
    ? new Date(licenseDetails.expiresAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ── Current Plan Section ── */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Account
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Your current subscription and available plans
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Current Plan
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Bythebuzz POS License
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  plan === "premium"
                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {plan === "premium" ? "Premium" : "Standard"}
              </span>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  daysLeft > 30
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : daysLeft > 0
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                }`}
              >
                {daysLeft > 0 ? "Active" : "Expired"}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-1">
                License Key
              </p>
              <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                {licenseDetails?.key || "—"}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-1">
                Expires
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {expiryDate}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-1">
                Days Remaining
              </p>
              <p
                className={`text-sm font-semibold ${
                  daysLeft > 30
                    ? "text-green-600 dark:text-green-400"
                    : daysLeft > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {daysLeft > 0 ? `${daysLeft} days` : "Expired"}
              </p>
            </div>
          </div>

          {licenseDetails?.customerName && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-1">
                Registered To
              </p>
              <p className="text-sm text-gray-900 dark:text-white">
                {licenseDetails.customerName}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Pricing Comparison Table ── */}
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Compare Plans
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Choose the plan that fits your business needs
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white w-1/3">
                  Plan Duration
                </th>
                <th className="text-center px-6 py-4 text-sm font-semibold">
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    Standard
                  </div>
                </th>
                <th className="text-center px-6 py-4 text-sm font-semibold">
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Premium
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Monthly Row */}
              <tr className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-6 py-5">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    Monthly
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    30 days
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="font-bold text-lg text-gray-900 dark:text-white">
                    KSh 2,000
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    per month
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
                    KSh 3,000
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    per month
                  </div>
                </td>
              </tr>

              {/* Quarterly Row */}
              <tr className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-6 py-5">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    Quarterly
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    3 months
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="font-bold text-lg text-gray-900 dark:text-white">
                    KSh 5,500
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    per quarter
                  </div>
                  <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Save 8.3%
                  </div>
                  <div className="text-[11px] text-green-600 dark:text-green-500 mt-0.5 font-medium">
                    ~KSh 2,000/yr
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
                    KSh 8,000
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    per quarter
                  </div>
                  <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Save 11.1%
                  </div>
                  <div className="text-[11px] text-green-600 dark:text-green-500 mt-0.5 font-medium">
                    ~KSh 4,000/yr
                  </div>
                </td>
              </tr>

              {/* Yearly Row */}
              <tr>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Yearly
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                      Best Value
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    12 months
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="font-bold text-lg text-gray-900 dark:text-white">
                    KSh 20,000
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    per year
                  </div>
                  <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Save 16.7%
                  </div>
                  <div className="text-[11px] text-green-600 dark:text-green-500 mt-0.5 font-medium">
                    ~KSh 4,000/yr
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
                    KSh 30,000
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    per year
                  </div>
                  <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Save 16.7%
                  </div>
                  <div className="text-[11px] text-green-600 dark:text-green-500 mt-0.5 font-medium">
                    ~KSh 6,000/yr
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Features Comparison ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mt-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Features
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white w-1/2">
                  Feature
                </th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-1/4">
                  Standard
                </th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-indigo-700 dark:text-indigo-400 w-1/4">
                  Premium
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Full POS features", both: true },
                { name: "Product management", both: true },
                { name: "Sales reports & analytics", both: true },
                { name: "Inventory management & tracking", both: true },
                { name: "Backup & restore", both: true },
                { name: "Priority support", both: true },
                { name: "Customer support", both: true },
                { name: "Monthly system updates", both: true },
                { name: "Advanced reporting", both: true },
                { name: "Custom business optimization", both: true },
                { name: "M-Pesa integration", both: false },
                { name: "Debit & Credit card integration", both: false },
              ].map((feature, i) => (
                <tr
                  key={feature.name}
                  className={`border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 ${
                    feature.both ? "" : "bg-gray-50/50 dark:bg-gray-700/10"
                  }`}
                >
                  <td className="px-6 py-3.5">
                    <span className={`text-sm font-medium ${
                      feature.both
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-900 dark:text-white"
                    }`}>
                      {feature.name}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {feature.both ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ContactDialog show={showContactDialog} onClose={() => setShowContactDialog(false)} />

        {/* Contact CTA */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowContactDialog(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors text-sm cursor-pointer"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Contact us to purchase
          </button>
        </div>

        {/* Support note */}
        <div className="mt-4 text-center">
          <p className="text-gray-400 dark:text-gray-500 text-xs">
            All plans include a full license key valid for the selected period.{" "}
            <button
              onClick={() => setShowContactDialog(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer inline"
            >
              Contact us
            </button>{" "}
            for custom enterprise plans.
          </p>
        </div>
      </div>
    </div>
  );
}
