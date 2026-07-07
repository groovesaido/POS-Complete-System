export default function MpesaAccountForm({
  form,
  editingAccount,
  onChange,
  onSubmit,
  onCancel,
}) {
  const handleChange = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    onChange((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10"
    >
      <h4 className="font-medium text-sm">
        {editingAccount ? "Edit M-Pesa Account" : "Add M-Pesa Account"}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Account Name</label>
          <input
            value={form.name}
            onChange={handleChange("name")}
            placeholder="e.g. Main Paybill"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Account Type</label>
          <select
            value={form.type}
            onChange={handleChange("type")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            <option value="paybill">Paybill</option>
            <option value="till">Till Number</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {form.type === "paybill" ? "Paybill Number" : "Till Number"}
          </label>
          <input
            value={form.number}
            onChange={handleChange("number")}
            placeholder="e.g. 174379"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Consumer Key</label>
          <input
            value={form.consumerKey}
            onChange={handleChange("consumerKey")}
            placeholder="From Daraja API"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Consumer Secret
          </label>
          <input
            value={form.consumerSecret}
            onChange={handleChange("consumerSecret")}
            type="password"
            placeholder="From Daraja API"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Pass Key</label>
          <input
            value={form.passKey}
            onChange={handleChange("passKey")}
            type="password"
            placeholder="Lipa na M-Pesa Online passkey"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={handleChange("isDefault")}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Set as default
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.useSandbox}
              onChange={handleChange("useSandbox")}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Use sandbox (test)
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          {editingAccount ? "Update" : "Add"} Account
        </button>
      </div>
    </form>
  );
}
