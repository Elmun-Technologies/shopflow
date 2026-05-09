import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Package,
  Plus,
  ArrowUpDown,
  Download,
  Trash2,
  CheckSquare,
  Square,
  TrendingUp,
  AlertTriangle,
  Grid3X3,
  List,
  Barcode,
  Tag,
  Warehouse,
  Boxes,
  Percent,
  MapPin,
  User,
  Layers,
  DollarSign,
} from "lucide-react";
import { products, categories, warehouses, ikpuCodes, saleRecords } from "../data/productsData";
import type { Product } from "../data/productsData";
import ProductDetailModal from "./ProductDetailModal";

type Tab = "products" | "categories" | "sales" | "ikpu" | "warehouse";
type ProductSort = "name" | "price" | "stock" | "sold" | "rating";
type SortDir = "asc" | "desc";
type ViewMode = "grid" | "list";

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Faol" },
  inactive: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", label: "Nofaol" },
  out_of_stock: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Tugagan" },
  discontinued: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Bekor" },
};

const warehouseStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Faol" },
  maintenance: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Ta'mir" },
  full: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "To'la" },
};

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [sortKey, setSortKey] = useState<ProductSort>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [productList, setProductList] = useState<Product[]>(products);
  const [showFilters, setShowFilters] = useState(false);

  // Stats
  const totalProducts = productList.length;
  const lowStockCount = productList.filter((p) => p.stock <= p.minStock && p.stock > 0).length;
  const outOfStockCount = productList.filter((p) => p.stock === 0).length;
  const totalValue = productList.reduce((sum, p) => sum + p.price * p.stock, 0);

  const filteredProducts = useMemo(() => {
    let result = [...productList];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.ikpu.includes(q)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.categoryId === categoryFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (warehouseFilter !== "all") {
      result = result.filter((p) => p.warehouseId === warehouseFilter);
    }

    result.sort((a, b) => {
      let aVal: string | number = a[sortKey];
      let bVal: string | number = b[sortKey];
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [searchQuery, categoryFilter, statusFilter, warehouseFilter, sortKey, sortDir, productList]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: ProductSort) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === paginatedProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(paginatedProducts.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedProducts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProducts(next);
  };

  const handleUpdateProduct = (updated: Product) => {
    setProductList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "products", label: "Tovarlar", icon: Package },
    { key: "categories", label: "Kategoriyalar", icon: Layers },
    { key: "sales", label: "Sotuvlar", icon: TrendingUp },
    { key: "ikpu", label: "IKPU", icon: Tag },
    { key: "warehouse", label: "Ombor", icon: Warehouse },
  ];

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Mahsulotlar</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tovarlar, kategoriyalar, IKPU va ombor boshqaruvi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-all">
            <Plus className="w-4 h-4" />
            Yangi tovar
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Jami tovarlar", value: totalProducts.toString(), change: "+12", positive: true },
          { label: "Kam zaxira", value: lowStockCount.toString(), change: "Diqqat", positive: false, alert: true },
          { label: "Tugagan", value: outOfStockCount.toString(), change: "Zaxira kerak", positive: false, alert: true },
          { label: "Zaxira qiymati", value: (totalValue / 1000000).toFixed(1) + "M so'm", change: "+5.2%", positive: true },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className={`bg-slate-900 border rounded-xl p-5 ${stat.alert ? "border-red-500/20" : "border-slate-800"}`}
          >
            <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
            <div className="flex items-end justify-between mt-2">
              <p className={`text-2xl font-bold ${stat.alert ? "text-red-400" : "text-white"}`}>{stat.value}</p>
              <span className={`text-xs font-semibold ${stat.positive ? "text-emerald-400" : "text-red-400"}`}>
                {stat.change}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-800 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? "text-emerald-400 border-b-2 border-emerald-400"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* PRODUCTS TAB */}
        {activeTab === "products" && (
          <motion.div
            key="products"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Filters */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Tovar nomi, SKU, barcode, IKPU bo'yicha qidirish..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
                    className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all"
                  >
                    {viewMode === "list" ? <Grid3X3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
                  >
                    <Filter className="w-4 h-4" />
                    Filterlar
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 mt-3 border-t border-slate-800">
                      <div>
                        <label className="text-xs text-slate-500 mb-1.5 block">Kategoriya</label>
                        <select
                          value={categoryFilter}
                          onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        >
                          <option value="all">Barcha kategoriyalar</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1.5 block">Status</label>
                        <select
                          value={statusFilter}
                          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        >
                          <option value="all">Barcha statuslar</option>
                          <option value="active">Faol</option>
                          <option value="inactive">Nofaol</option>
                          <option value="out_of_stock">Tugagan</option>
                          <option value="discontinued">Bekor qilingan</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1.5 block">Ombor</label>
                        <select
                          value={warehouseFilter}
                          onChange={(e) => { setWarehouseFilter(e.target.value); setCurrentPage(1); }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        >
                          <option value="all">Barcha omborlar</option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1.5 block">Sahifada</label>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        >
                          <option value={10}>10 ta</option>
                          <option value={20}>20 ta</option>
                          <option value={50}>50 ta</option>
                        </select>
                      </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setCategoryFilter("all");
                          setStatusFilter("all");
                          setWarehouseFilter("all");
                          setSortKey("name");
                          setSortDir("asc");
                          setCurrentPage(1);
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
                      >
                        Filterlarni tozalash
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bulk Actions */}
            <AnimatePresence>
              {selectedProducts.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4"
                >
                  <p className="text-sm text-emerald-400 font-medium">
                    {selectedProducts.size} ta tovar tanlandi
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors">
                      <CheckSquare className="w-3.5 h-3.5" />
                      Faollashtirish
                    </button>
                    <button
                      onClick={() => setSelectedProducts(new Set())}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Tozalash
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Products List/Grid */}
            {viewMode === "list" ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/30">
                        <th className="py-3 px-4 w-10">
                          <button onClick={toggleSelectAll} className="text-slate-500 hover:text-white transition-colors">
                            {selectedProducts.size === paginatedProducts.length && paginatedProducts.length > 0 ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="py-3 px-4 text-left">
                          <button onClick={() => handleSort("name")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors">
                            Tovar <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SKU</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Kategoriya</th>
                        <th className="py-3 px-4 text-right">
                          <button onClick={() => handleSort("price")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors ml-auto">
                            Narx <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3 px-4 text-right">
                          <button onClick={() => handleSort("stock")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors ml-auto">
                            Zaxira <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amallar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-16 text-center">
                            <Package className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                            <p className="text-sm text-slate-500">Tovarlar topilmadi</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedProducts.map((product, index) => {
                          const sCfg = statusConfig[product.status];
                          const isSelected = selectedProducts.has(product.id);
                          const isLow = product.stock <= product.minStock && product.stock > 0;
                          const isOut = product.stock === 0;

                          return (
                            <motion.tr
                              key={product.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.03 }}
                              className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${isSelected ? "bg-emerald-500/5" : ""}`}
                            >
                              <td className="py-3.5 px-4">
                                <button onClick={() => toggleSelect(product.id)} className="text-slate-500 hover:text-white transition-colors">
                                  {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                                </button>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Package className="w-5 h-5 text-slate-500" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{product.name}</p>
                                    <p className="text-xs text-slate-500">{product.ikpu}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="text-sm text-slate-400">{product.sku}</span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="text-sm text-slate-300">{product.category}</span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <p className="text-sm font-semibold text-white">{product.price.toLocaleString()}</p>
                                {product.salePrice && (
                                  <p className="text-xs text-amber-400 line-through">{product.salePrice.toLocaleString()}</p>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className={`text-sm font-semibold ${isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-white"}`}>
                                    {product.stock}
                                  </span>
                                  {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                                </div>
                                <div className="w-16 h-1 bg-slate-700 rounded-full mt-1 ml-auto overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500"}`}
                                    style={{ width: `${Math.min(100, (product.stock / product.maxStock) * 100)}%` }}
                                  />
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${sCfg.bg} ${sCfg.color}`}>
                                  {sCfg.label}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => setDetailProduct(product)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredProducts.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
                    <p className="text-xs text-slate-500">
                      {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} / {filteredProducts.length} ta
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        return (
                          <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${currentPage === pageNum ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-white hover:bg-slate-800"}`}>
                            {pageNum}
                          </button>
                        );
                      })}
                      <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedProducts.map((product, index) => {
                  const sCfg = statusConfig[product.status];
                  const isLow = product.stock <= product.minStock && product.stock > 0;
                  const isOut = product.stock === 0;
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors cursor-pointer"
                      onClick={() => setDetailProduct(product)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-slate-500" />
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sCfg.bg} ${sCfg.color}`}>
                          {sCfg.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white truncate">{product.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{product.sku}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm font-bold text-emerald-400">{product.price.toLocaleString()} so'm</span>
                        <div className="flex items-center gap-1">
                          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                          <span className={`text-xs font-medium ${isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-slate-400"}`}>
                            {product.stock} {product.unit}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, (product.stock / product.maxStock) * 100)}%` }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* CATEGORIES TAB */}
        {activeTab === "categories" && (
          <motion.div
            key="categories"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {categories.map((cat, index) => {
              const catProducts = productList.filter((p) => p.categoryId === cat.id);
              const catValue = catProducts.reduce((sum, p) => sum + p.price * p.stock, 0);
              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: cat.color + "20" }}
                    >
                      <Layers className="w-6 h-6" style={{ color: cat.color }} />
                    </div>
                    <span className="text-xs font-medium text-slate-500">{cat.slug}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white">{cat.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{cat.description}</p>
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800">
                    <div>
                      <p className="text-xs text-slate-500">Tovarlar</p>
                      <p className="text-lg font-bold text-white">{cat.productsCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Qiymati</p>
                      <p className="text-lg font-bold text-emerald-400">{(catValue / 1000000).toFixed(1)}M</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* SALES TAB */}
        {activeTab === "sales" && (
          <motion.div
            key="sales"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Jami sotuvlar", value: saleRecords.length.toString(), icon: TrendingUp },
                { label: "Umumiy daromad", value: (saleRecords.reduce((s, r) => s + r.total, 0) / 1000000).toFixed(1) + "M so'm", icon: DollarSign },
                { label: "O'rtacha chek", value: Math.round(saleRecords.reduce((s, r) => s + r.total, 0) / saleRecords.length).toLocaleString() + " so'm", icon: Percent },
                { label: "Bugun", value: saleRecords.filter((s) => s.date === "2024-12-15").length.toString(), icon: TrendingUp },
              ].map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-slate-500" />
                      <p className="text-xs text-slate-500">{stat.label}</p>
                    </div>
                    <p className="text-xl font-bold text-white">{stat.value}</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-white">So'nggi sotuvlar</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/30">
                      <th className="py-3 px-5 text-left text-xs font-medium text-slate-500 uppercase">ID</th>
                      <th className="py-3 px-5 text-left text-xs font-medium text-slate-500 uppercase">Tovar</th>
                      <th className="py-3 px-5 text-left text-xs font-medium text-slate-500 uppercase">Mijoz</th>
                      <th className="py-3 px-5 text-right text-xs font-medium text-slate-500 uppercase">Soni</th>
                      <th className="py-3 px-5 text-right text-xs font-medium text-slate-500 uppercase">Narxi</th>
                      <th className="py-3 px-5 text-right text-xs font-medium text-slate-500 uppercase">Jami</th>
                      <th className="py-3 px-5 text-left text-xs font-medium text-slate-500 uppercase">Sana</th>
                      <th className="py-3 px-5 text-left text-xs font-medium text-slate-500 uppercase">Ombor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleRecords.map((sale, index) => (
                      <motion.tr
                        key={sale.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-5 text-sm text-slate-400">{sale.id}</td>
                        <td className="py-3 px-5 text-sm text-white">{sale.productName}</td>
                        <td className="py-3 px-5 text-sm text-slate-300">{sale.customer}</td>
                        <td className="py-3 px-5 text-sm text-white text-right">{sale.quantity}</td>
                        <td className="py-3 px-5 text-sm text-slate-400 text-right">{sale.price.toLocaleString()}</td>
                        <td className="py-3 px-5 text-sm font-semibold text-emerald-400 text-right">{sale.total.toLocaleString()}</td>
                        <td className="py-3 px-5 text-sm text-slate-400">{sale.date}</td>
                        <td className="py-3 px-5 text-sm text-slate-400">{sale.warehouse}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* IKPU TAB */}
        {activeTab === "ikpu" && (
          <motion.div
            key="ikpu"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  IKPU Klassifikator
                </h3>
                <span className="text-xs text-slate-500">{ikpuCodes.length} ta kod</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/30">
                      <th className="py-3 px-5 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
                      <th className="py-3 px-5 text-left text-xs font-medium text-slate-500 uppercase">Nomi</th>
                      <th className="py-3 px-5 text-left text-xs font-medium text-slate-500 uppercase">Kategoriya</th>
                      <th className="py-3 px-5 text-center text-xs font-medium text-slate-500 uppercase">QQS</th>
                      <th className="py-3 px-5 text-right text-xs font-medium text-slate-500 uppercase">Tovarlar</th>
                      <th className="py-3 px-5 text-right text-xs font-medium text-slate-500 uppercase">Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ikpuCodes.map((ikpu, index) => (
                      <motion.tr
                        key={ikpu.code}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <Barcode className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-mono font-medium text-white">{ikpu.code}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-sm text-white">{ikpu.name}</td>
                        <td className="py-3.5 px-5 text-sm text-slate-300">{ikpu.category}</td>
                        <td className="py-3.5 px-5 text-center">
                          <span className={`text-sm font-medium ${ikpu.vatPercent === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                            {ikpu.vatPercent}%
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <span className="text-sm font-semibold text-white">{ikpu.productsCount}</span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* WAREHOUSE TAB */}
        {activeTab === "warehouse" && (
          <motion.div
            key="warehouse"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {warehouses.map((wh, index) => {
                const whStatus = warehouseStatusConfig[wh.status];
                const usedPercent = Math.round((wh.used / wh.capacity) * 100);
                return (
                  <motion.div
                    key={wh.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                          <Warehouse className="w-6 h-6 text-slate-500" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-white">{wh.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span className="text-xs text-slate-500">{wh.location}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${whStatus.bg} ${whStatus.color}`}>
                        {whStatus.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Tovarlar</p>
                        <p className="text-lg font-bold text-white">{wh.productsCount}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Sig'im</p>
                        <p className="text-lg font-bold text-white">{wh.capacity.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Band</p>
                        <p className={`text-lg font-bold ${usedPercent > 90 ? "text-red-400" : usedPercent > 70 ? "text-amber-400" : "text-emerald-400"}`}>
                          {wh.used.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-500">To'ldirilganligi</span>
                        <span className={`text-xs font-bold ${usedPercent > 90 ? "text-red-400" : usedPercent > 70 ? "text-amber-400" : "text-emerald-400"}`}>
                          {usedPercent}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${usedPercent}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className={`h-full rounded-full ${usedPercent > 90 ? "bg-red-500" : usedPercent > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs text-slate-400">Menejer: {wh.manager}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Warehouse Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-slate-400" />
                Omborlar umumiy statistikasi
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Jami omborlar</p>
                  <p className="text-2xl font-bold text-white">{warehouses.length}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Umumiy sig'im</p>
                  <p className="text-2xl font-bold text-white">{warehouses.reduce((s, w) => s + w.capacity, 0).toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Band joy</p>
                  <p className="text-2xl font-bold text-amber-400">{warehouses.reduce((s, w) => s + w.used, 0).toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Bo'sh joy</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {(warehouses.reduce((s, w) => s + w.capacity, 0) - warehouses.reduce((s, w) => s + w.used, 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {detailProduct && (
          <ProductDetailModal
            product={detailProduct}
            onClose={() => setDetailProduct(null)}
            onUpdate={handleUpdateProduct}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
