import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Share2 } from "lucide-react";
import type { ChannelPost, ChannelPostStatus, ChannelPlatform } from "../../data/marketingData";
import { initialChannelPosts, channelPlatformLabels, channelPostStatusLabels } from "../../data/marketingData";
import EmptyState from "../EmptyState";
import { useT } from "../../i18n";

const inputClass = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 focus:ring-1 focus:ring-leaf-500/20";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-forest-700 border-t border-cream-300";

function PlatformBadge({ platform }: { platform: ChannelPlatform }) {
  const colors: Record<ChannelPlatform, string> = {
    telegram: "bg-sky-100 text-sky-600 border border-sky-300",
    instagram: "bg-pink-100 text-pink-600 border border-pink-500/30",
    facebook: "bg-blue-600/15 text-sky-700 border border-blue-600/30",
    youtube: "bg-red-500/15 text-rose-600 border border-rose-300",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[platform]}`}>{channelPlatformLabels[platform]}</span>;
}

function PostStatusBadge({ status }: { status: ChannelPostStatus }) {
  const map: Record<ChannelPostStatus, string> = {
    draft: "bg-cream-200 text-slate-700",
    scheduled: "bg-sky-100 text-sky-600 border border-sky-300",
    published: "bg-leaf-100 text-forest-700 border border-leaf-400/50",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{channelPostStatusLabels[status]}</span>;
}

export default function KanalPage() {
  const { t } = useT();
  const [posts, setPosts] = useState<ChannelPost[]>(initialChannelPosts);
  const [search, setSearch] = useState("");
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");
  const [editItem, setEditItem] = useState<ChannelPost | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
  }, [posts, search]);

  const stats = useMemo(() => {
    const published = posts.filter((p) => p.status === "published").length;
    const totalReach = posts.reduce((s, p) => s + p.reach, 0);
    return {
      totalPosts: posts.length,
      published,
      totalReach,
    };
  }, [posts]);

  const handleSave = (data: Omit<ChannelPost, "id" | "reach">) => {
    if (!data.title.trim()) {
      setFormError(t("mkt.err.titleRequired"));
      return;
    }
    if (editItem) {
      setPosts((prev) => prev.map((p) => (p.id === editItem.id ? { ...editItem, ...data } : p)));
    } else {
      const newPost: ChannelPost = { id: `post-${Date.now()}`, reach: 0, ...data };
      setPosts((prev) => [newPost, ...prev]);
    }
    setPageMode("list");
    setEditItem(null);
    setFormError(null);
  };

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-cream-300">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-cream-100" aria-label={t("common.back")}><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-forest-800">{editItem ? t("kanal.editTitle") : t("kanal.newTitle")}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
            <button form="post-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 text-forest-800 font-medium">{t("common.save")}</button>
          </div>
        </div>

        <PostForm initial={editItem} error={formError} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-800">{t("kanal.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("kanal.subtitle")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("kanal.stat.total")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalPosts}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("kanal.status.published")}</p>
            <p className="text-lg font-semibold text-forest-700">{stats.published}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("kanal.stat.totalReach")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalReach.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.search")} className={inputClass + " pl-10"} />
        </div>
        <button onClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-leaf-400 text-forest-800 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          {t("kanal.new")}
        </button>
      </div>

      {posts.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <EmptyState
            icon={Share2}
            title={t("kanal.empty.title")}
            description={t("kanal.empty.desc")}
            buttonText={t("kanal.new")}
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-purple-400"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <table className="w-full min-w-[850px]">
            <thead className="bg-white/80">
              <tr>
                <th className={thClass}>{t("kanal.col.title")}</th>
                <th className={thClass}>{t("kanal.col.platform")}</th>
                <th className={thClass}>{t("mkt.col.status")}</th>
                <th className={thClass}>{t("kanal.col.scheduledAt")}</th>
                <th className={thClass}>{t("kanal.col.reach")}</th>
                <th className={`${thClass} text-right`}>{t("mkt.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-cream-100/40">
                  <td className={tdClass + " font-medium"}>{p.title}</td>
                  <td className={tdClass}><PlatformBadge platform={p.platform as ChannelPlatform} /></td>
                  <td className={tdClass}><PostStatusBadge status={p.status} /></td>
                  <td className={tdClass + " text-xs text-slate-500"}>{p.scheduledAt}</td>
                  <td className={tdClass}>{p.reach.toLocaleString()}</td>
                  <td className={tdClass + " text-right whitespace-nowrap"}>
                    <button onClick={() => { setEditItem(p); setPageMode("edit"); }} className="p-1.5 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(p.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-cream-100"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">{t("mkt.noData")}</div>}
        </motion.div>
      )}

      <AnimatePresence>
        {pendingDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={() => setPendingDelete(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border border-cream-300 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-forest-800 font-medium mb-2">{t("mkt.confirmDelete.title")}</p>
              <p className="text-sm text-slate-500 mb-6">{t("mkt.confirmDelete.body")}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
                <button onClick={() => { setPosts((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-forest-800 font-medium">{t("common.delete")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PostFormProps {
  initial: ChannelPost | null;
  error: string | null;
  onSave: (data: Omit<ChannelPost, "id" | "reach">) => void;
}

function PostForm({ initial, error, onSave }: PostFormProps) {
  const { t } = useT();
  const [platform, setPlatform] = useState<ChannelPlatform>(initial?.platform ?? "telegram");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? "");
  const [scheduledAt, setScheduledAt] = useState(initial?.scheduledAt ?? "");
  const [status, setStatus] = useState<ChannelPostStatus>(initial?.status ?? "draft");
  const [link, setLink] = useState(initial?.link ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ platform, title, content, mediaUrl, scheduledAt, status, link });
  };

  return (
    <form id="post-form" onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("kanal.form.section")}</h3>
          <div>
            <label className={labelClass}>{t("kanal.col.platform")}</label>
            <select className={inputClass} value={platform} onChange={(e) => setPlatform(e.target.value as ChannelPlatform)}>
              <option value="telegram">Telegram</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("kanal.col.title")}</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("kanal.form.content")}</label>
            <textarea className={inputClass + " min-h-[150px]"} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("kanal.form.mediaUrl")}</label>
            <input className={inputClass} value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("kanal.form.links")}</h3>
          <div>
            <label className={labelClass}>{t("kanal.form.postLink")}</label>
            <input className={inputClass} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("mkt.form.settings")}</h3>
          <div>
            <label className={labelClass}>{t("mkt.col.status")}</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ChannelPostStatus)}>
              <option value="draft">{t("kanal.status.draft")}</option>
              <option value="scheduled">{t("kanal.status.scheduled")}</option>
              <option value="published">{t("kanal.status.published")}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("kanal.col.scheduledAt")}</label>
            <input className={inputClass} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          {error && <div className="rounded-lg border border-red-500/40 bg-rose-100 px-3 py-2 text-sm text-red-300">{error}</div>}
        </div>
      </div>
    </form>
  );
}
