import { useEffect, useMemo, useState } from "react";
import {
  Search, Plus, Upload, Loader2, Pencil, Trash2, PackageX,
  CheckSquare, Square, X, AlertTriangle, ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, apiUpload } from "../lib/api";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";
import { SkeletonRows } from "./ui/Skeleton";
import Badge from "./ui/Badge";
import Alert from "./ui/Alert";

const EMPTY_FORM = {
  name: "",
  category: "CPU",
  price: "",
  stock: true,
  description: "",
  sku: "",
};

// Best-effort client-side guess so the mapping modal opens with sensible defaults —
// the server re-resolves the final mapping itself, this is just for the UI.
const FIELD_GUESS_ALIASES = {
  name: ["name", "product", "title", "product name", "item name"],
  category: ["category", "type", "cat", "categories", "product category"],
  price: ["price", "cost", "amount", "regular price", "unit price", "sale price"],
  stock: ["stock", "in_stock", "instock", "available", "in stock?", "stock status", "stock quantity", "quantity"],
  description: ["description", "desc", "details", "short description", "long description"],
  sku: ["sku", "code", "item code", "product code"],
};

const MAPPABLE_FIELDS = [
  { key: "name", label: "Product name", required: true },
  { key: "price", label: "Price", required: true },
  { key: "category", label: "Category", required: false },
  { key: "stock", label: "Stock status", required: false },
  { key: "sku", label: "SKU", required: false },
  { key: "description", label: "Description", required: false },
];

function guessMapping(headers) {
  const lower = headers.map((h) => h.toLowerCase());
  const mapping = {};
  for (const field of Object.keys(FIELD_GUESS_ALIASES)) {
    const idx = lower.findIndex((h) => FIELD_GUESS_ALIASES[field].includes(h));
    mapping[field] = idx >= 0 ? headers[idx] : "";
  }
  return mapping;
}

export default function ProductsTab({ store, mode }) {
  const { token } = useAuth();
  const wooLocked = mode === "woo" || !!store?.wooConnected;

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preparingImport, setPreparingImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api(
        `/api/products/manage/${encodeURIComponent(store.id)}`,
        {
          token,
        },
      );
      setProducts(data.products || []);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message || "Could not load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (store?.id && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter)
        return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryFilter]);

  // Selection can only ever contain ids currently visible in `filtered`
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(filtered.map((p) => p.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: categories[0] || "CPU" });
    setModalOpen(true);
  }

  function openEdit(product) {
    setEditing(product);
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      stock: !!product.stock,
      description: product.description || "",
      sku: product.sku || "",
    });
    setModalOpen(true);
  }

  async function saveProduct(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = {
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price),
        stock: !!form.stock,
        description: form.description.trim(),
        sku: form.sku.trim(),
      };
      if (editing) {
        await api(`/api/product/${editing.id}`, { method: "PUT", token, body });
        setMessage("Product updated");
      } else {
        await api("/api/product", { method: "POST", token, body });
        setMessage("Product added");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStock(product) {
    setError("");
    try {
      await api(`/api/product/${product.id}/stock`, {
        method: "PUT",
        token,
        body: { stock: !product.stock },
      });
      await load();
    } catch (err) {
      setError(err.message || "Stock update failed");
    }
  }

  async function removeProduct(product) {
    if (!window.confirm(`Delete "${product.name}"?`)) return;
    setError("");
    try {
      await api(`/api/product/${product.id}`, { method: "DELETE", token });
      setMessage("Product deleted");
      await load();
    } catch (err) {
      setError(err.message || "Delete failed");
    }
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((p) => p.id));
    });
  }

  function toggleSelectOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkSetStock(stock) {
    setBulkBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api("/api/products/bulk-stock", {
        method: "POST",
        token,
        body: { ids: [...selected], stock },
      });
      setMessage(`Updated ${data.updated} product${data.updated === 1 ? "" : "s"}`);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err.message || "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkSetCategory(category) {
    if (!category) return;
    setBulkBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api("/api/products/bulk-category", {
        method: "POST",
        token,
        body: { ids: [...selected], category },
      });
      setMessage(`Moved ${data.updated} product${data.updated === 1 ? "" : "s"} to ${data.category}`);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err.message || "Bulk category update failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    if (!window.confirm(`Delete ${selected.size} selected product${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBulkBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api("/api/products/bulk-delete", {
        method: "POST",
        token,
        body: { ids: [...selected] },
      });
      setMessage(`Deleted ${data.deleted} product${data.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err.message || "Bulk delete failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function onCsvSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    setPreparingImport(true);
    try {
      const data = await apiUpload("/api/products/csv-headers", { file, token });
      setImportFile({ file, headers: data.headers || [] });
    } catch (err) {
      setError(err.message || "Could not read that CSV file");
    } finally {
      setPreparingImport(false);
    }
  }

  async function runImport({ mode: importMode, columnMap }) {
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const data = await apiUpload("/api/upload", {
        file: importFile.file,
        token,
        fields: { mode: importMode, columnMap: JSON.stringify(columnMap) },
      });
      setMessage(data.message || `Imported ${data.imported} products`);
      setImportFile(null);
      await load();
    } catch (err) {
      setError(err.message || "CSV upload failed");
    } finally {
      setUploading(false);
    }
  }

  function formatPrice(n) {
    return `PKR ${Number(n).toLocaleString()}`;
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <>
      <PageHeader
        title="Products"
        description={
          wooLocked
            ? "Managed by WooCommerce — editing is locked in the dashboard."
            : "Add parts manually or upload a CSV to build your catalog."
        }
        actions={
          !wooLocked && (
            <>
              <label className={`btn btn-ghost file-btn${preparingImport ? " is-busy" : ""}`}>
                {preparingImport ? (
                  <Loader2 size={16} strokeWidth={2.25} className="btn-spinner" />
                ) : (
                  <Upload size={16} strokeWidth={2.25} />
                )}
                {preparingImport ? "Reading file…" : "Upload CSV"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={onCsvSelected}
                  disabled={preparingImport || uploading}
                />
              </label>
              <button type="button" className="btn" onClick={openCreate} disabled={uploading}>
                <Plus size={16} strokeWidth={2.5} />
                Add product
              </button>
            </>
          )
        }
      />

      {wooLocked && (
        <div className="sd-banner">
          <div className="sd-banner-copy">
            <p>
              WooCommerce mode is on. Products are managed by the WooCommerce
              plugin sync.
            </p>
          </div>
        </div>
      )}

      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>

      <Card>
        <div className="sd-toolbar">
          <div className="sd-toolbar-search">
            <Search size={16} strokeWidth={2.25} />
            <input
              placeholder="Search name, SKU, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {(categories.length ? categories : []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {!loading && products.length > 0 && (
            <span className="muted tiny" style={{ alignSelf: "center", whiteSpace: "nowrap" }}>
              {filtered.length === products.length
                ? `${products.length} product${products.length === 1 ? "" : "s"}`
                : `${filtered.length} of ${products.length}`}
            </span>
          )}
        </div>

        {!wooLocked && selected.size > 0 && (
          <div className="sd-bulk-bar">
            <span className="sd-bulk-count">{selected.size} selected</span>
            <div className="sd-bulk-actions">
              <button type="button" className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={() => bulkSetStock(true)}>
                Mark in stock
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={() => bulkSetStock(false)}>
                Mark out of stock
              </button>
              <select
                className="sd-bulk-category-select"
                disabled={bulkBusy}
                value=""
                onChange={(e) => bulkSetCategory(e.target.value)}
              >
                <option value="" disabled>Change category to…</option>
                {(categories.length ? categories : []).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost btn-sm danger" disabled={bulkBusy} onClick={bulkDelete}>
                <Trash2 size={14} /> Delete
              </button>
              <button type="button" className="sd-icon-btn" onClick={() => setSelected(new Set())} aria-label="Clear selection" title="Clear selection">
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonRows count={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={PackageX}
            title={
              wooLocked
                ? "No products synced yet."
                : "No products yet — add one or upload a CSV to get started."
            }
            action={
              !wooLocked ? (
                <button type="button" className="btn" onClick={openCreate}>
                  <Plus size={16} strokeWidth={2.5} />
                  Add your first product
                </button>
              ) : (
                <p className="muted tiny" style={{ margin: 0 }}>
                  Connect the WooCommerce plugin from My Store, then sync your catalog.
                </p>
              )
            }
          />
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  {!wooLocked && (
                    <th className="sd-th-check">
                      <button
                        type="button"
                        className="sd-icon-btn"
                        onClick={toggleSelectAll}
                        aria-label={allSelected ? "Deselect all" : "Select all"}
                      >
                        {allSelected ? (
                          <CheckSquare size={17} />
                        ) : someSelected ? (
                          <CheckSquare size={17} style={{ opacity: 0.5 }} />
                        ) : (
                          <Square size={17} />
                        )}
                      </button>
                    </th>
                  )}
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={selected.has(p.id) ? "is-selected" : ""}>
                    {!wooLocked && (
                      <td className="sd-th-check">
                        <button
                          type="button"
                          className="sd-icon-btn"
                          onClick={() => toggleSelectOne(p.id)}
                          aria-label={selected.has(p.id) ? "Deselect" : "Select"}
                        >
                          {selected.has(p.id) ? <CheckSquare size={17} /> : <Square size={17} />}
                        </button>
                      </td>
                    )}
                    <td>
                      <strong>{p.name}</strong>
                      {p.sku ? (
                        <div className="muted tiny">SKU: {p.sku}</div>
                      ) : null}
                    </td>
                    <td>{p.category}</td>
                    <td>{formatPrice(p.price)}</td>
                    <td>
                      <Badge
                        as={wooLocked ? "span" : "button"}
                        tone={p.stock ? "green" : "red"}
                        onClick={wooLocked ? undefined : () => toggleStock(p)}
                      >
                        {p.stock ? "In stock" : "Out of stock"}
                      </Badge>
                    </td>
                    <td>
                      {!wooLocked && selected.size === 0 && (
                        <div className="sd-row-actions">
                          <button
                            type="button"
                            className="sd-icon-btn"
                            onClick={() => openEdit(p)}
                            aria-label="Edit product"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="sd-icon-btn danger"
                            onClick={() => removeProduct(p)}
                            aria-label="Delete product"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!wooLocked && (
          <p
            className="muted tiny"
            style={{ marginTop: "1rem", marginBottom: 0 }}
          >
            CSV columns: <code>name, category, price</code> (optional: stock,
            description, sku) — or map your own column names when you upload.
          </p>
        )}
      </Card>

      {modalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setModalOpen(false)}
        >
          <form
            className="card-form modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveProduct}
          >
            <h3>{editing ? "Edit product" : "Add product"}</h3>
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                minLength={2}
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              >
                {(categories.length ? categories : ["Other"]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Price (PKR)
              <input
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
                required
              />
            </label>
            <label>
              SKU (optional)
              <input
                value={form.sku}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sku: e.target.value }))
                }
              />
            </label>
            <label>
              Description (optional)
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.stock}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stock: e.target.checked }))
                }
              />
              In stock
            </label>
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {importFile && (
        <CsvImportModal
          fileName={importFile.file.name}
          headers={importFile.headers}
          existingCount={products.length}
          busy={uploading}
          onCancel={() => setImportFile(null)}
          onImport={runImport}
        />
      )}
    </>
  );
}

function CsvImportModal({ fileName, headers, existingCount, busy, onCancel, onImport }) {
  const [importMode, setImportMode] = useState("add");
  const [mapping, setMapping] = useState(() => guessMapping(headers));
  const [confirmReplace, setConfirmReplace] = useState(false);

  const hasHeaders = headers.length > 0;

  function submit() {
    const columnMap = {};
    for (const field of Object.keys(mapping)) {
      if (mapping[field]) columnMap[field] = mapping[field];
    }
    onImport({ mode: importMode, columnMap });
  }

  const canSubmit = importMode !== "replace" || confirmReplace;

  return (
    <div className="modal-backdrop" role="presentation" onClick={busy ? undefined : onCancel}>
      <div className="card-form modal-card sd-csv-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Import products</h3>
        <p className="muted tiny" style={{ marginTop: "-0.5rem" }}>{fileName}</p>

        <div className="sd-field">
          <span className="sd-field-label">What should happen to your current products?</span>
          <div className="sd-import-modes">
            <label className={`sd-import-mode ${importMode === "add" ? "active" : ""}`}>
              <input type="radio" name="import-mode" checked={importMode === "add"} onChange={() => setImportMode("add")} />
              <div>
                <strong>Add as new</strong>
                <p>Every row is inserted as a new product. Use this the first time you upload, or to add more items.</p>
              </div>
            </label>
            <label className={`sd-import-mode ${importMode === "merge" ? "active" : ""}`}>
              <input type="radio" name="import-mode" checked={importMode === "merge"} onChange={() => setImportMode("merge")} />
              <div>
                <strong>Update existing, add new</strong>
                <p>Matches rows to existing products by SKU (or name + category) and updates them; anything unmatched is added.</p>
              </div>
            </label>
            <label className={`sd-import-mode ${importMode === "replace" ? "active" : ""}`}>
              <input type="radio" name="import-mode" checked={importMode === "replace"} onChange={() => setImportMode("replace")} />
              <div>
                <strong>Replace everything</strong>
                <p>Deletes all {existingCount} existing product{existingCount === 1 ? "" : "s"}, then imports this file as your full catalog.</p>
              </div>
            </label>
          </div>
        </div>

        {importMode === "replace" && (
          <div className="sd-notice warning" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <AlertTriangle size={16} style={{ flex: "none", marginTop: 1 }} />
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} style={{ marginTop: 2 }} />
              <span>I understand this permanently deletes all {existingCount} existing product{existingCount === 1 ? "" : "s"} first.</span>
            </label>
          </div>
        )}

        <div className="sd-field">
          <span className="sd-field-label">Column mapping</span>
          <span className="muted tiny">
            {hasHeaders
              ? "We've guessed a match for each field from your CSV headers — check them, or map columns with different names."
              : "Could not read a header row from this file — BuildBot will try to auto-detect columns named name/category/price/etc."}
          </span>
          {hasHeaders && (
            <div className="sd-csv-map-grid">
              {MAPPABLE_FIELDS.map((field) => (
                <div key={field.key} className="sd-csv-map-row">
                  <span className="sd-csv-map-field">
                    {field.label}
                    {field.required && <span className="sd-csv-map-required">*</span>}
                  </span>
                  <ArrowRight size={14} className="muted" />
                  <select
                    value={mapping[field.key] || ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  >
                    <option value="">Auto-detect</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="actions">
          <button className="btn" type="button" disabled={busy || !canSubmit} onClick={submit}>
            {busy ? "Importing…" : "Import"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
