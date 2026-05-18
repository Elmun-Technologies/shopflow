import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Package,
  Barcode,
  Tag,
  Warehouse,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  FileText,
  Minus,
  Plus,
  Save,
  Copy,
} from "lucide-react";
import type { Product } from "../data/productsData";
import { saleRecords } from "../data/productsData";

interface Props {
  product: Product | null;
  onClose: () => void;
  onUpdate?: (product: Product) => void;
}

type Tab = "info" | "pricing" | "stock" | "sales" | "ikpu";

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Faol" },
  inactive: { color: "text-slate-400", bg: "bg-slate-500/10", label: "Nofaol" },
  out_of_stock: { color: "text-red-400", bg: "bg-red-500/10", label: "Tugagan" },
  discontinued: { color: "text-amber-400", bg: "bg-amber-500/10", label: "Bekor qilingan" },
};

export default function ProductDetailModal({ product, onClose, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [editedProduct, setEditedProduct] = useState<Product>(product ?? ({} as Product));
  const [stockAdjustment, setStockAdjustment] = useState(0);

  if (!product) return null;

  const productSales = saleRecords.filter((s) => s.productId === product.id);
  const totalSold = productSales.reduce((sum, s) => sum + s.quantity, 0);
  const totalRevenue = productSales.reduce((sum, s) => sum + s.total, 0);
  const profit = (product.price - product.costPrice) * totalSold;
  const profitMargin = ((product.price - product.costPrice) / product.price * 100).toFixed(1);
  const stockPercent = Math.round((product.stock / product.maxStock) * 100);
  const isLowStock = product.stock <= product.minStock;
  const isOutOfStock = product.stock === 0;

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "info", label: "Asosiy ma'lumotlar", icon: Package },
    { key: "pricing", label: "Narxlar", icon: DollarSign },
    { key: "stock", label: "Ombor", icon: Warehouse },
    { key: "sales", label: "Sotuvlar", icon: TrendingUp },
    { key: "ikpu", label: "IKPU", icon: Tag },
  ];

  const handleSave = () => {
    onUpdate?.(editedProduct);
    onClose();
  };

  const status = statusConfig[product.status];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-slate-800">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center">
                <Package className="w-8 h-8 text-slate-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{product.name}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-sm text-slate-500">{product.sku}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                  {isLowStock && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      <AlertTriangle className="w-3 h-3" />
                      Kam qoldi
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Saqlash
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pt-4 border-b border-slate-800 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* INFO TAB */}
              {activeTab === "info" && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Tovar nomi</label>
                      <input
                        value={editedProduct.name}
                        onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">SKU</label>
                      <div className="flex items-center gap-2">
                        <input
                          value={editedProduct.sku}
                          readOnly
                          className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400"
                        />
                        <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Kategoriya</label>
                      <select
                        value={editedProduct.categoryId}
                        onChange={(e) => setEditedProduct({ ...editedProduct, categoryId: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="cat-1">Elektronika</option>
                        <option value="cat-2">Kiyim-kechak</option>
                        <option value="cat-3">Oziq-ovqat</option>
                        <option value="cat-4">Maishiy texnika</option>
                        <option value="cat-5">Sport anjomlari</option>
                        <option value="cat-6">Kitoblar</option>
                        <option value="cat-7">O'yinchoqlar</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Yetkazib beruvchi</label>
                      <input
                        value={editedProduct.supplier}
                        onChange={(e) => setEditedProduct({ ...editedProduct, supplier: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Barcode</label>
                      <div className="flex items-center gap-2">
                        <Barcode className="w-4 h-4 text-slate-500" />
                        <input
                          value={editedProduct.barcode}
                          onChange={(e) => setEditedProduct({ ...editedProduct, barcode: e.target.value })}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">O'lchov birligi</label>
                      <select
                        value={editedProduct.unit}
                        onChange={(e) => setEditedProduct({ ...editedProduct, unit: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="dona">Dona</option>
                        <option value="kg">Kilogram</option>
                        <option value="l">Litr</option>
                        <option value="m">Metr</option>
                        <option value="qadoq">Qadoq</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Tavsif</label>
                    <textarea
                      value={editedProduct.description}
                      onChange={(e) => setEditedProduct({ ...editedProduct, description: e.target.value })}
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Og'irligi (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editedProduct.weight}
                        onChange={(e) => setEditedProduct({ ...editedProduct, weight: parseFloat(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">O'lchamlari</label>
                      <input
                        value={editedProduct.dimensions}
                        onChange={(e) => setEditedProduct({ ...editedProduct, dimensions: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Reyting</p>
                      <p className="text-lg font-bold text-white mt-1">{product.rating}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Sotilgan</p>
                      <p className="text-lg font-bold text-emerald-400 mt-1">{product.sold}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Qaytarilgan</p>
                      <p className="text-lg font-bold text-red-400 mt-1">{product.returns}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Qaytarish %</p>
                      <p className="text-lg font-bold text-white mt-1">
                        {((product.returns / product.sold) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PRICING TAB */}
              {activeTab === "pricing" && (
                <motion.div
                  key="pricing"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Sotib olish narxi</p>
                      <div className="flex items-center gap-2 mt-2">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <input
                          type="number"
                          value={editedProduct.costPrice}
                          onChange={(e) => setEditedProduct({ ...editedProduct, costPrice: parseInt(e.target.value) || 0 })}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-lg font-bold text-white focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Sotish narxi</p>
                      <div className="flex items-center gap-2 mt-2">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <input
                          type="number"
                          value={editedProduct.price}
                          onChange={(e) => setEditedProduct({ ...editedProduct, price: parseInt(e.target.value) || 0 })}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-lg font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Chegirma narxi</p>
                      <div className="flex items-center gap-2 mt-2">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <input
                          type="number"
                          value={editedProduct.salePrice || ""}
                          onChange={(e) => setEditedProduct({ ...editedProduct, salePrice: e.target.value ? parseInt(e.target.value) : undefined })}
                          placeholder="Chegirma yo'q"
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-lg font-bold text-amber-400 focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Narx tahlili</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Foyda (1 dona)</p>
                        <p className="text-base font-bold text-emerald-400 mt-1">
                          {(editedProduct.price - editedProduct.costPrice).toLocaleString()} so'm
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Foyda marjasi</p>
                        <p className="text-base font-bold text-emerald-400 mt-1">
                          {((editedProduct.price - editedProduct.costPrice) / editedProduct.price * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Umumiy foyda</p>
                        <p className="text-base font-bold text-white mt-1">
                          {profit.toLocaleString()} so'm
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Chegirma %</p>
                        <p className="text-base font-bold text-amber-400 mt-1">
                          {editedProduct.salePrice
                            ? (((editedProduct.price - editedProduct.salePrice) / editedProduct.price) * 100).toFixed(0) + "%"
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Price comparison bar */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span>Sotib olish: {editedProduct.costPrice.toLocaleString()}</span>
                        <span>Sotish: {editedProduct.price.toLocaleString()}</span>
                      </div>
                      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="h-full bg-slate-500"
                            style={{ width: `${(editedProduct.costPrice / editedProduct.price) * 100}%` }}
                          />
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${((editedProduct.price - editedProduct.costPrice) / editedProduct.price) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1.5">
                        <span className="text-slate-500">Xarajat</span>
                        <span className="text-emerald-400">Foyda</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STOCK TAB */}
              {activeTab === "stock" && (
                <motion.div
                  key="stock"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-5"
                >
                  {/* Stock Overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Joriy zaxira</p>
                      <p className={`text-2xl font-bold mt-1 ${isOutOfStock ? "text-red-400" : isLowStock ? "text-amber-400" : "text-emerald-400"}`}>
                        {editedProduct.stock} {editedProduct.unit}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Minimal zaxira</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {editedProduct.minStock} {editedProduct.unit}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Maksimal zaxira</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {editedProduct.maxStock} {editedProduct.unit}
                      </p>
                    </div>
                  </div>

                  {/* Stock Progress */}
                  <div className="bg-slate-800/30 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">Ombor to'ldirilganligi</h3>
                      <span className={`text-sm font-bold ${isOutOfStock ? "text-red-400" : isLowStock ? "text-amber-400" : "text-emerald-400"}`}>
                        {stockPercent}%
                      </span>
                    </div>
                    <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stockPercent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${isOutOfStock ? "bg-red-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"}`}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                      <span>0</span>
                      <span>Minimal: {editedProduct.minStock}</span>
                      <span>Maksimal: {editedProduct.maxStock}</span>
                    </div>
                  </div>

                  {/* Stock Adjustment */}
                  <div className="bg-slate-800/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Zaxirani boshqarish</h3>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setStockAdjustment(Math.max(-editedProduct.stock, stockAdjustment - 1))}
                        className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="flex-1 text-center">
                        <p className="text-2xl font-bold text-white">{stockAdjustment > 0 ? `+${stockAdjustment}` : stockAdjustment}</p>
                        <p className="text-xs text-slate-500">{editedProduct.unit}</p>
                      </div>
                      <button
                        onClick={() => setStockAdjustment(stockAdjustment + 1)}
                        className="w-10 h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {stockAdjustment !== 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-3 bg-slate-800 rounded-lg"
                      >
                        <p className="text-sm text-slate-300">
                          Yangi zaxira: <span className="font-bold text-white">{editedProduct.stock}</span>
                          {" "}{stockAdjustment > 0 ? "+" : ""}{stockAdjustment} ={" "}
                          <span className="font-bold text-emerald-400">{editedProduct.stock + stockAdjustment}</span> {editedProduct.unit}
                        </p>
                        <button
                          onClick={() => {
                            const newStock = Math.max(0, editedProduct.stock + stockAdjustment);
                            setEditedProduct({ ...editedProduct, stock: newStock });
                            setStockAdjustment(0);
                            onUpdate?.({ ...editedProduct, stock: newStock });
                          }}
                          className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Tasdiqlash
                        </button>
                      </motion.div>
                    )}
                  </div>

                  {/* Warehouse Info */}
                  <div className="bg-slate-800/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-slate-400" />
                      Ombor ma'lumotlari
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Ombor</p>
                        <p className="text-sm text-white mt-0.5">{product.warehouse}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Ombor ID</p>
                        <p className="text-sm text-white mt-0.5">{product.warehouseId}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SALES TAB */}
              {activeTab === "sales" && (
                <motion.div
                  key="sales"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Jami sotuvlar</p>
                      <p className="text-xl font-bold text-white mt-1">{totalSold}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Daromad</p>
                      <p className="text-xl font-bold text-emerald-400 mt-1">{totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Foyda</p>
                      <p className="text-xl font-bold text-emerald-400 mt-1">{profit.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Marja</p>
                      <p className="text-xl font-bold text-white mt-1">{profitMargin}%</p>
                    </div>
                  </div>

                  <div className="bg-slate-800/30 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800">
                      <h3 className="text-sm font-semibold text-white">So'nggi sotuvlar</h3>
                    </div>
                    {productSales.length === 0 ? (
                      <div className="py-8 text-center">
                        <TrendingUp className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Hali sotuvlar yo'q</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-800">
                              <th className="text-left text-xs text-slate-500 uppercase py-2 px-4">Sana</th>
                              <th className="text-left text-xs text-slate-500 uppercase py-2 px-4">Mijoz</th>
                              <th className="text-right text-xs text-slate-500 uppercase py-2 px-4">Soni</th>
                              <th className="text-right text-xs text-slate-500 uppercase py-2 px-4">Summa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {productSales.map((sale) => (
                              <tr key={sale.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                <td className="py-2.5 px-4 text-sm text-slate-400">{sale.date}</td>
                                <td className="py-2.5 px-4 text-sm text-white">{sale.customer}</td>
                                <td className="py-2.5 px-4 text-sm text-white text-right">{sale.quantity}</td>
                                <td className="py-2.5 px-4 text-sm font-semibold text-emerald-400 text-right">{sale.total.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* IKPU TAB */}
              {activeTab === "ikpu" && (
                <motion.div
                  key="ikpu"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-5"
                >
                  <div className="bg-slate-800/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-400" />
                      IKPU ma'lumotlari
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-500 mb-1.5 block">IKPU kodi</label>
                        <div className="flex items-center gap-2">
                          <input
                            value={editedProduct.ikpu}
                            readOnly
                            className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400"
                          />
                          <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1.5 block">IKPU nomi</label>
                        <input
                          value={editedProduct.ikpuName}
                          readOnly
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1.5 block">QQS stavkasi</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editedProduct.vatPercent}
                            onChange={(e) => setEditedProduct({ ...editedProduct, vatPercent: parseInt(e.target.value) || 0 })}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                          />
                          <span className="text-sm text-slate-500">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1.5 block">QQS summasi</label>
                        <input
                          value={Math.round(editedProduct.price * editedProduct.vatPercent / 100).toLocaleString() + " so'm"}
                          readOnly
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Narx tarkibi</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 border-b border-slate-800">
                        <span className="text-sm text-slate-400">Asosiy narx</span>
                        <span className="text-sm font-medium text-white">{editedProduct.price.toLocaleString()} so'm</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-800">
                        <span className="text-sm text-slate-400">QQS ({editedProduct.vatPercent}%)</span>
                        <span className="text-sm font-medium text-amber-400">
                          {Math.round(editedProduct.price * editedProduct.vatPercent / 100).toLocaleString()} so'm
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm font-semibold text-white">Jami (QQS bilan)</span>
                        <span className="text-sm font-bold text-emerald-400">
                          {Math.round(editedProduct.price * (1 + editedProduct.vatPercent / 100)).toLocaleString()} so'm
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-400">IKPU eslatma</p>
                        <p className="text-xs text-slate-400 mt-1">
                          IKPU (Import Klassifikator va Product Unit) kodi tovarlarni soliq maqsadlarida klassifikatsiya qilish uchun ishlatiladi. 
                          Har bir tovar uchun to'g'ri IKPU kodi tanlanganligiga ishonch hosil qiling.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
