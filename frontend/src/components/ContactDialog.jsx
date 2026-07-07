export default function ContactDialog({ show, onClose }) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <img src="./icons/phone-icon.png" alt="" className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Get in Touch
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose how you'd like to reach us
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 w-full p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <img src="./icons/message-icon.png" alt="" className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900 dark:text-white text-sm">
                Contact on WhatsApp
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                0793 682 713
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <img src="./icons/phone-icon.png" alt="" className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900 dark:text-white text-sm">
                Call us
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                0793 682 713
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <img src="./icons/email-icon.png" alt="" className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900 dark:text-white text-sm">
                Email us
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Bythebuzztech@gmail.com
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
