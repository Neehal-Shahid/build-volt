import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Upload, Pencil, Trash2, PackageX } from "lucide-react";
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

  async function onCsv(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const data = await apiUpload("/api/upload", { file, token });
      setMessage(data.message || `Imported ${data.imported} products`);
      await load();
    } catch (err) {
      setError(err.message || "CSV upload failed");
    } finally {
      setBusy(false);
    }
  }

  function formatPrice(n) {
    return `PKR ${Number(n).toLocaleString()}`;
  }

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
              <label className="btn btn-ghost file-btn">
                <Upload size={16} strokeWidth={2.25} />
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={onCsv}
                  disabled={busy}
                />
              </label>
              <button type="button" className="btn" onClick={openCreate}>
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
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
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
                      {!wooLocked && (
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
            description, sku)
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
    </>
  );
}
